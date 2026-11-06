// Pure rules for the castle training: mirrors the server (db/castle-tutorial.sql) so the
// client can show the right objective, arrow and gate state without guessing.
import {CASTLE_CENTRE,CASTLE_INNER_HALF,GATE_MESSAGE} from './tutorial-data.js?v=release-20261106-ui94';

export const insideCastle=(x,z)=>Math.abs(x-CASTLE_CENTRE.x)<=CASTLE_INNER_HALF&&Math.abs(z-CASTLE_CENTRE.z)<=CASTLE_INNER_HALF;
// Same rule as can_step: a trainee may move anywhere except from inside the courtyard to outside it.
export const exitBlocked=(locked,from,to)=>!!locked&&insideCastle(from.x,from.z)&&!insideCastle(to.x,to.z);
export const tutorialLocked=flags=>!!(flags&&flags.active&&!flags.done);
export const needsCutscene=(flags,id='arrival')=>tutorialLocked(flags)&&!(flags.cutscenes||[]).includes(id);
export {GATE_MESSAGE};

// Objective progress as shown to the player. collect counts what is carried (handed in at the end);
// everything else is the server's latched progress.
export function objectiveCount(quest,index,carried=()=>0){
 const o=quest.data.objectives[index];
 const n=o.type==='collect'?carried(o.target):Number(quest.progress?.[index])||0;
 return Math.min(o.amount,n);
}
export const objectiveDone=(quest,index,carried)=>objectiveCount(quest,index,carried)>=quest.data.objectives[index].amount;
export const questReady=(quest,carried)=>quest.accepted&&quest.data.objectives.every((_,i)=>objectiveDone(quest,i,carried));

export const tutorialQuestsOf=(quests=[])=>quests.filter(q=>q.data?.chain==='tutorial').sort((a,b)=>(a.data.order||0)-(b.data.order||0));

// The step the player should work on now: offer (talk to giver), active (do objective i) or ready (return to giver).
export function currentStep(quests,carried){
 const chain=tutorialQuestsOf(quests);if(!chain.length)return null;
 const quest=chain.find(q=>!q.completed);
 if(!quest)return {state:'finished',quest:chain.at(-1),index:chain.length-1,total:chain.length};
 const index=chain.indexOf(quest),base={quest,index,total:chain.length};
 if(!quest.accepted)return {...base,state:'offer',target:quest.data.giver,label:'Talk to '+(quest.data.giverName||'your tutor')};
 const objective=quest.data.objectives.findIndex((_,i)=>!objectiveDone(quest,i,carried));
 if(objective<0)return {...base,state:'ready',target:quest.data.giver,label:'Return to '+(quest.data.giverName||'your tutor')};
 const o=quest.data.objectives[objective];
 return {...base,state:'active',objective,target:o.hint??(o.type==='talk'||o.type==='kill'?o.target:o.type==='visit'?{x:o.x,z:o.z}:null),label:o.label,count:objectiveCount(quest,objective,carried),amount:o.amount};
}

// What a tutor says when clicked, and which server command (if any) follows the lines.
export function talkPlan(quests,npcId,carried){
 const step=currentStep(quests,carried);if(!step||step.state==='finished')return null;
 const {quest}=step,d=quest.data.dialogue||{};
 if(quest.data.giver===npcId){
  if(step.state==='offer')return {lines:d.offer||[{who:'npc',text:quest.data.description}],command:'quest_accept',quest};
  if(step.state==='ready')return {lines:d.complete||[{who:'npc',text:'Well done.'}],command:'quest_complete',quest,finishes:quest.data.finishes};
  return {lines:d.progress||[{who:'npc',text:step.label}],command:null,quest,supplies:true};
 }
 if(quest.accepted){const o=quest.data.objectives.find(o=>o.type==='talk'&&o.target===npcId);if(o)return {lines:o.dialogue||[{who:'npc',text:o.label}],command:null,quest}}
 return null;
}

// Compass words for the HUD arrow ("north-west, 24 m"); -z is north on the world map.
export function bearing(from,to){
 const dx=to.x-from.x,dz=to.z-from.z,distance=Math.hypot(dx,dz);
 if(distance<2)return {distance,text:'here'};
 const names=['north','north-east','east','south-east','south','south-west','west','north-west'];
 const angle=Math.atan2(dx,-dz),sector=((Math.round(angle/(Math.PI/4))%8)+8)%8;
 return {distance,text:names[sector]+', '+Math.round(distance)+' m'};
}
