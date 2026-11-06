// Fishing tiers added with the new water (water-data.js): original fish for every OSRS-style method
// band (net, bait, lure/fly, cage, harpoon, big net, deep bait). The first ladder (food.js
// foodLadder/fishTable) is unchanged; this extends it. Server twin: fish_table() and the catalog
// rows in db/water-1-fishing.sql (tests/water-fishing.test.js keeps both in step).
import {fishTable,fishingMethods,foodLadder,foodItems} from './food.js?v=release-20261106-fix113';
import {skillingChance} from './combat-level.js?v=release-20261106-fix113';
import {fishingItems} from './fishing.js?v=release-20261106-fix113';
import {SPOT_TYPES} from './water-data.js?v=release-20261106-fix113';
// low/high: OSRS-style catch chances out of 256 at Fishing 1 and 99.
export const extraFish=[
 {id:'mudperch',name:'Cooked mudperch',healPct:32,buy:16,model:'fish',color:0x9a8c6c,raw:{id:'rawMudperch',name:'Raw mudperch',method:'rod',fishLevel:10,fishXp:30,color:0x7e8a6a,low:24,high:128},cookLevel:5,cookXp:50,burn:.18,stopBurn:38},
 {id:'silverbait',name:'Cooked silverbait',healPct:30,buy:15,model:'shrimp',color:0xc8c2b4,raw:{id:'rawSilverbait',name:'Raw silverbait',method:'net',fishLevel:15,fishXp:40,color:0xb9c4c6,low:24,high:128},cookLevel:1,cookXp:30,burn:.15,stopBurn:34},
 {id:'stripedMackerel',name:'Cooked striped mackerel',healPct:34,buy:20,model:'fish',color:0x8f9b93,raw:{id:'rawStripedMackerel',name:'Raw striped mackerel',method:'bignet',fishLevel:16,fishXp:20,color:0x5f8a8f,low:5,high:65},cookLevel:10,cookXp:60,burn:.2,stopBurn:45},
 {id:'coastCod',name:'Cooked coast cod',healPct:44,buy:30,model:'fish',color:0xcab598,raw:{id:'rawCoastCod',name:'Raw coast cod',method:'bignet',fishLevel:23,fishXp:45,color:0x8c9a86,low:4,high:55},cookLevel:18,cookXp:75,burn:.22,stopBurn:52},
 {id:'reedpike',name:'Cooked reedpike',healPct:46,buy:32,model:'fish',color:0xb39a76,raw:{id:'rawReedpike',name:'Raw reedpike',method:'rod',fishLevel:25,fishXp:60,color:0x6f7c58,low:16,high:96},cookLevel:20,cookXp:80,burn:.22,stopBurn:59},
 {id:'brightfin',name:'Cooked brightfin',healPct:52,buy:44,model:'swordfish',color:0xb8826e,raw:{id:'rawBrightfin',name:'Raw brightfin',method:'harpoon',fishLevel:35,fishXp:80,color:0x4f7393,low:8,high:64},cookLevel:30,cookXp:100,burn:.25,stopBurn:64},
 {id:'rainbowfin',name:'Cooked rainbowfin',healPct:55,buy:48,model:'salmon',color:0xc7907c,raw:{id:'rawRainbowfin',name:'Raw rainbowfin',method:'fly',fishLevel:38,fishXp:80,color:0x9fae9a,low:8,high:64},cookLevel:35,cookXp:110,burn:.26,stopBurn:70},
 {id:'stoneBass',name:'Cooked stone bass',healPct:64,buy:80,model:'fish',color:0xa0907e,raw:{id:'rawStoneBass',name:'Raw stone bass',method:'bignet',fishLevel:46,fishXp:100,color:0x5c6466,low:3,high:40},cookLevel:43,cookXp:130,burn:.3,stopBurn:80},
 {id:'deepglowAngler',name:'Cooked deepglow angler',healPct:85,buy:220,model:'stormfin',color:0x6f6a7e,raw:{id:'rawDeepglowAngler',name:'Raw deepglow angler',method:'rod',fishLevel:82,fishXp:120,color:0x3c3f5a,low:2,high:28},cookLevel:84,cookXp:230,burn:.38,stopBurn:99}
];
// Lure/fly fishing also catches the river trout and salmon of the first ladder.
export const extraFishTable=[
 {item:'rawTrout',method:'fly',level:20,xp:50,low:32,high:192},{item:'rawSalmon',method:'fly',level:30,xp:70,low:16,high:96},
 ...extraFish.map(f=>({item:f.raw.id,method:f.raw.method,level:f.raw.fishLevel,xp:f.raw.fishXp,low:f.raw.low,high:f.raw.high}))
].sort((a,b)=>a.level-b.level||a.item.localeCompare(b.item));
export const fullFishTable=[...fishTable,...extraFishTable];
export const extraMethods={fly:{label:'Lure',tool:'flyRod',bait:'feathers',level:20,seconds:3},bignet:{label:'Big net',tool:'bigNet',level:16,seconds:5.4}};
export const allMethods={...fishingMethods,...extraMethods};
// Fish a spot can give: its type's list (a spot without a type keeps every fish).
// A spot without a type (the first 25) keeps the first ladder and its four methods.
export const LEGACY_CATCHES=fishTable.map(f=>f.item),LEGACY_METHODS=['net','rod','cage','harpoon'];
export function spotCatches(spot={}){const t=SPOT_TYPES[spot.spotType];return Array.isArray(spot.catches)?spot.catches:t?t.catches:LEGACY_CATCHES}
export function spotMethods(spot={}){const t=SPOT_TYPES[spot.spotType];return t?t.methods:LEGACY_METHODS}
// One OSRS fishing roll at a spot: best fish first, each with its own level-scaled chance.
export function fishCatchAt(spot,method,level,random=Math.random){const allow=spotCatches(spot);const tiers=fullFishTable.filter(f=>f.method===method&&f.level<=level&&allow.includes(f.item)).sort((a,b)=>b.level-a.level);if(!tiers.length)return null;for(const f of tiers)if(random()<skillingChance(f.low,f.high,level))return f;return {}}
const food=(name,model,buy,extra)=>({name,model,buy,sell:Math.max(1,Math.floor(buy*.3)),stackable:false,category:'Food',...extra});
const methodLabel=m=>(allMethods[m]?.label||m).toLowerCase();
export const extraFishItems={};
for(const f of extraFish){extraFishItems[f.id]=food(f.name,f.model,f.buy,{heal:f.healPct,healPct:f.healPct,color:f.color,description:'Heals '+f.healPct+'% of your maximum HP. Cooking '+f.cookLevel+'.'});
 extraFishItems[f.raw.id]={name:f.raw.name,model:f.model==='salmon'?'fish':f.model,buy:Math.max(4,Math.floor(f.buy*.6)),sell:Math.max(1,Math.floor(f.buy*.25)),stackable:false,category:'Ingredients',color:f.raw.color,description:'Fishing '+f.raw.fishLevel+' ('+methodLabel(f.raw.method)+'). Cook it (Cooking '+f.cookLevel+') before eating.'}}
export const extraFishRecipes=Object.fromEntries(extraFish.map(f=>['cook_'+f.id,{name:'Cook '+f.name.replace('Cooked ','').toLowerCase(),skill:'cooking',level:f.cookLevel,xp:f.cookXp,inputs:{[f.raw.id]:1},outputs:{[f.id]:1},tools:[],station:'cooking',seconds:3,enabled:true,kind:'process',burnChance:f.burn,stopBurn:f.stopBurn}]));
export const allFoodLadder=[...foodLadder,...extraFish];
// Right-click menu of a fishing spot: one row per method the spot takes, best tier first.
const BAIT={rod:'bait',fly:'feathers'};
export function fishingOptions(spot,{have=()=>false,level=1}={}){
 const allow=spotCatches(spot);
 return spotMethods(spot).map(m=>{const def=allMethods[m]||{label:m},fish=fullFishTable.filter(f=>f.method===m&&allow.includes(f.item)).sort((a,b)=>a.level-b.level);
  const names=fish.map(f=>((foodItems[f.item]||extraFishItems[f.item]||fishingItems[f.item])?.name||f.item).replace(/^Raw (river )?/,'river ').replace(/^river (?!fish)/,'')),min=fish.length?fish[0].level:def.level||1;
  return {method:m,label:def.label+' ('+(names.join(', ')||'nothing here')+(min>1?' · Fishing '+min:'')+')',level:min,usable:!!fish.length&&have(def.tool)&&level>=min&&(!BAIT[m]||have(BAIT[m]))}})
  .sort((a,b)=>b.level-a.level);
}
