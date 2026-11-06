import {createFortressFire} from './login-fire.js?v=release-20261106-cut103';
import {startMusic} from './music.js?v=release-20261106-cut103';
import {createLoginAtmosphere} from './login-atmosphere.js?v=release-20261106-cut103';
import {startLoginNews} from './login-news.js?v=release-20261106-cut103';
const screen=document.querySelector('#auth-screen'),canvas=document.querySelector('#login-fire'),image=document.querySelector('#login-art');
let fire=null;
function scene(){if(!screen||screen.hidden)return;if(!fire){try{fire=createFortressFire(canvas,image)}catch(error){console.warn('Login fire unavailable:',error)}}}
scene();
const observer=new MutationObserver(()=>{if(screen.hidden)fire?.setActive?.(false);else{scene();fire?.setActive?.(true)}});observer.observe(screen,{attributes:true,attributeFilter:['hidden']});
const audio=startMusic({scene:'login'}),sound=document.querySelector('#login-sound-toggle'),track=document.querySelector('#login-audio-status');
sound.addEventListener('click',()=>audio?.toggleMaster());
const unsubscribe=audio?.subscribe(state=>{sound.textContent=state.enabled?'Sound on':'Sound off';sound.setAttribute('aria-pressed',String(state.enabled));sound.title=state.enabled?'Mute music and environmental audio':'Enable sound';track.textContent=state.status==='waiting'?'Tap anywhere for sound':state.status==='muted'?'The gates fall silent':state.status==='unavailable'?'Audio unavailable':state.track||'Eldervale';});
document.querySelector('#auth-password-toggle').addEventListener('click',event=>{const input=document.querySelector('#auth-password'),button=event.currentTarget,show=input.type==='password';input.type=show?'text':'password';button.setAttribute('aria-label',show?'Hide password':'Show password');button.setAttribute('aria-pressed',String(show))});
let atmosphere=null,news=null;try{atmosphere=createLoginAtmosphere({screen,image})}catch(error){console.warn('Login atmosphere unavailable:',error)}
try{news=startLoginNews({screen})}catch(error){console.warn('Login news unavailable:',error)}
// "Enter Eldervale": a short statement of the Eldervale motif (respects the sound toggle).
let lastSting=0;
document.querySelector('#auth-form')?.addEventListener('submit',()=>{if(document.querySelector('#auth-login-tab')?.getAttribute('aria-pressed')==='false')return;const now=Date.now();if(now-lastSting<5000||!audio)return;lastSting=now;try{audio.unlock?.()}catch{}if(audio.celebrate?.('motif'))return;const ctx=audio.context;if(!ctx)return;const retry=()=>{clearTimeout(timer);ctx.removeEventListener?.('statechange',retry);if(ctx.state==='running')audio.celebrate?.('motif')};const timer=setTimeout(retry,800);ctx.addEventListener?.('statechange',retry)});
window.addEventListener('pagehide',event=>{if(event.persisted)return;fire?.dispose();atmosphere?.dispose();news?.stop();observer.disconnect();unsubscribe?.()});
