// Behavioural check of db/perf-tick-fix.sql on PGlite (real Postgres in WASM).
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node scripts/perf-tick-db/check.mjs
// (or set PGLITE=/path/to/node_modules/@electric-sql/pglite/dist/index.js)
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE||'@electric-sql/pglite');
const repo=new URL('../..',import.meta.url).pathname;
const db=new PGlite();
const run=async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message);throw e}};
const one=async(sql,params=[])=>(await db.query(sql,params)).rows[0];
const all=async(sql,params=[])=>(await db.query(sql,params)).rows;
await run(readFileSync(new URL('./fixture.sql',import.meta.url),'utf8'),'fixture');
const migration=readFileSync(repo+'db/perf-tick-fix.sql','utf8');
for(const word of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+word+'\\b','i').test(migration),'migration avoids '+word);

// A small world: objects of every collision layer, castle wall, water, a town.
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const templates=['tent','fence','hay_bale','market','fountain','barrel','furnace','anvil','workbench','tree','rock'];
const objects=[];for(let i=0;i<900;i++){const t=templates[i%templates.length];objects.push({id:'o'+i,kind:t==='tree'||t==='rock'?t:'prop',x:(rnd()-.5)*400,z:(rnd()-.5)*400,data:{template:t,yaw:rnd()*360,scale:.7+rnd()}})}
for(let i=0;i<40;i++)objects.push({id:'door'+i,kind:'door',x:(rnd()-.5)*400,z:(rnd()-.5)*400,data:{yaw:rnd()*6}});
await db.query(`insert into eldervale_private.realm_objects(id,kind,x,z,data) select o->>'id',o->>'kind',(o->>'x')::float8,(o->>'z')::float8,o->'data' from jsonb_array_elements($1::jsonb) o`,[JSON.stringify(objects)]);
await run(`insert into eldervale_private.entities(data) values('{"template":"castle_wall","x":10,"z":10,"yaw":30,"length":24}'),('{"template":"castle_tower","x":-40,"z":25}'),('{"template":"cottage","x":0,"z":0}');
 insert into eldervale_private.realm_water(passable,outline) values(false,'((50,50),(80,50),(80,90),(50,90))');
 insert into eldervale_private.town_zones values('capital',-100,-100,60,false),('camp',120,-120,25,true)`,'world');
const samples=[];for(let i=0;i<1500;i++){const x=(rnd()-.5)*380,z=(rnd()-.5)*380,a=rnd()*6.283;samples.push([x,z,x+Math.cos(a)*1.4,z+Math.sin(a)*1.4])}
const steps=async()=>(await one(`select array_agg(eldervale_private.can_step((s->>0)::float8,(s->>1)::float8,(s->>2)::float8,(s->>3)::float8) order by o) r from jsonb_array_elements($1::jsonb) with ordinality e(s,o)`,[JSON.stringify(samples)])).r;
const towns=async()=>(await one(`select array_agg(coalesce(eldervale_private.town_at((s->>0)::float8,(s->>1)::float8),'-') order by o) r from jsonb_array_elements($1::jsonb) with ordinality e(s,o)`,[JSON.stringify(samples)])).r;
const beforeSteps=await steps(),beforeTowns=await towns();
assert.ok(beforeSteps.includes(false)&&beforeSteps.includes(true),'samples cover blocked and free steps');

for(let pass=1;pass<=2;pass++)await run(migration,'migration pass '+pass);
const defs=await all(`select p.proname,pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eldervale_private'`);
const def=name=>defs.find(r=>r.proname===name).d,count=(s,sub)=>s.split(sub).length-1;
assert.equal(count(def('can_step'),'x>bx-18 and x<bx+18'),1,'can_step bounded once (second pass skipped)');
assert.equal(count(def('can_step_before_castle'),'x>bx-25'),1);assert.equal(count(def('can_step_before_professions'),'x>bx-15'),1);
assert.equal(count(def('can_step_before_stories'),'x>bx-10'),1);assert.equal(count(def('can_step_before_props'),'(data->>\'x\')::float8>bx-80'),1);
assert.match(def('town_at'),/LANGUAGE plpgsql/);
assert.equal(count(def('world_tick'),'near_player'),4);assert.equal(count(def('guard_tick'),'near_player'),4);
assert.equal(count(def('realm_request'),'pg_advisory_xact_lock(736211)'),1);
assert.ok((await one(`select count(*)::int n from pg_indexes where indexname='entities_castle_parts'`)).n===1,'castle parts index');
console.log('ok migration applies twice; the second pass changes nothing');

assert.deepEqual(await steps(),beforeSteps,'can_step answers are unchanged');
assert.deepEqual(await towns(),beforeTowns,'town_at answers are unchanged');
console.log('ok collision and town lookups give identical answers ('+samples.length+' samples)');

// Only actors near an online player (or fighting / dead) are simulated.
const P='22222222-2222-4222-8222-222222222222',OLD='33333333-3333-4333-8333-333333333333';
await run(`insert into eldervale_private.realm_actors(id,data,x,z,hp,target,respawn_at) values
 ('near','{"hostile":true}',-100,-95,10,null,null),('far','{"hostile":true}',300,300,10,null,null),
 ('fighting','{}',400,400,10,'${P}',null),('dead','{}',-400,400,0,null,now()),('frozen','{"frozen":true}',-100,-100,10,null,null),
 ('stale','{}',200,200,10,null,null);
 insert into eldervale_private.realm_players(user_id,x,z,last_seen) values('${P}',-110,-100,now()),('${OLD}',205,205,now()-interval '1 minute')`,'actors');
const tick=async()=>{await run(`truncate eldervale_private.test_log;select eldervale_private.world_tick()`,'tick');return all(`select kind,id from eldervale_private.test_log order by n`)};
let log=await tick();
assert.deepEqual(log.filter(r=>r.kind==='actor').map(r=>r.id),['dead','fighting','near'],'far, frozen and stale-player actors idle');
assert.deepEqual(log.filter(r=>r.kind==='guard_match').map(r=>r.id),['near'],'guards only hunt town monsters near players');
await run(`update eldervale_private.realm_players set last_seen=now()-interval '1 minute'`,'everyone leaves');
log=await tick();
assert.deepEqual(log.map(r=>r.id),['dead','fighting'],'nobody online: no guard work, only fights and respawns');
console.log('ok world_tick simulates only actors near players; guard_tick only while players are online');

const r=await one(`select eldervale_private.realm_request(gen_random_uuid()) r`);
assert.ok(r.r.locks>=1,'player commands take the world lock before anything else');
console.log('ok realm_request takes advisory lock 736211 first');
