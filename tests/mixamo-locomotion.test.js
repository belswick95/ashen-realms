import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';
import {buildHumanoid} from '../humanoid.js';import {createHumanoidAnimator,gaitRate,WALK_CLIP,RUN_CLIP} from '../animation.js';
import {clipsFor,locomotionSpeed,CHARACTER_SCALE} from '../character-assets.js';import {plantFeet} from '../foot-ground.js';
import {makeWeapon,weaponCatalog} from '../weapons.js';import {makeShield} from '../shields.js';import {attachWeapon,attachShield} from '../equipment-pose.js';
import {WALK_SPEED,RUN_SPEED} from '../click-walk.js';

// The owner's Adobe Mixamo walk and run (assets/source/mixamo), baked onto both
// bodies by scripts/build-mixamo-locomotion.mjs into one small runtime asset.
const SEXES=['male','female'],GAITS=[[WALK_CLIP,'walk',WALK_SPEED,31/30],[RUN_CLIP,'jog',RUN_SPEED,21/30]];

test('the baked Mixamo walk and run exist for both bodies, at 30 fps, in a small asset',()=>{
 assert.ok(fs.statSync(new URL('../assets/characters/mixamo-locomotion.glb',import.meta.url)).size<150*1024);
 for(const sex of SEXES){const clips=clipsFor(sex);
  for(const [name,,,duration] of GAITS){const c=clips[name];assert.ok(c,sex+' '+name);assert.ok(Math.abs(c.duration-duration)<1e-3,name+' '+c.duration);
   const names=new Set(c.tracks.map(t=>t.name));for(const b of ['pelvis.position','pelvis.quaternion','thigh_l.quaternion','calf_r.quaternion','foot_l.quaternion','upperarm_r.quaternion','lowerarm_l.quaternion','spine_03.quaternion','Head.quaternion'])assert.ok(names.has(b),name+' '+b);
   for(const t of c.tracks){for(let i=1;i<t.times.length;i++)assert.ok(Math.abs(t.times[i]*30-Math.round(t.times[i]*30))<1e-3,'keys on the 30 fps grid');
    // Closed loop: the last key repeats the first.
    const n=t.getValueSize();if(t.times.length>1)for(let k=0;k<n;k++)assert.ok(Math.abs(t.values[k]-t.values[t.values.length-n+k])<2e-3,t.name+' loops')}}
  // Measured ground speed: a natural walk and a run on these bodies (world units/s at rate 1).
  assert.ok(locomotionSpeed(sex,WALK_CLIP)>2.4&&locomotionSpeed(sex,WALK_CLIP)<3.3,sex+' walk '+locomotionSpeed(sex,WALK_CLIP));
  assert.ok(locomotionSpeed(sex,RUN_CLIP)>6&&locomotionSpeed(sex,RUN_CLIP)<8,sex+' run '+locomotionSpeed(sex,RUN_CLIP));
 }
});

test('the Mixamo clips play exactly as authored: no lean, stride or arm layer on top',()=>{
 for(const sex of SEXES)for(const [name,mode,speed] of GAITS){const r=buildHumanoid(T,new T.Group(),{sex}),a=createHumanoidAnimator(r);
  for(let i=0;i<120;i++)a.update(1/60,{distance:speed/60,speed,locomotion:mode});
  const action=a.mixer.existingAction(clipsFor(sex)[name]);assert.ok(action.getEffectiveWeight()>.999);
  // Sample the clip on a fresh body at the action's time: every bone must match.
  const ref=buildHumanoid(T,new T.Group(),{sex}),m=new T.AnimationMixer(ref.model);m.clipAction(clipsFor(sex)[name]).play();m.setTime(action.time);
  for(const b of ['pelvis','spine_01','spine_03','Head','upperarm_l','lowerarm_r','hand_l','thigh_l','calf_r','foot_l'])assert.ok(r.bones[b].quaternion.clone().normalize().angleTo(ref.bones[b].quaternion.clone().normalize())<2e-3,sex+' '+name+' '+b);// 0.1 deg: int16 key noise only
  assert.ok(r.bones.pelvis.position.distanceTo(ref.bones.pelvis.position)<1e-5);a.dispose()}
});

test('stride matched: at the tile speeds the planted foot stays put (under 5% slip)',()=>{
 for(const sex of SEXES)for(const [name,mode,speed] of GAITS){
  const rate=gaitRate(sex,name,speed);assert.ok(Math.abs(rate*locomotionSpeed(sex,name)-speed)<1e-9);
  const holder=new T.Group(),visual=new T.Group();holder.add(visual);const r=buildHumanoid(T,visual,{sex}),a=createHumanoidAnimator(r),dt=1/60,p=new T.Vector3(),hist=[[],[]];
  for(let i=0;i<360;i++){holder.position.z+=speed*dt;holder.updateMatrixWorld(true);a.update(dt,{distance:speed*dt,speed,locomotion:mode});visual.position.y=0;
   // Grounding as game.js does it (no contacts): on flat ground the authored pose is kept.
   const shift=plantFeet(T,r,visual,()=>0);if(i>120)assert.ok(Math.abs(shift)<1e-6,'no stomp on flat ground '+shift);visual.updateMatrixWorld(true);
   if(i>=180)['ball_l','ball_r'].forEach((b,k)=>{r.bones[b].getWorldPosition(p);hist[k].push(p.clone())})}
  let net=0,time=0,below=Infinity;
  for(const h of hist){const lo=Math.min(...h.map(v=>v.y));below=Math.min(below,lo);let start=null,n=0;
   for(let i=1;i<=h.length;i++){const planted=i<h.length&&h[i].y<lo+.03&&h[i-1].y<lo+.03;if(planted){start??=h[i-1];n++}else if(start){const end=h[i-1];net+=Math.hypot(end.x-start.x,end.z-start.z);time+=n*dt;start=null;n=0}}}
  assert.ok(time>.3,'feet are planted part of the cycle');assert.ok(net/time/speed<.05,`${sex} ${name}: planted foot slips ${(100*net/time/speed).toFixed(1)}%`);
  assert.ok(Math.abs(below)<.02*CHARACTER_SCALE,`${sex} ${name}: feet on the ground (${below.toFixed(3)})`);a.dispose()}
});

test('idle -> walk -> run -> idle cross-fade smoothly',()=>{
 const r=buildHumanoid(T,new T.Group()),a=createHumanoidAnimator(r),p=new T.Vector3();let last=null,worst=0;
 const step=(o)=>{a.update(1/60,o);r.root.updateMatrixWorld(true);const now=r.head.getWorldPosition(p).clone();if(last){const d=now.distanceTo(last);worst=Math.max(worst,d)}last=now};
 for(let i=0;i<60;i++)step({});for(let i=0;i<90;i++)step({distance:WALK_SPEED/60,speed:WALK_SPEED,locomotion:'walk'});
 for(let i=0;i<90;i++)step({distance:RUN_SPEED/60,speed:RUN_SPEED,locomotion:'jog'});for(let i=0;i<90;i++)step({});
 assert.ok(worst<.06,'head moves at most '+worst.toFixed(3)+' per frame');
});

test('weapons in hand stay clear of the head while walking and running',()=>{
 const v=()=>new T.Vector3();
 for(const sex of SEXES)for(const key of ['longsword','battleaxe','warhammer','claymore','spear','longbow','apprenticeStaff'])for(const [,mode,speed] of GAITS){
  const root=new T.Group(),r=buildHumanoid(T,root,{sex}),a=createHumanoidAnimator(r),w=attachWeapon(r,makeWeapon(T,key),key);if(!weaponCatalog[key].twoHanded)attachShield(r,makeShield(T,'kite'));
  let near=Infinity;for(let i=0;i<200;i++){a.update(1/60,{distance:speed/60,speed,locomotion:mode,armed:true,weapon:key});if(i<90||i%3)continue;root.updateMatrixWorld(true);const head=r.head.getWorldPosition(v()).add(v().set(0,.17,.03));
   w.traverse(o=>{if(!o.isMesh)return;const pos=o.geometry.attributes.position,st=Math.max(1,Math.floor(pos.count/80));for(let j=0;j<pos.count;j+=st)near=Math.min(near,v().fromBufferAttribute(pos,j).applyMatrix4(o.matrixWorld).distanceTo(head))})}
  assert.ok(near>.28,`${sex} ${key} ${mode}: ${near.toFixed(3)} from the head`);a.dispose()}
});
