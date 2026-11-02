export const FACES=['Balanced','Angular','Broad'];
export const BEARDS=['Clean shaven','Stubble','Short beard'];
export const SKINS=['#f2c9a4','#d9a67e','#b97f58','#945d3f','#6c412f','#402a24'];
export const HAIRS=['#211b18','#5b3c28','#9b6337','#d3ae65','#c0b5a3','#763b32'];
export const SHIRTS=['#297e52','#356b9b','#9c403c','#d6b46d','#564b84','#292d30'];
export const PANTS=['#232327','#43516b','#6b513e','#78806c','#353c37','#8d8b84'];
export const HAIRSTYLES=['Short crop','Side swept','Spiky','Buzz cut','Long'];
export const appearanceDefaults={skin:SKINS[1],hairColor:HAIRS[1],shirt:SHIRTS[0],pants:PANTS[0],hair:'Side swept',face:'Balanced',beard:'Clean shaven'};
export function safeAppearance(a={}){if(!a||typeof a!=='object'||Array.isArray(a))a={};const o={...appearanceDefaults};for(const [key,palette] of [['skin',SKINS],['hairColor',HAIRS],['shirt',SHIRTS],['pants',PANTS]])if(palette.includes(a[key]))o[key]=a[key];if(HAIRSTYLES.includes(a.hair))o.hair=a.hair;if(FACES.includes(a.face))o.face=a.face;if(BEARDS.includes(a.beard))o.beard=a.beard;return o}
