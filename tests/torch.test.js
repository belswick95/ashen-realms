import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import * as T from 'three';
import {shieldCatalog,makeShield,isTorch} from '../shields.js';import {goods} from '../economy.js';import {publicCharacter,buildCharacterDisplay} from '../character-display.js';
import {attachShield} from '../equipment-pose.js';import {professionRecipes} from '../profession-data.js';import {makeDroppedItemModel} from '../item-models.js';
// Same module instance as shields.js (its import carries the cache key), so the live-torch registry is shared.
import {makeTorch,createTorchLights,torchDarkness,torchIntensity,torchFlicker,liveTorches,TORCH_LIGHT,TORCH_LIGHT_COUNT,TORCH_MOUNT_OFFSET} from '../torch.js?v=release-20261107-polish150';
import {lightingAt} from '../world-lighting.js';
import {createHorseMount,keptWhileMounted} from '../horse-mount.js';
const MOTIONS={idle:{},walk:{distance:3.2/60,speed:3.2,locomotion:'walk'},run:{distance:6.4/60,speed:6.4,locomotion:'run'}};
const sql=readFileSync(new URL('../db/torch.sql',import.meta.url),'utf8');
const flameOf=torch=>{let f=null;torch.traverse(o=>{if(o.name==='torch-flame-outer')f=o});return f};

test('the torch is an off-hand (shield slot) item with no combat bonuses, sold cheaply',()=>{
 const t=shieldCatalog.torch;assert.ok(t&&t.torch&&isTorch('torch'));assert.equal(t.kind,'shield');assert.equal(t.defence,0);
 assert.ok(Object.values(t.bonuses).every(v=>v===0));assert.deepEqual(t.req,{});assert.ok(t.buy<=10&&t.sell<t.buy);
 const g=goods['shield:torch'];assert.equal(g.field,'shieldsOwned');assert.equal(g.key,'torch');assert.match(g.icon,/item-shield_torch\.webp/);
 assert.ok(!isTorch('kite'));
});
test('the torch model: wooden handle through the fist, wrapped head, flame, glow and embers above',()=>{
 const g=makeShield(T,'torch');assert.ok(g.userData.torch);const names=new Set();let meshes=0;g.traverse(o=>{names.add(o.name);if(o.isMesh)meshes++});
 for(const n of ['torch-handle','torch-wrap','torch-flame-outer','torch-flame-inner','torch-glow','torch-embers'])assert.ok(names.has(n),n);assert.ok(meshes>=5);
 // The shield mount is unchanged; the torch steps back by the mount offset so the handle sits in the fist.
 const hand=new T.Group(),model=attachShield({leftHand:hand},g);assert.deepEqual(model.position.toArray(),[0,0,.04]);
 hand.updateMatrixWorld(true);const handle=g.getObjectByName('torch-handle').getWorldPosition(new T.Vector3());assert.ok(Math.abs(handle.z)<1e-6&&Math.abs(handle.x)<1e-6);assert.equal(TORCH_MOUNT_OFFSET,.04);
 const flame=g.userData.flame.getWorldPosition(new T.Vector3());assert.ok(flame.y>.45,'flame above the head');
 // The flame animates when drawn and reports the torch as live for the light pool.
 const scene=new T.Scene();scene.add(hand);scene.updateMatrixWorld(true);const outer=flameOf(g);const before=outer.scale.y;outer.onBeforeRender(null,scene);
 assert.ok(liveTorches(scene).includes(g));assert.ok(Math.abs(outer.scale.y-before)>1e-6||outer.scale.y>0);
 const unlit=makeTorch(T,{lit:false});assert.equal(unlit.userData.flame,undefined);
});
test('a dropped torch is put out, an inventory torch is lit',()=>{const drop=makeDroppedItemModel(T,'shield:torch');let flames=0,lit=0;drop.traverse(o=>{if(o.userData.torchFlame){flames++;if(o.visible)lit++}});assert.equal(flames,1);assert.equal(lit,0)});
test('two-handed weapons block the torch like a shield; one-handed weapons do not',()=>{
 assert.equal(publicCharacter({},{weapon:'longsword',shield:'torch'}).loadout.shield,'torch');assert.equal(publicCharacter({},{weapon:'twohand',shield:'torch'}).loadout.shield,null);
 assert.equal(publicCharacter({},{shield:'torch'}).loadout.shield,'torch');
});
test('the torch is held raised ahead in the off hand, flame up, idle, walking and running',()=>{
 for(const [name,motion] of Object.entries(MOTIONS)){const d=buildCharacterDisplay(T,new T.Group(),{},{weapon:'longsword',shield:'torch'});for(let i=0;i<60;i++)d.update(1/60,motion);d.visual.updateMatrixWorld(true);
  const torch=d.rig.leftHand.children.find(o=>o.userData.torch);assert.ok(torch,name);const up=new T.Vector3(0,1,0).transformDirection(torch.matrixWorld);
  const hand=d.rig.leftHand.getWorldPosition(new T.Vector3()),flame=torch.userData.flame.getWorldPosition(new T.Vector3()),shoulder=d.rig.bones.upperarm_l.getWorldPosition(new T.Vector3()),hip=d.rig.bones.thigh_l?.getWorldPosition(new T.Vector3());
  assert.ok(up.y>.75,name+' handle points up ('+up.y.toFixed(2)+')');assert.ok(flame.y>hand.y+.35,name+' flame above the fist');
  assert.ok(hand.z>shoulder.z+.12,name+' fist ahead of the shoulder');assert.ok(hand.x>0,name+' on the left side');
  if(hip)assert.ok(hand.y>hip.y+.2,name+' raised above the hip');assert.ok(flame.y<shoulder.y+.6,name+' not overhead');
  d.dispose()}
});
test('darkness and brightness follow the day/night lantern factor; caves are fully dark',()=>{
 assert.equal(torchDarkness(1),0);assert.equal(torchDarkness(0),1);assert.equal(torchDarkness(1,true),1);assert.equal(torchDarkness(.4),lightingAt(.4).lantern);
 assert.ok(torchIntensity(0)<2,'subtle by day');assert.ok(torchIntensity(1,true)>=8*torchIntensity(0),'bright in caves');assert.ok(torchIntensity(1)>torchIntensity(1,true),'outdoor night competes with the sky fill');assert.ok(torchIntensity(1)>=8*torchIntensity(0),'bright at night');assert.ok(torchIntensity(.3)<torchIntensity(.7));
 assert.ok(TORCH_LIGHT.distance>=8*1.58&&TORCH_LIGHT.distance<=12*1.58,'8-12 tiles of range');
 for(let t=0;t<20;t+=.013){const f=torchFlicker(t,3);assert.ok(f>.78&&f<1.16)}
});
test('the torch light pool has a fixed size: the local torch first, then the nearest others, never more lights',()=>{
 const scene=new T.Scene(),pool=createTorchLights(T,scene),count=()=>{let n=0;scene.traverse(o=>{if(o.isPointLight)n++});return n};
 assert.equal(count(),TORCH_LIGHT_COUNT);assert.ok(TORCH_LIGHT_COUNT>=3&&TORCH_LIGHT_COUNT<=4);pool.update({darkness:1});assert.ok(pool.lights.every(l=>l.intensity===0));
 const holder=(x)=>{const g=new T.Group();g.position.set(x,1,0);const t=makeTorch(T);g.add(t);scene.add(g);return t};
 const local=holder(0),others=[holder(30),holder(3),holder(8),holder(5),holder(12)];scene.updateMatrixWorld(true);
 for(const t of others)flameOf(t).onBeforeRender(null,scene);
 const focus=new T.Vector3(0,0,0);pool.update({local,focus,darkness:1});assert.equal(count(),TORCH_LIGHT_COUNT);
 assert.equal(pool.assigned[0],local);assert.deepEqual(pool.assigned.slice(1),[others[1],others[3]].slice(0,TORCH_LIGHT_COUNT-1));
 assert.ok(pool.lights[0].intensity>TORCH_LIGHT.night*.7);assert.ok(Math.abs(pool.lights[0].position.x)<.2&&pool.lights[0].position.y>1.3);
 pool.update({local,focus,darkness:0});assert.ok(pool.lights[0].intensity<2,'subtle in daylight');
 // Out of the scene or hidden: no light (fades to zero), still the same number of lights.
 local.visible=false;for(let i=0;i<60;i++)pool.update({local,focus,darkness:1,dt:1/30});assert.ok(!pool.assigned.includes(local));assert.equal(count(),TORCH_LIGHT_COUNT);
 pool.setBudget(2);assert.equal(pool.lights.filter(l=>l.visible).length,2);pool.update({focus,darkness:1});assert.ok(pool.assigned.length<=2);
});
test('a torch can be made from logs and linen with a firelighter, at a low Firemaking level',()=>{
 const r=professionRecipes.make_torch;assert.equal(r.skill,'firemaking');assert.ok(r.level<=10);assert.deepEqual(r.outputs,{'shield:torch':1});assert.deepEqual(Object.keys(r.inputs).sort(),['linen','wood']);
 for(const k of Object.keys(r.inputs))assert.ok(goods[k],k);assert.deepEqual(r.tools,['firelighter']);
});
test('db/torch.sql: catalog matches the client, recipe, store stock, idempotent and free of DELETE/ALTER/DROP',()=>{
 for(const w of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+w+'\\b','i').test(sql),'avoids '+w);
 assert.match(sql,/\nbegin;\n[\s\S]*\ncommit;\n$/);assert.match(sql,/'item:shield:torch','\{"name":"Torch","buy":8,"sell":2,"field":"shieldsOwned","key":"torch"/);
 assert.equal(shieldCatalog.torch.buy,8);assert.equal(shieldCatalog.torch.sell,2);
 const recipe=JSON.parse(sql.match(/\('make_torch','(\{[^']+\})'/)[1]),r=professionRecipes.make_torch;for(const k of ['skill','level','xp','inputs','outputs','tools','seconds','kind'])assert.deepEqual(recipe[k],r[k],k);
 assert.match(sql,/on conflict \(id\) do update/);assert.match(sql,/on conflict \(id\) do nothing/);assert.match(sql,/polish_seeds where key='torch-stock:'/);assert.match(sql,/"shield:torch":\{"buy":8,"sell":2,"stock":-1\}/);
});

// Riding: only the torch stays in hand (raised high in the left fist, right fist on both reins);
// real shields and every other held item are put away as before.
const ride=(loadout,frames=40)=>{const parent=new T.Group(),scene=new T.Scene();scene.add(parent);const d=buildCharacterDisplay(T,parent,{},loadout),horse=createHorseMount(T,parent);
 for(let i=0;i<frames;i++){d.update(1/60,{mounted:true});horse.update({active:true,distance:.1,dt:1/60,rig:d.rig,visual:d.visual})}scene.updateMatrixWorld(true);return {d,horse,scene,parent}};
test('only the torch is kept in hand while mounted',()=>{
 assert.equal(keptWhileMounted(makeShield(T,'torch')),true);
 for(const key of Object.keys(shieldCatalog).filter(k=>!isTorch(k)))assert.equal(keptWhileMounted(makeShield(T,key)),false,key);
 assert.equal(keptWhileMounted(null),false);assert.equal(keptWhileMounted(new T.Group()),false);
 const lit=ride({weapon:'longsword',shield:'torch'}),torch=lit.d.rig.leftHand.children.find(o=>o.userData.torch),sword=lit.d.rig.rightHand.children.find(o=>o.userData.weaponMount);
 assert.equal(torch.visible,true,'torch stays in hand');assert.equal(torch.userData.flame.visible,true,'and stays lit');assert.equal(sword.visible,false,'the weapon is still put away');
 const kite=ride({weapon:'longsword',shield:'kite'}),shield=kite.d.rig.leftHand.children.find(o=>o.userData.shieldMount);assert.equal(shield.visible,false,'a real shield is put away');
 kite.horse.update({active:false,rig:kite.d.rig,visual:kite.d.visual});assert.equal(shield.visible,true,'and comes back on dismount');
 lit.horse.dispose();kite.horse.dispose();
});
test('a mounted torch is raised high in the left hand, the right fist holds both reins, and it still gets a light',()=>{
 const {d,horse,scene,parent}=ride({shield:'torch'}),W=o=>o.getWorldPosition(new T.Vector3());
 const torch=d.rig.leftHand.children.find(o=>o.userData.torch),up=new T.Vector3(0,1,0).transformDirection(torch.matrixWorld);
 const left=W(d.rig.leftHand),right=W(d.rig.rightHand),shoulder=W(d.rig.bones.upperarm_l),flame=W(torch.userData.flame),pelvis=W(d.rig.bones.pelvis);
 assert.ok(up.y>.8,'handle upright ('+up.y.toFixed(2)+')');assert.ok(left.y>shoulder.y+.2,'torch fist raised above the shoulder');assert.ok(left.x>shoulder.x-.05,'on the left side');
 assert.ok(flame.y>left.y+.35,'flame above the fist');assert.ok(right.z>pelvis.z+.25&&right.y>pelvis.y&&right.y<shoulder.y,'right fist low in front on the reins');
 const ends=horse.root.children.flatMap(o=>o.children||[]).filter(m=>m.isMesh&&m.geometry.type==='CylinderGeometry');assert.equal(ends.length,4);
 for(const i of [0,1]){const tip=new T.Vector3(0,0,1).applyMatrix4(ends[i*2+1].matrixWorld);assert.ok(tip.distanceTo(right)<.06,'rein '+i+' ends in the right fist: '+tip.distanceTo(right).toFixed(3))}
 const pool=createTorchLights(T,scene);flameOf(torch).onBeforeRender(null,scene);pool.update({local:torch,focus:parent.position,darkness:1});
 assert.equal(pool.assigned[0],torch);assert.ok(pool.lights[0].intensity>TORCH_LIGHT.night*.7);assert.ok(pool.lights[0].position.distanceTo(flame)<.4,'light at the raised flame');
 pool.dispose();horse.dispose();
});
