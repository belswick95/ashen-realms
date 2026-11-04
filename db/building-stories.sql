alter table eldervale_private.realm_players add column floor integer not null default 0 check(floor between 0 and 2),add column building text;
alter table eldervale_private.ground_drops add column floor integer not null default 0;
create function eldervale_private.story_contains(d jsonb,px float8,pz float8,story integer) returns boolean language sql immutable set search_path='' as $$
 select story between 0 and coalesce((d->>'stories')::integer,1)-1 and abs(((px-(d->>'x')::float8)*cos(coalesce((d->>'yaw')::float8,0)*pi()/180)-(pz-(d->>'z')::float8)*sin(coalesce((d->>'yaw')::float8,0)*pi()/180))/(1.3*coalesce((d->>'scale')::float8,1)))<1.65 and abs(((px-(d->>'x')::float8)*sin(coalesce((d->>'yaw')::float8,0)*pi()/180)+(pz-(d->>'z')::float8)*cos(coalesce((d->>'yaw')::float8,0)*pi()/180))/(1.3*coalesce((d->>'scale')::float8,1)))<1.57
$$;
create function eldervale_private.motion_story(story integer,building_id text) returns void language plpgsql set search_path='' as $$begin
 perform set_config('eldervale.motion_floor',story::text,true);perform set_config('eldervale.motion_building',coalesce(building_id,''),true);
end $$;
alter function eldervale_private.can_step(double precision,double precision,double precision,double precision) rename to can_step_before_stories;
create function eldervale_private.can_step(ax float8,az float8,bx float8,bz float8) returns boolean language plpgsql stable set search_path='' as $$
declare story integer:=coalesce(nullif(current_setting('eldervale.motion_floor',true),''),'0')::integer;building_id text:=current_setting('eldervale.motion_building',true);d jsonb;
begin
 if story>0 then
  select data into d from eldervale_private.entities where id::text=building_id and not deleted;
  if d is null or not eldervale_private.story_contains(d,bx,bz,story) then return false;end if;
  -- Upper stories share the same perimeter; only their own profession fixtures block movement.
  if exists(select 1 from eldervale_private.realm_objects o where coalesce((o.data->>'floor')::integer,0)=story and o.kind<>'door' and abs(o.x-bx)<.8*coalesce((o.data->>'scale')::float8,1) and abs(o.z-bz)<.8*coalesce((o.data->>'scale')::float8,1)) then return false;end if;
  return true;
 end if;
 return eldervale_private.can_step_before_stories(ax,az,bx,bz);
end $$;
-- Existing ground collision layers must ignore objects placed on upper floors.
do $patch$ declare f record;body text;begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eldervale_private' and p.proname in ('can_step_before_stories','can_step_before_castle','can_step_before_professions') loop
  body:=pg_get_functiondef(f.oid);body:=replace(body,'from eldervale_private.realm_objects where ','from eldervale_private.realm_objects where coalesce((data->>''floor'')::integer,0)=0 and ');execute body;
 end loop;
end $patch$;
-- Only the server selects collision floors for each actor, including unattended world ticks.
do $patch$ declare body text;begin
 select pg_get_functiondef('eldervale_private.world_tick()'::regprocedure) into body;
 if md5(body)<>'4aa3d19659bc6698627f3b52159dfb23' then raise exception 'World tick changed; review floor patch';end if;
 body:=replace(body,'perform eldervale_private.gathering_tick(t);','perform eldervale_private.motion_story(0,null);perform eldervale_private.gathering_tick(t);');
 body:=replace(body,'  select * into s from public.player_saves where user_id=p.user_id;','  perform eldervale_private.motion_story(p.floor,p.building);select * into s from public.player_saves where user_id=p.user_id;');
 body:=replace(body,'if found and a.data->>''kind'' in (''npc'',''monster'') and','if found and coalesce((a.data->>''floor'')::integer,0)=p.floor and a.data->>''kind'' in (''npc'',''monster'') and');
 body:=replace(body,'if found and sqrt(power(p.x-o.x,2)','if found and coalesce((o.data->>''floor'')::integer,0)=p.floor and sqrt(power(p.x-o.x,2)');
 body:=replace(body,'  if a.hp<=0 then','  perform eldervale_private.motion_story(coalesce((a.data->>''floor'')::integer,0),a.data->>''building'');if a.hp<=0 then');
 body:=replace(body,'where user_id=a.target and last_seen>','where user_id=a.target and floor=coalesce((a.data->>''floor'')::integer,0) and last_seen>');
 body:=replace(body,'where last_seen>t-interval ''15 seconds'' and sqrt(power(x-a.x,2)','where floor=coalesce((a.data->>''floor'')::integer,0) and last_seen>t-interval ''15 seconds'' and sqrt(power(x-a.x,2)');
 body:=replace(body,'set x=0,z=5,intent=null,path=''[]''','set x=0,z=5,floor=0,building=null,intent=null,path=''[]''');
 body:=replace(body,'''x'',p.x,''y'',p.z)','''x'',p.x,''y'',p.z,''floor'',p.floor,''building'',p.building)');
 body:=replace(body,' delete from eldervale_private.realm_events',' perform eldervale_private.motion_story(0,null);delete from eldervale_private.realm_events');
 execute body;
end $patch$;
-- Drop floor is derived from the owner; callers cannot choose it.
create function eldervale_private.drop_story() returns trigger language plpgsql set search_path='' as $$begin select floor into new.floor from eldervale_private.realm_players where user_id=new.owner_id;new.floor:=coalesce(new.floor,0);return new;end $$;
create trigger drop_story before insert on eldervale_private.ground_drops for each row execute function eldervale_private.drop_story();
alter function eldervale_private.admin_action(text,jsonb) rename to admin_before_stories;
create function eldervale_private.admin_action(command text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb;parent jsonb;r jsonb;story integer;old_story integer;uid uuid;
begin
 if command in ('spawn','update') then
  if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
  if command='update' then select data into d from eldervale_private.entities where id=(payload->>'id')::uuid;end if;d:=coalesce(d,'{}')||payload;
  if d->>'template' in ('cottage','bank','inn','forge') and coalesce((d->>'stories')::integer,1) not between 1 and 3 then raise exception 'Choose one, two or three stories';end if;
  story:=coalesce((d->>'floor')::integer,0);if story not between 0 and 2 then raise exception 'Invalid floor';end if;
  if story>0 then
   select data into parent from eldervale_private.entities where id::text=d->>'building' and not deleted and data->>'template' in ('cottage','bank','inn','forge');
   if parent is null or not eldervale_private.story_contains(parent,(d->>'x')::float8,(d->>'z')::float8,story) then raise exception 'Place upper-floor objects inside their building';end if;
   if d->>'kind'='object' and d->>'template' in ('cottage','bank','inn','forge','terrain_grass','terrain_snow','terrain_stone','terrain_sand','road') then raise exception 'Place buildings and terrain at ground level';end if;
  end if;
  -- Removing a floor occupied by a player or object would strand them.
  if command='update' and d->>'template' in ('cottage','bank','inn','forge') and exists(select 1 from eldervale_private.realm_players where building=d->>'id' and floor>0 union all select 1 from eldervale_private.entities where data->>'building'=d->>'id' and not deleted) and (payload?'x' or payload?'z' or payload?'yaw' or payload?'scale' or payload?'stories') then
   select data into parent from eldervale_private.entities where id=(payload->>'id')::uuid;
   if (parent->'x',parent->'z',parent->'yaw',parent->'scale',coalesce(parent->'stories','1')) is distinct from (d->'x',d->'z',d->'yaw',d->'scale',coalesce(d->'stories','1')) then raise exception 'Move upper-floor occupants and objects out before resizing or moving this building';end if;
  end if;
 end if;
 if command='delete' and exists(select 1 from eldervale_private.realm_players where building=payload->>'id' and floor>0 union all select 1 from eldervale_private.entities where data->>'building'=payload->>'id' and not deleted) then raise exception 'Remove upper-floor occupants and objects before deleting their building';end if;
 perform eldervale_private.motion_story(0,null);r:=eldervale_private.admin_before_stories(command,payload);
 if command in ('teleport','bring') then uid:=coalesce((payload->>'userId')::uuid,auth.uid());update eldervale_private.realm_players set floor=0,building=null where user_id=uid;end if;
 return r;
end $$;
alter function eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) rename to realm_request_before_stories;
create function eldervale_private.realm_request(session_id uuid,command text default 'sync',payload jsonb default '{}',request_id uuid default null,event_cursor bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare r jsonb;p eldervale_private.realm_players;d jsonb;target_floor integer;target_id text;new_floor integer;px float8;pz float8;angle float8;scale float8;
begin
 -- Establish the session through the existing authenticated command path before floor actions.
 if command='stairs' then
  r:=eldervale_private.realm_request_before_stories($1,'sync','{}',null,$5);
  perform pg_advisory_xact_lock(736211);
  select * into p from eldervale_private.realm_players where user_id=auth.uid() and realm_players.session_id=$1 for update;if not found or request_id is null then raise exception 'Invalid session or stair request';end if;
  if not exists(select 1 from eldervale_private.realm_requests x where x.user_id=auth.uid() and x.request_id=$4) then
   select data into d from eldervale_private.entities where id::text=payload->>'building' and not deleted and data->>'template' in ('cottage','bank','inn','forge');
   if d is null then raise exception 'Building unavailable';end if;
   new_floor:=(payload->>'floor')::integer;scale:=1.3*(d->>'scale')::float8;angle:=coalesce((d->>'yaw')::float8,0)*pi()/180;
   px:=(d->>'x')::float8+(1.12*cos(angle)-.65*sin(angle))*scale;pz:=(d->>'z')::float8+(-1.12*sin(angle)-.65*cos(angle))*scale;
   if new_floor is null or abs(new_floor-p.floor)<>1 or new_floor not between 0 and coalesce((d->>'stories')::integer,1)-1 or sqrt(power(p.x-px,2)+power(p.z-pz,2))>greatest(1.3,.65*scale) or p.floor>0 and p.building<>payload->>'building' then raise exception 'Move to the stairs to change one floor at a time';end if;
   if exists(select 1 from eldervale_private.trades where (a=auth.uid() or b=auth.uid()) and stage not in ('complete','cancelled')) then raise exception 'Close your trade before using stairs';end if;
   if exists(select 1 from eldervale_private.realm_actors where target=auth.uid()) then raise exception 'Finish combat before using stairs';end if;
   update eldervale_private.realm_players set floor=new_floor,building=case when new_floor=0 then null else payload->>'building' end,path='[]',intent=null,input_until=null,input_x=0,input_z=0,last_command=clock_timestamp() where user_id=auth.uid();
   update public.player_saves set world_position=world_position||jsonb_build_object('floor',new_floor,'building',case when new_floor=0 then null else payload->>'building' end) where user_id=auth.uid();
   delete from eldervale_private.skill_jobs where user_id=auth.uid();delete from eldervale_private.gathering_actions where user_id=auth.uid();
   insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),$4,'{}');
  end if;
  r:=eldervale_private.realm_request_before_stories($1,'sync','{}',null,$5);
 else
  select * into p from eldervale_private.realm_players where user_id=auth.uid() and realm_players.session_id=$1;
  -- Reject actions across floors even when their X/Z coordinates coincide.
  target_id:=coalesce(payload->>'target',payload->>'merchant',payload->>'player');
  if command in ('quest_accept','quest_complete') then select coalesce(pq.data,q.data)->>'giver' into target_id from eldervale_private.quest_definitions q left join eldervale_private.player_quests pq on pq.quest_id=q.id and pq.user_id=auth.uid() where q.id=(payload->>'id')::uuid;end if;
  if target_id is not null then
   select coalesce((data->>'floor')::integer,0) into target_floor from eldervale_private.realm_actors where id=target_id;
   if not found then select coalesce((data->>'floor')::integer,0) into target_floor from eldervale_private.realm_objects where id=target_id;end if;
   if not found then select floor into target_floor from eldervale_private.realm_players where user_id::text=target_id;end if;
   if target_floor is not null and target_floor<>p.floor then raise exception 'That target is on another floor';end if;
  end if;
  if command like 'trade_%' and command<>'trade_request' and exists(select 1 from eldervale_private.trades t join eldervale_private.realm_players a on a.user_id=t.a join eldervale_private.realm_players b on b.user_id=t.b where t.id=(payload->>'id')::uuid and a.floor<>b.floor) then raise exception 'Trade partner is on another floor';end if;
  if command='pickup_drop' and exists(select 1 from eldervale_private.ground_drops where id=(payload->>'id')::uuid and floor<>p.floor) then raise exception 'That item is on another floor';end if;
  r:=eldervale_private.realm_request_before_stories($1,$2,$3,$4,$5);
 end if;
 select * into p from eldervale_private.realm_players where user_id=auth.uid();
 return r||jsonb_build_object('interior',jsonb_build_object('floor',p.floor,'building',p.building),'playerFloors',(select coalesce(jsonb_object_agg(user_id::text,floor),'{}') from eldervale_private.realm_players where last_seen>clock_timestamp()-interval '15 seconds'));
end $$;
revoke all on function eldervale_private.story_contains(jsonb,double precision,double precision,integer),eldervale_private.motion_story(integer,text),eldervale_private.can_step(double precision,double precision,double precision,double precision),eldervale_private.drop_story(),eldervale_private.admin_action(text,jsonb),eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) from public,anon,authenticated;

-- Public SQL RPCs invoke these checked entry points as the authenticated role.
grant execute on function eldervale_private.admin_action(text,jsonb),eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) to authenticated;
