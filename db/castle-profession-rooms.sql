-- Identify seeded buildings and stations by their original template/location, not generated UUIDs.
do $$declare keep_id uuid;smithy_id uuid;uid uuid;r record;changes jsonb;result jsonb;
begin
 select user_id into uid from public.player_saves where lower(character_name)='devilbound1';perform set_config('request.jwt.claim.sub',uid::text,true);
 if not eldervale_private.is_owner() then raise exception 'Owner identity unavailable';end if;
 select id into keep_id from eldervale_private.entities where not deleted and data->>'blueprint'='eldervale-castle-v1' and data->>'template'='cottage' and (data->>'x')::numeric=-340 and (data->>'z')::numeric=-334;
 select id into smithy_id from eldervale_private.entities where not deleted and data->>'blueprint'='eldervale-castle-v1' and data->>'template'='forge' and (data->>'x')::numeric=-312 and (data->>'z')::numeric=-281;
 if keep_id is null or smithy_id is null then raise exception 'Castle layout changed; review rooms before moving stations';end if;
 perform eldervale_private.admin_action('update',jsonb_build_object('id',keep_id,'stories',3,'name','Eldervale Castle Keep','room','hall','upperRoom','workshop','topRoom','home','stone',true));
 perform eldervale_private.admin_action('update',jsonb_build_object('id',smithy_id,'furnished',false));
 for r in select * from (values
 ('anvil',-337,-294,-310,-281,0),('furnace',-341,-294,-314.6,-283.86,0),
 ('spinning_wheel',-337,-290,-347,-337,1),('tanning_rack',-343,-290,-342,-337,1),('workbench',-325,-294,-347,-331,1),
 ('practice_chest',-334,-284,-340,-331,1),('thieving_stall',-338,-284,-335,-331,1),
 ('mill',-343,-286,-368.5,-280,0),('rune_altar',-298,-295,-310,-315,0)) v(template,old_x,old_z,new_x,new_z,story) loop
  select jsonb_build_object('id',id,'x',r.new_x,'z',r.new_z,'floor',r.story,'building',case when r.story>0 then keep_id::text else null end) into changes from eldervale_private.entities where not deleted and data->>'template'=r.template and (data->>'x')::numeric=r.old_x and (data->>'z')::numeric=r.old_z;
  if changes is null then raise exception 'Station % changed; review before moving',r.template;end if;
  perform eldervale_private.admin_action('update',changes);
 end loop;
end $$;
