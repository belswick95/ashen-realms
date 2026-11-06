// Behavioural check of db/quests-v2.sql + db/quests-v2-sample.sql on PGlite (real Postgres in WASM).
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node scripts/quests-v2-db/check.mjs
// (or PGLITE=/path/to/node_modules/@electric-sql/pglite/dist/index.js node scripts/quests-v2-db/check.mjs)
// Schema: the castle-tutorial replica, then the LIVE text of every function v2 patches
// (live-functions.json, md5-verified against live read-only), then the v2 files twice (idempotent).
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE||'@electric-sql/pglite');
const repo=new URL('../..',import.meta.url).pathname;
const db=new PGlite();
const run=async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message);throw e}};
const one=async(sql,params=[])=>(await db.query(sql,params)).rows[0];
const ok=m=>console.log('ok',m);

await run(readFileSync(repo+'scripts/castle-tutorial-db/fixture.sql','utf8'),'castle fixture');
await run(readFileSync(repo+'db/castle-tutorial.sql','utf8'),'castle-tutorial');
await run(readFileSync(repo+'db/castle-tutorial-seed.sql','utf8'),'castle seed');
await run(readFileSync(repo+'db/quest-journal-rewards.sql','utf8'),'quest journal');
await run(readFileSync(new URL('./fixture.sql',import.meta.url),'utf8'),'v2 fixture');
const live=JSON.parse(readFileSync(new URL('./live-functions.json',import.meta.url),'utf8'));
for(const [name,def] of Object.entries(live))if(name[0]!=='_')await run(def,'live '+name);
for(let pass=1;pass<=2;pass++){
 await run(readFileSync(repo+'db/quests-v2.sql','utf8'),'quests-v2 pass '+pass);
 await run(readFileSync(repo+'db/quests-v2-sample.sql','utf8'),'sample pass '+pass);
}
for(const [fn,marker] of [['realm_request_before_stories','quest_v2_request'],['quest_event','quest_v2_autoadvance'],['quest_refresh','quest_v2_objectives'],['admin_action','quest_v2_admin']]){
 const d=(await one(`select pg_get_functiondef(p.oid) d from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eldervale_private' and p.proname=$1`,[fn])).d;
 assert.equal(d.split(marker).length-1,fn==='realm_request_before_stories'?1:fn==='admin_action'?1:fn==='quest_refresh'?1:1,fn+' patched once');
}
ok('live functions patched once; second pass is a no-op');
const Q='5b1e7a2c-3d4f-4e8a-9c0b-1f2e3d4c5b6a',MAUD='96d6414a-90ce-4080-8515-adc6b4db298b',CORIN='8e1013ae-c555-4aff-a4ba-8425fb7a290a',JORY='d1b26173-cd94-4a4f-be5f-7a4d4afa7ad8';
assert.equal((await one(`select count(*)::int n from eldervale_private.quest_definitions where id=$1`,[Q])).n,1);
assert.equal((await one(`select version from eldervale_private.quest_definitions where id=$1`,[Q])).version,1,'sample seeded once');
ok('sample quest seeded once');

// ---- a player
const U='33333333-3333-4333-8333-333333333333',SID='44444444-4444-4444-8444-444444444444',OWNER='91c5b7f0-7018-4290-a190-c2bba0ca492d';
await db.query(`insert into public.player_saves(user_id,character_name,game_flags,skills,stats) values($1,'Tamsin','{"tutorial":{"active":false,"done":false}}','{"craftingXP":0}','{}')`,[U]);
await db.query(`insert into eldervale_private.realm_players(user_id,session_id,x,z) values($1,$2,-185,124)`,[U,SID]);
const as=async uid=>db.exec(`select set_config('test.uid','${uid}',false)`);
await as(U);
const cmd=async(command,payload={})=>(await one(`select eldervale_private.realm_request_before_stories($1,$2,$3,gen_random_uuid(),0) r`,[SID,command,payload])).r;
const fails=async(command,payload,re)=>assert.rejects(()=>cmd(command,payload),e=>{assert.match(e.message,re);return true});
const at=(x,z)=>db.query(`update eldervale_private.realm_players set x=$2,z=$3 where user_id=$1`,[U,x,z]);
const row=async()=>(await one(`select progress,completed_at from eldervale_private.player_quests where user_id=$1 and quest_id=$2`,[U,Q]));

let r=await cmd('sync');assert.equal(r.questState.qp,0);
await fails('quest_accept',{id:Q},/You need: Complete .*Graduation.*5 Quest Points|You need: Complete/);
ok('requirements block the start (quest + QP)');
await db.query(`update public.player_saves set game_flags='{"tutorial":{"active":false,"done":true}}' where user_id=$1`,[U]);
r=await cmd('sync');assert.equal(r.questState.qp,8,'graduated: 8 tutorial quest points');
ok('quest points: finished training counts 8 QP (test vector)');
r=await cmd('quest_accept',{id:Q});
let p=await row();assert.equal(p.progress._stage,'lamplighter');assert.deepEqual(p.progress._done,[]);
const snap=r.quests.find(q=>q.id===Q);assert.equal(snap.accepted,true);assert.equal(snap.progress._stage,'lamplighter');
ok('accepted: first stage entered');

// Stage 1 → 2: a talk event advances on its own (no report NPC).
await db.query(`insert into eldervale_private.realm_events(data) values($1)`,[{type:'interaction',kind:'npc',target:CORIN,player:U}]);
p=await row();assert.equal(p.progress._stage,'errand-boy');assert.deepEqual(p.progress._done,['lamplighter']);assert.equal(p.progress['0'],undefined,'counts reset on a new stage');
ok('talk objective completes stage 1 and auto-advances');

// Stage 2: report to Jory with a choice.
await at(-222,91);
await fails('quest_choice',{id:Q,choice:'keep-secret'},/not finished this part/);
await db.query(`insert into eldervale_private.realm_events(data) values($1)`,[{type:'interaction',kind:'npc',target:JORY,player:U}]);
p=await row();assert.equal(p.progress._stage,'errand-boy','stage with a choice waits for the player');
await fails('quest_advance',{id:Q},/Decide what to do first/);
await fails('quest_choice',{id:Q,choice:'bribe'},/Choose one of the options/);
await at(-185,124);await fails('quest_choice',{id:Q,choice:'keep-secret'},/in person/);await at(-222,91);
r=await cmd('quest_choice',{id:Q,choice:'keep-secret'});
p=await row();assert.equal(p.progress._stage,'new-strap');assert.equal(p.progress._flags.kept_secret,true);assert.equal(p.progress._flags['choice.errand-boy'],'keep-secret');
assert.deepEqual(p.progress._done,['lamplighter','errand-boy']);
ok('branching choice sets flags and moves to the final stage');
r=await cmd('quest_cutscene',{id:Q,cutscene:'bell-strap'});p=await row();assert.deepEqual(p.progress._seen,['bell-strap']);
await cmd('quest_cutscene',{id:Q,cutscene:'bell-strap'});p=await row();assert.deepEqual(p.progress._seen,['bell-strap'],'cutscene recorded once');
ok('cutscene hook recorded');

// Final stage: hand in leather at the giver.
await at(-185,124);
await fails('quest_complete',{id:Q},/Finish every objective/);
await db.query(`update public.player_saves set stats=stats||'{"leather":2}' where user_id=$1`,[U]);
r=await cmd('quest_complete',{id:Q});
p=await row();assert.ok(p.completed_at,'completed');assert.deepEqual(p.progress._done,['lamplighter','errand-boy','new-strap']);
const s=await one(`select stats,skills,gold,game_flags from public.player_saves where user_id=$1`,[U]);
assert.equal(s.stats.leather,1,'one leather handed in');assert.equal(s.stats.custom_morning_bell_charm,1,'keepsake given');assert.equal(Number(s.gold),120);assert.equal(s.skills.craftingXP,1200);
assert.ok(s.game_flags.unlocks['teleport.morning-bell']&&s.game_flags.unlocks['dialogue.maud-bell']&&s.game_flags.unlocks['dialogue.jory-secret']);
assert.equal(s.game_flags.unlocks['dialogue.jory-truth'],undefined,'branch dialogue filtered by flags');
assert.equal(s.game_flags.questFlags['birchford.bell_mended'],true);assert.equal(s.game_flags.questFlags['birchford-flat-bell.kept_secret'],true);
assert.equal(s.game_flags.questLamps.length,1);assert.equal(r.questState.qp,9);
assert.equal((await one(`select eldervale_private.player_unlocked($1,'teleport.morning-bell') v`,[U])).v,true);
assert.equal((await one(`select eldervale_private.quest_flag($1,'birchford-flat-bell.kept_secret') v`,[U])).v,true);
ok('completion: XP, items, coins, QP, unlocks (flag-filtered), world flags, pending lamp');

// XP lamp: perLevel 10 × chosen level; minimum level 5.
const lamp=s.game_flags.questLamps[0];
await fails('quest_lamp',{key:lamp.key,skill:'agility'},/at least 5/);
await fails('quest_lamp',{key:lamp.key,skill:'sailing'},/skill this lamp/);
r=await cmd('quest_lamp',{key:lamp.key,skill:'crafting'});
const lvl=(await one(`select eldervale_private.xp_level(1200) l`)).l;
let s2=await one(`select skills,game_flags from public.player_saves where user_id=$1`,[U]);
assert.equal(s2.skills.craftingXP,1200+10*lvl,'lamp = 10 × level');assert.equal(s2.game_flags.questLamps.length,0);
await fails('quest_lamp',{key:lamp.key,skill:'crafting'},/already been used/);
ok('XP lamp: level '+lvl+' crafting gave '+10*lvl+' XP, lamp used up');

// Teleport unlock.
await at(0,0);r=await cmd('quest_teleport',{id:'teleport.morning-bell'});
let pos=await one(`select x,z,floor from eldervale_private.realm_players where user_id=$1`,[U]);assert.deepEqual([pos.x,pos.z,pos.floor],[-185,129.5,0]);
await fails('quest_teleport',{id:'teleport.morning-bell'},/recharge/);
await fails('quest_teleport',{id:'teleport.nowhere'},/not unlocked/);
ok('teleport unlock works with a recharge');

// Test vector: non-boostable skill gate (base level 28 < 30).
const gate={requirements:{skills:{agility:{level:30,boostable:false}}}};
await db.query(`update public.player_saves set skills=skills||'{"agilityXP":11000}' where user_id=$1`,[U]);
const miss=(await one(`select eldervale_private.quest_v2_missing($1,$2) m`,[U,gate])).m;
assert.equal((await one(`select eldervale_private.xp_level(11000) l`)).l,28);assert.deepEqual(miss,['Level 30 Agility']);
ok('agility 28 cannot start an Agility 30 quest (test vector)');

// Legacy quest unchanged: talk objective, hand in.
const L='66666666-6666-4666-8666-666666666666';
await db.query(`insert into eldervale_private.quest_definitions(id,data) values($1,$2)`,[L,{name:'Old style',description:'x',giver:MAUD,published:true,objectives:[{type:'talk',target:CORIN,amount:1}],gold:5}]);
await at(-185,124);await cmd('quest_accept',{id:L});
await db.query(`insert into eldervale_private.realm_events(data) values($1)`,[{type:'interaction',kind:'npc',target:CORIN,player:U}]);
await cmd('quest_complete',{id:L});assert.ok((await one(`select completed_at from eldervale_private.player_quests where user_id=$1 and quest_id=$2`,[U,L])).completed_at);
ok('quests without v2 fields behave as before');

// ---- owner console
await as(OWNER);
const admin=async(command,payload={})=>(await one(`select eldervale_private.admin_action($1,$2) r`,[command,payload])).r;
const adminFails=async(command,payload,re)=>assert.rejects(()=>admin(command,payload),e=>{assert.match(e.message,re);return true});
let st=await admin('qv2_player_state',{userId:U});assert.equal(st.state.qp,10);assert.ok(st.quests.find(q=>q.id===Q).completed);
await admin('qv2_set_stage',{userId:U,id:Q,stage:'errand-boy'});p=await row();assert.equal(p.progress._stage,'errand-boy');assert.equal(p.completed_at,null);
await admin('qv2_set_flags',{userId:U,id:Q,flags:{kept_secret:null,told_truth:true}});p=await row();assert.equal(p.progress._flags.told_truth,true);assert.equal(p.progress._flags.kept_secret,undefined);
await admin('qv2_reset',{userId:U,id:Q});p=await row();assert.equal(p.progress._reset,true);
s2=await one(`select game_flags from public.player_saves where user_id=$1`,[U]);assert.equal(s2.game_flags.unlocks['teleport.morning-bell'],undefined,'reset takes back the quest unlocks');
ok('console inspector: state, set stage, set flags, reset');
const base={name:'Loop test',description:'d',giver:MAUD,objectives:[],stages:[{id:'a',journal:'A',objectives:[{type:'talk',target:CORIN,amount:1}],next:'b'},{id:'b',journal:'B',next:'a'}]};
await adminFails('fc_quest_save',{data:base},/loop forever/);
await adminFails('fc_quest_save',{data:{...base,stages:[{id:'a',journal:'A',objectives:[{type:'collect',target:'leather',amount:1}]},{id:'b',journal:'B',objectives:[{type:'talk',target:CORIN,amount:1}]}]}},/need an NPC to hand them to/);
await adminFails('fc_quest_save',{data:{...base,stages:[{id:'a',journal:'A',objectives:[{type:'talk',target:'nobody',amount:1}]}]}},/Stage a: Objective 1/);
await adminFails('fc_quest_save',{data:{...base,stages:[{id:'a',journal:'A',objectives:[{type:'talk',target:CORIN,amount:1}]}],lamps:[{amount:5,perLevel:3}]}},/fixed amount or an amount per level/);
const saved=await admin('fc_quest_save',{data:{...base,stages:[{id:'a',journal:'A',objectives:[{type:'talk',target:CORIN,amount:1}]},{id:'b',journal:'B',objectives:[{type:'collect',target:'leather',amount:1}]}],requirements:{qp:2},unlocks:[{type:'shop',id:'shop.bell-stock',label:'Bell shop'}]}});
assert.equal(saved.data.objectives.length,0);assert.equal(saved.data.stages.length,2);
assert.deepEqual(await admin('fc_quest_save',{data:{name:'Plain',description:'d',giver:MAUD,objectives:[{type:'talk',target:CORIN,amount:1}]}}),{fc:'fc_quest_save'},'classic saves keep the old path');
await admin('qv2_guidance_set',{value:{trail:true,length:18}});assert.deepEqual(await admin('qv2_guidance_get'),{trail:true,length:18});
await adminFails('qv2_guidance_set',{value:{length:400}},/length 6–40/);
await as(U);r=await cmd('sync');assert.equal(r.questState.guidance.length,18);
ok('console saves validate v2 quests (loops, hand-ins, stage objectives, lamps); guidance settings reach players');

// Guidance tiles.
await db.query(`insert into eldervale_private.tile_flags(floor,i,j,flags,door_bits,door) values(0,1,1,1,0,null),(0,2,1,0,4,'door-1'),(0,90,90,1,0,null)`);
const tiles=(await one(`select public.quest_guide_tiles(1.6,1.6,8) t`)).t;
assert.deepEqual(tiles.center,[1,1]);assert.deepEqual(tiles.tiles.map(t=>t.slice(0,2)).sort(),[[1,1],[2,1]]);assert.equal(tiles.tiles.find(t=>t[0]===2)[2],4,'closed door edge reported');
await as('');await assert.rejects(()=>one(`select public.quest_guide_tiles(0,0,8)`),/Sign in/);
ok('guidance tile feed: nearby flags with doors, signed-in players only');
console.log('all quest v2 checks passed');
