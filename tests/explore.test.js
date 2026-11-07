import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';
import * as E from '../explore-data.js';
import {buildContent,buildClues} from '../scripts/build-explore-sql.mjs';
import {createLandscape} from '../landscape.js';
import {dungeons,walkableLocal,rasterize,validateDungeon,PASSAGE_TEMPLATES,PASSAGE_VERBS,createUndergroundIndex} from '../underground-data.js';
import {levelMeshData,areaTheme} from '../underground.js';
import {exploreObjectModel,EXPLORE_MODEL_TEMPLATES} from '../explore-models.js';
import {createExplore,placeAt,counterText,drawClueMap,tierOfItem,EXPLORE_ICONS} from '../explore.js';
import {goods} from '../economy.js?v=release-20261107-polish150';
import {defSummary,defPoint,newDef,EXPLORE_KINDS} from '../admin-explore.js';
import {POI_KINDS} from '../world-map.js';
const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8');
const land=createLandscape();

test('exploration data is complete and self-consistent',()=>{
 assert.deepEqual(E.validateExplore(),[]);
 assert.ok(E.LORE.length>=20&&E.LORE.length<=31,'20–31 lore objects');
 assert.equal(new Set(E.LORE.map(l=>l.region)).size>=18,true,'lore spread over many regions');
 assert.ok(E.PLACES.filter(p=>p.type==='hidden').length>=4,'hidden places: waterfall, grove, cove, shrine');
 assert.ok(E.PLACES.filter(p=>p.type==='region').length>=2,'two new regions');
 for(const t of E.TIERS){const types=new Set(E.STEPS.filter(s=>s.tier===t).map(s=>s.type));for(const k of Object.keys(E.STEP_TYPES))assert.ok(types.has(k),t+' has '+k+' steps')}
 assert.equal(E.DEFAULT_SETTINGS.milestones.lore.at(-1).at,E.LORE.length);assert.equal(E.DEFAULT_SETTINGS.milestones.place.at(-1).at,E.PLACES.length);
 const [a,b]=[E.DEFAULT_SETTINGS.steps.easy,E.DEFAULT_SETTINGS.steps.hard];assert.ok(a[0]>=2&&b[1]<=6,'2–6 steps by tier');
});

test('all creative text is original (no RuneScape place, god or item names)',()=>{
 const text=JSON.stringify([E.ITEMS,E.PLACES,E.LORE,E.STEPS,E.CRATES,E.AREAS,E.RESOURCES,E.SHORTCUTS]).toLowerCase();
 for(const w of ['lumbridge','varrock','falador','gielinor','zamorak','saradomin','guthix','ardougne','karamja','draynor','al kharid','camelot','wilderness','runescape','jagex','catherby','seers','misthalin','asgarnia','kandarin','morytania','zulrah','vorkath','treasure trail','clue scroll (','dragon scimitar','abyssal'])assert.ok(!text.includes(w),'contains '+w);
});

test('every overworld placement is on walkable land; every area placement is inside a room or tunnel',()=>{
 const check=(label,p,area)=>{if(area){assert.ok(walkableLocal(E.areaById(area).levels[0],p.x,p.z),label+' inside '+area)}else assert.ok(land.canWalk(p.x,p.z),label+' walkable at '+p.x+','+p.z)};
 for(const l of E.LORE)check('lore '+l.id,l,l.area);
 for(const c of E.CRATES)check('crate '+c.id,c,c.area);
 for(const s of E.STEPS)if(s.x!==undefined)check('step '+s.id,s,s.area);
 for(const r of E.RESOURCES)check('resource '+r.id,r,r.area);
 for(const s of E.SHORTCUTS)for(const [x,z] of s.ends)check('shortcut '+s.id,{x,z},s.area);
 for(const p of E.PLACES.filter(p=>p.entrance)){check('entrance '+p.id,p.entrance);check('front of '+p.id,E.entranceFront(p.entrance));check('inside '+p.id,p.inside,p.area);check('way out '+p.id,{x:p.inside.x-3.5,z:p.inside.z},p.area)}
 for(const p of E.PLACES.filter(p=>p.type==='town'||p.type==='landmark'))assert.ok(Math.abs(p.x)<=420&&Math.abs(p.z)<=420);
});

test('explore areas use unused space (z 4250 row) and pass the underground validator',()=>{
 const others=[...dungeons];
 for(const a of E.AREAS){assert.equal(a.origin.z,E.AREA_Z);assert.ok(a.explore&&!a.entrances.length);assert.deepEqual(validateDungeon(a,{others:[...others,...E.AREAS]}),[]);
  const g=rasterize(a,0),zMax=(g.j0+g.h)*1.58,xMax=(g.i0+g.w)*1.58;assert.ok(g.j0*1.58>3800&&zMax<4500&&xMax<4500,a.id+' stays in z 3800–4500 and inside the world limit');
  // R3-I lairs: x 1200–4200, z 1200–2625; R3-J arenas: x 1400–3800, z 3000–3400.
  assert.ok(g.j0*1.58>3400+100,a.id+' clear of R3-J arenas')}
 for(const s of E.SHORTCUTS){const a=E.areaById(s.area),lv=a.levels[0];const inRoom=([x,z])=>lv.rooms.find(r=>((x-r.x)/r.rx)**2+((z-r.z)/r.rz)**2<=1)?.id;assert.notEqual(inRoom(s.ends[0]),inRoom(s.ends[1]),s.id+' links two rooms')}
 // The ledge/heart/inlet/scree rooms are only reachable by their shortcut (no tunnel).
 const idx=createUndergroundIndex([...E.AREAS]);for(const s of E.SHORTCUTS){const [b]=E.shortcutWorldEnds(s).slice(1);assert.ok(idx.walkable(b[0],b[1]))}
 for(const k of Object.keys(E.ENTRANCE_MODELS)){assert.ok(PASSAGE_TEMPLATES[k],k+' is a passage template');assert.ok(PASSAGE_VERBS[k])}
});

test('generated SQL is current, idempotent-shaped, small and free of the forbidden words',()=>{
 assert.equal(read('db/explore-2-content.sql'),buildContent(),'run node scripts/build-explore-sql.mjs');
 assert.equal(read('db/explore-3-clues.sql'),buildClues(),'run node scripts/build-explore-sql.mjs');
 for(const f of ['explore-1-core','explore-2-content','explore-3-clues','explore-4-console']){const s=read('db/'+f+'.sql');assert.ok(s.length<45000,f+' under 45 KB');assert.ok(!/\b(delete|alter|drop)\b/i.test(s),f+' avoids the forbidden words');assert.ok(/^begin;/m.test(s)&&/^commit;/m.test(s))}
 const core=read('db/explore-1-core.sql');for(const marker of ['explore_command','explore-gate','explore_clue_loot','explore-areas'])assert.ok(core.includes(marker));
 assert.ok(read('db/explore-4-console.sql').includes("if command like 'ex\\_%' then return eldervale_private.admin_explore"));
});

test('casket rolls and clue tiers follow the tables',()=>{
 let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
 for(const t of E.TIERS)for(let k=0;k<300;k++){const got=E.rollCasket(t,{random:rnd}),main=got.filter(g=>!g.rare);const [lo,hi]=E.REWARDS[t].rolls;assert.ok(main.length>=lo&&main.length<=hi);
  for(const g of main){const row=E.REWARDS[t].rows.find(r=>r.item===g.item);assert.ok(row&&g.n>=row.min&&g.n<=row.max)}for(const g of got.filter(g=>g.rare))assert.ok(E.REWARDS.rare.rows.find(r=>r.item===g.item))}
 assert.ok(E.rollCasket('hard',{random:()=>0}).some(g=>g.rare),'rare roll at random 0');
 assert.equal(E.clueTierFor(5),'easy');assert.equal(E.clueTierFor(50),'medium');assert.equal(E.clueTierFor(28),'medium');assert.equal(E.clueTierFor(90),'hard');
 assert.equal(E.parseChance('1/128'),1/128);
 const riddle=E.publicStep(E.STEPS.find(s=>s.type==='dig'));assert.equal(riddle.x,undefined);assert.equal(riddle.map,undefined);
 const map=E.publicStep(E.STEPS.find(s=>s.type==='map'&&s.area));assert.ok(map.map.x>3000&&map.map.area);
});

test('explore items register as goods with original icons; clue/casket tiers resolve',()=>{
 for(const [id,d] of Object.entries(E.ITEMS)){assert.equal(goods[id].name,d.name);assert.ok(goods[id].icon.startsWith('<svg'));assert.ok(EXPLORE_ICONS[d.icon],d.icon)}
 assert.equal(tierOfItem('clueMedium'),'medium');assert.equal(tierOfItem('casketHard'),'hard');assert.equal(tierOfItem('runiteBar'),null);
});

test('client: places, counter, map fragment, commands and events',()=>{
 assert.deepEqual(placeAt(E.PLACES,{x:-234,z:126},()=>null),['birchford']);
 const veil=E.areaPoint('veilfall_grotto',20,6);assert.deepEqual(placeAt(E.PLACES,veil,()=>({area:{id:'veilfall_grotto'}})),['veilfall_grotto']);
 assert.equal(counterText({lore:[{found:true},{found:false}],places:[{found:true}],stats:{clues:{easy:2,hard:1}}}),'Lore 1/2 · Places 1/1 · Clues 3');
 const calls=[];const ctx=new Proxy({},{get:(o,k)=>k in o?o[k]:(...a)=>calls.push(k),set:(o,k,v)=>(o[k]=v,true)});
 const xy=drawClueMap(ctx,260,200,{x:-313,z:-143},{id:'e_map_wayfarer'});assert.ok(xy.x>0&&xy.x<260&&xy.y>0&&xy.y<200,'X on the fragment');assert.ok(calls.includes('stroke'));
 drawClueMap(ctx,260,200,{x:3638,z:4244,area:'gullwing_isle'},{id:'h_map_isle',areas:E.AREAS});
 const sent=[],said=[];const ex=createExplore({doc:null,command:(c,p)=>{sent.push([c,p]);return Promise.resolve(true)},say:t=>said.push(t),journalFetch:()=>Promise.resolve(null)});
 assert.equal(ex.useItem('clueEasy'),true);assert.deepEqual(sent.at(-1),['explore_clue',{tier:'easy'}]);
 assert.equal(ex.useItem('casketHard'),true);assert.deepEqual(sent.at(-1),['explore_open',{tier:'hard'}]);
 assert.equal(ex.useItem('spade'),false,'spade keeps its normal use without a dig step');assert.deepEqual(ex.itemChoices('spade').map(c=>c[0]),['Dig']);
 ex.talk('npc-1',{name:'Someone'});assert.notEqual(sent.at(-1)[0],'explore_talk','no talk step, nothing sent');
 assert.equal(ex.event({type:'explore',what:'dig',player:'me',clue:null},'me'),true);assert.match(said.at(-1),/worms/);
 assert.equal(ex.event({type:'travel'},'me'),false);
 const hit={userData:{x:1,z:2},scale:{set(){}},parent:null};ex.tagHit(hit,{lore:'oswin_plinth',template:'lore_carving',name:'Plinth'});assert.equal(hit.userData.kind,'lore');
 let acted=null;ex.click({object:hit},{button:0},{approachAndAct:o=>{acted=o;o.act()},menuAt(){}});assert.equal(acted.label,'Read Plinth');assert.equal(sent.at(-1)[0],'explore_read');
 assert.deepEqual(ex.mapPois(),[]);assert.ok(POI_KINDS.discovered&&POI_KINDS.hidden);
});

test('models: every exploration template builds from pooled parts, small and cheap',()=>{
 for(const id of EXPLORE_MODEL_TEMPLATES){const parent=new T.Group();const g=exploreObjectModel(T,parent,id,{x:0,z:0});assert.ok(g,id);let meshes=0;g.traverse(o=>{if(o.isMesh){meshes++;assert.ok(o.geometry.userData.eldervaleShared,id+' shared geometry');assert.ok(o.material.userData.eldervaleShared,id+' shared material')}});assert.ok(meshes>0&&meshes<=16,id+' '+meshes+' meshes')}
 assert.equal(exploreObjectModel(T,new T.Group(),'tree',{}),null);
 for(const l of E.LORE)assert.ok(EXPLORE_MODEL_TEMPLATES.includes(l.model));
 assert.ok(read('world-models.js').includes('const explore=exploreObjectModel(T,parent,id,d);if(explore)return explore;'));
});

test('outdoor areas: sea isle has no rock walls, grove/plateau keep a border',()=>{
 const isle=E.areaById('gullwing_isle'),grove=E.areaById('thornveil_grove'),idx=createUndergroundIndex(E.AREAS);
 const gi=idx.grids.find(g=>g.area.id==='gullwing_isle'),gg=idx.grids.find(g=>g.area.id==='thornveil_grove');
 assert.equal(levelMeshData(gi,areaTheme(isle)).rocks.length,0);assert.ok(levelMeshData(gg,areaTheme(grove)).rocks.length>50);
 assert.equal(areaTheme(isle).outdoor,'isle');assert.equal(areaTheme(dungeons[0]).outdoor,undefined);
});

test('console helpers summarise, locate and template every kind',()=>{
 for(const [k] of EXPLORE_KINDS){const d=newDef(k,{x:-230,z:120});assert.ok(d,k);assert.equal(typeof defSummary(k,d),'string')}
 assert.deepEqual(defPoint(E.loreById('oswin_plinth')),{x:-222,z:170});
 const inArea=defPoint(E.loreById('veilfall_mural'));assert.deepEqual(inArea,E.areaPoint('veilfall_grotto',44,0));
 assert.deepEqual(defPoint(E.placeById('gullwing_isle')),{x:306,z:376});
 assert.ok(read('admin-panel.js').includes("'Exploration'"));
});

// QA (map112): lore objects and clue crates were missing from worldTemplates, so game.js skipped them,
// the region streamer re-queued them forever and click-to-walk waited on it near any of them.
test('every template the exploration SQL places in the world is a known client world template',async()=>{
 const {worldTemplates,validateEntity,entityDefaults}=await import('../world-templates.js?v=release-20261107-polish150');
 const used=new Set([E.CRATE_TEMPLATE,...Object.keys(E.LORE_MODELS),...E.LORE.map(l=>l.model),...Object.keys(E.ENTRANCE_MODELS),'cave_exit',
  ...E.PLACES.flatMap(p=>[p.entrance?.model,p.exitModel]),...E.RESOURCES.map(r=>r.template),...E.SHORTCUTS.map(s=>s.template)].filter(Boolean));
 assert.ok(used.size>15);
 for(const id of used){assert.ok(worldTemplates[id],'missing world template '+id);assert.equal(worldTemplates[id].kind,'object',id);assert.doesNotThrow(()=>validateEntity(entityDefaults(id,1,2)),id)}
});
