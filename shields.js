import {heldItem} from './weapon-assets.js?v=release-20261106-monsters89';
import {tierShields,shieldGear,describeGear} from './gear-tiers.js?v=release-20261106-monsters89';
import {tintHeldItem} from './tier-tint.js?v=release-20261106-monsters89';
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
// Metal tiers: recoloured iron kite and heater shields (the iron tier keeps 'kite'/'square').
for(const [key,s] of Object.entries(tierShields())){
 if(shieldCatalog[key]){Object.assign(shieldCatalog[key],{tier:s.tier,bonuses:s.bonuses,req:s.req});continue}
 shieldCatalog[key]={...S(s.name,Math.round((s.bonuses.dstab+s.bonuses.dslash+s.bonuses.dcrush)/12)+3,s.buy,s.sell,s.desc),model:s.model,tint:s.tint,tier:s.tier,bonuses:s.bonuses,req:s.req};
}
for(const [key,item] of Object.entries(shieldCatalog))if(!item.bonuses){const g=shieldGear(key);Object.assign(item,{bonuses:g.bonuses,req:g.req})}
export const shieldDetails=key=>describeGear(shieldCatalog[key]);
export function makeShield(T,key){const item=shieldCatalog[key],g=heldItem(T,item?item.model||key:'kite','shield',item?.tint!=null?m=>tintHeldItem(T,m,item.tint):null);g.name='shield-'+key;return g}
