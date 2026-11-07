// OSRS movement (owner report after heading144: walking, running and riding zig-zag; the horse
// swings side to side). heading144 hugged the start-to-marker line (E, NE, E, E, NE ...), faced a
// look-ahead point and low-passed the horse's velocity. OSRS walks DIAGONALLY first until level with
// the target on one axis, then STRAIGHT (one clean bend), faces the step it is on and turns fast.
// This plays a click-walk end to end the way the game does: the server walking the BFS route one tick
// at a time, snapshots polled with latency, the local player presented (createTileFollower +
// turnToward, game.js), a rider's horse heading (mount-heading.js) and a remote
// player's tile playback (createMotionTrack.pushTile).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {TILE,GAME_TICK,bfsRoute,projectTilePose,tileSteps} from '../tile-grid.js';
import {createMotionTrack,createTileFollower,turnToward} from '../motion-track.js';
import {createTravelHeading} from '../mount-heading.js';

const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a)),deg=a=>a*180/Math.PI,FRAME=16;
const open=()=>0;
const tilesOf=path=>path.map(([x,z])=>[Math.round(x/TILE),Math.round(z/TILE)]);
const stepsOf=(start,path)=>{let [pi,pj]=start;return tilesOf(path).map(([i,j])=>{const s=[i-pi,j-pj];pi=i;pj=j;return s})};
const turns=steps=>steps.filter((s,k)=>k&&(s[0]!==steps[k-1][0]||s[1]!==steps[k-1][1])).length;

// One click-walk from tile (0,0) to `goal`; per-frame samples for the local walker (or rider, with
// steps===3) and a remote observer of the same walker.
function clickWalk(goal,{steps=1,startYaw=0,poll=250,latency=100,clickAt=1234,until=16000,flagsAt=open}={}){
 const route=bfsRoute({start:[0,0],goal,flagsAt}).path;
 let sx=0,sz=0,syaw=startYaw,path=[],at=0,stepTiles=0,lastTick=0,planned=false,nextPoll=0;
 let pose={x:0,z:0,yaw:startYaw,path:[],at:0,tile:true,stepTiles:0,moving:false,speed:TILE/GAME_TICK};
 const local={x:0,z:0},follower=createTileFollower(),rider=createTravelHeading(),remoteRider=createTravelHeading(),remote=createMotionTrack({delay:650}),inbox=[],frames=[];
 let yaw=startYaw;remote.pushTile(0,{x:0,z:0,yaw:startYaw,moving:true,stepTiles:0},0);
 const gx=goal[0]*TILE,gz=goal[1]*TILE;
 for(let t=0;t<until;t+=FRAME){
  if(!planned&&t>=clickAt+latency){planned=true;path=route.map(p=>[...p]);at=Math.floor(t/600)*600;stepTiles=steps}
  for(const tick=Math.floor(t/600);lastTick<tick;){lastTick++;if(planned&&path.length){for(let s=0;s<steps&&path.length;s++){const p=path.shift();syaw=Math.atan2(p[0]-sx,p[1]-sz);sx=p[0];sz=p[1]}at=lastTick*600;if(!path.length)stepTiles=0}}
  if(t>=nextPoll){nextPoll+=poll;inbox.push({arrive:t+latency,snap:{x:sx,z:sz,yaw:syaw,path:path.map(p=>[...p]),at,tile:true,stepTiles,moving:path.length>0,speed:Math.max(1,stepTiles)*TILE/GAME_TICK}})}
  while(inbox.length&&inbox[0].arrive<=t){pose=inbox.shift().snap;remote.pushTile(pose.at,{x:pose.x,z:pose.z,yaw:pose.yaw,moving:pose.moving,stepTiles:pose.stepTiles},t)}
  const dt=FRAME/1000,shown=follower.update(local,pose,t,dt);
  if(shown&&(shown.moving||!pose.moving))yaw=turnToward(yaw,shown.yaw,dt);
  if(steps===3)yaw=rider.update(local.x,local.z,dt,yaw);
  const r=remote.sample(t),ryaw=steps===3?remoteRider.update(r.x,r.z,dt,r.yaw):r.yaw;// game.js: a remote rider's horse too
  frames.push({t,x:local.x,z:local.z,yaw,left:Math.hypot(gx-local.x,gz-local.z)/TILE,rx:r.x,rz:r.z,ryaw,rleft:Math.hypot(gx-r.x,gz-r.z)/TILE});
 }
 return {frames,route};
}

// Facing against the direction of travel, frame by frame: the travel direction is the walker's own
// motion (it moves on straight tile legs, so this is the step direction); after each change of
// direction, how long until the facing matches it, and the worst error once it has had a tick.
function facing(frames,{x='x',z='z',yaw='yaw'}={}){
 let dir=null,since=0,worst=0,settleWorst=0,pending=null;
 for(let i=1;i<frames.length;i++){const a=frames[i-1],b=frames[i],dx=b[x]-a[x],dz=b[z]-a[z];
  if(Math.hypot(dx,dz)<1e-4){dir=null;continue}
  const d=Math.atan2(dx,dz);if(dir===null||Math.abs(wrap(d-dir))>deg2rad(1)){dir=d;since=b.t;pending={t:b.t}}
  const err=Math.abs(deg(wrap(b[yaw]-dir)));
  if(pending&&err<1){settleWorst=Math.max(settleWorst,b.t-pending.t);pending=null}
  if(b.t-since>=GAME_TICK*1000)worst=Math.max(worst,err);
 }
 return {worst,settle:settleWorst/1000};
}
const deg2rad=d=>d*Math.PI/180;

// Every octant (both sides of each diagonal), the axes and the diagonals themselves.
const GOALS=[[3,10],[10,3],[10,-3],[3,-10],[-3,-10],[-10,-3],[-10,3],[-3,10],[1,12],[-12,5],[7,-6],[0,-9],[6,6],[-5,0],[-4,4]];

test('route: diagonal first until level on one axis, then straight (all 8 octants), shortest',()=>{
 for(const g of GOALS){
  const path=bfsRoute({start:[0,0],goal:g,flagsAt:open}).path,steps=stepsOf([0,0],path);
  const [dx,dz]=g,diag=Math.min(Math.abs(dx),Math.abs(dz)),n=Math.max(Math.abs(dx),Math.abs(dz));
  assert.equal(path.length,n,'a shortest route to '+g);
  steps.forEach((s,k)=>{
   const want=k<diag?[Math.sign(dx),Math.sign(dz)]:Math.abs(dx)>Math.abs(dz)?[Math.sign(dx),0]:[0,Math.sign(dz)];
   assert.deepEqual(s,want,'step '+k+' to '+g+': '+JSON.stringify(steps));
  });
  assert.equal(turns(steps),diag&&diag<n?1:0,'one clean bend to '+g);
 }
 // The classic example: 10 east, 3 north walks NE, NE, NE, then east 7 times.
 assert.deepEqual(stepsOf([0,0],bfsRoute({start:[0,0],goal:[10,3],flagsAt:open}).path),[[1,1],[1,1],[1,1],...Array(7).fill([1,0])]);
});

test('route: an open-field click from anywhere has exactly one direction change (or none)',()=>{
 for(let gx=-14;gx<=14;gx++)for(let gz=-14;gz<=14;gz++){if(!gx&&!gz)continue;
  const n=turns(stepsOf([0,0],bfsRoute({start:[0,0],goal:[gx,gz],flagsAt:open}).path));
  assert.equal(n,gx&&gz&&Math.abs(gx)!==Math.abs(gz)?1:0,'to '+[gx,gz]);
 }
});

test('route: around a wall it stays shortest and keeps the diagonal-first preference',()=>{
 // A wall across the diagonal: the route still has the BFS length, and walks a handful of legs.
 const wall=new Set();for(let j=-1;j<=4;j++)wall.add('3,'+j);const flagsAt=(i,j)=>wall.has(i+','+j)?1:0;
 const r=bfsRoute({start:[0,0],goal:[8,2],flagsAt});assert.equal(r.reached,true);
 const steps=stepsOf([0,0],r.path);assert.ok(turns(steps)<=3,'few legs: '+JSON.stringify(steps));
 for(const [i,j] of tilesOf(r.path))assert.ok(!wall.has(i+','+j));
});

for(const [label,steps] of [['walking',1],['running',2],['riding',3]])test('click-walk ('+label+'): faces the tile step being walked, turning fast at the one bend',()=>{
 for(const g of GOALS)for(const startYaw of [0,Math.PI*.9,-Math.PI/2,2.5]){
  const {frames}=clickWalk(g,{steps,startYaw});
  for(const [who,keys] of [['local',{}],['remote',{x:'rx',z:'rz',yaw:'ryaw'}]]){
   const f=facing(frames,keys),tag=who+' '+label+' to '+g+' from '+deg(startYaw).toFixed(0)+'°';
   // Heading equals the step direction within one tick of every change of direction ...
   assert.ok(f.worst<1,tag+': facing the step '+f.worst.toFixed(2)+'° off');
   // ... and gets there fast: a quick slerp (~0.1 s), not a lazy drift.
   assert.ok(f.settle<=.2,tag+': settles in '+f.settle.toFixed(2)+' s');
  }
  const done=frames.at(-1);assert.ok(done.left<.01&&done.rleft<.01,'arrives');
 }
});

test('riding a long route: the horse turns once and never swings back and forth',()=>{
 for(const g of [[30,9],[-28,-11],[12,-31],[25,24]]){
  // Already facing the first (diagonal) step, so the only turn left is the route's one bend.
  const {frames}=clickWalk(g,{steps:3,until:20000,startYaw:Math.atan2(Math.sign(g[0]),Math.sign(g[1]))});
  for(const key of ['yaw','ryaw']){
   // Turn direction reversals (yaw rate changing sign) while moving: an oscillating horse has many.
   let reversals=0,lastSign=0,turned=0;
   for(let i=1;i<frames.length;i++){const d=wrap(frames[i][key]-frames[i-1][key]);if(Math.abs(d)<1e-4)continue;turned+=Math.abs(d);
    const s=Math.sign(d);if(lastSign&&s!==lastSign)reversals++;lastSign=s}
   assert.equal(reversals,0,key+' to '+g+': no wobble');
   assert.ok(Math.abs(deg(turned)-45)<.5,key+' to '+g+': '+deg(turned).toFixed(1)+'° turned in all (the one 45° bend)');
  }
 }
});

test('heading144 regression: the line-hugging route would zig-zag (several bends) where OSRS has one',()=>{
 // What heading144 produced for 10 east, 3 north: E, NE, E, E, E, NE, E, E, NE, E (5 bends).
 const zigzag=[[1,0],[1,1],[1,0],[1,0],[1,0],[1,1],[1,0],[1,0],[1,1],[1,0]];assert.equal(turns(zigzag),6);
 assert.equal(turns(stepsOf([0,0],bfsRoute({start:[0,0],goal:[10,3],flagsAt:open}).path)),1);
});

test('turnToward: fast (a 90° turn in under ~0.1 s), eased, the short way across ±180°',()=>{
 let yaw=0,t=0;const seen=[];while(Math.abs(wrap(yaw-Math.PI/2))>deg2rad(1)&&t<1){yaw=turnToward(yaw,Math.PI/2,.016);seen.push(yaw);t+=.016}
 assert.ok(t<=.1,'90° in '+t.toFixed(3)+' s');assert.ok(seen[0]>0&&seen[0]<Math.PI/2*.6,'not a one-frame snap');
 for(let i=1;i<seen.length;i++)assert.ok(seen[i]>=seen[i-1],'monotonic, no overshoot');
 yaw=deg2rad(170);const wrapSeen=[];for(let i=0;i<30;i++){yaw=turnToward(yaw,deg2rad(-170),.016);wrapSeen.push(deg(yaw))}
 assert.ok(wrapSeen.every(a=>Math.abs(a)>=165),'never sweeps through 0°');
 assert.ok(Math.abs(wrap(yaw-deg2rad(-170)))<deg2rad(.5),'arrives');
});

test('projectTilePose and tileSteps: constant pace along tile legs, facing the step; remote tick gaps walk the same tiles',()=>{
 const corner=[[1,1],[2,2],[3,2],[4,2]].map(([i,j])=>[i*TILE,j*TILE]);
 const at=ms=>projectTilePose({x:0,z:0,yaw:0,at:0,stepTiles:1,path:corner},ms);
 assert.ok(Math.abs(at(300).yaw-Math.PI/4)<1e-9,'diagonal leg faces NE');
 assert.ok(Math.abs(at(1500).yaw-Math.PI/2)<1e-9,'straight leg faces E');
 assert.ok(Math.abs(at(300).x-at(300).z)<1e-9&&Math.abs(at(300).x-TILE/2)<1e-9,'linear, half a tile in half a tick');
 assert.deepEqual(tileSteps({x:0,z:0},{x:3*TILE,z:TILE}).map(p=>[Math.round(p.x/TILE),Math.round(p.z/TILE)]),[[1,1],[2,1],[3,1]],'a rider tick: diagonal first');
 assert.deepEqual(tileSteps({x:0,z:0},{x:TILE,z:0}),[{x:TILE,z:0}],'one tile');
 assert.deepEqual(tileSteps({x:.3,z:0},{x:3*TILE,z:0}),[{x:3*TILE,z:0}],'off the grid: as given');
});

test('server route (db/tile-route-osrs.sql): patches the heading144 text once, diagonal-first rule, safe to apply',()=>{
 const patch=fs.readFileSync(new URL('../db/tile-route-osrs.sql',import.meta.url),'utf8'),line=fs.readFileSync(new URL('../db/tile-route-line.sql',import.meta.url),'utf8');
 assert.match(patch,/^begin;\nset local lock_timeout='5s';/m);assert.match(patch,/commit;/);
 assert.doesNotMatch(patch,/\b(delete|alter|drop)\b/i,'no DELETE, ALTER or DROP');
 assert.doesNotMatch(patch,/'\s*\n\s*E'/,'adjacent E\'\' literals are joined with ||, never split over lines');
 assert.ok(patch.includes("if position('-- OSRS route shape' in pg_get_functiondef(fn))>0 then return;end if;"),'idempotent');
 assert.ok(patch.includes('eldervale_private.patch_function(fn,array['),'patched through patch_function');
 // Each anchor is heading144 text (tile-route-line.sql's replacement), line by line.
 for(const anchor of ['k:=found;ex:=found%w-radius;ez:=found/w-radius;','  -- The one-step-shorter parent closest to the start-end line (|cross product|) that can step here.\\n','  nxt:=prev[k+1];off:=abs((nxt%w-radius)*ez-(nxt/w-radius)*ex);\\n','   dd:=abs((wi-radius)*ez-(wj-radius)*ex);\\n'])
  assert.ok(line.includes(anchor)&&patch.includes(anchor),'heading144 anchor: '+anchor.slice(0,50));
 assert.ok(patch.includes("ex:=case when abs(ci-radius)>=abs(cj-radius) then sign(ci-radius)::integer else 0 end;")&&patch.includes('dd:=-(di*ex+dj*ez)/sqrt((abs(di)+abs(dj))::numeric);'),'the same diagonal-first rule as bfsRoute');
 // Dry run: applies the patch in a DO block, routes before and after, raises both (rolled back).
 const dry=patch.slice(patch.indexOf('do $dry$'));
 assert.equal((dry.match(/tile_route\(-138,91,'tile',-128,88,-128\*1\.58,88\*1\.58,0,32,10,false\)/g)||[]).length,2);
 assert.match(dry,/raise exception 'DRY RUN[^']*% [^']*%',before->'path',after->'path';/);
});
