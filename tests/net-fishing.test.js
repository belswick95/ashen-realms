import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {netDipPhase,ACTIVITY_CLIPS} from '../animation.js';

test('net cycle: raised, lowered into the water at the splash beat, scooped, lifted, continuous',()=>{
 assert.ok(netDipPhase(.05).height>.8,'starts with the net held over the water');
 assert.ok(netDipPhase(.35).height<=0&&netDipPhase(.5).height<0,'under the surface from the splash beat (35%) through the scoop');
 assert.ok(netDipPhase(.5).lean===1&&netDipPhase(.05).lean<.5,'leans over the bank for the dip');
 assert.ok(netDipPhase(.9).height>.8,'lifted back out');
 let prev=netDipPhase(0);for(let u=.002;u<=1.0001;u+=.002){const p=netDipPhase(u);assert.ok(Math.abs(p.height-prev.height)<.05&&Math.abs(p.lean-prev.lean)<.05,'no pop at '+u.toFixed(3));prev=p}
 assert.deepEqual(netDipPhase(1.3),netDipPhase(.3));assert.deepEqual(netDipPhase(NaN),netDipPhase(0));
});
test('net fishing kneels at the bank and the net reaches the spot water line',()=>{
 assert.equal(ACTIVITY_CLIPS.net,'Fixing_Kneeling');
 const src=fs.readFileSync(new URL('../gathering-visuals.js',import.meta.url),'utf8');
 assert.match(src,/waterHeight\(job\)/,'uses the fishing spot water height');assert.match(src,/r\.netDip=a\.dip/);
 assert.match(src,/a\.actor\.rig\.netDip=null/,'clears the pose when the job ends');
});
