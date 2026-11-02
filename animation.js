// One distance-driven locomotion controller for every human in Eldervale.
// This module has no renderer or account dependencies and can be regression tested.
export function createHumanoidAnimator(rig){
 let phase=0,blend=0,time=0,impact=0;
 return {update(dt,{distance=0,speed=0,attack=0,hit=0,twoHanded=false,shield=false,armed=false}={}){
  if(!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,.1);time+=dt;
  distance=Number.isFinite(distance)?Math.max(0,distance):0;
  speed=Number.isFinite(speed)?Math.max(0,speed):0;
  // Smooth incoming damage into a short, recoverable full-body reaction.
  const incoming=Number.isFinite(hit)?Math.max(0,Math.min(1,hit)):0;
  impact=Math.max(incoming,impact*Math.exp(-9*dt));
  const moving=distance>1e-6;
  blend+=(moving?1-blend:-blend)*(1-Math.exp(-12*dt));
  const run=Math.max(0,Math.min(1,(speed-2)/3));
  // A full cycle spans two steps; cadence scales with distance and stride length.
  phase+=distance*Math.PI*2/(1.7+run*1.4);
  const gait=Math.sin(phase),opposite=-gait;
  const stride=(.40+run*.24)*blend;
  rig.leftLeg.rotation.x=gait*stride;rig.rightLeg.rotation.x=opposite*stride;
  rig.leftKnee.rotation.x=Math.max(0,-gait)*(.62+run*.48)*blend;
  rig.rightKnee.rotation.x=Math.max(0,gait)*(.62+run*.48)*blend;
  for(const limb of [rig.leftArm,rig.rightArm,rig.leftElbow,rig.rightElbow]){limb.rotation.y=0;limb.rotation.z=0}
  rig.leftHand?.quaternion.identity();rig.rightHand?.quaternion.identity();
  rig.leftArm.rotation.x=-gait*stride*.65+Math.sin(time*1.7)*.018*(1-blend);
  rig.rightArm.rotation.x=gait*stride*.65-Math.sin(time*1.7)*.018*(1-blend);
  rig.leftElbow.rotation.x=-.12-run*.35*blend-Math.max(0,gait)*.2*blend;
  rig.rightElbow.rotation.x=-.12-run*.35*blend-Math.max(0,-gait)*.2*blend;
  // Armed idle: elbows forward, right hand presenting the blade diagonally ahead,
  // left forearm carrying the shield ahead of the torso. Blend out during attack.
  if(armed&&!twoHanded&&attack<=0){
   rig.rightArm.rotation.x=-.68-gait*.06*blend;
   rig.rightArm.rotation.z=-.16;
   rig.rightElbow.rotation.x=-.92;
   rig.rightHand?.rotation.set(-.38,0,-.16);
  }
  // Reset combat channels every frame so interrupted attacks cannot leave a pose stuck.
  if(!armed||twoHanded||attack>0)rig.rightArm.rotation.z=0;
  if(attack>0){
   const t=Math.max(0,Math.min(1,1-attack/.55));
   rig.rightArm.rotation.x=-1.6+Math.sin(t*Math.PI)*2.7;
   rig.rightArm.rotation.z=-.32;rig.rightElbow.rotation.x=-.55;
  }
  if(shield&&!twoHanded){rig.leftArm.rotation.x=-.72-gait*.05*blend;rig.leftArm.rotation.z=.20;rig.leftElbow.rotation.x=-.95;rig.leftHand?.rotation.set(-.20,-.18,.08)}
  if(twoHanded&&rig.solveArm){
   const t=attack>0?Math.max(0,Math.min(1,1-attack/.55)):0,swing=attack>0?Math.sin(t*Math.PI):0;
   const V=rig.root.position.constructor,angle=swing*1.8,direction=new V(0,Math.cos(angle),Math.sin(angle));
   const target=new V(0,1.62+swing*.14,.25+swing*.08);
   rig.solveArm('right',target,direction);rig.solveArm('left',target.clone().addScaledVector(direction,.10).add(new V(.018,0,0)),direction);
  }
  if(rig.head){rig.head.rotation.x=-gait*.012*blend-impact*.06;rig.head.rotation.z=Math.sin(time*.7)*.008*(1-blend)}
  if(rig.neck)rig.neck.scale.y=1+Math.sin(time*1.7)*.008*(1-blend);
  // Never translate the whole rig: grounded feet and gameplay root stay stable.
  if(rig.torso){
   rig.torso.scale.y=1+Math.sin(time*1.7)*.004*(1-blend);
   rig.torso.rotation.x=impact*.045;rig.torso.rotation.z=-impact*.025;
  }
  return {blend,run,attack:attack>0,hit:impact>0.01};
 }};
}
