// Original Eldervale tavern-and-wilderness score, synthesized locally with Web Audio.
// No copyrighted game recordings or third-party audio files are used.
export function startMusic(){
 const button=document.querySelector('#music-toggle'),slider=document.querySelector('#music-volume'),label=document.querySelector('#music-track');
 if(!button||!slider)return;
 let ctx=null,master=null,timer=null,playing=false,step=0,track=0,nextTime=0;
 const scores=[
  {name:'Wandering the Heartlands',bpm:94,roots:[57,53,60,55,57,53,55,52],melody:[69,72,76,72,69,67,65,67,69,72,74,72,67,65,64,67,69,72,76,79,77,76,72,69,67,69,72,67,65,64,62,64]},
  {name:'Oakcross Village',bpm:106,roots:[60,55,57,53,60,55,53,55],melody:[72,76,79,76,74,72,71,72,76,79,81,79,76,74,72,74,72,76,79,84,83,79,76,74,72,74,76,72,71,69,67,71]},
  {name:'Moonlit Ruins',bpm:82,roots:[50,46,53,48,50,46,48,45],melody:[74,77,81,77,74,72,69,72,74,77,79,77,72,69,67,69,74,77,81,84,82,81,77,74,72,74,77,72,69,67,65,69]}
 ];
 const midi=n=>440*Math.pow(2,(n-69)/12);
 function voice(note,time,duration,type='triangle',level=.12){
  if(!ctx||!master)return;
  const osc=ctx.createOscillator(),gain=ctx.createGain(),filter=ctx.createBiquadFilter();
  osc.type=type;osc.frequency.setValueAtTime(midi(note),time);
  filter.type='lowpass';filter.frequency.value=type==='sine'?950:1750;
  const attack=.015,release=Math.min(.26,duration*.45);
  gain.gain.setValueAtTime(.0001,time);gain.gain.exponentialRampToValueAtTime(Math.max(level,.001),time+attack);
  gain.gain.setValueAtTime(Math.max(level*.65,.001),time+Math.max(attack+.005,duration-release));
  gain.gain.exponentialRampToValueAtTime(.0001,time+duration);
  osc.connect(filter);filter.connect(gain);gain.connect(master);osc.start(time);osc.stop(time+duration+.02);
  osc.onended=()=>{osc.disconnect();filter.disconnect();gain.disconnect()};
 }
 function schedule(){
  if(!playing||!ctx)return;
  const score=scores[track],beat=60/score.bpm,interval=beat/2;
  while(nextTime<ctx.currentTime+.32){
   const i=step%32,bar=Math.floor(i/4),root=score.roots[bar];
   if(i%4===0){voice(root-12,nextTime,beat*1.75,'sine',.11);voice(root+7,nextTime,beat*1.6,'triangle',.028);voice(root+12,nextTime,beat*1.6,'triangle',.02)}
   if(i%2===0)voice(root+12+(i%4===0?0:7),nextTime,beat*.48,'sine',.036);
   if(i%8!==7)voice(score.melody[i],nextTime,interval*.88,'triangle',.085);
   if(i%4===2)voice(root+19,nextTime,beat*.58,'sine',.024);
   step++;nextTime+=interval;
   if(step%128===0){track=(track+1)%scores.length;label.textContent=scores[track].name}
  }
 }
 async function toggle(){
  try{
   if(!ctx){ctx=new (window.AudioContext||window.webkitAudioContext)();master=ctx.createGain();master.connect(ctx.destination)}
   if(playing){playing=false;clearInterval(timer);await ctx.suspend();button.textContent='♫ Music Off';button.setAttribute('aria-pressed','false');return}
   await ctx.resume();master.gain.setTargetAtTime(Number(slider.value)/100*.7,ctx.currentTime,.05);
   nextTime=ctx.currentTime+.06;playing=true;timer=setInterval(schedule,100);schedule();
   button.textContent='♫ Music On';button.setAttribute('aria-pressed','true');label.textContent=scores[track].name
  }catch(err){label.textContent='Audio unavailable in this browser';console.warn('Eldervale music:',err)}
 }
 button.addEventListener('click',toggle);
 slider.addEventListener('input',()=>{localStorage.setItem('eldervale-music-volume',slider.value);if(ctx&&master)master.gain.setTargetAtTime(Number(slider.value)/100*.7,ctx.currentTime,.04)});
 const saved=Number(localStorage.getItem('eldervale-music-volume'));slider.value=Number.isFinite(saved)&&saved>=0&&saved<=100?String(saved):'45';
 window.addEventListener('pagehide',()=>{playing=false;clearInterval(timer);ctx?.close()},{once:true});
}
