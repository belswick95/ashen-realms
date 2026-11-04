-- Integrate each player's previous input before replacing it. Short taps must
-- not disappear between global NPC ticks, and late packets must not replay time.
alter table eldervale_private.realm_players add column if not exists motion_at timestamptz not null default clock_timestamp();

create or replace function eldervale_private.advance_player_motion(player_id uuid, at_time timestamptz default clock_timestamp())
returns eldervale_private.realm_players language plpgsql security definer set search_path='' as $$
declare p eldervale_private.realm_players;previous timestamptz;dt float8;active_dt float8;budget float8;moved_time float8:=0;
 riding boolean;manual boolean;speed float8;gx float8;gz float8;dx float8;dz float8;distance float8;step float8;slide float8[];i integer;
begin
 select * into p from eldervale_private.realm_players where user_id=player_id for update;
 if not found then return null;end if;
 previous:=p.motion_at;dt:=greatest(0,least(1.2,extract(epoch from(at_time-previous))));
 if dt<=0 then return p;end if;
 perform eldervale_private.motion_story(p.floor,p.building);
 riding:=eldervale_private.mounted(player_id,p.x,p.z);if riding then p.run:=false;end if;
 manual:=p.input_until is not null;budget:=dt;
 if manual then
  active_dt:=least(dt,greatest(0,extract(epoch from(least(at_time,p.input_until)-previous))));budget:=active_dt;
  speed:=case when riding then 19.2 when p.run and p.energy>0 then 12.8 else 6.4 end;
  p.path:=case when active_dt>0 then jsonb_build_array(jsonb_build_array(p.x+p.input_x*speed*active_dt,p.z+p.input_z*speed*active_dt)) else '[]'::jsonb end;
  p.intent:=null;
 end if;
 for i in 1..192 loop
  exit when jsonb_array_length(p.path)=0 or budget<=0;
  gx:=(p.path->0->>0)::float8;gz:=(p.path->0->>1)::float8;dx:=gx-p.x;dz:=gz-p.z;distance:=sqrt(dx*dx+dz*dz);
  if distance<.00001 then p.path:=p.path-0;continue;end if;
  speed:=case when riding and eldervale_private.mount_allowed(p.x,p.z) then 19.2 when p.run and p.energy>0 then 12.8 else 6.4 end;
  step:=least(.15,distance,budget*speed);
  slide:=eldervale_private.slide_step(p.x,p.z,p.x+dx/distance*step,p.z+dz/distance*step,manual);
  if slide is null then p.path:='[]';p.intent:=null;exit;end if;
  p.x:=slide[1];p.z:=slide[2];p.yaw:=atan2(dx,dz);budget:=budget-step/speed;moved_time:=moved_time+step/speed;
  if step>=distance-.00001 then p.path:=p.path-0;end if;
 end loop;
 if manual then p.yaw:=p.input_yaw;end if;
 p.energy:=greatest(0,least(100,p.energy+case when riding then 0 else moved_time*case when p.run then -5 else 1.5 end+(dt-moved_time)*3 end));
 if p.energy=0 then p.run:=false;end if;
 if manual and p.input_until<=at_time then p.input_until:=null;p.input_x:=0;p.input_z:=0;end if;
 update eldervale_private.realm_players set x=p.x,z=p.z,yaw=p.yaw,path=p.path,intent=p.intent,energy=p.energy,run=p.run,input_until=p.input_until,input_x=p.input_x,input_z=p.input_z,motion_at=at_time where user_id=player_id returning * into p;
 update public.player_saves set world_position=world_position||jsonb_build_object('x',p.x,'y',p.z,'floor',p.floor,'building',p.building),game_flags=game_flags||jsonb_build_object('runEnergy',p.energy),level=eldervale_private.combat_level(skills) where user_id=player_id;
 return p;
end $$;
revoke all on function eldervale_private.advance_player_motion(uuid,timestamptz) from public,anon,authenticated;
CREATE OR REPLACE FUNCTION eldervale_private.world_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t timestamptz:=clock_timestamp();prev timestamptz;dt float8;p eldervale_private.realm_players;s public.player_saves;a eldervale_private.realm_actors;o eldervale_private.realm_objects;d jsonb;w jsonb;victim public.player_saves;target_player eldervale_private.realm_players;gx float8;gz float8;dx float8;dz float8;dist float8;step float8;budget float8;moving boolean;damage integer;defence integer;absorb integer;blocked boolean;quantity integer;period float8;lx float8;lz float8;sid text;atk integer;str integer;def integer;award integer;style text;chance float8;riding boolean;travel_speed float8;slide float8[];
begin
 if not pg_try_advisory_xact_lock(736211) then return;end if;
 select tick_at into prev from eldervale_private.realm_clock where id and enabled;if not found then return;end if;
 dt:=least(1.2,extract(epoch from(t-prev)));if dt<.15 then return;end if;update eldervale_private.realm_clock set tick_at=t where id;
 perform eldervale_private.motion_story(0,null);perform eldervale_private.gathering_tick(t);perform eldervale_private.skill_tick(t);perform eldervale_private.guard_tick(dt);delete from eldervale_private.ground_drops where expires_at<=t;delete from eldervale_private.trades where expires_at<=t; -- Expired sessions cannot continue attacks or move after leaving the world.
 update eldervale_private.realm_players set path='[]',intent=null where last_seen<t-interval '15 seconds' and (path<>'[]' or intent is not null);
 for p in select * from eldervale_private.realm_players where last_seen>t-interval '15 seconds' order by user_id loop
  if exists(select 1 from eldervale_private.moderation where user_id=p.user_id and (banned_until>t or kicked_at>p.last_seen)) then continue;end if;
  p:=eldervale_private.advance_player_motion(p.user_id,t);
  select * into s from public.player_saves where user_id=p.user_id;
  if p.intent is not null then
   sid:=p.intent->>'target';select * into a from eldervale_private.realm_actors where id=sid and not deleted;
   if found and coalesce((a.data->>'floor')::integer,0)=p.floor and a.data->>'kind' in ('npc','monster') and sqrt(power(p.x-a.x,2)+power(p.z-a.z,2))<3 then
    if p.intent->>'kind'='attack' then
     if not coalesce((a.data->>'attackable')::boolean,a.data->>'kind'='monster') then p.intent:=null;
     elsif a.hp>0 and (a.target is null or a.target=p.user_id) then update eldervale_private.realm_actors set target=p.user_id,phase='ready',turn='player',due_at=t where id=sid and target is null;p.path:='[]';
     end if;
    else perform eldervale_private.emit(jsonb_build_object('type','interaction','player',p.user_id,'target',sid,'kind','npc'));p.intent:=null;p.path:='[]';end if;
   else
    select * into o from eldervale_private.realm_objects where id=sid;
    if found and coalesce((o.data->>'floor')::integer,0)=p.floor and sqrt(power(p.x-o.x,2)+power(p.z-o.z,2))<(case when o.kind in ('door','castle_gate') then 7 else 3 end) then
     if o.kind in ('door','castle_gate') then update eldervale_private.realm_objects set open=not open where id=sid;perform eldervale_private.emit(jsonb_build_object('type','door','target',sid,'player',p.user_id,'open',not o.open));
     elsif o.kind='tree' then
      perform eldervale_private.emit(jsonb_build_object('type','notice','player',p.user_id,'text','Use Chop down tree to start woodcutting.'));
     elsif o.kind='rock' then
      perform eldervale_private.emit(jsonb_build_object('type','notice','player',p.user_id,'text','Use Mine rock to start timed mining.'));
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
 for a in select * from eldervale_private.realm_actors where not deleted and not coalesce((data->>'frozen')::boolean,false) and id not in(select guard from eldervale_private.guard_duels union all select monster from eldervale_private.guard_duels) order by id loop
  perform eldervale_private.motion_story(coalesce((a.data->>'floor')::integer,0),a.data->>'building');if a.hp<=0 then if a.respawn_at is not null and a.respawn_at<=t then update eldervale_private.realm_actors set hp=(data->>'hp')::integer,respawn_at=null,target=null,phase='ready',x=(data->>'x')::float8,z=(data->>'z')::float8 where id=a.id;perform eldervale_private.emit(jsonb_build_object('type','respawn','target',a.id));end if;continue;end if;
  if a.target is not null then
   select * into target_player from eldervale_private.realm_players where user_id=a.target and floor=coalesce((a.data->>'floor')::integer,0) and last_seen>t-interval '15 seconds';
   if not found or exists(select 1 from eldervale_private.moderation where user_id=a.target and banned_until>t) then update eldervale_private.realm_actors set target=null,phase='ready' where id=a.id;continue;end if;
   if coalesce((a.data->>'hostile')::boolean,false) and eldervale_private.town_at(target_player.x,target_player.z) is not null then update eldervale_private.realm_actors set target=null,phase='ready' where id=a.id;continue;end if;
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
     if victim.health<=damage then update public.player_saves set health=max_health,gold=greatest(0,gold-10),world_position=world_position||'{"x":0,"y":5}' where user_id=a.target;update eldervale_private.realm_players set x=0,z=5,floor=0,building=null,intent=null,path='[]' where user_id=a.target;update eldervale_private.realm_actors set target=null,phase='ready' where id=a.id;perform eldervale_private.emit(jsonb_build_object('type','player_death','player',a.target));end if;
    end if;
   elsif a.phase='recover' and a.due_at<=t then update eldervale_private.realm_actors set phase='ready',turn=case when turn='player' then 'enemy' else 'player' end where id=a.id;end if;
  else
   if coalesce((a.data->>'hostile')::boolean,false) and eldervale_private.town_at(a.x,a.z) is null then select user_id into a.target from eldervale_private.realm_players where floor=coalesce((a.data->>'floor')::integer,0) and last_seen>t-interval '15 seconds' and sqrt(power(x-a.x,2)+power(z-a.z,2))<7 order by sqrt(power(x-a.x,2)+power(z-a.z,2)) limit 1;if a.target is not null then update eldervale_private.realm_actors set target=a.target,turn='enemy',phase='ready' where id=a.id;continue;end if;end if;
   gx:=(a.data->>'x')::float8;gz:=(a.data->>'z')::float8;
   if coalesce((a.data->>'roam')::float8,0)>0 then
    if a.roam_pause_until>t then continue;end if;
    if a.roam_x is null then
     chance:=random()*pi()*2;period:=(.5+random()*.5)*(a.data->>'roam')::float8;
     gx:=gx+cos(chance)*period;gz:=gz+sin(chance)*period;
     if not eldervale_private.can_step(a.x,a.z,gx,gz) then
      update eldervale_private.realm_actors set roam_pause_until=t+interval '1 second' where id=a.id;continue;
     end if;
     update eldervale_private.realm_actors set roam_x=gx,roam_z=gz where id=a.id;
    else gx:=a.roam_x;gz:=a.roam_z;end if;
   end if;
   dx:=gx-a.x;dz:=gz-a.z;dist:=sqrt(dx*dx+dz*dz);
   if dist<=.12 then
    update eldervale_private.realm_actors set roam_x=null,roam_z=null,roam_pause_until=t+(2+random()*3)*interval '1 second' where id=a.id;
   else
    step:=least(dt*(case when a.data->>'kind'='npc' then 2.0 else 1.35 end),dist);lx:=a.x+dx/dist*step;lz:=a.z+dz/dist*step;
    if eldervale_private.can_step(a.x,a.z,lx,lz) then
     update eldervale_private.realm_actors set x=lx,z=lz,yaw=atan2(dx,dz) where id=a.id;
    else update eldervale_private.realm_actors set roam_x=null,roam_z=null,roam_pause_until=t+interval '1 second' where id=a.id;end if;
   end if;
  end if;
 end loop;
 perform eldervale_private.motion_story(0,null);delete from eldervale_private.realm_events where created_at<t-interval '5 minutes';delete from eldervale_private.realm_requests where created_at<t-interval '1 day';
end $function$
;
CREATE OR REPLACE FUNCTION eldervale_private.realm_request_before_gathering(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p eldervale_private.realm_players;dx float8;dz float8;angle float8;length float8;result jsonb;duplicate boolean;
begin
 if command not in('steer','jump') then
  if command in('move','stop') then update eldervale_private.realm_players set input_until=null,input_x=0,input_z=0 where user_id=auth.uid() and realm_players.session_id=$1;end if;
  return eldervale_private.realm_request_before_controls($1,$2,$3,$4,$5);
 end if;
 if not eldervale_private.allowed() then raise exception 'World access denied' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>1000 or request_id is null then raise exception 'Invalid movement';end if;
 perform pg_advisory_xact_lock(736211);
 select * into p from eldervale_private.realm_players where user_id=auth.uid() and realm_players.session_id=$1 for update;
 if not found then raise exception 'Session expired';end if;
 if exists(select 1 from eldervale_private.realm_requests r where r.user_id=auth.uid() and r.request_id=$4) then return eldervale_private.realm_request_before_controls($1,'sync','{}',null,$5);end if;
 -- Base sync enforces moderation, maintenance, session expiry and normal command checks.
 -- The final base sync still enforces moderation and maintenance; rejection rolls back this transaction.
 p:=eldervale_private.advance_player_motion(auth.uid(),clock_timestamp());
 if command='steer' then
  dx:=coalesce((payload->>'x')::float8,0);dz:=coalesce((payload->>'z')::float8,0);angle:=coalesce((payload->>'yaw')::float8,p.yaw);
  if not(dx between -1 and 1 and dz between -1 and 1 and angle between -10000 and 10000) then raise exception 'Invalid movement';end if;
  length:=sqrt(dx*dx+dz*dz);if length>1 then dx:=dx/length;dz:=dz/length;end if;
  update eldervale_private.realm_players set input_x=dx,input_z=dz,input_yaw=angle,input_until=case when length>.001 then clock_timestamp()+interval '1.5 seconds' else null end,path='[]',intent=null,yaw=angle where user_id=auth.uid();
 elsif p.jump_at is null or p.jump_at<clock_timestamp()-interval '.85 seconds' then
  update eldervale_private.realm_players set jump_at=clock_timestamp() where user_id=auth.uid();
 end if;
 insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),$4,'{}');
 return eldervale_private.realm_request_before_controls($1,'sync','{}',null,$5);
end $function$
;

