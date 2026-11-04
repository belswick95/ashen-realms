-- No player/world changes survive this fixture.
begin;
do $$declare uid uuid;sid uuid;r jsonb;denied boolean;begin
 select user_id into uid from public.player_saves where lower(character_name)='devilbound1';
 perform set_config('request.jwt.claim.sub',uid::text,true);perform set_config('request.jwt.claims',jsonb_build_object('sub',uid,'role','authenticated')::text,true);
 perform pg_advisory_xact_lock(736211);
 select session_id into sid from eldervale_private.realm_players where user_id=uid;
 update eldervale_private.realm_players set input_seq=0,input_session=null,last_seen=clock_timestamp() where user_id=uid;
 -- Stop arrives first; a delayed earlier start must never restart movement.
 r:=eldervale_private.realm_request(sid,'steer','{"x":0,"z":0,"sequence":2}',gen_random_uuid(),0);
 r:=eldervale_private.realm_request(sid,'steer','{"x":0,"z":1,"sequence":1}',gen_random_uuid(),0);
 if (r->'motion'->>'input_z')::float8<>0 or (r->'motion'->>'input_seq')::bigint<>2 then raise exception 'Late start restarted movement';end if;
 -- New input works, but an older late stop cannot cancel it.
 r:=eldervale_private.realm_request(sid,'steer','{"x":0,"z":1,"sequence":3}',gen_random_uuid(),0);
 r:=eldervale_private.realm_request(sid,'steer','{"x":0,"z":0,"sequence":2}',gen_random_uuid(),0);
 if (r->'motion'->>'input_z')::float8<>1 or (r->'motion'->>'input_seq')::bigint<>3 then raise exception 'Late stop cancelled new movement';end if;
 r:=eldervale_private.realm_request(sid,'steer','{"x":0,"z":0,"sequence":4}',gen_random_uuid(),0);
 if (r->'motion'->>'input_z')::float8<>0 then raise exception 'Latest stop ignored';end if;
 -- A new world session starts its own input numbering.
 update eldervale_private.realm_players set input_session=gen_random_uuid(),input_seq=9000 where user_id=uid;
 r:=eldervale_private.realm_request(sid,'steer','{"x":0,"z":0,"sequence":1}',gen_random_uuid(),0);
 if (r->'motion'->>'input_seq')::bigint<>1 then raise exception 'Session input numbering did not reset';end if;
 denied:=false;begin perform eldervale_private.realm_request(gen_random_uuid(),'steer','{"x":0,"z":1,"sequence":5}',gen_random_uuid(),0);exception when insufficient_privilege or raise_exception then denied:=true;end;if not denied then raise exception 'Forged session accepted';end if;
end $$;
select 'PASS reordered starts/stops, latest input, session numbering and forged-session rejection' verification;
rollback;
