// Gameplay/world-visual QA pass (release portrait145): regressions found in the live client.
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import * as T from 'three';
const V='?v=release-20261107-buildings149';
const {makeFlame,makeTorch,liveTorches}=await import('../torch.js'+V);
const {lightMarker}=await import('../underground-models.js'+V);
const {sceneFogDistances,weatherFog}=await import('../weather-effects.js'+V);
const {THEMES}=await import('../underground-data.js'+V);

test('caves keep their own fog: weather no longer overwrites the theme fog distances underground',()=>{
 const base={near:49.5,far:110};
 // Surface: the clock's base thinned by fog/haze, as before.
 assert.deepEqual(sceneFogDistances(base,undefined,.4),weatherFog(49.5,110,.4));
 assert.deepEqual(sceneFogDistances(base,null,0),{near:49.5,far:110});
 // Below ground: the cave's published fog wins, whatever the surface weather is doing.
 const cave={near:THEMES.earth.fogNear,far:THEMES.earth.fogFar};
 assert.deepEqual(sceneFogDistances(base,cave,1),cave);
 // underground.js publishes the theme fog while lit and withdraws it on the way out; weather reads it.
 const ug=readFileSync(new URL('../underground.js',import.meta.url),'utf8'),wx=readFileSync(new URL('../weather-effects.js',import.meta.url),'utf8');
 assert.match(ug,/scene\.userData\.undergroundFog=\{near:th\.fogNear,far:th\.fogFar\}/);
 assert.match(ug,/function restoreLighting\(\)\{delete scene\.userData\.undergroundFog;/);
 assert.match(wx,/sceneFogDistances\(fogBase,scene\.userData\.undergroundFog,/);
});

const meshes=g=>{const out=[];g.traverse(o=>{if(o.isMesh)out.push(o)});return out};
test('cave torches and braziers burn with the animated torch flame, not a white emissive cone',()=>{
 for(const kind of ['torch','brazier']){const g=lightMarker(T,kind,0xffa04a);let flame=null;g.traverse(o=>{if(o.name==='light-flame')flame=o});
  assert.ok(flame&&flame.userData.torchFlame,kind+' has a flame');
  assert.ok(!meshes(g).some(m=>m.geometry.type==='ConeGeometry'),kind+': no solid cone');
  let outer=null;flame.traverse(o=>{if(o.name==='torch-flame-outer')outer=o});assert.equal(outer.material.blending,T.AdditiveBlending);assert.equal(outer.material.toneMapped,false);
  // Scenery flames never claim a torch point light (the cave's light anchors light them).
  const scene=new T.Scene();scene.add(g);scene.updateMatrixWorld(true);outer.onBeforeRender(null,scene);
  assert.equal(liveTorches(scene).length,0,kind+' not in the torch light pool')}
 // A held torch still reports itself (the pool lights it).
 const scene=new T.Scene(),t=makeTorch(T);scene.add(t);scene.updateMatrixWorld(true);let outer=null;t.traverse(o=>{if(o.name==='torch-flame-outer')outer=o});
 outer.onBeforeRender(null,scene);assert.deepEqual(liveTorches(scene),[t]);
 assert.equal(t.userData.flame.name,'torch-flame');assert.ok(Math.abs(t.userData.flame.position.y-.505)<1e-9);
 const loose=makeFlame(T);assert.equal(loose.userData.torchFlame,true);
});

test('rigged monster corpses settle on the ground: fliers drop their hover lift, deep death clips do not sink',async()=>{
 const mm=await import('../monster-models.js'+V);
 // Bat: hovering fit (lift .75) → corpse resting where the last death frame touches the ground.
 assert.equal(mm.corpseHeight(1.2,.3,0),1.2);assert.ok(Math.abs(mm.corpseHeight(1.2,.3,1)-.3)<1e-12);assert.ok(Math.abs(mm.corpseHeight(1.2,.3,7)-.3)<1e-12);
 const mid=mm.corpseHeight(1.2,.3,.5);assert.ok(mid<1.2&&mid>.3);assert.equal(mm.corpseHeight(1,2,NaN),1);
 const src=readFileSync(new URL('../monster-models.js',import.meta.url),'utf8');
 // Measured once per species from the last frame of its death clip (skinned bounds), applied while dead.
 assert.match(src,/mixer\.setTime\(clips\.death\.duration\);holder\.updateMatrixWorld\(true\);\s*const end=new T\.Box3\(\)\.setFromObject\(holder,true\);if\(!end\.isEmpty\(\)\)asset\.deathY=-end\.min\.y\*scale/);
 assert.match(src,/fallFrom=fit\.position\.y;/);assert.match(src,/fit\.position\.y=corpseHeight\(fallFrom,asset\.deathY,act\.death\.time\/asset\.clips\.death\.duration\)/);
});
