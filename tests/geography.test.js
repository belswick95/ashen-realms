import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {worldRoads,roadPoints,lakeOutline,ribbonGeometry} from '../geography.js';
test('roads connect exact settlement endpoints and produce upward-facing geometry',()=>{
 for(const [a,b] of worldRoads){const p=roadPoints(a,b);assert.deepEqual(p[0],a);assert.deepEqual(p.at(-1),b);assert.deepEqual(p,roadPoints(a,b));const g=ribbonGeometry(T,p,2.7);for(const y of g.attributes.normal.array.filter((_,i)=>i%3===1))assert.ok(y>.99);assert.equal(g.index.count,32*6)}
});
test('lake shoreline scales identically for map and 3D layers without NaN or seams',()=>{
 const lake={x:-91,z:80,rx:18,rz:12},outer=lakeOutline(lake),inner=lakeOutline(lake,.84);
 assert.equal(outer.length,64);for(let i=0;i<64;i++){assert.ok(outer[i].every(Number.isFinite));assert.ok(Math.abs((outer[i][0]-lake.x)*.84-(inner[i][0]-lake.x))<1e-10)}
});
