// Owner report: while RUNNING, the feet and legs pass through the cape (walking is fine). The Mixamo
// run kicks the trailing heel up behind the knee, ~1 unit behind the hips, where the walking drape
// hangs ~0.45 behind them; the leg capsules (cape.js) stopped at the ankle. Running now flares the
// cape back with the run and adds the feet to the colliders. Measured here on the real skinned leg
// and boot meshes (not the colliders) over full Mixamo run cycles, male and female, plain and armoured.
import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {buildHumanoid} from '../humanoid.js';import {createHumanoidAnimator} from '../animation.js';import {createCape} from '../cape.js';
import {createHorseMount} from '../horse-mount.js';import {WALK_SPEED,RUN_SPEED} from '../click-walk.js';

// The smallest (leg z - cape z) over leg/boot vertices that lie within the cape's outline seen from
// behind (x,y), in body space: below 0 a leg is behind the cloth, i.e. through it.
function clearance(body,rig,cape){
 const p=cape.mesh.geometry.attributes.position,idx=cape.mesh.geometry.index.array,tris=[];
 for(let i=0;i<idx.length;i+=3){const t=[idx[i],idx[i+1],idx[i+2]].map(k=>[p.getX(k),p.getY(k),p.getZ(k)]);if(Math.min(t[0][1],t[1][1],t[2][1])<1.45)tris.push(t)}
 const legs=rig.allMeshes.filter(m=>/legs|feet|boot/i.test(m.name)),v=new T.Vector3();let worst=Infinity;
 for(const m of legs){m.updateMatrixWorld(true);for(let k=0;k<m.geometry.attributes.position.count;k+=2){m.getVertexPosition(k,v);v.applyMatrix4(m.matrixWorld);body.worldToLocal(v);if(v.y>1.45)continue;
  for(const [A,B,C] of tris){const d=(B[1]-C[1])*(A[0]-C[0])+(C[0]-B[0])*(A[1]-C[1]);if(Math.abs(d)<1e-9)continue;
   const l1=((B[1]-C[1])*(v.x-C[0])+(C[0]-B[0])*(v.y-C[1]))/d,l2=((C[1]-A[1])*(v.x-C[0])+(A[0]-C[0])*(v.y-C[1]))/d,l3=1-l1-l2;if(l1<0||l2<0||l3<0)continue;
   worst=Math.min(worst,v.z-(l1*A[2]+l2*B[2]+l3*C[2]))}}}
 return worst;
}
async function dressed(sex,outfit){const body=new T.Group(),rig=buildHumanoid(T,body,{sex});rig.setOutfit(outfit);
 // Armour parts stream in on first use.
 for(let i=0;i<100&&!rig.allMeshes.some(m=>/Knight_(Legs|Feet)/.test(m.name));i++){await new Promise(r=>setTimeout(r,20));rig.setOutfit(outfit)}
 assert.ok(rig.allMeshes.some(m=>/Knight_Legs/.test(m.name)),'armour loaded');return {body,rig}}
function cycle(sex,mode,speed,{frames=150,warm=90,run,dressedRig=null}={}){
 const body=dressedRig?.body||new T.Group(),rig=dressedRig?.rig||buildHumanoid(T,body,{sex});
 const animator=createHumanoidAnimator(rig),cape=createCape(T,body,{rig});let worst=Infinity,hem=[];
 for(let f=0;f<warm+frames;f++){const pose=animator.update(1/60,{distance:speed/60,speed,locomotion:mode});body.updateMatrixWorld(true);
  cape.update(1/60,pose?.blend||0,{run:run??pose?.run});
  if(f>=warm&&f%2===0){worst=Math.min(worst,clearance(body,rig,cape));hem.push(cape.mesh.geometry.attributes.position.getZ(12*13+6))}}
 return {worst,hem,cape};
}

test('running: the legs and feet stay clear of the cape over full Mixamo run cycles (male, female)',()=>{
 // 150 frames at 60 fps cover more than three 0.7 s run cycles.
 for(const sex of ['male','female']){const {worst,hem}=cycle(sex,'jog',RUN_SPEED);
  assert.ok(worst>0,sex+' run: leg-to-cape clearance '+worst.toFixed(3));
  // Flared back, not flapping wildly: the hem stays behind the walking drape and moves smoothly.
  assert.ok(Math.max(...hem)<-.8,sex+' run: the hem flares back ('+Math.max(...hem).toFixed(2)+')');
  for(let i=1;i<hem.length;i++)assert.ok(Math.abs(hem[i]-hem[i-1])<.2,sex+' run: no snapping hem ('+(hem[i]-hem[i-1]).toFixed(2)+')');
 }
});

test('running in armour (greaves and sabatons) keeps the clearance too',async()=>{
 for(const sex of ['male','female']){const r=cycle(sex,'jog',RUN_SPEED,{dressedRig:await dressed(sex,{steelGreaves:true,steelSabatons:true})});assert.ok(r.worst>0,sex+' '+r.worst.toFixed(3))}
});

test('walking keeps the drape exactly as before: the run flare is off',()=>{
 for(const sex of ['male','female']){const a=cycle(sex,'walk',WALK_SPEED,{frames:30}),b=cycle(sex,'walk',WALK_SPEED,{frames:30,run:0});
  assert.equal(a.cape.run,0,'no run flare while walking');assert.deepEqual(a.hem,b.hem,sex+': identical to the plain walk drape')}
});

test('mounted: the run flare never applies (the cape lies over the horse as before)',()=>{
 const parent=new T.Group(),body=new T.Group();parent.add(body);const rig=buildHumanoid(T,body),horse=createHorseMount(T,parent),cape=createCape(T,body,{rig});
 for(let f=0;f<40;f++){horse.update({active:true,distance:.13,dt:1/60,rig,visual:body});cape.update(1/60,1,{mounted:true,mountRoot:horse.root,run:1});assert.equal(cape.run,0)}
 // The hem is folded up over the horse's back, well above the walking hem.
 assert.ok(cape.mesh.geometry.attributes.position.getY(12*13+6)>.9,'folded over the horse');horse.dispose();
});
