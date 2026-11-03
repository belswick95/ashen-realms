-- The original realm is archived before replacement. Player saves and owner-built castle remain intact.
create table eldervale_private.world_generations(seed bigint primary key,manifest jsonb not null);
create table eldervale_private.world_archives(name text primary key,data jsonb not null,created_at timestamptz not null default now());
alter table eldervale_private.world_generations enable row level security;
alter table eldervale_private.world_archives enable row level security;
create policy rpc_only on eldervale_private.world_archives to authenticated using(false) with check(false);
create policy rpc_only on eldervale_private.world_generations to authenticated using(false) with check(false);
revoke all on eldervale_private.world_generations,eldervale_private.world_archives from public,anon,authenticated;
create function eldervale_private.activate_generated_world(world_seed bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare m jsonb;rev bigint;existing jsonb;
begin
 if eldervale_private.staff_role() is distinct from 'owner' then raise exception 'Only the owner can replace world generation' using errcode='42501';end if;
 perform pg_advisory_xact_lock(736211);
 select manifest into m from eldervale_private.world_generations where seed=world_seed;
 if m is null then raise exception 'World generation has not been prepared and validated';end if;
 if (select world_config->>'seed' from eldervale_private.settings where id)=world_seed::text then raise exception 'This world seed is already active';end if;
 insert into eldervale_private.world_archives(name,data) values('before-seed-'||world_seed,jsonb_build_object('objects',(select jsonb_agg(to_jsonb(o)) from eldervale_private.realm_objects o),'actors',(select jsonb_agg(to_jsonb(a)) from eldervale_private.realm_actors a),'water',(select jsonb_agg(to_jsonb(w)) from eldervale_private.realm_water w),'towns',(select jsonb_agg(to_jsonb(z)) from eldervale_private.town_zones z),'settings',(select to_jsonb(s) from eldervale_private.settings s where id),'entities',(select jsonb_agg(to_jsonb(e)) from eldervale_private.entities e))) on conflict(name) do nothing;
 update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
 update eldervale_private.entities set deleted=true,revision=rev where not deleted and (coalesce((data->>'townDefender')::boolean,false) or data->>'generation'='seeded-world-v2');
 delete from eldervale_private.guard_duels;
 delete from eldervale_private.realm_objects where id like 'base:%';
 update eldervale_private.realm_actors set deleted=true,target=null where id like 'base:%';
 delete from eldervale_private.realm_water;
 insert into eldervale_private.realm_water(outline,passable) select (w->>'outline')::polygon,(w->>'passable')::boolean from jsonb_array_elements(m->'waters') w;
 delete from eldervale_private.town_zones where not square;
 insert into eldervale_private.town_zones(id,x,z,radius,square) select t->>'name',(t->>'x')::float8,(t->>'z')::float8,44,false from jsonb_array_elements(m->'towns') t;
 insert into eldervale_private.entities(revision,data) select rev,e from jsonb_array_elements(m->'entities') e;
 insert into eldervale_private.realm_objects(id,kind,x,z,data) select r->>'id',r->>'kind',(r->>'x')::float8,(r->>'z')::float8,r->'data' from jsonb_array_elements(m->'resources') r;
 update eldervale_private.settings set world_config=m->'config',spawn_x=(m->'spawn'->>'x')::float8,spawn_z=(m->'spawn'->>'z')::float8,restart_at=clock_timestamp()+interval '30 seconds',announcement='The new regions are ready. Reconnecting in 30 seconds.',announcement_until=clock_timestamp()+interval '2 minutes' where id;
 -- Keep position in the preserved castle; start everyone else at the new, accessible settlement entrance.
 update eldervale_private.realm_players set x=(m->'spawn'->>'x')::float8,z=(m->'spawn'->>'z')::float8,path='[]',intent=null,input_until=null where not(abs(x+340)<70 and abs(z+305)<70);
 update public.player_saves s set world_position=s.world_position||jsonb_build_object('x',p.x,'y',p.z) from eldervale_private.realm_players p where p.user_id=s.user_id;
 update public.player_saves set world_position=world_position||jsonb_build_object('x',(m->'spawn'->>'x')::float8,'y',(m->'spawn'->>'z')::float8) where not exists(select 1 from eldervale_private.realm_players p where p.user_id=player_saves.user_id) and not(abs(coalesce((world_position->>'x')::float8,0)+340)<70 and abs(coalesce((world_position->>'y')::float8,0)+305)<70);
 insert into eldervale_private.audit(actor,action,target,after_data) values(auth.uid(),'activate_generated_world',world_seed::text,jsonb_build_object('seed',world_seed,'archive','before-seed-'||world_seed,'entities',jsonb_array_length(m->'entities')));
 return jsonb_build_object('seed',world_seed,'entities',jsonb_array_length(m->'entities'),'resources',jsonb_array_length(m->'resources'));
end $$;
revoke all on function eldervale_private.activate_generated_world(bigint) from public,anon,authenticated;
