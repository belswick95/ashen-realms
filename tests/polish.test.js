// Polish pass: potion shops (db/polish-1-potion-shops.sql), the boss log tab (boss-journal.js) and
// the Grand Market stall footprint (navigation-obstacles.js + db/polish-2-market-stalls.sql).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';
import {bossJournalRows,bossJournalSummary,drawBossJournal,lairLabel,bestTime} from '../boss-journal.js';
import {BOSSES} from '../bosses.js';
import {obstacleBlocks,createObstacleIndex} from '../navigation-obstacles.js';
import {townProp} from '../town-props.js';
import {marketStalls,marketSquare,STALL_RING,capitalBlueprint} from '../capital-layout.js';
import {professionItems} from '../profession-data.js';
import {POTIONS} from '../mechanics.js';
import {UNIQUE_ITEMS,UNIQUE_MATERIALS} from '../unique-gear.js';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const potionSql=read('db/polish-1-potion-shops.sql'),stallSql=read('db/polish-2-market-stalls.sql');

// ---------------------------------------------------------------- potion shops
const seeded=[...potionSql.matchAll(/\('potion-shop:([a-z-]+)','([0-9a-f-]{36})',\s*'(\{[^']+\})'::jsonb\)/g)].map(m=>({key:m[1],merchant:m[2],items:JSON.parse(m[3])}));
test('potion shops: the capital apothecary and two towns stock every potion, the Breathward tonic included',()=>{
 assert.deepEqual(seeded.map(s=>s.key),['capital-apothecary','winterwatch-provisioner','emberspire-provisioner']);
 const capital=seeded[0].items;
 for(const id of Object.keys(POTIONS))assert.ok(id in capital,'capital stocks '+id);
 assert.ok('healingPotion' in capital&&'breathwardTonic' in capital);
 const known=new Set([...Object.keys(professionItems),...UNIQUE_MATERIALS.map(m=>m.id)]);
 for(const s of seeded)for(const [id,stock] of Object.entries(s.items)){
  assert.ok(known.has(id),id+' is a catalog item');
  assert.ok(Number.isInteger(stock)&&(stock===-1||stock>=10),'stock -1 (unlimited) or a baseline of at least 10 (the shop_stock floor): '+id);
 }
 // Sorrel is the capital apothecary.
 assert.ok(read('capital-layout.js').includes("apothecary:{npc:'Sorrel the Apothecary'"));
});
test('potion shops: OSRS-like tiers, cheap remedies unlimited, dear brews finite and restocking',()=>{
 const price=id=>POTIONS[id]?.buy??professionItems[id]?.buy;
 const tiers=['healingPotion','briskTonic','antidote','shrineDraught','windstepBrew','serpentbaneTonic','breathwardTonic'].map(price);
 assert.deepEqual([...tiers].sort((a,b)=>a-b),tiers,'prices climb from everyday remedies to the dragon tonic');
 assert.ok(tiers[0]<=40&&tiers[2]<=40&&tiers[6]>=2000);
 for(const s of seeded)for(const [id,stock] of Object.entries(s.items))assert.equal(stock===-1,price(id)<=40,id+' at '+s.key);
 assert.match(potionSql,/create or replace function eldervale_private\.shop_restock\(\)/);
 assert.match(potionSql,/s\.stock<s\.target_stock/,'restock only fills toward the baseline');
 assert.match(potionSql,/cron\.schedule\('eldervale_shop_restock'/);
});
test('potion shops: unique items stay shopless and owner edits survive a re-run',()=>{
 const uniques=new Set(UNIQUE_ITEMS.flatMap(u=>[u.id,u.catalogId]));
 for(const s of seeded)for(const id of Object.keys(s.items))assert.ok(!uniques.has(id),id+' is not unique gear');
 assert.match(potionSql,/not coalesce\(\(c\.data->>'shopless'\)::boolean,false\)/,'the catalog shopless flag is respected');
 assert.match(potionSql,/if exists\(select 1 from eldervale_private\.polish_seeds where key=spec\.key\) then continue/,'each merchant is seeded once');
 assert.match(potionSql,/not merged\?i\.key/,'existing rows are never overwritten');
 assert.match(potionSql,/jsonb_build_object\('shop',merged\)/,'stock lives in entities.data.shop, which the console NPC editor edits');
});

// ---------------------------------------------------------------- SQL hygiene
test('polish SQL files follow the repo rules',()=>{
 for(const f of fs.readdirSync(new URL('../db/',import.meta.url)).filter(f=>f.startsWith('polish-'))){
  const sql=read('db/'+f);
  for(const w of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+w+'\\b','i').test(sql),f+' avoids '+w);
 }
});

// ---------------------------------------------------------------- boss log
const reply={bosses:[
 {id:'grimtusk',name:'Grimtusk the Unbroken',level:102,lair:'bloodtusk_warhall',kills:12,best:250},
 {id:'hollow_king',name:'The Hollow King',level:105,lair:'hollowmere_undercroft',kills:0,best:null},
 {id:'ashen_colossus',name:'The Ashen Colossus',level:120,lair:'cindervault_depths',kills:1,best:null},
 {id:'twinflame_wyrm',name:'Vaelith, the Twinflame',level:128,lair:'wyrmhold',kills:1234,best:101}]};
test('boss log rows: name, lair, kill count and personal best; unfought bosses read "Not yet slain"',()=>{
 const rows=bossJournalRows(reply);
 assert.equal(rows.length,4);
 assert.deepEqual(rows[0],{id:'grimtusk',name:'Grimtusk the Unbroken',level:102,lair:'Bloodtusk Warhall · Warlord’s hall',kills:12,best:'2:30.0',slain:true});
 assert.equal(rows[1].lair,'Hollowmere Undercroft · Hollow Throne');assert.equal(rows[1].slain,false);assert.equal(rows[1].best,null);
 assert.equal(rows[2].lair,'Cindervault Depths · The Crucible');assert.equal(rows[2].best,null,'a kill without a timed fight has no best');
 assert.equal(rows[3].best,'1:00.6');
 for(const b of BOSSES)assert.ok(!/unknown|_/i.test(lairLabel(b.id,b.lair.area)),b.id+': '+lairLabel(b.id,b.lair.area));
 assert.equal(bestTime(0),null);assert.equal(bossJournalSummary(rows),'3 of 4 bosses slain · 1,247 kills');
 assert.deepEqual(bossJournalRows(null),[]);assert.deepEqual(bossJournalRows({bosses:[{id:'x',kills:'3'}]})[0].kills,3);
});
class Node{constructor(tag){this.tag=tag;this.children=[];this.attrs={};this.textContent=''}append(...n){this.children.push(...n)}setAttribute(k,v){this.attrs[k]=v}get text(){return this.textContent+this.children.map(c=>c.text).join(' ')}}
const el=(tag,text,attrs={})=>{const n=new Node(tag);if(text!=null)n.textContent=text;for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n};
test('boss log tab draws every boss with its stats, and loading / offline states',()=>{
 const body=el('section');drawBossJournal(body,el,reply);
 const list=body.children.find(c=>c.tag==='ul');assert.equal(list.children.length,4);
 assert.match(list.children[0].text,/Grimtusk the Unbroken.*Bloodtusk Warhall.*Kills 12 Best 2:30\.0/);
 assert.match(list.children[1].text,/The Hollow King.*Not yet slain/);assert.equal(list.children[1].attrs.class,'boss-log-row unslain');
 const loading=el('section');drawBossJournal(loading,el,undefined);assert.match(loading.text,/Loading/);
 const offline=el('section');drawBossJournal(offline,el,null);assert.match(offline.text,/could not be loaded/);
});
test('the journal has a Bosses tab fed by public.boss_journal(), styled for phones',()=>{
 const ex=read('explore.js'),wc=read('world-client.js'),css=read('explore.css');
 assert.match(ex,/\['bosses','Bosses'\]/);assert.match(ex,/drawBossJournal\(body,el,bosses\)/);
 assert.match(wc,/eldervaleBossJournal=\(\)=>db\.rpc\('boss_journal'\)/);
 assert.match(css,/\.boss-log-row\{display:grid/);assert.match(css,/@media\(max-width:420px\)\{\.boss-log-row\{grid-template-columns:1fr\}/);
 assert.match(read('boss-journal.js'),/\?v=release-20261106-osrswalk124/);
});

// ---------------------------------------------------------------- market stall footprint
// The stall's solid parts at walking height (below the awning), in the stall's own frame.
function stallBody(){const g=townProp(T,new T.Group(),'market',{x:0,z:0});const box=new T.Box3();g.updateMatrixWorld(true);
 g.traverse(o=>{if(!o.isMesh)return;const b=new T.Box3().setFromObject(o);if(b.min.y<1.9)box.union(b)});return box}
test('market stall collision is the visible posts and counter, not the awning overhead',()=>{
 const body=stallBody(),stall={template:'market',x:0,z:0,yaw:0};
 assert.ok(Math.abs(body.max.x-1.2)<.02&&Math.abs(-body.min.x-1.2)<.02,'body half-width 1.2: '+body.max.x);
 assert.ok(Math.abs(-body.min.z-.75)<.02&&body.max.z<=.75,'body half-depth .75: '+body.min.z+'..'+body.max.z);
 // Player centre: blocked within the body plus the 0.2 body margin, free beyond it.
 for(const [x,z,hit] of [[0,0,true],[1.15,.7,true],[1.35,0,true],[1.45,0,false],[0,.9,true],[0,1.0,false],[0,-1.0,false],[1.5,1.0,false]])
  assert.equal(obstacleBlocks(stall,x,z),hit,`${x},${z}`);
});
test('the server footprint (can_step and the tile grid) matches the client after polish-2',()=>{
 assert.match(stallSql,/'when ''market'' then 1\.2 when ''bench'' then 1\.15'/);assert.match(stallSql,/'when ''market'' then \.75 when ''bench'' then \.5'/);
 // tile_shapes adds 0.2 to every prop: 1.0 / .55 → exactly the 1.2 × .75 body.
 assert.match(stallSql,/'when ''market'' then 1\.0 when ''bench'' then 1\.15'/);assert.match(stallSql,/'when ''market'' then \.55 when ''bench'' then \.5'/);
 assert.match(stallSql,/tile_refresh\(\)/);
});
test('every Grand Market stall blocks its own body and leaves the space around it walkable',()=>{
 const rows=capitalBlueprint().filter(r=>r.template==='market'&&String(r.blueprintKey).startsWith('stall-'));assert.equal(rows.length,marketStalls.length);
 const index=createObstacleIndex(rows);
 for(const r of rows){const a=r.yaw*Math.PI/180,at=(lx,lz)=>({x:r.x+lx*Math.cos(a)+lz*Math.sin(a),z:r.z-lx*Math.sin(a)+lz*Math.cos(a)});
  for(const [lx,lz] of [[0,0],[1.15,.7],[-1.15,-.7],[1.15,-.7],[-1.15,.7]]){const p=at(lx,lz);assert.ok(index.blocked(p.x,p.z),r.blueprintKey+' post/counter at '+lx+','+lz)}
  for(const [lx,lz] of [[1.5,0],[-1.5,0],[0,1.05],[0,-1.05]]){const p=at(lx,lz);assert.ok(!index.blocked(p.x,p.z),r.blueprintKey+' open ground at '+lx+','+lz)}
  assert.ok(Math.abs(Math.hypot(r.x-marketSquare.x,r.z-marketSquare.z)-STALL_RING)<.05);
 }
});
