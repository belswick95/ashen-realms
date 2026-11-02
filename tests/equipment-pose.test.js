import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {buildCharacterDisplay} from '../character-display.js';
const direction=(o,v)=>o.localToWorld(v).sub(o.getWorldPosition(new T.Vector3())).normalize();
test('one-handed swords point forward and upward while the shield faces the outside of the left forearm',()=>{
 for(const weapon of ['longsword','scimitar','shortsword'])for(const speed of [0,1.5,5]){
  const d=buildCharacterDisplay(T,new T.Group(),{},{weapon,shield:'kite'});
  for(let i=0;i<30;i++)d.update(1/60,{distance:speed/60,speed});d.visual.updateMatrixWorld(true);
  const sword=d.rig.rightHand.children[0],shield=d.rig.leftHand.children[0],blade=direction(sword,new T.Vector3(0,1,0)),face=direction(shield,new T.Vector3(0,0,1));
  assert.ok(blade.y>.45&&blade.z>.45,'blade rises diagonally ahead of the hand');assert.ok(face.x>.65&&face.z>.25,'shield front points out and ahead, not toward the body');assert.ok(Math.abs(face.y)<.2,'shield remains upright');
  assert.ok(sword.getWorldPosition(new T.Vector3()).y<1.55,'sword hand stays near the hip');
 }
});
test('two-handed wrist IK controls the blade without a second attachment rotation',()=>{
 const d=buildCharacterDisplay(T,new T.Group(),{},{weapon:'twohand',shield:'kite'});
 for(const attack of [.5,.3,.1]){d.update(.016,{attack});d.visual.updateMatrixWorld(true);const sword=d.rig.rightHand.children[0],blade=direction(sword,new T.Vector3(0,1,0));assert.ok(blade.y>-.4);assert.equal(d.rig.leftHand.children.length,0);assert.ok(d.rig.rightHand.getWorldPosition(new T.Vector3()).distanceTo(d.rig.leftHand.getWorldPosition(new T.Vector3()))<.13)}
});

test('greatsword rests upright on the right shoulder with the left hand free',()=>{const d=buildCharacterDisplay(T,new T.Group(),{},{weapon:'twohand'});d.update(.016,{});d.visual.updateMatrixWorld(true);const sword=d.rig.rightHand.children[0],blade=direction(sword,new T.Vector3(0,1,0));assert.ok(blade.y>.95);assert.ok(d.rig.rightHand.getWorldPosition(new T.Vector3()).x<-.25);assert.ok(d.rig.rightHand.getWorldPosition(new T.Vector3()).distanceTo(d.rig.leftHand.getWorldPosition(new T.Vector3()))>.4)});
