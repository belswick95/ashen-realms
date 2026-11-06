-- Eldervale tick & tile engine, stage 4: combat and skilling timers in whole 600 ms ticks.
-- APPLY AFTER tick-tile-engine-3-npcs.sql. Idempotent; safe on a running game; nothing changes
-- while tile_mode is off (engine_seconds returns the seconds unchanged).
-- With tile_mode on every timer is a whole number of game ticks, keeping today's pacing (the
-- weapon "feel"): seconds are rounded to the nearest tick (engine_seconds), so a 4-tick dagger
-- at Eldervale's old 0.45 s tick (1.8 s) attacks every 3 game ticks (1.8 s), a 5-tick longsword
-- (2.25 s) every 4, a 6-tick battleaxe (2.7 s) every 5, a 7-tick 2h sword (3.15 s) every 5;
-- Rapid bows lose one game tick; monster attack speeds round the same way; the swing wind-up and
-- recovery are one tick each. Woodcutting rolls every 5 ticks (3.0 s), fishing every 7-9 ticks,
-- recipes every round(seconds/0.6) ticks. The alternating player/enemy turn order is unchanged
-- (independent attack timers per side are a separate combat change, see docs/mechanics-spec.md 4.1).
begin;
set local lock_timeout='5s';

do $patch$
declare fn text;old text;new text;body text;
begin
 for fn,old,new in select e->>0,e->>1,e->>2 from jsonb_array_elements($edits$[
  ["eldervale_private.world_tick()",
   "due_at=t+interval '.5 seconds',turn_at=t+greatest(1.3,period)*interval '1 second'",
   "due_at=t+eldervale_private.engine_seconds(.5)*interval '1 second',turn_at=t+eldervale_private.engine_seconds(greatest(1.3,period))*interval '1 second'"],
  ["eldervale_private.world_tick()",
   "hp=greatest(0,hp-damage),phase='recover',due_at=greatest(t+interval '.75 seconds',a.turn_at)",
   "hp=greatest(0,hp-damage),phase='recover',due_at=greatest(t+eldervale_private.engine_seconds(.75)*interval '1 second',a.turn_at)"],
  ["eldervale_private.world_tick()",
   "set phase='recover',due_at=greatest(t+interval '.75 seconds',a.turn_at)",
   "set phase='recover',due_at=greatest(t+eldervale_private.engine_seconds(.75)*interval '1 second',a.turn_at)"],
  ["eldervale_private.gathering_tick(timestamp with time zone)",
   "set started_at=t,due_at=t+make_interval(secs=>3.0) where user_id=a.user_id;continue;",
   "set started_at=t,due_at=t+make_interval(secs=>eldervale_private.engine_seconds(3.0)) where user_id=a.user_id;continue;"],
  ["eldervale_private.gathering_tick(timestamp with time zone)",
   "set started_at=t,due_at=t+make_interval(secs=>delay) where user_id=a.user_id;",
   "set started_at=t,due_at=t+make_interval(secs=>eldervale_private.engine_seconds(delay)) where user_id=a.user_id;"],
  ["eldervale_private.skill_tick(timestamp with time zone)",
   "skill_jobs set started_at=t,due_at=t+make_interval(secs=>(r->>'seconds')::float8)",
   "skill_jobs set started_at=t,due_at=t+make_interval(secs=>eldervale_private.engine_seconds((r->>'seconds')::float8))"],
  ["eldervale_private.skill_tick(timestamp with time zone)",
   "set remaining=remaining-1,started_at=t,due_at=t+make_interval(secs=>(r->>'seconds')::float8)",
   "set remaining=remaining-1,started_at=t,due_at=t+make_interval(secs=>eldervale_private.engine_seconds((r->>'seconds')::float8))"]
 ]$edits$::jsonb) e loop
  body:=pg_get_functiondef(fn::regprocedure);
  if position(new in body)>0 then continue;end if;
  perform eldervale_private.patch_function(fn::regprocedure,array[old,new]);
 end loop;
end $patch$;

commit;
