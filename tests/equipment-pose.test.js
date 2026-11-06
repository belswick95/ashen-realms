import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {buildCharacterDisplay} from '../character-display.js';import {weaponCatalog,isRanged,isTwoHanded,isBow} from '../weapons.js';import {carryStyle} from '../equipment-pose.js';
const direction=(o,v)=>v.transformDirection(o.matrixWorld);
const MOTIONS={idle:{},walk:{distance:3.2/60,speed:3.2,locomotion:'walk'},run:{distance:6.4/60,speed:6.4,locomotion:'run'}};
test('every weapon stays in its fist (bows in the left) and clear of the ground through idle, walking and running',()=>{
 for(const weapon of Object.keys(weaponCatalog))for(const [name,motion] of Object.entries(MOTIONS)){
  const d=buildCharacterDisplay(T,new T.Group(),{},{weapon,shield:'kite'});for(let i=0;i<40;i++)d.update(1/60,motion);d.visual.updateMatrixWorld(true);
  const hand=isBow(weapon)?d.rig.leftHand:d.rig.rightHand,held=hand.children.filter(o=>o.isGroup&&o.userData.weaponMount);assert.equal(held.length,1,weapon);
  // Standing, blades point forward and up out of the fist; on the move they are
  // carried low (tip down and back) so they never swing up at the face;
  // two-handed swords ride the shoulder and battleaxes are held out in front.
  const box=new T.Box3().setFromObject(held[0]),moving=name!=='idle',magic=weaponCatalog[weapon].magic,up=direction(held[0],new T.Vector3(0,1,0)).y;
  assert.ok(box.min.y>(isRanged(weapon)||moving?.05:.8),weapon+' '+name+(isRanged(weapon)||moving?' clears the ground':' stays above the knees'));
  if(magic)assert.ok(up>(moving?.8:.9),weapon+' '+name+' staff stands upright');
  else if(isBow(weapon)||!moving||['greatsword','battleaxe'].includes(carryStyle(weapon)))assert.ok(up>0,weapon+' '+name+' is not pointed at the ground');
  else assert.ok(up<0,weapon+' '+name+' is carried low, tip down');
  assert.equal(d.rig.leftHand.children.filter(o=>o.isGroup&&o.userData.shieldMount).length,isTwoHanded(weapon)?0:1,weapon+' shield');
  d.dispose();
 }
});
test('the shield faces away from the body while carried',()=>{
 for(const [name,motion] of Object.entries(MOTIONS)){const d=buildCharacterDisplay(T,new T.Group(),{},{weapon:'longsword',shield:'kite'});for(let i=0;i<40;i++)d.update(1/60,motion);d.visual.updateMatrixWorld(true);const shield=d.rig.leftHand.children.find(o=>o.isGroup),face=direction(shield,new T.Vector3(0,0,1)),side=shield.getWorldPosition(new T.Vector3());assert.ok(side.x>0,'carried on the left');assert.ok(face.x>.3,name+' face points outward, not into the body');d.dispose()}
});
test('a greatsword is held alone, with no shield in the other hand',()=>{const d=buildCharacterDisplay(T,new T.Group(),{},{weapon:'twohand',shield:'kite'});for(const attack of [.5,.3,.1]){d.update(.016,{attack});assert.equal(d.rig.leftHand.children.filter(o=>o.isGroup).length,0)}d.dispose()});
