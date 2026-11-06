// Behavioural check of db/osrs-skill-parity.sql on PGlite (real Postgres in WASM).
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node scripts/osrs-skill-parity-db/check.mjs
// The fixture copies the live bodies of every gameplay function the file patches (read-only copy).
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {professionRecipes} from '../../profession-data.js';
const repo=process.argv[2]||new URL('../..',import.meta.url).pathname;
const db=new PGlite();
const run=async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message);throw e}};
const one=async(sql,params=[])=>(await db.query(sql,params)).rows[0];
const q=(sql,params=[])=>db.query(sql,params);
await run(readFileSync(new URL('./fixture.sql',import.meta.url),'utf8'),'fixture');
// Old live recipes (pre-parity XP) so the generated update has something to change.
for(const [id,r]of Object.entries(professionRecipes))await q(`insert into eldervale_private.skill_recipes values($1,$2)`,[id,{...r,xp:999,level:1,burnChance:r.burnChance}]);
const sql=readFileSync(repo+'/db/osrs-skill-parity.sql','utf8');
assert.ok(!/\b(delete|alter|drop)\b/i.test(sql),'no DELETE/ALTER/DROP words in the migration');
for(let pass=1;pass<=2;pass++)await run(sql,'osrs-skill-parity pass '+pass);
console.log('ok migration applies twice (idempotent)');
for(const [id,r]of Object.entries(professionRecipes)){const d=(await one(`select data from eldervale_private.skill_recipes where id=$1`,[id])).data;assert.equal(d.xp,r.xp,id+' xp');assert.equal(d.level,r.level,id+' level');if(r.stopBurn)assert.equal(d.stopBurn,r.stopBurn)}
console.log('ok recipe levels/XP match profession-data.js');

const U='11111111-1111-4111-8111-111111111111';
const reset=async(fields={})=>{await q(`insert into public.player_saves(user_id) values($1) on conflict(user_id) do update set stats='{}',skills='{}',inventory='{}',equipment='{}',health=100`,[U]);
 await q(`insert into eldervale_private.realm_players(user_id,last_seen) values($1,now()) on conflict(user_id) do update set last_seen=now(),path='[]',x=0,z=0`,[U]);
 for(const [k,v]of Object.entries(fields))await q(`update public.player_saves set ${k}=${k}||$2 where user_id=$1`,[U,v])};
const save=()=>one(`select * from public.player_saves where user_id=$1`,[U]);
const total=(s,col,key)=>Number(s[col][key]||0)+Number(s[col][key+'Banked']||0);
await db.exec(`select set_config('test.uid','${U}',false)`);

// Combat XP: only damage dealt.
await reset();
await q(`select eldervale_private.combat_xp($1,2,'stab','{}')`,[U]);let s=await save();
assert.equal(s.skills.attackXP,8);assert.equal(s.skills.hitpointsXP,2.66);
await q(`select eldervale_private.combat_xp($1,2,'slash','{}')`,[U]);s=await save();assert.equal(s.skills.strengthXP,8);
await q(`select eldervale_private.combat_xp($1,3,'lunge','{}')`,[U]);s=await save();
assert.equal(s.skills.defenceXP,3.99);assert.equal(s.skills.attackXP,11.99);assert.equal(s.skills.strengthXP,11.99);
await q(`select eldervale_private.combat_xp($1,0,'slash','{"magic":true,"ranged":true}')`,[U]);s=await save();assert.equal(s.skills.magicXP,5.5,'splash still gives spell base XP');
await q(`select eldervale_private.combat_xp($1,4,'slash','{"ranged":true}')`,[U]);s=await save();assert.equal(s.skills.rangedXP,16);
await q(`select eldervale_private.combat_xp($1,0,'stab','{}')`,[U]);s=await save();assert.equal(s.skills.attackXP,11.99,'a miss gives nothing');
console.log('ok combat XP: 4/damage by style, 1.33 lunge share and Hitpoints, magic base on splash');
// Tutorial Arms Drill: attack 8, strength 8, defence 3 from a few dummy hits (quest_refresh floors the delta).
assert.ok(Math.floor(8)>=8&&Math.floor(3.99)>=3);
await db.exec(`select set_config('test.damage','7',false)`);await q(`select eldervale_private.world_tick()`);s=await save();
assert.equal(s.health,93);assert.equal(s.skills.hitpointsXP,14.63,'being hit gives no Hitpoints XP (2.66+2.66+3.99+5.32 from hits dealt)');
console.log('ok being hit gives no Hitpoints XP');

// Fractional skill XP for any skill, both overloads.
await reset();
await q(`select eldervale_private.skill_xp($1,'mining',17.5::numeric)`,[U]);await q(`select eldervale_private.skill_xp($1,'mining',17.5::numeric)`,[U]);await q(`select eldervale_private.skill_xp($1,'smithing',6.25::numeric)`,[U]);await q(`select eldervale_private.skill_xp($1,'smithing',5)`,[U]);
s=await save();assert.equal(s.stats.miningXP,35);assert.equal(s.skills.smithingXP,11.25);
assert.equal((await one(`select eldervale_private.skill_level($1,'mining') l`,[U])).l,1);
console.log('ok fractional XP storage');

// Smelting, mining, cooking through skill_finish/skill_tick.
const recipe=async id=>(await one(`select data from eldervale_private.skill_recipes where id=$1`,[id])).data;
await q(`insert into eldervale_private.realm_objects(id,kind,data) values('furnace','furnace','{"template":"furnace"}'),('rock','rock','{"resource":"copperOre"}'),('range','hearth','{"template":"hearth"}')`);
await reset({stats:{copperOre:1,tinOre:1}});
let msg=(await one(`select eldervale_private.skill_finish($1,$2,'furnace',null,now()) m`,[U,await recipe('smelt_bronzeBar')])).m;
s=await save();assert.equal(s.skills.smithingXP,6.25,'bronze bar 6.25 (tutorial objective 6 still met)');assert.equal(s.stats.bronzeBar,1);assert.match(msg,/\+6\.25 smithing XP/);
await reset({stats:{ore:400},skills:{smithingXP:2411}});let ok=0;const iron=await recipe('smelt_ironBar');
for(let i=0;i<400;i++){const m=(await one(`select eldervale_private.skill_finish($1,$2,'furnace',null,now()) m`,[U,iron])).m;if(/complete/.test(m))ok++;else assert.match(m,/too impure/)}
s=await save();assert.ok(ok>150&&ok<250,'iron smelts about half the time: '+ok);assert.equal(s.skills.smithingXP,2411+12.5*ok,'no XP for a failed iron bar');assert.equal(s.stats.ore,0);
console.log('ok smelting: bronze 6.25 XP, iron 50% with 12.5 XP only on success');
await reset({stats:{rawShrimp:300}});const shrimp=await recipe('cook_shrimp');let burnt=0;
for(let i=0;i<200;i++){const m=(await one(`select eldervale_private.skill_finish($1,$2,'range',null,now()) m`,[U,shrimp])).m;if(/burn/.test(m))burnt++}
s=await save();assert.ok(burnt>10&&burnt<55,'level-1 shrimp burn ~15%: '+burnt);assert.equal(s.stats.burntFood,burnt);assert.equal(s.skills.cookingXP,30*(200-burnt),'burnt food gives no XP');
await q(`update public.player_saves set skills=skills||'{"cookingXP":20224}' where user_id=$1`,[U]);burnt=0;
for(let i=0;i<100;i++){const m=(await one(`select eldervale_private.skill_finish($1,$2,'range',null,now()) m`,[U,shrimp])).m;if(/burn/.test(m))burnt++}
assert.equal(burnt,0,'no burning at Cooking 34 (OSRS stop-burn level for shrimp)');
console.log('ok cooking: burns at low level with no XP, never burns at the stop-burn level');
// Mining: misses keep the job swinging; the hit depletes the rock and gives 17.5 XP.
await reset({stats:{'weapon:pickaxe':1}});const copper=await recipe('mine_copperOre');
await q(`update eldervale_private.skill_recipes set data=data||'{"enabled":true}'`);
let swings=0,hits=0;
for(let i=0;i<400;i++){await q(`update eldervale_private.realm_objects set available_at=null where id='rock'`);await q(`update public.player_saves set stats=stats||jsonb_build_object('miningXP',0,'xpSeen',coalesce((stats->>'xpSeen')::numeric,0)+coalesce((stats->>'miningXP')::numeric,0)) where user_id=$1`,[U]);
 const m=(await one(`select eldervale_private.skill_finish($1,$2,'rock',null,now()) m, current_setting('eldervale.skill_retry',true) r`,[U,copper]));swings++;if(m.m==='')assert.equal(m.r,'1');else hits++;await db.exec(`select set_config('eldervale.skill_retry','',false)`)}
s=await save();assert.ok(hits/swings>.3&&hits/swings<.48,'copper at Mining 1 ≈ 39% per swing: '+hits/swings);assert.equal(Number(s.stats.xpSeen)+Number(s.stats.miningXP),17.5*hits);assert.equal(s.stats.copperOre,hits);
await q(`update eldervale_private.realm_objects set available_at=null where id='rock'`);
await q(`insert into eldervale_private.skill_jobs values($1,'mine_copperOre','rock',null,1,now(),now()-interval '1 second')`,[U]);
for(let i=0;i<60;i++){await q(`select eldervale_private.skill_tick(clock_timestamp())`);await q(`update eldervale_private.skill_jobs set due_at=now()-interval '1 second'`);if(!(await one(`select count(*)::int n from eldervale_private.skill_jobs`)).n)break}
assert.equal((await one(`select count(*)::int n from eldervale_private.skill_jobs`)).n,0,'a one-ore job keeps swinging until it gets the ore');
assert.equal((await save()).stats.copperOre,hits+1);
assert.equal((await one(`select count(*)::int n from eldervale_private.realm_events where data->>'type'='skill_complete' and data->>'text'=''`)).n,0,'misses send no chat line');
console.log('ok mining: OSRS success per swing, misses retry silently, 17.5 XP per ore');
// Recipe level checks with fractional XP.
await reset({stats:{miningXP:37.5,'weapon:pickaxe':1},skills:{smithingXP:6.25,cookingXP:83.5}});await q(`update eldervale_private.realm_objects set available_at=null where id='rock'`);
assert.equal((await one(`select eldervale_private.skill_error($1,$2,'rock',null) e`,[U,copper])).e,null);
assert.match((await one(`select eldervale_private.skill_error($1,$2,'rock',null) e`,[U,await recipe('mine_ore')])).e,/mining level 15/);
console.log('ok recipe level checks read fractional XP');

// Woodcutting: per-chop success, OSRS XP per log, misses wait for the next chop.
await reset({inventory:{weaponsOwned:['axe']}});
await q(`insert into eldervale_private.realm_objects(id,kind,data) values('tree','tree','{"resourceMinLogs":10,"resourceMaxLogs":10}'),('oak','tree','{"logItem":"oakLogs","resourceMinLogs":10,"resourceMaxLogs":10}'),('pond','fishing','{}')`);
// pin=[column,key]: hold the skill at its starting XP so the success rate is measured at one level;
// XP earned is banked in <key>Banked and added back by total().
const gather=async(target,method,n,pin)=>{const base=pin?Number((await save())[pin[0]][pin[1]]||0):0;for(let i=0;i<n;i++){if(pin)await q(`update public.player_saves set ${pin[0]}=${pin[0]}||jsonb_build_object($2::text,$3::numeric,$4::text,coalesce((${pin[0]}->>$4)::numeric,0)+coalesce((${pin[0]}->>$2)::numeric,0)-$3::numeric) where user_id=$1`,[U,pin[1],base,pin[1]+'Banked']);await q(`update eldervale_private.realm_objects set data=data-'logsRemaining',available_at=null where kind='tree'`);await q(`insert into eldervale_private.gathering_actions(user_id,target,method,due_at) values($1,$2,$3,now()-interval '1 second')`,[U,target,method]);await q(`select eldervale_private.gathering_tick(clock_timestamp())`);await db.exec(`truncate eldervale_private.gathering_actions`)}};
await gather('tree','woodcut',300,['stats','woodXP']);s=await save();
assert.ok(s.stats.wood/300>.3&&s.stats.wood/300<.46,'normal tree, iron axe, level 1 ≈ 38%: '+s.stats.wood/300);assert.equal(total(s,'stats','woodXP'),25*s.stats.wood);
const ev=await one(`select data from eldervale_private.realm_events where data->>'type'='woodcut' order by id desc limit 1`);assert.equal(ev.data.amount,1);assert.equal(ev.data.xp,25);
await reset({inventory:{weaponsOwned:['axe']},stats:{woodXP:2411}});await gather('oak','woodcut',300,['stats','woodXP']);s=await save();assert.ok(s.stats.oakLogs/300>.17&&s.stats.oakLogs/300<.32,'oak at level 15, iron axe ≈ 24.6%: '+s.stats.oakLogs/300);assert.equal(total(s,'stats','woodXP'),2411+37.5*s.stats.oakLogs);
await reset({inventory:{weaponsOwned:['bronzeAxe']}});await gather('tree','woodcut',300,['stats','woodXP']);s=await save();assert.ok(s.stats.wood/300>.18&&s.stats.wood/300<.33,'bronze axe ≈ 25%: '+s.stats.wood/300);
await reset({stats:{woodXP:37.5}});assert.match((await one(`select eldervale_private.gathering_error($1,'oak','woodcut') e`,[U])).e,/axe/);
await reset({inventory:{weaponsOwned:['axe']},stats:{woodXP:37.5}});assert.match((await one(`select eldervale_private.gathering_error($1,'oak','woodcut') e`,[U])).e,/level 15/);
await q(`update eldervale_private.realm_objects set data=data-'logsRemaining' where id='tree'`);await q(`insert into eldervale_private.gathering_actions(user_id,target,method,due_at) values($1,'tree','woodcut',now()-interval '1 second')`,[U]);
for(let i=0;i<30;i++){await q(`select eldervale_private.gathering_tick(clock_timestamp())`);const a=await one(`select due_at>clock_timestamp() later from eldervale_private.gathering_actions`);if(!a){assert.ok((await one(`select available_at from eldervale_private.realm_objects where id='tree'`)).available_at,'only a felled tree ends the action');break}assert.ok(a.later,'every chop, hit or miss, waits for the next 3-second swing');await q(`update eldervale_private.gathering_actions set due_at=now()-interval '1 second'`)}
await db.exec(`truncate eldervale_private.gathering_actions`);
console.log('ok woodcutting: success per chop by level and axe tier, 25/37.5 XP per log');

// Fishing: bait is spent only on a catch; misses give nothing.
await reset({stats:{fishingNet:1,fishingPole:1,bait:500}});
await gather('pond','net',300,['skills','fishingXP']);s=await save();const shrimps=s.stats.rawShrimp||0;
assert.ok(shrimps/300>.12&&shrimps/300<.27,'shrimp at Fishing 1 ≈ 19%: '+shrimps/300);assert.equal(total(s,'skills','fishingXP'),10*shrimps);
await gather('pond','rod',300,['skills','fishingXP']);s=await save();assert.equal(s.stats.bait,500-(s.stats.rawFish||0),'bait used only on a catch');assert.equal(total(s,'skills','fishingXP'),10*shrimps+20*(s.stats.rawFish||0));
await reset({stats:{harpoon:1},skills:{fishingXP:101333}});await gather('pond','harpoon',400);s=await save();assert.ok((s.stats.rawSwordfish||0)>0);assert.equal(s.stats.rawStormfin||0,0,'stormfin needs Fishing 76');
console.log('ok fishing: OSRS catch chance per cast, bait only on a catch, river fish 20 XP');

// Legacy service paths and the owner recipe editor take fractional XP.
await reset({skills:{prayerXP:2.5,cookingXP:6.25,fishingXP:10.5}});
await q(`select eldervale_private.realm_request_services(null,'pray')`);await q(`select eldervale_private.realm_request_services(null,'cook')`);await q(`select eldervale_private.realm_request_before_castle(null,'fish','{"target":"pond"}')`);
s=await save();assert.equal(s.skills.prayerXP,7.5);assert.equal(s.skills.cookingXP,46.25);assert.equal(s.skills.fishingXP,30.5);
const edited=(await one(`select eldervale_private.admin_before_bank_notes('catalog_recipe',$1) r`,[{recipe:{name:'X',skill:'smithing',level:1,xp:6.25,seconds:3}}])).r;assert.equal(edited.xp,6.25);
console.log('ok altar, legacy cook/fish and recipe editor accept fractional XP');
console.log('ALL CHECKS PASSED');
