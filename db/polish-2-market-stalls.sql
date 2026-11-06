-- Market stall collision (polish pass). Idempotent: each patch is skipped once applied.
--
-- The stall model (town-props.js market) stands on four posts and a counter, 2.4 x 1.5 m at walking
-- height; only its 2.7 x 1.9 m awning is wider, and that hangs overhead at 2.1-2.6 m. The server
-- blocked the awning's outline, so players stopped short of the Grand Market stalls in open space,
-- and the tile grid (tick & tile engine) rasterised the oversized box onto tiles the stall barely
-- touches while missing corners it covers.
--
-- After this file:
-- * can_step (continuous movement): half-size 1.2 x 0.75 plus the usual 0.2 body margin, the same
--   numbers as the client's navigation-obstacles.js, so prediction and server agree.
-- * tile grid: the stall's tile footprint is exactly its 1.2 x 0.75 body (a tile is blocked when its
--   centre is under the stall, and tile edges that cut through the stall are walls), so the blocked
--   tiles are the ones the stall visibly covers most of.
-- * If the tile grid has been built, the changed stall shapes are rebuilt right away
--   (tile_refresh() rebuilds only the boxes whose shape signature changed). If it has never been
--   built (tile mode off), nothing is rebuilt now; the console builds it when tile mode is enabled.
do $stalls$
declare body text;
begin
 body:=pg_get_functiondef('eldervale_private.can_step_before_professions(double precision,double precision,double precision,double precision)'::regprocedure);
 if position('when ''market'' then 1.2 when ''bench'' then 1.15' in body)=0 then
  perform eldervale_private.patch_function('eldervale_private.can_step_before_professions(double precision,double precision,double precision,double precision)'::regprocedure,
   array['when ''market'' then 1.35 when ''bench'' then 1.15','when ''market'' then 1.2 when ''bench'' then 1.15',
         'when ''market'' then .95 when ''bench'' then .5','when ''market'' then .75 when ''bench'' then .5']);
 end if;
 body:=pg_get_functiondef('eldervale_private.tile_shapes()'::regprocedure);
 if position('when ''market'' then 1.0 when ''bench'' then 1.15' in body)=0 then
  -- tile_shapes adds 0.2 to every prop; 1.0 / 0.55 make the market's tile rectangle 1.2 x 0.75.
  perform eldervale_private.patch_function('eldervale_private.tile_shapes()'::regprocedure,
   array['when ''market'' then 1.35 when ''bench'' then 1.15','when ''market'' then 1.0 when ''bench'' then 1.15',
         'when ''market'' then .95 when ''bench'' then .5','when ''market'' then .55 when ''bench'' then .5']);
 end if;
 if exists(select 1 from eldervale_private.tile_sources) then
  raise notice 'market stalls: % tile boxes rebuilt',eldervale_private.tile_refresh();
 else
  raise notice 'market stalls: tile grid not built yet, nothing to rebuild';
 end if;
end $stalls$;

-- Report: the patched sizes and the tiles each Grand Market stall now blocks (empty while tile mode
-- has never been enabled).
select o.data->>'blueprintKey' as stall,round(o.x::numeric,2) x,round(o.z::numeric,2) z,
 eldervale_private.can_step(o.x+1.5,o.z+1.5,o.x+1.5,o.z+1.5) as clear_beside,
 (select string_agg(f.i||','||f.j,' ' order by f.j,f.i) from eldervale_private.tile_flags f
   where f.floor=0 and f.flags&1<>0 and f.i between eldervale_private.tile_of(o.x)-2 and eldervale_private.tile_of(o.x)+2
    and f.j between eldervale_private.tile_of(o.z)-2 and eldervale_private.tile_of(o.z)+2) as blocked_tiles
from eldervale_private.realm_objects o where o.data->>'template'='market' and o.data->>'blueprintKey' like 'stall-%' order by 1;
