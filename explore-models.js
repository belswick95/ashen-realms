// Models for exploration objects: lore objects (statue, tablet, grave, journal on a lectern, carved
// standing stone, wayside shrine), clue crates and the hidden-place entrances (waterfall curtain,
// thorn thicket, sea cave, sealed shrine door, rowing boat, cliff path). Original low-poly shapes
// built only from pooled geometry and materials (shared-geometry.js), a handful of meshes each,
// so they stream, batch and LOD like every other prop. world-models.js objectModel() asks here first.
import {sharedGeometry,sharedMaterial} from './shared-geometry.js?v=release-20261107-music156';
export const EXPLORE_MODEL_TEMPLATES=['lore_statue','lore_tablet','lore_grave','lore_journal','lore_carving','lore_shrine','explore_crate','waterfall_curtain','thorn_thicket','sea_cave','shrine_door','ferry_boat','cliff_path'];
const mat=(T,key,color,extra={})=>sharedMaterial(T,'ex:'+key,()=>new T.MeshStandardMaterial({color,roughness:.9,metalness:0,...extra}));
const glow=(T,key,color,i=1.4)=>sharedMaterial(T,'ex-glow:'+key,()=>new T.MeshStandardMaterial({color,emissive:color,emissiveIntensity:i,roughness:.6}));
function add(T,g,geometry,material,x=0,y=0,z=0,{rx=0,ry=0,rz=0,sx=1,sy=1,sz=1,shadow=true}={}){const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.rotation.set(rx,ry,rz);m.scale.set(sx,sy,sz);m.castShadow=shadow;m.receiveShadow=true;g.add(m);return m}
const box=T=>sharedGeometry(T,'box',1,1,1),cyl=T=>sharedGeometry(T,'cylinder',1,1,1,8),rock=T=>sharedGeometry(T,'dodecahedron',1,0),cone=T=>sharedGeometry(T,'cone',1,1,6),sphere=T=>sharedGeometry(T,'sphere',1,8,6);
// A faint gold mote over unread lore (explore.js hides it once read).
function mote(T,g,y){const m=add(T,g,sharedGeometry(T,'icosahedron',.16,0),glow(T,'mote',0xffd77a,1.8),0,y,0,{shadow:false});m.userData.exploreMote=true;m.userData.baseY=y;g.userData.exploreMote=m;return m}
export function exploreObjectModel(T,parent,id,d={}){
 if(!EXPLORE_MODEL_TEMPLATES.includes(id))return null;
 const g=new T.Group();g.name='ex-'+id;parent.add(g);parent.userData.exploreModel=g;
 const stone=mat(T,'stone',0x8b877c),old=mat(T,'oldstone',0x6f6c63),moss=mat(T,'moss',0x56703f),wood=mat(T,'wood',0x6e4d31),dark=mat(T,'dark',0x3e3a35),parch=mat(T,'parchment',0xe8d9b0),bronze=mat(T,'bronze',0x9a7a3c,{metalness:.5,roughness:.5});
 if(id==='lore_statue'){add(T,g,box(T),old,0,.35,0,{sx:1.4,sy:.7,sz:1.4});add(T,g,cyl(T),stone,0,1.6,0,{sx:.42,sy:1.9,sz:.36});add(T,g,sphere(T),stone,0,2.85,0,{sx:.3,sy:.34,sz:.3});add(T,g,box(T),stone,.42,1.9,.15,{sx:.16,sy:.9,sz:.16,rz:-.5});add(T,g,box(T),moss,-.4,.72,.5,{sx:.5,sy:.06,sz:.3,shadow:false});mote(T,g,3.6)}
 else if(id==='lore_tablet'){add(T,g,box(T),old,0,.15,0,{sx:1.6,sy:.3,sz:.9});add(T,g,box(T),stone,0,1.05,0,{sx:1.3,sy:1.6,sz:.28,rx:-.08});for(let k=0;k<4;k++)add(T,g,box(T),dark,0,1.45-k*.22,.15,{sx:.9-(k%2)*.2,sy:.04,sz:.02,shadow:false});mote(T,g,2.3)}
 else if(id==='lore_grave'){add(T,g,box(T),moss,0,.06,.7,{sx:1,sy:.12,sz:1.8,shadow:false});add(T,g,box(T),stone,0,.6,-.2,{sx:.9,sy:1.2,sz:.2});add(T,g,cyl(T),stone,0,1.2,-.2,{rx:Math.PI/2,sx:.45,sy:.2,sz:.45});add(T,g,box(T),dark,0,.8,-.08,{sx:.5,sy:.05,sz:.02,shadow:false});mote(T,g,1.9)}
 else if(id==='lore_journal'){add(T,g,cyl(T),wood,0,.55,0,{sx:.12,sy:1.1,sz:.12});add(T,g,box(T),wood,0,1.12,0,{sx:.8,sy:.06,sz:.55,rx:-.35});add(T,g,box(T),parch,-.17,1.17,.02,{sx:.32,sy:.03,sz:.44,rx:-.35,rz:.05,shadow:false});add(T,g,box(T),parch,.17,1.17,.02,{sx:.32,sy:.03,sz:.44,rx:-.35,rz:-.05,shadow:false});add(T,g,box(T),wood,0,.05,0,{sx:.6,sy:.1,sz:.6});mote(T,g,1.8)}
 else if(id==='lore_carving'){add(T,g,rock(T),old,0,1.2,0,{sx:.7,sy:1.7,sz:.45});for(let k=0;k<3;k++)add(T,g,sharedGeometry(T,'torus',.18,.03,5,10),dark,0,.9+k*.45,.4,{shadow:false});add(T,g,box(T),moss,0,.05,0,{sx:1.8,sy:.1,sz:1.2,shadow:false});mote(T,g,3)}
 else if(id==='lore_shrine'){add(T,g,box(T),stone,0,.4,0,{sx:.9,sy:.8,sz:.7});add(T,g,box(T),stone,0,1.05,0,{sx:.75,sy:.5,sz:.55});add(T,g,cone(T),mat(T,'roof',0x5b3a2a),0,1.55,0,{sx:.7,sy:.5,sz:.55,ry:Math.PI/4});add(T,g,sphere(T),glow(T,'candle',0xffc46b,1.2),0,1.05,.3,{sx:.07,sy:.1,sz:.07,shadow:false});mote(T,g,2.3)}
 else if(id==='explore_crate'){add(T,g,box(T),mat(T,'crate',0x8a6a43),0,.45,0,{sx:.95,sy:.9,sz:.95});for(const s of [-1,1])add(T,g,box(T),wood,s*.49,.45,0,{sx:.04,sy:.92,sz:.97,shadow:false});add(T,g,box(T),wood,0,.45,0,{sx:.97,sy:.12,sz:.97,shadow:false});}
 else if(id==='waterfall_curtain'){// A low cliff with a sheet of falling water and a pool; the gap behind is the way in.
  for(const [x,y,z,s] of [[-2.6,1.6,-.6,1.6],[2.6,1.6,-.6,1.6],[-1.6,3.8,-.8,1.4],[1.6,3.8,-.8,1.4],[0,4.6,-.9,1.5],[-3.4,.6,.4,1],[3.4,.6,.4,1]])add(T,g,rock(T),old,x,y,z,{sx:s,sy:s,sz:s,ry:x});
  const water=sharedMaterial(T,'ex:waterfall',()=>new T.MeshStandardMaterial({color:0x9cc8dc,transparent:true,opacity:.62,roughness:.15,metalness:.05,emissive:0x23485a,emissiveIntensity:.25}));
  const sheet=add(T,g,box(T),water,0,2.3,.15,{sx:2.4,sy:4.6,sz:.08,shadow:false});sheet.userData.exploreFlow=true;g.userData.exploreFlow=sheet;
  add(T,g,sharedGeometry(T,'circle',1,16),water,0,.06,1.1,{rx:-Math.PI/2,sx:2.2,sy:1.4,shadow:false});add(T,g,box(T),moss,0,.05,-.1,{sx:3.4,sy:.08,sz:.5,shadow:false})}
 else if(id==='thorn_thicket'){const thorn=mat(T,'thorn',0x3f5a2a),bark=mat(T,'thornbark',0x4a3826);
  for(const [x,z,s] of [[-1.4,0,1.2],[1.4,0,1.2],[0,-.8,1.4],[-.7,.6,.8],[.8,.7,.9]]){add(T,g,sphere(T),thorn,x,s*.8,z,{sx:s,sy:s*.9,sz:s});add(T,g,cone(T),bark,x+.3,s*1.4,z,{sx:.06,sy:.5,sz:.06,rz:.6,shadow:false})}
  add(T,g,sphere(T),glow(T,'moth',0xd8d2c4,.6),.2,1.9,.9,{sx:.08,sy:.03,sz:.12,shadow:false})}
 else if(id==='sea_cave'){for(const [x,y,z,s] of [[-2.2,1,0,1.5],[2.2,1,0,1.5],[0,2.6,-.2,1.8],[-3.2,.4,.8,.9],[3.1,.4,.8,.9]])add(T,g,rock(T),mat(T,'searock',0x4f5552),x,y,z,{sx:s,sy:s,sz:s,ry:x});
  add(T,g,sharedGeometry(T,'circle',1.2,16,0,Math.PI),sharedMaterial(T,'ex:hole',()=>new T.MeshBasicMaterial({color:0x040506,side:T.DoubleSide})),0,.05,1,{sx:1,sy:1.3,shadow:false});
  add(T,g,box(T),mat(T,'weed',0x2f4a36),0,.04,1.6,{sx:2.6,sy:.06,sz:.8,shadow:false})}
 else if(id==='shrine_door'){add(T,g,box(T),old,0,.15,0,{sx:3.4,sy:.3,sz:1.6});for(const s of [-1,1])add(T,g,box(T),old,s*1.15,1.5,0,{sx:.5,sy:3,sz:.6});add(T,g,box(T),old,0,3.15,0,{sx:2.9,sy:.4,sz:.7});
  add(T,g,box(T),mat(T,'slab',0x5d5a54),0,1.45,0,{sx:1.8,sy:2.7,sz:.2});add(T,g,sphere(T),glow(T,'lamp',0xffe3a0,.9),0,2.2,.12,{sx:.14,sy:.18,sz:.06,shadow:false})}
 else if(id==='ferry_boat'){const hull=mat(T,'hull',0x6a4a2c);add(T,g,box(T),hull,0,.35,0,{sx:1.4,sy:.45,sz:3.4});for(const s of [-1,1])add(T,g,box(T),hull,s*.72,.6,0,{sx:.08,sy:.4,sz:3.4,shadow:false});
  add(T,g,cone(T),hull,0,.35,1.95,{rx:Math.PI/2,sx:.7,sy:.6,sz:.3});add(T,g,box(T),wood,0,.62,-.4,{sx:1.3,sy:.06,sz:.3,shadow:false});add(T,g,cyl(T),wood,.9,.7,.4,{rz:1.2,sx:.04,sy:2.2,sz:.04,shadow:false})}
 else if(id==='cliff_path'){for(let k=0;k<5;k++)add(T,g,box(T),old,0,.15+k*.35,-k*.7,{sx:1.4,sy:.3,sz:.8,ry:(k%2?.1:-.1)});for(const [x,y,z,s] of [[-1.5,1.6,-1.6,1.4],[1.5,1.8,-1.8,1.3],[0,3.2,-3.8,1.8]])add(T,g,rock(T),stone,x,y,z,{sx:s,sy:s*1.3,sz:s});add(T,g,cyl(T),mat(T,'rope',0xb59a62),.85,1,-1.4,{rx:.5,sx:.03,sy:3,sz:.03,shadow:false})}
 return g;
}
// Per-frame animation helpers (no allocations): lore motes bob, waterfalls shimmer.
export function animateExploreModel(root,time){const g=root?.userData?.exploreModel;if(!g)return;const m=g.userData.exploreMote;if(m&&m.visible){m.position.y=m.userData.baseY+Math.sin(time*2+root.position.x)*.12;m.rotation.y=time}const f=g.userData.exploreFlow;if(f)f.material.emissiveIntensity=.22+Math.sin(time*6)*.04}
