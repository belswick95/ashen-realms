-- Editing or relocating an actor must discard a destination from its old home.
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('eldervale_private.entity_runtime()'::regprocedure);
 if strpos(definition,'deleted=excluded.deleted,target=null')=0 then raise exception 'Expected entity actor update not found';end if;
 execute replace(definition,'deleted=excluded.deleted,target=null','deleted=excluded.deleted,roam_x=null,roam_z=null,roam_pause_until=null,target=null');
end $migration$;
