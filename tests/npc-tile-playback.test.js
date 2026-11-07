import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createMotionTrack,createTilePlayback,createTickLateness,TILE_WALK_SPEED,SNAP_TILES} from '../motion-track.js';
import {TILE} from '../tile-grid.js';

// Live cadence (Nov 2026): the world tick runs from a 1 s cron and catches up two 600 ms ticks per
// run, so a town walker's tiles reach the client 1 or 2 at a time, ~1 s apart, with poll jitter.
// The old tick-stamp playback held every gap over 1.5 ticks and then played a 2-tile step in one
// tick: NPCs dashed at twice walking pace (a jog cycle), stood a tick, and dashed again. move157's
// playback chased its buffer at 0.6-1.3x pace (surge, then slow). Movement v3 schedules each tile
// at its tick time, a fixed delay later (one tick, the measured lateness, a jitter margin), and
// walks it at exactly the walking pace.
function cronWalk(sample,push,{walkFrom=0,ms=40000,stallEvery=0,seed=7}={}){let rnd=seed;const rand=()=>(rnd=(rnd*16807)%2147483647)/2147483647;
 const runs=[];for(let t=1000;t<ms;){runs.push(t);t+=1000+Math.round((rand()-.5)*200);if(stallEvery&&runs.length%stallEvery===0)t+=3000}
 const polls=[];for(let t=0;t<ms;t+=600)polls.push(t+Math.round(rand()*120));
 let tile=0,last=0,ri=0,pi=0,srv={x:0,z:0,at:0},prev=null;const speeds=[];
 for(let t=0;t<ms;t+=1000/60){
  while(ri<runs.length&&runs[ri]<=t){const now=runs[ri++],tk=Math.floor(now/600),n=stallEvery?tk-last:Math.min(2,tk-last);last=tk;if(n>0){if(now>=walkFrom&&tile<60)tile=Math.min(60,tile+n);srv={x:0,z:tile*TILE,at:tk*600}}}
  while(pi<polls.length&&polls[pi]+150<=t){pi++;push(srv,t)}
  const s=sample(t);if(s&&prev)speeds.push({t,v:Math.hypot(s.x-prev.x,s.z-prev.z)*60,snapped:s.snapped});if(s)prev={x:s.x,z:s.z}}
 return speeds;}
const window100=speeds=>{const out=[];for(let i=0;i+6<=speeds.length;i+=6)out.push(speeds.slice(i,i+6).reduce((a,c)=>a+c.v,0)/6);return out};

test('tile playback: NPC walking under the 1 s cron cadence moves at exactly the walking pace (no dash, no surge, no stop)',()=>{
 for(const seed of [7,99,1234]){const track=createMotionTrack({delay:650,tileOptions:{lateness:createTickLateness()}});
  // The world's tick reports reach the client (and its lateness meter) before the walk starts.
  const speeds=cronWalk(t=>track.sample(t),(s,t)=>track.pushTile(s.at,{x:s.x,z:s.z,yaw:0,moving:true},t,t),{seed,walkFrom:8000,ms:60000});
  const moving=speeds.filter(s=>s.t>8000);
  const fast=moving.filter(s=>s.v>TILE_WALK_SPEED*1.03+.01);assert.equal(fast.length,0,`seed ${seed}: never faster than walking pace: ${Math.max(...moving.map(s=>s.v)).toFixed(2)}`);
  const first=speeds.findIndex(s=>s.v>.01),last=speeds.findLastIndex(s=>s.v>.01);
  const mid=speeds.slice(first+1,last).filter(s=>Math.abs(s.v-TILE_WALK_SPEED)>TILE_WALK_SPEED*.03);
  assert.ok(mid.length<=2,`seed ${seed}: an even walk from start to stop (${mid.length} uneven frames: ${mid.slice(0,8).map(s=>Math.round(s.t)+':'+s.v.toFixed(2)).join(' ')})`);
  assert.equal(speeds.filter(s=>s.snapped).length,0,`seed ${seed}: no snaps`)}
});

test('tile playback: a backlog is never sprinted; far behind its schedule the walker is placed',()=>{
 const p=createTilePlayback({lateness:null,margin:0});p.push({x:0,z:0,yaw:0},0,0,0);p.sample(0);
 // Three tiles arrive at once, late (a stalled tick catching up): walked at the walking pace, not faster.
 for(let i=1;i<=3;i++)p.push({x:0,z:i*TILE,yaw:0},1800,i*600,1800);let max=0,t=1800,prev=p.sample(t).z;
 for(t=1816;t<5000;t+=16){const s=p.sample(t);assert.equal(s.snapped,false);max=Math.max(max,(s.z-prev)/.016);prev=s.z}
 assert.ok(max<=TILE_WALK_SPEED*1.001,'backlog pace '+max.toFixed(3));assert.ok(Math.abs(prev-3*TILE)<1e-6,'arrives on the last tile');
 // Seven more tiles far behind their schedule: placed on the tile it should be on (flagged: no stride).
 for(let i=4;i<=10;i++)p.push({x:0,z:i*TILE,yaw:0},t+5000,(i+7)*600,t+5000);const s=p.sample(t+5000);
 assert.equal(s.snapped,true);assert.ok(s.z>=6*TILE-1e-6&&s.z<=10*TILE,'placed along the walk: '+(s.z/TILE).toFixed(2));
 assert.equal(p.sample(t+5016).snapped,false,'one frame only');
 // More tiles than two ticks can cover is a teleport: placed at once.
 p.push({x:40,z:10*TILE,yaw:1},t+6000,30*600,t+6000);const tp=p.sample(t+6016);assert.equal(tp.snapped,true);assert.equal(tp.x,40);
});

test('tile playback: a diagonal walk keeps the server pace (one diagonal tile per tick) and never snaps',()=>{
 // Lag counted in units made diagonal walkers fall behind (a diagonal tile is 1.41 units long but one
 // tick on the server) until a two-tile burst pushed them past the snap distance (Corin, Birchford).
 const track=createMotionTrack({delay:650,tileOptions:{lateness:createTickLateness()}});
 const speeds=cronWalk(t=>track.sample(t),(s,t)=>track.pushTile(s.at,{x:s.z,z:s.z,yaw:0,moving:true},t,t),{seed:5,ms:30000});
 assert.equal(speeds.filter(s=>s.snapped).length,0,'no snaps on a steady diagonal walk');
 const mid=window100(speeds.filter(s=>s.t>4000&&s.t<20000)),mean=mid.reduce((a,c)=>a+c,0)/mid.length;
 assert.ok(Math.abs(mean-TILE_WALK_SPEED*Math.SQRT2)<.35,'diagonal ground speed '+mean.toFixed(2));
});

test('tile playback: stopping turns to the server facing smoothly; runners play at two tiles a tick',()=>{
 const p=createTilePlayback({lateness:null});p.push({x:0,z:0,yaw:0},0,0,0);p.sample(0);p.push({x:0,z:0,yaw:Math.PI/2},10,600,10);
 // OSRS: a fast turn (~70-90 ms for 90°), a short visual slerp rather than a one-frame snap or a lazy drift.
 const first=p.sample(16).yaw;assert.ok(first>0&&first<Math.PI/2*.6,'turns over a few frames, not in one: '+first);
 let y=first;for(let t=32;t<=112;t+=16)y=p.sample(t).yaw;assert.ok(Math.abs(y-Math.PI/2)<1e-3,'turned within ~0.1 s: '+y);
 const r=createTilePlayback({lateness:null,margin:0});r.push({x:0,z:0,yaw:0},0,0,0);r.sample(0);for(let k=1;k<=2;k++)r.push({x:0,z:2*k*TILE,yaw:0,stepTiles:2},k*600,k*600,k*600);
 let s;for(let t=0;t<=1700;t+=16)s=r.sample(t);assert.equal(s.run,true);assert.ok(Math.abs(s.speed-2*TILE_WALK_SPEED)<1e-6,'runner pace '+s.speed.toFixed(2));
});

test('game.js: realm NPCs take tile playback (no stride on a snap) and keep a walk gait unless the server says run',()=>{
 const src=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(src,/const snapped=interpolateRealm\(npc,dt\);const distance=snapped\?0:/);
 assert.match(src,/speed:npc\.motionRun\?speed:Math\.min\(speed,TILE_WALK_SPEED\*CATCH_UP\)/);
 assert.match(src,/locomotion:npc\.previewAttack>0\?'combat':npc\.motionRun\?'jog':'walk'/);
 assert.match(src,/actor\.motionRun=sample\.run===true;return sample\.snapped===true/);
});

test('standing room: townsfolk on one tile are eased apart, walkers and a parked horse push but are not moved',async()=>{
 const {spreadStanding,SPREAD_RADIUS,SPREAD_MAX}=await import('../town-life.js');
 const mk=(key,x,z,extra={})=>({key,x,z,moving:false,spread:{x:0,z:0},...extra});
 const a=mk('a',0,0),b=mk('b',0,0),walker=mk('w',.3,0,{moving:true}),horse={key:'h',x:-226,z:120,radius:1.6,spread:null,moving:false},c=mk('c',-225.5,120);
 spreadStanding([a,b],1/60);assert.ok(Math.hypot(a.spread.x-b.spread.x,a.spread.z-b.spread.z)<.1,'eased, not snapped apart in one frame');
 for(let i=0;i<180;i++)spreadStanding([a,b],1/60);
 const gap=Math.hypot(a.spread.x-b.spread.x,a.spread.z-b.spread.z);assert.ok(Math.abs(gap-SPREAD_RADIUS)<.02,'same-tile pair separated to arm\'s length: '+gap.toFixed(2));
 for(let i=0;i<60;i++)spreadStanding([a,b,walker],1/60);
 assert.equal(walker.spread.x,0,'a walker is never nudged');assert.ok(Math.hypot(a.spread.x,a.spread.z)<=SPREAD_MAX+1e-9,'nudges are capped');
 for(let i=0;i<180;i++)spreadStanding([c,horse],1/60);assert.ok(c.spread.x>.4,'pushed out of the parked horse: '+c.spread.x.toFixed(2));
 const far=mk('f',10,10);for(let i=0;i<60;i++)spreadStanding([far,mk('g',12,10)],1/60);assert.equal(far.spread.x,0,'people apart are left alone');
});

test('game.js: spread offsets are presentation only (removed before travel is measured)',()=>{
 const src=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(src,/if\(window\.eldervaleAuthority\)spreadTownsfolk\(dt\);\nfor\(const npc of npcs\)\{/);
 assert.match(src,/const before=actorBefore\.copy\(npc\.root\.position\);if\(shown\)\{before\.x-=shown\.x;before\.z-=shown\.z\}const snapped=interpolateRealm\(npc,dt\);/);
});
