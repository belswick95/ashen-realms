-- Eldervale tile-mode performance, part 2. APPLY AFTER tile-perf-1.sql. Idempotent; behaviour unchanged.
-- Owner report (Nov 6, 23:30 UTC): town NPCs walk, "the game stops", then they sprint to catch up.
-- Measured: the database CPU is starved (a 1M-row sum took 0.4-2.5 s, 5-25x its normal time), so
-- every millisecond of work per tick/request is multiplied; requests and ticks then hold advisory
-- lock 736211 for seconds, the tick waits behind them and catches up 3 tiles at once.
-- With one player in town (~90 actors in range, 3 world commands/s), the avoidable work was:
--  1 world_tick re-wrote every stationary NPC at home on every tick (47 UPDATEs/tick: CPU, WAL for
--    realtime to decode, and 5000+ dead realm_actors tuples). Now only when its reset is due.
--  2 diet_reply removed unchanged reply keys one at a time: ~13 full copies of a ~390 KB reply per
--    request. Now one removal.
--  3 diet_actors hashed every actor twice; now once.
--  4 tile_can_move ran 6 flag lookups and 2 recursive calls per diagonal step; now one statement.
--  5 Tiny SQL helpers (tile_mode, tile_flags_at, actor_tile_json, ...) carried SET search_path, which
--    blocks inlining: every call was a separate function execution. They reference only
--    schema-qualified objects, so the SET is dropped and the planner inlines them.
begin;
set local lock_timeout='2s';

-- 4. One statement for a diagonal step (same rules as before: target free, no corner cutting unless
-- corner_cutting, diagonal edge free). Orthogonal steps keep their two lookups.
create or replace function eldervale_private.tile_can_move(ti integer, tj integer, di integer, dj integer) returns boolean language plpgsql stable set search_path to '' as $fn$
declare ft integer;fx integer;fex integer;fz integer;fez integer;fd integer;cc boolean;
begin
 if di=0 and dj=0 then return true;end if;
 if abs(di)>1 or abs(dj)>1 then return false;end if;
 if di=0 or dj=0 then
  if eldervale_private.tile_flags_at(ti+di,tj+dj)&1<>0 then return false;end if;
  if dj=0 then return eldervale_private.tile_flags_at(least(ti,ti+di),tj)&2=0;end if;
  return eldervale_private.tile_flags_at(ti,least(tj,tj+dj))&4=0;
 end if;
 select eldervale_private.tile_flags_at(ti+di,tj+dj),eldervale_private.tile_flags_at(ti+di,tj),eldervale_private.tile_flags_at(least(ti,ti+di),tj),
  eldervale_private.tile_flags_at(ti,tj+dj),eldervale_private.tile_flags_at(ti,least(tj,tj+dj)),
  eldervale_private.tile_flags_at((case when di=dj then least(ti,ti+di) else greatest(ti,ti+di) end),least(tj,tj+dj)),
  coalesce((select (config->>'corner_cutting')::boolean from eldervale_private.tick_engine where id),false)
 into ft,fx,fex,fz,fez,fd,cc;
 if ft&1<>0 then return false;end if;
 -- No corner cutting (OSRS): both orthogonal neighbours and the edges to them must be free.
 -- corner_cutting=true relaxes this to 'not both neighbours blocked' (diagonal edge still sampled).
 if cc then
  if fx&1<>0 and fz&1<>0 then return false;end if;
 elsif not(fx&1=0 and fex&2=0 and fz&1=0 and fez&4=0) then return false;end if;
 -- NW from (i,j) is stored on (i,j); SE from (i,j) is the NW move of (i+1,j-1).
 if di=dj then return fd&8=0;end if;
 return fd&16=0;
end $fn$;

-- 5. Inlinable helpers: the live definition, without its SET clause.
do $inline$
declare fn text;def text;
begin
 foreach fn in array array['eldervale_private.tile_mode()','eldervale_private.engine_config()','eldervale_private.tile_flags_at(integer,integer)',
  'eldervale_private.actor_tile_json(text)','eldervale_private.tile_step_tiles(uuid)','eldervale_private.tile_motion_json(uuid)'] loop
  if (select proconfig is null or prosecdef from pg_proc where oid=fn::regprocedure) then continue;end if;
  def:=pg_get_functiondef(fn::regprocedure);
  if position(E'\n SET search_path TO \'\'\n' in def)=0 then raise exception '% has an unexpected SET clause',fn;end if;
  execute replace(def,E'\n SET search_path TO \'\'\n',E'\n');
 end loop;
end $inline$;

-- Live patches. Each edit is skipped once present; each anchor must match the live text exactly once.
do $patch$
declare fn text;old text;new text;body text;
begin
 for fn,old,new in select e->>0,e->>1,e->>2 from jsonb_array_elements($edits$[
  ["eldervale_private.world_tick()",
   "else 2+random()*3 end)*interval '1 second' where id=a.id;",
   "else 2+random()*3 end)*interval '1 second' where id=a.id and not(a.roam_x is null and coalesce(a.roam_pause_until>t,false) and jsonb_typeof(a.data->'route') is distinct from 'array' and coalesce((a.data->>'roam')::float8,0)<=0);"],
  ["eldervale_private.diet_reply(jsonb,jsonb,text[])",
   "declare r jsonb:=full_reply;digests jsonb:='{}'::jsonb;k text;digest text;",
   "declare r jsonb:=full_reply;digests jsonb:='{}'::jsonb;k text;digest text;unchanged text[]:='{}';"],
  ["eldervale_private.diet_reply(jsonb,jsonb,text[])",
   "if have->>k=digest then r:=r-k;end if;",
   "if have->>k=digest then unchanged:=unchanged||k;end if;"],
  ["eldervale_private.diet_reply(jsonb,jsonb,text[])",
   " return r||jsonb_build_object('digests',digests);",
   " return (r-unchanged)||jsonb_build_object('digests',digests);"],
  ["eldervale_private.diet_actors(uuid,jsonb,jsonb)",
   "where base->>(e->>'id') is distinct from left(md5(e::text),12);",
   "where base->>(e->>'id') is distinct from cur->>(e->>'id');"]
 ]$edits$::jsonb) e loop
  body:=pg_get_functiondef(fn::regprocedure);
  if position(new in body)>0 then continue;end if;
  perform eldervale_private.patch_function(fn::regprocedure,array[old,new]);
 end loop;
end $patch$;

commit;
