import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {publicCharacter,buildCharacterDisplay} from '../character-display.js';import {ensurePart} from '../character-assets.js';import {outfitItems} from '../outfits.js';
// World-space bounds of skinned meshes in their current pose.
const skinnedBox=meshes=>{const b=new T.Box3();for(const m of meshes){m.computeBoundingBox();b.union(m.boundingBox.clone().applyMatrix4(m.matrixWorld))}return b};
const loaded=keys=>Promise.all(keys.map(k=>ensurePart(outfitItems[k].male)));

test('public character payload contains cosmetic data only and rejects unknown equipment',()=>{const p=publicCharacter({hair:'Long',sex:'female',password:'private'},{armor:{helm:true,admin:true},weapon:'admin',shield:'kite',gold:1000});assert.equal(p.appearance.password,undefined);assert.equal(p.appearance.sex,'female');assert.equal(p.loadout.gold,undefined);assert.equal(p.loadout.armor.admin,undefined);assert.equal(p.loadout.armor.helm,true);assert.equal(p.loadout.weapon,null);assert.equal(p.loadout.shield,'kite')});

test('public loadout keeps at most one item per equipment slot',()=>{const p=publicCharacter({},{armor:{helm:true,knightHornedHelm2:true,chest:true,rangerTunic1:true,cape:true}});assert.equal(Object.keys(p.loadout.armor).filter(k=>outfitItems[k]?.slot==='helm').length,1);assert.equal(Object.keys(p.loadout.armor).filter(k=>outfitItems[k]?.slot==='chest').length,1);assert.equal(p.loadout.armor.cape,true)});

test('malformed presence cosmetics fall back safely instead of crashing character rendering',()=>{for(const value of [null,[],42,'bad']){const p=publicCharacter(value,value);assert.equal(p.appearance.sex,'male');assert.deepEqual(p.loadout.armor,{});assert.equal(p.loadout.weapon,null);const d=buildCharacterDisplay(T,new T.Group(),value,value);d.update(1/60,{});d.dispose()}});

test('remote display dresses shared outfit parts, animates and disposes safely',async()=>{
 await loaded(['helm','chest']);
 const scene=new T.Group(),display=buildCharacterDisplay(T,scene,{hair:'Long',beard:'Beard'},{armor:{helm:true,chest:true,cape:true},weapon:'longsword',shield:'kite'});
 assert.equal(display.rig.parts.chest.key,'chest');assert.equal(display.rig.parts.helm.key,'helm');assert.equal(display.rig.parts.legs.key,'peasantTrousers1');
 assert.ok(display.rig.hairMeshes.length&&display.rig.hairMeshes.every(m=>!m.visible));
 let cape=null;display.visual.traverse(o=>{if(o.userData.attachedCape)cape=o});assert.ok(cape,'cape is worn');
 assert.equal(display.rig.rightHand.children.filter(o=>o.isGroup).length,1);assert.equal(display.rig.leftHand.children.filter(o=>o.isGroup).length,1);
 const pose=display.update(.05,{distance:.2,speed:4});assert.equal(pose.gait,'Mixamo_Run');
 const shared=display.rig.parts.chest.meshes[0];let sharedDisposed=false;shared.geometry.addEventListener('dispose',()=>sharedDisposed=true);shared.material.addEventListener('dispose',()=>sharedDisposed=true);
 display.dispose();assert.equal(scene.children.length,0);assert.equal(sharedDisposed,false);
});

test('a two-handed weapon never shows a shield',()=>{const d=buildCharacterDisplay(T,new T.Group(),{},{weapon:'twohand',shield:'kite'});assert.equal(d.data.loadout.shield,null);assert.equal(d.rig.leftHand.children.filter(o=>o.isGroup).length,0);d.dispose()});

test('the armet encloses the face and follows the head through body movement',async()=>{
 await loaded(['helm']);
 const scene=new T.Group(),d=buildCharacterDisplay(T,scene,{},{armor:{helm:true}});scene.updateMatrixWorld(true);
 const helm=()=>skinnedBox(d.rig.parts.helm.meshes),face=()=>skinnedBox(d.rig.faceMeshes);
 for(const lean of [0,.5]){d.rig.bones.spine_01.rotation.x=lean;scene.updateMatrixWorld(true);const h=helm(),f=face();assert.ok(h.min.x<f.min.x&&h.max.x>f.max.x&&h.max.y>f.max.y&&h.max.z>f.max.z,'helm covers the head at lean '+lean)}
 assert.ok(helm().min.z>.15,'helm moved forward with the leaning head');d.dispose();
});

test('chest and leg armour replace those clothes while uncovered regions keep the starter outfit, without stale shadows',async()=>{
 await loaded(['chest','legs']);
 const d=buildCharacterDisplay(T,new T.Group(),{shirtVariant:2},{armor:{chest:true,legs:true}});
 assert.equal(d.rig.parts.chest.key,'chest');assert.equal(d.rig.parts.legs.key,'legs');assert.equal(d.rig.parts.arms.key,'peasantSleeves2');assert.equal(d.rig.parts.boots.key,'peasantShoes1');
 for(const m of d.rig.allMeshes)assert.equal(m.receiveShadow,false,m.name);
 d.dispose();
});
