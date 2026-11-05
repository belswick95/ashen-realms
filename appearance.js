// Character creation choices. Saved appearances from older versions are
// mapped onto these, so no existing character is reset.
export const SEXES=['male','female'];
export const BEARDS=['Clean shaven','Beard'];
export const SKINS=['#f2c9a4','#d9a67e','#b97f58','#945d3f','#6c412f','#402a24'];
export const HAIRS=['#211b18','#5b3c28','#9b6337','#d3ae65','#c0b5a3','#763b32'];
// Clothing colours are the three dyes of the starter (peasant) outfit.
export const CLOTHING_VARIANTS=[1,2,3];
export const CLOTHING_LABELS={1:'Brown',2:'Charcoal',3:'Blue'};
export const HAIRSTYLES=['Short parted','Buzz cut','Cropped','Long','Buns','Bald'];
// Older saves: retired hairstyle and beard names → closest current choice.
const LEGACY_HAIR={'Short crop':'Short parted','Side swept':'Short parted','Spiky':'Buzz cut','Curly':'Short parted','Mohawk':'Buzz cut','Ponytail':'Buns'};
const LEGACY_BEARD={Stubble:'Beard','Short beard':'Beard','Full beard':'Beard',Goatee:'Beard',Moustache:'Beard'};
export const appearanceDefaults={sex:'male',skin:SKINS[1],hairColor:HAIRS[1],hair:'Short parted',beard:'Clean shaven',shirtVariant:1,pantsVariant:1};
export function safeAppearance(a={}){
 if(!a||typeof a!=='object'||Array.isArray(a))a={};const o={...appearanceDefaults};
 if(SEXES.includes(a.sex))o.sex=a.sex;
 for(const [key,palette] of [['skin',SKINS],['hairColor',HAIRS]])if(palette.includes(a[key]))o[key]=a[key];
 const hair=LEGACY_HAIR[a.hair]||a.hair;if(HAIRSTYLES.includes(hair))o.hair=hair;else if(o.sex==='female')o.hair='Long';
 const beard=LEGACY_BEARD[a.beard]||a.beard;if(BEARDS.includes(beard)&&o.sex==='male')o.beard=beard;
 for(const key of ['shirtVariant','pantsVariant'])if(CLOTHING_VARIANTS.includes(Number(a[key])))o[key]=Number(a[key]);
 return o;
}
