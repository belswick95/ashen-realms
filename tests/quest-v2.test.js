import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import crypto from 'node:crypto';
import {currentStage,nextStageId,isFinalStage,questView,stageReport,journalEntries,requirementRows,lampXp,lampChoices,npcLinesFor,branchLines,validateV2Draft,questGraph,createQuestSimulator,flagsMatch} from '../quest-v2.js';
import {trackerStep,markerFor,dialogueTopics,questPages,readyToHandIn,requirementsMet} from '../quest-guide.js';
import {layDots,planRoute,doorOnRoute,edgeArrow,createTileCache,guidanceSettings,TRAIL} from '../quest-trail.js';
import {pendingQuestCutscene,completionCutscene} from '../quest-cutscenes.js';
import {validCutscene} from '../cutscenes.js';
import {toggleStages,cleanV2} from '../admin-quest-v2.js';
import {TILE,FLAG,tileOf} from '../tile-grid.js';

const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8');
const MAUD='96d6414a-90ce-4080-8515-adc6b4db298b',CORIN='8e1013ae-c555-4aff-a4ba-8425fb7a290a',JORY='d1b26173-cd94-4a4f-be5f-7a4d4afa7ad8';
// The sample quest exactly as db/quests-v2-sample.sql seeds it.
const sample=()=>{const sql=read('db/quests-v2-sample.sql'),json=sql.slice(sql.indexOf('$quest$')+7,sql.lastIndexOf('$quest$'));return JSON.parse(json.replaceAll('@maud',MAUD).replaceAll('@corin',CORIN).replaceAll('@jory',JORY))};
const row=(data,extra={})=>({id:'q1',data,accepted:true,completed:false,progress:{},...extra});

test('stages: current stage, routing (next, final, choices) and the per-stage objective view',()=>{
 const d=sample();
 assert.equal(currentStage(row(d)).id,'lamplighter','no _stage yet: first stage');
 assert.equal(nextStageId(d,d.stages[0]),'errand-boy');assert.equal(nextStageId(d,d.stages[1],'tell-truth'),'new-strap');
 assert.equal(isFinalStage(d,d.stages[2]),true);assert.equal(isFinalStage(d,d.stages[1]),false,'a choice is never final');
 const q=row(d,{progress:{_stage:'new-strap'}});assert.deepEqual(questView(q).data.objectives.map(o=>o.target),['leather']);assert.equal(questView(q),questView(q),'memoised');
 assert.equal(flagsMatch({a:true},{a:true,b:1}),true);assert.equal(flagsMatch({a:true},{}),false);
});

test('tracker, markers and conversation follow the stage: report NPC "?", choices, final hand-in',()=>{
 const d=sample(),names=id=>({[JORY]:'Jory',[MAUD]:'Sister Maud'})[id];
 let q=row(d,{progress:{_stage:'errand-boy',_done:['lamplighter']}});
 assert.equal(trackerStep(q,()=>0,names).label,'Find Jory the Errand Boy by the north gate');assert.equal(trackerStep(q).stage,2);
 assert.equal(readyToHandIn(q),false,'only the final stage hands in');
 q=row(d,{progress:{_stage:'errand-boy',_done:['lamplighter'],0:1}});
 assert.deepEqual(stageReport(q),{npc:JORY,kind:'choice',stage:d.stages[1]});
 assert.equal(trackerStep(q,()=>0,names).label,'Decide with Jory');assert.equal(trackerStep(q).target,JORY);
 assert.equal(markerFor(JORY,[q]),'?','the report NPC carries the "?"');
 const topics=dialogueTopics({lines:['Hi']},JORY,[q]);assert.equal(topics[0].stage,'report');
 const plan=questPages(q,'report');assert.equal(plan.then,'choose');assert.deepEqual(plan.choices.map(c=>c.value),['keep-secret','tell-truth']);assert.match(plan.pages[0].text,/fleece/);
 q=row(d,{progress:{_stage:'new-strap',_done:['lamplighter','errand-boy'],_flags:{told_truth:true}}});
 assert.equal(readyToHandIn(q,()=>0),false);assert.equal(readyToHandIn(q,id=>id==='leather'?1:0),true);
 assert.equal(markerFor(MAUD,[q],{carried:()=>1}),'?');
 assert.match(questPages(q,'complete').pages[0].text,/the truth with it/,'branch dialogue by flags');
 assert.match(questPages({...q,progress:{...q.progress,_flags:{kept_secret:true}}},'complete').pages[0].text,/new strap!/);
});

test('requirements: quests, quest points, skills (flat or structured), items, combat',()=>{
 const d=sample(),tut={id:'t',data:{key:'tutorial-graduation',name:'Graduation'},completed:false,accepted:true};
 let rows=requirementRows(d,[tut],{qp:3});assert.deepEqual(rows.map(r=>[r.label,r.met]),[['Complete Graduation',false],['5 Quest Points',false]]);
 tut.completed=true;rows=requirementRows(d,[tut],{qp:8});assert.ok(rows.every(r=>r.met));
 assert.equal(requirementsMet({data:d},[],{trainee:false,qp:8}),true,'graduates with 8 QP may start');
 const r=requirementRows({requirements:{skills:{agility:{level:30,boostable:false}},items:{rope:1},combat:20}},[],{skillLevel:()=>28,carried:()=>0,combatLevel:()=>25});
 assert.deepEqual(r.map(x=>x.met),[true,false,false]);assert.equal(r.find(x=>x.kind==='skill').label,'Level 30 Agility');
 assert.deepEqual(requirementRows({requirements:{smithing:20}},[],{skillLevel:()=>21}).map(x=>x.met),[true],'original flat format');
});

test('OSRS journal: finished stages struck through, current stage plain, completion text by flags',()=>{
 const d=sample();
 assert.deepEqual(journalEntries(row(d,{accepted:false})).map(e=>e.current),[true]);
 const mid=journalEntries(row(d,{progress:{_stage:'new-strap',_done:['lamplighter','errand-boy']}}));
 assert.deepEqual(mid.map(e=>[e.id,e.done]),[['lamplighter',true],['errand-boy',true],['new-strap',false]]);
 const done=journalEntries(row(d,{completed:true,progress:{_stage:'new-strap',_done:['lamplighter','errand-boy','new-strap'],_flags:{kept_secret:true}}}));
 assert.equal(done.filter(e=>e.done).length,3);assert.match(done.at(-1).text,/rings true.*kept Jory's secret/);
});

test('XP lamps: 10 × level (test vector), minimum level, skill list',()=>{
 assert.equal(lampXp({perLevel:10},40),400);assert.equal(lampXp({amount:2500},70),2500);
 const c=lampChoices({perLevel:10,minLevel:5,skills:['crafting','agility']},s=>s==='crafting'?12:3);
 assert.deepEqual(c.map(x=>[x.skill,x.xp,x.allowed]),[['crafting',120,true],['agility',30,false]]);
});

test('unlocked NPC dialogue replaces lines (latest wins)',()=>{
 const unlocks={a:{type:'dialogue',npc:'n',lines:[{who:'npc',text:'old'}],at:'2026-01-01'},b:{type:'dialogue',npc:'n',lines:[{who:'npc',text:'new'}],at:'2026-02-01'},c:{type:'teleport',id:'t'}};
 assert.equal(npcLinesFor('n',unlocks)[0].text,'new');assert.equal(npcLinesFor('x',unlocks),null);
 assert.equal(branchLines({branchDialogue:[{stage:'complete',ifFlags:{a:1},lines:[{who:'npc',text:'A'}]}]},'complete',{a:1})[0].text,'A');
});

test('console validation mirrors the server; the dependency graph finds loops and missing keys',()=>{
 const d=sample();const ctx={npcs:new Set([MAUD,CORIN,JORY]),keys:new Set(['tutorial-graduation']),items:new Set(['leather','custom_morning_bell_charm'])};
 assert.deepEqual(validateV2Draft(d,ctx),[]);
 assert.match(validateV2Draft({...d,stages:[{id:'a',journal:'A',objectives:[{type:'talk',target:CORIN,amount:1}],next:'b'},{id:'b',journal:'B',next:'a'}]},ctx).join(),/loop forever/);
 assert.match(validateV2Draft({...d,stages:[{id:'a',journal:'A',objectives:[{type:'collect',target:'leather',amount:1}]},{id:'b',journal:'B',objectives:[{type:'talk',target:CORIN,amount:1}]}]},ctx).join(),/hand them to/);
 assert.match(validateV2Draft({...d,lamps:[{amount:1,perLevel:2}]},ctx).join(),/fixed amount or an amount per level/);
 assert.match(validateV2Draft({...d,requirements:{quests:['nope']}},ctx).join(),/does not exist/);
 const g=questGraph([{key:'a',requires:'c'},{key:'b',requirements:{quests:['a']}},{key:'c',requirements:{quests:['b']}},{key:'d',requires:'zzz'}]);
 assert.equal(g.cycles.length,1);assert.deepEqual(g.missing,[['d','zzz']]);
});

test('simulator: a full run of the sample quest through either branch',()=>{
 for(const [choice,flag] of [['keep-secret','kept_secret'],['tell-truth','told_truth']]){
  const sim=createQuestSimulator(sample());
  sim.apply(sim.actions()[0]);assert.equal(currentStage(sim.quest).id,'lamplighter');
  sim.apply(sim.actions()[0]);assert.equal(currentStage(sim.quest).id,'errand-boy','talk stage auto-advances');
  sim.apply(sim.actions()[0]);const pick=sim.actions().find(a=>a.choice===choice);assert.ok(pick);sim.apply(pick);
  assert.equal(sim.flags()[flag],true);assert.equal(currentStage(sim.quest).id,'new-strap');assert.ok(sim.log.some(l=>/Cutscene: The worn strap/.test(l)));
  sim.apply(sim.actions()[0]);sim.apply(sim.actions().find(a=>a.kind==='complete'));
  assert.equal(sim.quest.completed,true);const ids=sim.unlocks().map(u=>u.id);
  assert.ok(ids.includes('teleport.morning-bell'));assert.equal(ids.includes('dialogue.jory-secret'),choice==='keep-secret');assert.equal(ids.includes('dialogue.jory-truth'),choice==='tell-truth');
  assert.equal(sim.journal().filter(e=>e.done).length,3);
 }
});

test('breadcrumb trail: BFS route round a wall, dots every ~0.86 m capped at the trail length, door hints',()=>{
 const wall=new Set();for(let j=-5;j<=5;j++)wall.add('3,'+j);
 const flagsAt=(i,j)=>wall.has(i+','+j)?FLAG.BLOCK:0;
 const path=planRoute({x:0,z:0},{x:6*TILE,z:0},flagsAt);
 assert.ok(path.length>6,'detour around the wall');assert.ok(path.every(([x,z])=>!wall.has(tileOf(x)+','+tileOf(z))),'never through the wall');
 const out=new Float32Array(TRAIL.maxDots*3),n=layDots({x:0,z:0},path,{max:10},out);
 assert.ok(n>5&&n<=Math.ceil((10-TRAIL.skip)/TRAIL.spacing)+1);assert.ok(out[(n-1)*3+2]<=1);
 const first=Math.hypot(out[0],out[1]);assert.ok(Math.abs(first-TRAIL.skip)<1e-6,'first dot after the skip distance');
 assert.equal(layDots({x:0,z:0},[[0,0]],{},out),0);
 const door=doorOnRoute([[TILE,0],[2*TILE,0]],(i,j)=>i===2&&j===0?4:0);assert.deepEqual(door,{x:2*TILE,z:0,kind:'door'});
 const e=edgeArrow(190,90,90,80);assert.equal(e.inside,false);assert.ok(Math.abs(Math.hypot(e.x-90,e.y-90)-80)<1e-9);assert.equal(edgeArrow(100,90,90,80).inside,true);
 const cache=createTileCache();assert.equal(cache.needs(0,0),true);cache.set({center:[0,0],radius:40,tiles:[[1,1,1,0],[2,1,0,4]]});
 assert.equal(cache.flagsAt(1,1),1);assert.equal(cache.doorAt(2,1),4);assert.equal(cache.needs(5,5),false);assert.equal(cache.needs(30,0),true);
 cache.set({center:[0,0],radius:40,tiles:[]});assert.equal(cache.flagsAt(1,1),0,'a fresh window replaces stale flags');
 assert.deepEqual(guidanceSettings({trail:false,length:20}),{trail:false,minimap:true,tiles:20});
});

test('trail rendering stays cheap: instanced, no per-frame allocation in frame()',()=>{
 const src=read('quest-trail.js'),frame=src.slice(src.indexOf('  frame(now=performance.now()){'),src.indexOf('  // project(x,z)'));
 assert.match(src,/new T\.InstancedMesh\(geometry,material,max\)/);
 assert.doesNotMatch(frame,/new |\[\]|\{\}|\.map\(|\.filter\(/,'frame() allocates nothing');
 assert.match(read('game.js'),/questUiRef\?\.trail\.frame\(\)/);assert.match(read('game.js'),/tracker\.onTarget\(/);
 assert.match(read('game.js'),/mountGuidanceSettings\(document\.querySelector\('\[data-settings-panel="gameplay"\]'\)/);
});

test('cutscene hooks: unseen stage scenes play once, completion scenes before the scroll; steps validate',()=>{
 const d=sample();
 const q=row(d,{progress:{_stage:'new-strap',_seen:[]}});
 assert.equal(pendingQuestCutscene([q]).name,'bell-strap');
 assert.equal(pendingQuestCutscene([{...q,progress:{_stage:'new-strap',_seen:['bell-strap']}}]),null);
 assert.equal(pendingQuestCutscene([q],new Set(['q1:bell-strap'])),null);
 assert.equal(completionCutscene(q).name,'bell-rings');
 for(const scene of Object.values(d.cutscenes))assert.ok(validCutscene(scene),scene.name);
 assert.equal(validCutscene({steps:[{npc:{id:'x',to:[1]}}]}),false);
});

test('console helpers: stage toggle and empty v2 fields dropped on save',()=>{
 const d={name:'X',description:'Desc',objectives:[{type:'talk',target:'n',amount:1}]};
 toggleStages(d,true);assert.equal(d.stages[0].journal,'Desc');assert.deepEqual(d.objectives,[]);
 const out=cleanV2({...d,requirements:{quests:[],skills:{},items:{}},unlocks:[],lamps:[],cutscenes:{},onComplete:{},journalVariants:[],branchDialogue:[]});
 assert.deepEqual(Object.keys(out).sort(),['description','name','objectives','stages']);
 toggleStages(d,false);assert.equal(d.stages,undefined);assert.equal(d.objectives.length,1);
});

test('quest v2 SQL: repo rules, anchors match the md5-verified live text exactly once',async()=>{
 for(const f of ['db/quests-v2.sql','db/quests-v2-sample.sql']){const sql=read(f);
  for(const w of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+w+'\\b','i').test(sql),f+' avoids '+w);
  assert.match(sql,/^begin;\nset local lock_timeout='5s';/m,f);assert.match(sql,/commit;\s*$/,f);}
 const live=JSON.parse(read('scripts/quests-v2-db/live-functions.json'));
 const md5={realm_request_before_stories:'131a9f6c8bcdb0c21bf7cfc93eea9bd4',quest_event:'27be98eb1785ed2102683fc080012999',quest_refresh:'ae34a3430da74cda9116d8168e69d553',admin_action:'70dc35feead38ec661e19fe1cf5b1d20',quest_snapshot:'fa18ad45241640f216f6a19f63793663'};
 for(const [k,v] of Object.entries(md5))assert.equal(crypto.createHash('md5').update(live[k]).digest('hex'),v,k+' copy is the live text');
 const {anchors,PATCHED}=await import('../scripts/quests-v2-db/live-anchors.mjs');const list=anchors();assert.equal(list.length,10);
 for(const a of list){assert.equal(live[PATCHED[a.fn]].split(a.old).length-1,1,a.fn+': '+a.old.slice(0,60));assert.notEqual(a.old,a.next)}
 const sql=read('db/quests-v2.sql');for(const m of sql.matchAll(/\bif\b[^;]*?\bcase\b/gi))assert.match(m[0],/\(\s*case\b/i,'CASE inside IF is parenthesised: '+m[0].slice(0,60));
});
