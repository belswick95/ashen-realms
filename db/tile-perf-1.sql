-- Eldervale tile-mode performance, part 1. APPLY AFTER tick-tile-engine-5-cadence.sql and walk-redirect.sql.
-- Idempotent; safe on a running game; behaviour is unchanged (same results, less CPU).
-- Measured on live with one player in the tutorial (tile mode, inline driver), Nov 2026:
--   world_tick ~90-125 ms per game tick, of which guard_tick 57 ms (its guard-level UPDATE re-scanned
--   every actor once per guard, twice, because the OR branches inline the subquery), tile_refresh
--   35-45 ms every 10th tick with nothing dirty, and a bounded (tutorial) BFS spent 20-40 ms calling
--   tutorial_inside() on all 4225 cells of its window. Every world command spent ~70 ms rebuilding
--   the merchant price table (merchant_quote x3 per shop_stock row). Every request and world_tick
--   hold advisory lock 736211 for their whole transaction, so on a CPU-throttled instance these
--   costs queued requests behind multi-second ticks until they hit the 8 s statement timeout.
-- Fixes:
--  1 guard_levels(): each guard's required level computed once from one pass over hostile actors.
--    guard_tick's hostile-in-town loop checks the cheap "player near" test before town_at().
--  2 tile_refresh_if_dirty(): the grid signature scan runs only after a geometry change. Row
--    triggers log inserts/updates of collision sources (tile_dirty_log); row counts catch removals;
--    a full check still runs every 100 grid checks (~10 min) as a safety net.
--  3 tile_route(): the tutorial bound uses an inlinable copy of tutorial_inside (no per-call SET).
--  4 shop_quotes(): the merchant price table is cached and rebuilt only when shop_stock or the
--    shopPrice multiplier change.
begin;
set local lock_timeout='2s';

-- 1. Guards ---------------------------------------------------------------------------------------
create or replace function eldervale_private.guard_levels() returns table(id text, n integer)
language sql stable set search_path to '' as $fn$
 with beasts as materialized (
  select b.x,b.z,(b.data->>'level')::integer lvl from eldervale_private.realm_actors b
  where not b.deleted and coalesce((b.data->>'hostile')::boolean,false)),
 guards as materialized (
  select a.id,a.x,a.z,(a.data->>'level')::integer lvl from eldervale_private.realm_actors a
  where not a.deleted and a.data->>'role'='guard')
 select g.id,greatest(60,g.lvl,coalesce((select max(b.lvl)+5 from beasts b where abs(b.x-g.x)<100 and abs(b.z-g.z)<100),0))
 from guards g
$fn$;

-- 2. Grid refresh only after a geometry change ------------------------------------------------------
create table if not exists eldervale_private.tile_dirty_log(
 id bigserial primary key, src text not null, at timestamptz not null default clock_timestamp(), handled boolean not null default false);
create index if not exists tile_dirty_log_open on eldervale_private.tile_dirty_log(id) where not handled;

create or replace function eldervale_private.tile_dirty_mark() returns trigger
language plpgsql security definer set search_path to '' as $fn$
begin
 insert into eldervale_private.tile_dirty_log(src) values(tg_table_name||':'||lower(tg_op));
 return null;
end $fn$;

-- Could this realm_objects row be a tile_shapes() source? (Same kinds and templates as tile_shapes:
-- camp props, profession props, trees/rocks, stations, doors, tutorial pond/throne.) Moving fishing
-- spots, NPC-like objects and markers are not, so their constant moves do not dirty the grid.
create or replace function eldervale_private.tile_source_object(kind text, d jsonb) returns boolean language sql immutable as $fn$
 select kind in('tree','rock','door') or d->>'template' in('tent','bedroll','log_seat','cooking_tripod','supply_wagon','trail_sign','woodpile','rope_coil','camp_lantern','wooden_table','stool','weapon_rack','campfire','farm_hut','chicken_coop','hay_bale','water_trough','stone_statue','wheelbarrow','scarecrow','flower_bed','fence',
  'tree','pine','rock','crate','barrel','fountain','well','market','bench',
  'furnace','anvil','workbench','spinning_wheel','tanning_rack','mill','rune_altar','thieving_stall','practice_chest','essence_rock','construction_site',
  'training_pond','throne')
$fn$;

-- Only sources, and only the fields tile_shapes() reads (position, kind, template, scale, yaw,
-- scaleX/Z, floor) count: door opening, resource respawn and logsRemaining do not dirty the grid.
-- Row triggers, so the frequent zero-row upserts (insert ... on conflict do nothing) do not count.
create or replace trigger tile_dirty_objects_ins after insert on eldervale_private.realm_objects
 for each row when (eldervale_private.tile_source_object(new.kind,new.data)) execute function eldervale_private.tile_dirty_mark();
create or replace trigger tile_dirty_objects_upd after update on eldervale_private.realm_objects
 for each row when ((eldervale_private.tile_source_object(old.kind,old.data) or eldervale_private.tile_source_object(new.kind,new.data))
  and (old.x is distinct from new.x or old.z is distinct from new.z or old.kind is distinct from new.kind or old.id is distinct from new.id
  or old.data->'template' is distinct from new.data->'template' or old.data->'scale' is distinct from new.data->'scale'
  or old.data->'yaw' is distinct from new.data->'yaw' or old.data->'scaleX' is distinct from new.data->'scaleX'
  or old.data->'scaleZ' is distinct from new.data->'scaleZ' or old.data->'floor' is distinct from new.data->'floor'))
 execute function eldervale_private.tile_dirty_mark();
-- Entities are sources only as castle walls, gates and towers.
create or replace trigger tile_dirty_entities_ins after insert on eldervale_private.entities
 for each row when (new.data->>'template' in('castle_wall','castle_gate','castle_tower')) execute function eldervale_private.tile_dirty_mark();
create or replace trigger tile_dirty_entities_upd after update on eldervale_private.entities
 for each row when ((old.data->>'template' in('castle_wall','castle_gate','castle_tower') or new.data->>'template' in('castle_wall','castle_gate','castle_tower'))
  and (old.data is distinct from new.data or old.deleted is distinct from new.deleted))
 execute function eldervale_private.tile_dirty_mark();
create or replace trigger tile_dirty_water_ins after insert on eldervale_private.realm_water
 for each row execute function eldervale_private.tile_dirty_mark();
create or replace trigger tile_dirty_water_upd after update on eldervale_private.realm_water
 for each row execute function eldervale_private.tile_dirty_mark();

-- tile_refresh() when a source changed since the last check (or `force`); 0 otherwise.
create or replace function eldervale_private.tile_refresh_if_dirty(force boolean default false) returns integer
language plpgsql security definer set search_path to '' as $fn$
declare counts text;prev text;logged integer;r integer;
begin
 counts:=(select count(*) from eldervale_private.realm_objects)||':'||(select count(*) from eldervale_private.entities)||':'||(select count(*) from eldervale_private.realm_water);
 select state->>'grid_counts' into prev from eldervale_private.tick_engine where id;
 with h as (update eldervale_private.tile_dirty_log set handled=true where not handled returning 1) select count(*) into logged from h;
 if not force and logged=0 and prev is not distinct from counts and exists(select 1 from eldervale_private.tile_sources) then return 0;end if;
 r:=eldervale_private.tile_refresh();
 update eldervale_private.tick_engine set state=state||jsonb_build_object('grid_counts',counts,'grid_checked_at',clock_timestamp()) where id;
 return r;
end $fn$;

-- 3. Inlinable tutorial bound for the BFS (tutorial_inside carries SET search_path, so every call
-- costs a function call with a GUC save/restore). Same formula; a wrapper if the live one differs.
do $tut$
begin
 if position('abs(x+340)<=47 and abs(z+305)<=47' in pg_get_functiondef('eldervale_private.tutorial_inside(double precision,double precision)'::regprocedure))>0 then
  execute $f$create or replace function eldervale_private.tile_tutorial_inside(x double precision, z double precision) returns boolean
   language sql immutable as 'select abs(x+340)<=47 and abs(z+305)<=47'$f$;
 else
  execute $f$create or replace function eldervale_private.tile_tutorial_inside(x double precision, z double precision) returns boolean
   language sql immutable as 'select eldervale_private.tutorial_inside(x,z)'$f$;
 end if;
end $tut$;

-- 4. Merchant prices ------------------------------------------------------------------------------
create table if not exists eldervale_private.shop_quote_cache(
 id boolean primary key default true check(id), sig text not null, data jsonb not null, built_at timestamptz not null default now());

create or replace function eldervale_private.shop_quotes() returns jsonb
language plpgsql security definer set search_path to '' as $fn$
declare s text;c eldervale_private.shop_quote_cache;d jsonb;
begin
 select md5(coalesce(string_agg(concat_ws(',',ss.merchant,ss.item,ss.buy,ss.sell,ss.stock,ss.target_stock),'|' order by ss.merchant,ss.item),''))
  ||':'||eldervale_private.game_multiplier('shopPrice') into s from eldervale_private.shop_stock ss;
 select * into c from eldervale_private.shop_quote_cache where id;
 if found and c.sig=s then return c.data;end if;
 select coalesce(jsonb_object_agg(merchant,items),'{}') into d from (select ss.merchant,jsonb_object_agg(ss.item,jsonb_build_object('buy',eldervale_private.merchant_quote(ss.buy,ss.sell,ss.stock,ss.target_stock,true,1),'sell',eldervale_private.merchant_quote(ss.buy,ss.sell,ss.stock,ss.target_stock,false,1),'buy10',eldervale_private.merchant_quote(ss.buy,ss.sell,ss.stock,ss.target_stock,true,10),'stock',ss.stock,'pricing',case when ss.stock<0 then 'fixed' else 'supply' end))items from eldervale_private.shop_stock ss group by ss.merchant)q;
 insert into eldervale_private.shop_quote_cache(id,sig,data,built_at) values(true,s,d,now())
  on conflict (id) do update set sig=excluded.sig,data=excluded.data,built_at=excluded.built_at;
 return d;
end $fn$;

-- Server-side helpers only (the world functions call them as their owner).
revoke all on function eldervale_private.tile_dirty_mark() from public,anon,authenticated;
revoke all on function eldervale_private.tile_refresh_if_dirty(boolean) from public,anon,authenticated;
revoke all on function eldervale_private.shop_quotes() from public,anon,authenticated;
revoke all on function eldervale_private.guard_levels() from public,anon,authenticated;

-- Live patches. Each edit is skipped once present; each anchor must match the live text exactly once.
do $patch$
declare fn text;old text;new text;body text;
begin
 for fn,old,new in select e->>0,e->>1,e->>2 from jsonb_array_elements($edits$[
  ["eldervale_private.guard_tick(double precision)",
   "from (select a.id,greatest(60,(a.data->>'level')::integer,coalesce((select max((beast.data->>'level')::integer)+5 from eldervale_private.realm_actors beast where not beast.deleted and coalesce((beast.data->>'hostile')::boolean,false) and abs(beast.x-a.x)<100 and abs(beast.z-a.z)<100),0))n from eldervale_private.realm_actors a where not a.deleted and a.data->>'role'='guard') levels where",
   "from eldervale_private.guard_levels() levels where"],
  ["eldervale_private.guard_tick(double precision)",
   "and eldervale_private.town_at(x,z) is not null and not exists(select 1 from eldervale_private.guard_duels where monster=a.id) and exists(select 1 from eldervale_private.realm_players near_player where near_player.last_seen>t-interval '15 seconds' and abs(near_player.x-a.x)<100 and abs(near_player.z-a.z)<100) loop",
   "and not exists(select 1 from eldervale_private.guard_duels where monster=a.id) and (case when exists(select 1 from eldervale_private.realm_players near_player where near_player.last_seen>t-interval '15 seconds' and abs(near_player.x-a.x)<100 and abs(near_player.z-a.z)<100) then eldervale_private.town_at(x,z) is not null else false end) loop"],
  ["eldervale_private.engine_tick_begin(timestamp with time zone)",
   "if every>0 and eldervale_private.tick_no(t)%every=0 then perform eldervale_private.tile_refresh();end if;",
   "if every>0 and eldervale_private.tick_no(t)%every=0 then perform eldervale_private.tile_refresh_if_dirty(eldervale_private.tick_no(t)%(every*100)=0);end if;"],
  ["eldervale_private.tile_route(integer,integer,text,integer,integer,double precision,double precision,double precision,integer,integer,boolean,boolean)",
   "if not eldervale_private.tutorial_inside((ox+k%w)*1.58,(oz+k/w)*1.58) then fl[k+1]:=fl[k+1]|1;end if;",
   "if not eldervale_private.tile_tutorial_inside((ox+k%w)*1.58,(oz+k/w)*1.58) then fl[k+1]:=fl[k+1]|1;end if;"],
  ["eldervale_private.realm_request_before_castle(uuid,text,jsonb,uuid,bigint)",
   " select coalesce(jsonb_object_agg(merchant,items),'{}') into shop_data from (select ss.merchant,jsonb_object_agg(ss.item,jsonb_build_object('buy',eldervale_private.merchant_quote(ss.buy,ss.sell,ss.stock,ss.target_stock,true,1),'sell',eldervale_private.merchant_quote(ss.buy,ss.sell,ss.stock,ss.target_stock,false,1),'buy10',eldervale_private.merchant_quote(ss.buy,ss.sell,ss.stock,ss.target_stock,true,10),'stock',ss.stock,'pricing',case when ss.stock<0 then 'fixed' else 'supply' end))items from eldervale_private.shop_stock ss group by ss.merchant)q;",
   " shop_data:=eldervale_private.shop_quotes();"]
 ]$edits$::jsonb) e loop
  body:=pg_get_functiondef(fn::regprocedure);
  if position(new in body)>0 then continue;end if;
  perform eldervale_private.patch_function(fn::regprocedure,array[old,new]);
 end loop;
end $patch$;

commit;
