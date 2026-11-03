create or replace function eldervale_private.world_tick() returns void language plpgsql security definer set search_path='' as $$
declare t timestamptz:=clock_timestamp();prev timestamptz;dt float8;p eldervale_private.realm_players;s public.player_saves;a eldervale_private.realm_actors;o eldervale_private.realm_objects;d jsonb;w jsonb;victim public.player_saves;target_player eldervale_private.realm_players;gx float8;gz float8;dx float8;dz float8;dist float8;step float8;budget float8;moving boolean;damage integer;defence integer;absorb integer;blocked boolean;quantity integer;period float8;lx float8;lz float8;sid text;atk integer;str integer;def integer;award integer;style text;chance float8;
begin
 if not pg_try_advisory_xact_lock(736211) then return;end if;
 select tick_at into prev from eldervale_private.realm_clock where id and enabled;if not found then return;end if;
 dt:=least(1.2,extract(epoch from(t-prev)));if dt<.15 then return;end if;update eldervale_private.realm_clock set tick_at=t where id;
 -- Expired sessions cannot continue attacks or move after leaving the world.
 update eldervale_private.realm_players set path='[]',intent=null where last_seen<t-interval '15 seconds' and (path<>'[]' or intent is not null);
 for p in select * from eldervale_private.realm_players where last_seen>t-interval '15 seconds' order by user_id loop
  if exists(select 1 from eldervale_private.moderation where user_id=p.user_id and (banned_until>t or kicked_at>p.last_seen)) then continue;end if;
  select * into s from public.player_saves where user_id=p.user_id;
  budget:=dt*case when p.run and p.energy>0 then 6.4 else 3.2 end;moving:=false;
  for quantity in 1..96 loop
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
    update eldervale_private.realm_players set yaw=atan2(a.x-target_player.x,a.z-target_player.z) where user_id=a.target;
    update eldervale_private.realm_actors set phase='windup',due_at=t+interval '.5 seconds',turn_at=t+greatest(1.3,period)*interval '1 second',yaw=atan2(target_player.x-a.x,target_player.z-a.z) where id=a.id;
    perform eldervale_private.emit(jsonb_build_object('type','windup','side',a.turn,'target',a.id,'player',a.target,'attackType',a.data->>'attackType','style',target_player.attack_style));
   elsif a.phase='windup' and a.due_at<=t then
    if a.turn='player' then
     atk:=least(100,1+floor(sqrt(greatest(0,coalesce((victim.skills->>'attackXP')::numeric,0))/50))::integer);str:=least(100,1+floor(sqrt(greatest(0,coalesce((victim.skills->>'strengthXP')::numeric,0))/50))::integer);style:=target_player.attack_style;
     chance:=greatest(.2,least(.98,.85+(atk-coalesce((a.data->>'defenceLevel')::integer,(a.data->>'level')::integer))*.003+coalesce((w->>'attack')::integer,0)*.002));blocked:=random()>chance;
     damage:=case when blocked then 0 else greatest(1,1+floor(random()*(4+(w->>'damage')::integer+floor(str*.35)))::integer-floor((a.data->>'level')::integer/15)) end;
     award:=greatest(2,2*ceil(damage/2.0)::integer);
     update public.player_saves set skills=skills||jsonb_build_object('attackXP',coalesce((skills->>'attackXP')::integer,0)+case when style='stab' then award when style='lunge' then award/2 else 0 end,'strengthXP',coalesce((skills->>'strengthXP')::integer,0)+case when style='slash' then award when style='lunge' then award/2 else 0 end,'hitpointsXP',coalesce((skills->>'hitpointsXP')::integer,0)+greatest(1,damage/4)) where user_id=a.target;

     update eldervale_private.realm_actors set hp=greatest(0,hp-damage),phase='recover',due_at=greatest(t+interval '.75 seconds',a.turn_at) where id=a.id;
     perform eldervale_private.emit(jsonb_build_object('type','hit','target',a.id,'player',a.target,'side','player','blocked',blocked,'damage',damage));
     if a.hp<=damage then
      update eldervale_private.realm_actors set target=null,respawn_at=case when (data->>'respawn')::integer>0 then t+(data->>'respawn')::integer*interval '1 second' else null end where id=a.id;
      update public.player_saves set gold=gold+case when coalesce((a.data->>'hostile')::boolean,false) then 8 else 2 end,xp=xp+30,stats=stats||jsonb_build_object('kills',coalesce((stats->>'kills')::integer,0)+1) where user_id=a.target;
      update eldervale_private.realm_players set intent=null,path='[]' where user_id=a.target;perform eldervale_private.emit(jsonb_build_object('type','death','target',a.id,'player',a.target));
     end if;
    else
     select coalesce(sum((data->>'defence')::integer),0),coalesce(sum((data->>'reduction')::integer),0) into defence,absorb from eldervale_private.realm_catalog c where c.id like 'armor:%' and coalesce((victim.equipment->>substring(c.id from 7))::boolean,false);
     if victim.equipment->>'weapon'<>'twohand' then defence:=defence+coalesce((select (data->>'defence')::integer from eldervale_private.realm_catalog where id='shield:'||coalesce(victim.equipment->>'shield','none')),0);end if;
     def:=least(100,1+floor(sqrt(greatest(0,coalesce((victim.skills->>'defenceXP')::numeric,0))/50))::integer);
     chance:=greatest(.1,least(.95,.85+coalesce((a.data->>'level')::integer,1)*.002-(def+defence)*.004));blocked:=random()>chance;
     update public.player_saves set skills=skills||jsonb_build_object('defenceXP',coalesce((skills->>'defenceXP')::integer,0)+case when blocked then 3 else 1 end) where user_id=a.target;

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
declare result jsonb;p eldervale_private.realm_players;s public.player_saves;o eldervale_private.realm_objects;c jsonb;stock eldervale_private.shop_stock;merchant_id text;item_id text;price integer;amount integer;used integer;dedup boolean;shop_data jsonb;
begin
 -- The base authenticates, serializes, applies deliveries, checks bans and owns combat/movement.
 if command='attack_style' then
 result:=eldervale_private.realm_request_base(session_id,'sync','{}',null,event_cursor);if exists(select 1 from eldervale_private.realm_actors where target=auth.uid() and phase='windup') then raise exception 'Choose your next style after the current strike';end if;if payload->>'style' not in ('stab','slash','lunge') or not(payload?'style') then raise exception 'Invalid attack style';end if;update eldervale_private.realm_players set attack_style=payload->>'style' where user_id=auth.uid();result:=eldervale_private.realm_request_base(session_id,'sync','{}',null,event_cursor);
 elsif command not in ('fish','trade') then result:=eldervale_private.realm_request_base(session_id,command,payload,request_id,event_cursor);
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
 return result||jsonb_build_object('stateTime',(select tick_at from eldervale_private.realm_clock where id=true),'shops',shop_data);
end $$;

