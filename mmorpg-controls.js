// RuneScape-style controls: movement is point-and-click only (click-walk.js).
// There is no keyboard or thumbstick movement; Space still jumps and the run
// toggle lives on the minimap.
export function hotkey(event){return (event.code&&event.code!=='Unidentified'?event.code:null)||({' ':'Space'}[event.key]||'')}
export function jumpHeight(timestamp,now){const t=(now-Date.parse(timestamp))/800;return t>=0&&t<=1?2.8*t*(1-t):0}
// True while a jump that started at `timestamp` is in the air (drives the jump clips).
export function isAirborne(timestamp,now){const t=(now-Date.parse(timestamp))/800;return t>0&&t<1}
export function installMMOControls({element,isBlocked,onJump}){
 const editing=event=>event.target?.closest?.('input,textarea,select,[contenteditable=true],[role=dialog]');
 if(element?.addEventListener){element.tabIndex=0;element.addEventListener('pointerdown',()=>element.focus?.({preventScroll:true}));}
 addEventListener('keydown',e=>{if(e.isComposing||e.metaKey||e.ctrlKey||e.altKey||editing(e)||isBlocked())return;if(hotkey(e)==='Space'){e.preventDefault();if(!e.repeat)onJump()}});
 // Touch devices keep a jump button; movement is tap-to-walk.
 const jump=document.createElement('button');jump.id='touch-jump';jump.type='button';jump.setAttribute('aria-label','Jump');jump.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m9 15 7-8 7 8M16 8v16M8 26h16"/></svg><span>Jump</span>';document.body.append(jump);
 const touchProfile=()=>document.body.classList.toggle('touch-controls',matchMedia('(pointer:coarse)').matches||(navigator.maxTouchPoints>0&&!matchMedia('(hover:hover)').matches));touchProfile();addEventListener('resize',touchProfile);
 jump.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(!isBlocked())onJump()});
 return {update(){return null},get touchActive(){return false},clear(){}};
}
