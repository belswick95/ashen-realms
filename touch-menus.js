// Touch support for right-click menus: a long press on HUD/panel items opens the
// same menu a right click would (iOS Safari never fires `contextmenu` for touch),
// and every menu is clamped inside the visible viewport.
export const LONG_PRESS_MS=480,LONG_PRESS_SLOP=10;

// Keep a fixed-position menu fully on screen (visual viewport aware), scrolling it when taller than the screen.
export function fitToViewport(el,{margin=8,view=globalThis.visualViewport,win=globalThis}={}){
 if(!el)return;const width=view?.width||win.innerWidth,height=view?.height||win.innerHeight,offsetX=view?.offsetLeft||0,offsetY=view?.offsetTop||0;
 el.style.maxHeight=Math.max(80,height-margin*2)+'px';el.style.maxWidth=Math.max(120,width-margin*2)+'px';el.style.overflowY='auto';
 const box=el.getBoundingClientRect(),left=Number.parseFloat(el.style.left)||box.left,top=Number.parseFloat(el.style.top)||box.top;
 el.style.left=clampStart(left,box.width,offsetX,width,margin)+'px';el.style.top=clampStart(top,box.height,offsetY,height,margin)+'px';
}
export function clampStart(start,size,offset,span,margin=8){const min=offset+margin,max=offset+span-margin-size;return Math.round(max<min?min:Math.min(Math.max(start,min),max))}

// Where a long press is allowed to open a menu: game panels, not the 3D canvas
// (which has its own hold gesture) and not text fields (which keep native selection).
const SCOPE='#game-ui,#side,#service-panel,#player-trade,#social-panel,#map-panel,.bank-context-menu,[data-long-press]';
const IGNORE='input,textarea,select,[contenteditable=true],canvas';

export function installLongPressMenus({doc=globalThis.document,delay=LONG_PRESS_MS,slop=LONG_PRESS_SLOP,setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}={}){
 if(!doc||doc.eldervaleLongPress)return doc?.eldervaleLongPress;
 let press=null,holding=false,suppressUntil=0;const blocked=()=>holding||Date.now()<suppressUntil;
 const cancel=()=>{if(press?.timer!=null)clearTimer(press.timer);press=null};
 doc.addEventListener('pointerdown',e=>{
  if(e.pointerType!=='touch'||!e.isPrimary){cancel();return}
  const target=e.target?.closest?.(SCOPE)&&!e.target.closest(IGNORE)?e.target:null;if(!target){cancel();return}
  cancel();press={target,x:e.clientX,y:e.clientY,fired:false,timer:null};const current=press;
  current.timer=setTimer(()=>{if(press!==current)return;current.timer=null;current.fired=true;holding=true;
   const view=doc.defaultView||globalThis;const Event=view.MouseEvent||globalThis.MouseEvent;
   current.target.dispatchEvent(new Event('contextmenu',{bubbles:true,cancelable:true,clientX:current.x,clientY:current.y,button:2,buttons:0}));
   view.navigator?.vibrate?.(12);
  },delay);
 },{capture:true,passive:true});
 doc.addEventListener('pointermove',e=>{if(press&&!press.fired&&Math.hypot(e.clientX-press.x,e.clientY-press.y)>slop)cancel()},{capture:true,passive:true});
 for(const type of ['pointerup','pointercancel'])doc.addEventListener(type,()=>{if(press&&!press.fired)cancel();else{press=null;if(holding){holding=false;suppressUntil=Date.now()+450}}},{capture:true,passive:true});
 doc.addEventListener('scroll',()=>{if(press&&!press.fired)cancel()},{capture:true,passive:true});
 // After a synthetic menu: swallow the native (Android) contextmenu and the click that ends the press.
 doc.addEventListener('contextmenu',e=>{if(e.isTrusted&&blocked()){e.preventDefault();e.stopImmediatePropagation()}else if(e.isTrusted&&press&&!press.fired){cancel()}},{capture:true});
 doc.addEventListener('click',e=>{if(e.isTrusted&&blocked()){suppressUntil=0;holding=false;e.preventDefault();e.stopImmediatePropagation()}},{capture:true});
 return doc.eldervaleLongPress={cancel};
}
