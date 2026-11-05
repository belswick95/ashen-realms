import {createCape} from './cape.js?v=release-20261105-perf79';
import {buildWarhorse} from './horse-model.js?v=release-20261105-perf79';
import {characterStore as store,ensurePart,outfitMaterial} from './character-assets.js?v=release-20261105-perf79';
import {outfitItems} from './outfits.js?v=release-20261105-perf79';
// Canonical 3D models for wearable items: the same outfit part that a
// character wears, shown on its own. Inventory icons, ground drops (which
// flatten this model) and bank notes are all derived from it, so every outfit
// item added to outfits.js gets all three automatically.
export function armorItem(T,key){
 const root=new T.Group();root.userData.canonicalEquipment=key;
 if(key==='cape'){const cape=createCape(T,root,{color:0x81394b});cape.mesh.position.y-=.25;root.userData.ready=Promise.resolve(root);return root}
 const item=outfitItems[key],part=item?.male;
 if(!item||!store.ready){root.userData.ready=Promise.resolve(root);return root}
 const fill=src=>{
  const holder=new T.Group();src.traverse(o=>{if(!o.isSkinnedMesh||/Regular/.test(o.material?.name||''))return;const m=new T.Mesh(o.geometry,outfitMaterial(item.outfit,item.variant));m.castShadow=true;m.receiveShadow=true;holder.add(m)});
  // Centre on the ground at a hand-held size regardless of where it sits on the body.
  holder.updateMatrixWorld(true);const box=new T.Box3().setFromObject(holder),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3());
  const s=.85/Math.max(.01,size.x,size.y,size.z);holder.scale.setScalar(s);holder.position.set(-center.x*s,-box.min.y*s,-center.z*s);root.add(holder);return root;
 };
 root.userData.ready=store.parts[part]?Promise.resolve(fill(store.parts[part])):ensurePart(part).then(fill).catch(()=>root);
 return root;
}
export function horseItem(T){const root=new T.Group(),horse=buildWarhorse(T,root);horse.root.visible=true;horse.pose(0,false);root.userData.canonicalEquipment='armoredWhiteHorse';return root;}
