-- OSRS skill parity: experience per action, level requirements and success models that match
-- Old School RuneScape. Idempotent: safe to run more than once. Apply after every earlier db/*.sql.
--
-- * Skill XP keeps OSRS fractions (17.5 copper ore, 6.25 bronze bar, 202.5 yew logs), stored as
--   JSON numbers with up to two decimals. Levels still use the OSRS table (xp_level); the client
--   shows whole XP like the OSRS skill tab.
-- * Combat: XP only for damage you deal. Melee 4/damage in the style's skill (Stab=Attack,
--   Slash=Strength, Lunge=1.33 each to Attack/Strength/Defence), ranged 4/damage, magic
--   2/damage + spell base (Wind Strike 5.5, also on a splash), Hitpoints 1.33/damage.
--   Being hit no longer gives Hitpoints XP.
-- * Gathering rolls a level-scaled success chance each attempt (OSRS low/high out of 256 at
--   levels 1 and 99): woodcutting by tree and axe tier (bronze/iron), fishing per fish tier
--   (best fish first; bait is only used on a catch), mining per ore. Misses give no XP.
-- * Cooking burn chance falls to 0 at the OSRS stop-burn level; burnt food gives no XP.
--   Iron ore smelts 50% of the time, as on an OSRS furnace.
-- * Recipe XP/levels mirror profession-data.js and food.js; the generated block below is
--   rebuilt by scripts/build-osrs-skill-parity.mjs.

-- ---------------------------------------------------------------- helpers
create or replace function eldervale_private.skilling_chance(low numeric, high numeric, level integer) returns float8
 language sql immutable parallel safe set search_path='' as $$
 select least(1.0,(1+floor(coalesce(low,0)*(99-l)/98.0+coalesce(high,0)*(l-1)/98.0+.5))/256.0)::float8
 from (select greatest(1,least(99,coalesce(level,1))) l) v
$$;

create or replace function eldervale_private.skill_level(uid uuid, skill text) returns integer
 language sql stable set search_path='' as $$
 select eldervale_private.xp_level(coalesce(case skill when 'mining' then s.stats->>'miningXP' when 'woodcutting' then coalesce(s.stats->>'woodXP',s.skills->>'woodcuttingXP') else s.skills->>(skill||'XP') end,'0')::numeric)
 from public.player_saves s where s.user_id=uid
$$;

-- Recipe success: chanceLow/chanceHigh scale with the recipe skill's level; otherwise the flat chance.
create or replace function eldervale_private.recipe_success(uid uuid, r jsonb) returns float8
 language sql stable set search_path='' as $$
 select case when r?'chanceLow' then eldervale_private.skilling_chance((r->>'chanceLow')::numeric,coalesce((r->>'chanceHigh')::numeric,(r->>'chanceLow')::numeric),eldervale_private.skill_level(uid,r->>'skill'))
  else greatest(0,least(1,coalesce((r->>'chance')::float8,1))) end
$$;

-- Burn chance: burnChance at the recipe's level, falling linearly to 0 at stopBurn (OSRS stop-burn level).
create or replace function eldervale_private.burn_chance(r jsonb, level integer) returns float8
 language sql immutable set search_path='' as $$
 select case when coalesce((r->>'burnChance')::float8,0)<=0 or coalesce(level,1)>=v.stop then 0::float8
  else greatest(0,least(1,(r->>'burnChance')::float8*(v.stop-coalesce(level,1))/greatest(1,v.stop-v.req)))::float8 end
 from (select coalesce((r->>'level')::integer,1) req,coalesce((r->>'stopBurn')::integer,coalesce((r->>'level')::integer,1)+35) stop) v
$$;

-- OSRS woodcutting XP per log (normal 25, oak 37.5, willow 67.5, maple 100, yew 175).
create or replace function eldervale_private.tree_log_xp_osrs(d jsonb) returns numeric
 language sql immutable set search_path='' as $$
 select case d->>'logItem' when 'oakLogs' then 37.5 when 'willowLogs' then 67.5 when 'mapleLogs' then 100 when 'yewLogs' then 175 else 25 end::numeric
$$;

-- OSRS woodcutting success per chop by tree and axe (iron axe, otherwise bronze), out of 256.
create or replace function eldervale_private.woodcut_chance(uid uuid, d jsonb) returns float8
 language sql stable set search_path='' as $$
 select eldervale_private.skilling_chance(case when v.iron then t.il else t.bl end,case when v.iron then t.ih else t.bh end,eldervale_private.skill_level(uid,'woodcutting'))
 from (select coalesce(s.inventory->'weaponsOwned','[]')?'axe' or s.equipment->>'weapon'='axe' iron from public.player_saves s where s.user_id=uid) v,
  (select case d->>'logItem' when 'oakLogs' then 32 when 'willowLogs' then 16 when 'mapleLogs' then 8 when 'yewLogs' then 4 else 64 end bl,
          case d->>'logItem' when 'oakLogs' then 100 when 'willowLogs' then 50 when 'mapleLogs' then 25 when 'yewLogs' then 12 else 200 end bh,
          case d->>'logItem' when 'oakLogs' then 48 when 'willowLogs' then 24 when 'mapleLogs' then 12 when 'yewLogs' then 6 else 96 end il,
          case d->>'logItem' when 'oakLogs' then 150 when 'willowLogs' then 75 when 'mapleLogs' then 37 when 'yewLogs' then 19 else 300 end ih) t
$$;

revoke all on function eldervale_private.skilling_chance(numeric,numeric,integer) from public,anon,authenticated;
revoke all on function eldervale_private.skill_level(uuid,text) from public,anon,authenticated;
revoke all on function eldervale_private.recipe_success(uuid,jsonb) from public,anon,authenticated;
revoke all on function eldervale_private.burn_chance(jsonb,integer) from public,anon,authenticated;
revoke all on function eldervale_private.tree_log_xp_osrs(jsonb) from public,anon,authenticated;
revoke all on function eldervale_private.woodcut_chance(uuid,jsonb) from public,anon,authenticated;

-- ---------------------------------------------------------------- fractional skill XP
create or replace function eldervale_private.skill_xp(uid uuid, skill text, amount numeric) returns void
 language plpgsql set search_path='' as $$
declare key text;
begin
 if coalesce(amount,0)=0 or uid is null or skill is null then return;end if;
 key:=case skill when 'woodcutting' then 'woodXP' else skill||'XP' end;
 if skill in('mining','woodcutting') then
  update public.player_saves set stats=stats||jsonb_build_object(key,trim_scale(greatest(0,least(200000000,round(coalesce((stats->>key)::numeric,0)+amount,2))))) where user_id=uid;
 else
  update public.player_saves set skills=skills||jsonb_build_object(key,trim_scale(greatest(0,least(200000000,round(coalesce((skills->>key)::numeric,0)+amount,2))))) where user_id=uid;
 end if;
end $$;
-- Integer callers (quest rewards, crop harvests) share the same numeric path.
create or replace function eldervale_private.skill_xp(uid uuid, skill text, amount integer) returns void
 language plpgsql set search_path='' as $$
begin
 perform eldervale_private.skill_xp(uid,skill,amount::numeric);
end $$;
revoke all on function eldervale_private.skill_xp(uuid,text,numeric) from public,anon,authenticated;
revoke all on function eldervale_private.skill_xp(uuid,text,integer) from public,anon,authenticated;

-- ---------------------------------------------------------------- combat XP (damage dealt only)
create or replace function eldervale_private.combat_xp(uid uuid, damage integer, style text, w jsonb) returns void
 language plpgsql set search_path='' as $$
declare d integer:=greatest(0,coalesce(damage,0));magic boolean:=coalesce((w->>'magic')::boolean,false);ranged boolean:=coalesce((w->>'ranged')::boolean,false);share numeric;gains jsonb;
begin
 share:=round(1.33*d,2);
 gains:=(case when magic then jsonb_build_object('magicXP',2*d+coalesce((w->>'spellXp')::numeric,5.5))
  when ranged then jsonb_build_object('rangedXP',4*d)
  when style='stab' then jsonb_build_object('attackXP',4*d)
  when style='lunge' then jsonb_build_object('attackXP',share,'strengthXP',share,'defenceXP',share)
  else jsonb_build_object('strengthXP',4*d) end)||jsonb_build_object('hitpointsXP',share);
 update public.player_saves set skills=skills||coalesce((select jsonb_object_agg(g.key,trim_scale(least(200000000,round(coalesce((skills->>g.key)::numeric,0)+g.value::numeric,2)))) from jsonb_each_text(gains) g where g.value::numeric>0),'{}'::jsonb) where user_id=uid;
end $$;
revoke all on function eldervale_private.combat_xp(uuid,integer,text,jsonb) from public,anon,authenticated;

-- ---------------------------------------------------------------- fishing
-- low/high: OSRS catch chance out of 256 at Fishing 1 and 99 (river fish = sardine, stormfin = shark).
create or replace function eldervale_private.fish_table() returns jsonb
 language sql immutable set search_path='' as $$
 select '[{"item":"rawShrimp","method":"net","level":1,"xp":10,"low":48,"high":256},{"item":"rawFish","method":"rod","level":1,"xp":20,"low":32,"high":192},{"item":"rawTrout","method":"rod","level":20,"xp":50,"low":32,"high":192},{"item":"rawSalmon","method":"rod","level":30,"xp":70,"low":16,"high":96},{"item":"rawLobster","method":"cage","level":40,"xp":90,"low":6,"high":95},{"item":"rawSwordfish","method":"harpoon","level":50,"xp":100,"low":4,"high":48},{"item":"rawStormfin","method":"harpoon","level":76,"xp":110,"low":3,"high":40}]'::jsonb
$$;
-- One fishing roll: best eligible fish first, each with its own chance. null = level too low; {} = nothing bit.
create or replace function eldervale_private.fish_attempt(method text, level integer) returns jsonb
 language plpgsql volatile set search_path='' as $$
declare f jsonb;eligible boolean:=false;
begin
 for f in select value from jsonb_array_elements(eldervale_private.fish_table()) where value->>'method'=method and (value->>'level')::integer<=coalesce(level,1) order by (value->>'level')::integer desc loop
  eligible:=true;
  if random()<eldervale_private.skilling_chance((f->>'low')::numeric,(f->>'high')::numeric,level) then return f;end if;
 end loop;
 return case when eligible then '{}'::jsonb else null end;
end $$;
revoke all on function eldervale_private.fish_attempt(text,integer) from public,anon,authenticated;

-- Level checks read fractional XP.
create or replace function eldervale_private.gathering_error(uid uuid, target_id text, method text) returns text
 language plpgsql set search_path='' as $$
declare problem text;o eldervale_private.realm_objects;xp numeric;required integer;begin
 problem:=eldervale_private.gathering_error_before_professions(uid,target_id,method);if problem is not null then return problem;end if;
 if method='woodcut' then select * into o from eldervale_private.realm_objects where id=target_id;required:=(case o.data->>'logItem' when 'oakLogs' then 15 when 'willowLogs' then 30 when 'mapleLogs' then 45 when 'yewLogs' then 60 else 1 end);
  select coalesce((stats->>'woodXP')::numeric,0) into xp from public.player_saves where user_id=uid;if eldervale_private.xp_level(xp)<required then return 'You need Woodcutting level '||required||' for this tree.';end if;end if;
 if method in('cage','harpoon') then
  select coalesce((skills->>'fishingXP')::numeric,0),coalesce((stats->>(case method when 'cage' then 'lobsterPot' else 'harpoon' end))::integer,0) into xp,required from public.player_saves where user_id=uid;
  if required<1 then return (case method when 'cage' then 'You need a lobster pot in your inventory.' else 'You need a harpoon in your inventory.' end);end if;
  if eldervale_private.xp_level(xp)<(case method when 'cage' then 40 else 50 end) then return 'You need Fishing level '||(case method when 'cage' then '40 to catch lobsters.' else '50 to use a harpoon.' end);end if;
 end if;return null;
end $$;

-- ---------------------------------------------------------------- surgical patches
-- Each block patches only while its first anchor is still present, so re-running is a no-op.
do $patch$
declare def text;
begin
 -- Being hit no longer trains Hitpoints.
 def:=pg_get_functiondef('eldervale_private.world_tick()'::regprocedure);
 if position($o$,skills=skills||jsonb_build_object('hitpointsXP',least(200000000,coalesce((skills->>'hitpointsXP')::numeric,0)+damage))$o$ in def)>0 then
  perform eldervale_private.patch_function('eldervale_private.world_tick()'::regprocedure,array[
   $o$,skills=skills||jsonb_build_object('hitpointsXP',least(200000000,coalesce((skills->>'hitpointsXP')::numeric,0)+damage))$o$,'']);
 end if;

 -- Woodcutting rolls per chop (one log on success, OSRS XP); fishing rolls per cast and uses bait only on a catch.
 def:=pg_get_functiondef('eldervale_private.gathering_tick(timestamp with time zone)'::regprocedure);
 if position($o$n:=least(remaining,capacity,case when random()<.15 then 2 else 1 end);$o$ in def)>0 then
  perform eldervale_private.patch_function('eldervale_private.gathering_tick(timestamp with time zone)'::regprocedure,array[
   $o$n:=least(remaining,capacity,case when random()<.15 then 2 else 1 end);$o$,
   $n$n:=least(remaining,capacity,1);if n>0 and random()>=eldervale_private.woodcut_chance(a.user_id,o.data) then update eldervale_private.gathering_actions set started_at=t,due_at=t+make_interval(secs=>3.0) where user_id=a.user_id;continue;end if;$n$,
   $o$coalesce((stats->>'woodXP')::integer,0)+eldervale_private.tree_log_xp(o.data)*n)$o$,
   $n$trim_scale(least(200000000,coalesce((stats->>'woodXP')::numeric,0)+eldervale_private.tree_log_xp_osrs(o.data)*n)))$n$,
   $o$'amount',n,'depleted',remaining=0$o$,
   $n$'amount',n,'xp',eldervale_private.tree_log_xp_osrs(o.data)*n,'depleted',remaining=0$n$,
   $o$if a.method='rod' then perform eldervale_private.item_change(a.user_id,'bait',-1);end if;$o$,
   '',
   $o$caught:=eldervale_private.fish_catch(a.method,eldervale_private.xp_level((select (skills->>'fishingXP')::numeric from public.player_saves where user_id=a.user_id)),random());$o$,
   $n$caught:=eldervale_private.fish_attempt(a.method,eldervale_private.skill_level(a.user_id,'fishing'));$n$,
   $o$perform eldervale_private.item_change(a.user_id,caught->>'item',1);perform eldervale_private.skill_xp(a.user_id,'fishing',(caught->>'xp')::integer);$o$,
   $n$if caught?'item' then if a.method='rod' then perform eldervale_private.item_change(a.user_id,'bait',-1);end if;perform eldervale_private.item_change(a.user_id,caught->>'item',1);perform eldervale_private.skill_xp(a.user_id,'fishing',(caught->>'xp')::numeric);$n$,
   $o$'xp',(caught->>'xp')::integer));delay:=$o$,
   $n$'xp',(caught->>'xp')::numeric));end if;delay:=$n$]);
 end if;

 -- Bronze axes chop too (iron axes chop faster; see woodcut_chance). Also closes a gap where a
 -- player with no weapon slot set passed the axe check (null comparison).
 def:=pg_get_functiondef('eldervale_private.gathering_error_before_professions(uuid,text,text)'::regprocedure);
 if position($o$not(coalesce(s.inventory->'weaponsOwned','[]')?'axe' or s.equipment->>'weapon'='axe')$o$ in def)>0 then
  perform eldervale_private.patch_function('eldervale_private.gathering_error_before_professions(uuid,text,text)'::regprocedure,array[
   $o$not(coalesce(s.inventory->'weaponsOwned','[]')?'axe' or s.equipment->>'weapon'='axe')$o$,
   $n$not(coalesce(s.inventory->'weaponsOwned','[]') ?| array['axe','bronzeAxe'] or coalesce(s.equipment->>'weapon','') in ('axe','bronzeAxe'))$n$]);
 end if;

 -- Recipe level checks read fractional XP.
 def:=pg_get_functiondef('eldervale_private.skill_error_before_notes(uuid,jsonb,text,uuid)'::regprocedure);
 if position($o$xp integer;level integer;station text;$o$ in def)>0 then
  perform eldervale_private.patch_function('eldervale_private.skill_error_before_notes(uuid,jsonb,text,uuid)'::regprocedure,array[
   $o$xp integer;level integer;station text;$o$,$n$xp numeric;level integer;station text;$n$,
   $o$end)::integer,0);level:=eldervale_private.xp_level(xp);$o$,$n$end)::numeric,0);level:=eldervale_private.xp_level(xp);$n$]);
 end if;

 -- Recipes: fractional XP, level-scaled success (chanceLow/chanceHigh), OSRS stop-burn levels,
 -- custom failure text, no XP line for 0-XP steps, and mining misses keep swinging.
 def:=pg_get_functiondef('eldervale_private.skill_finish(uuid,jsonb,text,uuid,timestamp with time zone)'::regprocedure);
 if position($o$failed:=random()>coalesce((r->>'chance')::float8,1);$o$ in def)>0 then
  perform eldervale_private.patch_function('eldervale_private.skill_finish(uuid,jsonb,text,uuid,timestamp with time zone)'::regprocedure,array[
   $o$kind text;points integer;result text;$o$,$n$kind text;points numeric;result text;$n$,
   $o$failed:=random()>coalesce((r->>'chance')::float8,1);$o$,$n$failed:=random()>=eldervale_private.recipe_success(uid,r);$n$,
   $o$failed:=(r->>'burnChance')::float8>0 and random()<greatest(.01,(r->>'burnChance')::float8*(1-least(1,greatest(0,level-coalesce((r->>'level')::integer,1))/35.0)));$o$,
   $n$failed:=random()<eldervale_private.burn_chance(r,level);$n$,
   $o$points:=(r->>'xp')::integer;perform eldervale_private.skill_xp(uid,r->>'skill',points);result:=(r->>'name')||' complete. +'||points||' '||(r->>'skill')||' XP';$o$,
   $n$points:=coalesce((r->>'xp')::numeric,0);perform eldervale_private.skill_xp(uid,r->>'skill',points);result:=(r->>'name')||' complete.'||(case when points>0 then ' +'||trim_scale(points)||' '||(r->>'skill')||' XP' else '' end);$n$,
   $o$else result:=case when r?'burnChance' then 'The food burns. Higher Cooking reduces the chance.' else 'The attempt failed. Try again.' end;end if;$o$,
   $n$else result:=coalesce(r->>'failText',(case when r?'burnChance' then 'You accidentally burn the food. Burning stops at Cooking '||coalesce(r->>'stopBurn',((coalesce((r->>'level')::integer,1))+35)::text)||'.' else 'The attempt failed. Try again.' end));if kind='mine' then perform set_config('eldervale.skill_retry','1',true);end if;end if;$n$]);
 end if;

 -- A missed mining swing repeats without using up the job; empty messages stay out of the chat.
 def:=pg_get_functiondef('eldervale_private.skill_tick(timestamp with time zone)'::regprocedure);
 if position($o$'text',eldervale_private.skill_finish(j.user_id,r,j.target,j.ground_drop,t)));$o$ in def)>0 then
  perform eldervale_private.patch_function('eldervale_private.skill_tick(timestamp with time zone)'::regprocedure,array[
   $o$declare j eldervale_private.skill_jobs;r jsonb;problem text;$o$,$n$declare j eldervale_private.skill_jobs;r jsonb;problem text;msg text;retry boolean;$n$,
   $o$perform eldervale_private.emit(jsonb_build_object('type','skill_complete','player',j.user_id,'text',eldervale_private.skill_finish(j.user_id,r,j.target,j.ground_drop,t)));$o$,
   $n$perform set_config('eldervale.skill_retry','',true);msg:=eldervale_private.skill_finish(j.user_id,r,j.target,j.ground_drop,t);if coalesce(msg,'')<>'' then perform eldervale_private.emit(jsonb_build_object('type','skill_complete','player',j.user_id,'text',msg));end if;$n$,
   $o$if problem is not null or j.remaining=1 then$o$,
   $n$retry:=problem is null and coalesce(current_setting('eldervale.skill_retry',true),'')='1';perform set_config('eldervale.skill_retry','',true);
  if retry then update eldervale_private.skill_jobs set started_at=t,due_at=t+make_interval(secs=>(r->>'seconds')::float8) where user_id=j.user_id;
  elsif problem is not null or j.remaining=1 then$n$]);
 end if;

 -- Altar prayer and the legacy cook-and-eat hearth read fractional XP (cooking a river fish = 40 XP).
 def:=pg_get_functiondef('eldervale_private.realm_request_services(uuid,text,jsonb,uuid,bigint)'::regprocedure);
 if position($o$to_jsonb(coalesce((skills->>'prayerXP')::integer,0)+5)$o$ in def)>0 then
  perform eldervale_private.patch_function('eldervale_private.realm_request_services(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
   $o$to_jsonb(coalesce((skills->>'prayerXP')::integer,0)+5)$o$,$n$to_jsonb(coalesce((skills->>'prayerXP')::numeric,0)+5)$n$,
   $o$to_jsonb(coalesce((skills->>'cookingXP')::integer,0)+25)$o$,$n$to_jsonb(coalesce((skills->>'cookingXP')::numeric,0)+40)$n$,
   $o$+12 HP, +25 Cooking XP.$o$,$n$+12 HP, +40 Cooking XP.$n$]);
 end if;

 -- Legacy single-cast fishing gives the river fish's 20 XP.
 def:=pg_get_functiondef('eldervale_private.realm_request_before_castle(uuid,text,jsonb,uuid,bigint)'::regprocedure);
 if position($o$jsonb_build_object('fishingXP',coalesce((skills->>'fishingXP')::integer,0)+25)$o$ in def)>0 then
  perform eldervale_private.patch_function('eldervale_private.realm_request_before_castle(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
   $o$jsonb_build_object('fishingXP',coalesce((skills->>'fishingXP')::integer,0)+25)$o$,$n$jsonb_build_object('fishingXP',coalesce((skills->>'fishingXP')::numeric,0)+20)$n$,
   $o$jsonb_build_object('type','fishing','player',auth.uid(),'target',o.id)$o$,$n$jsonb_build_object('type','fishing','player',auth.uid(),'target',o.id,'item','rawFish','xp',20)$n$]);
 end if;

 -- The owner's recipe editor accepts fractional XP (0-10,000, two decimals).
 def:=pg_get_functiondef('eldervale_private.admin_before_bank_notes(text,jsonb)'::regprocedure);
 if position($o$coalesce((r->>'xp')::integer,-1) not between 0 and 10000$o$ in def)>0 then
  perform eldervale_private.patch_function('eldervale_private.admin_before_bank_notes(text,jsonb)'::regprocedure,array[
   $o$coalesce((r->>'xp')::integer,-1) not between 0 and 10000$o$,$n$coalesce((r->>'xp')::numeric,-1) not between 0 and 10000$n$,
   $o$'xp',(r->>'xp')::integer,'seconds'$o$,$n$'xp',trim_scale(round((r->>'xp')::numeric,2)),'seconds'$n$]);
 end if;
end $patch$;

-- ---------------------------------------------------------------- recipe data
-- Generated by scripts/build-osrs-skill-parity.mjs from profession-data.js and food.js.
-- Only level, XP and the success/burn fields listed there change; owner edits to names,
-- timings, stations and ingredients are kept.
-- BEGIN GENERATED RECIPES
update eldervale_private.skill_recipes r set data=r.data||v.patch
 from jsonb_each($j${"mine_copperOre":{"level":1,"xp":17.5,"chanceLow":100,"chanceHigh":350,"failText":""},"mine_tinOre":{"level":1,"xp":17.5,"chanceLow":100,"chanceHigh":350,"failText":""},"mine_ore":{"level":15,"xp":35,"chanceLow":96,"chanceHigh":350,"failText":""},"mine_coal":{"level":30,"xp":50,"chanceLow":16,"chanceHigh":100,"failText":""},"mine_silverOre":{"level":20,"xp":40,"chanceLow":25,"chanceHigh":200,"failText":""},"mine_goldOre":{"level":40,"xp":65,"chanceLow":7,"chanceHigh":75,"failText":""},"mine_mithrilOre":{"level":55,"xp":80,"chanceLow":4,"chanceHigh":50,"failText":""},"mine_adamantOre":{"level":70,"xp":95,"chanceLow":2,"chanceHigh":25,"failText":""},"mine_runiteOre":{"level":85,"xp":125,"chanceLow":1,"chanceHigh":18,"failText":""},"smelt_bronzeBar":{"level":1,"xp":6.25},"smelt_ironBar":{"level":15,"xp":12.5,"chance":0.5,"failText":"The ore is too impure and you fail to refine it."},"smelt_steelBar":{"level":30,"xp":17.5},"smelt_silverBar":{"level":20,"xp":13.7},"smelt_goldBar":{"level":40,"xp":22.5},"smelt_mithrilBar":{"level":50,"xp":30},"smelt_adamantBar":{"level":70,"xp":37.5},"smelt_runiteBar":{"level":85,"xp":50},"forge_armor_helm":{"level":22,"xp":50},"forge_armor_chest":{"level":33,"xp":125},"forge_armor_legs":{"level":31,"xp":75},"forge_armor_boots":{"level":18,"xp":25},"forge_shield_kite":{"level":27,"xp":75},"forge_weapon_dagger":{"level":15,"xp":25},"forge_weapon_shortsword":{"level":19,"xp":25},"forge_weapon_scimitar":{"level":20,"xp":50},"forge_weapon_longsword":{"level":21,"xp":50},"forge_weapon_twohand":{"level":29,"xp":75},"forge_weapon_axe":{"level":16,"xp":25},"forge_weapon_pickaxe":{"level":22,"xp":50},"forge_weapon_battleaxe":{"level":25,"xp":75},"forge_nails":{"level":1,"xp":12.5},"forge_steel_nails":{"level":34,"xp":37.5},"forge_arrowtips":{"level":20,"xp":25},"forge_brace":{"level":35,"xp":37.5},"forge_mithril_fittings":{"level":55,"xp":50},"forge_adamant_fittings":{"level":75,"xp":62.5},"forge_runite_fittings":{"level":90,"xp":75},"burn_wood":{"level":1,"xp":40},"burn_oakLogs":{"level":15,"xp":60},"burn_willowLogs":{"level":30,"xp":90},"burn_mapleLogs":{"level":45,"xp":135},"burn_yewLogs":{"level":60,"xp":202.5},"cook_shrimp":{"level":1,"xp":30,"burnChance":0.15,"stopBurn":34},"cook_trout":{"level":15,"xp":70,"burnChance":0.2,"stopBurn":50},"cook_salmon":{"level":25,"xp":90,"burnChance":0.22,"stopBurn":58},"cook_lobster":{"level":40,"xp":120,"burnChance":0.28,"stopBurn":74},"cook_swordfish":{"level":45,"xp":140,"burnChance":0.3,"stopBurn":86},"cook_stormfin":{"level":80,"xp":210,"burnChance":0.36,"stopBurn":99},"cook_fish":{"level":1,"xp":40,"burnChance":0.15,"stopBurn":38},"cook_meat":{"level":1,"xp":30,"burnChance":0.15,"stopBurn":31},"mill_flour":{"level":1,"xp":0},"mix_dough":{"level":1,"xp":0},"bake_bread":{"level":1,"xp":40,"burnChance":0.1,"stopBurn":38},"tan_hide":{"level":1,"xp":0},"sew_gloves":{"level":1,"xp":13.8},"spin_string":{"level":10,"xp":15},"cut_gem":{"level":20,"xp":50},"silver_ring":{"level":16,"xp":50},"shafts":{"level":1,"xp":5},"feather_arrows":{"level":1,"xp":15},"finish_arrows":{"level":15,"xp":37.5},"carve_bow":{"level":5,"xp":5},"string_bow":{"level":5,"xp":5},"clean_herb":{"level":1,"xp":2.5},"fill_vial":{"level":1,"xp":0},"infuse_herb":{"level":1,"xp":0},"healing_draught":{"level":3,"xp":25},"plant_herbs":{"level":9,"xp":11,"crop":{"item":"grimyHerb","min":2,"max":5,"seconds":180,"xp":13}},"plant_wheat":{"level":1,"xp":8,"crop":{"item":"wheat","min":2,"max":5,"seconds":90,"xp":9}},"air_runes":{"level":1,"xp":5,"outputs":{"airRune":1}},"fire_runes":{"level":14,"xp":7,"outputs":{"fireRune":1}},"saw_plank":{"level":1,"xp":12},"saw_oak":{"level":15,"xp":20},"build_bench":{"level":1,"xp":87},"hunt_game":{"level":1,"xp":34,"chance":0.75},"hunt_fur":{"level":15,"xp":55,"chance":0.7},"balance_log":{"level":1,"xp":7.5},"steal_stall":{"level":1,"xp":16,"chance":1},"pick_training_lock":{"level":13,"xp":7.8,"chance":0.65,"outputs":{"gold":10}},"gather_herb_patch":{"level":1,"xp":0},"gather_flax_patch":{"level":1,"xp":0},"gather_wheat_patch":{"level":1,"xp":0},"gather_berry_bush":{"level":1,"xp":0},"gather_essence_rock":{"level":1,"xp":5}}$j$::jsonb) v(id,patch) where r.id=v.id and r.data||v.patch is distinct from r.data;
-- END GENERATED RECIPES
