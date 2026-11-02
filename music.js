// Eldervale original medieval-fantasy brass band score. Generated locally with Web Audio.
export function startMusic(){
 const button=document.querySelector('#music-toggle'),slider=document.querySelector('#music-volume'),label=document.querySelector('#music-track');
 if(!button||!slider)return;button.textContent='Music Off';
 let ctx,master,timer,playing=false,musicMuted=false,step=0,track=window.eldervaleAudioRegion?0:3,nextTime=0;
 let region=window.eldervaleAudioRegion||'Login',desiredRegion=region;
 const townThemes={'Login':3,'Oakcross':0,'Northwatch':2,'Eastmarch':1,'Old Cairn':2,'Farwatch':1,'Westmere':0,'Stonebridge':1,'Suncrest':1,'Greenwatch':0,'Ashen Ruins':2};
 const regionOffsets={'Oakcross':0,'Northwatch':-2,'Eastmarch':2,'Old Cairn':-5,'Farwatch':4,'Westmere':-3,'Stonebridge':5,'Suncrest':7,'Greenwatch':-1,'Ashen Ruins':-7};
 window.eldervaleSetAudioRegion=(name)=>{desiredRegion=Object.hasOwn(townThemes,name)?name:'Wilderness'};
 const settingsToggle=document.querySelector('#settings-music-toggle'),settingsVolume=document.querySelector('#settings-music-volume');
 const ambientVolume=document.querySelector('#ambient-volume');let ambienceGain,windSource;
 function startAmbience(){
  if(!ctx||ambienceGain)return;
  const buffer=ctx.createBuffer(1,ctx.sampleRate*2,ctx.sampleRate),data=buffer.getChannelData(0);
  // Deterministic low-level wind noise; generated locally, no network audio files.
  let seed=1234567;for(let i=0;i<data.length;i++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;data[i]=(seed/2147483648-1)*.3}
  const source=ctx.createBufferSource(),filter=ctx.createBiquadFilter();source.buffer=buffer;source.loop=true;filter.type='lowpass';filter.frequency.value=320;
  ambienceGain=ctx.createGain();source.connect(filter);filter.connect(ambienceGain);ambienceGain.connect(ctx.destination);source.start();windSource=source;updateAmbience();
 }
 function updateAmbience(){if(ambienceGain&&ctx){const v=ambientVolume?Number(ambientVolume.value)/100:.3;ambienceGain.gain.setTargetAtTime(region==='Wilderness'?v*.15:v*.035,ctx.currentTime,.8)}}
 if(ambientVolume){const stored=localStorage.getItem('eldervale-ambient-volume');ambientVolume.value=stored===null?'30':stored;ambientVolume.addEventListener('input',()=>{localStorage.setItem('eldervale-ambient-volume',ambientVolume.value);updateAmbience()})}
 // Four-bar phrases in concert pitch; quarter-note melody with rests and sustained cadences.
 const songs=[
 {name:'Banner of Oakcross',bpm:106,key:0,roots:[48,53,55,48,57,53,55,48],
 melody:[72,72,76,79,81,79,76,74,72,76,77,76,74,72,71,null,72,74,76,79,84,81,79,76,77,76,74,71,72,null,72,null],
 counter:[60,null,64,null,65,null,64,null,60,null,62,null,59,null,55,null,60,null,64,null,65,null,67,null,62,null,59,null,60,null,60,null]},
 {name:'The Royal Procession',bpm:94,key:0,roots:[43,48,50,43,52,48,50,43],
 melody:[67,71,74,79,78,76,74,null,72,74,76,78,79,null,74,null,79,79,81,79,76,74,72,71,74,76,78,76,74,71,67,null],
 counter:[55,null,59,null,60,null,59,null,57,null,60,null,62,null,59,null,55,null,59,null,60,null,62,null,59,null,57,null,55,null,55,null]},
 {name:'March of the Iron Guard',bpm:112,key:0,roots:[45,50,52,45,53,50,52,45],
 melody:[69,72,76,76,74,72,69,null,71,74,77,76,74,72,71,null,72,76,81,79,77,76,74,72,74,76,77,76,72,71,69,null],
 counter:[57,null,60,null,62,null,60,null,59,null,62,null,64,null,62,null,57,null,60,null,65,null,64,null,62,null,60,null,57,null,57,null]}
 ];
 // Original low-register modal entrance theme, distinct from the settlement marches.
 songs.push({name:'The Gates of Eldervale',bpm:64,key:0,roots:[38,38,41,36,38,43,41,38],
 melody:[62,null,65,null,67,null,65,null,60,null,62,null,58,null,57,null,62,null,69,null,67,null,65,null,60,null,58,null,62,null,null,null],
 counter:[50,null,null,null,53,null,null,null,48,null,null,null,46,null,null,null,50,null,null,null,55,null,null,null,48,null,null,null,50,null,null,null]});
 const freq=n=>440*Math.pow(2,(n-69)/12);
 function brass(n,t,len,kind='trumpet',vol=.07){
  if(n==null)return;
  const f=freq(n),out=ctx.createGain(),filter=ctx.createBiquadFilter();
  const isLow=kind==='tuba',isHorn=kind==='horn',attack=isLow?.075:isHorn?.065:.028;
  filter.type='lowpass';filter.frequency.setValueAtTime(isLow?640:isHorn?1050:1750,t);
  filter.frequency.linearRampToValueAtTime(isLow?950:isHorn?1700:2800,t+Math.min(.16,len*.35));
  filter.Q.value=.7;
  out.gain.setValueAtTime(.0001,t);
  out.gain.linearRampToValueAtTime(vol,t+Math.min(attack,len*.32));
  out.gain.setValueAtTime(vol*.82,t+len*.55);
  out.gain.exponentialRampToValueAtTime(.0001,t+len);
  const partials=isLow?[1,.58,.30,.14,.07]:isHorn?[1,.72,.36,.19,.08]:[1,.95,.53,.28,.13,.06];
  const nodes=[];
  partials.forEach((amp,i)=>{const o=ctx.createOscillator(),g=ctx.createGain();o.type=i===0?'sawtooth':'sine';o.frequency.setValueAtTime(f*(i+1),t);g.gain.value=amp/(i===0?5:3.5);o.connect(g);g.connect(filter);o.start(t);o.stop(t+len+.025);nodes.push([o,g])});
  filter.connect(out);out.connect(master);
  nodes[0][0].onended=()=>{nodes.forEach(([o,g])=>{o.disconnect();g.disconnect()});filter.disconnect();out.disconnect()};
 }
 function percussion(t,accent=false,kind='drum'){
  const osc=ctx.createOscillator(),gain=ctx.createGain();
  osc.type=kind==='cymbal'?'triangle':'sine';
  osc.frequency.setValueAtTime(kind==='cymbal'?850:accent?135:175,t);
  osc.frequency.exponentialRampToValueAtTime(kind==='cymbal'?210:48,t+.14);
  gain.gain.setValueAtTime(kind==='cymbal'?.026:accent?.105:.05,t);
  gain.gain.exponentialRampToValueAtTime(.0001,t+(kind==='cymbal'?.35:.20));
  osc.connect(gain);gain.connect(master);osc.start(t);osc.stop(t+.38);
  osc.onended=()=>{osc.disconnect();gain.disconnect()};
 }
 function schedule(){
  if(!playing||!ctx)return;
  const quarter=60/songs[track].bpm;
  while(nextTime<ctx.currentTime+.4){
   if(region!==desiredRegion){region=desiredRegion;track=townThemes[region]??0;updateAmbience();label.textContent=region==='Wilderness'?'Wilderness ambience':region+' · '+songs[track].name}
   const currentSong=songs[track],i=step%32,bar=Math.floor(i/4),transpose=regionOffsets[region]||0,root=currentSong.roots[bar]+transpose;
   // Bass line and two supporting voices give the march a full brass-ensemble texture.
   if(region!=='Wilderness')brass(root-12,nextTime,quarter*.90,'tuba',.085);
   if(i%2===0&&region!=='Wilderness'){brass(root,nextTime,quarter*1.78,'horn',.043);brass(root+7,nextTime,quarter*1.7,'horn',.028)}
   if(i%4===0&&region!=='Wilderness'){brass(root+12,nextTime,quarter*2.6,'horn',.032);percussion(nextTime,true)}
   else if(i%2===0&&region!=='Wilderness')percussion(nextTime,false);
   if(i%8===0&&region!=='Wilderness')percussion(nextTime,false,'cymbal');
   const note=currentSong.melody[i];
   if(note!=null&&region!=='Wilderness')brass(note+transpose,nextTime,quarter*(i%8===6?1.7:.84),'trumpet',.084);
   if(currentSong.counter[i]!=null&&region!=='Wilderness')brass(currentSong.counter[i]+transpose,nextTime,quarter*1.8,'horn',.044);
   step++;nextTime+=quarter;
   if(region==='Wilderness')label.textContent='Wilderness ambience';
  }
 }
 async function toggle(){
  try{
   if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();const limiter=ctx.createDynamicsCompressor();limiter.threshold.value=-15;limiter.ratio.value=4;master.connect(limiter);limiter.connect(ctx.destination)}
   if(playing){musicMuted=!musicMuted;master.gain.setTargetAtTime(musicMuted?0:Number(slider.value)/100*.5,ctx.currentTime,.08);button.textContent=musicMuted?'Music Off':'Music On';button.setAttribute('aria-pressed',String(!musicMuted));if(settingsToggle){settingsToggle.textContent=musicMuted?'Unmute music':'Mute music';settingsToggle.setAttribute('aria-pressed',String(!musicMuted))}return}
   await ctx.resume();startAmbience();master.gain.setTargetAtTime(Number(slider.value)/100*.5,ctx.currentTime,.05);
   nextTime=ctx.currentTime+.08;playing=true;timer=setInterval(schedule,90);schedule();
   button.textContent='Music On';button.setAttribute('aria-pressed','true');label.textContent=region==='Wilderness'?'Wilderness ambience':region+' · '+songs[track].name;
  }catch(err){label.textContent='Audio unavailable';console.warn('Eldervale music:',err)}
 }
 button.addEventListener('click',toggle);
 settingsToggle?.addEventListener('click',toggle);
 // Start music on the first user interaction permitted by the browser.
 document.addEventListener('pointerdown',event=>{if(!playing&&!event.target.closest('#music-toggle'))toggle()},{once:true});
 document.addEventListener('keydown',event=>{if(!playing&&!event.repeat&&!event.target.closest('#music-toggle'))toggle()},{once:true});
 slider.addEventListener('input',()=>{if(settingsVolume)settingsVolume.value=slider.value;localStorage.setItem('eldervale-music-volume',slider.value);if(ctx&&master)master.gain.setTargetAtTime(musicMuted?0:Number(slider.value)/100*.5,ctx.currentTime,.04)});
 settingsVolume?.addEventListener('input',()=>{slider.value=settingsVolume.value;slider.dispatchEvent(new Event('input',{bubbles:true}))});
 const stored=localStorage.getItem('eldervale-music-volume');const saved=stored===null?45:Number(stored);slider.value=Number.isFinite(saved)&&saved>=0&&saved<=100?String(saved):'45';if(settingsVolume)settingsVolume.value=slider.value;
 window.addEventListener('pagehide',()=>{playing=false;clearInterval(timer);windSource?.stop();ctx?.close()},{once:true});
}
