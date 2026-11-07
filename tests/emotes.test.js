import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import {readFileSync} from 'node:fs';
import {buildHumanoid} from '../humanoid.js';import {createHumanoidAnimator} from '../animation.js';import {plantFeet} from '../foot-ground.js';
import {clipsFor} from '../character-assets.js';import {EMOTE_SECONDS,emoteClip,emoteWeight,emotePose} from '../emote-motion.js';
import {EMOTES} from '../explore-data.js';import {createExplore} from '../explore.js';
import {JOURNAL_ICON,PRAYER_ICON,SPECIAL_ICON} from '../hud-icons.js';

// QA (owner report, iPhone, hud142): tapping an emote made the character bounce about and sink partly
// underground. explore.js moved the gameplay root up (dance, cheer) and down into the ground (bow,
// kneel) after the feet had been planted, and spun it for the dance. Emotes are now pose layers in the
// animator over an in-place clip, and foot-ground.js keeps the boots (or, kneeling, the knees) on the ground.
const v=new T.Vector3();
const src=name=>readFileSync(new URL('../'+name,import.meta.url),'utf8');

test('every emote has a duration, an in-place body clip and a bounded pose that fades in and out',()=>{
 for(const kind of Object.keys(EMOTES)){
  assert.ok(EMOTE_SECONDS[kind]>1&&EMOTE_SECONDS[kind]<5,kind+' duration');
  assert.ok(['Idle_Loop','Fixing_Kneeling'].includes(emoteClip(kind)),kind+' body clip');
  assert.equal(emoteWeight(kind,0),0);assert.equal(emoteWeight(kind,EMOTE_SECONDS[kind]),0,'ends back at idle');
  assert.equal(emoteWeight(kind,EMOTE_SECONDS[kind]/2),1);
  for(let t=0;t<EMOTE_SECONDS[kind];t+=.05){const p=emotePose(kind,t);assert.ok(p,kind);
   for(const h of [p.left,p.right])if(h)for(const n of h)assert.ok(Number.isFinite(n)&&Math.abs(n)<=1.2,kind+' hand goal within reach');
   assert.ok(Math.abs(p.lean)<=1&&Math.abs(p.twist)<=.5,kind+' spine')}
 }
});

test('emote body clips play in place: the hip (pelvis) track stays put and only the kneel lowers it',()=>{
 for(const sex of ['male','female']){const clips=clipsFor(sex);
  for(const name of ['Idle_Loop','Fixing_Kneeling']){const track=clips[name].tracks.find(t=>t.name==='pelvis.position');assert.ok(track,name);
   const at=i=>[track.values[i],track.values[i+1],track.values[i+2]],first=at(0);let maxHorizontal=0,minHeight=Infinity,maxHeight=-Infinity;
   for(let i=0;i<track.values.length;i+=3){const p=at(i);maxHorizontal=Math.max(maxHorizontal,Math.abs(p[0]-first[0]),Math.abs(p[1]-first[1]));minHeight=Math.min(minHeight,p[2]);maxHeight=Math.max(maxHeight,p[2])}
   // Rig space is Z-up: x/y drift is root motion, z is the hip height.
   assert.ok(maxHorizontal<.25,`${sex} ${name}: no root travel (${maxHorizontal.toFixed(3)})`);
   if(name==='Idle_Loop')assert.ok(maxHeight-minHeight<.02,`${sex} idle hips steady`);
   else assert.ok(minHeight>.3*maxHeight,`${sex} kneel hips stay above the knees`);
  }}
});

function emoteRun(kind,sex){const root=new T.Group(),visual=new T.Group();root.add(visual);root.position.set(3,1.25,-2);root.rotation.y=.7;
 const ground=()=>1.25,rig=buildHumanoid(T,visual,{sex}),a=createHumanoidAnimator(rig);for(let i=0;i<20;i++)a.update(1/30,{});
 const out={pelvis:[Infinity,-Infinity],visual:[Infinity,-Infinity],sole:Infinity,knee:Infinity,hand:-Infinity,weight:0,clip:null,rig};
 rig.bones.pelvis.getWorldPosition(v);const standing=v.y;
 for(let t=0;t<=EMOTE_SECONDS[kind]+.8;t+=1/30){const pose=a.update(1/30,{emote:{kind,t}});
  visual.position.y=0;plantFeet(T,rig,visual,ground,null);visual.updateWorldMatrix(true,true);
  rig.bones.pelvis.getWorldPosition(v);out.pelvis[0]=Math.min(out.pelvis[0],v.y);out.pelvis[1]=Math.max(out.pelvis[1],v.y);
  out.visual[0]=Math.min(out.visual[0],visual.position.y);out.visual[1]=Math.max(out.visual[1],visual.position.y);
  for(const s of ['left','right']){rig[s+'Ankle'].getWorldPosition(v);out.sole=Math.min(out.sole,v.y-rig.footHeight-1.25);rig[s+'Knee'].getWorldPosition(v);out.knee=Math.min(out.knee,v.y-1.25)}
  rig.bones.hand_r.getWorldPosition(v);out.hand=Math.max(out.hand,v.y-1.25);out.weight=Math.max(out.weight,pose.emote);out.clip=pose.clip}
 assert.deepEqual(root.position.toArray(),[3,1.25,-2],kind+': the gameplay root never moves');assert.equal(root.rotation.y,.7,kind+': nor turns');
 return {...out,standing};
}

test('each emote plays in place on the ground: no bounce, no sinking, then back to idle',()=>{
 for(const sex of ['male','female'])for(const kind of Object.keys(EMOTES)){const r=emoteRun(kind,sex),label=sex+' '+kind;
  assert.ok(r.weight>.99,label+' plays');assert.equal(r.clip,'Idle_Loop',label+' returns to idle');
  assert.ok(r.sole>-.1,`${label}: boots never sink (${r.sole.toFixed(3)})`);
  assert.ok(r.knee>.05,`${label}: knees stay above the ground (${r.knee.toFixed(3)})`);
  assert.ok(r.visual[0]>-.05&&r.visual[1]<.12,`${label}: body shift small (${r.visual.map(n=>n.toFixed(3))})`);
  if(kind==='kneel')assert.ok(r.pelvis[0]<r.standing-.4,label+' actually kneels');
  else assert.ok(r.pelvis[1]-r.pelvis[0]<.06,`${label}: hips do not bob (${(r.pelvis[1]-r.pelvis[0]).toFixed(3)})`);
  if(['wave','cheer','dance'].includes(kind))assert.ok(r.hand>r.standing-1.25+.9,label+': right hand raised high');
 }
});

test('walking cancels an emote; the animator ignores it while moving',()=>{
 const root=new T.Group(),visual=new T.Group();root.add(visual);const rig=buildHumanoid(T,visual,{sex:'male'}),a=createHumanoidAnimator(rig);
 const p=a.update(1/30,{distance:.1,speed:3,emote:{kind:'dance',t:1}});assert.equal(p.emote,0);
});

test('explore.js only tracks emotes: the root is never lifted, sunk or spun, and emoteFor hands them to the animator',()=>{
 let t=0;const ex=createExplore({doc:null,now:()=>t,journalFetch:()=>Promise.resolve(null),bossFetch:()=>Promise.resolve(null),command:()=>{}});
 const scene=new T.Group(),root=new T.Group();scene.add(root);root.position.set(5,2,5);
 ex.event({type:'explore',what:'emote',player:'me',emote:'dance'},'me',{player:root});
 for(;t<1500;t+=16){ex.frame(.016,root);assert.equal(root.position.y,2);assert.equal(root.rotation.y,0)}
 assert.equal(ex.emoteFor(root).kind,'dance');assert.ok(Math.abs(ex.emoteFor(root).t-t/1000)<1e-9);
 t+=EMOTE_SECONDS.dance*1000;ex.frame(.016,root);assert.equal(ex.emoteFor(root),null,'ends after its duration');
 ex.event({type:'explore',what:'emote',player:'me',emote:'wave'},'me',{player:root});root.position.x+=1;ex.frame(.016,root);assert.equal(ex.emoteFor(root),null,'walking off ends it');
 assert.doesNotMatch(src('explore.js'),/m\.root\.position\.y=|root\.rotation\.y\+=/);
 assert.match(src('game.js'),/emote:explore\.emoteFor\(player\)/);assert.match(src('game.js'),/emote:explore\.emoteFor\(other\.root\)/);
});

test('minimap cluster: journal, prayer, special, run and world map each have their own icon and label',()=>{
 const icons=[JOURNAL_ICON,PRAYER_ICON,SPECIAL_ICON];assert.equal(new Set(icons).size,3);
 for(const i of icons){assert.match(i,/^<svg [^>]*aria-hidden="true"/);assert.doesNotMatch(i,/✦/)}
 const explore=src('explore.js'),mech=src('mechanics-hud.js'),game=src('game.js'),hud=src('hud-redesign.js');
 assert.match(explore,/id:'explore-toggle',type:'button',title:'Journal[^']*','aria-label':'Open journal[^']*'\}\);b\.innerHTML=JOURNAL_ICON/);
 assert.match(mech,/PRAYER_ICON\+'<\/span>.*prayerOrb\.setAttribute\('aria-label'/);assert.match(mech,/SPECIAL_ICON\+'<\/span>.*specOrb\.setAttribute\('aria-label'/);
 assert.doesNotMatch(mech,/>✦</);
 assert.match(game,/runButton\.setAttribute\('aria-label','Toggle run'\)/);assert.match(game,/runButton\.title=/);
 assert.match(hud,/mapButton\.setAttribute\('aria-label','Open world map'\);mapButton\.title='World map \(M\)'/);
});
