import {clipsFor,CHARACTER_SCALE} from './character-assets.js?v=release-20261104-lowpoly54';
// Clip-driven animation for every human in Eldervale (Quaternius Universal
// Animation Library, CC0). The caller describes what the character is doing;
// this picks the clip, cross-fades, and scales playback to the real travel
// speed so feet do not slide. Gameplay roots are never moved here.

// Travel speed of each loop in world units per second (root motion × scale).
const STRIDE={Walk_Loop:.975*CHARACTER_SCALE,Jog_Fwd_Loop:5.36*CHARACTER_SCALE,Sprint_Loop:8.25*CHARACTER_SCALE};
const FADE=.18;
// Town and profession activities → looping clips.
const ACTIVITY={smith:'Fixing_Kneeling',fix:'Fixing_Kneeling',garden:'Fixing_Kneeling',sweep:'Push_Loop',push:'Push_Loop',carry:'Idle_Torch_Loop',read:'Idle_Talking_Loop',talk:'Idle_Talking_Loop',sit:'Sitting_Idle_Loop',interact:'Interact',pickup:'PickUp_Table',swim:'Swim_Idle_Loop',mine:'Sword_Attack',woodcut:'Sword_Attack',fish:'Idle_Torch_Loop',cook:'Interact',craft:'Fixing_Kneeling'};
const ONE_SHOT=new Set(['Sword_Attack','Punch_Jab','Punch_Cross','Spell_Simple_Shoot','Hit_Chest','Hit_Head','Jump_Start','Jump_Land','Death01','Interact','PickUp_Table','Roll']);

export function createHumanoidAnimator(rig){
 const clips=clipsFor(rig.sex),mixer=new rig.T.AnimationMixer(rig.model);
 const actions=new Map(),weights=new Map();let current='Idle_Loop',oneShot=null,oneShotLeft=0,lastAttack=0,lastHit=0,airborne=false,punch=0,time=0;
 function action(name){if(!clips[name])name='Idle_Loop';if(!actions.has(name)){const a=mixer.clipAction(clips[name]);a.enabled=true;a.setEffectiveWeight(0);if(ONE_SHOT.has(name)){a.setLoop(2200,1);a.clampWhenFinished=true}a.play();actions.set(name,a);weights.set(name,0)}return actions.get(name)}
 function startOneShot(name,duration){const a=action(name);a.reset();a.play();const length=clips[name]?.duration||1;a.timeScale=duration?length/duration:1;oneShot=name;oneShotLeft=duration||length;}
 action('Idle_Loop').setEffectiveWeight(1);weights.set('Idle_Loop',1);
 return {mixer,update(dt,{distance=0,speed=0,attack=0,hit=0,armed=false,weapon=null,block=0,locomotion=null,style=null,mounted=false,airborne:air=false,activity=null,dead=false}={}){
  if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);time+=dt;
  speed=Number.isFinite(speed)?Math.max(0,speed):0;distance=Number.isFinite(distance)?Math.max(0,distance):0;
  const moving=distance>1e-5&&speed>.15&&!mounted;
  // Event-driven one-shots: a new attack, a fresh hit, take-off and landing.
  if(attack>lastAttack+.05||attack>0&&lastAttack<=0){const magic=style==='magic'||weapon==='staff';startOneShot(magic?'Spell_Simple_Shoot':armed?'Sword_Attack':(punch++%2?'Punch_Cross':'Punch_Jab'),Math.max(.35,attack))}
  lastAttack=attack;
  const hitNow=Number.isFinite(hit)?hit:0;if(hitNow>.5&&lastHit<=.5&&!oneShot)startOneShot(Math.random()<.5?'Hit_Chest':'Hit_Head',.45);lastHit=hitNow;
  if(air&&!airborne)startOneShot('Jump_Start',.3);else if(!air&&airborne)startOneShot('Jump_Land',.35);airborne=!!air;
  // Base loop for the current state.
  let base;
  if(dead)base='Death01';
  else if(mounted)base=clips.Driving_Loop?'Driving_Loop':'Sitting_Idle_Loop';
  else if(airborne)base='Jump_Loop';
  else if(moving){const gait=locomotion==='run'?'Sprint_Loop':locomotion==='jog'?'Jog_Fwd_Loop':locomotion==='walk'||locomotion==='combat'?'Walk_Loop':speed>6.5?'Sprint_Loop':speed>2.6?'Jog_Fwd_Loop':'Walk_Loop';base=gait;}
  else{const work=ACTIVITY[activity||rig.activity];base=work||(armed||block>0?'Sword_Idle':'Idle_Loop');}
  if(base!==current){current=base;action(base).reset?.()}
  const loop=action(base);if(STRIDE[base])loop.timeScale=Math.max(.55,Math.min(1.7,speed/STRIDE[base]));else loop.timeScale=1;
  // Cross-fade: the active one-shot (if any) takes over, then hands back.
  if(oneShot){oneShotLeft-=dt;if(oneShotLeft<=0&&!(oneShot==='Death01'))oneShot=null}
  const target=oneShot||base,k=1-Math.exp(-dt/FADE*3);
  for(const [name,a] of actions){const w=weights.get(name)+((name===target?1:0)-weights.get(name))*k;weights.set(name,w<.001?0:w);a.setEffectiveWeight(weights.get(name))}
  mixer.update(dt);
  const run=base==='Sprint_Loop'?1:base==='Jog_Fwd_Loop'?.65:0;
  return {blend:moving?1:0,run,gait:base,flight:airborne,contacts:{left:!airborne,right:!airborne},attack:attack>0,hit:hitNow>.01,clip:target};
 },dispose(){mixer.stopAllAction();mixer.uncacheRoot(rig.model)}};
}
