-- Shared five-minute drops and an atomic, two-stage player trade protocol.
create table eldervale_private.ground_drops(id uuid primary key default gen_random_uuid(),owner_id uuid not null,item text not null,amount integer not null check(amount>0),x float8 not null,z float8 not null,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '5 minutes');
create index on eldervale_private.ground_drops(expires_at);
create table eldervale_private.trades(id uuid primary key default gen_random_uuid(),a uuid not null,b uuid not null,offer_a jsonb not null default '{"items":{},"gold":0}',offer_b jsonb not null default '{"items":{},"gold":0}',accept_a boolean not null default false,accept_b boolean not null default false,stage text not null default 'invited',revision integer not null default 1,expires_at timestamptz not null default now()+interval '2 minutes',check(a<>b));
alter table eldervale_private.ground_drops enable row level security;
alter table eldervale_private.trades enable row level security;
create policy rpc_only on eldervale_private.ground_drops to authenticated using(false) with check(false);
create policy rpc_only on eldervale_private.trades to authenticated using(false) with check(false);
revoke all on eldervale_private.ground_drops,eldervale_private.trades from public,anon,authenticated;
create function eldervale_private.item_quantity(uid uuid,item text) returns integer language sql stable set search_path='' as $$select case when item='gold' then s.gold when c.data?'field' then case when coalesce(s.inventory->(c.data->>'field'),'[]')?(c.data->>'key') then 1 else 0 end else coalesce((s.stats->>item)::integer,0) end from public.player_saves s left join eldervale_private.realm_catalog c on c.id='item:'||item where s.user_id=uid$$;
create function eldervale_private.item_worn(uid uuid,item text) returns boolean language sql stable set search_path='' as $$select coalesce(case when c.data->>'field'='armorOwned' then (s.equipment->>(c.data->>'key'))::boolean when c.data->>'field'='weaponsOwned' then s.equipment->>'weapon'=c.data->>'key' when c.data->>'field'='shieldsOwned' then s.equipment->>'shield'=c.data->>'key' when c.data->>'field'='jewelryOwned' then s.equipment->>'amulet'=c.data->>'key' or s.equipment->>'trinket'=c.data->>'key' else false end,false) from public.player_saves s left join eldervale_private.realm_catalog c on c.id='item:'||item where s.user_id=uid$$;
create function eldervale_private.validate_offer(uid uuid,offer jsonb) returns void language plpgsql set search_path='' as $$declare k text;n numeric;c jsonb;begin
 if jsonb_typeof(offer)<>'object' or jsonb_typeof(offer->'items')<>'object' or (select count(*) from jsonb_object_keys(offer->'items'))>16 then raise exception 'Invalid trade offer';end if;
 n:=(offer->>'gold')::numeric;if n is null or n::text in ('NaN','Infinity','-Infinity') or n<>trunc(n) or n<0 or n>1000000000 or n>eldervale_private.item_quantity(uid,'gold') then raise exception 'Not enough gold';end if;
 for k,c in select key,value from jsonb_each(offer->'items') loop
  n:=c::text::numeric;if k='gold' or not exists(select 1 from eldervale_private.realm_catalog where id='item:'||k) or n::text in ('NaN','Infinity','-Infinity') or n<>trunc(n) or n<1 or n>1000000 or n>eldervale_private.item_quantity(uid,k) or eldervale_private.item_worn(uid,k) then raise exception 'Unavailable or equipped trade item: %',k;end if;
 end loop;
end $$;
alter function eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) rename to realm_request_social_base;
create function eldervale_private.realm_request(session_id uuid,command text default 'sync',payload jsonb default '{}',request_id uuid default null,event_cursor bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
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
create or replace function public.world_command(session_id uuid,command text default 'sync',payload jsonb default '{}',request_id uuid default null,event_cursor bigint default 0) returns jsonb language sql security invoker set search_path='' as $$select eldervale_private.realm_request(session_id,command,payload,request_id,event_cursor)$$;
revoke all on function eldervale_private.item_quantity(uuid,text),eldervale_private.item_worn(uuid,text),eldervale_private.validate_offer(uuid,jsonb),eldervale_private.realm_request_social_base(uuid,text,jsonb,uuid,bigint),eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) from public,anon,authenticated;
grant execute on function eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) to authenticated;


create table eldervale_private.town_zones(id text primary key,x float8 not null,z float8 not null,radius float8 not null,square boolean not null default false);
create table eldervale_private.guard_duels(guard text primary key,monster text not null unique,next_at timestamptz not null default now(),phase integer not null default 0);
alter table eldervale_private.town_zones enable row level security;alter table eldervale_private.guard_duels enable row level security;
create policy rpc_only on eldervale_private.town_zones to authenticated using(false) with check(false);create policy rpc_only on eldervale_private.guard_duels to authenticated using(false) with check(false);
revoke all on eldervale_private.town_zones,eldervale_private.guard_duels from public,anon,authenticated;
insert into eldervale_private.town_zones(id,x,z,radius,square) values('Oakcross',0,0,52,false);
insert into eldervale_private.town_zones(id,x,z,radius,square) values('Northwatch',-60,45,30,false);
insert into eldervale_private.town_zones(id,x,z,radius,square) values('Eastmarch',75,-55,30,false);
insert into eldervale_private.town_zones(id,x,z,radius,square) values('Farwatch',105,103,30,false);
insert into eldervale_private.town_zones(id,x,z,radius,square) values('Westmere',-210,145,30,false);
insert into eldervale_private.town_zones(id,x,z,radius,square) values('Suncrest',260,-185,30,false);
insert into eldervale_private.town_zones(id,x,z,radius,square) values('Greenwatch',225,215,30,false);
insert into eldervale_private.town_zones(id,x,z,radius,square) values('Ashen Ruins',-275,-215,30,false);
insert into eldervale_private.town_zones(id,x,z,radius,square) values('Moonmere',-114,82,30,false);
insert into eldervale_private.town_zones(id,x,z,radius,square) values('Silverfin',187,74,30,false);
insert into eldervale_private.town_zones(id,x,z,radius,square) values('Pinehollow',-152,-133,30,false);
insert into eldervale_private.town_zones(id,x,z,radius,square) values('Stonebridge',164,-116,30,false);
insert into eldervale_private.town_zones(id,x,z,radius,square) values('Eldervale Castle',-340,-305,69,true);
create function eldervale_private.town_at(px float8,pz float8) returns text language sql stable set search_path='' as $$select id from eldervale_private.town_zones where case when square then greatest(abs(px-x),abs(pz-z))<radius else power(px-x,2)+power(pz-z,2)<radius*radius end order by power(px-x,2)+power(pz-z,2) limit 1$$;
-- Every settlement receives a persistent, editable armed defender.
update eldervale_private.settings set revision=revision+1 where id;
insert into eldervale_private.entities(revision,data) select (select revision from eldervale_private.settings where id),jsonb_build_object('template','guard','kind','npc','name',t.id||' Defender','role','guard','weapon','longsword','x',t.x+8,'z',t.z+8,'yaw',0,'scale',1,'color',6256520,'level',60,'hp',360,'damage',30,'attackSpeed',2.4,'attackType','slash','attackable',false,'hostile',false,'roam',3,'respawn',10,'dialogue','Aggressive beasts do not belong in town. We keep these streets safe.','townDefender',true) from eldervale_private.town_zones t where not square and not exists(select 1 from eldervale_private.entities where data->>'name'=t.id||' Defender');
-- Move existing aggressive wildlife homes beyond town boundaries, preventing endless respawn kills.
do $$declare a record;t record;angle float8;px float8;pz float8;begin
 for a in select * from eldervale_private.realm_actors where id like 'base:%' and coalesce((data->>'hostile')::boolean,false) loop
  select * into t from eldervale_private.town_zones where id=eldervale_private.town_at((a.data->>'x')::float8,(a.data->>'z')::float8);if found then
   angle:=atan2((a.data->>'z')::float8-t.z,(a.data->>'x')::float8-t.x);px:=t.x+cos(angle)*(t.radius+18);pz:=t.z+sin(angle)*(t.radius+18);
   update eldervale_private.realm_actors set data=data||jsonb_build_object('x',px,'z',pz),x=px,z=pz,target=null where id=a.id;
  end if;
 end loop;
end $$;
create function eldervale_private.guard_tick(dt float8) returns void language plpgsql set search_path='' as $$
declare m eldervale_private.realm_actors;g eldervale_private.realm_actors;duel record;px float8;pz float8;dx float8;dz float8;dist float8;damage integer;blocked boolean;level_needed integer;t timestamptz:=clock_timestamp();begin
 delete from eldervale_private.guard_duels d where not exists(select 1 from eldervale_private.realm_actors a where a.id=d.guard and not deleted and hp>0 and not coalesce((data->>'frozen')::boolean,false)) or not exists(select 1 from eldervale_private.realm_actors a where a.id=d.monster and not deleted and hp>0 and eldervale_private.town_at(x,z) is not null and coalesce((data->>'hostile')::boolean,false));
 for m in select * from eldervale_private.realm_actors a where not deleted and hp>0 and coalesce((data->>'hostile')::boolean,false) and eldervale_private.town_at(x,z) is not null and not exists(select 1 from eldervale_private.guard_duels where monster=a.id) loop
  select * into g from eldervale_private.realm_actors a where not deleted and hp>0 and data->>'role'='guard' and not coalesce((data->>'frozen')::boolean,false) and not exists(select 1 from eldervale_private.guard_duels where guard=a.id) and sqrt(power(x-m.x,2)+power(z-m.z,2))<90 order by power(x-m.x,2)+power(z-m.z,2) limit 1;
  if found then insert into eldervale_private.guard_duels(guard,monster) values(g.id,m.id) on conflict do nothing;update eldervale_private.realm_actors set target=null,phase='ready' where id=m.id;end if;
 end loop;
 for duel in select * from eldervale_private.guard_duels loop
  select * into m from eldervale_private.realm_actors where id=duel.monster;select * into g from eldervale_private.realm_actors where id=duel.guard;
  level_needed:=greatest(60,(m.data->>'level')::integer+5);
  update eldervale_private.realm_actors set data=data||jsonb_build_object('level',greatest(level_needed,(data->>'level')::integer),'attackLevel',level_needed,'strengthLevel',level_needed,'defenceLevel',level_needed,'weapon','longsword') where id=g.id;
  dx:=m.x-g.x;dz:=m.z-g.z;dist:=sqrt(dx*dx+dz*dz);
  if dist>2.6 then
   px:=g.x+dx/greatest(.01,dist)*least(dt*3.2,dist-2);pz:=g.z+dz/greatest(.01,dist)*least(dt*3.2,dist-2);
   if eldervale_private.can_step(g.x,g.z,px,pz) then update eldervale_private.realm_actors set x=px,z=pz,yaw=atan2(dx,dz) where id=g.id;end if;
   update eldervale_private.guard_duels set phase=0,next_at=t where guard=g.id;continue;
  end if;
  update eldervale_private.realm_actors set yaw=atan2(dx,dz) where id=g.id;update eldervale_private.realm_actors set yaw=atan2(-dx,-dz),target=null where id=m.id;
  if duel.next_at>t then continue;end if;
  if duel.phase in(0,2) then
   perform eldervale_private.emit(jsonb_build_object('type','npc_windup','attacker',case when duel.phase=0 then g.id else m.id end,'target',case when duel.phase=0 then m.id else g.id end));
   update eldervale_private.guard_duels set phase=duel.phase+1,next_at=t+interval '.55 seconds' where guard=g.id;
  elsif duel.phase=1 then
   damage:=greatest(12,floor(level_needed*.55)::integer);update eldervale_private.realm_actors set hp=greatest(0,hp-damage),respawn_at=case when hp<=damage and (data->>'respawn')::integer>0 then t+(data->>'respawn')::integer*interval '1 second' else respawn_at end where id=m.id;
   perform eldervale_private.emit(jsonb_build_object('type','npc_hit','attacker',g.id,'target',m.id,'damage',least(m.hp,damage),'blocked',false));update eldervale_private.guard_duels set phase=2,next_at=t+interval '.8 seconds' where guard=g.id;
  else
   blocked:=random()<.65;damage:=case when blocked then 0 else greatest(1,coalesce((m.data->>'damage')::integer,4)-floor(level_needed*.15)::integer) end;
   update eldervale_private.realm_actors set hp=greatest(0,hp-damage),respawn_at=case when hp<=damage then t+interval '10 seconds' else respawn_at end where id=g.id;
   perform eldervale_private.emit(jsonb_build_object('type','npc_hit','attacker',m.id,'target',g.id,'damage',least(g.hp,damage),'blocked',blocked));update eldervale_private.guard_duels set phase=0,next_at=t+interval '1 second' where guard=g.id;
  end if;
 end loop;
end $$;
-- Preserve the current combat implementation; add the shared safety simulation once per tick.
do $$declare body text;begin
 body:=pg_get_functiondef('eldervale_private.world_tick()'::regprocedure);
 body:=replace(body,'-- Expired sessions cannot continue attacks or move after leaving the world.','perform eldervale_private.guard_tick(dt);delete from eldervale_private.ground_drops where expires_at<=t;delete from eldervale_private.trades where expires_at<=t; -- Expired sessions cannot continue attacks or move after leaving the world.');
 body:=replace(body,'where not deleted and not coalesce((data->>''frozen'')::boolean,false) order by id','where not deleted and not coalesce((data->>''frozen'')::boolean,false) and id not in(select guard from eldervale_private.guard_duels union all select monster from eldervale_private.guard_duels) order by id');
 body:=replace(body,'if coalesce((a.data->>''hostile'')::boolean,false) then select user_id','if coalesce((a.data->>''hostile'')::boolean,false) and eldervale_private.town_at(a.x,a.z) is null then select user_id');
 execute body;
end $$;
revoke all on function eldervale_private.town_at(float8,float8),eldervale_private.guard_tick(float8) from public,anon,authenticated;

do $$declare body text;begin body:=pg_get_functiondef('eldervale_private.admin_action(text,jsonb)'::regprocedure);body:=replace(body,$icons$'gem','food','potion','scroll','supply'$icons$,$icons$'apple','pear','berries','orange','bread','food','pizza','pie','cake','fish','salmon','lobster','shrimp','meat','chicken','egg','cheese','soup','carrot','mushroom','wheat','water','milk','potion','blue_potion','green_potion','honey','herb','gem','scroll','supply','cloth','leather','bone','ore'$icons$);execute body;end $$;
