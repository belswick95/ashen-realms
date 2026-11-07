import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createTravelHeading} from '../mount-heading.js';
import {bfsRoute,TILE,GAME_TICK} from '../tile-grid.js';
import {createMotionTrack,createLocalWalker,createTickLateness,turnToward} from '../motion-track.js';
import {createHorseMount,GALLOP_STRIDE} from '../horse-mount.js';

const wrapDeg=a=>Math.abs(Math.atan2(Math.sin(a),Math.cos(a)))*180/Math.PI;
// A mounted tile walk (three tiles per 600 ms tick) on an OSRS route: diagonal first, then straight.
const tiles=[[0,0],...bfsRoute({start:[0,0],goal:[8,21],flagsAt:()=>0}).path.map(([x,z])=>[Math.round(x/TILE),Math.round(z/TILE)])];
const points=tiles.map(([i,j])=>[i*TILE,j*TILE]),MOVES=tiles.slice(1);
const TICK=GAME_TICK*1000,dt=1/60;

// Crab angle between the heading and the travel direction (velocity over ±4 frames, what the eye
// reads as "where it is going"), sampled while moving at riding pace, away from the one bend.
// Frames up to `settle` s after a change of direction are the fast turn itself, not crabbing.
function crab(samples,w=4,settle=.15){const out=[],dir=[];let bend=-Infinity;
 for(let k=1;k<samples.length;k++){const a=samples[k-1],b=samples[k];dir[k]=Math.hypot(b.x-a.x,b.z-a.z)>1e-6?Math.atan2(b.x-a.x,b.z-a.z):null}
 for(let k=w;k<samples.length-w;k++){if(dir[k]!=null&&(dir[k-1]==null||wrapDeg(dir[k]-dir[k-1])>.5))bend=k;
  const a=samples[k-w],b=samples[k],c=samples[k+w],dx=c.x-a.x,dz=c.z-a.z;
  if(Math.hypot(dx,dz)/(2*w*dt)<3||(k-bend)*dt<settle||dir.slice(k-w+1,k+w+1).some((d,i,l)=>d==null||wrapDeg(d-l[0])>.5))continue;out.push(wrapDeg(Math.atan2(dx,dz)-b.yaw))}return out}
const reversals=ys=>{let n=0,last=0;for(let i=1;i<ys.length;i++){const d=Math.atan2(Math.sin(ys[i]-ys[i-1]),Math.cos(ys[i]-ys[i-1]));if(Math.abs(d)<1e-5)continue;const s=Math.sign(d);if(last&&s!==last)n++;last=s}return n};

test('local rider: the horse faces its tile step, turns once at the bend, never crabs or wobbles',()=>{
 const poseAt=(idx,at)=>{const prev=points[Math.max(0,idx-1)],cur=points[idx];return {x:cur[0],z:cur[1],yaw:Math.atan2(cur[0]-prev[0],cur[1]-prev[1]),path:points.slice(idx+1),at,tile:true,stepTiles:3,moving:idx<points.length-1,speed:3*TILE/GAME_TICK}};
 // Movement v3 (game.js): the click's route is ridden at once at three tiles a tick; each tick's
 // server pose only verifies it.
 const heading=createTravelHeading(),walker=createLocalWalker(),local={x:0,z:0},samples=[];let yaw=Math.PI/4,lastTick=-1;
 walker.update(local,0);walker.face(yaw);walker.walk(points.slice(1),{serverNow:0,steps:3});walker.ack();
 for(let t=0;t<(MOVES.length/3+2)*TICK;t+=dt*1000){
  const tick=Math.floor(t/TICK);if(tick!==lastTick){lastTick=tick;walker.verify(poseAt(Math.min(points.length-1,tick*3),tick*TICK),t)}
  walker.face(yaw);const f=walker.update(local,t);if(f)yaw=f.yaw;yaw=heading.update(local.x,local.z,dt,yaw);samples.push({x:local.x,z:local.z,yaw});
 }
 assert.equal(walker.stats.reroutes,0,'the server tick poses only verify the ride');
 const c=crab(samples);assert.ok(c.length>50&&Math.max(...c)<1,'faces the travel direction: worst '+Math.max(...c).toFixed(2)+'° at '+c.indexOf(Math.max(...c))+' of '+c.length);
 assert.equal(reversals(samples.map(s=>s.yaw)),0,'no side-to-side swing');
 assert.ok(Math.hypot(local.x-points.at(-1)[0],local.z-points.at(-1)[1])<1e-6,'arrives on the clicked tile');
});

test('remote rider: tick positions three tiles apart are walked tile by tile; the horse faces each step',()=>{
 const track=createMotionTrack({delay:650,tileOptions:{lateness:createTickLateness()}}),heading=createTravelHeading(),samples=[];
 let sent=0;
 for(let now=0;now<(MOVES.length/3+6)*TICK;now+=dt*1000){
  // Each tick's position arrives 150 ms after its tick (three tiles on, when riding).
  for(;sent*TICK+150<=now&&sent*3<MOVES.length+3;sent++){const idx=Math.min(points.length-1,sent*3),prev=points[Math.max(0,idx-1)],cur=points[idx];track.pushTile(sent*TICK,{x:cur[0],z:cur[1],yaw:idx?Math.atan2(cur[0]-prev[0],cur[1]-prev[1]):Math.PI/4,moving:true,stepTiles:3},now,now)}// standing facing the first (diagonal) step
  const s=track.sample(now);if(!s)continue;samples.push({x:s.x,z:s.z,yaw:heading.update(s.x,s.z,dt,s.yaw)})}
 const c=crab(samples);assert.ok(c.length>50&&Math.max(...c)<1,'faces each step, no chord between tick positions: worst '+Math.max(...c).toFixed(2)+'° n='+c.length);
 assert.equal(reversals(samples.slice(1).map(s=>s.yaw)),0,'no side-to-side swing');
});

test('heading follows the step yaw with the same fast turn, holds it at rest and snaps on teleport',()=>{
 const h=createTravelHeading();assert.equal(h.update(0,0,dt,0),0);
 let yaw=0,t=0;while(wrapDeg(yaw-Math.PI/2)>.5&&t<1){yaw=h.update(0,0,dt,Math.PI/2);t+=dt}
 assert.ok(t<=.12,'90° in '+t.toFixed(3)+' s: fast, not a lazy drift');
 let same=0;for(let i=0;i<10;i++)same=h.update(0,0,dt,Math.PI/2);assert.ok(wrapDeg(same-Math.PI/2)<1e-6,'holds the given yaw');
 assert.equal(h.update(50,50,dt,1),1,'teleport snaps');
 assert.ok(!('speed' in h),'no velocity filter any more');
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
