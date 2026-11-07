-- Eldervale tile routes follow the line to the marker. APPLY AFTER tile-perf-1.sql and
-- underground-1-engine.sql (it patches the live tile_route text). Idempotent.
-- Owner report (Nov 7): after a click to walk, run or ride, the player heads off to one side of the
-- marker, then swings over to the other side and only slowly lines up with it.
-- tile_route traced its path back along each tile's first-found BFS parent. With neighbours in the
-- order W E S N SW SE NW NE, that puts every straight step first and every diagonal last: a click 10
-- tiles east and 3 north walked 7 tiles due east, then 3 north-east. The route keeps its length (a
-- shortest route on the same grid, same corner rules); only the choice between equally short routes
-- changes: going back from the end, it takes the one-step-shorter parent that can step there and lies
-- closest to the straight line from the start to the end (ties: the first-found parent, as before).
-- The client mirror is tile-grid.js bfsRoute (tests/click-walk-heading.test.js).
begin;
set local lock_timeout='5s';

do $patch$
declare fn regprocedure:='eldervale_private.tile_route(integer,integer,text,integer,integer,double precision,double precision,double precision,integer,integer,boolean,boolean)'::regprocedure;
begin
 if position('depth[idx+1]' in pg_get_functiondef(fn))>0 then return;end if;
 perform eldervale_private.patch_function(fn,array[
  'prev integer[];queue integer[];',
  'prev integer[];depth integer[];queue integer[];ex integer;ez integer;nxt integer;off numeric;',
  'prev:=array_fill(-1,array[n]);',
  'prev:=array_fill(-1,array[n]);depth:=array_fill(0,array[n]);',
  'prev[idx+1]:=cur;tail:=tail+1;queue[tail]:=idx;',
  'prev[idx+1]:=cur;depth[idx+1]:=depth[cur+1]+1;tail:=tail+1;queue[tail]:=idx;',
  E' k:=found;\n while k<>radius*w+radius and steps<n loop\n  path:=jsonb_build_array(jsonb_build_array(eldervale_private.tile_center(k%w+ox),eldervale_private.tile_center(k/w+oz)))||path;\n  k:=prev[k+1];steps:=steps+1;\n end loop;',
  E' k:=found;ex:=found%w-radius;ez:=found/w-radius;\n'||
  E' while k<>radius*w+radius and steps<n loop\n'||
  E'  ci:=k%w;cj:=k/w;\n'||
  E'  path:=jsonb_build_array(jsonb_build_array(eldervale_private.tile_center(ci+ox),eldervale_private.tile_center(cj+oz)))||path;\n'||
  E'  -- The one-step-shorter parent closest to the start-end line (|cross product|) that can step here.\n'||
  E'  nxt:=prev[k+1];off:=abs((nxt%w-radius)*ez-(nxt/w-radius)*ex);\n'||
  E'  for d in 1..8 loop\n'||
  E'   di:=dis[d];dj:=djs[d];wi:=ci-di;wj:=cj-dj;\n'||
  E'   if wi<0 or wj<0 or wi>=w or wj>=w then continue;end if;\n'||
  E'   idx:=wj*w+wi;\n'||
  E'   if idx=nxt or prev[idx+1]<0 or depth[idx+1]<>depth[k+1]-1 then continue;end if;\n'||
  E'   if dj=0 then f:=fl[wj*w+least(wi,ci)+1]&2;\n'||
  E'   elsif di=0 then f:=fl[least(wj,cj)*w+wi+1]&4;\n'||
  E'   elsif fl[wj*w+ci+1]&1<>0 and fl[cj*w+wi+1]&1<>0 then f:=1;\n'||
  E'   elsif strict and (fl[wj*w+ci+1]&1<>0 or fl[cj*w+wi+1]&1<>0 or fl[wj*w+least(wi,ci)+1]&2<>0 or fl[least(wj,cj)*w+wi+1]&4<>0) then f:=1;\n'||
  E'   elsif di=dj then f:=fl[least(wj,cj)*w+least(wi,ci)+1]&8;\n'||
  E'   else f:=fl[least(wj,cj)*w+greatest(wi,ci)+1]&16;end if;\n'||
  E'   if f<>0 then continue;end if;\n'||
  E'   dd:=abs((wi-radius)*ez-(wj-radius)*ex);\n'||
  E'   if dd<off then off:=dd;nxt:=idx;end if;\n'||
  E'  end loop;\n'||
  E'  k:=nxt;steps:=steps+1;\n'||
  E' end loop;']);
end $patch$;

commit;
