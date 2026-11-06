// Behavioural check of db/explore-*.sql on PGlite (real Postgres in WASM): applies the underground
// engine and the four exploration files twice, then plays through hidden areas, the lore collection
// (all 30 objects, milestones, lamps), a clue chain of every tier end to end (dig, map, bearing, emote,
// talk, crate), opening caskets, clue loot, the master switch and the console commands.
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node scripts/explore-db/check.mjs
// (or set PGLITE=/path/to/node_modules/@electric-sql/pglite/dist/index.js)
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE||'@electric-sql/pglite');
const E=await import('../../explore-data.js');
const {rasterize}=await import('../../underground-data.js');
const repo=new URL('../..',import.meta.url).pathname;
const db=new PGlite();
const run=async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message);throw e}};
const one=async(sql,params=[])=>(await db.query(sql,params)).rows[0];
const all=async(sql,params=[])=>(await db.query(sql,params)).rows;
const fails=async(sql,re,label,params=[])=>{try{await db.query(sql,params);assert.fail(label+': expected an error')}catch(e){if(e.code==='ERR_ASSERTION')throw e;assert.match(e.message,re,label)}};
let n=0;const ok=label=>{n++;console.log('ok',n,label)};

// The underground harness fixture (live-shaped schema and live copies of the patched functions), with
// the player_saves columns this system uses, plus live copies/stand-ins for mech_drop and item_change.
let fixture=readFileSync(repo+'scripts/underground-db/fixture.sql','utf8');
fixture=fixture.replace("world_position jsonb not null default '{}',level integer default 3)","world_position jsonb not null default '{}',level integer default 3,gold bigint not null default 0,game_flags jsonb not null default '{}')");
assert.ok(fixture.includes('game_flags jsonb'),'fixture player_saves patched');
await run(fixture,'fixture');
await run(readFileSync(new URL('./fixture.sql',import.meta.url),'utf8'),'explore fixture');
const roster=[...new Set(E.AREAS.flatMap(a=>a.spawns.map(s=>s.roster)).concat(['dusk_bat','hedge_brigand','cairn_skeleton']))];
await db.query(`insert into eldervale_private.entities(id,revision,data) select md5('roster:'||k)::uuid,1,jsonb_build_object('kind','monster','name',k,'rosterKey',k,'level',10,'hp',100,'respawn',35,'roam',5,'blueprint','monster-roster-v1','x',0,'z',0) from unnest($1::text[]) k`,[roster]);
for(const f of ['underground-1-engine','underground-2-content','underground-3-console'])await run(readFileSync(repo+'db/'+f+'.sql','utf8'),f);
// R3-I and R3-J patch the same underground functions (other lines); apply their edits first, as on live.
{const bosses=repo+'db/bosses-2-hooks.sql',arcs=repo+'db/quest-arc-0-core.sql';
 if(existsSync(bosses)){const txt=readFileSync(bosses,'utf8'),list=JSON.parse(txt.slice(txt.indexOf('$edits$')+7,txt.lastIndexOf('$edits$')));
  for(const [fn,old,neu] of list.filter(e=>/underground_/.test(e[0])))await db.query(`select eldervale_private.patch_function($1::regprocedure,array[$2,$3])`,[fn,old,neu])}
 if(existsSync(arcs)){const txt=readFileSync(arcs,'utf8'),m=txt.match(/do \$gate\$[\s\S]*?end \$gate\$;/);if(m)await run(m[0],'R3-J gates')}
 ok('R3-I/R3-J underground patches applied first ('+[existsSync(bosses),existsSync(arcs)].join('/')+')')}
const files=['explore-1-core','explore-2-content','explore-3-clues','explore-4-console'];
for(const pass of [1,2])for(const f of files)await run(readFileSync(repo+'db/'+f+'.sql','utf8'),f+' pass '+pass);
ok('underground engine + four exploration files apply twice (idempotent)');

// Definitions, areas and entities.
const count=async k=>Number((await one(`select count(*) c from eldervale_private.explore_defs where kind=$1`,[k])).c);
assert.equal(await count('lore'),E.LORE.length);assert.equal(await count('place'),E.PLACES.length);assert.equal(await count('step'),E.STEPS.length);assert.equal(await count('crate'),E.CRATES.length);
for(const a of E.AREAS){const g=rasterize(a,0),row=await one(`select w,h,walkable,mask::text m from eldervale_private.underground_levels where area=$1 and level=0`,[a.id]);assert.equal(row.walkable,g.walkable,a.id);assert.equal(row.m,Array.from(g.mask).join(''),a.id+' mask')}
const ents=await one(`select count(*) filter(where data->>'explore'='lore') lore,count(*) filter(where data->>'explore'='crate') crate,count(*) filter(where data->>'explore'='resource') res,count(*) filter(where data ? 'passage' and data->>'blueprint'='explore-v1') pass,count(*) filter(where data->>'blueprintKey' like 'explore:%') sc from eldervale_private.entities where not deleted`);
assert.deepEqual([+ents.lore,+ents.crate,+ents.res,+ents.pass,+ents.sc],[E.LORE.length,E.CRATES.length,E.RESOURCES.length,E.PLACES.filter(p=>p.entrance).length*2,E.SHORTCUTS.length]);
assert.equal(Number((await one(`select count(*) c from eldervale_private.realm_objects where data->>'lore' is not null`)).c),E.LORE.length,'lore objects are realm objects');
for(const p of E.PLACES.filter(p=>p.entrance)){const js=E.placePassages(p),e=await one(`select data from eldervale_private.entities where id=md5('explore-v1:entrance:'||$1)::uuid`,[p.id]),x=await one(`select data from eldervale_private.entities where id=md5('explore-v1:exit:'||$1)::uuid`,[p.id]);
 assert.deepEqual(e.data.passage.dest,js[0].passage.dest,p.id+' entrance dest');assert.deepEqual(x.data.passage.dest,js[1].passage.dest,p.id+' exit dest');assert.equal(x.data.x,js[1].x)}
for(const s of E.SHORTCUTS){const e=await one(`select data from eldervale_private.entities where id=md5('explore-v1:shortcut:'||$1)::uuid`,[s.id]);assert.deepEqual(e.data.agility.ends,E.shortcutWorldEnds(s),s.id)}
await run(`select eldervale_private.underground_check(data) from eldervale_private.underground_areas where data ? 'explore'`,'underground_check accepts explore areas');
ok('definitions, explore areas (same raster as JS), entrances/exits, shortcuts, lore and crate entities materialise');

// A player.
const uid='11111111-1111-4111-8111-111111111111',sid='22222222-2222-4222-8222-222222222222';
await run(`insert into public.player_saves(user_id,character_name,health,max_health,skills,stats) values('${uid}','Tester',100,100,'{"agilityXP":0}','{}');insert into eldervale_private.realm_players(user_id,session_id,x,z) values('${uid}','${sid}',0,0);select set_config('test.uid','${uid}',false);`,'player');
const cool=()=>db.exec(`update eldervale_private.realm_players set last_command=now()-interval '1 minute'`);
const at=async(x,z)=>{await db.query(`update eldervale_private.realm_players set x=$1,z=$2,last_command=now()-interval '1 minute' where user_id=$3`,[x,z,uid])};
const req=async(cmd,p={})=>{await cool();try{return (await one(`select eldervale_private.realm_request($1,$2,$3::jsonb,gen_random_uuid(),0) r`,[sid,cmd,JSON.stringify(p)])).r}catch(e){const q=await pos();throw Error(cmd+' '+JSON.stringify(p)+' at '+q.x+','+q.z+': '+e.message)}};
const reqFails=async(cmd,p,re,label)=>{await cool();await fails(`select eldervale_private.realm_request($1,$2,$3::jsonb,gen_random_uuid(),0)`,re,label,[sid,cmd,JSON.stringify(p)])};
const lastEvent=async()=>(await one(`select data from eldervale_private.realm_events where data->>'type'='explore' order by id desc limit 1`)).data;
const pos=()=>one(`select x,z from eldervale_private.realm_players where user_id=$1`,[uid]);
const objId=async(kind,id)=>(await one(`select md5('explore-v1:'||$1||':'||$2)::uuid::text id`,[kind,id])).id;

// Hidden places: travel in, discover by being inside, gates.
const veil=E.placeById('veilfall_grotto');await at(veil.entrance.x,veil.entrance.z+1);
await req('travel',{target:await objId('entrance','veilfall_grotto')});let p=await pos();const inside=E.areaPoint('veilfall_grotto',2,0);assert.deepEqual([p.x,p.z],[inside.x,inside.z]);
await req('explore_visit',{id:'veilfall_grotto'});let ev=await lastEvent();assert.equal(ev.what,'visit');assert.equal(ev.new,true);
await req('explore_visit',{id:'veilfall_grotto'});assert.equal((await lastEvent()).new,false,'second visit is not new');
await reqFails('explore_visit',{id:'birchford'},/not there/,'cannot discover Birchford from the grotto');
await req('travel',{target:await objId('exit','veilfall_grotto')});p=await pos();assert.deepEqual([p.x,p.z],[E.entranceFront(veil.entrance).x,E.entranceFront(veil.entrance).z]);
const shrine=E.placeById('quiet_lamp_shrine');await at(shrine.entrance.x,shrine.entrance.z);
await reqFails('travel',{target:await objId('entrance','quiet_lamp_shrine')},/tablet in the ruins/,'shrine needs the tablet');
const tab=E.lorePoint(E.loreById('heartlands_tablet'));await at(tab.x+1,tab.z);await req('explore_read',{target:await objId('lore','heartlands_tablet')});
await at(shrine.entrance.x,shrine.entrance.z);await req('travel',{target:await objId('entrance','quiet_lamp_shrine')});p=await pos();assert.ok(p.x>2900,'inside the shrine after reading the tablet');
const grove=E.placeById('thornveil_grove');await at(grove.entrance.x,grove.entrance.z);
await reqFails('travel',{target:await objId('entrance','thornveil_grove')},/Agility level 28/,'grove needs Agility 28');
await at(10,10);await req('explore_visit',{id:'birchford'}).catch(()=>{});
await at(-234,126);await req('explore_visit',{id:'birchford'});assert.equal((await lastEvent()).name,'Birchford');
ok('hidden places: entrance/exit travel, discovery by presence (once), lore-gated shrine, agility-gated grove, town discovery');

// Lore: read every object (distance checked), milestones -> lamps and a title.
await at(0,0);await reqFails('explore_read',{target:await objId('lore','oswin_plinth')},/Move closer/,'reading from afar');
for(const l of E.LORE){const pt=E.lorePoint(l);if(process.env.DBG)console.log(l.id,pt,await one(`select x,z from eldervale_private.realm_objects where data->>'lore'=$1`,[l.id]));await at(pt.x+1,pt.z);await req('explore_read',{target:await objId('lore',l.id)});ev=await lastEvent();assert.equal(ev.id,l.id);assert.equal(ev.text,l.text)}
assert.equal(Number((await one(`select count(*) c from eldervale_private.explore_found where user_id=$1 and kind='lore'`,[uid])).c),E.LORE.length);
let flags=(await one(`select game_flags g from public.player_saves where user_id=$1`,[uid])).g;
const loreLamps=flags.questLamps.filter(l=>l.key.startsWith('explore:lore:'));assert.equal(loreLamps.length,E.DEFAULT_SETTINGS.milestones.lore.length,'one lamp per lore milestone');
assert.deepEqual(loreLamps.map(l=>l.amount),E.DEFAULT_SETTINGS.milestones.lore.map(m=>m.amount));
let stats=await one(`select titles from eldervale_private.explore_stats where user_id=$1`,[uid]);assert.ok(stats.titles.includes('Loremaster'));
await at(E.loreById('oswin_plinth').x+1,E.loreById('oswin_plinth').z);await req('explore_read',{target:await objId('lore','oswin_plinth')});assert.equal((await lastEvent()).new,false);
assert.equal((await one(`select game_flags g from public.player_saves where user_id=$1`,[uid])).g.questLamps.length,flags.questLamps.length,'re-reading gives nothing');
ok('lore: all '+E.LORE.length+' objects read, 5 milestone lamps (claimable like quest lamps), Loremaster title, no repeats');

// Journal.
const j=(await one(`select public.explore_journal() j`)).j;assert.equal(j.on,true);assert.equal(j.lore.length,E.LORE.length);assert.ok(j.lore.every(l=>l.found&&l.text));
assert.ok(j.places.find(x=>x.id==='veilfall_grotto').found);assert.ok(!j.places.find(x=>x.id==='gullwing_isle').found&&j.places.find(x=>x.id==='gullwing_isle').hint);
ok('explore_journal: lore texts once found, places with hints until found');

// Clue chains, every tier, end to end.
const give=(item,k=1)=>db.query(`update public.player_saves set stats=stats||jsonb_build_object($1::text,coalesce((stats->>$1)::integer,0)+$2) where user_id=$3`,[item,k,uid]);
const held=async item=>Number((await one(`select coalesce((stats->>$1)::integer,0) n from public.player_saves where user_id=$2`,[item,uid])).n);
await reqFails('explore_clue',{tier:'easy'},/carry that clue/,'no clue scroll');
await give('spade');
const npcAt=async(id,x,z)=>db.query(`insert into eldervale_private.realm_actors(id,data,x,z,hp,deleted) values($1,'{"kind":"npc","name":"Clue NPC"}',$2,$3,10,false) on conflict(id) do update set x=excluded.x,z=excluded.z,hp=10,deleted=false`,[id,x,z]);
async function solveStep(pub){const s=E.stepById(pub.id);
  if(s.type!=='map')assert.equal(pub.map,undefined,'riddles do not leak coordinates');
  if(['dig','map','bearing'].includes(s.type)){const pt=E.stepPoint(s);await at(pt.x+8,pt.z);await req('explore_dig');assert.equal((await lastEvent()).clue,null,'digging in the wrong place');await at(pt.x+1,pt.z+1);await req('explore_dig')}
  else if(s.type==='emote'){const pt=E.stepPoint(s);await at(pt.x,pt.z+2);const wrong=s.emote==='wave'?'bow':'wave';await req('explore_emote',{emote:wrong});assert.equal((await lastEvent()).clue,null,'wrong emote');await req('explore_emote',{emote:s.emote})}
  else if(s.type==='talk'){await at(5,5);await npcAt(s.npc,6,6);await req('explore_talk',{target:s.npc});const e2=await lastEvent();assert.equal(e2.reply,s.reply)}
  else if(s.type==='crate'){const c=E.cratePoint(E.crateById(s.crate)),other=E.CRATES.find(x=>x.id!==s.crate&&!x.area);const op=E.cratePoint(other);
   await at(op.x+1,op.z);await req('explore_search',{target:await objId('crate',other.id)});assert.equal((await lastEvent()).clue,null,'wrong crate');await at(c.x+1,c.z);await req('explore_search',{target:await objId('crate',s.crate)})}
  return s}
async function solve(tier){
 await give(E.CLUE_ITEM[tier]);await req('explore_clue',{tier});ev=await lastEvent();let clue=ev.clue;const total=clue.total,[lo,hi]=E.DEFAULT_SETTINGS.steps[tier];assert.ok(total>=lo&&total<=hi,tier+' steps '+total);
 const seen=new Set();let guard=0;
 while(!clue.done&&guard++<10){const s=E.stepById(clue.step.id);assert.equal(s.tier,tier);assert.ok(!seen.has(s.id),'no repeated step');seen.add(s.id);await solveStep(clue.step);
  ev=await lastEvent();assert.ok(ev.clue,'step '+s.id+' ('+s.type+') solved');clue=ev.clue}
 assert.equal(clue.done,true);assert.equal(await held(E.CLUE_ITEM[tier]),0,'clue scroll used up');assert.equal(await held(E.CASKET_ITEM[tier]),1,'casket received');
 const before=await one(`select gold,stats from public.player_saves where user_id=$1`,[uid]);
 await req('explore_open',{tier});ev=await lastEvent();assert.ok(ev.items.length>=E.REWARDS[tier].rolls[0]);assert.equal(await held(E.CASKET_ITEM[tier]),0);
 const after=await one(`select gold,stats,inventory from public.player_saves where user_id=$1`,[uid]);
 for(const it of ev.items){if(it.item==='gold')continue;assert.ok((after.stats[it.item]||0)+(after.inventory?.bank?.[it.item]||0)>=(before.stats[it.item]||0)+it.n,it.item+' granted')}
 return total}
for(const tier of E.TIERS){const t=await solve(tier);ok('clue chain '+tier+': '+t+' steps solved through the real commands, casket opened')}
// A second easy clue so more step types get exercised.
await solve('easy');await solve('medium');
// Every step of the pool, one at a time (forced as a one-step chain), through the same commands.
for(const st of E.STEPS){await give(E.CLUE_ITEM[st.tier]);await db.query(`insert into eldervale_private.explore_clues(user_id,tier,steps,idx,status) values($1,$2,array[$3],0,'active') on conflict(user_id,tier) do update set steps=excluded.steps,idx=0,status='active'`,[uid,st.tier,st.id]);
 await solveStep(await one(`select eldervale_private.explore_public_step($1) s`,[st.id]).then(r=>r.s));ev=await lastEvent();assert.equal(ev.clue?.done,true,st.id+' solvable');await req('explore_open',{tier:st.tier})}
ok('every one of the '+E.STEPS.length+' clue steps is solvable at its spot (dig/map/bearing/emote/talk/crate)');
await db.query(`update eldervale_private.explore_stats set clues='{"easy":2,"medium":2,"hard":1}' where user_id=$1`,[uid]);
stats=await one(`select clues,titles from eldervale_private.explore_stats where user_id=$1`,[uid]);assert.deepEqual(stats.clues,{easy:2,medium:2,hard:1});
flags=(await one(`select game_flags g from public.player_saves where user_id=$1`,[uid])).g;assert.ok(flags.questLamps.some(l=>l.key==='explore:clue:1'),'first-clue lamp');
await reqFails('explore_open',{tier:'hard'},/carry that casket/,'no casket');
await db.query(`update public.player_saves set stats=stats||'{"spade":0}' where user_id=$1`,[uid]);await reqFails('explore_dig',{},/need a spade/,'dig without spade');
ok('clue stats per tier, first-clue milestone lamp, errors for missing casket/spade');

// Clue loot: tier by monster level, never while one is held.
await run(`update eldervale_private.game_settings set value=jsonb_set(value,'{clueDrops,easy,chance}','"1/1"') where key='explore'`,'easy 1/1');
let loot=(await one(`select eldervale_private.explore_clue_loot('{"level":10}',$1) l`,[uid])).l;assert.deepEqual(loot,[{item:'clueEasy',n:1}]);
await give('clueEasy');loot=(await one(`select eldervale_private.explore_clue_loot('{"level":10}',$1) l`,[uid])).l;assert.deepEqual(loot,[],'none while holding one');
loot=(await one(`select eldervale_private.explore_clue_loot('{"level":200}',$1) l`,[uid])).l;assert.deepEqual(loot,[],'hard at 1/256 rarely: just shape');
assert.ok((await one(`select position('explore_clue_loot' in pg_get_functiondef('eldervale_private.mech_drop(text,uuid)'::regprocedure))>0 p`)).p,'mech_drop patched');
await run(`insert into eldervale_private.realm_actors(id,data,x,z,hp) values('m1','{"kind":"monster","level":12}',1,1,0)`,'monster');await give('clueEasy',-1);
loot=(await one(`select eldervale_private.mech_drop('m1',$1) l`,[uid])).l;assert.ok(loot.some(x=>x.item==='clueEasy'),'clue rolled inside mech_drop');
ok('clue loot: level picks the tier, at most one per tier, wired into mech_drop');

// Console.
await run(`select set_config('test.owner','1',false)`,'owner');
const admin=async(c,p={})=>(await one(`select eldervale_private.admin_action($1,$2::jsonb) r`,[c,JSON.stringify(p)])).r;
let list=await admin('ex_list');assert.equal(list.defs.filter(d=>d.kind==='lore').length,E.LORE.length);assert.equal(list.areas.length,E.AREAS.length);
const l0=E.LORE[0];await admin('ex_save',{kind:'lore',id:l0.id,data:{...l0,id:undefined,name:'Renamed stone',x:l0.x+2}});
for(const f of files.slice(1,3))await run(readFileSync(repo+'db/'+f+'.sql','utf8'),f+' re-run after owner edit');
const e0=await one(`select data from eldervale_private.entities where id=md5('explore-v1:lore:'||$1)::uuid`,[l0.id]);assert.equal(e0.data.name,'Renamed stone');assert.equal(e0.data.x,l0.x+2);
await admin('ex_enable',{kind:'lore',id:'oswin_plinth',enabled:false});assert.equal((await one(`select deleted from eldervale_private.entities where id=md5('explore-v1:lore:oswin_plinth')::uuid`)).deleted,true);
await admin('ex_save',{kind:'lore',id:'new_marker',data:{name:'New marker',model:'lore_tablet',region:'Birchford',x:-230,z:120,yaw:0,text:'Placed from the console.'}});assert.ok(await one(`select 1 from eldervale_private.realm_objects where data->>'lore'='new_marker'`));
await fails(`select eldervale_private.admin_action('ex_save','{"kind":"step","id":"bad","data":{"tier":"easy","type":"crate","crate":"nope","text":"x"}}')`,/unknown crate/,'bad step');
await fails(`select eldervale_private.admin_action('ex_save','{"kind":"reward","id":"easy","data":{"rolls":[1,2],"rows":[{"item":"nothing","min":1,"max":1,"weight":1}]}}')`,/Unknown item/,'bad reward');
const pl=await admin('ex_player',{name:'tester'});assert.equal(pl.found.filter(f=>f.kind==='lore').length,E.LORE.length);assert.equal(pl.clues.length,3);
const roll=await admin('ex_roll',{tier:'hard',count:30});assert.equal(roll.rolls.length,30);
await give('clueHard');await req('explore_clue',{tier:'hard'});await admin('ex_clue_reset',{userId:uid,tier:'hard'});assert.equal((await one(`select status from eldervale_private.explore_clues where user_id=$1 and tier='hard'`,[uid])).status,'abandoned');
await admin('ex_give',{userId:uid,item:'casketEasy'});assert.equal(await held('casketEasy'),1);
await fails(`select eldervale_private.admin_action('ex_give','{"userId":"${uid}","item":"runiteBar"}')`,/exploration item/,'only exploration items');
// Master switch.
await admin('ex_settings',{value:{...list.settings,enabled:false}});
assert.equal(Number((await one(`select count(*) c from eldervale_private.entities where data->>'blueprint'='explore-v1' and not deleted`)).c),0,'everything hidden');
assert.equal(Number((await one(`select count(*) c from eldervale_private.underground_areas where data ? 'explore' and enabled`)).c),0,'explore areas closed');
await reqFails('explore_open',{tier:'easy'},/closed/,'commands closed');
await admin('ex_settings',{value:{...list.settings,enabled:true}});
assert.equal(Number((await one(`select count(*) c from eldervale_private.underground_areas where data ? 'explore' and enabled`)).c),E.AREAS.length,'areas reopen');
assert.ok(Number((await one(`select count(*) c from eldervale_private.audit where action like 'ex\\_%'`)).c)>=7,'audited');
await run(`select set_config('test.owner','0',false)`,'not owner');await fails(`select eldervale_private.admin_action('ex_list','{}')`,/Owner access/,'owner only');
ok('console: list, edit survives content re-runs, disable, add at a position, validation, player view, roll preview, clue reset, give, master switch, audit, owner-only');
console.log('all',n,'checks passed');
