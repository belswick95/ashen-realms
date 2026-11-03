create table eldervale_private.shop_stock(merchant text not null,item text not null,buy integer not null check(buy>0),sell integer not null check(sell>=0 and sell<=buy),stock integer not null check(stock>=-1),primary key(merchant,item));
alter table eldervale_private.shop_stock enable row level security;
create policy rpc_only on eldervale_private.shop_stock to authenticated using(false) with check(false);
revoke all on eldervale_private.shop_stock from public,anon,authenticated;
alter table eldervale_private.realm_players add column fishing_until timestamptz;
insert into eldervale_private.realm_catalog(id,data) values
('item:fishingPole','{"name":"Fishing pole","buy":35,"sell":12,"unique":true}'),
('item:bait','{"name":"Fishing bait","buy":2,"sell":1,"stackable":true}'),
('item:rawFish','{"name":"Raw river fish","buy":12,"sell":6}');
create or replace function eldervale_private.admin_action(command text, payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare s eldervale_private.settings; old_row jsonb; result jsonb; entity_id uuid; target_id uuid; body jsonb; n numeric; seconds integer; item text;
begin
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>32768 then raise exception 'Invalid command payload'; end if;
 select * into s from eldervale_private.settings where id=true for update;
 update eldervale_private.settings set revision=revision+1 where id=true returning * into s;
 if command in ('spawn','update','delete','restore') then
  if command='spawn' then entity_id:=gen_random_uuid();body:=payload-'id';
  else entity_id:=(payload->>'id')::uuid;select to_jsonb(e),e.data into old_row,body from eldervale_private.entities e where id=entity_id for update;if body is null then raise exception 'Entity not found';end if;body:=body||(payload-'id');end if;
  if command in ('spawn','update') then
   if coalesce(body->>'template','')!~'^[a-z][A-Za-z0-9_:-]{1,60}$' or body->>'kind' not in ('npc','monster','object','item') or coalesce(body->>'kind','')='' then raise exception 'Invalid template or kind';end if;
   if body->>'kind'<>'item' and body->>'template' not in ('fishing_spot','fountain','road','terrain_grass','terrain_sand','terrain_stone','terrain_snow','villager','guard','banker','merchant','smith','ranger','mage','healer','knight','farmer','innkeeper','bandit','goblin','skeleton','wolf','deer','boar','bear','rat','spider','bat','troll','golem','wraith','dragon','crate','barrel','chest','bench','fence','lantern','market','well','campfire','tree','pine','rock','banner','cottage','bank','inn','forge','ruin') then raise exception 'Unknown template';end if;
   if body->>'kind'='item' and (coalesce(body->>'item','') not in ('fishingPole','bait','rawFish','wood','ore','weapon:dagger','weapon:shortsword','weapon:longsword','weapon:scimitar','weapon:twohand','weapon:axe','weapon:pickaxe','weapon:battleaxe','armor:helm','armor:chest','armor:legs','armor:boots','armor:cape','shield:square','shield:kite','jewelry:woodlandAmulet','jewelry:prospectorsRing') or coalesce((body->>'amount')::numeric,1)<1 or coalesce((body->>'amount')::numeric,1)>1000000) then raise exception 'Invalid item drop';end if;
   if length(coalesce(body->>'name',''))>80 or length(coalesce(body->>'dialogue',''))>2000 then raise exception 'Text too long';end if;
   foreach item in array array['x','z','yaw','scale','level','hp','damage','attackSpeed','roam','respawn'] loop
    n:=coalesce((body->>item)::numeric,case when item='scale' then 1 when item='hp' then 20 when item='attackSpeed' then 2.4 else 0 end);
    if n::text in ('NaN','Infinity','-Infinity') or (item in ('x','z') and abs(n)>4500) or (item='yaw' and abs(n)>360) or (item='scale' and (n<0.25 or n>5)) or (item='level' and (n<1 or n>999)) or (item='hp' and (n<1 or n>100000)) or (item='damage' and (n<0 or n>10000)) or (item='attackSpeed' and (n<1.3 or n>30)) or (item='roam' and (n<0 or n>50)) or (item='respawn' and (n<0 or n>86400)) then raise exception 'Invalid %',item;end if;
    body:=jsonb_set(body,array[item],to_jsonb(n));
   end loop;
   if body ? 'attackType' and body->>'attackType' not in ('slash','punch','stab','hammer','arrow','magic','bite','kick','charge','claw','venom','swoop','slam','fire') then raise exception 'Unknown attack';end if;
   if body->>'kind'='npc' and not coalesce((body->>'attackable')::boolean,false) then body:=jsonb_set(body,'{hostile}','false'::jsonb);end if;

   if body->>'template' like 'terrain_%' then
    if coalesce((body->>'radius')::numeric,10) not between 2 and 30 or coalesce((body->>'elevation')::numeric,0) not between -8 and 8 or abs(coalesce((body->>'elevation')::numeric,0))>coalesce((body->>'radius')::numeric,10)*.4 then raise exception 'Terrain radius 2–30m; elevation -8 to 8m with a gentle slope';end if;
    if exists(select 1 from eldervale_private.realm_objects where kind='door' and sqrt(power(x-(body->>'x')::float8,2)+power(z-(body->>'z')::float8,2))<coalesce((body->>'radius')::float8,10)+15) then raise exception 'Shape terrain at least 15m clear of existing buildings';end if;
    if exists(select 1 from eldervale_private.realm_water where not passable and point((body->>'x')::float8,(body->>'z')::float8)<@outline) then raise exception 'Terrain shaping is for dry land';end if;
   end if;
   if body->>'template'='road' and (coalesce((body->>'length')::numeric,10) not between 2 and 50 or coalesce((body->>'width')::numeric,2.5) not between 1 and 8) then raise exception 'Road length 2–50m and width 1–8m';end if;
   if body->>'template'='fishing_spot' and not exists(select 1 from eldervale_private.realm_water w cross join (values(0,0),(6,0),(-6,0),(0,6),(0,-6)) v(dx,dz) where not w.passable and point((body->>'x')::float8+dx,(body->>'z')::float8+dz)<@w.outline) then raise exception 'Place fishing spots on a shoreline, within 6m of water';end if;
   if body?'shop' then
    if jsonb_typeof(body->'shop')<>'object' or (select count(*) from jsonb_object_keys(body->'shop'))>40 then raise exception 'Shop needs up to 40 items';end if;
    for item,result in select key,value from jsonb_each(body->'shop') loop
     if not exists(select 1 from eldervale_private.realm_catalog where id='item:'||item) or jsonb_typeof(result)<>'object' or not(result?'buy' and result?'sell' and result?'stock') or (result->>'buy')::integer not between 1 and 1000000 or (result->>'sell')::integer not between 0 and (result->>'buy')::integer or (result->>'stock')::integer not between -1 and 1000000 then raise exception 'Invalid shop entry: %',item;end if;
    end loop;
   end if;
   if command='spawn' and (select count(*) from eldervale_private.entities where not deleted)>=2000 then raise exception 'World limit: archive an entity first';end if;
   insert into eldervale_private.entities(id,revision,data) values(entity_id,s.revision,body) on conflict(id) do update set data=excluded.data,revision=excluded.revision;
  else update eldervale_private.entities set deleted=command='delete',revision=s.revision where id=entity_id;end if;
  select to_jsonb(e) into result from eldervale_private.entities e where id=entity_id;
 elsif command in ('announce','welcome','restart','cancel_restart','maintenance') then
  old_row:=to_jsonb(s);
  if command in ('announce','welcome') then if length(coalesce(payload->>'text',''))>1000 then raise exception 'Message too long';end if;
   if command='announce' then update eldervale_private.settings set announcement=coalesce(payload->>'text',''),announcement_until=now()+interval '10 minutes' where id=true;
   else update eldervale_private.settings set welcome=coalesce(payload->>'text','') where id=true;end if;
  elsif command='restart' then seconds:=(payload->>'seconds')::integer;if seconds is null or seconds<15 or seconds>3600 then raise exception 'Countdown must be 15–3600 seconds';end if;update eldervale_private.settings set restart_at=now()+seconds*interval '1 second' where id=true;
  elsif command='cancel_restart' then update eldervale_private.settings set restart_at=null where id=true;
  else update eldervale_private.settings set maintenance=coalesce((payload->>'enabled')::boolean,false) where id=true;end if;
  select to_jsonb(t) into result from eldervale_private.settings t where id=true;
 elsif command in ('mute','unmute','kick','ban','unban') then
  target_id:=(payload->>'userId')::uuid;if target_id=auth.uid() then raise exception 'Cannot moderate the owner';end if;
  if length(coalesce(payload->>'reason',''))<3 or length(payload->>'reason')>500 then raise exception 'Give a reason (3–500 characters)';end if;
  seconds:=coalesce((payload->>'seconds')::integer,3600);if seconds<60 or seconds>31536000 then raise exception 'Duration out of bounds';end if;
  select to_jsonb(m) into old_row from eldervale_private.moderation m where user_id=target_id;
  insert into eldervale_private.moderation(user_id) values(target_id) on conflict do nothing;
  update eldervale_private.moderation set reason=payload->>'reason',banned_until=case when command='ban' then now()+seconds*interval '1 second' when command='unban' then null else banned_until end,muted_until=case when command='mute' then now()+seconds*interval '1 second' when command='unmute' then null else muted_until end,kicked_at=case when command='kick' then now() else kicked_at end where user_id=target_id returning to_jsonb(moderation) into result;
 elsif command in ('give','teleport') then
  target_id:=coalesce((payload->>'userId')::uuid,auth.uid());
  if command='give' then
   item:=payload->>'item';n:=coalesce((payload->>'amount')::numeric,1);
   if item not in ('fishingPole','bait','rawFish','gold','wood','ore','weapon:dagger','weapon:shortsword','weapon:longsword','weapon:scimitar','weapon:twohand','weapon:axe','weapon:pickaxe','weapon:battleaxe','armor:helm','armor:chest','armor:legs','armor:boots','armor:cape','shield:square','shield:kite','jewelry:woodlandAmulet','jewelry:prospectorsRing') or item is null or n::text in ('NaN','Infinity','-Infinity') or n<1 or n>1000000 or n<>trunc(n) then raise exception 'Unknown item or quantity';end if;
  else if (payload->>'x')::numeric::text in ('NaN','Infinity','-Infinity') or (payload->>'z')::numeric::text in ('NaN','Infinity','-Infinity') or abs((payload->>'x')::numeric)>4500 or abs((payload->>'z')::numeric)>4500 or not(payload?'x' and payload?'z') then raise exception 'Invalid coordinates';end if;end if;
  insert into eldervale_private.deliveries(recipient,data) values(target_id,payload||jsonb_build_object('command',command)) returning to_jsonb(deliveries) into result;
 elsif command='start_location' then
  if not(payload?'x' and payload?'z') or abs((payload->>'x')::float8)>419 or abs((payload->>'z')::float8)>419 or not eldervale_private.can_step((payload->>'x')::float8,(payload->>'z')::float8,(payload->>'x')::float8,(payload->>'z')::float8) then raise exception 'Choose a reachable starting point inside the world';end if;
  update eldervale_private.settings set spawn_x=(payload->>'x')::float8,spawn_z=(payload->>'z')::float8 where id=true returning to_jsonb(settings) into result;
 elsif command='delete_chat' then
  delete from public.world_chat where id=(payload->>'id')::bigint returning to_jsonb(world_chat) into old_row;result:=jsonb_build_object('deleted',old_row is not null);
 elsif command='resolve_report' then update eldervale_private.reports set resolved=true where id=(payload->>'id')::bigint returning to_jsonb(reports) into result;
 else raise exception 'Unknown command';end if;
 insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,coalesce(entity_id::text,target_id::text,payload->>'id'),old_row,result);
 return result;
end $$;

create or replace function eldervale_private.entity_runtime() returns trigger language plpgsql security definer set search_path='' as $$declare d jsonb:=new.data;begin
 if d->>'kind' in ('npc','monster') then
  d:=d||jsonb_build_object('hp',greatest(1,coalesce((d->>'hp')::integer,45)),'level',greatest(1,least(100,coalesce((d->>'level')::integer,1))),'attackLevel',greatest(1,least(100,coalesce((d->>'level')::integer,1))),'defenceLevel',greatest(1,least(100,coalesce((d->>'level')::integer,1))),'strengthLevel',greatest(1,least(100,coalesce((d->>'level')::integer,1))));
  insert into eldervale_private.realm_actors(id,data,x,z,hp,deleted) values(new.id::text,d,(d->>'x')::float8,(d->>'z')::float8,(d->>'hp')::integer,new.deleted) on conflict(id) do update set data=excluded.data,x=excluded.x,z=excluded.z,hp=excluded.hp,deleted=excluded.deleted,target=null,phase='ready',respawn_at=null;
 else
  if new.deleted then delete from eldervale_private.realm_objects where id=new.id::text;
  else insert into eldervale_private.realm_objects(id,kind,x,z,data) values(new.id::text,case when d->>'template'='fishing_spot' then 'fishing' when d->>'template' in ('cottage','bank','inn','forge') then 'door' when d->>'template' in ('tree','pine') then 'tree' when d->>'template'='rock' then 'rock' when d->>'template'='market' then 'merchant' else d->>'kind' end,(d->>'x')::float8,(d->>'z')::float8,d||jsonb_build_object('type',d->>'template','scaleX',1.3*coalesce((d->>'scale')::float8,1),'scaleZ',1.3*coalesce((d->>'scale')::float8,1),'yaw',coalesce((d->>'yaw')::float8,0)*pi()/180)) on conflict(id) do update set data=excluded.data,x=excluded.x,z=excluded.z;end if;
 end if;
 delete from eldervale_private.shop_stock where merchant=new.id::text;
 if not new.deleted then insert into eldervale_private.shop_stock(merchant,item,buy,sell,stock) select new.id::text,key,(value->>'buy')::integer,(value->>'sell')::integer,(value->>'stock')::integer from jsonb_each(coalesce(d->'shop','{}'));end if;
 return new;
end $$;

create or replace function eldervale_private.realm_request_base(session_id uuid,command text default 'sync',payload jsonb default '{}',request_id uuid default null,event_cursor bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
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
  if exists(select 1 from eldervale_private.realm_requests r where r.user_id=auth.uid() and r.request_id=realm_request_base.request_id) then command:='sync';
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
   if payload->>'direction'='withdraw' then amount:=least(amount,case when coalesce((c->>'stackable')::boolean,false) and (coalesce((s.stats->>item)::integer,0)>0 or eldervale_private.inventory_used(auth.uid())<16) then amount else greatest(0,16-coalesce(eldervale_private.inventory_used(auth.uid()),0)) end);end if;if amount<1 then raise exception 'No items or inventory full';end if;
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

revoke all on function eldervale_private.realm_request_base(uuid,text,jsonb,uuid,bigint) from public,anon,authenticated;
create or replace function eldervale_private.inventory_used(uid uuid) returns integer language sql stable set search_path='' as $$
 select coalesce((s.stats->>'wood')::integer,0)+coalesce((s.stats->>'ore')::integer,0)+coalesce((s.stats->>'fishingPole')::integer,0)+coalesce((s.stats->>'rawFish')::integer,0)+case when coalesce((s.stats->>'bait')::integer,0)>0 then 1 else 0 end+(select count(*) from jsonb_each(s.inventory) f cross join lateral jsonb_array_elements_text(case when jsonb_typeof(f.value)='array' then f.value else '[]' end) v where f.key in ('armorOwned','weaponsOwned','shieldsOwned','jewelryOwned') and not coalesce((case when f.key='armorOwned' then (s.equipment->>v.value)::boolean when f.key='weaponsOwned' then s.equipment->>'weapon'=v.value when f.key='shieldsOwned' then s.equipment->>'shield'=v.value else s.equipment->>'amulet'=v.value or s.equipment->>'trinket'=v.value end),false))::integer from public.player_saves s where user_id=uid
$$;
create or replace function eldervale_private.realm_request(session_id uuid,command text default 'sync',payload jsonb default '{}',request_id uuid default null,event_cursor bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;p eldervale_private.realm_players;s public.player_saves;o eldervale_private.realm_objects;c jsonb;stock eldervale_private.shop_stock;merchant_id text;item_id text;price integer;amount integer;used integer;dedup boolean;shop_data jsonb;
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
     amount:=coalesce((payload->>'amount')::integer,1);if amount not in (1,10) or amount>1 and not coalesce((c->>'stackable')::boolean,false) then raise exception 'Invalid purchase quantity';end if;if stock.stock>=0 and stock.stock<amount then raise exception 'Not enough stock';end if;used:=eldervale_private.inventory_used(auth.uid());if used>=16 and not(coalesce((c->>'stackable')::boolean,false) and coalesce((s.stats->>item_id)::integer,0)>0) then raise exception 'Inventory full';end if;
     if coalesce((c->>'unique')::boolean,false) and coalesce((s.stats->>item_id)::integer,0)>0 then raise exception 'You already carry this tool';end if;
     price:=coalesce(stock.buy,(c->>'buy')::integer);perform eldervale_private.item_change(auth.uid(),'gold',-price*amount);perform eldervale_private.item_change(auth.uid(),item_id,amount);update eldervale_private.shop_stock set stock=case when shop_stock.stock<0 then -1 else shop_stock.stock-amount end where merchant=merchant_id and item=item_id;
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
revoke all on function eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) from public,anon;
grant execute on function eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) to authenticated;
-- Starter shoreline location is part of the persistent server world; additional spots are owner-placeable.
insert into eldervale_private.realm_objects(id,kind,x,z,data) values('base:fishing:moonmere','fishing',-70,80,'{"name":"Moonmere fishing"}');
