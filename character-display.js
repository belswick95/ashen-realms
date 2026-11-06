import {mountCatalog} from './mounts.js?v=release-20261106-osrswalk124';
import {attachWeapon,attachShield} from './equipment-pose.js?v=release-20261106-osrswalk124';
import {buildHumanoid} from './humanoid.js?v=release-20261106-osrswalk124';import {makeWeapon,weaponCatalog,isTwoHanded,isRanged,isMagic} from './weapons.js?v=release-20261106-osrswalk124';import {makeShield,shieldCatalog} from './shields.js?v=release-20261106-osrswalk124';import {createCape} from './cape.js?v=release-20261106-osrswalk124';import {createHumanoidAnimator} from './animation.js?v=release-20261106-osrswalk124';import {safeAppearance} from './appearance.js?v=release-20261106-osrswalk124';
import {armorCatalog} from './melee-stats.js?v=release-20261106-osrswalk124';
// Cosmetic-only view of another player: validated appearance and worn items.
// Armour is {itemKey:true}, at most one item per equipment slot.
export function publicCharacter(appearance={},equipment={}){
 if(!equipment||typeof equipment!=='object'||Array.isArray(equipment))equipment={};
 const armor={},bySlot={};
 for(const [key,on] of Object.entries(equipment.armor&&typeof equipment.armor==='object'?equipment.armor:{}))if(on===true&&Object.hasOwn(armorCatalog,key)){const slot=armorCatalog[key].equipSlot;if(bySlot[slot])delete armor[bySlot[slot]];bySlot[slot]=key;armor[key]=true}
 return {appearance:safeAppearance(appearance),loadout:{armor,mount:Object.hasOwn(mountCatalog,equipment.mount)?equipment.mount:null,weapon:Object.hasOwn(weaponCatalog,equipment.weapon)?equipment.weapon:null,shield:!isTwoHanded(equipment.weapon)&&Object.hasOwn(shieldCatalog,equipment.shield)?equipment.shield:null}};
}
// `trusted` is for game-authored actors (monsters, NPCs) that may use looks
// outside the player palette; remote players always go through publicCharacter.
export function buildCharacterDisplay(T,parent,appearance,loadout,{trusted=false}={}){
 const data=publicCharacter(appearance,loadout),visual=new T.Group();parent.add(visual);if(trusted)data.appearance={...data.appearance,...appearance};
 const rig=buildHumanoid(T,visual,{...data.appearance,adventurer:true});
 rig.setCoverage(data.loadout.armor);
 if(data.loadout.weapon){const weapon=makeWeapon(T,data.loadout.weapon);attachWeapon(rig,weapon,data.loadout.weapon)}
 if(data.loadout.shield){const shield=makeShield(T,data.loadout.shield);attachShield(rig,shield)}
 const cape=data.loadout.armor.cape?createCape(T,visual,{color:0x81394b,rig}):null,animator=createHumanoidAnimator(rig);
 return {rig,visual,data,update(dt,motion){const pose=animator.update(dt,{...motion,weapon:data.loadout.weapon,twoHanded:isTwoHanded(data.loadout.weapon),ranged:isRanged(data.loadout.weapon),magic:isMagic(data.loadout.weapon),shield:!!data.loadout.shield,armed:!!data.loadout.weapon});if(!motion?.mounted)cape?.update(dt,pose?.blend||0);return pose},updateCape(dt,speed,options){cape?.update(dt,speed,options)},
  dispose(){animator.dispose();const disposed=new Set();visual.traverse(o=>{for(const resource of [o.geometry,...(Array.isArray(o.material)?o.material:[o.material])])if(resource&&!resource.userData?.eldervaleShared&&!disposed.has(resource)&&!(o.isSkinnedMesh)){resource.dispose();disposed.add(resource)}});rig.dispose();visual.removeFromParent()}};
}
