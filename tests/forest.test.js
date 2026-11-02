import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildForest} from '../forest.js';
test('forests batch per spatial chunk with finite transforms and culling bounds',()=>{
 const scene=new T.Scene(),trees=Array.from({length:400},(_,i)=>({x:i%20*3,z:Math.floor(i/20)*3})),m=new T.MeshLambertMaterial();
 const batches=buildForest(T,scene,trees,{wood:m,leaf:m});
 assert.ok(batches.length<=3,'one chunk needs at most trunk, pine and broadleaf batches');
 assert.equal(batches[0].count,400);
 for(const b of batches){assert.ok(b.instanceMatrix.array.every(Number.isFinite));assert.ok(Number.isFinite(b.boundingSphere.radius));assert.equal(b.frustumCulled,true)}
});
