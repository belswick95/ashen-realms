import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {buildCharacterDisplay} from '../character-display.js';import {weaponCatalog} from '../weapons.js';
const direction=(o,v)=>v.transformDirection(o.matrixWorld);
const MOTIONS={idle:{},walk:{distance:3.2/60,speed:3.2,locomotion:'walk'},run:{distance:6.4/60,speed:6.4,locomotion:'run'}};
test('every weapon stays in the right fist and clear of the ground through idle, walking and running',()=>{
 for(const weapon of Object.keys(weaponCatalog))for(const [name,motion] of Object.entries(MOTIONS)){
  const d=buildCharacterDisplay(T,new T.Group(),{},{weapon,shield:'kite'});for(let i=0;i<40;i++)d.update(1/60,motion);d.visual.updateMatrixWorld(true);
  const held=d.rig.rightHand.children.filter(o=>o.isGroup);assert.equal(held.length,1,weapon);
  const box=new T.Box3().setFromObject(held[0]);assert.ok(box.min.y>.8,weapon+' '+name+' stays above the knees');
  assert.ok(direction(held[0],new T.Vector3(0,1,0)).y>0,weapon+' '+name+' blade is not pointed at the ground');
  if(weapon!=='twohand')assert.equal(d.rig.leftHand.children.filter(o=>o.isGroup&&o.userData.shieldMount).length,1);
  d.dispose();
 }
});
test('the shield faces away from the body while carried',()=>{
 for(const [name,motion] of Object.entries(MOTIONS)){const d=buildCharacterDisplay(T,new T.Group(),{},{weapon:'longsword',shield:'kite'});for(let i=0;i<40;i++)d.update(1/60,motion);d.visual.updateMatrixWorld(true);const shield=d.rig.leftHand.children.find(o=>o.isGroup),face=direction(shield,new T.Vector3(0,0,1)),side=shield.getWorldPosition(new T.Vector3());assert.ok(side.x>0,'carried on the left');assert.ok(face.x>.3,name+' face points outward, not into the body');d.dispose()}
});
test('a greatsword is held alone, with no shield in the other hand',()=>{const d=buildCharacterDisplay(T,new T.Group(),{},{weapon:'twohand',shield:'kite'});for(const attack of [.5,.3,.1]){d.update(.016,{attack});assert.equal(d.rig.leftHand.children.filter(o=>o.isGroup).length,0)}d.dispose()});
