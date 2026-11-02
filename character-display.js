import {buildHumanoid} from './humanoid.js?v=release-20261102-handedness10';import {buildPlateArmor} from './armor.js?v=release-20261102-multiplayer3';import {makeWeapon,weaponCatalog} from './weapons.js?v=release-20261102-handedness11';import {makeShield,shieldCatalog} from './shields.js?v=release-20261102-side-shield12';import {createCape} from './cape.js?v=release-20261102-multiplayer3';import {createHumanoidAnimator} from './animation.js?v=release-20261102-handedness10';import {safeAppearance} from './appearance.js?v=release-20261102-multiplayer3';
export function publicCharacter(appearance={},equipment={}){
 if(!equipment||typeof equipment!=='object'||Array.isArray(equipment))equipment={};
 const armor={};for(const key of ['helm','chest','legs','boots','cape'])armor[key]=equipment.armor?.[key]===true;
 return {appearance:safeAppearance(appearance),loadout:{armor,weapon:Object.hasOwn(weaponCatalog,equipment.weapon)?equipment.weapon:null,shield:equipment.weapon!=='twohand'&&Object.hasOwn(shieldCatalog,equipment.shield)?equipment.shield:null}};
}
export function buildCharacterDisplay(T,parent,appearance,loadout){
 const data=publicCharacter(appearance,loadout),visual=new T.Group();parent.add(visual);
 const rig=buildHumanoid(T,visual,data.appearance),shared=new Set();visual.traverse(o=>{if(o.geometry)shared.add(o.geometry);if(o.material)shared.add(o.material)});
 const armor=buildPlateArmor(T,visual,rig);for(const key of ['helm','chest','legs','boots'])for(const part of armor[key])part.visible=data.loadout.armor[key];
 rig.torso.visible=!data.loadout.armor.chest;for(const hair of rig.hairMeshes)hair.visible=!data.loadout.armor.helm;
 if(data.loadout.weapon){const weapon=makeWeapon(T,data.loadout.weapon);weapon.position.set(0,-.02,.035);weapon.rotation.set(.52,0,-.18);rig.rightHand.add(weapon)}
 if(data.loadout.shield){const shield=makeShield(T,data.loadout.shield);shield.position.set(.29,-.06,-.035);shield.rotation.set(.10,1.18,-.08);rig.leftHand.add(shield)}
 const cape=data.loadout.armor.cape?createCape(T,visual,{color:0x81394b}):null,animator=createHumanoidAnimator(rig);
 return {rig,visual,data,update(dt,motion){const pose=animator.update(dt,{...motion,twoHanded:data.loadout.weapon==='twohand',shield:!!data.loadout.shield,armed:!!data.loadout.weapon});cape?.update(dt,pose?.blend||0);return pose},dispose(){const disposed=new Set();visual.traverse(o=>{for(const resource of [o.geometry,...(Array.isArray(o.material)?o.material:[o.material])])if(resource&&!shared.has(resource)&&!disposed.has(resource)){resource.dispose();disposed.add(resource)}});visual.removeFromParent()}};
}
