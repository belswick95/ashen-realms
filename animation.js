import {clipsFor,CHARACTER_SCALE} from './character-assets.js?v=release-20261106-r3x109';
import {gaitPlayback,createStrideWarp} from './gait-cadence.js?v=release-20261106-r3x109';
import {createRunStyle,runStyleWeight} from './run-style.js?v=release-20261106-r3x109';
// Clip-driven animation for every human in Eldervale (Quaternius Universal
// Animation Library, CC0). The caller describes what the character is doing;
// this picks the clip, cross-fades, and plays gaits at a natural cadence
// for the real travel speed with strides shortened to match (gait-cadence.js),
// so feet do not slide. Gameplay roots are never moved here.

// Ground speed of each loop at normal playback, in world units per second:
// how fast the planted ball of the foot moves backward (measured from the
// clips, Quaternius metres × scale).
export const STRIDE={Walk_Loop:1.03*CHARACTER_SCALE,Jog_Fwd_Loop:6.27*CHARACTER_SCALE,Sprint_Loop:9.5*CHARACTER_SCALE};
// Death pose timing (s): kneel clip is down by 0.7 s; Death01 joins where its hips are at
// kneeling height (0.8 s) and plays a little slower so the collapse reads.
export const DEATH_KNEEL=1.1,KNEEL_HOLD=.7,DEATH_JOIN=.8,DEATH_FALL_SPEED=.6;
const FADE=.18,FIGHT_HOLD=6,COMBAT_HOLD=3,WALK_LIMIT=3.8;
// Town and profession activities → looping clips.
// A clip name ending in '@loop' repeats a normally one-shot clip (chopping, mining).
const ACTIVITY={smith:'Fixing_Kneeling',fix:'Fixing_Kneeling',garden:'Fixing_Kneeling',sweep:'Push_Loop',push:'Push_Loop',carry:'Idle_Torch_Loop',read:'Idle_Talking_Loop',talk:'Idle_Talking_Loop',sit:'Sitting_Idle_Loop',interact:'Interact@loop',pickup:'PickUp_Table@loop',swim:'Swim_Idle_Loop',mine:'Sword_Attack@loop',woodcut:'Sword_Attack@loop',fish:'Idle_Torch_Loop',net:'Fixing_Kneeling',cook:'Interact@loop',craft:'Fixing_Kneeling',
 // Town jobs (npc-activities.js layers hands and props over these).
 hammer:'Idle_Loop',broom:'Idle_Loop',haul:'Idle_Loop',ledger:'Idle_Loop',trade:'Idle_Talking_Loop',chat:'Idle_Talking_Loop',fetch:'PickUp_Table@loop',pray:'Idle_Loop',watch:'Idle_Loop',rest:'Idle_Loop',sitread:'Sitting_Idle_Loop'};
export const ACTIVITY_CLIPS=ACTIVITY;
const LOW_POSE=new Set(['Fixing_Kneeling','Sitting_Idle_Loop']);
const ONE_SHOT=new Set(['Sword_Attack','Punch_Jab','Punch_Cross','Spell_Simple_Shoot','Hit_Chest','Hit_Head','Jump_Start','Jump_Land','Death01','Interact','PickUp_Table','Roll']);

export function createHumanoidAnimator(rig){
 const clips=clipsFor(rig.sex),mixer=new rig.T.AnimationMixer(rig.model);
 const actions=new Map(),weights=new Map(),mids=new Map();let settle=0,deadAt=-1,current='Idle_Loop',oneShot=null,oneShotLeft=0,lastAttack=0,lastHit=0,airborne=false,punch=0,time=0,guard=0,fightUntil=-1;
 const warp=createStrideWarp(rig),runStyle=createRunStyle(rig);let stride=1;
 const arms=createArmLayers(rig);let aim=0,shot=null,cast=null,carry=0,netting=0;
 const holding=socket=>!!socket&&socket.children.some(c=>(c.userData.weaponMount||c.userData.shieldMount)&&c.visible);
 const loops={};
 function clipFor(name){const [clip,loop]=name.split('@');if(!loop)return clips[clip];if(!clips[clip])return null;return loops[name]||(loops[name]=Object.assign(clips[clip].clone(),{name}))}
 function action(name){if(!clipFor(name))name='Idle_Loop';if(!actions.has(name)){const a=mixer.clipAction(clipFor(name));a.enabled=true;a.setEffectiveWeight(0);if(ONE_SHOT.has(name)){a.setLoop(2200,1);a.clampWhenFinished=true}a.play();actions.set(name,a);weights.set(name,0)}return actions.get(name)}
 function startOneShot(name,duration){const a=action(name);a.reset();a.play();const length=clips[name]?.duration||1;a.timeScale=duration?length/duration:1;oneShot=name;oneShotLeft=duration||length;}
 action('Idle_Loop').setEffectiveWeight(1);weights.set('Idle_Loop',1);
 const eating=createEatLayer(rig,arms);
 return {mixer,update(dt,{eat=0,food=null,distance=0,speed=0,attack=0,hit=0,armed=false,weapon=null,block=0,locomotion=null,style=null,mounted=false,airborne:air=false,activity=null,dead=false,ranged=false,magic=false,combat=false}={}){
  if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);time+=dt;
  speed=Number.isFinite(speed)?Math.max(0,speed):0;distance=Number.isFinite(distance)?Math.max(0,distance):0;
  const moving=distance>1e-5&&speed>.15&&!mounted;
  // Event-driven one-shots: a new attack, a fresh hit, take-off and landing.
  if(attack>lastAttack+.05||attack>0&&lastAttack<=0){const spell=magic||style==='magic';if(spell){startOneShot('Spell_Simple_Shoot',Math.max(.45,attack));cast={t:0,at:Math.max(.45,attack)*.45}}else if(ranged)shot={t:0,duration:Math.max(.6,attack)};else startOneShot(spell?'Spell_Simple_Shoot':armed?'Sword_Attack':(punch++%2?'Punch_Cross':'Punch_Jab'),Math.max(.35,attack))}
  // Fighting (an armed attack, a block, or the caller's combat flag) holds the
  // combat stance a few seconds, then it eases back to the relaxed idle.
  if(armed&&attack>0||block>0)fightUntil=time+FIGHT_HOLD;else if(combat)fightUntil=Math.max(fightUntil,time+COMBAT_HOLD);lastAttack=attack;
  // A fresh hit (the timer jumps up; callers start it at .3-.45 s) flinches once.
  const hitNow=Number.isFinite(hit)?hit:0;if(hitNow>lastHit+.05&&hitNow>.1&&!oneShot&&!dead)startOneShot(Math.random()<.5?'Hit_Chest':'Hit_Head',.45);lastHit=hitNow;
  if(air&&!airborne)startOneShot('Jump_Start',.3);else if(!air&&airborne)startOneShot('Jump_Land',.35);airborne=!!air;
  // Base loop for the current state.
  let base;const work=ACTIVITY[activity||rig.activity];
  // Death: drop to the knees with the head bowed (Fixing_Kneeling, held), then collapse (Death01
  // joined mid-fall). About 2.7 s in all; the pose holds until `dead` clears.
  if(dead){if(deadAt<0)deadAt=time;oneShot=null}else deadAt=-1;
  if(dead)base=clips.Fixing_Kneeling&&time-deadAt<DEATH_KNEEL?'Fixing_Kneeling':'Death01';
  else if(mounted)base=clips.Driving_Loop?'Driving_Loop':'Sitting_Idle_Loop';
  else if(airborne)base='Jump_Loop';
  else if(moving){const gait=locomotion==='run'?'Sprint_Loop':locomotion==='jog'?'Jog_Fwd_Loop':(locomotion==='walk'||locomotion==='combat')&&speed<=WALK_LIMIT?'Walk_Loop':speed>6.5?'Sprint_Loop':speed>2.6?'Jog_Fwd_Loop':'Walk_Loop';base=gait;}
  // Relaxed by default; the fighting stance is for an explicit combat stance or
  // a few seconds after armed melee attacks and blocks.
  else base=work||(block>0||!ranged&&time<fightUntil?'Sword_Idle':'Idle_Loop');
  // A loop that is still fading out keeps its phase when it comes back (walk ->
  // idle -> walk within a fade): restarting it from frame 0 visibly pops the limbs.
  if(base!==current){if(LOW_POSE.has(base)||LOW_POSE.has(current))settle=.9;current=base;const a=action(base);if(dead||!((weights.get(base)||0)>.05))a.reset?.();if(dead&&base==='Death01'&&clips.Fixing_Kneeling)a.time=DEATH_JOIN}
  const loop=action(base);if(STRIDE[base]){const play=gaitPlayback(base,speed,{stride:STRIDE[base],duration:loop.getClip().duration,scale:CHARACTER_SCALE});loop.timeScale=play.timeScale;stride=play.amplitude}else{loop.timeScale=1;stride=1}
  if(work&&base===work&&rig.activityPhase!=null){loop.time=rig.activityPhase*loop.getClip().duration;loop.timeScale=0}
  // Net fishing holds the kneel (the arms and spine are posed by arms.net), so the body does not bob each loop.
  else if(base===work&&(activity||rig.activity)==='net'&&base==='Fixing_Kneeling'){loop.time=Math.min(KNEEL_HOLD,loop.getClip().duration);loop.timeScale=0}
  if(dead&&base==='Fixing_Kneeling')loop.timeScale=loop.time>=KNEEL_HOLD?0:1;else if(dead&&base==='Death01')loop.timeScale=DEATH_FALL_SPEED;
  // Cross-fade: the active one-shot (if any) takes over, then hands back.
  if(oneShot){oneShotLeft-=dt;if(oneShotLeft<=0&&!(oneShot==='Death01'))oneShot=null}
  const target=oneShot||base,k=1-Math.exp(-dt/FADE*3);
  // Townsfolk (rig.smoothFade, npc-activities.js) blend loops through two
  // cascaded smoothing stages: the fade starts gently and takes about a third
  // of a second, so stopping to sweep, kneeling down or getting up from a
  // bench never jumps the hips and feet a quarter of the way in one frame.
  // Weights still sum to one (both stages are linear). One-shots stay crisp.
  // Kneeling down, sitting and getting up again take a little longer still.
  settle=Math.max(0,settle-dt);const soft=rig.smoothFade&&!oneShot&&!dead,k2=1-Math.exp(-dt/(settle>0?.12:.075));
  for(const [name,a] of actions){const t=name===target?1:0;let w;if(soft){const m0=mids.get(name)??weights.get(name),m=m0+(t-m0)*k2;mids.set(name,m);w=weights.get(name)+(m-weights.get(name))*k2}else{w=weights.get(name)+(t-weights.get(name))*k;mids.set(name,w)}weights.set(name,w<.001&&t===0&&!(mids.get(name)>.001)?0:w);a.setEffectiveWeight(weights.get(name))}
  mixer.update(dt);
  // Shorter strides for the gait loop, weighted by how far it has faded in.
  if(STRIDE[base]&&moving){const w=weights.get(base)||0;if(w>0)warp(loop.getClip(),1-(1-stride)*w)}
  // Calm the run: steadier hips, head and torso, smaller arm swing (run-style.js).
  if(moving&&!airborne&&!oneShot)runStyle.update(loop.getClip(),base,weights.get(base)||0);
  // Blocking raises the shield across the chest on top of whatever clip plays.
  guard+=((block>0&&!mounted&&!dead&&!ranged?1:0)-guard)*k;if(guard<.001)guard=0;if(guard)arms.guard(guard);
  // Held weapon / shield ride steady at the side while running (gently while walking).
  carry+=((STRIDE[base]&&moving&&!airborne&&!oneShot&&!mounted&&!dead?1:0)-carry)*k;if(carry<.001)carry=0;
  if(carry&&!guard)for(const side of ['left','right'])if(holding(side==='left'?rig.leftHand:rig.rightHand))arms.carry(side,carry*(runStyleWeight(base,1)?.8:.45));
  // Bow shot: raise and draw over 70% of the attack, release, then lower.
  let draw=0,released=false;
  // Spell: the bolt leaves the casting (left) hand partway through the cast.
  if(cast){cast.t+=dt;if(cast.t>=cast.at){released=true;cast=null}}
  if(shot){shot.t+=dt;const u=shot.t/shot.duration;draw=u<.7?Math.min(1,u/.7)**.8:0;if(u>=.7&&!shot.released){shot.released=true;released=true}if(u>=1.25)shot=null}
  aim+=((shot&&!mounted&&!dead?1:0)-aim)*Math.min(1,k*1.6);if(aim<.001)aim=0;if(aim)arms.aim(aim,draw);
  // Eating: weapon and shield are put away, the right hand brings the food to the mouth.
  const bite=eating.update(eat,food,{mounted,dead});
  // Net fishing (gathering-visuals.js sets rig.netDip): lean over the bank,
  // both hands on the pole, dip the net into the water, scoop and lift.
  const dip=rig.netDip;netting+=((dip&&!moving&&!mounted&&!dead&&!oneShot?1:0)-netting)*k;if(netting<.001)netting=0;if(netting&&dip)arms.net(netting,dip);
  const run=base==='Sprint_Loop'?1:base==='Jog_Fwd_Loop'?.65:0;
  return {blend:moving?1:0,run,gait:base,flight:airborne,contacts:{left:!airborne,right:!airborne},attack:attack>0,hit:hitNow>.01,clip:target,guard,aim,draw,released,bite};
 },dispose(){eating.dispose();mixer.stopAllAction();mixer.uncacheRoot(rig.model)}};
}

// One net-fishing cycle, u in 0..1 (gathering-visuals.js times it so the net
// meets the water at u = .35, when the splash sounds):
//  0-.15 net held up over the water, .15-.35 lean in and lower it, .35-.6 scoop
//  just under the surface toward the bank, .6-.85 lift it out, .85-1 shake.
// lean: 0..1 forward bend; height: net ring above the water (m); sweep: sideways (m).
export function netDipPhase(u){u=((Number(u)%1)+1)%1||0;const ease=x=>x<=0?0:x>=1?1:x*x*(3-2*x);
 if(u<.15)return {lean:.25,height:.9,sweep:0};
 if(u<.35){const e=ease((u-.15)/.2);return {lean:.25+.75*e,height:.9-1.0*e,sweep:0}}
 if(u<.6){const e=ease((u-.35)/.25);return {lean:1,height:-.1-.06*Math.sin(e*Math.PI),sweep:-.25*Math.sin(e*Math.PI)}}
 if(u<.85){const e=ease((u-.6)/.25);return {lean:1-.75*e,height:-.1+1.0*e,sweep:0}}
 return {lean:.25,height:.9+.04*Math.sin((u-.85)/.15*Math.PI*4),sweep:0};
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
 const netShoulder=new T.Vector3(),netGoal=new T.Vector3(),netHand=new T.Vector3(),netDir=new T.Vector3(),netY=new T.Vector3(0,1,0),netParent=new T.Quaternion(),netWant=new T.Quaternion();
 // Rotate `bone` in world space by `rotation`, scaled by weight.
 function turn(bone,rotation,weight){q.copy(id).slerp(rotation,weight);bone.getWorldQuaternion(wq);bone.parent.getWorldQuaternion(pq);bone.quaternion.copy(pq.invert().multiply(q).multiply(wq));bone.updateMatrixWorld(true)}
 function frame(){rig.model.updateMatrixWorld(true);rig.root.getWorldQuaternion(wq);forward.set(0,0,1).applyQuaternion(wq);up.set(0,1,0).applyQuaternion(wq);left.set(1,0,0).applyQuaternion(wq)}
 function reach(side,goal,weight){const s=side==='left'?'l':'r',hand=b['hand_'+s];for(let pass=0;pass<4;pass++)for(const bone of [b['lowerarm_'+s],b['upperarm_'+s]]){bone.getWorldPosition(c);hand.getWorldPosition(a).sub(c).normalize();to.copy(goal).sub(c).normalize();turn(bone,rot.setFromUnitVectors(a,to),weight)}}
 return {
  // Hand to mouth: the right fist rises just in front of the chin.
  mouth(weight){frame();(b.Head||b.head).getWorldPosition(target).addScaledVector(forward,.13).addScaledVector(up,-.07).addScaledVector(left,-.03);reach('right',target,weight)},
  // Running with a weapon or shield: that arm is carried low beside the hip,
  // elbow bent, instead of pumping the item across the chest; a shield hangs
  // with its face turned outward.
  carry(side,weight){frame();const s=side==='left'?'l':'r',out=side==='left'?1:-1,up_=b['upperarm_'+s],fore=b['lowerarm_'+s],hand=b['hand_'+s];
   up_.getWorldPosition(c);fore.getWorldPosition(a);const L=c.distanceTo(a)+a.distanceTo(hand.getWorldPosition(to));
   target.copy(c).addScaledVector(up,-.68*L).addScaledVector(forward,.42*L).addScaledVector(left,out*.12*L);reach(side,target,weight);
   if(side==='left'){rig.leftHand.getWorldQuaternion(pq);a.set(0,0,1).applyQuaternion(pq);turn(b.hand_l,rot.setFromUnitVectors(a,left),weight*.85)}},
  guard(weight){frame();b.spine_03.getWorldPosition(target).addScaledVector(forward,.5).addScaledVector(left,.12);reach('left',target,weight);
   rig.leftHand.getWorldQuaternion(pq);a.set(0,0,1).applyQuaternion(pq);turn(b.hand_l,rot.setFromUnitVectors(a,forward),weight)},
  // Net fishing pose for cycle position dip.u (see netDipPhase): the spine leans
  // toward the water, the right hand reaches along the pole toward the net's
  // goal at the water line (dip.water, world space), the left hand grips the
  // pole further down, and the net prop (dip.tool) is turned to lie along it.
  net(weight,dip){const ph=netDipPhase(dip.u);frame();
   for(const bone of [b.spine_01,b.spine_02,b.spine_03])if(bone)turn(bone,rot.setFromAxisAngle(left,ph.lean*.12),weight);
   frame();const sh=b.upperarm_r;if(!sh||!b.lowerarm_r||!b.hand_r)return;sh.getWorldPosition(netShoulder);
   // Arm length (shoulder -> hand) and pole length (hand -> net ring) in world units.
   const elbow=b.lowerarm_r.getWorldPosition(netGoal),arm=(netShoulder.distanceTo(elbow)+elbow.distanceTo(b.hand_r.getWorldPosition(netHand)))*.92;let pole=dip.pole||1;if(dip.tool?.parent){dip.tool.updateWorldMatrix(true,false);dip.tool.getWorldPosition(netHand);pole=netGoal.set(0,dip.tool.userData.ringY||1.02,0).applyMatrix4(dip.tool.matrixWorld).distanceTo(netHand)||pole}
   // Net ring on the vertical plane ahead: as far out as arm + pole reach, at the phase height above the water.
   // The net never reaches further out than its dip point: lifting draws it up and back to the bank.
   const v=dip.water.y+ph.height-netShoulder.y,R=arm+pole,low=dip.water.y-.1-netShoulder.y,h=Math.min(Math.sqrt(Math.max(.04,R*R-v*v)),Math.sqrt(Math.max(.04,R*R-low*low)));
   netGoal.copy(netShoulder).addScaledVector(forward,h).addScaledVector(left,ph.sweep);netGoal.y=netShoulder.y+v;
   dip.ring?.copy(netGoal);netDir.copy(netGoal).sub(netShoulder).normalize();
   const span=Math.hypot(h,v);netGoal.copy(netShoulder).addScaledVector(netDir,Math.max(.25,Math.min(arm,span-pole)));reach('right',netGoal,weight);
   b.hand_r.getWorldPosition(netHand);netGoal.copy(netHand).addScaledVector(netDir,.32).addScaledVector(left,.05);reach('left',netGoal,weight*.9);
   const tool=dip.tool;if(tool?.parent){tool.userData.restQuaternion??=tool.quaternion.clone();tool.parent.getWorldQuaternion(netParent);netWant.setFromUnitVectors(netY,netDir);tool.quaternion.copy(netParent.invert().multiply(netWant)).slerp(tool.userData.restQuaternion,1-weight)}},
  aim(weight,draw){frame();
   // Bow arm: straight out from the left shoulder at shoulder height.
   b.upperarm_l.getWorldPosition(target).addScaledVector(forward,.78).addScaledVector(left,-.06).addScaledVector(up,.04);reach('left',target,weight);
   // Bow upright, limbs toward the target: socket basis (X forward, Y up, Z = X × Y).
   c.crossVectors(forward,up);m.makeBasis(forward,up,c);const want=new T.Quaternion().setFromRotationMatrix(m);rig.leftHand.getWorldQuaternion(pq);turn(b.hand_l,want.multiply(pq.invert()),weight);
   // String hand: from the bow grip back to the cheek.
   b.hand_l.getWorldPosition(target).addScaledVector(forward,-.66*draw).addScaledVector(left,-.05*draw);b.upperarm_r.getWorldPosition(c);target.y=Math.max(target.y,c.y+.06*draw);reach('right',target,weight)}
 };
}

// Eat pose, layered after the clip like guard/aim. `remaining` counts down from
// EAT_ANIMATION (food.js, about 1.1 s): weapon and shield hide at once, the right
// hand lifts the food to the mouth (ease in over the first 35%), holds for the
// bite, then lowers; held items reappear when the timer ends.
export function eatWeight(remaining,duration=1.1){if(!(remaining>0))return 0;const u=1-Math.min(1,remaining/duration);return u<.35?Math.sin(u/.35*Math.PI/2):u<.75?1:Math.cos((u-.75)/.25*Math.PI/2)}
function createEatLayer(rig,arms){
 const T=rig.T,hidden=new Set();let morsel=null,color=null;
 function held(on){const sockets=[rig.rightHand,rig.leftHand].filter(Boolean);if(on){for(const socket of sockets)for(const child of socket.children)if((child.userData.weaponMount||child.userData.shieldMount)&&child.visible){child.visible=false;hidden.add(child)}}else{for(const child of hidden)child.visible=true;hidden.clear()}}
 function food(item){const want=item?.color??0xc98d5a;if(!morsel){morsel=new T.Mesh(new T.SphereGeometry(.045,10,8),new T.MeshStandardMaterial({color:want,roughness:.75}));morsel.scale.set(1.5,.85,1);morsel.position.set(0,.03,.04);morsel.userData.eatMorsel=true;rig.rightHand?.add(morsel)}if(color!==want){morsel.material.color.setHex(want);color=want}return morsel}
 return {update(remaining,item,{mounted=false,dead=false}={}){const active=remaining>0&&!dead;if(!active){if(hidden.size)held(false);if(morsel)morsel.visible=false;return 0}held(true);food(item).visible=true;const w=mounted?eatWeight(remaining)*.8:eatWeight(remaining);if(w>0)arms.mouth(w);return w},
  dispose(){held(false);if(morsel){morsel.removeFromParent();morsel.geometry.dispose();morsel.material.dispose();morsel=null}}};
}
