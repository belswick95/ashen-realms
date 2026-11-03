import {itemIcons} from './item-icons.js?v=release-20261103-world12';
import {worldTemplates,entityDefaults,attackTypes,validateEntity} from './world-templates.js?v=release-20261103-world12';
import {goods} from './economy.js?v=release-20261103-world12';
const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!==null)n.textContent=text;for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n};
export function createAdminPanel({userId,rpc,action,refresh,snapshot,bridge}){
 const css=document.createElement('link');css.rel='stylesheet';css.href='./admin.css?v=release-20261103-world12';document.head.append(css);
 const button=el('button','♛ World studio',{id:'owner-studio-toggle',type:'button'}),panel=el('dialog',null,{id:'owner-studio'});document.body.append(button,panel);
 panel.innerHTML='<header><div><small>ELDERVALE · OWNER ACCESS</small><h2>World studio</h2></div><button type="button" data-close aria-label="Close studio">×</button></header><nav aria-label="Owner tools"></nav><div class="studio-workspace"></div><footer role="status">Changes are saved to the server and audited.</footer>';
 const owner=snapshot.owner;let tab=owner?'World':'Players',rows=new Map(),selected=null,placing=false,selecting=false,busy=false,overview=null,current=snapshot,formData=null;
 const workspace=panel.querySelector('.studio-workspace'),status=panel.querySelector('footer');
 function note(text,error=false){status.textContent=text;status.classList.toggle('error',error)}
 async function invoke(command,payload={}){if(busy)throw Error('Wait for the current command');busy=true;note('Saving '+command+'…');try{const r=await action(command,payload);note('Saved '+command+' to the server.');return r}catch(e){note(e.message,true);throw e}finally{busy=false}}
 const run=(fn)=>void Promise.resolve().then(fn).catch(e=>note(e.message,true));
 const btn=(label,fn,parent=workspace)=>{const b=el('button',label,{type:'button'});b.onclick=()=>run(fn);parent.append(b);return b};
 const field=(parent,label,key,value,type='text',options=null)=>{const wrap=el('label',label);let input;if(options){input=el('select',null,{name:key});for(const [v,t] of options)input.append(el('option',t,{value:v}));input.value=value}else{input=el(type==='textarea'?'textarea':'input',null,{name:key});if(type!=='textarea')input.type=type;if(type==='checkbox')input.checked=!!value;else input.value=value??''}wrap.append(input);parent.append(wrap);return input};
 function draw(){workspace.replaceChildren();for(const n of panel.querySelectorAll('nav button'))n.setAttribute('aria-selected',String(n.textContent===tab));if(tab==='World')world();else if(tab==='Actors')void actors();else if(tab==='Items')items();else if(tab==='Server')server();else if(tab==='Players')void players();else if(tab==='Audit')void audit();else consoleView()}
 for(const name of (owner?['World','Actors','Items','Server','Players','Audit','Terminal']:['Players','Terminal']))btn(name,()=>{tab=name;draw();workspace.scrollTop=0},panel.querySelector('nav'));
 function open(){if(!current.owner&&current.staffRole!=='moderator')return;if(!panel.open)panel.showModal();draw();void refresh()}
 if(!owner){button.textContent='♜ Moderation';panel.querySelector('small').textContent='ELDERVALE · MODERATOR ACCESS';panel.querySelector('h2').textContent='Moderation center'}
 button.onclick=open;panel.querySelector('[data-close]').onclick=()=>panel.close();
 addEventListener('keydown',e=>{if(e.key==='F8'){e.preventDefault();panel.open?panel.close():open()}if(e.key==='Escape'){placing=false;selecting=false;document.body.classList.remove('studio-placing');document.querySelector('#studio-placement')?.remove()}});
 function beginPlacement(select=false){placing=!select;selecting=select;panel.close();document.body.classList.add('studio-placing');document.querySelector('#studio-placement')?.remove();const prompt=el('div',select?'Click a saved entity to select it. Escape cancels.':'Click terrain to place the selected template. Escape cancels.',{id:'studio-placement'});document.body.append(prompt)}
 window.eldervaleBuilderClick=({point,entityId,button:mouseButton})=>{if(!placing&&!selecting)return false;if(mouseButton!==0)return true;if(selecting){if(!entityId){bridge.notice('Select an entity placed with World studio.');return true}if(entityId.startsWith('base:')){selected=entityId;tab='Actors';selecting=false;open()}else{selected=entityId;selecting=false;open()}}else if(point){placing=false;run(async()=>{const result=await invoke(selected?'update':'spawn',{...formData,x:Math.round(point.x*10)/10,z:Math.round(point.z*10)/10,...(selected?{id:selected}:{})});selected=result.id;open()})}else return true;document.body.classList.remove('studio-placing');document.querySelector('#studio-placement')?.remove();return true};
 function read(form){const d={};for(const n of form.elements)if(n.name)d[n.name]=n.type==='checkbox'?n.checked:n.type==='number'?Number(n.value):n.value;if(d.shopText!==undefined){d.shop={};for(const line of d.shopText.split('\n').filter(s=>s.trim())){const [id,buy,sell,stock]=line.split(',').map(s=>s.trim());if(!goods[id])throw Error('Unknown shop item: '+id);d.shop[id]={buy:Number(buy),sell:Number(sell),stock:Number(stock)}}delete d.shopText;}const result=validateEntity({...formData,...d});if(result.kind==='npc'&&!result.attackable)result.hostile=false;return result}
 function world(){
  workspace.append(el('a','Open the World Studio guide',{href:'/owner-guide.html',target:'_blank',rel:'noopener'}));workspace.append(el('p','Create permanent actors, scenery and item drops. Click placement saves immediately. Deleted entities can be restored.'));
  const columns=el('div',null,{class:'studio-columns'}),left=el('section'),right=el('section');columns.append(left,right);workspace.append(columns);
  field(left,'Filter saved entities','filter','').oninput=e=>list(e.target.value);
  const listBox=el('div',null,{class:'studio-entity-list'});left.append(listBox);
  function list(search=''){listBox.replaceChildren();const all=[...rows.values()].filter(r=>(r.data.name+' '+r.data.template).toLowerCase().includes(search.toLowerCase()));for(const r of all){const b=btn((r.deleted?'[Deleted] ':'')+(r.data.name||r.data.template)+' · '+r.data.x.toFixed(1)+', '+r.data.z.toFixed(1),()=>{selected=r.id;draw();bridge.highlight(r.id)},listBox);b.classList.toggle('selected',selected===r.id)}if(!all.length)listBox.append(el('p','No saved entities yet.'))}list();
  btn('New entity',()=>{selected=null;formData=null;draw()},left);btn('Select in world',()=>beginPlacement(true),left);
  const existing=rows.get(selected);const starting=existing?.data||formData||entityDefaults('villager',Math.round(bridge.position().x+3),Math.round(bridge.position().z));formData={...starting};
  const form=el('form');right.append(form);form.onsubmit=e=>e.preventDefault();
  const choices=Object.entries(worldTemplates).map(([id,d])=>[id,d.kind.toUpperCase()+' · '+d.name]);for(const [id,g]of Object.entries(goods))choices.push(['item:'+id,'ITEM · '+g.name]);
  const template=field(form,'Template','template',starting.template,'text',choices);
  template.onchange=()=>{selected=null;formData=template.value.startsWith('item:')?{...entityDefaults('crate'),kind:'item',template:template.value,name:goods[template.value.slice(5)].name,item:template.value.slice(5),amount:1}:entityDefaults(template.value);const p=bridge.position();formData.x=Math.round(p.x+3);formData.z=Math.round(p.z);draw()};
  field(form,'Name','name',starting.name);const grid=el('div',null,{class:'studio-grid'});form.append(grid);
  for(const [key,label,min,max,step] of [['x','World X',-4500,4500,.1],['z','World Z',-4500,4500,.1],['yaw','Heading °',-360,360,1],['scale','Scale',.25,5,.05]]){const n=field(grid,label,key,starting[key],'number');n.min=min;n.max=max;n.step=step}
  if(['npc','monster'].includes(starting.kind)){
   for(const [key,label,min,max,step] of [['level','Level',1,999,1],['hp','Health',1,100000,1],['damage','Attack damage',0,10000,1],['attackSpeed','Seconds per turn',1.3,30,.1],['roam','Roam radius (m)',0,50,1],['respawn','Respawn seconds (0 = never)',0,86400,1]]){const n=field(grid,label,key,starting[key],'number');n.min=min;n.max=max;n.step=step}
   field(grid,'Attack style','attackType',starting.attackType,'text',attackTypes.map(a=>[a,a]));field(grid,'Can be attacked','attackable',starting.attackable,'checkbox');field(grid,'Aggressive to nearby players','hostile',starting.hostile,'checkbox');
   if(starting.kind==='npc')field(form,'Dialogue (one line per page)','dialogue',starting.dialogue,'textarea');
  }else if(starting.kind==='item')field(form,'Quantity','amount',starting.amount||1,'number');
  if(starting.kind==='npc')field(form,'Service','role',starting.role||'resident','text',[['resident','Dialogue only'],['merchant','Merchant / shop'],['banker','Bank'],['guard','Guard'],['smith','Smith'],['mage','Mage'],['healer','Healer']]);
  if(starting.kind==='npc'||starting.template==='market'){
   const stock=field(form,'Shop inventory: one itemID,buyPrice,sellPrice,stock per line (stock -1 = unlimited). Leave empty for standard market.','shopText',Object.entries(starting.shop||{}).map(([id,s])=>[id,s.buy,s.sell,s.stock].join(',')).join('\n'),'textarea');
   const help=el('small','Example: fishingPole,35,12,-1  ·  bait,2,1,1000  ·  rawFish,12,6,100');form.append(help);const catalog=el('details');catalog.append(el('summary','Item ID reference'),el('pre',Object.entries(goods).map(([id,g])=>id+' — '+g.name).join('\n')));form.append(catalog);
  }
  if(starting.template.startsWith('terrain_')){field(grid,'Terrain radius (2–30m)','radius',starting.radius||10,'number');field(grid,'Raise / lower (-8 to +8m)','elevation',starting.elevation||0,'number')}
  if(['castle_wall','castle_gate'].includes(starting.template))field(grid,'Wall / gate length (6–50m)','length',starting.length||24,'number');
  if(starting.template==='road'){field(grid,'Path length (2–50m)','length',starting.length||10,'number');field(grid,'Path width (1–8m)','width',starting.width||2.5,'number')}

  const buttons=el('div',null,{class:'studio-actions'});right.append(buttons);
  btn(existing?'Save changes':'Spawn at coordinates',async()=>{formData=read(form);const r=await invoke(existing?'update':'spawn',{...formData,...(existing?{id:selected}:{})});selected=r.id;draw()},buttons);
  btn(existing?'Move with world click':'Place with world click',()=>{formData=read(form);beginPlacement()},buttons);
  btn('Use my position',()=>{const p=bridge.position();for(const k of ['x','z','yaw'])form.elements[k].value=p[k].toFixed(1)},buttons);
  if(existing){btn('Teleport here',()=>invoke('teleport',{x:existing.data.x,z:existing.data.z}),buttons);btn('Clone',()=>{formData={...read(form),x:read(form).x+3};selected=null;draw()},buttons);btn(existing.deleted?'Restore':'Delete',async()=>{await invoke(existing.deleted?'restore':'delete',{id:selected});draw()},buttons);if(['npc','monster'].includes(existing.data.kind))btn('Preview attack',()=>{panel.close();bridge.preview(selected)},buttons)}
  btn('Export world',()=>{const blob=new Blob([JSON.stringify({format:'eldervale-world-v1',entities:[...rows.values()].filter(r=>!r.deleted).map(r=>r.data)},null,2)],{type:'application/json'}),a=el('a');a.href=URL.createObjectURL(blob);a.download='eldervale-world.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)},left);
  const upload=field(left,'Import world JSON (adds entities)','import','','file');upload.accept='.json,application/json';upload.onchange=()=>run(async()=>{const file=upload.files[0];if(!file)return;if(file.size>2e6)throw Error('Import is limited to 2 MB');const data=JSON.parse(await file.text());if(data.format!=='eldervale-world-v1'||!Array.isArray(data.entities)||data.entities.length>200)throw Error('Expected world export with up to 200 entities');const entities=data.entities.map(validateEntity);let count=0;for(const d of entities){await invoke('spawn',d);note('Imported '+(++count)+'/'+entities.length)}draw()});
 }
 function server(){workspace.append(el('h3','Announcements & maintenance'));if(current.settings.world_config?.enabled)workspace.append(el('p','Shared procedural world · Seed '+current.settings.world_config.seed+' · Birchford, Winterwatch, Emberspire and Eldervale Castle. All placed NPCs, objects and edits persist across clients.'));btn('Set my position as new-character / tutorial start',()=>invoke('start_location',bridge.position()));workspace.append(el('p','Only newly created characters start here. Existing characters keep their saved positions.'));const f=el('form');f.onsubmit=e=>e.preventDefault();workspace.append(f);field(f,'Welcome message shown on login','welcome',current.settings.welcome,'textarea');btn('Save welcome',()=>invoke('welcome',{text:f.elements.welcome.value}),f);field(f,'Announcement shown to connected players','announcement','','textarea');btn('Announce for 10 minutes',()=>invoke('announce',{text:f.elements.announcement.value}),f);field(f,'Restart countdown (15–3600 seconds)','seconds',120,'number');btn('Start countdown',()=>invoke('restart',{seconds:Number(f.elements.seconds.value)}),f);btn('Cancel countdown',()=>invoke('cancel_restart'),f);workspace.append(el('p','Restart saves characters and reloads connected game clients. It does not reboot Hostinger or Supabase. Maintenance blocks entry for other players while you build.'));btn(current.settings.maintenance?'End maintenance':'Start maintenance',async()=>{await invoke('maintenance',{enabled:!current.settings.maintenance});draw()});}
 async function players(){workspace.append(el('p','Loading players and reports…'));try{overview=await rpc('world_admin_overview');if(tab!=='Players')return;workspace.replaceChildren();workspace.append(el('p','Choose a saved character. Last save is not proof that a player is online. Item grants go to their bank; offline players receive them on next login.'));
 const f=el('form');f.onsubmit=e=>e.preventDefault();workspace.append(f);const players=overview.players||[];field(f,'Player','userId',userId,'text',players.map(p=>[p.user_id,(p.character_name||p.user_id)+' · Lv '+p.level]));field(f,'Duration (seconds)','seconds',3600,'number');field(f,'Moderation reason','reason','');
 for(const cmd of (owner?['kick','mute','unmute','ban','unban']:['kick','mute','unmute']))btn(cmd,async()=>{await invoke(cmd,{userId:f.elements.userId.value,reason:f.elements.reason.value,seconds:Number(f.elements.seconds.value)});await playersRefresh()},f);
 if(owner){
 field(f,'Staff role','role','player','text',[['player','Player'],['moderator','Moderator']]);btn('Set player role',()=>invoke('role',{userId:f.elements.userId.value,role:f.elements.role.value}),f);const roles=el('p','Moderators can kick, mute for up to 24 hours, remove chat and resolve reports. World editing, items, bans and staff roles remain owner-only.');f.append(roles);
 field(f,'Item','item','gold','text',[['gold','Gold'],...Object.entries(goods).map(([k,v])=>[k,v.name])]);field(f,'Amount','amount',1,'number');btn('Give items / gold',()=>invoke('give',{userId:f.elements.userId.value,item:f.elements.item.value,amount:Number(f.elements.amount.value)}),f);
 const p=bridge.position();field(f,'Teleport X','x',p.x.toFixed(1),'number');field(f,'Teleport Z','z',p.z.toFixed(1),'number');btn('Teleport player',()=>invoke('teleport',{userId:f.elements.userId.value,x:Number(f.elements.x.value),z:Number(f.elements.z.value)}),f);
 btn('Heal player',()=>invoke('heal',{userId:f.elements.userId.value}),f);btn('Bring player to me',()=>invoke('bring',{userId:f.elements.userId.value}),f);field(f,'Skill XP key','skill','attackXP');field(f,'Skill level (1–100)','skillLevel',1,'number');btn('Set skill level',()=>invoke('setskill',{userId:f.elements.userId.value,skill:f.elements.skill.value,level:Number(f.elements.skillLevel.value)}),f);
 }
 workspace.append(el('h3','Reports'));for(const r of overview.reports){const a=el('article',null,{class:'studio-log'});a.append(el('strong',(r.resolved?'Resolved':'Open')+' · #'+r.id),el('p',r.body),el('small','Reporter '+r.reporter+(r.target?' · Target '+r.target:'')));if(!r.resolved)btn('Resolve',async()=>{await invoke('resolve_report',{id:r.id});await playersRefresh()},a);workspace.append(a)}
 workspace.append(el('h3','Recent world chat'));for(const c of overview.chat){const a=el('article',null,{class:'studio-log'});a.append(el('p',c.sender_name+': '+c.body));btn('Remove message',async()=>{await invoke('delete_chat',{id:c.id});await playersRefresh()},a);workspace.append(a)}
 }catch(e){note(e.message,true)}}
 async function playersRefresh(){if(tab==='Players')await players()}
 async function audit(){workspace.append(el('p','Loading audit log…'));try{const data=await rpc('world_admin_overview');if(tab!=='Audit')return;workspace.replaceChildren();workspace.append(el('p','The latest 100 owner actions. Export includes before/after records for recovery.'));btn('Export audit',()=>{const blob=new Blob([JSON.stringify(data.audit,null,2)],{type:'application/json'}),a=el('a');a.href=URL.createObjectURL(blob);a.download='eldervale-audit.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000)});for(const r of data.audit){const details=el('details',null,{class:'studio-log'});details.append(el('summary',r.action+' · '+new Date(r.created_at).toLocaleString()+' · '+(r.target||'world')),el('pre',JSON.stringify({before:r.before_data,after:r.after_data},null,2)));workspace.append(details)}}catch(e){note(e.message,true)}}
 function items(){workspace.append(el('p','Create persistent trade goods or healing consumables. These can be granted, dropped, banked and stocked by merchants. New 3D equipment and scripted mechanics need development. Existing item IDs stay valid when renamed.'));
 const f=el('form');f.onsubmit=e=>e.preventDefault();workspace.append(f);const existing=Object.entries(goods).filter(([id,g])=>g.custom);const picker=field(f,'Edit an existing item','edit','','text',[['','New item'],...existing.map(([id,g])=>[id,g.name])]);
 field(f,'Unique item ID (custom_lowercase_name)','id','custom_royal_bread');field(f,'Display name','name','Royal bread');field(f,'Description','description','Freshly baked in Eldervale Castle.','textarea');field(f,'Icon','icon','food','text',Object.entries(itemIcons).map(([k,d])=>[k,d.label]));field(f,'Buy price','buy',12,'number');field(f,'Sell price','sell',4,'number');field(f,'Heals HP (0 = ordinary trade good)','heal',10,'number');field(f,'Stackable','stackable',false,'checkbox');
 const palette=el('div',null,{class:'studio-icon-palette'});f.append(palette);for(const [key,d]of Object.entries(itemIcons)){const b=btn(d.label,()=>{f.elements.icon.value=key},palette);b.title=d.label;const icon=el('span');icon.innerHTML=d.svg;b.prepend(icon);}
 picker.onchange=()=>{const g=goods[picker.value];if(!g)return;for(const k of ['name','description','buy','sell','heal'])f.elements[k].value=g[k]??'';f.elements.id.value=picker.value;f.elements.icon.value=g.iconKey;f.elements.stackable.checked=!!g.stackable;};
 btn('Save item',async()=>{const payload={};for(const n of f.elements)if(n.name&&n.name!=='edit')payload[n.name]=n.type==='checkbox'?n.checked:n.type==='number'?Number(n.value):n.value;await invoke('catalog_item',payload);draw()},f);
 workspace.append(el('pre',Object.entries(goods).map(([id,g])=>id+' — '+g.name).join('\n')));
 }
 async function actors(){
  workspace.append(el('p','Loading every NPC and monster, including original residents…'));try{const data=await rpc('world_admin_overview');if(tab!=='Actors')return;workspace.replaceChildren();workspace.append(el('p','These controls apply to every shared NPC. Delete removes the actor from the world until you restore it. Respawn resets its health and position. Freeze pauses movement and combat.'));
  const all=data.actors||[],filter=field(workspace,'Search name, species or ID','actorFilter',''),list=el('div',null,{class:'studio-entity-list'});workspace.append(list);
  const render=()=>{list.replaceChildren();for(const a of all.filter(a=>(a.id+' '+a.data.name+' '+a.data.species).toLowerCase().includes(filter.value.toLowerCase()))){const card=el('article',null,{class:'studio-log'});card.append(el('strong',(a.deleted?'[Deleted] ':'')+(a.data.name||a.id)),el('small',a.id+' · '+a.x.toFixed(1)+', '+a.z.toFixed(1)+' · HP '+a.hp+'/'+a.data.hp));
   const controls=el('div',null,{class:'studio-actions'});card.append(controls);for(const [label,cmd] of [['Go to','goto'],[a.deleted?'Restore':'Delete',a.deleted?'actor_restore':'actor_delete'],['Respawn','actor_respawn'],[a.data.frozen?'Unfreeze':'Freeze',a.data.frozen?'actor_unfreeze':'actor_freeze']])btn(label,async()=>{await invoke(cmd,{id:a.id});if(cmd!=='goto')await actors()},controls);
   const details=el('details');details.append(el('summary','Edit combat and behavior'));const form=el('form');form.onsubmit=e=>e.preventDefault();for(const [k,label]of [['level','Combat level'],['hp','Maximum HP'],['damage','Damage'],['attackSpeed','Seconds per attack'],['roam','Roam radius'],['respawn','Respawn seconds']])field(form,label,k,a.data[k]??0,'number');for(const k of ['attackable','hostile'])field(form,k,k,!!a.data[k],'checkbox');btn('Save actor',async()=>{const payload={id:a.id};for(const e of form.elements)if(e.name)payload[e.name]=e.type==='checkbox'?e.checked:Number(e.value);await invoke('actor_update',payload);await actors()},form);details.append(form);card.append(details);list.append(card);if(a.id===selected)details.open=true;}};filter.oninput=render;render();
  }catch(e){note(e.message,true)}
 }
 const terminalHelp=`help — list commands
where — your position
items — all item IDs (Items tab creates new trade goods)
templates — NPC / object template IDs
actors — all actor IDs and positions
players — player IDs and online status
castle — teleport to Eldervale Castle
spawn template x z
spawn template x z level hp — override actor stats
announce message | welcome message
restart seconds | cancel_restart | maintenance on|off
give itemID amount [playerUUID]
teleport x z [playerUUID] | bring playerUUID | heal [playerUUID]
goto actorID | delete actorID | restore actorID
respawn actorID | freeze actorID | unfreeze actorID
setnpc actorID hp|level|damage|attackSpeed|roam|respawn value
setskill playerUUID attackXP|strengthXP|defenceXP|... level
role playerUUID moderator|player
kick|mute|ban playerUUID seconds reason
unmute|unban playerUUID reason
start_location x z
resolve_report reportID | delete_chat messageID`;
 function consoleView(){workspace.append(el('p',owner?'Owner game terminal. Commands are validated and audited on the server.':'Moderator terminal: players, kick, mute, unmute, delete_chat and resolve_report.'));workspace.append(el('pre',owner?terminalHelp:'players\nkick playerUUID seconds reason\nmute playerUUID seconds reason\nunmute playerUUID reason\ndelete_chat messageID\nresolve_report reportID'));
 const f=el('form');workspace.append(f);const input=field(f,'Command','command','');const output=el('pre','Ready.',{class:'studio-terminal'});workspace.append(output);const submit=el('button','Run',{type:'submit'});f.append(submit);f.onsubmit=e=>{e.preventDefault();run(async()=>{let [cmd,...args]=input.value.trim().split(/\s+/),p={};
 if(cmd==='help'){output.textContent=terminalHelp;return}
 if(cmd==='where'){output.textContent=JSON.stringify(bridge.position(),null,2);return}
 if(cmd==='items'||cmd==='templates'){output.textContent=cmd==='items'?Object.entries(goods).map(([id,g])=>id+' — '+g.name).join('\n'):Object.entries(worldTemplates).map(([id,t])=>id+' — '+t.name).join('\n');return}
 if(cmd==='actors'||cmd==='players'){const d=await rpc('world_admin_overview');output.textContent=JSON.stringify(d[cmd],null,2);return}
 if(cmd==='castle'){cmd='teleport';p={x:-340,z:-237};}
 else if(['announce','welcome'].includes(cmd))p.text=args.join(' ');
 else if(cmd==='restart')p.seconds=Number(args[0]);else if(cmd==='maintenance')p.enabled=args[0]==='on';
 else if(cmd==='spawn'){p=entityDefaults(args[0],Number(args[1]),Number(args[2]));if(args[3])p.level=Number(args[3]);if(args[4])p.hp=Number(args[4]);}
 else if(cmd==='give')p={item:args[0],amount:Number(args[1]),userId:args[2]||userId};
 else if(cmd==='teleport')p={x:Number(args[0]),z:Number(args[1]),userId:args[2]||userId};
 else if(['kick','mute','ban'].includes(cmd))p={userId:args[0],seconds:Number(args[1]),reason:args.slice(2).join(' ')};
 else if(['unmute','unban'].includes(cmd))p={userId:args[0],reason:args.slice(1).join(' ')};
 else if(['bring','heal'].includes(cmd))p={userId:args[0]||userId};
 else if(cmd==='role')p={userId:args[0],role:args[1]};
 else if(cmd==='setskill')p={userId:args[0],skill:args[1],level:Number(args[2])};
 else if(cmd==='setnpc'){cmd='actor_update';p={id:args[0],[args[1]]:Number(args[2])};}
 else if(['delete','restore','respawn','freeze','unfreeze','goto'].includes(cmd)){p={id:args[0]};if(cmd!=='goto')cmd='actor_'+cmd;}
 else if(cmd==='start_location')p={x:Number(args[0]),z:Number(args[1])};
 else if(['resolve_report','delete_chat'].includes(cmd))p={id:Number(args[0])};
 else if(cmd!=='cancel_restart')throw Error('Unknown command. Type help.');
 const result=await invoke(cmd,p);output.textContent=JSON.stringify(result,null,2);input.value='';})};}
 function sync(s){current=s;const access=s.owner||s.staffRole==='moderator';button.hidden=!access;if(!access&&panel.open)panel.close();for(const r of s.entities||[])rows.set(r.id,r)}sync(snapshot);
 return {sync,connection:msg=>note('World sync unavailable: '+msg,true)};
}
