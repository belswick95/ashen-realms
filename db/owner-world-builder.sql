-- Eldervale owner tools. Reviewed remote migration; never put a service key in the browser.
create schema if not exists eldervale_private;
revoke all on schema eldervale_private from public, anon;
grant usage on schema eldervale_private to authenticated;
create table eldervale_private.settings(id boolean primary key default true check(id), revision bigint not null default 0, welcome text not null default 'Welcome to Eldervale!', announcement text not null default '', announcement_until timestamptz, restart_at timestamptz, maintenance boolean not null default false);
insert into eldervale_private.settings(id) values(true);
create table eldervale_private.entities(id uuid primary key default gen_random_uuid(), revision bigint not null, data jsonb not null check(jsonb_typeof(data)='object'), deleted boolean not null default false, created_at timestamptz not null default now());
create index on eldervale_private.entities(revision);
create table eldervale_private.moderation(user_id uuid primary key references auth.users(id), banned_until timestamptz, muted_until timestamptz, kicked_at timestamptz, reason text not null default '');
create table eldervale_private.audit(id bigint generated always as identity primary key, actor uuid not null, action text not null, target text, before_data jsonb, after_data jsonb, created_at timestamptz not null default now());
create table eldervale_private.reports(id bigint generated always as identity primary key, reporter uuid not null, target uuid, body text not null, resolved boolean not null default false, created_at timestamptz not null default now());
create table eldervale_private.deliveries(id uuid primary key default gen_random_uuid(), recipient uuid not null references auth.users(id), data jsonb not null, applied_at timestamptz, created_at timestamptz not null default now());
create index on eldervale_private.deliveries(recipient) where applied_at is null;
alter table eldervale_private.settings enable row level security;
alter table eldervale_private.entities enable row level security;
alter table eldervale_private.moderation enable row level security;
alter table eldervale_private.audit enable row level security;
alter table eldervale_private.reports enable row level security;
alter table eldervale_private.deliveries enable row level security;
revoke all on all tables in schema eldervale_private from public,anon,authenticated;
revoke all on all sequences in schema eldervale_private from public,anon,authenticated;
create function eldervale_private.is_owner() returns boolean language sql stable security invoker set search_path='' as $$select coalesce(auth.uid()='91c5b7f0-7018-4290-a190-c2bba0ca492d'::uuid,false)$$;
create function eldervale_private.allowed() returns boolean language sql stable security definer set search_path='' as $$select auth.uid() is not null and not exists(select 1 from eldervale_private.moderation where user_id=auth.uid() and banned_until>now())$$;
create function eldervale_private.can_chat() returns boolean language sql stable security definer set search_path='' as $$select eldervale_private.allowed() and not exists(select 1 from eldervale_private.moderation where user_id=auth.uid() and muted_until>now())$$;
-- Restrictive policies combine with the existing ownership policies; no player's save is exposed.
create policy world_access on public.player_saves as restrictive to authenticated using((select eldervale_private.allowed())) with check((select eldervale_private.allowed()));
create policy world_chat_access on public.world_chat as restrictive to authenticated using((select eldervale_private.allowed()));
create policy world_chat_mute on public.world_chat as restrictive for insert to authenticated with check((select eldervale_private.can_chat()));
create policy world_friends_access on public.player_friendships as restrictive to authenticated using((select eldervale_private.allowed())) with check((select eldervale_private.allowed()));
create function eldervale_private.snapshot(cursor_revision bigint default -1) returns jsonb language plpgsql security definer set search_path='' as $$
declare s eldervale_private.settings; result jsonb; owner_access boolean:=eldervale_private.is_owner();
begin
 if auth.uid() is null then raise exception 'Sign in required' using errcode='42501'; end if;
 select * into s from eldervale_private.settings where id=true;
 select jsonb_build_object('owner',owner_access,'serverTime',now(),'settings',to_jsonb(s),'access',(select to_jsonb(m) from eldervale_private.moderation m where user_id=auth.uid()),'entities',case when eldervale_private.allowed() then coalesce((select jsonb_agg(to_jsonb(e) order by revision,id) from eldervale_private.entities e where revision>cursor_revision),'[]'::jsonb) else '[]'::jsonb end,'deliveries',coalesce((select jsonb_agg(to_jsonb(d)) from eldervale_private.deliveries d where recipient=auth.uid() and applied_at is null),'[]'::jsonb)) into result;
 return result;
end $$;
create function eldervale_private.admin_action(command text, payload jsonb default '{}'::jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
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
   if body->>'kind'<>'item' and body->>'template' not in ('villager','guard','banker','merchant','smith','ranger','mage','healer','knight','farmer','innkeeper','bandit','goblin','skeleton','wolf','deer','boar','bear','rat','spider','bat','troll','golem','wraith','dragon','crate','barrel','chest','bench','fence','lantern','market','well','campfire','tree','pine','rock','banner','cottage','bank','inn','forge','ruin') then raise exception 'Unknown template';end if;
   if body->>'kind'='item' and (coalesce(body->>'item','') not in ('wood','ore','weapon:dagger','weapon:shortsword','weapon:longsword','weapon:scimitar','weapon:twohand','weapon:axe','weapon:pickaxe','weapon:battleaxe','armor:helm','armor:chest','armor:legs','armor:boots','armor:cape','shield:square','shield:kite','jewelry:woodlandAmulet','jewelry:prospectorsRing') or coalesce((body->>'amount')::numeric,1)<1 or coalesce((body->>'amount')::numeric,1)>1000000) then raise exception 'Invalid item drop';end if;
   if length(coalesce(body->>'name',''))>80 or length(coalesce(body->>'dialogue',''))>2000 then raise exception 'Text too long';end if;
   foreach item in array array['x','z','yaw','scale','level','hp','damage','attackSpeed','roam','respawn'] loop
    n:=coalesce((body->>item)::numeric,case when item='scale' then 1 when item='hp' then 20 when item='attackSpeed' then 2.4 else 0 end);
    if n::text in ('NaN','Infinity','-Infinity') or (item in ('x','z') and abs(n)>4500) or (item='yaw' and abs(n)>360) or (item='scale' and (n<0.25 or n>5)) or (item='level' and (n<1 or n>999)) or (item='hp' and (n<1 or n>100000)) or (item='damage' and (n<0 or n>10000)) or (item='attackSpeed' and (n<1.3 or n>30)) or (item='roam' and (n<0 or n>50)) or (item='respawn' and (n<0 or n>86400)) then raise exception 'Invalid %',item;end if;
    body:=jsonb_set(body,array[item],to_jsonb(n));
   end loop;
   if body ? 'attackType' and body->>'attackType' not in ('slash','punch','stab','hammer','arrow','magic','bite','kick','charge','claw','venom','swoop','slam','fire') then raise exception 'Unknown attack';end if;
   if body->>'kind'='npc' and not coalesce((body->>'attackable')::boolean,false) then body:=jsonb_set(body,'{hostile}','false'::jsonb);end if;
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
   if item not in ('gold','wood','ore','weapon:dagger','weapon:shortsword','weapon:longsword','weapon:scimitar','weapon:twohand','weapon:axe','weapon:pickaxe','weapon:battleaxe','armor:helm','armor:chest','armor:legs','armor:boots','armor:cape','shield:square','shield:kite','jewelry:woodlandAmulet','jewelry:prospectorsRing') or item is null or n::text in ('NaN','Infinity','-Infinity') or n<1 or n>1000000 or n<>trunc(n) then raise exception 'Unknown item or quantity';end if;
  else if (payload->>'x')::numeric::text in ('NaN','Infinity','-Infinity') or (payload->>'z')::numeric::text in ('NaN','Infinity','-Infinity') or abs((payload->>'x')::numeric)>4500 or abs((payload->>'z')::numeric)>4500 or not(payload?'x' and payload?'z') then raise exception 'Invalid coordinates';end if;end if;
  insert into eldervale_private.deliveries(recipient,data) values(target_id,payload||jsonb_build_object('command',command)) returning to_jsonb(deliveries) into result;
 elsif command='delete_chat' then
  delete from public.world_chat where id=(payload->>'id')::bigint returning to_jsonb(world_chat) into old_row;result:=jsonb_build_object('deleted',old_row is not null);
 elsif command='resolve_report' then update eldervale_private.reports set resolved=true where id=(payload->>'id')::bigint returning to_jsonb(reports) into result;
 else raise exception 'Unknown command';end if;
 insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,coalesce(entity_id::text,target_id::text,payload->>'id'),old_row,result);
 return result;
end $$;
create function eldervale_private.admin_overview() returns jsonb language plpgsql security definer set search_path='' as $$begin
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 return jsonb_build_object('players',(select coalesce(jsonb_agg(p),'[]'::jsonb) from (select s.user_id,s.character_name,s.level,s.updated_at,m.banned_until,m.muted_until,m.reason from public.player_saves s left join eldervale_private.moderation m on m.user_id=s.user_id order by s.updated_at desc limit 300)p),'audit',(select coalesce(jsonb_agg(a),'[]'::jsonb) from (select * from eldervale_private.audit order by id desc limit 100)a),'reports',(select coalesce(jsonb_agg(r),'[]'::jsonb) from (select * from eldervale_private.reports order by resolved,created_at desc limit 100)r),'chat',(select coalesce(jsonb_agg(c),'[]'::jsonb) from (select * from public.world_chat order by id desc limit 50)c));end $$;
create function eldervale_private.report_player(target_id uuid, report_text text) returns void language plpgsql security definer set search_path='' as $$begin
 if not eldervale_private.allowed() then raise exception 'Access denied' using errcode='42501';end if;
 if length(trim(report_text)) not between 5 and 1000 then raise exception 'Report must be 5–1000 characters';end if;
 if exists(select 1 from eldervale_private.reports where reporter=auth.uid() and created_at>now()-interval '1 minute') then raise exception 'Please wait a minute before submitting another report';end if;
 insert into eldervale_private.reports(reporter,target,body) values(auth.uid(),target_id,report_text);end $$;
create function eldervale_private.ack_delivery(delivery_id uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if not eldervale_private.allowed() then raise exception 'Access denied';end if;
 update eldervale_private.deliveries set applied_at=now() where id=delivery_id and recipient=auth.uid();end $$;
-- Exposed wrappers run as caller. Privileged implementations remain in a non-exposed schema.
create function public.world_snapshot(cursor_revision bigint default -1) returns jsonb language sql security invoker set search_path='' as $$select eldervale_private.snapshot(cursor_revision)$$;
create function public.world_admin(command text,payload jsonb default '{}'::jsonb) returns jsonb language sql security invoker set search_path='' as $$select eldervale_private.admin_action(command,payload)$$;
create function public.world_admin_overview() returns jsonb language sql security invoker set search_path='' as $$select eldervale_private.admin_overview()$$;
create function public.world_report(target_id uuid,report_text text) returns void language sql security invoker set search_path='' as $$select eldervale_private.report_player(target_id,report_text)$$;
create function public.world_ack(delivery_id uuid) returns void language sql security invoker set search_path='' as $$select eldervale_private.ack_delivery(delivery_id)$$;
revoke all on all functions in schema eldervale_private from public,anon,authenticated;
grant execute on all functions in schema eldervale_private to authenticated;
revoke execute on function public.world_snapshot(bigint),public.world_admin(text,jsonb),public.world_admin_overview(),public.world_report(uuid,text),public.world_ack(uuid) from public,anon;
grant execute on function public.world_snapshot(bigint),public.world_admin(text,jsonb),public.world_admin_overview(),public.world_report(uuid,text),public.world_ack(uuid) to authenticated;
create function eldervale_private.pickup(entity_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare e eldervale_private.entities; pos jsonb; delivery jsonb; rev bigint;
begin
 if not eldervale_private.allowed() then raise exception 'Access denied';end if;
 update eldervale_private.settings set revision=revision+1 where id=true returning revision into rev;
 select * into e from eldervale_private.entities where id=entity_id for update;
 if e.id is null or e.deleted or e.data->>'kind'<>'item' then raise exception 'Item is no longer available';end if;
 select world_position into pos from public.player_saves where user_id=auth.uid();
 if pos is null or sqrt(power(coalesce((pos->>'x')::numeric,0)-(e.data->>'x')::numeric,2)+power(coalesce((pos->>'y')::numeric,0)-(e.data->>'z')::numeric,2))>8 then raise exception 'Move closer to pick up this item';end if;
 update eldervale_private.entities set deleted=true,revision=rev where id=entity_id;
 insert into eldervale_private.deliveries(recipient,data) values(auth.uid(),jsonb_build_object('command','give','item',e.data->>'item','amount',coalesce((e.data->>'amount')::integer,1))) returning to_jsonb(deliveries) into delivery;
 return delivery;
end $$;
create function public.world_pickup(entity_id uuid) returns jsonb language sql security invoker set search_path='' as $$select eldervale_private.pickup(entity_id)$$;
revoke execute on function eldervale_private.pickup(uuid), public.world_pickup(uuid) from public,anon;
grant execute on function eldervale_private.pickup(uuid), public.world_pickup(uuid) to authenticated;
