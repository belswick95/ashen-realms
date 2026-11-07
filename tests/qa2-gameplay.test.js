// QA2 gameplay and world pass (release move3v161). Each test reproduces a bug found live or in review.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createLocalWalker,TICK_MS} from '../motion-track.js';
import {TILE,createTileFlagCache,planTileMove} from '../tile-grid.js';
import {throughOpenDoorway} from '../click-walk.js';

const src=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');

// Live (SwiftShader, ~1 frame per 20 s): the first frame after a click showed the player 8 tiles
// along at once. update() credits the time since the previous frame, and while idle that frame came
// before the click, so a walk from rest jumped ahead by the time the player stood still. On a phone
// at 5-20 fps that is a 1/10-1/3 tile surge on every click from rest.
test('local walker: a walk from rest is never credited with time from before the click',()=>{
 for(const fps of [5,20,60]){const w=createLocalWalker(),pos={x:0,z:0},frame=1000/fps;
  let last=0;for(let k=0;k*frame<=1000;k++){last=k*frame;w.update(pos,last)}
  const click=last+frame*.9;
  w.walk([[5*TILE,0]],{serverNow:click,steps:1,now:click});
  w.update(pos,last+frame);
  const expected=TILE*(last+frame-click)/TICK_MS;
  assert.ok(pos.x<=expected+1e-6,`${fps} fps: first frame after the click moved ${pos.x.toFixed(3)} (at most ${expected.toFixed(3)})`);
  assert.ok(pos.x>0,`${fps} fps: it does start on that frame`);
  // From then on the full frame time is walked.
  const before=pos.x;w.update(pos,last+2*frame);assert.ok(Math.abs(pos.x-before-TILE*frame/TICK_MS)<1e-6,fps+' fps: then the true pace');
 }
});

test('local walker: a redirect while walking keeps the full frame time (no stall)',()=>{
 const w=createLocalWalker(),pos={x:0,z:0};w.update(pos,0);w.walk([[10*TILE,0]],{serverNow:0,steps:1,now:0});
 for(let t=50;t<=600;t+=50)w.update(pos,t);const x=pos.x;
 w.walk([[10*TILE,0]],{serverNow:640,steps:1,now:640});w.update(pos,650);
 assert.ok(Math.abs(pos.x-x-TILE*50/TICK_MS)<1e-6,'a click mid-walk does not drop the frame time already walking');
});

// Live (castle, phone landscape): a tap on the open door of the Castle Kitchen (held open for
// business, so examine-only) walked to the ground the ray met 250 units beyond the building: the
// ground ray ignores doors and walls. Such a click now walks into the doorway.
test('a left click on a held-open door or open gate walks into the doorway, not to ground far behind it',()=>{
 assert.equal(throughOpenDoorway(24.5,260),true,'ground far beyond the door: the doorway');
 assert.equal(throughOpenDoorway(24.5,undefined),true,'no ground under the cursor: the doorway');
 assert.equal(throughOpenDoorway(24.5,25.6),false,'the floor just inside the door: walk there');
 assert.equal(throughOpenDoorway(undefined,10),false,'no door hit');
 const g=src('game.js');
 assert.match(g,/else if\(examineHit&&\['door','castleGate'\]\.includes\(examineHit\.object\.userData\.kind\)&&throughOpenDoorway\(examineHit\.distance,groundHit\?\.distance\)\)\{const a=examineHit\.object\.userData;[^}]*setWalkDestination\(a\.kind==='door'\?housePoint\(a\.house,0,1\):new T\.Vector3\(a\.x,0,a\.z\)\)\}else if\(hitGround\)/);
});

// Live (castle training, walking south 18 tiles into a new region): the server stopped 3 tiles in
// (path [], no intent) while the local walker went on to the end of the click, then was snapped
// 15 tiles back. A blocking area load sent 'stop' to pause the walk and resume it afterwards; with
// movement v3 the local walker walks the click by itself, so the pause only split it from the
// server (and the resume re-planned from a tile the server never reached). In tile mode the server
// keeps the full collision, so the walk simply carries on while the area loads.
test('tile mode: a blocking area load does not stop the server walk under the local walker',()=>{
 const g=src('game.js');
 assert.match(g,/regionTicket=areaLoading\.begin\('Loading nearby area…'\);regionResume=!window\.eldervaleTileMode&&!realmInCombat&&!routePending&&mapDestination\?\{[^}]*\}:null;if\(regionResume\)void window\.eldervaleRealm\?\.command\('stop'\)/);
});

// Live: every left-click attack printed "Approaching creature..." to the chat (the internal kind,
// not the monster's name). Attacking says nothing (OSRS); the fight is the feedback.
test('a left-click attack does not print "Approaching creature..."',()=>{
 const g=src('game.js');assert.match(g,/followActionTarget\(action\);if\(action\.kind!=='npc'&&action\.kind!=='creature'\)say\(/);
});

// Review (movement v3): the local walker plans a click with the server's tile flags, closed doors
// included, but refreshWalkTiles() never refetched them while the player stood still, and nothing
// marked them stale when a door or gate changed. Opening a door, waiting, then clicking through it
// planned the long way round (the server took the door: a re-route mid-walk, the "wrong way first").
test('tile flags: a door or gate change marks them stale, and a stale cache is refetched even standing still',()=>{
 const c=createTileFlagCache();
 // A wall along j=1 with a door at (0,1) (flag 1: blocked tile).
 const view=open=>({center:[0,0],radius:40,tiles:[...Array.from({length:21},(_,k)=>[k-10,1,k===10&&open?0:1])]});
 c.set(view(false),1000);
 const around=planTileMove([0,0],[[0,3*TILE]],c.flagsAt).path.length;assert.ok(around>3,'door shut: around the wall ('+around+' steps)');
 assert.equal(c.stale,false);c.invalidate();assert.equal(c.stale,true);assert.equal(c.flagsAt(0,1),1,'the old flags stay usable until the refetch');
 c.set(view(true),2000);assert.equal(c.stale,false);
 assert.equal(planTileMove([0,0],[[0,3*TILE]],c.flagsAt).path.length,3,'door open: straight through');
 const g=src('game.js');
 assert.match(g,/if\(walkTiles\.covers\(i,j,30\)&&\(now-walkTiles\.fetchedAt<30000\|\|!localWalker\.queue\.length&&!walkTiles\.stale\)\)return;/);
 assert.match(g,/if\(gate\.userData\.gateOpen!==undefined&&gate\.userData\.gateOpen!==open\)walkTiles\.invalidate\(\);/);
 assert.match(g,/if\(house\)\{if\(house\.open!==undefined&&!!house\.open!==!!object\.open\)walkTiles\.invalidate\(\);house\.open=object\.open;/);
});
