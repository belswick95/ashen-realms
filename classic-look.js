// "Classic look": an optional retro renderer. Low-poly, flat-shaded and
// vertex-coloured models in a limited warm palette, a low render resolution
// upscaled with crisp pixels, soft blob shadows under characters instead of
// shadow maps, warm distance fog and a simple banded sky. Everything is built
// procedurally from the normal models (original art, a generic retro style):
// - lit materials become one flat-shaded MeshLambertMaterial each, coloured by
//   the texture's average in a quantised warm palette (tiling textures), or by
//   colours baked per vertex from the texture (atlas-mapped characters/outfits);
// - round primitives (spheres, cylinders, cones, rings...) are rebuilt with far
//   fewer segments, shared by every mesh that used the same source geometry;
// - the terrain is shaded by vertex colour from its climate weights.
// It is also the cheapest way to draw the world: a ~300-line framebuffer, one
// light model, no shadow pass and no grass field. Pure helpers are exported for
// the unit tests; createClassicLook() works on a live THREE scene.

const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
// --- Palette ---------------------------------------------------------------
// A limited, warm palette: 24 hues nudged toward amber, 5 saturation and 9
// lightness steps. Input and output are sRGB components 0..1.
export const PALETTE_STEPS={hues:24,saturation:[0,.18,.34,.5,.68],lightness:9,warmth:.1};
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
// Pixel ratio for a retro framebuffer about `lines` pixels tall, never above
// the device ratio; tiny windows keep at least ratio .25.
export function classicPixelRatio({height,devicePixelRatio=1,lines=300}){return +clamp(lines/Math.max(1,height),.25,Math.min(1,devicePixelRatio)).toFixed(3)}
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
// --- Terrain ---------------------------------------------------------------
export const CLASSIC_GROUND={grass:[.43,.53,.25],snow:[.88,.87,.82],sand:[.76,.66,.45],rock:[.53,.49,.43]};
// sRGB vertex colour for one terrain vertex from its climate weights
// (grass, snow, dry, castle-green), slope (normal.y), height and variation tint.
export function terrainColor(climate,normalY,height,tint=[1,1,1]){
 const [g,s,d,c]=climate,G=CLASSIC_GROUND,sum=Math.max(1e-6,g+s+d+c);const out=[0,0,0];
 for(let k=0;k<3;k++)out[k]=(G.grass[k]*(g+c)+G.snow[k]*s+G.sand[k]*d)/sum;
 const rock=clamp((1-clamp((Math.abs(normalY)-.6)/.28))*.85+clamp((height-30)/30)*.3);
 for(let k=0;k<3;k++)out[k]=out[k]*(1-rock)+G.rock[k]*rock;
 const snow=clamp((height-50)/9)*clamp((normalY-.55)/.3);for(let k=0;k<3;k++)out[k]=out[k]*(1-snow)+G.snow[k]*snow;
 for(let k=0;k<3;k++)out[k]=clamp(out[k]*(.8+.4*tint[k]));
 return quantizeColor(...out);
}
// Settings: a player's explicit choice wins, otherwise the owner's default.
export function classicEnabled(settings,gameConfig){return typeof settings?.classic==='boolean'?settings.classic:gameConfig?.classicLook===true}
// Blob shadow radius for a character (metres, before its scale).
const BLOB={dragon:2.3,ogre:1.05,troll:1.05,golem:1.1,bear:1.0,demon:.8,cow:1,horse:1.05,wolf:.72,boar:.7,deer:.72,sheep:.7,pig:.65,revenant:.6,wraith:.6,imp:.5,rat:.42,spider:.6,bat:.38,chicken:.32};
export function blobRadius(species){return BLOB[species]??.55}

const srgbToLinear=c=>c<=.04045?c/12.92:Math.pow((c+.055)/1.055,2.4),linearToSrgb=c=>c<=.0031308?c*12.92:1.055*Math.pow(c,1/2.4)-.055;
const LIT=m=>m&&(m.isMeshStandardMaterial||m.isMeshPhongMaterial||m.isMeshLambertMaterial||m.isMeshToonMaterial)&&!m.isShaderMaterial;

export function createClassicLook(T,{scene,renderer,camera,hiddenLayer=31,onChange=()=>{}}){
 let enabled=false;
 // Lambert has no image-based light, so a warm ambient fill stands in for the
 // environment map. Ambient light is not part of any shader key: it lives in
 // the scene from the start (dark while classic is off) and never recompiles.
 const ambient=new T.AmbientLight(0xfff0d8,0);ambient.name='classic-ambient';scene.add(ambient);
 const classicOf=new Map();// source material -> {classic, avg, bake, source colour}
 const simpler=new WeakMap(),baked=new WeakMap(),pixels=new Map();
 const converted=new Set();
 // Texture pixels, downsampled once (64x64 tiles, 128x128 atlases).
 function texturePixels(texture,size){
  // Procedural textures carry their base colour: no canvas read-back needed for the average.
  if(size===64&&Number.isFinite(texture?.userData?.baseColor)){const h=texture.userData.baseColor;return {size:0,data:null,avg:[(h>>16&255)/255,(h>>8&255)/255,(h&255)/255]}}
  const image=texture?.image;if(!image||!(image.width>0)||typeof document==='undefined')return null;
  const key=texture.uuid+':'+size;let p=pixels.get(key);if(p)return p;
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
 // flat colour, so they share one material and the cell batcher can merge
 // their meshes into fewer draw calls.
 const pool=new Map();let revision=0;
 function variantOf(src,mesh){const map=src.map;if(src.alphaTest>0&&map)return 'cutout';if(map&&atlas(map)&&(mesh.isSkinnedMesh||map.flipY===false)&&!mesh.isInstancedMesh&&mesh.geometry.attributes.uv&&!mesh.userData.staticBatch)return 'bake';return 'flat'}
 function signature(src,variant,avg,emissiveAvg){
  const color=variant==='flat'?quantizedLinear(src.color,avg).getHex():src.color.getHex(),emissive=src.emissive?new T.Color().copy(src.emissive).multiply(new T.Color(...emissiveAvg)).getHex():0;
  return [variant,color,variant==='cutout'?src.map.uuid:'',variant==='bake'||!!src.vertexColors,src.transparent,+src.opacity.toFixed(3),src.side,src.alphaTest,src.depthWrite,src.depthTest,src.fog,src.visible,src.polygonOffset,src.polygonOffsetFactor,src.polygonOffsetUnits,src.toneMapped,emissive,+(src.emissiveIntensity??1).toFixed(3)].join('|')}
 function pooled(sig,src,variant,avg,emissiveAvg){let m=pool.get(sig);if(m)return m;
  m=new T.MeshLambertMaterial({name:'classic',color:variant==='flat'?quantizedLinear(src.color,avg):src.color.clone(),flatShading:true,vertexColors:variant==='bake'||!!src.vertexColors,transparent:src.transparent,opacity:src.opacity,side:src.side,alphaTest:src.alphaTest,depthWrite:src.depthWrite,depthTest:src.depthTest,fog:src.fog,visible:src.visible,polygonOffset:src.polygonOffset,polygonOffsetFactor:src.polygonOffsetFactor,polygonOffsetUnits:src.polygonOffsetUnits,toneMapped:src.toneMapped});
  if(variant==='cutout'){const t=src.map.clone();t.magFilter=T.NearestFilter;t.needsUpdate=true;m.map=t}
  if(src.emissive){m.emissive.copy(src.emissive).multiply(new T.Color(...emissiveAvg));m.emissiveIntensity=src.emissiveIntensity}
  m.userData.eldervaleShared=true;pool.set(sig,m);return m}
 function classicMaterial(src,mesh){
  if(!LIT(src)||src.visible===false||src.userData?.classicKeep)return {material:src};
  const variant=variantOf(src,mesh);let slot=classicOf.get(src);if(!slot)classicOf.set(src,slot={});let entry=slot[variant];
  if(!entry){
   let avg=[1,1,1],emissiveAvg=[1,1,1];if(variant==='flat'&&src.map){const px=texturePixels(src.map,64);if(!px)return null;avg=px.avg}
   if(src.emissiveMap){const px=texturePixels(src.emissiveMap,64);if(px)emissiveAvg=px.avg}
   const sig=signature(src,variant,avg,emissiveAvg);entry=slot[variant]={variant,avg,emissiveAvg,sig,material:pooled(sig,src,variant,avg,emissiveAvg)};
  }
  if(variant==='bake'){const g=bakeGeometry(mesh.userData.classicOrig?.geometry||mesh.geometry,src.map);if(!g)return null;return {material:entry.material,geometry:g}}
  return {material:entry.material};
 }
 function lowPoly(geometry){
  if(!geometry?.parameters||geometry.userData?.noClassicSimplify)return geometry;let g=simpler.get(geometry);if(g)return g;
  const q=simplifiedParameters(geometry.type,geometry.parameters),ctor=q&&T[geometry.type];
  g=ctor?new ctor(...q):geometry;if(g!==geometry){g.userData.eldervaleShared=!!geometry.userData.eldervaleShared;g.userData.classicLowPoly=true}simpler.set(geometry,g);return g}
 // Convert one mesh; returns false when its textures are not loaded yet (retry later).
 function convertMesh(o){
  const ud=o.userData;if(ud.classicIgnore||ud.classicOrig&&ud.classicTerrain||ud.classicSkip===o.material||o.isSprite||o.isPoints||o.isLine)return true;
  if(ud.classicOrig&&o.material===ud.classicMaterial&&ud.classicRevision===revision)return true;
  if(ud.classicOrig&&o.material!==ud.classicMaterial){ud.classicOrig.material=o.material}ud.classicRevision=revision;// gameplay swapped the material
  const classicGeometry=o.geometry.userData.classicLowPoly||o.geometry.userData.classicBaked,srcMaterial=ud.classicOrig?.material??o.material,srcGeometry=classicGeometry&&ud.classicOrig?ud.classicOrig.geometry:o.geometry;
  const list=Array.isArray(srcMaterial)?srcMaterial:[srcMaterial];let geometry=srcGeometry;const out=[];
  for(const m of list){const r=classicMaterial(m,o);if(!r)return false;out.push(r.material);if(r.geometry)geometry=r.geometry}
  if(geometry===srcGeometry&&!o.isSkinnedMesh&&!o.isInstancedMesh&&!ud.drape&&!ud.surface)geometry=lowPoly(srcGeometry);
  if(!out.some((m,i)=>m!==list[i])&&geometry===srcGeometry){if(!ud.classicOrig)ud.classicSkip=o.material;return true}
  ud.classicOrig={material:srcMaterial,geometry:srcGeometry,castShadow:ud.classicOrig?ud.classicOrig.castShadow:o.castShadow};
  o.material=Array.isArray(srcMaterial)?out:out[0];o.geometry=geometry;ud.classicMaterial=o.material;o.castShadow=false;converted.add(o);return true}
 function restoreMesh(o){const orig=o.userData.classicOrig;if(!orig)return;if(o.material===o.userData.classicMaterial)o.material=orig.material;if(o.geometry!==orig.geometry&&(o.geometry.userData.classicLowPoly||o.geometry.userData.classicBaked))o.geometry=orig.geometry;o.castShadow=orig.castShadow;delete o.userData.classicOrig;delete o.userData.classicMaterial;delete o.userData.classicTerrain}
 function convert(root){let pending=0;root.traverse(o=>{if(o.isMesh&&!convertMesh(o))pending++});return pending}
 // Gameplay tweaks colour/opacity/glow on the original shared materials; mirror them.
 function syncMaterials(){for(const [src,slot] of classicOf)for(const e of Object.values(slot)){const sig=signature(src,e.variant,e.avg,e.emissiveAvg);if(sig!==e.sig){e.sig=sig;e.material=pooled(sig,src,e.variant,e.avg,e.emissiveAvg);revision++}}}

 // --- Terrain bake ---
 function terrainGeometry(ground){
  const src=ground.userData.classicOrig?.geometry||ground.geometry;let g=baked.get(src)?.get('terrain');if(g)return g;
  const pos=src.attributes.position,nor=src.attributes.normal,cli=src.attributes.climate,tint=src.attributes.color;g=src.clone();const col=new Float32Array(pos.count*3);
  for(let i=0;i<pos.count;i++){const c=cli?[cli.getX(i),cli.getY(i),cli.getZ(i),cli.getW(i)]:[1,0,0,0],t=tint?[linearToSrgb(tint.getX(i)),linearToSrgb(tint.getY(i)),linearToSrgb(tint.getZ(i))].map(v=>clamp(v/.75)):[1,1,1];const q=terrainColor(c,nor.getY(i),pos.getY(i),t);col[i*3]=srgbToLinear(q[0]);col[i*3+1]=srgbToLinear(q[1]);col[i*3+2]=srgbToLinear(q[2])}
  g.setAttribute('color',new T.BufferAttribute(col,3));g.userData.classicBaked=true;let byTex=baked.get(src);if(!byTex)baked.set(src,byTex=new Map());byTex.set('terrain',g);return g}
 const terrainMaterial=new T.MeshLambertMaterial({vertexColors:true,flatShading:true,name:'classic-terrain'});terrainMaterial.userData.eldervaleShared=true;
 function convertTerrain(ground){if(!ground||ground.userData.classicOrig)return;const g=terrainGeometry(ground);ground.userData.classicOrig={material:ground.material,geometry:ground.geometry,castShadow:ground.castShadow};ground.material=terrainMaterial;ground.geometry=g;ground.userData.classicMaterial=terrainMaterial;ground.userData.classicTerrain=true;converted.add(ground)}

 // --- Blob shadows: one instanced draw for every character ---
 const MAX_BLOBS=256;let blobs=null;const dummy=new T.Object3D();
 function blobMesh(){if(blobs)return blobs;let texture=null;if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d'),grad=x.createRadialGradient(16,16,0,16,16,16);grad.addColorStop(0,'rgba(0,0,0,.55)');grad.addColorStop(.6,'rgba(0,0,0,.35)');grad.addColorStop(1,'rgba(0,0,0,0)');x.fillStyle=grad;x.fillRect(0,0,32,32);texture=new T.CanvasTexture(c);texture.magFilter=T.NearestFilter}
  const geometry=new T.CircleGeometry(1,10);geometry.rotateX(-Math.PI/2);
  blobs=new T.InstancedMesh(geometry,new T.MeshBasicMaterial({color:0x000000,map:texture,transparent:true,opacity:texture?1:.35,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2,fog:true}),MAX_BLOBS);
  blobs.count=0;blobs.frustumCulled=false;blobs.renderOrder=1;blobs.userData.classicIgnore=true;blobs.name='classic-blob-shadows';return blobs}
 function updateBlobs(actors){if(!enabled)return;const b=blobMesh();let n=0;for(const a of actors){if(n>=MAX_BLOBS)break;const root=a.root;if(!root?.visible||a.hidden)continue;const r=(a.radius??.55)*(root.scale?.x||1);dummy.position.set(root.position.x,(a.y??root.position.y)+.045,root.position.z);dummy.scale.set(r,1,r);dummy.rotation.set(0,0,0);dummy.updateMatrix();b.setMatrixAt(n++,dummy.matrix)}b.count=n;b.instanceMatrix.needsUpdate=true}

 // --- Sky: a low-poly banded dome, coloured by time of day ---
 let dome=null;
 function skyDome(){if(dome)return dome;const g=new T.SphereGeometry(400,10,6);const col=new Float32Array(g.attributes.position.count*3);g.setAttribute('color',new T.BufferAttribute(col,3));
  dome=new T.Mesh(g,new T.MeshBasicMaterial({vertexColors:true,side:T.BackSide,fog:false,depthWrite:false,toneMapped:false}));dome.renderOrder=-10;dome.frustumCulled=false;dome.userData.classicIgnore=true;dome.name='classic-sky';return dome}
 const AMBIENT={day:1.1,night:.35};
 const SKY={day:[0x7fa6c4,0xe8d4a8],dusk:[0x4c5680,0xe39a62],night:[0x0f1526,0x2f2a44]};
 function skyColors(daylight,twilight){const top=new T.Color(SKY.night[0]).lerp(new T.Color(SKY.day[0]),daylight),horizon=new T.Color(SKY.night[1]).lerp(new T.Color(SKY.day[1]),daylight);top.lerp(new T.Color(SKY.dusk[0]),twilight*.5);horizon.lerp(new T.Color(SKY.dusk[1]),twilight*.6);return {top,horizon}}
 let lastSky={daylight:1,twilight:0};
 function applySky(daylight=lastSky.daylight,twilight=lastSky.twilight){lastSky={daylight,twilight};if(!enabled)return;const {top,horizon}=skyColors(daylight,twilight),d=skyDome(),pos=d.geometry.attributes.position,col=d.geometry.attributes.color,c=new T.Color();
  for(let i=0;i<pos.count;i++){const h=clamp(pos.getY(i)/400);c.copy(horizon).lerp(top,Math.pow(h,.6));col.setXYZ(i,c.r,c.g,c.b)}col.needsUpdate=true;
  if(scene.background?.isColor)scene.background.copy(horizon);if(scene.fog)scene.fog.color.copy(horizon);ambient.color.copy(horizon).lerp(new T.Color(0xffffff),.5);ambient.intensity=AMBIENT.night+(AMBIENT.day-AMBIENT.night)*daylight}

 // --- Time-sliced sweep over the scene: converts what streams in ---
 let sweep=null,sweepPending=0;
 let slowest={ms:0,name:''};const clock=()=>globalThis.performance?.now?.()??Date.now();
 function* walk(){const stack=[scene],seen=new Set();let pending=0;while(stack.length){const o=stack.pop();if(o.isMesh){const t=clock();if(!convertMesh(o))pending++;else if(o.userData.classicOrig)seen.add(o);const ms=clock()-t;if(ms>slowest.ms)slowest={ms:+ms.toFixed(1),name:(o.name||o.parent?.name||o.type)+'/'+o.geometry?.type+'/'+(o.geometry?.attributes?.position?.count||0)+'/'+[].concat(o.userData.classicOrig?.material||o.material).map(m=>m.type+':'+(m.map?.image?.constructor?.name||'-')+':'+(m.map?.image?.width||0)+'x'+(m.map?.image?.height||0)).join(';')}}for(let i=o.children.length-1;i>=0;i--)stack.push(o.children[i]);yield}sweepPending=pending;converted.clear();for(const o of seen)converted.add(o);const t=clock();syncMaterials();const ms=clock()-t;if(ms>slowest.ms)slowest={ms:+ms.toFixed(1),name:'sync'}}
 function update(budget=1.5,now=()=>performance.now()){
  if(!enabled)return;if(dome){dome.position.copy(camera.position);dome.scale.setScalar(Math.min(1,(camera.far||450)*.92/400))}
  const end=now()+budget;sweep??=walk();while(true){if(sweep.next().done){sweep=null;break}if(now()>end)break}
 }
 const hiddenLayers=new Map();
 function hide(objects,hidden){for(const o of objects){if(!o)continue;if(hidden){if(!hiddenLayers.has(o))hiddenLayers.set(o,o.layers.mask);o.layers.set(hiddenLayer)}else if(hiddenLayers.has(o)){o.layers.mask=hiddenLayers.get(o);hiddenLayers.delete(o)}}}
 let hideTargets=()=>[];let ground=null;
 return {
  get enabled(){return enabled},get pending(){return sweepPending},get converted(){return converted.size},
  convert,convertMesh,classicMaterial,lowPoly,updateBlobs,applySky,update,
  configure({ground:g,hide:h}={}){if(g)ground=g;if(h)hideTargets=h},
  set(on){on=!!on;if(on===enabled)return false;enabled=on;
   if(on){convertTerrain(ground);scene.add(skyDome());scene.add(blobMesh());blobs.visible=true;dome.visible=true;hide(hideTargets(),true);applySky();sweep=null;let guard=0;const it=walk();while(!it.next().done)guard++;}
   else{for(const o of converted)restoreMesh(o);scene.traverse(o=>{if(o.userData.classicOrig)restoreMesh(o)});converted.clear();ambient.intensity=0;if(dome)dome.visible=false;if(blobs){blobs.visible=false;blobs.count=0}hide([...hiddenLayers.keys()],false);sweep=null}
   renderer.domElement.style.imageRendering=on?'pixelated':'';onChange(on);return true},
  // Converted materials are shared; this lists them for shader warm-up.
  materials(){return [terrainMaterial,...pool.values()]},
  stats(){let bakedCount=0;for(const s of classicOf.values())if(s.bake)bakedCount++;return {enabled,converted:converted.size,sources:classicOf.size,materials:pool.size,baked:bakedCount,blobs:blobs?.count||0,pending:sweepPending,slowest}}
 };
}
