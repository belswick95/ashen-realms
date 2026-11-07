import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {preloadWeapons} from './weapon-assets.js?v=release-20261107-heading144';
import {tintOutfitMaterial} from './tier-tint.js?v=release-20261107-heading144';
import {accentOutfitShader} from './unique-look.js?v=release-20261107-heading144';
// Loads and caches the Quaternius character assets (assets/characters, CC0).
// Geometry is shared between every character; each character only creates
// its own bones and lightweight SkinnedMesh wrappers.
export const CHARACTER_SCALE=1.58; // Quaternius metres → Eldervale units (head bone ≈ 2.53)
const BASE=new URL('./assets/characters/',import.meta.url);
// One store per page even if this module is loaded under several cache-busting URLs.
const store=globalThis.__eldervaleCharacterStore||(globalThis.__eldervaleCharacterStore={ready:false,manifest:null,rigs:{},heads:{},hair:{},parts:{},pending:new Map(),clips:{},locomotion:{},locomotionInfo:{},mannequinPelvis:null,textures:new Map(),materials:new Map(),T:null,read:null});
export const characterStore=store;
const defaultRead=async url=>{const r=await fetch(url);if(!r.ok)throw Error('Character asset '+url+' '+r.status);return r.arrayBuffer()};
function parse(buffer){return new Promise((resolve,reject)=>new GLTFLoader().parse(buffer,'',resolve,reject))}
// Every character shares these geometries. Mark them shared so the generic
// disposers (ground drops being picked up, world entities and profession props
// being removed) never free the buffers that every body on screen is using.
async function loadGlb(name){const gltf=await parse(await store.read(new URL(name,BASE).href));gltf.scene.traverse(o=>{if(o.geometry)o.geometry.userData.eldervaleShared=true});return gltf}

// Preload everything a character needs to appear immediately: rigs, heads,
// hairstyles, clips and the default (peasant) clothing. Other outfit parts
// stream in the first time someone wears them.
export async function preloadCharacters(T,{read=defaultRead,parts=[]}={}){
 if(store.ready)return store;store.T=T;store.read=read;
 store.manifest=JSON.parse(new TextDecoder().decode(await read(new URL('manifest.json',BASE).href)));
 const jobs=[];
 for(const sex of ['male','female']){jobs.push(loadGlb(store.manifest.bodies[sex].rig).then(g=>store.rigs[sex]=g.scene),loadGlb(store.manifest.bodies[sex].head).then(g=>store.heads[sex]=g.scene))}
 for(const [id,file] of Object.entries(store.manifest.hair))jobs.push(loadGlb(file).then(g=>store.hair[id]=g.scene));
 jobs.push(preloadWeapons(T,{read}));
 // The owner's Adobe Mixamo walk and run, baked per body (scripts/build-mixamo-locomotion.mjs).
 jobs.push(loadGlb('mixamo-locomotion.glb').then(g=>{const info=g.parser?.json?.animations||[];for(const c of g.animations){store.locomotion[c.name]=c;store.locomotionInfo[c.name]=info.find(a=>a.name===c.name)?.extras||{}}}));
 jobs.push(loadGlb('animations.glb').then(g=>{for(const c of g.animations)store.clips[c.name]=c;g.scene.updateMatrixWorld(true);store.mannequinPelvis=g.scene.getObjectByName('pelvis')?.position.clone()}));
 await Promise.all(jobs);
 await Promise.all([...defaultParts('male'),...defaultParts('female'),...parts].map(ensurePart));
 store.ready=true;return store;
}
export function defaultParts(sex){const S=sex==='female'?'Female':'Male';return ['Body','Arms','Legs','Feet'].map(p=>`${S}_Peasant_${p}`)}
export function ensurePart(id){if(store.parts[id])return Promise.resolve(store.parts[id]);if(!store.manifest?.parts[id])return Promise.reject(Error('Unknown outfit part '+id));if(!store.pending.has(id))store.pending.set(id,loadGlb(store.manifest.parts[id]).then(g=>store.parts[id]=g.scene));return store.pending.get(id)}

// Clips are shared per body: only the pelvis translation is re-scaled to the
// body's own hip height, everything else is rotation-only. The Mixamo walk and
// run are already retargeted to each body (Mixamo_Walk_male -> Mixamo_Walk).
export function clipsFor(sex){
 const key='clips:'+sex;if(store[key])return store[key];
 const pelvis=store.rigs[sex].getObjectByName('pelvis').position,man=store.mannequinPelvis||pelvis,out={};
 for(const [name,clip] of Object.entries(store.clips)){const c=clip.clone();for(const t of c.tracks)if(t.name==='pelvis.position'){const v=t.values;for(let i=0;i<v.length;i+=3){v[i]=pelvis.x+(v[i]-man.x)*(pelvis.z/man.z);v[i+1]=pelvis.y+(v[i+1]-man.y)*(pelvis.z/man.z);v[i+2]=pelvis.z+(v[i+2]-man.z)*(pelvis.z/man.z)}}out[name]=c}
 for(const [name,clip] of Object.entries(store.locomotion)){const m=name.match(/^(.*)_(male|female)$/);if(m&&m[2]===sex){const c=clip.clone();c.name=m[1];out[m[1]]=c}}
 return store[key]=out;
}
// Natural ground speed of a baked locomotion loop on a body, in world units per
// second at playback rate 1 (the planted foot's backward speed, measured at bake time).
export function locomotionSpeed(sex,gait){return (store.locomotionInfo[`${gait}_${sex==='female'?'female':'male'}`]?.groundSpeed||0)*CHARACTER_SCALE}

// Textures load in the browser only; Node checks still get valid materials.
function texture(name,{color=false}={}){
 const T=store.T;if(typeof document==='undefined'||!store.manifest.textures[name])return null;
 if(!store.textures.has(name)){store.loading=(store.loading||0)+1;const settle=()=>{if(--store.loading===0)for(const fn of (store.textureWaiters||[]).splice(0))fn()};const t=new T.TextureLoader().load(new URL(store.manifest.textures[name],BASE).href,settle,undefined,settle);t.flipY=false;if(color)t.colorSpace=T.SRGBColorSpace;t.userData.eldervaleShared=true;store.textures.set(name,t)}
 return store.textures.get(name);
}
// Resolves once every character texture requested so far has loaded (or failed),
// for one-off renders such as the HUD portrait.
export function texturesSettled(){return store.loading?new Promise(r=>(store.textureWaiters||(store.textureWaiters=[])).push(r)):Promise.resolve()}
// Soft rim light on every character material so people read against grass and
// cobbles; a few ALU ops on character pixels only. Tuned by setCharacterRim().
const rim={rimColor:{value:null},rimStrength:{value:.1}};
function rimLight(m){const T=store.T;if(!T||!m.isMeshStandardMaterial)return;rim.rimColor.value??=new T.Color(0xfff1dc);const before=m.onBeforeCompile;
 m.onBeforeCompile=(shader,r)=>{before?.call(m,shader,r);Object.assign(shader.uniforms,rim);shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 rimColor;uniform float rimStrength;').replace('#include <opaque_fragment>','{float rimF=1.0-saturate(dot(normal,normalize(vViewPosition)));outgoingLight+=rimColor*rimF*rimF*rimF*rimStrength;}\n#include <opaque_fragment>')};
 const programKey=m.userData.programKey||'';m.customProgramCacheKey=()=>'eldervale-rim'+programKey}
// Day: faint warm sky rim. Night: a stronger cool moon rim keeps silhouettes legible.
export function setCharacterRim(daylight){const T=store.T;if(!T)return;const d=Math.max(0,Math.min(1,daylight));rim.rimColor.value??=new T.Color();rim.rimColor.value.set(0x9db4e6).lerp(new T.Color(0xfff1dc),d);rim.rimStrength.value=.2-.1*d}
export function material(key,make){if(!store.materials.has(key)){const m=make();m.userData.eldervaleShared=true;rimLight(m);store.materials.set(key,m)}return store.materials.get(key)}
// Outfit material: one per outfit colour, shared by every wearer.
// A gear tier tint (gear-tiers.js) recolours only the metal of the iron texture.
export function outfitMaterial(outfit,variant=1,tint=null,look=null){
 const T=store.T,o=outfit.toLowerCase();
 if(tint!=null&&look&&(look.accent!=null||look.mode==='all'))return material(`outfit:${o}:${variant}:${tint}:${look.mode||'metal'}:${look.accent??''}`,()=>tintOutfitMaterial(T,outfitMaterial(outfit,variant),tint,{accent:look.accent,mode:look.mode,accentShader:accentOutfitShader}));
 if(tint!=null)return material(`outfit:${o}:${variant}:${tint}`,()=>tintOutfitMaterial(T,outfitMaterial(outfit,variant),tint));
 return material(`outfit:${o}:${variant}`,()=>{const orm=texture(o+'_orm');return new T.MeshStandardMaterial({map:texture(`${o}_${variant}_color`,{color:true}),normalMap:texture(o+'_normal'),aoMap:orm,roughnessMap:orm,metalnessMap:orm,metalness:orm?1:.1,roughness:1})});
}
// Skin and hair are tinted from neutral base textures.
export function skinMaterial(kind,sex,tint){
 const T=store.T;return material(`skin:${kind}:${sex}:${tint}`,()=>{const base=kind==='head'?'head_':'body_';return new T.MeshStandardMaterial({map:texture(base+sex+'_color',{color:true}),normalMap:texture(base+sex+'_normal'),roughnessMap:texture(base+sex+'_roughness'),roughness:1,metalness:0,color:new T.Color(tint)})});
}
export function hairMaterial(set,tint){const T=store.T;return material(`hair:${set}:${tint}`,()=>new T.MeshStandardMaterial({map:texture(`hair_${set}_color`,{color:true}),normalMap:texture(`hair_${set}_normal`),roughness:.75,metalness:0,color:new T.Color(tint),alphaTest:.35,side:T.DoubleSide}))}
export function eyeMaterial(){const T=store.T;return material('eyes',()=>new T.MeshStandardMaterial({map:texture('eye_color',{color:true}),roughness:.25,metalness:0}))}
