import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
// Weapon and shield models (assets/weapons/weapons.glb, Quaternius CC0), one
// top-level node per item key in the held-item frame. Geometry and materials
// are shared by every copy; preloadCharacters() also loads these.
const BASE=new URL('./assets/weapons/',import.meta.url);
const store=globalThis.__eldervaleWeaponStore||(globalThis.__eldervaleWeaponStore={ready:false,items:{},pending:null,T:null,textures:new Map()});
export const weaponStore=store;
const defaultRead=async url=>{const r=await fetch(url);if(!r.ok)throw Error('Weapon asset '+url+' '+r.status);return r.arrayBuffer()};

export function preloadWeapons(T,{read=defaultRead}={}){
 if(store.pending)return store.pending;store.T=T;
 store.pending=(async()=>{
  const buffer=await read(new URL('weapons.glb?v=release-20261106-login85',BASE).href);
  const gltf=await new Promise((resolve,reject)=>new GLTFLoader().parse(buffer,'',resolve,reject));
  const textures=store.textures,browser=typeof document!=='undefined';
  const load=(file,color)=>{if(!textures.has(file)){const t=new T.TextureLoader().load(new URL(file,BASE).href);t.flipY=false;if(color)t.colorSpace=T.SRGBColorSpace;t.userData.eldervaleShared=true;textures.set(file,t)}return textures.get(file)};
  for(const node of [...gltf.scene.children]){
   node.traverse(o=>{if(!o.isMesh)return;o.castShadow=true;o.receiveShadow=true;o.geometry.userData.eldervaleShared=true;
    for(const m of [o.material].flat()){m.userData.eldervaleShared=true;const maps=m.userData.textures;
     // Trim-sheet textures load in the browser only (Node has no image decoder).
     if(browser&&maps&&!m.userData.texturesApplied){if(maps.map)m.map=load(maps.map,true);if(maps.normalMap)m.normalMap=load(maps.normalMap);if(maps.orm){m.roughnessMap=m.metalnessMap=m.aoMap=load(maps.orm)}m.userData.texturesApplied=true;m.needsUpdate=true}}});
   store.items[node.name]=node;
  }
  store.ready=true;return store;
 })();
 return store.pending;
}

// A held item: an outer group (free for callers to position) around a clone of
// the model node (which keeps its own normalising transform).
export function heldItem(T,key,kind){
 const group=new T.Group();group.name=kind+'-'+key;group.userData.itemKey=key;
 const src=store.items[key];
 if(src){const model=src.clone(true);model.name='model';group.add(model)}
 // Where spells or projectiles leave the item (staff gems), in the held frame.
 if(src?.userData.tip){const tip=new T.Object3D();tip.name='tip';tip.position.fromArray(src.userData.tip);group.add(tip)}
 else if(store.pending)store.pending.then(()=>{if(store.items[key]&&!group.getObjectByName('model')){const model=store.items[key].clone(true);model.name='model';group.add(model)}}).catch(()=>{});
 return group;
}
// The arrow model (projectiles).
export function arrowModel(T){return heldItem(T,'arrow','projectile')}
