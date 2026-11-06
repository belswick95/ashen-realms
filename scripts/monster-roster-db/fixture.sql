-- Test-only additions on top of scripts/equipment-combat-db/fixture.sql (and its migration) so
-- db/monster-roster.sql runs against live-like functions. entity_runtime, item_change, skill_xp
-- and realm_request_services are copied from the live database (read-only); the castle request
-- layer below services is a small stand-in.
create role anon;create role authenticated;
alter table eldervale_private.realm_actors add column x float8, add column z float8, add column deleted boolean default false, add column roam_x float8, add column roam_z float8, add column roam_pause_until timestamptz, add column respawn_at timestamptz;
alter table eldervale_private.realm_players add column x float8 default 0, add column z float8 default 0, add column floor integer default 0, add column consume_at timestamptz;
alter table eldervale_private.entities add column created_at timestamptz default now();
create table eldervale_private.realm_requests(user_id uuid,request_id uuid,result jsonb,created_at timestamptz default now(),primary key(user_id,request_id));
create table eldervale_private.realm_objects(id text primary key,kind text,x float8,z float8,data jsonb,open boolean default false,available_at timestamptz);
create table eldervale_private.events(n serial,data jsonb);
create function eldervale_private.allowed() returns boolean language sql stable as $$select auth.uid() is not null$$;
create function eldervale_private.emit(d jsonb) returns void language sql as $$insert into eldervale_private.events(data) values(d)$$;
create function eldervale_private.realm_request_before_castle(session_id uuid,command text,payload jsonb,request_id uuid,event_cursor bigint) returns jsonb language sql as $$select '{"synced":true}'::jsonb$$;
CREATE OR REPLACE FUNCTION eldervale_private.entity_runtime()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$declare d jsonb:=new.data;begin
 if d->>'kind' in ('npc','monster') then
  d:=d||jsonb_build_object('hp',greatest(1,coalesce((d->>'hp')::integer,45)),'level',greatest(1,least(100,coalesce((d->>'level')::integer,1))),'attackLevel',greatest(1,least(100,coalesce((d->>'level')::integer,1))),'defenceLevel',greatest(1,least(100,coalesce((d->>'level')::integer,1))),'strengthLevel',greatest(1,least(100,coalesce((d->>'level')::integer,1))));
  insert into eldervale_private.realm_actors(id,data,x,z,hp,deleted) values(new.id::text,d,(d->>'x')::float8,(d->>'z')::float8,(d->>'hp')::integer,new.deleted) on conflict(id) do update set data=excluded.data,x=excluded.x,z=excluded.z,hp=excluded.hp,deleted=excluded.deleted,roam_x=null,roam_z=null,roam_pause_until=null,target=null,phase='ready',respawn_at=null;
 else
  if new.deleted then delete from eldervale_private.realm_objects where id=new.id::text;
  else insert into eldervale_private.realm_objects(id,kind,x,z,data) values(new.id::text,case when d->>'template'='castle_gate' then 'castle_gate' when d->>'template'='fishing_spot' then 'fishing' when d->>'template' in ('cottage','bank','inn','forge') then 'door' when d->>'template' in ('tree','pine') then 'tree' when d->>'template'='rock' then 'rock' when d->>'template'='market' then 'merchant' else d->>'kind' end,(d->>'x')::float8,(d->>'z')::float8,d||jsonb_build_object('type',d->>'template','scaleX',1.3*coalesce((d->>'scale')::float8,1),'scaleZ',1.3*coalesce((d->>'scale')::float8,1),'yaw',coalesce((d->>'yaw')::float8,0)*pi()/180)) on conflict(id) do update set data=excluded.data,x=excluded.x,z=excluded.z;end if;
 end if;
 delete from eldervale_private.shop_stock where merchant=new.id::text;
 if not new.deleted then insert into eldervale_private.shop_stock(merchant,item,buy,sell,stock) select new.id::text,key,(value->>'buy')::integer,(value->>'sell')::integer,(value->>'stock')::integer from jsonb_each(coalesce(d->'shop','{}'));end if;
 return new;
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.skill_xp(uid uuid, skill text, amount numeric)
 RETURNS void
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare key text;
begin
 if coalesce(amount,0)=0 or uid is null or skill is null then return;end if;
 key:=case skill when 'woodcutting' then 'woodXP' else skill||'XP' end;
 if skill in('mining','woodcutting') then
  update public.player_saves set stats=stats||jsonb_build_object(key,trim_scale(greatest(0,least(200000000,round(coalesce((stats->>key)::numeric,0)+amount,2))))) where user_id=uid;
 else
  update public.player_saves set skills=skills||jsonb_build_object(key,trim_scale(greatest(0,least(200000000,round(coalesce((skills->>key)::numeric,0)+amount,2))))) where user_id=uid;
 end if;
end $function$;
-- item_change as live, for items without an equipment field (stacks live in stats).
CREATE OR REPLACE FUNCTION eldervale_private.item_change(uid uuid, item text, amount integer, bank boolean DEFAULT false)
 RETURNS void LANGUAGE plpgsql SET search_path TO '' AS $function$
declare s public.player_saves;c jsonb;n integer;
begin
 select * into s from public.player_saves where user_id=uid for update;
 if s.user_id is null then raise exception 'Character not found';end if;
 select data into c from eldervale_private.realm_catalog where id='item:'||item;if c is null then raise exception 'Unknown item';end if;
 if c->>'field' is not null then raise exception 'fixture: equipment items not supported';end if;
 n:=coalesce((s.stats->>item)::integer,0)+amount;if n<0 or n>1000000000 then raise exception 'Not enough items or stack limit reached';end if;s.stats:=s.stats||jsonb_build_object(item,n);
 update public.player_saves set stats=s.stats,inventory=s.inventory where user_id=uid;
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.realm_request_services(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
    update public.player_saves set stats=stats||jsonb_build_object('prayerPoints',eldervale_private.xp_level((skills->>'prayerXP')::numeric)),skills=jsonb_set(skills,'{prayerXP}',to_jsonb(coalesce((skills->>'prayerXP')::numeric,0)+5)) where user_id=auth.uid();
    perform eldervale_private.emit(jsonb_build_object('type','notice','player',auth.uid(),'text','You pray at the altar. Prayer restored. +5 Prayer XP.'));
   else
    perform eldervale_private.item_change(auth.uid(),'rawFish',-1);update public.player_saves set health=least(max_health,health+12),skills=jsonb_set(skills,'{cookingXP}',to_jsonb(coalesce((skills->>'cookingXP')::numeric,0)+40)) where user_id=auth.uid();
    perform eldervale_private.emit(jsonb_build_object('type','notice','player',auth.uid(),'text','You cook and eat your fish. +12 HP, +40 Cooking XP.'));
   end if;
   update eldervale_private.realm_objects set available_at=clock_timestamp()+interval '3 seconds' where id=o.id;
   insert into eldervale_private.realm_requests(user_id,request_id,result) values(auth.uid(),request_id,'{}');
  end if;
  result:=eldervale_private.realm_request_before_castle(session_id,'sync','{}',null,event_cursor);
 else result:=eldervale_private.realm_request_before_castle(session_id,command,payload,request_id,event_cursor);end if;
 return result||jsonb_build_object('removedActors',(select coalesce(jsonb_agg(id),'[]') from eldervale_private.realm_actors where deleted),'gates',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'open',open)),'[]') from eldervale_private.realm_objects where kind='castle_gate'));
end $function$;
