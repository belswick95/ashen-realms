import {attachWeapon,attachShield} from './equipment-pose.js?v=release-20261103-travel11';
import {buildHumanoid} from './humanoid.js?v=release-20261103-travel11';import {buildPlateArmor} from './armor.js?v=release-20261103-travel11';import {makeWeapon,weaponCatalog} from './weapons.js?v=release-20261103-travel11';import {makeShield,shieldCatalog} from './shields.js?v=release-20261103-travel11';import {createCape} from './cape.js?v=release-20261103-travel11';import {createHumanoidAnimator} from './animation.js?v=release-20261103-travel11';import {safeAppearance} from './appearance.js?v=release-20261103-travel11';
export function publicCharacter(appearance={},equipment={}){
 if(!equipment||typeof equipment!=='object'||Array.isArray(equipment))equipment={};
 const armor={};for(const key of ['helm','chest','legs','boots','cape'])armor[key]=equipment.armor?.[key]===true;
 return {appearance:safeAppearance(appearance),loadout:{armor,weapon:Object.hasOwn(weaponCatalog,equipment.weapon)?equipment.weapon:null,shield:equipment.weapon!=='twohand'&&Object.hasOwn(shieldCatalog,equipment.shield)?equipment.shield:null}};
}
export function buildCharacterDisplay(T,parent,appearance,loadout){
 const data=publicCharacter(appearance,loadout),visual=new T.Group();parent.add(visual);
 const rig=buildHumanoid(T,visual,data.appearance),shared=new Set();visual.traverse(o=>{if(o.geometry)shared.add(o.geometry);if(o.material)shared.add(o.material)});
 const armor=buildPlateArmor(T,visual,rig);for(const key of ['helm','chest','legs','boots'])for(const part of armor[key])part.visible=data.loadout.armor[key];
 rig.torso.visible=!data.loadout.armor.chest;for(const part of rig.clothingMeshes)part.visible=!data.loadout.armor.chest;for(const hair of rig.hairMeshes)hair.visible=!data.loadout.armor.helm;
 if(data.loadout.weapon){const weapon=makeWeapon(T,data.loadout.weapon);attachWeapon(rig,weapon,data.loadout.weapon)}
 if(data.loadout.shield){const shield=makeShield(T,data.loadout.shield);attachShield(rig,shield)}
 const cape=data.loadout.armor.cape?createCape(T,visual,{color:0x81394b}):null,animator=createHumanoidAnimator(rig);
 return {rig,visual,data,update(dt,motion){const pose=animator.update(dt,{...motion,weapon:data.loadout.weapon,twoHanded:data.loadout.weapon==='twohand',shield:!!data.loadout.shield,armed:!!data.loadout.weapon});cape?.update(dt,pose?.blend||0);return pose},dispose(){const disposed=new Set();visual.traverse(o=>{for(const resource of [o.geometry,...(Array.isArray(o.material)?o.material:[o.material])])if(resource&&!resource.userData?.eldervaleShared&&!shared.has(resource)&&!disposed.has(resource)){resource.dispose();disposed.add(resource)}});visual.removeFromParent()}};
}
