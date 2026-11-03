create or replace function eldervale_private.realm_request(session_id uuid,command text default 'sync',payload jsonb default '{}',request_id uuid default null,event_cursor bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;p eldervale_private.realm_players;s public.player_saves;o eldervale_private.realm_objects;c jsonb;stock eldervale_private.shop_stock;merchant_id text;item_id text;price integer;used integer;dedup boolean;shop_data jsonb;
begin
 -- The base authenticates, serializes, applies deliveries, checks bans and owns combat/movement.
 if command not in ('fish','trade') then result:=eldervale_private.realm_request_base(session_id,command,payload,request_id,event_cursor);
 else
  result:=eldervale_private.realm_request_base(session_id,'sync','{}',null,event_cursor);
  if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>24000 or request_id is null then raise exception 'Invalid action';end if;
  select exists(select 1 from eldervale_private.realm_requests r where r.user_id=auth.uid() and r.request_id=realm_request.request_id) into dedup;
  if not dedup then
   select * into p from eldervale_private.realm_players where user_id=auth.uid();select * into s from public.player_saves where user_id=auth.uid();
   if clock_timestamp()-p.last_command<interval '.06 seconds' then raise exception 'Please wait before another action';end if;
   if command='fish' then
    select * into o from eldervale_private.realm_objects where id=payload->>'target' and kind='fishing';if not found or sqrt(power(o.x-p.x,2)+power(o.z-p.z,2))>3 then raise exception 'Move closer to a fishing spot';end if;
    if coalesce((s.stats->>'fishingPole')::integer,0)<1 then raise exception 'You need a fishing pole in your inventory';end if;if coalesce((s.stats->>'bait')::integer,0)<1 then raise exception 'You need fishing bait';end if;
    if p.fishing_until>clock_timestamp() then raise exception 'Wait for your next cast';end if;
    if eldervale_private.inventory_used(auth.uid())>=16 and (s.stats->>'bait')::integer>1 then raise exception 'Your inventory is full';end if;
    perform eldervale_private.item_change(auth.uid(),'bait',-1);perform eldervale_private.item_change(auth.uid(),'rawFish',1);update public.player_saves set skills=skills||jsonb_build_object('fishingXP',coalesce((skills->>'fishingXP')::integer,0)+25) where user_id=auth.uid();
    update eldervale_private.realm_players set fishing_until=clock_timestamp()+interval '4 seconds',path='[]',intent=null where user_id=auth.uid();perform eldervale_private.emit(jsonb_build_object('type','fishing','player',auth.uid(),'target',o.id));
   else
    merchant_id:=payload->>'merchant';
    if merchant_id is null then select id into merchant_id from (select id,x,z from eldervale_private.realm_objects where kind='merchant' union all select id,x,z from eldervale_private.realm_actors where not deleted and data->>'role'='merchant')m where sqrt(power(x-p.x,2)+power(z-p.z,2))<6 limit 1;end if;
    if merchant_id is null or not exists(select 1 from eldervale_private.realm_objects where id=merchant_id and kind='merchant' and sqrt(power(x-p.x,2)+power(z-p.z,2))<6 union all select 1 from eldervale_private.realm_actors where id=merchant_id and not deleted and data->>'role'='merchant' and sqrt(power(x-p.x,2)+power(z-p.z,2))<6) then raise exception 'Move closer to this merchant';end if;
    item_id:=payload->>'item';select data into c from eldervale_private.realm_catalog where id='item:'||item_id;if c is null then raise exception 'Unknown item';end if;
    select * into stock from eldervale_private.shop_stock where merchant=merchant_id and item=item_id for update;
    if exists(select 1 from eldervale_private.shop_stock where merchant=merchant_id) and stock.item is null then raise exception 'This merchant does not trade that item';end if;
    if coalesce((payload->>'buy')::boolean,false) then
     if stock.stock=0 then raise exception 'Sold out';end if;used:=eldervale_private.inventory_used(auth.uid());if used>=16 and not(coalesce((c->>'stackable')::boolean,false) and coalesce((s.stats->>item_id)::integer,0)>0) then raise exception 'Inventory full';end if;
     if coalesce((c->>'unique')::boolean,false) and coalesce((s.stats->>item_id)::integer,0)>0 then raise exception 'You already carry this tool';end if;
     price:=coalesce(stock.buy,(c->>'buy')::integer);perform eldervale_private.item_change(auth.uid(),'gold',-price);perform eldervale_private.item_change(auth.uid(),item_id,1);update eldervale_private.shop_stock set stock=case when shop_stock.stock<0 then -1 else shop_stock.stock-1 end where merchant=merchant_id and item=item_id;
    else
     if coalesce(case when c->>'field'='armorOwned' then (s.equipment->>(c->>'key'))::boolean when c->>'field'='weaponsOwned' then s.equipment->>'weapon'=c->>'key' when c->>'field'='shieldsOwned' then s.equipment->>'shield'=c->>'key' when c->>'field'='jewelryOwned' then s.equipment->>'amulet'=c->>'key' or s.equipment->>'trinket'=c->>'key' else false end,false) then raise exception 'Unequip it first';end if;
     price:=coalesce(stock.sell,(c->>'sell')::integer);perform eldervale_private.item_change(auth.uid(),item_id,-1);perform eldervale_private.item_change(auth.uid(),'gold',price);update eldervale_private.shop_stock set stock=case when shop_stock.stock<0 then -1 else shop_stock.stock+1 end where merchant=merchant_id and item=item_id;
    end if;
   end if;
   insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),request_id,'{}');update eldervale_private.realm_players set last_command=clock_timestamp() where user_id=auth.uid();
  end if;
  result:=eldervale_private.realm_request_base(session_id,'sync','{}',null,event_cursor);
 end if;
 select coalesce(jsonb_object_agg(merchant,items),'{}') into shop_data from (select ss.merchant,jsonb_object_agg(ss.item,jsonb_build_object('buy',ss.buy,'sell',ss.sell,'stock',ss.stock))items from eldervale_private.shop_stock ss group by ss.merchant)q;
 return result||jsonb_build_object('shops',shop_data);
end $$;
