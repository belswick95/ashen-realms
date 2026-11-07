// OSRS-style logout rule: you can't log out until 10 seconds after the end of combat (hitting or
// being hit, or while a monster has you as its target). Once the 10 s have passed, logging out is
// immediate. The X at the top-right of the game screen and the Settings tab's Log out button share
// one flow (auth.js). The server enforces the same rule on the 'logout' world command
// (db/logout-combat.sql); closing the tab instead leaves the character in the world while its
// combat timer runs, up to about a minute.
export const LOGOUT_COMBAT_MS=10000;
export const LOGOUT_COMBAT_MESSAGE="You can't log out until 10 seconds after the end of combat.";

// A hit event (db/mechanics-ii-2-combat.sql emit 'hit') involving this player, on either side.
// Poison and venom ticks are not combat: they do not block logout (the server ignores them too).
export function isCombatEvent(event,userId){return !!event&&event.type==='hit'&&userId!=null&&String(event.player)===String(userId)&&!event.poison}

export function createCombatClock({now=()=>Date.now(),windowMs=LOGOUT_COMBAT_MS}={}){
 let last=-Infinity;const listeners=new Set();
 const clock={
  windowMs,
  get last(){return last},
  mark(at=now()){if(!(at>last))return;last=at;for(const fn of listeners)try{fn(clock)}catch{}},
  observeEvent(event,userId,at=now()){if(isCombatEvent(event,userId))clock.mark(at)},
  // A live monster targeting the player means it is attacking right now.
  observeActors(actors,userId,at=now()){if(Array.isArray(actors)&&actors.some(a=>a&&a.target!=null&&String(a.target)===String(userId)&&!(Number(a.hp)<=0)))clock.mark(at)},
  remaining(at=now()){return Math.max(0,last+windowMs-at)},
  locked(at=now()){return clock.remaining(at)>0},
  onChange(fn){listeners.add(fn);return ()=>listeners.delete(fn)},
  reset(){last=-Infinity}
 };
 return clock;
}
// The one clock the realm client feeds and the logout flow reads.
export const combatClock=createCombatClock();

// A server refusal of the 'logout' command is a game message; anything else is a transport or
// legacy-server answer.
export const isLogoutRefusal=message=>/can'?t log out|cannot log out/i.test(String(message||''));
// A server without db/logout-combat.sql (or a world session that already ended) has nothing to
// leave: carry on with the sign-out.
export const isLegacyLogoutReply=message=>/invalid command|unknown world command|session expired/i.test(String(message||''));

// Steps (all injected so the flow is testable):
//  save()        -> true once the character is saved (false: the caller shows "Retry logout")
//  cancelTrade() -> ends a pending trade request or open trade
//  leave()       -> {ok:true} | {refused:text} | {error:text}: the server 'logout' command
//  signOut()     -> true once the auth session is gone
//  finish()      -> clear local state and reload to the sign-in screen
//  leave() may also answer {error,busy:true} when the realm is busy (lock or statement timeouts):
//  the flow says so and retries by itself after retryDelays, then asks for another tap.
// Every tap answers at once: the combat message, "Logging out…", or the current status while a
// logout is already under way (a tap never does nothing, even when the server is slow).
export const LOGOUT_PROGRESS_MESSAGE='Logging out…';
export const LOGOUT_BUSY_MESSAGE='The realm is busy - retrying your logout…';
export const LOGOUT_GAVE_UP_MESSAGE='The realm is still busy - tap X to try logging out again.';
export const LOGOUT_RETRY_DELAYS=[1500,3000,5000];
export function createLogoutFlow({clock=combatClock,notify=()=>{},save=async()=>true,cancelTrade=async()=>{},leave=async()=>({ok:true}),signOut=async()=>true,finish=()=>{},onBusy=()=>{},retryDelays=LOGOUT_RETRY_DELAYS,wait=ms=>new Promise(r=>setTimeout(r,ms))}={}){
 let busy=false,status=LOGOUT_PROGRESS_MESSAGE;
 const say=text=>{status=text;notify(text)};
 const refuse=()=>{notify(LOGOUT_COMBAT_MESSAGE);return 'combat'};
 async function request(){
  if(busy){notify(status);return 'busy'}
  if(clock.locked())return refuse();
  busy=true;onBusy(true);say(LOGOUT_PROGRESS_MESSAGE);
  try{
   if(!await save())return 'save-failed';
   // Combat can start while the save is in flight.
   if(clock.locked())return refuse();
   await cancelTrade();
   let left;
   for(let attempt=0;;attempt++){
    left=await leave()||{ok:true};
    if(!left.busy||left.ok||left.refused)break;
    if(attempt>=retryDelays.length){say(LOGOUT_GAVE_UP_MESSAGE);return 'error'}
    say(LOGOUT_BUSY_MESSAGE);await wait(retryDelays[attempt]);
    if(clock.locked())return refuse();
   }
   if(left.refused){clock.mark();notify(left.refused);return 'combat'}
   if(!left.ok){if(left.error)notify(left.error);return 'error'}
   if(!await signOut())return 'signout-failed';
   finish();return 'done';
  }finally{busy=false;status=LOGOUT_PROGRESS_MESSAGE;onBusy(false)}
 }
 return {request,get busy(){return busy}};
}

const X_ICON='<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path class="logout-x-cut" d="M6 6 18 18M18 6 6 18"/><path class="logout-x-mark" d="M6 6 18 18M18 6 6 18"/></svg>';
const LOCK_ICON='<svg class="logout-x-lock" viewBox="0 0 12 14" aria-hidden="true" focusable="false"><path d="M3.5 6V4.2a2.5 2.5 0 0 1 5 0V6" fill="none" stroke="currentColor" stroke-width="1.6"/><rect x="1.5" y="6" width="9" height="7" rx="1.4" fill="currentColor"/></svg>';

// The X button at the top-right of the game screen. It lives inside the minimap cluster
// (#map-widget, laid out in phone-fit.css) so it follows the cluster's safe-area placement and
// hides with it (open phone panels, cutscenes). While the combat timer runs it shows a small lock.
export function installLogoutButton(onLogout,{clock=combatClock,doc=globalThis.document}={}){
 if(!doc)return null;
 let button=doc.getElementById('logout-x');
 if(!button){button=doc.createElement('button');button.id='logout-x';button.type='button';button.innerHTML=X_ICON+LOCK_ICON}
 button.setAttribute('aria-label','Log out');button.title='Log out';
 const host=doc.getElementById('map-widget')||doc.body;if(button.parentNode!==host)host.append(button);
 // Touch (iPad Safari): act on the finger lifting, not on the synthesized click, which WebKit can
 // withhold (double-tap-zoom wait, a gesture handler elsewhere, a tap at the disc's edge); the
 // click that follows a handled touch is ignored so one tap is one request.
 let press=null,touchedAt=-Infinity;
 const fire=()=>{try{onLogout?.()}catch(e){console.warn('Logout:',e)}};
 button.addEventListener('pointerdown',event=>{event.stopPropagation();if(event.pointerType!=='mouse')press={id:event.pointerId,x:event.clientX,y:event.clientY}},{passive:true});
 button.addEventListener('pointerup',event=>{event.stopPropagation();const p=press;press=null;if(!p||event.pointerType==='mouse'||p.id!==event.pointerId)return;
  if(Math.hypot(event.clientX-p.x,event.clientY-p.y)>24)return;touchedAt=Date.now();fire()});
 button.addEventListener('pointercancel',()=>{press=null},{passive:true});
 button.onclick=event=>{event.preventDefault();event.stopPropagation();if(Date.now()-touchedAt<800)return;fire()};
 // Keep the minimap's pointer handlers (drag, pinch, walk-here) away from the button.
 for(const type of ['touchstart','mousedown','wheel'])button.addEventListener(type,event=>event.stopPropagation(),{passive:true});
 let timer=null;
 const refresh=()=>{const wait=clock.remaining();const locked=wait>0;button.classList.toggle('logout-locked',locked);
  button.title=locked?'Log out (in combat: wait '+Math.ceil(wait/1000)+' s)':'Log out';
  if(locked&&!timer)timer=setInterval(refresh,250);else if(!locked&&timer){clearInterval(timer);timer=null}};
 clock.onChange(refresh);refresh();
 return {button,refresh};
}

// A short on-screen line (the chat may be collapsed on phones), plus the chat itself.
export function showLogoutNotice(text,{doc=globalThis.document,ms=3500}={}){
 if(!doc||!text)return;
 globalThis.eldervaleWorldBridge?.notice?.(text);
 let toast=doc.getElementById('logout-toast');
 if(!toast){toast=doc.createElement('div');toast.id='logout-toast';toast.setAttribute('role','status');toast.setAttribute('aria-live','polite');doc.body.append(toast)}
 toast.textContent=text;toast.hidden=false;clearTimeout(toast._hide);toast._hide=setTimeout(()=>{toast.hidden=true},ms);
}
