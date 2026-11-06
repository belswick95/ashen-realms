-- Minimal local replica for db/tick-tile-engine-*.sql. Table columns match live (read-only,
-- 2026-11-06). The live collision chain (can_step and its layers) and patch_function are loaded
-- by check.mjs from scripts/perf-tick-db/fixture.sql + db/perf-tick-fix.sql (the same steps that
-- produced the live text). advance_player_motion, slide_step, motion_story are verbatim live
-- copies (stage 2 patches them). world_tick, realm_request_base and admin_console are small
-- stand-ins that carry the live anchor lines verbatim in the same variable context; the anchors
-- are additionally checked against the live text read-only (see check.mjs notes).
create schema if not exists auth;create schema if not exists eldervale_private;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table public.player_saves(user_id uuid primary key,character_name text default 'Tester',skills jsonb default '{}',stats jsonb default '{}',inventory jsonb default '{}',equipment jsonb default '{}',game_flags jsonb default '{}',world_position jsonb default '{}',level integer default 3,health integer default 10,max_health integer default 10,gold bigint default 0,xp bigint default 0);
create table eldervale_private.entities(id uuid primary key default gen_random_uuid(),revision bigint,data jsonb,deleted boolean default false,created_at timestamptz default now());
create table eldervale_private.realm_objects(id text primary key,kind text,x float8,z float8,data jsonb default '{}',available_at timestamptz,open boolean default false);
create index realm_objects_position on eldervale_private.realm_objects(x,z);
create table eldervale_private.realm_water(id serial primary key,outline polygon,passable boolean default false);
create table eldervale_private.town_zones(id text primary key,x float8,z float8,radius float8,square boolean default false);
create table eldervale_private.realm_players(user_id uuid primary key,session_id uuid,x float8,z float8,yaw float8 default 0,path jsonb default '[]',intent jsonb,run boolean default false,energy float8 default 100,last_seen timestamptz default now(),last_command timestamptz default now(),fishing_until timestamptz,attack_style text default 'slash',consume_at timestamptz,input_x float8 default 0,input_z float8 default 0,input_yaw float8 default 0,input_until timestamptz,jump_at timestamptz,floor integer default 0,building text,motion_at timestamptz default clock_timestamp(),input_seq bigint default 0,input_session uuid);
create table eldervale_private.realm_actors(id text primary key,data jsonb,x float8,z float8,yaw float8 default 0,hp integer,respawn_at timestamptz,target uuid,turn text default 'player',phase text default 'ready',due_at timestamptz,turn_at timestamptz,deleted boolean default false,roam_x float8,roam_z float8,roam_pause_until timestamptz,route_step integer);
create table eldervale_private.realm_clock(id boolean primary key default true,tick_at timestamptz,enabled boolean default true);
insert into eldervale_private.realm_clock values(true,clock_timestamp()-interval '5 seconds',true);
create table eldervale_private.gathering_actions(user_id uuid primary key,target text,method text,started_at timestamptz,due_at timestamptz);
create table eldervale_private.skill_jobs(user_id uuid primary key,recipe text,target text,ground_drop uuid,remaining integer,started_at timestamptz,due_at timestamptz);
create table eldervale_private.skill_fires(id uuid primary key default gen_random_uuid(),owner_id uuid,x float8,z float8,expires_at timestamptz);
create table eldervale_private.guard_duels(guard text primary key,monster text unique);
create table eldervale_private.moderation(user_id uuid primary key,banned_until timestamptz,kicked_at timestamptz,muted_until timestamptz);
create table eldervale_private.realm_events(id bigserial primary key,data jsonb,created_at timestamptz default clock_timestamp());
create table eldervale_private.realm_requests(user_id uuid,request_id uuid,result jsonb,created_at timestamptz default now(),primary key(user_id,request_id));
create table eldervale_private.realm_catalog(id text primary key,data jsonb);
create table eldervale_private.audit(id bigserial primary key,actor uuid,action text,target text,before_data jsonb,after_data jsonb,created_at timestamptz default now());
create table eldervale_private.test_log(n serial,kind text,id text);
create function eldervale_private.is_owner() returns boolean language sql stable as $$select coalesce(current_setting('test.owner',true),'')='1'$$;
create function eldervale_private.allowed() returns boolean language sql stable as $$select true$$;
create function eldervale_private.tutorial_inside(x float8,z float8) returns boolean language sql immutable as $$select abs(x+340)<=47 and abs(z+305)<=47$$;
create function eldervale_private.tutorial_locked(uid uuid) returns boolean language sql stable as $$select coalesce(current_setting('test.locked',true),'')='1'$$;
create function eldervale_private.story_contains(d jsonb,px float8,pz float8,story integer) returns boolean language sql immutable as $$select true$$;
create function eldervale_private.mounted(uid uuid,px float8,pz float8) returns boolean language sql stable as $$select coalesce(current_setting('test.mounted',true),'')='1'$$;
create function eldervale_private.mount_allowed(px float8,pz float8) returns boolean language sql stable as $$select true$$;
create function eldervale_private.combat_level(skills jsonb) returns integer language sql immutable as $$select 3$$;
create function eldervale_private.emit(data jsonb) returns void language sql as $$insert into eldervale_private.realm_events(data) values(data)$$;
create function eldervale_private.attack_range(weapon text) returns float8 language sql stable as $$select coalesce((select case when coalesce((data->>'ranged')::boolean,false) then (data->>'reach')::float8 else 3 end from eldervale_private.realm_catalog where id='weapon:'||coalesce(weapon,'none')),3)$$;
create function eldervale_private.door_held_open(door_id text) returns boolean language sql stable as $$select false$$;
create function eldervale_private.death_tick(uid uuid,t timestamptz) returns boolean language sql as $$select false$$;
create function eldervale_private.gathering_tick(t timestamptz) returns void language sql as $$select$$;
create function eldervale_private.skill_tick(t timestamptz) returns void language sql as $$select$$;

-- Live, verbatim (2026-11-06).
CREATE OR REPLACE FUNCTION eldervale_private.tutorial_blocked(bx double precision, bz double precision)
 RETURNS boolean
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
 select bx between -392 and -288 and bz between -358 and -252 and exists(
  select 1 from eldervale_private.realm_objects o
  where o.data->>'template' in ('training_pond','throne') and abs(o.x-bx)<6 and abs(o.z-bz)<6
   and sqrt(power(o.x-bx,2)+power(o.z-bz,2))<(case when o.data->>'template'='training_pond' then 2.5 else 1.1 end)*coalesce((o.data->>'scale')::float8,1))
$function$;

CREATE OR REPLACE FUNCTION eldervale_private.motion_story(story integer, building_id text)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$begin
 perform set_config('eldervale.motion_floor',story::text,true);perform set_config('eldervale.motion_building',coalesce(building_id,''),true);
end $function$;

CREATE OR REPLACE FUNCTION eldervale_private.slide_step(px double precision, pz double precision, lx double precision, lz double precision, sliding boolean DEFAULT true)
 RETURNS double precision[]
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare xf boolean;zf boolean;
begin
 if eldervale_private.can_step(px,pz,lx,lz) then return array[lx,lz];end if;
 if not sliding then return null;end if;
 xf:=abs(lx-px)>.000001 and eldervale_private.can_step(px,pz,lx,pz);
 zf:=abs(lz-pz)>.000001 and eldervale_private.can_step(px,pz,px,lz);
 if xf and (not zf or abs(lx-px)>=abs(lz-pz)) then return array[lx,pz];end if;
 if zf then return array[px,lz];end if;
 return null;
end $function$;

CREATE OR REPLACE FUNCTION eldervale_private.advance_player_motion(player_id uuid, at_time timestamp with time zone DEFAULT clock_timestamp())
 RETURNS eldervale_private.realm_players
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare p eldervale_private.realm_players;previous timestamptz;dt float8;active_dt float8;budget float8;moved_time float8:=0;
 riding boolean;manual boolean;speed float8;gx float8;gz float8;dx float8;dz float8;distance float8;step float8;slide float8[];i integer;
begin
 select * into p from eldervale_private.realm_players where user_id=player_id for update;
 if not found then return null;end if;
 previous:=p.motion_at;dt:=greatest(0,least(1.2,extract(epoch from(at_time-previous))));
 if dt<=0 then return p;end if;
 perform eldervale_private.motion_story(p.floor,p.building);perform set_config('eldervale.motion_tutorial',(case when eldervale_private.tutorial_locked(player_id) then '1' else '' end),true);
 riding:=eldervale_private.mounted(player_id,p.x,p.z);if riding then p.run:=false;end if;
 manual:=p.input_until is not null;budget:=dt;
 if manual then
  active_dt:=least(dt,greatest(0,extract(epoch from(least(at_time,p.input_until)-previous))));budget:=active_dt;
  speed:=case when riding then 9.6 when p.run and p.energy>0 then 5.2 else 2.6 end;
  p.path:=case when active_dt>0 then jsonb_build_array(jsonb_build_array(p.x+p.input_x*speed*active_dt,p.z+p.input_z*speed*active_dt)) else '[]'::jsonb end;
  p.intent:=null;
 end if;
 for i in 1..192 loop
  exit when jsonb_array_length(p.path)=0 or budget<=0;
  gx:=(p.path->0->>0)::float8;gz:=(p.path->0->>1)::float8;dx:=gx-p.x;dz:=gz-p.z;distance:=sqrt(dx*dx+dz*dz);
  if distance<.00001 then p.path:=p.path-0;continue;end if;
  speed:=case when riding and eldervale_private.mount_allowed(p.x,p.z) then 9.6 when p.run and p.energy>0 then 5.2 else 2.6 end;
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
 update public.player_saves set world_position=world_position||jsonb_build_object('x',p.x,'y',p.z,'floor',p.floor,'building',p.building),game_flags=game_flags||jsonb_build_object('runEnergy',p.energy),level=eldervale_private.combat_level(skills) where user_id=player_id;perform set_config('eldervale.motion_tutorial','',true);
 return p;
end $function$;

-- Stand-in: the live console_give_xp anchor line, after the owner check.
CREATE OR REPLACE FUNCTION eldervale_private.admin_console(command text, payload jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb;
begin
 if command is null or command not like 'console\_%' then return null;end if;
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if command='console_give_xp' then
  return '{"gave":true}';
 end if;
 raise exception 'Unknown console command';
end $function$;
