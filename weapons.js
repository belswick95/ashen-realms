import {meshItemIcon} from './item-appearance.js?v=release-20261106-quiet121';
import {heldItem} from './weapon-assets.js?v=release-20261106-quiet121';
import {tierWeapons,weaponGear,BOWS,describeGear} from './gear-tiers.js?v=release-20261106-quiet121';
import {tintHeldItem} from './tier-tint.js?v=release-20261106-quiet121';
import {UNIQUE_ITEMS,legacyWeaponNumbers} from './unique-gear.js?v=release-20261106-quiet121';
import {accentHeldItem} from './unique-look.js?v=release-20261106-quiet121';
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
 bloodthornBow:W('Bloodthorn bow','bow',12,18,2.5,14,320,96,'A cruel thorned recurve bow.',{twoHanded:true,ranged:true}),
 // Staffs: two-handed magic. The off hand casts a bolt in the gem's colour.
 apprenticeStaff:W('Apprentice staff','staff',5,9,2.4,10,40,12,'A crooked staff set with a green focus gem.',{twoHanded:true,ranged:true,magic:true,color:0x6cf07a}),
 sapphireStaff:W('Sapphire staff','staff',9,14,2.4,11,160,48,'A staff crowned with a deep blue sapphire.',{twoHanded:true,ranged:true,magic:true,color:0x5b7dff}),
 amethystStaff:W('Amethyst staff','staff',11,16,2.5,11,220,66,'A staff holding a humming amethyst.',{twoHanded:true,ranged:true,magic:true,color:0xc45bff}),
 emberStaff:W('Ember staff','staff',13,18,2.6,10,300,90,'A staff whose ruby burns like a coal.',{twoHanded:true,ranged:true,magic:true,color:0xff6a3d})
};
// Metal tiers (gear-tiers.js): bronze to eldersteel versions of the iron weapons,
// recoloured iron models. The iron tier keeps the original keys above.
for(const [key,w] of Object.entries(tierWeapons())){
 if(weaponCatalog[key]){Object.assign(weaponCatalog[key],{tier:w.tier,bonuses:w.bonuses,req:w.req,ticks:w.ticks,speed:w.speed,styles:w.styles});continue}
 weaponCatalog[key]=W(w.name,'weapon',Math.round(w.bonuses.str/3)+2,Math.max(w.bonuses.astab,w.bonuses.aslash,w.bonuses.acrush),w.speed,w.reach,w.buy,w.sell,w.desc,{model:w.model,tint:w.tint,tier:w.tier,bonuses:w.bonuses,req:w.req,ticks:w.ticks,styles:w.styles,...(w.twoHanded?{twoHanded:true}:{})});
}
// Wood-tier shortbows: the wooden bow model with the wood recoloured.
for(const [key,b] of Object.entries(BOWS))if(!weaponCatalog[key])weaponCatalog[key]=W(b.name,'bow',Math.round(b.arange/4)+4,b.arange,1.8,b.reach,b.buy,Math.round(b.buy*.3),b.desc,{twoHanded:true,ranged:true,model:'woodenBow',tint:b.wood,tintMode:'wood'});
// Unique weapons (unique-gear.js): an existing model, recoloured, with an accent glow and motes.
for(const u of UNIQUE_ITEMS)if(u.kind==='weapon'&&!weaponCatalog[u.id]){const n=legacyWeaponNumbers(u);weaponCatalog[u.id]=W(u.name,u.staff?'staff':'weapon',n.damage,n.attack,+(u.ticks*.45).toFixed(2),u.reach,u.value,Math.round(u.value*.3),u.desc,
 {model:u.model,tint:u.tint,accent:u.accent,tier:'unique',unique:true,bonuses:{...u.bonuses},req:{...u.req},ticks:u.ticks,styles:u.styles,tradeable:u.tradeable,quest:u.quest,shopless:true,...(u.twoHanded||u.staff?{twoHanded:true}:{}),...(u.staff?{ranged:true,magic:true,color:u.color,spell:u.spell}:{})})}
// OSRS-style bonuses, level requirement and speed (ticks) for every weapon.
for(const [key,item] of Object.entries(weaponCatalog)){const g=item.bonuses?null:weaponGear(key,item.kind);if(g)Object.assign(item,{bonuses:g.bonuses,req:g.req,ticks:g.ticks,speed:g.speed,styles:g.styles,...(g.arrowCap?{arrowCap:g.arrowCap}:{}),...(g.spell?{spell:g.spell}:{}),...(g.tier&&!item.tier?{tier:g.tier}:{})})}
export const weaponDetails=key=>describeGear(weaponCatalog[key]);
// Bows use one 'arrows' item (the fletching product, also sold by outfitters)
// per shot; staffs need none.
export const usesArrows=key=>isRanged(key)&&!weaponCatalog[key]?.magic;
export const isTwoHanded=key=>!!weaponCatalog[key]?.twoHanded;
export const isRanged=key=>!!weaponCatalog[key]?.ranged;
export const isMagic=key=>!!weaponCatalog[key]?.magic;
// Bows are held in the bow (left) hand; everything else, staffs included, in the right.
export const isBow=key=>isRanged(key)&&!isMagic(key);
// Held model for an item key (an empty group if the assets are not loaded).
const glows=new Map();
export function makeWeapon(T,key){
 const item=weaponCatalog[key],g=heldItem(T,item?item.model||key:'longsword','weapon',item?.tint!=null?m=>tintHeldItem(T,m,item.tint,item.tintMode||'metal'):null),tip=g.getObjectByName('tip');
 g.name='weapon-'+key;g.userData.weaponKey=key;
 // Staffs: a soft glow around the focus gem (shared geometry and material per colour).
 if(item?.magic&&tip){if(!glows.has(item.color))glows.set(item.color,{geometry:new T.IcosahedronGeometry(.075,1),material:new T.MeshBasicMaterial({color:item.color,transparent:true,opacity:.45,blending:T.AdditiveBlending,depthWrite:false})});const {geometry,material}=glows.get(item.color);geometry.userData.eldervaleShared=material.userData.eldervaleShared=true;const glow=new T.Mesh(geometry,material);glow.name='gem-glow';glow.castShadow=false;glow.position.y=-.03;tip.add(glow)}
 if(item?.accent)accentHeldItem(T,g,item.accent,{height:item.magic?1.3:.9});
 return g;
}
export function iconForWeapon(key){return meshItemIcon('weapon:'+key)}
