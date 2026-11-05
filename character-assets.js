import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {preloadWeapons} from './weapon-assets.js?v=release-20261105-characters55';
// Loads and caches the Quaternius character assets (assets/characters, CC0).
// Geometry is shared between every character; each character only creates
// its own bones and lightweight SkinnedMesh wrappers.
export const CHARACTER_SCALE=1.58; // Quaternius metres → Eldervale units (head bone ≈ 2.53)
const BASE=new URL('./assets/characters/',import.meta.url);
// One store per page even if this module is loaded under several cache-busting URLs.
const store=globalThis.__eldervaleCharacterStore||(globalThis.__eldervaleCharacterStore={ready:false,manifest:null,rigs:{},heads:{},hair:{},parts:{},pending:new Map(),clips:{},mannequinPelvis:null,textures:new Map(),materials:new Map(),T:null,read:null});
export const characterStore=store;
const defaultRead=async url=>{const r=await fetch(url);if(!r.ok)throw Error('Character asset '+url+' '+r.status);return r.arrayBuffer()};
function parse(buffer){return new Promise((resolve,reject)=>new GLTFLoader().parse(buffer,'',resolve,reject))}
async function loadGlb(name){return parse(await store.read(new URL(name,BASE).href))}

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
 jobs.push(loadGlb('animations.glb').then(g=>{for(const c of g.animations)store.clips[c.name]=c;g.scene.updateMatrixWorld(true);store.mannequinPelvis=g.scene.getObjectByName('pelvis')?.position.clone()}));
 await Promise.all(jobs);
 await Promise.all([...defaultParts('male'),...defaultParts('female'),...parts].map(ensurePart));
 store.ready=true;return store;
}
export function defaultParts(sex){const S=sex==='female'?'Female':'Male';return ['Body','Arms','Legs','Feet'].map(p=>`${S}_Peasant_${p}`)}
export function ensurePart(id){if(store.parts[id])return Promise.resolve(store.parts[id]);if(!store.manifest?.parts[id])return Promise.reject(Error('Unknown outfit part '+id));if(!store.pending.has(id))store.pending.set(id,loadGlb(store.manifest.parts[id]).then(g=>store.parts[id]=g.scene));return store.pending.get(id)}

// Clips are shared per body: only the pelvis translation is re-scaled to the
// body's own hip height, everything else is rotation-only.
export function clipsFor(sex){
 const key='clips:'+sex;if(store[key])return store[key];
 const pelvis=store.rigs[sex].getObjectByName('pelvis').position,man=store.mannequinPelvis||pelvis,out={};
 for(const [name,clip] of Object.entries(store.clips)){const c=clip.clone();for(const t of c.tracks)if(t.name==='pelvis.position'){const v=t.values;for(let i=0;i<v.length;i+=3){v[i]=pelvis.x+(v[i]-man.x)*(pelvis.z/man.z);v[i+1]=pelvis.y+(v[i+1]-man.y)*(pelvis.z/man.z);v[i+2]=pelvis.z+(v[i+2]-man.z)*(pelvis.z/man.z)}}out[name]=c}
 return store[key]=out;
}

// Textures load in the browser only; Node checks still get valid materials.
function texture(name,{color=false}={}){
 const T=store.T;if(typeof document==='undefined'||!store.manifest.textures[name])return null;
 if(!store.textures.has(name)){store.loading=(store.loading||0)+1;const settle=()=>{if(--store.loading===0)for(const fn of (store.textureWaiters||[]).splice(0))fn()};const t=new T.TextureLoader().load(new URL(store.manifest.textures[name],BASE).href,settle,undefined,settle);t.flipY=false;if(color)t.colorSpace=T.SRGBColorSpace;t.userData.eldervaleShared=true;store.textures.set(name,t)}
 return store.textures.get(name);
}
// Resolves once every character texture requested so far has loaded (or failed),
// for one-off renders such as the HUD portrait.
export function texturesSettled(){return store.loading?new Promise(r=>(store.textureWaiters||(store.textureWaiters=[])).push(r)):Promise.resolve()}
export function material(key,make){if(!store.materials.has(key)){const m=make();m.userData.eldervaleShared=true;store.materials.set(key,m)}return store.materials.get(key)}
// Outfit material: one per outfit colour, shared by every wearer.
export function outfitMaterial(outfit,variant=1){
 const T=store.T,o=outfit.toLowerCase();
 return material(`outfit:${o}:${variant}`,()=>{const orm=texture(o+'_orm');return new T.MeshStandardMaterial({map:texture(`${o}_${variant}_color`,{color:true}),normalMap:texture(o+'_normal'),aoMap:orm,roughnessMap:orm,metalnessMap:orm,metalness:orm?1:.1,roughness:1})});
}
// Skin and hair are tinted from neutral base textures.
export function skinMaterial(kind,sex,tint){
 const T=store.T;return material(`skin:${kind}:${sex}:${tint}`,()=>{const base=kind==='head'?'head_':'body_';return new T.MeshStandardMaterial({map:texture(base+sex+'_color',{color:true}),normalMap:texture(base+sex+'_normal'),roughnessMap:texture(base+sex+'_roughness'),roughness:1,metalness:0,color:new T.Color(tint)})});
}
export function hairMaterial(set,tint){const T=store.T;return material(`hair:${set}:${tint}`,()=>new T.MeshStandardMaterial({map:texture(`hair_${set}_color`,{color:true}),normalMap:texture(`hair_${set}_normal`),roughness:.75,metalness:0,color:new T.Color(tint),alphaTest:.35,side:T.DoubleSide}))}
export function eyeMaterial(){const T=store.T;return material('eyes',()=>new T.MeshStandardMaterial({map:texture('eye_color',{color:true}),roughness:.25,metalness:0}))}
