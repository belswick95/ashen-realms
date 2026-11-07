// Owner console › World › Exploration: the master switch and settings, and list / edit / add / enable
// / disable for every exploration definition — lore objects, places (hidden areas and new regions,
// with their entrance), crates, clue steps, reward tables, shortcuts and resources — plus a player's
// lore/place/clue progress (give clue items, reset a clue) and a casket roll preview.
// Reads and writes go through world_admin -> admin_action ('ex_*', owner-checked and audited:
// db/explore-4-console.sql). A saved row is marked "edited" and survives re-running the content SQL.
import {LORE_MODELS,STEP_TYPES,TIERS,EMOTES,ENTRANCE_MODELS,ITEMS,areaById} from './explore-data.js?v=release-20261107-skillguide136';

export const EXPLORE_KINDS=[['lore','Lore objects'],['place','Places'],['step','Clue steps'],['crate','Crates'],['reward','Rewards'],['shortcut','Shortcuts'],['resource','Resources']];
// One-line summary of a definition for the list.
export function defSummary(kind,d={}){
 if(kind==='lore')return (LORE_MODELS[d.model]||d.model)+' · '+(d.region||'')+(d.area?' · in '+d.area:'');
 if(kind==='place')return d.type+(d.area?' · area '+d.area:'')+(d.entrance?' · entrance '+(ENTRANCE_MODELS[d.entrance.model]||d.entrance.model)+' at '+d.entrance.x+', '+d.entrance.z+(d.entrance.requires?.agility?' · Agility '+d.entrance.requires.agility:'')+(d.entrance.requires?.lore?' · needs lore '+d.entrance.requires.lore:''):d.x!==undefined?' · '+d.x+', '+d.z+' r'+d.radius:'');
 if(kind==='step')return d.tier+' · '+(STEP_TYPES[d.type]||d.type)+(d.emote?' ('+(EMOTES[d.emote]||d.emote)+')':'')+(d.npcName?' · '+d.npcName:'')+(d.crate?' · crate '+d.crate:'')+' — '+String(d.text||'').slice(0,70);
 if(kind==='reward')return (d.rows||[]).length+' rows'+(d.rolls?' · '+d.rolls.join('–')+' rolls':'')+(d.rare?' · rare '+d.rare:'');
 if(kind==='shortcut')return d.template+' · Agility '+d.level+' · '+d.xp+' XP · in '+d.area;
 if(kind==='resource')return d.template+(d.resource?' ('+d.resource+')':'')+' · in '+d.area;
 if(kind==='crate')return (d.area?'in '+d.area+' · ':'')+d.x+', '+d.z;
 return '';
}
// World point of a definition (for "Go to"): area-local points use the area origin.
export function defPoint(d={}){const base=d.entrance||d;if(!Number.isFinite(base.x)){const a=d.area&&areaById(d.area);return a?{x:a.origin.x+2,z:a.origin.z}:null}if(d.area&&!d.entrance){const a=areaById(d.area);if(a)return {x:a.origin.x+base.x,z:a.origin.z+base.z}}return {x:base.x,z:base.z}}
// Template for a new definition placed at the owner's position.
export function newDef(kind,pos){const x=Math.round(pos.x*10)/10,z=Math.round(pos.z*10)/10;
 return {lore:{name:'New lore stone',model:'lore_tablet',region:'Eldervale',x,z,yaw:0,text:'Write the inscription here.'},
  crate:{name:'Weathered crate',x,z,yaw:0},
  step:{tier:'easy',type:'dig',x,z,text:'Write the riddle here.'},
  place:{name:'New landmark',type:'landmark',x,z,radius:20,blurb:''},
  reward:{rolls:[2,3],rare:'1/1000',rows:[{item:'gold',min:100,max:500,weight:10}]},
  shortcut:{area:'veilfall_grotto',template:'squeeze',name:'New shortcut',level:10,xp:10,fail:.2,failDamage:20,ticks:4,ends:[[0,0],[6,0]],x:0,z:0},
  resource:{area:'gullwing_isle',template:'rock',name:'Silver rocks',resource:'silverOre',x:20,z:0}}[kind]}

export function createExploreTab(ctx){
 const {el,btn,field,invoke,note}=ctx,W=()=>ctx.workspace;let data=null,err='',kind='lore',editing=null,player=null,rolls=null;
 const myPos=()=>ctx.bridge?.position?.()||{x:0,z:0};
 async function load(){try{data=await ctx.rpc('world_admin',{command:'ex_list',payload:{}});err=''}catch(e){data=null;err=e.message}}
 const card=(title,text)=>{const c=el('section',null,{class:'console-card'});c.append(el('h3',title));if(text)c.append(el('p',text,{class:'console-muted'}));return c};
 const acts=parent=>{const a=el('div',null,{class:'studio-actions'});parent.append(a);return a};
 const redraw=async()=>{await load();ctx.redraw()};
 const goTo=p=>p&&invoke('teleport',{x:Math.round(p.x*10)/10,z:Math.round(p.z*10)/10}).then(()=>note('Teleported.'));
 function editor(root,row){const c=card((row.isNew?'New ':'Edit ')+row.kind+' · '+row.id,'JSON definition. Lore/crate/step x/z are overworld (±420) unless "area" is set (then area-local, ±150). Saving marks the row edited: the content SQL will not overwrite it.');
  const id=field(c,'Id (lower-case, digits, _)','id',row.id);id.disabled=!row.isNew;
  const text=field(c,'Definition (JSON)','def',JSON.stringify(row.data,null,1),'textarea');text.rows=16;text.classList.add('console-code');
  const enabled=field(c,'Enabled','enabled',row.enabled!==false,'checkbox');const out=el('p');c.append(out);const a=acts(c);
  btn('Save',async()=>{let d;try{d=JSON.parse(text.value)}catch(e){out.textContent='JSON: '+e.message;return}const r=await invoke('ex_save',{kind:row.kind,id:id.value.trim(),data:d,enabled:enabled.checked});note('Saved '+row.kind+' '+id.value+' · '+(r?.objects??'?')+' objects synced.');editing=null;await redraw()},a);
  btn('Use my position',()=>{try{const d=JSON.parse(text.value),p=myPos(),t=d.entrance||d;if(d.area&&!d.entrance){const ar=areaById(d.area);t.x=Math.round((p.x-(ar?.origin.x||0))*10)/10;t.z=Math.round((p.z-(ar?.origin.z||0))*10)/10}else{t.x=Math.round(p.x*10)/10;t.z=Math.round(p.z*10)/10}text.value=JSON.stringify(d,null,1)}catch(e){out.textContent='JSON: '+e.message}},a);
  btn('Back',()=>{editing=null;ctx.redraw()},a);root.append(c)}
 function list(root){const rows=(data.defs||[]).filter(d=>d.kind===kind);const head=card(EXPLORE_KINDS.find(k=>k[0]===kind)[1]+' ('+rows.length+')');root.append(head);const a=acts(head);
  btn('Add at my position',()=>{editing={kind,id:'new_'+kind,data:newDef(kind,myPos()),enabled:true,isNew:true};ctx.redraw()},a);
  const t=el('table',null,{class:'console-table'}),tr=el('tr');for(const h of ['Id','Name','Details','Found by','State',''])tr.append(el('th',h));t.append(tr);
  for(const r of rows){const row=el('tr');row.append(el('td',r.id),el('td',r.data.name||r.data.npcName||'—'),el('td',defSummary(kind,r.data)),el('td',String(r.found||0)),el('td',(r.enabled?'on':'off')+(r.ownerEdited?' · edited':'')));const cell=el('td');
   btn('Edit',()=>{editing={...r};ctx.redraw()},cell);btn(r.enabled?'Disable':'Enable',async()=>{await invoke('ex_enable',{kind,id:r.id,enabled:!r.enabled});await redraw()},cell);
   const p=defPoint(r.data);if(p&&kind!=='reward')btn('Go to',()=>goTo(p),cell);if(r.ownerEdited)btn('Revert to file',async()=>{const x=await invoke('ex_revert',{kind,id:r.id});note(x?.note||'Reverted.');await redraw()},cell);
   if(kind==='reward')btn('Preview 20 caskets',async()=>{rolls=await ctx.rpc('world_admin',{command:'ex_roll',payload:{tier:r.id,count:20}});ctx.redraw()},cell);
   row.append(cell);t.append(row)}head.append(t);
  if(kind==='reward'&&rolls){const c=card('Preview: '+rolls.tier+' × '+rolls.rolls.length,'Server-side rolls, nothing granted.');const tally={};for(const r of rolls.rolls||[])for(const it of r)tally[it.item]=(tally[it.item]||0)+it.n;c.append(el('p',Object.entries(tally).sort((a,b)=>b[1]-a[1]).map(([k,v])=>(ITEMS[k]?.name||k)+' ×'+v).join(' · ')));root.append(c)}}
 function settings(root){const s=data.settings||{};const c=card('Settings','Master switch (off: every exploration object, hidden area and region closes; commands refuse; clue loot stops), clue chances by monster level, steps per tier, milestone lamps and titles.');
  const t=field(c,'Settings (JSON)','settings',JSON.stringify(s,null,1),'textarea');t.rows=18;t.classList.add('console-code');const a=acts(c);
  btn('Save settings',async()=>{let v;try{v=JSON.parse(t.value)}catch(e){note('JSON: '+e.message,true);return}await invoke('ex_settings',{value:v});note('Settings saved.');await redraw()},a);root.append(c)}
 function playerTools(root){const c=card('Player progress','Look up a character by name: lore read, places found, clue chains (steps and position), treasure log, titles; give clue items or caskets; reset a stuck clue.');
  const name=field(c,'Character name','name',player?.name||'');const a=acts(c);
  btn('Look up',async()=>{player=await ctx.rpc('world_admin',{command:'ex_player',payload:{name:name.value.trim()}});ctx.redraw()},a);
  if(player){const f=player.found||[];c.append(el('p','Lore '+f.filter(x=>x.kind==='lore').length+' · places '+f.filter(x=>x.kind==='place').length+' · completed clues '+JSON.stringify(player.stats?.clues||{})+' · titles '+((player.stats?.titles||[]).join(', ')||'—')+' · carried '+Object.entries(player.items||{}).filter(([,n])=>n).map(([k,n])=>k+'×'+n).join(', ')));
   for(const cl of player.clues||[]){const row=el('div');row.append(el('span',cl.tier+' · '+cl.status+' · step '+(cl.idx+1)+'/'+cl.steps.length+' · '+cl.steps.join(' → ')));if(cl.status==='active')btn('Reset',async()=>{await invoke('ex_clue_reset',{userId:player.userId,tier:cl.tier});note('Clue reset.');player=await ctx.rpc('world_admin',{command:'ex_player',payload:{userId:player.userId}});ctx.redraw()},row);c.append(row)}
   const g=acts(c);for(const t of TIERS)for(const it of [['clue',{easy:'clueEasy',medium:'clueMedium',hard:'clueHard'}[t]],['casket',{easy:'casketEasy',medium:'casketMedium',hard:'casketHard'}[t]]])btn('Give '+t+' '+it[0],async()=>{await invoke('ex_give',{userId:player.userId,item:it[1]});note('Given '+ITEMS[it[1]].name+'.')},g)}
  root.append(c)}
 function Exploration(){const root=W();root.replaceChildren(el('p','Loading…'));void load().then(()=>{if(ctx.tab()!=='Exploration')return;root.replaceChildren();
  if(!data){root.append(card('Exploration','Unavailable: '+err+' (apply db/explore-1..4.sql)'));return}
  const s=data.settings||{},head=card('Exploration '+(s.enabled?'· ON':'· OFF'),'Hidden areas, new regions, lore and treasure hunts. '+(data.activeClues||0)+' clue chains in progress · completed '+JSON.stringify(data.completed||{})+' · areas: '+(data.areas||[]).map(a=>a.name+(a.enabled?'':' (closed)')).join(', '));
  const a=acts(head);btn(s.enabled?'Turn exploration OFF':'Turn exploration ON',async()=>{await invoke('ex_settings',{value:{...s,enabled:!s.enabled}});await redraw()},a);btn('Re-sync objects',async()=>{const r=await invoke('ex_sync',{});note('Synced '+r.objects+' objects.');await redraw()},a);
  const nav=el('div',null,{class:'studio-actions'});for(const [k,label] of [...EXPLORE_KINDS,['settings','Settings'],['player','Player']]){const b=btn(label,()=>{kind=k;editing=null;rolls=null;ctx.redraw()},nav);b.setAttribute('aria-pressed',String(kind===k))}head.append(nav);root.append(head);
  if(editing)editor(root,editing);else if(kind==='settings')settings(root);else if(kind==='player')playerTools(root);else list(root)})}
 return {Exploration};
}
