// QA2 gameplay and world pass (release move3v161). Each test reproduces a bug found live or in review.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createLocalWalker,TICK_MS} from '../motion-track.js';
import {TILE} from '../tile-grid.js';

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
