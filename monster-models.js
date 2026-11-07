import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {clone as cloneSkinned} from 'three/addons/utils/SkeletonUtils.js';
import {sharedGeometry,sharedMaterial} from './shared-geometry.js?v=release-20261107-attacks134';
// Rigged, animated monster models that replace the old procedural bodies of some species
// (sources and licences: assets/monsters/CREDITS.md; build: scripts/build-monster-models.mjs).
// Graphics only: species ids, names, stats, spawns and behaviour are untouched. Each model is
// loaded once per species on first sight; until it arrives (and in Node tests, or when the owner
// switches the species back to its "classic model") the procedural body is shown instead.
// Every instance shares the GLB's geometry, textures and (per tint) materials and only owns its
// bones, so a species costs one draw call per mesh in the file.
//
// size: the species' gameplay size in Eldervale units before the entity's own scale —
//   'height' (feet to crown) or 'length' (nose to tail), matching the old procedural bodies.
// yaw: turns the model to face +Z like every actor. lift: hover height for fliers.
// stride: units covered by one loop of the walk clip at size 1 (sets the walk playback rate).
// attack: seconds the attack clip is played over (the game's wind-up is 0.55 s).
export const MONSTER_MODELS={
 wolf:{file:'wolf.glb',size:{length:2.4},yaw:-Math.PI/2,stride:2.4,lunge:.5,tint:0x7d8589,tintAll:true},
 bat:{file:'bat.glb',size:{length:1.4},yaw:0,lift:.75,attack:.7,fly:true,mouth:[1.15,.4]},
 spider:{file:'spider.glb',size:{length:2.1},yaw:Math.PI,stride:1.6,lunge:.35,mouth:[.3,.95]},
 rat:{file:'rat.glb',size:{length:2.5},yaw:0,stride:1.2,attack:.65},
 boar:{file:'boar.glb',size:{length:2.35},yaw:Math.PI,stride:2.2,attack:.7},
 golem:{file:'golem.glb',size:{height:2.3},yaw:Math.PI,stride:2.6,attack:1.1},
 troll:{file:'troll.glb',size:{height:2.3},yaw:0,stride:2.6,attack:.95},
 // The lava golem serves the ash demon and, smaller and tinted, the imps.
 demon:{file:'demon.glb',size:{height:2.5},yaw:0,stride:2.4,attack:1},
 imp:{file:'imp.glb',size:{height:1.9},yaw:0,stride:1.8,attack:.8,mouth:[1.35,.55],recolor:0x721923},
 ogre:{file:'ogre.glb',size:{height:2.3},yaw:0,stride:2.2,attack:1,recolor:0x738636},
 revenant:{file:'revenant.glb',size:{height:2.2},yaw:0,stride:2,attack:.9,mouth:[1.4,.6],recolor:0x2a1030,fly:true,lift:.25,opacity:.88,tint:0x46566b},
 wraith:{file:'wraith.glb',size:{height:2},yaw:0,lift:.25,attack:.9,fly:true,mouth:[1.3,.6],recolor:0x2a1030,opacity:.88},
};
const BASE=new URL('./assets/monsters/',import.meta.url);
const CLASSIC_KEY='eldervale-classic-monsters';
// Per page, even if this module loads under several cache-busting URLs.
const store=globalThis.__eldervaleMonsterModels||(globalThis.__eldervaleMonsterModels={assets:new Map(),pending:new Map(),classic:null,version:0,materials:new Map()});
function readClassic(){if(store.classic)return store.classic;let list=[];try{list=JSON.parse(globalThis.localStorage?.getItem(CLASSIC_KEY)||'[]')}catch{}store.classic=new Set(Array.isArray(list)?list.filter(s=>MONSTER_MODELS[s]):[]);return store.classic}
// Owner console: show a species with its classic procedural model instead of the rigged one.
export function classicMonsterSpecies(){return [...readClassic()]}
export function setClassicMonsterModel(species,on){if(!MONSTER_MODELS[species])return false;const set=readClassic();if(on)set.add(species);else set.delete(species);try{globalThis.localStorage?.setItem(CLASSIC_KEY,JSON.stringify([...set]))}catch{}store.version++;return true}
export function setClassicMonsterModels(on){for(const s of Object.keys(MONSTER_MODELS))setClassicMonsterModel(s,on)}
export const hasRiggedModel=species=>!!MONSTER_MODELS[species];
const canLoad=()=>typeof document!=='undefined'&&typeof fetch==='function';

// One load per species. The asset keeps the source scene, its clips and the fitted transform.
function loadAsset(T,species){
 if(store.assets.has(species))return store.assets.get(species);if(store.pending.has(species))return null;
 const cfg=MONSTER_MODELS[species];
 // One parse per file, shared by every species that uses it.
 const files=store.files||(store.files=new Map());if(!files.has(cfg.file))files.set(cfg.file,new GLTFLoader().loadAsync(new URL(cfg.file,BASE).href).then(gltf=>{gltf.scene.traverse(o=>{if(o.geometry)o.geometry.userData.eldervaleShared=true;if(o.material){o.material.userData.eldervaleShared=true;for(const v of Object.values(o.material))if(v?.isTexture)v.userData.eldervaleShared=true}});return gltf}));
 store.pending.set(species,files.get(cfg.file).then(gltf=>{
  const scene=gltf.scene,clips={};for(const c of gltf.animations)clips[c.name]=c;
  if(cfg.tintAll)scene.traverse(o=>{if(o.material)o.material.userData.tintAll=true});
  // Fit: pose the first idle frame, measure, then scale to the species size with feet on y=0.
  const probe=cloneSkinned(scene),mixer=new T.AnimationMixer(probe);if(clips.idle)mixer.clipAction(clips.idle).play();mixer.update(0);
  const holder=new T.Group();holder.rotation.y=cfg.yaw||0;holder.add(probe);holder.updateMatrixWorld(true);
  const box=new T.Box3().setFromObject(holder,true),size=box.getSize(new T.Vector3());
  const scale=cfg.size.height?cfg.size.height/size.y:cfg.size.length/Math.max(size.z,size.x);
  const asset={T,scene,clips,scale,offset:new T.Vector3(-(box.min.x+box.max.x)/2*scale,-box.min.y*scale+(cfg.lift||0),-(box.min.z+box.max.z)/2*scale),radius:size.length()*scale*.75};
  store.assets.set(species,asset);store.pending.delete(species);store.version++;return asset;
 }).catch(e=>{console.warn('Monster model',species,e);store.pending.delete(species);store.assets.set(species,null)}));
 return null;
}
// Warm every rigged species up front (the offline harness and the owner preview use this).
export async function preloadMonsterModels(T){if(!canLoad())return;for(const s of Object.keys(MONSTER_MODELS))loadAsset(T,s);await Promise.all([...store.pending.values()])}

// A roster tint recolours the model the way the procedural bodies were recoloured: untextured
// parts take the tint's hue keeping their own lightness; textured parts are multiplied by a
// brightened tint. Models painted from a flat colour atlas (`recolor`: the atlas colour of the
// body) are instead recoloured in the shader: texels of the body's hue take the tint, while
// hair, weapons, bone, eyes and teeth keep their own colours. One material per (source material, tint), shared by every instance.
function tintedMaterial(T,material,tint,cfg={}){
 if(!Number.isFinite(tint)&&!cfg.opacity)return material;const key=material.uuid+':'+tint;let m=store.materials.get(key);if(m)return m;
 m=material.clone();m.userData.eldervaleShared=true;const t={h:0,s:0,l:0};new T.Color(tint).getHSL(t);
 if(cfg.opacity){m.transparent=true;m.opacity=cfg.opacity}
 if(!Number.isFinite(tint));else if(material.map&&Number.isFinite(cfg.recolor))recolorMaterial(m,cfg.recolor,tint);
 else if(material.map){const c=new T.Color(tint),peak=Math.max(c.r,c.g,c.b,1e-3);c.multiplyScalar(1/peak);m.color.setRGB(1,1,1).lerp(c,.7).multiplyScalar(Math.max(.4,Math.min(1.1,.45+t.l)));if(material.emissiveMap)m.emissive.copy(c)}
 else{const own={h:0,s:0,l:0};material.color.getHSL(own);if(own.l>=.75&&material.userData.tintAll)m.color.set(tint);else if(own.l<.75)m.color.setHSL(t.h,Math.min(1,t.s*.85+own.s*.15),Math.max(.04,Math.min(.92,own.l*(.35+t.l*1.3))))}
 store.materials.set(key,m);return m;
}

const hsv=hex=>{const r=(hex>>16&255)/255,g=(hex>>8&255)/255,b=(hex&255)/255,max=Math.max(r,g,b),d=max-Math.min(r,g,b);const h=d?(max===r?((g-b)/d+6)%6:max===g?(b-r)/d+2:(r-g)/d+4)/6:0;return {h,s:max?d/max:0,v:max}};
// Hue shift, saturation and value scale (in sRGB, like the swatches) from the body colour to the tint.
function recolorMaterial(m,base,tint){
 const b=hsv(base),t=hsv(tint),value=[t.h-b.h,Math.min(1.3,t.s/Math.max(b.s,.05)),Math.max(.4,Math.min(4,t.v/Math.max(b.v,.02)))];
 m.customProgramCacheKey=()=>'eldervale-recolor';
 m.onBeforeCompile=sh=>{sh.uniforms.recolor={value};sh.uniforms.recolorHue={value:b.h};
  sh.fragmentShader=sh.fragmentShader.replace('#include <common>',`#include <common>
uniform vec3 recolor;uniform float recolorHue;
vec3 rgb2hsv(vec3 c){vec4 K=vec4(0.,-1./3.,2./3.,-1.);vec4 p=mix(vec4(c.bg,K.wz),vec4(c.gb,K.xy),step(c.b,c.g));vec4 q=mix(vec4(p.xyw,c.r),vec4(c.r,p.yzx),step(p.x,c.r));float d=q.x-min(q.w,q.y);return vec3(abs(q.z+(q.w-q.y)/(6.*d+1e-10)),d/(q.x+1e-10),q.x);}
vec3 hsv2rgb(vec3 c){vec3 p=abs(fract(c.xxx+vec3(1.,2./3.,1./3.))*6.-3.);return c.z*mix(vec3(1.),clamp(p-1.,0.,1.),c.y);}`).replace('#include <map_fragment>',`#include <map_fragment>
{vec3 srgb=pow(max(diffuseColor.rgb,vec3(0.)),vec3(1./2.2));vec3 c=rgb2hsv(srgb);float dh=abs(c.x-recolorHue);dh=min(dh,1.-dh);float w=smoothstep(.34,.44,c.y)*(1.-smoothstep(.11,.13,dh));
 vec3 shifted=hsv2rgb(vec3(fract(c.x+recolor.x),clamp(c.y*recolor.y,0.,1.),clamp(c.z*recolor.z,0.,1.)));
 diffuseColor.rgb=pow(mix(srgb,shifted,w),vec3(2.2));}`)};
}

// The rigged body for one actor; returns null when the species should stay classic.
function riggedBody(T,group,d,asset){
 const cfg=MONSTER_MODELS[d.species],body=cloneSkinned(asset.scene),pivot=new T.Group();
 pivot.rotation.y=cfg.yaw||0;pivot.add(body);const fit=new T.Group();fit.scale.setScalar(asset.scale);fit.position.copy(asset.offset);fit.add(pivot);group.add(fit);
 body.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=false;o.material=tintedMaterial(T,o.material,Number.isFinite(d.tint)?d.tint:cfg.tint,cfg);
  // Bounds from the bind pose plus margin for the clips (once per instance, no per-frame work).
  if(o.isSkinnedMesh){o.computeBoundingSphere?.();if(o.boundingSphere)o.boundingSphere.radius*=1.6}});
 const mixer=new T.AnimationMixer(body),act={};for(const [name,clip] of Object.entries(asset.clips))act[name]=mixer.clipAction(clip);
 for(const k of ['attack','hit','death'])if(act[k]){act[k].setLoop(T.LoopOnce,1);act[k].clampWhenFinished=true}
 const walkDuration=asset.clips.walk?.duration||1,attackScale=act.attack?asset.clips.attack.duration/(cfg.attack||.8):1;
 let base=act.idle||null,oneShot=null,lastAttack=0,lastHit=0,dead=false,tick=0;base?.play();
 const effect=attackEffect(T,fit,d,asset);
 const to=(next,fade=.2)=>{if(next===base)return;next?.reset().setEffectiveWeight(1).fadeIn(fade).play();base?.fadeOut(fade);base=next};
 const shot=(a,scale=1,fade=.08)=>{if(!a)return false;if(oneShot&&oneShot!==a)oneShot.fadeOut(fade);a.reset().setEffectiveTimeScale(scale).setEffectiveWeight(1).fadeIn(fade).play();oneShot=a;return true};
 return {fit,update(dt,m){tick+=dt;
   if(m.dead){if(!dead){dead=true;if(act.death){if(oneShot&&oneShot!==act.death)oneShot.fadeOut(.1);base?.fadeOut(.15);act.death.reset().fadeIn(.1).play();oneShot=act.death}}mixer.update(dt);return}
   if(dead){dead=false;act.death?.stop();oneShot=null;base?.reset().fadeIn(.1).play()}
   const attack=m.attack||0,hit=m.hit||0;
   if(attack>lastAttack+.05)shot(act.attack,attackScale)||(oneShot=null);
   if(hit>lastHit+.05&&!(attack>0&&act.attack))shot(act.hit,1.25);
   lastAttack=attack;lastHit=hit;
   if(oneShot&&!oneShot.isRunning()){oneShot.fadeOut(.15);oneShot=null}
   const moving=(m.distance||0)>1e-4;
   if(moving&&act.walk){const speed=m.speed||(m.distance/Math.max(dt,1e-3)),rate=Math.max(.5,Math.min(2.4,speed*walkDuration/((cfg.stride||2)*(d.scale||1))));to(act.walk);act.walk.setEffectiveTimeScale(rate)}
   else if(!moving)to(act.idle||null,.25);
   mixer.update(dt);
   // Species without an attack clip lunge with the whole body; without a hit clip they flinch.
   const a=attack>0?Math.sin(Math.PI*Math.max(0,Math.min(1,1-attack/.55))):0,h=hit>0&&!act.hit?Math.sin(Math.PI*Math.max(0,Math.min(1,1-hit/.3))):0;
   if(!act.attack){pivot.position.z=a*(cfg.lunge||.4)/asset.scale;pivot.rotation.x=-a*.18}
   pivot.rotation.z=h*.12;fit.position.y=asset.offset.y+(cfg.fly?Math.sin(tick*3)*.1:0);
   effect?.update(a);
 },dispose(){mixer.stopAllAction();mixer.uncacheRoot(body);effect?.dispose();fit.removeFromParent()}};
}
// Breath / spell burst in front of the mouth for magical attack types (fire bats, venom spiders).
function attackEffect(T,fit,d,asset){
 if(!['fire','magic','venom'].includes(d.attackType))return null;
 const color=Number.isFinite(d.breath)?d.breath:d.attackType==='fire'?0xff7a33:d.attackType==='venom'?0x8fd45a:0x8cb9ed;
 const g=new T.Group(),mat=sharedMaterial(T,'monster-burst:'+color,()=>new T.MeshBasicMaterial({color,transparent:true,opacity:.75,depthWrite:false}));
 for(let i=0;i<4;i++){const s=new T.Mesh(sharedGeometry(T,'icosahedron',1,1),mat);s.position.z=i*.2;s.scale.setScalar(.05+i*.035);g.add(s)}
 const cfg=MONSTER_MODELS[d.species];g.position.set(0,cfg.mouth?.[0]??.6,cfg.mouth?.[1]??.6);g.visible=false;fit.parent.add(g);
 return {update(a){g.visible=a>.25;g.scale.setScalar(.6+a*.7)},dispose(){g.removeFromParent()}};
}

// actorModel() entry for species with a rigged model: a stable group (the game topples
// `root.children[0]` on death when the model has no death clip) holding the classic body until
// the GLB is ready, then the rigged body. `classic` builds the procedural model into a parent.
export function riggedActorModel(T,parent,d,classic){
 const group=new T.Group();group.name='monster-'+d.species;parent.add(group);
 let current=null,kind='',seen=-1;
 const want=()=>!readClassic().has(d.species)&&canLoad()?loadAsset(T,d.species):null;
 function build(){const asset=want(),next=asset?'rigged':'classic';seen=store.version;if(next===kind&&current)return;current?.dispose?.();
  current=asset?riggedBody(T,group,d,asset):classic(group);kind=next;group.rotation.z=0;group.position.y=0}
 build();
 return {get ownDeath(){return kind==='rigged'&&!!store.assets.get(d.species)?.clips.death},get rigged(){return kind==='rigged'},
  update(dt,m){if(seen!==store.version)build();current?.update?.(dt,m)},
  dispose(){current?.dispose?.();group.removeFromParent()}};
}
