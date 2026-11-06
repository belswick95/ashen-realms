-- Eldervale world tick performance and lock-order fix. APPLY AFTER db/monster-roster.sql.
-- Idempotent (every edit is skipped once present) and safe to apply on a running game: it only
-- replaces function bodies and builds one small partial index; no table data changes.
--
-- Measured on live (369 actors, 2 827 world objects, 0 players online) before this file:
--   world_tick 290-445 ms per run (cron and EVERY player command: realm_request_base runs
--   world_tick inline while holding advisory lock 736211, so a sync/move took 415-630 ms and
--   every other command waited behind it -> frozen walking, rubber-banding).
--   * can_step() 4.4 ms per call (five nested seq scans of realm_objects/entities); 124-146
--     roaming actors call it every tick -> ~550 ms. Range predicates on the (x,z) index: 0.55 ms.
--   * Every idle actor in the world was simulated each tick although nobody was near it.
--   * guard_tick ~40-65 ms per run, also with nobody online.
--   * Deadlocks: a command took row locks (realm_players FK/updates) in the outer request
--     wrappers before the advisory lock while world_tick held the advisory lock and waited for
--     that row (logs 00:20-01:35 UTC).
--
-- Changes:
--  1. can_step chain (can_step, _before_stories, _before_professions, _before_castle,
--     _before_props): add index-usable x/z range bounds next to the existing abs() bounds
--     (results identical; verified 0 mismatches over 2 952 sample steps on live data).
--     Partial index for castle walls/gates/towers.
--  2. town_at: plpgsql (cached plan) instead of a non-inlinable SQL function; same result.
--  3. world_tick: idle actors (alive, no target) only think/roam when a player who was seen in
--     the last 15 s is within 100 m (the client draws actors within 85 m), as OSRS only
--     processes NPCs near players. Fighting, dead/respawning actors are always processed.
--     guard_tick runs only while someone is online, and only matches monsters near players.
--  4. realm_request (the entry point of every player command) takes advisory lock 736211 first,
--     so every command locks in the same order as world_tick (advisory lock, then rows).
begin;
set local lock_timeout='5s';

-- 1a. Castle parts index (entities is ~1 000 rows: builds in milliseconds).
create index if not exists entities_castle_parts on eldervale_private.entities(((data->>'x')::float8))
 where not deleted and data->>'template' in ('castle_wall','castle_gate','castle_tower');

-- 1b. Index-usable bounds in the collision chain.
do $collision$
declare fn text;old text;new text;body text;
begin
 for fn,old,new in select e->>0,e->>1,e->>2 from jsonb_array_elements($edits$[
  ["eldervale_private.can_step(double precision,double precision,double precision,double precision)",
   "where abs(x-bx)<18 and abs(z-bz)<18 and coalesce((data->>'floor')::integer,0)=story",
   "where x>bx-18 and x<bx+18 and z>bz-18 and z<bz+18 and abs(x-bx)<18 and abs(z-bz)<18 and coalesce((data->>'floor')::integer,0)=story"],
  ["eldervale_private.can_step_before_castle(double precision,double precision,double precision,double precision)",
   "kind='door' and abs(x-bx)<25 and abs(z-bz)<25 loop",
   "kind='door' and x>bx-25 and x<bx+25 and z>bz-25 and z<bz+25 and abs(x-bx)<25 and abs(z-bz)<25 loop"],
  ["eldervale_private.can_step_before_professions(double precision,double precision,double precision,double precision)",
   "where coalesce((data->>'floor')::integer,0)=0 and abs(x-bx)<15 and abs(z-bz)<15 and",
   "where coalesce((data->>'floor')::integer,0)=0 and x>bx-15 and x<bx+15 and z>bz-15 and z<bz+15 and abs(x-bx)<15 and abs(z-bz)<15 and"],
  ["eldervale_private.can_step_before_stories(double precision,double precision,double precision,double precision)",
   "where coalesce((data->>'floor')::integer,0)=0 and abs(x-bx)<10 and abs(z-bz)<10 and",
   "where coalesce((data->>'floor')::integer,0)=0 and x>bx-10 and x<bx+10 and z>bz-10 and z<bz+10 and abs(x-bx)<10 and abs(z-bz)<10 and"],
  ["eldervale_private.can_step_before_props(double precision,double precision,double precision,double precision)",
   "and abs((data->>'x')::float8-bx)<80 and abs((data->>'z')::float8-bz)<80 loop",
   "and (data->>'x')::float8>bx-80 and (data->>'x')::float8<bx+80 and abs((data->>'x')::float8-bx)<80 and abs((data->>'z')::float8-bz)<80 loop"]
 ]$edits$::jsonb) e loop
  body:=pg_get_functiondef(fn::regprocedure);
  if position(new in body)>0 then continue;end if;
  perform eldervale_private.patch_function(fn::regprocedure,array[old,new]);
 end loop;
end $collision$;

-- 2. Town lookup with a cached plan.
create or replace function eldervale_private.town_at(px double precision, pz double precision)
returns text language plpgsql stable set search_path to '' as $fn$
begin
 return (select id from eldervale_private.town_zones where case when square then greatest(abs(px-x),abs(pz-z))<radius else power(px-x,2)+power(pz-z,2)<radius*radius end order by power(px-x,2)+power(pz-z,2) limit 1);
end $fn$;

-- 3. Only simulate idle actors near players; guards only while players are online.
do $tick$
declare fn text;old text;new text;body text;
begin
 for fn,old,new in select e->>0,e->>1,e->>2 from jsonb_array_elements($edits$[
  ["eldervale_private.world_tick()",
   "union all select monster from eldervale_private.guard_duels) order by id loop",
   "union all select monster from eldervale_private.guard_duels) and (hp<=0 or target is not null or exists(select 1 from eldervale_private.realm_players near_player where near_player.last_seen>t-interval '15 seconds' and abs(near_player.x-realm_actors.x)<100 and abs(near_player.z-realm_actors.z)<100)) order by id loop"],
  ["eldervale_private.world_tick()",
   "perform eldervale_private.guard_tick(dt);",
   "if exists(select 1 from eldervale_private.realm_players where last_seen>t-interval '15 seconds') then perform eldervale_private.guard_tick(dt);end if;"],
  ["eldervale_private.guard_tick(double precision)",
   "and not exists(select 1 from eldervale_private.guard_duels where monster=a.id) loop",
   "and not exists(select 1 from eldervale_private.guard_duels where monster=a.id) and exists(select 1 from eldervale_private.realm_players near_player where near_player.last_seen>t-interval '15 seconds' and abs(near_player.x-a.x)<100 and abs(near_player.z-a.z)<100) loop"],
  ["eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)",
   " -- Establish the session through the existing authenticated command path before floor actions.",
   " perform pg_advisory_xact_lock(736211); -- Lock order: advisory lock before any row lock (as world_tick), so commands never deadlock with the tick.\n -- Establish the session through the existing authenticated command path before floor actions."]
 ]$edits$::jsonb) e loop
  body:=pg_get_functiondef(fn::regprocedure);
  if position(new in body)>0 then continue;end if;
  perform eldervale_private.patch_function(fn::regprocedure,array[old,new]);
 end loop;
end $tick$;

commit;
