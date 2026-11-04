begin;
select set_config('request.jwt.claim.sub','91c5b7f0-7018-4290-a190-c2bba0ca492d',true);
do $$declare uid uuid:=auth.uid();sid uuid;r jsonb;v jsonb;failed boolean;begin
 select session_id into sid from eldervale_private.realm_players where user_id=uid;
 update eldervale_private.realm_players set x=-340,z=-282,last_seen=clock_timestamp(),last_command=clock_timestamp()-interval '1 second',input_x=0,input_z=0,input_until=null,path='[]',intent=null where user_id=uid;
 update public.player_saves set stats='{"hammer":1,"ironBar":5}',skills=skills||'{"smithingXP":500000}',inventory='{"bank":{"armor:helm":500},"weaponsOwned":[],"armorOwned":[],"shieldsOwned":[],"jewelryOwned":[],"mountsOwned":[]}',equipment='{}' where user_id=uid;
 insert into eldervale_private.realm_objects(id,kind,x,z,data) values('test:prof:bank','door',-339,-282,'{"type":"bank"}'),('test:prof:forge','object',-339,-282,'{"template":"anvil"}');
 perform eldervale_private.realm_request(sid,'bank','{"item":"armor:helm","direction":"withdraw","all":true}',gen_random_uuid(),0);
 if (select (inventory->'bank'->>'armor:helm')::integer from public.player_saves where user_id=uid)<>490 or eldervale_private.item_quantity(uid,'armor:helm')<>10 then raise exception 'Bank withdraw-all lost equipment copies';end if;
 select data into r from eldervale_private.skill_recipes where id='forge_armor_chest';perform eldervale_private.skill_finish(uid,r,'test:prof:forge',null,clock_timestamp());if eldervale_private.item_quantity(uid,'armor:chest')<>1 or eldervale_private.item_quantity(uid,'ironBar')<>0 then raise exception 'Armor did not forge correctly';end if;
 perform eldervale_private.admin_action('catalog_recipe','{"id":"test_owner_recipe","recipe":{"name":"Test recipe","skill":"smithing","level":1,"xp":5,"seconds":3,"enabled":true,"station":"anvil","inputs":{"ironBar":1},"outputs":{"nails":10},"tools":["hammer"]}}');
 if not exists(select 1 from eldervale_private.skill_recipes where skill_recipes.id='test_owner_recipe' and data->'outputs'->>'nails'='10') then raise exception 'Owner recipe not saved';end if;
 perform eldervale_private.admin_action('catalog_item','{"id":"custom_test_drop","name":"Test material","description":"Test","buy":5,"sell":1,"heal":0,"icon":"ore","stackable":true,"model":"bar"}');
 if not exists(select 1 from eldervale_private.realm_catalog where realm_catalog.id='item:custom_test_drop' and data->>'model'='bar') then raise exception 'Custom drop model not saved';end if;
end $$;
select 'PASS: equipment bank withdrawal conservation, real iron armor forging, owner recipe save and custom drop model save' as result;
rollback;
