import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {arrangeInventory,moveSlot,sanitizeOrder,createOrderSync,ORDER_SIZE} from '../inventory-order.js';
import {toPlayerRow,fromPlayerRow} from '../player-save.js';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const items=(...ids)=>ids.map((id,n)=>({id,n}));
const ids=r=>r.order.slice(0,8);
const multiset=list=>list.filter(Boolean).map(i=>i.id??i).sort().join(',');

test('a fresh backpack fills in save order; the order matches the real items',()=>{
 const r=arrangeInventory(items('weapon:dagger','wood','wood','cookedTrout'),null);
 assert.deepEqual(ids(r),['weapon:dagger','wood','wood','cookedTrout',null,null,null,null]);
 assert.equal(r.order.length,ORDER_SIZE);assert.deepEqual(r.overflow,[]);
});

test('items keep their remembered slots, new items take the first empty slot',()=>{
 const prev=[null,'cookedTrout',null,'wood','weapon:dagger'];
 const r=arrangeInventory(items('weapon:dagger','wood','cookedTrout','ore'),prev);
 assert.deepEqual(ids(r),['ore','cookedTrout',null,'wood','weapon:dagger',null,null,null]);
});

test('used-up items leave a gap; the slot the player used is the one emptied',()=>{
 const prev=['cookedTrout','cookedTrout','cookedTrout','wood'];
 assert.deepEqual(ids(arrangeInventory(items('cookedTrout','cookedTrout','wood'),prev)),['cookedTrout','cookedTrout',null,'wood',null,null,null,null]);
 assert.deepEqual(ids(arrangeInventory(items('cookedTrout','cookedTrout','wood'),prev,{vacate:[0]})),[null,'cookedTrout','cookedTrout','wood',null,null,null,null]);
 // A hint on a slot that did not lose anything changes nothing.
 assert.deepEqual(ids(arrangeInventory(items('cookedTrout','cookedTrout','cookedTrout','wood'),prev,{vacate:[3]})),prev.concat([null,null,null,null]));
 // The next new item fills that gap.
 assert.deepEqual(ids(arrangeInventory(items('cookedTrout','cookedTrout','wood','ore'),[null,'cookedTrout','cookedTrout','wood'])),['ore','cookedTrout','cookedTrout','wood',null,null,null,null]);
});

test('stacks and bank notes are one slot each and keep their place as counts change',()=>{
 const prev=['wood','coins',null,'note:wood','bait'];
 const r=arrangeInventory([{id:'bait',count:500},{id:'note:wood',count:40},{id:'wood'}],prev);
 assert.deepEqual(ids(r),['wood',null,null,'note:wood','bait',null,null,null]);
 assert.equal(r.slots[4].count,500);
 // Withdrawing more noted logs only changes the count, not the slot.
 assert.equal(arrangeInventory([{id:'bait',count:499},{id:'note:wood',count:60},{id:'wood'}],r.order).order[3],'note:wood');
});

test('dragging swaps two slots or moves onto an empty one',()=>{
 const o=['a','b',null,'c'];
 assert.deepEqual(moveSlot(o,0,3),['c','b',null,'a']);
 assert.deepEqual(moveSlot(o,1,2),['a',null,'b','c']);
 assert.deepEqual(moveSlot(o,2,0),o,'an empty slot cannot be dragged');
 assert.deepEqual(moveSlot(o,1,1),o);assert.deepEqual(moveSlot(o,1,9),o);assert.deepEqual(moveSlot(o,-1,0),o);
 assert.notEqual(moveSlot(o,0,3),o,'returns a copy');
});

test('a stale, edited or hostile order can never add, remove or duplicate an item',()=>{
 let seed=7;const rand=n=>(seed=(seed*1103515245+12345)%2147483648)%n;
 const pool=['wood','ore','cookedTrout','note:wood','weapon:dagger','armor:bronzeHelm','bait'];
 for(let round=0;round<400;round++){
  const real=Array.from({length:rand(30)},()=>({id:pool[rand(pool.length)]}));
  const order=Array.from({length:rand(40)},()=>[null,...pool,'ghost:item',42,{}][rand(pool.length+4)]);
  const r=arrangeInventory(real,order,{vacate:[rand(28)]});
  const shown=[...r.slots.filter(Boolean),...r.overflow];
  assert.equal(shown.length,real.length);assert.equal(new Set(shown).size,real.length,'each real item once');
  assert.equal(multiset(shown),multiset(real));
  assert.equal(r.overflow.length,Math.max(0,real.length-28));
  r.order.forEach((id,i)=>assert.equal(id,r.slots[i]?.id??null));
  // Re-arranging with its own order is stable.
  assert.deepEqual(arrangeInventory(real,r.order).order,r.order);
  // Any number of drags keeps the same items.
  let o=r.order;for(let k=0;k<10;k++)o=moveSlot(o,rand(28),rand(28));
  assert.equal(multiset(arrangeInventory(real,o).slots),multiset(r.slots));
 }
});

test('sanitizeOrder keeps 28 safe ids or nulls',()=>{
 const o=sanitizeOrder(['wood',null,7,'<script>','note:wood','x'.repeat(65),'armor:bronzeHelm']);
 assert.equal(o.length,28);assert.deepEqual(o.slice(0,7),['wood',null,null,null,'note:wood',null,'armor:bronzeHelm']);
 assert.deepEqual(sanitizeOrder({a:1}),Array(28).fill(null));assert.equal(sanitizeOrder(Array(40).fill('wood')).length,28);
});

test('the order is sent once, soon after a drag and lazily after other changes',async()=>{
 const timers=[];const sent=[];let reply=true;
 const sync=createOrderSync({send:o=>{sent.push(o);return reply},setTimer:(fn,ms)=>{const t={fn,ms};timers.push(t);return t},clearTimer:t=>{t.cleared=true},soon:600,later:15000});
 const run=async()=>{const live=timers.filter(t=>!t.cleared&&!t.ran);for(const t of live){t.ran=true;await t.fn()}await Promise.resolve()};
 sync.known(['a',null]);sync.schedule(['a',null]);assert.equal(timers.length,0,'unchanged order is not sent');
 sync.schedule([null,'a']);assert.equal(timers.at(-1).ms,15000);
 sync.schedule(['b','a'],{urgent:true});assert.equal(timers.at(-1).ms,600);assert.ok(timers[0].cleared,'a drag brings the save forward');
 await run();assert.deepEqual(sent,[['b','a']]);assert.equal(sync.pending,false);
 sync.schedule(['b','a'],{urgent:true});await run();assert.equal(sent.length,1,'nothing new to send');
 reply=false;sync.schedule(['a','b'],{urgent:true});for(let i=0;i<6;i++)await run();
 assert.equal(sent.length,4,'gives up after three failures (an old server without the command)');assert.equal(sync.pending,true);
});

test('the order round-trips through game_flags in the save',()=>{
 const s={gold:1,inventoryOrder:['wood',null,'note:wood']};
 const row=toPlayerRow(s,{id:'u1'});assert.deepEqual(row.game_flags.inventoryOrder.slice(0,3),['wood',null,'note:wood']);assert.equal(row.game_flags.inventoryOrder.length,28);
 assert.deepEqual(fromPlayerRow(row).inventoryOrder,row.game_flags.inventoryOrder);
 assert.deepEqual(fromPlayerRow({game_flags:{}}).inventoryOrder,Array(28).fill(null));
});

test('the game draws the backpack through arrangeInventory and sends inventory_order',()=>{
 const src=read('game.js');
 assert.match(src,/arrangeInventory\(slots\.map\(s=>\(\{\.\.\.s,id:slotItemId\(s\)\}\)\),inventoryLayout/);
 assert.match(src,/quietCommand\?\.\('inventory_order',\{order\}\)/);
 assert.match(src,/installInventoryDrag\(inventory,/);
 assert.match(src,/data\.self\.game_flags\?\.inventoryOrder/);
});

test('db/inventory-order.sql: idempotent, guarded hook, validated command that only stores order',()=>{
 const sql=read('db/inventory-order.sql');
 assert.doesNotMatch(sql,/\b(delete|alter|drop)\b/i);
 assert.match(sql,/create or replace function eldervale_private\.inventory_order_command\(session_id uuid, command text, payload jsonb, request_id uuid, event_cursor bigint\)/);
 assert.match(sql,/if position\('inventory_order_command' in pg_get_functiondef\('eldervale_private\.realm_request\(uuid,text,jsonb,uuid,bigint\)'::regprocedure\)\)=0 then\s+perform eldervale_private\.patch_function\(/);
 assert.match(sql,/jsonb_array_length\(ord\)>eldervale_private\.inventory_capacity\(\)/);
 assert.match(sql,/\^\[A-Za-z0-9\]\[A-Za-z0-9_:\.-\]\{0,63\}\$/);
 assert.match(sql,/game_flags=coalesce\(game_flags,'\{\}'::jsonb\)\|\|jsonb_build_object\('inventoryOrder',ord\)/);
 assert.match(sql,/realm_requests r where r\.user_id=auth\.uid\(\) and r\.request_id=\$4/);
 assert.match(sql,/Dry run/);
 // Only player_saves.game_flags is written: no item counts.
 assert.equal([...sql.replace(/--.*$/gm,'').matchAll(/\bupdate\s+(\S+)/gi)].map(m=>m[1]).join(),'public.player_saves');
 assert.doesNotMatch(sql.replace(/^--.*$/gm,''),/\b(stats|inventory)\s*=/);
 // The server regex and the client one agree.
 const serverId=new RegExp(sql.match(/~ '(\^[^']+\$)'/)[1]);
 for(const id of ['wood','note:wood','armor:bronzeHelm','mount:armoredWhiteHorse','cookedTrout'])assert.ok(serverId.test(id),id);
 for(const id of ['','a b',"x'y",'x'.repeat(65)])assert.ok(!serverId.test(id),id);
});

test('every item id the backpack can show is a valid order id',async()=>{
 const {goods}=await import('../economy.js');const {ORDER_ID}=await import('../inventory-order.js');
 const bad=Object.keys(goods).filter(id=>!ORDER_ID.test(id));assert.deepEqual(bad,[]);
});
