import test from 'node:test';import assert from 'node:assert/strict';import {startRealm} from '../realm-client.js';
test('server clock compensates packet travel time and exposes a bounded presentation lead',async()=>{
 const keys=['window','document','addEventListener','setInterval'],old=Object.fromEntries(keys.map(k=>[k,globalThis[k]])),oldNow=Date.now;let clock=1000,snapshots=0;
 try{Date.now=()=>clock;globalThis.window={eldervaleRealmBridge:{snapshot(){snapshots++},event(){}}};globalThis.document={createElement:()=>({style:{},setAttribute(){}}),body:{append(){}}};globalThis.addEventListener=()=>{};globalThis.setInterval=()=>1;
 const db={async rpc(){clock+=200;return {data:{time:new Date(clock-100+5000).toISOString(),events:[],eventCursor:0}}}};
 const realm=await startRealm(db,{id:'self'},'session');assert.equal(window.eldervaleServerTime(),6200);assert.equal(realm.predictionLead(),100);assert.equal(snapshots,1);
 }finally{Date.now=oldNow;for(const k of keys)if(old[k]===undefined)delete globalThis[k];else globalThis[k]=old[k];}
});
