import {townMusic,loginMusic,musicRegion,audioPreference,waterProximity} from './audio-regions.js?v=release-20261105-visuals69';
import {createSfx} from './sfx.js?v=release-20261105-visuals69';
import {createAmbience} from './ambience.js?v=release-20261105-visuals69';
import {playJingle} from './jingles.js?v=release-20261105-visuals69';
let singleton;
// One audio engine spans sign-in and gameplay: ONE AudioContext and mixer with
// three channels, as in RuneScape — Music (region tracks, mixed soft by
// default), Sound effects (actions, combat, horses, jingles) and Area sounds
// (birds, wind, water, towns). Every gain change is ramped (no clicks), the
// context suspends while the tab is hidden and resumes on the next gesture.
// Default mix: music sits at roughly 35–40% of the area-sound level.
export const DEFAULT_VOLUMES={music:35,sfx:80,environment:70};
export function startMusic({scene='world'}={}){
 if(singleton){singleton.setScene(scene);return singleton}
 const storage=localStorage,listeners=new Set(),decks=[new Audio(),new Audio()];
 let celebration=null;let mode=scene,zone=null,desired=null,active=0,generation=0,ctx,musicBus,duckBus,environmentBus,sfxBus,gains,started=false,waiting=false,unavailable=false,disposed=false,sfx=null,ambience=null,duckUntil=0,lastSnort=0;
 let enabled=storage.getItem('eldervale-audio-enabled')!=='false',musicEnabled=storage.getItem('eldervale-music-enabled')===null?storage.getItem('eldervale-music-muted')!=='true':storage.getItem('eldervale-music-enabled')!=='false',environmentEnabled=storage.getItem('eldervale-environment-enabled')!=='false',sfxEnabled=storage.getItem('eldervale-sfx-enabled')!=='false';
 let volume=audioPreference(storage,'eldervale-music-volume',DEFAULT_VOLUMES.music),environmentVolume=audioPreference(storage,'eldervale-environment-volume',audioPreference(storage,'eldervale-ambient-volume',DEFAULT_VOLUMES.environment)),sfxVolume=audioPreference(storage,'eldervale-sfx-volume',DEFAULT_VOLUMES.sfx);
 const fades=new Map();
 decks.forEach(deck=>{deck.loop=true;deck.preload='auto';deck.autoplay=enabled&&musicEnabled;deck.setAttribute('playsinline','');deck.addEventListener('error',()=>{if(deck===decks[active]&&enabled){unavailable=true;notify()}})});
 function state(){return {scene:mode,zone:zone?.id||null,track:desired?.title||null,enabled,musicEnabled,environmentEnabled,sfxEnabled,volume,environmentVolume,sfxVolume,status:unavailable?'unavailable':!enabled?'muted':waiting?'waiting':started?'playing':'waiting',context:ctx?.state||'not-started',sfxLoaded:sfx?.loaded||0,beds:ambience?.beds||[]}}
 function notify(){for(const listener of listeners)listener(state());const b=document.querySelector('#music-toggle'),s=document.querySelector('#music-volume'),label=document.querySelector('#music-track');if(b){b.textContent=musicEnabled?'♫ Music on':'♫ Music off';b.setAttribute('aria-pressed',String(musicEnabled))}if(s)s.value=String(volume);if(label)label.textContent=desired?desired.title+' · '+(desired.artist||'Kevin MacLeod'):'No town music';const e=document.querySelector('#environment-toggle'),v=document.querySelector('#environment-volume');if(e){e.textContent=environmentEnabled?'Area sounds on':'Area sounds off';e.setAttribute('aria-pressed',String(environmentEnabled))}if(v)v.value=String(environmentVolume);const f=document.querySelector('#sfx-toggle'),fv=document.querySelector('#sfx-volume');if(f){f.textContent=sfxEnabled?'Sound effects on':'Sound effects off';f.setAttribute('aria-pressed',String(sfxEnabled))}if(fv)fv.value=String(sfxVolume)}
 function ramp(gain,value,duration=.7){if(!gain||!ctx)return;const p=gain.gain,t=ctx.currentTime;p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);p.setTargetAtTime(value,t,duration/4)}
 function initialize(){
  if(ctx)return;const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('Web Audio unavailable');ctx=new Context();
  musicBus=ctx.createGain();duckBus=ctx.createGain();environmentBus=ctx.createGain();sfxBus=ctx.createGain();for(const g of [musicBus,environmentBus,sfxBus])g.gain.value=0;
  const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-8;limiter.ratio.value=6;musicBus.connect(duckBus);duckBus.connect(limiter);environmentBus.connect(limiter);sfxBus.connect(limiter);limiter.connect(ctx.destination);
  gains=decks.map(deck=>{const source=ctx.createMediaElementSource(deck),gain=ctx.createGain();gain.gain.value=0;source.connect(gain);gain.connect(musicBus);return gain});
  sfx=createSfx({context:()=>ctx,sfxBus:()=>sfxBus,ambientBus:()=>environmentBus,listener:()=>{try{return window.eldervaleAudioListener?.()||null}catch{return null}}});
  ambience=createAmbience({context:()=>ctx,bus:()=>environmentBus,sfx});
  applyVolume();ctx.addEventListener('statechange',()=>{if(ctx.state==='suspended'&&enabled&&!document.hidden){waiting=true;notify()}});
 }
 function applyVolume(){if(celebration)celebration.volume=enabled?volume/100:0;decks.forEach(deck=>deck.autoplay=enabled&&musicEnabled);ramp(musicBus,enabled&&musicEnabled?volume/100*.7:0,.25);ramp(environmentBus,enabled&&environmentEnabled?environmentVolume/100:0,.3);ramp(sfxBus,enabled&&sfxEnabled?sfxVolume/100:0,.15);if(!enabled||!musicEnabled)decks.forEach(deck=>deck.pause())}
 // Music ducks under important effects (−dB for `hold` s), then eases back.
 function duck(db=-5,hold=.6,release=1.2){if(!ctx||!duckBus)return;const t=ctx.currentTime,target=Math.pow(10,db/20),p=duckBus.gain;if(t+hold<duckUntil&&p.value<=target+.001)return;duckUntil=Math.max(duckUntil,t+hold);p.cancelScheduledValues(t);p.setValueAtTime(p.value,t);p.setTargetAtTime(target,t,.06);p.setTargetAtTime(1,duckUntil,release/3)}
 function transition(track){
  if(desired?.id===track?.id)return;desired=track;unavailable=false;generation++;const epoch=generation,old=active;active=1-active;for(const timeout of fades.values())clearTimeout(timeout);fades.clear();
  // Region changes crossfade: the old track eases out while the new one eases in.
  if(ctx){ramp(gains[old],0,3.2);ramp(gains[active],0,.05)}
  decks[active].pause();decks[active].removeAttribute('src');decks[active].load();
  if(track){decks[active].src='/assets/audio/'+track.id+'.mp3';if(enabled&&musicEnabled&&started)playActive()}
  const timer=setTimeout(()=>{if(epoch===generation)decks[old].pause();fades.delete(old)},3400);fades.set(old,timer);notify();
 }
 async function playActive(){
  if(!desired||!enabled||!musicEnabled||disposed)return;const epoch=generation,deck=decks[active];try{await deck.play();if(epoch!==generation){deck.pause();return}ramp(gains?.[active],1,2.6);waiting=false;unavailable=false;notify()}catch(error){if(epoch!==generation)return;if(error.name==='NotAllowedError'){waiting=true}else if(error.name!=='AbortError'){unavailable=true}notify()}
 }
 async function unlock(){
  if(!enabled||disposed)return;try{initialize();const resume=ctx.resume();const playback=desired&&musicEnabled?playActive():Promise.resolve();await Promise.all([resume,playback]);started=ctx.state==='running';waiting=!started;applyVolume();if(started)sfx.preload(['hoof','chop','crunch','splashCast','splashCatch']);environment();notify()}catch{unavailable=true;notify()}
 }
 function environment(){
  if(!ctx||!started||document.hidden||mode==='login'||!ambience)return;let env=null;try{env=window.eldervaleAmbientState?.()||null}catch{}
  if(!env){let pos=null;try{pos=window.eldervaleGetPlayerPosition?.()}catch{}if(!pos)return;env={position:pos,listener:pos,day:window.eldervaleWorldNight===true?0:1,water:waterProximity(pos)}}
  if(enabled&&environmentEnabled)ambience.update(env);sfx.update();
 }
 function tick(){if(disposed)return;const overlay=document.querySelector('#auth-screen');if(mode==='login'&&overlay?.hidden&&window.eldervaleGetPlayerPosition)mode='world';if(mode==='login'){zone=null;transition(loginMusic)}else{let pos;try{pos=window.eldervaleGetPlayerPosition?.()}catch{}zone=musicRegion(pos,zone);transition(zone)}environment()}
 function setScene(next){mode=next;zone=null;tick();notify()}
 // Horse hooves: recorded hoof falls on each hoof's ground contact. Earth and
 // grass give a dull thud (low-passed, fuller); road, bridge and castle stone a
 // harder, brighter clop. Per-hit pitch/level variation, and an occasional snort.
 function hoof({volume:gainValue=1,hard=false,front=false,pan=0,at=null}={}){
  if(!sfx||!enabled||!sfxEnabled||document.hidden||gainValue<=0)return;
  sfx.sample('hoof',{gain:Math.min(1,gainValue)*(front?.82:1)*(hard?.95:1.1),pan,rate:hard?1.06:.86,vary:.07,cutoff:hard?16000:2300,tone:hard?{frequency:3200,gain:4}:{frequency:140,gain:5,q:.9}});
  const now=performance.now();if(now>lastSnort&&Math.random()<.012){lastSnort=now+9000;sfx.proc('snort',{gain:Math.min(1,gainValue)*.7,pan,delay:.1})}
 }
 function celebrate(kind='gathering'){if(!enabled||document.hidden||!ctx||ctx.state!=='running')return false;
  // Music steps aside for the jingle (about −20 dB) and eases back afterwards.
  const length=playJingle(ctx,sfxBus,kind,{gain:.85});duck(-20,length,2.2);return length>0}
 function toggleMaster(){enabled=!enabled;storage.setItem('eldervale-audio-enabled',String(enabled));applyVolume();if(enabled)unlock();notify()}
 function toggleMusic(){musicEnabled=!musicEnabled;storage.setItem('eldervale-music-enabled',String(musicEnabled));applyVolume();if(musicEnabled&&enabled)unlock();notify()}
 function toggleEnvironment(){environmentEnabled=!environmentEnabled;storage.setItem('eldervale-environment-enabled',String(environmentEnabled));applyVolume();if(environmentEnabled&&enabled)unlock();notify()}
 function toggleSfx(){sfxEnabled=!sfxEnabled;storage.setItem('eldervale-sfx-enabled',String(sfxEnabled));applyVolume();if(sfxEnabled&&enabled)unlock();notify()}
 function onInput(event){const id=event.target.id,value=Number(event.target.value);if(id==='music-volume'){volume=value;storage.setItem('eldervale-music-volume',String(volume))}else if(id==='environment-volume'){environmentVolume=value;storage.setItem('eldervale-environment-volume',String(environmentVolume))}else if(id==='sfx-volume'){sfxVolume=value;storage.setItem('eldervale-sfx-volume',String(sfxVolume))}else return;applyVolume();notify()}
 function onClick(event){if(event.target.closest('#music-toggle'))toggleMusic();if(event.target.closest('#environment-toggle'))toggleEnvironment();if(event.target.closest('#sfx-toggle'))toggleSfx()}
 // iOS Safari only resumes audio inside a touch/click handler.
 function interaction(){if(enabled&&(!started||ctx?.state!=='running'))unlock()}
 function onVisible(){if(document.hidden){decks.forEach(deck=>deck.pause());ctx?.suspend().catch(()=>{})}else if(enabled)unlock()}
 function onPageHide(event){if(event.persisted){ctx?.suspend().catch(()=>{})}else api.dispose()}
 const timer=setInterval(tick,1000);for(const type of ['pointerdown','keydown','touchend'])document.addEventListener(type,interaction,{capture:true});document.addEventListener('input',onInput);document.addEventListener('click',onClick);document.addEventListener('visibilitychange',onVisible);window.addEventListener('pagehide',onPageHide);
 const api={celebrate,hoof,duck,setScene,toggleMaster,toggleMusic,toggleEnvironment,toggleSfx,unlock,getState:state,get sfx(){return sfx},get context(){return ctx},subscribe(listener){listeners.add(listener);listener(state());return ()=>listeners.delete(listener)},dispose(){disposed=true;sfx?.dispose();ambience?.dispose();clearInterval(timer);for(const timeout of fades.values())clearTimeout(timeout);decks.forEach(deck=>{deck.pause();deck.removeAttribute('src');deck.load()});ctx?.close().catch(()=>{});for(const type of ['pointerdown','keydown','touchend'])document.removeEventListener(type,interaction,{capture:true});document.removeEventListener('input',onInput);document.removeEventListener('click',onClick);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('pagehide',onPageHide);listeners.clear();singleton=null}};
 singleton=api;tick();notify();if(enabled)unlock();return api;
}

export function playHorseHoof(options){singleton?.hoof(options);}
// Level-up jingle for a skill family ('combat' | 'gathering' | 'artisan' | 'combatLevel').
export function playLevelUpJingle(kind){return singleton?.celebrate(kind)||false;}
export function duckMusic(db,hold,release){singleton?.duck(db,hold,release)}
// The shared effects player (null until the first user gesture unlocks audio).
export function soundEffects(){return singleton?.sfx||null}
