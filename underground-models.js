// Models for underground passages, agility shortcuts and the fishing pier. Every dungeon way down
// is drawn as a wooden trapdoor set flush in the ground and every way back up as a ladder to the
// open hatch above (passageLook in underground-data.js), whatever template the server stores.
// Pooled geometry and materials only (shared-geometry.js), a handful of meshes each, so they
// stream and batch cheaply.
// world-models.js objectModel() asks here first.
import {sharedGeometry,sharedMaterial} from './shared-geometry.js?v=release-20261107-portrait145';
import {passageLook} from './underground-data.js?v=release-20261107-portrait145';
import {makeFlame} from './torch.js?v=release-20261107-portrait145';
const mat=(T,key,color,extra={})=>sharedMaterial(T,'ug:'+key,()=>new T.MeshStandardMaterial({color,roughness:.92,metalness:0,...extra}));
const glow=(T,key,color,intensity=1.6)=>sharedMaterial(T,'ug-glow:'+key,()=>new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:intensity,roughness:.6}));
function add(T,g,geometry,material,x=0,y=0,z=0,{rx=0,ry=0,rz=0,sx=1,sy=1,sz=1,shadow=true}={}){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.scale.set(sx,sy,sz);m.castShadow=shadow;m.receiveShadow=true;g.add(m);return m}
const rock=T=>sharedGeometry(T,'dodecahedron',1,0),box=T=>sharedGeometry(T,'box',1,1,1),cyl=T=>sharedGeometry(T,'cylinder',1,1,1,7),disc=T=>sharedGeometry(T,'circle',1,18);
function ladder(T,g,height,{x=0,z=0,lean=0}={}){const wood=mat(T,'ladder',0x7a5634),h=new T.Group();h.position.set(x,0,z);h.rotation.x=lean;g.add(h);
 for(const s of [-.32,.32])add(T,h,box(T),wood,s,height/2,0,{sx:.08,sy:height,sz:.08});
 for(let y=.3;y<height;y+=.42)add(T,h,box(T),wood,0,y,0,{sx:.64,sy:.06,sz:.06,shadow:false});return h}
const iron=T=>mat(T,'iron',0x3d3f42,{metalness:.6,roughness:.5});
// A wooden trapdoor flush with the ground: a low stone rim on a dirt patch, a black square opening
// with the ladder's top showing, and a planked hatch with two iron bands and a ring pull, hinged on
// the far (-z) edge. Open, the hatch leans back past upright; closed (a locked way) it lies flat.
// The player arrives on the +z side, one tile from the hatch.
function trapdoor(T,g,{open=true}={}){const S=1.5,rim=mat(T,'hatchrim',0x77726a),dirt=mat(T,'hatchdirt',0x5a4632),plank=mat(T,'hatchwood',0x7a5536),seam=mat(T,'hatchseam',0x4a3220);
 const patch=add(T,g,sharedGeometry(T,'circle',1,20),dirt,0,.025,0,{rx:-Math.PI/2,sx:1.55,sy:1.55,sz:1,shadow:false});patch.receiveShadow=true;
 for(const s of [-1,1]){add(T,g,box(T),rim,0,.07,s*(S/2+.11),{sx:S+.44,sy:.16,sz:.22});add(T,g,box(T),rim,s*(S/2+.11),.07,0,{sx:.22,sy:.16,sz:S})}
 const dark=sharedMaterial(T,'ug:hole',()=>new T.MeshBasicMaterial({color:0x050403}));
 if(open){const pit=add(T,g,sharedGeometry(T,'plane',1,1),dark,0,.05,0,{rx:-Math.PI/2,sx:S,sy:S,shadow:false});pit.receiveShadow=false;
  const top=mat(T,'ladder',0x7a5634);for(const s of [-.3,.3])add(T,g,box(T),top,s,.12,-S/2+.18,{sx:.08,sy:.34,sz:.08,shadow:false});add(T,g,box(T),top,0,.2,-S/2+.18,{sx:.66,sy:.05,sz:.05,shadow:false})}
 const hinge=new T.Group();hinge.name='hatch';hinge.position.set(0,.15,-S/2);hinge.rotation.x=open?-1.82:0;g.add(hinge);
 for(let k=0;k<4;k++)add(T,hinge,box(T),plank,-S/2+S/8+k*S/4,0,S/2,{sx:S/4-.03,sy:.08,sz:S});
 for(let k=1;k<4;k++)add(T,hinge,box(T),seam,-S/2+k*S/4,-.005,S/2,{sx:.03,sy:.081,sz:S,shadow:false});
 for(const z of [.28,S-.28])add(T,hinge,box(T),iron(T),0,.045,z,{sx:S+.04,sy:.03,sz:.13,shadow:false});
 for(const x of [-S/2+.12,S/2-.12])for(const z of [.28,S-.28])add(T,hinge,sharedGeometry(T,'sphere',1,6,4),iron(T),x,.065,z,{sx:.035,sy:.025,sz:.035,shadow:false});
 add(T,hinge,sharedGeometry(T,'torus',.11,.022,6,12),iron(T),0,.06,S-.14,{rx:Math.PI/2,shadow:false});
 for(const x of [-S/2+.3,S/2-.3])add(T,g,cyl(T),iron(T),x,.15,-S/2,{rz:Math.PI/2,sx:.04,sy:.22,sz:.04,shadow:false});
 return hinge}
// A ladder up to the open hatch: the square of light (daylight on the way out, lamplight from the
// level above) framed by planks, with a faint shaft of light falling to the floor.
function ladderUp(T,g,{daylight=true}={}){const H=4.7,S=1.5,lean=-.1;ladder(T,g,H,{lean});
 const frame=mat(T,'hatchwood',0x7a5536),y=H*Math.cos(lean)+.15,zc=H*Math.sin(lean);
 add(T,g,sharedGeometry(T,'plane',1,1),sharedMaterial(T,'ug-glow:'+(daylight?'daylight-sq':'lamplight-sq'),()=>new T.MeshStandardMaterial({color:daylight?0xfff0c2:0xffc27a,emissive:daylight?0xfff0c2:0xffc27a,emissiveIntensity:daylight?1.3:.8,roughness:.6,side:T.DoubleSide})),0,y,zc,{rx:Math.PI/2,sx:S,sy:S,shadow:false});
 for(const s of [-1,1]){add(T,g,box(T),frame,0,y+.02,zc+s*(S/2+.1),{sx:S+.4,sy:.14,sz:.2,shadow:false});add(T,g,box(T),frame,s*(S/2+.1),y+.02,zc,{sx:.2,sy:.14,sz:S,shadow:false})}
 const shaft=sharedMaterial(T,'ug:lightshaft:'+(daylight?'day':'lamp'),()=>new T.MeshBasicMaterial({color:daylight?0xfff0c2:0xffc27a,transparent:true,opacity:daylight?.1:.06,depthWrite:false,side:T.DoubleSide}));
 add(T,g,sharedGeometry(T,'cylinder',.62,1.05,1,4,1,true),shaft,0,y/2,zc/2,{ry:Math.PI/4,sy:y,shadow:false});
 const pool=add(T,g,sharedGeometry(T,'plane',1,1),shaft,0,.03,0,{rx:-Math.PI/2,sx:S+.4,sy:S+.4,shadow:false});pool.receiveShadow=false}
// A way that needs a quest unlock or a lore find shows its hatch shut.
export function passageLocked(d){const r=d?.passage?.requires;return !!(r&&(r.unlock||r.lore))}
export const UNDERGROUND_MODEL_TEMPLATES=['cave_mouth','crypt_door','mine_shaft','trapdoor','cave_exit','ladder_down','ladder_up','stairs_down','stairs_up','log_balance','rope_swing','wall_climb','stepping_stones','squeeze','pier'];
export function undergroundObjectModel(T,parent,id,d={}){
 const look=passageLook(id);
 if(look){const g=new T.Group();g.name='ug-'+look;g.userData.passageLook=look;parent.add(g);
  if(look==='trapdoor')trapdoor(T,g,{open:!passageLocked(d)});else ladderUp(T,g,{daylight:!d.passage||d.passage.depth===-1});return g}
 if(!UNDERGROUND_MODEL_TEMPLATES.includes(id))return null;
 const g=new T.Group();g.name='ug-'+id;parent.add(g);
 const stone=mat(T,'stone',0x7d7a72),dark=mat(T,'darkstone',0x4d4842),wood=mat(T,'wood',0x6e4d31),rope=mat(T,'rope',0xb59a62),moss=mat(T,'moss',0x4f6b3a);
 const gh=typeof d.groundHeight==='function'?d.groundHeight:null,h0=gh&&Number.isFinite(d.x)?gh(d.x,d.z):0;
 const len=Math.max(2,Number(d.length)||6);
 if(id==='log_balance'){const hA=gh?gh(d.x-Math.sin((d.yaw||0)*Math.PI/180)*len/2,d.z-Math.cos((d.yaw||0)*Math.PI/180)*len/2)-h0:0,hB=gh?gh(d.x+Math.sin((d.yaw||0)*Math.PI/180)*len/2,d.z+Math.cos((d.yaw||0)*Math.PI/180)*len/2)-h0:0;
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
 // Torches and braziers burn with the held torch's animated flame (torch.js): the old solid
 // emissive cone tone-mapped to a flat white spike that read as a spear head, not a fire.
 if(kind==='torch'){add(T,g,cyl(T),mat(T,'torchwood',0x4a3322),0,.9,0,{sx:.06,sy:1.8,sz:.06});add(T,g,cyl(T),mat(T,'torchwrap',0x3b2c20,{roughness:.95}),0,1.86,0,{sx:.1,sy:.22,sz:.1,shadow:false});
  const f=makeFlame(T);f.name='light-flame';f.position.y=1.94;f.scale.setScalar(2.2);g.add(f)}
 else if(kind==='brazier'){add(T,g,cyl(T),mat(T,'iron',0x3d3f42,{metalness:.6,roughness:.5}),0,.5,0,{sx:.45,sy:1,sz:.45});add(T,g,cyl(T),mat(T,'coals',0x2a140a,{emissive:0x7a2a08,emissiveIntensity:.9}),0,1.02,0,{sx:.4,sy:.06,sz:.4,shadow:false});
  const f=makeFlame(T);f.name='light-flame';f.position.y=1.02;f.scale.setScalar(3.6);g.add(f)}
 else if(kind==='fungus'){for(const [x,z,s] of [[0,0,.42],[.5,.3,.3],[-.4,.35,.24]]){add(T,g,cyl(T),mat(T,'stalk',0xcfc7b0),x,s*.6,z,{sx:.06,sy:s*1.2,sz:.06,shadow:false});add(T,g,sharedGeometry(T,'sphere',1,8,5,0,Math.PI*2,0,Math.PI/2),c,x,s*1.2,z,{sx:s,sy:s*.6,sz:s,shadow:false})}}
 else if(kind==='crystal'){for(const [x,z,s,r] of [[0,0,.9,0],[.35,.2,.6,.4],[-.3,.25,.5,-.4]])add(T,g,sharedGeometry(T,'cone',.2,1,5),c,x,s/2,z,{sy:s,rz:r,shadow:false})}
 else if(kind==='lava'){const m=add(T,g,disc(T),c,0,.03,0,{rx:-Math.PI/2,sx:2.2,sy:1.6,sz:1,shadow:false});m.receiveShadow=false}
 return g;
}
