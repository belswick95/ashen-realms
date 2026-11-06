import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {buildHumanoid} from '../humanoid.js';import {createHumanoidAnimator} from '../animation.js';import {createHorseMount} from '../horse-mount.js';
import {gaitPlayback,stepRate} from '../gait-cadence.js';import {DOLL_LAYOUT,SILHOUETTES,loadStance,saveStance} from '../equipment-doll.js';
import {characterStore} from '../character-assets.js';
const settle=(a,frames,opts)=>{let pose;for(let i=0;i<frames;i++)pose=a.update(1/60,typeof opts==='function'?opts(i):opts);return pose};

test('cadence rises with speed and jogging never plays in slow motion',()=>{
 const jog=s=>gaitPlayback('Jog_Fwd_Loop',s,{stride:9.9,duration:.933,scale:1.58});
 assert.ok(stepRate('Jog_Fwd_Loop',4)>stepRate('Jog_Fwd_Loop',3));assert.ok(stepRate('Walk_Loop',1.4)>stepRate('Walk_Loop',1));
 assert.ok(jog(6.4).timeScale>1,'quicker steps than the clip');assert.ok(jog(6.4).amplitude<.6,'shorter strides than the clip');
 // Ground covered per second = clip stride speed × cadence × stride amplitude.
 for(const s of [4,6.4,9])assert.ok(Math.abs(9.9*jog(s).timeScale*jog(s).amplitude-s)<1e-6);
});

test('everyone idles relaxed with a weapon; fighting brings the guard up, then it eases back',()=>{
 const r=buildHumanoid(T,new T.Group()),a=createHumanoidAnimator(r);
 assert.equal(settle(a,60,{armed:true}).clip,'Idle_Loop','armed townsfolk and guards stand at ease');
 assert.equal(settle(a,60,{armed:true,combat:true}).clip,'Sword_Idle','in combat');
 assert.equal(settle(a,120,{armed:true}).clip,'Sword_Idle','held briefly after combat');
 assert.equal(settle(a,240,{armed:true}).clip,'Idle_Loop','relaxed again a few seconds later');
 settle(a,3,{armed:true,attack:.5});assert.equal(settle(a,120,{armed:true}).clip,'Sword_Idle','an armed attack raises the guard');
 assert.equal(settle(a,60,{ranged:true,armed:true,combat:true}).clip,'Idle_Loop','archers keep the plain idle');
});

test('mounted riders hold the reins: each rein ends in the rider\'s fist',()=>{
 const parent=new T.Group(),visual=new T.Group();parent.add(visual);const rig=buildHumanoid(T,visual),a=createHumanoidAnimator(rig),horse=createHorseMount(T,parent);
 for(let i=0;i<40;i++){a.update(1/60,{mounted:true});horse.update({active:true,distance:.1,rig,visual})}parent.updateMatrixWorld(true);
 const hands=[rig.leftHand,rig.rightHand].map(h=>h.getWorldPosition(new T.Vector3()));
 const ends=horse.root.children.flatMap(o=>o.children||[]).filter(m=>m.isMesh&&m.geometry.type==='CylinderGeometry');assert.equal(ends.length,4,'two segments per rein');
 for(const [i,hand] of hands.entries()){const seg=ends[i*2+1],tip=new T.Vector3(0,0,1).applyMatrix4(seg.matrixWorld);assert.ok(tip.distanceTo(hand)<.03,'rein '+i+' reaches the hand: '+tip.distanceTo(hand))}
 const pelvis=rig.bones.pelvis.getWorldPosition(new T.Vector3());for(const hand of hands)assert.ok(hand.z>pelvis.z+.25&&hand.y>pelvis.y,'fists in front of the belly');
 horse.dispose();
});

test('paper doll places every body slot once and stance preference persists',()=>{
 const cells=Object.values(DOLL_LAYOUT).map(p=>p.join());assert.equal(new Set(cells).size,cells.length);
 for(const slot of ['helm','cape','amulet','ammo','weapon','chest','shield','legs','arms','boots','trinket'])assert.ok(DOLL_LAYOUT[slot]&&SILHOUETTES[slot],slot);
 const store=new Map(),storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 assert.equal(loadStance(storage),'relaxed');saveStance('combat',storage);assert.equal(loadStance(storage),'combat');saveStance('bogus',storage);assert.equal(loadStance(storage),'relaxed');
 assert.equal(loadStance({getItem(){throw Error('blocked')}}),'relaxed');
});

test('shared character geometry is marked shared so generic disposers leave it alone',()=>{
 for(const group of [characterStore.parts,characterStore.heads,characterStore.hair])for(const scene of Object.values(group))scene.traverse(o=>{if(o.geometry)assert.equal(o.geometry.userData.eldervaleShared,true,o.name)});
});
