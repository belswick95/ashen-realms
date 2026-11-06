-- Eldervale tick & tile engine, stage 1: tile grid, collision flags, pathfinding, console tools.
-- APPLY AFTER db/perf-tick-fix.sql. Idempotent; safe on a running game: it only adds tables and
-- functions and one console branch. Nothing moves on tiles until the owner sets tile_mode
-- (stage 2+) in the Game console, so applying this file changes no gameplay.
--
-- Tile size: 1.58 world units. Eldervale characters are Quaternius metres x 1.58, so one tile is
-- one character-width (about 1 m, as an OSRS tile), click-walk.js already uses TILE=1.58, and
-- 1 tile per 600 ms tick = 2.63 units/s walking and 5.27 running - the live pace (2.6 / 5.2) to
-- within 1.3 %. Building doorways are ~1.9 units wide and walls ~1 unit thick, so a finer grid is
-- not needed and a coarser one would close doorways.
--
-- Grid: eldervale_private.tile_flags holds one row per non-empty tile (floor 0 only; upper stories
-- keep free movement). Tile (i,j) is centred on (i*1.58, j*1.58). Flag bits:
--   1 BLOCK   the tile centre is blocked
--   2 E       the move (i,j)<->(i+1,j) crosses an obstacle
--   4 N       the move (i,j)<->(i,j+1) crosses an obstacle
--   8 NE      the move (i,j)<->(i+1,j+1) crosses an obstacle
--  16 NW      the move (i,j)<->(i-1,j+1) crosses an obstacle
--  32 WATER   centre blocked by water (fishing spots stand next to these)
--  64 OBJECT  centre blocked by an object (tree, rock, prop, wall)
-- door_bits uses the same bits for features that are only blocked while `door` is closed
-- (building doorways, castle gates). A move is legal when the target centre is free, the crossed
-- edge is free, and a diagonal does not cut a corner (both orthogonal neighbours and their edges free, OSRS).
-- The flags are rasterised from the same shapes as can_step (camp props, profession props,
-- stations, trees/rocks, building walls + doorways, castle walls/gates/towers, tutorial pond and
-- throne, water outlines minus bridges) by sampling the tile centre and 3-4 points along each edge.
-- tile_refresh() diffs a geometry signature of every source and rebuilds only the dirty regions;
-- world_tick calls it every grid_check_ticks ticks (stage 3), the console can force a full rebuild.
begin;
set local lock_timeout='5s';

create table if not exists eldervale_private.tick_engine(
 id boolean primary key default true check(id),
 config jsonb not null default '{}'::jsonb,
 state jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now());
insert into eldervale_private.tick_engine(id) values(true) on conflict (id) do nothing;

create table if not exists eldervale_private.tile_flags(
 floor smallint not null default 0, i integer not null, j integer not null,
 flags smallint not null default 0, door_bits smallint not null default 0, door text,
 primary key(floor,i,j));
create table if not exists eldervale_private.tile_sources(
 src text primary key, sig text not null, i0 integer not null, j0 integer not null, i1 integer not null, j1 integer not null,
 live boolean not null default true, built_at timestamptz not null default now());

-- Settings with defaults; tick_engine.config overrides individual keys.
create or replace function eldervale_private.engine_config() returns jsonb language sql stable set search_path to '' as $fn$
 select jsonb_build_object('tile_mode',false,'tick_ms',600,'run_default',false,'path_radius',32,'alt_radius',10,
  'tick_driver','inline','grid_check_ticks',10,'corner_cutting',false,'talk_face_ticks',14,'max_catchup_ticks',2,'overlay',false)
  ||coalesce((select config from eldervale_private.tick_engine where id),'{}'::jsonb)
$fn$;
create or replace function eldervale_private.tile_mode() returns boolean language sql stable set search_path to '' as $fn$
 select coalesce((select (config->>'tile_mode')::boolean from eldervale_private.tick_engine where id),false)
$fn$;
create or replace function eldervale_private.tile_size() returns double precision language sql immutable as $fn$select 1.58::float8$fn$;
create or replace function eldervale_private.tile_of(v double precision) returns integer language sql immutable as $fn$select floor(v/1.58+.5)::integer$fn$;
create or replace function eldervale_private.tile_center(t integer) returns double precision language sql immutable as $fn$select round((t*1.58)::numeric,3)::float8$fn$;
-- Facing toward a point, in the same convention as realm_players.yaw (atan2(dx,dz)).
create or replace function eldervale_private.face_yaw(fx double precision, fz double precision, tx double precision, tz double precision, fallback double precision default 0)
returns double precision language sql immutable as $fn$
 select case when tx is null or tz is null or abs(tx-fx)+abs(tz-fz)<.0001 then fallback else atan2(tx-fx,tz-fz) end
$fn$;

-- Every collision shape of floor 0, in can_step's own frames. shape: rect | circle | band | gate.
-- A point (x,z) maps to tx=((x-cx)cos(ang)-(z-cz)sin(ang))/sx, tz=((x-cx)sin(ang)+(z-cz)cos(ang))/sz.
create or replace function eldervale_private.tile_shapes()
returns table(src text,shape text,cx double precision,cz double precision,ang double precision,sx double precision,sz double precision,hx double precision,hz double precision,door text,rad double precision)
language sql stable set search_path to '' as $fn$
 with camp as (
  select o.id,o.x,o.z,o.data,('{"tent":[2,1.95],"bedroll":[0.48,1.05],"log_seat":[0.35,1.1],"cooking_tripod":[0.55,0.55],"supply_wagon":[1.25,2.8],"trail_sign":[0.2,0.2],"woodpile":[0.65,0.65],"rope_coil":[0.48,0.48],"camp_lantern":[0.18,0.18],"wooden_table":[1,0.5],"stool":[0.3,0.3],"weapon_rack":[1.05,0.25],"campfire":[0.65,0.65],"farm_hut":[2.2,1.8],"chicken_coop":[0.75,0.55],"hay_bale":[1.1,0.45],"water_trough":[0.95,0.4],"stone_statue":[0.55,0.55],"wheelbarrow":[0.4,0.7],"scarecrow":[0.15,0.15],"flower_bed":[1,0.45],"fence":[0.85,0.12]}'::jsonb)->(o.data->>'template') size,
   coalesce((o.data->>'scale')::float8,1) s,coalesce((o.data->>'yaw')::float8,0)*(case when o.data?'scaleX' then 1 else pi()/180 end) a
  from eldervale_private.realm_objects o where coalesce((o.data->>'floor')::integer,0)=0 and o.data->>'template' in('tent','bedroll','log_seat','cooking_tripod','supply_wagon','trail_sign','woodpile','rope_coil','camp_lantern','wooden_table','stool','weapon_rack','campfire','farm_hut','chicken_coop','hay_bale','water_trough','stone_statue','wheelbarrow','scarecrow','flower_bed','fence')),
 prof as (
  select o.id,o.x,o.z,t.template,coalesce((o.data->>'scale')::float8,1) s,coalesce((o.data->>'yaw')::float8,0)*(case when o.data?'scaleX' then 1 else pi()/180 end) a,
   (case t.template when 'tree' then .7 when 'pine' then .7 when 'rock' then 1.1 when 'crate' then .7 when 'barrel' then .6 when 'fountain' then 1.9 when 'well' then 1.2 when 'market' then 1.35 when 'bench' then 1.15 else 0 end) h
  from eldervale_private.realm_objects o cross join lateral (select coalesce(o.data->>'template',o.kind) template) t
  where coalesce((o.data->>'floor')::integer,0)=0 and (o.kind in('tree','rock') or o.data->>'template' in('tree','pine','rock','crate','barrel','fountain','well','market','bench'))),
 station as (
  select o.id,o.x,o.z,coalesce((o.data->>'scale')::float8,1) s,coalesce((o.data->>'yaw')::float8,0)*(case when o.data?'scaleX' then 1 else pi()/180 end) a,
   (case when o.data->>'template' in('furnace','workbench','thieving_stall') then 1.4 else 1.0 end) h
  from eldervale_private.realm_objects o where coalesce((o.data->>'floor')::integer,0)=0 and o.data->>'template' in('furnace','anvil','workbench','spinning_wheel','tanning_rack','mill','rune_altar','thieving_stall','practice_chest','essence_rock','construction_site')),
 castle as (
  select e.id::text id,e.data->>'template' template,(e.data->>'x')::float8 x,(e.data->>'z')::float8 z,coalesce((e.data->>'yaw')::float8,0)*pi()/180 a,
   coalesce((e.data->>'scale')::float8,1) s,coalesce((e.data->>'length')::float8,24)/2+.3 len
  from eldervale_private.entities e where not e.deleted and e.data->>'template' in('castle_wall','castle_gate','castle_tower'))
 select 'c:'||id,'rect',x,z,a,
   (case when data->>'template'='fence' then coalesce((data->>'scaleX')::float8,s) else s end),
   (case when data->>'template'='fence' then coalesce((data->>'scaleZ')::float8,s) else s end),
   (size->>0)::float8+.2,(size->>1)::float8+.2,null::text,0::float8
  from camp where size is not null
 union all
 select 'p:'||id,(case when template in('fountain','well','tree','pine','rock') then 'circle' else 'rect' end),x,z,a,s,s,h+.2,
   (case template when 'crate' then .6 when 'market' then .95 when 'bench' then .5 else h end)+.2,null,0
  from prof where h>0
 union all
 select 's:'||id,'rect',x,z,a,s,s,h,1.0,null,0 from station
 union all
 select 'd:'||o.id,'band',o.x,o.z,coalesce((o.data->>'yaw')::float8,0),coalesce((o.data->>'scaleX')::float8,1),coalesce((o.data->>'scaleZ')::float8,1),2.17,2.09,o.id,0
  from eldervale_private.realm_objects o where o.kind='door' and coalesce((o.data->>'floor')::integer,0)=0
 union all
 select 'k:'||id,(case template when 'castle_tower' then 'circle' when 'castle_gate' then 'gate' else 'rect' end),x,z,a,s,s,
   (case template when 'castle_tower' then 5 else len end),(case template when 'castle_tower' then 5 when 'castle_gate' then 2.1 else 1.6 end),
   (case when template='castle_gate' then id end),0
  from castle
 union all
 select 't:'||o.id,'circle',o.x,o.z,0,coalesce((o.data->>'scale')::float8,1),coalesce((o.data->>'scale')::float8,1),
   (case when o.data->>'template'='training_pond' then 2.5 else 1.1 end),0,null,0
  from eldervale_private.realm_objects o where o.data->>'template' in('training_pond','throne') and o.x between -392 and -288 and o.z between -358 and -252
$fn$;

-- Shapes with their world bounding radius and tile box (one tile of margin for edge samples).
create or replace function eldervale_private.tile_shape_boxes()
returns table(src text,shape text,cx double precision,cz double precision,ang double precision,sx double precision,sz double precision,hx double precision,hz double precision,door text,sig text,i0 integer,j0 integer,i1 integer,j1 integer)
language sql stable set search_path to '' as $fn$
 select s.src,s.shape,s.cx,s.cz,s.ang,s.sx,s.sz,s.hx,s.hz,s.door,
  md5(concat_ws('|',s.shape,round(s.cx::numeric,4),round(s.cz::numeric,4),round(s.ang::numeric,6),round(s.sx::numeric,4),round(s.sz::numeric,4),round(s.hx::numeric,4),round(s.hz::numeric,4),s.door)),
  floor((s.cx-r.rad)/1.58)::integer-1,floor((s.cz-r.rad)/1.58)::integer-1,ceil((s.cx+r.rad)/1.58)::integer+1,ceil((s.cz+r.rad)/1.58)::integer+1
 from eldervale_private.tile_shapes() s
 cross join lateral (select (case when s.shape='circle' then s.hx*greatest(s.sx,s.sz) else sqrt(power(s.hx*s.sx,2)+power(s.hz*s.sz,2)) end) rad) r
$fn$;

-- Water outlines (blocking ones and bridge corridors) as sources.
create or replace function eldervale_private.tile_water_boxes()
returns table(src text,passable boolean,outline polygon,sig text,i0 integer,j0 integer,i1 integer,j1 integer)
language sql stable set search_path to '' as $fn$
 select 'w:'||w.id,w.passable,w.outline,md5(w.passable::text||w.outline::text),
  floor(least((b[0])[0],(b[1])[0])/1.58)::integer-1,floor(least((b[0])[1],(b[1])[1])/1.58)::integer-1,
  ceil(greatest((b[0])[0],(b[1])[0])/1.58)::integer+1,ceil(greatest((b[0])[1],(b[1])[1])/1.58)::integer+1
 from eldervale_private.realm_water w cross join lateral (select box(w.outline) b) bb
$fn$;

-- Sample points per tile: centre (k=0), 3 on the E and N edges, 4 on the NE and NW diagonals.
create or replace function eldervale_private.tile_samples() returns table(k integer,ox double precision,oz double precision,mask integer)
language sql immutable as $fn$
 select * from (values (0,0::float8,0::float8,1),(1,.25,0,2),(2,.5,0,2),(3,.75,0,2),(4,0,.25,4),(5,0,.5,4),(6,0,.75,4),
  (7,.2,.2,8),(8,.4,.4,8),(9,.6,.6,8),(10,.8,.8,8),(11,-.2,.2,16),(12,-.4,.4,16),(13,-.6,.6,16),(14,-.8,.8,16)) v(k,ox,oz,mask)
$fn$;

-- Rasterise all shapes and water that touch tile box [ri0..ri1]x[rj0..rj1] (null = whole world)
-- and store the result for exactly that box. Returns the number of non-empty tiles written.
create or replace function eldervale_private.tile_rebuild_region(ri0 integer default null,rj0 integer default null,ri1 integer default null,rj1 integer default null)
returns integer language plpgsql set search_path to '' as $fn$
declare n integer;whole boolean:=ri0 is null;
begin
 with sh as (
  select * from eldervale_private.tile_shape_boxes() b where whole or (b.i1>=ri0 and b.i0<=ri1 and b.j1>=rj0 and b.j0<=rj1)),
 hits as (
  select c.i,d.j,o.k,o.mask,(case
    when sh.shape='rect' then (case when abs(p.tx)<sh.hx and abs(p.tz)<sh.hz then 1 else 0 end)
    when sh.shape='circle' then (case when sqrt(p.tx*p.tx+p.tz*p.tz)<sh.hx then 1 else 0 end)
    when sh.shape='band' then (case when abs(p.tx)<2.17 and abs(p.tz)<2.09 and not(abs(p.tx)<1.65 and abs(p.tz)<1.57) then (case when abs(p.tx)<greatest(.49,1.25/sh.sx) and p.tz>1.2 then 2 else 1 end) else 0 end)
    when sh.shape='gate' then (case when abs(p.tz)<sh.hz and abs(p.tx)<sh.hx then (case when abs(p.tx)<=4.1 then 2 else 1 end) else 0 end)
    else 0 end) hit,sh.door,false water
  from sh
  cross join lateral generate_series(greatest(sh.i0,coalesce(ri0,sh.i0)),least(sh.i1,coalesce(ri1,sh.i1))) c(i)
  cross join lateral generate_series(greatest(sh.j0,coalesce(rj0,sh.j0)),least(sh.j1,coalesce(rj1,sh.j1))) d(j)
  cross join eldervale_private.tile_samples() o
  cross join lateral (select ((c.i+o.ox)*1.58-sh.cx) dx,((d.j+o.oz)*1.58-sh.cz) dz) q
  cross join lateral (select (q.dx*cos(sh.ang)-q.dz*sin(sh.ang))/sh.sx tx,(q.dx*sin(sh.ang)+q.dz*cos(sh.ang))/sh.sz tz) p),
 wet as (
  select c.i,d.j,o.k,o.mask,1 hit,null::text door,true water
  from eldervale_private.tile_water_boxes() w
  cross join lateral generate_series(greatest(w.i0,coalesce(ri0,w.i0)),least(w.i1,coalesce(ri1,w.i1))) c(i)
  cross join lateral generate_series(greatest(w.j0,coalesce(rj0,w.j0)),least(w.j1,coalesce(rj1,w.j1))) d(j)
  cross join eldervale_private.tile_samples() o
  where not w.passable and (whole or (w.i1>=ri0 and w.i0<=ri1 and w.j1>=rj0 and w.j0<=rj1))
   and point((c.i+o.ox)*1.58,(d.j+o.oz)*1.58)<@w.outline
   and not exists(select 1 from eldervale_private.realm_water b where b.passable and point((c.i+o.ox)*1.58,(d.j+o.oz)*1.58)<@b.outline)),
 per_sample as (
  select i,j,k,mask,bool_or(hit=1) st,bool_or(hit=1 and water) wt,min(door) filter(where hit=2) dr
  from (select i,j,k,mask,hit,door,water from hits where hit>0 union all select i,j,k,mask,hit,door,water from wet) h group by i,j,k,mask),
 computed as (
  select i,j,
   (bit_or(case when st then mask else 0 end)|bit_or(case when k=0 and st and wt then 32 when k=0 and st then 64 else 0 end))::smallint flags,
   coalesce(bit_or(case when not st and dr is not null then mask end),0)::smallint door_bits,
   min(dr) filter(where not st) door
  from per_sample group by i,j),
 up as (
  insert into eldervale_private.tile_flags(floor,i,j,flags,door_bits,door)
  select 0,i,j,flags,door_bits,(case when door_bits<>0 then door end) from computed where flags<>0 or door_bits<>0
  on conflict (floor,i,j) do update set flags=excluded.flags,door_bits=excluded.door_bits,door=excluded.door
  returning 1),
 cleared as (
  update eldervale_private.tile_flags t set flags=0,door_bits=0,door=null
  where t.floor=0 and (t.flags<>0 or t.door_bits<>0) and (whole or (t.i between ri0 and ri1 and t.j between rj0 and rj1))
   and not exists(select 1 from computed c where c.i=t.i and c.j=t.j and (c.flags<>0 or c.door_bits<>0))
  returning 1)
 select (select count(*) from up) into n;
 return n;
end $fn$;

-- Full rebuild: every tile, and a fresh source signature list.
create or replace function eldervale_private.tile_rebuild_all() returns jsonb language plpgsql set search_path to '' as $fn$
declare started timestamptz:=clock_timestamp();n integer;
begin
 n:=eldervale_private.tile_rebuild_region();
 insert into eldervale_private.tile_sources(src,sig,i0,j0,i1,j1,live,built_at)
  select src,sig,i0,j0,i1,j1,true,now() from eldervale_private.tile_shape_boxes()
  union all select src,sig,i0,j0,i1,j1,true,now() from eldervale_private.tile_water_boxes()
 on conflict (src) do update set sig=excluded.sig,i0=excluded.i0,j0=excluded.j0,i1=excluded.i1,j1=excluded.j1,live=true,built_at=excluded.built_at;
 update eldervale_private.tile_sources s set live=false where live and built_at<now();
 update eldervale_private.tick_engine set state=state||jsonb_build_object('grid_built_at',clock_timestamp(),'grid_tiles',n,'grid_ms',round((extract(epoch from clock_timestamp()-started)*1000)::numeric,1)) where id;
 return jsonb_build_object('tiles',n,'ms',round((extract(epoch from clock_timestamp()-started)*1000)::numeric,1));
end $fn$;

-- Incremental refresh: rebuild only the tile boxes of sources that appeared, moved, changed
-- shape or disappeared since the last build. Cheap when nothing changed (one signature scan).
create or replace function eldervale_private.tile_refresh() returns integer language plpgsql set search_path to '' as $fn$
declare r record;n integer:=0;
begin
 if not exists(select 1 from eldervale_private.tile_sources) then perform eldervale_private.tile_rebuild_all();return -1;end if;
 for r in
  with cur as (select src,sig,i0,j0,i1,j1 from eldervale_private.tile_shape_boxes() union all select src,sig,i0,j0,i1,j1 from eldervale_private.tile_water_boxes())
  select c.src csrc,c.sig csig,c.i0 ci0,c.j0 cj0,c.i1 ci1,c.j1 cj1,s.src ssrc,s.i0 si0,s.j0 sj0,s.i1 si1,s.j1 sj1,s.live
  from cur c full join eldervale_private.tile_sources s on s.src=c.src
  where (c.src is null and s.live) or (c.src is not null and (s.src is null or not s.live or c.sig<>s.sig))
 loop
  -- A changed bridge corridor or water outline also changes everything under it: its box covers that.
  if r.ssrc is not null and r.live then perform eldervale_private.tile_rebuild_region(r.si0,r.sj0,r.si1,r.sj1);end if;
  if r.csrc is not null then
   perform eldervale_private.tile_rebuild_region(r.ci0,r.cj0,r.ci1,r.cj1);
   insert into eldervale_private.tile_sources(src,sig,i0,j0,i1,j1,live,built_at) values(r.csrc,r.csig,r.ci0,r.cj0,r.ci1,r.cj1,true,now())
    on conflict (src) do update set sig=excluded.sig,i0=excluded.i0,j0=excluded.j0,i1=excluded.i1,j1=excluded.j1,live=true,built_at=excluded.built_at;
  else update eldervale_private.tile_sources set live=false where src=r.ssrc;end if;
  n:=n+1;
 end loop;
 if n>0 then update eldervale_private.tick_engine set state=state||jsonb_build_object('grid_refreshed_at',clock_timestamp(),'grid_dirty',n) where id;end if;
 return n;
end $fn$;

-- Effective flags of one tile (doors resolved against their current open state).
create or replace function eldervale_private.tile_flags_at(ti integer, tj integer) returns integer language sql stable set search_path to '' as $fn$
 select coalesce((select f.flags|(case when f.door_bits<>0 and not coalesce((select o.open from eldervale_private.realm_objects o where o.id=f.door),false) then f.door_bits else 0 end)
  from eldervale_private.tile_flags f where f.floor=0 and f.i=ti and f.j=tj),0)
$fn$;

-- Can a walker on tile (ti,tj) step to (ti+di,tj+dj)? (|di|,|dj| <= 1)
create or replace function eldervale_private.tile_can_move(ti integer, tj integer, di integer, dj integer) returns boolean language plpgsql stable set search_path to '' as $fn$
begin
 if di=0 and dj=0 then return true;end if;
 if abs(di)>1 or abs(dj)>1 then return false;end if;
 if eldervale_private.tile_flags_at(ti+di,tj+dj)&1<>0 then return false;end if;
 if dj=0 then return eldervale_private.tile_flags_at(least(ti,ti+di),tj)&2=0;end if;
 if di=0 then return eldervale_private.tile_flags_at(ti,least(tj,tj+dj))&4=0;end if;
 -- No corner cutting (OSRS): both orthogonal neighbours and the edges to them must be free.
 -- corner_cutting=true relaxes this to 'not both neighbours blocked' (diagonal edge still sampled).
 if coalesce((select (config->>'corner_cutting')::boolean from eldervale_private.tick_engine where id),false) then
  if (eldervale_private.tile_flags_at(ti+di,tj)&1<>0) and (eldervale_private.tile_flags_at(ti,tj+dj)&1<>0) then return false;end if;
 elsif not(eldervale_private.tile_can_move(ti,tj,di,0) and eldervale_private.tile_can_move(ti,tj,0,dj)) then return false;end if;
 if di=dj then return eldervale_private.tile_flags_at(least(ti,ti+di),least(tj,tj+dj))&8=0;end if;
 -- NW from (i,j) is stored on (i,j); SE from (i,j) is the NW move of (i+1,j-1).
 return eldervale_private.tile_flags_at(greatest(ti,ti+di),least(tj,tj+dj))&16=0;
end $fn$;

-- Breadth-first search on the tile grid, OSRS style: a (2*radius+1)^2 window around the start,
-- neighbours in the order W E S N SW SE NW NE. mode 'tile' ends on (gi,gj); 'card' ends on a tile
-- orthogonally next to (gi,gj) (talking, melee); 'near' ends on any tile whose centre is within
-- `reach` units of (px,pz) (objects, ranged attacks, fishing). When no goal is reachable the walker
-- goes to the reached tile closest to (px,pz), if it is within `alt` tiles of it (alt<0: any).
-- `bounded`: only tiles inside the tutorial courtyard (trainees). `strict`: no corner cutting.
-- Returns {"path":[[x,z],...] (tile centres after the start), "reached":bool, "nodes":visited}.
create or replace function eldervale_private.tile_route(si integer, sj integer, mode text, gi integer, gj integer, px double precision, pz double precision,
 reach double precision default 0, radius integer default 32, alt integer default 10, bounded boolean default false, strict boolean default true)
returns jsonb language plpgsql stable set search_path to '' as $fn$
declare w integer;n integer;ox integer;oz integer;fl integer[];prev integer[];queue integer[];head integer:=1;tail integer:=1;
 cur integer;ci integer;cj integer;wi integer;wj integer;ni integer;nj integer;idx integer;d integer;di integer;dj integer;f integer;
 found integer:=-1;best integer:=-1;bestd numeric;dd numeric;tpx numeric:=round((px/1.58)::numeric,6);tpz numeric:=round((pz/1.58)::numeric,6);r record;path jsonb:='[]'::jsonb;k integer;steps integer:=0;
 dis integer[]:=array[-1,1,0,0,-1,1,-1,1];djs integer[]:=array[0,0,-1,1,-1,-1,1,1];
begin
 radius:=greatest(2,least(64,coalesce(radius,32)));w:=2*radius+1;n:=w*w;ox:=si-radius;oz:=sj-radius;
 fl:=array_fill(0,array[n]);prev:=array_fill(-1,array[n]);queue:=array_fill(0,array[n]);
 for r in select f2.i,f2.j,f2.flags|(case when f2.door_bits<>0 and not coalesce(o.open,false) then f2.door_bits else 0 end) e
  from eldervale_private.tile_flags f2 left join eldervale_private.realm_objects o on o.id=f2.door
  where f2.floor=0 and f2.i between ox and ox+w-1 and f2.j between oz and oz+w-1 and (f2.flags<>0 or f2.door_bits<>0) loop
  fl[(r.j-oz)*w+(r.i-ox)+1]:=r.e;
 end loop;
 if bounded then
  for k in 0..n-1 loop
   if not eldervale_private.tutorial_inside((ox+k%w)*1.58,(oz+k/w)*1.58) then fl[k+1]:=fl[k+1]|1;end if;
  end loop;
 end if;
 cur:=radius*w+radius;prev[cur+1]:=cur;queue[1]:=cur;
 while head<=tail loop
  cur:=queue[head];head:=head+1;ci:=cur%w;cj:=cur/w;wi:=ci+ox;wj:=cj+oz;
  if (mode='tile' and wi=gi and wj=gj) or (mode='card' and abs(wi-gi)+abs(wj-gj)=1)
   or (mode='near' and power(wi*1.58-px,2)+power(wj*1.58-pz,2)<=reach*reach) then found:=cur;exit;end if;
  dd:=(wi-tpx)*(wi-tpx)+(wj-tpz)*(wj-tpz);
  if best<0 or dd<bestd then best:=cur;bestd:=dd;end if;
  for d in 1..8 loop
   di:=dis[d];dj:=djs[d];ni:=ci+di;nj:=cj+dj;
   if ni<0 or nj<0 or ni>=w or nj>=w then continue;end if;
   idx:=nj*w+ni;
   if prev[idx+1]>=0 or fl[idx+1]&1<>0 then continue;end if;
   if dj=0 then f:=fl[cj*w+least(ci,ni)+1]&2;
   elsif di=0 then f:=fl[least(cj,nj)*w+ci+1]&4;
   elsif fl[cj*w+ni+1]&1<>0 and fl[nj*w+ci+1]&1<>0 then f:=1;
   elsif strict and (fl[cj*w+ni+1]&1<>0 or fl[nj*w+ci+1]&1<>0 or fl[cj*w+least(ci,ni)+1]&2<>0 or fl[least(cj,nj)*w+ci+1]&4<>0) then f:=1;
   elsif di=dj then f:=fl[least(cj,nj)*w+least(ci,ni)+1]&8;
   else f:=fl[least(cj,nj)*w+greatest(ci,ni)+1]&16;end if;
   if f<>0 then continue;end if;
   prev[idx+1]:=cur;tail:=tail+1;queue[tail]:=idx;
  end loop;
 end loop;
 if found<0 then
  if best>=0 and (alt<0 or bestd<=alt*alt) then found:=best;end if;
  if found=radius*w+radius or found<0 then return jsonb_build_object('path','[]'::jsonb,'reached',false,'nodes',tail);end if;
 end if;
 k:=found;
 while k<>radius*w+radius and steps<n loop
  path:=jsonb_build_array(jsonb_build_array(eldervale_private.tile_center(k%w+ox),eldervale_private.tile_center(k/w+oz)))||path;
  k:=prev[k+1];steps:=steps+1;
 end loop;
 return jsonb_build_object('path',path,'reached',found<>best or (mode='tile' and found%w+ox=gi and found/w+oz=gj),'nodes',tail);
end $fn$;

-- Game console: tick/engine settings, grid rebuild and the tile overlay data.
create or replace function eldervale_private.engine_console(command text, payload jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $fn$
declare cfg jsonb;patch jsonb;k text;v jsonb;r jsonb;x float8;z float8;rad integer;ti integer;tj integer;
begin
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if command='console_engine' then
  return jsonb_build_object('config',eldervale_private.engine_config(),'state',(select state from eldervale_private.tick_engine where id),
   'tiles',(select jsonb_build_object('rows',count(*),'blocked',count(*) filter(where flags&1<>0),'doors',count(*) filter(where door_bits<>0)) from eldervale_private.tile_flags where floor=0 and (flags<>0 or door_bits<>0)),
   'sources',(select count(*) from eldervale_private.tile_sources where live),'tileSize',eldervale_private.tile_size());
 elsif command='console_engine_set' then
  patch:=coalesce(payload->'config',payload);
  if jsonb_typeof(patch)<>'object' then raise exception 'Send the settings to change';end if;
  for k,v in select key,value from jsonb_each(patch) loop
   if k in('tile_mode','run_default','overlay','corner_cutting') then if jsonb_typeof(v)<>'boolean' then raise exception '% must be on or off',k;end if;
   elsif k='tick_driver' then if v#>>'{}' not in('inline','loop') then raise exception 'tick_driver is inline or loop';end if;
   elsif k in('path_radius','alt_radius','grid_check_ticks','talk_face_ticks','max_catchup_ticks') then
    if jsonb_typeof(v)<>'number' or (v#>>'{}')::numeric<>trunc((v#>>'{}')::numeric)
     or (v#>>'{}')::integer<(case k when 'path_radius' then 8 when 'talk_face_ticks' then 1 when 'max_catchup_ticks' then 1 else 0 end)
     or (v#>>'{}')::integer>(case k when 'path_radius' then 64 when 'alt_radius' then 32 when 'grid_check_ticks' then 1000 when 'talk_face_ticks' then 100 else 5 end)
    then raise exception 'Invalid value for %',k;end if;
   else raise exception 'Unknown engine setting %',k;end if;
  end loop;
  select config into cfg from eldervale_private.tick_engine where id for update;
  update eldervale_private.tick_engine set config=coalesce(cfg,'{}'::jsonb)||patch,updated_at=now() where id;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,'tick_engine',cfg,patch);
  return jsonb_build_object('config',eldervale_private.engine_config());
 elsif command='console_tiles_rebuild' then
  perform pg_advisory_xact_lock(736211);
  r:=eldervale_private.tile_rebuild_all();
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,'tile_flags',null,r);
  return r;
 elsif command='console_tiles_view' then
  x:=(payload->>'x')::float8;z:=(payload->>'z')::float8;rad:=least(30,greatest(1,coalesce((payload->>'radius')::integer,16)));
  if x is null or z is null or abs(x)>4500 or abs(z)>4500 then raise exception 'Choose a point';end if;
  ti:=eldervale_private.tile_of(x);tj:=eldervale_private.tile_of(z);
  return jsonb_build_object('tileSize',eldervale_private.tile_size(),'center',jsonb_build_array(ti,tj),'tiles',coalesce((
   select jsonb_agg(jsonb_build_array(f.i,f.j,f.flags|(case when f.door_bits<>0 and not coalesce(o.open,false) then f.door_bits else 0 end),f.door_bits))
   from eldervale_private.tile_flags f left join eldervale_private.realm_objects o on o.id=f.door
   where f.floor=0 and f.i between ti-rad and ti+rad and f.j between tj-rad and tj+rad and (f.flags<>0 or f.door_bits<>0)),'[]'::jsonb));
 end if;
 raise exception 'Unknown console command';
end $fn$;

-- Route the new console commands (owner check already done by admin_console).
do $console$
declare body text:=pg_get_functiondef('eldervale_private.admin_console(text,jsonb)'::regprocedure);
begin
 if position('eldervale_private.engine_console(command,payload)' in body)>0 then return;end if;
 perform eldervale_private.patch_function('eldervale_private.admin_console(text,jsonb)'::regprocedure,array[
  ' if command=''console_give_xp'' then',
  ' if command in (''console_engine'',''console_engine_set'',''console_tiles_rebuild'',''console_tiles_view'') then return eldervale_private.engine_console(command,payload);end if;'||chr(10)||' if command=''console_give_xp'' then']);
end $console$;

commit;
