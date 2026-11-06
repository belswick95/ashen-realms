import test from 'node:test';import assert from 'node:assert/strict';
import {damp,hipRiseLimit,runStyleWeight,averageQuaternion,RUN_STYLE} from '../run-style.js';

test('run style keeps only part of the swing around the mean',()=>{
 assert.equal(damp(10,4,.5),7);assert.equal(damp(4,4,.2),4);assert.equal(damp(-2,0,1),-2);
 for(const style of Object.values(RUN_STYLE)){for(const k of ['bob','spine','head','arm','forearm'])assert.ok(style[k]>0&&style[k]<1,k);assert.ok(style.lean<0&&style.lean>-20)}
 // A calm jog bounces and swings less than a sprint.
 assert.ok(RUN_STYLE.Jog_Fwd_Loop.bob<=RUN_STYLE.Sprint_Loop.bob&&RUN_STYLE.Jog_Fwd_Loop.arm<=RUN_STYLE.Sprint_Loop.arm);
});

test('run style applies only to running gaits, weighted by the gait fade',()=>{
 assert.equal(runStyleWeight('Walk_Loop',1),0);assert.equal(runStyleWeight('Idle_Loop',1),0);
 assert.equal(runStyleWeight('Jog_Fwd_Loop',.4),.4);assert.equal(runStyleWeight('Sprint_Loop',3),1);assert.equal(runStyleWeight('Jog_Fwd_Loop',NaN),0);
});

test('hip rise limit and quaternion average are well behaved',()=>{
 // Hip directly above the foot can rise until the leg is straight.
 assert.ok(Math.abs(hipRiseLimit({x:0,y:1,z:0},{x:0,y:0,z:0},1.5)-.5)<1e-12);
 // A foot 0.6 ahead: the straight leg reaches less high; out of reach clamps to the foot height.
 assert.ok(Math.abs(hipRiseLimit({x:0,y:1,z:0},{x:0,y:0,z:.6},1)-(-1+.8))<1e-12);assert.equal(hipRiseLimit({x:0,y:1,z:0},{x:0,y:0,z:2},1),-1);
 const s=Math.SQRT1_2,avg=averageQuaternion([[0,0,0,1],[0,s,0,s],[0,-s,0,-s]]);
 // Opposite-sign copies of the same rotation average as the same rotation.
 assert.ok(Math.abs(Math.hypot(...avg)-1)<1e-12);assert.ok(avg[1]>0&&avg[3]>0);
 assert.deepEqual(averageQuaternion([]),[0,0,0,1]);
});
