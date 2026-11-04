begin;
select set_config('request.jwt.claim.sub',(select user_id::text from public.player_saves where lower(character_name)='devilbound1'),true);
do $$declare uid uuid:=auth.uid();fire eldervale_private.realm_objects;pot eldervale_private.realm_objects;recipe jsonb;problem text;failed boolean:=false;n integer;r jsonb;sid uuid;rid uuid;
begin
 if (select count(*) from eldervale_private.entities where not deleted and data->>'blueprint'='castle-trail-camp-v1')<>52 then raise exception 'Camp entities missing';end if;
 if exists(select 1 from eldervale_private.entities e where not e.deleted and e.data->>'blueprint'='castle-trail-camp-v1' and (e.data->>'z')::float8<=-236) then raise exception 'Camp intruded into castle/bridge';end if;
 if exists(select 1 from eldervale_private.realm_catalog c where c.id like 'item:%' and c.id<>'item:gold' and not c.data?'noteOf' and not coalesce((c.data->>'stackable')::boolean,false) and coalesce((c.data->>'notable')::boolean,true) and not exists(select 1 from eldervale_private.realm_catalog note where note.id='item:note:'||substring(c.id from 6) and note.data->>'noteOf'=substring(c.id from 6))) then raise exception 'Missing bank note';end if;
 select * into pot from eldervale_private.realm_objects where data->>'template'='cooking_tripod' and data->>'blueprint'='castle-trail-camp-v1';
 if pot.id is null then raise exception 'Shared cooking pot missing';end if;
 update eldervale_private.realm_players set x=pot.x+2,z=pot.z,floor=0,building=null,last_seen=clock_timestamp() where user_id=uid;
 update public.player_saves set stats=stats||'{"rawFish":1}' where user_id=uid;
 select data into recipe from eldervale_private.skill_recipes where id='cook_fish';problem:=eldervale_private.skill_error(uid,recipe,pot.id,null);if problem is not null then raise exception 'Camp cooking unavailable: %',problem;end if;
 if eldervale_private.can_step(pot.x,pot.z,pot.x,pot.z) then raise exception 'Walked through fire/tripod';end if;
 r:=eldervale_private.admin_action('catalog_item','{"id":"custom_camp_test_rope","name":"Test rope","description":"Rollback test","icon":"supply","model":"rope","buy":12,"sell":3,"heal":0,"stackable":false}');
 if not exists(select 1 from eldervale_private.realm_catalog where id='item:custom_camp_test_rope' and data->>'model'='rope') or not exists(select 1 from eldervale_private.realm_catalog where id='item:note:custom_camp_test_rope') then raise exception 'Owner model/note creation failed';end if;
 -- Healing consumes one physical item exactly once; notes are never edible.
 select session_id into sid from eldervale_private.realm_players where user_id=uid;
 update eldervale_private.realm_players set consume_at=null,intent=null,path='[]',input_until=null,last_command=clock_timestamp()-interval '1 second' where user_id=uid;
 update eldervale_private.realm_actors set target=null where target=uid;
 update public.player_saves set health=10,stats=stats||'{"apple":1,"note:apple":1}' where user_id=uid;
 rid:=gen_random_uuid();perform eldervale_private.realm_request(sid,'consume','{"item":"apple"}',rid,0);perform eldervale_private.realm_request(sid,'consume','{"item":"apple"}',rid,0);
 if (select health from public.player_saves where user_id=uid)<>14 or eldervale_private.item_quantity(uid,'apple')<>0 then raise exception 'Travel food healing or idempotency failed';end if;
 update eldervale_private.realm_players set consume_at=null where user_id=uid;failed:=false;begin perform eldervale_private.realm_request(sid,'consume','{"item":"note:apple"}',gen_random_uuid(),0);exception when others then failed:=true;end;if not failed or eldervale_private.item_quantity(uid,'note:apple')<>1 then raise exception 'Bank note was eaten';end if;failed:=false;
 perform set_config('request.jwt.claim.sub','00000000-0000-4000-8000-000000000001',true);begin perform eldervale_private.admin_action('catalog_item','{"id":"custom_denied","name":"Denied","icon":"supply","model":"rope","buy":12,"sell":3,"heal":0,"stackable":false}');exception when insufficient_privilege then failed:=true;end;if not failed then raise exception 'Non-owner edited catalog';end if;
end $$;
select 'PASS shared camp persistence, exterior-only placement, complete note coverage, cooking interaction, solid props and checked owner model creation' result;
rollback;
