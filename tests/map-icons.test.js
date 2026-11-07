// Map icons (map-icons.js): category mapping from world data, clustering into one marker per
// area, tooltip text with the level, owner overrides, the zoom grouping of world-map.js, the
// console's overrides document (admin-map-markers.js) and the SQL that stores it.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {MARKER_CATS,MARKER_GROUPS,LINK,ORE_TIERS,TREE_TIERS,FISH_TIERS,GLYPH_KINDS,classifyEntity,classifyBuilding,shopKind,collectMarkers,clusterMarkers,clusterName,markerLabel,requirementText,applyOverrides,markerId,joinNames,inkFor,drawMarkerIcon,loadFilters,saveFilters} from '../map-icons.js';
import {zoomLink,markersForZoom} from '../world-map.js';
import {markerOverrides} from '../admin-map-markers.js';
import {dungeons} from '../underground-data.js';
import {BOSSES,LAIRS} from '../bosses.js';
import {rosterBeasts} from '../monster-roster.js';
import {monsterSpawns} from '../monster-spawns.js';
import {shortcuts,shortcutEntity} from '../agility-data.js';
import {extraFishingSpots} from '../water-data.js';
import {PLACES} from '../explore-data.js';

const at=(o,x=0,z=0)=>({x,z,...o});

test('categories: every kind has a label, group, colour and glyph; tier tables follow the skill levels',()=>{
 const groups=new Set(MARKER_GROUPS.map(g=>g[0]));
 for(const [k,d] of Object.entries(MARKER_CATS)){assert.ok(d.label&&d.plural,k);assert.ok(groups.has(d.group),k);assert.match(d.color,/^#[0-9a-f]{6}$/i,k);assert.ok(GLYPH_KINDS.includes(k),k+' has a glyph');assert.ok(k in LINK,k+' has a link distance')}
 assert.deepEqual([ORE_TIERS.copperOre.level,ORE_TIERS.ore.level,ORE_TIERS.coal.level,ORE_TIERS.mithrilOre.level,ORE_TIERS.adamantOre.level,ORE_TIERS.runiteOre.level],[1,15,30,55,70,85]);
 assert.ok(ORE_TIERS.runiteOre.rank>ORE_TIERS.mithrilOre.rank&&ORE_TIERS.mithrilOre.rank>ORE_TIERS.copperOre.rank);
 assert.deepEqual(Object.values(TREE_TIERS).map(t=>t.level),[1,15,30,45,60]);
 assert.equal(FISH_TIERS.shore.level,1);assert.ok(FISH_TIERS.deep.level>=50&&FISH_TIERS.deep.max>=80);
 assert.equal(inkFor('#f2c64e'),'#20160a');assert.equal(inkFor('#2c4a2a'),'#fff6dc');
});

test('category mapping: world rows and buildings become the right marker kinds',()=>{
 const kind=d=>classifyEntity(at(d))?.cat??null;
 assert.equal(kind({template:'rock',resource:'mithrilOre'}),'mining');assert.equal(kind({template:'essence_rock'}),'mining');
 const iron=classifyEntity(at({template:'rock'}));assert.equal(iron.tier,'ore');assert.equal(iron.min,15,'a rock without a resource gives iron ore');
 const yew=classifyEntity(at({template:'pine',logItem:'yewLogs'}));assert.equal(yew.cat,'woodcutting');assert.equal(yew.min,60);assert.equal(yew.skill,'Woodcutting');
 assert.equal(classifyEntity(at({template:'tree',treeType:'yew'})).tier,'yewLogs');
 assert.equal(kind({template:'tree'}),null,'ordinary scenery trees are not markers');assert.equal(kind({template:'tree',logItem:'wood'}),null);
 const cage=classifyEntity(at({template:'fishing_spot',spotType:'cage'}));assert.equal(cage.cat,'fishing');assert.equal(cage.min,35);
 assert.equal(classifyEntity(at({template:'fishing_spot'})).tier,'legacy');
 for(const [t,c] of [['hearth','cooking'],['campfire','cooking'],['furnace','furnace'],['anvil','smithing'],['forge','smithing'],['spinning_wheel','crafting'],['tanning_rack','crafting'],['workbench','crafting'],
  ['herb_patch','farming'],['farming_patch','farming'],['thieving_stall','skill'],['bank','bank'],['banker','bank'],['inn','inn'],['innkeeper','inn'],['altar','altar'],['rune_altar','altar'],['chapel','altar'],
  ['log_balance','agility'],['rope_swing','agility'],['cave_mouth','dungeon'],['crypt_door','dungeon'],['mine_shaft','dungeon'],['trapdoor','dungeon'],['ferry_boat','boat'],['portal','teleport']])assert.equal(kind({template:t}),c,t);
 for(const t of ['cottage','road','lantern','bench','villager','guard','fountain','cave_exit','ladder_down'])assert.equal(kind({template:t}),null,t);
 assert.equal(kind({kind:'monster',template:'wolf',level:7}),null,'monsters are grouped from the spawn plan, not one marker each');
 const dragon=classifyEntity(at({kind:'monster',template:'dragon',name:'Ember dragon',level:75}));assert.equal(dragon.cat,'dragon');assert.equal(dragon.min,75);
 assert.equal(classifyEntity(at({template:'stepping_stones',agility:{level:15}})).min,15);
 assert.equal(kind({template:'cave_mouth',passage:{area:'x',depth:-1}}),null,'a way out is not an entrance');
 // Shops by name, then by stock.
 assert.equal(shopKind('Mortar & Mint Apothecary'),'apothecary');assert.equal(shopKind('Edgewright’s Blades'),'weapons');assert.equal(shopKind('Hollin’s Plate & Mail'),'armour');assert.equal(shopKind('Fletch & Flight Archery'),'weapons');
 assert.equal(shopKind('Crumb & Crust Bakery',['bread','berryPie']),'general');assert.equal(shopKind('Stall',['weapon:dagger','weapon:longsword','bread']),'weapons');assert.equal(shopKind('Stall',{healingPotion:{},vial:{}}),'apothecary');
 assert.equal(kind({template:'merchant',name:'Sorrel the Apothecary'}),'apothecary');assert.equal(kind({template:'market',name:'Birchford market'}),'general');
 assert.equal(classifyBuilding({type:'shop',name:'Edgewright’s Blades',x:1,z:1}).cat,'weapons');assert.equal(classifyBuilding({type:'bank',name:'B',x:1,z:1}).cat,'bank');assert.equal(classifyBuilding({type:'home',x:1,z:1}),null);
 assert.equal(classifyEntity({template:'rock',x:NaN,z:0}),null);
});

test('clustering: six nearby copper and tin rocks show as one "Copper & tin mine"',()=>{
 const rocks=[0,1,2,3,4,5].map(i=>at({template:'rock',resource:i%2?'tinOre':'copperOre'},i*4,(i%3)*3)).map(classifyEntity);
 const far=classifyEntity(at({template:'rock',resource:'runiteOre'},200,200));
 const out=clusterMarkers([...rocks,far]);
 assert.equal(out.length,2);const mine=out.find(c=>c.count===6);
 assert.equal(mine.name,'Copper & tin mine');assert.equal(markerLabel(mine),'Copper & tin mine (lvl 1 Mining)');
 assert.ok(Math.abs(mine.x-10)<.01,'count-weighted centre');
 assert.equal(out.find(c=>c.count===1).name,'Runite mine');
 // Chains merge (single linkage) and the label gives the level range and best-tier tint.
 const trail=['copperOre','tinOre','ore','coal','silverOre','goldOre','mithrilOre','adamantOre','runiteOre'].map((r,i)=>classifyEntity(at({template:'rock',resource:r},i*5,0)));
 const [one]=clusterMarkers(trail);assert.equal(one.count,9);assert.equal(one.name,'Copper-to-runite mine');assert.equal(requirementText(one),'Mining 1–85');assert.equal(one.tierColor,ORE_TIERS.runiteOre.color);
 // Different kinds never merge, order does not matter, custom markers never merge.
 const mixed=[classifyEntity(at({template:'anvil'},0,0)),classifyEntity(at({template:'furnace'},1,0)),{cat:'custom',x:0,z:0,name:'A'},{cat:'custom',x:0,z:0,name:'B'}];
 assert.equal(clusterMarkers(mixed).length,4);
 const shuffled=clusterMarkers([...rocks].reverse());assert.equal(shuffled.length,1);assert.equal(shuffled[0].name,'Copper & tin mine');
 // Trees by tier, sorted in tier order whatever the input order.
 const trees=clusterMarkers([['yewLogs',0],['oakLogs',5]].map(([l,x])=>classifyEntity(at({template:'tree',logItem:l},x,0))));
 assert.equal(trees[0].name,'Oak & yew trees');assert.equal(markerLabel(trees[0]),'Oak & yew trees (Woodcutting 15–60)');
 assert.equal(markerLabel(clusterMarkers([classifyEntity(at({template:'pine',logItem:'yewLogs'}))])[0]),'Yew trees (lvl 60 Woodcutting)');
 // A building's name beats the NPC who works there.
 const bank=clusterMarkers([{...classifyEntity(at({template:'banker',name:'Odell the Banker'},1,1)),npc:true},classifyEntity(at({template:'bank',name:'West Bank'},0,0))]);
 assert.equal(bank.length,1);assert.equal(bank[0].name,'West Bank');
 assert.equal(joinNames(['a','b','c']),'a, b & c');assert.equal(clusterName({cat:'general',names:['x','y']}),'2 shops');
});

test('the world: caves show the boss inside, lairs are boss markers, training areas carry level ranges',()=>{
 const raw=collectMarkers({areas:[...dungeons,...LAIRS],bosses:BOSSES,lairs:LAIRS.map(l=>l.id),roster:rosterBeasts,spawns:monsterSpawns,shortcuts:shortcuts.map(s=>shortcutEntity(s)).filter(Boolean),fishing:extraFishingSpots,places:PLACES});
 const all=clusterMarkers(raw),label=c=>markerLabel(c);
 for(const c of all){assert.ok(Math.abs(c.x)<=430&&Math.abs(c.z)<=430,'overworld only: '+c.name);assert.ok(c.name,'named')}
 const cinder=all.find(c=>c.cat==='dungeon'&&c.areaName==='Cindervault Depths');assert.equal(cinder.badge,'boss');assert.match(label(cinder),/Cindervault Depths \(combat 55–100\) · Boss inside: The Ashen Colossus \(combat 120\)/);
 const hollow=all.find(c=>c.areaName==='Hollowmere Undercroft');assert.match(label(hollow),/Boss inside: The Hollow King \(combat 105\)/);
 const birch=all.find(c=>c.areaName==='Birchroot Hollow');assert.equal(birch.cat,'dungeon');assert.equal(birch.badge,null);assert.equal(requirementText(birch),'combat 3–20');
 const lairs=all.filter(c=>c.cat==='boss');assert.equal(lairs.length,LAIRS.length,'one boss marker per lair entrance');
 const grim=lairs.find(c=>/Grimtusk/.test(c.name));assert.match(label(grim),/^Grimtusk lair \(boss, combat 102\).*needs combat 70/);
 assert.ok(lairs.some(c=>c.dragon),'the wyrm lairs say dragon');
 assert.ok(!raw.some(m=>m.cat==='boss'&&!m.entrance),'retired open-world boss spawns are not markers');
 const pass=all.find(c=>c.cat==='training'&&c.name==='Frostfang pass');assert.equal(requirementText(pass),'combat 19–26');assert.ok(pass.mobs.length>=2);
 assert.ok(all.filter(c=>c.cat==='dragon').length>=3,'whelp nests');
 assert.equal(all.filter(c=>c.cat==='agility').length,shortcuts.filter(s=>!s.underground).length);
 assert.ok(all.some(c=>c.cat==='boat'&&/Gullwing/.test(c.name)));
 assert.ok(all.filter(c=>c.cat==='fishing').some(c=>c.min>=50),'deep-sea spots are marked as high level');
 assert.ok(!all.some(c=>/Veilfall|Thornveil|Brinehook|Quiet Lamp/.test(c.name)),'hidden places stay hidden');
});

test('owner overrides: hide, rename and custom markers; the console document and the SQL agree',()=>{
 const base=clusterMarkers([classifyEntity(at({template:'anvil',name:'Old anvil'},10,10)),classifyEntity(at({template:'bank',name:'Bank'},50,50))]).map(c=>({...c,id:markerId(c)}));
 assert.deepEqual(base.map(c=>c.id).sort(),['bank:50:50','smithing:10:10']);
 const cfg={hidden:['bank:50:50'],names:{'smithing:10:10':'Guild anvil'},custom:[{cat:'boss',name:'Owner arena',x:5,z:-5},{cat:'nope',name:'bad',x:0,z:0},{cat:'custom',name:'far',x:4000,z:0}]};
 const out=applyOverrides(base,cfg);assert.deepEqual(out.map(c=>c.name),['Guild anvil','Owner arena']);assert.equal(out[1].id,'custom:5:-5');
 assert.equal(markersForZoom(out,1,18).find(c=>c.cat==='smithing').name,'Guild anvil','renames survive the zoom grouping');
 // Console document: trimmed, bounded, ids from rounded positions.
 const doc=markerOverrides({hidden:['bank:50:50','bank:50:50','junk'],names:{'smithing:10:10':'  Guild anvil ','bank:50:50':''},custom:[{cat:'boss',name:' Owner arena ',x:5.04,z:-5}]});
 assert.deepEqual(doc,{hidden:['bank:50:50'],names:{'smithing:10:10':'Guild anvil'},custom:[{id:'custom:5:-5',cat:'boss',name:'Owner arena',x:5,z:-5}]});
 assert.throws(()=>markerOverrides({custom:[{cat:'boss',name:'x',x:900,z:0}]}),/overworld/);
 assert.throws(()=>markerOverrides({custom:[{cat:'zzz',name:'x',x:0,z:0}]}),/kind/);
 assert.throws(()=>markerOverrides({custom:[{cat:'boss',name:'a',x:1,z:1},{cat:'boss',name:'b',x:1.2,z:1}]}),/same spot/);
 const sql=fs.readFileSync(new URL('../db/map-icons.sql',import.meta.url),'utf8');
 assert.doesNotMatch(sql,/\b(delete|alter|drop)\b/i,'no destructive keywords');
 assert.match(sql,/create or replace function eldervale_private\.admin_map_markers/);assert.match(sql,/soft_patch\('eldervale_private\.public_game_config\(\)','mapMarkers'/);
 const kinds=sql.match(/array\['boss'[^\]]*\]/)[0].match(/'([a-z]+)'/g).map(s=>s.slice(1,-1));assert.deepEqual(kinds.sort(),Object.keys(MARKER_CATS).sort(),'SQL kinds match MARKER_CATS');
});

test('zoom grouping and viewer filters',()=>{
 // Further out, the link distance grows (bucketed, so a slow zoom reuses the grouping).
 assert.ok(zoomLink(.5)>zoomLink(4));assert.equal(zoomLink(1,18),zoomLink(1.02,18));
 const items=clusterMarkers([0,30,60].map(x=>classifyEntity(at({template:'anvil',name:'A'+x},x,0))));assert.equal(items.length,3);
 const cache=new Map();assert.equal(markersForZoom(items,.4,18,cache).length,1,'merged at a far zoom');assert.equal(markersForZoom(items,4,18,cache).length,3,'apart when zoomed in');assert.equal(cache.size,2);
 assert.match(markersForZoom(items,.4,18)[0].name,/3 smithies/);
 const store=new Map(),fake={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 saveFilters(new Set(['training','quest']),fake);assert.deepEqual([...loadFilters(fake)].sort(),['quest','training']);
 assert.equal(loadFilters({getItem(){throw Error('blocked')}}).size,0,'storage may be unavailable');
});

test('glyphs draw on a 2D context without throwing',()=>{
 const calls=[];const ctx=new Proxy({},{get:(t,k)=>k in t?t[k]:(...a)=>{calls.push(k)},set:(t,k,v)=>{t[k]=v;return true}});
 for(const k of Object.keys(MARKER_CATS))drawMarkerIcon(ctx,k,10,10,18,{badge:k==='dungeon'?'boss':null});
 assert.ok(calls.includes('arc')&&calls.includes('stroke')&&calls.includes('fill'));
});
