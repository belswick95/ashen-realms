-- All mutations are rolled back, including moderator assignment and actor deletion.
begin;
select set_config('request.jwt.claims','{"sub":"91c5b7f0-7018-4290-a190-c2bba0ca492d","role":"authenticated"}',true);
do $$declare r jsonb;aid text;sid uuid;rid uuid:=gen_random_uuid();before_hp integer;after_hp integer;used_before integer;begin
 r:=eldervale_private.admin_overview();if r->>'role'<>'owner' then raise exception 'Owner role missing';end if;
 select id into aid from eldervale_private.realm_actors where data->>'blueprint'='eldervale-castle-v1' limit 1;
 perform eldervale_private.admin_action('actor_delete',jsonb_build_object('id',aid));if not(select deleted from eldervale_private.realm_actors where id=aid) then raise exception 'Actor deletion failed';end if;
 perform eldervale_private.admin_action('actor_restore',jsonb_build_object('id',aid));if(select deleted from eldervale_private.realm_actors where id=aid) then raise exception 'Actor restore failed';end if;
 perform eldervale_private.admin_action('actor_freeze',jsonb_build_object('id',aid));if not(select (data->>'frozen')::boolean from eldervale_private.realm_actors where id=aid) then raise exception 'Freeze failed';end if;
 perform eldervale_private.admin_action('actor_update',jsonb_build_object('id',aid,'hp',321,'level',36));if not exists(select 1 from eldervale_private.realm_actors where id=aid and (data->>'hp')::integer=321 and (data->>'attackLevel')::integer=36) then raise exception 'Stat edit failed';end if;
 perform eldervale_private.admin_action('catalog_item','{"id":"custom_test_bread","name":"Test bread","description":"Rollback fixture","buy":12,"sell":4,"heal":10,"stackable":true,"icon":"food"}');
 sid:=(eldervale_private.enter_world(null)->>'session')::uuid;
 used_before:=eldervale_private.inventory_used(auth.uid());
 perform eldervale_private.item_change(auth.uid(),'custom_test_bread',3);
 if eldervale_private.inventory_used(auth.uid())<>used_before+1 then raise exception 'Stackable item slot accounting failed';end if;
 update public.player_saves set health=20 where user_id=auth.uid();
 r:=eldervale_private.realm_request(sid,'consume','{"item":"custom_test_bread"}',rid,0);
 select health into after_hp from public.player_saves where user_id=auth.uid();
 if after_hp<>30 then raise exception 'Consumption did not heal';end if;
 r:=eldervale_private.realm_request(sid,'consume','{"item":"custom_test_bread"}',rid,0);
 if (select health from public.player_saves where user_id=auth.uid())<>after_hp or (select (stats->>'custom_test_bread')::integer from public.player_saves where user_id=auth.uid())<>2 then raise exception 'Duplicate consume was not idempotent';end if;
 -- Altar and kitchen interactions use proximity checks and the same ordered realm session.
 select id into aid from eldervale_private.realm_objects where data->>'template'='altar' limit 1;
 update eldervale_private.realm_players set x=-313,z=-316 where user_id=auth.uid();
 r:=eldervale_private.realm_request(sid,'pray',jsonb_build_object('target',aid),gen_random_uuid(),0);
 if not exists(select 1 from public.player_saves where user_id=auth.uid() and (stats->>'prayerPoints')::integer>0) then raise exception 'Prayer restoration failed';end if;
 select id into aid from eldervale_private.realm_objects where data->>'template'='hearth' limit 1;
 update eldervale_private.realm_players set x=-365,z=-283 where user_id=auth.uid();perform eldervale_private.item_change(auth.uid(),'rawFish',1);
 r:=eldervale_private.realm_request(sid,'cook',jsonb_build_object('target',aid),gen_random_uuid(),0);
 if not exists(select 1 from public.player_saves where user_id=auth.uid() and (skills->>'cookingXP')::integer>=25) then raise exception 'Cooking failed';end if;
 perform eldervale_private.admin_action('role','{"userId":"bc85408f-9f7d-4820-8208-8e0ab56324a0","role":"moderator"}');
end $$;
select set_config('request.jwt.claims','{"sub":"bc85408f-9f7d-4820-8208-8e0ab56324a0","role":"authenticated"}',true);
do $$begin
 if eldervale_private.staff_role()<>'moderator' then raise exception 'Role assignment failed';end if;
 if jsonb_array_length(eldervale_private.admin_overview()->'actors')<>0 then raise exception 'Moderator received owner actor tools';end if;
 begin perform eldervale_private.admin_action('give','{"item":"gold","amount":1}');raise exception 'Moderator give unexpectedly allowed';exception when insufficient_privilege then null;end;
 begin perform eldervale_private.admin_action('role','{"userId":"bc85408f-9f7d-4820-8208-8e0ab56324a0","role":"moderator"}');raise exception 'Moderator role grant unexpectedly allowed';exception when insufficient_privilege then null;end;
 begin perform eldervale_private.admin_action('kick','{"userId":"91c5b7f0-7018-4290-a190-c2bba0ca492d","seconds":60,"reason":"test"}');raise exception 'Moderator targeted owner';exception when insufficient_privilege then null;end;
end $$;
select set_config('request.jwt.claims','{}',true);
do $$begin begin perform eldervale_private.admin_overview();raise exception 'Anonymous staff access allowed';exception when insufficient_privilege then null;end;end $$;
rollback;
select jsonb_build_object('checks','owner actions, persisted actor removal/restore, frozen stats, moderator escalation denial, owner protection and anonymous denial passed; all mutations rolled back','castleEntities',(select count(*) from eldervale_private.entities where data->>'blueprint'='eldervale-castle-v1'),'remainingStaff',(select count(*) from eldervale_private.staff));
