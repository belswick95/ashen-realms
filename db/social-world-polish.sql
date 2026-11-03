-- Guards outlevel hostile creatures in their surrounding area before an intrusion begins.
do $$declare body text;begin
 body:=pg_get_functiondef('eldervale_private.guard_tick(float8)'::regprocedure);
 body:=replace(body,' delete from eldervale_private.guard_duels d where', $body$
 update eldervale_private.realm_actors guard_row set data=guard_row.data||jsonb_build_object('level',levels.n,'attackLevel',levels.n,'strengthLevel',levels.n,'defenceLevel',levels.n,'weapon','longsword','hp',greatest((guard_row.data->>'hp')::integer,levels.n*5)),hp=case when guard_row.hp>0 then guard_row.hp+greatest(0,levels.n*5-(guard_row.data->>'hp')::integer) else guard_row.hp end from (select a.id,greatest(60,(a.data->>'level')::integer,coalesce((select max((beast.data->>'level')::integer)+5 from eldervale_private.realm_actors beast where not beast.deleted and coalesce((beast.data->>'hostile')::boolean,false) and abs(beast.x-a.x)<100 and abs(beast.z-a.z)<100),0))n from eldervale_private.realm_actors a where not a.deleted and a.data->>'role'='guard') levels where guard_row.id=levels.id and ((guard_row.data->>'level')::integer<levels.n or (guard_row.data->>'hp')::integer<levels.n*5 or guard_row.data->>'weapon' is distinct from 'longsword');
 delete from eldervale_private.guard_duels d where$body$);
 execute body;
end $$;
