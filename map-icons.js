// Map icons: what is worth a marker on the world map and minimap (mines, tiered trees, fishing
// spots, skilling stations, banks and shops, caves, boss lairs, dragons, training areas, agility
// shortcuts, boats), how nearby nodes merge into one marker ("Copper & tin mine"), the tooltip
// text with the level requirement or range, and the small original glyphs that draw them.
//
// Everything here is pure data and canvas drawing (no Three.js): world-map.js and the minimap in
// game.js draw the sprites, admin-map-markers.js lists the markers for the owner, and the tests
// check the category mapping and the clustering. Markers come from data the client already has:
// world entity rows, town buildings, underground / lair areas (entrances, spawns, bosses), the
// roster spawn plan, agility shortcuts, fishing spots and exploration entrances.
import {oreResources} from './profession-data.js?v=release-20261107-polish150';
import {fullFishTable,LEGACY_CATCHES} from './fish-tiers.js?v=release-20261107-polish150';
import {SPOT_TYPES} from './water-data.js?v=release-20261107-polish150';

// ------------------------------------------------------------------------------- categories
// group: legend section; prio: who wins when two icons would overlap; color: badge colour
// (resource markers are tinted by their best tier instead); zoom: drawn at the fit-whole-world
// zoom (1) or only once zoomed in a little (minor services and stations).
export const MARKER_GROUPS=[['combat','Combat'],['skills','Skilling'],['services','Services'],['travel','Travel'],['places','Places']];
export const MARKER_CATS={
 boss:{label:'Boss',plural:'Bosses',group:'combat',prio:100,color:'#9e1b1b',zoom:1},
 dungeon:{label:'Dungeon / cave',plural:'Dungeons',group:'combat',prio:95,color:'#4a4038',zoom:1},
 dragon:{label:'Dragons',plural:'Dragon lairs',group:'combat',prio:90,color:'#5a2a6e',zoom:1},
 training:{label:'Training area',plural:'Training areas',group:'combat',prio:80,color:'#a0522d',zoom:1},
 mining:{label:'Mining',plural:'Mines',group:'skills',prio:70,color:'#6d5a48',zoom:1},
 woodcutting:{label:'Woodcutting',plural:'Tree groves',group:'skills',prio:68,color:'#3f6b2f',zoom:1},
 fishing:{label:'Fishing',plural:'Fishing spots',group:'skills',prio:66,color:'#2b7fbd',zoom:1},
 cooking:{label:'Cooking range / fire',plural:'Cooking spots',group:'skills',prio:48,color:'#b5562a',zoom:1.6},
 furnace:{label:'Furnace',plural:'Furnaces',group:'skills',prio:52,color:'#8a3b22',zoom:1.6},
 smithing:{label:'Anvil / smithy',plural:'Smithies',group:'skills',prio:50,color:'#5d636e',zoom:1.6},
 crafting:{label:'Crafting station',plural:'Crafting stations',group:'skills',prio:38,color:'#8a5a9e',zoom:1.6},
 farming:{label:'Farming & foraging',plural:'Farming patches',group:'skills',prio:36,color:'#5f8a2e',zoom:1.6},
 skill:{label:'Other skill station',plural:'Skill stations',group:'skills',prio:34,color:'#6b6f4a',zoom:1.6},
 bank:{label:'Bank',plural:'Banks',group:'services',prio:75,color:'#d6a21e',zoom:1},
 general:{label:'General store',plural:'Shops',group:'services',prio:45,color:'#3e8a4c',zoom:1.6},
 apothecary:{label:'Apothecary',plural:'Apothecaries',group:'services',prio:44,color:'#2f8a7a',zoom:1.6},
 weapons:{label:'Weapon shop',plural:'Weapon shops',group:'services',prio:43,color:'#8b2f2f',zoom:1.6},
 armour:{label:'Armour shop',plural:'Armour shops',group:'services',prio:42,color:'#4a5f86',zoom:1.6},
 inn:{label:'Inn',plural:'Inns',group:'services',prio:40,color:'#b8672e',zoom:1.6},
 altar:{label:'Altar',plural:'Altars',group:'services',prio:55,color:'#6b58b8',zoom:1.6},
 agility:{label:'Agility shortcut',plural:'Agility shortcuts',group:'travel',prio:60,color:'#3d7a6a',zoom:1},
 boat:{label:'Boat',plural:'Boats',group:'travel',prio:64,color:'#2f5f8a',zoom:1},
 teleport:{label:'Teleport',plural:'Teleports',group:'travel',prio:63,color:'#7a3fb0',zoom:1},
 exploration:{label:'Exploration',plural:'Places',group:'places',prio:30,color:'#8a6f2f',zoom:1},
 custom:{label:'Marker',plural:'Markers',group:'places',prio:99,color:'#c0392b',zoom:1}
};
// Markers within this many world units (single linkage) of another of the same kind join it.
export const LINK={mining:16,woodcutting:16,fishing:14,farming:10,cooking:5,furnace:5,smithing:5,crafting:6,skill:6,general:8,apothecary:6,weapons:6,armour:6,inn:6,bank:6,altar:6,agility:3,boat:4,teleport:4,dungeon:3,boss:4,dragon:12,training:0,exploration:0,custom:0};

// ---------------------------------------------------------------------------- tier tables
// Ores in tier order (rank) with the Mining level from the recipes and the Eldervale metal names
// players see (moonsilver, verdite, tidestone); rocks without a resource give iron ore (the
// server's default). Trees: the server's log types (tree_log_item).
const ORE_ORDER=['runeEssence','copperOre','tinOre','ore','silverOre','coal','goldOre','mithrilOre','adamantOre','runiteOre'];
const hex=n=>'#'+Number(n).toString(16).padStart(6,'0');
export const ORE_TIERS=Object.fromEntries(ORE_ORDER.map((id,rank)=>{const o=oreResources[id];
 return [id,id==='runeEssence'?{name:'Rune essence',short:'essence',level:1,color:'#b9c9d4',rank}:{name:o.name.replace(/ ore$/,''),short:o.name.replace(/ ore$/,'').toLowerCase(),level:o.level,color:hex(o.color),rank}]}));
export const TREE_TIERS={
 wood:{name:'Trees',short:'normal',level:1,color:'#4f7a35',rank:0},
 oakLogs:{name:'Oak',short:'oak',level:15,color:'#8a8f3a',rank:1},
 willowLogs:{name:'Willow',short:'willow',level:30,color:'#5f9a5a',rank:2},
 mapleLogs:{name:'Maple',short:'maple',level:45,color:'#c0672a',rank:3},
 yewLogs:{name:'Yew',short:'yew',level:60,color:'#2c4a2a',rank:4}
};
const TREE_TYPE={oak:'oakLogs',willow:'willowLogs',maple:'mapleLogs',yew:'yewLogs'};
// Fishing levels per spot type from the catch tables (fish-tiers.js); legacy spots keep every fish.
const fishRange=catches=>{const l=fullFishTable.filter(f=>catches.includes(f.item)).map(f=>f.level);return l.length?[Math.min(...l),Math.max(...l)]:[1,1]};
const SPOT_COLOR={shore:'#4aa3c8',river:'#2b7fbd',bignet:'#2a6aa0',cage:'#245a8c',deep:'#1d3f72',legacy:'#2b7fbd'},SPOT_RANK={shore:0,river:1,legacy:1,bignet:2,cage:3,deep:4};
export const FISH_TIERS=Object.fromEntries([...Object.entries(SPOT_TYPES).map(([k,t])=>[k,{name:t.label,catches:t.catches}]),['legacy',{name:'Net / Bait / Cage / Harpoon',catches:LEGACY_CATCHES}]]
 .map(([k,t])=>{const [lo,hi]=fishRange(t.catches);return [k,{name:t.name,short:t.name,level:lo,max:hi,color:SPOT_COLOR[k],rank:SPOT_RANK[k]}]}));

// ------------------------------------------------------------------------- category mapping
const STATION={hearth:'cooking',campfire:'cooking',range:'cooking',cooking_range:'cooking',oven:'cooking',stove:'cooking',fire:'cooking',
 furnace:'furnace',smelter:'furnace',anvil:'smithing',forge:'smithing',smith:'smithing',
 spinning_wheel:'crafting',tanning_rack:'crafting',loom:'crafting',workbench:'crafting',pottery_wheel:'crafting',kiln:'crafting',crafting_table:'crafting',
 farming_patch:'farming',herb_patch:'farming',flax_patch:'farming',wheat_patch:'farming',berry_bush:'farming',
 construction_site:'skill',mill:'skill',thieving_stall:'skill',practice_chest:'skill',hunting_ground:'skill',
 bank:'bank',banker:'bank',bank_chest:'bank',deposit_box:'bank',
 inn:'inn',tavern:'inn',innkeeper:'inn',
 altar:'altar',chapel:'altar',shrine:'altar',rune_altar:'altar',
 armory:'weapons',armoury:'weapons',
 log_balance:'agility',rope_swing:'agility',wall_climb:'agility',stepping_stones:'agility',squeeze:'agility',agility_log:'agility',
 cave_mouth:'dungeon',crypt_door:'dungeon',mine_shaft:'dungeon',trapdoor:'dungeon',
 ferry_boat:'boat',boat:'boat',ship:'boat',ferry:'boat',
 portal:'teleport',teleport:'teleport',teleport_stone:'teleport',waystone:'teleport',
 market:'shop',store:'shop',general_store:'shop',generalstore:'shop',shop:'shop',merchant:'shop',stall:'shop'};
const STATION_NAME={hearth:'Cooking range',campfire:'Campfire',furnace:'Furnace',anvil:'Anvil',forge:'Smithy',spinning_wheel:'Spinning wheel',tanning_rack:'Tanning rack',workbench:'Workbench',
 farming_patch:'Farming patch',herb_patch:'Herb patch',flax_patch:'Flax patch',wheat_patch:'Wheat patch',berry_bush:'Berry bush',construction_site:'Building site',mill:'Grain mill',thieving_stall:'Thieving stall',practice_chest:'Lock chest',hunting_ground:'Hunting ground',
 bank:'Bank',banker:'Bank',inn:'Inn',innkeeper:'Inn',altar:'Altar',chapel:'Chapel',rune_altar:'Runecrafting altar',armory:'Armoury'};
// A shop's kind from its name, then its stock (catalog keys).
export function shopKind(name='',items=[]){
 const n=String(name||'');
 if(/apothec|herbal|potion|alchem|remed|mortar/i.test(n))return 'apothecary';
 if(/armou?r|plate|mail|shield|helm/i.test(n))return 'armour';
 if(/blade|sword|weapon|\barms\b|arch(er|ery)|fletch|bow|spear|armou?ry/i.test(n))return 'weapons';
 const keys=(Array.isArray(items)?items:Object.keys(items||{})).map(String);if(!keys.length)return 'general';
 const share=re=>keys.filter(k=>re.test(k)).length/keys.length;
 if(share(/^(armor|shield):/)>=.5)return 'armour';if(share(/^weapon:/)>=.5)return 'weapons';if(share(/potion|herb|vial|tonic|draught|antidote/i)>=.5)return 'apothecary';
 return 'general';
}
// The marker for one world entity (row data) or town building, or null when it is not one.
// Ordinary scenery trees and monsters are not markers (tiered trees, rocks and dragons are;
// normal trees count when they belong to a named skilling site).
// A node's skilling site ("Highmoor coal field"): the merged marker takes its name.
const siteOf=d=>typeof d.site==='string'&&d.site.trim()?{site:d.site.trim().slice(0,60)}:{};
export function classifyEntity(d){
 if(!d||typeof d!=='object')return null;const t=String(d.template||d.type||'').toLowerCase(),x=Number(d.x),z=Number(d.z);
 if(!Number.isFinite(x)||!Number.isFinite(z))return null;const at={x,z};
 if(t==='rock'||t==='essence_rock'){const id=t==='essence_rock'?'runeEssence':ORE_TIERS[d.resource]?d.resource:'ore',o=ORE_TIERS[id];return {...at,cat:'mining',tier:id,tierRank:o.rank,tierColor:o.color,tierNames:[o.short],skill:'Mining',min:o.level,max:o.level,name:d.name||o.name+' rocks',...siteOf(d)}}
 if(t==='tree'||t==='pine'){const id=TREE_TIERS[d.logItem]&&(d.logItem!=='wood'||siteOf(d).site)?d.logItem:TREE_TYPE[String(d.treeType||'').toLowerCase()];if(!id)return null;const o=TREE_TIERS[id];return {...at,cat:'woodcutting',tier:id,tierRank:o.rank,tierColor:o.color,tierNames:[o.short],skill:'Woodcutting',min:o.level,max:o.level,name:d.name||o.name+' tree',...siteOf(d)}}
 if(t==='fishing_spot'||t==='fishing'){const k=FISH_TIERS[d.spotType]?d.spotType:'legacy',o=FISH_TIERS[k];return {...at,cat:'fishing',tier:k,tierRank:o.rank,tierColor:o.color,tierNames:[o.short],skill:'Fishing',min:o.level,max:o.max,name:d.name||'Fishing spot'}}
 if(d.kind==='monster'||d.kind==='creature'){if(t!=='dragon'&&d.species!=='dragon')return null;const lv=Number(d.level)||null;return {...at,cat:'dragon',skill:'combat',min:lv,max:lv,name:d.name||'Dragon',names:[d.name||'Dragon']}}
 if(d.agility&&typeof d.agility==='object'){const lv=Number(d.agility.level)||1;return {...at,cat:'agility',skill:'Agility',min:lv,max:lv,name:d.name||'Agility shortcut'}}
 const cat=STATION[t];if(!cat)return null;
 if(cat==='shop'){const kind=shopKind(d.name,d.shopItems||d.shop||d.items);return {...at,cat:kind,name:d.name||MARKER_CATS[kind].label}}
 if(cat==='bank'&&t==='banker'&&!d.name)return {...at,cat,name:'Bank'};
 if(cat==='dungeon'){const p=d.passage||{};if(p.depth!=null&&p.depth<0)return null;return {...at,cat,name:d.name||'Cave entrance',area:p.area||null,requires:p.requires||null}}
 if(cat==='agility')return {...at,cat,skill:'Agility',min:Number(d.level)||1,max:Number(d.level)||1,name:d.name||'Agility shortcut'};
 const label=t==='rune_altar'?'Runecrafting altar':null;
 return {...at,cat,name:d.name||STATION_NAME[t]||MARKER_CATS[cat].label,...(label?{note:label}:{})};
}
// A town building record ({type,name,x,z}): banks, inns, chapels, forges, shops.
export function classifyBuilding(b){if(!b)return null;const t=String(b.type||'').toLowerCase();if(t==='shop'||t==='market')return {x:b.x,z:b.z,cat:shopKind(b.name),name:b.name||'Shop'};if(['bank','inn','chapel','forge','armory'].includes(t))return classifyEntity({template:t,name:b.name,x:b.x,z:b.z});return null}

// ------------------------------------------------------------------------------ the sources
// The world's overworld is ±420; markers outside (underground planes, arenas) are not drawn.
export const OVERWORLD=430;const onMap=m=>m&&Math.abs(m.x)<=OVERWORLD&&Math.abs(m.z)<=OVERWORLD;
const RANK_BOSS=new Set(['Boss','Legendary']);
// Every marker from the data the client holds. All inputs are optional:
//  rows: world entity data objects; buildings: [{type,name,x,z}]; areas: underground / lair /
//  arena definitions (entrances, band, spawns); bosses: bosses.js BOSSES; lairs: ids of the areas
//  built for one boss (bosses.js LAIRS: their entrance is a boss marker; a boss in a shared
//  dungeon badges that dungeon's marker instead); roster: rosterBeasts; spawns: monsterSpawns
//  (training areas and dragon nests by spawn group; the roster bosses live in their lairs);
//  shortcuts: agility shortcut entities; fishing: extra fishing spots; places: explore PLACES
//  (only ferry boats are always shown; hidden places stay hidden until discovered).
export function collectMarkers({rows=[],buildings=[],areas=[],bosses=[],lairs=[],roster={},spawns=[],shortcuts=[],fishing=[],places=[]}={}){
 const out=[],push=m=>{if(onMap(m))out.push(m);return m};
 for(const d of rows){const m=classifyEntity(d);if(m&&d.kind==='npc')m.npc=true;push(m)}
 for(const b of buildings)push(classifyBuilding(b));
 for(const s of shortcuts)push(classifyEntity(s));
 for(const f of fishing)push(classifyEntity({template:'fishing_spot',spotType:f.spotType||f.type,x:f.x,z:f.z,name:f.name||(f.near?f.near+' fishing':null)}));
 // Caves, crypts, mines and lairs: one marker per overworld entrance, with what waits inside.
 const lairSet=new Set(lairs),bossIn=id=>bosses.filter(b=>b.lair?.area===id);
 const entrances=out.filter(m=>m.cat==='dungeon');
 for(const a of areas)for(const e of a.entrances||[]){if(STATION[e.kind]!=='dungeon'||!onMap(e))continue;
  let m=entrances.find(q=>Math.hypot(q.x-e.x,q.z-e.z)<4);if(!m){m=push({x:e.x,z:e.z,cat:'dungeon',name:e.name||a.name});entrances.push(m)}
  m.area=a.id;m.areaName=a.name;if(Array.isArray(a.band)){m.skill='combat';m.min=a.band[0];m.max=a.band[1]}m.requires=e.requires||m.requires||null}
 for(const m of entrances){const bs=bossIn(m.area);if(!bs.length)continue;m.bosses=bs.map(b=>({name:b.name,level:b.level}));
  if(lairSet.has(m.area)){const b=bs[0];m.cat='boss';m.entrance=m.name;m.name=b.name.replace(/^The /,'').split(',')[0].split(' the ')[0]+' lair';m.fixedName=m.name;m.names=[m.name];m.skill='combat';m.min=m.max=b.level;if(/wyrm|dragon/i.test(b.name+' '+(b.roster||'')))m.dragon=true}
  else m.badge='boss'}
 // Roster spawns: dragon nests and training areas by spawn group.
 const groups=new Map();
 for(const s of spawns){const b=roster[s.key];if(!b||RANK_BOSS.has(b.tier))continue;const lv=Number(b.level)||1;
  const kind=b.template==='dragon'?'dragon':'training',key=kind+':'+(s.group||s.key);let g=groups.get(key);
  if(!g){g={kind,name:s.group||b.name,xs:0,zs:0,n:0,min:lv,max:lv,mobs:new Map()};groups.set(key,g)}
  g.xs+=s.x;g.zs+=s.z;g.n++;g.min=Math.min(g.min,lv);g.max=Math.max(g.max,lv);const nm=b.name||b.label||s.key;g.mobs.set(nm,(g.mobs.get(nm)||0)+1)}
 for(const g of groups.values()){const mobs=[...g.mobs.entries()].sort((a,b)=>b[1]-a[1]).map(([n])=>n);push({x:g.xs/g.n,z:g.zs/g.n,cat:g.kind,skill:'combat',min:g.min,max:g.max,name:g.name,names:[g.name],mobs})}
 // Boats: public ferry entrances (exploration regions reached by boat).
 for(const p of places){const e=p.entrance;if(e&&(e.model==='ferry_boat'||e.model==='boat'))push({x:e.x,z:e.z,cat:'boat',name:e.name||'Boat to '+p.name})}
 return out;
}

// ------------------------------------------------------------------------------ clustering
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;
export function joinNames(list){const l=[...new Set(list.filter(Boolean))];if(l.length<2)return l[0]||'';if(l.length===2)return l[0]+' & '+l[1];return l.slice(0,-1).join(', ')+' & '+l[l.length-1]}
// The name a merged group gets from its tiers or members.
export function clusterName(c){
 const tiers=c.tierNames||[];
 if(c.cat==='mining'&&tiers.length){const t=tiers.filter(n=>n!=='essence');if(!t.length)return 'Rune essence rocks';return (t.length>3?cap(t[0])+'-to-'+t[t.length-1]:cap(joinNames(t)))+' mine'+(tiers.includes('essence')?' & essence':'')}
 if(c.cat==='woodcutting'&&tiers.length)return (tiers.length>3?cap(tiers[0])+'-to-'+tiers[tiers.length-1]:cap(joinNames(tiers)))+' trees';
 if(c.cat==='fishing'){const near=(c.names||[]).find(n=>/fish|spot|shallows/i.test(n)&&!/^fishing spot$/i.test(n));return near||'Fishing spots'}
 const names=[...new Set(c.names||[])];if(names.length===1)return names[0];
 if(c.cat==='training'||c.cat==='dragon'||c.cat==='boss'||c.cat==='dungeon')return names.length?joinNames(names.slice(0,3))+(names.length>3?' …':''):MARKER_CATS[c.cat].plural;
 return names.length?(names.length+' '+MARKER_CATS[c.cat].plural.toLowerCase()):MARKER_CATS[c.cat].label;
}
const tierOrder=(a,b)=>a.rank-b.rank;
function merge(items){
 const first=items[0],c={cat:first.cat,x:0,z:0,count:0,names:[],tierNames:[],members:[],min:null,max:null,skill:first.skill||null,tierRank:-1,tierColor:null,badge:null,bosses:[],mobs:[],ids:[]};let tiers=[];
 for(const m of items){const n=m.count||1;c.x+=m.x*n;c.z+=m.z*n;c.count+=n;c.members.push(...(m.members||[m]));for(const nm of m.names||[m.name])if(nm&&!c.names.includes(nm))c.names.push(nm);
  if(m.min!=null)c.min=c.min==null?m.min:Math.min(c.min,m.min);if(m.max!=null)c.max=c.max==null?m.max:Math.max(c.max,m.max);
  if((m.tierRank??-1)>c.tierRank){c.tierRank=m.tierRank;c.tierColor=m.tierColor}for(const t of m.tierNames||[])if(!tiers.some(x=>x.n===t))tiers.push({n:t,rank:m.tierNames.length===1?m.tierRank:(m.tierRanks?.[t]??0)});
  if(m.badge)c.badge=m.badge;for(const b of m.bosses||[])if(!c.bosses.some(x=>x.name===b.name))c.bosses.push(b);for(const mob of m.mobs||[])if(!c.mobs.includes(mob))c.mobs.push(mob);
  if(m.id)c.ids.push(m.id);if(m.areaName&&!c.areaName)c.areaName=m.areaName;if(m.entrance&&!c.entrance)c.entrance=m.entrance;if(m.requires&&!c.requires)c.requires=m.requires;if(m.note&&!c.note)c.note=m.note;if(m.dragon)c.dragon=true;if(m.fixedName&&items.length===1)c.fixedName=m.fixedName}
 // A building's or object's name beats the NPC who works there ("Birchford West Bank", not its banker).
 const placeNames=items.some(m=>m.npc)?[...new Set(items.filter(m=>!m.npc).flatMap(m=>m.names||[m.name]).filter(Boolean))]:null;if(placeNames?.length)c.names=placeNames;
 c.x/=c.count;c.z/=c.count;tiers.sort(tierOrder);c.tierNames=tiers.map(t=>t.n);c.tierRanks=Object.fromEntries(tiers.map(t=>[t.n,t.rank]));
 // Nodes of one named skilling site: the site's name (the most common one if sites touch).
 const sites=new Map();for(const m of items)if(m.site)sites.set(m.site,(sites.get(m.site)||0)+(m.count||1));
 if(sites.size)c.site=[...sites.entries()].sort((a,b)=>b[1]-a[1]||(a[0]<b[0]?-1:1))[0][0];
 c.name=c.fixedName||c.site||clusterName(c);return c;
}
// Single-linkage clusters per category: markers of one kind closer than `link` (world units,
// or a function of the category) end up in one group. Order-independent; returns new objects
// with x/z (count-weighted centre), count, names, tiers, level range and members.
export function clusterMarkers(list,link=cat=>LINK[cat]??6){
 const by=new Map();for(const m of list||[]){if(!m||!MARKER_CATS[m.cat]||!Number.isFinite(m.x)||!Number.isFinite(m.z))continue;if(!by.has(m.cat))by.set(m.cat,[]);by.get(m.cat).push(m)}
 const out=[];
 for(const [cat,items] of by){const L=typeof link==='function'?link(cat):link,n=items.length,parent=items.map((_,i)=>i);
  const find=i=>{while(parent[i]!==i){parent[i]=parent[parent[i]];i=parent[i]}return i};
  if(L>0&&cat!=='custom')for(let i=0;i<n;i++)for(let j=i+1;j<n;j++)if(Math.abs(items[i].x-items[j].x)<=L&&Math.abs(items[i].z-items[j].z)<=L&&Math.hypot(items[i].x-items[j].x,items[i].z-items[j].z)<=L){const a=find(i),b=find(j);if(a!==b)parent[Math.max(a,b)]=Math.min(a,b)}
  const groups=new Map();for(let i=0;i<n;i++){const r=find(i);if(!groups.has(r))groups.set(r,[]);groups.get(r).push(items[i])}
  for(const g of groups.values())out.push(merge(g))}
 return out.sort((a,b)=>MARKER_CATS[b.cat].prio-MARKER_CATS[a.cat].prio||a.x-b.x||a.z-b.z);
}
// A stable id for an owner override (hide / rename): kind and the rounded centre.
export const markerId=c=>c.cat+':'+Math.round(c.x)+':'+Math.round(c.z);
// Base clusters with the owner's overrides: hidden ids dropped, names replaced, custom markers added.
export function applyOverrides(clusters,cfg){
 const hidden=new Set(Array.isArray(cfg?.hidden)?cfg.hidden:[]),names=cfg?.names&&typeof cfg.names==='object'?cfg.names:{};const out=[];
 for(const c of clusters){const id=c.id||markerId(c);if(hidden.has(id))continue;const nm=typeof names[id]==='string'&&names[id].trim()?names[id].trim().slice(0,60):null;out.push({...c,id,...(nm?{name:nm,fixedName:nm,names:[nm]}:{})})}
 for(const m of Array.isArray(cfg?.custom)?cfg.custom:[]){if(!m||!MARKER_CATS[m.cat]||!Number.isFinite(+m.x)||!Number.isFinite(+m.z)||!onMap({x:+m.x,z:+m.z}))continue;const id=m.id||'custom:'+Math.round(m.x)+':'+Math.round(m.z);if(hidden.has(id))continue;const nm=String(m.name||MARKER_CATS[m.cat].label).slice(0,60);
  out.push({cat:m.cat,x:+m.x,z:+m.z,count:1,id,name:nm,fixedName:nm,names:[nm],custom:true,note:m.note?String(m.note).slice(0,120):null,members:[],tierNames:[],ids:[id],min:null,max:null,bosses:[],mobs:[]})}
 return out;
}

// --------------------------------------------------------------------------------- labels
const range=(a,b)=>a==null?'':(b==null||a===b?String(a):a+'–'+b);
// The requirement / level text: "Woodcutting 60", "Mining 1–85", "boss, combat 120", "combat 28–32".
export function requirementText(c){
 if(c.cat==='boss')return c.min!=null?'boss, combat '+range(c.min,c.max):'boss';
 if(c.min==null)return '';
 if(c.skill==='combat')return 'combat '+range(c.min,c.max);
 if(c.skill)return c.skill+' '+range(c.min,c.max);
 return '';
}
// The tooltip / tap label: name (requirement), then what is inside a cave and notes.
export function markerLabel(c){
 const req=requirementText(c);let s=c.name+(req?' ('+req+')':'');
 const needs=r=>(r?.combat?' · needs combat '+r.combat:'')+(r?.agility?' · needs Agility '+r.agility:'')+(r?.unlock&&r.gate!==false?' · opened by a quest':'');
 if(c.cat==='dungeon'){if(c.areaName&&c.areaName!==c.name)s=c.name+' · '+c.areaName+(req?' ('+req+')':'');if(c.bosses?.length)s+=' · Boss inside: '+c.bosses.map(b=>b.name+' (combat '+b.level+')').join(', ');s+=needs(c.requires)}
 else if(c.cat==='boss'&&c.entrance){const full=c.bosses?.[0]?.name||'';s+=(full&&!s.startsWith(full.replace(/^The /,''))?' · '+full:'')+(c.dragon?' · dragon':'')+' · '+c.entrance+needs(c.requires)}
 else if(c.cat==='training'||c.cat==='dragon'){if(c.mobs?.length)s+=' · '+c.mobs.slice(0,3).join(', ')+(c.mobs.length>3?' …':'')}
 else if(c.count>1&&c.names?.length>1&&!['mining','woodcutting','fishing'].includes(c.cat))s+=' · '+c.names.slice(0,4).join(', ')+(c.names.length>4?' …':'');
 if(c.note&&!s.includes(c.note))s+=' · '+c.note;
 return s;
}

// ------------------------------------------------------------------------- viewer filters
// Per-viewer category toggles (a remembered convenience; the page works without storage).
const FILTER_KEY='eldervale-map-filters';
export function loadFilters(storage=globalThis.localStorage){try{const v=JSON.parse(storage?.getItem(FILTER_KEY)||'[]');return new Set(Array.isArray(v)?v.filter(k=>MARKER_CATS[k]||k==='quest'):[])}catch{return new Set()}}
export function saveFilters(set,storage=globalThis.localStorage){try{storage?.setItem(FILTER_KEY,JSON.stringify([...set]))}catch{}}

// ---------------------------------------------------------------------------------- glyphs
// Original glyphs on a round badge, drawn in a 24-unit box centred on (0,0) and scaled to `size`
// pixels: an outlined plate (category colour or the tier tint), then the glyph with a dark
// outline under a light stroke so it stays crisp on any ground.
const luminance=c=>{const m=/^#?([0-9a-f]{6})$/i.exec(c||'');if(!m)return 0;const n=parseInt(m[1],16);return (.299*(n>>16&255)+.587*(n>>8&255)+.114*(n&255))/255};
export const inkFor=plate=>luminance(plate)>.62?'#20160a':'#fff6dc';
const DARK='#1b1408';
function line(g,pts,ink,w=1.9){g.beginPath();pts.forEach(([x,y],i)=>i?g.lineTo(x,y):g.moveTo(x,y));g.strokeStyle=DARK;g.lineWidth=w+1.6;g.stroke();g.strokeStyle=ink;g.lineWidth=w;g.stroke()}
function shape(g,trace,fill,lw=1.1){trace();g.fillStyle=fill;g.fill();g.strokeStyle=DARK;g.lineWidth=lw;g.stroke()}
const GLYPHS={
 mining(g,ink){line(g,[[-6,7],[3.5,-3.5]],'#e0b878',2);shape(g,()=>{g.beginPath();g.moveTo(-2.5,-8.2);g.quadraticCurveTo(6.6,-7.4,8.2,2.5);g.quadraticCurveTo(5.4,-3.4,-2.5,-8.2);g.closePath()},'#e3e8ec');shape(g,()=>{g.beginPath();g.arc(2.9,-2.9,1.6,0,Math.PI*2)},ink,.9)},
 woodcutting(g,ink){shape(g,()=>{g.beginPath();g.rect(-4.6,1,2.6,7)},'#9a6a3a',.9);shape(g,()=>{g.beginPath();g.arc(-3.3,-2.6,5.2,0,Math.PI*2)},'#8fcf6a');
  line(g,[[1.5,8],[6.5,-1]],'#e0b878',1.8);shape(g,()=>{g.beginPath();g.moveTo(4.2,-4.6);g.quadraticCurveTo(9.8,-4.4,9,1.6);g.lineTo(5.6,-.4);g.closePath()},'#e3e8ec',1)},
 fishing(g,ink){shape(g,()=>{g.beginPath();g.ellipse(-1.4,0,6,3.6,0,0,Math.PI*2)},ink);shape(g,()=>{g.beginPath();g.moveTo(3.6,0);g.lineTo(8.4,-4.2);g.lineTo(8.4,4.2);g.closePath()},ink);g.fillStyle=DARK;g.beginPath();g.arc(-4.6,-.8,1,0,Math.PI*2);g.fill()},
 cooking(g,ink){for(const [x,h] of [[-3.5,4.5],[0,6],[3.5,4.5]]){shape(g,()=>{g.beginPath();g.moveTo(x-2,8.6);g.quadraticCurveTo(x-1.4,8.6-h*.7,x,8.6-h);g.quadraticCurveTo(x+1.4,8.6-h*.7,x+2,8.6);g.closePath()},'#ffb43a',.8)}
  shape(g,()=>{g.beginPath();g.moveTo(-7,-4);g.lineTo(7,-4);g.quadraticCurveTo(7,4,0,4);g.quadraticCurveTo(-7,4,-7,-4);g.closePath()},'#3a3a40');line(g,[[-8.2,-4.4],[8.2,-4.4]],ink,1.6);line(g,[[-2,-6.8],[-1,-8.6]],ink,1.1);line(g,[[2,-6.8],[3,-8.6]],ink,1.1)},
 smithing(g,ink){shape(g,()=>{g.beginPath();g.moveTo(-8,-4);g.lineTo(6.5,-4);g.quadraticCurveTo(5,-1,2.5,-.6);g.lineTo(2.5,2.6);g.lineTo(5,6.2);g.lineTo(-5,6.2);g.lineTo(-2.5,2.6);g.lineTo(-2.5,-.6);g.lineTo(-5.4,-.6);g.closePath()},ink)},
 furnace(g,ink){shape(g,()=>{g.beginPath();g.moveTo(-7,7.5);g.lineTo(-7,-2);g.quadraticCurveTo(-7,-7.5,0,-7.5);g.quadraticCurveTo(7,-7.5,7,-2);g.lineTo(7,7.5);g.closePath()},ink);
  shape(g,()=>{g.beginPath();g.moveTo(-3.6,7.5);g.lineTo(-3.6,1.5);g.quadraticCurveTo(0,-2.6,3.6,1.5);g.lineTo(3.6,7.5);g.closePath()},'#ff8a1e',.9);g.fillStyle='#ffe07a';g.beginPath();g.moveTo(-1.4,7.5);g.quadraticCurveTo(0,2.5,1.4,7.5);g.fill()},
 crafting(g,ink){line(g,[[-6,7],[6,-7]],ink,1.7);g.strokeStyle=DARK;g.lineWidth=1;g.beginPath();g.ellipse(4.6,-5.4,1.4,.7,-Math.PI/4,0,Math.PI*2);g.stroke();g.strokeStyle='#ffd9e8';g.lineWidth=1.3;g.beginPath();g.moveTo(4.6,-5.4);g.bezierCurveTo(9,-1,-1,1,-6,-5);g.stroke()},
 farming(g,ink){line(g,[[0,8],[0,-2]],'#9be36a',1.8);shape(g,()=>{g.beginPath();g.moveTo(0,-1);g.quadraticCurveTo(-8,-2,-7,-8);g.quadraticCurveTo(-1,-7,0,-1);g.closePath()},'#9be36a');shape(g,()=>{g.beginPath();g.moveTo(0,1);g.quadraticCurveTo(7,0,7,-5);g.quadraticCurveTo(1,-5,0,1);g.closePath()},'#7fcf55')},
 skill(g,ink){shape(g,()=>{g.beginPath();for(let i=0;i<16;i++){const a=i/16*Math.PI*2,r=i%2?5:7.4;g.lineTo(Math.cos(a)*r,Math.sin(a)*r)}g.closePath()},ink);g.fillStyle=DARK;g.beginPath();g.arc(0,0,2,0,Math.PI*2);g.fill()},
 bank(g,ink){shape(g,()=>{g.beginPath();g.rect(-7,-1,14,8)},'#8a5a2a');shape(g,()=>{g.beginPath();g.moveTo(-7,-1);g.lineTo(-7,-3.5);g.quadraticCurveTo(0,-9,7,-3.5);g.lineTo(7,-1);g.closePath()},'#a8733a');
  line(g,[[-7,-1],[7,-1]],'#f2c64e',1.2);shape(g,()=>{g.beginPath();g.rect(-1.8,-2.2,3.6,4)},'#f2c64e',.9)},
 general(g,ink){shape(g,()=>{g.beginPath();g.arc(0,0,7,0,Math.PI*2)},'#f2c64e');g.strokeStyle='#8a6214';g.lineWidth=1;g.beginPath();g.arc(0,0,4.9,0,Math.PI*2);g.stroke();g.fillStyle='#8a6214';g.font='bold 8px Georgia,serif';g.textAlign='center';g.textBaseline='middle';g.fillText('$'.replace('$','¤'),0,.6)},
 apothecary(g,ink){shape(g,()=>{g.beginPath();g.moveTo(-1.8,-5);g.lineTo(-1.8,-1.6);g.arc(0,3,5.2,-Math.PI/2-.36,Math.PI*1.5+.36,false);g.lineTo(1.8,-5);g.closePath()},'#d8f4ff');
  shape(g,()=>{g.beginPath();g.arc(0,3,4,.2,Math.PI-.2)},'#ff5a8a',.6);shape(g,()=>{g.beginPath();g.rect(-2.4,-8,4.8,3)},'#b07a46',.9)},
 weapons(g,ink){line(g,[[-6,6],[6.4,-6.4]],'#eef2f4',2.1);line(g,[[-6.5,1.5],[-1.5,6.5]],'#e0b878',1.6);line(g,[[-6,6],[-8,8]],'#9a6a3a',1.8)},
 armour(g,ink){shape(g,()=>{g.beginPath();g.moveTo(-6.5,-6.5);g.lineTo(6.5,-6.5);g.lineTo(6.5,-.5);g.quadraticCurveTo(6,5.5,0,8.2);g.quadraticCurveTo(-6,5.5,-6.5,-.5);g.closePath()},ink);line(g,[[0,-6.5],[0,7.6]],'#c0392b',1.3);line(g,[[-6.4,-1.6],[6.4,-1.6]],'#c0392b',1.3)},
 inn(g,ink){shape(g,()=>{g.beginPath();g.rect(-5.5,-5,8,12)},ink);g.strokeStyle=DARK;g.lineWidth=3;g.beginPath();g.arc(2.6,1,3,-Math.PI/2,Math.PI/2);g.stroke();g.strokeStyle=ink;g.lineWidth=1.6;g.stroke();shape(g,()=>{g.beginPath();g.ellipse(-1.5,-5.6,4.6,2,0,0,Math.PI*2)},'#fffbe8',.8)},
 altar(g,ink){shape(g,()=>{g.beginPath();g.rect(-7,0,14,3.4)},ink);shape(g,()=>{g.beginPath();g.rect(-5,3.4,10,4.4)},ink);shape(g,()=>{g.beginPath();g.moveTo(-2.4,0);g.quadraticCurveTo(-3,-4,0,-8.5);g.quadraticCurveTo(3,-4,2.4,0);g.closePath()},'#ffd23a',.8)},
 dungeon(g,ink){shape(g,()=>{g.beginPath();g.moveTo(-9,7.5);g.quadraticCurveTo(-8,-7,0,-7.5);g.quadraticCurveTo(8,-7,9,7.5);g.closePath()},'#a69a86');shape(g,()=>{g.beginPath();g.moveTo(-4.6,7.5);g.quadraticCurveTo(-4.6,-2.6,0,-2.8);g.quadraticCurveTo(4.6,-2.6,4.6,7.5);g.closePath()},'#120d08',.8);
  g.strokeStyle='rgba(0,0,0,.35)';g.lineWidth=.9;g.beginPath();g.moveTo(-7,0);g.lineTo(-5.6,1.6);g.moveTo(6.8,-1);g.lineTo(5.4,.8);g.stroke()},
 boss(g,ink){shape(g,()=>{g.beginPath();g.arc(0,-1.4,6.6,0,Math.PI*2)},'#f1e8d2');shape(g,()=>{g.beginPath();g.rect(-3.8,3.2,7.6,4.4)},'#f1e8d2');g.fillStyle=DARK;for(const ex of [-2.6,2.6]){g.beginPath();g.arc(ex,-1.2,1.75,0,Math.PI*2);g.fill()}g.beginPath();g.moveTo(0,1.2);g.lineTo(1,3);g.lineTo(-1,3);g.closePath();g.fill();g.fillRect(-.5,4.6,1,3)},
 dragon(g,ink){shape(g,()=>{g.beginPath();g.moveTo(-8,5);g.lineTo(-5,-2);g.lineTo(-6.5,-8);g.lineTo(-2.4,-4.4);g.lineTo(3,-4.6);g.lineTo(8.6,-1.4);g.lineTo(8.4,1.4);g.lineTo(3.6,2);g.lineTo(5.6,5.2);g.lineTo(1,4.4);g.lineTo(-2,7.4);g.closePath()},'#7fd36a');g.fillStyle='#ffd23a';g.beginPath();g.arc(-.4,-1.8,1.2,0,Math.PI*2);g.fill();g.fillStyle=DARK;g.beginPath();g.arc(-.2,-1.8,.5,0,Math.PI*2);g.fill()},
 training(g,ink){for(const s of [1,-1]){line(g,[[-6.5*s,6.5],[6*s,-6]],'#eef2f4',1.9);line(g,[[-7.6*s,3.2],[-3.2*s,7.6]],'#e0b878',1.4)}},
 agility(g,ink){for(const [x,y,r] of [[-3,2.6,-.25],[3,-2.6,.25]]){g.save();g.translate(x,y);g.rotate(r);shape(g,()=>{g.beginPath();g.ellipse(0,1.2,2.2,3.6,0,0,Math.PI*2)},ink,.9);for(const [tx,ty] of [[-1.7,-3.4],[0,-4],[1.7,-3.4]]){shape(g,()=>{g.beginPath();g.arc(tx,ty,.85,0,Math.PI*2)},ink,.6)}g.restore()}},
 boat(g,ink){shape(g,()=>{g.beginPath();g.moveTo(-8.4,2.4);g.lineTo(8.4,2.4);g.lineTo(5.4,7);g.lineTo(-5.4,7);g.closePath()},'#9a6a3a');line(g,[[0,2.4],[0,-8.4]],ink,1.3);shape(g,()=>{g.beginPath();g.moveTo(.8,-7.8);g.lineTo(7,.8);g.lineTo(.8,.8);g.closePath()},ink,.9);shape(g,()=>{g.beginPath();g.moveTo(-.8,-6);g.lineTo(-5.6,.8);g.lineTo(-.8,.8);g.closePath()},ink,.9)},
 teleport(g,ink){for(const [r,c] of [[7.4,'#d7b8ff'],[5,'#a77bff'],[2.6,'#fff6dc']]){shape(g,()=>{g.beginPath();g.ellipse(0,0,r*.7,r,0,0,Math.PI*2)},c,.8)}},
 exploration(g,ink){shape(g,()=>{g.beginPath();for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?3.2:8;g.lineTo(Math.cos(a)*r,Math.sin(a)*r)}g.closePath()},'#ffe07a')},
 custom(g,ink){line(g,[[-3,8],[-3,-8]],ink,1.4);shape(g,()=>{g.beginPath();g.moveTo(-3,-8);g.lineTo(7,-5);g.lineTo(-3,-1.6);g.closePath()},'#ffd23a',.9)}
};
export const GLYPH_KINDS=Object.keys(GLYPHS);
// Draws one marker icon centred at (x,y), `size` px across. opts: {tint, badge:'boss'}.
export function drawMarkerIcon(ctx,cat,x,y,size=18,{tint=null,badge=null}={}){
 const def=MARKER_CATS[cat];if(!def||!GLYPHS[cat])return;const k=size/24,plate=tint||def.color;ctx.save();ctx.translate(x,y);ctx.scale(k,k);ctx.lineCap='round';ctx.lineJoin='round';
 ctx.fillStyle='rgba(0,0,0,.42)';ctx.beginPath();ctx.arc(1,1.6,11.4,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=plate;ctx.strokeStyle=DARK;ctx.lineWidth=1.6;ctx.beginPath();ctx.arc(0,0,11,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.strokeStyle='rgba(255,255,255,.32)';ctx.lineWidth=1.1;ctx.beginPath();ctx.arc(0,0,9.2,Math.PI*1.1,Math.PI*1.9);ctx.stroke();
 GLYPHS[cat](ctx,inkFor(plate));
 if(badge==='boss'){ctx.save();ctx.translate(8.4,-8.4);ctx.scale(.42,.42);ctx.fillStyle='#9e1b1b';ctx.strokeStyle=DARK;ctx.lineWidth=2.4;ctx.beginPath();ctx.arc(0,0,10,0,Math.PI*2);ctx.fill();ctx.stroke();GLYPHS.boss(ctx,'#fff');ctx.restore()}
 ctx.restore();
}
// Pre-rendered sprites (one per kind / tint / size / badge / pixel ratio) so a redraw is one drawImage per icon.
const sprites=new Map();
export function markerSprite(cat,size,{tint=null,badge=null,dpr=1,doc=globalThis.document}={}){
 const key=cat+'|'+size+'|'+(tint||'')+'|'+(badge||'')+'|'+dpr;let s=sprites.get(key);if(s)return s;if(!doc?.createElement)return null;
 const px=Math.ceil((size+6)*dpr);s=doc.createElement('canvas');s.width=s.height=px;const g=s.getContext('2d');if(!g)return null;g.scale(dpr,dpr);drawMarkerIcon(g,cat,(size+6)/2,(size+6)/2,size,{tint,badge});
 if(sprites.size>400)sprites.clear();sprites.set(key,s);return s;
}
// Draws a marker (cluster) through the sprite cache, falling back to direct drawing.
export function drawMarker(ctx,c,x,y,size,dpr=1){const opts={tint:c.tierColor||null,badge:c.badge||null,dpr},s=markerSprite(c.cat,size,opts);if(s){const d=size+6;ctx.drawImage(s,x-d/2,y-d/2,d,d)}else drawMarkerIcon(ctx,c.cat,x,y,size,opts)}
// The tint a legend row shows for a kind (best tier present, if any).
export const legendTint=(cat,clusters)=>{let best=null;for(const c of clusters)if(c.cat===cat&&c.tierColor&&(!best||c.tierRank>best.tierRank))best=c;return best?.tierColor||null};
