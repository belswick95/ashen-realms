-- Movement v3 (OSRS): a click walks the tiles the client shows, from the tile the player is on.
-- APPLY AFTER tile-route-osrs.sql. Idempotent (skipped once applied). NOT YET APPLIED.
-- Owner report on move157: "it's going to the left before walking", "it surges and then walks".
-- Live (Nov 2026, read-only probe): a redirect mid-walk made the server take one more step along the
-- OLD route, then turn back: tile_plan_move kept "the step in progress" (payload 'walking' -> keep_step)
-- and planned the new route from old path[0], so the walker moved away from the new target first
-- (seen: (-213,-207) -> (-214,-206) -> back to (-213,-207) -> (-213,-208)). And a walk from rest could be
-- credited with ticks that began before the click (a catch-up run moves up to two ticks at once), so
-- the server could be two ticks ahead of the walker the client starts at the click.
-- The client (movement v3, motion-track.js createLocalWalker) now plans the click itself with the
-- same BFS (tile-grid.js planTileMove) from the tile it shows the player on, walks it at once at the
-- true pace, and sends that tile as payload 'from' [i,j]. This patch makes tile_plan_move:
--  - plan from `from` when it is the walker's tile, or a tile of its current route still ahead (at
--    most 8 tiles on); the route up to it is kept, so every tile is still walked at one step per
--    tick (no teleport, no speed gain); any other `from` (behind, elsewhere) plans from the walker's
--    tile. A move carrying `from` never keeps the step in progress. Old clients (no `from`) keep the
--    old behaviour.
--  - start a walk from rest on the next tick: motion_at moves up to the start of the current tick, so
--    advance_player_tiles never credits the walk with a tick that began before the click.
begin;
set local lock_timeout='5s';

do $patch$
declare fn regprocedure:='eldervale_private.tile_plan_move(uuid,jsonb)'::regprocedure;
begin
 if position('-- Movement v3:' in pg_get_functiondef(fn))>0 then return;end if;
 perform eldervale_private.patch_function(fn,array[
  E'keep_step boolean:=false;\nbegin\n',
  E'keep_step boolean:=false;fi integer;fj integer;keep jsonb:=\'[]\'::jsonb;idle boolean;\nbegin\n',
  E' -- Already walking: keep the step in progress and plan from the tile being stepped onto.\n',
  E' -- Movement v3: the client walks a click at once from the tile it shows the player on (`from`).\n'||
  E' -- That tile, when it is the walker\'s tile or one of its route still ahead (at most 8 tiles on),\n'||
  E' -- starts the new route, and the route up to it is kept (each tile still takes its tick); any\n'||
  E' -- other `from` plans from the walker\'s tile. Never the step in progress (it walked away first).\n'||
  E' idle:=coalesce(jsonb_array_length(case when jsonb_typeof(payload->\'walking\')=\'array\' then payload->\'walking\' end),0)=0;\n'||
  E' if jsonb_typeof(payload->\'from\')=\'array\' and jsonb_typeof(payload->\'from\'->0)=\'number\' and jsonb_typeof(payload->\'from\'->1)=\'number\' then\n'||
  E'  fi:=floor((payload->\'from\'->>0)::float8)::integer;fj:=floor((payload->\'from\'->>1)::float8)::integer;\n'||
  E'  if (fi<>ci or fj<>cj) and not idle then\n'||
  E'   for k in 0..least(jsonb_array_length(payload->\'walking\'),8)-1 loop\n'||
  E'    keep:=keep||jsonb_build_array(payload->\'walking\'->k);\n'||
  E'    if eldervale_private.tile_of((payload->\'walking\'->k->>0)::float8)=fi and eldervale_private.tile_of((payload->\'walking\'->k->>1)::float8)=fj then ci:=fi;cj:=fj;exit;end if;\n'||
  E'   end loop;\n'||
  E'   if ci<>fi or cj<>fj then keep:=\'[]\'::jsonb;end if;\n'||
  E'  end if;\n'||
  E'  payload:=payload-\'walking\';\n'||
  E' end if;\n'||
  E' -- Already walking: keep the step in progress and plan from the tile being stepped onto.\n',
  E' update eldervale_private.realm_players set path=coalesce(p.path,\'[]\'::jsonb) where user_id=uid;\n',
  E' if jsonb_array_length(keep)>0 then p.path:=keep||coalesce(p.path,\'[]\'::jsonb);end if;\n'||
  E' -- A walk from rest starts on the next tick (never credited with a tick begun before the click).\n'||
  E' update eldervale_private.realm_players set path=coalesce(p.path,\'[]\'::jsonb),\n'||
  E'  motion_at=(case when idle and jsonb_array_length(coalesce(p.path,\'[]\'::jsonb))>0 then greatest(motion_at,eldervale_private.tick_time(eldervale_private.tick_no(clock_timestamp()))) else motion_at end)\n'||
  E'  where user_id=uid;\n']);
end $patch$;

commit;

-- DRY RUN (changes nothing): run the block below on its own, instead of the patch above. It applies
-- the same patch inside a DO block, checks the new text is there and compiles, and raises: the
-- exception rolls the whole block back (no player row is read or written).
/*
do $dry$
declare fn regprocedure:='eldervale_private.tile_plan_move(uuid,jsonb)'::regprocedure;def text;
begin
 perform set_config('lock_timeout','5s',true);
 if position('-- Movement v3:' in pg_get_functiondef(fn))>0 then raise exception 'DRY RUN: already applied';end if;
 perform eldervale_private.patch_function(fn,array[
  E'keep_step boolean:=false;\nbegin\n',
  E'keep_step boolean:=false;fi integer;fj integer;keep jsonb:=\'[]\'::jsonb;idle boolean;\nbegin\n',
  E' -- Already walking: keep the step in progress and plan from the tile being stepped onto.\n',
  E' -- Movement v3: the client walks a click at once from the tile it shows the player on (`from`).\n'||
  E' -- That tile, when it is the walker\'s tile or one of its route still ahead (at most 8 tiles on),\n'||
  E' -- starts the new route, and the route up to it is kept (each tile still takes its tick); any\n'||
  E' -- other `from` plans from the walker\'s tile. Never the step in progress (it walked away first).\n'||
  E' idle:=coalesce(jsonb_array_length(case when jsonb_typeof(payload->\'walking\')=\'array\' then payload->\'walking\' end),0)=0;\n'||
  E' if jsonb_typeof(payload->\'from\')=\'array\' and jsonb_typeof(payload->\'from\'->0)=\'number\' and jsonb_typeof(payload->\'from\'->1)=\'number\' then\n'||
  E'  fi:=floor((payload->\'from\'->>0)::float8)::integer;fj:=floor((payload->\'from\'->>1)::float8)::integer;\n'||
  E'  if (fi<>ci or fj<>cj) and not idle then\n'||
  E'   for k in 0..least(jsonb_array_length(payload->\'walking\'),8)-1 loop\n'||
  E'    keep:=keep||jsonb_build_array(payload->\'walking\'->k);\n'||
  E'    if eldervale_private.tile_of((payload->\'walking\'->k->>0)::float8)=fi and eldervale_private.tile_of((payload->\'walking\'->k->>1)::float8)=fj then ci:=fi;cj:=fj;exit;end if;\n'||
  E'   end loop;\n'||
  E'   if ci<>fi or cj<>fj then keep:=\'[]\'::jsonb;end if;\n'||
  E'  end if;\n'||
  E'  payload:=payload-\'walking\';\n'||
  E' end if;\n'||
  E' -- Already walking: keep the step in progress and plan from the tile being stepped onto.\n',
  E' update eldervale_private.realm_players set path=coalesce(p.path,\'[]\'::jsonb) where user_id=uid;\n',
  E' if jsonb_array_length(keep)>0 then p.path:=keep||coalesce(p.path,\'[]\'::jsonb);end if;\n'||
  E' -- A walk from rest starts on the next tick (never credited with a tick begun before the click).\n'||
  E' update eldervale_private.realm_players set path=coalesce(p.path,\'[]\'::jsonb),\n'||
  E'  motion_at=(case when idle and jsonb_array_length(coalesce(p.path,\'[]\'::jsonb))>0 then greatest(motion_at,eldervale_private.tick_time(eldervale_private.tick_no(clock_timestamp()))) else motion_at end)\n'||
  E'  where user_id=uid;\n']);
 def:=pg_get_functiondef(fn);
 raise exception 'DRY RUN, rolled back. patched=% from=% rest_tick=% keep=%',
  position('-- Movement v3:' in def)>0,position('payload->''from''' in def)>0,position('motion_at=(case when idle' in def)>0,position('p.path:=keep||' in def)>0;
end $dry$;
*/
