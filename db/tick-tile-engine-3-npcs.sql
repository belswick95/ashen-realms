-- Eldervale tick & tile engine, stage 3: NPCs and monsters on tiles. APPLY AFTER tick-tile-engine-2-players.sql.
-- Idempotent; safe on a running game; nothing changes while tile_mode is off. With tile_mode on:
--  * world_tick runs once per 600 ms game tick (a call inside the same tick returns at once) and
--    knows how many ticks passed (normally 1; at most 1+max_catchup_ticks after a stall).
--  * Roaming, patrol routes and chasing move actors tile to tile, 1 tile per tick, with OSRS
--    "dumb" pathing: toward the goal, diagonal first, then horizontal, then vertical; blocked = stay
--    (this makes safespots behind trees and fences work). Leashing (15 from the target, 30 from
--    home) is unchanged.
--  * Melee is orthogonal: a monster stops on a tile next to its target (never on it, never
--    diagonal) and a melee player must stand orthogonally next to the monster to start a fight.
--  * Respawn timers are whole ticks (rounded to 600 ms).
--  * Replies carry each actor's stepAt (the tick it last stepped) so clients glide between tiles.
begin;
set local lock_timeout='5s';

create table if not exists eldervale_private.actor_tiles(id text primary key, step_at timestamptz not null);

-- Seconds rounded to whole game ticks in tile mode (a timer set n ticks ahead fires on the n-th
-- tick; the small margin absorbs tick start jitter). Unchanged seconds otherwise.
create or replace function eldervale_private.engine_seconds(s double precision) returns double precision language sql stable as $fn$
 select (case when eldervale_private.tile_mode() then greatest(1,floor(coalesce(s,0)/0.6+.5))*0.6-.05 else s end)
$fn$;

-- World tick gate: in tile mode at most once per game tick; remembers how many ticks passed.
create or replace function eldervale_private.engine_tick_due(prev timestamptz, t timestamptz) returns boolean
language plpgsql set search_path to '' as $fn$
declare n bigint;
begin
 if not eldervale_private.tile_mode() then perform set_config('eldervale.tick_steps','1',true);return true;end if;
 n:=eldervale_private.tick_no(t)-eldervale_private.tick_no(coalesce(prev,t-interval '1 second'));
 if n<=0 then return false;end if;
 perform set_config('eldervale.tick_steps',least(n,1+coalesce((eldervale_private.engine_config()->>'max_catchup_ticks')::integer,2))::text,true);
 return true;
end $fn$;
create or replace function eldervale_private.engine_tick_steps() returns integer language sql stable as $fn$
 select greatest(1,coalesce(nullif(current_setting('eldervale.tick_steps',true),''),'1')::integer)
$fn$;

-- One OSRS "dumb" step from (ci,cj) toward (gi,gj): diagonal first, then x, then z. Never onto
-- (ai,aj) (the tile of the player being chased). Returns [di,dj] or null when stuck.
create or replace function eldervale_private.tile_dumb_step(ci integer, cj integer, gi integer, gj integer, ai integer default null, aj integer default null)
returns integer[] language plpgsql stable set search_path to '' as $fn$
declare di integer:=sign(gi-ci);dj integer:=sign(gj-cj);
begin
 if di=0 and dj=0 then return null;end if;
 if di<>0 and dj<>0 and not coalesce(ci+di=ai and cj+dj=aj,false) and eldervale_private.tile_can_move(ci,cj,di,dj) then return array[di,dj];end if;
 if di<>0 and not coalesce(ci+di=ai and cj=aj,false) and eldervale_private.tile_can_move(ci,cj,di,0) then return array[di,0];end if;
 if dj<>0 and not coalesce(ci=ai and cj+dj=aj,false) and eldervale_private.tile_can_move(ci,cj,0,dj) then return array[0,dj];end if;
 return null;
end $fn$;

-- Chase: step toward the player until orthogonally adjacent (melee) or `shooting` (in range).
create or replace function eldervale_private.actor_tile_chase(actor_id text, px double precision, pz double precision, shooting boolean)
returns void language plpgsql security definer set search_path to '' as $fn$
declare a eldervale_private.realm_actors;ci integer;cj integer;ti integer;tj integer;st integer[];k integer;moved boolean:=false;d integer[];
begin
 select * into a from eldervale_private.realm_actors where id=actor_id for update;
 if not found then return;end if;
 ci:=eldervale_private.tile_of(a.x);cj:=eldervale_private.tile_of(a.z);ti:=eldervale_private.tile_of(px);tj:=eldervale_private.tile_of(pz);
 for k in 1..eldervale_private.engine_tick_steps() loop
  exit when abs(ci-ti)+abs(cj-tj)=1;
  if ci=ti and cj=tj then
   -- Standing under the player: step out to a free side (W, E, S, N).
   st:=null;
   foreach d slice 1 in array array[[-1,0],[1,0],[0,-1],[0,1]] loop
    if eldervale_private.tile_can_move(ci,cj,d[1],d[2]) then st:=d;exit;end if;
   end loop;
  else st:=eldervale_private.tile_dumb_step(ci,cj,ti,tj,ti,tj);end if;
  exit when st is null;
  ci:=ci+st[1];cj:=cj+st[2];moved:=true;
 end loop;
 if moved then
  update eldervale_private.realm_actors set x=eldervale_private.tile_center(ci),z=eldervale_private.tile_center(cj),
   yaw=eldervale_private.face_yaw(eldervale_private.tile_center(ci),eldervale_private.tile_center(cj),px,pz,yaw),phase=(case when shooting then phase else 'ready' end) where id=a.id;
  insert into eldervale_private.actor_tiles(id,step_at) values(a.id,eldervale_private.tick_time(eldervale_private.tick_no(clock_timestamp())))
   on conflict (id) do update set step_at=excluded.step_at;
 end if;
end $fn$;

-- Roam/patrol: dumb steps toward (gx,gz). false when blocked before moving (the caller pauses
-- and picks a new goal, as before).
create or replace function eldervale_private.actor_tile_roam(actor_id text, gx double precision, gz double precision)
returns boolean language plpgsql security definer set search_path to '' as $fn$
declare a eldervale_private.realm_actors;ci integer;cj integer;gi integer;gj integer;st integer[];k integer;moved boolean:=false;heading float8;
begin
 select * into a from eldervale_private.realm_actors where id=actor_id for update;
 if not found then return false;end if;
 ci:=eldervale_private.tile_of(a.x);cj:=eldervale_private.tile_of(a.z);gi:=eldervale_private.tile_of(gx);gj:=eldervale_private.tile_of(gz);heading:=a.yaw;
 for k in 1..eldervale_private.engine_tick_steps() loop
  st:=eldervale_private.tile_dumb_step(ci,cj,gi,gj);
  exit when st is null;
  ci:=ci+st[1];cj:=cj+st[2];moved:=true;heading:=atan2(st[1],st[2]);
 end loop;
 if not moved then return ci=gi and cj=gj;end if;
 update eldervale_private.realm_actors set x=eldervale_private.tile_center(ci),z=eldervale_private.tile_center(cj),yaw=heading where id=a.id;
 insert into eldervale_private.actor_tiles(id,step_at) values(a.id,eldervale_private.tick_time(eldervale_private.tick_no(clock_timestamp())))
  on conflict (id) do update set step_at=excluded.step_at;
 return true;
end $fn$;

create or replace function eldervale_private.actor_tile_json(actor_id text) returns jsonb language sql stable set search_path to '' as $fn$
 select (case when eldervale_private.tile_mode() then jsonb_build_object('stepAt',coalesce((select step_at from eldervale_private.actor_tiles where id=actor_id),to_timestamp(0))) else '{}'::jsonb end)
$fn$;

do $patch$
declare fn text;old text;new text;body text;
begin
 for fn,old,new in select e->>0,e->>1,e->>2 from jsonb_array_elements($edits$[
  ["eldervale_private.world_tick()",
   "if dt<.15 then return;end if;",
   "if dt<.15 or not eldervale_private.engine_tick_due(prev,t) then return;end if;"],
  ["eldervale_private.world_tick()",
   "dx:=target_player.x-a.x;dz:=target_player.z-a.z;step:=least(dt*1.7,dist-2);lx:=a.x+dx/dist*step;lz:=a.z+dz/dist*step;if eldervale_private.can_step(a.x,a.z,lx,lz) then update eldervale_private.realm_actors set x=lx,z=lz,yaw=atan2(dx,dz),phase=case when shooting then phase else 'ready' end where id=a.id;end if;",
   "if eldervale_private.tile_mode() then perform eldervale_private.actor_tile_chase(a.id,target_player.x,target_player.z,shooting);\n    else dx:=target_player.x-a.x;dz:=target_player.z-a.z;step:=least(dt*1.7,dist-2);lx:=a.x+dx/dist*step;lz:=a.z+dz/dist*step;if eldervale_private.can_step(a.x,a.z,lx,lz) then update eldervale_private.realm_actors set x=lx,z=lz,yaw=atan2(dx,dz),phase=(case when shooting then phase else 'ready' end) where id=a.id;end if;end if;"],
  ["eldervale_private.world_tick()",
   "   if dist>2.4 then\n",
   "   if dist>(case when eldervale_private.tile_mode() then 1.66 else 2.4 end) then\n"],
  ["eldervale_private.world_tick()",
   "then eldervale_private.attack_range(s.equipment->>'weapon') else 3 end) then",
   "then (case when eldervale_private.tile_mode() and eldervale_private.attack_range(s.equipment->>'weapon')<=3 then 1.66 else eldervale_private.attack_range(s.equipment->>'weapon') end) else 3 end) then"],
  ["eldervale_private.world_tick()",
   "   if dist<=.12 then\n",
   "   if dist<=.12 or (eldervale_private.tile_mode() and eldervale_private.tile_of(a.x)=eldervale_private.tile_of(gx) and eldervale_private.tile_of(a.z)=eldervale_private.tile_of(gz)) then\n"],
  ["eldervale_private.world_tick()",
   "    step:=least(dt*(case when a.data->>'kind'='npc' then 2.0 else 1.35 end),dist);lx:=a.x+dx/dist*step;lz:=a.z+dz/dist*step;\n    if eldervale_private.can_step(a.x,a.z,lx,lz) then\n     update eldervale_private.realm_actors set x=lx,z=lz,yaw=atan2(dx,dz) where id=a.id;\n",
   "    step:=least(dt*(case when a.data->>'kind'='npc' then 2.0 else 1.35 end),dist);lx:=a.x+dx/dist*step;lz:=a.z+dz/dist*step;\n    if eldervale_private.tile_mode() then\n     if not eldervale_private.actor_tile_roam(a.id,gx,gz) then update eldervale_private.realm_actors set roam_x=null,roam_z=null,roam_pause_until=t+interval '1 second' where id=a.id;end if;\n    elsif eldervale_private.can_step(a.x,a.z,lx,lz) then\n     update eldervale_private.realm_actors set x=lx,z=lz,yaw=atan2(dx,dz) where id=a.id;\n"],
  ["eldervale_private.world_tick()",
   "respawn_at=case when (data->>'respawn')::integer>0 then t+(data->>'respawn')::integer*interval '1 second' else null end",
   "respawn_at=(case when (data->>'respawn')::integer>0 then t+eldervale_private.engine_seconds((data->>'respawn')::float8)*interval '1 second' else null end)"],
  ["eldervale_private.realm_request_base(uuid,text,jsonb,uuid,bigint)",
   "(to_jsonb(a)-'data')||jsonb_build_object('data',",
   "(to_jsonb(a)-'data')||eldervale_private.actor_tile_json(a.id)||jsonb_build_object('data',"]
 ]$edits$::jsonb) e loop
  body:=pg_get_functiondef(fn::regprocedure);
  if position(new in body)>0 then continue;end if;
  perform eldervale_private.patch_function(fn::regprocedure,array[old,new]);
 end loop;
end $patch$;

commit;
