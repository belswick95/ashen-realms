-- Keep functional stations clear of the room's decorative furniture and stairs.
do $$declare uid uuid;r record;eid uuid;begin
 select user_id into uid from public.player_saves where lower(character_name)='devilbound1';perform set_config('request.jwt.claim.sub',uid::text,true);
 if not eldervale_private.is_owner() then raise exception 'Owner identity unavailable';end if;
 for r in select * from (values ('rune_altar',-310,-315,-308.7,-319.5),('workbench',-347,-331,-346.4,-331),('furnace',-314.6,-283.86,-314.6,-283.4)) v(template,old_x,old_z,new_x,new_z) loop
  select id into eid from eldervale_private.entities where not deleted and data->>'template'=r.template and (data->>'x')::numeric=r.old_x and (data->>'z')::numeric=r.old_z;
  if eid is null then raise exception 'Station % moved; review clearances',r.template;end if;
  perform eldervale_private.admin_action('update',jsonb_build_object('id',eid,'x',r.new_x,'z',r.new_z));
 end loop;
end $$;
