// Places the open-world skilling areas (mines, tree groves and their furnace) on walkable,
// dry, level ground away from roads, towns, buildings and other objects, deterministically,
// and writes skilling-areas.js. db/skilling-world.sql is built from that file by
// scripts/build-skilling-world-sql.mjs; tests/skilling-world.test.js checks both.
// usage: node --import ./tests/helpers/preload.js scripts/plan-skilling-areas.mjs
import fs from 'node:fs';
import {initializeGeography,distanceToRoad} from '../geography.js?v=release-20261107-busy164';
import {createLandscape} from '../landscape.js';
import {safeZoneDistance} from '../monster-roster.js';
import {capitalBlueprint} from '../capital-layout.js';
import {castleBlueprint} from '../castle-layout.js';
const root=new URL('../',import.meta.url);
const m=JSON.parse(fs.readFileSync(new URL('db/generated-world.json',root)));initializeGeography(m.config);const land=createLandscape();
// Live structures (rounded, with a radius) the monster planner already keeps clear of.
const blockers=JSON.parse(fs.readFileSync(new URL('scripts/monster-roster-db/blockers.json',root)));
// Everything placed by the repo's own seeds: towns, castle, capital and the starter trail.
const trail=[...fs.readFileSync(new URL('db/professions-world.sql',root),'utf8').matchAll(/\{"template":[^}]*\}/g)].map(x=>JSON.parse(x[0]));
const BUILDING=new Set(['cottage','bank','inn','forge','castle_tower','castle_gate','castle_wall','market','plaza','fountain','farm_hut']);
// Base scenery (the generated forest and boulders) blocks its tile too.
const placed=[...m.entities,...m.resources.map(r=>({template:r.kind,x:r.x,z:r.z})),...capitalBlueprint(),...castleBlueprint(),...trail].filter(d=>d.kind!=='npc'&&d.kind!=='monster'&&!['road','terrain_stone','terrain_grass'].includes(d.template)&&Number.isFinite(+d.x));
const clearOf=(x,z)=>placed.every(d=>Math.hypot(d.x-x,d.z-z)>(BUILDING.has(d.template)?(d.template==='castle_wall'?(d.length||24)/2+4:14*(d.scale||1)):4.5))&&blockers.every(([bx,bz,r])=>Math.hypot(bx-x,bz-z)>r+3);
const slope=(x,z)=>Math.hypot(land.heightAt(x+1,z)-land.heightAt(x-1,z),land.heightAt(x,z+1)-land.heightAt(x,z-1))/2;
// A node needs dry, gentle, walkable ground under its footprint and a ring around it to stand on.
export function goodGround(x,z){
 if(!land.canWalk(x,z)||land.waterAt(x,z)>0||land.bridgeAt(x,z)||slope(x,z)>.45)return false;
 for(const [dx,dz] of [[-1.6,-1],[-1.6,1],[1.6,-1],[1.6,1]])if(!land.canWalk(x+dx,z+dz))return false;
 for(const r of [1,2,3])for(let i=0;i<16;i++){const a=i*Math.PI/8,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;if(!land.canWalk(px,pz)||land.waterAt(px,pz)>0)return false}
 return distanceToRoad(x,z)>7&&safeZoneDistance(x,z)>8;
}
const N=(t,n,extra={})=>Array.from({length:n},()=>({template:t,...extra}));
const rock=(resource,name,n)=>N('rock',n,{resource,name});
const tree=(logItem,name,n,extra={})=>N(logItem==='yewLogs'?'pine':'tree',n,{logItem,name,...extra});
// OSRS-like regrowth and yields per tree tier (gathering-actions.sql reads these fields).
const WOOD={wood:{resourceRespawn:30,resourceMinLogs:1,resourceMaxLogs:1},oakLogs:{resourceRespawn:30,resourceMinLogs:1,resourceMaxLogs:4},willowLogs:{resourceRespawn:30,resourceMinLogs:2,resourceMaxLogs:6},mapleLogs:{resourceRespawn:60,resourceMinLogs:2,resourceMaxLogs:6},yewLogs:{resourceRespawn:120,resourceMinLogs:3,resourceMaxLogs:8}};
// [key, site name, centre x, z, search radius, note, nodes]
export const AREAS=[
 ['birchford-mine','Birchford copper & tin mine',-300,15,12,'Starter mine north-west of Birchford, by the Thornwood edge spiders (combat 5).',[...rock('copperOre','Copper rocks',4),...rock('tinOre','Tin rocks',3)]],
 ['birchford-grove','Birchford woodlot',-160,235,14,'Normal and oak trees south of Birchford’s walls.',[...tree('wood','Tree',3),...tree('oakLogs','Oak tree',4)]],
 ['kingsroad-grove','Kingsroad oak grove',-262,-228,14,'Normal and oak trees on the meadows south-east of the castle (rats and goblins, combat 2–4).',[...tree('wood','Tree',3),...tree('oakLogs','Oak tree',3)]],
 ['riverbank-willows','Riverbank willows',-100,21,13,'Willows on the south bank of the river north-east of Birchford, by the balance-log crossing.',tree('willowLogs','Willow tree',5,{treeType:'willow'})],
 ['cairnhill-iron','Cairnhill iron mine',42,-170,12,'Iron in the foothills of the Frostbound highlands, between Cairn hollow and Frostfang pass (combat 13–26).',rock('ore','Iron rocks',6)],
 ['highmoor-coal','Highmoor coal field',118,-208,14,'Coal on the high moor below Frostfang pass (combat 19–26), with a furnace.',[...rock('coal','Coal rocks',7),{template:'furnace',name:'Highmoor furnace'}]],
 ['sunscar-mine','Sunscar silver & gold mine',118,190,14,'Silver and gold in the Amber Expanse near the Sandscar hideout (combat 22–25).',[...rock('silverOre','Silver rocks',3),...rock('goldOre','Gold rocks',3)]],
 ['amberleaf-maples','Amberleaf maple grove',28,252,14,'Maples on the southern uplands between the Brigand thicket and the Cinderwing roost (combat 15–18).',tree('mapleLogs','Maple tree',5)],
 ['hermit-yews','Hermit’s yew grove',-396,-128,14,'A quiet stand of yews on the far western edge, away from roads and monsters.',tree('yewLogs','Yew tree',4)],
 ['cragmaw-moonsilver','Cragmaw moonsilver mine',372,-118,14,'Moonsilver under the Cragmaw heights, home of the ogres (combat 46).',rock('mithrilOre','Moonsilver rocks',4)],
 ['rimeback-verdite','Rimeback verdite ridge',338,-270,14,'Verdite on the frozen ridge above the Rimeback crags (trolls and wraiths, combat 33–36).',rock('adamantOre','Verdite rocks',3)],
 ['blighted-tidestone','Blighted tidestone outcrop',-130,-398,12,'Two tidestone rocks on the northern edge between the Hollowmere cairns and the Blighted Reach (cairn knights, phantoms and dread knights, combat 34–105).',rock('runiteOre','Tidestone rocks',2)]
];
function rng(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}}
const hash=s=>[...s].reduce((h,c)=>Math.imul(h^c.charCodeAt(0),16777619)>>>0,2166136261);
const nodes=[],areas=[],failures=[];let serial=0;
for(const [key,site,cx,cz,radius,note,list] of AREAS){
 const random=rng(hash(key)),mine=[];
 // Candidates: a 1.5 m lattice inside the search circle, nearest the centre first.
 const cand=[];for(let dx=-radius;dx<=radius;dx+=1.5)for(let dz=-radius;dz<=radius;dz+=1.5){if(dx*dx+dz*dz>radius*radius)continue;const x=Math.round((cx+dx)*10)/10,z=Math.round((cz+dz)*10)/10;cand.push({x,z,d:Math.hypot(dx,dz)+random()*2.5})}
 cand.sort((a,b)=>a.d-b.d);
 for(const n of list){const space=n.template==='rock'?3.6:n.template==='furnace'?6:4.6;
  const spot=cand.find(c=>(n.template!=='furnace'||c.d>5)&&mine.every(p=>Math.hypot(p.x-c.x,p.z-c.z)>=space)&&nodes.every(p=>Math.hypot(p.x-c.x,p.z-c.z)>=space)&&goodGround(c.x,c.z)&&clearOf(c.x,c.z));
  if(!spot){failures.push(n.name+' in '+site);continue}
  serial++;const row={id:'5c111000-0000-4000-8000-'+String(serial).padStart(12,'0'),key:key+'-'+(mine.length+1),site,...n,...(n.logItem?WOOD[n.logItem]:{}),x:spot.x,z:spot.z,yaw:Math.round(random()*360-180)};
  mine.push(row);nodes.push(row)}
 const xs=mine.map(n=>n.x),zs=mine.map(n=>n.z);
 areas.push({key,name:site,x:Math.round(xs.reduce((a,b)=>a+b,0)/xs.length),z:Math.round(zs.reduce((a,b)=>a+b,0)/zs.length),note,count:mine.filter(n=>n.template!=='furnace').length});
}
if(failures.length){console.error('No room for:\n '+failures.join('\n '));process.exit(1)}
const text='// Generated by scripts/plan-skilling-areas.mjs: the open-world mines, tree groves and their\n// furnace. db/skilling-world.sql (scripts/build-skilling-world-sql.mjs) places these rows;\n// tests/skilling-world.test.js checks every node stands on walkable land inside the world.\n'+
 "export const SKILLING_BLUEPRINT='skilling-world-v1';\nexport const skillingAreas=[\n"+areas.map(a=>' '+JSON.stringify(a)).join(',\n')+'\n];\nexport const skillingNodes=[\n'+nodes.map(n=>' '+JSON.stringify(n)).join(',\n')+'\n];\n';
fs.writeFileSync(new URL('skilling-areas.js',root),text);
console.log(areas.map(a=>a.name.padEnd(30)+String(a.x).padStart(5)+String(a.z).padStart(5)+'  '+a.count).join('\n'));
