// RuneScape-style controls: movement is point-and-click only (click-walk.js).
// There is no keyboard or thumbstick movement. WASD and the arrow keys turn
// the camera (left/right orbit, up/down pitch), Space jumps and the run toggle
// lives on the minimap.
export function hotkey(event){return (event.code&&event.code!=='Unidentified'?event.code:null)||({' ':'Space'}[event.key]||'')}
// Camera keys: yaw +1 turns the view left, pitch +1 raises the camera to look down more.
export const CAMERA_KEYS={ArrowLeft:['yaw',1],KeyA:['yaw',1],ArrowRight:['yaw',-1],KeyD:['yaw',-1],ArrowUp:['pitch',1],KeyW:['pitch',1],ArrowDown:['pitch',-1],KeyS:['pitch',-1]};
export const CAMERA_TURN_RATE=2.2,CAMERA_PITCH_RATE=1.1; // radians per second
export function cameraKey(event){const code=event?.code&&event.code!=='Unidentified'?event.code:({ArrowLeft:'ArrowLeft',ArrowRight:'ArrowRight',ArrowUp:'ArrowUp',ArrowDown:'ArrowDown',w:'KeyW',a:'KeyA',s:'KeyS',d:'KeyD',W:'KeyW',A:'KeyA',S:'KeyS',D:'KeyD'}[event?.key]||'');return CAMERA_KEYS[code]?code:null}
// Held keys → {yaw,pitch} in -1..1 (opposite keys cancel).
export function cameraKeyAxes(held){const axes={yaw:0,pitch:0};for(const code of held||[]){const k=CAMERA_KEYS[code];if(k)axes[k[0]]+=k[1]}axes.yaw=Math.max(-1,Math.min(1,axes.yaw));axes.pitch=Math.max(-1,Math.min(1,axes.pitch));return axes}
export function jumpHeight(timestamp,now){const t=(now-Date.parse(timestamp))/800;return t>=0&&t<=1?2.8*t*(1-t):0}
// True while a jump that started at `timestamp` is in the air (drives the jump clips).
export function isAirborne(timestamp,now){const t=(now-Date.parse(timestamp))/800;return t>0&&t<1}
export function installMMOControls({element,isBlocked,onJump}){
 const editing=event=>event.target?.closest?.('input,textarea,select,[contenteditable=true],[contenteditable=""],[role=dialog]');
 const held=new Set();
 addEventListener('keyup',e=>{const code=cameraKey(e);if(code)held.delete(code)});
 addEventListener('blur',()=>held.clear());
 if(element?.addEventListener){element.tabIndex=0;element.addEventListener('pointerdown',()=>element.focus?.({preventScroll:true}));}
 addEventListener('keydown',e=>{const camera=cameraKey(e);if(e.isComposing||e.metaKey||e.ctrlKey||e.altKey||editing(e)||isBlocked()){if(camera)held.delete(camera);return}
  if(camera){e.preventDefault();held.add(camera);return}
  if(hotkey(e)==='Space'){e.preventDefault();if(!e.repeat)onJump()}});
 // Touch devices keep a jump button; movement is tap-to-walk.
 const jump=document.createElement('button');jump.id='touch-jump';jump.type='button';jump.setAttribute('aria-label','Jump');jump.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m9 15 7-8 7 8M16 8v16M8 26h16"/></svg><span>Jump</span>';document.body.append(jump);
 const touchProfile=()=>document.body.classList.toggle('touch-controls',matchMedia('(pointer:coarse)').matches||(navigator.maxTouchPoints>0&&!matchMedia('(hover:hover)').matches));touchProfile();addEventListener('resize',touchProfile);
 jump.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(!isBlocked())onJump()});
 return {update(){return null},cameraAxes(){if(held.size&&isBlocked())held.clear();return cameraKeyAxes(held)},get touchActive(){return false},clear(){held.clear()}};
}
