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
  for(const c of clips)assert.ok(['idle','walk','attack','hit','death'].includes(c),cfg.file+' clip '+c);
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
