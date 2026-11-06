import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {weaponCatalog,isRanged,isTwoHanded,isMagic,isBow,makeWeapon} from '../weapons.js';import {npcAppearance} from '../npc-looks.js';import {shieldCatalog,makeShield} from '../shields.js';
import {buildHumanoid} from '../humanoid.js';import {createHumanoidAnimator} from '../animation.js';import {buildCharacterDisplay,publicCharacter} from '../character-display.js';
import {createArrows} from '../arrows.js';import {weaponStore} from '../weapon-assets.js';

test('every weapon and shield has a model, and bows are two-handed ranged weapons',()=>{
 // Gear-tier variants reuse an iron model (recoloured): `model` names it.
 for(const [key,item] of [...Object.entries(weaponCatalog),...Object.entries(shieldCatalog),['arrow',{}]])assert.ok(weaponStore.items[item.model||key],key);
 for(const key of Object.keys(weaponCatalog)){const g=makeWeapon(T,key);let meshes=0;g.traverse(o=>{if(o.isMesh)meshes++});assert.ok(meshes>0,key)}
 for(const key of Object.keys(shieldCatalog)){const g=makeShield(T,key);let meshes=0;g.traverse(o=>{if(o.isMesh)meshes++});assert.ok(meshes>0,key)}
 const bows=Object.keys(weaponCatalog).filter(isBow);assert.deepEqual(bows,['woodenBow','longbow','goldenBow','bloodthornBow','oakShortbow','willowShortbow','mapleShortbow','yewShortbow']);
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

test('staffs are two-handed magic: held upright in the right hand, with a gem tip and a gem colour',()=>{
 const staffs=Object.keys(weaponCatalog).filter(isMagic);assert.deepEqual(staffs.filter(k=>!weaponCatalog[k].unique),['apprenticeStaff','sapphireStaff','amethystStaff','emberStaff']);
 for(const key of staffs){const w=weaponCatalog[key];assert.ok(isRanged(key)&&isTwoHanded(key)&&!isBow(key),key);assert.ok(w.reach>=10&&Number.isInteger(w.color),key);
  const g=makeWeapon(T,key),tip=g.getObjectByName('tip');assert.ok(tip&&tip.position.y>.9,key+' tip near the gem')}
 const d=buildCharacterDisplay(T,new T.Group(),{},{weapon:'sapphireStaff',shield:'kite'});let pose;for(let i=0;i<30;i++)pose=d.update(1/60,{});
 assert.equal(d.data.loadout.shield,null);assert.equal(d.rig.rightHand.children.filter(o=>o.userData.weaponMount).length,1);assert.equal(pose.gait,'Idle_Loop');
 d.visual.updateMatrixWorld(true);const staff=d.rig.rightHand.children.find(o=>o.userData.weaponMount);assert.ok(new T.Vector3(0,1,0).transformDirection(staff.matrixWorld).y>.95,'upright');d.dispose();
});
test('a staff attack casts with the spell clip and releases one bolt from the casting hand',()=>{
 const root=new T.Group(),rig=buildHumanoid(T,root),a=createHumanoidAnimator(rig);let releases=0,clip=null,attack=.55;
 for(let i=0;i<60;i++){const pose=a.update(1/60,{armed:true,ranged:true,magic:true,attack});attack=Math.max(0,attack-1/60);if(pose.released){releases++;clip=pose.clip;root.updateMatrixWorld(true);assert.ok(rig.leftHand.getWorldPosition(new T.Vector3()).z>.6,'casting hand forward')}assert.equal(pose.aim,0,'no bow draw')}
 assert.equal(releases,1);assert.equal(clip,'Spell_Simple_Shoot');
});
test('spell bolts fly straight and vanish on impact, disposing their glow',()=>{
 const scene=new T.Scene(),arrows=createArrows(T,scene);const bolt=arrows.fire(new T.Vector3(0,1.6,0),new T.Vector3(0,1.6,9),{kind:'bolt',color:0xc45bff});
 assert.ok(bolt.userData.spellBolt);let disposed=0;bolt.traverse(o=>{if(o.isMesh)o.material.addEventListener('dispose',()=>disposed++)});
 arrows.update(.15);assert.ok(Math.abs(bolt.position.y-1.6)<1e-9,'no arc');assert.ok(new T.Vector3(0,1,0).applyQuaternion(bolt.quaternion).z>.99);
 arrows.update(.3);arrows.update(.01);assert.equal(arrows.count,0);assert.equal(bolt.parent,null);assert.ok(disposed>0);
});
test('wizard NPCs carry the staff matching their robe',()=>{
 const seen=new Set();for(let i=0;i<6;i++){const d=npcAppearance({role:'Court wizard'},i);assert.ok(isMagic(d.staff));const robe=Object.keys(d.equipped)[0];seen.add(d.staff+':'+robe.slice(-1))}
 for(const pair of seen)assert.ok(['sapphireStaff:1','amethystStaff:2','emberStaff:3'].includes(pair),pair);
 assert.equal(npcAppearance({role:'Baker'},0).staff,null);
});
import {goods} from '../economy.js';import {fromPlayerRow,toPlayerRow} from '../player-save.js';import {usesArrows} from '../weapons.js';
test('bows use the fletched Iron arrows as ammunition; staffs and melee weapons need none',()=>{
 assert.equal(goods.arrows.name,'Iron arrows');assert.equal(goods.arrows.stackable,true);assert.equal(goods.arrows.field,undefined,'a stack, not an equipment slot');
 for(const bow of ['woodenBow','longbow','goldenBow','bloodthornBow'])assert.ok(usesArrows(bow),bow);
 for(const other of ['apprenticeStaff','emberStaff','longsword',null])assert.equal(usesArrows(other),false,String(other));
 const s=fromPlayerRow({stats:{arrows:37},inventory:{},equipment:{},skills:{}});assert.equal(s.arrows,37);assert.equal(toPlayerRow(s,{id:'t'}).stats.arrows,37);
});
