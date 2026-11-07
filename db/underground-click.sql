-- Trapdoors and ladders (OSRS style): arrive right beside the hatch or the ladder.
--
-- The client now draws every dungeon way down as a trapdoor set in the ground and every way back
-- up as a ladder to the open hatch (underground-data.js passageLook). Climbing should leave the
-- player one tile from what they climbed, so the arrival offsets shrink:
--   * the way out puts you 1.6 in front of the overworld trapdoor (was 3.2, clear of the old cave
--     mouth rocks);
--   * the ladder up stands 1.6 from where you land below (was 3.5).
-- Natural explore entrances (waterfall, thicket, sea cave, boat, cliff path) keep 3.2 / 3.5.
--
-- Click-to-walk below ground needs no SQL: the bug was client-side (the click ray only tested the
-- overworld terrain mesh); the server already walks underground routes, as the minimap showed.
--
-- Idempotent: each function is patched only while its new text is absent, and the areas are
-- re-synced (passage objects moved) only in the run that patches. Safe to run again.
do $do$
declare n integer:=0;
begin
 if position('sin(a)*1.6' in pg_get_functiondef('eldervale_private.underground_passages(jsonb)'::regprocedure))=0 then
  perform eldervale_private.patch_function('eldervale_private.underground_passages(jsonb)'::regprocedure,array[
   'sin(a)*3.2','sin(a)*1.6',
   'cos(a)*3.2','cos(a)*1.6',
   $p$'x',ix-3.5,'z',iz$p$,$p$'x',ix-1.6,'z',iz$p$]);
  -- Re-materialise every area with overworld entrances (same call the Game console's Save & sync makes).
  perform eldervale_private.underground_sync(id) from eldervale_private.underground_areas
   where jsonb_array_length(coalesce(data->'entrances','[]'::jsonb))>0 order by id;
  get diagnostics n=row_count;
  raise notice 'underground_passages patched; % areas re-synced',n;
 else
  raise notice 'underground_passages already patched';
 end if;

 if position('then 1.6 else 3.2 end' in pg_get_functiondef('eldervale_private.explore_sync()'::regprocedure))=0 then
  perform eldervale_private.patch_function('eldervale_private.explore_sync()'::regprocedure,array[
   'sin(yaw)*3.2',$p$sin(yaw)*(case when r.data->'entrance'->>'model' in ('cave_mouth','crypt_door','mine_shaft','trapdoor','shrine_door','stairs_down','ladder_down') then 1.6 else 3.2 end)$p$,
   'cos(yaw)*3.2',$p$cos(yaw)*(case when r.data->'entrance'->>'model' in ('cave_mouth','crypt_door','mine_shaft','trapdoor','shrine_door','stairs_down','ladder_down') then 1.6 else 3.2 end)$p$,
   $p$'x',ix-3.5,$p$,$p$'x',ix-(case when coalesce(r.data->>'exitModel','cave_exit') in ('cave_exit','stairs_up','ladder_up') then 1.6 else 3.5 end),$p$]);
  perform eldervale_private.explore_sync();
  raise notice 'explore_sync patched and re-run';
 else
  raise notice 'explore_sync already patched';
 end if;
end $do$;
