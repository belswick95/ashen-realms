-- Quest system v2 (Round 2, R2-F): requirements, multi-stage quests with branching choices and
-- flags, unlocks, XP lamps, cutscene records and the guidance tile feed. Backward compatible: a
-- quest without v2 fields behaves exactly as before.
-- Apply after the tick & tile engine files. Idempotent: functions are create-or-replace and every
-- patch of a live function is skipped once its marker is present. Anchors are checked against the
-- live text (scripts/quests-v2-db/live-functions.json, md5-verified read-only on 2026-11-06).
--
-- Quest data (quest_definitions.data / player_quests.data), all optional:
--   requirements {quests:[key], qp:n, combat:n, skills:{skill:level|{level,boostable}}, items:{id:n}}
--   stages [{id, journal, objectives[], npc, next, final, choices:[{id,label,flags,next,dialogue}],
--            dialogue:{progress,advance,choice}, onEnter:{cutscene,flags}}]
--   unlocks [{type:area|gate|shortcut|shop|spell|teleport|dialogue|flag|item, id, label, ifFlags, ...}]
--   lamps [{amount | perLevel, minLevel, skills?, label?}]     (claimed later with quest_lamp)
--   cutscenes {name:{name, steps[]}}, onComplete {cutscene}, journalDone, journalVariants, branchDialogue
-- Player progress (player_quests.progress): numeric keys = objective counts of the current stage,
--   _stage, _flags {}, _done [stage ids, in order], _seen [cutscenes], _xp (baselines).
-- Player-wide (player_saves.game_flags): unlocks {id:{...}}, questLamps [...], questFlags {"key.flag":v}.
-- Other systems read: eldervale_private.player_unlocked(uid,id), eldervale_private.quest_flag(uid,name),
--   eldervale_private.quest_points(uid).
begin;
set local lock_timeout='5s';

create table if not exists eldervale_private.game_settings(key text primary key, value jsonb, updated_at timestamptz default now(), updated_by uuid);

create or replace function eldervale_private.quest_v2_skills() returns text[] language sql immutable set search_path='' as $$
 select array['attack','strength','defence','hitpoints','ranged','magic','prayer','mining','woodcutting','fishing','cooking','smithing','crafting','firemaking','fletching','herblore','farming','runecrafting','construction','hunter','agility','thieving']
$$;

-- Does this quest use any v2 field (the console routes such saves through quest_v2_admin)?
create or replace function eldervale_private.quest_v2_uses(d jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(d)='object' and (d ?| array['stages','unlocks','lamps','cutscenes','onComplete','journalDone','journalVariants','branchDialogue'] or jsonb_typeof(d->'requirements')='object'),false)
$$;

create or replace function eldervale_private.quest_v2_staged(d jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(d->'stages')='array' and jsonb_array_length(d->'stages')>0,false)
$$;

-- The current stage object (null for a quest without stages).
create or replace function eldervale_private.quest_v2_stage(d jsonb, prog jsonb) returns jsonb language sql immutable set search_path='' as $$
 select case when eldervale_private.quest_v2_staged(d) then
  coalesce((select s.value from jsonb_array_elements(d->'stages') s where s.value->>'id'=prog->>'_stage' limit 1),d->'stages'->0) end
$$;

-- The objectives that count right now: the current stage's, or the quest's own.
create or replace function eldervale_private.quest_v2_objectives(d jsonb, prog jsonb) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(case when eldervale_private.quest_v2_staged(d) then eldervale_private.quest_v2_stage(d,prog)->'objectives' else d->'objectives' end,'[]'::jsonb)
$$;

-- Where a stage leads: the chosen option's next, the stage's next, else the following stage.
create or replace function eldervale_private.quest_v2_next(d jsonb, stage jsonb, choice text default null) returns text language sql immutable set search_path='' as $$
 select coalesce(
  (select nullif(c.value->>'next','') from jsonb_array_elements(coalesce(stage->'choices','[]'::jsonb)) c where c.value->>'id'=choice limit 1),
  case when coalesce((stage->>'final')::boolean,false) then null else coalesce(nullif(stage->>'next',''),
   (select (d->'stages'->(s.ord::integer))->>'id' from jsonb_array_elements(d->'stages') with ordinality s(value,ord) where s.value->>'id'=stage->>'id' limit 1)) end)
$$;

create or replace function eldervale_private.quest_v2_final(d jsonb, stage jsonb) returns boolean language sql immutable set search_path='' as $$
 select jsonb_array_length(coalesce(stage->'choices','[]'::jsonb))=0 and eldervale_private.quest_v2_next(d,stage,null) is null
$$;

-- Are these objectives finished? Collect objectives count what is carried (minus equipped).
create or replace function eldervale_private.quest_v2_done(uid uuid, objectives jsonb, prog jsonb) returns boolean language sql stable set search_path='' as $$
 select not exists(select 1 from jsonb_array_elements(coalesce(objectives,'[]'::jsonb)) with ordinality o(value,ord) where
  (case when o.value->>'type'='collect' then greatest(0,eldervale_private.item_quantity(uid,o.value->>'target')-eldervale_private.equipment_reserved(uid,(select c.data from eldervale_private.realm_catalog c where c.id='item:'||(o.value->>'target'))))
   else coalesce((prog->>((o.ord-1)::text))::integer,0) end)<coalesce((o.value->>'amount')::integer,1))
$$;

create or replace function eldervale_private.quest_v2_leave(prog jsonb, stage_id text) returns jsonb language sql immutable set search_path='' as $$
 select coalesce(prog,'{}'::jsonb)||jsonb_build_object('_done',(case when coalesce(prog->'_done','[]'::jsonb)?stage_id then coalesce(prog->'_done','[]'::jsonb) else coalesce(prog->'_done','[]'::jsonb)||to_jsonb(stage_id) end))
$$;

-- Enter a stage: clear the objective counts, add the stage's entry flags, take XP baselines.
create or replace function eldervale_private.quest_v2_enter(uid uuid, d jsonb, prog jsonb, stage_id text) returns jsonb language plpgsql stable set search_path='' as $$
declare st jsonb;s public.player_saves;out jsonb:=coalesce(prog,'{}'::jsonb);k text;
begin
 select x.value into st from jsonb_array_elements(d->'stages') x where x.value->>'id'=stage_id limit 1;
 if st is null then raise exception 'Unknown quest stage %',stage_id;end if;
 select * into s from public.player_saves where user_id=uid;
 for k in select t.key from jsonb_object_keys(out) as t(key) where t.key~'^[0-9]+$' loop out:=out-k;end loop;
 return out||jsonb_build_object('_stage',stage_id,
  '_flags',coalesce(out->'_flags','{}'::jsonb)||(case when jsonb_typeof(st->'onEnter'->'flags')='object' then st->'onEnter'->'flags' else '{}'::jsonb end),
  '_xp',coalesce((select jsonb_object_agg(x.value->>'skill',eldervale_private.quest_xp(s,x.value->>'skill')) from jsonb_array_elements(coalesce(st->'objectives','[]'::jsonb)) x where x.value->>'type'='xp'),'{}'::jsonb));
end $$;

-- Progress for a quest just accepted (base holds the legacy XP baselines).
create or replace function eldervale_private.quest_v2_initial(uid uuid, d jsonb, base jsonb) returns jsonb language plpgsql stable set search_path='' as $$
begin
 if not eldervale_private.quest_v2_staged(d) then return base;end if;
 return eldervale_private.quest_v2_enter(uid,d,coalesce(base,'{}'::jsonb)||'{"_flags":{},"_done":[],"_seen":[]}'::jsonb,d->'stages'->0->>'id');
end $$;

create or replace function eldervale_private.quest_v2_consume(uid uuid, objectives jsonb) returns void language plpgsql set search_path='' as $$
declare o jsonb;
begin
 for o in select value from jsonb_array_elements(coalesce(objectives,'[]'::jsonb)) where value->>'type'='collect' loop
  perform eldervale_private.item_change(uid,o->>'target',-(o->>'amount')::integer);
 end loop;
end $$;

-- Stages without a report NPC or a choice advance by themselves once their objectives are done.
create or replace function eldervale_private.quest_v2_autoadvance(uid uuid) returns void language plpgsql set search_path='' as $$
declare r record;st jsonb;nxt text;prog jsonb;
begin
 if uid is null then return;end if;
 for r in select * from eldervale_private.player_quests where user_id=uid and completed_at is null and not progress?'_reset' and jsonb_typeof(data->'stages')='array' for update loop
  prog:=r.progress;
  for n in 1..8 loop
   st:=eldervale_private.quest_v2_stage(r.data,prog);
   exit when st is null or coalesce(st->>'npc','')<>'' or jsonb_array_length(coalesce(st->'choices','[]'::jsonb))>0;
   nxt:=eldervale_private.quest_v2_next(r.data,st,null);
   exit when nxt is null or not eldervale_private.quest_v2_done(uid,st->'objectives',prog);
   prog:=eldervale_private.quest_v2_enter(uid,r.data,eldervale_private.quest_v2_leave(prog,st->>'id'),nxt);
  end loop;
  if prog is distinct from r.progress then update eldervale_private.player_quests set progress=prog where user_id=uid and quest_id=r.quest_id;end if;
 end loop;
end $$;

-- Quest points: completed quests (each data.questPoints, default 1); a finished castle training
-- counts its chain even for players whose training predates per-quest records.
create or replace function eldervale_private.quest_points(uid uuid) returns integer language sql stable security definer set search_path='' as $$
 select coalesce(sum(greatest(0,coalesce((q.data->>'questPoints')::integer,1))),0)::integer
 from eldervale_private.quest_definitions q
 left join eldervale_private.player_quests p on p.quest_id=q.id and p.user_id=uid
 where (p.completed_at is not null and not p.progress?'_reset')
    or (q.data->>'chain'='tutorial' and coalesce((select (s.game_flags->'tutorial'->>'done')::boolean from public.player_saves s where s.user_id=uid),false))
$$;

create or replace function eldervale_private.quest_done_key(uid uuid, k text) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from eldervale_private.quest_definitions q left join eldervale_private.player_quests p on p.quest_id=q.id and p.user_id=uid
  where q.data->>'key'=k and ((p.completed_at is not null and not p.progress?'_reset')
   or (q.data->>'chain'='tutorial' and coalesce((select (s.game_flags->'tutorial'->>'done')::boolean from public.player_saves s where s.user_id=uid),false))))
$$;

-- Unmet requirements as readable lines (empty array = may start). Skill levels are real
-- (unboosted) levels, the OSRS default for quest gates. A flat {skill:level} object (the
-- original client-only format) is read as skills.
create or replace function eldervale_private.quest_v2_missing(uid uuid, d jsonb) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare r jsonb:=d->'requirements';out jsonb:='[]'::jsonb;s public.player_saves;k text;v jsonb;need integer;nm text;sk jsonb;
begin
 if jsonb_typeof(r) is distinct from 'object' then return out;end if;
 select * into s from public.player_saves where user_id=uid;
 if jsonb_typeof(r->'quests')='array' then
  for k in select jsonb_array_elements_text(r->'quests') loop
   if not eldervale_private.quest_done_key(uid,k) then
    select q.data->>'name' into nm from eldervale_private.quest_definitions q where q.data->>'key'=k limit 1;
    out:=out||to_jsonb('Complete '||coalesce(nm,k));
   end if;
  end loop;
 end if;
 if jsonb_typeof(r->'qp')='number' and (r->>'qp')::integer>eldervale_private.quest_points(uid) then out:=out||to_jsonb((r->>'qp')||' Quest Points');end if;
 if jsonb_typeof(r->'combat')='number' and (r->>'combat')::integer>eldervale_private.combat_level(coalesce(s.skills,'{}'::jsonb)) then out:=out||to_jsonb('Combat level '||(r->>'combat'));end if;
 sk:=(case when jsonb_typeof(r->'skills')='object' then r->'skills' else (select coalesce(jsonb_object_agg(e.key,e.value),'{}'::jsonb) from jsonb_each(r) e where e.key not in ('quests','qp','skills','items','combat') and jsonb_typeof(e.value)='number') end);
 for k,v in select key,value from jsonb_each(sk) loop
  need:=(case when jsonb_typeof(v)='object' then (v->>'level')::integer when jsonb_typeof(v)='number' then (v#>>'{}')::integer else 0 end);
  if need>1 and eldervale_private.xp_level(eldervale_private.quest_xp(s,k))<need then out:=out||to_jsonb('Level '||need||' '||initcap(k));end if;
 end loop;
 if jsonb_typeof(r->'items')='object' then
  for k,v in select key,value from jsonb_each(r->'items') loop
   if eldervale_private.item_quantity(uid,k)<coalesce((v#>>'{}')::integer,1) then
    select c.data->>'name' into nm from eldervale_private.realm_catalog c where c.id='item:'||k;
    out:=out||to_jsonb('Bring '||coalesce((v#>>'{}'),'1')||' × '||coalesce(nm,k));
   end if;
  end loop;
 end if;
 return out;
end $$;

create or replace function eldervale_private.quest_v2_require(uid uuid, d jsonb) returns void language plpgsql stable security definer set search_path='' as $$
declare m jsonb:=eldervale_private.quest_v2_missing(uid,d);
begin
 if jsonb_array_length(m)>0 then raise exception 'You need: %',(select string_agg(x,', ') from jsonb_array_elements_text(m) x);end if;
end $$;

-- Hand-in view: for a staged quest only the final stage can be handed in, and its objectives count.
create or replace function eldervale_private.quest_v2_handin(d jsonb, prog jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare st jsonb:=eldervale_private.quest_v2_stage(d,prog);
begin
 if st is null then return d;end if;
 if not eldervale_private.quest_v2_final(d,st) then raise exception 'You have more to do before this quest is finished';end if;
 return d||jsonb_build_object('objectives',coalesce(st->'objectives','[]'::jsonb));
end $$;

-- Does every ifFlags entry match the quest flags?
create or replace function eldervale_private.quest_v2_flags_match(cond jsonb, flags jsonb) returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(cond) is distinct from 'object' or not exists(select 1 from jsonb_each(cond) c where coalesce(flags->c.key,'false'::jsonb)<>c.value)
$$;

-- Completion extras: pending XP lamps, unlocks (filtered by the quest's flags), completion flags.
create or replace function eldervale_private.quest_v2_rewards(uid uuid, qid uuid, d jsonb) returns void language plpgsql set search_path='' as $$
declare g jsonb;lamps jsonb;unl jsonb;qf jsonb;l jsonb;u jsonb;i integer:=0;k text;prog jsonb;st jsonb;f record;
begin
 if not eldervale_private.quest_v2_uses(d) then return;end if;
 k:=coalesce(nullif(d->>'key',''),qid::text);
 select progress into prog from eldervale_private.player_quests where user_id=uid and quest_id=qid for update;
 st:=eldervale_private.quest_v2_stage(d,prog);
 if st is not null then
  prog:=eldervale_private.quest_v2_leave(prog,st->>'id');
  update eldervale_private.player_quests set progress=prog where user_id=uid and quest_id=qid;
 end if;
 select coalesce(game_flags,'{}'::jsonb) into g from public.player_saves where user_id=uid for update;
 lamps:=coalesce((select jsonb_agg(x.value) from jsonb_array_elements(coalesce(g->'questLamps','[]'::jsonb)) x where x.value->>'quest' is distinct from qid::text),'[]'::jsonb);
 for l in select value from jsonb_array_elements(coalesce(d->'lamps','[]'::jsonb)) loop
  lamps:=lamps||jsonb_build_array((l-'key'-'quest')||jsonb_build_object('key',qid::text||':'||i,'quest',qid::text,'questName',d->>'name'));i:=i+1;
 end loop;
 unl:=coalesce(g->'unlocks','{}'::jsonb);
 for u in select value from jsonb_array_elements(coalesce(d->'unlocks','[]'::jsonb)) loop
  if eldervale_private.quest_v2_flags_match(u->'ifFlags',prog->'_flags') then
   unl:=unl||jsonb_build_object(u->>'id',(u-'ifFlags')||jsonb_build_object('quest',qid::text,'questKey',k,'at',now()));
  end if;
 end loop;
 qf:=coalesce(g->'questFlags','{}'::jsonb)||jsonb_build_object(k||'.complete',true);
 for f in select key,value from jsonb_each(coalesce(prog->'_flags','{}'::jsonb)) loop qf:=qf||jsonb_build_object(k||'.'||f.key,f.value);end loop;
 for u in select value from jsonb_each(unl) loop if u->>'type'='flag' and u->>'quest'=qid::text then qf:=qf||jsonb_build_object(u->>'id',true);end if;end loop;
 update public.player_saves set game_flags=g||jsonb_build_object('questLamps',lamps,'unlocks',unl,'questFlags',qf) where user_id=uid;
end $$;

-- Read helpers for other systems (gates, shortcuts, shops, caves, NPC scripts).
create or replace function eldervale_private.player_unlocked(uid uuid, unlock_id text) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select s.game_flags->'unlocks'?unlock_id from public.player_saves s where s.user_id=uid),false)
$$;
-- name: "questKey.flag" (completion flags, choices) or a flag unlock id; also live flags of a quest in progress.
create or replace function eldervale_private.quest_flag(uid uuid, name text) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce((select s.game_flags->'questFlags'->name from public.player_saves s where s.user_id=uid),
  (select p.progress->'_flags'->(substr(name,length(q.data->>'key')+2)) from eldervale_private.player_quests p join eldervale_private.quest_definitions q on q.id=p.quest_id
    where p.user_id=uid and not p.progress?'_reset' and name like (q.data->>'key')||'.%' limit 1))
$$;

-- Small per-player quest state sent with every quest reply and sync.
create or replace function eldervale_private.quest_state(uid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('qp',eldervale_private.quest_points(uid),
  'unlocks',coalesce(s.game_flags->'unlocks','{}'::jsonb),'lamps',coalesce(s.game_flags->'questLamps','[]'::jsonb),'flags',coalesce(s.game_flags->'questFlags','{}'::jsonb),
  'guidance',coalesce((select g.value from eldervale_private.game_settings g where g.key='quest_guidance'),'{}'::jsonb))
 from public.player_saves s where s.user_id=uid
$$;

-- Player commands: quest_advance, quest_choice, quest_cutscene, quest_lamp, quest_teleport.
create or replace function eldervale_private.quest_v2_request(session_id uuid, command text, payload jsonb, request_id uuid, event_cursor bigint) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;p eldervale_private.realm_players;s public.player_saves;r eldervale_private.player_quests;st jsonb;ch jsonb;nxt text;npc text;prog jsonb;k text;lamp jsonb;u jsonb;lvl integer;amt integer;busy boolean;uid uuid:=auth.uid();
begin
 result:=eldervale_private.realm_request_before_quests($1,'sync','{}',null,$5);
 perform pg_advisory_xact_lock(736211);
 if request_id is null or payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>1000 then raise exception 'Invalid quest request';end if;
 select * into p from eldervale_private.realm_players where user_id=uid and realm_players.session_id=$1 for update;if not found then raise exception 'Session expired';end if;
 if not exists(select 1 from eldervale_private.realm_requests x where x.user_id=uid and x.request_id=$4) then
  select * into s from public.player_saves where user_id=uid for update;
  if command in ('quest_advance','quest_choice','quest_cutscene') then
   if coalesce(payload->>'id','')!~'^[0-9a-fA-F-]{36}$' then raise exception 'Quest not found';end if;
   perform eldervale_private.quest_refresh(uid);
   select * into r from eldervale_private.player_quests where user_id=uid and quest_id=(payload->>'id')::uuid for update;
   if r.user_id is null or r.progress?'_reset' then raise exception 'Accept this quest first';end if;
   if command='quest_cutscene' then
    k:=coalesce(payload->>'cutscene','');if k!~'^[a-z0-9_-]{1,40}$' then raise exception 'Invalid cutscene';end if;
    if not coalesce(r.progress->'_seen','[]'::jsonb)?k then update eldervale_private.player_quests set progress=progress||jsonb_build_object('_seen',coalesce(progress->'_seen','[]'::jsonb)||to_jsonb(k)) where user_id=uid and quest_id=r.quest_id;end if;
   else
    if r.completed_at is not null then raise exception 'Quest already completed';end if;
    st:=eldervale_private.quest_v2_stage(r.data,r.progress);if st is null then raise exception 'This quest has no stages';end if;
    npc:=coalesce(nullif(st->>'npc',''),r.data->>'giver');
    if not exists(select 1 from eldervale_private.realm_actors a where a.id=npc and not a.deleted and a.hp>0 and sqrt(power(a.x-p.x,2)+power(a.z-p.z,2))<6) then raise exception 'Speak to them in person';end if;
    if not eldervale_private.quest_v2_done(uid,st->'objectives',r.progress) then raise exception 'You have not finished this part yet';end if;
    prog:=r.progress;
    if command='quest_choice' then
     select c.value into ch from jsonb_array_elements(coalesce(st->'choices','[]'::jsonb)) c where c.value->>'id'=payload->>'choice' limit 1;
     if ch is null then raise exception 'Choose one of the options';end if;
     nxt:=eldervale_private.quest_v2_next(r.data,st,ch->>'id');
     prog:=prog||jsonb_build_object('_flags',coalesce(prog->'_flags','{}'::jsonb)||(case when jsonb_typeof(ch->'flags')='object' then ch->'flags' else '{}'::jsonb end)||jsonb_build_object('choice.'||(st->>'id'),ch->>'id'));
    else
     if jsonb_array_length(coalesce(st->'choices','[]'::jsonb))>0 then raise exception 'Decide what to do first';end if;
     nxt:=eldervale_private.quest_v2_next(r.data,st,null);
    end if;
    if nxt is null then raise exception 'Return to the quest giver to finish';end if;
    perform eldervale_private.quest_v2_consume(uid,st->'objectives');
    prog:=eldervale_private.quest_v2_enter(uid,r.data,eldervale_private.quest_v2_leave(prog,st->>'id'),nxt);
    update eldervale_private.player_quests set progress=prog where user_id=uid and quest_id=r.quest_id;
   end if;
  elsif command='quest_lamp' then
   select x.value into lamp from jsonb_array_elements(coalesce(s.game_flags->'questLamps','[]'::jsonb)) x where x.value->>'key'=payload->>'key' limit 1;
   if lamp is null then raise exception 'That lamp has already been used';end if;
   k:=coalesce(payload->>'skill','');
   if not (k=any(eldervale_private.quest_v2_skills())) or (jsonb_typeof(lamp->'skills')='array' and not (lamp->'skills')?k) then raise exception 'Choose a skill this lamp can teach';end if;
   lvl:=eldervale_private.xp_level(eldervale_private.quest_xp(s,k));
   if lvl<coalesce((lamp->>'minLevel')::integer,1) then raise exception 'Your % level must be at least % to use this lamp',initcap(k),lamp->>'minLevel';end if;
   amt:=least(1000000,greatest(1,(case when lamp?'perLevel' then (lamp->>'perLevel')::integer*lvl else coalesce((lamp->>'amount')::integer,0) end)));
   perform eldervale_private.skill_xp(uid,k,amt);
   update public.player_saves set game_flags=game_flags||jsonb_build_object('questLamps',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(coalesce(game_flags->'questLamps','[]'::jsonb)) x where x.value->>'key'<>(lamp->>'key')),'[]'::jsonb)) where user_id=uid;
  elsif command='quest_teleport' then
   u:=coalesce(s.game_flags->'unlocks','{}'::jsonb)->(payload->>'id');
   if u is null or u->>'type'<>'teleport' or jsonb_typeof(u->'x')<>'number' or jsonb_typeof(u->'z')<>'number' then raise exception 'You have not unlocked that teleport';end if;
   if eldervale_private.tutorial_locked(uid) then raise exception 'Finish your training first';end if;
   if exists(select 1 from eldervale_private.realm_actors a where a.target=uid and not a.deleted and a.hp>0) then raise exception 'You cannot teleport during combat';end if;
   if to_regclass('eldervale_private.trades') is not null then
    execute 'select exists(select 1 from eldervale_private.trades where (a=$1 or b=$1) and stage not in (''complete'',''cancelled'',''declined'',''expired''))' into strict busy using uid;
    if busy then raise exception 'Close your trade before teleporting';end if;
   end if;
   if coalesce((s.game_flags->>'questTeleportAt')::timestamptz,'-infinity')>clock_timestamp()-interval '30 seconds' then raise exception 'The teleport needs a moment to recharge';end if;
   update eldervale_private.realm_players set x=(u->>'x')::float8,z=(u->>'z')::float8,floor=0,building=null,path='[]',intent=null,input_until=null,input_x=0,input_z=0 where user_id=uid;
   if to_regclass('eldervale_private.tile_walkers') is not null then execute 'update eldervale_private.tile_walkers set route=''[]'',goal=null where user_id=$1' using uid;end if;
   update public.player_saves set world_position=coalesce(world_position,'{}'::jsonb)||jsonb_build_object('x',(u->>'x')::float8,'y',(u->>'z')::float8,'floor',0,'building',null),
    game_flags=game_flags||jsonb_build_object('questTeleportAt',clock_timestamp()) where user_id=uid;
  else raise exception 'Unknown quest command';
  end if;
  if eldervale_private.inventory_used(uid)>eldervale_private.inventory_capacity() then raise exception 'Make inventory space first';end if;
  insert into eldervale_private.realm_requests(user_id,request_id,result) values(uid,$4,'{}');
  update eldervale_private.realm_players set last_command=clock_timestamp() where user_id=uid;
 end if;
 result:=eldervale_private.realm_request_before_quests($1,'sync','{}',null,$5);
 perform eldervale_private.quest_refresh(uid);
 return result||jsonb_build_object('questState',eldervale_private.quest_state(uid),'quests',eldervale_private.quest_snapshot(uid),'tutorial',(select coalesce(game_flags->'tutorial','{}'::jsonb) from public.player_saves where user_id=uid));
end $$;

-- Validation of the v2 fields (fc_quest_check covers the classic fields and every stage's objectives).
create or replace function eldervale_private.quest_v2_check(d jsonb, qid uuid) returns void language plpgsql stable security definer set search_path='' as $$
declare r jsonb:=d->'requirements';st jsonb;c jsonb;u jsonb;l jsonb;k text;v jsonb;ids text[]:='{}';n integer;cur text;steps integer;base jsonb;
 v2 constant text[]:=array['requirements','stages','unlocks','lamps','cutscenes','onComplete','journalDone','journalVariants','branchDialogue'];
 unlock_types constant text[]:=array['area','gate','shortcut','shop','spell','teleport','dialogue','flag','item'];
begin
 if pg_column_size(d)>60000 then raise exception 'Quest data must be under 60 KB';end if;
 if r is not null and jsonb_typeof(r)<>'null' then
  if jsonb_typeof(r)<>'object' then raise exception 'Requirements must be an object';end if;
  if r?'quests' and (jsonb_typeof(r->'quests')<>'array' or jsonb_array_length(r->'quests')>10) then raise exception 'Required quests: a list of up to 10 quest keys';end if;
  for k in select jsonb_array_elements_text(coalesce(r->'quests','[]'::jsonb)) loop
   if k=coalesce(d->>'key','') then raise exception 'A quest cannot require itself';end if;
   if not exists(select 1 from eldervale_private.quest_definitions q where q.data->>'key'=k and q.id<>qid) then raise exception 'Required quest key % does not exist',k;end if;
  end loop;
  if r?'qp' and (jsonb_typeof(r->'qp')<>'number' or (r->>'qp')::numeric not between 0 and 500) then raise exception 'Quest point requirement must be 0–500';end if;
  if r?'combat' and (jsonb_typeof(r->'combat')<>'number' or (r->>'combat')::numeric not between 3 and 126) then raise exception 'Combat requirement must be 3–126';end if;
  if r?'skills' then
   if jsonb_typeof(r->'skills')<>'object' then raise exception 'Skill requirements must be an object';end if;
   for k,v in select key,value from jsonb_each(r->'skills') loop
    if not (k=any(eldervale_private.quest_v2_skills())) then raise exception 'Unknown skill %',k;end if;
    if coalesce((case when jsonb_typeof(v)='object' then v->>'level' when jsonb_typeof(v)='number' then v#>>'{}' end)::numeric,0) not between 1 and 99 then raise exception 'Skill requirement % must be level 1–99',k;end if;
   end loop;
  end if;
  if r?'items' then
   if jsonb_typeof(r->'items')<>'object' or (select count(*) from jsonb_object_keys(r->'items'))>8 then raise exception 'Item requirements: up to eight items';end if;
   for k,v in select key,value from jsonb_each(r->'items') loop
    if not exists(select 1 from eldervale_private.realm_catalog x where x.id='item:'||k) or jsonb_typeof(v)<>'number' or (v#>>'{}')::numeric not between 1 and 1000 then raise exception 'Invalid item requirement %',k;end if;
   end loop;
  end if;
 end if;
 if d?'cutscenes' and jsonb_typeof(d->'cutscenes')<>'null' then
  if jsonb_typeof(d->'cutscenes')<>'object' or (select count(*) from jsonb_object_keys(d->'cutscenes'))>6 or pg_column_size(d->'cutscenes')>20000 then raise exception 'Up to six cutscenes under 20 KB';end if;
  for k,v in select key,value from jsonb_each(d->'cutscenes') loop
   if k!~'^[a-z0-9_-]{1,40}$' then raise exception 'Cutscene name %: lowercase letters, digits, - or _',k;end if;
   if jsonb_typeof(v->'steps')<>'array' or jsonb_array_length(v->'steps') not between 1 and 30 then raise exception 'Cutscene %: 1–30 steps',k;end if;
   for c in select value from jsonb_array_elements(v->'steps') loop
    if jsonb_typeof(c)<>'object' or not (c ?| array['fade','title','shot','say','wait','npc','walk']) then raise exception 'Cutscene %: unknown step',k;end if;
    if c?'say' then perform eldervale_private.fc_check_dialogue(jsonb_build_array(c->'say'),'Cutscene '||k);end if;
    if c?'walk' then raise exception 'Cutscene %: quest cutscenes cannot walk the player (use camera shots and NPC moves)',k;end if;
   end loop;
  end loop;
 end if;
 if d?'onComplete' and jsonb_typeof(d->'onComplete')<>'null' then
  if jsonb_typeof(d->'onComplete')<>'object' or (d->'onComplete'?'cutscene' and not coalesce(d->'cutscenes','{}'::jsonb)?(d->'onComplete'->>'cutscene')) then raise exception 'Completion cutscene must be one of the quest''s cutscenes';end if;
 end if;
 if eldervale_private.quest_v2_staged(d) then
  if jsonb_array_length(d->'stages')>20 then raise exception 'Up to 20 stages';end if;
  for st in select value from jsonb_array_elements(d->'stages') loop
   k:=coalesce(st->>'id','');
   if k!~'^[a-z0-9_-]{1,32}$' then raise exception 'Stage id %: 1–32 lowercase letters, digits, - or _',k;end if;
   if k=any(ids) then raise exception 'Stage id % is used twice',k;end if;ids:=ids||k;
  end loop;
  base:=d-v2;
  for st in select value from jsonb_array_elements(d->'stages') loop
   k:=st->>'id';
   if length(trim(coalesce(st->>'journal',''))) not between 1 and 800 then raise exception 'Stage %: journal text must be 1–800 characters',k;end if;
   if st?'objectives' and jsonb_typeof(st->'objectives')<>'array' then raise exception 'Stage %: objectives must be a list',k;end if;
   if jsonb_array_length(coalesce(st->'objectives','[]'::jsonb))>0 then
    begin perform eldervale_private.fc_quest_check(base||jsonb_build_object('objectives',st->'objectives'),qid);
    exception when raise_exception then raise exception 'Stage %: %',k,sqlerrm;end;
   end if;
   if coalesce(st->>'npc','')<>'' and not exists(select 1 from eldervale_private.realm_actors a where a.id=st->>'npc' and not a.deleted and a.data->>'kind'='npc') then raise exception 'Stage %: choose an existing NPC to report to',k;end if;
   if coalesce(st->>'next','')<>'' and not (st->>'next'=any(ids)) then raise exception 'Stage %: next stage % does not exist',k,st->>'next';end if;
   if st->>'next'=k then raise exception 'Stage % cannot lead to itself',k;end if;
   if st?'dialogue' and jsonb_typeof(st->'dialogue')<>'null' then
    if jsonb_typeof(st->'dialogue')<>'object' or exists(select 1 from jsonb_object_keys(st->'dialogue') x where x not in ('progress','advance','choice')) then raise exception 'Stage %: dialogue has progress, advance and choice',k;end if;
    for c in select value from jsonb_each(st->'dialogue') loop perform eldervale_private.fc_check_dialogue(c,'Stage '||k);end loop;
   end if;
   if st?'choices' and jsonb_typeof(st->'choices')<>'null' then
    if jsonb_typeof(st->'choices')<>'array' or jsonb_array_length(st->'choices')>4 then raise exception 'Stage %: up to four choices',k;end if;
    for c in select value from jsonb_array_elements(st->'choices') loop
     if coalesce(c->>'id','')!~'^[a-z0-9_-]{1,32}$' or length(trim(coalesce(c->>'label',''))) not between 1 and 120 then raise exception 'Stage %: each choice needs an id and a 1–120 character label',k;end if;
     if c?'flags' and (jsonb_typeof(c->'flags')<>'object' or pg_column_size(c->'flags')>500 or exists(select 1 from jsonb_each(c->'flags') f where f.key!~'^[a-z0-9_]{1,32}$' or jsonb_typeof(f.value) not in ('boolean','number','string'))) then raise exception 'Stage %: choice flags are a small object of simple values',k;end if;
     if coalesce(eldervale_private.quest_v2_next(d,st,c->>'id'),'')='' then raise exception 'Stage %: choice % must lead to a stage',k,c->>'id';end if;
     if not (eldervale_private.quest_v2_next(d,st,c->>'id')=any(ids)) or eldervale_private.quest_v2_next(d,st,c->>'id')=k then raise exception 'Stage %: choice % leads to a missing stage',k,c->>'id';end if;
     perform eldervale_private.fc_check_dialogue(c->'dialogue','Choice '||(c->>'id'));
    end loop;
   end if;
   if st?'onEnter' and jsonb_typeof(st->'onEnter')<>'null' then
    if jsonb_typeof(st->'onEnter')<>'object' then raise exception 'Stage %: onEnter must be an object',k;end if;
    if st->'onEnter'?'cutscene' and not coalesce(d->'cutscenes','{}'::jsonb)?(st->'onEnter'->>'cutscene') then raise exception 'Stage %: cutscene % is not defined',k,st->'onEnter'->>'cutscene';end if;
    if st->'onEnter'?'flags' and (jsonb_typeof(st->'onEnter'->'flags')<>'object' or pg_column_size(st->'onEnter'->'flags')>500) then raise exception 'Stage %: entry flags must be a small object',k;end if;
   end if;
   -- Items are handed to someone: a stage with collect objectives needs a report NPC, a choice, or to be the last stage.
   if exists(select 1 from jsonb_array_elements(coalesce(st->'objectives','[]'::jsonb)) o where o.value->>'type'='collect')
      and coalesce(st->>'npc','')='' and jsonb_array_length(coalesce(st->'choices','[]'::jsonb))=0 and not eldervale_private.quest_v2_final(d,st) then
    raise exception 'Stage %: collected items need an NPC to hand them to',k;
   end if;
  end loop;
  -- Following the default route from any stage must end at a final stage (no loops).
  foreach k in array ids loop
   cur:=k;steps:=0;
   loop
    select value into st from jsonb_array_elements(d->'stages') where value->>'id'=cur;
    exit when jsonb_array_length(coalesce(st->'choices','[]'::jsonb))>0;
    cur:=eldervale_private.quest_v2_next(d,st,null);
    exit when cur is null;
    steps:=steps+1;if steps>20 then raise exception 'Stages loop forever starting at %',k;end if;
   end loop;
  end loop;
 end if;
 if d?'unlocks' and jsonb_typeof(d->'unlocks')<>'null' then
  if jsonb_typeof(d->'unlocks')<>'array' or jsonb_array_length(d->'unlocks')>12 then raise exception 'Up to 12 unlocks';end if;
  for u in select value from jsonb_array_elements(d->'unlocks') loop
   if not (coalesce(u->>'type','')=any(unlock_types)) then raise exception 'Unlock type must be one of %',array_to_string(unlock_types,', ');end if;
   if coalesce(u->>'id','')!~'^[a-z0-9_.:-]{2,60}$' then raise exception 'Unlock id: 2–60 lowercase letters, digits, . : - or _';end if;
   if length(coalesce(u->>'label',''))>120 then raise exception 'Unlock label is limited to 120 characters';end if;
   if u->>'type'='teleport' and (jsonb_typeof(u->'x') is distinct from 'number' or jsonb_typeof(u->'z') is distinct from 'number' or abs((u->>'x')::numeric)>4500 or abs((u->>'z')::numeric)>4500) then raise exception 'Teleport % needs x and z',u->>'id';end if;
   if u->>'type'='dialogue' then
    if not exists(select 1 from eldervale_private.realm_actors a where a.id=u->>'npc' and not a.deleted and a.data->>'kind'='npc') then raise exception 'Dialogue unlock %: choose an NPC',u->>'id';end if;
    if jsonb_typeof(u->'lines')<>'array' or jsonb_array_length(u->'lines')<1 then raise exception 'Dialogue unlock %: add at least one line',u->>'id';end if;
    perform eldervale_private.fc_check_dialogue(u->'lines','Unlock '||(u->>'id'));
   end if;
   if u?'ifFlags' and jsonb_typeof(u->'ifFlags') not in ('object','null') then raise exception 'Unlock %: ifFlags must be an object',u->>'id';end if;
  end loop;
 end if;
 if d?'lamps' and jsonb_typeof(d->'lamps')<>'null' then
  if jsonb_typeof(d->'lamps')<>'array' or jsonb_array_length(d->'lamps')>4 then raise exception 'Up to four XP lamps';end if;
  for l in select value from jsonb_array_elements(d->'lamps') loop
   if (l?'amount')=(l?'perLevel') then raise exception 'Each lamp gives a fixed amount or an amount per level';end if;
   if l?'amount' and (jsonb_typeof(l->'amount')<>'number' or (l->>'amount')::numeric not between 1 and 1000000) then raise exception 'Lamp XP must be 1–1,000,000';end if;
   if l?'perLevel' and (jsonb_typeof(l->'perLevel')<>'number' or (l->>'perLevel')::numeric not between 1 and 1000) then raise exception 'Lamp XP per level must be 1–1000';end if;
   if l?'minLevel' and (jsonb_typeof(l->'minLevel')<>'number' or (l->>'minLevel')::numeric not between 1 and 99) then raise exception 'Lamp minimum level must be 1–99';end if;
   if l?'skills' and (jsonb_typeof(l->'skills')<>'array' or exists(select 1 from jsonb_array_elements_text(l->'skills') x where not (x=any(eldervale_private.quest_v2_skills())))) then raise exception 'Lamp skills must be skill names';end if;
  end loop;
 end if;
 for k in select unnest(array['journalDone']) loop
  if length(coalesce(d->>k,''))>800 then raise exception '% is limited to 800 characters',k;end if;
 end loop;
 if d?'journalVariants' and (jsonb_typeof(d->'journalVariants')<>'array' or jsonb_array_length(d->'journalVariants')>6 or exists(select 1 from jsonb_array_elements(d->'journalVariants') x where length(coalesce(x.value->>'text','')) not between 1 and 800)) then raise exception 'Journal variants: up to six {ifFlags,text}';end if;
 if d?'branchDialogue' then
  if jsonb_typeof(d->'branchDialogue')<>'array' or jsonb_array_length(d->'branchDialogue')>8 then raise exception 'Branch dialogue: up to eight entries';end if;
  for c in select value from jsonb_array_elements(d->'branchDialogue') loop
   if coalesce(c->>'stage','') not in ('offer','progress','complete') then raise exception 'Branch dialogue replaces offer, progress or complete';end if;
   perform eldervale_private.fc_check_dialogue(c->'lines','Branch dialogue');
  end loop;
 end if;
end $$;

-- Owner console: v2 quest saves, the per-player quest state inspector and guidance settings.
create or replace function eldervale_private.quest_v2_admin(command text, payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare d jsonb;old jsonb;result jsonb;id_text text;uid uuid;q eldervale_private.quest_definitions;r eldervale_private.player_quests;prog jsonb;g jsonb;v jsonb;first_obj jsonb;
 v2 constant text[]:=array['requirements','stages','unlocks','lamps','cutscenes','onComplete','journalDone','journalVariants','branchDialogue'];
begin
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>65536 then raise exception 'Invalid console payload';end if;
 if payload?'userId' then
  if coalesce(payload->>'userId','')!~'^[0-9a-fA-F-]{36}$' then raise exception 'Choose a player';end if;uid:=(payload->>'userId')::uuid;
 end if;
 if command in ('qv2_set_stage','qv2_set_flags','qv2_reset','qv2_complete') then
  if uid is null then raise exception 'Choose a player';end if;
  if coalesce(payload->>'id','')!~'^[0-9a-fA-F-]{36}$' then raise exception 'Choose a quest';end if;
  select * into q from eldervale_private.quest_definitions where id=(payload->>'id')::uuid;if q.id is null then raise exception 'Quest not found';end if;
  select * into r from eldervale_private.player_quests where user_id=uid and quest_id=q.id for update;
  old:=to_jsonb(r);
 end if;
 if command='fc_quest_save' then
  if coalesce(payload->>'id','')<>'' and payload->>'id'!~'^[0-9a-fA-F-]{36}$' then raise exception 'Invalid quest ID';end if;
  id_text:=coalesce(nullif(payload->>'id',''),gen_random_uuid()::text);d:=payload->'data';
  if jsonb_typeof(d) is distinct from 'object' then raise exception 'Quest data must be an object';end if;
  if eldervale_private.quest_v2_staged(d) then
   first_obj:=(select s.value->'objectives' from jsonb_array_elements(d->'stages') s where jsonb_array_length(coalesce(s.value->'objectives','[]'::jsonb))>0 limit 1);
   if first_obj is null then raise exception 'Add at least one objective to a stage';end if;
   d:=d||jsonb_build_object('objectives','[]'::jsonb);
   perform eldervale_private.quest_v2_check(d,id_text::uuid);
   perform eldervale_private.fc_quest_check((d-v2)||jsonb_build_object('objectives',first_obj),id_text::uuid);
  else
   perform eldervale_private.fc_quest_check(d-v2,id_text::uuid);
   perform eldervale_private.quest_v2_check(d,id_text::uuid);
  end if;
  d:=d||jsonb_build_object('name',trim(d->>'name'),'description',trim(d->>'description'),'published',coalesce((d->>'published')::boolean,false));
  select to_jsonb(x) into old from eldervale_private.quest_definitions x where x.id=id_text::uuid for update;
  insert into eldervale_private.quest_definitions(id,data) values(id_text::uuid,d)
   on conflict(id) do update set data=excluded.data,version=quest_definitions.version+1,updated_at=now() returning to_jsonb(quest_definitions) into result;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,id_text,old,result);
  return result;
 elsif command='qv2_player_search' then
  return coalesce((select jsonb_agg(jsonb_build_object('userId',s.user_id,'name',s.character_name) order by s.character_name) from (select user_id,character_name from public.player_saves
   where character_name ilike '%'||replace(replace(coalesce(payload->>'query',''),'%',''),'_','')||'%' order by character_name limit 20) s),'[]'::jsonb);
 elsif command='qv2_player_state' then
  if uid is null then raise exception 'Choose a player';end if;
  return jsonb_build_object('state',eldervale_private.quest_state(uid),'quests',coalesce((select jsonb_agg(jsonb_build_object('id',q2.id,'name',q2.data->>'name','key',q2.data->>'key','staged',eldervale_private.quest_v2_staged(coalesce(p.data,q2.data)),
    'stages',(select coalesce(jsonb_agg(st.value->>'id'),'[]'::jsonb) from jsonb_array_elements(case when eldervale_private.quest_v2_staged(coalesce(p.data,q2.data)) then coalesce(p.data,q2.data)->'stages' else '[]'::jsonb end) st),
    'accepted',p.user_id is not null and not p.progress?'_reset','completed',p.completed_at is not null and not coalesce(p.progress?'_reset',false),'progress',coalesce(p.progress,'{}'::jsonb),
    'missing',eldervale_private.quest_v2_missing(uid,q2.data)) order by q2.data->>'chain',(q2.data->>'order')::numeric nulls last,q2.data->>'name')
   from eldervale_private.quest_definitions q2 left join eldervale_private.player_quests p on p.quest_id=q2.id and p.user_id=uid),'[]'::jsonb));
 elsif command='qv2_set_stage' then
  if not eldervale_private.quest_v2_staged(coalesce(r.data,q.data)) then raise exception 'This quest has no stages';end if;
  if r.user_id is null or r.progress?'_reset' then
   prog:=eldervale_private.quest_v2_initial(uid,q.data,'{}'::jsonb);
   insert into eldervale_private.player_quests(user_id,quest_id,version,data,progress) values(uid,q.id,q.version,q.data,prog)
    on conflict(user_id,quest_id) do update set version=excluded.version,data=excluded.data,progress=excluded.progress,completed_at=null;
   select * into r from eldervale_private.player_quests where user_id=uid and quest_id=q.id;
  end if;
  prog:=eldervale_private.quest_v2_enter(uid,r.data,r.progress,payload->>'stage');
  update eldervale_private.player_quests set progress=prog,completed_at=null where user_id=uid and quest_id=q.id returning to_jsonb(player_quests) into result;
 elsif command='qv2_set_flags' then
  if r.user_id is null then raise exception 'The player has not started this quest';end if;
  if jsonb_typeof(payload->'flags')<>'object' or pg_column_size(payload->'flags')>2000 then raise exception 'Flags must be a small object (null clears a flag)';end if;
  update eldervale_private.player_quests set progress=progress||jsonb_build_object('_flags',jsonb_strip_nulls(coalesce(progress->'_flags','{}'::jsonb)||(payload->'flags'))) where user_id=uid and quest_id=q.id returning to_jsonb(player_quests) into result;
 elsif command='qv2_reset' then
  if r.user_id is not null then update eldervale_private.player_quests set progress='{"_reset":true}'::jsonb,completed_at=null where user_id=uid and quest_id=q.id returning to_jsonb(player_quests) into result;end if;
  select coalesce(game_flags,'{}'::jsonb) into g from public.player_saves where user_id=uid for update;
  update public.player_saves set game_flags=g||jsonb_build_object(
   'unlocks',coalesce((select jsonb_object_agg(e.key,e.value) from jsonb_each(coalesce(g->'unlocks','{}'::jsonb)) e where e.value->>'quest' is distinct from q.id::text),'{}'::jsonb),
   'questLamps',coalesce((select jsonb_agg(x.value) from jsonb_array_elements(coalesce(g->'questLamps','[]'::jsonb)) x where x.value->>'quest' is distinct from q.id::text),'[]'::jsonb),
   'questFlags',coalesce((select jsonb_object_agg(e.key,e.value) from jsonb_each(coalesce(g->'questFlags','{}'::jsonb)) e where q.data->>'key' is null or e.key not like (q.data->>'key')||'.%'),'{}'::jsonb))
  where user_id=uid;
  result:=coalesce(result,'{}'::jsonb)||jsonb_build_object('reset',true);
 elsif command='qv2_complete' then
  if r.user_id is null or r.progress?'_reset' then raise exception 'The player has not started this quest';end if;
  update eldervale_private.player_quests set completed_at=now() where user_id=uid and quest_id=q.id;
  perform eldervale_private.quest_v2_rewards(uid,q.id,r.data);
  select to_jsonb(x) into result from eldervale_private.player_quests x where x.user_id=uid and x.quest_id=q.id;
 elsif command='qv2_guidance_get' then
  return coalesce((select value from eldervale_private.game_settings where key='quest_guidance'),'{}'::jsonb);
 elsif command='qv2_guidance_set' then
  v:=payload->'value';
  if jsonb_typeof(v)<>'object' or exists(select 1 from jsonb_each(v) e where e.key not in ('trail','minimap','length','markers'))
   or (v?'length' and (jsonb_typeof(v->'length')<>'number' or (v->>'length')::numeric not between 6 and 40))
   or exists(select 1 from jsonb_each(v) e where e.key in ('trail','minimap','markers') and jsonb_typeof(e.value)<>'boolean') then raise exception 'Guidance: trail, minimap and markers on/off, length 6–40 tiles';end if;
  select value into old from eldervale_private.game_settings where key='quest_guidance';
  insert into eldervale_private.game_settings(key,value,updated_at,updated_by) values('quest_guidance',v,now(),auth.uid()) on conflict(key) do update set value=excluded.value,updated_at=excluded.updated_at,updated_by=excluded.updated_by;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,'quest_guidance',old,v);
  return v;
 else raise exception 'Unknown quest console command';
 end if;
 insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,uid::text||':'||q.id::text,old,result);
 return coalesce(result,'{}'::jsonb);
end $$;

-- Guidance tile feed: the server tile grid's flags around a point (blocked tiles, wall edges, doors)
-- so the client breadcrumb trail (quest-trail.js) runs the same BFS as the server (tile-grid.js).
create or replace function public.quest_guide_tiles(x double precision, z double precision, radius integer default 32) returns jsonb language plpgsql stable security definer set search_path='' as $$
declare ti integer;tj integer;rad integer:=least(40,greatest(4,coalesce(radius,32)));
begin
 if auth.uid() is null then raise exception 'Sign in first' using errcode='42501';end if;
 if x is null or z is null or abs(x)>4500 or abs(z)>4500 then raise exception 'Choose a point';end if;
 if to_regclass('eldervale_private.tile_flags') is null then return jsonb_build_object('center',jsonb_build_array(0,0),'radius',0,'tiles','[]'::jsonb);end if;
 ti:=eldervale_private.tile_of(x);tj:=eldervale_private.tile_of(z);
 return jsonb_build_object('center',jsonb_build_array(ti,tj),'radius',rad,'tiles',coalesce((
  select jsonb_agg(jsonb_build_array(f.i,f.j,f.flags|(case when f.door_bits<>0 and not coalesce(o.open,false) then f.door_bits else 0 end),f.door_bits))
  from eldervale_private.tile_flags f left join eldervale_private.realm_objects o on o.id=f.door
  where f.floor=0 and f.i between ti-rad and ti+rad and f.j between tj-rad and tj+rad and (f.flags<>0 or f.door_bits<>0)),'[]'::jsonb));
end $$;
revoke execute on function public.quest_guide_tiles(double precision,double precision,integer) from public;
revoke execute on function public.quest_guide_tiles(double precision,double precision,integer) from anon;
grant execute on function public.quest_guide_tiles(double precision,double precision,integer) to authenticated;

-- ---------------------------------------------------------------- hooks into live functions
do $hooks$
declare f regprocedure;
begin
 f:='eldervale_private.realm_request_before_stories(uuid,text,jsonb,uuid,bigint)'::regprocedure;
 if position('quest_v2_request' in pg_get_functiondef(f))=0 then
  perform eldervale_private.patch_function(f,array[
$a$ if command not in ('quest_accept','quest_complete','tutorial_cutscene','tutorial_supplies','tutorial_depart') then
$a$,
$b$ if command in ('quest_advance','quest_choice','quest_cutscene','quest_lamp','quest_teleport') then return eldervale_private.quest_v2_request($1,$2,$3,$4,$5);end if;
 if command not in ('quest_accept','quest_complete','tutorial_cutscene','tutorial_supplies','tutorial_depart') then
$b$,
$a$   d:=(case when active.user_id is null or active.progress?'_reset' then q.data else active.data end);
$a$,
$b$   d:=(case when active.user_id is null or active.progress?'_reset' then q.data else active.data end);
   if command='quest_complete' and active.user_id is not null and not active.progress?'_reset' then d:=eldervale_private.quest_v2_handin(d,active.progress);end if;
$b$,
$a$    if active.user_id is null then insert into eldervale_private.player_quests(user_id,quest_id,version,data,progress) values(uid,q.id,q.version,q.data,base);
$a$,
$b$    perform eldervale_private.quest_v2_require(uid,q.data);
    base:=eldervale_private.quest_v2_initial(uid,q.data,base);
    if active.user_id is null then insert into eldervale_private.player_quests(user_id,quest_id,version,data,progress) values(uid,q.id,q.version,q.data,base);
$b$,
$a$    update eldervale_private.player_quests set completed_at=now() where user_id=uid and quest_id=q.id;
$a$,
$b$    update eldervale_private.player_quests set completed_at=now() where user_id=uid and quest_id=q.id;
    perform eldervale_private.quest_v2_rewards(uid,q.id,d);
$b$,
$a$ perform eldervale_private.quest_refresh(uid);
 return result||jsonb_build_object('quests',$a$,
$b$ perform eldervale_private.quest_refresh(uid);
 return result||jsonb_build_object('questState',eldervale_private.quest_state(uid),'quests',$b$]);
 end if;
 foreach f in array array['eldervale_private.quest_event(jsonb)'::regprocedure,'eldervale_private.quest_refresh(uuid)'::regprocedure] loop
  if position('quest_v2_objectives' in pg_get_functiondef(f))=0 then
   perform eldervale_private.patch_function(f,array[
$a$jsonb_array_elements(coalesce(q.data->'objectives','[]'))$a$,
$b$jsonb_array_elements(eldervale_private.quest_v2_objectives(q.data,q.progress))$b$,
$a$ end loop;
end $function$$a$,
$b$ end loop;
 perform eldervale_private.quest_v2_autoadvance(uid);
end $function$$b$]);
  end if;
 end loop;
 f:='eldervale_private.admin_action(text,jsonb)'::regprocedure;
 if position('quest_v2_admin' in pg_get_functiondef(f))=0 then
  perform eldervale_private.patch_function(f,array[
$a$ if command like 'fc\_%' then return eldervale_private.admin_full_control(command,payload);end if;
$a$,
$b$ if command like 'qv2\_%' or (command='fc_quest_save' and eldervale_private.quest_v2_uses(payload->'data')) then return eldervale_private.quest_v2_admin(command,payload);end if;
 if command like 'fc\_%' then return eldervale_private.admin_full_control(command,payload);end if;
$b$]);
 end if;
end $hooks$;

commit;
