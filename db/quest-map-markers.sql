-- Quest chain markers on the world map, and gate guards that stand guard.
--
-- 1. Map marker kind 'quest' (map-icons.js MARKER_CATS): the world map marks quest givers who
--    start a quest chain or a big quest (quest-guide.js chainStarts). The markers are built on
--    the client from the quest snapshot; the owner's map-marker overrides (gameConfig.mapMarkers:
--    hide / rename by id "quest:x:z", or a custom marker of kind 'quest') need the kind listed
--    here, or map_markers_clean refuses a custom 'quest' marker.
-- 2. NPC facing: entity_runtime() created realm_actors rows without the entity's facing
--    (data.yaw, degrees), so every posted NPC stood at yaw 0 (facing +Z, south) on the server,
--    e.g. both Birchford Ember Gate wardens faced south along the wall instead of east out of the
--    gate. The function is patched (soft_patch, once) to seed realm_actors.yaw from data.yaw.
-- 3. Gate guards (role guard, no roam, no route, within 18 units of a castle_gate): their facing
--    is set to face out of the settlement through the gate, perpendicular to the gate (along the
--    road), away from the centre of the walls the gate belongs to (same blueprint), in the
--    entity data (revision bumped only when one changes) and on the live actor. Guards that are
--    fighting are left alone; a talk-turn restores to the new facing.
--
-- Needs db/admin-full-control.sql (soft_patch) and db/map-icons.sql. Idempotent: run it again
-- and nothing changes. Removes nothing.
begin;
set local lock_timeout='5s';

-- 1. The marker kinds map-icons.js knows (MARKER_CATS), now with 'quest'.
create or replace function eldervale_private.map_marker_kinds() returns text[]
language sql immutable set search_path='' as $fn$
 select array['boss','dungeon','dragon','training','mining','woodcutting','fishing','cooking','furnace','smithing','crafting','farming','skill',
  'bank','general','apothecary','weapons','armour','inn','altar','agility','boat','teleport','exploration','quest','custom']
$fn$;
revoke all on function eldervale_private.map_marker_kinds() from public,anon,authenticated;

-- 2. New and edited NPC / monster rows take their facing from the entity data.
select eldervale_private.soft_patch('eldervale_private.entity_runtime()','realm_actors(id,data,x,z,yaw,hp,',array[
 'realm_actors(id,data,x,z,hp,','realm_actors(id,data,x,z,yaw,hp,',
 '(d->>''z'')::float8,(d->>''hp'')::integer','(d->>''z'')::float8,radians(coalesce((d->>''yaw'')::float8,0)),(d->>''hp'')::integer',
 'z=excluded.z,hp=excluded.hp','z=excluded.z,yaw=excluded.yaw,hp=excluded.hp']);

-- 3. Gate guards face out through their gate.
-- Every posted guard near a gate and the facing it should have (degrees, 0 = +Z, 90 = +X).
create or replace function eldervale_private.gate_guard_facing() returns table(id uuid,gate text,yaw_deg float8)
language sql stable set search_path='' as $fn$
 with gates as (
  select g.id,g.data->>'name' gname,(g.data->>'x')::float8 gx,(g.data->>'z')::float8 gz,radians(coalesce((g.data->>'yaw')::float8,0)) gy,g.data->>'blueprint' bp
  from eldervale_private.entities g where g.deleted is not true and g.data->>'template'='castle_gate'),
 centres as (
  select ga.id,coalesce(avg((w.data->>'x')::float8),ga.gx) cx,coalesce(avg((w.data->>'z')::float8),ga.gz) cz
  from gates ga left join eldervale_private.entities w on w.deleted is not true and ga.bp is not null and w.data->>'blueprint'=ga.bp and w.data->>'template' in ('castle_wall','castle_tower','castle_gate')
  group by ga.id,ga.gx,ga.gz),
 outward as (
  -- The gate's normal (sin, cos of its yaw), turned to point away from the centre of its walls.
  select ga.id,ga.gname,ga.gx,ga.gz,sin(ga.gy)*s.k nx,cos(ga.gy)*s.k nz
  from gates ga join centres c on c.id=ga.id
  cross join lateral (select case when (ga.gx-c.cx)*sin(ga.gy)+(ga.gz-c.cz)*cos(ga.gy)<0 then -1 else 1 end k) s),
 guards as (
  select e.id,(e.data->>'x')::float8 x,(e.data->>'z')::float8 z from eldervale_private.entities e
  where e.deleted is not true and e.data->>'kind'='npc' and e.data->>'role'='guard' and coalesce((e.data->>'roam')::float8,0)=0
   and jsonb_array_length(case when jsonb_typeof(e.data->'route')='array' then e.data->'route' else '[]'::jsonb end)<2)
 select gu.id,o.gname,round(degrees(atan2(o.nx,o.nz))::numeric,1)::float8
 from guards gu cross join lateral (select * from outward o order by power(o.gx-gu.x,2)+power(o.gz-gu.z,2) limit 1) o
 where power(o.gx-gu.x,2)+power(o.gz-gu.z,2)<18*18
$fn$;
revoke all on function eldervale_private.gate_guard_facing() from public,anon,authenticated;

do $face$
declare rev bigint;changed integer;turned integer;
begin
 -- Entity data (what the console, the clients and later re-seeds read).
 select count(*) into changed from eldervale_private.gate_guard_facing() f join eldervale_private.entities e on e.id=f.id
  where abs(atan2(sin(radians(f.yaw_deg-coalesce((e.data->>'yaw')::float8,0))),cos(radians(f.yaw_deg-coalesce((e.data->>'yaw')::float8,0)))))>.01;
 if changed>0 then
  update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
  update eldervale_private.entities e set data=jsonb_set(e.data,'{yaw}',to_jsonb(f.yaw_deg)),revision=rev from eldervale_private.gate_guard_facing() f
   where e.id=f.id and abs(atan2(sin(radians(f.yaw_deg-coalesce((e.data->>'yaw')::float8,0))),cos(radians(f.yaw_deg-coalesce((e.data->>'yaw')::float8,0)))))>.01;
 end if;
 -- The live actors (radians), unless they are in a fight; a pending talk-turn restores to it too.
 update eldervale_private.realm_actors a set yaw=radians(f.yaw_deg),data=jsonb_set(a.data,'{yaw}',to_jsonb(f.yaw_deg)) from eldervale_private.gate_guard_facing() f
  where a.id=f.id::text and a.target is null and abs(atan2(sin(radians(f.yaw_deg)-a.yaw),cos(radians(f.yaw_deg)-a.yaw)))>.01;
 get diagnostics turned=row_count;
 if to_regclass('eldervale_private.actor_faces') is not null then
  update eldervale_private.actor_faces af set restore_yaw=radians(f.yaw_deg) from eldervale_private.gate_guard_facing() f where af.id=f.id::text and af.active and af.restore_yaw is distinct from radians(f.yaw_deg);
 end if;
 raise notice 'Gate guards: % entity facing(s) corrected, % actor(s) turned to face out through their gate',changed,turned;
end $face$;
commit;
