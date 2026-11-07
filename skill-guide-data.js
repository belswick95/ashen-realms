// Skill guides (OSRS-style "what does each level unlock"), built from the game's own definitions so
// they follow every balance change: weapons / shields / outfits / uniques (weapons.js, shields.js,
// outfits.js, unique-gear.js), the metal tiers (gear-tiers.js), recipes (profession-data.js plus the
// owner's live recipe edits), food and fishing (food.js, fish-tiers.js, water-data.js), prayers
// (mechanics.js), bones (monster-roster.js), agility shortcuts (agility-data.js, explore-data.js)
// and woodcutting, whose numbers live only in the SQL (skill-guide-sql-data.js, generated).
// Pure data: no DOM. skill-guide.js draws it; tests/skill-guide.test.js checks every guide.
//
// A guide: {id, name, icon, intro, sources:[file], tabs:[{id, label, rows}]}. A row:
//  {level, item?: catalog id (goods) for the icon and name, glyph?: emoji when no item exists
//   (prayers, spells, shortcuts), name, detail, also?: {skill: level} other requirements,
//   where?: {cat, tier?, tiers?, name?} a map-icons.js marker kind to point at}.
import {professionRecipes,professionSkills,professionStations} from './profession-data.js?v=release-20261107-emotes143';
import {fullFishTable,allMethods,LEGACY_CATCHES,LEGACY_METHODS,allFoodLadder} from './fish-tiers.js?v=release-20261107-emotes143';
import {SPOT_TYPES} from './water-data.js?v=release-20261107-emotes143';
import {GEAR_TIERS,tierById,tierIndex,tierWeapons,tierShields,WEAPON_TEMPLATES,SHIELD_TEMPLATES,PLATE_PIECES,BOWS,STAFFS,SPELLS,ARROWS,HIT_SCALE,STYLE_BONUS,maxHit,effectiveLevel,bonusSummary} from './gear-tiers.js?v=release-20261107-emotes143';
import {weaponCatalog} from './weapons.js?v=release-20261107-emotes143';
import {shieldCatalog} from './shields.js?v=release-20261107-emotes143';
import {outfitItems,OUTFIT_VARIANTS} from './outfits.js?v=release-20261107-emotes143';
import {UNIQUE_ITEMS} from './unique-gear.js?v=release-20261107-emotes143';
import {BOSSES} from './bosses.js?v=release-20261107-emotes143';
import {PRAYERS} from './mechanics.js?v=release-20261107-emotes143';
import {BONES,ALTAR_OFFER_MULTIPLIER} from './monster-roster.js?v=release-20261107-emotes143';
import {shortcuts as AGILITY_SHORTCUTS,AGILITY_TEMPLATES} from './agility-data.js?v=release-20261107-emotes143';
import {SHORTCUTS as EXPLORE_SHORTCUTS,PLACES,areaById} from './explore-data.js?v=release-20261107-emotes143';
import {ORE_TIERS,TREE_TIERS,classifyEntity} from './map-icons.js?v=release-20261107-emotes143';
import {skillingChance,HITPOINTS_START,MAX_LEVEL} from './combat-level.js?v=release-20261107-emotes143';
import {goods} from './economy.js?v=release-20261107-emotes143';
import {WOODCUTTING_TREES,WOODCUTTING_AXES} from './skill-guide-sql-data.js?v=release-20261107-emotes143';
import {SKILL_PANEL,skillId} from './skill-list.js?v=release-20261107-emotes143';

// ------------------------------------------------------------------------------------ helpers
const cap=s=>s?s[0].toUpperCase()+s.slice(1):s;
const nameOf=id=>id==='gold'?'coins':goods[id]?.name||id;
const amounts=(o={})=>Object.entries(o).map(([k,n])=>(n>1||k==='gold'?n+' × ':'')+nameOf(k)).join(', ');
const xpText=xp=>(Math.round(Number(xp||0)*100)/100).toLocaleString('en-US')+' XP';
const pct=v=>Math.round(v*100)+'%';
const lvl=(req,skill)=>Math.max(1,Number(req?.[skill])||1);
// Other skills an item also needs: {defence:40} beside its Ranged requirement.
const others=(req,skill)=>{const o={};for(const [k,v] of Object.entries(req||{}))if(k!==skill&&Number(v)>1)o[k]=Number(v);return Object.keys(o).length?o:undefined};
const bossName=id=>BOSSES.find(b=>b.id===id)?.name||cap(String(id).replace(/_/g,' '));
const sourceOf=u=>u.quest?'Quest reward':u.boss?'Dropped by '+bossName(u.boss):u.dragon?'Dropped by dragons':'Rare drop';
const sortRows=rows=>rows.sort((a,b)=>a.level-b.level||String(a.name).localeCompare(String(b.name)));
const tab=(id,label,rows)=>({id,label,rows:sortRows(rows.filter(Boolean))});
const toolsOf=r=>(r.tools||[]).map(t=>t==='firelighter'?nameOf('tinderbox')+' or '+nameOf('matches').toLowerCase():nameOf(t));
// The map marker kind a recipe station shows as (map-icons.js), and its readable name.
function stationWhere(station){if(!station)return undefined;const cat=station==='cooking'?'cooking':station==='mining_rock'?'mining':classifyEntity({template:station,x:0,z:0})?.cat;if(!cat)return undefined;return {cat,name:professionStations[station]||null}}
const stationText=s=>s==='cooking'?'Range or fire':s==='mining_rock'?null:professionStations[s]||null;
// The live recipe book (owner edits arrive through professions.js registerProfessions).
const liveRecipes=()=>globalThis.window?.eldervaleSkillRecipes||professionRecipes;
const enabledRecipes=(recipes,skill)=>Object.entries(recipes).filter(([,r])=>r&&r.enabled!==false&&r.skill===skill);
// The catalog item a recipe row shows: its first known output, its crop or the gathered resource.
function recipeItem(r){for(const k of Object.keys(r.outputs||{}))if(goods[k])return k;if(r.crop?.item&&goods[r.crop.item])return r.crop.item;if(r.resource&&goods[r.resource])return r.resource;for(const k of Object.keys(r.inputs||{}))if(goods[k])return k;return null}
function recipeRow(id,r,extra={}){
 const item=recipeItem(r),bits=[];
 const ins=amounts(r.inputs);if(ins)bits.push(ins);
 const outs=Object.entries(r.outputs||{}).filter(([k,n])=>k!==item||n>1);if(outs.length)bits.push('makes '+amounts(Object.fromEntries(outs)));
 if(r.crop)bits.push('grows '+r.crop.min+'–'+r.crop.max+' × '+nameOf(r.crop.item)+' in '+Math.round(r.crop.seconds/60)+' min (+'+xpText(r.crop.xp)+' to harvest)');
 const tools=toolsOf(r);if(tools.length)bits.push('tools: '+tools.join(', '));
 const st=stationText(r.station);if(st)bits.push(st);
 if(r.chance!=null&&r.chance<1)bits.push(pct(r.chance)+' success');
 bits.push(xpText(r.xp));
 return {level:Math.max(1,Number(r.level)||1),item,glyph:item?undefined:professionSkills[r.skill]?.icon||'•',name:item&&!extra.useRecipeName?nameOf(item):r.name,detail:bits.join(' · '),recipe:id,where:stationWhere(r.station),...extra};
}

// --------------------------------------------------------------------------------- combat gear
const TIER_WEAPONS=tierWeapons(),TIER_SHIELDS=tierShields();
const uniqueRows=(kinds,skill,filter=()=>true)=>UNIQUE_ITEMS.filter(u=>kinds.includes(u.kind)&&Number(u.req?.[skill])>1&&filter(u)&&goods[u.catalogId]).map(u=>({level:lvl(u.req,skill),item:u.catalogId,name:nameOf(u.catalogId),detail:sourceOf(u)+' · '+bonusSummary(u.bonuses)+(u.tradeable===false?' · untradeable':''),also:others(u.req,skill)}));
const melee=w=>w&&!w.ranged&&!w.magic&&!w.unique;
// One row per metal tier: the tier's weapons (or shields), shown with one member's icon.
function tierSetRows(set,catalog,prefix,skill,rep,label){
 return GEAR_TIERS.map(tier=>{const keys=Object.entries(set).filter(([,v])=>v.tier===tier.id).map(([k])=>k).filter(k=>catalog[k]);if(!keys.length)return null;
  const show=keys.find(k=>set[k].piece===rep)||keys[0],levels=keys.map(k=>lvl(catalog[k].req,skill));
  return {level:Math.min(...levels),item:prefix+show,name:tier.name+' '+label,detail:keys.map(k=>set[k].label||(prefix==='weapon:'?WEAPON_TEMPLATES:SHIELD_TEMPLATES)[set[k].piece].label).join(', ')+(tier.smith?' · smithed from Smithing '+tier.smith:' · not smithable'),tier:tier.id}});
}
// Outfit sets grouped by tier (knight plate) or outfit + colour variant.
function outfitSets(skill,filter){
 const groups=new Map();
 for(const [key,o] of Object.entries(outfitItems)){if(o.unique||!filter(o)||!goods['armor:'+key])continue;const g=o.outfit==='knight'&&PLATE_PIECES[o.piece]?'knight:'+o.tier:o.outfit+':'+o.variant;if(!groups.has(g))groups.set(g,[]);groups.get(g).push([key,o])}
 return [...groups.entries()].map(([g,list])=>{const [outfit]=g.split(':'),first=list[0][1],level=Math.max(...list.map(([,o])=>lvl(o.req,skill))),tier=tierById[first.tier];
  const name=outfit==='knight'?(tier?tier.name:cap(first.tier||OUTFIT_VARIANTS.knight[first.variant-1]?.name||''))+' plate armour':(OUTFIT_VARIANTS[outfit]?.[first.variant-1]?.name||'')+' '+outfit+' outfit';
  const rep=list.find(([,o])=>['chest','helm'].includes(o.slot))||list[0];
  const req=list.reduce((acc,[,o])=>{for(const [k,v] of Object.entries(o.req||{}))acc[k]=Math.max(acc[k]||0,v);return acc},{});
  return {level,item:'armor:'+rep[0],name:cap(name.trim()),detail:list.map(([k])=>nameOf('armor:'+k).replace(new RegExp('^'+(name.split(' ')[0])+' ','i'),'')).join(', ')+(outfit==='knight'&&tier?.smith?' · smithed from Smithing '+tier.smith:''),also:others(req,skill)}});
}
const MILESTONES=[1,10,20,30,40,50,60,70,80,90,MAX_LEVEL];

function attackGuide(){
 const specials=Object.entries(weaponCatalog).filter(([k,w])=>melee(w)&&!TIER_WEAPONS[k]).map(([k,w])=>({level:lvl(w.req,'attack'),item:'weapon:'+k,name:nameOf('weapon:'+k),detail:(w.kind==='tool'?'Tool and weapon · ':'')+bonusSummary(w.bonuses)+(w.twoHanded?' · two-handed':'')}));
 return {intro:'Attack decides which melee weapons you can wield and how often you hit.',sources:['gear-tiers.js','weapons.js','unique-gear.js'],
  tabs:[tab('weapons','Weapons',[...tierSetRows(TIER_WEAPONS,weaponCatalog,'weapon:','attack','longsword','weapons'),...specials]),tab('uniques','Uniques',uniqueRows(['weapon'],'attack',u=>!u.staff))]};
}
function strengthGuide(){
 // The best metal weapon (highest strength bonus) you could wield at the same Attack level.
 const metal=Object.keys(TIER_WEAPONS).filter(k=>weaponCatalog[k]);
 const maxRows=MILESTONES.map(L=>{const usable=metal.filter(k=>lvl(weaponCatalog[k].req,'attack')<=L).sort((a,b)=>(weaponCatalog[b].bonuses?.str||0)-(weaponCatalog[a].bonuses?.str||0));const k=usable[0];if(!k)return null;const w=weaponCatalog[k];
  const hit=maxHit(effectiveLevel(L,STYLE_BONUS.slash.str),w.bonuses?.str||0,HIT_SCALE);return {level:L,item:'weapon:'+k,name:'Max hit '+hit,detail:'With '+nameOf('weapon:'+k)+' (strength +'+(w.bonuses?.str||0)+', Aggressive style, Attack '+L+')'}});
 const gear=[...uniqueRows(['weapon','armor','shield'],'strength')];
 return {intro:'Strength raises your melee max hit. Few items need it; most of its value is in harder hits.',sources:['gear-tiers.js (maxHit)','weapons.js','unique-gear.js'],
  tabs:[tab('gear','Gear',gear),tab('maxhit','Max hit',maxRows)]};
}
function defenceGuide(){
 const plate=outfitSets('defence',o=>o.outfit==='knight'&&PLATE_PIECES[o.piece]||Number(o.req?.defence)>1);
 const specials=Object.entries(shieldCatalog).filter(([k,s])=>!s.unique&&!s.torch&&!TIER_SHIELDS[k]).map(([k,s])=>({level:lvl(s.req,'defence'),item:'shield:'+k,name:nameOf('shield:'+k),detail:bonusSummary(s.bonuses)}));
 return {intro:'Defence decides which armour and shields you can wear and how often you are hit.',sources:['gear-tiers.js','outfits.js','shields.js','unique-gear.js'],
  tabs:[tab('armour','Armour',plate),tab('shields','Shields',[...tierSetRows(TIER_SHIELDS,shieldCatalog,'shield:','defence','kite','shields'),...specials]),tab('uniques','Uniques',uniqueRows(['armor','shield'],'defence'))]};
}
function rangedGuide(){
 const bows=Object.entries(BOWS).filter(([k])=>weaponCatalog[k]).map(([k,b])=>({level:lvl(weaponCatalog[k].req,'ranged'),item:'weapon:'+k,name:nameOf('weapon:'+k),detail:'Fires arrows up to '+tierById[b.arrowCap].name.toLowerCase()+' · range attack +'+b.arange+' · '+b.ticks+' ticks'}));
 const firedBy=tier=>Object.entries(BOWS).filter(([k,b])=>weaponCatalog[k]&&tierIndex(b.arrowCap)>=tierIndex(tier)).sort((a,b)=>lvl(weaponCatalog[a[0]].req,'ranged')-lvl(weaponCatalog[b[0]].req,'ranged'));
 const arrows=Object.entries(ARROWS).filter(([id])=>goods[id]).map(([id,a])=>{const bows=firedBy(a.tier);if(!bows.length)return null;const [k]=bows[0];
  return {level:lvl(weaponCatalog[k].req,'ranged'),item:id,name:nameOf(id),detail:'Ranged strength +'+a.rstr+' · fired from '+nameOf('weapon:'+k)+(bows.length>1?' or better':'')+(tierById[a.tier].fletch?' · fletched at Fletching '+tierById[a.tier].fletch:'')}});
 return {intro:'Ranged decides which bows, arrows and ranger armour you can use.',sources:['gear-tiers.js (BOWS, ARROWS)','weapons.js','outfits.js','unique-gear.js'],
  tabs:[tab('bows','Bows',bows),tab('arrows','Arrows',arrows),tab('armour','Armour',outfitSets('ranged',o=>o.outfit==='ranger')),tab('uniques','Uniques',uniqueRows(['weapon','armor','shield'],'ranged'))]};
}
const ROMAN=['I','II','III','IV','V','VI'];
function magicGuide(){
 const families=Object.keys(SPELLS),staffFor=f=>Object.entries(STAFFS).filter(([k,s])=>weaponCatalog[k]&&families.indexOf(s.spell)>=families.indexOf(f)).sort((a,b)=>a[1].level-b[1].level)[0];
 const spells=families.flatMap(f=>SPELLS[f].map(([level,hit],i)=>{const st=staffFor(f);return {level,glyph:'✨',name:cap(f)+' '+ROMAN[i],detail:'Max hit '+hit*HIT_SCALE+(st?' · cast with '+nameOf('weapon:'+st[0])+(st[1].level>1?' (Magic '+st[1].level+')':'')+' or better':'')}}));
 const staves=Object.entries(STAFFS).filter(([k])=>weaponCatalog[k]).map(([k,s])=>({level:lvl(weaponCatalog[k].req,'magic'),item:'weapon:'+k,name:nameOf('weapon:'+k),detail:'Casts up to '+s.spell+' spells · magic attack +'+s.amagic}));
 return {intro:'Magic unlocks stronger spells, staves and robes. A staff casts the best spell of its family you know.',sources:['gear-tiers.js (SPELLS, STAFFS)','weapons.js','outfits.js','unique-gear.js'],
  tabs:[tab('spells','Spells',spells),tab('staves','Staves',staves),tab('robes','Robes',outfitSets('magic',o=>o.outfit==='wizard')),tab('uniques','Uniques',uniqueRows(['weapon','armor','shield'],'magic'))]};
}
function prayerGuide(){
 const prayers=PRAYERS.map(p=>({level:p.level,glyph:p.icon||'🙏',name:p.name,detail:p.text+' Drain '+p.drain+'.'}));
 const bones=Object.entries(BONES).filter(([id])=>goods[id]).map(([id,b])=>({level:1,item:id,name:nameOf(id),detail:'Bury for '+xpText(b.xp)+' · offer at an altar for '+xpText(b.xp*ALTAR_OFFER_MULTIPLIER),where:{cat:'altar'}}));
 return {intro:'Prayer unlocks the prayer book. Bury bones, or offer them at an altar, to train it.',sources:['mechanics.js (PRAYERS)','monster-roster.js (BONES)'],tabs:[tab('prayers','Prayers',prayers),tab('bones','Bones',bones)]};
}
function hitpointsGuide(){
 // Three foods across the ladder (weakest, middle, strongest), healed at each milestone's max HP.
 const ladder=[...allFoodLadder].filter(f=>goods[f.id]).sort((a,b)=>a.healPct-b.healPct),picks=[...new Set([ladder[0],ladder[ladder.length>>1],ladder[ladder.length-1]])].filter(Boolean);
 const rows=MILESTONES.filter(L=>L>=HITPOINTS_START).map(L=>{const hp=10*L;return {level:L,glyph:'❤️',name:hp+' max HP',detail:'Heals '+picks.map(f=>Math.ceil(hp*f.healPct/100)+' with '+nameOf(f.id).replace(/^Cooked /,'').toLowerCase()).join(', ')}});
 return {intro:'Your maximum HP is 10 × your Hitpoints level; it starts at '+HITPOINTS_START+'. Hitpoints trains with every blow you land. Food heals a share of your maximum HP, so the same fish heals more as you grow.',sources:['combat-level.js','food.js','fish-tiers.js'],tabs:[tab('health','Health',rows)]};
}

// -------------------------------------------------------------------------------- gathering
function woodcuttingGuide(){
 const L=(t,l)=>pct(skillingChance(t[0],t[1],l));
 const trees=WOODCUTTING_TREES.filter(t=>goods[t.log]).map(t=>{const tt=TREE_TIERS[t.log];return {level:t.level,item:t.log,name:tt?(t.log==='wood'?'Tree':tt.name+' tree'):nameOf(t.log),
  detail:nameOf(t.log)+' · '+xpText(t.xp)+' · chop chance '+L(t.bronze,t.level)+'–'+L(t.bronze,MAX_LEVEL)+' (bronze axe), '+L(t.iron,t.level)+'–'+L(t.iron,MAX_LEVEL)+' (iron axe)',where:tt?{cat:'woodcutting',tier:tt.short}:undefined}});
 const axes=WOODCUTTING_AXES.filter(a=>goods['weapon:'+a.weapon]).map(a=>({level:1,item:'weapon:'+a.weapon,name:nameOf('weapon:'+a.weapon),detail:'Chops with the '+a.chances+'-axe chances · carry or wield it'+(lvl(weaponCatalog[a.weapon]?.req,'attack')>1?' (wielding needs Attack '+lvl(weaponCatalog[a.weapon].req,'attack')+')':''),also:undefined}));
 return {intro:'Chop trees for logs. Any listed axe works; a better axe chops more often. Misses give no XP.',sources:['skill-guide-sql-data.js (generated from db/osrs-skill-parity.sql)','map-icons.js (TREE_TIERS)'],tabs:[tab('trees','Trees',trees),tab('axes','Axes',axes)]};
}
function miningGuide(recipes){
 const ores=enabledRecipes(recipes,'mining').filter(([,r])=>r.kind==='mine').map(([id,r])=>{const ore=r.resource||Object.keys(r.outputs||{})[0],ot=ORE_TIERS[ore],bits=[xpText(r.xp)];
  if(r.chanceLow!=null)bits.push('success '+pct(skillingChance(r.chanceLow,r.chanceHigh,r.level))+'–'+pct(skillingChance(r.chanceLow,r.chanceHigh,MAX_LEVEL)));if(r.respawn)bits.push('respawns in '+r.respawn+'s');
  const tools=toolsOf(r);if(tools.length)bits.push('needs a '+tools.join(', ').toLowerCase().replace(/^bronze /,''));
  return {level:Math.max(1,Number(r.level)||1),item:goods[ore]?ore:null,glyph:goods[ore]?undefined:'⛏',name:goods[ore]?nameOf(ore).replace(/ ore$/,'')+(/ore$/.test(nameOf(ore))||ore==='coal'?' rocks':''):r.name,detail:bits.join(' · '),recipe:id,where:ot?{cat:'mining',tier:ot.short}:undefined}});
 const picks=Object.entries(weaponCatalog).filter(([k,w])=>w.kind==='tool'&&/pick/i.test(k)).map(([k,w])=>({level:1,item:'weapon:'+k,name:nameOf('weapon:'+k),detail:'Mines every rock'+(lvl(w.req,'attack')>1?' · wielding needs Attack '+lvl(w.req,'attack'):'')}));
 return {intro:'Mine rocks for ores. Higher ores are slower and rarer; a miss keeps swinging without XP.',sources:['profession-data.js (mining recipes)','map-icons.js (ORE_TIERS)'],tabs:[tab('ores','Ores',ores),tab('tools','Pickaxes',picks)]};
}
function fishingGuide(){
 const BAIT={rod:'bait'};
 const spotsFor=(item,method)=>[...Object.entries(SPOT_TYPES).filter(([,t])=>t.catches.includes(item)&&t.methods.includes(method)).map(([k])=>k),...(LEGACY_CATCHES.includes(item)&&LEGACY_METHODS.includes(method)?['legacy']:[])];
 const seen=new Set(),fish=[];
 for(const f of fullFishTable){const key=f.item+':'+f.method;if(seen.has(key)||!goods[f.item])continue;seen.add(key);const m=allMethods[f.method]||{label:f.method},bait=m.bait||BAIT[f.method],spots=spotsFor(f.item,f.method);
  fish.push({level:f.level,item:f.item,name:nameOf(f.item),detail:m.label+' · '+nameOf(m.tool)+(bait?' + '+nameOf(bait).toLowerCase():'')+' · '+xpText(f.xp)+(spots.length?' · spots: '+spots.map(s=>s==='legacy'?'river & coast (all methods)':SPOT_TYPES[s].label).join(', '):''),where:spots.length?{cat:'fishing',tiers:spots}:undefined})}
 const tools=Object.entries(allMethods).filter(([,m])=>goods[m.tool]).map(([k,m])=>({level:Math.max(1,m.level||1),item:m.tool,name:nameOf(m.tool),detail:m.label+' fishing'+((m.bait||BAIT[k])?' · uses '+nameOf(m.bait||BAIT[k]).toLowerCase():'')}));
 return {intro:'Each spot offers two methods. The best fish you can catch is tried first, then the ones below it.',sources:['food.js (fishTable)','fish-tiers.js','water-data.js (SPOT_TYPES)'],tabs:[tab('fish','Fish',fish),tab('tools','Tools',tools)]};
}

// -------------------------------------------------------------------------------- production
const FISH_ITEMS=new Set([...fullFishTable.map(f=>f.item)]);
function cookingGuide(recipes){
 const rows={fish:[],meat:[],baking:[]};
 for(const [id,r] of enabledRecipes(recipes,'cooking')){const input=Object.keys(r.inputs||{})[0],out=Object.keys(r.outputs||{})[0],food=goods[out],row=recipeRow(id,r);
  const bits=[amounts(r.inputs)];if(food?.healPct||food?.heal)bits.push('heals '+(food.healPct?food.healPct+'% of max HP':food.heal+' HP'));
  if(r.burnChance>0)bits.push(r.stopBurn?'stops burning at '+r.stopBurn:'can burn');else if(r.station==='cooking')bits.push('never burns');
  const st=stationText(r.station);if(st)bits.push(st);bits.push(xpText(r.xp));row.detail=bits.join(' · ');
  (FISH_ITEMS.has(input)?rows.fish:/meat/i.test(input+' '+out)?rows.meat:rows.baking).push(row)}
 return {intro:'Cook on a range or a fire. Each food stops burning at its own level; burnt food gives no XP.',sources:['food.js','fish-tiers.js','profession-data.js'],tabs:[tab('fish','Fish',rows.fish),tab('meat','Meat',rows.meat),tab('baking','Bread & more',rows.baking)]};
}
function smithingGuide(recipes){
 const tabs=new Map([['bars',[]]]);for(const t of GEAR_TIERS)if(t.bar)tabs.set(t.id,[]);tabs.set('other',[]);
 const barTier=Object.fromEntries(GEAR_TIERS.filter(t=>t.bar).map(t=>[t.bar,t.id]));
 for(const [id,r] of enabledRecipes(recipes,'smithing')){
  if(r.station==='furnace'){tabs.get('bars').push(recipeRow(id,r));continue}
  const bar=Object.keys(r.inputs||{}).find(k=>barTier[k]);(tabs.get(barTier[bar])||tabs.get('other')).push(recipeRow(id,r))}
 const label=k=>k==='bars'?'Bars':k==='other'?'Other':tierById[k].name;
 return {intro:'Smelt ores into bars at a furnace, then hammer bars into gear at an anvil.',sources:['profession-data.js','gear-recipes.js','gear-tiers.js'],tabs:[...tabs.entries()].filter(([,rows])=>rows.length).map(([k,rows])=>tab(k,label(k),rows))};
}
function recipeGuide(skill,recipes,{intro,group}={}){
 const groups=new Map();
 for(const [id,r] of enabledRecipes(recipes,skill)){const g=group?.(id,r)||['recipes','Recipes'];if(!groups.has(g[0]))groups.set(g[0],{label:g[1],rows:[]});groups.get(g[0]).rows.push(recipeRow(id,r))}
 return {intro,sources:['profession-data.js'+(['fletching','smithing'].includes(skill)?', gear-recipes.js':'')],tabs:[...groups.entries()].map(([k,g])=>tab(k,g.label,g.rows))};
}
function firemakingGuide(recipes){
 return recipeGuide('firemaking',recipes,{intro:'Light logs with a tinderbox or a match. Better logs burn for more XP.'});
}
function fletchingGuide(recipes){
 return recipeGuide('fletching',recipes,{intro:'Carve shafts and bows with a knife, then fit feathers and arrowtips.',group:(id,r)=>{const out=Object.keys(r.outputs||{})[0]||'';return ARROWS[out]||/arrow|shaft/i.test(out)?['arrows','Arrows']:/bow/i.test(out)?['bows','Bows']:['other','Other']}});
}
function farmingGuide(recipes){
 return recipeGuide('farming',recipes,{intro:'Plant seeds in a farming patch; they grow while you do other things. Bushes and patches can be picked for free.',group:(id,r)=>r.kind==='plant'?['crops','Crops']:['foraging','Foraging']});
}
function agilityGuide(recipes){
 const tpl=t=>AGILITY_TEMPLATES[t]||'Obstacle';
 const fails=s=>s.fail>0?'can fail ('+Math.round(s.fail*100)+'% at the level, never '+(s.margin||20)+' levels above)':'never fails';
 const overworld=AGILITY_SHORTCUTS.map(s=>({level:s.level,glyph:'🏃',name:s.name,detail:tpl(s.template)+' · '+xpText(s.xp)+' · '+fails(s)+(s.underground?' · underground':''),where:s.underground?undefined:{cat:'agility',name:s.name}}));
 const explored=EXPLORE_SHORTCUTS.map(s=>({level:s.level,glyph:'🧗',name:s.name,detail:tpl(s.template)+' in '+(areaById(s.area)?.name||'a hidden area')+' · '+xpText(s.xp)+' · '+fails(s)}));
 const gates=PLACES.filter(p=>Number(p.entrance?.requires?.agility)>0).map(p=>({level:Number(p.entrance.requires.agility),glyph:'🗝',name:p.entrance.name,detail:'Way into '+p.name+(p.type==='hidden'?' (a hidden place)':'')}));
 const courses=enabledRecipes(recipes,'agility').map(([id,r])=>recipeRow(id,r,{useRecipeName:true,glyph:'🏃'}));
 return {intro:'Agility opens shortcuts and hidden paths, and refills run energy faster.',sources:['agility-data.js','explore-data.js','profession-data.js'],tabs:[tab('shortcuts','Shortcuts',[...overworld,...explored,...gates]),tab('training','Training',courses)]};
}
// Recipe-only skills; activities (stealing, trapping, building) keep the recipe's own name.
const named=(skill,intro,activity=false)=>recipes=>{const g=recipeGuide(skill,recipes,{intro});if(activity)for(const t of g.tabs)for(const r of t.rows)r.name=recipes[r.recipe]?.name||r.name;return g};

// ------------------------------------------------------------------------------------ the list
const BUILDERS={
 attack:attackGuide,strength:strengthGuide,defence:defenceGuide,hitpoints:hitpointsGuide,ranged:rangedGuide,magic:magicGuide,prayer:prayerGuide,
 woodcutting:woodcuttingGuide,mining:miningGuide,firemaking:firemakingGuide,fishing:fishingGuide,cooking:cookingGuide,smithing:smithingGuide,
 crafting:named('crafting','Tan, spin, sew and cut. Most crafting needs a station such as a tanning rack or spinning wheel.'),
 herblore:named('herblore','Clean herbs, fill vials and mix remedies with a pestle and mortar.'),farming:farmingGuide,agility:agilityGuide,
 thieving:named('thieving','Steal from stalls and pick locks. A failed attempt can get you caught.',true),fletching:fletchingGuide,
 runecrafting:named('runecrafting','Bind rune essence into runes at a runecrafting altar.'),
 construction:named('construction','Saw planks at a workbench and build at a work site.',true),
 hunter:named('hunter','Set a baited box trap on a hunting ground and wait for a catch.',true)
};
// Every skill in the Skills panel that has a guide, in panel order.
export const GUIDE_SKILLS=SKILL_PANEL.map(([icon,name,key])=>({id:skillId(name),name,icon,key})).filter(s=>BUILDERS[s.id]);
export const hasGuide=id=>!!BUILDERS[id];
// Build one skill's guide. `recipes` defaults to the live recipe book.
export function skillGuide(id,{recipes=liveRecipes()}={}){
 const s=GUIDE_SKILLS.find(x=>x.id===id);if(!s)return null;
 const g=BUILDERS[id](recipes);
 return {id,name:s.name,icon:s.icon,key:s.key,intro:g.intro||'',sources:g.sources||[],tabs:g.tabs.filter(t=>t.rows.length)};
}
// Row counts per guide (the owner console lists them).
export function guideSummary(opts){return GUIDE_SKILLS.map(s=>{const g=skillGuide(s.id,opts);return {id:s.id,name:s.name,icon:s.icon,tabs:g.tabs.map(t=>({label:t.label,rows:t.rows.length})),rows:g.tabs.reduce((n,t)=>n+t.rows.length,0),sources:g.sources}})}
