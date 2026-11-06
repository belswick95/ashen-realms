// Models for underground passages (cave mouths, crypt doors, mine shafts, trapdoors, ladders,
// stairs, the way out), agility shortcuts and the fishing pier. Pooled geometry and materials
// only (shared-geometry.js), a handful of meshes each, so they stream and batch cheaply.
// world-models.js objectModel() asks here first.
import {sharedGeometry,sharedMaterial} from './shared-geometry.js?v=release-20261106-hud115';
const mat=(T,key,color,extra={})=>sharedMaterial(T,'ug:'+key,()=>new T.MeshStandardMaterial({color,roughness:.92,metalness:0,...extra}));
const glow=(T,key,color,intensity=1.6)=>sharedMaterial(T,'ug-glow:'+key,()=>new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.6}));
function add(T,g,geometry,material,x=0,y=0,z=0,{rx=0,ry=0,rz=0,sx=1,sy=1,sz=1,shadow=true}={}){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.scale.set(sx,sy,sz);m.castShadow=shadow;m.receiveShadow=true;g.add(m);return m}
const rock=T=>sharedGeometry(T,'dodecahedron',1,0),box=T=>sharedGeometry(T,'box',1,1,1),cyl=T=>sharedGeometry(T,'cylinder',1,1,1,7),disc=T=>sharedGeometry(T,'circle',1,18);
function ladder(T,g,height,{x=0,z=0,lean=0}={}){const wood=mat(T,'ladder',0x7a5634),h=new T.Group();h.position.set(x,0,z);h.rotation.x=lean;g.add(h);
 for(const s of [-.32,.32])add(T,h,box(T),wood,s,height/2,0,{sx:.08,sy:height,sz:.08});
 for(let y=.3;y<height;y+=.42)add(T,h,box(T),wood,0,y,0,{sx:.64,sy:.06,sz:.06,shadow:false});return h}
function hole(T,g,r=1.1){const dark=sharedMaterial(T,'ug:hole',()=>new T.MeshBasicMaterial({color:0x050403}));const m=add(T,g,disc(T),dark,0,.04,0,{rx:-Math.PI/2,sx:r,sy:r,sz:r,shadow:false});m.receiveShadow=false;return m}
function steps(T,g,down,stone){for(let k=0;k<5;k++){const y=down?-.05-k*.18:k*.22;add(T,g,box(T),stone,0,y+.1,(down?1:-1)*k*.42,{sx:1.6,sy:.2,sz:.5})}}
export const UNDERGROUND_MODEL_TEMPLATES=['cave_mouth','crypt_door','mine_shaft','trapdoor','cave_exit','ladder_down','ladder_up','stairs_down','stairs_up','log_balance','rope_swing','wall_climb','stepping_stones','squeeze','pier'];
export function undergroundObjectModel(T,parent,id,d={}){
 if(!UNDERGROUND_MODEL_TEMPLATES.includes(id))return null;
 const g=new T.Group();g.name='ug-'+id;parent.add(g);
 const stone=mat(T,'stone',0x7d7a72),dark=mat(T,'darkstone',0x4d4842),wood=mat(T,'wood',0x6e4d31),rope=mat(T,'rope',0xb59a62),moss=mat(T,'moss',0x4f6b3a);
 const gh=typeof d.groundHeight==='function'?d.groundHeight:null,h0=gh&&Number.isFinite(d.x)?gh(d.x,d.z):0;
 const len=Math.max(2,Number(d.length)||6);
 if(id==='cave_mouth'){// A rocky outcrop around a black opening facing +z.
  for(const [x,y,z,s] of [[-2.1,.9,0,1.5],[2.1,.9,0,1.5],[-1.2,2.6,.2,1.3],[1.2,2.6,.2,1.3],[0,3.2,0,1.25],[-2.8,.4,-1.2,1.1],[2.8,.4,-1.2,1.1],[0,1.8,-1.6,2]])add(T,g,rock(T),dark,x,y,z,{sx:s,sy:s*.9,sz:s,ry:x+z});
  add(T,g,sharedGeometry(T,'circle',1.35,18,0,Math.PI),sharedMaterial(T,'ug:hole-v',()=>new T.MeshBasicMaterial({color:0x040302,side:T.DoubleSide})),0,.05,.95,{sx:1,sy:1.55,shadow:false});
  add(T,g,rock(T),moss,-1.9,.25,1.3,{sx:.5,sy:.3,sz:.5});
 }else if(id==='crypt_door'){
  add(T,g,box(T),stone,0,.12,0,{sx:4.2,sy:.24,sz:2.6});add(T,g,box(T),stone,-1.35,1.6,0,{sx:.6,sy:3.2,sz:.7});add(T,g,box(T),stone,1.35,1.6,0,{sx:.6,sy:3.2,sz:.7});add(T,g,box(T),stone,0,3.35,0,{sx:3.4,sy:.55,sz:.85});
  add(T,g,box(T),mat(T,'cryptdoor',0x3b2e25),0,1.45,-.05,{sx:2.1,sy:2.7,sz:.18});add(T,g,sharedGeometry(T,'torus',.18,.04,6,12),mat(T,'iron',0x3d3f42,{metalness:.6,roughness:.5}),.55,1.4,.07,{shadow:false});
 }else if(id==='mine_shaft'||id==='trapdoor'){
  hole(T,g,id==='trapdoor'?.75:1.15);
  if(id==='mine_shaft'){for(const s of [-1,1]){add(T,g,box(T),wood,s*1.3,1.4,0,{sx:.18,sy:2.9,sz:.18,rz:-s*.22})}add(T,g,box(T),wood,0,2.75,0,{sx:2,sy:.18,sz:.18});add(T,g,cyl(T),rope,0,1.8,0,{sx:.03,sy:1.9,sz:.03});
   for(const [x,z] of [[-1.3,-1.3],[1.3,-1.3],[-1.3,1.3],[1.3,1.3]])add(T,g,box(T),wood,x,.12,z,{sx:.2,sy:.24,sz:.2});ladder(T,g,1.2,{lean:.15})}
  else{add(T,g,box(T),wood,.85,.08,0,{sx:.08,sy:.06,sz:1.4,rz:-.9});ladder(T,g,.9)}
 }else if(id==='cave_exit'||id==='ladder_up'){
  ladder(T,g,id==='cave_exit'?4.2:3.6,{lean:-.12});
  if(id==='cave_exit')add(T,g,disc(T),glow(T,'daylight',0xfff0c2,1.2),0,4.4,-.4,{rx:Math.PI/2,sx:1.1,sy:1.1,shadow:false});
 }else if(id==='ladder_down'){hole(T,g,.95);ladder(T,g,1.4,{lean:.1})}
 else if(id==='stairs_down'||id==='stairs_up'){steps(T,g,id==='stairs_down',stone);for(const s of [-1,1])add(T,g,box(T),dark,s*1.05,.5,0,{sx:.35,sy:1,sz:2.4})}
 else if(id==='log_balance'){const hA=gh?gh(d.x-Math.sin((d.yaw||0)*Math.PI/180)*len/2,d.z-Math.cos((d.yaw||0)*Math.PI/180)*len/2)-h0:0,hB=gh?gh(d.x+Math.sin((d.yaw||0)*Math.PI/180)*len/2,d.z+Math.cos((d.yaw||0)*Math.PI/180)*len/2)-h0:0;
  const y=Math.max(.35,(hA+hB)/2+.32);add(T,g,cyl(T),mat(T,'bark',0x5e4430),0,y,0,{rx:Math.PI/2,sx:.32,sy:len+1,sz:.32});add(T,g,cyl(T),mat(T,'logend',0xb8955f),0,y,(len+1)/2,{rx:Math.PI/2,sx:.3,sy:.02,sz:.3,shadow:false});
 }else if(id==='rope_swing'){const top=5.2;for(const s of [-1,1])add(T,g,cyl(T),wood,s*1.1,top/2,-len/2+.6,{sx:.14,sy:top,sz:.14});add(T,g,box(T),wood,0,top,-len/2+.6,{sx:2.4,sy:.18,sz:.18});
  add(T,g,cyl(T),rope,0,top-1.6,-len/2+.6+.6,{sx:.04,sy:3.2,sz:.04,rx:-.35});add(T,g,cyl(T),wood,len*0,.6,len/2-.4,{sx:.14,sy:1.2,sz:.14});
 }else if(id==='wall_climb'){add(T,g,box(T),dark,0,1.8,0,{sx:2.4,sy:3.6,sz:.3});for(const [x,y] of [[-.6,.7],[.5,1.3],[-.4,2],[.6,2.7],[-.2,3.3]])add(T,g,rock(T),stone,x,y,.2,{sx:.18,sy:.14,sz:.18});add(T,g,cyl(T),moss,.9,1.9,.18,{sx:.05,sy:3.4,sz:.05,shadow:false});
 }else if(id==='stepping_stones'){const n=Math.max(3,Math.round(len/1.6));for(let k=0;k<n;k++){const z=-len/2+(k+.5)*len/n;add(T,g,sharedGeometry(T,'cylinder',.55,.65,.5,8),stone,(k%2?.25:-.25),Math.max(.12,.2-h0),z,{ry:k})}
 }else if(id==='squeeze'){for(const s of [-1,1])add(T,g,rock(T),dark,s*1.15,1.4,0,{sx:.9,sy:1.6,sz:1.3,ry:s});add(T,g,rock(T),dark,0,2.6,0,{sx:1.4,sy:.6,sz:1.2});add(T,g,disc(T),sharedMaterial(T,'ug:hole',()=>new T.MeshBasicMaterial({color:0x050403})),0,1,.0,{sx:.5,sy:.9,shadow:false});
 }else if(id==='pier'){const deck=wood,n=Math.max(2,Math.round(len/2));add(T,g,box(T),deck,0,.38,0,{sx:2.4,sy:.18,sz:len});
  for(let k=0;k<=n;k++){const z=-len/2+k*len/n;for(const s of [-1,1])add(T,g,cyl(T),dark,s*1.1,-.4,z,{sx:.13,sy:1.7,sz:.13})}
  for(let k=0;k<n;k++)add(T,g,box(T),mat(T,'plankseam',0x5a3f28),0,.475,-len/2+(k+.5)*len/n,{sx:2.42,sy:.02,sz:.05,shadow:false});
 }
 g.userData.agilityLength=len;return g;
}
// Underground lights also mark the spot with a small emissive mesh (torch head, fungus cap,
// crystal, lava pool) so the cave reads even where the 4-light pool does not reach.
export function lightMarker(T,kind,color){const g=new T.Group(),c=glow(T,'l:'+kind,color,kind==='lava'?1.4:1.8);
 if(kind==='torch'){add(T,g,cyl(T),mat(T,'torchwood',0x4a3322),0,.9,0,{sx:.06,sy:1.8,sz:.06});add(T,g,sharedGeometry(T,'cone',.16,.42,6),c,0,1.95,0,{shadow:false})}
 else if(kind==='brazier'){add(T,g,cyl(T),mat(T,'iron',0x3d3f42,{metalness:.6,roughness:.5}),0,.5,0,{sx:.45,sy:1,sz:.45});add(T,g,sharedGeometry(T,'cone',.4,.5,7),c,0,1.25,0,{shadow:false})}
 else if(kind==='fungus'){for(const [x,z,s] of [[0,0,.42],[.5,.3,.3],[-.4,.35,.24]]){add(T,g,cyl(T),mat(T,'stalk',0xcfc7b0),x,s*.6,z,{sx:.06,sy:s*1.2,sz:.06,shadow:false});add(T,g,sharedGeometry(T,'sphere',1,8,5,0,Math.PI*2,0,Math.PI/2),c,x,s*1.2,z,{sx:s,sy:s*.6,sz:s,shadow:false})}}
 else if(kind==='crystal'){for(const [x,z,s,r] of [[0,0,.9,0],[.35,.2,.6,.4],[-.3,.25,.5,-.4]])add(T,g,sharedGeometry(T,'cone',.2,1,5),c,x,s/2,z,{sy:s,rz:r,shadow:false})}
 else if(kind==='lava'){const m=add(T,g,disc(T),c,0,.03,0,{rx:-Math.PI/2,sx:2.2,sy:1.6,sz:1,shadow:false});m.receiveShadow=false}
 return g;
}
