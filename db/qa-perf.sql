-- Eldervale QA performance pass (Nov 2026). NOT APPLIED. Review first; apply once, in a quiet minute.
-- Idempotent (every statement is "if not exists"); behaviour is unchanged: same rows, same order of
-- work, fewer full-table reads. No function bodies change, so no patch_function edits are needed.
--
-- Read-only evidence from live (pg_stat_user_tables / EXPLAIN, Nov 7 2026, one player online):
--  * realm_objects (3,049 rows): about one full sequential scan per second while the world is idle.
--    gathering_tick -> fishing_spot_drift() opens with
--      exists(select 1 from realm_objects o where o.kind='fishing' and ... moveAt <= t)
--    and EXPLAIN shows "Seq Scan on realm_objects" for it: ~3k rows read every tick to find 40.
--    Lifetime counters: 52.6M sequential scans, 150.6 billion rows read on this table.
--  * Every world command (sync polls every 250 ms per player) builds the reply's `objects` list with
--      from realm_objects where (kind='door' or available_at is not null) and sqrt(...)<220
--    another full scan of 3,049 rows to return ~116 candidates (50 doors + 66 depleted).
--  * realm_requests: the world_tick housekeeping that expires request ids older than a day filters
--    on created_at, which has no index (427k sequential scans, 1.43 billion rows read).
-- Each new index is partial or tiny (40, ~116 and ~1.4k rows), so builds take milliseconds.
--
-- DRY RUN: run this whole file with the final "commit;" replaced by "rollback;". It builds the
-- indexes inside the transaction and throws them away. While it is open you can check the plans:
--   explain select 1 from eldervale_private.realm_objects o where o.kind='fishing'
--     and jsonb_typeof(o.data->'moves'->'points')='array'
--     and coalesce((o.data->>'moveAt')::timestamptz,'-infinity'::timestamptz)<=now();
--   -- expect: Index Scan using realm_objects_fishing (was: Seq Scan on realm_objects)
--   explain select id from eldervale_private.realm_objects
--     where (kind='door' or available_at is not null) and sqrt(power(x-0,2)+power(z-0,2))<220;
--   -- expect: Index Scan / Bitmap scan on realm_objects_reply_objects
-- The 2 s lock timeout means the build gives up instead of queueing behind a world tick
-- (CREATE INDEX briefly blocks writes to that one table). If it times out, just run it again.
begin;
set local lock_timeout='2s';
set local statement_timeout='20s';

-- 1. Per-tick fishing-spot check: the 40 fishing spots, not all 3,049 objects.
create index if not exists realm_objects_fishing
 on eldervale_private.realm_objects (id) where kind='fishing';

-- 2. Per-command reply `objects`: doors and depleted nodes only (predicate copied verbatim from
--    realm_request_base so the planner can prove the query implies it).
create index if not exists realm_objects_reply_objects
 on eldervale_private.realm_objects (x, z) where (kind='door' or available_at is not null);

-- 3. world_tick expiry of old request ids (created_at < t - 1 day).
create index if not exists realm_requests_created_at
 on eldervale_private.realm_requests (created_at);

-- Fresh planner statistics for the two tables (cheap: a few thousand rows).
analyze eldervale_private.realm_objects;
analyze eldervale_private.realm_requests;

-- Sanity: all three indexes exist and are valid, or the transaction aborts.
do $check$
begin
 if (select count(*) from pg_index i join pg_class c on c.oid=i.indexrelid join pg_namespace n on n.oid=c.relnamespace
     where n.nspname='eldervale_private' and i.indisvalid
       and c.relname in ('realm_objects_fishing','realm_objects_reply_objects','realm_requests_created_at'))<>3 then
  raise exception 'qa-perf: expected 3 valid indexes';
 end if;
end $check$;

commit;
