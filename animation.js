import {clipsFor,locomotionSpeed} from './character-assets.js?v=release-20261107-buildings149';
import {attackMotion,strikeTime,clipTime} from './attack-motion.js?v=release-20261107-buildings149';
import {EMOTE_SECONDS,emoteClip,emoteWeight,emotePose} from './emote-motion.js?v=release-20261107-buildings149';
// Clip-driven animation for every human in Eldervale (Quaternius Universal
// Animation Library, CC0). The caller describes what the character is doing;
// this picks the clip and cross-fades. Walking and running use the owner's
// Adobe Mixamo walk and run, retargeted onto each body
// (scripts/build-mixamo-locomotion.mjs), played exactly as authored: only the
// playback rate follows the real travel speed, so the planted foot moves back
// at the ground speed and does not slide. Gameplay roots are never moved here.

// The two locomotion loops. Their natural ground speed (world units per second
// at playback rate 1: how fast the planted foot moves backward) is measured
// per body when the clips are baked (locomotionSpeed, character-assets.js).
export const WALK_CLIP='Mixamo_Walk',RUN_CLIP='Mixamo_Run',LOCOMOTION=new Set([WALK_CLIP,RUN_CLIP]);
// Playback rate limits: very slow strolls play slower, never frozen.
export const MIN_RATE=.35,MAX_RATE=2.5;
export function gaitRate(sex,gait,speed){const natural=locomotionSpeed(sex,gait);if(!(natural>0)||!(speed>0))return 1;return Math.max(MIN_RATE,Math.min(MAX_RATE,speed/natural))}
// Which loop a moving character plays: an explicit run (or jog) runs; a walk
// (or combat walk) walks up to WALK_LIMIT; otherwise the travel speed decides.
export function gaitFor(locomotion,speed){if(locomotion==='run'||locomotion==='jog')return RUN_CLIP;if((locomotion==='walk'||locomotion==='combat')&&speed<=WALK_LIMIT)return WALK_CLIP;return speed>WALK_LIMIT?RUN_CLIP:WALK_CLIP}
// Death pose timing (s): kneel clip is down by 0.7 s; Death01 joins where its hips are at
// kneeling height (0.8 s) and plays a little slower so the collapse reads.
export const DEATH_KNEEL=1.1,KNEEL_HOLD=.7,DEATH_JOIN=.8,DEATH_FALL_SPEED=.6;
// Starting, stopping and switching between walk and run blend a little longer than other clips.
const GAIT_FADE=.3,FADE=.18,FIGHT_HOLD=6,COMBAT_HOLD=3;export const WALK_LIMIT=3.8;
// Town and profession activities → looping clips.
// A clip name ending in '@loop' repeats a normally one-shot clip (chopping, mining).
const ACTIVITY={smith:'Fixing_Kneeling',fix:'Fixing_Kneeling',garden:'Fixing_Kneeling',sweep:'Push_Loop',push:'Push_Loop',carry:'Idle_Torch_Loop',read:'Idle_Talking_Loop',talk:'Idle_Talking_Loop',sit:'Sitting_Idle_Loop',interact:'Interact@loop',pickup:'PickUp_Table@loop',swim:'Swim_Idle_Loop',mine:'Sword_Attack@loop',woodcut:'Sword_Attack@loop',fish:'Idle_Torch_Loop',net:'Fixing_Kneeling',cook:'Interact@loop',craft:'Fixing_Kneeling',
 // Town jobs (npc-activities.js layers hands and props over these).
 hammer:'Idle_Loop',broom:'Idle_Loop',haul:'Idle_Loop',ledger:'Idle_Loop',trade:'Idle_Talking_Loop',chat:'Idle_Talking_Loop',fetch:'PickUp_Table@loop',pray:'Idle_Loop',watch:'Idle_Loop',rest:'Idle_Loop',sitread:'Sitting_Idle_Loop'};
export const ACTIVITY_CLIPS=ACTIVITY;
const LOW_POSE=new Set(['Fixing_Kneeling','Sitting_Idle_Loop']);
const ONE_SHOT=new Set(['Sword_Attack','Punch_Jab','Punch_Cross','Spell_Simple_Shoot','Hit_Chest','Hit_Head','Death01','Interact','PickUp_Table','Roll']);

export function createHumanoidAnimator(rig){
 const clips=clipsFor(rig.sex),mixer=new rig.T.AnimationMixer(rig.model);
 const actions=new Map(),weights=new Map(),mids=new Map();let settle=0,gaitFade=0,deadAt=-1,current='Idle_Loop',oneShot=null,oneShotLeft=0,swing=null,lastAttack=0,lastHit=0,punch=0,time=0,guard=0,fightUntil=-1;
 const arms=createArmLayers(rig);let aim=0,shot=null,cast=null,carry=0,netting=0;const held={left:{w:0,kind:null},right:{w:0,kind:null}};
 const holding=socket=>!!socket&&socket.children.some(c=>(c.userData.weaponMount||c.userData.shieldMount)&&c.visible);
 const loops={};
 function clipFor(name){const [clip,loop]=name.split('@');if(!loop)return clips[clip];if(!clips[clip])return null;return loops[name]||(loops[name]=Object.assign(clips[clip].clone(),{name}))}
 function action(name){if(!clipFor(name))name='Idle_Loop';if(!actions.has(name)){const a=mixer.clipAction(clipFor(name));a.enabled=true;a.setEffectiveWeight(0);if(ONE_SHOT.has(name)){a.setLoop(2200,1);a.clampWhenFinished=true}a.play();actions.set(name,a);weights.set(name,0)}return actions.get(name)}
 function startOneShot(name,duration){const a=action(name);a.reset();a.play();const length=clips[name]?.duration||1;a.timeScale=duration?length/duration:1;oneShot=name;oneShotLeft=duration||length;}
 action('Idle_Loop').setEffectiveWeight(1);weights.set('Idle_Loop',1);
 const eating=createEatLayer(rig,arms);
 return {mixer,update(dt,{eat=0,food=null,distance=0,speed=0,attack=0,hit=0,armed=false,weapon=null,block=0,locomotion=null,style=null,mounted=false,activity=null,dead=false,ranged=false,magic=false,combat=false,emote=null}={}){
  if(!Number.isFinite(dt)||dt<=0)return;dt=Math.min(dt,.1);time+=dt;
  speed=Number.isFinite(speed)?Math.max(0,speed):0;distance=Number.isFinite(distance)?Math.max(0,distance):0;
  const moving=distance>1e-5&&speed>.15&&!mounted;
  // Event-driven one-shots: a new attack, a fresh hit, take-off and landing.
  // The motion comes from the weapon (attack-motion.js): slash, stab, crush, chop, two-handed,
  // bow or staff. The swing starts on this frame and snaps in (no slow cross-fade), and clip
  // motions are re-timed so the clip's strike frame lands at the weapon's strike time.
  let strikeNow=false;
  if(attack>lastAttack+.05||attack>0&&lastAttack<=0){const options={style,armed,ranged,magic},motion=attackMotion(weapon,options);
   if(style==='magic'&&motion.kind!=='bow')Object.assign(motion,attackMotion(null,{magic:true}));
   const duration=motion.kind==='bow'?Math.max(.6,attack):motion.kind==='cast'?Math.max(.45,attack):Math.max(.35,attack);
   swing={motion,t:0,duration,strikeAt:motion.kind==='cast'?.45*duration:motion.kind==='bow'?.7*duration:strikeTime(weapon,{...options,duration}),struck:false,clip:null};
   if(motion.kind==='cast'){startOneShot('Spell_Simple_Shoot',duration);cast={t:0,at:swing.strikeAt}}
   else if(motion.kind==='bow')shot={t:0,duration};
   else{let clip=motion.clip;if(motion.kind==='punch'){clip=punch++%2?'Punch_Cross':'Punch_Jab';swing.motion={...motion,clipStrike:clip==='Punch_Jab'?.21:motion.clipStrike}}
    if(clip&&clips[clip]){startOneShot(clip,duration);swing.clip=clip;actions.get(clip).timeScale=0;actions.get(clip).time=0}else oneShot=null}
   if(oneShot&&!dead){weights.set(oneShot,Math.max(weights.get(oneShot)||0,.7));for(const [name,w] of weights)if(name!==oneShot)weights.set(name,w*.3)}}
  if(swing){swing.t+=dt;if(swing.clip&&oneShot===swing.clip){const a=actions.get(swing.clip);a.time=clipTime(swing.motion,swing.t,a.getClip().duration,swing.duration)}
   if(!swing.struck&&swing.t>=swing.strikeAt-1e-6){swing.struck=true;strikeNow=true}}
  // Fighting (an armed attack, a block, or the caller's combat flag) holds the
  // combat stance a few seconds, then it eases back to the relaxed idle.
  if(armed&&attack>0||block>0)fightUntil=time+FIGHT_HOLD;else if(combat)fightUntil=Math.max(fightUntil,time+COMBAT_HOLD);lastAttack=attack;
  // A fresh hit (the timer jumps up; callers start it at .3-.45 s) flinches once.
  const hitNow=Number.isFinite(hit)?hit:0;if(hitNow>lastHit+.05&&hitNow>.1&&!oneShot&&!dead)startOneShot(Math.random()<.5?'Hit_Chest':'Hit_Head',.45);lastHit=hitNow;
  // Base loop for the current state.
  let base;const work=ACTIVITY[activity||rig.activity];
  const emoting=!!(emote&&EMOTE_SECONDS[emote.kind]&&emoteWeight(emote.kind,emote.t)>0&&!moving&&!mounted&&!dead);
  // Death: drop to the knees with the head bowed (Fixing_Kneeling, held), then collapse (Death01
  // joined mid-fall). About 2.7 s in all; the pose holds until `dead` clears.
  if(dead){if(deadAt<0)deadAt=time;oneShot=null}else deadAt=-1;
  if(dead)base=clips.Fixing_Kneeling&&time-deadAt<DEATH_KNEEL?'Fixing_Kneeling':'Death01';
  else if(mounted)base=clips.Driving_Loop?'Driving_Loop':'Sitting_Idle_Loop';
  else if(moving)base=gaitFor(locomotion,speed);
  // An emote (emote-motion.js) plays in place on its body clip; walking off ends it.
  else if(emoting)base=emoteClip(emote.kind);
  // Relaxed by default; the fighting stance is for an explicit combat stance or
  // a few seconds after armed melee attacks and blocks.
  else base=work||(block>0||!ranged&&time<fightUntil?'Sword_Idle':'Idle_Loop');
  // A loop that is still fading out keeps its phase when it comes back (walk ->
  // idle -> walk within a fade): restarting it from frame 0 visibly pops the limbs.
  if(base!==current){if(LOW_POSE.has(base)||LOW_POSE.has(current))settle=.9;const from=current;current=base;const a=action(base);if(dead||!((weights.get(base)||0)>.05))a.reset?.();if(dead&&base==='Death01'&&clips.Fixing_Kneeling)a.time=DEATH_JOIN;
   // Walk to run and back: the incoming loop starts at the same point of the stride
   // (both Mixamo cycles begin on the same foot), so the legs never fade out of step.
   if(LOCOMOTION.has(base)&&LOCOMOTION.has(from)&&actions.has(from)){const o=actions.get(from);a.time=o.time/o.getClip().duration*a.getClip().duration}
   if(LOCOMOTION.has(base)||LOCOMOTION.has(from))gaitFade=GAIT_FADE}
  const loop=action(base);loop.timeScale=LOCOMOTION.has(base)?gaitRate(rig.sex,base,speed):1;
  if(work&&base===work&&rig.activityPhase!=null){loop.time=rig.activityPhase*loop.getClip().duration;loop.timeScale=0}
  // Net fishing holds the kneel (the arms and spine are posed by arms.net), so the body does not bob each loop.
  else if(base===work&&(activity||rig.activity)==='net'&&base==='Fixing_Kneeling'){loop.time=Math.min(KNEEL_HOLD,loop.getClip().duration);loop.timeScale=0}
  if(emoting&&base==='Fixing_Kneeling')loop.timeScale=loop.time>=KNEEL_HOLD?0:1;
  if(dead&&base==='Fixing_Kneeling')loop.timeScale=loop.time>=KNEEL_HOLD?0:1;else if(dead&&base==='Death01')loop.timeScale=DEATH_FALL_SPEED;
  // Cross-fade: the active one-shot (if any) takes over, then hands back.
  if(oneShot){oneShotLeft-=dt;if(oneShotLeft<=0&&!(oneShot==='Death01'))oneShot=null}
  gaitFade=Math.max(0,gaitFade-dt);const target=oneShot||base,k=1-Math.exp(-dt/(gaitFade>0&&!oneShot?GAIT_FADE:FADE)*3);
  // Townsfolk (rig.smoothFade, npc-activities.js) blend loops through two
  // cascaded smoothing stages: the fade starts gently and takes about a third
  // of a second, so stopping to sweep, kneeling down or getting up from a
  // bench never jumps the hips and feet a quarter of the way in one frame.
  // Weights still sum to one (both stages are linear). One-shots stay crisp.
  // Kneeling down, sitting and getting up again take a little longer still.
  settle=Math.max(0,settle-dt);const soft=rig.smoothFade&&!oneShot&&!dead,k2=1-Math.exp(-dt/(settle>0?.15:.075));
  for(const [name,a] of actions){const t=name===target?1:0;let w;if(soft){const m0=mids.get(name)??weights.get(name),m=m0+(t-m0)*k2;mids.set(name,m);w=weights.get(name)+(m-weights.get(name))*k2}else{w=weights.get(name)+(t-weights.get(name))*k;mids.set(name,w)}weights.set(name,w<.001&&t===0&&!(mids.get(name)>.001)?0:w);a.setEffectiveWeight(weights.get(name))}
  mixer.update(dt);
  // How much of the pose is a locomotion loop: its feet are seated as authored
  // (flight and hip bob kept), so ground contact only follows slopes (foot-ground.js).
  // The kneel emote too: its toes rest behind on the ground with the ankles raised, so planting
  // the ankles would push the kneeling body (and the knees) into the ground.
  rig.footAuthored=Math.min(1,(weights.get(WALK_CLIP)||0)+(weights.get(RUN_CLIP)||0)+(emoting&&base==='Fixing_Kneeling'?weights.get('Fixing_Kneeling')||0:0));
  rig.kneeGround=emoting&&base==='Fixing_Kneeling'?weights.get('Fixing_Kneeling')||0:0;
  // Blocking raises the shield across the chest on top of whatever clip plays.
  guard+=((block>0&&!mounted&&!dead&&!ranged?1:0)-guard)*k;if(guard<.001)guard=0;if(guard)arms.guard(guard);
  // Held weapon / shield ride steady at the side while running (gently while walking).
  carry+=((LOCOMOTION.has(base)&&moving&&!oneShot&&!swing&&!mounted&&!dead?1:0)-carry)*k;if(carry<.001)carry=0;
  // Each hand fades its carry in and out on its own, so an item that appears or is put away
  // (a townsperson's trowel, eating) never snaps the arm.
  for(const side of ['left','right']){const h=held[side],item=(side==='left'?rig.leftHand:rig.rightHand)?.children.find(c=>(c.userData.weaponMount||c.userData.shieldMount)&&c.visible);if(item)h.kind=item.userData.torch?'torch':item.userData.shieldMount?'shield':'weapon';h.w+=((item?1:0)-h.w)*k;if(h.w<.001)h.w=0;
   if(h.kind==='torch')continue;
   if(carry&&!guard&&h.w&&h.kind)arms.carry(side,carry*h.w*(base===RUN_CLIP?.8:h.kind==='weapon'?.65:.45),h.kind)}
  // A held torch is carried raised a little ahead in the off hand, flame up, in every
  // stance (idle, walking, running; a little lower and closer while running). It
  // gives way to blocking and to the bow arm.
  const lit=held.left.kind==='torch'?held.left.w:0;if(lit&&!dead)arms.torch(lit*(1-guard)*(1-aim),base===RUN_CLIP?1:moving?.5:0,time);
  // Bow shot: raise and draw over 70% of the attack, release, then lower.
  let draw=0,released=false;
  // Spell: the bolt leaves the casting (left) hand partway through the cast.
  if(cast){cast.t+=dt;if(cast.t>=cast.at){released=true;cast=null}}
  if(shot){shot.t+=dt;const u=shot.t/shot.duration;draw=u<.7?Math.min(1,u/.7)**.8:0;if(u>=.7&&!shot.released){shot.released=true;released=true}if(u>=1.25)shot=null}
  aim+=((shot&&!mounted&&!dead?1:0)-aim)*Math.min(1,k*1.6);if(aim<.001)aim=0;if(aim)arms.aim(aim,draw);
  // Melee and staff swings: the weapon arm (both arms for two-handers) follows the motion's
  // keyframes over the clip, timed so the blow lands on the strike frame.
  let strikeWeight=0;
  if(swing){const m=swing.motion,u=swing.t,d=swing.duration;
   if(!dead&&!mounted&&(m.layer||m.twoHanded&&!m.ranged)){strikeWeight=Math.min(1,u/.04)*(u>d*.7?Math.max(0,1-(u-d*.7)/(d*.3)):1);strikeWeight=strikeWeight*strikeWeight*(3-2*strikeWeight);
    const phase=u<swing.strikeAt?u/swing.strikeAt:1+Math.min(1,(u-swing.strikeAt)/Math.max(.05,d-swing.strikeAt));
    if(strikeWeight>0)arms.strike(m.layer,phase,strikeWeight,{twoHanded:m.twoHanded&&!m.ranged})}
   if(u>=(m.kind==='bow'?d*1.25:d))swing=null}
  // Eating: weapon and shield are put away, the right hand brings the food to the mouth.
  const bite=eating.update(eat,food,{mounted,dead});
  // Net fishing (gathering-visuals.js sets rig.netDip): lean over the bank,
  // both hands on the pole, dip the net into the water, scoop and lift.
  const dip=rig.netDip;netting+=((dip&&!moving&&!mounted&&!dead&&!oneShot?1:0)-netting)*k;if(netting<.001)netting=0;if(netting&&dip)arms.net(netting,dip);
  // Emote arms and spine, after the clip like the other layers (not over a swing, shot or bite).
  let emoteW=0;if(emoting&&!swing&&!shot&&!bite&&!guard){emoteW=emoteWeight(emote.kind,emote.t);const pose=emotePose(emote.kind,emote.t);if(pose&&emoteW>0)arms.emote(pose,emoteW)}
  const run=base===RUN_CLIP?1:0;
  return {emote:emoteW,blend:moving?1:0,run,gait:base,flight:false,contacts:{left:true,right:true},attack:attack>0,hit:hitNow>.01,clip:target,guard,aim,draw,released,bite,
   swing:swing?{kind:swing.motion.kind,t:swing.t,strikeAt:swing.strikeAt,struck:swing.struck}:null,strike:strikeNow,strikeWeight};
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
  // Moving with a weapon or shield: that arm is carried low beside the hip,
  // elbow bent, instead of pumping the item across the chest (the Mixamo run
  // swings the fists up to the chin); a shield hangs with its face turned
  // outward, a weapon's blade points ahead, clear of the face.
  carry(side,weight,kind){frame();const s=side==='left'?'l':'r',out=side==='left'?1:-1,up_=b['upperarm_'+s],fore=b['lowerarm_'+s],hand=b['hand_'+s];
   up_.getWorldPosition(c);fore.getWorldPosition(a);const L=c.distanceTo(a)+a.distanceTo(hand.getWorldPosition(to));
   target.copy(c).addScaledVector(up,-.68*L).addScaledVector(forward,.42*L).addScaledVector(left,out*.12*L);reach(side,target,weight);
   const socket=side==='left'?rig.leftHand:rig.rightHand;
   if(kind==='shield'&&side==='left'){rig.leftHand.getWorldQuaternion(pq);a.set(0,0,1).applyQuaternion(pq);turn(b.hand_l,rot.setFromUnitVectors(a,left),weight*.85)}
   // Weapon in hand: the blade (socket +Y) points ahead, a little up and out, never back past the face.
   else if(kind==='weapon'){socket.getWorldQuaternion(pq);a.set(0,1,0).applyQuaternion(pq);to.copy(forward).multiplyScalar(.85).addScaledVector(up,.12).addScaledVector(left,out*.3).normalize();turn(hand,rot.setFromUnitVectors(a,to),weight)}},
  // Torch: left fist below and ahead of the shoulder, elbow bent, the handle (socket +Y)
  // tilted forward and a little outward so the flame burns clear of the face and body.
  torch(weight,run=0,time=0){if(!(weight>0))return;frame();const up_=b.upperarm_l,fore=b.lowerarm_l,hand=b.hand_l;if(!up_||!fore||!hand)return;
   up_.getWorldPosition(c);fore.getWorldPosition(a);const L=c.distanceTo(a)+a.distanceTo(hand.getWorldPosition(to)),bob=Math.sin(time*(run?9:6))*.015*run;
   target.copy(c).addScaledVector(up,(-.56-.08*run+bob)*L).addScaledVector(forward,(.52-.1*run)*L).addScaledVector(left,(.4-.06*run)*L);reach('left',target,weight);
   rig.leftHand.getWorldQuaternion(pq);a.set(0,1,0).applyQuaternion(pq);to.copy(up).addScaledVector(forward,.3-.1*run).addScaledVector(left,.24).normalize();turn(hand,rot.setFromUnitVectors(a,to),weight)},
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
  // Attack motions (attack-motion.js layers): the weapon hand follows STRIKE_KEYS for the phase
  // (0..1 wind-up, 1 = strike frame, 1..2 recovery), the held weapon's +Y turns to the key's
  // blade direction and the spine leans into the blow. Two-handers bring the left hand to the grip.
  strike(layer,phase,weight,{twoHanded=false}={}){const keys=STRIKE_KEYS[layer];
   if(keys){const s=strikeKey(keys,phase);frame();b.upperarm_r.getWorldPosition(c);b.lowerarm_r.getWorldPosition(a);const L=c.distanceTo(a)+a.distanceTo(b.hand_r.getWorldPosition(to));
    for(const bone of [b.spine_02,b.spine_03])if(bone)turn(bone,rot.setFromAxisAngle(left,s.lean*.5),weight);
    if(s.twist)for(const bone of [b.spine_02,b.spine_03])if(bone)turn(bone,rot.setFromAxisAngle(up,s.twist*.5),weight);
    frame();b.upperarm_r.getWorldPosition(c);
    target.copy(c).addScaledVector(forward,s.hand[0]*L).addScaledVector(up,s.hand[1]*L).addScaledVector(left,-s.hand[2]*L);reach('right',target,weight);
    const item=rig.rightHand.children.find(o=>o.userData.weaponMount&&o.visible)||rig.rightHand;item.getWorldQuaternion(pq);a.set(0,1,0).applyQuaternion(pq);
    to.set(0,0,0).addScaledVector(forward,s.blade[0]).addScaledVector(up,s.blade[1]).addScaledVector(left,-s.blade[2]).normalize();turn(b.hand_r,rot.setFromUnitVectors(a,to),weight)}
   // Off hand on the grip, a little below the weapon hand along the haft.
   if(twoHanded||layer==='twoHand'){rig.rightHand.getWorldPosition(target);const item=rig.rightHand.children.find(o=>o.userData.weaponMount&&o.visible);if(item){item.getWorldQuaternion(pq);a.set(0,-1,0).applyQuaternion(pq);target.addScaledVector(a,.2)}reach('left',target,weight*.9)}},
  // Emote pose (emote-motion.js): spine lean and chest twist, then each hand to its goal
  // ([forward, up, out] in arm lengths from that shoulder), or the right hand to the chin.
  emote(pose,weight){frame();const n=[b.spine_01,b.spine_02,b.spine_03].filter(Boolean).length||1;
   if(pose.lean)for(const bone of [b.spine_01,b.spine_02,b.spine_03])if(bone)turn(bone,rot.setFromAxisAngle(left,pose.lean/n),weight);
   if(pose.twist)for(const bone of [b.spine_02,b.spine_03])if(bone)turn(bone,rot.setFromAxisAngle(up,pose.twist/2),weight);
   for(const side of ['right','left']){const h=pose[side];if(!h)continue;const s=side==='left'?'l':'r',sh=b['upperarm_'+s],el=b['lowerarm_'+s],hand=b['hand_'+s];if(!sh||!el||!hand)continue;
    frame();sh.getWorldPosition(c);el.getWorldPosition(a);const L=c.distanceTo(a)+a.distanceTo(hand.getWorldPosition(to));
    target.copy(c).addScaledVector(forward,h[0]*L).addScaledVector(up,h[1]*L).addScaledVector(left,(side==='left'?1:-1)*h[2]*L);reach(side,target,weight)}
   if(pose.chin){frame();(b.Head||b.head).getWorldPosition(target).addScaledVector(forward,.12).addScaledVector(up,-.1).addScaledVector(left,-.02);reach('right',target,weight)}},
  aim(weight,draw){frame();
   // Bow arm: straight out from the left shoulder at shoulder height.
   b.upperarm_l.getWorldPosition(target).addScaledVector(forward,.78).addScaledVector(left,-.06).addScaledVector(up,.04);reach('left',target,weight);
   // Bow upright, limbs toward the target: socket basis (X forward, Y up, Z = X × Y).
   c.crossVectors(forward,up);m.makeBasis(forward,up,c);const want=new T.Quaternion().setFromRotationMatrix(m);rig.leftHand.getWorldQuaternion(pq);turn(b.hand_l,want.multiply(pq.invert()),weight);
   // String hand: from the bow grip back to the cheek.
   b.hand_l.getWorldPosition(target).addScaledVector(forward,-.66*draw).addScaledVector(left,-.05*draw);b.upperarm_r.getWorldPosition(c);target.y=Math.max(target.y,c.y+.06*draw);reach('right',target,weight)}
 };
}

// Attack keyframes for the arm layer: [phase, hand (forward, up, out) in arm lengths from the
// shoulder, blade direction (forward, up, out), spine lean (rad, + = forward), twist (rad)].
// Phase 0 is the guard, 1 the strike frame, 2 the guard again.
const GUARD=[.35,-.6,.15],GUARD_BLADE=[.85,.25,.2];
export const STRIKE_KEYS={
 // Hammer, mace, maul: raised high behind the head, brought straight down in front.
 overhead:[[0,GUARD,GUARD_BLADE,0],[.7,[.02,.82,.12],[-.55,.8,.08],-.14],[1,[.86,-.12,.04],[.72,-.68,0],.24],[1.35,[.8,-.26,.04],[.55,-.83,0],.2],[2,GUARD,GUARD_BLADE,0]],
 // Axe, cleaver, pick: up over the weapon shoulder, then a diagonal chop down across the body.
 chop:[[0,GUARD,GUARD_BLADE,0],[.7,[.05,.72,.55],[-.45,.75,.45],-.1,-.25],[1,[.82,-.18,-.28],[.55,-.62,-.55],.2,.2],[1.35,[.72,-.32,-.3],[.42,-.72,-.55],.16,.15],[2,GUARD,GUARD_BLADE,0]],
 // Dagger, spear: drawn back at the hip, then driven straight out at the target.
 thrust:[[0,GUARD,[.95,.12,.1],0],[.6,[.02,-.32,.22],[1,.06,0],-.06],[1,[.97,-.06,.04],[1,0,-.04],.14],[1.35,[.92,-.1,.04],[1,-.04,0],.1],[2,GUARD,[.95,.12,.1],0]],
 // Staff: lifted, then thrust toward the target as the casting hand throws the bolt.
 staff:[[0,[.25,-.62,.22],[.2,.97,0],0],[.7,[.32,-.08,.22],[.1,.99,0],-.04],[1,[.82,.12,.12],[.62,.75,0],.1],[1.35,[.76,.08,.12],[.55,.8,0],.08],[2,[.25,-.62,.22],[.2,.97,0],0]]
};
export function strikeKey(keys,phase){
 const p=Math.max(0,Math.min(2,Number(phase)||0));let i=0;while(i<keys.length-2&&p>keys[i+1][0])i++;
 const k0=keys[i],k1=keys[i+1],f=Math.max(0,Math.min(1,(p-k0[0])/Math.max(1e-6,k1[0]-k0[0]))),e=f*f*(3-2*f),mix=(x,y)=>x.map((v,j)=>v+(y[j]-v)*e);
 const blade=mix(k0[2],k1[2]),n=Math.hypot(...blade)||1;
 return {hand:mix(k0[1],k1[1]),blade:blade.map(v=>v/n),lean:(k0[3]||0)+((k1[3]||0)-(k0[3]||0))*e,twist:(k0[4]||0)+((k1[4]||0)-(k0[4]||0))*e};
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
