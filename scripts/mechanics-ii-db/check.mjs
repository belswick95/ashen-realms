// Behavioural check of db/mechanics-ii-*.sql on PGlite (real Postgres in WASM).
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node scripts/mechanics-ii-db/check.mjs
// (or set PGLITE=/path/to/node_modules/@electric-sql/pglite/dist/index.js)
// The live-anchor check is separate: node scripts/mechanics-ii-db/live-anchors.mjs (read-only SQL).
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {runDrain,runRegen,hitDelay,poisonSchedule,venomDamage,isAggressive,migrateLoot} from '../../mechanics.js';
const {PGlite}=await import(process.env.PGLITE||'@electric-sql/pglite');
const repo=new URL('../..',import.meta.url).pathname;
const db=new PGlite();
const run=async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message);throw e}};
const one=async(sql,params=[])=>(await db.query(sql,params)).rows[0];
const all=async(sql,params=[])=>(await db.query(sql,params)).rows;

await run(readFileSync(new URL('./fixture.sql',import.meta.url),'utf8'),'fixture');
const perf=readFileSync(repo+'scripts/perf-tick-db/fixture.sql','utf8');
await run(perf.slice(perf.indexOf('CREATE OR REPLACE FUNCTION eldervale_private.patch_function'),perf.indexOf('-- Live collision chain')),'patch_function');
const combat=readFileSync(repo+'db/osrs-equipment-combat.sql','utf8');
for(const name of ['gear_int','gear_level','osrs_max_hit','osrs_hit_chance','arrow_tiers','best_arrow','arrow_supply','spend_arrow','gear_bonuses','spell_max_hit','monster_stats']){
 const at=combat.indexOf('create or replace function eldervale_private.'+name+'(');assert.ok(at>=0,name);
 await run(combat.slice(at,combat.indexOf('$f$;',combat.indexOf('$f$',at)+3)+4),name);
}
const P='00000000-0000-4000-8000-000000000001',Q='00000000-0000-4000-8000-000000000002',SESSION='00000000-0000-4000-8000-0000000000aa';
await run(`insert into eldervale_private.realm_catalog(id,data) values
 ('weapon:dagger','{"name":"Iron dagger","ticks":4,"speed":1.8,"styles":{"stab":"stab","slash":"slash","lunge":"stab"},"bonuses":{"astab":10,"str":8}}'),
 ('weapon:eldersteelDagger','{"name":"Eldersteel dagger","ticks":4,"speed":1.8,"styles":{"stab":"stab","slash":"slash","lunge":"stab"},"bonuses":{"astab":60,"str":50}}'),
 ('weapon:spear','{"name":"Iron spear","ticks":5,"speed":2.25,"styles":{"stab":"stab","slash":"slash","lunge":"crush"},"bonuses":{"astab":9}}'),
 ('weapon:warhammer','{"name":"Iron warhammer","ticks":7,"speed":3.15,"styles":{"stab":"crush","slash":"crush","lunge":"crush"},"bonuses":{"acrush":20}}'),
 ('weapon:hammer','{"name":"Iron hammer","ticks":5,"speed":2.25,"styles":{"stab":"crush","slash":"crush","lunge":"crush"},"bonuses":{"acrush":9}}'),
 ('weapon:longbow','{"name":"Longbow","ranged":true,"reach":15,"ticks":6,"speed":2.7,"arrowCapTier":1,"styles":{"stab":"ranged","slash":"ranged","lunge":"ranged"},"bonuses":{"arange":8}}'),
 ('item:weapon:dagger','{"name":"Iron dagger","field":"weaponsOwned","key":"dagger"}'),
 ('item:arrows','{"name":"Iron arrows","category":"Trade goods","stackable":true}'),
 ('item:bones','{"name":"Bones","category":"Prayer"}'),
 ('item:thread','{"name":"Thread","category":"Materials","stackable":true}'),
 ('item:uncutGem','{"name":"Uncut sapphire","category":"Materials"}'),('item:cutGem','{"name":"Cut sapphire","category":"Materials"}'),('item:runiteBar','{"name":"Runite bar","category":"Bars"}'),
 ('item:silverRing','{"name":"Silver ring","category":"Trade goods"}'),('item:embersteelArrows','{"name":"Embersteel arrows","stackable":true}'),('item:wyrmBones','{"name":"Wyrm bones","category":"Prayer"}'),('item:gold','{"name":"Coins"}'),
 ('item:shrimp','{"name":"Cooked shrimp","heal":30,"category":"Food"}'),('item:sundae','{"name":"Sundae","heal":20,"category":"Food"}'),
 ('item:ironBar','{"name":"Iron bar","category":"Bars"}')`,'catalog');
const pass=async()=>{for(const f of ['mechanics-ii-1-core.sql','mechanics-ii-2-combat.sql','mechanics-ii-3-hooks.sql']){const sql=readFileSync(repo+'db/'+f,'utf8');for(const w of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+w+'\\b','i').test(sql),f+' avoids '+w);await run(sql,f)}};
await pass();await pass();
console.log('ok mechanics-ii 1-3 apply twice (idempotent hooks)');
for(const [fn,needle] of [['world_tick()','mech_tick(t)'],['world_tick()','mech_combat('],['world_tick()','mech_aggro_target('],['world_tick()','mech_player_attack('],['realm_request(uuid,text,jsonb,uuid,bigint)','mech_command('],['realm_request(uuid,text,jsonb,uuid,bigint)','mech_reply('],['realm_request_social_base(uuid,text,jsonb,uuid,bigint)','mech_eat_gate('],['realm_request_before_bank_notes(uuid,text,jsonb,uuid,bigint)','mech_eat_gate('],['realm_request_before_castle(uuid,text,jsonb,uuid,bigint)',"'block'"],['combat_xp_unscaled(uuid,integer,text,jsonb)',"style='block'"],['advance_player_motion(uuid,timestamp with time zone)','mech_energy('],['advance_player_tiles(uuid,timestamp with time zone)','mech_energy('],['admin_console(text,jsonb)','mech_console(']]){
 const d=(await one(`select pg_get_functiondef('eldervale_private.${fn}'::regprocedure) d`)).d;
 assert.equal(d.split(needle).length-1,1,fn+' hooked once: '+needle);
}
console.log('ok every hook is in place exactly once');

// ---- pure formulas = mechanics.js (spec test vectors)
for(const [w,ag,st] of [[0,1,false],[0,99,false],[64,1,false],[100,1,false],[32,50,false],[20,40,false],[0,1,true]]){
 const r=await one(`select eldervale_private.mech_run_drain($1,$2,$3,eldervale_private.mech_config()) d`,[w,ag,st]);assert.equal(r.d,runDrain(w,ag,{stamina:st}),`drain ${w} kg agility ${ag}`);
}
assert.deepEqual([1,50,99].map(a=>runRegen(a)),[15,20,24]);
for(const a of [1,50,99])assert.equal((await one(`select eldervale_private.mech_run_regen($1,eldervale_private.mech_config()) r`,[a])).r,runRegen(a));
for(const [k,d,npc] of [['ranged',1,false],['ranged',3,true],['ranged',9,true],['magic',1,false],['magic',2,true],['magic',5,false],['magic',8,true],['melee',1,true],['thrown',7,false]])
 assert.equal((await one(`select eldervale_private.mech_hit_delay($1,$2,$3) d`,[k,d,npc])).d,hitDelay(k,d,npc),`delay ${k} ${d}`);
const sched=(await all(`select eldervale_private.mech_poison_damage(s) d from generate_series(30,1,-1) s`)).map(r=>r.d);
assert.deepEqual(sched,poisonSchedule(30));assert.equal(sched.reduce((a,b)=>a+b,0),105);
assert.deepEqual((await all(`select eldervale_private.mech_venom_damage(h,eldervale_private.mech_config()) d from generate_series(0,9) h`)).map(r=>r.d),[0,1,2,3,4,5,6,7,8,9].map(h=>venomDamage(h)));
for(const [pc,l,m] of [[56,28,'level'],[57,28,'level'],[126,63,'level'],[126,5,'always'],[3,50,'never']])
 assert.equal((await one(`select eldervale_private.mech_aggressive($1,$2,$3,eldervale_private.mech_config()) a`,[pc,l,m])).a,isAggressive(pc,l,m),`aggro ${pc} vs ${l}`);
for(const loot of [[{item:'bones',always:true},{item:'thread',min:1,max:3,chance:.35},{item:'uncutGem',chance:.06}],[{item:'a',chance:.9},{item:'b',chance:.7},{item:'c',chance:.004}]]){
 const r=(await one(`select eldervale_private.mech_loot_v2($1::jsonb,128) v`,[JSON.stringify(loot)])).v,js=migrateLoot(loot);
 assert.deepEqual(r.always,js.always);assert.deepEqual(r.main.rows.map(x=>[x.item,x.weight,x.min,x.max]),js.main.rows.map(x=>[x.item,x.weight,x.min,x.max]));
 assert.ok(r.main.rows.reduce((s,x)=>s+x.weight,0)<=128);
}
assert.deepEqual((await all(`select eldervale_private.mech_weapon_ticks(k,(select data from eldervale_private.realm_catalog where id='weapon:'||k),'stab') t from unnest(array['dagger','spear','warhammer','hammer','longbow']) k`)).map(r=>r.t),[4,4,6,4,6]);
assert.equal((await one(`select eldervale_private.mech_weapon_ticks('longbow',(select data from eldervale_private.realm_catalog where id='weapon:longbow'),'slash') t`)).t,5,'Rapid: one tick faster');
console.log('ok SQL formulas match mechanics.js (run energy, hit delay, poison/venom, aggression, loot migration, weapon speeds)');

// ---- world: one player, a wolf, a tick clock
let tick=Math.floor(Date.now()/600)+5;const at=n=>new Date(n*600+10).toISOString();
const worldTick=async(n=1)=>{for(let i=0;i<n;i++){tick++;await run(`set test.now='${at(tick)}';update eldervale_private.realm_players set last_seen='${at(tick)}';update eldervale_private.realm_clock set tick_at='${at(tick-1)}';select eldervale_private.world_tick();`,'tick')}};
const events=async(type,since=0)=>all(`select data from eldervale_private.realm_events where id>$1 and data->>'type'=$2 order by id`,[since,type]).then(r=>r.map(x=>x.data));
const lastEvent=async()=>(await one(`select coalesce(max(id),0) m from eldervale_private.realm_events`)).m;
await run(`insert into public.player_saves(user_id,skills,stats,equipment,health,max_health,level) values('${P}','{"attackXP":0,"strengthXP":0,"defenceXP":0,"prayerXP":70000,"hitpointsXP":1200}','{"shrimp":5,"sundae":2,"antidote":1,"shrineDraught":1,"briskTonic":1}','{"weapon":"dagger"}',1000,1000,3),('${Q}','{}','{}','{}',100,100,3);
 insert into eldervale_private.realm_players(user_id,session_id,x,z,last_seen) values('${P}','${SESSION}',0,0,now()),('${Q}','${SESSION}',500,500,now());
 insert into eldervale_private.realm_actors(id,data,x,z,hp) values
  ('wolf','{"kind":"monster","name":"Wolf","rosterKey":"wolf","level":10,"hp":5000,"hostile":true,"attackType":"bite","attackSpeed":2.4,"maxHit":30,"x":1.58,"z":0,"loot":[{"item":"bones","always":true},{"item":"thread","min":1,"max":3,"chance":0.35}]}',1.58,0,5000),
  ('spider','{"kind":"monster","name":"Spider","rosterKey":"spider","level":10,"hp":500,"hostile":true,"attackType":"venom","attackSpeed":2.4,"maxHit":20,"x":-1.58,"z":0}',300,300,500)`,'world');
const pm=()=>one(`select * from eldervale_private.player_mech where user_id='${P}'`);
let mark=await lastEvent();
await worldTick(1);
assert.equal((await one(`select target from eldervale_private.realm_actors where id='wolf'`)).target,P,'aggressive wolf (level 10) picks the level-3 player in hunt range');
await worldTick(40);
const winds=await events('windup',mark),hits=await events('hit',mark);
const npcSwings=winds.filter(e=>e.side==='enemy').length,playerSwings=winds.filter(e=>e.side==='player').length;
assert.ok(npcSwings>=9&&npcSwings<=11,'wolf (4 ticks) swings about 10 times in 40 ticks: '+npcSwings);
assert.ok(playerSwings>=9&&playerSwings<=11,'auto-retaliating dagger (4 ticks) swings about 10 times: '+playerSwings);
assert.ok(hits.filter(e=>e.side==='player').length>=playerSwings-1,'player hits land (one tick later on NPCs)');
assert.equal((await all(`select 1 from eldervale_private.test_log where kind='old_combat'`)).length,0,'old alternating-turn code never ran');
console.log(`ok independent attack timers: wolf ${npcSwings} swings, player ${playerSwings} swings in 40 ticks; hits land after the hit delay`);

// Protect from melee: blocks every NPC melee hit; prayer drains D12 = 1 point per 5 ticks.
const rq=async(command,payload={})=>{await run(`set test.uid='${P}'`);return (await one(`select eldervale_private.realm_request('${SESSION}',$1,$2::jsonb,gen_random_uuid(),0) r`,[command,JSON.stringify(payload)])).r};
let r=await rq('mech_prayer',{id:'wardBlades'});
assert.deepEqual(r.mechanics.prayer.active,['wardBlades']);const before=(await pm()).prayer_points;
await run(`update eldervale_private.player_mech set last_tick=${tick},prayer_on_tick=${tick},prayer_counter=0 where user_id='${P}'`);
mark=await lastEvent();await worldTick(20);
const enemyHits=(await events('hit',mark)).filter(e=>e.side==='enemy');
assert.ok(enemyHits.length>=4&&enemyHits.every(e=>e.damage===0&&e.protected),'Ward of Blades blocks 100% of NPC melee');
assert.equal(before-(await pm()).prayer_points,4,'20 ticks of drain 12 at resistance 60 = 4 points');
await rq('mech_prayer',{id:'wardArrows'});assert.deepEqual((await pm()).prayers,['wardArrows'],'protection prayers are exclusive');
await rq('mech_prayers_off');
await assert.rejects(rq('mech_prayer',{id:'paragonOath'}),/Prayer level 60/);
console.log('ok protection prayer blocks melee at landing; drain counter; exclusive groups; level gate');

// Special attack: Twin Fangs (eldersteel dagger) = two hits, 25%; regen 10% per 50 ticks.
await run(`update public.player_saves set equipment='{"weapon":"eldersteelDagger"}' where user_id='${P}';update eldervale_private.player_mech set spec=1000,attack_tick=0 where user_id='${P}'`);
r=await rq('mech_spec');assert.equal(r.mechanics.spec.armed,true);assert.equal(r.mechanics.spec.name,'Twin Fangs');
mark=await lastEvent();await worldTick(1);
const sp=(await events('windup',mark)).find(e=>e.side==='player');assert.equal(sp?.special,'Twin Fangs');
let m=await pm();assert.equal(m.spec,750);assert.equal(m.spec_armed,false);
await run(`update eldervale_private.player_mech set spec_tick=${tick+1} where user_id='${P}'`);await worldTick(50);
assert.equal((await pm()).spec,850,'+10% after 50 ticks (fixed timer)');
await run(`update public.player_saves set equipment='{"weapon":"dagger"}' where user_id='${P}'`);
await assert.rejects(rq('mech_spec'),/no special attack/);
console.log('ok special attack: armed, spent 25%, two hits, regenerates 10% per 50 ticks');

// Eating: normal food adds 3 to a running attack timer; a second bite waits 3 ticks; combo food in the same tick.
await run(`update eldervale_private.player_mech set attack_tick=eldervale_private.tick_no(clock_timestamp())+2,eat_tick=0,combo_tick=0 where user_id='${P}';update public.player_saves set health=50 where user_id='${P}'`);
const nowTick=(await one(`select eldervale_private.tick_no(clock_timestamp()) n`)).n;
await run(`set test.uid='${P}';select eldervale_private.realm_request_social_base('${SESSION}','consume','{"item":"shrimp"}',gen_random_uuid(),0)`,'eat');
m=await pm();assert.ok(Number(m.attack_tick)>=Number(nowTick)+5,'attack timer 2 + 3');
await assert.rejects(db.exec(`select eldervale_private.realm_request_social_base('${SESSION}','consume','{"item":"shrimp"}',gen_random_uuid(),0)`),/already eating/);
await run(`select eldervale_private.realm_request_social_base('${SESSION}','consume','{"item":"sundae"}',gen_random_uuid(),0)`,'combo');
assert.ok(Number((await pm()).attack_tick)>=Number(nowTick)+7,'combo food adds 2 more');
console.log('ok eat delay 3 ticks, attack timer +3 / combo +2, combo food in the same tick');

// Potions: antidote cures poison with immunity; shrine draught restores 7 + level/4 prayer.
await run(`update eldervale_private.player_mech set poison=10,poison_tick=${tick+1},prayer_points=0,drink_tick=0 where user_id='${P}'`);
await rq('mech_drink',{item:'antidote'});m=await pm();assert.equal(m.poison,0);assert.ok(Number(m.immune_until)>0);
await run(`update eldervale_private.player_mech set drink_tick=0 where user_id='${P}'`);
await rq('mech_drink',{item:'shrineDraught'});const plevel=(await one(`select eldervale_private.gear_level(skills,'prayer') l from public.player_saves where user_id='${P}'`)).l;
assert.equal((await pm()).prayer_points,Math.floor(7+.25*plevel));
console.log('ok antidote and shrine draught');

// Poison: severity 30 hits 6 (x10) every 30 ticks.
await run(`update eldervale_private.player_mech set poison=30,poison_tick=${tick+1},immune_until=0 where user_id='${P}';update eldervale_private.realm_actors set target=null,hp=0,respawn_at=null where id='wolf';update public.player_saves set health=1000,game_flags='{}' where user_id='${P}'`);
mark=await lastEvent();await worldTick(61);
const ph=(await events('hit',mark)).filter(e=>e.poison);assert.deepEqual(ph.map(e=>e.damage),[60,60,60],'poison 6 x10 at ticks 1, 31, 61');
assert.equal((await pm()).poison,27);
await run(`update eldervale_private.player_mech set poison=0,venom=0 where user_id='${P}'`);
console.log('ok poison every 30 ticks');

// Venom-type monster poisons on a damaging hit (rule chance forced to 1).
await run(`update eldervale_private.mech_rules set data='{"severity":6,"chance":1}' where kind='poison' and id='type:venom'`);
await run(`select eldervale_private.mech_apply('player','${P}','{"src":"spider","srcKind":"npc","dmg":20,"style":"melee","poison":{"severity":6,"chance":1}}','${at(tick)}')`,'venom hit');
assert.equal((await pm()).poison,6,'poisoned by the hit');
const mm=(await one(`select eldervale_private.mech_monster('spider',data) m from eldervale_private.realm_actors where id='spider'`)).m;assert.equal(mm.poison.severity,6,'type:venom rule applies to the spider');
await run(`update eldervale_private.player_mech set poison=0 where user_id='${P}'`);
console.log('ok poison sources (monster rule) applied on hit');

// Tolerance: after 1000 ticks in the same area the wolf ignores the player; leaving resets it.
await run(`update eldervale_private.realm_actors set hp=5000,target=null,x=1.58,z=0 where id='wolf';update eldervale_private.player_mech set tol=jsonb_build_object('ax',0,'az',0,'bx',0,'bz',0,'since',${tick-1000},'b',false),last_hit_by=null,last_hit_tick=null where user_id='${P}';update eldervale_private.realm_players set intent=null where user_id='${P}'`);
await worldTick(2);assert.equal((await one(`select target from eldervale_private.realm_actors where id='wolf'`)).target,null,'tolerant after 1000 ticks');
await run(`update eldervale_private.realm_players set x=${12*1.58} where user_id='${P}';update eldervale_private.realm_actors set x=${13*1.58},z=0,data=data||'{"x":${13*1.58}}' where id='wolf'`);
await worldTick(2);assert.equal((await one(`select target from eldervale_private.realm_actors where id='wolf'`)).target,P,'leaving both 21x21 squares resets tolerance');
console.log('ok tolerance (1000 ticks, reset on leaving the area)');

// Level threshold: a level-3 rat ignores a combat-57 player... (player cb 3 vs level 1 rat: 3 > 2 -> ignored).
await run(`insert into eldervale_private.realm_actors(id,data,x,z,hp) values('rat','{"kind":"monster","name":"Rat","level":1,"hp":50,"hostile":true,"x":-30,"z":0}',-30,0,50);update eldervale_private.realm_players set x=-31 where user_id='${P}';update eldervale_private.realm_actors set target=null where id='wolf';update eldervale_private.player_mech set tol=null,last_hit_by=null,last_hit_tick=null where user_id='${P}'`);
await worldTick(1);assert.equal((await one(`select target from eldervale_private.realm_actors where id='rat'`)).target,null,'combat 3 > 2 x level 1: ignored');
console.log('ok aggression level threshold');

// Leash: a target far beyond max range + 11 of the spawn is dropped.
await run(`update eldervale_private.realm_actors set target='${P}',x=${13*1.58},z=0 where id='wolf';update eldervale_private.realm_players set x=${40*1.58},z=0 where user_id='${P}'`);
await worldTick(1);assert.equal((await one(`select target from eldervale_private.realm_actors where id='wolf'`)).target,null,'leash: lost interest');
console.log('ok leash / lose interest');

// Kill: always drop (bones) on the ground, kill count, gold/xp, death event.
await run(`update eldervale_private.realm_actors set hp=5 where id='wolf'`);
await run(`select eldervale_private.mech_apply('actor','wolf','{"src":"${P}","srcKind":"player","dmg":50,"style":"melee","xpStyle":"block","w":{}}','${at(tick)}')`,'kill');
assert.ok((await one(`select count(*)::int n from eldervale_private.ground_drops where owner_id='${P}' and item='bones'`)).n>=1,'bones always drop');
assert.equal((await one(`select kills from eldervale_private.kill_counts where user_id='${P}' and monster='wolf'`)).kills,1);
assert.ok(Number((await one(`select skills->>'defenceXP' x from public.player_saves where user_id='${P}'`)).x)>0,'Defensive style trains Defence');
assert.equal((await one(`select hp from eldervale_private.realm_actors where id='wolf'`)).hp,0);
console.log('ok kill: drops v2 always row, kill count, Defensive XP');

// Drops v2 statistics: 128-denominator table through the console simulator.
await run(`set test.owner='1'`);
await run(`select eldervale_private.admin_console('console_mech_rule_set','{"kind":"drops","id":"spider","data":{"always":[{"item":"bones"}],"main":{"denom":128,"rows":[{"item":"thread","weight":64},{"item":"ironBar","weight":32},{"table":"gems","weight":16}]}}}')`,'drops rule');
const sim=(await one(`select eldervale_private.admin_console('console_mech_drops_test','{"actor":"spider","kills":20000}') r`)).r;
const share=k=>(sim.main[k]||0)/sim.kills;
assert.ok(Math.abs(share('thread')-.5)<.02&&Math.abs(share('ironBar')-.25)<.02&&Math.abs(share('(nothing)')-.125-16/128*(87/128))<.03,'weighted main roll: '+JSON.stringify(sim.main));
await assert.rejects(db.exec(`select eldervale_private.admin_console('console_mech_rule_set','{"kind":"drops","id":"x","data":{"main":{"denom":10,"rows":[{"item":"thread","weight":11}]}}}')`),/exceed/);
await assert.rejects(db.exec(`select eldervale_private.admin_console('console_mech_set','{"config":{"run":{"nope":1}}}')`),/Unknown setting/);
await run(`select eldervale_private.admin_console('console_mech_set','{"config":{"run":{"drain_base":30}}}')`,'set');
assert.equal((await one(`select eldervale_private.mech_config()->'run'->>'drain_base' v`)).v,'30');
await run(`select eldervale_private.admin_console('console_mech_reset','{"section":"run"}')`,'reset');
const con=(await one(`select eldervale_private.admin_console('console_mech','{}') r`)).r;assert.ok(con.rules.filter(x=>x.kind==='prayer').length>=20);
const mons=(await one(`select eldervale_private.admin_console('console_mech_monsters','{}') r`)).r.monsters;assert.ok(mons.some(x=>x.key==='spider'&&x.hasDropsRule));
console.log('ok console: settings, rule validation, drop simulator ('+JSON.stringify(sim.main)+'), monster list');

// Run energy on tiles: one running tick at 0 kg, Agility 1 drains 59 units = 0.59 %.
await run(`update eldervale_private.realm_players set energy=100,run=true,path='[[1,1]]' where user_id='${P}';select eldervale_private.advance_player_tiles('${P}',now())`,'run tick');
const kg=Number((await pm()).weight);assert.ok(kg>0,'carried food and potions weigh something: '+kg);const drain=runDrain(kg,1)/100;
assert.ok(Math.abs((await one(`select energy from eldervale_private.realm_players where user_id='${P}'`)).energy-(100-drain))<1e-9,'drain per running tick at '+kg+' kg');
await run(`update eldervale_private.realm_players set path='[]' where user_id='${P}';select eldervale_private.advance_player_tiles('${P}',now())`,'rest tick');
assert.ok(Math.abs((await one(`select energy from eldervale_private.realm_players where user_id='${P}'`)).energy-(100-drain+.15))<1e-9,'regen 15/10000 per tick');
console.log('ok run energy per tick');

// The reply carries the mechanics block; switching the system off restores the old code paths.
r=await rq('mech_catalog');assert.ok(r.mechanics.catalog.prayers.length>=20&&r.mechanics.weight>=0&&r.interior);
await run(`select eldervale_private.admin_console('console_mech_set','{"config":{"enabled":false}}')`,'off');
await run(`update eldervale_private.realm_actors set hp=5000,target='${P}',x=1.58,z=0,data=data||'{"x":1.58}' where id='wolf';update eldervale_private.realm_players set x=0,z=0 where user_id='${P}';update public.player_saves set game_flags='{}',health=100 where user_id='${P}'`);
await worldTick(1);assert.ok((await all(`select 1 from eldervale_private.test_log where kind='old_combat'`)).length>0,'mechanics off: the previous combat path runs');
assert.deepEqual((await rq('sync')).mechanics,{enabled:false});
console.log('ok master switch off falls back to the previous code');
console.log('ALL MECHANICS-II CHECKS PASSED');
