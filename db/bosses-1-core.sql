-- Eldervale bosses (Round 3, R3-I), part 1: state tables, settings, the pure helpers and the fight
-- runtime. Client twin: bosses.js (definitions, telegraph shapes, breath maths), boss-fx.js (tells).
-- APPLY ORDER: bosses-1-core.sql, bosses-2-hooks.sql, bosses-3-lairs.sql, bosses-4-gear.sql
-- (after mechanics-ii-1..3 and underground-1..3). Idempotent. Nothing in the running game changes
-- until part 2 hooks it in.
--
-- A fight lives in eldervale_private.boss_fights (one row per boss actor):
--  * boss_turn (from mech_combat, the NPC's own turn): picks the next attack of the current phase's
--    pattern when the boss's attack timer is ready: a strike (protect prayers), a telegraph (marked
--    tiles resolved `tell` ticks later), a charge (hit after a charge-up), breath (reduced by the
--    anti-breath shields, Breathward tonic and Ward of Sorcery), a summon (adds) or flight.
--  * boss_gate (from mech_apply): immunity (phases, flight vs melee, adds alive) and damage tracking.
--  * boss_tick (from mech_tick, once per game tick): resolves due telegraphs, phase changes (HP
--    thresholds, onEnter attacks), enrage, idle reset (full heal, adds removed).
--  * boss_on_kill (from mech_kill): kill counts for every participant, personal-best time, rare loot
--    announcement, loot chest event, the lair respawn timer.
-- Every timer is a 600 ms game tick number (eldervale_private.tick_no).
begin;
set local lock_timeout='5s';

create table if not exists eldervale_private.boss_defs(
 id text primary key check(id ~ '^[a-z][a-z0-9_]{1,40}$'),
 data jsonb not null,
 enabled boolean not null default true,
 updated_at timestamptz not null default now(),
 updated_by uuid);
create table if not exists eldervale_private.boss_settings(
 id boolean primary key default true check(id),
 config jsonb not null default '{}',
 updated_at timestamptz not null default now());
insert into eldervale_private.boss_settings(id) values(true) on conflict (id) do nothing;
create table if not exists eldervale_private.boss_fights(
 actor_id text primary key,
 boss text not null,
 active boolean not null default false,
 started_tick bigint,
 last_tick bigint,
 phase integer not null default 0,
 cursor integer not null default 0,
 queue jsonb not null default '[]',
 telegraph jsonb not null default '[]',
 flying_until bigint,
 enraged boolean not null default false,
 adds text[] not null default '{}',
 participants jsonb not null default '{}',
 note_tick bigint not null default 0);
create table if not exists eldervale_private.boss_kills(
 user_id uuid not null,
 boss text not null,
 kills integer not null default 0,
 best_ticks integer,
 last_ticks integer,
 last_at timestamptz not null default now(),
 primary key(user_id,boss));
create table if not exists eldervale_private.boss_log(
 id bigserial primary key,
 boss text,
 user_id uuid,
 kind text not null,
 data jsonb not null default '{}',
 at timestamptz not null default now());
create table if not exists eldervale_private.boss_players(
 user_id uuid primary key,
 breath_until bigint not null default 0);
revoke all on table eldervale_private.boss_defs,eldervale_private.boss_settings,eldervale_private.boss_fights,eldervale_private.boss_kills,eldervale_private.boss_log,eldervale_private.boss_players from public,anon,authenticated;

-- ---------------------------------------------------------------- settings
create or replace function eldervale_private.boss_defaults() returns jsonb language sql immutable set search_path to '' as $fn$
 select '{"enabled":true,
  "breath":{"enabled":true,"shieldPct":15,"aegisPct":8,"potionPct":30,"prayerPct":40,"dragonChance":0.25,"dragonMaxHit":300,"potionTicks":500,"shields":{"scalewardShield":"shieldPct","wardensAegis":"aegisPct"}},
  "fight":{"reset_ticks":20,"area_min":0.75,"announce_rare":true,"chest":true}}'::jsonb
$fn$;
create or replace function eldervale_private.boss_config() returns jsonb language sql stable set search_path to '' as $fn$
 select coalesce((select jsonb_object_agg(d.key,(case when jsonb_typeof(d.value)='object' and jsonb_typeof(c.config->d.key)='object' then d.value||(c.config->d.key) when c.config ? d.key and jsonb_typeof(d.value)<>'object' then c.config->d.key else d.value end))
  from jsonb_each(eldervale_private.boss_defaults()) d left join eldervale_private.boss_settings c on c.id),eldervale_private.boss_defaults())
$fn$;
create or replace function eldervale_private.boss_on() returns boolean language sql stable set search_path to '' as $fn$
 select coalesce((select (config->>'enabled')::boolean from eldervale_private.boss_settings where id),true) and eldervale_private.mech_on()
$fn$;
create or replace function eldervale_private.boss_def(bid text) returns jsonb language sql stable set search_path to '' as $fn$
 select data from eldervale_private.boss_defs where id=bid and enabled
$fn$;

-- ---------------------------------------------------------------- pure helpers (= bosses.js)
-- Telegraph tiles: shape around the target tile (ci,cj) or the boss tile (bi,bj).
create or replace function eldervale_private.boss_tiles(shape text, ci integer, cj integer, bi integer, bj integer, radius integer, cnt integer) returns jsonb
language plpgsql volatile set search_path to '' as $fn$
declare o jsonb:='[]'::jsonb;r integer:=greatest(0,least(12,coalesce(radius,1)));di integer;dj integer;k integer;w integer;dx integer;dz integer;dir integer;major boolean;ux integer;uz integer;px integer;pz integer;ti integer;tj integer;seen text[]:='{}';
begin
 if shape='target' then
  for dj in -r..r loop for di in -r..r loop o:=o||jsonb_build_array(jsonb_build_array(ci+di,cj+dj));end loop;end loop;
 elsif shape='around' then
  for dj in -r..r loop for di in -r..r loop if di<>0 or dj<>0 then o:=o||jsonb_build_array(jsonb_build_array(bi+di,bj+dj));end if;end loop;end loop;
 elsif shape='ring' then
  for dj in -r..r loop for di in -r..r loop if greatest(abs(di),abs(dj))>=greatest(2,r-1) then o:=o||jsonb_build_array(jsonb_build_array(bi+di,bj+dj));end if;end loop;end loop;
 elsif shape='cross' then
  o:=jsonb_build_array(jsonb_build_array(ci,cj));
  for k in 1..r loop o:=o||jsonb_build_array(jsonb_build_array(ci+k,cj),jsonb_build_array(ci-k,cj),jsonb_build_array(ci,cj+k),jsonb_build_array(ci,cj-k));end loop;
 elsif shape in ('line','behind') then
  dx:=ci-bi;dz:=cj-bj;if dx=0 and dz=0 then dz:=1;end if;
  dir:=(case when shape='behind' then -1 else 1 end);major:=abs(dx)>=abs(dz);
  ux:=(case when major then sign(dx)::integer*dir else 0 end);uz:=(case when major then 0 else sign(dz)::integer*dir end);px:=(case when major then 0 else 1 end);pz:=(case when major then 1 else 0 end);
  for k in 1..greatest(1,r) loop for w in -1..1 loop o:=o||jsonb_build_array(jsonb_build_array(bi+ux*k+px*w,bj+uz*k+pz*w));end loop;end loop;
 elsif shape='scatter' then
  for k in 1..least(24,greatest(1,coalesce(cnt,6))) loop
   ti:=ci+floor(random()*(2*r+1))::integer-r;tj:=cj+floor(random()*(2*r+1))::integer-r;
   if not ((ti||','||tj)=any(seen)) then seen:=seen||(ti||','||tj);o:=o||jsonb_build_array(jsonb_build_array(ti,tj));end if;
  end loop;
 end if;
 return o;
end $fn$;
-- Breath damage multiplier from the shield key, an active Breathward tonic and Ward of Sorcery.
create or replace function eldervale_private.boss_breath_calc(shield text, potion boolean, protect_magic boolean, b jsonb) returns float8 language sql immutable set search_path to '' as $fn$
 select round((
  coalesce((select coalesce((b->>(b->'shields'->>shield))::numeric,100)/100 where b->'shields' ? coalesce(shield,'')),1)
  *(case when potion then coalesce((b->>'potionPct')::numeric,100)/100 else 1 end)
  *(case when protect_magic then coalesce((b->>'prayerPct')::numeric,100)/100 else 1 end))::numeric,4)::float8
$fn$;
create or replace function eldervale_private.boss_breath_mult(uid uuid, now_tick bigint) returns float8 language sql stable set search_path to '' as $fn$
 select eldervale_private.boss_breath_calc(
  (select s.equipment->>'shield' from public.player_saves s where s.user_id=uid),
  coalesce((select bp.breath_until>now_tick from eldervale_private.boss_players bp where bp.user_id=uid),false),
  coalesce(eldervale_private.mech_prayer_effects((select pm.prayers from eldervale_private.player_mech pm where pm.user_id=uid))->>'protect'='magic',false),
  eldervale_private.boss_config()->'breath')
$fn$;
-- The phase for an HP percentage: the last phase whose `at` is >= pct.
create or replace function eldervale_private.boss_phase_at(def jsonb, pct numeric) returns integer language sql immutable set search_path to '' as $fn$
 select coalesce(max(o-1),0)::integer from jsonb_array_elements(coalesce(def->'phases','[]')) with ordinality p(v,o) where pct<=coalesce((v->>'at')::numeric,100)
$fn$;
create or replace function eldervale_private.boss_attack_ticks(def jsonb, phase integer, enraged boolean) returns integer language sql immutable set search_path to '' as $fn$
 select greatest(2,coalesce((def->'phases'->phase->>'attackTicks')::integer,(def->>'attackTicks')::integer,5)-(case when enraged then coalesce((def->'enrage'->>'attackTicksMinus')::integer,0) else 0 end))
$fn$;
create or replace function eldervale_private.boss_kc(uid uuid, bid text) returns integer language sql stable security definer set search_path to '' as $fn$
 select coalesce((select kills from eldervale_private.boss_kills where user_id=uid and boss=bid),0)
$fn$;
create or replace function eldervale_private.boss_pb(uid uuid, bid text) returns integer language sql stable security definer set search_path to '' as $fn$
 select best_ticks from eldervale_private.boss_kills where user_id=uid and boss=bid
$fn$;

-- ---------------------------------------------------------------- fight state
create or replace function eldervale_private.boss_start(actor_id text, def jsonb, now_tick bigint) returns eldervale_private.boss_fights
language plpgsql set search_path to '' as $fn$
declare f eldervale_private.boss_fights;a eldervale_private.realm_actors;
begin
 select * into f from eldervale_private.boss_fights where boss_fights.actor_id=boss_start.actor_id;
 if f.actor_id is not null and f.active then return f;end if;
 select * into a from eldervale_private.realm_actors where id=actor_id;
 insert into eldervale_private.boss_fights(actor_id,boss,active,started_tick,last_tick,phase,cursor,queue,telegraph,flying_until,enraged,adds,participants,note_tick)
  values(actor_id,def->>'id',true,now_tick,now_tick,0,0,'[]','[]',null,false,'{}','{}',0)
  on conflict on constraint boss_fights_pkey do update set boss=excluded.boss,active=true,started_tick=now_tick,last_tick=now_tick,phase=0,cursor=0,queue='[]',telegraph='[]',flying_until=null,enraged=false,adds='{}',participants='{}',note_tick=0
  returning * into f;
 perform eldervale_private.emit(jsonb_build_object('type','boss_start','target',actor_id,'boss',def->>'id','name',def->>'name','hp',a.hp,'maxHp',coalesce((a.data->>'hp')::integer,a.hp),
  'phases',(select coalesce(jsonb_agg(jsonb_build_object('at',v->'at','name',v->'name')),'[]') from jsonb_array_elements(def->'phases') v),
  'arena',jsonb_build_object('x',a.data->'x','z',a.data->'z','radius',coalesce((def->'arena'->>'radius')::integer,10)),'enrageTicks',def->'enrage'->'afterTicks'));
 return f;
end $fn$;

-- End a fight: adds leave, telegraphs clear; `heal` sends the boss home at full health.
create or replace function eldervale_private.boss_reset(actor_id text, heal boolean) returns void
language plpgsql set search_path to '' as $fn$
declare f eldervale_private.boss_fights;rev bigint;
begin
 select * into f from eldervale_private.boss_fights where boss_fights.actor_id=boss_reset.actor_id for update;
 if f.actor_id is null then return;end if;
 update eldervale_private.boss_fights set active=false,queue='[]',telegraph='[]',flying_until=null,adds='{}' where boss_fights.actor_id=boss_reset.actor_id;
 if cardinality(f.adds)>0 then
  update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
  update eldervale_private.entities set deleted=true,revision=rev where id::text=any(f.adds) and not deleted;
 end if;
 if heal then
  update eldervale_private.realm_actors set hp=coalesce((data->>'hp')::integer,hp),target=null,phase='ready',x=coalesce((data->>'x')::float8,x),z=coalesce((data->>'z')::float8,z) where id=actor_id and hp>0;
  update eldervale_private.actor_mech set pending='[]',poison=0,venom=0,poison_tick=null,drain='{}',retreat=false,bound_until=0,engaged_tick=null where id=actor_id;
 end if;
 if f.active then perform eldervale_private.emit(jsonb_build_object('type','boss_reset','target',actor_id,'boss',f.boss,'healed',heal));end if;
end $fn$;

-- Adds: copies of a roster monster as entities next to the boss (the entity trigger makes the actors).
create or replace function eldervale_private.boss_summon(actor_id text, def jsonb, atk jsonb) returns integer
language plpgsql set search_path to '' as $fn$
declare a eldervale_private.realm_actors;tpl jsonb;rev bigint;n integer:=greatest(1,least(6,coalesce((atk->>'count')::integer,2)));k integer;eid uuid;ids text[]:='{}';ang float8;px float8;pz float8;
begin
 select * into a from eldervale_private.realm_actors where id=actor_id;
 select e.data into tpl from eldervale_private.entities e where e.data->>'rosterKey'=atk->>'add' and e.data->>'blueprint'='monster-roster-v1' order by e.id limit 1;
 if a.id is null or tpl is null then return 0;end if;
 update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
 for k in 0..n-1 loop
  ang:=k*2*pi()/n+random();px:=a.x+cos(ang)*3.2;pz:=a.z+sin(ang)*3.2;
  if not eldervale_private.can_step(a.x,a.z,px,pz) then px:=a.x+cos(ang)*1.6;pz:=a.z+sin(ang)*1.6;end if;
  eid:=md5('boss-add:'||actor_id||':'||(atk->>'add')||':'||k)::uuid;ids:=ids||eid::text;
  insert into eldervale_private.entities(id,revision,data,deleted) values(eid,rev,
    (tpl-'group'-'groupName'-'blueprint'-'blueprintKey'-'patrol'-'route'-'bossId'-'boss')||jsonb_build_object('x',round(px::numeric,2),'z',round(pz::numeric,2),'respawn',0,'roam',4,
     'aggroMode','always','hostile',true,'bossAdd',actor_id,'underground',a.data->'underground','floor',coalesce((a.data->>'floor')::integer,0),'blueprint','boss-add-v1','blueprintKey',actor_id||':'||k),false)
   on conflict (id) do update set revision=rev,data=excluded.data,deleted=false;
 end loop;
 update eldervale_private.boss_fights set adds=(select array(select distinct x from unnest(adds||ids) x)) where boss_fights.actor_id=boss_summon.actor_id;
 perform eldervale_private.emit(jsonb_build_object('type','boss_summon','target',actor_id,'boss',def->>'id','adds',to_jsonb(ids),'text',atk->>'text'));
 return n;
end $fn$;
create or replace function eldervale_private.boss_adds_alive(f eldervale_private.boss_fights) returns integer language sql stable set search_path to '' as $fn$
 select count(*)::integer from eldervale_private.realm_actors where id=any(f.adds) and hp>0 and not deleted
$fn$;

-- ---------------------------------------------------------------- damage gate (mech_apply, actor side)
create or replace function eldervale_private.boss_gate(actor_id text, d jsonb, dmg integer, style text, uid uuid, t timestamptz) returns integer
language plpgsql set search_path to '' as $fn$
declare def jsonb;f eldervale_private.boss_fights;now_tick bigint:=eldervale_private.tick_no(t);ph jsonb;msg text;
begin
 if not eldervale_private.boss_on() then return dmg;end if;
 def:=eldervale_private.boss_def(d->>'bossId');if def is null then return dmg;end if;
 select * into f from eldervale_private.boss_fights where boss_fights.actor_id=boss_gate.actor_id;
 if (f.actor_id is null or not f.active) then if uid is null then return dmg;end if;f:=eldervale_private.boss_start(actor_id,def,now_tick);end if;
 ph:=def->'phases'->f.phase;
 if f.flying_until>now_tick and style not in ('ranged','magic','poison') then msg:=(def->>'name')||' is in the air — use ranged or magic.';dmg:=0;
 elsif coalesce((ph->>'immune')::boolean,false) then msg:=(def->>'name')||' cannot be harmed right now.';dmg:=0;
 elsif coalesce((ph->>'immuneWhileAdds')::boolean,false) and eldervale_private.boss_adds_alive(f)>0 then msg:=coalesce(ph->>'text',(def->>'name')||' is shielded by its allies.');dmg:=0;
 end if;
 if msg is not null and uid is not null and f.note_tick<now_tick-8 then
  update eldervale_private.boss_fights set note_tick=now_tick where boss_fights.actor_id=boss_gate.actor_id;
  perform eldervale_private.emit(jsonb_build_object('type','notice','player',uid,'text',msg));
 end if;
 if uid is not null then
  update eldervale_private.boss_fights set participants=participants||jsonb_build_object(uid::text,coalesce((participants->>uid::text)::integer,0)+dmg),last_tick=now_tick where boss_fights.actor_id=boss_gate.actor_id;
 end if;
 return dmg;
exception when others then
 perform eldervale_private.mech_fault('boss gate',sqlerrm);return dmg;
end $fn$;

-- ---------------------------------------------------------------- the boss's turn (mech_combat)
-- true = the boss used its turn (no chase, no normal attack this tick).
create or replace function eldervale_private.boss_turn(actor_id text, uid uuid, t timestamptz) returns boolean
language plpgsql set search_path to '' as $fn$
declare def jsonb;f eldervale_private.boss_fights;a eldervale_private.realm_actors;p eldervale_private.realm_players;s public.player_saves;am eldervale_private.actor_mech;pm eldervale_private.player_mech;
 now_tick bigint:=eldervale_private.tick_no(t);mm jsonb;key text;atk jsonb;kind text;style text;d integer;sd integer;dist float8;reach float8;base integer;dmg integer;w jsonb;wkey text;tiles jsonb;tell integer;
 ci integer;cj integer;bi integer;bj integer;q jsonb;pct numeric:=100;sweep jsonb;
begin
 if not eldervale_private.boss_on() then return false;end if;
 select * into a from eldervale_private.realm_actors where id=actor_id;
 def:=eldervale_private.boss_def(a.data->>'bossId');
 if def is null then
  if a.data->>'template'='dragon' and not (a.data ? 'bossId') then return eldervale_private.boss_dragon_breath(actor_id,uid,t);end if;
  return false;
 end if;
 select * into p from eldervale_private.realm_players where user_id=uid;
 select * into f from eldervale_private.boss_fights where boss_fights.actor_id=boss_turn.actor_id;
 if f.actor_id is null or not f.active then f:=eldervale_private.boss_start(actor_id,def,now_tick);end if;
 update eldervale_private.boss_fights set last_tick=now_tick where boss_fights.actor_id=boss_turn.actor_id;
 -- Arena: a target who left the arena is dropped (the boss stays home).
 sd:=greatest(abs(eldervale_private.tile_of(p.x)-eldervale_private.tile_of((a.data->>'x')::float8)),abs(eldervale_private.tile_of(p.z)-eldervale_private.tile_of((a.data->>'z')::float8)));
 if sd>coalesce((def->'arena'->>'radius')::integer,10)+1 then
  update eldervale_private.realm_actors set target=null,phase='ready' where id=actor_id;return true;
 end if;
 if f.flying_until>now_tick or jsonb_array_length(f.telegraph)>0 then return true;end if;
 insert into eldervale_private.actor_mech(id) values(actor_id) on conflict (id) do nothing;
 select * into am from eldervale_private.actor_mech where id=actor_id;
 if am.attack_tick>now_tick then return false;end if;
 -- Next attack: queued phase openers first, then the phase pattern.
 if jsonb_array_length(f.queue)>0 then key:=f.queue->>0;
 else key:=def->'phases'->f.phase->'pattern'->>(f.cursor%greatest(1,jsonb_array_length(def->'phases'->f.phase->'pattern')));end if;
 atk:=def->'attacks'->key;
 if atk is null then update eldervale_private.boss_fights set queue=(case when jsonb_array_length(queue)>0 then queue-0 else queue end),cursor=(case when jsonb_array_length(queue)>0 then cursor else cursor+1 end) where boss_fights.actor_id=boss_turn.actor_id;return false;end if;
 kind:=atk->>'kind';style:=coalesce(atk->>'style','melee');
 mm:=eldervale_private.mech_monster(actor_id,a.data);
 dist:=sqrt(power(a.x-p.x,2)+power(a.z-p.z,2));d:=greatest(0,round(dist/eldervale_private.tile_size())::integer);
 reach:=(case when eldervale_private.tile_mode() then 1.66 else 2.4 end)*greatest(1,least(2,coalesce((a.data->>'scale')::float8,1)*.6));
 -- Out of melee reach: keep the attack for later and let the normal code chase.
 if kind='strike' and style='melee' and dist>reach then return false;end if;
 update eldervale_private.boss_fights set queue=(case when jsonb_array_length(queue)>0 then queue-0 else queue end),cursor=(case when jsonb_array_length(queue)>0 then cursor else cursor+1 end) where boss_fights.actor_id=boss_turn.actor_id;
 update eldervale_private.actor_mech set attack_tick=now_tick+eldervale_private.boss_attack_ticks(def,f.phase,f.enraged),engaged_tick=now_tick where id=actor_id;
 update eldervale_private.realm_actors set yaw=atan2(p.x-a.x,p.z-a.z) where id=actor_id;
 ci:=eldervale_private.tile_of(p.x);cj:=eldervale_private.tile_of(p.z);bi:=eldervale_private.tile_of(a.x);bj:=eldervale_private.tile_of(a.z);
 pct:=(case when f.enraged then coalesce((def->'enrage'->>'damagePct')::numeric,100) else 100 end);
 if kind='strike' then
  select * into s from public.player_saves where user_id=uid;pm:=eldervale_private.mech_player(uid);
  wkey:=coalesce(s.equipment->>'weapon','unarmed');select data into w from eldervale_private.realm_catalog where id='weapon:'||wkey;w:=coalesce(w,'{"damage":1,"attack":0,"speed":1.8}');
  base:=eldervale_private.mech_npc_roll(s.skills,s.equipment,eldervale_private.mech_style(uid,p.attack_style),w,a.data,eldervale_private.mech_prayer_effects(pm.prayers));
  dmg:=(case when base<=0 then 0 else 1+floor(random()*coalesce((atk->>'maxHit')::numeric,(a.data->>'maxHit')::numeric,100)*pct/100)::integer end);
  perform eldervale_private.emit(jsonb_build_object('type','windup','side','enemy','target',actor_id,'player',uid,'attackType',a.data->>'attackType','ranged',style<>'melee'));
  perform eldervale_private.emit(jsonb_build_object('type','boss_attack','target',actor_id,'player',uid,'boss',def->>'id','attack',key,'name',atk->>'name','style',style,'color',atk->'color','text',atk->>'text'));
  tell:=eldervale_private.mech_hit_delay(style,d,false);
  q:=jsonb_build_object('at',now_tick+tell,'src',actor_id,'srcKind','npc','dmg',dmg,'style',style,'pierce',false,
   'poison',(case when coalesce((atk->>'venom')::boolean,false) then '{"venom":true,"chance":0.25}'::jsonb else mm->'poison' end));
  if tell<=0 then perform eldervale_private.mech_apply('player',uid::text,q,t);
  else update eldervale_private.player_mech set pending=pending||jsonb_build_array(q) where user_id=uid;end if;
  return true;
 elsif kind='summon' then
  perform eldervale_private.boss_summon(actor_id,def,atk);return true;
 elsif kind='flight' then
  update eldervale_private.boss_fights set flying_until=now_tick+greatest(2,coalesce((atk->>'ticks')::integer,6)) where boss_fights.actor_id=boss_turn.actor_id;
  q:='[]'::jsonb;sweep:=def->'attacks'->(atk->>'sweep');
  if sweep is not null then
   q:=q||jsonb_build_array(jsonb_build_object('key',atk->>'sweep','at',now_tick+2,'tiles',eldervale_private.boss_tiles(coalesce(sweep->>'shape','line'),ci,cj,bi,bj,coalesce((sweep->>'radius')::integer,10),6),
    'maxHit',sweep->'maxHit','breath',coalesce(sweep->>'element','fire'),'pct',pct));
  end if;
  q:=q||jsonb_build_array(jsonb_build_object('key',key,'at',now_tick+greatest(2,coalesce((atk->>'ticks')::integer,6)),'tiles',eldervale_private.boss_tiles(coalesce(atk->'land'->>'shape','around'),ci,cj,ci,cj,coalesce((atk->'land'->>'radius')::integer,1),6)||jsonb_build_array(jsonb_build_array(ci,cj)),
   'maxHit',coalesce(atk->'land'->'maxHit','300'::jsonb),'land',jsonb_build_array(ci*eldervale_private.tile_size(),cj*eldervale_private.tile_size()),'pct',pct));
  update eldervale_private.boss_fights set telegraph=q where boss_fights.actor_id=boss_turn.actor_id;
  perform eldervale_private.emit(jsonb_build_object('type','boss_flight','target',actor_id,'boss',def->>'id','up',true,'ticks',coalesce((atk->>'ticks')::integer,6),'text',atk->>'text'));
  for sweep in select value from jsonb_array_elements(q) loop
   perform eldervale_private.emit(jsonb_build_object('type','boss_telegraph','target',actor_id,'boss',def->>'id','attack',sweep->>'key','tiles',sweep->'tiles','ticks',(sweep->>'at')::bigint-now_tick,
    'color',coalesce(def->'attacks'->(sweep->>'key')->'color',atk->'color','16738842'::jsonb),'breath',sweep->'breath','land',sweep->'land','sound',def->'attacks'->(sweep->>'key')->>'sound'));
  end loop;
  return true;
 end if;
 -- telegraph / charge / breath: marked now, resolved `tell` ticks later in boss_tick.
 tell:=greatest(1,least(6,coalesce((atk->>'tell')::integer,(case when kind='telegraph' then 2 else 1 end))));
 tiles:=(case when kind='telegraph' or (kind='breath' and atk ? 'shape') then eldervale_private.boss_tiles(atk->>'shape',ci,cj,bi,bj,coalesce((atk->>'radius')::integer,1),coalesce((atk->>'count')::integer,6)) else '[]'::jsonb end);
 q:=jsonb_build_object('key',key,'at',now_tick+tell,'tiles',tiles,'maxHit',atk->'maxHit','uid',uid,'style',(case when kind='charge' then style end),'breath',(case when kind='breath' then coalesce(atk->>'element','fire') end),'pct',pct);
 update eldervale_private.boss_fights set telegraph=telegraph||jsonb_build_array(q) where boss_fights.actor_id=boss_turn.actor_id;
 perform eldervale_private.emit(jsonb_build_object('type','boss_telegraph','target',actor_id,'player',uid,'boss',def->>'id','attack',key,'name',atk->>'name','tiles',tiles,'ticks',tell,
  'charge',jsonb_array_length(tiles)=0,'style',q->'style','breath',q->'breath','color',atk->'color','sound',atk->>'sound','text',atk->>'text'));
 return true;
exception when others then
 perform eldervale_private.mech_fault('boss turn',sqlerrm);return false;
end $fn$;

-- One due telegraph: hit everyone still on the marked tiles (or the charged target).
create or replace function eldervale_private.boss_resolve(actor_id text, q jsonb, t timestamptz) returns integer
language plpgsql set search_path to '' as $fn$
declare a eldervale_private.realm_actors;def jsonb;r record;n integer:=0;dmg integer;mult float8;hit boolean;cx float8;cz float8;rad integer;now_tick bigint:=eldervale_private.tick_no(t);maxhit numeric;
begin
 select * into a from eldervale_private.realm_actors where id=actor_id;
 if a.id is null or a.hp<=0 or a.deleted then return 0;end if;
 def:=eldervale_private.boss_def(a.data->>'bossId');
 cx:=coalesce((a.data->>'x')::float8,a.x);cz:=coalesce((a.data->>'z')::float8,a.z);rad:=coalesce((def->'arena'->>'radius')::integer,10)+3;
 if jsonb_typeof(q->'land')='array' then
  update eldervale_private.realm_actors set x=(q->'land'->>0)::float8,z=(q->'land'->>1)::float8 where id=actor_id;
  perform eldervale_private.emit(jsonb_build_object('type','boss_flight','target',actor_id,'up',false,'x',q->'land'->0,'z',q->'land'->1));
 end if;
 maxhit:=coalesce((q->>'maxHit')::numeric,200)*coalesce((q->>'pct')::numeric,100)/100;
 for r in select pl.user_id,pl.x,pl.z from eldervale_private.realm_players pl join public.player_saves s on s.user_id=pl.user_id
   where pl.last_seen>t-interval '15 seconds' and pl.floor=coalesce((a.data->>'floor')::integer,0) and s.health>0 and not(s.game_flags ? 'deathRespawnAt')
    and greatest(abs(eldervale_private.tile_of(pl.x)-eldervale_private.tile_of(cx)),abs(eldervale_private.tile_of(pl.z)-eldervale_private.tile_of(cz)))<=rad loop
  if jsonb_array_length(coalesce(q->'tiles','[]'))>0 then hit:=(q->'tiles')@>jsonb_build_array(jsonb_build_array(eldervale_private.tile_of(r.x),eldervale_private.tile_of(r.z)));
  else hit:=r.user_id::text=q->>'uid';end if;
  if not hit then continue;end if;
  n:=n+1;
  if q->>'breath' is not null then
   dmg:=floor(maxhit*(eldervale_private.boss_config()->'fight'->>'area_min')::numeric+random()*maxhit*(1-(eldervale_private.boss_config()->'fight'->>'area_min')::numeric))::integer;
   mult:=eldervale_private.boss_breath_mult(r.user_id,now_tick);dmg:=floor(dmg*mult)::integer;
   perform eldervale_private.mech_apply('player',r.user_id::text,jsonb_build_object('src',actor_id,'srcKind','npc','dmg',dmg,'style','magic','pierce',true),t);
   if mult>=.99 then perform eldervale_private.emit(jsonb_build_object('type','notice','player',r.user_id,'text',(case when q->>'breath'='frost' then 'The frost breath bites deep! ' else 'The breath scorches you! ' end)||'An anti-breath shield, a Breathward tonic and Ward of Sorcery all help.'));end if;
  elsif q->>'style' is not null then
   dmg:=1+floor(random()*maxhit)::integer;
   perform eldervale_private.mech_apply('player',r.user_id::text,jsonb_build_object('src',actor_id,'srcKind','npc','dmg',dmg,'style',q->>'style','pierce',false),t);
  else
   dmg:=floor(maxhit*(eldervale_private.boss_config()->'fight'->>'area_min')::numeric+random()*maxhit*(1-(eldervale_private.boss_config()->'fight'->>'area_min')::numeric))::integer;
   perform eldervale_private.mech_apply('player',r.user_id::text,jsonb_build_object('src',actor_id,'srcKind','npc','dmg',dmg,'style','area','pierce',true),t);
  end if;
 end loop;
 perform eldervale_private.emit(jsonb_build_object('type','boss_impact','target',actor_id,'attack',q->>'key','tiles',q->'tiles','breath',q->'breath','hits',n));
 return n;
end $fn$;

-- ---------------------------------------------------------------- per tick (mech_tick)
create or replace function eldervale_private.boss_tick(t timestamptz) returns void
language plpgsql set search_path to '' as $fn$
declare f eldervale_private.boss_fights;a eldervale_private.realm_actors;def jsonb;now_tick bigint:=eldervale_private.tick_no(t);due jsonb;rest jsonb;q jsonb;np integer;maxhp integer;reset_ticks integer;
begin
 if not eldervale_private.boss_on() then return;end if;
 reset_ticks:=coalesce((eldervale_private.boss_config()->'fight'->>'reset_ticks')::integer,20);
 for f in select * from eldervale_private.boss_fights where active loop
  begin
   select * into a from eldervale_private.realm_actors where id=f.actor_id;def:=eldervale_private.boss_def(f.boss);
   if a.id is null or a.deleted or def is null or a.hp<=0 then perform eldervale_private.boss_reset(f.actor_id,false);continue;end if;
   if (a.target is null and f.last_tick<now_tick-coalesce((def->>'resetTicks')::integer,reset_ticks)) or f.last_tick<now_tick-3*coalesce((def->>'resetTicks')::integer,reset_ticks) then
    perform eldervale_private.boss_reset(f.actor_id,true);continue;
   end if;
   -- Due telegraphs.
   select coalesce(jsonb_agg(v) filter (where (v->>'at')::bigint<=now_tick),'[]'),coalesce(jsonb_agg(v) filter (where (v->>'at')::bigint>now_tick),'[]') into due,rest from jsonb_array_elements(f.telegraph) v;
   if jsonb_array_length(due)>0 then
    update eldervale_private.boss_fights set telegraph=rest where actor_id=f.actor_id;
    for q in select value from jsonb_array_elements(due) loop perform eldervale_private.boss_resolve(f.actor_id,q,t);end loop;
   end if;
   if f.flying_until is not null and f.flying_until<=now_tick then update eldervale_private.boss_fights set flying_until=null where actor_id=f.actor_id;end if;
   -- Phases.
   maxhp:=greatest(1,coalesce((a.data->>'hp')::integer,a.hp));
   np:=eldervale_private.boss_phase_at(def,a.hp*100.0/maxhp);
   if np>f.phase then
    update eldervale_private.boss_fights set phase=np,cursor=0,queue=queue||coalesce(def->'phases'->np->'onEnter','[]') where actor_id=f.actor_id;
    update eldervale_private.actor_mech set attack_tick=least(attack_tick,now_tick+1) where id=f.actor_id;
    perform eldervale_private.emit(jsonb_build_object('type','boss_phase','target',f.actor_id,'boss',f.boss,'phase',np,'name',def->'phases'->np->>'name','text',def->'phases'->np->>'text'));
   end if;
   -- Enrage (soft timer).
   if not f.enraged and jsonb_typeof(def->'enrage')='object' and now_tick-f.started_tick>=coalesce((def->'enrage'->>'afterTicks')::integer,300) then
    update eldervale_private.boss_fights set enraged=true where actor_id=f.actor_id;
    perform eldervale_private.emit(jsonb_build_object('type','boss_enrage','target',f.actor_id,'boss',f.boss,'text',def->'enrage'->>'text'));
   end if;
  exception when others then perform eldervale_private.mech_fault('boss tick',sqlerrm);
  end;
 end loop;
end $fn$;

-- ---------------------------------------------------------------- the kill (mech_kill)
create or replace function eldervale_private.boss_on_kill(actor_id text, killer uuid, t timestamptz, loot jsonb) returns void
language plpgsql set search_path to '' as $fn$
declare a eldervale_private.realm_actors;def jsonb;f eldervale_private.boss_fights;now_tick bigint:=eldervale_private.tick_no(t);ticks integer;who uuid;k record;rw jsonb;uniq jsonb;pname text;iname text;c jsonb;
begin
 select * into a from eldervale_private.realm_actors where id=actor_id;
 if a.id is null or not (a.data ? 'bossId') or not eldervale_private.boss_on() then return;end if;
 def:=eldervale_private.boss_def(a.data->>'bossId');if def is null then return;end if;
 c:=eldervale_private.boss_config();
 select * into f from eldervale_private.boss_fights where boss_fights.actor_id=boss_on_kill.actor_id;
 ticks:=(case when f.active and f.started_tick is not null then greatest(1,now_tick-f.started_tick)::integer end);
 for who in select distinct u from (select killer u union all select x::uuid from jsonb_object_keys(case when f.active then f.participants else '{}'::jsonb end) x) z where u is not null loop
  insert into eldervale_private.boss_kills(user_id,boss,kills,best_ticks,last_ticks,last_at) values(who,def->>'id',1,ticks,ticks,now())
   on conflict (user_id,boss) do update set kills=boss_kills.kills+1,best_ticks=(case when excluded.best_ticks is null then boss_kills.best_ticks else least(coalesce(boss_kills.best_ticks,excluded.best_ticks),excluded.best_ticks) end),last_ticks=excluded.last_ticks,last_at=now()
   returning kills,best_ticks into k;
  perform eldervale_private.emit(jsonb_build_object('type','boss_defeated','player',who,'target',actor_id,'boss',def->>'id','name',def->>'name','ticks',ticks,'kc',k.kills,'pb',k.best_ticks,'newPb',ticks is not null and k.best_ticks=ticks));
 end loop;
 uniq:=coalesce((select jsonb_agg(u->>'item') from jsonb_array_elements(coalesce(def->'uniques','[]')) u),'[]');
 for rw in select value from jsonb_array_elements(coalesce(loot,'[]')) loop
  if uniq ? (rw->>'item') then
   select character_name into pname from public.player_saves where user_id=killer;
   select data->>'name' into iname from eldervale_private.realm_catalog where id='item:'||(rw->>'item');
   insert into eldervale_private.boss_log(boss,user_id,kind,data) values(def->>'id',killer,'rare',jsonb_build_object('item',rw->>'item','kc',eldervale_private.boss_kc(killer,def->>'id')));
   if coalesce((c->'fight'->>'announce_rare')::boolean,true) then
    perform eldervale_private.emit(jsonb_build_object('type','boss_rare','player',killer,'boss',def->>'id','bossName',def->>'name','who',coalesce(pname,'An adventurer'),'item',rw->>'item','itemName',coalesce(iname,rw->>'item'),'kc',eldervale_private.boss_kc(killer,def->>'id')));
   end if;
  end if;
 end loop;
 insert into eldervale_private.boss_log(boss,user_id,kind,data) values(def->>'id',killer,'kill',jsonb_build_object('ticks',ticks,'participants',(case when f.active then f.participants end)));
 if coalesce((c->'fight'->>'chest')::boolean,true) then
  perform eldervale_private.emit(jsonb_build_object('type','boss_chest','player',killer,'target',actor_id,'boss',def->>'id','name',def->>'name','x',a.x,'z',a.z,'loot',coalesce(loot,'[]'),'ticks',ticks));
 end if;
 if jsonb_typeof(def->'respawnTicks')='number' then
  update eldervale_private.realm_actors set respawn_at=eldervale_private.tick_time(now_tick+greatest(5,(def->>'respawnTicks')::integer)) where id=actor_id;
 end if;
 perform eldervale_private.boss_reset(actor_id,false);
exception when others then
 perform eldervale_private.mech_fault('boss kill',sqlerrm);
end $fn$;

revoke all on function eldervale_private.boss_defaults(),eldervale_private.boss_config(),eldervale_private.boss_on(),eldervale_private.boss_def(text),
 eldervale_private.boss_tiles(text,integer,integer,integer,integer,integer,integer),eldervale_private.boss_breath_calc(text,boolean,boolean,jsonb),eldervale_private.boss_breath_mult(uuid,bigint),
 eldervale_private.boss_phase_at(jsonb,numeric),eldervale_private.boss_attack_ticks(jsonb,integer,boolean),eldervale_private.boss_kc(uuid,text),eldervale_private.boss_pb(uuid,text),
 eldervale_private.boss_start(text,jsonb,bigint),eldervale_private.boss_reset(text,boolean),eldervale_private.boss_summon(text,jsonb,jsonb),eldervale_private.boss_adds_alive(eldervale_private.boss_fights),
 eldervale_private.boss_gate(text,jsonb,integer,text,uuid,timestamptz),eldervale_private.boss_turn(text,uuid,timestamptz),
 eldervale_private.boss_resolve(text,jsonb,timestamptz),eldervale_private.boss_tick(timestamptz),eldervale_private.boss_on_kill(text,uuid,timestamptz,jsonb)
 from public,anon,authenticated;
commit;
