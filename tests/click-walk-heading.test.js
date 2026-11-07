// Owner report: after a click to walk, run or ride, the player first headed off to one side of the
// marker, then swung over to the other side and only slowly lined up with it. The tile route put
// every straight step first and every diagonal last (BFS first-found parents, W E S N first), and
// every tile step was faced on its own. This plays a click-walk end to end the way the game does:
// the server walking the BFS route one tick at a time, snapshots polled with latency, the local
// player presented (presentPose + reconcileLocalPose + turnToward, game.js), a rider's horse
// heading (mount-heading.js) and a remote player's tile playback (createMotionTrack.pushTile).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {TILE,GAME_TICK,bfsRoute,aheadYaw,projectTilePose} from '../tile-grid.js';
import {createMotionTrack,presentPose,reconcileLocalPose,turnToward} from '../motion-track.js';
import {createTravelHeading} from '../mount-heading.js';

const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),deg=a=>a*180/Math.PI,FRAME=16;
const open=()=>0;

// One click-walk from tile (0,0) to `goal`; returns per-frame samples for the local walker, the
// rider (when steps===3) and a remote observer of the same walker.
function clickWalk(goal,{steps=1,startYaw=0,poll=250,latency=100,clickAt=1234,until=14000}={}){
 const route=bfsRoute({start:[0,0],goal,flagsAt:open}).path;
 let sx=0,sz=0,syaw=startYaw,path=[],at=0,stepTiles=0,lastTick=0,planned=false,nextPoll=0;
 let pose={x:0,z:0,yaw:startYaw,path:[],at:0,tile:true,stepTiles:0,moving:false,speed:TILE/GAME_TICK};
 const local={x:0,z:0},rider=createTravelHeading(),remoteRider=createTravelHeading(),remote=createMotionTrack({delay:650}),inbox=[],frames=[];
 let yaw=startYaw;remote.pushTile(0,{x:0,z:0,yaw:startYaw,moving:true,stepTiles:0},0);
 const gx=goal[0]*TILE,gz=goal[1]*TILE;
 for(let t=0;t<until;t+=FRAME){
  if(!planned&&t>=clickAt+latency){planned=true;path=route.map(p=>[...p]);at=Math.floor(t/600)*600;stepTiles=steps}
  for(const tick=Math.floor(t/600);lastTick<tick;){lastTick++;if(planned&&path.length){for(let s=0;s<steps&&path.length;s++){const p=path.shift();syaw=Math.atan2(p[0]-sx,p[1]-sz);sx=p[0];sz=p[1]}at=lastTick*600;if(!path.length)stepTiles=0}}
  if(t>=nextPoll){nextPoll+=poll;inbox.push({arrive:t+latency,snap:{x:sx,z:sz,yaw:syaw,path:path.map(p=>[...p]),at,tile:true,stepTiles,moving:path.length>0,speed:Math.max(1,stepTiles)*TILE/GAME_TICK}})}
  while(inbox.length&&inbox[0].arrive<=t){pose=inbox.shift().snap;remote.pushTile(pose.at,{x:pose.x,z:pose.z,yaw:pose.yaw,moving:pose.moving,stepTiles:pose.stepTiles},t)}
  const dt=FRAME/1000,shown={...pose,...presentPose(pose,t)};
  if(reconcileLocalPose(local,shown,dt)&&(shown.moving||!pose.moving))yaw=turnToward(yaw,shown.yaw,dt);
  if(steps===3)yaw=rider.update(local.x,local.z,dt,yaw);
  const r=remote.sample(t),ryaw=steps===3?remoteRider.update(r.x,r.z,dt,r.yaw):r.yaw;// game.js: a remote rider's horse too
  frames.push({t,x:local.x,z:local.z,yaw,left:Math.hypot(gx-local.x,gz-local.z)/TILE,rx:r.x,rz:r.z,ryaw,rleft:Math.hypot(gx-r.x,gz-r.z)/TILE});
 }
 return {frames,bearing:Math.atan2(gx,gz)};
}

// How a walker's heading behaves against the bearing from the start to the marker: when it starts
// moving, the direction of its first turn, how long until it lines up, and the worst error after.
function heading(frames,bearing,{x='x',z='z',yaw='yaw',left='left'}={}){
 const start=frames.findIndex((f,i)=>i>0&&Math.hypot(f[x]-frames[0][x],f[z]-frames[0][z])>.02);
 assert.ok(start>0,'the walker moves');
 const from=frames[start-1][yaw],turn=frames.find(f=>Math.abs(wrap(f[yaw]-from))>1e-3);
 const firstTurn=turn?Math.sign(wrap(turn[yaw]-from)):0;
 const aligned=frames.findIndex((f,i)=>i>=start-1&&Math.abs(wrap(f[yaw]-bearing))<deg2rad(20));
 // Worst error once it has had half a second to turn, until the last two tiles (the last steps are faced as walked).
 let worst=0;for(let i=start;i<frames.length&&frames[i][left]>2;i++)if(frames[i].t-frames[start].t>=500)worst=Math.max(worst,Math.abs(deg(wrap(frames[i][yaw]-bearing))));
 return {firstTurn,shortWay:Math.sign(wrap(bearing-from)),settle:aligned<0?Infinity:(frames[aligned].t-frames[start-1].t)/1000,worst,from:deg(from)};
}
const deg2rad=d=>d*Math.PI/180;

// Marker ahead-right, ahead-left, behind, to the side and far off-axis, in every octant.
const GOALS=[[3,10],[10,3],[10,-3],[3,-10],[-3,-10],[-10,-3],[-10,3],[-3,10],[1,12],[-12,5],[7,-6],[0,-9]];

test('route: a click off the axes walks along the line to the marker, not straight then diagonal',()=>{
 for(const g of GOALS){
  const path=bfsRoute({start:[0,0],goal:g,flagsAt:open}).path,len=Math.hypot(g[0],g[1]);
  assert.equal(path.length,Math.max(Math.abs(g[0]),Math.abs(g[1])),'still a shortest route to '+g);
  for(const [px,pz] of path){const off=Math.abs(px/TILE*g[1]-pz/TILE*g[0])/len;assert.ok(off<=.5+1e-9,'route to '+g+' keeps within half a tile of the line ('+off.toFixed(2)+')')}
 }
});

for(const [label,steps] of [['walking',1],['running',2],['riding',3]])test('click-walk heading ('+label+'): turns the short way, no swing past the marker, lines up quickly',()=>{
 for(const g of GOALS)for(const startYaw of [0,Math.PI*.9,-Math.PI/2,2.5]){
  const {frames,bearing}=clickWalk(g,{steps,startYaw});
  for(const [who,keys] of [['local',{}],['remote',{x:'rx',z:'rz',yaw:'ryaw',left:'rleft'}]]){
   const h=heading(frames,bearing,keys),tag=who+' '+label+' to '+g+' from '+h.from.toFixed(0)+'°';
   const off=Math.abs(wrap(bearing-deg2rad(h.from)));
   if(off>deg2rad(10)&&off<deg2rad(170))assert.equal(h.firstTurn,h.shortWay,tag+': first turn is the short way');
   assert.ok(h.settle<=(steps===3&&who==='local'?.5:.4),tag+': lines up in '+h.settle.toFixed(2)+' s');
   // The old route faced the axis (up to 45° off to one side), then the diagonal on the other side.
   // What is left: a remote only knows the tile or two it has been sent, and a horse follows its
   // real velocity through a single diagonal sidestep.
   assert.ok(h.worst<=(who==='local'&&steps<3?12:18),tag+': stays on the marker, worst '+h.worst.toFixed(1)+'°');
  }
 }
});

test('turnToward wraps: a turn across ±180° goes the short way',()=>{
 let yaw=deg2rad(170);const seen=[];for(let i=0;i<30;i++){yaw=turnToward(yaw,deg2rad(-170),.016);seen.push(deg(yaw))}
 assert.ok(seen.every(a=>Math.abs(a)>=165),'never sweeps through 0°: '+seen.slice(0,4).map(a=>a.toFixed(0)));
 assert.ok(Math.abs(wrap(yaw-deg2rad(-170)))<deg2rad(1),'arrives');
});

test('facing ahead: along a slope, and a real corner is still turned at the corner',()=>{
 // Slope: east, north-east, east, east, north-east ... faces along it, not 0°/45° per tile.
 const slope=[[1,0],[2,1],[3,1],[4,1],[5,2],[6,2]].map(([i,j])=>[i*TILE,j*TILE]);
 for(let f=0;f<.99;f+=.25){const yaw=deg(aheadYaw(f*TILE,0,slope,0,0));assert.ok(yaw>60&&yaw<80,'slope '+yaw.toFixed(1)+'° (east is 90°)')}
 // A 90° corner (around a wall): east three tiles, then north.
 const corner=[[1,0],[2,0],[3,0],[3,1],[3,2]].map(([i,j])=>[i*TILE,j*TILE]);
 assert.equal(aheadYaw(TILE,0,corner,1,0),Math.PI/2,'a tile before the corner it faces east');
 assert.ok(Math.abs(deg(projectTilePose({x:0,z:0,yaw:0,at:0,stepTiles:1,path:corner},4*600-300).yaw))<1,'after the corner it faces north');
});

test('server route (db/tile-route-line.sql): patches anchors found once in tile_route, same tie-break as bfsRoute',()=>{
 const grid=fs.readFileSync(new URL('../db/tick-tile-engine-1-grid.sql',import.meta.url),'utf8'),at=grid.indexOf('create or replace function eldervale_private.tile_route(');
 const route=grid.slice(at,grid.indexOf('end $fn$;',at)),patch=fs.readFileSync(new URL('../db/tile-route-line.sql',import.meta.url),'utf8');
 assert.match(patch,/^begin;\nset local lock_timeout='5s';/m);assert.match(patch,/commit;\s*$/);
 assert.ok(patch.includes("if position('depth[idx+1]' in pg_get_functiondef(fn))>0 then return;end if;"),'idempotent');
 for(const anchor of ['prev integer[];queue integer[];','prev:=array_fill(-1,array[n]);','prev[idx+1]:=cur;tail:=tail+1;queue[tail]:=idx;',
  ' k:=found;\n while k<>radius*w+radius and steps<n loop\n  path:=jsonb_build_array(jsonb_build_array(eldervale_private.tile_center(k%w+ox),eldervale_private.tile_center(k/w+oz)))||path;\n  k:=prev[k+1];steps:=steps+1;\n end loop;']){
  assert.equal(route.split(anchor).length-1,1,'anchor once in tile_route: '+anchor.slice(0,40));
  assert.ok(patch.includes(anchor.replace(/\n/g,'\\n')),'anchor in the patch: '+anchor.slice(0,40));
 }
 assert.ok(patch.includes('depth[idx+1]<>depth[k+1]-1')&&patch.includes('dd:=abs((wi-radius)*ez-(wj-radius)*ex);')&&patch.includes('if dd<off then off:=dd;nxt:=idx;end if;'),'closest one-step-shorter parent to the line, first-found on ties');
});
