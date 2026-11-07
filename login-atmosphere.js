// Living login scene: depth parallax from the mouse or device tilt, torchlight
// placement and pause/resume. Fog drift, torch flicker and the idle sway are pure
// CSS (compositor-only transforms/opacity, see login-gate.css); this module only
// writes two custom properties, and only while the scene is actually easing.
import {coverPoint} from './login-fire.js?v=release-20261107-invorder151';

export const TORCH_ANCHORS=[[.239,.382],[.758,.382]];
const clamp=(v,lo=-1,hi=1)=>Math.max(lo,Math.min(hi,v));
// Pointer position (px) → parallax target in [-1,1]² (0,0 at the viewport centre).
export function pointerTarget(x,y,width,height){return {x:clamp((x/Math.max(1,width))*2-1),y:clamp((y/Math.max(1,height))*2-1)}}
// Device tilt relative to the first reading, ±18° → full travel; landscape swaps the axes.
export function tiltTarget(beta,gamma,base,angle=0){
 if(!Number.isFinite(beta)||!Number.isFinite(gamma))return null;let dx=(gamma-base.gamma)/18,dy=(beta-base.beta)/18;
 const a=((angle%360)+360)%360;if(a===90)[dx,dy]=[dy,-dx];else if(a===270)[dx,dy]=[-dy,dx];else if(a===180)[dx,dy]=[-dx,-dy];
 return {x:clamp(dx),y:clamp(dy)};
}

export function createLoginAtmosphere({screen=document.querySelector('#auth-screen'),scene=screen?.querySelector('.login-scene'),image=document.querySelector('#login-art'),win=globalThis}={}){
 if(!screen||!scene)return {dispose(){}};
 const reduced=win.matchMedia?.('(prefers-reduced-motion: reduce)');let target={x:0,y:0},current={x:0,y:0},frame=0,base=null,disposed=false;
 const placeTorch=()=>{const iw=image?.naturalWidth||1672,ih=image?.naturalHeight||941,w=win.innerWidth,h=win.innerHeight;TORCH_ANCHORS.forEach(([x,y],i)=>{const p=coverPoint(w,h,iw,ih,x,y);scene.style.setProperty('--torch'+i+'-x',Math.round(p.x)+'px');scene.style.setProperty('--torch'+i+'-y',Math.round(p.y-55*p.scale)+'px');scene.style.setProperty('--torch-r',Math.round(260*p.scale)+'px')})};
 const live=()=>!disposed&&!screen.hidden&&!win.document?.hidden&&!reduced?.matches;
 function step(){frame=0;if(!live())return;current.x+=(target.x-current.x)*.08;current.y+=(target.y-current.y)*.08;
  scene.style.setProperty('--px',current.x.toFixed(4));scene.style.setProperty('--py',current.y.toFixed(4));
  if(Math.abs(target.x-current.x)>.002||Math.abs(target.y-current.y)>.002)frame=win.requestAnimationFrame(step)}
 const aim=t=>{if(!t)return;target=t;if(!frame&&live())frame=win.requestAnimationFrame(step)};
 const onPointer=e=>{if(e.pointerType&&e.pointerType!=='mouse')return;aim(pointerTarget(e.clientX,e.clientY,win.innerWidth,win.innerHeight))};
 const onLeave=()=>aim({x:0,y:0});
 // Tilt needs no permission on Android/desktop; iOS Safari requires a prompt, so there
 // the scene keeps its gentle CSS idle sway instead of asking.
 const tiltAllowed=typeof win.DeviceOrientationEvent==='function'&&typeof win.DeviceOrientationEvent.requestPermission!=='function';
 const onTilt=e=>{if(e.beta==null||e.gamma==null)return;if(!base)base={beta:e.beta,gamma:e.gamma};aim(tiltTarget(e.beta,e.gamma,base,win.screen?.orientation?.angle??win.orientation??0))};
 const onResize=()=>{placeTorch();base=null};
 const onMotion=()=>{scene.dataset.motion=reduced?.matches?'reduced':'animated';if(reduced?.matches){target=current={x:0,y:0};scene.style.setProperty('--px','0');scene.style.setProperty('--py','0')}};
 const observer=new MutationObserver(()=>{if(screen.hidden){win.cancelAnimationFrame(frame);frame=0;scene.dataset.paused='true'}else{delete scene.dataset.paused;placeTorch()}});
 observer.observe(screen,{attributes:true,attributeFilter:['hidden']});
 win.addEventListener('pointermove',onPointer,{passive:true});win.document?.addEventListener('pointerleave',onLeave);win.addEventListener('resize',onResize);
 if(tiltAllowed)win.addEventListener('deviceorientation',onTilt,{passive:true});
 reduced?.addEventListener?.('change',onMotion);image?.addEventListener('load',placeTorch);
 placeTorch();onMotion();scene.classList.add('login-alive');
 return {dispose(){disposed=true;win.cancelAnimationFrame(frame);observer.disconnect();win.removeEventListener('pointermove',onPointer);win.document?.removeEventListener('pointerleave',onLeave);win.removeEventListener('resize',onResize);win.removeEventListener('deviceorientation',onTilt);reduced?.removeEventListener?.('change',onMotion);image?.removeEventListener('load',placeTorch)},get target(){return {...target}}};
}
