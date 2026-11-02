// Original Eldervale dark-medieval score: brass fanfares, war drums, low strings and bells.
// Synthesized with Web Audio. No copyrighted recordings or third-party audio assets.
export function startMusic(){
 const button=document.querySelector('#music-toggle'),slider=document.querySelector('#music-volume'),label=document.querySelector('#music-track');
 if(!button||!slider)return;
 let ctx=null,master=null,timer=null,playing=false,step=0,track=0,nextTime=0;
 const scores=[
  {name:'The Iron March',bpm:76,roots:[45,41,43,40,45,41,38,43],melody:[69,69,72,76,74,72,69,null,67,69,72,74,72,69,67,null,69,72,76,79,77,76,72,null,74,72,69,67,65,67,69,null]},
  {name:'Bells of Oakcross',bpm:68,roots:[50,46,48,43,50,46,41,45],melody:[74,null,77,76,74,72,70,null,69,70,74,null,72,69,67,null,74,77,79,77,74,72,69,null,70,72,74,72,69,67,65,null]},
  {name:'The Hollow Keep',bpm:72,roots:[43,39,41,38,43,46,41,38],melody:[67,70,74,null,72,70,67,65,63,65,67,null,70,67,65,null,67,70,75,74,72,70,67,null,65,67,70,72,70,67,63,null]}
 ];
 const midi=n=>440*Math.pow(2,(n-69)/12);
 function tone(note,time,duration,instrument='horn',level=.10){
  if(!ctx||!master||note==null)return;
  const f=midi(note),out=ctx.createGain(),filter=ctx.createBiquadFilter(),partials=[];
  filter.type='lowpass';filter.frequency.setValueAtTime(instrument==='horn'?800:instrument==='strings'?1250:2300,time);
  const attack=instrument==='horn'?.095:instrument==='strings'?.18:.008;
  const release=Math.min(instrument==='strings'?.45:.32,duration*.42);
  out.gain.setValueAtTime(.0001,time);
  out.gain.exponentialRampToValueAtTime(Math.max(.001,level),time+Math.min(attack,duration*.4));
  out.gain.setValueAtTime(Math.max(.001,level*.72),time+Math.max(attack+.01,duration-release));
  out.gain.exponentialRampToValueAtTime(.0001,time+duration);
  const harmonics=instrument==='horn'?[[1,1],[2,.38],[3,.18],[4,.09]]:instrument==='strings'?[[1,1],[2,.22],[3,.10]]:[[1,1],[2,.22],[4,.07]];
  for(const [mult,amp] of harmonics){const osc=ctx.createOscillator(),g=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(f*mult,time);g.gain.value=amp/harmonics.length;osc.connect(g);g.connect(filter);osc.start(time);osc.stop(time+duration+.025);partials.push([osc,g])}
  filter.connect(out);out.connect(master);
  partials[0][0].onended=()=>{for(const [osc,g] of partials){osc.disconnect();g.disconnect()}filter.disconnect();out.disconnect()}
 }
 function drum(time,strong=false){
  const osc=ctx.createOscillator(),gain=ctx.createGain();osc.type='sine';osc.frequency.setValueAtTime(strong?105:140,time);osc.frequency.exponentialRampToValueAtTime(43,time+.16);
  gain.gain.setValueAtTime(strong?.12:.055,time);gain.gain.exponentialRampToValueAtTime(.0001,time+.24);
  osc.connect(gain);gain.connect(master);osc.start(time);osc.stop(time+.25);osc.onended=()=>{osc.disconnect();gain.disconnect()}
 }
 function schedule(){
  if(!playing||!ctx)return;
  const score=scores[track],beat=60/score.bpm,interval=beat/2;
  while(nextTime<ctx.currentTime+.36){
   const i=step%32,bar=Math.floor(i/4),root=score.roots[bar];
   if(i%4===0){tone(root-12,nextTime,beat*1.85,'strings',.095);tone(root,nextTime,beat*1.8,'strings',.038);tone(root+7,nextTime,beat*1.6,'strings',.024);drum(nextTime,true)}
   if(i%4===2)drum(nextTime,false);
   if(i%8===4)tone(root+12,nextTime,beat*1.5,'horn',.04);
   if(i%2===0&&score.melody[i]!=null)tone(score.melody[i],nextTime,beat*.86,'horn',.12);
   if(i%8===6)tone(root+19,nextTime,beat*1.8,'bell',.025);
   step++;nextTime+=interval;
   if(step%128===0){track=(track+1)%scores.length;label.textContent=scores[track].name}
  }
 }
 async function toggle(){
  try{
   if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.connect(ctx.destination)}
   if(playing){playing=false;clearInterval(timer);await ctx.suspend();button.textContent='♫ Music Off';button.setAttribute('aria-pressed','false');return}
   await ctx.resume();master.gain.setTargetAtTime(Number(slider.value)/100*.58,ctx.currentTime,.05);
   nextTime=ctx.currentTime+.06;playing=true;timer=setInterval(schedule,100);schedule();
   button.textContent='♫ Music On';button.setAttribute('aria-pressed','true');label.textContent=scores[track].name
  }catch(err){label.textContent='Audio unavailable in this browser';console.warn('Eldervale music:',err)}
 }
 button.addEventListener('click',toggle);
 slider.addEventListener('input',()=>{localStorage.setItem('eldervale-music-volume',slider.value);if(ctx&&master)master.gain.setTargetAtTime(Number(slider.value)/100*.58,ctx.currentTime,.04)});
 const saved=Number(localStorage.getItem('eldervale-music-volume'));slider.value=Number.isFinite(saved)&&saved>=0&&saved<=100?String(saved):'45';
 window.addEventListener('pagehide',()=>{playing=false;clearInterval(timer);ctx?.close()},{once:true});
}
