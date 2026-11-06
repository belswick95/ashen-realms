import {buildWarhorse} from './horse-model.js?v=release-20261106-perf90';
// Shared local/remote mount model. Hoof contacts and sounds use the same phase.
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
  const pelvis=b.pelvis.getWorldPosition(new T.Vector3());
  for(const [s,sign] of [['l',1],['r',-1]]){goal.copy(pelvis).addScaledVector(fwd,.5).addScaledVector(up,.42).addScaledVector(side,sign*.13);reach(rig,s,goal)}
  rig.leftHand.getWorldPosition(lh);rig.rightHand.getWorldPosition(rh);setReins(lh,rh);
 }
 function update({active=false,distance=0,rig,visual,groundHeight=()=>parent.position.y}={}){
 root.visible=active;if(!active){for(const o of hidden)o.visible=true;hidden=[];if(lastActive&&visual){visual.rotation.x=0;visual.position.y=0;visual.position.z=0;}lastActive=false;return;}
 if(rig)for(const hand of [rig.rightHand,rig.leftHand])for(const o of hand.children)if(o.isGroup&&o.visible){o.visible=false;hidden.push(o)}
 const moving=distance>1e-5,previous=phase;phase+=Math.max(0,Math.min(distance,2))/7.6;const f=phase%1;
 const seat=pose(phase,moving);
 for(const [i,l]of legs.entries())if(moving&&lastActive&&Math.floor(phase-l.offset+1e-9)>Math.floor(previous-l.offset+1e-9))onHoof({index:i,front:l.front,root:parent});
 if(rig&&visual){seatRider(rig,visual,seat);holdReins(rig,visual)}
 lastActive=true;
 }
 return {root,legs,skins,update,get phase(){return phase},dispose(){for(const o of hidden)o.visible=true;root.removeFromParent();for(const r of resources)r.dispose()}};
}
