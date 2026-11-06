-- Eldervale fishing tiers, spot types and moving spots (server half of fish-tiers.js / water-data.js).
-- APPLY AFTER db/underground-1-engine.sql (uses eldervale_private.underground_patch) and before
-- db/water-2-world.sql. Idempotent; safe on a running game.
--
-- * Catalog: nine new fish (raw + cooked), fly rod, feathers, big net; cooking recipes.
-- * fish_table(): the first ladder unchanged plus the new tiers and two new methods:
--   'fly' (lure: fly rod + feathers, trout/salmon/rainbowfin) and 'bignet' (mackerel, cod, bass).
-- * Spot types (realm_objects.data.spotType): shore (net/bait), river (lure/bait), cage
--   (cage/harpoon), bignet (big net/harpoon), deep (bait/harpoon). A spot without a type keeps the
--   first ladder and its four methods, exactly as before. data.catches (array) overrides the fish.
-- * Moving spots: data.moves = {points:[[x,z],...], minTicks, maxTicks, paused}. Every gathering tick
--   due spots jump to another of their points (OSRS: every 250–530 ticks); a fisher there stops.
begin;
set local lock_timeout='5s';

-- generated:catalog begin (node scripts/build-water-seed.mjs)
insert into eldervale_private.realm_catalog(id,data) select r->>0,r->1 from jsonb_array_elements($j$[["item:mudperch",{"name":"Cooked mudperch","model":"fish","buy":16,"sell":4,"stackable":false,"unique":false,"category":"Food","icon":"supply","description":"Heals 32% of your maximum HP. Cooking 5.","color":10128492,"heal":32,"healPct":32}],["item:rawMudperch",{"name":"Raw mudperch","model":"fish","buy":9,"sell":4,"stackable":false,"unique":false,"category":"Ingredients","icon":"supply","description":"Fishing 10 (bait). Cook it (Cooking 5) before eating.","color":8292970}],["item:silverbait",{"name":"Cooked silverbait","model":"shrimp","buy":15,"sell":4,"stackable":false,"unique":false,"category":"Food","icon":"supply","description":"Heals 30% of your maximum HP. Cooking 1.","color":13157044,"heal":30,"healPct":30}],["item:rawSilverbait",{"name":"Raw silverbait","model":"shrimp","buy":9,"sell":3,"stackable":false,"unique":false,"category":"Ingredients","icon":"supply","description":"Fishing 15 (net). Cook it (Cooking 1) before eating.","color":12174534}],["item:stripedMackerel",{"name":"Cooked striped mackerel","model":"fish","buy":20,"sell":6,"stackable":false,"unique":false,"category":"Food","icon":"supply","description":"Heals 34% of your maximum HP. Cooking 10.","color":9411475,"heal":34,"healPct":34}],["item:rawStripedMackerel",{"name":"Raw striped mackerel","model":"fish","buy":12,"sell":5,"stackable":false,"unique":false,"category":"Ingredients","icon":"supply","description":"Fishing 16 (big net). Cook it (Cooking 10) before eating.","color":6261391}],["item:coastCod",{"name":"Cooked coast cod","model":"fish","buy":30,"sell":9,"stackable":false,"unique":false,"category":"Food","icon":"supply","description":"Heals 44% of your maximum HP. Cooking 18.","color":13284760,"heal":44,"healPct":44}],["item:rawCoastCod",{"name":"Raw coast cod","model":"fish","buy":18,"sell":7,"stackable":false,"unique":false,"category":"Ingredients","icon":"supply","description":"Fishing 23 (big net). Cook it (Cooking 18) before eating.","color":9214598}],["item:reedpike",{"name":"Cooked reedpike","model":"fish","buy":32,"sell":9,"stackable":false,"unique":false,"category":"Food","icon":"supply","description":"Heals 46% of your maximum HP. Cooking 20.","color":11770486,"heal":46,"healPct":46}],["item:rawReedpike",{"name":"Raw reedpike","model":"fish","buy":19,"sell":8,"stackable":false,"unique":false,"category":"Ingredients","icon":"supply","description":"Fishing 25 (bait). Cook it (Cooking 20) before eating.","color":7306328}],["item:brightfin",{"name":"Cooked brightfin","model":"swordfish","buy":44,"sell":13,"stackable":false,"unique":false,"category":"Food","icon":"supply","description":"Heals 52% of your maximum HP. Cooking 30.","color":12092014,"heal":52,"healPct":52}],["item:rawBrightfin",{"name":"Raw brightfin","model":"swordfish","buy":26,"sell":11,"stackable":false,"unique":false,"category":"Ingredients","icon":"supply","description":"Fishing 35 (harpoon). Cook it (Cooking 30) before eating.","color":5206931}],["item:rainbowfin",{"name":"Cooked rainbowfin","model":"salmon","buy":48,"sell":14,"stackable":false,"unique":false,"category":"Food","icon":"supply","description":"Heals 55% of your maximum HP. Cooking 35.","color":13078652,"heal":55,"healPct":55}],["item:rawRainbowfin",{"name":"Raw rainbowfin","model":"fish","buy":28,"sell":12,"stackable":false,"unique":false,"category":"Ingredients","icon":"supply","description":"Fishing 38 (lure). Cook it (Cooking 35) before eating.","color":10464922}],["item:stoneBass",{"name":"Cooked stone bass","model":"fish","buy":80,"sell":24,"stackable":false,"unique":false,"category":"Food","icon":"supply","description":"Heals 64% of your maximum HP. Cooking 43.","color":10522750,"heal":64,"healPct":64}],["item:rawStoneBass",{"name":"Raw stone bass","model":"fish","buy":48,"sell":20,"stackable":false,"unique":false,"category":"Ingredients","icon":"supply","description":"Fishing 46 (big net). Cook it (Cooking 43) before eating.","color":6055014}],["item:deepglowAngler",{"name":"Cooked deepglow angler","model":"stormfin","buy":220,"sell":66,"stackable":false,"unique":false,"category":"Food","icon":"supply","description":"Heals 85% of your maximum HP. Cooking 84.","color":7301758,"heal":85,"healPct":85}],["item:rawDeepglowAngler",{"name":"Raw deepglow angler","model":"stormfin","buy":132,"sell":55,"stackable":false,"unique":false,"category":"Ingredients","icon":"supply","description":"Fishing 82 (bait). Cook it (Cooking 84) before eating.","color":3948378}],["item:flyRod",{"name":"Fly rod","model":"rod","buy":40,"sell":12,"unique":true,"stackable":false,"category":"Tools","description":"Lure fishing for trout, salmon and rainbowfin (Fishing 20). Needs feathers."}],["item:feathers",{"name":"Feathers","model":"feather","buy":3,"sell":1,"unique":false,"stackable":true,"category":"Tools","description":"Lure for fly fishing; one is used for each catch."}],["item:bigNet",{"name":"Big net","model":"net","buy":60,"sell":18,"unique":true,"stackable":false,"category":"Tools","description":"Big-net fishing for mackerel, cod and stone bass (Fishing 16)."}]]$j$::jsonb) r
 on conflict(id) do update set data=eldervale_private.realm_catalog.data||excluded.data;
insert into eldervale_private.skill_recipes(id,data) select r->>0,r->1 from jsonb_array_elements($j$[["cook_mudperch",{"name":"Cook mudperch","skill":"cooking","level":5,"xp":50,"inputs":{"rawMudperch":1},"outputs":{"mudperch":1},"tools":[],"station":"cooking","seconds":3,"enabled":true,"kind":"process","burnChance":0.18,"stopBurn":38}],["cook_silverbait",{"name":"Cook silverbait","skill":"cooking","level":1,"xp":30,"inputs":{"rawSilverbait":1},"outputs":{"silverbait":1},"tools":[],"station":"cooking","seconds":3,"enabled":true,"kind":"process","burnChance":0.15,"stopBurn":34}],["cook_stripedMackerel",{"name":"Cook striped mackerel","skill":"cooking","level":10,"xp":60,"inputs":{"rawStripedMackerel":1},"outputs":{"stripedMackerel":1},"tools":[],"station":"cooking","seconds":3,"enabled":true,"kind":"process","burnChance":0.2,"stopBurn":45}],["cook_coastCod",{"name":"Cook coast cod","skill":"cooking","level":18,"xp":75,"inputs":{"rawCoastCod":1},"outputs":{"coastCod":1},"tools":[],"station":"cooking","seconds":3,"enabled":true,"kind":"process","burnChance":0.22,"stopBurn":52}],["cook_reedpike",{"name":"Cook reedpike","skill":"cooking","level":20,"xp":80,"inputs":{"rawReedpike":1},"outputs":{"reedpike":1},"tools":[],"station":"cooking","seconds":3,"enabled":true,"kind":"process","burnChance":0.22,"stopBurn":59}],["cook_brightfin",{"name":"Cook brightfin","skill":"cooking","level":30,"xp":100,"inputs":{"rawBrightfin":1},"outputs":{"brightfin":1},"tools":[],"station":"cooking","seconds":3,"enabled":true,"kind":"process","burnChance":0.25,"stopBurn":64}],["cook_rainbowfin",{"name":"Cook rainbowfin","skill":"cooking","level":35,"xp":110,"inputs":{"rawRainbowfin":1},"outputs":{"rainbowfin":1},"tools":[],"station":"cooking","seconds":3,"enabled":true,"kind":"process","burnChance":0.26,"stopBurn":70}],["cook_stoneBass",{"name":"Cook stone bass","skill":"cooking","level":43,"xp":130,"inputs":{"rawStoneBass":1},"outputs":{"stoneBass":1},"tools":[],"station":"cooking","seconds":3,"enabled":true,"kind":"process","burnChance":0.3,"stopBurn":80}],["cook_deepglowAngler",{"name":"Cook deepglow angler","skill":"cooking","level":84,"xp":230,"inputs":{"rawDeepglowAngler":1},"outputs":{"deepglowAngler":1},"tools":[],"station":"cooking","seconds":3,"enabled":true,"kind":"process","burnChance":0.38,"stopBurn":99}]]$j$::jsonb) r
 on conflict(id) do update set data=excluded.data;
-- The first ladder (db/osrs-skill-parity.sql) followed by the new tiers; same shape as before.
create or replace function eldervale_private.fish_table() returns jsonb language sql immutable set search_path to '' as $fn$
 select '[{"item":"rawShrimp","method":"net","level":1,"xp":10,"low":48,"high":256},{"item":"rawFish","method":"rod","level":1,"xp":20,"low":32,"high":192},{"item":"rawTrout","method":"rod","level":20,"xp":50,"low":32,"high":192},{"item":"rawSalmon","method":"rod","level":30,"xp":70,"low":16,"high":96},{"item":"rawLobster","method":"cage","level":40,"xp":90,"low":6,"high":95},{"item":"rawSwordfish","method":"harpoon","level":50,"xp":100,"low":4,"high":48},{"item":"rawStormfin","method":"harpoon","level":76,"xp":110,"low":3,"high":40},{"item":"rawMudperch","method":"rod","level":10,"xp":30,"low":24,"high":128},{"item":"rawSilverbait","method":"net","level":15,"xp":40,"low":24,"high":128},{"item":"rawStripedMackerel","method":"bignet","level":16,"xp":20,"low":5,"high":65},{"item":"rawTrout","method":"fly","level":20,"xp":50,"low":32,"high":192},{"item":"rawCoastCod","method":"bignet","level":23,"xp":45,"low":4,"high":55},{"item":"rawReedpike","method":"rod","level":25,"xp":60,"low":16,"high":96},{"item":"rawSalmon","method":"fly","level":30,"xp":70,"low":16,"high":96},{"item":"rawBrightfin","method":"harpoon","level":35,"xp":80,"low":8,"high":64},{"item":"rawRainbowfin","method":"fly","level":38,"xp":80,"low":8,"high":64},{"item":"rawStoneBass","method":"bignet","level":46,"xp":100,"low":3,"high":40},{"item":"rawDeepglowAngler","method":"rod","level":82,"xp":120,"low":2,"high":28}]'::jsonb
$fn$;
-- generated:catalog end

-- Fish a spot can give and methods it takes (fish-tiers.js spotCatches / spotMethods).
create or replace function eldervale_private.fishing_spot_catches(spot jsonb) returns jsonb
language sql immutable set search_path to '' as $fn$
 select (case when jsonb_typeof(spot->'catches')='array' then spot->'catches'
  else coalesce(('{"shore":["rawShrimp","rawSilverbait","rawFish","rawMudperch"],"river":["rawTrout","rawSalmon","rawRainbowfin","rawFish","rawMudperch","rawReedpike"],"cage":["rawLobster","rawBrightfin","rawSwordfish"],"bignet":["rawStripedMackerel","rawCoastCod","rawStoneBass","rawBrightfin","rawSwordfish","rawStormfin"],"deep":["rawDeepglowAngler","rawStormfin","rawSwordfish"]}'::jsonb)->(spot->>'spotType'),
   '["rawShrimp","rawFish","rawTrout","rawSalmon","rawLobster","rawSwordfish","rawStormfin"]'::jsonb) end)
$fn$;
create or replace function eldervale_private.fishing_spot_methods(spot jsonb) returns jsonb
language sql immutable set search_path to '' as $fn$
 select coalesce(('{"shore":["net","rod"],"river":["fly","rod"],"cage":["cage","harpoon"],"bignet":["bignet","harpoon"],"deep":["rod","harpoon"]}'::jsonb)->(spot->>'spotType'),'["net","rod","cage","harpoon"]'::jsonb)
$fn$;
-- One catch roll at a spot: the best fish the spot gives and you qualify for first (fish_attempt at a spot).
create or replace function eldervale_private.fish_attempt_at(spot jsonb, method text, level integer) returns jsonb
language plpgsql set search_path to '' as $fn$
declare f jsonb;eligible boolean:=false;allow jsonb:=eldervale_private.fishing_spot_catches(spot);
begin
 for f in select value from jsonb_array_elements(eldervale_private.fish_table()) where value->>'method'=method and (value->>'level')::integer<=coalesce(level,1) and allow ? (value->>'item') order by (value->>'level')::integer desc loop
  eligible:=true;
  if random()<eldervale_private.skilling_chance((f->>'low')::numeric,(f->>'high')::numeric,level) then return f;end if;
 end loop;
 return (case when eligible then '{}'::jsonb else null end);
end $fn$;
-- Spot type and the new tools (checked before the base fishing checks).
create or replace function eldervale_private.fishing_spot_error(uid uuid, target_id text, method text) returns text
language plpgsql stable set search_path to '' as $fn$
declare o eldervale_private.realm_objects;s public.player_saves;lvl integer;
begin
 if method='woodcut' then return null;end if;
 select * into o from eldervale_private.realm_objects where id=target_id and kind='fishing';
 if o.id is null then return null;end if;
 if not(eldervale_private.fishing_spot_methods(o.data) ? method) then
  return 'You can''t fish that way here. This spot takes: '||(select string_agg((case m when 'rod' then 'bait' when 'fly' then 'lure' when 'bignet' then 'big net' else m end),' / ') from jsonb_array_elements_text(eldervale_private.fishing_spot_methods(o.data)) m)||'.';
 end if;
 select * into s from public.player_saves where user_id=uid;
 lvl:=eldervale_private.xp_level(coalesce((s.skills->>'fishingXP')::numeric,0));
 if method='fly' then
  if coalesce((s.stats->>'flyRod')::integer,0)<1 then return 'You need a fly rod in your inventory.';end if;
  if coalesce((s.stats->>'feathers')::integer,0)<1 then return 'You need feathers to lure fish.';end if;
  if lvl<20 then return 'You need Fishing level 20 to lure fish.';end if;
 elsif method='bignet' then
  if coalesce((s.stats->>'bigNet')::integer,0)<1 then return 'You need a big net in your inventory.';end if;
  if lvl<16 then return 'You need Fishing level 16 to use a big net.';end if;
 end if;
 return null;
end $fn$;
-- Moving spots (OSRS): due spots jump to another of their points; one revision bump per batch.
create or replace function eldervale_private.fishing_spot_drift(t timestamp with time zone) returns integer
language plpgsql security definer set search_path to '' as $fn$
declare r record;pts jsonb;n integer;k integer;lo integer;hi integer;rev bigint;moved integer:=0;nxt jsonb;
begin
 if not exists(select 1 from eldervale_private.realm_objects o where o.kind='fishing' and jsonb_typeof(o.data->'moves'->'points')='array' and coalesce((o.data->>'moveAt')::timestamptz,'-infinity'::timestamptz)<=t) then return 0;end if;
 for r in select e.id,e.data from eldervale_private.entities e join eldervale_private.realm_objects o on o.id=e.id::text
  where not e.deleted and o.kind='fishing' and jsonb_typeof(e.data->'moves'->'points')='array' and coalesce((e.data->>'moveAt')::timestamptz,'-infinity'::timestamptz)<=t for update of e loop
  pts:=r.data->'moves'->'points';n:=jsonb_array_length(pts);
  lo:=greatest(10,coalesce((r.data->'moves'->>'minTicks')::integer,250));hi:=greatest(lo,coalesce((r.data->'moves'->>'maxTicks')::integer,530));
  if n<2 or coalesce((r.data->'moves'->>'paused')::boolean,false) or not(r.data ? 'moveAt') then
   -- Not moving (paused, one point) or first sight: schedule only, nothing visible changes.
   update eldervale_private.entities set data=data||jsonb_build_object('moveAt',t+make_interval(secs=>(lo+floor(random()*(hi-lo+1)))*0.6)) where id=r.id;
   continue;
  end if;
  k:=(coalesce((r.data->>'moveIndex')::integer,0)+1+floor(random()*(n-1))::integer)%n;nxt:=pts->k;
  if rev is null then update eldervale_private.settings set revision=revision+1 where id returning revision into rev;end if;
  update eldervale_private.entities set revision=rev,data=data||jsonb_build_object('x',(nxt->>0)::float8,'z',(nxt->>1)::float8,'moveIndex',k,'moveAt',t+make_interval(secs=>(lo+floor(random()*(hi-lo+1)))*0.6)) where id=r.id;
  perform eldervale_private.emit(jsonb_build_object('type','fishing_spot_moved','target',r.id::text,'x',(nxt->>0)::float8,'z',(nxt->>1)::float8));
  moved:=moved+1;
 end loop;
 return moved;
end $fn$;
revoke all on function eldervale_private.fishing_spot_catches(jsonb),eldervale_private.fishing_spot_methods(jsonb),eldervale_private.fish_attempt_at(jsonb,text,integer),
 eldervale_private.fishing_spot_error(uuid,text,text),eldervale_private.fishing_spot_drift(timestamptz) from public,anon,authenticated;

-- Hooks (anchors read from live on 2026-11-06; scripts/underground-db/live-anchors.mjs).
select eldervale_private.underground_patch('eldervale_private.realm_request_before_professions(uuid,text,jsonb,uuid,bigint)',$m$'fly','bignet'$m$,array[
 $a$if method not in('woodcut','rod','net','cage','harpoon') or command='fish'$a$,
 $a$if method not in('woodcut','rod','net','cage','harpoon','fly','bignet') or command='fish'$a$]);
select eldervale_private.underground_patch('eldervale_private.gathering_error(uuid,text,text)','fishing_spot_error',array[
 $a$ if method in('cage','harpoon') then$a$,
 $a$ problem:=eldervale_private.fishing_spot_error(uid,target_id,method);if problem is not null then return problem;end if;
 if method in('cage','harpoon') then$a$]);
select eldervale_private.underground_patch('eldervale_private.gathering_tick(timestamp with time zone)','fish_attempt_at',array[
 $a$caught:=eldervale_private.fish_attempt(a.method,eldervale_private.skill_level(a.user_id,'fishing'));$a$,
 $a$caught:=eldervale_private.fish_attempt_at(o.data,a.method,eldervale_private.skill_level(a.user_id,'fishing'));$a$,
 $a$if a.method='rod' then perform eldervale_private.item_change(a.user_id,'bait',-1);end if;$a$,
 $a$if a.method='rod' then perform eldervale_private.item_change(a.user_id,'bait',-1);end if;if a.method='fly' then perform eldervale_private.item_change(a.user_id,'feathers',-1);end if;$a$,
 $a$ update eldervale_private.realm_objects set available_at=null,data=data-'logsRemaining' where kind='tree' and available_at<=t;$a$,
 $a$ perform eldervale_private.fishing_spot_drift(t);
 update eldervale_private.realm_objects set available_at=null,data=data-'logsRemaining' where kind='tree' and available_at<=t;$a$]);
commit;
