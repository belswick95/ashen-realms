-- Castle tutorial and data-driven quest framework.
-- * New characters start inside Eldervale Castle with game_flags.tutorial={active:true}.
--   They watch the arrival cutscene (the King's audience), then follow a chain of tutorial
--   quests taught by tutor NPCs. Until the final quest is handed in they cannot step out of
--   the castle bounds (enforced in can_step through advance_player_motion) and respawn in the
--   courtyard. Everyone shares the same world; only the gate rule differs per player.
-- * Quest definitions stay rows in quest_definitions. New optional fields in data:
--   key, chain, order, requires (key of an earlier quest), startItems, dialogue{offer,progress,complete},
--   finishes ('tutorial'), hint and objective types talk|kill|collect (existing) plus
--   event{event,match,targets}|xp{skill}|have|equip{target slot,item}|bank{target}|visit{x,z,radius}.
-- * Existing players (all saves without a tutorial flag) are marked complete.
-- Apply after db/business-doors.sql. Idempotent and safe to re-run.

-- ---------------------------------------------------------------- geometry & state helpers
create or replace function eldervale_private.tutorial_inside(x double precision,z double precision) returns boolean language sql immutable set search_path='' as $$
 -- Courtyard inside the curtain walls (castle centre -340,-305; walls at ±49).
 select abs(x+340)<=47 and abs(z+305)<=47
$$;

create or replace function eldervale_private.tutorial_locked(uid uuid) returns boolean language sql stable security definer set search_path='' as $$
 select coalesce((select coalesce((game_flags->'tutorial'->>'active')::boolean,false) and not coalesce((game_flags->'tutorial'->>'done')::boolean,false) from public.player_saves where user_id=uid),false)
$$;

-- Tutorial props that block walking (round footprints): the training pond and the throne dais.
create or replace function eldervale_private.tutorial_blocked(bx double precision,bz double precision) returns boolean language sql stable set search_path='' as $$
 select bx between -392 and -288 and bz between -358 and -252 and exists(
  select 1 from eldervale_private.realm_objects o
  where o.data->>'template' in ('training_pond','throne') and abs(o.x-bx)<6 and abs(o.z-bz)<6
   and sqrt(power(o.x-bx,2)+power(o.z-bz,2))<(case when o.data->>'template'='training_pond' then 2.5 else 1.1 end)*coalesce((o.data->>'scale')::float8,1))
$$;

-- Experience for a skill name as stored in player_saves (woodcutting and mining live in stats).
create or replace function eldervale_private.quest_xp(s public.player_saves,skill text) returns numeric language sql stable set search_path='' as $$
 select coalesce((case skill when 'mining' then s.stats->>'miningXP' when 'woodcutting' then coalesce(s.stats->>'woodXP',s.skills->>'woodcuttingXP') else s.skills->>(skill||'XP') end)::numeric,0)
$$;

-- Entering the world as an unfinished trainee always places you inside the castle.
create or replace function eldervale_private.tutorial_enter(s public.player_saves) returns public.player_saves language plpgsql security definer set search_path='' as $$
begin
 if s.user_id is null or not eldervale_private.tutorial_locked(s.user_id) then return s;end if;
 if not eldervale_private.tutorial_inside(coalesce((s.world_position->>'x')::float8,0),coalesce((s.world_position->>'y')::float8,0)) then
  update public.player_saves set world_position=coalesce(world_position,'{}'::jsonb)||'{"x":-340,"y":-290,"floor":0,"building":null}'::jsonb where user_id=s.user_id returning * into s;
 end if;
 return s;
end $$;

-- ---------------------------------------------------------------- quest progress
-- Latching, state-based objectives (xp, have, equip, bank, visit) are evaluated here on each sync.
create or replace function eldervale_private.quest_refresh(uid uuid) returns void language plpgsql security definer set search_path='' as $$
declare q record;o jsonb;i integer;s public.player_saves;p eldervale_private.realm_players;cur numeric;n integer;prog jsonb;
begin
 if uid is null or not exists(select 1 from eldervale_private.player_quests where user_id=uid and completed_at is null and not progress?'_reset') then return;end if;
 select * into s from public.player_saves where user_id=uid;select * into p from eldervale_private.realm_players where user_id=uid;
 for q in select * from eldervale_private.player_quests where user_id=uid and completed_at is null and not progress?'_reset' for update loop
  i:=0;prog:=q.progress;
  for o in select value from jsonb_array_elements(coalesce(q.data->'objectives','[]')) loop
   n:=null;
   if o->>'type'='xp' then
    cur:=eldervale_private.quest_xp(s,o->>'skill');n:=floor(cur-coalesce((prog->'_xp'->>(o->>'skill'))::numeric,cur))::integer;
   elsif o->>'type'='have' then
    n:=eldervale_private.item_quantity(uid,o->>'target');
   elsif o->>'type'='equip' then
    n:=(case when coalesce(s.equipment->>(o->>'target'),'')<>'' and (o->>'item' is null or s.equipment->>(o->>'target')=o->>'item') then 1 else 0 end);
   elsif o->>'type'='bank' then
    n:=(select coalesce(sum((b.value#>>'{}')::numeric),0)::integer from jsonb_each(coalesce(s.inventory->'bank','{}'::jsonb)) b where jsonb_typeof(b.value)='number' and (o->>'target' in ('*',b.key)));
   elsif o->>'type'='visit' then
    n:=(case when p.user_id is not null and coalesce(p.floor,0)=coalesce((o->>'floor')::integer,0) and sqrt(power(p.x-(o->>'x')::float8,2)+power(p.z-(o->>'z')::float8,2))<=coalesce((o->>'radius')::float8,3) then 1 else 0 end);
   end if;
   if n is not null then
    n:=least((o->>'amount')::integer,greatest(n,coalesce((prog->>i::text)::integer,0)));
    if n<>coalesce((prog->>i::text)::integer,0) then prog:=jsonb_set(prog,array[i::text],to_jsonb(n));end if;
   end if;
   i:=i+1;
  end loop;
  if prog is distinct from q.progress then update eldervale_private.player_quests set progress=prog where user_id=uid and quest_id=q.quest_id;end if;
 end loop;
end $$;

-- Event-driven objectives. Called by a trigger on every realm event that names a player.
create or replace function eldervale_private.quest_event(event jsonb) returns void language plpgsql set search_path='' as $$
declare uid uuid;q record;o jsonb;i integer;key text;n integer;prog jsonb;add integer;
begin
 if coalesce(event->>'player','')!~'^[0-9a-fA-F-]{36}$' then return;end if;
 uid:=(event->>'player')::uuid;
 for q in select * from eldervale_private.player_quests where user_id=uid and completed_at is null and not progress?'_reset' for update loop
  i:=0;prog:=q.progress;
  for o in select value from jsonb_array_elements(coalesce(q.data->'objectives','[]')) loop
   key:=i::text;i:=i+1;add:=0;
   if o->>'type'='talk' and event->>'type'='interaction' and event->>'kind'='npc' and o->>'target'=event->>'target' then add:=1;
   elsif o->>'type'='kill' and event->>'type'='death' and (o->>'target'=event->>'target' or coalesce(o->'targets','[]'::jsonb)?(event->>'target')) then add:=1;
   elsif o->>'type'='event' and event->>'type'=o->>'event' and event@>coalesce(o->'match','{}'::jsonb) and (not(o?'targets') or (o->'targets')?(event->>'target')) then
    add:=(case when coalesce(event->>'amount','')~'^[0-9]{1,4}$' then greatest(1,(event->>'amount')::integer) else 1 end);
   end if;
   if add>0 then n:=least((o->>'amount')::integer,coalesce((prog->>key)::integer,0)+add);prog:=jsonb_set(prog,array[key],to_jsonb(n));end if;
  end loop;
  if prog is distinct from q.progress then update eldervale_private.player_quests set progress=prog where user_id=uid and quest_id=q.quest_id;end if;
 end loop;
end $$;

create or replace function eldervale_private.quest_realm_event() returns trigger language plpgsql security definer set search_path='' as $$
begin perform eldervale_private.quest_event(new.data);return null;end $$;

-- emit() used to call quest_event directly; the trigger now covers emit() and direct inserts alike.
create or replace function eldervale_private.emit(data jsonb) returns void language plpgsql set search_path='' as $$
begin
 insert into eldervale_private.realm_events(data) values(data);
end $$;

create or replace trigger quest_progress after insert on eldervale_private.realm_events for each row
 when (new.data->>'player' is not null and new.data->>'type' in ('interaction','death','woodcut','fishing','eat','player_death','player_respawn','door','skill_complete','gather_start'))
 execute function eldervale_private.quest_realm_event();

-- Journal rows. Tutorial-chain quests are only listed for players who are still in training.
create or replace function eldervale_private.quest_snapshot(uid uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'version',coalesce(p.version,q.version),'data',coalesce(p.data,q.data),
   'accepted',p.user_id is not null and not p.progress?'_reset','completed',p.completed_at is not null and not p.progress?'_reset',
   'progress',(case when p.progress?'_reset' then '{}'::jsonb else coalesce(p.progress,'{}'::jsonb)-'_xp' end))
   order by coalesce(q.data->>'chain',''),coalesce((q.data->>'order')::integer,0),q.updated_at),'[]'::jsonb)
 from eldervale_private.quest_definitions q left join eldervale_private.player_quests p on p.quest_id=q.id and p.user_id=uid
 where (coalesce(q.data->>'chain','')<>'tutorial' and (coalesce((q.data->>'published')::boolean,false) or p.user_id is not null))
    or (q.data->>'chain'='tutorial' and coalesce((q.data->>'published')::boolean,false) and eldervale_private.tutorial_locked(uid))
$$;

-- ---------------------------------------------------------------- player commands
-- Replaces the owner-quests handler: quest_accept / quest_complete gain chain prerequisites,
-- start items, tutorial completion; tutorial_cutscene / tutorial_supplies / tutorial_depart are new.
create or replace function eldervale_private.realm_request_before_stories(session_id uuid,command text default 'sync',payload jsonb default '{}',request_id uuid default null,event_cursor bigint default 0) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;p eldervale_private.realm_players;q eldervale_private.quest_definitions;active eldervale_private.player_quests;d jsonb;o jsonb;i integer;k text;v jsonb;amount integer;s public.player_saves;tut jsonb;base jsonb;sx float8;sz float8;uid uuid:=auth.uid();
begin
 if command not in ('quest_accept','quest_complete','tutorial_cutscene','tutorial_supplies','tutorial_depart') then
  result:=eldervale_private.realm_request_before_quests($1,$2,$3,$4,$5);
 else
  result:=eldervale_private.realm_request_before_quests($1,'sync','{}',null,$5);
  perform pg_advisory_xact_lock(736211);
  if request_id is null or payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>1000 then raise exception 'Invalid quest request';end if;
  select * into p from eldervale_private.realm_players where user_id=uid and realm_players.session_id=$1 for update;if not found then raise exception 'Session expired';end if;
  if exists(select 1 from eldervale_private.realm_requests r where r.user_id=uid and r.request_id=$4) then
   return result||jsonb_build_object('quests',eldervale_private.quest_snapshot(uid),'tutorial',(select coalesce(game_flags->'tutorial','{}'::jsonb) from public.player_saves where user_id=uid));
  end if;
  select * into s from public.player_saves where user_id=uid for update;
  tut:=coalesce(s.game_flags->'tutorial','{}'::jsonb);
  if command='tutorial_cutscene' then
   k:=coalesce(nullif(payload->>'id',''),'arrival');
   if k!~'^[a-z0-9_-]{1,40}$' then raise exception 'Invalid cutscene';end if;
   if not coalesce(tut->'cutscenes','[]'::jsonb)?k then
    update public.player_saves set game_flags=game_flags||jsonb_build_object('tutorial',tut||jsonb_build_object('cutscenes',coalesce(tut->'cutscenes','[]'::jsonb)||to_jsonb(k))) where user_id=uid;
    -- Watched or skipped, the arrival scene always ends in front of the King, set by the server.
    if k='arrival' and eldervale_private.tutorial_locked(uid) and p.floor=0 and eldervale_private.tutorial_inside(p.x,p.z) then
     update eldervale_private.realm_players set x=-340,z=-328.5,yaw=pi(),path='[]',intent=null,input_until=null,input_x=0,input_z=0 where user_id=uid;
     update public.player_saves set world_position=coalesce(world_position,'{}'::jsonb)||'{"x":-340,"y":-328.5,"floor":0,"building":null}'::jsonb where user_id=uid;
    end if;
   end if;
  elsif command='tutorial_supplies' then
   if not eldervale_private.tutorial_locked(uid) then raise exception 'Replacement tools are only for trainees';end if;
   if not exists(select 1 from eldervale_private.realm_actors a where not a.deleted and coalesce((a.data->>'tutor')::boolean,false) and sqrt(power(a.x-p.x,2)+power(a.z-p.z,2))<6) then raise exception 'Ask a castle tutor for replacement tools';end if;
   amount:=0;
   for k,v in select distinct e.key,e.value from eldervale_private.player_quests pq join eldervale_private.quest_definitions qd on qd.id=pq.quest_id cross join lateral jsonb_each(coalesce(pq.data->'startItems','{}'::jsonb)) e
     where pq.user_id=uid and qd.data->>'chain'='tutorial' and not pq.progress?'_reset' and e.key<>'gold' and coalesce((select (c.data->>'stackable')::boolean from eldervale_private.realm_catalog c where c.id='item:'||e.key),false)=false loop
    if eldervale_private.item_quantity(uid,k)<1 and coalesce((select (rc.data->>'unique')::boolean or rc.data?'field' or rc.data->>'category'='Tools' from eldervale_private.realm_catalog rc where rc.id='item:'||k),false) then perform eldervale_private.item_change(uid,k,1);amount:=amount+1;end if;
   end loop;
   if eldervale_private.inventory_used(uid)>eldervale_private.inventory_capacity() then raise exception 'Make inventory space for the replacement tools';end if;
   if amount=0 then raise exception 'You already carry every tool from your training';end if;
  elsif command='tutorial_depart' then
   if eldervale_private.tutorial_locked(uid) or not coalesce((tut->>'done')::boolean,false) then raise exception 'You should finish your training before leaving the castle.';end if;
   if p.floor<>0 or not eldervale_private.tutorial_inside(p.x,p.z) then raise exception 'The Steward''s cart leaves from the castle courtyard';end if;
   select spawn_x,spawn_z into sx,sz from eldervale_private.settings where id;sx:=coalesce(sx,0);sz:=coalesce(sz,5);
   update eldervale_private.realm_players set x=sx,z=sz,floor=0,building=null,path='[]',intent=null,input_until=null,input_x=0,input_z=0 where user_id=uid;
   update public.player_saves set world_position=coalesce(world_position,'{}'::jsonb)||jsonb_build_object('x',sx,'y',sz,'floor',0,'building',null),game_flags=game_flags||jsonb_build_object('tutorial',tut||'{"departed":true}'::jsonb) where user_id=uid;
  else
   select * into q from eldervale_private.quest_definitions where id=(payload->>'id')::uuid for share;if not found then raise exception 'Quest not found';end if;
   perform eldervale_private.quest_refresh(uid);
   select * into active from eldervale_private.player_quests where user_id=uid and quest_id=q.id for update;
   if active.progress?'_reset' then
    if command='quest_complete' then raise exception 'Accept this quest first';end if;
   end if;
   d:=(case when active.user_id is null or active.progress?'_reset' then q.data else active.data end);
   if not exists(select 1 from eldervale_private.realm_actors where id=d->>'giver' and not deleted and hp>0 and sqrt(power(x-p.x,2)+power(z-p.z,2))<6) then raise exception 'Return to the quest giver';end if;
   if active.completed_at is not null and not active.progress?'_reset' then raise exception 'Quest already completed';end if;
   if command='quest_accept' then
    if active.user_id is not null and not active.progress?'_reset' then raise exception 'Quest already accepted';end if;
    if not coalesce((q.data->>'published')::boolean,false) then raise exception 'Quest unavailable';end if;
    if q.data->>'chain'='tutorial' and not eldervale_private.tutorial_locked(uid) then raise exception 'Quest unavailable';end if;
    if q.data->>'requires' is not null and not exists(select 1 from eldervale_private.player_quests pq join eldervale_private.quest_definitions qd on qd.id=pq.quest_id where pq.user_id=uid and qd.data->>'key'=q.data->>'requires' and pq.completed_at is not null and not pq.progress?'_reset') then raise exception 'Finish your earlier training first';end if;
    base:=jsonb_build_object('_xp',coalesce((select jsonb_object_agg(x.value->>'skill',eldervale_private.quest_xp(s,x.value->>'skill')) from jsonb_array_elements(coalesce(q.data->'objectives','[]')) x where x.value->>'type'='xp'),'{}'::jsonb));
    if active.user_id is null then insert into eldervale_private.player_quests(user_id,quest_id,version,data,progress) values(uid,q.id,q.version,q.data,base);
    else update eldervale_private.player_quests set version=q.version,data=q.data,progress=base,completed_at=null where user_id=uid and quest_id=q.id;end if;
    for k,v in select key,value from jsonb_each(coalesce(q.data->'startItems','{}')) loop perform eldervale_private.item_change(uid,k,(v#>>'{}')::integer);end loop;
    if eldervale_private.inventory_used(uid)>eldervale_private.inventory_capacity() then raise exception 'Make inventory space before accepting';end if;
   else
    if active.user_id is null then raise exception 'Accept this quest first';end if;
    select * into active from eldervale_private.player_quests where user_id=uid and quest_id=q.id;
    i:=0;
    for o in select value from jsonb_array_elements(d->'objectives') loop
     amount:=(case when o->>'type'='collect' then greatest(0,eldervale_private.item_quantity(uid,o->>'target')-eldervale_private.equipment_reserved(uid,(select data from eldervale_private.realm_catalog where id='item:'||(o->>'target')))) else coalesce((active.progress->>i::text)::integer,0) end);
     if amount<(o->>'amount')::integer then raise exception 'Finish every objective before returning';end if;i:=i+1;
    end loop;
    for o in select value from jsonb_array_elements(d->'objectives') where value->>'type'='collect' loop perform eldervale_private.item_change(uid,o->>'target',-(o->>'amount')::integer);end loop;
    for k,v in select key,value from jsonb_each(coalesce(d->'items','{}')) loop perform eldervale_private.item_change(uid,k,(v#>>'{}')::integer);end loop;
    if eldervale_private.inventory_used(uid)>eldervale_private.inventory_capacity() then raise exception 'Make inventory space for the rewards';end if;
    perform eldervale_private.item_change(uid,'gold',coalesce((d->>'gold')::integer,0));
    for k,v in select key,value from jsonb_each(coalesce(d->'xp','{}')) loop perform eldervale_private.skill_xp(uid,k,(v#>>'{}')::integer);end loop;
    update eldervale_private.player_quests set completed_at=now() where user_id=uid and quest_id=q.id;
    if d->>'finishes'='tutorial' then
     update public.player_saves set game_flags=game_flags||jsonb_build_object('tutorial',coalesce(game_flags->'tutorial','{}'::jsonb)||jsonb_build_object('active',false,'done',true,'completedAt',now())) where user_id=uid;
    end if;
   end if;
  end if;
  insert into eldervale_private.realm_requests(user_id,request_id,result) values(uid,$4,'{}');
  update eldervale_private.realm_players set last_command=clock_timestamp() where user_id=uid;
  result:=eldervale_private.realm_request_before_quests($1,'sync','{}',null,$5);
 end if;
 perform eldervale_private.quest_refresh(uid);
 return result||jsonb_build_object('quests',eldervale_private.quest_snapshot(uid),'tutorial',(select coalesce(game_flags->'tutorial','{}'::jsonb) from public.player_saves where user_id=uid));
end $$;

-- ---------------------------------------------------------------- owner tools
create or replace function eldervale_private.admin_tutorial(command text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid;flags jsonb;after jsonb;
begin
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if coalesce(payload->>'userId','')!~'^[0-9a-fA-F-]{36}$' then raise exception 'Choose a player';end if;
 uid:=(payload->>'userId')::uuid;
 select game_flags into flags from public.player_saves where user_id=uid for update;if not found then raise exception 'Player not found';end if;
 if command='tutorial_status' then return jsonb_build_object('tutorial',coalesce(flags->'tutorial','{}'::jsonb),'locked',eldervale_private.tutorial_locked(uid));end if;
 if command='tutorial_skip' then
  update public.player_saves set game_flags=game_flags||jsonb_build_object('tutorial',coalesce(game_flags->'tutorial','{}'::jsonb)||jsonb_build_object('active',false,'done',true,'skipped',true,'completedAt',now())) where user_id=uid returning game_flags into after;
 elsif command='tutorial_reset' then
  update public.player_saves set game_flags=game_flags||jsonb_build_object('tutorial',jsonb_build_object('active',true,'cutscenes','[]'::jsonb,'startedAt',now(),'resetBy',auth.uid())),
   world_position=coalesce(world_position,'{}'::jsonb)||'{"x":-340,"y":-290,"floor":0,"building":null}'::jsonb where user_id=uid returning game_flags into after;
  update eldervale_private.player_quests pq set completed_at=null,progress='{"_reset":true}'::jsonb from eldervale_private.quest_definitions q where q.id=pq.quest_id and q.data->>'chain'='tutorial' and pq.user_id=uid;
  update eldervale_private.realm_players set x=-340,z=-290,floor=0,building=null,path='[]',intent=null,input_until=null,input_x=0,input_z=0 where user_id=uid;
 else raise exception 'Unknown tutorial command';end if;
 insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,uid::text,flags,after);
 return jsonb_build_object('tutorial',after->'tutorial','locked',eldervale_private.tutorial_locked(uid));
end $$;
revoke all on function eldervale_private.admin_tutorial(text,jsonb),eldervale_private.quest_refresh(uuid),eldervale_private.tutorial_enter(public.player_saves),eldervale_private.tutorial_locked(uuid),eldervale_private.quest_snapshot(uuid),eldervale_private.quest_event(jsonb),eldervale_private.quest_realm_event() from public,anon,authenticated;

-- ---------------------------------------------------------------- existing players skip the tutorial
-- Runs before the enter_world patch so nobody who already has a character is ever locked in.
update public.player_saves set game_flags=coalesce(game_flags,'{}'::jsonb)||jsonb_build_object('tutorial',jsonb_build_object('active',false,'done',true,'migrated',true,'completedAt',now()))
 where not (coalesce(game_flags,'{}'::jsonb)?'tutorial');

-- ---------------------------------------------------------------- patches to existing functions
-- Each patch is skipped when it has already been applied, so the file can be re-run.
do $$
declare def text;
begin
 def:=pg_get_functiondef('eldervale_private.can_step(double precision,double precision,double precision,double precision)'::regprocedure);
 if position('motion_tutorial' in def)=0 then
  perform eldervale_private.patch_function('eldervale_private.can_step(double precision,double precision,double precision,double precision)'::regprocedure,array[
   ' if not eldervale_private.can_step_before_camp(ax,az,bx,bz) then return false;end if;',
   ' -- Trainees cannot step from the castle courtyard to anywhere outside it.
 if coalesce(current_setting(''eldervale.motion_tutorial'',true),'''')=''1'' and eldervale_private.tutorial_inside(ax,az) and not eldervale_private.tutorial_inside(bx,bz) then return false;end if;
 if eldervale_private.tutorial_blocked(bx,bz) then return false;end if;
 if not eldervale_private.can_step_before_camp(ax,az,bx,bz) then return false;end if;']);
 end if;
 def:=pg_get_functiondef('eldervale_private.advance_player_motion(uuid,timestamp with time zone)'::regprocedure);
 if position('motion_tutorial' in def)=0 then
  perform eldervale_private.patch_function('eldervale_private.advance_player_motion(uuid,timestamp with time zone)'::regprocedure,array[
   ' perform eldervale_private.motion_story(p.floor,p.building);',
   ' perform eldervale_private.motion_story(p.floor,p.building);perform set_config(''eldervale.motion_tutorial'',(case when eldervale_private.tutorial_locked(player_id) then ''1'' else '''' end),true);',
   'level=eldervale_private.combat_level(skills) where user_id=player_id;',
   'level=eldervale_private.combat_level(skills) where user_id=player_id;perform set_config(''eldervale.motion_tutorial'','''',true);']);
 end if;
 def:=pg_get_functiondef('eldervale_private.enter_world(jsonb)'::regprocedure);
 if position('tutorial_enter' in def)=0 then
  perform eldervale_private.patch_function('eldervale_private.enter_world(jsonb)'::regprocedure,array[
   '(select jsonb_build_object(''x'',spawn_x,''y'',spawn_z) from eldervale_private.settings where id=true)',
   '''{"x":-340,"y":-290,"floor":0,"building":null}''::jsonb',
   ',''{}'',''{}'',''{}'') returning * into s;',
   ',''{}'',''{}'',jsonb_build_object(''tutorial'',jsonb_build_object(''active'',true,''cutscenes'',''[]''::jsonb,''startedAt'',now()))) returning * into s;',
   ' update public.player_saves set level=eldervale_private.combat_level(skills) where user_id=auth.uid() returning * into s;',
   ' update public.player_saves set level=eldervale_private.combat_level(skills) where user_id=auth.uid() returning * into s;s:=eldervale_private.tutorial_enter(s);']);
 end if;
 def:=pg_get_functiondef('eldervale_private.death_tick(uuid,timestamp with time zone)'::regprocedure);
 if position('tutorial_locked' in def)=0 then
  perform eldervale_private.patch_function('eldervale_private.death_tick(uuid,timestamp with time zone)'::regprocedure,array[
   'sx:=coalesce(sx,0);sz:=coalesce(sz,5);',
   'sx:=coalesce(sx,0);sz:=coalesce(sz,5);if eldervale_private.tutorial_locked(uid) then sx:=-340;sz:=-290;end if;']);
 end if;
 def:=pg_get_functiondef('eldervale_private.admin_action(text,jsonb)'::regprocedure);
 if position('admin_tutorial' in def)=0 then
  perform eldervale_private.patch_function('eldervale_private.admin_action(text,jsonb)'::regprocedure,array[
   ' r:=eldervale_private.admin_console(command,payload);if r is not null then return r;end if;',
   ' if command in (''tutorial_reset'',''tutorial_skip'',''tutorial_status'') then return eldervale_private.admin_tutorial(command,payload);end if;
 r:=eldervale_private.admin_console(command,payload);if r is not null then return r;end if;']);
 end if;
end $$;
