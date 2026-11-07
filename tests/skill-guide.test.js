import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {SKILL_PANEL,skillId} from '../skill-list.js';
import {skillGuide,GUIDE_SKILLS,guideSummary} from '../skill-guide-data.js';
import {findMarker} from '../skill-guide.js';
import {goods} from '../economy.js';
import {professionRecipes} from '../profession-data.js';
import {GEAR_TIERS} from '../gear-tiers.js';
import {TREE_TIERS} from '../map-icons.js';
import {WOODCUTTING_TREES,WOODCUTTING_AXES} from '../skill-guide-sql-data.js';
import {parseWoodcuttingSql,moduleSource,SQL_SOURCES} from '../scripts/build-skill-guide-data.mjs';

const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8');
const all=Object.fromEntries(GUIDE_SKILLS.map(s=>[s.id,skillGuide(s.id,{recipes:professionRecipes})]));

test('every skill in the Skills panel has a guide with at least one row',()=>{
 assert.equal(GUIDE_SKILLS.length,SKILL_PANEL.length);
 for(const [,name] of SKILL_PANEL){const g=all[skillId(name)];assert.ok(g,name+' has a guide');assert.ok(g.tabs.length>=1,name+' has a tab');
  assert.ok(g.tabs.reduce((n,t)=>n+t.rows.length,0)>=1,name+' has rows');for(const t of g.tabs)assert.ok(t.rows.length>0,name+' › '+t.label+' is not empty');assert.ok(g.intro&&g.sources.length,name+' explains itself')}
});
test('every row item exists in the catalog; rows without one carry a glyph',()=>{
 for(const g of Object.values(all))for(const t of g.tabs)for(const r of t.rows){
  if(r.item)assert.ok(goods[r.item],g.name+' › '+t.label+': unknown item '+r.item);else assert.ok(r.glyph,g.name+' › '+r.name+' has an icon');
  assert.ok(r.name&&typeof r.name==='string',g.name+': row name');
  for(const s of Object.keys(r.also||{}))assert.ok(GUIDE_SKILLS.some(x=>x.id===s),'also-requirement on a real skill: '+s)}
});
test('levels are whole numbers 1–99, sorted within each tab',()=>{
 for(const g of Object.values(all))for(const t of g.tabs){const lv=t.rows.map(r=>r.level);
  for(const l of lv)assert.ok(Number.isInteger(l)&&l>=1&&l<=99,g.name+' › '+t.label+': level '+l);
  assert.deepEqual(lv,[...lv].sort((a,b)=>a-b),g.name+' › '+t.label+' is sorted')}
});
test('guides use the Eldervale names, never the old RuneScape metals',()=>{
 for(const g of Object.values(all))for(const t of g.tabs)for(const r of t.rows)assert.doesNotMatch(r.name+' '+r.detail,/mithril|adamant|runite/i,g.name+': '+r.name);
 const mining=all.mining.tabs[0].rows.map(r=>r.name);for(const n of ['Moonsilver rocks','Verdite rocks','Tidestone rocks'])assert.ok(mining.includes(n),n);
 const bars=all.smithing.tabs.find(t=>t.id==='bars').rows;assert.ok(bars.some(r=>r.name==='Tidesteel bar'&&/Tidestone ore/.test(r.detail)&&/8 × Coal/.test(r.detail)));
});
test('the requested categories are there',()=>{
 const labels=id=>all[id].tabs.map(t=>t.label);
 for(const t of GEAR_TIERS.filter(t=>t.smith))assert.ok(labels('smithing').includes(t.name),'smithing tab '+t.name);
 assert.equal(labels('smithing')[0],'Bars');
 assert.deepEqual(labels('defence').slice(0,2),['Armour','Shields']);
 assert.ok(labels('cooking').includes('Fish')&&labels('cooking').includes('Meat'));
 assert.ok(labels('ranged').includes('Bows')&&labels('ranged').includes('Arrows')&&labels('magic').includes('Spells')&&labels('prayer').includes('Prayers'));
 const fish=all.cooking.tabs.find(t=>t.id==='fish').rows;assert.ok(fish.every(r=>/heals/.test(r.detail)&&/stops burning at \d+/.test(r.detail)),'cooking rows: heal and stop-burn');
 const lobster=all.fishing.tabs[0].rows.find(r=>r.item==='rawLobster');assert.match(lobster.detail,/Cage · Lobster pot/);assert.equal(lobster.level,40);
});
test('guides follow live recipe edits (owner console)',()=>{
 const edited={...professionRecipes,cook_trout:{...professionRecipes.cook_trout,level:33},cook_salmon:{...professionRecipes.cook_salmon,enabled:false}};
 const g=skillGuide('cooking',{recipes:edited}),rows=g.tabs.flatMap(t=>t.rows);
 assert.equal(rows.find(r=>r.item==='trout').level,33);assert.ok(!rows.some(r=>r.item==='salmon'));
});
test('the woodcutting mirror matches the SQL it is generated from',()=>{
 const parsed=parseWoodcuttingSql(read(SQL_SOURCES.engine),read(SQL_SOURCES.parity));
 assert.deepEqual(WOODCUTTING_TREES,parsed.trees);assert.deepEqual(WOODCUTTING_AXES,parsed.axes);
 assert.equal(read('skill-guide-sql-data.js'),moduleSource(parsed),'run node scripts/build-skill-guide-data.mjs');
 for(const t of WOODCUTTING_TREES)assert.equal(TREE_TIERS[t.log]?.level,t.level,'map-icons tree tier level '+t.log);
 for(const a of WOODCUTTING_AXES)assert.ok(goods['weapon:'+a.weapon],a.weapon);
 assert.deepEqual(all.woodcutting.tabs[0].rows.map(r=>r.level),WOODCUTTING_TREES.map(t=>t.level));
});
test('"Where" picks the nearest matching map marker and skips gracefully',()=>{
 const markers=[{cat:'mining',x:100,z:0,name:'Far coal mine',tierNames:['coal']},{cat:'mining',x:5,z:0,name:'Copper & tin mine',tierNames:['copper','tin']},{cat:'mining',x:10,z:0,name:'Near coal mine',tierNames:['coal','iron']},
  {cat:'fishing',x:0,z:3,name:'Saltglass Bay fishing',members:[{tier:'cage'}]},{cat:'agility',x:2,z:2,name:'Heron Brook log',names:['Heron Brook log']}];
 assert.equal(findMarker({cat:'mining',tier:'coal'},markers,{x:0,z:0}).name,'Near coal mine');
 assert.equal(findMarker({cat:'fishing',tiers:['cage','legacy']},markers,{x:0,z:0}).name,'Saltglass Bay fishing');
 assert.equal(findMarker({cat:'agility',name:'Heron Brook log'},markers).name,'Heron Brook log');
 assert.equal(findMarker({cat:'mining',tier:'runite'},markers),null);assert.equal(findMarker({cat:'furnace'},[]),null);assert.equal(findMarker({cat:'furnace'},undefined),null);
});
test('the Skills panel opens the guide and the owner console lists every guide',()=>{
 const game=read('game.js');assert.match(game,/const skillDefinitions=SKILL_PANEL/);assert.match(game,/skillGuide\.open\(skillId\(name\)\)/);assert.match(game,/window\.eldervaleSkillGuide=skillGuide/);
 const panel=read('admin-panel.js');assert.match(panel,/createSkillGuideTab\(ctx\)/);assert.match(panel,/'Skill guides'/);
 assert.equal(guideSummary({recipes:professionRecipes}).length,SKILL_PANEL.length);
});
