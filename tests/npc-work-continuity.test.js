import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {buildHumanoid} from '../humanoid.js';import {createHumanoidAnimator} from '../animation.js';
import {animateTownActivity,createWorkKit,workFacing} from '../town-life.js';import {turnToward,sweepStroke,hammerLift,MAX_TURN} from '../npc-activities.js';
import {lodStep,holdGait} from '../graphics-quality.js';

// Owner report: townsfolk who sweep "jump and jerk all over the place". Each
// work activity is replayed through the same per-frame pipeline as game.js
// (realm pose + workFacing every frame, animator and work layer on LOD frames):
// walk to the station, turn to it, work, then leave in another direction.
// Nothing (root yaw, hips, hands, feet or the held prop) may jump between
// consecutive frames.
const angle=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
const BONES=['pelvis','Head','hand_l','hand_r','foot_l','foot_r'];
function replay(act,{interval=0,fps=60,stand=4,hold}={}){
 const route=[{x:0,z:0,wait:9,act,face:Math.PI/2,...(hold?{hold}:{})},{x:3.6,z:0,wait:0}];
 const root=new T.Group(),rig=buildHumanoid(T,root),animator=createHumanoidAnimator(rig);createWorkKit(T,rig,{activity:act,route});
 const npc={},dt=1/fps,speed=1.2,walk=3.6/speed,end=walk*2+stand+.8;
 // Server: arrive heading -X, stand (server yaw unchanged), leave heading +Z.
 const server=t=>t<walk?{x:3.6-t*speed,z:0,yaw:-Math.PI/2}:t<walk+stand?{x:0,z:0,yaw:-Math.PI/2}:{x:0,z:Math.min(walk,t-walk-stand)*speed,yaw:0};
 const frames=[],v=()=>new T.Vector3();
 for(let i=0;i*dt<end;i++){const now=i*dt,before=root.position.clone(),s=server(now);
  const moved=Math.abs(s.x-root.position.x)+Math.abs(s.z-root.position.z)>.001;root.position.x=s.x;root.position.z=s.z;root.rotation.y=workFacing(rig,s.yaw,moved,dt);
  const distance=root.position.distanceTo(before);npc.travelHold=distance>.001?.35:Math.max(0,(npc.travelHold||0)-dt);npc.lodTravel=(npc.lodTravel||0)+distance;
  const step=lodStep(npc,dt,interval,.4);
  if(step){const travelled=npc.lodTravel;npc.lodTravel=0;const g=holdGait(npc,step,travelled);animator.update(step,{distance:g.distance,speed:g.speed,locomotion:'walk'});animateTownActivity(rig,act,now,distance>.001||npc.travelHold>0)}
  root.updateMatrixWorld(true);
  const f={t:now,yaw:root.rotation.y,kind:rig.work?.kind,props:{}};for(const b of BONES)f[b]=rig.bones[b].getWorldPosition(v());
  for(const [name,item] of Object.entries(rig.workKit.items))if(item.visible&&name!=='dust'){f.props[name+':base']=item.localToWorld(v());f.props[name+':mid']=item.localToWorld(v().set(0,.5,0))}
  // Distance of each hand from the broom handle's line.
  const broom=rig.workKit.items.broom;if(broom?.visible){const tip=broom.localToWorld(v()),d=broom.localToWorld(v().set(0,2,0)).sub(tip);f.handle={};for(const side of ['l','r','fist']){const h=(side==='fist'?rig.rightHand:rig.bones['hand_'+side]).getWorldPosition(v());f.handle[side]=h.distanceTo(tip.clone().addScaledVector(d,h.clone().sub(tip).dot(d)/d.lengthSq()))}}
  frames.push(f)}
 return {frames,rig};
}
function jumps(frames,from=.5){const out={yaw:0,body:0,prop:0,at:{}};
 for(let i=1;i<frames.length;i++){const a=frames[i-1],b=frames[i];if(b.t<from)continue;
  const yaw=angle(a.yaw,b.yaw);if(yaw>out.yaw){out.yaw=yaw;out.at.yaw=b.t}
  for(const k of BONES){const d=a[k].distanceTo(b[k]);if(d>out.body){out.body=d;out.at.body=k+'@'+b.t.toFixed(2)}}
  for(const k of Object.keys(b.props))if(a.props[k]){const d=a.props[k].distanceTo(b.props[k]);if(d>out.prop){out.prop=d;out.at.prop=k+'@'+b.t.toFixed(2)}}}
 return out}

for(const act of ['sweep','smith','read','garden','trade','talk','sit','sitread','fetch','pray','watch','rest']){
 test(`${act}: walking in, working and walking off is continuous frame to frame (root, hips, hands, feet, prop)`,()=>{
  const {frames}=replay(act),j=jumps(frames),info=JSON.stringify(j.at);
  assert.ok(frames.some(f=>f.kind),'the station job starts');
  assert.ok(j.yaw<MAX_TURN/60+.01,`no snap turn (station facing <-> path): ${j.yaw.toFixed(3)} rad/frame ${info}`);
  assert.ok(j.body<(act==='smith'?.15:.11),`no body jump: ${j.body.toFixed(3)} m/frame ${info}`);
  // A smith's hammer blow is meant to be quick (the fist ~6 m/s, the head ~9 m/s).
  assert.ok(j.prop<(act==='smith'?.45:.2),`no prop jump: ${j.prop.toFixed(3)} m/frame ${info}`);
 });
}

test('sweeping: feet and hips stay planted while the broom swings a smooth arc on the ground',()=>{
 const {frames}=replay('sweep',{stand:6}),work=frames.filter(f=>f.t>5.5&&f.t<8.8&&f.kind==='broom');assert.ok(work.length>180);
 const range=k=>{const xs=work.map(f=>f[k]);return Math.max(...['x','y','z'].map(c=>Math.max(...xs.map(p=>p[c]))-Math.min(...xs.map(p=>p[c]))))};
 assert.ok(range('pelvis')<.01,'hips still: '+range('pelvis').toFixed(3));assert.ok(range('foot_l')<.06&&range('foot_r')<.06,'feet planted');
 const tips=work.map(f=>f.props['broom:base']),span=c=>Math.max(...tips.map(p=>p[c]))-Math.min(...tips.map(p=>p[c]));assert.ok(Math.max(span('x'),span('z'))>.6,'the bristles really sweep side to side');
 assert.ok(tips.every(p=>p.y<.16),'bristles stay at the ground');
 let jerk=0;for(let i=2;i<tips.length;i++)jerk=Math.max(jerk,tips[i].clone().sub(tips[i-1]).sub(tips[i-1].clone().sub(tips[i-2])).length());
 assert.ok(jerk<.01,'no kinks in the stroke: '+jerk.toFixed(4));
 // Both hands on the handle.
 for(const side of ['l','r']){const worst=Math.max(...work.map(f=>f.handle[side]));assert.ok(worst<.2,'hand '+side+' on the handle: '+worst.toFixed(3))}
});

test('a sweeper keeps the broom in hand on the road and never pops it in or out',()=>{
 const {frames}=replay('sweep');assert.ok(frames.every(f=>f.props['broom:base']),'broom visible every frame');
 const walking=frames.filter(f=>f.t>.6&&f.t<2.5);assert.ok(frames.every(f=>f.handle.fist<.02),'the right fist never lets go of it');assert.ok(walking.every(f=>f.props['broom:mid'].y>f.props['broom:base'].y+.3),'carried upright while walking');
});

test('far (throttled) workers stay continuous too',()=>{
 for(const act of ['sweep','garden','read']){const {frames}=replay(act,{interval:1/24}),j=jumps(frames);
  assert.ok(j.yaw<MAX_TURN*3/60+.01,act+' yaw '+j.yaw.toFixed(3));assert.ok(j.body<.25,act+' body '+j.body.toFixed(3)+JSON.stringify(j.at))}
});

test('the gardener kneels once and works on the knees instead of standing up every loop',()=>{
 const {frames}=replay('garden',{stand:12}),kneel=frames.filter(f=>f.t>6&&f.t<14);const ys=kneel.map(f=>f.pelvis.y);
 assert.ok(Math.max(...ys)<1,'kneeling');assert.ok(Math.max(...ys)-Math.min(...ys)<.05,'no bobbing: '+(Math.max(...ys)-Math.min(...ys)).toFixed(3));
});

test('turning helpers: rate-limited, eased, and wrap-aware',()=>{
 let a=0;for(let i=0;i<10;i++){const n=turnToward(a,Math.PI*.99,1/60);assert.ok(Math.abs(n-a)<=MAX_TURN/60+1e-9);a=n}
 assert.ok(angle(turnToward(3.1,-3.1,1/60),-3.1)<.09,'turns the short way across ±π');
 const rig={work:{yaw:null,shown:1}};assert.ok(angle(workFacing(rig,-2,true,1/60),1)<=MAX_TURN/60+1e-9,'leaving a station turns, not snaps');
 assert.equal(workFacing({work:{yaw:1.2}},.3,false,1/60),1.2);
 // Stroke and hammer curves are periodic and continuous.
 for(const f of [t=>sweepStroke(t).tip[0],t=>sweepStroke(t).tip[1],hammerLift])for(let t=0;t<4;t+=1/240)assert.ok(Math.abs(f(t+1/240)-f(t))<.06);
});
