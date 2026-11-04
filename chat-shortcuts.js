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
 addEventListener('keydown',keydown);
 return ()=>removeEventListener('keydown',keydown);
}
