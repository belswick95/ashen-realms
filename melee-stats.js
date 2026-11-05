import {weaponCatalog,isTwoHanded} from './weapons.js?v=release-20261105-osrs67';
import {shieldCatalog} from './shields.js?v=release-20261105-osrs67';
import {outfitItems,SLOT_LABELS} from './outfits.js?v=release-20261105-osrs67';
// Every wearable outfit piece (outfits.js) plus the cape. `equipSlot` is the
// machine slot; one item per slot can be worn. Legacy helm/chest/legs/boots
// are the iron knight pieces.
export const armorCatalog={};
for(const [key,item] of Object.entries(outfitItems))armorCatalog[key]={name:item.name,slot:SLOT_LABELS[item.slot],equipSlot:item.slot,defence:item.defence,reduction:item.reduction,buy:item.buy,sell:item.sell,desc:item.desc};
armorCatalog.cape={name:'Crimson Adventurer Cape',slot:'Back',equipSlot:'cape',defence:1,reduction:0,buy:60,sell:18,desc:'A crimson cape with gold clasps.'};
export function weaponStats(key){return weaponCatalog[key]||{name:'Unarmed',damage:1,attack:0,speed:1.8,reach:1.8}}
export function meleeProtection(state){let defence=0,reduction=0;for(const [key,item] of Object.entries(armorCatalog))if(state.equipped?.[key]){defence+=item.defence;reduction+=item.reduction}if(!isTwoHanded(state.equippedWeapon))defence+=shieldCatalog[state.equippedShield]?.defence||0;return {defence,reduction,blockChance:Math.min(.60,.05+defence*.008+(state.equippedShield?.08:0))}}
export function meleeRoll(attack,protection,rng=Math.random){const chance=Math.max(.02,Math.min(.65,(protection.blockChance||0)-(attack.attack||0)*.002));const blocked=rng()<chance;const raw=4+attack.damage+Math.floor(rng()*5);return {blocked,damage:blocked?0:Math.max(1,raw-(protection.reduction||0))}}
