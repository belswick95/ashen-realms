import {PROFILES,inflate,shell} from './humanoid.js?v=release-20261104-lowpoly54';
// Low-poly plate armor. Every piece is an inflated copy of the body part it
// covers, parented to that part's bone, so it always fits and always follows
// the animation. Returns {helm,chest,legs,boots}: arrays of meshes, all hidden.
export function buildPlateArmor(T,body,rig){
 const caches=buildPlateArmor.caches||(buildPlateArmor.caches=new WeakMap());let cache=caches.get(T);if(!cache){cache=new Map();caches.set(T,cache)}
 const material=(name,color,metalness=.55,roughness=.42)=>{if(!cache.has('mat:'+name)){const m=new T.MeshStandardMaterial({color,metalness,roughness,flatShading:true});m.userData.eldervaleShared=true;cache.set('mat:'+name,m)}return cache.get('mat:'+name)};
 const steel=material('steel',0x9aa5ab),trim=material('trim',0xc9ccc4,.6,.35),dark=material('recess',0x1d2427,.3,.7),leather=material('leather',0x4b3529,0,.92),crest=material('crest',0x8a2f3c,0,.9);
 const geo=(key,make)=>{if(!cache.has(key)){const g=make();g.userData.armorPiece=key.replace(/^loft:/,'');g.computeBoundingSphere();g.userData.eldervaleShared=true;cache.set(key,g)}return cache.get(key)};
 const loft=(key,rings,sides=8)=>geo('loft:'+key,()=>shell(T,rings,sides));
 const slots={helm:[],chest:[],legs:[],boots:[]};
 const add=(g,m,parent,slot,x=0,y=0,z=0)=>{const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=false;o.userData.armorSlot=slot;parent.add(o);slots[slot].push(o);return o};
 const torso=rig.torso||rig.base;

 // Helm: a closed great-helm around the head with a visor slit and a crest.
 // It lives in its own group on the head bone so it follows every nod.
 const helmet=new T.Group();helmet.name='armor-helm';rig.head.add(helmet);
 add(loft('helm',[[-.24,.115,.12,0,.02],...inflate(PROFILES.head.slice(1,6),1.14,.012),[.25,.075,.08,0,-.008],[.29,.02,.02]],10),steel,helmet,'helm');
 add(geo('visor',()=>new T.BoxGeometry(.24,.032,.03)),dark,helmet,'helm',0,.05,.178);
 add(geo('visor-ridge',()=>new T.BoxGeometry(.036,.27,.04)),trim,helmet,'helm',0,-.04,.18);
 add(geo('brow-band',()=>new T.BoxGeometry(.30,.03,.03)),trim,helmet,'helm',0,.10,.166);
 for(const x of [-.06,-.03,.03,.06])add(geo('breath',()=>new T.BoxGeometry(.012,.05,.02)),dark,helmet,'helm',x,-.09,.17);
 add(geo('crest',()=>{const g=new T.CylinderGeometry(.13,.13,.035,10,1,false,-Math.PI/2,Math.PI);g.rotateZ(Math.PI/2);g.scale(1,.75,1);return g}),crest,helmet,'helm',0,.215,-.01);
 add(loft('gorget',inflate(PROFILES.neck,1.35,.02),8),steel,rig.base,'helm');

 // Chest: breastplate on the torso pivot, layered shoulders and arm plates.
 add(loft('cuirass',inflate(PROFILES.torso.slice(0,5),1.08,.014),10),steel,torso,'chest');
 add(loft('cuirass-collar',[[.68,.21,.14,0,-.05],[.74,.14,.105,0,-.05]],10),trim,torso,'chest');
 add(geo('breast-ridge',()=>new T.BoxGeometry(.03,.42,.03)),trim,torso,'chest',0,.36,.13);
 for(let i=0;i<3;i++)add(loft('fauld'+i,[[1.33-i*.07,.26+i*.012,.175+i*.006,0,-.05],[1.42-i*.07,.255+i*.012,.17+i*.006,0,-.05]],10),i===0?trim:steel,rig.base,'chest');
 add(loft('war-belt',[[1.52,.268,.182,0,-.05],[1.59,.268,.182,0,-.05]],10),leather,rig.base,'chest');
 add(geo('buckle',()=>new T.BoxGeometry(.07,.06,.02)),trim,rig.base,'chest',0,1.555,.135);
 for(const side of ['left','right']){
  const s=side==='left'?1:-1,arm=rig[side+'Arm'],elbow=rig[side+'Elbow'];
  // Pauldron: two overlapping domed lames over the shoulder ball.
  const p1=add(loft('pauldron',[[.13,.03,.03],[.10,.10,.10],[.03,.135,.125],[-.06,.13,.12]],8),steel,arm,'chest');p1.rotation.z=s*.12;
  const p2=add(loft('pauldron-lame',[[-.04,.128,.118],[-.12,.115,.108]],8),trim,arm,'chest');p2.rotation.z=s*.12;
  add(loft('rerebrace',inflate(PROFILES.upperArm.slice(1),1.18,.008),8),steel,arm,'chest');
  add(geo('couter',()=>{const g=new T.SphereGeometry(.082,8,6);g.scale(1,.9,1);return g}),trim,elbow,'chest');
  add(loft('vambrace',inflate(PROFILES.forearm,1.25,.01),8),steel,elbow,'chest');
  add(loft('cuff',[[-.36,.062,.058],[-.30,.07,.066]],8),trim,elbow,'chest');
 }

 // Legs: tassets, cuisses, knee cops and greaves.
 add(loft('hip-plate',inflate(PROFILES.hips,1.07,.012),10),steel,rig.base,'legs');
 for(const side of ['left','right']){
  const leg=rig[side+'Leg'],knee=rig[side+'Knee'];
  add(loft('cuisse',inflate(PROFILES.thigh.slice(1),1.14,.01),8),steel,leg,'legs');
  add(geo('poleyn',()=>{const g=new T.SphereGeometry(.098,8,6);g.scale(1,.85,.95);g.translate(0,0,.012);return g}),trim,knee,'legs');
  add(loft('greave',inflate(PROFILES.shin.slice(0,4),1.18,.01),8),steel,knee,'legs');
 }

 // Boots: sabatons over the shoe, sharing its flat sole height.
 for(const side of ['left','right']){
  const ankle=rig[side+'Ankle'];
  add(loft('sabaton',PROFILES.foot.map(([y,rx,rz,cx=0,cz=0],i)=>[y,rx*1.14+.008,rz*1.06+.01,cx,cz+(i<2?.01:0)]),8),steel,ankle,'boots');
  add(loft('sabaton-cuff',[[.03,.072,.07],[.10,.068,.064]],8),trim,ankle,'boots');
 }
 for(const list of Object.values(slots))for(const o of list)o.visible=false;
 body.updateMatrixWorld?.(true);
 return slots;
}
