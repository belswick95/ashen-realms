-- Rollback-only integration tests. No test position, inventory or actor changes persist.
select set_config('request.jwt.claim.sub','91c5b7f0-7018-4290-a190-c2bba0ca492d',true);
select set_config('request.jwt.claims','{"sub":"91c5b7f0-7018-4290-a190-c2bba0ca492d","role":"authenticated"}',true);
do $checks$ declare uid uuid:=auth.uid();sid uuid;px float8;pz float8;start_x float8;start_z float8;found_spot boolean:=false;mounted_distance float8;walk_distance float8;n integer;i integer;result jsonb;b jsonb;
begin
 select session_id into sid from eldervale_private.realm_players where user_id=uid;if sid is null then raise exception 'Existing owner session required';end if;
 update public.player_saves set health=100,stats='{}',inventory='{"mountsOwned":[],"armorOwned":[],"weaponsOwned":[],"shieldsOwned":[],"jewelryOwned":[],"bank":{}}',equipment='{}' where user_id=uid;
 update eldervale_private.realm_actors set target=null where target=uid;delete from eldervale_private.gathering_actions where user_id=uid;
 for n in 1..200 loop
  px:=-180+(n%20)*16;pz:=100+floor(n/20)*8;
  if eldervale_private.mount_allowed(px,pz) and eldervale_private.mount_allowed(px+11,pz) and eldervale_private.can_step(px,pz,px+11,pz) then
   found_spot:=true;for i in 0..73 loop if not eldervale_private.can_step(px+i*.15,pz,px+(i+1)*.15,pz) then found_spot:=false;exit;end if;end loop;
   if found_spot then exit;end if;
  end if;
 end loop;if not found_spot then raise exception 'No clear test strip';end if;
 update eldervale_private.realm_players set x=px,z=pz,last_seen=clock_timestamp(),last_command=clock_timestamp()-interval '1 second',input_until=null,path='[]',intent=null,energy=0,run=false where user_id=uid;
 begin perform public.world_command(sid,'equip','{"slot":"mount","key":"armoredWhiteHorse"}',gen_random_uuid());raise exception 'Unowned mount accepted';exception when others then if sqlerrm='Unowned mount accepted' then raise;end if;end;
 update public.player_saves set inventory=jsonb_set(inventory,'{mountsOwned}','["armoredWhiteHorse"]') where user_id=uid;
 result:=public.world_command(sid,'equip','{"slot":"mount","key":"armoredWhiteHorse"}',gen_random_uuid());
 if not(result->'motion'->>'mounted')::boolean then raise exception 'Owned outdoor mount not active';end if;
 if eldervale_private.inventory_used(uid)<>0 or not eldervale_private.item_worn(uid,'mount:armoredWhiteHorse') then raise exception 'Mounted item inventory/worn mismatch';end if;
 -- Horse travels 9.6 m/s with zero run energy; ordinary walk remains 3.2 m/s.
 update eldervale_private.realm_players set x=px,z=pz,path=jsonb_build_array(jsonb_build_array(px+10,pz)),input_until=null,energy=0,run=true where user_id=uid;
 update eldervale_private.realm_clock set tick_at=clock_timestamp()-interval '.5 seconds' where id;
 perform eldervale_private.world_tick();select x-px into mounted_distance from eldervale_private.realm_players where user_id=uid;
 if mounted_distance not between 4.79 and 4.90 or (select energy from eldervale_private.realm_players where user_id=uid)<>0 then raise exception 'Mounted speed/energy incorrect: %',mounted_distance;end if;
 update public.player_saves set equipment='{}' where user_id=uid;
 update eldervale_private.realm_players set x=px,z=pz,path=jsonb_build_array(jsonb_build_array(px+10,pz)),run=false where user_id=uid;
 update eldervale_private.realm_clock set tick_at=clock_timestamp()-interval '.5 seconds' where id;perform eldervale_private.world_tick();select x-px into walk_distance from eldervale_private.realm_players where user_id=uid;
 if walk_distance not between 1.59 and 1.64 or mounted_distance/walk_distance not between 2.95 and 3.05 then raise exception 'Walk/mount speed regression: %, %',walk_distance,mounted_distance;end if;
 update public.player_saves set equipment='{"mount":"armoredWhiteHorse"}' where user_id=uid;
 if eldervale_private.mounted(uid,-340,-305) or eldervale_private.mount_allowed(-340,-305) then raise exception 'Mount allowed in castle';end if;
 select data into b from eldervale_private.entities where not deleted and data->>'template' in('bank','cottage','inn','forge') limit 1;
 if eldervale_private.mount_allowed((b->>'x')::float8,(b->>'z')::float8) then raise exception 'Mount allowed in building';end if;
 insert into eldervale_private.gathering_actions(user_id,target,method,due_at) values(uid,'test:mount:resource','woodcut',clock_timestamp()+interval '10 seconds');
 if eldervale_private.mounted(uid,px,pz) then raise exception 'Gathering mount stayed active';end if;delete from eldervale_private.gathering_actions where user_id=uid;
 update public.player_saves set stats='{"wood":16}' where user_id=uid;update eldervale_private.realm_players set last_command=clock_timestamp()-interval '1 second' where user_id=uid;
 begin perform public.world_command(sid,'equip','{"slot":"mount","key":"armoredWhiteHorse"}',gen_random_uuid());raise exception 'Full inventory mount removal accepted';exception when others then if sqlerrm='Full inventory mount removal accepted' then raise;end if;end;
 perform set_config('test.realm_session',sid::text,true);
end $checks$;
set local role authenticated;
select public.world_command(current_setting('test.realm_session')::uuid,'sync') ? 'gathering' as authenticated_mount_entry_works;
reset role;
select 'PASS ownership, equipment slots, triple speed, zero energy, castle/building/gathering restrictions and authenticated RPC' as result;
