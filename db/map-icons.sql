-- Map markers (map-icons.js, map-markers.js, admin-map-markers.js).
--
-- The world map and minimap draw their icons (mines, tiered trees, fishing spots, stations,
-- banks and shops, caves and boss lairs, dragons, training areas, shortcuts, boats) from data the
-- client already has. The owner can hide or rename any of them and add custom markers; those
-- overrides are one small document:
--   game_settings key 'map_markers' = {hidden:[marker id], names:{marker id: name},
--     custom:[{id,cat,name,x,z,note?}]}       (marker id = kind:x:z, rounded world units)
-- Published: gameConfig.mapMarkers (public_game_config), so every client draws the same map.
-- Console: map_markers_get / map_markers_save through public.world_admin -> admin_action
--   (owner only, audited).
-- Needs db/admin-full-control.sql (game_settings, soft_patch, audit). Idempotent: functions are
-- created or replaced and each patch is skipped once present. Nothing is removed.
begin;

-- The marker kinds map-icons.js knows (MARKER_CATS).
create or replace function eldervale_private.map_marker_kinds() returns text[]
language sql immutable set search_path='' as $fn$
 select array['boss','dungeon','dragon','training','mining','woodcutting','fishing','cooking','furnace','smithing','crafting','farming','skill',
  'bank','general','apothecary','weapons','armour','inn','altar','agility','boat','teleport','exploration','quest','custom']
$fn$;

-- Checks and normalises an overrides document; raises a readable message for anything invalid.
create or replace function eldervale_private.map_markers_clean(v jsonb) returns jsonb
language plpgsql immutable set search_path='' as $fn$
declare h jsonb:='[]'::jsonb;n jsonb:='{}'::jsonb;c jsonb:='[]'::jsonb;e jsonb;k text;t text;x numeric;z numeric;id text;ids text[]:='{}';
begin
 if v is null or jsonb_typeof(v)<>'object' then raise exception 'Map markers must be an object';end if;
 for k in select jsonb_object_keys(v) loop
  if k not in ('hidden','names','custom') then raise exception 'Unknown map marker setting %',k;end if;
 end loop;
 if v ? 'hidden' then
  if jsonb_typeof(v->'hidden')<>'array' or jsonb_array_length(v->'hidden')>600 then raise exception 'Hidden markers: a list of at most 600 ids';end if;
  for e in select value from jsonb_array_elements(v->'hidden') loop
   if jsonb_typeof(e)<>'string' or (e#>>'{}')!~'^[a-z]{3,12}:-?[0-9]{1,4}:-?[0-9]{1,4}$' then raise exception 'Hidden marker ids look like mining:-255:-289';end if;
   if not h @> jsonb_build_array(e) then h:=h||jsonb_build_array(e);end if;
  end loop;
 end if;
 if v ? 'names' then
  if jsonb_typeof(v->'names')<>'object' then raise exception 'Marker names must be an object';end if;
  for k,e in select key,value from jsonb_each(v->'names') loop
   if k!~'^[a-z]{3,12}:-?[0-9]{1,4}:-?[0-9]{1,4}$' then raise exception 'Unknown marker id %',k;end if;
   t:=btrim(coalesce(e#>>'{}',''));
   if jsonb_typeof(e)<>'string' or length(t) not between 1 and 60 then raise exception 'Marker names: 1–60 characters';end if;
   n:=n||jsonb_build_object(k,t);
  end loop;
  if (select count(*) from jsonb_object_keys(n))>300 then raise exception 'At most 300 renamed markers';end if;
 end if;
 if v ? 'custom' then
  if jsonb_typeof(v->'custom')<>'array' or jsonb_array_length(v->'custom')>60 then raise exception 'Custom markers: at most 60';end if;
  for e in select value from jsonb_array_elements(v->'custom') loop
   if jsonb_typeof(e)<>'object' then raise exception 'Each custom marker is an object';end if;
   if not coalesce(e->>'cat','')=any(eldervale_private.map_marker_kinds()) then raise exception 'Unknown marker kind %',coalesce(e->>'cat','(none)');end if;
   t:=btrim(coalesce(e->>'name',''));
   if length(t) not between 1 and 60 then raise exception 'Custom marker names: 1–60 characters';end if;
   if jsonb_typeof(e->'x')<>'number' or jsonb_typeof(e->'z')<>'number' then raise exception 'Custom marker % needs x and z',t;end if;
   x:=round((e->>'x')::numeric,1);z:=round((e->>'z')::numeric,1);
   if abs(x)>430 or abs(z)>430 then raise exception 'Custom marker % must be in the overworld (x and z within ±430)',t;end if;
   if length(coalesce(e->>'note',''))>120 then raise exception 'Marker notes: at most 120 characters';end if;
   id:='custom:'||round(x)::text||':'||round(z)::text;
   if id=any(ids) then raise exception 'Two custom markers on the same spot: move one a little';end if;
   ids:=ids||id;
   c:=c||jsonb_build_array(jsonb_build_object('id',id,'cat',e->>'cat','name',t,'x',x,'z',z)||case when btrim(coalesce(e->>'note',''))<>'' then jsonb_build_object('note',btrim(e->>'note')) else '{}'::jsonb end);
  end loop;
 end if;
 return jsonb_build_object('hidden',h,'names',n,'custom',c);
end $fn$;

-- Owner console commands (routed from admin_action below).
create or replace function eldervale_private.admin_map_markers(command text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path='' as $fn$
declare old jsonb;v jsonb;
begin
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' then raise exception 'Invalid map markers payload';end if;
 if pg_column_size(payload)>65536 then raise exception 'Map markers payload too large';end if;
 select g.value into old from eldervale_private.game_settings g where g.key='map_markers';
 if command='map_markers_get' then
  return jsonb_build_object('value',coalesce(old,'{"hidden":[],"names":{},"custom":[]}'::jsonb),'kinds',to_jsonb(eldervale_private.map_marker_kinds()));
 elsif command='map_markers_save' then
  v:=eldervale_private.map_markers_clean(payload);
  insert into eldervale_private.game_settings(key,value,updated_at,updated_by) values('map_markers',v,now(),auth.uid())
   on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,'map_markers',old,v);
  return jsonb_build_object('key','map_markers','value',v);
 end if;
 raise exception 'Unknown map markers command %',command;
end $fn$;

revoke all on function eldervale_private.map_marker_kinds(),eldervale_private.map_markers_clean(jsonb),eldervale_private.admin_map_markers(text,jsonb) from public,anon,authenticated;

-- gameConfig.mapMarkers for every client (the lean snapshot resends it only when it changes).
select eldervale_private.soft_patch('eldervale_private.public_game_config()','mapMarkers',array[
 'select jsonb_build_object(',
 'select jsonb_build_object(''mapMarkers'',coalesce((select g.value from eldervale_private.game_settings g where g.key=''map_markers''),''{}''::jsonb))||jsonb_build_object(']);

-- map_markers_* console commands reach their handler ahead of the other console handlers.
select eldervale_private.soft_patch('eldervale_private.admin_action(text,jsonb)','admin_map_markers',array[
 'if command like ''fc\_%'' then return eldervale_private.admin_full_control(command,payload);end if;',
 'if command like ''map\_markers\_%'' then return eldervale_private.admin_map_markers(command,payload);end if;
 if command like ''fc\_%'' then return eldervale_private.admin_full_control(command,payload);end if;']);

commit;
