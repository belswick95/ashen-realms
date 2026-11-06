// Behavioural check of db/bosses-*.sql on PGlite (real Postgres in WASM).
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node --import ./tests/helpers/preload.js scripts/bosses-db/check.mjs
// (or set PGLITE=/path/to/node_modules/@electric-sql/pglite/dist/index.js)
// Two databases: A = the mechanics II replica (fights, breath, kills, console); B = the underground
// replica (lairs: walls, passages, spawns, quest gates, catalog and loot rows).
// Live anchors: node scripts/bosses-db/live-anchors.mjs prints a read-only query (every row matches=1).
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE||'@electric-sql/pglite');
const {BOSSES,bossById,telegraphTiles,breathMultiplier,BREATH_DEFAULTS,phaseAt,LAIRS,withLair,bossDrops}=await import('../../bosses.js');
const {dungeons,rasterize,passageObjects}=await import('../../underground-data.js');
const {UNIQUE_ITEMS,QUEST_REWARD_ITEMS}=await import('../../unique-gear.js');
const repo=new URL('../..',import.meta.url).pathname;
const file=f=>readFileSync(repo+f,'utf8');
let n=0;const ok=label=>{n++;console.log('ok',n,label)};
// One `create or replace function eldervale_private.<name>(` statement from a SQL file.
function fnText(sql,name){const at=sql.indexOf('create or replace function eldervale_private.'+name+'(');assert.ok(at>=0,name);const tag=sql.slice(at).match(/as (\$[a-z]*\$)/i)[1];const b=sql.indexOf(tag,at)+tag.length;return sql.slice(at,sql.indexOf(tag,b)+tag.length+1)}
// The hook edits of bosses-2-hooks.sql: [fn, old, new].
const hooks=JSON.parse(file('db/bosses-2-hooks.sql').match(/\$edits\$([\s\S]*?)\$edits\$/)[1]);
const mk=db=>({run:async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message,e.where||'');process.exit(1)}},one:async(sql,p=[])=>(await db.query(sql,p)).rows[0],all:async(sql,p=[])=>(await db.query(sql,p)).rows,
 fails:async(sql,re,label)=>{try{await db.query(sql);assert.fail(label+': expected an error')}catch(e){if(e.code==='ERR_ASSERTION')throw e;assert.match(e.message,re,label)}}});
for(const f of ['db/bosses-1-core.sql','db/bosses-2-hooks.sql','db/bosses-3-lairs.sql','db/bosses-4-gear.sql']){const t=file(f);assert.ok(Buffer.byteLength(t)<=40960,f+' ≤ 40 KB');for(const w of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+w+'\\b','i').test(t),f+' avoids '+w)}
ok('four SQL files, each ≤ 40 KB, without the words DELETE/ALTER/DROP');

// =========================================================== A: fights
const A=new PGlite(),a=mk(A);
await a.run("do $r$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;end $r$;"+file('scripts/mechanics-ii-db/fixture.sql'),'fixture');
const perf=file('scripts/perf-tick-db/fixture.sql');
await a.run(perf.slice(perf.indexOf('CREATE OR REPLACE FUNCTION eldervale_private.patch_function'),perf.indexOf('-- Live collision chain')),'patch_function');
const combat=file('db/osrs-equipment-combat.sql');
for(const name of ['gear_int','gear_level','osrs_max_hit','osrs_hit_chance','arrow_tiers','best_arrow','arrow_supply','spend_arrow','gear_bonuses','spell_max_hit','monster_stats']){
 const at=combat.indexOf('create or replace function eldervale_private.'+name+'(');await a.run(combat.slice(at,combat.indexOf('$f$;',combat.indexOf('$f$',at)+3)+4),name)}
const ug=file('scripts/underground-db/fixture.sql');
await a.run(`create table eldervale_private.settings(id boolean primary key default true,revision bigint not null default 0);insert into eldervale_private.settings(id) values(true);
 create table eldervale_private.entities(id uuid primary key default gen_random_uuid(),revision bigint not null,data jsonb not null,deleted boolean not null default false,created_at timestamptz not null default now());
 create table eldervale_private.shop_stock(merchant text,item text,buy integer,sell integer,stock integer,primary key(merchant,item));
 create table eldervale_private.underground_areas(id text primary key,data jsonb not null,enabled boolean not null default true,updated_at timestamptz default now(),updated_by uuid);
 create function eldervale_private.player_unlocked(uid uuid,k text) returns boolean language sql stable as $$select coalesce((select game_flags->'unlocks'?k from public.player_saves where user_id=uid),false)$$;
 ${ug.slice(ug.indexOf('CREATE OR REPLACE FUNCTION eldervale_private.entity_runtime()'),ug.indexOf('CREATE OR REPLACE FUNCTION eldervale_private.can_step('))}`,'entities');
const ug1=file('db/underground-1-engine.sql'),ug3=file('db/underground-3-console.sql');
for(const [sql,name] of [[ug1,'underground_passages'],[ug1,'underground_command'],[ug3,'underground_check']])await a.run(fnText(sql,name),name);
await a.run(`insert into eldervale_private.realm_catalog(id,data) values
 ('weapon:dagger','{"name":"Iron dagger","ticks":4,"speed":1.8,"styles":{"stab":"stab","slash":"slash","lunge":"stab"},"bonuses":{"astab":10,"str":8}}'),
 ('weapon:longbow','{"name":"Longbow","ranged":true,"reach":15,"ticks":6,"speed":2.7,"styles":{"stab":"ranged","slash":"ranged","lunge":"ranged"},"bonuses":{"arange":8}}'),
 ('item:heftyBones','{"name":"Hefty bones"}'),('item:runiteBar','{"name":"Runite bar"}'),('item:weapon:unbrokenCleaver','{"name":"Unbroken Cleaver","field":"weaponsOwned","key":"unbrokenCleaver","uniqueGear":true,"tradeable":true}'),
 ('item:breathwardTonic','{"name":"Breathward tonic","category":"Potions","breathward":500}')`,'catalog');
const pass=async()=>{for(const f of ['mechanics-ii-1-core','mechanics-ii-2-combat','mechanics-ii-3-hooks','bosses-1-core','bosses-2-hooks'])await a.run(file('db/'+f+'.sql'),f)};
await pass();await pass();
for(const [fn,,nw] of hooks.filter(h=>!/underground_check|underground_passages|underground_command/.test(h[0])||true)){const d=(await a.one(`select pg_get_functiondef('${fn}'::regprocedure) d`)).d;assert.equal(d.split(nw).length-1,1,fn+' patched once')}
ok('mechanics II + bosses 1-2 apply twice; every hook is in place exactly once');

// Pure helpers: SQL = bosses.js.
for(const [shape,c,b,r] of [['target',[3,4],[0,0],1],['around',[3,4],[1,1],2],['ring',[0,0],[5,5],5],['cross',[2,2],[0,0],3],['line',[6,1],[0,0],8],['line',[0,-5],[0,0],4],['behind',[4,0],[0,0],4],['behind',[0,0],[0,0],2]]){
 const sql=(await a.one(`select eldervale_private.boss_tiles($1,$2,$3,$4,$5,$6,6) t`,[shape,c[0],c[1],b[0],b[1],r])).t;assert.deepEqual(sql,telegraphTiles(shape,{c,b,radius:r}),shape)}
const sc=(await a.one(`select eldervale_private.boss_tiles('scatter',10,10,0,0,4,9) t`)).t;assert.ok(sc.length>=1&&sc.length<=9&&sc.every(([i,j])=>Math.abs(i-10)<=4&&Math.abs(j-10)<=4),'scatter stays in the square');
const bcfg=(await a.one(`select eldervale_private.boss_config()->'breath' b`)).b;
for(const shield of [null,'scalewardShield','wardensAegis','kite'])for(const potion of [false,true])for(const protectMagic of [false,true])
 assert.equal((await a.one(`select eldervale_private.boss_breath_calc($1,$2,$3,$4) m`,[shield,potion,protectMagic,bcfg])).m,breathMultiplier({shield,potion,protectMagic},BREATH_DEFAULTS),`${shield} ${potion} ${protectMagic}`);
for(const b of BOSSES)for(const pct of [100,90,66,65,34,33,30,25,24,1])assert.equal((await a.one(`select eldervale_private.boss_phase_at($1,$2) p`,[JSON.stringify(b),pct])).p,phaseAt(b,pct),b.id+' '+pct);
for(const b of BOSSES)await a.one(`select eldervale_private.boss_check($1) c`,[JSON.stringify(b)]);
await a.fails(`select eldervale_private.boss_check('{"id":"x1","name":"X","attackTicks":5,"arena":{"radius":8},"attacks":{"a":{"kind":"strike","style":"melee","maxHit":10}},"phases":[{"at":100,"pattern":["b"]}]}')`,/unknown attack b/,'pattern key');
await a.fails(`select eldervale_private.boss_check('{"id":"x1","name":"X","attackTicks":5,"arena":{"radius":8},"attacks":{"a":{"kind":"zap","maxHit":10}},"phases":[{"at":100,"pattern":["a"]}]}')`,/kind/,'attack kind');
ok('telegraph tiles, breath multipliers, phase thresholds and the definition check match bosses.js');

// World: a player, Grimtusk, roster templates for the adds.
const P='00000000-0000-4000-8000-000000000001',Q='00000000-0000-4000-8000-000000000002',SESSION='00000000-0000-4000-8000-0000000000aa';
let tick=Math.floor(Date.now()/600)+5;const at=k=>new Date(k*600+10).toISOString();
const worldTick=async(k=1)=>{for(let i=0;i<k;i++){tick++;await a.run(`set test.now='${at(tick)}';update eldervale_private.realm_players set last_seen='${at(tick)}';update eldervale_private.realm_clock set tick_at='${at(tick-1)}';select eldervale_private.world_tick();`,'tick')}};
const events=async(type,since=0)=>(await a.all(`select data from eldervale_private.realm_events where id>$1 and data->>'type'=$2 order by id`,[since,type])).map(r=>r.data);
const lastEvent=async()=>(await a.one(`select coalesce(max(id),0) m from eldervale_private.realm_events`)).m;
for(const b of BOSSES)await a.run(`insert into eldervale_private.boss_defs(id,data) values('${b.id}',$j$${JSON.stringify(b)}$j$) on conflict do nothing`,'def '+b.id);
const boss=(id,bid,x,z,hp,extra={})=>`('${id}','${JSON.stringify({kind:'monster',name:bossById[bid].name,rosterKey:bid,bossId:bid,boss:true,level:bossById[bid].level,hp,hostile:true,attackType:'slash',attackSpeed:3.4,maxHit:200,x,z,scale:1.6,...extra})}',${x},${z},${hp})`;
await a.run(`insert into public.player_saves(user_id,character_name,skills,stats,equipment,health,max_health,level) values('${P}','Hero','{"attackXP":13034431,"strengthXP":13034431,"defenceXP":13034431,"prayerXP":13034431,"hitpointsXP":13034431}','{"breathwardTonic":2}','{"weapon":"dagger"}',99000,99000,126),
  ('${Q}','Helper','{"hitpointsXP":13034431}','{}','{"weapon":"longbow"}',99000,99000,126);
 insert into eldervale_private.realm_players(user_id,session_id,x,z,last_seen) values('${P}','${SESSION}',0,0,now()),('${Q}','${SESSION}',900,900,now());
 insert into eldervale_private.realm_actors(id,data,x,z,hp) values ${boss('grim','grimtusk',1.58,0,3000)},${boss('brood','gloom_matriarch',300,0,3000)},${boss('wyrm','twinflame_wyrm',600,0,3000)};
 insert into eldervale_private.entities(id,revision,data,deleted) select md5('tpl:'||k)::uuid,1,jsonb_build_object('kind','monster','name',k,'rosterKey',k,'level',50,'hp',300,'hostile',true,'attackType','slash','blueprint','monster-roster-v1','x',0,'z',0),true
  from unnest(array['bloodtusk_berserker','gloomweb_broodling','ashscale_whelp']) k;`,'world');
let mark=await lastEvent();
await worldTick(1);
assert.equal((await a.one(`select target from eldervale_private.realm_actors where id='grim'`)).target,P,'a boss is always aggressive in range');
await worldTick(1);
if(process.env.DEBUG){console.log((await a.all(`select data from eldervale_private.realm_events where id>${mark}`)).map(r=>JSON.stringify(r.data)).join('\n'));console.log(JSON.stringify(await a.one(`select state from eldervale_private.mechanics_config`)))}
const start=(await events('boss_start',mark))[0];assert.equal(start?.boss,'grimtusk');assert.equal(start.phases.length,3);assert.equal(start.arena.radius,10);
await worldTick(40);
const attacks=await events('boss_attack',mark),tels=await events('boss_telegraph',mark),impacts=await events('boss_impact',mark);
assert.ok(attacks.length>=3,'strikes: '+attacks.length);assert.ok(attacks.every(e=>['cleave','hurl'].includes(e.attack)));
assert.ok(tels.length>=1&&tels[0].attack==='earthsplitter'&&tels[0].ticks===2&&tels[0].tiles.length===24,'earthsplitter marks a 3x8 line');
assert.ok(impacts.length>=1&&impacts[0].hits===1,'the player who stayed on the line is hit');
assert.equal((await a.all(`select 1 from eldervale_private.test_log where kind='old_combat'`)).length,0);
ok(`Grimtusk: fight starts, ${attacks.length} strikes and ${tels.length} telegraphs in 40 ticks; the marked line resolves 2 ticks later`);

// Dodging: resolve a telegraph with the player off the marked tiles, then on them.
const hp=async()=>(await a.one(`select health from public.player_saves where user_id='${P}'`)).health;
let h0=await hp();await a.run(`select eldervale_private.boss_resolve('grim','{"key":"slam","tiles":[[5,5]],"maxHit":400,"pct":100}','${at(tick)}')`,'miss');assert.equal(await hp(),h0,'off the tiles: no damage');
await a.run(`select eldervale_private.boss_resolve('grim','{"key":"slam","tiles":[[0,0]],"maxHit":400,"pct":100}','${at(tick)}')`,'hit');const lost=h0-await hp();assert.ok(lost>=300&&lost<=400,'on the tiles: 75-100% of the max hit, through prayer: '+lost);
await a.run(`update eldervale_private.player_mech set prayers='{wardSorcery}' where user_id='${P}'`,'pray magic');h0=await hp();
await a.run(`select eldervale_private.boss_resolve('grim',('{"key":"judgement","tiles":[],"maxHit":450,"pct":100,"style":"magic","uid":"${P}"}')::jsonb,'${at(tick)}')`,'charge');assert.equal(await hp(),h0,'a charged magic hit is blocked by Ward of Sorcery');
await a.run(`update eldervale_private.player_mech set prayers='{}' where user_id='${P}'`,'prayer off');
ok('telegraphs: stepping off the marked tiles avoids them; charged hits respect protection prayers');

// Phases: below 66% Grimtusk calls his warcry → 2 berserker adds (entities → actors).
mark=await lastEvent();await a.run(`update eldervale_private.realm_actors set hp=1900 where id='grim';update public.player_saves set health=99000`,'hp 63%');
await worldTick(12);
const ph=(await events('boss_phase',mark))[0];assert.equal(ph?.phase,1);assert.equal(ph.name,'Warcry');
const sum=(await events('boss_summon',mark))[0];assert.equal(sum?.adds.length,2);
const adds=await a.all(`select r.id,r.data->>'bossAdd' b,r.data->>'rosterKey' k,r.hp,r.deleted from eldervale_private.realm_actors r where r.data->>'blueprint'='boss-add-v1'`);
assert.equal(adds.length,2);assert.ok(adds.every(x=>x.b==='grim'&&x.k==='bloodtusk_berserker'&&!x.deleted&&x.hp>0),'adds are live actors');
ok('phase 2 at 66%: the onEnter warcry summons two berserkers as live actors');

// Enrage after its soft timer.
mark=await lastEvent();await a.run(`update eldervale_private.boss_fights set started_tick=started_tick-300 where actor_id='grim'`,'old fight');await worldTick(1);
assert.equal((await events('boss_enrage',mark)).length,1);assert.equal((await a.one(`select enraged from eldervale_private.boss_fights where actor_id='grim'`)).enraged,true);
assert.equal((await a.one(`select eldervale_private.boss_attack_ticks(data,2,true) t from eldervale_private.boss_defs where id='grimtusk'`)).t,3,'last stand 4 ticks - 1 when enraged');
ok('enrage after 250 ticks: faster attacks, harder hits');

// Kill: kill count for every participant, personal best, rare announcement, chest, respawn timer, adds gone.
await a.run(`insert into eldervale_private.mech_rules(kind,id,data) values('drops','grimtusk','{"always":[{"item":"heftyBones","min":2,"max":2}],"preroll":[{"item":"weapon:unbrokenCleaver","chance":1}]}') on conflict (kind,id) do update set data=excluded.data;
 update eldervale_private.boss_fights set participants=participants||'{"${Q}":40}' where actor_id='grim'`,'loot');
mark=await lastEvent();
await a.run(`select eldervale_private.mech_apply('actor','grim','{"src":"${P}","srcKind":"player","dmg":99999,"style":"slash"}','${at(tick)}')`,'kill');
const kc=await a.all(`select user_id::text u,kills,best_ticks from eldervale_private.boss_kills where boss='grimtusk' order by user_id`);
assert.deepEqual(kc.map(r=>[r.u,r.kills]),[[P,1],[Q,1]],'killer and helper both get the kill');assert.ok(kc[0].best_ticks>=300,'personal best in ticks');
const def=(await events('boss_defeated',mark));assert.equal(def.length,2);assert.ok(def.every(e=>e.newPb&&e.kc===1));
const rare=(await events('boss_rare',mark))[0];assert.equal(rare?.item,'weapon:unbrokenCleaver');assert.equal(rare.who,'Hero');assert.equal(rare.itemName,'Unbroken Cleaver');
const chest=(await events('boss_chest',mark))[0];assert.ok(chest?.loot.some(l=>l.item==='weapon:unbrokenCleaver'));
assert.equal((await a.all(`select 1 from eldervale_private.ground_drops where item='weapon:unbrokenCleaver' and owner_id='${P}'`)).length,1,'the unique lies on the ground for the killer');
const ra=await a.one(`select respawn_at,eldervale_private.tick_no(respawn_at)-${tick} dt from eldervale_private.realm_actors where id='grim'`);assert.ok(Math.abs(ra.dt-50)<=1,'lair respawn 50 ticks: '+ra.dt);
assert.equal(Number((await a.one(`select count(*) c from eldervale_private.entities where data->>'blueprint'='boss-add-v1' and not deleted`)).c),0,'adds leave');
assert.equal((await a.one(`select active from eldervale_private.boss_fights where actor_id='grim'`)).active,false);
assert.equal((await a.one(`select eldervale_private.boss_kc('${P}','grimtusk') k`)).k,1);
ok('kill: KC for both participants, personal best, rare announcement, loot chest, 50-tick respawn, adds removed');

// Immune while adds live (Gloom Matriarch phase 2), and the idle reset.
await a.run(`update eldervale_private.realm_actors set hp=0,respawn_at=null,target=null where id='grim';update eldervale_private.realm_players set x=298.42,z=0 where user_id='${P}'`,'to the nest');
mark=await lastEvent();await worldTick(2);
await a.run(`update eldervale_private.realm_actors set hp=1900 where id='brood'`,'63%');await worldTick(10);
assert.equal((await a.one(`select phase from eldervale_private.boss_fights where actor_id='brood'`)).phase,1);
const alive=Number((await a.one(`select eldervale_private.boss_adds_alive(f) n from eldervale_private.boss_fights f where actor_id='brood'`)).n);assert.equal(alive,3,'egg sacs: three broodlings');
const bdata=(await a.one(`select data from eldervale_private.realm_actors where id='brood'`)).data;
assert.equal((await a.one(`select eldervale_private.boss_gate('brood',$1,120,'slash','${P}','${at(tick)}') d`,[bdata])).d,0,'shielded by her brood');
await a.run(`update eldervale_private.realm_actors set hp=0 where data->>'bossAdd'='brood'`,'kill brood');
assert.equal((await a.one(`select eldervale_private.boss_gate('brood',$1,120,'slash','${P}','${at(tick)}') d`,[bdata])).d,120,'brood dead: damage lands');
mark=await lastEvent();
await a.run(`update eldervale_private.realm_players set x=900,z=900 where user_id='${P}';update eldervale_private.realm_actors set target=null where id='brood';update eldervale_private.boss_fights set last_tick=last_tick-40 where actor_id='brood'`,'walk away');
await worldTick(1);
assert.equal((await events('boss_reset',mark)).length,1);assert.equal((await a.one(`select hp from eldervale_private.realm_actors where id='brood'`)).hp,3000,'idle reset: full health');
ok('immune while adds live; nobody fighting for 20 ticks resets the boss to full health and clears adds');

// Flight (Vaelith): untargetable by melee, a breath sweep, then a landing on marked tiles.
await a.run(`update eldervale_private.realm_players set x=598.42,z=0 where user_id='${P}';update public.player_saves set health=99000;update eldervale_private.player_mech set last_hit_tick=null where user_id='${P}'`,'to the roost');
await worldTick(2);
await a.run(`update eldervale_private.boss_fights set queue='["flight"]' where actor_id='wyrm';update eldervale_private.actor_mech set attack_tick=0 where id='wyrm'`,'fly');
mark=await lastEvent();await worldTick(1);
if(process.env.DEBUG){console.log((await a.all(`select data from eldervale_private.realm_events where id>${mark}`)).map(r=>JSON.stringify(r.data)).join('\n'));console.log(JSON.stringify(await a.one(`select state from eldervale_private.mechanics_config`)),JSON.stringify(await a.one(`select * from eldervale_private.boss_fights where actor_id='wyrm'`)),JSON.stringify(await a.one(`select target,hp,x,z from eldervale_private.realm_actors where id='wyrm'`)))}
const fl=(await events('boss_flight',mark))[0];assert.equal(fl?.up,true);
const ftel=await events('boss_telegraph',mark);assert.deepEqual(ftel.map(e=>e.attack),['sweep','flight'],'sweep then landing marked');assert.ok(ftel[0].breath==='fire');
const wdata=(await a.one(`select data from eldervale_private.realm_actors where id='wyrm'`)).data;
assert.equal((await a.one(`select eldervale_private.boss_gate('wyrm',$1,100,'slash','${P}','${at(tick)}') d`,[wdata])).d,0,'melee cannot reach her in the air');
assert.equal((await a.one(`select eldervale_private.boss_gate('wyrm',$1,100,'ranged','${P}','${at(tick)}') d`,[wdata])).d,100,'ranged can');
await worldTick(7);
const land=(await events('boss_flight',mark)).find(e=>e.up===false);assert.ok(land,'she lands');
const wpos=await a.one(`select x,z from eldervale_private.realm_actors where id='wyrm'`);assert.ok(Math.abs(wpos.x-land.x)<1e-6&&Math.abs(wpos.z-land.z)<1e-6,'on the marked spot');
assert.equal((await a.one(`select flying_until from eldervale_private.boss_fights where actor_id='wyrm'`)).flying_until,null);
ok('flight: melee immune, breath sweep line, lands on the marked tiles');

// Dragon breath (a non-boss dragon) and the Breathward tonic.
await a.run(`update eldervale_private.boss_settings set config='{"breath":{"dragonChance":1}}';update eldervale_private.realm_actors set hp=0,target=null,respawn_at=null where id in ('wyrm','brood');
 insert into eldervale_private.realm_actors(id,data,x,z,hp) values('drake','{"kind":"monster","name":"Drake","template":"dragon","species":"dragon","level":75,"hp":2000,"hostile":true,"attackType":"fire","attackSpeed":3.6,"maxHit":150,"x":901.58,"z":900}',901.58,900,2000);
 update eldervale_private.realm_players set x=900,z=900 where user_id='${P}';update public.player_saves set health=99000 where user_id='${P}'`,'drake');
mark=await lastEvent();await worldTick(3);
const br=(await events('boss_breath',mark));assert.ok(br.length>=1&&br[0].element==='fire'&&br[0].mult===1,'unprotected breath');
assert.ok((await events('notice',mark)).some(e=>/anti-breath shield/.test(e.text)),'tells the player what helps');
await a.run(`set test.uid='${P}'`,'uid');
await a.one(`select eldervale_private.realm_request('${SESSION}','mech_drink','{"item":"breathwardTonic"}',gen_random_uuid(),0) r`);
assert.ok(Number((await a.one(`select breath_until from eldervale_private.boss_players where user_id='${P}'`)).breath_until)>tick+400,'tonic: ~500 ticks of breath ward');
await a.run(`update public.player_saves set equipment=equipment||'{"shield":"scalewardShield"}' where user_id='${P}';update eldervale_private.actor_mech set attack_tick=0 where id='drake';update eldervale_private.realm_players set x=-900 where user_id='${Q}';update eldervale_private.realm_actors set target='${P}' where id='drake'`,'shield');
mark=await lastEvent();await worldTick(4);
if(process.env.DEBUG)console.log(JSON.stringify(await a.one(`select eldervale_private.boss_breath_mult('${P}',${tick}) m,(select equipment from public.player_saves where user_id='${P}') e,(select breath_until from eldervale_private.boss_players) b,${tick} t`)),JSON.stringify(await events('boss_breath',mark)));
const br2=(await events('boss_breath',mark)).filter(e=>e.player===P).at(-1);assert.equal(br2?.mult,breathMultiplier({shield:'scalewardShield',potion:true},BREATH_DEFAULTS),'shield + tonic');
ok('dragon breath: unprotected warning, Breathward tonic via mech_drink, shield + tonic multiply');

// Console: owner only; list, edit (validated), enable, kills viewer/reset, item flags, settings.
await a.run(`set test.uid='${P}';set test.owner='0'`,'not owner');
await a.fails(`select eldervale_private.admin_console('console_boss','{}')`,/Owner/,'owner only');
await a.run(`set test.owner='1'`,'owner');
const con=(await a.one(`select eldervale_private.admin_console('console_boss','{}') r`)).r;
assert.equal(con.defs.length,BOSSES.length);assert.ok(con.kills.grimtusk.kills>=2);assert.ok(con.config.breath.shieldPct===15);
const edited={...bossById.grimtusk,attackTicks:4};
await a.one(`select eldervale_private.admin_console('console_boss_set',$1) r`,[JSON.stringify({id:'grimtusk',data:edited})]);
assert.equal((await a.one(`select data->>'attackTicks' t,updated_by from eldervale_private.boss_defs where id='grimtusk'`)).t,'4');
await a.fails(`select eldervale_private.admin_console('console_boss_set','{"id":"grimtusk","data":{"id":"grimtusk","name":"G","attackTicks":40}}')`,/attackTicks/,'validated');
await a.one(`select eldervale_private.admin_console('console_boss_enable','{"id":"gloom_matriarch","enabled":false}')`);assert.equal((await a.one(`select eldervale_private.boss_def('gloom_matriarch') d`)).d,null,'disabled: a plain monster again');
const kv=(await a.one(`select eldervale_private.admin_console('console_boss_kills','{"id":"grimtusk"}') r`)).r;assert.equal(kv.rows.length,2);
await a.fails(`select eldervale_private.admin_console('console_boss_kills_reset','{"id":"grimtusk"}')`,/Choose a player/,'reset needs a target');
await a.one(`select eldervale_private.admin_console('console_boss_kills_reset',$1)`,[JSON.stringify({id:'grimtusk',userId:Q})]);assert.equal((await a.one(`select kills from eldervale_private.boss_kills where user_id='${Q}'`)).kills,0);
await a.one(`select eldervale_private.admin_console('console_boss_item','{"id":"weapon:unbrokenCleaver","tradeable":false}')`);
assert.deepEqual((await a.one(`select data->'tradeable' t,data->'keepOnDeath' k from eldervale_private.realm_catalog where id='item:weapon:unbrokenCleaver'`)),{t:false,k:true});
const st=(await a.one(`select eldervale_private.admin_console('console_boss_settings','{"config":{"breath":{"shieldPct":20}}}') r`)).r;assert.equal(st.config.breath.shieldPct,20);assert.equal(st.config.breath.potionPct,30,'merged');
const tp=(await a.one(`select eldervale_private.admin_console('console_boss_teleport','{"id":"grimtusk"}') r`)).r;assert.equal(tp.ok,true);
assert.equal(Number((await a.one(`select count(*) c from eldervale_private.audit where action like 'console_boss%'`)).c),5,'audited');
ok('console: owner-only list, validated edit, enable/disable, kill-count viewer/reset, unique item flags, breath settings, teleport, audit');

// Master switch off: bosses fight as plain monsters again.
await a.run(`update eldervale_private.boss_settings set config=config||'{"enabled":false}';update eldervale_private.realm_actors set hp=3000,respawn_at=null,target=null,x=1.58,z=0 where id='grim';update eldervale_private.realm_players set x=0,z=0 where user_id='${P}';update public.player_saves set health=99000`,'off');
mark=await lastEvent();await worldTick(12);
assert.equal((await events('boss_attack',mark)).length,0);assert.ok((await events('windup',mark)).some(e=>e.side==='enemy'&&e.target==='grim'),'plain monster attacks');
ok('master switch off: the previous combat code runs');

// =========================================================== B: lairs
const B=new PGlite(),b=mk(B);
await b.run(ug,'underground fixture');
const keys=[...new Set([...dungeons,...LAIRS].map(withLair).flatMap(x=>x.spawns.map(s=>s.roster)).filter(k=>!['cinderhorn_drake','hoarscale_drake','twinflame_wyrm'].includes(k)))];
await b.run(`set check_function_bodies=off;alter table public.player_saves add column if not exists game_flags jsonb not null default '{}';
 create table eldervale_private.mech_rules(kind text,id text,data jsonb not null default '{}',enabled boolean not null default true,sort integer not null default 0,updated_at timestamptz default now(),primary key(kind,id));
 create function eldervale_private.mech_on() returns boolean language sql as $$select true$$;
 create function eldervale_private.mech_fault(place text,message text) returns void language sql as $$select$$;
 create function eldervale_private.player_unlocked(uid uuid,k text) returns boolean language sql stable as $$select coalesce((select game_flags->'unlocks'?k from public.player_saves where user_id=uid),false)$$;`,'stubs');
await B.query(`insert into eldervale_private.entities(id,revision,data) select md5('roster:'||k)::uuid,1,jsonb_build_object('kind','monster','name',k,'rosterKey',k,'level',100,'hp',3000,'respawn',600,'roam',4,'blueprint','monster-roster-v1','x',0,'z',0) from unnest($1::text[]) k`,[keys]);
for(const f of ['underground-1-engine','underground-2-content','underground-3-console'])await b.run(file('db/'+f+'.sql'),f);
await b.run(file('db/bosses-1-core.sql'),'core');
const h2=file('db/bosses-2-hooks.sql');await b.run(fnText(h2,'boss_check')+'\n'+fnText(h2,'boss_console'),'console fn');
await b.run(`select eldervale_private.patch_function((e->>0)::regprocedure,array[e->>1,e->>2]) from jsonb_array_elements($j$${JSON.stringify(hooks.filter(h=>/underground_(passages|command|check)/.test(h[0])))}$j$::jsonb) e`,'underground hooks');
for(const pass of [1,2])for(const f of ['bosses-3-lairs','bosses-4-gear'])await b.run(file('db/'+f+'.sql'),f+' pass '+pass);
ok('lairs + gear apply twice on the underground replica');

const areas=[...LAIRS,...dungeons.map(withLair).filter(x=>x.lair)];
for(const area of areas){
 for(const lv of area.levels){const js=rasterize(area,lv.level),row=await b.one(`select i0,j0,w,h,walkable,mask::text m from eldervale_private.underground_levels where area=$1 and level=$2`,[area.id,lv.level]);
  assert.ok(row,area.id+' '+lv.level);assert.deepEqual([row.i0,row.j0,row.w,row.h,row.walkable],[js.i0,js.j0,js.w,js.h,js.walkable],area.id+' '+lv.level);assert.equal(row.m,Array.from(js.mask).join(''))}
 const sql=(await b.one(`select eldervale_private.underground_passages(data) p from eldervale_private.underground_areas where id=$1`,[area.id])).p,js=passageObjects(area);
 assert.deepEqual(sql.map(p=>p.key),js.map(p=>p.key),area.id+' passages');
 for(let i=0;i<js.length;i++)for(const k of ['x','z'])assert.ok(Math.abs(sql[i][k]-js[i][k])<1e-6,area.id+' '+js[i].key);
}
ok('every lair level rasterises exactly like bosses.js + underground-data.js (6 lairs incl. the Hollow Throne)');
for(const bs of BOSSES){const r=await b.one(`select r.data->>'bossId' b,r.data->>'underground' u,r.deleted d,r.x,r.z from eldervale_private.realm_actors r where r.data->>'rosterKey'=$1 and r.data->>'blueprint'='underground-v1'`,[bs.roster]);
 assert.ok(r&&r.b===bs.id&&r.u===bs.lair.area&&!r.d,bs.id+' spawns in its lair');}
assert.equal(Number((await b.one(`select count(*) c from eldervale_private.entities where data->>'blueprint'='monster-roster-v1' and data->>'rosterKey' in ('grimtusk','hollow_king') and not deleted`)).c),0,'open-world spawns retired');
assert.equal((await b.one(`select data->'reserved' r from eldervale_private.underground_areas where id='cindervault_depths'`)).r.length,0,'the crucible is no longer reserved');
assert.equal(Number((await b.one(`select count(*) c from eldervale_private.mech_rules where kind='zone' and id like 'lair:%' and (data->>'multi')::boolean`)).c),6,'six multi-combat arenas');
ok('each boss stands in its lair arena (bossId set); overworld spawns retired; arenas are multi-combat');

// Quest gate on a lair entrance (off by default, toggled from the console).
const uid='11111111-1111-4111-8111-111111111111',sid='22222222-2222-4222-8222-222222222222';
await b.run(`insert into public.player_saves(user_id,character_name,health,max_health,skills,stats) values('${uid}','Tester',990,990,'{"combatTest":100}','{}');insert into eldervale_private.realm_players(user_id,session_id,x,z) values('${uid}','${sid}',329,-24);select set_config('test.uid','${uid}',false);select set_config('test.owner','1',false);`,'player');
const gate=await b.one(`select id::text id,data from eldervale_private.entities where id=md5('underground:bloodtusk_warhall:entrance:gate')::uuid`);
assert.equal(gate.data.passage.requires.unlock,'lair:bloodtusk_warhall');
const travel=()=>b.one(`select eldervale_private.realm_request($1,'travel',$2::jsonb,gen_random_uuid(),0) r`,[sid,JSON.stringify({target:gate.id})]);
await b.run(`update eldervale_private.realm_players set last_command=now()-interval '1 minute'`,'cool');await travel();
await b.run(`update eldervale_private.realm_players set x=329,z=-24,last_command=now()-interval '1 minute'`,'back');
await b.one(`select eldervale_private.boss_console('console_boss_lair','{"area":"bloodtusk_warhall","gate":true}')`);
await b.fails(`select eldervale_private.realm_request('${sid}','travel','{"target":"${gate.id}"}',gen_random_uuid(),0)`,/bars the way/,'gate on, no unlock');
await b.run(`update public.player_saves set game_flags='{"unlocks":{"lair:bloodtusk_warhall":{"quest":"q"}}}';update eldervale_private.realm_players set last_command=now()-interval '1 minute'`,'unlock');await travel();
// Quest-gated boss levels (on by default): only the stair down to the boss level is gated.
const passage=async key=>(await b.one(`select data->'passage' p from eldervale_private.entities where id=md5($1)::uuid`,[key]))?.p;
for(const [key,unlock] of [['underground:hollowmere_undercroft:link:throne_stair:a','lair:hollow_throne'],['underground:rimecoil_cavern:link:stair:a','lair:rimecoil_cavern'],['underground:cindervault_depths:link:crucible_stair:a','lair:cindervault_crucible'],['underground:gloomweb_nest:link:chute:a','lair:gloomweb_nest']]){
 const p=await passage(key);assert.ok(p,key);assert.equal(p.requires.unlock,unlock);assert.equal(p.requires.gate,true,key+' gated by default')}
assert.equal((await passage('underground:rimecoil_cavern:entrance:cleft')).requires.unlock,undefined,'the Rimecoil galleries stay open');
assert.equal((await passage('underground:cindervault_depths:link:descent:a')).requires,null,'Molten heart stays open');
const stair=await b.one(`select id::text id,data from eldervale_private.entities where id=md5('underground:cindervault_depths:link:crucible_stair:a')::uuid`);
await b.run(`update public.player_saves set game_flags='{}';update eldervale_private.realm_players set x=${stair.data.x},z=${stair.data.z},last_command=now()-interval '1 minute'`,'to the crucible stair');
await b.fails(`select eldervale_private.realm_request('${sid}','travel','{"target":"${stair.id}"}',gen_random_uuid(),0)`,/bars the way/,'crucible locked without the unlock');
await b.run(`update public.player_saves set game_flags='{"unlocks":{"lair:cindervault_crucible":{}}}'`,'unlock crucible');
await b.one(`select eldervale_private.realm_request($1,'travel',$2::jsonb,gen_random_uuid(),0) r`,[sid,JSON.stringify({target:stair.id})]);
ok('lair gates: lairs without a quest unlock stay open (console switch); the Hollow Throne, Glacier heart and Crucible stairs need their quest unlock');

// Catalog, loot and recipes.
const cat=Object.fromEntries((await b.all(`select id,data from eldervale_private.realm_catalog where id like '%:%'`)).map(r=>[r.id,r.data]));
for(const u of UNIQUE_ITEMS){const it=cat['item:'+u.catalogId],d=cat[u.catalogId];assert.ok(it&&d,u.id);assert.equal(it.shopless,true);assert.equal(it.tradeable,u.tradeable);assert.equal(!!it.keepOnDeath,!u.tradeable);assert.deepEqual(d.bonuses,u.bonuses)}
for(const q of QUEST_REWARD_ITEMS)assert.equal(cat['item:'+q].tradeable,false,q+' untradeable');
const drops=Object.fromEntries((await b.all(`select id,data from eldervale_private.mech_rules where kind='drops'`)).map(r=>[r.id,r.data]));
for(const bs of BOSSES)assert.deepEqual(drops[bs.roster],bossDrops(bs),bs.id+' loot');
assert.ok(drops.cinderhorn_drake.tertiary.some(t=>t.item==='armor:wyrmscaleJerkin'),'dragon-only drops');
assert.ok((await b.one(`select data from eldervale_private.skill_recipes where id='smith_unique_scalewardShield'`)).data.outputs['shield:scalewardShield']===1);
ok(`catalog: ${UNIQUE_ITEMS.length} uniques with flags and bonuses; boss + dragon loot tables; Scaleward Shield and tonic recipes`);
console.log('ALL BOSS CHECKS PASSED ('+n+')');
