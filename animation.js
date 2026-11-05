import {clipsFor,CHARACTER_SCALE} from './character-assets.js?v=release-20261105-characters55';
// Clip-driven animation for every human in Eldervale (Quaternius Universal
// Animation Library, CC0). The caller describes what the character is doing;
// this picks the clip, cross-fades, and scales playback to the real travel
// speed so feet do not slide. Gameplay roots are never moved here.

// Ground speed of each loop at normal playback, in world units per second:
// how fast the planted ball of the foot moves backward (measured from the
// clips, Quaternius metres × scale).
export const STRIDE={Walk_Loop:1.03*CHARACTER_SCALE,Jog_Fwd_Loop:6.27*CHARACTER_SCALE,Sprint_Loop:9.5*CHARACTER_SCALE};
const FADE=.18;
// Town and profession activities → looping clips.
// A clip name ending in '@loop' repeats a normally one-shot clip (chopping, mining).
const ACTIVITY={smith:'Fixing_Kneeling',fix:'Fixing_Kneeling',garden:'Fixing_Kneeling',sweep:'Push_Loop',push:'Push_Loop',carry:'Idle_Torch_Loop',read:'Idle_Talking_Loop',talk:'Idle_Talking_Loop',sit:'Sitting_Idle_Loop',interact:'Interact@loop',pickup:'PickUp_Table@loop',swim:'Swim_Idle_Loop',mine:'Sword_Attack@loop',woodcut:'Sword_Attack@loop',fish:'Idle_Torch_Loop',net:'PickUp_Table@loop',cook:'Interact@loop',craft:'Fixing_Kneeling'};
export const ACTIVITY_CLIPS=ACTIVITY;
const ONE_SHOT=new Set(['Sword_Attack','Punch_Jab','Punch_Cross','Spell_Simple_Shoot','Hit_Chest','Hit_Head','Jump_Start','Jump_Land','Death01','Interact','PickUp_Table','Roll']);

export function createHumanoidAnimator(rig){
 const clips=clipsFor(rig.sex),mixer=new rig.T.AnimationMixer(rig.model);
 const actions=new Map(),weights=new Map();let current='Idle_Loop',oneShot=null,oneShotLeft=0,lastAttack=0,lastHit=0,airborne=false,punch=0,time=0,guard=0;
 const guardLayer=createGuardLayer(rig);
 const loops={};
 function clipFor(name){const [clip,loop]=name.split('@');if(!loop)return clips[clip];if(!clips[clip])return null;return loops[name]||(loops[name]=Object.assign(clips[clip].clone(),{name}))}
 function action(name){if(!clipFor(name))name='Idle_Loop';if(!actions.has(name)){const a=mixer.clipAction(clipFor(name));a.enabled=true;a.setEffectiveWeight(0);if(ONE_SHOT.has(name)){a.setLoop(2200,1);a.clampWhenFinished=true}a.play();actions.set(name,a);weights.set(name,0)}return actions.get(name)}
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
  let base;const work=ACTIVITY[activity||rig.activity];
  if(dead)base='Death01';
  else if(mounted)base=clips.Driving_Loop?'Driving_Loop':'Sitting_Idle_Loop';
  else if(airborne)base='Jump_Loop';
  else if(moving){const gait=locomotion==='run'?'Sprint_Loop':locomotion==='jog'?'Jog_Fwd_Loop':locomotion==='walk'||locomotion==='combat'?'Walk_Loop':speed>6.5?'Sprint_Loop':speed>2.6?'Jog_Fwd_Loop':'Walk_Loop';base=gait;}
  else base=work||(armed||block>0?'Sword_Idle':'Idle_Loop');
  if(base!==current){current=base;action(base).reset?.()}
  const loop=action(base);if(STRIDE[base])loop.timeScale=Math.max(.55,Math.min(1.7,speed/STRIDE[base]));else loop.timeScale=1;
  if(work&&base===work&&rig.activityPhase!=null){loop.time=rig.activityPhase*loop.getClip().duration;loop.timeScale=0}
  // Cross-fade: the active one-shot (if any) takes over, then hands back.
  if(oneShot){oneShotLeft-=dt;if(oneShotLeft<=0&&!(oneShot==='Death01'))oneShot=null}
  const target=oneShot||base,k=1-Math.exp(-dt/FADE*3);
  for(const [name,a] of actions){const w=weights.get(name)+((name===target?1:0)-weights.get(name))*k;weights.set(name,w<.001?0:w);a.setEffectiveWeight(weights.get(name))}
  mixer.update(dt);
  // Blocking raises the shield across the chest on top of whatever clip plays.
  guard+=((block>0&&!mounted&&!dead?1:0)-guard)*k;if(guard<.001)guard=0;if(guard)guardLayer(guard);
  const run=base==='Sprint_Loop'?1:base==='Jog_Fwd_Loop'?.65:0;
  return {blend:moving?1:0,run,gait:base,flight:airborne,contacts:{left:!airborne,right:!airborne},attack:attack>0,hit:hitNow>.01,clip:target,guard};
 },dispose(){mixer.stopAllAction();mixer.uncacheRoot(rig.model)}};
}

// Shield guard: a two-bone reach (upper arm, forearm) bringing the left fist in
// front of the chest, then a wrist turn so the shield face (socket +Z) points
// forward. Applied after the mixer, weighted 0..1, so it fades in and out.
function createGuardLayer(rig){
 const T=rig.T,b=rig.bones,chain=[b.lowerarm_l,b.upperarm_l],hand=b.hand_l,socket=rig.leftHand;
 const target=new T.Vector3(),forward=new T.Vector3(),a=new T.Vector3(),c=new T.Vector3(),q=new T.Quaternion(),wq=new T.Quaternion(),pq=new T.Quaternion(),id=new T.Quaternion();
 // Rotate `bone` in world space by `rotation`, scaled by weight.
 function turn(bone,rotation,weight){q.copy(id).slerp(rotation,weight);bone.getWorldQuaternion(wq);bone.parent.getWorldQuaternion(pq);bone.quaternion.copy(pq.invert().multiply(q).multiply(wq));bone.updateMatrixWorld(true)}
 return weight=>{
  rig.model.updateMatrixWorld(true);rig.root.getWorldQuaternion(wq);forward.set(0,0,1).applyQuaternion(wq);
  // Target: centre-left of the chest, a forearm's length in front of it.
  b.spine_03.getWorldPosition(target);target.addScaledVector(forward,.5);a.set(.12,0,0).applyQuaternion(wq);target.add(a);
  for(let pass=0;pass<4;pass++)for(const bone of chain){bone.getWorldPosition(c);hand.getWorldPosition(a).sub(c).normalize();const to=target.clone().sub(c).normalize();turn(bone,new T.Quaternion().setFromUnitVectors(a,to),weight)}
  socket.getWorldQuaternion(pq);a.set(0,0,1).applyQuaternion(pq);turn(hand,new T.Quaternion().setFromUnitVectors(a,forward),weight);
 };
}
