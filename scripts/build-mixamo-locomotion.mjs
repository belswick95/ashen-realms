// Bakes the owner's Adobe Mixamo walk and run (FBX Binary, "Without Skin",
// "In Place", mixamorig:* skeleton) onto our Quaternius rigs and writes
// assets/characters/mixamo-locomotion.glb: one clip per gait and body
// (Mixamo_Walk_male, Mixamo_Walk_female, Mixamo_Run_male, Mixamo_Run_female).
//
// usage: node scripts/build-mixamo-locomotion.mjs [Walking.fbx] [Running.fbx]
//   (defaults: assets/source/mixamo/Walking.fbx and Running.fbx)
//
// Retargeting: every mapped bone gets the source bone's world-space rotation
// change from its rest pose (both skeletons are in a T-pose, Y up, facing +Z),
// applied to our bone's own world rest rotation, then written back as a local
// rotation. So the limbs move exactly as authored on each body's own
// proportions. The hips' translation is scaled by leg length (hip joint to ankle)
// and the clip is seated so the planted ankle sits at the bind-pose ankle
// height (feet neither sink nor float). Nothing is restyled: no lean, no arm
// change, no stride change; the loops are only closed (last key = first key).
//
// Compact: 30 fps keys, near-redundant keys dropped (rotation error under
// ROT_TOL, hip translation under POS_TOL), rotations stored as normalized
// int16 quaternions (glTF allows this for animation outputs). Each clip's
// natural ground speed (how fast the planted foot moves back at playback
// rate 1, model units) is measured here and stored in the animation's extras
// so the game can play it at the rate that keeps the feet planted.
//
// FBX parsing is done here (not FBXLoader) because a Mixamo download can be
// truncated: Running.fbx from the owner ends inside the Objects block (no
// Connections). Mixamo writes its curves in a fixed order (Hips translation,
// then a rotation curve node per bone in skeleton order, X/Y/Z each); that
// order is checked against the Connections of any complete file, and used to
// recover the curve -> bone mapping of a truncated one.
import fs from 'node:fs';import path from 'node:path';import zlib from 'node:zlib';
import * as T from 'three';import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {Document,NodeIO} from '@gltf-transform/core';

const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..');
const [walkFile=path.join(root,'assets/source/mixamo/Walking.fbx'),runFile=path.join(root,'assets/source/mixamo/Running.fbx')]=process.argv.slice(2);
const OUT=path.join(root,'assets/characters/mixamo-locomotion.glb');
const FPS=30,ROT_TOL=.25*Math.PI/180,POS_TOL=.0008,TICKS=46186158000;

// ---------- FBX binary (7.x) ----------
function parseFbx(b){
 if(b.slice(0,18).toString('latin1')!=='Kaydara FBX Binary')throw Error('not an FBX Binary file');
 const ver=b.readUInt32LE(23),wide=ver>=7500,H=wide?25:13,rd=o=>wide?Number(b.readBigUInt64LE(o)):b.readUInt32LE(o);
 function props(o,n){const out=[];for(let i=0;i<n;i++){const t=String.fromCharCode(b[o++]);
  switch(t){case 'Y':out.push(b.readInt16LE(o));o+=2;break;case 'C':out.push(!!b[o]);o+=1;break;case 'I':out.push(b.readInt32LE(o));o+=4;break;case 'F':out.push(b.readFloatLE(o));o+=4;break;case 'D':out.push(b.readDoubleLE(o));o+=8;break;case 'L':out.push(b.readBigInt64LE(o));o+=8;break;
   case 'S':case 'R':{const l=b.readUInt32LE(o);o+=4;out.push(t==='S'?b.slice(o,o+l).toString('latin1'):b.slice(o,o+l));o+=l;break}
   case 'f':case 'd':case 'l':case 'i':case 'b':{const len=b.readUInt32LE(o),enc=b.readUInt32LE(o+4),cl=b.readUInt32LE(o+8);o+=12;let raw=b.slice(o,o+cl);o+=cl;if(enc===1)raw=zlib.inflateSync(raw);const sz={f:4,d:8,l:8,i:4,b:1}[t],arr=[];
    for(let k=0;k<len;k++){const p=k*sz;arr.push(t==='f'?raw.readFloatLE(p):t==='d'?raw.readDoubleLE(p):t==='l'?raw.readBigInt64LE(p):t==='i'?raw.readInt32LE(p):raw[p])}out.push(arr);break}
   default:throw Error('FBX property type '+t)}}return out}
 function node(o){const end=rd(o);if(end===0)return null;const np=rd(o+(wide?8:4)),pl=rd(o+(wide?16:8)),nl=b[o+H-1],po=o+H+nl;
  const n={name:b.slice(o+H,o+H+nl).toString('latin1'),props:[],children:[],end,truncated:end>b.length};
  if(po+pl>b.length){n.truncated=true;return n}n.props=props(po,np);
  for(let c=po+pl,stop=Math.min(end,b.length);c+H<=stop;){if(rd(c)===0)break;let ch;try{ch=node(c)}catch{n.truncated=true;break}if(!ch)break;if(ch.truncated){n.truncated=true;break}n.children.push(ch);c=ch.end}
  return n}
 const top=[];for(let o=27;o+H<b.length;){let n;try{n=node(o)}catch{break}if(!n)break;top.push(n);if(n.truncated)break;o=n.end}
 return top;
}
const kid=(n,name)=>n?.children.find(c=>c.name===name);
const p70=n=>{const out={};for(const p of kid(n,'Properties70')?.children||[])out[p.props[0]]=p.props.slice(4);return out};
const short=s=>s.split('\0')[0].replace(/^mixamorig\d*:/,'');

// The standard Mixamo skeleton (parents); leaf "_End"/"4" bones carry no curves.
const MIXAMO_PARENT={Hips:null,Spine:'Hips',Spine1:'Spine',Spine2:'Spine1',Neck:'Spine2',Head:'Neck',HeadTop_End:'Head'};
for(const S of ['Left','Right']){Object.assign(MIXAMO_PARENT,{[S+'Shoulder']:'Spine2',[S+'Arm']:S+'Shoulder',[S+'ForeArm']:S+'Arm',[S+'Hand']:S+'ForeArm',[S+'UpLeg']:'Hips',[S+'Leg']:S+'UpLeg',[S+'Foot']:S+'Leg',[S+'ToeBase']:S+'Foot',[S+'Toe_End']:S+'ToeBase'});
 for(const f of ['Thumb','Index','Middle','Ring','Pinky'])for(let i=1;i<=4;i++)MIXAMO_PARENT[S+'Hand'+f+i]=i===1?S+'Hand':S+'Hand'+f+(i-1)}
const leaf=n=>/_End$|\D4$/.test(n);

function readMixamo(file){
 const top=parseFbx(fs.readFileSync(file)),objs=top.find(n=>n.name==='Objects'),conns=top.find(n=>n.name==='Connections');
 if(!objs)throw Error(file+': no Objects block');
 const models=objs.children.filter(o=>o.name==='Model').map(m=>({id:m.props[0],name:short(m.props[1]),p:p70(m)}));
 const curves=objs.children.filter(o=>o.name==='AnimationCurve').map(c=>({id:c.props[0],t:kid(c,'KeyTime')?.props[0]||[],v:kid(c,'KeyValueFloat')?.props[0]||[]}));
 for(const m of models)if(!(m.name in MIXAMO_PARENT))throw Error(file+': not a Mixamo skeleton (bone '+m.name+')');
 // Mixamo's fixed curve order: Hips T, then R for every non-leaf bone in file order.
 const layout=[['Hips','T'],...models.filter(m=>!leaf(m.name)).map(m=>[m.name,'R'])];
 const channels={};layout.forEach(([bone,kind],k)=>{const c=curves.slice(3*k,3*k+3);if(c.length===3)channels[bone+'.'+kind]=c});
 if(conns&&!objs.truncated){// complete file: the layout must agree with the real connections
  const byId=new Map(objs.children.map(o=>[o.props[0],o])),links=new Map();for(const c of conns.children){const [,src,dst,prop]=c.props;if(!links.has(src))links.set(src,[]);links.get(src).push([dst,prop])}
  for(const [key,c] of Object.entries(channels)){const [bone,kind]=key.split('.');c.forEach((curve,axis)=>{const [node,prop]=(links.get(curve.id)||[])[0]||[];const cn=byId.get(node),model=(links.get(node)||[]).map(([d])=>byId.get(d)).find(o=>o?.name==='Model');
   if(!cn||short(cn.props[1])!==kind||prop!=='d|'+'XYZ'[axis]||!model||short(model.props[1])!==bone)throw Error(file+': curve layout differs from Mixamo order at '+key)})}
 }else console.warn(`${path.basename(file)}: truncated FBX (no Connections); curves mapped by Mixamo's fixed order (${Object.keys(channels).length} channels)`);
 if(Object.keys(channels).length!==layout.length)throw Error(file+': missing animation curves');
 const frames=Math.max(...curves.map(c=>c.v.length));
 for(const c of Object.values(channels).flat()){if(c.v.length!==1&&c.v.length!==frames)throw Error('uneven curve');if(c.v.length===frames)c.t.forEach((t,i)=>{if(Math.abs(Number(t)/TICKS*FPS-i)>.01)throw Error('curve keys are not 30 fps')})}
 // The last key should repeat the first (a closed Mixamo loop); report the seam and the hips drift.
 const seam=Math.max(...Object.entries(channels).filter(([k])=>k.endsWith('.R')).flatMap(([,c])=>c.map(x=>Math.abs(x.v[0]-x.v.at(-1))))),hips=channels['Hips.T'].map(c=>c.v);
 console.log(`${path.basename(file)}: ${frames} keys, rotation seam ${seam.toFixed(3)} deg, hips drift x ${(hips[0].at(-1)-hips[0][0]).toFixed(2)} z ${(hips[2].at(-1)-hips[2][0]).toFixed(2)} cm (range z ${(Math.max(...hips[2])-Math.min(...hips[2])).toFixed(2)} cm)`);
 return {models,channels,frames};
}

// Source skeleton as three.js bones. FBX euler order XYZ = three 'ZYX'; local = PreRotation * Rotation.
const rad=a=>(a||0)*Math.PI/180,eq=(r=[0,0,0])=>new T.Quaternion().setFromEuler(new T.Euler(rad(r[0]),rad(r[1]),rad(r[2]),'ZYX'));
function sourceSkeleton(src){const bones={};for(const m of src.models){const b=new T.Bone();b.name=m.name;b.position.fromArray(m.p['Lcl Translation']||[0,0,0]);b.userData.pre=eq(m.p.PreRotation);b.quaternion.copy(b.userData.pre).multiply(eq(m.p['Lcl Rotation']));bones[m.name]=b}
 for(const m of src.models){const p=MIXAMO_PARENT[m.name];if(p)bones[p].add(bones[m.name])}
 const top=new T.Group();top.add(bones.Hips);top.updateMatrixWorld(true);return {top,bones}}
function poseSource(src,sk,f){
 for(const [key,c] of Object.entries(src.channels)){const [bone,kind]=key.split('.'),v=c.map(x=>x.v.length===1?x.v[0]:x.v[f]),b=sk.bones[bone];
  if(kind==='T')b.position.fromArray(v);else b.quaternion.copy(b.userData.pre).multiply(eq(v))}
 sk.top.updateMatrixWorld(true)}

// Mixamo -> Quaternius (UE-style) bone names.
const MAP={Hips:'pelvis',Spine:'spine_01',Spine1:'spine_02',Spine2:'spine_03',Neck:'neck_01',Head:'Head'};
for(const [S,s] of [['Left','l'],['Right','r']]){Object.assign(MAP,{[S+'Shoulder']:'clavicle_'+s,[S+'Arm']:'upperarm_'+s,[S+'ForeArm']:'lowerarm_'+s,[S+'Hand']:'hand_'+s,[S+'UpLeg']:'thigh_'+s,[S+'Leg']:'calf_'+s,[S+'Foot']:'foot_'+s,[S+'ToeBase']:'ball_'+s});
 for(const f of ['Thumb','Index','Middle','Ring','Pinky'])for(let i=1;i<=3;i++)MAP[S+'Hand'+f+i]=`${f.toLowerCase()}_0${i}_${s}`}
const SOURCE_OF=Object.fromEntries(Object.entries(MAP).map(([a,b])=>[b,a]));

async function loadRig(sex){const b=fs.readFileSync(path.join(root,'assets/characters',`rig_${sex}.glb`));
 const g=await new Promise((res,rej)=>new GLTFLoader().parse(b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength),'',res,rej));
 const scene=g.scene,bones={};scene.traverse(o=>{if(o.name)bones[o.name]=o});scene.updateMatrixWorld(true);
 const order=[];bones.pelvis.traverse(o=>order.push(o));// parents before children
 const rest=new Map(order.map(o=>[o,{q:o.quaternion.clone(),p:o.position.clone(),w:o.getWorldQuaternion(new T.Quaternion())}]));
 return {scene,bones,order,rest}}

const wq=o=>o.getWorldQuaternion(new T.Quaternion()),wp=o=>o.getWorldPosition(new T.Vector3());
function retarget(src,rig,label){
 const sk=sourceSkeleton(src),{bones,order,rest,scene}=rig;
 for(const [o,r] of rest){o.quaternion.copy(r.q);o.position.copy(r.p)}scene.updateMatrixWorld(true);// bind pose
 // Same world frame? Both: Y up, +Z forward, character's left on +X.
 const check=(ok,what)=>{if(!ok)throw Error(label+': '+what)};
 check(wp(sk.bones.LeftArm).x>0&&wp(sk.bones.LeftToeBase).z>wp(sk.bones.LeftFoot).z-1,'Mixamo rest is not +Z forward / left on +X');
 check(wp(bones.upperarm_l).x>0&&wp(bones.ball_l).z>wp(bones.foot_l).z,'rig rest is not +Z forward / left on +X');
 const srcRest=Object.fromEntries(Object.entries(sk.bones).map(([n,b])=>[n,wq(b)]));
 const hipRest=wp(sk.bones.Hips),ankleS=wp(sk.bones.LeftFoot),pelvisRest=wp(bones.pelvis),ankleT=wp(bones.foot_l);
 const scale=(wp(bones.thigh_l).y-ankleT.y)/(wp(sk.bones.LeftUpLeg).y-ankleS.y),// leg length, hip joint to ankle
  rootQ=wq(bones.pelvis.parent),rootInv=rootQ.clone().invert();
 const footHeight=ankleT.y,frames=src.frames-1;// last Mixamo key repeats the first: the loop closes on it
 const tracks=new Map(order.filter(o=>SOURCE_OF[o.name]).map(o=>[o.name,[]])),pelvisPos=[];
 const world=new Map(),q=new T.Quaternion(),d=new T.Quaternion();
 for(let f=0;f<frames;f++){poseSource(src,sk,f);
  for(const o of order){const parent=o===bones.pelvis?rootQ:world.get(o.parent),s=SOURCE_OF[o.name];
   if(s){d.copy(wq(sk.bones[s])).multiply(srcRest[s].clone().invert());q.copy(d).multiply(rest.get(o).w);world.set(o,q.clone());o.quaternion.copy(parent.clone().invert().multiply(q)).normalize();tracks.get(o.name).push(o.quaternion.clone())}
   else{o.quaternion.copy(rest.get(o).q);world.set(o,parent.clone().multiply(o.quaternion))}}
  const hip=wp(sk.bones.Hips).sub(hipRest).multiplyScalar(scale).add(pelvisRest);pelvisPos.push(hip);
 }
 // Seat the clip: lowest ankle over the loop at the bind-pose ankle height.
 const ankles=[];for(let f=0;f<frames;f++){for(const o of order){if(tracks.has(o.name))o.quaternion.copy(tracks.get(o.name)[f])}bones.pelvis.position.copy(pelvisPos[f]).applyQuaternion(rootInv);scene.updateMatrixWorld(true);ankles.push({l:wp(bones.foot_l),r:wp(bones.foot_r),bl:wp(bones.ball_l),br:wp(bones.ball_r)})}
 const low=Math.min(...ankles.flatMap(a=>[a.l.y,a.r.y])),seat=footHeight-low;
 for(const p of pelvisPos)p.y+=seat;for(const a of ankles)for(const v of Object.values(a))v.y+=seat;
 // Natural ground speed: the ball of the planted foot (lowest 2.5 cm of its travel) moving backward.
 const dt=1/FPS;let sum=0,n=0,slip=0;
 for(const k of ['bl','br']){const ys=ankles.map(a=>a[k].y),lo=Math.min(...ys);for(let f=0;f<frames;f++){const g=(f+1)%frames;if(ys[f]<lo+.025&&ys[g]<lo+.025){sum+=-(ankles[g][k].z-ankles[f][k].z)/dt;slip+=Math.abs(ankles[g][k].x-ankles[f][k].x)/dt;n++}}}
 const groundSpeed=sum/n;
 const pelvis=pelvisPos.map(p=>p.clone().applyQuaternion(rootInv));
 console.log(`${label}: ${frames} frames (${(frames/FPS).toFixed(3)} s), hip scale ${scale.toFixed(4)}, seat ${seat.toFixed(4)}, ground speed ${groundSpeed.toFixed(4)} m/s (stride ${(groundSpeed*frames/FPS).toFixed(3)} m / cycle), sideways slip ${(slip/n).toFixed(4)} m/s`);
 return {tracks,pelvis,frames,groundSpeed,stride:groundSpeed*frames/FPS};
}

// Greedy key reduction on a closed loop: drop a key if interpolating its neighbours stays within tolerance
// of every original sample it would replace.
function reduce(values,lerp,error,tol){const n=values.length,keep=new Array(n).fill(true);
 for(let i=1;i<n-1;i++){keep[i]=false;let a=i-1;while(!keep[a])a--;let b=i+1;while(b<n-1&&!keep[b])b++;let ok=true;for(let j=a+1;j<b&&ok;j++)ok=error(lerp(values[a],values[b],(j-a)/(b-a)),values[j])<=tol;if(!ok)keep[i]=true}
 return keep.map((k,i)=>k?i:-1).filter(i=>i>=0)}
const qerr=(a,b)=>2*Math.acos(Math.min(1,Math.abs(a.dot(b)))),qlerp=(a,b,t)=>a.clone().slerp(b,t),perr=(a,b)=>a.distanceTo(b),plerp=(a,b,t)=>a.clone().lerp(b,t);

const sources={Walk:readMixamo(walkFile),Run:readMixamo(runFile)};
const doc=new Document(),buffer=doc.createBuffer(),scene=doc.createScene('mixamo-locomotion');
const nodes=new Map(),node=name=>{if(!nodes.has(name)){const n=doc.createNode(name);scene.addChild(n);nodes.set(name,n)}return nodes.get(name)};
const timeAcc=new Map(),times=idx=>{const key=idx.join(',');if(!timeAcc.has(key))timeAcc.set(key,doc.createAccessor().setType('SCALAR').setArray(new Float32Array(idx.map(i=>i/FPS))).setBuffer(buffer));return timeAcc.get(key)};
const summary={};
for(const sex of ['male','female']){const rig=await loadRig(sex);
 for(const [gait,src] of Object.entries(sources)){const name=`Mixamo_${gait}_${sex}`,r=retarget(src,rig,name),anim=doc.createAnimation(name);
  anim.setExtras({groundSpeed:+r.groundSpeed.toFixed(5),stride:+r.stride.toFixed(5),duration:r.frames/FPS,source:`Adobe Mixamo ${path.basename(gait==='Walk'?walkFile:runFile)}`});
  const add=(target,path_,idx,array,type,interp='LINEAR')=>{const out=doc.createAccessor().setType(type).setArray(array).setBuffer(buffer);if(array instanceof Int16Array)out.setNormalized(true);
   const s=doc.createAnimationSampler().setInput(times(idx)).setOutput(out).setInterpolation(interp);anim.addSampler(s).addChannel(doc.createAnimationChannel().setTargetNode(node(target)).setTargetPath(path_).setSampler(s))};
  let keys=0;
  for(const [bone,qs] of r.tracks){// one hemisphere along the track, closed loop
   for(let i=1;i<qs.length;i++)if(qs[i].dot(qs[i-1])<0)qs[i].set(-qs[i].x,-qs[i].y,-qs[i].z,-qs[i].w);
   const loop=[...qs,qs[0].dot(qs.at(-1))<0?qs[0].clone().set(-qs[0].x,-qs[0].y,-qs[0].z,-qs[0].w):qs[0].clone()];
   const spread=Math.max(...loop.map(x=>qerr(x,loop[0])));const idx=spread<ROT_TOL?[0]:reduce(loop,qlerp,qerr,ROT_TOL);
   const arr=new Int16Array(idx.length*4);idx.forEach((i,k)=>loop[i].toArray().forEach((v,c)=>arr[k*4+c]=Math.round(Math.max(-1,Math.min(1,v))*32767)));
   add(bone,'rotation',idx,arr,'VEC4');keys+=idx.length}
  const loopP=[...r.pelvis,r.pelvis[0].clone()],pidx=reduce(loopP,plerp,perr,POS_TOL);
  add('pelvis','translation',pidx,new Float32Array(pidx.flatMap(i=>loopP[i].toArray())),'VEC3');keys+=pidx.length;
  summary[name]={frames:r.frames,keys,groundSpeed:+r.groundSpeed.toFixed(4),stride:+r.stride.toFixed(4)};
 }}
doc.getRoot().getAsset().generator='scripts/build-mixamo-locomotion.mjs';
doc.getRoot().getAsset().extras={credit:'Animations: Adobe Mixamo (royalty-free for use in games). Retargeted onto the Quaternius rigs.'};
await new NodeIO().write(OUT,doc);
console.table(summary);console.log(path.relative(root,OUT),fs.statSync(OUT).size,'bytes');
