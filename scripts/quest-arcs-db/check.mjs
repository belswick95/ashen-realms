// Behavioural check of the quest arcs (db/quest-arc-*.sql) on PGlite (real Postgres in WASM).
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node --import ./tests/helpers/preload.js scripts/quest-arcs-db/check.mjs
// (or PGLITE=/path/to/node_modules/@electric-sql/pglite/dist/index.js ...)
// Part 1 (quests): the quests-v2 harness schema with the real fc_quest_check, every arc file applied
//   twice, then one player plays every quest end to end through the real server commands
//   (accept, talk/visit/kill/collect/have/xp objectives, report, choices, cutscenes, hand-in),
//   every other choice is replayed after a console reset, and rewards/unlocks/QP are checked.
// Part 2 (gates): the underground harness schema, the underground files and quest-arc-0-core.sql:
//   arenas rasterise, entrance and shortcut gates refuse without the unlock and pass with it.
import {readFileSync,readdirSync} from 'node:fs';
import assert from 'node:assert/strict';
import {ARCS,questRows,allKeys} from '../quest-arcs/build.mjs';
const {PGlite}=await import(process.env.PGLITE||'@electric-sql/pglite');
const repo=new URL('../..',import.meta.url).pathname;
const arcFiles=readdirSync(repo+'db').filter(f=>/^quest-arc-\d.*\.sql$/.test(f)).sort();
let n=0;const ok=m=>{n++;console.log('ok',n,m)};

// ------------------------------------------------------------------ part 1: quests
{
const db=new PGlite();
const run=async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message);throw e}};
const one=async(sql,params=[])=>(await db.query(sql,params)).rows[0];
await run(readFileSync(repo+'scripts/castle-tutorial-db/fixture.sql','utf8'),'castle fixture');
await run(readFileSync(repo+'db/castle-tutorial.sql','utf8'),'castle-tutorial');
await run(readFileSync(repo+'db/castle-tutorial-seed.sql','utf8'),'castle seed');
await run(readFileSync(repo+'db/quest-journal-rewards.sql','utf8'),'quest journal');
await run(readFileSync(repo+'scripts/quests-v2-db/fixture.sql','utf8'),'v2 fixture');
const live=JSON.parse(readFileSync(repo+'scripts/quests-v2-db/live-functions.json','utf8'));
for(const [name,def] of Object.entries(live))if(name[0]!=='_')await run(def,'live '+name);
await run(readFileSync(repo+'db/quests-v2.sql','utf8'),'quests-v2');
// The real classic validator (the fixture has a reduced one).
const afc=readFileSync(repo+'db/admin-full-control.sql','utf8'),at0=afc.indexOf('create or replace function eldervale_private.fc_quest_check');
await run(afc.slice(at0,afc.indexOf('end $fn$;',at0)+9),'real fc_quest_check');
await run(`create or replace function eldervale_private.combat_level(skills jsonb) returns integer language sql immutable set search_path='' as $$select coalesce((skills->>'testCombat')::integer,3)$$`,'combat stand-in');
// Stand-in catalog rows for every existing item the arcs reference (live has them).
const own=new Set(ARCS.flatMap(a=>a.items.map(i=>i[0].slice(5))));
const refs=new Set();
for(const a of ARCS){for(const r of questRows(a)){const d=r.data;for(const st of d.stages)for(const o of st.objectives||[])if(['collect','have'].includes(o.type))refs.add(o.target);
  for(const k of Object.keys({...d.items,...d.startItems}))refs.add(k);if(d.icon)refs.add(d.icon)}
 for(const e of [...a.npcs,...a.monsters])for(const k of [...Object.keys(e.data.shop||{}),...(e.data.loot||[]).map(l=>l.item)])refs.add(k)}
const standins=[...refs].filter(k=>!own.has(k));
await db.query(`insert into eldervale_private.realm_catalog(id,data) select 'item:'||k,jsonb_build_object('name',k) from unnest($1::text[]) k on conflict do nothing`,[standins]);
for(let pass=1;pass<=2;pass++)for(const f of arcFiles)await run(readFileSync(repo+'db/'+f,'utf8'),f+' pass '+pass);
const rows=ARCS.flatMap(a=>questRows(a).map(r=>({...r,arc:a})));
assert.equal((await one(`select count(*)::int n from eldervale_private.quest_definitions where data->>'chain' like 'arc-%'`)).n,rows.length,'every arc quest stored once');
for(const r of rows)assert.deepEqual((await one(`select data from eldervale_private.quest_definitions where id=$1`,[r.id])).data,r.data,r.data.key+' stored as generated');
ok(arcFiles.length+' arc files apply twice; '+rows.length+' quests stored exactly as generated ('+standins.length+' stand-in catalog items)');
// Stubs for arc keys not written yet (lets an unfinished arc set be played end to end).
const missing=allKeys().filter(k=>!rows.some(r=>r.data.key===k));
for(const k of missing)await db.query(`insert into eldervale_private.quest_definitions(id,data) values(gen_random_uuid(),$1)`,[{key:k,name:'Stub '+k,description:'stub',giver:rows[0].data.giver,objectives:[],questPoints:2,published:false}]);

const U='33333333-3333-4333-8333-333333333333',SID='44444444-4444-4444-8444-444444444444',OWNER='91c5b7f0-7018-4290-a190-c2bba0ca492d';
await db.query(`insert into public.player_saves(user_id,character_name,game_flags,skills,stats) values($1,'Wren','{"tutorial":{"active":false,"done":true}}','{}','{}')`,[U]);
await db.query(`insert into eldervale_private.realm_players(user_id,session_id,x,z) values($1,$2,-229,134)`,[U,SID]);
for(const k of missing)await db.query(`insert into eldervale_private.player_quests(user_id,quest_id,version,data,progress,completed_at) select $1,id,1,data,'{}',now() from eldervale_private.quest_definitions where data->>'key'=$2`,[U,k]);
const as=uid=>db.exec(`select set_config('test.uid','${uid}',false)`);
await as(U);
const cmd=async(command,payload={})=>(await one(`select eldervale_private.realm_request_before_stories($1,$2,$3,gen_random_uuid(),0) r`,[SID,command,payload])).r;
const fails=(command,payload,re)=>assert.rejects(()=>cmd(command,payload),e=>{assert.match(e.message,re);return true});
const goTo=async(x,z)=>db.query(`update eldervale_private.realm_players set x=$2,z=$3 where user_id=$1`,[U,x,z]);
const goToActor=async id=>{const a=await one(`select x,z from eldervale_private.realm_actors where id=$1`,[id]);assert.ok(a,'actor '+id);await goTo(a.x+.5,a.z)};
const prog=async id=>one(`select progress,completed_at from eldervale_private.player_quests where user_id=$1 and quest_id=$2`,[U,id]);
const save=()=>one(`select gold,stats,skills,game_flags from public.player_saves where user_id=$1`,[U]);
const refresh=()=>db.query(`select eldervale_private.quest_refresh($1)`,[U]);
const event=data=>db.query(`insert into eldervale_private.realm_events(data) values($1)`,[{...data,player:U}]);
const give=(item,amount)=>db.query(`select eldervale_private.item_change($1,$2,$3)`,[U,item,amount]);
const qp=async()=>(await one(`select eldervale_private.quest_points($1) q`,[U])).q;

async function finishObjectives(st){
 for(const o of st.objectives||[]){
  if(o.type==='talk')await event({type:'interaction',kind:'npc',target:o.target});
  else if(o.type==='visit'){await goTo(o.x,o.z);await refresh()}
  else if(o.type==='kill')await event({type:'death',target:o.target});
  else if(o.type==='event'&&o.event==='death')for(let i=0;i<o.amount;i++)await event({type:'death',target:o.targets[i%o.targets.length]});
  else if(o.type==='collect'||o.type==='have'){const have=(await one(`select eldervale_private.item_quantity($1,$2) q`,[U,o.target])).q;if(have<o.amount)await give(o.target,o.amount-have);await refresh()}
  else if(o.type==='xp'){await db.query(`select eldervale_private.skill_xp($1,$2,$3)`,[U,o.skill,o.amount]);await refresh()}
  else throw Error('harness: objective type '+o.type);
 }
}
// Play a quest from its current stage to the end, choosing `pick(stage)` at every choice.
async function play(r,pick){
 const d=r.data;
 for(let guard=0;guard<30;guard++){
  const pr=await prog(r.id);if(pr.completed_at)return;
  const st=d.stages.find(s=>s.id===pr.progress._stage);assert.ok(st,d.key+' stage '+pr.progress._stage);
  if(st.onEnter?.cutscene)await cmd('quest_cutscene',{id:r.id,cutscene:st.onEnter.cutscene});
  await finishObjectives(st);
  const after=await prog(r.id);if(after.progress._stage!==st.id)continue;// auto-advanced
  if(st.choices?.length){await goToActor(st.npc||d.giver);await cmd('quest_choice',{id:r.id,choice:pick(st)})}
  else if(st.npc){await goToActor(st.npc);await cmd('quest_advance',{id:r.id})}
  else{await goToActor(d.giver);await cmd('quest_complete',{id:r.id})}
 }
 throw Error(d.key+': did not finish');
}
const maxSkills=async()=>{for(const s of ['attack','strength','defence','hitpoints','ranged','magic','prayer','mining','woodcutting','fishing','cooking','smithing','crafting','firemaking','fletching','herblore','farming','runecrafting','construction','hunter','agility','thieving'])await db.query(`select eldervale_private.skill_xp($1,$2,13034431)`,[U,s]);
 await db.query(`update public.player_saves set skills=skills||'{"testCombat":126}' where user_id=$1`,[U])};

// Requirements block a fresh character (no skills, no quests) from everything but each arc's first quest.
for(const r of rows){const m=(await one(`select eldervale_private.quest_v2_missing($1,$2) m`,[U,r.data])).m;
 if(r.data.order===1)assert.deepEqual(m,[],r.data.key+' has no requirements');else assert.ok(m.length>0,r.data.key+' is gated')}
const second=rows.find(r=>r.data.order===2);await goToActor(second.data.giver);await fails('quest_accept',{id:second.id},/You need:/);
ok('fresh character: every arc starter is open, every later quest is gated (quests, skills, QP, combat)');

await maxSkills();
// Dependency order: play every quest whose requirements are met until none are left.
const done=new Set(),order=[];
for(let round=0;round<30&&done.size<rows.length;round++){
 for(const r of rows){if(done.has(r.id))continue;const m=(await one(`select eldervale_private.quest_v2_missing($1,$2) m`,[U,r.data])).m;if(m.length)continue;
  const before=await save(),qp0=await qp();
  await goToActor(r.data.giver);await cmd('quest_accept',{id:r.id});
  await play(r,st=>st.choices[0].id);
  const after=await save(),pr=await prog(r.id),d=r.data;
  assert.equal(await qp(),qp0+d.questPoints,d.key+' quest points');
  assert.equal(Number(after.gold)-Number(before.gold),d.gold||0,d.key+' coins');
  for(const [k,v] of Object.entries(d.items||{}))assert.ok((after.stats[k]||0)>=v||JSON.stringify(after).includes(k),d.key+' item '+k);
  const flags=pr.progress._flags||{};
  for(const u of d.unlocks||[]){const want=!u.ifFlags||Object.entries(u.ifFlags).every(([k,v])=>(flags[k]??false)===v);assert.equal(!!after.game_flags.unlocks?.[u.id],want,d.key+' unlock '+u.id)}
  assert.equal(after.game_flags.questFlags[d.key+'.complete'],true);
  assert.equal(after.game_flags.questLamps.filter(l=>l.quest===r.id).length,(d.lamps||[]).length,d.key+' lamps');
  done.add(r.id);order.push(d.key);
  // Keep the pack light between quests.
  await db.query(`update public.player_saves set stats='{}' where user_id=$1`,[U]);
 }
}
assert.equal(done.size,rows.length,'unreachable quests: '+rows.filter(r=>!done.has(r.id)).map(r=>r.data.key).join(', '));
ok('one character completed all '+rows.length+' arc quests in dependency order: '+order.join(' → '));

// Every other choice: reset with the console, replay, check the flag-filtered unlocks and journal flags.
await as(OWNER);const admin=async(c,p)=>(await one(`select eldervale_private.admin_action($1,$2) r`,[c,p])).r;await as(U);
let branches=0;
for(const r of rows){const choiceStages=r.data.stages.filter(s=>s.choices?.length);
 for(const cs of choiceStages)for(const c of cs.choices.slice(1)){
  await as(OWNER);await admin('qv2_reset',{userId:U,id:r.id});await as(U);
  await goToActor(r.data.giver);await cmd('quest_accept',{id:r.id});
  await play(r,st=>st.id===cs.id?c.id:st.choices[0].id);
  const pr=await prog(r.id),g=(await save()).game_flags;assert.ok(pr.completed_at);
  for(const [k,v] of Object.entries(c.flags||{})){assert.equal(pr.progress._flags[k],v);assert.equal(g.questFlags[r.data.key+'.'+k],v,r.data.key+' world flag '+k)}
  for(const u of r.data.unlocks||[])if(u.ifFlags){const want=Object.entries(u.ifFlags).every(([k,v])=>(pr.progress._flags[k]??false)===v);assert.equal(!!g.unlocks[u.id],want,r.data.key+'/'+c.id+' unlock '+u.id)}
  await db.query(`update public.player_saves set stats='{}' where user_id=$1`,[U]);branches++;
 }}
ok(branches+' alternative choices replayed: flags, world flags and flag-filtered unlocks follow the choice');

// Teleport unlocks work from anywhere (outside combat).
const tps=rows.flatMap(r=>(r.data.unlocks||[]).filter(u=>u.type==='teleport'));
for(const u of tps){await db.query(`update public.player_saves set game_flags=game_flags-'questTeleportAt' where user_id=$1`,[U]);await goTo(0,0);await cmd('quest_teleport',{id:u.id});
 const pos=await one(`select x,z from eldervale_private.realm_players where user_id=$1`,[U]);assert.deepEqual([pos.x,pos.z],[u.x,u.z],u.id)}
ok(tps.length+' quest teleports land where they promise');
// Owner edits survive a re-run of the arc files.
await as(OWNER);const first=rows[0];
await admin('fc_quest_save',{id:first.id,data:{...first.data,name:'Owner renamed'}});
for(const f of arcFiles)await run(readFileSync(repo+'db/'+f,'utf8'),f+' rerun');
assert.equal((await one(`select data->>'name' n from eldervale_private.quest_definitions where id=$1`,[first.id])).n,'Owner renamed');
ok('a quest edited in the Game console is never overwritten by the arc files; console saves validate arc data');
}

// ------------------------------------------------------------------ part 2: gates and arenas
{
const db=new PGlite();
const run=async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message);throw e}};
const one=async(sql,params=[])=>(await db.query(sql,params)).rows[0];
await run(readFileSync(repo+'scripts/underground-db/fixture.sql','utf8'),'underground fixture');
await run(`alter table public.player_saves add column if not exists game_flags jsonb not null default '{}'`,'game_flags column');
const areas=ARCS.flatMap(a=>a.areas||[]);
const keys=[...new Set(areas.flatMap(a=>a.spawns.map(s=>s.roster)).concat(['dusk_bat','mossweb_spider','bramble_goblin','cairn_skeleton','tuskgob_brute','fen_lurker','crypt_warden','cairnbound_knight','gloomweb_broodling','basalt_golem','ashmaw_hound','ashscale_whelp','cinder_fiend','runebound_sentinel','duskborn_demon']))];
await db.query(`insert into eldervale_private.entities(id,revision,data) select md5('roster:'||k)::uuid,1,jsonb_build_object('kind','monster','name',k,'rosterKey',k,'level',10,'hp',100,'respawn',35,'roam',5,'blueprint','monster-roster-v1','x',0,'z',0) from unnest($1::text[]) k`,[keys]);
for(const f of ['underground-1-engine','underground-2-content','underground-3-console'])await run(readFileSync(repo+'db/'+f+'.sql','utf8'),f);
const v2=readFileSync(repo+'db/quests-v2.sql','utf8');
for(const fn of ['player_unlocked']){const i=v2.indexOf('create or replace function eldervale_private.'+fn);await run(v2.slice(i,v2.indexOf('$$;',v2.indexOf('$$',i)+2)+3),fn)}
await run(`create or replace function eldervale_private.quest_done_key(uid uuid,k text) returns boolean language sql stable as $$select coalesce((select (s.game_flags->'doneKeys'->>k)::boolean from public.player_saves s where s.user_id=uid),false)$$`,'quest_done_key stand-in');
for(let pass=1;pass<=2;pass++)await run(readFileSync(repo+'db/quest-arc-0-core.sql','utf8'),'core pass '+pass);
const def=(await one(`select pg_get_functiondef('eldervale_private.underground_command(uuid,text,jsonb,uuid,bigint)'::regprocedure) d`)).d;
assert.equal(def.split('quest-arc-gate').length-1,2,'gate patched once (travel + agility)');
for(const a of areas){const lv=await one(`select count(*)::int n,sum(walkable)::int w from eldervale_private.underground_levels where area=$1`,[a.id]);assert.equal(lv.n,a.levels.length,a.id+' levels');assert.ok(lv.w>100,a.id+' walkable')}
ok(areas.length+' story arenas rasterised; the passage/shortcut gate patch applies once (second run is a no-op)');
const U='55555555-5555-4555-8555-555555555555',SID='66666666-6666-4666-8666-666666666666';
const ctx=readFileSync(repo+'scripts/underground-db/check.mjs','utf8');
await db.query(`insert into public.player_saves(user_id,character_name,skills,stats,game_flags) values($1,'Gate','{"agilityXP":13034431}','{}','{}') on conflict do nothing`,[U]);
await db.query(`insert into eldervale_private.realm_players(user_id,session_id,x,z) values($1,$2,0,0) on conflict do nothing`,[U,SID]);
await db.exec(`select set_config('test.uid','${U}',false)`);
const call=async(command,payload)=>one(`select eldervale_private.underground_command($1,$2,$3,gen_random_uuid(),0) r`,[SID,command,payload]);
for(const a of areas)for(const e of a.entrances){
 const o=await one(`select id,x,z,data from eldervale_private.realm_objects where data->>'blueprintKey'=$1`,[a.id+':entrance:'+e.id]);assert.ok(o,'entrance object '+e.id);
 assert.equal(o.data.passage.requires.unlock,e.requires.unlock);
 await db.query(`update eldervale_private.realm_players set x=$2,z=$3,last_command=now()-interval '1 second' where user_id=$1`,[U,o.x+1,o.z]);
 await assert.rejects(()=>call('travel',{target:o.id}),/bars the way|quest/i,e.id+' locked');
 await db.query(`update public.player_saves set game_flags=jsonb_build_object('unlocks',jsonb_build_object($2::text,'{}'::jsonb)) where user_id=$1`,[U,e.requires.unlock]);
 await db.query(`update eldervale_private.realm_players set last_command=now()-interval '1 second' where user_id=$1`,[U]);
 await call('travel',{target:o.id});const pl=await one(`select x,z from eldervale_private.realm_players where user_id=$1`,[U]);
 assert.deepEqual([pl.x,pl.z],o.data.passage.dest,e.id+' opens with '+e.requires.unlock);
 await db.query(`update public.player_saves set game_flags='{}' where user_id=$1`,[U]);
}
ok('every arena entrance refuses without its quest unlock and opens with it');
// Gated shortcuts (copied from the arc data; the arc files are applied in part 1).
for(const s of ARCS.flatMap(a=>a.objects||[])){
 await db.query(`insert into eldervale_private.entities(id,revision,data) values($1,1,$2)`,[s.id,s.data]);
 const end=s.data.agility.ends[0];
 await db.query(`update eldervale_private.realm_players set x=$2,z=$3,last_command=now()-interval '1 second' where user_id=$1`,[U,end[0],end[1]]);
 await assert.rejects(()=>call('agility',{target:s.id}),/do not know this way/,s.ref+' locked');
 await db.query(`update public.player_saves set game_flags=jsonb_build_object('unlocks',jsonb_build_object($2::text,'{}'::jsonb)) where user_id=$1`,[U,s.data.agility.requires.unlock]);
 await db.query(`update eldervale_private.realm_players set last_command=now()-interval '1 second' where user_id=$1`,[U]);
 let crossed=false;for(let i=0;i<20&&!crossed;i++){await db.query(`update eldervale_private.realm_players set x=$2,z=$3,last_command=now()-interval '1 second' where user_id=$1`,[U,end[0],end[1]]);await call('agility',{target:s.id});const pl=await one(`select x,z from eldervale_private.realm_players where user_id=$1`,[U]);crossed=Math.hypot(pl.x-s.data.agility.ends[1][0],pl.z-s.data.agility.ends[1][1])<.01}
 assert.ok(crossed,s.ref+' crosses with the unlock');
 await db.query(`update public.player_saves set game_flags='{}' where user_id=$1`,[U]);
}
ok('gated agility shortcuts refuse without their quest unlock and work with it');
void ctx;
}
console.log('all quest arc checks passed ('+n+')');
