create index realm_objects_position on eldervale_private.realm_objects(x,z);
create or replace function eldervale_private.world_tick() returns void language plpgsql security definer set search_path='' as $$
declare t timestamptz:=clock_timestamp();prev timestamptz;dt float8;p eldervale_private.realm_players;s public.player_saves;a eldervale_private.realm_actors;o eldervale_private.realm_objects;d jsonb;w jsonb;victim public.player_saves;target_player eldervale_private.realm_players;gx float8;gz float8;dx float8;dz float8;dist float8;step float8;budget float8;moving boolean;damage integer;defence integer;absorb integer;blocked boolean;quantity integer;period float8;lx float8;lz float8;sid text;
begin
 if not pg_try_advisory_xact_lock(736211) then return;end if;
 select tick_at into prev from eldervale_private.realm_clock where id and enabled;if not found then return;end if;
 dt:=least(1.2,extract(epoch from(t-prev)));if dt<.15 then return;end if;update eldervale_private.realm_clock set tick_at=t where id;
 -- Expired sessions cannot continue attacks or move after leaving the world.
 update eldervale_private.realm_players set path='[]',intent=null where last_seen<t-interval '15 seconds' and (path<>'[]' or intent is not null);
 for p in select * from eldervale_private.realm_players where last_seen>t-interval '15 seconds' order by user_id loop
  if exists(select 1 from eldervale_private.moderation where user_id=p.user_id and (banned_until>t or kicked_at>p.last_seen)) then continue;end if;
  select * into s from public.player_saves where user_id=p.user_id;
  budget:=dt*case when p.run and p.energy>0 then 3.8 else 1.9 end;moving:=false;
  for quantity in 1..32 loop
   exit when jsonb_array_length(p.path)=0 or budget<=0;
   gx:=(p.path->0->>0)::float8;gz:=(p.path->0->>1)::float8;dx:=gx-p.x;dz:=gz-p.z;dist:=sqrt(dx*dx+dz*dz);
   if dist<.03 then p.path:=p.path-0;continue;end if;
   step:=least(.15,dist,budget);lx:=p.x+dx/dist*step;lz:=p.z+dz/dist*step;
   if not eldervale_private.can_step(p.x,p.z,lx,lz) then p.path:='[]';p.intent:=null;exit;end if;
   p.x:=lx;p.z:=lz;p.yaw:=atan2(dx,dz);budget:=budget-step;moving:=true;if step>=dist-.01 then p.path:=p.path-0;end if;
  end loop;
  p.energy:=greatest(0,least(100,p.energy+dt*case when moving and p.run then -5 when moving then 1.5 else 3 end));if p.energy=0 then p.run:=false;end if;
  update eldervale_private.realm_players set x=p.x,z=p.z,yaw=p.yaw,path=p.path,energy=p.energy,run=p.run where user_id=p.user_id;
  update public.player_saves set world_position=world_position||jsonb_build_object('x',p.x,'y',p.z),game_flags=game_flags||jsonb_build_object('runEnergy',p.energy),level=eldervale_private.combat_level(skills) where user_id=p.user_id;
  if p.intent is not null then
   sid:=p.intent->>'target';select * into a from eldervale_private.realm_actors where id=sid and not deleted;
   if found and a.data->>'kind' in ('npc','monster') and sqrt(power(p.x-a.x,2)+power(p.z-a.z,2))<3 then
    if p.intent->>'kind'='attack' then
     if not coalesce((a.data->>'attackable')::boolean,a.data->>'kind'='monster') then p.intent:=null;
     elsif a.hp>0 and (a.target is null or a.target=p.user_id) then update eldervale_private.realm_actors set target=p.user_id,phase='ready',turn='player',due_at=t where id=sid and target is null;p.path:='[]';
     end if;
    else perform eldervale_private.emit(jsonb_build_object('type','interaction','player',p.user_id,'target',sid,'kind','npc'));p.intent:=null;p.path:='[]';end if;
   else
    select * into o from eldervale_private.realm_objects where id=sid;
    if found and sqrt(power(p.x-o.x,2)+power(p.z-o.z,2))<(case when o.kind='door' then 7 else 3 end) then
     if o.kind='door' then update eldervale_private.realm_objects set open=not open where id=sid;perform eldervale_private.emit(jsonb_build_object('type','door','target',sid,'player',p.user_id,'open',not o.open));
     elsif o.kind in ('tree','rock') and (o.available_at is null or o.available_at<=t) then
      if coalesce(eldervale_private.inventory_used(p.user_id),0)>=16 then perform eldervale_private.emit(jsonb_build_object('type','notice','player',p.user_id,'text','Your inventory is full.'));
      else perform eldervale_private.item_change(p.user_id,case when o.kind='tree' then 'wood' else 'ore' end,1);sid:=case when o.kind='tree' then 'woodXP' else 'miningXP' end;update public.player_saves set stats=stats||jsonb_build_object(sid,coalesce((stats->>sid)::integer,0)+25) where user_id=p.user_id;update eldervale_private.realm_objects set available_at=t+interval '30 seconds' where id=o.id;perform eldervale_private.emit(jsonb_build_object('type','gather','player',p.user_id,'target',o.id,'availableAt',t+interval '30 seconds'));end if;
     elsif o.kind='chest' then
      if not coalesce((s.game_flags->>'starterChestClaimed')::boolean,false) then
       for d in select data||jsonb_build_object('id',id) from eldervale_private.realm_catalog where id like 'item:%' and data?'field' loop
        if not(coalesce(s.inventory->(d->>'field'),'[]')?(d->>'key')) then perform eldervale_private.item_change(p.user_id,substring(d->>'id' from 6),1,true);end if;
       end loop;
       update public.player_saves set game_flags=game_flags||'{"starterChestClaimed":true,"starterBattleaxeGranted":true,"starterDaggerGranted":true,"starterJewelryGranted":true,"starterShieldsGranted":true}' where user_id=p.user_id;
      end if;perform eldervale_private.emit(jsonb_build_object('type','notice','player',p.user_id,'text','Armory supplies are available in your bank.'));
     elsif o.kind in ('tree','rock') then perform eldervale_private.emit(jsonb_build_object('type','notice','player',p.user_id,'text','This resource is recovering. Try again shortly.'));else perform eldervale_private.emit(jsonb_build_object('type','interaction','player',p.user_id,'target',o.id,'kind',o.kind));end if;
     p.intent:=null;p.path:='[]';
    end if;
   end if;
   update eldervale_private.realm_players set intent=p.intent,path=p.path where user_id=p.user_id;
  end if;
 end loop;
 for a in select * from eldervale_private.realm_actors where not deleted order by id loop
  if a.hp<=0 then if a.respawn_at is not null and a.respawn_at<=t then update eldervale_private.realm_actors set hp=(data->>'hp')::integer,respawn_at=null,target=null,phase='ready',x=(data->>'x')::float8,z=(data->>'z')::float8 where id=a.id;perform eldervale_private.emit(jsonb_build_object('type','respawn','target',a.id));end if;continue;end if;
  if a.target is not null then
   select * into target_player from eldervale_private.realm_players where user_id=a.target and last_seen>t-interval '15 seconds';
   if not found or exists(select 1 from eldervale_private.moderation where user_id=a.target and banned_until>t) then update eldervale_private.realm_actors set target=null,phase='ready' where id=a.id;continue;end if;
   dist:=sqrt(power(a.x-target_player.x,2)+power(a.z-target_player.z,2));
   if dist>15 or sqrt(power(a.x-(a.data->>'x')::float8,2)+power(a.z-(a.data->>'z')::float8,2))>30 then update eldervale_private.realm_actors set target=null,phase='ready' where id=a.id;continue;end if;
   if dist>2.4 then dx:=target_player.x-a.x;dz:=target_player.z-a.z;step:=least(dt*1.7,dist-2);lx:=a.x+dx/dist*step;lz:=a.z+dz/dist*step;if eldervale_private.can_step(a.x,a.z,lx,lz) then update eldervale_private.realm_actors set x=lx,z=lz,yaw=atan2(dx,dz),phase='ready' where id=a.id;end if;continue;end if;
   select * into victim from public.player_saves where user_id=a.target;
   select data into w from eldervale_private.realm_catalog where id='weapon:'||coalesce(victim.equipment->>'weapon','unarmed');w:=coalesce(w,'{"damage":1,"attack":0,"speed":1.8}');
   period:=case when a.turn='player' then (w->>'speed')::float8 else (a.data->>'attackSpeed')::float8 end;
   if a.phase='ready' then
    update eldervale_private.realm_actors set phase='windup',due_at=t+interval '.5 seconds',turn_at=t+greatest(1.3,period)*interval '1 second',yaw=atan2(target_player.x-a.x,target_player.z-a.z) where id=a.id;
    perform eldervale_private.emit(jsonb_build_object('type','windup','side',a.turn,'target',a.id,'player',a.target,'attackType',a.data->>'attackType'));
   elsif a.phase='windup' and a.due_at<=t then
    if a.turn='player' then blocked:=random()<greatest(.02,least(.45,.08+coalesce((a.data->>'level')::integer,1)*.002)-(w->>'attack')::integer*.002);damage:=case when blocked then 0 else greatest(1,4+(w->>'damage')::integer+floor(random()*5)::integer-floor((a.data->>'level')::integer/15)) end;
     update eldervale_private.realm_actors set hp=greatest(0,hp-damage),phase='recover',due_at=greatest(t+interval '.75 seconds',a.turn_at) where id=a.id;
     perform eldervale_private.emit(jsonb_build_object('type','hit','target',a.id,'player',a.target,'side','player','blocked',blocked,'damage',damage));
     if a.hp<=damage then
      update eldervale_private.realm_actors set target=null,respawn_at=case when (data->>'respawn')::integer>0 then t+(data->>'respawn')::integer*interval '1 second' else null end where id=a.id;
      update public.player_saves set gold=gold+case when coalesce((a.data->>'hostile')::boolean,false) then 8 else 2 end,xp=xp+30,skills=skills||jsonb_build_object('attackXP',coalesce((skills->>'attackXP')::integer,0)+10,'strengthXP',coalesce((skills->>'strengthXP')::integer,0)+10,'defenceXP',coalesce((skills->>'defenceXP')::integer,0)+5,'hitpointsXP',coalesce((skills->>'hitpointsXP')::integer,0)+5),stats=stats||jsonb_build_object('kills',coalesce((stats->>'kills')::integer,0)+1) where user_id=a.target;
      update eldervale_private.realm_players set intent=null,path='[]' where user_id=a.target;perform eldervale_private.emit(jsonb_build_object('type','death','target',a.id,'player',a.target));
     end if;
    else
     select coalesce(sum((data->>'defence')::integer),0),coalesce(sum((data->>'reduction')::integer),0) into defence,absorb from eldervale_private.realm_catalog c where c.id like 'armor:%' and coalesce((victim.equipment->>substring(c.id from 7))::boolean,false);
     if victim.equipment->>'weapon'<>'twohand' then defence:=defence+coalesce((select (data->>'defence')::integer from eldervale_private.realm_catalog where id='shield:'||coalesce(victim.equipment->>'shield','none')),0);end if;
     blocked:=random()<greatest(.02,least(.6,.05+defence*.008)-coalesce((a.data->>'level')::integer,1)*.0012)*case when a.data->>'attackType' in ('fire','magic','venom') then .35 else 1 end;
     damage:=case when blocked then 0 else greatest(1,4+(a.data->>'damage')::integer+floor(random()*5)::integer-case when a.data->>'attackType' in ('fire','magic','venom') then 0 else absorb end) end;
     update public.player_saves set health=greatest(0,health-damage) where user_id=a.target;
     update eldervale_private.realm_actors set phase='recover',due_at=greatest(t+interval '.75 seconds',a.turn_at) where id=a.id;
     perform eldervale_private.emit(jsonb_build_object('type','hit','target',a.id,'player',a.target,'side','enemy','blocked',blocked,'damage',damage));
     if victim.health<=damage then update public.player_saves set health=max_health,gold=greatest(0,gold-10),world_position=world_position||'{"x":0,"y":5}' where user_id=a.target;update eldervale_private.realm_players set x=0,z=5,intent=null,path='[]' where user_id=a.target;update eldervale_private.realm_actors set target=null,phase='ready' where id=a.id;perform eldervale_private.emit(jsonb_build_object('type','player_death','player',a.target));end if;
    end if;
   elsif a.phase='recover' and a.due_at<=t then update eldervale_private.realm_actors set phase='ready',turn=case when turn='player' then 'enemy' else 'player' end where id=a.id;end if;
  else
   if coalesce((a.data->>'hostile')::boolean,false) then select user_id into a.target from eldervale_private.realm_players where last_seen>t-interval '15 seconds' and sqrt(power(x-a.x,2)+power(z-a.z,2))<7 order by sqrt(power(x-a.x,2)+power(z-a.z,2)) limit 1;if a.target is not null then update eldervale_private.realm_actors set target=a.target,turn='enemy',phase='ready' where id=a.id;continue;end if;end if;
   gx:=(a.data->>'x')::float8;gz:=(a.data->>'z')::float8;
   if coalesce((a.data->>'roam')::float8,0)>0 then gx:=gx+cos(extract(epoch from t)*.08+length(a.id))*(a.data->>'roam')::float8;gz:=gz+sin(extract(epoch from t)*.08+length(a.id))*(a.data->>'roam')::float8;end if;
   dx:=gx-a.x;dz:=gz-a.z;dist:=sqrt(dx*dx+dz*dz);if dist>.1 then step:=least(dt*.7,dist);lx:=a.x+dx/dist*step;lz:=a.z+dz/dist*step;if eldervale_private.can_step(a.x,a.z,lx,lz) then update eldervale_private.realm_actors set x=lx,z=lz,yaw=atan2(dx,dz) where id=a.id;end if;end if;
  end if;
 end loop;
 delete from eldervale_private.realm_events where created_at<t-interval '5 minutes';delete from eldervale_private.realm_requests where created_at<t-interval '1 day';
end $$;
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
 elsif command='reset' then
  delete from eldervale_private.realm_players where user_id=auth.uid();delete from public.player_saves where user_id=auth.uid();return '{"reset":true}';
 elsif command<>'sync' then raise exception 'Unknown world command';end if;
 if command<>'sync' then insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),request_id,'{}');end if;
 perform eldervale_private.world_tick();
 select * into p from eldervale_private.realm_players where user_id=auth.uid();
 select jsonb_build_object('time',clock_timestamp(),'self',(select to_jsonb(v) from public.player_saves v where user_id=auth.uid()),'motion',to_jsonb(p),'actors',coalesce((select jsonb_agg((to_jsonb(a)-'data')||jsonb_build_object('data',jsonb_build_object('hp',a.data->'hp','level',a.data->'level','attackLevel',a.data->'attackLevel','strengthLevel',a.data->'strengthLevel','defenceLevel',a.data->'defenceLevel','damage',a.data->'damage','attackSpeed',a.data->'attackSpeed','attackType',a.data->'attackType'))) from eldervale_private.realm_actors a where not deleted and sqrt(power(a.x-p.x,2)+power(a.z-p.z,2))<220),'[]'::jsonb),'objects',coalesce((select jsonb_agg(jsonb_build_object('id',id,'open',open,'available_at',available_at)) from eldervale_private.realm_objects where (kind='door' or available_at is not null) and sqrt(power(x-p.x,2)+power(z-p.z,2))<220),'[]'::jsonb),'players',coalesce((select jsonb_agg(jsonb_build_object('id',r.user_id,'username',v.character_name,'x',r.x,'z',r.z,'yaw',r.yaw,'combatLevel',eldervale_private.combat_level(v.skills),'hp',v.health,'maxHp',v.max_health,'run',r.run,'appearance',v.game_flags->'appearance','loadout',jsonb_build_object('weapon',v.equipment->'weapon','shield',v.equipment->'shield','armor',v.equipment))) from eldervale_private.realm_players r join public.player_saves v on v.user_id=r.user_id where r.user_id<>auth.uid() and r.last_seen>clock_timestamp()-interval '15 seconds' and sqrt(power(r.x-p.x,2)+power(r.z-p.z,2))<220),'[]'::jsonb),'eventCursor',(select coalesce(max(id),0) from eldervale_private.realm_events),'events',coalesce((select jsonb_agg(jsonb_build_object('id',id,'data',data)) from eldervale_private.realm_events where id>event_cursor and created_at>clock_timestamp()-interval '8 seconds'),'[]'::jsonb)) into result;
 return result;
end $$;
