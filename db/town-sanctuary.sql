-- Hostile creatures outside a boundary cannot strike players across the town boundary.
do $$declare body text;begin
 body:=pg_get_functiondef('eldervale_private.world_tick()'::regprocedure);
 body:=replace(body,'dist:=sqrt(power(a.x-target_player.x,2)+power(a.z-target_player.z,2));', $patch$if coalesce((a.data->>'hostile')::boolean,false) and eldervale_private.town_at(target_player.x,target_player.z) is not null then update eldervale_private.realm_actors set target=null,phase='ready' where id=a.id;continue;end if;
   dist:=sqrt(power(a.x-target_player.x,2)+power(a.z-target_player.z,2));$patch$);
 execute body;
end $$;
