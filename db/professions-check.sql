begin;
select set_config('request.jwt.claim.sub','91c5b7f0-7018-4290-a190-c2bba0ca492d',true);
select set_config('request.jwt.claims','{"sub":"91c5b7f0-7018-4290-a190-c2bba0ca492d","role":"authenticated"}',true);
select set_config('test.realm_session',(select session_id::text from eldervale_private.realm_players where user_id=auth.uid()),true);
set local role authenticated;
select public.world_command(current_setting('test.realm_session')::uuid,'sync') ? 'professionJobs' as authenticated_entry_works;
reset role;
do $$declare uid uuid:=auth.uid();sid uuid;r jsonb;problem text;n integer;drop_id uuid;fire_id uuid;rid uuid;result jsonb;failed boolean;
begin
 select session_id into sid from eldervale_private.realm_players where user_id=uid;
 update eldervale_private.realm_players set x=-260,z=-280,last_seen=clock_timestamp(),last_command=clock_timestamp()-interval '1 second',input_until=null,input_x=0,input_z=0,path='[]',intent=null where user_id=uid;
 update eldervale_private.realm_actors set target=null where target=uid;
 delete from eldervale_private.gathering_actions where user_id=uid;delete from eldervale_private.skill_jobs where user_id=uid;
 update public.player_saves set health=100,stats='{"miningXP":500000,"woodXP":500000}',skills='{"smithingXP":500000,"firemakingXP":500000,"cookingXP":500000,"craftingXP":500000,"fletchingXP":500000,"herbloreXP":500000,"farmingXP":500000,"runecraftingXP":500000,"constructionXP":500000,"hunterXP":500000,"agilityXP":500000,"thievingXP":500000}',inventory='{"bank":{},"armorOwned":[],"weaponsOwned":[],"shieldsOwned":[],"jewelryOwned":[],"mountsOwned":[]}',equipment='{}' where user_id=uid;
 insert into eldervale_private.realm_objects(id,kind,x,z,data) values('test:prof:rock','rock',-257,-280,'{"template":"rock","resource":"copperOre"}'),('test:prof:furnace','object',-257,-280,'{"template":"furnace"}'),('test:prof:anvil','object',-257,-280,'{"template":"anvil"}'),('test:prof:patch','object',-257,-280,'{"template":"farming_patch"}');
 select data into r from eldervale_private.skill_recipes where id='mine_copperOre';problem:=eldervale_private.skill_error(uid,r,'test:prof:rock');if problem not like '%tool%' then raise exception 'Missing pickaxe accepted: %',problem;end if;
 update public.player_saves set inventory=jsonb_set(inventory,'{weaponsOwned}','["pickaxe"]') where user_id=uid;
 perform eldervale_private.skill_finish(uid,r,'test:prof:rock',null,clock_timestamp());if eldervale_private.item_quantity(uid,'copperOre')<>1 then raise exception 'Mining did not award copper';end if;
 if eldervale_private.skill_error(uid,r,'test:prof:rock') not like '%depleted%' then raise exception 'Rock did not deplete';end if;
 perform eldervale_private.item_change(uid,'tinOre',1);select data into r from eldervale_private.skill_recipes where id='smelt_bronzeBar';
 perform eldervale_private.skill_finish(uid,r,'test:prof:furnace',null,clock_timestamp());if eldervale_private.item_quantity(uid,'bronzeBar')<>1 or eldervale_private.item_quantity(uid,'copperOre')<>0 then raise exception 'Smelting failed conservation';end if;
 select data into r from eldervale_private.skill_recipes where id='forge_nails';if eldervale_private.skill_error(uid,r,'test:prof:anvil') not like '%tool%' then raise exception 'Missing hammer accepted';end if;
 perform eldervale_private.item_change(uid,'hammer',1);perform eldervale_private.skill_finish(uid,r,'test:prof:anvil',null,clock_timestamp());if eldervale_private.item_quantity(uid,'nails')<>15 then raise exception 'Smithing did not make 15 nails';end if;
 if exists(select 1 from eldervale_private.realm_catalog where id='item:hammer' and data?'field') then raise exception 'Hammer became wieldable';end if;
 result:=eldervale_private.admin_action('give','{"item":"ironBar","amount":1}');if eldervale_private.item_quantity(uid,'ironBar')<>1 or (select coalesce((inventory->'bank'->>'ironBar')::integer,0) from public.player_saves where user_id=uid)<>0 then raise exception 'Owner grant went to bank';end if;
 failed:=false;begin perform eldervale_private.admin_action('give','{"item":"ore","amount":50}');exception when others then failed:=true;end;if not failed or eldervale_private.item_quantity(uid,'ore')<>0 then raise exception 'Overfull owner grant was not atomic';end if;
 perform eldervale_private.item_change(uid,'armor:helm',1000,true);if (select (inventory->'bank'->>'armor:helm')::integer from public.player_saves where user_id=uid)<>1000 then raise exception 'Bank still clamps equipment stacks';end if;
 -- A production recipe cannot consume ingredients when its output cannot fit.
 update public.player_saves set stats='{"wood":15,"matches":2}' where user_id=uid;
 select data into r from eldervale_private.skill_recipes where id='burn_wood';failed:=false;begin perform eldervale_private.skill_finish(uid,r,null,null,clock_timestamp());exception when others then failed:=true;problem:=sqlerrm;end;
 -- Firemaking frees a log slot and a match; it is allowed even with a full inventory.
 if failed then raise exception 'Firemaking unexpectedly failed: %',problem;end if;if eldervale_private.item_quantity(uid,'wood')<>14 or eldervale_private.item_quantity(uid,'matches')<>1 then raise exception 'Fire did not consume exactly one log and match';end if;
 select id into fire_id from eldervale_private.skill_fires where owner_id=uid order by expires_at desc limit 1;delete from eldervale_private.skill_fires where id=fire_id;
 update public.player_saves set stats='{"matches":2}' where user_id=uid;
 insert into eldervale_private.ground_drops(owner_id,item,amount,x,z) values(uid,'wood',2,-260,-280) returning id into drop_id;
 perform eldervale_private.skill_finish(uid,r,null,drop_id,clock_timestamp());if (select amount from eldervale_private.ground_drops where id=drop_id)<>1 or eldervale_private.item_quantity(uid,'wood')<>0 then raise exception 'Ground fire did not consume ground logs';end if;
 update eldervale_private.skill_fires set expires_at=clock_timestamp()-interval '1 second' where owner_id=uid;perform eldervale_private.skill_tick(clock_timestamp());if not exists(select 1 from eldervale_private.ground_drops where owner_id=uid and item='ashes') then raise exception 'Fire did not leave ashes';end if;
 -- Farming persists as a timestamped shared crop instead of a client timer.
 update public.player_saves set stats='{"herbSeeds":1,"rake":1,"seedDibber":1}' where user_id=uid;
 select data into r from eldervale_private.skill_recipes where id='plant_herbs';perform eldervale_private.skill_finish(uid,r,'test:prof:patch',null,clock_timestamp());if not exists(select 1 from eldervale_private.skill_crops where target='test:prof:patch' and ready_at>clock_timestamp()+interval '170 seconds') then raise exception 'Crop growth did not persist';end if;
 update eldervale_private.skill_crops set ready_at=clock_timestamp()-interval '1 second' where target='test:prof:patch';
 perform eldervale_private.realm_request(sid,'skill_harvest','{"target":"test:prof:patch"}',gen_random_uuid(),0);if eldervale_private.item_quantity(uid,'grimyHerb')<2 then raise exception 'Crop harvest failed';end if;
 update public.player_saves set stats='{"wood":1,"knife":1}',equipment='{}' where user_id=uid;
 rid:=gen_random_uuid();perform eldervale_private.realm_request(sid,'skill_start','{"recipe":"shafts","amount":1}',rid,0);perform eldervale_private.realm_request(sid,'skill_start','{"recipe":"shafts","amount":1}',rid,0);
 if (select count(*) from eldervale_private.skill_jobs where user_id=uid)<>1 then raise exception 'Duplicate request started duplicate jobs';end if;
 update eldervale_private.skill_jobs set due_at=clock_timestamp()-interval '1 second' where user_id=uid;perform eldervale_private.skill_tick(clock_timestamp());if eldervale_private.item_quantity(uid,'arrowShafts')<>15 then raise exception 'Timed crafting did not complete';end if;
 perform eldervale_private.item_change(uid,'wood',1);perform eldervale_private.realm_request(sid,'skill_start','{"recipe":"shafts"}',gen_random_uuid(),0);perform eldervale_private.realm_request(sid,'steer','{"x":1,"z":0,"yaw":0,"moving":true}',gen_random_uuid(),0);if exists(select 1 from eldervale_private.skill_jobs where user_id=uid) then raise exception 'Movement failed to cancel production';end if;
 -- Moderators and ordinary players cannot grant items or edit recipes.
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);failed:=false;begin perform eldervale_private.admin_action('give','{"item":"gold","amount":10}');exception when insufficient_privilege then failed:=true;end;if not failed then raise exception 'Non-owner grant accepted';end if;
 perform set_config('request.jwt.claim.sub',uid::text,true);
end $$;
select 'PASS: public auth entry, ore/bar/nails conservation, tool checks, depletion, inventory grants, full-inventory rollback, bank copies, both firemaking paths, ashes, crops, job idempotency and cancellation, owner authorization' as result;
rollback;
