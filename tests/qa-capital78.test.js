// Regressions from the capital78 QA pass (castle tutorial + Birchford capital playthrough).
import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {serviceEmptyText,serviceOutOfReach} from '../economy.js';
import {followGoal,approachPoint} from '../click-walk.js';

const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const worldClient=readFileSync(new URL('../world-client.js',import.meta.url),'utf8');

test('a merchant that buys nothing you carry still explains itself instead of "No items here yet"',()=>{
 assert.equal(serviceEmptyText('shop','inventory',5),'This merchant is not interested in anything you are carrying.');
 assert.equal(serviceEmptyText('shop','inventory',0),'You have nothing to sell.');
 assert.equal(serviceEmptyText('shop','stock'),'This merchant has nothing for sale right now.');
 assert.doesNotMatch(readFileSync(new URL('../economy.js',import.meta.url),'utf8'),/No items here yet/);
});

test('a shop with an unknown merchant id does not list the whole item catalogue as stock',()=>{
 const economy=readFileSync(new URL('../economy.js',import.meta.url),'utf8');
 assert.match(economy,/Object\.keys\(shop\(\)\|\|\(merchantId\?\{\}:goods\)\)/);
});

test('the bank or shop closes once you walk away from where you opened it',()=>{
 const at={x:10,z:10};
 assert.equal(serviceOutOfReach(at,{x:11,z:11}),false);
 assert.equal(serviceOutOfReach(at,{x:15,z:10}),true);
 assert.equal(serviceOutOfReach(null,{x:99,z:99}),false,'nothing to close against');
 assert.equal(serviceOutOfReach(at,{x:NaN,z:10}),false,'a bad position never closes the panel');
 assert.match(game,/services\.isOpen&&serviceOutOfReach\(serviceAnchor,player\.position\)/);
});

test('Follow walks to just behind the leader, idles when close and gives up when they are gone',()=>{
 assert.equal(followGoal({x:0,z:0},{x:1,z:1}),null);
 const g=followGoal({x:0,z:0},{x:10,z:0});assert.ok(Math.abs(g.x-8.4)<1e-9&&g.z===0,JSON.stringify(g));
 assert.equal(followGoal({x:0,z:0},null),'lost');
 assert.equal(followGoal({x:0,z:0},{x:500,z:0}),'lost');
});

test('the player right-click menu offers Trade, Follow and Report like RuneScape',()=>{
 const menu=game.slice(game.indexOf("userData.kind==='player'"),game.indexOf("userData.kind==='player'")+900);
 for(const label of ["'Trade with '","'Follow '","'Report '"])assert.ok(menu.includes(label),label);
 assert.match(worldClient,/window\.eldervaleReportPlayer=\(targetId=null,targetName=''\)=>/);
});

test('profession stations (furnace, anvil, fires, the castle hearth) get a right-click menu',()=>{
 const branch=game.slice(game.indexOf("if(hits[0]?.object.userData.kind==='profession')"),game.indexOf("if(hits[0]?.object.userData.kind==='rock')"));
 assert.match(branch,/if\(e\.button===2\)menuAt\(/);assert.match(branch,/'Examine '\+station/);
});

test('clicking a market stall trades with the merchant standing at it, not an empty "Traveling merchant"',()=>{
 assert.match(game,/function stallKeeperHit\(stall\)/);
 assert.match(game,/station==='market'\)\{const keeper=stallKeeperHit/);
 assert.match(game,/a\.station==='market'\?'Browse market stall'/);
});

test('talking to an NPC stops beside it instead of walking into it',()=>{
 const stand=approachPoint({x:0,z:0},{x:10,z:0},2.4);
 assert.ok(Math.abs(stand.x-8.56)<1e-9,'stands 1.44 m short: '+stand.x);
 assert.match(game,/setWalkDestination\(npcStandPoint\(a\.root\.position\)\)/);
});

test('a world session replaced by another sign-in stops polling and returns to the sign-in screen',async()=>{
 const {startRealm}=await import('../realm-client.js');
 let calls=0,lost=null;const timers=[];
 globalThis.window={eldervaleRealmBridge:{snapshot(){},event(){}},eldervaleWorldBridge:{notice(){}},eldervaleSessionLost:r=>{lost=r}};
 globalThis.document={createElement:()=>({style:{},setAttribute(){},hidden:true}),body:{append(){}}};
 const realSetInterval=globalThis.setInterval,hadListener='addEventListener' in globalThis;globalThis.setInterval=fn=>{timers.push(fn);return 0};
 if(!hadListener)globalThis.addEventListener=()=>{};
 const db={rpc:async()=>{calls++;return calls===1?{data:{time:new Date().toISOString(),events:[],eventCursor:0}}:{error:{message:'Session expired'}}}};
 try{
  await startRealm(db,{id:'u'},'s');
  timers[0]();await new Promise(r=>setTimeout(r,10));
  assert.match(String(lost),/signed in from another/);
  const after=calls;for(let i=0;i<5;i++)timers[0]();await new Promise(r=>setTimeout(r,10));
  assert.equal(calls,after,'no more requests once the session is gone');
 }finally{globalThis.setInterval=realSetInterval;delete globalThis.window;delete globalThis.document;if(!hadListener)delete globalThis.addEventListener}
});

test('only bank notes get the "Bank note" inventory option; a tinderbox or sword does not',()=>{
 assert.match(game,/else if\(goods\[itemId\]\.noteOf\)choices\.unshift\(\['Bank note'/);
});

test('Escape skips the arrival cutscene even while the King is talking',()=>{
 const tutorial=readFileSync(new URL('../tutorial.js',import.meta.url),'utf8');
 assert.match(tutorial,/const blockKeys=e=>\{if\(!cutscene\.active\)return;if\(e\.key==='Escape'\)\{[^}]*skip\.onclick\(\);return\}if\(box\.contains/);
});

test('the Lunge tooltip names all three skills it trains, as the server awards',()=>{
 assert.match(game,/Splits combat XP equally between Attack, Strength and Defence\./);
});

test('right-clicking bare ground still offers Walk here / Cancel',()=>{
 assert.match(game,/if\(!only\)\{if\(walkHere\)menuAt\(e\.clientX,e\.clientY,\[\['Cancel',\(\)=>\{\}\]\]\);else closeMenu\(\);return\}/);
});

test('world chat sends the profile username the insert policy checks, not the "Adventurer" display fallback',()=>{
 const social=readFileSync(new URL('../social.js',import.meta.url),'utf8');
 assert.match(social,/insert\(\{sender_id:user\.id,sender_name:senderName,body\}\)/);
 assert.match(social,/from\('player_profiles'\)\.select\('username'\)/);
});

test('the castle hearth opens the cooking recipes rather than the old cook-and-eat fish shortcut',()=>{
 assert.doesNotMatch(game,/command\(a\.kind==='altar'\?'pray':'cook'/);
 assert.match(game,/a\?\.kind==='hearth'\)professions\.open\(\{station:'cooking',target:e\.target\}\)/);
});
