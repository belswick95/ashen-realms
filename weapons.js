import {meshItemIcon} from './item-appearance.js?v=release-20261105-weapons56';
import {heldItem} from './weapon-assets.js?v=release-20261105-weapons56';
// Weapons are Quaternius CC0 models (assets/weapons, scripts/build-weapons.mjs)
// in the held-item frame: grip at the origin, blade along +Y, edge toward +X.
// Keys are what saves, the server catalog and equipment use; the first eight
// are the original iron weapons.
//   twoHanded: no shield can be carried; ranged: attacks from `range` units.
const W=(name,kind,damage,attack,speed,reach,buy,sell,desc,extra={})=>({name,kind,damage,attack,speed,reach,buy,sell,desc,...extra});
export const weaponCatalog={
 battleaxe:W('Iron battleaxe','weapon',14,16,2.8,2.2,90,30,'A double-headed iron battleaxe.'),
 dagger:W('Iron dagger','weapon',5,8,1.4,1.7,20,12,'A light blade for quick thrusts.'),
 scimitar:W('Iron scimitar','weapon',7,12,1.7,2.4,45,12,'A swift curved iron blade.'),
 longsword:W('Iron longsword','weapon',10,14,2.3,2.5,45,12,'A balanced straight iron sword.'),
 twohand:W('Iron 2h sword','weapon',16,20,3.2,2.8,120,40,'A heavy two-handed iron sword.',{twoHanded:true}),
 shortsword:W('Iron shortsword','weapon',6,10,1.6,2.1,45,12,'A fast close-range sword with a gilded guard.'),
 pickaxe:W('Bronze pickaxe','tool',4,3,2.5,2.1,45,12,'A bronze pick for mining ore.'),
 axe:W('Iron axe','tool',5,4,2.4,2.1,45,12,'An iron hatchet for cutting trees.'),
 bronzeSword:W('Bronze sword','weapon',8,11,2.1,2.4,35,10,'A sturdy bronze blade.'),
 bronzeAxe:W('Bronze axe','weapon',7,9,2.2,2.1,30,9,'A bronze-headed fighting axe.'),
 waraxe:W('Iron war axe','weapon',12,14,2.5,2.4,75,24,'A long-hafted bearded war axe.'),
 hammer:W('Iron hammer','weapon',9,10,2.3,2.0,55,16,'A blunt iron hammer that dents plate.'),
 spear:W('Iron spear','weapon',11,15,2.4,3.2,70,22,'A long iron-tipped spear with great reach.'),
 goldenSword:W('Gilded sword','weapon',13,18,2.2,2.6,240,72,'An ornate gilded blade.'),
 warhammer:W('Iron warhammer','weapon',18,18,3.4,2.5,150,45,'A massive two-handed double hammer.',{twoHanded:true}),
 scythe:W('War scythe','weapon',15,17,3.0,3.0,130,40,'A reaping blade on a long snath.',{twoHanded:true}),
 claymore:W('Crimson claymore','weapon',18,22,3.3,2.9,300,90,'A great crimson two-handed sword.',{twoHanded:true}),
 woodenBow:W('Wooden bow','bow',6,10,2.4,12,50,15,'A simple wooden shortbow.',{twoHanded:true,ranged:true}),
 longbow:W('Longbow','bow',8,13,2.6,15,95,28,'A tall bow with the longest reach.',{twoHanded:true,ranged:true}),
 goldenBow:W('Gilded bow','bow',10,16,2.4,14,220,66,'A gilded recurve bow.',{twoHanded:true,ranged:true}),
 bloodthornBow:W('Bloodthorn bow','bow',12,18,2.5,14,320,96,'A cruel thorned recurve bow.',{twoHanded:true,ranged:true})
};
for(const item of Object.values(weaponCatalog))item.desc+=(item.ranged?' Ranged '+item.reach+' · ':' ')+'Attack +'+item.attack+' · Damage +'+item.damage+' · Attack turn '+item.speed+'s.';
export const isTwoHanded=key=>!!weaponCatalog[key]?.twoHanded;
export const isRanged=key=>!!weaponCatalog[key]?.ranged;
// Held model for an item key (an empty group if the assets are not loaded).
export function makeWeapon(T,key){return heldItem(T,weaponCatalog[key]?key:'longsword','weapon')}
export function iconForWeapon(key){return meshItemIcon('weapon:'+key)}
