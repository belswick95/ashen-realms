// Game console → World → Combat & mechanics (db/mechanics-ii-*.sql): the master switch, every
// tunable constant (run energy, combat timers, prayer, special energy, poison, regen, food, ammo,
// aggression/tolerance/leash, loot tables), and editors for the rule table: prayers, special attacks
// per weapon, poison sources, per-monster aggression, single/multi combat zones, shared loot tables,
// per-monster loot tables v2 and item weights/food classes. Writes go through console_mech_* commands
// (owner-checked and audited on the server).
import {DEFAULTS,effectiveRates} from './mechanics.js?v=release-20261106-boss107';

export const RULE_KINDS=[
 ['prayer','Prayers','id = prayer key',{name:'New prayer',level:1,drain:1,groups:['attack'],effect:{att:1.05},icon:'✨',text:'+5% Attack.'}],
 ['special','Special attacks','id = weapon key (e.g. eldersteelDagger)',{name:'New special',cost:50,accMult:1.2,dmgMult:1.2,hits:1,text:'A stronger strike.'}],
 ['poison','Poison sources','id = monster id, rosterKey, species:<name>, type:<attackType>, or weapon:<key>',{severity:6,chance:.25}],
 ['aggro','Aggression & leash','id = monster id, rosterKey, species:<name>, type:<attackType>, boss or *',{aggroMode:'level',huntRange:4,maxRange:7,toleranceTicks:1000}],
 ['zone','Combat zones','a rectangle in world units; multi true = multi-combat',{x1:0,z1:0,x2:40,z2:40,floor:0,multi:true,name:'New zone'}],
 ['droptable','Shared loot tables','rows: {weight, item, min, max} or {weight, table}',{name:'New table',denom:128,rows:[{weight:8,item:'uncutGem',min:1,max:1}]}],
 ['drops','Monster loot tables v2','id = rosterKey or monster id',{always:[{item:'bones',min:1,max:1}],main:{denom:128,rows:[{weight:32,item:'thread',min:1,max:3},{weight:1,table:'rare'}]},tertiary:[]}],
 ['item','Item weights & food','id = item key (or weapon:/armor:/shield: key)',{weight:1,foodClass:'normal'}]
];
const SECTION_LABELS={run:'Run energy',combat:'Combat timers',prayer:'Prayer',spec:'Special attack energy',poison:'Poison & venom',regen:'Hitpoint regeneration',food:'Eating & drinking (ticks)',ammo:'Ammunition',aggro:'Aggression, tolerance & leash',drops:'Loot tables'};

export const adminMechanicsRows=(rules=[],kind)=>rules.filter(r=>r.kind===kind).sort((a,b)=>(a.sort||0)-(b.sort||0)||String(a.id).localeCompare(b.id));
// Flat form values {'run.drain_base':'45', enabled:true} → the console_mech_set config patch.
export function mechanicsSettingsPatch(values){
 const out={};
 for(const [key,raw] of Object.entries(values)){
  if(key==='enabled'){out.enabled=raw===true;continue}
  const [section,k]=key.split('.');if(!(section in DEFAULTS)||!(k in DEFAULTS[section]))throw Error('Unknown setting '+key);
  let v=raw;if(typeof DEFAULTS[section][k]==='boolean')v=raw===true;else{v=Number(raw);if(!Number.isFinite(v)||v<0||v>100000)throw Error('Choose a number from 0 to 100000 for '+key)}
  (out[section]||=({}))[k]=v;
 }
 return out;
}
export function validateDropTable(t={}){
 const errors=[],denom=Number(t.denom)||128,rows=Array.isArray(t.rows)?t.rows:[];let sum=0;
 rows.forEach((r,i)=>{const w=Number(r.weight);if(!Number.isInteger(w)||w<0)errors.push('Row '+(i+1)+' needs a whole weight of 0 or more.');else sum+=w;if(!r.item&&!r.table)errors.push('Row '+(i+1)+' needs an item or a table.')});
 if(sum>denom)errors.push('Row weights add up to '+sum+', more than the denominator '+denom+'.');
 return errors;
}
export function ruleDraft(kind,id,json){
 let data;try{data=JSON.parse(json)}catch{throw Error('The rule must be valid JSON')}
 if(!data||typeof data!=='object'||Array.isArray(data))throw Error('The rule must be a JSON object');
 if(!String(id||'').trim())throw Error('Give the rule an id');
 const t=kind==='droptable'?data:kind==='drops'?data.main:null;if(t){const e=validateDropTable(t);if(e.length)throw Error(e[0])}
 return {kind,id:String(id).trim(),data};
}
const oneIn=p=>p>0?'1/'+(Math.round(10/p)/10):'—';

export function mechanicsSection({section,el,btn,field,invoke,note,parent,pos=()=>({x:0,z:0})}){
 const s=section('Combat & mechanics',parent),status=el('p','Loading combat & mechanics…',{class:'console-muted'});s.append(status);
 const body=el('div');s.append(body);let state=null,kind='prayer';
 async function load(){
  try{state=await invoke('console_mech',{})}catch(e){status.textContent=/unknown (console )?command/i.test(e.message)?'Combat & mechanics II is not installed on this server yet (db/mechanics-ii-*.sql).':e.message;body.replaceChildren();return}
  const st=state.state||{};status.textContent=(state.config.enabled?'ON: independent attack timers, prayer, specials, poison, aggression rules and loot tables v2 are live.':'OFF: the previous combat, energy and aggression code runs.')+' · '+state.players+' players tracked'+(st.faults?' · '+st.faults+' faults (last: '+st.lastFault+')':'');
  draw();
 }
 function draw(){
  body.replaceChildren();const c=state.config;
  const sw=el('form');sw.onsubmit=e=>e.preventDefault();body.append(sw);
  btn(c.enabled?'Switch mechanics II off':'Switch mechanics II on',async()=>{await invoke('console_mech_set',{config:{enabled:!c.enabled}});note('Mechanics II '+(c.enabled?'off':'on')+'.');await load()},sw);
  // Settings, one collapsible group per section.
  for(const [sec,label] of Object.entries(SECTION_LABELS)){
   const d=el('details'),sum=el('summary',label);d.append(sum);body.append(d);const f=el('form',null,{class:'console-form-grid'});f.onsubmit=e=>e.preventDefault();d.append(f);const inputs={};
   for(const [k,def] of Object.entries(DEFAULTS[sec])){const v=c[sec]?.[k]??def;const i=typeof def==='boolean'?field(f,k.replace(/_/g,' '),'mech_'+sec+'_'+k,v,'checkbox'):field(f,k.replace(/_/g,' ')+' (default '+def+')','mech_'+sec+'_'+k,v,'number');if(i.type==='number')i.step='any';inputs[sec+'.'+k]=i}
   btn('Save '+label.toLowerCase(),async()=>{const values={};for(const [k,i] of Object.entries(inputs))values[k]=i.type==='checkbox'?i.checked:i.value;await invoke('console_mech_set',{config:mechanicsSettingsPatch(values)});note(label+' saved.');await load()},f);
   btn('Reset to defaults',async()=>{await invoke('console_mech_reset',{section:sec});note(label+' reset.');await load()},f);
  }
  // Rule editor.
  const rd=el('details');rd.open=true;rd.append(el('summary','Rules: prayers, specials, poison, aggression, zones, loot tables, items'));body.append(rd);
  const pick=field(rd,'Rule kind','mech_kind',kind,'text',RULE_KINDS.map(([k,l])=>[k,l]));pick.onchange=()=>{kind=pick.value;draw()};
  const info=RULE_KINDS.find(r=>r[0]===kind);rd.append(el('p',info[2],{class:'console-muted'}));
  const list=el('ul',null,{class:'console-list'});rd.append(list);
  const form=el('form');form.onsubmit=e=>e.preventDefault();rd.append(form);
  const idIn=field(form,'Rule id','mech_rule_id','');const json=field(form,'Rule data (JSON)','mech_rule_json',JSON.stringify(info[3],null,1),'textarea');json.rows=8;
  for(const r of adminMechanicsRows(state.rules,kind)){
   const li=el('li');const name=r.data?.name||r.id;li.append(el('strong',name+(r.enabled?'':' (off)')),document.createTextNode(' '+r.id+' '));
   if(kind==='droptable'){const rates=effectiveRates({main:r.data},Object.fromEntries(adminMechanicsRows(state.rules,'droptable').map(t=>[t.id,t.data])));li.append(el('small',rates.map(x=>x.item+' '+oneIn(x.p)).join(', ')))}
   btn('Edit',()=>{idIn.value=r.id;json.value=JSON.stringify(r.data,null,1)},li);
   btn(r.enabled?'Switch off':'Switch on',async()=>{await invoke('console_mech_rule_enable',{kind,id:r.id,enabled:!r.enabled});await load()},li);
   list.append(li);
  }
  btn('Save rule',async()=>{const d=ruleDraft(kind,idIn.value,json.value);await invoke('console_mech_rule_set',d);note('Saved '+kind+' '+d.id+'.');await load()},form);
  if(kind==='zone')btn('New zone around me (30 m square)',()=>{const p=pos();idIn.value='zone-'+Math.round(p.x)+'-'+Math.round(p.z);json.value=JSON.stringify({name:'Multi-combat zone',x1:Math.round(p.x-15),z1:Math.round(p.z-15),x2:Math.round(p.x+15),z2:Math.round(p.z+15),floor:0,multi:true},null,1)},form);
  monsters();players();
 }
 // Monster browser: effective aggression / leash / tolerance / poison and loot tables v2.
 function monsters(){
  const d=el('details');d.append(el('summary','Monsters: aggression, leash, poison and loot (v2)'));body.append(d);
  const f=el('form',null,{class:'console-inline'});f.onsubmit=e=>e.preventDefault();d.append(f);const q=field(f,'Search','mech_mq','');const out=el('div');d.append(out);
  btn('Find',async()=>{const r=await invoke('console_mech_monsters',{q:q.value});out.replaceChildren();
   for(const m of (r.monsters||[]).slice(0,80)){const card=el('div',null,{class:'console-subcard'}),mm=m.mech||{};
    card.append(el('strong',m.name+' (level '+m.level+', ×'+m.count+')'),el('p',[mm.aggroMode,'hunt '+mm.huntRange,'max range '+mm.maxRange,'tolerance '+(mm.toleranceTicks??'never'),'attack every '+mm.attackTicks+' ticks','reach '+mm.attackRange,mm.poison?'poison '+JSON.stringify(mm.poison):'no poison'].join(' · '),{class:'console-muted'}));
    const rates=effectiveRates(m.drops||{},Object.fromEntries(adminMechanicsRows(state.rules,'droptable').map(t=>[t.id,t.data])));
    card.append(el('p','Loot'+(m.hasDropsRule?' (v2 table)':' (migrated from the old rows)')+': always '+((m.drops?.always||[]).map(a=>a.item).join(', ')||'—')+' · '+rates.map(x=>x.item+' '+oneIn(x.p)).join(', '),{class:'console-muted'}));
    const a=el('div',null,{class:'studio-actions'});card.append(a);
    btn('Edit aggression',()=>{kind='aggro';draw();const i=document.querySelector('[name=mech_rule_id]'),j=document.querySelector('[name=mech_rule_json]');if(i)i.value=m.key;if(j)j.value=JSON.stringify({aggroMode:mm.aggroMode,huntRange:mm.huntRange,maxRange:mm.maxRange,toleranceTicks:mm.toleranceTicks,respawnTicks:mm.respawnTicks??null},null,1)},a);
    btn('Edit poison',()=>{kind='poison';draw();const i=document.querySelector('[name=mech_rule_id]'),j=document.querySelector('[name=mech_rule_json]');if(i)i.value=m.key;if(j)j.value=JSON.stringify(mm.poison||{severity:6,chance:.25},null,1)},a);
    btn(m.hasDropsRule?'Edit loot table':'Convert loot to v2',async()=>{const r2=m.hasDropsRule?{id:m.key,drops:m.drops}:await invoke('console_mech_drops_convert',{actor:m.id});kind='drops';await load();const i=document.querySelector('[name=mech_rule_id]'),j=document.querySelector('[name=mech_rule_json]');if(i)i.value=r2.id;if(j)j.value=JSON.stringify(r2.drops,null,1)},a);
    btn('Simulate 10 000 kills',async()=>{const r3=await invoke('console_mech_drops_test',{actor:m.id,kills:10000});note(m.name+' main table over '+r3.kills+' kills: '+Object.entries(r3.main).sort((x,y)=>y[1]-x[1]).map(([k,v])=>k+' '+v).join(', '))},a);
    out.append(card)}
  },f);
 }
 function players(){
  const d=el('details');d.append(el('summary','Player mechanics (restore, cure, inspect)'));body.append(d);
  const f=el('form',null,{class:'console-inline'});f.onsubmit=e=>e.preventDefault();d.append(f);const uid=field(f,'Player user id','mech_uid','');const out=el('pre',null,{class:'console-muted'});d.append(out);
  btn('Inspect',async()=>{const r=await invoke('console_mech_player',{userId:uid.value.trim()});out.textContent=JSON.stringify(r,null,1)},f);
  btn('Restore prayer, special, energy; cure',async()=>{await invoke('console_mech_player_set',{userId:uid.value.trim(),prayer:true,spec:true,energy:true,cure:true});note('Restored.')},f);
  btn('Reset aggression tolerance',async()=>{await invoke('console_mech_player_set',{userId:uid.value.trim(),tolerance:true});note('Tolerance reset.')},f);
 }
 void load();
 return {reload:load};
}
