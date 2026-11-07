// Ground paths: trails and streets are splatted into the terrain shader instead of being laid on
// top as flat ribbons. Every path (world roads, town lanes, castle and capital streets, plazas) is
// painted once into a small world-space mask texture; the terrain shader samples it per pixel,
// breaks its edges up with procedural noise and draws a procedural surface: Voronoi cobblestones
// in towns, the castle and the capital, packed earth with pebbles in the countryside.
// Paths are visual only. Centrelines, the terrain grading, the server tile grid and collision all
// keep using the original road data; the drawn path wanders a little around it (meander()), within
// the graded road bed, and comes back to it at junctions and doors.
// Everything is original and procedural. Pure helpers are exported for the unit tests.
import {seedNoise} from './procedural-world.js?v=release-20261107-qa2g163';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
// Mask channels: R dirt cover, G cobble cover, B centre (1 on the centreline, worn), A unused.
export const PATH_MASK={size:1024,soft:.9};
// Signed noise (-1..1) along a path, two octaves.
const wobble=(s,seed,wavelength)=>(seedNoise(s/wavelength,0,seed)*2-1)*.72+(seedNoise(s/(wavelength*.37),3,seed+7)*2-1)*.28;
export function pathSeed(points,salt=0){const a=points[0],b=points.at(-1);return (Math.imul(Math.round(a[0]*16)|0,73856093)^Math.imul(Math.round(a[1]*16)|0,19349663)^Math.imul(Math.round(b[0]*16)|0,83492791)^Math.imul(Math.round(b[1]*16)|0,2654435761)^salt)>>>0}
// Resample a centreline every `step` metres and push it sideways by gentle low-frequency noise, so
// a straight leg becomes a lightly winding trail. The offset fades to zero over `taper` metres at
// both ends: junctions, doors and town squares stay exactly where the route data puts them.
export function meander(points,{amplitude=1,wavelength=24,seed=1,taper=8,step=1.5}={}){
 const pts=points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>1e-6);if(pts.length<2)return pts.map(p=>[...p]);
 const cum=[0];for(let i=1;i<pts.length;i++)cum.push(cum[i-1]+Math.hypot(pts[i][0]-pts[i-1][0],pts[i][1]-pts[i-1][1]));
 const L=cum.at(-1),n=Math.max(2,Math.ceil(L/step)),out=[];let j=1;
 const at=s=>{while(j<pts.length-1&&cum[j]<s)j++;const a=pts[j-1],b=pts[j],t=clamp((s-cum[j-1])/Math.max(1e-9,cum[j]-cum[j-1]));return [a[0]+(b[0]-a[0])*t,a[1]+(b[1]-a[1])*t]};
 const base=[];for(let k=0;k<=n;k++)base.push(at(L*k/n));
 for(let k=0;k<=n;k++){
  const s=L*k/n,p=base[k],q=base[Math.min(n,k+1)],r=base[Math.max(0,k-1)],dx=q[0]-r[0],dz=q[1]-r[1],len=Math.hypot(dx,dz)||1;
  const fade=taper>0?smooth(0,taper,s)*smooth(0,taper,L-s):1,o=amplitude*wobble(s,seed,wavelength)*fade;
  out.push([p[0]-dz/len*o,p[1]+dx/len*o,s]);
 }
 return out;
}
// Half width at distance `s` along a path: varies by about +-16 % so the trail swells and narrows.
export function halfWidthAt(width,s,seed,variation=.16){return width/2*(1+variation*wobble(s,seed+101,17))}
// One stroke per path. `kind` is 'dirt' or 'cobble'; dirt strokes turn to cobble where `paved(x,z)`.
// Lines carry resampled, meandered points [x,z,s]; discs are plazas with a softly irregular rim.
export function roadStroke(points,{width=2.9,kind='dirt',amplitude=1.4,wavelength=26,taper=10,salt=0}={}){
 const seed=pathSeed(points,salt);return {type:'line',kind,width,seed,points:meander(points,{amplitude,wavelength,seed,taper})}}
// A road entity (x, z, yaw in degrees, length along its local z, width): a straight bar becomes a
// gently curving lane that keeps both of its ends (doors, junctions) in place.
export function entityStroke(d,kind){
 const scale=d.scale||1,a=(d.yaw||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),l=(d.length||10)*scale/2,w=(d.width||2.5)*scale;
 const end=v=>[d.x+v*s,d.z+v*c];const points=[end(-l),end(l)];
 return roadStroke(points,{width:w,kind,amplitude:Math.min(1.1,w*.16,l*.1),wavelength:Math.max(8,Math.min(18,l)),taper:Math.min(6,l*.45),salt:0x51ed})}
export function discStroke(x,z,radius,kind='cobble',salt=0){return {type:'disc',kind,x,z,radius,seed:pathSeed([[x,z],[x+radius,z]],salt)}}
// Paint strokes into an RGBA mask covering [-extent/2, extent/2] on x and z.
// `pavedCache` (Int8Array, size*size, -1 = unknown) may persist between repaints: paved() is fixed.
export function paintPathMask(data,strokes,{size=PATH_MASK.size,extent=840,soft=PATH_MASK.soft,paved=()=>false,pavedCache=null}={}){
 data.fill(0);
 const texel=extent/size,half=extent/2,toI=v=>Math.floor((v+half)/texel);
 const put=(ix,iz,cover,core,cobble)=>{const o=(iz*size+ix)*4,c=Math.round(cover*255),k=Math.round(core*255),ch=cobble?1:0;if(c>data[o+ch])data[o+ch]=c;if(k>data[o+2])data[o+2]=k};
 const cache=pavedCache||new Int8Array(size*size).fill(-1);const pavedAt=(ix,iz,x,z)=>{const key=iz*size+ix;let v=cache[key];if(v<0)v=cache[key]=paved(x,z)?1:0;return v===1};
 for(const st of strokes){
  if(st.type==='disc'){
   const reach=st.radius*1.2+soft;
   for(let iz=Math.max(0,toI(st.z-reach));iz<=Math.min(size-1,toI(st.z+reach));iz++)for(let ix=Math.max(0,toI(st.x-reach));ix<=Math.min(size-1,toI(st.x+reach));ix++){
    const x=-half+(ix+.5)*texel,z=-half+(iz+.5)*texel,dx=x-st.x,dz=z-st.z,ang=Math.atan2(dz,dx),r=st.radius*(1+.07*Math.sin(ang*3+st.seed%7)+.045*Math.sin(ang*7+st.seed%5)),d=Math.hypot(dx,dz);
    const cover=clamp(.5-(d-r)/(2*soft));if(cover<=0)continue;put(ix,iz,cover,clamp(1-d/r),st.kind==='cobble'||pavedAt(ix,iz,x,z));
   }
   continue;
  }
  const p=st.points;
  for(let k=1;k<p.length;k++){
   const a=p[k-1],b=p[k],ha=halfWidthAt(st.width,a[2],st.seed),hb=halfWidthAt(st.width,b[2],st.seed),reach=Math.max(ha,hb)+soft+texel;
   const dx=b[0]-a[0],dz=b[1]-a[1],len2=dx*dx+dz*dz||1e-9;
   for(let iz=Math.max(0,toI(Math.min(a[1],b[1])-reach));iz<=Math.min(size-1,toI(Math.max(a[1],b[1])+reach));iz++)for(let ix=Math.max(0,toI(Math.min(a[0],b[0])-reach));ix<=Math.min(size-1,toI(Math.max(a[0],b[0])+reach));ix++){
    const x=-half+(ix+.5)*texel,z=-half+(iz+.5)*texel,t=clamp(((x-a[0])*dx+(z-a[1])*dz)/len2),d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t),hw=ha+(hb-ha)*t;
    const cover=clamp(.5-(d-hw)/(2*soft));if(cover<=0)continue;put(ix,iz,cover,clamp(1-d/hw),st.kind==='cobble'||pavedAt(ix,iz,x,z));
   }
  }
 }
 return data;
}
// Bilinear read of the mask at a world point: {dirt, cobble, core, cover} in 0..1.
export function sampleMask(data,x,z,{size=PATH_MASK.size,extent=840}={}){
 const texel=extent/size,gx=clamp((x+extent/2)/texel-.5,0,size-1),gz=clamp((z+extent/2)/texel-.5,0,size-1),ix=Math.min(size-2,Math.floor(gx)),iz=Math.min(size-2,Math.floor(gz)),u=gx-ix,v=gz-iz;
 const read=ch=>{const o=(iz*size+ix)*4+ch,r=size*4;return ((data[o]*(1-u)+data[o+4]*u)*(1-v)+(data[o+r]*(1-u)+data[o+r+4]*u)*v)/255};
 const dirt=read(0),cobble=read(1);return {dirt,cobble,core:read(2),cover:Math.max(dirt,cobble)};
}
// Edge break-up, the same value noise the shader uses (CPU copy for clutter and grass placement).
function hash(x,z){const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n)}
function vnoise(x,z){const ix=Math.floor(x),iz=Math.floor(z);let u=x-ix,v=z-iz;u=u*u*(3-2*u);v=v*v*(3-2*v);return (hash(ix,iz)*(1-u)+hash(ix+1,iz)*u)*(1-v)+(hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u)*v}
export function edgeBreak(x,z){return (vnoise(x*.55,z*.55)-.5)*.42+(vnoise(x*1.9+7.1,z*1.9+7.1)-.5)*.22}
// How much of a point is drawn as path (0 grass .. 1 path), matching the shader's edge.
export function pathCover(data,x,z,options){const m=sampleMask(data,x,z,options),b=edgeBreak(x,z);return Math.max(smooth(.40,.60,m.dirt+b),smooth(.42,.58,m.cobble+b*.7))}

// ---------------------------------------------------------------------------------------------
// Shader. One chunk, injected into the regular terrain (MeshStandardMaterial) and the Classic
// terrain (MeshLambertMaterial). Classic builds with GROUND_CLASSIC: bigger, flat-coloured stones
// and painterly dirt, no per-pixel normals. Neither variant adds a program: each terrain material
// stays one program, and the mask is a uniform.
export const GROUND_VERTEX_PARS='varying vec2 vGroundWorld;';
export const GROUND_VERTEX='vGroundWorld=(modelMatrix*vec4(transformed,1.)).xz;';
export const GROUND_FRAGMENT_PARS=`
uniform sampler2D groundPathMask;uniform vec4 groundPathFrame;varying vec2 vGroundWorld;
float gpHash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
vec2 gpHash2(vec2 p){return fract(sin(vec2(dot(p,vec2(127.1,311.7)),dot(p,vec2(269.5,183.3))))*43758.5453);}
float gpNoise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(gpHash(i),gpHash(i+vec2(1.,0.)),f.x),mix(gpHash(i+vec2(0.,1.)),gpHash(i+1.),f.x),f.y);}
// Voronoi cells: x = distance to the nearest centre, y = distance to the cell border (approx.),
// z, w = two random values for the cell; toCentre points from the pixel to the cell's centre.
vec4 gpCells(vec2 p,out vec2 toCentre){vec2 i=floor(p),f=fract(p);float f1=8.,f2=8.;vec2 best=vec2(0.),id=vec2(0.);
 for(int y=-1;y<=1;y++)for(int x=-1;x<=1;x++){vec2 g=vec2(float(x),float(y)),r=g+gpHash2(i+g)*.76+.12-f;float d=dot(r,r);if(d<f1){f2=f1;f1=d;best=r;id=i+g;}else if(d<f2)f2=d;}
 toCentre=best;f1=sqrt(f1);return vec4(f1,sqrt(f2)-f1,gpHash(id),gpHash(id+17.31));}
`;
// After <color_fragment>: diffuseColor holds the ground colour. Adds broad colour variation to
// grass, then the path surface. Leaves gpAmount / gpTilt for the normal step.
export const GROUND_FRAGMENT=`
vec2 gpP=vGroundWorld;vec3 gpTilt=vec3(0.);float gpAmount=0.;
{
 float gpGreen=clamp((diffuseColor.g-max(diffuseColor.r,diffuseColor.b))*9.,0.,1.);
 float gpM1=gpNoise(gpP*.021+vec2(4.7,1.3)),gpM2=gpNoise(gpP*.075+vec2(9.2,3.3)),gpM3=gpNoise(gpP*.31+vec2(1.9,8.4));
#ifdef GROUND_CLASSIC
 // Soft, painterly patches: deeper olive and lighter yellow-green over tens of metres.
 vec3 gpTint=mix(vec3(1.10,1.0,.40),vec3(.86,1.0,.62),smoothstep(.2,.8,gpM1));
 float gpLight=.74+.46*smoothstep(.15,.85,gpM2)+.12*(gpM3-.5);
#else
 vec3 gpTint=mix(vec3(1.14,1.05,.74),vec3(.80,.95,.92),smoothstep(.2,.8,gpM1));
 float gpLight=.80+.34*smoothstep(.1,.9,gpM2)-.16*smoothstep(.62,.86,gpM3);
#endif
 diffuseColor.rgb=mix(diffuseColor.rgb,diffuseColor.rgb*gpTint*gpLight,gpGreen);
}
{
 float gpN1=gpNoise(gpP*.55),gpN2=gpNoise(gpP*1.9+7.1);
 vec2 gpWarp=vec2(gpN1-.5,gpNoise(gpP*.55+11.3)-.5)*1.1;
 vec4 gpMask=texture2D(groundPathMask,(gpP+gpWarp-groundPathFrame.xx)*groundPathFrame.y);
 if(gpMask.r+gpMask.g>.004){
  float gpBreak=(gpN1-.5)*.42+(gpN2-.5)*.22;
  float gpFw=sqrt(length(dFdx(gpP))*length(dFdy(gpP)));
  float gpDirt=smoothstep(.40,.60,gpMask.r+gpBreak);
  float gpCobEdge=smoothstep(.25,.62,gpMask.g+gpBreak*.7);
  // Worn verge: the grass dries a little toward the edge and fades smoothly into the same dirt
  // colour as the trail. A continuous ramp, no noise threshold: no second colour band.
  float gpVerge=smoothstep(.10,.50,max(gpMask.r,gpMask.g)+(gpNoise(gpP*.8+2.)-.5)*.22)*(1.-max(gpDirt,gpCobEdge));
  // Fine detail fades out with the pixel footprint: pebbles first (they are small), then grain.
  float gpPebFade=1.-smoothstep(.016,.04,gpFw),gpGrainFade=1.-smoothstep(.06,.16,gpFw),gpFineFade=1.-smoothstep(.02,.05,gpFw);
  vec2 gpTo;
#ifdef GROUND_CLASSIC
  // Mostly uniform warm, saturated earth: broad soft light/dark over many metres, a gently lighter
  // worn centre line and a fine grain. No high-contrast patches.
  const vec3 DIRT=vec3(.300,.170,.072),DIRT_WORN=vec3(.345,.205,.092);
  float gpDetail=1.-smoothstep(.3,.65,gpFw*1.9);
  float gpBroad=gpNoise(gpP*.05+3.1)*.6+gpNoise(gpP*.17+8.7)*.4;
  vec3 gpDirtCol=DIRT*(.82+.32*gpBroad+.10*(gpNoise(gpP*.6+5.3)-.5));
  gpDirtCol=mix(gpDirtCol,DIRT_WORN*(.92+.16*gpBroad),smoothstep(.35,.95,gpMask.b)*.45);
  gpDirtCol*=1.+(gpNoise(gpP*4.3+1.7)-.5)*.12*gpGrainFade+(gpNoise(gpP*13.+4.2)-.5)*.06*gpFineFade;
  // A few small, dark, irregular stones; none in the distance.
  vec4 gpPeb=gpCells(gpP*1.3,gpTo);
  float gpPa=gpPeb.w*6.283,gpPc=cos(gpPa),gpPs=sin(gpPa);
  float gpPd=length(vec2(gpTo.x*gpPc+gpTo.y*gpPs,(gpTo.y*gpPc-gpTo.x*gpPs)*1.55))+(gpNoise(gpP*19.+gpPeb.zw*30.)-.5)*.05;
  float gpPebble=(1.-smoothstep(.07,.10,gpPd))*step(.93,gpPeb.z)*gpPebFade;
  gpDirtCol=mix(gpDirtCol,gpDirtCol*vec3(.52,.56,.62)*(.85+.25*gpPeb.w),gpPebble);
  vec4 gpC=vec4(1.,1.,1.,0.);if(gpMask.g>.004)gpC=gpCells(gpP*2.1,gpTo);
  float gpTone=floor(gpC.w*3.)/2.;
  vec3 gpStone=mix(vec3(.120,.115,.104),vec3(.250,.238,.210),gpTone)*(gpC.z<.12?vec3(1.12,1.0,.8):vec3(1.));
  float gpGrout=(1.-smoothstep(.08,.13,gpC.y))*gpDetail;
  gpStone=mix(gpStone,vec3(.055,.050,.042),gpGrout);
  gpStone=mix(gpStone,vec3(.15,.143,.128),1.-gpDetail);
#else
  // Mostly uniform mid-brown earth: broad soft variation over many metres, a gently lighter worn
  // centre line and a fine grain that fades with distance. No high-contrast patches.
  const vec3 DIRT=vec3(.162,.098,.050),DIRT_WORN=vec3(.192,.122,.066);
  float gpDetail=1.-smoothstep(.28,.6,gpFw*3.3);
  float gpBroad=gpNoise(gpP*.045+3.1)*.6+gpNoise(gpP*.16+8.7)*.4;
  vec3 gpDirtCol=DIRT*(.80+.36*gpBroad+.12*(gpNoise(gpP*.6+5.3)-.5))*mix(vec3(1.),vec3(1.03,1.,.95),gpNoise(gpP*.11+1.3));
  gpDirtCol=mix(gpDirtCol,DIRT_WORN*(.92+.16*gpBroad),smoothstep(.35,.95,gpMask.b)*.45);
  gpDirtCol*=1.+((gpNoise(gpP*6.1+1.7)-.5)*.10+(gpNoise(gpP*17.+4.2)-.5)*.12*gpFineFade)*gpGrainFade;
  // A few small, darker grey-brown stones: irregular (rotated, stretched, ragged rim), sparse,
  // flat-shaded and gone in the distance.
  vec4 gpPeb=gpCells(gpP*1.6,gpTo);
  float gpPa=gpPeb.w*6.283,gpPc=cos(gpPa),gpPs=sin(gpPa);
  float gpPd=length(vec2(gpTo.x*gpPc+gpTo.y*gpPs,(gpTo.y*gpPc-gpTo.x*gpPs)*1.6))+(gpNoise(gpP*24.+gpPeb.zw*30.)-.5)*.05;
  float gpPebble=(1.-smoothstep(.06,.09,gpPd))*step(.92,gpPeb.z)*gpPebFade;
  gpDirtCol=mix(gpDirtCol,gpDirtCol*vec3(.50,.54,.60)*(.85+.3*gpPeb.w),gpPebble);
  vec4 gpC=vec4(1.,1.,1.,0.);gpTo=vec2(0.);if(gpMask.g>.004)gpC=gpCells(gpP*3.3,gpTo);
  vec3 gpStone=vec3(.150,.142,.124)*(.70+.50*gpC.w);
  gpStone*=mix(vec3(1.12,1.02,.86),vec3(.92,.98,1.06),gpC.z);
  float gpDome=1.-clamp(length(gpTo)*1.8,0.,1.);gpStone*=mix(1.,.72+.42*gpDome,gpDetail);
  gpStone*=.88+.24*gpNoise(gpP*9.+gpC.zw*40.);
  float gpGrout=(1.-smoothstep(.05,.13,gpC.y))*gpDetail;
  vec3 gpGroutCol=mix(vec3(.050,.046,.038),vec3(.050,.075,.026),smoothstep(.3,.8,gpNoise(gpP*1.3))*(1.-gpMask.b));
  gpStone=mix(gpStone,gpGroutCol,gpGrout);
  gpStone=mix(gpStone,vec3(.115,.108,.094),1.-gpDetail);
  gpTilt=vec3(-gpTo.x,0.,-gpTo.y)*.7*gpDetail*(1.-gpGrout);
#endif
  // Stones drop out one by one toward the edge: a ragged rim with dirt showing between them.
  float gpKeep=step(gpC.z*.92+.04,gpCobEdge*1.1)*step(.02,gpMask.g);
  float gpUnder=smoothstep(.20,.48,gpMask.g+gpBreak)*(1.-gpKeep);
  vec3 gpVergeCol=mix(diffuseColor.rgb*vec3(1.04,.98,.84),gpDirtCol,gpVerge*.55);
  diffuseColor.rgb=mix(diffuseColor.rgb,gpVergeCol,gpVerge*.6);
  diffuseColor.rgb=mix(diffuseColor.rgb,gpDirtCol,max(gpDirt,gpUnder*.9));
  diffuseColor.rgb=mix(diffuseColor.rgb,gpStone,gpKeep);
  gpAmount=max(max(gpDirt,gpUnder),gpKeep);gpTilt*=gpKeep;
 }
}
`;
// After <normal_fragment_maps>: paths lose the grass bump; cobbles get domed tops (regular only).
export const GROUND_NORMAL=`
#ifndef GROUND_CLASSIC
normal=normalize(mix(normal,nonPerturbedNormal,gpAmount*.85)+(viewMatrix*vec4(gpTilt,0.)).xyz);
#endif
`;
export function patchGroundShader(shader,uniforms,variant='regular'){
 Object.assign(shader.uniforms,uniforms);
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\n'+GROUND_VERTEX_PARS).replace('#include <project_vertex>',GROUND_VERTEX+'\n#include <project_vertex>');
 shader.fragmentShader=(variant==='classic'?'#define GROUND_CLASSIC\n':'')+shader.fragmentShader.replace('#include <common>','#include <common>\n'+GROUND_FRAGMENT_PARS).replace('#include <color_fragment>','#include <color_fragment>\n'+GROUND_FRAGMENT).replace('#include <normal_fragment_maps>','#include <normal_fragment_maps>\n'+GROUND_NORMAL);
 return shader;
}

// Live mask texture plus helpers. `paved(x,z)` turns dirt to cobble inside towns.
export function createGroundPaths(T,{extent=840,size=PATH_MASK.size,paved=()=>false}={}){
 const data=new Uint8Array(size*size*4),pavedCache=new Int8Array(size*size).fill(-1);let strokes=[],surfaces=[],surfaceKey='';
 const texture=new T.DataTexture(data,size,size,T.RGBAFormat,T.UnsignedByteType);
 texture.wrapS=texture.wrapT=T.ClampToEdgeWrapping;texture.magFilter=T.LinearFilter;texture.minFilter=T.LinearMipmapLinearFilter;texture.generateMipmaps=true;texture.colorSpace=T.NoColorSpace;texture.userData.eldervaleShared=true;
 const uniforms={groundPathMask:{value:texture},groundPathFrame:{value:new T.Vector4(-extent/2,1/extent,1,0)}};
 let revision=0;
 function repaint(){paintPathMask(data,[...strokes,...surfaces],{size,extent,paved,pavedCache});texture.needsUpdate=true;revision++}
 return {
  texture,uniforms,data,size,extent,get revision(){return revision},
  // Fixed paths (world roads, legacy streets): set once.
  setStrokes(list){strokes=list;repaint()},
  // Road / plaza world entities (castle, capital, town lanes): repainted when they change.
  setSurfaces(list){const key=list.map(st=>st.type==='disc'?[st.kind,st.x,st.z,st.radius].join():[st.kind,st.width,st.seed,st.points.length].join()).join('|');if(key===surfaceKey)return false;surfaceKey=key;surfaces=list;repaint();return true},
  sample:(x,z)=>sampleMask(data,x,z,{size,extent}),
  cover:(x,z)=>pathCover(data,x,z,{size,extent}),
  // Add the path splat to a terrain material, after any hook it already has. One program each.
  extend(material,variant='regular'){
   const inner=material.onBeforeCompile,own=inner&&inner!==T.Material.prototype.onBeforeCompile;
   material.onBeforeCompile=(shader,renderer)=>{if(own)inner.call(material,shader,renderer);patchGroundShader(shader,uniforms,variant)};
   const key=material.customProgramCacheKey?.call(material);material.customProgramCacheKey=()=>'ground-paths-'+variant+'|'+(key||'');
   material.extensions={...(material.extensions||{}),derivatives:true};material.userData.groundPaths=variant;material.needsUpdate=true;return material}
 };
}
// Which strokes a road / plaza world entity draws. Paved streets, the castle and town lanes are
// cobbled; anything else (farm tracks, lanes placed in the open) stays dirt.
export function surfaceStrokes(rows,{paved=()=>false}={}){
 const out=[];
 for(const row of rows){const d=row.data||row;if(row.deleted)continue;
  if(d.template==='road')out.push(entityStroke(d,d.paved||paved(d.x,d.z)?'cobble':'dirt'));
  else if(d.template==='plaza')out.push(discStroke(d.x,d.z,(d.radius||8)*(d.scale||1)*.98,'cobble'));
 }
 return out;
}
