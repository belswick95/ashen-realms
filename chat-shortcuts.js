// Keyboard chat works independently of pointer type (including iPad keyboards).
export function installChatShortcut({panel,input,onOpen}){
 panel.setAttribute('aria-keyshortcuts','Enter');
 function keydown(event){
  if(!['Enter','Return'].includes(event.key)&&!['Enter','NumpadEnter'].includes(event.code))return;
  if(event.defaultPrevented||event.repeat||event.isComposing||event.keyCode===229||event.ctrlKey||event.metaKey||event.altKey||event.shiftKey)return;
  if(!document.body.classList.contains('game-active')||document.body.classList.contains('landscape-required')||document.querySelector('dialog[open]')||document.querySelector('#dialog:not([hidden])'))return;
  const target=document.activeElement;
  if(target?.closest('input,textarea,select,button,a,[contenteditable]:not([contenteditable="false"]),[role="textbox"],[role="button"],[role="dialog"]'))return;
  event.preventDefault();panel.hidden=false;panel.classList.remove('collapsed');onOpen();
  const toggle=panel.querySelector('#social-toggle');if(toggle){toggle.textContent='−';toggle.title='Minimize chat';toggle.setAttribute('aria-label','Minimize chat');toggle.setAttribute('aria-expanded','true')}
  input.focus({preventScroll:true});
 }
 // Escape in the chat box hands the keyboard back to the game (camera keys, M, B...).
 const escape=event=>{if(event.key==='Escape'&&!event.isComposing){event.preventDefault();releaseChatFocus(input)}};input.addEventListener?.('keydown',escape);
 addEventListener('keydown',keydown);
 return ()=>{removeEventListener('keydown',keydown);input.removeEventListener?.('keydown',escape)};
}
// After a message is sent (or on Escape) the chat box lets go so game keys work again.
export function releaseChatFocus(input,doc=globalThis.document){input?.blur?.();doc?.querySelector?.('#world-canvas')?.focus?.({preventScroll:true})}
