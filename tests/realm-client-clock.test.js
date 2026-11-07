import test from 'node:test';import assert from 'node:assert/strict';import {startRealm} from '../realm-client.js';
test('server clock compensates packet travel time and exposes a bounded presentation lead',async()=>{
 const keys=['window','document','addEventListener','setInterval'],old=Object.fromEntries(keys.map(k=>[k,globalThis[k]])),oldNow=Date.now;let clock=1000,snapshots=0;
 try{Date.now=()=>clock;globalThis.window={eldervaleRealmBridge:{snapshot(){snapshots++},event(){}}};globalThis.document={createElement:()=>({style:{},setAttribute(){}}),body:{append(){}}};globalThis.addEventListener=()=>{};globalThis.setInterval=()=>1;
 const db={async rpc(){clock+=200;return {data:{time:new Date(clock-100+5000).toISOString(),events:[],eventCursor:0}}}};
 const realm=await startRealm(db,{id:'self'},'session');assert.equal(window.eldervaleServerTime(),6200);assert.equal(realm.predictionLead(),100);assert.equal(snapshots,1);
 }finally{Date.now=oldNow;for(const k of keys)if(old[k]===undefined)delete globalThis[k];else globalThis[k]=old[k];}
});
test('a failed movement request cannot strand a newer stop intent or disable reconciliation forever',async()=>{
 const keys=['window','document','addEventListener','setInterval'],old=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));let tick,attempts=[];
 try{globalThis.window={eldervaleRealmBridge:{snapshot(){},event(){}}};globalThis.document={createElement:()=>({style:{},setAttribute(){}}),body:{append(){}}};globalThis.addEventListener=()=>{};globalThis.setInterval=fn=>{tick=fn;return 1};
 const db={async rpc(name,args){if(args.command==='steer'){attempts.push(args.payload);if(attempts.length===1)return {error:{message:'Temporary connection failure'}}}return {data:{time:new Date().toISOString(),events:[],eventCursor:0}}}};
 const realm=await startRealm(db,{id:'self'},'session');realm.steer({x:0,z:1,moving:true});realm.steer({x:0,z:0,moving:false});await new Promise(setImmediate);assert.equal(realm.movementPending(),false);tick();await new Promise(setImmediate);assert.equal(attempts.length,2);assert.equal(attempts[1].moving,false);assert.equal(realm.movementPending(),false);
 }finally{for(const k of keys)if(old[k]===undefined)delete globalThis[k];else globalThis[k]=old[k];}
});

test('stop bypasses delayed start and stale snapshots cannot rewind the player',async()=>{
 const keys=['window','document','addEventListener','setInterval'],old=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));let release,snapshots=[],calls=[];
 try{globalThis.window={eldervaleRealmBridge:{snapshot(d){snapshots.push(d.marker)},event(){}}};globalThis.document={createElement:()=>({style:{},setAttribute(){}}),body:{append(){}}};globalThis.addEventListener=()=>{};globalThis.setInterval=()=>1;
 const reply=(time,marker)=>({data:{time:new Date(time).toISOString(),marker,events:[]}});
 const db={rpc(name,args){calls.push(args);if(args.command!=='steer')return Promise.resolve(reply(1000,'initial'));if(args.payload.sequence===1)return new Promise(r=>{release=()=>r(reply(2000,'old-start'))});return Promise.resolve(reply(3000,'stop'))}};
 const realm=await startRealm(db,{id:'self'},'session');realm.steer({x:0,z:1,moving:true});realm.steer({x:0,z:0,moving:false});assert.equal(calls.length,3);await new Promise(setImmediate);assert.equal(realm.movementPending(),false);release();await new Promise(setImmediate);assert.deepEqual(snapshots,['initial','stop']);
 }finally{for(const k of keys)if(old[k]===undefined)delete globalThis[k];else globalThis[k]=old[k];}
});
test('failed latest stop retries without resurrecting movement',async()=>{
 const keys=['window','document','addEventListener','setInterval'],old=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));let tick,attempts=0;
 try{globalThis.window={eldervaleRealmBridge:{snapshot(){},event(){}}};globalThis.document={createElement:()=>({style:{},setAttribute(){}}),body:{append(){}}};globalThis.addEventListener=()=>{};globalThis.setInterval=fn=>{tick=fn;return 1};
 const db={async rpc(name,args){if(args.command==='steer'&&++attempts===1)return {error:{message:'Temporary failure'}};return {data:{time:new Date().toISOString(),events:[]}}}};
 const realm=await startRealm(db,{id:'self'},'session');realm.steer({x:0,z:0,moving:false});await new Promise(setImmediate);assert.equal(realm.movementPending(),true);tick();await new Promise(setImmediate);assert.equal(attempts,2);assert.equal(realm.movementPending(),false);
 }finally{for(const k of keys)if(old[k]===undefined)delete globalThis[k];else globalThis[k]=old[k];}
});

test('a hidden tab keeps a 3 s presence poll; a visible one polls once per 600 ms tick',async()=>{
 const keys=['window','document','addEventListener','setInterval'],old=Object.fromEntries(keys.map(k=>[k,globalThis[k]])),oldNow=Date.now;let tick,clock=10000,syncs=0;
 try{Date.now=()=>clock;globalThis.window={eldervaleRealmBridge:{snapshot(){},event(){}}};globalThis.document={hidden:false,createElement:()=>({style:{},setAttribute(){}}),body:{append(){}}};globalThis.addEventListener=()=>{};globalThis.setInterval=fn=>{tick=fn;return 1};
 const db={async rpc(name,args){if(args.command==='sync')syncs++;return {data:{time:new Date(clock).toISOString(),events:[]}}}};
 await startRealm(db,{id:'self'},'session');assert.equal(syncs,1);
 clock+=250;tick();await new Promise(setImmediate);assert.equal(syncs,1,'visible: no poll faster than a server tick');
 clock+=350;tick();await new Promise(setImmediate);assert.equal(syncs,2,'visible: polls once a tick');
 document.hidden=true;for(let i=0;i<11;i++){clock+=250;tick();await new Promise(setImmediate)}assert.equal(syncs,2,'hidden: no poll within 3 s');
 clock+=250;tick();await new Promise(setImmediate);assert.equal(syncs,3,'hidden: presence poll after 3 s');
 document.hidden=false;clock+=250;tick();await new Promise(setImmediate);assert.equal(syncs,4,'visible again: polls at once');
 }finally{Date.now=oldNow;for(const k of keys)if(old[k]===undefined)delete globalThis[k];else globalThis[k]=old[k];}
});

test('a busy or slow realm backs the poll off and a quick reply restores it',async()=>{
 const {nextPollDelay,POLL_MS,MAX_POLL_MS,isRealmBusy,playerFacingError}=await import('../realm-client.js');
 assert.equal(nextPollDelay(POLL_MS,{ok:true,ms:120}),POLL_MS);
 let d=POLL_MS;const seen=[];for(let i=0;i<6;i++){d=nextPollDelay(d,{ok:false,busy:true});seen.push(d)}
 assert.deepEqual(seen,[1200,2400,4800,8000,8000,8000]);assert.equal(MAX_POLL_MS,8000);
 assert.equal(nextPollDelay(600,{ok:true,ms:3000}),1200,'a slow reply also backs off');
 assert.equal(nextPollDelay(4800,{ok:true,ms:90}),POLL_MS);
 for(const m of ['canceling statement due to statement timeout','canceling statement due to lock timeout','Failed to fetch','Load failed'])assert.equal(isRealmBusy(m),true,m);
 assert.equal(isRealmBusy('Quest already completed'),false);assert.equal(playerFacingError('canceling statement due to lock timeout'),'The realm is busy - please try that again.');
});
test('busy polls space out on the 250 ms timer and recover after a good reply',async()=>{
 const keys=['window','document','addEventListener','setInterval'],old=Object.fromEntries(keys.map(k=>[k,globalThis[k]])),oldNow=Date.now;let tick,clock=10000,syncs=0,fail=false;
 try{Date.now=()=>clock;globalThis.window={eldervaleRealmBridge:{snapshot(){},event(){}},eldervaleWorldBridge:{notice(){}}};globalThis.document={hidden:false,createElement:()=>({style:{},setAttribute(){}}),body:{append(){}}};globalThis.addEventListener=()=>{};globalThis.setInterval=fn=>{tick=fn;return 1};
 const db={async rpc(name,args){if(args.command==='sync')syncs++;return fail?{error:{message:'canceling statement due to statement timeout'}}:{data:{time:new Date(clock).toISOString(),events:[]}}}};
 await startRealm(db,{id:'self'},'session');fail=true;
 const run=async ms=>{for(let t=0;t<ms;t+=250){clock+=250;tick();await new Promise(setImmediate)}};
 await run(600);assert.equal(syncs,2,'first failing poll');
 await run(1000);assert.equal(syncs,2,'backed off to 1.2 s');await run(250);assert.equal(syncs,3);
 await run(2250);assert.equal(syncs,3,'then 2.4 s');await run(250);assert.equal(syncs,4);
 fail=false;await run(4500);assert.equal(syncs,4,'backed off to 4.8 s');await run(500);assert.equal(syncs,5,'4.8 s later the realm answers');
 await run(600);assert.equal(syncs,6,'back to one poll a tick');
 }finally{Date.now=oldNow;for(const k of keys)if(old[k]===undefined)delete globalThis[k];else globalThis[k]=old[k];}
});
