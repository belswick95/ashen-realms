import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {weaponCatalog,isRanged,isTwoHanded,makeWeapon} from '../weapons.js';import {shieldCatalog,makeShield} from '../shields.js';
import {buildHumanoid} from '../humanoid.js';import {createHumanoidAnimator} from '../animation.js';import {buildCharacterDisplay,publicCharacter} from '../character-display.js';
import {createArrows} from '../arrows.js';import {weaponStore} from '../weapon-assets.js';

test('every weapon and shield has a model, and bows are two-handed ranged weapons',()=>{
 for(const key of [...Object.keys(weaponCatalog),...Object.keys(shieldCatalog),'arrow'])assert.ok(weaponStore.items[key],key);
 for(const key of Object.keys(weaponCatalog)){const g=makeWeapon(T,key);let meshes=0;g.traverse(o=>{if(o.isMesh)meshes++});assert.ok(meshes>0,key)}
 for(const key of Object.keys(shieldCatalog)){const g=makeShield(T,key);let meshes=0;g.traverse(o=>{if(o.isMesh)meshes++});assert.ok(meshes>0,key)}
 const bows=Object.keys(weaponCatalog).filter(isRanged);assert.deepEqual(bows,['woodenBow','longbow','goldenBow','bloodthornBow']);
 for(const bow of bows){assert.ok(isTwoHanded(bow));assert.ok(weaponCatalog[bow].reach>=12)}
 for(const key of ['twohand','claymore','warhammer','scythe'])assert.ok(isTwoHanded(key),key);
 assert.equal(isTwoHanded('longsword'),false);assert.equal(isRanged(undefined),false);
});
test('held models share geometry and keep their own normalising transform inside a free outer group',()=>{
 const a=makeWeapon(T,'longbow'),b=makeWeapon(T,'longbow'),mesh=g=>{let m;g.traverse(o=>{if(!m&&o.isMesh)m=o});return m};
 assert.equal(mesh(a).geometry,mesh(b).geometry);assert.ok(mesh(a).geometry.userData.eldervaleShared);
 a.position.set(1,2,3);assert.notEqual(a.getObjectByName('model'),undefined);assert.deepEqual(a.getObjectByName('model').position.toArray(),b.getObjectByName('model').position.toArray());
});
test('a bow is held in the left hand without a shield, and archers idle normally',()=>{
 assert.equal(publicCharacter({},{weapon:'longbow',shield:'kite'}).loadout.shield,null);
 const d=buildCharacterDisplay(T,new T.Group(),{},{weapon:'longbow',shield:'kite'});let pose;for(let i=0;i<30;i++)pose=d.update(1/60,{});
 assert.equal(d.rig.leftHand.children.filter(o=>o.userData.weaponMount).length,1);assert.equal(d.rig.rightHand.children.filter(o=>o.isGroup).length,0);
 assert.equal(pose.gait,'Idle_Loop');d.dispose();
});
test('a bow attack raises the bow, draws the string, releases once and lowers again',()=>{
 const root=new T.Group(),rig=buildHumanoid(T,root),a=createHumanoidAnimator(rig),bow=makeWeapon(T,'longbow');rig.leftHand.add(bow);
 const W=o=>o.getWorldPosition(new T.Vector3());let pose,releases=0,maxDraw=0,raised=null,attack=.55;
 for(let i=0;i<90;i++){pose=a.update(1/60,{armed:true,ranged:true,attack});attack=Math.max(0,attack-1/60);if(pose.released)releases++;maxDraw=Math.max(maxDraw,pose.draw);if(i===20){root.updateMatrixWorld(true);raised={hand:W(rig.leftHand),pull:W(rig.rightHand),up:new T.Vector3(0,1,0).transformDirection(rig.leftHand.matrixWorld)}}}
 assert.equal(releases,1);assert.ok(maxDraw>.9);assert.equal(pose.clip==='Sword_Attack',false,'no sword swing');
 assert.ok(raised.hand.z>.45&&raised.hand.y>1.8,'bow arm extended forward at shoulder height');assert.ok(raised.up.y>.8,'bow held upright');assert.ok(raised.pull.z<raised.hand.z-.3,'string hand drawn back');
 root.updateMatrixWorld(true);assert.equal(pose.aim,0);assert.ok(W(rig.leftHand).y<1.8,'bow lowered afterwards');
});
test('arrows fly tip-first from the bow to the target, land on time, then disappear',()=>{
 const scene=new T.Scene(),arrows=createArrows(T,scene),target=new T.Object3D();target.position.set(0,0,12);scene.add(target);scene.updateMatrixWorld(true);
 const arrow=arrows.fire(new T.Vector3(0,1.6,0),target);assert.ok(arrow);assert.equal(arrows.count,1);
 arrows.update(.1);const tip=new T.Vector3(0,1,0).applyQuaternion(arrow.quaternion);assert.ok(tip.z>.9,'tip leads');assert.ok(arrow.position.z>0&&arrow.position.z<12);
 arrows.update(.2);assert.ok(arrow.position.distanceTo(new T.Vector3(0,1.5,12))<1e-6,'lands on the chest');
 arrows.update(.7);assert.equal(arrows.count,0);assert.equal(arrow.parent,null);
 assert.equal(arrows.fire(new T.Vector3(),new T.Vector3()),null,'no zero-length shots');
});
