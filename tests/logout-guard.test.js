import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {LOGOUT_COMBAT_MS,LOGOUT_COMBAT_MESSAGE,createCombatClock,createLogoutFlow,isCombatEvent,isLogoutRefusal,isLegacyLogoutReply} from '../logout-guard.js';
import {startRealm} from '../realm-client.js';

const clockAt=start=>{let t=start;const clock=createCombatClock({now:()=>t});return {clock,advance:ms=>{t+=ms},get t(){return t}}};
// A flow whose steps are recorded; overrides replace single steps.
function flowWith(clock,over={}){const calls=[],notices=[];const step=(name,value)=>async()=>{calls.push(name);return typeof value==='function'?value():value};
 const flow=createLogoutFlow({clock,notify:t=>notices.push(t),save:step('save',true),cancelTrade:step('trade'),leave:step('leave',{ok:true}),signOut:step('signOut',true),finish:()=>calls.push('finish'),...over(calls)});
 return {flow,calls,notices}}
const plain=()=>({});

test('the combat window is 10 seconds after the last hit, either side',()=>{
 const c=clockAt(50000);assert.equal(LOGOUT_COMBAT_MS,10000);assert.equal(c.clock.locked(),false);
 c.clock.observeEvent({type:'hit',player:'me',side:'player',damage:3},'me');assert.equal(c.clock.remaining(),10000);
 c.advance(9999);assert.equal(c.clock.locked(),true);c.advance(1);assert.equal(c.clock.locked(),false);
 c.clock.observeEvent({type:'hit',player:'me',side:'enemy',damage:0,blocked:true},'me');assert.equal(c.clock.locked(),true,'a blocked hit on you is still combat');
});
test('poison ticks, other players\' fights and non-hit events do not count as combat',()=>{
 assert.equal(isCombatEvent({type:'hit',player:'me',side:'enemy',poison:true},'me'),false);
 assert.equal(isCombatEvent({type:'hit',player:'someone-else',side:'player'},'me'),false);
 assert.equal(isCombatEvent({type:'level_up',player:'me'},'me'),false);
 assert.equal(isCombatEvent(null,'me'),false);
 assert.equal(isCombatEvent({type:'hit',player:'me',side:'enemy'},'me'),true);
});
test('a live monster targeting the player keeps the window open; a dead one does not',()=>{
 const c=clockAt(1000);c.clock.observeActors([{id:'wolf',target:'me',hp:0},{id:'rat',target:'other',hp:5}],'me');assert.equal(c.clock.locked(),false);
 c.clock.observeActors([{id:'wolf',target:'me',hp:7}],'me');assert.equal(c.clock.locked(),true);
 c.advance(8000);c.clock.observeActors([{id:'wolf',target:'me',hp:7}],'me');c.advance(8000);assert.equal(c.clock.locked(),true,'still being attacked');
 c.clock.observeActors([],'me');c.advance(2001);assert.equal(c.clock.locked(),false);
 c.clock.observeActors(undefined,'me');assert.equal(c.clock.locked(),false);
});
test('an older timestamp never shortens the window and listeners hear each extension',()=>{
 const c=clockAt(20000);let heard=0;c.clock.onChange(()=>heard++);c.clock.mark(20000);c.clock.mark(15000);assert.equal(c.clock.remaining(),10000);assert.equal(heard,1);
});

test('in combat: logout is refused at once with the OSRS message and nothing is saved or signed out',async()=>{
 const c=clockAt(0);c.clock.mark();c.advance(4000);const {flow,calls,notices}=flowWith(c.clock,plain);
 assert.equal(await flow.request(),'combat');assert.deepEqual(calls,[]);assert.deepEqual(notices,[LOGOUT_COMBAT_MESSAGE]);
 assert.match(LOGOUT_COMBAT_MESSAGE,/can't log out until 10 seconds after the end of combat/);
});
test('every attempt inside the window is refused; once 10 s have passed logout is immediate (no countdown)',async()=>{
 const c=clockAt(0);c.clock.mark();const {flow,calls,notices}=flowWith(c.clock,plain);
 for(const ms of [0,3000,3000,3999]){c.advance(ms);assert.equal(await flow.request(),'combat')}
 assert.equal(notices.length,4);c.advance(1);
 assert.equal(await flow.request(),'done');assert.deepEqual(calls,['save','trade','leave','signOut','finish']);
});
test('out of combat: save, cancel trades, server logout, sign out, reload - in that order',async()=>{
 const c=clockAt(0);const {flow,calls,notices}=flowWith(c.clock,plain);assert.equal(await flow.request(),'done');
 assert.deepEqual(calls,['save','trade','leave','signOut','finish']);assert.deepEqual(notices,[]);
});
test('a failed save stops the logout (Retry logout) and a later retry goes through',async()=>{
 const c=clockAt(0);let ok=false;const {flow,calls}=flowWith(c.clock,calls=>({save:async()=>{calls.push('save');return ok}}));
 assert.equal(await flow.request(),'save-failed');assert.deepEqual(calls,['save']);
 ok=true;assert.equal(await flow.request(),'done');assert.deepEqual(calls,['save','save','trade','leave','signOut','finish']);
});
test('combat that starts while the save is in flight cancels the logout',async()=>{
 const c=clockAt(0);const {flow,calls,notices}=flowWith(c.clock,calls=>({save:async()=>{calls.push('save');c.clock.observeEvent({type:'hit',player:'me',side:'enemy'},'me');return true}}));
 assert.equal(await flow.request(),'combat');assert.deepEqual(calls,['save']);assert.deepEqual(notices,[LOGOUT_COMBAT_MESSAGE]);
});
test('the server refusal wins over a stale client clock and starts the client window',async()=>{
 const c=clockAt(0);const {flow,calls,notices}=flowWith(c.clock,calls=>({leave:async()=>{calls.push('leave');return {refused:LOGOUT_COMBAT_MESSAGE}}}));
 assert.equal(await flow.request(),'combat');assert.deepEqual(calls,['save','trade','leave']);assert.deepEqual(notices,[LOGOUT_COMBAT_MESSAGE]);assert.equal(c.clock.locked(),true);
});
test('a realm error keeps the player in game with a readable message; a failed sign-out does not reload',async()=>{
 const c=clockAt(0);let r=flowWith(c.clock,calls=>({leave:async()=>{calls.push('leave');return {error:'The realm is busy - please try that again.'}}}));
 assert.equal(await r.flow.request(),'error');assert.deepEqual(r.notices,['The realm is busy - please try that again.']);assert.ok(!r.calls.includes('signOut'));
 r=flowWith(c.clock,calls=>({signOut:async()=>{calls.push('signOut');return false}}));assert.equal(await r.flow.request(),'signout-failed');assert.ok(!r.calls.includes('finish'));
});
test('the X and the Settings button cannot run two logouts at once',async()=>{
 const c=clockAt(0);let release;const gate=new Promise(r=>release=r);const busy=[];
 const {flow,calls}=flowWith(c.clock,calls=>({save:async()=>{calls.push('save');await gate;return true},onBusy:v=>busy.push(v)}));
 const first=flow.request();assert.equal(flow.busy,true);assert.equal(await flow.request(),'busy');release();assert.equal(await first,'done');
 assert.equal(calls.filter(x=>x==='save').length,1);assert.deepEqual(busy,[true,false]);assert.equal(flow.busy,false);
});
test('server replies are classified: refusal, legacy server or ended session, other errors',()=>{
 assert.equal(isLogoutRefusal("You can't log out until 10 seconds after the end of combat."),true);
 assert.equal(isLogoutRefusal('Statement timeout'),false);
 for(const m of ['Invalid command','Unknown world command','Session expired'])assert.equal(isLegacyLogoutReply(m),true,m);
 assert.equal(isLegacyLogoutReply('Failed to fetch'),false);
});

// realm-client: snapshots feed the clock; leave() sends the 'logout' command and stops polling.
async function realmWith(reply){
 const keys=['window','document','addEventListener','setInterval','clearInterval'],old=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));const sent=[];let cleared=0;
 globalThis.window={eldervaleRealmBridge:{snapshot(){},event(){}},eldervaleWorldBridge:{notice(){}}};globalThis.document={createElement:()=>({style:{},setAttribute(){}}),body:{append(){}}};globalThis.addEventListener=()=>{};globalThis.setInterval=()=>7;globalThis.clearInterval=()=>{cleared++};
 const db={async rpc(name,args){sent.push(args.command);return reply(args)}};
 const restore=()=>{for(const k of keys)if(old[k]===undefined)delete globalThis[k];else globalThis[k]=old[k]};
 try{const realm=await startRealm(db,{id:'me'},'session');return {realm,sent,get cleared(){return cleared},restore}}catch(e){restore();throw e}
}
const ok=(extra={})=>({data:{time:new Date().toISOString(),events:[],eventCursor:0,...extra}});
test('realm client: leave() logs out on the server and stops polling; a refusal keeps the session',async()=>{
 let refuse=true;const r=await realmWith(a=>a.command==='logout'?(refuse?{error:{message:LOGOUT_COMBAT_MESSAGE}}:{data:{reset:true,loggedOut:true}}):ok());
 try{assert.deepEqual(await r.realm.leave(),{refused:LOGOUT_COMBAT_MESSAGE});assert.equal(r.cleared,0);assert.equal(await r.realm.checkpoint(),true,'session still live');
  refuse=false;assert.deepEqual(await r.realm.leave(),{ok:true});assert.equal(r.cleared,1);assert.equal(await r.realm.checkpoint(),false,'no more world requests');
  assert.deepEqual(r.sent.filter(c=>c==='logout').length,2)}finally{r.restore()}
});
test('realm client: a server without the logout command falls back to the old sign-out',async()=>{
 const r=await realmWith(a=>a.command==='logout'?{error:{message:'Unknown world command'}}:ok());
 try{assert.deepEqual(await r.realm.leave(),{ok:true,legacy:true});assert.equal(r.cleared,1)}finally{r.restore()}
 const e=await realmWith(a=>a.command==='logout'?{error:{message:'canceling statement due to statement timeout'}}:ok());
 try{assert.deepEqual(await e.realm.leave(),{error:'The realm is busy - please try that again.'});assert.equal(e.cleared,0)}finally{e.restore()}
});
test('realm client: hits on the player and monsters targeting the player start the combat clock',async()=>{
 // Same module instance as realm-client.js (it imports the versioned URL).
 const version=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8').match(/src="\/auth\.js\?v=([^"&]+)/)[1];
 const {combatClock}=await import('../logout-guard.js?v='+version);combatClock.reset();let n=0;
 const r=await realmWith(a=>{n++;return n===2?ok({eventCursor:5,events:[{id:5,data:{type:'hit',player:'me',side:'player',damage:2}}]}):n===3?ok({actors:[{id:'wolf',target:'me',hp:4}]}):ok()});
 try{assert.equal(combatClock.locked(),false);await r.realm.refresh();assert.equal(combatClock.locked(),true);combatClock.reset();await r.realm.refresh();assert.equal(combatClock.locked(),true);combatClock.reset();await r.realm.refresh();assert.equal(combatClock.locked(),false)}finally{r.restore();combatClock.reset()}
});

test('auth.js routes the Settings button and the X through one flow; the X sits in the minimap cluster',()=>{
 const auth=fs.readFileSync(new URL('../auth.js',import.meta.url),'utf8'),html=fs.readFileSync(new URL('../index.html',import.meta.url),'utf8'),fit=fs.readFileSync(new URL('../phone-fit.css',import.meta.url),'utf8'),theme=fs.readFileSync(new URL('../medieval-theme.css',import.meta.url),'utf8'),guard=fs.readFileSync(new URL('../logout-guard.js',import.meta.url),'utf8');
 assert.match(html,/id="settings-logout"[^>]*onclick="document\.getElementById\('logout'\)\.click\(\)"/);
 assert.match(auth,/logoutButton\.onclick=\(\)=>void logoutFlow\.request\(\)/);
 assert.match(auth,/installLogoutButton\(\(\)=>void logoutFlow\.request\(\)\)/);
 assert.doesNotMatch(auth,/Logging out in|countdown/i,'OSRS rule: no countdown dialog');
 assert.match(guard,/setAttribute\('aria-label','Log out'\)/);assert.match(guard,/button\.title='Log out'|'Log out'/);
 assert.match(fit,/#map-widget#map-widget #logout-x\{position:absolute!important;inset:0 0 auto auto!important;width:var\(--mm-o\)/);
 assert.match(fit,/--mm-xs:34px/);assert.match(fit,/phone-layout\{--mm-xs:40px/);
 assert.match(theme,/#logout-x#logout-x\{[^}]*border-radius:50%!important/);
});
test('the server half exists, is idempotent and avoids destructive statements',()=>{
 const sql=fs.readFileSync(new URL('../db/logout-combat.sql',import.meta.url),'utf8');
 assert.doesNotMatch(sql,/\b(delete|alter|drop)\b/i);
 assert.match(sql,/create table if not exists eldervale_private\.logout_linger/);
 assert.match(sql,/position\('logout_command' in pg_get_functiondef\('eldervale_private\.realm_request/);
 assert.match(sql,/position\('logout_linger' in pg_get_functiondef\('eldervale_private\.world_tick/);
 assert.match(sql,/can''t log out until 10 seconds after the end of combat/);
 assert.match(sql,/Dry run/i);
});
