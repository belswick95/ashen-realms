-- Eldervale combat & mechanics II, part 1: state tables, settings, rules (prayers, specials, poison,
-- aggression, combat zones, loot tables, item weights/food classes), the pure formulas and seeds.
-- docs/mechanics-spec.md §3–§8; mirrors mechanics.js. Idempotent; nothing in the running game
-- changes until part 3 hooks it in. APPLY ORDER: mechanics-ii-1-core.sql, mechanics-ii-2-combat.sql,
-- mechanics-ii-3-hooks.sql (after tick-tile-engine-1..5 and osrs-equipment-combat.sql).
-- Every timer is a 600 ms game tick number (eldervale_private.tick_no), so the rules behave the same
-- with tile_mode on (one world_tick per game tick) and off (world_tick every 0.15-1 s).
begin;
set local lock_timeout='5s';

create table if not exists eldervale_private.mechanics_config(
 id boolean primary key default true check(id),
 config jsonb not null default '{}',
 state jsonb not null default '{}',
 updated_at timestamptz not null default now());
insert into eldervale_private.mechanics_config(id) values(true) on conflict (id) do nothing;

-- One editable rule table for the Game console. kind: prayer | special | poison | aggro | zone |
-- droptable (shared sub-tables) | drops (per-monster v2 table) | item (weight, foodClass).
-- Monster rules match, in order: the actor id, its rosterKey, 'species:<species>',
-- 'type:<attackType>', 'boss' (bosses only), '*'. Weapon rules use the weapon key.
create table if not exists eldervale_private.mech_rules(
 kind text not null,
 id text not null,
 data jsonb not null default '{}',
 enabled boolean not null default true,
 sort integer not null default 0,
 updated_at timestamptz not null default now(),
 primary key(kind,id));

create table if not exists eldervale_private.player_mech(
 user_id uuid primary key,
 last_tick bigint,
 weight numeric not null default 0,
 weight_hash text,
 prayer_points integer,
 prayer_counter integer not null default 0,
 prayers text[] not null default '{}',
 quick_prayers text[] not null default '{}',
 prayer_on_tick bigint,
 spec integer not null default 1000,
 spec_tick bigint,
 spec_armed boolean not null default false,
 poison integer not null default 0,
 venom integer not null default 0,
 poison_tick bigint,
 immune_until bigint not null default 0,
 attack_tick bigint not null default 0,
 eat_tick bigint not null default 0,
 combo_tick bigint not null default 0,
 drink_tick bigint not null default 0,
 hp_tick bigint,
 stamina_until bigint not null default 0,
 last_hit_by text,
 last_hit_tick bigint,
 tol jsonb,
 defensive boolean not null default false,
 pending jsonb not null default '[]');

create table if not exists eldervale_private.actor_mech(
 id text primary key,
 attack_tick bigint not null default 0,
 poison integer not null default 0,
 venom integer not null default 0,
 poison_tick bigint,
 last_hit_by uuid,
 last_hit_tick bigint,
 engaged_tick bigint,
 retreat boolean not null default false,
 bound_until bigint not null default 0,
 drain jsonb not null default '{}',
 pending jsonb not null default '[]');

create table if not exists eldervale_private.kill_counts(
 user_id uuid not null,
 monster text not null,
 kills integer not null default 0,
 last_at timestamptz not null default now(),
 primary key(user_id,monster));

-- ---------------------------------------------------------------- settings
create or replace function eldervale_private.mech_defaults() returns jsonb language sql immutable set search_path to '' as $fn$
 select '{"enabled":true,
  "run":{"drain_base":60,"weight_factor":67,"weight_cap":64,"agility_drain_div":300,"regen_base":15,"agility_regen_div":10,"stamina_mult":0.3,"light_mult":1.3,"min_to_run":5},
  "combat":{"independent":true,"flinch":true,"auto_retaliate":true,"single_lock_ticks":8,"interest_ticks":16},
  "prayer":{"protect_npc_pct":100,"protect_pvp_pct":40,"resist_base":60,"resist_per_bonus":2},
  "spec":{"max":1000,"regen_amount":100,"regen_ticks":50},
  "poison":{"interval":30,"melee_chance":0.25,"ranged_chance":0.125,"venom_start":6,"venom_step":2,"venom_cap":20},
  "regen":{"hp_ticks":10,"hp_amount":1},
  "food":{"eat_delay":3,"combo_delay":3,"drink_delay":3,"eat_attack_add":3,"combo_attack_add":2},
  "ammo":{"recover_chance":0.8},
  "aggro":{"level_factor":2,"always_level":63,"hunt_range":4,"boss_hunt_range":8,"max_range":7,"tolerance_ticks":1000,"tolerance_square":21,"retreat_extra":11},
  "drops":{"denom":128,"rare_level":40,"rare_weight":1}}'::jsonb
$fn$;
create or replace function eldervale_private.mech_config() returns jsonb language sql stable set search_path to '' as $fn$
 select coalesce((select jsonb_object_agg(d.key,(case when jsonb_typeof(d.value)='object' and jsonb_typeof(c.config->d.key)='object' then d.value||(c.config->d.key) when c.config ? d.key and jsonb_typeof(d.value)<>'object' then c.config->d.key else d.value end))
  from jsonb_each(eldervale_private.mech_defaults()) d left join eldervale_private.mechanics_config c on c.id),eldervale_private.mech_defaults())
$fn$;
create or replace function eldervale_private.mech_on() returns boolean language sql stable set search_path to '' as $fn$
 select coalesce((select (config->>'enabled')::boolean from eldervale_private.mechanics_config where id),true)
$fn$;
create or replace function eldervale_private.mech_num(c jsonb, section text, k text, fallback numeric) returns numeric language sql immutable set search_path to '' as $fn$
 select coalesce((case when jsonb_typeof(c->section->k)='number' then (c->section->>k)::numeric end),fallback)
$fn$;

-- ---------------------------------------------------------------- rules
create or replace function eldervale_private.mech_rule(k text, ids text[]) returns jsonb language sql stable set search_path to '' as $fn$
 select r.data from eldervale_private.mech_rules r join unnest(ids) with ordinality u(rid,o) on u.rid=r.id
 where r.kind=k and r.enabled order by u.o limit 1
$fn$;
create or replace function eldervale_private.mech_monster_keys(actor_id text, d jsonb) returns text[] language sql immutable set search_path to '' as $fn$
 select array_remove(array[actor_id,nullif(d->>'rosterKey',''),'species:'||coalesce(d->>'species',''),'type:'||coalesce(d->>'attackType',''),
  (case when coalesce((d->>'boss')::boolean,false) then 'boss' end),'*'],null)
$fn$;
-- The mechanics block of one monster: defaults < its own data fields < an 'aggro' rule; plus its
-- 'poison' rule. Keys: aggroMode, huntRange, maxRange, toleranceTicks (null = never tolerant),
-- respawnTicks, attackTicks, attackRange, retreatAtHpPct, piercesProtection, multiOnly, poison.
create or replace function eldervale_private.mech_monster(actor_id text, d jsonb) returns jsonb language plpgsql stable set search_path to '' as $fn$
declare c jsonb:=eldervale_private.mech_config();keys text[]:=eldervale_private.mech_monster_keys(actor_id,d);boss boolean:=coalesce((d->>'boss')::boolean,false);
 r jsonb;res jsonb;speed float8;
begin
 speed:=coalesce((d->>'attackSpeed')::float8,2.4);
 res:=jsonb_build_object(
  'aggroMode',coalesce(d->>'aggroMode',(case when boss then 'always' when coalesce((d->>'hostile')::boolean,false) then 'level' else 'never' end)),
  'huntRange',coalesce((d->>'huntRange')::integer,(case when boss then eldervale_private.mech_num(c,'aggro','boss_hunt_range',8) else eldervale_private.mech_num(c,'aggro','hunt_range',4) end)::integer),
  'maxRange',coalesce((d->>'maxRange')::integer,eldervale_private.mech_num(c,'aggro','max_range',7)::integer),
  'toleranceTicks',(case when boss then 'null'::jsonb when d ? 'toleranceTicks' then d->'toleranceTicks' else to_jsonb(eldervale_private.mech_num(c,'aggro','tolerance_ticks',1000)::integer) end),
  'respawnTicks',d->'respawnTicks',
  'attackTicks',coalesce((d->>'attackTicks')::integer,greatest(1,round(speed/0.6))::integer),
  'attackRange',coalesce((d->>'attackRange')::integer,(case when d->>'attackType' in ('arrow','ranged','spit','magic','fire') then 6 else 1 end)),
  'retreatAtHpPct',coalesce((d->>'retreatAtHpPct')::integer,0),
  'piercesProtection',coalesce((d->>'piercesProtection')::boolean,false),
  'poison',d->'poison');
 r:=eldervale_private.mech_rule('aggro',keys);if r is not null then res:=res||r;end if;
 r:=eldervale_private.mech_rule('poison',keys);if r is not null then res:=res||jsonb_build_object('poison',r);end if;
 return res;
end $fn$;

-- ---------------------------------------------------------------- §3 run energy and weight
-- Energy is stored as a percent on realm_players.energy (0..100, as before); one OSRS energy unit
-- is 1/100 of a percent.
create or replace function eldervale_private.mech_run_drain(weight numeric, agility integer, stamina boolean, c jsonb) returns integer language sql immutable set search_path to '' as $fn$
 select (case when coalesce(stamina,false) then floor(eldervale_private.mech_num(c,'run','stamina_mult',0.3)*d) else d end)::integer
 from (select floor((eldervale_private.mech_num(c,'run','drain_base',60)+eldervale_private.mech_num(c,'run','weight_factor',67)
  *least(greatest(coalesce(weight,0),0),eldervale_private.mech_num(c,'run','weight_cap',64))/eldervale_private.mech_num(c,'run','weight_cap',64))
  *(1-least(99,greatest(1,coalesce(agility,1)))/eldervale_private.mech_num(c,'run','agility_drain_div',300))) d) x
$fn$;
create or replace function eldervale_private.mech_run_regen(agility integer, c jsonb) returns integer language sql immutable set search_path to '' as $fn$
 select (floor(least(99,greatest(1,coalesce(agility,1)))/eldervale_private.mech_num(c,'run','agility_regen_div',10))+eldervale_private.mech_num(c,'run','regen_base',15))::integer
$fn$;
-- Default item weights in kg (mechanics.js itemWeight): an explicit catalog weight wins.
create or replace function eldervale_private.mech_item_weight(item_id text, d jsonb) returns numeric language plpgsql immutable set search_path to '' as $fn$
declare k text:=lower(regexp_replace(coalesce(item_id,''),'^item:',''));s text;
begin
 d:=coalesce(d,'{}');
 if jsonb_typeof(d->'weight')='number' then return (d->>'weight')::numeric;end if;
 if k in ('gold','coins','coin') or k ~ '(arrows?|rune|arrowtips)$' or coalesce((d->>'stackable')::boolean,false) or k like 'note:%' or k like 'mount:%' then return 0;end if;
 if k like 'weapon:%' then
  k:=split_part(k,':',2);
  return (case when k like '%warhammer' then 3.6 when k like '%dagger' then 0.5 when k like '%scimitar' or k like '%longsword' then 1.8 when k like '%hammer' then 1.8
   when k like '%battleaxe' or k like '%waraxe' then 3 when k like '%twohand' or k like '%claymore' then 3.6 when k like '%spear' then 2.2 when k like '%scythe' then 3.2
   when k like '%sword' then 1.4 when k like '%bow' then 1.2 when k like '%staff' then 2.2 when k like '%pickaxe' then 2.3 when k like '%axe' then 1.4 else 1.8 end);
 end if;
 if k like 'shield:%' then return 5;end if;
 if k like 'jewelry:%' then return 0.01;end if;
 if k like 'armor:%' then
  s:=lower(coalesce(d->>'slot',k));
  return (case when s like '%body%' or s like '%chest%' or s like '%breastplate%' then 9 when s like '%legs%' or s like '%greaves%' then 7 when s like '%helm%' or s like '%head%' or s like '%armet%' then 1.5
   when s like '%feet%' or s like '%boots%' or s like '%sabatons%' then 1 when s like '%hands%' or s like '%gloves%' or s like '%gauntlets%' then 0.5 when s like '%cape%' then 0.4 when s like '%shoulder%' or s like '%pauldron%' then 2 else 2 end);
 end if;
 return (case d->>'category' when 'Food' then 0.4 when 'Potions' then 0.03 when 'Bars' then 1.8 when 'Ores' then 2.2 when 'Timber' then 2 when 'Tools' then 1 when 'Herbs' then 0.03
  when 'Seeds' then 0.01 when 'Runes' then 0 when 'Prayer' then 0.5 when 'Ingredients' then 0.3 when 'Materials' then 0.2 when 'Trade goods' then 0.5 else 0.5 end);
end $fn$;
-- Carried + worn weight (the bank does not count). Item rules (kind 'item') can set a weight.
create or replace function eldervale_private.mech_weight(uid uuid) returns numeric language sql stable set search_path to '' as $fn$
 select round((coalesce((select sum(coalesce((r.data->>'weight')::numeric,eldervale_private.mech_item_weight(c.id,c.data))*greatest(0,coalesce(eldervale_private.gear_int(s.stats->substring(c.id from 6)),0)))
   from eldervale_private.realm_catalog c left join eldervale_private.mech_rules r on r.kind='item' and r.id=substring(c.id from 6) and r.enabled
   where c.id like 'item:%' and not(c.data ? 'field') and c.id<>'item:gold' and s.stats ? substring(c.id from 6)),0)
  +coalesce((select sum(coalesce((r.data->>'weight')::numeric,eldervale_private.mech_item_weight(g.prefix||g.item,(select c.data from eldervale_private.realm_catalog c where c.id=g.prefix||g.item))))
   from (select (case f.key when 'weaponsOwned' then 'weapon:' when 'shieldsOwned' then 'shield:' when 'jewelryOwned' then 'jewelry:' when 'mountsOwned' then 'mount:' else 'armor:' end) prefix,v.value item
    from jsonb_each(s.inventory) f cross join lateral jsonb_array_elements_text(case when jsonb_typeof(f.value)='array' then f.value else '[]' end) v
    where f.key in('armorOwned','weaponsOwned','shieldsOwned','jewelryOwned','mountsOwned')) g
   left join eldervale_private.mech_rules r on r.kind='item' and r.id=g.prefix||g.item and r.enabled),0))::numeric,1)
 from public.player_saves s where s.user_id=uid
$fn$;

-- ---------------------------------------------------------------- §4 combat formulas
-- Hit delay in ticks (§4.3): melee 0, bows 1+floor((3+d)/6), thrown 1+floor(d/6), spells
-- 1+floor((1+d)/3); +1 for a player's hit on an NPC.
create or replace function eldervale_private.mech_hit_delay(kind text, d integer, vs_npc boolean) returns integer language sql immutable set search_path to '' as $fn$
 select (case kind when 'ranged' then 1+floor((3+greatest(0,d))/6.0) when 'thrown' then 1+floor(greatest(0,d)/6.0) when 'magic' then 1+floor((1+greatest(0,d))/3.0) else 0 end)::integer
  +(case when vs_npc then 1 else 0 end)
$fn$;
-- Weapon speed in OSRS ticks with the spec corrections: spear 4, warhammer 6, hammer 4.
create or replace function eldervale_private.mech_weapon_ticks(weapon_key text, w jsonb, style text) returns integer language sql immutable set search_path to '' as $fn$
 select greatest(1,(case when lower(coalesce(weapon_key,'')) like '%warhammer' then 6 when lower(coalesce(weapon_key,'')) like '%spear' then 4 when lower(coalesce(weapon_key,'')) like '%hammer' then 4
  else coalesce((w->>'ticks')::integer,round(coalesce((w->>'speed')::float8,1.8)/0.45)::integer) end)
  -(case when coalesce((w->>'ranged')::boolean,false) and not coalesce((w->>'magic')::boolean,false) and style='slash' then 1 else 0 end))
$fn$;
-- Defence style bonus: Defensive (block) +3, Controlled +1, Longrange with a bow +3.
create or replace function eldervale_private.mech_style_def(style text, w jsonb) returns integer language sql immutable set search_path to '' as $fn$
 select (case when style='block' then 3 when style='lunge' and coalesce((w->>'ranged')::boolean,false) and not coalesce((w->>'magic')::boolean,false) then 3
  when style='lunge' and not coalesce((w->>'magic')::boolean,false) then 1 else 0 end)
$fn$;
create or replace function eldervale_private.mech_poison_damage(severity integer) returns integer language sql immutable set search_path to '' as $fn$
 select floor(greatest(0,coalesce(severity,0))/5.0+0.8)::integer
$fn$;
create or replace function eldervale_private.mech_venom_damage(hits integer, c jsonb) returns integer language sql immutable set search_path to '' as $fn$
 select least(eldervale_private.mech_num(c,'poison','venom_cap',20),eldervale_private.mech_num(c,'poison','venom_start',6)+eldervale_private.mech_num(c,'poison','venom_step',2)*greatest(0,coalesce(hits,0)))::integer
$fn$;
-- §6 aggression: level rule (player combat <= 2 x NPC level, or NPC level >= 63), always, never.
create or replace function eldervale_private.mech_aggressive(player_combat integer, npc_level integer, mode text, c jsonb) returns boolean language sql immutable set search_path to '' as $fn$
 select (case coalesce(mode,'level') when 'never' then false when 'always' then true
  else npc_level>=eldervale_private.mech_num(c,'aggro','always_level',63) or player_combat<=eldervale_private.mech_num(c,'aggro','level_factor',2)*npc_level end)
$fn$;
-- Is (x,z) inside a multi-combat zone? Zones are 'zone' rules {x1,z1,x2,z2,floor,multi}.
create or replace function eldervale_private.mech_multi(x float8, z float8, fl integer) returns boolean language sql stable set search_path to '' as $fn$
 select exists(select 1 from eldervale_private.mech_rules r where r.kind='zone' and r.enabled and coalesce((r.data->>'multi')::boolean,true)
  and coalesce((r.data->>'floor')::integer,0)=coalesce(fl,0)
  and x between least((r.data->>'x1')::float8,(r.data->>'x2')::float8) and greatest((r.data->>'x1')::float8,(r.data->>'x2')::float8)
  and z between least((r.data->>'z1')::float8,(r.data->>'z2')::float8) and greatest((r.data->>'z1')::float8,(r.data->>'z2')::float8))
$fn$;
-- The player's combat style. realm_players.attack_style allows stab/slash/lunge only, so the
-- Defensive style is stored as lunge + player_mech.defensive (set by the attack_style command).
create or replace function eldervale_private.mech_style(uid uuid, attack_style text) returns text language sql stable set search_path to '' as $fn$
 select (case when attack_style='lunge' and coalesce((select defensive from eldervale_private.player_mech where user_id=uid),false) then 'block' else coalesce(attack_style,'slash') end)
$fn$;
create or replace function eldervale_private.mech_set_defensive(uid uuid, on_block boolean) returns void language sql set search_path to '' as $fn$
 insert into eldervale_private.player_mech(user_id,defensive) values(uid,coalesce(on_block,false)) on conflict (user_id) do update set defensive=coalesce(on_block,false)
$fn$;
-- Active prayer effects: multipliers {att,str,def,ranged,magic,heal}, protection style, drain sum.
create or replace function eldervale_private.mech_prayer_effects(active text[]) returns jsonb language sql stable set search_path to '' as $fn$
 select jsonb_build_object(
  'att',coalesce(max((r.data->'effect'->>'att')::float8),1),'str',coalesce(max((r.data->'effect'->>'str')::float8),1),
  'def',coalesce(max((r.data->'effect'->>'def')::float8),1),'ranged',coalesce(max((r.data->'effect'->>'ranged')::float8),1),
  'magic',coalesce(max((r.data->'effect'->>'magic')::float8),1),'heal',coalesce(max((r.data->'effect'->>'heal')::float8),1),
  'protect',max(r.data->>'protect'),'redeem',coalesce(bool_or((r.data->>'redeem')::boolean),false),'drain',coalesce(sum((r.data->>'drain')::integer),0))
 from eldervale_private.mech_rules r where r.kind='prayer' and r.enabled and r.id=any(coalesce(active,'{}'))
$fn$;

-- ---------------------------------------------------------------- seeds (original names)
insert into eldervale_private.mech_rules(kind,id,data,sort) values
 ('prayer','oakskin','{"name":"Oakskin","level":1,"drain":1,"groups":["defence"],"effect":{"def":1.05},"icon":"🌳","text":"+5% Defence."}',1),
 ('prayer','bearMight','{"name":"Bear''s Might","level":4,"drain":1,"groups":["strength"],"effect":{"str":1.05},"icon":"🐻","text":"+5% Strength."}',2),
 ('prayer','keenEye','{"name":"Keen Eye","level":7,"drain":1,"groups":["attack"],"effect":{"att":1.05},"icon":"👁","text":"+5% Attack."}',3),
 ('prayer','archerBreath','{"name":"Archer''s Breath","level":8,"drain":1,"groups":["attack","strength","ranged","magic"],"effect":{"ranged":1.05},"icon":"🏹","text":"+5% Ranged."}',4),
 ('prayer','sparkInsight','{"name":"Spark of Insight","level":9,"drain":1,"groups":["attack","strength","ranged","magic"],"effect":{"magic":1.05},"icon":"✨","text":"+5% Magic."}',5),
 ('prayer','ironbarkSkin','{"name":"Ironbark Skin","level":10,"drain":6,"groups":["defence"],"effect":{"def":1.1},"icon":"🪵","text":"+10% Defence."}',6),
 ('prayer','oxStrength','{"name":"Ox Strength","level":13,"drain":6,"groups":["strength"],"effect":{"str":1.1},"icon":"🐂","text":"+10% Strength."}',7),
 ('prayer','hawkFocus','{"name":"Hawk Focus","level":16,"drain":6,"groups":["attack"],"effect":{"att":1.1},"icon":"🦅","text":"+10% Attack."}',8),
 ('prayer','swiftMending','{"name":"Swift Mending","level":22,"drain":2,"groups":["heal"],"effect":{"heal":2},"icon":"💗","text":"Hitpoints regenerate twice as fast."}',9),
 ('prayer','fletcherCalm','{"name":"Fletcher''s Calm","level":26,"drain":6,"groups":["attack","strength","ranged","magic"],"effect":{"ranged":1.1},"icon":"🎯","text":"+10% Ranged."}',10),
 ('prayer','runewardMind','{"name":"Runeward Mind","level":27,"drain":6,"groups":["attack","strength","ranged","magic"],"effect":{"magic":1.1},"icon":"🔮","text":"+10% Magic."}',11),
 ('prayer','stoneheart','{"name":"Stoneheart","level":28,"drain":12,"groups":["defence"],"effect":{"def":1.15},"icon":"🪨","text":"+15% Defence."}',12),
 ('prayer','titanGrip','{"name":"Titan''s Grip","level":31,"drain":12,"groups":["strength"],"effect":{"str":1.15},"icon":"💪","text":"+15% Strength."}',13),
 ('prayer','eagleClarity','{"name":"Eagle Clarity","level":34,"drain":12,"groups":["attack"],"effect":{"att":1.15},"icon":"🦉","text":"+15% Attack."}',14),
 ('prayer','wardSorcery','{"name":"Ward of Sorcery","level":37,"drain":12,"groups":["protect"],"protect":"magic","icon":"🌀","text":"Blocks magic attacks from creatures (40% from players)."}',15),
 ('prayer','wardArrows','{"name":"Ward of Arrows","level":40,"drain":12,"groups":["protect"],"protect":"ranged","icon":"🛡","text":"Blocks ranged attacks from creatures (40% from players)."}',16),
 ('prayer','wardBlades','{"name":"Ward of Blades","level":43,"drain":12,"groups":["protect"],"protect":"melee","icon":"⚔","text":"Blocks melee attacks from creatures (40% from players)."}',17),
 ('prayer','windreader','{"name":"Windreader","level":44,"drain":12,"groups":["attack","strength","ranged","magic"],"effect":{"ranged":1.15},"icon":"🍃","text":"+15% Ranged."}',18),
 ('prayer','starlitMind','{"name":"Starlit Mind","level":45,"drain":12,"groups":["attack","strength","ranged","magic"],"effect":{"magic":1.15},"icon":"🌟","text":"+15% Magic."}',19),
 ('prayer','lastLight','{"name":"Last Light","level":49,"drain":6,"groups":["protect"],"redeem":true,"icon":"🕯","text":"Below 10% health: heals you by a quarter of your Prayer level and spends all prayer."}',20),
 ('prayer','paragonOath','{"name":"Paragon''s Oath","level":60,"drain":24,"groups":["attack","strength","defence","ranged","magic"],"effect":{"att":1.15,"str":1.18,"def":1.2},"icon":"👑","text":"+15% Attack, +18% Strength, +20% Defence."}',21),
 ('special','eldersteelDagger','{"name":"Twin Fangs","cost":25,"hits":2,"accMult":1.15,"dmgMult":1.15,"text":"Two quick stabs, each more accurate and harder."}',1),
 ('special','embersteelLongsword','{"name":"Cinder Cleave","cost":25,"dmgMult":1.25,"text":"A searing cut for 25% more damage."}',2),
 ('special','eldersteelSpear','{"name":"Pinning Thrust","cost":25,"accMult":1.5,"effect":"bind","bindTicks":5,"text":"A sure thrust that pins the target in place for 5 ticks."}',3),
 ('special','goldenSword','{"name":"Gilded Flourish","cost":50,"accMult":2,"dmgMult":1.1,"text":"A showy, near-certain strike."}',4),
 ('special','warhammer','{"name":"Bone Breaker","cost":50,"effect":"drainDefence","drainPct":30,"text":"On a hit, lowers the target''s Defence by 30%."}',5),
 ('special','scythe','{"name":"Harvest Moon","cost":50,"effect":"heal","healPct":50,"text":"Heals you for half the damage dealt."}',6),
 ('special','claymore','{"name":"Mountainfall","cost":60,"accMult":1.25,"dmgMult":1.375,"text":"A crushing overhead blow."}',7),
 ('special','bloodthornBow','{"name":"Thorn Volley","cost":55,"hits":2,"accMult":1.1,"text":"Looses two arrows at once."}',8),
 ('special','emberStaff','{"name":"Pyre Burst","cost":50,"accMult":1.5,"dmgMult":1.5,"text":"A roaring blast of flame."}',9),
 ('poison','type:venom','{"severity":6,"chance":0.25}',1),
 ('poison','type:sting','{"severity":4,"chance":0.2}',2),
 ('poison','weapon:bloodthornBow','{"severity":4,"chance":0.125}',3),
 ('aggro','boss','{"aggroMode":"always","huntRange":8,"toleranceTicks":null}',1),
 ('item','sundae','{"foodClass":"combo"}',1),
 ('droptable','rare','{"name":"Shared rare loot table","denom":128,"rows":[{"weight":8,"item":"uncutGem","min":1,"max":2},{"weight":4,"item":"cutGem","min":1,"max":1},{"weight":3,"item":"runiteBar","min":1,"max":1},{"weight":2,"item":"silverRing","min":1,"max":1},{"weight":2,"item":"embersteelArrows","min":5,"max":15},{"weight":1,"item":"wyrmBones","min":1,"max":1},{"weight":20,"item":"gold","min":200,"max":600}]}',1),
 ('droptable','gems','{"name":"Gem table","denom":128,"rows":[{"weight":32,"item":"uncutGem","min":1,"max":1},{"weight":8,"item":"cutGem","min":1,"max":1},{"weight":1,"table":"rare"}]}',2)
on conflict (kind,id) do nothing;

-- Potions (original names) in the shared catalog; the client lists them from profession-data.js.
insert into eldervale_private.realm_catalog(id,data) values
 ('item:antidote','{"name":"Mosswort antidote","buy":40,"sell":12,"icon":"supply","model":"potion","color":7915382,"category":"Potions","stackable":false,"profession":true,"cure":"poison","immunity":150,"description":"Cures poison and wards it off for 90 seconds."}'),
 ('item:serpentbaneTonic','{"name":"Serpentbane tonic","buy":180,"sell":54,"icon":"supply","model":"potion","color":3381555,"category":"Potions","stackable":false,"profession":true,"cure":"venom","immunity":600,"description":"Cures poison and venom; immunity for 6 minutes."}'),
 ('item:shrineDraught','{"name":"Shrine draught","buy":90,"sell":27,"icon":"supply","model":"potion","color":6737151,"category":"Potions","stackable":false,"profession":true,"prayerRestore":true,"description":"Restores 7 + a quarter of your Prayer level in prayer points."}'),
 ('item:briskTonic','{"name":"Brisk tonic","buy":30,"sell":9,"icon":"supply","model":"potion","color":15050547,"category":"Potions","stackable":false,"profession":true,"energy":1000,"description":"Restores 10% run energy."}'),
 ('item:windstepBrew','{"name":"Windstep brew","buy":120,"sell":36,"icon":"supply","model":"potion","color":10079436,"category":"Potions","stackable":false,"profession":true,"energy":2000,"stamina":200,"description":"Restores 20% run energy; running drains 70% less for 2 minutes."}')
on conflict (id) do nothing;

-- Weapon speed corrections (docs/mechanics-spec.md 4.1): spears 4 ticks, the warhammer 6, hammers
-- 4 (their bonuses read like a mace). "speed" keeps Eldervale's 0.45 s display unit.
update eldervale_private.realm_catalog set data=data||'{"ticks":4,"speed":1.8}'::jsonb
 where id like 'weapon:%' and (lower(id) like '%spear' or (lower(id) like '%hammer' and lower(id) not like '%warhammer')) and coalesce(data->>'ticks','')<>'4';
update eldervale_private.realm_catalog set data=data||'{"ticks":6,"speed":2.7}'::jsonb
 where id like 'weapon:%' and lower(id) like '%warhammer' and coalesce(data->>'ticks','')<>'6';

commit;
