// Weather on screen (weather.js has the shared schedule): rain streaks and snow /
// ash flakes drawn on the GPU in a box that follows the camera (one draw call
// each, density by draw range), ripples on water and splashes on the ground,
// overcast skies and fog, lightning flashes with a distant bolt and thunder,
// wet ground and roads, snow settling on terrain and roofs, wind in the grass.
// Everything eases toward the blended look at the player (schedule fades and
// region borders are already smooth; forced changes ease over a few seconds).
// Indoors: no precipitation, flashes through the windows only. Underground
// (window.eldervaleUndergroundArea, set by the cave system while inside a cave): no weather at all.
// Tiers: low draws few particles and skips wet shading and ripples; classic
// look gets chunky, flat rain streaks and square flakes.
import {weatherAt,weatherLook,weatherLabel,lightningAt,thunderFor,weatherUniforms,LOOK_FIELDS} from './weather.js?v=release-20261106-amb123';

export const WEATHER_TIERS={
 low:{rain:1400,flakes:1000,ripples:0,wetShading:false,materials:false},
 medium:{rain:3600,flakes:2600,ripples:28,wetShading:true,materials:true},
 high:{rain:6500,flakes:4500,ripples:56,wetShading:true,materials:true},
 ultra:{rain:8000,flakes:5500,ripples:64,wetShading:true,materials:true}
};
export function weatherTier(preset='high',classic=false){const t=WEATHER_TIERS[preset]||WEATHER_TIERS.high;return classic?{...t,rain:Math.round(t.rain*.45),flakes:Math.round(t.flakes*.5),ripples:Math.min(t.ripples,16),materials:false}:t}
// Fog distances for a fog amount 0..1 (heavy fog closes in to ~45 m).
export function weatherFog(baseNear,baseFar,amount){const f=Math.max(0,Math.min(1,amount))**1.15;return {near:baseNear*(1-f)+1.5*f,far:baseFar*(1-f)+Math.min(baseFar,46)*f}}
// Wetness and settled snow chase their targets slowly: rain soaks in over ~30 s,
// the ground dries over a few minutes; snow settles over ~80 s and melts slower.
export function soak(value,target,dt,{up=30,down=160}={}){return target>value?Math.min(target,value+dt/up):Math.max(target,value-dt/down)}
// Flash brightness for a strike that began `t` seconds ago with `pulses` flickers.
export function flashLevel(t,pulses=2){if(t<0||t>1.2)return 0;let v=0;for(let i=0;i<pulses;i++){const s=t-i*.14-(i>1?.12:0);if(s>=0)v=Math.max(v,Math.exp(-s*14)*(i?.75:1))}return v}

const PRECIP_VERTEX=`
attribute vec4 aSeed;attribute vec2 aCorner;
uniform float uTime,uBox,uHeight,uSpeed,uLength,uWidth,uFlake;uniform vec3 uCam;uniform vec2 uWind;
varying vec2 vCorner;varying float vFade;
void main(){
 float speed=uSpeed*(.8+.4*aSeed.w);
 vec3 p;p.xz=uCam.xz+(fract((aSeed.xy*uBox-uCam.xz)/uBox+.5)-.5)*uBox;
 float fall=mod(uTime*speed+aSeed.z*uHeight,uHeight);
 p.y=uCam.y+uHeight*.42-fall;
 p.xz+=uWind*(fall/max(speed,.1));
 vec3 pos;
 if(uFlake>.5){
  p.x+=sin(uTime*1.1+aSeed.z*41.)*.35;p.z+=cos(uTime*.83+aSeed.w*29.)*.35;
  vec3 right=vec3(viewMatrix[0][0],viewMatrix[1][0],viewMatrix[2][0]),up=vec3(viewMatrix[0][1],viewMatrix[1][1],viewMatrix[2][1]);
  float s=uWidth*(.55+.9*aSeed.w);pos=p+(right*aCorner.x+up*(aCorner.y*2.-1.))*s;
 }else{
  vec3 vel=normalize(vec3(uWind.x,-speed,uWind.y));vec3 side=normalize(cross(vel,normalize(cameraPosition-p)));
  pos=p+side*aCorner.x*uWidth-vel*aCorner.y*uLength*(.7+.6*aSeed.w);
 }
 float d=distance(p,cameraPosition);
 vFade=(1.-smoothstep(uBox*.28,uBox*.5,d))*smoothstep(.5,2.2,d);
 vCorner=aCorner;
 gl_Position=projectionMatrix*viewMatrix*vec4(pos,1.);
}`;
const PRECIP_FRAGMENT=`
uniform vec3 uColor;uniform float uOpacity,uClassic,uFlake;
varying vec2 vCorner;varying float vFade;
void main(){
 float a;
 if(uFlake>.5){vec2 q=vec2(vCorner.x,vCorner.y*2.-1.);a=uClassic>.5?step(max(abs(q.x),abs(q.y)),.75):1.-smoothstep(.25,1.,length(q));}
 else a=uClassic>.5?1.:(1.-abs(vCorner.x))*(1.-vCorner.y*.75);
 a*=uOpacity*vFade;if(a<.01)discard;
 gl_FragColor=vec4(uColor,a);
}`;
const RIPPLE_VERTEX=`
attribute float aBirth;uniform float uTime,uLife;varying vec2 vUv;varying float vAge;
void main(){vUv=uv*2.-1.;vAge=(uTime-aBirth)/uLife;gl_Position=projectionMatrix*viewMatrix*modelMatrix*instanceMatrix*vec4(position,1.);}`;
const RIPPLE_FRAGMENT=`
uniform vec3 uColor;uniform float uOpacity;varying vec2 vUv;varying float vAge;
void main(){if(vAge<0.||vAge>1.)discard;float r=length(vUv),ring=1.-smoothstep(0.,.11,abs(r-vAge*.92));float a=ring*(1.-vAge)*uOpacity;if(a<.01)discard;gl_FragColor=vec4(uColor,a);}`;

function quadGeometry(T,count,random){
 const seeds=new Float32Array(count*16),corners=new Float32Array(count*8),index=new (count*4>65535?Uint32Array:Uint16Array)(count*6);
 const C=[[-1,0],[1,0],[1,1],[-1,1]];
 for(let i=0;i<count;i++){const s=[random(),random(),random(),random()];for(let v=0;v<4;v++){seeds.set(s,(i*4+v)*4);corners.set(C[v],(i*4+v)*2)}index.set([i*4,i*4+1,i*4+2,i*4,i*4+2,i*4+3],i*6)}
 const g=new T.BufferGeometry();g.setAttribute('aSeed',new T.BufferAttribute(seeds,4));g.setAttribute('aCorner',new T.BufferAttribute(corners,2));
 // three needs a position attribute for the draw count; the shader builds positions itself.
 g.setAttribute('position',new T.BufferAttribute(new Float32Array(count*12),3));g.setIndex(new T.BufferAttribute(index,1));g.setDrawRange(0,0);g.boundingSphere=new T.Sphere(new T.Vector3(),1e6);return g;
}

export function createWeatherEffects(T,{scene,camera,renderer,landscape,sun,skyLight,player,classic=()=>false,classicDome=()=>null,classicAmbient=()=>null,shelter=()=>({indoors:false,underground:false}),houses=()=>[],worldSeed=1,onThunder=()=>{},now=()=>window.eldervaleServerTime?.()||Date.now(),random=Math.random}={}){
 let tier=weatherTier('high'),preset='high',classicOn=false,rainCount=0,flakeCount=0;
 const group=new T.Group();group.name='weather';group.userData.classicIgnore=true;group.userData.weather=true;group.userData.terrainFixed=true;/* never distance-culled or re-seated on the terrain (game.js) */scene.add(group);
 const common={transparent:true,depthWrite:false,fog:false,toneMapped:false,side:T.DoubleSide};
 const rainUniforms={uTime:{value:0},uBox:{value:46},uHeight:{value:26},uSpeed:{value:11},uLength:{value:.55},uWidth:{value:.012},uFlake:{value:0},uCam:{value:new T.Vector3()},uWind:{value:new T.Vector2()},uColor:{value:new T.Color(.6,.65,.72)},uOpacity:{value:.4},uClassic:{value:0}};
 const flakeUniforms={...Object.fromEntries(Object.entries(rainUniforms).map(([k,v])=>[k,{value:v.value?.clone?v.value.clone():v.value}])),uFlake:{value:1},uSpeed:{value:1.1},uWidth:{value:.045},uBox:{value:40},uHeight:{value:22}};
 flakeUniforms.uCam=rainUniforms.uCam;flakeUniforms.uTime=rainUniforms.uTime;
 const rainMaterial=new T.ShaderMaterial({...common,uniforms:rainUniforms,vertexShader:PRECIP_VERTEX,fragmentShader:PRECIP_FRAGMENT});rainMaterial.name='weather-rain';
 const flakeMaterial=new T.ShaderMaterial({...common,uniforms:flakeUniforms,vertexShader:PRECIP_VERTEX,fragmentShader:PRECIP_FRAGMENT});flakeMaterial.name='weather-flakes';
 const rain=new T.Mesh(new T.BufferGeometry(),rainMaterial),flakes=new T.Mesh(new T.BufferGeometry(),flakeMaterial);
 for(const m of [rain,flakes]){m.frustumCulled=false;m.visible=false;m.renderOrder=5;m.userData.classicIgnore=true;group.add(m)}
 // Ripples on water and small splashes on the ground (instanced rings).
 const rippleUniforms={uTime:{value:0},uLife:{value:.75},uColor:{value:new T.Color(.82,.87,.92)},uOpacity:{value:.55}};
 const rippleGeometry=new T.PlaneGeometry(1,1);rippleGeometry.rotateX(-Math.PI/2);rippleGeometry.setAttribute('aBirth',new T.InstancedBufferAttribute(new Float32Array(64).fill(-99),1));
 const ripples=new T.InstancedMesh(rippleGeometry,new T.ShaderMaterial({...common,uniforms:rippleUniforms,vertexShader:RIPPLE_VERTEX,fragmentShader:RIPPLE_FRAGMENT}),64);
 const rippleWait=new Float32Array(64);ripples.count=0;ripples.frustumCulled=false;ripples.visible=false;ripples.renderOrder=4;ripples.userData.classicIgnore=true;group.add(ripples);
 // Lightning bolt: a jagged ribbon rebuilt per strike (main channel + one fork).
 const BOLT=22,boltPositions=new Float32Array(BOLT*2*3),boltGeometry=new T.BufferGeometry();boltGeometry.setAttribute('position',new T.BufferAttribute(boltPositions,3));
 {const idx=[];for(let i=0;i<BOLT-1;i++){if(i===15)continue;const a=i*2;idx.push(a,a+1,a+2,a+1,a+3,a+2)}boltGeometry.setIndex(idx)}
 const bolt=new T.Mesh(boltGeometry,new T.MeshBasicMaterial({color:0xe8eeff,transparent:true,opacity:0,blending:T.AdditiveBlending,depthWrite:false,fog:false,toneMapped:false,side:T.DoubleSide}));
 bolt.frustumCulled=false;bolt.visible=false;bolt.renderOrder=6;bolt.userData.classicIgnore=true;group.add(bolt);

 const zero=weatherLook('clear',0),cur={...zero,tint:[...zero.tint]},state={kind:'clear',intensity:0,region:'heartlands',label:'',wet:0,snow:0,flash:0,indoors:false,underground:false,stormRegion:null,forced:false};
 let target=cur,nextEval=0,lastSecond=0,strikes=[],base=null,fogBase=null,t0=performance.now(),lastFrame=performance.now(),preview=null,windAngle=.6,nextMaterials=0,nextCollect=0;
 const materials=new Map();// material -> {color, roughness, roof}
 const shift={x:0,y:0};weatherUniforms.weatherCloudShift.value=new T.Vector2();

 function setQuality(p='high'){preset=p;classicOn=!!classic();tier=weatherTier(p,classicOn);
  if(tier.rain!==rainCount){rain.geometry.dispose();rain.geometry=quadGeometry(T,tier.rain,random);rainCount=tier.rain}
  if(tier.flakes!==flakeCount){flakes.geometry.dispose();flakes.geometry=quadGeometry(T,tier.flakes,random);flakeCount=tier.flakes}
  rainUniforms.uClassic.value=flakeUniforms.uClassic.value=classicOn?1:0;rainUniforms.uWidth.value=classicOn?.045:.026;rainUniforms.uLength.value=classicOn?.9:.85;flakeUniforms.uWidth.value=classicOn?.09:.045;
  if(!tier.materials)release();
 }
 // Values the sky clock set (updateWorldSky / classic applySky); weather scales from these.
 function captureSky(){const dome=classicDome(),amb=classicAmbient();base={background:scene.background?.clone?.(),fog:scene.fog.color.clone(),sun:sun.intensity,hemi:skyLight.intensity,exposure:renderer.toneMappingExposure,ambient:amb?.intensity??0,daylight:window.eldervaleDaylight??1,dome:dome?.material?.color?.clone()}}
 function captureFog(){fogBase={near:scene.fog.near,far:scene.fog.far}}
 const sheltered=()=>{try{const s=shelter()||{};const u=window.eldervaleUndergroundArea;return {indoors:!!s.indoors,underground:!!s.underground||!!(typeof u==='function'?u():u)||!!window.eldervaleInterior?.underground}}catch{return {indoors:false,underground:false}}};

 function evaluate(ms){
  const pub=window.eldervaleGameConfig?.weather,p=player.position,w=weatherAt(pub,p.x,p.z,ms,{seed:worldSeed,preview});
  const s=sheltered();state.indoors=s.indoors;state.underground=s.underground;state.region=w.region;
  target=s.underground?{...zero,wind:0,tint:[...zero.tint]}:w.look;
  const rs=w.states[w.region];state.kind=s.underground?'clear':w.kind;state.intensity=preview?preview.intensity??.8:rs?(rs.mix>=.5?rs.intensity:rs.from.intensity):0;state.forced=!!rs?.forced;state.label=s.underground?'':weatherLabel(state.kind,state.intensity);
  // Lightning follows the stormiest region you are in.
  let best=0;state.stormRegion=null;for(const [id,st] of Object.entries(w.states)){const t=weatherLook(st.kind,st.intensity).thunder*(st.mix>=.5?1:st.mix*2);if(t>best){best=t;state.stormRegion=id}}
  if(preview?.kind==='storm'){state.stormRegion=w.region}
  state.seed=pub?.seed??1;
 }
 function strike(ms,second){
  const hit=lightningAt(state.seed,state.stormRegion,second,cur.thunder);if(!hit)return;
  strikes.push({at:ms,pulses:hit.pulses,distance:hit.distance});
  const t=thunderFor(hit.distance);try{onThunder({...t,distance:hit.distance,bearing:hit.bearing,indoors:state.indoors})}catch{}
  if(hit.distance<3.2&&!state.indoors)drawBolt(hit.bearing,hit.distance);
 }
 function drawBolt(bearing,km){
  const far=Math.min((camera.far||330)*.82,140+km*45),cx=camera.position.x+Math.sin(bearing)*far,cz=camera.position.z+Math.cos(bearing)*far,ground=landscape?.heightAt?.(cx,cz)??0,top=ground+95+random()*35;
  const side=new T.Vector3(Math.cos(bearing),0,-Math.sin(bearing)),width=1.1+random()*.6,pts=[];let x=cx+(random()-.5)*20,z=cz+(random()-.5)*20;
  for(let i=0;i<16;i++){const y=top+(ground-top)*(i/15);pts.push([x,y,z]);x+=(random()-.5)*7;z+=(random()-.5)*7}
  const fork=Math.floor(4+random()*5),[fx,fy,fz]=pts[fork];let bx=fx,bz=fz;const dir=random()<.5?-1:1;for(let i=0;i<6;i++){pts.push([bx,fy-(i*(fy-ground)*.09),bz]);bx+=side.x*dir*(3+random()*3)+(random()-.5)*3;bz+=side.z*dir*(3+random()*3)+(random()-.5)*3}
  pts.forEach(([px,py,pz],i)=>{const w=(i<16?width*(1-i/22):width*.45);boltPositions.set([px-side.x*w,py,pz-side.z*w,px+side.x*w,py,pz+side.z*w],i*6)});
  boltGeometry.attributes.position.needsUpdate=true;bolt.userData.until=performance.now()+260;
 }
 function collectMaterials(){
  // Roads and river banks (draped ribbons), plazas and paved ground (surface entities), roofs.
  const list=[];for(const o of scene.children){if(o.userData?.drape&&o.material&&!Array.isArray(o.material))list.push([o.material,false]);else if(o.userData?.surface)for(const c of o.children)if(c.isMesh&&c.material&&!Array.isArray(c.material))list.push([c.material,false])}
  for(const h of houses()||[])for(const part of h.roofParts||[])part.traverse?.(o=>{if(o.isMesh&&o.material&&!Array.isArray(o.material))list.push([o.material,true])});
  for(const [m,roof] of list){if(materials.has(m)||!m.color||m.userData?.classicKeep)continue;if(!(m.isMeshStandardMaterial||m.isMeshPhysicalMaterial))continue;materials.set(m,{color:m.color.clone(),roughness:m.roughness,roof,applied:-1})}
 }
 const snowWhite=new T.Color(.9,.92,.95);
 function applyMaterials(){const wet=state.wet,snow=state.snow,key=Math.round(wet*40)*100+Math.round(snow*40);
  for(const [m,b] of materials){if(b.applied===key)continue;b.applied=key;m.roughness=b.roughness*(1-.55*wet*(1-snow));m.color.copy(b.color).multiplyScalar(1-.22*wet*(1-snow)).lerp(snowWhite,snow*(b.roof?.55:.3))}}
 function release(){for(const [m,b] of materials){m.roughness=b.roughness;m.color.copy(b.color)}materials.clear()}

 const color=new T.Color(),overcast=new T.Color(),white=new T.Color(1,1,1),flashColor=new T.Color(.82,.86,1);
 function update(elapsed){
  const perf=performance.now(),dt=Math.min(.25,Math.max(0,(perf-lastFrame)/1000));lastFrame=perf;const ms=now();
  if(!!classic()!==classicOn){release();setQuality(preset)}
  if(perf>=nextEval){nextEval=perf+250;evaluate(ms)}
  // Ease toward the target look (faster when going underground or previewing).
  const k=1-Math.exp(-dt/(state.underground?.8:preview?1.2:5));for(const f of LOOK_FIELDS)cur[f]+=(target[f]-cur[f])*k;for(let c=0;c<3;c++)cur.tint[c]+=(target.tint[c]-cur.tint[c])*k;
  state.wet=soak(state.wet,state.underground?state.wet:cur.wet*Math.min(1,cur.rain*2+(cur.fog>.5?.3:0)),dt);state.snow=soak(state.snow,state.underground?state.snow:cur.cover*Math.min(1,cur.snow*1.6),dt,{up:80,down:260});
  // Lightning: one deterministic roll per whole server second.
  const second=Math.floor(ms/1000);if(cur.thunder>.05&&state.stormRegion&&!state.underground){if(second>lastSecond&&second-lastSecond<5)for(let s=lastSecond+1;s<=second;s++)strike(ms,s)}lastSecond=second;
  let flash=0;strikes=strikes.filter(s=>{const t=(ms-s.at)/1000;flash=Math.max(flash,flashLevel(t,s.pulses)*Math.max(.35,1-s.distance/7));return t<1.3});
  if(state.indoors)flash*=.4;if(state.underground)flash=0;state.flash=flash;
  bolt.visible=perf<(bolt.userData.until||0)&&flash>.05;bolt.material.opacity=Math.min(1,flash*1.6);
  // Sky, light and fog relative to the clock's values.
  if(!base)captureSky();if(!fogBase)captureFog();
  const cloud=cur.cloud,dark=cur.dark,day=window.eldervaleDaylight??base.daylight??1;
  const lum=base.fog?(base.fog.r*.3+base.fog.g*.59+base.fog.b*.11):.5;overcast.setRGB(cur.tint[0],cur.tint[1],cur.tint[2],T.SRGBColorSpace).multiplyScalar(Math.min(1.25,(lum*1.2+.04)/Math.max(.2,(cur.tint[0]*.3+cur.tint[1]*.59+cur.tint[2]*.11)))*(1-.35*dark));
  const veil=Math.min(1,cloud*.7+cur.fog*.75+cur.haze*.5);
  color.copy(base.fog).lerp(overcast,veil).lerp(flashColor,flash*.45);scene.fog.color.copy(color);if(scene.background?.isColor)scene.background.copy(color);
  const fog=weatherFog(fogBase.near,fogBase.far,Math.min(1,cur.fog+cur.haze*.1));scene.fog.near=fog.near;scene.fog.far=fog.far;
  sun.intensity=base.sun*(1-.78*cloud)*(1-.3*cur.fog);skyLight.intensity=base.hemi*(1+.18*cloud-.38*dark)+flash*(1.4+2.2*(1-day));
  renderer.toneMappingExposure=base.exposure*(1-.3*dark+.05*cur.haze)+flash*.35;
  const amb=classicAmbient();if(amb&&classicOn)amb.intensity=base.ambient*(1-.3*dark)+flash*1.2;
  const dome=classicDome();if(dome&&base.dome&&classicOn)dome.material.color.copy(white).lerp(overcast.clone().multiplyScalar(1.4),veil*.8).multiplyScalar(1-.25*dark).lerp(white,flash*.6);
  weatherUniforms.weatherCloud.value=cloud;weatherUniforms.weatherOvercast.value=Math.min(1,dark*1.4+cur.fog*.3);weatherUniforms.weatherFlash.value=flash;weatherUniforms.weatherWind.value=cur.wind;
  windAngle=.6+.5*Math.sin(ms/900000);const wx=Math.sin(windAngle),wz=Math.cos(windAngle);shift.x+=wx*(.004+.03*cur.wind)*dt;shift.y+=wz*(.004+.03*cur.wind)*dt;weatherUniforms.weatherCloudShift.value.set(shift.x%100,shift.y%100);
  weatherUniforms.weatherWet.value=tier.wetShading&&!classicOn?state.wet:0;weatherUniforms.weatherSnow.value=classicOn?0:state.snow;
  // Precipitation (hidden indoors and underground).
  const open=!state.indoors&&!state.underground,time=((perf-t0)/1000)%600,light=Math.min(1.4,.28+.72*day+flash*1.2);
  rainUniforms.uTime.value=time;rainUniforms.uCam.value.copy(camera.position);rainUniforms.uWind.value.set(wx,wz).multiplyScalar(cur.wind*4.5);
  const rainAmount=open?cur.rain:0,rn=Math.floor(rainCount*Math.min(1,rainAmount*1.05));rain.visible=rn>8;rain.geometry.setDrawRange(0,rn*6);
  rainUniforms.uOpacity.value=(classicOn?.42:.3)+.25*rainAmount;rainUniforms.uColor.value.setRGB(.72*light,.77*light,.84*light);rainUniforms.uSpeed.value=9+5*rainAmount;
  const flakeAmount=open?Math.max(cur.snow,cur.ash):0,fn=Math.floor(flakeCount*Math.min(1,flakeAmount));flakes.visible=fn>8;flakes.geometry.setDrawRange(0,fn*6);
  const ashShare=cur.ash/Math.max(.001,cur.snow+cur.ash);flakeUniforms.uWind.value.set(wx,wz).multiplyScalar(cur.wind*(1.6-ashShare*.6));flakeUniforms.uSpeed.value=1.15-ashShare*.45;
  flakeUniforms.uColor.value.setRGB(.95-.33*ashShare,.96-.38*ashShare,.98-.44*ashShare).multiplyScalar(Math.min(1.1,.35+.75*day+flash));flakeUniforms.uOpacity.value=.85-.2*ashShare;
  // Ripples on water, small splashes on the ground (medium and up).
  const want=open&&tier.ripples?Math.round(tier.ripples*Math.min(1,rainAmount*1.2)):0;ripples.visible=want>0;
  if(want){rippleUniforms.uTime.value=(perf-t0)/1000;const births=rippleGeometry.attributes.aBirth,m=new T.Matrix4(),now_s=rippleUniforms.uTime.value;let dirty=false;ripples.count=want;
   for(let i=0;i<want;i++){if(now_s-births.array[i]<rippleUniforms.uLife.value||now_s<rippleWait[i])continue;const a=random()*Math.PI*2,r=1.5+Math.sqrt(random())*16,x=player.position.x+Math.cos(a)*r,z=player.position.z+Math.sin(a)*r,water=landscape?.waterAt?.(x,z)>.15;
    if(!water&&random()<.55){rippleWait[i]=now_s+.2+random()*.5;continue}// the ground gets fewer, smaller splashes
    const y=water?.075:(landscape?.walkHeight?.(x,z)??landscape?.heightAt?.(x,z)??0)+.04,size=water?.55+random()*.45:.18+random()*.12;m.makeScale(size,1,size).setPosition(x,y,z);ripples.setMatrixAt(i,m);births.array[i]=now_s+random()*.25;dirty=true}
   if(dirty){ripples.instanceMatrix.needsUpdate=true;births.needsUpdate=true}rippleUniforms.uOpacity.value=.35+.3*rainAmount}
  // Wet roads and snowy roofs (material uniforms only: no shader changes).
  if(tier.materials&&!classicOn){if(perf>=nextCollect){nextCollect=perf+8000;collectMaterials()}if(perf>=nextMaterials){nextMaterials=perf+500;applyMaterials()}}
 }
 setQuality('high');
 return {group,update,setQuality,captureSky,captureFog,release,
  get state(){return {...state,look:{...cur,tint:[...cur.tint]}}},get label(){return state.label},
  get baseFogNear(){return fogBase?.near??scene.fog.near},
  // Owner console preview: {kind,intensity} on this screen only, or null to follow the server.
  preview(p){preview=p&&p.kind?{kind:p.kind,intensity:Math.max(.1,Math.min(1,Number(p.intensity)||.8))}:null;nextEval=0},
  get previewing(){return preview},
  // Jump straight to the current target (previews, screenshots): no easing, ground already wet.
  snap(){strikes=[];evaluate(now());for(const f of LOOK_FIELDS)cur[f]=target[f];cur.tint=[...target.tint];state.wet=cur.wet*Math.min(1,cur.rain*2+(cur.fog>.5?.3:0));state.snow=cur.cover*Math.min(1,cur.snow*1.6);nextMaterials=0},
  // A nearby strike now (console preview): flash, bolt and thunder.
  flashTest(km=1.2){const bearing=Math.atan2(camera.position.x-player.position.x,camera.position.z-player.position.z)+Math.PI+(random()-.5)*.8;strikes.push({at:now(),pulses:2,distance:km});const t=thunderFor(km);try{onThunder({...t,distance:km,bearing,indoors:state.indoors})}catch{}if(!state.indoors)drawBolt(bearing,km)},
  // Area-sound mix input (music.js -> ambience.js).
  audio(){return {rain:state.underground?0:cur.rain,wind:state.underground?0:cur.wind,snow:state.underground?0:cur.snow,ash:state.underground?0:cur.ash,storm:Math.min(1,cur.thunder/3),indoors:state.indoors?1:0,underground:state.underground?1:0}},
  stats(){return {rain:rain.visible?rain.geometry.drawRange.count/6:0,flakes:flakes.visible?flakes.geometry.drawRange.count/6:0,ripples:ripples.visible?ripples.count:0,materials:materials.size}},
  // Compile the weather shaders up front so the first shower does not hitch.
  warm(){const was=[rain.visible,flakes.visible,ripples.visible];rain.visible=flakes.visible=ripples.visible=true;rain.geometry.setDrawRange(0,6);flakes.geometry.setDrawRange(0,6);ripples.count=1;
   const done=()=>{[rain.visible,flakes.visible,ripples.visible]=was};try{const p=renderer.compileAsync?.(group,camera,scene);if(p?.then)return p.then(done,done);renderer.compile?.(group,camera)}catch{}done();return Promise.resolve()}
 };
}
