import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {buildHumanoid} from '../humanoid.js';import {createHumanoidAnimator} from '../animation.js';
import {animateTownActivity,createWorkKit,workFacing} from '../town-life.js';import {lodStep,characterLod} from '../graphics-quality.js';

// iPad recording (Winterwatch square): townsfolk 20-40 m away turned back and
// forth every few frames, their broom jumping from the sweep in front of them
// to the other hip. The realm pose sets the root yaw every frame; the work
// layer (station facing) only ran on the character's LOD frames.
const angle=(a,b)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)));
function station(useFacing){
 const route=[{x:0,z:0,wait:8,act:'sweep',face:Math.PI/2},{x:6,z:0,wait:0}];
 const root=new T.Group(),rig=buildHumanoid(T,root),animator=createHumanoidAnimator(rig);createWorkKit(T,rig,{activity:'sweep',route});
 const actor={},serverYaw=0,interval=characterLod(30,'medium').interval,yaws=[],brooms=[];
 assert.ok(interval>0,'a worker 30 m away animates at a reduced rate on a tablet');
 for(let i=0;i<240;i++){const now=i/60;
  // interpolateRealm: the server keeps the standing worker's yaw.
  root.rotation.y=useFacing?workFacing(rig,serverYaw,false):serverYaw;
  const step=lodStep(actor,1/60,interval,.4);
  if(step){animator.update(step,{});animateTownActivity(rig,'sweep',now,false)}
  root.updateMatrixWorld(true);
  if(i>=150){yaws.push(root.rotation.y);const broom=rig.workKit.items.broom;brooms.push(broom?.visible?broom.getWorldPosition(new T.Vector3()):null)}
 }
 let turn=0,jump=0;for(let i=1;i<yaws.length;i++){turn=Math.max(turn,angle(yaws[i],yaws[i-1]));if(brooms[i]&&brooms[i-1])jump=Math.max(jump,brooms[i].distanceTo(brooms[i-1]))}
 return {turn,jump,yaw:yaws.at(-1),broom:brooms.every(Boolean)};
}

test('a throttled (far) worker keeps facing its station on every frame, not only on its animation frames',()=>{
 const before=station(false);assert.ok(before.turn>1,'without the facing the body flips between server yaw and station ('+before.turn.toFixed(2)+' rad)');
 const after=station(true);
 assert.ok(after.broom,'broom shown while sweeping');
 assert.ok(after.turn<.05,'no frame-to-frame turn while standing: '+after.turn.toFixed(3));
 assert.ok(after.jump<.1,'broom moves continuously: '+after.jump.toFixed(3)+' m per frame');
 assert.ok(angle(after.yaw,Math.PI/2)<.1,'faces the station');
});

test('a walking worker follows the server yaw; an idle or interrupted one has no stale station facing',()=>{
 const rig={work:{yaw:1.2}};
 assert.equal(workFacing(rig,.3,true),.3,'moving: server yaw');
 assert.equal(workFacing(rig,.3,false),1.2,'standing at the station');
 assert.equal(workFacing({work:{yaw:null}},.3,false),.3);assert.equal(workFacing(undefined,.3,false),.3);
});

test('game.js presents the work facing in the per-frame realm pose and clears it when work is interrupted',async()=>{
 const game=(await import('node:fs')).readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(game,/actor\.root\.rotation\.y=workFacing\(actor\.rig,postedYaw\(actor\.profile,sample\.yaw,moved\),moved,dt\)/,'posted NPCs keep their data facing (town-life.js postedYaw)');
 assert.match(game,/if\(!working&&npc\.rig\.work\)npc\.rig\.work\.yaw=null/);
});
