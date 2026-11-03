import {weaponCatalog} from './weapons.js?v=release-20261103-motion15';
import {shieldCatalog} from './shields.js?v=release-20261103-motion15';
export const armorCatalog={
 helm:{name:'Iron full helm',slot:'Head',defence:4,reduction:1,desc:'Iron head protection.'},
 chest:{name:'Iron platebody',slot:'Body',defence:10,reduction:3,desc:'Plate armor that absorbs melee damage.'},
 legs:{name:'Iron platelegs',slot:'Legs',defence:7,reduction:2,desc:'Articulated iron leg protection.'},
 boots:{name:'Iron boots',slot:'Feet',defence:3,reduction:1,desc:'Iron-plated boots.'},
 cape:{name:'Crimson Adventurer Cape',slot:'Back',defence:1,reduction:0,desc:'A crimson cape with gold clasps.'}
};
export function weaponStats(key){return weaponCatalog[key]||{name:'Unarmed',damage:1,attack:0,speed:1.8,reach:1.8}}
export function meleeProtection(state){let defence=0,reduction=0;for(const [key,item] of Object.entries(armorCatalog))if(state.equipped?.[key]){defence+=item.defence;reduction+=item.reduction}if(state.equippedWeapon!=='twohand')defence+=shieldCatalog[state.equippedShield]?.defence||0;return {defence,reduction,blockChance:Math.min(.60,.05+defence*.008+(state.equippedShield?.08:0))}}
export function meleeRoll(attack,protection,rng=Math.random){const chance=Math.max(.02,Math.min(.65,(protection.blockChance||0)-(attack.attack||0)*.002));const blocked=rng()<chance;const raw=4+attack.damage+Math.floor(rng()*5);return {blocked,damage:blocked?0:Math.max(1,raw-(protection.reduction||0))}}
