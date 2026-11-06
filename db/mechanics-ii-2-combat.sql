-- Eldervale combat & mechanics II, part 2: independent attack timers, hit delay and hitsplats on
-- landing, prayer drain/protection, special attacks, poison/venom, HP regen, aggression/tolerance/
-- leash, single/multi combat, eat/drink delays, arrow recovery, loot tables v2 and kill counts.
-- APPLY AFTER mechanics-ii-1-core.sql. Idempotent (create or replace only). Nothing calls these
-- until mechanics-ii-3-hooks.sql patches world_tick and the request handlers.
-- Pending hits are kept on the target row (player_mech.pending / actor_mech.pending) as
-- [{at,src,srcKind,dmg,style,...}] and applied at the start of the tick numbered `at`.
begin;
set local lock_timeout='5s';

create or replace function eldervale_private.mech_player(uid uuid) returns eldervale_private.player_mech
language plpgsql set search_path to '' as $fn$
declare r eldervale_private.player_mech;now_tick bigint:=eldervale_private.tick_no(clock_timestamp());
begin
 select * into r from eldervale_private.player_mech where user_id=uid;
 if not found then
  insert into eldervale_private.player_mech(user_id,last_tick,spec_tick,hp_tick) values(uid,now_tick,now_tick+50,now_tick+10) on conflict (user_id) do nothing;
  select * into r from eldervale_private.player_mech where user_id=uid;
 end if;
 return r;
end $fn$;

create or replace function eldervale_private.mech_fault(place text, message text) returns void
language plpgsql set search_path to '' as $fn$
begin
 raise warning 'mechanics % failed: %',place,message;
 update eldervale_private.mechanics_config set state=state||jsonb_build_object('faults',coalesce((state->>'faults')::integer,0)+1,'lastFault',left(place||': '||message,300),'lastFaultAt',clock_timestamp()) where id;
end $fn$;

-- ---------------------------------------------------------------- rolls (OSRS formulas, 10x HP)
-- The player's swing: prayer multipliers on the base level before the +8; special accuracy and
-- damage multipliers; a drained NPC Defence comes in through m (defenceLevel).
create or replace function eldervale_private.mech_player_roll(skills jsonb, equipment jsonb, stats jsonb, style text, w jsonb, m jsonb, fx jsonb, acc float8, dmg float8)
returns integer language plpgsql set search_path to '' as $fn$
declare b jsonb:=eldervale_private.gear_bonuses(equipment,stats);ms jsonb:=eldervale_private.monster_stats(m);kind text;lvl integer;eff integer;eff_str integer;att bigint;def bigint;hit integer;
 f_att float8:=coalesce((fx->>'att')::float8,1);f_str float8:=coalesce((fx->>'str')::float8,1);f_rng float8:=coalesce((fx->>'ranged')::float8,1);f_mag float8:=coalesce((fx->>'magic')::float8,1);
begin
 w:=coalesce(w,'{}');acc:=coalesce(acc,1);dmg:=coalesce(dmg,1);
 if coalesce((w->>'magic')::boolean,false) then
  lvl:=eldervale_private.gear_level(skills,'magic');eff:=floor(lvl*f_mag)::integer+9;att:=eff*(coalesce(eldervale_private.gear_int(b->'amagic'),0)+64);
  hit:=floor(eldervale_private.spell_max_hit(lvl,coalesce(w->>'spell','strike'))*(100+coalesce(eldervale_private.gear_int(b->'mdmg'),0))/100.0)::integer*10;
  def:=((ms->>'magicLevel')::integer+9)*((ms->'defence'->>'magic')::integer+64);
 elsif coalesce((w->>'ranged')::boolean,false) then
  lvl:=eldervale_private.gear_level(skills,'ranged');eff:=floor(lvl*f_rng)::integer+(case when style='stab' then 3 else 0 end)+8;
  att:=eff*(coalesce(eldervale_private.gear_int(b->'arange'),0)+64);hit:=eldervale_private.osrs_max_hit(eff,coalesce(eldervale_private.gear_int(b->'rstr'),0));
  def:=((ms->>'defenceLevel')::integer+9)*((ms->'defence'->>'ranged')::integer+64);
 else
  kind:=coalesce(w->'styles'->>(case when style='block' then 'lunge' else style end),'crush');
  eff:=floor(eldervale_private.gear_level(skills,'attack')*f_att)::integer+(case when style='stab' then 3 when style='lunge' then 1 else 0 end)+8;
  eff_str:=floor(eldervale_private.gear_level(skills,'strength')*f_str)::integer+(case when style='slash' then 3 when style='lunge' then 1 else 0 end)+8;
  att:=eff*(coalesce(eldervale_private.gear_int(b->('a'||kind)),0)+64);hit:=eldervale_private.osrs_max_hit(eff_str,coalesce(eldervale_private.gear_int(b->'str'),0));
  def:=((ms->>'defenceLevel')::integer+9)*((ms->'defence'->>kind)::integer+64);
 end if;
 att:=floor(att*acc)::bigint;hit:=floor(hit*dmg)::integer;
 if (ms->>'dummy')::boolean then return 1+floor(random()*greatest(1,hit))::integer;end if;
 if random()>=eldervale_private.osrs_hit_chance(att,def) then return 0;end if;
 return floor(random()*(hit+1))::integer;
end $fn$;

-- The NPC's swing on a player: Defensive +3, Controlled +1, Longrange +3; prayer multipliers;
-- magic defence 70% Magic + 30% Defence (each boosted) + style + 8.
create or replace function eldervale_private.mech_npc_roll(skills jsonb, equipment jsonb, style text, w jsonb, m jsonb, fx jsonb)
returns integer language plpgsql set search_path to '' as $fn$
declare ms jsonb:=eldervale_private.monster_stats(m);b jsonb;kind text;eff integer;att bigint;def bigint;sd integer:=eldervale_private.mech_style_def(style,w);
 f_def float8:=coalesce((fx->>'def')::float8,1);f_mag float8:=coalesce((fx->>'magic')::float8,1);
begin
 if (ms->>'dummy')::boolean or (ms->>'maxHit')::integer<=0 then return 0;end if;
 kind:=ms->>'attackStyle';b:=eldervale_private.gear_bonuses(equipment,'{}');
 if kind='magic' then eff:=floor(.7*floor(eldervale_private.gear_level(skills,'magic')*f_mag)+.3*floor(eldervale_private.gear_level(skills,'defence')*f_def))::integer+sd+8;
 else eff:=floor(eldervale_private.gear_level(skills,'defence')*f_def)::integer+sd+8;end if;
 def:=eff*(coalesce(eldervale_private.gear_int(b->('d'||(case when kind='ranged' then 'range' else kind end))),0)+64);
 att:=((ms->>'attackLevel')::integer+9)*((ms->>'attackBonus')::integer+64);
 if random()>=eldervale_private.osrs_hit_chance(att,def) then return 0;end if;
 return floor(random()*((ms->>'maxHit')::integer+1))::integer;
end $fn$;

create or replace function eldervale_private.mech_npc_kind(m jsonb) returns text language sql immutable set search_path to '' as $fn$
 select (case eldervale_private.monster_stats(m)->>'attackStyle' when 'ranged' then 'ranged' when 'magic' then 'magic' else 'melee' end)
$fn$;

-- ---------------------------------------------------------------- ground items and drops v2
create or replace function eldervale_private.mech_ground_drop(owner uuid, item text, n integer, x float8, z float8, fl integer) returns void
language plpgsql set search_path to '' as $fn$
declare c jsonb;g uuid;
begin
 if owner is null or item is null or coalesce(n,0)<1 then return;end if;
 select data into c from eldervale_private.realm_catalog where id='item:'||item;
 if c is null or c ? 'noteOf' then return;end if;
 if c ? 'field' then n:=1;end if;
 -- Stackables (arrows, coins) pile onto the owner's matching pile on the same spot.
 if coalesce((c->>'stackable')::boolean,false) then
  select id into g from eldervale_private.ground_drops where owner_id=owner and ground_drops.item=mech_ground_drop.item and coalesce(floor,0)=coalesce(fl,0) and abs(ground_drops.x-mech_ground_drop.x)<1.6 and abs(ground_drops.z-mech_ground_drop.z)<1.6 and expires_at>clock_timestamp()+interval '30 seconds' limit 1;
  if g is not null then update eldervale_private.ground_drops set amount=amount+n where id=g;return;end if;
 end if;
 if (select count(*) from eldervale_private.ground_drops where owner_id=owner)>=100 then return;end if;
 insert into eldervale_private.ground_drops(owner_id,item,amount,x,z,floor) values(owner,item,least(1000000,n),x+(random()-.5)*1.4,z+(random()-.5)*1.4,coalesce(fl,0));
end $fn$;

-- Old independent loot rows -> v2: always rows stay always; the rest become one weighted main
-- table on `denom` (weight = round(chance x denom), at least 1), re-normalised when the weights
-- pass denom (the largest row absorbs the rounding). Same as mechanics.js migrateLoot.
create or replace function eldervale_private.mech_loot_v2(loot jsonb, denom integer default 128) returns jsonb
language plpgsql immutable set search_path to '' as $fn$
declare l jsonb;lo integer;hi integer;wt integer;v_always jsonb:='[]';v_rows jsonb:='[]';total integer:=0;scaled jsonb:='[]';big integer:=0;bigw integer:=-1;k integer:=0;r jsonb;left_over integer;
begin
 for l in select value from jsonb_array_elements(case when jsonb_typeof(loot)='array' then loot else '[]' end) with ordinality e(value,o) where o<=8 loop
  if l->>'item' is null then continue;end if;
  lo:=greatest(1,coalesce(eldervale_private.gear_int(l->'min'),1));hi:=greatest(lo,coalesce(eldervale_private.gear_int(l->'max'),lo));
  if coalesce((l->>'always')::boolean,false) then v_always:=v_always||jsonb_build_array(jsonb_build_object('item',l->>'item','min',lo,'max',hi));
  else wt:=greatest(1,round(least(1,greatest(0,coalesce((l->>'chance')::float8,1)))*denom)::integer);v_rows:=v_rows||jsonb_build_array(jsonb_build_object('item',l->>'item','min',lo,'max',hi,'weight',wt));total:=total+wt;end if;
 end loop;
 if total>denom then
  left_over:=denom;
  for r in select value from jsonb_array_elements(v_rows) loop
   wt:=greatest(1,floor((r->>'weight')::integer*denom/total::numeric)::integer);left_over:=left_over-wt;
   if (r->>'weight')::integer>bigw then bigw:=(r->>'weight')::integer;big:=k;end if;
   scaled:=scaled||jsonb_build_array(r||jsonb_build_object('weight',wt));k:=k+1;
  end loop;
  if left_over<0 then scaled:=jsonb_set(scaled,array[big::text,'weight'],to_jsonb((scaled->big->>'weight')::integer+left_over));end if;
  v_rows:=scaled;
 end if;
 return jsonb_build_object('always',v_always,'main',jsonb_build_object('denom',denom,'rows',v_rows),'tertiary','[]'::jsonb,'migrated',true);
end $fn$;

-- The v2 table for one monster: a 'drops' rule wins; else the migrated loot, with an access row
-- into the shared rare table for monsters of level >= drops.rare_level (taken from "nothing").
create or replace function eldervale_private.mech_monster_drops(actor_id text, d jsonb) returns jsonb
language plpgsql stable set search_path to '' as $fn$
declare c jsonb:=eldervale_private.mech_config();r jsonb;denom integer;used integer;rare integer;
begin
 r:=eldervale_private.mech_rule('drops',eldervale_private.mech_monster_keys(actor_id,d));
 if r is not null then return r;end if;
 denom:=eldervale_private.mech_num(c,'drops','denom',128)::integer;
 r:=eldervale_private.mech_loot_v2(d->'loot',denom);
 rare:=eldervale_private.mech_num(c,'drops','rare_weight',1)::integer;
 if rare>0 and coalesce(eldervale_private.gear_int(d->'level'),1)>=eldervale_private.mech_num(c,'drops','rare_level',40) and exists(select 1 from eldervale_private.mech_rules where kind='droptable' and id='rare' and enabled) then
  select coalesce(sum((x->>'weight')::integer),0) into used from jsonb_array_elements(r->'main'->'rows') x;
  if used+rare<=denom then r:=jsonb_set(r,'{main,rows}',(r->'main'->'rows')||jsonb_build_array(jsonb_build_object('table','rare','weight',rare)));end if;
 end if;
 return r;
end $fn$;

create or replace function eldervale_private.mech_chance(v jsonb) returns float8 language sql immutable set search_path to '' as $fn$
 select least(1,greatest(0,(case when jsonb_typeof(v)='number' then (v#>>'{}')::float8
  when jsonb_typeof(v)='string' and (v#>>'{}') ~ '^\s*[0-9.]+\s*/\s*[0-9.]+\s*$' then split_part(v#>>'{}','/',1)::float8/nullif(split_part(v#>>'{}','/',2)::float8,0)
  else 0 end)))
$fn$;
-- One weighted roll (rate multiplier shrinks the roll space), following shared-table access rows.
create or replace function eldervale_private.mech_pick(tbl jsonb, mult float8) returns jsonb
language plpgsql volatile set search_path to '' as $fn$
declare roll float8;acc integer;rw jsonb;depth integer:=0;
begin
 loop
  roll:=floor(random()*coalesce((tbl->>'denom')::integer,128)/greatest(.0001,coalesce(mult,1)));acc:=0;rw:=null;
  for rw in select value from jsonb_array_elements(coalesce(tbl->'rows','[]')) loop
   acc:=acc+coalesce((rw->>'weight')::integer,0);
   exit when roll<acc;
   rw:=null;
  end loop;
  if rw is null then return null;end if;
  if rw ? 'table' then
   depth:=depth+1;if depth>3 then return null;end if;
   select data into tbl from eldervale_private.mech_rules where kind='droptable' and id=rw->>'table' and enabled;
   if tbl is null then return null;end if;mult:=1;continue;
  end if;
  return rw;
 end loop;
end $fn$;
create or replace function eldervale_private.mech_qty(rw jsonb) returns integer language sql volatile set search_path to '' as $fn$
 select lo+floor(random()*(greatest(lo,coalesce(eldervale_private.gear_int(rw->'max'),lo))-lo+1))::integer from (select greatest(1,coalesce(eldervale_private.gear_int(rw->'min'),1)) lo) x
$fn$;
create or replace function eldervale_private.mech_drop(actor_id text, killer uuid) returns jsonb
language plpgsql set search_path to '' as $fn$
declare a eldervale_private.realm_actors;d jsonb;rw jsonb;mult float8:=greatest(0,coalesce(eldervale_private.game_multiplier('dropRate'),1));got jsonb:='[]';replaced boolean:=false;fl integer;
begin
 select * into a from eldervale_private.realm_actors where id=actor_id;
 if a.id is null or killer is null then return got;end if;
 d:=eldervale_private.mech_monster_drops(actor_id,a.data);fl:=coalesce((a.data->>'floor')::integer,0);
 for rw in select value from jsonb_array_elements(coalesce(d->'always','[]')) loop got:=got||jsonb_build_array(jsonb_build_object('item',rw->>'item','n',eldervale_private.mech_qty(rw)));end loop;
 for rw in select value from jsonb_array_elements(coalesce(d->'preroll','[]')) loop
  if random()<eldervale_private.mech_chance(rw->'chance')*mult then got:=got||jsonb_build_array(jsonb_build_object('item',rw->>'item','n',eldervale_private.mech_qty(rw)));if coalesce((rw->>'replacesMain')::boolean,false) then replaced:=true;end if;end if;
 end loop;
 if not replaced and d ? 'main' then rw:=eldervale_private.mech_pick(d->'main',mult);if rw is not null and rw ? 'item' then got:=got||jsonb_build_array(jsonb_build_object('item',rw->>'item','n',eldervale_private.mech_qty(rw)));end if;end if;
 for rw in select value from jsonb_array_elements(coalesce(d->'tertiary','[]')) loop
  if random()<eldervale_private.mech_chance(rw->'chance')*mult then got:=got||jsonb_build_array(jsonb_build_object('item',rw->>'item','n',eldervale_private.mech_qty(rw)));end if;
 end loop;
 for rw in select value from jsonb_array_elements(got) loop
  begin perform eldervale_private.mech_ground_drop(killer,rw->>'item',(rw->>'n')::integer,a.x,a.z,fl);
  exception when others then raise warning 'Loot skipped for %: %',actor_id,sqlerrm;end;
 end loop;
 return got;
end $fn$;

-- ---------------------------------------------------------------- kills
create or replace function eldervale_private.mech_kill(actor_id text, killer uuid, t timestamptz) returns void
language plpgsql set search_path to '' as $fn$
declare a eldervale_private.realm_actors;mm jsonb;now_tick bigint:=eldervale_private.tick_no(t);
begin
 select * into a from eldervale_private.realm_actors where id=actor_id;if a.id is null then return;end if;
 mm:=eldervale_private.mech_monster(actor_id,a.data);
 update eldervale_private.realm_actors set target=null,phase='ready',hp=0,
  respawn_at=(case when jsonb_typeof(mm->'respawnTicks')='number' then eldervale_private.tick_time(now_tick+greatest(1,(mm->>'respawnTicks')::integer))
   when (data->>'respawn')::integer>0 then t+eldervale_private.engine_seconds((data->>'respawn')::float8)*interval '1 second' else null end) where id=actor_id;
 update eldervale_private.actor_mech set pending='[]',poison=0,venom=0,poison_tick=null,drain='{}',retreat=false,bound_until=0,last_hit_by=null,engaged_tick=null where id=actor_id;
 update eldervale_private.player_mech set last_hit_by=null where last_hit_by=actor_id;
 update eldervale_private.realm_players set intent=null where intent->>'target'=actor_id and intent->>'kind'='attack';
 if killer is not null then
  update public.player_saves set gold=least(1000000000,gold+coalesce(least(1000000,greatest(0,(a.data->>'goldReward')::integer)),case when coalesce((a.data->>'hostile')::boolean,false) then 8 else 2 end)),xp=xp+coalesce(least(100000,greatest(0,(a.data->>'xpReward')::integer)),30),stats=stats||jsonb_build_object('kills',coalesce((stats->>'kills')::integer,0)+1) where user_id=killer;
  update eldervale_private.realm_players set intent=null,path='[]' where user_id=killer;
  insert into eldervale_private.kill_counts(user_id,monster,kills) values(killer,coalesce(nullif(a.data->>'rosterKey',''),nullif(a.data->>'name',''),actor_id),1)
   on conflict (user_id,monster) do update set kills=kill_counts.kills+1,last_at=now();
  perform eldervale_private.mech_drop(actor_id,killer);
 end if;
 perform eldervale_private.emit(jsonb_build_object('type','death','target',actor_id,'player',killer));
end $fn$;

-- ---------------------------------------------------------------- applying a hit
-- target_kind 'player' (target_id = user id) or 'actor'. h: {src,srcKind,dmg,style,xpStyle,w,spec,poison,pierce}.
-- Protection prayers are checked here, when the hit lands (prayer flicking works).
create or replace function eldervale_private.mech_apply(target_kind text, target_id text, h jsonb, t timestamptz) returns void
language plpgsql set search_path to '' as $fn$
declare c jsonb:=eldervale_private.mech_config();now_tick bigint:=eldervale_private.tick_no(t);s public.player_saves;pm eldervale_private.player_mech;a eldervale_private.realm_actors;am eldervale_private.actor_mech;
 dmg integer:=greatest(0,coalesce((h->>'dmg')::integer,0));fx jsonb;style text:=coalesce(h->>'style','melee');uid uuid;award integer;pz jsonb;plevel integer;heal integer;left_hp integer;protected boolean:=false;spec jsonb:=h->'spec';
begin
 if target_kind='player' then
  uid:=target_id::uuid;
  select * into s from public.player_saves where user_id=uid for update;
  if s.user_id is null or s.game_flags ? 'deathRespawnAt' or s.health<=0 then return;end if;
  pm:=eldervale_private.mech_player(uid);
  if style<>'poison' then
   fx:=eldervale_private.mech_prayer_effects(pm.prayers);
   if fx->>'protect'=style and not coalesce((h->>'pierce')::boolean,false) then
    protected:=true;dmg:=floor(dmg*(100-(case when h->>'srcKind'='player' then eldervale_private.mech_num(c,'prayer','protect_pvp_pct',40) else eldervale_private.mech_num(c,'prayer','protect_npc_pct',100) end))/100.0)::integer;
   end if;
  end if;
  left_hp:=greatest(0,s.health-dmg);
  update public.player_saves set health=left_hp where user_id=uid;
  perform eldervale_private.emit(jsonb_build_object('type','hit','target',(case when h->>'srcKind'='npc' then h->>'src' end),'player',uid,'side','enemy','blocked',dmg<=0,'damage',dmg,'style',style,'protected',protected,'poison',style='poison'));
  if h->>'srcKind'='npc' then update eldervale_private.player_mech set last_hit_by=h->>'src',last_hit_tick=now_tick where user_id=uid;end if;
  -- Last Light (redemption-like): below 10% after the hit, heal a quarter of the Prayer level (x10 HP) and spend all prayer.
  if left_hp>0 and left_hp*10<s.max_health and coalesce((fx->>'redeem')::boolean,false) then
   plevel:=eldervale_private.gear_level(s.skills,'prayer');heal:=floor(plevel/4.0)::integer*10;
   update public.player_saves set health=least(max_health,health+heal) where user_id=uid;left_hp:=least(s.max_health,left_hp+heal);
   update eldervale_private.player_mech set prayers='{}',prayer_points=0,prayer_counter=0 where user_id=uid;
   perform eldervale_private.emit(jsonb_build_object('type','notice','player',uid,'text','Last Light flares: you are healed and your prayer is spent.'));
  end if;
  pz:=h->'poison';
  if dmg>0 and style<>'poison' and jsonb_typeof(pz)='object' and pm.immune_until<=now_tick and random()<coalesce((pz->>'chance')::float8,0.25) then
   if coalesce((pz->>'venom')::boolean,false) then
    if pm.venom=0 then update eldervale_private.player_mech set venom=1,poison=0,poison_tick=now_tick+eldervale_private.mech_num(c,'poison','interval',30)::integer where user_id=uid;
     perform eldervale_private.emit(jsonb_build_object('type','notice','player',uid,'text','You have been envenomed!'));end if;
   elsif pm.venom=0 and coalesce((pz->>'severity')::integer,0)>pm.poison then
    update eldervale_private.player_mech set poison=(pz->>'severity')::integer,poison_tick=(case when poison>0 and poison_tick is not null then poison_tick else now_tick+1 end) where user_id=uid;
    if pm.poison=0 then perform eldervale_private.emit(jsonb_build_object('type','notice','player',uid,'text','You have been poisoned!'));end if;
   end if;
  end if;
  if left_hp<=0 then perform eldervale_private.player_die(uid,t,coalesce(h->>'src',style));end if;
  return;
 end if;
 -- On an actor.
 select * into a from eldervale_private.realm_actors where id=target_id for update;
 if a.id is null or a.deleted or a.hp<=0 then return;end if;
 insert into eldervale_private.actor_mech(id) values(target_id) on conflict (id) do nothing;
 select * into am from eldervale_private.actor_mech where id=target_id;
 begin uid:=(h->>'src')::uuid;exception when others then uid:=null;end;
 if h->>'srcKind'='poison' then uid:=am.last_hit_by;end if;
 award:=least(dmg,a.hp);
 if h->>'srcKind'='player' and uid is not null then
  perform eldervale_private.combat_xp(uid,award,coalesce(h->>'xpStyle','slash'),coalesce(h->'w','{}'));
  if jsonb_typeof(spec)='object' and award>0 then
   if spec->>'effect'='heal' then update public.player_saves set health=least(max_health,health+floor(award*coalesce((spec->>'healPct')::numeric,50)/100)::integer) where user_id=uid;
   elsif spec->>'effect'='drainDefence' then update eldervale_private.actor_mech set drain=drain||jsonb_build_object('def',least(90,coalesce((drain->>'def')::integer,0)+coalesce((spec->>'drainPct')::integer,30))) where id=target_id;
   elsif spec->>'effect'='bind' then update eldervale_private.actor_mech set bound_until=now_tick+coalesce((spec->>'bindTicks')::integer,5) where id=target_id;
   end if;
  end if;
  pz:=h->'poison';
  if dmg>0 and jsonb_typeof(pz)='object' and am.venom=0 and random()<coalesce((pz->>'chance')::float8,0.125) and coalesce((pz->>'severity')::integer,0)>am.poison then
   update eldervale_private.actor_mech set poison=(pz->>'severity')::integer,poison_tick=coalesce(poison_tick,now_tick+1) where id=target_id;
  end if;
  update eldervale_private.actor_mech set last_hit_by=uid,last_hit_tick=now_tick where id=target_id;
  if a.target is null then update eldervale_private.realm_actors set target=uid,phase='ready',turn='enemy' where id=target_id;end if;
 end if;
 update eldervale_private.realm_actors set hp=greatest(0,hp-dmg) where id=target_id;
 perform eldervale_private.emit(jsonb_build_object('type','hit','target',target_id,'player',uid,'side','player','blocked',dmg<=0,'damage',dmg,'style',style,'ranged',style in ('ranged','magic'),'poison',style='poison','special',spec->>'name'));
 if a.hp<=dmg then perform eldervale_private.mech_kill(target_id,uid,t);end if;
end $fn$;

-- ---------------------------------------------------------------- player attacks (player loop)
-- Called while the player's attack intent has the NPC in reach. Returns the intent (null = stop).
create or replace function eldervale_private.mech_player_attack(uid uuid, actor_id text, t timestamptz, intent jsonb) returns jsonb
language plpgsql set search_path to '' as $fn$
declare c jsonb:=eldervale_private.mech_config();now_tick bigint:=eldervale_private.tick_no(t);p eldervale_private.realm_players;s public.player_saves;a eldervale_private.realm_actors;am eldervale_private.actor_mech;pm eldervale_private.player_mech;
 mm jsonb;w jsonb;wkey text;spec jsonb;fx jsonb;m jsonb;hits integer:=1;acc float8:=1;mult float8:=1;kind text;delay integer;d integer;pend jsonb:='[]';dmg integer;stats jsonb;arrow text;
 lock_ticks integer:=eldervale_private.mech_num(c,'combat','single_lock_ticks',8)::integer;spec_left integer;armed boolean;i integer;sd integer;
begin
 select * into p from eldervale_private.realm_players where user_id=uid;
 select * into a from eldervale_private.realm_actors where id=actor_id;
 if a.id is null or a.deleted or a.hp<=0 then return null;end if;
 select * into s from public.player_saves where user_id=uid;
 if s.user_id is null or s.game_flags ? 'deathRespawnAt' then return null;end if;
 pm:=eldervale_private.mech_player(uid);
 insert into eldervale_private.actor_mech(id) values(actor_id) on conflict (id) do nothing;
 select * into am from eldervale_private.actor_mech where id=actor_id;
 if not eldervale_private.mech_multi(p.x,p.z,p.floor) then
  if a.target is not null and a.target<>uid and exists(select 1 from eldervale_private.realm_players o where o.user_id=a.target and o.last_seen>t-interval '15 seconds') then
   perform eldervale_private.emit(jsonb_build_object('type','notice','player',uid,'text','Someone else is already fighting that.'));return null;end if;
  if pm.last_hit_by is not null and pm.last_hit_by<>actor_id and pm.last_hit_tick>now_tick-lock_ticks and exists(select 1 from eldervale_private.realm_actors x where x.id=pm.last_hit_by and x.target=uid and x.hp>0) then
   perform eldervale_private.emit(jsonb_build_object('type','notice','player',uid,'text','You are already under attack.'));return null;end if;
 end if;
 mm:=eldervale_private.mech_monster(actor_id,a.data);
 if a.target is null then
  update eldervale_private.realm_actors set target=uid,phase='ready',turn='player' where id=actor_id;
  -- Attacked from beyond its aggression range (max range + attack range from spawn): retreat mode.
  sd:=greatest(abs(eldervale_private.tile_of(p.x)-eldervale_private.tile_of((a.data->>'x')::float8)),abs(eldervale_private.tile_of(p.z)-eldervale_private.tile_of((a.data->>'z')::float8)));
  update eldervale_private.actor_mech set retreat=(sd>(mm->>'maxRange')::integer+(mm->>'attackRange')::integer) where id=actor_id;
 end if;
 update eldervale_private.actor_mech set engaged_tick=now_tick where id=actor_id;
 if pm.attack_tick>now_tick then return intent;end if;
 wkey:=coalesce(s.equipment->>'weapon','unarmed');
 select data into w from eldervale_private.realm_catalog where id='weapon:'||wkey;w:=coalesce(w,'{"damage":1,"attack":0,"speed":1.8}');
 kind:=(case when coalesce((w->>'magic')::boolean,false) then 'magic' when coalesce((w->>'ranged')::boolean,false) then 'ranged' else 'melee' end);
 stats:=s.stats;
 if kind='ranged' and eldervale_private.arrow_supply(stats,w)<1 then
  perform eldervale_private.emit(jsonb_build_object('type','notice','player',uid,'text','You are out of arrows. Outfitters sell them.'));return null;end if;
 spec_left:=pm.spec;armed:=pm.spec_armed;
 if armed then
  spec:=eldervale_private.mech_rule('special',array[wkey]);
  if spec is null then perform eldervale_private.emit(jsonb_build_object('type','notice','player',uid,'text','This weapon has no special attack.'));
  elsif pm.spec<coalesce((spec->>'cost')::integer,50)*10 then perform eldervale_private.emit(jsonb_build_object('type','notice','player',uid,'text','You do not have enough special attack energy.'));spec:=null;
  else spec_left:=pm.spec-coalesce((spec->>'cost')::integer,50)*10;hits:=greatest(1,least(4,coalesce((spec->>'hits')::integer,1)));acc:=coalesce((spec->>'accMult')::float8,1);mult:=coalesce((spec->>'dmgMult')::float8,1);end if;
  armed:=false;
 end if;
 fx:=eldervale_private.mech_prayer_effects(pm.prayers);
 m:=a.data;
 if coalesce((am.drain->>'def')::integer,0)>0 then m:=m||jsonb_build_object('defenceLevel',floor((eldervale_private.monster_stats(a.data)->>'defenceLevel')::integer*(100-(am.drain->>'def')::integer)/100.0)::integer);end if;
 d:=greatest(0,round(sqrt(power(p.x-a.x,2)+power(p.z-a.z,2))/eldervale_private.tile_size())::integer);
 delay:=eldervale_private.mech_hit_delay(kind,d,true);
 for i in 1..hits loop
  if kind='ranged' then
   arrow:=eldervale_private.best_arrow(stats,w);exit when arrow is null;stats:=eldervale_private.spend_arrow(stats,w);
   if random()<eldervale_private.mech_num(c,'ammo','recover_chance',0.8) then perform eldervale_private.mech_ground_drop(uid,arrow,1,a.x,a.z,coalesce((a.data->>'floor')::integer,0));end if;
  end if;
  dmg:=eldervale_private.mech_player_roll(s.skills,s.equipment,stats,p.attack_style,w,m,fx,acc,mult);
  pend:=pend||jsonb_build_array(jsonb_build_object('at',now_tick+delay,'src',uid,'srcKind','player','dmg',dmg,'style',kind,'xpStyle',p.attack_style,
   'w',jsonb_build_object('magic',coalesce((w->>'magic')::boolean,false),'ranged',coalesce((w->>'ranged')::boolean,false),'spellXp',w->'spellXp'),
   'spec',spec,'poison',eldervale_private.mech_rule('poison',array['weapon:'||wkey])));
 end loop;
 if kind='ranged' and stats is distinct from s.stats then update public.player_saves set stats=mech_player_attack.stats where user_id=uid;end if;
 update eldervale_private.actor_mech set pending=pending||pend where id=actor_id;
 update eldervale_private.player_mech set attack_tick=now_tick+eldervale_private.mech_weapon_ticks(wkey,w,p.attack_style),spec=spec_left,spec_armed=armed where user_id=uid;
 update eldervale_private.realm_players set yaw=atan2(a.x-p.x,a.z-p.z) where user_id=uid;
 perform eldervale_private.emit(jsonb_build_object('type','windup','side','player','target',actor_id,'player',uid,'attackType',a.data->>'attackType','style',p.attack_style,'ranged',kind<>'melee','special',spec->>'name','delay',delay));
 return intent;
exception when others then
 perform eldervale_private.mech_fault('player attack',sqlerrm);return intent;
end $fn$;

-- ---------------------------------------------------------------- NPC side (actor loop)
-- Called for an NPC with a player target (same floor, online, alive, outside towns). Handles the
-- leash/retreat, the chase, auto-retaliate + flinch and the NPC's own attack timer.
create or replace function eldervale_private.mech_combat(actor_id text, uid uuid, dt float8, t timestamptz) returns void
language plpgsql set search_path to '' as $fn$
declare c jsonb:=eldervale_private.mech_config();now_tick bigint:=eldervale_private.tick_no(t);a eldervale_private.realm_actors;am eldervale_private.actor_mech;p eldervale_private.realm_players;s public.player_saves;pm eldervale_private.player_mech;
 mm jsonb;w jsonb;wkey text;dist float8;reach float8;maxr integer;sd integer;d integer;kind text;dmg integer;delay integer;h jsonb;dx float8;dz float8;step float8;lx float8;lz float8;
 interest integer:=eldervale_private.mech_num(c,'combat','interest_ticks',16)::integer;
begin
 select * into a from eldervale_private.realm_actors where id=actor_id;
 select * into p from eldervale_private.realm_players where user_id=uid;
 select * into s from public.player_saves where user_id=uid;
 if a.id is null or p.user_id is null or s.user_id is null then return;end if;
 insert into eldervale_private.actor_mech(id) values(actor_id) on conflict (id) do nothing;
 select * into am from eldervale_private.actor_mech where id=actor_id;
 pm:=eldervale_private.mech_player(uid);
 mm:=eldervale_private.mech_monster(actor_id,a.data);maxr:=(mm->>'maxRange')::integer;
 sd:=greatest(abs(eldervale_private.tile_of(p.x)-eldervale_private.tile_of((a.data->>'x')::float8)),abs(eldervale_private.tile_of(p.z)-eldervale_private.tile_of((a.data->>'z')::float8)));
 dist:=sqrt(power(a.x-p.x,2)+power(a.z-p.z,2));d:=greatest(0,round(dist/eldervale_private.tile_size())::integer);
 -- Lost interest: the target left max range + 11 of the spawn, or nothing happened for a while out of reach.
 if sd>maxr+eldervale_private.mech_num(c,'aggro','retreat_extra',11)::integer or (am.engaged_tick is not null and am.engaged_tick<now_tick-interest*4) then
  update eldervale_private.realm_actors set target=null,phase='ready' where id=actor_id;
  update eldervale_private.actor_mech set retreat=false,engaged_tick=null where id=actor_id;return;
 end if;
 kind:=eldervale_private.mech_npc_kind(a.data);
 reach:=(case when (mm->>'attackRange')::integer<=1 then (case when eldervale_private.tile_mode() then 1.66 else 2.4 end) else (mm->>'attackRange')::integer*eldervale_private.tile_size()+.8 end);
 if (mm->>'retreatAtHpPct')::integer>0 and a.hp*100<(mm->>'retreatAtHpPct')::integer*coalesce((a.data->>'hp')::integer,a.hp) then
  update eldervale_private.actor_mech set retreat=true where id=actor_id;am.retreat:=true;
 end if;
 if dist>reach then
  if am.retreat or am.bound_until>now_tick or sd>maxr+1 then
   if coalesce(am.engaged_tick,now_tick)<now_tick-interest then
    update eldervale_private.realm_actors set target=null,phase='ready' where id=actor_id;update eldervale_private.actor_mech set retreat=false,engaged_tick=null where id=actor_id;
   end if;
   return;
  end if;
  if eldervale_private.tile_mode() then perform eldervale_private.actor_tile_chase(actor_id,p.x,p.z,false);
  else dx:=p.x-a.x;dz:=p.z-a.z;step:=least(dt*1.7,dist-2);
   if step>0 then lx:=a.x+dx/dist*step;lz:=a.z+dz/dist*step;
    if eldervale_private.can_step(a.x,a.z,lx,lz) then update eldervale_private.realm_actors set x=lx,z=lz,yaw=atan2(dx,dz) where id=actor_id;end if;
   end if;
  end if;
  return;
 end if;
 update eldervale_private.actor_mech set engaged_tick=now_tick where id=actor_id;
 wkey:=coalesce(s.equipment->>'weapon','unarmed');
 select data into w from eldervale_private.realm_catalog where id='weapon:'||wkey;w:=coalesce(w,'{"damage":1,"attack":0,"speed":1.8}');
 -- Auto-retaliate: an idle player fights back; a ready weapon flinches (waits half its speed).
 if coalesce((c->'combat'->>'auto_retaliate')::boolean,true) and p.intent is null and jsonb_array_length(coalesce(p.path,'[]'))=0 then
  update eldervale_private.realm_players set intent=jsonb_build_object('target',actor_id,'kind','attack') where user_id=uid;
  if coalesce((c->'combat'->>'flinch')::boolean,true) and pm.attack_tick<=now_tick then
   update eldervale_private.player_mech set attack_tick=now_tick+floor(eldervale_private.mech_weapon_ticks(wkey,w,p.attack_style)/2.0)::integer where user_id=uid;
  end if;
 end if;
 if am.attack_tick>now_tick or am.retreat then return;end if;
 dmg:=eldervale_private.mech_npc_roll(s.skills,s.equipment,p.attack_style,w,a.data,eldervale_private.mech_prayer_effects(pm.prayers));
 update eldervale_private.actor_mech set attack_tick=now_tick+(mm->>'attackTicks')::integer where id=actor_id;
 update eldervale_private.realm_actors set yaw=atan2(p.x-a.x,p.z-a.z) where id=actor_id;
 perform eldervale_private.emit(jsonb_build_object('type','windup','side','enemy','target',actor_id,'player',uid,'attackType',a.data->>'attackType','style',p.attack_style,'ranged',kind<>'melee'));
 delay:=eldervale_private.mech_hit_delay(kind,d,false);
 h:=jsonb_build_object('at',now_tick+delay,'src',actor_id,'srcKind','npc','dmg',dmg,'style',kind,'pierce',(mm->>'piercesProtection')::boolean,'poison',mm->'poison');
 if delay<=0 then perform eldervale_private.mech_apply('player',uid::text,h,t);
 else update eldervale_private.player_mech set pending=pending||jsonb_build_array(h) where user_id=uid;end if;
exception when others then
 perform eldervale_private.mech_fault('npc combat',sqlerrm);
end $fn$;

-- ---------------------------------------------------------------- aggression (actor loop, idle NPC)
create or replace function eldervale_private.mech_aggro_target(actor_id text, t timestamptz) returns uuid
language plpgsql set search_path to '' as $fn$
declare c jsonb:=eldervale_private.mech_config();now_tick bigint:=eldervale_private.tick_no(t);a eldervale_private.realm_actors;mm jsonb;who uuid;ai integer;aj integer;si integer;sj integer;hunt integer;agr integer;lvl integer;tol_ticks bigint;
 lock_ticks integer:=eldervale_private.mech_num(c,'combat','single_lock_ticks',8)::integer;
begin
 select * into a from eldervale_private.realm_actors where id=actor_id;
 if a.id is null or a.hp<=0 then return null;end if;
 mm:=eldervale_private.mech_monster(actor_id,a.data);
 if mm->>'aggroMode'='never' or eldervale_private.town_at(a.x,a.z) is not null then return null;end if;
 ai:=eldervale_private.tile_of(a.x);aj:=eldervale_private.tile_of(a.z);si:=eldervale_private.tile_of((a.data->>'x')::float8);sj:=eldervale_private.tile_of((a.data->>'z')::float8);
 hunt:=(mm->>'huntRange')::integer;agr:=(mm->>'maxRange')::integer+(mm->>'attackRange')::integer;lvl:=coalesce(eldervale_private.gear_int(a.data->'level'),1);
 tol_ticks:=(case when jsonb_typeof(mm->'toleranceTicks')='number' then (mm->>'toleranceTicks')::bigint end);
 select p.user_id into who from eldervale_private.realm_players p join public.player_saves s on s.user_id=p.user_id left join eldervale_private.player_mech pm on pm.user_id=p.user_id
 where p.floor=coalesce((a.data->>'floor')::integer,0) and p.last_seen>t-interval '15 seconds' and not(s.game_flags ? 'deathRespawnAt')
  and greatest(abs(eldervale_private.tile_of(p.x)-ai),abs(eldervale_private.tile_of(p.z)-aj))<=hunt
  and greatest(abs(eldervale_private.tile_of(p.x)-si),abs(eldervale_private.tile_of(p.z)-sj))<=agr
  and eldervale_private.mech_aggressive(coalesce(s.level,3),lvl,mm->>'aggroMode',c)
  and (tol_ticks is null or pm.tol is null or now_tick-coalesce((pm.tol->>'since')::bigint,now_tick)<tol_ticks)
  and eldervale_private.town_at(p.x,p.z) is null
  and (eldervale_private.mech_multi(p.x,p.z,p.floor) or ((pm.last_hit_tick is null or pm.last_hit_tick<=now_tick-lock_ticks)
   and not exists(select 1 from eldervale_private.realm_actors o where o.target=p.user_id and o.id<>actor_id and o.hp>0 and not o.deleted)))
 order by power(p.x-a.x,2)+power(p.z-a.z,2) limit 1;
 if who is not null then
  -- Tolerance square B: centred where the player met this aggressive area (once).
  update eldervale_private.player_mech set tol=tol||jsonb_build_object('bx',eldervale_private.tile_of((select x from eldervale_private.realm_players where user_id=who)),'bz',eldervale_private.tile_of((select z from eldervale_private.realm_players where user_id=who)),'b',true)
   where user_id=who and tol is not null and not coalesce((tol->>'b')::boolean,false);
  insert into eldervale_private.actor_mech(id,attack_tick,engaged_tick) values(actor_id,now_tick,now_tick) on conflict (id) do update set engaged_tick=now_tick,retreat=false;
 end if;
 return who;
exception when others then
 perform eldervale_private.mech_fault('aggression',sqlerrm);return null;
end $fn$;

-- ---------------------------------------------------------------- run energy
-- run_seconds: time spent running; rest_seconds: walking or standing. Percent in, percent out.
create or replace function eldervale_private.mech_energy(uid uuid, energy float8, riding boolean, run_seconds float8, rest_seconds float8) returns float8
language plpgsql set search_path to '' as $fn$
declare c jsonb:=eldervale_private.mech_config();pm eldervale_private.player_mech;agility integer;e float8:=coalesce(energy,100)*100;now_tick bigint:=eldervale_private.tick_no(clock_timestamp());
begin
 if coalesce(riding,false) then return energy;end if;
 pm:=eldervale_private.mech_player(uid);
 agility:=coalesce((select eldervale_private.gear_level(skills,'agility') from public.player_saves where user_id=uid),1);
 e:=e-eldervale_private.mech_run_drain(pm.weight,agility,pm.stamina_until>now_tick,c)*greatest(0,coalesce(run_seconds,0))/0.6
  +eldervale_private.mech_run_regen(agility,c)*greatest(0,coalesce(rest_seconds,0))/0.6;
 return greatest(0,least(100,e/100.0));
exception when others then
 perform eldervale_private.mech_fault('run energy',sqlerrm);return energy;
end $fn$;

-- ---------------------------------------------------------------- eating gate (consume commands)
create or replace function eldervale_private.mech_eat_gate(uid uuid, item text, c jsonb, consume_at timestamptz) returns void
language plpgsql set search_path to '' as $fn$
declare cfg jsonb;now_tick bigint;pm eldervale_private.player_mech;cls text;
begin
 if not eldervale_private.mech_on() then return;end if;
 cfg:=eldervale_private.mech_config();now_tick:=eldervale_private.tick_no(clock_timestamp());pm:=eldervale_private.mech_player(uid);
 cls:=coalesce((select r.data->>'foodClass' from eldervale_private.mech_rules r where r.kind='item' and r.id=item and r.enabled),c->>'foodClass','normal');
 if cls='combo' then
  if pm.combo_tick>now_tick then raise exception 'You are already eating.';end if;
  update eldervale_private.player_mech set combo_tick=now_tick+eldervale_private.mech_num(cfg,'food','combo_delay',3)::integer,
   attack_tick=(case when attack_tick>now_tick then attack_tick+eldervale_private.mech_num(cfg,'food','combo_attack_add',2)::integer else attack_tick end) where user_id=uid;
 else
  if pm.eat_tick>now_tick then raise exception 'You are already eating.';end if;
  update eldervale_private.player_mech set eat_tick=now_tick+eldervale_private.mech_num(cfg,'food','eat_delay',3)::integer,
   attack_tick=(case when attack_tick>now_tick then attack_tick+eldervale_private.mech_num(cfg,'food','eat_attack_add',3)::integer else attack_tick end) where user_id=uid;
 end if;
end $fn$;

-- ---------------------------------------------------------------- the per-tick timers
-- Runs once per world_tick before players and NPCs move: prayer drain, special energy, HP regen,
-- poison/venom, tolerance areas, death resets, then every pending hit that is due.
create or replace function eldervale_private.mech_tick(t timestamptz) returns void
language plpgsql set search_path to '' as $fn$
declare c jsonb;now_tick bigint;r record;n bigint;nd bigint;fx jsonb;pts integer;v_counter bigint;resist numeric;lost bigint;v_prayers text[];v_spec integer;st bigint;k bigint;v_hp integer;ht bigint;
 per bigint;hp_per bigint;poison_int integer;dmg integer;v_poison integer;v_venom integer;ptick bigint;v_tol jsonb;ti integer;tj integer;half integer;am record;due jsonb;rest jsonb;h jsonb;notice text;
begin
 if not eldervale_private.mech_on() then return;end if;
 c:=eldervale_private.mech_config();now_tick:=eldervale_private.tick_no(t);
 per:=eldervale_private.mech_num(c,'spec','regen_ticks',50)::bigint;hp_per:=eldervale_private.mech_num(c,'regen','hp_ticks',10)::bigint;poison_int:=eldervale_private.mech_num(c,'poison','interval',30)::integer;
 half:=floor(eldervale_private.mech_num(c,'aggro','tolerance_square',21)/2)::integer;
 insert into eldervale_private.player_mech(user_id,last_tick,spec_tick,hp_tick)
  select p.user_id,now_tick,now_tick+per,now_tick+hp_per from eldervale_private.realm_players p where p.last_seen>t-interval '15 seconds' on conflict (user_id) do nothing;
 for r in select pm.*,p.x,p.z,s.health,s.max_health,s.skills,s.equipment,(s.game_flags ? 'deathRespawnAt') dead
  from eldervale_private.player_mech pm join eldervale_private.realm_players p on p.user_id=pm.user_id join public.player_saves s on s.user_id=pm.user_id
  where p.last_seen>t-interval '15 seconds' and coalesce(pm.last_tick,0)<now_tick loop
  begin
   n:=least(500,now_tick-coalesce(r.last_tick,now_tick-1));notice:=null;
   if r.dead or r.health<=0 then
    update eldervale_private.player_mech set last_tick=now_tick,prayers='{}',prayer_points=null,prayer_counter=0,poison=0,venom=0,poison_tick=null,pending='[]',spec_armed=false,last_hit_by=null where user_id=r.user_id;
    continue;
   end if;
   -- Prayer drain: counter += sum(drain) per tick (not on the tick a prayer was switched on).
   pts:=coalesce(r.prayer_points,eldervale_private.gear_level(r.skills,'prayer'));v_counter:=r.prayer_counter;v_prayers:=r.prayers;
   if cardinality(v_prayers)>0 then
    fx:=eldervale_private.mech_prayer_effects(v_prayers);
    nd:=greatest(0,least(n,now_tick-greatest(coalesce(r.last_tick,now_tick-1),coalesce(r.prayer_on_tick,0))));
    resist:=eldervale_private.mech_num(c,'prayer','resist_base',60)+eldervale_private.mech_num(c,'prayer','resist_per_bonus',2)*coalesce(eldervale_private.gear_int(eldervale_private.gear_bonuses(r.equipment,'{}')->'prayer'),0);
    resist:=greatest(1,resist);v_counter:=v_counter+(fx->>'drain')::bigint*nd;lost:=floor(v_counter/resist)::bigint;v_counter:=v_counter-floor(lost*resist)::bigint;pts:=greatest(0,pts-lost)::integer;
    if pts<=0 then v_prayers:='{}';v_counter:=0;notice:='You have run out of prayer points. Recharge at an altar.';end if;
   else fx:=jsonb_build_object('heal',1);end if;
   -- Special attack energy: +10% every 50 ticks on a fixed per-player timer.
   st:=coalesce(r.spec_tick,now_tick+per);v_spec:=r.spec;
   if st<=now_tick then k:=1+(now_tick-st)/per;v_spec:=least(eldervale_private.mech_num(c,'spec','max',1000)::integer,v_spec+(k*eldervale_private.mech_num(c,'spec','regen_amount',100))::integer);st:=st+k*per;end if;
   -- Hitpoints: 1 (x10 scale: 1 per 10 ticks) per period; Swift Mending doubles it.
   ht:=coalesce(r.hp_tick,now_tick+hp_per);v_hp:=r.health;
   if ht<=now_tick then k:=1+(now_tick-ht)/hp_per;if v_hp<r.max_health then v_hp:=least(r.max_health,v_hp+(k*eldervale_private.mech_num(c,'regen','hp_amount',1)*coalesce((fx->>'heal')::numeric,1))::integer);end if;ht:=ht+k*hp_per;end if;
   -- Poison / venom: one hit per interval.
   v_poison:=r.poison;v_venom:=r.venom;ptick:=r.poison_tick;dmg:=0;
   if (v_poison>0 or v_venom>0) and ptick is not null and ptick<=now_tick then
    dmg:=10*(case when v_venom>0 then eldervale_private.mech_venom_damage(v_venom-1,c) else eldervale_private.mech_poison_damage(v_poison) end);
    if v_venom>0 then v_venom:=v_venom+1;else v_poison:=v_poison-1;end if;ptick:=(case when v_poison>0 or v_venom>0 then now_tick+poison_int end);
    v_hp:=greatest(0,v_hp-dmg);
   end if;
   -- Tolerance: two 21x21 squares; leaving both rebuilds A at the exit tile and resets the clock.
   ti:=eldervale_private.tile_of(r.x);tj:=eldervale_private.tile_of(r.z);v_tol:=r.tol;
   if v_tol is null or not((abs(ti-(v_tol->>'ax')::integer)<=half and abs(tj-(v_tol->>'az')::integer)<=half) or (abs(ti-(v_tol->>'bx')::integer)<=half and abs(tj-(v_tol->>'bz')::integer)<=half)) then
    v_tol:=jsonb_build_object('ax',ti,'az',tj,'bx',ti,'bz',tj,'since',now_tick,'b',false);
   end if;
   update eldervale_private.player_mech set last_tick=now_tick,prayer_points=pts,prayer_counter=v_counter,prayers=v_prayers,spec=v_spec,spec_tick=st,hp_tick=ht,
    poison=v_poison,venom=v_venom,poison_tick=ptick,tol=v_tol where user_id=r.user_id;
   if v_hp<>r.health then update public.player_saves set health=v_hp where user_id=r.user_id;end if;
   if dmg>0 then perform eldervale_private.emit(jsonb_build_object('type','hit','target',null,'player',r.user_id,'side','enemy','blocked',false,'damage',dmg,'style','poison','poison',true,'venom',v_venom>0));end if;
   if notice is not null then perform eldervale_private.emit(jsonb_build_object('type','notice','player',r.user_id,'text',notice));end if;
   if v_hp<=0 and r.health>0 then perform eldervale_private.player_die(r.user_id,t,(case when v_venom>0 then 'venom' else 'poison' end));end if;
  exception when others then perform eldervale_private.mech_fault('player timers',sqlerrm);
  end;
 end loop;
 -- NPC poison.
 for am in select * from eldervale_private.actor_mech where (poison>0 or venom>0) and poison_tick<=now_tick loop
  dmg:=10*(case when am.venom>0 then eldervale_private.mech_venom_damage(am.venom-1,c) else eldervale_private.mech_poison_damage(am.poison) end);
  update eldervale_private.actor_mech set poison=(case when venom>0 then 0 else greatest(0,poison-1) end),venom=(case when venom>0 then venom+1 else 0 end),
   poison_tick=(case when venom>0 or poison>1 then now_tick+poison_int end) where id=am.id;
  perform eldervale_private.mech_apply('actor',am.id,jsonb_build_object('srcKind','poison','dmg',dmg,'style','poison'),t);
 end loop;
 -- Pending hits: NPCs first, then players (OSRS processing order).
 for am in select id,pending from eldervale_private.actor_mech where pending<>'[]' loop
  select coalesce(jsonb_agg(e) filter (where (e->>'at')::bigint<=now_tick),'[]'),coalesce(jsonb_agg(e) filter (where (e->>'at')::bigint>now_tick),'[]') into due,rest from jsonb_array_elements(am.pending) e;
  update eldervale_private.actor_mech set pending=rest where id=am.id;
  for h in select value from jsonb_array_elements(due) loop
   begin perform eldervale_private.mech_apply('actor',am.id,h,t);exception when others then perform eldervale_private.mech_fault('hit on npc',sqlerrm);end;
  end loop;
 end loop;
 for am in select user_id,pending from eldervale_private.player_mech where pending<>'[]' loop
  select coalesce(jsonb_agg(e) filter (where (e->>'at')::bigint<=now_tick),'[]'),coalesce(jsonb_agg(e) filter (where (e->>'at')::bigint>now_tick),'[]') into due,rest from jsonb_array_elements(am.pending) e;
  update eldervale_private.player_mech set pending=rest where user_id=am.user_id;
  for h in select value from jsonb_array_elements(due) loop
   begin perform eldervale_private.mech_apply('player',am.user_id::text,h,t);exception when others then perform eldervale_private.mech_fault('hit on player',sqlerrm);end;
  end loop;
 end loop;
exception when others then
 perform eldervale_private.mech_fault('tick',sqlerrm);
end $fn$;

revoke all on function eldervale_private.mech_tick(timestamptz) from public;
revoke all on function eldervale_private.mech_apply(text,text,jsonb,timestamptz) from public;
revoke all on function eldervale_private.mech_kill(text,uuid,timestamptz) from public;
revoke all on function eldervale_private.mech_drop(text,uuid) from public;
revoke all on function eldervale_private.mech_player_attack(uuid,text,timestamptz,jsonb) from public;
revoke all on function eldervale_private.mech_combat(text,uuid,float8,timestamptz) from public;
revoke all on function eldervale_private.mech_aggro_target(text,timestamptz) from public;
revoke all on function eldervale_private.mech_energy(uuid,float8,boolean,float8,float8) from public;
revoke all on function eldervale_private.mech_eat_gate(uuid,text,jsonb,timestamptz) from public;

commit;
