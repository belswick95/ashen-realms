import {loftGeometry} from './anatomy.js?v=release-20261104-lowpoly54';
// Stylised segmented character used by the player and every humanoid NPC.
//
// Chunky, rounded proportions (broad shoulders, muscled arms and calves, fists,
// sturdy boots) with smooth shading. Each body part is a rigid mesh parented
// to the bone that moves it, so nothing is skinned and nothing can tear or
// drift. Armor (armor.js) is built from these same part profiles, inflated and
// parented to the same bones, so equipment fits by construction in every pose.

// Joint positions in character space (+Z faces forward).
export const JOINTS={
 base:[0,0,0],head:[0,2.533,0],
 leftArm:[.33,2.20,-.04],leftElbow:[.33,1.80,-.04],leftHand:[.33,1.39,-.04],
 rightArm:[-.33,2.20,-.04],rightElbow:[-.33,1.80,-.04],rightHand:[-.33,1.39,-.04],
 leftLeg:[.165,1.483,-.06],leftKnee:[.165,.807,-.06],leftAnkle:[.165,.1195,-.06],
 rightLeg:[-.165,1.483,-.06],rightKnee:[-.165,.807,-.06],rightAnkle:[-.165,.1195,-.06]
};
const BONES=Object.keys(JOINTS);
const PARENT={leftElbow:'leftArm',leftHand:'leftElbow',rightElbow:'rightArm',rightHand:'rightElbow',leftKnee:'leftLeg',leftAnkle:'leftKnee',rightKnee:'rightLeg',rightAnkle:'rightKnee'};
// Waist pivot for the torso, so leaning and impacts bend at the hips.
export const WAIST=1.56;

// Cross-section rings: [y, radiusX, radiusZ, centreX, centreZ], local to the
// owning bone (or the torso pivot). Single source of truth for body and armor.
export const PROFILES={
 hips:[[1.32,.22,.15,0,-.05],[1.42,.25,.165,0,-.055],[1.52,.255,.165,0,-.055],[1.62,.245,.158,0,-.05]],
 // Waist → ribs → broad chest → shoulder line → trapezius → neck base.
 torso:[[-.06,.24,.155,0,-.05],[.10,.245,.158,0,-.045],[.26,.275,.178,0,-.03],[.40,.305,.198,0,-.025],[.52,.325,.192,0,-.035],[.61,.31,.165,0,-.05],[.68,.235,.135,0,-.055],[.74,.13,.095,0,-.05]],
 neck:[[2.25,.088,.084,0,-.035],[2.36,.082,.078,0,-.03],[2.48,.078,.074,0,-.02]],
 // Deltoid, bicep bulge, tapering into the elbow.
 upperArm:[[.03,.06,.06],[.0,.092,.09],[-.08,.10,.096],[-.18,.09,.092,0,.008],[-.24,.092,.094,0,.012],[-.33,.076,.078],[-.40,.068,.068]],
 // Forearm muscle near the elbow, slim wrist.
 forearm:[[.02,.066,.066],[-.06,.08,.076,0,.004],[-.16,.078,.07],[-.30,.062,.056],[-.41,.05,.046]],
 thigh:[[.10,.12,.12],[.0,.145,.145],[-.16,.142,.142,0,.006],[-.36,.122,.124,0,.004],[-.56,.098,.10],[-.676,.088,.09]],
 // Calf bulge sits behind the shin line.
 shin:[[.02,.09,.092],[-.10,.098,.11,0,-.018],[-.22,.098,.11,0,-.02],[-.40,.08,.086,0,-.01],[-.58,.066,.07],[-.688,.064,.066]],
 // Sturdy rounded boots run along +Z; the sole is flat at the ground (ankle-local y -.1195).
 foot:[[-.1195,.082,.18,0,.075],[-.09,.088,.185,0,.075],[-.04,.086,.165,0,.06],[.01,.08,.12,0,.03],[.06,.074,.086,0,.008],[.13,.072,.078]],
 head:[[-.21,.045,.05,0,.07],[-.185,.085,.09,0,.05],[-.14,.115,.125,0,.03],[-.07,.135,.145,0,.018],[.0,.143,.155,0,.01],[.08,.145,.157,0,.004],[.15,.136,.148],[.21,.112,.124,0,-.008],[.25,.07,.08,0,-.01],[.268,.02,.02,0,-.01]]
};
// The fist is centred on this grip point; weapons and tools attach to it (equipment-pose.js).
export const GRIP=[0,-.075,0];
const SIDES={limb:12,head:16,body:16};

// Rings may be listed top-down; loftGeometry needs them bottom-up for outward faces.
export function shell(T,rings,sides){return loftGeometry(T,[...rings].sort((a,b)=>a[0]-b[0]),sides)}
export function inflate(rings,scale=1,pad=0){return rings.map(([y,rx,rz,cx=0,cz=0])=>[y,rx*scale+pad,rz*scale+pad,cx,cz])}

export function buildHumanoid(T,root,look={}){
 const cache=sharedCache(T);
 const color=(v,f)=>typeof v==='number'?v:/^#[0-9a-f]{6}$/i.test(v||'')?parseInt(v.slice(1),16):f;
 const mat=(name,c,roughness=.85)=>{const k='mat:'+name+':'+c;if(!cache.has(k)){const m=new T.MeshStandardMaterial({color:c,roughness,metalness:0});m.userData.eldervaleShared=true;cache.set(k,m)}return cache.get(k)};
 const geo=(key,make)=>{if(!cache.has(key)){const g=make();g.computeBoundingSphere();g.userData.eldervaleShared=true;cache.set(key,g)}return cache.get(key)};
 const skinColor=color(look.skin,0xc9916b),hairColor=color(look.hairColor,0x392820);
 const skin=mat('skin',skinColor,.72),hair=mat('hair',hairColor,.88),shirt=mat('cloth',color(look.shirt,0x426e68),.9),pants=mat('cloth',color(look.pants,0x353b3e),.9),boots=mat('leather',0x3b2d23,.8),belt=mat('leather',0x5a2620,.75);
 const eyeWhite=mat('eye-white',0xe8e2d6,.4),iris=mat('iris',0x2a1d16,.35),lipColor=mat('lip',mix(skinColor,0x7a3a32,.3),.7),lidColor=mat('lid',mix(skinColor,0x000000,.12),.75);

 // Skeleton: plain bones in the same hierarchy the animation system expects.
 const bones={};
 for(const name of BONES){const b=new T.Bone();b.name=name==='head'?'character-head':'eldervale-'+name;bones[name]=b}
 for(const name of BONES){const p=PARENT[name];(p?bones[p]:root).add(bones[name]);const at=new T.Vector3().fromArray(JOINTS[name]);if(p)at.sub(new T.Vector3().fromArray(JOINTS[p]));bones[name].position.copy(at)}

 const parts={},slots={helm:[],chest:[],legs:[],boots:[]};
 const add=(g,m,parent,name,cover,x=0,y=0,z=0)=>{const o=new T.Mesh(g,m);o.name='humanoid-'+name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=false;parent.add(o);parts[name]=o;if(cover)slots[cover].push(o);return o};
 const loft=(key,rings,sides)=>geo('loft:'+key,()=>shell(T,rings,sides));
 // Joint fillers are hidden inside the limbs when straight and close the gap when bent.
 const ball=(r,sx=1,sy=1,sz=1)=>geo('ball:'+[r,sx,sy,sz],()=>{const g=new T.SphereGeometry(r,14,10);g.scale(sx,sy,sz);return g});

 // Torso pivots at the waist; shirt lives under it, belt and trousers below.
 const torso=new T.Group();torso.name='humanoid-torso-pivot';torso.position.y=WAIST;bones.base.add(torso);
 add(loft('torso',PROFILES.torso,SIDES.body),shirt,torso,'shirt','chest');
 add(loft('hips',PROFILES.hips,SIDES.body),pants,bones.base,'hips','legs');
 add(loft('belt',[[1.53,.258,.168,0,-.055],[1.60,.255,.166,0,-.055]],SIDES.body),belt,bones.base,'belt','legs');
 add(loft('neck',PROFILES.neck,12),skin,bones.base,'neck','helm');

 for(const side of ['left','right']){
  const s=side==='left'?1:-1;
  // Bare arm with a short sleeve over the shoulder and upper bicep.
  add(loft('upperArm',PROFILES.upperArm,SIDES.limb),skin,bones[side+'Arm'],side+'UpperArm','chest');
  add(loft('sleeve',[[.105,.03,.03],[.09,.072,.07],[.06,.095,.092],[.025,.104,.1],...inflate(PROFILES.upperArm.slice(1,4),1.07,.006),[-.215,.103,.104,0,.008]],SIDES.limb),shirt,bones[side+'Arm'],side+'Sleeve','chest');
  add(ball(.06),skin,bones[side+'Elbow'],side+'ElbowJoint','chest');
  add(loft('forearm',PROFILES.forearm,SIDES.limb),skin,bones[side+'Elbow'],side+'Forearm','chest');
  add(loft('thigh',PROFILES.thigh,SIDES.limb),pants,bones[side+'Leg'],side+'Thigh','legs');
  add(ball(.082),pants,bones[side+'Knee'],side+'KneeJoint','legs');
  add(loft('shin',PROFILES.shin,SIDES.limb),pants,bones[side+'Knee'],side+'Shin','legs');
  add(loft('foot',PROFILES.foot,SIDES.limb),boots,bones[side+'Ankle'],side+'Foot','boots');
  add(loft('boot-cuff',[[.06,.082,.088,0,.004],[.16,.078,.082,0,-.004]],SIDES.limb),boots,bones[side+'Ankle'],side+'BootCuff','boots');
  // Hands: a relaxed open hand and a closed fist centred on the grip point.
  // Plain Object3D (not Group): held equipment is detected as Group children of the hand bone.
  const hand=new T.Object3D();hand.name='humanoid-'+side+'Hand';bones[side+'Hand'].add(hand);parts[side+'Hand']=hand;
  const open=new T.Object3D();open.name='open-hand';hand.add(open);
  const palm=new T.Mesh(geo('palm',()=>shell(T,[[.02,.046,.034],[-.04,.058,.038],[-.10,.058,.034],[-.16,.05,.026],[-.205,.03,.016]],10)),skin);palm.castShadow=true;open.add(palm);
  const thumb=new T.Mesh(geo('thumb',()=>shell(T,[[0,.018,.018],[-.04,.019,.018],[-.075,.012,.012]],8)),skin);thumb.position.set(-s*.05,-.035,.024);thumb.rotation.set(-.35,0,s*.45);thumb.castShadow=true;open.add(thumb);
  const fist=new T.Object3D();fist.name='fist';fist.position.fromArray(GRIP);fist.visible=false;hand.add(fist);
  const knuckles=new T.Mesh(geo('fist',()=>shell(T,[[-.065,.044,.04,0,.004],[-.045,.056,.054,0,.006],[.03,.058,.056,0,.006],[.055,.046,.044,0,.004]],8)),skin);knuckles.rotation.y=Math.PI/8;knuckles.castShadow=true;fist.add(knuckles);
  const fistThumb=new T.Mesh(ball(.026,1,1.5,1),skin);fistThumb.position.set(-s*.045,.018,.035);fistThumb.rotation.z=s*.5;fist.add(fistThumb);
  hand.userData.grip={open,fist};
 }

 // Head: smooth skull with a defined jaw, nose, ears, mouth and living eyes.
 const head=bones.head,face=look.face==='Broad'?'Broad':look.face==='Angular'?'Angular':'Balanced';
 const headRings=PROFILES.head.map(([y,rx,rz,cx=0,cz=0])=>[y,rx*(face==='Broad'?1.07:face==='Angular'&&y<-.05?.9:1),rz,cx,cz+(face==='Angular'&&y<-.1?.012:0)]);
 const faceMesh=add(geo('head:'+face,()=>shell(T,headRings,SIDES.head)),skin,head,'face','helm');faceMesh.name='character-face';
 const features=[faceMesh];
 const feature=(g,m,x,y,z,rx=0,ry=0,rz=0)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.castShadow=false;head.add(o);features.push(o);slots.helm.push(o);return o};
 feature(geo('nose',()=>{const g=shell(T,[[-.045,.024,.022,0,.012],[-.02,.018,.02,0,.008],[.03,.012,.012]],8);return g}),skin,0,.0,.148);
 const eyeX=face==='Broad'?.058:.053,lids=[];
 for(const x of [-eyeX,eyeX]){
  feature(ball(.021,1,.72,.5),eyeWhite,x,.045,.145).name='eye';
  feature(ball(.0115,1,1,.5),iris,x,.045,.153).name='iris';
  // Upper eyelid: rests half-lowered for a relaxed look and closes when blinking.
  const lid=feature(geo('eyelid',()=>{const g=new T.SphereGeometry(.0222,14,6,0,Math.PI*2,0,Math.PI/2);g.scale(1,.8,.56);return g}),lidColor,x,.045,.1455);lid.name='eyelid';lid.userData.side=x;lids.push(lid);
  feature(geo('brow',()=>{const g=new T.BoxGeometry(.056,.014,.02);return g}),hair,x,.083,.15,0,0,x>0?-.14:.14);
 }
 for(const s of [-1,1])feature(geo('ear',()=>{const g=new T.SphereGeometry(.034,10,8);g.scale(.45,1,.75);return g}),skin,s*(face==='Broad'?.153:.143),.02,-.005,0,s*.2,0);
 const lip=feature(geo('lip',()=>{const g=new T.SphereGeometry(.03,10,6);g.scale(1,.28,.35);return g}),lipColor,0,-.085,.145);lip.name='lower-lip';

 // Hair and beards. Pieces follow the head bone and are hidden under a helmet.
 const style=look.hair||'Side swept',hairMeshes=[];
 const hairPiece=(key,make,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{const o=new T.Mesh(geo(key,make),hair);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.castShadow=true;head.add(o);hairMeshes.push(o);slots.helm.push(o);return o};
 const wide=face==='Broad'?1.07:1;
 if(style!=='Bald'){
  const thin=style==='Buzz cut',k=thin?1.03:1.08,pad=thin?.002:.008;
  // Top cap from the hairline up, plus a back piece that sits behind the ears.
  hairPiece('hair-cap:'+face+':'+thin,()=>shell(T,[[.088,.138*wide,.15,0,-.004],[.10,.146*wide*k+pad,.158*k+pad,0,.0],...inflate(headRings.filter(r=>r[0]>=.15),k,pad)],SIDES.head));
  hairPiece('hair-back:'+face+':'+thin,()=>shell(T,[[-.11,.118*wide,.105,0,-.05],[-.02,.145*wide*(thin?1:1.02),.13,0,-.04],[.12,.148*wide*(thin?1:1.04),.14,0,-.03]],SIDES.head));
  const sweep=(key,w,h,d)=>()=>{const g=new T.SphereGeometry(1,12,8);g.scale(w,h,d);return g};
  if(style==='Side swept')hairPiece('hair-swept',sweep(0,.12,.035,.06),.035,.172,.115,.35,0,-.25);
  if(style==='Short crop')hairPiece('hair-fringe',sweep(0,.11,.026,.05),0,.165,.125,.4,0,0);
  if(style==='Spiky')for(let i=0;i<7;i++){const a=(i-3)*.32;hairPiece('hair-spike',()=>{const g=new T.ConeGeometry(.045,.12,8);g.translate(0,.055,0);return g},Math.sin(a)*.10,.205+Math.cos(a)*.03,.02+(i%2)*.05-.02,(i%2?.35:-.25),0,-a*.8).userData.hairStrand=true}
  if(style==='Long'){hairPiece('hair-long',()=>{const g=shell(T,[[-.32,.12,.05],[-.12,.152,.075],[.10,.162,.10]],14);g.translate(0,0,-.075);return g},0,0,-.055);hairPiece('hair-fringe',sweep(0,.11,.026,.05),0,.165,.125,.4,0,0)}
 }
 const beard=look.beard||'Clean shaven';
 if(beard==='Short beard'||beard==='Stubble'){
  const short=beard==='Short beard';
  const m=short?hair:mat('stubble',mix(skinColor,hairColor,.4),.95);
  const o=new T.Mesh(geo('beard:'+face+':'+beard,()=>shell(T,headRings.filter(r=>r[0]<=-.04).map(([y,rx,rz,cx=0,cz=0])=>[y,rx*(short?1.07:1.02)+(short?.004:.001),rz*.55,cx,cz+rz*(short?.5:.46)]),SIDES.head)),m);
  o.position.y=short?-.01:0;o.castShadow=true;head.add(o);hairMeshes.push(o);slots.helm.push(o);
 }

 // Two-bone arm IK. Used for two-handed weapons, shields and carried props.
 function solveArm(side,target,weaponUp=new T.Vector3(0,1,0),weaponForward=null){const arm=bones[side+'Arm'],elbow=bones[side+'Elbow'],hand=bones[side+'Hand'],upper=elbow.position.clone(),lower=hand.position.clone(),l1=upper.length(),l2=lower.length(),toward=target.clone().sub(arm.position),distance=Math.min(l1+l2-.001,Math.max(.02,toward.length())),direction=toward.normalize(),pole=new T.Vector3(side==='left'?.7:-.7,-.1,-.4);pole.addScaledVector(direction,-pole.dot(direction)).normalize();const along=(l1*l1-l2*l2+distance*distance)/(2*distance),bend=Math.sqrt(Math.max(0,l1*l1-along*along)),elbowDelta=direction.clone().multiplyScalar(along).addScaledVector(pole,bend);arm.quaternion.setFromUnitVectors(upper.clone().normalize(),elbowDelta.clone().normalize());elbow.quaternion.setFromUnitVectors(lower.clone().normalize(),direction.clone().multiplyScalar(distance).sub(elbowDelta).applyQuaternion(arm.quaternion.clone().invert()).normalize());const parentRotation=arm.quaternion.clone().multiply(elbow.quaternion);if(weaponForward){const y=weaponUp.clone().normalize(),z=weaponForward.clone().addScaledVector(y,-weaponForward.dot(y)).normalize(),x=new T.Vector3().crossVectors(y,z).normalize(),orientation=new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(x,y,z));hand.quaternion.copy(parentRotation.invert()).multiply(orientation)}else hand.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),weaponUp.clone().applyQuaternion(parentRotation.invert()).normalize());}

 // Relaxed hands are loosely closed, like a resting fighter; open only when told.
 const grips={left:0,right:0};
 const setHandGrip=(side,amount)=>{grips[side]=Math.max(0,Math.min(1,amount));const g=parts[side+'Hand'].userData.grip,closed=grips[side]>=.4;g.fist.visible=closed;g.open.visible=!closed};
 // Hide body parts that equipped armor covers. Armor is larger than the body,
 // so this only saves draw calls and prevents hair poking through a helmet.
 const coverage={helm:false,chest:false,legs:false,boots:false};
 function setCoverage(next={}){for(const slot of Object.keys(coverage)){coverage[slot]=!!next[slot];for(const o of slots[slot])o.visible=!coverage[slot]}}

 // Blinking: every few seconds the upper lids sweep down over the eyes for
 // ~0.14s. Each character keeps its own rhythm so a crowd never blinks in unison.
 // A lid is the top half of a dome hinged at the eye centre; rotating it about
 // X swings it from resting over the upper eye to covering the whole eye.
 const LID_REST=.42,LID_CLOSED=1.5;let blinkTimer=.8+Math.random()*3,blinkTime=-1;
 for(const lid of lids)lid.rotation.x=LID_REST;
 function tick(dt){if(!(dt>0))return;dt=Math.min(dt,.1);blinkTimer-=dt;if(blinkTimer<=0&&blinkTime<0){blinkTime=0;blinkTimer=2.2+Math.random()*3.8}
  let angle=LID_REST;if(blinkTime>=0){blinkTime+=dt;const t=Math.min(1,blinkTime/.14),closed=t<.45?t/.45:1-(t-.45)/.55;angle=LID_REST+(LID_CLOSED-LID_REST)*closed;if(t>=1){blinkTime=-1;angle=LID_REST}}
  for(const l of lids)l.rotation.x=angle}

 const meshes={head:faceMesh,torso:parts.shirt,leftHand:parts.leftHand,rightHand:parts.rightHand,leftFoot:parts.leftFoot,rightFoot:parts.rightFoot};
 const lengths={arm:JOINTS.leftArm[1]-JOINTS.leftElbow[1],forearm:JOINTS.leftElbow[1]-JOINTS.leftHand[1],leg:JOINTS.leftLeg[1]-JOINTS.leftKnee[1],shin:JOINTS.leftKnee[1]-JOINTS.leftAnkle[1]};
 root.updateMatrixWorld(true);
 return {...bones,root,body:root,head,neck:bones.base,chestBone:bones.base,torso,
  // `skinned` historically meant "full-size authored proportions"; animation IK targets depend on it.
  skinned:true,lowPoly:true,parts,meshes,face:faceMesh,faceMeshes:features,eyelids:lids,hairMeshes,clothingMeshes:[parts.shirt],bodySlots:slots,
  setHandGrip,setCoverage,coverage,solveArm,tick,
  upperOffset:.295,legScale:lengths.leg/.49,lowerLegScale:lengths.shin/.42,armScale:lengths.arm/.46,forearmScale:lengths.forearm/.33};
}

function sharedCache(T){const all=sharedCache.all||(sharedCache.all=new WeakMap());let c=all.get(T);if(!c){c=new Map();all.set(T,c)}return c}
function mix(a,b,t){const ch=(v,s)=>(v>>s)&255,m=s=>Math.round(ch(a,s)*(1-t)+ch(b,s)*t);return (m(16)<<16)|(m(8)<<8)|m(0)}
