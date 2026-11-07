import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {requirementsMet,missingRequirements,readyToHandIn,markerFor,giverMarkers,trackedQuest,trackerStep,dialogueTopics,questPages,questVisible} from '../quest-guide.js';
import {markerHeight,markerScale,MARKER_GLYPHS} from '../quest-markers.js';
import {tutorialQuestRows} from '../tutorial-data.js';
import {wantsPrologue,PROLOGUE_LINES} from '../tutorial-prologue.js';

const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8');
const q=(id,data,extra={})=>({id,data:{published:true,objectives:[{type:'talk',target:'x',amount:1,label:'Talk to X'}],...data},accepted:false,completed:false,progress:{},...extra});

test('"!" over a giver with a startable quest, "?" when a quest is ready to hand in ("?" wins)',()=>{
 const rows=[q('a',{name:'A',giver:'npc1',key:'a'}),q('b',{name:'B',giver:'npc2',requires:'a'}),q('c',{name:'C',giver:'npc3'},{accepted:true,progress:{0:1}}),q('d',{name:'D',giver:'npc3'})];
 assert.equal(markerFor('npc1',rows),'!');
 assert.equal(markerFor('npc2',rows),null,'prerequisite not finished: no marker');
 assert.equal(markerFor('npc3',rows),'?','hand-in beats a new offer');
 assert.equal(markerFor('npc4',rows),null);
 rows[0].completed=true;assert.equal(markerFor('npc2',rows),'!','prerequisite done');assert.equal(markerFor('npc1',rows),null,'completed quests carry no marker');
 assert.deepEqual([...giverMarkers(rows)].sort(),[['npc2','!'],['npc3','?']]);
 const inProgress=q('e',{name:'E',giver:'npc5'},{accepted:true,progress:{0:0}});assert.equal(markerFor('npc5',[inProgress]),null,'in progress: nothing to do at the giver');
 assert.equal(markerFor('npc6',[q('f',{name:'F',giver:'npc6',published:false})]),null,'unpublished quests are hidden');
});

test('collect objectives count what is carried; skill requirements gate the "!"',()=>{
 const logs=q('l',{name:'Logs',giver:'g',objectives:[{type:'collect',target:'wood',amount:3}]},{accepted:true});
 assert.equal(readyToHandIn(logs,()=>2),false);assert.equal(readyToHandIn(logs,()=>3),true);
 assert.equal(markerFor('g',[logs],{carried:()=>3}),'?');
 const smith=q('s',{name:'Forge',giver:'g2',requirements:{smithing:20}});
 assert.equal(requirementsMet(smith,[],{skillLevel:()=>10}),false);assert.equal(markerFor('g2',[smith],{skillLevel:()=>25}),'!');
 assert.deepEqual(missingRequirements(smith,[],{skillLevel:()=>1}),['Level 20 Smithing']);
});

test('tutorial quests: markers only for trainees, and only on the next quest of the chain',()=>{
 const rows=tutorialQuestRows().map(r=>({id:r.id,data:r.data,accepted:false,completed:false,progress:{}}));
 const marks=giverMarkers(rows,{trainee:true});assert.equal(marks.size,1,'only the first lesson is open');assert.equal(marks.get(rows[0].data.giver),'!');
 assert.equal(giverMarkers(rows,{trainee:false}).size,0,'graduates never see training markers');
 assert.equal(questVisible(rows[0],{trainee:false}),false);
 // A graduate's quest that requires the last training quest is open even though training rows are no longer listed.
 assert.equal(requirementsMet(q('x',{name:'X',giver:'n',requires:'tutorial-graduation'}),[],{trainee:false}),true);
 assert.equal(requirementsMet(q('x',{name:'X',giver:'n',requires:'tutorial-graduation'}),[],{trainee:true}),false);
});

test('tracker shows the remembered or latest active quest and its current step',()=>{
 const a=q('a',{name:'A',giver:'n',giverName:'Nell',objectives:[{type:'kill',target:'rat',amount:3,label:'Chase off rats'},{type:'talk',target:'m',amount:1,label:'Tell Mira'}]},{accepted:true,progress:{0:2}});
 const b=q('b',{name:'B',giver:'n'},{accepted:true,progress:{0:1}});
 assert.equal(trackedQuest([a,b]).id,'b','latest accepted');assert.equal(trackedQuest([a,b],{},'a').id,'a','remembered');
 assert.equal(trackedQuest([q('c',{name:'C',giver:'n'})]),null,'nothing accepted');
 assert.deepEqual(trackerStep(a),{state:'active',index:0,label:'Chase off rats',count:2,amount:3,target:'rat',done:0,total:2});
 a.progress={0:3};assert.equal(trackerStep(a).label,'Tell Mira');a.progress={0:3,1:1};
 assert.deepEqual(trackerStep(a),{state:'ready',label:'Return to Nell',target:'n',done:2,total:2});
 const hook=read('quest-tracker.js');assert.match(hook,/onTarget\(fn\)/,'breadcrumb hook for round 2');assert.match(hook,/openJournal\(current\.id\)/,'tap opens the journal');
});

test('one conversation: greeting options are Talk, quest topics, services, then Bye',()=>{
 const rows=[q('a',{name:'Lost Ledger',giver:'npc',key:'a'}),q('b',{name:'Bells',giver:'npc'},{accepted:true,progress:{0:1}}),q('c',{name:'Errand',giver:'other',objectives:[{type:'talk',target:'npc',amount:1,label:'Ask the baker about flour'}]},{accepted:true})];
 const topics=dialogueTopics({role:'merchant',lines:['Hello!','Fine weather.']},'npc',rows);
 assert.deepEqual(topics.map(t=>t.action),['talk','quest','quest','quest','trade','bye']);
 assert.deepEqual(topics.filter(t=>t.action==='quest').map(t=>t.stage),['offer','complete','errand']);
 assert.equal(topics[1].mark,'!');assert.equal(topics[2].mark,'?');assert.match(topics[1].label,/Lost Ledger/);
 assert.deepEqual(dialogueTopics({role:'banker',lines:['Hi']},'npc',[]).map(t=>t.action),['bank','bye']);
 const offer=questPages(rows[0],'offer');assert.equal(offer.then,'accept');assert.equal(offer.pages[0].who,'npc');
 const locked=q('d',{name:'Later',giver:'npc',requires:'a'});const pages=questPages(locked,'offer',{},[locked,rows[0]]);assert.equal(pages.then,null);assert.match(pages.pages[0].text,/Complete Lost Ledger/);
 assert.equal(questPages(rows[1],'complete').then,'complete');
 const dialogue=q('e',{name:'E',giver:'npc',dialogue:{offer:[{who:'npc',text:'One'},{who:'player',text:'Two'}]}});assert.deepEqual(questPages(dialogue,'offer').pages.map(p=>p.who),['npc','player']);
});

test('game wires one dialogue box: no stacked quest panel, tutorial reuses it, repeat talk ignored',()=>{
 const game=read('game.js'),tut=read('tutorial.js'),dlg=read('npc-dialogue.js');
 assert.match(game,/if\(npcDialogue\.isOpenFor\(profile\)\)return;/,'a second talk request for the same NPC is ignored');
 assert.doesNotMatch(game,/eldervaleQuestJournal\.open\(questNpc\)/,'talking no longer opens the journal next to the dialogue');
 assert.match(game,/converse\(npcDialogue,/);assert.match(game,/npcDialogue:\{start:profile=>npcDialogue\.open/);
 assert.match(tut,/if\(talking\)return true;/,'a busy tutor swallows the repeat instead of opening a second box');
 assert.match(dlg,/'Yes, I accept\.'/);assert.match(dlg,/'Not right now\.'/);assert.match(dlg,/command\('quest_accept'/);assert.match(dlg,/command\('quest_complete'/);
 assert.match(read('quest-ui.css'),/\.quest-tracker\{position:fixed/);
});

test('quest markers: billboard instancing, yellow ! and ?, LOD-culled, on the minimap',()=>{
 const src=read('quest-markers.js'),game=read('game.js');
 assert.deepEqual(MARKER_GLYPHS,['!','?']);assert.match(src,/new T\.InstancedMesh/);assert.match(src,/fog:false/);assert.match(src,/a\.lodHidden/);
 assert.match(game,/questUiRef\?\.markers\.drawMinimap\(ctx,/);assert.match(game,/questUiRef\?\.markers\.frame\(camera\)/);
 assert.equal(markerHeight({position:{y:2},scale:{y:1}}),5.25,'fallback above a hat when nothing is measured yet');assert.equal(markerHeight({position:{y:0},scale:{y:.3}}),3.25*.85,'tiny model scales still clear the head');assert.equal(markerScale(5),1);assert.ok(markerScale(40)>3);assert.equal(markerScale(1000),4);
});

test('arrival prologue starts at character creation, before game.js loads',()=>{
 assert.equal(wantsPrologue({game_flags:{tutorial:{active:true,cutscenes:[]}}}),true);
 assert.equal(wantsPrologue({game_flags:{tutorial:{active:true,cutscenes:['arrival']}}}),false);
 assert.equal(wantsPrologue({game_flags:{tutorial:{active:true,done:true}}}),false);assert.equal(wantsPrologue({}),false);
 assert.ok(PROLOGUE_LINES.length>=2&&PROLOGUE_LINES.every(l=>l.length<120));
 const auth=read('auth.js'),start=auth.indexOf('m.startPrologue()'),game=auth.indexOf("await import('/game.js");
 assert.ok(start>0&&game>start,'prologue is kicked off before the game module is imported');
 assert.doesNotMatch(auth,/const social=await import/,'chat no longer delays the world');
 const tut=read('tutorial.js');assert.match(tut,/prologue\?0:900/,'no extra delay once the prologue is up');assert.match(tut,/prologue\.handoff\(\)/);
 assert.match(read('tutorial.css'),/:not\(\.tutorial-prologue\)/);
});
