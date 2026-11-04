import {loftGeometry} from './anatomy.js?v=release-20261104-lowpoly54';
// Low-poly segmented character used by the player and every humanoid NPC.
//
// Each body part is one small rigid mesh parented to the bone that moves it, so
// nothing is skinned and nothing can tear or drift. Armor (armor.js) is built
// from the very same part profiles, inflated outward and parented to the same
// bones, so equipment fits by construction in every pose.

// Joint positions in character space (metres-ish game units, +Z faces forward).
export const JOINTS={
 base:[0,0,0],head:[0,2.533,0],
 leftArm:[.296,2.217,-.037],leftElbow:[.296,1.817,-.037],leftHand:[.296,1.404,-.037],
 rightArm:[-.296,2.217,-.037],rightElbow:[-.296,1.817,-.037],rightHand:[-.296,1.404,-.037],
 leftLeg:[.173,1.483,-.077],leftKnee:[.173,.807,-.077],leftAnkle:[.173,.1195,-.077],
 rightLeg:[-.173,1.483,-.077],rightKnee:[-.173,.807,-.077],rightAnkle:[-.173,.1195,-.077]
};
const BONES=Object.keys(JOINTS);
const PARENT={leftElbow:'leftArm',leftHand:'leftElbow',rightElbow:'rightArm',rightHand:'rightElbow',leftKnee:'leftLeg',leftAnkle:'leftKnee',rightKnee:'rightLeg',rightAnkle:'rightKnee'};
// Waist pivot for the torso, so leaning and impacts bend at the hips.
export const WAIST=1.56;

// Cross-section rings: [y, radiusX, radiusZ, centreX, centreZ], local to the
// owning bone (or the torso pivot). These are the single source of truth for
// both the body and the armor that covers it.
export const PROFILES={
 hips:[[1.34,.215,.14,0,-.045],[1.47,.25,.16,0,-.05],[1.60,.235,.15,0,-.05]],
 torso:[[-.06,.235,.15,0,-.05],[.20,.245,.155,0,-.05],[.44,.29,.172,0,-.045],[.60,.305,.162,0,-.05],[.70,.235,.13,0,-.05],[.76,.11,.09,0,-.05]],
 neck:[[2.26,.082,.078,0,-.035],[2.47,.074,.07,0,-.02]],
 upperArm:[[.06,.075,.075],[-.02,.088,.086],[-.20,.077,.075],[-.40,.064,.064]],
 forearm:[[0,.06,.06],[-.12,.066,.062],[-.425,.046,.04]],
 thigh:[[.08,.11,.115],[-.04,.13,.132],[-.36,.106,.11],[-.676,.08,.084]],
 shin:[[0,.082,.086],[-.16,.086,.095,0,-.012],[-.52,.062,.066],[-.688,.054,.056]],
 // Shoes run along +Z; the sole is flat at the ground (ankle-local y -.1195).
 foot:[[-.1195,.064,.155,0,.075],[-.06,.066,.15,0,.07],[0,.054,.08,0,.015],[.07,.05,.056]],
 head:[[-.20,.05,.05,0,.065],[-.16,.098,.11,0,.03],[-.08,.132,.142,0,.018],[.03,.142,.155,0,.008],[.13,.138,.148],[.21,.108,.118,0,-.008],[.265,.04,.045,0,-.01]]
};
// Low-poly hands. Open palm faces local +Z; the fist is centred on the grip
// point that weapons and tools attach to (see equipment-pose.js).
export const GRIP=[0,-.075,0];
const SIDES={limb:8,head:10,body:10};

// Rings may be listed top-down; loftGeometry needs them bottom-up for outward faces.
export function shell(T,rings,sides){return loftGeometry(T,[...rings].sort((a,b)=>a[0]-b[0]),sides)}
export function inflate(rings,scale=1,pad=0){return rings.map(([y,rx,rz,cx=0,cz=0])=>[y,rx*scale+pad,rz*scale+pad,cx,cz])}

export function buildHumanoid(T,root,look={}){
 const cache=sharedCache(T);
 const color=(v,f)=>typeof v==='number'?v:/^#[0-9a-f]{6}$/i.test(v||'')?parseInt(v.slice(1),16):f;
 const mat=(name,c,roughness=.85)=>{const k='mat:'+name+':'+c;if(!cache.has(k)){const m=new T.MeshStandardMaterial({color:c,roughness,metalness:0,flatShading:true});m.userData.eldervaleShared=true;cache.set(k,m)}return cache.get(k)};
 const geo=(key,make)=>{if(!cache.has(key)){const g=make();g.computeBoundingSphere();g.userData.eldervaleShared=true;cache.set(key,g)}return cache.get(key)};
 const skinColor=color(look.skin,0xc9916b),hairColor=color(look.hairColor,0x392820);
 const skin=mat('skin',skinColor,.75),hair=mat('hair',hairColor,.9),shirt=mat('cloth',color(look.shirt,0x426e68),.92),pants=mat('cloth',color(look.pants,0x353b3e),.92),boots=mat('leather',0x3a2c22,.9),belt=mat('leather',0x2a201a,.9);
 const dark=mat('feature',0x1b1514,.6),lipColor=mat('lip',mix(skinColor,0x7a3a32,.35),.7);

 // Skeleton: plain bones in the same hierarchy the animation system expects.
 const bones={};
 for(const name of BONES){const b=new T.Bone();b.name=name==='head'?'character-head':'eldervale-'+name;bones[name]=b}
 for(const name of BONES){const p=PARENT[name];(p?bones[p]:root).add(bones[name]);const at=new T.Vector3().fromArray(JOINTS[name]);if(p)at.sub(new T.Vector3().fromArray(JOINTS[p]));bones[name].position.copy(at)}

 const parts={},slots={helm:[],chest:[],legs:[],boots:[]};
 const add=(g,m,parent,name,cover,x=0,y=0,z=0)=>{const o=new T.Mesh(g,m);o.name='humanoid-'+name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=false;parent.add(o);parts[name]=o;if(cover)slots[cover].push(o);return o};
 const loft=(key,rings,sides)=>geo('loft:'+key,()=>shell(T,rings,sides));
 // Joint fillers share the limbs' 8-sided faceting so bends never open a gap.
 const ball=(r)=>geo('ball:'+r,()=>new T.SphereGeometry(r,8,6));

 // Torso pivots at the waist; shirt + belt live under it.
 const torso=new T.Group();torso.name='humanoid-torso-pivot';torso.position.y=WAIST;bones.base.add(torso);
 add(loft('torso',PROFILES.torso,SIDES.body),shirt,torso,'shirt','chest');
 add(loft('hips',PROFILES.hips,SIDES.body),pants,bones.base,'hips','legs');
 add(loft('belt',[[1.555,.24,.155,0,-.05],[1.605,.24,.155,0,-.05]],SIDES.body),belt,bones.base,'belt','legs');
 add(loft('neck',PROFILES.neck,8),skin,bones.base,'neck','helm');

 for(const side of ['left','right']){
  const s=side==='left'?1:-1;
  add(ball(.08),shirt,bones[side+'Arm'],side+'Shoulder','chest',0,-.03,0);
  add(loft('upperArm',PROFILES.upperArm,SIDES.limb),shirt,bones[side+'Arm'],side+'UpperArm','chest');
  add(ball(.054),skin,bones[side+'Elbow'],side+'ElbowJoint','chest');
  add(loft('forearm',PROFILES.forearm,SIDES.limb),skin,bones[side+'Elbow'],side+'Forearm','chest');
  add(loft('thigh',PROFILES.thigh,SIDES.limb),pants,bones[side+'Leg'],side+'Thigh','legs');
  add(ball(.074),pants,bones[side+'Knee'],side+'KneeJoint','legs');
  add(loft('shin',PROFILES.shin,SIDES.limb),pants,bones[side+'Knee'],side+'Shin','legs');
  add(loft('foot',PROFILES.foot,8),boots,bones[side+'Ankle'],side+'Foot','boots');
  // Hand: an open mitten with a thumb, swapped for a fist when gripping.
  // Plain Object3D (not Group): held equipment is detected as Group children of the hand bone.
  const hand=new T.Object3D();hand.name='humanoid-'+side+'Hand';bones[side+'Hand'].add(hand);parts[side+'Hand']=hand;
  const open=new T.Object3D();open.name='open-hand';hand.add(open);
  const palm=new T.Mesh(geo('palm',()=>shell(T,[[.02,.042,.03],[-.05,.054,.032],[-.12,.052,.026],[-.20,.034,.016]],6)),skin);palm.castShadow=true;open.add(palm);
  const thumb=new T.Mesh(geo('thumb',()=>{const g=new T.BoxGeometry(.026,.07,.028);g.translate(0,-.035,0);return g}),skin);thumb.position.set(-s*.048,-.04,.02);thumb.rotation.set(-.35,0,s*.45);thumb.castShadow=true;open.add(thumb);
  const fist=new T.Mesh(geo('fist',()=>{const g=new T.BoxGeometry(.10,.115,.10,1,1,1);g.translate(0,0,.004);return g}),skin);fist.name='fist';fist.position.fromArray(GRIP);fist.visible=false;fist.castShadow=true;hand.add(fist);
  hand.userData.grip={open,fist};
 }

 // Head: faceted skull with a nose, brow, ears, eyes and a lower lip.
 const head=bones.head,face=look.face==='Broad'?'Broad':look.face==='Angular'?'Angular':'Balanced';
 const headRings=PROFILES.head.map(([y,rx,rz,cx,cz])=>[y,rx*(face==='Broad'?1.07:face==='Angular'&&y<0?.9:1),rz,cx,cz]);
 const faceMesh=add(geo('head:'+face,()=>shell(T,headRings,SIDES.head)),skin,head,'face','helm');faceMesh.name='character-face';
 const features=[faceMesh];
 const feature=(g,m,x,y,z,rx=0,ry=0,rz=0)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.castShadow=false;head.add(o);features.push(o);slots.helm.push(o);return o};
 feature(geo('nose',()=>{const g=new T.ConeGeometry(.026,.075,4);g.rotateX(Math.PI/2+.5);return g}),skin,0,.0,.162);
 const eyeX=face==='Broad'?.058:.052;
 for(const x of [-eyeX,eyeX]){feature(geo('eye',()=>new T.BoxGeometry(.034,.024,.012)),dark,x,.048,.150).name='eye';feature(geo('brow',()=>new T.BoxGeometry(.05,.016,.022)),hair,x,.082,.150,0,0,x>0?-.12:.12)}
 for(const s of [-1,1])feature(geo('ear',()=>new T.BoxGeometry(.026,.07,.05)),skin,s*(face==='Broad'?.152:.142),.02,.0,0,s*.25,0);
 const lip=feature(geo('lip',()=>new T.BoxGeometry(.06,.016,.014)),lipColor,0,-.085,.142);lip.name='lower-lip';

 // Hair and beards. Pieces follow the head bone and are hidden under a helmet.
 const style=look.hair||'Side swept',hairMeshes=[];
 const hairPiece=(key,make,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{const o=new T.Mesh(geo(key,make),hair);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.castShadow=true;head.add(o);hairMeshes.push(o);slots.helm.push(o);return o};
 const capRings=(from,k,pad)=>inflate(headRings.filter(r=>r[0]>=from),k,pad);
 if(style!=='Bald'){
  const thin=style==='Buzz cut';
  // Top cap from the hairline up, plus a back piece that sits behind the ears.
  hairPiece('hair-cap:'+face+':'+thin,()=>{const rings=capRings(.13,thin?1.03:1.07,thin?.002:.006);rings.unshift([.075,rings[0][1]*.99,rings[0][2]*.98,0,.0]);return shell(T,rings,SIDES.head)});
  hairPiece('hair-back:'+face+':'+thin,()=>shell(T,[[-.10,.118*(face==='Broad'?1.07:1),.10,0,-.05],[.03,.15*(face==='Broad'?1.07:1),.125,0,-.035],[.14,.145*(face==='Broad'?1.07:1),.13,0,-.03]],SIDES.head));
  if(style==='Side swept')hairPiece('hair-swept',()=>new T.BoxGeometry(.25,.05,.07),.02,.17,.13,.35,0,-.22);
  if(style==='Short crop')hairPiece('hair-fringe',()=>new T.BoxGeometry(.22,.04,.05),0,.165,.135,.4,0,0);
  if(style==='Spiky')for(let i=0;i<7;i++){const a=(i-3)*.32;hairPiece('hair-spike',()=>{const g=new T.ConeGeometry(.04,.12,4);g.translate(0,.06,0);return g},Math.sin(a)*.10,.21+Math.cos(a)*.03,.02+(i%2)*.05-.02,(i%2?.35:-.25),0,-a*.8).userData.hairStrand=true}
  if(style==='Long'){hairPiece('hair-long',()=>{const g=shell(T,[[-.30,.12,.05],[-.10,.15,.08],[.10,.16,.10]],8);g.translate(0,0,-.07);return g},0,0,-.06);hairPiece('hair-fringe',()=>new T.BoxGeometry(.22,.04,.05),0,.165,.135,.4,0,0)}
 }
 const beard=look.beard||'Clean shaven';
 if(beard==='Short beard'||beard==='Stubble'){
  const short=beard==='Short beard';
  const m=short?hair:mat('stubble',mix(skinColor,hairColor,.45),.95);
  const o=new T.Mesh(geo('beard:'+face+':'+beard,()=>shell(T,headRings.filter(r=>r[0]<=-.03).map(([y,rx,rz,cx,cz])=>[y,rx*(short?1.06:1.02)+(short?.004:.001),rz*.55,cx,cz+rz*(short?.5:.46)]),SIDES.head)),m);
  o.position.y=short?-.01:0;o.castShadow=true;head.add(o);hairMeshes.push(o);slots.helm.push(o);
 }

 // Two-bone arm IK. Used for two-handed weapons, shields and carried props.
 function solveArm(side,target,weaponUp=new T.Vector3(0,1,0),weaponForward=null){const arm=bones[side+'Arm'],elbow=bones[side+'Elbow'],hand=bones[side+'Hand'],upper=elbow.position.clone(),lower=hand.position.clone(),l1=upper.length(),l2=lower.length(),toward=target.clone().sub(arm.position),distance=Math.min(l1+l2-.001,Math.max(.02,toward.length())),direction=toward.normalize(),pole=new T.Vector3(side==='left'?.7:-.7,-.1,-.4);pole.addScaledVector(direction,-pole.dot(direction)).normalize();const along=(l1*l1-l2*l2+distance*distance)/(2*distance),bend=Math.sqrt(Math.max(0,l1*l1-along*along)),elbowDelta=direction.clone().multiplyScalar(along).addScaledVector(pole,bend);arm.quaternion.setFromUnitVectors(upper.clone().normalize(),elbowDelta.clone().normalize());elbow.quaternion.setFromUnitVectors(lower.clone().normalize(),direction.clone().multiplyScalar(distance).sub(elbowDelta).applyQuaternion(arm.quaternion.clone().invert()).normalize());const parentRotation=arm.quaternion.clone().multiply(elbow.quaternion);if(weaponForward){const y=weaponUp.clone().normalize(),z=weaponForward.clone().addScaledVector(y,-weaponForward.dot(y)).normalize(),x=new T.Vector3().crossVectors(y,z).normalize(),orientation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));hand.quaternion.copy(parentRotation.invert()).multiply(orientation)}else hand.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),weaponUp.clone().applyQuaternion(parentRotation.invert()).normalize());}

 const grips={left:0,right:0};
 const setHandGrip=(side,amount)=>{grips[side]=Math.max(0,Math.min(1,amount));const g=parts[side+'Hand'].userData.grip,closed=grips[side]>=.7;g.fist.visible=closed;g.open.visible=!closed};
 // Hide body parts that equipped armor covers. Armor is slightly larger than
 // the body, so this only saves draw calls and prevents spikes poking through.
 const coverage={helm:false,chest:false,legs:false,boots:false};
 function setCoverage(next={}){for(const slot of Object.keys(coverage)){coverage[slot]=!!next[slot];for(const o of slots[slot])o.visible=!coverage[slot]}}

 const meshes={head:faceMesh,torso:parts.shirt,leftHand:parts.leftHand,rightHand:parts.rightHand,leftFoot:parts.leftFoot,rightFoot:parts.rightFoot};
 const lengths={arm:JOINTS.leftArm[1]-JOINTS.leftElbow[1],forearm:JOINTS.leftElbow[1]-JOINTS.leftHand[1],leg:JOINTS.leftLeg[1]-JOINTS.leftKnee[1],shin:JOINTS.leftKnee[1]-JOINTS.leftAnkle[1]};
 root.updateMatrixWorld(true);
 return {...bones,root,body:root,head,neck:bones.base,chestBone:bones.base,torso,
  // `skinned` historically meant "full-size authored proportions"; animation IK targets depend on it.
  skinned:true,lowPoly:true,parts,meshes,face:faceMesh,faceMeshes:features,hairMeshes,clothingMeshes:[parts.shirt],bodySlots:slots,
  setHandGrip,setCoverage,coverage,solveArm,
  upperOffset:.295,legScale:lengths.leg/.49,lowerLegScale:lengths.shin/.42,armScale:lengths.arm/.46,forearmScale:lengths.forearm/.33};
}

function sharedCache(T){const all=sharedCache.all||(sharedCache.all=new WeakMap());let c=all.get(T);if(!c){c=new Map();all.set(T,c)}return c}
function mix(a,b,t){const ch=(v,s)=>(v>>s)&255,m=s=>Math.round(ch(a,s)*(1-t)+ch(b,s)*t);return (m(16)<<16)|(m(8)<<8)|m(0)}
