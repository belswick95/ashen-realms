// Behavioural check of db/weather.sql on PGlite (real Postgres in WASM), and proof that
// weather.js computes exactly the same schedule as the server.
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node scripts/weather-db/check.mjs
// (or set PGLITE=/path/to/node_modules/@electric-sql/pglite/dist/index.js)
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE||'@electric-sql/pglite');
const repo=new URL('../..',import.meta.url).pathname;
const W=await import(repo+'weather.js');
const db=new PGlite();
const run=async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message);throw e}};
const one=async(sql,params=[])=>(await db.query(sql,params)).rows[0];
const OWNER='91c5b7f0-7018-4290-a190-c2bba0ca492d',P='22222222-2222-4222-8222-222222222222';
const as=uid=>db.exec(`select set_config('test.uid','${uid}',false)`);
const admin=async(command,payload={})=>(await one(`select eldervale_private.admin_action($1,$2) r`,[command,payload])).r;
const fails=async(command,payload,re)=>assert.rejects(()=>admin(command,payload),e=>{assert.match(e.message,re);return true});
const migration=readFileSync(repo+'db/weather.sql','utf8');
assert.doesNotMatch(migration,/\b(delete|alter|drop)\b/i,'migration avoids destructive keywords');

await run(readFileSync(new URL('./fixture.sql',import.meta.url),'utf8'),'fixture');
const statuses=r=>r.flatMap(x=>x.rows||[]).map(x=>Object.values(x)[0]).filter(v=>typeof v==='string'&&/: /.test(v));
assert.deepEqual(statuses(await run(migration,'pass 1')),['eldervale_private.public_game_config(): patched','eldervale_private.admin_action(text,jsonb): patched']);
assert.deepEqual(statuses(await run(migration,'pass 2')),['eldervale_private.public_game_config(): already patched','eldervale_private.admin_action(text,jsonb): already patched']);
console.log('ok migration applies twice; patches idempotent');

// Hash and schedule vectors: SQL == JS.
for(const [seed,region,slot,salt] of [[7331,1,1500000,0],[0,5,0,1],[2147483647,3,99999999,12],[123456,4,4294967295,9],[42,2,1,11]]){
 const sql=Number((await one('select eldervale_private.weather_hash($1,$2,$3,$4) h',[seed,region,slot,salt])).h);
 assert.equal(sql,W.weatherHash(seed,region,slot,salt),'hash '+[seed,region,slot,salt]);
}
const stored=async()=>(await one(`select value from eldervale_private.game_settings where key='weather'`)).value;
async function compare(label){
 const s=await stored();
 for(let k=0;k<60;k++){const ms=Date.UTC(2026,10,6)+k*397000+(k%7)*1000;
  const sql=(await one('select eldervale_private.weather_public(to_timestamp($1/1000.0)) p',[ms])).p,js=W.publicWeather(s,ms);
  assert.deepEqual(sql,JSON.parse(JSON.stringify(js)),label+' at '+new Date(ms).toISOString())}
 const f=(await one('select eldervale_private.weather_forecast(to_timestamp($1/1000.0),8) f',[Date.UTC(2026,10,6,3)])).f;
 assert.deepEqual(f,W.weatherForecast(s,Date.UTC(2026,10,6,3),8),label+' forecast');
}
await compare('defaults');
console.log('ok SQL and weather.js agree (hash, schedule, forecast)');

// gameConfig carries the weather next to the classic look default.
const cfg=(await one('select eldervale_private.public_game_config() c')).c;
assert.equal(cfg.weather.on,true);assert.equal(cfg.classicLook,false);assert.ok('multipliers' in cfg);
assert.ok(JSON.stringify(cfg.weather).length<900,'small payload: '+JSON.stringify(cfg.weather).length);
assert.deepEqual(Object.keys(cfg.weather.regions).sort(),[...W.REGION_IDS].sort());

// Console: owner gate, validation, save, force, clear, audit.
await as(P);await fails('weather_get',{},/Owner access required/);
await as(OWNER);
const got=await admin('weather_get');assert.deepEqual(got.regions,W.REGION_IDS);assert.deepEqual(got.kinds,W.WEATHER_KINDS);assert.equal(got.forecast.fens.length,6);
assert.deepEqual(got.defaults,W.DEFAULT_WEIGHTS);
await fails('weather_save',{slotMinutes:2},/5–240/);await fails('weather_save',{seed:1.5},/whole number/);await fails('weather_save',{weights:{mordor:{rain:5}}},/Unknown weather region/);
await fails('weather_save',{weights:{fens:{rain:500}}},/0–100/);await fails('weather_save',{weights:{fens:{rain:'x'}}},/numbers/);await fails('weather_save',{bogus:1},/Unknown weather setting/);
await fails('weather_force',{kind:'tornado'},/Choose a weather kind/);await fails('weather_force',{kind:'rain',minutes:5000},/1–1440/);await fails('weather_force',{kind:'rain',intensity:3},/0.1–1/);
await admin('weather_save',{seed:99,slotMinutes:15,fadeSeconds:60,weights:{fens:{rain:90,clear:0},winterwatch:{snow:100}}});
await compare('custom weights');
const fs=await stored();assert.equal(fs.seed,99);assert.equal(fs.weights.fens.rain,90);
const forced=await admin('weather_force',{region:'fens',kind:'storm',intensity:.9,minutes:30});
assert.equal(forced.now.regions.fens.fk,'storm');assert.equal(forced.now.regions.fens.fi,.9);assert.ok(forced.now.regions.fens.fu>Date.now());assert.ok(!forced.now.regions.birchford.fk);
await compare('forced');
await admin('weather_force',{region:'all',kind:'snow',minutes:10});
let pub=(await admin('weather_get')).now;assert.ok(W.REGION_IDS.every(r=>pub.regions[r].fk==='snow'));
await admin('weather_clear',{region:'winterwatch'});pub=(await admin('weather_get')).now;assert.ok(!pub.regions.winterwatch.fk&&pub.regions.fens.fk==='snow');
await admin('weather_clear',{});pub=(await admin('weather_get')).now;assert.ok(W.REGION_IDS.every(r=>!pub.regions[r].fk));
await admin('weather_save',{enabled:false});assert.deepEqual((await one('select eldervale_private.public_game_config() c')).c.weather,{on:false});
await admin('weather_save',{enabled:true});
assert.ok(Number((await one(`select count(*) n from eldervale_private.audit where target='weather'`)).n)>=6,'every write audited');
// Other console commands still reach their handlers.
assert.deepEqual(await admin('fc_settings_get'),{fc:'fc_settings_get'});assert.deepEqual(await admin('sign_list'),{sign:'sign_list'});
// A damaged force entry never breaks the snapshot.
await run(`update eldervale_private.game_settings set value=value||'{"force":{"fens":{"kind":"rain","until":"soon"}},"seed":"x"}' where key='weather'`,'damage');
assert.equal((await one('select eldervale_private.public_game_config() c')).c.weather.on,true);
await compare('damaged settings');
console.log('ok console commands validate, force, clear, disable and audit');
