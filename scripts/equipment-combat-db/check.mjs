// Behavioural check of db/osrs-equipment-combat.sql on PGlite (real Postgres in WASM).
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node scripts/equipment-combat-db/check.mjs
// (or set PGLITE=/path/to/node_modules/@electric-sql/pglite/dist/index.js)
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {monsterStats,playerAttackProfile,hitChance,defenceRoll,maxHit,HIT_SCALE} from '../../gear-tiers.js';
import {equipmentBonuses,playerLevels} from '../../melee-stats.js';
import {weaponCatalog} from '../../weapons.js';
import {XP_TABLE} from '../../combat-level.js';
const {PGlite}=await import(process.env.PGLITE||'@electric-sql/pglite');
const repo=new URL('../..',import.meta.url).pathname;
const db=new PGlite();
const run=async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message);throw e}};
const one=async(sql,params=[])=>(await db.query(sql,params)).rows[0];
await run(readFileSync(new URL('./fixture.sql',import.meta.url),'utf8'),'fixture');
// Live-like rows: merchants, a quartermaster whose stock lives only in shop_stock, monsters.
const ELSA='36b9aa48-81f4-44bf-b934-dbc4ec8f1a08';
await run(`insert into eldervale_private.entities(id,revision,data) values
 (gen_random_uuid(),1,'{"kind":"npc","name":"Edric Edgewright","blueprint":"birchford-capital-v1","shop":{"weapon:dagger":{"buy":20,"sell":12,"stock":-1}}}'),
 (gen_random_uuid(),1,'{"kind":"npc","name":"Hollin the Armourer","blueprint":"birchford-capital-v1","shop":{}}'),
 (gen_random_uuid(),1,'{"kind":"npc","name":"Wren Fletcher","blueprint":"birchford-capital-v1","shop":{}}'),
 (gen_random_uuid(),1,'{"kind":"npc","name":"Magister Oriel","blueprint":"birchford-capital-v1","shop":{}}'),
 ('${ELSA}',1,'{"kind":"npc","name":"Elsa the Quartermaster","shop":{"arrows":{"buy":7,"sell":2,"stock":-1}}}'),
 (gen_random_uuid(),1,'{"kind":"monster","name":"Elder wyrm","level":100,"loot":[{"item":"runiteBar","min":3,"max":6,"chance":0.7},{"item":"weapon:claymore","min":1,"max":1,"chance":0.1},{"item":"weapon:bloodthornBow","min":1,"max":1,"chance":0.08},{"item":"x1","min":1,"max":1,"chance":1},{"item":"x2","min":1,"max":1,"chance":1},{"item":"x3","min":1,"max":1,"chance":1}]}'),
 (gen_random_uuid(),1,'{"kind":"monster","name":"Goblin scout","level":6,"loot":[]}')`,'entities');
await run(`insert into eldervale_private.shop_stock(merchant,item,buy,sell,stock) values('${ELSA}','weapon:goldenSword',240,72,-1),('${ELSA}','weapon:claymore',300,90,-1)`,'direct stock');
const migration=readFileSync(repo+'db/osrs-equipment-combat.sql','utf8');
for(const word of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+word+'\\b','i').test(migration),'migration avoids '+word);
for(let pass=1;pass<=2;pass++)await run(migration,'migration pass '+pass);
console.log('ok migration applies twice (idempotent patches and upserts)');

// Catalog
const sword=(await one(`select data from eldervale_private.realm_catalog where id='weapon:moonsilverScimitar'`)).data;
assert.deepEqual(sword.req,{attack:20});assert.equal(sword.bonuses.aslash,weaponCatalog.moonsilverScimitar.bonuses.aslash);assert.equal(sword.ticks,4);
assert.equal((await one(`select data->>'name' n from eldervale_private.realm_catalog where id='item:mithrilBar'`)).n,'Moonsilver bar');
assert.equal((await one(`select data->>'name' n from eldervale_private.skill_recipes where id='smelt_mithrilBar'`)),undefined,'rename only touches recipes that exist');
assert.ok((await one(`select count(*)::int n from eldervale_private.skill_recipes where id like 'smith_%'`)).n>90);
console.log('ok catalog rows carry bonuses, requirements and tick speeds; tier names');

// monster_stats mirrors gear-tiers.js
const monsters=[{name:'Training dummy',species:'dummy',template:'training_dummy',level:1,hp:5000,damage:0},{name:'Cellar rat',level:1,damage:1,attackType:'bite'},{name:'Goblin scout',level:6,damage:4,attackType:'slash'},{name:'Skeleton archer',level:18,damage:12,attackType:'arrow'},{name:'Orc warchief',level:40,damage:26},{name:'Ember dragon',level:75,damage:38,attackType:'fire'},{name:'Elder wyrm',level:100,damage:55,attackType:'fire'},{level:'7',damage:'5'}];
for(const m of monsters){const sqlStats=(await one(`select eldervale_private.monster_stats($1) s`,[m])).s,js=monsterStats(m);for(const k of ['attackLevel','strengthLevel','defenceLevel','magicLevel','attackBonus','strengthBonus','maxHit','attackStyle','dummy'])assert.equal(sqlStats[k],js[k],m.name+' '+k);assert.deepEqual(sqlStats.defence,js.defence)}
console.log('ok monster stat blocks match the client formulas');

// Players
const ME='11111111-1111-4111-8111-111111111111';
const xp=lvl=>XP_TABLE[lvl];
await run(`select set_config('test.uid','${ME}',false)`,'uid');
await run(`insert into public.player_saves(user_id,skills,equipment,stats,inventory) values('${ME}','{"attackXP":0,"strengthXP":0,"defenceXP":0}','{"weapon":"moonsilverScimitar","knightArmet2":true}','{}','{"weaponsOwned":["dagger","moonsilverScimitar","oakShortbow","woodenBow"],"armorOwned":["knightArmet2","eldersteelBreastplate","chest"],"shieldsOwned":["kite"]}')`,'player');
const equip=(slot,key)=>one(`select eldervale_private.realm_request_base(null,'equip',$1,null,0) r`,[{slot,key}]);
await assert.rejects(()=>equip('armor','eldersteelBreastplate').then(()=>0),/You need a Defence level of 70 to wear this\./);
await assert.rejects(()=>equip('weapon','oakShortbow'),/You need a Ranged level of 5 to wield this\./);
// grandfathered: the scimitar and gilded helm (worn above level) can be removed, and stay on otherwise
let r=(await equip('weapon','moonsilverScimitar')).r;assert.equal(r.equipment.weapon,null);
await assert.rejects(()=>equip('weapon','moonsilverScimitar'),/You need an Attack level of 20 to wield this\./);
r=(await equip('armor','knightArmet2')).r;assert.equal(r.equipment.knightArmet2,false);
r=(await equip('weapon','dagger')).r;assert.equal(r.equipment.weapon,'dagger');r=(await equip('armor','chest')).r;assert.equal(r.equipment.chest,true);
await run(`update public.player_saves set skills=skills||'{"attackXP":${xp(20)}}' where user_id='${ME}'`,'level 20');
r=(await equip('weapon','moonsilverScimitar')).r;assert.equal(r.equipment.weapon,'moonsilverScimitar');
console.log('ok equip: OSRS refusal under level, removal always allowed, equip at level');

// gear_bonuses = client equipmentBonuses
const loadout={equipment:{weapon:'moonsilverScimitar',shield:'kite',chest:true,helm:true,legs:false},stats:{}};
const sqlBonus=(await one(`select eldervale_private.gear_bonuses($1,$2) b`,[loadout.equipment,loadout.stats])).b;
const jsBonus=equipmentBonuses({equippedWeapon:'moonsilverScimitar',equippedShield:'kite',equipped:{chest:true,helm:true,legs:false}});
for(const [k,v] of Object.entries(sqlBonus))assert.equal(v,jsBonus[k],'bonus '+k);
console.log('ok equipment bonus totals match the client');

// Combat through the patched world tick
await run(`insert into eldervale_private.realm_players(user_id,attack_style) values('${ME}','slash')`,'session');
const fight=async(actor,turn,n=400)=>{await run(`truncate eldervale_private.test_log;truncate eldervale_private.realm_actors`,'reset');await db.query(`insert into eldervale_private.realm_actors(id,data,hp,target,turn) values('m',$1,100,'${ME}',$2)`,[actor,turn]);for(let i=0;i<n;i++)await run(`select eldervale_private.world_tick()`,'tick');return (await db.query(`select * from eldervale_private.test_log`)).rows};
await run(`update public.player_saves set skills='{"attackXP":0,"strengthXP":0,"defenceXP":0}',equipment='{"weapon":"dagger"}',stats='{}' where user_id='${ME}'`,'fresh');
let log=await fight({name:'Training dummy',species:'dummy',template:'training_dummy',level:1,damage:0},'player',120);
assert.ok(log.every(l=>l.damage>=1&&!l.blocked),'dummies are always hit for at least 1');
const freshMax=playerAttackProfile({levels:{},bonuses:equipmentBonuses({equippedWeapon:'dagger',equipped:{}}),weapon:weaponCatalog.dagger,style:'slash'}).maxHit;
assert.ok(Math.max(...log.map(l=>l.damage))<=freshMax);
log=await fight({name:'Training dummy',species:'dummy',level:1,damage:0},'enemy',60);assert.ok(log.every(l=>l.damage===0),'dummies never hit back');
const rat={name:'Cellar rat',level:1,damage:1,attackType:'bite'};
log=await fight(rat,'player',1500);
const prof=playerAttackProfile({levels:{},bonuses:equipmentBonuses({equippedWeapon:'dagger',equipped:{}}),weapon:weaponCatalog.dagger,style:'slash'}),ms=monsterStats(rat);
const expectHit=hitChance(prof.attackRoll,defenceRoll(ms.defenceLevel+9,ms.defence[prof.type]))*(1-1/(prof.maxHit+1));
const seen=log.filter(l=>l.damage>0).length/log.length;assert.ok(Math.abs(seen-expectHit)<.06,'hit rate '+seen+' vs '+expectHit);
assert.ok(Math.max(...log.map(l=>l.damage))<=prof.maxHit);assert.equal(prof.maxHit,maxHit(9+3,prof.type?6:0,HIT_SCALE));
console.log('ok player hits follow the OSRS hit chance ('+seen.toFixed(2)+' vs '+expectHit.toFixed(2)+') and max hit '+prof.maxHit+' vs a cellar rat');
log=await fight(rat,'enemy',800);assert.ok(Math.max(...log.map(l=>l.damage))<=ms.maxHit);assert.ok(log.some(l=>l.damage>0)&&log.some(l=>l.damage===0));
const ratAvg=log.reduce((s,l)=>s+l.damage,0)/log.length;assert.ok(ratAvg>1&&ratAvg<8,'rat average '+ratAvg);
console.log('ok monster hits use the stat block (rat max '+ms.maxHit+', average '+ratAvg.toFixed(1)+' per attack vs a fresh player with 100 health)');
// Archery: arrow tiers, caps, spending, Rapid speed
await run(`update public.player_saves set skills='{"rangedXP":${xp(5)}}',equipment='{"weapon":"oakShortbow"}',stats='{"steelArrows":3,"moonsilverArrows":9,"arrows":1}' where user_id='${ME}'`,'archer');
await run(`update eldervale_private.realm_players set attack_style='slash' where user_id='${ME}'`,'rapid');
log=await fight({name:'Goblin scout',level:6,damage:4},'player',2);
let stats=(await one(`select stats from public.player_saves where user_id='${ME}'`)).stats;
assert.deepEqual(stats,{steelArrows:1,moonsilverArrows:9,arrows:1},'oak bow fires its best allowed arrows first and never moonsilver');
assert.ok(Math.abs(log[0].period-(weaponCatalog.oakShortbow.speed-.45))<1e-9,'Rapid is one tick faster');
await run(`update public.player_saves set equipment='{"weapon":"woodenBow"}',stats='{"steelArrows":5}' where user_id='${ME}'`,'cap');
log=await fight({name:'Goblin scout',level:6,damage:4},'player',1);assert.equal(log[0].kind,'out of arrows','a wooden bow cannot fire steel arrows');
console.log('ok arrows: best usable tier, bow caps, one arrow per shot, Rapid speed');
// Magic
await run(`update public.player_saves set skills='{"magicXP":${xp(35)}}',equipment='{"weapon":"sapphireStaff"}',stats='{}' where user_id='${ME}'`,'mage');
log=await fight({name:'Training dummy',species:'dummy',level:1},'player',200);assert.ok(Math.max(...log.map(l=>l.damage))<=120&&Math.max(...log.map(l=>l.damage))>90,'fire bolt max 12 → 120');
console.log('ok magic: staff spell family and Magic level set the max hit');

// Shops and loot
const elsa=(await db.query(`select item from eldervale_private.shop_stock where merchant='${ELSA}'`)).rows.map(r=>r.item);
for(const i of ['weapon:goldenSword','weapon:claymore','arrows','armor:tidesteelBreastplate','tidesteelArrows'])assert.ok(elsa.includes(i),'quartermaster keeps and gains '+i);
const edric=(await db.query(`select s.item,s.buy from eldervale_private.shop_stock s join eldervale_private.entities e on e.id::text=s.merchant where e.data->>'name'='Edric Edgewright'`)).rows;
assert.equal(edric.find(r=>r.item==='weapon:dagger').buy,20);assert.equal(edric.find(r=>r.item==='weapon:steelScimitar').buy,weaponCatalog.steelScimitar.buy);
const wyrm=(await one(`select data->'loot' l from eldervale_private.entities where data->>'name'='Elder wyrm'`)).l;assert.equal(wyrm.length,8);assert.ok(wyrm.some(x=>x.item==='weapon:eldersteelLongsword'));
const scout=(await one(`select data->'loot' l from eldervale_private.entities where data->>'name'='Goblin scout'`)).l;assert.deepEqual(scout.map(x=>x.item),['weapon:bronzeDagger','bronzeArrows']);
const rev=(await one(`select revision from eldervale_private.settings`)).revision;await run(migration,'pass 3');assert.equal((await one(`select revision from eldervale_private.settings`)).revision,rev,'re-running changes nothing');
console.log('ok shops merged with existing stock, loot appended (max 8), re-run is a no-op');
console.log('ALL PASS');
