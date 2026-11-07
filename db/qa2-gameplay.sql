-- QA2 gameplay and world pass (release move3v161). NOT YET APPLIED. Idempotent: safe to run again.
-- The client fixes of this pass (motion-track.js, click-walk.js, tile-grid.js, game.js) need no SQL.
--
-- 1. Monsters stuck inside obstacles (world look: "monsters grounded"; read-only probe, Nov 2026).
--    Three monsters stand on blocked tiles (tile_flags & 1) and can never move again:
--     - Orc warchief (147.37,-61.99): drifted into its camp tent before tile mode (old continuous
--       roam/chase); its tile's own wall bits now box it in. Its spawn tile (94,-39) is open.
--     - Marsh wight (-249.24,289.20): drifted into an obstacle the same way; every roam goal fails
--       the continuous can_step test from inside it, so it pauses forever. Spawn tile (-156,184) open.
--     - Kindled cinder-sworn (316,118): its spawn point itself is inside an obstacle (7 of 8
--       neighbours blocked), so it also respawns there. The nearest open tile is (199,75).
--    Each monster on a blocked tile (and not fighting) is put on the open tile nearest its spawn
--    (its spawn tile when open), with at least two open sides; a spawn that is itself blocked moves
--    with it (data x/z), so a respawn lands there too. db/quest-arc-3-forge-a.sql carries the new
--    cinder-sworn spawn for a re-seed. Once applied, no monster stands on a blocked tile: a second
--    run updates nothing.
begin;
set local lock_timeout='5s';

with stuck as (
 select a.id,(a.data->>'x')::float8 sx,(a.data->>'z')::float8 sz
 from eldervale_private.realm_actors a
 where not a.deleted and a.target is null and a.data->>'kind'='monster'
  and jsonb_typeof(a.data->'x')='number' and jsonb_typeof(a.data->'z')='number'
  and eldervale_private.tile_flags_at(eldervale_private.tile_of(a.x),eldervale_private.tile_of(a.z))&1<>0
), spot as (
 select s.id,c.i,c.j from stuck s cross join lateral (
  select eldervale_private.tile_of(s.sx)+di i,eldervale_private.tile_of(s.sz)+dj j
  from generate_series(-3,3) di,generate_series(-3,3) dj
  where eldervale_private.tile_flags_at(eldervale_private.tile_of(s.sx)+di,eldervale_private.tile_of(s.sz)+dj)&1=0
   and (select count(*) from (values(1,0),(-1,0),(0,1),(0,-1)) v(a,b)
        where eldervale_private.tile_can_move(eldervale_private.tile_of(s.sx)+di,eldervale_private.tile_of(s.sz)+dj,v.a,v.b))>=2
  order by di*di+dj*dj,di,dj limit 1) c
)
update eldervale_private.realm_actors a
 set x=eldervale_private.tile_center(spot.i),z=eldervale_private.tile_center(spot.j),roam_x=null,roam_z=null,roam_pause_until=null,
  data=case when eldervale_private.tile_flags_at(eldervale_private.tile_of((a.data->>'x')::float8),eldervale_private.tile_of((a.data->>'z')::float8))&1<>0
   then a.data||jsonb_build_object('x',round(eldervale_private.tile_center(spot.i)::numeric,2),'z',round(eldervale_private.tile_center(spot.j)::numeric,2))
   else a.data end
 from spot where spot.id=a.id;

commit;

-- DRY RUN (changes nothing): run the block below on its own, instead of the update above. It makes
-- the same update inside a DO block, counts what moved and what is still stuck, and raises: the
-- exception rolls the whole block back.
/*
do $dry$
declare moved integer;still integer;
begin
 perform set_config('lock_timeout','5s',true);
 with stuck as (
  select a.id,(a.data->>'x')::float8 sx,(a.data->>'z')::float8 sz
  from eldervale_private.realm_actors a
  where not a.deleted and a.target is null and a.data->>'kind'='monster'
   and jsonb_typeof(a.data->'x')='number' and jsonb_typeof(a.data->'z')='number'
   and eldervale_private.tile_flags_at(eldervale_private.tile_of(a.x),eldervale_private.tile_of(a.z))&1<>0
 ), spot as (
  select s.id,c.i,c.j from stuck s cross join lateral (
   select eldervale_private.tile_of(s.sx)+di i,eldervale_private.tile_of(s.sz)+dj j
   from generate_series(-3,3) di,generate_series(-3,3) dj
   where eldervale_private.tile_flags_at(eldervale_private.tile_of(s.sx)+di,eldervale_private.tile_of(s.sz)+dj)&1=0
    and (select count(*) from (values(1,0),(-1,0),(0,1),(0,-1)) v(a,b)
         where eldervale_private.tile_can_move(eldervale_private.tile_of(s.sx)+di,eldervale_private.tile_of(s.sz)+dj,v.a,v.b))>=2
   order by di*di+dj*dj,di,dj limit 1) c
 ), done as (
  update eldervale_private.realm_actors a
   set x=eldervale_private.tile_center(spot.i),z=eldervale_private.tile_center(spot.j),roam_x=null,roam_z=null,roam_pause_until=null,
    data=case when eldervale_private.tile_flags_at(eldervale_private.tile_of((a.data->>'x')::float8),eldervale_private.tile_of((a.data->>'z')::float8))&1<>0
     then a.data||jsonb_build_object('x',round(eldervale_private.tile_center(spot.i)::numeric,2),'z',round(eldervale_private.tile_center(spot.j)::numeric,2))
     else a.data end
   from spot where spot.id=a.id returning a.id)
 select count(*) into moved from done;
 select count(*) into still from eldervale_private.realm_actors a where not a.deleted and a.data->>'kind'='monster'
  and eldervale_private.tile_flags_at(eldervale_private.tile_of(a.x),eldervale_private.tile_of(a.z))&1<>0;
 raise exception 'DRY RUN, rolled back. moved=% still_on_blocked_tiles=%',moved,still;
end $dry$;
*/
