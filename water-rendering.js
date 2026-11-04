// One shared, throttled planar capture; never a reflection pass per water mesh.
// Mirror-camera clipping follows Eric Lengyel's oblique near-plane method,
// also used by Three.js Reflector (MIT, https://threejs.org/).
export function waterQuality(preset='high',compact=false){return preset==='low'?{size:128,interval:250,reflections:false}:compact||preset==='medium'?{size:256,interval:125,reflections:true}:{size:512,interval:100,reflections:true}}
export function createWaterSystem(T,scene,renderer,land){
 const size=land.segments+1,heights=new T.DataTexture(land.heights.slice(),size,size,T.RedFormat,T.FloatType);heights.minFilter=heights.magFilter=T.NearestFilter;heights.needsUpdate=true;
 const pixels=new Uint8Array(64*64*4);let noiseSeed=7819;for(let i=0;i<pixels.length;i++){noiseSeed=(Math.imul(noiseSeed,1664525)+1013904223)>>>0;pixels[i]=noiseSeed>>>24;}
 const noise=new T.DataTexture(pixels,64,64,T.RGBAFormat);noise.wrapS=noise.wrapT=T.RepeatWrapping;noise.minFilter=noise.magFilter=T.LinearFilter;noise.needsUpdate=true;
 const capture=new T.WebGLRenderTarget(512,512,{type:renderer.capabilities.isWebGL2&&renderer.extensions.has('EXT_color_buffer_float')?T.HalfFloatType:T.UnsignedByteType,depthBuffer:true});
 const virtual=new T.PerspectiveCamera(),textureMatrix=new T.Matrix4(),plane=new T.Plane(),clip=new T.Vector4(),q=new T.Vector4(),worldNormal=new T.Vector3(0,1,0);
 let fishingSpots=[];const uniforms={waterFishing:{value:Array.from({length:12},()=>new T.Vector2())},waterFishingCount:{value:0},waterTexel:{value:1/512},waterTime:{value:0},waterNoise:{value:noise},waterTerrain:{value:heights},waterGrid:{value:size},waterExtent:{value:land.extent},waterReflection:{value:capture.texture},waterMatrix:{value:textureMatrix},waterReady:{value:0},waterPlane:{value:0},waterShallow:{value:new T.Color(0x63998d)},waterDeep:{value:new T.Color(0x174653)}};
 const material=new T.MeshStandardMaterial({color:0xffffff,metalness:0,roughness:.22,envMapIntensity:.5});material.userData.eldervaleShared=true;
 material.onBeforeCompile=shader=>{
  Object.assign(shader.uniforms,uniforms);
  shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nattribute vec3 waterFlow;varying vec3 vWaterFlow;varying vec3 vWaterWorld;uniform mat4 waterMatrix;varying vec4 vWaterReflect;').replace('#include <worldpos_vertex>','#include <worldpos_vertex>\nvWaterFlow=waterFlow;vWaterWorld=(modelMatrix*vec4(transformed,1.)).xyz;vWaterReflect=waterMatrix*vec4(vWaterWorld,1.);');
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>',`#include <common>
   varying vec3 vWaterFlow;varying vec3 vWaterWorld;varying vec4 vWaterReflect;
   uniform vec2 waterFishing[12];uniform int waterFishingCount;uniform float waterTexel,waterTime,waterGrid,waterExtent,waterReady,waterPlane;
   uniform sampler2D waterTerrain,waterReflection,waterNoise;uniform vec3 waterShallow,waterDeep;
   float terrainHeight(vec2 point){
    vec2 grid=clamp((point/waterExtent+.5)*(waterGrid-1.),vec2(0.),vec2(waterGrid-1.001));vec2 cell=floor(grid),f=fract(grid);
    vec2 uv=(cell+.5)/waterGrid;float stepUv=1./waterGrid;
    float a=texture2D(waterTerrain,uv).r,b=texture2D(waterTerrain,uv+vec2(stepUv,0.)).r,c=texture2D(waterTerrain,uv+vec2(0.,stepUv)).r,d=texture2D(waterTerrain,uv+vec2(stepUv)).r;
    return f.x+f.y<=1.?a+(b-a)*f.x+(c-a)*f.y:d+(c-d)*(1.-f.x)+(b-d)*(1.-f.y);
   }
   vec2 waveSlope(vec2 p){vec2 worldPoint=p;p-=vWaterFlow.xz*waterTime*vWaterFlow.y;vec2 a=texture2D(waterNoise,p*.045+vec2(waterTime*.002,-waterTime*.001)).rg*2.-1.,b=texture2D(waterNoise,p*.097+vec2(-waterTime*.001,waterTime*.003)).ba*2.-1.;vec2 slope=a*.055+b*.025;for(int i=0;i<12;i++){if(i>=waterFishingCount)break;vec2 delta=worldPoint-waterFishing[i];float d=length(delta),fade=1.-smoothstep(.1,1.8,d);slope+=delta/max(.1,d)*cos(d*14.-waterTime*3.2)*.09*fade;}return slope;}
  `).replace('#include <color_fragment>',`#include <color_fragment>
   float waterDepth=max(0.,vWaterWorld.y-terrainHeight(vWaterWorld.xz));
   diffuseColor.rgb=mix(waterShallow,waterDeep,1.-exp(-waterDepth*1.1));
   vec2 current=vWaterFlow.xz,across=vec2(-current.y,current.x),flowPoint=vWaterWorld.xz-current*waterTime*vWaterFlow.y;
   float currentRipple=texture2D(waterNoise,flowPoint*.11).b;
   float brokenCrest=smoothstep(.72,.96,currentRipple);
   float shore=1.-smoothstep(.04,.32,waterDepth);
   float foam=shore*smoothstep(.25,.85,currentRipple)*.22;
   diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.72,.82,.77),foam);
   diffuseColor.rgb+=vec3(.012,.018,.017)*brokenCrest*(.25+.75*clamp(vWaterFlow.y,0.,1.));
  `).replace('#include <normal_fragment_maps>',`#include <normal_fragment_maps>
   vec2 waterSlope=waveSlope(vWaterWorld.xz);
   normal=normalize((viewMatrix*vec4(normalize(vec3(-waterSlope.x,1.,-waterSlope.y)),0.)).xyz);
  `).replace('#include <opaque_fragment>',`
   vec3 reflectedUv=vWaterReflect.xyz/max(vWaterReflect.w,.0001);
   vec2 reflectedPoint=reflectedUv.xy+waterSlope*.022;
   float fresnel=.0204+.9796*pow(1.-clamp(dot(normal,normalize(vViewPosition)),0.,1.),5.);
   float valid=waterReady*step(abs(vWaterWorld.y-waterPlane),.014)*step(0.,reflectedPoint.x)*step(reflectedPoint.x,1.)*step(0.,reflectedPoint.y)*step(reflectedPoint.y,1.)*step(.001,vWaterReflect.w);
   vec2 texel=vec2(waterTexel);
   vec3 reflected=texture2D(waterReflection,reflectedPoint).rgb*.5;
   reflected+=(texture2D(waterReflection,reflectedPoint+texel).rgb+texture2D(waterReflection,reflectedPoint-texel).rgb)*.25;
   outgoingLight=mix(outgoingLight,reflected,valid*fresnel);
   #include <opaque_fragment>
  `);
 };
 const meshes=[],triangles=new Map(),bounds=new Map(),frustum=new T.Frustum(),viewProjection=new T.Matrix4(),stats={probes:0,triangleTests:0};let quality=waterQuality(),last=-Infinity,captures=0,nextProbe=-Infinity,nextFishing=-Infinity;
 function add(mesh,{flow=null}={}){mesh.material.dispose();mesh.material=material;mesh.receiveShadow=true;mesh.userData.waterSurface=true;meshes.push(mesh);mesh.updateWorldMatrix(true,false);const p=mesh.geometry.attributes.position,index=mesh.geometry.index,points=[];for(let i=0;i<(index?.count||p.count);i+=3)points.push([0,1,2].map(j=>{const k=index?index.getX(i+j):i+j;return mesh.localToWorld(new T.Vector3(p.getX(k),p.getY(k),p.getZ(k)))}));triangles.set(mesh,points);const box=new T.Box3();for(const tri of points)for(const vertex of tri)box.expandByPoint(vertex);bounds.set(mesh,box);
 const currents=[];for(let i=0;i<p.count;i++){const vertex=mesh.localToWorld(new T.Vector3(p.getX(i),p.getY(i),p.getZ(i)));let dx=.8,dz=.6,speed=.09,best=Infinity;if(flow?.length>1){speed=.55;for(let j=1;j<flow.length;j++){const a=flow[j-1],b=flow[j],sx=b[0]-a[0],sz=b[1]-a[1],length=sx*sx+sz*sz;if(length<1e-8)continue;const t=Math.max(0,Math.min(1,((vertex.x-a[0])*sx+(vertex.z-a[1])*sz)/length)),distance=(vertex.x-a[0]-t*sx)**2+(vertex.z-a[1]-t*sz)**2;if(distance<best){best=distance;dx=sx/Math.sqrt(length);dz=sz/Math.sqrt(length)}}}currents.push(dx,speed,dz)}mesh.geometry.setAttribute('waterFlow',new T.Float32BufferAttribute(currents,3));return mesh;}
 function distance(mesh,x,z){let nearest=Infinity;for(const [a,b,c]of triangles.get(mesh)){stats.triangleTests++;const side=(p,u,v)=>(v.x-u.x)*(p.z-u.z)-(v.z-u.z)*(p.x-u.x),p={x,z},s=[side(p,a,b),side(p,b,c),side(p,c,a)];if(s.every(v=>v>=0)||s.every(v=>v<=0))return 0;for(const [u,v]of [[a,b],[b,c],[c,a]]){const dx=v.x-u.x,dz=v.z-u.z,t=Math.max(0,Math.min(1,((x-u.x)*dx+(z-u.z)*dz)/(dx*dx+dz*dz||1)));nearest=Math.min(nearest,Math.hypot(x-u.x-dx*t,z-u.z-dz*t));}}return nearest;}
 function setQuality(preset,compact){quality=waterQuality(preset,compact);uniforms.waterTexel.value=1/quality.size;if(capture.width!==quality.size){capture.setSize(quality.size,quality.size);uniforms.waterReady.value=0;}last=-Infinity;nextProbe=-Infinity;}
 function update(camera,now,daylight=1,reducedMotion=false){
  if(now>=nextFishing){nextFishing=now+250;const near=fishingSpots.filter(p=>Math.hypot(p.x-camera.position.x,p.z-camera.position.z)<85).sort((a,b)=>Math.hypot(a.x-camera.position.x,a.z-camera.position.z)-Math.hypot(b.x-camera.position.x,b.z-camera.position.z)).slice(0,12);uniforms.waterFishingCount.value=near.length;near.forEach((p,i)=>uniforms.waterFishing.value[i].set(p.x,p.z));}
  uniforms.waterTime.value=reducedMotion?0:now*.001;material.envMapIntensity=.08+.48*daylight;
  if(!quality.reflections){uniforms.waterReady.value=0;return false;}
  // Do no shoreline searches on frames that cannot produce a reflection.
  if(now<nextProbe)return false;nextProbe=now+quality.interval;stats.probes++;
  camera.updateMatrixWorld();viewProjection.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);frustum.setFromProjectionMatrix(viewProjection);
  let nearest=null;for(const mesh of meshes){if(!mesh.visible)continue;const box=bounds.get(mesh),dx=Math.max(box.min.x-camera.position.x,0,camera.position.x-box.max.x),dz=Math.max(box.min.z-camera.position.z,0,camera.position.z-box.max.z);if(dx*dx+dz*dz>85*85||!frustum.intersectsBox(box))continue;const d=distance(mesh,camera.position.x,camera.position.z);if(!nearest||d<nearest.distance)nearest={mesh,distance:d};}

  if(!nearest||nearest.distance>85){uniforms.waterReady.value=0;return false;}
  const y=triangles.get(nearest.mesh)[0][0].y;if(camera.position.y<=y+.02){uniforms.waterReady.value=0;return false;}
  if(now-last<quality.interval&&Math.abs(uniforms.waterPlane.value-y)<.01)return false;
  camera.updateMatrixWorld();virtual.copy(camera,false);virtual.position.copy(camera.position);virtual.position.y=2*y-camera.position.y;
  const target=new T.Vector3();camera.getWorldDirection(target);target.add(camera.position);target.y=2*y-target.y;
  virtual.up.copy(camera.up).reflect(worldNormal);virtual.lookAt(target);virtual.updateMatrixWorld();virtual.projectionMatrix.copy(camera.projectionMatrix);
  const nextMatrix=new T.Matrix4().set(.5,0,0,.5,0,.5,0,.5,0,0,.5,.5,0,0,0,1).multiply(virtual.projectionMatrix).multiply(virtual.matrixWorldInverse);
  plane.setFromNormalAndCoplanarPoint(worldNormal,new T.Vector3(0,y,0)).applyMatrix4(virtual.matrixWorldInverse);clip.set(plane.normal.x,plane.normal.y,plane.normal.z,plane.constant);
  const p=virtual.projectionMatrix.elements;q.set((Math.sign(clip.x)+p[8])/p[0],(Math.sign(clip.y)+p[9])/p[5],-1,(1+p[10])/p[14]);clip.multiplyScalar(2/clip.dot(q));p[2]=clip.x;p[6]=clip.y;p[10]=clip.z+1-.002;p[14]=clip.w;virtual.projectionMatrixInverse.copy(virtual.projectionMatrix).invert();
  const previous={target:renderer.getRenderTarget(),xr:renderer.xr.enabled,shadow:renderer.shadowMap.autoUpdate,tone:renderer.toneMapping,viewport:renderer.getViewport(new T.Vector4()),scissor:renderer.getScissor(new T.Vector4()),scissorTest:renderer.getScissorTest()},visible=meshes.map(m=>m.visible),sky=scene.children.find(m=>m.userData.environmentSky),skyPosition=sky?.position.clone();
  try{if(sky)sky.position.copy(virtual.position);meshes.forEach(m=>m.visible=false);renderer.xr.enabled=false;renderer.shadowMap.autoUpdate=false;renderer.toneMapping=T.NoToneMapping;renderer.setRenderTarget(capture);renderer.setScissorTest(false);renderer.clear();renderer.render(scene,virtual);textureMatrix.copy(nextMatrix);uniforms.waterPlane.value=y;uniforms.waterReady.value=1;last=now;captures++;return true;}
  finally{if(sky)sky.position.copy(skyPosition);meshes.forEach((m,i)=>m.visible=visible[i]);renderer.xr.enabled=previous.xr;renderer.shadowMap.autoUpdate=previous.shadow;renderer.toneMapping=previous.tone;renderer.setRenderTarget(previous.target);renderer.setViewport(previous.viewport);renderer.setScissor(previous.scissor);renderer.setScissorTest(previous.scissorTest);}
 }
 return {add,material,setQuality,update,meshes,uniforms,stats,setFishingSpots(points){fishingSpots=points},get captures(){return captures},refreshTerrain(){heights.image.data.set(land.heights);heights.needsUpdate=true;last=-Infinity;nextProbe=-Infinity},dispose(){heights.dispose();noise.dispose();capture.dispose();material.dispose()}};
}
