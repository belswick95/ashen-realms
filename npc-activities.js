import {surfaceTexture} from './surface-textures.js?v=release-20261106-perf90';
// Town work that reads as work. Every job pairs a base clip (animation.js
// ACTIVITY) with its own prop and a light procedural layer applied after the
// mixer: hands closed on a broom handle, a hammer striking a real anvil, a
// crate held in both arms, a ledger held open below the eyes. Nothing here
// moves the gameplay root; server routes stay authoritative and only the
// facing at a work station and the seated offset are presentation.

// Profile activity (server data) → internal work kind (animation clip key).
export const WORK_KINDS={smith:'hammer',sweep:'broom',carry:'haul',read:'ledger',garden:'garden',trade:'trade',cook:'trade',talk:'chat',sit:'sit',sitread:'sitread',fetch:'fetch',pray:'pray',watch:'watch',rest:'rest'};
// Work that needs another person nearby; alone it falls back to looking around.
const SOCIAL=new Set(['chat']);
const lerpAngle=(a,b,k)=>{let d=((b-a+Math.PI)%(Math.PI*2)+Math.PI*2)%(Math.PI*2)-Math.PI;return a+d*k};
const smooth=u=>u*u*(3-2*u);

const kitCache=new WeakMap();
function shared(T){
 let s=kitCache.get(T);if(s)return s;
 const tex=(kind,color)=>surfaceTexture(T,kind,color);
 const std=(color,kind,extra={})=>{const m=new T.MeshStandardMaterial({color:kind?0xffffff:color,map:kind?tex(kind,color):null,roughness:.86,...extra});m.userData.eldervaleShared=true;return m};
 const geo=g=>{g.userData.eldervaleShared=true;return g};
 s={
  wood:std(0x83603d,'wood'),darkWood:std(0x56402b,'wood'),straw:std(0xc8a457,'cloth'),cloth:std(0x8a6b4a,'cloth'),
  iron:std(0x3b3f43,null,{roughness:.42,metalness:.78}),steel:std(0x8e979c,null,{roughness:.32,metalness:.85}),
  hot:std(0xffa040,null,{emissive:0xff5a12,emissiveIntensity:1.8,roughness:.5}),spark:new T.MeshBasicMaterial({color:0xffd27a,transparent:true,opacity:.9,depthWrite:false,blending:T.AdditiveBlending}),
  paper:std(0xeee3c6,'cloth'),cover:std(0x7a2f28,'cloth'),leather:std(0x5d3a24,'cloth'),soil:std(0x4c3524,'cloth'),leaf:std(0x4f7a3a,null),
  petals:[0xd65a6a,0xf0c94a,0xf2f0e6,0x9d6ad6].map(c=>std(c,null)),produce:[0xb3342a,0x78a243,0xc58d4b].map(c=>std(c,null)),water:std(0x5f95a8,null,{roughness:.15,metalness:.1}),
  box:geo(new T.BoxGeometry(1,1,1)),cyl:geo(new T.CylinderGeometry(1,1,1,10)),cone:geo(new T.CylinderGeometry(0,1,1,10)),ball:geo(new T.SphereGeometry(1,8,6))
 };
 s.spark.userData.eldervaleShared=true;kitCache.set(T,s);return s;
}

// Props are created on first use and live in one group under the NPC root,
// so the caller can hide the whole kit (conversation, combat) in one switch.
export function createWorkKit(T,rig,profile={}){
 const s=shared(T),g=new T.Group();g.name='work-kit';g.userData.heldWorkProp=true;rig.root.add(g);
 const items={};
 const mesh=(geometry,material,parent,[x,y,z],[sx,sy,sz],rot)=>{const o=new T.Mesh(geometry,material);o.position.set(x,y,z);o.scale.set(sx,sy,sz);if(rot)o.rotation.set(...rot);o.castShadow=true;parent.add(o);return o};
 const make={
  // Pivot at the bristle tip, handle along +Y.
  broom(){const b=new T.Group();mesh(s.cyl,s.wood,b,[0,1.17,0],[.024,2.0,.024]);mesh(s.cyl,s.straw,b,[0,.16,0],[.15,.32,.07]);mesh(s.cyl,s.iron,b,[0,.33,0],[.06,.05,.05]);for(const x of [-.07,0,.07])mesh(s.box,s.straw,b,[x,.02,0],[.05,.06,.08]);return b},
  // Held at the grip; head across the top of the handle.
  hammer(){const h=new T.Group();mesh(s.cyl,s.darkWood,h,[0,.16,0],[.022,.42,.022]);mesh(s.box,s.iron,h,[0,.38,0],[.09,.09,.22]);return h},
  tongs(){const t=new T.Group();for(const x of [-.018,.018])mesh(s.box,s.iron,t,[x,.2,0],[.014,.48,.02],[0,0,x*4]);return t},
  // Face at knuckle height (≈1.25) in front of the smith, horn to its left.
  anvil(){const a=new T.Group();a.position.set(-.04,0,.6);a.scale.set(1,1.04,1);mesh(s.cyl,s.darkWood,a,[0,.42,0],[.26,.84,.26]);for(const y of [.12,.74])mesh(s.cyl,s.iron,a,[0,y,0],[.27,.03,.27]);
   mesh(s.box,s.iron,a,[0,.9,0],[.26,.12,.2]);mesh(s.box,s.iron,a,[0,1.02,0],[.16,.14,.13]);mesh(s.box,s.iron,a,[-.02,1.16,0],[.5,.14,.2]);mesh(s.cone,s.iron,a,[.34,1.17,0],[.07,.2,.07],[0,0,-Math.PI/2]);
   const bar=mesh(s.box,s.hot,a,[.02,1.245,0],[.26,.03,.045]);bar.name='bar';const spark=new T.Mesh(s.ball,s.spark);spark.position.set(.02,1.28,0);spark.scale.setScalar(.001);a.add(spark);a.userData.spark=spark;
   // Quench bucket beside the block.
   mesh(s.cyl,s.wood,a,[-.66,.24,.1],[.2,.48,.2]);for(const y of [.08,.4])mesh(s.cyl,s.iron,a,[-.66,y,.1],[.205,.025,.205]);mesh(s.cyl,s.water,a,[-.66,.46,.1],[.18,.02,.18]);return a},
  crate(){const c=new T.Group();mesh(s.box,s.wood,c,[0,0,0],[.62,.42,.42]);for(const y of [-.15,.15])mesh(s.box,s.darkWood,c,[0,y,.213],[.64,.06,.02]);for(const x of [-.29,.29])mesh(s.box,s.darkWood,c,[x,0,0],[.05,.44,.44]);
   for(let i=0;i<6;i++)mesh(s.ball,s.produce[i%3],c,[-.2+(i%3)*.2,.24+(i>2?.03:0),i>2?.08:-.07],[.075,.065,.075]);return c},
  book(){const b=new T.Group();for(const side of [-1,1]){const page=new T.Group();page.rotation.y=side*.32;b.add(page);mesh(s.box,s.cover,page,[side*.12,0,-.012],[.25,.33,.014]);mesh(s.box,s.paper,page,[side*.115,0,.002],[.23,.31,.018])}return b},
  trowel(){const t=new T.Group();mesh(s.cyl,s.darkWood,t,[0,.06,0],[.018,.14,.018]);mesh(s.box,s.steel,t,[0,.19,0],[.07,.13,.01]);return t},
  basket(){const b=new T.Group();b.position.set(-.48,0,.62);mesh(s.cyl,s.straw,b,[0,.13,0],[.2,.26,.2]);mesh(s.cyl,s.soil,b,[0,.26,0],[.18,.02,.18]);
   for(let i=0;i<7;i++){const a=i*2.4,r=.04+(i%3)*.04;mesh(s.cyl,s.leaf,b,[Math.cos(a)*r,.33,Math.sin(a)*r],[.012,.14,.012]);mesh(s.ball,s.petals[i%4],b,[Math.cos(a)*r,.41,Math.sin(a)*r],[.045,.035,.045])}
   // A freshly turned bed in front of the knees.
   mesh(s.box,s.soil,b,[.5,.02,.18],[.9,.04,.5]);for(let i=0;i<4;i++){mesh(s.cyl,s.leaf,b,[.2+i*.2,.1,.18],[.012,.16,.012]);mesh(s.ball,s.petals[(i+1)%4],b,[.2+i*.2,.19,.18],[.05,.04,.05])}return b},
  bucket(){const b=new T.Group();mesh(s.cyl,s.wood,b,[0,-.18,0],[.13,.24,.13]);for(const y of [-.27,-.1])mesh(s.cyl,s.iron,b,[0,y,0],[.135,.025,.135]);mesh(s.cyl,s.water,b,[0,-.07,0],[.12,.01,.12]);return b}
 };
 const kit={group:g,items,
  get(name){if(!items[name]){items[name]=make[name]();g.add(items[name])}return items[name]},
  show(names){for(const [name,item] of Object.entries(items))item.visible=names.includes(name)}};
 rig.workKit=kit;rig.townRoute=Array.isArray(profile.route)&&profile.route.length>1?profile.route:null;rig.workHome=profile.activity||null;
 return g;
}

// Pose helpers (all in the character's own frame: +Z forward, +X its left).
function poser(T){
 const v=new T.Vector3(),a=new T.Vector3(),c=new T.Vector3(),to=new T.Vector3(),q=new T.Quaternion(),wq=new T.Quaternion(),pq=new T.Quaternion(),id=new T.Quaternion(),rot=new T.Quaternion(),axis=new T.Vector3(),inv=new T.Matrix4();
 function turn(bone,rotation,weight){q.copy(id).slerp(rotation,weight);bone.getWorldQuaternion(wq);bone.parent.getWorldQuaternion(pq);bone.quaternion.copy(pq.invert().multiply(q).multiply(wq));bone.updateMatrixWorld(true)}
 return {
  point(rig,x,y,z,out=new T.Vector3()){return rig.root.localToWorld(out.set(x,y,z))},
  // Two-bone reach by alternating swing (shoulder and elbow), weighted.
  reach(rig,side,goal,weight){const b=rig.bones,hand=b['hand_'+side];for(let pass=0;pass<5;pass++)for(const bone of [b['lowerarm_'+side],b['upperarm_'+side]]){bone.getWorldPosition(c);hand.getWorldPosition(a).sub(c).normalize();to.copy(goal).sub(c).normalize();turn(bone,rot.setFromUnitVectors(a,to),weight)}},
  // Rotate a bone about one of the character's axes (x: nod, y: turn).
  tilt(rig,bone,ax,angle,weight){rig.root.getWorldQuaternion(wq);axis.set(ax==='x'?1:0,ax==='y'?1:0,ax==='z'?1:0).applyQuaternion(wq);turn(bone,rot.setFromAxisAngle(axis,angle),weight)},
  // Place a root-space item at a world transform (copied from a hand).
  follow(rig,item,source){rig.root.updateMatrixWorld(true);inv.copy(rig.root.matrixWorld).invert();item.matrix.multiplyMatrices(inv,source.matrixWorld);item.matrix.decompose(item.position,item.quaternion,item.scale);},
  // Orient a root-space item so its +Y runs from `from` to `toward` (local points).
  aim(item,from,toward){item.position.copy(from);v.copy(toward).sub(from).normalize();item.quaternion.setFromUnitVectors(a.set(0,1,0),v);},
  v:()=>new T.Vector3()
 };
}
const posers=new WeakMap();
function poseKit(T){let p=posers.get(T);if(!p){p=poser(T);posers.set(T,p)}return p}

// Everyone currently working in view, for conversation partners.
const workers=new Set();

// Pick what the person is doing right now from their route and position.
export function currentWork(rig,kind,moving){
 const route=rig.townRoute;let stop=null;
 // A work station within reach wins over a corner of the path beside it.
 if(route){const p=rig.root.position;let best=Infinity;route.forEach((s,i)=>{const d=Math.hypot(s.x-p.x,s.z-p.z)+(s.act?0:.6);if(d<best&&d<1.1){best=d;stop={...s,index:i}}});
  if(stop&&!moving)rig.lastStop=stop.index;}
 if(moving){const hold=route?route[rig.lastStop??-1]?.hold:kind==='carry'?'crate':null;return {kind:hold==='crate'?'haul':null,moving:true}}
 if(route)return stop?{kind:WORK_KINDS[stop.act]||null,face:Number.isFinite(stop.face)?stop.face:null}:{kind:'rest'};
 return {kind:WORK_KINDS[kind]||null};
}

export function animateWork(rig,kind,time,moving=false){
 const T=rig.T,p=poseKit(T),kit=rig.workKit,w=rig.work||(rig.work={weight:0,kind:null,last:time,yaw:null,phase:Math.random()*10});
 const dt=Math.max(0,Math.min(.1,time-w.last));w.last=time;
 const want=currentWork(rig,kind,moving);let next=want.kind;
 // Talking needs a listener; alone, the person rests and looks about.
 if(SOCIAL.has(next)){let partner=null,best=3.4;for(const other of workers){if(other===rig||!other.root.visible||time-other.work.last>1||other.work.last-time>1)continue;const d=other.root.position.distanceTo(rig.root.position);if(d<best&&!other.movingNow){best=d;partner=other}}if(partner)want.face=Math.atan2(partner.root.position.x-rig.root.position.x,partner.root.position.z-rig.root.position.z);else next='watch'}
 rig.movingNow=moving;workers.add(rig);
 // Fade the old job out before the next one starts, so hands never snap.
 const k=1-Math.exp(-dt/.22);
 if(next!==w.kind){w.weight+=(0-w.weight)*k;if(w.weight<.04){w.weight=0;w.kind=next}}else w.weight+=((next?1:0)-w.weight)*k;
 const job=w.kind,weight=w.weight;
 rig.setActivity?.(moving?null:job);
 // Face the station (or the person being spoken to) while standing still.
 if(!moving&&Number.isFinite(want.face)){w.yaw=lerpAngle(w.yaw??rig.root.rotation.y,want.face,1-Math.exp(-dt/.35));rig.root.rotation.y=w.yaw}else w.yaw=null;
 const base=rig.workBaseZ??(rig.workBaseZ=rig.model.position.z);
 rig.model.position.z=base-(job==='sit'||job==='sitread'?.3*weight:0);
 if(!kit)return job;
 const shown=[];
 if(job&&weight>.001){rig.model.updateMatrixWorld(true);pose[job]?.(rig,p,kit,time+w.phase,weight,shown)}
 kit.show(weight>.05?shown:[]);
 return job;
}

const pt=(p,rig,x,y,z)=>p.point(rig,x,y,z);
const pose={
 broom(rig,p,kit,t,w,shown){const broom=kit.get('broom');shown.push('broom');
  // Bristles sweep an arc on the ground; the upper hand guides the handle
  // and the lower hand closes on it a forearm's length further down.
  const sweep=Math.sin(t*2.6);p.tilt(rig,rig.bones.spine_02,'y',sweep*.18,w);p.tilt(rig,rig.bones.spine_02,'x',.16,w);
  const tip=p.v().set(-.1+sweep*.45,.04,.92+Math.abs(sweep)*.05);
  p.reach(rig,'l',pt(p,rig,.08+sweep*.1,1.84,.2),w);
  const l=rig.root.worldToLocal(rig.bones.hand_l.getWorldPosition(p.v())),down=p.v().subVectors(tip,l).normalize();
  p.reach(rig,'r',rig.root.localToWorld(p.v().copy(l).addScaledVector(down,.42)),w);
  // Fade the prop in with the pose: it starts upright beside the body.
  const top=p.v().copy(l).addScaledVector(down,-.12);tip.lerp(p.v().set(-.45,.04,.25),1-w);top.lerp(p.v().set(-.45,1.9,.25),1-w);p.aim(broom,tip,top);},
 hammer(rig,p,kit,t,w,shown){const anvil=kit.get('anvil'),hammer=kit.get('hammer'),tongs=kit.get('tongs');shown.push('anvil','hammer','tongs');
  // Raise slowly, strike fast, let the hammer rest a beat on the work.
  const u=(t/1.35)%1,lift=u<.58?smooth(u/.58):u<.68?1-((u-.58)/.1)**2:0;
  p.tilt(rig,rig.bones.spine_02,'x',.22,w);p.tilt(rig,rig.bones.Head,'x',.3,w);
  p.reach(rig,'r',pt(p,rig,-.18-lift*.1,1.6+lift*.85,.38-lift*.3),w);p.reach(rig,'l',pt(p,rig,.2,1.52,.42),w);
  const hand=rig.root.worldToLocal(rig.bones.hand_r.getWorldPosition(p.v())),strike=p.v().set(-.02,1.31,.6),raised=p.v().copy(hand).add(p.v().set(-.05,.25,-.35));
  p.aim(hammer,hand,p.v().copy(strike).lerp(raised,lift));
  const left=rig.root.worldToLocal(rig.bones.hand_l.getWorldPosition(p.v()));p.aim(tongs,left,p.v().set(.1,1.3,.6));
  const spark=anvil.userData.spark,flash=u>.66&&u<.8?1-(u-.66)/.14:0;spark.scale.setScalar(.001+flash*.12);spark.material.opacity=flash*.9;anvil.getObjectByName('bar').material.emissiveIntensity=1.4+flash*1.2;},
 haul(rig,p,kit,t,w,shown){const crate=kit.get('crate');shown.push('crate');crate.position.set(0,1.62,.5);crate.rotation.set(-.08,0,0);
  p.reach(rig,'l',pt(p,rig,.36,1.52,.5),w);p.reach(rig,'r',pt(p,rig,-.36,1.52,.5),w);},
 ledger(rig,p,kit,t,w,shown){const book=kit.get('book');shown.push('book');book.position.set(0,1.74,.44);book.rotation.set(-.75,0,0);
  p.tilt(rig,rig.bones.Head,'x',.32,w);p.reach(rig,'l',pt(p,rig,.2,1.68,.43),w);p.reach(rig,'r',pt(p,rig,-.2,1.68+Math.max(0,Math.sin(t*.7))*.04,.43),w);},
 sitread(rig,p,kit,t,w,shown){const book=kit.get('book');shown.push('book');book.position.set(0,1.3,-.02);book.rotation.set(-.9,0,0);
  p.tilt(rig,rig.bones.Head,'x',.4,w);p.reach(rig,'l',pt(p,rig,.19,1.25,-.03),w);p.reach(rig,'r',pt(p,rig,-.19,1.25,-.03),w);},
 garden(rig,p,kit,t,w,shown){const trowel=kit.get('trowel');kit.get('basket');shown.push('trowel','basket');p.follow(rig,trowel,rig.rightHand);},
 fetch(rig,p,kit,t,w,shown){const bucket=kit.get('bucket');shown.push('bucket');rig.root.worldToLocal(rig.bones.hand_r.getWorldPosition(bucket.position));bucket.rotation.set(0,0,0);},
 pray(rig,p,kit,t,w){p.tilt(rig,rig.bones.Head,'x',.42,w);p.reach(rig,'l',pt(p,rig,.04,1.86,.34),w);p.reach(rig,'r',pt(p,rig,-.04,1.86,.34),w);},
 watch(rig,p,kit,t,w){p.tilt(rig,rig.bones.Head,'y',Math.sin(t*.45)*.55,w)},
 rest(rig,p,kit,t,w){p.tilt(rig,rig.bones.Head,'y',Math.sin(t*.3)*.35,w)},
 chat(rig,p,kit,t,w){p.tilt(rig,rig.bones.Head,'x',Math.sin(t*1.7)*.06,w)},
 trade(rig,p,kit,t,w){p.tilt(rig,rig.bones.spine_03,'y',Math.sin(t*.5)*.25,w)}
};
