-- Seamless walk redirection (OSRS): a new click while walking replaces the destination without a
-- stop. APPLY AFTER db/tick-tile-engine-2-players.sql. Idempotent; safe on a running game.
-- Legacy free movement needs no server change (move only swaps the path; the client fixes are in
-- game.js / click-walk.js). Tile mode: a walker that is mid-step keeps the step it is taking -
-- the new route is planned from the tile it is stepping onto, which stays the first step of the
-- new path - so the next tick continues moving instead of stopping and turning on the old tile.
begin;
set local lock_timeout='5s';

do $patch$
declare body text;
begin
 -- The move command hands the planner the path the walker was following.
 body:=pg_get_functiondef('eldervale_private.realm_request_base(uuid,text,jsonb,uuid,bigint)'::regprocedure);
 if position('tile_plan_move(auth.uid(),payload||jsonb_build_object(''walking'',p.path))' in body)=0 then
  perform eldervale_private.patch_function('eldervale_private.realm_request_base(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
   'perform eldervale_private.tile_plan_move(auth.uid(),payload);',
   'perform eldervale_private.tile_plan_move(auth.uid(),payload||jsonb_build_object(''walking'',p.path));']);
 end if;
 body:=pg_get_functiondef('eldervale_private.tile_plan_move(uuid,jsonb)'::regprocedure);
 if position('keep_step' in body)=0 then
  perform eldervale_private.patch_function('eldervale_private.tile_plan_move(uuid,jsonb)'::regprocedure,array[
   ' g jsonb;r jsonb;route jsonb:=''[]''::jsonb;ci integer;cj integer;w jsonb;k integer;',
   ' g jsonb;r jsonb;route jsonb:=''[]''::jsonb;ci integer;cj integer;w jsonb;k integer;ni integer;nj integer;keep_step boolean:=false;',
   ' ci:=eldervale_private.tile_of(p.x);cj:=eldervale_private.tile_of(p.z);'||chr(10),
   ' ci:=eldervale_private.tile_of(p.x);cj:=eldervale_private.tile_of(p.z);'||chr(10)||
   ' -- Already walking: keep the step in progress and plan from the tile being stepped onto.'||chr(10)||
   ' if jsonb_typeof(payload->''walking'')=''array'' and jsonb_typeof(payload->''walking''->0)=''array'' then'||chr(10)||
   '  ni:=eldervale_private.tile_of((payload->''walking''->0->>0)::float8);nj:=eldervale_private.tile_of((payload->''walking''->0->>1)::float8);'||chr(10)||
   '  if (ni<>ci or nj<>cj) and abs(ni-ci)<=1 and abs(nj-cj)<=1 and eldervale_private.tile_can_move(ci,cj,ni-ci,nj-cj) then keep_step:=true;ci:=ni;cj:=nj;end if;'||chr(10)||
   ' end if;'||chr(10),
   ' update eldervale_private.realm_players set path=coalesce(p.path,''[]''::jsonb) where user_id=uid;',
   ' if keep_step then p.path:=jsonb_build_array(jsonb_build_array(eldervale_private.tile_center(ci),eldervale_private.tile_center(cj)))||coalesce(p.path,''[]''::jsonb);end if;'||chr(10)||
   ' update eldervale_private.realm_players set path=coalesce(p.path,''[]''::jsonb) where user_id=uid;']);
 end if;
end $patch$;

commit;
