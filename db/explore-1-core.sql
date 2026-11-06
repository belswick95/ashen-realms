-- Eldervale exploration (Round 3, R3-K), part 1: engine. Discoverable places, hidden areas and new
-- regions (built on the underground/area engine), lore objects with a Lore journal and milestone XP
-- lamps, and treasure-hunt clue chains (clue loot, server-checked steps, reward caskets).
-- Client twin: explore-data.js / explore.js. Content: db/explore-2-content.sql, db/explore-3-clues.sql.
-- Console: db/explore-4-console.sql.
-- APPLY ORDER: after db/quests-v2.sql, db/underground-1..3 and db/mechanics-ii-*.sql (and after
-- R3-I's db/bosses-*.sql and R3-J's db/quest-arc-*.sql when those ship): explore-1-core, explore-2-content,
-- explore-3-clues, explore-4-console. Idempotent: create-or-replace functions, "if not exists" tables,
-- every patch of a live function is skipped once its marker is present (anchors checked against live,
-- read-only, on 2026-11-06: each matches exactly once).
--
-- Data:
-- * eldervale_private.explore_defs(kind,id,data,enabled,owner_edited): places, lore, crates, steps,
--   rewards, shortcuts, resources. Rows saved from the Game console set owner_edited and are never
--   overwritten by re-running the content files.
-- * eldervale_private.explore_found(user,kind,id): discovered places and read lore.
-- * eldervale_private.explore_clues(user,tier): the active clue chain per tier (steps, position, status).
-- * eldervale_private.explore_stats(user): completed clues per tier, treasure log, milestones, titles.
-- * game_settings 'explore': master switch, clue chances, steps per tier, milestone rewards.
-- Commands (realm_request, before the underground branch): explore_read, explore_visit, explore_clue,
-- explore_dig, explore_emote, explore_talk, explore_search, explore_open. Reads: public.explore_journal().
begin;
set local lock_timeout='5s';

create table if not exists eldervale_private.game_settings(key text primary key, value jsonb, updated_at timestamptz default now(), updated_by uuid);
create table if not exists eldervale_private.explore_defs(
 kind text not null check(kind in ('place','lore','crate','step','reward','shortcut','resource')),
 id text not null check(id ~ '^[a-z][a-z0-9_]{1,40}$'),
 data jsonb not null,
 enabled boolean not null default true,
 owner_edited boolean not null default false,
 updated_at timestamptz not null default now(),
 updated_by uuid,
 primary key(kind,id));
create table if not exists eldervale_private.explore_found(user_id uuid not null, kind text not null, id text not null, at timestamptz not null default now(), primary key(user_id,kind,id));
create table if not exists eldervale_private.explore_clues(user_id uuid not null, tier text not null check(tier in ('easy','medium','hard')), steps text[] not null default '{}', idx integer not null default 0,
 status text not null default 'active' check(status in ('active','done','abandoned')), started_at timestamptz not null default now(), finished_at timestamptz, primary key(user_id,tier));
create table if not exists eldervale_private.explore_stats(user_id uuid primary key, clues jsonb not null default '{}', log jsonb not null default '{}', milestones jsonb not null default '[]', titles jsonb not null default '[]', updated_at timestamptz not null default now());
revoke all on table eldervale_private.explore_defs,eldervale_private.explore_found,eldervale_private.explore_clues,eldervale_private.explore_stats from public,anon,authenticated;

-- ------------------------------------------------------------------------------------- helpers
create or replace function eldervale_private.explore_settings() returns jsonb
language sql stable set search_path to '' as $fn$
 select coalesce((select g.value from eldervale_private.game_settings g where g.key='explore'),'{"enabled":false}'::jsonb)
$fn$;
create or replace function eldervale_private.explore_on() returns boolean
language sql stable set search_path to '' as $fn$ select coalesce((eldervale_private.explore_settings()->>'enabled')::boolean,false) $fn$;
create or replace function eldervale_private.explore_uuid(kind text, id text) returns uuid
language sql immutable set search_path to '' as $fn$ select md5('explore-v1:'||kind||':'||id)::uuid $fn$;
-- "1/128" or a number -> probability.
create or replace function eldervale_private.explore_chance(c jsonb) returns double precision
language sql immutable set search_path to '' as $fn$
 select (case when jsonb_typeof(c)='number' then (c#>>'{}')::float8
  when c#>>'{}' ~ '^\s*[0-9.]+\s*/\s*[0-9.]+\s*$' then split_part(c#>>'{}','/',1)::float8/nullif(split_part(c#>>'{}','/',2)::float8,0)
  else 0 end)
$fn$;
-- World point of a definition: area-local x/z (explore and engine areas) or overworld x/z.
create or replace function eldervale_private.explore_point(d jsonb) returns double precision[]
language sql stable set search_path to '' as $fn$
 select (case when coalesce(d->>'area','')<>'' then
   (select array[(a.data->'origin'->>'x')::float8+(d->>'x')::float8,(a.data->'origin'->>'z')::float8+(d->>'z')::float8] from eldervale_private.underground_areas a where a.id=d->>'area')
  else array[(d->>'x')::float8,(d->>'z')::float8] end)
$fn$;
create or replace function eldervale_private.explore_def(k text, i text) returns jsonb
language sql stable set search_path to '' as $fn$ select d.data from eldervale_private.explore_defs d where d.kind=k and d.id=i and d.enabled $fn$;
create or replace function eldervale_private.explore_holds(uid uuid, item text) returns boolean
language sql stable set search_path to '' as $fn$
 select coalesce((select coalesce((s.stats->>item)::integer,0)>0 or coalesce((s.inventory->'bank'->>item)::integer,0)>0 from public.player_saves s where s.user_id=uid),false)
$fn$;
create or replace function eldervale_private.explore_carries(uid uuid, item text) returns boolean
language sql stable set search_path to '' as $fn$ select coalesce((select coalesce((s.stats->>item)::integer,0)>0 from public.player_saves s where s.user_id=uid),false) $fn$;
create or replace function eldervale_private.explore_clue_item(tier text) returns text
language sql immutable set search_path to '' as $fn$ select (case tier when 'easy' then 'clueEasy' when 'medium' then 'clueMedium' when 'hard' then 'clueHard' end) $fn$;
create or replace function eldervale_private.explore_casket_item(tier text) returns text
language sql immutable set search_path to '' as $fn$ select (case tier when 'easy' then 'casketEasy' when 'medium' then 'casketMedium' when 'hard' then 'casketHard' end) $fn$;

-- ---------------------------------------------------------------------------- materialisation
-- Write every explore object as a world entity (fixed ids; the entity trigger fills realm_objects /
-- realm_actors): lore objects, crates, hidden-place entrances and ways out, resources, shortcuts.
-- Explore areas follow the master switch and their place's enabled flag. A disabled row (or the
-- master switch off) marks its entity deleted. Entities marked ownerEdited are left alone.
create or replace function eldervale_private.explore_put(eid uuid, rev bigint, d jsonb, gone boolean) returns void
language sql set search_path to '' as $fn$
 insert into eldervale_private.entities(id,revision,data,deleted) values(eid,rev,d,gone)
 on conflict(id) do update set revision=rev,data=excluded.data,deleted=excluded.deleted
 where not coalesce((eldervale_private.entities.data->>'ownerEdited')::boolean,false)
  and (eldervale_private.entities.data is distinct from excluded.data or eldervale_private.entities.deleted is distinct from excluded.deleted)
$fn$;
create or replace function eldervale_private.explore_sync() returns jsonb
language plpgsql security definer set search_path to '' as $fn$
declare master boolean:=eldervale_private.explore_on();rev bigint;r record;pt float8[];base jsonb;a jsonb;ix float8;iz float8;fx float8;fz float8;yaw float8;ids uuid[]:='{}';eid uuid;n integer:=0;areas integer:=0;
begin
 update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
 base:=jsonb_build_object('kind','object','scale',1,'level',1,'hp',1,'damage',0,'attackSpeed',2.4,'roam',0,'respawn',0,'attackable',false,'hostile',false,'blueprint','explore-v1');
 -- Areas of hidden places and regions: open only while the place and the master switch are on.
 for r in select d.id,d.data,d.enabled from eldervale_private.explore_defs d where d.kind='place' and d.data->>'type' in ('hidden','region') loop
  if exists(select 1 from eldervale_private.underground_areas u where u.id=r.data->>'area' and u.data ? 'explore') then
   update eldervale_private.underground_areas set enabled=(master and r.enabled) where id=r.data->>'area' and enabled is distinct from (master and r.enabled);
   if found then perform eldervale_private.underground_sync(r.data->>'area');areas:=areas+1;end if;
  end if;
  select data into a from eldervale_private.underground_areas where id=r.data->>'area';
  if a is null or r.data->'entrance' is null then continue;end if;
  yaw:=coalesce((r.data->'entrance'->>'yaw')::float8,0)*pi()/180;
  fx:=round(((r.data->'entrance'->>'x')::float8+sin(yaw)*3.2)::numeric,1);fz:=round(((r.data->'entrance'->>'z')::float8+cos(yaw)*3.2)::numeric,1);
  ix:=(a->'origin'->>'x')::float8+coalesce((r.data->'inside'->>'x')::float8,2);iz:=(a->'origin'->>'z')::float8+coalesce((r.data->'inside'->>'z')::float8,0);
  eid:=eldervale_private.explore_uuid('entrance',r.id);ids:=ids||eid;
  perform eldervale_private.explore_put(eid,rev,base||jsonb_build_object('template',r.data->'entrance'->>'model','name',r.data->'entrance'->>'name',
   'x',(r.data->'entrance'->>'x')::float8,'z',(r.data->'entrance'->>'z')::float8,'yaw',coalesce((r.data->'entrance'->>'yaw')::float8,0),
   'passage',jsonb_build_object('area',r.data->>'area','dest',jsonb_build_array(ix,iz),'requires',coalesce(r.data->'entrance'->'requires','{}'::jsonb),'depth',0,'place',r.id),
   'explore','entrance','place',r.id,'blueprintKey','entrance:'||r.id),not(master and r.enabled));
  eid:=eldervale_private.explore_uuid('exit',r.id);ids:=ids||eid;
  perform eldervale_private.explore_put(eid,rev,base||jsonb_build_object('template',coalesce(r.data->>'exitModel','cave_exit'),'name',coalesce(r.data->>'exitName','Way out to '||(r.data->'entrance'->>'name')),
   'x',ix-3.5,'z',iz,'yaw',90,'passage',jsonb_build_object('area',r.data->>'area','dest',jsonb_build_array(fx,fz),'depth',-1,'place',r.id),
   'explore','exit','place',r.id,'underground',r.data->>'area','blueprintKey','exit:'||r.id),not(master and r.enabled));
  n:=n+2;
 end loop;
 for r in select d.kind,d.id,d.data,d.enabled from eldervale_private.explore_defs d where d.kind in ('lore','crate','resource','shortcut') loop
  pt:=eldervale_private.explore_point(r.data);if pt is null or pt[1] is null then continue;end if;
  eid:=eldervale_private.explore_uuid(r.kind,r.id);ids:=ids||eid;n:=n+1;
  if r.kind='lore' then
   perform eldervale_private.explore_put(eid,rev,base||jsonb_build_object('template',r.data->>'model','name',r.data->>'name','x',pt[1],'z',pt[2],'yaw',coalesce((r.data->>'yaw')::float8,0),
    'lore',r.id,'explore','lore','blueprintKey','lore:'||r.id)||(case when r.data ? 'area' then jsonb_build_object('underground',r.data->>'area') else '{}'::jsonb end),not(master and r.enabled));
  elsif r.kind='crate' then
   perform eldervale_private.explore_put(eid,rev,base||jsonb_build_object('template','explore_crate','name',r.data->>'name','x',pt[1],'z',pt[2],'yaw',coalesce((r.data->>'yaw')::float8,0),
    'crate',r.id,'explore','crate','blueprintKey','crate:'||r.id)||(case when r.data ? 'area' then jsonb_build_object('underground',r.data->>'area') else '{}'::jsonb end),not(master and r.enabled));
  elsif r.kind='resource' then
   perform eldervale_private.explore_put(eid,rev,base||(r.data-'area'-'x'-'z'-'id')||jsonb_build_object('x',pt[1],'z',pt[2],'yaw',coalesce((r.data->>'yaw')::float8,0),
    'explore','resource','underground',r.data->>'area','blueprintKey','resource:'||r.id),not(master and r.enabled));
  else
   perform eldervale_private.explore_put(eid,rev,base||jsonb_build_object('template',r.data->>'template','name',r.data->>'name',
    'x',round((((r.data->'ends'->0->>0)::float8+(r.data->'ends'->1->>0)::float8)/2+pt[1]-(r.data->>'x')::float8)::numeric,1),
    'z',round((((r.data->'ends'->0->>1)::float8+(r.data->'ends'->1->>1)::float8)/2+pt[2]-(r.data->>'z')::float8)::numeric,1),
    'yaw',round(degrees(atan2((r.data->'ends'->1->>0)::float8-(r.data->'ends'->0->>0)::float8,(r.data->'ends'->1->>1)::float8-(r.data->'ends'->0->>1)::float8))::numeric),
    'length',round(sqrt(power((r.data->'ends'->1->>0)::float8-(r.data->'ends'->0->>0)::float8,2)+power((r.data->'ends'->1->>1)::float8-(r.data->'ends'->0->>1)::float8,2))::numeric,1),
    'agility',jsonb_build_object('id',r.id,'level',(r.data->>'level')::integer,'xp',(r.data->>'xp')::numeric,'fail',coalesce((r.data->>'fail')::numeric,0),'failDamage',coalesce((r.data->>'failDamage')::integer,0),
     'ticks',coalesce((r.data->>'ticks')::integer,4),'margin',20,'ends',jsonb_build_array(
      jsonb_build_array((r.data->'ends'->0->>0)::float8+pt[1]-(r.data->>'x')::float8,(r.data->'ends'->0->>1)::float8+pt[2]-(r.data->>'z')::float8),
      jsonb_build_array((r.data->'ends'->1->>0)::float8+pt[1]-(r.data->>'x')::float8,(r.data->'ends'->1->>1)::float8+pt[2]-(r.data->>'z')::float8))),
    'underground',r.data->>'area','blueprintKey','explore:'||r.id),not(master and r.enabled));
  end if;
 end loop;
 -- Anything this system wrote before that no longer has a definition.
 update eldervale_private.entities set deleted=true,revision=rev where data->>'blueprint'='explore-v1' and not deleted and not(id=any(ids)) and not coalesce((data->>'ownerEdited')::boolean,false);
 return jsonb_build_object('enabled',master,'objects',n,'areasResynced',areas);
end $fn$;

-- ---------------------------------------------------------------------------------- milestones
-- Count found lore/places and completed clues; each milestone reached once gives an XP lamp (claimed
-- from the Quests tab like quest lamps: game_flags.questLamps) and maybe a title.
create or replace function eldervale_private.explore_milestones(uid uuid) returns jsonb
language plpgsql set search_path to '' as $fn$
declare st eldervale_private.explore_stats;m jsonb;k text;cnt integer;key text;got jsonb:='[]'::jsonb;lamps jsonb;
begin
 insert into eldervale_private.explore_stats(user_id) values(uid) on conflict(user_id) do nothing;
 select * into st from eldervale_private.explore_stats where user_id=uid for update;
 for k in select unnest(array['lore','place','clue']) loop
  cnt:=(case when k='clue' then (select coalesce(sum(v::integer),0) from jsonb_each_text(st.clues) e(t,v))::integer
   else (select count(*)::integer from eldervale_private.explore_found f where f.user_id=uid and f.kind=k) end);
  for m in select value from jsonb_array_elements(coalesce(eldervale_private.explore_settings()->'milestones'->k,'[]'::jsonb)) loop
   key:='explore:'||k||':'||(m->>'at');
   if cnt>=(m->>'at')::integer and not st.milestones ? key then
    st.milestones:=st.milestones||to_jsonb(key);
    if coalesce((m->>'amount')::integer,0)>0 then
     lamps:=jsonb_build_array(jsonb_build_object('key',key,'amount',least(200000,(m->>'amount')::integer),'label',(case k when 'lore' then 'Lore' when 'place' then 'Wayfinding' else 'Treasure' end)||' lamp ('||(m->>'at')||')','questName','Exploration','explore',true));
     update public.player_saves set game_flags=coalesce(game_flags,'{}'::jsonb)||jsonb_build_object('questLamps',coalesce(game_flags->'questLamps','[]'::jsonb)||lamps) where user_id=uid;
    end if;
    if coalesce(m->>'title','')<>'' and not st.titles ? (m->>'title') then st.titles:=st.titles||to_jsonb(m->>'title');end if;
    got:=got||jsonb_build_array(jsonb_build_object('kind',k,'at',(m->>'at')::integer,'amount',coalesce((m->>'amount')::integer,0),'title',m->>'title'));
   end if;
  end loop;
 end loop;
 update eldervale_private.explore_stats set milestones=st.milestones,titles=st.titles,updated_at=now() where user_id=uid;
 return got;
end $fn$;
-- Record a discovery; returns true the first time.
create or replace function eldervale_private.explore_found_add(uid uuid, k text, i text) returns boolean
language plpgsql set search_path to '' as $fn$
begin
 insert into eldervale_private.explore_found(user_id,kind,id) values(uid,k,i) on conflict do nothing;
 return found;
end $fn$;

-- ------------------------------------------------------------------------------------- clues
-- Public view of a step (riddles never send their dig spot; map steps send the centre to draw).
create or replace function eldervale_private.explore_public_step(sid text) returns jsonb
language plpgsql stable set search_path to '' as $fn$
declare s jsonb:=(select d.data from eldervale_private.explore_defs d where d.kind='step' and d.id=sid);pt float8[];
begin
 if s is null then return null;end if;
 pt:=eldervale_private.explore_point(s);
 return jsonb_strip_nulls(jsonb_build_object('id',sid,'tier',s->>'tier','type',s->>'type','text',s->>'text','emote',(case when s->>'type'='emote' then s->>'emote' end),
  'npcName',(case when s->>'type'='talk' then s->>'npcName' end),
  'map',(case when s->>'type'='map' and pt is not null then jsonb_build_object('x',round(pt[1]::numeric),'z',round(pt[2]::numeric),'area',s->>'area') end)));
end $fn$;
-- Start (or continue) the chain of a clue scroll the player carries.
create or replace function eldervale_private.explore_clue_start(uid uuid, t text) returns eldervale_private.explore_clues
language plpgsql set search_path to '' as $fn$
declare c eldervale_private.explore_clues;rng jsonb:=eldervale_private.explore_settings()->'steps'->t;n integer;picked text[];
begin
 select * into c from eldervale_private.explore_clues where user_id=uid and tier=t for update;
 if c.user_id is not null and c.status='active' and c.idx<cardinality(c.steps) then return c;end if;
 n:=greatest(1,coalesce((rng->>0)::integer,2)+floor(random()*(greatest(coalesce((rng->>1)::integer,3),coalesce((rng->>0)::integer,2))-coalesce((rng->>0)::integer,2)+1))::integer);
 select array_agg(x.id) into picked from (select d.id from eldervale_private.explore_defs d where d.kind='step' and d.enabled and d.data->>'tier'=t order by random() limit n) x;
 if picked is null then raise exception 'The ink has faded. Nothing can be read today.';end if;
 insert into eldervale_private.explore_clues(user_id,tier,steps,idx,status,started_at,finished_at) values(uid,t,picked,0,'active',now(),null)
  on conflict(user_id,tier) do update set steps=excluded.steps,idx=0,status='active',started_at=now(),finished_at=null returning * into c;
 return c;
end $fn$;
-- A step was solved: next step, or the casket when the chain is finished.
create or replace function eldervale_private.explore_clue_advance(uid uuid, t text) returns jsonb
language plpgsql set search_path to '' as $fn$
declare c eldervale_private.explore_clues;out jsonb;
begin
 update eldervale_private.explore_clues set idx=idx+1 where user_id=uid and tier=t and status='active' returning * into c;
 if c.idx<cardinality(c.steps) then
  return jsonb_build_object('tier',t,'done',false,'idx',c.idx,'total',cardinality(c.steps),'step',eldervale_private.explore_public_step(c.steps[c.idx+1]));
 end if;
 update eldervale_private.explore_clues set status='done',finished_at=now() where user_id=uid and tier=t;
 if eldervale_private.explore_carries(uid,eldervale_private.explore_clue_item(t)) then perform eldervale_private.item_change(uid,eldervale_private.explore_clue_item(t),-1);end if;
 perform eldervale_private.item_change(uid,eldervale_private.explore_casket_item(t),1);
 insert into eldervale_private.explore_stats(user_id) values(uid) on conflict(user_id) do nothing;
 update eldervale_private.explore_stats set clues=clues||jsonb_build_object(t,coalesce((clues->>t)::integer,0)+1),updated_at=now() where user_id=uid;
 out:=jsonb_build_object('tier',t,'done',true,'total',cardinality(c.steps),'casket',eldervale_private.explore_casket_item(t),'milestones',eldervale_private.explore_milestones(uid));
 return out;
end $fn$;
-- The first active chain whose current step matches (type list, point within r, extra test).
create or replace function eldervale_private.explore_match(uid uuid, types text[], x double precision, z double precision, r double precision, field text default null, val text default null) returns text
language plpgsql stable set search_path to '' as $fn$
declare c record;s jsonb;pt float8[];
begin
 for c in select * from eldervale_private.explore_clues where user_id=uid and status='active' and idx<cardinality(steps) order by (case tier when 'hard' then 0 when 'medium' then 1 else 2 end) loop
  if not eldervale_private.explore_carries(uid,eldervale_private.explore_clue_item(c.tier)) then continue;end if;
  s:=(select d.data from eldervale_private.explore_defs d where d.kind='step' and d.id=c.steps[c.idx+1]);
  if s is null or not (s->>'type'=any(types)) then continue;end if;
  if field is not null and s->>field is distinct from val then continue;end if;
  if r is not null then pt:=eldervale_private.explore_point(s);if pt is null or sqrt(power(pt[1]-x,2)+power(pt[2]-z,2))>r then continue;end if;end if;
  return c.tier;
 end loop;
 return null;
end $fn$;
-- Monster kill: a tertiary clue scroll by monster level (none while one of that tier is held or open).
create or replace function eldervale_private.explore_clue_loot(d jsonb, killer uuid) returns jsonb
language plpgsql set search_path to '' as $fn$
declare cfg jsonb;t text;lvl integer:=coalesce((d->>'level')::integer,(d->>'combatLevel')::integer,1);pick text;
begin
 if killer is null or not eldervale_private.explore_on() then return '[]'::jsonb;end if;
 cfg:=eldervale_private.explore_settings()->'clueDrops';
 foreach t in array array['easy','medium','hard'] loop
  if lvl between coalesce((cfg->t->>'minLevel')::integer,999999) and coalesce((cfg->t->>'maxLevel')::integer,-1) then pick:=t;end if;
 end loop;
 if pick is null or random()>=eldervale_private.explore_chance(cfg->pick->'chance') then return '[]'::jsonb;end if;
 if eldervale_private.explore_holds(killer,eldervale_private.explore_clue_item(pick)) or eldervale_private.explore_holds(killer,eldervale_private.explore_casket_item(pick)) then return '[]'::jsonb;end if;
 return jsonb_build_array(jsonb_build_object('item',eldervale_private.explore_clue_item(pick),'n',1));
end $fn$;
-- Roll a casket's rewards (also used by the console preview).
create or replace function eldervale_private.explore_roll(t text) returns jsonb
language plpgsql set search_path to '' as $fn$
declare tab jsonb:=eldervale_private.explore_def('reward',t);rare jsonb:=eldervale_private.explore_def('reward','rare');rolls integer;k integer;total float8;x float8;rw jsonb;got jsonb:='[]'::jsonb;
begin
 if tab is null then return got;end if;
 rolls:=(tab->'rolls'->>0)::integer+floor(random()*((tab->'rolls'->>1)::integer-(tab->'rolls'->>0)::integer+1))::integer;
 select sum((v->>'weight')::float8) into total from jsonb_array_elements(tab->'rows') v;
 for k in 1..greatest(0,rolls) loop
  x:=random()*coalesce(total,0);
  for rw in select value from jsonb_array_elements(tab->'rows') loop
   x:=x-(rw->>'weight')::float8;
   if x<0 then got:=got||jsonb_build_array(jsonb_build_object('item',rw->>'item','n',(rw->>'min')::integer+floor(random()*((rw->>'max')::integer-(rw->>'min')::integer+1))::integer));exit;end if;
  end loop;
 end loop;
 if rare is not null and random()<eldervale_private.explore_chance(tab->'rare') then
  select sum((v->>'weight')::float8) into total from jsonb_array_elements(rare->'rows') v;x:=random()*coalesce(total,0);
  for rw in select value from jsonb_array_elements(rare->'rows') loop
   x:=x-(rw->>'weight')::float8;if x<0 then got:=got||jsonb_build_array(jsonb_build_object('item',rw->>'item','n',1,'rare',true));exit;end if;
  end loop;
 end if;
 return got;
end $fn$;

-- ------------------------------------------------------------------------------------ commands
create or replace function eldervale_private.explore_command(session_id uuid, command text, payload jsonb, request_id uuid, event_cursor bigint) returns jsonb
language plpgsql security definer set search_path to '' as $fn$
declare uid uuid:=auth.uid();p eldervale_private.realm_players;s public.player_saves;o eldervale_private.realm_objects;d jsonb;t text;r jsonb;ev jsonb;pt float8[];n integer;rw jsonb;bank boolean;newly boolean;c eldervale_private.explore_clues;txt text;
begin
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>1000 or request_id is null then raise exception 'Invalid request';end if;
 perform eldervale_private.realm_request($1,'sync','{}'::jsonb,null,$5);
 perform pg_advisory_xact_lock(736211);
 select * into p from eldervale_private.realm_players where user_id=uid and realm_players.session_id=$1 for update;
 if not found then raise exception 'Session expired';end if;
 if not exists(select 1 from eldervale_private.realm_requests x where x.user_id=uid and x.request_id=$4) then
  if not eldervale_private.explore_on() then raise exception 'Exploration is closed for now.';end if;
  if clock_timestamp()-p.last_command<interval '.06 seconds' then raise exception 'Please wait before another action';end if;
  select * into s from public.player_saves where user_id=uid for update;
  if s.health<=0 then raise exception 'You cannot do that right now';end if;
  ev:=jsonb_build_object('type','explore','player',uid,'what',replace(command,'explore_',''));
  if command in ('explore_read','explore_search') then
   select * into o from eldervale_private.realm_objects where id=payload->>'target';
   if o.id is null or p.floor<>0 then raise exception 'That is not here any more';end if;
   if command='explore_read' then
    d:=eldervale_private.explore_def('lore',o.data->>'lore');if d is null then raise exception 'There is nothing to read';end if;
    if sqrt(power(o.x-p.x,2)+power(o.z-p.z,2))>4.5 then raise exception 'Move closer';end if;
    newly:=eldervale_private.explore_found_add(uid,'lore',o.data->>'lore');
    ev:=ev||jsonb_build_object('id',o.data->>'lore','name',d->>'name','text',d->>'text','new',newly,'count',(select count(*) from eldervale_private.explore_found f where f.user_id=uid and f.kind='lore'),
     'milestones',(case when newly then eldervale_private.explore_milestones(uid) else '[]'::jsonb end));
   else
    if eldervale_private.explore_def('crate',o.data->>'crate') is null then raise exception 'There is nothing to search';end if;
    if sqrt(power(o.x-p.x,2)+power(o.z-p.z,2))>3.5 then raise exception 'Move closer';end if;
    t:=eldervale_private.explore_match(uid,array['crate'],p.x,p.z,null,'crate',o.data->>'crate');
    ev:=ev||jsonb_build_object('crate',o.data->>'crate','clue',(case when t is null then null else eldervale_private.explore_clue_advance(uid,t) end));
   end if;
  elsif command='explore_visit' then
   d:=eldervale_private.explore_def('place',coalesce(payload->>'id',''));if d is null then raise exception 'Unknown place';end if;
   if d->>'type' in ('town','landmark') then
    if p.floor<>0 or p.x>1000 or p.z>1000 or sqrt(power((d->>'x')::float8-p.x,2)+power((d->>'z')::float8-p.z,2))>coalesce((d->>'radius')::float8,20)+2 then raise exception 'You are not there yet';end if;
   elsif coalesce(eldervale_private.underground_at(p.x,p.z)->>'area','')<>d->>'area' then raise exception 'You are not there yet';end if;
   newly:=eldervale_private.explore_found_add(uid,'place',payload->>'id');
   ev:=ev||jsonb_build_object('id',payload->>'id','name',d->>'name','new',newly,'count',(select count(*) from eldervale_private.explore_found f where f.user_id=uid and f.kind='place'),
    'milestones',(case when newly then eldervale_private.explore_milestones(uid) else '[]'::jsonb end));
  elsif command='explore_clue' then
   t:=payload->>'tier';if t is null or t not in ('easy','medium','hard') then raise exception 'Unknown clue';end if;
   if not eldervale_private.explore_carries(uid,eldervale_private.explore_clue_item(t)) then raise exception 'You need to carry that clue scroll.';end if;
   c:=eldervale_private.explore_clue_start(uid,t);
   ev:=ev||jsonb_build_object('clue',jsonb_build_object('tier',t,'done',false,'idx',c.idx,'total',cardinality(c.steps),'step',eldervale_private.explore_public_step(c.steps[c.idx+1])));
  elsif command='explore_dig' then
   if not eldervale_private.explore_carries(uid,'spade') then raise exception 'You need a spade to dig.';end if;
   if p.floor<>0 then raise exception 'You cannot dig here';end if;
   t:=eldervale_private.explore_match(uid,array['dig','map','bearing'],p.x,p.z,3);
   ev:=ev||jsonb_build_object('x',p.x,'z',p.z,'clue',(case when t is null then null else eldervale_private.explore_clue_advance(uid,t) end));
  elsif command='explore_emote' then
   t:=coalesce(payload->>'emote','');if t not in ('wave','bow','cheer','think','dance','clap','kneel','shrug') then raise exception 'Unknown emote';end if;
   ev:=ev||jsonb_build_object('emote',t);
   t:=eldervale_private.explore_match(uid,array['emote'],p.x,p.z,6,'emote',t);
   ev:=ev||jsonb_build_object('clue',(case when t is null then null else eldervale_private.explore_clue_advance(uid,t) end));
  elsif command='explore_talk' then
   if not exists(select 1 from eldervale_private.realm_actors a where a.id=payload->>'target' and not a.deleted and a.hp>0 and sqrt(power(a.x-p.x,2)+power(a.z-p.z,2))<6) then raise exception 'Speak to them in person';end if;
   t:=eldervale_private.explore_match(uid,array['talk'],p.x,p.z,null,'npc',payload->>'target');
   if t is not null then
    select x.data->>'reply' into txt from eldervale_private.explore_defs x join eldervale_private.explore_clues c2 on c2.user_id=uid and c2.tier=t and x.kind='step' and x.id=c2.steps[c2.idx+1];
    ev:=ev||jsonb_build_object('reply',txt,'npc',payload->>'target');
   end if;
   ev:=ev||jsonb_build_object('clue',(case when t is null then null else eldervale_private.explore_clue_advance(uid,t) end));
  elsif command='explore_open' then
   t:=payload->>'tier';if t is null or t not in ('easy','medium','hard') then raise exception 'Unknown casket';end if;
   if not eldervale_private.explore_carries(uid,eldervale_private.explore_casket_item(t)) then raise exception 'You need to carry that casket.';end if;
   perform eldervale_private.item_change(uid,eldervale_private.explore_casket_item(t),-1);
   r:=eldervale_private.explore_roll(t);bank:=false;
   insert into eldervale_private.explore_stats(user_id) values(uid) on conflict(user_id) do nothing;
   for rw in select value from jsonb_array_elements(r) loop
    n:=(rw->>'n')::integer;
    if rw->>'item'='gold' then perform eldervale_private.item_change(uid,'gold',n);continue;end if;
    perform eldervale_private.item_change(uid,rw->>'item',n);
    if eldervale_private.inventory_used(uid)>eldervale_private.inventory_capacity() then perform eldervale_private.item_change(uid,rw->>'item',-n);perform eldervale_private.item_change(uid,rw->>'item',n,true);bank:=true;end if;
    if (select c3.data->>'kind' from eldervale_private.realm_catalog c3 where c3.id='item:'||(rw->>'item'))='keepsake' then
     update eldervale_private.explore_stats set log=log||jsonb_build_object(rw->>'item',coalesce((log->>(rw->>'item'))::integer,0)+n) where user_id=uid;
    end if;
   end loop;
   ev:=ev||jsonb_build_object('tier',t,'items',r,'bank',bank);
  else raise exception 'Unknown exploration command';
  end if;
  perform eldervale_private.emit(ev);
  update eldervale_private.realm_players set last_command=clock_timestamp() where user_id=uid;
  insert into eldervale_private.realm_requests(user_id,request_id,result) values(uid,$4,'{}'::jsonb);
 end if;
 return eldervale_private.realm_request($1,'sync','{}'::jsonb,null,$5);
end $fn$;

-- --------------------------------------------------------------------------------- journal (read)
create or replace function public.explore_journal() returns jsonb
language sql stable security definer set search_path to '' as $fn$
 with me as (select auth.uid() uid),
 f as (select x.kind,x.id,x.at from eldervale_private.explore_found x,me where x.user_id=me.uid),
 st as (select s.* from eldervale_private.explore_stats s,me where s.user_id=me.uid)
 select jsonb_build_object('on',eldervale_private.explore_on(),
  'lore',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.data->>'name','region',d.data->>'region','found',f.id is not null,'text',(case when f.id is not null then d.data->>'text' end)) order by d.data->>'region',d.id)
    from eldervale_private.explore_defs d left join f on f.kind='lore' and f.id=d.id where d.kind='lore' and (d.enabled or f.id is not null)),'[]'::jsonb),
  'places',coalesce((select jsonb_agg(jsonb_build_object('id',d.id,'name',d.data->>'name','type',d.data->>'type','found',f.id is not null,'blurb',d.data->>'blurb',
     'hint',(case when f.id is null then d.data->>'hint' end),'x',coalesce((d.data->>'x')::float8,(d.data->'entrance'->>'x')::float8),'z',coalesce((d.data->>'z')::float8,(d.data->'entrance'->>'z')::float8),'area',d.data->>'area') order by d.id)
    from eldervale_private.explore_defs d left join f on f.kind='place' and f.id=d.id where d.kind='place' and (d.enabled or f.id is not null)),'[]'::jsonb),
  'clues',coalesce((select jsonb_agg(jsonb_build_object('tier',c.tier,'idx',c.idx,'total',cardinality(c.steps),'step',eldervale_private.explore_public_step(c.steps[c.idx+1])))
    from eldervale_private.explore_clues c,me where c.user_id=me.uid and c.status='active' and c.idx<cardinality(c.steps)),'[]'::jsonb),
  'stats',coalesce((select jsonb_build_object('clues',st.clues,'log',st.log,'milestones',st.milestones,'titles',st.titles) from st),'{"clues":{},"log":{},"milestones":[],"titles":[]}'::jsonb),
  'milestones',coalesce(eldervale_private.explore_settings()->'milestones','{}'::jsonb))
$fn$;
revoke all on function public.explore_journal() from public,anon;
grant execute on function public.explore_journal() to authenticated;
revoke all on function eldervale_private.explore_settings(),eldervale_private.explore_on(),eldervale_private.explore_uuid(text,text),eldervale_private.explore_chance(jsonb),
 eldervale_private.explore_point(jsonb),eldervale_private.explore_def(text,text),eldervale_private.explore_holds(uuid,text),eldervale_private.explore_carries(uuid,text),
 eldervale_private.explore_put(uuid,bigint,jsonb,boolean),eldervale_private.explore_sync(),eldervale_private.explore_milestones(uuid),eldervale_private.explore_found_add(uuid,text,text),
 eldervale_private.explore_public_step(text),eldervale_private.explore_clue_start(uuid,text),eldervale_private.explore_clue_advance(uuid,text),
 eldervale_private.explore_match(uuid,text[],double precision,double precision,double precision,text,text),eldervale_private.explore_clue_loot(jsonb,uuid),eldervale_private.explore_roll(text),
 eldervale_private.explore_command(uuid,text,jsonb,uuid,bigint) from public,anon,authenticated;

-- ------------------------------------------------------------------------------ hooks into live
do $hooks$
declare fn regprocedure;def text;
begin
 -- Commands: ahead of the underground branch of the outermost realm_request.
 fn:=to_regprocedure('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)');def:=pg_get_functiondef(fn);
 if position('explore_command' in def)=0 then
  perform eldervale_private.patch_function(fn,array[
$a$ if command in ('travel','agility') then return eldervale_private.underground_command($1,$2,$3,$4,$5);end if;$a$,
$b$ if command like 'explore\_%' then return eldervale_private.explore_command($1,$2,$3,$4,$5);end if;
 if command in ('travel','agility') then return eldervale_private.underground_command($1,$2,$3,$4,$5);end if;$b$]);
 end if;
 -- Hidden entrances: a passage may need a lore object read first (requires.lore).
 fn:=to_regprocedure('eldervale_private.underground_command(uuid,text,jsonb,uuid,bigint)');def:=pg_get_functiondef(fn);
 if position('explore-gate' in def)=0 then
  perform eldervale_private.patch_function(fn,array[
$a$   need:=coalesce((d->'requires'->>'combat')::integer,0);$a$,
$b$   /*explore-gate*/ if coalesce(d->'requires'->>'lore','')<>'' and not exists(select 1 from eldervale_private.explore_found f where f.user_id=auth.uid() and f.kind='lore' and f.id=d->'requires'->>'lore') then raise exception '%',coalesce(d->'requires'->>'lockedText','Something bars the way.');end if;
   need:=coalesce((d->'requires'->>'combat')::integer,0);$b$]);
 end if;
 -- Clue scrolls as tertiary loot on every monster kill (ahead of the ground loot).
 fn:=to_regprocedure('eldervale_private.mech_drop(text,uuid)');
 if fn is null then raise notice 'Exploration: mech_drop missing, clue loot skipped (apply db/mechanics-ii-*.sql first)';
 elsif position('explore_clue_loot' in pg_get_functiondef(fn))=0 then
  perform eldervale_private.patch_function(fn,array[
$a$ for rw in select value from jsonb_array_elements(got) loop$a$,
$b$ got:=got||eldervale_private.explore_clue_loot(a.data,killer);
 for rw in select value from jsonb_array_elements(got) loop$b$]);
 end if;
 -- Explore areas live at z 4250 and have no overworld "entrances" of their own (their entrance and
 -- way out are explore objects): let the Underground console save them.
 fn:=to_regprocedure('eldervale_private.underground_check(jsonb)');def:=pg_get_functiondef(fn);
 if position('explore-areas' in def)=0 then
  perform eldervale_private.patch_function(fn,array[
$a$(d->'origin'->>'z')::float8 not between 1100 and 3200 then raise exception 'Underground: origin x 1100–4200, z 1100–3200';$a$,
$b$(d->'origin'->>'z')::float8 not between 1100 and 4300 then raise exception 'Underground: origin x 1100–4200, z 1100–4300';$b$,
$a$ if jsonb_array_length(coalesce(d->'entrances','[]'::jsonb))<1 then$a$,
$b$ if jsonb_array_length(coalesce(d->'entrances','[]'::jsonb))<1 and not d ? 'explore' /*explore-areas*/ then$b$]);
 end if;
end $hooks$;
commit;
