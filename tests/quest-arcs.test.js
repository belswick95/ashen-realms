// Round-3 quest arcs (scripts/quest-arcs/*.mjs -> db/quest-arc-*.sql): generated files are current,
// every quest is completable on every branch (quest v2 simulator), every reference resolves, the
// prerequisite graph follows docs/design-patterns.md §2, and arenas/positions are walkable.
// The server-side play-through is scripts/quest-arcs-db/check.mjs (PGlite).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {ARCS,buildAll,questRows,entitiesOf,allKeys,MAX_FILE} from '../scripts/quest-arcs/build.mjs';
import {createQuestSimulator,validateV2Draft,questGraph,requirementSpec,SKILL_NAMES,isFinalStage,nextStageId} from '../quest-v2.js';
import {validateDungeon,walkableLocal,THEMES} from '../underground-data.js';
import {dungeons} from '../underground-data.js';
import {professionItems} from '../profession-data.js';

const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8');
const rows=ARCS.flatMap(a=>questRows(a).map(r=>({...r,arc:a})));
const quests=rows.map(r=>r.data);
const entities=ARCS.flatMap(entitiesOf);
const npcIds=new Set(entities.filter(e=>e.data.kind==='npc').map(e=>e.id));
const monsterIds=new Set(entities.filter(e=>e.data.kind==='monster').map(e=>e.id));
const areas=ARCS.flatMap(a=>a.areas||[]);
// Items that exist: the arcs' own catalog rows, every item:<key> seeded by db/*.sql, profession items,
// and R3-I's reserved quest rewards (docs/bosses-and-uniques.md; left out until shipped).
const R3I=['shield:wardensAegis','armor:crownwardenSigil','armor:emberOathGauntlets','armor:pathfinderBoots','weapon:tidecallerStaff'];
const dbItems=new Set();for(const f of fs.readdirSync(new URL('db/',root)))if(f.endsWith('.sql')&&!f.startsWith('quest-arc-'))for(const m of read('db/'+f).matchAll(/item:([A-Za-z0-9_:]+)/g))dbItems.add(m[1]);
const known=new Set([...ARCS.flatMap(a=>a.items.map(i=>i[0].slice(5))),...dbItems,...Object.keys(professionItems),...R3I]);
const allStrings=v=>JSON.stringify(v);

test('generated SQL is current, within 40 KB, and free of DELETE/ALTER/DROP',()=>{
 const built=buildAll();
 assert.deepEqual(fs.readdirSync(new URL('db/',root)).filter(f=>f.startsWith('quest-arc-')).sort(),built.map(([n])=>n.slice(3)).sort(),'no stale arc files');
 for(const [name,body] of built){
  assert.equal(read(name),body,name+' is current (node --import ./tests/helpers/preload.js scripts/quest-arcs/build.mjs)');
  assert.ok(Buffer.byteLength(body)<=MAX_FILE,name+' ≤ 40 KB');
  for(const w of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+w+'\\b','i').test(body),name+' avoids '+w);
  assert.match(body,/^-- [^\n]+\n[\s\S]*\nbegin;\n[\s\S]*\ncommit;\n$/,name+' is one transaction');
 }
});

test('four arcs of five quests, unique keys and ids, all keys registered in the core file',()=>{
 assert.equal(ARCS.length,4);for(const a of ARCS)assert.equal(a.quests.length,5,a.arc.key);
 assert.deepEqual(quests.map(q=>q.key).sort(),allKeys().sort());
 assert.equal(new Set(rows.map(r=>r.id)).size,rows.length);assert.equal(new Set(entities.map(e=>e.id)).size,entities.length);
 const unl=quests.flatMap(q=>(q.unlocks||[]).map(u=>u.id));assert.equal(new Set(unl).size,unl.length,'unlock ids are unique');
});

test('every quest passes the console validator and every reference resolves',()=>{
 const ctx={npcs:npcIds,keys:new Set(allKeys()),items:known};
 for(const d of quests){
  assert.deepEqual(validateV2Draft(d,ctx),[],d.key);
  assert.ok(npcIds.has(d.giver),d.key+' giver');
  assert.ok(known.has(d.icon),d.key+' icon '+d.icon);
  for(const k of Object.keys({...d.items,...d.startItems}))assert.ok(known.has(k),d.key+' item '+k);
  for(const st of d.stages){
   assert.ok(st.journal.length<=800&&st.journal.length>40,d.key+'/'+st.id+' journal');
   if(st.npc)assert.ok(npcIds.has(st.npc),d.key+'/'+st.id+' npc');
   for(const o of st.objectives||[]){
    assert.ok(['talk','kill','collect','event','xp','have','visit'].includes(o.type),o.type);
    assert.ok(o.label&&o.label.length<=200);
    if(o.type==='talk')assert.ok(npcIds.has(o.target),d.key+' talk target');
    if(o.type==='kill')assert.ok(monsterIds.has(o.target),d.key+' kill target');
    if(o.type==='event'&&o.event==='death')for(const t of o.targets)assert.ok(monsterIds.has(t),d.key+' death target');
    if(['collect','have'].includes(o.type))assert.ok(known.has(o.target),d.key+' item '+o.target);
    if(o.type==='xp')assert.ok(SKILL_NAMES.includes(o.skill));
   }
   for(const c of st.choices||[])assert.ok(c.label.length<=120);
  }
  for(const [name,c] of Object.entries(d.cutscenes||{})){assert.ok(c.steps.length<=30);for(const s of c.steps)if(s.shot?.around)assert.ok(npcIds.has(s.shot.around),d.key+' cutscene '+name+' camera target')}
  const lines=allStrings(d).match(/"text":"[^"]*"/g)||[];for(const l of lines)assert.ok(l.length<=410,d.key+' line too long: '+l.slice(0,60));
  for(const u of d.unlocks||[])if(u.type==='dialogue')assert.ok(npcIds.has(u.npc),d.key+' dialogue unlock npc');
 }
 // Quest items handed in or carried must have a source: a start item, a monster drop or the catalog outside the arc.
 const own=new Set(ARCS.flatMap(a=>a.items.map(i=>i[0].slice(5)))),drops=new Set(entities.flatMap(e=>(e.data.loot||[]).map(l=>l.item))),starts=new Set(quests.flatMap(q=>Object.keys(q.startItems||{}))),rewards=new Set(quests.flatMap(q=>Object.keys(q.items||{})));
 for(const k of own)assert.ok(drops.has(k)||starts.has(k)||rewards.has(k),k+' has a source');
 for(const e of entities)for(const k of [...(e.data.loot||[]).map(l=>l.item),...Object.keys(e.data.shop||{})])assert.ok(known.has(k),e.data.name+' item '+k);
});

test('every quest is completable on every branch (simulator), with journal, flags and unlocks per branch',()=>{
 let runs=0;
 for(const d of quests){
  const choiceStages=d.stages.filter(s=>s.choices?.length);
  const plans=[null,...choiceStages.flatMap(s=>s.choices.map(c=>[s.id,c.id]))];
  for(const plan of plans){
   const sim=createQuestSimulator(d);let used=false;
   for(let i=0;i<120&&!sim.quest.completed;i++){const acts=sim.actions();assert.ok(acts.length,d.key+' stuck');
    const pick=acts.find(a=>a.kind==='choice'&&plan&&!used&&sim.quest.progress._stage===plan[0]&&a.choice===plan[1])||acts.find(a=>a.kind!=='choice')||acts[0];
    if(pick.kind==='choice'&&plan&&pick.choice===plan[1])used=true;sim.apply(pick)}
   assert.ok(sim.quest.completed,d.key+' completes '+(plan||[]).join(':'));
   const j=sim.journal();assert.ok(j.at(-1).complete&&j.at(-1).text.length>40);
   if(plan){const c=d.stages.find(s=>s.id===plan[0]).choices.find(x=>x.id===plan[1]);for(const [k,v] of Object.entries(c.flags||{}))assert.equal(sim.flags()[k],v)}
   runs++;
  }
 }
 assert.ok(runs>=40);
});

test('design rules: objective variety, cutscenes, rewards budget and an unlock in every quest',()=>{
 for(const d of quests){
  const types=new Set(d.stages.flatMap(s=>(s.objectives||[]).map(o=>o.type==='have'?'collect':o.type==='event'&&o.event==='death'?'kill':o.type)));
  if(d.stages.some(s=>s.choices?.length))types.add('choice');
  assert.ok(types.size>=3,d.key+' mixes ≥3 objective types: '+[...types]);
  assert.ok(Object.keys(d.cutscenes||{}).length>=2&&Object.keys(d.cutscenes).length<=(d.order===5?4:3),d.key+' 2–3 cutscenes (capstones 4)');
  assert.ok(d.onComplete?.cutscene&&!d.stages.some(s=>s.onEnter?.cutscene===d.onComplete.cutscene),d.key+' has its own payoff cutscene');
  assert.ok((d.unlocks||[]).length>=2,d.key+' changes the world');
  const xp=Object.values(d.xp||{}),cap={1:3000,2:12000,3:12000,4:40000,5:100000}[d.order];
  assert.ok(xp.length>=2&&xp.every(v=>v<=cap),d.key+' XP within budget');
  assert.equal(d.questPoints,{1:1,2:2,3:2,4:3,5:5}[d.order]);
  assert.ok((d.lamps||[]).length===1);
  if(d.order===5){assert.ok(xp.length>=3&&xp.some(v=>v>=50000),d.key+' capstone XP');
   for(const t of ['teleport','area'])assert.ok(d.unlocks.some(u=>u.type===t),d.key+' capstone '+t);
   assert.ok(d.unlocks.some(u=>u.id.startsWith('lair:')),d.key+' opens an R3-I lair');
   assert.ok(Object.keys(d.items).some(k=>R3I.includes(k))&&Object.keys(d.items).some(k=>k.startsWith('custom_qa_')),d.key+' capstone gear + keepsake')}
  if(d.order===4)assert.ok(d.unlocks.some(u=>u.type==='area'&&u.id.startsWith('area.')),d.key+' opens the arc arena');
 }
 const r3i=quests.flatMap(q=>Object.keys(q.items||{}).filter(k=>R3I.includes(k)));assert.deepEqual(r3i.sort(),[...R3I].sort(),'each reserved R3-I reward granted once');
});

test('prerequisites: no cycles, starters free, Q3 cross-links another arc, ramps, capstone gates (design-patterns §2)',()=>{
 const g=questGraph(quests);assert.deepEqual(g.cycles,[]);assert.deepEqual(g.missing,[]);
 const total=8+1+quests.reduce((n,q)=>n+q.questPoints,0);
 for(const a of ARCS){const qs=quests.filter(q=>q.chain==='arc-'+a.arc.key).sort((x,y)=>x.order-y.order);
  assert.equal(qs[0].requirements,undefined,a.arc.key+' starter has no requirements');
  for(const q of qs.slice(1)){const r=requirementSpec(q);assert.ok(r.quests.includes(qs[q.order-2].key),q.key+' requires the previous quest')}
  const q3=requirementSpec(qs[2]).quests;assert.ok(q3.some(k=>!k.startsWith('arc-'+a.arc.key)&&/-2$/.test(k)),a.arc.key+' Q3 requires another arc’s Q2');
  const cap=requirementSpec(qs[4]);assert.deepEqual(qs.slice(0,4).map(q=>q.key).every(k=>cap.quests.includes(k)),true);
  assert.ok(cap.qp>=Math.floor(total*.6),'capstone QP ≥ 60% of '+total);
  const lv=Object.entries(cap.skills).map(([s,v])=>[s,v.level]);assert.ok(lv.length>=3&&lv.every(([,l])=>l>=40&&l<=65));
  assert.ok(lv.some(([s])=>!['attack','strength','defence','hitpoints','ranged','magic','prayer'].includes(s)),'a non-combat capstone skill');
  for(const v of Object.values(cap.skills))assert.equal(v.boostable,false);
 }
 // A fresh account reaches everything: greedily complete what is startable (skills assumed trained).
 const done=new Set(['tutorial-graduation']);let qp=9;
 for(let pass=0;pass<10;pass++)for(const q of quests){if(done.has(q.key))continue;const r=requirementSpec(q);if(r.quests.every(k=>done.has(k))&&(r.qp||0)<=qp){done.add(q.key);qp+=q.questPoints}}
 assert.equal(done.size-1,quests.length,'every arc quest is reachable');
});

test('places: NPCs, monsters, visit spots and arena entrances are in the world; arenas validate and do not overlap',()=>{
 const roster=null;
 for(const a of areas){assert.deepEqual(validateDungeon(a,{others:[...dungeons,...areas],roster}),[],a.id);assert.ok(THEMES[a.theme])}
 const inArena=(x,z)=>{for(const a of areas)for(const lv of a.levels){const lx=x-a.origin.x,lz=z-(a.origin.z+lv.level*400);if(Math.abs(lx)<150&&Math.abs(lz)<150)return walkableLocal(lv,lx,lz)}return null};
 for(const e of entities){const w=inArena(e.data.x,e.data.z);if(w===null)assert.ok(Math.abs(e.data.x)<=420&&Math.abs(e.data.z)<=420,e.data.name+' in the overworld');else assert.ok(w,e.data.name+' stands on an arena floor')}
 for(const d of quests)for(const st of d.stages)for(const o of st.objectives||[])if(o.type==='visit'){const w=inArena(o.x,o.z);if(w===null)assert.ok(Math.abs(o.x)<=420&&Math.abs(o.z)<=420);else assert.ok(w,d.key+' visit spot on an arena floor')}
 // Every gate is opened by some quest, and every area/shortcut unlock opens something.
 const granted=new Set(quests.flatMap(q=>(q.unlocks||[]).map(u=>u.id)));
 for(const a of areas)for(const e of a.entrances)assert.ok(granted.has(e.requires.unlock),e.id);
 for(const s of ARCS.flatMap(a=>a.objects||[]).filter(o=>o.data.agility))assert.ok(granted.has(s.data.agility.requires.unlock));
 const gates=new Set([...areas.flatMap(a=>a.entrances.map(e=>e.requires.unlock)),...ARCS.flatMap(a=>(a.objects||[]).filter(o=>o.data.agility).map(o=>o.data.agility.requires.unlock))]);
 for(const q of quests)for(const u of q.unlocks||[])if((u.type==='area'&&!u.id.startsWith('lair:'))||u.type==='shortcut')assert.ok(gates.has(u.id),u.id+' opens a real gate');
 for(const q of quests)for(const u of q.unlocks||[])if(u.type==='teleport'){const w=inArena(u.x,u.z);assert.ok(w===null?Math.abs(u.x)<=420:w,u.id)}
});

test('original content: no borrowed proper nouns',()=>{
 const text=allStrings(ARCS.map(a=>({q:a.quests,n:a.npcs.map(e=>e.data),i:a.items,ar:a.areas})));
 for(const w of ['Lumbridge','Varrock','Falador','Ardougne','Gielinor','Saradomin','Zamorak','Guthix','Karamja','Misthalin','Asgarnia','Kandarin','Morytania','Wilderness','Draynor','Camelot','Excalibur','Gandalf','Hogwarts','Westeros','Skyrim','Azeroth'])assert.ok(!text.includes(w),w);
});
