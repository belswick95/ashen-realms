import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {questStatus,QUEST_STATUS,questPoints,journalSections,journalSummary,rewardEntries,objectiveRows,newlyCompleted,questIconHtml,skillInfo} from '../quests.js';
import {tutorialQuests,tutorialQuestRows} from '../tutorial-data.js';
import {goods} from '../economy.js';
import {skillLevel} from '../combat-level.js';
import {composeJingle} from '../jingles.js';
import {buildJournal,questUpsertSql} from '../scripts/build-castle-tutorial-seed.mjs';

const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8');
const rows=()=>tutorialQuestRows().map(r=>({id:r.id,data:r.data,accepted:false,completed:false,progress:{}}));

test('status colours follow RuneScape: grey not started, yellow in progress, green completed',()=>{
 assert.equal(questStatus({accepted:false,completed:false}),'notStarted');
 assert.equal(questStatus({accepted:true,completed:false}),'started');
 assert.equal(questStatus({accepted:true,completed:true}),'complete');
 assert.equal(questStatus({completed:true}),'complete','migrated players report completed without a row');
 const css=read('quests.css'),colour=name=>css.match(new RegExp('--quest-'+name+':(#[0-9a-f]{3,6})'))?.[1];
 assert.equal(colour('grey'),'#b9b6ad');assert.equal(colour('yellow'),'#ffe04a');assert.equal(colour('green'),'#45dc55');
 for(const [k,v]of [['notStarted','grey'],['started','yellow'],['complete','green']])assert.match(css,new RegExp('\\.'+QUEST_STATUS[k].className+'\\{color:var\\(--quest-'+v+'\\)'));
});

test('journal lists Castle Training first in chain order, then other quests; summary counts quest points',()=>{
 const list=rows().reverse();list.push({id:'x',data:{name:'Side quest',objectives:[]},accepted:true,completed:true,progress:{}});
 list[0].completed=list[0].accepted=true;
 const sections=journalSections(list);
 assert.deepEqual(sections.map(s=>s.title),['Castle Training','Quests']);
 assert.deepEqual(sections[0].quests.map(q=>q.data.name),tutorialQuests.map(q=>q.name));
 assert.deepEqual(journalSummary(list),{total:9,complete:2,started:0,points:2,maxPoints:9});
 assert.equal(questPoints({data:{questPoints:3}}),3);
});

test('completed quests show every objective done; started quests show progress',()=>{
 const [q]=rows();assert.ok(objectiveRows(q).every(o=>!o.done&&!o.started));
 q.accepted=true;q.progress={0:1,2:5};const o=objectiveRows(q);assert.ok(o[0].done);assert.equal(o[2].count,5);assert.ok(!o[2].done);
 q.completed=true;q.progress={};assert.ok(objectiveRows(q).every(o=>o.done));
});

test('the completion scroll pops for one quest that turned complete, never on load or bulk changes',()=>{
 const a=rows();a[0].accepted=a[1].accepted=true;
 assert.deepEqual(newlyCompleted(null,a),[]);
 const prev=new Map(a.map(q=>[q.id,questStatus(q)]));
 const b=a.map(q=>({...q}));b[0].completed=true;assert.deepEqual(newlyCompleted(prev,b).map(q=>q.id),[a[0].id]);
 const c=a.map(q=>({...q,accepted:true,completed:true}));assert.deepEqual(newlyCompleted(prev,c),[],'skip/migration marks many complete at once');
});

// Skills each starter quest actually exercises.
const exercised={'tutorial-combat':['attack','strength','defence','hitpoints'],'tutorial-woodcutting':['woodcutting','firemaking'],'tutorial-fishing':['fishing'],'tutorial-cooking':['cooking'],
 'tutorial-smithing':['mining','smithing'],'tutorial-banking':[],'tutorial-prayer':['prayer'],'tutorial-graduation':[]};
test('every starter quest rewards XP in each skill it used (levels 2-4), and items or coins',()=>{
 assert.deepEqual(Object.keys(exercised),tutorialQuests.map(q=>q.key));
 for(const q of tutorialQuests){
  assert.deepEqual(Object.keys(q.xp||{}).sort(),exercised[q.key].slice().sort(),q.key+' XP skills');
  for(const [skill,xp]of Object.entries(q.xp||{})){
   if(skill==='hitpoints'){assert.ok(xp>0&&xp<1358-1154,'Hitpoints reward stays under one level from 10');continue}
   // Reward plus generous allowance for the XP earned doing the objectives.
   assert.ok(skillLevel(xp)>=2&&skillLevel(xp+80)<=4,q.key+' '+skill+' '+xp+' lands on level 2-4');
  }
  assert.ok(Object.keys(q.items||{}).length||q.gold>0,q.key+' gives items or coins');
  for(const id of Object.keys(q.items||{}))assert.ok(goods[id],id+' exists');
  assert.ok(q.icon==='coins'||goods[q.icon],q.key+' scroll icon');assert.ok(q.giverName,q.key+' names its tutor');
 }
 assert.ok(tutorialQuests.filter(q=>Object.keys(q.items||{}).length).length>=6,'most starter quests give items');
 const banking=tutorialQuests.find(q=>q.key==='tutorial-banking');assert.ok(banking.gold>=100&&Object.keys(banking.items).length);
 const gate=tutorialQuests.at(-1);assert.ok(gate.gold>=150&&gate.items.shrimp&&gate.items['armor:cape']);
});

test('reward lines: quest point, XP per skill with icons, items, coins',()=>{
 const gate=tutorialQuests.at(-1),lines=rewardEntries(tutorialQuests[0]);
 assert.deepEqual(lines.map(l=>l.label),['1 Quest Point','200 Attack XP','200 Strength XP','200 Defence XP','150 Hitpoints XP','Iron dagger']);
 assert.ok(lines.filter(l=>l.kind==='xp').every(l=>l.icon));
 assert.deepEqual(rewardEntries(gate).map(l=>l.kind),['points','item','item','item','coins']);assert.equal(rewardEntries(gate).at(-1).label,'150 coins');
 assert.equal(skillInfo('woodcutting').name,'Woodcutting');assert.match(questIconHtml({icon:'coins'}),/<svg/);assert.match(questIconHtml({icon:'candle'}),/<(svg|img)/);
});

test('quest-complete jingle is an original fanfare on the shared mixer',()=>{
 const j=composeJingle('quest');assert.equal(j.kind,'quest');assert.ok(j.duration>3&&j.duration<6);assert.ok(j.notes.some(n=>n.inst==='brass')&&j.notes.some(n=>n.inst==='timpani'));
 const journal=read('quests.js');assert.match(journal,/playLevelUpJingle\?\.\('quest'\)/);assert.match(journal,/prefers-reduced-motion/);
 assert.match(read('quests.css'),/@media\(prefers-reduced-motion:reduce\)/);
});

test('db/quest-journal-rewards.sql: approval-friendly, lists tutorial quests to everyone, refreshes accepted rewards',()=>{
 const sql=read('db/quest-journal-rewards.sql');
 assert.doesNotMatch(sql,/\b(drop|alter|delete)\b/i);
 assert.equal(sql,buildJournal(sql),'run node scripts/build-castle-tutorial-seed.mjs');assert.ok(sql.includes(questUpsertSql()));
 const snapshot=sql.slice(sql.indexOf('create or replace function eldervale_private.quest_snapshot'),sql.indexOf('$$;'));
 assert.doesNotMatch(snapshot,/tutorial_locked/,'tutorial quests are no longer limited to trainees');
 assert.match(snapshot,/game_flags->'tutorial'->>'done'/,'finished/migrated/skipped trainees see the chain as completed');
 assert.match(sql,/update eldervale_private\.player_quests pq\s+set data=pq\.data-'xp'-'items'-'gold'\|\|/);
 assert.match(sql,/pq\.completed_at is null/);
 // Accepting tutorial quests stays limited to trainees (unchanged in castle-tutorial.sql).
 assert.match(read('db/castle-tutorial.sql'),/if q\.data->>'chain'='tutorial' and not eldervale_private\.tutorial_locked\(uid\) then raise exception 'Quest unavailable'/);
});
