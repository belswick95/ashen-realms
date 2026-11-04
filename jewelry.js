import {meshItemIcon} from './item-appearance.js?v=release-20261104-phone31';
// Jewelry is stored in existing inventory/equipment JSON; rings have no character mesh.
export const jewelryCatalog={
 woodlandAmulet:{name:'Woodland amulet',slot:'amulet',skill:'woodXP',bonus:1,icon:meshItemIcon('jewelry:woodlandAmulet'),description:'+1 Woodcutting level and +5% Woodcutting XP while worn.'},
 prospectorsRing:{name:'Prospector’s ring',slot:'trinket',skill:'miningXP',bonus:1,icon:meshItemIcon('jewelry:prospectorsRing'),description:'+1 Mining level and +5% Mining XP while worn.'}
};
export function jewelryBonus(state,skill){return ['amulet','trinket'].reduce((sum,slot)=>{const item=jewelryCatalog[state[slot]];return sum+(item?.slot===slot&&item.skill===skill?item.bonus:0)},0)}
export function gatheringXP(state,skill,base=25){return Math.round(base*(1+jewelryBonus(state,skill)*.05))}
