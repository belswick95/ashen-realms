// Writes db/osrs-equipment-combat.sql: OSRS-style gear tiers, equipment bonuses,
// level requirements and combat formulas on the server, from the same data the
// client uses (gear-tiers.js, weapons.js, shields.js, outfits.js, gear-recipes.js).
// usage: node scripts/build-equipment-sql.mjs
import fs from 'node:fs';
import {weaponCatalog} from '../weapons.js';
import {shieldCatalog} from '../shields.js';
import {armorCatalog} from '../melee-stats.js';
import {professionItems,professionRecipes} from '../profession-data.js';
import {METAL_NAMES,plateKey,weaponKey,shieldKey,arrowtipsId,SHORTBOWS} from '../gear-recipes.js';
import {GEAR_TIERS,ARROWS,SPELLS,TICK_SECONDS,HIT_SCALE,tierIndex,PLATE_PIECES,WEAPON_TEMPLATES} from '../gear-tiers.js';

const out=[];const sql=s=>out.push(s.trim()+'\n');
const lit=s=>"'"+String(s).replace(/'/g,"''")+"'";
const json=v=>{const t=JSON.stringify(v);if(t.includes('$gear$'))throw Error('delimiter clash');return '$gear$'+t+'$gear$::jsonb'};
const pick=(o,keys)=>Object.fromEntries(keys.filter(k=>o[k]!==undefined&&o[k]!==null).map(k=>[k,o[k]]));

// ---- catalog rows ------------------------------------------------------------
const rows=[];
for(const [key,w] of Object.entries(weaponCatalog)){
 rows.push(['item:weapon:'+key,{name:w.name,buy:w.buy,sell:w.sell,field:'weaponsOwned',key,req:w.req||{}}]);
 rows.push(['weapon:'+key,{...pick(w,['name','desc','kind','damage','attack','speed','reach','ticks','styles','spell','tier','arrowCap']),req:w.req||{},bonuses:w.bonuses,...(w.twoHanded?{twoHanded:true}:{}),...(w.ranged?{ranged:true}:{}),...(w.magic?{magic:true}:{}),...(w.arrowCap?{arrowCapTier:tierIndex(w.arrowCap)}:{})}]);
}
for(const [key,s] of Object.entries(shieldCatalog)){
 rows.push(['item:shield:'+key,{name:s.name,buy:s.buy,sell:s.sell,field:'shieldsOwned',key,req:s.req||{}}]);
 rows.push(['shield:'+key,{...pick(s,['name','desc','tier']),kind:'shield',defence:s.defence,req:s.req||{},bonuses:s.bonuses}]);
}
for(const [key,a] of Object.entries(armorCatalog)){
 rows.push(['item:armor:'+key,{name:key==='cape'?'Crimson cape':a.name,buy:a.buy,sell:a.sell,field:'armorOwned',key,slot:a.equipSlot,req:a.req||{}}]);
 rows.push(['armor:'+key,{...pick(a,['name','slot','desc','defence','reduction','tier']),req:a.req||{},bonuses:a.bonuses}]);
}
// New materials and ammunition, plus the tier names of the higher ores and bars.
const newItems=['blacksteelBar',...Object.keys(ARROWS).filter(id=>id!=='arrows'),...GEAR_TIERS.map(t=>arrowtipsId(t.id)).filter(id=>id!=='arrowTips'&&professionItems[id])];
for(const id of newItems)rows.push(['item:'+id,{...professionItems[id],icon:'supply'}]);
rows.push(['item:arrows',{description:professionItems.arrows.description}]);
for(const id of Object.keys(METAL_NAMES))rows.push(['item:'+id,{name:professionItems[id].name}]);

// ---- recipes -------------------------------------------------------------------
const recipeIds=Object.keys(professionRecipes).filter(id=>/^(smith_|fletch_)/.test(id)||id==='smelt_blacksteelBar');
const renamed=['mine_mithrilOre','mine_adamantOre','mine_runiteOre','smelt_mithrilBar','smelt_adamantBar','smelt_runiteBar','forge_mithril_fittings','forge_adamant_fittings','forge_runite_fittings'].filter(id=>professionRecipes[id]);

// ---- shops (merged into the merchant entities, prices from the catalog) ---------------
const T=GEAR_TIERS.map(t=>t.id),upto=last=>T.slice(0,T.indexOf(last)+1);
const weaponsOf=tiers=>tiers.flatMap(t=>Object.keys(WEAPON_TEMPLATES).map(p=>'weapon:'+weaponKey(t,p)));
const MAIN_PLATE=['Armet','Breastplate','Greaves','Sabatons','Gauntlets'];
const plateOf=tiers=>tiers.flatMap(t=>MAIN_PLATE.map(p=>'armor:'+plateKey(t,p)));
const shieldsOf=tiers=>tiers.flatMap(t=>['kite','square'].map(p=>'shield:'+shieldKey(t,p)));
const SHOPS=[
 ['Edric Edgewright',"name",[...weaponsOf(upto('verdite')),'weapon:tidesteelDagger','weapon:tidesteelScimitar','weapon:tidesteelLongsword']],
 ['Hollin the Armourer',"name",[...plateOf(upto('moonsilver')),...shieldsOf(upto('moonsilver'))]],
 ['Wren Fletcher',"name",['weapon:oakShortbow','weapon:willowShortbow','weapon:mapleShortbow','weapon:yewShortbow','bronzeArrows','steelArrows','moonsilverArrows','verditeArrows','bronzeArrowtips','steelArrowtips']],
 ['Magister Oriel',"name",['weapon:emberStaff','armor:wizardBoots2','armor:wizardBracers2','armor:wizardRobeTop2','armor:wizardRobeBottom2','armor:wizardBoots3','armor:wizardBracers3','armor:wizardRobeTop3','armor:wizardRobeBottom3']],
 ['36b9aa48-81f4-44bf-b934-dbc4ec8f1a08',"id",[...plateOf(['verdite','tidesteel']),...shieldsOf(['verdite','tidesteel']),'tidesteelArrows']]
];
for(const [,,items] of SHOPS)for(const i of items)if(!rows.some(([id])=>id==='item:'+i)&&!professionItems[i])throw Error('Shop item missing from catalog: '+i);

// ---- monster loot (appended; at most eight rows per monster) ----------------------
const L=(item,min,max,chance)=>({item,min,max,chance});
const LOOT={
 'Goblin scout':[L('weapon:bronzeDagger',1,1,.05),L('bronzeArrows',4,10,.2)],
 'Goblin raider':[L('weapon:bronzeScimitar',1,1,.05),L('armor:bronzeArmet',1,1,.04),L('bronzeArrows',5,12,.25)],
 'Road bandit':[L('weapon:steelDagger',1,1,.04),L('steelArrows',4,10,.15),L('armor:steelSabatons',1,1,.03)],
 'Rotting zombie':[L('weapon:steelHammer',1,1,.04)],
 'Skeleton warrior':[L('weapon:steelLongsword',1,1,.04),L('shield:blacksteelHeaterShield',1,1,.03)],
 'Skeleton archer':[L('steelArrows',5,15,.4),L('weapon:oakShortbow',1,1,.04)],
 'Goblin warlord':[L('weapon:blacksteelScimitar',1,1,.06),L('armor:knightArmet3',1,1,.04)],
 'Ravenous ghoul':[L('weapon:moonsilverDagger',1,1,.03),L('moonsilverArrows',3,8,.15)],
 'Orc grunt':[L('weapon:moonsilverBattleaxe',1,1,.03),L('armor:moonsilverArmet',1,1,.03)],
 'Giant broodmother':[L('weapon:willowShortbow',1,1,.05),L('verditeArrows',4,10,.2)],
 'Cave troll':[L('weapon:verditeHammer',1,1,.04),L('armor:verditeGreaves',1,1,.03)],
 'Orc warchief':[L('weapon:verditeBattleaxe',1,1,.08),L('shield:verditeKiteshield',1,1,.05)],
 'Stone guardian':[L('armor:tidesteelSabatons',1,1,.04),L('weapon:tidesteelHammer',1,1,.03)],
 'Ash demon':[L('weapon:embersteelScimitar',1,1,.02),L('tidesteelArrows',5,15,.3)],
 'Ember dragon':[L('armor:embersteelBreastplate',1,1,.03),L('weapon:embersteelLongsword',1,1,.03),L('embersteelArrows',5,15,.3)],
 'Elder wyrm':[L('weapon:eldersteelLongsword',1,1,.04),L('armor:eldersteelBreastplate',1,1,.03),L('shield:eldersteelKiteshield',1,1,.03),L('embersteelArrowtips',10,30,.4)]
};
for(const rowsOf of Object.values(LOOT))for(const r of rowsOf)if(!rows.some(([id])=>id==='item:'+r.item)&&!professionItems[r.item])throw Error('Loot item missing: '+r.item);

// ---- server functions -------------------------------------------------------------
const arrowValues=Object.entries(ARROWS).map(([id,a])=>`(${lit(id)},${tierIndex(a.tier)},${a.rstr})`).join(',');
const spellValues=Object.entries(SPELLS).flatMap(([family,list],fi)=>list.map(([lvl,hit])=>`(${fi},${lit(family)},${lvl},${hit})`)).join(',');
const functions=String.raw`
-- Safe integer from a jsonb number or numeric string (null otherwise).
create or replace function eldervale_private.gear_int(v jsonb) returns integer language sql immutable set search_path to '' as $f$
 select case when jsonb_typeof(v)='number' then floor((v#>>'{}')::numeric)::integer
  when jsonb_typeof(v)='string' and (v#>>'{}') ~ '^-?[0-9]+(\.[0-9]+)?$' then floor((v#>>'{}')::numeric)::integer end
$f$;
-- A skill level from a save's skills (e.g. skill 'attack' reads attackXP).
create or replace function eldervale_private.gear_level(skills jsonb, skill text) returns integer language sql immutable set search_path to '' as $f$
 select eldervale_private.xp_level(case when jsonb_typeof(skills->(skill||'XP'))='number' then (skills->>(skill||'XP'))::numeric else 0 end)
$f$;
-- OSRS max hit: floor(0.5 + effective strength * (bonus + 64) / 640), at "scale" times the OSRS resolution.
create or replace function eldervale_private.osrs_max_hit(eff integer, bonus integer, scale integer default ${HIT_SCALE}) returns integer language sql immutable set search_path to '' as $f$
 select floor(0.5+greatest(0,coalesce(eff,0))::numeric*(greatest(-64,coalesce(bonus,0))+64)*coalesce(scale,1)/640)::integer
$f$;
-- OSRS hit chance from the attack roll and the defence roll.
create or replace function eldervale_private.osrs_hit_chance(att bigint, def bigint) returns float8 language sql immutable set search_path to '' as $f$
 select case when att>def then 1-(def+2)/(2.0*(att+1)) else att/(2.0*(def+1)) end::float8
$f$;
-- Arrow tiers (gear-tiers.js ARROWS): item id, tier index, ranged strength.
create or replace function eldervale_private.arrow_tiers() returns table(id text, tier integer, rstr integer) language sql immutable set search_path to '' as $f$
 select * from (values ${arrowValues}) v(id,tier,rstr)
$f$;
-- The best arrows a bow can fire from what the player carries (null for other weapons).
create or replace function eldervale_private.best_arrow(stats jsonb, w jsonb) returns text language sql immutable set search_path to '' as $f$
 select a.id from eldervale_private.arrow_tiers() a
 where coalesce((w->>'ranged')::boolean,false) and not coalesce((w->>'magic')::boolean,false)
  and coalesce(eldervale_private.gear_int(stats->a.id),0)>0 and a.tier<=coalesce(eldervale_private.gear_int(w->'arrowCapTier'),1)
 order by a.tier desc limit 1
$f$;
create or replace function eldervale_private.arrow_supply(stats jsonb, w jsonb) returns integer language sql immutable set search_path to '' as $f$
 select coalesce(sum(greatest(0,coalesce(eldervale_private.gear_int(stats->a.id),0))),0)::integer from eldervale_private.arrow_tiers() a
 where a.tier<=coalesce(eldervale_private.gear_int(w->'arrowCapTier'),1)
$f$;
create or replace function eldervale_private.spend_arrow(stats jsonb, w jsonb) returns jsonb language plpgsql immutable set search_path to '' as $f$
declare id text:=eldervale_private.best_arrow(stats,w);
begin
 if id is null then return stats;end if;
 return stats||jsonb_build_object(id,greatest(0,coalesce(eldervale_private.gear_int(stats->id),0)-1));
end $f$;
-- Summed equipment bonuses: weapon, shield (not with a two-handed weapon), worn armour, best arrows.
create or replace function eldervale_private.gear_bonuses(equipment jsonb, stats jsonb default '{}') returns jsonb language sql stable set search_path to '' as $f$
 with e as (select case when jsonb_typeof(equipment)='object' then equipment else '{}'::jsonb end v),
 w as (select c.data from eldervale_private.realm_catalog c,e where c.id='weapon:'||coalesce(e.v->>'weapon','none')),
 parts as (
  select data->'bonuses' b from w
  union all select c.data->'bonuses' from eldervale_private.realm_catalog c,e where c.id='shield:'||coalesce(e.v->>'shield','none') and not coalesce((select (data->>'twoHanded')::boolean from w),false)
  union all select c.data->'bonuses' from e cross join lateral jsonb_each(e.v) x join eldervale_private.realm_catalog c on c.id='armor:'||x.key where x.value='true'::jsonb
  union all select jsonb_build_object('rstr',a.rstr) from eldervale_private.arrow_tiers() a where a.id=eldervale_private.best_arrow(coalesce(stats,'{}'),(select data from w)))
 select coalesce(jsonb_object_agg(k,v),'{}'::jsonb) from (select k,sum(eldervale_private.gear_int(b->k))::integer v from parts cross join lateral jsonb_object_keys(case when jsonb_typeof(b)='object' then b else '{}'::jsonb end) k group by k) t
$f$;
-- The strongest autocast spell a staff allows at a Magic level (OSRS elemental ladder).
create or replace function eldervale_private.spell_max_hit(magic integer, family text) returns integer language sql immutable set search_path to '' as $f$
 select coalesce(max(s.hit),0) from (values ${spellValues}) s(f,family,lvl,hit)
 where s.f<=coalesce((select f2 from (values (0,'strike'),(1,'bolt'),(2,'blast'),(3,'wave')) x(f2,name) where x.name=family),0) and s.lvl<=magic
$f$;
-- OSRS-style stat block for a monster (mirrors gear-tiers.js monsterStats).
create or replace function eldervale_private.monster_stats(d jsonb) returns jsonb language plpgsql immutable set search_path to '' as $f$
declare lvl integer:=greatest(1,coalesce(eldervale_private.gear_int(d->'level'),1));att integer;str integer;def integer;mag integer;att_bonus integer;base integer;target integer;str_bonus integer;hit integer;dummy boolean;defs jsonb:='{}';k text;
begin
 att:=coalesce(eldervale_private.gear_int(d->'attackLevel'),lvl);str:=coalesce(eldervale_private.gear_int(d->'strengthLevel'),lvl);
 def:=coalesce(eldervale_private.gear_int(d->'defenceLevel'),lvl);mag:=coalesce(eldervale_private.gear_int(d->'magicLevel'),lvl);
 att_bonus:=coalesce(eldervale_private.gear_int(d->'attackBonus'),lvl/3);base:=coalesce(eldervale_private.gear_int(d->'defenceBonus'),lvl/3);
 foreach k in array array['stab','slash','crush','magic','ranged'] loop defs:=defs||jsonb_build_object(k,coalesce(eldervale_private.gear_int(d->'defenceBonuses'->k),base));end loop;
 dummy:=coalesce((d->>'trainingDummy')::boolean,false) or coalesce(d->>'species'='dummy',false) or coalesce(d->>'template'='training_dummy',false);
 target:=round(2*(6+coalesce(eldervale_private.gear_int(d->'damage'),4))*greatest(1.0,1+(lvl-20)/80.0))::integer;
 str_bonus:=coalesce(eldervale_private.gear_int(d->'strengthBonus'),greatest(0,ceil(target*640.0/(${HIT_SCALE}*(str+9)))::integer-64));
 hit:=case when dummy then 0 else coalesce(eldervale_private.gear_int(d->'maxHit'),eldervale_private.osrs_max_hit(str+9,str_bonus,${HIT_SCALE})) end;
 return jsonb_build_object('level',lvl,'attackLevel',att,'strengthLevel',str,'defenceLevel',def,'magicLevel',mag,'attackBonus',att_bonus,'strengthBonus',str_bonus,'defence',defs,'maxHit',hit,'dummy',dummy,
  'attackStyle',case when d->>'attackType' in ('stab','bite','venom','sting') then 'stab' when d->>'attackType' in ('slash','claw','swoop') then 'slash' when d->>'attackType' in ('arrow','ranged','spit') then 'ranged' when d->>'attackType' in ('magic','fire') then 'magic' else 'crush' end);
end $f$;
-- One player attack on a monster: 0 = a miss (or a zero hit), otherwise damage.
create or replace function eldervale_private.player_strike(skills jsonb, equipment jsonb, stats jsonb, style text, w jsonb, m jsonb) returns integer language plpgsql volatile set search_path to '' as $f$
declare b jsonb:=eldervale_private.gear_bonuses(equipment,stats);ms jsonb:=eldervale_private.monster_stats(m);kind text;lvl integer;eff integer;eff_str integer;att bigint;def bigint;hit integer;
begin
 w:=coalesce(w,'{}');
 if coalesce((w->>'magic')::boolean,false) then
  lvl:=eldervale_private.gear_level(skills,'magic');eff:=lvl+9;att:=eff*(coalesce(eldervale_private.gear_int(b->'amagic'),0)+64);
  hit:=floor(eldervale_private.spell_max_hit(lvl,coalesce(w->>'spell','strike'))*(100+coalesce(eldervale_private.gear_int(b->'mdmg'),0))/100.0)::integer*${HIT_SCALE};
  def:=((ms->>'magicLevel')::integer+9)*((ms->'defence'->>'magic')::integer+64);
 elsif coalesce((w->>'ranged')::boolean,false) then
  lvl:=eldervale_private.gear_level(skills,'ranged');eff:=lvl+(case when style='stab' then 3 else 0 end)+8;
  att:=eff*(coalesce(eldervale_private.gear_int(b->'arange'),0)+64);hit:=eldervale_private.osrs_max_hit(eff,coalesce(eldervale_private.gear_int(b->'rstr'),0));
  def:=((ms->>'defenceLevel')::integer+9)*((ms->'defence'->>'ranged')::integer+64);
 else
  kind:=coalesce(w->'styles'->>style,'crush');
  eff:=eldervale_private.gear_level(skills,'attack')+(case when style='stab' then 3 when style='lunge' then 1 else 0 end)+8;
  eff_str:=eldervale_private.gear_level(skills,'strength')+(case when style='stab' then 0 when style='lunge' then 1 else 3 end)+8;
  att:=eff*(coalesce(eldervale_private.gear_int(b->('a'||kind)),0)+64);hit:=eldervale_private.osrs_max_hit(eff_str,coalesce(eldervale_private.gear_int(b->'str'),0));
  def:=((ms->>'defenceLevel')::integer+9)*((ms->'defence'->>kind)::integer+64);
 end if;
 -- Training dummies are always hit (at least 1) so every swing trains.
 if (ms->>'dummy')::boolean then return 1+floor(random()*greatest(1,hit))::integer;end if;
 if random()>=eldervale_private.osrs_hit_chance(att,def) then return 0;end if;
 return floor(random()*(hit+1))::integer;
end $f$;
-- One monster attack on a player: 0 = a miss (or a zero hit), otherwise damage.
create or replace function eldervale_private.monster_strike(skills jsonb, equipment jsonb, style text, m jsonb) returns integer language plpgsql volatile set search_path to '' as $f$
declare ms jsonb:=eldervale_private.monster_stats(m);b jsonb;kind text;eff integer;att bigint;def bigint;
begin
 if (ms->>'dummy')::boolean or (ms->>'maxHit')::integer<=0 then return 0;end if;
 kind:=ms->>'attackStyle';b:=eldervale_private.gear_bonuses(equipment,'{}');
 if kind='magic' then eff:=floor(.7*eldervale_private.gear_level(skills,'magic')+.3*eldervale_private.gear_level(skills,'defence'))::integer+8;
 else eff:=eldervale_private.gear_level(skills,'defence')+(case when style='lunge' then 1 else 0 end)+8;end if;
 def:=eff*(coalesce(eldervale_private.gear_int(b->('d'||(case when kind='ranged' then 'range' else kind end))),0)+64);
 att:=((ms->>'attackLevel')::integer+9)*((ms->>'attackBonus')::integer+64);
 if random()>=eldervale_private.osrs_hit_chance(att,def) then return 0;end if;
 return floor(random()*((ms->>'maxHit')::integer+1))::integer;
end $f$;
-- Seconds between a player's attacks: the weapon's ticks; Rapid (slash with a bow) is one tick faster.
create or replace function eldervale_private.attack_period(w jsonb, style text) returns float8 language sql immutable set search_path to '' as $f$
 select greatest(${TICK_SECONDS*2},coalesce((w->>'speed')::float8,${4*TICK_SECONDS})-(case when coalesce((w->>'ranged')::boolean,false) and not coalesce((w->>'magic')::boolean,false) and style='slash' then ${TICK_SECONDS} else 0 end))
$f$;
-- OSRS refusal for an item's level requirement, or null.
create or replace function eldervale_private.equip_requirement_error(skills jsonb, item jsonb) returns text language sql immutable set search_path to '' as $f$
 select format('You need %s %s level of %s to %s this.',case when n.label ~ '^[AEIOU]' then 'an' else 'a' end,n.label,eldervale_private.gear_int(item->'req'->n.skill),case when item->>'field'='weaponsOwned' then 'wield' else 'wear' end)
 from (values (1,'attack','Attack'),(2,'strength','Strength'),(3,'defence','Defence'),(4,'ranged','Ranged'),(5,'magic','Magic'),(6,'prayer','Prayer')) n(o,skill,label)
 where coalesce(eldervale_private.gear_int(item->'req'->n.skill),0)>1 and eldervale_private.gear_level(skills,n.skill)<eldervale_private.gear_int(item->'req'->n.skill)
 order by n.o limit 1
$f$;
-- Equip command check: removing an item is always allowed (grandfathered gear stays on);
-- putting one on needs its levels.
create or replace function eldervale_private.equip_blocked(equipment jsonb, skills jsonb, slot text, key text, c jsonb) returns text language sql immutable set search_path to '' as $f$
 select case when (c->>'field'='armorOwned' and coalesce(equipment->key,'false'::jsonb)='true'::jsonb)
  or (c->>'field' is distinct from 'armorOwned' and equipment->>slot is not distinct from key) then null
  else eldervale_private.equip_requirement_error(skills,c) end
$f$;
`;

// ---- function patches: only the hit, accuracy, max-hit, arrow and speed expressions ----
const PATCHES=[
 ['eldervale_private.world_tick()',
  "chance:=greatest(.2,least(.98,.85+(atk-coalesce((a.data->>'defenceLevel')::integer,(a.data->>'level')::integer))*.003+coalesce((w->>'attack')::integer,0)*.002));blocked:=random()>chance;",
  "damage:=eldervale_private.player_strike(victim.skills,victim.equipment,victim.stats,style,w,a.data);blocked:=damage<=0;"],
 ['eldervale_private.world_tick()',
  "damage:=case when blocked then 0 else greatest(1,1+floor(random()*(4+(w->>'damage')::integer+floor(str*.35)))::integer-floor((a.data->>'level')::integer/15)) end;",
  "damage:=greatest(0,coalesce(damage,0));"],
 ['eldervale_private.world_tick()',
  "chance:=greatest(.1,least(.95,.85+coalesce((a.data->>'level')::integer,1)*.002-(def+defence)*.004));blocked:=random()>chance;",
  "damage:=eldervale_private.monster_strike(victim.skills,victim.equipment,target_player.attack_style,a.data);blocked:=damage<=0;"],
 ['eldervale_private.world_tick()',
  "damage:=case when blocked then 0 else greatest(1,round((4+(a.data->>'damage')::integer+floor(random()*5)::integer)*eldervale_private.monster_damage_scale((a.data->>'level')::integer))::integer-case when a.data->>'attackType' in ('fire','magic','venom') then 0 else absorb end) end;",
  "damage:=greatest(0,damage);"],
 ['eldervale_private.world_tick()',
  "coalesce((victim.stats->>'arrows')::integer,0)>0",
  "eldervale_private.arrow_supply(victim.stats,w)>0"],
 ['eldervale_private.world_tick()',
  "coalesce((victim.stats->>'arrows')::integer,0)<1",
  "eldervale_private.arrow_supply(victim.stats,w)<1"],
 ['eldervale_private.world_tick()',
  "update public.player_saves set stats=stats||jsonb_build_object('arrows',greatest(0,coalesce((stats->>'arrows')::integer,0)-1)) where user_id=a.target;",
  "update public.player_saves set stats=eldervale_private.spend_arrow(stats,w) where user_id=a.target;"],
 ['eldervale_private.world_tick()',
  "period:=case when a.turn='player' then (w->>'speed')::float8 else",
  "period:=case when a.turn='player' then eldervale_private.attack_period(w,target_player.attack_style) else"],
 ['eldervale_private.realm_request_base(uuid,text,jsonb,uuid,bigint)',
  "if not(coalesce(s.inventory->field,'[]')?key) then raise exception 'You do not carry this item';end if;",
  "if not(coalesce(s.inventory->field,'[]')?key) then raise exception 'You do not carry this item';end if;if eldervale_private.equip_blocked(s.equipment,s.skills,slot,key,c) is not null then raise exception '%',eldervale_private.equip_blocked(s.equipment,s.skills,slot,key,c);end if;"]
];

// ---- assemble ---------------------------------------------------------------------
sql(`-- OSRS-style equipment and combat for Eldervale. Generated by scripts/build-equipment-sql.mjs
-- from gear-tiers.js, weapons.js, shields.js, outfits.js and gear-recipes.js; do not edit by hand.
--
-- APPLY AFTER db/osrs-skill-parity.sql (combat XP and skill requirements). Idempotent: safe to re-run.
--
-- * Gear tiers ${GEAR_TIERS.map(t=>t.name+' '+t.level).join(', ')}:
--   catalog rows for ${Object.keys(weaponCatalog).length} weapons, ${Object.keys(shieldCatalog).length} shields and ${Object.keys(armorCatalog).length} armour items with OSRS bonuses
--   (attack/defence stab, slash, crush, magic, ranged; melee and ranged strength; prayer),
--   level requirements ("req"), attack speed in ticks (${TICK_SECONDS}s each) and per-style attack types.
--   Tiered arrows (ranged strength), tier bars and arrowtips; smithing and fletching recipes.
--   The mithril/adamant/runite ore and bar ids keep their ids and take the Moonsilver,
--   Verdite and Tidesteel names.
-- * Combat helpers: player_strike / monster_strike use the OSRS formulas (effective level =
--   level + style + 8; max hit = floor(0.5 + effStr*(str+64)/640) at ${HIT_SCALE}x resolution because
--   Eldervale health is ${HIT_SCALE}x OSRS; rolls = effective level * (bonus + 64); OSRS hit chance).
--   Monsters get a stat block from their level and damage (monster_stats). Training dummies are
--   always hit and never hit back.
-- * Function edits through eldervale_private.patch_function (each anchor must match exactly once;
--   an edit already applied is skipped):
--     world_tick: ONLY the player hit chance/damage lines, the monster hit chance/damage lines,
--       the arrow checks and arrow use, and the player's attack period. The XP award lines
--       (combat_xp, hitpointsXP) are not touched.
--     realm_request_base: the equip command refuses items above the player's levels with the OSRS
--       message ("You need an Attack level of 20 to wield this."). Removing gear is always allowed,
--       so characters already wearing higher gear keep it (grandfathered).
-- * Birchford capital shops (and the castle quartermaster) stock the tiers; monsters gain
--   tier loot. Merchant shops are merged with their current stock, so nothing is lost.
begin;`);
sql(`insert into eldervale_private.realm_catalog(id,data)
select r->>0,r->1 from jsonb_array_elements(${json(rows)}) r
on conflict (id) do update set data=eldervale_private.realm_catalog.data||excluded.data;`);
sql(`insert into eldervale_private.skill_recipes(id,data)
select r->>0,r->1 from jsonb_array_elements(${json(recipeIds.map(id=>[id,professionRecipes[id]]))}) r
on conflict (id) do update set data=excluded.data;
update eldervale_private.skill_recipes r set data=r.data||jsonb_build_object('name',n.name)
from jsonb_each_text(${json(Object.fromEntries(renamed.map(id=>[id,professionRecipes[id].name])))}) n(id,name) where r.id=n.id and r.data->>'name' is distinct from n.name;`);
sql(functions);
sql(`do $patch$
declare fn text;old text;new text;body text;
begin
 for fn,old,new in select e->>0,e->>1,e->>2 from jsonb_array_elements(${json(PATCHES)}) e loop
  body:=pg_get_functiondef(fn::regprocedure);
  if position(new in body)>0 then continue;end if;
  perform eldervale_private.patch_function(fn::regprocedure,array[old,new]);
 end loop;
end $patch$;`);
sql(`-- Shops: current stock (shop_stock) + the entity's shop + new items at catalog prices.
do $shops$
declare rev bigint;spec jsonb;e record;merged jsonb;changed integer:=0;
begin
 update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
 for spec in select value from jsonb_array_elements(${json(SHOPS)}) loop
  for e in select * from eldervale_private.entities x where not x.deleted and ((spec->>1='name' and x.data->>'name'=spec->>0 and x.data->>'blueprint'='birchford-capital-v1') or (spec->>1='id' and x.id::text=spec->>0)) loop
   merged:=coalesce(e.data->'shop','{}'::jsonb)
    ||coalesce((select jsonb_object_agg(s.item,jsonb_build_object('buy',s.buy,'sell',s.sell,'stock',s.stock)) from eldervale_private.shop_stock s where s.merchant::text=e.id::text),'{}'::jsonb);
   merged:=coalesce((select jsonb_object_agg(i,jsonb_build_object('buy',(c.data->>'buy')::integer,'sell',(c.data->>'sell')::integer,'stock',-1)) from jsonb_array_elements_text(spec->2) i join eldervale_private.realm_catalog c on c.id='item:'||i where not merged?i),'{}'::jsonb)||merged;
   if merged is distinct from coalesce(e.data->'shop','{}'::jsonb) then update eldervale_private.entities set data=data||jsonb_build_object('shop',merged),revision=rev where id=e.id;changed:=changed+1;end if;
  end loop;
 end loop;
 -- Loot: append rows a monster does not already have, keeping at most eight.
 for e in select x.*,l.rows from eldervale_private.entities x join (select key,value rows from jsonb_each(${json(LOOT)})) l on l.key=x.data->>'name' where not x.deleted and x.data->>'kind'='monster' loop
  merged:=coalesce(e.data->'loot','[]'::jsonb);
  merged:=merged||coalesce((select jsonb_agg(r order by o) from jsonb_array_elements(e.rows) with ordinality t(r,o) where not exists(select 1 from jsonb_array_elements(merged) y where y->>'item'=r->>'item') and exists(select 1 from eldervale_private.realm_catalog c where c.id='item:'||(r->>'item'))),'[]'::jsonb);
  merged:=(select coalesce(jsonb_agg(r order by o),'[]'::jsonb) from jsonb_array_elements(merged) with ordinality t(r,o) where o<=8);
  if merged is distinct from coalesce(e.data->'loot','[]'::jsonb) then update eldervale_private.entities set data=data||jsonb_build_object('loot',merged),revision=rev where id=e.id;changed:=changed+1;end if;
 end loop;
 if changed=0 then update eldervale_private.settings set revision=revision-1 where id;end if;
 raise notice 'Equipment tiers: % merchant/monster entities updated',changed;
end $shops$;`);
sql('commit;');
const text=out.join('\n');
for(const word of ['delete','alter','drop']){const m=new RegExp('\\b'+word+'\\b','i').exec(text);if(m)throw Error('Generated SQL contains the word '+word+': '+text.slice(m.index-60,m.index+40))}
fs.writeFileSync(new URL('../db/osrs-equipment-combat.sql',import.meta.url),text);
console.log('db/osrs-equipment-combat.sql',text.length,'bytes;',rows.length,'catalog rows,',recipeIds.length,'recipes,',PATCHES.length,'patches');
