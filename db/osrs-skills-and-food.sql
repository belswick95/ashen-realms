-- RuneScape (Old School) skills, Hitpoints and food. Apply with the client release that
-- ships combat-level.js / food.js (same branch), in ONE transaction. The XP migration is guarded
-- per player by game_flags.xpCurve='osrs'; the function patches are exact-once, so running the
-- whole file a second time fails at the first patch and rolls back without changing anything.
--
--  1. XP curve: OSRS table, level 99 = 13,034,431 XP, every skill capped at 99.
--  2. Combat level: the plain OSRS formula over Attack, Strength, Defence, Hitpoints, Prayer,
--     Ranged and Magic, 3–126 (replaces the old 99 cap / "100 when five skills are 99" rule).
--  3. Hitpoints: starts at 10; max HP = 10 × Hitpoints level (kept by a trigger).
--  4. Migration: each stored XP value keeps its level (old curve 1+⌊√(xp/50)⌋ → same OSRS level
--     plus the same fraction of the way to the next one); Hitpoints raised to at least level 10.
--  5. Combat XP: 4/damage to the trained style (Stab→Attack, Slash→Strength, Lunge→⅓ each of
--     Attack/Strength/Defence), ranged 4/damage, magic 2/damage + base spell XP; Hitpoints 1⅓ per
--     damage dealt and 1 per damage taken. Eating delays your next attack (1.8 s).
--  6. Food ladder (heals a % of max HP), fishing tiers (net, bait, cage, harpoon), cooking recipes.

-- ---------------------------------------------------------------- 1. XP curve
create or replace function eldervale_private.xp_table()
returns integer[] language sql immutable parallel safe set search_path='' as $fn$
 select array[0,83,174,276,388,512,650,801,969,1154,1358,1584,1833,2107,2411,2746,3115,3523,3973,4470,5018,5624,6291,7028,7842,8740,9730,10824,12031,13363,14833,16456,18247,20224,22406,24815,27473,30408,33648,37224,41171,45529,50339,55649,61512,67983,75127,83014,91721,101333,111945,123660,136594,150872,166636,184040,203254,224466,247886,273742,302288,333804,368599,407015,449428,496254,547953,605032,668051,737627,814445,899257,992895,1096278,1210421,1336443,1475581,1629200,1798808,1986068,2192818,2421087,2673114,2951373,3258594,3597792,3972294,4385776,4842295,5346332,5902831,6517253,7195629,7944614,8771558,9684577,10692629,11805606,13034431]
$fn$;
-- XP needed for a level (1..99).
create or replace function eldervale_private.level_xp(level integer)
returns integer language sql immutable parallel safe set search_path='' as $fn$
 select (eldervale_private.xp_table())[greatest(1,least(99,coalesce(level,1)))]
$fn$;
-- Level for an XP amount (1..99).
create or replace function eldervale_private.xp_level(xp numeric)
returns integer language sql immutable parallel safe set search_path='' as $fn$
 select greatest(1,(select count(*)::integer from unnest(eldervale_private.xp_table()) v where v<=greatest(0,coalesce(xp,0))))
$fn$;
create or replace function eldervale_private.hitpoints_level(skills jsonb)
returns integer language sql immutable parallel safe set search_path='' as $fn$
 select greatest(10,eldervale_private.xp_level(case when jsonb_typeof(skills->'hitpointsXP')='number' then (skills->>'hitpointsXP')::numeric else 0 end))
$fn$;

-- ---------------------------------------------------------------- 2. Combat level
-- floor(¼(Defence + Hitpoints + ⌊Prayer/2⌋) + max(0.325(Attack+Strength), 0.325⌊1.5·Ranged⌋, 0.325⌊1.5·Magic⌋)):
-- 3 for a new character, 126 with every combat skill at 99. Mirrors combat-level.js combatLevel.
create or replace function eldervale_private.combat_level(skills jsonb)
returns integer language sql immutable set search_path='' as $fn$
 with l as (select k,eldervale_private.xp_level(case when jsonb_typeof(skills->k)='number' then (skills->>k)::numeric else 0 end) v
  from unnest(array['attackXP','strengthXP','defenceXP','prayerXP','rangedXP','magicXP']) k),
 lv as (select max(v) filter (where k='attackXP') att,max(v) filter (where k='strengthXP') str,max(v) filter (where k='defenceXP') def,
  max(v) filter (where k='prayerXP') pray,max(v) filter (where k='rangedXP') rng,max(v) filter (where k='magicXP') mag from l)
 select floor(.25*(def+eldervale_private.hitpoints_level(skills)+floor(pray/2))+greatest(.325*(att+str),.325*floor(rng*3/2),.325*floor(mag*3/2)))::integer
 from lv
$fn$;

-- ---------------------------------------------------------------- 4. Migration helper
-- Old curve level L = min(99, 1+⌊√(xp/50)⌋); keep L and the fraction of the way to L+1.
create or replace function eldervale_private.osrs_xp_from_legacy(xp numeric,hitpoints boolean default false)
returns integer language sql immutable set search_path='' as $fn$
 with v as (select greatest(0,floor(coalesce(xp,0)))::bigint x),
 o as (select x,least(99,1+floor(sqrt(x/50.0))::integer) l from v),
 n as (select case when l>=99 then eldervale_private.level_xp(99)+greatest(0,x-480200)
   else eldervale_private.level_xp(l)+((x-50*(l-1)*(l-1))*(eldervale_private.level_xp(l+1)-eldervale_private.level_xp(l)))/(50*l*l-50*(l-1)*(l-1)) end y from o)
 select least(200000000,case when hitpoints then greatest(eldervale_private.level_xp(10),y) else y end)::integer from n
$fn$;

-- ---------------------------------------------------------------- 3. Hitpoints / max HP trigger
-- New characters are created on the OSRS curve (flag set on insert) with Hitpoints 10.
-- For every flagged character: Hitpoints XP ≥ level 10, max_health = 10 × Hitpoints level,
-- a Hitpoints level-up adds the new HP to current health, health ≤ max, level = combat level.
create or replace function eldervale_private.player_vitals()
returns trigger language plpgsql security definer set search_path='' as $fn$
declare hp integer;
begin
 if tg_op='INSERT' then new.game_flags:=coalesce(new.game_flags,'{}'::jsonb)||'{"xpCurve":"osrs"}'::jsonb;end if;
 if coalesce(new.game_flags->>'xpCurve','')<>'osrs' then return new;end if;
 new.skills:=coalesce(new.skills,'{}'::jsonb);
 if jsonb_typeof(new.skills->'hitpointsXP') is distinct from 'number' or (new.skills->>'hitpointsXP')::numeric<1154 then new.skills:=new.skills||'{"hitpointsXP":1154}'::jsonb;end if;
 hp:=10*eldervale_private.hitpoints_level(new.skills);
 if tg_op='UPDATE' and old.max_health is not null and hp>old.max_health and new.health>0 then new.health:=new.health+(hp-old.max_health);end if;
 new.max_health:=hp;new.health:=greatest(0,least(coalesce(new.health,hp),hp));
 new.level:=eldervale_private.combat_level(new.skills);
 return new;
end $fn$;
drop trigger if exists player_saves_vitals on public.player_saves;
create trigger player_saves_vitals before insert or update on public.player_saves for each row execute function eldervale_private.player_vitals();

-- ---------------------------------------------------------------- 4. Migration (once per player)
update public.player_saves s set
 skills=(select coalesce(jsonb_object_agg(e.key,case when e.key like '%XP' and jsonb_typeof(e.value)='number' then to_jsonb(eldervale_private.osrs_xp_from_legacy((e.value#>>'{}')::numeric,e.key='hitpointsXP')) else e.value end),'{}'::jsonb) from jsonb_each(coalesce(s.skills,'{}'::jsonb)) e)
  ||jsonb_build_object('hitpointsXP',eldervale_private.osrs_xp_from_legacy(case when jsonb_typeof(s.skills->'hitpointsXP')='number' then (s.skills->>'hitpointsXP')::numeric else 0 end,true)),
 stats=coalesce(s.stats,'{}'::jsonb)||(select coalesce(jsonb_object_agg(k,eldervale_private.osrs_xp_from_legacy((s.stats->>k)::numeric)),'{}'::jsonb) from unnest(array['miningXP','woodXP']) k where jsonb_typeof(s.stats->k)='number'),
 game_flags=coalesce(s.game_flags,'{}'::jsonb)||'{"xpCurve":"osrs"}'::jsonb
where coalesce(s.game_flags->>'xpCurve','')<>'osrs';

-- ---------------------------------------------------------------- 5. Combat XP
-- One hit by the player: OSRS rates (see combat-level.js combatXp). XP capped at 200M.
create or replace function eldervale_private.combat_xp(uid uuid,damage integer,style text,w jsonb)
returns void language plpgsql set search_path='' as $fn$
declare d integer:=greatest(0,coalesce(damage,0));magic boolean:=coalesce((w->>'magic')::boolean,false);ranged boolean:=coalesce((w->>'ranged')::boolean,false);gains jsonb;third integer;
begin
 third:=round(4*d/3.0)::integer;
 gains:=case when magic then jsonb_build_object('magicXP',2*d+coalesce((w->>'spellXp')::integer,6))
  when ranged then jsonb_build_object('rangedXP',4*d)
  when style='stab' then jsonb_build_object('attackXP',4*d)
  when style='lunge' then jsonb_build_object('attackXP',third,'strengthXP',third,'defenceXP',third)
  else jsonb_build_object('strengthXP',4*d) end||jsonb_build_object('hitpointsXP',third);
 update public.player_saves set skills=skills||coalesce((select jsonb_object_agg(g.key,least(200000000,coalesce((skills->>g.key)::numeric,0)+g.value::numeric)) from jsonb_each_text(gains) g where g.value::numeric>0),'{}'::jsonb) where user_id=uid;
end $fn$;

-- Monsters above level 20 hit harder so 10×Hitpoints max HP does not trivialise them:
-- ×1 up to level 20, ×1.375 at 50, ×1.69 at 75, ×2 at 100.
create or replace function eldervale_private.monster_damage_scale(level integer)
returns float8 language sql immutable set search_path='' as $fn$ select greatest(1.0,1+(coalesce(level,1)-20)/80.0)::float8 $fn$;

-- ---------------------------------------------------------------- 6. Fishing tiers
create or replace function eldervale_private.fish_table()
returns jsonb language sql immutable set search_path='' as $fn$
 select '[{"item":"rawShrimp","method":"net","level":1,"xp":10},{"item":"rawFish","method":"rod","level":1,"xp":25},{"item":"rawTrout","method":"rod","level":20,"xp":50},{"item":"rawSalmon","method":"rod","level":30,"xp":70},{"item":"rawLobster","method":"cage","level":40,"xp":90},{"item":"rawSwordfish","method":"harpoon","level":50,"xp":100},{"item":"rawStormfin","method":"harpoon","level":76,"xp":110}]'::jsonb
$fn$;
-- Best eligible fish 55% of the time, otherwise fall through to the next tier down (food.js fishCatch).
create or replace function eldervale_private.fish_catch(method text,level integer,roll float8)
returns jsonb language plpgsql immutable set search_path='' as $fn$
declare t jsonb;r float8:=greatest(0,least(.999999,coalesce(roll,0)));n integer;
begin
 select coalesce(jsonb_agg(f order by (f->>'level')::integer desc),'[]'::jsonb) into t from jsonb_array_elements(eldervale_private.fish_table()) f where f->>'method'=method and (f->>'level')::integer<=level;
 n:=jsonb_array_length(t);if n=0 then return null;end if;
 for i in 0..n-1 loop if i=n-1 or r<.55 then return t->i;end if;r:=(r-.55)/.45;end loop;
 return null;
end $fn$;

revoke all on function eldervale_private.xp_table(),eldervale_private.level_xp(integer),eldervale_private.xp_level(numeric),eldervale_private.hitpoints_level(jsonb),
 eldervale_private.osrs_xp_from_legacy(numeric,boolean),eldervale_private.player_vitals(),eldervale_private.combat_xp(uuid,integer,text,jsonb),
 eldervale_private.monster_damage_scale(integer),eldervale_private.fish_table(),eldervale_private.fish_catch(text,integer,float8) from public,anon,authenticated;

-- Food, raw fish and fishing tools (generated by scripts/build-food-seed.mjs from food.js / fishing.js).
insert into eldervale_private.realm_catalog(id,data) values
 ('item:sundae','{"name":"Sundae","model":"sundae","buy":12,"sell":3,"stackable":false,"unique":false,"category":"Food","icon":"supply","description":"Heals 25% of your maximum HP.","color":15849412,"heal":25,"healPct":25}'::jsonb),
 ('item:shrimp','{"name":"Cooked shrimp","model":"shrimp","buy":14,"sell":4,"stackable":false,"unique":false,"category":"Food","icon":"supply","description":"Heals 30% of your maximum HP. Cooking 1.","heal":30,"healPct":30}'::jsonb),
 ('item:rawShrimp','{"name":"Raw shrimp","model":"shrimp","buy":8,"sell":3,"stackable":false,"unique":false,"category":"Ingredients","icon":"supply","description":"Fishing 1 (net). Cook it (Cooking 1) before eating.","color":10133141}'::jsonb),
 ('item:trout','{"name":"Cooked trout","model":"fish","buy":24,"sell":7,"stackable":false,"unique":false,"category":"Food","icon":"supply","description":"Heals 40% of your maximum HP. Cooking 15.","color":12159588,"heal":40,"healPct":40}'::jsonb),
 ('item:rawTrout','{"name":"Raw trout","model":"fish","buy":14,"sell":6,"stackable":false,"unique":false,"category":"Ingredients","icon":"supply","description":"Fishing 20 (bait). Cook it (Cooking 15) before eating.","color":9413259}'::jsonb),
 ('item:salmon','{"name":"Cooked salmon","model":"salmon","buy":36,"sell":10,"stackable":false,"unique":false,"category":"Food","icon":"supply","description":"Heals 50% of your maximum HP. Cooking 25.","color":12027531,"heal":50,"healPct":50}'::jsonb),
 ('item:rawSalmon','{"name":"Raw salmon","model":"fish","buy":21,"sell":9,"stackable":false,"unique":false,"category":"Ingredients","icon":"supply","description":"Fishing 30 (bait). Cook it (Cooking 25) before eating.","color":10990776}'::jsonb),
 ('item:lobster','{"name":"Cooked lobster","model":"lobster","buy":60,"sell":18,"stackable":false,"unique":false,"category":"Food","icon":"supply","description":"Heals 60% of your maximum HP. Cooking 40.","color":12081219,"heal":60,"healPct":60}'::jsonb),
 ('item:rawLobster','{"name":"Raw lobster","model":"lobster","buy":36,"sell":15,"stackable":false,"unique":false,"category":"Ingredients","icon":"supply","description":"Fishing 40 (cage). Cook it (Cooking 40) before eating.","color":4151907}'::jsonb),
 ('item:swordfish','{"name":"Cooked swordfish","model":"swordfish","buy":95,"sell":28,"stackable":false,"unique":false,"category":"Food","icon":"supply","description":"Heals 68% of your maximum HP. Cooking 45.","color":10787470,"heal":68,"healPct":68}'::jsonb),
 ('item:rawSwordfish','{"name":"Raw swordfish","model":"swordfish","buy":57,"sell":23,"stackable":false,"unique":false,"category":"Ingredients","icon":"supply","description":"Fishing 50 (harpoon). Cook it (Cooking 45) before eating.","color":7311014}'::jsonb),
 ('item:stormfin','{"name":"Cooked stormfin","model":"stormfin","buy":160,"sell":48,"stackable":false,"unique":false,"category":"Food","icon":"supply","description":"Heals 78% of your maximum HP. Cooking 80.","color":9274486,"heal":78,"healPct":78}'::jsonb),
 ('item:rawStormfin','{"name":"Raw stormfin","model":"stormfin","buy":96,"sell":40,"stackable":false,"unique":false,"category":"Ingredients","icon":"supply","description":"Fishing 76 (harpoon). Cook it (Cooking 80) before eating.","color":5661551}'::jsonb),
 ('item:lobsterPot','{"name":"Lobster pot","model":"pot","buy":40,"sell":12,"unique":true,"stackable":false,"category":"Tools","description":"Cage fishing for lobsters at Fishing 40. Carry it to a fishing spot."}'::jsonb),
 ('item:harpoon','{"name":"Harpoon","model":"harpoon","buy":45,"sell":14,"unique":true,"stackable":false,"category":"Tools","description":"Harpoon swordfish (Fishing 50) and stormfin (Fishing 76)."}'::jsonb)

-- Cooking recipes for the ladder (Cooking level, XP and burn chance close to OSRS).
on conflict(id) do update set data=eldervale_private.realm_catalog.data||excluded.data;
insert into eldervale_private.skill_recipes(id,data) values
 ('cook_shrimp','{"name":"Cook shrimp","skill":"cooking","level":1,"xp":30,"inputs":{"rawShrimp":1},"outputs":{"shrimp":1},"tools":[],"station":"cooking","seconds":3,"enabled":true,"kind":"process","burnChance":0.15}'::jsonb),
 ('cook_trout','{"name":"Cook trout","skill":"cooking","level":15,"xp":70,"inputs":{"rawTrout":1},"outputs":{"trout":1},"tools":[],"station":"cooking","seconds":3,"enabled":true,"kind":"process","burnChance":0.2}'::jsonb),
 ('cook_salmon','{"name":"Cook salmon","skill":"cooking","level":25,"xp":90,"inputs":{"rawSalmon":1},"outputs":{"salmon":1},"tools":[],"station":"cooking","seconds":3,"enabled":true,"kind":"process","burnChance":0.22}'::jsonb),
 ('cook_lobster','{"name":"Cook lobster","skill":"cooking","level":40,"xp":120,"inputs":{"rawLobster":1},"outputs":{"lobster":1},"tools":[],"station":"cooking","seconds":3,"enabled":true,"kind":"process","burnChance":0.28}'::jsonb),
 ('cook_swordfish','{"name":"Cook swordfish","skill":"cooking","level":45,"xp":140,"inputs":{"rawSwordfish":1},"outputs":{"swordfish":1},"tools":[],"station":"cooking","seconds":3,"enabled":true,"kind":"process","burnChance":0.3}'::jsonb),
 ('cook_stormfin','{"name":"Cook stormfin","skill":"cooking","level":80,"xp":210,"inputs":{"rawStormfin":1},"outputs":{"stormfin":1},"tools":[],"station":"cooking","seconds":3,"enabled":true,"kind":"process","burnChance":0.36}'::jsonb)
on conflict(id) do update set data=excluded.data;

-- ---------------------------------------------------------------- Patches: XP curve everywhere
-- Woodcutting tree levels, plus the new cage/harpoon fishing checks (tool and Fishing level).
select eldervale_private.patch_function('eldervale_private.gathering_error(uuid,text,text)'::regprocedure,array[
$o$if 1+floor(sqrt(xp/50.0))<required then$o$,$n$if eldervale_private.xp_level(xp)<required then$n$,
$o$end if;end if;return null;$o$,
$n$end if;end if;
 if method in('cage','harpoon') then
  select coalesce((skills->>'fishingXP')::numeric,0)::integer,coalesce((stats->>(case method when 'cage' then 'lobsterPot' else 'harpoon' end))::integer,0) into xp,required from public.player_saves where user_id=uid;
  if required<1 then return case method when 'cage' then 'You need a lobster pot in your inventory.' else 'You need a harpoon in your inventory.' end;end if;
  if eldervale_private.xp_level(xp)<(case method when 'cage' then 40 else 50 end) then return 'You need Fishing level '||(case method when 'cage' then '40 to catch lobsters.' else '50 to use a harpoon.' end);end if;
 end if;return null;$n$]);

select eldervale_private.patch_function('eldervale_private.realm_request_before_professions(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
$o$if method not in('woodcut','rod','net') or$o$,$n$if method not in('woodcut','rod','net','cage','harpoon') or$n$,
$o$delay:=case when method='woodcut' then 3 when method='net' then 4.5 else 4 end;$o$,
$n$delay:=case when method='woodcut' then 3 when method='net' then 4.5 when method='cage' then 5 when method='harpoon' then 5.4 else 4 end;$n$]);

-- Each fishing cycle catches from the tier table for the method and Fishing level.
select eldervale_private.patch_function('eldervale_private.gathering_tick(timestamp with time zone)'::regprocedure,array[
$o$min_logs integer;max_logs integer;$o$,$n$min_logs integer;max_logs integer;caught jsonb;$n$,
$o$perform eldervale_private.item_change(a.user_id,'rawFish',1);update public.player_saves set skills=skills||jsonb_build_object('fishingXP',coalesce((skills->>'fishingXP')::integer,0)+25) where user_id=a.user_id;
   perform eldervale_private.emit(jsonb_build_object('type','fishing','player',a.user_id,'target',o.id,'method',a.method,'amount',1));delay:=case when a.method='net' then 4.5 else 4 end;$o$,
$n$caught:=eldervale_private.fish_catch(a.method,eldervale_private.xp_level((select (skills->>'fishingXP')::numeric from public.player_saves where user_id=a.user_id)),random());
   if caught is null then delete from eldervale_private.gathering_actions where user_id=a.user_id;perform eldervale_private.emit(jsonb_build_object('type','gather_end','player',a.user_id,'text','Your Fishing level is too low for this method.'));continue;end if;
   perform eldervale_private.item_change(a.user_id,caught->>'item',1);perform eldervale_private.skill_xp(a.user_id,'fishing',(caught->>'xp')::integer);
   perform eldervale_private.emit(jsonb_build_object('type','fishing','player',a.user_id,'target',o.id,'method',a.method,'amount',1,'item',caught->>'item','xp',(caught->>'xp')::integer));delay:=case when a.method='net' then 4.5 when a.method='cage' then 5 when a.method='harpoon' then 5.4 else 4 end;$n$]);

select eldervale_private.patch_function('eldervale_private.skill_error_before_notes(uuid,jsonb,text,uuid)'::regprocedure,array[
$o$level:=least(100,1+floor(sqrt(xp/50.0))::integer);$o$,$n$level:=eldervale_private.xp_level(xp);$n$]);

-- Cooking level from the OSRS curve; burn chance falls to 1% about 35 levels above the recipe.
select eldervale_private.patch_function('eldervale_private.skill_finish(uuid,jsonb,text,uuid,timestamp with time zone)'::regprocedure,array[
$o$select least(100,1+floor(sqrt(coalesce((skills->>'cookingXP')::integer,0)/50.0))::integer) into level$o$,
$n$select eldervale_private.xp_level((skills->>'cookingXP')::numeric) into level$n$,
$o$random()<greatest(.01,(r->>'burnChance')::float8-level*.0015)$o$,
$n$random()<greatest(.01,(r->>'burnChance')::float8*(1-least(1,greatest(0,level-coalesce((r->>'level')::integer,1))/35.0)))$n$]);

select eldervale_private.patch_function('eldervale_private.realm_request_services(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
$o$least(100,1+floor(sqrt(coalesce((skills->>'prayerXP')::numeric,0)/50)))$o$,$n$eldervale_private.xp_level((skills->>'prayerXP')::numeric)$n$]);

-- Staff tools: "set level" writes the OSRS XP for that level; max player = level 99 XP; XP cap 200M.
select eldervale_private.patch_function('eldervale_private.admin_before_bank_notes(text,jsonb)'::regprocedure,array[
$o$if k in('miningXP','woodXP') then update public.player_saves set stats=stats||jsonb_build_object(k,50*(n-1)*(n-1)) where user_id=uid;else update public.player_saves set skills=skills||jsonb_build_object(k,50*(n-1)*(n-1)) where user_id=uid;end if;$o$,
$n$if k in('miningXP','woodXP') then update public.player_saves set stats=stats||jsonb_build_object(k,eldervale_private.level_xp(n)) where user_id=uid;else update public.player_saves set skills=skills||jsonb_build_object(k,eldervale_private.level_xp(n)) where user_id=uid;end if;$n$]);
select eldervale_private.patch_function('eldervale_private.admin_staff_base(text,jsonb)'::regprocedure,array[
$o$to_jsonb((n-1)*(n-1)*50)$o$,$n$to_jsonb(eldervale_private.level_xp(n))$n$]);
select eldervale_private.patch_function('eldervale_private.admin_console(text,jsonb)'::regprocedure,array[
$o$jsonb_object_agg(x,greatest(480200,coalesce((skills->>x)$o$,$n$jsonb_object_agg(x,greatest(13034431,coalesce((skills->>x)$n$,
$o$jsonb_object_agg(x,greatest(480200,coalesce((stats->>x)$o$,$n$jsonb_object_agg(x,greatest(13034431,coalesce((stats->>x)$n$,
$o$least(13000000,coalesce((stats->>k)::numeric,0)+n)$o$,$n$least(200000000,coalesce((stats->>k)::numeric,0)+n)$n$]);
-- Owner icon library: allow the new food illustrations for custom items.
select eldervale_private.patch_function('eldervale_private.admin_before_professions(text,jsonb)'::regprocedure,array[
$o$'leather','bone','ore') then raise exception$o$,$n$'leather','bone','ore','sundae','trout','swordfish','stormfin') then raise exception$n$]);

-- ---------------------------------------------------------------- Patches: combat
select eldervale_private.patch_function('eldervale_private.world_tick()'::regprocedure,array[
-- Eating delays your next attack: the player's swing waits until 1.8 s after the last bite.
$o$   elsif a.phase='ready' then
    update eldervale_private.realm_players set yaw=atan2(a.x-target_player.x,a.z-target_player.z) where user_id=a.target;$o$,
$n$   elsif a.phase='ready' and a.turn='player' and target_player.consume_at>t-interval '1.8 seconds' then null;
   elsif a.phase='ready' then
    update eldervale_private.realm_players set yaw=atan2(a.x-target_player.x,a.z-target_player.z) where user_id=a.target;$n$,
$o$atk:=least(100,1+floor(sqrt(greatest(0,coalesce((victim.skills->>'attackXP')::numeric,0))/50))::integer);str:=least(100,1+floor(sqrt(greatest(0,coalesce((victim.skills->>'strengthXP')::numeric,0))/50))::integer);$o$,
$n$atk:=eldervale_private.xp_level((victim.skills->>'attackXP')::numeric);str:=eldervale_private.xp_level((victim.skills->>'strengthXP')::numeric);$n$,
$o$     award:=greatest(2,2*ceil(damage/2.0)::integer);
     update public.player_saves set skills=skills||jsonb_build_object('attackXP',coalesce((skills->>'attackXP')::integer,0)+case when style='stab' then award when style='lunge' then award/2 else 0 end,'strengthXP',coalesce((skills->>'strengthXP')::integer,0)+case when style='slash' then award when style='lunge' then award/2 else 0 end,'hitpointsXP',coalesce((skills->>'hitpointsXP')::integer,0)+greatest(1,damage/4)) where user_id=a.target;$o$,
$n$     award:=least(damage,a.hp);perform eldervale_private.combat_xp(a.target,award,style,w);$n$,
$o$def:=least(100,1+floor(sqrt(greatest(0,coalesce((victim.skills->>'defenceXP')::numeric,0))/50))::integer);$o$,
$n$def:=eldervale_private.xp_level((victim.skills->>'defenceXP')::numeric);$n$,
$o$     update public.player_saves set skills=skills||jsonb_build_object('defenceXP',coalesce((skills->>'defenceXP')::integer,0)+case when blocked then 3 else 1 end) where user_id=a.target;
$o$,$n$$n$,
$o$damage:=case when blocked then 0 else greatest(1,4+(a.data->>'damage')::integer+floor(random()*5)::integer-case when a.data->>'attackType' in ('fire','magic','venom') then 0 else absorb end) end;
     update public.player_saves set health=greatest(0,health-damage) where user_id=a.target;$o$,
$n$damage:=case when blocked then 0 else greatest(1,round((4+(a.data->>'damage')::integer+floor(random()*5)::integer)*eldervale_private.monster_damage_scale((a.data->>'level')::integer))::integer-case when a.data->>'attackType' in ('fire','magic','venom') then 0 else absorb end) end;
     update public.player_saves set health=greatest(0,health-damage),skills=skills||jsonb_build_object('hitpointsXP',least(200000000,coalesce((skills->>'hitpointsXP')::numeric,0)+damage)) where user_id=a.target;$n$]);

-- ---------------------------------------------------------------- Patches: eating
-- Food heals the larger of its flat amount and its share of max HP (healPct), capped at max HP;
-- one bite per 1.8 s; an 'eat' event lets every nearby client play the eating animation.
select eldervale_private.patch_function('eldervale_private.realm_request_social_base(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
$o$if p.consume_at>now()-interval '1 second' then raise exception 'Wait a moment before eating again';end if;$o$,
$n$if p.consume_at>now()-interval '1.75 seconds' then raise exception 'You are already eating.';end if;$n$,
$o$update public.player_saves set health=least(max_health,health+(c->>'heal')::integer) where user_id=auth.uid();update eldervale_private.realm_players set consume_at=now() where user_id=auth.uid();$o$,
$n$update public.player_saves set health=least(max_health,health+greatest((c->>'heal')::integer,ceil(max_health*coalesce((c->>'healPct')::numeric,0)/100.0)::integer)) where user_id=auth.uid();update eldervale_private.realm_players set consume_at=now() where user_id=auth.uid();perform eldervale_private.emit(jsonb_build_object('type','eat','player',auth.uid(),'item',k));$n$]);
select eldervale_private.patch_function('eldervale_private.realm_request_before_bank_notes(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
$o$if p.consume_at>clock_timestamp()-interval '1 second' then raise exception 'Wait a moment before eating again';end if;$o$,
$n$if p.consume_at>clock_timestamp()-interval '1.75 seconds' then raise exception 'You are already eating.';end if;$n$,
$o$update public.player_saves set health=least(max_health,health+(r->>'heal')::integer) where user_id=auth.uid();update eldervale_private.realm_players set consume_at=clock_timestamp() where user_id=auth.uid();$o$,
$n$update public.player_saves set health=least(max_health,health+greatest((r->>'heal')::integer,ceil(max_health*coalesce((r->>'healPct')::numeric,0)/100.0)::integer)) where user_id=auth.uid();update eldervale_private.realm_players set consume_at=clock_timestamp() where user_id=auth.uid();perform eldervale_private.emit(jsonb_build_object('type','eat','player',auth.uid(),'item',payload->>'item'));$n$]);

-- Recompute stored combat levels with the new formula (the trigger also keeps them current).
update public.player_saves set level=eldervale_private.combat_level(skills) where level is distinct from eldervale_private.combat_level(skills);
