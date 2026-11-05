import {surfaceTexture} from './surface-textures.js?v=release-20261105-walkanim64';
import {batchStaticMeshes} from './static-batch.js?v=release-20261105-walkanim64';
// Detailed street furniture for towns: benches, barrels, crates, market
// stalls, street lanterns and wells, built from shared textured materials and
// merged per material so each prop costs a handful of draw calls. Footprints
// match the server collision sizes in can_step (bench 2.3×1, barrel r .6,
// crate 1.4×1.2, market 2.7×1.9, well r 1.2).
const caches=new WeakMap();
function kit(T){
 let k=caches.get(T);if(k)return k;
 const mats=new Map(),geos=new Map();
 const mat=(color,kind=null,extra={})=>{const key=color+':'+kind+':'+JSON.stringify(extra);if(!mats.has(key)){const m=new T.MeshStandardMaterial({color:kind?0xffffff:color,map:kind?surfaceTexture(T,kind,color):null,roughness:kind==='metal'?.5:.88,metalness:kind==='metal'?.55:0,...extra});m.userData.eldervaleShared=true;mats.set(key,m)}return mats.get(key)};
 const geo=(key,make)=>{if(!geos.has(key)){const g=make();g.userData.eldervaleShared=true;geos.set(key,g)}return geos.get(key)};
 k={mat,geo,striped:new Map()};caches.set(T,k);return k;
}
// Striped awning canvas; one texture per colour pair.
function awning(T,k,a,b){const key=a+':'+b;if(k.striped.has(key))return k.striped.get(key);let m=null;if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=128;c.height=16;const x=c.getContext('2d');for(let i=0;i<8;i++){x.fillStyle=i%2?b:a;x.fillRect(i*16,0,16,16)}x.fillStyle='rgba(0,0,0,.12)';for(let i=0;i<128;i+=2)x.fillRect(i,0,1,16);const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.userData.eldervaleShared=true;m=new T.MeshStandardMaterial({map:t,roughness:.9,side:T.DoubleSide})}else m=new T.MeshStandardMaterial({color:a,side:T.DoubleSide});m.userData.eldervaleShared=true;k.striped.set(key,m);return m}
const hash=(x,z,n=1)=>{const s=Math.sin(x*12.9898+z*78.233+n*37.719)*43758.5453;return s-Math.floor(s)};

export function townProp(T,parent,id,d={}){
 const build=builders[id];if(!build)return null;
 const k=kit(T),g=new T.Group();parent.add(g);
 const add=(geometry,material,[x,y,z],[sx,sy,sz]=[1,1,1],[rx,ry,rz]=[0,0,0],shadow=true)=>{const m=new T.Mesh(geometry,material);m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.rotation.set(rx,ry,rz);m.castShadow=shadow;m.receiveShadow=true;g.add(m);return m};
 const box=k.geo('box',()=>new T.BoxGeometry(1,1,1)),cyl=k.geo('cyl',()=>new T.CylinderGeometry(1,1,1,12)),ball=k.geo('ball',()=>new T.SphereGeometry(1,10,7));
 const live=build({T,k,g,add,box,cyl,ball,seed:hash(d.x||0,d.z||0),parent})||[];
 // Moving or glowing parts stay separate; everything else merges per material.
 for(const m of live)m.removeFromParent();batchStaticMeshes(T,g);for(const m of live)g.add(m);
 return g;
}

const WOOD=0x8a6440,DARK=0x5b4330,IRON=0x34383b,STONE=0x9a968a;
const builders={
 bench({k,add,box}){const wood=k.mat(WOOD,'wood'),iron=k.mat(IRON,'metal');
  for(const z of [-.17,0,.17])add(box,wood,[0,.78,z],[2.15,.06,.15]);
  for(const y of [1.06,1.3])add(box,wood,[0,y,-.3],[2.15,.13,.05],[-.18,0,0]);
  for(const x of [-.86,.86]){add(box,iron,[x,.39,.17],[.07,.78,.07]);add(box,iron,[x,.6,-.2],[.07,1.25,.07],[-.18,0,0]);add(box,iron,[x,.72,0],[.07,.06,.48]);add(box,iron,[x,.98,.02],[.06,.05,.42]);add(box,iron,[x,.88,.2],[.06,.2,.05])}},
 barrel({T,k,add,seed}){const staves=k.geo('barrel',()=>{const pts=[];for(let i=0;i<=10;i++){const y=i/10,r=.36+.07*Math.sin(Math.PI*y);pts.push(new T.Vector2(r,y*1.02))}return new T.LatheGeometry(pts,16)});
  const wood=k.mat(seed<.5?0x8b6a45:0x7a5a3a,'wood'),hoop=k.mat(IRON,'metal'),lid=k.mat(DARK,'wood');add(staves,wood,[0,0,0]);
  const ring=k.geo('hoop',()=>new T.TorusGeometry(1,.035,5,18));for(const [y,r] of [[.1,.385],[.32,.42],[.7,.42],[.92,.385]])add(ring,hoop,[0,y,0],[r,r,1],[Math.PI/2,0,0]);
  add(k.geo('lid',()=>new T.CircleGeometry(.37,16)),lid,[0,.995,0],[1,1,1],[-Math.PI/2,0,0],false);},
 crate({k,add,box,seed}){const wood=k.mat(0x9a7448,'wood'),frame=k.mat(DARK,'wood');const w=.95,h=.8,d=.85;add(box,wood,[0,h/2,0],[w,h,d]);
  for(const sx of [-1,1])for(const sz of [-1,1])add(box,frame,[sx*(w/2-.03),h/2,sz*(d/2-.03)],[.08,h+.02,.08]);
  for(const y of [.04,h-.04])for(const sz of [-1,1]){add(box,frame,[0,y,sz*(d/2-.02)],[w,.07,.06]);add(box,frame,[sz*(w/2-.02),y,0],[.06,.07,d])}
  for(const sz of [-1,1])add(box,frame,[0,h/2,sz*(d/2+.01)],[.07,Math.hypot(w,h)*.92,.03],[0,0,Math.atan2(h,w)*sz]);
  // Some crates carry a smaller one or a sack on top.
  if(seed>.55)add(box,wood,[.08,h+.22,-.05],[.55,.44,.5],[0,seed*2,0]);else if(seed>.25)add(box,k.mat(0xb59c6f,'cloth'),[-.1,h+.15,0],[.5,.3,.42],[0,seed*3,.1]);},
 market({T,k,add,box,cyl,ball,seed}){const post=k.mat(0x7b5636,'wood'),plank=k.mat(0x9a7650,'wood'),cloth=k.mat([0x7e3b35,0x3f6a5c,0x48577e][Math.floor(seed*3)],'cloth');
  const pair=[['#b8463a','#eadcc0'],['#3f7a63','#e6dcc2'],['#3d5a8a','#eee2c8'],['#c48a2c','#efe4cc']][Math.floor(seed*4)];const canvas=awning(T,k,...pair);
  for(const x of [-1.15,1.15])for(const z of [-.7,.7])add(box,post,[x,1.25,z],[.1,2.5,.1]);
  add(box,plank,[0,.92,.05],[2.3,.08,1.15]);add(box,cloth,[0,.7,.63],[2.32,.42,.03]);add(box,plank,[0,.45,-.1],[2.2,.05,.9]);
  // Back shelf with jars and bolts of cloth.
  add(box,plank,[0,1.45,-.62],[2.2,.05,.3]);for(let i=0;i<6;i++){const c=k.mat([0x6c8aa1,0xa2603e,0xc9b77f,0x5f7a4b][i%4]);add(cyl,c,[-.9+i*.36,1.58,-.62],[.07,.2,.07])}
  // Produce piles and bread on the counter.
  const fruit=[0xb3342a,0xd9a13b,0x78a243,0x8a3b6b];for(let p=0;p<3;p++){const cx=-.7+p*.7,c=k.mat(fruit[(p+Math.floor(seed*4))%4]);add(box,k.mat(0x80603d,'wood'),[cx,1.0,.15],[.55,.08,.45]);for(let i=0;i<9;i++){const a=i*2.4,r=i<1?0:.09+(i%3)*.05;add(ball,c,[cx+Math.cos(a)*r,1.1+(i<1?.08:0),.15+Math.sin(a)*r*.8],[.075,.07,.075],[0,0,0],false)}}
  for(let i=0;i<3;i++)add(ball,k.mat(0xc58d4b),[.75+i*.05,1.0,-.2+i*.12],[.17,.07,.08],[0,.4*i,0],false);
  // Sloped striped awning with a scalloped valance.
  const top=add(box,canvas,[0,2.55,.05],[2.7,.04,1.9],[-.16,0,0]);top.material=canvas;add(box,canvas,[0,2.33,1.0],[2.7,.28,.02]);
  for(let i=0;i<9;i++)add(k.geo('flap',()=>new T.ConeGeometry(.15,.16,3)),canvas,[-1.2+i*.3,2.12,1.0],[1,1,.2],[Math.PI,0,0],false);},
 lantern({T,k,add,box,cyl}){const stone=k.mat(STONE,'masonry'),wood=k.mat(0x5d4430,'wood'),iron=k.mat(0x2b2e30,'metal');
  add(cyl,stone,[0,.18,0],[.24,.36,.24]);add(k.geo('post8',()=>new T.CylinderGeometry(.08,.1,1,8)),wood,[0,1.75,0],[1,3.1,1]);add(cyl,iron,[0,3.32,0],[.11,.08,.11]);
  add(box,iron,[.35,3.18,0],[.75,.05,.05]);add(box,iron,[.15,2.98,0],[.05,.42,.05],[0,0,-.7]);add(box,iron,[.66,3.06,0],[.02,.2,.02]);
  // Hanging lantern: iron frame, glowing panes, little roof.
  const glow=k.mat(0xffd08a,null,{emissive:0xffb35c,emissiveIntensity:1.4,roughness:.4});
  add(box,glow,[.66,2.72,0],[.22,.3,.22],[0,0,0],false);for(const sx of [-1,1])for(const sz of [-1,1])add(box,iron,[.66+sx*.11,2.72,sz*.11],[.025,.34,.025]);
  add(k.geo('cap4',()=>new T.ConeGeometry(.2,.16,4)),iron,[.66,2.95,0],[1,1,1],[0,Math.PI/4,0]);add(box,iron,[.66,2.56,0],[.26,.04,.26]);},
 well({T,k,add,box,cyl}){const stone=k.mat(0x8f8a7e,'masonry'),wood=k.mat(0x6e4f33,'wood'),roof=k.mat(0x6a4a36,'roof'),dark=k.mat(0x1d2326),water=k.mat(0x3f6f80,null,{roughness:.15});
  add(k.geo('wellring',()=>new T.CylinderGeometry(1,1.05,.95,16,1,true)),stone,[0,.47,0]);add(k.geo('wellcap',()=>new T.TorusGeometry(1,.1,6,16)),stone,[0,.95,0],[1,1,1],[Math.PI/2,0,0]);
  add(k.geo('wellin',()=>new T.CylinderGeometry(.9,.9,.9,16,1,true)),dark,[0,.5,0],[1,1,1],[0,0,0],false);add(k.geo('disc',()=>new T.CircleGeometry(.9,16)),water,[0,.35,0],[1,1,1],[-Math.PI/2,0,0],false);
  for(const x of [-.95,.95])add(box,wood,[x,1.45,0],[.13,2.1,.13]);add(cyl,wood,[0,2.2,0],[.07,1.95,.07],[0,0,Math.PI/2]);add(box,wood,[1.12,2.2,0],[.05,.05,.3]);
  for(const s of [-1,1])add(box,roof,[0,2.72,s*.5],[2.5,.07,1.15],[s*.55,0,0]);add(box,wood,[0,2.98,0],[2.55,.1,.1]);
  add(cyl,wood,[0,1.55,0],[.16,.26,.16]);add(cyl,k.mat(IRON,'metal'),[0,1.66,0],[.165,.03,.165]);add(box,k.mat(0xb59c6f),[0,1.9,0],[.015,.5,.015]);}
};

// The fountain keeps its animated streams; give the basin masonry and a rim.
export function dressFountain(T,group){const k=kit(T),stone=k.mat(0xa29d90,'masonry');group.traverse(o=>{if(o.isMesh&&o.geometry.type==='CylinderGeometry'&&o.material.color?.getHex?.()===0x92998e)o.material=stone});
 const rim=new T.Mesh(k.geo('rim8',()=>new T.CylinderGeometry(2.05,2.15,.22,8)),stone);rim.position.y=.72;rim.castShadow=rim.receiveShadow=true;group.add(rim);
 const water=group.children.find(o=>o.isMesh&&o.material.color?.getHex?.()===0x659bb7);if(water)water.material=k.mat(0x4f8ea3,null,{roughness:.12,metalness:.1,transparent:true,opacity:.85});}
