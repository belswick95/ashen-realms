-- Eldervale tile routes take the OSRS shape: diagonal first, then straight. APPLY AFTER
-- tile-route-line.sql (it patches the live heading144 tile_route text). Idempotent.
-- Owner report (after heading144): walking, running and riding zig-zag; a horse swings side to side
-- instead of travelling a straight trail to the clicked spot.
-- heading144 traced the route back along the shortest-route parents closest to the start-end line.
-- On a slope that interleaves straight and diagonal steps (E, NE, E, E, NE ...): a zig-zag, faced
-- step by step. OSRS walks DIAGONALLY until level with the target on one axis, then STRAIGHT: a
-- click 10 east, 3 north walks NE, NE, NE, then E x7 (one clean bend). Traced back from the end,
-- each tile now takes the one-step-shorter parent whose step into it is that shape's step (straight
-- along the longer axis of what is left from the start; diagonal once both are equal). Around walls
-- (no such parent) it takes the parent whose step points closest to it (ties: the first-found
-- parent). The length and the corner rules do not change; only the choice between equally short
-- routes. Client mirror: tile-grid.js bfsRoute (tests/click-walk-heading.test.js).
begin;
set local lock_timeout='5s';

do $patch$
declare fn regprocedure:='eldervale_private.tile_route(integer,integer,text,integer,integer,double precision,double precision,double precision,integer,integer,boolean,boolean)'::regprocedure;
begin
 if position('-- OSRS route shape' in pg_get_functiondef(fn))>0 then return;end if;
 perform eldervale_private.patch_function(fn,array[
  'k:=found;ex:=found%w-radius;ez:=found/w-radius;',
  'k:=found;',
  E'  -- The one-step-shorter parent closest to the start-end line (|cross product|) that can step here.\n'||E'  nxt:=prev[k+1];off:=abs((nxt%w-radius)*ez-(nxt/w-radius)*ex);\n',
  E'  -- OSRS route shape: diagonal first, then straight. (ex,ez) is the step into this tile on that\n'||E'  -- shape, from what is left of the route from the start; take the one-step-shorter parent whose\n'||E'  -- step is closest in direction to it (-cos of the angle between them; first-found on ties).\n'||E'  ex:=case when abs(ci-radius)>=abs(cj-radius) then sign(ci-radius)::integer else 0 end;\n'||E'  ez:=case when abs(cj-radius)>=abs(ci-radius) then sign(cj-radius)::integer else 0 end;\n'||E'  nxt:=prev[k+1];off:=-((ci-nxt%w)*ex+(cj-nxt/w)*ez)/sqrt((abs(ci-nxt%w)+abs(cj-nxt/w))::numeric);\n',
  E'   dd:=abs((wi-radius)*ez-(wj-radius)*ex);\n',
  E'   dd:=-(di*ex+dj*ez)/sqrt((abs(di)+abs(dj))::numeric);\n']);
end $patch$;

commit;

-- DRY RUN (changes nothing): run the block below on its own, instead of the patch above. It applies
-- the same patch inside a DO block, routes the same click before and after, and raises both: the
-- exception rolls the whole block back. Paths are [x,z] tile centres from tile (-138,91) to (-128,88).
/*
do $dry$
declare fn regprocedure:='eldervale_private.tile_route(integer,integer,text,integer,integer,double precision,double precision,double precision,integer,integer,boolean,boolean)'::regprocedure;
 before jsonb;after jsonb;
begin
 perform set_config('lock_timeout','5s',true);
 before:=eldervale_private.tile_route(-138,91,'tile',-128,88,-128*1.58,88*1.58,0,32,10,false);
 perform eldervale_private.patch_function(fn,array[
  'k:=found;ex:=found%w-radius;ez:=found/w-radius;',
  'k:=found;',
  E'  -- The one-step-shorter parent closest to the start-end line (|cross product|) that can step here.\n'||E'  nxt:=prev[k+1];off:=abs((nxt%w-radius)*ez-(nxt/w-radius)*ex);\n',
  E'  -- OSRS route shape: diagonal first, then straight. (ex,ez) is the step into this tile on that\n'||E'  -- shape, from what is left of the route from the start; take the one-step-shorter parent whose\n'||E'  -- step is closest in direction to it (-cos of the angle between them; first-found on ties).\n'||E'  ex:=case when abs(ci-radius)>=abs(cj-radius) then sign(ci-radius)::integer else 0 end;\n'||E'  ez:=case when abs(cj-radius)>=abs(ci-radius) then sign(cj-radius)::integer else 0 end;\n'||E'  nxt:=prev[k+1];off:=-((ci-nxt%w)*ex+(cj-nxt/w)*ez)/sqrt((abs(ci-nxt%w)+abs(cj-nxt/w))::numeric);\n',
  E'   dd:=abs((wi-radius)*ez-(wj-radius)*ex);\n',
  E'   dd:=-(di*ex+dj*ez)/sqrt((abs(di)+abs(dj))::numeric);\n']);
 after:=eldervale_private.tile_route(-138,91,'tile',-128,88,-128*1.58,88*1.58,0,32,10,false);
 raise exception 'DRY RUN, rolled back. before: % after: %',before->'path',after->'path';
end $dry$;
*/
