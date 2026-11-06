-- Eldervale combat & mechanics II, part 3: player commands, the per-request mechanics reply, the
-- Game console commands, and the hooks into the live functions (world_tick, realm_request, the
-- consume commands, attack style, combat XP, run energy, admin_console).
-- APPLY AFTER mechanics-ii-2-combat.sql. Idempotent: each hook is skipped when its new text is
-- already in the function; every anchor must match exactly once (scripts/mechanics-ii-db/
-- live-anchors.mjs prints the read-only check to run against live first).
-- Switch: mechanics_config.config.enabled (Game console > World > Combat & mechanics). Off = every
-- hook falls back to the previous code path (alternating turns, old energy, old aggression).
begin;
set local lock_timeout='5s';

-- ---------------------------------------------------------------- player commands
-- mech_prayer {id} | mech_prayers_off | mech_quick | mech_quick_set {ids} | mech_spec |
-- mech_drink {item} | mech_altar {target?} | mech_catalog
create or replace function eldervale_private.mech_command(uid uuid, command text, payload jsonb, request_id uuid) returns jsonb
language plpgsql security definer set search_path to '' as $fn$
declare c jsonb:=eldervale_private.mech_config();now_tick bigint:=eldervale_private.tick_no(clock_timestamp());pm eldervale_private.player_mech;s public.player_saves;p eldervale_private.realm_players;
 plevel integer;pts integer;pr jsonb;pid text;active text[];quick text[];x text;cat jsonb;item text;res jsonb:='{}';wkey text;
begin
 if not eldervale_private.mech_on() then raise exception 'These mechanics are switched off on this server.';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>4000 then raise exception 'Invalid command';end if;
 if request_id is not null then
  if exists(select 1 from eldervale_private.realm_requests q where q.user_id=uid and q.request_id=mech_command.request_id) then return jsonb_build_object('mechanicsResult',res);end if;
  insert into eldervale_private.realm_requests(user_id,request_id,result) values(uid,request_id,'{}');
 end if;
 pm:=eldervale_private.mech_player(uid);
 select * into s from public.player_saves where user_id=uid for update;
 select * into p from eldervale_private.realm_players where user_id=uid;
 if s.user_id is null or p.user_id is null then raise exception 'Session expired';end if;
 if s.game_flags ? 'deathRespawnAt' and command<>'mech_catalog' then raise exception 'You cannot do that right now.';end if;
 plevel:=eldervale_private.gear_level(s.skills,'prayer');pts:=coalesce(pm.prayer_points,plevel);
 if command='mech_prayer' then
  pid:=payload->>'id';select data into pr from eldervale_private.mech_rules where kind='prayer' and id=pid and enabled;
  if pr is null then raise exception 'Unknown prayer';end if;
  if pid=any(pm.prayers) then active:=array_remove(pm.prayers,pid);
  else
   if plevel<coalesce((pr->>'level')::integer,1) then raise exception 'You need Prayer level % to use %.',(pr->>'level')::integer,pr->>'name';end if;
   if pts<=0 then raise exception 'You have run out of prayer points. Recharge at an altar.';end if;
   active:=array(select a from unnest(pm.prayers) a where not exists(select 1 from eldervale_private.mech_rules r cross join jsonb_array_elements_text(coalesce(r.data->'groups','[]')) g
    where r.kind='prayer' and r.id=a and g.value in (select jsonb_array_elements_text(coalesce(pr->'groups','[]')))))||pid;
  end if;
  update eldervale_private.player_mech set prayers=active,prayer_points=pts,prayer_on_tick=(case when pid=any(active) then now_tick else prayer_on_tick end) where user_id=uid;
 elsif command='mech_prayers_off' then
  update eldervale_private.player_mech set prayers='{}',prayer_points=pts where user_id=uid;
 elsif command in ('mech_quick','mech_quick_set') then
  quick:=(case when command='mech_quick_set' then array(select jsonb_array_elements_text(case when jsonb_typeof(payload->'ids')='array' then payload->'ids' else '[]' end)) else pm.quick_prayers end);
  active:='{}';
  foreach x in array coalesce(quick,'{}') loop
   select data into pr from eldervale_private.mech_rules where kind='prayer' and id=x and enabled;
   if pr is null or plevel<coalesce((pr->>'level')::integer,1) then continue;end if;
   active:=array(select a from unnest(active) a where not exists(select 1 from eldervale_private.mech_rules r cross join jsonb_array_elements_text(coalesce(r.data->'groups','[]')) g
    where r.kind='prayer' and r.id=a and g.value in (select jsonb_array_elements_text(coalesce(pr->'groups','[]')))))||x;
  end loop;
  if command='mech_quick_set' then update eldervale_private.player_mech set quick_prayers=active where user_id=uid;
  elsif cardinality(pm.prayers)>0 then update eldervale_private.player_mech set prayers='{}',prayer_points=pts where user_id=uid;
  else
   if cardinality(active)=0 then raise exception 'Choose your quick prayers first (Prayer tab).';end if;
   if pts<=0 then raise exception 'You have run out of prayer points. Recharge at an altar.';end if;
   update eldervale_private.player_mech set prayers=active,prayer_points=pts,prayer_on_tick=now_tick where user_id=uid;
  end if;
 elsif command='mech_spec' then
  wkey:=coalesce(s.equipment->>'weapon','unarmed');
  if not pm.spec_armed and eldervale_private.mech_rule('special',array[wkey]) is null then raise exception 'This weapon has no special attack.';end if;
  update eldervale_private.player_mech set spec_armed=not spec_armed where user_id=uid;
 elsif command='mech_drink' then
  item:=payload->>'item';select data into cat from eldervale_private.realm_catalog where id='item:'||item and not(data ? 'noteOf');
  if cat is null or coalesce(cat->>'category','')<>'Potions' or not(cat ? 'cure' or cat ? 'prayerRestore' or cat ? 'energy' or cat ? 'stamina') then raise exception 'You cannot drink that.';end if;
  if coalesce(eldervale_private.gear_int(s.stats->item),0)<1 then raise exception 'You have none left.';end if;
  if pm.drink_tick>now_tick then raise exception 'You are already drinking.';end if;
  perform eldervale_private.item_change(uid,item,-1);
  update eldervale_private.player_mech set drink_tick=now_tick+eldervale_private.mech_num(c,'food','drink_delay',3)::integer where user_id=uid;
  if cat ? 'cure' then
   if cat->>'cure'='poison' and pm.venom>0 then update eldervale_private.player_mech set venom=0,poison=6,poison_tick=now_tick+eldervale_private.mech_num(c,'poison','interval',30)::integer where user_id=uid;
   else update eldervale_private.player_mech set poison=0,venom=0,poison_tick=null,immune_until=now_tick+coalesce((cat->>'immunity')::integer,150) where user_id=uid;end if;
  end if;
  if coalesce((cat->>'prayerRestore')::boolean,false) then update eldervale_private.player_mech set prayer_points=least(plevel,pts+floor(7+0.25*plevel)::integer) where user_id=uid;end if;
  if cat ? 'energy' then update eldervale_private.realm_players set energy=least(100,energy+(cat->>'energy')::float8/100) where user_id=uid;end if;
  if cat ? 'stamina' then update eldervale_private.player_mech set stamina_until=now_tick+(cat->>'stamina')::integer where user_id=uid;end if;
  perform eldervale_private.emit(jsonb_build_object('type','eat','player',uid,'item',item,'drink',true));
 elsif command='mech_altar' then
  if not exists(select 1 from eldervale_private.realm_objects o where (o.kind='altar' or o.data->>'template'='altar') and coalesce((o.data->>'floor')::integer,0)=coalesce(p.floor,0) and sqrt(power(p.x-o.x,2)+power(p.z-o.z,2))<=4.5) then
   raise exception 'Stand beside an altar to pray.';end if;
  update eldervale_private.player_mech set prayer_points=plevel,prayer_counter=0 where user_id=uid;
  perform eldervale_private.emit(jsonb_build_object('type','notice','player',uid,'text',(case when pts<plevel then 'You kneel and recharge your prayer points.' else 'Your prayer points are already full.' end)));
 elsif command='mech_catalog' then null;
 else raise exception 'Unknown command';
 end if;
 return jsonb_build_object('mechanicsResult',res);
end $fn$;
revoke all on function eldervale_private.mech_command(uuid,text,jsonb,uuid) from public;

-- Small per-request block for the HUD (prayer, special bar, poison, weight, multi zone).
create or replace function eldervale_private.mech_reply(uid uuid, command text) returns jsonb
language plpgsql security definer set search_path to '' as $fn$
declare pm eldervale_private.player_mech;s public.player_saves;p eldervale_private.realm_players;h text;wt numeric;plevel integer;sp jsonb;wkey text;res jsonb;now_tick bigint:=eldervale_private.tick_no(clock_timestamp());
begin
 if uid is null then return '{}';end if;
 if not eldervale_private.mech_on() then return '{"mechanics":{"enabled":false}}';end if;
 pm:=eldervale_private.mech_player(uid);
 select * into s from public.player_saves where user_id=uid;select * into p from eldervale_private.realm_players where user_id=uid;
 if s.user_id is null then return '{}';end if;
 h:=md5(coalesce(s.stats::text,'')||coalesce(s.inventory::text,''));wt:=pm.weight;
 if h is distinct from pm.weight_hash then wt:=coalesce(eldervale_private.mech_weight(uid),0);update eldervale_private.player_mech set weight=wt,weight_hash=h where user_id=uid;end if;
 plevel:=eldervale_private.gear_level(s.skills,'prayer');wkey:=coalesce(s.equipment->>'weapon','unarmed');
 sp:=eldervale_private.mech_rule('special',array[wkey]);
 res:=jsonb_build_object('enabled',true,'tick',now_tick,'weight',wt,'style',(case when pm.defensive and p.attack_style='lunge' then 'block' else p.attack_style end),
  'prayer',jsonb_build_object('points',coalesce(pm.prayer_points,plevel),'max',plevel,'active',to_jsonb(pm.prayers),'quick',to_jsonb(pm.quick_prayers)),
  'spec',jsonb_build_object('energy',pm.spec,'armed',pm.spec_armed,'name',sp->>'name','cost',(sp->>'cost')::integer,'text',sp->>'text'),
  'poison',jsonb_build_object('severity',pm.poison,'venom',pm.venom,'immuneUntil',pm.immune_until),
  'multi',coalesce(eldervale_private.mech_multi(p.x,p.z,p.floor),false),
  'attackTick',pm.attack_tick,'eatTick',pm.eat_tick,'comboTick',pm.combo_tick,'drinkTick',pm.drink_tick,'staminaUntil',pm.stamina_until);
 if command='mech_catalog' then
  res:=res||jsonb_build_object('catalog',jsonb_build_object(
   'prayers',coalesce((select jsonb_agg(r.data||jsonb_build_object('id',r.id) order by r.sort,r.id) from eldervale_private.mech_rules r where r.kind='prayer' and r.enabled),'[]'),
   'specials',coalesce((select jsonb_object_agg(r.id,r.data) from eldervale_private.mech_rules r where r.kind='special' and r.enabled),'{}'),
   'run',eldervale_private.mech_config()->'run'));
 end if;
 return jsonb_build_object('mechanics',res);
exception when others then
 perform eldervale_private.mech_fault('reply',sqlerrm);return '{}';
end $fn$;
revoke all on function eldervale_private.mech_reply(uuid,text) from public;

-- ---------------------------------------------------------------- Game console
create or replace function eldervale_private.mech_validate_rule(k text, d jsonb) returns void
language plpgsql stable set search_path to '' as $fn$
declare r jsonb;total integer:=0;e record;
begin
 if jsonb_typeof(d)<>'object' or pg_column_size(d)>20000 then raise exception 'Rule data must be an object (at most 20 kB)';end if;
 if k='prayer' then
  if coalesce(d->>'name','')='' or length(d->>'name')>40 then raise exception 'A prayer needs a name (at most 40 letters)';end if;
  if coalesce(eldervale_private.gear_int(d->'level'),0) not between 1 and 99 then raise exception 'Prayer level is 1-99';end if;
  if coalesce(eldervale_private.gear_int(d->'drain'),-1) not between 0 and 100 then raise exception 'Drain is 0-100';end if;
  if d ? 'protect' and d->>'protect' not in ('melee','ranged','magic') then raise exception 'protect is melee, ranged or magic';end if;
  if d ? 'groups' and jsonb_typeof(d->'groups')<>'array' then raise exception 'groups must be a list';end if;
  if d ? 'effect' then
   if jsonb_typeof(d->'effect')<>'object' then raise exception 'effect must be an object';end if;
   for e in select key,value from jsonb_each(d->'effect') loop
    if e.key not in ('att','str','def','ranged','magic','heal') or jsonb_typeof(e.value)<>'number' or (e.value#>>'{}')::numeric not between 1 and 3 then raise exception 'Effect % must be att/str/def/ranged/magic/heal with a multiplier 1-3',e.key;end if;
   end loop;
  end if;
 elsif k='special' then
  if coalesce(d->>'name','')='' then raise exception 'A special needs a name';end if;
  if coalesce(eldervale_private.gear_int(d->'cost'),0) not between 1 and 100 then raise exception 'Special cost is 1-100 %%';end if;
  if coalesce((d->>'accMult')::numeric,1) not between 0.1 and 5 or coalesce((d->>'dmgMult')::numeric,1) not between 0.1 and 5 or coalesce(eldervale_private.gear_int(d->'hits'),1) not between 1 and 4 then raise exception 'Multipliers 0.1-5, hits 1-4';end if;
  if d ? 'effect' and d->>'effect' not in ('heal','drainDefence','bind') then raise exception 'effect is heal, drainDefence or bind';end if;
 elsif k='poison' then
  if not coalesce((d->>'venom')::boolean,false) and coalesce(eldervale_private.gear_int(d->'severity'),0) not between 1 and 100 then raise exception 'Poison severity is 1-100 (or venom: true)';end if;
  if coalesce((d->>'chance')::numeric,0.25) not between 0 and 1 then raise exception 'Chance is 0-1';end if;
 elsif k='aggro' then
  if d ? 'aggroMode' and d->>'aggroMode' not in ('level','always','never') then raise exception 'aggroMode is level, always or never';end if;
  for e in select key,value from jsonb_each(d) loop
   if e.key in ('huntRange','maxRange','attackRange') and (jsonb_typeof(e.value)<>'number' or (e.value#>>'{}')::numeric not between 0 and 64) then raise exception '% must be 0-64 tiles',e.key;end if;
   if e.key in ('toleranceTicks','respawnTicks','attackTicks') and jsonb_typeof(e.value)<>'null' and (jsonb_typeof(e.value)<>'number' or (e.value#>>'{}')::numeric not between 0 and 100000) then raise exception '% must be 0-100000 ticks (or null)',e.key;end if;
  end loop;
 elsif k='zone' then
  if jsonb_typeof(d->'x1')<>'number' or jsonb_typeof(d->'z1')<>'number' or jsonb_typeof(d->'x2')<>'number' or jsonb_typeof(d->'z2')<>'number' then raise exception 'A zone needs x1, z1, x2, z2';end if;
 elsif k in ('droptable','drops') then
  for r in select value from jsonb_array_elements(coalesce((case when k='droptable' then d->'rows' else d->'main'->'rows' end),'[]')) loop
   if coalesce(eldervale_private.gear_int(r->'weight'),-1)<0 then raise exception 'Every row needs a weight >= 0';end if;
   total:=total+(r->>'weight')::integer;
   if r ? 'table' then if not exists(select 1 from eldervale_private.mech_rules where kind='droptable' and id=r->>'table') then raise exception 'Unknown shared table %',r->>'table';end if;
   elsif not exists(select 1 from eldervale_private.realm_catalog where id='item:'||(r->>'item')) then raise exception 'Unknown item %',r->>'item';end if;
  end loop;
  if total>coalesce(eldervale_private.gear_int(case when k='droptable' then d->'denom' else d->'main'->'denom' end),128) then raise exception 'Row weights (%) exceed the denominator',total;end if;
  for r in select value from jsonb_array_elements(coalesce(d->'always','[]')||coalesce(d->'tertiary','[]')||coalesce(d->'preroll','[]')) loop
   if not exists(select 1 from eldervale_private.realm_catalog where id='item:'||(r->>'item')) then raise exception 'Unknown item %',r->>'item';end if;
  end loop;
 elsif k='item' then
  if d ? 'weight' and (jsonb_typeof(d->'weight')<>'number' or (d->>'weight')::numeric not between -10 and 100) then raise exception 'Weight is -10 to 100 kg';end if;
  if d ? 'foodClass' and d->>'foodClass' not in ('normal','combo') then raise exception 'foodClass is normal or combo';end if;
 else raise exception 'Unknown rule kind';
 end if;
end $fn$;

create or replace function eldervale_private.mech_console(command text, payload jsonb) returns jsonb
language plpgsql security definer set search_path to '' as $fn$
declare cfg jsonb;stored jsonb;patch jsonb;k text;v jsonb;sk text;sv jsonb;defs jsonb:=eldervale_private.mech_defaults();rk text;rid text;before_row jsonb;res jsonb;a eldervale_private.realm_actors;n integer;i integer;rw jsonb;counts jsonb:='{}';uid uuid;
begin
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 select config into stored from eldervale_private.mechanics_config where id;stored:=coalesce(stored,'{}');
 if command='console_mech' then
  return jsonb_build_object('config',eldervale_private.mech_config(),'defaults',defs,'stored',stored,'state',(select state from eldervale_private.mechanics_config where id),
   'rules',coalesce((select jsonb_agg(jsonb_build_object('kind',kind,'id',id,'data',data,'enabled',enabled,'sort',sort) order by kind,sort,id) from eldervale_private.mech_rules),'[]'),
   'players',(select count(*) from eldervale_private.player_mech));
 elsif command='console_mech_set' then
  patch:=coalesce(payload->'config',payload);
  if jsonb_typeof(patch)<>'object' then raise exception 'Send the settings to change';end if;
  for k,v in select key,value from jsonb_each(patch) loop
   if not(defs ? k) then raise exception 'Unknown setting %',k;end if;
   if k='enabled' then if jsonb_typeof(v)<>'boolean' then raise exception 'enabled must be on or off';end if;stored:=stored||jsonb_build_object(k,v);continue;end if;
   if jsonb_typeof(v)<>'object' then raise exception '% must be an object',k;end if;
   for sk,sv in select key,value from jsonb_each(v) loop
    if not(defs->k ? sk) then raise exception 'Unknown setting %.%',k,sk;end if;
    if jsonb_typeof(defs->k->sk)='boolean' then if jsonb_typeof(sv)<>'boolean' then raise exception '%.% must be on or off',k,sk;end if;
    elsif jsonb_typeof(sv)<>'number' or (sv#>>'{}')::numeric<0 or (sv#>>'{}')::numeric>100000 then raise exception '%.% must be a number 0-100000',k,sk;end if;
   end loop;
   stored:=stored||jsonb_build_object(k,coalesce(stored->k,'{}')||v);
  end loop;
  update eldervale_private.mechanics_config set config=stored,updated_at=now() where id;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,'mechanics_config',null,patch);
  return jsonb_build_object('config',eldervale_private.mech_config());
 elsif command='console_mech_reset' then
  k:=payload->>'section';
  stored:=(case when k is null then '{}'::jsonb else stored-k end);
  update eldervale_private.mechanics_config set config=stored,updated_at=now() where id;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,'mechanics_config',null,payload);
  return jsonb_build_object('config',eldervale_private.mech_config());
 elsif command='console_mech_rule_set' then
  rk:=payload->>'kind';rid:=payload->>'id';
  if rid is null or rid !~ '^[A-Za-z0-9_:*.\- ]{1,80}$' then raise exception 'Rule id: letters, digits and _ : * . - (at most 80)';end if;
  perform eldervale_private.mech_validate_rule(rk,payload->'data');
  select to_jsonb(r) into before_row from eldervale_private.mech_rules r where kind=rk and id=rid;
  insert into eldervale_private.mech_rules(kind,id,data,enabled,sort) values(rk,rid,payload->'data',coalesce((payload->>'enabled')::boolean,true),coalesce((payload->>'sort')::integer,0))
   on conflict (kind,id) do update set data=excluded.data,enabled=coalesce((payload->>'enabled')::boolean,mech_rules.enabled),sort=coalesce((payload->>'sort')::integer,mech_rules.sort),updated_at=now();
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,rk||':'||rid,before_row,payload);
  return jsonb_build_object('ok',true);
 elsif command='console_mech_rule_enable' then
  update eldervale_private.mech_rules set enabled=coalesce((payload->>'enabled')::boolean,false),updated_at=now() where kind=payload->>'kind' and id=payload->>'id';
  if not found then raise exception 'Rule not found';end if;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,(payload->>'kind')||':'||(payload->>'id'),null,payload);
  return jsonb_build_object('ok',true);
 elsif command='console_mech_monsters' then
  return jsonb_build_object('monsters',coalesce((select jsonb_agg(x order by (x->>'level')::integer,x->>'name') from (
   select jsonb_build_object('key',coalesce(nullif(m.data->>'rosterKey',''),m.id),'id',m.id,'name',m.data->>'name','level',coalesce(eldervale_private.gear_int(m.data->'level'),1),
    'hostile',coalesce((m.data->>'hostile')::boolean,false),'boss',coalesce((m.data->>'boss')::boolean,false),'species',m.data->>'species','attackType',m.data->>'attackType','count',m.n,
    'mech',eldervale_private.mech_monster(m.id,m.data),'drops',eldervale_private.mech_monster_drops(m.id,m.data),
    'hasDropsRule',exists(select 1 from eldervale_private.mech_rules r where r.kind='drops' and r.id=any(eldervale_private.mech_monster_keys(m.id,m.data)) and r.enabled)) x
   from (select distinct on (coalesce(nullif(data->>'rosterKey',''),id)) id,data,count(*) over (partition by coalesce(nullif(data->>'rosterKey',''),id)) n
    from eldervale_private.realm_actors where not deleted and data->>'kind'='monster' and (coalesce(payload->>'q','')='' or data->>'name' ilike '%'||(payload->>'q')||'%')
    order by coalesce(nullif(data->>'rosterKey',''),id),id) m limit 400) y),'[]'));
 elsif command='console_mech_drops_convert' then
  select * into a from eldervale_private.realm_actors where id=payload->>'actor' or data->>'rosterKey'=payload->>'actor' limit 1;
  if a.id is null then raise exception 'Monster not found';end if;
  rid:=coalesce(nullif(a.data->>'rosterKey',''),a.id);res:=eldervale_private.mech_monster_drops(a.id,a.data)-'migrated';
  insert into eldervale_private.mech_rules(kind,id,data) values('drops',rid,res) on conflict (kind,id) do nothing;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,'drops:'||rid,null,res);
  return jsonb_build_object('id',rid,'drops',(select data from eldervale_private.mech_rules where kind='drops' and id=rid));
 elsif command='console_mech_drops_test' then
  select * into a from eldervale_private.realm_actors where id=payload->>'actor' or data->>'rosterKey'=payload->>'actor' limit 1;
  if a.id is null then raise exception 'Monster not found';end if;
  n:=least(20000,greatest(1,coalesce((payload->>'kills')::integer,1000)));res:=eldervale_private.mech_monster_drops(a.id,a.data);
  for i in 1..n loop
   rw:=eldervale_private.mech_pick(res->'main',1);
   k:=coalesce(rw->>'item','(nothing)');counts:=counts||jsonb_build_object(k,coalesce((counts->>k)::integer,0)+1);
  end loop;
  return jsonb_build_object('kills',n,'main',counts,'drops',res);
 elsif command='console_mech_player' then
  uid:=(payload->>'userId')::uuid;
  return jsonb_build_object('mech',(select to_jsonb(pm) from eldervale_private.player_mech pm where user_id=uid),'energy',(select energy from eldervale_private.realm_players where user_id=uid),
   'kills',coalesce((select jsonb_object_agg(monster,kills) from eldervale_private.kill_counts where user_id=uid),'{}'));
 elsif command='console_mech_player_set' then
  uid:=(payload->>'userId')::uuid;perform eldervale_private.mech_player(uid);
  update eldervale_private.player_mech set prayer_points=(case when coalesce((payload->>'prayer')::boolean,false) then null else prayer_points end),
   spec=(case when coalesce((payload->>'spec')::boolean,false) then 1000 else spec end),
   poison=(case when coalesce((payload->>'cure')::boolean,false) then 0 else poison end),venom=(case when coalesce((payload->>'cure')::boolean,false) then 0 else venom end),
   tol=(case when coalesce((payload->>'tolerance')::boolean,false) then null else tol end) where user_id=uid;
  if coalesce((payload->>'energy')::boolean,false) then update eldervale_private.realm_players set energy=100 where user_id=uid;end if;
  insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,uid::text,null,payload);
  return jsonb_build_object('ok',true);
 end if;
 raise exception 'Unknown console command';
end $fn$;
revoke all on function eldervale_private.mech_console(text,jsonb) from public;

-- ---------------------------------------------------------------- hooks into the live functions
do $patch$
declare fn text;old text;new text;body text;
begin
 for fn,old,new in select e->>0,e->>1,e->>2 from jsonb_array_elements($edits$[
  ["eldervale_private.world_tick()",
   "perform eldervale_private.skill_tick(t);",
   "perform eldervale_private.skill_tick(t);perform eldervale_private.mech_tick(t);"],
  ["eldervale_private.world_tick()",
   "   dist:=sqrt(power(a.x-target_player.x,2)+power(a.z-target_player.z,2));\n",
   "   dist:=sqrt(power(a.x-target_player.x,2)+power(a.z-target_player.z,2));\n   if eldervale_private.mech_on() then perform eldervale_private.mech_combat(a.id,a.target,dt,t);continue;end if;\n"],
  ["eldervale_private.world_tick()",
   "   if coalesce((a.data->>'hostile')::boolean,false) and eldervale_private.town_at(a.x,a.z) is null then select user_id into a.target",
   "   if eldervale_private.mech_on() then if a.data->>'kind'='monster' then a.target:=eldervale_private.mech_aggro_target(a.id,t);if a.target is not null then update eldervale_private.realm_actors set target=a.target,turn='enemy',phase='ready' where id=a.id;continue;end if;end if;\n   elsif coalesce((a.data->>'hostile')::boolean,false) and eldervale_private.town_at(a.x,a.z) is null then select user_id into a.target"],
  ["eldervale_private.world_tick()",
   "     elsif a.hp>0 and (a.target is null or a.target=p.user_id) then update eldervale_private.realm_actors set target=p.user_id,phase='ready',turn='player',due_at=t where id=sid and target is null;",
   "     elsif eldervale_private.mech_on() then if a.hp>0 then p.intent:=eldervale_private.mech_player_attack(p.user_id,sid,t,p.intent);else p.intent:=null;end if;p.path:='[]';\n     elsif a.hp>0 and (a.target is null or a.target=p.user_id) then update eldervale_private.realm_actors set target=p.user_id,phase='ready',turn='player',due_at=t where id=sid and target is null;"],
  ["eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)",
   "  if command='celebrate' then\n",
   "  if command like 'mech\\_%' then\n   r:=eldervale_private.realm_request_before_stories($1,'sync','{}',null,$5);\n   r:=r||eldervale_private.mech_command(auth.uid(),command,payload,request_id);\n  elsif command='celebrate' then\n"],
  ["eldervale_private.realm_request(uuid,text,jsonb,uuid,bigint)",
   " return r||jsonb_build_object('interior',",
   " return r||eldervale_private.mech_reply(auth.uid(),command)||jsonb_build_object('interior',"],
  ["eldervale_private.realm_request_social_base(uuid,text,jsonb,uuid,bigint)",
   "  if p.consume_at>now()-interval '1.75 seconds' then raise exception 'You are already eating.';end if;",
   "  if p.consume_at>now()-interval '1.75 seconds' and not eldervale_private.mech_on() then raise exception 'You are already eating.';end if;"],
  ["eldervale_private.realm_request_social_base(uuid,text,jsonb,uuid,bigint)",
   "then raise exception 'This item cannot be consumed';end if;\n  perform eldervale_private.item_change(auth.uid(),k,-1);",
   "then raise exception 'This item cannot be consumed';end if;\n  perform eldervale_private.mech_eat_gate(auth.uid(),k,c,p.consume_at);\n  perform eldervale_private.item_change(auth.uid(),k,-1);"],
  ["eldervale_private.realm_request_before_bank_notes(uuid,text,jsonb,uuid,bigint)",
   "if p.consume_at>clock_timestamp()-interval '1.75 seconds' then raise exception 'You are already eating.';end if;",
   "if p.consume_at>clock_timestamp()-interval '1.75 seconds' and not eldervale_private.mech_on() then raise exception 'You are already eating.';end if;perform eldervale_private.mech_eat_gate(auth.uid(),payload->>'item',r,p.consume_at);"],
  ["eldervale_private.realm_request_before_castle(uuid,text,jsonb,uuid,bigint)",
   "if payload->>'style' not in ('stab','slash','lunge') or not(payload?'style') then raise exception 'Invalid attack style';end if;update eldervale_private.realm_players set attack_style=payload->>'style' where user_id=auth.uid();",
   "if payload->>'style' not in ('stab','slash','lunge','block') or not(payload?'style') then raise exception 'Invalid attack style';end if;update eldervale_private.realm_players set attack_style=(case when payload->>'style'='block' then 'lunge' else payload->>'style' end) where user_id=auth.uid();perform eldervale_private.mech_set_defensive(auth.uid(),payload->>'style'='block');"],
  ["eldervale_private.combat_xp_unscaled(uuid,integer,text,jsonb)",
   "  when ranged then jsonb_build_object('rangedXP',4*d)\n",
   "  when ranged and style in ('lunge','block') then jsonb_build_object('rangedXP',2*d,'defenceXP',2*d)\n  when ranged then jsonb_build_object('rangedXP',4*d)\n  when style='block' then jsonb_build_object('defenceXP',4*d)\n"],
  ["eldervale_private.advance_player_motion(uuid,timestamp with time zone)",
   "p.energy:=greatest(0,least(100,p.energy+case when riding then 0 else moved_time*case when p.run then -5 else 1.5 end+(dt-moved_time)*3 end))",
   "p.energy:=(case when eldervale_private.mech_on() then eldervale_private.mech_energy(player_id,p.energy,riding,(case when p.run then moved_time else 0 end),greatest(0,dt-(case when p.run then moved_time else 0 end))) else greatest(0,least(100,p.energy+case when riding then 0 else moved_time*case when p.run then -5 else 1.5 end+(dt-moved_time)*3 end)) end)"],
  ["eldervale_private.advance_player_tiles(uuid,timestamp with time zone)",
   "p.energy:=greatest(0,least(100,p.energy+(case when riding then 0 when moved and steps>1 then -3 when moved then .9 else 1.8 end)))",
   "p.energy:=(case when eldervale_private.mech_on() then eldervale_private.mech_energy(player_id,p.energy,riding,(case when moved and steps>1 then 0.6 else 0 end),(case when moved and steps>1 then 0 else 0.6 end)) else greatest(0,least(100,p.energy+(case when riding then 0 when moved and steps>1 then -3 when moved then .9 else 1.8 end))) end)"],
  ["eldervale_private.admin_console(text,jsonb)",
   " if command='console_give_xp' then",
   " if command like 'console\\_mech%' then return eldervale_private.mech_console(command,payload);end if;\n if command='console_give_xp' then"]
 ]$edits$::jsonb) e loop
  body:=pg_get_functiondef(fn::regprocedure);
  if position(new in body)>0 then continue;end if;
  perform eldervale_private.patch_function(fn::regprocedure,array[old,new]);
 end loop;
end $patch$;

commit;
