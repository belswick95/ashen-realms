// Quest system v2, pure rules shared by the journal, tracker, markers, NPC conversation and the
// Game console (tests/quest-v2.test.js). Mirrors db/quests-v2.sql; the server is authoritative.
// Quest data: requirements, stages [{id, journal, objectives, npc, next, final, choices, dialogue,
// onEnter:{cutscene,flags}}], unlocks, lamps, cutscenes, onComplete, journalDone, journalVariants,
// branchDialogue. Player progress: _stage, _flags, _done, _seen + objective counts of the stage.

export const UNLOCK_TYPES={area:'Area',gate:'Gate',shortcut:'Shortcut',shop:'Shop stock',spell:'Spell',teleport:'Teleport',dialogue:'NPC dialogue',flag:'World flag',item:'Item use'};
export const SKILL_NAMES=['attack','strength','defence','hitpoints','ranged','magic','prayer','mining','woodcutting','fishing','cooking','smithing','crafting','firemaking','fletching','herblore','farming','runecrafting','construction','hunter','agility','thieving'];
export const STEP_KINDS=['fade','title','shot','say','wait','npc'];
const REQ_KEYS=['quests','qp','skills','items','combat'];
const cap=s=>String(s||'')[0]?.toUpperCase()+String(s||'').slice(1);

export const isStaged=d=>Array.isArray(d?.stages)&&d.stages.length>0;
export const stageById=(d,id)=>isStaged(d)?d.stages.find(s=>s?.id===id)||null:null;
export function currentStage(q){const d=q?.data;if(!isStaged(d))return null;return stageById(d,q.progress?._stage)||d.stages[0]}
export function nextStageId(d,stage,choice=null){
 if(!stage)return null;
 const c=choice!=null?(stage.choices||[]).find(x=>x.id===choice):null;if(c?.next)return c.next;
 if(stage.final)return null;if(stage.next)return stage.next;
 const i=d.stages.findIndex(s=>s.id===stage.id);return d.stages[i+1]?.id??null;
}
export const isFinalStage=(d,stage)=>!!stage&&!(stage.choices?.length)&&nextStageId(d,stage)==null;
export const flagsMatch=(cond,flags={})=>!cond||typeof cond!=='object'||Object.entries(cond).every(([k,v])=>(flags?.[k]??false)===v);
// Who the player reports to when a stage's objectives are done: its NPC, or the giver for a choice.
export const stageNpc=(d,stage)=>stage?.npc||(stage?.choices?.length?d?.giver:null)||null;

// A quest as the classic rules see it: the current stage's objectives (memoised per snapshot row).
const views=new WeakMap();
export function questView(q){
 if(!q||!isStaged(q.data))return q;
 let v=views.get(q);if(v)return v;
 const st=currentStage(q);v={...q,data:{...q.data,objectives:st?.objectives||[]},stage:st};views.set(q,v);return v;
}
const count=(q,i,carried)=>{const o=q.data.objectives[i];return Math.min(o.amount,o.type==='collect'?carried(o.target)||0:Number(q.progress?.[i])||0)};
export const objectivesDone=(q,carried=()=>0)=>{const v=questView(q);return (v.data.objectives||[]).every((o,i)=>count(v,i,carried)>=o.amount)};
// A finished stage waiting for its report NPC or choice: {npc, kind:'advance'|'choice', stage}.
export function stageReport(q,carried=()=>0){
 if(!q?.accepted||q.completed||!isStaged(q.data))return null;
 const st=currentStage(q),npc=stageNpc(q.data,st);if(!npc||isFinalStage(q.data,st)&&!st.choices?.length)return null;
 if(!objectivesDone(q,carried))return null;
 return {npc,kind:st.choices?.length?'choice':'advance',stage:st};
}
export const atFinalStage=q=>!isStaged(q?.data)||isFinalStage(q.data,currentStage(q));

// ---- requirements
export function requirementSpec(d){
 const r=d?.requirements;if(!r||typeof r!=='object')return {quests:[],skills:{}};
 if(REQ_KEYS.some(k=>k in r))return {quests:Array.isArray(r.quests)?r.quests:[],qp:r.qp,combat:r.combat,items:r.items||{},skills:r.skills||{}};
 return {quests:[],skills:r};// original flat {skill:level}
}
// Requirement checklist rows ({label,met}) in OSRS journal order: quests, QP, combat, skills, items.
export function requirementRows(d,quests=[],ctx={}){
 const s=requirementSpec(d),rows=[],level=k=>Number(ctx.skillLevel?.(k))||1;
 const done=key=>{const prior=quests.find(x=>x?.data?.key===key);if(prior)return !!prior.completed;return String(key).startsWith('tutorial')&&!ctx.trainee};
 for(const key of s.quests){const prior=quests.find(x=>x?.data?.key===key);rows.push({kind:'quest',label:'Complete '+(prior?.data?.name||key),met:done(key)})}
 if(s.qp>0)rows.push({kind:'qp',label:s.qp+' Quest Points',met:(ctx.qp??questPointsOf(quests))>=s.qp});
 if(s.combat>0)rows.push({kind:'combat',label:'Combat level '+s.combat,met:(Number(ctx.combatLevel?.())||3)>=s.combat});
 for(const [skill,v] of Object.entries(s.skills||{})){const need=Number(typeof v==='object'?v?.level:v)||0;if(need>1)rows.push({kind:'skill',skill,label:'Level '+need+' '+cap(skill)+(typeof v==='object'&&v.boostable?' (boostable)':''),met:level(skill)>=need})}
 for(const [item,n] of Object.entries(s.items||{}))rows.push({kind:'item',item,label:'Bring '+n+' × '+(ctx.itemName?.(item)||item),met:(Number(ctx.carried?.(item))||0)>=n});
 return rows;
}
export const questPointsOf=(quests=[])=>quests.filter(q=>q?.completed).reduce((n,q)=>n+Math.max(0,Math.floor(Number(q.data?.questPoints??1))||0),0);

// ---- journal (OSRS style: finished stages struck through, the current one in plain text)
export function journalEntries(q){
 const d=q?.data||{};
 if(!isStaged(d)){return [{text:d.description||'',done:!!q?.completed,current:!q?.completed}]}
 if(!q.accepted)return [{text:d.description||'',done:false,current:true}];
 const out=[],flags=q.progress?._flags||{},doneIds=Array.isArray(q.progress?._done)?q.progress._done:[];
 for(const id of doneIds){const st=stageById(d,id);if(st)out.push({id,text:st.journal,done:true})}
 if(!q.completed){const st=currentStage(q);if(st&&!doneIds.includes(st.id))out.push({id:st.id,text:st.journal,done:false,current:true})}
 else{const extra=(d.journalVariants||[]).filter(v=>flagsMatch(v.ifFlags,flags)).map(v=>v.text);out.push({id:'_complete',text:[d.journalDone||'',...extra].filter(Boolean).join(' '),done:false,complete:true})}
 return out;
}

// ---- rewards
export const lampXp=(lamp,level)=>Math.min(1e6,Math.max(1,lamp?.perLevel?lamp.perLevel*Math.max(1,level|0):Number(lamp?.amount)||0));
export function lampChoices(lamp,levelOf=()=>1){
 return SKILL_NAMES.filter(s=>!Array.isArray(lamp?.skills)||lamp.skills.includes(s)).map(skill=>{const level=Number(levelOf(skill))||1;return {skill,level,xp:lampXp(lamp,level),allowed:level>=(lamp?.minLevel||1)}});
}
export const lampLabel=l=>(l?.label||'XP lamp')+': '+(l?.perLevel?l.perLevel+' × level XP':(Number(l?.amount)||0).toLocaleString('en-GB')+' XP')+(l?.minLevel>1?' in a skill of level '+l.minLevel+'+':' in a skill of your choice');
export const unlockLabel=u=>u?.label||(UNLOCK_TYPES[u?.type]||'Unlock')+': '+u?.id;

// ---- dialogue
// Lines that replace an NPC's own lines after a quest (dialogue unlocks the player holds).
export function npcLinesFor(npcId,unlocks={}){
 let best=null;for(const u of Object.values(unlocks||{}))if(u?.type==='dialogue'&&u.npc===npcId&&Array.isArray(u.lines)&&u.lines.length&&(!best||String(u.at||'')>=String(best.at||'')))best=u;
 return best?best.lines:null;
}
// Flag-dependent replacement for offer/progress/complete lines.
export function branchLines(d,stage,flags={}){
 for(const b of d?.branchDialogue||[])if(b.stage===stage&&flagsMatch(b.ifFlags,flags)&&b.lines?.length)return b.lines;
 return null;
}

// ---- console: validation mirror of quest_v2_check (the server repeats every check)
export function validateV2Draft(d={},ctx={}){
 const e=[],has=(set,v)=>!set||set.has(v),ids=new Set();
 const r=d.requirements;
 if(r){const s=requirementSpec(d);for(const k of s.quests){if(k===d.key)e.push('A quest cannot require itself.');else if(ctx.keys&&!ctx.keys.has(k))e.push('Required quest key '+k+' does not exist.')}
  if(s.quests.length>10)e.push('Up to 10 required quests.');
  if(s.qp!==undefined&&!(Number.isFinite(s.qp)&&s.qp>=0&&s.qp<=500))e.push('Quest point requirement must be 0–500.');
  if(s.combat!==undefined&&!(s.combat>=3&&s.combat<=126))e.push('Combat requirement must be 3–126.');
  for(const [k,v] of Object.entries(s.skills)){const lv=Number(typeof v==='object'?v?.level:v);if(!SKILL_NAMES.includes(k))e.push('Unknown skill '+k+'.');else if(!(lv>=1&&lv<=99))e.push('Skill requirement '+k+' must be level 1–99.')}
  for(const [k,n] of Object.entries(s.items||{}))if(!has(ctx.items,k)||!(n>=1&&n<=1000))e.push('Invalid item requirement '+k+'.');}
 const cutscenes=d.cutscenes||{};
 for(const [name,c] of Object.entries(cutscenes)){if(!/^[a-z0-9_-]{1,40}$/.test(name))e.push('Cutscene name '+name+': lowercase letters, digits, - or _.');if(!Array.isArray(c?.steps)||c.steps.length<1||c.steps.length>30)e.push('Cutscene '+name+': 1–30 steps.');else c.steps.forEach((s,i)=>{if(!STEP_KINDS.some(k=>k in(s||{})))e.push('Cutscene '+name+' step '+(i+1)+': unknown step.');if(s?.walk)e.push('Cutscene '+name+': quest cutscenes cannot walk the player.');if(s?.say&&!String(s.say.text||'').trim())e.push('Cutscene '+name+' step '+(i+1)+': say needs text.')})}
 if(Object.keys(cutscenes).length>6)e.push('Up to six cutscenes.');
 if(d.onComplete?.cutscene&&!cutscenes[d.onComplete.cutscene])e.push('Completion cutscene '+d.onComplete.cutscene+' is not defined.');
 if(isStaged(d)){
  if(d.stages.length>20)e.push('Up to 20 stages.');
  for(const st of d.stages){if(!/^[a-z0-9_-]{1,32}$/.test(st?.id||''))e.push('Stage id '+(st?.id||'(blank)')+': 1–32 lowercase letters, digits, - or _.');else if(ids.has(st.id))e.push('Stage id '+st.id+' is used twice.');ids.add(st?.id)}
  if(!d.stages.some(s=>s?.objectives?.length))e.push('Add at least one objective to a stage.');
  for(const st of d.stages){const at='Stage '+st.id+': ';
   if(!String(st.journal||'').trim()||String(st.journal).length>800)e.push(at+'journal text must be 1–800 characters.');
   if(st.npc&&!has(ctx.npcs,st.npc))e.push(at+'choose an existing NPC to report to.');
   if(st.next&&!ids.has(st.next))e.push(at+'next stage '+st.next+' does not exist.');
   if(st.next===st.id)e.push(at+'cannot lead to itself.');
   if((st.choices||[]).length>4)e.push(at+'up to four choices.');
   for(const c of st.choices||[]){if(!/^[a-z0-9_-]{1,32}$/.test(c?.id||'')||!String(c?.label||'').trim())e.push(at+'each choice needs an id and a label.');const n=nextStageId(d,st,c.id);if(!n||!ids.has(n)||n===st.id)e.push(at+'choice '+(c.id||'')+' must lead to another stage.')}
   if(st.onEnter?.cutscene&&!cutscenes[st.onEnter.cutscene])e.push(at+'cutscene '+st.onEnter.cutscene+' is not defined.');
   if((st.objectives||[]).some(o=>o.type==='collect')&&!st.npc&&!st.choices?.length&&!isFinalStage(d,st))e.push(at+'collected items need an NPC to hand them to.');
   if(ctx.objectiveErrors)for(const m of ctx.objectiveErrors(st.objectives||[]))e.push(at+m);
  }
  for(const st of d.stages){let cur=st,steps=0;while(cur&&!cur.choices?.length){const n=nextStageId(d,cur);if(!n)break;cur=stageById(d,n);if(++steps>20){e.push('Stages loop forever starting at '+st.id+'.');break}}}
 }
 const unlocks=d.unlocks||[];if(unlocks.length>12)e.push('Up to 12 unlocks.');
 for(const u of unlocks){if(!UNLOCK_TYPES[u?.type])e.push('Unlock type must be one of '+Object.keys(UNLOCK_TYPES).join(', ')+'.');if(!/^[a-z0-9_.:-]{2,60}$/.test(u?.id||''))e.push('Unlock id '+(u?.id||'(blank)')+': 2–60 lowercase letters, digits, . : - or _.');
  if(u?.type==='teleport'&&!(Number.isFinite(u.x)&&Number.isFinite(u.z)))e.push('Teleport '+u.id+' needs x and z.');
  if(u?.type==='dialogue'&&(!has(ctx.npcs,u.npc)||!u.lines?.length))e.push('Dialogue unlock '+u.id+': choose an NPC and add lines.')}
 const lamps=d.lamps||[];if(lamps.length>4)e.push('Up to four XP lamps.');
 for(const l of lamps){if(('amount' in l)===('perLevel' in l))e.push('Each lamp gives a fixed amount or an amount per level.');if('amount' in l&&!(l.amount>=1&&l.amount<=1e6))e.push('Lamp XP must be 1–1,000,000.');if('perLevel' in l&&!(l.perLevel>=1&&l.perLevel<=1000))e.push('Lamp XP per level must be 1–1000.');if(l.minLevel!==undefined&&!(l.minLevel>=1&&l.minLevel<=99))e.push('Lamp minimum level must be 1–99.')}
 return [...new Set(e)];
}

// Quest dependency graph for the console: edges (requirement → quest), cycles and quests a fresh
// account can never reach (design-patterns §2: no cycles, everything reachable).
export function questGraph(defs=[]){
 const byKey=new Map(defs.filter(d=>d?.key).map(d=>[d.key,d])),edges=[];
 const reqs=d=>[...new Set([...(d.requires?[d.requires]:[]),...requirementSpec(d).quests])];
 for(const d of defs)for(const k of reqs(d))edges.push([k,d.key||d.name]);
 const state=new Map(),cycles=[];
 const visit=(k,path)=>{if(state.get(k)===2)return;if(state.get(k)===1){cycles.push([...path.slice(path.indexOf(k)),k]);return}state.set(k,1);const d=byKey.get(k);for(const r of d?reqs(d):[])visit(r,[...path,k]);state.set(k,2)};
 for(const k of byKey.keys())visit(k,[]);
 const missing=[];for(const d of defs)for(const k of reqs(d))if(!byKey.has(k))missing.push([d.key||d.name,k]);
 return {edges,cycles,missing};
}

// ---- console simulator: step through a quest without a player (accept, finish objectives,
// report, choose, hand in) and see journal, dialogue, cutscenes, rewards and unlocks.
export function createQuestSimulator(d){
 const q={id:'sim',data:d,accepted:false,completed:false,progress:{}};const log=[];
 const say=(lines,who)=>{for(const l of lines||[])log.push((l.who==='player'?'You':who||'NPC')+': '+l.text)};
 const enter=id=>{const st=stageById(d,id);const keep={_stage:id,_flags:{...(q.progress._flags||{}),...(st?.onEnter?.flags||{})},_done:q.progress._done||[],_seen:q.progress._seen||[]};q.progress=keep;views.delete(q);if(st?.onEnter?.cutscene)log.push('▶ Cutscene: '+(d.cutscenes?.[st.onEnter.cutscene]?.name||st.onEnter.cutscene));log.push('Stage → '+id)};
 const leave=id=>{q.progress={...q.progress,_done:[...(q.progress._done||[]),id]}};
 const api={quest:q,log,
  actions(){
   if(q.completed)return [];
   if(!q.accepted)return [{kind:'accept',label:'Accept quest'}];
   const v=questView(q),out=[];
   v.data.objectives.forEach((o,i)=>{if((Number(q.progress[i])||0)<o.amount)out.push({kind:'objective',index:i,label:'Finish: '+(o.label||o.type+' '+(o.target||''))})});
   if(out.length)return out;
   const st=currentStage(q);
   if(st?.choices?.length)for(const c of st.choices)out.push({kind:'choice',choice:c.id,label:'Choose: '+c.label});
   else if(isStaged(d)&&!isFinalStage(d,st))out.push({kind:'advance',label:'Report to '+(st.npc||'the giver')});
   else out.push({kind:'complete',label:'Hand in to the giver'});
   return out;
  },
  apply(a){
   if(a.kind==='accept'){q.accepted=true;say(d.dialogue?.offer,'Giver');if(isStaged(d))enter(d.stages[0].id);else log.push('Accepted')}
   else if(a.kind==='objective'){const o=questView(q).data.objectives[a.index];q.progress={...q.progress,[a.index]:o.amount};views.delete(q);say(o.dialogue,o.target);log.push('✔ '+(o.label||o.type));
    const st=currentStage(q);if(st&&!st.npc&&!st.choices?.length&&!isFinalStage(d,st)&&objectivesDone(q,()=>Infinity))api.apply({kind:'auto'})}
   else if(a.kind==='auto'||a.kind==='advance'){const st=currentStage(q);say(st.dialogue?.advance,st.npc);leave(st.id);enter(nextStageId(d,st))}
   else if(a.kind==='choice'){const st=currentStage(q),c=st.choices.find(x=>x.id===a.choice);say(st.dialogue?.choice,st.npc||'Giver');say(c.dialogue,st.npc||'Giver');q.progress={...q.progress,_flags:{...q.progress._flags,...(c.flags||{}),['choice.'+st.id]:c.id}};log.push('Flags: '+JSON.stringify(q.progress._flags));leave(st.id);enter(nextStageId(d,st,c.id))}
   else if(a.kind==='complete'){const st=currentStage(q);if(st)leave(st.id);q.completed=true;say(branchLines(d,'complete',q.progress._flags)||d.dialogue?.complete,'Giver');if(d.onComplete?.cutscene)log.push('▶ Cutscene: '+(d.cutscenes?.[d.onComplete.cutscene]?.name||d.onComplete.cutscene));log.push('Quest complete!')}
   views.delete(q);return api;
  },
  journal:()=>journalEntries(q),
  unlocks:()=>q.completed?(d.unlocks||[]).filter(u=>flagsMatch(u.ifFlags,q.progress._flags)):[],
  flags:()=>({...(q.progress._flags||{})})};
 return api;
}
