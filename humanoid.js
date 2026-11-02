// Eldervale's shared stylized-human rig. The same geometry powers players,
// NPCs, remote adventurers and the live character-creation preview.
// Rig pivots are preserved for existing movement, equipment and combat animations.
export function buildHumanoid(T,root,look={}){
 const parse=(v,f)=>typeof v==='number'?v:/^#[0-9a-f]{6}$/i.test(v||'')?parseInt(v.slice(1),16):f;
 const skin=parse(look.skin,0xc9916b),shirt=parse(look.shirt,0x426e68),pants=parse(look.pants,0x353b3e),hairColor=parse(look.hairColor,0x392820);
 const cache=buildHumanoid.cache||(buildHumanoid.cache=new Map());
 function mat(color,rough=.85){const k='mat'+color+':'+rough;if(!cache.has(k))cache.set(k,new T.MeshStandardMaterial({color,roughness:rough,flatShading:true}));return cache.get(k)}
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
 // Angular human head: tapered jaw, cheeks, chin, brow and projected nose.
 const headShape=geo('humanHead',()=>new T.LatheGeometry([
  new T.Vector2(.09,0),new T.Vector2(.17,.055),new T.Vector2(.235,.17),
  new T.Vector2(.275,.32),new T.Vector2(.265,.48),new T.Vector2(.225,.59),
  new T.Vector2(.125,.64)
 ],12));
 const face=mesh(headShape,faceMat,root,0,2.095,.018,1,1,1.02);
 // Face front points toward +Z, matching the existing game movement rig.
 for(const side of [-1,1]){
  mesh(sphere,faceMat,root,side*.265,2.39,0,.055,.095,.07);
  mesh(box(.09,.024,.018),mat(0x32251f),root,side*.125,2.493,.266).rotation.z=side*-.10;
  mesh(box(.07,.018,.015),mat(0x2c2926),root,side*.125,2.455,.278);
  mesh(sphere,mat(0xf1e5d2),root,side*.125,2.456,.283,.028,.012,.008);
 }
 const nose=mesh(geo('humanNose',()=>new T.ConeGeometry(.072,.185,5)),faceMat,root,0,2.385,.30,.8,1,.8);
 nose.rotation.x=Math.PI/2;
 mesh(box(.105,.016,.012),mat(0x805349),root,0,2.295,.254);
 // Hair is cut as a fitted cap, not a floating round helmet.
 const style=look.hair||'Side swept';
 const hairCap=mesh(geo('humanHairCap',()=>new T.SphereGeometry(1,14,8,0,Math.PI*2,0,Math.PI*.56)),hairMat,root,0,2.635,.005,.269,style==='Buzz cut'?.085:.155,.274);
 if(style==='Side swept'){
  const fringe=mesh(box(.29,.09,.13),hairMat,root,-.09,2.618,.215);fringe.rotation.z=-.24;
 }else if(style==='Short crop'){
  mesh(box(.38,.065,.13),hairMat,root,0,2.632,.19);
 }else if(style==='Spiky'){
  for(let i=-2;i<=2;i++){const tuft=mesh(geo('humanSpike',()=>new T.ConeGeometry(.065,.18,5)),hairMat,root,i*.105,2.76,-.005);tuft.rotation.z=i*-.16}
 }else if(style==='Long'){
  for(const side of [-1,1])mesh(sphere,hairMat,root,side*.225,2.37,-.10,.105,.30,.145);
  mesh(sphere,hairMat,root,0,2.40,-.20,.23,.30,.12);
 }
 const leftArm=new T.Group(),rightArm=new T.Group(),leftLeg=new T.Group(),rightLeg=new T.Group();
 leftArm.position.set(-.455,1.84,0);rightArm.position.set(.455,1.84,0);
 leftLeg.position.set(-.165,.985,0);rightLeg.position.set(.165,.985,0);
 root.add(leftArm,rightArm,leftLeg,rightLeg);
 const limb=(top,bottom,len,key)=>geo(key,()=>new T.CylinderGeometry(top,bottom,len,12,1));
 const leftElbow=new T.Group(),rightElbow=new T.Group(),leftKnee=new T.Group(),rightKnee=new T.Group();
 for(const [arm,side,elbow] of [[leftArm,-1,leftElbow],[rightArm,1,rightElbow]]){
  mesh(sphere,cloth,arm,0,-.09,0,.17,.16,.18);
  const upper=mesh(limb(.145,.115,.38,'humanUpperArm'),cloth,arm,side*.01,-.27,0);
  upper.rotation.z=side*.05;
  elbow.position.set(side*.018,-.46,0);arm.add(elbow);
  mesh(sphere,faceMat,elbow,0,0,0,.11,.12,.115);
  mesh(limb(.11,.08,.31,'humanForearm'),faceMat,elbow,side*.006,-.14,0);
  mesh(sphere,faceMat,elbow,side*.012,-.33,.015,.085,.11,.085);
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
 // Shared anatomical joints can be animated independently by the player and NPC rigs.
 return {root,body:root,leftArm,rightArm,leftLeg,rightLeg,leftElbow,rightElbow,leftKnee,rightKnee,torso,neck,face};
}
