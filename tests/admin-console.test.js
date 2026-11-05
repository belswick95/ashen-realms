import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {bestiary,bestiaryEntity,bundleEntities,farmBundles,transformGroup,rotateOffset,wrapYaw,spawnCatalog,searchCatalog,catalogEntity,consoleCategories,buildingCatalog,buildingEntity,normalizeLoot,normalizePatrol,behaviorPatch,lootSummary,aheadOf,ringPositions,mergePlayers,matchesQuery,templateCategory} from '../bestiary.js';
import {worldTemplates,validateEntity} from '../world-templates.js';
import {actorModel,objectModel} from '../world-models.js';
import {farmObjectIds,farmAnimalSpecies} from '../farm-models.js';
import {npcAppearance,OUTFIT_FAMILIES} from '../npc-looks.js';
import {campObstacleSizes} from '../navigation-obstacles.js';
import fs from 'node:fs';
const goods={rawMeat:{name:'Raw game meat'},hide:{name:'Animal hide'},'weapon:dagger':{name:'Iron dagger',field:'weaponsOwned'},noteA:{name:'Note',noteOf:'rawMeat'}};

test('every bestiary creature is a valid entity with a sane loot table and rewards',()=>{
 for(const [key,b] of Object.entries(bestiary)){const e=bestiaryEntity(key,5,6);assert.equal(validateEntity(e),e);assert.ok(worldTemplates[b.template],key);assert.ok(e.level>=1&&e.level<=100,key);assert.ok(e.xpReward>=0&&e.xpReward<=100000);assert.ok(e.goldReward>=0);assert.doesNotThrow(()=>normalizeLoot(e.loot),key);assert.ok(e.loot.length<=8)}
 const a=bestiaryEntity('ember_dragon',0,0),b=bestiaryEntity('ember_dragon',0,0);a.loot[0].min=99;assert.equal(b.loot[0].min,bestiary.ember_dragon.loot[0].min,'entities never share loot arrays');
 for(const id of ['zombie','orc','cow','chicken','sheep','pig'])assert.equal(worldTemplates[id].kind,'monster');
 for(const id of farmAnimalSpecies)assert.equal(worldTemplates[id].hostile,false,'livestock is peaceful');
});

test('new creatures and farm props build, animate and dispose',()=>{
 for(const id of ['zombie','orc',...farmAnimalSpecies]){const root=new T.Group(),m=actorModel(T,root,{...worldTemplates[id],template:id});for(let i=0;i<5;i++)m.update(1/30,{distance:i%2?.05:0,attack:i===2?.3:0,hit:0,block:0});root.updateMatrixWorld(true);const box=new T.Box3().setFromObject(root);assert.ok(box.max.y>.3&&box.max.y<4,id+' height '+box.max.y);m.dispose?.()}
 for(const id of farmObjectIds){const root=new T.Group(),g=objectModel(T,root,id,{});assert.ok(g.children.length>2,id);const box=new T.Box3().setFromObject(root);assert.ok(box.min.y>-0.05,id+' sits on the ground');assert.ok(campObstacleSizes[id],id+' has a collision footprint');g.userData.dispose?.()}
});

test('client collision footprints for farm props match the server can_step patch',()=>{
 const sql=fs.readFileSync(new URL('../db/admin-console.sql',import.meta.url),'utf8'),json=JSON.parse('{'+sql.match(/"campfire":\[0\.65,0\.65\],(.*?)\}'::jsonb\$a\$\]\);/s)[1]+'}');
 for(const [id,size] of Object.entries(json))assert.deepEqual(campObstacleSizes[id],size,id);
 for(const id of farmObjectIds)if(id!=='chicken_coop'||json[id])assert.ok(json[id],id+' blocks on the server too');
 for(const id of ['zombie','orc','cow','chicken','sheep','pig',...farmObjectIds])assert.match(sql,new RegExp("'"+id+"'"),id+' is whitelisted for spawn');
});

test('farm bundle fits its 16 m plot, keeps livestock inside pens and rotates as a unit',()=>{
 const farm=bundleEntities('farm',100,200,0);assert.ok(farm.length>20&&farm.length<=80);for(const e of farm){assert.equal(validateEntity(e),e);assert.ok(Math.abs(e.x-100)<=8.1&&Math.abs(e.z-200)<=8.1,e.template+' inside plot')}
 const animals=farm.filter(e=>e.kind==='monster');assert.ok(animals.some(e=>e.template==='cow')&&animals.some(e=>e.template==='chicken'));for(const a of animals){assert.ok(a.roam>0&&a.roam<=2,'small pen roam');assert.equal(a.hostile,false)}
 assert.ok(farm.some(e=>e.template==='farm_hut'));assert.ok(farm.filter(e=>e.template==='fence').length>=12);
 const turned=bundleEntities('farm',100,200,90),hut0=farm.find(e=>e.template==='farm_hut'),hut1=turned.find(e=>e.template==='farm_hut');const [rx,rz]=rotateOffset(hut0.x-100,hut0.z-200,90);assert.ok(Math.abs(hut1.x-(100+rx))<.11&&Math.abs(hut1.z-(200+rz))<.11);assert.equal(hut1.yaw,wrapYaw(hut0.yaw+90));
 for(const key of Object.keys(farmBundles))for(const e of bundleEntities(key,0,0,45))assert.equal(validateEntity(e),e);
});

test('rotation matches Three.js yaw and group transforms preserve spacing',()=>{
 const o=new T.Object3D();o.rotation.y=Math.PI/3;const v=new T.Vector3(2,0,1).applyEuler(o.rotation),[x,z]=rotateOffset(2,1,60);assert.ok(Math.abs(v.x-x)<1e-9&&Math.abs(v.z-z)<1e-9);
 const items=[{x:0,z:0,yaw:0},{x:4,z:0,yaw:170}],moved=transformGroup(items,{degrees:90,dx:10,dz:-5});assert.ok(Math.abs(Math.hypot(moved[0].x-moved[1].x,moved[0].z-moved[1].z)-4)<.15);assert.equal(moved[1].yaw,-100);assert.deepEqual([(moved[0].x+moved[1].x)/2,(moved[0].z+moved[1].z)/2],[12,-5]);
 assert.equal(wrapYaw(540),-180);assert.equal(wrapYaw(-190),170);
 const p=aheadOf({x:0,z:0,yaw:90},4);assert.ok(Math.abs(p.x-4)<.01&&Math.abs(p.z)<.01);assert.equal(p.yaw,-90);
 const ring=ringPositions(4,0,0,2);assert.equal(ring.length,4);for(const q of ring)assert.ok(Math.abs(Math.hypot(q.x,q.z)-2)<.1);assert.deepEqual(ringPositions(1,3,4),[{x:3,z:4}]);
});

test('spawn catalog covers every category, searches, and produces valid entities',()=>{
 const list=spawnCatalog(goods);for(const c of consoleCategories)assert.ok(list.some(e=>e.category===c),c);assert.equal(new Set(list.map(e=>e.key)).size,list.length,'unique keys');
 assert.ok(!list.some(e=>e.key==='item:noteA'),'bank notes are not spawnable');
 for(const e of list){const made=catalogEntity(e.key,1,2,goods);assert.ok(made.length>=1);for(const d of made)if(d.kind!=='item')assert.equal(validateEntity(d),d)}
 assert.ok(searchCatalog(list,'dragon').some(e=>e.key==='beast:elder_dragon'));assert.ok(searchCatalog(list,'farm','Farm').some(e=>e.key==='bundle:farm'));assert.equal(searchCatalog(list,'zzzz').length,0);
 for(const id of Object.keys(worldTemplates))assert.ok(templateCategory(id),id);
 const npcs=list.filter(e=>e.category==='NPCs').map(e=>e.template);for(const [id,t] of Object.entries(worldTemplates))if(t.kind==='npc')assert.ok(npcs.includes(id),'NPC '+id+' is spawnable');
});

test('buildings come furnished and unfurnished',()=>{
 const keys=Object.keys(buildingCatalog);assert.ok(keys.some(k=>k.endsWith('_empty'))&&keys.some(k=>k.endsWith('_furnished')));for(const k of keys){const e=buildingEntity(k,0,0);assert.equal(e.furnished,buildingCatalog[k].furnished);assert.ok(['cottage','bank','inn','forge'].includes(e.template))}
});

test('loot, patrol and behaviour validation mirror the server rules',()=>{
 assert.deepEqual(normalizeLoot([{item:'rawMeat',min:'1',max:'3',chance:'.5'}]),[{item:'rawMeat',min:1,max:3,chance:.5}]);
 assert.throws(()=>normalizeLoot([{item:'rawMeat',min:3,max:1,chance:1}]));assert.throws(()=>normalizeLoot([{item:'rawMeat',min:1,max:1,chance:0}]));assert.throws(()=>normalizeLoot(Array(9).fill({item:'rawMeat',min:1,max:1,chance:1})));assert.throws(()=>normalizeLoot([{item:'nope',min:1,max:1,chance:1}],k=>k in goods));
 assert.equal(lootSummary([{item:'rawMeat',min:1,max:2,chance:.5}],goods),'Raw game meat ×1–2 · 50%');assert.equal(lootSummary([],goods),'No item drops');
 assert.deepEqual(behaviorPatch('stationary'),{behavior:'stationary',roam:0,patrol:null});assert.equal(behaviorPatch('wander',{radius:80}).roam,50);
 const p=behaviorPatch('patrol',{patrol:[[0,0],[10,0],[10,10]],home:{x:0,z:0}});assert.equal(p.behavior,'patrol');assert.equal(p.roam,15);assert.deepEqual(p.patrol,[[0,0],[10,0],[10,10]]);
 assert.throws(()=>normalizePatrol([[0,0]]));assert.throws(()=>normalizePatrol([[0,0],[100,0]],{x:0,z:0}));
});

test('player lists merge saved characters with live positions; search matches all words',()=>{
 const merged=mergePlayers([{user_id:'a',character_name:'Zed',level:3},{user_id:'b',character_name:'Amy',level:9,banned_until:'2999-01-01'}],[{userId:'a',name:'Zed',health:5,maxHealth:10,x:1,z:2},{userId:'c',name:'Cat',health:1,maxHealth:1}],Date.parse('2026-11-05'));
 assert.deepEqual(merged.map(p=>p.userId),['c','a','b']);assert.equal(merged[1].x,1);assert.equal(merged[2].banned,true);assert.equal(merged[2].online,false);
 assert.ok(matchesQuery('Grey wolf level 7','wolf 7'));assert.ok(!matchesQuery('Grey wolf','bear'));
});

test('owner look overrides choose outfits and body without breaking role defaults',()=>{
 const base=npcAppearance({role:'guard'},0);assert.ok(base.armed);
 const custom=npcAppearance({role:'guard',look:{outfit:'wizard',outfitVariant:'2',sex:'female',hair:'Buns'}},0);assert.equal(custom.look.sex,'female');assert.equal(custom.look.hair,'Buns');assert.equal(custom.look.beard,'Clean shaven');assert.equal(custom.armed,false);assert.equal(custom.staff,'amethystStaff');assert.ok(Object.keys(custom.equipped).every(k=>k.startsWith('wizard')&&k.endsWith('2')));
 assert.deepEqual(npcAppearance({role:'resident',look:{outfit:'none'}},1).equipped,{});for(const f of Object.keys(OUTFIT_FAMILIES))assert.doesNotThrow(()=>npcAppearance({look:{outfit:f}},2));
});
