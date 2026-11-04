-- Disable the obsolete instant ore reward; all mining uses the validated job engine.
do $$declare body text;old text:=$old$     elsif o.kind='rock' and (o.available_at is null or o.available_at<=t) then
      if coalesce(eldervale_private.inventory_used(p.user_id),0)>=16 then perform eldervale_private.emit(jsonb_build_object('type','notice','player',p.user_id,'text','Your inventory is full.'));
      else perform eldervale_private.item_change(p.user_id,case when o.kind='tree' then 'wood' else 'ore' end,1);sid:=case when o.kind='tree' then 'woodXP' else 'miningXP' end;update public.player_saves set stats=stats||jsonb_build_object(sid,coalesce((stats->>sid)::integer,0)+25) where user_id=p.user_id;update eldervale_private.realm_objects set available_at=t+interval '30 seconds' where id=o.id;perform eldervale_private.emit(jsonb_build_object('type','gather','player',p.user_id,'target',o.id,'availableAt',t+interval '30 seconds'));end if;
$old$;begin
 select pg_get_functiondef('eldervale_private.world_tick()'::regprocedure) into body;
 if strpos(body,old)=0 then raise exception 'Legacy rock hook changed';end if;
 execute replace(body,old,$new$     elsif o.kind='rock' then
      perform eldervale_private.emit(jsonb_build_object('type','notice','player',p.user_id,'text','Use Mine rock to start timed mining.'));
$new$);
end $$;
