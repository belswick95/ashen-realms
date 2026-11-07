// Behavioural check of db/monster-roster.sql on PGlite (real Postgres in WASM), applied after
// db/osrs-equipment-combat.sql as on the live database.
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node --import ./tests/helpers/preload.js scripts/monster-roster-db/check.mjs
// (or set PGLITE=/path/to/node_modules/@electric-sql/pglite/dist/index.js)
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {monsterStats} from '../../gear-tiers.js';
import {rosterBeasts,BONES} from '../../monster-roster.js';
import {monsterSpawns} from '../../monster-spawns.js';
import {goods} from '../../economy.js?v=release-20261107-heading144';
const {PGlite}=await import(process.env.PGLITE||'@electric-sql/pglite');
const repo=new URL('../..',import.meta.url).pathname;
const db=new PGlite();
const run=async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message);throw e}};
const one=async(sql,params=[])=>(await db.query(sql,params)).rows[0];
const all=async(sql,params=[])=>(await db.query(sql,params)).rows;
await run(readFileSync(repo+'scripts/equipment-combat-db/fixture.sql','utf8'),'equipment fixture');
await run(readFileSync(repo+'db/osrs-equipment-combat.sql','utf8'),'equipment migration');
await run(readFileSync(new URL('./fixture.sql',import.meta.url),'utf8'),'roster fixture');
const migration=readFileSync(repo+'db/monster-roster.sql','utf8');
for(const word of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+word+'\\b','i').test(migration),'migration avoids '+word);

// Without the base catalog the migration refuses (and changes nothing: one transaction).
await assert.rejects(()=>db.exec(migration),/loot items missing from the catalog.*rawMeat/s);
await run('rollback','rollback after refusal');
assert.equal((await one(`select count(*)::int n from eldervale_private.entities where data->>'blueprint'='monster-roster-v1'`)).n,0);
console.log('ok refuses to run before the loot items exist');

// Live-like catalog and monsters.
const base=Object.entries(goods).filter(([id,g])=>!g.noteOf&&!BONES[id]).map(([id,g])=>['item:'+id,{name:g.name,buy:g.buy,sell:g.sell,...(g.field?{field:g.field,key:g.key}:{})}]);
await db.query(`insert into eldervale_private.realm_catalog(id,data) select r->>0,r->1 from jsonb_array_elements($1::jsonb) r on conflict do nothing`,[JSON.stringify(base)]);
const WOLF='11111111-0000-4000-8000-000000000001',WYRM='11111111-0000-4000-8000-000000000002',TROLL='11111111-0000-4000-8000-000000000003',DUMMY='11111111-0000-4000-8000-000000000004',OLD='b0e5a000-0000-4000-8000-000000009999',GONE='b0e5a000-0000-4000-8000-000000000001';
const eightRows=Array.from({length:8},(_,i)=>({item:'coal',min:1,max:1+i,chance:.5}));
await db.query(`insert into eldervale_private.entities(id,revision,data) values
 ($1,1,'{"kind":"monster","name":"Grey wolf","species":"wolf","template":"wolf","level":7,"hp":38,"damage":5,"x":10,"z":10}'),
 ($2,1,$5),
 ($3,1,'{"kind":"monster","name":"Cave troll","species":"troll","template":"troll","level":34,"hp":300,"damage":22,"x":20,"z":10,"loot":[{"item":"coal","min":2,"max":5,"chance":0.6}]}'),
 ($4,1,'{"kind":"monster","name":"Training dummy","species":"dummy","template":"training_dummy","level":1,"hp":5000,"damage":0,"x":30,"z":10}'),
 ($6,1,'{"kind":"monster","name":"Old roster rat","template":"rat","blueprint":"monster-roster-v1","blueprintKey":"9999","x":40,"z":10}')`,[WOLF,WYRM,TROLL,DUMMY,JSON.stringify({kind:'monster',name:'Elder wyrm',species:'dragon',template:'dragon',level:100,hp:3000,damage:55,x:0,z:0,loot:eightRows}),OLD]);
// The owner already removed one roster spawn (an earlier run): it must stay removed.
await db.query(`insert into eldervale_private.entities(id,revision,data,deleted) values($1,1,'{"kind":"monster","name":"removed","blueprint":"monster-roster-v1","blueprintKey":"1"}',true)`,[GONE]);
await db.query(`insert into eldervale_private.realm_objects(id,kind,x,z,data) values('altar1','altar',100,100,'{"template":"altar"}')`);

for(let pass=1;pass<=2;pass++)await run(migration,'migration pass '+pass);
const rev=(await one(`select revision from eldervale_private.settings`)).revision;await run(migration,'pass 3');
assert.equal((await one(`select revision from eldervale_private.settings`)).revision,rev,'re-running changes nothing');
console.log('ok migration applies three times; the third is a no-op');

const live=await all(`select e.id,e.data,e.deleted,a.data actor from eldervale_private.entities e left join eldervale_private.realm_actors a on a.id=e.id::text where e.data->>'blueprint'='monster-roster-v1'`);
const active=live.filter(r=>!r.deleted);
assert.equal(active.length,monsterSpawns.length-1,'every spawn but the owner-removed one');
assert.ok(live.find(r=>r.id===GONE).deleted,'owner removal kept');assert.ok(live.find(r=>r.id===OLD).deleted,'retired roster row marked deleted');
assert.equal(new Set(active.map(r=>r.data.rosterKey)).size,Object.keys(rosterBeasts).length,'every roster type is placed');
for(const r of active){const b=rosterBeasts[r.data.rosterKey];assert.equal(r.actor.level,b.level,r.data.name+' level (bosses above 100 too)');for(const k of ['attackLevel','strengthLevel','defenceLevel'])assert.equal(r.actor[k],b[k],r.data.name+' '+k);
 const sqlStats=(await one(`select eldervale_private.monster_stats($1) s`,[r.actor])).s,js=monsterStats(r.actor);for(const k of ['attackLevel','strengthLevel','defenceLevel','magicLevel','attackBonus','maxHit','attackStyle'])assert.equal(sqlStats[k],js[k],r.data.name+' '+k);assert.deepEqual(sqlStats.defence,js.defence);assert.equal(sqlStats.maxHit,b.maxHit)}
const colossus=active.find(r=>r.data.rosterKey==='ashen_colossus');assert.equal(colossus.actor.level,120);
const wolf=(await one(`select data from eldervale_private.realm_actors where id=$1`,[WOLF])).data;assert.equal(wolf.attackLevel,7,'monsters without their own levels still use their level');
console.log('ok '+active.length+' roster monsters live with their own stat blocks (server monster_stats = client)');

const loot=id=>one(`select data->'loot' l from eldervale_private.entities where id=$1`,[id]).then(r=>r.l);
assert.deepEqual((await loot(WOLF)),[{item:'bones',min:1,max:1,chance:1,always:true}]);
assert.equal((await loot(TROLL))[0].item,'heftyBones');assert.equal((await loot(TROLL)).length,2);
assert.equal((await loot(WYRM)).length,8);assert.ok(!(await loot(WYRM)).some(r=>r.item==='wyrmBones'),'a full table is left alone');
assert.equal(await loot(DUMMY),null,'training dummies drop nothing');
for(const id of Object.keys(BONES))assert.equal((await one(`select data->>'prayerXP' x from eldervale_private.realm_catalog where id=$1`,['item:'+id])).x,String(BONES[id].xp));
console.log('ok existing monsters gain bones; bones catalog rows carry Prayer XP');

// Bury and offer at an altar.
const ME='22222222-2222-4222-8222-222222222222',SESSION='33333333-3333-4333-8333-333333333333';
await run(`select set_config('test.uid','${ME}',false)`,'uid');
await run(`insert into public.player_saves(user_id,stats,skills) values('${ME}','{"bones":3,"wyrmBones":1,"coal":2}','{}');update eldervale_private.realm_players set session_id='${SESSION}',x=0,z=0 where user_id='${ME}';insert into eldervale_private.realm_players(user_id,session_id,attack_style) select '${ME}','${SESSION}','slash' where not exists(select 1 from eldervale_private.realm_players where user_id='${ME}')`,'player');
const bury=(item,rid=crypto.randomUUID())=>one(`select eldervale_private.realm_request_services($1,'bury',$2,$3,0) r`,[SESSION,{item},rid]).then(r=>r.r);
const save=()=>one(`select stats,skills from public.player_saves where user_id=$1`,[ME]);
const rid=crypto.randomUUID();let r=await bury('bones',rid);assert.equal(r.synced,true);
let s=await save();assert.equal(s.stats.bones,2);assert.equal(Number(s.skills.prayerXP),4.5);
await bury('bones',rid);assert.equal((await save()).stats.bones,2,'a repeated request is not applied twice');
await assert.rejects(()=>bury('bones'),/already busy/);
await run(`update eldervale_private.realm_players set consume_at=now()-interval '5 seconds',x=101,z=101`,'ready at the altar');
await bury('wyrmBones');s=await save();assert.equal(s.stats.wyrmBones,0);assert.equal(Number(s.skills.prayerXP),4.5+144,'altar offering doubles');
await run(`update eldervale_private.realm_players set consume_at=now()-interval '5 seconds'`,'ready');
await assert.rejects(()=>bury('wyrmBones'),/You have no wyrm bones to bury/);
await assert.rejects(()=>bury('coal'),/You cannot bury that/);
const notes=(await all(`select data->>'text' t from eldervale_private.events where data->>'type'='notice'`)).map(x=>x.t);
assert.ok(notes.includes('You bury the bones. +4.5 Prayer XP.'));assert.ok(notes.includes('You offer the wyrm bones at the altar. +144 Prayer XP.'));
r=(await one(`select eldervale_private.realm_request_services($1,'sync','{}',null,0) r`,[SESSION])).r;assert.equal(r.synced,true,'other commands pass through');
console.log('ok bury: Prayer XP, altar x2, one bone per request, busy delay, refusals');
console.log('ALL PASS');
