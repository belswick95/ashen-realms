-- Shared, timed gathering. All inventory changes, depletion and XP stay server-side.
create table if not exists eldervale_private.gathering_actions(
 user_id uuid primary key references auth.users(id) on delete cascade,
 target text not null,method text not null check(method in('woodcut','rod','net')),
 started_at timestamptz not null default clock_timestamp(),due_at timestamptz not null);
create index if not exists gathering_due_idx on eldervale_private.gathering_actions(due_at);
create index if not exists realm_tree_regrowth_due_idx on eldervale_private.realm_objects(available_at) where kind='tree' and available_at is not null;
alter table eldervale_private.gathering_actions enable row level security;
revoke all on eldervale_private.gathering_actions from public,anon,authenticated;
insert into eldervale_private.realm_catalog(id,data) values('item:fishingNet','{"name":"Fishing net","buy":28,"sell":9,"unique":true}'::jsonb) on conflict(id) do update set data=excluded.data;
insert into eldervale_private.shop_stock(merchant,item,buy,sell,stock)
 select merchant,'fishingNet',28,9,-1 from eldervale_private.shop_stock where item='fishingPole'
 on conflict(merchant,item) do nothing;

create or replace function eldervale_private.gathering_error(uid uuid,target_id text,method text) returns text language plpgsql security definer set search_path='' as $$
declare p eldervale_private.realm_players;s public.player_saves;o eldervale_private.realm_objects;
begin
 select * into p from eldervale_private.realm_players where user_id=uid;select * into s from public.player_saves where user_id=uid;
 if p.user_id is null or p.last_seen<clock_timestamp()-interval '15 seconds' or s.health<=0 then return 'Gathering stopped.';end if;
 if exists(select 1 from eldervale_private.moderation where user_id=uid and (banned_until>clock_timestamp() or kicked_at>p.last_seen)) then return 'Gathering stopped.';end if;
 if exists(select 1 from eldervale_private.realm_actors where target=uid and hp>0 and not deleted) then return 'Finish combat before gathering.';end if;
 select * into o from eldervale_private.realm_objects where id=target_id;
 if not found or o.kind<>(case when method='woodcut' then 'tree' else 'fishing' end) then return 'That resource is unavailable.';end if;
 if sqrt(power(o.x-p.x,2)+power(o.z-p.z,2))>(case when method='woodcut' then 3.5 else 4 end) then return 'Move closer to the resource.';end if;
 if o.available_at>clock_timestamp() then return 'This tree is regrowing.';end if;
 if method='woodcut' and not(coalesce(s.inventory->'weaponsOwned','[]')?'axe' or s.equipment->>'weapon'='axe') then return 'You need a woodcutting axe in your inventory or equipped.';end if;
 if method='rod' and coalesce((s.stats->>'fishingPole')::integer,0)<1 then return 'You need a fishing pole in your inventory.';end if;
 if method='rod' and coalesce((s.stats->>'bait')::integer,0)<1 then return 'You need fishing bait.';end if;
 if method='net' and coalesce((s.stats->>'fishingNet')::integer,0)<1 then return 'You need a fishing net in your inventory.';end if;
 if eldervale_private.inventory_used(uid)>=16 and not(method='rod' and (s.stats->>'bait')::integer=1) then return 'Your inventory is full.';end if;
 return null;
end $$;
revoke all on function eldervale_private.gathering_error(uuid,text,text) from public,anon,authenticated;

create or replace function eldervale_private.gathering_tick(t timestamptz) returns void language plpgsql security definer set search_path='' as $$
declare a eldervale_private.gathering_actions;o eldervale_private.realm_objects;problem text;remaining integer;n integer;capacity integer;respawn integer;delay float8;uid uuid;min_logs integer;max_logs integer;
begin
 for a in select * from eldervale_private.gathering_actions where due_at<=t for update loop
  select user_id into uid from eldervale_private.realm_players where user_id=a.user_id and (input_until>t and (abs(input_x)+abs(input_z)>.001) or path<>'[]');
  problem:=case when uid is not null then 'Gathering stopped.' else eldervale_private.gathering_error(a.user_id,a.target,a.method) end;
  if problem is not null then delete from eldervale_private.gathering_actions where user_id=a.user_id;perform eldervale_private.emit(jsonb_build_object('type','gather_end','player',a.user_id,'text',problem));continue;end if;
  if a.due_at>t then continue;end if;
  select * into o from eldervale_private.realm_objects where id=a.target for update;
  capacity:=greatest(0,16-eldervale_private.inventory_used(a.user_id));
  if a.method='woodcut' then
   min_logs:=greatest(1,least(10,case when coalesce(o.data->>'resourceMinLogs','')~'^[0-9]{1,4}$' then (o.data->>'resourceMinLogs')::integer else 1 end));
   max_logs:=greatest(min_logs,least(10,case when coalesce(o.data->>'resourceMaxLogs','')~'^[0-9]{1,4}$' then (o.data->>'resourceMaxLogs')::integer else 5 end));
   remaining:=coalesce((o.data->>'logsRemaining')::integer,min_logs+floor(random()*(max_logs-min_logs+1))::integer);
   n:=least(remaining,capacity,case when random()<.15 then 2 else 1 end);
   if n<1 then continue;end if;
   perform eldervale_private.item_change(a.user_id,'wood',n);remaining:=remaining-n;
   update public.player_saves set stats=stats||jsonb_build_object('woodXP',coalesce((stats->>'woodXP')::integer,0)+25*n) where user_id=a.user_id;
   respawn:=greatest(15,least(3600,case when coalesce(o.data->>'resourceRespawn','')~'^[0-9]{1,4}$' then (o.data->>'resourceRespawn')::integer else 45 end));
   update eldervale_private.realm_objects set data=data||jsonb_build_object('logsRemaining',remaining),available_at=case when remaining=0 then t+make_interval(secs=>respawn) else null end where id=o.id;
   perform eldervale_private.emit(jsonb_build_object('type','woodcut','player',a.user_id,'target',o.id,'amount',n,'depleted',remaining=0,'availableAt',case when remaining=0 then t+make_interval(secs=>respawn) else null end));
   if remaining=0 then delete from eldervale_private.gathering_actions where user_id=a.user_id;continue;end if;delay:=3.0;
  else
   if a.method='rod' then perform eldervale_private.item_change(a.user_id,'bait',-1);end if;
   -- One catch per cycle; nets require no bait.
   perform eldervale_private.item_change(a.user_id,'rawFish',1);update public.player_saves set skills=skills||jsonb_build_object('fishingXP',coalesce((skills->>'fishingXP')::integer,0)+25) where user_id=a.user_id;
   perform eldervale_private.emit(jsonb_build_object('type','fishing','player',a.user_id,'target',o.id,'method',a.method,'amount',1));delay:=case when a.method='net' then 4.5 else 4 end;
  end if;
  problem:=eldervale_private.gathering_error(a.user_id,a.target,a.method);if problem is not null then delete from eldervale_private.gathering_actions where user_id=a.user_id;perform eldervale_private.emit(jsonb_build_object('type','gather_end','player',a.user_id,'text',problem));continue;end if;
  update eldervale_private.gathering_actions set started_at=t,due_at=t+make_interval(secs=>delay) where user_id=a.user_id;
 end loop;
 update eldervale_private.realm_objects set available_at=null,data=data-'logsRemaining' where kind='tree' and available_at<=t;
end $$;
revoke all on function eldervale_private.gathering_tick(timestamptz) from public,anon,authenticated;

-- Preserve the currently deployed controls/moderation wrapper.
do $$begin
 if to_regprocedure('eldervale_private.realm_request_before_gathering(uuid,text,jsonb,uuid,bigint)') is null then
  alter function eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) rename to realm_request_before_gathering;
 end if;
end $$;
create or replace function eldervale_private.realm_request(session_id uuid,command text default 'sync',payload jsonb default '{}',request_id uuid default null,event_cursor bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;p eldervale_private.realm_players;o eldervale_private.realm_objects;method text;problem text;target_id text;delay float8;jobs jsonb;
begin
 if command not in('fish','woodcut','cancel_gather') then
  if command in('steer','move','stop','jump','equip','drop','trade_offer','bank') then delete from eldervale_private.gathering_actions where user_id=auth.uid() and exists(select 1 from eldervale_private.realm_players where user_id=auth.uid() and realm_players.session_id=$1);end if;
  result:=eldervale_private.realm_request_before_gathering($1,$2,$3,$4,$5);
 else
  result:=eldervale_private.realm_request_before_gathering($1,'sync','{}',null,$5);
  perform pg_advisory_xact_lock(736211);
  if request_id is null or payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>2000 then raise exception 'Invalid gathering request';end if;
  if not exists(select 1 from eldervale_private.realm_requests r where r.user_id=auth.uid() and r.request_id=$4) then
   select * into p from eldervale_private.realm_players where user_id=auth.uid() and realm_players.session_id=$1 for update;if not found then raise exception 'Session expired';end if;
   if command<>'cancel_gather' and clock_timestamp()-p.last_command<interval '.06 seconds' then raise exception 'Please wait before another action';end if;
   update eldervale_private.realm_players set last_command=clock_timestamp() where user_id=auth.uid();
   if command='cancel_gather' then delete from eldervale_private.gathering_actions where user_id=auth.uid();
   else
    method:=case when command='woodcut' then 'woodcut' else coalesce(payload->>'method','rod') end;if method not in('woodcut','rod','net') or command='fish' and method='woodcut' then raise exception 'Unknown gathering method';end if;
    target_id:=payload->>'target';problem:=eldervale_private.gathering_error(auth.uid(),target_id,method);if problem is not null then raise exception '%',problem;end if;
    if exists(select 1 from eldervale_private.gathering_actions where user_id=auth.uid() and target=target_id and gathering_actions.method=(case when command='woodcut' then 'woodcut' else coalesce(payload->>'method','rod') end)) then null;
    else
     select * into o from eldervale_private.realm_objects where id=target_id;delay:=case when method='woodcut' then 3 when method='net' then 4.5 else 4 end;
     insert into eldervale_private.gathering_actions(user_id,target,method,due_at) values(auth.uid(),target_id,method,clock_timestamp()+make_interval(secs=>delay)) on conflict(user_id) do update set target=excluded.target,method=excluded.method,started_at=clock_timestamp(),due_at=excluded.due_at;
     update eldervale_private.realm_players set path='[]',intent=null,input_until=null,input_x=0,input_z=0,yaw=atan2(o.x-p.x,o.z-p.z) where user_id=auth.uid();
     perform eldervale_private.emit(jsonb_build_object('type','gather_start','player',auth.uid(),'target',target_id,'method',method));
    end if;
   end if;
   insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),$4,'{}');
  end if;
  result:=eldervale_private.realm_request_before_gathering($1,'sync','{}',null,$5);
 end if;
 select coalesce(jsonb_agg(jsonb_build_object('player',job.user_id,'target',job.target,'method',job.method,'startedAt',job.started_at,'dueAt',job.due_at,'x',spot.x,'z',spot.z)),'[]') into jobs from eldervale_private.gathering_actions job join eldervale_private.realm_objects spot on spot.id=job.target join eldervale_private.realm_players viewer on viewer.user_id=auth.uid() where sqrt(power(spot.x-viewer.x,2)+power(spot.z-viewer.z,2))<220;
 return result||jsonb_build_object('gathering',jobs);
end $$;
revoke all on function eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) from public,anon,authenticated;

-- Replace the old instant tree reward with a timed start, preserving all other
-- combat/movement code in the live tick function.
do $$declare body text;old text;new text;begin
 select pg_get_functiondef('eldervale_private.world_tick()'::regprocedure) into body;
 if position('gathering_tick' in body)=0 then
  old:='     elsif o.kind in (''tree'',''rock'') and (o.available_at is null or o.available_at<=t) then';
  if position(old in body)=0 then raise exception 'Tree gathering hook not found';end if;
  new:='     elsif o.kind=''tree'' then
      perform eldervale_private.emit(jsonb_build_object(''type'',''notice'',''player'',p.user_id,''text'',''Use Chop down tree to start woodcutting.''));
     elsif o.kind=''rock'' and (o.available_at is null or o.available_at<=t) then';
  body:=replace(body,old,new);
  body:=replace(body,' perform eldervale_private.guard_tick(dt);',' perform eldervale_private.gathering_tick(t);perform eldervale_private.guard_tick(dt);');
  execute body;
 end if;
 select pg_get_functiondef('eldervale_private.can_step(double precision,double precision,double precision,double precision)'::regprocedure) into body;
 if position('available_at is null' in body)=0 then body:=replace(body,'and(kind in(''tree'',''rock'')', 'and (kind<>''tree'' or available_at is null or available_at<=clock_timestamp()) and(kind in(''tree'',''rock'')');execute body;end if;
end $$;
