// Behavioural check of db/castle-tutorial.sql + seed on PGlite (real Postgres in WASM).
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node scripts/castle-tutorial-db/check.mjs
// Runs db/castle-tutorial.sql + seed + db/quest-journal-rewards.sql against a local PGlite replica of the touched schema.
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const repo=process.argv[2]||new URL('../..',import.meta.url).pathname;
const db=new PGlite();
const run=async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message);throw e}};
const one=async(sql,params=[])=>(await db.query(sql,params)).rows[0];
await run(readFileSync(new URL('./fixture.sql',import.meta.url),'utf8'),'fixture');
for(let pass=1;pass<=2;pass++){
 await run(readFileSync(repo+'/db/castle-tutorial.sql','utf8'),'castle-tutorial pass '+pass);
 await run(readFileSync(repo+'/db/castle-tutorial-seed.sql','utf8'),'seed pass '+pass);
 await run(readFileSync(repo+'/db/quest-journal-rewards.sql','utf8'),'quest journal pass '+pass);
}
const OWNER='91c5b7f0-7018-4290-a190-c2bba0ca492d',NEW='22222222-2222-4222-8222-222222222222';
const as=async uid=>db.exec(`select set_config('test.uid','${uid}',false)`);
// 1. migration
for(const row of (await db.query(`select character_name,game_flags->'tutorial' t from public.player_saves`)).rows){assert.equal(row.t.done,true,row.character_name);assert.equal(row.t.migrated,true)}
console.log('ok existing players marked complete');
{const snap=(await one(`select eldervale_private.quest_snapshot($1) s`,['91c5b7f0-7018-4290-a190-c2bba0ca492d'])).s;assert.equal(snap.length,8,'migrated players still list the starter quests');assert.ok(snap.every(q=>q.accepted&&q.completed),'migrated players see every starter quest as completed');assert.deepEqual(snap.map(q=>q.data.order),[1,2,3,4,5,6,7,8]);}
console.log('ok journal: migrated players see the starter quests as completed (green)');
const qv=await one(`select count(*)::int n,max(version) v from eldervale_private.quest_definitions`);assert.equal(qv.n,8);assert.equal(qv.v,1,'re-running seed keeps versions');
console.log('ok seed idempotent (8 quests, version 1)');
// 2. new player
await as(NEW);
const entered=(await one(`select eldervale_private.enter_world('{"body":1}') r`)).r;
assert.equal(entered.save.game_flags.tutorial.active,true);assert.deepEqual([entered.save.world_position.x,entered.save.world_position.y],[-340,-290]);
const sid=entered.session;console.log('ok new player starts in castle with tutorial active');
const cmd=async(command,payload={})=>(await one(`select eldervale_private.realm_request_before_stories($1,$2,$3,gen_random_uuid(),0) r`,[sid,command,payload])).r;
const fails=async(command,payload,msg)=>{await assert.rejects(()=>cmd(command,payload),e=>{assert.match(e.message,msg);return true})};
let r=await cmd('sync');assert.equal(r.quests.length,8);assert.equal(r.tutorial.active,true);
// 3. cutscene
r=await cmd('tutorial_cutscene',{id:'arrival'});let p=await one(`select x,z from eldervale_private.realm_players where user_id=$1`,[NEW]);assert.deepEqual([p.x,p.z],[-340,-328.5]);assert.deepEqual(r.tutorial.cutscenes,['arrival']);
console.log('ok cutscene recorded and server places player before the King');
// 4. gate restriction while training
const walk=async(uid,x,z,tx,tz)=>{await db.query(`update eldervale_private.realm_players set x=$2,z=$3,path=$4,motion_at=clock_timestamp()-interval '1.2 seconds' where user_id=$1`,[uid,x,z,JSON.stringify([[tx,tz]])]);return one(`select (eldervale_private.advance_player_motion($1)).*`,[uid])};
p=await walk(NEW,-340,-259,-340,-250);assert.ok(p.z<=-258,'trainee stays inside: '+p.z);
p=await walk(NEW,-340,-300,-340,-297);assert.ok(Math.abs(p.z+297)<.01,'trainee walks freely inside');
const setting=await one(`select current_setting('eldervale.motion_tutorial',true) s`);assert.ok(!setting.s,'setting cleared after motion');
console.log('ok trainee blocked at castle bounds, free inside');
// 5. quest flow
const Q=n=>'c7a5e000-0000-4000-8000-'+String(100+n).padStart(12,'0');
const at=async(x,z)=>db.query(`update eldervale_private.realm_players set x=$2,z=$3 where user_id=$1`,[NEW,x,z]);
await at(-340,-300);await fails('quest_accept',{id:Q(1)},/Return to the quest giver/);
await at(-370,-266);await fails('quest_accept',{id:Q(2)},/Return to the quest giver|earlier training/);
r=await cmd('quest_accept',{id:Q(1)});assert.equal(r.quests.find(q=>q.id===Q(1)).completed,false);assert.equal(r.quests.find(q=>q.id===Q(1)).accepted,true);
// A quest accepted before the reward update keeps its objectives/progress but is paid the new rewards.
await db.query(`update eldervale_private.player_quests set data=data-'items'||'{"xp":{"attack":40,"strength":40,"defence":40,"hitpoints":20}}' where user_id=$1 and quest_id=$2`,[NEW,Q(1)]);
const before=await one(`select progress from eldervale_private.player_quests where user_id=$1 and quest_id=$2`,[NEW,Q(1)]);
await run(readFileSync(repo+'/db/quest-journal-rewards.sql','utf8'),'quest journal refresh');
const refreshed=await one(`select data,progress from eldervale_private.player_quests where user_id=$1 and quest_id=$2`,[NEW,Q(1)]);
assert.equal(refreshed.data.xp.attack,200);assert.deepEqual(refreshed.data.items,{'weapon:dagger':1});assert.deepEqual(refreshed.progress,before.progress,'progress untouched');
console.log('ok accepted tutorial quests pick up the new rewards');
let save=await one(`select * from public.player_saves where user_id=$1`,[NEW]);
assert.deepEqual(save.inventory.weaponsOwned,['bronzeSword']);assert.equal(save.stats.bread,2);
await fails('quest_complete',{id:Q(1)},/Finish every objective/);
await db.query(`update public.player_saves set equipment='{"weapon":"bronzeSword","shield":"woodenShield"}',skills=skills||'{"attackXP":8,"strengthXP":8,"defenceXP":4}' where user_id=$1`,[NEW]);
const rat=(await one(`select id::text from eldervale_private.entities where data->>'name'='Cellar rat' limit 1`)).id;
await db.query(`select eldervale_private.emit(jsonb_build_object('type','death','target',$1::text,'player',$2::text))`,[rat,NEW]);
await db.query(`insert into eldervale_private.realm_events(data) values(jsonb_build_object('type','eat','player',$1::text,'item','bread'))`,[NEW]);
await db.query(`insert into eldervale_private.realm_events(data) values(jsonb_build_object('type','hit','player',$1::text))`,[NEW]);
r=await cmd('sync');const q1=r.quests.find(q=>q.id===Q(1));assert.deepEqual(q1.progress,{0:1,1:1,2:8,3:8,4:3,5:1,6:1});
r=await cmd('quest_complete',{id:Q(1)});save=await one(`select * from public.player_saves where user_id=$1`,[NEW]);assert.equal(save.skills.attackXP,208);assert.equal(save.skills.strengthXP,208);assert.equal(save.skills.defenceXP,204);assert.equal(save.skills.hitpointsXP,150);assert.ok(save.inventory.weaponsOwned.includes('dagger'),'iron dagger reward');
assert.equal(r.quests.find(q=>q.id===Q(1)).completed,true);
console.log('ok combat quest: start items, equip/xp/kill/eat objectives, rewards');
// woodcutting: event amount counts logs, firemaking xp baseline
await at(-381,-294);r=await cmd('quest_accept',{id:Q(2)});
await db.query(`insert into eldervale_private.realm_events(data) values(jsonb_build_object('type','woodcut','player',$1::text,'target','x','amount',2))`,[NEW]);
await db.query(`update public.player_saves set skills=skills||'{"firemakingXP":40}' where user_id=$1`,[NEW]);
r=await cmd('quest_complete',{id:Q(2)});assert.equal(r.quests.find(q=>q.id===Q(2)).completed,true);
save=await one(`select * from public.player_saves where user_id=$1`,[NEW]);assert.equal(save.skills.firemakingXP,240);assert.equal(save.stats.woodXP,200);assert.equal(save.stats.wood,3);
console.log('ok woodcutting quest: woodcut events + firemaking xp');
// supplies: lose the axe, ask a tutor
await db.query(`update public.player_saves set inventory=inventory||'{"weaponsOwned":["bronzeSword"]}' where user_id=$1`,[NEW]);
await cmd('tutorial_supplies');save=await one(`select inventory from public.player_saves where user_id=$1`,[NEW]);assert.ok(save.inventory.weaponsOwned.includes('axe'));
await fails('tutorial_supplies',{},/already carry/);
console.log('ok replacement tools from tutors');
// fast-forward 3..7 by marking complete, then graduation
for(const n of [3,4,5,6,7])await db.query(`insert into eldervale_private.player_quests(user_id,quest_id,version,data,completed_at) select $1,id,version,data,now() from eldervale_private.quest_definitions where id=$2`,[NEW,Q(n)]);
await at(-346,-264);r=await cmd('quest_accept',{id:Q(8)});
await fails('tutorial_depart',{},/finish your training/);
const king=(await one(`select id::text from eldervale_private.entities where data->>'name'='King Oswin the Steadfast'`)).id;
await db.query(`select eldervale_private.emit(jsonb_build_object('type','interaction','player',$1::text,'target',$2::text,'kind','npc'))`,[NEW,king]);
const gold0=(await one(`select gold from public.player_saves where user_id=$1`,[NEW])).gold;
r=await cmd('quest_complete',{id:Q(8)});save=await one(`select * from public.player_saves where user_id=$1`,[NEW]);
assert.equal(save.game_flags.tutorial.done,true);assert.equal(Number(save.gold)-Number(gold0),150);assert.equal(r.quests.length,8,'graduates still list the starter quests');assert.ok(r.quests.every(q=>q.completed),'all starter quests green after graduation');assert.ok(save.inventory.armorOwned.includes('cape'),'crimson cape reward');assert.equal(save.stats.shrimp,3);
p=await walk(NEW,-340,-259,-340,-250);assert.ok(p.z>-256,'graduate walks out: '+p.z);
await at(-340,-280);await cmd('tutorial_depart');p=await one(`select x,z from eldervale_private.realm_players where user_id=$1`,[NEW]);assert.deepEqual([p.x,p.z],[-229,134]);
console.log('ok graduation: King talk objective, finishes tutorial, gate open, depart to Birchford');
// 6. death respawn while training
await as(OWNER);await assert.rejects(()=>one(`select eldervale_private.admin_action('tutorial_reset','{}')`),/Choose a player/);
r=(await one(`select eldervale_private.admin_action('tutorial_reset',$1) r`,[{userId:NEW}])).r;assert.equal(r.locked,true);
p=await one(`select x,z from eldervale_private.realm_players where user_id=$1`,[NEW]);assert.deepEqual([p.x,p.z],[-340,-290]);
await as(NEW);r=await cmd('sync');assert.equal(r.quests.length,8);assert.ok(r.quests.every(q=>!q.accepted&&!q.completed),'reset quests are available again');
await at(-370,-266);r=await cmd('quest_accept',{id:Q(1)});assert.equal(r.quests.find(q=>q.id===Q(1)).accepted,true);
await db.query(`update public.player_saves set game_flags=game_flags||jsonb_build_object('deathRespawnAt',now()-interval '1 second') where user_id=$1`,[NEW]);
await db.query(`select eldervale_private.death_tick($1,clock_timestamp())`,[NEW]);p=await one(`select x,z from eldervale_private.realm_players where user_id=$1`,[NEW]);assert.deepEqual([p.x,p.z],[-340,-290]);
console.log('ok owner reset; trainee respawns in the courtyard');
await as('33333333-3333-4333-8333-333333333333');await assert.rejects(()=>one(`select eldervale_private.admin_action('tutorial_skip',$1)`,[{userId:NEW}]),/Owner access/);
await as(OWNER);r=(await one(`select eldervale_private.admin_action('tutorial_skip',$1) r`,[{userId:NEW}])).r;assert.equal(r.locked,false);
const other=(await one(`select eldervale_private.admin_action('spawn','{}') r`)).r;assert.deepEqual(other,{base:'spawn'});
{const snap=(await one(`select eldervale_private.quest_snapshot($1) s`,[NEW])).s;assert.ok(snap.length===8&&snap.every(q=>q.completed),'skipped trainees see the starter quests as completed');}
console.log('ok owner skip (starter quests listed as completed); other admin commands untouched');
// 7. pond & throne block walking
p=await walk(NEW,-373,-348,-373,-343.5);assert.ok(p.z<=-345.9,'pond blocks: '+p.z);
console.log('ok pond collision');
console.log('ALL CHECKS PASSED');
