import {heldItem} from './weapon-assets.js?v=release-20261107-qa2g163';
import {tierShields,shieldGear,describeGear,bonuses} from './gear-tiers.js?v=release-20261107-qa2g163';
import {tintHeldItem} from './tier-tint.js?v=release-20261107-qa2g163';
import {UNIQUE_ITEMS,defenceOf} from './unique-gear.js?v=release-20261107-qa2g163';
import {accentHeldItem} from './unique-look.js?v=release-20261107-qa2g163';
import {makeTorch} from './torch.js?v=release-20261107-qa2g163';
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
// The torch takes the off-hand (shield) slot: no defence, it burns while held (torch.js).
// Two-handed weapons block it like a shield. Procedural model, so no asset key.
shieldCatalog.torch={...S('Torch',0,8,2,'A pitch-soaked cloth wrapped round a stick. It burns while you hold it.'),torch:true,procedural:true,bonuses:bonuses(),req:{}};
for(const [key,item] of Object.entries(shieldCatalog))if(!item.bonuses){const g=shieldGear(key);Object.assign(item,{bonuses:g.bonuses,req:g.req})}
// Unique shields (unique-gear.js): the anti-breath shields.
for(const u of UNIQUE_ITEMS)if(u.kind==='shield'&&!shieldCatalog[u.id])shieldCatalog[u.id]={...S(u.name,defenceOf(u),u.value,Math.round(u.value*.3),u.desc),model:u.model,tint:u.tint,accent:u.accent,tier:'unique',unique:true,bonuses:{...u.bonuses},req:{...u.req},breathWard:u.breathWard,tradeable:u.tradeable,quest:u.quest,shopless:true};
export const shieldDetails=key=>describeGear(shieldCatalog[key]);
export const isTorch=key=>!!shieldCatalog[key]?.torch;
export function makeShield(T,key){if(isTorch(key)){const g=makeTorch(T);g.name='shield-'+key;return g}const item=shieldCatalog[key],g=heldItem(T,item?item.model||key:'kite','shield',item?.tint!=null?m=>tintHeldItem(T,m,item.tint):null);g.name='shield-'+key;if(item?.accent)accentHeldItem(T,g,item.accent,{height:.6});return g}
