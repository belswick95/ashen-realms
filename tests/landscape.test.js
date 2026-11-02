import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createLandscape,landscapeGeometry} from '../landscape.js';
import {landscapeSettlements,worldRivers} from '../geography.js';
const land=createLandscape();
test('terrain has coherent elevations and graded settlement centres',()=>{assert.ok(Math.max(...land.heights)>55);for(const [x,z] of landscapeSettlements){assert.ok(Math.abs(land.heightAt(x,z))<.01,`${x},${z} settlement is graded`);assert.equal(land.canWalk(x,z),true)}});
test('water blocks movement while generated bridges carry a continuous dry route',()=>{
 assert.ok(land.bridges.length>=3);for(const r of worldRivers)assert.equal(land.canWalk(...r.points[2]),false);
 for(const b of land.bridges){for(let i=0;i<=60;i++){const along=(i/60-.5)*b.length*.99,x=b.x+Math.sin(b.yaw)*along,z=b.z+Math.cos(b.yaw)*along;assert.equal(land.canWalk(x,z),true);assert.ok(land.walkHeight(x,z)>=0)}assert.ok(land.walkHeight(b.x,b.z)>.2)}
});
test('rendered heightfield matches actor footing between vertices',()=>{
 const mesh=new T.Mesh(landscapeGeometry(T,land),new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld();
 for(const [x,z] of [[-320,-300],[230,-260],[-143.3,21.7],[13.2,9.8],[290.2,297.4]]){const ray=new T.Raycaster(new T.Vector3(x,200,z),new T.Vector3(0,-1,0));const hit=ray.intersectObject(mesh)[0];assert.ok(hit);assert.ok(Math.abs(hit.point.y-land.heightAt(x,z))<1e-4)}
});
test('legacy positions in water recover to nearby walkable land without changing save data',()=>{const p=land.nearestDryPoint(-91,80);assert.equal(land.canWalk(p.x,p.z),true);assert.ok(Math.hypot(p.x+91,p.z-80)<32);assert.equal(land.canWalk(Infinity,0),false);assert.equal(land.canWalk(421,0),false)});
