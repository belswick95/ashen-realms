import {GEAR_TIERS,PLATE_TIERS,PLATE_PIECES,PLATE_NAMES,TIER_PRICE,tierById,tierItemKey,outfitGear} from './gear-tiers.js?v=release-20261107-monsters131';
import {UNIQUE_ITEMS} from './unique-gear.js?v=release-20261107-monsters131';
// Wearable outfit items built from Quaternius' Modular Character Outfits -
// Fantasy (CC0). One item works for both bodies: each piece names its male and
// female part. Item keys are what saves, the server catalog and equipment use.
//
// Slots: helm, shoulders, neck, chest, arms, legs, boots (+ the existing cape).
export const OUTFIT_SLOTS=['helm','shoulders','neck','chest','arms','legs','boots'];
export const SLOT_LABELS={helm:'Head',shoulders:'Shoulders',neck:'Neck',chest:'Body',arms:'Arms',legs:'Legs',boots:'Feet',cape:'Back'};
// Body regions every character always covers; unarmoured regions show the
// player's own clothes (the peasant pieces in their chosen colours).
export const BODY_SLOTS=['chest','arms','legs','boots'];

const V=(name,stats)=>({name,stats});
// Colour variants of each outfit (texture 1..3). Knight colours are metal tiers.
export const OUTFIT_VARIANTS={
 knight:[V('Iron',1),V('Gilded',2.2),V('Blacksteel',1.6)],
 noble:[V('Crimson',1),V('Royal blue',1),V('Emerald',1)],
 peasant:[V('Brown',1),V('Charcoal',1),V('Blue',1)],
 ranger:[V('Forest',1),V('Shadow',1.15),V('Hunter',1)],
 wizard:[V('Blue',1),V('Violet',1),V('Crimson',1)]
};
// piece id, display name, slot, male part, female part, defence, absorb, price, flags
const P=(id,name,slot,male,female,defence,reduction,price,flags={})=>({id,name,slot,male,female,defence,reduction,price,...flags});
export const OUTFIT_PIECES={
 knight:[
  P('Armet','armet helm','helm','Male_Knight_Head_Armet','Female_Knight_Head_Armet',4,1,60,{hidesHair:true,hidesBeard:true}),
  P('HornedHelm','horned helm','helm','Male_Knight_Head_Horns','Female_Knight_Head_Horns',5,1,80,{hidesHair:true,hidesBeard:true}),
  P('Breastplate','breastplate','chest','Male_Knight_Body_Armor','Female_Knight_Body_Armor',10,3,60),
  P('Gambeson','gambeson','chest','Male_Knight_Body_Cloth','Female_Knight_Body_Cloth',4,1,30),
  P('Gauntlets','gauntlets','arms','Male_Knight_Arms','Female_Knight_Arms',3,1,40),
  P('Greaves','greaves','legs','Male_Knight_Legs_Armor','Female_Knight_Legs',7,2,60),
  P('Sabatons','sabatons','boots','Male_Knight_Feet_Armor','Female_Knight_Feet',3,1,60),
  P('RoundPauldrons','round pauldrons','shoulders','Male_Knight_Acc_Pauldron_Round','Female_Knight_Acc_Pauldrons_Round',2,1,40),
  P('SpikedPauldrons','spiked pauldrons','shoulders','Male_Knight_Acc_Pauldron_Spike','Female_Knight_Acc_Pauldrons_Spike',3,1,55),
  P('Scarf','scarf','neck','Male_Knight_Acc_Scarf','Female_Knight_Acc_Scarf',0,0,15)
 ],
 noble:[
  P('Crown','crown','helm','Male_Noble_Head_Crown','Female_Noble_Head_Crown',1,0,250),
  P('Gorget','gorget','neck','Male_Noble_Acc_Gorget','Female_Noble_Acc_Gorget',2,1,60),
  P('Pauldron','pauldron','shoulders','Male_Noble_Acc_Pauldron','Female_Noble_Acc_Pauldron',2,1,60),
  P('LionPauldron','lion pauldron','shoulders','Male_Noble_Acc_Pauldron_Lion','Female_Noble_Acc_Pauldron_Lion',3,1,120),
  P('Coat','noble coat','chest','Male_Noble_Body','Female_Noble_Body',3,1,90),
  P('Sleeves','noble sleeves','arms','Male_Noble_Arms','Female_Noble_Arms',1,0,45),
  P('Trousers','noble trousers','legs','Male_Noble_Legs','Female_Noble_Legs',2,0,60),
  P('Boots','noble boots','boots','Male_Noble_Feet','Female_Noble_Feet',1,0,45)
 ],
 peasant:[
  P('Shirt','shirt','chest','Male_Peasant_Body','Female_Peasant_Body',0,0,8),
  P('Sleeves','sleeves','arms','Male_Peasant_Arms','Female_Peasant_Arms',0,0,5),
  P('Trousers','trousers','legs','Male_Peasant_Legs','Female_Peasant_Legs',0,0,8),
  P('Shoes','shoes','boots','Male_Peasant_Feet','Female_Peasant_Feet',0,0,6)
 ],
 ranger:[
  P('Hood','ranger hood','helm','Male_Ranger_Head_Hood','Female_Ranger_Head_Hood',2,0,35,{hidesHair:true}),
  P('Pauldron','ranger pauldron','shoulders','Male_Ranger_Acc_Pauldron','Female_Ranger_Acc_Pauldrons',1,0,25),
  P('Tunic','ranger tunic','chest','Male_Ranger_Body','Female_Ranger_Body',5,1,45),
  P('Bracers','ranger bracers','arms','Male_Ranger_Arms','Female_Ranger_Arms',2,0,30),
  P('Trousers','ranger trousers','legs','Male_Ranger_Legs','Female_Ranger_Legs',3,1,35),
  P('Boots','ranger boots','boots','Male_Ranger_Feet_Boots','Female_Ranger_Feet',2,0,30)
 ],
 wizard:[
  P('RobeTop','wizard robe top','chest','Male_Wizard_Body','Female_Wizard_Body',2,0,70),
  P('Bracers','wizard bracers','arms','Male_Wizard_Arms','Female_Wizard_Arms',1,0,35),
  P('RobeBottom','wizard robe bottom','legs','Male_Wizard_Legs','Female_Wizard_Legs',1,0,60),
  P('Boots','wizard boots','boots','Male_Wizard_Feet','Female_Wizard_Feet',1,0,35)
 ]
};
// Existing iron armour keys become the iron knight pieces, so saves keep working.
const LEGACY={'knight:Armet:1':'helm','knight:Breastplate:1':'chest','knight:Greaves:1':'legs','knight:Sabatons:1':'boots'};

const cap=s=>s.charAt(0).toUpperCase()+s.slice(1);
export const outfitItems={};
for(const [outfit,pieces] of Object.entries(OUTFIT_PIECES))for(const piece of pieces)OUTFIT_VARIANTS[outfit].forEach((variant,i)=>{
 const v=i+1,key=LEGACY[`${outfit}:${piece.id}:${v}`]||`${outfit}${piece.id}${v}`;
 const name=(outfit==='knight'?variant.name+' '+piece.name:variant.name+' '+piece.name).replace(/^(.)/,c=>c.toUpperCase());
 outfitItems[key]={key,outfit,variant:v,piece:piece.id,slot:piece.slot,name,male:piece.male,female:piece.female,
  defence:Math.round(piece.defence*variant.stats),reduction:Math.round(piece.reduction*variant.stats),
  buy:Math.round(piece.price*variant.stats),sell:Math.round(piece.price*variant.stats*.3),
  hidesHair:!!piece.hidesHair,hidesBeard:!!piece.hidesBeard,
  desc:`${cap(outfit)} outfit · ${variant.name.toLowerCase()} ${piece.name}.`};
});
// Metal tiers without their own texture (gear-tiers.js): the iron knight pieces,
// recoloured. Keys are <tier><Piece>, e.g. moonsilverBreastplate.
for(const tier of PLATE_TIERS)for(const piece of OUTFIT_PIECES.knight)if(PLATE_PIECES[piece.id]){
 const t=tierById[tier],key=tierItemKey(tier,piece.id),price=Math.round(piece.price*TIER_PRICE[tier]);
 outfitItems[key]={key,outfit:'knight',variant:1,tier,tint:t.color,piece:piece.id,slot:piece.slot,name:t.name+' '+PLATE_NAMES[piece.id],male:piece.male,female:piece.female,
  defence:Math.max(1,Math.round(piece.defence*(.4+t.armour))),reduction:Math.max(0,Math.round(piece.reduction*(.4+t.armour))),buy:price,sell:Math.round(price*.3),
  hidesHair:!!piece.hidesHair,hidesBeard:!!piece.hidesBeard,desc:`Knight outfit · ${t.name.toLowerCase()} ${PLATE_NAMES[piece.id]}.`};
}
// OSRS-style equipment bonuses and level requirements for every outfit item.
// The blacksteel colour variant's metal also takes the blacksteel tier colour.
for(const item of Object.values(outfitItems))if(item.outfit==='knight'&&item.variant===3&&PLATE_PIECES[item.piece])item.tint=tierById.blacksteel.color;
for(const item of Object.values(outfitItems)){const g=outfitGear(item);item.bonuses=g.bonuses;item.req=g.req;if(g.tier&&!item.tier)item.tier=g.tier}
// Unique armour (unique-gear.js): an existing piece's model, recoloured, with its own stats and an accent glow.
for(const u of UNIQUE_ITEMS)if(u.kind==='armor'&&outfitItems[u.base]&&!outfitItems[u.id]){const b=outfitItems[u.base];
 outfitItems[u.id]={...b,key:u.id,tier:'unique',unique:true,tint:u.tint,look:{accent:u.accent?.color??null,mode:u.tintMode||'metal'},accent:u.accent,name:u.name,desc:u.desc,bonuses:{...u.bonuses},req:{...(u.req||{})},
  defence:Math.max(1,Math.round((u.bonuses.dstab+u.bonuses.dslash+u.bonuses.dcrush)/30)),buy:u.value,sell:Math.round(u.value*.3),tradeable:u.tradeable,quest:u.quest,shopless:true}}
export function outfitPartFor(key,sex){const item=outfitItems[key];return item?item[sex==='female'?'female':'male']:null}
// Default clothing for unarmoured body regions, in the player's chosen colours.
export function defaultClothing(look={}){const shirt=Math.max(1,Math.min(3,Number(look.shirtVariant)||1)),pants=Math.max(1,Math.min(3,Number(look.pantsVariant)||1));return {chest:`peasantShirt${shirt}`,arms:`peasantSleeves${shirt}`,legs:`peasantTrousers${pants}`,boots:`peasantShoes${pants}`}}
// Resolve worn armour flags ({key:true}) to one item per slot.
export function wornOutfit(equipped={},look={}){
 const worn={...defaultClothing(look)};
 for(const [key,on] of Object.entries(equipped||{}))if(on===true&&outfitItems[key])worn[outfitItems[key].slot]=key;
 return worn;
}
