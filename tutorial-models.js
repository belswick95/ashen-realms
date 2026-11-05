// Low-poly models for the castle training grounds: training dummy, throne dais and training pond.
// Shared geometries/materials keep the draw cost tiny (three dummies, one throne, one pond).
const cache=new Map();
function mat(T,color,extra={}){const key=color+JSON.stringify(extra);if(!cache.has(key))cache.set(key,new T.MeshStandardMaterial({color,roughness:.85,...extra}));return cache.get(key)}
function add(T,parent,geometry,color,x,y,z,extra){const m=new T.Mesh(geometry,mat(T,color,extra));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}

// Straw-stuffed practice dummy on a post. Wobbles when struck so hits read clearly.
export function trainingDummyModel(T,parent){
 const g=new T.Group();parent.add(g);const sway=new T.Group();g.add(sway);
 const wood=0x6b4a2f,straw=0xc9a85a,sack=0xd8c8a2,rope=0x8a6a3c;
 for(const r of [0,Math.PI/2]){const foot=add(T,g,new T.BoxGeometry(1.3,.12,.16),wood,0,.06,0);foot.rotation.y=r}
 add(T,sway,new T.CylinderGeometry(.07,.08,1.9,8),wood,0,.95,0);
 const body=add(T,sway,new T.CylinderGeometry(.33,.28,.95,10),straw,0,1.25,0);body.scale.z=.8;
 add(T,sway,new T.TorusGeometry(.3,.035,6,14),rope,0,1.45,0).rotation.x=Math.PI/2;
 add(T,sway,new T.TorusGeometry(.29,.035,6,14),rope,0,1.02,0).rotation.x=Math.PI/2;
 const arm=add(T,sway,new T.CylinderGeometry(.06,.06,1.5,8),wood,0,1.55,0);arm.rotation.z=Math.PI/2;
 for(const s of [-1,1])add(T,sway,new T.SphereGeometry(.13,8,6),straw,s*.75,1.55,0);
 add(T,sway,new T.SphereGeometry(.24,12,10),sack,0,1.98,0);
 add(T,sway,new T.BoxGeometry(.3,.05,.02),0x5a2f22,0,1.98,.23);
 let wobble=0,last=0;
 return {update(dt,m={}){const attack=Number(m.attack)||0;if(attack>last+.05)wobble=1;last=attack;wobble=Math.max(0,wobble-dt*1.6);sway.rotation.x=Math.sin(wobble*14)*.16*wobble;sway.rotation.z=Math.sin(wobble*9)*.06*wobble},hit(){wobble=1},dispose(){g.removeFromParent()}};
}

export function throneModel(T,g){
 const stone=0x8f8a80,gold=0xc9a227,velvet=0x5b1f6e,wood=0x5a3a24;
 add(T,g,new T.BoxGeometry(3.2,.3,2.6),stone,0,.15,0);add(T,g,new T.BoxGeometry(2.4,.2,1.8),stone,0,.4,.1);
 add(T,g,new T.BoxGeometry(1.25,.55,1),wood,0,.78,.15);add(T,g,new T.BoxGeometry(1.15,.12,.9),velvet,0,1.1,.18);
 add(T,g,new T.BoxGeometry(1.3,2.3,.22),wood,0,1.95,-.33);add(T,g,new T.BoxGeometry(1,1.7,.06),velvet,0,1.95,-.2);
 for(const s of [-1,1]){add(T,g,new T.BoxGeometry(.16,.5,.95),wood,s*.66,1.25,.15);add(T,g,new T.SphereGeometry(.11,10,8),gold,s*.66,3.15,-.33);add(T,g,new T.BoxGeometry(.12,2.35,.26),gold,s*.66,1.95,-.33)}
 add(T,g,new T.ConeGeometry(.2,.35,5),gold,0,3.3,-.33);
 return g;
}

export function trainingPondModel(T,g){
 const rim=0x8a8a80,water=0x2f6f86,reed=0x5d7a3a,lily=0x4f8a3e;
 const ring=new T.Mesh(new T.TorusGeometry(2.75,.32,8,28),mat(T,rim));ring.rotation.x=Math.PI/2;ring.position.y=.18;ring.castShadow=ring.receiveShadow=true;g.add(ring);
 const bed=new T.Mesh(new T.CircleGeometry(2.7,28),mat(T,0x3a3f2e));bed.rotation.x=-Math.PI/2;bed.position.y=.04;g.add(bed);
 const surface=new T.Mesh(new T.CircleGeometry(2.62,28),mat(T,water,{roughness:.12,metalness:.1,transparent:true,opacity:.86}));surface.rotation.x=-Math.PI/2;surface.position.y=.26;g.add(surface);
 for(let i=0;i<9;i++){const a=i*2.3+.4,r=2.95+(i%3)*.12,blade=add(T,g,new T.ConeGeometry(.05,.9+(i%3)*.25,4),reed,Math.cos(a)*r,.5,Math.sin(a)*r);blade.rotation.z=(i%2?1:-1)*.12}
 for(const [x,z]of [[1.1,.7],[-.9,1.2],[-1.4,-.8]]){const pad=new T.Mesh(new T.CircleGeometry(.32,10),mat(T,lily));pad.rotation.x=-Math.PI/2;pad.position.set(x,.275,z);g.add(pad)}
 return g;
}

export function tutorialObjectModel(T,parent,id){
 if(id!=='throne'&&id!=='training_pond')return null;
 const g=new T.Group();parent.add(g);
 return id==='throne'?throneModel(T,g):trainingPondModel(T,g);
}
