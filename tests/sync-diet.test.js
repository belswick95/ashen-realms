import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createSyncDiet,missingRpc} from '../sync-diet.js';

test('skipped heavy keys are restored from the cache and digests are sent back',()=>{
 const d=createSyncDiet();
 const first=d.expand({time:'t1',shops:{m:{a:1}},quests:[1],digests:{shops:'s1',quests:'q1'}}).data;
 assert.deepEqual(first.shops,{m:{a:1}});assert.equal('digests' in first,false);
 assert.deepEqual(d.have(),{shops:'s1',quests:'q1'});
 const {data,changed}=d.expand({time:'t2',quests:[1,2],digests:{shops:'s1',quests:'q2'}});
 assert.deepEqual(data.shops,{m:{a:1}},'unchanged shops come from the cache');assert.deepEqual(data.quests,[1,2]);
 assert.deepEqual([...changed],['quests']);
});
test('a key skipped against a digest the client no longer holds is re-requested in full',()=>{
 const d=createSyncDiet();d.expand({shops:{v:1},digests:{shops:'a'}});
 const {data}=d.expand({digests:{shops:'b'}});assert.deepEqual(data.shops,{v:1});assert.equal(d.have().shops,undefined);
});
test('actor deltas merge on the acknowledged state and a mismatched base forces a full list',()=>{
 const d=createSyncDiet();
 let r=d.expand({actors:[{id:'a',x:1},{id:'b',x:2}],actorsToken:'T1',digests:{}}).data;assert.equal(r.actors.length,2);assert.equal(d.have().actorsToken,'T1');
 r=d.expand({actors:[{id:'a',x:5}],actorsGone:['b'],actorsBase:'T1',actorsToken:'T2',digests:{}}).data;
 assert.deepEqual(r.actors,[{id:'a',x:5}]);assert.equal(d.have().actorsToken,'T2');assert.equal('actorsBase' in r,false);
 // Two requests were in flight with T2: the second delta is based on T2 but the client is already elsewhere.
 r=d.expand({actors:[{id:'c',x:3}],actorsGone:['a'],actorsBase:'T9',actorsToken:'T3',digests:{}}).data;
 assert.deepEqual(r.actors.map(a=>a.id).sort(),['a','c'],'fresh rows are shown, nothing is removed on a foreign base');
 assert.equal(d.have().actorsToken,undefined,'the next request asks for a full list');
});
test('replies from a server without the diet pass through untouched',()=>{
 const d=createSyncDiet();d.expand({shops:{v:1},digests:{shops:'a'}});
 const plain={time:'t',shops:{v:2},actors:[{id:'x'}]};assert.equal(d.expand(plain).data,plain);assert.deepEqual(d.have(),{});
 assert.equal(missingRpc({code:'PGRST202',message:'x'}),true);assert.equal(missingRpc({message:'Session expired'}),false);assert.equal(missingRpc(null),false);
});
test('sync-diet.sql is idempotent, wraps the existing RPCs and avoids destructive keywords',()=>{
 const sql=fs.readFileSync(new URL('../db/sync-diet.sql',import.meta.url),'utf8');
 assert.doesNotMatch(sql,/delete|alter|drop/i);
 assert.match(sql,/create table if not exists eldervale_private\.sync_diet/);
 for(const fn of ['world_command_lean','world_snapshot_lean'])assert.match(sql,new RegExp('create or replace function public\\.'+fn));
 assert.match(sql,/eldervale_private\.realm_request\(session_id,command,payload,request_id,event_cursor\)/,'reuses the live command path');
 assert.match(sql,/grant execute on function public\.world_command_lean\([^)]*\) to authenticated/);
});
