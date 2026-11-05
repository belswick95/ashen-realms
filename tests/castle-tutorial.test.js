import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {tutorialEntities,tutorialQuests,tutorialQuestRows,tutorialId,questId,CASTLE_CENTRE,CASTLE_INNER_HALF,TUTORIAL_START,AUDIENCE_SPOT,GATE,GATE_MESSAGE} from '../tutorial-data.js';
import {insideCastle,exitBlocked,tutorialLocked,needsCutscene,currentStep,talkPlan,objectiveCount,questReady,bearing} from '../tutorial-logic.js';
import {cutscenes,validCutscene} from '../cutscenes.js';
import {goods} from '../economy.js';
import {worldTemplates} from '../world-templates.js';
import {buildSeed} from '../scripts/build-castle-tutorial-seed.mjs';

const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8');
const sql=read('db/castle-tutorial.sql'),seed=read('db/castle-tutorial-seed.sql');
const rows=()=>tutorialQuestRows().map(r=>({id:r.id,data:r.data,accepted:false,completed:false,progress:{}}));

test('gate rule: trainees cannot step from the courtyard to outside; graduates and outsiders move freely',()=>{
 assert.ok(insideCastle(TUTORIAL_START.x,TUTORIAL_START.z)&&insideCastle(AUDIENCE_SPOT.x,AUDIENCE_SPOT.z));
 assert.ok(!insideCastle(GATE.x,GATE.z+2),'just outside the Great Gate');
 const yard={x:-340,z:-260},road={x:-340,z:-250};
 assert.equal(exitBlocked(true,yard,road),true);
 assert.equal(exitBlocked(false,yard,road),false);
 assert.equal(exitBlocked(true,yard,{x:-380,z:-300}),false,'moving inside is free');
 assert.equal(exitBlocked(true,road,{x:-340,z:-240}),false,'a trainee already outside is never frozen');
 assert.equal(tutorialLocked({active:true}),true);assert.equal(tutorialLocked({active:true,done:true}),false);assert.equal(tutorialLocked({done:true,migrated:true}),false);assert.equal(tutorialLocked(undefined),false);
 assert.ok(GATE_MESSAGE.includes('finish your training'));
 // The server uses the same courtyard bounds (centre -340,-305, half 47).
 assert.match(sql,/abs\(x\+340\)<=47 and abs\(z\+305\)<=47/);assert.deepEqual([CASTLE_CENTRE.x,CASTLE_CENTRE.z,CASTLE_INNER_HALF],[-340,-305,47]);
 assert.match(sql,/motion_tutorial[\s\S]*tutorial_inside\(ax,az\) and not eldervale_private\.tutorial_inside\(bx,bz\)/);
});

test('quest progression walks offer → active objective → ready → next tutor',()=>{
 const quests=rows(),carried=()=>0;
 let step=currentStep(quests,carried);assert.equal(step.state,'offer');assert.equal(step.quest.data.key,'tutorial-combat');assert.equal(step.target,'@tutorial:3');
 quests[0].accepted=true;step=currentStep(quests,carried);assert.equal(step.state,'active');assert.equal(step.objective,0);
 Object.assign(quests[0].progress,{0:1,1:1,2:8});step=currentStep(quests,carried);assert.equal(step.objective,3);assert.match(step.label,/Slash/);assert.equal(step.target,'@tutorial:5');
 Object.assign(quests[0].progress,{3:8,4:3,5:1,6:1});step=currentStep(quests,carried);assert.equal(step.state,'ready');assert.ok(questReady(quests[0],carried));
 assert.equal(talkPlan(quests,'@tutorial:3',carried).command,'quest_complete');
 quests[0].completed=true;step=currentStep(quests,carried);assert.equal(step.state,'offer');assert.equal(step.quest.data.key,'tutorial-woodcutting');
 assert.equal(talkPlan(quests,'@tutorial:3',carried),null,'old tutor no longer drives the chain');
 const offer=talkPlan(quests,'@tutorial:9',carried);assert.equal(offer.command,'quest_accept');assert.ok(offer.lines.length>=2);
 quests.forEach(q=>{q.accepted=q.completed=true});assert.equal(currentStep(quests,carried).state,'finished');
});

test('collect objectives count carried items; latched objectives use server progress',()=>{
 const q={data:{objectives:[{type:'collect',target:'wood',amount:3},{type:'have',target:'tinOre',amount:1}]},progress:{1:1},accepted:true};
 assert.equal(objectiveCount(q,0,()=>2),2);assert.equal(objectiveCount(q,0,()=>9),3);assert.equal(objectiveCount(q,1,()=>0),1,'mined ore stays counted after smelting');
});

test('graduation: the King blessing is a talk objective with its own lines; final quest finishes the tutorial',()=>{
 const quests=rows();quests.slice(0,7).forEach(q=>{q.accepted=q.completed=true});quests[7].accepted=true;
 const plan=talkPlan(quests,'@tutorial:1',()=>0);assert.equal(plan.command,null);assert.match(plan.lines[0].text,/finished your training/);
 const last=tutorialQuests.at(-1);assert.equal(last.finishes,'tutorial');assert.equal(last.objectives[0].target,'@tutorial:1');
 quests[7].progress={0:1};assert.equal(talkPlan(quests,'@tutorial:17',()=>0).finishes,'tutorial');
});

test('tutorial data is a consistent, data-driven chain',()=>{
 const keys=tutorialQuests.map(q=>q.key);assert.equal(new Set(keys).size,keys.length);
 tutorialQuests.forEach((q,i)=>{assert.equal(q.requires,i?keys[i-1]:undefined,q.key+' requires the previous step');assert.ok(q.objectives.length>=1&&q.objectives.length<=8);assert.ok(q.dialogue.offer.length&&q.dialogue.progress.length&&q.dialogue.complete.length,q.key+' dialogue')});
 const types=new Set(['talk','kill','collect','event','xp','have','equip','bank','visit']);
 const refs=JSON.stringify(tutorialQuests).match(/@tutorial:\d+/g);for(const r of refs)assert.ok(tutorialEntities[r.split(':')[1]],r);
 for(const q of tutorialQuests){
  for(const o of q.objectives){assert.ok(types.has(o.type),o.type);assert.ok(o.amount>=1&&o.label,q.key)}
  for(const item of Object.keys({...q.startItems,...q.items}))if(item!=='gold')assert.ok(goods[item],item+' exists in the item catalog');
 }
 for(const d of Object.values(tutorialEntities))assert.ok(worldTemplates[d.template],d.template+' renders on the client');
 assert.equal(worldTemplates.training_dummy.species,'dummy');assert.equal(worldTemplates.training_dummy.damage,0);
 assert.equal(tutorialId(3),'c7a5e000-0000-4000-8000-000000000003');assert.equal(questId(1),'c7a5e000-0000-4000-8000-000000000101');
 // Fires need clear ground: 8×scale from the bank (-366,-312, 2.3) and kitchen (-365,-282, 2.3).
 const fire=tutorialQuests[1].objectives[1].hint;for(const [x,z,s]of [[-366,-312,2.3],[-365,-282,2.3]])assert.ok(Math.hypot(fire.x-x,fire.z-z)>8*s);
});

test('arrival cutscene is valid and ends at the audience spot the server teleports to',()=>{
 assert.ok(validCutscene(cutscenes.arrival));assert.ok(!validCutscene({steps:[{shot:{eye:[1,2]}}]}));
 const walk=cutscenes.arrival.steps.find(s=>s.walk).walk;assert.deepEqual(walk.at(-1),[AUDIENCE_SPOT.x,AUDIENCE_SPOT.z]);
 assert.ok(walk.every(([x,z])=>insideCastle(x,z)));
 assert.match(sql,/update eldervale_private\.realm_players set x=-340,z=-328\.5/);
 assert.ok(cutscenes.arrival.steps.some(s=>s.say?.name?.startsWith('King')));
 assert.equal(needsCutscene({active:true,cutscenes:[]}),true);assert.equal(needsCutscene({active:true,cutscenes:['arrival']}),false);assert.equal(needsCutscene({done:true}),false);
});

test('migration marks every existing character complete before new characters get the tutorial',()=>{
 const migration=sql.indexOf("update public.player_saves set game_flags=coalesce(game_flags,'{}'::jsonb)||jsonb_build_object('tutorial',jsonb_build_object('active',false,'done',true,'migrated',true");
 const patch=sql.indexOf("'eldervale_private.enter_world(jsonb)'::regprocedure");
 assert.ok(migration>0&&patch>migration,'migration runs before enter_world is patched');
 assert.match(sql,/where not \(coalesce\(game_flags,'\{\}'::jsonb\)\?'tutorial'\)/,'only saves without a tutorial flag (owner included) are touched');
 assert.match(sql,/jsonb_build_object\(''tutorial'',jsonb_build_object\(''active'',true/);
 assert.match(sql,/if eldervale_private\.tutorial_locked\(uid\) then sx:=-340;sz:=-290;end if;/,'trainees respawn in the courtyard');
});

test('server SQL is approval-friendly, re-runnable and the seed matches tutorial-data.js',()=>{
 for(const text of [sql,seed])assert.doesNotMatch(text,/\b(drop|alter|delete)\b/i);
 assert.equal(seed,buildSeed(),'run node scripts/build-castle-tutorial-seed.mjs');
 for(const fn of ['can_step','advance_player_motion','enter_world','death_tick','admin_action'])assert.match(sql,new RegExp("def:=pg_get_functiondef\\('eldervale_private\\."+fn+"[\\s\\S]*?if position\\("));
 assert.match(seed,/on conflict\(id\) do update set data=excluded\.data,version=eldervale_private\.quest_definitions\.version\+1,updated_at=now\(\)\s+where eldervale_private\.quest_definitions\.data is distinct from excluded\.data/);
 assert.match(sql,/create or replace trigger quest_progress after insert on eldervale_private\.realm_events/);
 assert.match(sql,/command in \(''tutorial_reset'',''tutorial_skip'',''tutorial_status''\)/);
});

test('compass bearing for the guide arrow',()=>{
 assert.equal(bearing({x:0,z:0},{x:0,z:-30}).text,'north, 30 m');assert.equal(bearing({x:0,z:0},{x:-10,z:10}).text,'south-west, 14 m');assert.equal(bearing({x:0,z:0},{x:1,z:0}).text,'here');
});
