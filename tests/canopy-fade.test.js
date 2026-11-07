import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import fs from 'node:fs';
import {createCanopyFader,canopyFadeShader,canopyFadeMaterial,canopyFadeAttribute,canopyRecord,canopySphere,segmentPointDistanceSq,CANOPY_FADE_KEY,CANOPY_FADE_OPACITY,CANOPY_FADE_SECONDS} from '../canopy-fade.js';
import {initializeGeography} from '../geography.js?v=release-20261107-walls155';
const world=JSON.parse(fs.readFileSync(new URL('../db/generated-world.json',import.meta.url)));initializeGeography(world.config);
const {buildNaturalForest}=await import('../natural-forest.js?v=release-20261107-walls155');
globalThis.document??={createElement:()=>({width:0,height:0,getContext:()=>({clearRect(){},beginPath(){},ellipse(){},fill(){},set fillStyle(v){}})})};
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('the fade hook patches Standard and Lambert leaf shaders into one constant program',()=>{
 for(const lib of ['standard','lambert']){
  const shader={vertexShader:T.ShaderLib[lib].vertexShader,fragmentShader:T.ShaderLib[lib].fragmentShader,uniforms:{}};canopyFadeShader(shader);
  assert.match(shader.vertexShader,/attribute float canopyFade;/);assert.match(shader.vertexShader,/#include <begin_vertex>\nvCanopyFade=canopyFade;/);
  assert.match(shader.fragmentShader,/#include <alphatest_fragment>\nif\(vCanopyFade<\.999&&canopyBayer4\(gl_FragCoord\.xy\)/);
  assert.doesNotMatch(shader.fragmentShader,/uniform float canopy/,'no per-material uniform: the fade lives in the instance attribute');
 }
 const a=canopyFadeMaterial(new T.MeshStandardMaterial()),b=canopyFadeMaterial(new T.MeshStandardMaterial({color:0xff0000}));
 assert.equal(a.customProgramCacheKey(),CANOPY_FADE_KEY);assert.equal(b.customProgramCacheKey(),a.customProgramCacheKey());assert.equal(a.onBeforeCompile,b.onBeforeCompile);
 assert.equal(a.transparent,false,'leaves stay in the opaque, alpha-tested pass');
 const attr=canopyFadeAttribute(T,5);assert.ok(attr.isInstancedBufferAttribute);assert.deepEqual([...attr.array],[1,1,1,1,1]);
});

test('every forest leaf batch carries a fade attribute and one canopy sphere per tree, at no extra draw calls',()=>{
 const scene=new T.Scene(),wood=new T.MeshStandardMaterial(),trees=[];for(let i=0;i<30;i++)trees.push({x:(i%6)*9+.5,z:Math.floor(i/6)*9+.5});
 const meshes=buildNaturalForest(T,scene,trees,{wood,heightAt:()=>0,seed:7});
 assert.ok(meshes.length<=3,'still trunk, branch and leaf batches for one chunk');
 const leaves=meshes.filter(m=>m.userData.canopyTrees);assert.equal(leaves.length,1);const m=leaves[0];
 assert.equal(m.material.userData.canopyFade,true);assert.equal(m.material.customProgramCacheKey(),CANOPY_FADE_KEY);
 assert.equal(m.geometry.attributes.canopyFade.count,m.count);assert.ok(m.geometry.attributes.canopyFade.array.every(v=>v===1));
 const recs=m.userData.canopyTrees;assert.ok(recs.length>=25&&recs.length<=30,'dead trees have no leaves; every other tree gets a crown');
 let covered=0;for(const r of recs){assert.ok(r.end>r.start);assert.ok(r.r>1&&r.r<8,'plausible crown radius '+r.r);assert.ok(r.y>2,'crown sits up in the tree');covered+=r.end-r.start}
 assert.equal(covered,m.count,'the crown ranges cover every leaf card exactly once');
 for(let i=1;i<recs.length;i++)assert.equal(recs[i].start,recs[i-1].end);
 const limbs=meshes.find(x=>x.material.userData.canopyFade&&!x.userData.canopyTrees),trunks=meshes.find(x=>x.material===wood);
 assert.ok(limbs&&trunks,'trunks keep the plain wood; limbs use its hooked clone');assert.equal(limbs.material.map,wood.map);assert.equal(limbs.material.customProgramCacheKey(),CANOPY_FADE_KEY);
 assert.equal(trunks.geometry.attributes.canopyFade,undefined,'trunks never fade');assert.equal(limbs.geometry.attributes.canopyFade.count,limbs.count);
 for(const r of recs){assert.equal(r.limbs,limbs);assert.ok(r.limbEnd>r.limbStart)}
 const again=buildNaturalForest(T,new T.Scene(),[{x:3,z:3}],{wood,heightAt:()=>0,seed:9,species:'oak'});assert.equal(again.find(x=>x.material!==wood&&!x.userData.canopyTrees).material,limbs.material,'one limb material per wood material');
 const willow=buildNaturalForest(T,new T.Scene(),[{x:0,z:0}],{wood,heightAt:()=>0,seed:3,species:'willow'}).find(x=>x.userData.canopyTrees);
 assert.equal(willow.userData.canopyTrees.length,1);assert.ok(willow.userData.canopyTrees[0].r>2.5,'a willow crown is wide');
});

test('segment distance and crown spheres',()=>{
 assert.equal(segmentPointDistanceSq(0,0,0,10,0,0,5,2,0),4);
 assert.equal(segmentPointDistanceSq(0,0,0,10,0,0,-3,0,0),9);
 const s=canopySphere([{x:-1,y:5,z:0,sx:2,sy:2},{x:1,y:5,z:0,sx:2,sy:2}],0,2);assert.deepEqual([s.x,s.y,s.z,s.r],[0,5,0,2]);
});

function leafMesh(trees){
 const count=trees.length*4,geometry=new T.PlaneGeometry(1,1);geometry.setAttribute('canopyFade',canopyFadeAttribute(T,count));
 const mesh=new T.InstancedMesh(geometry,new T.MeshStandardMaterial(),count);
 mesh.userData.canopyTrees=trees.map(([x,y,z,r],i)=>canopyRecord(mesh,x,y,z,r,i*4,i*4+4));return mesh;
}
test('crowns between the camera and the player fade to about 30% over 0.2 s and fade back',()=>{
 const fader=createCanopyFader(),mesh=leafMesh([[0,5,0,3],[30,5,0,3]]);fader.addStatic(mesh);
 const fade=mesh.geometry.attributes.canopyFade,camera=new T.Vector3(0,9,-10),player=new T.Vector3(0,1.1,10);
 fader.test(camera,player);assert.equal(fader.active.length,1,'only the crown on the sight line');
 fader.update(.1);assert.ok(fade.array[0]<1&&fade.array[0]>CANOPY_FADE_OPACITY,'half way after 0.1 s');
 fader.update(.1);assert.ok(Math.abs(fade.array[0]-CANOPY_FADE_OPACITY)<1e-6);assert.ok(CANOPY_FADE_OPACITY>=.25&&CANOPY_FADE_OPACITY<=.35);assert.equal(CANOPY_FADE_SECONDS,.2);
 assert.deepEqual([...fade.array.slice(4)],[1,1,1,1],'the other tree is untouched');
 fader.update(.1);const version=fade.version;fader.update(.1);assert.equal(fade.version,version,'no upload once the fade has settled');
 fader.test(new T.Vector3(10,9,-10),new T.Vector3(10,1.1,10));fader.update(.1);assert.ok(fade.array[0]>CANOPY_FADE_OPACITY&&fade.array[0]<1);
 fader.update(.15);assert.equal(fade.array[0],1);assert.ok(fade.array.every(v=>v===1));assert.equal(fader.active.length,0,'restored trees leave the active list');
 assert.equal(fader.update(.1),0);
});
test('a crown above the camera ray or behind the player stays',()=>{
 const fader=createCanopyFader(),mesh=leafMesh([[0,20,0,3],[0,5,25,3]]);fader.addStatic(mesh);
 fader.test(new T.Vector3(0,9,-10),new T.Vector3(0,1.1,10));assert.equal(fader.active.length,0);
});
test('placed trees fade through their world transform; hidden batches and release() restore',()=>{
 const fader=createCanopyFader(),mesh=leafMesh([[0,5,0,3]]),root=new T.Group();root.add(mesh);root.position.set(100,0,50);root.scale.setScalar(1.5);root.updateMatrixWorld(true);
 const camera=new T.Vector3(100,9,40),player=new T.Vector3(100,1.1,60);
 fader.test(camera,player,[mesh]);assert.equal(fader.active.length,1);fader.update(1);assert.ok(Math.abs(mesh.geometry.attributes.canopyFade.array[0]-CANOPY_FADE_OPACITY)<1e-6);
 fader.release();fader.update(1);assert.equal(mesh.geometry.attributes.canopyFade.array[0],1);
 fader.test(new T.Vector3(0,9,-10),new T.Vector3(0,1.1,10),[mesh]);assert.equal(fader.active.length,0,'the moved tree is not at the origin');
 const statics=leafMesh([[0,5,0,3]]);fader.addStatic(statics);statics.visible=false;fader.test(new T.Vector3(0,9,-10),new T.Vector3(0,1.1,10));assert.equal(fader.active.length,0,'culled chunks are skipped');
});
test('game, forest and classic look are wired to the fader',()=>{
 const game=read('game.js');
 assert.match(game,/import \{createCanopyFader\} from '\.\/canopy-fade\.js\?v=release-20261107-walls155'/);
 assert.match(game,/for\(const batch of forestBatches\)canopyFader\.addStatic\(batch\)/);
 assert.match(game,/nextCanopyTest=performance\.now\(\)\+100;/,'the occlusion test runs at 10 Hz');
 assert.match(game,/canopyFader\.update\(elapsed\)/);assert.match(game,/canopyRoots\.delete\(entry\.root\)/);
 const classic=read('classic-look.js');assert.match(classic,/if\(src\.userData\?\.canopyFade\)\{const inner=m\.onBeforeCompile;m\.onBeforeCompile=\(shader,renderer\)=>\{inner\.call\(m,shader,renderer\);src\.onBeforeCompile\(shader,renderer\)\}/);assert.match(classic,/src\.userData\?\.canopyFade\?'canopy':''\]\.join/,'a hooked limb clone never pools with the plain wood it was cloned from');
 const src=read('canopy-fade.js'),update=src.slice(src.indexOf('function update('),src.indexOf('function release('));
 assert.doesNotMatch(update,/new |\[\]|\{\}|=>|\.map\(|\.filter\(|\.slice\(| of /,'the per-frame step allocates nothing');
});
test('a faded tree fades its limbs with its leaves',()=>{
 const geometry=new T.PlaneGeometry(1,1),limbGeometry=new T.PlaneGeometry(1,1);geometry.setAttribute('canopyFade',canopyFadeAttribute(T,4));limbGeometry.setAttribute('canopyFade',canopyFadeAttribute(T,6));
 const leaves=new T.InstancedMesh(geometry,new T.MeshStandardMaterial(),4),limbs=new T.InstancedMesh(limbGeometry,new T.MeshStandardMaterial(),6);
 leaves.userData.canopyTrees=[canopyRecord(leaves,0,5,0,3,0,4,limbs,2,5)];const fader=createCanopyFader();fader.addStatic(leaves);
 fader.test(new T.Vector3(0,9,-10),new T.Vector3(0,1.1,10));fader.update(1);
 assert.deepEqual([...limbGeometry.attributes.canopyFade.array].map(v=>+v.toFixed(2)),[1,1,.3,.3,.3,1]);
});
