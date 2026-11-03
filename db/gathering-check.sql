begin;
select set_config('request.jwt.claim.sub','91c5b7f0-7018-4290-a190-c2bba0ca492d',true);
select set_config('request.jwt.claims','{"sub":"91c5b7f0-7018-4290-a190-c2bba0ca492d","role":"authenticated"}',true);
-- Verify the public RPC as a player, not as the database owner.
select set_config('test.realm_session',(select session_id::text from eldervale_private.realm_players where user_id=auth.uid()),true);
set local role authenticated;
select public.world_command(current_setting('test.realm_session')::uuid,'sync') ? 'gathering' as player_entry_works;
reset role;
-- Reversible validation against the existing schema; no player changes commit.
do $$declare uid uuid:=auth.uid();sid uuid;tree text:='test:gather:tree';spot text:='test:gather:fish';n integer;err text;result jsonb;
begin
 select session_id into sid from eldervale_private.realm_players where user_id=uid;
 if sid is null then raise exception 'Test needs an existing realm player';end if;
 update eldervale_private.realm_players set x=50,z=50,last_seen=clock_timestamp(),last_command=clock_timestamp()-interval '1 second',input_until=null,path='[]',intent=null where user_id=uid;
 update public.player_saves set health=100,stats=stats||'{"wood":0,"rawFish":0,"bait":0,"fishingPole":1,"fishingNet":1}',inventory=inventory||'{"weaponsOwned":[],"armorOwned":[],"shieldsOwned":[],"jewelryOwned":[]}',equipment='{}' where user_id=uid;
 update eldervale_private.realm_actors set target=null where target=uid;
 insert into eldervale_private.realm_objects(id,kind,x,z,data) values(tree,'tree',51,50,'{"logsRemaining":3,"resourceRespawn":45}'),(spot,'fishing',50,51,'{}');
 err:=eldervale_private.gathering_error(uid,tree,'woodcut');if err not like '%axe%' then raise exception 'Missing axe accepted: %',err;end if;
 update public.player_saves set inventory=inventory||'{"weaponsOwned":["axe"]}' where user_id=uid;
 perform eldervale_private.realm_request(sid,'woodcut',jsonb_build_object('target',tree,'method','woodcut'),gen_random_uuid(),0);
 if not exists(select 1 from eldervale_private.gathering_actions where user_id=uid and method='woodcut') then raise exception 'Woodcut did not start';end if;
 for n in 1..3 loop update eldervale_private.gathering_actions set due_at=clock_timestamp()-interval '1 second' where user_id=uid;perform eldervale_private.gathering_tick(clock_timestamp());end loop;
 select (stats->>'wood')::integer into n from public.player_saves where user_id=uid;if n<>3 then raise exception 'Tree stock was not conserved: %',n;end if;
 if not exists(select 1 from eldervale_private.realm_objects where id=tree and available_at>clock_timestamp()+interval '40 seconds') then raise exception 'Tree did not deplete for 45 seconds';end if;
 err:=eldervale_private.gathering_error(uid,spot,'rod');if err not like '%bait%' then raise exception 'Rod accepted no bait: %',err;end if;
 err:=eldervale_private.gathering_error(uid,spot,'net');if err is not null then raise exception 'Net incorrectly requires bait: %',err;end if;
 update eldervale_private.realm_players set last_command=clock_timestamp()-interval '1 second' where user_id=uid;
 perform eldervale_private.realm_request(sid,'fish',jsonb_build_object('target',spot,'method','net'),gen_random_uuid(),0);
 update eldervale_private.gathering_actions set due_at=clock_timestamp()-interval '1 second' where user_id=uid;perform eldervale_private.gathering_tick(clock_timestamp());
 select (stats->>'rawFish')::integer into n from public.player_saves where user_id=uid;if n<>1 then raise exception 'Net did not catch one fish: %',n;end if;
 if (select (stats->>'bait')::integer from public.player_saves where user_id=uid)<>0 then raise exception 'Net consumed bait';end if;
 perform eldervale_private.realm_request(sid,'steer','{"x":0,"z":1,"yaw":0}',gen_random_uuid(),0);
 if exists(select 1 from eldervale_private.gathering_actions where user_id=uid) then raise exception 'Movement did not cancel gathering';end if;
 update eldervale_private.realm_objects set available_at=clock_timestamp()-interval '1 second' where id=tree;perform eldervale_private.gathering_tick(clock_timestamp());
 if exists(select 1 from eldervale_private.realm_objects where id=tree and (available_at is not null or data?'logsRemaining')) then raise exception 'Tree did not reset on regrowth';end if;
end $$;
select 'Gathering: tool gates, no-bait nets, tree stock/depletion, regrowth and movement cancellation passed' as result;
rollback;
