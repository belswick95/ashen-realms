import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {safeAppearance,appearanceDefaults,HAIRSTYLES,SKINS,HAIRS} from '../appearance.js';import {buildHumanoid,HAIR_MESHES} from '../humanoid.js';
test('legacy appearances map onto the current choices without resetting the character',()=>{
 const old={skin:'#d9a67e',hairColor:'#5b3c28',shirt:'#297e52',pants:'#232327',hair:'Ponytail',face:'Angular',beard:'Short beard'};
 const a=safeAppearance(old);assert.equal(a.skin,old.skin);assert.equal(a.hairColor,old.hairColor);assert.equal(a.hair,'Buns');assert.equal(a.beard,'Beard');assert.equal(a.sex,'male');
 for(const key of ['shirt','pants','face'])assert.equal(a[key],undefined,'retired field '+key+' is dropped');
 assert.deepEqual(safeAppearance({hair:'Spiky',beard:'Goatee'}),{...appearanceDefaults,hair:'Buzz cut',beard:'Beard'});
});
test('validation rejects foreign values and keeps beards off female characters',()=>{
 for(const bad of [null,[],42,'x',{skin:'#ffffff',hairColor:'red',hair:'<b>',sex:'other',shirtVariant:9}])assert.deepEqual(safeAppearance(bad),appearanceDefaults);
 const f=safeAppearance({sex:'female',beard:'Beard',shirtVariant:'3',pantsVariant:2});assert.equal(f.beard,'Clean shaven');assert.equal(f.hair,'Long','female default hair');assert.equal(f.shirtVariant,3);assert.equal(f.pantsVariant,2);
});
test('every hairstyle, skin and hair colour builds a character',()=>{
 for(const hair of HAIRSTYLES){assert.ok(Object.hasOwn(HAIR_MESHES,hair),hair);for(const sex of ['male','female']){const r=buildHumanoid(T,new T.Group(),{sex,hair});assert.equal(r.hairMeshes.length,hair==='Bald'?0:1,sex+' '+hair)}}
 for(let i=0;i<SKINS.length;i++){const r=buildHumanoid(T,new T.Group(),safeAppearance({skin:SKINS[i],hairColor:HAIRS[i]}));assert.equal('#'+r.face.material.color.getHexString(),SKINS[i]);assert.equal('#'+r.hairMeshes[0].material.color.getHexString(),HAIRS[i])}
});
test('the two bodies differ in build',()=>{const box=sex=>{const root=new T.Group(),r=buildHumanoid(T,root,{sex});root.updateMatrixWorld(true);return {head:r.head.getWorldPosition(new T.Vector3()).y,shoulders:r.leftArm.getWorldPosition(new T.Vector3()).distanceTo(r.rightArm.getWorldPosition(new T.Vector3()))}};const m=box('male'),f=box('female');assert.ok(m.head>f.head);assert.ok(m.shoulders>f.shoulders)});
