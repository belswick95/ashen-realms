import {buildWarhorse} from './horse-model.js?v=release-20261107-console154';
// Shared local/remote mount model. Hoof contacts and sounds use the same phase.
// The baked gallop covers GALLOP_STRIDE units per cycle at full reach; it is at
// full reach from GALLOP_PACE units/s (a mounted tile walk is 7.9 straight).
export const GALLOP_STRIDE=7.6,GALLOP_PACE=7;
const GAIT_MIN_PACE=.5,GAIT_MIN_REACH=.3,GAIT_SMOOTHING=.15;
// Riding puts away everything held, except a torch in the off hand (shield slot,
// torch.js): it stays lit, raised high in the left fist, and the right fist takes
// both reins. Real shields and every other held item are hidden while mounted.
export const keptWhileMounted=item=>!!item?.userData?.torch;
export const heldTorch=hand=>hand?.children.find(o=>keptWhileMounted(o)&&o.visible)||null;
export function createHorseMount(T,parent,{onHoof=()=>{}}={}){
 const {root,barrel,tail,legs,resources,pose,skins,setReins}=buildWarhorse(T,parent);
 let phase=0,lastActive=false,hidden=[];
 // Clip-driven riders: the riding clip poses the body; this seats the hips on
 // the saddle and opens the thighs around the barrel. Runs after the animator.
 const SADDLE_HIP=2.41,SPREAD=.42,q=new T.Quaternion(),v=new T.Vector3(),wq=new T.Quaternion();
 function seatRider(rig,visual,seat){
  visual.position.set(0,0,seat[1]*1.2);visual.rotation.x=.035;visual.updateMatrixWorld(true);
  const pelvis=rig.bones.pelvis,parentY=visual.parent.getWorldPosition(v).y;
  visual.position.y=SADDLE_HIP+seat[0]*1.2-(pelvis.getWorldPosition(v).y-parentY);
  // Rotate each thigh outward about the rider's forward axis, in pelvis space.
  visual.getWorldQuaternion(wq);const forward=new T.Vector3(0,0,1).applyQuaternion(wq);pelvis.getWorldQuaternion(q);forward.applyQuaternion(q.invert());
  for(const [bone,sign] of [[rig.bones.thigh_l,1],[rig.bones.thigh_r,-1]])bone.quaternion.premultiply(new T.Quaternion().setFromAxisAngle(forward,sign*SPREAD));
 }
 // Rein hands: both fists low in front of the rider's belly, a hand-width
 // either side of the horse's neck line, then the reins run to the fists.
 const a=new T.Vector3(),c=new T.Vector3(),to=new T.Vector3(),goal=new T.Vector3(),fwd=new T.Vector3(),up=new T.Vector3(),side=new T.Vector3(),rq=new T.Quaternion(),pq=new T.Quaternion(),bq=new T.Quaternion(),lh=new T.Vector3(),rh=new T.Vector3();
 function turn(bone,rotation){bone.getWorldQuaternion(bq);bone.parent.getWorldQuaternion(pq);bone.quaternion.copy(pq.invert().multiply(rotation).multiply(bq));bone.updateMatrixWorld(true)}
 function reach(rig,s,target){const hand=rig.bones['hand_'+s];for(let pass=0;pass<5;pass++)for(const bone of [rig.bones['lowerarm_'+s],rig.bones['upperarm_'+s]]){bone.getWorldPosition(c);hand.getWorldPosition(a).sub(c);to.copy(target).sub(c);if(a.lengthSq()<1e-8||to.lengthSq()<1e-8)continue;turn(bone,rq.setFromUnitVectors(a.normalize(),to.normalize()))}}
 function holdReins(rig,visual){
  const b=rig.bones;if(!b.hand_l||!b.hand_r||!b.pelvis)return;visual.updateMatrixWorld(true);parent.getWorldQuaternion(pq);fwd.set(0,0,1).applyQuaternion(pq);up.set(0,1,0).applyQuaternion(pq);side.set(1,0,0).applyQuaternion(pq);
  const pelvis=b.pelvis.getWorldPosition(new T.Vector3()),torch=heldTorch(rig.leftHand);
  if(torch){
   // One-handed reins: the right fist on the neck line, both reins run to it.
   goal.copy(pelvis).addScaledVector(fwd,.5).addScaledVector(up,.44).addScaledVector(side,-.03);reach(rig,'r',goal);
   // Torch arm raised: the left fist up beside the head, a little out and ahead,
   // the handle (socket +Y) upright and tilted outward so the flame clears the rider.
   const shoulder=b.upperarm_l.getWorldPosition(new T.Vector3());
   goal.copy(shoulder).addScaledVector(up,.42).addScaledVector(side,.2).addScaledVector(fwd,.12);reach(rig,'l',goal);
   rig.leftHand.getWorldQuaternion(pq);a.set(0,1,0).applyQuaternion(pq);to.copy(up).addScaledVector(side,.2).addScaledVector(fwd,.08).normalize();turn(b.hand_l,rq.setFromUnitVectors(a,to));
   rig.rightHand.getWorldPosition(rh);lh.copy(rh).addScaledVector(side,.035);setReins(lh,rh);return}
  for(const [s,sign] of [['l',1],['r',-1]]){goal.copy(pelvis).addScaledVector(fwd,.5).addScaledVector(up,.42).addScaledVector(side,sign*.13);reach(rig,s,goal)}
  rig.leftHand.getWorldPosition(lh);rig.rightHand.getWorldPosition(rh);setReins(lh,rh);
 }
 // Gait from the real ground speed (`dt` given): a smoothed pace, so a stray
 // reconcile nudge never flicks the legs into a gallop, and a stride that
 // shortens with the pace (shorter reach, same hoof plant) instead of playing
 // the gallop in slow motion. Without `dt` the full gallop runs per distance.
 let pace=0,stride=0;
 function update({active=false,distance=0,dt=0,rig,visual,groundHeight=()=>parent.position.y}={}){
 root.visible=active;if(!active){for(const o of hidden)o.visible=true;hidden=[];if(lastActive&&visual){visual.rotation.x=0;visual.position.y=0;visual.position.z=0;}lastActive=false;pace=stride=0;return;}
 if(rig)for(const hand of [rig.rightHand,rig.leftHand])for(const o of hand.children)if(o.isGroup&&o.visible&&!(hand===rig.leftHand&&keptWhileMounted(o))){o.visible=false;hidden.push(o)}
 const step=Math.max(0,Math.min(distance,2));let moving,amount;
 if(dt>0){pace+=(step/dt-pace)*(1-Math.exp(-dt/GAIT_SMOOTHING));moving=pace>GAIT_MIN_PACE;const target=moving?Math.max(GAIT_MIN_REACH,Math.min(1,pace/GALLOP_PACE)):0;stride+=(target-stride)*(1-Math.exp(-dt/GAIT_SMOOTHING));amount=stride<.02?0:stride}
 else{moving=distance>1e-5;amount=moving?1:0;stride=amount}
 const previous=phase;if(amount>0)phase+=step/(GALLOP_STRIDE*Math.max(GAIT_MIN_REACH,amount));
 const seat=pose(phase,amount);
 for(const [i,l]of legs.entries())if(moving&&lastActive&&Math.floor(phase-l.offset+1e-9)>Math.floor(previous-l.offset+1e-9))onHoof({index:i,front:l.front,root:parent});
 if(rig&&visual){seatRider(rig,visual,seat);holdReins(rig,visual)}
 lastActive=true;
 }
 return {root,legs,skins,update,get phase(){return phase},dispose(){for(const o of hidden)o.visible=true;root.removeFromParent();for(const r of resources)r.dispose()}};
}
