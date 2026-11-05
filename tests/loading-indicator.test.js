import test from 'node:test';import assert from 'node:assert/strict';
import {createLoadingIndicator,trackLoadingManager,commandLabel,LOADING_DELAY_MS} from '../loading-indicator.js';

// Manual clock: timers fire only when the test advances time.
function clock(){let t=0,id=0;const timers=new Map();return {now:()=>t,setTimer:(fn,ms)=>{timers.set(++id,{fn,at:t+ms});return id},clearTimer:i=>timers.delete(i),advance(ms){const end=t+ms;for(;;){const next=[...timers.entries()].sort((a,b)=>a[1].at-b[1].at)[0];if(!next||next[1].at>end)break;timers.delete(next[0]);t=next[1].at;next[1].fn()}t=end},get pending(){return timers.size}}}
// Minimal DOM: enough for the chip and boot screen to be created and toggled.
function fakeDoc(){const make=tag=>{const n={tagName:tag,children:[],hidden:false,dataset:{},style:{},attrs:{},textContent:'',classes:new Set(),
 set innerHTML(v){n.html=v;n.children=[...v.matchAll(/class="([^"]+)"/g)].map(m=>{const c=make('span');c.className=m[1];return c})},
 setAttribute(k,v){n.attrs[k]=v},removeAttribute(k){delete n.attrs[k];if(k==='data-kind')delete n.dataset.kind},append(...c){n.children.push(...c)},
 querySelector(sel){const cls=sel.replace(/^\./,'');return n.children.find(c=>c.className===cls)||null},
 classList:{add:c=>n.classes.add(c),remove:c=>n.classes.delete(c),contains:c=>n.classes.has(c)}};return n};
 const body=make('body');return {body,createElement:make,chip:()=>body.children.find(c=>c.id==='loading-chip'),boot:()=>body.children.find(c=>c.id==='world-boot')}}

test('quick work never shows the chip; slow work shows it after the delay and hides instantly',()=>{
 const c=clock(),doc=fakeDoc(),l=createLoadingIndicator({doc,...c});
 const quick=l.begin('Banking…');c.advance(LOADING_DELAY_MS-50);quick.end();c.advance(1000);
 assert.equal(l.visible,false);assert.equal(doc.chip()?.hidden??true,true);
 const slow=l.begin('Trading…');c.advance(LOADING_DELAY_MS-1);assert.equal(l.visible,false);c.advance(1);
 assert.equal(l.visible,true);assert.equal(doc.chip().hidden,false);assert.equal(doc.chip().querySelector('.loading-chip-label').textContent,'Trading…');
 assert.ok(doc.body.classList.contains('loading-chip-visible'));
 slow.end();assert.equal(l.visible,false);assert.equal(doc.chip().hidden,true);assert.equal(c.pending,0,'no timers left behind');
});

test('jobs are ref-counted and the newest label wins',()=>{
 const c=clock(),l=createLoadingIndicator({doc:fakeDoc(),...c});
 const a=l.begin('Loading models…'),b=l.begin('Banking…');c.advance(400);
 assert.equal(l.count,2);assert.equal(l.label,'Banking…');
 b.end();b.end();assert.equal(l.count,1,'double end is harmless');assert.equal(l.visible,true);assert.equal(l.label,'Loading models…');
 a.end();assert.equal(l.count,0);assert.equal(l.visible,false);
});

test('a forgotten job is cleared by the safety timeout',()=>{
 const c=clock(),l=createLoadingIndicator({doc:fakeDoc(),...c,safety:5000});
 l.begin('Lost request');c.advance(400);assert.equal(l.visible,true);c.advance(4700);assert.equal(l.visible,false);assert.equal(l.count,0);
});

test('track ends on success, rejection and synchronous throw, and passes results through',async()=>{
 const c=clock(),l=createLoadingIndicator({doc:fakeDoc(),...c});
 assert.equal(await l.track(Promise.resolve(7),'x'),7);assert.equal(l.count,0);
 await assert.rejects(l.track(Promise.reject(Error('nope')),'x'),/nope/);assert.equal(l.count,0);
 assert.throws(()=>l.track(()=>{throw Error('sync')},'x'),/sync/);assert.equal(l.count,0);
 let release;const pending=l.track(()=>new Promise(r=>release=r),'Picking up…');assert.equal(l.count,1);c.advance(500);assert.equal(l.visible,true);release('ok');assert.equal(await pending,'ok');assert.equal(l.visible,false);
 // thenables such as Supabase query builders work too
 assert.equal(await l.track({then:r=>r(3)},'x'),3);
});

test('keyed jobs (reconnect) refresh instead of stacking and end by key',()=>{
 const c=clock(),doc=fakeDoc(),l=createLoadingIndicator({doc,...c,safety:15000});
 for(let i=0;i<10;i++){l.begin('Reconnecting…',{key:'realm',kind:'reconnect'});c.advance(250)}
 assert.equal(l.count,1);assert.equal(l.visible,true,'shown once its first delay passed, despite re-begins');assert.equal(doc.chip().dataset.kind,'reconnect');
 c.advance(14000);assert.equal(l.visible,true,'each failure refreshes the safety timeout');
 l.end('realm');assert.equal(l.visible,false);l.end('realm');l.end('unknown');
 const old=l.begin('Reconnecting…',{key:'k'});l.begin('Reconnecting…',{key:'k'});old.end();assert.equal(l.count,1,'a superseded handle cannot end the newer job');
});

test('boot progress only moves forward, creeps toward a milestone and hides cleanly',()=>{
 const c=clock(),doc=fakeDoc(),l=createLoadingIndicator({doc,...c});
 l.bootProgress('Loading your saved character…',.2);const boot=doc.boot();assert.equal(boot.hidden,false);assert.ok(doc.body.classList.contains('world-booting'));
 const fill=boot.querySelector('.world-boot-fill');assert.equal(fill.style.width,'20.0%');
 l.bootProgress('Preparing the Heartlands…',.1,'',.5);assert.equal(fill.style.width,'20.0%','never backwards');
 c.advance(4000);const crept=parseFloat(fill.style.width);assert.ok(crept>20&&crept<50,'creeps but never reaches the milestone: '+crept);
 l.bootDone();assert.equal(boot.hidden,true);assert.equal(l.booting,false);assert.equal(c.pending,0);assert.ok(!doc.body.classList.contains('world-booting'));
});

test('works without a document (node, workers) and wraps three.js loading managers',()=>{
 const c=clock(),l=createLoadingIndicator({doc:null,...c});
 const manager={itemsLoaded:0,itemsTotal:0,onLoad:()=>{manager.loaded=true}};trackLoadingManager(manager,l);trackLoadingManager(manager,l);
 manager.onStart('a.png',0,1);manager.onStart('b.png',0,2);assert.equal(l.count,1);c.advance(400);assert.equal(l.visible,true);
 manager.onLoad();assert.equal(l.count,0);assert.equal(manager.loaded,true,'existing handler still runs');
 l.bootProgress('x',.5);l.bootDone();
});

test('movement and cosmetic commands stay quiet; waited-on commands get a label',()=>{
 for(const c of ['move','stop','jump','run','steer','sync','celebrate'])assert.equal(commandLabel(c),null);
 assert.equal(commandLabel('bank'),'Banking…');assert.equal(commandLabel('trade_offer'),'Trading…');assert.equal(commandLabel('equip'),'Equipping…');assert.equal(commandLabel('stairs'),'Travelling…');assert.equal(commandLabel('skill_start'),'Working…');
});
