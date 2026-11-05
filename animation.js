import {clipsFor,CHARACTER_SCALE} from './character-assets.js?v=release-20261105-walkanim64';
import {gaitPlayback,createStrideWarp} from './gait-cadence.js?v=release-20261105-walkanim64';
// Clip-driven animation for every human in Eldervale (Quaternius Universal
// Animation Library, CC0). The caller describes what the character is doing;
// this picks the clip, cross-fades, and plays gaits at a natural cadence
// for the real travel speed with strides shortened to match (gait-cadence.js),
// so feet do not slide. Gameplay roots are never moved here.

// Ground speed of each loop at normal playback, in world units per second:
// how fast the planted ball of the foot moves backward (measured from the
// clips, Quaternius metres × scale).
export const STRIDE={Walk_Loop:1.03*CHARACTER_SCALE,Jog_Fwd_Loop:6.27*CHARACTER_SCALE,Sprint_Loop:9.5*CHARACTER_SCALE};
const FADE=.18,FIGHT_HOLD=6,COMBAT_HOLD=3,WALK_LIMIT=3.8;
// Town and profession activities → looping clips.
// A clip name ending in '@loop' repeats a normally one-shot clip (chopping, mining).
const ACTIVITY={smith:'Fixing_Kneeling',fix:'Fixing_Kneeling',garden:'Fixing_Kneeling',sweep:'Push_Loop',push:'Push_Loop',carry:'Idle_Torch_Loop',read:'Idle_Talking_Loop',talk:'Idle_Talking_Loop',sit:'Sitting_Idle_Loop',interact:'Interact@loop',pickup:'PickUp_Table@loop',swim:'Swim_Idle_Loop',mine:'Sword_Attack@loop',woodcut:'Sword_Attack@loop',fish:'Idle_Torch_Loop',net:'PickUp_Table@loop',cook:'Interact@loop',craft:'Fixing_Kneeling',
 // Town jobs (npc-activities.js layers hands and props over these).
 hammer:'Idle_Loop',broom:'Idle_Loop',haul:'Idle_Loop',ledger:'Idle_Loop',trade:'Idle_Talking_Loop',chat:'Idle_Talking_Loop',fetch:'PickUp_Table@loop',pray:'Idle_Loop',watch:'Idle_Loop',rest:'Idle_Loop',sitread:'Sitting_Idle_Loop'};
export const ACTIVITY_CLIPS=ACTIVITY;
const ONE_SHOT=new Set(['Sword_Attack','Punch_Jab','Punch_Cross','Spell_Simple_Shoot','Hit_Chest','Hit_Head','Jump_Start','Jump_Land','Death01','Interact','PickUp_Table','Roll']);

export function createHumanoidAnimator(rig){
 const clips=clipsFor(rig.sex),mixer=new rig.T.AnimationMixer(rig.model);
 const actions=new Map(),weights=new Map();let current='Idle_Loop',oneShot=null,oneShotLeft=0,lastAttack=0,lastHit=0,airborne=false,punch=0,time=0,guard=0,fightUntil=-1;
 const warp=createStrideWarp(rig);let stride=1;
 const arms=createArmLayers(rig);let aim=0,shot=null,cast=null;
 const loops={};
 function clipFor(name){const [clip,loop]=name.split('@');if(!loop)return clips[clip];if(!clips[clip])return null;return loops[name]||(loops[name]=Object.assign(clips[clip].clone(),{name}))}
 function action(name){if(!clipFor(name))name='Idle_Loop';if(!actions.has(name)){const a=mixer.clipAction(clipFor(name));a.enabled=true;a.setEffectiveWeight(0);if(ONE_SHOT.has(name)){a.setLoop(2200,1);a.clampWhenFinished=true}a.play();actions.set(name,a);weights.set(name,0)}return actions.get(name)}
 function startOneShot(name,duration){const a=action(name);a.reset();a.play();const length=clips[name]?.duration||1;a.timeScale=duration?length/duration:1;oneShot=name;oneShotLeft=duration||length;}
 action('Idle_Loop').setEffectiveWeight(1);weights.set('Idle_Loop',1);
 return {mixer,update(dt,{distance=0,speed=0,attack=0,hit=0,armed=false,weapon=null,block=0,locomotion=null,style=null,mounted=false,airborne:air=false,activity=null,dead=false,ranged=false,magic=false,combat=false}={}){
  if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);time+=dt;
  speed=Number.isFinite(speed)?Math.max(0,speed):0;distance=Number.isFinite(distance)?Math.max(0,distance):0;
  const moving=distance>1e-5&&speed>.15&&!mounted;
  // Event-driven one-shots: a new attack, a fresh hit, take-off and landing.
  if(attack>lastAttack+.05||attack>0&&lastAttack<=0){const spell=magic||style==='magic';if(spell){startOneShot('Spell_Simple_Shoot',Math.max(.45,attack));cast={t:0,at:Math.max(.45,attack)*.45}}else if(ranged)shot={t:0,duration:Math.max(.6,attack)};else startOneShot(spell?'Spell_Simple_Shoot':armed?'Sword_Attack':(punch++%2?'Punch_Cross':'Punch_Jab'),Math.max(.35,attack))}
  // Fighting (an armed attack, a block, or the caller's combat flag) holds the
  // combat stance a few seconds, then it eases back to the relaxed idle.
  if(armed&&attack>0||block>0)fightUntil=time+FIGHT_HOLD;else if(combat)fightUntil=Math.max(fightUntil,time+COMBAT_HOLD);lastAttack=attack;
  const hitNow=Number.isFinite(hit)?hit:0;if(hitNow>.5&&lastHit<=.5&&!oneShot)startOneShot(Math.random()<.5?'Hit_Chest':'Hit_Head',.45);lastHit=hitNow;
  if(air&&!airborne)startOneShot('Jump_Start',.3);else if(!air&&airborne)startOneShot('Jump_Land',.35);airborne=!!air;
  // Base loop for the current state.
  let base;const work=ACTIVITY[activity||rig.activity];
  if(dead)base='Death01';
  else if(mounted)base=clips.Driving_Loop?'Driving_Loop':'Sitting_Idle_Loop';
  else if(airborne)base='Jump_Loop';
  else if(moving){const gait=locomotion==='run'?'Sprint_Loop':locomotion==='jog'?'Jog_Fwd_Loop':(locomotion==='walk'||locomotion==='combat')&&speed<=WALK_LIMIT?'Walk_Loop':speed>6.5?'Sprint_Loop':speed>2.6?'Jog_Fwd_Loop':'Walk_Loop';base=gait;}
  // Relaxed by default; the fighting stance is for an explicit combat stance or
  // a few seconds after armed melee attacks and blocks.
  else base=work||(block>0||!ranged&&time<fightUntil?'Sword_Idle':'Idle_Loop');
  if(base!==current){current=base;action(base).reset?.()}
  const loop=action(base);if(STRIDE[base]){const play=gaitPlayback(base,speed,{stride:STRIDE[base],duration:loop.getClip().duration,scale:CHARACTER_SCALE});loop.timeScale=play.timeScale;stride=play.amplitude}else{loop.timeScale=1;stride=1}
  if(work&&base===work&&rig.activityPhase!=null){loop.time=rig.activityPhase*loop.getClip().duration;loop.timeScale=0}
  // Cross-fade: the active one-shot (if any) takes over, then hands back.
  if(oneShot){oneShotLeft-=dt;if(oneShotLeft<=0&&!(oneShot==='Death01'))oneShot=null}
  const target=oneShot||base,k=1-Math.exp(-dt/FADE*3);
  for(const [name,a] of actions){const w=weights.get(name)+((name===target?1:0)-weights.get(name))*k;weights.set(name,w<.001?0:w);a.setEffectiveWeight(weights.get(name))}
  mixer.update(dt);
  // Shorter strides for the gait loop, weighted by how far it has faded in.
  if(STRIDE[base]&&moving){const w=weights.get(base)||0;if(w>0)warp(loop.getClip(),1-(1-stride)*w)}
  // Blocking raises the shield across the chest on top of whatever clip plays.
  guard+=((block>0&&!mounted&&!dead&&!ranged?1:0)-guard)*k;if(guard<.001)guard=0;if(guard)arms.guard(guard);
  // Bow shot: raise and draw over 70% of the attack, release, then lower.
  let draw=0,released=false;
  // Spell: the bolt leaves the casting (left) hand partway through the cast.
  if(cast){cast.t+=dt;if(cast.t>=cast.at){released=true;cast=null}}
  if(shot){shot.t+=dt;const u=shot.t/shot.duration;draw=u<.7?Math.min(1,u/.7)**.8:0;if(u>=.7&&!shot.released){shot.released=true;released=true}if(u>=1.25)shot=null}
  aim+=((shot&&!mounted&&!dead?1:0)-aim)*Math.min(1,k*1.6);if(aim<.001)aim=0;if(aim)arms.aim(aim,draw);
  const run=base==='Sprint_Loop'?1:base==='Jog_Fwd_Loop'?.65:0;
  return {blend:moving?1:0,run,gait:base,flight:airborne,contacts:{left:!airborne,right:!airborne},attack:attack>0,hit:hitNow>.01,clip:target,guard,aim,draw,released};
 },dispose(){mixer.stopAllAction();mixer.uncacheRoot(rig.model)}};
}

// Arm layers applied after the mixer, weighted 0..1 so they fade in and out:
// a two-bone reach (upper arm, forearm) to a point in the character's frame,
// then an optional wrist turn aligning the held item.
//  guard(w):      left fist in front of the chest, shield face (socket +Z) forward.
//  aim(w,draw):   bow arm straight ahead with the bow upright (socket +Y up, its
//                 limbs, socket +X, toward the target); the right hand draws
//                 the string back toward the cheek as `draw` goes 0..1.
function createArmLayers(rig){
 const T=rig.T,b=rig.bones;
 const forward=new T.Vector3(),up=new T.Vector3(),left=new T.Vector3(),a=new T.Vector3(),c=new T.Vector3(),to=new T.Vector3(),target=new T.Vector3();
 const q=new T.Quaternion(),wq=new T.Quaternion(),pq=new T.Quaternion(),id=new T.Quaternion(),rot=new T.Quaternion(),m=new T.Matrix4();
 // Rotate `bone` in world space by `rotation`, scaled by weight.
 function turn(bone,rotation,weight){q.copy(id).slerp(rotation,weight);bone.getWorldQuaternion(wq);bone.parent.getWorldQuaternion(pq);bone.quaternion.copy(pq.invert().multiply(q).multiply(wq));bone.updateMatrixWorld(true)}
 function frame(){rig.model.updateMatrixWorld(true);rig.root.getWorldQuaternion(wq);forward.set(0,0,1).applyQuaternion(wq);up.set(0,1,0).applyQuaternion(wq);left.set(1,0,0).applyQuaternion(wq)}
 function reach(side,goal,weight){const s=side==='left'?'l':'r',hand=b['hand_'+s];for(let pass=0;pass<4;pass++)for(const bone of [b['lowerarm_'+s],b['upperarm_'+s]]){bone.getWorldPosition(c);hand.getWorldPosition(a).sub(c).normalize();to.copy(goal).sub(c).normalize();turn(bone,rot.setFromUnitVectors(a,to),weight)}}
 return {
  guard(weight){frame();b.spine_03.getWorldPosition(target).addScaledVector(forward,.5).addScaledVector(left,.12);reach('left',target,weight);
   rig.leftHand.getWorldQuaternion(pq);a.set(0,0,1).applyQuaternion(pq);turn(b.hand_l,rot.setFromUnitVectors(a,forward),weight)},
  aim(weight,draw){frame();
   // Bow arm: straight out from the left shoulder at shoulder height.
   b.upperarm_l.getWorldPosition(target).addScaledVector(forward,.78).addScaledVector(left,-.06).addScaledVector(up,.04);reach('left',target,weight);
   // Bow upright, limbs toward the target: socket basis (X forward, Y up, Z = X × Y).
   c.crossVectors(forward,up);m.makeBasis(forward,up,c);const want=new T.Quaternion().setFromRotationMatrix(m);rig.leftHand.getWorldQuaternion(pq);turn(b.hand_l,want.multiply(pq.invert()),weight);
   // String hand: from the bow grip back to the cheek.
   b.hand_l.getWorldPosition(target).addScaledVector(forward,-.66*draw).addScaledVector(left,-.05*draw);b.upperarm_r.getWorldPosition(c);target.y=Math.max(target.y,c.y+.06*draw);reach('right',target,weight)}
 };
}
