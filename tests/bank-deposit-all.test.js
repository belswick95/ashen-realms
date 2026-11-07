import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {goods,depositInventory,bankTransfer,inventoryUsed,inventoryEntries,quantity,BANK_STACK_LIMIT,INVENTORY_SLOTS} from '../economy.js';
import {depositInventoryStatus} from '../bank-ui.js';
import {arrangeInventory} from '../inventory-order.js';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const character=extra=>({bank:{},weaponsOwned:[],armorOwned:[],shieldsOwned:[],jewelryOwned:[],mountsOwned:[],equipped:{},gold:77,...extra});
// Everything the player owns of each base item, carried (notes count as their item) plus banked.
const totals=s=>{const t={};for(const id of Object.keys(goods)){const base=goods[id].noteOf||id;const n=quantity(s,id)+(goods[id].noteOf?0:(s.bank?.[id]||0));if(n)t[base]=(t[base]||0)+n}return t};

test('deposit inventory empties the backpack: stacks merge, notes un-note, worn gear stays worn',()=>{
 const s=character({bank:{wood:10},wood:5,'note:wood':40,bait:500,weaponsOwned:['longsword','longsword'],equippedWeapon:'longsword',armorOwned:['bronzeArmet'],woodXP:1234});
 const before=totals(s);assert.equal(inventoryUsed(s),9);
 const r=depositInventory(s);
 assert.equal(r.error,null);assert.deepEqual(r.kept,{});assert.equal(r.moved,5+40+500+1+1);
 assert.deepEqual(s.bank,{wood:55,bait:500,'weapon:longsword':1,'armor:bronzeArmet':1});
 assert.equal(inventoryUsed(s),0);assert.deepEqual(inventoryEntries(s),[]);
 assert.deepEqual(s.weaponsOwned,['longsword'],'the wielded copy is kept');assert.equal(s.equippedWeapon,'longsword');
 assert.equal(s['note:wood'],0);assert.equal(s.woodXP,1234);assert.equal(s.gold,77,'gold is not a backpack item');
 assert.deepEqual(totals(s),before,'nothing created or lost');
});

test('a full bank stack keeps the remainder in the backpack and reports it',()=>{
 const s=character({bank:{bait:BANK_STACK_LIMIT-10},bait:50,wood:2});
 const r=depositInventory(s);
 assert.equal(r.error,null);assert.deepEqual(r.deposited,{bait:10,wood:2});assert.deepEqual(r.kept,{bait:40});
 assert.equal(s.bait,40);assert.equal(s.bank.bait,BANK_STACK_LIMIT);assert.equal(s.bank.wood,2);
 const again=depositInventory(s);assert.match(again.error,/cannot hold/);assert.equal(s.bait,40,'a refused deposit changes nothing');
 assert.equal(depositInventoryStatus(inventoryEntries(s).map(id=>goods[id].name)),'Your bank could not hold everything. Still carried: '+goods.bait.name+'.');
});

test('an empty backpack (or only worn gear) has nothing to deposit',()=>{
 assert.match(depositInventory(character()).error,/nothing to deposit/);
 const s=character({weaponsOwned:['longsword'],equippedWeapon:'longsword'});
 assert.match(depositInventory(s).error,/nothing to deposit/);assert.deepEqual(s.weaponsOwned,['longsword']);
 assert.equal(depositInventoryStatus([]),'Your backpack is now in the vault.');
});

test('deposit inventory matches depositing each item with "Deposit all", and conserves items',()=>{
 let seed=11;const rand=n=>(seed=(seed*1103515245+12345)%2147483648)%n;
 const ids=['wood','ore','bait','note:wood','note:weapon:longsword','weapon:longsword','armor:bronzeArmet','weapon:dagger'].filter(id=>goods[id]);
 for(let round=0;round<200;round++){
  const s=character({bank:{wood:rand(3)?rand(50):BANK_STACK_LIMIT-rand(5)}});
  for(let k=0;k<rand(12);k++){const id=ids[rand(ids.length)],g=goods[id];if(g.field)s[g.field].push(g.key);else s[id]=(s[id]||0)+1+rand(30)}
  if(rand(2)&&s.weaponsOwned.length)s.equippedWeapon=s.weaponsOwned[0];
  const one=structuredClone(s),before=totals(s);
  const r=depositInventory(s);
  for(const id of inventoryEntries(one)){const room=BANK_STACK_LIMIT-(one.bank[goods[id].noteOf||id]||0),n=quantity(one,id)-(goods[id].field&&one.equippedWeapon===goods[id].key?1:0);const take=Math.min(n,room);if(take>0)bankTransfer(one,id,'deposit',false,false,take)}
  assert.deepEqual(totals(s),before);
  for(const id of Object.keys(goods))assert.equal(quantity(s,id),quantity(one,id),id);
  assert.equal(inventoryUsed(s),Object.entries(r.kept).reduce((t,[id,n])=>t+(goods[id].stackable?1:n),0));
 }
});

test('the backpack slot order becomes all empty after a full deposit',()=>{
 const s=character({wood:3,bait:9,armorOwned:['bronzeArmet']});
 const prev=['bait','wood',null,'wood','armor:bronzeArmet','wood'];
 depositInventory(s);
 assert.deepEqual(arrangeInventory([],prev,{size:INVENTORY_SLOTS}).order,Array(INVENTORY_SLOTS).fill(null));
});

// --- Server SQL (db/bank-deposit-all.sql), checked against the live body it patches. ---
const sql=read('db/bank-deposit-all.sql');
const live=read('tests/fixtures/realm-request-before-quests.sql');
// The PostgreSQL literals inside the patch_function array, evaluated: $tag$...$tag$, '...' and E'...'.
function literal(src){
 const out=[];const re=/\$(\w*)\$([\s\S]*?)\$\1\$|E'((?:\\.|[^'\\])*)'|'((?:''|[^'])*)'/y;let i=0;
 while(i<src.length){
  if(/[\s|]/.test(src[i])){i++;continue}
  re.lastIndex=i;const m=re.exec(src);if(!m)throw Error('unexpected SQL near '+src.slice(i,i+40));
  out.push(m[2]!==undefined?m[2]:m[3]!==undefined?m[3].replace(/\\n/g,'\n').replace(/\\(.)/g,'$1'):m[4].replace(/''/g,"'"));i=re.lastIndex;
 }return out.join('');
}
function edits(){
 const body=sql.slice(sql.indexOf('::regprocedure,array[',sql.indexOf('perform eldervale_private.patch_function'))+'::regprocedure,array['.length,sql.lastIndexOf(']);'));
 // Split the array on top-level commas (outside quotes).
 const parts=[];let depth='',start=0;
 for(let i=0;i<body.length;i++){
  if(!depth){const d=body.slice(i).match(/^\$\w*\$/);if(d){depth=d[0];i+=d[0].length-1;continue}if(body.startsWith("E'",i)){depth="'";i++;continue}if(body[i]==="'"){depth="'";continue}if(body[i]===','){parts.push(body.slice(start,i));start=i+1}}
  else if(depth==="'"){if(body[i]==='\\'){i++;continue}if(body[i]==="'"){if(body[i+1]==="'"){i++;continue}depth=''}}
  else if(body.startsWith(depth,i)){i+=depth.length-1;depth=''}
 }
 parts.push(body.slice(start));return parts.map(p=>literal(p.trim()));
}

test('bank-deposit-all.sql is safe to re-run and never deletes, alters or drops',()=>{
 assert.doesNotMatch(sql,/\b(delete|alter|drop)/i);
 assert.match(sql,/create or replace function eldervale_private\.bank_deposit_all\(uid uuid\)/);
 assert.match(sql,/if position\('bank_deposit_all' in pg_get_functiondef\('eldervale_private\.realm_request_before_quests\(uuid,text,jsonb,uuid,bigint\)'::regprocedure\)\)=0 then\s+perform eldervale_private\.patch_function/,'the live edit is skipped once applied');
 assert.match(sql,/Dry run/i);
 assert.doesNotMatch(sql,/'\s*\n\s*E'/,'adjacent E\'\' literals are joined with ||');
 assert.match(sql,/revoke all on function eldervale_private\.bank_deposit_all\(uuid\) from public,anon,authenticated/);
});

test('each patch anchor matches the live bank command exactly once and the result is well formed',()=>{
 const e=edits();assert.equal(e.length,4);
 let def=live;
 for(let i=0;i<e.length;i+=2){assert.equal(def.split(e[i]).length-1,1,'anchor '+(i/2+1));def=def.replace(e[i],()=>e[i+1])}
 assert.match(def,/\n if payload->>'direction'='deposit_all' then perform eldervale_private\.bank_deposit_all\(auth\.uid\(\)\);\n else\n item:=payload->>'item';/);
 assert.match(def,/else raise exception 'Choose deposit or withdraw';end if;\n end if;\n if eldervale_private\.inventory_used/);
 // Every block still closes: the bank command keeps one top-level if/else around the item path.
 const opens=(def.match(/\bif\b(?![^;]*\bend if)/g)||[]).length;assert.ok(opens>0);
 assert.equal((def.match(/\bend if;/g)||[]).length-(live.match(/\bend if;/g)||[]).length,1);
 // The session, distance, replay and skilling checks still run before the new branch.
 for(const guard of ['Invalid bank request','realm_requests r where','Return to a bank or banker','skill_jobs'])assert.ok(def.includes(guard),guard);
 assert.ok(def.indexOf('Return to a bank or banker')<def.indexOf('bank_deposit_all'));
});

test('the bank shows a carved "Deposit inventory" button with an icon, tooltip and 40px target',()=>{
 const ui=read('bank-ui.js'),css=read('bank.css');
 assert.match(ui,/data-bank-deposit-all aria-label="Deposit inventory" title="Deposit inventory&#10;[^"]+"/);
 assert.match(ui,/bank-carved-icon/);
 assert.match(ui,/onDepositAll\(\)/);
 assert.match(read('economy.js'),/onDepositAll:\(\)=>invoke\(\(\)=>depositInventory\(state\)\.error,'bank',\{direction:'deposit_all'\}\)/);
 assert.match(css,/#service-panel\.bank-mode \.bank-action-bar \.bank-carved\{[^}]*min-height:40px/);
});
