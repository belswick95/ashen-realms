// OSRS-style backpack order. The save (game_flags.inventoryOrder, db/inventory-order.sql)
// stores only *where* each item sits: an array of 28 item ids or null. What the player
// owns still comes from the authoritative counts, so a stale or edited order can never
// add, remove or duplicate an item: arrangeInventory() just places the real items,
// keeping each one in its remembered slot, leaving gaps where items went, and putting
// new items into the first empty slot.
export const ORDER_SIZE=28;
// Item ids as goods[] names them: wood, cookedTrout, note:wood, armor:bronzeHelm, mount:armoredWhiteHorse.
export const ORDER_ID=/^[A-Za-z0-9][A-Za-z0-9_:.-]{0,63}$/;

export function sanitizeOrder(raw,size=ORDER_SIZE){
 const list=Array.isArray(raw)?raw:[];
 return Array.from({length:size},(_,i)=>typeof list[i]==='string'&&ORDER_ID.test(list[i])?list[i]:null);
}
export const sameOrder=(a,b)=>a.length===b.length&&a.every((v,i)=>v===b[i]);

// items: what the backpack really holds, one entry per slot (a stack is one entry), each {id,...}.
// previous: the last order. vacate: slots to empty first when an id now has fewer items
// than remembered slots (the slot the player just ate from, dropped, or deposited).
export function arrangeInventory(items,previous,{size=ORDER_SIZE,vacate=[]}={}){
 const prev=sanitizeOrder(previous,size),slots=Array(size).fill(null),pools=new Map();
 for(const item of items){if(!pools.has(item.id))pools.set(item.id,[]);pools.get(item.id).push(item)}
 const placed=new Set();
 for(const [id,pool] of pools){
  let at=prev.flatMap((v,i)=>v===id?[i]:[]);
  for(const v of vacate){if(at.length<=pool.length)break;if(at.includes(v))at=at.filter(i=>i!==v)}
  at=at.slice(0,pool.length);
  for(const i of at){const item=pool.shift();slots[i]=item;placed.add(item)}
 }
 const overflow=[];let free=0;
 for(const item of items){if(placed.has(item))continue;while(free<size&&slots[free])free++;if(free<size)slots[free]=item;else overflow.push(item)}
 return {slots,order:slots.map(s=>s?s.id:null),overflow};
}

// Dragging slot `from` onto slot `to`: swap them (onto an empty slot that is a move).
export function moveSlot(order,from,to){
 const next=[...order];
 if(!Number.isInteger(from)||!Number.isInteger(to)||from===to||from<0||to<0||from>=next.length||to>=next.length||next[from]==null)return next;
 [next[from],next[to]]=[next[to],next[from]];return next;
}

// Persists the order with one small command after the player settles: soon after a
// drag, lazily after an order change that came from gaining or losing items.
export function createOrderSync({send,setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id),soon=600,later=4000,maxFailures=3}={}){
 let saved=null,wanted=null,timer=null,due=Infinity,failures=0,inFlight=false;
 const key=o=>JSON.stringify(o);
 async function flush(){
  timer=null;due=Infinity;if(wanted==null||wanted===saved||inFlight||failures>=maxFailures)return;
  const body=wanted;inFlight=true;let ok=false;try{ok=await send(JSON.parse(body))!==false}catch{ok=false}inFlight=false;
  if(ok){saved=body;failures=0}else failures++;
  if(wanted!==saved&&failures<maxFailures)schedule(JSON.parse(wanted),{urgent:ok});
 }
 function schedule(order,{urgent=false}={}){
  wanted=key(order);if(wanted===saved){if(timer!=null)clearTimer(timer);timer=null;due=Infinity;return}
  const now=Date.now(),at=now+(urgent?soon:later);if(timer!=null&&due<=at)return;
  if(timer!=null)clearTimer(timer);due=at;timer=setTimer(()=>void flush(),at-now);
 }
 // The order the server already holds (from the save), so an unchanged order is never re-sent.
 function known(order){saved=key(order);failures=0}
 return {schedule,known,flush,get pending(){return wanted!=null&&wanted!==saved}};
}

// Drag to rearrange. Mouse: press and move. Touch: press, hold briefly, then move; a hold
// without moving is left to touch-menus.js, which opens the context menu at 480 ms.
// A plain tap or click is never touched, so use/equip/eat stay as they were.
export const DRAG_HOLD_MS=170,DRAG_SLOP=8;
export function installInventoryDrag(container,{onMove,closeMenu=()=>{},doc=container.ownerDocument,holdMs=DRAG_HOLD_MS,slop=DRAG_SLOP}={}){
 if(container.eldervaleDrag)return container.eldervaleDrag;
 const view=doc.defaultView;let press=null,swallowUntil=0;
 const slotAt=(x,y)=>{const el=doc.elementFromPoint(x,y)?.closest?.('.slot');return el&&el.parentElement===container?el:null};
 // Held long enough, judged by input timestamps so a busy main thread cannot turn a swipe into a drag.
 const held=(p,e)=>!p.touch||e.timeStamp-p.t0>=holdMs;
 const indexOf=el=>el?[...container.children].indexOf(el):-1;
 const clearMarks=()=>{for(const el of container.querySelectorAll('.drag-source,.drag-over'))el.classList.remove('drag-source','drag-over')};
 function end(drop){
  const p=press;press=null;if(!p)return;
  p.ghost?.remove();clearMarks();doc.body.classList.remove('inventory-dragging');
  if(!p.dragging)return;
  swallowUntil=Date.now()+400;
  if(drop){const to=indexOf(slotAt(drop.x,drop.y));if(to>=0&&to!==p.from)onMove(p.from,to,p.id)}
 }
 function begin(e){
  const p=press;p.dragging=true;doc.eldervaleLongPress?.cancel?.();closeMenu();
  const source=container.children[p.from];source?.classList.add('drag-source');doc.body.classList.add('inventory-dragging');
  const ghost=doc.createElement('div');ghost.className='inventory-drag-ghost';ghost.setAttribute('aria-hidden','true');
  ghost.innerHTML=source?.querySelector('.item-icon')?.innerHTML||'';const box=source?.getBoundingClientRect();
  if(box){ghost.style.width=box.width+'px';ghost.style.height=box.height+'px'}p.ghost=ghost;doc.body.append(ghost);follow(e);
 }
 function follow(e){const p=press;if(!p?.ghost)return;container.children[p.from]?.classList.add('drag-source');const w=p.ghost.offsetWidth||40,h=p.ghost.offsetHeight||40;p.ghost.style.transform='translate('+(e.clientX-w/2)+'px,'+(e.clientY-h/2)+'px)';
  const over=slotAt(e.clientX,e.clientY);for(const el of container.querySelectorAll('.drag-over'))if(el!==over)el.classList.remove('drag-over');if(over&&indexOf(over)!==p.from)over.classList.add('drag-over')}
 container.addEventListener('pointerdown',e=>{
  if(press)end(null);if(!e.isPrimary||(e.pointerType==='mouse'&&e.button!==0))return;
  const el=e.target.closest?.('.slot');if(!el||el.parentElement!==container||el.disabled||!el.dataset.itemId)return;
  press={from:indexOf(el),id:el.dataset.itemId,x:e.clientX,y:e.clientY,t0:e.timeStamp,touch:e.pointerType!=='mouse',dragging:false,pointer:e.pointerId};
 });
 doc.addEventListener('pointermove',e=>{
  const p=press;if(!p||e.pointerId!==p.pointer)return;
  if(p.dragging){follow(e);return}
  if(Math.hypot(e.clientX-p.x,e.clientY-p.y)<=slop)return;
  // Moving before the hold is a scroll or a swipe, not a drag.
  if(!held(p,e)){end(null);return}
  begin(e);
 },{passive:true});
 doc.addEventListener('pointerup',e=>{if(press&&e.pointerId===press.pointer)end({x:e.clientX,y:e.clientY})},true);
 doc.addEventListener('pointercancel',e=>{if(press&&e.pointerId===press.pointer)end(null)},true);
 // Once the hold is reached the finger owns the gesture: stop iOS/Android from scrolling the panel.
 container.addEventListener('touchmove',e=>{if(press&&(press.dragging||held(press,e))&&e.cancelable)e.preventDefault()},{passive:false});
 // The click that ends a drag must not also use or equip the item.
 doc.addEventListener('click',e=>{if(Date.now()<swallowUntil){swallowUntil=0;e.preventDefault();e.stopImmediatePropagation()}},true);
 doc.addEventListener('contextmenu',e=>{if(press?.dragging){e.preventDefault();e.stopImmediatePropagation()}},true);
 view?.addEventListener?.('blur',()=>end(null));
 return container.eldervaleDrag={cancel:()=>end(null),get dragging(){return !!press?.dragging}};
}
