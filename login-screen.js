import {createFortressFire} from './login-fire.js?v=release-20261104-male27';
import {startMusic} from './music.js?v=release-20261104-male27';
const screen=document.querySelector('#auth-screen'),canvas=document.querySelector('#login-fire'),image=document.querySelector('#login-art');
let fire=null;
function scene(){if(!screen||screen.hidden)return;if(!fire){try{fire=createFortressFire(canvas,image)}catch(error){console.warn('Login fire unavailable:',error)}}}
scene();
const observer=new MutationObserver(()=>{if(screen.hidden)fire?.setActive?.(false);else{scene();fire?.setActive?.(true)}});observer.observe(screen,{attributes:true,attributeFilter:['hidden']});
const audio=startMusic({scene:'login'}),sound=document.querySelector('#login-sound-toggle'),track=document.querySelector('#login-audio-status');
sound.addEventListener('click',()=>audio?.toggleMaster());
const unsubscribe=audio?.subscribe(state=>{sound.textContent=state.enabled?'Sound on':'Sound off';sound.setAttribute('aria-pressed',String(state.enabled));sound.title=state.enabled?'Mute music and environmental audio':'Enable sound';track.textContent=state.status==='waiting'?'Tap anywhere for sound':state.status==='muted'?'The gates fall silent':state.status==='unavailable'?'Audio unavailable':state.track||'Eldervale';});
document.querySelector('#auth-password-toggle').addEventListener('click',event=>{const input=document.querySelector('#auth-password'),button=event.currentTarget,show=input.type==='password';input.type=show?'text':'password';button.setAttribute('aria-label',show?'Hide password':'Show password');button.setAttribute('aria-pressed',String(show))});
window.addEventListener('pagehide',event=>{if(event.persisted)return;fire?.dispose();observer.disconnect();unsubscribe?.()});
