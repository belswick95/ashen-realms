import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createMotionTrack,createTilePlayback,TILE_WALK_SPEED,CATCH_UP,SNAP_TILES} from '../motion-track.js';
import {TILE} from '../tile-grid.js';

// Live cadence (Nov 2026): the world tick runs from a 1 s cron and catches up two 600 ms ticks per
// run, so a town walker's tiles reach the client 1 or 2 at a time, ~1 s apart, with poll jitter.
// The old tick-stamp playback held every gap over 1.5 ticks and then played a 2-tile step in one
// tick: NPCs dashed at twice walking pace (a jog cycle), stood a tick, and dashed again.
function cronWalk(sample,push,{ms=40000,stallEvery=0,seed=7}={}){let rnd=seed;const rand=()=>(rnd=(rnd*16807)%2147483647)/2147483647;
 const runs=[];for(let t=1000;t<ms;){runs.push(t);t+=1000+Math.round((rand()-.5)*200);if(stallEvery&&runs.length%stallEvery===0)t+=3000}
 const polls=[];for(let t=0;t<ms;t+=600)polls.push(t+Math.round(rand()*120));
 let tile=0,last=0,ri=0,pi=0,srv={x:0,z:0,at:0},prev=null;const speeds=[];
 for(let t=0;t<ms;t+=1000/60){
  while(ri<runs.length&&runs[ri]<=t){const now=runs[ri++],tk=Math.floor(now/600),n=stallEvery?tk-last:Math.min(2,tk-last);last=tk;if(n>0&&tile<60){tile=Math.min(60,tile+n);srv={x:0,z:tile*TILE,at:tk*600}}}
  while(pi<polls.length&&polls[pi]+150<=t){pi++;push(srv,t)}
  const s=sample(t);if(s&&prev)speeds.push({t,v:Math.hypot(s.x-prev.x,s.z-prev.z)*60,snapped:s.snapped});if(s)prev={x:s.x,z:s.z}}
 return speeds;}
const window100=speeds=>{const out=[];for(let i=0;i+6<=speeds.length;i+=6)out.push(speeds.slice(i,i+6).reduce((a,c)=>a+c.v,0)/6);return out};

test('tile playback: NPC walking under the 1 s cron cadence moves at a steady walking pace (no dash-stop-dash)',()=>{
 for(const seed of [7,99,1234]){const track=createMotionTrack({delay:650});
  const speeds=cronWalk(t=>track.sample(t),(s,t)=>track.pushTile(s.at,{x:s.x,z:s.z,yaw:0,moving:true},t),{seed});
  const mid=window100(speeds.filter(s=>s.t>4000&&s.t<20000));
  assert.ok(Math.max(...mid)<=TILE_WALK_SPEED*CATCH_UP+.01,`seed ${seed}: never faster than ${CATCH_UP}x walking pace: ${Math.max(...mid).toFixed(2)}`);
  assert.equal(mid.filter(v=>v<.3).length,0,`seed ${seed}: never stands still mid-walk`);
  const mean=mid.reduce((a,c)=>a+c,0)/mid.length;assert.ok(Math.abs(mean-TILE_WALK_SPEED)<.25,'average is the true walking pace: '+mean.toFixed(2));
  assert.ok(Math.min(...mid)>TILE_WALK_SPEED*.7,'a late tile slows the walker a little, never to a stop: '+Math.min(...mid).toFixed(2))}
});

test('tile playback: a backlog is caught up at no more than 1.3x pace, beyond 4 tiles the walker is placed (no sprint)',()=>{
 const p=createTilePlayback();let t=0;p.push({x:0,z:0,yaw:0},t);p.sample(t);
 // Three tiles arrive at once (a stalled tick catching up): walked at <= 1.3x pace, not snapped.
 for(let i=1;i<=3;i++)p.push({x:0,z:i*TILE,yaw:0},t);let prev=0,max=0;
 for(t=16;t<4000;t+=16){const s=p.sample(t);assert.equal(s.snapped,false);max=Math.max(max,(s.z-prev)/.016);prev=s.z}
 assert.ok(max<=TILE_WALK_SPEED*CATCH_UP+1e-6,'catch-up speed '+max.toFixed(2));assert.ok(Math.abs(prev-3*TILE)<1e-6,'arrives on the last tile');
 // Seven tiles behind: placed two tiles behind the newest at once, flagged so no stride plays for it.
 for(let i=4;i<=10;i++)p.push({x:0,z:i*TILE,yaw:0},t);const s=p.sample(t+16);
 assert.equal(s.snapped,true);assert.ok(s.z>=8*TILE-1e-6&&s.z<8.2*TILE,'snapped two tiles behind: '+(s.z/TILE).toFixed(2));
 assert.equal(p.sample(t+32).snapped,false,'one frame only');
 // A teleport (over 12 units) is placed at once too.
 p.push({x:40,z:10*TILE,yaw:1},t+48);const tp=p.sample(t+64);assert.equal(tp.snapped,true);assert.equal(tp.x,40);
});

test('tile playback: stopping turns to the server facing smoothly; runners play at two tiles a tick',()=>{
 const p=createTilePlayback();p.push({x:0,z:0,yaw:0},0);p.sample(0);p.push({x:0,z:0,yaw:Math.PI/2},10);
 const first=p.sample(16).yaw;assert.ok(first>0&&first<Math.PI/2*.3,'turns over a few frames, not in one: '+first);
 let y=0;for(let t=32;t<800;t+=16)y=p.sample(t).yaw;assert.ok(Math.abs(y-Math.PI/2)<1e-3);
 const r=createTilePlayback();r.push({x:0,z:0,yaw:0},0);r.sample(0);for(let i=1;i<=4;i++)r.push({x:0,z:i*TILE,yaw:0,stepTiles:2},0);
 const s=r.sample(100);assert.equal(s.run,true);assert.ok(s.speed>TILE_WALK_SPEED*1.5,'runner pace '+s.speed.toFixed(2));
});

test('game.js: realm NPCs take tile playback (no stride on a snap) and keep a walk gait unless the server says run',()=>{
 const src=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(src,/const snapped=interpolateRealm\(npc,dt\);const distance=snapped\?0:/);
 assert.match(src,/speed:npc\.motionRun\?speed:Math\.min\(speed,TILE_WALK_SPEED\*CATCH_UP\)/);
 assert.match(src,/locomotion:npc\.previewAttack>0\?'combat':npc\.motionRun\?'jog':'walk'/);
 assert.match(src,/actor\.motionRun=sample\.run===true;return sample\.snapped===true/);
});
