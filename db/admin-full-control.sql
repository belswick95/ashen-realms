-- Owner "full control" console (admin-full.js): catalog editor, game multipliers, extended quest
-- editor, player inspector (XP / inventory / bank / equipment / gold), permanent bans, password
-- reset lookup, ground drops, base-actor loot/rewards, searchable audit trail, world backups.
--
-- Every command is named fc_* and reaches eldervale_private.admin_full_control through
-- public.world_admin -> admin_action. The dispatcher re-checks is_owner() and every write inserts
-- an audit row. Nothing is removed: items are disabled with a flag, backups restore by upsert and
-- "mirror" restores mark extra entities deleted=true (soft) so they can be restored again.
--
-- Multipliers (table game_settings, key 'multipliers') are applied by thin wrappers so the award
-- sites that other migrations are rewriting stay untouched:
--   skill_xp(uuid,text,numeric)     -> wrapper; original body kept as skill_xp_unscaled (the integer
--                                      overload from db/osrs-skill-parity.sql only forwards to it)
--   combat_xp(uid,damage,style,w)   -> wrapper; original body kept as combat_xp_unscaled; the gain
--                                      it wrote is re-scaled per skill afterwards
--   gathering_tick(t)               -> woodcutting XP passes through xp_scaled() (soft patch)
--   actor_loot(text,uuid)           -> loot chance * dropRate, rows with always=true never roll
--   merchant_quote(...)             -> base prices * shopPrice (function becomes STABLE)
--   realm_actors respawn_at         -> BEFORE UPDATE trigger scales the delay by respawn
-- Also patched: validate_offer (tradeable=false items cannot be traded), snapshot (gameConfig +
-- catalogOverrides for clients), admin_action (fc_* dispatch).
-- Soft patches (eldervale_private.soft_patch) skip with a NOTICE instead of failing when another
-- migration has already reshaped the anchor; re-running this file after such a migration re-wraps.
-- Apply after db/osrs-skill-parity.sql and db/osrs-equipment-combat.sql. Idempotent.

-- ---------------------------------------------------------------- settings store
create table if not exists eldervale_private.game_settings(
 key text primary key,
 value jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now(),
 updated_by uuid
);
revoke all on table eldervale_private.game_settings from public,anon,authenticated;
insert into eldervale_private.game_settings(key,value) values
 ('multipliers','{"xp":1,"skills":{},"dropRate":1,"respawn":1,"shopPrice":1}'::jsonb),
 ('world','{"timeOverride":null}'::jsonb)
on conflict(key) do nothing;

-- ---------------------------------------------------------------- multiplier helpers
create or replace function eldervale_private.game_multiplier(name text) returns numeric
language sql stable security definer set search_path='' as $fn$
 select greatest(0,least(100,coalesce((select (g.value->>name)::numeric from eldervale_private.game_settings g where g.key='multipliers' and jsonb_typeof(g.value->name)='number'),1)))
$fn$;

-- Skill names arrive as 'woodcutting', 'attackXP', 'woodXP' or 'mining'; all map to one key.
create or replace function eldervale_private.xp_skill_name(skill text) returns text
language sql immutable set search_path='' as $fn$
 select case regexp_replace(lower(coalesce(skill,'')),'xp$','') when 'wood' then 'woodcutting' else regexp_replace(lower(coalesce(skill,'')),'xp$','') end
$fn$;

create or replace function eldervale_private.xp_multiplier(skill text) returns numeric
language sql stable security definer set search_path='' as $fn$
 select greatest(0,least(100,eldervale_private.game_multiplier('xp')*coalesce((select (g.value->'skills'->>eldervale_private.xp_skill_name(skill))::numeric from eldervale_private.game_settings g where g.key='multipliers' and jsonb_typeof(g.value->'skills'->eldervale_private.xp_skill_name(skill))='number'),1)))
$fn$;

create or replace function eldervale_private.xp_scaled(skill text, amount numeric) returns integer
language sql stable set search_path='' as $fn$
 select case when amount is null then null else least(2000000000,greatest(-2000000000,round(amount*eldervale_private.xp_multiplier(skill))))::integer end
$fn$;

-- Two-decimal variant for the numeric XP introduced by db/osrs-skill-parity.sql.
create or replace function eldervale_private.xp_scaled_exact(skill text, amount numeric) returns numeric
language sql stable set search_path='' as $fn$
 select case when amount is null then null else trim_scale(round(amount*eldervale_private.xp_multiplier(skill),2)) end
$fn$;

create or replace function eldervale_private.xp_multipliers_identity() returns boolean
language sql stable security definer set search_path='' as $fn$
 select eldervale_private.game_multiplier('xp')=1 and not exists(
  select 1 from eldervale_private.game_settings g cross join lateral jsonb_each(coalesce(g.value->'skills','{}'::jsonb)) s
  where g.key='multipliers' and jsonb_typeof(s.value)='number' and (s.value#>>'{}')::numeric<>1)
$fn$;

-- Values the game client may read (time of day override and the multipliers for display).
create or replace function eldervale_private.public_game_config() returns jsonb
language sql stable security definer set search_path='' as $fn$
 select jsonb_build_object(
  'timeOverride',(select g.value->'timeOverride' from eldervale_private.game_settings g where g.key='world'),
  'multipliers',coalesce((select g.value from eldervale_private.game_settings g where g.key='multipliers'),'{}'::jsonb))
$fn$;

-- ---------------------------------------------------------------- function surgery helpers
-- Copies a function under a new name (same arguments, body and attributes).
create or replace function eldervale_private.clone_function(target regprocedure, new_name text) returns text
language plpgsql set search_path='' as $fn$
declare def text:=pg_get_functiondef(target);name text:=target::oid::regproc::text;head text;at integer;
begin
 if new_name!~'^[a-z][a-z0-9_]{2,60}$' then raise exception 'Invalid clone name';end if;
 head:='FUNCTION '||name||'(';at:=position(head in def);
 if at=0 then raise exception 'Cannot find header of %',name;end if;
 def:=overlay(def placing 'FUNCTION eldervale_private.'||new_name||'(' from at for length(head));
 execute def;
 return 'eldervale_private.'||new_name;
end $fn$;

-- Patches only when the marker is absent and every anchor matches exactly once; otherwise
-- explains itself in a NOTICE and leaves the function as it is.
create or replace function eldervale_private.soft_patch(target text, marker text, edits text[]) returns text
language plpgsql set search_path='' as $fn$
declare fn regprocedure:=to_regprocedure(target);def text;n integer;
begin
 if fn is null then raise notice 'admin-full-control: % not found, skipped',target;return target||': missing';end if;
 def:=pg_get_functiondef(fn);
 if position(marker in def)>0 then return target||': already patched';end if;
 for i in 1..cardinality(edits)/2 loop
  n:=(length(def)-length(replace(def,edits[2*i-1],'')))/length(edits[2*i-1]);
  if n<>1 then raise notice 'admin-full-control: anchor % of % matched % times, skipped',i,target,n;return target||': anchor changed, skipped';end if;
 end loop;
 perform eldervale_private.patch_function(fn,edits);
 return target||': patched';
end $fn$;
revoke all on function eldervale_private.clone_function(regprocedure,text),eldervale_private.soft_patch(text,text,text[]) from public,anon,authenticated;

-- ---------------------------------------------------------------- XP wrappers
-- db/osrs-skill-parity.sql made XP numeric (2 decimals): skill_xp(uuid,text,numeric) is the entry
-- point and skill_xp(uuid,text,integer) only forwards to it, so the numeric one is wrapped. On a
-- database that predates that file the integer version is wrapped instead.
do $do$
declare sig text:='eldervale_private.skill_xp(uuid,text,numeric)';
begin
 if to_regprocedure(sig) is null then sig:='eldervale_private.skill_xp(uuid,text,integer)';end if;
 if to_regprocedure(sig) is null then raise notice 'admin-full-control: skill_xp missing, XP multiplier not wired';return;end if;
 if position('fc:xp-multiplier' in pg_get_functiondef(to_regprocedure(sig)))=0 then
  perform eldervale_private.clone_function(to_regprocedure(sig),'skill_xp_unscaled');
 end if;
 if sig like '%numeric)' then
  execute $q$create or replace function eldervale_private.skill_xp(uid uuid, skill text, amount numeric) returns void
language plpgsql set search_path='' as $fn$
-- fc:xp-multiplier wrapper (db/admin-full-control.sql). The original body lives in skill_xp_unscaled.
begin
 perform eldervale_private.skill_xp_unscaled(uid,skill,eldervale_private.xp_scaled_exact(skill,amount));
end $fn$$q$;
 else
  execute $q$create or replace function eldervale_private.skill_xp(uid uuid, skill text, amount integer) returns void
language plpgsql set search_path='' as $fn$
-- fc:xp-multiplier wrapper (db/admin-full-control.sql). The original body lives in skill_xp_unscaled.
begin
 perform eldervale_private.skill_xp_unscaled(uid,skill,eldervale_private.xp_scaled(skill,amount));
end $fn$$q$;
 end if;
end $do$;

do $do$
declare sig constant text:='eldervale_private.combat_xp(uuid,integer,text,jsonb)';
begin
 if to_regprocedure(sig) is null then raise notice 'admin-full-control: combat_xp(uuid,integer,text,jsonb) missing, combat XP multiplier not wired';return;end if;
 if position('fc:xp-multiplier' in pg_get_functiondef(to_regprocedure(sig)))=0 then
  perform eldervale_private.clone_function(to_regprocedure(sig),'combat_xp_unscaled');
 end if;
 execute $q$create or replace function eldervale_private.combat_xp(uid uuid, damage integer, style text, w jsonb) returns void
language plpgsql set search_path='' as $fn$
-- fc:xp-multiplier wrapper (db/admin-full-control.sql). The original body lives in combat_xp_unscaled;
-- whatever XP it awards is re-scaled per skill, so its formulas can change freely.
declare before_skills jsonb;after_skills jsonb;k text;gain numeric;fix jsonb:='{}'::jsonb;
begin
 select skills into before_skills from public.player_saves where user_id=uid;
 perform eldervale_private.combat_xp_unscaled(uid,damage,style,w);
 if eldervale_private.xp_multipliers_identity() then return;end if;
 select skills into after_skills from public.player_saves where user_id=uid;
 for k in select key from jsonb_each(coalesce(after_skills,'{}'::jsonb)) where key like '%XP' and jsonb_typeof(value)='number' loop
  gain:=(after_skills->>k)::numeric-coalesce((before_skills->>k)::numeric,0);
  if gain>0 then fix:=fix||jsonb_build_object(k,trim_scale(least(200000000,greatest(0,coalesce((before_skills->>k)::numeric,0)+eldervale_private.xp_scaled_exact(k,gain)))));end if;
 end loop;
 if fix<>'{}'::jsonb then update public.player_saves set skills=skills||fix where user_id=uid;end if;
end $fn$$q$;
end $do$;

-- ---------------------------------------------------------------- soft patches of award sites
-- Woodcutting XP is written inline by gathering_tick. The first form matches db/osrs-skill-parity.sql,
-- the second the older integer body; whichever is present gets patched, the other is skipped.
select eldervale_private.soft_patch('eldervale_private.gathering_tick(timestamp with time zone)','xp_scaled_exact(''woodcutting''',array[
 '+eldervale_private.tree_log_xp_osrs(o.data)*n)',
 '+eldervale_private.xp_scaled_exact(''woodcutting'',eldervale_private.tree_log_xp_osrs(o.data)*n))']);
select eldervale_private.soft_patch('eldervale_private.gathering_tick(timestamp with time zone)','xp_scaled_exact(''woodcutting''',array[
 '+eldervale_private.tree_log_xp(o.data)*n)',
 '+round(eldervale_private.xp_scaled_exact(''woodcutting'',eldervale_private.tree_log_xp(o.data)*n))::integer)']);

select eldervale_private.soft_patch('eldervale_private.actor_loot(text,uuid)','dropRate',array[
 'if random()>least(1,greatest(0,coalesce((l->>''chance'')::float8,1))) then continue;end if;',
 'if not coalesce((l->>''always'')::boolean,false) and random()>least(1,greatest(0,coalesce((l->>''chance'')::float8,1)*eldervale_private.game_multiplier(''dropRate''))) then continue;end if;']);

select eldervale_private.soft_patch('eldervale_private.merchant_quote(integer,integer,integer,integer,boolean,integer)','shopPrice',array[
 'IMMUTABLE','STABLE',
 'then raise exception ''Invalid merchant quote'';end if;',
 'then raise exception ''Invalid merchant quote'';end if;
 base_buy:=greatest(1,round(base_buy*eldervale_private.game_multiplier(''shopPrice'')))::integer;base_sell:=least(base_buy,greatest(0,round(base_sell*eldervale_private.game_multiplier(''shopPrice''))))::integer;']);

select eldervale_private.soft_patch('eldervale_private.validate_offer(uuid,jsonb)','cannot be traded',array[
 'or eldervale_private.item_worn(uid,k) then raise exception ''Unavailable or equipped trade item: %'',k;end if;',
 'or eldervale_private.item_worn(uid,k) then raise exception ''Unavailable or equipped trade item: %'',k;end if;
  if exists(select 1 from eldervale_private.realm_catalog where id=''item:''||k and data->>''tradeable''=''false'') then raise exception ''This item cannot be traded: %'',k;end if;']);

select eldervale_private.soft_patch('eldervale_private.snapshot(bigint)','catalogOverrides',array[
 '||jsonb_build_object(''professions'',',
 '||jsonb_build_object(''gameConfig'',eldervale_private.public_game_config(),''catalogOverrides'',(select coalesce(jsonb_object_agg(c.id,c.data),''{}''::jsonb) from eldervale_private.realm_catalog c where c.data?''ownerEdited''),''professions'',']);

-- ---------------------------------------------------------------- respawn multiplier
create or replace function eldervale_private.scale_actor_respawn() returns trigger
language plpgsql security definer set search_path='' as $fn$
declare m numeric;now_t timestamptz:=clock_timestamp();
begin
 if new.respawn_at is null or new.respawn_at is not distinct from old.respawn_at or new.respawn_at<=now_t then return new;end if;
 m:=greatest(0.05,least(20,coalesce((select (g.value->>'respawn')::numeric from eldervale_private.game_settings g where g.key='multipliers' and jsonb_typeof(g.value->'respawn')='number'),1)));
 if m<>1 then new.respawn_at:=now_t+(new.respawn_at-now_t)*m::float8;end if;
 return new;
end $fn$;
create or replace trigger fc_scale_respawn before update of respawn_at on eldervale_private.realm_actors
 for each row execute function eldervale_private.scale_actor_respawn();

-- ---------------------------------------------------------------- validators
-- Generic catalog row check: known keys are typed and bounded, unknown keys pass (future fields).
create or replace function eldervale_private.fc_check_catalog(d jsonb) returns void
language plpgsql stable set search_path='' as $fn$
declare k text;v jsonb;w jsonb;lim numeric[];
begin
 if d is null or jsonb_typeof(d)<>'object' then raise exception 'Item data must be an object';end if;
 if pg_column_size(d)>16384 then raise exception 'Item definition too large (16 KB)';end if;
 if length(trim(coalesce(d->>'name',''))) not between 1 and 80 then raise exception 'Item name must be 1–80 characters';end if;
 for k,lim in select x.k,x.lim from (values
  ('buy',array[0,2000000000]),('sell',array[0,2000000000]),('value',array[0,2000000000]),('heal',array[0,10000]),('healPct',array[0,100]),
  ('attack',array[-1000,1000]),('damage',array[0,10000]),('speed',array[0.6,30]),('reach',array[0,40]),('defence',array[-1000,1000]),
  ('reduction',array[0,1000]),('attackSpeed',array[1,20]),('rangedStrength',array[-1000,1000]),('strength',array[-1000,1000]),
  ('prayer',array[-1000,1000]),('magicDamage',array[-1000,1000]),('weight',array[-100,1000]),('level',array[1,99]),('bonus',array[-1000,1000]),('multiplier',array[0,100])
 ) x(k,lim) loop
  if d?k and jsonb_typeof(d->k)<>'null' then
   if jsonb_typeof(d->k)<>'number' then raise exception 'Field % must be a number',k;end if;
   if (d->>k)::numeric not between lim[1] and lim[2] then raise exception 'Field % must be between % and %',k,lim[1],lim[2];end if;
  end if;
 end loop;
 foreach k in array array['stackable','unique','notable','twoHanded','ranged','magic','tradeable','disabled','custom','starter','profession','members'] loop
  if d?k and jsonb_typeof(d->k) not in ('boolean','null') then raise exception 'Field % must be true or false',k;end if;
 end loop;
 foreach k in array array['description','desc','examine'] loop
  if d?k and length(coalesce(d->>k,''))>600 then raise exception 'Field % is limited to 600 characters',k;end if;
 end loop;
 foreach k in array array['category','icon','model','slot','field','key','kind','tier','skill','noteOf','color','colour'] loop
  if d?k and jsonb_typeof(d->k) not in ('string','number','null') then raise exception 'Field % must be text',k;end if;
  if d?k and length(coalesce(d->>k,''))>80 then raise exception 'Field % is limited to 80 characters',k;end if;
 end loop;
 if d?'requirements' and jsonb_typeof(d->'requirements')<>'null' then
  if jsonb_typeof(d->'requirements')<>'object' then raise exception 'Requirements must be an object of skill levels';end if;
  for k,v in select key,value from jsonb_each(d->'requirements') loop
   if k!~'^[a-zA-Z]{2,24}$' or jsonb_typeof(v)<>'number' or (v#>>'{}')::numeric<>trunc((v#>>'{}')::numeric) or (v#>>'{}')::numeric not between 1 and 99 then raise exception 'Requirement % must be a level 1–99',k;end if;
  end loop;
 end if;
 if d?'bonuses' and jsonb_typeof(d->'bonuses')<>'null' then
  if jsonb_typeof(d->'bonuses')<>'object' then raise exception 'Bonuses must be an object';end if;
  for k,v in select key,value from jsonb_each(d->'bonuses') loop
   if k!~'^[a-zA-Z]{2,24}$' then raise exception 'Invalid bonus name %',k;end if;
   if jsonb_typeof(v)='number' then
    if (v#>>'{}')::numeric not between -1000 and 1000 then raise exception 'Bonus % must be between -1000 and 1000',k;end if;
   elsif jsonb_typeof(v)='object' then
    for w in select value from jsonb_each(v) loop
     if jsonb_typeof(w)<>'number' or (w#>>'{}')::numeric not between -1000 and 1000 then raise exception 'Bonus % values must be numbers between -1000 and 1000',k;end if;
    end loop;
    if exists(select 1 from jsonb_object_keys(v) s where s!~'^[a-zA-Z]{2,24}$') then raise exception 'Invalid bonus style under %',k;end if;
   else raise exception 'Bonus % must be a number or a set of numbers',k;
   end if;
  end loop;
 end if;
end $fn$;

create or replace function eldervale_private.fc_check_dialogue(lines jsonb, what text) returns void
language plpgsql immutable set search_path='' as $fn$
declare line jsonb;
begin
 if lines is null or jsonb_typeof(lines)='null' then return;end if;
 if jsonb_typeof(lines)<>'array' or jsonb_array_length(lines)>20 then raise exception '% dialogue needs up to 20 lines',what;end if;
 for line in select value from jsonb_array_elements(lines) loop
  if jsonb_typeof(line)<>'object' or coalesce(line->>'who','') not in ('npc','player') or length(trim(coalesce(line->>'text',''))) not between 1 and 400 then raise exception '% dialogue lines need a speaker (npc/player) and 1–400 characters',what;end if;
 end loop;
end $fn$;

-- Data-driven quests (db/castle-tutorial.sql): talk kill collect event xp have equip bank visit.
create or replace function eldervale_private.fc_quest_check(d jsonb, qid uuid) returns void
language plpgsql stable security definer set search_path='' as $fn$
declare o jsonb;k text;v jsonb;t text;n numeric;i integer:=0;
 skill_names constant text[]:=array['attack','strength','defence','hitpoints','ranged','magic','prayer','mining','woodcutting','fishing','cooking','smithing','crafting','firemaking','fletching','herblore','farming','runecrafting','construction','hunter','agility','thieving'];
 events constant text[]:=array['interaction','death','woodcut','fishing','eat','player_death','player_respawn','door','skill_complete','gather_start'];
begin
 if d is null or jsonb_typeof(d)<>'object' or pg_column_size(d)>40000 then raise exception 'Quest data must be an object under 40 KB';end if;
 if length(trim(coalesce(d->>'name',''))) not between 2 and 80 then raise exception 'Quest name must be 2–80 characters';end if;
 if length(trim(coalesce(d->>'description',''))) not between 1 and 2000 then raise exception 'Quest description must be 1–2000 characters';end if;
 if not exists(select 1 from eldervale_private.realm_actors where id=d->>'giver' and not deleted and data->>'kind'='npc') then raise exception 'Choose an existing NPC as quest giver';end if;
 if coalesce(d->>'key','')<>'' then
  if d->>'key'!~'^[a-z0-9_-]{2,40}$' then raise exception 'Quest key: 2–40 lowercase letters, digits, - or _';end if;
  if exists(select 1 from eldervale_private.quest_definitions q where q.data->>'key'=d->>'key' and q.id<>qid) then raise exception 'Another quest already uses key %',d->>'key';end if;
 end if;
 if coalesce(d->>'requires','')<>'' then
  if d->>'requires'=coalesce(d->>'key','') then raise exception 'A quest cannot require itself';end if;
  if not exists(select 1 from eldervale_private.quest_definitions q where q.data->>'key'=d->>'requires' and q.id<>qid) then raise exception 'Required quest key % does not exist',d->>'requires';end if;
 end if;
 if coalesce(d->>'chain','')!~'^[a-z0-9_-]{0,40}$' then raise exception 'Chain: up to 40 lowercase letters, digits, - or _';end if;
 if d?'order' and jsonb_typeof(d->'order')<>'null' and (jsonb_typeof(d->'order')<>'number' or (d->>'order')::numeric not between 0 and 1000) then raise exception 'Order must be 0–1000';end if;
 if d?'questPoints' and jsonb_typeof(d->'questPoints')<>'null' and (jsonb_typeof(d->'questPoints')<>'number' or (d->>'questPoints')::numeric<>trunc((d->>'questPoints')::numeric) or (d->>'questPoints')::numeric not between 0 and 50) then raise exception 'Quest points must be a whole number 0–50';end if;
 if coalesce(d->>'icon','') not in ('','coins') and not exists(select 1 from eldervale_private.realm_catalog c where c.id='item:'||(d->>'icon')) then raise exception 'Quest icon must be coins or an item ID';end if;
 if coalesce(d->>'finishes','') not in ('','tutorial') then raise exception 'Finishes may only be tutorial';end if;
 if d?'published' and jsonb_typeof(d->'published') not in ('boolean','null') then raise exception 'Published must be true or false';end if;
 if length(coalesce(d->>'hint',''))>200 then raise exception 'Hint is limited to 200 characters';end if;
 if coalesce(jsonb_typeof(d->'objectives'),'null')<>'array' or jsonb_array_length(d->'objectives') not between 1 and 12 then raise exception 'Choose 1–12 objectives';end if;
 for o in select value from jsonb_array_elements(d->'objectives') loop
  i:=i+1;t:=coalesce(o->>'type','');
  if jsonb_typeof(o)<>'object' or not(t=any(array['talk','kill','collect','event','xp','have','equip','bank','visit'])) then raise exception 'Objective %: unknown type %',i,t;end if;
  if jsonb_typeof(o->'amount') is distinct from 'number' then raise exception 'Objective %: amount is required',i;end if;
  n:=(o->>'amount')::numeric;
  if n<>trunc(n) or n<1 or n>(case when t='xp' then 13034431 else 100000 end) then raise exception 'Objective %: amount out of range',i;end if;
  if length(coalesce(o->>'label',''))>200 then raise exception 'Objective %: label is limited to 200 characters',i;end if;
  if t in ('collect','have') then
   if not exists(select 1 from eldervale_private.realm_catalog c where c.id='item:'||(o->>'target') and not c.data?'noteOf') then raise exception 'Objective %: choose an original item',i;end if;
  elsif t='bank' then
   if coalesce(o->>'target','')<>'*' and not exists(select 1 from eldervale_private.realm_catalog c where c.id='item:'||(o->>'target')) then raise exception 'Objective %: bank target must be * or an item',i;end if;
  elsif t='talk' then
   if not exists(select 1 from eldervale_private.realm_actors where id=o->>'target' and not deleted and data->>'kind'='npc') then raise exception 'Objective %: choose an NPC to talk to',i;end if;
   perform eldervale_private.fc_check_dialogue(o->'dialogue','Objective '||i);
  elsif t='kill' then
   if jsonb_typeof(o->'targets')='array' then
    if jsonb_array_length(o->'targets') not between 1 and 20 or exists(select 1 from jsonb_array_elements_text(o->'targets') x where not exists(select 1 from eldervale_private.realm_actors a where a.id=x)) then raise exception 'Objective %: every kill target must be an existing actor',i;end if;
   elsif not exists(select 1 from eldervale_private.realm_actors where id=o->>'target' and not deleted and coalesce((data->>'attackable')::boolean,data->>'kind'='monster')) then raise exception 'Objective %: choose an attackable enemy',i;
   end if;
  elsif t='event' then
   if not(coalesce(o->>'event','')=any(events)) then raise exception 'Objective %: event must be one of %',i,array_to_string(events,', ');end if;
   if o?'match' and (jsonb_typeof(o->'match')<>'object' or pg_column_size(o->'match')>1000) then raise exception 'Objective %: match must be a small object',i;end if;
   if o?'targets' and (jsonb_typeof(o->'targets')<>'array' or jsonb_array_length(o->'targets')>20) then raise exception 'Objective %: targets must be a list of up to 20 IDs',i;end if;
  elsif t='xp' then
   if not(coalesce(o->>'skill','')=any(skill_names)) then raise exception 'Objective %: unknown skill',i;end if;
  elsif t='equip' then
   if coalesce(o->>'target','')!~'^[A-Za-z0-9_]{1,40}$' or length(coalesce(o->>'item',''))>60 then raise exception 'Objective %: equip needs a slot and optional item key',i;end if;
  elsif t='visit' then
   if jsonb_typeof(o->'x') is distinct from 'number' or jsonb_typeof(o->'z') is distinct from 'number' or abs((o->>'x')::numeric)>4500 or abs((o->>'z')::numeric)>4500 then raise exception 'Objective %: visit needs x and z',i;end if;
   if o?'radius' and (jsonb_typeof(o->'radius')<>'number' or (o->>'radius')::numeric not between 0.5 and 50) then raise exception 'Objective %: radius must be 0.5–50 m',i;end if;
   if o?'floor' and (jsonb_typeof(o->'floor')<>'number' or (o->>'floor')::numeric not between 0 and 2) then raise exception 'Objective %: floor must be 0–2',i;end if;
  end if;
  if o?'hint' and jsonb_typeof(o->'hint') not in ('string','object','null') then raise exception 'Objective %: hint must be an ID or {x,z}',i;end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(d->'objectives') ob where ob.value->>'type'='collect' group by ob.value->>'target' having count(*)>1) then raise exception 'Combine duplicate item objectives';end if;
 if d?'gold' and (jsonb_typeof(d->'gold')<>'number' or (d->>'gold')::numeric not between 0 and 1000000) then raise exception 'Gold reward must be 0–1,000,000';end if;
 foreach k in array array['items','startItems'] loop
  if d?k and jsonb_typeof(d->k)<>'null' then
   if jsonb_typeof(d->k)<>'object' or (select count(*) from jsonb_object_keys(d->k))>8 then raise exception '% must list up to eight items',k;end if;
   for t,v in select key,value from jsonb_each(d->k) loop
    if t='gold' or not exists(select 1 from eldervale_private.realm_catalog c where c.id='item:'||t and not c.data?'noteOf') or jsonb_typeof(v)<>'number' or (v#>>'{}')::numeric not between 1 and 1000 then raise exception 'Invalid % entry: %',k,t;end if;
   end loop;
  end if;
 end loop;
 if d?'xp' and jsonb_typeof(d->'xp')<>'null' then
  if jsonb_typeof(d->'xp')<>'object' then raise exception 'XP rewards must be an object';end if;
  for t,v in select key,value from jsonb_each(d->'xp') loop
   if not(t=any(skill_names)) or jsonb_typeof(v)<>'number' or (v#>>'{}')::numeric not between 1 and 1000000 then raise exception 'Invalid XP reward: %',t;end if;
  end loop;
 end if;
 if d?'dialogue' and jsonb_typeof(d->'dialogue')<>'null' then
  if jsonb_typeof(d->'dialogue')<>'object' or exists(select 1 from jsonb_object_keys(d->'dialogue') s where s not in ('offer','progress','complete')) then raise exception 'Dialogue has offer, progress and complete';end if;
  perform eldervale_private.fc_check_dialogue(d->'dialogue'->'offer','Offer');
  perform eldervale_private.fc_check_dialogue(d->'dialogue'->'progress','Progress');
  perform eldervale_private.fc_check_dialogue(d->'dialogue'->'complete','Complete');
 end if;
end $fn$;

-- ---------------------------------------------------------------- backup document
create or replace function eldervale_private.fc_backup_document() returns jsonb
language sql stable security definer set search_path='' as $fn$
 select jsonb_build_object(
  'format','eldervale-backup-v1','createdAt',now(),
  'settings',(select to_jsonb(s)-'revision' from eldervale_private.settings s where s.id),
  'gameSettings',(select coalesce(jsonb_object_agg(g.key,g.value),'{}'::jsonb) from eldervale_private.game_settings g),
  'entities',(select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'data',e.data,'deleted',e.deleted) order by e.created_at,e.id),'[]'::jsonb) from eldervale_private.entities e),
  'actors',(select coalesce(jsonb_agg(jsonb_build_object('id',a.id,'data',a.data,'deleted',a.deleted) order by a.id),'[]'::jsonb) from eldervale_private.realm_actors a where not exists(select 1 from eldervale_private.entities e where e.id::text=a.id)),
  'catalog',(select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'data',c.data) order by c.id),'[]'::jsonb) from eldervale_private.realm_catalog c where c.data?'ownerEdited' or c.data->>'custom'='true'),
  'quests',(select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'data',q.data) order by q.updated_at),'[]'::jsonb) from eldervale_private.quest_definitions q),
  'recipes',(select coalesce(jsonb_object_agg(r.id,r.data),'{}'::jsonb) from eldervale_private.skill_recipes r))
$fn$;

-- ---------------------------------------------------------------- dispatcher
create or replace function eldervale_private.admin_full_control(command text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare uid uuid;k text;t text;v jsonb;n numeric;d jsonb;old jsonb;result jsonb;id_text text;cnt integer:=0;cnt2 integer:=0;cnt3 integer:=0;cnt4 integer:=0;
 rev bigint;e jsonb;lim integer;mode text;backup jsonb;ids text[]:='{}';
 xp_keys constant text[]:=array['attackXP','strengthXP','defenceXP','hitpointsXP','rangedXP','magicXP','prayerXP','miningXP','woodXP','firemakingXP','fishingXP','cookingXP','smithingXP','craftingXP','herbloreXP','farmingXP','agilityXP','thievingXP','fletchingXP','runecraftingXP','constructionXP','hunterXP'];
 skill_names constant text[]:=array['attack','strength','defence','hitpoints','ranged','magic','prayer','mining','woodcutting','fishing','cooking','smithing','crafting','firemaking','fletching','herblore','farming','runecrafting','construction','hunter','agility','thieving'];
begin
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid console payload';end if;
 if command<>'fc_backup_restore' and pg_column_size(payload)>65536 then raise exception 'Console payload too large';end if;
 if pg_column_size(payload)>6000000 then raise exception 'Backup too large (6 MB)';end if;
 if payload?'userId' and jsonb_typeof(payload->'userId')<>'null' then
  if coalesce(payload->>'userId','')!~'^[0-9a-fA-F-]{36}$' then raise exception 'Choose a player';end if;
  uid:=(payload->>'userId')::uuid;
 end if;

 -- ------------------------------------------------ settings & multipliers
 if command='fc_settings_get' then
  return jsonb_build_object('multipliers',coalesce((select value from eldervale_private.game_settings where key='multipliers'),'{}'::jsonb),'world',coalesce((select value from eldervale_private.game_settings where key='world'),'{}'::jsonb),'skills',to_jsonb(skill_names),
   'updatedAt',(select max(updated_at) from eldervale_private.game_settings));
 elsif command='fc_settings_save' then
  k:=payload->>'key';v:=payload->'value';
  if k not in ('multipliers','world') or jsonb_typeof(v)<>'object' then raise exception 'Save multipliers or world settings';end if;
  if k='multipliers' then
   for t,d in select key,value from jsonb_each(v) loop
    if t='skills' then
     if jsonb_typeof(d)<>'object' then raise exception 'Per-skill multipliers must be an object';end if;
     for id_text,e in select key,value from jsonb_each(d) loop
      if not(id_text=any(skill_names)) or jsonb_typeof(e)<>'number' or (e#>>'{}')::numeric not between 0 and 100 then raise exception 'Skill multiplier % must be 0–100',id_text;end if;
     end loop;
    elsif t in ('xp','dropRate') then
     if jsonb_typeof(d)<>'number' or (d#>>'{}')::numeric not between 0 and 100 then raise exception '% multiplier must be 0–100',t;end if;
    elsif t in ('respawn','shopPrice') then
     if jsonb_typeof(d)<>'number' or (d#>>'{}')::numeric not between 0.05 and 20 then raise exception '% multiplier must be 0.05–20',t;end if;
    else raise exception 'Unknown multiplier %',t;
    end if;
   end loop;
  else
   for t,d in select key,value from jsonb_each(v) loop
    if t='timeOverride' then
     if jsonb_typeof(d) not in ('null','number') or (jsonb_typeof(d)='number' and (d#>>'{}')::numeric not between 0 and 24) then raise exception 'Time of day override must be empty or an hour 0–24';end if;
    else raise exception 'Unknown world setting %',t;
    end if;
   end loop;
  end if;
  select value into old from eldervale_private.game_settings where key=k;
  insert into eldervale_private.game_settings(key,value,updated_at,updated_by) values(k,v,now(),auth.uid())
   on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,k,old,v);
  return jsonb_build_object('key',k,'value',v);

 -- ------------------------------------------------ catalog
 elsif command='fc_catalog_list' then
  return (select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'data',c.data) order by c.id),'[]'::jsonb) from eldervale_private.realm_catalog c);
 elsif command='fc_catalog_save' then
  id_text:=payload->>'id';d:=payload->'data';
  if coalesce(id_text,'')!~'^[a-z]{2,16}(:[A-Za-z0-9_]{1,60}){1,2}$' then raise exception 'Item ID: prefix:name using letters, digits and _ (for example item:custom_royal_bread)';end if;
  if id_text like 'item:note:%' then raise exception 'Bank notes follow their original item; edit that instead';end if;
  if not exists(select 1 from eldervale_private.realm_catalog c where split_part(c.id,':',1)=split_part(id_text,':',1)) then raise exception 'Unknown catalog prefix %',split_part(id_text,':',1);end if;
  perform eldervale_private.fc_check_catalog(d);
  perform pg_advisory_xact_lock(736211);
  select c.data into old from eldervale_private.realm_catalog c where c.id=id_text for update;
  if coalesce((payload->>'create')::boolean,false) and old is not null then raise exception 'Item ID % already exists',id_text;end if;
  if not coalesce((payload->>'create')::boolean,false) and old is null then raise exception 'Item % not found',id_text;end if;
  if old is null and (select count(*) from eldervale_private.realm_catalog c where c.data?'ownerEdited' and not c.data?'noteOf')>=2000 then raise exception 'Catalog edit limit reached (2000)';end if;
  d:=(d-'ownerEdited')||jsonb_build_object('name',trim(d->>'name'),'ownerEdited',true);
  if id_text ~ '^item:custom_[a-z0-9_]{2,35}$' then d:=d||'{"custom":true}'::jsonb;end if;
  insert into eldervale_private.realm_catalog(id,data) values(id_text,d) on conflict(id) do update set data=excluded.data;
  update eldervale_private.settings set revision=revision+1 where id;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,id_text,old,d);
  return jsonb_build_object('id',id_text,'data',d,'created',old is null);
 elsif command='fc_catalog_disable' then
  id_text:=payload->>'id';
  select c.data into old from eldervale_private.realm_catalog c where c.id=id_text for update;
  if old is null then raise exception 'Item % not found',id_text;end if;
  d:=old||jsonb_build_object('disabled',coalesce((payload->>'disabled')::boolean,true),'ownerEdited',true);
  update eldervale_private.realm_catalog set data=d where id=id_text;
  update eldervale_private.settings set revision=revision+1 where id;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,id_text,old,d);
  return jsonb_build_object('id',id_text,'data',d);

 -- ------------------------------------------------ players
 elsif command='fc_player_get' then
  if uid is null then raise exception 'Choose a player';end if;
  select to_jsonb(s) into result from public.player_saves s where s.user_id=uid;
  if result is null then raise exception 'Player has no character';end if;
  return jsonb_build_object('save',result,
   'position',(select jsonb_build_object('x',round(p.x::numeric,1),'z',round(p.z::numeric,1),'floor',p.floor,'building',p.building,'online',p.last_seen>now()-interval '15 seconds','lastSeen',p.last_seen) from eldervale_private.realm_players p where p.user_id=uid),
   'moderation',(select to_jsonb(m) from eldervale_private.moderation m where m.user_id=uid),
   'role',coalesce((select st.role from eldervale_private.staff st where st.user_id=uid),case when uid='91c5b7f0-7018-4290-a190-c2bba0ca492d'::uuid then 'owner' else 'player' end),
   'username',(select pp.username from public.player_profiles pp where pp.user_id=uid),
   'combatLevel',eldervale_private.combat_level(coalesce(result->'skills','{}'::jsonb)),
   'audit',(select coalesce(jsonb_agg(a order by a.id desc),'[]'::jsonb) from (select au.id,au.action,au.actor,au.created_at,au.before_data,au.after_data from eldervale_private.audit au where au.target=uid::text order by au.id desc limit 50) a));
 elsif command='fc_player_set_xp' then
  k:=payload->>'skill';
  if uid is null or not(k=any(xp_keys)) then raise exception 'Choose a player and skill';end if;
  if jsonb_typeof(payload->'xp') is distinct from 'number' then raise exception 'XP must be a number';end if;
  n:=(payload->>'xp')::numeric;if n<>round(n,2) or n<0 or n>200000000 then raise exception 'XP must be 0–200,000,000 with at most 2 decimals';end if;
  select jsonb_build_object('skills',s.skills,'stats',s.stats,'level',s.level) into old from public.player_saves s where s.user_id=uid for update;
  if old is null then raise exception 'Player has no character';end if;
  if k in ('miningXP','woodXP') then update public.player_saves set stats=coalesce(stats,'{}'::jsonb)||jsonb_build_object(k,n) where user_id=uid;
  else update public.player_saves set skills=coalesce(skills,'{}'::jsonb)||jsonb_build_object(k,n) where user_id=uid;end if;
  update public.player_saves set level=eldervale_private.combat_level(skills) where user_id=uid;
  select jsonb_build_object('skill',k,'xp',n,'level',s.level) into result from public.player_saves s where s.user_id=uid;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,uid::text,old,result);
  return result;
 elsif command='fc_player_item' then
  k:=payload->>'item';
  if uid is null or coalesce(k,'')='' then raise exception 'Choose a player and item';end if;
  if jsonb_typeof(payload->'amount') is distinct from 'number' then raise exception 'Amount must be a number';end if;
  n:=(payload->>'amount')::numeric;if n<>trunc(n) or n=0 or abs(n)>1000000 then raise exception 'Amount must be a whole number from -1,000,000 to 1,000,000 (not 0)';end if;
  select jsonb_build_object('gold',s.gold,'stats',s.stats,'inventory',s.inventory) into old from public.player_saves s where s.user_id=uid for update;
  if old is null then raise exception 'Player has no character';end if;
  perform eldervale_private.item_change(uid,k,n::integer,coalesce((payload->>'bank')::boolean,false));
  select jsonb_build_object('item',k,'amount',n,'bank',coalesce((payload->>'bank')::boolean,false),'gold',s.gold,'stats',s.stats,'inventory',s.inventory) into result from public.player_saves s where s.user_id=uid;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,uid::text,old,result);
  return result;
 elsif command='fc_player_set_gold' then
  if uid is null or jsonb_typeof(payload->'gold') is distinct from 'number' then raise exception 'Choose a player and an amount of gold';end if;
  n:=(payload->>'gold')::numeric;if n<>trunc(n) or n<0 or n>1000000000 then raise exception 'Gold must be 0–1,000,000,000';end if;
  select jsonb_build_object('gold',s.gold) into old from public.player_saves s where s.user_id=uid for update;
  if old is null then raise exception 'Player has no character';end if;
  update public.player_saves set gold=n::bigint where user_id=uid;
  result:=jsonb_build_object('gold',n);
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,uid::text,old,result);
  return result;
 elsif command='fc_player_unequip' then
  k:=payload->>'slot';
  if uid is null or coalesce(k,'')!~'^[A-Za-z0-9_]{1,40}$' then raise exception 'Choose a player and an equipment slot';end if;
  select s.equipment into old from public.player_saves s where s.user_id=uid for update;
  if old is null then raise exception 'Player has no character';end if;
  if not old?k then raise exception 'Nothing is equipped in %',k;end if;
  update public.player_saves set equipment=equipment-k where user_id=uid returning equipment into result;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,uid::text,jsonb_build_object('equipment',old),jsonb_build_object('equipment',result,'slot',k));
  return jsonb_build_object('equipment',result);
 elsif command='fc_moderate' then
  k:=payload->>'op';
  if uid is null or k not in ('ban','mute') then raise exception 'Choose a player and ban or mute';end if;
  if uid=auth.uid() or uid='91c5b7f0-7018-4290-a190-c2bba0ca492d'::uuid then raise exception 'Cannot moderate the owner';end if;
  if length(trim(coalesce(payload->>'reason',''))) not between 3 and 500 then raise exception 'Give a reason (3–500 characters)';end if;
  if coalesce((payload->>'permanent')::boolean,false) then n:=52560000;
  else n:=(payload->>'minutes')::numeric;if n is null or n<>trunc(n) or n<1 or n>5256000 then raise exception 'Duration must be 1 minute to 10 years, or permanent';end if;end if;
  select to_jsonb(m) into old from eldervale_private.moderation m where m.user_id=uid;
  insert into eldervale_private.moderation(user_id,reason) values(uid,trim(payload->>'reason')) on conflict(user_id) do update set reason=excluded.reason;
  update eldervale_private.moderation set
   banned_until=(case when k='ban' then now()+n*interval '1 minute' else banned_until end),
   kicked_at=(case when k='ban' then now() else kicked_at end),
   muted_until=(case when k='mute' then now()+n*interval '1 minute' else muted_until end)
  where user_id=uid returning to_jsonb(moderation) into result;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,uid::text,old,result||jsonb_build_object('op',k,'permanent',coalesce((payload->>'permanent')::boolean,false)));
  return result;
 elsif command='fc_password_reset' then
  if uid is null then raise exception 'Choose a player';end if;
  select u.email into id_text from auth.users u where u.id=uid;
  if id_text is null then raise exception 'This account has no email address';end if;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,uid::text,null,jsonb_build_object('requested',now()));
  return jsonb_build_object('email',id_text);

 -- ------------------------------------------------ audit
 elsif command='fc_audit' then
  lim:=least(200,greatest(1,coalesce((payload->>'limit')::integer,100)));
  return jsonb_build_object(
   'rows',(select coalesce(jsonb_agg(a order by a.id desc),'[]'::jsonb) from (
    select au.* from eldervale_private.audit au
    where (coalesce(payload->>'action','')='' or au.action=payload->>'action')
     and (coalesce(payload->>'target','')='' or au.target=payload->>'target')
     and (coalesce(payload->>'beforeId','')='' or au.id<(payload->>'beforeId')::bigint)
     and (coalesce(payload->>'query','')='' or (au.action||' '||coalesce(au.target,'')||' '||coalesce(au.before_data::text,'')||' '||coalesce(au.after_data::text,'')) ilike '%'||replace(replace(payload->>'query','%','\%'),'_','\_')||'%')
    order by au.id desc limit lim) a),
   'actions',(select coalesce(jsonb_agg(x.action order by x.action),'[]'::jsonb) from (select distinct au.action from eldervale_private.audit au) x));

 -- ------------------------------------------------ world spawns
 elsif command='fc_ground_drop' then
  k:=payload->>'item';
  select c.data into d from eldervale_private.realm_catalog c where c.id='item:'||k;
  if d is null or d?'noteOf' then raise exception 'Choose an original item';end if;
  n:=coalesce((payload->>'amount')::numeric,1);if n<>trunc(n) or n<1 or n>1000000 then raise exception 'Amount must be 1–1,000,000';end if;
  if d?'field' then n:=1;end if;
  if jsonb_typeof(payload->'x') is distinct from 'number' or jsonb_typeof(payload->'z') is distinct from 'number' or abs((payload->>'x')::numeric)>4500 or abs((payload->>'z')::numeric)>4500 then raise exception 'Choose a point in the world';end if;
  if coalesce((payload->>'floor')::integer,0) not between 0 and 2 then raise exception 'Invalid floor';end if;
  lim:=least(240,greatest(1,coalesce((payload->>'minutes')::integer,5)));
  insert into eldervale_private.ground_drops(owner_id,item,amount,x,z,floor,expires_at) values(coalesce(uid,auth.uid()),k,n::integer,(payload->>'x')::float8,(payload->>'z')::float8,coalesce((payload->>'floor')::integer,0),now()+lim*interval '1 minute') returning to_jsonb(ground_drops) into result;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,coalesce(uid,auth.uid())::text,null,result);
  return result;
 elsif command='fc_actor_patch' then
  id_text:=payload->>'id';d:=payload->'patch';
  if jsonb_typeof(d) is distinct from 'object' then raise exception 'Send the fields to change';end if;
  select to_jsonb(a) into old from eldervale_private.realm_actors a where a.id=id_text for update;
  if old is null then raise exception 'Actor not found';end if;
  if exists(select 1 from eldervale_private.entities en where en.id::text=id_text) then return eldervale_private.admin_action('update',d||jsonb_build_object('id',id_text));end if;
  for k in select jsonb_object_keys(d) loop
   if k not in ('name','level','hp','damage','attackSpeed','roam','respawn','hostile','attackable','loot','xpReward','goldReward','attackType','dialogue','scale') then raise exception 'Unsupported actor field: %',k;end if;
  end loop;
  foreach k in array array['level','hp','damage','attackSpeed','roam','respawn','scale'] loop
   if d?k then
    if jsonb_typeof(d->k)<>'number' then raise exception 'Invalid actor %',k;end if;
    n:=(d->>k)::numeric;
    if (k='level' and n not between 1 and 100) or (k='hp' and n not between 1 and 100000) or (k='damage' and n not between 0 and 10000) or (k='attackSpeed' and n not between 1.3 and 30) or (k='roam' and n not between 0 and 50) or (k='respawn' and n not between 0 and 86400) or (k='scale' and n not between 0.25 and 5) then raise exception 'Invalid actor %',k;end if;
   end if;
  end loop;
  if d?'hostile' and jsonb_typeof(d->'hostile')<>'boolean' or d?'attackable' and jsonb_typeof(d->'attackable')<>'boolean' then raise exception 'Hostile and attackable are true or false';end if;
  if d?'attackType' and coalesce(d->>'attackType','') not in ('slash','punch','stab','hammer','arrow','magic','bite','kick','charge','claw','venom','swoop','slam','fire') then raise exception 'Unknown attack';end if;
  if length(coalesce(d->>'name',''))>80 or length(coalesce(d->>'dialogue',''))>2000 then raise exception 'Text too long';end if;
  perform eldervale_private.console_check_entity(d);
  if d?'level' then d:=d||jsonb_build_object('attackLevel',d->'level','strengthLevel',d->'level','defenceLevel',d->'level');end if;
  update eldervale_private.realm_actors set data=data||d,hp=(case when d?'hp' then least(hp,(d->>'hp')::integer) else hp end) where id=id_text returning to_jsonb(realm_actors) into result;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,id_text,old,result);
  return result;

 -- ------------------------------------------------ quests
 elsif command='fc_quest_save' then
  if coalesce(payload->>'id','')<>'' and payload->>'id'!~'^[0-9a-fA-F-]{36}$' then raise exception 'Invalid quest ID';end if;
  rev:=null;id_text:=coalesce(nullif(payload->>'id',''),gen_random_uuid()::text);d:=payload->'data';
  perform eldervale_private.fc_quest_check(d,id_text::uuid);
  d:=d||jsonb_build_object('name',trim(d->>'name'),'description',trim(d->>'description'),'published',coalesce((d->>'published')::boolean,false));
  select to_jsonb(q) into old from eldervale_private.quest_definitions q where q.id=id_text::uuid for update;
  insert into eldervale_private.quest_definitions(id,data) values(id_text::uuid,d)
   on conflict(id) do update set data=excluded.data,version=quest_definitions.version+1,updated_at=now() returning to_jsonb(quest_definitions) into result;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,id_text,old,result);
  return result;

 -- ------------------------------------------------ backups
 elsif command='fc_backup_export' then
  backup:=eldervale_private.fc_backup_document();
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,null,null,jsonb_build_object('entities',jsonb_array_length(backup->'entities'),'actors',jsonb_array_length(backup->'actors')));
  return backup;
 elsif command='fc_backup_save' then
  k:=trim(coalesce(payload->>'name',''));
  if k!~'^[A-Za-z0-9 _.:-]{1,60}$' then raise exception 'Backup name: 1–60 letters, digits, spaces, . _ : -';end if;
  backup:=eldervale_private.fc_backup_document();
  select to_jsonb(w)-'data' into old from eldervale_private.world_archives w where w.name='backup:'||k;
  insert into eldervale_private.world_archives(name,data,created_at) values('backup:'||k,backup,now()) on conflict(name) do update set data=excluded.data,created_at=excluded.created_at;
  result:=jsonb_build_object('name',k,'entities',jsonb_array_length(backup->'entities'),'actors',jsonb_array_length(backup->'actors'),'catalog',jsonb_array_length(backup->'catalog'),'quests',jsonb_array_length(backup->'quests'));
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,'backup:'||k,old,result);
  return result;
 elsif command='fc_backup_list' then
  return (select coalesce(jsonb_agg(jsonb_build_object('name',substring(w.name from 8),'createdAt',w.created_at,'entities',jsonb_array_length(coalesce(w.data->'entities','[]'::jsonb)),'actors',jsonb_array_length(coalesce(w.data->'actors','[]'::jsonb)),'catalog',jsonb_array_length(coalesce(w.data->'catalog','[]'::jsonb)),'quests',jsonb_array_length(coalesce(w.data->'quests','[]'::jsonb))) order by w.created_at desc),'[]'::jsonb) from eldervale_private.world_archives w where w.name like 'backup:%');
 elsif command='fc_backup_restore' then
  mode:=coalesce(payload->>'mode','merge');
  if mode not in ('merge','mirror') then raise exception 'Restore mode is merge or mirror';end if;
  if coalesce(payload->>'name','')<>'' then select w.data into backup from eldervale_private.world_archives w where w.name='backup:'||(payload->>'name');
  else backup:=payload->'backup';end if;
  if backup is null or backup->>'format'<>'eldervale-backup-v1' or jsonb_typeof(backup->'entities')<>'array' then raise exception 'Choose an eldervale-backup-v1 document';end if;
  if jsonb_array_length(backup->'entities')>5000 then raise exception 'Backups restore up to 5000 entities';end if;
  perform pg_advisory_xact_lock(736211);
  -- Safety net: the current world is archived first, so a restore can itself be undone.
  k:='auto-before-restore '||to_char(now(),'YYYY-MM-DD HH24:MI:SS');
  insert into eldervale_private.world_archives(name,data,created_at) values('backup:'||k,eldervale_private.fc_backup_document(),now()) on conflict(name) do update set data=excluded.data,created_at=excluded.created_at;
  update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
  if coalesce(payload->'parts','["entities"]'::jsonb)?'entities' then
   for e in select value from jsonb_array_elements(backup->'entities') loop
    if coalesce(e->>'id','')!~'^[0-9a-fA-F-]{36}$' or jsonb_typeof(e->'data')<>'object' or e->'data'->>'kind' not in ('npc','monster','object','item') or coalesce(e->'data'->>'template','')='' then raise exception 'Invalid entity in backup: %',left(coalesce(e->>'id','?'),40);end if;
    if abs(coalesce((e->'data'->>'x')::numeric,0))>4500 or abs(coalesce((e->'data'->>'z')::numeric,0))>4500 then raise exception 'Entity % lies outside the world',e->>'id';end if;
    perform eldervale_private.console_check_entity(e->'data');
    ids:=ids||(e->>'id');
    insert into eldervale_private.entities(id,revision,data,deleted) values((e->>'id')::uuid,rev,e->'data',coalesce((e->>'deleted')::boolean,false))
     on conflict(id) do update set data=excluded.data,deleted=excluded.deleted,revision=excluded.revision;
    cnt:=cnt+1;
   end loop;
   if mode='mirror' then
    update eldervale_private.entities set deleted=true,revision=rev where not deleted and not(id::text=any(ids));
    get diagnostics cnt2=row_count;
   end if;
  end if;
  if coalesce(payload->'parts','["entities"]'::jsonb)?'actors' and jsonb_typeof(backup->'actors')='array' then
   for e in select value from jsonb_array_elements(backup->'actors') loop
    if jsonb_typeof(e->'data')='object' and not exists(select 1 from eldervale_private.entities en where en.id::text=e->>'id') then
     update eldervale_private.realm_actors set data=e->'data',deleted=coalesce((e->>'deleted')::boolean,false),hp=least(hp,coalesce((e->'data'->>'hp')::integer,hp)) where id=e->>'id';
     if found then cnt3:=cnt3+1;end if;
    end if;
   end loop;
  end if;
  if coalesce(payload->'parts','["entities"]'::jsonb)?'catalog' and jsonb_typeof(backup->'catalog')='array' then
   for e in select value from jsonb_array_elements(backup->'catalog') loop
    if coalesce(e->>'id','')~'^[a-z]{2,16}(:[A-Za-z0-9_]{1,60}){1,2}$' and e->>'id' not like 'item:note:%' then
     perform eldervale_private.fc_check_catalog(e->'data');
     insert into eldervale_private.realm_catalog(id,data) values(e->>'id',e->'data') on conflict(id) do update set data=excluded.data;
     cnt4:=cnt4+1;
    end if;
   end loop;
  end if;
  if coalesce(payload->'parts','["entities"]'::jsonb)?'quests' and jsonb_typeof(backup->'quests')='array' then
   for e in select value from jsonb_array_elements(backup->'quests') loop
    if coalesce(e->>'id','')~'^[0-9a-fA-F-]{36}$' and jsonb_typeof(e->'data')='object' then
     insert into eldervale_private.quest_definitions(id,data) values((e->>'id')::uuid,e->'data') on conflict(id) do update set data=excluded.data,version=quest_definitions.version+1,updated_at=now();
    end if;
   end loop;
  end if;
  result:=jsonb_build_object('mode',mode,'entities',cnt,'markedDeleted',cnt2,'actors',cnt3,'catalog',cnt4,'undo',k);
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,coalesce(payload->>'name','upload'),jsonb_build_object('undo','backup:'||k),result);
  return result;
 end if;
 raise exception 'Unknown console command %',command;
end $fn$;

-- fc_* commands reach the dispatcher before every other admin handler.
select eldervale_private.soft_patch('eldervale_private.admin_action(text,jsonb)','admin_full_control',array[
 'if command in (''tutorial_reset'',''tutorial_skip'',''tutorial_status'') then return eldervale_private.admin_tutorial(command,payload);end if;',
 'if command like ''fc\_%'' then return eldervale_private.admin_full_control(command,payload);end if;
 if command in (''tutorial_reset'',''tutorial_skip'',''tutorial_status'') then return eldervale_private.admin_tutorial(command,payload);end if;']);

revoke all on function
 eldervale_private.game_multiplier(text),eldervale_private.xp_skill_name(text),eldervale_private.xp_multiplier(text),eldervale_private.xp_scaled(text,numeric),eldervale_private.xp_scaled_exact(text,numeric),
 eldervale_private.xp_multipliers_identity(),eldervale_private.public_game_config(),eldervale_private.scale_actor_respawn(),
 eldervale_private.fc_check_catalog(jsonb),eldervale_private.fc_check_dialogue(jsonb,text),eldervale_private.fc_quest_check(jsonb,uuid),
 eldervale_private.fc_backup_document(),eldervale_private.admin_full_control(text,jsonb)
from public,anon,authenticated;
do $do$ begin
 if to_regprocedure('eldervale_private.skill_xp_unscaled(uuid,text,integer)') is not null then execute 'revoke all on function eldervale_private.skill_xp_unscaled(uuid,text,integer) from public,anon,authenticated';end if;
 if to_regprocedure('eldervale_private.skill_xp_unscaled(uuid,text,numeric)') is not null then execute 'revoke all on function eldervale_private.skill_xp_unscaled(uuid,text,numeric) from public,anon,authenticated';end if;
 if to_regprocedure('eldervale_private.combat_xp_unscaled(uuid,integer,text,jsonb)') is not null then execute 'revoke all on function eldervale_private.combat_xp_unscaled(uuid,integer,text,jsonb) from public,anon,authenticated';end if;
end $do$;
