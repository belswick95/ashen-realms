-- Minimal local replica for db/perf-tick-fix.sql. patch_function, the collision chain (can_step
-- and its inner layers) and town_at are copied verbatim from the live database (read-only,
-- 2026-11-06). world_tick, guard_tick and realm_request are small stand-ins that contain the
-- live anchor lines verbatim, in the same variable context, so the patched code compiles and
-- runs here.
create schema auth;create schema eldervale_private;
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
create table eldervale_private.entities(id uuid primary key default gen_random_uuid(),revision bigint,data jsonb,deleted boolean default false);
create table eldervale_private.realm_objects(id text primary key,kind text,x float8,z float8,data jsonb default '{}',open boolean default false,available_at timestamptz);
create index realm_objects_position on eldervale_private.realm_objects(x,z);
create table eldervale_private.realm_water(id serial primary key,passable boolean default false,outline polygon);
create table eldervale_private.town_zones(id text primary key,x float8,z float8,radius float8,square boolean default false);
create table eldervale_private.realm_actors(id text primary key,data jsonb,x float8,z float8,hp integer,respawn_at timestamptz,target uuid,deleted boolean default false);
create table eldervale_private.realm_players(user_id uuid primary key,x float8,z float8,floor integer default 0,last_seen timestamptz);
create table eldervale_private.guard_duels(guard text primary key,monster text unique);
create table eldervale_private.test_log(n serial,kind text,id text);
create function eldervale_private.tutorial_inside(x float8,z float8) returns boolean language sql immutable as $$select false$$;
create function eldervale_private.tutorial_blocked(x float8,z float8) returns boolean language sql immutable as $$select false$$;
create function eldervale_private.story_contains(d jsonb,x float8,z float8,story integer) returns boolean language sql immutable as $$select true$$;
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

-- Live collision chain, verbatim.
CREATE OR REPLACE FUNCTION eldervale_private.can_step_before_castle(ax double precision, az double precision, bx double precision, bz double precision)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare h record; tx float8;tz float8;px float8;pz float8;q float8;dx float8;dz float8;
begin
 if abs(bx)>4500 or abs(bz)>4500 or bx::text in ('NaN','Infinity','-Infinity') or bz::text in ('NaN','Infinity','-Infinity') then return false;end if;
 -- Water collision outlines exclude bridge corridors when seeded.
 if exists(select 1 from eldervale_private.realm_water where not passable and point(bx,bz)<@outline) and not exists(select 1 from eldervale_private.realm_water where passable and point(bx,bz)<@outline) then return false;end if;
 for h in select * from eldervale_private.realm_objects where coalesce((data->>'floor')::integer,0)=0 and kind='door' and abs(x-bx)<25 and abs(z-bz)<25 loop
  q:=coalesce((h.data->>'yaw')::float8,0);dx:=coalesce((h.data->>'scaleX')::float8,1);dz:=coalesce((h.data->>'scaleZ')::float8,1);
  tx:=((bx-h.x)*cos(q)-(bz-h.z)*sin(q))/dx;tz:=((bx-h.x)*sin(q)+(bz-h.z)*cos(q))/dz;
  px:=((ax-h.x)*cos(q)-(az-h.z)*sin(q))/dx;pz:=((ax-h.x)*sin(q)+(az-h.z)*cos(q))/dz;
  if abs(tx)<2.17 and abs(tz)<2.09 and not(abs(tx)<1.65 and abs(tz)<1.57 and abs(px)<1.65 and abs(pz)<1.57) and not(h.open and abs(tx)<.49 and abs(px)<.49 and tz>1.2 and pz>1.2) then return false;end if;
 end loop;
 return true;
end $function$;

CREATE OR REPLACE FUNCTION eldervale_private.can_step_before_props(ax double precision, az double precision, bx double precision, bz double precision)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare e record;angle float8;tx float8;tz float8;s float8;begin
 if not eldervale_private.can_step_before_castle(ax,az,bx,bz) then return false;end if;
 for e in select id,data from eldervale_private.entities where not deleted and data->>'template' in ('castle_wall','castle_gate','castle_tower') and abs((data->>'x')::float8-bx)<80 and abs((data->>'z')::float8-bz)<80 loop
  angle:=coalesce((e.data->>'yaw')::float8,0)*pi()/180;s:=coalesce((e.data->>'scale')::float8,1);tx:=((bx-(e.data->>'x')::float8)*cos(angle)-(bz-(e.data->>'z')::float8)*sin(angle))/s;tz:=((bx-(e.data->>'x')::float8)*sin(angle)+(bz-(e.data->>'z')::float8)*cos(angle))/s;
  if e.data->>'template'='castle_tower' then if tx*tx+tz*tz<25 then return false;end if;
  elsif abs(tz)<(case when e.data->>'template'='castle_gate' then 2.1 else 1.6 end) and abs(tx)<coalesce((e.data->>'length')::float8,24)/2+.3 then
   if e.data->>'template'<>'castle_gate' or abs(tx)>4.1 or not exists(select 1 from eldervale_private.realm_objects where id=e.id::text and open) then return false;end if;
  end if;
 end loop;return true;end $function$;

CREATE OR REPLACE FUNCTION eldervale_private.can_step_before_professions(ax double precision, az double precision, bx double precision, bz double precision)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$declare o record;template text;hx float8;hz float8;a float8;s float8;tx float8;tz float8;begin
 if not eldervale_private.can_step_before_props(ax,az,bx,bz) then return false;end if;
 for o in select * from eldervale_private.realm_objects where coalesce((data->>'floor')::integer,0)=0 and abs(x-bx)<15 and abs(z-bz)<15 and (kind<>'tree' or available_at is null or available_at<=clock_timestamp()) and(kind in('tree','rock') or data->>'template' in('tree','pine','rock','crate','barrel','fountain','well','market','bench')) loop
  template:=coalesce(o.data->>'template',o.kind);s:=coalesce((o.data->>'scale')::float8,1);a:=coalesce((o.data->>'yaw')::float8,0);if o.data?'scaleX' then null;else a:=a*pi()/180;end if;
  hx:=case template when 'tree' then .7 when 'pine' then .7 when 'rock' then 1.1 when 'crate' then .7 when 'barrel' then .6 when 'fountain' then 1.9 when 'well' then 1.2 when 'market' then 1.35 when 'bench' then 1.15 else 0 end;
  hz:=case template when 'crate' then .6 when 'market' then .95 when 'bench' then .5 else hx end;
  tx:=((bx-o.x)*cos(a)-(bz-o.z)*sin(a))/s;tz:=((bx-o.x)*sin(a)+(bz-o.z)*cos(a))/s;
  if hx>0 and (case when template in('fountain','well','tree','pine','rock') then sqrt(tx*tx+tz*tz)<hx+.2 else abs(tx)<hx+.2 and abs(tz)<hz+.2 end) then return false;end if;
 end loop;return true;end $function$;

CREATE OR REPLACE FUNCTION eldervale_private.can_step_before_stories(ax double precision, az double precision, bx double precision, bz double precision)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare o record;s float8;a float8;dx float8;dz float8;hx float8;hz float8;begin
 if not eldervale_private.can_step_before_professions(ax,az,bx,bz) then return false;end if;
 for o in select * from eldervale_private.realm_objects where coalesce((data->>'floor')::integer,0)=0 and abs(x-bx)<10 and abs(z-bz)<10 and data->>'template' in('furnace','anvil','workbench','spinning_wheel','tanning_rack','mill','rune_altar','thieving_stall','practice_chest','essence_rock','construction_site') loop
  s:=coalesce((o.data->>'scale')::float8,1);a:=coalesce((o.data->>'yaw')::float8,0);if not(o.data?'scaleX') then a:=a*pi()/180;end if;
  hx:=case when o.data->>'template' in('furnace','workbench','thieving_stall') then 1.2 else .8 end;hz:=.8;
  dx:=((bx-o.x)*cos(a)-(bz-o.z)*sin(a))/s;dz:=((bx-o.x)*sin(a)+(bz-o.z)*cos(a))/s;
  if abs(dx)<hx+.2 and abs(dz)<hz+.2 then return false;end if;
 end loop;return true;
end $function$;

CREATE OR REPLACE FUNCTION eldervale_private.can_step_before_camp(ax double precision, az double precision, bx double precision, bz double precision)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
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
end $function$;

CREATE OR REPLACE FUNCTION eldervale_private.can_step(ax double precision, az double precision, bx double precision, bz double precision)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare o record;size jsonb;dx float8;dz float8;a float8;s float8;story integer:=coalesce(nullif(current_setting('eldervale.motion_floor',true),''),'0')::integer;
begin
 -- Trainees cannot step from the castle courtyard to anywhere outside it.
 if coalesce(current_setting('eldervale.motion_tutorial',true),'')='1' and eldervale_private.tutorial_inside(ax,az) and not eldervale_private.tutorial_inside(bx,bz) then return false;end if;
 if eldervale_private.tutorial_blocked(bx,bz) then return false;end if;
 if not eldervale_private.can_step_before_camp(ax,az,bx,bz) then return false;end if;
 for o in select * from eldervale_private.realm_objects where abs(x-bx)<18 and abs(z-bz)<18 and coalesce((data->>'floor')::integer,0)=story and data->>'template' in('tent','bedroll','log_seat','cooking_tripod','supply_wagon','trail_sign','woodpile','rope_coil','camp_lantern','wooden_table','stool','weapon_rack','campfire','farm_hut','chicken_coop','hay_bale','water_trough','stone_statue','wheelbarrow','scarecrow','flower_bed','fence') loop
  size:=('{"tent":[2,1.95],"bedroll":[0.48,1.05],"log_seat":[0.35,1.1],"cooking_tripod":[0.55,0.55],"supply_wagon":[1.25,2.8],"trail_sign":[0.2,0.2],"woodpile":[0.65,0.65],"rope_coil":[0.48,0.48],"camp_lantern":[0.18,0.18],"wooden_table":[1,0.5],"stool":[0.3,0.3],"weapon_rack":[1.05,0.25],"campfire":[0.65,0.65],"farm_hut":[2.2,1.8],"chicken_coop":[0.75,0.55],"hay_bale":[1.1,0.45],"water_trough":[0.95,0.4],"stone_statue":[0.55,0.55],"wheelbarrow":[0.4,0.7],"scarecrow":[0.15,0.15],"flower_bed":[1,0.45],"fence":[0.85,0.12]}'::jsonb)->(o.data->>'template');
  s:=coalesce((o.data->>'scale')::float8,1);a:=coalesce((o.data->>'yaw')::float8,0);if not(o.data?'scaleX') then a:=a*pi()/180;end if;
  dx:=((bx-o.x)*cos(a)-(bz-o.z)*sin(a))/(case when o.data->>'template'='fence' then coalesce((o.data->>'scaleX')::float8,s) else s end);dz:=((bx-o.x)*sin(a)+(bz-o.z)*cos(a))/(case when o.data->>'template'='fence' then coalesce((o.data->>'scaleZ')::float8,s) else s end);
  if abs(dx)<(size->>0)::float8+.2 and abs(dz)<(size->>1)::float8+.2 then return false;end if;
 end loop;return true;
end $function$;

CREATE OR REPLACE FUNCTION eldervale_private.town_at(px double precision, pz double precision)
 RETURNS text
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$select id from eldervale_private.town_zones where case when square then greatest(abs(px-x),abs(pz-z))<radius else power(px-x,2)+power(pz-z,2)<radius*radius end order by power(px-x,2)+power(pz-z,2) limit 1$function$;

-- Stand-ins: live anchor lines verbatim; bodies log which actors are processed.
CREATE OR REPLACE FUNCTION eldervale_private.guard_tick(dt double precision)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare m eldervale_private.realm_actors;t timestamptz:=clock_timestamp();begin
for m in select * from eldervale_private.realm_actors a where not deleted and hp>0 and coalesce((data->>'hostile')::boolean,false) and eldervale_private.town_at(x,z) is not null and not exists(select 1 from eldervale_private.guard_duels where monster=a.id) loop
  insert into eldervale_private.test_log(kind,id) values('guard_match',m.id);
 end loop;
end $function$;

CREATE OR REPLACE FUNCTION eldervale_private.world_tick()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare t timestamptz:=clock_timestamp();dt float8:=1;a eldervale_private.realm_actors;
begin
 if not pg_try_advisory_xact_lock(736211) then return;end if;
 perform eldervale_private.guard_tick(dt);
 for a in select * from eldervale_private.realm_actors where not deleted and not coalesce((data->>'frozen')::boolean,false) and id not in(select guard from eldervale_private.guard_duels union all select monster from eldervale_private.guard_duels) order by id loop
  insert into eldervale_private.test_log(kind,id) values('actor',a.id);
 end loop;
end $function$;

CREATE OR REPLACE FUNCTION eldervale_private.realm_request(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare r jsonb;
begin
 -- Establish the session through the existing authenticated command path before floor actions.
 r:=jsonb_build_object('locks',(select count(*) from pg_locks where locktype='advisory' and objid=736211 and pid=pg_backend_pid()));
 return r;
end $function$;
