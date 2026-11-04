begin;
select set_config('request.jwt.claim.sub','91c5b7f0-7018-4290-a190-c2bba0ca492d',true);
select set_config('request.jwt.claims','{"sub":"91c5b7f0-7018-4290-a190-c2bba0ca492d","role":"authenticated"}',true);
do $$declare uid uuid:=auth.uid();sid uuid;rid uuid;quote integer;paid integer;result jsonb;failed boolean;before_gold integer;b integer;s integer;
begin
 for available in 0..100 loop
  b:=eldervale_private.merchant_quote(100,100,available,20,true,1);s:=eldervale_private.merchant_quote(100,100,available,20,false,1);
  if s>=b or b<65 or b>150 then raise exception 'Pricing bounds or spread failed';end if;
  if available>0 and eldervale_private.merchant_quote(100,100,available-1,20,false,1)>=b then raise exception 'Immediate resale arbitrage';end if;
 end loop;
 if eldervale_private.merchant_quote(100,50,-1,null,true,10)<>1000 then raise exception 'Unlimited quote changed';end if;
 select session_id into sid from eldervale_private.realm_players where user_id=uid;
 update eldervale_private.realm_players set x=-260,z=-280,last_seen=clock_timestamp(),last_command=clock_timestamp()-interval '1 second',input_until=null,input_x=0,input_z=0,path='[]',intent=null where user_id=uid;
 update eldervale_private.realm_actors set target=null where target=uid;delete from eldervale_private.skill_jobs where user_id=uid;delete from eldervale_private.gathering_actions where user_id=uid;
 update public.player_saves set health=100,gold=1000,stats='{}',inventory='{"bank":{},"armorOwned":[],"weaponsOwned":[],"shieldsOwned":[],"jewelryOwned":[],"mountsOwned":[]}',equipment='{}' where user_id=uid;
 insert into eldervale_private.realm_actors(id,data,x,z,hp) values('test:economy:merchant','{"kind":"npc","name":"Merchant","hp":100,"role":"merchant","roam":0,"frozen":true}',-259,-280,100);
 insert into eldervale_private.shop_stock(merchant,item,buy,sell,stock) values('test:economy:merchant','bait',10,8,20);
 result:=eldervale_private.realm_request(sid,'sync','{}',null,0);quote:=(result->'shops'->'test:economy:merchant'->'bait'->>'buy10')::integer;
 rid:=gen_random_uuid();perform eldervale_private.realm_request(sid,'trade',jsonb_build_object('merchant','test:economy:merchant','item','bait','buy',true,'amount',10,'quote',quote),rid,0);
 perform eldervale_private.realm_request(sid,'trade',jsonb_build_object('merchant','test:economy:merchant','item','bait','buy',true,'amount',10,'quote',quote),rid,0);
 if eldervale_private.item_quantity(uid,'bait')<>10 or (select gold from public.player_saves where user_id=uid)<>1000-quote or (select stock from eldervale_private.shop_stock where merchant='test:economy:merchant' and item='bait')<>10 then raise exception 'Bulk total, stock or request idempotency failed';end if;
 update eldervale_private.realm_players set last_command=clock_timestamp()-interval '1 second' where user_id=uid;
 failed:=false;begin perform eldervale_private.realm_request(sid,'trade','{"merchant":"test:economy:merchant","item":"bait","buy":true,"amount":1,"quote":1}',gen_random_uuid(),0);exception when others then failed:=sqlerrm like 'Price changed%';end;if not failed or (select gold from public.player_saves where user_id=uid)<>1000-quote then raise exception 'Changed quote charged player';end if;
 result:=eldervale_private.realm_request(sid,'sync','{}',null,0);paid:=(result->'shops'->'test:economy:merchant'->'bait'->>'sell')::integer;
 perform eldervale_private.realm_request(sid,'trade',jsonb_build_object('merchant','test:economy:merchant','item','bait','buy',false,'quote',paid),gen_random_uuid(),0);
 if eldervale_private.item_quantity(uid,'bait')<>9 or (select gold from public.player_saves where user_id=uid)<>1000-quote+paid then raise exception 'Sell conservation failed';end if;
end $$;
select 'PASS: bounded shared-supply quotes, spread, no resale arbitrage, fixed unlimited stock, bulk pricing, duplicate requests, stale-price rejection and gold/item conservation' result;
rollback;
