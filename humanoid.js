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
 const faceMat=mat(skin),cloth=mat(shirt),trousers=mat(pants),hairMat=mat(hairColor),boots=mat(0x272523),beltMat=mat(0x57362a);
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
 mesh(geo('humanCollar',()=>new T.CylinderGeometry(.16,.18,.085,12)),mat(0x4e4035),root,0,1.965,0,1,1,.80);
 mesh(geo('humanBelt',()=>new T.CylinderGeometry(.312,.295,.11,14)),beltMat,root,0,1.075,0,1,1,.82);
 mesh(box(.115,.10,.035),mat(0xb8a075,.6),root,0,1.075,.253);
 // Pelvis fills the gap between the torso and two distinct articulated legs.
 mesh(sphere,trousers,root,0,.985,0,.30,.21,.235);
 const neck=mesh(geo('humanNeck',()=>new T.CylinderGeometry(.108,.125,.20,12)),faceMat,root,0,2.02,0);
 const head=new T.Group();root.add(head);
 // Sculpted low-poly head with independently controlled jaw, cheekbone and cranium widths.
 // An elliptical ring mesh avoids the cylindrical/ball-headed appearance.
 const headShape=geo('humanHeadV3',()=>{
  const rings=[
   [0,.095,.105,.010],[.045,.155,.145,.006],[.12,.208,.195,.005],
   [.20,.240,.220,0],[.31,.258,.234,-.006],[.42,.255,.238,-.010],
   [.53,.237,.221,-.016],[.60,.185,.188,-.019],[.65,.09,.10,-.025]
  ];
  const positions=[],indices=[],sides=12;
  for(const [y,rx,rz,off] of rings)for(let j=0;j<sides;j++){
   const a=j/sides*Math.PI*2;
   positions.push(Math.cos(a)*rx,y,Math.sin(a)*rz+off);
  }
  for(let k=0;k<rings.length-1;k++)for(let j=0;j<sides;j++){
   const a=k*sides+j,b=k*sides+(j+1)%sides,d=(k+1)*sides+j,e=(k+1)*sides+(j+1)%sides;
   indices.push(a,d,b,b,d,e);
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();return g;
 });
 const face=mesh(headShape,faceMat,head,0,2.10,.015);
 // Subtle cheeks and cheekbone planes produce a face rather than a featureless sphere.
 for(const side of [-1,1]){
  // Recessed eyes and angled eyebrows, avoiding large cartoon eyeballs.
  mesh(sphere,mat(0x392f2a),head,side*.108,2.515,.232,.038,.019,.012);
  mesh(sphere,mat(0xb8b4a2),head,side*.108,2.515,.240,.021,.010,.005);
  mesh(sphere,mat(0x4b5b50),head,side*.108,2.515,.246,.010,.011,.004);
  mesh(sphere,mat(0x181c1b),head,side*.108,2.515,.249,.004,.008,.002);
  const brow=mesh(box(.095,.014,.022),hairMat,head,side*.108,2.550,.235);brow.rotation.z=-side*.10;
 }
 const nose=mesh(geo('humanNoseV3',()=>new T.ConeGeometry(.054,.15,5)),faceMat,head,0,2.433,.258,.8,1,.9);
 nose.rotation.x=Math.PI/2;
 mesh(box(.085,.014,.014),mat(0x855d51),head,0,2.345,.221);
 for(const side of [-1,1]){const ear=mesh(sphere,faceMat,head,side*.256,2.405,-.012,.047,.104,.064);ear.rotation.z=side*.13}
 // Close-fitted hairstyle volumes and swept strands are attached to the skull.
 const style=look.hair||'Side swept';
 const hairCap=mesh(geo('humanHairCapV3',()=>new T.SphereGeometry(1,14,9,0,Math.PI*2,0,Math.PI*.56)),hairMat,head,0,2.679,-.015,.244,style==='Buzz cut'?.075:.125,.220);
 if(style==='Side swept'){
  const fringe=mesh(box(.30,.075,.13),hairMat,head,-.07,2.66,.145);fringe.rotation.z=-.23;
 }else if(style==='Short crop'){
  mesh(box(.32,.055,.10),hairMat,head,0,2.676,.145);
 }else if(style==='Spiky'){
  for(let i=-2;i<=2;i++){const tuft=mesh(geo('humanSpike',()=>new T.ConeGeometry(.055,.15,5)),hairMat,head,i*.09,2.78,-.015);tuft.rotation.z=-i*.14}
 }else if(style==='Long'){
  for(const side of [-1,1])mesh(sphere,hairMat,head,side*.20,2.41,-.105,.085,.26,.105);
  mesh(sphere,hairMat,head,0,2.42,-.175,.20,.28,.10);
 }
 // Reduce the oversized prototype head while keeping its neck attachment fixed.
 head.children.forEach(o=>{o.position.y-=2.10});
 head.position.y=2.10;head.scale.set(.74,.72,.78);
 // Dedicated attachment anchors prevent weapons and shields from floating or
 // swapping hands as shoulder and elbow joints animate.
 const leftArm=new T.Group(),rightArm=new T.Group(),leftLeg=new T.Group(),rightLeg=new T.Group();
 // Gameplay camera follows from behind: right-hand weapon appears on the player's right.
 leftArm.position.set(-.455,1.84,0);rightArm.position.set(.455,1.84,0);
 leftLeg.position.set(-.165,.985,0);rightLeg.position.set(.165,.985,0);
 root.add(leftArm,rightArm,leftLeg,rightLeg);
 const limb=(top,bottom,len,key)=>geo(key,()=>new T.CylinderGeometry(top,bottom,len,12,1));
 const leftElbow=new T.Group(),rightElbow=new T.Group(),leftKnee=new T.Group(),rightKnee=new T.Group();
 for(const [arm,side,elbow] of [[leftArm,-1,leftElbow],[rightArm,1,rightElbow]]){
  mesh(sphere,cloth,arm,0,-.09,0,.155,.14,.155);
  const upper=mesh(limb(.145,.115,.38,'humanUpperArm'),cloth,arm,side*.01,-.27,0);
  upper.rotation.z=side*.05;
  elbow.position.set(side*.018,-.46,0);arm.add(elbow);
  mesh(sphere,faceMat,elbow,0,0,0,.11,.12,.115);
  mesh(limb(.11,.08,.31,'humanForearm'),faceMat,elbow,side*.006,-.14,0);
  // A palm, four curled fingers and an opposed thumb replace the spherical fist.
  mesh(sphere,faceMat,elbow,side*.012,-.31,.015,.070,.090,.055);
  for(let finger=0;finger<4;finger++)mesh(sphere,faceMat,elbow,side*.012+(finger-1.5)*.027,-.385,.028,.017,.047,.027);
  const thumb=mesh(sphere,faceMat,elbow,-side*.061,-.325,.047,.025,.060,.026);thumb.rotation.z=-side*.4;
 }
 for(const [leg,side,knee] of [[leftLeg,-1,leftKnee],[rightLeg,1,rightKnee]]){
  mesh(limb(.17,.13,.48,'humanThigh'),trousers,leg,side*.012,-.245,0);
  knee.position.set(side*.016,-.49,0);leg.add(knee);
  mesh(sphere,trousers,knee,0,0,0,.135,.12,.14);
  mesh(limb(.13,.095,.37,'humanCalf'),trousers,knee,side*.005,-.17,-.005);
  mesh(geo('humanBootCuff',()=>new T.CylinderGeometry(.13,.13,.09,12)),beltMat,knee,side*.01,-.35,.005);
  const shoe=mesh(sphere,boots,knee,side*.01,-.42,.13,.16,.11,.27);
  shoe.rotation.x=-.07;
  mesh(box(.27,.05,.33),boots,knee,side*.01,-.485,.16);
 }
 // Attachment points follow the wrist joints, not the upper-arm pivots.
 const leftHand=new T.Group(),rightHand=new T.Group();
 leftHand.position.set(-.012,-.33,.015);rightHand.position.set(.012,-.33,.015);
 leftElbow.add(leftHand);rightElbow.add(rightHand);
 // Anatomical rig contracts used by armor and equipment.
 return {root,body:root,leftArm,rightArm,leftLeg,rightLeg,leftElbow,rightElbow,leftKnee,rightKnee,leftHand,rightHand,torso,neck,face,head,hairMeshes:head.children.filter(o=>o.material===hairMat)};
}
