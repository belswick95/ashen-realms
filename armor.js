import {PROFILES,inflate,shell,GRIP} from './humanoid.js?v=release-20261104-lowpoly54';
// Plate armor in Eldervale's chunky style: large draping pauldrons, a
// sculpted one-piece breastplate with a flared hip skirt, matte steel. Every piece is an
// inflated copy of the body part it covers, parented to that part's bone, so
// it always fits and always follows the animation.
// Returns {helm,chest,legs,boots}: arrays of meshes, all hidden.
export function buildPlateArmor(T,body,rig){
 const caches=buildPlateArmor.caches||(buildPlateArmor.caches=new WeakMap());let cache=caches.get(T);if(!cache){cache=new Map();caches.set(T,cache)}
 const material=(name,color,metalness=.12,roughness=.62)=>{if(!cache.has('mat:'+name)){const m=new T.MeshStandardMaterial({color,metalness,roughness});m.userData.eldervaleShared=true;cache.set('mat:'+name,m)}return cache.get('mat:'+name)};
 const steel=material('steel',0x7d91a0),edge=material('edge',0x8fa2b0,.14,.58),dark=material('recess',0x15191c,.1,.8),leather=material('leather',0x5b4332,0,.85),strap=material('strap',0x3d2a1e,0,.85),crest=material('crest',0x9b2f2f,0,.85);
 const geo=(key,make)=>{if(!cache.has(key)){const g=make();g.userData.armorPiece=key.replace(/^loft:/,'');g.computeBoundingSphere();g.userData.eldervaleShared=true;cache.set(key,g)}return cache.get(key)};
 const loft=(key,rings,sides=14,ends)=>geo('loft:'+key,()=>shell(T,rings,sides,ends));
 const dome=(key,r,sx,sy,sz,cap=Math.PI/2)=>geo(key,()=>{const g=new T.SphereGeometry(r,18,10,0,Math.PI*2,0,cap);g.scale(sx,sy,sz);return g});
 const slots={helm:[],chest:[],legs:[],boots:[]};
 const add=(g,m,parent,slot,x=0,y=0,z=0)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=false;o.userData.armorSlot=slot;parent.add(o);slots[slot].push(o);return o};
 const torso=rig.torso||rig.base;

 // Helm: a rounded closed helm with a raised brow, a split visor and a short
 // crest. It lives on the head bone so it follows every nod.
 const helmet=new T.Group();helmet.name='armor-helm';rig.head.add(helmet);
 add(loft('helm',[[-.235,.11,.12,0,.035],[-.19,.15,.16,0,.025],...inflate(PROFILES.head.slice(3,9),1.13,.014),[.27,.05,.055,0,-.01],[.29,.012,.012]],18),steel,helmet,'helm');
 add(loft('helm-brow',[[.085,.168,.178,0,.012],[.12,.165,.175,0,.008]],18),edge,helmet,'helm');
 for(const y of [.045,.008])add(geo('visor-slit',()=>{const g=new T.CapsuleGeometry(.011,.15,4,8);g.rotateZ(Math.PI/2);g.scale(1,1,.6);return g}),dark,helmet,'helm',0,y,.197);
 add(geo('visor-ridge',()=>{const g=new T.CapsuleGeometry(.014,.2,4,8);g.scale(1,1,.8);return g}),edge,helmet,'helm',0,-.06,.196);
 for(const s of [-1,1])add(geo('rivet',()=>new T.SphereGeometry(.014,8,6)),edge,helmet,'helm',s*.165,.03,.04);
 const plume=add(geo('crest',()=>{const g=new T.CylinderGeometry(.12,.12,.04,16,1,false,-Math.PI/2,Math.PI);g.rotateZ(Math.PI/2);g.scale(1,.8,1);return g}),crest,helmet,'helm',0,.24,-.03);plume.rotation.x=-.12;
 add(loft('gorget',[[2.25,.16,.13,0,-.04],[2.32,.14,.12,0,-.035],[2.40,.105,.10,0,-.025]],16),steel,rig.base,'helm');

 // Chest: one-piece breastplate following the chest, and a flared hip skirt.
 add(loft('cuirass',[...inflate(PROFILES.torso.slice(0,7),1.07,.016),[.69,.20,.13,0,-.055]],18),steel,torso,'chest');
 add(loft('cuirass-collar',[[.66,.215,.145,0,-.05],[.73,.15,.115,0,-.05]],16),edge,torso,'chest');
   add(loft('tasset',[[1.27,.33,.24,0,-.055],[1.38,.305,.218,0,-.055],[1.50,.27,.19,0,-.055],[1.58,.255,.178,0,-.055]],20),steel,rig.base,'chest');
 add(loft('tasset-rim',[[1.265,.335,.245,0,-.055],[1.30,.33,.24,0,-.055]],20,{bottom:false,top:false}),edge,rig.base,'chest');
 for(const side of ['left','right']){
  const s=side==='left'?1:-1,arm=rig[side+'Arm'],elbow=rig[side+'Elbow'];
  // Large pauldron that drapes down and outward over the upper arm.
  const shoulder=new T.Group();shoulder.rotation.z=s*.42;shoulder.position.set(s*.02,.0,0);arm.add(shoulder);
  add(loft('pauldron',[[-.20,.17,.16],[-.12,.192,.18],[-.02,.19,.178],[.06,.15,.142],[.11,.07,.07]],20,{bottom:false}),steel,shoulder,'chest');
  add(loft('pauldron-rim',[[-.215,.176,.166],[-.19,.18,.17]],20,{bottom:false,top:false}),edge,shoulder,'chest');
  add(loft('rerebrace',inflate(PROFILES.upperArm.slice(2),1.14,.012),14),steel,arm,'chest');
  add(geo('couter',()=>{const g=new T.SphereGeometry(.098,14,10);g.scale(1,.92,1.04);g.translate(0,0,-.008);return g}),edge,elbow,'chest');
  add(loft('vambrace',inflate(PROFILES.forearm,1.2,.012),14),steel,elbow,'chest');
  add(loft('gauntlet-cuff',[[-.42,.074,.07],[-.34,.088,.084],[-.30,.084,.08]],14),edge,elbow,'chest');
  // Steel gauntlet over the fist; centred on the grip so weapons still sit in it.
  const gauntlet=add(loft('gauntlet',[[-.072,.05,.046,0,.004],[-.05,.064,.06,0,.006],[.035,.066,.062,0,.006],[.065,.056,.052,0,.004]],8),steel,rig[side+'Hand'],'chest',...GRIP);gauntlet.rotation.y=Math.PI/8;
 }

 // Legs: tassets, cuisses, round knee cops and greaves.
 add(loft('hip-plate',inflate(PROFILES.hips,1.03,.01),18),steel,rig.base,'legs');
 for(const side of ['left','right']){
  const leg=rig[side+'Leg'],knee=rig[side+'Knee'];
  add(loft('cuisse',inflate(PROFILES.thigh.slice(1),1.1,.014),14),steel,leg,'legs');
  add(geo('poleyn',()=>{const g=new T.SphereGeometry(.108,16,12);g.scale(1,.78,.8);g.translate(0,.01,.05);return g}),edge,knee,'legs');
  add(loft('greave',inflate(PROFILES.shin.slice(0,5),1.14,.012),14),steel,knee,'legs');
 }

 // Boots: steel sabatons with a turned-down leather cuff at the ankle.
 for(const side of ['left','right']){
  const ankle=rig[side+'Ankle'];
  add(loft('sabaton',PROFILES.foot.slice(0,5).map(([y,rx,rz,cx=0,cz=0])=>[y,rx*1.1+.01,rz*1.05+.012,cx,cz]),14,{bottom:false}),steel,ankle,'boots');
  add(loft('boot-cuff',[[.03,.104,.108,0,.004],[.13,.112,.114,0,-.002],[.17,.104,.106,0,-.004]],14),leather,ankle,'boots');
 }
 for(const list of Object.values(slots))for(const o of list)o.visible=false;
 body.updateMatrixWorld?.(true);
 return slots;
}
