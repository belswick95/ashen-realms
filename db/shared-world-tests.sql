-- Run as the database migration owner. Every mutation is rolled back.
begin;
revoke insert,update,delete on public.player_saves from authenticated;
select set_config('request.jwt.claim.sub','91c5b7f0-7018-4290-a190-c2bba0ca492d',true);
update eldervale_private.realm_clock set enabled=true,tick_at=clock_timestamp()-interval '.25 seconds';
do $$declare e jsonb;sid uuid;ax float8;az float8;begin
 e:=public.world_enter();sid:=(e->>'session')::uuid;
 select x,z into ax,az from eldervale_private.realm_actors where id='base:creature:0';
 update eldervale_private.realm_players set x=ax+1,z=az,path='[]' where user_id=auth.uid();
 update eldervale_private.realm_actors set target=auth.uid(),phase='ready',turn='player' where id='base:creature:0';
 update eldervale_private.realm_clock set tick_at=clock_timestamp()-interval '.25 seconds';perform eldervale_private.world_tick();
 if (select phase from eldervale_private.realm_actors where id='base:creature:0')<>'windup' then raise exception 'No windup';end if;
 update eldervale_private.realm_actors set due_at=clock_timestamp()-interval '1 second' where id='base:creature:0';
 update eldervale_private.realm_clock set tick_at=clock_timestamp()-interval '.25 seconds';perform eldervale_private.world_tick();
 if not exists(select 1 from eldervale_private.realm_events where data->>'type'='hit') then raise exception 'No shared hit event';end if;
end $$;
set local role authenticated;
do $$declare one jsonb;two jsonb;a jsonb;b jsonb;ahp integer;bhp integer;begin
 one:=public.world_enter();a:=public.world_command((one->>'session')::uuid);
 perform set_config('request.jwt.claim.sub','bc85408f-9f7d-4820-8208-8e0ab56324a0',true);
 two:=public.world_enter();b:=public.world_command((two->>'session')::uuid);
 select (value->>'hp')::integer into ahp from jsonb_array_elements(a->'actors') where value->>'id'='base:creature:0';
 select (value->>'hp')::integer into bhp from jsonb_array_elements(b->'actors') where value->>'id'='base:creature:0';
 if ahp is null or bhp is null or ahp<>bhp then raise exception 'Shared actor health differs';end if;
 begin perform public.world_command((one->>'session')::uuid);raise exception 'Foreign session succeeded';exception when insufficient_privilege then null;end;
 begin update public.player_saves set gold=999999 where user_id=auth.uid();raise exception 'Forged save succeeded';exception when insufficient_privilege then null;end;
 begin perform eldervale_private.world_tick();raise exception 'Direct tick call succeeded';exception when insufficient_privilege then null;end;
end $$;
rollback;
