import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {professionRecipes,miningChance} from '../profession-data.js';
import {fishTable} from '../food.js';
import {skillLevel,combatXp,skillingChance,burnChance} from '../combat-level.js';
import {xpDelta} from '../xp-drops.js';
import {fromPlayerRow,toPlayerRow} from '../player-save.js';
import {tutorialQuests} from '../tutorial-data.js';
import {build} from '../scripts/build-osrs-skill-parity.mjs';
const sql=readFileSync(new URL('../db/osrs-skill-parity.sql',import.meta.url),'utf8');
const r=professionRecipes;

// Closest OSRS action for each Eldervale recipe: [level, XP].
const OSRS={
 mine_copperOre:[1,17.5],mine_tinOre:[1,17.5],mine_ore:[15,35],mine_silverOre:[20,40],mine_coal:[30,50],mine_goldOre:[40,65],mine_mithrilOre:[55,80],mine_adamantOre:[70,95],mine_runiteOre:[85,125],gather_essence_rock:[1,5],
 smelt_bronzeBar:[1,6.25],smelt_ironBar:[15,12.5],smelt_silverBar:[20,13.7],smelt_steelBar:[30,17.5],smelt_goldBar:[40,22.5],smelt_mithrilBar:[50,30],smelt_adamantBar:[70,37.5],smelt_runiteBar:[85,50],
 forge_weapon_dagger:[15,25],forge_weapon_axe:[16,25],forge_armor_boots:[18,25],forge_weapon_shortsword:[19,25],forge_weapon_scimitar:[20,50],forge_weapon_longsword:[21,50],forge_armor_helm:[22,50],forge_weapon_battleaxe:[25,75],forge_shield_kite:[27,75],forge_weapon_twohand:[29,75],forge_armor_legs:[31,75],forge_armor_chest:[33,125],
 forge_nails:[1,12.5],forge_arrowtips:[20,25],forge_steel_nails:[34,37.5],forge_brace:[35,37.5],forge_mithril_fittings:[55,50],forge_adamant_fittings:[75,62.5],forge_runite_fittings:[90,75],
 burn_wood:[1,40],burn_oakLogs:[15,60],burn_willowLogs:[30,90],burn_mapleLogs:[45,135],burn_yewLogs:[60,202.5],
 cook_shrimp:[1,30],cook_fish:[1,40],cook_meat:[1,30],bake_bread:[1,40],cook_trout:[15,70],cook_salmon:[25,90],cook_lobster:[40,120],cook_swordfish:[45,140],cook_stormfin:[80,210],mill_flour:[1,0],mix_dough:[1,0],
 tan_hide:[1,0],sew_gloves:[1,13.8],spin_string:[10,15],silver_ring:[16,50],cut_gem:[20,50],gather_flax_patch:[1,0],
 shafts:[1,5],feather_arrows:[1,15],carve_bow:[5,5],string_bow:[5,5],finish_arrows:[15,37.5],
 clean_herb:[1,2.5],fill_vial:[1,0],infuse_herb:[1,0],healing_draught:[3,25],gather_herb_patch:[1,0],
 plant_wheat:[1,8],plant_herbs:[9,11],gather_wheat_patch:[1,0],gather_berry_bush:[1,0],
 air_runes:[1,5],fire_runes:[14,7],hunt_game:[1,34],balance_log:[1,7.5],steal_stall:[1,16],pick_training_lock:[13,7.8],build_bench:[1,87]
};
test('recipe levels and XP match the closest OSRS action',()=>{
 for(const [id,[level,xp]]of Object.entries(OSRS)){assert.ok(r[id],id);assert.equal(r[id].level,level,id+' level');assert.equal(r[id].xp,xp,id+' xp')}
 // Smithing items pay OSRS iron rates: 25 XP per bar.
 for(const [id,x]of Object.entries(r))if(id.startsWith('forge_')&&x.inputs.ironBar&&Object.keys(x.outputs)[0].includes(':'))assert.equal(x.xp,25*x.inputs.ironBar,id);
 assert.deepEqual(r.plant_herbs.crop.xp,13);assert.equal(r.plant_wheat.crop.xp,9);
 assert.deepEqual(r.air_runes.outputs,{airRune:1});assert.deepEqual(r.fire_runes.outputs,{fireRune:1});
});
test('success models: mining per swing, iron smelting 50%, stalls never fail',()=>{
 for(const [ore,[low,high]]of Object.entries(miningChance)){const x=r['mine_'+ore];assert.equal(x.chanceLow,low);assert.equal(x.chanceHigh,high);assert.equal(x.failText,'')}
 assert.ok(Math.abs(skillingChance(100,350,1)-.395)<.01,'copper at level 1');assert.equal(skillingChance(100,350,99),1);
 assert.equal(r.smelt_ironBar.chance,.5);assert.match(r.smelt_ironBar.failText,/impure/);assert.equal(r.steal_stall.chance,1);
 for(const x of Object.values(r))if(x.burnChance){assert.ok(x.stopBurn>x.level);assert.equal(burnChance(x,x.stopBurn),0)}
});
test('db/osrs-skill-parity.sql: generated recipes are current, fish table mirrors food.js, no blocked words',()=>{
 assert.equal(build(sql),sql,'run node scripts/build-osrs-skill-parity.mjs');
 const fish=JSON.parse(sql.match(/fish_table\(\) returns jsonb[\s\S]*?select '(\[[^']+\])'::jsonb/)[1]);assert.deepEqual(fish,fishTable);
 assert.doesNotMatch(sql,/\b(delete|alter|drop)\b/i);
 assert.match(sql,/tree_log_xp_osrs[\s\S]*?'oakLogs' then 37\.5 when 'willowLogs' then 67\.5 when 'mapleLogs' then 100 when 'yewLogs' then 175 else 25/);
 // Being hit no longer trains Hitpoints; combat XP keeps the 1.33 share and Wind Strike base.
 assert.match(sql,/\$o\$,skills=skills\|\|jsonb_build_object\('hitpointsXP',least\(200000000,coalesce\(\(skills->>'hitpointsXP'\)::numeric,0\)\+damage\)\)\$o\$,''/);
 assert.match(sql,/share:=round\(1\.33\*d,2\)/);assert.match(sql,/coalesce\(\(w->>'spellXp'\)::numeric,5\.5\)/);
 // Patch blocks guard on an anchor the patch removes, so a second run is a no-op.
 for(const m of sql.matchAll(/if position\(\$o\$([\s\S]*?)\$o\$ in def\)>0 then\s+perform eldervale_private\.patch_function\('[^']+'::regprocedure,array\[([\s\S]*?)\]\);/g)){const news=[...m[2].matchAll(/\$n\$([\s\S]*?)\$n\$/g)].map(x=>x[1]).join('\n');assert.ok(!news.includes(m[1]),'guard anchor survives its patch: '+m[1].slice(0,60))}
});
test('combat XP only comes from damage dealt (the server copy matches combatXp)',()=>{
 assert.deepEqual(combatXp({damage:2,style:'stab'}),{attackXP:8,hitpointsXP:2.66});
 assert.deepEqual(combatXp({damage:7,style:'slash'}),{strengthXP:28,hitpointsXP:9.31});
});
test('tutorial XP objectives stay reachable with OSRS XP',()=>{
 const xpGoals=tutorialQuests.flatMap(q=>q.objectives.filter(o=>o.type==='xp').map(o=>[o.skill,o.amount]));
 const oneAction={attack:combatXp({damage:2,style:'stab'}).attackXP,strength:combatXp({damage:2,style:'slash'}).strengthXP,defence:combatXp({damage:3,style:'lunge'}).defenceXP,firemaking:r.burn_wood.xp,cooking:r.cook_shrimp.xp,smithing:r.smelt_bronzeBar.xp};
 for(const [skill,amount]of xpGoals)assert.ok(Math.floor(oneAction[skill])>=amount,skill+' '+amount+' from one action: '+oneAction[skill]);
 assert.equal(r.forge_nails.level,1,'tutorial nails need Smithing 1');
});
test('fractional XP survives save mapping, and XP drops show the exact gain',()=>{
 const state=fromPlayerRow({skills:{smithingXP:6.25,attackXP:2.66},stats:{miningXP:17.5,woodXP:37.5},inventory:{},equipment:{}});
 assert.equal(state.smithingXP,6.25);assert.equal(state.miningXP,17.5);assert.equal(state.woodXP,37.5);
 const row=toPlayerRow(state,{id:'u'});assert.equal(row.skills.smithingXP,6.25);assert.equal(row.stats.miningXP,17.5);
 assert.deepEqual(xpDelta({miningXP:0,smithingXP:6.25},{miningXP:17.5,smithingXP:12.5}).map(d=>[d.key,d.gain]),[['miningXP',17.5],['smithingXP',6.25]]);
 assert.equal(skillLevel(82.99),1);assert.equal(skillLevel(83),2);
});
