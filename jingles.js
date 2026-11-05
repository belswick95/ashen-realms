// Original Eldervale level-up jingles (composed for this game, not taken from any
// other): a short fanfare per skill family, rendered live with WebAudio
// instruments — brass, timpani, harp, glockenspiel, string pad — through a small
// generated-hall reverb. Each lasts about 4–5 s. 'death' is the somber ~5 s cue for
// "Oh dear, you are dead!" (also original).
export const SKILL_FAMILY={attackXP:'combat',strengthXP:'combat',defenceXP:'combat',hitpointsXP:'combat',rangedXP:'combat',magicXP:'combat',prayerXP:'combat',
 woodXP:'gathering',woodcuttingXP:'gathering',miningXP:'gathering',fishingXP:'gathering',farmingXP:'gathering',hunterXP:'gathering',thievingXP:'gathering',agilityXP:'gathering',
 cookingXP:'artisan',firemakingXP:'artisan',smithingXP:'artisan',craftingXP:'artisan',fletchingXP:'artisan',herbloreXP:'artisan',runecraftingXP:'artisan',constructionXP:'artisan'};
export const skillFamily=key=>SKILL_FAMILY[key]||'gathering';
const n=(t,m,d,inst,v=.8)=>({t,m,d,inst,v});
// Score: time (s), MIDI note, duration (s), instrument, velocity.
export function composeJingle(kind='gathering'){
 const notes=[];const chord=(t,ms,d,inst,v)=>{for(const m of ms)notes.push(n(t,m,d,inst,v))};
 if(kind==='combat'){ // D major, martial: rising call, triplet answer, held tonic over timpani.
  for(const [t,m,d] of [[0,62,.22],[.24,69,.22],[.48,74,.5],[1.02,78,.16],[1.2,79,.16],[1.38,81,.62],[2.08,78,.24],[2.34,81,.24],[2.6,86,1.7]])notes.push(n(t,m,d,'brass',.85));
  chord(2.6,[62,66,69],1.8,'brass',.45);chord(0,[50],.5,'timpani',.9);notes.push(n(.48,50,.4,'timpani',.6),n(1.38,45,.5,'timpani',.75),n(2.42,45,.12,'timpani',.5),n(2.5,45,.12,'timpani',.6),n(2.6,50,1.6,'timpani',1));
  notes.push(n(2.6,0,1.9,'cymbal',.35));
 }else if(kind==='death'){ // D minor, somber (original): a slow falling sigh over a low pad, a darker iv chord, the bare tonic.
  chord(0,[50,57,62,65],2.1,'pad',.5);notes.push(n(0,38,.9,'timpani',.55));
  for(const [t,m,d] of [[.1,69,.55],[.72,70,.28],[1.02,69,.3],[1.36,65,.42],[1.84,64,.3],[2.18,62,.9]])notes.push(n(t,m,d,'brass',.42));
  chord(2.2,[43,55,58,62],1.3,'pad',.45);[67,62,58,55].forEach((m,i)=>notes.push(n(2.25+i*.2,m,.9,'harp',.5)));
  for(let i=0;i<6;i++)notes.push(n(2.9+i*.07,38,.1,'timpani',.25+i*.04));
  chord(3.35,[38,50,57,62],1.45,'pad',.55);notes.push(n(3.35,50,1.4,'brass',.35),n(3.35,38,1.3,'timpani',.6),n(3.35,74,1.1,'glock',.28),n(3.7,69,.9,'harp',.35),n(4.0,62,.8,'harp',.3));
 }else if(kind==='artisan'){ // F major, warm: harp arpeggio, glock sparkle, strings swell to a sus4→3 cadence.
  [65,69,72,77,81,84].forEach((m,i)=>notes.push(n(i*.17,m,.9,'harp',.7)));
  for(const [t,m] of [[1.1,84],[1.32,81],[1.54,82],[1.76,77]])notes.push(n(t,m,.5,'glock',.55));
  chord(1.0,[53,60,65,70],1.4,'pad',.45);chord(2.4,[53,60,65,69],2.0,'pad',.5);
  for(const [t,m,d] of [[2.0,79,.35],[2.4,77,.5],[2.95,81,1.4]])notes.push(n(t,m,d,'brass',.55));
  notes.push(n(2.95,89,1.2,'glock',.5),n(2.95,41,1.6,'timpani',.55));
 }else if(kind==='combatLevel'){ // B♭ major, grand: brass call and answer, timpani roll, full chord.
  for(const [t,m,d] of [[0,58,.3],[.32,65,.3],[.64,70,.55],[1.25,74,.2],[1.47,77,.2],[1.69,82,.65],[2.45,81,.2],[2.66,79,.2],[2.87,77,.2],[3.08,82,1.6]])notes.push(n(t,m,d,'brass',.85));
  chord(3.08,[58,62,65,70,74],1.7,'brass',.42);chord(3.08,[46,58,65],1.8,'pad',.5);
  for(let i=0;i<10;i++)notes.push(n(2.45+i*.062,46,.1,'timpani',.35+i*.05));notes.push(n(0,46,.5,'timpani',.9),n(.64,41,.5,'timpani',.7),n(3.08,46,1.6,'timpani',1),n(3.08,0,1.8,'cymbal',.45));
  notes.push(n(3.08,94,1.4,'glock',.4));
 }else if(kind==='quest'){ // C major, triumphant (original): rising brass fanfare, harp flourish, held full chord with timpani roll.
  for(const [t,m,d] of [[0,60,.2],[.22,64,.2],[.44,67,.35],[.84,72,.55],[1.48,71,.18],[1.68,72,.18],[1.88,74,.18],[2.08,76,.5],[2.66,74,.2],[2.88,76,.2],[3.08,79,1.7]])notes.push(n(t,m,d,'brass',.8));
  [72,76,79,84,88].forEach((m,i)=>notes.push(n(1.0+i*.08,m,.7,'harp',.5)));
  chord(3.08,[60,64,67,72,76],1.8,'brass',.4);chord(3.08,[48,55,64],1.9,'pad',.5);
  notes.push(n(0,48,.5,'timpani',.85),n(.84,43,.5,'timpani',.7));for(let i=0;i<9;i++)notes.push(n(2.5+i*.065,48,.1,'timpani',.3+i*.05));
  notes.push(n(3.08,48,1.6,'timpani',1),n(3.08,0,1.8,'cymbal',.4),n(3.08,91,1.3,'glock',.45),n(3.4,96,1,'glock',.3));
 }else{ // gathering — G major, open air: pentatonic harp and glock, horn-like brass answer.
  [67,71,74,79,83].forEach((m,i)=>notes.push(n(i*.15,m,.8,'harp',.65)));
  for(const [t,m] of [[.85,86],[1.05,83],[1.25,86],[1.45,88]])notes.push(n(t,m,.45,'glock',.5));
  for(const [t,m,d] of [[1.7,74,.3],[2.02,76,.3],[2.34,79,.4],[2.8,83,1.5]])notes.push(n(t,m,d,'brass',.6));
  chord(2.8,[55,62,67,71],1.7,'pad',.45);notes.push(n(2.8,43,1.5,'timpani',.6),n(2.8,91,1.1,'glock',.45));
 }
 const duration=Math.max(...notes.map(x=>x.t+x.d))+.6;return {kind,notes:notes.sort((a,b)=>a.t-b.t),duration};
}
const hz=m=>440*2**((m-69)/12);
function hallImpulse(ctx,seconds=2.2){const len=Math.floor(ctx.sampleRate*seconds),ir=ctx.createBuffer(2,len,ctx.sampleRate);for(let ch=0;ch<2;ch++){const d=ir.getChannelData(ch);let lp=0;for(let i=0;i<len;i++){const decay=Math.pow(1-i/len,3.2);lp=lp*.6+(Math.random()*2-1)*.4;d[i]=lp*decay*(i<ctx.sampleRate*.012?i/(ctx.sampleRate*.012):1)}}return ir}
let impulse=null;
export function playJingle(ctx,destination,kind='gathering',{gain=.8}={}){
 if(!ctx||!destination)return 0;const score=composeJingle(kind),t0=ctx.currentTime+.05,master=ctx.createGain(),dry=ctx.createGain(),wet=ctx.createGain(),verb=ctx.createConvolver(),comp=ctx.createDynamicsCompressor();
 if(!impulse||impulse.sampleRate!==ctx.sampleRate)impulse=hallImpulse(ctx);verb.buffer=impulse;master.gain.value=gain;dry.gain.value=.82;wet.gain.value=.3;comp.threshold.value=-14;comp.ratio.value=3;
 master.connect(dry);master.connect(verb);verb.connect(wet);dry.connect(comp);wet.connect(comp);comp.connect(destination);
 const nodes=[master,dry,wet,verb,comp];let noise=null;const noiseBuf=()=>{if(noise)return noise;noise=ctx.createBuffer(1,ctx.sampleRate,ctx.sampleRate);const d=noise.getChannelData(0);for(let i=0;i<d.length;i++)d[i]=Math.random()*2-1;return noise};
 const adsr=(g,t,peak,a,d,s,len,r)=>{g.gain.setValueAtTime(0,t);g.gain.linearRampToValueAtTime(peak,t+a);g.gain.setTargetAtTime(peak*s,t+a,d);g.gain.setTargetAtTime(0,t+len,r)};
 for(const note of score.notes){const t=t0+note.t,v=note.v,f=hz(note.m),g=ctx.createGain();g.connect(master);nodes.push(g);
  if(note.inst==='brass'){const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.Q.value=1.2;lp.frequency.setValueAtTime(f*1.5,t);lp.frequency.linearRampToValueAtTime(Math.min(9000,f*6),t+.06);lp.frequency.setTargetAtTime(f*3.2,t+.08,.2);lp.connect(g);nodes.push(lp);for(const det of [-7,6]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=f;o.detune.value=det;const vib=ctx.createOscillator(),vg=ctx.createGain();vib.frequency.value=5.2;vg.gain.value=note.d>.6?f*.006:0;vib.connect(vg);vg.connect(o.frequency);o.connect(lp);o.start(t);o.stop(t+note.d+.6);vib.start(t+.25);vib.stop(t+note.d+.6);nodes.push(o,vib,vg)}adsr(g,t,.11*v,.035,.12,.75,note.d,.12)}
  else if(note.inst==='timpani'){for(const [r,p] of [[1,1],[1.5,.35],[2,.2]]){const o=ctx.createOscillator();o.type='sine';o.frequency.setValueAtTime(f*r*1.05,t);o.frequency.exponentialRampToValueAtTime(f*r,t+.09);const og=ctx.createGain();og.gain.setValueAtTime(.0001,t);og.gain.exponentialRampToValueAtTime(.38*v*p,t+.006);og.gain.exponentialRampToValueAtTime(.0001,t+Math.max(.25,note.d)+.4);o.connect(og);og.connect(g);o.start(t);o.stop(t+note.d+.5);nodes.push(o,og)}const s=ctx.createBufferSource(),lp=ctx.createBiquadFilter(),sg=ctx.createGain();s.buffer=noiseBuf();lp.type='lowpass';lp.frequency.value=320;sg.gain.setValueAtTime(.25*v,t);sg.gain.exponentialRampToValueAtTime(.0001,t+.12);s.connect(lp);lp.connect(sg);sg.connect(g);s.start(t);s.stop(t+.15);nodes.push(s,lp,sg);g.gain.value=1}
  else if(note.inst==='cymbal'){const s=ctx.createBufferSource(),hp=ctx.createBiquadFilter();s.buffer=noiseBuf();s.loop=true;hp.type='highpass';hp.frequency.value=5200;s.connect(hp);hp.connect(g);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.09*v,t+.01);g.gain.exponentialRampToValueAtTime(.0001,t+note.d);s.start(t);s.stop(t+note.d+.05);nodes.push(s,hp)}
  else if(note.inst==='glock'){for(const [r,p,d] of [[1,1,1],[2.76,.3,.4],[5.4,.12,.18]]){const o=ctx.createOscillator(),og=ctx.createGain();o.frequency.value=f*r;og.gain.setValueAtTime(.0001,t);og.gain.exponentialRampToValueAtTime(.09*v*p,t+.003);og.gain.exponentialRampToValueAtTime(.0001,t+note.d*d+.2);o.connect(og);og.connect(g);o.start(t);o.stop(t+note.d+.4);nodes.push(o,og)}g.gain.value=1}
  else if(note.inst==='harp'){const o=ctx.createOscillator(),lp=ctx.createBiquadFilter();o.type='triangle';o.frequency.value=f;lp.type='lowpass';lp.frequency.setValueAtTime(f*8,t);lp.frequency.exponentialRampToValueAtTime(f*2,t+.4);o.connect(lp);lp.connect(g);g.gain.setValueAtTime(.0001,t);g.gain.exponentialRampToValueAtTime(.16*v,t+.004);g.gain.exponentialRampToValueAtTime(.0001,t+note.d+.3);o.start(t);o.stop(t+note.d+.35);nodes.push(o,lp)}
  else if(note.inst==='pad'){const lp=ctx.createBiquadFilter();lp.type='lowpass';lp.frequency.value=1700;lp.connect(g);nodes.push(lp);for(const det of [-9,0,8]){const o=ctx.createOscillator();o.type='sawtooth';o.frequency.value=f;o.detune.value=det;o.connect(lp);o.start(t);o.stop(t+note.d+1);nodes.push(o)}adsr(g,t,.035*v,.35,.5,.85,note.d,.35)}
 }
 const end=score.duration+2.4;setTimeout(()=>{for(const x of nodes){try{x.disconnect()}catch{}}},(end+.2)*1000);return score.duration;
}
