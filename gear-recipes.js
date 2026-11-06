// Gear-tier materials and recipes: smithing (bars, arrowtips, weapons, plate and
// shields per metal tier), fletching (tiered arrows, wood shortbows) and the
// Eldervale names for the higher-tier ores and bars. profession-data.js calls
// registerGearProfessions() once, after its own items and recipes.
import {GEAR_TIERS,tierById,WEAPON_TEMPLATES,SHIELD_TEMPLATES,PLATE_PIECES,PLATE_SMITH,PLATE_NAMES,ARROWS,tierItemKey} from './gear-tiers.js?v=release-20261106-fix98';
// Higher-tier ore and bar ids predate the tiers; their display names follow the tier metals.
export const METAL_NAMES={mithrilOre:'Moonsilver ore',adamantOre:'Verdite ore',runiteOre:'Tidestone ore',mithrilBar:'Moonsilver bar',adamantBar:'Verdite bar',runiteBar:'Tidesteel bar',mithrilFittings:'Moonsilver fittings',adamantFittings:'Verdite fittings',runiteFittings:'Tidesteel fittings'};
const RECIPE_NAMES={mine_mithrilOre:'Mine moonsilver ore',mine_adamantOre:'Mine verdite ore',mine_runiteOre:'Mine tidestone ore',smelt_mithrilBar:'Smelt moonsilver bar',smelt_adamantBar:'Smelt verdite bar',smelt_runiteBar:'Smelt tidesteel bar',forge_mithril_fittings:'Forge moonsilver fittings',forge_adamant_fittings:'Forge verdite fittings',forge_runite_fittings:'Forge tidesteel fittings'};
const ARROW_PRICE={bronze:4,iron:7,steel:14,moonsilver:32,verdite:80,tidesteel:200,embersteel:600};
const FLETCH_XP={bronze:20,iron:38,steel:75,moonsilver:113,verdite:150,tidesteel:188,embersteel:225};
// Plate pieces of the iron and blacksteel tiers are the existing knight colour variants.
const LEGACY_IRON={Armet:'helm',Breastplate:'chest',Greaves:'legs',Sabatons:'boots'};
export function plateKey(tier,piece){if(tier==='iron')return LEGACY_IRON[piece]||'knight'+piece+'1';if(tier==='blacksteel')return 'knight'+piece+'3';return tierItemKey(tier,piece)}
export const weaponKey=(tier,piece)=>tier==='iron'?piece:tierItemKey(tier,piece);
export const shieldKey=(tier,piece)=>tier==='iron'?piece:tierItemKey(tier,piece==='square'?'heaterShield':'kiteshield');
export const arrowtipsId=tier=>tier==='iron'?'arrowTips':tier+'Arrowtips';
export const SHORTBOWS=[['oakShortbow','oakLogs',20,33],['willowShortbow','willowLogs',35,66],['mapleShortbow','mapleLogs',50,100],['yewShortbow','yewLogs',65,135]];

export function registerGearProfessions(items,recipes){
 const item=(id,d)=>{items[id]={stackable:false,profession:true,sell:Math.max(1,Math.floor(d.buy*.3)),...d}};
 for(const [id,name] of Object.entries(METAL_NAMES))if(items[id])items[id].name=name;
 for(const [id,name] of Object.entries(RECIPE_NAMES))if(recipes[id])recipes[id].name=name;
 item('blacksteelBar',{name:'Blacksteel bar',model:'bar',category:'Bars',buy:60,color:0x3a3d45});
 for(const [id,a] of Object.entries(ARROWS)){const t=tierById[a.tier];
  if(id!=='arrows')item(id,{name:t.name+' arrows',model:'arrows',category:'Trade goods',buy:ARROW_PRICE[a.tier],stackable:true,color:t.color,description:'Ammunition: ranged strength +'+a.rstr+'.'});
  else items.arrows.description='Ammunition: ranged strength +'+a.rstr+'.';
  if(a.tier!=='iron')item(arrowtipsId(a.tier),{name:t.name+' arrowtips',model:'tips',category:'Materials',buy:Math.max(2,Math.round(ARROW_PRICE[a.tier]*.6)),stackable:true,color:t.color});
 }
 const recipe=(id,d)=>{recipes[id]={seconds:3,enabled:true,kind:'process',tools:[],station:null,...d}};
 recipe('smelt_blacksteelBar',{name:'Smelt blacksteel bar',skill:'smithing',level:40,xp:20,inputs:{ore:1,coal:3},outputs:{blacksteelBar:1},station:'furnace'});
 const made=new Set(Object.values(recipes).flatMap(r=>Object.keys(r.outputs||{})));
 const smith=(output,name,tier,bars,off)=>{if(made.has(output))return;made.add(output);recipe('smith_'+output.replace(':','_'),{name,skill:'smithing',level:Math.min(99,tier.smith+off),xp:Math.round(tier.xp*bars),inputs:{[tier.bar]:bars},outputs:{[output]:1},tools:['hammer'],station:'anvil'})};
 for(const tier of GEAR_TIERS){if(!tier.smith)continue;
  for(const [piece,t] of Object.entries(WEAPON_TEMPLATES))smith('weapon:'+weaponKey(tier.id,piece),'Smith '+tier.name.toLowerCase()+' '+t.label,tier,t.bars,t.off);
  for(const [piece,t] of Object.entries(SHIELD_TEMPLATES))smith('shield:'+shieldKey(tier.id,piece),'Smith '+tier.name.toLowerCase()+' '+t.label,tier,t.bars,t.off);
  for(const piece of Object.keys(PLATE_PIECES))smith('armor:'+plateKey(tier.id,piece),'Smith '+tier.name.toLowerCase()+' '+PLATE_NAMES[piece],tier,PLATE_SMITH[piece].bars,PLATE_SMITH[piece].off);
  const a=Object.entries(ARROWS).find(([,v])=>v.tier===tier.id);
  if(a&&tier.id!=='iron')recipe('smith_'+arrowtipsId(tier.id),{name:'Forge '+tier.name.toLowerCase()+' arrowtips',skill:'smithing',level:Math.min(99,tier.smith+5),xp:Math.round(tier.xp),inputs:{[tier.bar]:1},outputs:{[arrowtipsId(tier.id)]:15},tools:['hammer'],station:'anvil'});
 }
 for(const [id,a] of Object.entries(ARROWS))if(id!=='arrows')recipe('fletch_'+id,{name:'Fit '+tierById[a.tier].name.toLowerCase()+' arrowtips',skill:'fletching',level:tierById[a.tier].fletch,xp:FLETCH_XP[a.tier],inputs:{headlessArrows:15,[arrowtipsId(a.tier)]:15},outputs:{[id]:15}});
 for(const [key,logs,level,xp] of SHORTBOWS)recipe('fletch_'+key,{name:'Fletch '+key.replace(/([A-Z])/g,' $1').toLowerCase(),skill:'fletching',level,xp,inputs:{[logs]:1,bowString:1},outputs:{['weapon:'+key]:1},tools:['knife']});
}
