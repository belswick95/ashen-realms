import test from 'node:test';import assert from 'node:assert/strict';
import {createMotionTrack} from '../motion-track.js';
import {holdGait,lodStep,characterLod} from '../graphics-quality.js';

// A townsfolk walker at 1.4 m/s whose snapshots (every 250 ms of server time)
// arrive with a jittery 300-1100 ms latency, as on a tablet over Wi-Fi.
function walk(track,{latency}){const packets=Array.from({length:60},(_,i)=>({time:i*250,arrival:i*250+latency(i),x:i*.35}));let stalls=0,last=null,lastX=null;
 for(let now=0;now<15500;now+=1000/60){for(const p of packets)if(!p.sent&&p.arrival<=now){p.sent=true;track.push(p.time,{x:p.x,z:0,yaw:0},now)}
  const s=track.sample(now);if(!s)continue;if(lastX!==null&&now>3000&&now<14000&&s.x-lastX<1e-6)stalls++;lastX=s.x;last=s}
 return {stalls,last}}

test('a late snapshot slows NPC presentation instead of freezing it, and the delay adapts',()=>{
 const latency=i=>i%12>=4&&i%12<=7?1300:300;// a slow patch of replies every 3 s
 const fixed=walk(createMotionTrack({delay:650,maxExtra:0}),{latency}),adaptive=walk(createMotionTrack({delay:650}),{latency});
 assert.ok(fixed.stalls>0,'a fixed 650 ms buffer runs dry on 1.1 s replies: '+fixed.stalls);
 assert.ok(adaptive.stalls<fixed.stalls/3,'adaptive delay removes most stalls: '+adaptive.stalls+' vs '+fixed.stalls);
});
test('the adaptive delay never rewinds and is bounded',()=>{
 const t=createMotionTrack({delay:650,maxExtra:600});t.push(0,{x:0,z:0,yaw:0},0);t.push(250,{x:1,z:0,yaw:0},0);
 let prev=-Infinity;for(let now=0;now<5000;now+=16){const s=t.sample(now);assert.ok(s.x>=prev);prev=s.x}
 assert.ok(t.extraDelay<=600);
});
test('gait hold bridges short still frames but shows a real stop',()=>{
 const a={};assert.equal(holdGait(a,1/60,.03).distance,.03);
 const held=holdGait(a,1/60,0);assert.ok(held.distance>0&&held.speed>1,'a one-frame gap keeps walking');
 let g;for(let i=0;i<30;i++)g=holdGait(a,1/60,0);assert.equal(g.distance,0,'half a second still is a stop');
 const idle={};assert.equal(holdGait(idle,1/60,0).distance,0,'an idle actor never starts walking');
});
test('throttled far characters still update at least 20 times a second',()=>{
 const s={};let n=0;const far=characterLod(60,'medium');assert.equal(far.draw,true);
 for(let f=0;f<60;f++)if(lodStep(s,1/60,far.interval,.3))n++;
 assert.ok(n>=19,'updates per second: '+n);
});
