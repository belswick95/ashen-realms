import {townMusic,loginMusic,musicRegion,wildernessSound,audioPreference} from './audio-regions.js?v=release-20261103-builder5';
let singleton;
// One audio engine spans sign-in and gameplay. Music and environment have
// separate buses; natural ambience is never represented as a music track.
export function startMusic({scene='world'}={}){
 if(singleton){singleton.setScene(scene);return singleton}
 const storage=localStorage,listeners=new Set(),decks=[new Audio(),new Audio()];
 let mode=scene,zone=null,desired=null,active=0,generation=0,ctx,musicBus,environmentBus,gains,wind,water,rustle,noiseBuffer,started=false,waiting=false,unavailable=false,disposed=false,previousEnvironment='',lastBird=0;
 let enabled=storage.getItem('eldervale-audio-enabled')!=='false',musicEnabled=storage.getItem('eldervale-music-enabled')===null?storage.getItem('eldervale-music-muted')!=='true':storage.getItem('eldervale-music-enabled')!=='false',environmentEnabled=storage.getItem('eldervale-environment-enabled')!=='false';
 let volume=audioPreference(storage,'eldervale-music-volume',45),environmentVolume=audioPreference(storage,'eldervale-environment-volume',audioPreference(storage,'eldervale-ambient-volume',35));
 const fades=new Map(),sources=[];
 decks.forEach(deck=>{deck.loop=true;deck.preload='none';deck.setAttribute('playsinline','');deck.addEventListener('error',()=>{if(deck===decks[active]&&enabled){unavailable=true;notify()}})});
 function state(){return {scene:mode,zone:zone?.id||null,track:desired?.title||null,enabled,musicEnabled,environmentEnabled,volume,environmentVolume,status:unavailable?'unavailable':!enabled?'muted':waiting?'waiting':started?'playing':'waiting',context:ctx?.state||'not-started'}}
 function notify(){for(const listener of listeners)listener(state());const b=document.querySelector('#music-toggle'),s=document.querySelector('#music-volume'),label=document.querySelector('#music-track');if(b){b.textContent=musicEnabled?'♫ Music on':'♫ Music off';b.setAttribute('aria-pressed',String(musicEnabled))}if(s)s.value=String(volume);if(label)label.textContent=desired?desired.title+' · Kevin MacLeod':'No town music';const e=document.querySelector('#environment-toggle'),v=document.querySelector('#environment-volume');if(e){e.textContent=environmentEnabled?'Environment on':'Environment off';e.setAttribute('aria-pressed',String(environmentEnabled))}if(v)v.value=String(environmentVolume)}
 function ramp(gain,value,duration=.7){if(!gain||!ctx)return;gain.gain.cancelScheduledValues(ctx.currentTime);gain.gain.setTargetAtTime(value,ctx.currentTime,duration/4)}
 function makeNoise(){const buffer=ctx.createBuffer(1,ctx.sampleRate*4,ctx.sampleRate),data=buffer.getChannelData(0);let seed=1729;for(let i=0;i<data.length;i++){seed=(1664525*seed+1013904223)>>>0;data[i]=seed/2147483648-1}return buffer}
 function noiseLayer(type,frequency,q,gain){const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter(),out=ctx.createGain();source.buffer=noiseBuffer;source.loop=true;filter.type=type;filter.frequency.value=frequency;filter.Q.value=q;out.gain.value=gain;source.connect(filter);filter.connect(out);out.connect(environmentBus);source.start();sources.push(source);return {gain:out,filter}}
 function initialize(){
  if(ctx)return;const Context=window.AudioContext||window.webkitAudioContext;if(!Context)throw Error('Web Audio unavailable');ctx=new Context();musicBus=ctx.createGain();environmentBus=ctx.createGain();const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-10;limiter.ratio.value=5;musicBus.connect(limiter);environmentBus.connect(limiter);limiter.connect(ctx.destination);gains=decks.map(deck=>{const source=ctx.createMediaElementSource(deck),gain=ctx.createGain();gain.gain.value=0;source.connect(gain);gain.connect(musicBus);return gain});noiseBuffer=makeNoise();wind=noiseLayer('lowpass',430,.4,0);water=noiseLayer('bandpass',1050,.45,0);rustle=noiseLayer('highpass',2100,.5,0);applyVolume();ctx.addEventListener('statechange',()=>{if(ctx.state==='suspended'&&enabled){waiting=true;notify()}});
 }
 function applyVolume(){ramp(musicBus,enabled&&musicEnabled?volume/100*.7:0,.2);ramp(environmentBus,enabled&&environmentEnabled?environmentVolume/100:0,.3);if(!enabled||!musicEnabled)decks.forEach(deck=>deck.pause())}
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
 function bird(night=false){if(!ctx||ctx.state!=='running')return;for(let i=0;i<2;i++){const t=ctx.currentTime+i*.16,osc=ctx.createOscillator(),gain=ctx.createGain(),pan=ctx.createStereoPanner?.();osc.type='sine';const base=night?480+Math.random()*180:1900+Math.random()*1400;osc.frequency.setValueAtTime(base,t);osc.frequency.exponentialRampToValueAtTime(base*1.38,t+.05);osc.frequency.exponentialRampToValueAtTime(base*.72,t+.15);gain.gain.setValueAtTime(0,t);gain.gain.linearRampToValueAtTime(.018,t+.025);gain.gain.exponentialRampToValueAtTime(.0001,t+.19);osc.connect(gain);if(pan){pan.pan.value=Math.random()*1.6-.8;gain.connect(pan);pan.connect(environmentBus)}else gain.connect(environmentBus);osc.start(t);osc.stop(t+.21);osc.onended=()=>{osc.disconnect();gain.disconnect();pan?.disconnect()}}}
 function environment(){
  if(!ctx||!started)return;let pos;try{pos=window.eldervaleGetPlayerPosition?.()}catch{}const sound=mode==='login'?'fire':zone?'town':wildernessSound(pos);
  if(sound!==previousEnvironment){previousEnvironment=sound;ramp(wind.gain,sound==='highlands'?.19:sound==='forest'?.10:sound==='water'?.07:0,3);ramp(water.gain,sound==='water'?.12:0,3);ramp(rustle.gain,sound==='fire'?.016:sound==='forest'?.012:0,3);}
  if(enabled&&environmentEnabled&&sound==='forest'&&Date.now()>lastBird){bird(window.eldervaleWorldNight===true);lastBird=Date.now()+6000+Math.random()*8000}
 }
 function tick(){if(disposed)return;const overlay=document.querySelector('#auth-screen');if(mode==='login'&&overlay?.hidden&&window.eldervaleGetPlayerPosition)mode='world';if(mode==='login'){zone=null;transition(loginMusic)}else{let pos;try{pos=window.eldervaleGetPlayerPosition?.()}catch{}zone=musicRegion(pos,zone);transition(zone)}environment()}
 function setScene(next){mode=next;zone=null;tick();notify()}
 function toggleMaster(){enabled=!enabled;storage.setItem('eldervale-audio-enabled',String(enabled));applyVolume();if(enabled)unlock();notify()}
 function toggleMusic(){musicEnabled=!musicEnabled;storage.setItem('eldervale-music-enabled',String(musicEnabled));applyVolume();if(musicEnabled&&enabled)unlock();notify()}
 function toggleEnvironment(){environmentEnabled=!environmentEnabled;storage.setItem('eldervale-environment-enabled',String(environmentEnabled));applyVolume();if(environmentEnabled&&enabled)unlock();notify()}
 function onInput(event){if(event.target.id==='music-volume'){volume=Number(event.target.value);storage.setItem('eldervale-music-volume',String(volume));applyVolume();notify()}else if(event.target.id==='environment-volume'){environmentVolume=Number(event.target.value);storage.setItem('eldervale-environment-volume',String(environmentVolume));applyVolume();notify()}}
 function onClick(event){if(event.target.closest('#music-toggle'))toggleMusic();if(event.target.closest('#environment-toggle'))toggleEnvironment()}
 function interaction(){if(enabled&&(!started||ctx?.state!=='running'))unlock()}
 function onVisible(){if(document.hidden){decks.forEach(deck=>deck.pause());ctx?.suspend().catch(()=>{})}else if(enabled)unlock()}
 function onPageHide(event){if(event.persisted){ctx?.suspend().catch(()=>{})}else api.dispose()}
 const timer=setInterval(tick,1000);document.addEventListener('pointerdown',interaction,{capture:true});document.addEventListener('keydown',interaction,{capture:true});document.addEventListener('input',onInput);document.addEventListener('click',onClick);document.addEventListener('visibilitychange',onVisible);window.addEventListener('pagehide',onPageHide);
 const api={setScene,toggleMaster,toggleMusic,toggleEnvironment,unlock,getState:state,subscribe(listener){listeners.add(listener);listener(state());return ()=>listeners.delete(listener)},dispose(){disposed=true;clearInterval(timer);for(const timeout of fades.values())clearTimeout(timeout);for(const source of sources){try{source.stop()}catch{}}decks.forEach(deck=>{deck.pause();deck.removeAttribute('src');deck.load()});ctx?.close().catch(()=>{});document.removeEventListener('pointerdown',interaction,{capture:true});document.removeEventListener('keydown',interaction,{capture:true});document.removeEventListener('input',onInput);document.removeEventListener('click',onClick);document.removeEventListener('visibilitychange',onVisible);window.removeEventListener('pagehide',onPageHide);listeners.clear();singleton=null}};
 singleton=api;tick();notify();if(enabled)unlock();return api;
}
