-- Eldervale tick & tile engine, stage 5: a true 600 ms world tick. APPLY AFTER tick-tile-engine-4-timing.sql.
-- Idempotent. Nothing changes until the owner sets tick_driver = 'loop' in the Game console.
--
-- Drivers (engine setting tick_driver):
--  * inline (default, today's behaviour): pg_cron runs world_tick every second and every player
--    command runs it inline. In tile mode world_tick's gate (stage 3) already makes this "the first
--    caller in each 600 ms window ticks; everyone else returns at once" - no work is repeated.
--  * loop: pg_cron starts eldervale_private.tick_loop() every minute. The procedure keeps one
--    connection, sleeps to each 600 ms boundary (epoch-aligned, the same ticks stage 2/3 count),
--    runs world_tick and commits, for 58 s; a session advisory lock (736213) keeps it to one loop.
--    Player commands then no longer run the world tick: request_tick() only brings the caller's own
--    movement up to the current tick (tick-indexed, so identical to what the tick would do) and the
--    command's intent waits for the next tick. If the loop stops (tick_at older than 1.5 s), commands
--    fall back to running world_tick inline, and the 1-second cron job keeps ticking regardless.
--    pg_cron's minimum interval is 1 s (seconds syntax), which is why the loop lives in a procedure.
-- The loop records tick_ms / tick_avg_ms / loop_at in tick_engine.state (shown in the console).
begin;
set local lock_timeout='5s';

-- What a player command runs instead of a full world tick.
create or replace function eldervale_private.request_tick() returns void
language plpgsql security definer set search_path to '' as $fn$
begin
 if eldervale_private.engine_config()->>'tick_driver'='loop'
  and exists(select 1 from eldervale_private.realm_clock where id and enabled and tick_at>clock_timestamp()-interval '1.5 seconds') then
  if auth.uid() is not null then perform eldervale_private.advance_player_motion(auth.uid(),clock_timestamp());end if;
  return;
 end if;
 perform eldervale_private.world_tick();
end $fn$;

-- The 600 ms loop. Procedures that commit can carry neither SET nor SECURITY DEFINER: every name
-- is qualified, and pg_cron runs it as the job owner (postgres, the owner of every game table).
create or replace procedure eldervale_private.tick_loop(run_seconds integer default 58)
language plpgsql as $fn$
declare started timestamptz:=clock_timestamp();next_tick bigint;wait float8;t0 timestamptz;before_at timestamptz;after_at timestamptz;
 took float8;avg_ms float8;n integer:=0;tries integer;
begin
 if coalesce(eldervale_private.engine_config()->>'tick_driver','inline')<>'loop' then return;end if;
 if not pg_try_advisory_lock(736213) then return;end if;
 loop
  exit when clock_timestamp()>started+least(greatest(run_seconds,1),58)*interval '1 second';
  exit when coalesce(eldervale_private.engine_config()->>'tick_driver','inline')<>'loop';
  next_tick:=eldervale_private.tick_no(clock_timestamp())+1;
  wait:=extract(epoch from eldervale_private.tick_time(next_tick)-clock_timestamp())+.003;
  if wait>0 then perform pg_sleep(wait);end if;
  commit;
  t0:=clock_timestamp();tries:=0;
  loop
   select tick_at into before_at from eldervale_private.realm_clock where id;
   perform eldervale_private.world_tick();
   select tick_at into after_at from eldervale_private.realm_clock where id;
   -- world_tick skips when a player command holds the world lock: try again shortly in this tick.
   exit when after_at is distinct from before_at or tries>=6 or eldervale_private.tick_no(clock_timestamp())>next_tick;
   tries:=tries+1;commit;perform pg_sleep(.04);
  end loop;
  took:=extract(epoch from clock_timestamp()-t0)*1000;avg_ms:=coalesce(avg_ms*.9+took*.1,took);n:=n+1;
  if n%10=1 then
   update eldervale_private.tick_engine set state=state||jsonb_build_object('loop_at',t0,'tick_ms',round(took::numeric,1),'tick_avg_ms',round(avg_ms::numeric,1)) where id;
  end if;
  commit;
 end loop;
 perform pg_advisory_unlock(736213);
end $fn$;

-- Player commands: request_tick instead of a full world tick (a no-op change while tick_driver is inline).
do $patch$
declare body text:=pg_get_functiondef('eldervale_private.realm_request_base(uuid,text,jsonb,uuid,bigint)'::regprocedure);
begin
 if position('eldervale_private.request_tick()' in body)>0 then return;end if;
 perform eldervale_private.patch_function('eldervale_private.realm_request_base(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
  ' perform eldervale_private.world_tick();'||chr(10),' perform eldervale_private.request_tick();'||chr(10)]);
end $patch$;

-- Start the loop every minute (it exits at once unless tick_driver = 'loop'). The 1-second
-- world_tick job stays as the backstop; in tile mode it never ticks twice within a game tick.
do $cron$
begin
 if exists(select 1 from pg_extension where extname='pg_cron') then
  perform cron.schedule('eldervale_tick_loop','* * * * *','call eldervale_private.tick_loop(58)');
 end if;
end $cron$;

commit;
