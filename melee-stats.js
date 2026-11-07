import {weaponCatalog,isTwoHanded} from './weapons.js?v=release-20261107-move3v161';
import {shieldCatalog} from './shields.js?v=release-20261107-move3v161';
import {outfitItems,SLOT_LABELS} from './outfits.js?v=release-20261107-move3v161';
import {CAPE_GEAR,addBonuses,bonuses,bestArrow,ARROWS,levelsFromXp,requirementError,ARMOUR_VERB,describeGear} from './gear-tiers.js?v=release-20261107-move3v161';
import {skillLevel} from './combat-level.js?v=release-20261107-move3v161';
// Every wearable outfit piece (outfits.js) plus the cape. `equipSlot` is the
// machine slot; one item per slot can be worn. Legacy helm/chest/legs/boots
// are the iron knight pieces.
export const armorCatalog={};
for(const [key,item] of Object.entries(outfitItems))armorCatalog[key]={name:item.name,slot:SLOT_LABELS[item.slot],equipSlot:item.slot,defence:item.defence,reduction:item.reduction,buy:item.buy,sell:item.sell,desc:item.desc,bonuses:item.bonuses,req:item.req,tier:item.tier,tint:item.tint};
armorCatalog.cape={name:'Crimson Adventurer Cape',slot:'Back',equipSlot:'cape',defence:1,reduction:0,buy:60,sell:18,desc:'A crimson cape with gold clasps.',...CAPE_GEAR};
export function weaponStats(key){return weaponCatalog[key]||{name:'Unarmed',damage:1,attack:0,speed:1.8,reach:1.8}}
export function meleeProtection(state){let defence=0,reduction=0;for(const [key,item] of Object.entries(armorCatalog))if(state.equipped?.[key]){defence+=item.defence;reduction+=item.reduction}if(!isTwoHanded(state.equippedWeapon))defence+=shieldCatalog[state.equippedShield]?.defence||0;return {defence,reduction,blockChance:Math.min(.60,.05+defence*.008+(state.equippedShield?.08:0))}}
export function meleeRoll(attack,protection,rng=Math.random){const chance=Math.max(.02,Math.min(.65,(protection.blockChance||0)-(attack.attack||0)*.002));const blocked=rng()<chance;const raw=4+attack.damage+Math.floor(rng()*5);return {blocked,damage:blocked?0:Math.max(1,raw-(protection.reduction||0))}}
// OSRS equipment totals for a client state: weapon, shield (not with a two-handed
// weapon), worn armour and, with a bow, the best arrows it can fire.
export function equipmentBonuses(state){
 const weapon=weaponCatalog[state.equippedWeapon],parts=[weapon?.bonuses];
 if(!isTwoHanded(state.equippedWeapon))parts.push(shieldCatalog[state.equippedShield]?.bonuses);
 for(const [key,item] of Object.entries(armorCatalog))if(state.equipped?.[key]===true)parts.push(item.bonuses);
 const arrow=weapon?.ranged&&!weapon?.magic?bestArrow(state,state.equippedWeapon):null;
 if(arrow)parts.push(bonuses({rstr:ARROWS[arrow].rstr}));
 return {...addBonuses(...parts),arrow};
}
export const playerLevels=state=>levelsFromXp(state,skillLevel);
// Catalog entry behind an equippable goods id ('weapon:x', 'shield:x', 'armor:x').
export function gearFor(id){const [field,key]=[String(id).slice(0,String(id).indexOf(':')),String(id).slice(String(id).indexOf(':')+1)];return field==='weapon'?weaponCatalog[key]:field==='shield'?shieldCatalog[key]:field==='armor'?armorCatalog[key]:null}
// The OSRS refusal for equipping an item above the player's levels (null when allowed).
export function equipRefusal(state,id){const item=gearFor(id),field=id.startsWith('weapon:')?'weaponsOwned':id.startsWith('shield:')?'shieldsOwned':'armorOwned';return item?requirementError(item.req,playerLevels(state),ARMOUR_VERB[field]):null}
export const gearDetails=id=>describeGear(gearFor(id));
