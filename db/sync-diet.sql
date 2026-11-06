-- Sync diet: smaller world replies for clients that ask for them.
--
-- Every world_command reply carried the whole picture (~145 KB: shops 46 KB,
-- actors 58 KB, quests 14 KB, objects 6.5 KB, ...) and the client asks about
-- three times a second, so an iPad parsed ~400 KB of JSON a second and spent
-- its frames collecting garbage. world_snapshot (every 4 s) re-sent 50 KB of
-- profession recipes each time.
--
-- New RPCs wrap the existing ones without changing them, so old cached
-- clients keep calling world_command / world_snapshot and get the same replies:
--  * public.world_command_lean(..., have jsonb)
--     - heavy keys (shops, quests, objects, ...) carry an md5 digest; a key whose
--       digest the client already holds is left out of the reply;
--     - actors are sent as a delta (changed rows + ids gone) against one of the
--       client's last three acknowledged actor states (token), or in full.
--  * public.world_snapshot_lean(cursor_revision, have jsonb): same digests for
--    professions, catalog, catalogOverrides, removedActors and gameConfig.
-- Idempotent: create-if-missing table, create or replace functions.

create table if not exists eldervale_private.sync_diet(
 user_id uuid primary key,
 -- token -> {actor id: short digest}, newest three tokens only
 states jsonb not null default '{}'::jsonb,
 updated_at timestamptz not null default now()
);
revoke all on table eldervale_private.sync_diet from public;
revoke all on table eldervale_private.sync_diet from anon, authenticated;

-- Leave out every listed key whose digest the client already has; always
-- report the digests of the keys present in the full reply.
create or replace function eldervale_private.diet_reply(full_reply jsonb,have jsonb,keys text[])
returns jsonb language plpgsql immutable set search_path to '' as $function$
declare r jsonb:=full_reply;digests jsonb:='{}'::jsonb;k text;digest text;
begin
 if r is null or jsonb_typeof(r)<>'object' then return r;end if;
 if have is null or jsonb_typeof(have)<>'object' then have:='{}'::jsonb;end if;
 foreach k in array keys loop
  if r ? k then
   digest:=md5((r->k)::text);digests:=digests||jsonb_build_object(k,digest);
   if have->>k=digest then r:=r-k;end if;
  end if;
 end loop;
 return r||jsonb_build_object('digests',digests);
end $function$;

-- Actor rows as a delta against a state the client acknowledged (its token).
-- The client applies a delta only when actorsBase is the token it holds, so a
-- lost, reordered or ignored reply just leads to a full list next time.
create or replace function eldervale_private.diet_actors(uid uuid,full_reply jsonb,have jsonb)
returns jsonb language plpgsql set search_path to '' as $function$
declare r jsonb:=full_reply;cur jsonb;base jsonb;known jsonb;changed jsonb;gone jsonb;token text;base_token text;
begin
 if uid is null or r is null or jsonb_typeof(r->'actors') is distinct from 'array' then return r;end if;
 select coalesce(jsonb_object_agg(e->>'id',left(md5(e::text),12)),'{}'::jsonb) into cur from jsonb_array_elements(r->'actors') e;
 select d.states into known from eldervale_private.sync_diet d where d.user_id=uid for update;
 known:=coalesce(known,'{}'::jsonb);
 base_token:=have->>'actorsToken';
 if base_token is not null and known ? base_token then base:=known->base_token;end if;
 token:=md5(random()::text||clock_timestamp()::text);token:=left(token,16);
 if base is not null then
  select coalesce(jsonb_agg(e),'[]'::jsonb) into changed from jsonb_array_elements(r->'actors') e where base->>(e->>'id') is distinct from left(md5(e::text),12);
  select coalesce(jsonb_agg(k),'[]'::jsonb) into gone from jsonb_object_keys(base) k where k<>'_at' and not cur ? k;
  r:=r||jsonb_build_object('actors',changed,'actorsGone',gone,'actorsBase',base_token);
 end if;
 -- Keep the three newest states (each tagged with its time) for concurrent requests.
 known:=(select coalesce(jsonb_object_agg(s.key,s.value),'{}'::jsonb) from (select key,value from jsonb_each(known) order by (value->>'_at') desc nulls last limit 2) s)
  ||jsonb_build_object(token,cur||jsonb_build_object('_at',to_char(clock_timestamp(),'YYYYMMDDHH24MISSUS')));
 insert into eldervale_private.sync_diet(user_id,states,updated_at) values(uid,known,now())
  on conflict (user_id) do update set states=excluded.states,updated_at=excluded.updated_at;
 return r||jsonb_build_object('actorsToken',token);
end $function$;

create or replace function public.world_command_lean(session_id uuid,command text default 'sync',payload jsonb default '{}'::jsonb,request_id uuid default null,event_cursor bigint default 0,have jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $function$
declare r jsonb;
begin
 r:=eldervale_private.realm_request(session_id,command,payload,request_id,event_cursor);
 if r is null or r ? 'reset' then return r;end if;
 if have is null or jsonb_typeof(have)<>'object' or pg_column_size(have)>4000 then have:='{}'::jsonb;end if;
 r:=eldervale_private.diet_actors(auth.uid(),r,have);
 return eldervale_private.diet_reply(r,have,array['shops','quests','tutorial','objects','removedActors','gates','playerFloors','skillCrops','skillFires','npcDuels','gathering','professionJobs','trade']);
end $function$;

create or replace function public.world_snapshot_lean(cursor_revision bigint default -1,have jsonb default '{}'::jsonb)
returns jsonb language plpgsql security definer set search_path to '' as $function$
begin
 if have is null or jsonb_typeof(have)<>'object' or pg_column_size(have)>4000 then have:='{}'::jsonb;end if;
 return eldervale_private.diet_reply(eldervale_private.snapshot(cursor_revision),have,array['professions','catalog','catalogOverrides','removedActors','gameConfig']);
end $function$;

revoke all on function eldervale_private.diet_reply(jsonb,jsonb,text[]) from public;
revoke all on function eldervale_private.diet_actors(uuid,jsonb,jsonb) from public;
revoke all on function public.world_command_lean(uuid,text,jsonb,uuid,bigint,jsonb) from public;
revoke all on function public.world_command_lean(uuid,text,jsonb,uuid,bigint,jsonb) from anon;
grant execute on function public.world_command_lean(uuid,text,jsonb,uuid,bigint,jsonb) to authenticated;
revoke all on function public.world_snapshot_lean(bigint,jsonb) from public;
revoke all on function public.world_snapshot_lean(bigint,jsonb) from anon;
grant execute on function public.world_snapshot_lean(bigint,jsonb) to authenticated;
notify pgrst,'reload schema';
