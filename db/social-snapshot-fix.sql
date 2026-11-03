create or replace function eldervale_private.realm_request(session_id uuid,command text default 'sync',payload jsonb default '{}',request_id uuid default null,event_cursor bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare p eldervale_private.realm_players;q eldervale_private.realm_players;d eldervale_private.ground_drops;tr eldervale_private.trades;partner uuid;result jsonb;k text;v jsonb;item text;n integer;offer jsonb;dup boolean;who uuid;other uuid;offer_from jsonb;gold_delta bigint;
begin
 if not eldervale_private.allowed() then raise exception 'World access denied' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>24000 then raise exception 'Invalid command';end if;
 perform pg_advisory_xact_lock(736211);
 delete from eldervale_private.ground_drops where expires_at<=clock_timestamp();delete from eldervale_private.trades where expires_at<=clock_timestamp();
 select * into p from eldervale_private.realm_players where user_id=auth.uid() and realm_players.session_id=$1 for update;if not found then raise exception 'Session expired';end if;
 if command in ('drop','pickup_drop','trade_request','trade_join','trade_offer','trade_accept','trade_cancel') then
  if request_id is null then raise exception 'Request ID required';end if;
  select exists(select 1 from eldervale_private.realm_requests r where r.user_id=auth.uid() and r.request_id=$4) into dup;
  if not dup then
   if command='drop' then
    item:=payload->>'item';n:=(payload->>'amount')::integer;
    if item is null or n is null or n<1 or n>1000000 or (item<>'gold' and not exists(select 1 from eldervale_private.realm_catalog where id='item:'||item)) or n>coalesce(eldervale_private.item_quantity(auth.uid(),item),0) or eldervale_private.item_worn(auth.uid(),item) then raise exception 'Choose an unequipped item and a quantity you carry';end if;
    if (select count(*) from eldervale_private.ground_drops where owner_id=auth.uid())>=100 then raise exception 'Pick up some of your existing drops first';end if;
    perform eldervale_private.item_change(auth.uid(),item,-n);
    insert into eldervale_private.ground_drops(owner_id,item,amount,x,z) values(auth.uid(),item,n,p.x,p.z);
   elsif command='pickup_drop' then
    select * into d from eldervale_private.ground_drops where id=(payload->>'id')::uuid and expires_at>clock_timestamp() for update;
    if not found then raise exception 'That item has already been taken or expired';end if;
    if sqrt(power(p.x-d.x,2)+power(p.z-d.z,2))>3 then raise exception 'Move closer to the item';end if;
    if d.item='gold' and eldervale_private.item_quantity(auth.uid(),'gold')::bigint+d.amount>1000000000 then raise exception 'Gold limit reached';end if;
    perform eldervale_private.item_change(auth.uid(),d.item,d.amount);
    if eldervale_private.inventory_used(auth.uid())>16 then raise exception 'Your inventory is full';end if;
    delete from eldervale_private.ground_drops where id=d.id;
   elsif command='trade_request' then
    partner:=(payload->>'player')::uuid;
    if partner=auth.uid() or partner is null then raise exception 'Choose another player';end if;
    select * into q from eldervale_private.realm_players where user_id=partner and last_seen>now()-interval '15 seconds';
    if not found or sqrt(power(p.x-q.x,2)+power(p.z-q.z,2))>6 then raise exception 'Move closer to that player';end if;
    if exists(select 1 from eldervale_private.trades where stage not in ('complete','cancelled') and (a in (auth.uid(),partner) or b in(auth.uid(),partner))) then raise exception 'One player already has a trade open';end if;
    if exists(select 1 from eldervale_private.realm_actors where target in(auth.uid(),partner)) then raise exception 'Finish combat before trading';end if;
    insert into eldervale_private.trades(a,b) values(auth.uid(),partner);
   else
    select * into tr from eldervale_private.trades where id=(payload->>'id')::uuid and auth.uid() in(a,b) and expires_at>clock_timestamp() for update;
    if not found then raise exception 'Trade expired';end if;
    partner:=case when tr.a=auth.uid() then tr.b else tr.a end;
    if command='trade_cancel' then update eldervale_private.trades set stage='cancelled',expires_at=now()+interval '15 seconds' where id=tr.id;
    else
     select * into q from eldervale_private.realm_players where user_id=partner and last_seen>now()-interval '15 seconds';
     if not found or sqrt(power(p.x-q.x,2)+power(p.z-q.z,2))>6 then raise exception 'Your trading partner moved away or disconnected';end if;
     if exists(select 1 from eldervale_private.realm_actors where target in(auth.uid(),partner)) then raise exception 'Finish combat before trading';end if;
     if command='trade_join' then
      if tr.b<>auth.uid() or tr.stage<>'invited' then raise exception 'Trade invitation unavailable';end if;
      update eldervale_private.trades set stage='offer',revision=revision+1,expires_at=now()+interval '2 minutes' where id=tr.id;
     elsif command='trade_offer' then
      if tr.stage<>'offer' then raise exception 'Trade is in final review';end if;
      offer:=payload->'offer';perform eldervale_private.validate_offer(auth.uid(),offer);
      update eldervale_private.trades set offer_a=case when a=auth.uid() then offer else offer_a end,offer_b=case when b=auth.uid() then offer else offer_b end,accept_a=false,accept_b=false,revision=revision+1,expires_at=now()+interval '2 minutes' where id=tr.id;
     elsif command='trade_accept' then
      if tr.stage not in('offer','review') or (payload->>'revision')::integer is distinct from tr.revision then raise exception 'The offer changed. Review it again';end if;
      perform eldervale_private.validate_offer(tr.a,tr.offer_a);perform eldervale_private.validate_offer(tr.b,tr.offer_b);
      update eldervale_private.trades set accept_a=accept_a or a=auth.uid(),accept_b=accept_b or b=auth.uid(),expires_at=now()+interval '2 minutes' where id=tr.id returning * into tr;
      if tr.accept_a and tr.accept_b then
       if tr.stage='offer' then update eldervale_private.trades set stage='review',accept_a=false,accept_b=false,revision=revision+1 where id=tr.id;
       else
        -- Remove both offers before receiving either: simultaneous swaps work even with full inventories.
        for who,offer_from in select tr.a,tr.offer_a union all select tr.b,tr.offer_b loop
         perform eldervale_private.item_change(who,'gold',-(offer_from->>'gold')::integer);
         for k,v in select key,value from jsonb_each(offer_from->'items') loop perform eldervale_private.item_change(who,k,-(v::text)::integer);end loop;
        end loop;
        for who,offer_from in select tr.b,tr.offer_a union all select tr.a,tr.offer_b loop
         if eldervale_private.item_quantity(who,'gold')::bigint+(offer_from->>'gold')::bigint>1000000000 then raise exception 'Trading partner reached the gold limit';end if;
         perform eldervale_private.item_change(who,'gold',(offer_from->>'gold')::integer);
         for k,v in select key,value from jsonb_each(offer_from->'items') loop perform eldervale_private.item_change(who,k,(v::text)::integer);end loop;
         if eldervale_private.inventory_used(who)>16 then raise exception 'A player needs more inventory space';end if;
        end loop;
        update eldervale_private.trades set stage='complete',expires_at=now()+interval '15 seconds' where id=tr.id;
       end if;
      end if;
     end if;
    end if;
   end if;
   insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),request_id,'{}');
  end if;
  result:=eldervale_private.realm_request_social_base(session_id,'sync','{}',null,event_cursor);
 else result:=eldervale_private.realm_request_social_base(session_id,command,payload,request_id,event_cursor);end if;
 return result||jsonb_build_object('npcDuels',(select coalesce(jsonb_agg(to_jsonb(gd)),'[]') from eldervale_private.guard_duels gd),'groundDrops',(select coalesce(jsonb_agg(to_jsonb(g)-'owner_id'),'[]') from eldervale_private.ground_drops g where expires_at>now() and sqrt(power(g.x-p.x,2)+power(g.z-p.z,2))<220),'trade',(select to_jsonb(t)||jsonb_build_object('name_a',(select character_name from public.player_saves where user_id=t.a),'name_b',(select character_name from public.player_saves where user_id=t.b),'self',auth.uid()) from eldervale_private.trades t where auth.uid() in(t.a,t.b) order by expires_at desc limit 1));
end $$;