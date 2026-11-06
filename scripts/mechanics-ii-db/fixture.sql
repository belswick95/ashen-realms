-- Minimal local replica for db/mechanics-ii-*.sql. Tables carry the live columns the mechanics use
-- (read-only, 2026-11-06). The gear/combat functions are loaded by check.mjs from
-- db/osrs-equipment-combat.sql. world_tick, realm_request and the other hooked functions are
-- stand-ins that keep the live control flow and every patch anchor verbatim (live text read 2026-11-06);
-- live-anchors.mjs re-checks the anchors against the real live functions (read-only).
create schema if not exists auth;create schema if not exists eldervale_private;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table public.player_saves(user_id uuid primary key,character_name text default 'Tester',skills jsonb default '{}',stats jsonb default '{}',inventory jsonb default '{}',equipment jsonb default '{}',game_flags jsonb default '{}',world_position jsonb default '{}',level integer default 3,health integer default 100,max_health integer default 100,gold bigint default 0,xp bigint default 0);
create table eldervale_private.realm_objects(id text primary key,kind text,x float8,z float8,data jsonb default '{}',available_at timestamptz,open boolean default false);
create table eldervale_private.town_zones(id text primary key,x float8,z float8,radius float8,square boolean default false);
create table eldervale_private.realm_players(user_id uuid primary key,session_id uuid,x float8,z float8,yaw float8 default 0,path jsonb default '[]',intent jsonb,run boolean default false,energy float8 default 100,last_seen timestamptz default now(),last_command timestamptz default now(),attack_style text default 'slash',consume_at timestamptz,input_x float8 default 0,input_z float8 default 0,input_until timestamptz,floor integer default 0,building text,motion_at timestamptz default clock_timestamp());
create table eldervale_private.realm_actors(id text primary key,data jsonb,x float8,z float8,yaw float8 default 0,hp integer,respawn_at timestamptz,target uuid,turn text default 'player',phase text default 'ready',due_at timestamptz,turn_at timestamptz,deleted boolean default false,roam_x float8,roam_z float8,roam_pause_until timestamptz,route_step integer);
create table eldervale_private.realm_clock(id boolean primary key default true,tick_at timestamptz,enabled boolean default true);
insert into eldervale_private.realm_clock values(true,clock_timestamp()-interval '5 seconds',true);
create table eldervale_private.moderation(user_id uuid primary key,banned_until timestamptz,kicked_at timestamptz);
create table eldervale_private.guard_duels(guard text primary key,monster text unique);
create table eldervale_private.realm_events(id bigserial primary key,data jsonb,created_at timestamptz default clock_timestamp());
create table eldervale_private.realm_requests(user_id uuid,request_id uuid,result jsonb,created_at timestamptz default now(),primary key(user_id,request_id));
create table eldervale_private.realm_catalog(id text primary key,data jsonb);
create table eldervale_private.audit(id bigserial primary key,actor uuid,action text,target text,before_data jsonb,after_data jsonb,created_at timestamptz default now());
create table eldervale_private.ground_drops(id uuid primary key default gen_random_uuid(),owner_id uuid,item text,amount integer,x double precision,z double precision,created_at timestamptz default now(),expires_at timestamptz default (now()+'00:05:00'::interval),floor integer default 0);
create table eldervale_private.game_settings(key text primary key,value jsonb);
create table eldervale_private.tick_engine(id boolean primary key default true,config jsonb default '{}',state jsonb default '{}');
insert into eldervale_private.tick_engine values(true,'{}','{}');
create table eldervale_private.test_log(n serial,kind text,id text,data jsonb);

create function eldervale_private.is_owner() returns boolean language sql stable as $$select coalesce(current_setting('test.owner',true),'')='1'$$;
create function eldervale_private.emit(data jsonb) returns void language sql as $$insert into eldervale_private.realm_events(data) values(data)$$;
-- Test clock: test.now overrides clock_timestamp() for tick numbers (tick_no is the live formula).
create function eldervale_private.tick_no(t timestamptz) returns bigint language sql immutable as $fn$select floor(extract(epoch from t)/0.6)::bigint$fn$;
create function eldervale_private.tick_time(n bigint) returns timestamptz language sql immutable as $fn$select to_timestamp(n*0.6)$fn$;
create function eldervale_private.tile_mode() returns boolean language sql stable as $fn$select coalesce((select (config->>'tile_mode')::boolean from eldervale_private.tick_engine where id),false)$fn$;
create function eldervale_private.tile_size() returns double precision language sql immutable as $fn$select 1.58::float8$fn$;
create function eldervale_private.tile_of(v double precision) returns integer language sql immutable as $fn$select floor(v/1.58+.5)::integer$fn$;
create function eldervale_private.engine_seconds(s double precision) returns double precision language sql stable as $fn$select s$fn$;
create function eldervale_private.engine_tick_due(prev timestamptz,t timestamptz) returns boolean language sql as $fn$select true$fn$;
create function eldervale_private.engine_tick_begin(t timestamptz) returns void language sql as $fn$select$fn$;
create function eldervale_private.town_at(px double precision,pz double precision) returns text language sql stable as $fn$select (select id from eldervale_private.town_zones where power(px-x,2)+power(pz-z,2)<radius*radius limit 1)$fn$;
create function eldervale_private.game_multiplier(name text) returns numeric language sql stable as $fn$select greatest(0,least(100,coalesce((select (g.value->>name)::numeric from eldervale_private.game_settings g where g.key='multipliers' and jsonb_typeof(g.value->name)='number'),1)))$fn$;
create function eldervale_private.xp_level(xp numeric) returns integer language sql immutable as $$
 with recursive l(lvl,pts) as (select 1,0::numeric union all select lvl+1,pts+floor(lvl+300*power(2,lvl/7.0)) from l where lvl<99)
 select greatest(1,(select max(lvl) from l where floor(pts/4)<=greatest(0,coalesce(xp,0))))
$$;
create function eldervale_private.monster_damage_scale(level integer) returns double precision language sql immutable as $$ select greatest(1.0,1+(coalesce(level,1)-20)/80.0)::float8 $$;
create function eldervale_private.can_step(ax float8,az float8,bx float8,bz float8) returns boolean language sql stable as $$select true$$;
create function eldervale_private.attack_range(weapon text) returns float8 language sql stable as $$select coalesce((select case when coalesce((data->>'ranged')::boolean,false) then (data->>'reach')::float8 end from eldervale_private.realm_catalog where id='weapon:'||weapon),2.4)$$;
create function eldervale_private.actor_tile_chase(actor_id text,px float8,pz float8,shooting boolean) returns void language sql as $$insert into eldervale_private.test_log(kind,id) values('chase',actor_id)$$;
create function eldervale_private.actor_tile_roam(actor_id text,gx float8,gz float8) returns boolean language sql as $$select true$$;
create function eldervale_private.tile_face_target(x float8,z float8,sid text,yaw float8) returns float8 language sql as $$select yaw$$;
create function eldervale_private.tile_face_talk(uid uuid,sid text) returns void language sql as $$select$$;
create function eldervale_private.death_tick(uid uuid,t timestamptz) returns boolean language sql as $$select false$$;
create function eldervale_private.advance_player_motion_stub(uid uuid) returns void language sql as $$select$$;
create function eldervale_private.actor_loot(actor_id text,killer uuid) returns void language sql as $$insert into eldervale_private.test_log(kind,id) values('old_loot',actor_id)$$;
create function eldervale_private.player_die(uid uuid,t timestamptz default clock_timestamp(),killer text default null) returns void language sql as $$
 update public.player_saves set game_flags=game_flags||jsonb_build_object('deathRespawnAt',t+interval '3 seconds'),health=0 where user_id=uid;insert into eldervale_private.test_log(kind,id) values('died',killer)$$;
create function eldervale_private.item_change(uid uuid,item text,amount integer,bank boolean default false) returns jsonb language sql as $$
 update public.player_saves set stats=stats||jsonb_build_object(item,greatest(0,coalesce((stats->>item)::integer,0)+amount)) where user_id=uid;select '{}'::jsonb$$;
create function eldervale_private.combat_level(skills jsonb) returns integer language sql immutable as $$select 3$$;
create function eldervale_private.realm_request_before_stories(session_id uuid,command text default 'sync',payload jsonb default '{}',request_id uuid default null,event_cursor bigint default 0) returns jsonb language sql as $$select '{"sync":true}'::jsonb$$;
create function eldervale_private.realm_request_services(session_id uuid,command text,payload jsonb,request_id uuid,event_cursor bigint) returns jsonb language sql as $$select '{"sync":true}'::jsonb$$;
create function eldervale_private.allowed() returns boolean language sql as $$select true$$;

-- combat_xp_unscaled: verbatim live text.
CREATE OR REPLACE FUNCTION eldervale_private.combat_xp_unscaled(uid uuid, damage integer, style text, w jsonb)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare d integer:=greatest(0,coalesce(damage,0));magic boolean:=coalesce((w->>'magic')::boolean,false);ranged boolean:=coalesce((w->>'ranged')::boolean,false);share numeric;gains jsonb;
begin
 share:=round(1.33*d,2);
 gains:=(case when magic then jsonb_build_object('magicXP',2*d+coalesce((w->>'spellXp')::numeric,5.5))
  when ranged then jsonb_build_object('rangedXP',4*d)
  when style='stab' then jsonb_build_object('attackXP',4*d)
  when style='lunge' then jsonb_build_object('attackXP',share,'strengthXP',share,'defenceXP',share)
  else jsonb_build_object('strengthXP',4*d) end)||jsonb_build_object('hitpointsXP',share);
 update public.player_saves set skills=skills||coalesce((select jsonb_object_agg(g.key,trim_scale(least(200000000,round(coalesce((skills->>g.key)::numeric,0)+g.value::numeric,2)))) from jsonb_each_text(gains) g where g.value::numeric>0),'{}'::jsonb) where user_id=uid;
end $function$;
create function eldervale_private.combat_xp(uid uuid, damage integer, style text, w jsonb) returns void language sql as $$select eldervale_private.combat_xp_unscaled(uid,damage,style,w)$$;

-- realm_request_social_base: verbatim live text.
CREATE OR REPLACE FUNCTION eldervale_private.realm_request_social_base(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p eldervale_private.realm_players;c jsonb;k text;begin
 if command<>'consume' then return eldervale_private.realm_request_services(session_id,command,payload,request_id,event_cursor);end if;
 if not eldervale_private.allowed() then raise exception 'Sign in required' using errcode='42501';end if;
 perform pg_advisory_xact_lock(736211);select * into p from eldervale_private.realm_players where user_id=auth.uid() and realm_players.session_id=$1 for update;if not found then raise exception 'Session expired';end if;
 if request_id is null then raise exception 'Request ID required';end if;
 if not exists(select 1 from eldervale_private.realm_requests where user_id=auth.uid() and realm_requests.request_id=$4) then
  if p.consume_at>now()-interval '1.75 seconds' then raise exception 'You are already eating.';end if;
  k:=payload->>'item';select data into c from eldervale_private.realm_catalog where id='item:'||k and not(data?'noteOf') and coalesce((data->>'heal')::integer,0)>0 and (data->>'custom'='true' or data->>'category'='Food');if c is null or (c->>'heal')::integer<=0 then raise exception 'This item cannot be consumed';end if;
  perform eldervale_private.item_change(auth.uid(),k,-1);update public.player_saves set health=least(max_health,health+greatest((c->>'heal')::integer,ceil(max_health*coalesce((c->>'healPct')::numeric,0)/100.0)::integer)) where user_id=auth.uid();update eldervale_private.realm_players set consume_at=now() where user_id=auth.uid();perform eldervale_private.emit(jsonb_build_object('type','eat','player',auth.uid(),'item',k));insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),request_id,'{}');
 end if;
 return eldervale_private.realm_request_services(session_id,'sync','{}',null,event_cursor);
end $function$;

-- Stand-ins carrying the live anchors in the same variable context.
CREATE OR REPLACE FUNCTION eldervale_private.realm_request_before_bank_notes(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare result jsonb;p eldervale_private.realm_players;r jsonb;
begin
 select * into p from eldervale_private.realm_players where user_id=auth.uid();
 if command='skill_consume' then
    select data into r from eldervale_private.realm_catalog where id='item:'||(payload->>'item') and coalesce((data->>'heal')::integer,0)>0;
    if r is null then raise exception 'This item cannot be consumed';end if;if p.consume_at>clock_timestamp()-interval '1.75 seconds' then raise exception 'You are already eating.';end if;
    perform eldervale_private.item_change(auth.uid(),payload->>'item',-1);update eldervale_private.realm_players set consume_at=clock_timestamp() where user_id=auth.uid();
 end if;
 return '{}';
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.realm_request_before_castle(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare result jsonb;
begin
 if command='attack_style' then
  if payload->>'style' not in ('stab','slash','lunge') or not(payload?'style') then raise exception 'Invalid attack style';end if;update eldervale_private.realm_players set attack_style=payload->>'style' where user_id=auth.uid();
 end if;
 return '{}';
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.advance_player_motion(player_id uuid, at_time timestamp with time zone)
 RETURNS eldervale_private.realm_players LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare p eldervale_private.realm_players;dt float8;moved_time float8:=0;riding boolean:=false;
begin
 select * into p from eldervale_private.realm_players where user_id=player_id for update;
 if not found then return null;end if;
 dt:=least(1.2,greatest(0,extract(epoch from(at_time-p.motion_at))));
 if jsonb_array_length(p.path)>0 then moved_time:=dt;end if;
 p.energy:=greatest(0,least(100,p.energy+case when riding then 0 else moved_time*case when p.run then -5 else 1.5 end+(dt-moved_time)*3 end));
 if p.energy=0 then p.run:=false;end if;
 update eldervale_private.realm_players set energy=p.energy,run=p.run,motion_at=at_time where user_id=player_id returning * into p;
 return p;
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.advance_player_tiles(player_id uuid, at_time timestamp with time zone)
 RETURNS eldervale_private.realm_players LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare p eldervale_private.realm_players;steps integer:=1;riding boolean:=false;moved boolean;
begin
 select * into p from eldervale_private.realm_players where user_id=player_id for update;
 steps:=(case when p.run and p.energy>0 then 2 else 1 end);moved:=jsonb_array_length(p.path)>0;
  p.energy:=greatest(0,least(100,p.energy+(case when riding then 0 when moved and steps>1 then -3 when moved then .9 else 1.8 end)));
 update eldervale_private.realm_players set energy=p.energy where user_id=player_id returning * into p;
 return p;
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.admin_console(command text, payload jsonb)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare r jsonb;
begin
 if command is null or command not like 'console\_%' then return null;end if;
 if command='console_give_xp' then
  return '{"gave":true}';
 end if;
 return null;
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.realm_request(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare r jsonb;p eldervale_private.realm_players;
begin
 perform pg_advisory_xact_lock(736211);
 if command='stairs' then
  r:='{}';
 else
  select * into p from eldervale_private.realm_players where user_id=auth.uid() and realm_players.session_id=$1;
  if command='celebrate' then
   r:=eldervale_private.realm_request_before_stories($1,'sync','{}',null,$5);
  else
   r:=eldervale_private.realm_request_before_stories($1,$2,$3,$4,$5);
  end if;
 end if;
 select * into p from eldervale_private.realm_players where user_id=auth.uid();
 return r||jsonb_build_object('interior',jsonb_build_object('floor',p.floor,'building',p.building));
end $function$;

-- world_tick: the live control flow of the player and actor loops (motion, objects, guards,
-- trades and routes left out); every mechanics anchor verbatim.
CREATE OR REPLACE FUNCTION eldervale_private.world_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t timestamptz:=coalesce(nullif(current_setting('test.now',true),'')::timestamptz,clock_timestamp());prev timestamptz;dt float8;p eldervale_private.realm_players;s public.player_saves;a eldervale_private.realm_actors;d jsonb;w jsonb;victim public.player_saves;target_player eldervale_private.realm_players;gx float8;gz float8;dx float8;dz float8;dist float8;step float8;damage integer;blocked boolean;period float8;lx float8;lz float8;sid text;award integer;style text;chance float8;shooting boolean;
begin
 if not pg_try_advisory_xact_lock(736211) then return;end if;
 select tick_at into prev from eldervale_private.realm_clock where id and enabled;if not found then return;end if;
 dt:=least(1.2,greatest(0.2,extract(epoch from(t-prev))));if not eldervale_private.engine_tick_due(prev,t) then return;end if;update eldervale_private.realm_clock set tick_at=t where id;perform eldervale_private.engine_tick_begin(t);
 insert into eldervale_private.test_log(kind,id) values('gather',null);perform eldervale_private.skill_tick(t);
 for p in select * from eldervale_private.realm_players where last_seen>t-interval '15 seconds' order by user_id loop
  if eldervale_private.death_tick(p.user_id,t) then continue;end if;
  select * into s from public.player_saves where user_id=p.user_id;
  if p.intent is not null then
   sid:=p.intent->>'target';select * into a from eldervale_private.realm_actors where id=sid and not deleted;
   if found and coalesce((a.data->>'floor')::integer,0)=p.floor and a.data->>'kind' in ('npc','monster') and sqrt(power(p.x-a.x,2)+power(p.z-a.z,2))<(case when p.intent->>'kind'='attack' then (case when eldervale_private.tile_mode() and eldervale_private.attack_range(s.equipment->>'weapon')<=3 then 1.66 else eldervale_private.attack_range(s.equipment->>'weapon') end) else 3 end) then
    if p.intent->>'kind'='attack' then
     if not coalesce((a.data->>'attackable')::boolean,a.data->>'kind'='monster') then p.intent:=null;
     elsif a.hp>0 and (a.target is null or a.target=p.user_id) then update eldervale_private.realm_actors set target=p.user_id,phase='ready',turn='player',due_at=t where id=sid and target is null;p.path:='[]';
     end if;
    else p.intent:=null;p.path:='[]';end if;
   end if;
   update eldervale_private.realm_players set intent=p.intent,path=p.path where user_id=p.user_id;
  end if;
 end loop;
 for a in select * from eldervale_private.realm_actors where not deleted and not coalesce((data->>'frozen')::boolean,false) and (hp<=0 or target is not null or exists(select 1 from eldervale_private.realm_players near_player where near_player.last_seen>t-interval '15 seconds' and abs(near_player.x-realm_actors.x)<100 and abs(near_player.z-realm_actors.z)<100)) order by id loop
  if a.hp<=0 then if a.respawn_at is not null and a.respawn_at<=t then update eldervale_private.realm_actors set hp=(data->>'hp')::integer,respawn_at=null,target=null,phase='ready',x=(data->>'x')::float8,z=(data->>'z')::float8 where id=a.id;perform eldervale_private.emit(jsonb_build_object('type','respawn','target',a.id));end if;continue;end if;
  if a.target is not null then
   select * into target_player from eldervale_private.realm_players where user_id=a.target and floor=coalesce((a.data->>'floor')::integer,0) and last_seen>t-interval '15 seconds';
   if not found or exists(select 1 from public.player_saves dp where dp.user_id=a.target and dp.game_flags?'deathRespawnAt') then update eldervale_private.realm_actors set target=null,phase='ready' where id=a.id;continue;end if;
   if coalesce((a.data->>'hostile')::boolean,false) and eldervale_private.town_at(target_player.x,target_player.z) is not null then update eldervale_private.realm_actors set target=null,phase='ready' where id=a.id;continue;end if;
   dist:=sqrt(power(a.x-target_player.x,2)+power(a.z-target_player.z,2));
   if dist>15 or sqrt(power(a.x-(a.data->>'x')::float8,2)+power(a.z-(a.data->>'z')::float8,2))>30 then update eldervale_private.realm_actors set target=null,phase='ready' where id=a.id;continue;end if;
   insert into eldervale_private.test_log(kind,id) values('old_combat',a.id);
  else
   if coalesce((a.data->>'hostile')::boolean,false) and eldervale_private.town_at(a.x,a.z) is null then select user_id into a.target from eldervale_private.realm_players where floor=coalesce((a.data->>'floor')::integer,0) and last_seen>t-interval '15 seconds' and sqrt(power(x-a.x,2)+power(z-a.z,2))<7 and not exists(select 1 from public.player_saves dp where dp.user_id=realm_players.user_id and dp.game_flags?'deathRespawnAt') order by sqrt(power(x-a.x,2)+power(z-a.z,2)) limit 1;if a.target is not null then update eldervale_private.realm_actors set target=a.target,turn='enemy',phase='ready' where id=a.id;continue;end if;end if;
  end if;
 end loop;
end $function$;
create function eldervale_private.skill_tick(t timestamptz) returns void language sql as $$select$$;
