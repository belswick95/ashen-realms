CREATE OR REPLACE FUNCTION eldervale_private.admin_owner_base(command text, payload jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare s eldervale_private.settings; old_row jsonb; result jsonb; entity_id uuid; target_id uuid; body jsonb; n numeric; seconds integer; item text;
begin
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501'; end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>32768 then raise exception 'Invalid command payload'; end if;
 select * into s from eldervale_private.settings where id=true for update;
 update eldervale_private.settings set revision=revision+1 where id=true returning * into s;
 if command in ('spawn','update','delete','restore') then
  if command='spawn' then entity_id:=gen_random_uuid();body:=payload-'id';
  else entity_id:=(payload->>'id')::uuid;select to_jsonb(e),e.data into old_row,body from eldervale_private.entities e where id=entity_id for update;if body is null then raise exception 'Entity not found';end if;body:=body||(payload-'id');end if;
  if command in ('spawn','update') then
   if coalesce(body->>'template','')!~'^[a-z][A-Za-z0-9_:-]{1,60}$' or body->>'kind' not in ('npc','monster','object','item') or coalesce(body->>'kind','')='' then raise exception 'Invalid template or kind';end if;
   if body->>'kind'<>'item' and body->>'template' not in ('plaza','white_knight','demon','imp','ogre','revenant','castle_wall','castle_tower','castle_gate','altar','hearth','fishing_spot','fountain','road','terrain_grass','terrain_sand','terrain_stone','terrain_snow','villager','guard','banker','merchant','smith','ranger','mage','healer','knight','farmer','innkeeper','bandit','goblin','skeleton','wolf','deer','boar','bear','rat','spider','bat','troll','golem','wraith','dragon','crate','barrel','chest','bench','fence','lantern','market','well','campfire','tree','pine','rock','banner','cottage','bank','inn','forge','ruin') then raise exception 'Unknown template';end if;
   if body->>'kind'='item' and (not exists(select 1 from eldervale_private.realm_catalog where id='item:'||(body->>'item')) or coalesce((body->>'amount')::numeric,1)<1 or coalesce((body->>'amount')::numeric,1)>1000000) then raise exception 'Invalid item drop';end if;
   if length(coalesce(body->>'name',''))>80 or length(coalesce(body->>'dialogue',''))>2000 then raise exception 'Text too long';end if;
   foreach item in array array['x','z','yaw','scale','level','hp','damage','attackSpeed','roam','respawn'] loop
    n:=coalesce((body->>item)::numeric,case when item='scale' then 1 when item='hp' then 20 when item='attackSpeed' then 2.4 else 0 end);
    if n::text in ('NaN','Infinity','-Infinity') or (item in ('x','z') and abs(n)>4500) or (item='yaw' and abs(n)>360) or (item='scale' and (n<0.25 or n>5)) or (item='level' and (n<1 or n>999)) or (item='hp' and (n<1 or n>100000)) or (item='damage' and (n<0 or n>10000)) or (item='attackSpeed' and (n<1.3 or n>30)) or (item='roam' and (n<0 or n>50)) or (item='respawn' and (n<0 or n>86400)) then raise exception 'Invalid %',item;end if;
    body:=jsonb_set(body,array[item],to_jsonb(n));
   end loop;
   if body ? 'attackType' and body->>'attackType' not in ('slash','punch','stab','hammer','arrow','magic','bite','kick','charge','claw','venom','swoop','slam','fire') then raise exception 'Unknown attack';end if;
   if body->>'kind'='npc' and not coalesce((body->>'attackable')::boolean,false) then body:=jsonb_set(body,'{hostile}','false'::jsonb);end if;

   if body->>'template' like 'terrain_%' then
    if coalesce((body->>'radius')::numeric,10) not between 2 and 30 or coalesce((body->>'elevation')::numeric,0) not between -8 and 8 or abs(coalesce((body->>'elevation')::numeric,0))>coalesce((body->>'radius')::numeric,10)*.4 then raise exception 'Terrain radius 2–30m; elevation -8 to 8m with a gentle slope';end if;
    if exists(select 1 from eldervale_private.realm_objects where kind='door' and sqrt(power(x-(body->>'x')::float8,2)+power(z-(body->>'z')::float8,2))<coalesce((body->>'radius')::float8,10)+15) then raise exception 'Shape terrain at least 15m clear of existing buildings';end if;
    if exists(select 1 from eldervale_private.realm_water where not passable and point((body->>'x')::float8,(body->>'z')::float8)<@outline) then raise exception 'Terrain shaping is for dry land';end if;
   end if;
   if body->>'template' in ('castle_wall','castle_gate') and coalesce((body->>'length')::numeric,24) not between 6 and 50 then raise exception 'Wall/gate length must be 6–50m';end if;
   if body->>'template'='road' and (coalesce((body->>'length')::numeric,10) not between 2 and 50 or coalesce((body->>'width')::numeric,2.5) not between 1 and 8) then raise exception 'Road length 2–50m and width 1–8m';end if;
   if body->>'template'='fishing_spot' and not exists(select 1 from eldervale_private.realm_water w cross join (values(0,0),(6,0),(-6,0),(0,6),(0,-6)) v(dx,dz) where not w.passable and point((body->>'x')::float8+dx,(body->>'z')::float8+dz)<@w.outline) then raise exception 'Place fishing spots on a shoreline, within 6m of water';end if;
   if body?'shop' then
    if jsonb_typeof(body->'shop')<>'object' or (select count(*) from jsonb_object_keys(body->'shop'))>40 then raise exception 'Shop needs up to 40 items';end if;
    for item,result in select key,value from jsonb_each(body->'shop') loop
     if not exists(select 1 from eldervale_private.realm_catalog where id='item:'||item) or jsonb_typeof(result)<>'object' or not(result?'buy' and result?'sell' and result?'stock') or (result->>'buy')::integer not between 1 and 1000000 or (result->>'sell')::integer not between 0 and (result->>'buy')::integer or (result->>'stock')::integer not between -1 and 1000000 then raise exception 'Invalid shop entry: %',item;end if;
    end loop;
   end if;
   if command='spawn' and (select count(*) from eldervale_private.entities where not deleted)>=2000 then raise exception 'World limit: archive an entity first';end if;
   insert into eldervale_private.entities(id,revision,data) values(entity_id,s.revision,body) on conflict(id) do update set data=excluded.data,revision=excluded.revision;
  else update eldervale_private.entities set deleted=command='delete',revision=s.revision where id=entity_id;end if;
  select to_jsonb(e) into result from eldervale_private.entities e where id=entity_id;
 elsif command in ('announce','welcome','restart','cancel_restart','maintenance') then
  old_row:=to_jsonb(s);
  if command in ('announce','welcome') then if length(coalesce(payload->>'text',''))>1000 then raise exception 'Message too long';end if;
   if command='announce' then update eldervale_private.settings set announcement=coalesce(payload->>'text',''),announcement_until=now()+interval '10 minutes' where id=true;
   else update eldervale_private.settings set welcome=coalesce(payload->>'text','') where id=true;end if;
  elsif command='restart' then seconds:=(payload->>'seconds')::integer;if seconds is null or seconds<15 or seconds>3600 then raise exception 'Countdown must be 15–3600 seconds';end if;update eldervale_private.settings set restart_at=now()+seconds*interval '1 second' where id=true;
  elsif command='cancel_restart' then update eldervale_private.settings set restart_at=null where id=true;
  else update eldervale_private.settings set maintenance=coalesce((payload->>'enabled')::boolean,false) where id=true;end if;
  select to_jsonb(t) into result from eldervale_private.settings t where id=true;
 elsif command in ('mute','unmute','kick','ban','unban') then
  target_id:=(payload->>'userId')::uuid;if target_id=auth.uid() then raise exception 'Cannot moderate the owner';end if;
  if length(coalesce(payload->>'reason',''))<3 or length(payload->>'reason')>500 then raise exception 'Give a reason (3–500 characters)';end if;
  seconds:=coalesce((payload->>'seconds')::integer,3600);if seconds<60 or seconds>31536000 then raise exception 'Duration out of bounds';end if;
  select to_jsonb(m) into old_row from eldervale_private.moderation m where user_id=target_id;
  insert into eldervale_private.moderation(user_id) values(target_id) on conflict do nothing;
  update eldervale_private.moderation set reason=payload->>'reason',banned_until=case when command='ban' then now()+seconds*interval '1 second' when command='unban' then null else banned_until end,muted_until=case when command='mute' then now()+seconds*interval '1 second' when command='unmute' then null else muted_until end,kicked_at=case when command='kick' then now() else kicked_at end where user_id=target_id returning to_jsonb(moderation) into result;
 elsif command in ('give','teleport') then
  target_id:=coalesce((payload->>'userId')::uuid,auth.uid());
  if command='give' then
   item:=payload->>'item';n:=coalesce((payload->>'amount')::numeric,1);
   if item<>'gold' and not exists(select 1 from eldervale_private.realm_catalog where id='item:'||item) or item is null or n::text in ('NaN','Infinity','-Infinity') or n<1 or n>1000000 or n<>trunc(n) then raise exception 'Unknown item or quantity';end if;
  else if (payload->>'x')::numeric::text in ('NaN','Infinity','-Infinity') or (payload->>'z')::numeric::text in ('NaN','Infinity','-Infinity') or abs((payload->>'x')::numeric)>4500 or abs((payload->>'z')::numeric)>4500 or not(payload?'x' and payload?'z') then raise exception 'Invalid coordinates';end if;end if;
  insert into eldervale_private.deliveries(recipient,data) values(target_id,payload||jsonb_build_object('command',command)) returning to_jsonb(deliveries) into result;
 elsif command='start_location' then
  if not(payload?'x' and payload?'z') or abs((payload->>'x')::float8)>419 or abs((payload->>'z')::float8)>419 or not eldervale_private.can_step((payload->>'x')::float8,(payload->>'z')::float8,(payload->>'x')::float8,(payload->>'z')::float8) then raise exception 'Choose a reachable starting point inside the world';end if;
  update eldervale_private.settings set spawn_x=(payload->>'x')::float8,spawn_z=(payload->>'z')::float8 where id=true returning to_jsonb(settings) into result;
 elsif command='delete_chat' then
  delete from public.world_chat where id=(payload->>'id')::bigint returning to_jsonb(world_chat) into old_row;result:=jsonb_build_object('deleted',old_row is not null);
 elsif command='resolve_report' then update eldervale_private.reports set resolved=true where id=(payload->>'id')::bigint returning to_jsonb(reports) into result;
 else raise exception 'Unknown command';end if;
 insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,coalesce(entity_id::text,target_id::text,payload->>'id'),old_row,result);
 return result;
end $function$
;
