import {heldItem} from './weapon-assets.js?v=release-20261105-perf77';
// Off-hand shields: Quaternius CC0 models (assets/weapons) in the held-item
// frame: the fist at the origin behind the board, face toward +Z, top toward +Y.
const S=(name,defence,buy,sell,desc)=>({name,kind:'shield',defence,buy,sell,desc});
export const shieldCatalog={
 square:S('Iron heater shield',5,40,12,'A plank heater shield with an iron rim.'),
 kite:S('Iron kiteshield',9,40,12,'A heater shield banded with an iron cross.'),
 woodenShield:S('Wooden buckler',3,20,6,'A small bronze-rimmed wooden shield.'),
 roundShield:S('Wooden round shield',6,45,14,'A round plank shield with an iron rim.'),
 quarteredShield:S('Quartered round shield',7,60,18,'A round shield painted in quarters.'),
 celticShield:S('Gilded celtic shield',12,280,84,'A tall gilded shield set with an emerald.')
};
export function makeShield(T,key){return heldItem(T,shieldCatalog[key]?key:'kite','shield')}
