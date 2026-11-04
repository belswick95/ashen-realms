-- Rollback-only regression: no character, NPC, clock or inventory changes survive.
begin;
do $$
declare uid uuid;p eldervale_private.realm_players;t timestamptz:=clock_timestamp();sid uuid;r jsonb;denied boolean;
begin
 select user_id into uid from public.player_saves where lower(character_name)='devilbound1';
 perform pg_advisory_xact_lock(736211);
 perform set_config('request.jwt.claim.sub',uid::text,true);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
 update public.player_saves set equipment='{}',health=100 where user_id=uid;
 update eldervale_private.realm_players set x=-229,z=155,floor=0,building=null,run=false,input_x=0,input_z=1,input_yaw=0,motion_at=t,input_until=t+interval '1.5 seconds',path='[]',intent=null,last_seen=t where user_id=uid;
 p:=eldervale_private.advance_player_motion(uid,t+interval '.05 seconds');
 if abs(p.z-155.32)>.001 then raise exception 'A 50ms tap was lost: %',p.z;end if;
 update eldervale_private.realm_players set input_until=null,input_x=0,input_z=0,path='[]' where user_id=uid;
 p:=eldervale_private.advance_player_motion(uid,t+interval '.2 seconds');
 if abs(p.z-155.32)>.001 then raise exception 'Released tap kept moving';end if;
 p:=eldervale_private.advance_player_motion(uid,t+interval '.2 seconds');
 if abs(p.z-155.32)>.001 then raise exception 'Same timestamp replayed movement';end if;
 update eldervale_private.realm_players set z=155,motion_at=t,input_z=1,input_until=t+interval '.2 seconds' where user_id=uid;
 p:=eldervale_private.advance_player_motion(uid,t+interval '.4 seconds');
 if abs(p.z-156.28)>.001 or p.input_until is not null then raise exception 'Expired input did not stop at its deadline: %',p.z;end if;
 p:=eldervale_private.advance_player_motion(uid,t+interval '.6 seconds');
 if abs(p.z-156.28)>.001 then raise exception 'Expired input drifted';end if;
 update eldervale_private.realm_players set z=155,motion_at=t,input_z=1,input_until=t+interval '1.5 seconds',run=true,energy=100 where user_id=uid;
 p:=eldervale_private.advance_player_motion(uid,t+interval '.1 seconds');
 if abs(p.z-156.28)>.001 or abs(p.energy-99.5)>.001 then raise exception 'Sprint speed/energy changed';end if;
 -- A global tick must only integrate time not already consumed by this player.
 t:=clock_timestamp();update eldervale_private.realm_clock set tick_at=t-interval '.2 seconds' where id;
 update eldervale_private.realm_players set z=155,run=false,motion_at=t-interval '.05 seconds',input_z=1,input_until=t+interval '1.5 seconds' where user_id=uid;
 perform eldervale_private.world_tick();select * into p from eldervale_private.realm_players where user_id=uid;
 if p.z<155.31 or p.z>155.9 then raise exception 'Global tick double-counted player time: %',p.z;end if;
 select session_id into sid from eldervale_private.realm_players where user_id=uid;
 r:=eldervale_private.realm_request(sid,'steer','{"x":0,"z":1,"yaw":0}',gen_random_uuid(),0);
 if extract(epoch from((r->'motion'->>'input_until')::timestamptz-clock_timestamp()))<1.2 then raise exception 'Movement lease too short';end if;
 if (r->'motion'->>'motion_at')::timestamptz<>(select motion_at from eldervale_private.realm_players where user_id=uid) then raise exception 'Reply contains stale motion';end if;
 denied:=false;begin perform eldervale_private.realm_request(gen_random_uuid(),'steer','{"x":0,"z":1}',gen_random_uuid(),0);exception when insufficient_privilege or raise_exception then denied:=true;end;
 if not denied then raise exception 'Forged session accepted';end if;
 if has_function_privilege('anon','eldervale_private.advance_player_motion(uuid,timestamptz)','execute') or has_function_privilege('authenticated','eldervale_private.advance_player_motion(uuid,timestamptz)','execute') then raise exception 'Private motion helper exposed';end if;
end $$;
select 'PASS short taps, release, duplicate time, lease expiry, sprint/energy, tick accounting, fresh replies and session checks' verification;
rollback;
