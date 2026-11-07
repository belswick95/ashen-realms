// Keyboard chat works independently of pointer type (including iPad keyboards).
export function installChatShortcut({panel,input,onOpen}){
 panel.setAttribute('aria-keyshortcuts','Enter');
 let pressed=null;
 const pointer=event=>{pressed=event.target?.closest?.('button,a,[role="button"]')||null};
 const tabbed=event=>{if(event.key==='Tab')pressed=null};
 function keydown(event){
  if(!['Enter','Return'].includes(event.key)&&!['Enter','NumpadEnter'].includes(event.code))return;
  if(event.defaultPrevented||event.repeat||event.isComposing||event.keyCode===229||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
  if(!document.body.classList.contains('game-active')||document.body.classList.contains('landscape-required')||document.querySelector('dialog[open]')||document.querySelector('#dialog:not([hidden])'))return;
  const target=document.activeElement;
  // A HUD button clicked with the mouse (a side tab, the chat toggle) keeps focus in Chrome; Enter
  // would click it again and close the panel. A button reached with the keyboard (Tab) keeps Enter.
  const clicked=pointerFocusedButton(target,pressed);
  if(!clicked&&target?.closest('input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="button"],[role="dialog"]'))return;
  event.preventDefault();if(clicked)target.blur?.();panel.hidden=false;panel.classList.remove('collapsed');onOpen();
  const toggle=panel.querySelector('#social-toggle');if(toggle){toggle.textContent='−';toggle.title='Minimise chat';toggle.setAttribute('aria-label','Minimise chat');toggle.setAttribute('aria-expanded','true')}
  input.focus({preventScroll:true});
 }
 // Escape in the chat box hands the keyboard back to the game (camera keys, M, B...).
 const escape=event=>{if(event.key==='Escape'&&!event.isComposing){event.preventDefault();releaseChatFocus(input)}};input.addEventListener?.('keydown',escape);
 addEventListener('pointerdown',pointer,true);addEventListener('keydown',tabbed,true);addEventListener('keydown',keydown);
 return ()=>{removeEventListener('keydown',keydown);removeEventListener('pointerdown',pointer,true);removeEventListener('keydown',tabbed,true);input.removeEventListener?.('keydown',escape)};
}
// After a message is sent (or on Escape) the chat box lets go so game keys work again.
export function releaseChatFocus(input,doc=globalThis.document){input?.blur?.();doc?.querySelector?.('#world-canvas')?.focus?.({preventScroll:true})}
// True for a button or link that holds focus only because it was clicked or tapped (`pressed` is the
// control last pressed with a pointer), outside dialogs and forms. Chrome flips :focus-visible on at the
// first key press, so the pointer is tracked instead.
export function pointerFocusedButton(el,pressed){
 if(!el||el!==pressed||!el.matches?.('button,a,[role="button"]'))return false;
 return !el.closest?.('dialog,[role="dialog"],#dialog,form');
}
