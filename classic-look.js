// "Classic look": an optional old-school, low-detail 3D renderer (art notes in
// docs/classic-art-direction.md). The picture is drawn at full device
// resolution - nothing is pixelated - and the detail comes down instead:
// - lit materials become shared MeshLambertMaterials (one sun + a warm ambient
//   fill, no environment map, no specular), smooth (Gouraud-style) shaded by
//   default and faceted only for rocks and other polyhedral shapes;
// - colours snap to a limited warm palette; tiling textures (stone, roof
//   tiles, planks, cobbles, thatch) are sampled blurrier with softer contrast
//   around a palette colour, so only their broad pattern remains;
//   atlas-mapped characters get per-vertex colour regions;
// - round primitives (spheres, cylinders, cones, rings...) are rebuilt with
//   far fewer segments, shared by every mesh that used the same geometry;
// - the terrain is smooth, blended vertex colour from its climate weights
//   with a little per-point variation, rock on steep slopes and snow on peaks;
// - soft blob shadows replace shadow maps, the grass field is hidden and the
//   fog closes in sooner. The normal sky dome and weather stay as they are.
// Everything is built procedurally from the normal models (original art).
// Pure helpers are exported for the unit tests; createClassicLook() works on
// a live THREE scene.

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
// --- Palette ---------------------------------------------------------------
// A limited, warm palette: 24 hues nudged toward amber, 5 saturation and 11
// lightness steps. Input and output are sRGB components 0..1.
export const PALETTE_STEPS={hues:24,saturation:[0,.1,.22,.36,.5,.66],lightness:11,warmth:.05};
export function rgbToHsl(r,g,b){const max=Math.max(r,g,b),min=Math.min(r,g,b),l=(max+min)/2;if(max===min)return [0,0,l];const d=max-min,s=l>.5?d/(2-max-min):d/(max+min);let h=max===r?(g-b)/d+(g<b?6:0):max===g?(b-r)/d+2:(r-g)/d+4;return [h/6,s,l]}
export function hslToRgb(h,s,l){if(!s)return [l,l,l];const q=l<.5?l*(1+s):l+s-l*s,p=2*l-q,f=t=>{t=(t%1+1)%1;return t<1/6?p+(q-p)*6*t:t<.5?q:t<2/3?p+(q-p)*(2/3-t)*6:p};return [f(h+1/3),f(h),f(h-1/3)]}
export function quantizeColor(r,g,b,steps=PALETTE_STEPS){
 let [h,s,l]=rgbToHsl(r,g,b);
 // Warm the hue toward amber (30 deg) along the shorter way round.
 const amber=30/360;let d=amber-h;if(d>.5)d-=1;if(d<-.5)d+=1;h=(h+d*steps.warmth+1)%1;
 h=Math.round(h*steps.hues)/steps.hues%1;
 let best=steps.saturation[0];for(const v of steps.saturation)if(Math.abs(v-s)<Math.abs(best-s))best=v;s=best;
 const n=steps.lightness-1;l=clamp(Math.round(clamp(l,.04,.96)*n)/n,.06,.94);
 return hslToRgb(h,s,l);
}
export function quantizeHex(hex){const [r,g,b]=quantizeColor((hex>>16&255)/255,(hex>>8&255)/255,(hex&255)/255);return Math.round(r*255)<<16|Math.round(g*255)<<8|Math.round(b*255)}
// --- Resolution ------------------------------------------------------------
// Classic always draws at the device's own resolution (within the device
// profile's cap, as normal mode does) - it is never pixelated. Only the frame
// governor may trim it, and never below 75 %.
export function classicPixelRatio({devicePixelRatio=1,pixelCap=2,governor=1}={}){return +Math.max(.5,Math.min(devicePixelRatio,pixelCap)*clamp(governor,.75,1)).toFixed(3)}
// --- Low-poly primitives ---------------------------------------------------
// New constructor parameters with fewer segments for a parametric geometry, or
// null when it is already coarse or of another kind (boxes, planes, custom).
export function simplifiedParameters(type,p){
 const less=(v,f,min)=>Math.max(min,Math.round(v*f));let q=null;
 if(type==='SphereGeometry'){const w=less(p.widthSegments,.4,6),h=less(p.heightSegments,.4,4);if(w<p.widthSegments||h<p.heightSegments)q=[p.radius,w,h,p.phiStart,p.phiLength,p.thetaStart,p.thetaLength]}
 else if(type==='CylinderGeometry'||type==='ConeGeometry'){const r=less(p.radialSegments,.5,5);if(r<p.radialSegments||p.heightSegments>1)q=type==='ConeGeometry'?[p.radius,p.height,r,1,p.openEnded,p.thetaStart,p.thetaLength]:[p.radiusTop,p.radiusBottom,p.height,r,1,p.openEnded,p.thetaStart,p.thetaLength]}
 else if(type==='CircleGeometry'){const s=less(p.segments,.35,6);if(s<p.segments)q=[p.radius,s,p.thetaStart,p.thetaLength]}
 else if(type==='RingGeometry'){const s=less(p.thetaSegments,.35,6);if(s<p.thetaSegments||p.phiSegments>1)q=[p.innerRadius,p.outerRadius,s,1,p.thetaStart,p.thetaLength]}
 else if(type==='TorusGeometry'){const r=less(p.radialSegments,.5,3),t=less(p.tubularSegments,.4,6);if(r<p.radialSegments||t<p.tubularSegments)q=[p.radius,p.tube,r,t,p.arc]}
 else if(type==='CapsuleGeometry'){const c=less(p.capSegments,.5,1),r=less(p.radialSegments,.5,5);if(c<p.capSegments||r<p.radialSegments)q=[p.radius,p.length,c,r]}
 else if(type==='IcosahedronGeometry'||type==='DodecahedronGeometry'||type==='OctahedronGeometry'){if(p.detail>0)q=[p.radius,p.detail-1]}
 else if(type==='LatheGeometry'){const s=less(p.segments,.5,5);if(s<p.segments)q=[p.points,s,p.phiStart,p.phiLength]}
 return q;
}
// Hard, cut shapes (rocks, ore, crystals) keep faceted shading; everything
// else is smooth shaded like the low-poly games of the era.
const FACETED=new Set(['IcosahedronGeometry','DodecahedronGeometry','OctahedronGeometry','TetrahedronGeometry','PolyhedronGeometry']);
export function facetedGeometry(geometry){return !!geometry&&(FACETED.has(geometry.type)||geometry.userData?.classicFaceted===true)}
// --- Terrain ---------------------------------------------------------------
export const CLASSIC_GROUND={grass:[.4,.52,.24],snow:[.8,.83,.88],sand:[.72,.64,.47],rock:[.52,.49,.43],earth:[.46,.38,.25]};
// Small deterministic variation per terrain point (-1..1): neighbouring grid
// points differ a little, which reads as the patchy, tiled ground of the era.
export function terrainJitter(x,z){const s=Math.sin(x*12.9898+z*78.233)*43758.5453;return (s-Math.floor(s))*2-1}
// Broad, soft patches (-1..1, about 25 m across): smooth value noise from the same hash.
export function terrainPatch(x,z,scale=25){const gx=x/scale,gz=z/scale,ix=Math.floor(gx),iz=Math.floor(gz);let u=gx-ix,v=gz-iz;u=u*u*(3-2*u);v=v*v*(3-2*v);const h=(a,b)=>terrainJitter(a*7.13,b*7.13);return (h(ix,iz)*(1-u)+h(ix+1,iz)*u)*(1-v)+(h(ix,iz+1)*(1-u)+h(ix+1,iz+1)*u)*v}
// sRGB vertex colour for one terrain vertex. `source` is the heightfield's own
// biome colour (sRGB), the same colour normal mode multiplies its detailed
// ground textures by; without one, the climate weights (grass, snow, dry,
// castle-green) pick from CLASSIC_GROUND. Steep slopes turn to rock, `patch`
// gives broad lush/dry patches and `jitter` (-1..1) a small per-point light
// variation. Smoothly blended, not palette-snapped: the renderer interpolates
// between points, so steps would show as stripes.
const GROUND_ALBEDO={grass:.92,snow:.96,dry:.88,rock:.72};
export function terrainColor(climate,normalY,height,source=null,jitter=0,patch=0){
 const [g,s,d,c]=climate,G=CLASSIC_GROUND,sum=Math.max(1e-6,g+s+d+c),green=(g+c)/sum;const out=[0,0,0];
 if(source){const albedo=(GROUND_ALBEDO.grass*(g+c)+GROUND_ALBEDO.snow*s+GROUND_ALBEDO.dry*d)/sum;for(let k=0;k<3;k++)out[k]=source[k]*albedo}
 else for(let k=0;k<3;k++)out[k]=(G.grass[k]*(g+c)+G.snow[k]*s+G.sand[k]*d)/sum;
 // Lush and dry patches in grassland: a gentle shift between deeper and yellower green.
 const p=patch*green;out[0]*=1+.07*p;out[1]*=1+.02*p;out[2]*=1-.08*p;
 // A touch of bare earth in some grass points, as worn spots.
 const worn=clamp(jitter-.6)*.8*green;for(let k=0;k<3;k++)out[k]=out[k]*(1-worn)+G.earth[k]*worn;
 const t=clamp((Math.abs(normalY)-.58)/.3),rock=(1-t*t*(3-2*t))*.72;
 // Steep ground: the same colour over darker stone, as the normal ground shader does.
 for(let k=0;k<3;k++)out[k]=out[k]*(1-rock)+(source?source[k]*GROUND_ALBEDO.rock:G.rock[k])*rock;
 const light=1+jitter*.07+patch*.05;
 for(let k=0;k<3;k++)out[k]=clamp(out[k]*light);
 return out;
}
// Settings: a player's explicit choice wins, otherwise the owner's default.
export function classicEnabled(settings,gameConfig){return typeof settings?.classic==='boolean'?settings.classic:gameConfig?.classicLook===true}
// Blob shadow radius for a character (metres, before its scale).
const BLOB={dragon:2.3,ogre:1.05,troll:1.05,golem:1.1,bear:1.0,demon:.8,cow:1,horse:1.05,wolf:.72,boar:.7,deer:.72,sheep:.7,pig:.65,revenant:.6,wraith:.6,imp:.5,rat:.42,spider:.6,bat:.38,chicken:.32};
export function blobRadius(species){return BLOB[species]??.55}
// --- Low-detail textures ----------------------------------------------------
// Tiling textures stay on their surfaces but lose fine detail in the shader:
// sampled a couple of mip levels blurrier, their contrast pulled toward the
// tile's average and the average moved onto the palette colour. No pixels are
// read back and no textures are copied.
export const CLASSIC_TEXTURE={bias:1.6,contrast:.68};
// Linear-space uniforms for one tiling texture: its average colour and the
// shift that lands that average on the palette (input sRGB 0..1).
export function textureGrade(avg){const q=quantizeColor(avg[0],avg[1],avg[2]),a=avg.map(srgbToLinear),b=q.map(srgbToLinear);return {avg:a,shift:[b[0]-a[0],b[1]-a[1],b[2]-a[2]],palette:q}}
// The same grade applied to one sampled texel (linear 0..1), as the shader does.
export function gradeTexel(texel,grade,contrast=CLASSIC_TEXTURE.contrast){return texel.map((v,k)=>clamp(grade.avg[k]+(v-grade.avg[k])*contrast+grade.shift[k]))}
const GRADE_CHUNK=`#ifdef USE_MAP
 vec4 sampledDiffuseColor=texture2D(map,vMapUv,CLASSIC_BIAS);
 sampledDiffuseColor.rgb=clamp(classicAvg+(sampledDiffuseColor.rgb-classicAvg)*CLASSIC_CONTRAST+classicShift,0.,1.);
 diffuseColor*=sampledDiffuseColor;
#endif`;

function srgbToLinear(c){return c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4)}
function linearToSrgb(c){return c<=.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-.055}
const LIT=m=>m&&(m.isMeshStandardMaterial||m.isMeshPhongMaterial||m.isMeshLambertMaterial||m.isMeshToonMaterial)&&!m.isShaderMaterial;

export function createClassicLook(T,{scene,renderer,camera,hiddenLayer=31,onChange=()=>{}}){
 let enabled=false;
 // Lambert has no image-based light, so a warm ambient fill stands in for the
 // environment map. Ambient light is not part of any shader key: it lives in
 // the scene from the start (dark while classic is off) and never recompiles.
 const ambient=new T.AmbientLight(0xfff0d8,0);ambient.name='classic-ambient';scene.add(ambient);
 const classicOf=new Map();// source material -> {variant: entry}
 const simpler=new WeakMap(),baked=new WeakMap(),pixels=new Map(),decoding=new WeakMap();
 const converted=new Set();
 // Average colour of a texture. Procedural textures carry it, so nothing is
 // read back; image files are sampled once, small.
 function textureAverage(texture){
  if(Number.isFinite(texture?.userData?.baseColor)){const h=texture.userData.baseColor;return [(h>>16&255)/255,(h>>8&255)/255,(h&255)/255]}
  return texturePixels(texture,16)?.avg??null}
 // Texture pixels, downsampled once (16x16 for an average, 128x128 atlases).
 function texturePixels(texture,size){
  const image=texture?.image;if(!image||!(image.width>0)||typeof document==='undefined')return null;
  const key=texture.uuid+':'+size;let p=pixels.get(key);if(p)return p;
  // Decode image files off the main thread first; drawing an undecoded image
  // would decode it synchronously (a long stall for a large atlas).
  if(typeof image.decode==='function'&&!(image instanceof HTMLCanvasElement)){const state=decoding.get(image);if(state!=='done'){if(!state){decoding.set(image,'busy');image.decode().catch(()=>{}).then(()=>decoding.set(image,'done'))}return null}}
  // Reading pixels back can wait on the GPU queue, so the background sweep
  // takes at most a couple per frame; the rest wait for the next frame.
  if(reads<=0)return null;reads--;
  try{const c=document.createElement('canvas');c.width=c.height=size;const x=c.getContext('2d',{willReadFrequently:true});x.drawImage(image,0,0,size,size);const data=x.getImageData(0,0,size,size).data;let r=0,g=0,b=0,n=0;for(let i=0;i<data.length;i+=4){if(data[i+3]<40)continue;r+=data[i];g+=data[i+1];b+=data[i+2];n++}n=Math.max(1,n);p={size,data,avg:[r/n/255,g/n/255,b/n/255]}}catch{p={size:0,data:null,avg:[.6,.6,.6]}}
  pixels.set(key,p);return p}
 const atlas=t=>t&&t.wrapS===T.ClampToEdgeWrapping&&t.wrapT===T.ClampToEdgeWrapping;
 // Vertex colours sampled from a texture at each vertex UV (shared per geometry+texture).
 function bakeGeometry(geometry,texture){
  let byTex=baked.get(geometry);if(!byTex)baked.set(geometry,byTex=new Map());let g=byTex.get(texture.uuid);if(g)return g;
  const px=texturePixels(texture,128),uv=geometry.attributes.uv;if(!px?.data||!uv)return null;
  g=geometry.clone();const n=uv.count,col=new Float32Array(n*3),s=px.size;
  for(let i=0;i<n;i++){let u=uv.getX(i),v=uv.getY(i);u=clamp(u-Math.floor(u===1?0:u),0,1);v=clamp(v-Math.floor(v===1?0:v),0,1);if(texture.flipY)v=1-v;const x=Math.min(s-1,Math.floor(u*s)),y=Math.min(s-1,Math.floor(v*s)),o=(y*s+x)*4;
   const q=quantizeColor(px.data[o]/255,px.data[o+1]/255,px.data[o+2]/255);col[i*3]=srgbToLinear(q[0]);col[i*3+1]=srgbToLinear(q[1]);col[i*3+2]=srgbToLinear(q[2])}
  g.setAttribute('color',new T.BufferAttribute(col,3));g.userData={...geometry.userData,classicBaked:true};byTex.set(texture.uuid,g);return g}
 function quantizedLinear(color,avg){const c=color.clone().convertLinearToSRGB();const q=quantizeColor(c.r*avg[0],c.g*avg[1],c.b*avg[2]);return new T.Color().setRGB(q[0],q[1],q[2],T.SRGBColorSpace)}
 // The classic version of one material, or the material itself (unlit, custom
 // shaders, invisible). Classic materials are pooled by their resulting look:
 // after palette quantisation many source materials collapse onto the same
 // colour, so they share one material and the cell batcher can merge their
 // meshes into fewer draw calls.
 const pool=new Map();let revision=0;
 // Materials with their own shader hook (water ripples, swaying sign boards
 // with an atlas per instance) keep the hook and their texture on Lambert.
 const hooked=src=>typeof src.onBeforeCompile==='function'&&src.onBeforeCompile!==T.Material.prototype.onBeforeCompile;
 function variantOf(src,mesh){const map=src.map;if(src.alphaTest>0&&map)return 'cutout';if(map&&atlas(map)&&(mesh.isSkinnedMesh||map.flipY===false)&&!mesh.isInstancedMesh&&mesh.geometry.attributes.uv&&!mesh.userData.staticBatch)return 'bake';
  if(hooked(src))return 'hooked';
  if(map&&atlas(map))return 'decal';
  if(map&&mesh.geometry.attributes.uv)return 'textured';
  return 'flat'}
 function signature(src,variant,avg,emissiveAvg,faceted){
  const color=variant==='flat'?quantizedLinear(src.color,avg).getHex():src.color.getHex(),emissive=src.emissive?new T.Color().copy(src.emissive).multiply(new T.Color(...emissiveAvg)).getHex():0;
  return [variant,faceted?1:0,color,variant==='hooked'?src.uuid:variant==='cutout'||variant==='textured'||variant==='decal'?src.map.uuid:'',variant==='bake'||!!src.vertexColors,src.transparent,+src.opacity.toFixed(3),src.side,src.alphaTest,src.depthWrite,src.depthTest,src.fog,src.visible,src.polygonOffset,src.polygonOffsetFactor,src.polygonOffsetUnits,src.toneMapped,emissive,+(src.emissiveIntensity??1).toFixed(3)].join('|')}
 // Leaf cards and hair keep their texture for the cut-out shape; without the
 // environment light of the normal renderer they need a lift to stay readable.
 const CUTOUT_LIFT=1.35;
 // One program for every graded texture; the colours are per-material uniforms.
 function gradeTexture(m,avg){const g=textureGrade(avg),uniforms={classicAvg:{value:new T.Vector3(...g.avg)},classicShift:{value:new T.Vector3(...g.shift)}};
  m.onBeforeCompile=shader=>{Object.assign(shader.uniforms,uniforms);shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>\nuniform vec3 classicAvg;uniform vec3 classicShift;\n#define CLASSIC_BIAS ${CLASSIC_TEXTURE.bias.toFixed(2)}\n#define CLASSIC_CONTRAST ${CLASSIC_TEXTURE.contrast.toFixed(2)}`).replace('#include <map_fragment>',GRADE_CHUNK)};
  m.customProgramCacheKey=()=>'classic-graded-texture';m.userData.classicGrade=g}
 function pooled(sig,src,variant,avg,emissiveAvg,faceted){let m=pool.get(sig);if(m)return m;
  m=new T.MeshLambertMaterial({name:'classic',color:variant==='flat'?quantizedLinear(src.color,avg):variant==='cutout'?src.color.clone().multiplyScalar(CUTOUT_LIFT):src.color.clone(),flatShading:faceted,vertexColors:variant==='bake'||!!src.vertexColors,transparent:src.transparent,opacity:src.opacity,side:src.side,alphaTest:src.alphaTest,depthWrite:src.depthWrite,depthTest:src.depthTest,fog:src.fog,visible:src.visible,polygonOffset:src.polygonOffset,polygonOffsetFactor:src.polygonOffsetFactor,polygonOffsetUnits:src.polygonOffsetUnits,toneMapped:src.toneMapped});
  if(variant==='cutout'||variant==='decal')m.map=src.map;
  else if(variant==='hooked'){m.map=src.map;m.onBeforeCompile=src.onBeforeCompile;const key=src.customProgramCacheKey?.();m.customProgramCacheKey=()=>'classic|'+(key||src.uuid)}
  else if(variant==='textured'){m.map=src.map;gradeTexture(m,avg)}
  if(src.emissive){m.emissive.copy(src.emissive).multiply(new T.Color(...emissiveAvg));m.emissiveIntensity=src.emissiveIntensity}
  m.userData.eldervaleShared=true;pool.set(sig,m);return m}
 function classicMaterial(src,mesh,faceted=facetedGeometry(mesh?.geometry)){
  if(!LIT(src)||src.visible===false||src.userData?.classicKeep)return {material:src};
  const variant=variantOf(src,mesh),key=variant+(faceted?'#f':'');let slot=classicOf.get(src);if(!slot)classicOf.set(src,slot={});let entry=slot[key];
  if(!entry){
   let avg=[1,1,1],emissiveAvg=[1,1,1];if((variant==='flat'||variant==='textured')&&src.map){avg=textureAverage(src.map);if(!avg)return null}
   if(src.emissiveMap){emissiveAvg=textureAverage(src.emissiveMap)||[1,1,1]}
   const sig=signature(src,variant,avg,emissiveAvg,faceted);entry=slot[key]={variant,faceted,avg,emissiveAvg,sig,material:pooled(sig,src,variant,avg,emissiveAvg,faceted)};
  }
  if(variant==='bake'){const g=bakeGeometry(mesh.userData.classicOrig?.geometry||mesh.geometry,src.map);if(!g)return null;return {material:entry.material,geometry:g}}
  return {material:entry.material};
 }
 // A parametric geometry whose vertices were edited afterwards (sculpted
 // boulders, bent planks) must keep its own shape: rebuilding it from its
 // parameters would undo the sculpting.
 function pristine(geometry,ctor){
  const pos=geometry.attributes.position;if(!pos)return false;let fresh;try{fresh=new ctor(...Object.values(geometry.parameters))}catch{return false}
  const f=fresh.attributes.position;let same=f.count===pos.count;if(same){const step=Math.max(1,Math.floor(pos.count/24));for(let i=0;i<pos.count&&same;i+=step)same=Math.abs(f.getX(i)-pos.getX(i))+Math.abs(f.getY(i)-pos.getY(i))+Math.abs(f.getZ(i)-pos.getZ(i))<1e-4}
  fresh.dispose();return same}
 function lowPoly(geometry){
  if(!geometry?.parameters||geometry.userData?.noClassicSimplify)return geometry;let g=simpler.get(geometry);if(g)return g;
  const q=simplifiedParameters(geometry.type,geometry.parameters),ctor=q&&T[geometry.type];
  g=ctor&&pristine(geometry,ctor)?new ctor(...q):geometry;if(g!==geometry){g.userData.eldervaleShared=!!geometry.userData.eldervaleShared;g.userData.classicLowPoly=true}simpler.set(geometry,g);return g}
 // Convert one mesh; returns false when its textures are not loaded yet (retry later).
 function convertMesh(o){
  const ud=o.userData;if(ud.classicIgnore||ud.classicOrig&&ud.classicTerrain||ud.classicSkip===o.material||o.isSprite||o.isPoints||o.isLine)return true;
  if(ud.classicOrig&&o.material===ud.classicMaterial&&ud.classicRevision===revision)return true;
  if(ud.classicOrig&&o.material!==ud.classicMaterial){ud.classicOrig.material=o.material}ud.classicRevision=revision;// gameplay swapped the material
  const classicGeometry=o.geometry.userData.classicLowPoly||o.geometry.userData.classicBaked,srcMaterial=ud.classicOrig?.material??o.material,srcGeometry=classicGeometry&&ud.classicOrig?ud.classicOrig.geometry:o.geometry;
  const faceted=facetedGeometry(srcGeometry);
  const list=Array.isArray(srcMaterial)?srcMaterial:[srcMaterial];let geometry=srcGeometry;const out=[];
  for(const m of list){const r=classicMaterial(m,o,faceted);if(!r)return false;out.push(r.material);if(r.geometry)geometry=r.geometry}
  if(geometry===srcGeometry&&!o.isSkinnedMesh&&!o.isInstancedMesh&&!ud.drape&&!ud.surface)geometry=lowPoly(srcGeometry);
  if(!out.some((m,i)=>m!==list[i])&&geometry===srcGeometry){if(!ud.classicOrig)ud.classicSkip=o.material;return true}
  ud.classicOrig={material:srcMaterial,geometry:srcGeometry,castShadow:ud.classicOrig?ud.classicOrig.castShadow:o.castShadow};
  o.material=Array.isArray(srcMaterial)?out:out[0];o.geometry=geometry;ud.classicMaterial=o.material;o.castShadow=false;converted.add(o);return true}
 function restoreMesh(o){const orig=o.userData.classicOrig;if(!orig)return;if(o.material===o.userData.classicMaterial)o.material=orig.material;if(o.geometry!==orig.geometry&&(o.geometry.userData.classicLowPoly||o.geometry.userData.classicBaked))o.geometry=orig.geometry;o.castShadow=orig.castShadow;delete o.userData.classicOrig;delete o.userData.classicMaterial;delete o.userData.classicTerrain;delete o.userData.classicGeometry}
 function convert(root){let pending=0;root.traverse(o=>{if(o.isMesh&&!convertMesh(o))pending++});return pending}
 // Gameplay tweaks colour/opacity/glow on the original shared materials; mirror them.
 function syncMaterials(){for(const [src,slot] of classicOf)for(const e of Object.values(slot)){const sig=signature(src,e.variant,e.avg,e.emissiveAvg,e.faceted);if(sig!==e.sig){e.sig=sig;e.material=pooled(sig,src,e.variant,e.avg,e.emissiveAvg,e.faceted);revision++}}}

 // --- Terrain bake: smooth, blended vertex colour ---
 function terrainGeometry(ground){
  const src=ground.userData.classicOrig?.geometry||ground.geometry;let g=baked.get(src)?.get('terrain');if(g)return g;
  const pos=src.attributes.position,nor=src.attributes.normal,cli=src.attributes.climate,tint=src.attributes.color;g=src.clone();const col=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){const c=cli?[cli.getX(i),cli.getY(i),cli.getZ(i),cli.getW(i)]:[1,0,0,0],t=tint?[linearToSrgb(tint.getX(i)),linearToSrgb(tint.getY(i)),linearToSrgb(tint.getZ(i))]:null;const q=terrainColor(c,nor.getY(i),pos.getY(i),t,terrainJitter(pos.getX(i),pos.getZ(i)),terrainPatch(pos.getX(i),pos.getZ(i)));col[i*3]=srgbToLinear(q[0]);col[i*3+1]=srgbToLinear(q[1]);col[i*3+2]=srgbToLinear(q[2])}
  g.setAttribute('color',new T.BufferAttribute(col,3));g.userData={...src.userData,classicBaked:true};let byTex=baked.get(src);if(!byTex)baked.set(src,byTex=new Map());byTex.set('terrain',g);return g}
 const terrainMaterial=new T.MeshLambertMaterial({vertexColors:true,name:'classic-terrain'});terrainMaterial.userData.eldervaleShared=true;
 function convertTerrain(ground){if(!ground)return;const ud=ground.userData;
  if(ud.classicOrig){
   // The game rebuilds the heightfield after terrain edits: bake the new one.
   if(ground.geometry===ud.classicGeometry)return;ud.classicOrig.geometry=ground.geometry;if(ground.material!==terrainMaterial)ud.classicOrig.material=ground.material;
  }else ud.classicOrig={material:ground.material,geometry:ground.geometry,castShadow:ground.castShadow};
  const g=terrainGeometry(ground);ground.material=terrainMaterial;ground.geometry=g;ud.classicGeometry=g;ud.classicMaterial=terrainMaterial;ud.classicTerrain=true;converted.add(ground)}

 // --- Blob shadows: one instanced draw for every character ---
 const MAX_BLOBS=256;let blobs=null;const dummy=new T.Object3D();
 function blobMesh(){if(blobs)return blobs;let texture=null;if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),grad=x.createRadialGradient(32,32,0,32,32,32);grad.addColorStop(0,'rgba(0,0,0,.5)');grad.addColorStop(.55,'rgba(0,0,0,.32)');grad.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=grad;x.fillRect(0,0,64,64);texture=new T.CanvasTexture(c)}
  const geometry=new T.CircleGeometry(1,12);geometry.rotateX(-Math.PI/2);
  blobs=new T.InstancedMesh(geometry,new T.MeshBasicMaterial({color:0x000000,map:texture,transparent:true,opacity:texture?1:.35,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,fog:true}),MAX_BLOBS);
  blobs.count=0;blobs.frustumCulled=false;blobs.renderOrder=1;blobs.userData.classicIgnore=true;blobs.name='classic-blob-shadows';return blobs}
 function updateBlobs(actors){if(!enabled)return;const b=blobMesh();let n=0;for(const a of actors){if(n>=MAX_BLOBS)break;const root=a.root;if(!root?.visible||a.hidden)continue;const r=(a.radius??.55)*(root.scale?.x||1);dummy.position.set(root.position.x,(a.y??root.position.y)+.045,root.position.z);dummy.scale.set(r,1,r);dummy.rotation.set(0,0,0);dummy.updateMatrix();b.setMatrixAt(n++,dummy.matrix)}b.count=n;b.instanceMatrix.needsUpdate=true}

 // --- Light: a warm ambient fill that follows the time of day ---
 // The sky dome, fog colour and any weather stay under the normal renderer's
 // control; classic only adds the fill light that Lambert needs.
 const AMBIENT={day:.85,night:.22},AMBIENT_TINT={day:0xfff1dc,dusk:0xffc79a,night:0x8d9ac4};
 let lastSky={daylight:1,twilight:0};const tint=new T.Color();
 function applySky(daylight=lastSky.daylight,twilight=lastSky.twilight){lastSky={daylight,twilight};if(!enabled)return;
  tint.set(AMBIENT_TINT.night).lerp(new T.Color(AMBIENT_TINT.day),daylight).lerp(new T.Color(AMBIENT_TINT.dusk),twilight*.45);ambient.color.copy(tint);ambient.intensity=AMBIENT.night+(AMBIENT.day-AMBIENT.night)*daylight}

 // --- Time-sliced sweep over the scene: converts what streams in ---
 let sweep=null,sweepPending=0;
 let slowest={ms:0,name:''};const clock=()=>globalThis.performance?.now?.()??Date.now();
 function* walk(){const stack=[scene],seen=new Set();let pending=0;while(stack.length){const o=stack.pop();if(o.isMesh){const t=clock();if(!convertMesh(o))pending++;else if(o.userData.classicOrig)seen.add(o);const ms=clock()-t;if(ms>slowest.ms)slowest={ms:+ms.toFixed(1),name:(o.name||o.parent?.name||o.type)+'/'+o.geometry?.type+'/'+(o.geometry?.attributes?.position?.count||0)+'/'+[].concat(o.userData.classicOrig?.material||o.material).map(m=>m.type+':'+(m.map?.image?.constructor?.name||'-')+':'+(m.map?.image?.width||0)).join(';')}}for(let i=o.children.length-1;i>=0;i--)stack.push(o.children[i]);yield}sweepPending=pending;converted.clear();for(const o of seen)converted.add(o);const t=clock();syncMaterials();const ms=clock()-t;if(ms>slowest.ms)slowest={ms:+ms.toFixed(1),name:'sync'}}
 let reads=Infinity;
 function update(budget=1.5,now=()=>performance.now()){
  if(!enabled)return;reads=2;if(ground&&ground.geometry!==ground.userData.classicGeometry)convertTerrain(ground);
  const end=now()+budget;sweep??=walk();while(true){if(sweep.next().done){sweep=null;break}if(now()>end)break}reads=Infinity;
 }
 const hiddenLayers=new Map();
 function hide(objects,hidden){for(const o of objects){if(!o)continue;if(hidden){if(!hiddenLayers.has(o))hiddenLayers.set(o,o.layers.mask);o.layers.set(hiddenLayer)}else if(hiddenLayers.has(o)){o.layers.mask=hiddenLayers.get(o);hiddenLayers.delete(o)}}}
 let hideTargets=()=>[];let ground=null;
 return {
  get enabled(){return enabled},get pending(){return sweepPending},get converted(){return converted.size},
  convert,convertMesh,classicMaterial,lowPoly,updateBlobs,applySky,update,
  configure({ground:g,hide:h}={}){if(g)ground=g;if(h)hideTargets=h},
  set(on){on=!!on;if(on===enabled)return false;enabled=on;
   if(on){convertTerrain(ground);scene.add(blobMesh());blobs.visible=true;hide(hideTargets(),true);applySky();sweep=null;const it=walk();while(!it.next().done);}
   else{for(const o of converted)restoreMesh(o);scene.traverse(o=>{if(o.userData.classicOrig)restoreMesh(o)});converted.clear();ambient.intensity=0;if(blobs){blobs.visible=false;blobs.count=0}hide([...hiddenLayers.keys()],false);sweep=null}
   onChange(on);return true},
  // Converted materials are shared; this lists them for shader warm-up.
  materials(){return [terrainMaterial,...pool.values()]},
  stats(){let bakedCount=0,textured=0;for(const s of classicOf.values()){if(s.bake)bakedCount++;if(s.textured||s['textured#f'])textured++}return {enabled,converted:converted.size,sources:classicOf.size,materials:pool.size,baked:bakedCount,textured,blobs:blobs?.count||0,pending:sweepPending,slowest}}
 };
}
