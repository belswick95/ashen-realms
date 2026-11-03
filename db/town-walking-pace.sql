-- Human NPCs use an ordinary walking cadence; creature roaming is unchanged.
do $$declare definition text;begin
 definition:=pg_get_functiondef('eldervale_private.world_tick()'::regprocedure);
 if strpos(definition,'step:=least(dt*1.35,dist)')=0 then raise exception 'Expected roaming movement expression not found';end if;
 execute replace(definition,'step:=least(dt*1.35,dist)','step:=least(dt*(case when a.data->>''kind''=''npc'' then 2.0 else 1.35 end),dist)');
end $$;
