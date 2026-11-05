// RuneScape-style death for Eldervale. The server (db/osrs-death.sql) decides what is kept and
// drops the rest; this module mirrors the keep rule for the "Items kept on death" preview, runs the
// client side of a death (input lock, death pose timing, "Oh dear, you are dead!", jingle) and
// tracks the player's death pile for the world map.
//
// Rules (OSRS): keep the 3 most valuable single item units — a stack is valued per unit, so 300
// arrows are 300 units at the arrow price; worn and carried items both count; coins count at 1 gold
// each. Ties: worn first, then item id. Items flagged untradeable / questItem / keepOnDeath are
// always kept and do not use a place. Everything else drops where you fell, for anyone to loot,
// and vanishes after 15 minutes.
export const KEEP_ON_DEATH=3;
export const DEATH_PILE_MS=15*60*1000;
export const DEATH_POSE_MS=2800;
const FIELDS=['armorOwned','weaponsOwned','shieldsOwned','jewelryOwned','mountsOwned'];
const num=v=>Number.isFinite(Number(v))?Number(v):0;
export function isProtected(item){return !!(item&&(item.untradeable===true||item.questItem===true||item.keepOnDeath===true))}
export function unitValue(id,goods={}){if(id==='gold')return 1;const g=goods[id];if(!g)return 0;const v=num(g.buy);return v>0?v:num(goods[g.noteOf]?.buy)}

// entries: [{item, amount, value, equipped?, protected?}] → {kept, dropped}, each [{item, amount, ...}].
export function pickKeptItems(entries,{keep=KEEP_ON_DEATH}={}){
 const list=entries.filter(e=>e&&e.item&&Math.floor(num(e.amount))>0).map(e=>({...e,amount:Math.floor(num(e.amount)),value:num(e.value),equipped:!!e.equipped,protected:!!e.protected}));
 list.sort((a,b)=>(b.protected-a.protected)||(b.value-a.value)||(b.equipped-a.equipped)||(a.item<b.item?-1:a.item>b.item?1:0));
 let left=Math.max(0,Math.floor(keep));const kept=[],dropped=[];
 for(const e of list){const k=e.protected?e.amount:Math.min(e.amount,left);if(!e.protected)left-=k;
  if(k>0)kept.push({item:e.item,amount:k,value:e.value,protected:e.protected});
  if(e.amount>k)dropped.push({item:e.item,amount:e.amount-k,value:e.value,equipped:e.equipped&&k===0});}
 return {kept,dropped};
}

// Everything the player carries or wears, from the client state (economy.js shapes).
export function carriedEntries(state,goods){
 const out=[],worn=(field,key)=>field==='armorOwned'?!!state.equipped?.[key]:field==='weaponsOwned'?state.equippedWeapon===key:field==='shieldsOwned'?state.equippedShield===key:field==='mountsOwned'?state.equippedMount===key:state.amulet===key||state.trinket===key;
 const byKey=new Map();for(const [id,g] of Object.entries(goods))if(g.field)byKey.set(g.field+':'+g.key,id);
 for(const field of FIELDS){const counts=new Map();for(const key of state[field]||[])counts.set(key,(counts.get(key)||0)+1);
  for(const [key,n] of counts){const id=byKey.get(field+':'+key);if(!id)continue;out.push({item:id,amount:n,value:unitValue(id,goods),equipped:worn(field,key),protected:isProtected(goods[id])})}}
 for(const [id,g] of Object.entries(goods)){if(g.field)continue;const n=Math.floor(num(state[id]));if(n>0)out.push({item:id,amount:n,value:unitValue(id,goods),protected:isProtected(g)})}
 if(num(state.gold)>0)out.push({item:'gold',amount:Math.floor(num(state.gold)),value:1});
 return out;
}
export function keptOnDeath(state,goods,options){return pickKeptItems(carriedEntries(state,goods),options)}

export function formatCountdown(ms){const s=Math.max(0,Math.ceil(num(ms)/1000));return Math.floor(s/60)+':'+String(s%60).padStart(2,'0')}
export function itemLabel(entry,goods={}){const name=entry.name||(entry.item==='gold'?'Coins':goods[entry.item]?.name||entry.item);return entry.amount>1?entry.amount.toLocaleString('en-US')+' × '+name:name}
export function keptMessage(kept=[],goods={}){const list=kept.filter(k=>k&&k.item);return list.length?'You kept: '+list.map(k=>itemLabel(k,goods)).join(', ')+'.':'You kept nothing.'}

// The pile on the ground, from the save's game_flags.deathPile. null once expired or looted.
export function pileStatus(pile,now,{gone=false}={}){
 if(!pile||gone||!Number.isFinite(num(pile.x))||!Number.isFinite(num(pile.z)))return null;
 const expires=Date.parse(pile.expiresAt);if(!Number.isFinite(expires))return null;const remaining=expires-now;if(remaining<=0)return null;
 return {x:num(pile.x),z:num(pile.z),floor:num(pile.floor),remainingMs:remaining,label:'Your items · '+formatCountdown(remaining)};
}
// Looted empty: the pile spot is inside the area the server reports drops for, and none of the
// pile's drops are still there.
export function pileLooted(pile,drops,me,radius=180){
 if(!pile||!Array.isArray(pile.ids)||!pile.ids.length||!Array.isArray(drops)||!me)return false;
 if(Math.hypot(num(pile.x)-me.x,num(pile.z)-me.z)>radius)return false;
 const ids=new Set(pile.ids.map(String));return !drops.some(d=>ids.has(String(d.id)));
}

// OSRS-like "Items kept on death" view for the equipment tab.
let keptViewOpen=false;
export function renderKeptOnDeath(doc,state,goods){
 const {kept,dropped}=keptOnDeath(state,goods),box=doc.createElement('details');box.className='kept-on-death';box.open=keptViewOpen;box.addEventListener('toggle',()=>{keptViewOpen=box.open});
 const summary=doc.createElement('summary');summary.textContent='Items kept on death';const list=doc.createElement('ul');
 for(const k of kept){const li=doc.createElement('li');const icon=doc.createElement('span');icon.className='item-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML=k.item==='gold'?'🪙':goods[k.item]?.icon||'';const text=doc.createElement('span');text.textContent=itemLabel(k,goods)+(k.protected?' (always kept)':'');li.append(icon,text);list.append(li)}
 if(!kept.length){const li=doc.createElement('li');li.textContent='Nothing carried.';list.append(li)}
 const lost=dropped.reduce((t,d)=>t+d.amount,0),note=doc.createElement('p');
 note.textContent='You keep your '+KEEP_ON_DEATH+' most valuable items. '+(lost?lost.toLocaleString('en-US')+' other item'+(lost===1?'':'s')+' would drop where you fall: anyone can take them, and they vanish after 15 minutes.':'Nothing else would drop.')+' Your bank is always safe.';
 box.append(summary,list,note);return box;
}

// Client half of a death. `deps`: {doc, say, jingle(kind), now(), goods}.
export function createDeathFlow({doc=globalThis.document,say=()=>{},jingle=()=>{},now=()=>Date.now(),goods={}}={}){
 let dyingUntil=0,pile=null,goneKey='',overlay=null;const remote=new Map();
 const pileKey=p=>p?String(p.diedAt||p.expiresAt):'';
 function showOverlay(show){if(!doc?.body)return;if(!overlay){overlay=doc.createElement('div');overlay.className='death-overlay';overlay.setAttribute('role','alert');overlay.innerHTML='<p>Oh dear, you are dead!</p>';
   // Swallow every click and key while the death pose plays.
   const stop=e=>{if(!overlay.hidden){e.preventDefault();e.stopPropagation()}};for(const t of ['pointerdown','pointerup','click','contextmenu','touchstart','wheel'])overlay.addEventListener(t,stop,{passive:false});
   doc.defaultView?.addEventListener('keydown',e=>{if(dyingUntil>now()&&!['INPUT','TEXTAREA'].includes(e.target?.tagName)){e.preventDefault();e.stopImmediatePropagation()}},true);
   doc.body.append(overlay)}
  overlay.hidden=!show;overlay.classList.toggle('show',!!show)}
 const api={
  get locked(){return dyingUntil>now()},
  dying(){return dyingUntil>now()},
  remoteDying(id){return (remote.get(id)||0)>now()},
  event(e,isSelf){
   if(e.type==='player_death'){
    if(!isSelf){remote.set(e.player,now()+DEATH_POSE_MS+400);return}
    // Fallback unlock a little after the server's respawn, in case its event is missed.
    dyingUntil=now()+DEATH_POSE_MS+1200;showOverlay(true);jingle('death');
    if(e.expiresAt)pile={x:e.x,z:e.z,floor:e.floor,expiresAt:e.expiresAt,diedAt:e.respawnAt,ids:null,kept:e.kept};
    api.lastKept=e.kept||[];return}
   if(e.type==='player_respawn'){
    if(!isSelf){remote.delete(e.player);return}
    dyingUntil=0;showOverlay(false);say('Oh dear, you are dead!');say(keptMessage(e.kept||api.lastKept||[],goods));
    if(pile)say('Your other items lie where you fell for 15 minutes. Anyone can pick them up. Check the world map.');}
  },
  // Each snapshot: the authoritative pile and the drops the server can see around us.
  sync(self,drops,me){if(!self)return;const p=self.game_flags?.deathPile||null;
   // The save is authoritative; a pile known only from the death event waits for it.
   if(p)pile=p;else if(pile?.ids)pile=null;
   if(pile&&pileLooted(pile,drops,me))goneKey=pileKey(pile)},
  pile(){return pileStatus(pile,now(),{gone:!!pile&&goneKey===pileKey(pile)})},
  update(){if(overlay&&!overlay.hidden&&dyingUntil<=now())showOverlay(false)}
 };
 return api;
}
