import {surfaceTexture} from './surface-textures.js?v=release-20261107-hud142';
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
  broom(){const b=new T.Group();mesh(s.cyl,s.wood,b,[0,1.32,0],[.024,2.3,.024]);mesh(s.cyl,s.straw,b,[0,.16,0],[.15,.32,.07]);mesh(s.cyl,s.iron,b,[0,.33,0],[.06,.05,.05]);for(const x of [-.07,0,.07])mesh(s.box,s.straw,b,[x,.02,0],[.05,.06,.08]);return b},
  // A few soft puffs kicked up at the end of each stroke (own materials: each fades on its own).
  dust(){const d=new T.Group();d.userData.puffs=[0,1,2,3].map(()=>{const m=new T.MeshBasicMaterial({color:0xcdb98f,transparent:true,opacity:0,depthWrite:false});const o=new T.Mesh(s.ball,m);o.castShadow=false;d.add(o);return o});return d},
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
 rig.workKit=kit;
 // Townsfolk cross-fade clips with a soft start (animation.js): stopping to
 // work, kneeling and getting up again never snap the body between poses.
 rig.smoothFade=true;rig.townRoute=Array.isArray(profile.route)&&profile.route.length>1?profile.route:null;rig.workHome=profile.activity||null;
 return g;
}


// Turning on the spot: eased, and never faster than MAX_TURN rad/s, so a
// worker arriving at (or leaving) a station half a turn away from its path
// turns round instead of spinning or snapping.
export const MAX_TURN=3.6;
export function turnToward(from,to,dt){if(!Number.isFinite(from)||!(dt>0))return to;const d=Math.atan2(Math.sin(to-from),Math.cos(to-from)),m=Math.min(Math.abs(d)*(1-Math.exp(-dt/.14)),MAX_TURN*dt);return from+Math.sign(d)*m}

// Facing to present for a server-driven worker this frame. The realm pose
// (interpolateRealm) rewrites root.rotation.y every frame, but the work layer
// only runs on the character's LOD frames (every 2nd-3rd frame past ~20 m on a
// tablet): applying the station facing only then turned the whole body (and
// its broom/book, which live in root space) back and forth between the server
// yaw and the station every few frames. The caller keeps the station facing on
// every frame while the worker stands; a moving walker follows the server yaw.
// With the frame time, the walker turns from the station back onto its path
// (and toward a fresh server yaw) at a natural rate instead of in one frame.
export function workFacing(rig,yaw,moved=false,dt=0){const w=rig?.work,face=w?.yaw;if(!moved&&Number.isFinite(face)){if(w)w.shown=face;return face}
 if(!w||!(dt>0)){if(w)w.shown=yaw;return yaw}
 return w.shown=turnToward(w.shown,yaw,dt)}

// Pose helpers (all in the character's own frame: +Z forward, +X its left).
function poser(T){
 const v=new T.Vector3(),a=new T.Vector3(),c=new T.Vector3(),to=new T.Vector3(),q=new T.Quaternion(),wq=new T.Quaternion(),pq=new T.Quaternion(),id=new T.Quaternion(),rot=new T.Quaternion(),axis=new T.Vector3(),inv=new T.Matrix4(),up=new T.Vector3(0,1,0),partial=new T.Vector3();
 function turn(bone,rotation,weight){q.copy(id).slerp(rotation,weight);bone.getWorldQuaternion(wq);bone.parent.getWorldQuaternion(pq);bone.quaternion.copy(pq.invert().multiply(q).multiply(wq));bone.updateMatrixWorld(true)}
 return {
  point(rig,x,y,z,out=new T.Vector3()){return rig.root.localToWorld(out.set(x,y,z))},
  // Strength (0..1) of the work pose this frame (the eased job weight).
  e:1,
  // Two-bone reach by alternating swing (shoulder and elbow). A partial pose
  // reaches fully for a goal partway from where the clip holds the hand,
  // so the hand travels a straight, even path onto the work.
  reach(rig,side,goal){const b=rig.bones,hand=b['hand_'+side];if(this.e<1)goal=hand.getWorldPosition(partial).lerp(goal,this.e);for(let pass=0;pass<5;pass++)for(const bone of [b['lowerarm_'+side],b['upperarm_'+side]]){bone.getWorldPosition(c);hand.getWorldPosition(a).sub(c).normalize();to.copy(goal).sub(c).normalize();turn(bone,rot.setFromUnitVectors(a,to),1)}},
  // Rotate a bone about one of the character's axes (x: nod, y: turn).
  tilt(rig,bone,ax,angle,weight=this.e){rig.root.getWorldQuaternion(wq);axis.set(ax==='x'?1:0,ax==='y'?1:0,ax==='z'?1:0).applyQuaternion(wq);turn(bone,rot.setFromAxisAngle(axis,angle),weight)},
  // Place a root-space item at a world transform (copied from a hand).
  follow(rig,item,source){rig.root.updateMatrixWorld(true);inv.copy(rig.root.matrixWorld).invert();item.matrix.multiplyMatrices(inv,source.matrixWorld);item.matrix.decompose(item.position,item.quaternion,item.scale);},
  // Orient a root-space item so its +Y runs from `from` to `toward` (local points).
  aim(item,from,toward){item.position.copy(from);v.copy(toward).sub(from).normalize();item.quaternion.setFromUnitVectors(up,v);},
  // Root-space position of a bone or socket.
  local(rig,o,out=new T.Vector3()){return rig.root.worldToLocal(o.getWorldPosition(out))},
  v:()=>new T.Vector3(),q:()=>new T.Quaternion()
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

// Work poses are layered over the clip at the eased job weight: tilts are
// scaled by it, and each hand reaches fully for a goal that far along from
// where the clip holds it. (Weighting every IK pass instead compounded: a 7%
// weight already moved the hands a third of the way, so they snapped onto the
// broom in two or three frames. Blending solved bone rotations back toward the
// clip was no better: the solver's arm twist can differ between frames, so a
// half-blended arm jumped.)

export function animateWork(rig,kind,time,moving=false){
 const T=rig.T,p=poseKit(T),kit=rig.workKit,w=rig.work||(rig.work={weight:0,kind:null,last:time,yaw:null,shown:null,phase:Math.random()*10});
 const dt=Math.max(0,Math.min(.1,time-w.last));w.last=time;
 const want=currentWork(rig,kind,moving);let next=want.kind;
 // Talking needs a listener; alone, the person rests and looks about.
 if(SOCIAL.has(next)){let partner=null,best=3.4;for(const other of workers){if(other===rig||!other.root.visible||time-other.work.last>1||other.work.last-time>1)continue;const d=other.root.position.distanceTo(rig.root.position);if(d<best&&!other.movingNow){best=d;partner=other}}if(partner)want.face=Math.atan2(partner.root.position.x-rig.root.position.x,partner.root.position.z-rig.root.position.z);else next='watch'}
 rig.movingNow=moving;workers.add(rig);
 // Face the station (or the person being spoken to) while standing still.
 let facing=1;
 if(!moving&&Number.isFinite(want.face)){w.yaw=turnToward(w.yaw??rig.root.rotation.y,want.face,dt);rig.root.rotation.y=w.yaw;
  // Turn round first, then take up the work (no broom swinging through a half turn).
  const off=Math.abs(Math.atan2(Math.sin(want.face-w.yaw),Math.cos(want.face-w.yaw)));facing=Math.max(0,Math.min(1,(1.2-off)/.85))}else w.yaw=null;
 // Fade the old job out before the next one starts, so hands never snap.
 const k=1-Math.exp(-dt/.3);
 if(next!==w.kind){w.weight+=(0-w.weight)*k;if(w.weight<.06){w.weight=0;w.kind=next;w.since=time}}else w.weight+=((next?facing:0)-w.weight)*k;
 const job=w.kind,weight=w.weight,ease=smooth(Math.min(1,weight)),work=job&&pose[job];
 // A job may steer its clip (kneel once and keep working; an unhurried lift).
 const clipPhase=work?.clip&&!moving?work.clip(time-(w.since??time)):null;
 rig.setActivity?.(moving?null:job,clipPhase);
 const base=rig.workBaseZ??(rig.workBaseZ=rig.model.position.z);
 rig.model.position.z=base-(job==='sit'||job==='sitread'?.3*ease:0);
 if(!kit)return job;
 const shown=[];
 if(work&&weight>.001){rig.root.updateMatrixWorld(true);
  if(work.arms){p.e=ease;work.arms(rig,p,kit,time+w.phase);p.e=1}
  work.props?.(rig,p,kit,time+w.phase,ease,shown);
 }
 // A sweeper keeps the broom in hand between strokes and on the road.
 if(rig.workHome==='sweep'&&!(job==='broom'&&weight>.001))broomProp(rig,p,kit,time+w.phase,0,shown);
 kit.show(shown);
 return job;
}

// Sweeping: the bristles swing in a low arc in front of the feet, pressed on
// the stroke toward the left foot and lifted a hand's breadth on the way back.
// The top hand is the pivot near the chest; the lower hand pushes the handle;
// the spine twists with the stroke and the head watches the bristles. Feet,
// hips and the gameplay root never move.
export const SWEEP_PERIOD=1.6;
export function sweepStroke(t){const u=((t/SWEEP_PERIOD)%1+1)%1,a=u*Math.PI*2,s=Math.sin(a),c=Math.cos(a),angle=-.12+.5*s,lift=c<0?.08*c*c:0,R=1.3;
 return {u,s,c,angle,tip:[R*Math.sin(angle),.03+lift,R*Math.cos(angle)],grip:[.1*Math.sin(angle),1.94,.33]}}
const lerp3=(o,a,b,f)=>o.set(a.x+(b.x-a.x)*f,a.y+(b.y-a.y)*f,a.z+(b.z-a.z)*f);
function broomProp(rig,p,kit,t,e,shown){const broom=kit.get('broom');shown.push('broom');
 // Carried in the right fist, handle slanting forward and out (clear of the
 // head), bristles low behind the heel.
 const hand=p.local(rig,rig.rightHand),axis=p.v().set(-.3,1,.5).normalize(),carryTip=p.v().copy(hand).addScaledVector(axis,-1.1);
 if(e<=.001){p.aim(broom,carryTip,p.v().copy(carryTip).add(axis));return}
 // Lowering it to sweep (and lifting it back): bristles and handle top each
 // travel from the carry to the stroke, bowing out to the right so the
 // bristles pass outside the right leg and the handle clear of the face.
 const st=sweepStroke(t),tip=p.v().set(...st.tip),grip=p.v().set(...st.grip),bow=Math.sin(Math.PI*e);
 const top=p.v().copy(grip).sub(tip).normalize().multiplyScalar(2.3).add(tip),carryTop=p.v().copy(carryTip).addScaledVector(axis,2.3);
 const from=lerp3(p.v(),carryTip,tip,e).add(p.v().set(-.45*bow,.08*bow,.1*bow)),to=lerp3(p.v(),carryTop,top,e).add(p.v().set(-.25*bow,0,.15*bow));
 // The handle stays in the right fist all the way: slide the broom along its
 // own line onto the hand (no broom floating free while the arms blend).
 const dir=p.v().subVectors(to,from).normalize(),onLine=p.v().copy(from).addScaledVector(dir,p.v().subVectors(hand,from).dot(dir)),fix=p.v().subVectors(hand,onLine);
 from.add(fix);to.add(fix);if(from.y<.02){to.y+=.02-from.y;from.y=.02}
 p.aim(broom,from,to);
 // Dust: a few puffs where the stroke ends, rising and thinning out.
 const dust=kit.get('dust');shown.push('dust');const end=sweepStroke(SWEEP_PERIOD*.25).tip;
 dust.userData.puffs.forEach((puff,i)=>{const age=((st.u-.2-i*.05)%1+1)%1*SWEEP_PERIOD,f=age/.75,o=f<1?.3*e*(1-f)*Math.min(1,f*6):0;puff.visible=o>.01;puff.material.opacity=o;
  if(puff.visible){puff.position.set(end[0]+(i-1.5)*.07+.12*f,.05+.22*f+i*.02,end[2]+.08*f);puff.scale.setScalar(.05+.13*f)}});
}

// Handheld tools grow into the hand with the pose instead of popping in.
const held=(item,e)=>item.scale.setScalar(Math.max(.001,Math.min(1,e*1.4)));
const pt=(p,rig,x,y,z)=>p.point(rig,x,y,z);
const pose={
 broom:{arms(rig,p,kit,t){const b=rig.bones,st=sweepStroke(t),a=st.angle;
   p.tilt(rig,b.spine_01,'x',.1);p.tilt(rig,b.spine_02,'x',.14);
   p.tilt(rig,b.spine_01,'y',a*.22);p.tilt(rig,b.spine_02,'y',a*.3);p.tilt(rig,b.spine_03,'y',a*.2);
   p.tilt(rig,b.Head,'x',.26);p.tilt(rig,b.Head,'y',a*.25);
   const tip=p.v().set(...st.tip),grip=p.v().set(...st.grip),down=p.v().subVectors(tip,grip).normalize();
   p.reach(rig,'l',rig.root.localToWorld(p.v().copy(grip)));p.reach(rig,'r',rig.root.localToWorld(p.v().copy(grip).addScaledVector(down,.45)))},
  props(rig,p,kit,t,e,shown){broomProp(rig,p,kit,t,e,shown)}},
 hammer:{arms(rig,p,kit,t){const lift=hammerLift(t);
   p.tilt(rig,rig.bones.spine_02,'x',.22);p.tilt(rig,rig.bones.Head,'x',.3);
   p.reach(rig,'r',pt(p,rig,-.18-lift*.1,1.6+lift*.85,.38-lift*.3));p.reach(rig,'l',pt(p,rig,.2,1.52,.42))},
  props(rig,p,kit,t,e,shown){const anvil=kit.get('anvil'),hammer=kit.get('hammer'),tongs=kit.get('tongs');shown.push('hammer','tongs');if(e>.05)shown.push('anvil');
   const u=((t/1.35)%1+1)%1,lift=hammerLift(t),hand=p.local(rig,rig.bones.hand_r),strike=p.v().set(-.02,1.31,.6),raised=p.v().copy(hand).add(p.v().set(-.05,.25,-.35));
   p.aim(hammer,hand,p.v().copy(strike).lerp(raised,lift));held(hammer,e);
   const left=p.local(rig,rig.bones.hand_l);p.aim(tongs,left,p.v().set(.1,1.3,.6));held(tongs,e);
   const spark=anvil.userData.spark,flash=u>.7&&u<.84?1-(u-.7)/.14:0;spark.scale.setScalar(.001+flash*.12);spark.material.opacity=flash*.9;anvil.getObjectByName('bar').material.emissiveIntensity=1.4+flash*1.2}},
 haul:{arms(rig,p,kit,t){p.reach(rig,'l',pt(p,rig,.36,1.52,.5));p.reach(rig,'r',pt(p,rig,-.36,1.52,.5))},
  props(rig,p,kit,t,e,shown){const crate=kit.get('crate');if(e>.05)shown.push('crate');crate.position.set(0,1.62,.5);crate.rotation.set(-.08,0,0)}},
 ledger:{arms(rig,p,kit,t){p.tilt(rig,rig.bones.Head,'x',.32);p.reach(rig,'l',pt(p,rig,.2,1.68,.43));p.reach(rig,'r',pt(p,rig,-.2,1.68+Math.max(0,Math.sin(t*.7))*.04,.43))},
  props(rig,p,kit,t,e,shown){const book=kit.get('book');shown.push('book');book.position.set(0,1.74,.44);book.rotation.set(-.75,0,0);held(book,e)}},
 sitread:{arms(rig,p,kit,t){p.tilt(rig,rig.bones.Head,'x',.4);p.reach(rig,'l',pt(p,rig,.19,1.25,-.03));p.reach(rig,'r',pt(p,rig,-.19,1.25,-.03))},
  props(rig,p,kit,t,e,shown){const book=kit.get('book');shown.push('book');book.position.set(0,1.3,-.02);book.rotation.set(-.9,0,0);held(book,e)}},
 // Fixing_Kneeling kneels, works and stands up again every 5.2 s; looped as
 // is, the gardener bobbed up and down. Kneel once, then work the kneeling
 // middle of the clip back and forth (eased at each turn).
 garden:{clip:since=>since<KNEEL_IN?since/KNEEL_CLIP:(KNEEL_IN+KNEEL_WORK/2-KNEEL_WORK/2*Math.cos(Math.PI*(since-KNEEL_IN)/KNEEL_WORK))/KNEEL_CLIP,
  props(rig,p,kit,t,e,shown){const trowel=kit.get('trowel');kit.get('basket');shown.push('trowel');if(e>.05)shown.push('basket');p.follow(rig,trowel,rig.rightHand);held(trowel,e)}},
 // PickUp_Table is a 0.8 s grab; looped back to back it looked frantic. Lift
 // at an unhurried pace, then stand a moment before the next one.
 fetch:{clip:since=>{const u=(since%FETCH_CYCLE)/FETCH_LIFT;return u<1?smooth(u):0},
  props(rig,p,kit,t,e,shown){const bucket=kit.get('bucket');shown.push('bucket');rig.root.worldToLocal(rig.bones.hand_r.getWorldPosition(bucket.position));bucket.rotation.set(0,0,0);held(bucket,e)}},
 pray:{arms(rig,p,kit,t){p.tilt(rig,rig.bones.Head,'x',.42);p.reach(rig,'l',pt(p,rig,.04,1.86,.34));p.reach(rig,'r',pt(p,rig,-.04,1.86,.34))}},
 watch:{arms(rig,p,kit,t){p.tilt(rig,rig.bones.Head,'y',Math.sin(t*.45)*.55)}},
 rest:{arms(rig,p,kit,t){p.tilt(rig,rig.bones.Head,'y',Math.sin(t*.3)*.35)}},
 chat:{arms(rig,p,kit,t){p.tilt(rig,rig.bones.Head,'x',Math.sin(t*1.7)*.06)}},
 trade:{arms(rig,p,kit,t){p.tilt(rig,rig.bones.spine_03,'y',Math.sin(t*.5)*.25)}}
};
// Smith's hammer, 0 (on the work) .. 1 (raised): a slow lift, a short hold at
// the top, a quick but visible strike (about a fifth of a second, speeding up
// into the blow) and a beat resting on the iron.
export function hammerLift(t){const u=((t/1.35)%1+1)%1;return u<.5?smooth(u/.5):u<.56?1:u<.72?1-((u-.56)/.16)**2:0}
const KNEEL_CLIP=5.2,KNEEL_IN=1.2,KNEEL_WORK=2.7,FETCH_CYCLE=2.8,FETCH_LIFT=1.7;
