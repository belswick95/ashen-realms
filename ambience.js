// Area sounds (RuneScape's "area sounds" channel): looping beds that crossfade
// with the world clock and your surroundings, plus randomised one-shots —
// several bird species by day; crickets and an owl at night; flowing
// water by rivers and lakes; wind (strongest in the Winterwatch snow); a low
// rumble and crackle around Emberspire; and in towns a market murmur, carts,
// dogs, a smithy's hammer and chapel bells. Nothing is a short obvious loop:
// beds restart at random offsets with long crossfades, one-shots vary in
// timing, pitch, level and position.
// Weather (weather-effects.js audio()): light and heavy rain beds, wind that
// gusts with the storm, thunder after each flash (thunder()), a soft hush when
// snow falls; under a roof the rain is muffled and underground it is silent.
import {BED_FILES} from './sfx.js?v=release-20261106-terrain111';

const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
// Bed levels (0..1) for the current surroundings. `day` is 1 at noon, 0 at night.
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
export function ambienceMix({day=1,water=0,town=0,farm=0,forest=.5,snow=0,ember=0,indoors=0,weather=null}={}){
 day=clamp(day);water=clamp(water);town=clamp(town);farm=clamp(farm);forest=clamp(forest);snow=clamp(snow);ember=clamp(ember);const out=1-.65*clamp(indoors);
 const w=weather||{},under=clamp(w.underground),rain=clamp(w.rain)*(1-under),gale=clamp(w.wind)*(1-under),fall=clamp(Math.max(w.snow||0,(w.ash||0)*.6))*(1-under),heavy=smoothstep(.5,.88,rain),roof=1-.45*clamp(indoors);
 // Rain and snow quieten the wildlife; a storm or snowfall hushes the town.
 const calm=(1-.85*rain)*(1-.6*fall);
 return {
  birds:.55*day*(.45+.55*forest)*(1-.45*town)*(1-.85*snow)*(1-.9*ember)*out*calm,
  crickets:.42*(1-day)*(1-.9*snow)*(1-.5*town)*(1-.6*ember)*out*(1-.8*rain)*(1-.7*fall),
  wind:((.14+.5*snow+.12*(1-forest)*(1-town))*(1-.4*town)+.5*gale*gale)*out*(1-under),
  river:.85*Math.pow(water,1.2)*out,
  crowd:.36*town*(.35+.65*day)*out*(1-.45*rain)*(1-.35*fall),
  fire:.5*ember*out*(1-.5*rain),
  lap:0,
  rainLight:.5*rain*(1-heavy)*roof+.18*heavy*roof,
  rainHeavy:.62*heavy*rain*roof
 };
}
// Low-pass per bed (Hz): rain on the roof is muffled indoors, falling snow
// softens the wind into a hush.
export function ambienceFilters({indoors=0,weather=null}={}){
 const w=weather||{},inside=clamp(indoors),fall=clamp(Math.max(w.snow||0,(w.ash||0)*.6));
 return {rainLight:inside>.5?850:9500,rainHeavy:inside>.5?700:14000,wind:inside>.5?900:18000*(1-.85*fall)+600*fall};
}
// Expected one-shots per minute.
export function ambienceRates({day=1,water=0,town=0,farm=0,forest=.5,snow=0,ember=0,smithy=0,chapel=0,indoors=0,weather=null}={}){
 day=clamp(day);const night=1-day,wet=clamp(weather?.rain)*(1-clamp(weather?.underground)),quiet=(1-.8*clamp(indoors))*(1-.8*wet);
 return {
  bird:9*day*(.35+forest)*(1-.85*snow)*(1-.9*ember)*(1-.4*town)*quiet,
  woodpecker:.7*day*forest*(1-snow)*quiet,
  owl:.9*night*(.3+.7*forest)*(1-.7*town)*quiet,
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
 const beds=new Map();let disposed=false,last=0,gust=0,gustTarget=0,nextGust=0,thunderReady=false;
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
  const mix=ambienceMix(env),filters=ambienceFilters(env),w=env.weather||{};
  // Wind gusts: a slow random swell on the wind bed while the weather is windy.
  if(now>=nextGust){nextGust=now+3+random()*6;gustTarget=random()}gust+=(gustTarget-gust)*Math.min(1,dt/2.5);
  if(w.wind>.3)mix.wind*=.7+.65*gust*Math.min(1,(w.wind-.3)*2);
  if(w.storm>.05&&!thunderReady){thunderReady=true;sfx.preload?.(['thunderRoll','thunderCrack'])}
  for(const [name,level] of Object.entries(mix)){if(!BED_FILES[name])continue;let b=beds.get(name);if(level<.01&&!b)continue;b=b||bed(name);if(!b)continue;if(level>.01&&!b.buffer)void loadBed(b);
   if(b.buffer&&level>.005&&(!b.voices.length||now>=b.nextSwap))swap(b,c);
   b.out.gain.setTargetAtTime(level,now,name==='wind'&&w.wind>.3?.9:1.6);b.level=level;if(filters[name])b.filter.frequency.setTargetAtTime(filters[name],now,.8);
   if(level<.003&&b.voices.length&&b.out.gain.value<.004){for(const v of b.voices){try{v.src.stop()}catch{}v.src.disconnect();v.g.disconnect()}b.voices=[]}}
  // One-shots, Poisson-timed from the per-minute rates.
  const L=env.listener||env.position||{x:0,z:0},rates=ambienceRates(env),fire=k=>random()<rates[k]*dt/60;
  // Only recorded sounds play: the synthesized calls (bird chirps, owl, woodpecker, hen, cart,
  // bells, rumble) produced a springy 'doing' tone that players found jarring.
  if(fire('bird'))sfx.sample('birdSong',{at:around(L,10,30),gain:.5+random()*.3,rate:.92+random()*.16,bus:bus()});
  // Frogs removed: the croak sample looped audibly and sounded harsh.
  if(fire('dog'))sfx.sample('dog',{at:around(L,22,45),gain:.55,rate:.92+random()*.16,bus:bus(),far:60});
  if(fire('sheep'))sfx.sample('sheep',{at:nearest(env.sources,'sheep',L)||around(L,10,30),gain:.6,rate:.9+random()*.2,bus:bus()});
  if(fire('hammer')){const s=nearest(env.sources,'smithy',L,50);if(s){sfx.sample('anvil',{at:s,gain:.55,far:55,bus:bus()});if(random()<.7)sfx.sample('anvil',{at:s,gain:.45,far:55,delay:.42+random()*.1,bus:bus()})}}
  if(fire('crackle'))sfx.sample('crackle',{at:around(L,6,20),gain:.5,bus:bus()});
 }
 // Thunder after a lightning flash (weather-effects.js -> music.js): a long roll,
 // plus a sharp crack when the strike is near; muffled under a roof.
 function thunder({delay=0,gain=.6,cutoff=6000,crack=false,indoors=false,pan=0}={}){
  const c=context();if(disposed||!c||c.state!=='running')return false;const roof=indoors?.55:1,low=indoors?Math.min(cutoff,650):cutoff;
  const ok=sfx.sample('thunderRoll',{gain:gain*.9*roof,cutoff:low,delay,pan,rate:.88+random()*.2,vary:.04,bus:bus()});
  if(crack)sfx.sample('thunderCrack',{gain:gain*.75*roof,cutoff:indoors?900:16000,delay:Math.max(0,delay-.15),pan,rate:.92+random()*.16,vary:.05,bus:bus()});
  return ok;
 }
 return {update,thunder,mix:ambienceMix,get beds(){return [...beds.values()].map(b=>({name:b.name,level:b.level,loaded:!!b.buffer,playing:b.voices.length}))},dispose(){disposed=true;for(const b of beds.values()){for(const v of b.voices){try{v.src.stop()}catch{}v.src.disconnect();v.g.disconnect()}b.out.disconnect();b.filter.disconnect()}beds.clear()}};
}
