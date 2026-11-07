CREATE OR REPLACE FUNCTION eldervale_private.realm_request_before_quests(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p eldervale_private.realm_players;c jsonb;base_data jsonb;item text;base text;destination text;n integer;available integer;room integer;noted boolean;result jsonb;
begin
 if command<>'bank' then return eldervale_private.realm_request_before_bank_notes($1,$2,$3,$4,$5);end if;
 result:=eldervale_private.realm_request_before_bank_notes($1,'sync','{}',null,$5);
 perform pg_advisory_xact_lock(736211);
 if request_id is null or payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>2000 then raise exception 'Invalid bank request';end if;
 if exists(select 1 from eldervale_private.realm_requests r where r.user_id=auth.uid() and r.request_id=$4) then return result;end if;
 select * into p from eldervale_private.realm_players where user_id=auth.uid() and realm_players.session_id=$1 for update;if not found then raise exception 'Session expired';end if;
 if not exists(select 1 from eldervale_private.realm_objects where kind='door' and data->>'type'='bank' and sqrt(power(x-p.x,2)+power(z-p.z,2))<10 union all select 1 from eldervale_private.realm_actors where not deleted and data->>'role'='banker' and sqrt(power(x-p.x,2)+power(z-p.z,2))<6) then raise exception 'Return to a bank or banker to exchange items and notes';end if;
 perform 1 from public.player_saves where user_id=auth.uid() for update;
 item:=payload->>'item';select data into c from eldervale_private.realm_catalog where id='item:'||item;if c is null then raise exception 'Unknown bank item';end if;
 base:=coalesce(c->>'noteOf',item);select data into base_data from eldervale_private.realm_catalog where id='item:'||base;if base_data is null then raise exception 'Unknown original item';end if;
 if payload->>'direction'='deposit' then
  available:=greatest(0,eldervale_private.item_quantity(auth.uid(),item)-eldervale_private.equipment_reserved(auth.uid(),c));
  n:=case when coalesce((payload->>'all')::boolean,false) then available else least(1,available) end;if n<1 then raise exception 'No unequipped items to deposit';end if;
  perform eldervale_private.item_change(auth.uid(),item,-n);perform eldervale_private.item_change(auth.uid(),base,n,true);
 elsif payload->>'direction'='withdraw' then
  noted:=coalesce((payload->>'noted')::boolean,false) and not coalesce((base_data->>'stackable')::boolean,false);
  destination:=case when noted then 'note:'||base else base end;
  select data into c from eldervale_private.realm_catalog where id='item:'||destination;if c is null then raise exception 'This item cannot be withdrawn as a note';end if;
  select coalesce((inventory->'bank'->>base)::integer,0) into available from public.player_saves where user_id=auth.uid();
  if coalesce((c->>'stackable')::boolean,false) then room:=case when eldervale_private.item_quantity(auth.uid(),destination)>0 or eldervale_private.inventory_used(auth.uid())<eldervale_private.inventory_capacity() then 1000000000-eldervale_private.item_quantity(auth.uid(),destination) else 0 end;
  else room:=greatest(0,eldervale_private.inventory_capacity()-eldervale_private.inventory_used(auth.uid()));end if;
  n:=least(available,room,case when coalesce((payload->>'all')::boolean,false) then available else 1 end);if n<1 then raise exception 'Nothing available or your inventory is full';end if;
  perform eldervale_private.item_change(auth.uid(),base,-n,true);perform eldervale_private.item_change(auth.uid(),destination,n);
 else raise exception 'Choose deposit or withdraw';end if;
 if eldervale_private.inventory_used(auth.uid())>eldervale_private.inventory_capacity() then raise exception 'Inventory full';end if;
 delete from eldervale_private.skill_jobs where user_id=auth.uid();delete from eldervale_private.gathering_actions where user_id=auth.uid();
 insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),$4,'{}');
 return eldervale_private.realm_request_before_bank_notes($1,'sync','{}',null,$5);
end $function$
