-- Choose a destination, walk there at a normal pace, then rest. A moving
-- circular target made actors shuffle continuously after catching up to it.
alter table eldervale_private.realm_actors add column roam_x float8,add column roam_z float8,add column roam_pause_until timestamptz;
do $migration$
declare definition text;
begin
 definition:=pg_get_functiondef('eldervale_private.world_tick()'::regprocedure);
 if strpos(definition,$old$gx:=(a.data->>'x')::float8;gz:=(a.data->>'z')::float8;
   if coalesce((a.data->>'roam')::float8,0)>0 then gx:=gx+cos(extract(epoch from t)*.08+length(a.id))*(a.data->>'roam')::float8;gz:=gz+sin(extract(epoch from t)*.08+length(a.id))*(a.data->>'roam')::float8;end if;
   dx:=gx-a.x;dz:=gz-a.z;dist:=sqrt(dx*dx+dz*dz);if dist>.1 then step:=least(dt*(case when a.data->>'kind'='npc' then 2.0 else 1.35 end),dist);lx:=a.x+dx/dist*step;lz:=a.z+dz/dist*step;if eldervale_private.can_step(a.x,a.z,lx,lz) then update eldervale_private.realm_actors set x=lx,z=lz,yaw=atan2(dx,dz) where id=a.id;end if;end if;$old$)=0 then raise exception 'Expected roaming section not found';end if;
 execute replace(definition,$old$gx:=(a.data->>'x')::float8;gz:=(a.data->>'z')::float8;
   if coalesce((a.data->>'roam')::float8,0)>0 then gx:=gx+cos(extract(epoch from t)*.08+length(a.id))*(a.data->>'roam')::float8;gz:=gz+sin(extract(epoch from t)*.08+length(a.id))*(a.data->>'roam')::float8;end if;
   dx:=gx-a.x;dz:=gz-a.z;dist:=sqrt(dx*dx+dz*dz);if dist>.1 then step:=least(dt*(case when a.data->>'kind'='npc' then 2.0 else 1.35 end),dist);lx:=a.x+dx/dist*step;lz:=a.z+dz/dist*step;if eldervale_private.can_step(a.x,a.z,lx,lz) then update eldervale_private.realm_actors set x=lx,z=lz,yaw=atan2(dx,dz) where id=a.id;end if;end if;$old$,$new$gx:=(a.data->>'x')::float8;gz:=(a.data->>'z')::float8;
   if coalesce((a.data->>'roam')::float8,0)>0 then
    if a.roam_pause_until>t then continue;end if;
    if a.roam_x is null then
     chance:=random()*pi()*2;period:=(.5+random()*.5)*(a.data->>'roam')::float8;
     gx:=gx+cos(chance)*period;gz:=gz+sin(chance)*period;
     if not eldervale_private.can_step(a.x,a.z,gx,gz) then
      update eldervale_private.realm_actors set roam_pause_until=t+interval '1 second' where id=a.id;continue;
     end if;
     update eldervale_private.realm_actors set roam_x=gx,roam_z=gz where id=a.id;
    else gx:=a.roam_x;gz:=a.roam_z;end if;
   end if;
   dx:=gx-a.x;dz:=gz-a.z;dist:=sqrt(dx*dx+dz*dz);
   if dist<=.12 then
    update eldervale_private.realm_actors set roam_x=null,roam_z=null,roam_pause_until=t+(2+random()*3)*interval '1 second' where id=a.id;
   else
    step:=least(dt*(case when a.data->>'kind'='npc' then 2.0 else 1.35 end),dist);lx:=a.x+dx/dist*step;lz:=a.z+dz/dist*step;
    if eldervale_private.can_step(a.x,a.z,lx,lz) then
     update eldervale_private.realm_actors set x=lx,z=lz,yaw=atan2(dx,dz) where id=a.id;
    else update eldervale_private.realm_actors set roam_x=null,roam_z=null,roam_pause_until=t+interval '1 second' where id=a.id;end if;
   end if;$new$);
end $migration$;
