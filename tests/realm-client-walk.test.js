import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import {startRealm,playerFacingError} from '../realm-client.js';
// A sync that was already in flight when the player clicked to walk reports "not moving"; it must not
// cancel the local walk (the character used to freeze mid-walk until the next snapshot).
test('snapshots taken before a queued move reached the server are marked motion-stale',async()=>{
 const keys=['window','document','addEventListener','setInterval'],old=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));const seen=[];let releaseSync,clock=1000;
 try{globalThis.window={eldervaleRealmBridge:{snapshot(d,id,meta){seen.push([d.marker,meta.motionStale])},event(){}}};globalThis.document={createElement:()=>({style:{},setAttribute(){}}),body:{append(){}}};globalThis.addEventListener=()=>{};globalThis.setInterval=()=>1;
  const reply=marker=>({data:{time:new Date(clock+=100).toISOString(),marker,events:[]}});let calls=0;
  const db={rpc(name,args){calls++;if(calls===2)return new Promise(r=>{releaseSync=()=>r(reply('slow-sync'))});return Promise.resolve(reply(args.command))}};
  const realm=await startRealm(db,{id:'self'},'session');
  const sync=realm.refresh();await new Promise(setImmediate);
  const move=realm.command('move',{path:[[1,1]]});assert.equal(realm.movementPending(),true,'a queued walk counts as pending movement');
  releaseSync();await sync;await move;
  assert.deepEqual(seen,[['sync',false],['slow-sync',true],['move',false]]);assert.equal(realm.movementPending(),false);
 }finally{for(const k of keys)if(old[k]===undefined)delete globalThis[k];else globalThis[k]=old[k];}
});
test('the snapshot handler keeps the local walk on a motion-stale snapshot',()=>{
 const src=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(src,/snapshot\(data,selfId,meta=\{\}\)\{/);
 assert.match(src,/if\(!realmPlayerPose\.moving&&!meta\.motionStale\)\{dest=null;walkQueue=\[\];mapDestination=null;\}/);
});

// QA (fix113): a server statement timeout was shown in the chat as "Game: canceling statement due to statement timeout".
test('database and transport failures reach the player as a friendly message; game refusals pass through',()=>{
 for(const raw of ['canceling statement due to statement timeout','deadlock detected','Failed to fetch','TypeError: NetworkError when attempting to fetch resource.'])assert.equal(playerFacingError(raw),'The realm is busy - please try that again.');
 for(const rule of ['You need level 20 Woodcutting to chop this tree.','Your inventory is full.','You should finish your training before leaving the castle.'])assert.equal(playerFacingError(rule),rule);
 assert.match(fs.readFileSync(new URL('../realm-client.js',import.meta.url),'utf8'),/commandError=playerFacingError\(e\.message\);window\.eldervaleWorldBridge\.notice\(commandError\)/);
});
