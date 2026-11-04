-- Bank notes are separate, stackable certificates, never usable equipment or supplies.
create function eldervale_private.sync_bank_note() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.id like 'item:%' and new.id<>'item:gold' and not(new.data?'noteOf') and not coalesce((new.data->>'stackable')::boolean,false) and coalesce((new.data->>'notable')::boolean,true) then
  insert into eldervale_private.realm_catalog(id,data) values('item:note:'||substring(new.id from 6),jsonb_build_object('name',(new.data->>'name')||' (noted)','noteOf',substring(new.id from 6),'stackable',true,'heal',0,'buy',new.data->'buy','sell',new.data->'sell','model','note','notable',false)) on conflict(id) do update set data=excluded.data;
 end if;return new;
end $$;
create trigger realm_catalog_bank_notes after insert or update on eldervale_private.realm_catalog for each row execute function eldervale_private.sync_bank_note();
insert into eldervale_private.realm_catalog(id,data)
 select 'item:note:'||substring(id from 6),jsonb_build_object('name',(data->>'name')||' (noted)','noteOf',substring(id from 6),'stackable',true,'heal',0,'buy',data->'buy','sell',data->'sell','model','note','notable',false)
 from eldervale_private.realm_catalog where id like 'item:%' and id<>'item:gold' and not(data?'noteOf') and not coalesce((data->>'stackable')::boolean,false) and coalesce((data->>'notable')::boolean,true)
 on conflict(id) do update set data=excluded.data;

create or replace function eldervale_private.item_quantity(uid uuid,item text) returns integer language sql stable set search_path='' as $$
 select case when item='gold' then s.gold when c.data?'field' then (select count(*)::integer from jsonb_array_elements_text(coalesce(s.inventory->(c.data->>'field'),'[]'))v where v.value=c.data->>'key') else coalesce((s.stats->>item)::integer,0) end from public.player_saves s left join eldervale_private.realm_catalog c on c.id='item:'||item where s.user_id=uid
$$;
create function eldervale_private.equipment_reserved(uid uuid,c jsonb) returns integer language sql stable set search_path='' as $$
 select case when case c->>'field' when 'armorOwned' then coalesce((s.equipment->>(c->>'key'))::boolean,false) when 'weaponsOwned' then s.equipment->>'weapon'=c->>'key' when 'shieldsOwned' then s.equipment->>'shield'=c->>'key' when 'mountsOwned' then s.equipment->>'mount'=c->>'key' when 'jewelryOwned' then s.equipment->>'amulet'=c->>'key' or s.equipment->>'trinket'=c->>'key' else false end then 1 else 0 end from public.player_saves s where s.user_id=uid
$$;
create or replace function eldervale_private.item_worn(uid uuid,item text) returns boolean language sql stable set search_path='' as $$select coalesce(eldervale_private.item_quantity(uid,item),0)<=1 and eldervale_private.equipment_reserved(uid,c.data)=1 from eldervale_private.realm_catalog c where c.id='item:'||item$$;
create or replace function eldervale_private.item_change(uid uuid,item text,amount integer,bank boolean default false) returns void language plpgsql set search_path='' as $$
declare s public.player_saves;c jsonb;f text;k text;n integer;vals jsonb;result jsonb;v text;removed integer:=0;reserved integer;
begin
 select * into s from public.player_saves where user_id=uid for update;
 if s.user_id is null then raise exception 'Character not found';end if;
 if item='gold' then if s.gold+amount<0 or s.gold::bigint+amount>1000000000 then raise exception 'Gold amount outside limits';end if;update public.player_saves set gold=gold+amount where user_id=uid;return;end if;
 select data into c from eldervale_private.realm_catalog where id='item:'||item;if c is null then raise exception 'Unknown item';end if;
 if bank and c?'noteOf' then perform eldervale_private.item_change(uid,c->>'noteOf',amount,true);return;end if;
 f:=c->>'field';k:=c->>'key';
 if bank then
  n:=coalesce((s.inventory->'bank'->>item)::integer,0)+amount;if n<0 or n>1000000000 then raise exception 'Bank quantity outside limits';end if;
  s.inventory:=jsonb_set(s.inventory,'{bank}',coalesce(s.inventory->'bank','{}')||jsonb_build_object(item,n));
 elsif f is null then
  n:=coalesce((s.stats->>item)::integer,0)+amount;if n<0 or n>1000000000 then raise exception 'Not enough items or stack limit reached';end if;s.stats:=s.stats||jsonb_build_object(item,n);
 else
  vals:=coalesce(s.inventory->f,'[]');n:=eldervale_private.item_quantity(uid,item);reserved:=eldervale_private.equipment_reserved(uid,c);
  if amount>0 then
   if amount>16 then raise exception 'Carried equipment uses one slot per copy';end if;
   vals:=vals||(select coalesce(jsonb_agg(k),'[]') from generate_series(1,amount));
  elsif amount<0 then
   if n+amount<reserved then raise exception 'Not enough unequipped copies. Unequip the last copy first';end if;
   result:='[]';for v in select jsonb_array_elements_text(vals) loop if v=k and removed< -amount then removed:=removed+1;else result:=result||jsonb_build_array(v);end if;end loop;vals:=result;
  end if;
  s.inventory:=s.inventory||jsonb_build_object(f,vals);
 end if;
 update public.player_saves set stats=s.stats,inventory=s.inventory where user_id=uid;
end $$;
create or replace function eldervale_private.inventory_used(uid uuid) returns integer language sql stable set search_path='' as $$
 select coalesce((select sum(case when coalesce((c.data->>'stackable')::boolean,false) then case when coalesce((s.stats->>substring(c.id from 6))::integer,0)>0 then 1 else 0 end else coalesce((s.stats->>substring(c.id from 6))::integer,0) end) from eldervale_private.realm_catalog c where c.id like 'item:%' and not(c.data?'field') and c.id<>'item:gold'),0)::integer+
 coalesce((select sum(greatest(0,q.n-case when case q.field when 'armorOwned' then coalesce((s.equipment->>q.item)::boolean,false) when 'weaponsOwned' then s.equipment->>'weapon'=q.item when 'shieldsOwned' then s.equipment->>'shield'=q.item when 'mountsOwned' then s.equipment->>'mount'=q.item else s.equipment->>'amulet'=q.item or s.equipment->>'trinket'=q.item end then 1 else 0 end)) from (select f.key field,v.value item,count(*)::integer n from jsonb_each(s.inventory)f cross join lateral jsonb_array_elements_text(case when jsonb_typeof(f.value)='array' then f.value else '[]' end)v where f.key in('armorOwned','weaponsOwned','shieldsOwned','jewelryOwned','mountsOwned') group by f.key,v.value)q),0)::integer
 from public.player_saves s where user_id=uid
$$;

alter function eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) rename to realm_request_before_bank_notes;
create function eldervale_private.realm_request(session_id uuid,command text default 'sync',payload jsonb default '{}',request_id uuid default null,event_cursor bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
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
  if coalesce((c->>'stackable')::boolean,false) then room:=case when eldervale_private.item_quantity(auth.uid(),destination)>0 or eldervale_private.inventory_used(auth.uid())<16 then 1000000000-eldervale_private.item_quantity(auth.uid(),destination) else 0 end;
  else room:=greatest(0,16-eldervale_private.inventory_used(auth.uid()));end if;
  n:=least(available,room,case when coalesce((payload->>'all')::boolean,false) then available else 1 end);if n<1 then raise exception 'Nothing available or your inventory is full';end if;
  perform eldervale_private.item_change(auth.uid(),base,-n,true);perform eldervale_private.item_change(auth.uid(),destination,n);
 else raise exception 'Choose deposit or withdraw';end if;
 if eldervale_private.inventory_used(auth.uid())>16 then raise exception 'Inventory full';end if;
 delete from eldervale_private.skill_jobs where user_id=auth.uid();delete from eldervale_private.gathering_actions where user_id=auth.uid();
 insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),$4,'{}');
 return eldervale_private.realm_request_before_bank_notes($1,'sync','{}',null,$5);
end $$;
revoke all on function eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) from public,anon,authenticated;
grant execute on function eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) to authenticated;
revoke all on function eldervale_private.realm_request_before_bank_notes(uuid,text,jsonb,uuid,bigint),eldervale_private.sync_bank_note(),eldervale_private.equipment_reserved(uuid,jsonb),eldervale_private.item_change(uuid,text,integer,boolean),eldervale_private.item_quantity(uuid,text),eldervale_private.item_worn(uuid,text),eldervale_private.inventory_used(uuid) from public,anon,authenticated;

alter function eldervale_private.skill_error(uuid,jsonb,text,uuid) rename to skill_error_before_notes;
create function eldervale_private.skill_error(uid uuid,r jsonb,target_id text,drop_id uuid default null) returns text language plpgsql set search_path='' as $$declare k text;begin
 for k in select key from jsonb_each(coalesce(r->'inputs','{}')) union select jsonb_array_elements_text(coalesce(r->'tools','[]')) loop if k like 'note:%' then return 'Bank notes cannot be used in skills. Exchange them at a bank first.';end if;end loop;
 return eldervale_private.skill_error_before_notes(uid,r,target_id,drop_id);
end $$;
alter function eldervale_private.admin_action(text,jsonb) rename to admin_before_bank_notes;
create function eldervale_private.admin_action(command text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$declare k text;begin
 if command='catalog_recipe' then
  if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
  for k in select key from jsonb_each(coalesce(payload->'recipe'->'inputs','{}')||coalesce(payload->'recipe'->'outputs','{}')) union select jsonb_array_elements_text(coalesce(payload->'recipe'->'tools','[]')) loop if k like 'note:%' then raise exception 'Bank notes cannot be ingredients, products or tools; use the original item';end if;end loop;
 end if;
 return eldervale_private.admin_before_bank_notes(command,payload);
end $$;
revoke all on function eldervale_private.admin_action(text,jsonb) from public,anon,authenticated;
grant execute on function eldervale_private.admin_action(text,jsonb) to authenticated;
revoke all on function eldervale_private.admin_before_bank_notes(text,jsonb),eldervale_private.skill_error(uuid,jsonb,text,uuid),eldervale_private.skill_error_before_notes(uuid,jsonb,text,uuid) from public,anon,authenticated;
