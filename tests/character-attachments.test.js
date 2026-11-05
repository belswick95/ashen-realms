import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {buildHumanoid} from '../humanoid.js';import {createHumanoidAnimator} from '../animation.js';
const direction=(o,v)=>v.transformDirection(o.matrixWorld);
test('skinned surfaces keep their offsets from the bones while running far from the origin',()=>{
 const offset=far=>{const world=new T.Group(),root=new T.Group();world.add(root);if(far)root.position.set(-340,0,-310);const r=buildHumanoid(T,root,{adventurer:true}),a=createHumanoidAnimator(r);for(let f=0;f<60;f++){a.update(1/60,{distance:.12,speed:7,locomotion:'run'});if(far){root.position.x+=.1;root.rotation.y+=.007}}root.rotation.y=0;world.updateMatrixWorld(true);r.face.computeBoundingBox();return r.face.boundingBox.getCenter(new T.Vector3()).applyMatrix4(r.face.matrixWorld).sub(r.head.getWorldPosition(new T.Vector3()))};
 const near=offset(false),far=offset(true);assert.ok(near.length()<.2,'face sits on the head bone');assert.ok(near.distanceTo(far)<1e-6,'character-local skinning keeps precision');
});
test('hand sockets sit in the fists: blades forward out of the thumb side, shield faces outward',()=>{
 const root=new T.Group(),r=buildHumanoid(T,root),a=createHumanoidAnimator(r);for(let i=0;i<60;i++)a.update(1/60,{});root.updateMatrixWorld(true);
 for(const side of ['left','right']){const socket=r[side+'Hand'],hand=r.bones['hand_'+side[0]];assert.equal(socket.parent,hand);assert.ok(socket.getWorldPosition(new T.Vector3()).distanceTo(hand.getWorldPosition(new T.Vector3()))<.2)}
 const blade=direction(r.rightHand,new T.Vector3(0,1,0));assert.ok(blade.z>.6&&blade.y>.2,'resting blade points forward and up');
 const face=direction(r.leftHand,new T.Vector3(0,0,1));assert.ok(face.x>.6,'shield face points away from the body');
 const rightOut=direction(r.rightHand,new T.Vector3(0,0,1));assert.ok(rightOut.x<-.6,'sockets mirror across the body');
});
