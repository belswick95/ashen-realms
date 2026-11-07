// See-through canopies. When a tree crown stands between the camera and the local player, its
// leaf cards fade to CANOPY_FADE_OPACITY over CANOPY_FADE_SECONDS and fade back once it no longer
// blocks the view.
//
// Cost model (phones first):
// - Leaf materials get one shader hook at build time with a constant program cache key, so every
//   leaf material, faded or not, shares one program and nothing recompiles at runtime.
// - The fade is a per-instance float (InstancedBufferAttribute `canopyFade`, one per leaf card).
//   The fragment shader turns it into an ordered 4x4 screen-door dither, so the leaves stay in the
//   opaque, alpha-tested pass: no sorting, no blending, no extra draw calls, no material swaps.
//   The shadow pass uses three's own depth material, so shadows do not change.
// - The occlusion test (a camera-to-player capsule against canopy bounding spheres, found through
//   a uniform grid) runs at about 10 Hz; per-frame work only steps the trees that are fading.
//   Nothing allocates after setup.
export const CANOPY_FADE_OPACITY=.3;
export const CANOPY_FADE_SECONDS=.2;
export const CANOPY_FADE_KEY='eldervale-canopy-fade';
const VERTEX_HEAD='attribute float canopyFade;\nvarying float vCanopyFade;\n';
const FRAGMENT_HEAD='varying float vCanopyFade;\nfloat canopyBayer2(vec2 a){a=floor(a);return fract(a.x*.5+a.y*a.y*.75);}\nfloat canopyBayer4(vec2 a){return canopyBayer2(.5*a)*.25+canopyBayer2(a);}\n';
const FRAGMENT_TEST='if(vCanopyFade<.999&&canopyBayer4(gl_FragCoord.xy)+.03125>=vCanopyFade)discard;\n';
// The hook works on any lit material that has the standard chunks (Standard and Lambert).
export function canopyFadeShader(shader){
 shader.vertexShader=VERTEX_HEAD+shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvCanopyFade=canopyFade;');
 shader.fragmentShader=FRAGMENT_HEAD+shader.fragmentShader.replace('#include <alphatest_fragment>','#include <alphatest_fragment>\n'+FRAGMENT_TEST);
}
const canopyCacheKey=()=>CANOPY_FADE_KEY;
// Install the hook on a leaf material (once, when it is built).
export function canopyFadeMaterial(material){
 material.onBeforeCompile=canopyFadeShader;material.customProgramCacheKey=canopyCacheKey;material.userData.canopyFade=true;return material;
}
// One float per instance, 1 = fully drawn.
export function canopyFadeAttribute(T,count){
 const attribute=new T.InstancedBufferAttribute(new Float32Array(count).fill(1),1);attribute.setUsage(T.DynamicDrawUsage);return attribute;
}
// A tree record: its canopy bounding sphere in the leaf mesh's local space, its run of leaf
// instances [start,end) and, optionally, its run of limb instances in another batch. Records are
// built once and reused for the lifetime of the mesh.
export function canopyRecord(mesh,x,y,z,r,start,end,limbs=null,limbStart=0,limbEnd=0){return {mesh,x,y,z,r,start,end,limbs,limbStart,limbEnd,fade:1,target:1,hit:0,active:false}}
// The limb material for a wood material: one hooked clone per source, shared by every tree.
const limbCache=new WeakMap();
export function canopyLimbMaterial(wood){let m=limbCache.get(wood);if(!m){m=canopyFadeMaterial(wood.clone());m.userData.eldervaleShared=true;limbCache.set(wood,m)}return m}
// Bounding sphere around a run of leaf cards ({x,y,z,sx,sy}).
export function canopySphere(cards,start,end){
 let x=0,y=0,z=0;const n=Math.max(1,end-start);
 for(let i=start;i<end;i++){x+=cards[i].x;y+=cards[i].y;z+=cards[i].z}
 x/=n;y/=n;z/=n;let r=0;
 for(let i=start;i<end;i++){const c=cards[i];r=Math.max(r,Math.hypot(c.x-x,c.y-y,c.z-z)+Math.max(c.sx,c.sy)*.5)}
 return {x,y,z,r};
}
// Squared distance from point C to segment AB.
export function segmentPointDistanceSq(ax,ay,az,bx,by,bz,cx,cy,cz){
 const dx=bx-ax,dy=by-ay,dz=bz-az,len=dx*dx+dy*dy+dz*dz;
 let t=len>0?((cx-ax)*dx+(cy-ay)*dy+(cz-az)*dz)/len:0;t=t<0?0:t>1?1:t;
 const ex=ax+dx*t-cx,ey=ay+dy*t-cy,ez=az+dz*t-cz;return ex*ex+ey*ey+ez*ez;
}
// The fader. Static meshes (the natural forest: world-space instances that never move) go into a
// uniform grid once; dynamic meshes (placed trees, which the world editor can move) are passed to
// test() as a short list of nearby canopies and transformed by their world matrix.
export function createCanopyFader({cell=16,opacity=CANOPY_FADE_OPACITY,seconds=CANOPY_FADE_SECONDS,capsule=.45,shrink=.85}={}){
 const grid=new Map(),active=[];let stamp=0,maxRadius=0;
 const keyOf=(ix,iz)=>(ix+32768)*65536+(iz+32768);
 function addStatic(mesh){
  for(const rec of mesh.userData.canopyTrees||[]){
   const ix=Math.floor(rec.x/cell),iz=Math.floor(rec.z/cell),key=keyOf(ix,iz);let list=grid.get(key);if(!list)grid.set(key,list=[]);list.push(rec);maxRadius=Math.max(maxRadius,rec.r);
  }
 }
 function mark(rec){
  rec.hit=stamp;rec.target=opacity;if(!rec.active){rec.active=true;active.push(rec)}
 }
 function hits(rec,ax,ay,az,bx,by,bz,cx,cy,cz,r){
  const reach=r*shrink+capsule;return segmentPointDistanceSq(ax,ay,az,bx,by,bz,cx,cy,cz)<reach*reach;
 }
 // from: camera position; to: the point to keep visible (the player's chest). dynamic: iterable of
 // leaf meshes carrying userData.canopyTrees in local space (an array, so no iterator allocates).
 function test(from,to,dynamic=null){
  stamp++;const ax=from.x,ay=from.y,az=from.z,bx=to.x,by=to.y,bz=to.z;
  const pad=maxRadius+capsule,x0=Math.floor((Math.min(ax,bx)-pad)/cell),x1=Math.floor((Math.max(ax,bx)+pad)/cell),z0=Math.floor((Math.min(az,bz)-pad)/cell),z1=Math.floor((Math.max(az,bz)+pad)/cell);
  if((x1-x0+1)*(z1-z0+1)<=64)for(let ix=x0;ix<=x1;ix++)for(let iz=z0;iz<=z1;iz++){const list=grid.get(keyOf(ix,iz));if(!list)continue;
   for(let i=0;i<list.length;i++){const rec=list[i];if(rec.mesh.visible&&hits(rec,ax,ay,az,bx,by,bz,rec.x,rec.y,rec.z,rec.r))mark(rec)}}
  if(dynamic)for(let m=0;m<dynamic.length;m++){const mesh=dynamic[m],recs=mesh.userData.canopyTrees;if(!recs)continue;
   const e=mesh.matrixWorld.elements,scale=Math.sqrt(Math.max(e[0]*e[0]+e[1]*e[1]+e[2]*e[2],e[4]*e[4]+e[5]*e[5]+e[6]*e[6],e[8]*e[8]+e[9]*e[9]+e[10]*e[10]));
   for(let i=0;i<recs.length;i++){const rec=recs[i],cx=e[0]*rec.x+e[4]*rec.y+e[8]*rec.z+e[12],cy=e[1]*rec.x+e[5]*rec.y+e[9]*rec.z+e[13],cz=e[2]*rec.x+e[6]*rec.y+e[10]*rec.z+e[14];
    if(hits(rec,ax,ay,az,bx,by,bz,cx,cy,cz,rec.r*scale))mark(rec)}}
  for(let i=0;i<active.length;i++){const rec=active[i];if(rec.hit!==stamp)rec.target=1}
 }
 // Per frame: step fading trees toward their targets and write their leaf instances.
 function update(dt){
  if(!active.length)return 0;const step=Math.max(0,dt)*(1-opacity)/seconds;
  for(let i=active.length-1;i>=0;i--){const rec=active[i];
   if(rec.fade!==rec.target){rec.fade=rec.fade<rec.target?Math.min(rec.target,rec.fade+step):Math.max(rec.target,rec.fade-step);
    const attribute=rec.mesh.geometry.attributes.canopyFade;if(attribute){attribute.array.fill(rec.fade,rec.start,rec.end);attribute.needsUpdate=true}
    const limbs=rec.limbs&&rec.limbs.geometry.attributes.canopyFade;if(limbs){limbs.array.fill(rec.fade,rec.limbStart,rec.limbEnd);limbs.needsUpdate=true}}
   if(rec.fade===1&&rec.target===1){rec.active=false;active[i]=active[active.length-1];active.pop()}}
  return active.length;
 }
 // Fade everything back (cutscenes, upper floors); reset() snaps back at once.
 function release(){stamp++;for(let i=0;i<active.length;i++)active[i].target=1}
 function reset(){release();update(seconds)}
 return {addStatic,test,update,release,reset,get active(){return active},get cells(){return grid.size}};
}
