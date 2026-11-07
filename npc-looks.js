import {SKINS,HAIRS} from './appearance.js?v=release-20261107-music156';
import {outfitItems} from './outfits.js?v=release-20261107-music156';
// Deterministic NPC appearance: body, hair, skin and an outfit that matches
// the NPC's job, varied by index so towns are not full of identical people.
const pick=(list,i)=>list[((i%list.length)+list.length)%list.length];
const set=(outfit,variant,pieces)=>Object.fromEntries(Object.values(outfitItems).filter(o=>o.outfit===outfit&&o.variant===variant&&pieces.includes(o.piece)).map(o=>[o.key,true]));
export const OUTFIT_FAMILIES={none:[],peasant:['Shirt','Sleeves','Trousers','Shoes'],knight:['Breastplate','Gauntlets','Greaves','Sabatons','RoundPauldrons'],wizard:['RobeTop','Bracers','RobeBottom','Boots'],noble:['Coat','Sleeves','Trousers','Boots'],ranger:['Tunic','Bracers','Trousers','Boots','Hood']};
export function npcAppearance(profile={},index=0){
 const role=String(profile.role||'')+' '+String(profile.name||'');
 const sex=index%3===1?'female':'male';
 const look={sex,skin:pick(SKINS,index*7+2),hairColor:pick(HAIRS,index*5+1),
  hair:sex==='female'?pick(['Long','Buns','Cropped'],index):pick(['Short parted','Buzz cut','Long','Short parted'],index),
  beard:sex==='male'?pick(['Short beard','Clean shaven','Short beard','Clean shaven'],index):'Clean shaven',
  shirtVariant:1+index%3,pantsVariant:1+(index+1)%3};
 let equipped={},armed=false,staff=null;
 if(/guard|warden|sentinel|soldier|knight/i.test(role)){equipped=set('knight',profile.whiteArmor?1:pick([1,1,3],index),['Breastplate','Gauntlets','Greaves','Sabatons',index%2?'RoundPauldrons':'SpikedPauldrons',...(index%3===0?['Armet']:[])]);armed=true}
 else if(/mage|wizard|healer|alchemist|sage/i.test(role)){const v=pick([1,2,3],index);equipped=set('wizard',v,['RobeTop','Bracers','RobeBottom','Boots']);staff=['sapphireStaff','amethystStaff','emberStaff'][v-1]}
 else if(/banker|steward|noble|lord|lady|mayor|king|queen/i.test(role))equipped=set('noble',pick([1,2,3],index),['Coat','Sleeves','Trousers','Boots',...(index%2?['Gorget']:[]),...(/\bking\b|\bqueen\b/i.test(role)?['Crown','LionPauldron']:[])]);
 else if(/ranger|hunter|scout|archer|trapper/i.test(role))equipped=set('ranger',pick([1,2,3],index),['Tunic','Bracers','Trousers','Boots',...(index%2?['Hood']:['Pauldron'])]);
 else if(/smith|forge/i.test(role))equipped=set('knight',3,['Gambeson','Gauntlets']);
 // Owner overrides from the World console: body/face fields and an explicit outfit family.
 const custom=profile.look&&typeof profile.look==='object'?profile.look:{};
 for(const k of ['sex','skin','hair','hairColor','beard'])if(typeof custom[k]==='string'&&custom[k])look[k]=custom[k];if(custom.sex==='female'&&!custom.beard)look.beard='Clean shaven';
 const family=custom.outfit||profile.outfit;
 if(family&&family!=='auto'&&OUTFIT_FAMILIES[family]){const v=Math.max(1,Math.min(3,Number(custom.outfitVariant||profile.outfitVariant)||1));equipped=family==='none'?{}:set(family,v,OUTFIT_FAMILIES[family]);if(family!=='knight')armed=false;staff=family==='wizard'?['sapphireStaff','amethystStaff','emberStaff'][v-1]:null;}
 // Wizards carry the staff matching their robe (blue, violet, crimson).
 return {look,equipped,armed,staff};
}
