begin;
select set_config('request.jwt.claim.sub','91c5b7f0-7018-4290-a190-c2bba0ca492d',true);
select set_config('request.jwt.claims','{"sub":"91c5b7f0-7018-4290-a190-c2bba0ca492d","role":"authenticated"}',true);
do $$declare uid uuid:=auth.uid();sid uuid;bid uuid;rid uuid;r jsonb;failed boolean;did uuid;
begin
 select session_id into sid from eldervale_private.realm_players where user_id=uid;
 update eldervale_private.realm_players set x=-260,z=-280,floor=0,building=null,last_seen=clock_timestamp(),last_command=clock_timestamp()-interval '1 second',input_until=null,input_x=0,input_z=0,path='[]',intent=null where user_id=uid;
 update eldervale_private.realm_actors set target=null where target=uid;delete from eldervale_private.skill_jobs where user_id=uid;delete from eldervale_private.gathering_actions where user_id=uid;delete from eldervale_private.trades where a=uid or b=uid;
 r:=eldervale_private.admin_action('spawn','{"kind":"object","template":"cottage","name":"Test three-story house","x":-260,"z":-280,"yaw":0,"scale":2,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"stories":3}');bid:=(r->>'id')::uuid;
 -- Stair anchor is local (1.12,-.65), with scale 1.3 * 2.
 update eldervale_private.realm_players set x=-257.088,z=-281.69 where user_id=uid;
 failed:=false;begin perform eldervale_private.realm_request(sid,'stairs',jsonb_build_object('building',bid,'floor',2),gen_random_uuid(),0);exception when others then failed:=true;end;if not failed then raise exception 'Skipped floor accepted';end if;
 rid:=gen_random_uuid();r:=eldervale_private.realm_request(sid,'stairs',jsonb_build_object('building',bid,'floor',1),rid,0);perform eldervale_private.realm_request(sid,'stairs',jsonb_build_object('building',bid,'floor',1),rid,0);
 if (r->'interior'->>'floor')::integer<>1 or (select floor from eldervale_private.realm_players where user_id=uid)<>1 then raise exception 'Stairs did not persist floor';end if;
 perform eldervale_private.motion_story(1,bid::text);
 if not eldervale_private.can_step(-260,-280,-260,-279) or eldervale_private.can_step(-260,-280,-250,-280) then raise exception 'Upper-floor boundary failed';end if;
 -- Data-driven objects can be placed upstairs; invalid placements fail atomically.
 r:=eldervale_private.admin_action('spawn',jsonb_build_object('kind','object','template','anvil','name','Upstairs anvil','x',-262,'z',-282,'yaw',0,'scale',.5,'level',1,'hp',1,'damage',0,'attackSpeed',2.4,'roam',0,'respawn',0,'floor',1,'building',bid));
 failed:=false;begin perform eldervale_private.admin_action('spawn',jsonb_build_object('kind','object','template','anvil','name','Floating anvil','x',-240,'z',-282,'yaw',0,'scale',1,'level',1,'hp',1,'damage',0,'attackSpeed',2.4,'roam',0,'respawn',0,'floor',1,'building',bid));exception when others then failed:=true;end;if not failed then raise exception 'Out-of-building upper object allowed';end if;
 failed:=false;begin perform eldervale_private.admin_action('delete',jsonb_build_object('id',bid));exception when others then failed:=true;end;if not failed then raise exception 'Occupied building deletion stranded player';end if;
 insert into eldervale_private.ground_drops(owner_id,item,amount,x,z) values(uid,'wood',1,-257.088,-281.69) returning id into did;if (select floor from eldervale_private.ground_drops where id=did)<>1 then raise exception 'Drop lost floor';end if;
 perform eldervale_private.realm_request(sid,'stairs',jsonb_build_object('building',bid,'floor',0),gen_random_uuid(),0);
 failed:=false;begin perform eldervale_private.realm_request(sid,'pickup_drop',jsonb_build_object('id',did),gen_random_uuid(),0);exception when others then failed:=true;end;if not failed then raise exception 'Ground player picked up upstairs item';end if;
 if (select floor from eldervale_private.realm_players where user_id=uid)<>0 then raise exception 'Downstairs failed';end if;
end $$;
select 'PASS: three-story stairs, no skipping floors, duplicate request safety, persistent floor state, upper collision boundary, safe object placement, occupied-building deletion protection and floor-separated drops' result;
rollback;
