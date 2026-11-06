-- Eldervale underground engine (caves, crypts, mines) and agility shortcuts, server half.
-- Client twin: underground-data.js / underground.js / agility-data.js.
-- APPLY ORDER: db/underground-1-engine.sql, db/underground-2-content.sql, db/underground-3-console.sql,
-- then db/water-1-fishing.sql, db/water-2-world.sql. Idempotent; safe on a running game.
--
-- Plane model: an underground area lives far from the overworld (origin x or z >= 1000; the
-- overworld ends near ±420) and each level of it LEVEL_GAP=400 units further south. Replies only
-- carry actors and players within 220 units, so distance is the layer: players only see actors
-- on their own level, and dying underground respawns at the normal overworld spot.
--
-- * eldervale_private.underground_areas: one dungeon definition per row (rooms, tunnels, entrances,
--   links, spawn groups, lights), editable from the Game console (World › Underground).
-- * eldervale_private.underground_levels: each level rasterised to a tile bitmap (1 = walkable),
--   tile (i,j) centred on (i*1.58, j*1.58) exactly like the tick & tile engine.
-- * Collision: can_step (free movement, actors) and tile_flags_at / tile_route (tile engine) treat
--   every non-walkable tile inside a level's bounds as blocked (BLOCK|OBJECT = 65).
-- * Commands (realm_request, ahead of every other branch): 'travel' {target} uses a passage object
--   (entrance, way out, ladder, stairs); 'agility' {target} crosses a shortcut (level check,
--   OSRS-style success roll, XP, fail damage).
-- * public.underground_world(): the area definitions for every signed-in client (one call on load).
begin;
set local lock_timeout='5s';

create table if not exists eldervale_private.underground_areas(
 id text primary key check(id ~ '^[a-z][a-z0-9_]{1,40}$'),
 data jsonb not null,
 enabled boolean not null default true,
 updated_at timestamptz not null default now(),
 updated_by uuid);
create table if not exists eldervale_private.underground_levels(
 area text not null, level integer not null,
 i0 integer not null, j0 integer not null, w integer not null, h integer not null,
 mask bit varying not null, walkable integer not null default 0, live boolean not null default true,
 built_at timestamptz not null default now(),
 primary key(area,level));
create index if not exists underground_levels_box on eldervale_private.underground_levels(i0,j0);
revoke all on table eldervale_private.underground_areas,eldervale_private.underground_levels from public,anon,authenticated;

-- Patch a live function once: skipped when `marker` is already in it, an error when an anchor moved.
create or replace function eldervale_private.underground_patch(target text, marker text, edits text[]) returns text
language plpgsql set search_path to '' as $fn$
declare fn regprocedure:=to_regprocedure(target);
begin
 if fn is null then raise exception 'underground: % not found',target;end if;
 if position(marker in pg_get_functiondef(fn))>0 then return target||': already patched';end if;
 perform eldervale_private.patch_function(fn,edits);
 return target||': patched';
end $fn$;

-- A local point (x,z) of a level is walkable inside a room ellipse or within width/2 of a tunnel
-- segment. Same arithmetic and order as underground-data.js walkableLocal.
create or replace function eldervale_private.underground_walkable(lv jsonb, x double precision, z double precision) returns boolean
language plpgsql immutable set search_path to '' as $fn$
declare r jsonb;t jsonb;k integer;ax float8;az float8;bx float8;bz float8;dx float8;dz float8;len float8;u float8;ex float8;ez float8;h float8;
begin
 for r in select value from jsonb_array_elements(coalesce(lv->'rooms','[]'::jsonb)) loop
  dx:=(x-(r->>'x')::float8)/(r->>'rx')::float8;dz:=(z-(r->>'z')::float8)/(r->>'rz')::float8;
  if dx*dx+dz*dz<=1 then return true;end if;
 end loop;
 for t in select value from jsonb_array_elements(coalesce(lv->'tunnels','[]'::jsonb)) loop
  h:=(t->>'width')::float8/2;
  for k in 1..jsonb_array_length(t->'points')-1 loop
   ax:=(t->'points'->(k-1)->>0)::float8;az:=(t->'points'->(k-1)->>1)::float8;bx:=(t->'points'->k->>0)::float8;bz:=(t->'points'->k->>1)::float8;
   dx:=bx-ax;dz:=bz-az;len:=dx*dx+dz*dz;
   u:=(case when len>0 then ((x-ax)*dx+(z-az)*dz)/len else 0 end);
   if u<0 then u:=0;elsif u>1 then u:=1;end if;
   ex:=x-ax-dx*u;ez:=z-az-dz*u;
   if ex*ex+ez*ez<=h*h then return true;end if;
  end loop;
 end loop;
 return false;
end $fn$;

-- Rasterise every level of an area into underground_levels (3 tiles of rock around the edges).
create or replace function eldervale_private.underground_build(area_id text) returns integer
language plpgsql set search_path to '' as $fn$
declare d jsonb;lv jsonb;ox float8;oz float8;x0 float8;z0 float8;x1 float8;z1 float8;i0 integer;j0 integer;i1 integer;j1 integer;bits varbit;cnt integer;n integer:=0;levels integer[]:='{}';
begin
 select data into d from eldervale_private.underground_areas where id=area_id;
 if d is null then raise exception 'Unknown underground area %',area_id;end if;
 for lv in select value from jsonb_array_elements(d->'levels') loop
  ox:=(d->'origin'->>'x')::float8;oz:=(d->'origin'->>'z')::float8+(lv->>'level')::integer*400;
  select min(v.a),min(v.b),max(v.c),max(v.e) into x0,z0,x1,z1 from (
   select (r->>'x')::float8-(r->>'rx')::float8 a,(r->>'z')::float8-(r->>'rz')::float8 b,(r->>'x')::float8+(r->>'rx')::float8 c,(r->>'z')::float8+(r->>'rz')::float8 e
    from jsonb_array_elements(lv->'rooms') r
   union all
   select (p->>0)::float8-(t->>'width')::float8/2,(p->>1)::float8-(t->>'width')::float8/2,(p->>0)::float8+(t->>'width')::float8/2,(p->>1)::float8+(t->>'width')::float8/2
    from jsonb_array_elements(coalesce(lv->'tunnels','[]'::jsonb)) t cross join jsonb_array_elements(t->'points') p) v;
  i0:=floor((ox+x0)/1.58::float8)::integer-3;j0:=floor((oz+z0)/1.58::float8)::integer-3;
  i1:=ceil((ox+x1)/1.58::float8)::integer+3;j1:=ceil((oz+z1)/1.58::float8)::integer+3;
  select string_agg((case when s.w then '1' else '0' end),'' order by s.j,s.i)::varbit,count(*) filter(where s.w) into bits,cnt
   from (select gi i,gj j,eldervale_private.underground_walkable(lv,gi::float8*1.58::float8-ox,gj::float8*1.58::float8-oz) w
    from generate_series(i0,i1) gi cross join generate_series(j0,j1) gj) s;
  insert into eldervale_private.underground_levels(area,level,i0,j0,w,h,mask,walkable,live,built_at)
   values(area_id,(lv->>'level')::integer,i0,j0,i1-i0+1,j1-j0+1,bits,cnt,true,now())
   on conflict(area,level) do update set i0=excluded.i0,j0=excluded.j0,w=excluded.w,h=excluded.h,mask=excluded.mask,walkable=excluded.walkable,live=true,built_at=excluded.built_at;
  levels:=levels||(lv->>'level')::integer;n:=n+cnt;
 end loop;
 update eldervale_private.underground_levels set live=false where area=area_id and not(level=any(levels));
 return n;
end $fn$;

-- Is tile (i,j) solid rock of an underground level? (Outside every level: no.)
create or replace function eldervale_private.underground_blocked(ti integer, tj integer) returns boolean
language sql stable set search_path to '' as $fn$
 select coalesce((select get_bit(l.mask,(tj-l.j0)*l.w+(ti-l.i0))=0 from eldervale_private.underground_levels l
  where l.live and ti>=l.i0 and ti<l.i0+l.w and tj>=l.j0 and tj<l.j0+l.h limit 1),false)
$fn$;
-- Blocked tiles of a (w x w) tile_route window starting at (ox,oz), as 0-based window indices.
create or replace function eldervale_private.underground_window(ox integer, oz integer, w integer) returns setof integer
language sql stable set search_path to '' as $fn$
 -- Parameters by position: underground_levels has its own column w.
 select (gj-$2)*$3+(gi-$1) from eldervale_private.underground_levels l
  cross join lateral generate_series(greatest(l.i0,$1),least(l.i0+l.w-1,$1+$3-1)) gi
  cross join lateral generate_series(greatest(l.j0,$2),least(l.j0+l.h-1,$2+$3-1)) gj
 where l.live and l.i0<=$1+$3-1 and l.i0+l.w-1>=$1 and l.j0<=$2+$3-1 and l.j0+l.h-1>=$2
  and get_bit(l.mask,(gj-l.j0)*l.w+(gi-l.i0))=0
$fn$;
-- The area and level under a world point (null on the overworld).
create or replace function eldervale_private.underground_at(x double precision, z double precision) returns jsonb
language sql stable set search_path to '' as $fn$
 select (select jsonb_build_object('area',l.area,'level',l.level,'name',a.data->>'name') from eldervale_private.underground_levels l join eldervale_private.underground_areas a on a.id=l.area
  where l.live and (x>1000 or z>1000) and eldervale_private.tile_of(x)>=l.i0 and eldervale_private.tile_of(x)<l.i0+l.w and eldervale_private.tile_of(z)>=l.j0 and eldervale_private.tile_of(z)<l.j0+l.h limit 1)
$fn$;

-- Passage objects of an area (underground-data.js passageObjects): entrances, way out, ladders/stairs.
create or replace function eldervale_private.underground_passages(d jsonb) returns jsonb
language plpgsql immutable set search_path to '' as $fn$
declare out jsonb:='[]'::jsonb;e jsonb;l jsonb;a float8;ox float8:=(d->'origin'->>'x')::float8;oz float8:=(d->'origin'->>'z')::float8;
 fx float8;fz float8;ix float8;iz float8;tx float8;tz float8;bx float8;bz float8;down boolean;k text;exit_kind text;lname text;
begin
 exit_kind:=(case d->>'theme' when 'crypt' then 'stairs_up' when 'fire' then 'ladder_up' else 'cave_exit' end);
 for e in select value from jsonb_array_elements(coalesce(d->'entrances','[]'::jsonb)) loop
  a:=coalesce((e->>'yaw')::float8,0)*pi()/180;
  fx:=round(((e->>'x')::float8+sin(a)*3.2)::numeric,1);fz:=round(((e->>'z')::float8+cos(a)*3.2)::numeric,1);
  ix:=ox+(e->'to'->>'x')::float8;iz:=oz+(e->'to'->>'level')::integer*400+(e->'to'->>'z')::float8;
  out:=out||jsonb_build_array(
   jsonb_build_object('key','entrance:'||(e->>'id'),'template',e->>'kind','name',e->>'name','x',(e->>'x')::float8,'z',(e->>'z')::float8,'yaw',coalesce((e->>'yaw')::float8,0),
    'passage',jsonb_build_object('area',d->>'id','dest',jsonb_build_array(ix,iz),'requires',e->'requires','depth',(e->'to'->>'level')::integer)),
   jsonb_build_object('key','exit:'||(e->>'id'),'template',exit_kind,'name','Way out to '||coalesce(e->>'name',d->>'name'),'x',ix-3.5,'z',iz,'yaw',90,
    'passage',jsonb_build_object('area',d->>'id','dest',jsonb_build_array(fx,fz),'depth',-1)));
 end loop;
 for l in select value from jsonb_array_elements(coalesce(d->'links','[]'::jsonb)) loop
  down:=(l->'to'->>'level')::integer>(l->>'level')::integer;k:=(case when l->>'kind'='stairs' then 'stairs' else 'ladder' end);
  tx:=ox+(l->>'x')::float8;tz:=oz+(l->>'level')::integer*400+(l->>'z')::float8;
  bx:=ox+(l->'to'->>'x')::float8;bz:=oz+(l->'to'->>'level')::integer*400+(l->'to'->>'z')::float8;
  select coalesce(l->>'name',v->>'name','Below') into lname from jsonb_array_elements(d->'levels') v where (v->>'level')::integer=(l->'to'->>'level')::integer;
  out:=out||jsonb_build_array(jsonb_build_object('key','link:'||(l->>'id')||':a','template',k||(case when down then '_down' else '_up' end),'name',coalesce(lname,'Below'),'x',tx,'z',tz,'yaw',0,
    'passage',jsonb_build_object('area',d->>'id','dest',jsonb_build_array(bx+1.6,bz),'depth',(l->'to'->>'level')::integer)));
  select coalesce(v->>'name','Above') into lname from jsonb_array_elements(d->'levels') v where (v->>'level')::integer=(l->>'level')::integer;
  out:=out||jsonb_build_array(jsonb_build_object('key','link:'||(l->>'id')||':b','template',k||(case when down then '_up' else '_down' end),'name',coalesce(lname,'Above'),'x',bx-.6,'z',bz,'yaw',0,
    'passage',jsonb_build_object('area',d->>'id','dest',jsonb_build_array(tx-1.6,tz),'depth',(l->>'level')::integer)));
 end loop;
 return out;
end $fn$;

-- Materialise an area: rasterise it, then write its passages and spawn groups as entities (fixed
-- ids from md5 of the key; the entity trigger fills realm_objects / realm_actors). A disabled area
-- keeps its walls but its entrances and monsters are marked deleted.
create or replace function eldervale_private.underground_sync(area_id text) returns jsonb
language plpgsql security definer set search_path to '' as $fn$
declare d jsonb;en boolean;rev bigint;p jsonb;s jsonb;rm jsonb;tpl jsonb;k integer;ang float8;rr float8;cnt integer;ox float8;oz float8;px float8;pz float8;
 ids uuid[]:='{}';eid uuid;n_obj integer:=0;n_mon integer:=0;missing text[]:='{}';tiles integer;
begin
 select data,enabled into d,en from eldervale_private.underground_areas where id=area_id;
 if d is null then raise exception 'Unknown underground area %',area_id;end if;
 tiles:=eldervale_private.underground_build(area_id);
 update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
 for p in select value from jsonb_array_elements(eldervale_private.underground_passages(d)) loop
  eid:=md5('underground:'||area_id||':'||(p->>'key'))::uuid;ids:=ids||eid;n_obj:=n_obj+1;
  insert into eldervale_private.entities(id,revision,data,deleted) values(eid,rev,jsonb_build_object('kind','object','template',p->>'template','name',p->>'name',
    'x',(p->>'x')::float8,'z',(p->>'z')::float8,'yaw',(p->>'yaw')::float8,'scale',1,'level',1,'hp',1,'damage',0,'attackSpeed',2.4,'roam',0,'respawn',0,'attackable',false,'hostile',false,
    'passage',p->'passage','underground',area_id,'blueprint','underground-v1','blueprintKey',area_id||':'||(p->>'key')),not en)
   on conflict(id) do update set revision=rev,data=excluded.data,deleted=excluded.deleted;
 end loop;
 ox:=(d->'origin'->>'x')::float8;oz:=(d->'origin'->>'z')::float8;
 for s in select value from jsonb_array_elements(coalesce(d->'spawns','[]'::jsonb)) loop
  select r into rm from jsonb_array_elements(d->'levels') v cross join jsonb_array_elements(v->'rooms') r where (v->>'level')::integer=(s->>'level')::integer and r->>'id'=s->>'room' limit 1;
  select e.data into tpl from eldervale_private.entities e where e.data->>'rosterKey'=s->>'roster' and e.data->>'blueprint'='monster-roster-v1' order by e.id limit 1;
  if rm is null or tpl is null then missing:=missing||(s->>'id');continue;end if;
  cnt:=greatest(1,least(12,(s->>'count')::integer));
  for k in 0..cnt-1 loop
   ang:=k*2*pi()/cnt+.7;rr:=(case when cnt>1 then .5 else 0 end);
   px:=round(((rm->>'x')::float8+cos(ang)*(rm->>'rx')::float8*rr)::numeric,1);pz:=round(((rm->>'z')::float8+sin(ang)*(rm->>'rz')::float8*rr)::numeric,1);
   eid:=md5('underground:'||area_id||':spawn:'||(s->>'id')||':'||k)::uuid;ids:=ids||eid;n_mon:=n_mon+1;
   insert into eldervale_private.entities(id,revision,data,deleted) values(eid,rev,
     (tpl-'group'-'groupName'-'blueprint'-'blueprintKey'-'patrol'-'route')||jsonb_build_object('x',ox+px,'z',oz+(s->>'level')::integer*400+pz,'yaw',round((random()*360-180)::numeric),
      'roam',coalesce((s->>'roam')::float8,3),'respawn',coalesce((s->>'respawn')::float8,(tpl->>'respawn')::float8,35),
      'group',md5('underground:'||area_id||':group:'||(s->>'id'))::uuid::text,'groupName',(d->>'name')||' · '||(s->>'id'),
      'underground',area_id,'spawnGroup',s->>'id','blueprint','underground-v1','blueprintKey',area_id||':spawn:'||(s->>'id')||':'||k),not en)
    on conflict(id) do update set revision=rev,data=excluded.data||jsonb_build_object('yaw',eldervale_private.entities.data->'yaw'),deleted=excluded.deleted;
  end loop;
 end loop;
 -- Rows this area generated before that it no longer generates.
 update eldervale_private.entities set deleted=true,revision=rev where data->>'blueprint'='underground-v1' and data->>'underground'=area_id and not deleted and not(id=any(ids));
 return jsonb_build_object('area',area_id,'enabled',en,'tiles',tiles,'passages',n_obj,'monsters',n_mon,'missingSpawns',to_jsonb(missing));
end $fn$;

-- 'travel' and 'agility': both use the clicked object's own data, both need the player beside it.
create or replace function eldervale_private.underground_command(session_id uuid, command text, payload jsonb, request_id uuid, event_cursor bigint) returns jsonb
language plpgsql security definer set search_path to '' as $fn$
declare p eldervale_private.realm_players;o eldervale_private.realm_objects;s public.player_saves;d jsonb;need integer;lvl integer;
 nx float8;nz float8;sx float8;sz float8;da float8;db float8;fail float8;ok boolean;dmg integer:=0;xp numeric:=0;ticks integer;
begin
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>2000 or request_id is null then raise exception 'Invalid request';end if;
 -- The normal sync path checks the session, maintenance and moderation first.
 perform eldervale_private.realm_request($1,'sync','{}'::jsonb,null,$5);
 perform pg_advisory_xact_lock(736211);
 select * into p from eldervale_private.realm_players where user_id=auth.uid() and realm_players.session_id=$1 for update;
 if not found then raise exception 'Session expired';end if;
 if not exists(select 1 from eldervale_private.realm_requests r where r.user_id=auth.uid() and r.request_id=$4) then
  if clock_timestamp()-p.last_command<interval '.06 seconds' then raise exception 'Please wait before another action';end if;
  select * into o from eldervale_private.realm_objects where id=payload->>'target';
  if o.id is null then raise exception 'That way is unavailable';end if;
  if p.floor<>0 or coalesce((o.data->>'floor')::integer,0)<>0 then raise exception 'That target is on another floor';end if;
  select * into s from public.player_saves where user_id=auth.uid() for update;
  if s.health<=0 then raise exception 'You cannot do that right now';end if;
  sx:=p.x;sz:=p.z;
  if command='travel' then
   d:=o.data->'passage';
   if d is null or jsonb_typeof(d->'dest')<>'array' then raise exception 'That way is unavailable';end if;
   if sqrt(power(o.x-p.x,2)+power(o.z-p.z,2))>4.5 then raise exception 'Move closer';end if;
   if not coalesce((select a.enabled from eldervale_private.underground_areas a where a.id=d->>'area'),false) then raise exception 'The way is blocked for now.';end if;
   need:=coalesce((d->'requires'->>'combat')::integer,0);
   if need>0 and eldervale_private.combat_level(s.skills)<need then raise exception 'You need combat level % to go in there.',need;end if;
   need:=coalesce((d->'requires'->>'agility')::integer,0);
   if need>0 and eldervale_private.skill_level(auth.uid(),'agility')<need then raise exception 'You need Agility level % to go in there.',need;end if;
   nx:=(d->'dest'->>0)::float8;nz:=(d->'dest'->>1)::float8;ticks:=2;
  elsif command='agility' then
   d:=o.data->'agility';
   if d is null or jsonb_typeof(d->'ends')<>'array' or jsonb_array_length(d->'ends')<>2 then raise exception 'That shortcut is unavailable';end if;
   da:=sqrt(power((d->'ends'->0->>0)::float8-p.x,2)+power((d->'ends'->0->>1)::float8-p.z,2));
   db:=sqrt(power((d->'ends'->1->>0)::float8-p.x,2)+power((d->'ends'->1->>1)::float8-p.z,2));
   if least(da,db)>3.5 then raise exception 'Move closer to the shortcut';end if;
   if exists(select 1 from eldervale_private.realm_actors where target=auth.uid() and hp>0 and not deleted) then raise exception 'You cannot do that while fighting';end if;
   need:=greatest(1,coalesce((d->>'level')::integer,1));lvl:=eldervale_private.skill_level(auth.uid(),'agility');
   if lvl<need then raise exception 'You need Agility level % to use this shortcut.',need;end if;
   if da<=db then nx:=(d->'ends'->1->>0)::float8;nz:=(d->'ends'->1->>1)::float8;sx:=(d->'ends'->0->>0)::float8;sz:=(d->'ends'->0->>1)::float8;
   else nx:=(d->'ends'->0->>0)::float8;nz:=(d->'ends'->0->>1)::float8;sx:=(d->'ends'->1->>0)::float8;sz:=(d->'ends'->1->>1)::float8;end if;
   fail:=greatest(0,coalesce((d->>'fail')::float8,0)*(1-(lvl-need)/greatest(1,coalesce((d->>'margin')::float8,20))));
   ok:=random()>=fail;ticks:=greatest(1,least(12,coalesce((d->>'ticks')::integer,4)));
   if ok then
    xp:=greatest(0,coalesce((d->>'xp')::numeric,0));if xp>0 then perform eldervale_private.skill_xp(auth.uid(),'agility',xp);end if;
   else
    dmg:=least(s.health-1,greatest(0,floor(coalesce((d->>'failDamage')::float8,0)*(.6+random()*.4))::integer));
    if dmg>0 then update public.player_saves set health=health-dmg where user_id=auth.uid();end if;
    nx:=sx;nz:=sz;
   end if;
  else raise exception 'Unknown world command';end if;
  update eldervale_private.realm_players set x=nx,z=nz,path='[]'::jsonb,intent=null,input_until=null,input_x=0,input_z=0,motion_at=clock_timestamp(),last_command=clock_timestamp() where user_id=auth.uid();
  update public.player_saves set world_position=coalesce(world_position,'{}'::jsonb)||jsonb_build_object('x',nx,'y',nz,'floor',0,'building',null) where user_id=auth.uid();
  update eldervale_private.tile_walkers set route='[]'::jsonb,goal=null,step_tiles=0 where user_id=auth.uid();
  if command='travel' then update eldervale_private.realm_actors set target=null,phase='ready' where target=auth.uid();end if;
  perform eldervale_private.emit(jsonb_build_object('type',(case when command='travel' then 'travel' else 'agility' end),'player',auth.uid(),'target',o.id,'kind',o.data->>'template',
   'area',d->>'area','ok',coalesce(ok,true),'from',jsonb_build_array(sx,sz),'to',jsonb_build_array(nx,nz),'ticks',ticks,'damage',dmg,'xp',xp));
  insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),$4,'{}'::jsonb);
 end if;
 return eldervale_private.realm_request($1,'sync','{}'::jsonb,null,$5)||jsonb_build_object('underground',(select eldervale_private.underground_at(x,z) from eldervale_private.realm_players where user_id=auth.uid()));
end $fn$;

-- Area definitions for the client (walls, lights, names); objects and monsters stream as entities.
create or replace function public.underground_world() returns jsonb
language sql stable security definer set search_path to '' as $fn$
 select jsonb_build_object('areas',coalesce((select jsonb_agg(a.data||jsonb_build_object('id',a.id,'enabled',a.enabled) order by a.id) from eldervale_private.underground_areas a),'[]'::jsonb))
$fn$;
revoke all on function public.underground_world() from public,anon;
grant execute on function public.underground_world() to authenticated;
revoke all on function eldervale_private.underground_patch(text,text,text[]),eldervale_private.underground_walkable(jsonb,float8,float8),eldervale_private.underground_build(text),
 eldervale_private.underground_blocked(integer,integer),eldervale_private.underground_window(integer,integer,integer),eldervale_private.underground_at(float8,float8),
 eldervale_private.underground_passages(jsonb),eldervale_private.underground_sync(text),eldervale_private.underground_command(uuid,text,jsonb,uuid,bigint) from public,anon,authenticated;

-- Hooks into live functions (anchors read from live on 2026-11-06; scripts/underground-db/live-anchors.mjs).
-- Free movement and every actor: solid rock between rooms.
select eldervale_private.underground_patch('eldervale_private.can_step(double precision,double precision,double precision,double precision)','underground_blocked',array[
 E'begin\n -- Trainees cannot step from the castle courtyard',
 E'begin\n if (bx>900 or bz>900) and eldervale_private.underground_blocked(eldervale_private.tile_of(bx),eldervale_private.tile_of(bz)) then return false;end if;\n -- Trainees cannot step from the castle courtyard']);
-- Tile engine: single-tile checks and the BFS window.
select eldervale_private.underground_patch('eldervale_private.tile_flags_at(integer,integer)','underground_blocked',array[
 'f.i=ti and f.j=tj),0)',
 'f.i=ti and f.j=tj),0)|(case when (ti>560 or tj>560) and eldervale_private.underground_blocked(ti,tj) then 65 else 0 end)']);
select eldervale_private.underground_patch('eldervale_private.tile_route(integer,integer,text,integer,integer,double precision,double precision,double precision,integer,integer,boolean,boolean)','underground_window',array[
 E' if bounded then\n  for k in 0..n-1 loop',
 E' if ox+w>560 or oz+w>560 then\n  for k in select u from eldervale_private.underground_window(ox,oz,w) u loop fl[k+1]:=fl[k+1]|65;end loop;\n end if;\n if bounded then\n  for k in 0..n-1 loop']);
-- Commands: ahead of the stairs/floor branch of the outermost realm_request.
select eldervale_private.underground_patch('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)','underground_command',array[
 ' perform pg_advisory_xact_lock(736211); -- Lock order:',
 E' if command in (''travel'',''agility'') then return eldervale_private.underground_command($1,$2,$3,$4,$5);end if;\n perform pg_advisory_xact_lock(736211); -- Lock order:']);
commit;
