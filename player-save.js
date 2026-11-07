import {professionItems} from './profession-data.js?v=release-20261107-horse126';
import {combatLevel,maxHpForXp} from './combat-level.js?v=release-20261107-horse126';
// Backward-compatible mapping between browser saves and the existing JSONB columns.
// Authentication supplies the owner id; saved client data cannot choose another owner.
export const skillKeys=['attackXP','strengthXP','defenceXP','hitpointsXP','rangedXP','magicXP','prayerXP','firemakingXP','fishingXP','cookingXP','smithingXP','craftingXP','herbloreXP','farmingXP','agilityXP','thievingXP','fletchingXP','runecraftingXP','constructionXP','hunterXP'];
const object=value=>value&&typeof value==='object'&&!Array.isArray(value)?value:{};
const number=(value,fallback=0)=>Number.isFinite(Number(value))?Number(value):fallback;
const count=value=>Math.max(0,Math.floor(number(value)));
// Skill XP keeps OSRS fractions (17.5 copper, 6.25 bronze bar) to two decimals.
const xpValue=value=>Math.max(0,Math.round(number(value)*100)/100);
const list=value=>Array.isArray(value)?value.filter(v=>typeof v==='string'):[];
export function toPlayerRow(s,user){
 if(!user?.id)throw Error('A signed-in player is required to save.');
 const previous=object(s._cloud),skills={...object(previous.skills)};
 for(const key of skillKeys)skills[key]=xpValue(s[key]);
 return {user_id:user.id,character_name:user.user_metadata?.username||'Adventurer',level:combatLevel(s),xp:count(s.combatXP),gold:count(s.gold),health:Math.min(maxHpForXp(s.hitpointsXP),count(s.hp??100)),max_health:maxHpForXp(s.hitpointsXP),
 world_position:{...object(previous.world_position),x:number(s.x),y:number(s.z)},
 stats:{...object(previous.stats),...Object.fromEntries(Object.entries(s).filter(([k])=>k.startsWith('note:')).map(([k,v])=>[k,count(v)])),...Object.fromEntries(Object.keys(professionItems).map(id=>[id,count(s[id])])),wood:count(s.wood),ore:count(s.ore),fishingPole:count(s.fishingPole),fishingNet:count(s.fishingNet),bait:count(s.bait),rawFish:count(s.rawFish),woodXP:xpValue(s.woodXP),miningXP:xpValue(s.miningXP),kills:count(s.kills)},
 inventory:{...object(previous.inventory),armorOwned:list(s.armorOwned),weaponsOwned:list(s.weaponsOwned),shieldsOwned:list(s.shieldsOwned),jewelryOwned:list(s.jewelryOwned),mountsOwned:list(s.mountsOwned),bank:object(s.bank)},
 equipment:{...object(previous.equipment),...object(s.equipped),weapon:s.equippedWeapon||null,shield:s.equippedShield||null,amulet:s.amulet||null,trinket:s.trinket||null,mount:s.equippedMount||null},skills,
 quests:s.quests??previous.quests??{},
 game_flags:{...object(previous.game_flags),worldReceipts:Array.isArray(s.worldReceipts)?s.worldReceipts:[],appearance:s.appearance||null,starterChestClaimed:!!s.starterChestClaimed,starterShieldsGranted:!!s.starterShieldsGranted,starterJewelryGranted:!!s.starterJewelryGranted,starterDaggerGranted:!!s.starterDaggerGranted,starterBattleaxeGranted:!!s.starterBattleaxeGranted,runEnergy:Math.max(0,Math.min(100,number(s.runEnergy,100)))}};
}
export function fromPlayerRow(r){
 const equipment={...object(r.equipment)},skills=object(r.skills),weapon=equipment.weapon||null,shield=equipment.shield||null;const amulet=equipment.amulet||null,trinket=equipment.trinket||null;const equippedMount=equipment.mount||null;delete equipment.mount;delete equipment.amulet;delete equipment.trinket;delete equipment.weapon;delete equipment.shield;
 return {...Object.fromEntries(Object.entries(object(r.stats)).filter(([k])=>k.startsWith('note:')).map(([k,v])=>[k,count(v)])),...Object.fromEntries(Object.keys(professionItems).map(id=>[id,count(r.stats?.[id])])),x:number(r.world_position?.x),z:number(r.world_position?.y),hp:Math.min(Math.max(100,count(r.max_health)),count(r.health??100)),combatXP:count(r.xp),kills:count(r.stats?.kills),gold:count(r.gold),fishingPole:count(r.stats?.fishingPole),fishingNet:count(r.stats?.fishingNet),bait:count(r.stats?.bait),rawFish:count(r.stats?.rawFish),wood:count(r.stats?.wood),ore:count(r.stats?.ore),woodXP:xpValue(r.stats?.woodXP),miningXP:xpValue(r.stats?.miningXP),level:Math.max(1,count(r.level)),
 armorOwned:list(r.inventory?.armorOwned),weaponsOwned:list(r.inventory?.weaponsOwned),shieldsOwned:list(r.inventory?.shieldsOwned),jewelryOwned:list(r.inventory?.jewelryOwned),mountsOwned:list(r.inventory?.mountsOwned),equippedMount,bank:object(r.inventory?.bank),amulet,trinket,equipped:equipment,equippedWeapon:weapon,equippedShield:shield,
 ...Object.fromEntries(skillKeys.map(key=>[key,xpValue(skills[key])])),appearance:r.game_flags?.appearance||null,starterChestClaimed:!!r.game_flags?.starterChestClaimed,starterShieldsGranted:!!r.game_flags?.starterShieldsGranted,starterJewelryGranted:!!r.game_flags?.starterJewelryGranted,starterDaggerGranted:!!r.game_flags?.starterDaggerGranted,starterBattleaxeGranted:!!r.game_flags?.starterBattleaxeGranted,runEnergy:Math.max(0,Math.min(100,number(r.game_flags?.runEnergy,100))),
 worldReceipts:Array.isArray(r.game_flags?.worldReceipts)?r.game_flags.worldReceipts:[],quests:r.quests??{},_cloud:Object.fromEntries(['world_position','stats','inventory','equipment','skills','quests','game_flags'].map(key=>[key,object(r[key])]))};
}
