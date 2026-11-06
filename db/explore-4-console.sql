-- Eldervale exploration, part 4: Game console › World › Exploration (owner tools).
-- List / edit / add / disable lore objects, places (hidden areas and regions, with their entrances),
-- crates, clue steps, reward tables, shortcuts and resources; the master switch and settings (clue
-- chances, steps per tier, milestones); a player's lore/place/clue progress; give clue items; reset a
-- clue; preview casket rolls. Writes go through public.world_admin -> admin_action ('ex_*'), are
-- owner-checked and audited. A saved row is marked owner_edited, so re-running the content files
-- never overwrites it ("Revert to file" clears the mark).
-- APPLY AFTER db/explore-3-clues.sql. Idempotent.
begin;
set local lock_timeout='5s';

-- Server-side validation of one definition (raises on the first problem).
create or replace function eldervale_private.explore_check(k text, d jsonb) returns void
language plpgsql stable set search_path to '' as $fn$
declare num constant text[]:=array['number'];r jsonb;ar text:=d->>'area';
begin
 if d is null or jsonb_typeof(d)<>'object' or pg_column_size(d)>20000 then raise exception 'Definition must be an object under 20 KB';end if;
 if ar is not null and not exists(select 1 from eldervale_private.underground_areas a where a.id=ar) then raise exception 'Unknown area %',ar;end if;
 if k in ('place','lore','crate','resource','shortcut') and length(coalesce(d->>'name',''))not between 1 and 80 then raise exception 'Name: 1–80 characters';end if;
 if k in ('lore','crate','resource') or (k='step' and d->>'type' in ('dig','map','bearing','emote')) or (k='place' and d->>'type' in ('town','landmark')) then
  if jsonb_typeof(d->'x')<>'number' or jsonb_typeof(d->'z')<>'number' then raise exception 'x and z must be numbers';end if;
  if ar is null and (abs((d->>'x')::float8)>420 or abs((d->>'z')::float8)>420) then raise exception 'Overworld x/z must be within ±420 (or set an area)';end if;
  if ar is not null and (abs((d->>'x')::float8)>150 or abs((d->>'z')::float8)>150) then raise exception 'Area-local x/z must be within ±150';end if;
 end if;
 if k='place' then
  if coalesce(d->>'type','') not in ('town','landmark','cave','hidden','region') then raise exception 'Place type: town, landmark, cave, hidden or region';end if;
  if d->>'type' in ('town','landmark') and coalesce((d->>'radius')::float8,0) not between 2 and 120 then raise exception 'Radius 2–120';end if;
  if d->>'type' in ('cave','hidden','region') and ar is null then raise exception 'Choose the area this place is';end if;
  if d->>'type' in ('hidden','region') then
   r:=d->'entrance';
   if r is null or coalesce(r->>'model','') not in ('waterfall_curtain','thorn_thicket','sea_cave','shrine_door','ferry_boat','cliff_path','cave_mouth','crypt_door','mine_shaft','trapdoor')
    or jsonb_typeof(r->'x')<>'number' or jsonb_typeof(r->'z')<>'number' or abs((r->>'x')::float8)>420 or abs((r->>'z')::float8)>420 then raise exception 'Entrance: model and overworld x/z within ±420';end if;
   if coalesce((r->'requires'->>'agility')::integer,0) not between 0 and 99 then raise exception 'Entrance agility 0–99';end if;
   if coalesce(r->'requires'->>'lore','')<>'' and not exists(select 1 from eldervale_private.explore_defs x where x.kind='lore' and x.id=r->'requires'->>'lore') then raise exception 'Entrance needs an unknown lore object';end if;
  end if;
 elsif k='lore' then
  if coalesce(d->>'model','') not in ('lore_statue','lore_tablet','lore_grave','lore_journal','lore_carving','lore_shrine') then raise exception 'Lore model: statue, tablet, grave, journal, carving or shrine';end if;
  if length(coalesce(d->>'text',''))not between 1 and 600 then raise exception 'Lore text: 1–600 characters';end if;
 elsif k='step' then
  if coalesce(d->>'tier','') not in ('easy','medium','hard') then raise exception 'Step tier: easy, medium or hard';end if;
  if coalesce(d->>'type','') not in ('dig','map','bearing','emote','talk','crate') then raise exception 'Step type: dig, map, bearing, emote, talk or crate';end if;
  if length(coalesce(d->>'text',''))not between 1 and 400 then raise exception 'Clue text: 1–400 characters';end if;
  if d->>'type'='emote' and coalesce(d->>'emote','') not in ('wave','bow','cheer','think','dance','clap','kneel','shrug') then raise exception 'Emote: wave, bow, cheer, think, dance, clap, kneel or shrug';end if;
  if d->>'type'='talk' and (coalesce(d->>'npc','')!~'^[0-9a-f-]{36}$' or length(coalesce(d->>'npcName',''))not between 1 and 60) then raise exception 'Talk step: NPC id and name';end if;
  if d->>'type'='crate' and not exists(select 1 from eldervale_private.explore_defs x where x.kind='crate' and x.id=d->>'crate') then raise exception 'Crate step: unknown crate';end if;
 elsif k='reward' then
  if jsonb_typeof(d->'rows')<>'array' or jsonb_array_length(d->'rows') not between 1 and 60 then raise exception 'Reward table: 1–60 rows';end if;
  if d ? 'rolls' and (coalesce((d->'rolls'->>0)::integer,-1) not between 0 and 10 or coalesce((d->'rolls'->>1)::integer,-1)<(d->'rolls'->>0)::integer or (d->'rolls'->>1)::integer>10) then raise exception 'Rolls: [min,max] within 0–10';end if;
  for r in select value from jsonb_array_elements(d->'rows') loop
   if r->>'item'<>'gold' and not exists(select 1 from eldervale_private.realm_catalog c where c.id='item:'||(r->>'item')) then raise exception 'Unknown item %',r->>'item';end if;
   if coalesce((r->>'min')::integer,0)<1 or coalesce((r->>'max')::integer,0)<(r->>'min')::integer or (r->>'max')::integer>1000000 or coalesce((r->>'weight')::float8,0)<=0 then raise exception 'Row %: min ≥ 1, max ≥ min, weight > 0',r->>'item';end if;
  end loop;
 elsif k='shortcut' then
  if coalesce(d->>'template','') not in ('log_balance','rope_swing','wall_climb','stepping_stones','squeeze') then raise exception 'Shortcut template';end if;
  if coalesce((d->>'level')::integer,0) not between 1 and 99 or jsonb_typeof(d->'ends')<>'array' or jsonb_array_length(d->'ends')<>2 then raise exception 'Shortcut: level 1–99 and two ends';end if;
 elsif k='resource' then
  if coalesce(d->>'template','') not in ('rock','tree','pine','fishing_spot','herb_patch','altar','flax_patch','berry_bush') then raise exception 'Resource template: rock, tree, pine, fishing_spot, herb_patch, altar, flax_patch or berry_bush';end if;
 end if;
end $fn$;

create or replace function eldervale_private.admin_explore(command text, payload jsonb default '{}'::jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $fn$
declare k text:=payload->>'kind';i text:=payload->>'id';d jsonb;before jsonb;r jsonb;uid uuid;n integer;
begin
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>65536 then raise exception 'Invalid console payload';end if;
 if command='ex_list' then
  return jsonb_build_object('settings',eldervale_private.explore_settings(),
   'defs',coalesce((select jsonb_agg(jsonb_build_object('kind',x.kind,'id',x.id,'data',x.data,'enabled',x.enabled,'ownerEdited',x.owner_edited,'updatedAt',x.updated_at,
     'found',(select count(*) from eldervale_private.explore_found f where f.kind=x.kind and f.id=x.id)) order by x.kind,x.id) from eldervale_private.explore_defs x),'[]'::jsonb),
   'areas',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'name',a.data->>'name','enabled',a.enabled,'edited',a.updated_by is not null) order by a.id) from eldervale_private.underground_areas a where a.data ? 'explore'),'[]'::jsonb),
   'activeClues',(select count(*) from eldervale_private.explore_clues c where c.status='active'),
   'completed',(select coalesce(jsonb_object_agg(t,v),'{}'::jsonb) from (select e.key t,sum(e.value::integer) v from eldervale_private.explore_stats s cross join jsonb_each_text(s.clues) e group by e.key) q));
 elsif command='ex_player' then
  select s.user_id into uid from public.player_saves s where (payload->>'userId' is not null and s.user_id::text=payload->>'userId') or (payload->>'userId' is null and lower(s.character_name)=lower(coalesce(payload->>'name',''))) limit 1;
  if uid is null then raise exception 'No such player';end if;
  return jsonb_build_object('userId',uid,'name',(select character_name from public.player_saves where user_id=uid),
   'found',coalesce((select jsonb_agg(jsonb_build_object('kind',f.kind,'id',f.id,'at',f.at) order by f.at) from eldervale_private.explore_found f where f.user_id=uid),'[]'::jsonb),
   'clues',coalesce((select jsonb_agg(jsonb_build_object('tier',c.tier,'steps',c.steps,'idx',c.idx,'status',c.status,'startedAt',c.started_at,'finishedAt',c.finished_at)) from eldervale_private.explore_clues c where c.user_id=uid),'[]'::jsonb),
   'stats',(select to_jsonb(s)-'user_id' from eldervale_private.explore_stats s where s.user_id=uid),
   'items',(select jsonb_object_agg(x.id,coalesce((p.stats->>x.id)::integer,0)) from public.player_saves p cross join unnest(array['clueEasy','clueMedium','clueHard','casketEasy','casketMedium','casketHard','spade']) x(id) where p.user_id=uid));
 elsif command='ex_roll' then
  n:=least(200,greatest(1,coalesce((payload->>'count')::integer,20)));
  return jsonb_build_object('tier',payload->>'tier','rolls',(select jsonb_agg(eldervale_private.explore_roll(payload->>'tier')) from generate_series(1,n)));
 end if;
 perform pg_advisory_xact_lock(736211);
 if command='ex_save' then
  d:=payload->'data';
  if k is null or k not in ('place','lore','crate','step','reward','shortcut','resource') or coalesce(i,'')!~'^[a-z][a-z0-9_]{1,40}$' then raise exception 'Choose a kind and an id (lower-case letters, digits and _)';end if;
  perform eldervale_private.explore_check(k,d);
  select x.data into before from eldervale_private.explore_defs x where x.kind=k and x.id=i;
  insert into eldervale_private.explore_defs(kind,id,data,enabled,owner_edited,updated_at,updated_by) values(k,i,d,coalesce((payload->>'enabled')::boolean,true),true,now(),auth.uid())
   on conflict(kind,id) do update set data=excluded.data,enabled=excluded.enabled,owner_edited=true,updated_at=now(),updated_by=auth.uid();
  r:=eldervale_private.explore_sync();
 elsif command='ex_enable' then
  update eldervale_private.explore_defs set enabled=coalesce((payload->>'enabled')::boolean,false),owner_edited=true,updated_at=now(),updated_by=auth.uid() where kind=k and id=i;
  if not found then raise exception 'Not found';end if;
  r:=eldervale_private.explore_sync();
 elsif command='ex_revert' then
  update eldervale_private.explore_defs set owner_edited=false,updated_at=now() where kind=k and id=i;
  if not found then raise exception 'Not found';end if;
  r:=jsonb_build_object('reverted',k||':'||i,'note','Re-run db/explore-2-content.sql and db/explore-3-clues.sql to restore the file version.');
 elsif command='ex_settings' then
  d:=payload->'value';
  if jsonb_typeof(d)<>'object' or jsonb_typeof(d->'enabled')<>'boolean' then raise exception 'Settings need enabled true/false';end if;
  if d ? 'steps' and exists(select 1 from jsonb_each(d->'steps') e where jsonb_typeof(e.value)<>'array' or (e.value->>0)::integer<1 or (e.value->>1)::integer<(e.value->>0)::integer or (e.value->>1)::integer>8) then raise exception 'Steps per tier: [min,max] within 1–8';end if;
  if d ? 'clueDrops' and exists(select 1 from jsonb_each(d->'clueDrops') e where eldervale_private.explore_chance(e.value->'chance') not between 0 and 1) then raise exception 'Clue chance must be like 1/128';end if;
  select value into before from eldervale_private.game_settings where key='explore';
  insert into eldervale_private.game_settings(key,value,updated_at,updated_by) values('explore',coalesce(before,'{}'::jsonb)||d,now(),auth.uid())
   on conflict(key) do update set value=excluded.value,updated_at=now(),updated_by=auth.uid();
  r:=eldervale_private.explore_sync();
 elsif command='ex_sync' then
  r:=eldervale_private.explore_sync();
 elsif command='ex_give' then
  uid:=(payload->>'userId')::uuid;
  if coalesce(payload->>'item','') not in (select substring(c.id from 6) from eldervale_private.realm_catalog c where c.id like 'item:%' and coalesce((c.data->>'explore')::boolean,false)) then raise exception 'Choose an exploration item';end if;
  perform eldervale_private.item_change(uid,payload->>'item',greatest(1,least(28,coalesce((payload->>'amount')::integer,1))));
  r:=jsonb_build_object('given',payload->>'item');
 elsif command='ex_clue_reset' then
  update eldervale_private.explore_clues set status='abandoned',finished_at=now() where user_id=(payload->>'userId')::uuid and tier=payload->>'tier' and status='active';
  r:=jsonb_build_object('reset',found);
 else raise exception 'Unknown exploration command %',command;
 end if;
 insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,coalesce(k||':'||i,payload->>'userId',command),before,payload);
 return r;
end $fn$;
revoke all on function eldervale_private.explore_check(text,jsonb),eldervale_private.admin_explore(text,jsonb) from public,anon,authenticated;

do $hook$
declare fn regprocedure:=to_regprocedure('eldervale_private.admin_action(text,jsonb)');
begin
 if position('admin_explore' in pg_get_functiondef(fn))=0 then
  perform eldervale_private.patch_function(fn,array[
$a$ if command like 'ug\_%' then return eldervale_private.admin_underground(command,payload);end if;$a$,
$b$ if command like 'ex\_%' then return eldervale_private.admin_explore(command,payload);end if;
 if command like 'ug\_%' then return eldervale_private.admin_underground(command,payload);end if;$b$]);
 end if;
end $hook$;
commit;
