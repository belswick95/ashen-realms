-- Eldervale tick & tile engine, stage 2: players walk on tiles. APPLY AFTER tick-tile-engine-1-grid.sql.
-- Idempotent; safe on a running game. With tile_mode off (the default) the only visible changes
-- are cosmetic and mode-independent: an NPC turns to face the player who talks to it (and turns
-- back afterwards), the player faces what they just used, and replies carry a few extra keys that
-- old clients ignore. With tile_mode on (Game console -> World -> Tick & tile engine):
--  * Ground-floor players stand on tile centres. Each 600 ms game tick (global, epoch-aligned:
--    tick n starts at n*0.6 s) a walker steps 1 tile, a runner 2, a rider 3. Movement depends only on
--    the tick count, so it is identical whether the tick runs from pg_cron, a request or the loop.
--  * 'move' is planned on the server with the stage-1 BFS: to the clicked tile (nearest reachable
--    within 10 tiles when blocked), orthogonally next to an NPC (talk, melee), within weapon range
--    (ranged), or onto a tile that reaches an object (never into it). Long map clicks walk in legs
--    along the client's waypoints. Moving targets are re-planned every tick (OSRS following).
--    Old clients keep working: their client-computed path only supplies the destination/waypoints.
--  * WASD/arrow steering moves one tile per tick in the 8-way input direction (sliding along walls).
--  * Arriving players face their target (NPC, object, gathering spot, skilling station, fire).
--  * Upper stories keep the old free movement.
-- Requires: patch_function (admin-console.sql), perf-tick-fix.sql, tick-tile-engine-1-grid.sql.
begin;
set local lock_timeout='5s';

create table if not exists eldervale_private.tile_walkers(
 user_id uuid primary key, step_tiles smallint not null default 0, route jsonb not null default '[]'::jsonb,
 goal jsonb, updated_at timestamptz not null default now());
-- An NPC that turned to face a talker, and the facing it returns to afterwards.
create table if not exists eldervale_private.actor_faces(
 id text primary key, restore_yaw double precision, until timestamptz not null, active boolean not null default true);

-- Global 600 ms ticks: tick n covers [n*0.6 s, (n+1)*0.6 s) since the epoch.
create or replace function eldervale_private.tick_no(t timestamptz) returns bigint language sql immutable as $fn$select floor(extract(epoch from t)/0.6)::bigint$fn$;
create or replace function eldervale_private.tick_time(n bigint) returns timestamptz language sql immutable as $fn$select to_timestamp(n*0.6)$fn$;

-- Collision footprint radius (units, before scale) used to find the tiles that reach an object.
create or replace function eldervale_private.tile_object_radius(kind text, d jsonb) returns double precision language sql immutable as $fn$
 select (case coalesce(d->>'template',kind)
  when 'tree' then .9 when 'pine' then .9 when 'rock' then 1.3 when 'fountain' then 2.1 when 'well' then 1.4
  when 'furnace' then 1.4 when 'workbench' then 1.4 when 'thieving_stall' then 1.4 when 'market' then 1.55 when 'bench' then 1.35
  when 'crate' then .9 when 'barrel' then .8 when 'anvil' then 1.0 when 'spinning_wheel' then 1.0 when 'tanning_rack' then 1.0
  when 'mill' then 1.0 when 'rune_altar' then 1.0 when 'practice_chest' then 1.0 when 'essence_rock' then 1.0 when 'construction_site' then 1.0
  when 'altar' then 1.0 when 'hearth' then 1.0 when 'campfire' then .85 when 'cooking_tripod' then .75 when 'chest' then .8 else .6 end)
  *coalesce((d->>'scale')::float8,1)
$fn$;
-- How close the server lets a player be to use an object (the existing checks), in units.
create or replace function eldervale_private.tile_object_base_reach(kind text, d jsonb) returns double precision language sql immutable as $fn$
 select (case when kind in('door','castle_gate') then 7 when kind='tree' then 3.5 when kind in('fishing','rock') then 4
  when coalesce(d->>'template','') in('furnace','anvil','workbench','spinning_wheel','tanning_rack','mill','rune_altar','thieving_stall','practice_chest','essence_rock','construction_site','well','fountain','hearth','campfire','cooking_tripod','altar') then 4 else 3 end)::float8
$fn$;
-- Tiles whose centre is within this distance of the object's centre can use it: the tiles that
-- touch its footprint (one tile out), never more than the existing server reach allows.
create or replace function eldervale_private.tile_object_reach(kind text, d jsonb) returns double precision language sql immutable as $fn$
 select (case when kind in('door','castle_gate') then 6.5 when kind='fishing' then 3.6
  else least(eldervale_private.tile_object_base_reach(kind,d)-.15,eldervale_private.tile_object_radius(kind,d)+1.58*.75) end)
$fn$;
-- world_tick's generic object reach (3 units, 7 for doors) plus what a tile walker standing next to
-- a large object (fountain, market) needs. 0 while tile mode is off.
create or replace function eldervale_private.tile_reach_bonus(kind text, d jsonb) returns double precision language sql stable as $fn$
 select (case when eldervale_private.tile_mode() then greatest(0,eldervale_private.tile_object_reach(kind,d)+.1-(case when kind in('door','castle_gate') then 7 else 3 end)) else 0 end)
$fn$;

-- Where a walker must end up to act on `target` (an actor or an object), as a tile_route goal.
create or replace function eldervale_private.tile_target_goal(uid uuid, target_id text, kind text, px double precision, pz double precision)
returns jsonb language plpgsql stable set search_path to '' as $fn$
declare a eldervale_private.realm_actors;o eldervale_private.realm_objects;range float8;weapon text;
begin
 if target_id is null then return null;end if;
 select * into a from eldervale_private.realm_actors where id=target_id and not deleted;
 if found then
  if kind='creature' then
   select equipment->>'weapon' into weapon from public.player_saves where user_id=uid;
   range:=eldervale_private.attack_range(weapon);
   if range>3 then return jsonb_build_object('actor',a.id,'mode','near','gi',eldervale_private.tile_of(a.x),'gj',eldervale_private.tile_of(a.z),'px',a.x,'pz',a.z,'reach',range-.1);end if;
  end if;
  return jsonb_build_object('actor',a.id,'mode','card','gi',eldervale_private.tile_of(a.x),'gj',eldervale_private.tile_of(a.z),'px',a.x,'pz',a.z,'reach',0);
 end if;
 select * into o from eldervale_private.realm_objects where id=target_id;
 if found then
  return jsonb_build_object('object',o.id,'mode','near','gi',eldervale_private.tile_of(o.x),'gj',eldervale_private.tile_of(o.z),'px',o.x,'pz',o.z,'reach',eldervale_private.tile_object_reach(o.kind,o.data));
 end if;
 return null;
end $fn$;

-- One leg of a long walk: BFS to the first waypoint, or toward it when it is beyond the window.
-- Returns {path, route} (route = waypoints still ahead after this leg).
create or replace function eldervale_private.tile_plan_leg(ci integer, cj integer, route jsonb, radius integer, bounded boolean)
returns jsonb language plpgsql stable set search_path to '' as $fn$
declare gx float8;gz float8;gi integer;gj integer;far integer;f float8;r jsonb;
begin
 if route is null or jsonb_typeof(route)<>'array' or jsonb_array_length(route)=0 then return jsonb_build_object('path','[]'::jsonb,'route','[]'::jsonb);end if;
 gx:=(route->0->>0)::float8;gz:=(route->0->>1)::float8;gi:=eldervale_private.tile_of(gx);gj:=eldervale_private.tile_of(gz);
 far:=greatest(abs(gi-ci),abs(gj-cj));
 if far<=radius-1 then
  r:=eldervale_private.tile_route(ci,cj,'tile',gi,gj,gi*1.58,gj*1.58,0,radius,(case when jsonb_array_length(route)>1 then -1 else 10 end),bounded);
  return jsonb_build_object('path',r->'path','route',route-0);
 end if;
 -- Beyond the search window: walk toward it (the closest reachable tile), keep it as the next leg.
 f:=(radius-1)::float8/far;gi:=ci+round((gi-ci)*f)::integer;gj:=cj+round((gj-cj)*f)::integer;
 r:=eldervale_private.tile_route(ci,cj,'tile',gi,gj,gi*1.58,gj*1.58,0,radius,-1,bounded);
 return jsonb_build_object('path',r->'path','route',route);
end $fn$;

-- 'move' on tiles: plan from the player's tile. payload: target/kind (as today), `to` [x,z]
-- (new clients) or `path` (the waypoints every client sends; the last one is the destination).
create or replace function eldervale_private.tile_plan_move(uid uuid, payload jsonb) returns void
language plpgsql security definer set search_path to '' as $fn$
declare p eldervale_private.realm_players;cfg jsonb:=eldervale_private.engine_config();radius integer;alt integer;bounded boolean;
 g jsonb;r jsonb;route jsonb:='[]'::jsonb;ci integer;cj integer;w jsonb;k integer;
begin
 select * into p from eldervale_private.realm_players where user_id=uid for update;
 if not found or p.floor<>0 then return;end if;
 radius:=coalesce((cfg->>'path_radius')::integer,32);alt:=coalesce((cfg->>'alt_radius')::integer,10);bounded:=eldervale_private.tutorial_locked(uid);
 ci:=eldervale_private.tile_of(p.x);cj:=eldervale_private.tile_of(p.z);
 g:=eldervale_private.tile_target_goal(uid,payload->>'target',payload->>'kind',p.x,p.z);
 if g is not null then
  r:=eldervale_private.tile_route(ci,cj,g->>'mode',(g->>'gi')::integer,(g->>'gj')::integer,(g->>'px')::float8,(g->>'pz')::float8,(g->>'reach')::float8,radius,alt,bounded);
  p.path:=r->'path';
 else
  if jsonb_typeof(payload->'to')='array' and jsonb_array_length(payload->'to')=2 then route:=jsonb_build_array(payload->'to');
  elsif jsonb_typeof(payload->'path')='array' then
   -- Client waypoints: keep only the turning points that matter, at most 32 legs.
   for k in 0..least(jsonb_array_length(payload->'path'),128)-1 loop
    w:=payload->'path'->k;
    if jsonb_typeof(w)='array' and jsonb_array_length(w)=2 then route:=route||jsonb_build_array(jsonb_build_array((w->>0)::float8,(w->>1)::float8));end if;
   end loop;
   -- Skip intermediate waypoints that are inside the first search window (the BFS finds its own way).
   while jsonb_array_length(route)>1 and greatest(abs(eldervale_private.tile_of((route->1->>0)::float8)-ci),abs(eldervale_private.tile_of((route->1->>1)::float8)-cj))<=radius-1 loop
    route:=route-0;
   end loop;
  end if;
  r:=eldervale_private.tile_plan_leg(ci,cj,route,radius,bounded);
  p.path:=r->'path';route:=r->'route';
 end if;
 update eldervale_private.realm_players set path=coalesce(p.path,'[]'::jsonb) where user_id=uid;
 insert into eldervale_private.tile_walkers(user_id,route,goal,step_tiles,updated_at)
  values(uid,route,g,(case when jsonb_array_length(coalesce(p.path,'[]'::jsonb))=0 then 0 when eldervale_private.mounted(uid,p.x,p.z) then 3 when p.run and p.energy>0 then 2 else 1 end),now())
  on conflict (user_id) do update set route=excluded.route,goal=excluded.goal,step_tiles=excluded.step_tiles,updated_at=excluded.updated_at;
end $fn$;

-- Yaw toward an actor, object, fire or player id (falls back to `fallback`).
create or replace function eldervale_private.tile_face_target(px double precision, pz double precision, target_id text, fallback double precision)
returns double precision language plpgsql stable set search_path to '' as $fn$
declare tx float8;tz float8;
begin
 if target_id is null then return fallback;end if;
 select x,z into tx,tz from eldervale_private.realm_actors where id=target_id;
 if tx is null then select x,z into tx,tz from eldervale_private.realm_objects where id=target_id;end if;
 if tx is null and target_id like 'fire:%' then select x,z into tx,tz from eldervale_private.skill_fires where id::text=substring(target_id from 6);end if;
 if tx is null and target_id ~ '^[0-9a-f-]{36}$' then select x,z into tx,tz from eldervale_private.realm_players where user_id=target_id::uuid;end if;
 return eldervale_private.face_yaw(px,pz,tx,tz,fallback);
end $fn$;

-- An NPC turns to the player who talks to it, holds still for talk_face_ticks, then turns back
-- (actor_faces) and resumes roaming. The player turns to the NPC.
create or replace function eldervale_private.tile_face_talk(uid uuid, actor_id text) returns void
language plpgsql security definer set search_path to '' as $fn$
declare a eldervale_private.realm_actors;px float8;pz float8;until_at timestamptz;
begin
 select * into a from eldervale_private.realm_actors where id=actor_id and not deleted;
 select x,z into px,pz from eldervale_private.realm_players where user_id=uid;
 if a.id is null or px is null then return;end if;
 until_at:=clock_timestamp()+coalesce((eldervale_private.engine_config()->>'talk_face_ticks')::integer,14)*interval '600 milliseconds';
 update eldervale_private.realm_players set yaw=eldervale_private.face_yaw(px,pz,a.x,a.z,yaw) where user_id=uid;
 if a.target is not null then return;end if;
 insert into eldervale_private.actor_faces(id,restore_yaw,until,active) values(a.id,a.yaw,until_at,true)
  on conflict (id) do update set restore_yaw=(case when eldervale_private.actor_faces.active then eldervale_private.actor_faces.restore_yaw else excluded.restore_yaw end),until=excluded.until,active=true;
 update eldervale_private.realm_actors set yaw=eldervale_private.face_yaw(x,z,px,pz,yaw),roam_pause_until=greatest(coalesce(roam_pause_until,until_at),until_at) where id=a.id;
end $fn$;

-- Start of every world tick: NPCs whose conversation ended turn back (both modes), and in tile
-- mode the grid is refreshed every grid_check_ticks ticks. Stage 3 extends this.
create or replace function eldervale_private.engine_tick_begin(t timestamptz) returns void
language plpgsql security definer set search_path to '' as $fn$
declare cfg jsonb;every integer;
begin
 if exists(select 1 from eldervale_private.actor_faces where active and until<=t) then
  update eldervale_private.realm_actors a set yaw=f.restore_yaw from eldervale_private.actor_faces f where f.id=a.id and f.active and f.until<=t and a.target is null and f.restore_yaw is not null;
  update eldervale_private.actor_faces set active=false where active and until<=t;
 end if;
 cfg:=eldervale_private.engine_config();
 if coalesce((cfg->>'tile_mode')::boolean,false) then
  every:=coalesce((cfg->>'grid_check_ticks')::integer,10);
  if every>0 and eldervale_private.tick_no(t)%every=0 then perform eldervale_private.tile_refresh();end if;
 end if;
end $fn$;

-- The facing of an idle tile walker: its interaction target, else what it is gathering/making.
create or replace function eldervale_private.tile_idle_yaw(uid uuid, px double precision, pz double precision, intent jsonb, fallback double precision)
returns double precision language plpgsql stable set search_path to '' as $fn$
declare target text;
begin
 target:=intent->>'target';
 if target is null then select g.target into target from eldervale_private.gathering_actions g where g.user_id=uid;end if;
 if target is null then select j.target into target from eldervale_private.skill_jobs j where j.user_id=uid and j.target is not null;end if;
 return eldervale_private.tile_face_target(px,pz,target,fallback);
end $fn$;

-- Tile movement for one player up to `at_time` (called by advance_player_motion in tile mode).
create or replace function eldervale_private.advance_player_tiles(player_id uuid, at_time timestamptz default clock_timestamp())
returns eldervale_private.realm_players language plpgsql security definer set search_path to '' as $fn$
declare p eldervale_private.realm_players;w eldervale_private.tile_walkers;cfg jsonb:=eldervale_private.engine_config();
 now_tick bigint;last_tick bigint;n integer;k integer;s integer;steps integer:=1;ci integer;cj integer;ni integer;nj integer;di integer;dj integer;
 riding boolean;manual boolean;moved boolean;moved_any boolean:=false;had_path boolean;replanned boolean:=false;bounded boolean;
 radius integer;r jsonb;a eldervale_private.realm_actors;g jsonb;ai integer;aj integer;ei integer;ej integer;
begin
 select * into p from eldervale_private.realm_players where user_id=player_id for update;
 if not found then return null;end if;
 now_tick:=eldervale_private.tick_no(at_time);last_tick:=eldervale_private.tick_no(p.motion_at);
 n:=least(now_tick-last_tick,1+coalesce((cfg->>'max_catchup_ticks')::integer,2));
 if n<=0 then return p;end if;
 select * into w from eldervale_private.tile_walkers where user_id=player_id for update;
 if not found then
  insert into eldervale_private.tile_walkers(user_id) values(player_id) returning * into w;
  if coalesce((cfg->>'run_default')::boolean,false) then p.run:=p.energy>=5;end if;
 end if;
 radius:=coalesce((cfg->>'path_radius')::integer,32);bounded:=eldervale_private.tutorial_locked(player_id);
 perform eldervale_private.motion_story(p.floor,p.building);
 riding:=eldervale_private.mounted(player_id,p.x,p.z);if riding then p.run:=false;end if;
 manual:=p.input_until is not null and p.input_until>eldervale_private.tick_time(last_tick) and abs(p.input_x)+abs(p.input_z)>.001;
 ci:=eldervale_private.tile_of(p.x);cj:=eldervale_private.tile_of(p.z);
 had_path:=jsonb_array_length(p.path)>0;
 if manual then p.path:='[]';p.intent:=null;w.route:='[]';w.goal:=null;
 elsif not had_path then w.route:='[]';end if; -- stopped from elsewhere (stop, combat, teleport): no more legs
 -- A target that is no longer the player's intent is not followed.
 g:=w.goal;if g is not null and (p.intent is null or p.intent->>'target' is distinct from coalesce(g->>'actor',g->>'object')) then g:=null;w.goal:=null;end if;
 for k in 1..n loop
  steps:=(case when riding and eldervale_private.mount_allowed(p.x,p.z) then 3 when p.run and p.energy>0 then 2 else 1 end);
  moved:=false;
  -- Follow a moving actor: re-plan when the path no longer ends next to (or in range of) it.
  if not manual and g is not null and g ? 'actor' then
   select * into a from eldervale_private.realm_actors where id=g->>'actor' and not deleted;
   if a.id is null or a.hp<=0 then g:=null;w.goal:=null;
   else
    ai:=eldervale_private.tile_of(a.x);aj:=eldervale_private.tile_of(a.z);
    ei:=coalesce(eldervale_private.tile_of((p.path->-1->>0)::float8),ci);ej:=coalesce(eldervale_private.tile_of((p.path->-1->>1)::float8),cj);
    if not((g->>'mode'='card' and abs(ei-ai)+abs(ej-aj)=1) or (g->>'mode'='near' and power(ei*1.58-a.x,2)+power(ej*1.58-a.z,2)<=power((g->>'reach')::float8,2))) then
     r:=eldervale_private.tile_route(ci,cj,g->>'mode',ai,aj,a.x,a.z,(g->>'reach')::float8,least(radius,24),coalesce((cfg->>'alt_radius')::integer,10),bounded);
     p.path:=r->'path';had_path:=true;
    end if;
   end if;
  end if;
  for s in 1..steps loop
   if manual then
    di:=(case when p.input_x>.38 then 1 when p.input_x<-.38 then -1 else 0 end);dj:=(case when p.input_z>.38 then 1 when p.input_z<-.38 then -1 else 0 end);
    exit when di=0 and dj=0;
    if not eldervale_private.tile_can_move(ci,cj,di,dj) then
     -- Slide along walls like the free walker did: try the larger axis, then the other.
     if di<>0 and dj<>0 and abs(p.input_x)>=abs(p.input_z) and eldervale_private.tile_can_move(ci,cj,di,0) then dj:=0;
     elsif di<>0 and dj<>0 and eldervale_private.tile_can_move(ci,cj,0,dj) then di:=0;
     elsif di<>0 and dj<>0 and eldervale_private.tile_can_move(ci,cj,di,0) then dj:=0;
     else exit;end if;
    end if;
   else
    if jsonb_array_length(p.path)=0 then
     exit when jsonb_array_length(w.route)=0 or not had_path;
     r:=eldervale_private.tile_plan_leg(ci,cj,w.route,radius,bounded);p.path:=r->'path';w.route:=r->'route';
     exit when jsonb_array_length(p.path)=0;
    end if;
    ni:=eldervale_private.tile_of((p.path->0->>0)::float8);nj:=eldervale_private.tile_of((p.path->0->>1)::float8);
    di:=ni-ci;dj:=nj-cj;
    if di=0 and dj=0 then p.path:=p.path-0;continue;end if;
    if abs(di)>1 or abs(dj)>1 or not eldervale_private.tile_can_move(ci,cj,di,dj) then
     -- A door closed or the path is not a tile path: plan again to its end, once per call.
     if replanned then p.path:='[]';exit;end if;
     replanned:=true;
     r:=eldervale_private.tile_route(ci,cj,'tile',eldervale_private.tile_of((p.path->-1->>0)::float8),eldervale_private.tile_of((p.path->-1->>1)::float8),(p.path->-1->>0)::float8,(p.path->-1->>1)::float8,0,radius,coalesce((cfg->>'alt_radius')::integer,10),bounded);
     p.path:=r->'path';
     exit when jsonb_array_length(p.path)=0;
     ni:=eldervale_private.tile_of((p.path->0->>0)::float8);nj:=eldervale_private.tile_of((p.path->0->>1)::float8);di:=ni-ci;dj:=nj-cj;
     if abs(di)>1 or abs(dj)>1 or (di=0 and dj=0) or not eldervale_private.tile_can_move(ci,cj,di,dj) then p.path:='[]';exit;end if;
    end if;
    p.path:=p.path-0;
   end if;
   ci:=ci+di;cj:=cj+dj;moved:=true;p.yaw:=atan2(di,dj);
   -- Leg finished: plan the next one now, so the walk never pauses between legs.
   if not manual and jsonb_array_length(p.path)=0 and jsonb_array_length(w.route)>0 then
    r:=eldervale_private.tile_plan_leg(ci,cj,w.route,radius,bounded);p.path:=r->'path';w.route:=r->'route';
    if jsonb_array_length(p.path)=0 then w.route:='[]';end if;
   end if;
  end loop;
  if moved then moved_any:=true;end if;
  p.energy:=greatest(0,least(100,p.energy+(case when riding then 0 when moved and steps>1 then -3 when moved then .9 else 1.8 end)));
  if p.energy=0 then p.run:=false;end if;
 end loop;
 if moved_any then p.x:=eldervale_private.tile_center(ci);p.z:=eldervale_private.tile_center(cj);end if;
 if manual then p.yaw:=p.input_yaw;
 elsif jsonb_array_length(p.path)=0 and jsonb_array_length(w.route)=0 then p.yaw:=eldervale_private.tile_idle_yaw(player_id,p.x,p.z,p.intent,p.yaw);end if;
 if p.input_until is not null and p.input_until<=at_time then p.input_until:=null;p.input_x:=0;p.input_z:=0;end if;
 update eldervale_private.realm_players set x=p.x,z=p.z,yaw=p.yaw,path=p.path,intent=p.intent,energy=p.energy,run=p.run,input_until=p.input_until,input_x=p.input_x,input_z=p.input_z,motion_at=eldervale_private.tick_time(now_tick) where user_id=player_id returning * into p;
 update eldervale_private.tile_walkers set step_tiles=(case when jsonb_array_length(p.path)>0 or jsonb_array_length(w.route)>0 or manual then steps else 0 end),route=w.route,goal=w.goal,updated_at=now() where user_id=player_id;
 update public.player_saves set world_position=world_position||jsonb_build_object('x',p.x,'y',p.z,'floor',p.floor,'building',p.building),game_flags=game_flags||jsonb_build_object('runEnergy',p.energy),level=eldervale_private.combat_level(skills) where user_id=player_id;
 return p;
end $fn$;

-- Extra reply keys for the client (tile mode only): how a walker is presented.
create or replace function eldervale_private.tile_motion_json(uid uuid) returns jsonb language sql stable set search_path to '' as $fn$
 select (case when eldervale_private.tile_mode() then jsonb_build_object('tile',true,'tileSize',1.58,'tickMs',600,
  'stepTiles',coalesce((select step_tiles from eldervale_private.tile_walkers where user_id=uid),0)) else '{}'::jsonb end)
$fn$;
create or replace function eldervale_private.tile_step_tiles(uid uuid) returns integer language sql stable set search_path to '' as $fn$
 select (case when eldervale_private.tile_mode() then coalesce((select step_tiles from eldervale_private.tile_walkers where user_id=uid),0) end)
$fn$;

-- Turning tile mode on builds the grid first if it has never been built.
create or replace function eldervale_private.engine_console_ensure_grid() returns void language plpgsql set search_path to '' as $fn$
begin
 if eldervale_private.tile_mode() and not exists(select 1 from eldervale_private.tile_sources) then perform eldervale_private.tile_rebuild_all();end if;
end $fn$;
do $console$
declare body text:=pg_get_functiondef('eldervale_private.engine_console(text,jsonb)'::regprocedure);
begin
 if position('engine_console_ensure_grid()' in body)>0 then return;end if;
 perform eldervale_private.patch_function('eldervale_private.engine_console(text,jsonb)'::regprocedure,array[
  '  return jsonb_build_object(''config'',eldervale_private.engine_config());',
  '  perform eldervale_private.engine_console_ensure_grid();'||chr(10)||'  return jsonb_build_object(''config'',eldervale_private.engine_config());']);
end $console$;

-- Live patches. Each edit is skipped once present; each anchor must match the live text exactly once.
do $patch$
declare fn text;old text;new text;body text;
begin
 for fn,old,new in select e->>0,e->>1,e->>2 from jsonb_array_elements($edits$[
  ["eldervale_private.advance_player_motion(uuid,timestamp with time zone)",
   " if dt<=0 then return p;end if;\n",
   " if dt<=0 then return p;end if;\n if p.floor=0 and eldervale_private.tile_mode() then return eldervale_private.advance_player_tiles(player_id,at_time);end if;\n"],
  ["eldervale_private.realm_request_base(uuid,text,jsonb,uuid,bigint)",
   "'attack' else 'interact' end) end where user_id=auth.uid();\n",
   "'attack' else 'interact' end) end where user_id=auth.uid();\n  if p.floor=0 and eldervale_private.tile_mode() then perform eldervale_private.tile_plan_move(auth.uid(),payload);end if;\n"],
  ["eldervale_private.realm_request_base(uuid,text,jsonb,uuid,bigint)",
   "elsif command='stop' then update eldervale_private.realm_players set path='[]',intent=null where user_id=auth.uid();",
   "elsif command='stop' then update eldervale_private.realm_players set path='[]',intent=null where user_id=auth.uid();update eldervale_private.tile_walkers set route='[]',goal=null where user_id=auth.uid();"],
  ["eldervale_private.realm_request_base(uuid,text,jsonb,uuid,bigint)",
   "'motion',to_jsonb(p),",
   "'motion',to_jsonb(p)||eldervale_private.tile_motion_json(p.user_id),"],
  ["eldervale_private.realm_request_base(uuid,text,jsonb,uuid,bigint)",
   "'run',r.run,",
   "'run',r.run,'at',r.motion_at,'stepTiles',eldervale_private.tile_step_tiles(r.user_id),"],
  ["eldervale_private.world_tick()",
   "<(case when o.kind in ('door','castle_gate') then 7 else 3 end) then",
   "<(case when o.kind in ('door','castle_gate') then 7 else 3 end)+eldervale_private.tile_reach_bonus(o.kind,o.data) then"],
  ["eldervale_private.world_tick()",
   "else perform eldervale_private.emit(jsonb_build_object('type','interaction','player',p.user_id,'target',sid,'kind','npc'));",
   "else perform eldervale_private.tile_face_talk(p.user_id,sid);perform eldervale_private.emit(jsonb_build_object('type','interaction','player',p.user_id,'target',sid,'kind','npc'));"],
  ["eldervale_private.world_tick()",
   "update eldervale_private.realm_players set intent=p.intent,path=p.path where user_id=p.user_id;",
   "update eldervale_private.realm_players set intent=p.intent,path=p.path,yaw=(case when p.intent is null and sid is not null then eldervale_private.tile_face_target(p.x,p.z,sid,yaw) else yaw end) where user_id=p.user_id;"],
  ["eldervale_private.world_tick()",
   "update eldervale_private.realm_clock set tick_at=t where id;",
   "update eldervale_private.realm_clock set tick_at=t where id;perform eldervale_private.engine_tick_begin(t);"]
 ]$edits$::jsonb) e loop
  body:=pg_get_functiondef(fn::regprocedure);
  if position(new in body)>0 then continue;end if;
  perform eldervale_private.patch_function(fn::regprocedure,array[old,new]);
 end loop;
end $patch$;

commit;
