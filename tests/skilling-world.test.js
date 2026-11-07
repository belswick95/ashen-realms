// Open-world skilling areas (skilling-areas.js, db/skilling-world.sql): every node stands on
// walkable, dry land inside the world, clear of roads, towns, buildings and other objects; the
// areas are spread by level; the map shows one named marker per area; the SQL matches the data.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {initializeGeography,distanceToRoad} from '../geography.js?v=release-20261107-trail160';
import {createLandscape} from '../landscape.js';
import {safeZoneDistance} from '../monster-roster.js';
import {monsterSpawns} from '../monster-spawns.js';
import {rosterBeasts} from '../monster-roster.js';
import {capitalBlueprint} from '../capital-layout.js';
import {castleBlueprint} from '../castle-layout.js';
import {SKILLING_BLUEPRINT,skillingAreas,skillingNodes} from '../skilling-areas.js';
import {collectMarkers,clusterMarkers,markerLabel,ORE_TIERS,TREE_TIERS} from '../map-icons.js';
import {professionRecipes} from '../profession-data.js';
import {treeSpeciesOf} from '../world-models.js';

const manifest=JSON.parse(fs.readFileSync(new URL('../db/generated-world.json',import.meta.url)));initializeGeography(manifest.config);const land=createLandscape();
const sql=fs.readFileSync(new URL('../db/skilling-world.sql',import.meta.url),'utf8');
const gather=skillingNodes.filter(n=>n.template!=='furnace');
const levelOf=n=>n.template==='rock'?ORE_TIERS[n.resource].level:TREE_TIERS[n.logItem].level;

test('every node stands on walkable, dry ground inside the world bounds',()=>{
 for(const n of skillingNodes){const at=n.name+' ('+n.key+') at '+n.x+','+n.z;
  assert.ok(Math.abs(n.x)<=410&&Math.abs(n.z)<=410,at+' is inside the overworld');
  assert.ok(land.canWalk(n.x,n.z),at+' is walkable');assert.equal(land.waterAt(n.x,n.z),0,at+' is dry');assert.ok(!land.bridgeAt(n.x,n.z),at+' is not on a bridge');
  // Room to stand beside it on every side (no node walled in by water or cliffs).
  for(const r of [1,2,3])for(let i=0;i<16;i++){const a=i*Math.PI/8,x=n.x+Math.cos(a)*r,z=n.z+Math.sin(a)*r;assert.ok(land.canWalk(x,z)&&land.waterAt(x,z)===0,at+' has dry, walkable ground '+r+' m around it')}
  assert.ok(Number.isFinite(land.walkHeight(n.x,n.z)),at+' has a ground height');
 }
});

test('nodes keep off roads, town squares, buildings, the castle and other objects',()=>{
 const trail=[...fs.readFileSync(new URL('../db/professions-world.sql',import.meta.url),'utf8').matchAll(/\{"template":[^}]*\}/g)].map(x=>JSON.parse(x[0]));
 const objects=[...manifest.entities,...manifest.resources.map(r=>({template:r.kind,x:r.x,z:r.z})),...capitalBlueprint(),...castleBlueprint(),...trail].filter(d=>d.kind!=='npc'&&d.kind!=='monster'&&Number.isFinite(+d.x));
 const big=new Set(['cottage','bank','inn','forge','castle_tower','castle_gate','market','plaza','fountain','farm_hut']);
 for(const n of skillingNodes){const at=n.name+' ('+n.key+')';
  assert.ok(distanceToRoad(n.x,n.z)>7,at+' is off the roads');assert.ok(safeZoneDistance(n.x,n.z)>8,at+' is outside the towns and the castle');
  for(const d of objects){if(d.template==='road'||d.template?.startsWith('terrain_'))continue;const r=big.has(d.template)?12:d.template==='castle_wall'?(d.length||24)/2+3:3.5;assert.ok(Math.hypot(d.x-n.x,d.z-n.z)>r,at+' is clear of '+(d.name||d.template)+' at '+d.x+','+d.z)}
  for(const o of skillingNodes)if(o!==n)assert.ok(Math.hypot(o.x-n.x,o.z-n.z)>=3.5,at+' is not on top of '+o.key);
 }
});

test('OSRS-style areas: every ore and log tier, sized as asked, spread by level',()=>{
 const count=(f)=>skillingNodes.filter(f).length,by=(k,v)=>n=>n[k]===v;
 const site=name=>skillingNodes.filter(n=>n.site===name);
 assert.ok(site('Birchford copper & tin mine').length>=6&&site('Birchford copper & tin mine').length<=8);
 assert.ok(count(by('resource','ore'))>=5&&count(by('resource','ore'))<=6,'iron mine has 5–6 rocks');
 assert.ok(count(by('resource','coal'))>=6&&count(by('resource','coal'))<=8,'coal field has 6–8 rocks');
 for(const r of ['silverOre','goldOre','mithrilOre','adamantOre'])assert.ok(count(by('resource',r))>=2,r);
 assert.equal(count(by('resource','runiteOre')),2,'a small tidestone outcrop');
 assert.ok(count(by('logItem','yewLogs'))>=3&&count(by('logItem','yewLogs'))<=5,'3–5 yews');
 for(const l of ['wood','oakLogs','willowLogs','mapleLogs'])assert.ok(count(by('logItem',l))>=3,l);
 assert.equal(count(by('template','furnace')),1);const furnace=skillingNodes.find(by('template','furnace'));assert.ok(skillingNodes.some(n=>n.resource==='coal'&&Math.hypot(n.x-furnace.x,n.z-furnace.z)<12),'the furnace stands at the coal field');
 for(const n of gather)assert.ok(professionRecipes[n.template==='rock'?'mine_'+n.resource:'burn_'+n.logItem],n.key+' gives an item the engine knows');
 // Low levels near the starting towns, the highest far out beside strong monsters.
 const birchford={x:-218,z:143},castle={x:-340,z:-305},home=n=>Math.min(Math.hypot(n.x-birchford.x,n.z-birchford.z),Math.hypot(n.x-castle.x,n.z-castle.z));
 for(const n of gather)if(levelOf(n)===1)assert.ok(home(n)<160,n.key+' (level 1) is near a starting town');
 for(const n of gather)if(n.template==='rock'&&levelOf(n)>=55)assert.ok(home(n)>200,n.key+' (level '+levelOf(n)+') is far from the starting towns');
 const danger=n=>Math.max(0,...monsterSpawns.filter(s=>Math.hypot(s.x-n.x,s.z-n.z)<90).map(s=>rosterBeasts[s.key].level));
 for(const n of gather.filter(by('resource','runiteOre')))assert.ok(danger(n)>=58,'tidestone sits among level 58+ monsters');
 for(const n of gather.filter(n=>['mithrilOre','adamantOre'].includes(n.resource)))assert.ok(danger(n)>=30,n.key+' is in tougher land');
 assert.ok(skillingNodes.filter(by('logItem','willowLogs')).every(n=>{for(let r=3;r<=20;r+=1)for(let i=0;i<32;i++)if(land.waterAt(n.x+Math.cos(i*Math.PI/16)*r,n.z+Math.sin(i*Math.PI/16)*r)>0)return true;return false}),'willows grow beside the water');
 assert.ok(skillingNodes.filter(by('logItem','willowLogs')).every(n=>treeSpeciesOf(n)==='willow'),'willow logs grow on willow trees');
});

test('the map shows one named marker per area, with the level and the Eldervale metal names',()=>{
 const clusters=clusterMarkers(collectMarkers({rows:skillingNodes.map(n=>({kind:'object',...n}))}));
 for(const a of skillingAreas){const c=clusters.find(c=>c.name===a.name);assert.ok(c,a.name+' has a marker');
  assert.equal(c.count,a.count,a.name+' merges all its nodes');assert.ok(Math.hypot(c.x-a.x,c.z-a.z)<6)}
 const label=n=>markerLabel(clusters.find(c=>c.name===n));
 assert.equal(label('Highmoor coal field'),'Highmoor coal field (Mining 30)');
 assert.equal(label('Cairnhill iron mine'),'Cairnhill iron mine (Mining 15)');
 assert.equal(label('Sunscar silver & gold mine'),'Sunscar silver & gold mine (Mining 20–40)');
 assert.equal(label('Cragmaw moonsilver mine'),'Cragmaw moonsilver mine (Mining 55)');
 assert.equal(label('Rimeback verdite ridge'),'Rimeback verdite ridge (Mining 70)');
 assert.equal(label('Blighted tidestone outcrop'),'Blighted tidestone outcrop (Mining 85)');
 assert.equal(label('Hermit’s yew grove'),'Hermit’s yew grove (Woodcutting 60)');
 assert.equal(label('Birchford woodlot'),'Birchford woodlot (Woodcutting 1–15)');
 assert.ok(clusters.some(c=>c.cat==='furnace'&&c.name==='Highmoor furnace'));
 for(const c of clusters)assert.doesNotMatch(markerLabel(c),/mithril|adamant|runite/i);
 for(const n of skillingNodes)assert.doesNotMatch(n.name+' '+n.site,/mithril|adamant|runite/i);
 for(const id of ['mithrilOre','adamantOre','runiteOre'])assert.doesNotMatch(ORE_TIERS[id].name,/mithril|adamant|runite/i);
});

test('db/skilling-world.sql places exactly these rows, idempotently, without flagged words',()=>{
 for(const word of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+word+'\\b','i').test(sql),word);
 assert.equal(new Set(skillingNodes.map(n=>n.id)).size,skillingNodes.length);
 for(const n of skillingNodes){assert.match(n.id,/^5c111000-0000-4000-8000-\d{12}$/);assert.ok(sql.includes('"id":"'+n.id+'","key":"'+n.key+'"'),n.key);assert.ok(sql.includes('"x":'+n.x+',"z":'+n.z),n.key+' position')}
 assert.ok(sql.includes('"blueprint":"'+SKILLING_BLUEPRINT+'"'));
 assert.match(sql,/where id=\(row->>'id'\)::uuid or data->>'skillingKey'=row->>'key'\) then continue/,'existing rows (owner edits, removals) are left alone');
 assert.match(sql,/on conflict\(id\) do nothing/);assert.match(sql,/eldervale_private\.can_step/);
});
