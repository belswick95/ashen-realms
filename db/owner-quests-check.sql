-- Entire fixture rolls back: no live character, NPC, wallet or quest changes survive.
begin;
select set_config('request.jwt.claim.sub','91c5b7f0-7018-4290-a190-c2bba0ca492d',true);
select set_config('request.jwt.claims','{"sub":"91c5b7f0-7018-4290-a190-c2bba0ca492d","role":"authenticated"}',true);
do $$declare uid uuid:=auth.uid();sid uuid;rid uuid;qid uuid;result jsonb;failed boolean;before_gold integer;
begin
 select session_id into sid from eldervale_private.realm_players where user_id=uid;
 update eldervale_private.realm_players set x=-260,z=-280,last_seen=clock_timestamp(),last_command=clock_timestamp()-interval '1 second',input_until=null,input_x=0,input_z=0,path='[]',intent=null where user_id=uid;
 update eldervale_private.realm_actors set target=null where target=uid;delete from eldervale_private.skill_jobs where user_id=uid;delete from eldervale_private.gathering_actions where user_id=uid;
 update public.player_saves set health=100,gold=100,stats='{"wood":3}',skills='{}',inventory='{"bank":{},"armorOwned":[],"weaponsOwned":[],"shieldsOwned":[],"jewelryOwned":[],"mountsOwned":[]}',equipment='{}' where user_id=uid;
 insert into eldervale_private.realm_actors(id,data,x,z,hp) values('test:quest:giver','{"kind":"npc","name":"Quest giver","hp":100,"role":"resident","attackable":false,"roam":0,"frozen":true}',-259,-280,100),('test:quest:enemy','{"kind":"monster","name":"Enemy","hp":10,"attackable":true,"roam":0,"frozen":true}',-258,-280,10);
 result:=eldervale_private.admin_action('quest_save','{"data":{"name":"Test quest","description":"Bring logs, talk, and defeat an enemy.","giver":"test:quest:giver","published":true,"objectives":[{"type":"collect","target":"wood","amount":3},{"type":"talk","target":"test:quest:giver","amount":1},{"type":"kill","target":"test:quest:enemy","amount":1}],"gold":50,"items":{"bait":2},"xp":{"cooking":25}}}');qid:=(result->>'id')::uuid;
 -- Distance checks prevent journal acceptance from anywhere in the world.
 update eldervale_private.realm_players set x=-240 where user_id=uid;failed:=false;begin perform eldervale_private.realm_request(sid,'quest_accept',jsonb_build_object('id',qid),gen_random_uuid(),0);exception when others then failed:=true;end;if not failed then raise exception 'Remote acceptance allowed';end if;
 update eldervale_private.realm_players set x=-260 where user_id=uid;
 rid:=gen_random_uuid();perform eldervale_private.realm_request(sid,'quest_accept',jsonb_build_object('id',qid),rid,0);perform eldervale_private.realm_request(sid,'quest_accept',jsonb_build_object('id',qid),rid,0);
 if (select count(*) from eldervale_private.player_quests where quest_id=qid)<>1 then raise exception 'Duplicate acceptance';end if;
 failed:=false;begin perform eldervale_private.realm_request(sid,'quest_complete',jsonb_build_object('id',qid),gen_random_uuid(),0);exception when others then failed:=true;end;if not failed then raise exception 'Incomplete objectives accepted';end if;
 perform eldervale_private.emit(jsonb_build_object('type','interaction','kind','npc','target','test:quest:giver','player',uid));perform eldervale_private.emit(jsonb_build_object('type','death','target','test:quest:enemy','player',uid));
 -- Publishing edits cannot change an accepted player's contract.
 update eldervale_private.quest_definitions set data=jsonb_set(data,'{gold}','999') where id=qid;
 rid:=gen_random_uuid();perform eldervale_private.realm_request(sid,'quest_complete',jsonb_build_object('id',qid),rid,0);perform eldervale_private.realm_request(sid,'quest_complete',jsonb_build_object('id',qid),rid,0);
 if eldervale_private.item_quantity(uid,'wood')<>0 or eldervale_private.item_quantity(uid,'bait')<>2 or (select gold from public.player_saves where user_id=uid)<>150 or (select (skills->>'cookingXP')::integer from public.player_saves where user_id=uid)<>25 then raise exception 'Reward conservation, frozen version or idempotency failed';end if;
 failed:=false;begin perform eldervale_private.realm_request(sid,'quest_complete',jsonb_build_object('id',qid),gen_random_uuid(),0);exception when others then failed:=true;end;if not failed then raise exception 'Quest rewards repeatable';end if;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);failed:=false;begin perform eldervale_private.admin_action('quest_list','{}');exception when insufficient_privilege then failed:=true;end;if not failed then raise exception 'Non-owner quest authoring allowed';end if;
end $$;
select 'PASS: owner authorization, proximity, acceptance idempotency, collect/talk/kill objectives, frozen rewards, atomic hand-in, XP and no duplicate rewards' result;
rollback;
