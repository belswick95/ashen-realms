import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {INVENTORY_SLOTS,bankTransfer,shopTrade,inventoryUsed} from '../economy.js';
import {obstacleBlocks,campObstacleSizes} from '../navigation-obstacles.js';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('the backpack holds 28 items (RuneScape size) on the client',()=>{
 assert.equal(INVENTORY_SLOTS,28);
 const s={gold:0,bank:{wood:40},equipped:{}};assert.equal(bankTransfer(s,'wood','withdraw',true),null);assert.equal(s.wood,28);assert.equal(s.bank.wood,12);assert.equal(inventoryUsed(s),28);
 assert.equal(bankTransfer(s,'wood','withdraw'),'Your inventory is full.');
 const shopper={gold:1000,bank:{},equipped:{},ore:27};assert.equal(shopTrade(shopper,'wood',true),null);assert.equal(inventoryUsed(shopper),28);assert.equal(shopTrade(shopper,'wood',true),'Your inventory is full.');
 // Existing saves keep everything: a 16-item backpack is untouched and gains 12 free slots.
 const old={gold:0,bank:{},equipped:{},ore:16};assert.equal(inventoryUsed(old),16);assert.equal(old.ore,16);
});

test('no client inventory limit still hard-codes 16 slots',()=>{
 for(const file of ['game.js','economy.js','bank-ui.js']){const src=read(file);assert.doesNotMatch(src,/inventoryUsed\(state\)\s*(?:[<>]=?)\s*16\b|\b16-inventoryUsed|length<16\b|i<16;i\+\+\)\{\n  const item=slots|\/ ?16'/,file)}
 assert.match(read('game.js'),/for\(let i=0;i<INVENTORY_SLOTS;i\+\+\)\{\n  const item=slots\[i\]/);
});

test('the inventory panel is a 4×7 grid whose rows share the panel height',()=>{
 const css=read('gameplay.css');
 assert.match(css,/body #side>#inventory\{grid-template-columns:repeat\(4,minmax\(0,1fr\)\)!important;grid-template-rows:repeat\(7,minmax\(24px,1fr\)\)!important/);
 assert.match(css,/body #side>#inventory>\.slot\{height:auto!important;min-height:0!important;margin:0!important/);
});

test('server SQL raises every inventory limit to inventory_capacity() = 28',()=>{
 const sql=read('db/inventory-28-slots.sql');
 assert.match(sql,/create or replace function eldervale_private\.inventory_capacity\(\)\s*returns integer[^;]*select 28/);
 assert.doesNotMatch(sql,/\bdrop\s/i);
 const patches=[...sql.matchAll(/patch_function\('([^']+)'::regprocedure,array\[([\s\S]*?)\]\);/g)];
 const names=patches.map(m=>m[1].split('(')[0].replace('eldervale_private.',''));
 for(const fn of ['gathering_tick','gathering_error_before_professions','skill_finish','pickup','realm_request_base','realm_request_before_castle','realm_request_before_quests','realm_request_before_controls','realm_request_before_bank_notes','realm_request_before_stories','validate_offer','item_change','admin_before_bank_notes'])assert.ok(names.includes(fn),fn);
 let pairs=0;
 for(const [,,body] of patches){const parts=[...body.matchAll(/\$a\$([\s\S]*?)\$a\$/g)].map(m=>m[1]);assert.equal(parts.length%2,0);
  for(let i=0;i<parts.length;i+=2){pairs++;const [from,to]=[parts[i],parts[i+1]];assert.match(from,/\b16\b/);assert.doesNotMatch(to,/\b16\b/);assert.match(to,/eldervale_private\.inventory_capacity\(\)/);assert.equal(to.replace(/eldervale_private\.inventory_capacity\(\)/g,'16'),from,'only the limit changes')}}
 assert.equal(pairs,19);
});

test("Old Tam's cooking fire is a cooking station beside the hut that keeps the door path clear",()=>{
 const sql=read('db/wander-fisherman-range.sql'),hutSql=read('db/general-store-and-fisherman.sql');
 assert.match(sql,/'template','campfire'/);assert.match(sql,/'blueprintKey','wander-fisherman-range'/);assert.match(sql,/if exists\(select 1 from eldervale_private\.entities where not deleted and data->>'blueprint'='osrs-shops-v1' and data->>'blueprintKey'='wander-fisherman-range'\)/);
 assert.doesNotMatch(sql,/\bdrop\s/i);
 // The client and server both count a campfire as a cooking station with the same collision box.
 assert.match(read('game.js'),/station:\['hearth','campfire','cooking_tripod'\]\.includes\(d\.template\)\?'cooking'/);
 assert.match(read('db/admin-console.sql'),/"campfire":\[0\.65,0\.65\]/);assert.deepEqual(campObstacleSizes.campfire,[.65,.65]);
 // Same placement math as the seed: 4 m forward, 5 m right of the hut in its own frame.
 const [,hx,hz,yaw]=hutSql.match(/\('wander-fisherman','Fisherman''s Hut',(-?[\d.]+),(-?[\d.]+),(-?[\d.]+)/).map(Number);
 assert.match(sql,/fx:=round\(\(hut\.x\+4\*sin\(q\)\+5\*cos\(q\)\)::numeric,2\)/);assert.match(sql,/fz:=round\(\(hut\.z\+4\*cos\(q\)-5\*sin\(q\)\)::numeric,2\)/);
 const q=yaw*Math.PI/180,round=v=>Math.round(v*100)/100,fire={template:'campfire',x:round(hx+4*Math.sin(q)+5*Math.cos(q)),z:round(hz+4*Math.cos(q)-5*Math.sin(q)),yaw,scale:1};
 assert.deepEqual([fire.x,fire.z],[-329.07,-9.44]);
 const local=(f,l)=>[hx+f*Math.sin(q)+l*Math.cos(q),hz+f*Math.cos(q)-l*Math.sin(q)];
 assert.ok(obstacleBlocks(fire,fire.x,fire.z),'fire has collision');
 for(let f=2.5;f<=8;f+=.25)for(const l of [-1,0,1])assert.equal(obstacleBlocks(fire,...local(f,l)),false,'door path '+f+','+l);
 for(let f=-3;f<=2.5;f+=.25)assert.equal(obstacleBlocks(fire,...local(f,3.4)),false,'gap to the hut wall');
 assert.ok(Math.hypot(fire.x-hx,fire.z-hz)<8,'next to the hut');
});
