-- Integration checks against the real RPC implementations; all fixtures and changes roll back.
begin;
select set_config('request.jwt.claims','{"sub":"91c5b7f0-7018-4290-a190-c2bba0ca492d","role":"authenticated"}',true);
do $$declare a uuid:='91c5b7f0-7018-4290-a190-c2bba0ca492d';b uuid:='bc85408f-9f7d-4820-8208-8e0ab56324a0';sa uuid;sb uuid;rid uuid;drop_id uuid;trade_id uuid;revision_id integer;r jsonb;actor_id text;guard_id text;before_hp integer;begin
 update public.player_saves set gold=case when user_id=a then 100 else 50 end,stats=case when user_id=a then '{"wood":5}'::jsonb else '{"ore":3}'::jsonb end,inventory='{"bank":{},"armorOwned":[],"weaponsOwned":[],"shieldsOwned":[],"jewelryOwned":[]}',equipment='{}',health=100 where user_id in(a,b);
 sa:=(eldervale_private.enter_world(null)->>'session')::uuid;update eldervale_private.realm_players set x=0,z=12 where user_id=a;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 sb:=(eldervale_private.enter_world(null)->>'session')::uuid;update eldervale_private.realm_players set x=1,z=12 where user_id=b;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 rid:=gen_random_uuid();r:=eldervale_private.realm_request(sa,'drop','{"item":"wood","amount":2}',rid,0);
 select id into drop_id from eldervale_private.ground_drops where owner_id=a order by created_at desc limit 1;if drop_id is null then raise exception 'Drop not created';end if;
 r:=eldervale_private.realm_request(sa,'drop','{"item":"wood","amount":2}',rid,0);
 if eldervale_private.item_quantity(a,'wood')<>3 then raise exception 'Duplicate drop removed items twice';end if;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 r:=eldervale_private.realm_request(sb,'pickup_drop',jsonb_build_object('id',drop_id),gen_random_uuid(),0);
 if eldervale_private.item_quantity(b,'wood')<>2 or exists(select 1 from eldervale_private.ground_drops where id=drop_id) then raise exception 'Shared pickup failed';end if;
 begin perform eldervale_private.realm_request(sb,'pickup_drop',jsonb_build_object('id',drop_id),gen_random_uuid(),0);raise exception 'Duplicate pickup succeeded';exception when raise_exception then if sqlerrm='Duplicate pickup succeeded' then raise;end if;end;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 r:=eldervale_private.realm_request(sa,'trade_request',jsonb_build_object('player',b),gen_random_uuid(),0);trade_id:=(r->'trade'->>'id')::uuid;
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 r:=eldervale_private.realm_request(sb,'trade_join',jsonb_build_object('id',trade_id),gen_random_uuid(),0);
 r:=eldervale_private.realm_request(sb,'trade_offer',jsonb_build_object('id',trade_id,'offer','{"items":{"ore":3},"gold":20}'::jsonb),gen_random_uuid(),0);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 r:=eldervale_private.realm_request(sa,'trade_offer',jsonb_build_object('id',trade_id,'offer','{"items":{"wood":3},"gold":30}'::jsonb),gen_random_uuid(),0);revision_id:=(r->'trade'->>'revision')::integer;
 begin perform eldervale_private.realm_request(sa,'trade_accept',jsonb_build_object('id',trade_id,'revision',revision_id-1),gen_random_uuid(),0);raise exception 'Stale offer accepted';exception when raise_exception then if sqlerrm='Stale offer accepted' then raise;end if;end;
 r:=eldervale_private.realm_request(sa,'trade_accept',jsonb_build_object('id',trade_id,'revision',revision_id),gen_random_uuid(),0);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',b,'role','authenticated')::text,true);
 r:=eldervale_private.realm_request(sb,'trade_accept',jsonb_build_object('id',trade_id,'revision',revision_id),gen_random_uuid(),0);
 if r->'trade'->>'stage'<>'review' then raise exception 'Trade skipped final review';end if;
 if eldervale_private.item_quantity(a,'gold')<>100 then raise exception 'Gold moved before review';end if;
 revision_id:=(r->'trade'->>'revision')::integer;
 r:=eldervale_private.realm_request(sb,'trade_accept',jsonb_build_object('id',trade_id,'revision',revision_id),gen_random_uuid(),0);
 perform set_config('request.jwt.claims',jsonb_build_object('sub',a,'role','authenticated')::text,true);
 rid:=gen_random_uuid();r:=eldervale_private.realm_request(sa,'trade_accept',jsonb_build_object('id',trade_id,'revision',revision_id),rid,0);
 r:=eldervale_private.realm_request(sa,'trade_accept',jsonb_build_object('id',trade_id,'revision',revision_id),rid,0);
 if r->'trade'->>'stage'<>'complete' or eldervale_private.item_quantity(a,'gold')<>90 or eldervale_private.item_quantity(b,'gold')<>60 or eldervale_private.item_quantity(a,'ore')<>3 or eldervale_private.item_quantity(b,'wood')<>5 then raise exception 'Trade failed conservation or duplicate protection';end if;
 -- Expired drops disappear from the database, not merely from a client view.
 insert into eldervale_private.ground_drops(owner_id,item,amount,x,z,expires_at) values(a,'wood',1,0,12,now()-interval '1 second') returning id into drop_id;
 update eldervale_private.realm_clock set tick_at=clock_timestamp()-interval '1 second' where id;perform eldervale_private.world_tick();
 if exists(select 1 from eldervale_private.ground_drops where id=drop_id) then raise exception 'Expired drop was retained';end if;
 -- A dragon entering town draws an armed, higher-level guard, who deals real shared damage.
 r:=eldervale_private.admin_action('spawn','{"kind":"monster","template":"dragon","species":"dragon","name":"Rollback invader","x":4,"z":12,"yaw":0,"scale":1,"hp":1000,"level":80,"damage":30,"attackSpeed":3,"attackType":"fire","roam":0,"respawn":30,"attackable":true,"hostile":true}');actor_id:=r->>'id';
 perform eldervale_private.guard_tick(1);
 select guard into guard_id from eldervale_private.guard_duels where monster=actor_id;
 if guard_id is null then raise exception 'Town guard did not engage';end if;
 -- Place the pair within reach to exercise the attack resolution without waiting wall-clock time.
 update eldervale_private.realm_actors set x=4,z=10 where id=guard_id;update eldervale_private.guard_duels set phase=1,next_at=now()-interval '1 second' where guard=guard_id;
 perform eldervale_private.guard_tick(1);
 if not exists(select 1 from eldervale_private.realm_actors where id=guard_id and (data->>'level')::integer>80 and data->>'weapon'='longsword') then raise exception 'Guard level/weapon requirement failed';end if;
 if not exists(select 1 from eldervale_private.realm_actors where id=actor_id and hp<1000 and target is null) then raise exception 'Guard attack did not protect town';end if;
end $$;
rollback;
select 'PASS: shared pickup, drop expiry, duplicate protection, trade final review, stale-offer rejection, item/gold conservation and higher-level armed town guards. All changes rolled back.' as checks;
