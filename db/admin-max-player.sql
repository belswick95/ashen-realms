-- One-click "max out" for the owner console: every skill to level 100 (XP 490,050 under
-- level = 1+floor(sqrt(xp/50)), capped at 100) and gold to the 1,000,000,000 cap.
-- Inserted into eldervale_private.admin_console with the guarded patch_function editor.
select eldervale_private.patch_function('eldervale_private.admin_console(text,jsonb)'::regprocedure,array[
$a$ perform pg_advisory_xact_lock(736211);$a$,
$a$ if command='console_max_player' then
  uid:=coalesce((payload->>'userId')::uuid,auth.uid());
  select to_jsonb(s) into before_row from public.player_saves s where user_id=uid for update;if before_row is null then raise exception 'Player has no character';end if;
  update public.player_saves set
   skills=skills||(select jsonb_object_agg(x,greatest(490050,coalesce((skills->>x)::numeric,0))) from unnest(array['attackXP','strengthXP','defenceXP','hitpointsXP','rangedXP','magicXP','prayerXP','firemakingXP','fishingXP','cookingXP','smithingXP','craftingXP','herbloreXP','farmingXP','agilityXP','thievingXP','fletchingXP','runecraftingXP','constructionXP','hunterXP']) x),
   stats=stats||(select jsonb_object_agg(x,greatest(490050,coalesce((stats->>x)::numeric,0))) from unnest(array['miningXP','woodXP']) x),
   gold=1000000000
  where user_id=uid;
  update public.player_saves set level=eldervale_private.combat_level(skills),health=max_health where user_id=uid;
  select jsonb_build_object('userId',user_id,'level',level,'gold',gold) into r from public.player_saves where user_id=uid;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,uid::text,jsonb_build_object('skills',before_row->'skills','stats',before_row->'stats','gold',before_row->'gold'),r);
  return r;
 end if;
 perform pg_advisory_xact_lock(736211);$a$]);
