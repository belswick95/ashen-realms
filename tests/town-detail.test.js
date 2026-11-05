import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import fs from 'node:fs';
import {planTownLife} from '../town-routines.js';import {buildingLocal} from '../building-stories.js';
import {townProp} from '../town-props.js';import {detailBuilding} from '../building-detail.js';
const world=JSON.parse(fs.readFileSync(new URL('../db/generated-world.json',import.meta.url)));
const base=world.entities.filter(e=>e.generation!=='town-life-v1');

// Mirrors eldervale_private.can_step for the town obstacles a route can meet.
const SIZES={bench:[1.15,.5],barrel:[.6,.6],crate:[.7,.6],market:[1.35,.95]};
function blocked(x,z,obstacles){for(const o of obstacles){if(['bank','inn','forge','cottage'].includes(o.template)){const p=buildingLocal(o,x,z);if(Math.abs(p.x)<2.17&&Math.abs(p.z)<2.09)return o.template}
  else if(o.template==='fountain'){if(Math.hypot(x-o.x,z-o.z)<2.1)return 'fountain'}
  else if(SIZES[o.template]){const a=(o.yaw||0)*Math.PI/180,dx=(x-o.x)*Math.cos(a)-(z-o.z)*Math.sin(a),dz=(x-o.x)*Math.sin(a)+(z-o.z)*Math.cos(a),[hx,hz]=SIZES[o.template];if(o.template==='barrel'?Math.hypot(dx,dz)<hx+.2:Math.abs(dx)<hx+.2&&Math.abs(dz)<hz+.2)return o.template}}return null}

test('every town routine walks clear of buildings, stalls, the fountain and its own props',()=>{
 for(const town of world.towns){const plan=planTownLife(town,base),obstacles=[...base.filter(e=>Math.hypot(e.x-town.x,e.z-town.z)<45),...plan.props];
  const villagers=base.filter(e=>e.template==='villager'&&Math.hypot(e.x-town.x,e.z-town.z)<30);assert.ok(villagers.length>=4);
  const routes=[...villagers.map((v,i)=>plan.routeFor(v.activity,i)),plan.guardRoute(0),plan.guardRoute(1)];
  for(const route of routes){assert.ok(route.length>2&&route.some(s=>s.act),'a loop with work stations');
   route.forEach((s,i)=>{const n=route[(i+1)%route.length],steps=Math.ceil(Math.hypot(n.x-s.x,n.z-s.z)/.25);for(let k=0;k<=steps;k++){const x=s.x+(n.x-s.x)*k/steps,z=s.z+(n.z-s.z)*k/steps,hit=blocked(x,z,obstacles);assert.equal(hit,null,`${town.name} leg ${i} crosses ${hit} at ${x.toFixed(1)},${z.toFixed(1)}`)}})}
  // Stations face something: benches are behind sitters, flower beds in front of gardeners.
  assert.ok(plan.props.filter(p=>p.template==='bench').length>=3)}
});

test('street furniture is detailed but merged to a few draw calls inside its collision footprint',()=>{
 for(const [id,[hx,hz],limit] of [['bench',[1.15,.5],4],['barrel',[.6,.6],4],['crate',[.7,.6],5],['market',[1.35,.95],22],['lantern',[.4,.3],6],['well',[1.2,1.2],10]]){
  const parent=new T.Group(),g=townProp(T,parent,id,{x:3,z:4});assert.ok(g,id);let meshes=0;g.traverse(o=>{if(o.isMesh)meshes++});assert.ok(meshes<=limit,`${id}: ${meshes} meshes`);
  const box=new T.Box3().setFromObject(g);if(id!=='lantern'){assert.ok(box.max.x<=hx+.25&&-box.min.x<=hx+.25,`${id} width`);assert.ok(box.max.z<=hz+.3&&-box.min.z<=hz+.3,`${id} depth`)}assert.ok(box.max.y>.5)}
 assert.equal(townProp(T,new T.Group(),'tree',{}),null);
});

test('buildings gain framed windows, shutters, a tiled roof and smoke without many extra draw calls',()=>{
 const group=new T.Group(),roofParts=[],cache=new Map();const material=(c,k)=>{const key=c+k;if(!cache.has(key))cache.set(key,new T.MeshStandardMaterial({color:c}));return cache.get(key)};
 const box=(w,h,d,c,x,y,z,p,kind)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),material(c,kind));m.position.set(x,y,z);p.add(m);return m};
 const out=detailBuilding(T,{group,roofParts},{box,material,type:'inn',roof:0x634332});let meshes=0;group.traverse(o=>{if(o.isMesh)meshes++});
 assert.ok(meshes>=8&&meshes<=40,'merged detail: '+meshes);assert.ok(roofParts.some(p=>p.getObjectById(out.roof.id)),'roof detail hides with the roof');assert.ok(out.roof.children.some(o=>o.isPoints),'chimney smoke');
 const stone=detailBuilding(T,{group:new T.Group(),roofParts:[]},{box,material,stone:true,type:'chapel'});assert.ok(!stone.roof.children.some(o=>o.isPoints),'no smoke from the chapel');
});

test('each building has one deterministic material style chosen by role, with a mixed town',async()=>{
 const {buildingStyle}=await import('../building-detail.js');
 for(const type of ['bank','forge','chapel','hall'])assert.equal(buildingStyle({type,x:3,z:9}).material,'stone',type);
 assert.equal(buildingStyle({type:'inn',x:3,z:9}).material,'timber');assert.equal(buildingStyle({type:'barn',x:3,z:9}).material,'plank');
 assert.deepEqual(buildingStyle({type:'cottage',x:12.5,z:-40}),buildingStyle({type:'cottage',x:12.5,z:-40}),'stable per position');
 const kinds=new Set();for(let i=0;i<60;i++)kinds.add(buildingStyle({type:'cottage',x:i*7.3,z:i*-3.1}).material);assert.ok(kinds.size>=2,'cottages vary');
 for(let i=0;i<40;i++){const s=buildingStyle({type:['cottage','inn','bank'][i%3],x:i*5.1,z:i*2.7});assert.ok(s.stone?['slate','tile'].includes(s.roofKind):['thatch','shingle'].includes(s.roofKind),'roof matches walls')}
});

test('facade detail stays on the walls: nothing pokes past the wall plate or far beyond the footprint',()=>{
 const cache=new Map(),material=(c,k)=>{const key=c+k;if(!cache.has(key))cache.set(key,new T.MeshStandardMaterial({color:c}));return cache.get(key)};
 const box=(w,h,d,c,x,y,z,p,kind)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),material(c,kind));m.position.set(x,y,z);p.add(m);return m};
 for(const [type,x] of [['cottage',0],['cottage',4.4],['cottage',9.9],['inn',1],['bank',2],['forge',3],['chapel',4]]){const group=new T.Group();group.position.set(x,0,x*3);
  const out=detailBuilding(T,{group,roofParts:[]},{box,material,type});group.updateMatrixWorld(true);const b=new T.Box3().setFromObject(out.walls);
  assert.ok(b.max.y<3.0,`${type} wall detail stays under the wall plate`);assert.ok(Math.abs(b.min.x-group.position.x)<2.17&&Math.abs(b.max.x-group.position.x)<2.17,`${type} width`);assert.ok(b.min.z-group.position.z>-2.09&&b.max.z-group.position.z<2.4,`${type} depth`);
  const storey=new T.Group();storey.add(new T.Mesh(new T.BoxGeometry(3.76,.085,3.56)));
  // An upper storey keeps its walkable floor box separate from the merged facade.
  const record={group,roofParts:[]};detailBuilding(T,record,{box,material,type});record.dressStorey(storey);let floors=0;storey.traverse(o=>{if(o.isMesh&&o.geometry.type==='BoxGeometry'&&o.geometry.parameters.height===.085)floors++});assert.equal(floors,1)}
});
