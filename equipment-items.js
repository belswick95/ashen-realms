import {buildHumanoid} from './humanoid.js?v=release-20261104-audit45';
import {buildPlateArmor} from './armor.js?v=release-20261104-audit45';
import {createCape} from './cape.js?v=release-20261104-audit45';
import {buildWarhorse} from './horse-model.js?v=release-20261104-audit45';
const armorCaches=new WeakMap();
export function armorItem(T,slot){let cache=armorCaches.get(T);if(!cache){cache={};armorCaches.set(T,cache);const body=new T.Group(),rig=buildHumanoid(T,body),armor=buildPlateArmor(T,body,rig);const cape=createCape(T,body,{color:0x81394b,rig});armor.cape=[cape.mesh];body.updateMatrixWorld(true);for(const [key,parts]of Object.entries(armor)){const group=new T.Group();for(const part of parts){const copy=part.clone(true);copy.visible=true;copy.matrix.copy(part.matrixWorld);copy.matrix.decompose(copy.position,copy.quaternion,copy.scale);group.add(copy)}group.traverse(o=>{if(o.geometry)o.geometry.userData.eldervaleShared=true;for(const m of Array.isArray(o.material)?o.material:[o.material])if(m)m.userData.eldervaleShared=true});cache[key]=group;}rig.skeleton.dispose();}
 const item=cache[slot].clone(true);item.userData.canonicalEquipment=slot;return item;
}
export function horseItem(T){const root=new T.Group(),horse=buildWarhorse(T,root);horse.root.visible=true;horse.pose(0,false);root.userData.canonicalEquipment='armoredWhiteHorse';return root;}
