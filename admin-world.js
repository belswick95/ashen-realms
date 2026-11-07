// Owner console › World: Underground (dungeon list + editor), Shortcuts (agility editor),
// Fishing (spot type, tier, movement) and Waters (water body list). Reads ug_list and writes
// ug_* commands through ctx.invoke -> world_admin, owner-checked and audited on the server
// (db/underground-3-console.sql). Dungeon edits are validated here first (validateDungeon) and
// again on the server, then re-synced: walls, passages and spawn groups update for everyone.
import {THEMES,LIGHT_KINDS,PASSAGE_TEMPLATES,validateDungeon,rasterize,passageObjects,toWorld,dungeons as defaultDungeons} from './underground-data.js?v=release-20261107-portrait145';
import {AGILITY_TEMPLATES,failChance} from './agility-data.js?v=release-20261107-portrait145';
import {SPOT_TYPES,SPOT_MOVE,extraLakes,extraRivers} from './water-data.js?v=release-20261107-portrait145';
import {fishingOptions} from './fish-tiers.js?v=release-20261107-portrait145';

// Names of the generated water ids (scripts/build-water-seed.mjs numbering).
export function waterName(id){if(id>=9001&&id<9010)return extraLakes[id-9001]?.name||'New lake';if(id>=9010&&id<9050){const k=Math.floor((id-9010)/10);return (extraRivers[k]?.name||'New river')+' · segment '+((id-9010)%10+1)}if(id>=9050)return 'Bridge (new water)';return 'Water body '+id}
// Spot-editor form -> ug_spot_save payload.
export function spotFormData(read){const d={};d.spotType=read.type&&SPOT_TYPES[read.type]?read.type:null;
 const pts=String(read.points||'').split(/[;\n]/).map(s=>s.split(',').map(Number)).filter(p=>p.length===2&&p.every(Number.isFinite)).slice(0,8);
 d.moves=pts.length?{points:pts.map(([x,z])=>[Math.round(x*10)/10,Math.round(z*10)/10]),minTicks:Math.max(10,Math.round(Number(read.minTicks)||SPOT_MOVE.minTicks)),maxTicks:Math.max(10,Math.round(Number(read.maxTicks)||SPOT_MOVE.maxTicks)),paused:!!read.paused}:null;
 if(d.moves&&d.moves.maxTicks<d.moves.minTicks)d.moves.maxTicks=d.moves.minTicks;if(read.name)d.name=String(read.name).trim().slice(0,60);return d}
export function shortcutFormData(read){return {template:read.template,name:String(read.name||'').trim().slice(0,60),level:Math.round(Number(read.level)||1),xp:Number(read.xp)||0,fail:Math.max(0,Math.min(1,Number(read.fail)||0)),failDamage:Math.round(Number(read.failDamage)||0),ticks:Math.round(Number(read.ticks)||4),margin:Math.round(Number(read.margin)||20),ends:[[Number(read.ax),Number(read.az)],[Number(read.bx),Number(read.bz)]]}}

export function createWorldTabs(ctx){
 const {el,btn,field,invoke,note}=ctx,W=()=>ctx.workspace;let data=null,selected=null,loadError='';
 async function load(){try{data=await ctx.rpc('world_admin',{command:'ug_list',payload:{}});loadError=''}catch(e){data=null;loadError=e.message;note('World tools unavailable: '+e.message+' (apply db/underground-*.sql and db/water-*.sql)',true)}}
 const goTo=(x,z)=>invoke('teleport',{x:Math.round(x*10)/10,z:Math.round(z*10)/10}).then(()=>note('Teleported.'));
 const myPos=()=>ctx.bridge?.position?.()||{x:0,z:0};
 const card=(title,text)=>{const c=el('section',null,{class:'console-card'});c.append(el('h3',title));if(text)c.append(el('p',text,{class:'console-muted'}));return c};
 const table=(head,rows)=>{const t=el('table',null,{class:'console-table'}),tr=el('tr');for(const h of head)tr.append(el('th',h));t.append(tr);for(const r of rows){const row=el('tr');for(const c of r)row.append(c instanceof Node?(()=>{const td=el('td');td.append(c);return td})():el('td',String(c)));t.append(row)}return t};
 const shell=(name,draw)=>()=>{const root=W();root.replaceChildren(el('p',data?'':'Loading…'));const paint=()=>{if(ctx.tab()!==name)return;W().replaceChildren();if(!data){W().append(card(name,loadError||'Loading…'));return}draw(W())};paint();void load().then(paint)};
 // A small top-down preview of every level (walkable tiles light, rock dark, lights, passages).
 function preview(def){const wrap=el('div',null,{class:'ug-preview'});for(const lv of def.levels||[]){let g;try{g=rasterize(def,lv.level)}catch{continue}const c=el('canvas',null,{width:String(g.w*3),height:String(g.h*3),title:'Level '+lv.level+' · '+(lv.name||''),'aria-label':'Level '+lv.level+' map'});const x=c.getContext?.('2d');
  if(x){const th=THEMES[def.theme]||THEMES.earth;x.fillStyle='#16120f';x.fillRect(0,0,c.width,c.height);x.fillStyle='#'+th.floorAlt.toString(16).padStart(6,'0');for(let k=0;k<g.mask.length;k++)if(g.mask[k])x.fillRect((k%g.w)*3,Math.floor(k/g.w)*3,3,3);
   const px=(wx,wz)=>[(Math.round(wx/1.58)-g.i0)*3+1.5,(Math.round(wz/1.58)-g.j0)*3+1.5];
   for(const l of def.lights||[])if(l.level===lv.level){const w=toWorld(def,lv.level,l.x,l.z),[a,b]=px(w.x,w.z);x.fillStyle='#ffb35a';x.fillRect(a-2,b-2,4,4)}
   for(const p of passageObjects(def)){const [a,b]=px(p.x,p.z);if(a<0||b<0||a>c.width||b>c.height)continue;x.fillStyle='#f2d36b';x.fillRect(a-3,b-3,6,6)}
   for(const s of def.spawns||[])if(s.level===lv.level){const r=lv.rooms.find(q=>q.id===s.room);if(!r)continue;const w=toWorld(def,lv.level,r.x,r.z),[a,b]=px(w.x,w.z);x.fillStyle='#e05a4a';x.font='9px sans-serif';x.fillText(s.roster+'×'+s.count,a-12,b)}}
  const fig=el('figure');fig.append(c,el('figcaption','Level '+lv.level+' · '+(lv.name||'')+' · '+g.walkable+' tiles'));wrap.append(fig)}return wrap}
 function areaEditor(root,row){const def=structuredClone(row?.data||{...structuredClone(defaultDungeons[0]),id:'new_area',name:'New cave',origin:{x:3600,z:1200},entrances:[{...defaultDungeons[0].entrances[0],id:'mouth',x:Math.round(myPos().x),z:Math.round(myPos().z)}],spawns:[],reserved:[]});
  const c=card((row?'Edit ':'New ')+(def.name||def.id),'Rooms are ellipses {id,x,z,rx,rz}; tunnels {width,points:[[x,z],…]}; entrances use overworld x/z, links/spawns/lights use the area’s local x/z. Origin x 1100–4200, z 1100–3200 (exploration areas: z 4250, see Exploration), 600 apart.');
  const text=field(c,'Definition (JSON)','def',JSON.stringify(def,null,1),'textarea');text.rows=22;text.classList.add('console-code');
  const enabled=field(c,'Enabled (entrances open, monsters spawned)','enabled',row?row.enabled:true,'checkbox');
  const out=el('div');c.append(out);
  const parse=()=>{try{return JSON.parse(text.value)}catch(e){out.replaceChildren(el('p','JSON: '+e.message,{class:'console-error'}));return null}};
  const check=()=>{const d=parse();if(!d)return null;const errors=validateDungeon(d,{others:(data?.areas||[]).map(a=>a.data),roster:new Set(data?.roster||[])});out.replaceChildren(errors.length?el('ul',null,{class:'console-error'}):el('p','Looks good: '+(d.levels||[]).length+' level(s), '+(d.spawns||[]).reduce((t,s)=>t+s.count,0)+' monsters, '+(d.lights||[]).length+' lights.'));for(const e of errors)out.firstChild.append(el('li',e));out.append(preview(d));return errors.length?null:d};
  const acts=el('div',null,{class:'studio-actions'});c.append(acts);
  btn('Check & preview',check,acts);
  btn('Save & sync',async()=>{const d=check();if(!d)return;const r=await invoke('ug_save',{data:d,enabled:enabled.checked});note('Saved '+d.id+': '+r.tiles+' walkable tiles, '+r.passages+' passages, '+r.monsters+' monsters'+(r.missingSpawns?.length?' — missing roster: '+r.missingSpawns.join(', '):'')+'.');window.eldervaleUnderground?.setAreas([...(data.areas||[]).filter(a=>a.id!==d.id).map(a=>a.data),d]);selected=null;await load();ctx.redraw()},acts);
  btn('Back',()=>{selected=null;ctx.redraw()},acts);root.append(c);check()}
 const Underground=shell('Underground',root=>{
  if(selected!==null){areaEditor(root,data.areas.find(a=>a.id===selected));return}
  const head=card('Underground areas','Caves, crypts and mines. Each lives far from the overworld (its own layer): players there only see actors on that level. Disable closes the entrances and removes the monsters but keeps the walls.');
  const acts=el('div',null,{class:'studio-actions'});head.append(acts);btn('New area',()=>{selected='';areaEditor(W(),null)},acts);btn('Re-sync all',async()=>{const r=await invoke('ug_sync',{});note('Re-synced '+r.synced+' areas.');await load();ctx.redraw()},acts);btn('Reload',async()=>{await load();ctx.redraw()},acts);root.append(head);
  for(const a of data.areas){const d=a.data,c=card(d.name+(a.enabled?'':' (disabled)'),(THEMES[d.theme]?.label||d.theme)+' · levels '+(d.band||[]).join('–')+' · '+a.levels.filter(l=>l.live).map(l=>'L'+l.level+' '+l.walkable+' tiles').join(', ')+' · '+a.passages+' passages · '+a.monsters+' monsters · '+a.players+' players inside'+(a.edited?' · edited in console':''));
   c.append(table(['Entrance','Kind','Overworld x, z','Arrives'],(d.entrances||[]).map(e=>[e.name||e.id,PASSAGE_TEMPLATES[e.kind]||e.kind,e.x+', '+e.z,'L'+e.to.level+' ('+e.to.x+', '+e.to.z+')'])));
   c.append(table(['Spawn group','Monster','Count','Level / room'],(d.spawns||[]).map(s=>[s.id,s.roster,s.count,'L'+s.level+' · '+s.room])));
   c.append(el('p',(d.lights||[]).length+' lights ('+[...new Set((d.lights||[]).map(l=>l.kind))].join(', ')+') · '+(d.levels||[]).reduce((t,l)=>t+l.rooms.length,0)+' rooms · '+(d.links||[]).length+' ladders/stairs'+((d.reserved||[]).length?' · reserved: '+d.reserved.map(r=>r.room+' ('+r.note+')').join('; '):''),{class:'console-muted'}));
   const acts2=el('div',null,{class:'studio-actions'});c.append(acts2);
   btn('Edit',()=>{selected=a.id;ctx.redraw()},acts2);
   btn(a.enabled?'Disable':'Enable',async()=>{await invoke('ug_enable',{id:a.id,enabled:!a.enabled});await load();ctx.redraw()},acts2);
   btn('Re-sync',async()=>{await invoke('ug_sync',{id:a.id});note('Re-synced '+d.name);await load();ctx.redraw()},acts2);
   const e0=(d.entrances||[])[0];if(e0){btn('Go to entrance',()=>goTo(e0.x+2,e0.z+2),acts2);const w=toWorld(d,e0.to.level,e0.to.x,e0.to.z);btn('Go inside',()=>goTo(w.x,w.z),acts2)}
   root.append(c)}
 });
 function shortcutEditor(root,row){const s=row?.data||{template:'log_balance',name:'New shortcut',agility:{level:10,xp:10,fail:.2,failDamage:30,ticks:4,margin:20,ends:[[myPos().x-4,myPos().z],[myPos().x+4,myPos().z]]}};const a=s.agility;
  const c=card(row?'Edit '+s.name:'New shortcut','Both ends must be walkable ground; the crossing between them can be water, rock or a wall.');
  const f={template:field(c,'Kind','template',s.template,'text',Object.entries(AGILITY_TEMPLATES)),name:field(c,'Name','name',s.name),level:field(c,'Agility level','level',a.level,'number'),xp:field(c,'XP','xp',a.xp,'number'),fail:field(c,'Fail chance at the level (0–1)','fail',a.fail,'number'),failDamage:field(c,'Fail damage (HP, 10× scale)','failDamage',a.failDamage,'number'),ticks:field(c,'Crossing time (ticks)','ticks',a.ticks,'number'),margin:field(c,'Safe this many levels above','margin',a.margin??20,'number'),
   ax:field(c,'End A x','ax',a.ends[0][0],'number'),az:field(c,'End A z','az',a.ends[0][1],'number'),bx:field(c,'End B x','bx',a.ends[1][0],'number'),bz:field(c,'End B z','bz',a.ends[1][1],'number')};
  f.fail.step='0.05';for(const k of ['ax','az','bx','bz'])f[k].step='0.1';
  const read=()=>shortcutFormData(Object.fromEntries(Object.entries(f).map(([k,i])=>[k,i.value])));const acts=el('div',null,{class:'studio-actions'});c.append(acts);
  btn('End A = my position',()=>{const p=myPos();f.ax.value=p.x.toFixed(1);f.az.value=p.z.toFixed(1)},acts);btn('End B = my position',()=>{const p=myPos();f.bx.value=p.x.toFixed(1);f.bz.value=p.z.toFixed(1)},acts);
  btn('Save shortcut',async()=>{const r=await invoke('ug_shortcut_save',{id:row?.id||null,data:read()});note('Saved '+r.data.name+'.');selected=null;await load();ctx.redraw()},acts);btn('Back',()=>{selected=null;ctx.redraw()},acts);root.append(c)}
 const Shortcuts=shell('Shortcuts',root=>{
  if(selected!==null){shortcutEditor(root,data.shortcuts.find(s=>s.id===selected));return}
  const head=card('Agility shortcuts','Log balances, rope swings, wall climbs, stepping stones and crevices. Success: OSRS-style, risky ones slip less as Agility rises, never once you are the safe margin above the level.');
  const acts=el('div',null,{class:'studio-actions'});head.append(acts);btn('New shortcut here',()=>{selected='';shortcutEditor(W(),null)},acts);root.append(head);
  root.append(table(['Shortcut','Kind','Agility','XP','Slip at level','Position',''],data.shortcuts.map(s=>{const a=s.data.agility||{},b=el('div');btn('Edit',()=>{selected=s.id;ctx.redraw()},b);btn(s.deleted?'Enable':'Disable',async()=>{await invoke('ug_shortcut_enable',{id:s.id,enabled:s.deleted});await load();ctx.redraw()},b);btn('Go',()=>goTo(a.ends?.[0]?.[0]??s.data.x,a.ends?.[0]?.[1]??s.data.z),b);
   return [(s.deleted?'○ ':'')+s.data.name,AGILITY_TEMPLATES[s.data.template]||s.data.template,a.level,a.xp,Math.round(failChance(a.level,a.level,a.fail,a.margin)*100)+'%',Math.round(s.data.x)+', '+Math.round(s.data.z),b]})));
 });
 function spotEditor(root,row){const s=row?.data||{name:'New fishing spot',x:Math.round(myPos().x*10)/10,z:Math.round(myPos().z*10)/10};const mv=s.moves||{points:[[s.x,s.z]],minTicks:SPOT_MOVE.minTicks,maxTicks:SPOT_MOVE.maxTicks};
  const c=card(row?'Edit '+s.name:'New fishing spot','Type sets the methods and fish (tiers); a spot with no type keeps the original four methods. Positions: one x,z per line; the spot moves among them every min–max ticks (600 ms).');
  const f={name:field(c,'Name','name',s.name),type:field(c,'Type','type',s.spotType||'','text',[['','Original (net, bait, cage, harpoon)'],...Object.entries(SPOT_TYPES).map(([k,t])=>[k,t.label])]),points:field(c,'Positions (x,z per line)','points',(mv.points||[]).map(p=>p.join(', ')).join('\n'),'textarea'),minTicks:field(c,'Move after at least (ticks)','minTicks',mv.minTicks,'number'),maxTicks:field(c,'…and at most (ticks)','maxTicks',mv.maxTicks,'number'),paused:field(c,'Stay put (paused)','paused',!!mv.paused,'checkbox')};
  const info=el('p',null,{class:'console-muted'});const tiers=()=>{info.textContent='Catches: '+fishingOptions({spotType:f.type.value||undefined},{level:99}).map(o=>o.label).join(' · ')};f.type.onchange=tiers;tiers();c.append(info);
  const acts=el('div',null,{class:'studio-actions'});c.append(acts);
  btn('Add my position',()=>{const p=myPos();f.points.value=(f.points.value.trim()?f.points.value.trim()+'\n':'')+p.x.toFixed(1)+', '+p.z.toFixed(1)},acts);
  btn('Save spot',async()=>{const d=spotFormData({name:f.name.value,type:f.type.value,points:f.points.value,minTicks:f.minTicks.value,maxTicks:f.maxTicks.value,paused:f.paused.checked});if(!row){const p=d.moves?.points?.[0]||[s.x,s.z];d.x=p[0];d.z=p[1]}await invoke('ug_spot_save',{id:row?.id||null,data:d});note('Spot saved.');selected=null;await load();ctx.redraw()},acts);
  if(row)btn('Move now',async()=>{const r=await invoke('ug_spot_move',{id:row.id});note(r.moved?'The spot moved.':'Scheduled.')},acts);btn('Back',()=>{selected=null;ctx.redraw()},acts);root.append(c)}
 const Fishing=shell('Fishing',root=>{
  if(selected!==null){spotEditor(root,data.spots.find(s=>s.id===selected));return}
  const head=card('Fishing spots','Every spot in the world. Types give each tier its place: shore (net/bait), river (lure/bait), cage/harpoon, big net/harpoon, deep (bait/harpoon).');
  const acts=el('div',null,{class:'studio-actions'});head.append(acts);btn('New spot here',()=>{selected='';spotEditor(W(),null)},acts);root.append(head);
  root.append(table(['Spot','Type','Positions','Moves every','Position',''],data.spots.map(s=>{const d=s.data,b=el('div');btn('Edit',()=>{selected=s.id;ctx.redraw()},b);btn(s.deleted?'Enable':'Disable',async()=>{await invoke('ug_spot_enable',{id:s.id,enabled:s.deleted});await load();ctx.redraw()},b);btn('Go',()=>goTo(d.x+2,d.z+2),b);
   return [(s.deleted?'○ ':'')+d.name+(d.ownerEdited?' ✎':''),SPOT_TYPES[d.spotType]?.label||'Original',d.moves?.points?.length||1,d.moves?(d.moves.paused?'paused':d.moves.minTicks+'–'+d.moves.maxTicks+' ticks'):'—',Math.round(d.x)+', '+Math.round(d.z),b]})));
 });
 const Waters=shell('Waters',root=>{
  root.append(card('Water bodies','Collision outlines of lakes, rivers, the bay and bridges (passable). Making a body passable lets people walk over it (the tile grid refreshes on the next check); the drawn water does not change.'));
  root.append(table(['Id','Name','Points','Box (x0, z0 → x1, z1)','Walkable',''],data.waters.map(w=>{const b=el('div');btn(w.passable?'Make solid':'Make passable',async()=>{await invoke('ug_water_set',{id:w.id,passable:!w.passable});await load();ctx.redraw()},b);btn('Go',()=>goTo((w.box[0]+w.box[2])/2,(w.box[1]+w.box[3])/2),b);
   return [w.id,waterName(w.id),w.points,w.box.join(', '),w.passable?'yes (bridge/ford)':'no',b]})));
 });
 return {Underground,Shortcuts,Fishing,Waters};
}
