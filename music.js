import {createNatureAudio} from './nature-audio.js?v=release-20261105-maxout61';
import {townMusic,loginMusic,musicRegion,audioPreference,waterProximity} from './audio-regions.js?v=release-20261105-maxout61';
let singleton;
// One audio engine spans sign-in and gameplay. Music and environment have
// separate buses; natural ambience is never represented as a music track.
export function startMusic({scene='world'}={}){
 if(singleton){singleton.setScene(scene);return singleton}
 const storage=localStorage,listeners=new Set(),decks=[new Audio(),new Audio()];
 let celebration;let mode=scene,zone=null,desired=null,active=0,generation=0,ctx,musicBus,environmentBus,gains,water,noiseBuffer,started=false,waiting=false,unavailable=false,disposed=false,lastBird=0,lastWater=0,nature,lastNatureKind=null;
 let enabled=storage.getItem('eldervale-audio-enabled')!=='false',musicEnabled=storage.getItem('eldervale-music-enabled')===null?storage.getItem('eldervale-music-muted')!=='true':storage.getItem('eldervale-music-enabled')!=='false',environmentEnabled=storage.getItem('eldervale-environment-enabled')!=='false';
 let volume=audioPreference(storage,'eldervale-music-volume',45),environmentVolume=audioPreference(storage,'eldervale-environment-volume',audioPreference(storage,'eldervale-ambient-volume',35));
 const fades=new Map(),sources=[];
 decks.forEach(deck=>{deck.loop=true;deck.preload='auto';deck.autoplay=enabled&&musicEnabled;deck.setAttribute('playsinline','');deck.addEventListener('error',()=>{if(deck===decks[active]&&enabled){unavailable=true;notify()}})});
 function state(){return {scene:mode,zone:zone?.id||null,track:desired?.title||null,enabled,musicEnabled,environmentEnabled,volume,environmentVolume,status:unavailable?'unavailable':!enabled?'muted':waiting?'waiting':started?'playing':'waiting',context:ctx?.state||'not-started',natureReady:nature?.ready||0,naturePlays:nature?.plays||0,lastNature:nature?.lastKind||null}}
 function notify(){for(const listener of listeners)listener(state());const b=document.querySelector('#music-toggle'),s=document.querySelector('#music-volume'),label=document.querySelector('#music-track');if(b){b.textContent=musicEnabled?'♫ Music on':'♫ Music off';b.setAttribute('aria-pressed',String(musicEnabled))}if(s)s.value=String(volume);if(label)label.textContent=desired?desired.title+' · '+(desired.artist||'Kevin MacLeod'):'No town music';const e=document.querySelector('#environment-toggle'),v=document.querySelector('#environment-volume');if(e){e.textContent=environmentEnabled?'Environment on':'Environment off';e.setAttribute('aria-pressed',String(environmentEnabled))}if(v)v.value=String(environmentVolume)}
 function ramp(gain,value,duration=.7){if(!gain||!ctx)return;gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setTargetAtTime(value,ctx.currentTime,duration/4)}
 function makeNoise(){const buffer=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate),data=buffer.getChannelData(0);let seed=1729,brown=0;for(let i=0;i<data.length;i++){seed=(1664525*seed+1013904223)>>>0;brown=.995*brown+.025*(seed/2147483648-1);data[i]=brown*2}return buffer}
 function noiseLayer(type,frequency,q,gain){const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),out=ctx.createGain();source.buffer=noiseBuffer;source.loop=true;filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;out.gain.value=gain;source.connect(filter);filter.connect(out);out.connect(environmentBus);source.start();sources.push(source);return {gain:out,filter}}
 function initialize(){
  if(ctx)return;const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('Web Audio unavailable');ctx=new Context();musicBus=ctx.createGain();environmentBus=ctx.createGain();const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-10;limiter.ratio.value=5;musicBus.connect(limiter);environmentBus.connect(limiter);limiter.connect(ctx.destination);gains=decks.map(deck=>{const source=ctx.createMediaElementSource(deck),gain=ctx.createGain();gain.gain.value=0;source.connect(gain);gain.connect(musicBus);return gain});noiseBuffer=makeNoise();water=noiseLayer('lowpass',450,.4,0);nature=createNatureAudio(ctx,environmentBus);applyVolume();ctx.addEventListener('statechange',()=>{if(ctx.state==='suspended'&&enabled){waiting=true;notify()}});
 }
 function applyVolume(){if(celebration)celebration.volume=enabled?volume/100:0;decks.forEach(deck=>deck.autoplay=enabled&&musicEnabled);ramp(musicBus,enabled&&musicEnabled?volume/100*.7:0,.2);ramp(environmentBus,enabled&&environmentEnabled?environmentVolume/100:0,.3);if(!enabled||!musicEnabled)decks.forEach(deck=>deck.pause())}
 function transition(track){
  if(desired?.id===track?.id)return;desired=track;unavailable=false;generation++;const epoch=generation,old=active;active=1-active;for(const timeout of fades.values())clearTimeout(timeout);fades.clear();
  if(ctx){gains.forEach(g=>ramp(g,0,2.2));}
  decks[active].pause();decks[active].removeAttribute('src');decks[active].load();
  if(track){decks[active].src='/assets/audio/'+track.id+'.mp3';if(enabled&&musicEnabled&&started)playActive()}
  const timer=setTimeout(()=>{if(epoch===generation)decks[old].pause();fades.delete(old)},2400);fades.set(old,timer);notify();
 }
 async function playActive(){
  if(!desired||!enabled||!musicEnabled||disposed)return;const epoch=generation,deck=decks[active];try{await deck.play();if(epoch!==generation){deck.pause();return}ramp(gains?.[active],1,1.7);waiting=false;unavailable=false;notify()}catch(error){if(epoch!==generation)return;if(error.name==='NotAllowedError'){waiting=true}else if(error.name!=='AbortError'){unavailable=true}notify()}
 }
 async function unlock(){
  if(!enabled||disposed)return;try{initialize();const resume=ctx.resume();const playback=desired&&musicEnabled?playActive():Promise.resolve();await Promise.all([resume,playback]);started=ctx.state==='running';waiting=!started;applyVolume();environment();notify()}catch{unavailable=true;notify()}
 }
 function droplet(proximity){if(!ctx||ctx.state!=='running')return;const t=ctx.currentTime,osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';const pitch=240+Math.random()*480;osc.frequency.setValueAtTime(pitch,t);osc.frequency.exponentialRampToValueAtTime(pitch*.5,t+.13);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.014*proximity,t+.008);gain.gain.exponentialRampToValueAtTime(.0001,t+.18);osc.connect(gain);gain.connect(environmentBus);osc.start(t);osc.stop(t+.2);osc.onended=()=>{osc.disconnect();gain.disconnect()}}
 function environment(){
  if(!ctx||!started||document.hidden)return;let pos;try{pos=window.eldervaleGetPlayerPosition?.()}catch{}
  const proximity=mode==='login'?0:Math.max(waterProximity(pos),window.eldervaleGetWaterSoundProximity?.()||0);
  ramp(water.gain,proximity*.035,1.4);
  const kind=window.eldervaleWorldNight===true?'crickets':'birds';if(kind!==lastNatureKind){lastNatureKind=kind;lastBird=0;}if(enabled&&environmentEnabled&&mode!=='login'&&Date.now()>lastBird){const played=nature?.play(kind);lastBird=Date.now()+(played?(kind==='crickets'?16000+Math.random()*9000:6500+Math.random()*9000):500)}
  if(enabled&&environmentEnabled&&proximity>.1&&Date.now()>lastWater){droplet(proximity);lastWater=Date.now()+450+Math.random()*1100}

 }
 function tick(){if(disposed)return;const overlay=document.querySelector('#auth-screen');if(mode==='login'&&overlay?.hidden&&window.eldervaleGetPlayerPosition)mode='world';if(mode==='login'){zone=null;transition(loginMusic)}else{let pos;try{pos=window.eldervaleGetPlayerPosition?.()}catch{}zone=musicRegion(pos,zone);transition(zone)}environment()}
 function setScene(next){mode=next;zone=null;tick();notify()}
 function hoof({volume:gainValue=1,hard=false,front=false,pan=0}={}){
  if(!enabled||!environmentEnabled||!ctx||ctx.state!=='running'||document.hidden||gainValue<=0)return;
  // Clip-clop: a hollow hoof-wall knock (pitched, quickly falling), a short
  // grit click from the ground and a soft low thud. Hard ground rings higher.
  const t=ctx.currentTime+.002,level=Math.min(1,gainValue)*(front?.85:1),vary=.92+Math.random()*.16,out=ctx.createGain(),panner=ctx.createStereoPanner();
  out.gain.value=level;panner.pan.value=Math.max(-1,Math.min(1,pan));out.connect(panner);panner.connect(environmentBus);
  const parts=[];const env=(node,peak,attack,decay)=>{const g=ctx.createGain();g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(peak,t+attack);g.gain.exponentialRampToValueAtTime(.0001,t+attack+decay);node.connect(g);g.connect(out);parts.push(node,g);return g};
  const knock=ctx.createOscillator();knock.type='triangle';const pitch=(hard?640:390)*vary*(front?1.08:1);knock.frequency.setValueAtTime(pitch,t);knock.frequency.exponentialRampToValueAtTime(pitch*.55,t+.07);env(knock,hard?.34:.26,.003,hard?.075:.06);
  const noise=ctx.createBufferSource(),band=ctx.createBiquadFilter();noise.buffer=noiseBuffer;band.type='bandpass';band.frequency.value=hard?2600:1100;band.Q.value=hard?1.6:.8;noise.connect(band);parts.push(band);env(band,hard?.5:.32,.002,hard?.035:.05);
  const thud=ctx.createOscillator();thud.type='sine';thud.frequency.setValueAtTime(hard?120:95,t);thud.frequency.exponentialRampToValueAtTime(48,t+.1);env(thud,hard?.16:.24,.004,.11);
  for(const source of [knock,noise,thud]){source.start(t,source===noise?Math.random()*3:undefined);source.stop(t+.16)}
  thud.onended=()=>{for(const n of parts)n.disconnect();out.disconnect();panner.disconnect()};
 }
 function celebrate(){if(!enabled||document.hidden)return false;celebration?.pause();const audio=new Audio('/assets/audio/level-up.mp3');celebration=audio;audio.volume=volume/100;audio.setAttribute('playsinline','');ramp(musicBus,enabled&&musicEnabled?volume/100*.18:0,.12);audio.addEventListener('ended',()=>{if(celebration===audio){celebration=null;applyVolume()}});void audio.play().catch(()=>{if(celebration===audio){celebration=null;applyVolume()}});return true;}
 function toggleMaster(){enabled=!enabled;storage.setItem('eldervale-audio-enabled',String(enabled));applyVolume();if(enabled)unlock();notify()}
 function toggleMusic(){musicEnabled=!musicEnabled;storage.setItem('eldervale-music-enabled',String(musicEnabled));applyVolume();if(musicEnabled&&enabled)unlock();notify()}
 function toggleEnvironment(){environmentEnabled=!environmentEnabled;storage.setItem('eldervale-environment-enabled',String(environmentEnabled));applyVolume();if(environmentEnabled&&enabled)unlock();notify()}
 function onInput(event){if(event.target.id==='music-volume'){volume=Number(event.target.value);storage.setItem('eldervale-music-volume',String(volume));applyVolume();notify()}else if(event.target.id==='environment-volume'){environmentVolume=Number(event.target.value);storage.setItem('eldervale-environment-volume',String(environmentVolume));applyVolume();notify()}}
 function onClick(event){if(event.target.closest('#music-toggle'))toggleMusic();if(event.target.closest('#environment-toggle'))toggleEnvironment()}
 function interaction(){if(enabled&&(!started||ctx?.state!=='running'))unlock()}
 function onVisible(){if(document.hidden){celebration?.pause();decks.forEach(deck=>deck.pause());ctx?.suspend().catch(()=>{})}else if(enabled)unlock()}
 function onPageHide(event){if(event.persisted){ctx?.suspend().catch(()=>{})}else api.dispose()}
 const timer=setInterval(tick,1000);document.addEventListener('pointerdown',interaction,{capture:true});document.addEventListener('keydown',interaction,{capture:true});document.addEventListener('input',onInput);document.addEventListener('click',onClick);document.addEventListener('visibilitychange',onVisible);window.addEventListener('pagehide',onPageHide);
 const api={celebrate,hoof,setScene,toggleMaster,toggleMusic,toggleEnvironment,unlock,getState:state,subscribe(listener){listeners.add(listener);listener(state());return ()=>listeners.delete(listener)},dispose(){disposed=true;celebration?.pause();nature?.dispose();clearInterval(timer);for(const timeout of fades.values())clearTimeout(timeout);for(const source of sources){try{source.stop()}catch{}}decks.forEach(deck=>{deck.pause();deck.removeAttribute('src');deck.load()});ctx?.close().catch(()=>{});document.removeEventListener('pointerdown',interaction,{capture:true});document.removeEventListener('keydown',interaction,{capture:true});document.removeEventListener('input',onInput);document.removeEventListener('click',onClick);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('pagehide',onPageHide);listeners.clear();singleton=null}};
 singleton=api;tick();notify();if(enabled)unlock();return api;
}

export function playHorseHoof(options){singleton?.hoof(options);}

export function playLevelUpJingle(){return singleton?.celebrate()||false;}
