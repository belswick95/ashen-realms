-- RuneScape pacing for authoritative player travel (matches click-walk.js):
--   walk  6.4 -> 2.6 units/s  (1 tile per 0.6 s tick; 1 tile = 1 m = 1.58 units)
--   run  12.8 -> 5.2 units/s  (2 tiles per tick)
--   mount 19.2 -> 9.6 units/s (a modest gallop, 1.85x running)
-- Only the two travel-speed expressions in advance_player_motion change; each
-- anchor must match exactly once or patch_function raises and nothing changes.
-- Requires eldervale_private.patch_function (db/admin-console.sql).
select eldervale_private.patch_function('eldervale_private.advance_player_motion(uuid,timestamptz)'::regprocedure,array[
 'speed:=case when riding then 19.2 when p.run and p.energy>0 then 12.8 else 6.4 end;',
 'speed:=case when riding then 9.6 when p.run and p.energy>0 then 5.2 else 2.6 end;',
 'speed:=case when riding and eldervale_private.mount_allowed(p.x,p.z) then 19.2 when p.run and p.energy>0 then 12.8 else 6.4 end;',
 'speed:=case when riding and eldervale_private.mount_allowed(p.x,p.z) then 9.6 when p.run and p.energy>0 then 5.2 else 2.6 end;'
]);

-- Check: both expressions now carry the new pace.
select position('then 9.6 when p.run and p.energy>0 then 5.2 else 2.6 end' in pg_get_functiondef('eldervale_private.advance_player_motion(uuid,timestamptz)'::regprocedure))>0 as runescape_pace_applied;
