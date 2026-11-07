import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {execFileSync} from 'node:child_process';
import {initializeGeography,roadPoints,segmentDistance} from '../geography.js?v=release-20261107-portrait145';
import {makeWorldPlan} from '../procedural-world.js?v=release-20261107-portrait145';
import {createLandscape} from '../landscape.js?v=release-20261107-portrait145';
import {musicRegion} from '../audio-regions.js?v=release-20261107-portrait145';
import {capital,capitalBlueprint,capitalBuildings,capitalShops,marketStalls,capitalStreets,capitalActive,inCapital,insideWalls,inCapitalClearing,wallDistance,local,CAPITAL_BLUEPRINT} from '../capital-layout.js?v=release-20261107-portrait145';
import {checkLayout} from './helpers/capital-check.js';
import {walkModel,gridReach} from './helpers/capital-walk.js';

const manifest=JSON.parse(fs.readFileSync(new URL('../db/generated-world.json',import.meta.url)));
initializeGeography(manifest.config);
const fixture=JSON.parse(fs.readFileSync(new URL('./fixtures/birchford-existing.json',import.meta.url)));
const existing=fixture.objects.filter(o=>!fixture.retired.includes(o.id));
const catalog=new Set(JSON.parse(fs.readFileSync(new URL('./fixtures/catalog-item-ids.json',import.meta.url))).items);
const rows=capitalBlueprint();

test('the capital plan applies to the live seed around the original Birchford square',()=>{
 assert.equal(capitalActive(),true);
 const town=makeWorldPlan(manifest.config.seed).towns[0];assert.equal(town.name,capital.name);assert.deepEqual([town.x,town.z],[capital.square.x,capital.square.z]);
 assert.equal(capitalActive({towns:[{x:10,z:10}]}),false);
});

test('layout: no overlapping footprints, nothing on the streets, clear of the walls, every routine leg walkable',()=>{
 const {problems}=checkLayout(existing);assert.deepEqual(problems,[]);
 const keys=rows.map(r=>r.blueprintKey);assert.equal(new Set(keys).size,keys.length,'blueprint keys are unique');
 for(const r of rows){assert.equal(r.blueprint,CAPITAL_BLUEPRINT);assert.ok(Number.isFinite(r.x)&&Number.isFinite(r.z));
  if(!['castle_wall','castle_tower','castle_gate'].includes(r.template)&&r.blueprintKey!=='farm-lane')assert.ok(insideWalls(r.x,r.z),`${r.name} ${r.blueprintKey} is inside the walls`)}
 // Every original Birchford building stays inside the new walls; the farm stays outside.
 for(const o of existing.filter(o=>['cottage','bank','inn','forge'].includes(o.template)))assert.ok(inCapital(o.x,o.z,-8),o.name);
 for(const o of existing.filter(o=>o.template==='fence'||o.template==='farm_hut'))assert.ok(wallDistance(o.x,o.z)>8,'farm stays outside the walls');
});

test('gates sit on the main roads and stand open',()=>{
 const plan=makeWorldPlan(manifest.config.seed);
 const gates=rows.filter(r=>r.template==='castle_gate');assert.equal(gates.length,capital.gates.length);assert.ok(gates.length>=3&&gates.length<=4);
 for(const g of capital.gates){
  const roads=g.key==='west'?[capitalStreets.find(s=>s.key==='west-way').points]:plan.roads.map(([a,b])=>roadPoints(a,b));
  const d=Math.min(...roads.map(line=>Math.min(...line.slice(1).map((p,i)=>segmentDistance(g.x,g.z,line[i],p)))));
  assert.ok(d<.6,`${g.name} is on ${g.road} (${d.toFixed(2)} m)`);
  // The gate entity is aligned with its wall edge and held open (castle_gate).
  const row=gates.find(r=>r.blueprintKey==='gate-'+g.key);assert.ok(row.length>=12);
 }
 // The seeded roads to the castle, Winterwatch and Emberspire each pass through a gate.
 for(const [a,b]of plan.roads.filter(([a])=>a[0]===capital.square.x&&a[1]===capital.square.z)){const line=roadPoints(a,b);assert.ok(capital.gates.some(g=>line.some(p=>Math.hypot(p[0]-g.x,p[1]-g.z)<14)),'road '+b+' has a gate')}
});

test('every shop has a shopkeeper inside with real catalog stock; banks, temple, guilds and inn are staffed',()=>{
 const merchants=rows.filter(r=>r.template==='merchant');
 for(const [key,shop]of Object.entries(capitalShops)){
  const b=capitalBuildings.find(b=>b.key===key);assert.ok(b,`${key} has a building`);
  const m=merchants.find(r=>r.blueprintKey===key+'-npc');assert.ok(m,`${b.name} has a shopkeeper`);assert.equal(m.name,shop.npc);
  const p=local(b,0,0),a=b.yaw*Math.PI/180,s=1.3*b.scale,tx=((m.x-b.x)*Math.cos(a)-(m.z-b.z)*Math.sin(a))/s,tz=((m.x-b.x)*Math.sin(a)+(m.z-b.z)*Math.cos(a))/s;
  assert.ok(Math.abs(tx)<1.65&&Math.abs(tz)<1.57,`${m.name} stands inside ${b.name} (${p.x},${p.z})`);
  assert.ok(m.shopItems.length>=5);for(const item of m.shopItems)assert.ok(catalog.has(item),`${m.name} sells unknown item ${item}`);
  assert.equal(new Set(m.shopItems).size,m.shopItems.length);
 }
 for(const s of marketStalls){const m=merchants.find(r=>r.blueprintKey==='stall-'+s.key+'-npc');assert.ok(m&&rows.some(r=>r.blueprintKey==='stall-'+s.key));for(const item of m.shopItems)assert.ok(catalog.has(item),item)}
 assert.ok(merchants.length>=16);
 const roles=t=>rows.filter(r=>r.template===t).length;
 assert.equal(roles('banker'),2);assert.equal(rows.filter(r=>r.template==='bank').length,2);
 for(const t of ['healer','smith','innkeeper','furnace','anvil','hearth','altar'])assert.ok(roles(t)>=1,t);
 for(const kind of ['blades','armour','archery','magic','bakery','tailor','tools','apothecary'])assert.ok(capitalShops[kind]);
 // Guards at every gate, patrols with routines, townsfolk with routines.
 for(const g of capital.gates)assert.equal(rows.filter(r=>r.blueprintKey.startsWith('gate-'+g.key+'-warden')).length,g.wardens||2);
 assert.ok(rows.filter(r=>r.template==='guard'&&Array.isArray(r.route)).length>=3);
 assert.ok(rows.filter(r=>r.template==='villager'&&Array.isArray(r.route)).length>=8);
 for(const r of rows.filter(r=>Array.isArray(r.route)))for(const s of r.route){assert.ok(Number.isFinite(s.x)&&Number.isFinite(s.z));assert.ok(insideWalls(s.x,s.z))}
});

test('main streets are walkable from every gate to the square, market, banks, shops and the Keep',()=>{
 const model=walkModel([...existing,...rows]);
 const outside=capital.gates.map(g=>{const n=rows.find(r=>r.blueprintKey==='gate-'+g.key);const a=n.yaw*Math.PI/180;let nx=Math.sin(a),nz=Math.cos(a);if(insideWalls(g.x+nx*6,g.z+nz*6)){nx=-nx;nz=-nz}return {x:g.x+nx*7,z:g.z+nz*7,name:g.name}});
 const goals=[{x:capital.square.x+3.2,z:capital.square.z-3.2,name:'fountain'},{x:-191,z:162.5,name:'market well'},{x:-232,z:177,name:'Keep door'}];
 for(const b of capitalBuildings){const d=local(b,0,2.6);goals.push({...d,name:b.name+' door'})}
 for(const m of rows.filter(r=>['merchant','banker'].includes(r.template)))goals.push({x:m.x,z:m.z,name:m.name});
 const [first,...rest]=outside,res=gridReach(model,first,[...rest,...goals]);
 assert.equal(res.start,true);
 [...rest,...goals].forEach((g,i)=>assert.ok(res.reached[i],`${g.name} reachable from ${first.name}`));
 // Street centrelines themselves are free of obstacles.
 for(const s of capitalStreets)for(let i=1;i<s.points.length;i++){const [ax,az]=s.points[i-1],[bx,bz]=s.points[i],n=Math.ceil(Math.hypot(bx-ax,bz-az)/.5);for(let k=0;k<=n;k++){const x=ax+(bx-ax)*k/n,z=az+(bz-az)*k/n;if(Math.hypot(x-capital.gates[0].x,z-capital.gates[0].z)<.5)continue;assert.equal(model.blocked(x,z),false,`${s.name} blocked at ${x.toFixed(1)},${z.toFixed(1)}`)}}
});

test('the capital counts as one town for music, ambience and the forest clearing, on level ground',()=>{
 // Music: the Grand Market and the Keep are far from the old square but still in Birchford.
 for(const p of [{x:-191,z:166},{x:-232,z:190},{x:-176,z:120},{x:capital.square.x,z:capital.square.z}])assert.equal(musicRegion(p)?.name,'Birchford');
 assert.notEqual(musicRegion({x:-340,z:20})?.name,'Birchford');
 assert.equal(inCapitalClearing(-218,143),true);assert.equal(inCapitalClearing(-300,140),false);
 const land=createLandscape({segments:140,approach:false});
 for(const r of rows.filter(r=>['cottage','bank','inn','forge','castle_gate'].includes(r.template)))assert.ok(Math.abs(land.heightAt(r.x,r.z))<.05,`${r.name} stands on level ground`);
 for(const g of capital.gates)assert.equal(land.canWalk(g.x,g.z),true);
});

test('db/birchford-capital.sql is generated from the plan and avoids destructive keywords',()=>{
 const file=new URL('../db/birchford-capital.sql',import.meta.url),before=fs.readFileSync(file,'utf8');
 execFileSync(process.execPath,[new URL('../scripts/build-capital-seed.mjs',import.meta.url).pathname],{stdio:'pipe'});
 assert.equal(fs.readFileSync(file,'utf8'),before,'re-run node scripts/build-capital-seed.mjs');
 assert.doesNotMatch(before,/\b(drop|alter|delete)\b/i);
 assert.match(before,/realm_catalog/);assert.match(before,/available_at='infinity'/);assert.match(before,/door_held_open/);
});
