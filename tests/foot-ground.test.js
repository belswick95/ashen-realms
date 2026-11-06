import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {readFileSync} from 'node:fs';
import {buildHumanoid} from '../humanoid.js';import {createHumanoidAnimator} from '../animation.js';
import {plantFeet,footShift,FOOT_SHIFT_LIMIT} from '../foot-ground.js';

// QA (owner report, terrain111): on slopes groundFeet only lifted the body, so the uphill boot sank into the
// ground (or, lifted for it, the downhill boot floated). plantFeet lowers the pelvis to the lower foot and
// bends the other leg so that boot stands on the slope.
const v=new T.Vector3();
function standing({yaw=0}={}){const root=new T.Group(),visual=new T.Group();root.add(visual);root.rotation.y=yaw;
 const rig=buildHumanoid(T,visual,{sex:'male'}),a=createHumanoidAnimator(rig);a.update(1/30,{distance:0,speed:0});root.updateMatrixWorld(true);return {root,visual,rig,a}}
const soleGap=(rig,side,ground)=>{rig[side+'Ankle'].getWorldPosition(v);return v.y-rig.footHeight-ground(v.x,v.z)};// <0: sunk
const ankleSide=(rig,side)=>rig[side+'Ankle'].getWorldPosition(new T.Vector3()).x;

test('pelvis shift follows the lower planted foot and stays within limits',()=>{
 assert.equal(footShift({left:.1,right:-.05}),-.05);
 assert.equal(footShift({left:.2,right:.1}),.1,'both sunk (a rise): lift like before');
 assert.equal(footShift({left:-.9,right:-.8}),-FOOT_SHIFT_LIMIT);
 assert.equal(footShift({left:.1,right:-.2},{left:true,right:false}),.1,'only planted feet count');
 assert.equal(footShift({left:NaN,right:NaN}),0);
});

test('on a side slope both boots stand on the ground: no sinking uphill, no floating downhill',()=>{
 for(const yaw of [0,Math.PI/2,Math.PI*.8]){
  const {visual,rig}=standing({yaw});
  const lx=ankleSide(rig,'left'),rx=ankleSide(rig,'right');
  // ground rises across the stance: 0.25 per unit (a 14 degree bank), level under the root.
  const dir=Math.abs(lx-rx)>.05?Math.sign(lx-rx):1,slope=(x,z)=>.25*dir*(Math.abs(lx-rx)>.05?x:z);
  // Before: lift-only grounding leaves the downhill boot floating by the whole height difference.
  let lift=0;for(const s of ['left','right'])lift=Math.max(lift,-soleGap(rig,s,slope));
  const before=['left','right'].map(s=>soleGap(rig,s,slope)+lift);
  assert.ok(Math.max(...before)>.015,'lift-only leaves a foot floating ('+before.map(n=>n.toFixed(3))+')');
  plantFeet(T,rig,visual,slope,null);visual.updateWorldMatrix(true,true);
  for(const s of ['left','right']){const g=soleGap(rig,s,slope);assert.ok(Math.abs(g)<.015,`yaw ${yaw.toFixed(2)} ${s} boot within 1.5 cm of the ground (${g.toFixed(3)})`)}
  assert.ok(visual.position.y<lift-.01,'pelvis lower than lift-only grounding (toward the downhill foot)');
 }
});

test('flat ground: unchanged pose, and repeated calls without a new animation pose do not accumulate',()=>{
 const {visual,rig}=standing(),flat=()=>0;
 const q=rig.leftKnee.quaternion.clone();plantFeet(T,rig,visual,flat,null);
 assert.ok(rig.leftKnee.quaternion.angleTo(q)<1e-6,'no IK on flat ground');
 const slope=x=>.25*x;visual.position.y=0;plantFeet(T,rig,visual,slope,null);const once=rig.leftLeg.quaternion.clone(),onceR=rig.rightLeg.quaternion.clone();
 for(let i=0;i<5;i++){visual.position.y=0;plantFeet(T,rig,visual,slope,null)}
 assert.ok(rig.leftLeg.quaternion.angleTo(once)<1e-6&&rig.rightLeg.quaternion.angleTo(onceR)<1e-6,'same result each frame');
});

test('game.js uses plantFeet for clip-driven rigs and gaitTravel/groundFeet do not allocate vectors per frame',()=>{
 const src=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(src,/if\(rig\.clipDriven\)\{plantFeet\(T,rig,visual,groundHeightAt,contacts\);return\}/);
 const ground=src.slice(src.indexOf('function groundFeet('),src.indexOf('function groundFeet(')+1600);
 assert.doesNotMatch(ground,/new T\.Vector3|\.clone\(\)/);
 const gait=src.slice(src.indexOf('function gaitTravel('),src.indexOf('function gaitTravel(')+400);
 assert.doesNotMatch(gait,/new T\.Vector3|\.clone\(\)/);
 const mod=readFileSync(new URL('../foot-ground.js',import.meta.url),'utf8');
 const hot=mod.slice(mod.indexOf('export function plantFeet'));
 assert.doesNotMatch(hot.replace(/remember\(rig,(thigh|calf|foot)\)/g,''),/new T\.|\.clone\(\)/,'plantFeet allocates nothing per frame');
});
