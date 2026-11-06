// Pure quest guidance rules shared by the quest markers, the tracker under the minimap and the
// NPC conversation (tests/quest-guide.test.js). Input is the quest snapshot the server sends with
// every realm sync (eldervale_private.quest_snapshot): {id,data,accepted,completed,progress}.
import {objectiveCount,questReady} from './tutorial-logic.js?v=release-20261106-stomp119';
import {questView,isStaged,currentStage,stageReport,atFinalStage,requirementRows,branchLines,stageNpc} from './quest-v2.js?v=release-20261106-stomp119';

export const isTutorialQuest=q=>q?.data?.chain==='tutorial';
const skillLevel=(ctx,skill)=>Number(ctx.skillLevel?.(skill))||1;
// Prerequisites: an earlier quest key (data.requires) and optional skill levels (data.requirements).
// Tutorial quests are only listed for trainees, so a finished training's keys count as met.
export function requirementsMet(q,quests=[],ctx={}){
 const d=q?.data||{};
 if(d.requires){const prior=quests.find(x=>x?.data?.key===d.requires);
  if(prior){if(!prior.completed)return false}
  else if(!(String(d.requires).startsWith('tutorial')&&!ctx.trainee))return false}
 return requirementRows(d,quests,ctx).every(r=>r.met);
}
export function missingRequirements(q,quests=[],ctx={}){
 const d=q?.data||{},out=[];
 if(d.requires){const prior=quests.find(x=>x?.data?.key===d.requires);if(prior&&!prior.completed)out.push('Complete '+prior.data.name);else if(!prior&&!(String(d.requires).startsWith('tutorial')&&!ctx.trainee))out.push('Complete an earlier quest')}
 for(const r of requirementRows(d,quests,ctx))if(!r.met)out.push(r.label);
 return out;
}
// Staged quests (quest-v2.js) hand in at the giver only from their final stage.
export const readyToHandIn=(q,carried=()=>0)=>!!q?.accepted&&!q.completed&&atFinalStage(q)&&Array.isArray(questView(q).data?.objectives)&&questReady(questView(q),carried);
// Visible to this player at all: published (or already accepted) and, for the castle training,
// only while the player is a trainee.
export const questVisible=(q,ctx={})=>!!q?.data&&!q.completed&&(!isTutorialQuest(q)||!!ctx.trainee)&&(q.accepted||q.data.published!==false);
export const canStart=(q,quests,ctx={})=>questVisible(q,ctx)&&!q.accepted&&requirementsMet(q,quests,ctx);

// '?' beats '!': a giver with a quest to hand in shows the question mark.
export function markerFor(npcId,quests=[],ctx={}){
 let mark=null;
 for(const q of quests){if(!questVisible(q,ctx))continue;
  if(stageReport(q,ctx.carried)?.npc===npcId)return '?';
  if(q?.data?.giver!==npcId)continue;
  if(readyToHandIn(q,ctx.carried))return '?';
  if(canStart(q,quests,ctx))mark='!'}
 return mark;
}
// Every quest giver that should carry a marker: Map npcId -> '!' | '?'.
export function giverMarkers(quests=[],ctx={}){
 const out=new Map();for(const id of new Set([...quests.map(q=>q?.data?.giver),...quests.map(q=>stageReport(q,ctx.carried)?.npc)].filter(Boolean))){const m=markerFor(id,quests,ctx);if(m)out.set(id,m)}return out;
}

// The quest the tracker shows: the remembered one if still active, else the most recently
// accepted unfinished quest (snapshot order), tutorial chain first while training.
export function trackedQuest(quests=[],ctx={},preferred=null){
 const active=quests.filter(q=>q?.accepted&&!q.completed&&questVisible(q,ctx));
 return active.find(q=>q.id===preferred)||active.find(isTutorialQuest)||active.at(-1)||null;
}
// Current step of a quest: the first unfinished objective, or "Return to <giver>" when done.
// names(id) (optional) gives an NPC's display name for staged quests' report steps.
export function trackerStep(q,carried=()=>0,names=null){
 if(!q?.data)return null;const giver=q.data.giverName||'the quest giver';
 if(!q.accepted)return {state:'offer',label:'Talk to '+giver,target:q.data.giver};
 const report=stageReport(q,carried),staged=isStaged(q.data),total=staged?q.data.stages.length:null,stageNo=staged?Math.min(total,(q.progress?._done?.length||0)+1):null;
 if(report){const who=names?.(report.npc)||(report.npc===q.data.giver?giver:'them');return {state:'report',label:(report.kind==='choice'?'Decide with ':'Report to ')+who,target:report.npc,done:stageNo,total,stage:stageNo}}
 q=questView(q);const objectives=q.data.objectives||[];
 const i=objectives.findIndex((_,k)=>objectiveCount(q,k,carried)<objectives[k].amount);
 if(i<0){if(staged&&!atFinalStage(q))return {state:'active',label:'Keep going',target:stageNpc(q.data,q.stage),done:stageNo,total,stage:stageNo};
  return {state:'ready',label:'Return to '+giver,target:q.data.giver,done:staged?stageNo:objectives.length,total:staged?total:objectives.length,...(staged?{stage:stageNo}:{})}}
 const o=objectives[i],count=objectiveCount(q,i,carried);
 const label=o.label||(o.type==='collect'?'Collect '+o.target:o.type==='talk'?'Talk to '+o.target:o.type==='kill'?'Defeat '+o.target:o.type);
 // hint: an NPC/object id, {x,z} or {x,z,kind:'door'|'stairs'|'cave',label} waypoint for the trail.
 const hint=o.hint&&typeof o.hint==='object'&&o.hint.kind?o.hint:null;
 return {state:'active',index:i,label,count,amount:o.amount,target:hint?(o.type==='talk'||o.type==='kill'?o.target:o.type==='visit'?{x:o.x,z:o.z}:{x:hint.x,z:hint.z}):o.hint??(o.type==='talk'||o.type==='kill'?o.target:o.type==='visit'?{x:o.x,z:o.z}:null),...(hint?{via:hint}:{}),done:staged?stageNo:i,total:staged?total:objectives.length,...(staged?{stage:stageNo}:{})};
}

// ---- conversation planning
// Options shown under the NPC's greeting, in order: Talk, one entry per quest, then services, Bye.
export function dialogueTopics(profile,npcId,quests=[],ctx={}){
 const out=[];const lines=profile?.lines||[];
 if(lines.length>1)out.push({action:'talk',label:'Talk'});
 for(const q of quests){if(!questVisible(q,ctx))continue;const report=stageReport(q,ctx.carried);
  if(report?.npc===npcId){out.push({action:'quest',quest:q.id,stage:'report',label:report.kind==='choice'?'About “'+q.data.name+'”…':'I have done what you asked (“'+q.data.name+'”).',mark:'?'});continue}
  const st=q.accepted&&!q.completed?currentStage(q):null;
  if(st?.npc===npcId&&q.data.giver!==npcId){out.push({action:'quest',quest:q.id,stage:'progress',label:'About “'+q.data.name+'”…'});continue}
  if(q?.data?.giver!==npcId)continue;
  const name=q.data.name;
  if(readyToHandIn(q,ctx.carried))out.push({action:'quest',quest:q.id,stage:'complete',label:'I have finished “'+name+'”.',mark:'?'});
  else if(q.accepted)out.push({action:'quest',quest:q.id,stage:'progress',label:'About “'+name+'”…'});
  else out.push({action:'quest',quest:q.id,stage:'offer',label:'Ask about “'+name+'”',mark:requirementsMet(q,quests,ctx)?'!':null})}
 // Talk objectives of other givers' quests that point at this NPC.
 for(const q of quests){if(!q?.accepted||q.completed||q.data?.giver===npcId)continue;
  const v=questView(q);(v.data.objectives||[]).forEach((o,i)=>{if(o.type==='talk'&&o.target===npcId&&objectiveCount(v,i)<o.amount)out.push({action:'quest',quest:q.id,stage:'errand',objective:i,label:o.label||'About “'+q.data.name+'”…'})})}
 const role=profile?.role;
 if(role==='merchant')out.push({action:'trade',label:'Trade'});
 if(role==='banker')out.push({action:'bank',label:'Bank'});
 out.push({action:'bye',label:'Bye'});
 return out;
}
const asLines=(list,fallback)=>(Array.isArray(list)&&list.length?list:fallback).map(l=>typeof l==='string'?{who:'npc',text:l}:l).filter(l=>l&&typeof l.text==='string'&&l.text.trim());
// Pages for one quest topic and what happens after the last page.
export function questPages(q,stage,ctx={},quests=[]){
 const d=q?.data||{},dialogue=d.dialogue||{};
 if(stage==='offer'){
  const missing=missingRequirements(q,quests,ctx);
  if(missing.length)return {pages:[{who:'npc',text:'I may have work for you later. First: '+missing.join(', ')+'.'}],then:null};
  return {pages:asLines(dialogue.offer,[{who:'npc',text:d.description||d.name}]),then:'accept'};
 }
 const flags=q?.progress?._flags||{};
 if(stage==='complete')return {pages:asLines(branchLines(d,'complete',flags)||dialogue.complete,[{who:'npc',text:'Well done! That is everything I asked for.'}]),then:'complete'};
 if(stage==='errand'){const o=questView(q).data.objectives?.[ctx.objective];return {pages:asLines(o?.dialogue,[{who:'npc',text:o?.label||d.name}]),then:null}}
 if(stage==='report'){const st=currentStage(q);
  if(st?.choices?.length)return {pages:asLines(st.dialogue?.choice,[{who:'npc',text:'So, what will it be?'}]),then:'choose',choices:st.choices.map(c=>({label:c.label,value:c.id,dialogue:c.dialogue||[]}))};
  return {pages:asLines(st?.dialogue?.advance,[{who:'npc',text:'Good work. Now for the next part.'}]),then:'advance'}}
 const step=trackerStep(q,ctx.carried);
 const st=q?.accepted?currentStage(q):null;
 return {pages:asLines(st?.dialogue?.progress||branchLines(d,'progress',flags)||dialogue.progress,[{who:'npc',text:step?.label?'How goes it? '+step.label+(step.amount>1?' ('+step.count+'/'+step.amount+')':'')+'.':d.description||d.name}]),then:null};
}
