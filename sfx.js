// Sound effects: real CC0 recordings (assets/audio/sfx, see credits.html) plus a
// few procedural voices where no good recording exists (pick on rock, snort,
// sizzle, bells, owl, chicken, woodpecker, bird calls). Combat is recordings
// only (assets/audio/combat, combat-audio.js). One shared AudioContext
// (music.js), effects on the SFX bus, area sounds on the ambient bus.
// Positional sounds fade and darken with distance and pan by camera bearing.
import {COMBAT_SAMPLE_SETS} from './combat-audio.js?v=release-20261107-move3v161';

export const SAMPLE_SETS={
 chop:['chop'],treeFall:['tree-fall'],creak:['tree-creak'],rockBreak:['rock-break'],anvil:['anvil','hammer'],
 crackle:['fire-crackle'],crunch:['crunch-1','crunch-2','crunch-3'],splashCast:['splash-cast','splash-small'],
 splashCatch:['splash-catch'],ripple:['ripple','splash-small'],frog:['frog-1','frog-2'],dog:['dog'],sheep:['sheep'],
 cricket:['cricket'],birdSong:['../nature-birds'],hoof:['hoof-1','hoof-2','hoof-3','hoof-4','hoof-5','hoof-6'],
 thunderRoll:['thunder-roll'],thunderCrack:['thunder-crack'],
 levelSkill:['../level-up-skill'],levelCombat:['../level-up-combat'],
 ...COMBAT_SAMPLE_SETS
};
// Voice budgets: at most this many sounds of a group play at once. A new sound
// steals the oldest voice of equal or lower priority (the local player's own
// combat outranks other people's), otherwise it is dropped.
export const VOICE_LIMITS={combat:10};

// Distance model for positional sounds: full level inside `near`, an inverse
// roll-off to silence at `far`, a gentle low-pass (air absorption) and a pan
// from the bearing relative to the camera (the camera sits at +sin/cos(yaw)
// behind the player, so screen-right is (cos yaw, −sin yaw)).
export function spatialMix(source,listener,{near=3,far=40}={}){
 if(!source||!listener||!Number.isFinite(source.x)||!Number.isFinite(source.z))return {gain:1,pan:0,cutoff:20000,distance:0};
 const dx=source.x-listener.x,dz=source.z-listener.z,distance=Math.hypot(dx,dz);
 if(distance>=far)return {gain:0,pan:0,cutoff:800,distance};
 const t=Math.max(0,(distance-near)/(far-near)),gain=distance<=near?1:Math.pow(1-t,1.6)*near/Math.max(near,distance*.55);
 const yaw=listener.yaw||0,right=dx*Math.cos(yaw)-dz*Math.sin(yaw),pan=distance<.5?0:Math.max(-.85,Math.min(.85,right/Math.max(distance,1)));
 return {gain:Math.max(0,Math.min(1,gain)),pan,cutoff:Math.max(1400,20000-distance*420),distance};
}
// First sample above 6% of the peak: encoder padding and room tone before the
// impact are skipped so a chop or hoof lands exactly on its animation frame.
export function onsetOffset(data,sampleRate,threshold=.06){let peak=0;for(let i=0;i<data.length;i++){const v=Math.abs(data[i]);if(v>peak)peak=v}if(!peak)return 0;const limit=peak*threshold;for(let i=0;i<data.length;i++)if(Math.abs(data[i])>=limit)return Math.max(0,i-Math.round(sampleRate*.002))/sampleRate;return 0}

export function createSfx({context,sfxBus,ambientBus,listener=()=>null,fetcher=globalThis.fetch,base='/assets/audio/sfx/',version=''}={}){
 const buffers=new Map(),loading=new Map(),loops=new Set(),groups=new Map();let noise=null,disposed=false;
 const ctx=()=>context();
 function running(){const c=ctx();return !!c&&c.state==='running'&&!disposed}
 function load(file){if(buffers.has(file))return Promise.resolve(buffers.get(file));if(loading.has(file))return loading.get(file);const c=ctx();if(!c||!fetcher)return Promise.resolve(null);
  const p=fetcher(base+file+'.mp3'+(version?'?v='+version:'')).then(r=>r.ok?r.arrayBuffer():null).then(b=>b?c.decodeAudioData(b):null).then(buffer=>{if(buffer){buffer.onset=onsetOffset(buffer.getChannelData(0),buffer.sampleRate);buffers.set(file,buffer)}loading.delete(file);return buffer}).catch(()=>{loading.delete(file);return null});loading.set(file,p);return p}
 function preload(names){for(const n of names)for(const f of n==='combat'?Object.values(COMBAT_SAMPLE_SETS).flat():SAMPLE_SETS[n]||[n])void load(f)}
 // Returns false when the group is full of voices that outrank this one.
 function claim(group,priority,c){const limit=VOICE_LIMITS[group];if(!limit)return true;const list=groups.get(group)||[];groups.set(group,list);
  if(list.length<limit)return true;let victim=null;for(const v of list)if(v.priority<=priority&&(!victim||v.priority<victim.priority||(v.priority===victim.priority&&v.started<victim.started)))victim=v;
  if(!victim)return false;list.splice(list.indexOf(victim),1);try{victim.gain.gain.setTargetAtTime(0,c.currentTime,.012);victim.src.stop(c.currentTime+.06)}catch{}return true}
 function noiseBuffer(c){if(noise&&noise.sampleRate===c.sampleRate)return noise;noise=c.createBuffer(1,c.sampleRate*2,c.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return noise}
 // Output chain for one voice: gain → low-pass (distance) → pan → bus.
 function chain(c,{gain=1,pan=0,cutoff=20000,bus=sfxBus()}={}){const g=c.createGain(),f=c.createBiquadFilter(),p=c.createStereoPanner?c.createStereoPanner():null;g.gain.value=gain;f.type='lowpass';f.frequency.value=cutoff;g.connect(f);if(p){p.pan.value=pan;f.connect(p);p.connect(bus)}else f.connect(bus);return {input:g,nodes:[g,f,p].filter(Boolean)}}
 function place(options={}){if(options.at){const m=spatialMix(options.at,listener(),options);return {...options,gain:(options.gain??1)*m.gain,pan:m.pan,cutoff:Math.min(options.cutoff??20000,m.cutoff)}}return options}
 // Play one recorded variant; per-hit pitch and level variation keeps repeats natural.
 function sample(name,options={}){
  if(!running())return false;const c=ctx(),files=SAMPLE_SETS[name]||[name],file=files[Math.floor(Math.random()*files.length)],buffer=buffers.get(file);
  if(!buffer){void load(file);return false}
  const o=place(options);if(o.gain<=.002)return false;
  const group=options.group,priority=options.priority||0;if(group&&!claim(group,priority,c))return false;
  const vary=options.vary??.06,src=c.createBufferSource(),out=chain(c,{...o,gain:o.gain*(1-vary+Math.random()*vary*2)});
  src.buffer=buffer;src.playbackRate.value=(options.rate??1)*(1-vary+Math.random()*vary*2);
  let input=out.input;if(options.highpass||options.tone){const f=c.createBiquadFilter();if(options.tone){f.type='peaking';f.frequency.value=options.tone.frequency;f.gain.value=options.tone.gain;f.Q.value=options.tone.q||.8}else{f.type='highpass';f.frequency.value=options.highpass}f.connect(out.input);input=f;out.nodes.push(f)}
  src.connect(input);const when=c.currentTime+(options.delay||0);src.start(when,buffer.onset||0,options.duration);
  let voice=null;if(group&&VOICE_LIMITS[group]){voice={src,gain:out.nodes[0],priority,started:when};groups.get(group).push(voice)}
  src.onended=()=>{src.disconnect();for(const n of out.nodes)n.disconnect();if(voice){const list=groups.get(group),i=list.indexOf(voice);if(i>=0)list.splice(i,1)}};return true;
 }
 // ---- Procedural voices -------------------------------------------------
 function env(c,param,peak,attack,decay,at){param.setValueAtTime(.0001,at);param.exponentialRampToValueAtTime(Math.max(.0002,peak),at+attack);param.exponentialRampToValueAtTime(.0001,at+attack+decay)}
 function burst(c,o,{type='bandpass',frequency=1000,q=1,peak=.4,attack=.002,decay=.1,at=c.currentTime}){const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain();s.buffer=noiseBuffer(c);f.type=type;f.frequency.value=frequency;f.Q.value=q;env(c,g.gain,peak,attack,decay,at);s.connect(f);f.connect(g);g.connect(o.input);s.start(at,Math.random()*1.5);s.stop(at+attack+decay+.02);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect()};return s}
 function tone(c,o,{type='sine',frequency=440,to=null,peak=.3,attack=.003,decay=.2,at=c.currentTime,detune=0}){const s=c.createOscillator(),g=c.createGain();s.type=type;s.frequency.setValueAtTime(frequency,at);if(to)s.frequency.exponentialRampToValueAtTime(to,at+attack+decay);s.detune.value=detune;env(c,g.gain,peak,attack,decay,at);s.connect(g);g.connect(o.input);s.start(at);s.stop(at+attack+decay+.02);s.onended=()=>{s.disconnect();g.disconnect()};return s}
 function voice(build,options={},bus){if(!running())return false;const c=ctx(),o=place(options);if(o.gain<=.002)return false;const out=chain(c,{...o,bus:bus||sfxBus()}),at=c.currentTime+(options.delay||0);build(c,out,at);setTimeout(()=>{for(const n of out.nodes)n.disconnect()},((options.delay||0)+6)*1000);return true}
 const procedural={
  // Steel pick on stone: a bright inharmonic ring over a gritty crack.
  clink:(c,o,at)=>{burst(c,o,{frequency:3200,q:.9,peak:.5,decay:.06,at});for(const [f,p,d] of [[2380,.16,.18],[3710,.1,.12],[5230,.06,.09]])tone(c,o,{frequency:f*(.97+Math.random()*.06),peak:p,decay:d,at});return tone(c,o,{type:'triangle',frequency:180,to:90,peak:.2,decay:.08,at})},
  // Horse snort: a breathy nasal burst with a flutter.
  snort:(c,o,at)=>{const s=c.createBufferSource(),f=c.createBiquadFilter(),g=c.createGain(),lfo=c.createOscillator(),lg=c.createGain();s.buffer=noiseBuffer(c);f.type='bandpass';f.frequency.value=650;f.Q.value=1.2;lfo.frequency.value=28;lg.gain.value=.25;lfo.connect(lg);lg.connect(g.gain);g.gain.setValueAtTime(.0001,at);g.gain.exponentialRampToValueAtTime(.5,at+.05);g.gain.setValueAtTime(.5,at+.18);g.gain.exponentialRampToValueAtTime(.0001,at+.55);s.connect(f);f.connect(g);g.connect(o.input);lfo.start(at);lfo.stop(at+.6);s.start(at,Math.random());s.stop(at+.6);s.onended=()=>{s.disconnect();f.disconnect();g.disconnect();lfo.disconnect();lg.disconnect()};return s},
  // Fat in a hot pan: hiss with random spits.
  sizzle:(c,o,at)=>{burst(c,o,{type:'highpass',frequency:3500,q:.4,peak:.16,attack:.08,decay:1.4,at});let last;for(let i=0;i<9;i++)last=burst(c,o,{frequency:2500+Math.random()*3500,q:3,peak:.12+Math.random()*.1,decay:.02,at:at+Math.random()*1.3});return last},
  // Church bell: inharmonic partials (hum, prime, tierce, quint, nominal).
  bell:(c,o,at)=>{const base=233*(.94+Math.random()*.12);let last;for(const [r,p,d] of [[.5,.18,4.5],[1,.22,3.6],[1.2,.12,2.6],[1.5,.08,2.2],[2,.1,1.8],[2.74,.04,1.2]])last=tone(c,o,{frequency:base*r,peak:p,attack:.004,decay:d,at});return last},
  // Barn/tawny owl: two soft breathy hoots, the second wavering.
  owl:(c,o,at)=>{tone(c,o,{frequency:390,to:360,peak:.18,attack:.06,decay:.45,at});burst(c,o,{frequency:380,q:6,peak:.05,attack:.06,decay:.4,at});return tone(c,o,{frequency:410,to:350,peak:.16,attack:.08,decay:.8,at:at+.75})},
  // Hen cluck: short nasal pitched pulses.
  cluck:(c,o,at)=>{let last;const n=2+Math.floor(Math.random()*3);for(let i=0;i<n;i++){const t=at+i*(.13+Math.random()*.05);last=tone(c,o,{type:'sawtooth',frequency:520+Math.random()*90,to:380,peak:.06,decay:.07,at:t});burst(c,o,{frequency:1400,q:4,peak:.05,decay:.05,at:t})}return last},
  // Woodpecker: a fast roll of knocks that slows at the end.
  woodpecker:(c,o,at)=>{let t=at,gap=.045,last;for(let i=0;i<14;i++){last=burst(c,o,{frequency:1700,q:5,peak:.22*(1-i/22),decay:.025,at:t});tone(c,o,{type:'triangle',frequency:900,to:600,peak:.08,decay:.03,at:t});t+=gap;gap*=1.035}return last},
  // Cart wheels over packed earth: low rumble with creaks.
  cart:(c,o,at)=>{burst(c,o,{type:'lowpass',frequency:180,q:.5,peak:.22,attack:.6,decay:2.4,at});let last;for(let i=0;i<4;i++)last=tone(c,o,{type:'sawtooth',frequency:300+Math.random()*120,to:240,peak:.025,attack:.05,decay:.35,at:at+.3+i*.6+Math.random()*.2});return last},
  // Low volcanic rumble.
  rumble:(c,o,at)=>burst(c,o,{type:'lowpass',frequency:90,q:.6,peak:.5,attack:1.2,decay:3.5,at}),
  // Soft footstep: grass/dirt thud, or a firmer scuff on stone.
  step:(c,o,at)=>burst(c,o,{type:'lowpass',frequency:o.hard?1800:650,q:.6,peak:o.hard?.18:.13,decay:.07,at})
 };
 // Bird calls for several species (synthesised whistles with natural slides).
 const species={
  warbler:(c,o,at)=>{let t=at,last;const n=6+Math.floor(Math.random()*6),base=3200+Math.random()*900;for(let i=0;i<n;i++){last=tone(c,o,{frequency:base*(1+.18*Math.sin(i*1.7)),to:base*(.8+Math.random()*.3),peak:.07,attack:.004,decay:.05,at:t});t+=.06+Math.random()*.02}return last},
  feebee:(c,o,at)=>{const f=3900+Math.random()*300;tone(c,o,{frequency:f,to:f*.98,peak:.08,attack:.03,decay:.28,at});return tone(c,o,{frequency:f*.84,to:f*.83,peak:.07,attack:.03,decay:.32,at:at+.38})},
  finch:(c,o,at)=>{let t=at,last;for(let i=0;i<5;i++){last=tone(c,o,{frequency:4600-i*350,to:3600-i*300,peak:.06,attack:.003,decay:.07,at:t});t+=.09}return tone(c,o,{type:'triangle',frequency:2700,to:4100,peak:.06,attack:.01,decay:.18,at:t})},
  dove:(c,o,at)=>{let last;for(const [d,f,len] of [[0,520,.35],[.45,600,.25],[.75,560,.5],[1.35,520,.4]])last=tone(c,o,{frequency:f,to:f*.9,peak:.07,attack:.08,decay:len,at:at+d});return last}
 };
 function proc(name,options={},bus){const v=procedural[name]||species[name];if(!v)return false;return voice((c,o,at)=>v(c,Object.assign(o,{hard:options.hard}),at),options,bus)}
 function bird(options={}){const names=Object.keys(species);return proc(options.species||names[Math.floor(Math.random()*names.length)],options,ambientBus())}
 // Looped positional sources (fire crackle by a fire, sizzle at a range).
 function loop(name,{at=null,gain=1}={}){
  const handle={at,gain,stopped:false,src:null,out:null,update(){if(!handle.out||!running())return;const o=place({at:handle.at,gain:handle.gain});const c=ctx();handle.out.nodes[0].gain.setTargetAtTime(o.gain,c.currentTime,.25);if(handle.out.nodes[2])handle.out.nodes[2].pan.setTargetAtTime(o.pan||0,c.currentTime,.25)},stop(){handle.stopped=true;loops.delete(handle);if(handle.src&&ctx()){const c=ctx();handle.out.nodes[0].gain.setTargetAtTime(0,c.currentTime,.15);const s=handle.src;setTimeout(()=>{try{s.stop()}catch{}s.disconnect();for(const n of handle.out.nodes)n.disconnect()},700)}}};
  loops.add(handle);const file=(SAMPLE_SETS[name]||[name])[0];
  void load(file).then(buffer=>{if(!buffer||handle.stopped||!running())return;const c=ctx();handle.out=chain(c,{gain:0});const s=c.createBufferSource();s.buffer=buffer;s.loop=true;s.playbackRate.value=.95+Math.random()*.1;s.connect(handle.out.input);s.start(c.currentTime,Math.random()*buffer.duration);handle.src=s;handle.update()});
  return handle;
 }
 function update(){for(const l of loops)l.update()}
 return {sample,proc,bird,loop,update,preload,load,running,voices:group=>(groups.get(group)||[]).length,get loaded(){return buffers.size},buffer:file=>buffers.get(file)||null,dispose(){disposed=true;for(const l of [...loops])l.stop();buffers.clear()}};
}
