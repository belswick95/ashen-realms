-- Stand-ins for the functions stages 2-5 patch. Each keeps the live control flow around the
-- patched lines, and every patch anchor verbatim from the live text (read-only, 2026-11-06);
-- strike maths, loot, chat and moderation details are left out. live-anchors.sql re-checks every
-- anchor against the real live functions.
CREATE OR REPLACE FUNCTION eldervale_private.world_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t timestamptz:=clock_timestamp();prev timestamptz;dt float8;p eldervale_private.realm_players;s public.player_saves;a eldervale_private.realm_actors;o eldervale_private.realm_objects;d jsonb;w jsonb;victim public.player_saves;target_player eldervale_private.realm_players;gx float8;gz float8;dx float8;dz float8;dist float8;step float8;budget float8;moving boolean;damage integer;defence integer;absorb integer;blocked boolean;quantity integer;period float8;lx float8;lz float8;sid text;atk integer;str integer;def integer;award integer;style text;chance float8;riding boolean;shooting boolean;travel_speed float8;slide float8[];
begin
 if not pg_try_advisory_xact_lock(736211) then return;end if;
 select tick_at into prev from eldervale_private.realm_clock where id and enabled;if not found then return;end if;
 dt:=least(1.2,extract(epoch from(t-prev)));if dt<.15 then return;end if;update eldervale_private.realm_clock set tick_at=t where id;
 perform eldervale_private.motion_story(0,null);perform eldervale_private.gathering_tick(t);perform eldervale_private.skill_tick(t);
 for p in select * from eldervale_private.realm_players where last_seen>t-interval '15 seconds' order by user_id loop
  if eldervale_private.death_tick(p.user_id,t) then continue;end if;p:=eldervale_private.advance_player_motion(p.user_id,t);
  select * into s from public.player_saves where user_id=p.user_id;
  if p.intent is not null then
   sid:=p.intent->>'target';select * into a from eldervale_private.realm_actors where id=sid and not deleted;
   if found and coalesce((a.data->>'floor')::integer,0)=p.floor and a.data->>'kind' in ('npc','monster') and sqrt(power(p.x-a.x,2)+power(p.z-a.z,2))<(case when p.intent->>'kind'='attack' then eldervale_private.attack_range(s.equipment->>'weapon') else 3 end) then
    if p.intent->>'kind'='attack' then
     if not coalesce((a.data->>'attackable')::boolean,a.data->>'kind'='monster') then p.intent:=null;
     elsif a.hp>0 and (a.target is null or a.target=p.user_id) then update eldervale_private.realm_actors set target=p.user_id,phase='ready',turn='player',due_at=t where id=sid and target is null;p.path:='[]';
     end if;
    else perform eldervale_private.emit(jsonb_build_object('type','interaction','player',p.user_id,'target',sid,'kind','npc'));p.intent:=null;p.path:='[]';end if;
   else
    select * into o from eldervale_private.realm_objects where id=sid;
    if found and coalesce((o.data->>'floor')::integer,0)=p.floor and sqrt(power(p.x-o.x,2)+power(p.z-o.z,2))<(case when o.kind in ('door','castle_gate') then 7 else 3 end) then
     if o.kind in ('door','castle_gate') then update eldervale_private.realm_objects set open=not open where id=sid;perform eldervale_private.emit(jsonb_build_object('type','door','target',sid,'player',p.user_id,'open',not o.open));
     else perform eldervale_private.emit(jsonb_build_object('type','interaction','player',p.user_id,'target',o.id,'kind',o.kind));end if;
     p.intent:=null;p.path:='[]';
    end if;
   end if;
   update eldervale_private.realm_players set intent=p.intent,path=p.path where user_id=p.user_id;
  end if;
 end loop;
 for a in select * from eldervale_private.realm_actors where not deleted and not coalesce((data->>'frozen')::boolean,false) and id not in(select guard from eldervale_private.guard_duels union all select monster from eldervale_private.guard_duels) and (hp<=0 or target is not null or exists(select 1 from eldervale_private.realm_players near_player where near_player.last_seen>t-interval '15 seconds' and abs(near_player.x-realm_actors.x)<100 and abs(near_player.z-realm_actors.z)<100)) order by id loop
  perform eldervale_private.motion_story(coalesce((a.data->>'floor')::integer,0),a.data->>'building');if a.hp<=0 then if a.respawn_at is not null and a.respawn_at<=t then update eldervale_private.realm_actors set hp=(data->>'hp')::integer,respawn_at=null,target=null,phase='ready',x=(data->>'x')::float8,z=(data->>'z')::float8 where id=a.id;perform eldervale_private.emit(jsonb_build_object('type','respawn','target',a.id));end if;continue;end if;
  if a.target is not null then
   select * into target_player from eldervale_private.realm_players where user_id=a.target and floor=coalesce((a.data->>'floor')::integer,0) and last_seen>t-interval '15 seconds';
   if not found then update eldervale_private.realm_actors set target=null,phase='ready' where id=a.id;continue;end if;
   dist:=sqrt(power(a.x-target_player.x,2)+power(a.z-target_player.z,2));
   if dist>15 or sqrt(power(a.x-(a.data->>'x')::float8,2)+power(a.z-(a.data->>'z')::float8,2))>30 then update eldervale_private.realm_actors set target=null,phase='ready' where id=a.id;continue;end if;
   select * into victim from public.player_saves where user_id=a.target;
   select data into w from eldervale_private.realm_catalog where id='weapon:'||coalesce(victim.equipment->>'weapon','unarmed');w:=coalesce(w,'{"damage":1,"attack":0,"speed":1.8}');
   if dist>2.4 then
    shooting:=coalesce((w->>'ranged')::boolean,false) and dist<=coalesce((w->>'reach')::float8,0);
    dx:=target_player.x-a.x;dz:=target_player.z-a.z;step:=least(dt*1.7,dist-2);lx:=a.x+dx/dist*step;lz:=a.z+dz/dist*step;if eldervale_private.can_step(a.x,a.z,lx,lz) then update eldervale_private.realm_actors set x=lx,z=lz,yaw=atan2(dx,dz),phase=case when shooting then phase else 'ready' end where id=a.id;end if;
    if not shooting then continue;end if;
    if a.turn='enemy' then if a.phase='ready' then update eldervale_private.realm_actors set turn='player' where id=a.id;end if;continue;end if;
   end if;
   period:=case when a.turn='player' then eldervale_private.attack_period(w,target_player.attack_style) else (a.data->>'attackSpeed')::float8 end;
   if a.phase='ready' and a.turn='player' and target_player.consume_at>t-interval '1.8 seconds' then null;
   elsif a.phase='ready' then
    update eldervale_private.realm_players set yaw=atan2(a.x-target_player.x,a.z-target_player.z) where user_id=a.target;
    update eldervale_private.realm_actors set phase='windup',due_at=t+interval '.5 seconds',turn_at=t+greatest(1.3,period)*interval '1 second',yaw=atan2(target_player.x-a.x,target_player.z-a.z) where id=a.id;
    insert into eldervale_private.test_log(kind,id) values('windup:'||a.turn,a.id);
   elsif a.phase='windup' and a.due_at<=t then
    if a.turn='player' then
     damage:=1;
     update eldervale_private.realm_actors set hp=greatest(0,hp-damage),phase='recover',due_at=greatest(t+interval '.75 seconds',a.turn_at) where id=a.id;
     insert into eldervale_private.test_log(kind,id) values('hit:player',a.id);
     if a.hp<=damage then
      update eldervale_private.realm_actors set target=null,respawn_at=case when (data->>'respawn')::integer>0 then t+(data->>'respawn')::integer*interval '1 second' else null end where id=a.id;
     end if;
    else
     update eldervale_private.realm_actors set phase='recover',due_at=greatest(t+interval '.75 seconds',a.turn_at) where id=a.id;
     insert into eldervale_private.test_log(kind,id) values('hit:enemy',a.id);
    end if;
   elsif a.phase='recover' and a.due_at<=t then update eldervale_private.realm_actors set phase='ready',turn=case when turn='player' then 'enemy' else 'player' end where id=a.id;end if;
  else
   if coalesce((a.data->>'hostile')::boolean,false) and eldervale_private.town_at(a.x,a.z) is null then select user_id into a.target from eldervale_private.realm_players where floor=coalesce((a.data->>'floor')::integer,0) and last_seen>t-interval '15 seconds' and sqrt(power(x-a.x,2)+power(z-a.z,2))<7 order by sqrt(power(x-a.x,2)+power(z-a.z,2)) limit 1;if a.target is not null then update eldervale_private.realm_actors set target=a.target,turn='enemy',phase='ready' where id=a.id;continue;end if;end if;
   gx:=(a.data->>'x')::float8;gz:=(a.data->>'z')::float8;
   if jsonb_typeof(a.data->'route')='array' and jsonb_array_length(a.data->'route')>1 then
    if a.roam_pause_until>t then continue;end if;
    if a.roam_x is null then
     a.route_step:=(coalesce(a.route_step,-1)+1)%jsonb_array_length(a.data->'route');gx:=(a.data->'route'->a.route_step->>'x')::float8;gz:=(a.data->'route'->a.route_step->>'z')::float8;
     update eldervale_private.realm_actors set roam_x=gx,roam_z=gz,route_step=a.route_step where id=a.id;
    else gx:=a.roam_x;gz:=a.roam_z;end if;
   elsif coalesce((a.data->>'roam')::float8,0)>0 then
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
    update eldervale_private.realm_actors set roam_x=null,roam_z=null,roam_pause_until=t+(case when jsonb_typeof(a.data->'route')='array' then greatest(0,least(120,coalesce((a.data->'route'->coalesce(a.route_step,0)->>'wait')::float8,0))) else 2+random()*3 end)*interval '1 second' where id=a.id;
   else
    step:=least(dt*(case when a.data->>'kind'='npc' then 2.0 else 1.35 end),dist);lx:=a.x+dx/dist*step;lz:=a.z+dz/dist*step;
    if eldervale_private.can_step(a.x,a.z,lx,lz) then
     update eldervale_private.realm_actors set x=lx,z=lz,yaw=atan2(dx,dz) where id=a.id;
    else update eldervale_private.realm_actors set roam_x=null,roam_z=null,roam_pause_until=t+interval '1 second' where id=a.id;end if;
   end if;
  end if;
 end loop;
 perform eldervale_private.motion_story(0,null);
end $function$;

CREATE OR REPLACE FUNCTION eldervale_private.attack_period(w jsonb, style text)
 RETURNS double precision
 LANGUAGE sql
 IMMUTABLE
 SET search_path TO ''
AS $function$
 select greatest(0.9,coalesce((w->>'speed')::float8,1.8)-(case when coalesce((w->>'ranged')::boolean,false) and not coalesce((w->>'magic')::boolean,false) and style='slash' then 0.45 else 0 end))
$function$;

-- Stand-in for the base command handler: the move/stop/run commands and the reply, as live.
CREATE OR REPLACE FUNCTION eldervale_private.realm_request_base(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p eldervale_private.realm_players;s public.player_saves;c jsonb;d jsonb;item text;field text;key text;slot text;intent_target text;amount integer;n integer;owned boolean;worn boolean;result jsonb;delivery record;
begin
 perform pg_advisory_xact_lock(736211);
 select * into p from eldervale_private.realm_players where user_id=auth.uid() for update;
 if not found or p.session_id<>session_id then raise exception 'This character is active in another session. Sign in again.' using errcode='42501';end if;
 update eldervale_private.realm_players set last_seen=clock_timestamp() where user_id=auth.uid();
 if command='move' then
  if not(payload?'path') or jsonb_typeof(payload->'path')<>'array' or jsonb_array_length(payload->'path')>128 then raise exception 'Invalid route';end if;
  intent_target:=payload->>'target';if intent_target is not null and not exists(select 1 from eldervale_private.realm_actors where id=intent_target and not deleted union all select 1 from eldervale_private.realm_objects where id=intent_target) then raise exception 'Target unavailable';end if;
  update eldervale_private.realm_players set path=payload->'path',intent=case when intent_target is null then null else jsonb_build_object('target',intent_target,'kind',case when payload->>'kind'='creature' then 'attack' else 'interact' end) end where user_id=auth.uid();
  if coalesce(payload->>'kind','')<>'creature' then update eldervale_private.realm_actors set target=null,phase='ready' where target=auth.uid();end if;
 elsif command='run' then update eldervale_private.realm_players set run=coalesce((payload->>'enabled')::boolean,false) and energy>=5 where user_id=auth.uid();
 elsif command='stop' then update eldervale_private.realm_players set path='[]',intent=null where user_id=auth.uid();update eldervale_private.realm_actors set target=null,phase='ready' where target=auth.uid();
 elsif command<>'sync' then raise exception 'Unknown world command';end if;
 perform eldervale_private.world_tick();
 select * into p from eldervale_private.realm_players where user_id=auth.uid();
 select jsonb_build_object('time',clock_timestamp(),'motion',to_jsonb(p),'actors',coalesce((select jsonb_agg((to_jsonb(a)-'data')||jsonb_build_object('data',jsonb_build_object('hp',a.data->'hp','level',a.data->'level'))) from eldervale_private.realm_actors a where not deleted and sqrt(power(a.x-p.x,2)+power(a.z-p.z,2))<220),'[]'::jsonb),'players',coalesce((select jsonb_agg(jsonb_build_object('id',r.user_id,'x',r.x,'z',r.z,'yaw',r.yaw,'run',r.run,'moving',coalesce(r.input_until>clock_timestamp() and abs(r.input_x)+abs(r.input_z)>.001,false))) from eldervale_private.realm_players r where r.user_id<>auth.uid() and r.last_seen>clock_timestamp()-interval '15 seconds'),'[]'::jsonb)) into result;
 return result;
end $function$;

-- Stand-ins: the timer lines of gathering_tick and skill_tick, verbatim.
CREATE OR REPLACE FUNCTION eldervale_private.gathering_tick(t timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare a eldervale_private.gathering_actions;delay float8;
begin
 for a in select * from eldervale_private.gathering_actions where due_at<=t for update loop
  if a.method='woodcut' then
   if random()>=2 then update eldervale_private.gathering_actions set started_at=t,due_at=t+make_interval(secs=>3.0) where user_id=a.user_id;continue;end if;
   delay:=3.0;
  else delay:=case when a.method='net' then 4.5 when a.method='cage' then 5 when a.method='harpoon' then 5.4 else 4 end;
  end if;
  insert into eldervale_private.test_log(kind,id) values('gather',a.target);
  update eldervale_private.gathering_actions set started_at=t,due_at=t+make_interval(secs=>delay) where user_id=a.user_id;
 end loop;
end $function$;

CREATE OR REPLACE FUNCTION eldervale_private.skill_tick(t timestamp with time zone)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare j eldervale_private.skill_jobs;r jsonb;retry boolean:=false;
begin
 for j in select * from eldervale_private.skill_jobs where due_at<=t for update loop
  r:='{"seconds":2.4}';
  insert into eldervale_private.test_log(kind,id) values('skill',j.target);
  if retry then update eldervale_private.skill_jobs set started_at=t,due_at=t+make_interval(secs=>(r->>'seconds')::float8) where user_id=j.user_id;
  else update eldervale_private.skill_jobs set remaining=remaining-1,started_at=t,due_at=t+make_interval(secs=>(r->>'seconds')::float8) where user_id=j.user_id;end if;
 end loop;
end $function$;
