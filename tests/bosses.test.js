import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';
import {BOSSES,bossById,validateBoss,telegraphTiles,breathMultiplier,BREATH_DEFAULTS,phaseAt,nextAttack,attackTicksFor,enraged,formatTicks,LAIRS,LAIR_EXTENSIONS,withLair,bossDrops,parseOneIn} from '../bosses.js';
import {dungeons,validateDungeon,rasterize,passageObjects,THEMES} from '../underground-data.js';
import {UNIQUE_ITEMS,QUEST_REWARD_ITEMS,BOSS_UNIQUE_ITEMS,uniqueById,UNIQUE_SPECIALS} from '../unique-gear.js';
import {ROSTER_KEYS} from '../monster-roster.js';
import {lairsSql,gearSql,catalogRows,newMonsterTemplates} from '../scripts/build-bosses-sql.mjs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('boss definitions: valid, every phase opens at its threshold, every boss has 3 phases, an enrage, uniques and a lair',()=>{
 const roster=new Set([...ROSTER_KEYS,...newMonsterTemplates().map(t=>t.key)]);
 assert.equal(BOSSES.length,6);
 for(const b of BOSSES){assert.deepEqual(validateBoss(b,{roster}),[],b.id);assert.equal(b.phases.length,3);assert.ok(b.enrage.afterTicks>=200);assert.ok(b.uniques.length>=2);assert.ok(roster.has(b.roster),b.id);
  const kinds=new Set(Object.values(b.attacks).map(a=>a.kind));assert.ok(kinds.has('telegraph')||kinds.has('breath'),b.id+' has a movement or breath mechanic');assert.ok(kinds.has('summon'),b.id+' summons adds');
  for(const a of Object.values(b.attacks))if(['telegraph','charge','breath'].includes(a.kind))assert.ok(a.text!==undefined||a.kind==='telegraph','tell text '+a.name);
  for(const u of b.uniques){const p=parseOneIn(u.chance);assert.ok(p>=1/1024&&p<=1/96,u.item+' OSRS-like rarity');assert.ok(UNIQUE_ITEMS.some(x=>x.catalogId===u.item),u.item)}}
 // The dragon boss: flight, fire and frost breath, tail swipe; the Hollow King switches magic and ranged.
 const v=bossById.twinflame_wyrm;assert.ok(['flight','breath'].every(k=>Object.values(v.attacks).some(a=>a.kind===k)));assert.deepEqual(new Set(Object.values(v.attacks).filter(a=>a.kind==='breath').map(a=>a.element)),new Set(['fire','frost']));
 const hk=bossById.hollow_king.phases[0].pattern.map(k=>bossById.hollow_king.attacks[k].style).filter(Boolean);assert.ok(hk.includes('magic')&&hk.includes('ranged'));
 assert.ok(validateBoss({...bossById.grimtusk,phases:[{at:90,pattern:['cleave']}]}).some(e=>/100/.test(e)));
 assert.ok(validateBoss({...bossById.grimtusk,attacks:{x:{kind:'telegraph',shape:'blob',maxHit:5}}}).length>0);
});

test('fight maths: phase thresholds, pattern cycling, enrage, telegraph shapes, breath protection',()=>{
 const g=bossById.grimtusk;assert.deepEqual([100,67,66,34,33,1].map(p=>phaseAt(g,p)),[0,0,1,1,2,2]);
 assert.equal(nextAttack(g,0,0),'cleave');assert.equal(nextAttack(g,0,2),'earthsplitter');assert.equal(nextAttack(g,0,5),'cleave');
 assert.equal(attackTicksFor(g,0,false),5);assert.equal(attackTicksFor(g,2,true),3);assert.equal(enraged(g,249),false);assert.equal(enraged(g,250),true);
 assert.equal(telegraphTiles('target',{c:[0,0],radius:1}).length,9);assert.equal(telegraphTiles('around',{b:[0,0],radius:2}).length,24);
 assert.equal(telegraphTiles('line',{c:[5,0],b:[0,0],radius:8}).length,24);assert.ok(telegraphTiles('line',{c:[5,0],b:[0,0],radius:8}).every(([i])=>i>0),'the line runs toward the target');
 assert.ok(telegraphTiles('behind',{c:[5,0],b:[0,0],radius:4}).every(([i])=>i<0),'tail swipe hits behind');assert.ok(!telegraphTiles('ring',{b:[0,0],radius:5}).some(([i,j])=>Math.max(Math.abs(i),Math.abs(j))<4),'ring: close in is safe');
 assert.equal(breathMultiplier({}),1);assert.equal(breathMultiplier({shield:'scalewardShield'}),.15);assert.equal(breathMultiplier({shield:'wardensAegis',potion:true,protectMagic:true}),.0096);
 assert.equal(breathMultiplier({shield:'scalewardShield',potion:true,protectMagic:true}),.018,'shield + tonic + prayer ≈ 2%');assert.equal(breathMultiplier({shield:'kite'}),1);
 assert.equal(formatTicks(100),'1:00.0');assert.equal(formatTicks(null),'—');
 const d=bossDrops(g);assert.equal(d.preroll.length,2);assert.ok(d.main.rows.reduce((s,r)=>s+r.weight,0)<=128);
});

test('lairs: valid underground areas far from each other and from the quest arenas; each boss stands in its arena',()=>{
 assert.ok(THEMES.ice);
 const all=[...dungeons.map(withLair),...LAIRS];
 for(const a of all)assert.deepEqual(validateDungeon(a,{others:all,roster:new Set([...ROSTER_KEYS,'cinderhorn_drake','hoarscale_drake','twinflame_wyrm'])}),[],a.id);
 const arenas=[1400,2200,3000,3800].flatMap(x=>[3000,3400].map(z=>({x,z})));
 for(const a of LAIRS){for(const r of arenas)assert.ok(Math.abs(a.origin.x-r.x)>=600||Math.abs(a.origin.z-r.z)>=600,a.id+' vs quest arena '+r.x+','+r.z);
  for(const lv of a.levels){const g=rasterize(a,lv.level);assert.ok(g.walkable>50);assert.ok((g.j0+g.h)*1.58<2900,a.id+' stays north of the quest arenas')}}
 for(const b of BOSSES){const area=all.find(a=>a.id===b.lair.area);assert.ok(area,b.id);const s=area.spawns.find(s=>s.roster===b.roster);assert.ok(s&&s.level===b.lair.level&&s.room===b.lair.room,b.id+' spawn');
  assert.ok(area.levels.find(l=>l.level===b.lair.level).rooms.find(r=>r.id===b.lair.room).rx>=14,'a roomy arena')}
 // Gates: boss levels only; on by default for the arcs that grant them.
 const gates=all.flatMap(a=>[...(a.entrances||[]),...(a.links||[])].filter(x=>x.requires?.unlock).map(x=>[x.requires.unlock,!!x.requires.gate,'to' in x&&x.to.level>0||!!x.level]));
 assert.deepEqual(gates.filter(g=>g[1]).map(g=>g[0]).sort(),['lair:cindervault_crucible','lair:gloomweb_nest','lair:hollow_throne','lair:rimecoil_cavern']);
 const cv=withLair(dungeons.find(d=>d.id==='cindervault_depths'));assert.ok(!cv.links.find(l=>l.id==='descent').requires,'Molten heart stays open');assert.equal(cv.reserved.length,0);
 for(const a of all.filter(a=>a.lair))assert.ok(passageObjects(a).length>=2);
});

test('unique gear: 10-15 drop-only boss and dragon items, quest rewards reserved, real stats, catalogs and shops',async()=>{
 const drops=UNIQUE_ITEMS.filter(u=>!u.quest&&!u.craft);assert.ok(drops.length>=10&&drops.length<=16,'drop-only uniques: '+drops.length);
 assert.deepEqual(QUEST_REWARD_ITEMS.sort(),['armor:crownwardenSigil','armor:emberOathGauntlets','armor:pathfinderBoots','shield:wardensAegis','weapon:tidecallerStaff']);
 for(const id of QUEST_REWARD_ITEMS)assert.equal(UNIQUE_ITEMS.find(u=>u.catalogId===id).tradeable,false);
 assert.ok(UNIQUE_ITEMS.some(u=>u.tradeable&&u.boss)&&UNIQUE_ITEMS.some(u=>!u.tradeable&&u.boss),'some tradeable rares, some untradeable');
 assert.ok(BOSS_UNIQUE_ITEMS.length>=11);
 for(const u of UNIQUE_ITEMS){assert.ok(u.shopless&&u.accent?.color!=null,u.id);const b=u.bonuses;assert.ok(Object.values(b).some(v=>v>0),u.id+' has stats')}
 const {weaponCatalog,makeWeapon}=await import('../weapons.js');const {shieldCatalog}=await import('../shields.js');const {outfitItems}=await import('../outfits.js');
 for(const u of UNIQUE_ITEMS){const cat=u.kind==='weapon'?weaponCatalog:u.kind==='shield'?shieldCatalog:outfitItems;assert.ok(cat[u.id]?.unique,u.id);assert.deepEqual(cat[u.id].bonuses,u.bonuses)}
 assert.equal(weaponCatalog.hollowScepter.magic,true);assert.equal(weaponCatalog.cindercoreMaul.twoHanded,true);
 // Stronger than the eldersteel tier it sits above, as OSRS boss gear is.
 assert.ok(weaponCatalog.unbrokenCleaver.bonuses.str>weaponCatalog.eldersteelBattleaxe.bonuses.str);assert.ok(outfitItems.heartforgePlate.bonuses.dslash>outfitItems.eldersteelBreastplate.bonuses.dslash);
 const g=makeWeapon(T,'unbrokenCleaver');assert.ok(g.getObjectByName('unique-motes'),'motes');let glow=false;g.traverse(o=>{if(o.isMesh&&[o.material].flat().some(m=>m.userData?.uniqueAccent))glow=true});assert.ok(glow,'glow trim');
 assert.ok(makeWeapon(T,'twinflameGlaive').getObjectByName('unique-motes-2'),'twin motes');
 // Never sold: no shop seed lists a unique id.
 for(const f of fs.readdirSync(new URL('../db/',import.meta.url)).filter(f=>/shop|stock|equipment-combat/.test(f))){const sql=read('db/'+f);for(const u of UNIQUE_ITEMS)assert.ok(!sql.includes(u.catalogId),u.id+' in '+f)}
 for(const k of Object.keys(UNIQUE_SPECIALS))assert.ok(uniqueById[k]?.kind==='weapon');
 const rows=Object.fromEntries(catalogRows());assert.equal(rows['item:shield:wardensAegis'].keepOnDeath,true);assert.equal(rows['item:weapon:unbrokenCleaver'].tradeable,true);assert.equal(rows['item:breathwardTonic'].breathward,500);
});

test('SQL files: generated files are current, ≤ 40 KB, no forbidden words, the docs list the ids that exist',()=>{
 assert.equal(read('db/bosses-3-lairs.sql'),lairsSql(),'run scripts/build-bosses-sql.mjs');assert.equal(read('db/bosses-4-gear.sql'),gearSql(),'run scripts/build-bosses-sql.mjs');
 for(const f of ['db/bosses-1-core.sql','db/bosses-2-hooks.sql','db/bosses-3-lairs.sql','db/bosses-4-gear.sql']){const t=read(f);assert.ok(Buffer.byteLength(t)<=40960,f);assert.ok(!/\b(delete|alter|drop)\b/i.test(t),f);assert.ok(/^begin;/m.test(t)&&/^commit;/m.test(t),f)}
 const doc=read('docs/bosses-and-uniques.md');for(const u of UNIQUE_ITEMS.filter(u=>!/wyrmscale/.test(u.id)))assert.ok(doc.includes(u.catalogId),u.catalogId);for(const b of BOSSES)assert.ok(doc.includes('`'+b.id+'`'),b.id);
 for(const a of LAIRS)assert.ok(doc.includes(a.id),a.id);
});

test('boss FX: telegraph tiles brighten to the impact, flight lifts the model, defeat shows a chest; HUD state',async()=>{
 const {createBossFx,markerLevel,bossBarState}=await import('../boss-fx.js');
 assert.equal(markerLevel(0,1,2),0);assert.ok(markerLevel(1.5,1,2)>markerLevel(1.1,1,2));assert.ok(markerLevel(2.1,1,2)>1);assert.equal(markerLevel(3,1,2),0);
 const st=bossBarState({hp:500,maxHp:1000,phases:[{at:100,name:'A'},{at:66,name:'B'},{at:33,name:'C'}],phase:1,name:'Boss',startedAt:0,now:60000});assert.equal(st.pct,50);assert.equal(st.phase,'B');assert.deepEqual(st.pips,[66,33]);assert.equal(st.time,'1:00.0');
 const scene=new T.Scene(),boss={root:new T.Group(),config:{scale:2}},me=new T.Group();scene.add(boss.root);boss.root.position.set(3,0,0);const said=[];
 const fx=createBossFx({T,scene,getActor:id=>id==='b'?boss:null,player:()=>me,say:s=>said.push(s),doc:null});
 assert.equal(fx.event({type:'windup'},'me'),false,'other events pass through');
 assert.equal(fx.event({type:'boss_start',target:'b',name:'Boss',hp:100,maxHp:100,phases:[],arena:{x:3,z:0,radius:10}},'me'),true);
 fx.event({type:'boss_telegraph',target:'b',tiles:[[0,0],[1,0]],ticks:2,color:0xff0000,text:'Look out!'},'me');fx.frame(.1);
 const mesh=scene.getObjectByName('boss-telegraphs');assert.equal(mesh.count,2);assert.deepEqual(said,['Look out!']);
 fx.frame(2);assert.equal(mesh.count,0,'gone after the impact flash');
 fx.event({type:'boss_flight',target:'b',up:true},'me');for(let i=0;i<30;i++){boss.root.position.y=0;fx.frame(.1)}assert.ok(boss.root.position.y>4,'lifted');
 fx.event({type:'boss_chest',target:'b',player:'me',name:'Boss',x:3,z:0,loot:[{item:'weapon:unbrokenCleaver',n:1}],ticks:100},'me');fx.frame(1);
 assert.ok(scene.getObjectByName('boss-fx').children.some(o=>o.visible&&o.userData.lid),'loot chest');assert.ok(said.some(s=>/Loot:/.test(s)));
 fx.event({type:'boss_rare',who:'Hero',itemName:'Unbroken Cleaver',bossName:'Boss',kc:3},'me');assert.match(said.at(-1),/Hero received Unbroken Cleaver/);
});

test('console helpers: boss form round trip with validation, uniques drive the loot preroll, breath settings',async()=>{
 const {bossFormValues,applyBossForm,lootWithUniques,breathPatch,killRow}=await import('../admin-bosses.js');
 const g=bossById.grimtusk,v=bossFormValues(g);assert.deepEqual(applyBossForm(g,v),g,'round trip');
 assert.equal(applyBossForm(g,{...v,attackTicks:'4','enrage.afterTicks':'200'}).enrage.afterTicks,200);
 assert.throws(()=>applyBossForm(g,{...v,attackTicks:'40'}),/attackTicks/);assert.throws(()=>applyBossForm(g,{...v,phases:'{bad'}),/JSON/);
 assert.throws(()=>applyBossForm(g,{...v,uniques:'weapon:unbrokenCleaver lots'}),/chance/);
 const next=applyBossForm(g,{...v,uniques:'weapon:unbrokenCleaver 1/128'});assert.deepEqual(next.uniques,[{item:'weapon:unbrokenCleaver',chance:'1/128'}]);
 assert.deepEqual(lootWithUniques(bossDrops(g),next.uniques,g.uniques).preroll,[{item:'weapon:unbrokenCleaver',min:1,max:1,chance:'1/128'}]);
 assert.deepEqual(breathPatch({shieldPct:'20',enabled:true}),{shieldPct:20,enabled:true});assert.throws(()=>breathPatch({nope:1}),/Unknown/);
 assert.match(killRow({name:'Hero',boss:'grimtusk',kills:3,best:250}),/3 kills · best 2:30.0/);
});
