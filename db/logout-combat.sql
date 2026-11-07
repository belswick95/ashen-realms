-- OSRS-style logout rule (client: logout-guard.js, auth.js, realm-client.js).
--
-- 1. A 'logout' world command. It is refused until 10 seconds after the end of combat:
--      * a hit on or by the player in the last 10 s (realm_events 'hit' with player = you, either
--        side; poison and venom ticks do not count), or
--      * player_mech.last_hit_tick in the last 10 s (the combat engine's own record), or
--      * a live monster that has the player as its target right now.
--    Otherwise it ends the world session at once: a new session id (the old client stops) and a
--    last_seen outside the 15 s presence window, so the character leaves the world immediately.
--    The client signs out only after this succeeds. A client that skips it (or closes the tab)
--    gets no immediate exit: see 2.
-- 2. Tab or app closed (no logout command): today a character stays in the world for 15 s after
--    its last poll (every presence check uses last_seen > now - 15 s), fighting on, then vanishes
--    even mid-fight. logout_linger(t), called by world_tick right after mech_tick, keeps a
--    character that is still in combat present (last_seen held at t - 12 s) until its combat timer
--    clears, up to 57 s after its last real poll; it then leaves 3 s later, so about 60 s at
--    most, as in OSRS. Signing in again (enter_world) or polling again ends the hold by itself.
--
-- Idempotent: tables are created if missing, functions are create-or-replace, and each hook into
-- an existing function is applied only while its marker is absent (logout_command in
-- realm_request, logout_linger in world_tick).
--
-- Dry run: run the whole file inside a transaction and roll it back, e.g.
--   begin;
--   \i db/logout-combat.sql
--   select position('logout_command' in pg_get_functiondef('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)'::regprocedure))>0 as request_hooked,
--          position('logout_linger' in pg_get_functiondef('eldervale_private.world_tick()'::regprocedure))>0 as tick_hooked;
--   rollback;
-- or compile probe copies only (they change nothing the game calls; remove them by hand afterwards):
--   select eldervale_private.patch_function('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
--    E'perform pg_advisory_xact_lock(736211); -- Lock order',
--    E'perform pg_advisory_xact_lock(736211);\n if command=''logout'' then return eldervale_private.logout_command($1);end if; -- Lock order'],true);
--   select eldervale_private.patch_function('eldervale_private.world_tick()'::regprocedure,array[
--    E'perform eldervale_private.mech_tick(t);',E'perform eldervale_private.mech_tick(t);perform eldervale_private.logout_linger(t);'],true);
-- (both need the functions below to exist first, so run them in the same transaction.)
--
-- Check after applying:
--   select eldervale_private.logout_combat_wait(user_id,clock_timestamp()) from eldervale_private.realm_players limit 5;
--   select * from eldervale_private.logout_linger;

create table if not exists eldervale_private.logout_linger(
 user_id uuid primary key,
 real_seen timestamptz not null, -- the character's last real poll
 kept timestamptz not null);     -- the last_seen this hold wrote (a different value means the client is back)
revoke all on table eldervale_private.logout_linger from public;
revoke all on table eldervale_private.logout_linger from anon,authenticated;

-- Seconds left on the player's 10 s combat timer at time t (0 = free to log out).
create or replace function eldervale_private.logout_combat_wait(uid uuid, t timestamptz)
 returns numeric language sql stable set search_path to '' as $f$
 select greatest(0::numeric,
  coalesce((select extract(epoch from max(e.created_at)+interval '10 seconds'-t)
   from eldervale_private.realm_events e
   where e.created_at>t-interval '10 seconds' and e.data->>'type'='hit' and e.data->>'player'=uid::text
    and not coalesce((e.data->>'poison')::boolean,false)),0),
  coalesce((select pm.last_hit_tick*0.6+10-extract(epoch from t) from eldervale_private.player_mech pm where pm.user_id=uid),0),
  case when exists(select 1 from eldervale_private.realm_actors a where a.target=uid and a.hp>0) then 10 else 0 end)
$f$;
revoke all on function eldervale_private.logout_combat_wait(uuid,timestamptz) from public;

-- The 'logout' world command (called from realm_request after the advisory lock).
create or replace function eldervale_private.logout_command(sid uuid)
 returns jsonb language plpgsql security definer set search_path to '' as $f$
declare uid uuid:=auth.uid();
begin
 perform 1 from eldervale_private.realm_players p where p.user_id=uid and p.session_id=sid for update;
 if not found then raise exception 'Session expired';end if;
 if eldervale_private.logout_combat_wait(uid,clock_timestamp())>0 then
  raise exception 'You can''t log out until 10 seconds after the end of combat.';
 end if;
 update eldervale_private.realm_players set session_id=gen_random_uuid(),last_seen=clock_timestamp()-interval '16 seconds',
  path='[]',intent=null,input_until=null,input_x=0,input_z=0 where user_id=uid;
 return jsonb_build_object('reset',true,'loggedOut',true);
end $f$;
revoke all on function eldervale_private.logout_command(uuid) from public;

-- Called every world tick: hold in the world a character whose client stopped polling while it is
-- still in combat (about 60 s at most since its last real poll).
create or replace function eldervale_private.logout_linger(t timestamptz)
 returns void language plpgsql set search_path to '' as $f$
declare r record;real_seen timestamptz;
begin
 for r in select p.user_id,p.last_seen,l.real_seen held_since,l.kept
  from eldervale_private.realm_players p left join eldervale_private.logout_linger l on l.user_id=p.user_id
  where p.last_seen<=t-interval '12 seconds' and p.last_seen>t-interval '15 seconds'
 loop
  real_seen:=case when r.kept is not null and r.kept=r.last_seen then r.held_since else r.last_seen end;
  continue when real_seen<=t-interval '57 seconds';
  continue when eldervale_private.logout_combat_wait(r.user_id,t)<=0;
  insert into eldervale_private.logout_linger(user_id,real_seen,kept) values(r.user_id,real_seen,t-interval '12 seconds')
   on conflict (user_id) do update set real_seen=excluded.real_seen,kept=excluded.kept;
  update eldervale_private.realm_players set last_seen=t-interval '12 seconds' where user_id=r.user_id;
 end loop;
end $f$;
revoke all on function eldervale_private.logout_linger(timestamptz) from public;

do $do$
begin
 if position('logout_command' in pg_get_functiondef('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)'::regprocedure))=0 then
  perform eldervale_private.patch_function('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
   E'perform pg_advisory_xact_lock(736211); -- Lock order',
   E'perform pg_advisory_xact_lock(736211);\n' ||
   E' if command=''logout'' then return eldervale_private.logout_command($1);end if; -- Lock order']);
 end if;
 if position('logout_linger' in pg_get_functiondef('eldervale_private.world_tick()'::regprocedure))=0 then
  perform eldervale_private.patch_function('eldervale_private.world_tick()'::regprocedure,array[
   E'perform eldervale_private.mech_tick(t);',
   E'perform eldervale_private.mech_tick(t);' || E'perform eldervale_private.logout_linger(t);']);
 end if;
end $do$;
