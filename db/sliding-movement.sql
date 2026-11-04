-- Preserve server authority, speed limits, collision geometry and function privileges.
create or replace function eldervale_private.slide_step(px float8,pz float8,lx float8,lz float8,sliding boolean default true) returns float8[] language plpgsql stable set search_path='' as $$
declare xf boolean;zf boolean;
begin
 if eldervale_private.can_step(px,pz,lx,lz) then return array[lx,lz];end if;
 if not sliding then return null;end if;
 xf:=abs(lx-px)>.000001 and eldervale_private.can_step(px,pz,lx,pz);
 zf:=abs(lz-pz)>.000001 and eldervale_private.can_step(px,pz,px,lz);
 if xf and (not zf or abs(lx-px)>=abs(lz-pz)) then return array[lx,pz];end if;
 if zf then return array[px,lz];end if;
 return null;
end $$;
revoke all on function eldervale_private.slide_step(float8,float8,float8,float8,boolean) from public,anon,authenticated;

-- Abort on concurrent code changes; replace only the reviewed movement fragments.
do $patch$ declare f jsonb;c jsonb;definition text;begin
 for f in select value from jsonb_array_elements($changes$[{"signature":"world_tick()","hash":"ebf0b924784e0e434ce4d22053bce45e","changes":[{"before":"riding boolean;travel_speed float8;","after":"riding boolean;travel_speed float8;slide float8[];"},{"before":"   if not eldervale_private.can_step(p.x,p.z,lx,lz) then p.path:='[]';p.intent:=null;exit;end if;","after":"   slide:=eldervale_private.slide_step(p.x,p.z,lx,lz,coalesce(p.input_until>t,false));\n   if slide is null then p.path:='[]';p.intent:=null;exit;end if;\n   lx:=slide[1];lz:=slide[2];"}]},{"signature":"realm_request_base(uuid,text,jsonb,uuid,bigint)","hash":"7c0f2aeeafdac757acd7c8dfc343e9cc","changes":[{"before":"'run',r.run,'mounted'","after":"'run',r.run,'moving',coalesce(r.input_until>clock_timestamp() and abs(r.input_x)+abs(r.input_z)>.001,false),'mounted'"}]}]$changes$::jsonb) loop
 select pg_get_functiondef(('eldervale_private.'||(f->>'signature'))::regprocedure) into definition;
 if md5(definition)<>f->>'hash' then raise exception 'Movement function changed: %',f->>'signature';end if;
 for c in select value from jsonb_array_elements(f->'changes') loop
 if length(definition)-length(replace(definition,c->>'before',''))<>length(c->>'before') then raise exception 'Movement fragment missing or duplicated';end if;
 definition:=replace(definition,c->>'before',c->>'after');end loop;execute definition;end loop;
end $patch$;
