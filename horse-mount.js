import {buildWarhorse} from './horse-model.js?v=release-20261105-characters55';
// Shared local/remote mount model. Hoof contacts and sounds use the same phase.
export function createHorseMount(T,parent,{onHoof=()=>{}}={}){
 const {root,barrel,tail,legs,resources,pose,skins}=buildWarhorse(T,parent);
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
 function update({active=false,distance=0,rig,visual,groundHeight=()=>parent.position.y}={}){
 root.visible=active;if(!active){for(const o of hidden)o.visible=true;hidden=[];if(lastActive&&visual){visual.rotation.x=0;visual.position.y=0;visual.position.z=0;}lastActive=false;return;}
 if(rig)for(const hand of [rig.rightHand,rig.leftHand])for(const o of hand.children)if(o.isGroup&&o.visible){o.visible=false;hidden.push(o)}
 const moving=distance>1e-5,previous=phase;phase+=Math.max(0,Math.min(distance,2))/7.6;const f=phase%1;
 const seat=pose(phase,moving);
 for(const [i,l]of legs.entries())if(moving&&lastActive&&Math.floor(phase-l.offset+1e-9)>Math.floor(previous-l.offset+1e-9))onHoof({index:i,front:l.front,root:parent});
 if(rig&&visual)seatRider(rig,visual,seat);
 lastActive=true;
 }
 return {root,legs,skins,update,get phase(){return phase},dispose(){for(const o of hidden)o.visible=true;root.removeFromParent();for(const r of resources)r.dispose()}};
}
