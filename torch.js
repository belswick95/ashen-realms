import {sharedGeometry,sharedCustomGeometry,sharedMaterial} from './shared-geometry.js?v=release-20261107-canopy152';
import {lightingAt} from './world-lighting.js?v=release-20261107-canopy152';
// The torch: an off-hand item (shields.js, slot "shield") that burns while held.
// Original procedural model in the held-item frame (humanoid.js sockets): the
// fist grips the handle at the origin, the handle runs along +Y. The shield
// mount (equipment-pose.js attachShield) sits 4 cm toward the back of the hand
// for a shield board, so the model itself steps back by that much and the
// handle passes through the fist; the mount is unchanged.
export const TORCH_MOUNT_OFFSET=.04;
// Flame centre above the grip (held frame); the light and glow sit here.
export const TORCH_FLAME_Y=.56;
// Light: warm, about 11 tiles of range (1.58 m tiles), soft falloff.
// Outdoors the night sky fill is much brighter than a cave's, so the open-air night peak is higher.
export const TORCH_LIGHT={color:0xff9a4a,distance:17,decay:1.5,day:.9,night:28,cave:16};
// Real point lights: the local player's torch plus the nearest others.
export const TORCH_LIGHT_COUNT=3;

// Rendered torches report themselves each frame (flame onBeforeRender), so the
// light pool only considers torches that are actually drawn in the scene.
const seen=new Map();
const clock=()=>typeof performance!=='undefined'?performance.now():Date.now();
export function liveTorches(scene,now=clock(),within=400){const out=[];for(const [torch,s] of seen){if(now-s.at>within){if(now-s.at>5000)seen.delete(torch);continue}if(!scene||s.scene===scene)out.push(torch)}return out}

// Darkness 0 (noon) .. 1 (night or below ground): the day/night lantern factor
// (world-lighting.js), full darkness in caves, crypts and mines.
export function torchDarkness(daylight,underground=false){if(underground)return 1;const d=lightingAt(daylight).lantern;return Math.max(0,Math.min(1,d))}
export function torchIntensity(darkness,underground=false){const k=Math.max(0,Math.min(1,Number(darkness)||0)),e=k*k*(3-2*k);return TORCH_LIGHT.day+((underground?TORCH_LIGHT.cave:TORCH_LIGHT.night)-TORCH_LIGHT.day)*e}
// Flame flicker 0.82..1.12: a few incommensurate waves, so it never visibly repeats.
export function torchFlicker(t,phase=0){return .97+.07*Math.sin(t*11.3+phase)+.05*Math.sin(t*23.9+phase*1.7)+.03*Math.sin(t*41.7+phase*.6)}

// Glow sprite texture: a soft radial gradient (browser only).
const glowMaps=new WeakMap();
function glowTexture(T){if(glowMaps.has(T))return glowMaps.get(T);let map=null;if(typeof document!=='undefined'){const c=document.createElement('canvas');c.width=c.height=64;const g=c.getContext?.('2d');if(g){const r=g.createRadialGradient(32,32,0,32,32,32);r.addColorStop(0,'rgba(255,214,140,1)');r.addColorStop(.25,'rgba(255,150,60,.55)');r.addColorStop(.6,'rgba(255,110,30,.14)');r.addColorStop(1,'rgba(255,90,20,0)');g.fillStyle=r;g.fillRect(0,0,64,64);map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace}}glowMaps.set(T,map);return map}
// Shared materials: the glow's opacity follows the darkness (createTorchLights).
export function torchGlowMaterial(T){return sharedMaterial(T,'torch:glow',()=>new T.SpriteMaterial({map:glowTexture(T),color:0xffb060,transparent:true,opacity:.35,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}))}
const flameMaterial=(T,key,color,opacity)=>sharedMaterial(T,'torch:'+key,()=>new T.MeshBasicMaterial({color,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));
// Teardrop flame profile (radius, height) revolved around +Y.
const FLAME_PROFILE=[[0,0],[.042,.025],[.05,.07],[.04,.13],[.024,.2],[.008,.26],[0,.29]];
const flameGeometry=T=>sharedCustomGeometry(T,'torch:flame',()=>new T.LatheGeometry(FLAME_PROFILE.map(([r,y])=>new T.Vector2(r,y)),10));
const EMBERS=6;

export function makeTorch(T,{lit=true,pooled=true}={}){
 const group=new T.Group();group.name='torch';group.userData.torch=true;
 const body=new T.Group();body.name='torch-body';body.position.z=-TORCH_MOUNT_OFFSET;group.add(body);
 const add=(geo,mat,y,name)=>{const m=new T.Mesh(geo,mat);m.position.y=y;m.name=name;m.castShadow=true;body.add(m);return m};
 const wood=sharedMaterial(T,'torch:wood',()=>new T.MeshStandardMaterial({color:0xa27850,roughness:.8,metalness:0,emissive:0x1c0f06}));
 const wrap=sharedMaterial(T,'torch:wrap',()=>new T.MeshStandardMaterial({color:0x3b2c20,roughness:.95,metalness:0}));
 const cord=sharedMaterial(T,'torch:cord',()=>new T.MeshStandardMaterial({color:0x9a7a4c,roughness:.9,metalness:0}));
 const char=sharedMaterial(T,'torch:char',()=>new T.MeshStandardMaterial({color:0x1b1410,roughness:1,metalness:0,emissive:0x5a1c06,emissiveIntensity:.8}));
 // Handle: tapered staff from below the fist up into the head.
 add(sharedGeometry(T,'cylinder',.021,.026,.52,8),wood,.11,'torch-handle');
 add(sharedGeometry(T,'sphere',.028,8,6),wood,-.15,'torch-pommel');
 // Head: pitch-soaked cloth wrapped round the top, tied with two cords, charred crown.
 add(sharedGeometry(T,'cylinder',.044,.036,.13,10),wrap,.42,'torch-wrap');
 for(const y of [.38,.45]){const band=add(sharedGeometry(T,'torus',.043,.007,5,12),cord,y,'torch-cord');band.rotation.x=Math.PI/2}
 add(sharedGeometry(T,'cylinder',.036,.044,.035,10),char,.5,'torch-crown');
 if(!lit)return group;
 const flame=makeFlame(T,{owner:pooled?group:null});flame.position.y=.505;body.add(flame);
 group.userData.flame=flame;group.userData.extinguish=()=>{flame.visible=false};
 return group;
}
// The burning head on its own: two additive teardrops (outer orange, inner yellow core), a glow
// sprite and rising embers, animated while drawn. `owner` (a held torch) reports itself to the
// torch light pool while drawn; scenery flames (cave torches and braziers, underground-models.js)
// pass none, since their light already comes from the cave's own light anchors.
export function makeFlame(T,{owner=null}={}){
 const flame=new T.Group();flame.name='torch-flame';flame.userData.torchFlame=true;
 const outer=new T.Mesh(flameGeometry(T),flameMaterial(T,'flame-outer',0xff6a14,.85));outer.name='torch-flame-outer';outer.renderOrder=2;outer.frustumCulled=false;
 const inner=new T.Mesh(flameGeometry(T),flameMaterial(T,'flame-inner',0xffd774,.95));inner.name='torch-flame-inner';inner.scale.set(.55,.62,.55);inner.position.y=.005;inner.renderOrder=3;
 const glow=new T.Sprite(torchGlowMaterial(T));glow.name='torch-glow';glow.position.y=TORCH_FLAME_Y-.505;glow.scale.setScalar(.75);glow.renderOrder=1;
 const positions=new Float32Array(EMBERS*3),colors=new Float32Array(EMBERS*3),emberGeo=new T.BufferGeometry();
 emberGeo.setAttribute('position',new T.BufferAttribute(positions,3));emberGeo.setAttribute('color',new T.BufferAttribute(colors,3));emberGeo.boundingSphere=new T.Sphere(new T.Vector3(0,.25,0),.4);
 const embers=new T.Points(emberGeo,sharedMaterial(T,'torch:embers',()=>new T.PointsMaterial({size:.03,vertexColors:true,transparent:true,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false})));embers.name='torch-embers';embers.frustumCulled=false;
 flame.add(glow,outer,inner,embers);
 const phase=Math.random()*100,seeds=Array.from({length:EMBERS},(_,i)=>({o:i/EMBERS+Math.random()*.1,s:.55+Math.random()*.5,a:Math.random()*6.28,r:.02+Math.random()*.035}));
 let last=-1;
 function animate(scene){const now=clock(),t=now/1000+phase;if(owner)seen.set(owner,{at:now,scene});if(now===last)return;last=now;
  const f=torchFlicker(t,phase),sway=Math.sin(t*3.1)*.08+Math.sin(t*7.3)*.04;
  outer.scale.set(.92+.1*Math.sin(t*9.1),f,.92+.1*Math.cos(t*8.3));outer.rotation.set(sway*.6,t*1.7%6.283,sway);
  inner.scale.set(.55,.62*(.9+.15*Math.sin(t*17.3+1)),.55);inner.rotation.set(sway*.4,0,sway*.8);
  glow.scale.setScalar(.7+.08*f);
  for(let i=0;i<EMBERS;i++){const e=seeds[i],u=((t*e.s+e.o)%1+1)%1,k=i*3;
   positions[k]=Math.sin(e.a+t*2.3+u*4)*e.r*(.4+u);positions[k+1]=.12+u*.5;positions[k+2]=Math.cos(e.a+t*1.9+u*3)*e.r*(.4+u);
   const heat=(1-u)*(u<.08?u/.08:1);colors[k]=heat;colors[k+1]=heat*.55;colors[k+2]=heat*.15}
  emberGeo.attributes.position.needsUpdate=true;emberGeo.attributes.color.needsUpdate=true;
  // Changes apply now (the renderer already composed this frame's matrices).
  for(const m of [outer,inner,glow]){m.updateMatrix();m.matrixWorld.multiplyMatrices(flame.matrixWorld,m.matrix)}}
 outer.onBeforeRender=(renderer,scene)=>animate(scene);
 return flame;
}
// A torch in its world position: the flame centre (for lights and sounds).
export function torchFlamePosition(torch,out){const flame=torch.userData.flame;if(flame){out.set(0,TORCH_FLAME_Y-.505,0);return flame.localToWorld(out)}return torch.getWorldPosition(out)}

// Fixed pool of warm point lights for torches. The pool never grows or shrinks
// (three.js recompiles every lit shader when the light count changes): unused
// lights stay in the scene at intensity 0. The local player's torch always gets
// a light; the nearest other drawn torches share the rest. Every torch also has
// a cheap additive glow sprite whose brightness follows the darkness.
export function createTorchLights(T,scene,{count=TORCH_LIGHT_COUNT}={}){
 const lights=Array.from({length:count},(_,i)=>{const l=new T.PointLight(TORCH_LIGHT.color,0,TORCH_LIGHT.distance,TORCH_LIGHT.decay);l.name='torch-light-'+i;l.castShadow=false;scene.add(l);return l});
 const glow=torchGlowMaterial(T),scratch=new T.Vector3(),levels=lights.map(()=>0);let budget=count,assigned=[];
 // Lights beyond the budget are hidden (only changed with the graphics preset, like the lantern pool).
 function setBudget(n){budget=Math.max(1,Math.min(count,Math.floor(n)||1));lights.forEach((l,i)=>l.visible=i<budget)}
 function update({local=null,focus=null,darkness=0,underground=false,dt=1/60,now=clock()}={}){
  const base=torchIntensity(darkness,underground),t=now/1000,k=1-Math.exp(-Math.max(0,dt)*8);
  glow.opacity=.16+.5*Math.max(0,Math.min(1,darkness));
  const localOn=!!(local&&local.visible&&attachedTo(local,scene)&&visibleChain(local));
  let others=liveTorches(scene,now).filter(t=>t!==local&&visibleChain(t)).map(torch=>({torch,d:focus?torchFlamePosition(torch,scratch).distanceTo(focus):0}));
  others.sort((a,b)=>a.d-b.d);others=others.filter(o=>o.d<TORCH_LIGHT.distance*3);
  assigned=[localOn?local:null,...others.slice(0,budget-(localOn?1:0)).map(o=>o.torch)].filter(Boolean);
  lights.forEach((light,i)=>{const torch=i<budget?assigned[i]:null;
   const want=torch?base*torchFlicker(t,i*7.1)*(torch===local?1:.85):0;levels[i]=torch?want:levels[i]+(0-levels[i])*k;if(levels[i]<.01)levels[i]=0;light.intensity=levels[i];
   if(torch){torchFlamePosition(torch,light.position);light.position.x+=Math.sin(t*13.7+i)*.02;light.position.z+=Math.cos(t*11.9+i)*.02;light.position.y+=.05}});
  return assigned.length}
 return {lights,update,setBudget,get assigned(){return assigned},dispose(){for(const l of lights)l.removeFromParent()}};
}
function attachedTo(o,scene){while(o){if(o===scene)return true;o=o.parent}return false}
function visibleChain(o){while(o){if(!o.visible)return false;o=o.parent}return true}
