// Writes db/bosses-3-lairs.sql and db/bosses-4-gear.sql from bosses.js, unique-gear.js,
// monster-roster.js and mechanics.js. Usage: node --import ./tests/helpers/preload.js scripts/build-bosses-sql.mjs
import fs from 'node:fs';
import {BOSSES,NEW_MONSTERS,LAIRS,LAIR_EXTENSIONS,bossDrops,DRAGON_LOOT,withLair} from '../bosses.js';
import {dungeons} from '../underground-data.js';
import {UNIQUE_ITEMS,UNIQUE_MATERIALS,UNIQUE_SPECIALS,UNIQUE_POISON,legacyWeaponNumbers,defenceOf} from '../unique-gear.js';
import {rosterBeasts,statBlock} from '../monster-roster.js';
import {migrateLoot} from '../mechanics.js';
import {bestiaryEntity} from '../bestiary.js?v=release-20261106-shieldorig122';
import {outfitItems,SLOT_LABELS} from '../outfits.js?v=release-20261106-shieldorig122';

const root=new URL('../',import.meta.url);
const json=v=>{const t=JSON.stringify(v);if(t.includes('$j$'))throw Error('quote clash');return '$j$'+t+'$j$'};
const clean=o=>JSON.parse(JSON.stringify(o));

// ---------------------------------------------------------------- monsters
// New roster templates (adult dragons, the dragon boss): the base monster's data with new stats.
export function newMonsterTemplates(){
 return NEW_MONSTERS.map(m=>{const base=bestiaryEntity(m.base,0,0),stats=statBlock(m.level,m.rank,'dragon');
  const loot=m.key==='twinflame_wyrm'?[]:[{item:'wyrmBones',always:true,min:1,max:1},{item:'runiteBar',min:1,max:3,chance:.2},{item:'cutGem',min:1,max:3,chance:.2},{item:'fireRune',min:30,max:60,chance:.3}];
  const {base:_b,key,rank,...look}=m;
  return {key,data:clean({...base,...stats,...look,name:m.name,level:m.level,loot,tier:rank,rosterKey:key,species:'dragon',template:'dragon',hostile:true,
   respawn:rank==='Legendary'?900:120,roam:rank==='Legendary'?3:4,behavior:'wander',blueprint:'monster-roster-v1',blueprintKey:'bosses-v1:'+key,x:0,z:0,
   ...(key==='twinflame_wyrm'?{boss:true,bossId:key,attackSpeed:4.4}:{})})};
 });
}
const rosterLoot=key=>rosterBeasts[key]?.loot||newMonsterTemplates().find(t=>t.key===key)?.data.loot||[];
// Loot tables v2 for dragons: their roster table + dragon-only tertiary rows.
export function dragonDrops(){
 const out={};
 for(const key of ['ashscale_whelp','verdant_whelp','rimescale_whelp','cinderhorn_drake','hoarscale_drake']){
  const adult=/drake/.test(key),t=migrateLoot(rosterLoot(key)),d=adult?DRAGON_LOOT.adult:DRAGON_LOOT.whelp;
  t.tertiary=[{item:'wyrmScale',min:1,max:adult?2:1,chance:d.wyrmScale},...['wyrmscaleCoif','wyrmscaleJerkin','wyrmscaleChaps','wyrmscaleVambraces'].map(p=>({item:'armor:'+p,min:1,max:1,chance:d.wyrmscale})),...(d.breathwardTonic?[{item:'breathwardTonic',min:1,max:1,chance:d.breathwardTonic}]:[])];
  out[key]=t;
 }
 return out;
}
// Multi-combat zone over each boss arena room (world units).
export function arenaZones(){
 const all=[...LAIRS,...dungeons.filter(d=>LAIR_EXTENSIONS[d.id]).map(withLair)];
 const out=[];
 for(const a of all)for(const s of a.spawns.filter(s=>BOSSES.some(b=>b.roster===s.roster))){const lv=a.levels.find(l=>l.level===s.level),r=lv?.rooms.find(r=>r.id===s.room);if(!r)continue;
  const ox=a.origin.x,oz=a.origin.z+s.level*400;out.push({id:'lair:'+a.id,data:{name:'Boss arena · '+s.roster,x1:ox+r.x-r.rx-2,z1:oz+r.z-r.rz-2,x2:ox+r.x+r.rx+2,z2:oz+r.z+r.rz+2,floor:0,multi:true}})}
 return out;
}

// ---------------------------------------------------------------- catalog rows
const FIELD={weapon:'weaponsOwned',armor:'armorOwned',shield:'shieldsOwned'};
export function catalogRows(){
 const rows=[];
 for(const u of UNIQUE_ITEMS){
  const flags={tradeable:u.tradeable,untradeable:!u.tradeable,keepOnDeath:!u.tradeable,shopless:true,uniqueGear:true,...(u.boss?{bossUnique:u.boss}:{}),...(u.dragon?{dragonOnly:true}:{}),...(u.quest?{questReward:true}:{})};
  const sell=Math.round(u.value*.3),base=u.base&&outfitItems[u.base];
  const item={name:u.name,buy:u.value,sell,field:FIELD[u.kind],key:u.id,req:u.req||{},...flags,...(u.kind==='armor'?{slot:base.slot}:{})};
  let detail;
  if(u.kind==='weapon'){const n=legacyWeaponNumbers(u);detail={name:u.name,desc:u.desc,kind:u.staff?'staff':'weapon',damage:n.damage,attack:n.attack,speed:+(u.ticks*.45).toFixed(2),reach:u.reach,ticks:u.ticks,styles:u.styles,req:u.req,bonuses:u.bonuses,
   ...(u.twoHanded||u.staff?{twoHanded:true}:{}),...(u.staff?{magic:true,ranged:true,spell:u.spell}:{}),...flags}}
  else if(u.kind==='shield')detail={name:u.name,desc:u.desc,kind:'shield',tier:'unique',defence:defenceOf(u),req:u.req||{},bonuses:u.bonuses,...(u.breathWard?{breathWard:u.breathWard}:{}),...flags};
  else detail={name:u.name,slot:SLOT_LABELS[base.slot],desc:u.desc,defence:Math.max(1,Math.round((u.bonuses.dstab+u.bonuses.dslash+u.bonuses.dcrush)/30)),reduction:Math.max(0,Math.round((u.bonuses.dstab+u.bonuses.dslash)/60)),tier:'unique',req:u.req||{},bonuses:u.bonuses,...flags};
  rows.push(['item:'+u.catalogId,clean(item)],[u.catalogId,clean(detail)]);
 }
 for(const m of UNIQUE_MATERIALS)rows.push(['item:'+m.id,clean({name:m.name,category:m.category,buy:m.value,sell:Math.round(m.value*.3),stackable:!!m.stackable,description:m.desc,icon:'supply',custom:true,
  ...(m.breathward?{breathward:m.breathward,model:'potion',color:0xff8a4a}:{model:'gem',color:0x8a3a2a})})]);
 return rows;
}
export function recipes(){
 const out=[];
 for(const u of UNIQUE_ITEMS)if(u.craft)out.push(['smith_unique_'+u.id,{seconds:3,enabled:true,kind:'process',tools:['hammer'],station:u.craft.station,name:'Smith '+u.name.toLowerCase(),skill:u.craft.skill,level:u.craft.level,xp:u.craft.xp,inputs:u.craft.inputs,outputs:{[u.catalogId]:1}}]);
 out.push(['brew_breathward_tonic',{seconds:3,enabled:true,kind:'process',tools:['pestle'],station:null,name:'Mix Breathward tonic',skill:'herblore',level:66,xp:150,inputs:{unfinishedPotion:1,wyrmScale:1},outputs:{breathwardTonic:1}}]);
 return out;
}

// ---------------------------------------------------------------- SQL text
const bossIds=BOSSES.map(b=>b.id),rosterBosses=BOSSES.filter(b=>b.id!=='twinflame_wyrm');
export function lairsSql(){
 const defs=BOSSES.map(b=>({id:b.id,data:clean(b)}));
 const templates=newMonsterTemplates();
 const ext=LAIR_EXTENSIONS;
 return `-- Eldervale bosses, part 3: boss definitions, the lairs and the monster templates.
-- Generated by scripts/build-bosses-sql.mjs from bosses.js. Do not edit by hand.
-- APPLY AFTER db/bosses-2-hooks.sql and db/underground-1..3 + 2-content. Idempotent:
--  * boss_defs: one row per boss; a definition the owner saved in the console (updated_by set) is kept.
--  * monster templates (roster rows, never placed): ${templates.map(t=>t.key).join(', ')}.
--  * the five roster bosses get bossId/boss flags; their open-world spawns are retired (deleted=true):
--    each boss now fights only in its lair (the lair spawn copies the roster row).
--  * lairs (underground areas): ${LAIRS.map(l=>l.id).join(', ')}; Hollowmere Undercroft gains the
--    Hollow Throne (level 2) and Cindervault Depths' crucible gets the Ashen Colossus. An area the owner
--    saved from the console keeps its data. Every lair is re-synced (walls, passages, spawns).
--  * multi-combat zones (mech_rules 'zone') over each boss arena.
begin;
set local lock_timeout='5s';

insert into eldervale_private.boss_defs(id,data,enabled) select d->>'id',d->'data',true from jsonb_array_elements(${json(defs)}::jsonb) d
 on conflict (id) do update set data=excluded.data,updated_at=now() where eldervale_private.boss_defs.updated_by is null;

do $templates$
declare rev bigint;t jsonb;
begin
 update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
 for t in select value from jsonb_array_elements(${json(templates)}::jsonb) loop
  insert into eldervale_private.entities(id,revision,data,deleted) values(md5('bosses-v1:template:'||(t->>'key'))::uuid,rev,t->'data',true)
   on conflict (id) do update set revision=rev,data=excluded.data,deleted=true where not coalesce((eldervale_private.entities.data->>'ownerEdited')::boolean,false);
 end loop;
 -- Roster bosses: flagged as bosses; the open-world spawns retire (the lairs copy these rows).
 update eldervale_private.entities set revision=rev,deleted=true,data=data||jsonb_build_object('boss',true,'bossId',data->>'rosterKey','retiredBy','bosses-v1')
  where data->>'blueprint'='monster-roster-v1' and data->>'rosterKey' in (${rosterBosses.map(b=>`'${b.id}'`).join(',')}) and (not deleted or not (data ? 'bossId'));
end $templates$;

insert into eldervale_private.underground_areas(id,data,enabled) select a->>'id',a-'enabled',coalesce((a->>'enabled')::boolean,true) from jsonb_array_elements(${json(LAIRS)}::jsonb) a
 on conflict (id) do update set data=excluded.data,updated_at=now() where eldervale_private.underground_areas.updated_by is null;

-- Hollowmere gains the Hollow Throne (level 2) and Cindervault the sealed Crucible (level 2): the boss
-- level, a gated stair down from the level above (quest unlock), the boss spawn and lights.
${Object.entries(ext).map(([id,x])=>`update eldervale_private.underground_areas set data=data||jsonb_build_object('lair',${json(x.lair)}::jsonb,
  'levels',data->'levels'||coalesce((select jsonb_agg(l) from jsonb_array_elements(${json(x.levels)}::jsonb) l where not exists(select 1 from jsonb_array_elements(data->'levels') o where o->'level'=l->'level')),'[]'),
  'links',coalesce(data->'links','[]')||coalesce((select jsonb_agg(l) from jsonb_array_elements(${json(x.links)}::jsonb) l where not exists(select 1 from jsonb_array_elements(coalesce(data->'links','[]')) o where o->>'id'=l->>'id')),'[]'),
  'spawns',coalesce(data->'spawns','[]')||coalesce((select jsonb_agg(s) from jsonb_array_elements(${json(x.spawns)}::jsonb) s where not exists(select 1 from jsonb_array_elements(coalesce(data->'spawns','[]')) o where o->>'id'=s->>'id')),'[]'),
  'lights',coalesce(data->'lights','[]')||(case when exists(select 1 from jsonb_array_elements(data->'levels') o where (o->>'level')::integer=2) then '[]'::jsonb else ${json(x.lights)}::jsonb end),
  'reserved',coalesce((select jsonb_agg(r) from jsonb_array_elements(coalesce(data->'reserved','[]')) r where not (${json(x.unreserve||[])}::jsonb ? (r->>'room'))),'[]'))
 where id='${id}' and not (data ? 'lair');`).join('\n')}

select eldervale_private.underground_sync(id) from eldervale_private.underground_areas where id in (${[...LAIRS.map(l=>l.id),'hollowmere_undercroft','cindervault_depths'].map(i=>`'${i}'`).join(',')}) order by id;

insert into eldervale_private.mech_rules(kind,id,data,enabled) select 'zone',z->>'id',z->'data',true from jsonb_array_elements(${json(arenaZones())}::jsonb) z
 on conflict (kind,id) do nothing;
commit;
`;
}
export function gearSql(){
 const rows=catalogRows(),drops=[...BOSSES.map(b=>({id:b.roster,data:bossDrops(b)})),...Object.entries(dragonDrops()).map(([id,data])=>({id,data}))];
 return `-- Eldervale bosses, part 4: unique gear, dragon-only drops, the Breathward tonic, boss loot tables,
-- unique weapon specials and the Scaleward Shield / Breathward tonic recipes.
-- Generated by scripts/build-bosses-sql.mjs from unique-gear.js and bosses.js. Do not edit by hand.
-- APPLY AFTER db/bosses-3-lairs.sql. Idempotent:
--  * catalog: ${UNIQUE_ITEMS.length} unique items (item:<kind>:<id> + <kind>:<id> rows) and ${UNIQUE_MATERIALS.length} materials. Untradeable items
--    carry tradeable=false (the trade window refuses them), untradeable + keepOnDeath (kept on death);
--    every unique is shopless (no shop stocks them). Flags the owner changed in the console are kept.
--  * loot tables v2 (mech_rules 'drops', per rosterKey) for the ${BOSSES.length} bosses (supplies + preroll uniques) and the
--    dragons (wyrm scales, Wyrmscale armour, Breathward tonic); a table the owner already has is kept.
--  * specials (mech_rules 'special') and venom (mech_rules 'poison') for the unique weapons; item weights.
begin;
set local lock_timeout='5s';

insert into eldervale_private.realm_catalog(id,data) select r->>0,r->1 from jsonb_array_elements(${json(rows)}::jsonb) r
 on conflict (id) do update set data=excluded.data||(eldervale_private.realm_catalog.data-'name'-'desc'-'description'-'bonuses'-'req'-'buy'-'sell'-'slot'-'styles'-'ticks'-'speed'-'reach'-'damage'-'attack'-'defence'-'reduction'-'kind'-'field'-'key'-'spell'-'magic'-'ranged'-'twoHanded'-'breathWard'-'breathward'-'category'-'stackable'-'icon'-'model'-'color'-'custom'-'uniqueGear'-'bossUnique'-'dragonOnly'-'questReward');

insert into eldervale_private.mech_rules(kind,id,data,enabled) select 'drops',d->>'id',d->'data',true from jsonb_array_elements(${json(drops)}::jsonb) d
 on conflict (kind,id) do nothing;
insert into eldervale_private.mech_rules(kind,id,data,enabled) select 'special',s.key,s.value,true from jsonb_each(${json(UNIQUE_SPECIALS)}::jsonb) s
 on conflict (kind,id) do nothing;
insert into eldervale_private.mech_rules(kind,id,data,enabled) select 'poison',s.key,s.value,true from jsonb_each(${json(UNIQUE_POISON)}::jsonb) s
 on conflict (kind,id) do nothing;
insert into eldervale_private.mech_rules(kind,id,data,enabled) select 'item',u->>'id',jsonb_build_object('weight',(u->>'weight')::numeric),true from jsonb_array_elements(${json(UNIQUE_ITEMS.filter(u=>u.weight!=null).map(u=>({id:u.catalogId,weight:u.weight})))}::jsonb) u
 on conflict (kind,id) do nothing;

insert into eldervale_private.skill_recipes(id,data) select r->>0,r->1 from jsonb_array_elements(${json(recipes())}::jsonb) r
 on conflict (id) do update set data=excluded.data;
commit;
`;
}
if(import.meta.url===`file://${process.argv[1]}`){
 for(const [f,t] of [['db/bosses-3-lairs.sql',lairsSql()],['db/bosses-4-gear.sql',gearSql()]]){
  if(Buffer.byteLength(t)>40960)throw Error(f+' is over 40 KB: '+Buffer.byteLength(t));
  if(/\b(delete|alter|drop)\b/i.test(t))throw Error(f+' contains a forbidden word');
  fs.writeFileSync(new URL(f,root),t);console.log(f,Buffer.byteLength(t),'bytes');
 }
}
