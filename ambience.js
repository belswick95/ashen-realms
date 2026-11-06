// Area sounds (RuneScape's "area sounds" channel): looping beds that crossfade
// with the world clock and your surroundings, plus randomised one-shots —
// several bird species by day; crickets, frogs and an owl at night; flowing
// water by rivers and lakes; wind (strongest in the Winterwatch snow); a low
// rumble and crackle around Emberspire; and in towns a market murmur, carts,
// dogs, a smithy's hammer and chapel bells. Nothing is a short obvious loop:
// beds restart at random offsets with long crossfades, one-shots vary in
// timing, pitch, level and position.
import {BED_FILES} from './sfx.js?v=release-20261106-skills86';

const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
// Bed levels (0..1) for the current surroundings. `day` is 1 at noon, 0 at night.
export function ambienceMix({day=1,water=0,town=0,farm=0,forest=.5,snow=0,ember=0,indoors=0}={}){
 day=clamp(day);water=clamp(water);town=clamp(town);farm=clamp(farm);forest=clamp(forest);snow=clamp(snow);ember=clamp(ember);const out=1-.65*clamp(indoors);
 return {
  birds:.55*day*(.45+.55*forest)*(1-.45*town)*(1-.85*snow)*(1-.9*ember)*out,
  crickets:.42*(1-day)*(1-.9*snow)*(1-.5*town)*(1-.6*ember)*out,
  wind:(.14+.5*snow+.12*(1-forest)*(1-town))*(1-.4*town)*out,
  river:.85*Math.pow(water,1.2)*out,
  crowd:.36*town*(.35+.65*day)*out,
  fire:.5*ember*out,
  lap:0
 };
}
// Expected one-shots per minute.
export function ambienceRates({day=1,water=0,town=0,farm=0,forest=.5,snow=0,ember=0,smithy=0,chapel=0,indoors=0}={}){
 day=clamp(day);const night=1-day,quiet=1-.8*clamp(indoors);
 return {
  bird:9*day*(.35+forest)*(1-.85*snow)*(1-.9*ember)*(1-.4*town)*quiet,
  woodpecker:.7*day*forest*(1-snow)*quiet,
  owl:.9*night*(.3+.7*forest)*(1-.7*town)*quiet,
  frog:6*water*(.3+.7*night)*(1-snow)*quiet,
  dog:.8*(town+.6*farm)*quiet,
  sheep:1.6*farm*day*quiet,
  cluck:3*farm*day*quiet,
  cart:.7*town*day*quiet,
  hammer:7*smithy*(.4+.6*day),
  bell:.22*chapel*day*quiet,
  crackle:4*ember*quiet,
  rumble:.9*ember*quiet
 };
}

export function createAmbience({context,bus,sfx,fetcher=globalThis.fetch,base='/assets/audio/sfx/',version='',random=Math.random}={}){
 const beds=new Map();let disposed=false,last=0;
 function bed(name){
  let b=beds.get(name);if(b)return b;const c=context();if(!c)return null;
  b={name,buffer:null,loading:false,level:0,out:c.createGain(),filter:c.createBiquadFilter(),voices:[],nextSwap:0};
  b.out.gain.value=0;b.filter.type='lowpass';b.filter.frequency.value=name==='crowd'?1300:name==='fire'?650:18000;b.out.connect(b.filter);b.filter.connect(bus());beds.set(name,b);return b;
 }
 async function loadBed(b){if(b.loading||b.buffer)return;b.loading=true;try{const c=context();const r=await fetcher(base+BED_FILES[b.name]+'.mp3'+(version?'?v='+version:''));if(r.ok)b.buffer=await c.decodeAudioData(await r.arrayBuffer())}catch{}b.loading=false}
 // Start a fresh voice at a random point and crossfade the old one out.
 function swap(b,c){if(!b.buffer)return;const src=c.createBufferSource(),g=c.createGain(),fade=Math.min(4,b.buffer.duration/4);src.buffer=b.buffer;src.loop=true;src.playbackRate.value=.96+random()*.08;src.connect(g);g.connect(b.out);g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(1,c.currentTime+fade);src.start(c.currentTime,random()*b.buffer.duration);
  for(const v of b.voices){v.g.gain.cancelScheduledValues(c.currentTime);v.g.gain.setValueAtTime(v.g.gain.value,c.currentTime);v.g.gain.linearRampToValueAtTime(0,c.currentTime+fade);const old=v;setTimeout(()=>{try{old.src.stop()}catch{}old.src.disconnect();old.g.disconnect()},(fade+.3)*1000)}
  b.voices=[{src,g}];b.nextSwap=c.currentTime+b.buffer.duration*(.45+random()*.35)}
 function around(listener,min=12,max=34){const a=random()*Math.PI*2,r=min+random()*(max-min);return {x:(listener?.x||0)+Math.cos(a)*r,z:(listener?.z||0)+Math.sin(a)*r}}
 function nearest(sources,kind,listener,within=45){let best=null,d=within;for(const s of sources||[])if(s.kind===kind){const e=Math.hypot(s.x-listener.x,s.z-listener.z);if(e<d){d=e;best=s}}return best}
 function update(env={}){
  const c=context();if(disposed||!c||c.state!=='running')return;const now=c.currentTime,dt=Math.min(3,Math.max(.2,now-last||1));last=now;
  const mix=ambienceMix(env);
  for(const [name,level] of Object.entries(mix)){if(!BED_FILES[name])continue;let b=beds.get(name);if(level<.01&&!b)continue;b=b||bed(name);if(!b)continue;if(level>.01&&!b.buffer)void loadBed(b);
   if(b.buffer&&level>.005&&(!b.voices.length||now>=b.nextSwap))swap(b,c);
   b.out.gain.setTargetAtTime(level,now,1.6);b.level=level;
   if(level<.003&&b.voices.length&&b.out.gain.value<.004){for(const v of b.voices){try{v.src.stop()}catch{}v.src.disconnect();v.g.disconnect()}b.voices=[]}}
  // One-shots, Poisson-timed from the per-minute rates.
  const L=env.listener||env.position||{x:0,z:0},rates=ambienceRates(env),fire=k=>random()<rates[k]*dt/60;
  // Synthesized calls (bird chirps, owl, hen, cart) sounded artificial, so only recorded samples play.
  if(fire('bird'))sfx.sample('birdSong',{at:around(L,10,30),gain:.5+random()*.3,rate:.92+random()*.16,bus:bus()});
  if(fire('woodpecker'))sfx.proc('woodpecker',{at:around(L,15,40),gain:.6},bus());
  if(fire('frog'))sfx.sample('frog',{at:env.waterPoint||around(L,4,14),gain:.45+random()*.3,rate:.9+random()*.25,bus:bus()});
  if(fire('dog'))sfx.sample('dog',{at:around(L,22,45),gain:.55,rate:.92+random()*.16,bus:bus(),far:60});
  if(fire('sheep'))sfx.sample('sheep',{at:nearest(env.sources,'sheep',L)||around(L,10,30),gain:.6,rate:.9+random()*.2,bus:bus()});
  if(fire('hammer')){const s=nearest(env.sources,'smithy',L,50);if(s){sfx.sample('anvil',{at:s,gain:.55,far:55,bus:bus()});if(random()<.7)sfx.sample('anvil',{at:s,gain:.45,far:55,delay:.42+random()*.1,bus:bus()})}}
  if(fire('bell')){const s=nearest(env.sources,'chapel',L,90);if(s){for(let i=0;i<3;i++)sfx.proc('bell',{at:s,gain:.55,far:110,delay:i*1.6},bus())}}
  if(fire('crackle'))sfx.sample('crackle',{at:around(L,6,20),gain:.5,bus:bus()});
  if(fire('rumble'))sfx.proc('rumble',{gain:.45},bus());
 }
 return {update,mix:ambienceMix,get beds(){return [...beds.values()].map(b=>({name:b.name,level:b.level,loaded:!!b.buffer,playing:b.voices.length}))},dispose(){disposed=true;for(const b of beds.values()){for(const v of b.voices){try{v.src.stop()}catch{}v.src.disconnect();v.g.disconnect()}b.out.disconnect();b.filter.disconnect()}beds.clear()}};
}
