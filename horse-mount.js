import {buildWarhorse} from './horse-model.js?v=release-20261104-rider36';
// Shared local/remote mount model. Hoof contacts and sounds use the same phase.
export function createHorseMount(T,parent,{onHoof=()=>{}}={}){
 const {root,barrel,tail,legs,resources,pose,skins}=buildWarhorse(T,parent);
 let phase=0,lastActive=false,hidden=[],riderRig=null,riderLegRest=null;
 function releaseRider(){
  if(riderRig&&riderLegRest)for(const [i,leg]of [riderRig.leftLeg,riderRig.rightLeg].entries()){const rest=riderLegRest[i];leg.position.x=rest.x;leg.rotation.y=rest.yaw;leg.rotation.z=rest.roll;}
  riderRig=null;riderLegRest=null;
 }
 function update({active=false,distance=0,rig,visual,groundHeight=()=>parent.position.y}={}){
 root.visible=active;if(!active){releaseRider();for(const o of hidden)o.visible=true;hidden=[];if(lastActive&&visual){visual.rotation.x=0;visual.position.z=0;}lastActive=false;return;}
 if(rig)for(const hand of [rig.rightHand,rig.leftHand])for(const o of hand.children)if(o.isGroup&&o.visible){o.visible=false;hidden.push(o)}
 const moving=distance>1e-5,previous=phase;phase+=Math.max(0,Math.min(distance,2))/5.2;const f=phase%1;
 const seat=pose(phase,moving);
 for(const [i,l]of legs.entries())if(moving&&lastActive&&Math.floor(phase-l.offset+1e-9)>Math.floor(previous-l.offset+1e-9))onHoof({index:i,front:l.front,root:parent});
 if(rig&&visual){if(riderRig!==rig){releaseRider();riderRig=rig;riderLegRest=[rig.leftLeg,rig.rightLeg].map(leg=>({x:leg.position.x,yaw:leg.rotation.y,roll:leg.rotation.z}));}const leftSide=Math.sign(riderLegRest[0].x)||1,rightSide=Math.sign(riderLegRest[1].x)||-1;rig.leftLeg.position.x=leftSide*.36;rig.rightLeg.position.x=rightSide*.36;visual.position.y=2.23-Math.min(rig.leftLeg.position.y,rig.rightLeg.position.y)+.18+seat[0]*1.2;visual.position.z=seat[1]*1.2;visual.rotation.x=.035;rig.leftLeg.rotation.set(-.78,0,leftSide*.30);rig.rightLeg.rotation.set(-.78,0,rightSide*.30);rig.leftKnee.rotation.x=1.40;rig.rightKnee.rotation.x=1.40;rig.leftAnkle.rotation.x=-.62;rig.rightAnkle.rotation.x=-.62;rig.leftArm.rotation.x=-.55;rig.rightArm.rotation.x=-.55;rig.leftElbow.rotation.x=-.85;rig.rightElbow.rotation.x=-.85;rig.leftHand.rotation.set(0,0,0);rig.rightHand.rotation.set(0,0,0);}
 lastActive=true;
 }
 return {root,legs,skins,update,get phase(){return phase},dispose(){releaseRider();for(const o of hidden)o.visible=true;root.removeFromParent();for(const r of resources)r.dispose()}};
}
