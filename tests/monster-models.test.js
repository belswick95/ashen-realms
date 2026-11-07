import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as T from 'three';
import {MONSTER_MODELS,hasRiggedModel,setClassicMonsterModel,classicMonsterSpecies} from '../monster-models.js';
import {actorModel} from '../world-models.js';
import {worldTemplates} from '../world-templates.js';

const glbJson=file=>{const b=fs.readFileSync(new URL('../assets/monsters/'+file,import.meta.url));assert.equal(b.toString('latin1',0,4),'glTF');return JSON.parse(b.toString('utf8',20,20+b.readUInt32LE(12)))};

test('every rigged monster model is a compact, credited, rigged GLB with named clips',()=>{
 const credits=fs.readFileSync(new URL('../assets/monsters/CREDITS.md',import.meta.url),'utf8'),page=fs.readFileSync(new URL('../credits.html',import.meta.url),'utf8');
 for(const [species,cfg] of Object.entries(MONSTER_MODELS)){
  assert.ok(Object.values(worldTemplates).some(t=>t.species===species),species+' is a game species');
  const size=fs.statSync(new URL('../assets/monsters/'+cfg.file,import.meta.url)).size;assert.ok(size<340*1024,cfg.file+' stays compact ('+size+' bytes)');
  const j=glbJson(cfg.file);assert.equal(j.skins?.length,1,cfg.file+' has one skeleton');
  const clips=(j.animations||[]).map(a=>a.name);assert.ok(clips.includes('walk')||clips.includes('idle'),cfg.file+' moves');
  for(const c of clips)assert.ok(['idle','walk','run','attack','hit','death'].includes(c),cfg.file+' clip '+c);
  assert.ok(!j.extensionsUsed?.some(e=>/draco|meshopt/i.test(e)),'loads without a decoder');
  assert.ok(credits.includes('`'+cfg.file+'`'),cfg.file+' is credited');
 }
 assert.ok(page.includes('assets/monsters/CREDITS.md'),'credits page links the monster credits');
});

test('rigged species keep a working classic body (Node, loading, owner toggle) that animates and disposes',()=>{
 for(const species of Object.keys(MONSTER_MODELS)){
  assert.ok(hasRiggedModel(species));const d={...Object.values(worldTemplates).find(t=>t.species===species),kind:'monster'};
  const root=new T.Group(),m=actorModel(T,root,d);let meshes=0;root.traverse(o=>{if(o.isMesh)meshes++});assert.ok(meshes>3,species+' shows a body');
  assert.equal(root.children.length,1,'one stable body group (toppled on death without a death clip)');
  m.update(1/30,{distance:.05,speed:1.5,attack:0,hit:0,block:0});m.update(1/30,{distance:0,attack:.3,hit:.2,block:0});m.update(1/30,{dead:true});
  assert.equal(m.ownDeath,false);m.dispose();assert.equal(root.children.length,0);
 }
 setClassicMonsterModel('wolf',true);assert.deepEqual(classicMonsterSpecies(),['wolf']);setClassicMonsterModel('wolf',false);assert.deepEqual(classicMonsterSpecies(),[]);
 assert.equal(setClassicMonsterModel('dragon',true),false,'only species with a rigged model');
});

// Wildlife and livestock: the red deer and the farm animals use rigged animal models too.
const ANIMALS={deer:['idle','walk','run','attack','hit','death'],cow:['idle','walk','run','attack','hit','death'],pig:['idle','walk','run','death'],sheep:['idle','walk','run','death'],chicken:['idle','walk','attack','death']};
// Parse a GLB in Node: textures are dropped (no image decoder here); geometry, skin and clips stay.
async function loadAnimal(file){
 const {NodeIO}=await import('@gltf-transform/core'),{ALL_EXTENSIONS}=await import('@gltf-transform/extensions'),{GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');
 const io=new NodeIO().registerExtensions(ALL_EXTENSIONS),doc=await io.read(new URL('../assets/monsters/'+file,import.meta.url).pathname);
 for(const t of doc.getRoot().listTextures())t.dispose();const bin=await io.writeBinary(doc);
 return new GLTFLoader().parseAsync(bin.buffer.slice(bin.byteOffset,bin.byteOffset+bin.byteLength),'');
}
// The model as riggedBody() places it (fit scale and offset, then the species yaw), posed by `clip` at `time`.
async function posed(asset,cfg,clip,time,y=asset.offset.y){
 const {clone}=await import('three/addons/utils/SkeletonUtils.js');
 const body=clone(asset.scene),pivot=new T.Group(),fit=new T.Group();pivot.rotation.y=cfg.yaw||0;pivot.add(body);fit.scale.setScalar(asset.scale);fit.position.set(asset.offset.x,y,asset.offset.z);fit.add(pivot);
 const mixer=new T.AnimationMixer(body),a=mixer.clipAction(asset.clips[clip]);if(clip==='death'){a.setLoop(T.LoopOnce,1);a.clampWhenFinished=true}a.play();mixer.setTime(time);fit.updateMatrixWorld(true);
 return new T.Box3().setFromObject(fit,true);
}

test('the deer and the farm animals are rigged, credited, compact models with their clips mapped',()=>{
 const credits=fs.readFileSync(new URL('../assets/monsters/CREDITS.md',import.meta.url),'utf8'),page=fs.readFileSync(new URL('../credits.html',import.meta.url),'utf8');
 const main=page.slice(page.indexOf('<main>'),page.indexOf('</main>')),from=main.indexOf('<h2>Rigged monsters</h2>'),section=main.slice(from,main.indexOf('<h2>',from+4));
 assert.ok(from>0,'credits page has the Rigged monsters section');
 for(const [species,want] of Object.entries(ANIMALS)){
  const cfg=MONSTER_MODELS[species];assert.ok(cfg,species+' has a rigged model');assert.equal(cfg.file,species+'.glb');
  const size=fs.statSync(new URL('../assets/monsters/'+cfg.file,import.meta.url)).size;assert.ok(size>40*1024&&size<340*1024,cfg.file+' '+size+' bytes');
  const j=glbJson(cfg.file);assert.deepEqual((j.animations||[]).map(a=>a.name).sort(),[...want].sort(),species+' clips');
  assert.ok(credits.includes('`'+cfg.file+'`'),cfg.file+' in CREDITS.md');
  if(want.includes('run'))assert.ok(cfg.runStride>0,species+' run stride');
 }
 for(const name of ['Ultimate Animated Animals','Farm Animals Animated','Chicken (animated)'])assert.ok(section.includes(name),'the Rigged monsters section credits '+name);
 assert.ok(!/Cows, hens, sheep, pigs/.test(main),'the farm credits no longer call the animals procedural');
});

test('the deer and the farm animals stand, walk and lie on the ground',async()=>{
 const {fitMonsterAsset}=await import('../monster-models.js');
 for(const species of Object.keys(ANIMALS)){
  const cfg=MONSTER_MODELS[species],asset=fitMonsterAsset(T,await loadAnimal(cfg.file),cfg),height=cfg.size.height||cfg.size.length*.6;
  const idle=await posed(asset,cfg,'idle',0);assert.ok(Math.abs(idle.min.y)<1e-3,species+' idle feet on the ground ('+idle.min.y+')');
  if(cfg.size.length)assert.ok(Math.abs(Math.max(idle.max.z-idle.min.z,idle.max.x-idle.min.x)-cfg.size.length)<.02,species+' length');
  for(const clip of ['walk','run'])if(asset.clips[clip])for(let k=0;k<6;k++){const b=await posed(asset,cfg,clip,asset.clips[clip].duration*k/6);
   assert.ok(b.min.y>-.06*height&&b.min.y<.12*height,species+' '+clip+' frame '+k+' touches the ground ('+b.min.y.toFixed(3)+')')}
  assert.ok(Number.isFinite(asset.deathY),species+' corpse height');const dead=await posed(asset,cfg,'death',asset.clips.death.duration,asset.deathY);
  assert.ok(Math.abs(dead.min.y)<1e-3,species+' corpse rests on the ground ('+dead.min.y+')');
 }
});

test('rigged animals walk, gallop above the run speed, take hits, die and settle like the monsters',async()=>{
 const mm=await import('../monster-models.js'),store=globalThis.__eldervaleMonsterModels,hadDoc='document' in globalThis;
 const cfg=MONSTER_MODELS.deer,asset=mm.fitMonsterAsset(T,await loadAnimal(cfg.file),cfg);store.assets.set('deer',asset);store.version++;
 if(!hadDoc)globalThis.document={};
 try{
  const d={...worldTemplates.deer,kind:'monster'},root=new T.Group(),m=actorModel(T,root,d);
  assert.equal(m.rigged,true);assert.equal(m.ownDeath,true);assert.equal(m.clip,'idle');
  m.update(1/30,{distance:.09,speed:2.63});assert.equal(m.clip,'walk','tile walking pace walks');
  m.update(1/30,{distance:.18,speed:mm.RUN_SPEED+1});assert.equal(m.clip,'run','running or fleeing gallops');
  m.update(1/30,{distance:0});assert.equal(m.clip,'idle');
  m.update(1/30,{distance:0,hit:.3});m.update(1/30,{distance:0,attack:.55});
  const fit=root.children[0].children[0];for(let k=0;k<60;k++)m.update(1/30,{dead:true});assert.ok(Math.abs(fit.position.y-asset.deathY)<1e-6,'the corpse settles at deathY');
  m.dispose();assert.equal(root.children.length,0);
  // The owner console's per-species classic toggle swaps the deer back to its procedural body.
  const root2=new T.Group(),m2=actorModel(T,root2,d);mm.setClassicMonsterModel('deer',true);m2.update(1/30,{distance:0});assert.equal(m2.rigged,false);
  mm.setClassicMonsterModel('deer',false);m2.update(1/30,{distance:0});assert.equal(m2.rigged,true);m2.dispose();
 }finally{if(!hadDoc)delete globalThis.document;store.assets.delete('deer');store.version++}
});
