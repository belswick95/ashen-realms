-- Minimal live-shaped schema for scripts/underground-db/check.mjs (PGlite). Functions the
do $r$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;end $r$;
-- underground/water files patch are copied from live (2026-11-06) so their anchors are exercised;
-- everything else is a small stand-in.
create schema if not exists eldervale_private;
create schema if not exists auth;
create or replace function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('test.uid',true),'')::uuid $$;
create table public.player_saves(user_id uuid primary key,character_name text,health integer not null default 100,max_health integer not null default 100,skills jsonb not null default '{}',stats jsonb not null default '{}',inventory jsonb not null default '{}',equipment jsonb not null default '{}',world_position jsonb not null default '{}',level integer default 3);
create table eldervale_private.settings(id boolean primary key default true,revision bigint not null default 0,maintenance boolean not null default false);
insert into eldervale_private.settings(id) values(true);
create table eldervale_private.entities(id uuid primary key default gen_random_uuid(),revision bigint not null,data jsonb not null,deleted boolean not null default false,created_at timestamptz not null default now());
create table eldervale_private.realm_objects(id text primary key,kind text not null,x double precision not null,z double precision not null,data jsonb not null default '{}',available_at timestamptz,open boolean not null default false);
create table eldervale_private.realm_actors(id text primary key,data jsonb,x double precision,z double precision,yaw double precision default 0,hp integer,respawn_at timestamptz,target uuid,turn text,phase text,due_at timestamptz,turn_at timestamptz,deleted boolean not null default false,roam_x double precision,roam_z double precision,roam_pause_until timestamptz,route_step integer);
create table eldervale_private.realm_players(user_id uuid primary key,session_id uuid,x double precision not null default 0,z double precision not null default 0,yaw double precision default 0,path jsonb default '[]',intent jsonb,run boolean default false,energy double precision default 100,last_seen timestamptz default now(),last_command timestamptz default now()-interval '1 minute',fishing_until timestamptz,attack_style text,consume_at timestamptz,input_x double precision default 0,input_z double precision default 0,input_yaw double precision,input_until timestamptz,jump_at timestamptz,floor integer not null default 0,building text,motion_at timestamptz,input_seq bigint,input_session uuid);
create table eldervale_private.realm_requests(user_id uuid,request_id uuid,result jsonb not null,created_at timestamptz default now(),primary key(user_id,request_id));
create table eldervale_private.realm_events(id bigserial primary key,data jsonb,created_at timestamptz default clock_timestamp());
create table eldervale_private.realm_water(id integer primary key,outline polygon not null,passable boolean not null default false);
create table eldervale_private.realm_catalog(id text primary key,data jsonb not null);
create table eldervale_private.skill_recipes(id text primary key,data jsonb not null);
create table eldervale_private.gathering_actions(user_id uuid primary key,target text not null,method text not null,started_at timestamptz not null default clock_timestamp(),due_at timestamptz not null);
create table eldervale_private.tile_flags(floor smallint not null default 0,i integer not null,j integer not null,flags smallint not null default 0,door_bits smallint not null default 0,door text,primary key(floor,i,j));
create table eldervale_private.tick_engine(id boolean primary key default true,config jsonb not null default '{}',state jsonb not null default '{}');
insert into eldervale_private.tick_engine(id) values(true);
create table eldervale_private.tile_walkers(user_id uuid primary key,step_tiles integer not null default 0,route jsonb not null default '[]',goal jsonb,updated_at timestamptz default now());
create table eldervale_private.audit(id bigserial primary key,actor uuid,action text,target text,before_data jsonb,after_data jsonb,created_at timestamptz default now());
create table eldervale_private.shop_stock(merchant text,item text,buy integer,sell integer,stock integer,primary key(merchant,item));

create or replace function eldervale_private.is_owner() returns boolean language sql stable as $$ select current_setting('test.owner',true)='1' $$;
create or replace function eldervale_private.emit(data jsonb) returns void language sql as $$ insert into eldervale_private.realm_events(data) values(data) $$;
create or replace function eldervale_private.tile_of(v double precision) returns integer language sql immutable as $fn$select floor(v/1.58+.5)::integer$fn$;
create or replace function eldervale_private.tile_center(t integer) returns double precision language sql immutable as $fn$select round((t*1.58)::numeric,3)::float8$fn$;
create or replace function eldervale_private.tutorial_inside(x double precision,z double precision) returns boolean language sql immutable as $$ select false $$;
create or replace function eldervale_private.tutorial_blocked(x double precision,z double precision) returns boolean language sql immutable as $$ select false $$;
create or replace function eldervale_private.can_step_before_camp(ax double precision,az double precision,bx double precision,bz double precision) returns boolean language sql stable as $$ select true $$;
create or replace function eldervale_private.xp_level(xp numeric) returns integer language plpgsql immutable as $$
declare l integer:=1;pts numeric:=0;
begin for lv in 1..98 loop pts:=pts+floor(lv+300*power(2,lv/7.0));exit when floor(pts/4)>coalesce(xp,0);l:=lv+1;end loop;return l;end $$;
create or replace function eldervale_private.combat_level(skills jsonb) returns integer language sql immutable as $$ select greatest(3,coalesce((skills->>'combatTest')::integer,3)) $$;
create or replace function eldervale_private.skilling_chance(low numeric,high numeric,level integer) returns numeric language sql immutable as $$ select least(1,(1+floor(low*(99-level)/98+high*(level-1)/98))/256) $$;
create or replace function eldervale_private.inventory_capacity() returns integer language sql immutable as $$ select 28 $$;
create or replace function eldervale_private.inventory_used(uid uuid) returns integer language sql stable as $$ select 0 $$;
create or replace function eldervale_private.engine_seconds(s double precision) returns double precision language sql immutable as $$ select s $$;
create or replace function eldervale_private.woodcut_chance(uid uuid,d jsonb) returns double precision language sql stable as $$ select 1::float8 $$;
create or replace function eldervale_private.tree_log_item(d jsonb) returns text language sql immutable as $$ select 'wood' $$;
create or replace function eldervale_private.tree_log_xp_osrs(d jsonb) returns numeric language sql immutable as $$ select 25::numeric $$;
create or replace function eldervale_private.xp_scaled_exact(skill text,amount numeric) returns numeric language sql immutable as $$ select amount $$;
create or replace function eldervale_private.item_change(uid uuid,item text,amount integer,bank boolean default false) returns void language sql as $$
 update public.player_saves set stats=stats||jsonb_build_object(item,coalesce((stats->>item)::integer,0)+amount) where user_id=uid $$;
create or replace function eldervale_private.skill_xp(uid uuid,skill text,amount numeric) returns void language sql as $$
 update public.player_saves set skills=skills||jsonb_build_object(skill||'XP',coalesce((skills->>(skill||'XP'))::numeric,0)+amount) where user_id=uid $$;
create or replace function eldervale_private.skill_level(uid uuid, skill text) returns integer language sql stable set search_path to '' as $function$
 select eldervale_private.xp_level(coalesce(case skill when 'mining' then s.stats->>'miningXP' when 'woodcutting' then coalesce(s.stats->>'woodXP',s.skills->>'woodcuttingXP') else s.skills->>(skill||'XP') end,'0')::numeric)
 from public.player_saves s where s.user_id=uid
$function$;
create or replace function eldervale_private.gathering_error_before_professions(uid uuid,target_id text,method text) returns text language plpgsql stable as $$
declare o eldervale_private.realm_objects;p eldervale_private.realm_players;
begin select * into p from eldervale_private.realm_players where user_id=uid;select * into o from eldervale_private.realm_objects where id=target_id;
 if not found or o.kind<>(case when method='woodcut' then 'tree' else 'fishing' end) then return 'That resource is unavailable.';end if;
 if sqrt(power(o.x-p.x,2)+power(o.z-p.z,2))>4 then return 'Move closer to the resource.';end if;return null;end $$;
-- Stand-in for the outermost realm_request: the live anchor line, then a reply.
create or replace function eldervale_private.realm_request(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare p eldervale_private.realm_players;
begin
 perform pg_advisory_xact_lock(736211); -- Lock order: advisory lock before any row lock (as world_tick), so commands never deadlock with the tick.
 select * into p from eldervale_private.realm_players where user_id=auth.uid();
 if not found or p.session_id<>$1 then raise exception 'This character is active in another session. Sign in again.';end if;
 return jsonb_build_object('command',command,'x',p.x,'z',p.z);
end $function$;
create or replace function eldervale_private.realm_request_before_professions(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0)
 returns jsonb language plpgsql security definer set search_path to '' as $function$
declare method text;problem text;
begin
 method:=case when command='woodcut' then 'woodcut' else coalesce(payload->>'method','rod') end;if method not in('woodcut','rod','net','cage','harpoon') or command='fish' and method='woodcut' then raise exception 'Unknown gathering method';end if;
 problem:=eldervale_private.gathering_error(auth.uid(),payload->>'target',method);if problem is not null then raise exception '%',problem;end if;
 insert into eldervale_private.gathering_actions(user_id,target,method,due_at) values(auth.uid(),payload->>'target',method,clock_timestamp()) on conflict(user_id) do update set target=excluded.target,method=excluded.method,due_at=excluded.due_at;
 return '{}'::jsonb;
end $function$;
create or replace function eldervale_private.admin_building_signs(command text,payload jsonb) returns jsonb language sql as $$ select '{"signs":true}'::jsonb $$;
create or replace function eldervale_private.admin_action(command text, payload jsonb DEFAULT '{}'::jsonb) returns jsonb language plpgsql security definer set search_path to '' as $function$
declare d jsonb;
begin
 if command like 'sign\_%' then return eldervale_private.admin_building_signs(command,payload);end if;
 raise exception 'Unknown command %',command;
end $function$;

-- ------------------------------------------------------------------ live copies
CREATE OR REPLACE FUNCTION eldervale_private.patch_function(target regprocedure, edits text[], probe boolean DEFAULT false)
 RETURNS text LANGUAGE plpgsql SET search_path TO '' AS $function$
declare def text:=pg_get_functiondef(target);old text;n integer;name text:=target::oid::regproc::text;head text;at integer;
begin
 if edits is null or cardinality(edits)=0 or cardinality(edits)%2<>0 then raise exception 'Edits must be old/new pairs';end if;
 for i in 1..cardinality(edits)/2 loop
  old:=edits[2*i-1];
  if old is null or old='' then raise exception 'Empty patch anchor';end if;
  n:=(length(def)-length(replace(def,old,'')))/length(old);
  if n<>1 then raise exception 'Patch anchor % for % matched % times: %',i,name,n,left(old,120);end if;
  def:=replace(def,old,edits[2*i]);
 end loop;
 if probe then
  head:='FUNCTION '||name||'(';at:=position(head in def);if at=0 then raise exception 'Cannot find header of %',name;end if;
  def:=overlay(def placing 'FUNCTION '||name||'_probe(' from at for length(head));
 end if;
 execute def;
 return case when probe then name||'_probe compiled' else name||' patched' end;
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.soft_patch(target text, marker text, edits text[])
 RETURNS text LANGUAGE plpgsql SET search_path TO '' AS $function$
declare fn regprocedure:=to_regprocedure(target);def text;n integer;
begin
 if fn is null then raise notice 'admin-full-control: % not found, skipped',target;return target||': missing';end if;
 def:=pg_get_functiondef(fn);
 if position(marker in def)>0 then return target||': already patched';end if;
 for i in 1..cardinality(edits)/2 loop
  n:=(length(def)-length(replace(def,edits[2*i-1],'')))/length(edits[2*i-1]);
  if n<>1 then raise notice 'admin-full-control: anchor % of % matched % times, skipped',i,target,n;return target||': anchor changed, skipped';end if;
 end loop;
 perform eldervale_private.patch_function(fn,edits);
 return target||': patched';
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.entity_runtime()
 RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$declare d jsonb:=new.data;begin
 if d->>'kind' in ('npc','monster') then
  d:=d||jsonb_build_object('hp',greatest(1,coalesce((d->>'hp')::integer,45)),'level',greatest(1,least(999,coalesce((d->>'level')::integer,1))),'attackLevel',greatest(1,least(999,coalesce((d->>'attackLevel')::integer,(d->>'level')::integer,1))),'defenceLevel',greatest(1,least(999,coalesce((d->>'defenceLevel')::integer,(d->>'level')::integer,1))),'strengthLevel',greatest(1,least(999,coalesce((d->>'strengthLevel')::integer,(d->>'level')::integer,1))));
  insert into eldervale_private.realm_actors(id,data,x,z,hp,deleted) values(new.id::text,d,(d->>'x')::float8,(d->>'z')::float8,(d->>'hp')::integer,new.deleted) on conflict(id) do update set data=excluded.data,x=excluded.x,z=excluded.z,hp=excluded.hp,deleted=excluded.deleted,roam_x=null,roam_z=null,roam_pause_until=null,target=null,phase='ready',respawn_at=null;
 else
  if new.deleted then delete from eldervale_private.realm_objects where id=new.id::text;
  else insert into eldervale_private.realm_objects(id,kind,x,z,data) values(new.id::text,case when d->>'template'='castle_gate' then 'castle_gate' when d->>'template'='fishing_spot' then 'fishing' when d->>'template' in ('cottage','bank','inn','forge') then 'door' when d->>'template' in ('tree','pine') then 'tree' when d->>'template'='rock' then 'rock' when d->>'template'='market' then 'merchant' else d->>'kind' end,(d->>'x')::float8,(d->>'z')::float8,d||jsonb_build_object('type',d->>'template','scaleX',1.3*coalesce((d->>'scale')::float8,1),'scaleZ',1.3*coalesce((d->>'scale')::float8,1),'yaw',coalesce((d->>'yaw')::float8,0)*pi()/180)) on conflict(id) do update set data=excluded.data,x=excluded.x,z=excluded.z;end if;
 end if;
 delete from eldervale_private.shop_stock where merchant=new.id::text;
 if not new.deleted then insert into eldervale_private.shop_stock(merchant,item,buy,sell,stock) select new.id::text,key,(value->>'buy')::integer,(value->>'sell')::integer,(value->>'stock')::integer from jsonb_each(coalesce(d->'shop','{}'));end if;
 return new;
end $function$;
create trigger runtime_entity after insert or update on eldervale_private.entities for each row execute function eldervale_private.entity_runtime();
CREATE OR REPLACE FUNCTION eldervale_private.can_step(ax double precision, az double precision, bx double precision, bz double precision)
 RETURNS boolean LANGUAGE plpgsql STABLE SET search_path TO '' AS $function$
declare o record;size jsonb;dx float8;dz float8;a float8;s float8;story integer:=coalesce(nullif(current_setting('eldervale.motion_floor',true),''),'0')::integer;
begin
 -- Trainees cannot step from the castle courtyard to anywhere outside it.
 if coalesce(current_setting('eldervale.motion_tutorial',true),'')='1' and eldervale_private.tutorial_inside(ax,az) and not eldervale_private.tutorial_inside(bx,bz) then return false;end if;
 if eldervale_private.tutorial_blocked(bx,bz) then return false;end if;
 if not eldervale_private.can_step_before_camp(ax,az,bx,bz) then return false;end if;
 return true;
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.tile_flags_at(ti integer, tj integer)
 RETURNS integer LANGUAGE sql STABLE SET search_path TO '' AS $function$
 select coalesce((select f.flags|(case when f.door_bits<>0 and not coalesce((select o.open from eldervale_private.realm_objects o where o.id=f.door),false) then f.door_bits else 0 end)
  from eldervale_private.tile_flags f where f.floor=0 and f.i=ti and f.j=tj),0)
$function$;
CREATE OR REPLACE FUNCTION eldervale_private.tile_route(si integer, sj integer, mode text, gi integer, gj integer, px double precision, pz double precision, reach double precision DEFAULT 0, radius integer DEFAULT 32, alt integer DEFAULT 10, bounded boolean DEFAULT false, strict boolean DEFAULT true)
 RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO '' AS $function$
declare w integer;n integer;ox integer;oz integer;fl integer[];prev integer[];queue integer[];head integer:=1;tail integer:=1;
 cur integer;ci integer;cj integer;wi integer;wj integer;ni integer;nj integer;idx integer;d integer;di integer;dj integer;f integer;
 found integer:=-1;best integer:=-1;bestd numeric;dd numeric;tpx numeric:=round((px/1.58)::numeric,6);tpz numeric:=round((pz/1.58)::numeric,6);r record;path jsonb:='[]'::jsonb;k integer;steps integer:=0;
 dis integer[]:=array[-1,1,0,0,-1,1,-1,1];djs integer[]:=array[0,0,-1,1,-1,-1,1,1];
begin
 radius:=greatest(2,least(64,coalesce(radius,32)));w:=2*radius+1;n:=w*w;ox:=si-radius;oz:=sj-radius;
 fl:=array_fill(0,array[n]);prev:=array_fill(-1,array[n]);queue:=array_fill(0,array[n]);
 for r in select f2.i,f2.j,f2.flags|(case when f2.door_bits<>0 and not coalesce(o.open,false) then f2.door_bits else 0 end) e
  from eldervale_private.tile_flags f2 left join eldervale_private.realm_objects o on o.id=f2.door
  where f2.floor=0 and f2.i between ox and ox+w-1 and f2.j between oz and oz+w-1 and (f2.flags<>0 or f2.door_bits<>0) loop
  fl[(r.j-oz)*w+(r.i-ox)+1]:=r.e;
 end loop;
 if bounded then
  for k in 0..n-1 loop
   if not eldervale_private.tutorial_inside((ox+k%w)*1.58,(oz+k/w)*1.58) then fl[k+1]:=fl[k+1]|1;end if;
  end loop;
 end if;
 cur:=radius*w+radius;prev[cur+1]:=cur;queue[1]:=cur;
 while head<=tail loop
  cur:=queue[head];head:=head+1;ci:=cur%w;cj:=cur/w;wi:=ci+ox;wj:=cj+oz;
  if (mode='tile' and wi=gi and wj=gj) or (mode='card' and abs(wi-gi)+abs(wj-gj)=1)
   or (mode='near' and power(wi*1.58-px,2)+power(wj*1.58-pz,2)<=reach*reach) then found:=cur;exit;end if;
  dd:=(wi-tpx)*(wi-tpx)+(wj-tpz)*(wj-tpz);
  if best<0 or dd<bestd then best:=cur;bestd:=dd;end if;
  for d in 1..8 loop
   di:=dis[d];dj:=djs[d];ni:=ci+di;nj:=cj+dj;
   if ni<0 or nj<0 or ni>=w or nj>=w then continue;end if;
   idx:=nj*w+ni;
   if prev[idx+1]>=0 or fl[idx+1]&1<>0 then continue;end if;
   if dj=0 then f:=fl[cj*w+least(ci,ni)+1]&2;
   elsif di=0 then f:=fl[least(cj,nj)*w+ci+1]&4;
   elsif fl[cj*w+ni+1]&1<>0 and fl[nj*w+ci+1]&1<>0 then f:=1;
   elsif strict and (fl[cj*w+ni+1]&1<>0 or fl[nj*w+ci+1]&1<>0 or fl[cj*w+least(ci,ni)+1]&2<>0 or fl[least(cj,nj)*w+ci+1]&4<>0) then f:=1;
   elsif di=dj then f:=fl[least(cj,nj)*w+least(ci,ni)+1]&8;
   else f:=fl[least(cj,nj)*w+greatest(ci,ni)+1]&16;end if;
   if f<>0 then continue;end if;
   prev[idx+1]:=cur;tail:=tail+1;queue[tail]:=idx;
  end loop;
 end loop;
 if found<0 then
  if best>=0 and (alt<0 or bestd<=alt*alt) then found:=best;end if;
  if found=radius*w+radius or found<0 then return jsonb_build_object('path','[]'::jsonb,'reached',false,'nodes',tail);end if;
 end if;
 k:=found;
 while k<>radius*w+radius and steps<n loop
  path:=jsonb_build_array(jsonb_build_array(eldervale_private.tile_center(k%w+ox),eldervale_private.tile_center(k/w+oz)))||path;
  k:=prev[k+1];steps:=steps+1;
 end loop;
 return jsonb_build_object('path',path,'reached',found<>best or (mode='tile' and found%w+ox=gi and found/w+oz=gj),'nodes',tail);
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.fish_attempt(method text, level integer)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO '' AS $function$
declare f jsonb;eligible boolean:=false;
begin
 for f in select value from jsonb_array_elements(eldervale_private.fish_table()) where value->>'method'=method and (value->>'level')::integer<=coalesce(level,1) order by (value->>'level')::integer desc loop
  eligible:=true;
  if random()<eldervale_private.skilling_chance((f->>'low')::numeric,(f->>'high')::numeric,level) then return f;end if;
 end loop;
 return case when eligible then '{}'::jsonb else null end;
end $function$;
create or replace function eldervale_private.fish_table() returns jsonb language sql immutable as $$ select '[{"item":"rawShrimp","method":"net","level":1,"xp":10,"low":48,"high":256}]'::jsonb $$;
CREATE OR REPLACE FUNCTION eldervale_private.gathering_error(uid uuid, target_id text, method text)
 RETURNS text LANGUAGE plpgsql SET search_path TO '' AS $function$
declare problem text;o eldervale_private.realm_objects;xp numeric;required integer;begin
 problem:=eldervale_private.gathering_error_before_professions(uid,target_id,method);if problem is not null then return problem;end if;
 if method='woodcut' then select * into o from eldervale_private.realm_objects where id=target_id;required:=(case o.data->>'logItem' when 'oakLogs' then 15 when 'willowLogs' then 30 when 'mapleLogs' then 45 when 'yewLogs' then 60 else 1 end);
  select coalesce((stats->>'woodXP')::numeric,0) into xp from public.player_saves where user_id=uid;if eldervale_private.xp_level(xp)<required then return 'You need Woodcutting level '||required||' for this tree.';end if;end if;
 if method in('cage','harpoon') then
  select coalesce((skills->>'fishingXP')::numeric,0),coalesce((stats->>(case method when 'cage' then 'lobsterPot' else 'harpoon' end))::integer,0) into xp,required from public.player_saves where user_id=uid;
  if required<1 then return (case method when 'cage' then 'You need a lobster pot in your inventory.' else 'You need a harpoon in your inventory.' end);end if;
  if eldervale_private.xp_level(xp)<(case method when 'cage' then 40 else 50 end) then return 'You need Fishing level '||(case method when 'cage' then '40 to catch lobsters.' else '50 to use a harpoon.' end);end if;
 end if;return null;
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.gathering_tick(t timestamp with time zone)
 RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO '' AS $function$
declare a eldervale_private.gathering_actions;o eldervale_private.realm_objects;problem text;remaining integer;n integer;capacity integer;respawn integer;delay float8;uid uuid;min_logs integer;max_logs integer;caught jsonb;
begin
 for a in select * from eldervale_private.gathering_actions where due_at<=t for update loop
  select user_id into uid from eldervale_private.realm_players where user_id=a.user_id and (input_until>t and (abs(input_x)+abs(input_z)>.001) or path<>'[]');
  problem:=case when uid is not null then 'Gathering stopped.' else eldervale_private.gathering_error(a.user_id,a.target,a.method) end;
  if problem is not null then delete from eldervale_private.gathering_actions where user_id=a.user_id;perform eldervale_private.emit(jsonb_build_object('type','gather_end','player',a.user_id,'text',problem));continue;end if;
  if a.due_at>t then continue;end if;
  select * into o from eldervale_private.realm_objects where id=a.target for update;
  capacity:=greatest(0,eldervale_private.inventory_capacity()-eldervale_private.inventory_used(a.user_id));
  if a.method='woodcut' then
   continue;
  else

   -- One catch per cycle; nets require no bait.
   caught:=eldervale_private.fish_attempt(a.method,eldervale_private.skill_level(a.user_id,'fishing'));
   if caught is null then delete from eldervale_private.gathering_actions where user_id=a.user_id;perform eldervale_private.emit(jsonb_build_object('type','gather_end','player',a.user_id,'text','Your Fishing level is too low for this method.'));continue;end if;
   if caught?'item' then if a.method='rod' then perform eldervale_private.item_change(a.user_id,'bait',-1);end if;perform eldervale_private.item_change(a.user_id,caught->>'item',1);perform eldervale_private.skill_xp(a.user_id,'fishing',(caught->>'xp')::numeric);
   perform eldervale_private.emit(jsonb_build_object('type','fishing','player',a.user_id,'target',o.id,'method',a.method,'amount',1,'item',caught->>'item','xp',(caught->>'xp')::numeric));end if;delay:=case when a.method='net' then 4.5 when a.method='cage' then 5 when a.method='harpoon' then 5.4 else 4 end;
  end if;
  problem:=eldervale_private.gathering_error(a.user_id,a.target,a.method);if problem is not null then delete from eldervale_private.gathering_actions where user_id=a.user_id;perform eldervale_private.emit(jsonb_build_object('type','gather_end','player',a.user_id,'text',problem));continue;end if;
  update eldervale_private.gathering_actions set started_at=t,due_at=t+make_interval(secs=>eldervale_private.engine_seconds(delay)) where user_id=a.user_id;
 end loop;
 update eldervale_private.realm_objects set available_at=null,data=data-'logsRemaining' where kind='tree' and available_at<=t;
end $function$;
