// Exploration runtime (client): lore objects (read, mote over unread ones), clue crates, the Explore
// journal (Lore · Places · Clues · Treasure · Emotes · Bosses, the boss log from boss-journal.js) with an achievement counter, "Area discovered"
// toasts, discovered places on the world map and minimap, the clue reader (riddles, bearings and a
// drawn map fragment), emotes, digging and opening caskets. The server decides everything
// (db/explore-1-core.sql): this module only sends commands and shows the replies/events.
//
// game.js wiring: createExplore({...}) once; tagHit/click for world objects, talk() when an NPC
// dialogue opens, useItem/itemChoices for inventory items, event() for realm events, frame() each
// frame, mapPois() for the world map and drawMinimap() for the minimap.
import {ITEMS,CLUE_ITEM,CASKET_ITEM,TIERS,TIER_LABEL,EMOTES,PLACES,LORE,KEEPSAKES,TOTALS,areaById,LORE_MODELS} from './explore-data.js?v=release-20261107-trapdoor138';
import {worldRivers,roadLines,landscapeLakes} from './geography.js?v=release-20261107-trapdoor138';
import {undergroundAt,undergroundAreas} from './underground.js?v=release-20261107-trapdoor138';
import {walkableLocal} from './underground-data.js?v=release-20261107-trapdoor138';
import {animateExploreModel} from './explore-models.js?v=release-20261107-trapdoor138';
import {goods} from './economy.js?v=release-20261107-trapdoor138';
import {drawBossJournal,bossJournalRows,bossJournalSummary} from './boss-journal.js?v=release-20261107-trapdoor138';

// ---------------------------------------------------------------------------- item icons + goods
const svg=body=>'<svg viewBox="0 0 48 48" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><g stroke="#342c26" stroke-width="1.5" stroke-linejoin="round">'+body+'</g></svg>';
export const EXPLORE_ICONS={
 clue:svg('<path d="M10 12Q24 6 38 12V36Q24 42 10 36Z" fill="#e7d6a8"/><path d="M15 18H33M15 23H30M15 28H32" stroke="#8b6b45"/><circle cx="33" cy="34" r="5" fill="#b33b2e"/>'),
 casket:svg('<path d="M8 20H40V39H8Z" fill="#7a5431"/><path d="M8 20Q24 6 40 20Z" fill="#94683d"/><path d="M8 26H40" stroke="#d9b45a" stroke-width="3"/><rect x="21" y="23" width="6" height="8" fill="#d9b45a"/>'),
 compass:svg('<circle cx="24" cy="24" r="16" fill="#c9a24f"/><circle cx="24" cy="24" r="12" fill="#f1e6c8"/><path d="M24 13L27 24L24 35L21 24Z" fill="#b33b2e"/>'),
 quill:svg('<path d="M36 6Q20 14 14 36L18 38Q26 18 36 6Z" fill="#f1efe8"/><path d="M14 36L10 44" stroke="#3a3027" stroke-width="2"/>'),
 pebble:svg('<ellipse cx="24" cy="28" rx="15" ry="11" fill="#8e9da3"/><path d="M27 21A6 6 0 1 0 27 33A8 8 0 1 1 27 21Z" fill="#f2e3a2"/>'),
 lantern:svg('<path d="M18 12H30V16H18Z" fill="#7d6a3b"/><path d="M16 16H32V36H16Z" fill="#ffd77a"/><path d="M16 16H32V36H16Z" fill="none"/><path d="M14 36H34V40H14Z" fill="#7d6a3b"/><path d="M24 6V12" stroke="#7d6a3b" stroke-width="2"/>'),
 bottle:svg('<path d="M20 6H28V14Q38 20 36 40H12Q10 20 20 14Z" fill="#6fae8a" opacity=".85"/><path d="M18 34L30 34L27 28H21Z" fill="#7a5431"/><path d="M24 20V28M24 20L29 26H24" stroke="#f4efe2"/>'),
 banner:svg('<path d="M12 6V44" stroke="#5a4330" stroke-width="3"/><path d="M13 8H38L32 16L38 24H13Z" fill="#b8b0c8"/>'),
 globe:svg('<circle cx="24" cy="22" r="14" fill="#cfe6f2" opacity=".9"/><path d="M20 28V18L24 14L28 18V28Z" fill="#6e7b84"/><path d="M12 36H36V42H12Z" fill="#6e4d31"/>'),
 hourglass:svg('<path d="M14 6H34V10H14ZM14 38H34V42H14Z" fill="#6e4d31"/><path d="M17 10H31Q31 20 24 24Q31 28 31 38H17Q17 28 24 24Q17 20 17 10Z" fill="#f2c27a" opacity=".85"/>'),
 chart:svg('<path d="M8 10H40V38H8Z" fill="#26304a"/><circle cx="16" cy="18" r="1.6" fill="#e9eefc"/><circle cx="30" cy="16" r="1.6" fill="#e9eefc"/><circle cx="24" cy="28" r="2.2" fill="#c8d6ff"/><path d="M16 18L30 16L24 28" stroke="#9fb0d8" stroke-width="1"/>'),
 brooch:svg('<circle cx="24" cy="24" r="14" fill="#d9b45a"/><path d="M24 12L27 24L24 36L21 24ZM12 24L24 21L36 24L24 27Z" fill="#8b6b2e"/>'),
 circlet:svg('<ellipse cx="24" cy="26" rx="16" ry="8" fill="none" stroke="#c9ced6" stroke-width="3"/><circle cx="24" cy="18" r="3" fill="#f6f1ea"/><circle cx="14" cy="21" r="2.4" fill="#f6f1ea"/><circle cx="34" cy="21" r="2.4" fill="#f6f1ea"/>')
};
// Explore items join the shared goods table (names, icons, examine text); counts come from stats.
export function registerExploreGoods(table=goods){for(const [id,d] of Object.entries(ITEMS))if(!table[id]||table[id].explore)table[id]={name:d.name,description:d.description,buy:d.buy,sell:d.sell,icon:EXPLORE_ICONS[d.icon]||EXPLORE_ICONS.clue,iconKey:d.icon,category:d.category,stackable:false,explore:true,tier:d.tier,kind:d.kind}}
registerExploreGoods();
export const tierOfItem=id=>TIERS.find(t=>CLUE_ITEM[t]===id||CASKET_ITEM[t]===id)||null;

// ------------------------------------------------------------------------------------- helpers
// Which places is the player standing in? (pure: also used by tests)
export function placeAt(places,pos,at=undergroundAt){const out=[];const ug=at(pos.x,pos.z);for(const p of places){if(p.type==='town'||p.type==='landmark'){if(!ug&&Math.hypot(p.x-pos.x,p.z-pos.z)<=p.radius)out.push(p.id)}else if(ug&&ug.area?.id===p.area)out.push(p.id)}return out}
// Counter line: "Lore 12/31 · Places 7/29 · Clues 5".
export function counterText(j){const lore=(j?.lore||[]).filter(l=>l.found).length,places=(j?.places||[]).filter(p=>p.found).length,clues=Object.values(j?.stats?.clues||{}).reduce((a,b)=>a+(+b||0),0);
 return 'Lore '+lore+'/'+((j?.lore||[]).length||TOTALS.lore)+' · Places '+places+'/'+((j?.places||[]).length||TOTALS.place)+' · Clues '+clues}
const hash=s=>{let h=2166136261;for(const c of String(s))h=Math.imul(h^c.charCodeAt(0),16777619);return (h>>>0)/4294967295};
// Draw a parchment map fragment around a map step: real rivers, roads, lakes and named places
// (or the area's rooms), with the X at the dig spot; the view is offset so the X is not centred.
export function drawClueMap(ctx,w,h,map,{id='',rivers=worldRivers,roads=roadLines,lakes=landscapeLakes,places=PLACES,areas=undergroundAreas()}={}){
 const area=map.area?areas.find(a=>a.id===map.area)||areaById(map.area):null,span=area?110:90,ox=(hash(id+'x')-.5)*span*.45,oz=(hash(id+'z')-.5)*span*.45;
 const cx=map.x+ox,cz=map.z+oz,k=w/span,X=x=>w/2+(x-cx)*k,Y=z=>h/2+(z-cz)*k;
 ctx.fillStyle='#e9d9ac';ctx.fillRect(0,0,w,h);ctx.strokeStyle='rgba(120,90,50,.25)';for(let i=0;i<40;i++){ctx.beginPath();const a=hash(id+i)*w,b=hash(i+id)*h;ctx.moveTo(a,b);ctx.lineTo(a+12,b+3);ctx.stroke()}
 ctx.lineCap='round';
 if(area){const lv=area.levels[0];ctx.fillStyle='#c9b27c';ctx.strokeStyle='#6b5232';ctx.lineWidth=2;
  for(let py=0;py<h;py+=3)for(let px=0;px<w;px+=3){const lx=cx+(px-w/2)/k-area.origin.x,lz=cz+(py-h/2)/k-area.origin.z;if(walkableLocal(lv,lx,lz))ctx.fillRect(px,py,3,3)}}
 else{ctx.strokeStyle='#5d86a0';for(const r of rivers){ctx.lineWidth=Math.max(2,(r.width||6)*k*.5);ctx.beginPath();r.points.forEach(([x,z],i)=>i?ctx.lineTo(X(x),Y(z)):ctx.moveTo(X(x),Y(z)));ctx.stroke()}
  ctx.fillStyle='rgba(93,134,160,.6)';for(const l of lakes){ctx.beginPath();ctx.ellipse(X(l.x),Y(l.z),l.rx*k,l.rz*k,0,0,Math.PI*2);ctx.fill()}
  ctx.strokeStyle='#8b6b45';ctx.setLineDash([4,4]);ctx.lineWidth=1.5;for(const line of roads){ctx.beginPath();line.forEach(([x,z],i)=>i?ctx.lineTo(X(x),Y(z)):ctx.moveTo(X(x),Y(z)));ctx.stroke()}ctx.setLineDash([]);
  ctx.fillStyle='#4a3520';ctx.font='italic 11px Georgia';ctx.textAlign='center';for(const p of places)if(p.x!==undefined&&Math.abs(p.x-cx)<span/2&&Math.abs(p.z-cz)<span/2)ctx.fillText(p.name,X(p.x),Y(p.z))}
 ctx.strokeStyle='#a3271b';ctx.lineWidth=3;const tx=X(map.x),ty=Y(map.z);ctx.beginPath();ctx.moveTo(tx-6,ty-6);ctx.lineTo(tx+6,ty+6);ctx.moveTo(tx+6,ty-6);ctx.lineTo(tx-6,ty+6);ctx.stroke();
 ctx.strokeStyle='#6b5232';ctx.lineWidth=4;ctx.strokeRect(2,2,w-4,h-4);return {x:tx,y:ty};
}

// ------------------------------------------------------------------------------------------ UI
let cssLoaded=false;
function loadCss(doc){if(cssLoaded||!doc?.head)return;cssLoaded=true;const l=doc.createElement('link');l.rel='stylesheet';l.href='./explore.css?v=release-20261107-trapdoor138';doc.head.append(l)}
export function createExplore({T=null,camera=null,player=null,say=()=>{},command=(c,p)=>globalThis.eldervaleRealm?.command(c,p),journalFetch=()=>globalThis.eldervaleExploreJournal?.()??Promise.resolve(null),bossFetch=()=>globalThis.eldervaleBossJournal?.()??Promise.resolve(null),doc=globalThis.document,now=()=>performance.now()}={}){
 loadCss(doc);
 let journal=null,loading=null,nextScan=0,panel=null,tab='lore',reader=null,bosses,bossLoading=null;const asked=new Map(),loreRoots=[],emotes=[];
 const el=(tag,text,attrs={})=>{const e=doc.createElement(tag);if(text!=null)e.textContent=text;for(const [k,v] of Object.entries(attrs))e.setAttribute(k,v);return e};
 const found=(kind,id)=>!!(kind==='lore'?journal?.lore:journal?.places)?.find(x=>x.id===id&&x.found);
 async function refresh(){if(loading)return loading;loading=Promise.resolve(journalFetch()).then(j=>{if(j)journal=j;loading=null;updateMotes();if(panel?.open)drawPanel();updateCounter();return journal}).catch(()=>{loading=null;return journal});return loading}
 // Toasts (one queue, no stacking).
 const toastBox=doc?.body?(()=>{const b=el('div',null,{class:'explore-toasts','aria-live':'polite'});doc.body.append(b);return b})():null;
 function toast(title,text='',kind=''){if(!toastBox)return say(title+(text?' — '+text:''));const t=el('div',null,{class:'explore-toast '+kind});t.append(el('strong',title));if(text)t.append(el('span',text));toastBox.append(t);setTimeout(()=>t.classList.add('out'),3800);setTimeout(()=>t.remove(),4400)}
 // HUD button beside the world-map toggle.
 let counter=null;
 if(doc?.body){const b=el('button','✦',{id:'explore-toggle',type:'button',title:'Journal: lore, places, clues, boss kills','aria-label':'Exploration journal'});b.onclick=()=>openPanel();const map=doc.getElementById('map-toggle');if(map?.parentNode)map.parentNode.insertBefore(b,map.nextSibling);else doc.body.append(b);counter=el('span','',{class:'explore-counter'});b.append(counter)}
 function updateCounter(){if(counter)counter.textContent=journal?' '+(journal.lore||[]).filter(l=>l.found).length+'/'+(journal.lore||[]).length:''}
 function updateMotes(){for(const r of loreRoots){const m=r.userData.exploreModel?.userData.exploreMote;if(m)m.visible=!found('lore',r.userData.exploreLore)}}

 // --------------------------------------------------------------------- panel (journal)
 function openPanel(which){if(!doc?.body)return;if(!panel){panel=el('dialog',null,{class:'explore-panel','aria-label':'Exploration journal'});doc.body.append(panel)}if(which)tab=which;drawPanel();if(!panel.open)panel.showModal?.();void refresh();if(tab==='bosses')void refreshBosses()}
 // Boss log (Bosses tab): fetched when the tab is shown, so kill counts are current.
 function refreshBosses(){if(bossLoading)return bossLoading;bossLoading=Promise.resolve(bossFetch()).catch(()=>null).then(r=>{bosses=r??null;bossLoading=null;if(panel?.open&&tab==='bosses')drawPanel();return bosses});return bossLoading}
 function drawPanel(){if(!panel)return;panel.replaceChildren();const head=el('header'),bossRows=tab==='bosses'&&bosses?bossJournalRows(bosses):null;head.append(el('h2',tab==='bosses'?'Boss log':'Exploration'),el('p',tab==='bosses'?(bossRows?.length?bossJournalSummary(bossRows):''):journal?counterText(journal):'Loading…',{class:'explore-count'}));
  const close=el('button','✕',{type:'button','aria-label':'Close'});close.onclick=()=>panel.close();head.append(close);panel.append(head);
  if(journal&&!journal.on)panel.append(el('p','Exploration is closed for now.',{class:'explore-muted'}));
  const tabs=el('nav');for(const [k,label] of [['lore','Lore'],['places','Places'],['clues','Clues'],['treasure','Treasure'],['emotes','Emotes'],['bosses','Bosses']]){const b=el('button',label,{type:'button','aria-pressed':String(tab===k)});b.onclick=()=>{tab=k;drawPanel();if(k==='bosses')void refreshBosses()};tabs.append(b)}panel.append(tabs);
  const body=el('section',null,{class:'explore-body'});panel.append(body);const j=journal||{lore:[],places:[],clues:[],stats:{clues:{},log:{},titles:[]}};
  if(tab==='lore'){let region='';for(const l of j.lore){if(l.region!==region){region=l.region;body.append(el('h3',region))}const row=el('details',null,{class:l.found?'found':'unfound'});row.append(el('summary',l.found?l.name:'??? — '+l.name.replace(/[A-Za-z]/g,(c,i)=>i%3?'·':c)));if(l.found)row.append(el('p',l.text));else row.append(el('p','Not yet read. Look for it in '+region+'.',{class:'explore-muted'}));body.append(row)}
   const next=(j.milestones?.lore||[]).find(m=>m.at>j.lore.filter(l=>l.found).length);if(next)body.append(el('p','Next lore milestone: '+next.at+' read → '+next.amount+' XP lamp'+(next.title?' and the title “'+next.title+'”':''),{class:'explore-muted'}))}
  else if(tab==='places'){for(const p of j.places){const row=el('div',null,{class:'explore-place '+(p.found?'found':'unfound')});row.append(el('strong',(p.found?'✔ ':'○ ')+p.name),el('span',p.found?p.blurb||'':(p.hint?'Rumour: '+p.hint:'Not yet discovered.')));body.append(row)}}
  else if(tab==='clues'){if(!j.clues.length)body.append(el('p','No clue in progress. Clue scrolls drop from monsters: weathered (levels 1–30), sealed (25–70) and gilt-edged (60+). Read one from your inventory to begin.',{class:'explore-muted'}));
   for(const c of j.clues){const b=el('button',TIER_LABEL[c.tier]+' clue — step '+(c.idx+1)+' of '+c.total,{type:'button'});b.onclick=()=>showClue({tier:c.tier,idx:c.idx,total:c.total,step:c.step});body.append(b)}
   const done=j.stats?.clues||{};body.append(el('p','Completed: '+TIERS.map(t=>TIER_LABEL[t]+' '+(done[t]||0)).join(' · '),{class:'explore-muted'}))}
  else if(tab==='treasure'){const log=j.stats?.log||{};const grid=el('div',null,{class:'explore-log'});for(const k of KEEPSAKES){const g=goods[k]||{},n=log[k]||0,cell=el('div',null,{class:n?'got':'missing',title:(g.name||k)+(n?' ×'+n:' — not yet found')});const icon=el('span',null,{class:'item-icon'});icon.innerHTML=n?g.icon||'':'?';cell.append(icon,el('small',n?g.name:'???'));grid.append(cell)}
   body.append(el('p','Treasure log: '+KEEPSAKES.filter(k=>log[k]).length+'/'+KEEPSAKES.length+' keepsakes',{class:'explore-count'}),grid);if((j.stats?.titles||[]).length)body.append(el('p','Titles: '+j.stats.titles.join(', ')))}
  else if(tab==='bosses')drawBossJournal(body,el,bosses);
  else if(tab==='emotes'){body.append(el('p','Some clues ask for an emote at a place.',{class:'explore-muted'}));const row=el('div',null,{class:'explore-emotes'});for(const [k,label] of Object.entries(EMOTES)){const b=el('button',label,{type:'button'});b.onclick=()=>emote(k);row.append(b)}body.append(row)}
 }
 // ------------------------------------------------------------------------- clue reader
 function showClue(c){if(!doc?.body)return say(c?.step?.text||'');if(!reader){reader=el('dialog',null,{class:'explore-reader','aria-label':'Clue scroll'});doc.body.append(reader)}reader.replaceChildren();
  const s=c.step||{};reader.append(el('h2',TIER_LABEL[c.tier]+' clue'),el('p','Step '+((c.idx??0)+1)+' of '+(c.total||'?'),{class:'explore-muted'}));
  if(s.type==='map'&&s.map){const cv=el('canvas',null,{width:'260',height:'200','aria-label':'Map fragment'});reader.append(cv);const g=cv.getContext?.('2d');if(g)drawClueMap(g,260,200,s.map,{id:s.id})}
  reader.append(el('p',s.text||'',{class:'explore-riddle'}));
  const acts=el('div',null,{class:'explore-actions'});
  if(['dig','map','bearing'].includes(s.type)){const b=el('button','Dig here',{type:'button'});b.onclick=()=>{reader.close();dig()};acts.append(b)}
  if(s.type==='emote'){for(const [k,label] of Object.entries(EMOTES)){const b=el('button',label,{type:'button'});b.onclick=()=>{reader.close();emote(k)};acts.append(b)}}
  if(s.type==='talk')acts.append(el('span','Find '+(s.npcName||'them')+' and talk to them.',{class:'explore-muted'}));
  if(s.type==='crate')acts.append(el('span','Find the crate and search it.',{class:'explore-muted'}));
  const close=el('button','Close',{type:'button'});close.onclick=()=>reader.close();acts.append(close);reader.append(acts);if(!reader.open)reader.showModal?.()}
 function showCasket(e){const items=(e.items||[]).map(r=>(r.item==='gold'?r.n.toLocaleString()+' coins':(r.n>1?r.n+' × ':'')+(goods[r.item]?.name||r.item))+(r.rare?' ✦':''));toast(TIER_LABEL[e.tier]+' casket opened',items.join(', ')+(e.bank?' (some went to your bank)':''),'reward')}
 // --------------------------------------------------------------------------- actions
 const dig=()=>command('explore_dig',{});
 const emote=k=>command('explore_emote',{emote:k});
 const readClue=tier=>command('explore_clue',{tier});
 const openCasket=tier=>command('explore_open',{tier});
 function activeStep(type){return (journal?.clues||[]).map(c=>c.step).find(s=>s?.type===type)}
 // ------------------------------------------------------------------------------ events
 function milestoneToasts(list){for(const m of list||[])toast('Milestone: '+m.at+' '+(m.kind==='lore'?'lore read':m.kind==='place'?'places found':'clues solved'),(m.amount?m.amount.toLocaleString()+' XP lamp — rub it in the Quests tab':'')+(m.title?' · Title: '+m.title:''),'milestone')}
 function clueResult(c){if(!c)return false;if(c.done){toast('Treasure found!','You receive a '+(goods[c.casket]?.name||'casket')+'. Open it from your inventory.','reward');milestoneToasts(c.milestones)}else showClue(c);return true}
 const api={
  get journal(){return journal},refresh,openPanel,showClue,toast,dig,emote,
  tagHit(hit,d){if(!hit||!d)return;const u=hit.userData;
   if(d.lore&&LORE_MODELS[d.template]){u.kind='lore';u.lore=d.lore;u.name=d.name;hit.scale.set(1.6,1.6,1.6);const root=hit.parent;if(root){root.userData.exploreLore=d.lore;if(!loreRoots.includes(root))loreRoots.push(root);updateMotes()}}
   else if(d.crate){u.kind='crate';u.crate=d.crate;u.name=d.name}},
  label(a){return a.kind==='lore'?'Read '+a.name:a.kind==='crate'?'Search '+a.name:null},
  click(hit,e,{approachAndAct,menuAt}){const a=hit?.object?.userData;if(!a||(a.kind!=='lore'&&a.kind!=='crate'))return false;const target=a.worldEntityId||a.realmId;
   const go=()=>approachAndAct({x:a.x,z:a.z,reach:a.kind==='lore'?2.6:1.8,label:api.label(a),act:()=>command(a.kind==='lore'?'explore_read':'explore_search',{target})});
   const examine=()=>say(a.kind==='lore'?a.name+(found('lore',a.lore)?' — you have read this.':' — something is written here.'):a.name+'. Someone might hide something in it.');
   if(e?.button===2)menuAt(e.clientX,e.clientY,[[api.label(a),go],['Examine',examine],['Cancel',()=>{}]]);else go();return true},
  // An NPC dialogue opened: if a clue asks for this person, tell the server (dialogue carries on).
  talk(npcId,profile){const s=activeStep('talk');if(s&&npcId&&(!s.npcName||s.npcName===profile?.name))void command('explore_talk',{target:npcId});return false},
  itemChoices(id){const t=tierOfItem(id);if(t&&CLUE_ITEM[t]===id)return [['Read '+goods[id].name,()=>readClue(t)]];if(t)return [['Open '+goods[id].name,()=>openCasket(t)]];if(id==='spade')return [['Dig',dig]];return []},
  useItem(id){const t=tierOfItem(id);if(t&&CLUE_ITEM[t]===id){readClue(t);return true}if(t){openCasket(t);return true}if(id==='spade'&&(activeStep('dig')||activeStep('map')||activeStep('bearing'))){dig();return true}return false},
  event(e,selfId,{player:self,remoteRoot=()=>null}={}){if(e?.type!=='explore')return false;const mine=e.player===selfId;
   if(e.what==='emote'){const root=mine?self||player:remoteRoot(e.player);if(root)emotes.push({root,kind:e.emote,start:now()});if(mine&&!e.clue)say('You '+(EMOTES[e.emote]||e.emote).toLowerCase()+'.')}
   if(!mine)return true;
   if(e.what==='read'){toast(e.name,e.new?'Lore '+e.count+'/'+((journal?.lore||[]).length||TOTALS.lore):'',e.new?'lore':'');if(doc?.body){showLore(e)}milestoneToasts(e.milestones)}
   else if(e.what==='visit'){if(e.new){toast('Area discovered',e.name,'place');milestoneToasts(e.milestones)}}
   else if(e.what==='clue')clueResult(e.clue);
   else if(e.what==='dig'){if(!clueResult(e.clue))say('You dig, but find nothing but worms.')}
   else if(e.what==='search'){if(!clueResult(e.clue))say('Nothing in the crate but sawdust and a very offended spider.')}
   else if(e.what==='talk'){if(e.reply)say(e.reply);clueResult(e.clue)}
   else if(e.what==='emote')clueResult(e.clue);
   else if(e.what==='open')showCasket(e);
   void refresh();return true},
  frame(dt,self=player){const p=self?.position;if(!p)return;const t=now();
   if(t>=nextScan&&journal?.on){nextScan=t+1000;for(const id of placeAt(PLACES,p))if(!found('place',id)&&(asked.get(id)||0)<t){asked.set(id,t+15000);void globalThis.eldervaleRealm?.quietCommand?.('explore_visit',{id}).then(r=>{if(r)void refresh()})}}
   const time=t*.001;for(let i=0;i<loreRoots.length;i++){const r=loreRoots[i];if(!r.parent){loreRoots.splice(i--,1);continue}const dx=r.position.x-p.x,dz=r.position.z-p.z;if(dx*dx+dz*dz<3600)animateExploreModel(r,time)}
   for(let i=emotes.length-1;i>=0;i--){const m=emotes[i],k=(t-m.start)/1600;const lift=k>=1?0:m.kind==='dance'||m.kind==='cheer'?Math.abs(Math.sin(k*Math.PI*4))*.35:m.kind==='kneel'||m.kind==='bow'?-Math.sin(k*Math.PI)*.25:m.kind==='wave'||m.kind==='clap'?Math.abs(Math.sin(k*Math.PI*6))*.08:0;
    // The game may re-place the root each frame; only undo our own last lift if it did not.
    const base=m.root.position.y===m.lastY?m.root.position.y-(m.lift||0):m.root.position.y;m.root.position.y=base+lift;m.lift=lift;m.lastY=m.root.position.y;if(k>=1||!m.root.parent){emotes.splice(i,1);continue}if(m.kind==='dance')m.root.rotation.y+=dt*6}},
  // World map: discovered places (and hidden entrances once found).
  mapPois(){return (journal?.places||[]).filter(p=>p.found&&Number.isFinite(p.x)&&Math.abs(p.x)<=420&&Math.abs(p.z)<=420).map(p=>({kind:p.type==='hidden'||p.type==='region'?'hidden':'discovered',x:p.x,z:p.z,name:p.name}))},
  // Minimap: a small gold diamond on each discovered place in view.
  drawMinimap(ctx,toX,toY,w,h){if(!journal)return;ctx.fillStyle='#f2d36b';ctx.strokeStyle='#2a1d08';ctx.lineWidth=1;for(const p of journal.places){if(!p.found||!Number.isFinite(p.x))continue;const x=toX(p.x),y=toY(p.z);if(x<3||y<3||x>w-3||y>h-3)continue;ctx.beginPath();ctx.moveTo(x,y-4);ctx.lineTo(x+4,y);ctx.lineTo(x,y+4);ctx.lineTo(x-4,y);ctx.closePath();ctx.fill();ctx.stroke()}}
 };
 function showLore(e){if(!reader){reader=el('dialog',null,{class:'explore-reader','aria-label':'Lore'});doc.body.append(reader)}reader.replaceChildren(el('h2',e.name),el('p',e.text||'',{class:'explore-lore'}));const b=el('button','Close',{type:'button'});b.onclick=()=>reader.close();reader.append(b);if(!reader.open)reader.showModal?.()}
 void refresh();
 return api;
}
