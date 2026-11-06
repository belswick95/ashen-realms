-- Eldervale bosses, part 2: hooks into the live mechanics II / underground functions, the boss
-- definition check, the Game console commands (console_boss_*) and the player read-out.
-- APPLY AFTER db/bosses-1-core.sql. Idempotent: every edit goes through patch_function and is skipped
-- once its new text is present; each anchor was checked to appear exactly once in the live function
-- text (read-only, 2026-11-06; scripts/bosses-db/live-anchors.mjs prints the check query).
begin;
set local lock_timeout='5s';

-- ---------------------------------------------------------------- dragon breath (any dragon that is not a boss)
create or replace function eldervale_private.boss_dragon_breath(actor_id text, uid uuid, t timestamptz) returns boolean
language plpgsql set search_path to '' as $fn$
declare c jsonb:=eldervale_private.boss_config();b jsonb;now_tick bigint:=eldervale_private.tick_no(t);a eldervale_private.realm_actors;p eldervale_private.realm_players;am eldervale_private.actor_mech;mm jsonb;
 d integer;el text;raw integer;mult float8;dmg integer;lvl integer;
begin
 b:=c->'breath';if not coalesce((b->>'enabled')::boolean,true) then return false;end if;
 select * into am from eldervale_private.actor_mech where id=actor_id;
 if am.id is null or am.attack_tick>now_tick or am.retreat then return false;end if;
 if random()>=coalesce((b->>'dragonChance')::float8,.25) then return false;end if;
 select * into a from eldervale_private.realm_actors where id=actor_id;select * into p from eldervale_private.realm_players where user_id=uid;
 d:=greatest(0,round(sqrt(power(a.x-p.x,2)+power(a.z-p.z,2))/eldervale_private.tile_size())::integer);
 if d>6 then return false;end if;
 mm:=eldervale_private.mech_monster(actor_id,a.data);lvl:=coalesce(eldervale_private.gear_int(a.data->'level'),60);
 el:=(case when a.data->>'attackType' in ('magic','frost','ice') then 'frost' else 'fire' end);
 raw:=1+floor(random()*greatest(10,coalesce((b->>'dragonMaxHit')::numeric,300)*lvl/75.0))::integer;
 mult:=eldervale_private.boss_breath_mult(uid,now_tick);dmg:=floor(raw*mult)::integer;
 update eldervale_private.actor_mech set attack_tick=now_tick+(mm->>'attackTicks')::integer,engaged_tick=now_tick where id=actor_id;
 update eldervale_private.realm_actors set yaw=atan2(p.x-a.x,p.z-a.z) where id=actor_id;
 perform eldervale_private.emit(jsonb_build_object('type','windup','side','enemy','target',actor_id,'player',uid,'attackType',a.data->>'attackType','ranged',true));
 perform eldervale_private.emit(jsonb_build_object('type','boss_breath','target',actor_id,'player',uid,'element',el,'color',(case when el='frost' then 9426943 else 16738842 end),'mult',mult));
 update eldervale_private.player_mech set pending=pending||jsonb_build_array(jsonb_build_object('at',now_tick+1,'src',actor_id,'srcKind','npc','dmg',dmg,'style','magic','pierce',true)) where user_id=uid;
 if mult>=.99 then perform eldervale_private.emit(jsonb_build_object('type','notice','player',uid,'text',(case when el='frost' then 'The frost breath bites deep! ' else 'The dragonfire scorches you! ' end)||'An anti-breath shield or a Breathward tonic would help.'));end if;
 return true;
exception when others then
 perform eldervale_private.mech_fault('dragon breath',sqlerrm);return false;
end $fn$;

-- Breathward tonic (mech_drink): breath protection for n ticks.
create or replace function eldervale_private.boss_breathward(uid uuid, n integer) returns void
language plpgsql set search_path to '' as $fn$
declare now_tick bigint:=eldervale_private.tick_no(clock_timestamp());
begin
 insert into eldervale_private.boss_players(user_id,breath_until) values(uid,now_tick+greatest(1,least(6000,coalesce(n,500))))
  on conflict (user_id) do update set breath_until=greatest(boss_players.breath_until,excluded.breath_until);
 perform eldervale_private.emit(jsonb_build_object('type','notice','player',uid,'text','A peppery warmth settles in your chest. Dragon breath will only singe you for a while.'));
end $fn$;

revoke all on function eldervale_private.boss_dragon_breath(text,uuid,timestamptz),eldervale_private.boss_breathward(uuid,integer) from public,anon,authenticated;

-- ---------------------------------------------------------------- definition check (= bosses.js validateBoss)
create or replace function eldervale_private.boss_check(d jsonb) returns void
language plpgsql stable set search_path to '' as $fn$
declare k text;a jsonb;i integer:=0;prev numeric:=101;p jsonb;x text;
begin
 if jsonb_typeof(d)<>'object' then raise exception 'Boss: not an object';end if;
 if coalesce(d->>'id','')!~'^[a-z][a-z0-9_]{1,40}$' then raise exception 'Boss: id lower-case letters, digits and _';end if;
 if length(coalesce(d->>'name',''))not between 1 and 60 then raise exception 'Boss: name 1-60 characters';end if;
 if jsonb_typeof(d->'attackTicks')<>'number' or (d->>'attackTicks')::numeric not between 2 and 12 then raise exception 'Boss: attackTicks 2-12';end if;
 if jsonb_typeof(d->'arena'->'radius')<>'number' or (d->'arena'->>'radius')::numeric not between 3 and 20 then raise exception 'Boss: arena.radius 3-20 tiles';end if;
 if jsonb_typeof(d->'attacks')<>'object' or d->'attacks'='{}'::jsonb then raise exception 'Boss: at least one attack';end if;
 for k,a in select key,value from jsonb_each(d->'attacks') loop
  if coalesce(a->>'kind','') not in ('strike','telegraph','charge','breath','summon','flight') then raise exception 'Boss: attack % kind strike|telegraph|charge|breath|summon|flight',k;end if;
  if a->>'kind' in ('strike','charge') and coalesce(a->>'style','') not in ('melee','ranged','magic') then raise exception 'Boss: attack % style melee|ranged|magic',k;end if;
  if a->>'kind' in ('strike','telegraph','charge','breath') and (jsonb_typeof(a->'maxHit')<>'number' or (a->>'maxHit')::numeric not between 0 and 2000) then raise exception 'Boss: attack % maxHit 0-2000',k;end if;
  if (a->>'kind'='telegraph' or a ? 'shape') and coalesce(a->>'shape','') not in ('target','around','ring','line','cross','behind','scatter') then raise exception 'Boss: attack % shape target|around|ring|line|cross|behind|scatter',k;end if;
  if a ? 'tell' and (jsonb_typeof(a->'tell')<>'number' or (a->>'tell')::numeric not between 1 and 6) then raise exception 'Boss: attack % tell 1-6 ticks',k;end if;
  if a->>'kind'='breath' and coalesce(a->>'element','') not in ('fire','frost') then raise exception 'Boss: attack % element fire|frost',k;end if;
  if a->>'kind'='summon' and (coalesce(a->>'add','')='' or jsonb_typeof(a->'count')<>'number' or (a->>'count')::numeric not between 1 and 6) then raise exception 'Boss: attack % add and count 1-6',k;end if;
  if a->>'kind'='flight' and (jsonb_typeof(a->'ticks')<>'number' or (a->>'ticks')::numeric not between 2 and 12 or (a ? 'sweep' and not (d->'attacks' ? (a->>'sweep')))) then raise exception 'Boss: attack % ticks 2-12 and a known sweep',k;end if;
 end loop;
 if jsonb_typeof(d->'phases')<>'array' or jsonb_array_length(d->'phases') not between 1 and 6 then raise exception 'Boss: 1-6 phases';end if;
 for p in select value from jsonb_array_elements(d->'phases') loop
  i:=i+1;
  if jsonb_typeof(p->'at')<>'number' or (p->>'at')::numeric not between 1 and 100 or (i=1 and (p->>'at')::numeric<>100) or (p->>'at')::numeric>=prev then raise exception 'Boss: phase % at (phase 1 = 100, then falling)',i;end if;
  prev:=(p->>'at')::numeric;
  if jsonb_typeof(p->'pattern')<>'array' or jsonb_array_length(p->'pattern') not between 1 and 16 then raise exception 'Boss: phase % pattern of 1-16 attacks',i;end if;
  for x in select jsonb_array_elements_text((p->'pattern')||coalesce(p->'onEnter','[]'::jsonb)) loop
   if not (d->'attacks' ? x) then raise exception 'Boss: phase % unknown attack %',i,x;end if;
  end loop;
 end loop;
 if jsonb_typeof(d->'enrage')='object' and (jsonb_typeof(d->'enrage'->'afterTicks')<>'number' or (d->'enrage'->>'afterTicks')::numeric not between 20 and 5000) then raise exception 'Boss: enrage.afterTicks 20-5000';end if;
end $fn$;

-- ---------------------------------------------------------------- console (owner only)
create or replace function eldervale_private.boss_console(command text, payload jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $fn$
declare bid text;d jsonb;before_row jsonb;a eldervale_private.realm_actors;uid uuid;area jsonb;k text;v jsonb;res jsonb;cfg jsonb;cnt integer;
begin
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 bid:=payload->>'id';
 if command='console_boss' then
  return jsonb_build_object('config',eldervale_private.boss_config(),'defaults',eldervale_private.boss_defaults(),
   'defs',coalesce((select jsonb_agg(jsonb_build_object('id',id,'data',data,'enabled',enabled,'updatedAt',updated_at) order by (data->>'level')::integer nulls last,id) from eldervale_private.boss_defs),'[]'),
   'actors',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'boss',r.data->>'bossId','hp',r.hp,'maxHp',r.data->'hp','x',r.x,'z',r.z,'deleted',r.deleted,'respawnAt',r.respawn_at,'underground',r.data->'underground',
     'fight',(select to_jsonb(f)-'participants' from eldervale_private.boss_fights f where f.actor_id=r.id and f.active))) from eldervale_private.realm_actors r where r.data ? 'bossId' and not r.deleted),'[]'),
   'kills',coalesce((select jsonb_object_agg(boss,jsonb_build_object('players',n,'kills',total,'best',best)) from (select boss,count(*) n,sum(kills) total,min(best_ticks) best from eldervale_private.boss_kills group by boss) z),'{}'),
   'lairs',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'name',u.data->>'name','lair',u.data->>'lair','enabled',u.enabled,'entrances',u.data->'entrances','links',u.data->'links') order by u.id) from eldervale_private.underground_areas u where u.data ? 'lair'),'[]'),
   'items',coalesce((select jsonb_agg(jsonb_build_object('id',substr(c.id,6),'name',c.data->>'name','tradeable',coalesce((c.data->>'tradeable')::boolean,true),'shopless',coalesce((c.data->>'shopless')::boolean,false),
     'quest',coalesce((c.data->>'questItem')::boolean,false),'disabled',coalesce((c.data->>'disabled')::boolean,false),'boss',c.data->>'bossUnique') order by c.id) from eldervale_private.realm_catalog c where c.id like 'item:%' and coalesce((c.data->>'uniqueGear')::boolean,false)),'[]'),
   'log',coalesce((select jsonb_agg(jsonb_build_object('boss',l.boss,'kind',l.kind,'data',l.data,'at',l.at,'who',(select character_name from public.player_saves s where s.user_id=l.user_id)) order by l.id desc) from (select * from eldervale_private.boss_log order by id desc limit 40) l),'[]'));
 elsif command='console_boss_set' then
  d:=payload->'data';perform eldervale_private.boss_check(d);
  if d->>'id'<>coalesce(bid,d->>'id') then raise exception 'Boss: the id cannot change';end if;
  select data into before_row from eldervale_private.boss_defs where id=d->>'id';
  insert into eldervale_private.boss_defs(id,data,enabled,updated_at,updated_by) values(d->>'id',d,true,now(),auth.uid())
   on conflict (id) do update set data=excluded.data,updated_at=now(),updated_by=auth.uid();
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,d->>'id',before_row,d);
  return jsonb_build_object('ok',true);
 elsif command='console_boss_enable' then
  update eldervale_private.boss_defs set enabled=coalesce((payload->>'enabled')::boolean,true),updated_at=now(),updated_by=auth.uid() where id=bid;
  if not found then raise exception 'Unknown boss %',bid;end if;
  if not coalesce((payload->>'enabled')::boolean,true) then perform eldervale_private.boss_reset(f.actor_id,true) from eldervale_private.boss_fights f where f.boss=bid and f.active;end if;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,bid,null,payload);
  return jsonb_build_object('ok',true);
 elsif command='console_boss_settings' then
  cfg:=coalesce((select config from eldervale_private.boss_settings where id),'{}');
  for k,v in select key,value from jsonb_each(coalesce(payload->'config','{}')) loop
   if not (eldervale_private.boss_defaults() ? k) then raise exception 'Unknown boss setting %',k;end if;
   cfg:=cfg||jsonb_build_object(k,(case when jsonb_typeof(v)='object' then coalesce(cfg->k,'{}')||v else v end));
  end loop;
  update eldervale_private.boss_settings set config=cfg,updated_at=now() where id;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,'boss_settings',null,payload);
  return jsonb_build_object('ok',true,'config',eldervale_private.boss_config());
 elsif command='console_boss_reset_fight' then
  perform eldervale_private.boss_reset(r.id,true) from eldervale_private.realm_actors r where r.data->>'bossId'=bid;
  update eldervale_private.realm_actors set hp=coalesce((data->>'hp')::integer,hp),respawn_at=null,target=null where data->>'bossId'=bid and not deleted and hp<=0;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,bid,null,payload);
  return jsonb_build_object('ok',true);
 elsif command='console_boss_teleport' then
  select * into a from eldervale_private.realm_actors where data->>'bossId'=bid and not deleted order by id limit 1;
  if a.id is null then raise exception 'That boss is not placed in the world';end if;
  update eldervale_private.realm_players set x=(a.data->>'x')::float8-6,z=(a.data->>'z')::float8,path='[]',intent=null,input_until=null where user_id=auth.uid();
  update public.player_saves set world_position=coalesce(world_position,'{}'::jsonb)||jsonb_build_object('x',(a.data->>'x')::float8-6,'y',(a.data->>'z')::float8,'floor',0,'building',null) where user_id=auth.uid();
  return jsonb_build_object('ok',true,'x',(a.data->>'x')::float8-6,'z',(a.data->>'z')::float8);
 elsif command='console_boss_kills' then
  return jsonb_build_object('rows',coalesce((select jsonb_agg(jsonb_build_object('userId',k.user_id,'name',s.character_name,'boss',k.boss,'kills',k.kills,'best',k.best_ticks,'last',k.last_ticks,'at',k.last_at) order by k.kills desc)
   from (select * from eldervale_private.boss_kills where (bid is null or boss=bid) and (payload->>'userId' is null or user_id=(payload->>'userId')::uuid) order by kills desc limit 100) k left join public.player_saves s on s.user_id=k.user_id),'[]'));
 elsif command='console_boss_kills_reset' then
  if payload->>'userId' is null and coalesce((payload->>'all')::boolean,false) is not true then raise exception 'Choose a player (or all players)';end if;
  update eldervale_private.boss_kills set kills=0,best_ticks=null,last_ticks=null where (bid is null or boss=bid) and (payload->>'userId' is null or user_id=(payload->>'userId')::uuid);
  get diagnostics cnt=row_count;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,coalesce(bid,'*'),null,payload);
  return jsonb_build_object('ok',true,'rows',cnt);
 elsif command='console_boss_lair' then
  select data into area from eldervale_private.underground_areas where id=payload->>'area';
  if area is null then raise exception 'Unknown lair %',payload->>'area';end if;
  if payload ? 'gate' then
   area:=jsonb_set(area,'{entrances}',coalesce((select jsonb_agg(case when e ? 'requires' then jsonb_set(e,'{requires,gate}',to_jsonb(coalesce((payload->>'gate')::boolean,false))) else e end) from jsonb_array_elements(area->'entrances') e),'[]'));
   area:=jsonb_set(area,'{links}',coalesce((select jsonb_agg(case when l ? 'requires' then jsonb_set(l,'{requires,gate}',to_jsonb(coalesce((payload->>'gate')::boolean,false))) else l end) from jsonb_array_elements(coalesce(area->'links','[]')) l),'[]'));
   update eldervale_private.underground_areas set data=area,updated_at=now(),updated_by=auth.uid() where id=payload->>'area';
  end if;
  if payload ? 'enabled' then update eldervale_private.underground_areas set enabled=coalesce((payload->>'enabled')::boolean,true),updated_at=now(),updated_by=auth.uid() where id=payload->>'area';end if;
  res:=eldervale_private.underground_sync(payload->>'area');
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,payload->>'area',null,payload);
  return jsonb_build_object('ok',true,'sync',res);
 elsif command='console_boss_item' then
  if not exists(select 1 from eldervale_private.realm_catalog where id='item:'||bid and coalesce((data->>'uniqueGear')::boolean,false)) then raise exception 'Not a unique item: %',bid;end if;
  d:='{}'::jsonb;
  if payload ? 'tradeable' then d:=d||jsonb_build_object('tradeable',(payload->>'tradeable')::boolean,'untradeable',not (payload->>'tradeable')::boolean,'keepOnDeath',not (payload->>'tradeable')::boolean);end if;
  if payload ? 'shopless' then d:=d||jsonb_build_object('shopless',(payload->>'shopless')::boolean);end if;
  if payload ? 'disabled' then d:=d||jsonb_build_object('disabled',(payload->>'disabled')::boolean);end if;
  update eldervale_private.realm_catalog set data=data||d where id='item:'||bid;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,bid,null,payload);
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Unknown console command';
end $fn$;

-- Player read-out: boss names/levels/lairs and the caller's kill counts and personal bests.
create or replace function public.boss_journal() returns jsonb
language sql stable security definer set search_path to '' as $fn$
 select jsonb_build_object('bosses',coalesce((select jsonb_agg(jsonb_build_object('id',b.id,'name',b.data->>'name','level',b.data->'level','lair',b.data->'lair'->>'area',
   'uniques',b.data->'uniques','kills',coalesce(k.kills,0),'best',k.best_ticks) order by (b.data->>'level')::integer)
  from eldervale_private.boss_defs b left join eldervale_private.boss_kills k on k.boss=b.id and k.user_id=auth.uid() where b.enabled),'[]'))
$fn$;
revoke all on function public.boss_journal() from public,anon;
grant execute on function public.boss_journal() to authenticated;
revoke all on function eldervale_private.boss_check(jsonb),eldervale_private.boss_console(text,jsonb) from public,anon,authenticated;

-- ---------------------------------------------------------------- hooks (live anchors, each matches once)
do $patch$
declare fn text;old text;new text;body text;
begin
 for fn,old,new in select e->>0,e->>1,e->>2 from jsonb_array_elements($edits$[
  ["eldervale_private.mech_combat(text,uuid,double precision,timestamp with time zone)",
   " kind:=eldervale_private.mech_npc_kind(a.data);",
   " if (a.data ? 'bossId' or a.data->>'template'='dragon') and eldervale_private.boss_turn(actor_id,uid,t) then return;end if;\n kind:=eldervale_private.mech_npc_kind(a.data);"],
  ["eldervale_private.mech_apply(text,text,jsonb,timestamp with time zone)",
   " update eldervale_private.realm_actors set hp=greatest(0,hp-dmg) where id=target_id;",
   " if a.data ? 'bossId' then dmg:=eldervale_private.boss_gate(target_id,a.data,dmg,style,uid,t);end if;\n update eldervale_private.realm_actors set hp=greatest(0,hp-dmg) where id=target_id;"],
  ["eldervale_private.mech_kill(text,uuid,timestamp with time zone)",
   "  perform eldervale_private.mech_drop(actor_id,killer);",
   "  perform eldervale_private.boss_on_kill(actor_id,killer,t,eldervale_private.mech_drop(actor_id,killer));"],
  ["eldervale_private.mech_tick(timestamp with time zone)",
   " -- Pending hits: NPCs first, then players (OSRS processing order).",
   " perform eldervale_private.boss_tick(t);\n -- Pending hits: NPCs first, then players (OSRS processing order)."],
  ["eldervale_private.mech_command(uuid,text,jsonb,uuid)",
   "or cat ? 'stamina') then raise exception 'You cannot drink that.';",
   "or cat ? 'stamina' or cat ? 'breathward') then raise exception 'You cannot drink that.';"],
  ["eldervale_private.mech_command(uuid,text,jsonb,uuid)",
   "  if cat ? 'stamina' then update eldervale_private.player_mech set stamina_until=now_tick+(cat->>'stamina')::integer where user_id=uid;end if;",
   "  if cat ? 'stamina' then update eldervale_private.player_mech set stamina_until=now_tick+(cat->>'stamina')::integer where user_id=uid;end if;\n  if cat ? 'breathward' then perform eldervale_private.boss_breathward(uid,(cat->>'breathward')::integer);end if;"],
  ["eldervale_private.underground_command(uuid,text,jsonb,uuid,bigint)",
   "   need:=coalesce((d->'requires'->>'agility')::integer,0);",
   "   if coalesce((d->'requires'->>'gate')::boolean,false) and d->'requires'->>'unlock' is not null and not eldervale_private.player_unlocked(auth.uid(),d->'requires'->>'unlock') then raise exception '%',coalesce(d->'requires'->>'locked','Something bars the way. Perhaps a quest will open it.');end if;\n   need:=coalesce((d->'requires'->>'agility')::integer,0);"],
  ["eldervale_private.underground_passages(jsonb)",
   "'passage',jsonb_build_object('area',d->>'id','dest',jsonb_build_array(bx+1.6,bz),'depth',(l->'to'->>'level')::integer)));",
   "'passage',jsonb_build_object('area',d->>'id','dest',jsonb_build_array(bx+1.6,bz),'depth',(l->'to'->>'level')::integer,'requires',l->'requires')));"],
  ["eldervale_private.underground_check(jsonb)",
   "not in ('earth','crypt','fire') then raise exception 'Underground: theme earth, crypt or fire';",
   "not in ('earth','crypt','fire','ice') then raise exception 'Underground: theme earth, crypt, fire or ice';"],
  ["eldervale_private.admin_console(text,jsonb)",
   " if command='console_give_xp' then",
   " if command like 'console\\_boss%' then return eldervale_private.boss_console(command,payload);end if;\n if command='console_give_xp' then"]
 ]$edits$::jsonb) e loop
  body:=pg_get_functiondef(fn::regprocedure);
  if position(new in body)>0 then continue;end if;
  perform eldervale_private.patch_function(fn::regprocedure,array[old,new]);
 end loop;
end $patch$;

commit;
