import {loftGeometry,fabricMaterial} from './anatomy.js?v=release-20261102-grip1';
// Eldervale's shared low-poly human rig. The same geometry powers players,
// NPCs, remote adventurers and the live character-creation preview.
// Rig pivots are preserved for existing movement, equipment and combat animations.
export function buildHumanoid(T,root,look={}){
 const parse=(v,f)=>typeof v==='number'?v:/^#[0-9a-f]{6}$/i.test(v||'')?parseInt(v.slice(1),16):f;
 const skin=parse(look.skin,0xc9916b),shirt=parse(look.shirt,0x426e68),pants=parse(look.pants,0x353b3e),hairColor=parse(look.hairColor,0x392820);
 const caches=buildHumanoid.caches||(buildHumanoid.caches=new WeakMap());
 let cache=caches.get(T);if(!cache){cache=new Map();caches.set(T,cache)}
 function mat(color,rough=.85){const k='mat'+color+':'+rough;if(!cache.has(k))cache.set(k,new T.MeshStandardMaterial({color,roughness:rough,flatShading:false}));return cache.get(k)}
 function geo(key,make){if(!cache.has(key))cache.set(key,make());return cache.get(key)}
 const faceMat=mat(skin),cloth=fabricMaterial(T,shirt,cache),trousers=fabricMaterial(T,pants,cache),hairMat=mat(hairColor),boots=mat(0x272523),beltMat=mat(0x57362a);
 function mesh(g,m,parent,x,y,z,sx=1,sy=1,sz=1){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o}
 const sphere=geo('humanSphere',()=>new T.SphereGeometry(1,12,8));
 const box=(w,h,d)=>geo('humanBox'+w+':'+h+':'+d,()=>new T.BoxGeometry(w,h,d));
 // Tailored torso: broad shoulders, natural taper to the waist, curved chest/back.
 const torsoShape=geo('humanTailoredTorso',()=>new T.LatheGeometry([
  new T.Vector2(.255,0),new T.Vector2(.30,.09),new T.Vector2(.325,.25),
  new T.Vector2(.355,.48),new T.Vector2(.395,.66),new T.Vector2(.385,.81),
  new T.Vector2(.285,.88)
 ],14));
 const torso=mesh(torsoShape,cloth,root,0,1.08,0,1,1,.77);
 // Collar and belt avoid the separated "floating toy" silhouette.
 mesh(geo('humanCollar',()=>new T.CylinderGeometry(.14,.16,.045,12)),cloth,root,0,1.965,0,1,1,.80);
 mesh(geo('humanBelt',()=>new T.CylinderGeometry(.312,.295,.11,14)),beltMat,root,0,1.075,0,1,1,.82);
 mesh(box(.115,.10,.035),mat(0xb8a075,.6),root,0,1.075,.253);
 // Pelvis fills the gap between the torso and two distinct articulated legs.
 mesh(geo('humanTailoredHipsV2',()=>loftGeometry(T,[[-.16,.22,.18],[-.06,.31,.235],[.06,.305,.23],[.15,.27,.20]])),trousers,root,0,.985,0);
 // Subtle stitched tunic seams and a leather strap break up the uniform torso
 // without requiring large textures or additional draw-heavy assets.
 const seamMat=mat(0x263c39),threadMat=mat(0x8f8064),metalMat=mat(0xb8a075,.6);
 for(const side of [-1,1]){
  const seam=mesh(geo('humanTunicSeamV1',()=>new T.CylinderGeometry(.008,.008,.46,5)),seamMat,root,side*.29,1.68,.155);
  seam.rotation.z=side*.20;
  for(let i=0;i<3;i++)mesh(box(.043,.012,.013),threadMat,root,side*(.265+i*.012),1.51+i*.12,.167);
 }
 const strap=mesh(box(.075,.81,.035),beltMat,root,-.08,1.55,.285);
 strap.rotation.z=-.34;
 mesh(box(.083,.077,.040),metalMat,root,.07,1.22,.289);
 const neck=mesh(geo('humanNeckV2',()=>new T.CylinderGeometry(.098,.12,.13,12)),faceMat,root,0,2.01,0);
 const head=new T.Group();head.name='character-head';root.add(head);
 // Sculpted low-poly head with independently controlled jaw, cheekbone and cranium widths.
 // An elliptical ring mesh avoids the cylindrical/ball-headed appearance.
 const faceStyle=['Balanced','Angular','Broad'].includes(look.face)?look.face:'Balanced';
 const headShape=geo('humanHeadV5'+faceStyle,()=>{
  const rings=[
   [0,.095,.112,.018],[.025,.130,.132,.016],[.07,.180,.162,.010],
   [.13,.205,.185,.006],[.20,.228,.208,.002],[.26,.246,.223,-.002],
   [.315,.249,.228,-.007],[.365,.244,.229,-.007],[.40,.247,.238,-.010],
   [.47,.245,.237,-.013],[.53,.224,.218,-.016],[.59,.170,.180,-.020],[.64,.080,.090,-.025]
  ];
  const positions=[],indices=[],sides=20;
  for(const [y,rx,rz,off] of rings)for(let j=0;j<sides;j++){
   const a=j/sides*Math.PI*2;
   const front=Math.sin(a),x=Math.cos(a)*rx*(faceStyle==='Broad'?1.08:faceStyle==='Angular'&&y<.22?.88:1);
   let z=(front>0?Math.pow(front,.68):front)*rz+off;
   if(front>.4){
    const eyeSocket=(Math.exp(-Math.pow((x-.108)/.055,2))+Math.exp(-Math.pow((x+.108)/.055,2)))*Math.exp(-Math.pow((y-.365)/.042,2));
    const cheekbone=Math.exp(-Math.pow((Math.abs(x)-.16)/.065,2)-Math.pow((y-.27)/.055,2));
    const mouthPlane=Math.exp(-Math.pow(x/.09,2)-Math.pow((y-.20)/.045,2));
    z-=eyeSocket*.024;z+=cheekbone*.011+mouthPlane*.008;
   }
   positions.push(x,y,z);
  }
  for(let k=0;k<rings.length-1;k++)for(let j=0;j<sides;j++){
   const a=k*sides+j,b=k*sides+(j+1)%sides,d=(k+1)*sides+j,e=(k+1)*sides+(j+1)%sides;
   indices.push(a,d,b,b,d,e);
  }
  const bottom=positions.length/3;positions.push(0,0,.018);const top=positions.length/3;positions.push(0,.665,-.025);
  for(let j=0;j<sides;j++){indices.push(j,(j+1)%sides,bottom);const last=(rings.length-1)*sides;indices.push(last+j,top,last+(j+1)%sides)}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
 });
 const face=mesh(headShape,faceMat,head,0,2.10,.015);
 // Inset almond eyes, narrow eyelids and tapered eyebrows follow the sculpted sockets.
 const eyeShape=geo('humanAlmondEye',()=>{const shape=new T.Shape();shape.moveTo(-.038,0);shape.quadraticCurveTo(-.004,.014,.038,0);shape.quadraticCurveTo(.004,-.010,-.038,0);return new T.ShapeGeometry(shape,8)});
 const browShape=geo('humanTaperedBrow',()=>{const s=new T.Shape();s.moveTo(-.052,-.006);s.lineTo(-.035,.007);s.lineTo(.020,.006);s.lineTo(.052,-.004);s.lineTo(.036,-.008);s.lineTo(-.035,-.004);s.closePath();return new T.ExtrudeGeometry(s,{depth:.004,bevelEnabled:false})});
 for(const side of [-1,1]){
  const lid=mesh(eyeShape,mat(0x775443),head,side*.108,2.465,.233,1.10,1.20,1);lid.rotation.z=side*.045;
  const sclera=mesh(eyeShape,mat(0xbeb8a6),head,side*.108,2.465,.237,.92,.76,1);sclera.rotation.z=side*.045;
  mesh(geo('humanIris',()=>new T.CircleGeometry(.011,14)),mat(0x59634f),head,side*.108,2.465,.239,1,.94,1);
  mesh(geo('humanPupil',()=>new T.CircleGeometry(.004,12)),mat(0x20251f),head,side*.108,2.465,.240);
  mesh(geo('humanEyeGlint',()=>new T.CircleGeometry(.0017,6)),mat(0xd9d9c6),head,side*.108-.003,2.469,.241);
  const brow=mesh(browShape,hairMat,head,side*.108,2.505,.234);brow.rotation.z=-side*.07;
 }
 const noseGeometry=geo('humanNasalBridge',()=>{
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([-.028,2.485,.223,.028,2.485,.223,-.043,2.365,.229,.043,2.365,.229,0,2.405,.307,-.023,2.355,.264,.023,2.355,.264],3));
  g.setIndex([0,2,4,0,4,1,1,4,3,2,5,4,3,4,6,5,6,4,2,3,6,2,6,5]);g.computeVertexNormals();return g;
 });
 mesh(noseGeometry,faceMat,head,0,0,0);
 const upperLip=mesh(sphere,mat(0x936f5c),head,0,2.300,.244,.064,.010,.009);upperLip.name='upper-lip';
 const lowerLip=mesh(sphere,faceMat,head,0,2.285,.242,.059,.009,.010);lowerLip.name='lower-lip';
 for(const side of [-1,1]){const ear=mesh(sphere,faceMat,head,side*.256,2.405,-.012,.035,.082,.047);ear.rotation.z=side*.13}
 // Close-fitted hairstyle volumes and swept strands are attached to the skull.
 const style=look.hair||'Side swept';
 const hairCap=mesh(geo('humanHairCapV3',()=>new T.SphereGeometry(1,14,9,0,Math.PI*2,0,Math.PI*.56)),hairMat,head,0,2.679,-.015,.244,style==='Buzz cut'?.075:.125,.220);
 // Tapered, overlapping locks replace rectangular hair blocks. Shared geometry
 // keeps the extra silhouette detail inexpensive for crowds and mobile devices.
 const lock=geo('humanTaperedHairLockV1',()=>new T.ConeGeometry(.045,.22,5));
 if(style==='Side swept'){
  for(let i=0;i<7;i++){
   const strand=mesh(lock,hairMat,head,-.19+i*.062,2.675-i*.006,.154-i*.004,1,1,.78);
   strand.rotation.z=-.35-i*.055;strand.rotation.x=.18;
  }
 }else if(style==='Short crop'){
  for(let i=-3;i<=3;i++){
   const strand=mesh(lock,hairMat,head,i*.058,2.695,.135,1,.43,.75);
   strand.rotation.z=-.12;
  }
 }else if(style==='Spiky'){
  for(let i=-3;i<=3;i++){
   const tuft=mesh(lock,hairMat,head,i*.065,2.745,-.015,1,.67,1);
   tuft.rotation.z=-i*.14;
  }
 }else if(style==='Long'){
  for(const side of [-1,1]){
   for(let i=0;i<5;i++){
    const strand=mesh(lock,hairMat,head,side*(.17+i*.018),2.42,-.13+i*.045,1,2.35,.95);
    strand.rotation.z=side*.10;
   }
  }
  for(let i=-3;i<=3;i++)mesh(lock,hairMat,head,i*.058,2.45,-.22,1,2.25,1);
 }
 // Facial hair follows the jaw and leaves the mouth and nasal bridge visible.
 if(look.beard==='Stubble'||look.beard==='Short beard'){
  const long=look.beard==='Short beard';
  // A close jaw-following beard silhouette avoids the oversized spherical muzzle.
  const beardGeo=geo('humanBeardJawV2',()=>new T.LatheGeometry([
   new T.Vector2(.065,0),new T.Vector2(.110,.035),new T.Vector2(.152,.080),
   new T.Vector2(.168,.125),new T.Vector2(.142,.174)
  ],12));
  const beard=mesh(beardGeo,hairMat,head,0,2.155,.065,1,long?1.1:.77,.91);
  for(const side of [-1,1]){const sideburn=mesh(sphere,hairMat,head,side*.193,2.300,.07,.029,.125,.085);sideburn.rotation.z=side*.15}

 }
 // Reduce the oversized prototype head while keeping its neck attachment fixed.
 head.children.forEach(o=>{o.position.y-=2.10});
 head.position.y=2.32;head.scale.set(.64,.55,.65);
 // Dedicated attachment anchors prevent weapons and shields from floating or
 // swapping hands as shoulder and elbow joints animate.
 const leftArm=new T.Group(),rightArm=new T.Group(),leftLeg=new T.Group(),rightLeg=new T.Group();
 // Facing +Z, the anatomical right is -X when viewed from the front.
 // From the chase camera behind the character, the right-hand weapon appears on screen-left.
 // This matches the requested reference and avoids swapping hands by screen position.
 // Previously these anchors were swapped, making right-hand weapons appear left-handed.
 leftArm.position.set(.455,1.84,0);rightArm.position.set(-.455,1.84,0);
 leftLeg.position.set(-.165,.985,0);rightLeg.position.set(.165,.985,0);
 root.add(leftArm,rightArm,leftLeg,rightLeg);
 const leftElbow=new T.Group(),rightElbow=new T.Group(),leftKnee=new T.Group(),rightKnee=new T.Group();
 for(const [arm,side,elbow] of [[leftArm,1,leftElbow],[rightArm,-1,rightElbow]]){
  mesh(geo('tailoredSleeveV2',()=>loftGeometry(T,[[-.445,.100,.095],[-.34,.117,.105],[-.20,.139,.122],[-.09,.151,.132],[-.015,.166,.142],[.055,.140,.12],[.105,.065,.065]])),cloth,arm,0,0,0);
  elbow.position.set(side*.018,-.46,0);arm.add(elbow);
  mesh(sphere,faceMat,elbow,0,0,0,.11,.12,.115);
  mesh(geo('humanForearmV2',()=>loftGeometry(T,[[-.295,.068,.061],[-.22,.081,.072],[-.13,.105,.085],[-.055,.109,.093],[.015,.094,.089]])),faceMat,elbow,side*.006,0,0);
  // A palm, four curled fingers and an opposed thumb replace the spherical fist.
  mesh(sphere,faceMat,elbow,side*.012,-.31,.015,.070,.090,.055);
  for(let finger=0;finger<4;finger++)mesh(sphere,faceMat,elbow,side*.012+(finger-1.5)*.027,-.385,.028,.017,.047,.027);
  const thumb=mesh(sphere,faceMat,elbow,-side*.061,-.325,.047,.025,.060,.026);thumb.rotation.z=-side*.4;
 }
 for(const [leg,side,knee] of [[leftLeg,-1,leftKnee],[rightLeg,1,rightKnee]]){
  mesh(geo('humanThighV2',()=>loftGeometry(T,[[-.49,.113,.116],[-.37,.137,.131],[-.20,.169,.154],[-.06,.179,.160],[.015,.155,.144]])),trousers,leg,side*.012,0,0);
  knee.position.set(side*.016,-.49,0);leg.add(knee);
  mesh(sphere,trousers,knee,0,0,0,.135,.12,.14);
  mesh(geo('humanCalfV2',()=>loftGeometry(T,[[-.36,.079,.083],[-.26,.093,.103,0,-.018],[-.15,.128,.123,0,-.017],[-.055,.123,.112],[.025,.113,.108]])),trousers,knee,side*.005,0,-.005);
  mesh(geo('humanBootCuff',()=>new T.CylinderGeometry(.13,.13,.09,12)),beltMat,knee,side*.01,-.35,.005);
  mesh(geo('humanLeatherBootV2',()=>loftGeometry(T,[[-.07,.126,.22,0,.10],[-.025,.138,.23,0,.10],[.035,.128,.205,0,.075],[.10,.096,.115,0,-.015]])),boots,knee,side*.01,-.42,.015);
  mesh(box(.26,.04,.43),boots,knee,side*.01,-.465,.115);
 }
 // Attachment points follow the wrist joints, not the upper-arm pivots.
 const leftHand=new T.Group(),rightHand=new T.Group();
 // Mirror wrist anchors with the corrected anatomical arm labels.
 leftHand.position.set(.012,-.33,.015);rightHand.position.set(-.012,-.33,.015);
 leftElbow.add(leftHand);rightElbow.add(rightHand);
 // Adult silhouette: longer articulated legs, lifted pelvis/torso and a seven-head stature.
 const upperOffset=.295,legScale=1.3;
 for(const child of root.children)if(child!==head&&child!==leftLeg&&child!==rightLeg)child.position.y+=upperOffset;
 for(const [leg,knee] of [[leftLeg,leftKnee],[rightLeg,rightKnee]]){
  leg.position.y+=upperOffset;
  for(const child of leg.children){child.position.y*=legScale;if(child.isMesh)child.scale.y*=legScale}
  for(const child of knee.children){child.position.y*=legScale;child.scale.y*=legScale}
 }
 root.scale.set(.78,1,.86);
 // Two-bone arm IK keeps both palms on a two-handed grip rather than near it.
 function solveArm(side,target,weaponUp=new T.Vector3(0,1,0)){
  const arm=side==='left'?leftArm:rightArm,elbow=side==='left'?leftElbow:rightElbow,hand=side==='left'?leftHand:rightHand;
  const upper=elbow.position.clone(),lower=hand.position.clone(),l1=upper.length(),l2=lower.length(),toward=target.clone().sub(arm.position),distance=Math.min(l1+l2-.001,Math.max(.02,toward.length()));
  const direction=toward.normalize(),pole=new T.Vector3(side==='left'?.7:-.7,-.1,-.4);pole.addScaledVector(direction,-pole.dot(direction)).normalize();
  const along=(l1*l1-l2*l2+distance*distance)/(2*distance),bend=Math.sqrt(Math.max(0,l1*l1-along*along));
  const elbowDelta=direction.clone().multiplyScalar(along).addScaledVector(pole,bend);
  arm.quaternion.setFromUnitVectors(upper.clone().normalize(),elbowDelta.clone().normalize());
  const lowerDirection=direction.clone().multiplyScalar(distance).sub(elbowDelta).applyQuaternion(arm.quaternion.clone().invert()).normalize();
  elbow.quaternion.setFromUnitVectors(lower.clone().normalize(),lowerDirection);
  const parentRotation=arm.quaternion.clone().multiply(elbow.quaternion);hand.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),weaponUp.clone().applyQuaternion(parentRotation.invert()).normalize());
 }
 // Anatomical rig contracts used by armor and equipment.
 return {solveArm,upperOffset,legScale,root,body:root,leftArm,rightArm,leftLeg,rightLeg,leftElbow,rightElbow,leftKnee,rightKnee,leftHand,rightHand,torso,neck,face,head,hairMeshes:head.children.filter(o=>o.material===hairMat)};
}
