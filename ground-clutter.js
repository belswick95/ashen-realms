// Ground clutter: small, non-solid detail underfoot - grass tufts, pebbles, twigs, flowers and
// gravel along the path edges. All original low-poly shapes, placed by a seeded hash around the
// player, so every client sees the same scatter. One InstancedMesh per kind (4 draw calls at most),
// one shared Lambert program in both regular and Classic graphics, instances fade out by distance
// in the vertex shader and the patch is rebuilt in time slices only when the player crosses a cell.
// Counts and radius follow the graphics preset; phones get the low budget.
import {seededRandom,biomeWeights} from './procedural-world.js?v=release-20261107-move3v161';
import {runFrameWork} from './frame-work.js?v=release-20261107-move3v161';
export const CLUTTER_KINDS=['tuft','pebble','twig','flower'];
// Instance budgets per preset. Classic leans on tufts and flowers (its grass field is hidden);
// regular keeps its blade meadow and adds the hard detail (pebbles, twigs, gravel) plus a few clumps.
export const CLUTTER_BUDGET={
 low:{radius:26,tuft:900,pebble:450,twig:120,flower:160},
 medium:{radius:34,tuft:1800,pebble:800,twig:220,flower:300},
 high:{radius:42,tuft:3000,pebble:1200,twig:340,flower:480},
 ultra:{radius:50,tuft:4200,pebble:1600,twig:460,flower:640}
};
export function clutterBudget(preset='high',{classic=false,phone=false}={}){
 const b={...(CLUTTER_BUDGET[phone?'low':preset]||CLUTTER_BUDGET.high)};
 if(!classic){b.tuft=Math.round(b.tuft*.35);b.flower=0}
 return b;
}
// What (if anything) grows at one candidate point. `cover` is how much of it is drawn as path,
// `edge` the raw path mask there (0 out in the grass .. 1 on the path), `w` the biome weights and
// `r` a seeded random source. Pure, for the tests.
export function clutterKind(cover,edge,w,r){
 const lush=w.grass+w.castle,v=r();
 if(cover>.55)return v<.015?'pebble':v<.022?'twig':null;// a few stones on the trail itself
 if(edge>.16&&cover<.5)return v<.10?'pebble':null;// some gravel spilling over the verges
 if(v<.30*lush+.06*w.dry)return 'tuft';
 if(v<.30*lush+.06*w.dry+.035*lush*(1-w.snow))return 'flower';
 if(v<.30*lush+.06*w.dry+.035*lush+.022)return 'pebble';
 if(v<.30*lush+.06*w.dry+.035*lush+.022+.012*(1-w.snow))return 'twig';
 return null;
}
function merge(T,parts){
 const pos=[],col=[],nor=[];for(const p of parts){pos.push(...p.pos);col.push(...p.col);nor.push(...p.nor)}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('color',new T.Float32BufferAttribute(col,3));g.setAttribute('normal',new T.Float32BufferAttribute(nor,3));g.userData.eldervaleShared=true;g.userData.noClassicSimplify=true;return g;
}
// Shapes (unit size, sitting on y = 0).
export function clutterGeometries(T){
 // Tuft: seven chunky blades in a clump, normals straight up so the clump shades softly like the
 // ground under it; dark at the root, light at the tips.
 const tuft={pos:[],col:[],nor:[]};
 for(let i=0;i<7;i++){const a=i*2.39996+.3,lean=.10+(i%3)*.05,h=.26+(i%4)*.05,w=.055,ca=Math.cos(a),sa=Math.sin(a),ox=ca*.05*(i%2+1),oz=sa*.05*(i%2+1);
  const px=-sa,pz=ca;tuft.pos.push(ox-px*w,0,oz-pz*w,ox+px*w,0,oz+pz*w,ox+ca*lean,h,oz+sa*lean);tuft.col.push(.50,.55,.42,.50,.55,.42,1.05,1.05,.95);for(let k=0;k<3;k++)tuft.nor.push(0,1,0)}
 // Pebble: a squat, faceted stone.
 const ico=new T.IcosahedronGeometry(1,0),ip=ico.attributes.position,inn=ico.attributes.normal,pebble={pos:[],col:[],nor:[]};
 for(let i=0;i<ip.count;i++){const y=ip.getY(i);pebble.pos.push(ip.getX(i),Math.max(-.2,y)*.55+.11,ip.getZ(i));const l=.78+.3*Math.max(0,y);pebble.col.push(l,l,l);pebble.nor.push(inn.getX(i),inn.getY(i),inn.getZ(i))}ico.dispose();
 // Twig: a thin bent stick with one side shoot.
 const twig={pos:[],col:[],nor:[]},stick=(x0,z0,x1,z1,r)=>{const dx=x1-x0,dz=z1-z0,l=Math.hypot(dx,dz)||1,nx=-dz/l*r,nz=dx/l*r;for(const [a,b,c] of [[[x0-nx,r*.2,z0-nz],[x1-nx,r*.2,z1-nz],[x1,r*1.8,z1]],[[x0-nx,r*.2,z0-nz],[x1,r*1.8,z1],[x0,r*1.8,z0]],[[x0,r*1.8,z0],[x1,r*1.8,z1],[x1+nx,r*.2,z1+nz]],[[x0,r*1.8,z0],[x1+nx,r*.2,z1+nz],[x0+nx,r*.2,z0+nz]]]){twig.pos.push(...a,...b,...c);for(let k=0;k<3;k++){twig.col.push(1,1,1);twig.nor.push(0,1,0)}}};
 stick(-.5,0,0,.06,.022);stick(0,.06,.5,-.02,.018);stick(.05,.05,.25,.22,.012);
 // Flower: a short stem and a five-petal head.
 const flower={pos:[],col:[],nor:[]};flower.pos.push(-.012,0,0,.012,0,0,0,.13,0);flower.col.push(.30,.42,.22,.30,.42,.22,.30,.42,.22);for(let k=0;k<3;k++)flower.nor.push(0,1,0);
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5,b=a+.55,c=a-.55;flower.pos.push(0,.13,0,Math.cos(b)*.035,.135,Math.sin(b)*.035,Math.cos(a)*.075,.14,Math.sin(a)*.075,0,.13,0,Math.cos(a)*.075,.14,Math.sin(a)*.075,Math.cos(c)*.035,.135,Math.sin(c)*.035);for(let k=0;k<6;k++){flower.col.push(...(k%3===0?[1.1,1.0,.55]:[1,1,1]));flower.nor.push(0,1,0)}}
 return {tuft:merge(T,[tuft]),pebble:merge(T,[pebble]),twig:merge(T,[twig]),flower:merge(T,[flower])};
}
const TUFT=[0x4c6a2a,0x587a30,0x67853a,0x46602c,0x6f8a3e],TUFT_DRY=[0x8d8a4a,0x9a9152,0x7e7c42],PEBBLE=[0x8d877b,0x777166,0x9f9686,0x6c665c,0xa49a87],
 // Stones on and beside the trail: darker grey-brown, so they never read as bright dots on the dirt.
 PATH_PEBBLE=[0x5a5248,0x655b4e,0x4e483f,0x6d6355,0x5f5a52],TWIG=[0x5b4129,0x6d5234,0x4e3a26],FLOWER=[0xf0d35a,0xf4f1e4,0xd27bb0,0x9fb3e6,0xe0743f,0xf3e9a2];
export function clutterColor(kind,w,r,onPath=false){
 const pick=a=>a[Math.floor(r()*a.length)%a.length];
 if(kind==='tuft')return w.dry>.55||w.snow>.6?pick(TUFT_DRY):pick(TUFT);
 if(kind==='pebble')return pick(onPath?PATH_PEBBLE:PEBBLE);if(kind==='twig')return pick(TWIG);return pick(FLOWER);
}
export function createGroundClutter(T,scene,land,{seed=1,paths=null,canPlant=()=>true}={}){
 const geometries=clutterGeometries(T),uniforms={clutterFocus:{value:new T.Vector2()},clutterRange:{value:42}};
 const material=new T.MeshLambertMaterial({vertexColors:true,side:T.DoubleSide});
 material.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nuniform vec2 clutterFocus;uniform float clutterRange;').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed*=1.-smoothstep(clutterRange*.78,clutterRange,distance(instanceMatrix[3].xz,clutterFocus));')};
 material.customProgramCacheKey=()=>'ground-clutter';material.userData.classicKeep=true;material.userData.eldervaleShared=true;
 const cap=CLUTTER_BUDGET.ultra,meshes={},staging={};
 for(const kind of CLUTTER_KINDS){const m=new T.InstancedMesh(geometries[kind],material,cap[kind]);m.count=0;m.name='ground-clutter-'+kind;m.receiveShadow=true;m.castShadow=false;m.userData.terrainFixed=true;m.userData.groundClutter=kind;m.instanceMatrix.setUsage(T.DynamicDrawUsage);m.setColorAt(0,new T.Color());scene.add(m);meshes[kind]=m;staging[kind]={matrix:new Float32Array(cap[kind]*16),color:new Float32Array(cap[kind]*3)}}
 let budget=clutterBudget('high'),cell='',pending=false,version=0,enabled=true;const dummy=new T.Object3D(),color=new T.Color();
 function* build(cx,cz,ticket){
  const R=budget.radius,spacing=.9,bands=[],counts={tuft:0,pebble:0,twig:0,flower:0};let steps=0;
  for(let ix=Math.floor((cx-R)/spacing);ix<=Math.ceil((cx+R)/spacing);ix++)for(let iz=Math.floor((cz-R)/spacing);iz<=Math.ceil((cz+R)/spacing);iz++){const d=Math.hypot(ix*spacing-cx,iz*spacing-cz);if(d>R)continue;(bands[Math.floor(d/4)]??=[]).push(ix,iz);if(++steps%2048===0)yield}
  for(const band of bands){if(!band)continue;for(let k=0;k<band.length;k+=2){
   if(ticket!==version)return;if(++steps%256===0)yield;
   const ix=band[k],iz=band[k+1],r=seededRandom((seed^0x7f4a7c15^Math.imul(ix,73856093)^Math.imul(iz,19349663))>>>0),x=(ix+.1+r()*.8)*spacing,z=(iz+.1+r()*.8)*spacing;
   const m=paths?paths.sample(x,z):{cover:0},cover=paths?paths.cover(x,z):0,w=biomeWeights(x,z,seed),kind=clutterKind(cover,m.cover,w,r);
   if(!kind||counts[kind]>=budget[kind])continue;
   if(land.waterAt(x,z)>0||!canPlant(x,z,kind))continue;
   const y=land.heightAt(x,z);let s;
   if(kind==='tuft'){s=.75+r()*.65;dummy.scale.set(s,s*(.8+r()*.5),s);dummy.rotation.set(0,r()*6.283,0)}
   else if(kind==='pebble'){const trail=cover>.55||m.cover>.16;s=trail?.04+r()*r()*.07:.07+r()*r()*.13;dummy.scale.set(s*(1+r()*.6),s*(trail?.7:1),s*(.8+r()*.4));dummy.rotation.set((r()-.5)*.4,r()*6.283,(r()-.5)*.4)}
   else if(kind==='twig'){s=.45+r()*.55;dummy.scale.set(s,1,s);dummy.rotation.set(0,r()*6.283,(r()-.5)*.08)}
   else {s=.8+r()*.6;dummy.scale.setScalar(s);dummy.rotation.set(0,r()*6.283,0)}
   dummy.position.set(x,y-.01,z);dummy.updateMatrix();const st=staging[kind],n=counts[kind]++;dummy.matrix.toArray(st.matrix,n*16);
   color.setHex(clutterColor(kind,w,r,kind==='pebble'&&(cover>.55||m.cover>.16)));color.multiplyScalar(.88+r()*.24);st.color[n*3]=color.r;st.color[n*3+1]=color.g;st.color[n*3+2]=color.b;
  }}
  if(ticket!==version)return;
  for(const kind of CLUTTER_KINDS){const mesh=meshes[kind],n=counts[kind];mesh.instanceMatrix.array.set(staging[kind].matrix.subarray(0,n*16));mesh.instanceColor.array.set(staging[kind].color.subarray(0,n*3));mesh.count=n;mesh.instanceMatrix.needsUpdate=true;mesh.instanceColor.needsUpdate=true;if(n)mesh.computeBoundingSphere();else mesh.boundingSphere=null;mesh.visible=enabled&&n>0}
 }
 function schedule(x,z){pending=true;const ticket=++version;void runFrameWork(build(x,z,ticket)).catch(error=>{cell='';console.warn('Ground clutter:',error)}).finally(()=>{if(ticket===version)pending=false})}
 return {meshes,material,uniforms,get busy(){return pending},get budget(){return budget},
  stats(){const out={};for(const k of CLUTTER_KINDS)out[k]=meshes[k].visible?meshes[k].count:0;return out},
  // Graphics preset / Classic switch: new budget, fresh scatter.
  configure({preset='high',classic=false,phone=false,on=true}={}){budget=clutterBudget(preset,{classic,phone});uniforms.clutterRange.value=budget.radius;enabled=on;for(const m of Object.values(meshes))m.visible=on&&m.count>0;cell=''},
  update(player){uniforms.clutterFocus.value.set(player.x,player.z);if(!enabled)return;const step=6,next=Math.floor(player.x/step)+':'+Math.floor(player.z/step);if(next===cell)return;cell=next;schedule(Math.floor(player.x/step)*step+step/2,Math.floor(player.z/step)*step+step/2)},
  invalidate(){cell=''}};
}
