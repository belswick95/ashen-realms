import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';
import {disposeEntityResources} from '../entity-resources.js';

test('unloading a skinned entity frees its skeleton bone texture once, and it can be rebuilt',()=>{
 const bones=[new T.Bone(),new T.Bone()];bones[0].add(bones[1]);const skeleton=new T.Skeleton(bones);
 const root=new T.Group(),geo=new T.BoxGeometry();const a=new T.SkinnedMesh(geo,new T.MeshStandardMaterial()),b=new T.SkinnedMesh(geo,new T.MeshStandardMaterial());
 a.add(bones[0]);a.bind(skeleton);b.bind(skeleton);root.add(a,b);
 skeleton.computeBoneTexture();let freed=0;skeleton.boneTexture.addEventListener('dispose',()=>freed++);
 disposeEntityResources(root);assert.equal(freed,1);assert.equal(skeleton.boneTexture,null);
 skeleton.computeBoneTexture();assert.ok(skeleton.boneTexture?.isDataTexture,'a re-shown skeleton gets a fresh bone texture');
});

const read=p=>fs.readFileSync(new URL('../'+p,import.meta.url),'utf8');

test('qa-perf.sql is one idempotent transaction without approval-prompt words',()=>{
 const sql=read('db/qa-perf.sql');
 for(const word of ['delete','alter','drop'])assert.ok(!new RegExp(word,'i').test(sql),word);
 assert.match(sql,/^begin;\nset local lock_timeout='2s';/m);assert.match(sql,/commit;\s*$/);
 const creates=sql.match(/^create index[^\n]*/gm);assert.equal(creates.length,3);
 for(const c of creates)assert.match(c,/^create index if not exists /);
 assert.match(sql,/DRY RUN/);
 // The reply-objects predicate must stay verbatim with realm_request_base for the planner to use it.
 assert.match(sql,/where \(kind='door' or available_at is not null\);/);
});

test('groundFeet helpers exist before the first frame() call',()=>{
 const src=read('game.js'),decl=src.indexOf('function groundHeightAt('),box=src.indexOf('const footBox=new T.Box3()'),first=src.indexOf("say('Welcome to Eldervale!');");
 assert.ok(!src.includes("say('Welcome to Eldervale!');frame();"),'the first frame waits for the module to finish');assert.match(src.slice(first,first+400),/\nrequestAnimationFrame\(frame\);/);
 assert.ok(decl>0&&box>0&&first>0);assert.ok(box<first,'footBox declared before the first frame');
});

test('automatic graphics drops keep the light count (no full shader rebuild on a slow frame)',()=>{
 const src=read('game.js');
 assert.match(src,/const lamps=\(autoTierDrop>0\|\|leanMode\)&&lampBudget\?lampBudget:shadow\.lamps;lampBudget=lamps;lanternPool\.forEach\(\(light,i\)=>light\.visible=i<lamps\);torchLights\.setBudget\(lamps>=3\?3:2\);/);
 assert.ok(!src.includes('light.visible=i<shadow.lamps'),'no direct preset-driven toggle left');
});
