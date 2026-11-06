// Area sounds: four continuous field-recording beds (assets/audio/ambience,
// sources and licences in CREDITS.md) that crossfade with the world clock and
// your surroundings. Daytime is forest birdsong over a light breeze, night is
// crickets, dawn and dusk blend the two; rivers and coast bring in running
// water; Winterwatch snow is mostly wind; indoors everything is quiet and
// muffled. There are no one-shots and nothing is synthesized: each bed is a
// long seamless loop started at a random offset, with a slow level drift so it
// never sits perfectly still.
// Weather (weather-effects.js audio()) shapes the beds: rain and snowfall hush
// the wildlife, a storm swells the wind in gusts; thunder after each flash
// (thunder()) is the one recorded weather sample this module plays.

export const AMBIENCE_BEDS={birds:'day-birds',crickets:'night-crickets',wind:'wind',water:'water'};

const clamp=v=>Math.max(0,Math.min(1,Number(v)||0));
const smoothstep=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
// Bed levels (0..1) for the current surroundings. `day` is 1 at noon, 0 at night;
// dawn and dusk (day between .2 and .8) crossfade birds and crickets.
export function ambienceMix({day=1,water=0,town=0,forest=.5,snow=0,ember=0,indoors=0,weather=null}={}){
 const sun=smoothstep(.2,.8,clamp(day));water=clamp(water);town=clamp(town);forest=clamp(forest);snow=clamp(snow);ember=clamp(ember);
 const w=weather||{},under=clamp(w.underground),inside=clamp(indoors),out=(1-.7*inside)*(1-under),rain=clamp(w.rain)*(1-under),gale=clamp(w.wind)*(1-under),fall=clamp(Math.max(w.snow||0,(w.ash||0)*.6))*(1-under);
 // Rain and snowfall quieten the wildlife.
 // Towns: beds drop to a low hush so the town music carries; they fade back up on trails and in the woods.
 const hush=1-.85*smoothstep(0,1,town),calm=(1-.85*rain)*(1-.6*fall),wild=(1-.9*snow)*(1-.85*ember)*hush*out*calm;
 return {
  birds:.55*sun*(.6+.4*forest)*wild,
  crickets:.45*(1-sun)*(.75+.25*forest)*wild,
  wind:((.12+.55*snow+.1*(1-forest)+.1*ember)*hush+.5*gale*gale)*out,
  water:.8*Math.pow(water,1.2)*(.4+.6*hush)*out
 };
}
// Low-pass per bed (Hz): indoors every bed is heard through the walls, and
// falling snow softens the wind into a hush.
export function ambienceFilters({indoors=0,weather=null}={}){
 const w=weather||{},inside=clamp(indoors)>.5,fall=clamp(Math.max(w.snow||0,(w.ash||0)*.6)),open=inside?800:16000;
 return {birds:open,crickets:inside?800:16000,water:inside?600:16000,wind:inside?700:16000*(1-.85*fall)+600*fall};
}

export function createAmbience({context,bus,sfx,fetcher=globalThis.fetch,base='/assets/audio/ambience/',version='',random=Math.random}={}){
 const beds=new Map();let disposed=false,last=0,gust=0,gustTarget=0,nextGust=0,thunderReady=false;
 function bed(name){
  let b=beds.get(name);if(b)return b;const c=context();if(!c)return null;
  b={name,buffer:null,loading:false,level:0,voice:null,drift:1,driftTarget:1,nextDrift:0,out:c.createGain(),filter:c.createBiquadFilter()};
  b.out.gain.value=0;b.filter.type='lowpass';b.filter.frequency.value=16000;b.out.connect(b.filter);b.filter.connect(bus());beds.set(name,b);return b;
 }
 async function loadBed(b){if(b.loading||b.buffer)return;b.loading=true;try{const c=context();const r=await fetcher(base+AMBIENCE_BEDS[b.name]+'.mp3'+(version?'?v='+version:''));if(r.ok)b.buffer=await c.decodeAudioData(await r.arrayBuffer())}catch{}b.loading=false}
 // One looping voice per bed, entering at a random point with a slow fade in.
 function start(b,c){const src=c.createBufferSource(),g=c.createGain();src.buffer=b.buffer;src.loop=true;src.connect(g);g.connect(b.out);g.gain.setValueAtTime(0,c.currentTime);g.gain.linearRampToValueAtTime(1,c.currentTime+3);src.start(c.currentTime,random()*b.buffer.duration);b.voice={src,g}}
 function stop(b){if(!b.voice)return;try{b.voice.src.stop()}catch{}b.voice.src.disconnect();b.voice.g.disconnect();b.voice=null}
 function update(env={}){
  const c=context();if(disposed||!c||c.state!=='running')return;const now=c.currentTime,dt=Math.min(3,Math.max(.2,now-last||1));last=now;
  const mix=ambienceMix(env),filters=ambienceFilters(env),w=env.weather||{};
  // Wind gusts: a slow random swell on the wind bed while the weather is windy.
  if(now>=nextGust){nextGust=now+3+random()*6;gustTarget=random()}gust+=(gustTarget-gust)*Math.min(1,dt/2.5);
  if(w.wind>.3)mix.wind*=.7+.65*gust*Math.min(1,(w.wind-.3)*2);
  if(w.storm>.05&&!thunderReady){thunderReady=true;sfx?.preload?.(['thunderRoll','thunderCrack'])}
  for(const [name,target] of Object.entries(mix)){let b=beds.get(name);if(target<.01&&!b)continue;b=b||bed(name);if(!b)continue;if(target>.01&&!b.buffer)void loadBed(b);
   // Slow level drift (±15 %, a new target every 12–30 s) so a bed breathes.
   if(now>=b.nextDrift){b.nextDrift=now+12+random()*18;b.driftTarget=.85+random()*.3}b.drift+=(b.driftTarget-b.drift)*Math.min(1,dt/8);
   const level=target*b.drift;
   if(b.buffer&&level>.005&&!b.voice)start(b,c);
   b.out.gain.setTargetAtTime(level,now,name==='wind'&&w.wind>.3?.9:2.5);b.level=level;b.filter.frequency.setTargetAtTime(filters[name]||16000,now,.8);
   if(level<.003&&b.voice&&b.out.gain.value<.004)stop(b)}
 }
 // Thunder after a lightning flash (weather-effects.js -> music.js): a long roll,
 // plus a sharp crack when the strike is near; muffled under a roof.
 function thunder({delay=0,gain=.6,cutoff=6000,crack=false,indoors=false,pan=0}={}){
  const c=context();if(disposed||!c||c.state!=='running'||!sfx)return false;const roof=indoors?.55:1,low=indoors?Math.min(cutoff,650):cutoff;
  const ok=sfx.sample('thunderRoll',{gain:gain*.9*roof,cutoff:low,delay,pan,rate:.88+random()*.2,vary:.04,bus:bus()});
  if(crack)sfx.sample('thunderCrack',{gain:gain*.75*roof,cutoff:indoors?900:16000,delay:Math.max(0,delay-.15),pan,rate:.92+random()*.16,vary:.05,bus:bus()});
  return ok;
 }
 return {update,thunder,mix:ambienceMix,get beds(){return [...beds.values()].map(b=>({name:b.name,level:b.level,loaded:!!b.buffer,playing:b.voice?1:0}))},dispose(){disposed=true;for(const b of beds.values()){stop(b);b.out.disconnect();b.filter.disconnect()}beds.clear()}};
}
