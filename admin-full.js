// Owner console › full-control tabs: Catalog, Economy, Quests, Backup and Audit, plus the player
// inspector shown inside Players. Reads use world_admin directly; writes go through ctx.invoke so
// they are owner-checked and audited on the server (db/admin-full-control.sql, fc_* commands).
import {goods} from './economy.js?v=release-20261107-horse126';
import {SKILLS,skillLabel,xpKey,statsXpKey,levelForXp,CATALOG_GROUPS,catalogForm,buildCatalogData,validateCatalogDraft,catalogKind,catalogMatches,duplicateId,
 normalizeMultipliers,effectiveXp,validateTimeOverride,MULTIPLIER_LIMITS,OBJECTIVE_TYPES,QUEST_EVENTS,DIALOGUE_STAGES,validateQuestDraft,questPreview,objectiveText,
 auditLine,backupStats,MODERATION_PRESETS} from './admin-full-data.js?v=release-20261107-horse126';
import {questV2Sections,questSimulator,questPlayerTools,V2_KEYS,cleanV2,validateV2Draft} from './admin-quest-v2.js?v=release-20261107-horse126';

const QUEST_KEYS=['name','description','giver','key','chain','order','requires','questPoints','icon','finishes','published','hint','objectives','gold','items','startItems','xp','dialogue',...V2_KEYS];
const download=(name,data)=>{const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)};
const itemName=id=>goods[id]?.name||id;
const originalItems=()=>Object.entries(goods).filter(([,g])=>!g.noteOf);

export function createFullControlTabs(ctx){
 const {el,btn,field,invoke,note}=ctx;
 const W=()=>ctx.workspace,read=(command,payload={})=>ctx.rpc('world_admin',{command,payload});
 const active=name=>ctx.tab()===name;
 const section=(title,parent=W(),cls='console-card')=>{const s=el('section',null,{class:cls});if(title)s.append(el('h3',title));parent.append(s);return s};
 const actions=parent=>{const a=el('div',null,{class:'studio-actions'});parent.append(a);return a};
 const chip=(label,on,fn,parent)=>{const b=btn(label,fn,parent);b.classList.add('console-chip');b.setAttribute('aria-pressed',String(!!on));return b};
 const search=(parent,placeholder,value,oninput)=>{const s=el('input',null,{type:'search',class:'console-search',placeholder,'aria-label':placeholder});s.value=value||'';s.oninput=()=>oninput(s.value);parent.append(s);return s};
 const errorsBox=parent=>{const box=el('ul',null,{class:'console-errors',role:'alert'});box.hidden=true;parent.append(box);return list=>{box.replaceChildren(...list.map(t=>el('li',t)));box.hidden=!list.length;return !list.length}};
 const detailOpen={};const stacked=()=>matchMedia('(max-width:900px)').matches||document.body.classList.contains('compact-layout');
 function split(wide=false){const tab=ctx.tab(),layout=el('div',null,{class:'console-split'}),back=el('button','← Back to list',{type:'button',class:'console-back'}),left=el('div',null,{class:'console-pane console-list-pane'}),right=el('aside',null,{class:'console-pane console-detail'+(wide?' wide':'')});layout.append(back,left,right);W().append(layout);
  const set=on=>{detailOpen[tab]=on;layout.classList.toggle('show-detail',on)};set(!!detailOpen[tab]);
  back.onclick=()=>{set(false);W().scrollTop=0};return {left,right,focus(){set(true);if(stacked())W().scrollTop=0}}}
 const loading=(parent,text)=>{const p=el('p',text,{class:'console-muted'});parent.append(p);return p};

 // ---------------------------------------------------------------- Catalog
 const cat={rows:null,query:'',chip:'',selected:null,creating:null};
 function Catalog(){
  const {left,right,focus}=split(true);
  const chips=el('div',null,{class:'console-chips',role:'toolbar','aria-label':'Item types'});left.append(chips);
  for(const c of ['All','Items','Equipment','Weapons','Armour','Shields','Notes','Custom','Edited','Disabled'])chip(c,(cat.chip||'All')===c,()=>{cat.chip=c==='All'?'':c;ctx.redraw()},chips);
  search(left,'Search name, ID, category or tier…',cat.query,v=>{cat.query=v;draw()});
  const list=el('div',null,{class:'console-list'});left.append(list);
  const a=actions(left);btn('New item',()=>{cat.creating={id:'item:custom_new_item',data:{name:'New item',buy:10,sell:3,icon:'supply',category:'Materials'}};cat.selected=null;detail();focus()},a);
  btn('Reload',async()=>{cat.rows=null;await load()},a);
  const draw=()=>{list.replaceChildren();if(!cat.rows){list.append(el('p','Loading catalog…',{class:'console-muted'}));return}
   const found=cat.rows.filter(r=>catalogMatches(r,cat.query,cat.chip));
   for(const r of found.slice(0,300)){const b=el('button',null,{type:'button',class:'console-row'+(cat.selected===r.id?' selected':'')+(r.data.disabled?' deleted':'')}),art=el('span',null,{class:'console-icon'});const g=goods[r.id.replace(/^item:/,'')];art.innerHTML=g?.icon||'';b.append(art,el('span',null,{class:'console-row-text'}));
    b.lastChild.append(el('strong',(r.data.disabled?'Disabled · ':'')+(r.data.name||r.id)),el('small',r.id+' · '+catalogKind(r.id,r.data)+(r.data.tier?' · '+r.data.tier:'')+(r.data.ownerEdited?' · edited':'')));
    b.onclick=()=>{cat.selected=r.id;cat.creating=null;draw();detail();focus()};list.append(b)}
   if(found.length>300)list.append(el('p','Showing 300 of '+found.length+'. Refine the search.',{class:'console-muted'}));if(!found.length)list.append(el('p','No catalog rows match.',{class:'console-muted'}))};
  async function load(){if(!cat.rows){draw();try{cat.rows=await read('fc_catalog_list')}catch(e){note(e.message,true);cat.rows=[]}}if(active('Catalog')){draw();detail()}}
  function detail(){right.replaceChildren();const creating=cat.creating,row=creating||cat.rows?.find(r=>r.id===cat.selected);
   if(!row){right.append(el('h3','Select an item'),el('p','Edit any item, weapon, armour piece or shield: name, examine text, value, healing, equipment slot, level requirements, attack/defence bonuses, tier and more. Unknown fields stay editable as Advanced JSON.',{class:'console-muted'}));return}
   const existing=new Set((cat.rows||[]).map(r=>r.id)),form=catalogForm(row.id,row.data),inputs={};
   right.append(el('small',creating?'New catalog entry':catalogKind(row.id,row.data),{class:'console-eyebrow'}),el('h3',row.data.name||row.id));
   const f=el('form');f.onsubmit=e=>e.preventDefault();right.append(f);
   const idInput=field(f,'Catalog ID (prefix:name)','catId',row.id);idInput.readOnly=!creating;idInput.spellcheck=false;
   CATALOG_GROUPS.forEach((group,gi)=>{const box=el('details',null,{class:'console-subcard'});box.open=gi<2||group.fields.some(fd=>fd.type!=='bool'&&form.values[fd.path.join('.')]!==''&&form.values[fd.path.join('.')]!==undefined&&gi>1);box.append(el('summary',group.title));const grid=el('div',null,{class:'console-form-grid'});box.append(grid);f.append(box);
    for(const fd of group.fields){const key=fd.path.join('.'),v=form.values[key];let input;
     if(fd.type==='select')input=field(grid,fd.label,'cf_'+key,v||'','text',fd.options);
     else if(fd.type==='bool')input=field(grid,fd.label,'cf_'+key,v,'checkbox');
     else if(fd.type==='textarea'){input=field(f.contains(grid)?grid:grid,fd.label,'cf_'+key,v,'textarea');input.parentElement.classList.add('span-2')}
     else{input=field(grid,fd.label,'cf_'+key,v,fd.type==='number'?'number':'text');if(fd.type==='number'){input.min=fd.min;input.max=fd.max;input.step=fd.step||'any'}}
     inputs[key]={input,fd}}});
   const adv=el('details',null,{class:'console-subcard'});adv.append(el('summary','Advanced JSON (fields without a form control, including future ones)'));const json=el('textarea',null,{class:'console-json','aria-label':'Advanced JSON',rows:'6',spellcheck:'false'});json.value=JSON.stringify(form.extra,null,1);adv.open=Object.keys(form.extra).length>0;adv.append(json);f.append(adv);
   const showErrors=errorsBox(right);
   const collect=()=>{const values={};for(const [key,{input,fd}] of Object.entries(inputs))values[key]=fd.type==='bool'?input.checked:input.value;let extra;try{extra=JSON.parse(json.value||'{}')}catch(e){throw Error('Advanced JSON: '+e.message)}return buildCatalogData(idInput.value.trim(),values,extra,form.examineKey)};
   const a=actions(right);a.classList.add('console-primary-actions');
   btn(creating?'Create item':'Save item',async()=>{const id=idInput.value.trim(),data=collect();if(!showErrors(validateCatalogDraft(id,data,{create:!!creating,existing})))return;const r=await invoke('fc_catalog_save',{id,data,create:!!creating});
    const i=cat.rows.findIndex(x=>x.id===r.id);if(i<0)cat.rows.push({id:r.id,data:r.data});else cat.rows[i]={id:r.id,data:r.data};cat.selected=r.id;cat.creating=null;note('Saved '+r.data.name+'. Players see display changes on their next sync.');draw();detail()},a);
   btn('Validate',()=>{const ok=showErrors(validateCatalogDraft(idInput.value.trim(),collect(),{create:!!creating,existing}));if(ok)note('No problems found.')},a);
   btn('Duplicate',()=>{const data=collect();cat.creating={id:duplicateId(row.id,existing),data:{...data,name:data.name+' (copy)',disabled:undefined}};delete cat.creating.data.disabled;cat.selected=null;detail()},a);
   if(!creating){const d=btn(row.data.disabled?'Enable':'Disable',async()=>{const r=await invoke('fc_catalog_disable',{id:row.id,disabled:!row.data.disabled});row.data=r.data;draw();detail()},a);if(!row.data.disabled)d.classList.add('danger');
    if(row.id.startsWith('item:')&&!row.data.noteOf)btn('Give me one',()=>invoke('give',{item:row.id.slice(5),amount:1,destination:'inventory'}),a)}
   right.append(el('p','Disable hides an item from console pickers without breaking saves that hold it. Untradeable items are refused by the trade window on the server.',{class:'console-muted'}));
  }
  draw();detail();void load();
 }

 // ---------------------------------------------------------------- Economy (multipliers + world clock)
 function Economy(){
  const box=el('div',null,{class:'console-columns'});W().append(box);const wait=loading(box,'Loading game settings…');
  void read('fc_settings_get').then(cfg=>{if(!active('Economy'))return;wait.remove();let m=normalizeMultipliers(cfg.multipliers||{});
   const glob=section('Global multipliers',box),gf=el('div',null,{class:'console-form-grid'});glob.append(gf);const G={};
   for(const [k,label,help] of [['xp','XP multiplier','All skill XP awards (professions, quests, combat)'],['dropRate','Drop-rate multiplier','Monster loot chances (always-drops ignore it)'],['respawn','Respawn-time multiplier','Below 1 respawns faster'],['shopPrice','Shop price multiplier','Merchant buy and sell prices']]){const [lo,hi]=MULTIPLIER_LIMITS[k];const n=field(gf,label+' ('+lo+'–'+hi+')','m_'+k,m[k],'number');n.min=lo;n.max=hi;n.step='0.05';n.title=help;G[k]=n}
   const pre=actions(glob);for(const [label,x] of [['Normal 1×',1],['Double XP 2×',2],['Triple XP 3×',3]])btn(label,()=>{G.xp.value=x;paintSkills()},pre);btn('Reset everything to 1×',()=>{for(const n of Object.values(G))n.value=1;for(const n of Object.values(S))n.value=1;paintSkills()},pre);
   const per=section('Per-skill XP multipliers',box),table=el('div',null,{class:'console-skill-grid'});per.append(el('p','Multiplies on top of the global XP multiplier. Effective value shown on the right.',{class:'console-muted'}),table);const S={},eff={};
   for(const s of SKILLS){const row=el('label',null,{class:'console-skill-row'});row.append(el('span',skillLabel(s)));const n=el('input',null,{type:'number',min:'0',max:'100',step:'0.05','aria-label':skillLabel(s)+' multiplier'});n.value=m.skills[s]??1;n.oninput=paintSkills;S[s]=n;eff[s]=el('small','');row.append(n,eff[s]);table.append(row)}
   function current(){const v={skills:{}};for(const [k,n] of Object.entries(G))v[k]=Number(n.value);for(const [s,n] of Object.entries(S))v.skills[s]=Number(n.value);return normalizeMultipliers(v)}
   function paintSkills(){let c;try{c=current()}catch{return}for(const s of SKILLS)eff[s].textContent='= '+effectiveXp(c,s)+'×'}paintSkills();G.xp.oninput=paintSkills;
   const sa=actions(per);sa.classList.add('console-primary-actions');btn('Save multipliers',async()=>{m=current();await invoke('fc_settings_save',{key:'multipliers',value:m});note('Multipliers saved. They apply to the next award, drop, respawn or trade.')},sa);
   const world=section('World clock',box),wf=el('form',null,{class:'console-inline'});wf.onsubmit=e=>e.preventDefault();world.append(el('p','Lock the sky to an hour for every player, or follow the real (Eastern) clock.',{class:'console-muted'}),wf);
   const hour=field(wf,'Hour (0–24, empty = real time)','timeOverride',cfg.world?.timeOverride??'','number');hour.min=0;hour.max=24;hour.step='0.5';
   btn('Apply time',async()=>{const v=validateTimeOverride(hour.value);await invoke('fc_settings_save',{key:'world',value:{timeOverride:v,classicLook:!!cfg.world?.classicLook}});cfg.world={...(cfg.world||{}),timeOverride:v};note(v===null?'Sky follows the real clock.':'Sky locked to '+v+':00.')},wf);
   const qa=actions(world);for(const [label,h] of [['Dawn',6],['Noon',12],['Dusk',19],['Midnight',0]])btn(label,()=>{hour.value=h},qa);btn('Real time',()=>{hour.value=''},qa);
   world.append(el('p','Weather: see Game › Weather to force, schedule or turn off rain, storms, fog and snow.',{class:'console-muted'}));
   // Graphics default (classic-look.js): players who never touched Settings › Classic look follow this.
   const look=section('Classic look default',box),lf=el('form',null,{class:'console-inline'});lf.onsubmit=e=>e.preventDefault();look.append(el('p','Old-school low-detail look: simple low-poly models, soft lighting and a limited palette at full resolution (faster on iPad and phones). Players can still switch it in Settings › Graphics; their own choice wins.',{class:'console-muted'}),lf);
   const classicBox=el('input',null,{type:'checkbox','aria-label':'Classic look by default'});classicBox.checked=cfg.world?.classicLook===true;const classicLabel=el('label',' Classic look by default');classicLabel.prepend(classicBox);lf.append(classicLabel);
   btn('Save look default',async()=>{const tv=cfg.world?.timeOverride??null;await invoke('fc_settings_save',{key:'world',value:{timeOverride:tv,classicLook:classicBox.checked}});cfg.world={...(cfg.world||{}),classicLook:classicBox.checked};note(classicBox.checked?'New sessions start in the classic look unless a player turned it off.':'Classic look is off by default.')},lf);
   const help=section('Where multipliers apply',box);help.append(el('p','XP: skill_xp (professions, fishing, farming, quests), combat XP and woodcutting. Hitpoints XP from taking damage and the legacy kill XP counter are not scaled. Drop rate: monster loot rolls. Respawn: monsters and NPCs after defeat. Shop price: every merchant quote.',{class:'console-muted'}));
  }).catch(e=>{wait.textContent='Settings unavailable: '+e.message});
 }

 // ---------------------------------------------------------------- Quests
 const qs={rows:null,actors:[],query:'',selected:null,draft:null};
 function Quests(){
  const {left,right,focus}=split(true);
  search(left,'Search quests…',qs.query,v=>{qs.query=v;draw()});
  const list=el('div',null,{class:'console-list'});left.append(list);
  const a=actions(left);btn('New quest',()=>{qs.selected=null;qs.draft=blank();editor();focus()},a);
  const tools=el('div');left.append(tools);let toolsDrawn=false;const drawTools=()=>{if(toolsDrawn||!qs.rows)return;toolsDrawn=true;questPlayerTools(tools,{el,btn,field,invoke,note,quests:()=>qs.rows||[]})};
  const blank=()=>({name:'',description:'',giver:qs.actors.find(x=>x.kind==='npc')?.id||'',published:false,questPoints:1,objectives:[{type:'talk',target:'',amount:1}],gold:0,items:{},xp:{},startItems:{},dialogue:{offer:[],progress:[],complete:[]}});
  const names=()=>Object.fromEntries([...qs.actors.map(x=>[x.id,x.name]),...Object.entries(goods).map(([k,g])=>[k,g.name])]);
  const draw=()=>{list.replaceChildren();if(!qs.rows){list.append(el('p','Loading quests…',{class:'console-muted'}));return}
   const found=qs.rows.filter(q=>(q.data.name+' '+(q.data.key||'')+' '+(q.data.chain||'')).toLowerCase().includes(qs.query.toLowerCase())).sort((a,b)=>(a.data.chain||'~').localeCompare(b.data.chain||'~')||(a.data.order||0)-(b.data.order||0));
   for(const q of found){const b=el('button',null,{type:'button',class:'console-row'+(qs.selected===q.id?' selected':'')});b.append(el('span',null,{class:'console-dot '+(q.data.published?'on':'off'),title:q.data.published?'Published':'Draft'}),el('span',null,{class:'console-row-text'}));b.lastChild.append(el('strong',q.data.name),el('small',(q.data.chain?q.data.chain+' #'+(q.data.order??0)+' · ':'')+(q.data.objectives?.length||0)+' objectives · v'+q.version+(q.data.published?'':' · draft')));b.onclick=()=>{qs.selected=q.id;qs.draft=structuredClone(q.data);draw();editor();focus()};list.append(b)}
   if(!found.length)list.append(el('p','No quests yet.',{class:'console-muted'}))};
  async function load(){try{const [rows,world]=await Promise.all([read('quest_list'),ctx.rpc('world_admin_overview')]);qs.rows=rows;qs.actors=(world.actors||[]).filter(x=>!x.deleted).map(x=>({id:x.id,name:x.data?.name||x.id,kind:x.data?.kind,attackable:x.data?.attackable??x.data?.kind==='monster'}))}catch(e){note(e.message,true);qs.rows=qs.rows||[]}if(active('Quests')){draw();editor();drawTools()}}
  function picker(parent,label,value,choices,onchange){const s=field(parent,label,'qp'+Math.random().toString(36).slice(2),value??'','text',choices);s.onchange=()=>onchange(s.value);return s}
  function editor(){right.replaceChildren();const d=qs.draft;if(!d){right.append(el('h3','Select a quest'),el('p','Build data-driven quests: talk, kill, collect, events, XP, carry, equip, bank and visit objectives, with rewards, quest points, chains and dialogue.',{class:'console-muted'}));return}
   const npcs=qs.actors.filter(x=>x.kind==='npc'),enemies=qs.actors.filter(x=>x.attackable),items=originalItems(),keys=new Set(qs.rows.filter(q=>q.id!==qs.selected).map(q=>q.data.key).filter(Boolean));
   right.append(el('small',qs.selected?'Editing quest':'New quest',{class:'console-eyebrow'}),el('h3',d.name||'Untitled quest'));
   const basics=section('Basics',right,'console-subcard'),bf=el('div',null,{class:'console-form-grid'});basics.append(bf);
   const t=(label,key,type='text')=>{const n=field(bf,label,'q_'+key,d[key]??'',type);n.oninput=n.onchange=()=>{d[key]=type==='checkbox'?n.checked:type==='number'?(n.value===''?undefined:Number(n.value)):n.value};return n};
   t('Name','name');picker(bf,'Quest giver (start and return)',d.giver,[['','Choose an NPC'],...npcs.map(x=>[x.id,x.name])],v=>d.giver=v);t('Key (for chains/prerequisites)','key');t('Chain','chain');t('Order in chain','order','number');
   picker(bf,'Requires quest',d.requires||'',[['','Nothing'],...[...keys].map(k=>[k,k])],v=>{if(v)d.requires=v;else delete d.requires});t('Quest points','questPoints','number');
   picker(bf,'Journal icon',d.icon||'',[['','First reward item'],['coins','Coins'],...items.map(([k,g])=>[k,g.name])],v=>{if(v)d.icon=v;else delete d.icon});
   picker(bf,'Completing it',d.finishes||'',[['','Just completes'],['tutorial','Finishes castle training']],v=>{if(v)d.finishes=v;else delete d.finishes});t('Published (players can accept)','published','checkbox');
   const desc=field(basics,'Description / journal text','q_description',d.description,'textarea');desc.oninput=()=>d.description=desc.value;
   // objectives
   // One objective list editor, used for a classic quest and for every stage of a v2 quest.
   const objectivesUI=(host,list)=>{const olist=el('div');host.append(olist);
   const paintObjectives=()=>{olist.replaceChildren();list.forEach((o,i)=>{const row=el('div',null,{class:'console-objective'}),g=el('div',null,{class:'console-form-grid'});row.append(el('strong',(i+1)+'. '+objectiveText(o,names())),g);
    picker(g,'Type',o.type,Object.entries(OBJECTIVE_TYPES).map(([k,v])=>[k,v.label]),v=>{list[i]={type:v,amount:1};paintObjectives()});
    const num=(label,key,step=1)=>{const n=field(g,label,'o'+i+key,o[key]??'','number');n.step=step;n.oninput=()=>{o[key]=n.value===''?undefined:Number(n.value)};return n};
    num('Amount','amount');
    if(o.type==='talk')picker(g,'NPC',o.target,[['','Choose'],...npcs.map(x=>[x.id,x.name])],v=>o.target=v);
    if(o.type==='kill')picker(g,'Enemy',o.target||o.targets?.[0]||'',[['','Choose'],...enemies.map(x=>[x.id,x.name])],v=>{o.target=v;delete o.targets});
    if(['collect','have'].includes(o.type))picker(g,'Item',o.target,[['','Choose'],...items.map(([k,x])=>[k,x.name])],v=>o.target=v);
    if(o.type==='bank')picker(g,'Item',o.target,[['*','Any item'],...items.map(([k,x])=>[k,x.name])],v=>o.target=v);
    if(o.type==='equip'){picker(g,'Slot',o.target,[['','Choose'],...['weapon','shield','helm','chest','legs','boots','gloves','cape','amulet','ring','mount'].map(s=>[s,s])],v=>o.target=v);const it=field(g,'Specific item key (optional)','o'+i+'item',o.item||'');it.oninput=()=>{if(it.value)o.item=it.value;else delete o.item}}
    if(o.type==='xp')picker(g,'Skill',o.skill,[['','Choose'],...SKILLS.map(s=>[s,skillLabel(s)])],v=>o.skill=v);
    if(o.type==='event'){picker(g,'Event',o.event,[['','Choose'],...QUEST_EVENTS.map(s=>[s,s])],v=>o.event=v);const m=field(g,'Match (JSON, optional)','o'+i+'match',o.match?JSON.stringify(o.match):'');m.oninput=()=>{try{if(m.value.trim())o.match=JSON.parse(m.value);else delete o.match;m.setCustomValidity('')}catch{m.setCustomValidity('Invalid JSON')}};const tg=field(g,'Target IDs (comma separated, optional)','o'+i+'targets',(o.targets||[]).join(','));tg.oninput=()=>{const v=tg.value.split(',').map(s=>s.trim()).filter(Boolean);if(v.length)o.targets=v;else delete o.targets}}
    if(o.type==='visit'){num('X','x',.1);num('Z','z',.1);num('Radius (m)','radius',.1);num('Floor (0–2)','floor');btn('Use my position',()=>{const p=ctx.bridge.position();o.x=Math.round(p.x*10)/10;o.z=Math.round(p.z*10)/10;o.radius??=3;paintObjectives()},g)}
    const label=field(g,'Journal label (optional)','o'+i+'label',o.label||'');label.oninput=()=>{if(label.value)o.label=label.value;else delete o.label};
    const tools=actions(row);if(i)btn('↑ Move up',()=>{[list[i-1],list[i]]=[list[i],list[i-1]];paintObjectives()},tools);btn('Remove',()=>{list.splice(i,1);paintObjectives()},tools);olist.append(row)})};
   paintObjectives();btn('Add objective',()=>{if(list.length>=12)throw Error('Up to 12 objectives');list.push({type:'collect',target:'',amount:1});paintObjectives()},host)};
   const obj=section('Objectives',right,'console-subcard');
   if(Array.isArray(d.stages)&&d.stages.length)obj.append(el('p','This quest uses stages: each stage below has its own objectives.',{class:'console-muted'}));else objectivesUI(obj,d.objectives??=[]);
   // rewards
   const rw=section('Rewards',right,'console-subcard'),gold=field(rw,'Gold coins','q_gold',d.gold||0,'number');gold.oninput=()=>d.gold=Number(gold.value)||0;
   const mapEditor=(title,key,choices,lo,hi)=>{const box=el('div',null,{class:'console-map-editor'});box.append(el('h4',title));rw.append(box);d[key]??={};const paint=()=>{box.querySelectorAll('.console-map-row').forEach(n=>n.remove());for(const [k,v] of Object.entries(d[key])){const row=el('div',null,{class:'console-map-row'}),s=el('select',null,{'aria-label':title});for(const [id,label] of choices)s.append(el('option',label,{value:id}));s.value=k;const n=el('input',null,{type:'number',min:String(lo),max:String(hi),'aria-label':'Amount'});n.value=v;s.onchange=()=>{const val=d[key][k];delete d[key][k];d[key][s.value]=val;paint()};n.oninput=()=>d[key][s.value]=Number(n.value);row.append(s,n);btn('✕',()=>{delete d[key][k];paint()},row);box.insertBefore(row,box.lastChild)}};box.append(el('span'));paint();btn('Add',()=>{const free=choices.find(([id])=>!(id in d[key]));if(free){d[key][free[0]]=lo;paint()}},box)};
   mapEditor('XP rewards','xp',SKILLS.map(s=>[s,skillLabel(s)]),1,1000000);mapEditor('Item rewards','items',items.map(([k,g])=>[k,g.name]),1,1000);mapEditor('Start items (given on accept)','startItems',items.map(([k,g])=>[k,g.name]),1,1000);
   questV2Sections(right,d,{el,btn,field,section,actions,picker,npcs,items,keys,objectivesUI,names,position:()=>ctx.bridge.position(),redraw:editor});
   // dialogue
   const dl=section('Dialogue',right,'console-subcard');d.dialogue??={};
   for(const stage of DIALOGUE_STAGES){const box=el('div',null,{class:'console-map-editor'});box.append(el('h4',{offer:'Offer (before accepting)',progress:'Progress (while active)',complete:'Complete (hand-in)'}[stage]));dl.append(box);d.dialogue[stage]??=[];
    const paint=()=>{box.querySelectorAll('.console-line').forEach(n=>n.remove());d.dialogue[stage].forEach((l,i)=>{const row=el('div',null,{class:'console-line'}),who=el('select',null,{'aria-label':'Speaker'});who.append(el('option','NPC',{value:'npc'}),el('option','Player',{value:'player'}));who.value=l.who;who.onchange=()=>l.who=who.value;const ta=el('textarea',null,{rows:'2',maxlength:'400','aria-label':stage+' line '+(i+1)});ta.value=l.text;ta.oninput=()=>l.text=ta.value;row.append(who,ta);btn('✕',()=>{d.dialogue[stage].splice(i,1);paint()},row);box.insertBefore(row,box.lastChild)})};box.append(el('span'));paint();btn('Add line',()=>{d.dialogue[stage].push({who:'npc',text:''});paint()},box)}
   // advanced
   const adv=el('details',null,{class:'console-subcard'});adv.append(el('summary','Advanced JSON (other quest fields)'));const extra=Object.fromEntries(Object.entries(d).filter(([k])=>!QUEST_KEYS.includes(k)));const json=el('textarea',null,{class:'console-json',rows:'4','aria-label':'Advanced quest JSON'});json.value=JSON.stringify(extra,null,1);adv.append(json);right.append(adv);
   const showErrors=errorsBox(right),preview=el('pre',null,{class:'console-preview-text'});preview.hidden=true;right.append(preview);
   const collect=()=>{let extraJson;try{extraJson=JSON.parse(json.value||'{}')}catch(e){throw Error('Advanced JSON: '+e.message)}const out={...extraJson};for(const k of QUEST_KEYS)if(d[k]!==undefined&&d[k]!=='')out[k]=d[k];for(const k of ['items','startItems','xp'])if(out[k]&&!Object.keys(out[k]).length)delete out[k];if(out.dialogue&&DIALOGUE_STAGES.every(s=>!out.dialogue[s]?.length))delete out.dialogue;const tidy=list=>(list||[]).map(o=>Object.fromEntries(Object.entries(o).filter(([,v])=>v!==undefined&&v!=='')));out.objectives=tidy(d.objectives);if(Array.isArray(out.stages))out.stages=out.stages.map(st=>({...st,objectives:tidy(st.objectives)}));return cleanV2(out)};
   const check=()=>{const q=collect(),vctx={npcs:new Set(npcs.map(x=>x.id)),actors:new Set(qs.actors.map(x=>x.id)),items:new Set(items.map(([k])=>k)),keys},staged=Array.isArray(q.stages)&&q.stages.length;
    const base=validateQuestDraft(staged?{...q,objectives:q.stages.find(s=>s.objectives?.length)?.objectives||[]}:q,vctx);
    const v2=validateV2Draft(q,{...vctx,objectiveErrors:list=>validateQuestDraft({...q,objectives:list},vctx).filter(m=>/^Objective|^Combine/.test(m))});
    return showErrors([...new Set([...base,...v2])])?q:null};
   const a=actions(right);a.classList.add('console-primary-actions');
   btn('Save quest',async()=>{const q=check();if(!q)return;const r=await invoke('fc_quest_save',{...(qs.selected?{id:qs.selected}:{}),data:q});const i=qs.rows.findIndex(x=>x.id===r.id);if(i<0)qs.rows.unshift(r);else qs.rows[i]=r;qs.selected=r.id;qs.draft=structuredClone(r.data);note('Quest saved (version '+r.version+'). Players who already accepted keep their objectives.');draw();editor()},a);
   btn('Validate & preview',()=>{const q=check();preview.hidden=!q;if(q)preview.textContent=questPreview(q,names())},a);
   const simBox=el('div',null,{class:'console-subcard console-simulator'});simBox.hidden=true;right.append(simBox);
   btn('▶ Simulate',()=>{const q=check();if(!q)return;simBox.hidden=false;questSimulator(simBox,q,{el,btn,names});simBox.scrollIntoView?.({block:'nearest'})},a);
   btn('Duplicate',()=>{const q=collect();qs.selected=null;qs.draft={...structuredClone(q),name:q.name+' (copy)',published:false,...(q.key?{key:q.key+'-copy'}:{})};editor()},a);
   if(qs.selected){const u=btn(d.published?'Unpublish':'Publish',async()=>{if(d.published){const r=await invoke('quest_archive',{id:qs.selected});qs.rows[qs.rows.findIndex(x=>x.id===r.id)]=r;qs.draft=structuredClone(r.data)}else{d.published=true;const q=check();if(!q){d.published=false;return}const r=await invoke('fc_quest_save',{id:qs.selected,data:q});qs.rows[qs.rows.findIndex(x=>x.id===r.id)]=r;qs.draft=structuredClone(r.data)}draw();editor()},a);if(d.published)u.classList.add('danger')}
  }
  draw();editor();void load();
 }

 // ---------------------------------------------------------------- Backup
 function Backup(){
  const box=el('div',null,{class:'console-columns'});W().append(box);
  const ex=section('Download a backup',box);ex.append(el('p','Everything an owner can edit: placed entities (including deleted ones), original NPC/monster stats, edited catalog items, quests, recipes and game settings.',{class:'console-muted'}));
  btn('Download world backup (JSON)',async()=>{const doc=await read('fc_backup_export');download('eldervale-backup-'+new Date().toISOString().slice(0,16).replace(/[:T]/g,'-')+'.json',doc);note('Backup downloaded: '+doc.entities.length+' entities.')},ex);
  const sv=section('Server snapshots',box),sf=el('form',null,{class:'console-inline'});sf.onsubmit=e=>e.preventDefault();sv.append(sf);const name=field(sf,'Snapshot name','bkName','Before '+new Date().toLocaleDateString());name.maxLength=60;
  btn('Save snapshot on server',async()=>{const r=await invoke('fc_backup_save',{name:name.value});note('Saved snapshot '+r.name+' ('+r.entities+' entities).');paintList()},sf);
  const list=el('div',null,{class:'console-list compact'});sv.append(list);
  const restore=async(payload,label)=>{const mirror=confirm('Restore '+label+'?\n\nOK = mirror (entities created since are marked deleted).\nCancel = choose merge instead.');if(!mirror&&!confirm('Merge '+label+' into the current world (nothing extra is marked deleted)?'))return;const r=await invoke('fc_backup_restore',{...payload,mode:mirror?'mirror':'merge'});note('Restored '+r.entities+' entities'+(r.markedDeleted?', marked '+r.markedDeleted+' deleted':'')+'. Undo snapshot: '+r.undo+'.');paintList()};
  async function paintList(){list.replaceChildren(el('p','Loading snapshots…',{class:'console-muted'}));try{const rows=await read('fc_backup_list');if(!active('Backup'))return;list.replaceChildren();for(const b of rows){const row=el('article',null,{class:'studio-log'});row.append(el('strong',b.name),el('small',new Date(b.createdAt).toLocaleString()+' · '+b.entities+' entities · '+b.actors+' actors · '+b.catalog+' items · '+b.quests+' quests'));btn('Restore…',()=>restore({name:b.name,parts:['entities','actors']},'snapshot '+b.name),actions(row));list.append(row)}if(!rows.length)list.append(el('p','No snapshots yet.',{class:'console-muted'}))}catch(e){list.replaceChildren(el('p','Snapshots unavailable: '+e.message,{class:'console-muted'}))}}
  void paintList();
  const up=section('Restore from a file',box),file=field(up,'Backup JSON','bkFile','','file');file.accept='.json,application/json';const info=el('p','',{class:'console-muted'});up.append(info);const parts=el('div',null,{class:'console-chips'});up.append(parts);const chosen=new Set(['entities']);
  for(const [k,l] of [['entities','Placed entities'],['actors','Original NPCs & monsters'],['catalog','Catalog edits'],['quests','Quests']]){const lab=el('label',null,{class:'console-check'}),c=el('input',null,{type:'checkbox'});c.checked=chosen.has(k);c.onchange=()=>c.checked?chosen.add(k):chosen.delete(k);lab.append(c,document.createTextNode(' '+l));parts.append(lab)}
  let doc=null;file.onchange=()=>ctx.run(async()=>{const f=file.files[0];if(!f)return;if(f.size>6e6)throw Error('Backups are limited to 6 MB');doc=JSON.parse(await f.text());const s=backupStats(doc);info.textContent=s.entities+' entities ('+s.deleted+' deleted), '+s.actors+' original actors, '+s.catalog+' catalog rows, '+s.quests+' quests.'});
  btn('Restore uploaded backup…',()=>{if(!doc)throw Error('Choose a backup file first');return restore({backup:doc,parts:[...chosen]},'the uploaded file')},up);
  up.append(el('p','Every restore first saves the current world as an "auto-before-restore" snapshot, so it can be undone.',{class:'console-muted'}));
 }

 // ---------------------------------------------------------------- Audit
 const au={query:'',action:'',target:'',rows:[],actions:[]};
 function Audit(){
  const bar=el('div',null,{class:'console-form-grid'});W().append(bar);
  const q=field(bar,'Search text in actions, targets and records','auQuery',au.query),act=field(bar,'Action','auAction',au.action,'text',[['','All actions'],...au.actions.map(a=>[a,a])]),tg=field(bar,'Target (player UUID, entity or item ID)','auTarget',au.target);
  const list=el('div');const a=actions(W());W().append(list);
  async function load(more=false){au.query=q.value.trim();au.action=act.value;au.target=tg.value.trim();const r=await read('fc_audit',{query:au.query,action:au.action,target:au.target,beforeId:more&&au.rows.length?String(au.rows.at(-1).id):'',limit:100});au.rows=more?[...au.rows,...r.rows]:r.rows;if(r.actions.length!==au.actions.length){au.actions=r.actions;const keep=act.value;act.replaceChildren(el('option','All actions',{value:''}),...au.actions.map(x=>el('option',x,{value:x})));act.value=keep}paint()}
  function paint(){list.replaceChildren();for(const r of au.rows){const det=el('details',null,{class:'studio-log'});det.append(el('summary',auditLine(r)),el('pre',JSON.stringify({actor:r.actor,before:r.before_data,after:r.after_data},null,2)));list.append(det)}if(!au.rows.length)list.append(el('p','No audit rows match.',{class:'console-muted'}))}
  btn('Search',()=>load(),a);btn('Load older',()=>load(true),a);btn('Export shown rows',()=>download('eldervale-audit.json',au.rows),a);
  q.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();ctx.run(()=>load())}};act.onchange=()=>ctx.run(()=>load());
  paint();void load().catch(e=>note(e.message,true));
 }
 return {Catalog,Economy,Quests,Backup,Audit};
}

// ---------------------------------------------------------------- Player inspector
// Rendered inside Players › detail. Loads fc_player_get and edits XP, gold, items, bank and
// equipment in place; every change is a separate audited server command.
export function playerInspector(ctx,parent,player){
 const {el,btn,field,invoke,note}=ctx;const uid=player.userId;
 const box=el('section',null,{class:'console-subcard console-inspector'});box.append(el('h4','Character inspector'));parent.append(box);
 const body=el('div');box.append(body);body.append(el('p','Loading character…',{class:'console-muted'}));
 const actions=p=>{const a=el('div',null,{class:'studio-actions'});p.append(a);return a};
 async function load(){let r;try{r=await ctx.rpc('world_admin',{command:'fc_player_get',payload:{userId:uid}})}catch(e){body.replaceChildren(el('p','Inspector unavailable: '+e.message,{class:'console-muted'}));return}if(!box.isConnected)return;paint(r)}
 const change=async(command,payload,msg)=>{await invoke(command,{userId:uid,...payload});if(msg)note(msg);await load()};
 function paint(r){body.replaceChildren();const s=r.save,skills=s.skills||{},stats=s.stats||{},inv=s.inventory&&typeof s.inventory==='object'&&!Array.isArray(s.inventory)?s.inventory:{},eq=s.equipment||{};
  body.append(el('p',[r.username?'@'+r.username:'',r.role,'combat '+r.combatLevel,r.position?(r.position.online?'online':'offline')+' at '+r.position.x+', '+r.position.z+(r.position.floor?' floor '+r.position.floor:''):'never entered the shared world'].filter(Boolean).join(' · '),{class:'console-muted'}));
  // gold
  const gf=el('form',null,{class:'console-inline'});gf.onsubmit=e=>e.preventDefault();body.append(gf);const gold=field(gf,'Gold','insGold',s.gold,'number');gold.min=0;gold.max=1e9;btn('Set gold',()=>change('fc_player_set_gold',{gold:Math.floor(Number(gold.value))},'Gold set.'),gf);
  // skills
  const sk=el('details',null,{class:'console-subcard'});sk.append(el('summary','Skills & XP'));body.append(sk);const grid=el('div',null,{class:'console-skill-grid'});sk.append(grid);
  for(const name of SKILLS){const key=xpKey(name),xp=Number((statsXpKey(key)?stats:skills)[key]??0),row=el('label',null,{class:'console-skill-row'});row.append(el('span',skillLabel(name)+' '+levelForXp(xp)));const n=el('input',null,{type:'number',min:'0',max:'200000000','aria-label':skillLabel(name)+' XP'});n.step='0.01';n.value=Math.round(xp*100)/100;row.append(n);btn('Set',()=>change('fc_player_set_xp',{skill:key,xp:Math.round(Number(n.value)*100)/100},skillLabel(name)+' XP set.'),row);grid.append(row)}
  // inventory
  const carried=Object.entries(stats).filter(([k,v])=>goods[k]&&!goods[k].field&&Number(v)>0).map(([k,v])=>[k,Number(v)]);
  for(const [id,g] of Object.entries(goods))if(g.field){const n=(inv[g.field]||[]).filter(k=>k===g.key).length;if(n)carried.push([id,n])}
  const iv=el('details',null,{class:'console-subcard'});iv.open=true;iv.append(el('summary','Inventory ('+carried.length+' kinds)'));body.append(iv);
  const itemRows=(parent,entries,bank)=>{for(const [id,n] of entries){const row=el('div',null,{class:'console-map-row'});row.append(el('span',itemName(id)+' × '+n.toLocaleString()));const a=actions(row);btn('−1',()=>change('fc_player_item',{item:id,amount:-1,bank},'Removed one '+itemName(id)+'.'),a);if(n>1)btn('Remove all',()=>change('fc_player_item',{item:id,amount:-n,bank},'Removed '+itemName(id)+'.'),a);parent.append(row)}if(!entries.length)parent.append(el('p','Empty.',{class:'console-muted'}))};
  itemRows(iv,carried,false);
  const bank=Object.entries(inv.bank||{}).filter(([,v])=>Number(v)>0).map(([k,v])=>[k,Number(v)]);const bk=el('details',null,{class:'console-subcard'});bk.append(el('summary','Bank ('+bank.length+' kinds)'));body.append(bk);itemRows(bk,bank,true);
  const add=el('form',null,{class:'console-inline'});add.onsubmit=e=>e.preventDefault();body.append(add);const item=field(add,'Add item','insItem','wood','text',originalItems().map(([k,g])=>[k,g.name])),amount=field(add,'Amount','insAmount',1,'number'),dest=field(add,'Into','insDest','inventory','text',[['inventory','Inventory'],['bank','Bank']]);btn('Add',()=>change('fc_player_item',{item:item.value,amount:Math.floor(Number(amount.value)),bank:dest.value==='bank'},'Added '+itemName(item.value)+'.'),add);
  // equipment
  const eqBox=el('details',null,{class:'console-subcard'});eqBox.append(el('summary','Equipment'));body.append(eqBox);
  for(const [slot,v] of Object.entries(eq)){if(v===false||v===null||v==='')continue;const row=el('div',null,{class:'console-map-row'});row.append(el('span',slot+': '+(v===true?'worn':v)));btn('Unequip',()=>change('fc_player_unequip',{slot},'Unequipped '+slot+'.'),actions(row));eqBox.append(row)}
  if(!Object.values(eq).some(v=>v&&v!==''))eqBox.append(el('p','Nothing equipped.',{class:'console-muted'}));
  // moderation extras
  const md=el('details',null,{class:'console-subcard danger-zone'});md.append(el('summary','Ban / mute with custom duration'));body.append(md);const mf=el('form',null,{class:'console-form-grid'});mf.onsubmit=e=>e.preventDefault();md.append(mf);
  const reason=field(mf,'Reason','insReason',''),mins=field(mf,'Minutes','insMinutes',60,'number'),preset=field(mf,'Preset','insPreset','','text',[['','Custom'],...MODERATION_PRESETS.map(([m,l])=>[m,l])]);preset.onchange=()=>{if(preset.value)mins.value=preset.value};
  const ma=actions(md);btn('Mute',()=>change('fc_moderate',{op:'mute',reason:reason.value,minutes:Math.floor(Number(mins.value))},'Muted.'),ma);const ban=btn('Ban for duration',()=>{if(!confirm('Ban '+player.name+'?'))return;return change('fc_moderate',{op:'ban',reason:reason.value,minutes:Math.floor(Number(mins.value))},'Banned.')},ma);ban.classList.add('danger');const perm=btn('Ban permanently',()=>{if(!confirm('Permanently ban '+player.name+'?'))return;return change('fc_moderate',{op:'ban',reason:reason.value,permanent:true},'Banned permanently.')},ma);perm.classList.add('danger');
  if(r.moderation)md.append(el('p','Current: '+(Date.parse(r.moderation.banned_until)>Date.now()?'banned until '+new Date(r.moderation.banned_until).toLocaleString():'not banned')+' · '+(Date.parse(r.moderation.muted_until)>Date.now()?'muted until '+new Date(r.moderation.muted_until).toLocaleString():'not muted')+(r.moderation.reason?' · '+r.moderation.reason:''),{class:'console-muted'}));
  // account
  const acct=el('details',null,{class:'console-subcard'});acct.append(el('summary','Account'));body.append(acct);
  btn('Send password reset email',async()=>{if(!ctx.auth?.resetPasswordForEmail)throw Error('Password reset is unavailable in this client');if(!confirm('Email a password reset link to '+player.name+'?'))return;const {email}=await invoke('fc_password_reset',{userId:uid});const {error}=await ctx.auth.resetPasswordForEmail(email,{redirectTo:location.origin+location.pathname});if(error)throw Error(error.message);note('Reset email sent to '+email.replace(/^(.).*(@.*)$/,'$1…$2')+'.')},actions(acct));
  acct.append(el('p','The link signs the player in; Eldervale has no in-game "choose a new password" screen yet.',{class:'console-muted'}));
  // audit trail
  const tr=el('details',null,{class:'console-subcard'});tr.append(el('summary','Audit trail ('+r.audit.length+')'));body.append(tr);for(const a of r.audit){const d=el('details',null,{class:'studio-log'});d.append(el('summary',auditLine({...a,target:''})),el('pre',JSON.stringify({before:a.before_data,after:a.after_data},null,2)));tr.append(d)}
  btn('Reload',()=>load(),actions(body));
 }
 void load();
}
