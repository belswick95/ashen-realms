// Game console › Quests, v2 tools (db/quests-v2.sql): requirements, stages with branching choices
// and flags, cutscenes, unlocks, XP lamps and completion text inside the quest editor; a step-by-step
// simulator; the per-player quest state inspector (set stage, set flags, reset, mark complete);
// guidance (trail/minimap) settings and a dependency check of every quest.
import {UNLOCK_TYPES,SKILL_NAMES,isStaged,createQuestSimulator,questGraph,unlockLabel,lampLabel,validateV2Draft} from './quest-v2.js?v=release-20261106-mech96';

export const V2_KEYS=['requirements','stages','unlocks','lamps','cutscenes','onComplete','journalDone','journalVariants','branchDialogue'];
const cap=s=>String(s)[0].toUpperCase()+String(s).slice(1);
const uid=()=>Math.random().toString(36).slice(2,8);

// Turn a classic quest into a staged one (its objectives become stage 1) or back (last stage's objectives).
export function toggleStages(d,on){
 if(on&&!isStaged(d)){d.stages=[{id:'start',journal:d.description||'',objectives:d.objectives?.length?d.objectives:[]}];d.objectives=[];}
 else if(!on&&isStaged(d)){d.objectives=[...d.stages].reverse().find(s=>s.objectives?.length)?.objectives||[];delete d.stages;}
 return d;
}
// Drop empty v2 fields so saves stay small and classic quests stay classic.
export function cleanV2(d){
 const out={...d};
 if(out.requirements){const r={...out.requirements};for(const k of Object.keys(r))if(r[k]===''||r[k]==null||(typeof r[k]==='object'&&!Array.isArray(r[k])&&!Object.keys(r[k]).length)||(Array.isArray(r[k])&&!r[k].length))delete r[k];if(Object.keys(r).length)out.requirements=r;else delete out.requirements}
 for(const k of ['unlocks','lamps','journalVariants','branchDialogue'])if(Array.isArray(out[k])&&!out[k].length)delete out[k];
 if(out.cutscenes&&!Object.keys(out.cutscenes).length)delete out.cutscenes;
 if(out.onComplete&&!out.onComplete.cutscene)delete out.onComplete;
 if(!out.journalDone)delete out.journalDone;
 if(isStaged(out)){out.objectives=[];out.stages=out.stages.map(s=>{const t={...s};for(const k of ['npc','next'])if(!t[k])delete t[k];if(!t.final)delete t.final;if(!t.choices?.length)delete t.choices;if(t.onEnter&&!t.onEnter.cutscene&&!Object.keys(t.onEnter.flags||{}).length)delete t.onEnter;if(t.dialogue&&!Object.values(t.dialogue).some(l=>l?.length))delete t.dialogue;return t})}
 else delete out.stages;
 return out;
}

// h: {el,btn,field,section,actions,picker,npcs:[{id,name}],items:[[id,good]],keys:Set,objectivesUI(host,arr),position(),names()}
export function questV2Sections(right,d,h){
 const {el,btn,field,section,picker}=h,npcChoices=[['','—'],...h.npcs.map(x=>[x.id,x.name])];
 const jsonField=(parent,label,value,set)=>{const n=field(parent,label,'j'+uid(),value==null?'':JSON.stringify(value));n.oninput=()=>{try{set(n.value.trim()?JSON.parse(n.value):undefined);n.setCustomValidity('')}catch{n.setCustomValidity('Invalid JSON')}};return n};
 const lines=(parent,title,arr,onEmpty)=>{const box=el('div',null,{class:'console-map-editor'});box.append(el('h4',title));parent.append(box);
  const paint=()=>{box.querySelectorAll('.console-line').forEach(n=>n.remove());arr.forEach((l,i)=>{const row=el('div',null,{class:'console-line'}),who=el('select',null,{'aria-label':'Speaker'});who.append(el('option','NPC',{value:'npc'}),el('option','Player',{value:'player'}));who.value=l.who||'npc';who.onchange=()=>l.who=who.value;const ta=el('textarea',null,{rows:'2',maxlength:'400','aria-label':title+' line '+(i+1)});ta.value=l.text||'';ta.oninput=()=>l.text=ta.value;row.append(who,ta);btn('✕',()=>{arr.splice(i,1);paint();if(!arr.length)onEmpty?.()},row);box.insertBefore(row,box.lastChild)})};
  box.append(el('span'));paint();btn('Add line',()=>{arr.push({who:'npc',text:''});paint()},box);return box};

 // ---- requirements
 const rq=section('Requirements (checked by the server before accepting)',right,'console-subcard');
 d.requirements??={};const r=d.requirements;if(!('skills' in r)&&!('quests' in r)&&Object.keys(r).length){r.skills={...r};for(const k of Object.keys(r))if(k!=='skills')delete r[k]}
 r.quests??=[];r.skills??={};r.items??={};
 const rg=el('div',null,{class:'console-form-grid'});rq.append(rg);
 const num=(label,key,lo,hi)=>{const n=field(rg,label,'r'+key,r[key]??'','number');n.min=lo;n.max=hi;n.oninput=()=>{if(n.value==='')delete r[key];else r[key]=Number(n.value)}};
 num('Quest points','qp',0,500);num('Combat level','combat',3,126);
 const qbox=el('div',null,{class:'console-checks'});rq.append(el('h4','Quests to finish first'),qbox);
 for(const k of [...h.keys].sort()){const lab=el('label',null,{class:'console-check'}),c=el('input',null,{type:'checkbox'});c.checked=r.quests.includes(k);c.onchange=()=>{r.quests=c.checked?[...new Set([...r.quests,k])]:r.quests.filter(x=>x!==k)};lab.append(c,document.createTextNode(' '+k));qbox.append(lab)}
 if(!h.keys.size)qbox.append(el('p','Give quests a key to require them.',{class:'console-muted'}));
 const sbox=el('div',null,{class:'console-map-editor'});sbox.append(el('h4','Skill levels (real levels; boostable is noted for later boosts)'));rq.append(sbox);
 const paintSkills=()=>{sbox.querySelectorAll('.console-map-row').forEach(n=>n.remove());for(const [k,v] of Object.entries(r.skills)){const row=el('div',null,{class:'console-map-row'}),s=el('select',null,{'aria-label':'Skill'});for(const x of SKILL_NAMES)s.append(el('option',cap(x),{value:x}));s.value=k;const lv=el('input',null,{type:'number',min:'1',max:'99','aria-label':'Level'});lv.value=typeof v==='object'?v.level:v;const bo=el('input',null,{type:'checkbox',title:'Boostable','aria-label':'Boostable'});bo.checked=!!v?.boostable;
  const write=()=>{const val=bo.checked?{level:Number(lv.value),boostable:true}:Number(lv.value);if(s.value!==k)delete r.skills[k];r.skills[s.value]=val};s.onchange=()=>{write();paintSkills()};lv.oninput=write;bo.onchange=write;row.append(s,lv,bo);btn('✕',()=>{delete r.skills[k];paintSkills()},row);sbox.insertBefore(row,sbox.lastChild)}};
 sbox.append(el('span'));paintSkills();btn('Add skill',()=>{const free=SKILL_NAMES.find(x=>!(x in r.skills));if(free){r.skills[free]=10;paintSkills()}},sbox);
 const ibox=el('div',null,{class:'console-map-editor'});ibox.append(el('h4','Items to bring (kept)'));rq.append(ibox);
 const paintItems=()=>{ibox.querySelectorAll('.console-map-row').forEach(n=>n.remove());for(const [k,v] of Object.entries(r.items)){const row=el('div',null,{class:'console-map-row'}),s=el('select',null,{'aria-label':'Item'});for(const [id,g] of h.items)s.append(el('option',g.name,{value:id}));s.value=k;const n=el('input',null,{type:'number',min:'1',max:'1000','aria-label':'Amount'});n.value=v;s.onchange=()=>{delete r.items[k];r.items[s.value]=Number(n.value);paintItems()};n.oninput=()=>r.items[s.value]=Number(n.value);row.append(s,n);btn('✕',()=>{delete r.items[k];paintItems()},row);ibox.insertBefore(row,ibox.lastChild)}};
 ibox.append(el('span'));paintItems();btn('Add item',()=>{const free=h.items.find(([id])=>!(id in r.items));if(free){r.items[free[0]]=1;paintItems()}},ibox);

 // ---- stages
 const sg=section('Stages, choices and flags',right,'console-subcard');
 const onoff=el('label',null,{class:'console-check'}),useStages=el('input',null,{type:'checkbox'});useStages.checked=isStaged(d);onoff.append(useStages,document.createTextNode(' Multi-stage quest (each stage has its own journal text, objectives and dialogue)'));sg.append(onoff);
 useStages.onchange=()=>{toggleStages(d,useStages.checked);h.redraw()};
 if(isStaged(d)){
  sg.append(el('p','Stages run in order. A stage with an NPC waits for the player to report there; a stage with choices asks there (or at the giver) and sets flags; other stages advance by themselves. The last stage is handed in to the giver for the rewards.',{class:'console-muted'}));
  const ids=()=>d.stages.map(s=>s.id),stageChoices=()=>[['','Following stage'],...ids().map(i=>[i,i])];
  d.stages.forEach((st,i)=>{
   const card=el('details',null,{class:'console-subcard console-stage'});card.open=i===0||d.stages.length<4;card.append(el('summary',(i+1)+'. '+st.id+(st.choices?.length?' · choice':'')+(st.npc?' · report':'')));sg.append(card);
   const g=el('div',null,{class:'console-form-grid'});card.append(g);
   const idf=field(g,'Stage id','s'+i+'id',st.id);idf.onchange=()=>{const old=st.id;st.id=idf.value.trim();for(const s of d.stages){if(s.next===old)s.next=st.id;for(const c of s.choices||[])if(c.next===old)c.next=st.id}h.redraw()};
   picker(g,'Report to NPC (optional)',st.npc||'',npcChoices,v=>{if(v)st.npc=v;else delete st.npc});
   picker(g,'Then go to',st.final?'@final':st.next||'',[...stageChoices(),['@final','Quest ends here (hand in)']],v=>{delete st.next;delete st.final;if(v==='@final')st.final=true;else if(v)st.next=v});
   picker(g,'Cutscene on entering',st.onEnter?.cutscene||'',[['','None'],...Object.keys(d.cutscenes||{}).map(k=>[k,k])],v=>{st.onEnter??={};if(v)st.onEnter.cutscene=v;else delete st.onEnter.cutscene});
   const j=field(card,'Journal text (first person: "I agreed to…")','s'+i+'journal',st.journal||'','textarea');j.oninput=()=>st.journal=j.value;
   jsonField(card,'Flags set on entering (JSON, optional)',st.onEnter?.flags,v=>{st.onEnter??={};if(v)st.onEnter.flags=v;else delete st.onEnter.flags});
   const ob=el('div');card.append(el('h4','Objectives'),ob);st.objectives??=[];h.objectivesUI(ob,st.objectives);
   st.dialogue??={};for(const [k,t] of [['progress','While working on it'],['advance','On reporting back'],['choice','Before the choice']]){st.dialogue[k]??=[];lines(card,t,st.dialogue[k])}
   const cb=el('div',null,{class:'console-map-editor'});cb.append(el('h4','Choices (branch + flags)'));card.append(cb);st.choices??=[];
   const paintChoices=()=>{cb.querySelectorAll('.console-choice').forEach(n=>n.remove());st.choices.forEach((c,k)=>{const row=el('div',null,{class:'console-choice console-subcard'}),cg=el('div',null,{class:'console-form-grid'});row.append(cg);
    const cid=field(cg,'Choice id','c'+i+k+'id',c.id);cid.oninput=()=>c.id=cid.value.trim();const lab=field(cg,'Option text','c'+i+k+'l',c.label);lab.oninput=()=>c.label=lab.value;
    picker(cg,'Leads to',c.next||'',stageChoices(),v=>{if(v)c.next=v;else delete c.next});jsonField(cg,'Flags (JSON, e.g. {"spared":true})',c.flags,v=>{if(v)c.flags=v;else delete c.flags});
    c.dialogue??=[];lines(row,'Reply after choosing',c.dialogue);btn('Remove choice',()=>{st.choices.splice(k,1);paintChoices()},row);cb.insertBefore(row,cb.lastChild)})};
   cb.append(el('span'));paintChoices();btn('Add choice',()=>{if(st.choices.length<4){st.choices.push({id:'option-'+(st.choices.length+1),label:'',flags:{}});paintChoices()}},cb);
   const tools=h.actions(card);if(i)btn('↑ Move up',()=>{[d.stages[i-1],d.stages[i]]=[d.stages[i],d.stages[i-1]];h.redraw()},tools);btn('Remove stage',()=>{if(d.stages.length>1){d.stages.splice(i,1);h.redraw()}},tools);
  });
  btn('Add stage',()=>{if(d.stages.length<20){d.stages.push({id:'stage-'+(d.stages.length+1),journal:'',objectives:[{type:'talk',target:'',amount:1}]});h.redraw()}},sg);
 }

 // ---- cutscenes
 const cs=section('Cutscenes (camera shots, captions, dialogue, NPC moves)',right,'console-subcard');d.cutscenes??={};
 cs.append(el('p','Steps: {"fade":"in","ms":700} · {"title":"…","subtitle":"…","ms":2400} · {"shot":{"eye":[x,y,z],"look":[x,y,z]},"ms":1800} · {"shot":{"around":"npcId","distance":3,"height":1.7,"angle":30}} · {"say":{"who":"npc","name":"…","text":"…"}} · {"npc":{"id":"npcId","to":[x,z],"face":[x,z],"ms":1200}} · {"wait":800}. Under 30 s, skippable.',{class:'console-muted'}));
 for(const [name,scene] of Object.entries(d.cutscenes)){
  const box=el('div',null,{class:'console-subcard'}),g=el('div',null,{class:'console-form-grid'});box.append(el('h4','Cutscene “'+name+'”'),g);cs.append(box);
  const t=field(g,'Title','cs'+name,scene.name||'');t.oninput=()=>scene.name=t.value;
  const steps=field(box,'Steps (JSON list)','cs'+name+'steps',JSON.stringify(scene.steps||[],null,1),'textarea');steps.rows=8;steps.classList.add('console-json');steps.oninput=()=>{try{scene.steps=JSON.parse(steps.value);steps.setCustomValidity('')}catch{steps.setCustomValidity('Invalid JSON')}};
  const add=(label,step)=>btn(label,()=>{scene.steps=[...(scene.steps||[]),typeof step==='function'?step():step];steps.value=JSON.stringify(scene.steps,null,1)},a);
  const a=h.actions(box);
  add('+ Fade in',{fade:'in',ms:700});add('+ Caption',{title:d.name||'Title',subtitle:'',ms:2400});add('+ Line',{say:{who:'npc',name:h.names()[d.giver]||'',text:'…'}});
  add('+ Camera on giver',{shot:{around:d.giver,distance:3.2,height:1.7,angle:30}});add('+ Camera from my spot',()=>{const p=h.position();return {shot:{eye:[Math.round(p.x*10)/10,Math.round((p.y??2)*10)/10+3,Math.round(p.z*10)/10],look:[Math.round(p.x*10)/10,Math.round((p.y??0)*10)/10+1,Math.round(p.z*10)/10-6]},ms:1800}});
  add('+ Giver faces me',()=>{const p=h.position();return {npc:{id:d.giver,face:[Math.round(p.x*10)/10,Math.round(p.z*10)/10]}}});add('+ Fade out',{fade:'out',ms:600});
  btn('▶ Preview in game',()=>window.eldervaleTutorial?.playCutscene(name,{scene,record:{command:'sync',payload:{}}}),a);
  btn('Remove cutscene',()=>{delete d.cutscenes[name];h.redraw()},a);
 }
 const ng=el('div',null,{class:'console-inline'});cs.append(ng);const nn=field(ng,'New cutscene name','csnew','');btn('Add cutscene',()=>{const k=nn.value.trim().toLowerCase().replace(/[^a-z0-9_-]+/g,'-');if(k&&!d.cutscenes[k]){d.cutscenes[k]={name:'',steps:[{fade:'in',ms:700,shot:{around:d.giver,distance:3.2,height:1.7,angle:30}},{say:{who:'npc',name:h.names()[d.giver]||'',text:'…'}},{fade:'out',ms:600}]};h.redraw()}},ng);

 // ---- rewards v2: lamps and unlocks; completion text
 const rw=section('Lamps, unlocks and completion',right,'console-subcard');
 d.lamps??=[];const lb=el('div',null,{class:'console-map-editor'});lb.append(el('h4','XP lamps (player picks the skill)'));rw.append(lb);
 const paintLamps=()=>{lb.querySelectorAll('.console-lamp').forEach(n=>n.remove());d.lamps.forEach((l,i)=>{const row=el('div',null,{class:'console-lamp console-form-grid'});
  const mode=field(row,'Kind','lm'+i,'perLevel' in l?'per':'fixed','text',[['per','XP × chosen skill level'],['fixed','Fixed XP']]),amt=field(row,'perLevel' in l?'XP per level':'XP','la'+i,l.perLevel??l.amount??10,'number'),min=field(row,'Minimum level','ln'+i,l.minLevel??1,'number'),lab=field(row,'Label','ll'+i,l.label||'');
  const sk=field(row,'Only these skills (comma list, optional)','ls'+i,(l.skills||[]).join(','));
  const write=()=>{delete l.amount;delete l.perLevel;l[mode.value==='per'?'perLevel':'amount']=Number(amt.value);l.minLevel=Number(min.value)||1;if(lab.value)l.label=lab.value;else delete l.label;const s=sk.value.split(',').map(x=>x.trim()).filter(Boolean);if(s.length)l.skills=s;else delete l.skills};
  for(const n of [mode,amt,min,lab,sk])n.oninput=n.onchange=write;btn('✕',()=>{d.lamps.splice(i,1);paintLamps()},row);lb.insertBefore(row,lb.lastChild)})};
 lb.append(el('span'));paintLamps();btn('Add lamp',()=>{if(d.lamps.length<4){d.lamps.push({perLevel:10,minLevel:1});paintLamps()}},lb);
 d.unlocks??=[];const ub=el('div',null,{class:'console-map-editor'});ub.append(el('h4','Unlocks (stored per player; other systems read player_unlocked / quest_flag)'));rw.append(ub);
 const paintUnlocks=()=>{ub.querySelectorAll('.console-unlock').forEach(n=>n.remove());d.unlocks.forEach((u,i)=>{const row=el('div',null,{class:'console-unlock console-subcard'}),g=el('div',null,{class:'console-form-grid'});row.append(g);
  picker(g,'Type',u.type,Object.entries(UNLOCK_TYPES),v=>{u.type=v;paintUnlocks()});const id=field(g,'Id (e.g. shortcut.mill-wall)','ui'+i,u.id||'');id.oninput=()=>u.id=id.value.trim();const lab=field(g,'Label','ul'+i,u.label||'');lab.oninput=()=>u.label=lab.value;
  jsonField(g,'Only if flags (JSON, optional)',u.ifFlags,v=>{if(v)u.ifFlags=v;else delete u.ifFlags});
  if(u.type==='teleport'){for(const k of ['x','z']){const n=field(g,k.toUpperCase(),'u'+i+k,u[k]??'','number');n.step=.1;n.oninput=()=>u[k]=Number(n.value)}btn('Use my position',()=>{const p=h.position();u.x=Math.round(p.x*10)/10;u.z=Math.round(p.z*10)/10;paintUnlocks()},g)}
  if(u.type==='dialogue'){picker(g,'NPC',u.npc||'',npcChoices,v=>u.npc=v);u.lines??=[];lines(row,'New lines (first line is the greeting)',u.lines)}
  btn('Remove unlock',()=>{d.unlocks.splice(i,1);paintUnlocks()},row);ub.insertBefore(row,ub.lastChild)})};
 ub.append(el('span'));paintUnlocks();btn('Add unlock',()=>{if(d.unlocks.length<12){d.unlocks.push({type:'flag',id:(d.key||'quest')+'.done',label:''});paintUnlocks()}},ub);
 const cg=el('div',null,{class:'console-form-grid'});rw.append(cg);d.onComplete??={};
 picker(cg,'Cutscene before the reward scroll',d.onComplete.cutscene||'',[['','None'],...Object.keys(d.cutscenes).map(k=>[k,k])],v=>{if(v)d.onComplete.cutscene=v;else delete d.onComplete.cutscene});
 const jd=field(rw,'Journal text once complete','q_journalDone',d.journalDone||'','textarea');jd.oninput=()=>d.journalDone=jd.value;
 d.journalVariants??=[];jsonField(rw,'Extra completion text by flags (JSON list of {ifFlags,text})',d.journalVariants.length?d.journalVariants:null,v=>d.journalVariants=Array.isArray(v)?v:[]);
 d.branchDialogue??=[];jsonField(rw,'Dialogue by flags (JSON list of {stage:"complete",ifFlags,lines})',d.branchDialogue.length?d.branchDialogue:null,v=>d.branchDialogue=Array.isArray(v)?v:[]);
}

// Simulator panel: step through the draft like a player would.
export function questSimulator(host,d,{el,btn,names=()=>({})}){
 host.replaceChildren();const sim=createQuestSimulator(structuredClone(d));
 const journal=el('div',null,{class:'quest-stages console-sim-journal'}),acts=el('div',null,{class:'studio-actions'}),log=el('pre',null,{class:'console-preview-text'}),extra=el('p',null,{class:'console-muted'});
 host.append(el('h4','Simulator'),journal,acts,extra,log);
 const paint=()=>{journal.replaceChildren();for(const e of sim.journal()){const p=el('p',null,{class:e.done?'done':e.complete?'complete':'current'});p.append(e.done?el('s',e.text):el('span',e.text));journal.append(p)}
  acts.replaceChildren();for(const a of sim.actions())btn(a.label,()=>{sim.apply(a);paint()},acts);if(!sim.actions().length)btn('↺ Restart',()=>questSimulator(host,d,{el,btn,names}),acts);
  const f=sim.flags();extra.textContent=(Object.keys(f).length?'Flags: '+JSON.stringify(f)+' · ':'')+(sim.quest.completed?'Unlocks: '+(sim.unlocks().map(unlockLabel).join(', ')||'none')+' · Lamps: '+((d.lamps||[]).map(lampLabel).join(', ')||'none'):'');
  const nm=names();log.textContent=sim.log.map(l=>l.replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/g,id=>nm[id]||id)).join('\n')};
 paint();return sim;
}

// Dependency check of every quest (no cycles, no missing prerequisites).
export function questGraphNote(rows){
 const g=questGraph(rows.map(q=>q.data));
 if(!g.cycles.length&&!g.missing.length)return 'Quest prerequisites OK: '+g.edges.length+' links, no loops.';
 return [...g.cycles.map(c=>'Loop: '+c.join(' → ')),...g.missing.map(([q,k])=>q+' requires missing key '+k)].join(' · ');
}

// Per-player quest inspector + guidance settings (left pane of the Quests tab).
export function questPlayerTools(host,{el,btn,field,invoke,note,quests=()=>[]}){
 const box=el('details',null,{class:'console-subcard'});box.append(el('summary','Player quest state'));host.append(box);
 const f=el('div',null,{class:'console-inline'});box.append(f);const q=field(f,'Find player','qv2find','');const results=el('div',null,{class:'console-list'}),view=el('div');box.append(results,view);
 btn('Search',async()=>{const rows=await invoke('qv2_player_search',{query:q.value.trim()});results.replaceChildren();for(const p of rows){const b=el('button',p.name,{type:'button',class:'console-row'});b.onclick=()=>show(p);results.append(b)}if(!rows.length)results.append(el('p','No players found.',{class:'console-muted'}))},f);
 async function show(p){
  const st=await invoke('qv2_player_state',{userId:p.userId});view.replaceChildren(el('h4',p.name+' · '+st.state.qp+' QP'));
  const unl=Object.values(st.state.unlocks||{}),lamps=st.state.lamps||[];view.append(el('p','Unlocks: '+(unl.map(u=>u.label||u.id).join(', ')||'none')+' · Lamps waiting: '+lamps.length,{class:'console-muted'}));
  for(const r of st.quests.filter(x=>x.accepted||x.completed||x.staged)){
   const row=el('div',null,{class:'console-subcard'});row.append(el('strong',r.name),el('small',(r.completed?'Completed':r.accepted?'In progress':'Not started')+(r.progress._stage?' · stage '+r.progress._stage:'')+(r.missing.length?' · missing: '+r.missing.join(', '):'')));
   if(r.progress._flags&&Object.keys(r.progress._flags).length)row.append(el('small','Flags: '+JSON.stringify(r.progress._flags)));
   const a=el('div',null,{class:'studio-actions'});row.append(a);
   if(r.staged){const sel=el('select',null,{'aria-label':'Stage'});for(const s of r.stages)sel.append(el('option',s,{value:s}));sel.value=r.progress._stage||r.stages[0];a.append(sel);btn('Set stage',async()=>{await invoke('qv2_set_stage',{userId:p.userId,id:r.id,stage:sel.value});note('Stage set to '+sel.value+'.');void show(p)},a)}
   if(r.accepted){const fl=el('input',null,{type:'text',placeholder:'{"flag":true} (null clears)','aria-label':'Flags JSON'});a.append(fl);btn('Set flags',async()=>{await invoke('qv2_set_flags',{userId:p.userId,id:r.id,flags:JSON.parse(fl.value||'{}')});note('Flags updated.');void show(p)},a);
    if(!r.completed)btn('Mark complete',async()=>{await invoke('qv2_complete',{userId:p.userId,id:r.id});note('Marked complete (unlocks and lamps granted, no XP or items).');void show(p)},a)}
   if(r.accepted||r.completed)btn('Reset',async()=>{if(!confirm('Reset '+r.name+' for '+p.name+'? Its unlocks, lamps and flags are removed.'))return;await invoke('qv2_reset',{userId:p.userId,id:r.id});note('Quest reset.');void show(p)},a).classList.add('danger');
   view.append(row);
  }
 }
 const gbox=el('details',null,{class:'console-subcard'});gbox.append(el('summary','Quest guidance (trail and minimap)'));host.append(gbox);
 btn('Load',async()=>{const v=await invoke('qv2_guidance_get',{});gbox.querySelectorAll('.console-form-grid').forEach(n=>n.remove());const g=el('div',null,{class:'console-form-grid'});gbox.append(g);
  const t=field(g,'Ground trail for everyone','g_trail',v.trail!==false,'checkbox'),m=field(g,'Minimap path and arrow','g_min',v.minimap!==false,'checkbox'),len=field(g,'Trail length (tiles, 6–40)','g_len',v.length??16,'number');
  btn('Save guidance',async()=>{await invoke('qv2_guidance_set',{value:{trail:t.checked,minimap:m.checked,length:Number(len.value)||16}});note('Guidance saved; players pick it up on their next sync. Players can still switch the trail off in Settings.')},g)},gbox);
 box.append(el('p',questGraphNote(quests()),{class:'console-muted'}));
}
export {validateV2Draft};
