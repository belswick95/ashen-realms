import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import fs from 'node:fs';
import {initializeGeography} from '../geography.js?v=release-20261106-clips125';
const world=JSON.parse(fs.readFileSync(new URL('../db/generated-world.json',import.meta.url)));initializeGeography(world.config);
const {buildNaturalForest,treeSpecies,shoreDistance,TREE_SPECIES}=await import('../natural-forest.js?v=release-20261106-clips125');
const {biomeWeights,generatedTreePoints,seededRandom}=await import('../procedural-world.js?v=release-20261106-clips125');
globalThis.document??={createElement:()=>({width:0,height:0,getContext:()=>({clearRect(){},beginPath(){},ellipse(){},fill(){},set fillStyle(v){}})})};
const seed=world.config.seed,trees=generatedTreePoints(seed,()=>true);
const census=(filter)=>{const n={};for(const t of trees.filter(filter)){const k=treeSpecies(t.x,t.z,seed,seededRandom((Math.floor(t.x*131)^Math.floor(t.z*517))>>>0)());n[k]=(n[k]||0)+1}return n};
test('species follow the biomes: snowy pines north, dead trees in the dry expanse, willows by water',()=>{
 const snow=census(t=>biomeWeights(t.x,t.z,seed).snow>.7),dry=census(t=>biomeWeights(t.x,t.z,seed).dry>.7&&shoreDistance(t.x,t.z)>12),wet=census(t=>shoreDistance(t.x,t.z)<8&&biomeWeights(t.x,t.z,seed).snow<.5),green=census(t=>biomeWeights(t.x,t.z,seed).grass>.7&&shoreDistance(t.x,t.z)>12);
 const top=n=>Object.entries(n).sort((a,b)=>b[1]-a[1])[0][0];
 assert.equal(top(snow),'snowpine');assert.equal(top(wet),'willow');assert.ok((dry.dead||0)>(dry.oak||0)*.8,'dry expanse has many bare trees '+JSON.stringify(dry));
 for(const k of ['oak','birch','pine','spruce'])assert.ok(green[k]>0,'mixed woodland has '+k);
 const all=census(()=>true);for(const k of TREE_SPECIES)assert.ok(all[k]>0,'world grows '+k);
});
test('every species shares three instanced meshes per chunk: variety costs no draw calls',()=>{
 const scene=new T.Scene(),m=new T.MeshStandardMaterial(),sample=trees.filter(t=>t.x>-64&&t.x<64&&t.z>-64&&t.z<64);
 const meshes=buildNaturalForest(T,scene,sample,{wood:m,heightAt:()=>0,seed});
 const chunks=new Set(sample.map(t=>Math.floor(t.x/64)+':'+Math.floor(t.z/64)));
 assert.ok(meshes.length<=chunks.size*3,'at most trunk, branch and leaf batches per chunk');
 for(const mesh of meshes){assert.ok(mesh.isInstancedMesh);assert.ok(mesh.instanceMatrix.array.every(Number.isFinite));assert.ok(mesh.userData.naturalChunk.range>0);assert.ok(mesh.userData.treeSlots.size>0)}
 assert.ok(meshes.some(mesh=>mesh.instanceColor),'species are tinted per instance');
 const one=buildNaturalForest(T,new T.Scene(),[{x:0,z:0}],{wood:m,heightAt:()=>0,seed:7,species:'pine'});assert.equal(one.length,3,'single placed trees keep their species override');
});
