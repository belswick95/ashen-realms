create or replace function eldervale_private.realm_request(session_id uuid,command text default 'sync',payload jsonb default '{}',request_id uuid default null,event_cursor bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare p eldervale_private.realm_players;s public.player_saves;c jsonb;d jsonb;item text;field text;key text;slot text;intent_target text;amount integer;n integer;owned boolean;worn boolean;result jsonb;delivery record;
begin
 if not eldervale_private.allowed() or exists(select 1 from eldervale_private.settings where maintenance and not eldervale_private.is_owner()) then raise exception 'World access unavailable' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>24000 then raise exception 'Invalid command';end if;
 perform pg_advisory_xact_lock(736211);
 select * into p from eldervale_private.realm_players where user_id=auth.uid() for update;
 if not found or p.session_id<>session_id then raise exception 'This character is active in another session. Sign in again.' using errcode='42501';end if;
 if exists(select 1 from eldervale_private.moderation where user_id=auth.uid() and kicked_at>p.last_seen) then raise exception 'Removed from world' using errcode='42501';end if;
 update eldervale_private.realm_players set last_seen=clock_timestamp() where user_id=auth.uid();
 if command<>'sync' then
  if request_id is null then raise exception 'A request ID is required';end if;
  if exists(select 1 from eldervale_private.realm_requests r where r.user_id=auth.uid() and r.request_id=realm_request.request_id) then command:='sync';
  elsif clock_timestamp()-p.last_command<interval '.06 seconds' then raise exception 'Please wait before another action';
  else update eldervale_private.realm_players set last_command=clock_timestamp() where user_id=auth.uid();end if;
 end if;
 select * into s from public.player_saves where user_id=auth.uid() for update;
 -- Apply authorized offline deliveries atomically with the character, never by trusting a browser receipt.
 for delivery in select * from eldervale_private.deliveries where recipient=auth.uid() and applied_at is null order by created_at for update loop
  if delivery.data->>'command'='teleport' then update eldervale_private.realm_players set x=(delivery.data->>'x')::float8,z=(delivery.data->>'z')::float8,path='[]',intent=null where user_id=auth.uid();
  else perform eldervale_private.item_change(auth.uid(),delivery.data->>'item',coalesce((delivery.data->>'amount')::integer,1),delivery.data->>'item'<>'gold');end if;
  update eldervale_private.deliveries set applied_at=clock_timestamp() where id=delivery.id;
 end loop;
 select * into s from public.player_saves where user_id=auth.uid() for update;
 if command='move' then
  if not(payload?'path') or jsonb_typeof(payload->'path')<>'array' or jsonb_array_length(payload->'path')>128 then raise exception 'Invalid route';end if;
  for d in select value from jsonb_array_elements(payload->'path') loop
   if jsonb_typeof(d)<>'array' or jsonb_array_length(d)<>2 or (d->>0)::float8::text in ('NaN','Infinity','-Infinity') or (d->>1)::float8::text in ('NaN','Infinity','-Infinity') or abs((d->>0)::float8)>4500 or abs((d->>1)::float8)>4500 then raise exception 'Invalid waypoint';end if;
  end loop;
  intent_target:=payload->>'target';if intent_target is not null and not exists(select 1 from eldervale_private.realm_actors where id=intent_target and not deleted union all select 1 from eldervale_private.realm_objects where id=intent_target) then raise exception 'Target unavailable';end if;
  update eldervale_private.realm_players set path=payload->'path',intent=case when intent_target is null then null else jsonb_build_object('target',intent_target,'kind',case when payload->>'kind'='creature' then 'attack' else 'interact' end) end where user_id=auth.uid();
  if coalesce(payload->>'kind','')<>'creature' then update eldervale_private.realm_actors set target=null,phase='ready' where target=auth.uid();end if;
 elsif command='run' then update eldervale_private.realm_players set run=coalesce((payload->>'enabled')::boolean,false) and energy>=5 where user_id=auth.uid();
 elsif command='stop' then update eldervale_private.realm_players set path='[]',intent=null where user_id=auth.uid();update eldervale_private.realm_actors set target=null,phase='ready' where target=auth.uid();
 elsif command='equip' then
  slot:=payload->>'slot';key:=payload->>'key';item:=case when slot='weapon' then 'weapon:' when slot='shield' then 'shield:' when slot in ('amulet','trinket') then 'jewelry:' else 'armor:' end||key;
  select data into c from eldervale_private.realm_catalog where id='item:'||item;if c is null then raise exception 'Unknown equipment';end if;field:=c->>'field';if not(coalesce(s.inventory->field,'[]')?key) then raise exception 'You do not carry this item';end if;
  if field='armorOwned' then if slot<>key then raise exception 'Wrong equipment slot';end if;s.equipment:=s.equipment||jsonb_build_object(key,not coalesce((s.equipment->>key)::boolean,false));
  else if field='jewelryOwned' and c->>'slot'<>slot then raise exception 'Wrong jewelry slot';end if;if slot not in ('weapon','shield','amulet','trinket') then raise exception 'Invalid slot';end if;s.equipment:=s.equipment||jsonb_build_object(slot,case when s.equipment->>slot=key then null else key end);if slot='weapon' and key='twohand' then s.equipment:=s.equipment||'{"shield":null}';elsif slot='shield' and s.equipment->>'weapon'='twohand' then s.equipment:=s.equipment||'{"weapon":null}';end if;end if;
  update public.player_saves set equipment=s.equipment where user_id=auth.uid();
 elsif command in ('bank','trade') then
  if not exists(select 1 from eldervale_private.realm_objects where sqrt(power(x-p.x,2)+power(z-p.z,2))<10 and ((command='bank' and (kind='door' and data->>'type'='bank' or kind='npc' and data->>'role'='banker')) or command='trade' and kind='merchant') union all select 1 from eldervale_private.realm_actors where not deleted and sqrt(power(x-p.x,2)+power(z-p.z,2))<6 and data->>'role'=case when command='bank' then 'banker' else 'merchant' end) then raise exception 'Move closer to a bank or merchant';end if;
  item:=payload->>'item';select data into c from eldervale_private.realm_catalog where id='item:'||item;if c is null then raise exception 'Unknown item';end if;field:=c->>'field';key:=c->>'key';
  worn:=coalesce(case when field='armorOwned' then (s.equipment->>key)::boolean when field='weaponsOwned' then s.equipment->>'weapon'=key when field='shieldsOwned' then s.equipment->>'shield'=key when field='jewelryOwned' then s.equipment->>'amulet'=key or s.equipment->>'trinket'=key else false end,false);
  if command='bank' then
   if payload->>'direction'='deposit' then if worn then raise exception 'Unequip it first';end if;n:=case when field is not null then case when coalesce(s.inventory->field,'[]')?key then 1 else 0 end else coalesce((s.stats->>item)::integer,0) end;
   elsif payload->>'direction'='withdraw' then n:=coalesce((s.inventory->'bank'->>item)::integer,0);else raise exception 'Invalid transfer';end if;
   amount:=least(n,case when coalesce((payload->>'all')::boolean,false) then n else 1 end);
   if payload->>'direction'='withdraw' then amount:=least(amount,greatest(0,16-coalesce(eldervale_private.inventory_used(auth.uid()),0)));end if;if amount<1 then raise exception 'No items or inventory full';end if;
   if payload->>'direction'='deposit' and field is not null and coalesce((s.inventory->'bank'->>item)::integer,0)>0 then raise exception 'Already in bank';end if;
   if payload->>'direction'='deposit' then perform eldervale_private.item_change(auth.uid(),item,-amount);perform eldervale_private.item_change(auth.uid(),item,amount,true);else perform eldervale_private.item_change(auth.uid(),item,-amount,true);perform eldervale_private.item_change(auth.uid(),item,amount);end if;
  elsif coalesce((payload->>'buy')::boolean,false) then if coalesce(eldervale_private.inventory_used(auth.uid()),0)>=16 then raise exception 'Inventory full';end if;perform eldervale_private.item_change(auth.uid(),'gold',-(c->>'buy')::integer);perform eldervale_private.item_change(auth.uid(),item,1);
  else if worn then raise exception 'Unequip it first';end if;perform eldervale_private.item_change(auth.uid(),item,-1);perform eldervale_private.item_change(auth.uid(),'gold',(c->>'sell')::integer);end if;
 elsif command='preview' then
  if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;if not exists(select 1 from eldervale_private.realm_actors where id=payload->>'target' and not deleted) then raise exception 'Actor unavailable';end if;perform eldervale_private.emit(jsonb_build_object('type','preview','target',payload->>'target'));
 elsif command='reset' then
  delete from eldervale_private.realm_players where user_id=auth.uid();delete from public.player_saves where user_id=auth.uid();return '{"reset":true}';
 elsif command<>'sync' then raise exception 'Unknown world command';end if;
 if command<>'sync' then insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),request_id,'{}');end if;
 perform eldervale_private.world_tick();
 select * into p from eldervale_private.realm_players where user_id=auth.uid();
 select jsonb_build_object('time',clock_timestamp(),'self',(select to_jsonb(v) from public.player_saves v where user_id=auth.uid()),'motion',to_jsonb(p),'actors',coalesce((select jsonb_agg((to_jsonb(a)-'data')||jsonb_build_object('data',jsonb_build_object('hp',a.data->'hp','level',a.data->'level','attackLevel',a.data->'attackLevel','strengthLevel',a.data->'strengthLevel','defenceLevel',a.data->'defenceLevel','damage',a.data->'damage','attackSpeed',a.data->'attackSpeed','attackType',a.data->'attackType'))) from eldervale_private.realm_actors a where not deleted and sqrt(power(a.x-p.x,2)+power(a.z-p.z,2))<220),'[]'::jsonb),'objects',coalesce((select jsonb_agg(jsonb_build_object('id',id,'open',open,'available_at',available_at)) from eldervale_private.realm_objects where (kind='door' or available_at is not null) and sqrt(power(x-p.x,2)+power(z-p.z,2))<220),'[]'::jsonb),'players',coalesce((select jsonb_agg(jsonb_build_object('id',r.user_id,'username',v.character_name,'x',r.x,'z',r.z,'yaw',r.yaw,'combatLevel',eldervale_private.combat_level(v.skills),'hp',v.health,'maxHp',v.max_health,'run',r.run,'appearance',v.game_flags->'appearance','loadout',jsonb_build_object('weapon',v.equipment->'weapon','shield',v.equipment->'shield','armor',v.equipment))) from eldervale_private.realm_players r join public.player_saves v on v.user_id=r.user_id where r.user_id<>auth.uid() and r.last_seen>clock_timestamp()-interval '15 seconds' and sqrt(power(r.x-p.x,2)+power(r.z-p.z,2))<220),'[]'::jsonb),'eventCursor',(select coalesce(max(id),0) from eldervale_private.realm_events),'events',coalesce((select jsonb_agg(jsonb_build_object('id',id,'data',data)) from eldervale_private.realm_events where id>event_cursor and created_at>clock_timestamp()-interval '8 seconds'),'[]'::jsonb)) into result;
 return result;
end $$;
