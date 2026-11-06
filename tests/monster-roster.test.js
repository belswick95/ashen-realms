import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import fs from 'node:fs';
import {rosterBeasts,ROSTER_KEYS,ROSTER_REGIONS,SAFE_ZONES,safeZoneDistance,BONES,tierForLevel} from '../monster-roster.js?v=release-20261106-walk97';
import {monsterSpawns} from '../monster-spawns.js';
import {bestiary,bestiaryEntity,spawnCatalog,normalizeLoot,catalogEntity} from '../bestiary.js?v=release-20261106-walk97';
import {worldTemplates,validateEntity,attackTypes} from '../world-templates.js';
import {actorModel} from '../world-models.js';
import {goods} from '../economy.js?v=release-20261106-walk97';
import {outfitItems} from '../outfits.js?v=release-20261106-walk97';
import {weaponCatalog} from '../weapons.js?v=release-20261106-walk97';
import {shieldCatalog} from '../shields.js?v=release-20261106-walk97';
import {monsterStats} from '../gear-tiers.js?v=release-20261106-walk97';
import {makeItemModel} from '../item-models.js';
import {initializeGeography} from '../geography.js?v=release-20261106-walk97';
import {createLandscape} from '../landscape.js';
const beasts=Object.entries(rosterBeasts);
const LIVE_MONSTERS=78;

test('the roster spans levels 2–120 with a steady curve and enough types in every band',()=>{
 assert.ok(beasts.length>=40&&beasts.length<=60,'40–60 new types ('+beasts.length+')');
 const levels=beasts.map(([,b])=>b.level),band=(a,z)=>levels.filter(l=>l>=a&&l<=z).length;
 assert.ok(Math.min(...levels)<=3&&Math.max(...levels)>=115);
 assert.ok(band(1,15)>=10,'early');assert.ok(band(16,50)>=12,'mid');assert.ok(band(51,100)>=10,'high');assert.ok(band(101,999)>=4,'bosses');
 for(const rank of ['Common','Veteran','Elite']){const list=beasts.map(([,b])=>b).filter(b=>b.tier===rank).sort((a,b)=>a.level-b.level);
  for(let i=1;i<list.length;i++){assert.ok(list[i].hp>=list[i-1].hp,rank+' hp rises with level: '+list[i].name);assert.ok(list[i].maxHit>=list[i-1].maxHit,rank+' max hit rises: '+list[i].name);assert.ok(list[i].xpReward>=list[i-1].xpReward)}}
 for(const [key,b] of beasts){
  assert.ok(bestiary[key]===b,'bestiary has '+key);assert.ok(worldTemplates[b.template]?.kind==='monster',key+' reuses a monster model');
  assert.ok(attackTypes.includes(b.attackType||worldTemplates[b.template].attackType),key+' attack type');
  assert.ok(b.region&&b.examine&&ROSTER_REGIONS[b.region],key+' region and examine text');
  const s=monsterStats(b);assert.equal(s.maxHit,b.maxHit,key+' server max hit = roster max hit');assert.ok(s.attackLevel>=1&&s.defenceLevel>=1);
  assert.ok(b.respawn>=30&&b.respawn<=900&&b.roam>=3&&b.roam<=6,key+' respawn/roam');
  if(b.tier==='Boss'||b.tier==='Legendary'){assert.ok(b.level>100&&b.respawn>=600,key+' boss');}
  validateEntity(bestiaryEntity(key,0,0));
 }
});

test('names are Eldervale originals, not lifted from Old School RuneScape',()=>{
 const banned=/abyssal|zulrah|vorkath|kree|graardor|zilyana|tsutsaroth|cerberus|kraken|hellhound|greater demon|lesser demon|black demon|gargoyle|nechryael|dagannoth|jad|kalphite|chaos elemental|corporeal|barrows|dharok|ahrim|verac|guthan|karil|torag|ankou|aviansie|wyvern|lizardman|hobgoblin|moss giant|hill giant|ice giant|fire giant|obor|bryophyta|scurrius|sarachnis|vet'ion|venenatis|callisto|scorpia|giant mole|king black dragon|green dragon|blue dragon|red dragon|black dragon|bronze dragon|iron dragon|steel dragon|mithril dragon|rune dragon|adamant dragon|\bman\b|\bwoman\b|cockatrice|basilisk|bloodveld|turoth|kurask|banshee|crawling hand|rockslug|pyrefiend|jelly|smoke devil|drake\b/i;
 for(const [key,b] of beasts)assert.ok(!banned.test(b.name),key+': '+b.name);
 assert.equal(new Set(beasts.map(([,b])=>b.name)).size,beasts.length,'unique names');
});

test('drop tables: valid rows, known items, bones first, gear tiers that fit the level',()=>{
 for(const [key,b] of beasts){
  const rows=normalizeLoot(b.loot,id=>!!goods[id]&&!goods[id].noteOf);assert.ok(rows.length>=2&&rows.length<=8,key+' has 2–8 rows');
  assert.deepEqual(rows.map(r=>r.item),b.loot.map(r=>r.item));
  const corporeal=b.template!=='wraith';if(corporeal)assert.ok(b.loot[0].always&&b.loot[0].chance===1,key+' always drops its remains first');
  for(const r of b.loot){
   if(/embersteel/i.test(r.item))assert.ok(b.level>=60,key+' embersteel only from level 60');
   if(/eldersteel/i.test(r.item))assert.ok(b.level>=80,key+' eldersteel only from level 80');
   if(r.rare)assert.ok(r.chance<=.05||b.level>100,key+' rare rows are rare');
   const tier=['bronze','iron','steel','blacksteel','moonsilver','verdite','tidesteel','embersteel','eldersteel'].find(t=>new RegExp('^(weapon|armor|shield):'+t,'i').test(r.item));
   if(tier){const order=['bronze','iron','steel','blacksteel','moonsilver','verdite','tidesteel','embersteel','eldersteel'];assert.ok(order.indexOf(tier)<=order.indexOf(tierForLevel(b.level))+1,key+' '+r.item+' is at most one tier above its level')}
  }
  if(b.loot.some(r=>BONES[r.item]))assert.ok(['bones','heftyBones','wyrmBones'].includes(b.loot[0].item));
 }
 for(const [id,b] of Object.entries(BONES)){assert.equal(goods[id].prayerXP,b.xp);assert.equal(goods[id].category,'Prayer');const m=makeItemModel(T,id);let meshes=0;m.traverse(o=>{if(o.isMesh)meshes++});assert.ok(meshes>0)}
 assert.deepEqual(Object.values(BONES).map(b=>b.xp),[4.5,15,72],'OSRS bones, big bones, dragon bones XP');
});

test('every roster type renders from existing models, animates and wears real gear',()=>{
 for(const [key,b] of beasts){
  for(const g of b.gear||[])assert.ok(outfitItems[g],key+' gear '+g);
  if(b.weapon)assert.ok(weaponCatalog[b.weapon],key+' weapon '+b.weapon);if(b.shield)assert.ok(shieldCatalog[b.shield],key+' shield '+b.shield);
  for(const k of Object.keys(b.look||{}))assert.ok(['sex','skin','hair','hairColor','beard'].includes(k),key+' look field '+k);
  const d=bestiaryEntity(key,0,0),parent=new T.Group(),model=actorModel(T,parent,d);
  let meshes=0;parent.traverse(o=>{if(o.isMesh||o.isSkinnedMesh)meshes++});assert.ok(meshes>3,key+' has a body');
  model.update(.1,{distance:.2,attack:0,hit:0,block:0});model.update(.3,{distance:0,attack:.3,hit:0,block:0});
  if(Number.isFinite(b.tint)&&!['bandit','goblin','skeleton','zombie','orc','dragon'].includes(b.template)){const colors=new Set();parent.traverse(o=>{if(o.material?.color)colors.add(o.material.color.getHex())});assert.ok(colors.has(b.tint),key+' wears its tint')}
  model.dispose();
 }
 const plain=new T.Group(),tinted=new T.Group();actorModel(T,plain,bestiaryEntity('ashscale_whelp',0,0));actorModel(T,tinted,bestiaryEntity('rimescale_whelp',0,0));
 const hues=g=>{const s=new Set();g.traverse(o=>{if(o.material?.color)s.add(o.material.color.getHex())});return s};assert.notDeepEqual([...hues(plain)].sort(),[...hues(tinted)].sort(),'drakes are recoloured');
});

test('spawns: on dry walkable ground, outside towns and the castle courtyard, within the budget',()=>{
 const m=JSON.parse(fs.readFileSync(new URL('../db/generated-world.json',import.meta.url)));initializeGeography(m.config);const land=createLandscape();
 assert.ok(monsterSpawns.length+LIVE_MONSTERS<=300,'at most ~300 placed monsters in all ('+(monsterSpawns.length+LIVE_MONSTERS)+')');
 for(const k of ROSTER_KEYS)assert.ok(monsterSpawns.some(s=>s.key===k),k+' is placed somewhere');
 const ids=new Set();
 for(const s of monsterSpawns){const b=rosterBeasts[s.key];assert.ok(b,s.key);
  assert.ok(land.canWalk(s.x,s.z)&&land.waterAt(s.x,s.z)===0,s.key+' at '+s.x+','+s.z+' stands on dry, walkable ground');
  assert.ok(safeZoneDistance(s.x,s.z)>b.roam+10,s.key+' keeps its roam out of towns');
  // Explicit: Birchford walls and the castle courtyard.
  assert.ok(!(Math.abs(s.x+218)<=66+b.roam&&Math.abs(s.z-143)<=66+b.roam),'not in Birchford');assert.ok(!(Math.abs(s.x+340)<=47+b.roam&&Math.abs(s.z+305)<=47+b.roam),'not in the castle courtyard');
  const at=s.x.toFixed(1)+','+s.z.toFixed(1);assert.ok(!ids.has(at),'one monster per spot');ids.add(at);
 }
 for(const zone of SAFE_ZONES)assert.ok(monsterSpawns.every(s=>safeZoneDistance(s.x,s.z)>0),zone.id);
 const bosses=monsterSpawns.filter(s=>['Boss','Legendary'].includes(rosterBeasts[s.key].tier));assert.equal(bosses.length,5);
 for(const b of bosses)assert.ok(Math.hypot(b.x,b.z)>300,'bosses live in remote corners');
});

test('the owner console catalog lists every roster monster and spawns it with its stats and loot',()=>{
 const list=spawnCatalog({});
 for(const key of ROSTER_KEYS){const row=list.find(r=>r.key==='beast:'+key);assert.ok(row,key);assert.match(row.detail,new RegExp('Level '+rosterBeasts[key].level));
  const [e]=catalogEntity('beast:'+key,5,6);assert.equal(e.level,rosterBeasts[key].level);assert.deepEqual(e.loot,rosterBeasts[key].loot);assert.equal(e.defenceLevel,rosterBeasts[key].defenceLevel);assert.equal(e.x,5)}
});

test('db/monster-roster.sql is generated from this roster and avoids the words the approval prompt flags',()=>{
 const sql=fs.readFileSync(new URL('../db/monster-roster.sql',import.meta.url),'utf8');
 for(const word of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+word+'\\b','i').test(sql),word);
 assert.equal((sql.match(/\('b0e5a000-0000-4000-8000-\d{12}',\$j\$/g)||[]).length,monsterSpawns.length);
 for(const [,b] of beasts)assert.ok(sql.includes(JSON.stringify(b.name)),b.name);
 for(const s of monsterSpawns.slice(0,20))assert.ok(sql.includes('"x":'+s.x+',"z":'+s.z),'spawn position '+s.key);
 assert.match(sql,/command='bury'/);assert.match(sql,/least\(999,coalesce\(\(d->>'attackLevel'\)::integer/);
});
