-- Game console › World: Underground (dungeon list/editor, enable/disable, re-sync), Shortcuts
-- (agility editor), Fishing (spot type, tier, movement) and Waters (water body list).
-- APPLY AFTER db/underground-2-content.sql (the Fishing tab calls functions of
-- db/water-1-fishing.sql when used, so apply that file in the same release). Writes go through public.world_admin -> admin_action ('ug_*' commands),
-- owner-checked and audited. Idempotent.
begin;
set local lock_timeout='5s';

-- Server-side twin of underground-data.js validateDungeon (raises on the first problem).
create or replace function eldervale_private.underground_check(d jsonb) returns void
language plpgsql stable set search_path to '' as $fn$
declare lv jsonb;r jsonb;t jsonb;p jsonb;e jsonb;l jsonb;s jsonb;seen integer[]:='{}';n integer;
begin
 if d is null or jsonb_typeof(d)<>'object' or pg_column_size(d)>60000 then raise exception 'Underground: definition must be an object under 60 KB';end if;
 if coalesce(d->>'id','')!~'^[a-z][a-z0-9_]{1,40}$' then raise exception 'Underground: id uses lower-case letters, digits and _';end if;
 if length(coalesce(d->>'name',''))not between 1 and 60 then raise exception 'Underground: name 1–60 characters';end if;
 if coalesce(d->>'theme','') not in ('earth','crypt','fire') then raise exception 'Underground: theme earth, crypt or fire';end if;
 if jsonb_typeof(d->'origin'->'x')<>'number' or jsonb_typeof(d->'origin'->'z')<>'number' or (d->'origin'->>'x')::float8 not between 1100 and 4200 or (d->'origin'->>'z')::float8 not between 1100 and 3200 then raise exception 'Underground: origin x 1100–4200, z 1100–3200';end if;
 if exists(select 1 from eldervale_private.underground_areas a where a.id<>d->>'id' and abs((a.data->'origin'->>'x')::float8-(d->'origin'->>'x')::float8)<600 and abs((a.data->'origin'->>'z')::float8-(d->'origin'->>'z')::float8)<600) then raise exception 'Underground: origin closer than 600 to another area';end if;
 if jsonb_typeof(d->'levels')<>'array' or jsonb_array_length(d->'levels') not between 1 and 4 then raise exception 'Underground: 1–4 levels';end if;
 for lv in select value from jsonb_array_elements(d->'levels') loop
  n:=(lv->>'level')::integer;
  if n is null or n not between 0 and 3 or n=any(seen) then raise exception 'Underground: level numbers 0–3, each once';end if;seen:=seen||n;
  if jsonb_typeof(lv->'rooms')<>'array' or jsonb_array_length(lv->'rooms') not between 1 and 24 then raise exception 'Underground: level % needs 1–24 rooms',n;end if;
  for r in select value from jsonb_array_elements(lv->'rooms') loop
   if coalesce(r->>'id','')!~'^[a-z][a-z0-9_]{1,40}$' or jsonb_typeof(r->'x')<>'number' or jsonb_typeof(r->'z')<>'number' or jsonb_typeof(r->'rx')<>'number' or jsonb_typeof(r->'rz')<>'number'
    or abs((r->>'x')::float8)>150 or abs((r->>'z')::float8)>150 or (r->>'rx')::float8 not between 2 and 30 or (r->>'rz')::float8 not between 2 and 30 then raise exception 'Underground: level % room %: id, |x|,|z| ≤ 150, radii 2–30',n,coalesce(r->>'id','?');end if;
  end loop;
  if jsonb_array_length(coalesce(lv->'tunnels','[]'::jsonb))>40 then raise exception 'Underground: level % has more than 40 tunnels',n;end if;
  for t in select value from jsonb_array_elements(coalesce(lv->'tunnels','[]'::jsonb)) loop
   if jsonb_typeof(t->'width')<>'number' or (t->>'width')::float8 not between 1.6 and 8 or jsonb_typeof(t->'points')<>'array' or jsonb_array_length(t->'points') not between 2 and 12 then raise exception 'Underground: level % tunnel width 1.6–8 and 2–12 points',n;end if;
   for p in select value from jsonb_array_elements(t->'points') loop
    if jsonb_typeof(p)<>'array' or jsonb_typeof(p->0)<>'number' or jsonb_typeof(p->1)<>'number' or abs((p->>0)::float8)>150 or abs((p->>1)::float8)>150 then raise exception 'Underground: level % tunnel points within ±150',n;end if;
   end loop;
  end loop;
 end loop;
 if jsonb_array_length(coalesce(d->'entrances','[]'::jsonb))<1 then raise exception 'Underground: at least one entrance';end if;
 for e in select value from jsonb_array_elements(d->'entrances') loop
  if coalesce(e->>'id','')!~'^[a-z][a-z0-9_]{1,40}$' or coalesce(e->>'kind','') not in ('cave_mouth','crypt_door','mine_shaft','trapdoor') or jsonb_typeof(e->'x')<>'number' or jsonb_typeof(e->'z')<>'number' or abs((e->>'x')::float8)>420 or abs((e->>'z')::float8)>420 then raise exception 'Underground: entrance %: id, kind cave_mouth|crypt_door|mine_shaft|trapdoor, overworld x/z within ±420',coalesce(e->>'id','?');end if;
  select value into lv from jsonb_array_elements(d->'levels') where (value->>'level')::integer=(e->'to'->>'level')::integer;
  if lv is null or not eldervale_private.underground_walkable(lv,(e->'to'->>'x')::float8,(e->'to'->>'z')::float8) then raise exception 'Underground: entrance % must arrive inside a room or tunnel',e->>'id';end if;
 end loop;
 for l in select value from jsonb_array_elements(coalesce(d->'links','[]'::jsonb)) loop
  if coalesce(l->>'id','')!~'^[a-z][a-z0-9_]{1,40}$' or coalesce(l->>'kind','') not in ('ladder','stairs') or (l->>'level')::integer=(l->'to'->>'level')::integer then raise exception 'Underground: link %: id, kind ladder|stairs, two different levels',coalesce(l->>'id','?');end if;
  if not exists(select 1 from jsonb_array_elements(d->'levels') v where (v->>'level')::integer=(l->>'level')::integer and eldervale_private.underground_walkable(v,(l->>'x')::float8,(l->>'z')::float8))
   or not exists(select 1 from jsonb_array_elements(d->'levels') v where (v->>'level')::integer=(l->'to'->>'level')::integer and eldervale_private.underground_walkable(v,(l->'to'->>'x')::float8,(l->'to'->>'z')::float8)) then raise exception 'Underground: link % needs both ends inside',l->>'id';end if;
 end loop;
 for s in select value from jsonb_array_elements(coalesce(d->'spawns','[]'::jsonb)) loop
  if coalesce(s->>'id','')!~'^[a-z][a-z0-9_]{1,40}$' or coalesce((s->>'count')::integer,0) not between 1 and 12 then raise exception 'Underground: spawn %: id and 1–12 monsters',coalesce(s->>'id','?');end if;
  if not exists(select 1 from jsonb_array_elements(d->'levels') v cross join jsonb_array_elements(v->'rooms') q where (v->>'level')::integer=(s->>'level')::integer and q->>'id'=s->>'room') then raise exception 'Underground: spawn % uses an unknown room',s->>'id';end if;
  if not exists(select 1 from eldervale_private.entities x where x.data->>'rosterKey'=s->>'roster' and x.data->>'blueprint'='monster-roster-v1') then raise exception 'Underground: spawn % uses unknown roster monster %',s->>'id',s->>'roster';end if;
 end loop;
 if jsonb_array_length(coalesce(d->'lights','[]'::jsonb))>64 then raise exception 'Underground: at most 64 lights';end if;
 if exists(select 1 from jsonb_array_elements(coalesce(d->'lights','[]'::jsonb)) g where coalesce(g->>'kind','') not in ('torch','brazier','fungus','crystal','lava') or not((d->'levels') @> jsonb_build_array(jsonb_build_object('level',(g->>'level')::integer)))) then raise exception 'Underground: lights need a kind torch|brazier|fungus|crystal|lava and an existing level';end if;
end $fn$;

-- A shortcut entity from console fields (agility-data.js shortcutEntity).
create or replace function eldervale_private.underground_shortcut_data(f jsonb) returns jsonb
language plpgsql immutable set search_path to '' as $fn$
declare ax float8;az float8;bx float8;bz float8;
begin
 if coalesce(f->>'template','') not in ('log_balance','rope_swing','wall_climb','stepping_stones','squeeze') then raise exception 'Shortcut: choose log_balance, rope_swing, wall_climb, stepping_stones or squeeze';end if;
 if length(coalesce(f->>'name',''))not between 1 and 60 or coalesce((f->>'level')::integer,0) not between 1 and 99 or coalesce((f->>'xp')::numeric,-1) not between 0 and 5000
  or coalesce((f->>'fail')::numeric,0) not between 0 and 1 or coalesce((f->>'failDamage')::integer,0) not between 0 and 990 or coalesce((f->>'ticks')::integer,4) not between 1 and 12 then raise exception 'Shortcut: name, level 1–99, XP 0–5000, fail 0–1, fail damage 0–990, 1–12 ticks';end if;
 if jsonb_typeof(f->'ends')<>'array' or jsonb_array_length(f->'ends')<>2 then raise exception 'Shortcut: two ends [[x,z],[x,z]]';end if;
 ax:=(f->'ends'->0->>0)::float8;az:=(f->'ends'->0->>1)::float8;bx:=(f->'ends'->1->>0)::float8;bz:=(f->'ends'->1->>1)::float8;
 if greatest(abs(ax),abs(az),abs(bx),abs(bz))>4500 or sqrt(power(bx-ax,2)+power(bz-az,2)) not between 1 and 40 then raise exception 'Shortcut: ends 1–40 apart, inside the world';end if;
 return jsonb_build_object('kind','object','template',f->>'template','name',f->>'name','x',round(((ax+bx)/2)::numeric,1),'z',round(((az+bz)/2)::numeric,1),
  'yaw',round(degrees(atan2(bx-ax,bz-az))::numeric),'length',round(sqrt(power(bx-ax,2)+power(bz-az,2))::numeric,1),'scale',1,'level',1,'hp',1,'damage',0,'attackSpeed',2.4,'roam',0,'respawn',0,'attackable',false,'hostile',false,
  'agility',jsonb_build_object('level',(f->>'level')::integer,'xp',(f->>'xp')::numeric,'fail',coalesce((f->>'fail')::numeric,0),'failDamage',coalesce((f->>'failDamage')::integer,0),'ticks',coalesce((f->>'ticks')::integer,4),'margin',coalesce((f->>'margin')::integer,20),'ends',f->'ends'),
  'blueprint','agility-v1','ownerEdited',true);
end $fn$;

-- Everything the World tabs list (areas with level stats, shortcuts, fishing spots, water bodies, roster keys).
create or replace function eldervale_private.underground_console_list() returns jsonb
language sql stable security definer set search_path to '' as $fn$
 select jsonb_build_object(
   'areas',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'data',a.data,'enabled',a.enabled,'updatedAt',a.updated_at,'edited',a.updated_by is not null,
     'levels',(select coalesce(jsonb_agg(jsonb_build_object('level',l.level,'walkable',l.walkable,'w',l.w,'h',l.h,'live',l.live) order by l.level),'[]'::jsonb) from eldervale_private.underground_levels l where l.area=a.id),
     'passages',(select count(*) from eldervale_private.entities e where e.data->>'underground'=a.id and e.data ? 'passage' and not e.deleted),
     'monsters',(select count(*) from eldervale_private.entities e where e.data->>'underground'=a.id and e.data->>'kind'='monster' and not e.deleted),
     'players',(select count(*) from eldervale_private.realm_players p where p.last_seen>now()-interval '15 seconds' and eldervale_private.underground_at(p.x,p.z)->>'area'=a.id)) order by a.id) from eldervale_private.underground_areas a),'[]'::jsonb),
   'shortcuts',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'deleted',e.deleted,'data',e.data) order by e.data->>'name') from eldervale_private.entities e where e.data ? 'agility'),'[]'::jsonb),
   'spots',coalesce((select jsonb_agg(jsonb_build_object('id',e.id,'deleted',e.deleted,'data',e.data-'shop') order by e.data->>'name') from eldervale_private.entities e where e.data->>'template'='fishing_spot'),'[]'::jsonb),
   'waters',coalesce((select jsonb_agg(jsonb_build_object('id',w.id,'passable',w.passable,'points',npoints(w.outline),'box',jsonb_build_array(round(((box(w.outline))[1])[0]::numeric,1),round(((box(w.outline))[1])[1]::numeric,1),round(((box(w.outline))[0])[0]::numeric,1),round(((box(w.outline))[0])[1]::numeric,1))) order by w.id) from eldervale_private.realm_water w),'[]'::jsonb),
   'roster',coalesce((select jsonb_agg(distinct x.data->>'rosterKey') from eldervale_private.entities x where x.data->>'blueprint'='monster-roster-v1'),'[]'::jsonb))
$fn$;

create or replace function eldervale_private.admin_underground(command text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $fn$
declare r jsonb;d jsonb;before jsonb;rev bigint;eid uuid;id_text text;n integer:=0;
begin
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>65536 then raise exception 'Invalid console payload';end if;
 if command='ug_list' then return eldervale_private.underground_console_list();end if;
 perform pg_advisory_xact_lock(736211);
 if command='ug_save' then
  d:=payload->'data';perform eldervale_private.underground_check(d);
  select data into before from eldervale_private.underground_areas where id=d->>'id';
  insert into eldervale_private.underground_areas(id,data,enabled,updated_at,updated_by) values(d->>'id',d-'enabled',coalesce((payload->>'enabled')::boolean,true),now(),auth.uid())
   on conflict(id) do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
  r:=eldervale_private.underground_sync(d->>'id');
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,d->>'id',before,d);
  return r;
 elsif command='ug_enable' then
  update eldervale_private.underground_areas set enabled=coalesce((payload->>'enabled')::boolean,false),updated_at=now() where id=payload->>'id';
  if not found then raise exception 'Unknown underground area';end if;
  r:=eldervale_private.underground_sync(payload->>'id');
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,payload->>'id',null,payload);
  return r;
 elsif command='ug_sync' then
  for id_text in select id from eldervale_private.underground_areas where payload->>'id' is null or id=payload->>'id' order by id loop perform eldervale_private.underground_sync(id_text);n:=n+1;end loop;
  return jsonb_build_object('synced',n);
 elsif command='ug_shortcut_save' then
  d:=eldervale_private.underground_shortcut_data(payload->'data');
  eid:=coalesce((payload->>'id')::uuid,gen_random_uuid());
  select data into before from eldervale_private.entities where id=eid;
  if before is not null and not(before ? 'agility') then raise exception 'That entity is not a shortcut';end if;
  update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
  insert into eldervale_private.entities(id,revision,data) values(eid,rev,d||jsonb_build_object('blueprintKey',coalesce(before->>'blueprintKey',eid::text))||(case when before ? 'underground' then jsonb_build_object('underground',before->'underground') else '{}'::jsonb end))
   on conflict(id) do update set revision=rev,data=excluded.data;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,eid::text,before,d);
  return jsonb_build_object('id',eid,'data',d);
 elsif command in ('ug_shortcut_enable','ug_spot_enable') then
  update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
  update eldervale_private.entities set deleted=not coalesce((payload->>'enabled')::boolean,false),revision=rev
   where id=(payload->>'id')::uuid and (case when command='ug_shortcut_enable' then data ? 'agility' else data->>'template'='fishing_spot' end);
  if not found then raise exception 'Not found';end if;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,payload->>'id',null,payload);
  return jsonb_build_object('id',payload->>'id','enabled',coalesce((payload->>'enabled')::boolean,false));
 elsif command='ug_spot_save' then
  d:=coalesce(payload->'data','{}'::jsonb);
  if d ? 'spotType' and jsonb_typeof(d->'spotType')<>'null' and d->>'spotType' not in ('shore','river','cage','bignet','deep') then raise exception 'Spot type: shore, river, cage, bignet, deep or none';end if;
  if d ? 'catches' and jsonb_typeof(d->'catches')<>'null' and (jsonb_typeof(d->'catches')<>'array' or exists(select 1 from jsonb_array_elements_text(d->'catches') c where not(eldervale_private.fish_table() @> jsonb_build_array(jsonb_build_object('item',c))))) then raise exception 'Catches: fish from the fishing table';end if;
  if d ? 'moves' and jsonb_typeof(d->'moves')<>'null' and (jsonb_typeof(d->'moves'->'points')<>'array' or jsonb_array_length(d->'moves'->'points') not between 1 and 8
   or exists(select 1 from jsonb_array_elements(d->'moves'->'points') q where jsonb_typeof(q)<>'array' or abs((q->>0)::float8)>4500 or abs((q->>1)::float8)>4500)
   or coalesce((d->'moves'->>'minTicks')::integer,250) not between 10 and 6000 or coalesce((d->'moves'->>'maxTicks')::integer,530)<coalesce((d->'moves'->>'minTicks')::integer,250)) then raise exception 'Moves: 1–8 points, 10–6000 ticks';end if;
  if d ? 'name' and length(coalesce(d->>'name',''))not between 1 and 60 then raise exception 'Name: 1–60 characters';end if;
  update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
  if payload->>'id' is null then
   if jsonb_typeof(d->'x')<>'number' or jsonb_typeof(d->'z')<>'number' then raise exception 'New spot: x and z';end if;
   eid:=gen_random_uuid();
   insert into eldervale_private.entities(id,revision,data) values(eid,rev,jsonb_build_object('kind','object','template','fishing_spot','name',coalesce(d->>'name','Fishing spot'),'x',(d->>'x')::float8,'z',(d->>'z')::float8,'yaw',0,'scale',1,'level',1,'hp',1,'damage',0,'attackSpeed',2.4,'roam',0,'respawn',0,'attackable',false,'hostile',false,'waterHeight',coalesce((d->>'waterHeight')::float8,.06),'blueprint','water-v1','blueprintKey',eid::text,'ownerEdited',true)||jsonb_strip_nulls(jsonb_build_object('spotType',d->'spotType','catches',d->'catches','moves',d->'moves')));
  else
   eid:=(payload->>'id')::uuid;select data into before from eldervale_private.entities where id=eid and data->>'template'='fishing_spot';
   if before is null then raise exception 'Not a fishing spot';end if;
   update eldervale_private.entities set revision=rev,data=(data-'spotType'-'catches'-'moves'-'moveAt'-'moveIndex')||jsonb_strip_nulls(jsonb_build_object('spotType',coalesce(d->'spotType',(case when d ? 'spotType' then null else before->'spotType' end)),
     'catches',(case when d ? 'catches' then d->'catches' else before->'catches' end),'moves',(case when d ? 'moves' then d->'moves' else before->'moves' end),'name',d->'name','x',d->'x','z',d->'z'))||'{"ownerEdited":true}'::jsonb where id=eid;
  end if;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,eid::text,before,d);
  return jsonb_build_object('id',eid);
 elsif command='ug_spot_move' then
  update eldervale_private.entities set data=data||jsonb_build_object('moveAt',now()-interval '1 second') where id=(payload->>'id')::uuid and data->>'template'='fishing_spot' and data ? 'moves';
  if not found then raise exception 'That spot has no positions to move between';end if;
  return jsonb_build_object('id',payload->>'id','moved',eldervale_private.fishing_spot_drift(now()));
 elsif command='ug_water_set' then
  update eldervale_private.realm_water set passable=coalesce((payload->>'passable')::boolean,false) where id=(payload->>'id')::integer;
  if not found then raise exception 'Unknown water body';end if;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,payload->>'id',null,payload);
  return jsonb_build_object('id',payload->>'id','passable',coalesce((payload->>'passable')::boolean,false));
 end if;
 raise exception 'Unknown underground console command';
end $fn$;
revoke all on function eldervale_private.underground_console_list(),eldervale_private.underground_check(jsonb),eldervale_private.underground_shortcut_data(jsonb),eldervale_private.admin_underground(text,jsonb) from public,anon,authenticated;

-- ug_* console commands reach their handler first (soft patch, like the sign_* handler).
select eldervale_private.soft_patch('eldervale_private.admin_action(text,jsonb)','admin_underground',array[
 $a$ if command like 'sign\_%' then return eldervale_private.admin_building_signs(command,payload);end if;$a$,
 $a$ if command like 'ug\_%' then return eldervale_private.admin_underground(command,payload);end if;
 if command like 'sign\_%' then return eldervale_private.admin_building_signs(command,payload);end if;$a$]);
commit;
