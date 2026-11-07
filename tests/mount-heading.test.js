import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createTravelHeading} from '../mount-heading.js';
import {projectTilePose,TILE,GAME_TICK} from '../tile-grid.js';
import {createMotionTrack,reconcileLocalPose} from '../motion-track.js';
import {createHorseMount,GALLOP_STRIDE} from '../horse-mount.js';

const wrapDeg=a=>Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))*180/Math.PI;
// A mounted tile walk: three tiles per 600 ms tick, mixing diagonal and straight steps.
const MOVES=[[1,1],[0,1],[0,1],[1,1],[1,0],[1,0],[1,1],[0,1],[1,1],[1,1],[0,1],[-1,1],[-1,1],[0,1],[0,1],[1,1],[1,0],[0,1],[1,1],[0,1],[0,1]];
const tiles=[[0,0]];for(const [a,b] of MOVES){const t=tiles.at(-1);tiles.push([t[0]+a,t[1]+b])}
const points=tiles.map(([i,j])=>[i*TILE,j*TILE]);
const TICK=GAME_TICK*1000,dt=1/60;

// Crab angle between the heading and the travel direction (velocity over ±4 frames,
// what the eye reads as "where it is going"), sampled while moving at riding pace.
function crab(samples,w=4){const out=[];for(let k=w;k<samples.length-w;k++){const a=samples[k-w],b=samples[k],c=samples[k+w],dx=c.x-a.x,dz=c.z-a.z;if(Math.hypot(dx,dz)/(2*w*dt)<3)continue;out.push(wrapDeg(Math.atan2(dx,dz)-b.yaw))}return out}
const stats=v=>{const s=[...v].sort((a,b)=>a-b);return {mean:s.reduce((a,b)=>a+b,0)/s.length,p90:s[Math.floor(s.length*.9)],max:s.at(-1)}};

test('local rider: the horse faces its velocity on mixed diagonal and straight tile steps',()=>{
 // The server's tick pose as the client presents it (projectTilePose), chased by
 // reconcileLocalPose exactly as game.js does; the game used to face the path yaw.
 const poseAt=(idx,at)=>{const prev=points[Math.max(0,idx-1)],cur=points[idx];return {x:cur[0],z:cur[1],yaw:Math.atan2(cur[0]-prev[0],cur[1]-prev[1]),path:points.slice(idx+1),at,tile:true,stepTiles:3,speed:3*TILE/GAME_TICK}};
 const heading=createTravelHeading(),local={x:0,z:0},samples=[],raw=[];let last=null,maxTurn=0;
 for(let t=0;t<(MOVES.length/3+1)*TICK;t+=dt*1000){
  const tick=Math.floor(t/TICK),pose=poseAt(Math.min(points.length-1,tick*3),tick*TICK),p=projectTilePose(pose,t);
  reconcileLocalPose(local,{...p,speed:pose.speed},dt);
  const yaw=heading.update(local.x,local.z,dt,p.yaw);if(last!==null)maxTurn=Math.max(maxTurn,wrapDeg(yaw-last));last=yaw;
  raw.push({x:local.x,z:local.z,yaw:p.yaw});samples.push({x:local.x,z:local.z,yaw});
 }
 const before=stats(crab(raw)),after=stats(crab(samples));
 assert.ok(before.max>45,'the path yaw alone points well off the travel direction ('+before.max.toFixed(0)+'°)');
 assert.ok(after.max<40,'never sideways: worst '+after.max.toFixed(0)+'°');
 assert.ok(after.p90<25&&after.p90<before.p90,'p90 '+after.p90.toFixed(1)+'° (was '+before.p90.toFixed(1)+'°)');
 assert.ok(maxTurn<=10*dt*180/Math.PI+1e-6,'turns smoothly, no snapping: '+maxTurn.toFixed(1)+'° per frame');
});

test('remote rider: tick samples three tiles apart glide on chords; the horse faces the chord, not the last step',()=>{
 const track=createMotionTrack({delay:650}),heading=createTravelHeading(),samples=[],raw=[];
 for(let tick=0;tick*3<MOVES.length;tick++){const idx=Math.min(points.length-1,tick*3),prev=points[Math.max(0,idx-1)],cur=points[idx];track.pushTile(tick*TICK,{x:cur[0],z:cur[1],yaw:Math.atan2(cur[0]-prev[0],cur[1]-prev[1]),moving:true,stepTiles:3},tick*TICK,0)}
 for(let now=0;now<(MOVES.length/3+2)*TICK;now+=dt*1000){const s=track.sample(now);if(!s)continue;raw.push({x:s.x,z:s.z,yaw:s.yaw});samples.push({x:s.x,z:s.z,yaw:heading.update(s.x,s.z,dt,s.yaw)})}
 const before=stats(crab(raw)),after=stats(crab(samples));
 // Tile playback (motion-track.js createTilePlayback) already walks the tiles in order and faces
 // the leg being walked, so the raw track no longer reports the last step's yaw; the heading
 // filter must keep it at least as straight.
 assert.ok(after.p90<=before.p90+2,'heading no worse than the track ('+before.p90.toFixed(0)+'°)');
 assert.ok(after.mean<7,'mean crab '+after.mean.toFixed(1)+'°');
 assert.ok(after.p90<22,'p90 crab '+after.p90.toFixed(1)+'°');
});

test('heading turns at a capped rate, holds the given yaw at rest and snaps on teleport',()=>{
 const h=createTravelHeading();h.update(0,0,dt,0);
 // Reverse direction: a 180° turn is not instantaneous.
 let x=0,yaw=0,maxStep=0;for(let i=0;i<60;i++){x-=8*dt;const before=yaw;yaw=h.update(0,x,dt,0);maxStep=Math.max(maxStep,wrapDeg(yaw-before))}
 assert.ok(maxStep<=10*dt*180/Math.PI+1e-6,'turn rate capped');assert.ok(wrapDeg(yaw-Math.PI)<3,'ends facing travel');
 for(let i=0;i<120;i++)yaw=h.update(0,x,dt,Math.PI/2);assert.ok(wrapDeg(yaw-Math.PI/2)<2,'standing: turns to the given yaw');
 assert.equal(h.update(50,50,dt,1),1,'teleport snaps');
});

test('horse gait follows the real pace: no gallop from tiny nudges, shorter reach when slow, full gallop at riding speed',()=>{
 const parent=new T.Group(),horse=createHorseMount(T,parent),skin=horse.skins[0],reach=()=>skin.morphTargetInfluences.reduce((a,b)=>a+b,0);
 for(let i=0;i<60;i++)horse.update({active:true,distance:.002,dt});assert.ok(reach()<.05,'reconcile nudges do not gallop');
 for(let i=0;i<90;i++)horse.update({active:true,distance:2.6*dt,dt});const slow=reach();assert.ok(slow>.2&&slow<.5,'gentle gait at walking pace '+slow);
 const p0=horse.phase;for(let i=0;i<60;i++)horse.update({active:true,distance:2.6*dt,dt});assert.ok(horse.phase-p0>.6,'slow strides keep a lively cadence, not slow motion');
 for(let i=0;i<90;i++)horse.update({active:true,distance:7.9*dt,dt});assert.ok(reach()>.98,'full gallop at riding speed');
 const p1=horse.phase;for(let i=0;i<60;i++)horse.update({active:true,distance:7.9*dt,dt});assert.ok(Math.abs(horse.phase-p1-7.9/GALLOP_STRIDE)<.02,'full stride per '+GALLOP_STRIDE+' units');
 for(let i=0;i<60;i++)horse.update({active:true,distance:0,dt});assert.ok(reach()<.05,'eases back to standing when stopped');
 horse.dispose();
});
