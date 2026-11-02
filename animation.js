// One distance-driven locomotion controller for every human in Eldervale.
// This module has no renderer or account dependencies and can be regression tested.
export function createHumanoidAnimator(rig){
 let phase=0,blend=0,time=0,impact=0;const restY=new WeakMap();let combatBlend=0,runBlend=0;
 return {update(dt,{distance=0,speed=0,attack=0,hit=0,twoHanded=false,shield=false,armed=false,weapon=null,block=0,locomotion=null}={}){
  if(!Number.isFinite(dt)||dt<=0)return;
  dt=Math.min(dt,.1);time+=dt;
  distance=Number.isFinite(distance)?Math.max(0,distance):0;
  speed=Number.isFinite(speed)?Math.max(0,speed):0;
  // Smooth incoming damage into a short, recoverable full-body reaction.
  const incoming=Number.isFinite(hit)?Math.max(0,Math.min(1,hit)):0;
  impact=Math.max(incoming,impact*Math.exp(-9*dt));
  const moving=distance>1e-6;
  blend+=(moving?1-blend:-blend)*(1-Math.exp(-12*dt));
  const mode=locomotion||(attack>0||block>0?'combat':speed>2.8?'run':'walk');
  const transition=1-Math.exp(-12*dt);
  combatBlend+=((mode==='combat'?1:0)-combatBlend)*transition;
  runBlend+=((mode==='run'&&moving?1:0)-runBlend)*transition;
  const walkBlend=Math.max(0,1-combatBlend-runBlend),run=runBlend,pace=Math.min(1,speed/1.9);
  // Combat keeps the existing short, planted approach. Walking has an extended
  // recovery and low foot lift; running has a flight phase and high recovery.
  const stance=.60*combatBlend+.52*walkBlend+.40*runBlend;
  const strideLength=(1.1+.45*pace)*combatBlend+(1.50+.30*pace)*walkBlend+2.65*runBlend;
  const footLift=.12*combatBlend+.065*walkBlend+.28*runBlend;
  const cycleLength=mode==='combat'?1.1+.45*pace:mode==='run'?2.65:1.50+.30*pace;
  phase+=distance*Math.PI*2/cycleLength;
  const gait=Math.sin(phase),stride=(.24+run*.12)*blend;
  const upper=Math.abs(rig.leftKnee.position.y),lower=rig.leftAnkle?Math.abs(rig.leftAnkle.position.y):.42*(rig.legScale||1.3),length=upper+lower;
  const reach=strideLength*stance/(2*rig.root.scale.z),baseDown=Math.sqrt(Math.max(.1,length*length-reach*reach))-.002;
  const phases=[((phase/(Math.PI*2))%1+1)%1,((phase/(Math.PI*2)+.5)%1+1)%1],contacts=phases.filter(u=>u<stance);
  const plantedReach=contacts.length?Math.max(...contacts.map(u=>Math.abs(reach*(1-2*u/stance)))):reach;
  const extendedDown=Math.sqrt(Math.max(.1,length*length-plantedReach*plantedReach))-.002;
  const down=baseDown*combatBlend+extendedDown*(1-combatBlend),flight=contacts.length===0?runBlend*.055:0;
  for(const [leg,knee,ankle,offset] of [[rig.leftLeg,rig.leftKnee,rig.leftAnkle,0],[rig.rightLeg,rig.rightKnee,rig.rightAnkle,.5]]){
   const u=((phase/(Math.PI*2)+offset)%1+1)%1,swing=u>=stance,t=swing?(u-stance)/(1-stance):u/stance;
   const ease=t*t*(3-2*t),forward=swing?reach*(2*ease-1):reach*(1-2*t),lift=swing?Math.sin(t*Math.PI)*footLift:0;
   const y=down-lift,d=Math.min(length-.00001,Math.hypot(forward,y));
   const bend=Math.acos(Math.max(-1,Math.min(1,(d*d-upper*upper-lower*lower)/(2*upper*lower))));
   const hip=Math.atan2(-forward,y)-Math.atan2(lower*Math.sin(bend),upper+lower*Math.cos(bend));
   leg.rotation.x=hip*blend;knee.rotation.x=bend*blend;
   if(ankle)ankle.rotation.x=-(hip+bend)*blend+(swing?Math.sin(t*Math.PI)*.16*runBlend*blend:0);
  }
  // Visual pelvis compression keeps contact feet at their standing ground height.
  // Physics, saved positions and pathfinding roots are never translated.
  const bob=(down-length+flight)*blend;rig.root.rotation.x=-.10*runBlend*blend;
  for(const child of rig.root.children){if(!restY.has(child))restY.set(child,child.position.y);child.position.y=restY.get(child)+bob}
  for(const limb of [rig.leftArm,rig.rightArm,rig.leftElbow,rig.rightElbow]){limb.rotation.y=0;limb.rotation.z=0}
  rig.leftHand?.quaternion.identity();rig.rightHand?.quaternion.identity();
  const armSwing=(.11*combatBlend+.13*walkBlend+.55*runBlend)*blend;
  rig.leftArm.rotation.x=-gait*armSwing+Math.sin(time*1.7)*.018*(1-blend);
  rig.rightArm.rotation.x=gait*armSwing-Math.sin(time*1.7)*.018*(1-blend);
  const elbow=-.10-.78*runBlend*blend;
  rig.leftElbow.rotation.x=elbow-Math.max(0,gait)*.06*blend;
  rig.rightElbow.rotation.x=elbow-Math.max(0,-gait)*.06*blend;
  // Armed idle: elbows forward, right hand presenting the blade diagonally ahead,
  // left forearm carrying the shield ahead of the torso. Blend out during attack.
  if(armed&&!twoHanded&&attack<=0){
   rig.rightArm.rotation.x=-.24-gait*(.035*combatBlend+.055*walkBlend+.12*runBlend)*blend;
   rig.rightArm.rotation.z=-.10;
   rig.rightElbow.rotation.x=-.22;
   rig.rightHand?.rotation.set(0,0,0);
  }
  // Reset combat channels every frame so interrupted attacks cannot leave a pose stuck.
  if(!armed||twoHanded||attack>0)rig.rightArm.rotation.z=0;
  if(attack>0&&!twoHanded){
   const t=Math.max(0,Math.min(1,1-attack/.55)),s=t*t*(3-2*t),pulse=Math.sin(t*Math.PI);
   if(weapon==='shortsword'||weapon==='dagger'){
    rig.rightArm.rotation.x=-.45-.55*pulse;rig.rightElbow.rotation.x=-.8+.72*pulse;rig.rightHand.rotation.x=1.25*pulse;rig.rightArm.rotation.z=-.12;
   }else if(weapon==='scimitar'){
    rig.rightArm.rotation.x=-.75+pulse*.35;rig.rightArm.rotation.y=-.85+s*1.7;rig.rightArm.rotation.z=-.30-pulse*.20;rig.rightElbow.rotation.x=-.40;rig.rightHand.rotation.z=-.35+s*.65;
   }else{
    rig.rightArm.rotation.x=-1.35+s*1.8;rig.rightArm.rotation.y=.30-s*.60;rig.rightArm.rotation.z=-.30+s*.20;rig.rightElbow.rotation.x=-.45+pulse*.15;
   }
  }
  if(shield&&!twoHanded){rig.leftArm.rotation.x=-.15-gait*.03*blend;rig.leftArm.rotation.z=.10;rig.leftElbow.rotation.x=-.55;rig.leftHand?.rotation.set(0,0,0)}
  if(twoHanded&&rig.solveArm){
   const V=rig.root.position.constructor;
   if(attack>0){
    const t=Math.max(0,Math.min(1,1-attack/.55)),swing=Math.sin(t*Math.PI),angle=swing*1.8,direction=new V(0,Math.cos(angle),Math.sin(angle)),target=new V(0,1.82+swing*.10,.46+swing*.06);
    rig.solveArm('right',target,direction);rig.solveArm('left',target.clone().addScaledVector(direction,.10).add(new V(.018,0,0)),direction);
   }else{
    // Carry the greatsword upright along the right shoulder; the free arm walks naturally.
    rig.solveArm('right',new V(-.68,1.54,.30),new V(-.20,1,-.04).normalize(),new V(0,0,1));
   }
  }
  if(block>0&&attack<=0){
   if(twoHanded&&rig.solveArm){const V=rig.root.position.constructor,direction=new V(-.65,.65,.30).normalize(),target=new V(-.12,1.88,.40);rig.solveArm('right',target,direction);rig.solveArm('left',target.clone().addScaledVector(direction,.10),direction)}
   else if(shield){rig.leftArm.rotation.x=-.90;rig.leftArm.rotation.z=.24;rig.leftElbow.rotation.x=-.85}
   else{rig.rightArm.rotation.x=-.85;rig.rightElbow.rotation.x=-.7;rig.rightHand.rotation.z=-.45}
  }
  if(rig.head){rig.head.rotation.x=-gait*.012*blend-impact*.06;rig.head.rotation.z=Math.sin(time*.7)*.008*(1-blend)}
  if(rig.neck)rig.neck.scale.y=1+Math.sin(time*1.7)*.008*(1-blend);
  // Never translate the whole rig: grounded feet and gameplay root stay stable.
  if(rig.torso){
   rig.torso.scale.y=1+Math.sin(time*1.7)*.004*(1-blend);
   rig.torso.rotation.x=impact*.045;rig.torso.rotation.z=-impact*.025;
  }
  return {blend,run,gait:mode,flight:contacts.length===0&&runBlend>.8,contacts:{left:((phase/(Math.PI*2))%1+1)%1<stance,right:((phase/(Math.PI*2)+.5)%1+1)%1<stance},attack:attack>0,hit:impact>0.01};
 }};
}
