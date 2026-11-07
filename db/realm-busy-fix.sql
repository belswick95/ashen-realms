-- Realm busy fix (live incident 7 Nov 2026, 16:54-17:07 and 18:00-18:04 UTC). NOT YET APPLIED.
-- Idempotent: each function edit is applied only while its marker is absent, so a second run
-- changes nothing. Client half: realm-client.js (poll once per tick, back off when busy) and
-- logout-guard.js / auth.js (the X always answers).
--
-- What happened (read-only evidence: postgres and edge logs, cron.job_run_details, pg_stat_*):
--  * Every world command, including the idle 'sync' poll each client sent every 250 ms, takes the
--    one world lock (pg_advisory_xact_lock 736211) and holds it for the whole request: the inline
--    world tick plus the full reply (quest_refresh, quest_snapshot - 202 KB for the owner -, md5
--    diets). One active client kept that lock busy 30-40 % of the time, two clients about 75 %
--    (17:58: 377 commands a minute at about 120 ms each).
--  * On this small instance any stall (checkpoint at 18:00:18, CPU starvation) then becomes a
--    convoy: commands queue on the lock ("still waiting for ExclusiveLock on advisory lock
--    [5,0,736211,1]" for up to 4.6 s), the PostgREST pool fills (even anon eldervale_news went from
--    50 ms to 2.7 s), and the 8 s statement_timeout fires anywhere, even in one-row selects
--    (realm_request line 29, sync_diet insert). The client shows "The realm is busy" and keeps
--    polling at 250 ms, so the queue never drains. The 1 s cron tick slows too (25 ms to 200-300 ms,
--    fewer runs a minute) because the whole database is starved, not because of one new statement.
--  * It is not owner-specific: 16:54-17:07 was the same pattern with one QA account. The owner's
--    save row is small (2.7 KB); logout_combat_wait only runs for players 12-15 s stale and reads
--    16 realm_events rows by index.
--  * The X logout: the 'logout' command also queued behind the world lock and timed out with no
--    on-screen feedback, so a tap during the busy spell looked like nothing happened.
--
-- This file:
--  1. realm_request: 'logout' no longer waits for the world lock (it only locks the player's own
--     realm_players row and reads, so it cannot deadlock with the tick) and gives up after 3 s;
--     a 'sync' poll waits at most 4 s for the world lock instead of 8 s, so stuck polls fail fast,
--     free their pool connection, and the client backs off instead of piling up.
--  2. guard_tick: the guard level sweep (guard_levels over every guard and hostile actor, plus an
--     update) runs every 20th tick (12 s) instead of every tick while anyone is online.
--
-- Apply: run this file once (psql or the SQL editor). It takes no world lock.
-- Dry run: run only the DO block at the bottom (between the markers). It applies both edits in
-- its own transaction, checks them, compiles, and then raises, which rolls everything back.
-- Check after applying:
--   select position('realm-busy-fix' in pg_get_functiondef('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)'::regprocedure))>0 as request_fixed,
--          position('tick_no(t)%20' in pg_get_functiondef('eldervale_private.guard_tick(double precision)'::regprocedure))>0 as guard_sweep_fixed;

begin;
set local lock_timeout='5s';
set local statement_timeout='30s';

do $do$
begin
 if position('realm-busy-fix' in pg_get_functiondef('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)'::regprocedure))=0 then
  perform eldervale_private.patch_function('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
   E' perform pg_advisory_xact_lock(736211);\n' ||
   E' if command=''logout'' then return eldervale_private.logout_command($1);end if; -- Lock order',
   E' -- realm-busy-fix: logout never queues behind the world lock (it locks only its own player row);\n' ||
   E' -- a sync poll waits at most 4 s for the lock, then fails fast and the client backs off.\n' ||
   E' if command=''logout'' then perform set_config(''lock_timeout'',''3s'',true);return eldervale_private.logout_command($1);end if;\n' ||
   E' if command=''sync'' then perform set_config(''lock_timeout'',''4s'',true);end if;\n' ||
   E' perform pg_advisory_xact_lock(736211); -- Lock order']);
 end if;
 if position('tick_no(t)%20' in pg_get_functiondef('eldervale_private.guard_tick(double precision)'::regprocedure))=0 then
  perform eldervale_private.patch_function('eldervale_private.guard_tick(double precision)'::regprocedure,array[
   E'clock_timestamp();begin\n\n update eldervale_private.realm_actors guard_row set',
   E'clock_timestamp();begin\n\n if eldervale_private.tick_no(t)%20=0 then update eldervale_private.realm_actors guard_row set',
   E'is distinct from ''longsword'');',
   E'is distinct from ''longsword'');end if;']);
 end if;
end $do$;

commit;

-- ===== DRY RUN (changes nothing; run this block on its own instead of the file above) =====
/*
do $dry$
declare rr text;gt text;
begin
 perform set_config('lock_timeout','5s',true);perform set_config('statement_timeout','30s',true);
 if position('realm-busy-fix' in pg_get_functiondef('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)'::regprocedure))=0 then
  perform eldervale_private.patch_function('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
   E' perform pg_advisory_xact_lock(736211);\n' ||
   E' if command=''logout'' then return eldervale_private.logout_command($1);end if; -- Lock order',
   E' -- realm-busy-fix: logout never queues behind the world lock (it locks only its own player row);\n' ||
   E' -- a sync poll waits at most 4 s for the lock, then fails fast and the client backs off.\n' ||
   E' if command=''logout'' then perform set_config(''lock_timeout'',''3s'',true);return eldervale_private.logout_command($1);end if;\n' ||
   E' if command=''sync'' then perform set_config(''lock_timeout'',''4s'',true);end if;\n' ||
   E' perform pg_advisory_xact_lock(736211); -- Lock order']);
 end if;
 if position('tick_no(t)%20' in pg_get_functiondef('eldervale_private.guard_tick(double precision)'::regprocedure))=0 then
  perform eldervale_private.patch_function('eldervale_private.guard_tick(double precision)'::regprocedure,array[
   E'clock_timestamp();begin\n\n update eldervale_private.realm_actors guard_row set',
   E'clock_timestamp();begin\n\n if eldervale_private.tick_no(t)%20=0 then update eldervale_private.realm_actors guard_row set',
   E'is distinct from ''longsword'');',
   E'is distinct from ''longsword'');end if;']);
 end if;
 rr:=pg_get_functiondef('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)'::regprocedure);
 gt:=pg_get_functiondef('eldervale_private.guard_tick(double precision)'::regprocedure);
 if position('realm-busy-fix' in rr)=0 or position('tick_no(t)%20=0 then update' in gt)=0 then raise exception 'DRY RUN FAILED: an edit is missing';end if;
 -- The logout branch must come before the world lock, the lock must still be taken once for the rest.
 if position('logout_command($1)' in rr)>position('perform pg_advisory_xact_lock(736211); -- Lock order' in rr) then raise exception 'DRY RUN FAILED: logout still behind the lock';end if;
 raise exception 'DRY RUN OK, rolled back. realm_request and guard_tick patched and compiled; nothing kept.';
end $dry$;
*/
