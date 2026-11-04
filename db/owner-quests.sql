-- Quest definitions and per-player accepted copies are private and server authoritative.
create table eldervale_private.quest_definitions(id uuid primary key default gen_random_uuid(),version integer not null default 1,data jsonb not null,updated_at timestamptz not null default now());
create table eldervale_private.player_quests(user_id uuid not null references public.player_saves(user_id) on delete cascade,quest_id uuid not null references eldervale_private.quest_definitions(id),version integer not null,data jsonb not null,progress jsonb not null default '{}',completed_at timestamptz,primary key(user_id,quest_id));
alter table eldervale_private.quest_definitions enable row level security;
alter table eldervale_private.player_quests enable row level security;
revoke all on eldervale_private.quest_definitions,eldervale_private.player_quests from public,anon,authenticated;
create function eldervale_private.quest_snapshot(uid uuid) returns jsonb language sql stable set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'version',coalesce(p.version,q.version),'data',coalesce(p.data,q.data),'accepted',p.user_id is not null,'completed',p.completed_at is not null,'progress',coalesce(p.progress,'{}')) order by q.updated_at),'[]') from eldervale_private.quest_definitions q left join eldervale_private.player_quests p on p.quest_id=q.id and p.user_id=uid where coalesce((q.data->>'published')::boolean,false) or p.user_id is not null
$$;
create function eldervale_private.quest_event(event jsonb) returns void language plpgsql set search_path='' as $$
declare uid uuid;q record;o jsonb;i integer;key text;current_count integer;
begin
 if event->>'type' not in ('interaction','death') or event->>'player' is null then return;end if;
 uid:=(event->>'player')::uuid;
 for q in select * from eldervale_private.player_quests where user_id=uid and completed_at is null for update loop
  i:=0;
  for o in select value from jsonb_array_elements(q.data->'objectives') loop
   key:=i::text;i:=i+1;
   if o->>'target'=event->>'target' and ((o->>'type'='talk' and event->>'type'='interaction' and event->>'kind'='npc') or (o->>'type'='kill' and event->>'type'='death')) then
    current_count:=least((o->>'amount')::integer,coalesce((q.progress->>key)::integer,0)+1);
    q.progress:=jsonb_set(q.progress,array[key],to_jsonb(current_count));
   end if;
  end loop;
  update eldervale_private.player_quests set progress=q.progress where user_id=uid and quest_id=q.quest_id;
 end loop;
end $$;
-- Only authoritative combat and proximity-checked interaction events count.
create or replace function eldervale_private.emit(data jsonb) returns void language plpgsql set search_path='' as $$
begin
 insert into eldervale_private.realm_events(data) values(data);
 perform eldervale_private.quest_event(data);
end $$;
alter function eldervale_private.admin_action(text,jsonb) rename to admin_before_quests;
create function eldervale_private.admin_action(command text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb;old jsonb;qid uuid;result jsonb;o jsonb;k text;v jsonb;
begin
 if command not in ('quest_list','quest_save','quest_archive') then return eldervale_private.admin_before_quests(command,payload);end if;
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if command='quest_list' then return (select coalesce(jsonb_agg(to_jsonb(q) order by updated_at desc),'[]') from eldervale_private.quest_definitions q);end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>20000 then raise exception 'Quest is too large';end if;
 qid:=coalesce((payload->>'id')::uuid,gen_random_uuid());select data into old from eldervale_private.quest_definitions where id=qid for update;
 if command='quest_archive' then
  if old is null then raise exception 'Quest not found';end if;d:=old||'{"published":false}';
 else
  d:=payload->'data';
  if coalesce(jsonb_typeof(d),'null')<>'object' or length(coalesce(d->>'name','')) not between 2 and 80 or length(coalesce(d->>'description','')) not between 1 and 2000 then raise exception 'Quest needs a name and description';end if;
  if not exists(select 1 from eldervale_private.realm_actors where id=d->>'giver' and not deleted and data->>'kind'='npc') then raise exception 'Choose an existing NPC as quest giver';end if;
  if coalesce(jsonb_typeof(d->'objectives'),'null')<>'array' or jsonb_array_length(d->'objectives') not between 1 and 8 then raise exception 'Choose 1–8 objectives';end if;
  for o in select value from jsonb_array_elements(d->'objectives') loop
   if coalesce(o->>'type','') not in ('collect','talk','kill') or coalesce((o->>'amount')::integer,0) not between 1 and 1000 then raise exception 'Invalid objective type or quantity';end if;
   if o->>'type'='collect' then
    if not exists(select 1 from eldervale_private.realm_catalog where id='item:'||(o->>'target') and not data?'noteOf') or o->>'target'='gold' then raise exception 'Choose an original item to collect';end if;
   elsif not exists(select 1 from eldervale_private.realm_actors where id=o->>'target' and not deleted and (o->>'type'='talk' and data->>'kind'='npc' or o->>'type'='kill' and coalesce((data->>'attackable')::boolean,false))) then raise exception 'Choose a valid talk NPC or attackable enemy';
   end if;
  end loop;
  -- Duplicate collection objectives would otherwise count the same inventory twice.
  if exists(select 1 from jsonb_array_elements(d->'objectives') as objective(value) where objective.value->>'type'='collect' group by objective.value->>'target' having count(*)>1) then raise exception 'Combine duplicate item objectives';end if;
  if coalesce((d->>'gold')::integer,0) not between 0 and 1000000 or jsonb_typeof(coalesce(d->'items','{}'))<>'object' or jsonb_typeof(coalesce(d->'xp','{}'))<>'object' then raise exception 'Invalid rewards';end if;
  if (select count(*) from jsonb_object_keys(coalesce(d->'items','{}')))>8 then raise exception 'Up to eight item rewards';end if;
  for k,v in select key,value from jsonb_each(coalesce(d->'items','{}')) loop
   if not exists(select 1 from eldervale_private.realm_catalog where id='item:'||k and not data?'noteOf') or k='gold' or coalesce((v#>>'{}')::integer,0) not between 1 and 1000 then raise exception 'Invalid item reward';end if;
  end loop;
  for k,v in select key,value from jsonb_each(coalesce(d->'xp','{}')) loop
   if k not in ('attack','strength','defence','mining','woodcutting','fishing','cooking','smithing','crafting','firemaking','fletching','herblore','farming','runecrafting','construction','hunter','agility','thieving') or coalesce((v#>>'{}')::integer,0) not between 1 and 100000 then raise exception 'Invalid XP reward';end if;
  end loop;
  d:=d||jsonb_build_object('published',coalesce((d->>'published')::boolean,false));
 end if;
 insert into eldervale_private.quest_definitions(id,data) values(qid,d) on conflict(id) do update set data=excluded.data,version=quest_definitions.version+1,updated_at=now() returning to_jsonb(quest_definitions) into result;
 insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,qid::text,old,result);
 return result;
end $$;
alter function eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) rename to realm_request_before_quests;
create function eldervale_private.realm_request(session_id uuid,command text default 'sync',payload jsonb default '{}',request_id uuid default null,event_cursor bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;p eldervale_private.realm_players;q eldervale_private.quest_definitions;active eldervale_private.player_quests;d jsonb;o jsonb;i integer;k text;v jsonb;amount integer;
begin
 if command not in ('quest_accept','quest_complete') then
  result:=eldervale_private.realm_request_before_quests($1,$2,$3,$4,$5);
 else
  result:=eldervale_private.realm_request_before_quests($1,'sync','{}',null,$5);
  perform pg_advisory_xact_lock(736211);
  if request_id is null or payload is null or pg_column_size(payload)>1000 then raise exception 'Invalid quest request';end if;
  select * into p from eldervale_private.realm_players where user_id=auth.uid() and realm_players.session_id=$1 for update;if not found then raise exception 'Session expired';end if;
  if exists(select 1 from eldervale_private.realm_requests r where r.user_id=auth.uid() and r.request_id=$4) then return result||jsonb_build_object('quests',eldervale_private.quest_snapshot(auth.uid()));end if;
  select * into q from eldervale_private.quest_definitions where id=(payload->>'id')::uuid for share;if not found then raise exception 'Quest not found';end if;
  select * into active from eldervale_private.player_quests where user_id=auth.uid() and quest_id=q.id for update;
  d:=coalesce(active.data,q.data);
  if not exists(select 1 from eldervale_private.realm_actors where id=d->>'giver' and not deleted and hp>0 and sqrt(power(x-p.x,2)+power(z-p.z,2))<6) then raise exception 'Return to the quest giver';end if;
  if active.completed_at is not null then raise exception 'Quest already completed';end if;
  perform 1 from public.player_saves where user_id=auth.uid() for update;
  if command='quest_accept' then
   if active.user_id is not null then raise exception 'Quest already accepted';end if;
   if not coalesce((q.data->>'published')::boolean,false) then raise exception 'Quest unavailable';end if;
   insert into eldervale_private.player_quests(user_id,quest_id,version,data) values(auth.uid(),q.id,q.version,q.data);
  else
   if active.user_id is null then raise exception 'Accept this quest first';end if;
   i:=0;
   for o in select value from jsonb_array_elements(d->'objectives') loop
    amount:=case when o->>'type'='collect' then greatest(0,eldervale_private.item_quantity(auth.uid(),o->>'target')-eldervale_private.equipment_reserved(auth.uid(),(select data from eldervale_private.realm_catalog where id='item:'||(o->>'target')))) else coalesce((active.progress->>i::text)::integer,0) end;
    if amount<(o->>'amount')::integer then raise exception 'Finish every objective before returning';end if;i:=i+1;
   end loop;
   for o in select value from jsonb_array_elements(d->'objectives') where value->>'type'='collect' loop perform eldervale_private.item_change(auth.uid(),o->>'target',-(o->>'amount')::integer);end loop;
   for k,v in select key,value from jsonb_each(coalesce(d->'items','{}')) loop perform eldervale_private.item_change(auth.uid(),k,(v#>>'{}')::integer);end loop;
   if eldervale_private.inventory_used(auth.uid())>16 then raise exception 'Make inventory space for the rewards';end if;
   perform eldervale_private.item_change(auth.uid(),'gold',coalesce((d->>'gold')::integer,0));
   for k,v in select key,value from jsonb_each(coalesce(d->'xp','{}')) loop perform eldervale_private.skill_xp(auth.uid(),k,(v#>>'{}')::integer);end loop;
   update eldervale_private.player_quests set completed_at=now() where user_id=auth.uid() and quest_id=q.id;
  end if;
  insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),$4,'{}');
  update eldervale_private.realm_players set last_command=clock_timestamp() where user_id=auth.uid();
  result:=eldervale_private.realm_request_before_quests($1,'sync','{}',null,$5);
 end if;
 return result||jsonb_build_object('quests',eldervale_private.quest_snapshot(auth.uid()));
end $$;
revoke all on function eldervale_private.quest_snapshot(uuid),eldervale_private.quest_event(jsonb),eldervale_private.admin_action(text,jsonb),eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) from public,anon,authenticated;

-- Public SQL RPCs invoke these checked entry points as the authenticated role.
grant execute on function eldervale_private.admin_action(text,jsonb),eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint) to authenticated;
