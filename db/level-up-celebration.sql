-- RuneScape-style level-up fireworks that other players can see.
-- Adds a 'celebrate' world command: after a level-up popup the client sends
-- {skill:'fishingXP'|'combat', level:N}; the server checks the level is real
-- (the player's skill XP reaches it, or their combat level does), limits it to
-- one per 1.5 s per player, and emits a level_up event at the player's position.
-- Every nearby client then draws the firework burst and plays the jingle softly.
-- Purely cosmetic: no XP, items or state change. Apply once (exact-once patch).
select eldervale_private.patch_function('eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)'::regprocedure,array[
 $o$  r:=eldervale_private.realm_request_before_stories($1,$2,$3,$4,$5);$o$,
 $n$  if command='celebrate' then
   r:=eldervale_private.realm_request_before_stories($1,'sync','{}',null,$5);
   select * into p from eldervale_private.realm_players where user_id=auth.uid();
   if (payload->>'skill') ~ '^[a-z]{3,20}(XP)?$' and (payload->>'level') ~ '^[0-9]{1,3}$'
    and (payload->>'level')::integer between 2 and 126
    and ((payload->>'skill')='combat' and (payload->>'level')::integer<=(select eldervale_private.combat_level(s.skills) from public.player_saves s where s.user_id=auth.uid())
     or (payload->>'skill')<>'combat' and (payload->>'level')::integer<=99 and coalesce((select eldervale_private.xp_level(coalesce(s.skills->>(payload->>'skill'),'0')::numeric)>=(payload->>'level')::integer or not (s.skills ? (payload->>'skill')) from public.player_saves s where s.user_id=auth.uid()),false))
    and not exists(select 1 from eldervale_private.realm_events e where e.created_at>clock_timestamp()-interval '1.5 seconds' and e.data->>'type'='level_up' and e.data->>'player'=auth.uid()::text) then
    perform eldervale_private.emit(jsonb_build_object('type','level_up','player',auth.uid()::text,'skill',payload->>'skill','level',(payload->>'level')::integer,'x',p.x,'z',p.z,'floor',p.floor));
   end if;
  else
   r:=eldervale_private.realm_request_before_stories($1,$2,$3,$4,$5);
  end if;$n$
]);
