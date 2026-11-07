import {goods,quantity} from './economy.js?v=release-20261107-qaui148';
import {levelSkills} from './level-up.js?v=release-20261107-qaui148';
import {isStaged,journalEntries,requirementRows,lampLabel,lampChoices,unlockLabel} from './quest-v2.js?v=release-20261107-qaui148';
const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;for(const [k,v]of Object.entries(attrs))n.setAttribute(k,v);return n};
const button=(parent,label,fn)=>{const n=el('button',label,{type:'button'});n.onclick=fn;parent.append(n);return n};
function input(parent,label,value,type='text',choices=null){const wrap=el('label',label),n=el(choices?'select':type==='textarea'?'textarea':'input');if(choices){for(const [v,t]of choices)n.append(el('option',t,{value:v}));n.value=value??''}else if(type==='checkbox'){n.type=type;n.checked=!!value}else{if(type!=='textarea')n.type=type;n.value=value??''}wrap.append(n);parent.append(wrap);return n}
export async function questEditor(root,{rpc,action,note}){
 root.append(el('p','Loading quests and NPCs…'));
 try{
  const [quests,world]=await Promise.all([rpc('world_admin',{command:'quest_list',payload:{}}),rpc('world_admin_overview')]);if(!root.isConnected)return;
  const actors=(world.actors||[]).filter(a=>!a.deleted).map(a=>({id:a.id,...a.data,name:a.data?.name||a.name||a.id}));
  const npcs=actors.filter(a=>a.kind==='npc'),enemies=actors.filter(a=>a.attackable);let selected=null;
  function draw(){root.replaceChildren();const columns=el('div',null,{class:'studio-columns'}),list=el('section'),form=el('section');columns.append(list,form);root.append(columns);
   button(list,'New quest',()=>{selected=null;draw()});for(const q of quests)button(list,(q.data.published?'● ':'○ ')+q.data.name,()=>{selected=q;draw()});
   if(!npcs.length){form.append(el('p','Place an NPC first in World, then return here.'));return}
   const d=selected?.data||{},name=input(form,'Quest name',d.name||''),description=input(form,'Quest dialogue / description',d.description||'','textarea'),giver=input(form,'Start and return to this NPC',d.giver||npcs[0].id,'text',npcs.map(a=>[a.id,a.name])),published=input(form,'Published (players can accept)',d.published,'checkbox');
   const objectives=el('div');form.append(el('h3','Objectives'),el('p','Collected items are handed in. Talk and kill objectives count after acceptance.'),objectives);
   function objective(o={type:'collect',amount:1}){const row=el('div',null,{class:'studio-recipe-parts'}),type=input(row,'Objective',o.type,'text',[['collect','Collect and return items'],['talk','Talk to NPC'],['kill','Defeat enemy']]),target=input(row,'Target','','text',[]),amount=input(row,'Quantity',o.amount||1,'number');amount.min=1;amount.max=1000;
    const fill=()=>{target.replaceChildren();const choices=type.value==='collect'?Object.entries(goods).filter(([,g])=>!g.noteOf).map(([id,g])=>[id,g.name]):(type.value==='talk'?npcs:enemies).map(a=>[a.id,a.name]);for(const [id,label]of choices)target.append(el('option',label,{value:id}));if(choices.some(([id])=>id===o.target))target.value=o.target};fill();type.onchange=fill;row.read=()=>({type:type.value,target:target.value,amount:Number(amount.value),label:target.selectedOptions[0]?.textContent||target.value});button(row,'Remove objective',()=>row.remove());objectives.append(row)}
   for(const o of d.objectives||[{type:'collect',target:'wood',amount:3}])objective(o);button(form,'Add objective',()=>{if(objectives.children.length<8)objective()});
   form.append(el('h3','Rewards'));const gold=input(form,'Gold',d.gold||0,'number');gold.min=0;gold.max=1000000;
   const rewards=el('div');form.append(rewards);function reward(id='wood',amount=1){const row=el('div',null,{class:'studio-recipe-parts'}),item=input(row,'Item reward',id,'text',Object.entries(goods).filter(([,g])=>!g.noteOf).map(([key,g])=>[key,g.name])),n=input(row,'Quantity',amount,'number');n.min=1;n.max=1000;row.read=()=>[item.value,Number(n.value)];button(row,'Remove reward',()=>row.remove());rewards.append(row)}for(const [id,n]of Object.entries(d.items||{}))reward(id,n);button(form,'Add item reward',()=>{if(rewards.children.length<8)reward()});
   const xpRows=el('div');form.append(xpRows);function xp(skill='cooking',amount=50){const row=el('div',null,{class:'studio-recipe-parts'}),s=input(row,'XP skill',skill,'text',['attack','strength','defence','mining','woodcutting','fishing','cooking','smithing','crafting','firemaking','fletching','herblore','farming','runecrafting','construction','hunter','agility','thieving'].map(k=>[k,k])),n=input(row,'XP',amount,'number');n.min=1;n.max=100000;row.read=()=>[s.value,Number(n.value)];button(row,'Remove XP reward',()=>row.remove());xpRows.append(row)}for(const [k,n]of Object.entries(d.xp||{}))xp(k,n);button(form,'Add XP reward',()=>xp());
   const read=()=>({name:name.value.trim(),description:description.value.trim(),giver:giver.value,published:published.checked,objectives:[...objectives.children].map(r=>r.read()),gold:Number(gold.value),items:Object.fromEntries([...rewards.children].map(r=>r.read())),xp:Object.fromEntries([...xpRows.children].map(r=>r.read()))});
   const preview=el('pre');form.append(preview);button(form,'Preview quest',()=>{const q=read();preview.textContent=q.name+'\n'+q.description+'\n'+q.objectives.map(o=>o.type+' '+o.amount+' × '+o.label).join('\n')+'\nRewards: '+q.gold+' gold; '+Object.entries(q.items).map(([id,n])=>n+' '+goods[id]?.name).join(', ')+'; '+Object.entries(q.xp).map(([k,n])=>n+' '+k+' XP').join(', ')});
   button(form,'Save quest',async()=>{try{const q=await action('quest_save',{...(selected?{id:selected.id}:{}),data:read()});const i=quests.findIndex(r=>r.id===q.id);if(i<0)quests.unshift(q);else quests[i]=q;selected=q;note('Quest saved. Accepted quests retain their original objectives and rewards.');draw()}catch(e){note(e.message,true)}});
   if(selected)button(form,'Unpublish quest',async()=>{try{selected=await action('quest_archive',{id:selected.id});quests[quests.findIndex(q=>q.id===selected.id)]=selected;draw();note('Unpublished. Existing players can still complete accepted quests.')}catch(e){note(e.message,true)}});
  }draw();
 }catch(e){note(e.message,true)}
}
// ---------------------------------------------------------------- quest journal (Quests tab)
// Pure rules first (tested in tests/quest-journal.test.js), then the DOM.
// RuneScape colours: grey = not started, yellow = started, green = completed.
export const QUEST_STATUS={
 notStarted:{label:'Not started',className:'quest-not-started'},
 started:{label:'In progress',className:'quest-started'},
 complete:{label:'Completed',className:'quest-complete'}};
export const questStatus=q=>q?.completed?'complete':q?.accepted?'started':'notStarted';
export const questPoints=q=>Math.max(0,Math.floor(Number(q?.data?.questPoints??1))||0);
export const CHAIN_TITLES={tutorial:'Castle Training'};
// Sections in journal order: the starter (tutorial) chain by its order, then every other quest
// grouped by chain (unchained quests last, as "Quests"), keeping the server's order inside.
export function journalSections(quests=[]){
 const groups=new Map();
 for(const q of quests){const chain=q?.data?.chain||'';if(!groups.has(chain))groups.set(chain,[]);groups.get(chain).push(q)}
 const keys=[...groups.keys()].sort((a,b)=>(a==='tutorial'?-1:b==='tutorial'?1:!a?1:!b?-1:a.localeCompare(b)));
 return keys.map(chain=>{const list=groups.get(chain);if(chain)list.sort((a,b)=>(a.data.order||0)-(b.data.order||0));
  return {chain,title:CHAIN_TITLES[chain]||(chain?chain[0].toUpperCase()+chain.slice(1).replace(/[-_]/g,' '):'Quests'),quests:list,complete:list.filter(q=>q.completed).length}});
}
export function journalSummary(quests=[]){
 const complete=quests.filter(q=>q.completed);
 return {total:quests.length,complete:complete.length,started:quests.filter(q=>q.accepted&&!q.completed).length,points:complete.reduce((n,q)=>n+questPoints(q),0),maxPoints:quests.reduce((n,q)=>n+questPoints(q),0)};
}
const SKILL_KEY=skill=>skill==='woodcutting'?'woodXP':skill+'XP';
export const skillInfo=skill=>{const s=levelSkills.find(s=>s.key===SKILL_KEY(skill));return {name:s?.name||String(skill)[0].toUpperCase()+String(skill).slice(1),icon:s?.icon||'★'}};
const itemName=id=>goods[id]?.name||String(id).replace(/^[a-z]+:/,'').replace(/([A-Z])/g,' $1').toLowerCase();
// Reward lines as shown in the journal and the completion scroll, in OSRS order:
// quest points, experience per skill, items, then coins.
export function rewardEntries(data={},{points=true}={}){
 const out=[];const qp=questPoints({data});
 if(points&&qp)out.push({kind:'points',amount:qp,label:qp+' Quest Point'+(qp===1?'':'s')});
 for(const [skill,n]of Object.entries(data.xp||{}))if(Number(n)>0){const s=skillInfo(skill);out.push({kind:'xp',skill,amount:Number(n),icon:s.icon,label:Number(n).toLocaleString('en-GB')+' '+s.name+' XP'})}
 for(const [id,n]of Object.entries(data.items||{}))if(Number(n)>0)out.push({kind:'item',id,amount:Number(n),label:(Number(n)>1?Number(n)+' × ':'')+itemName(id)});
 for(const l of data.lamps||[])out.push({kind:'lamp',icon:'🪔',label:lampLabel(l)});
 if(Number(data.gold)>0)out.push({kind:'coins',amount:Number(data.gold),label:Number(data.gold).toLocaleString('en-GB')+' coins'});
 // Unlocks the player gets whatever they chose (flag-dependent ones stay a surprise).
 for(const u of data.unlocks||[])if(!u.ifFlags&&u.type!=='flag')out.push({kind:'unlock',icon:'🔓',label:unlockLabel(u)});
 return out;
}
// Objective rows with progress. A completed quest shows every objective as done (players who
// finished training before per-quest records existed have no progress rows).
export function objectiveRows(q,carried=()=>0){
 return (q?.data?.objectives||[]).map((o,i)=>{
  const raw=q.completed?o.amount:o.type==='collect'?carried(o.target):Number(q.progress?.[i])||0,count=Math.min(o.amount,raw);
  const label=['collect','talk','kill'].includes(o.type)&&!o.label?(o.type==='collect'?'Return '+itemName(o.target):o.type==='talk'?'Talk to '+o.target:'Defeat '+o.target):o.type==='collect'?'Return '+(o.label||itemName(o.target)):o.label||o.type;
  return {label,count,amount:o.amount,done:count>=o.amount,started:!!q.accepted}});
}
// A quest that just turned from started to complete (one at a time; bulk changes such as an
// owner skipping the training never pop a scroll per quest).
export function newlyCompleted(previous,rows){
 if(!previous)return [];
 const done=rows.filter(q=>q.completed&&previous.get(q.id)==='started');
 return done.length===1?done:[];
}
const COIN_ICON='<svg viewBox="0 0 48 48" aria-hidden="true"><ellipse cx="22" cy="34" rx="14" ry="6" fill="#8a6414"/><ellipse cx="22" cy="31" rx="14" ry="6" fill="#e3b53c" stroke="#7a5510"/><ellipse cx="27" cy="24" rx="14" ry="6" fill="#8a6414"/><ellipse cx="27" cy="21" rx="14" ry="6" fill="#f2c94c" stroke="#7a5510"/><ellipse cx="24" cy="13" rx="12" ry="5" fill="#ffd866" stroke="#7a5510"/><path d="M19 12h10" stroke="#b07f1a" stroke-width="2"/></svg>';
const SCROLL_ICON='<svg viewBox="0 0 48 48" aria-hidden="true"><rect x="10" y="10" width="28" height="30" rx="3" fill="#e8d3a2" stroke="#6b4b22" stroke-width="2"/><rect x="7" y="7" width="34" height="6" rx="3" fill="#b88a4a" stroke="#6b4b22"/><rect x="7" y="37" width="34" height="6" rx="3" fill="#b88a4a" stroke="#6b4b22"/><path d="M15 20h18M15 25h18M15 30h12" stroke="#7a5a32" stroke-width="2"/></svg>';
export const questIconHtml=data=>data?.icon==='coins'?COIN_ICON:goods[data?.icon]?.icon||goods[Object.keys(data?.items||{})[0]]?.icon||SCROLL_ICON;
const rewardIconHtml=r=>r.kind==='item'?goods[r.id]?.icon||SCROLL_ICON:r.kind==='coins'?COIN_ICON:r.kind==='points'?SCROLL_ICON:null;
const html=(tag,markup,cls)=>{const n=el(tag,null,cls?{class:cls}:{});n.innerHTML=markup;return n};

// Live per-player quest state (db/quests-v2.sql quest_state): QP, unlocks, pending lamps, flags.
const questState=()=>globalThis.window?.eldervaleQuestState||null;
const ctxNow=()=>globalThis.window?.eldervaleQuestContext?.()||{};
const questViewOf=q=>{const st=(q.data.stages||[]).find(s=>s.id===q.progress?._stage)||q.data.stages?.[0];return {...q,data:{...q.data,objectives:st?.objectives||[]}}};
// XP lamp: pick a skill (OSRS style), the server grants the XP (quest_lamp).
export function openLampChooser(lamp,{skillLevel=()=>1,status=null}={}){
 if(typeof document==='undefined')return null;
 const dialog=el('dialog',null,{class:'quest-lamp-dialog','aria-labelledby':'quest-lamp-title'});
 dialog.append(el('h3',lamp.label||'XP lamp',{id:'quest-lamp-title'}),el('p',lampLabel(lamp)+'. Choose a skill.'));
 const grid=el('div',null,{class:'quest-lamp-grid'});
 for(const c of lampChoices(lamp,skillLevel)){const s=skillInfo(c.skill),b=el('button',null,{type:'button',class:'quest-lamp-skill'});b.disabled=!c.allowed;b.title=c.allowed?c.xp+' XP':'Needs level '+lamp.minLevel;
  b.append(el('span',s.icon,{'aria-hidden':'true'}),el('strong',s.name),el('small','Lv '+c.level+' · +'+c.xp.toLocaleString('en-GB')+' XP'));
  b.onclick=async()=>{for(const x of grid.querySelectorAll('button'))x.disabled=true;const ok=await window.eldervaleRealm?.command('quest_lamp',{key:lamp.key,skill:c.skill});if(status)status.textContent=ok?'You gain '+c.xp.toLocaleString('en-GB')+' '+s.name+' XP.':window.eldervaleRealm?.lastError||'The lamp fizzles.';dialog.close()};grid.append(b)}
 const close=el('button','Not now',{type:'button',class:'quest-lamp-close'});close.onclick=()=>dialog.close();
 dialog.append(grid,close);document.body.append(dialog);dialog.addEventListener('close',()=>dialog.remove());
 try{dialog.showModal()}catch{dialog.setAttribute('open','')}return dialog;
}
function extrasSection(list){
 const st=questState();if(!st)return;
 const lamps=st.lamps||[],teleports=Object.entries(st.unlocks||{}).filter(([,u])=>u?.type==='teleport');
 if(!lamps.length&&!teleports.length)return;
 const box=el('section',null,{class:'quest-section quest-extras'});
 if(lamps.length){box.append(el('h4','Rewards to claim'));const a=el('div',null,{class:'quest-claims'});for(const l of lamps)button(a,'🪔 '+(l.label||'XP lamp')+(l.questName?' · '+l.questName:''),()=>openLampChooser(l,{skillLevel:ctxNow().skillLevel}));box.append(a)}
 if(teleports.length){box.append(el('h4','Quest teleports'));const a=el('div',null,{class:'quest-claims'});for(const [id,u] of teleports)button(a,'✦ '+(u.label||id),async()=>{const ok=await window.eldervaleRealm?.command('quest_teleport',{id});if(!ok)window.eldervaleWorldBridge?.notice?.(window.eldervaleRealm?.lastError||'The teleport fails.')});box.append(a)}
 list.append(box);
}
function rewardList(data,{points=true}={}){
 const ul=el('ul',null,{class:'quest-rewards'});
 for(const r of rewardEntries(data,{points})){const li=el('li',null,{'data-kind':r.kind});const icon=r.icon?el('span',r.icon,{class:'quest-reward-icon','aria-hidden':'true'}):html('span',rewardIconHtml(r),'quest-reward-icon');li.append(icon,el('span',r.label));ul.append(li)}
 return ul;
}

// OSRS-style "Quest complete!" scroll: parchment unrolls, quest art on the left,
// "You are awarded:" list on the right, jingle on the Sound effects channel.
let scrollOpen=null;
export function showQuestComplete(q,{totalPoints=null,jingle=true}={}){
 if(typeof document==='undefined'||!q?.data)return null;
 scrollOpen?.close?.();
 const reduced=globalThis.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
 const dialog=el('dialog',null,{class:'quest-scroll-dialog','aria-labelledby':'quest-scroll-title'});
 const scroll=el('div',null,{class:'quest-scroll'+(reduced?' reduced':'')}),paper=el('div',null,{class:'quest-scroll-paper'});
 const title=el('h2',null,{id:'quest-scroll-title'});title.append(el('span','Congratulations!',{class:'quest-scroll-congrats'}),el('span','You have completed '+q.data.name+'!',{class:'quest-scroll-name'}));
 const body=el('div',null,{class:'quest-scroll-body'}),art=el('div',null,{class:'quest-scroll-art'});
 art.append(html('div',questIconHtml(q.data),'quest-scroll-icon'),el('p','Quest Points: '+(totalPoints??questPoints(q)),{class:'quest-scroll-points'}));
 const awards=el('div',null,{class:'quest-scroll-awards'});awards.append(el('h3','You are awarded:'),rewardList(q.data));
 body.append(art,awards);
 const close=el('button','Close',{type:'button',class:'quest-scroll-close'});
 paper.append(title,body,close);
 if(q.data.lamps?.length){const rub=el('button','🪔 Rub the lamp now',{type:'button',class:'quest-scroll-lamp'});rub.onclick=()=>{finish();setTimeout(()=>{const l=(questState()?.lamps||[]).find(x=>x.quest===q.id);if(l)openLampChooser(l,{skillLevel:ctxNow().skillLevel})},350)};paper.insertBefore(rub,close)}
 scroll.append(el('div',null,{class:'quest-scroll-rod top','aria-hidden':'true'}),paper,el('div',null,{class:'quest-scroll-rod bottom','aria-hidden':'true'}));
 const sparks=el('div',null,{class:'quest-scroll-sparks','aria-hidden':'true'});
 if(!reduced)for(let i=0;i<18;i++){const s=el('i');s.style.setProperty('--x',(Math.round(Math.random()*100))+'%');s.style.setProperty('--d',(Math.random()*1.2).toFixed(2)+'s');s.style.setProperty('--h',(40+Math.round(Math.random()*30))+'vh');sparks.append(s)}
 dialog.append(sparks,scroll);document.body.append(dialog);
 const finish=()=>{if(dialog.open)dialog.close()};
 close.onclick=finish;dialog.addEventListener('click',e=>{if(e.target===dialog)finish()});
 dialog.addEventListener('close',()=>{dialog.remove();if(scrollOpen===dialog)scrollOpen=null});
 try{dialog.showModal()}catch{dialog.setAttribute('open','')}
 close.focus({preventScroll:true});scrollOpen=dialog;
 if(jingle)import('./music.js?v=release-20261107-qaui148').then(m=>m.playLevelUpJingle?.('quest')).catch(()=>{});
 return dialog;
}

export function createQuestJournal(state){
 const css=el('link',null,{rel:'stylesheet',href:'./quests.css?v=release-20261107-qaui148'});document.head.append(css);
 // The journal lives in the bottom-right panel as the Quests tab; the floating dialog is only a fallback for pages without that panel.
 const tab=document.querySelector('#side [data-tab=quests]'),host=document.querySelector('#quests-tab');let panel=null;
 const head=el('header',null,{class:'quest-journal-head'}),summary=el('p','',{class:'quest-summary'}),list=el('div',null,{class:'quest-list'}),status=el('p','',{role:'status'});
 const legend=el('p',null,{class:'quest-legend','aria-label':'Colour key'});for(const k of ['notStarted','started','complete'])legend.append(el('span',QUEST_STATUS[k].label,{class:QUEST_STATUS[k].className}));
 head.append(el('h3','Quests'),summary);
 if(host&&tab){host.replaceChildren(head,legend,list,status);host.classList.add('quest-journal');tab.addEventListener('click',()=>{filter=null;selected=null;status.textContent='';draw()})}
 else{const toggle=button(document.body,'📜',()=>open());toggle.id='quest-journal-toggle';toggle.title='Quest journal';toggle.setAttribute('aria-label','Open quest journal');panel=el('dialog',null,{id:'quest-journal',class:'quest-journal'});const top=el('header');top.append(el('h2','Quest journal'));button(top,'Close',()=>panel.close());panel.append(top,head,legend,list,status);document.body.append(panel)}
 let quests=[],filter=null,selected=null,signature='',pending=false,previous=null,rowsText=null;
 const carried=id=>quantity(state,id);
 function drawSummary(){const s=journalSummary(quests);summary.replaceChildren(el('strong','Quest Points: '+(questState()?.qp??s.points)),el('span',s.complete+'/'+s.total+' complete'))}
 function detail(q){
  const st=questStatus(q),card=el('article',null,{class:'quest-detail '+QUEST_STATUS[st].className});
  button(card,'‹ All quests',()=>{selected=null;draw()}).className='quest-back';
  card.append(el('h3',q.data.name),el('p',QUEST_STATUS[st].label+(q.data.chain==='tutorial'?' · Castle Training '+(q.data.order||'')+'/'+quests.filter(x=>x.data.chain==='tutorial').length:''),{class:'quest-state'}));
  if(q.data.giverName)card.append(el('p','Start: talk to '+q.data.giverName+'.',{class:'quest-start'}));
  const ctx=ctxNow(),reqs=requirementRows(q.data,quests,ctx);
  if(reqs.length&&!q.completed){card.append(el('h4','Requirements'));const ul=el('ul',null,{class:'quest-requirements'});for(const r of reqs){const li=el('li',null,{class:r.met?'met':'unmet'});li.append(el('span',r.met?'✔':'✖',{'aria-hidden':'true'}),el('span',r.label+(r.met?'':' (not yet)')));ul.append(li)}card.append(ul)}
  if(isStaged(q.data)){
   // OSRS journal: what I have done so far (struck through), then what I should do now.
   if(q.accepted)card.append(el('p',q.data.description||'',{class:'quest-intro'}));
   card.append(el('h4',q.accepted?'Journal':'Story'));const box=el('div',null,{class:'quest-stages'});
   for(const e of journalEntries(q)){const p=el('p',null,{class:e.done?'done':e.complete?'complete':'current'});p.append(e.done?el('s',e.text):el('span',e.text));box.append(p)}
   if(q.completed)box.append(el('p','QUEST COMPLETE!',{class:'quest-complete-line'}));
   card.append(box);
   const rowsNow=q.accepted&&!q.completed?objectiveRows(questViewOf(q),carried):[];
   if(rowsNow.length){const ol=el('ol',null,{class:'quest-objectives'}),objs=questViewOf(q).data.objectives;rowsNow.forEach((o,i)=>{if(objs[i]?.label)o.label=objs[i].label});for(const o of rowsNow){const li=el('li',null,{class:o.done?'done':''});li.append(el('span',o.label),el('small',Math.min(o.amount,o.count)+'/'+o.amount));ol.append(li)}card.append(ol)}
  }else{
   card.append(el('p',q.data.description||''));
   card.append(el('h4','Objectives'));const ol=el('ol',null,{class:'quest-objectives'});
   for(const o of objectiveRows(q,carried)){const li=el('li',null,{class:o.done&&o.started?'done':''});li.append(el('span',o.label),el('small',o.started?Math.min(o.amount,o.count)+'/'+o.amount:'—'));ol.append(li)}
   card.append(ol);
  }
  card.append(el('h4','Rewards'),rewardList(q.data));
  const lamps=(questState()?.lamps||[]).filter(l=>l.quest===q.id);if(lamps.length){const a=el('div',null,{class:'quest-claims'});for(const l of lamps)button(a,'🪔 Rub '+(l.label||'XP lamp'),()=>openLampChooser(l,{skillLevel:ctx.skillLevel,status}));card.append(a)}
  if(!q.completed&&q.data.chain!=='tutorial'&&!isStaged(q.data)){const b=button(card,q.accepted?'Hand in at quest giver':'Accept at quest giver',async()=>{if(pending)return;pending=true;b.disabled=true;try{const ok=await window.eldervaleRealm?.command(q.accepted?'quest_complete':'quest_accept',{id:q.id});status.textContent=ok?(q.accepted?'Quest completed.':'Quest accepted.'):window.eldervaleRealm?.lastError||'World connection required.'}finally{pending=false;draw()}});b.className='quest-action';b.disabled=pending}
  return card;
 }
 function draw(){
  drawSummary();list.replaceChildren();
  const q=selected&&quests.find(x=>x.id===selected);if(q){legend.hidden=true;list.append(detail(q));return}
  legend.hidden=false;selected=null;
  const visible=quests.filter(q=>!filter||q.data.giver===filter);
  if(filter)button(list,'Show all quests',()=>{filter=null;draw()}).className='quest-show-all';
  if(!visible.length){list.append(el('p','No quests available here yet. The owner can publish quests in World studio.'));return}
  if(!filter)extrasSection(list);
  for(const section of journalSections(visible)){
   const box=el('section',null,{class:'quest-section'}),h=el('h4');h.append(el('span',section.title),el('small',section.complete+'/'+section.quests.length));box.append(h);
   const ul=el('ul',null,{class:'quest-names'});
   for(const item of section.quests){const st=questStatus(item),li=el('li'),b=el('button',item.data.name,{type:'button',class:'quest-name '+QUEST_STATUS[st].className,'aria-label':item.data.name+', '+QUEST_STATUS[st].label});b.onclick=()=>{selected=item.id;draw();list.scrollTop=0;host?.scrollTo?.({top:0})};li.append(b);ul.append(li)}
   box.append(ul);list.append(box);
  }
 }
 const shown=()=>panel?panel.open:!host.hidden&&tab.getAttribute('aria-expanded')!=='false';
 function open(npc=null){if(panel){if(!panel.open)panel.showModal()}else if(!shown()||!tab.classList.contains('selected'))tab.click();filter=npc;selected=null;const mine=npc?quests.filter(q=>q.data.giver===npc&&q.data.chain!=='tutorial'):[];if(mine.length===1)selected=mine[0].id;draw();status.textContent='Accept and hand in quests near their giver. Collected items are consumed when handed in.'}
 // Opens the journal on one quest (the tracker under the minimap links here).
 function show(id){open();if(quests.some(q=>q.id===id)){selected=id;draw()}}
 return {open,show,draw,hasFor:npc=>quests.some(q=>q.data.giver===npc&&!q.completed&&q.data.chain!=='tutorial'),sync(rows=[]){
  // The lean world sync hands back the same array while quests are unchanged
  // (sync-diet.js): only the carried collect counts need checking then.
  if(rows!==quests||rowsText===null){for(const q of newlyCompleted(previous,rows)){const totalPoints=globalThis.window?.eldervaleQuestState?.qp??journalSummary(rows).points,scene=globalThis.window?.eldervaleQuestCutscenes?.completion?.(q);if(scene)scene.then(()=>showQuestComplete(q,{totalPoints}));else showQuestComplete(q,{totalPoints})}
   previous=new Map(rows.map(q=>[q.id,questStatus(q)]));quests=rows;rowsText=JSON.stringify(rows)}
  const next=rowsText+'|'+JSON.stringify(questState()?.lamps||[])+Object.keys(questState()?.unlocks||{}).join()+'|'+rows.flatMap(q=>(q.data.stages?q.data.stages.flatMap(s=>s.objectives||[]):q.data.objectives||[]).filter(o=>o.type==='collect').map(o=>quantity(state,o.target))).join(',');if(next!==signature){signature=next;if(!pending&&(!panel||panel.open))draw()}}};
}
