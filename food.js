// RuneScape-style food ladder. Each food heals a share of the eater's maximum
// HP (10 × Hitpoints level), never past it; `heal` is the flat amount at the
// starting 100 HP, which the server also treats as a minimum. Fish come from
// Fishing (net, bait rod, lobster pot, harpoon) and are cooked at a fire or range.
// Mirrors eldervale_private.fish_table / food healing in db/osrs-skills-and-food.sql.
export const EAT_DELAY=1.8,EAT_ANIMATION=1.1;
export const foodLadder=[
 {id:'sundae',name:'Sundae',healPct:25,buy:12,model:'sundae',color:0xf1d7c4,source:'shop'},
 {id:'shrimp',name:'Cooked shrimp',healPct:30,buy:14,model:'shrimp',raw:{id:'rawShrimp',name:'Raw shrimp',method:'net',fishLevel:1,fishXp:10,color:0x9a9e95},cookLevel:1,cookXp:30,burn:.15},
 {id:'trout',name:'Cooked trout',healPct:40,buy:24,model:'fish',color:0xb98a64,raw:{id:'rawTrout',name:'Raw trout',method:'rod',fishLevel:20,fishXp:50,color:0x8fa28b},cookLevel:15,cookXp:70,burn:.2},
 {id:'salmon',name:'Cooked salmon',healPct:50,buy:36,model:'salmon',color:0xb7868b,raw:{id:'rawSalmon',name:'Raw salmon',method:'rod',fishLevel:30,fishXp:70,color:0xa7b4b8},cookLevel:25,cookXp:90,burn:.22},
 {id:'lobster',name:'Cooked lobster',healPct:60,buy:60,model:'lobster',color:0xb85843,raw:{id:'rawLobster',name:'Raw lobster',method:'cage',fishLevel:40,fishXp:90,color:0x3f5a63},cookLevel:40,cookXp:120,burn:.28},
 {id:'swordfish',name:'Cooked swordfish',healPct:68,buy:95,model:'swordfish',color:0xa49a8e,raw:{id:'rawSwordfish',name:'Raw swordfish',method:'harpoon',fishLevel:50,fishXp:100,color:0x6f8ea6},cookLevel:45,cookXp:140,burn:.3},
 {id:'stormfin',name:'Cooked stormfin',healPct:78,buy:160,model:'stormfin',color:0x8d8476,raw:{id:'rawStormfin',name:'Raw stormfin',method:'harpoon',fishLevel:76,fishXp:110,color:0x56636f},cookLevel:80,cookXp:210,burn:.36}
];
// What each fishing method can catch (the river fish predates the ladder; it stays a bait catch).
export const fishTable=[
 {item:'rawShrimp',method:'net',level:1,xp:10},
 {item:'rawFish',method:'rod',level:1,xp:25},
 {item:'rawTrout',method:'rod',level:20,xp:50},
 {item:'rawSalmon',method:'rod',level:30,xp:70},
 {item:'rawLobster',method:'cage',level:40,xp:90},
 {item:'rawSwordfish',method:'harpoon',level:50,xp:100},
 {item:'rawStormfin',method:'harpoon',level:76,xp:110}
];
export const fishingMethods={net:{label:'Net',tool:'fishingNet',level:1,seconds:4.5},rod:{label:'Bait',tool:'fishingPole',level:1,seconds:4},cage:{label:'Cage',tool:'lobsterPot',level:40,seconds:5},harpoon:{label:'Harpoon',tool:'harpoon',level:50,seconds:5.4}};
// The best fish the player qualifies for is caught 55% of the time; otherwise the
// roll falls through to the next tier down. `roll` is uniform in [0, 1).
export function fishCatch(method,level,roll=Math.random()){const tiers=fishTable.filter(f=>f.method===method&&f.level<=level).sort((a,b)=>b.level-a.level);if(!tiers.length)return null;let r=Math.max(0,Math.min(.999999,roll));for(let i=0;i<tiers.length;i++){if(i===tiers.length-1||r<.55)return tiers[i];r=(r-.55)/.45}}
// Healing on the server: the larger of the flat amount and the share of max HP, capped at max HP.
export function healAmount(item={},maxHp=100,hp=0){const heal=Math.max(Math.floor(Number(item.heal)||0),Math.ceil(Math.max(0,Number(maxHp)||0)*(Number(item.healPct)||0)/100));return Math.max(0,Math.min(heal,Math.max(0,maxHp-hp)))}
export const isFood=item=>!!item&&!item.noteOf&&((Number(item.heal)||0)>0||(Number(item.healPct)||0)>0);
const food=(name,model,buy,extra)=>({name,model,buy,sell:Math.max(1,Math.floor(buy*.3)),stackable:false,category:'Food',...extra});
// Catalog entries (cooked food and raw fish) merged into the client goods.
export const foodItems={};
for(const f of foodLadder){foodItems[f.id]=food(f.name,f.model,f.buy,{heal:f.healPct,healPct:f.healPct,...(f.color?{color:f.color}:{}),description:'Heals '+f.healPct+'% of your maximum HP.'+(f.cookLevel?' Cooking '+f.cookLevel+'.':'')});
 if(f.raw)foodItems[f.raw.id]={name:f.raw.name,model:f.model==='salmon'?'fish':f.model,buy:Math.max(4,Math.floor(f.buy*.6)),sell:Math.max(1,Math.floor(f.buy*.25)),stackable:false,category:'Ingredients',color:f.raw.color,description:'Fishing '+f.raw.fishLevel+' ('+fishingMethods[f.raw.method].label.toLowerCase()+'). Cook it (Cooking '+f.cookLevel+') before eating.'}}
// Cooking recipes for the ladder: profession-data.js adds them beside the other recipes.
export const foodRecipes=Object.fromEntries(foodLadder.filter(f=>f.raw).map(f=>['cook_'+f.id,{name:'Cook '+f.name.replace('Cooked ','').toLowerCase(),skill:'cooking',level:f.cookLevel,xp:f.cookXp,inputs:{[f.raw.id]:1},outputs:{[f.id]:1},tools:[],station:'cooking',seconds:3,enabled:true,kind:'process',burnChance:f.burn}]));
