// The in-game skill guide (OSRS style): click a skill in the Skills panel and a guide opens with
// what each level unlocks, in category tabs. The rows come from skill-guide-data.js (the game's own
// item, recipe and SQL-mirrored definitions), so the guide follows every change without edits here.
// Rows you can already do are bright with a check; locked rows are dimmed with the level needed.
// "Where" hints point at the nearest matching world-map marker (map-icons.js, through
// window.eldervaleMapMarkers) and open the map there; with no matching marker the hint is left out.
// A modal <dialog>: Esc closes it, focus stays inside, and it fits phones (safe areas, both
// orientations) with the close button always in reach. Only the open tab is drawn, in small batches.
import {skillGuide,GUIDE_SKILLS,hasGuide} from './skill-guide-data.js?v=release-20261107-ui139';
import {goods} from './economy.js?v=release-20261107-ui139';
import {ORE_TIERS} from './map-icons.js?v=release-20261107-ui139';

const SKILL_NAMES=Object.fromEntries(GUIDE_SKILLS.map(s=>[s.id,s.name]));
// Map markers name mines by their ore tier's short key ("Copper-to-runite mine"); the guide shows
// the catalog's Eldervale metal names instead ("Copper-to-tidestone mine").
const ORE_WORDS=Object.entries(ORE_TIERS).filter(([id])=>id!=='runeEssence').map(([id,t])=>[t.short,(goods[id]?.name||'').replace(/ ore$/i,'').toLowerCase()]).filter(([a,b])=>a&&b&&a!==b);
export function localName(name){let out=String(name||'');for(const [from,to] of ORE_WORDS)out=out.replace(new RegExp('\\b'+from+'\\b','gi'),m=>m[0]===m[0].toUpperCase()?to[0].toUpperCase()+to.slice(1):to);return out}
const CSS=`
.skill-guide{width:min(640px,calc(100vw - 16px - env(safe-area-inset-left) - env(safe-area-inset-right)));max-width:none;max-height:calc(100dvh - 16px - env(safe-area-inset-top) - env(safe-area-inset-bottom));padding:0;margin:auto;display:flex;flex-direction:column;overflow:hidden;background:linear-gradient(160deg,#2c3630,#171e1a);color:#e6d8ae;border:2px solid #8a7548;border-radius:6px;box-shadow:0 0 0 1px #000,inset 0 1px #c6ad7240,0 24px 80px #000c;font:13px/1.4 Arial,sans-serif}
.skill-guide:not([open]){display:none}
.skill-guide::backdrop{background:#050806b3}
.sg-head{display:flex;align-items:center;gap:10px;padding:10px 10px 8px 12px;background:linear-gradient(#3b4537,#262f29);border-bottom:1px solid #8a754880;flex:0 0 auto}
.sg-glyph{font-size:28px;width:38px;height:38px;display:grid;place-items:center;border:1px solid #65583e;border-radius:4px;background:#1b231e;filter:drop-shadow(0 1px 2px #000)}
.sg-title{flex:1;min-width:0}
.sg-title h2{margin:0;font:bold 20px Georgia,serif;color:#f5d58b;text-shadow:1px 1px #000}
.sg-title p{margin:1px 0 0;font-size:12px;color:#c8c3a5;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.sg-close{flex:0 0 auto;width:40px;height:40px;border:1px solid #8a7548;border-radius:4px;background:#3a2a1c;color:#f5d58b;font:bold 20px Arial;cursor:pointer}
.sg-close:hover,.sg-close:focus-visible{background:#5b3d25;outline:2px solid #f5d58b;outline-offset:1px}
.sg-intro{margin:0;padding:7px 12px;font-size:12px;color:#cfc7a6;border-bottom:1px solid #8a754840;flex:0 0 auto}
.sg-tabs{display:flex;flex-wrap:wrap;gap:3px;padding:6px 8px 0;overflow-x:auto;scrollbar-width:thin;flex:0 0 auto;border-bottom:1px solid #8a7548}
.sg-tabs button{flex:0 0 auto;min-height:32px;padding:5px 11px;border:1px solid #65583e;border-bottom:0;border-radius:4px 4px 0 0;background:#202a24;color:#b9b596;font:bold 12px Arial;cursor:pointer}
.sg-tabs button[aria-selected=true]{background:#46513e;color:#f5d58b;border-color:#d2b477}
.sg-tabs button:focus-visible{outline:2px solid #f5d58b;outline-offset:-2px}
.sg-rows{flex:1 1 auto;min-height:0;overflow-y:auto;overscroll-behavior:contain;padding:6px 8px calc(8px + env(safe-area-inset-bottom));-webkit-overflow-scrolling:touch}
.sg-rows:focus-visible{outline:2px solid #d2b47780;outline-offset:-3px}
.sg-row{display:grid;grid-template-columns:38px 40px 1fr auto;align-items:center;gap:8px;padding:6px 6px;border-bottom:1px solid #89775033;content-visibility:auto;contain-intrinsic-size:auto 54px}
.sg-row:nth-child(odd){background:#ffffff06}
.sg-lv{font:bold 15px Georgia,serif;color:#f5d58b;text-align:center;text-shadow:1px 1px #000}
.sg-ico{width:40px;height:40px;display:grid;place-items:center;font-size:24px;background:#141b17;border:1px solid #4d4532;border-radius:4px}
.sg-ico .item-mesh-icon{width:36px;height:36px}
.sg-ico svg{width:34px;height:34px}
.sg-txt{min-width:0}
.sg-txt strong{display:block;color:#f0e2b6;font-size:13px}
.sg-txt small{display:block;color:#bdb79a;font-size:11.5px;overflow-wrap:anywhere}
.sg-txt .sg-also{color:#e0b06a}
.sg-where{margin-top:3px;padding:2px 7px;min-height:24px;border:1px solid #6b7a5a;border-radius:10px;background:#22301f;color:#bfe0a0;font:11px Arial;cursor:pointer}
.sg-where:hover,.sg-where:focus-visible{background:#33482d;outline:1px solid #bfe0a0}
.sg-state{font:bold 11px Arial;text-align:center;min-width:34px}
.sg-row.done .sg-state{color:#7fd46a;font-size:17px}
.sg-row.locked{opacity:.5}
.sg-row.locked .sg-ico{filter:grayscale(.75)}
.sg-row.locked .sg-state{color:#d88f6a}
.sg-where-bar{display:flex;align-items:center;gap:6px;padding:4px 6px 6px;color:#bdb79a;font-size:11.5px;border-bottom:1px solid #89775033}
.sg-where-bar .sg-where{margin:0}
.sg-empty{padding:16px;color:#bdb79a;text-align:center}
.sg-foot{display:flex;align-items:center;gap:8px;flex-wrap:wrap;padding:6px 10px calc(6px + env(safe-area-inset-bottom));border-top:1px solid #8a754880;background:#1a211c;flex:0 0 auto;font-size:11px;color:#9f9a80}
.sg-foot button{min-height:32px;padding:4px 10px;border:1px solid #8a7548;border-radius:4px;background:#3b4537;color:#f5d58b;font:bold 12px Arial;cursor:pointer}
.sg-foot span{flex:1;min-width:160px}
@media (max-width:520px),(max-height:500px){.sg-tabs{flex-wrap:nowrap}}
@media (max-width:520px){.skill-guide{width:calc(100vw - 8px - env(safe-area-inset-left) - env(safe-area-inset-right));max-height:calc(100dvh - 8px - env(safe-area-inset-top) - env(safe-area-inset-bottom))}.sg-row{grid-template-columns:30px 36px 1fr auto;gap:6px;padding:6px 3px}.sg-ico{width:36px;height:36px}.sg-ico .item-mesh-icon{width:32px;height:32px}.sg-lv{font-size:13px}.sg-foot span{display:none}}
@media (max-height:500px){.sg-intro,.sg-foot span{display:none}.sg-head{padding:5px 8px}.sg-glyph{width:30px;height:30px;font-size:20px}.sg-title h2{font-size:16px}.sg-close{width:36px;height:36px}.sg-tabs{padding-top:4px}.sg-tabs button{min-height:28px;padding:3px 9px}.sg-foot{padding-top:3px;padding-bottom:calc(3px + env(safe-area-inset-bottom))}.sg-row{padding:4px 6px}}
`;
function injectStyle(doc){if(doc.getElementById('skill-guide-style'))return;const s=doc.createElement('style');s.id='skill-guide-style';s.textContent=CSS;doc.head.append(s)}
const el=(doc,tag,cls,text)=>{const n=doc.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};

// The nearest map marker for a row's `where` ({cat, tier?, tiers?, name?}), or null.
export function findMarker(where,markers,at=null){
 if(!where||!Array.isArray(markers))return null;
 const word=s=>String(s||'').toLowerCase().split(/\s+/).pop();
 const hits=markers.filter(c=>{if(!c||c.cat!==where.cat||!Number.isFinite(c.x)||!Number.isFinite(c.z))return false;
  if(where.tier)return (c.tierNames||[]).includes(where.tier)||(c.members||[]).some(m=>m.tierNames?.includes(where.tier));
  if(where.tiers)return (c.members||[]).some(m=>where.tiers.includes(m.tier))||where.tiers.includes(c.tier);
  if(where.name&&(where.cat==='agility'||where.cat==='skill'))return (c.names||[c.name]).some(n=>where.cat==='agility'?n===where.name:word(n)===word(where.name));
  return true});
 if(!hits.length)return null;if(!at)return hits[0];
 return hits.reduce((best,c)=>Math.hypot(c.x-at.x,c.z-at.z)<Math.hypot(best.x-at.x,best.z-at.z)?c:best);
}

export function createSkillGuide({doc=document,level=()=>1,position=()=>null,showOnMap=null,recipesFor=null,markers=()=>globalThis.window?.eldervaleMapMarkers?.items?.()||[]}={}){
 injectStyle(doc);
 const dialog=el(doc,'dialog','skill-guide');dialog.setAttribute('aria-labelledby','sg-title');dialog.id='skill-guide';
 const head=el(doc,'header','sg-head'),glyph=el(doc,'span','sg-glyph'),title=el(doc,'div','sg-title'),h2=el(doc,'h2'),sub=el(doc,'p'),close=el(doc,'button','sg-close','×');
 glyph.setAttribute('aria-hidden','true');h2.id='sg-title';close.type='button';close.setAttribute('aria-label','Close skill guide');title.append(h2,sub);head.append(glyph,title,close);
 const intro=el(doc,'p','sg-intro'),tabs=el(doc,'div','sg-tabs'),rows=el(doc,'div','sg-rows'),foot=el(doc,'footer','sg-foot');
 tabs.setAttribute('role','tablist');tabs.setAttribute('aria-label','Guide categories');rows.setAttribute('role','tabpanel');rows.tabIndex=0;rows.id='sg-panel';
 dialog.append(head,intro,tabs,rows,foot);doc.body.append(dialog);
 let guide=null,current=null,tabIndex=0,previousFocus=null,batch=0,markerList=null;
 const cache=new Map();let cacheKey=null;
 const recipesKey=()=>{const r=globalThis.window?.eldervaleSkillRecipes;return r?Object.keys(r).length+':'+Object.values(r).reduce((n,x)=>n+(Number(x?.level)||0)+(x?.enabled===false?1000:0),0):'base'};
 function guideFor(id){const k=recipesKey();if(k!==cacheKey){cache.clear();cacheKey=k}if(!cache.has(id))cache.set(id,skillGuide(id));return cache.get(id)}
 const lv=id=>Math.max(1,Number(level(id))||1);
 const canDo=r=>lv(current)>=r.level&&Object.entries(r.also||{}).every(([s,n])=>lv(s)>=n);
 const markerFor=r=>{if(!r.where||!showOnMap)return null;if(!markerList){try{markerList=markers()||[]}catch{markerList=[]}}return findMarker(r.where,markerList,position())};
 function whereLink(c){const name=localName(c.name),b=el(doc,'button','sg-where','📍 '+name+' (map)');b.type='button';b.title='Show '+name+' on the world map';
  b.onclick=()=>{api.close();showOnMap({x:c.x,z:c.z,label:name})};return b}
 // When every row of a tab points at the same place (all smithing at one anvil), one hint sits above the rows.
 function sharedWhere(t){const found=t.rows.map(markerFor),hits=found.filter(Boolean);if(hits.length<2||!hits.every(c=>c===hits[0]))return {found,bar:null};
  const bar=el(doc,'div','sg-where-bar');bar.append(el(doc,'span',null,'Nearest:'),whereLink(hits[0]));return {found,bar}}
 let resolved=new Map(),shared=false;
 function rowNode(r){
  const done=canDo(r),row=el(doc,'div','sg-row '+(done?'done':'locked'));row.setAttribute('role','listitem');
  const lvl=el(doc,'span','sg-lv',String(r.level)),ico=el(doc,'span','sg-ico'),txt=el(doc,'div','sg-txt'),state=el(doc,'span','sg-state');
  lvl.title='Level '+r.level;
  const item=r.item&&goods[r.item];if(item?.icon)ico.innerHTML=item.icon;else ico.textContent=r.glyph||'•';
  txt.append(el(doc,'strong',null,r.name||item?.name||''));if(r.detail)txt.append(el(doc,'small',null,r.detail));
  const also=Object.entries(r.also||{});if(also.length)txt.append(el(doc,'small','sg-also','Also needs '+also.map(([s,n])=>(SKILL_NAMES[s]||s)+' '+n).join(', ')));
  const c=shared?null:resolved.get(r);if(c)txt.append(whereLink(c));
  if(done){state.textContent='✓';state.setAttribute('aria-label','Unlocked')}else{state.textContent='🔒 '+r.level;state.setAttribute('aria-label','Needs level '+r.level)}
  row.append(lvl,ico,txt,state);return row;
 }
 // Lazy: the first rows now, the rest a batch per frame (a long smithing tab never blocks opening).
 function drawRows(){
  const t=guide.tabs[tabIndex],token=++batch;rows.replaceChildren();rows.scrollTop=0;
  const list=el(doc,'div');list.setAttribute('role','list');list.setAttribute('aria-label',t?t.label:'');rows.append(list);
  if(!t){rows.append(el(doc,'p','sg-empty','Nothing to show yet.'));return}
  const sw=sharedWhere(t);shared=!!sw.bar;resolved=new Map(t.rows.map((r,i)=>[r,sw.found[i]]));if(sw.bar)rows.insertBefore(sw.bar,list);
  let i=0;const step=n=>{if(token!==batch)return;const frag=doc.createDocumentFragment();for(const end=Math.min(t.rows.length,i+n);i<end;i++)frag.append(rowNode(t.rows[i]));list.append(frag);if(i<t.rows.length)(globalThis.requestAnimationFrame||setTimeout)(()=>step(40))};
  step(16);
 }
 function selectTab(i,focus=false){tabIndex=Math.max(0,Math.min(guide.tabs.length-1,i));for(const [j,b] of [...tabs.children].entries()){const on=j===tabIndex;b.setAttribute('aria-selected',String(on));b.tabIndex=on?0:-1;if(on&&focus)b.focus()}rows.setAttribute('aria-labelledby','sg-tab-'+tabIndex);drawRows()}
 tabs.addEventListener('keydown',e=>{const k=e.key;if(!['ArrowLeft','ArrowRight','Home','End'].includes(k))return;e.preventDefault();selectTab(k==='Home'?0:k==='End'?guide.tabs.length-1:tabIndex+(k==='ArrowRight'?1:-1),true)});
 function render(){
  const L=lv(current),all=guide.tabs.flatMap(t=>t.rows),next=all.filter(r=>r.level>L).sort((a,b)=>a.level-b.level)[0];
  glyph.textContent=guide.icon;h2.textContent=guide.name+' guide';
  sub.textContent='Level '+L+(next?' · next unlock at '+next.level+': '+next.name:' · everything unlocked');
  intro.textContent=guide.intro;intro.hidden=!guide.intro;
  tabs.replaceChildren(...guide.tabs.map((t,i)=>{const b=el(doc,'button',null,t.label+' ('+t.rows.length+')');b.type='button';b.id='sg-tab-'+i;b.setAttribute('role','tab');b.setAttribute('aria-controls','sg-panel');b.onclick=()=>selectTab(i);return b}));
  tabs.hidden=guide.tabs.length<2;
  foot.replaceChildren();
  const recipes=recipesFor?.(current);if(recipes){const b=el(doc,'button',null,'Open recipes');b.type='button';b.onclick=()=>{api.close();recipes()};foot.append(b)}
  foot.append(el(doc,'span',null,'From the game data: '+guide.sources.join(', ')));
 }
 close.onclick=()=>api.close();
 dialog.addEventListener('click',e=>{if(e.target!==dialog)return;const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)api.close()});
 dialog.addEventListener('close',()=>{batch++;const f=previousFocus;previousFocus=null;if(f?.isConnected)f.focus?.({preventScroll:true})});
 // Keys pressed in the guide stay in the guide (no walking or hotkeys underneath); Esc closes it.
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape'){e.preventDefault();api.close()}e.stopPropagation()});
 dialog.addEventListener('keyup',e=>e.stopPropagation());
 const api={
  // Open a skill's guide (id: 'smithing', or a name). tab: a tab id or label to start on.
  open(id,{tab=null}={}){id=String(id||'').toLowerCase();if(!hasGuide(id))return false;const g=guideFor(id);if(!g)return false;
   if(!dialog.open)previousFocus=doc.activeElement;guide=g;current=id;markerList=null;render();
   const want=tab==null?0:g.tabs.findIndex(t=>t.id===tab||t.label.toLowerCase()===String(tab).toLowerCase());
   if(!dialog.open){try{dialog.showModal()}catch{dialog.setAttribute('open','')}}
   selectTab(want<0?0:want);close.focus({preventScroll:true});return true},
  close(){if(dialog.open)dialog.close()},
  refresh(){if(dialog.open&&current){guide=guideFor(current);render();selectTab(tabIndex)}},
  get isOpen(){return dialog.open},get skill(){return dialog.open?current:null},
  skills:GUIDE_SKILLS,element:dialog
 };
 return api;
}
