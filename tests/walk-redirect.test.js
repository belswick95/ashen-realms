import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {startRealm} from '../realm-client.js';
import {trimPassedWaypoints,REDIRECT_PAUSE_MS,TILE} from '../click-walk.js';
import {reconcileLocalPose,presentPose,projectPathPose} from '../motion-track.js';
const src=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');

// A walker heading east along z=0 at 2.6 u/s, as the last server reply described it.
const walking={x:0,z:0,yaw:Math.PI/2,at:0,speed:2.6,path:[[20,0]],moving:true};

test('redirect while walking keeps moving: a click-walk in flight never freezes the local walker',async()=>{
 const keys=['window','document','addEventListener','setInterval'],old=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));let release;
 try{globalThis.window={eldervaleRealmBridge:{snapshot(){},event(){}}};globalThis.document={createElement:()=>({style:{},setAttribute(){}}),body:{append(){}}};globalThis.addEventListener=()=>{};globalThis.setInterval=()=>1;
  let calls=0;const db={rpc(){calls++;if(calls===2)return new Promise(r=>{release=()=>r({data:{time:new Date().toISOString(),events:[]}})});return Promise.resolve({data:{time:new Date().toISOString(),events:[]}})}};
  const realm=await startRealm(db,{id:'self'},'session');
  const move=realm.command('move',{path:[[0,10]]});await new Promise(setImmediate);
  assert.equal(realm.movementPending(),true,'the redirect is in flight');
  assert.equal(realm.steerPending(),false,'but only steering input holds the presented walker');
  // The frame loop: the walker keeps gliding along its current path while the reply is pending.
  const position={x:0,z:0},seen=[];
  for(let t=0;t<=600;t+=100){reconcileLocalPose(position,{...walking,...presentPose(walking,t)},.1,{pending:realm.steerPending()});seen.push(position.x)}
  for(let k=1;k<seen.length;k++)assert.ok(seen[k]>seen[k-1],'moving every frame: '+seen.join(' '));
  release();await move;
 }finally{for(const k of keys)if(old[k]===undefined)delete globalThis[k];else globalThis[k]=old[k];}
 assert.match(src,/pending:!!\(window\.eldervaleRealm\?\.steerPending\?window\.eldervaleRealm\.steerPending\(\):window\.eldervaleRealm\?\.movementPending\(\)\)/,'game.js presents with steerPending');
});

test('redirecting never sends a stop for an ordinary click (OSRS: the old path runs until the new one)',()=>{
 assert.ok(REDIRECT_PAUSE_MS>=1000,'only a long route search pauses the walker');
 assert.match(src,/pausePromise=window\.eldervaleRealm\?\.command\('stop'\)\},REDIRECT_PAUSE_MS\)/);
 assert.doesNotMatch(src,/command\('stop'\)\},120\)/,'the 120 ms stop is gone');
});

test('world-click redirect: waypoints the walker already passed are dropped, so it never turns back',()=>{
 // The route was searched from where the walker stood (0,0); by the time it is sent the walker
 // is at (1.2,0), heading east. The click is north-east.
 const route=[[0,0],[.79,.79],[3,3]];
 const sent=trimPassedWaypoints(route,{x:1.2,z:0,yaw:Math.PI/2,moving:true});
 assert.deepEqual(sent,[[3,3]]);
 const [nx]=sent[0];assert.ok(nx-1.2>=0,'first step does not go back west');
 // A waypoint still ahead is kept; reaching the last point keeps the destination.
 assert.deepEqual(trimPassedWaypoints([[2,0],[4,4]],{x:1,z:0}),[[2,0],[4,4]]);
 assert.deepEqual(trimPassedWaypoints([[2,0]],{x:5,z:0}),[[2,0]],'the destination itself is never dropped');
 assert.deepEqual(trimPassedWaypoints([[1,0],[1,5]],{x:1.1,z:0}),[[1,5]],'a reached corner is dropped');
 const detour=[[-4,0],[-4,6],[8,6]];assert.deepEqual(trimPassedWaypoints(detour,{x:0,z:0,yaw:Math.PI/2,moving:true}),detour,'a real detour behind the walker is kept');
 assert.match(src,/route=trimPassedWaypoints\(route,presentPose\(realmPlayerPose,/,'game.js trims before sending a legacy move');
});

test('minimap redirect goes through the same seamless path (no stop, no reset of the walker)',()=>{
 const fn=src.match(/function walkFromMap\(e,canvas\)\{[^\n]*?setWalkDestination\(new T\.Vector3\(target\.x,0,target\.z\)\);\}/);
 assert.ok(fn,'walkFromMap hands the point to setWalkDestination');assert.doesNotMatch(fn[0],/command\('stop'\)/);
 // While the new route is pending, the walker presented from the last reply is still moving.
 const p=projectPathPose(walking,450);assert.ok(p.moving&&p.x>1,'still moving east at 450 ms');
});

test('tile mode: the server keeps the step in progress (db/walk-redirect.sql)',()=>{
 const sql=fs.readFileSync(new URL('../db/walk-redirect.sql',import.meta.url),'utf8');
 for(const word of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+word+'\\b','i').test(sql),word);
 assert.match(sql,/tile_plan_move\(auth\.uid\(\),payload\|\|jsonb_build_object\(''walking'',p\.path\)\)/);
 assert.match(sql,/keep_step:=true;ci:=ni;cj:=nj;/);assert.ok(TILE>0);
});
