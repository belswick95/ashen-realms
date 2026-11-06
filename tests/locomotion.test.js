import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {buildHumanoid} from '../humanoid.js';import {createHumanoidAnimator} from '../animation.js';
import {TILE,TICK,STEPS_PER_TICK,WALK_REF,RUN_REF,cadence,stepLength,phaseAdvance,createGaitState,advanceGait,blendWeights,legTrack,mixGait} from '../stride-cycle.js';
import {TILE as GAME_TILE,GAME_TICK,WALK_SPEED,RUN_SPEED} from '../click-walk.js';
import {makeWeapon,weaponCatalog} from '../weapons.js';import {makeShield,shieldCatalog} from '../shields.js';import {attachWeapon,attachShield} from '../equipment-pose.js';

// Owner report: "the walking animation and running animation looks goofy".
// Walk and run are a distance-driven cycle (stride-cycle.js) styled after the
// classic tick-based MMO gait: these tests pin the stride to the ground speed,
// the blends, planted feet, and where held weapons and shields go.

const v=()=>new T.Vector3();
// Advance an animator `frames` times while its root walks forward at `speed`,
// grounding the body like game.js groundFeet does (lift only).
function walker({sex='male',weapon=null,shield=null}={}){
 const root=new T.Group(),visual=new T.Group();root.add(visual);const rig=buildHumanoid(T,visual,{sex}),a=createHumanoidAnimator(rig);
 const held={weapon:weapon?attachWeapon(rig,makeWeapon(T,weapon),weapon):null,shield:shield?attachShield(rig,makeShield(T,shield)):null};
 const p=v();let z=0,pose;
 return {rig,a,root,visual,held,step(dt,opts={}){const speed=opts.speed||0;z+=speed*dt;root.position.z=z;pose=a.update(dt,{distance:speed*dt,speed,armed:!!weapon,weapon,...opts});
  visual.position.y=0;root.updateMatrixWorld(true);let lift=0;for(const s of ['left','right']){if(pose.contacts&&!pose.contacts[s])continue;rig[s+'Ankle'].getWorldPosition(p);lift=Math.max(lift,rig.footHeight-p.y)}visual.position.y=Math.min(.3,Math.max(0,lift));root.updateMatrixWorld(true);return pose}};
}

test('stride and cadence are pinned to the tick: walk 5 steps per 4 ticks, run one footfall per tile',()=>{
 assert.equal(TILE,GAME_TILE);assert.equal(TICK,GAME_TICK);
 assert.ok(Math.abs(cadence(0,WALK_REF)*TICK-STEPS_PER_TICK.walk)<1e-9);assert.ok(Math.abs(cadence(1,RUN_REF)*TICK-STEPS_PER_TICK.run)<1e-9);
 assert.ok(Math.abs(stepLength(1,RUN_REF)-TILE)<1e-9,'run: one step per tile');assert.ok(Math.abs(stepLength(0,WALK_REF)-.8*TILE)<1e-9,'walk: 0.8 tile steps');
 // Every speed: steps x step length = ground covered (no skating), longer and quicker as speed rises.
 for(const run of [0,1])for(const speed of [1,1.4,WALK_SPEED,WALK_REF,3.72,RUN_SPEED,RUN_REF,7.45]){
  const L=stepLength(run,speed);if(run===0&&speed>RUN_SPEED)continue;assert.ok(Math.abs(L*cadence(run,speed)-speed)<1e-9,run+' '+speed);
  assert.ok(stepLength(run,speed*1.2)>=L&&cadence(run,speed*1.2)>cadence(run,speed))}
 assert.ok(stepLength(1,RUN_REF)>stepLength(0,WALK_REF),'the run has the longer stride');
 // One cycle is two steps: covering 2 x step advances the phase by exactly one.
 assert.equal(phaseAdvance(2*1.3,1.3),1);assert.equal(phaseAdvance(0,1),0);assert.equal(phaseAdvance(1,0),0);
});

test('a planted foot moves back at exactly the stride rate (heel, then whole foot, then ball)',()=>{
 const foot={ankleY:.137,ballY:.024,ballZ:.224,heelZ:.06,heelY:.137,length:.284};
 for(const run of [0,1]){const g=mixGait(run),step=run?TILE:.8*TILE,o={},h=1e-5;
  for(let u=.01;u<g.stance-.01;u+=.01){const t=u/g.stance,a=legTrack(u,step,g,foot,{}),b=legTrack(u+h,step,g,foot,{});assert.ok(a.stance&&b.stance);
   // Contact point: heel while the toes are up, ball once the heel lifts, either when flat.
   const contact=(p)=>p.toe>1e-9?p.z-(foot.heelZ*Math.cos(p.toe)-foot.heelY*Math.sin(p.toe)):p.toe<-1e-9?p.z+foot.ballZ*Math.cos(p.toe)+(foot.ankleY-foot.ballY)*Math.sin(p.toe):p.z;
   if(t>.19&&t<.54||t<.17||t>.56){const speed=(contact(b)-contact(a))/h;assert.ok(Math.abs(speed+2*step)<1e-3,'run '+run+' u '+u.toFixed(2)+': '+speed)}}
  // The swing lifts the foot and lands it where the stance begins (continuous loop).
  const end=legTrack(.9999,step,g,foot,o).z,start=legTrack(0,step,g,foot,{}).z;assert.ok(Math.abs(end-start)<1e-3);
  let high=0;for(let u=g.stance;u<1;u+=.01)high=Math.max(high,legTrack(u,step,g,foot,{}).y);assert.ok(high>foot.ankleY+g.lift*.8)}
});

test('feet stay planted at tile walk, tile run, diagonal steps and the legacy free-movement speeds',()=>{
 for(const sex of ['male','female'])for(const [mode,speed] of [['walk',WALK_REF],['walk',WALK_SPEED],['walk',WALK_REF*Math.SQRT2],['jog',RUN_REF],['jog',RUN_SPEED],['jog',RUN_REF*Math.SQRT2],['walk',1.4]]){
  const w=walker({sex}),dt=1/60,hist=[[],[]],p=v();for(let i=0;i<120;i++)w.step(dt,{speed,locomotion:mode});
  for(let i=0;i<180;i++){w.step(dt,{speed,locomotion:mode});['ball_l','ball_r'].forEach((n,k)=>{w.rig.bones[n].getWorldPosition(p);hist[k].push(p.clone())});
   for(const s of ['left','right'])assert.ok(w.rig[s+'Ankle'].getWorldPosition(p).y>w.rig.footHeight-.005,'no foot sinks below the ground')}
  // Ball of the foot on the ground (lowest 1.5 cm): it must not skate.
  let slide=0,n=0;for(const h of hist){const low=Math.min(...h.map(q=>q.y));for(let i=1;i<h.length;i++)if(h[i].y<low+.015&&h[i-1].y<low+.015){slide+=Math.hypot(h[i].x-h[i-1].x,h[i].z-h[i-1].z)/dt;n++}}
  assert.ok(n>20,'feet do plant');assert.ok(slide/n<.03*speed,`${sex} ${mode} ${speed.toFixed(2)}: planted foot drifts ${(slide/n).toFixed(3)} u/s`);
 }
});

test('idle, walk and run weights blend continuously and always sum to one',()=>{
 const s=createGaitState(),b={},dt=1/60;let last=blendWeights(s,{});assert.deepEqual(last,{idle:1,walk:0,run:0});
 const check=(label)=>{blendWeights(s,b);assert.ok(Math.abs(b.idle+b.walk+b.run-1)<1e-12,label);for(const k of ['idle','walk','run']){assert.ok(b[k]>=0&&b[k]<=1);assert.ok(Math.abs(b[k]-last[k])<.2,label+' '+k+' no snap')}last={...b}};
 // Start walking: the walk weight rises over several frames.
 let frames=0;while(s.move<.95){advanceGait(s,dt,{moving:true,distance:WALK_REF*dt,speed:WALK_REF});check('start');frames++}assert.ok(frames>=6&&frames<40,'start blend '+frames);
 // Break into a run: the phase keeps counting (no reset) while the stride lengthens.
 let phase=s.phase;frames=0;while(s.run<.95){const step=s.step;advanceGait(s,dt,{moving:true,running:true,distance:RUN_REF*dt,speed:RUN_REF});check('run');
  const gained=((s.phase-phase)%1+1)%1;assert.ok(gained>0&&gained<=RUN_REF*dt/(2*Math.min(step,s.step))+1e-9,'phase continuous');phase=s.phase;frames++}
 assert.ok(frames>=6,'walk to run blend '+frames);assert.ok(Math.abs(s.step-TILE)<.05);
 // Stop: back to idle with no snap, phase frozen.
 phase=s.phase;frames=0;while(b.idle<.999){advanceGait(s,dt,{moving:false});check('stop');assert.equal(s.phase,phase);frames++}assert.ok(frames>=6&&frames<60,'stop blend '+frames);
 // The move fade is an exact exponential: frame rate does not change it.
 const at=hz=>{const g=createGaitState();for(let i=0;i<hz/2;i++)advanceGait(g,1/hz,{moving:true,distance:1/hz,speed:2});return g.move};assert.ok(Math.abs(at(30)-at(120))<1e-9);
});

// Points spread over a held item, in world space.
function itemPoints(item){const out=[];item.updateWorldMatrix(true,true);item.traverse(o=>{if(!o.isMesh)return;const pos=o.geometry.attributes.position,step=Math.max(1,Math.floor(pos.count/150));for(let i=0;i<pos.count;i+=step)out.push(v().fromBufferAttribute(pos,i).applyMatrix4(o.matrixWorld))});return out}
const headCentre=rig=>rig.head.getWorldPosition(v()).add(v().set(0,.17,.03).applyQuaternion(rig.root.getWorldQuaternion(new T.Quaternion())));
export const HEAD_CLEARANCE=.35,NECK_CLEARANCE=.12;
// Distance from p to the neck (neck bone to head bone).
function neckGap(rig,p){const a=rig.neck.getWorldPosition(v()),b=rig.head.getWorldPosition(v()),d=b.clone().sub(a),t=Math.max(0,Math.min(1,p.clone().sub(a).dot(d)/d.lengthSq()));return p.distanceTo(a.addScaledVector(d,t))}

test('weapons are carried clear of the head and neck standing, walking and running, for every weapon kind',()=>{
 const keys=['longsword','dagger','scimitar','shortsword','goldenSword','axe','pickaxe','hammer','bronzeSword','twohand','claymore','steelTwohand','battleaxe','unbrokenCleaver','waraxe','spear','warhammer','scythe','apprenticeStaff','emberStaff','woodenBow','longbow','bloodthornBow'];
 for(const key of keys)for(const [mode,speed] of [['idle',0],['walk',WALK_REF],['jog',RUN_REF],['run',RUN_REF*1.2]]){
  const w=walker({weapon:key,shield:weaponCatalog[key].twoHanded?null:'kite'}),dt=1/60,opts={speed,locomotion:mode==='idle'?'walk':mode};for(let i=0;i<90;i++)w.step(dt,opts);
  const cycle=speed?2*w.step(dt,opts).step/speed:.5;let near=Infinity,neck=Infinity;
  for(let t=0;t<cycle;t+=dt){w.step(dt,opts);const head=headCentre(w.rig);for(const p of itemPoints(w.held.weapon)){near=Math.min(near,p.distanceTo(head));neck=Math.min(neck,neckGap(w.rig,p))}}
  assert.ok(near>HEAD_CLEARANCE,`${key} ${mode}: blade/tip ${near.toFixed(3)} from the head`);assert.ok(neck>NECK_CLEARANCE,`${key} ${mode}: ${neck.toFixed(3)} from the neck`);
 }
});
