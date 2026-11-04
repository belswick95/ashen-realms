import {loftGeometry} from './anatomy.js?v=release-20261104-lowpoly54';
import {installLocalSkinning} from './local-skinning.js?v=release-20261104-lowpoly54';
import {HAIRSTYLES,BEARDS} from './appearance.js?v=release-20261104-lowpoly54';
const HAIRSTYLE_SET=new Set(HAIRSTYLES),BEARD_SET=new Set(BEARDS);
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
 torso:[[-.06,.225,.15,0,-.05],[.08,.228,.152,0,-.045],[.22,.262,.17,0,-.03],[.36,.31,.2,0,-.018],[.47,.33,.198,0,-.025],[.55,.315,.178,0,-.04],[.62,.27,.152,0,-.05],[.68,.205,.128,0,-.055],[.74,.12,.092,0,-.05]],
 neck:[[2.25,.088,.084,0,-.035],[2.36,.082,.078,0,-.03],[2.48,.078,.074,0,-.02]],
 // Deltoid, bicep bulge, tapering into the elbow.
 upperArm:[[.03,.06,.06],[.0,.092,.09],[-.08,.10,.096],[-.18,.09,.092,0,.008],[-.24,.092,.094,0,.012],[-.33,.076,.078],[-.40,.068,.068]],
 // Forearm muscle near the elbow, slim wrist.
 forearm:[[.02,.07,.07],[-.07,.088,.082,0,.004],[-.18,.084,.076],[-.31,.066,.06],[-.41,.054,.05]],
 thigh:[[.10,.12,.12],[.0,.145,.145],[-.16,.142,.142,0,.006],[-.36,.122,.124,0,.004],[-.56,.098,.10],[-.676,.088,.09]],
 // Calf bulge sits behind the shin line.
 shin:[[.02,.09,.092],[-.10,.098,.11,0,-.018],[-.22,.098,.11,0,-.02],[-.40,.082,.088,0,-.01],[-.56,.076,.08],[-.64,.084,.09,0,.006]],
 // Sturdy rounded boots run along +Z; the sole is flat at the ground (ankle-local y -.1195).
 foot:[[-.1195,.088,.20,0,.08],[-.09,.094,.205,0,.08],[-.035,.09,.18,0,.065],[.015,.08,.12,0,.03],[.06,.072,.082,0,.008],[.10,.068,.072]],
 head:[[-.19,.07,.07,0,.055],[-.16,.11,.112,0,.042],[-.11,.134,.138,0,.028],[-.055,.143,.15,0,.018],[.01,.145,.156,0,.01],[.08,.148,.158,0,.004],[.15,.14,.15],[.205,.118,.128,0,-.006],[.245,.08,.088,0,-.01],[.27,.03,.034,0,-.01]]
};
// Upper arm split by colour at the sleeve hem; both share the hem ring so
// the shirt and skin meet flush. The sleeve top rounds over the shoulder.
const HEM=-.17;
const SLEEVE=[[.12,.05,.05],[.09,.085,.083],[.045,.103,.1],[0,.106,.102],[-.08,.104,.1],[HEM,.098,.096,0,.006]];
const UPPER_ARM_SKIN=[[HEM,.098,.096,0,.006],[-.24,.094,.094,0,.012],[-.33,.078,.078],[-.40,.07,.07]];
// The fist is centred on this grip point; weapons and tools attach to it (equipment-pose.js).
export const GRIP=[0,-.075,0];
const SIDES={limb:12,head:16,body:16};

// Rings may be listed top-down; loftGeometry needs them bottom-up for outward faces.
// Ends are rounded into soft domes within the piece's own length (no flat
// cut-off discs), unless an end must stay flat, e.g. a boot sole.
export function shell(T,rings,sides,{bottom=true,top=true}={}){
 let r=[...rings].sort((a,b)=>a[0]-b[0]).map(([y,rx,rz,cx=0,cz=0])=>[y,rx,rz,cx,cz]);
 const dome=(end,next,dir)=>{const [y,rx,rz,cx,cz]=end,d=Math.min(.5*Math.min(rx,rz),.45*Math.abs(next[0]-y));if(d<1e-4)return [end];
  // From full radius d inside the end, curving to a small tip at the end itself.
  return [0,.45,.8,1.15,1.4].map(a=>[y+dir*d*(1-Math.sin(a)),rx*Math.cos(a)+(a===1.4?.15*rx:0),rz*Math.cos(a)+(a===1.4?.15*rz:0),cx,cz])};
 if(r.length>1){
  const lo=bottom?dome(r[0],r[1],1).reverse():[r[0]],hi=top?dome(r.at(-1),r.at(-2),-1):[r.at(-1)];
  r=[...lo,...r.slice(1,-1),...hi];
 }
 return loftGeometry(T,r,sides);
}
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
 // Torso pivots at the waist, so leaning and impacts bend at the hips.
 const torso=new T.Bone();torso.name='humanoid-torso-pivot';torso.position.y=WAIST;bones.base.add(torso);

 const parts={},slots={helm:[],chest:[],legs:[],boots:[]};
 const add=(g,m,parent,name,cover,x=0,y=0,z=0)=>{const o=new T.Mesh(g,m);o.name='humanoid-'+name;o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=false;parent.add(o);parts[name]=o;if(cover)slots[cover].push(o);return o};
 const loft=(key,rings,sides)=>geo('loft:'+key,()=>shell(T,rings,sides));
 const ball=(r,sx=1,sy=1,sz=1)=>geo('ball:'+[r,sx,sy,sz],()=>{const g=new T.SphereGeometry(r,14,10);g.scale(sx,sy,sz);return g});

 // Arms and legs are single skinned meshes: each vertex blends between the
 // bones above and below a joint, so elbows, knees, shoulders and hips bend
 // smoothly instead of showing separate doll-like pieces.
 const skeletonBones=[bones.base,torso,bones.leftArm,bones.leftElbow,bones.leftHand,bones.rightArm,bones.rightElbow,bones.rightHand,bones.leftLeg,bones.leftKnee,bones.leftAnkle,bones.rightLeg,bones.rightKnee,bones.rightAnkle];
 const boneIndex=b=>skeletonBones.indexOf(b);
 const skinnedMeshes=[];
 const smooth=(a,b,y)=>{const t=Math.max(0,Math.min(1,(y-a)/(b-a)));return t*t*(3-2*t)};
 const skinnedGeo=(key,rings,ends,weights)=>geo('skin:'+key,()=>{const g=shell(T,rings,SIDES.limb,ends),p=g.attributes.position,idx=[],w=[];for(let i=0;i<p.count;i++){const list=weights(p.getY(i));for(let j=0;j<4;j++){idx.push(list[j]?.[0]??0);w.push(list[j]?.[1]??0)}}g.setAttribute('skinIndex',new T.Uint16BufferAttribute(idx,4));g.setAttribute('skinWeight',new T.Float32BufferAttribute(w,4));return g});
 const addSkinned=(g,m,name,cover)=>{const o=new T.SkinnedMesh(g,m);o.name='humanoid-'+name;o.castShadow=true;o.receiveShadow=false;o.frustumCulled=false;root.add(o);parts[name]=o;skinnedMeshes.push(o);if(cover)slots[cover].push(o);return o};
 const at=(rings,joint)=>rings.map(([y,rx,rz,cx=0,cz=0])=>[y+joint[1],rx,rz,cx+joint[0],cz+joint[2]]);

 add(loft('torso',PROFILES.torso,SIDES.body),shirt,torso,'shirt','chest');
 add(loft('hips',PROFILES.hips,SIDES.body),pants,bones.base,'hips','legs');
 add(geo('loft:belt',()=>shell(T,[[1.525,.258,.168,0,-.055],[1.59,.252,.163,0,-.055]],SIDES.body,{bottom:false,top:false})),belt,bones.base,'belt','legs');
 add(loft('neck',PROFILES.neck,12),skin,bones.base,'neck','helm');

 for(const side of ['left','right']){
  const s=side==='left'?1:-1,A=JOINTS[side+'Arm'],E=JOINTS[side+'Elbow'],L=JOINTS[side+'Leg'],K=JOINTS[side+'Knee'];
  const iArm=boneIndex(bones[side+'Arm']),iElbow=boneIndex(bones[side+'Elbow']),iTorso=boneIndex(torso),iLeg=boneIndex(bones[side+'Leg']),iKnee=boneIndex(bones[side+'Knee']),iBase=boneIndex(bones.base);
  // Arm: sleeve over the shoulder, then one bare arm through the elbow to the wrist.
  const armWeights=y=>{const e=smooth(E[1]+.07,E[1]-.07,y),t=smooth(A[1]+.02,A[1]+.12,y)*.45;return [[iArm,1-e-t],[iElbow,e],[iTorso,t]]};
  const armRings=[...at(UPPER_ARM_SKIN.slice(0,-1),A),[E[1],.072,.072,E[0],E[2]],...at(PROFILES.forearm.slice(1),E)];
  addSkinned(skinnedGeo('sleeve:'+side,at(SLEEVE,A),{bottom:false},armWeights),shirt,side+'Sleeve','chest');
  addSkinned(skinnedGeo('arm:'+side,armRings,{top:false},armWeights),skin,side+'Arm','chest');
  // Leg: thigh through the knee to the trouser hem, one continuous piece.
  const legWeights=y=>{const k=smooth(K[1]+.08,K[1]-.08,y),b=smooth(L[1]-.02,L[1]+.10,y)*.55;return [[iLeg,1-k-b],[iKnee,k],[iBase,b]]};
  const legRings=[...at(PROFILES.thigh.slice(0,-1),L),[K[1],.092,.095,K[0],K[2]+.004],...at(PROFILES.shin.slice(1),K)];
  addSkinned(skinnedGeo('leg:'+side,legRings,{},legWeights),pants,side+'Leg','legs');
  add(geo('loft:foot',()=>shell(T,PROFILES.foot,SIDES.limb,{bottom:false})),boots,bones[side+'Ankle'],side+'Foot','boots');
  // Hands: a relaxed open hand and a closed fist centred on the grip point.
  // Plain Object3D (not Group): held equipment is detected as Group children of the hand bone.
  const hand=new T.Object3D();hand.name='humanoid-'+side+'Hand';bones[side+'Hand'].add(hand);parts[side+'Hand']=hand;
  const open=new T.Object3D();open.name='open-hand';hand.add(open);
  const palm=new T.Mesh(geo('palm',()=>shell(T,[[.02,.05,.036],[-.04,.062,.04],[-.10,.062,.036],[-.16,.054,.028],[-.205,.034,.018]],12)),skin);palm.castShadow=true;open.add(palm);
  const thumb=new T.Mesh(geo('thumb',()=>shell(T,[[0,.02,.02],[-.04,.021,.02],[-.075,.014,.014]],10)),skin);thumb.position.set(-s*.055,-.035,.026);thumb.rotation.set(-.35,0,s*.45);thumb.castShadow=true;open.add(thumb);
  const fist=new T.Object3D();fist.name='fist';fist.position.fromArray(GRIP);fist.visible=false;hand.add(fist);
  const knuckles=new T.Mesh(geo('fist',()=>shell(T,[[-.08,.056,.05,0,.004],[-.045,.07,.064,0,.01],[.03,.072,.066,0,.01],[.068,.058,.054,0,.006]],14)),skin);knuckles.castShadow=true;fist.add(knuckles);
  const fistThumb=new T.Mesh(ball(.027,1,1.5,1),skin);fistThumb.position.set(-s*.05,.018,.038);fistThumb.rotation.z=s*.5;fist.add(fistThumb);
  hand.userData.grip={open,fist};
 }

 // Head: rounded skull with soft cheeks and chin, a rounded nose, gentle
 // almond eyes with lids that blink, brows, ears and a small mouth.
 const head=bones.head,face=look.face==='Broad'?'Broad':look.face==='Angular'?'Angular':'Balanced';
 const headRings=PROFILES.head.map(([y,rx,rz,cx=0,cz=0])=>[y,rx*(face==='Broad'?1.07:face==='Angular'&&y<-.05?.91:1),rz,cx,cz+(face==='Angular'&&y<-.1?.01:0)]);
 const faceMesh=add(geo('head:'+face,()=>shell(T,headRings,SIDES.head)),skin,head,'face','helm');faceMesh.name='character-face';
 const features=[faceMesh];
 // Front of the face at height y, so features sit on the skin rather than inside it.
 const frontZ=y=>{for(let i=0;i<headRings.length-1;i++){const [y0,,z0,,c0]=headRings[i],[y1,,z1,,c1]=headRings[i+1];if(y>=y0&&y<=y1){const t=(y-y0)/(y1-y0);return (z0+c0)*(1-t)+(z1+c1)*t}}return .16};
 const feature=(g,m,x,y,z,rx=0,ry=0,rz=0)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.castShadow=false;head.add(o);features.push(o);slots.helm.push(o);return o};
 // Nose: a soft bridge ending in a rounded tip.
 const nose=feature(geo('nose',()=>{const g=shell(T,[[-.04,.02,.02,0,.018],[-.02,.022,.022,0,.02],[.01,.014,.014,0,.008],[.05,.01,.01]],12);return g}),skin,0,-.005,frontZ(-.005)-.012);nose.rotation.x=-.08;
 const eyeX=face==='Broad'?.058:.053,lids=[];
 for(const x of [-eyeX,eyeX]){
  const ez=frontZ(.04)-.012;
  feature(ball(.024,1,.72,.5),eyeWhite,x,.04,ez).name='eye';
  feature(ball(.013,1,1.05,.5),iris,x,.039,ez+.009).name='iris';
  // Upper eyelid: rests just over the top of the iris and closes when blinking.
  const lid=feature(geo('eyelid',()=>{const g=new T.SphereGeometry(.0255,16,6,0,Math.PI*2,0,Math.PI/2);g.scale(1,.78,.56);return g}),lidColor,x,.04,ez+.0005);lid.name='eyelid';lid.userData.side=x;lids.push(lid);
  feature(geo('brow',()=>{const g=new T.CapsuleGeometry(.0085,.046,4,8);g.rotateZ(Math.PI/2);g.scale(1,1,.7);return g}),hair,x,.084,frontZ(.084)-.002,0,0,x>0?-.1:.1);
 }
 for(const s of [-1,1])feature(geo('ear',()=>{const g=new T.SphereGeometry(.034,12,8);g.scale(.42,1,.72);return g}),skin,s*(face==='Broad'?.153:.143),.02,-.005,0,s*.2,0);
 // Mouth: a gentle curved line with a hint of lower lip.
 feature(geo('mouth',()=>{const g=new T.TorusGeometry(.04,.0045,6,16,Math.PI*.42);g.rotateZ(Math.PI*1.29);g.scale(1,.55,.6);return g}),mat('mouth',mix(skinColor,0x3a1a14,.55),.8),0,-.068,frontZ(-.068)-.003);
 const lip=feature(geo('lip',()=>{const g=new T.SphereGeometry(.024,12,6);g.scale(1,.22,.3);return g}),lipColor,0,-.092,frontZ(-.092)-.006);lip.name='lower-lip';

 // Hair. Every style is built on a skull-hugging cap so it reads as hair,
 // not a hat; pieces follow the head bone and hide under a helmet.
 const style=HAIRSTYLE_SET.has(look.hair)?look.hair:'Side swept',hairMeshes=[];
 const piece=(m,key,make,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{const o=new T.Mesh(geo(key,make),m);o.position.set(x,y,z);o.rotation.set(rx,ry,rz);o.castShadow=true;head.add(o);hairMeshes.push(o);slots.helm.push(o);return o};
 const hairPiece=(...a)=>piece(hair,...a);
 const wide=face==='Broad'?1.07:1;
 const blob=(w,h,d,seg=12)=>()=>{const g=new T.SphereGeometry(1,seg,Math.max(6,seg*2/3|0));g.scale(w,h,d);return g};
 const cap=(k,pad)=>()=>shell(T,[[.075,.147*wide,.157,0,.004],[.11,.145*wide*(1+(k-1)*.5)+pad*.5,.155*(1+(k-1)*.5)+pad*.5,0,.002],...inflate(headRings.filter(r=>r[0]>=.15),k,pad)],SIDES.head,{bottom:false});
 const back=(k)=>()=>shell(T,[[-.11,.118*wide,.105,0,-.05],[-.02,.145*wide*k,.13,0,-.04],[.12,.148*wide*k,.14,0,-.03]],SIDES.head);
 const tilt=o=>o;
 // Point on the skull surface: polar angle from the crown, azimuth around it.
 const onSkull=(polar,azimuth,lift=0)=>{const r=.152+lift;return [Math.sin(polar)*Math.sin(azimuth)*r*wide,.075+Math.cos(polar)*r*1.25,Math.sin(polar)*Math.cos(azimuth)*r]};
 if(style==='Buzz cut'){tilt(hairPiece('hair-cap:buzz:'+face,cap(1.025,.002)));hairPiece('hair-back:buzz:'+face,back(1))}
 else if(style==='Mohawk'){
  // Shaved sides in a darker skin tone, with a tall crest down the middle.
  tilt(piece(mat('shaved',mix(skinColor,hairColor,.5),.95),'hair-cap:shaved:'+face,cap(1.015,.001)));
  for(let i=0;i<7;i++){const a=-.75+i*.3,[x,y,z]=onSkull(Math.abs(a),a<0?0:Math.PI,.01);hairPiece('hair-crest',blob(.028,.075,.05),x,y,z,a,0,0).userData.hairStrand=true}
 }
 else if(style!=='Bald'){
  tilt(hairPiece('hair-cap:'+face,cap(1.075,.008)));hairPiece('hair-back:'+face,back(1.03));
  if(style==='Side swept')hairPiece('hair-swept',blob(.12,.034,.065),.035,.172,.112,.35,0,-.25);
  if(style==='Short crop')hairPiece('hair-fringe',blob(.11,.026,.052),0,.165,.122,.4,0,0);
  if(style==='Spiky')for(let i=0;i<7;i++){const a=(i-3)*.32;hairPiece('hair-spike',()=>{const g=new T.ConeGeometry(.045,.12,10);g.translate(0,.055,0);return g},Math.sin(a)*.10,.205+Math.cos(a)*.03,.02+(i%2)*.05-.02,(i%2?.35:-.25),0,-a*.8).userData.hairStrand=true}
  if(style==='Curly')for(let i=0;i<22;i++){const polar=i<1?0:i<8?.5:i<16?.95:1.3,count=i<1?1:i<8?7:i<16?8:6,start=i<1?0:i<8?1:i<16?8:16,az=(i-start)/count*Math.PI*2+(i%2)*.3;if(polar>1.2&&Math.cos(az)>.3)continue;const [x,y,z]=onSkull(polar,az,.008);hairPiece('hair-curl',blob(.045,.04,.045,10),x,y,z)}
  if(style==='Long'){hairPiece('hair-long',()=>{const g=shell(T,[[-.34,.12,.05],[-.14,.152,.075],[.10,.162,.10]],16);g.translate(0,0,-.075);return g},0,0,-.055);hairPiece('hair-fringe',blob(.11,.026,.052),0,.165,.122,.4,0,0)}
  if(style==='Ponytail'){hairPiece('hair-tie',()=>new T.TorusGeometry(.03,.012,8,14),0,.09,-.165,0,0,0);hairPiece('hair-tail',()=>shell(T,[[-.30,.02,.022],[-.20,.045,.045],[-.06,.052,.052],[0,.04,.04]],12),0,.07,-.19,.25,0,0)}
 }
 // Facial hair. Every beard style is shaped to the jaw of the chosen face.
 const beard=BEARD_SET.has(look.beard)?look.beard:'Clean shaven';
 // A finer copy of the head surface lets beards follow a clean outline.
 const dense=[];for(let i=0;i<headRings.length-1;i++)for(let k=0;k<8;k++){const a=headRings[i],b=headRings[i+1],t=k/8;dense.push(a.map((v,j)=>v*(1-t)+(b[j]??0)*t))}dense.push(headRings.at(-1));
 const headGeo=geo('head-dense:'+face,()=>shell(T,dense,128));
 const facial=(key,keep,thick)=>()=>{key;const g=headGeo.clone(),p=g.attributes.position,n=g.attributes.normal,ix=g.index,kept=[];
  for(let t=0;t<ix.count;t+=3){const tri=[ix.getX(t),ix.getX(t+1),ix.getX(t+2)];if(tri.every(v=>keep(p.getX(v),p.getY(v),p.getZ(v))))kept.push(...tri)}
  for(let v=0;v<p.count;v++)p.setXYZ(v,p.getX(v)+n.getX(v)*thick,p.getY(v)+n.getY(v)*thick,p.getZ(v)+n.getZ(v)*thick);
  g.setIndex(kept);g.computeVertexNormals();return g};
 // Beard region: front of the jaw below a line that rises toward the ears,
 // leaving the lips clear.
 const beardLine=(x,y)=>y<-.035-.045*Math.cos(Math.min(1,Math.abs(x)/.13)*Math.PI/2);
 const lipsClear=(x,y)=>(x/.052)**2+((y+.078)/.032)**2>1;
 const moustache=()=>{for(const s of [-1,1])hairPiece('moustache',blob(.034,.012,.016),s*.03,-.052-.004,frontZ(-.052)-.002,0,s*.25,-s*.28)};
 if(beard==='Stubble')piece(mat('stubble',mix(skinColor,hairColor,.4),.95),'beard:stubble:'+face,facial('stubble',(x,y,z)=>z>-.03&&beardLine(x,y)&&lipsClear(x,y),.0015));
 if(beard==='Short beard'){hairPiece('beard:short:'+face,facial('short',(x,y,z)=>z>-.03&&beardLine(x,y)&&lipsClear(x,y),.011));moustache()}
 if(beard==='Full beard'){hairPiece('beard:full:'+face,facial('full',(x,y,z)=>z>-.05&&beardLine(x,y-.015)&&lipsClear(x,y),.02));hairPiece('beard:full-chin',blob(.085,.07,.06),0,-.19,.07);moustache()}
 if(beard==='Goatee'){hairPiece('beard:goatee:'+face,facial('goatee',(x,y,z)=>z>.04&&Math.abs(x)<.055&&y<-.105,.012));moustache()}
 if(beard==='Moustache')moustache();

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
 const LID_REST=-.15,LID_CLOSED=1.5;let blinkTimer=.8+Math.random()*3,blinkTime=-1;
 for(const lid of lids)lid.rotation.x=LID_REST;
 function tick(dt){if(!(dt>0))return;dt=Math.min(dt,.1);blinkTimer-=dt;if(blinkTimer<=0&&blinkTime<0){blinkTime=0;blinkTimer=2.2+Math.random()*3.8}
  let angle=LID_REST;if(blinkTime>=0){blinkTime+=dt;const t=Math.min(1,blinkTime/.14),closed=t<.45?t/.45:1-(t-.45)/.55;angle=LID_REST+(LID_CLOSED-LID_REST)*closed;if(t>=1){blinkTime=-1;angle=LID_REST}}
  for(const l of lids)l.rotation.x=angle}

 // Bind the skinned limbs in character-local space (see local-skinning.js) so
 // GPU precision is identical anywhere in the world, including on iPad.
 root.updateMatrixWorld(true);const skeleton=new T.Skeleton(skeletonBones);for(const m of skinnedMeshes)m.bind(skeleton,m.matrixWorld.clone());installLocalSkinning(T,root,skeleton,skinnedMeshes);
 const meshes={head:faceMesh,torso:parts.shirt,leftHand:parts.leftHand,rightHand:parts.rightHand,leftFoot:parts.leftFoot,rightFoot:parts.rightFoot};
 const lengths={arm:JOINTS.leftArm[1]-JOINTS.leftElbow[1],forearm:JOINTS.leftElbow[1]-JOINTS.leftHand[1],leg:JOINTS.leftLeg[1]-JOINTS.leftKnee[1],shin:JOINTS.leftKnee[1]-JOINTS.leftAnkle[1]};
 root.updateMatrixWorld(true);
 return {...bones,root,body:root,head,neck:bones.base,chestBone:bones.base,torso,
  // `skinned` historically meant "full-size authored proportions"; animation IK targets depend on it.
  skinned:true,skeleton,parts,meshes,face:faceMesh,faceMeshes:features,eyelids:lids,hairMeshes,clothingMeshes:[parts.shirt],bodySlots:slots,
  setHandGrip,setCoverage,coverage,solveArm,tick,armSplay:.16,
  upperOffset:.295,legScale:lengths.leg/.49,lowerLegScale:lengths.shin/.42,armScale:lengths.arm/.46,forearmScale:lengths.forearm/.33};
}

function sharedCache(T){const all=sharedCache.all||(sharedCache.all=new WeakMap());let c=all.get(T);if(!c){c=new Map();all.set(T,c)}return c}
function mix(a,b,t){const ch=(v,s)=>(v>>s)&255,m=s=>Math.round(ch(a,s)*(1-t)+ch(b,s)*t);return (m(16)<<16)|(m(8)<<8)|m(0)}
