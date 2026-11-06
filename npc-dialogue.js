// One NPC conversation box for everything an NPC says: greeting, small talk, quest offers,
// progress and hand-ins, tutor lessons and services. Drives the HUD's #dialog panel (portrait,
// name, text, choices, continue) so quest text never opens a second box on top of it.
// Flow: greeting line -> options (Talk / quest topics / Trade / Bank / Bye) -> pages -> accept/decline.
import {dialogueTopics,questPages,trackerStep} from './quest-guide.js?v=release-20261106-terrain111';
import {rewardEntries} from './quests.js?v=release-20261106-terrain111';
import {npcGreeting,npcDisplayName} from './npc-options.js?v=release-20261106-terrain111';

export const CLOSED=Symbol('closed');
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};

export function createNpcDialogue({dialog,nameEl,textEl,nextEl,choicesEl,portrait,selfName=()=>'You',onOpen=()=>{},onClose=()=>{}}){
 let current=null,waiting=null,token=0;
 const card=el('div','dialog-quest-card');card.hidden=true;dialog.insertBefore(card,choicesEl);
 const badge=dialog.querySelector('.dialog-badge');
 function settle(value){const w=waiting;waiting=null;if(w)w(value)}
 function keys(e){
  if(dialog.hidden||!current)return;
  if(e.key==='Escape'){e.preventDefault();close();return}
  if(!choicesEl.hidden&&/^[1-9]$/.test(e.key)){const b=choicesEl.querySelectorAll('button')[Number(e.key)-1];if(b){e.preventDefault();e.stopPropagation();b.click()}return}
  if(!nextEl.hidden&&(e.key===' '||e.key==='Enter')&&!e.target?.closest?.('button,input,textarea,select')){e.preventDefault();e.stopPropagation();nextEl.click()}
 }
 addEventListener('keydown',keys,true);
 function open(profile,root,name){
  close(false);current={profile,id:++token};
  dialog.hidden=false;dialog.dataset.who='npc';nameEl.textContent=name||npcDisplayName(profile);if(badge)badge.textContent='CONVERSATION';
  if(root)portrait?.open(root,name||npcDisplayName(profile));document.body.classList.add('npc-conversation');onOpen(profile);return current.id;
 }
 function show({who='npc',name,text,quest},continueLabel){
  dialog.dataset.who=who;nameEl.textContent=who==='player'?selfName():name||npcDisplayName(current?.profile);
  textEl.textContent=text||'';if(who!=='player')portrait?.speak?.(textEl.textContent);
  card.hidden=!quest;card.replaceChildren();if(quest)card.append(...quest);
  choicesEl.replaceChildren();choicesEl.hidden=true;nextEl.hidden=!continueLabel;if(continueLabel)nextEl.textContent=continueLabel;
 }
 // One page of dialogue; resolves when the player continues (or CLOSED if the box closed).
 function page(line,{last=false}={}){
  if(!current)return Promise.resolve(CLOSED);
  show(line,last?'Close':'Click here to continue');
  return new Promise(resolve=>{settle(CLOSED);waiting=resolve;nextEl.onclick=()=>settle(undefined);nextEl.focus({preventScroll:true})});
 }
 // Options under a line of text. options: [{label,value,mark}] -> value, or CLOSED.
 function choose(line,options){
  if(!current)return Promise.resolve(CLOSED);
  show(typeof line==='string'?{who:'npc',text:line}:line,null);
  if(!line||(typeof line==='object'&&!line.text&&!line.quest)){textEl.textContent='Select an option';dialog.dataset.who='choice'}
  return new Promise(resolve=>{settle(CLOSED);waiting=resolve;
   options.forEach((o,i)=>{const b=el('button',null);b.type='button';b.dataset.action=o.action||'';if(o.mark){const m=el('span','dialog-mark',o.mark);m.dataset.mark=o.mark;m.setAttribute('aria-hidden','true');b.append(m)}b.append(el('span','dialog-choice-number',(i+1)+'.'),' '+o.label);b.onclick=()=>settle(o.value!==undefined?o.value:o);choicesEl.append(b)});
   choicesEl.hidden=false;choicesEl.querySelector('button')?.focus({preventScroll:true})});
 }
 function close(notify=true){
  const was=current;current=null;settle(CLOSED);nextEl.onclick=null;card.hidden=true;choicesEl.replaceChildren();choicesEl.hidden=true;
  if(!dialog.hidden){dialog.hidden=true;portrait?.close?.();document.body.classList.remove('npc-conversation')}
  if(was&&notify)onClose(was.profile);
 }
 return {open,page,choose,close,get active(){return !!current},get profile(){return current?.profile||null},isOpenFor:p=>!!current&&current.profile===p,
  owns:id=>!!current&&current.id===id};
}

// Parchment summary shown before Accept/Decline: objectives then rewards.
export function questCard(q,carried){
 const nodes=[el('strong','dialog-quest-title',q.data.name)];
 if(q.data.stages?.length)nodes.push(el('small',null,'A quest in '+q.data.stages.length+' parts'));
 const objectives=q.data.objectives||[];if(objectives.length){const ul=el('ul','dialog-quest-objectives');for(const o of objectives)ul.append(el('li',null,(o.label||o.type+' '+(o.target||''))+(o.amount>1?' × '+o.amount:'')));nodes.push(el('small',null,'Objectives'),ul)}
 const rewards=rewardEntries(q.data);if(rewards.length){const ul=el('ul','dialog-quest-rewards');for(const r of rewards)ul.append(el('li',null,r.label));nodes.push(el('small',null,'Rewards'),ul)}
 void carried;return nodes;
}

// The whole conversation with one NPC. ctx(): {trainee,carried,skillLevel}; quests(): snapshot rows.
// ctx().npcLines(npcId) (optional): lines unlocked by a finished quest replace the NPC's own.
// onStage(q) runs after a stage report or choice; onQuestCompleted(q) after a hand-in.
export async function converse(dialogue,{profile,npcId,root,quests,ctx,command,lastError=()=>'',services=()=>{},say=()=>{},onQuestAccepted=()=>{},onStage=()=>{},onQuestCompleted=()=>{}}){
 const unlocked=ctx().npcLines?.(npcId);if(unlocked?.length)profile={...profile,lines:unlocked.map(l=>typeof l==='string'?l:l.text)};
 const name=npcDisplayName(profile),id=dialogue.open(profile,root,name);
 const gone=v=>v===CLOSED||!dialogue.owns(id);
 let prompt={who:'npc',name,text:npcGreeting(profile)};
 for(let turn=0;turn<40;turn++){
  const topics=dialogueTopics(profile,npcId,quests(),ctx());
  // Nothing to choose beyond goodbye: just the NPC's lines.
  if(topics.length===1){await dialogue.page(prompt,{last:true});if(!gone())dialogue.close();return}
  const pick=await dialogue.choose(prompt,topics);if(gone(pick))return;
  if(pick.action==='bye'){dialogue.close();return}
  if(pick.action==='trade'||pick.action==='bank'){dialogue.close();services(pick.action);return}
  if(pick.action==='talk'){const lines=(profile.lines||[]).slice(1);for(const text of lines)if(gone(await dialogue.page({who:'npc',name,text})))return;prompt={who:'npc',name,text:'Anything else?'};continue}
  if(pick.action==='quest'){
   const q=quests().find(x=>x.id===pick.quest);if(!q){prompt={who:'npc',name,text:'Never mind that now.'};continue}
   const plan=questPages(q,pick.stage,{...ctx(),objective:pick.objective},quests());
   for(const line of plan.pages)if(gone(await dialogue.page({name,...line})))return;
   if(plan.then==='accept'){
    const yes=await dialogue.choose({who:'npc',name,text:'Will you take on “'+q.data.name+'”?',quest:questCard(q)},[{label:'Yes, I accept.',value:true,action:'accept'},{label:'Not right now.',value:false,action:'decline'}]);if(gone(yes))return;
    if(!yes){prompt={who:'npc',name,text:'Very well. Come back if you change your mind.'};continue}
    const ok=await command('quest_accept',{id:q.id});if(!dialogue.owns(id))return;
    if(!ok){prompt={who:'npc',name,text:lastError()||'Not now. Come back later.'};continue}
    onQuestAccepted(q);const step=trackerStep({...q,accepted:true},ctx().carried);say('Quest started: '+q.data.name+(step?.label?' — '+step.label:''));
    prompt={who:'npc',name,text:'Good luck. You know where to find me.'};continue;
   }
   if(plan.then==='complete'){
    const ok=await command('quest_complete',{id:q.id});if(!dialogue.owns(id))return;
    if(!ok){prompt={who:'npc',name,text:lastError()||'You are not quite finished yet.'};continue}
    dialogue.close();onQuestCompleted(q);return;
   }
   if(plan.then==='advance'){
    const ok=await command('quest_advance',{id:q.id});if(!dialogue.owns(id))return;
    if(!ok){prompt={who:'npc',name,text:lastError()||'Not yet.'};continue}
    onStage(q);prompt={who:'npc',name,text:'Off you go, then.'};continue;
   }
   if(plan.then==='choose'){
    const pick2=await dialogue.choose({who:'choice',name,text:'Select an option'},plan.choices.map(c=>({label:c.label,value:c,action:'choice'})));if(gone(pick2))return;
    const ok=await command('quest_choice',{id:q.id,choice:pick2.value});if(!dialogue.owns(id))return;
    if(!ok){prompt={who:'npc',name,text:lastError()||'Think it over.'};continue}
    for(const line of pick2.dialogue||[])if(gone(await dialogue.page({name,...(typeof line==='string'?{who:'npc',text:line}:line)})))return;
    onStage(q);prompt={who:'npc',name,text:'Anything else?'};continue;
   }
   prompt={who:'npc',name,text:'Anything else?'};continue;
  }
 }
 dialogue.close();
}
