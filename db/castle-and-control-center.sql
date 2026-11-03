-- Persistent castle, audited owner tools and restricted moderator permissions.

create or replace function eldervale_private.admin_owner_base(command text, payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
   if body->>'kind'<>'item' and body->>'template' not in ('white_knight','demon','imp','ogre','revenant','castle_wall','castle_tower','castle_gate','altar','hearth','fishing_spot','fountain','road','terrain_grass','terrain_sand','terrain_stone','terrain_snow','villager','guard','banker','merchant','smith','ranger','mage','healer','knight','farmer','innkeeper','bandit','goblin','skeleton','wolf','deer','boar','bear','rat','spider','bat','troll','golem','wraith','dragon','crate','barrel','chest','bench','fence','lantern','market','well','campfire','tree','pine','rock','banner','cottage','bank','inn','forge','ruin') then raise exception 'Unknown template';end if;
   if body->>'kind'='item' and (coalesce(body->>'item','') not in ('fishingPole','bait','rawFish','wood','ore','weapon:dagger','weapon:shortsword','weapon:longsword','weapon:scimitar','weapon:twohand','weapon:axe','weapon:pickaxe','weapon:battleaxe','armor:helm','armor:chest','armor:legs','armor:boots','armor:cape','shield:square','shield:kite','jewelry:woodlandAmulet','jewelry:prospectorsRing') or coalesce((body->>'amount')::numeric,1)<1 or coalesce((body->>'amount')::numeric,1)>1000000) then raise exception 'Invalid item drop';end if;
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
   if item not in ('fishingPole','bait','rawFish','gold','wood','ore','weapon:dagger','weapon:shortsword','weapon:longsword','weapon:scimitar','weapon:twohand','weapon:axe','weapon:pickaxe','weapon:battleaxe','armor:helm','armor:chest','armor:legs','armor:boots','armor:cape','shield:square','shield:kite','jewelry:woodlandAmulet','jewelry:prospectorsRing') or item is null or n::text in ('NaN','Infinity','-Infinity') or n<1 or n>1000000 or n<>trunc(n) then raise exception 'Unknown item or quantity';end if;
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
end $$;

create table eldervale_private.staff(user_id uuid primary key references auth.users(id),role text not null check(role='moderator'),granted_by uuid not null references auth.users(id),granted_at timestamptz not null default now());
alter table eldervale_private.staff enable row level security;
revoke all on eldervale_private.staff from public,anon,authenticated;
create function eldervale_private.staff_role() returns text language sql stable security definer set search_path='' as $$select case when eldervale_private.is_owner() then 'owner' when eldervale_private.allowed() then (select role from eldervale_private.staff where user_id=auth.uid()) end$$;
create or replace function eldervale_private.admin_action(command text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare role_name text:=eldervale_private.staff_role();target_id uuid;actor_id text;before_row jsonb;result jsonb;n integer;revision_id bigint;k text;v numeric;body jsonb;
begin
 if role_name is null then raise exception 'Staff access required' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>32768 then raise exception 'Invalid command payload';end if;
 perform pg_advisory_xact_lock(736211);
 if role_name='moderator' then
  if command not in ('kick','mute','unmute','resolve_report','delete_chat') then raise exception 'This command requires owner access' using errcode='42501';end if;
  target_id:=(payload->>'userId')::uuid;
  if command in ('kick','mute','unmute') then
   if target_id is null or target_id=auth.uid() or target_id='91c5b7f0-7018-4290-a190-c2bba0ca492d'::uuid or exists(select 1 from eldervale_private.staff where user_id=target_id) then raise exception 'Moderators cannot target staff' using errcode='42501';end if;
   n:=coalesce((payload->>'seconds')::integer,3600);if n<1 or n>86400 then raise exception 'Moderator duration must be 1–86400 seconds';end if;
   if length(trim(coalesce(payload->>'reason','')))<3 or length(payload->>'reason')>500 then raise exception 'Provide a moderation reason (3–500 characters)';end if;
   select to_jsonb(m) into before_row from eldervale_private.moderation m where user_id=target_id;
   insert into eldervale_private.moderation(user_id,reason) values(target_id,payload->>'reason') on conflict(user_id) do update set reason=excluded.reason;
   update eldervale_private.moderation set kicked_at=case when command='kick' then clock_timestamp() else kicked_at end,muted_until=case when command='mute' then now()+n*interval '1 second' when command='unmute' then null else muted_until end where user_id=target_id returning to_jsonb(moderation) into result;
  elsif command='delete_chat' then delete from public.world_chat where id=(payload->>'id')::bigint returning to_jsonb(world_chat) into before_row;result:=jsonb_build_object('deleted',before_row is not null);
  else update eldervale_private.reports set resolved=true where id=(payload->>'id')::bigint returning to_jsonb(reports) into result;end if;
 elsif command='role' then
  target_id:=(payload->>'userId')::uuid;
  if target_id is null or target_id='91c5b7f0-7018-4290-a190-c2bba0ca492d'::uuid or not exists(select 1 from public.player_saves where user_id=target_id) then raise exception 'Choose another existing player';end if;
  if coalesce(payload->>'role','') not in ('moderator','player') then raise exception 'Role must be moderator or player';end if;
  select to_jsonb(s) into before_row from eldervale_private.staff s where user_id=target_id;
  if payload->>'role'='moderator' then insert into eldervale_private.staff(user_id,role,granted_by) values(target_id,'moderator',auth.uid()) on conflict(user_id) do nothing;else delete from eldervale_private.staff where user_id=target_id;end if;
  result:=jsonb_build_object('userId',target_id,'role',payload->>'role');
 elsif command in ('actor_delete','actor_restore','actor_respawn','actor_freeze','actor_unfreeze','actor_update','goto') then
  actor_id:=payload->>'id';select to_jsonb(a),data into before_row,body from eldervale_private.realm_actors a where id=actor_id for update;
  if before_row is null then raise exception 'Actor not found';end if;
  if command='goto' then return eldervale_private.admin_owner_base('teleport',jsonb_build_object('x',(before_row->>'x')::float8+3,'z',(before_row->>'z')::float8));end if;
  if command in ('actor_delete','actor_restore') then
   if exists(select 1 from eldervale_private.entities where id::text=actor_id) then return eldervale_private.admin_owner_base(case when command='actor_delete' then 'delete' else 'restore' end,jsonb_build_object('id',actor_id));end if;
   update eldervale_private.realm_actors set deleted=command='actor_delete',target=null,phase='ready',hp=case when command='actor_restore' then (data->>'hp')::integer else hp end where id=actor_id;
  elsif command='actor_respawn' then update eldervale_private.realm_actors set hp=(data->>'hp')::integer,respawn_at=null,target=null,phase='ready',x=(data->>'x')::float8,z=(data->>'z')::float8 where id=actor_id;
  else
   if command='actor_update' then
    for k in select jsonb_object_keys(payload-'id') loop
     if k not in ('level','hp','damage','attackSpeed','roam','respawn','hostile','attackable') then raise exception 'Unsupported actor field: %',k;end if;
     if k not in ('hostile','attackable') then v:=(payload->>k)::numeric;if v::text in ('NaN','Infinity','-Infinity') or (k='level' and v not between 1 and 100) or(k='hp' and v not between 1 and 100000) or(k='damage' and v not between 0 and 10000) or(k='attackSpeed' and v not between 1.3 and 30) or(k='roam' and v not between 0 and 50) or(k='respawn' and v not between 0 and 86400) then raise exception 'Invalid actor %',k;end if;else perform (payload->>k)::boolean;end if;
    end loop;
    body:=body||(payload-'id');body:=body||jsonb_build_object('attackLevel',body->'level','strengthLevel',body->'level','defenceLevel',body->'level');
   else body:=body||jsonb_build_object('frozen',command='actor_freeze');end if;
   if exists(select 1 from eldervale_private.entities where id::text=actor_id) then
    update eldervale_private.settings set revision=revision+1 where id returning revision into revision_id;
    update eldervale_private.entities set data=body,revision=revision_id where id::text=actor_id;
   else update eldervale_private.realm_actors set data=body,hp=least(hp,(body->>'hp')::integer),target=null,phase='ready' where id=actor_id;end if;
  end if;
  select to_jsonb(a) into result from eldervale_private.realm_actors a where id=actor_id;
 elsif command in ('heal','setskill','bring') then
  target_id:=coalesce((payload->>'userId')::uuid,auth.uid());select to_jsonb(s) into before_row from public.player_saves s where user_id=target_id for update;if before_row is null then raise exception 'Player not found';end if;
  if command='heal' then update public.player_saves set health=max_health where user_id=target_id;
  elsif command='bring' then select jsonb_build_object('x',x,'z',z,'userId',target_id) into result from eldervale_private.realm_players where user_id=auth.uid();return eldervale_private.admin_owner_base('teleport',result);
  else k:=payload->>'skill';n:=(payload->>'level')::integer;if k not in ('attackXP','strengthXP','defenceXP','hitpointsXP','rangedXP','magicXP','prayerXP','firemakingXP','fishingXP','cookingXP','smithingXP','craftingXP','herbloreXP','farmingXP','agilityXP','thievingXP') or n not between 1 and 100 then raise exception 'Use a valid skill XP key and level 1–100';end if;
   update public.player_saves set skills=jsonb_set(skills,array[k],to_jsonb((n-1)*(n-1)*50)) where user_id=target_id;update public.player_saves set level=eldervale_private.combat_level(skills) where user_id=target_id;
  end if;
  select jsonb_build_object('userId',user_id,'health',health,'skills',skills) into result from public.player_saves where user_id=target_id;
 else return eldervale_private.admin_owner_base(command,payload);end if;
 insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,coalesce(target_id::text,actor_id,payload->>'id'),before_row,result);
 return result;
end $$;
create or replace function eldervale_private.admin_overview() returns jsonb language plpgsql security definer set search_path='' as $$
declare role_name text:=eldervale_private.staff_role();begin
 if role_name is null then raise exception 'Staff access required' using errcode='42501';end if;
 return jsonb_build_object('role',role_name,'players',(select coalesce(jsonb_agg(p),'[]'::jsonb) from (select s.user_id,s.character_name,s.level,s.updated_at,m.banned_until,m.muted_until,m.reason,coalesce(t.role,'player') staff_role,(r.last_seen>now()-interval '15 seconds') online from public.player_saves s left join eldervale_private.moderation m on m.user_id=s.user_id left join eldervale_private.staff t on t.user_id=s.user_id left join eldervale_private.realm_players r on r.user_id=s.user_id order by s.updated_at desc limit 300)p),'actors',case when role_name='owner' then (select coalesce(jsonb_agg(to_jsonb(a)),'[]') from eldervale_private.realm_actors a) else '[]'::jsonb end,'audit',case when role_name='owner' then (select coalesce(jsonb_agg(a),'[]'::jsonb) from (select * from eldervale_private.audit order by id desc limit 100)a) else '[]'::jsonb end,'reports',(select coalesce(jsonb_agg(r),'[]'::jsonb) from (select * from eldervale_private.reports order by resolved,created_at desc limit 100)r),'chat',(select coalesce(jsonb_agg(c),'[]'::jsonb) from (select * from public.world_chat order by id desc limit 50)c));end $$;
-- Extend snapshots without changing the authoritative movement/combat implementation.
alter function eldervale_private.snapshot(bigint) rename to snapshot_before_castle;
create function eldervale_private.snapshot(cursor_revision bigint default -1) returns jsonb language plpgsql security definer set search_path='' as $$begin return eldervale_private.snapshot_before_castle(cursor_revision)||jsonb_build_object('staffRole',eldervale_private.staff_role(),'removedActors',(select coalesce(jsonb_agg(id),'[]') from eldervale_private.realm_actors where deleted));end $$;
-- Public invoker wrappers bind functions by OID. Recreate after renaming implementations.
create or replace function public.world_snapshot(cursor_revision bigint default -1) returns jsonb language sql security invoker set search_path='' as $$select eldervale_private.snapshot(cursor_revision)$$;

create or replace function eldervale_private.entity_runtime() returns trigger language plpgsql security definer set search_path='' as $$declare d jsonb:=new.data;begin
 if d->>'kind' in ('npc','monster') then
  d:=d||jsonb_build_object('hp',greatest(1,coalesce((d->>'hp')::integer,45)),'level',greatest(1,least(100,coalesce((d->>'level')::integer,1))),'attackLevel',greatest(1,least(100,coalesce((d->>'level')::integer,1))),'defenceLevel',greatest(1,least(100,coalesce((d->>'level')::integer,1))),'strengthLevel',greatest(1,least(100,coalesce((d->>'level')::integer,1))));
  insert into eldervale_private.realm_actors(id,data,x,z,hp,deleted) values(new.id::text,d,(d->>'x')::float8,(d->>'z')::float8,(d->>'hp')::integer,new.deleted) on conflict(id) do update set data=excluded.data,x=excluded.x,z=excluded.z,hp=excluded.hp,deleted=excluded.deleted,target=null,phase='ready',respawn_at=null;
 else
  if new.deleted then delete from eldervale_private.realm_objects where id=new.id::text;
  else insert into eldervale_private.realm_objects(id,kind,x,z,data) values(new.id::text,case when d->>'template'='castle_gate' then 'castle_gate' when d->>'template'='fishing_spot' then 'fishing' when d->>'template' in ('cottage','bank','inn','forge') then 'door' when d->>'template' in ('tree','pine') then 'tree' when d->>'template'='rock' then 'rock' when d->>'template'='market' then 'merchant' else d->>'kind' end,(d->>'x')::float8,(d->>'z')::float8,d||jsonb_build_object('type',d->>'template','scaleX',1.3*coalesce((d->>'scale')::float8,1),'scaleZ',1.3*coalesce((d->>'scale')::float8,1),'yaw',coalesce((d->>'yaw')::float8,0)*pi()/180)) on conflict(id) do update set data=excluded.data,x=excluded.x,z=excluded.z;end if;
 end if;
 delete from eldervale_private.shop_stock where merchant=new.id::text;
 if not new.deleted then insert into eldervale_private.shop_stock(merchant,item,buy,sell,stock) select new.id::text,key,(value->>'buy')::integer,(value->>'sell')::integer,(value->>'stock')::integer from jsonb_each(coalesce(d->'shop','{}'));end if;
 return new;
end $$;


create or replace function eldervale_private.world_tick() returns void language plpgsql security definer set search_path='' as $$
declare t timestamptz:=clock_timestamp();prev timestamptz;dt float8;p eldervale_private.realm_players;s public.player_saves;a eldervale_private.realm_actors;o eldervale_private.realm_objects;d jsonb;w jsonb;victim public.player_saves;target_player eldervale_private.realm_players;gx float8;gz float8;dx float8;dz float8;dist float8;step float8;budget float8;moving boolean;damage integer;defence integer;absorb integer;blocked boolean;quantity integer;period float8;lx float8;lz float8;sid text;atk integer;str integer;def integer;award integer;style text;chance float8;
begin
 if not pg_try_advisory_xact_lock(736211) then return;end if;
 select tick_at into prev from eldervale_private.realm_clock where id and enabled;if not found then return;end if;
 dt:=least(1.2,extract(epoch from(t-prev)));if dt<.15 then return;end if;update eldervale_private.realm_clock set tick_at=t where id;
 -- Expired sessions cannot continue attacks or move after leaving the world.
 update eldervale_private.realm_players set path='[]',intent=null where last_seen<t-interval '15 seconds' and (path<>'[]' or intent is not null);
 for p in select * from eldervale_private.realm_players where last_seen>t-interval '15 seconds' order by user_id loop
  if exists(select 1 from eldervale_private.moderation where user_id=p.user_id and (banned_until>t or kicked_at>p.last_seen)) then continue;end if;
  select * into s from public.player_saves where user_id=p.user_id;
  budget:=dt*case when p.run and p.energy>0 then 6.4 else 3.2 end;moving:=false;
  for quantity in 1..96 loop
   exit when jsonb_array_length(p.path)=0 or budget<=0;
   gx:=(p.path->0->>0)::float8;gz:=(p.path->0->>1)::float8;dx:=gx-p.x;dz:=gz-p.z;dist:=sqrt(dx*dx+dz*dz);
   if dist<.03 then p.path:=p.path-0;continue;end if;
   step:=least(.15,dist,budget);lx:=p.x+dx/dist*step;lz:=p.z+dz/dist*step;
   if not eldervale_private.can_step(p.x,p.z,lx,lz) then p.path:='[]';p.intent:=null;exit;end if;
   p.x:=lx;p.z:=lz;p.yaw:=atan2(dx,dz);budget:=budget-step;moving:=true;if step>=dist-.01 then p.path:=p.path-0;end if;
  end loop;
  p.energy:=greatest(0,least(100,p.energy+dt*case when moving and p.run then -5 when moving then 1.5 else 3 end));if p.energy=0 then p.run:=false;end if;
  update eldervale_private.realm_players set x=p.x,z=p.z,yaw=p.yaw,path=p.path,energy=p.energy,run=p.run where user_id=p.user_id;
  update public.player_saves set world_position=world_position||jsonb_build_object('x',p.x,'y',p.z),game_flags=game_flags||jsonb_build_object('runEnergy',p.energy),level=eldervale_private.combat_level(skills) where user_id=p.user_id;
  if p.intent is not null then
   sid:=p.intent->>'target';select * into a from eldervale_private.realm_actors where id=sid and not deleted;
   if found and a.data->>'kind' in ('npc','monster') and sqrt(power(p.x-a.x,2)+power(p.z-a.z,2))<3 then
    if p.intent->>'kind'='attack' then
     if not coalesce((a.data->>'attackable')::boolean,a.data->>'kind'='monster') then p.intent:=null;
     elsif a.hp>0 and (a.target is null or a.target=p.user_id) then update eldervale_private.realm_actors set target=p.user_id,phase='ready',turn='player',due_at=t where id=sid and target is null;p.path:='[]';
     end if;
    else perform eldervale_private.emit(jsonb_build_object('type','interaction','player',p.user_id,'target',sid,'kind','npc'));p.intent:=null;p.path:='[]';end if;
   else
    select * into o from eldervale_private.realm_objects where id=sid;
    if found and sqrt(power(p.x-o.x,2)+power(p.z-o.z,2))<(case when o.kind in ('door','castle_gate') then 7 else 3 end) then
     if o.kind in ('door','castle_gate') then update eldervale_private.realm_objects set open=not open where id=sid;perform eldervale_private.emit(jsonb_build_object('type','door','target',sid,'player',p.user_id,'open',not o.open));
     elsif o.kind in ('tree','rock') and (o.available_at is null or o.available_at<=t) then
      if coalesce(eldervale_private.inventory_used(p.user_id),0)>=16 then perform eldervale_private.emit(jsonb_build_object('type','notice','player',p.user_id,'text','Your inventory is full.'));
      else perform eldervale_private.item_change(p.user_id,case when o.kind='tree' then 'wood' else 'ore' end,1);sid:=case when o.kind='tree' then 'woodXP' else 'miningXP' end;update public.player_saves set stats=stats||jsonb_build_object(sid,coalesce((stats->>sid)::integer,0)+25) where user_id=p.user_id;update eldervale_private.realm_objects set available_at=t+interval '30 seconds' where id=o.id;perform eldervale_private.emit(jsonb_build_object('type','gather','player',p.user_id,'target',o.id,'availableAt',t+interval '30 seconds'));end if;
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
 for a in select * from eldervale_private.realm_actors where not deleted and not coalesce((data->>'frozen')::boolean,false) order by id loop
  if a.hp<=0 then if a.respawn_at is not null and a.respawn_at<=t then update eldervale_private.realm_actors set hp=(data->>'hp')::integer,respawn_at=null,target=null,phase='ready',x=(data->>'x')::float8,z=(data->>'z')::float8 where id=a.id;perform eldervale_private.emit(jsonb_build_object('type','respawn','target',a.id));end if;continue;end if;
  if a.target is not null then
   select * into target_player from eldervale_private.realm_players where user_id=a.target and last_seen>t-interval '15 seconds';
   if not found or exists(select 1 from eldervale_private.moderation where user_id=a.target and banned_until>t) then update eldervale_private.realm_actors set target=null,phase='ready' where id=a.id;continue;end if;
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
     if victim.health<=damage then update public.player_saves set health=max_health,gold=greatest(0,gold-10),world_position=world_position||'{"x":0,"y":5}' where user_id=a.target;update eldervale_private.realm_players set x=0,z=5,intent=null,path='[]' where user_id=a.target;update eldervale_private.realm_actors set target=null,phase='ready' where id=a.id;perform eldervale_private.emit(jsonb_build_object('type','player_death','player',a.target));end if;
    end if;
   elsif a.phase='recover' and a.due_at<=t then update eldervale_private.realm_actors set phase='ready',turn=case when turn='player' then 'enemy' else 'player' end where id=a.id;end if;
  else
   if coalesce((a.data->>'hostile')::boolean,false) then select user_id into a.target from eldervale_private.realm_players where last_seen>t-interval '15 seconds' and sqrt(power(x-a.x,2)+power(z-a.z,2))<7 order by sqrt(power(x-a.x,2)+power(z-a.z,2)) limit 1;if a.target is not null then update eldervale_private.realm_actors set target=a.target,turn='enemy',phase='ready' where id=a.id;continue;end if;end if;
   gx:=(a.data->>'x')::float8;gz:=(a.data->>'z')::float8;
   if coalesce((a.data->>'roam')::float8,0)>0 then gx:=gx+cos(extract(epoch from t)*.08+length(a.id))*(a.data->>'roam')::float8;gz:=gz+sin(extract(epoch from t)*.08+length(a.id))*(a.data->>'roam')::float8;end if;
   dx:=gx-a.x;dz:=gz-a.z;dist:=sqrt(dx*dx+dz*dz);if dist>.1 then step:=least(dt*1.35,dist);lx:=a.x+dx/dist*step;lz:=a.z+dz/dist*step;if eldervale_private.can_step(a.x,a.z,lx,lz) then update eldervale_private.realm_actors set x=lx,z=lz,yaw=atan2(dx,dz) where id=a.id;end if;end if;
  end if;
 end loop;
 delete from eldervale_private.realm_events where created_at<t-interval '5 minutes';delete from eldervale_private.realm_requests where created_at<t-interval '1 day';
end $$;



alter function eldervale_private.can_step(float8,float8,float8,float8) rename to can_step_before_castle;
create function eldervale_private.can_step(ax float8,az float8,bx float8,bz float8) returns boolean language plpgsql stable set search_path='' as $$
declare e record;angle float8;tx float8;tz float8;s float8;begin
 if not eldervale_private.can_step_before_castle(ax,az,bx,bz) then return false;end if;
 for e in select id,data from eldervale_private.entities where not deleted and data->>'template' in ('castle_wall','castle_gate','castle_tower') and abs((data->>'x')::float8-bx)<80 and abs((data->>'z')::float8-bz)<80 loop
  angle:=coalesce((e.data->>'yaw')::float8,0)*pi()/180;s:=coalesce((e.data->>'scale')::float8,1);tx:=((bx-(e.data->>'x')::float8)*cos(angle)-(bz-(e.data->>'z')::float8)*sin(angle))/s;tz:=((bx-(e.data->>'x')::float8)*sin(angle)+(bz-(e.data->>'z')::float8)*cos(angle))/s;
  if e.data->>'template'='castle_tower' then if tx*tx+tz*tz<25 then return false;end if;
  elsif abs(tz)<(case when e.data->>'template'='castle_gate' then 2.1 else 1.6 end) and abs(tx)<coalesce((e.data->>'length')::float8,24)/2+.3 then
   if e.data->>'template'<>'castle_gate' or abs(tx)>4.1 or not exists(select 1 from eldervale_private.realm_objects where id=e.id::text and open) then return false;end if;
  end if;
 end loop;return true;end $$;
alter function eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) rename to realm_request_before_castle;
create function eldervale_private.realm_request(session_id uuid,command text default 'sync',payload jsonb default '{}',request_id uuid default null,event_cursor bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;p eldervale_private.realm_players;o eldervale_private.realm_objects;s public.player_saves;begin
 if command in ('pray','cook') then
  if not eldervale_private.allowed() then raise exception 'Sign in required' using errcode='42501';end if;
  perform pg_advisory_xact_lock(736211);select * into p from eldervale_private.realm_players where user_id=auth.uid() and realm_players.session_id=$1 for update;if not found then raise exception 'Session expired';end if;
  select * into o from eldervale_private.realm_objects where id=payload->>'target' and data->>'template'=case when command='pray' then 'altar' else 'hearth' end;
  if o.id is null or sqrt(power(p.x-o.x,2)+power(p.z-o.z,2))>3 then raise exception 'Move closer';end if;
  if request_id is null then raise exception 'Request ID required';end if;
  if not exists(select 1 from eldervale_private.realm_requests where user_id=auth.uid() and realm_requests.request_id=$4) then
   if o.available_at>clock_timestamp() then raise exception 'Please wait a moment';end if;
   if command='pray' then
    update public.player_saves set stats=stats||jsonb_build_object('prayerPoints',least(100,1+floor(sqrt(coalesce((skills->>'prayerXP')::numeric,0)/50)))),skills=jsonb_set(skills,'{prayerXP}',to_jsonb(coalesce((skills->>'prayerXP')::integer,0)+5)) where user_id=auth.uid();
    perform eldervale_private.emit(jsonb_build_object('type','notice','player',auth.uid(),'text','You pray at the altar. Prayer restored. +5 Prayer XP.'));
   else
    perform eldervale_private.item_change(auth.uid(),'rawFish',-1);update public.player_saves set health=least(max_health,health+12),skills=jsonb_set(skills,'{cookingXP}',to_jsonb(coalesce((skills->>'cookingXP')::integer,0)+25)) where user_id=auth.uid();
    perform eldervale_private.emit(jsonb_build_object('type','notice','player',auth.uid(),'text','You cook and eat your fish. +12 HP, +25 Cooking XP.'));
   end if;
   update eldervale_private.realm_objects set available_at=clock_timestamp()+interval '3 seconds' where id=o.id;
   insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),request_id,'{}');
  end if;
  result:=eldervale_private.realm_request_before_castle(session_id,'sync','{}',null,event_cursor);
 else result:=eldervale_private.realm_request_before_castle(session_id,command,payload,request_id,event_cursor);end if;
 return result||jsonb_build_object('removedActors',(select coalesce(jsonb_agg(id),'[]') from eldervale_private.realm_actors where deleted),'gates',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'open',open)),'[]') from eldervale_private.realm_objects where kind='castle_gate'));
end $$;
create or replace function public.world_command(session_id uuid,command text default 'sync',payload jsonb default '{}',request_id uuid default null,event_cursor bigint default 0) returns jsonb language sql security invoker set search_path='' as $$select eldervale_private.realm_request(session_id,command,payload,request_id,event_cursor)$$;

insert into eldervale_private.realm_water(outline,passable) values('((-403,-368),(-277,-368),(-277,-359),(-403,-359))'::polygon,false);

insert into eldervale_private.realm_water(outline,passable) values('((-403,-251),(-277,-251),(-277,-242),(-403,-242))'::polygon,false);

insert into eldervale_private.realm_water(outline,passable) values('((-403,-359),(-394,-359),(-394,-251),(-403,-251))'::polygon,false);

insert into eldervale_private.realm_water(outline,passable) values('((-286,-359),(-277,-359),(-277,-251),(-286,-251))'::polygon,false);

insert into eldervale_private.realm_water(outline,passable) values('((-344.5,-256),(-335.5,-256),(-335.5,-236),(-344.5,-236))'::polygon,true);

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle curtain wall","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":24,"template":"castle_wall","x":-376,"z":-354,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"1"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='1');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle curtain wall","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":24,"template":"castle_wall","x":-352,"z":-354,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"2"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='2');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle curtain wall","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":24,"template":"castle_wall","x":-328,"z":-354,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"3"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='3');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle curtain wall","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":24,"template":"castle_wall","x":-304,"z":-354,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"4"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='4');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle curtain wall","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":35,"template":"castle_wall","x":-371.5,"z":-256,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"5"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='5');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle curtain wall","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":35,"template":"castle_wall","x":-308.5,"z":-256,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"6"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='6');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle curtain wall","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":24,"template":"castle_wall","x":-389,"z":-341,"yaw":90,"blueprint":"eldervale-castle-v1","blueprintKey":"7"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='7');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle curtain wall","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":24,"template":"castle_wall","x":-389,"z":-317,"yaw":90,"blueprint":"eldervale-castle-v1","blueprintKey":"8"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='8');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle curtain wall","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":24,"template":"castle_wall","x":-389,"z":-293,"yaw":90,"blueprint":"eldervale-castle-v1","blueprintKey":"9"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='9');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle curtain wall","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":24,"template":"castle_wall","x":-389,"z":-269,"yaw":90,"blueprint":"eldervale-castle-v1","blueprintKey":"10"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='10');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle curtain wall","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":24,"template":"castle_wall","x":-291,"z":-341,"yaw":90,"blueprint":"eldervale-castle-v1","blueprintKey":"11"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='11');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle curtain wall","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":24,"template":"castle_wall","x":-291,"z":-317,"yaw":90,"blueprint":"eldervale-castle-v1","blueprintKey":"12"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='12');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle curtain wall","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":24,"template":"castle_wall","x":-291,"z":-293,"yaw":90,"blueprint":"eldervale-castle-v1","blueprintKey":"13"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='13');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle curtain wall","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":24,"template":"castle_wall","x":-291,"z":-269,"yaw":90,"blueprint":"eldervale-castle-v1","blueprintKey":"14"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='14');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle round tower","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"castle_tower","x":-389,"z":-354,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"15"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='15');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle round tower","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"castle_tower","x":-389,"z":-256,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"16"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='16');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle round tower","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"castle_tower","x":-291,"z":-354,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"17"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='17');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle round tower","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"castle_tower","x":-291,"z":-256,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"18"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='18');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Eldervale Great Gate","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":28,"template":"castle_gate","x":-340,"z":-256,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"19"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='19');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Royal Treasury & Bank","scale":2.3,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"bank","x":-366,"z":-312,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"20","stone":true}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='20');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Chapel of the Dawn","scale":2.5,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"cottage","x":-313,"z":-315,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"21","stone":true,"room":"chapel"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='21');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle Kitchen & Refectory","scale":2.3,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"inn","x":-365,"z":-282,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"22","room":"kitchen"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='22');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Royal Smithy","scale":2,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"forge","x":-312,"z":-281,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"23","stone":true}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='23');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Eldervale Great Hall","scale":4.4,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"cottage","x":-340,"z":-334,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"24","stone":true,"room":"hall"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='24');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle round tower","scale":1.35,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"castle_tower","x":-352,"z":-337,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"25"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='25');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Castle round tower","scale":1.35,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"castle_tower","x":-328,"z":-337,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"26"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='26');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Altar of the Dawn","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"altar","x":-313,"z":-317,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"27"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='27');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Royal cooking hearth","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"hearth","x":-365,"z":-284,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"28"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='28');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Crown Fountain","scale":1.7,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"fountain","x":-340,"z":-302,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"29"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='29');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Path segment","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":50,"width":7,"template":"road","x":-340,"z":-282,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"30"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='30');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Path segment","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":24,"width":6,"template":"road","x":-340,"z":-320,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"31"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='31');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Path segment","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"length":78,"width":5,"template":"road","x":-340,"z":-303,"yaw":90,"blueprint":"eldervale-castle-v1","blueprintKey":"32"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='32');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Street lantern","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"lantern","x":-349,"z":-323,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"33"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='33');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Street lantern","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"lantern","x":-349,"z":-289,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"34"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='34');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Street lantern","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"lantern","x":-349,"z":-270,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"35"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='35');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Street lantern","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"lantern","x":-331,"z":-323,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"36"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='36');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Street lantern","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"lantern","x":-331,"z":-289,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"37"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='37');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Street lantern","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"lantern","x":-331,"z":-270,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"38"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='38');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Town bench","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"bench","x":-353,"z":-297,"yaw":90,"blueprint":"eldervale-castle-v1","blueprintKey":"39"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='39');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Town bench","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"bench","x":-353,"z":-287,"yaw":90,"blueprint":"eldervale-castle-v1","blueprintKey":"40"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='40');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Town bench","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"bench","x":-327,"z":-297,"yaw":-90,"blueprint":"eldervale-castle-v1","blueprintKey":"41"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='41');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Town bench","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"bench","x":-327,"z":-287,"yaw":-90,"blueprint":"eldervale-castle-v1","blueprintKey":"42"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='42');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Royal standard","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"banner","x":-354,"z":-264,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"43"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='43');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Royal standard","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"banner","x":-326,"z":-264,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"44"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='44');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Royal standard","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"banner","x":-382,"z":-342,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"45"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='45');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Royal standard","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"banner","x":-298,"z":-342,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"46"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='46');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"Maelin the Royal Banker","role":"banker","weapon":"longsword","attackType":"stab","color":8017788,"level":5,"hp":45,"damage":4,"attackSpeed":2.4,"roam":0,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"The royal vault keeps your belongings safe. Your bank is shared with every branch.","template":"banker","x":-366,"z":-311,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"47","activity":"read"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='47');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"Sister Adeline","role":"healer","weapon":null,"attackType":"magic","color":14735023,"level":5,"hp":45,"damage":5,"attackSpeed":2.4,"roam":0,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"Pray at the altar behind me. The Dawn watches over all travelers.","template":"healer","x":-313,"z":-314,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"48"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='48');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"Cook Rowan","role":"innkeeper","weapon":null,"attackType":"punch","color":8935499,"level":5,"hp":45,"damage":4,"attackSpeed":2.4,"roam":0,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"Fresh fish on the hearth! Bring raw fish and use the cooking hearth.","template":"innkeeper","x":-365,"z":-281,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"49","activity":"trade"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='49');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"Master Smith Torren","role":"smith","weapon":"battleaxe","attackType":"hammer","color":5789029,"level":5,"hp":45,"damage":4,"attackSpeed":2.4,"roam":0,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"Welcome, traveler. These roads connect us all.","template":"smith","x":-312,"z":-280,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"50","activity":"smith"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='50');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Market stall","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"market","x":-358,"z":-298,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"51"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='51');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"Elsa the Quartermaster","role":"merchant","weapon":"dagger","attackType":"stab","color":10253389,"level":5,"hp":45,"damage":4,"attackSpeed":2.4,"roam":0,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"Welcome, traveler. These roads connect us all.","template":"merchant","x":-358,"z":-299,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"52","shop":{"weapon:longsword":{"buy":70,"sell":35,"stock":-1},"weapon:scimitar":{"buy":90,"sell":45,"stock":-1},"shield:kite":{"buy":80,"sell":40,"stock":-1}}}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='52');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"object","name":"Market stall","scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"template":"market","x":-322,"z":-298,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"53"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='53');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"Bren the Provisioner","role":"merchant","weapon":"dagger","attackType":"stab","color":10253389,"level":5,"hp":45,"damage":4,"attackSpeed":2.4,"roam":0,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"Welcome, traveler. These roads connect us all.","template":"merchant","x":-322,"z":-299,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"54","shop":{"fishingPole":{"buy":35,"sell":12,"stock":-1},"bait":{"buy":2,"sell":1,"stock":-1},"rawFish":{"buy":12,"sell":6,"stock":1000}}}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='54');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"Perrin the Porter","role":"resident","weapon":null,"attackType":"punch","color":8356955,"level":5,"hp":45,"damage":4,"attackSpeed":2.4,"roam":5,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"Welcome, traveler. These roads connect us all.","template":"villager","x":-352,"z":-288,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"55","activity":"carry"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='55');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"Lyra the Courier","role":"resident","weapon":null,"attackType":"punch","color":8356955,"level":5,"hp":45,"damage":4,"attackSpeed":2.4,"roam":8,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"Welcome, traveler. These roads connect us all.","template":"villager","x":-328,"z":-311,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"56","activity":"carry"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='56');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"Hale the Groundskeeper","role":"resident","weapon":null,"attackType":"punch","color":8356955,"level":5,"hp":45,"damage":4,"attackSpeed":2.4,"roam":4,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"Welcome, traveler. These roads connect us all.","template":"villager","x":-349,"z":-298,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"57","activity":"sweep"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='57');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"Mira the Gardener","role":"resident","weapon":null,"attackType":"punch","color":8356955,"level":5,"hp":45,"damage":4,"attackSpeed":2.4,"roam":3,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"Welcome, traveler. These roads connect us all.","template":"villager","x":-330,"z":-281,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"58","activity":"garden"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='58');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"Royal Archivist Iven","role":"resident","weapon":null,"attackType":"punch","color":8356955,"level":5,"hp":45,"damage":4,"attackSpeed":2.4,"roam":0,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"Welcome, traveler. These roads connect us all.","template":"villager","x":-340,"z":-332,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"59","activity":"read"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='59');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"White Knight gatekeeper","role":"guard","weapon":"longsword","attackType":"slash","color":15001828,"level":45,"hp":240,"damage":20,"attackSpeed":2.4,"roam":0,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"Welcome, traveler. These roads connect us all.","whiteArmor":true,"template":"white_knight","x":-345,"z":-240,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"60"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='60');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"White Knight gatekeeper","role":"guard","weapon":"longsword","attackType":"slash","color":15001828,"level":45,"hp":240,"damage":20,"attackSpeed":2.4,"roam":0,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"Welcome, traveler. These roads connect us all.","whiteArmor":true,"template":"white_knight","x":-335,"z":-240,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"61"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='61');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"White Knight patrol","role":"guard","weapon":"longsword","attackType":"slash","color":15001828,"level":45,"hp":240,"damage":20,"attackSpeed":2.4,"roam":5,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"Welcome, traveler. These roads connect us all.","whiteArmor":true,"template":"white_knight","x":-376,"z":-273,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"62"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='62');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"White Knight patrol","role":"guard","weapon":"longsword","attackType":"slash","color":15001828,"level":45,"hp":240,"damage":20,"attackSpeed":2.4,"roam":5,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"Welcome, traveler. These roads connect us all.","whiteArmor":true,"template":"white_knight","x":-304,"z":-273,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"63"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='63');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"White Knight patrol","role":"guard","weapon":"longsword","attackType":"slash","color":15001828,"level":45,"hp":240,"damage":20,"attackSpeed":2.4,"roam":5,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"Welcome, traveler. These roads connect us all.","whiteArmor":true,"template":"white_knight","x":-372,"z":-330,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"64"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='64');

insert into eldervale_private.entities(revision,data) select revision,'{"kind":"npc","name":"White Knight patrol","role":"guard","weapon":"longsword","attackType":"slash","color":15001828,"level":45,"hp":240,"damage":20,"attackSpeed":2.4,"roam":4,"respawn":30,"attackable":false,"hostile":false,"scale":1,"dialogue":"Welcome, traveler. These roads connect us all.","whiteArmor":true,"template":"white_knight","x":-308,"z":-335,"yaw":0,"blueprint":"eldervale-castle-v1","blueprintKey":"65"}'::jsonb from eldervale_private.settings where id and not exists(select 1 from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1' and data->>'blueprintKey'='65');

update eldervale_private.settings set revision=revision+1 where id;update eldervale_private.entities set revision=(select revision from eldervale_private.settings where id) where data->>'blueprint'='eldervale-castle-v1';
revoke all on function eldervale_private.admin_owner_base(text,jsonb),eldervale_private.staff_role(),eldervale_private.can_step_before_castle(float8,float8,float8,float8),eldervale_private.can_step(float8,float8,float8,float8),eldervale_private.snapshot_before_castle(bigint),eldervale_private.snapshot(bigint),eldervale_private.realm_request_before_castle(uuid,text,jsonb,uuid,bigint),eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) from public,anon,authenticated;
grant execute on function eldervale_private.staff_role(),eldervale_private.snapshot(bigint),eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) to authenticated;
