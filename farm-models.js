import {creatureMaterial} from './creature-material.js?v=release-20261106-carry118';
import {sharedGeometry} from './shared-geometry.js?v=release-20261106-carry118';
// Original procedural farm animals and countryside props. Local +Z faces forward; the ground is y=0.
export const farmAnimalSpecies=['cow','chicken','sheep','pig'];
export const farmObjectIds=['farm_hut','chicken_coop','hay_bale','water_trough','scarecrow','flower_bed','stone_statue','wheelbarrow'];
function kit(T,g,surface='hide'){
 const geometries=[],mat=c=>creatureMaterial(T,c,surface);
 const add=(geo,c,x,y,z,p=g,m=null)=>{geometries.push(geo);const mesh=new T.Mesh(geo,m||mat(c));mesh.position.set(x,y,z);mesh.castShadow=mesh.receiveShadow=true;p.add(mesh);return mesh};
 return {geometries,mat,
  ball:(x,y,z,sx,sy,sz,c,p=g)=>{const m=add(sharedGeometry(T,'sphere',1,18,12),c,x,y,z,p);m.scale.set(sx,sy,sz);return m},
  box:(x,y,z,w,h,l,c,p=g,m)=>add(sharedGeometry(T,'box',w,h,l),c,x,y,z,p,m),
  cyl:(x,y,z,r,h,c,p=g,top=r,m)=>add(sharedGeometry(T,'cylinder',top,r,h,12),c,x,y,z,p,m),
  cone:(x,y,z,r,h,c,p=g)=>add(sharedGeometry(T,'cone',r,h,8),c,x,y,z,p),
  pivot:(x,y,z,p=g)=>{const q=new T.Group();q.position.set(x,y,z);p.add(q);return q},
  dispose:()=>{for(const geo of geometries)if(!geo.userData.eldervaleShared)geo.dispose()}};
}
// Peaceful livestock: four or two legs that swing with travel, idle grazing and a short butt/peck attack.
export function farmAnimalModel(T,parent,d){
 const species=d.species;if(!farmAnimalSpecies.includes(species))return null;
 const g=new T.Group();parent.add(g);const k=kit(T,g),legs=[];let travel=0,clock=Math.random()*10;
 const leg=(x,y,z,len,r,c,hoof)=>{const q=k.pivot(x,y,z);k.cyl(0,-len/2,0,r,len,c,q,r*1.1);if(hoof)k.cyl(0,-len,0,r*1.15,.08,hoof,q);legs.push(q);return q};
 let head,wings=[],tail=null,bodyY=0;
 if(species==='cow'){
  bodyY=1.05;k.ball(0,1.05,0,.52,.48,.92,0xf1ece2);for(const [x,y,z,s] of [[.32,1.2,.25,.3],[-.28,1.0,-.35,.34],[.1,1.38,-.2,.26],[-.35,1.25,.4,.2]])k.ball(x,y,z,s*.9,s*.8,s,0x2b2522);
  k.ball(0,.62,-.42,.2,.14,.2,0xe7a9a0);for(const [x,z] of [[.28,.58],[-.28,.58],[.28,-.6],[-.28,-.6]])leg(x,.78,z,.74,.09,0xeee7da,0x2f2a26);
  head=k.pivot(0,1.28,.95);k.ball(0,0,.12,.25,.26,.34,0xf1ece2,head);k.ball(0,-.1,.4,.2,.16,.14,0xd9a29a,head);for(const s of [-1,1]){k.ball(s*.08,-.1,.53,.03,.03,.02,0x3c2a28,head);k.ball(s*.13,.12,.34,.03,.03,.03,0x141414,head);const ear=k.ball(s*.3,.12,.06,.12,.05,.08,0xe9e1d3,head);ear.rotation.z=s*.3;const horn=k.cone(s*.16,.28,.02,.04,.18,0xe8dcc0,head);horn.rotation.z=-s*.6}
  tail=k.pivot(0,1.25,-.88);k.cyl(0,-.32,0,.025,.64,0xe9e1d3,tail);k.ball(0,-.66,0,.06,.1,.06,0x2b2522,tail);
 }else if(species==='pig'){
  bodyY=.7;k.ball(0,.7,0,.46,.42,.72,0xe8a99d);for(const [x,z] of [[.24,.42],[-.24,.42],[.24,-.42],[-.24,-.42]])leg(x,.42,z,.4,.08,0xe09a8e,0x5b3b33);
  head=k.pivot(0,.82,.68);k.ball(0,0,.08,.3,.28,.28,0xe8a99d,head);const snout=k.cyl(0,-.04,.36,.12,.1,0xd98d83,head);snout.rotation.x=Math.PI/2;for(const s of [-1,1]){k.ball(s*.05,-.04,.42,.02,.03,.01,0x5b3b33,head);k.ball(s*.12,.1,.3,.03,.03,.03,0x141414,head);const ear=k.ball(s*.18,.25,.05,.1,.04,.09,0xe09a8e,head);ear.rotation.z=s*.6}
  tail=k.pivot(0,.82,-.7);const curl=new T.Mesh(new T.TorusGeometry(.07,.018,6,12,Math.PI*1.6),k.mat(0xe09a8e));k.geometries.push(curl.geometry);tail.add(curl);
 }else if(species==='sheep'){
  bodyY=.85;for(const [x,y,z,s] of [[0,.86,0,.5],[.24,.98,.28,.32],[-.24,.98,.28,.32],[.24,.96,-.3,.34],[-.24,.96,-.3,.34],[0,1.12,0,.34],[0,.84,.48,.3],[0,.84,-.5,.3]])k.ball(x,y,z,s,s*.9,s,0xefeadc);
  for(const [x,z] of [[.22,.38],[-.22,.38],[.22,-.38],[-.22,-.38]])leg(x,.55,z,.52,.06,0x2d2925,0x1d1a17);
  head=k.pivot(0,1.0,.66);k.ball(0,0,.12,.17,.2,.26,0x2d2925,head);k.ball(0,.14,.02,.2,.13,.16,0xefeadc,head);for(const s of [-1,1]){k.ball(s*.1,.05,.3,.025,.025,.025,0xd8c37a,head);const ear=k.ball(s*.2,.04,.02,.1,.035,.06,0x2d2925,head);ear.rotation.z=s*.4}
 }else{
  bodyY=.42;k.ball(0,.42,0,.22,.24,.3,0xf3efe6);k.ball(0,.46,-.26,.12,.18,.12,0xe9e2d4);for(const s of [-1,1]){const w=k.pivot(s*.2,.48,-.02);k.ball(0,0,0,.05,.15,.22,0xe6dfd0,w);wings.push(w);leg(s*.08,.24,0,.22,.018,0xe0a13a)}
  head=k.pivot(0,.68,.2);k.ball(0,0,0,.12,.13,.12,0xf3efe6,head);const beak=k.cone(0,-.02,.14,.035,.1,0xe0a13a,head);beak.rotation.x=Math.PI/2;k.ball(0,.13,0,.03,.07,.08,0xc8352e,head);k.ball(0,-.09,.08,.025,.05,.02,0xc8352e,head);for(const s of [-1,1])k.ball(s*.07,.03,.07,.018,.018,.018,0x111111,head);
 }
 const rest=head.position.clone();
 return {update(dt,m){clock+=dt;const moving=m.distance>0,attack=Math.max(0,Math.min(1,(m.attack||0)/.55)),strike=Math.sin((1-attack)*Math.PI)*(attack>0?1:0);travel+=(m.distance||0)*(species==='chicken'?9:4.5);
   legs.forEach((q,i)=>{q.rotation.x=moving?Math.sin(travel+(i%2?Math.PI:0)+(i>1?Math.PI/2:0))*.5:0});
   const graze=!moving&&attack===0?Math.max(0,Math.sin(clock*.45))**3:0;
   head.position.set(rest.x,rest.y-graze*(species==='chicken'?.25:.45)+(moving?Math.abs(Math.sin(travel))*.03:0),rest.z+strike*(species==='chicken'?.18:.3));head.rotation.x=graze*(species==='chicken'?1:.9)-strike*.2;
   for(const [i,w] of wings.entries())w.rotation.z=(i?-1:1)*(moving||attack?Math.abs(Math.sin(clock*18))*.7:0);
   if(tail)tail.rotation.z=Math.sin(clock*(species==='pig'?4:1.6))*.3;g.position.y=(m.hit||0)>0?.05:0;g.userData.bodyY=bodyY;},
  dispose:k.dispose};
}
// Countryside scenery and the farm hut. Returns a group, or null for other templates.
export function farmObjectModel(T,parent,id){
 if(!farmObjectIds.includes(id))return null;const g=new T.Group();parent.add(g);const k=kit(T,g,'hide');
 const wood=0x8a6a45,dark=0x5d4630,straw=0xd2b65f,stone=0x9a9a90;
 if(id==='farm_hut'){
  k.box(0,.08,0,4.4,.16,3.6,0x7d756a);for(const s of [-1,1]){k.box(s*2.05,1.25,0,.18,2.3,3.4,wood);k.box(0,1.25,s*1.65,4.1,2.3,.16,wood)}
  for(let y=.35;y<2.4;y+=.4)for(const s of [-1,1])k.box(0,y,s*1.75,4.2,.05,.04,dark);
  k.box(0,1,1.76,1,1.9,.08,dark);k.box(.32,1,1.82,.06,.06,.04,0xc9a45f);for(const s of [-1,1]){k.box(s*1.35,1.5,1.76,.75,.65,.06,0x9fc4d4);k.box(s*1.35,1.5,1.8,.8,.06,.06,dark);k.box(s*1.35,1.5,1.8,.06,.7,.06,dark)}
  for(const s of [-1,1]){const roof=k.box(s*1.25,2.95,0,2.85,.16,4.1,straw);roof.rotation.z=-s*.62}k.box(0,3.78,0,.2,.2,4.15,dark);
  for(const s of [-1,1]){const gable=new T.Shape();gable.moveTo(-2.05,0);gable.lineTo(2.05,0);gable.lineTo(0,1.45);gable.lineTo(-2.05,0);const geo=new T.ShapeGeometry(gable);k.geometries.push(geo);const m=new T.Mesh(geo,k.mat(wood));m.position.set(0,2.4,s*1.65);if(s<0)m.rotation.y=Math.PI;g.add(m)}
  k.box(1.6,2.1,-1.2,.35,4.2,.35,0x6f6a62);
 }else if(id==='chicken_coop'){
  for(const x of [-.6,.6])for(const z of [-.45,.45])k.box(x,.3,z,.08,.6,.08,dark);k.box(0,.85,0,1.4,.6,1.05,wood);for(const s of [-1,1]){const r=k.box(0,1.3,s*.3,1.55,.06,.72,0xa0452f);r.rotation.x=s*.45}
  k.box(0,.85,.53,.32,.32,.04,0x2a2119);const ramp=k.box(0,.33,.95,.32,.04,.9,wood);ramp.rotation.x=.75;
 }else if(id==='hay_bale'){
  for(const [x,z,y] of [[-.55,0,.35],[.55,0,.35],[0,0,1.02]]){const b=k.box(x,y,z,1.05,.68,.75,straw);b.rotation.y=y>.5?.2:0;for(const dz of [-.2,.2])k.box(x,y,z+dz,1.07,.7,.03,0xa88c3c)}
 }else if(id==='water_trough'){
  k.box(0,.32,0,1.9,.06,.8,wood);for(const s of [-1,1]){k.box(0,.55,s*.38,1.9,.5,.06,wood);k.box(s*.92,.55,0,.06,.5,.8,wood)}
  const water=k.box(0,.7,0,1.78,.03,.68,0x4f86a0,g,new T.MeshStandardMaterial({color:0x4f86a0,roughness:.15,metalness:.1,transparent:true,opacity:.85}));water.castShadow=false;for(const x of [-.75,.75])k.box(x,.15,0,.12,.3,.7,dark);
 }else if(id==='scarecrow'){
  k.cyl(0,1.1,0,.05,2.2,dark);k.box(0,1.55,0,1.5,.07,.07,dark);k.box(0,1.38,0,.55,.7,.28,0x6f7f4a);for(const s of [-1,1])k.box(s*.55,1.55,0,.45,.2,.22,0x6f7f4a);
  k.ball(0,1.98,0,.2,.22,.2,straw);k.cyl(0,2.18,0,.34,.04,0x5b4733);k.cyl(0,2.3,0,.16,.22,0x5b4733,g,.13);for(const s of [-1,1])k.ball(s*.07,2.0,.18,.025,.025,.02,0x111111);for(let i=0;i<6;i++){const s=k.cone(-.75+(i%2)*1.5,1.5,(i-2.5)*.03,.03,.22,straw);s.rotation.z=(i%2?-1:1)*1.7}
 }else if(id==='flower_bed'){
  k.box(0,.12,0,2,.24,.9,0x6b4a33);k.box(0,.25,0,1.85,.05,.75,0x3e2c1f);const colors=[0xd8455a,0xf2c94c,0x9b6dd6,0xf08cc0,0xffffff];for(let i=0;i<14;i++){const x=-.8+(i%7)*.27,z=i<7?-.18:.18;k.cyl(x,.4,z,.012,.28,0x4b7a3a);k.ball(x,.56,z,.07,.05,.07,colors[i%colors.length]);k.ball(x+.05,.35,z,.06,.03,.04,0x5c8f42)}
 }else if(id==='stone_statue'){
  const m=creatureMaterial(T,stone,'stone');k.box(0,.35,0,1.1,.7,1.1,stone,g,m);k.box(0,.75,0,.9,.1,.9,stone,g,m);k.ball(0,1.55,0,.3,.55,.22,stone,g);k.ball(0,2.3,0,.17,.2,.17,stone,g);for(const s of [-1,1]){k.box(s*.12,1,0,.13,.5,.15,stone,g,m);const arm=k.box(s*.36,1.6,.05,.1,.55,.1,stone,g,m);arm.rotation.z=s*.25}k.box(.42,1.9,.18,.06,1.3,.06,0x7c7c74,g,m);
  g.traverse(o=>{if(o.isMesh)o.material=m});
 }else if(id==='wheelbarrow'){
  k.box(0,.55,.1,.75,.3,1,wood);k.box(0,.42,.1,.65,.04,.9,dark);const wheel=k.cyl(0,.24,.72,.24,.08,0x3a3530);wheel.rotation.z=Math.PI/2;for(const s of [-1,1]){const h=k.box(s*.3,.5,-.65,.05,.05,.9,dark);h.rotation.x=-.2;k.box(s*.3,.2,-.25,.05,.4,.05,dark)}
 }
 g.userData.dispose=k.dispose;return g;
}
