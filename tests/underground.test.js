import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
// Seeded world (the live config) before any world module loads.
globalThis.eldervaleWorldConfig={enabled:true,seed:241916600,version:2};
const V='?v=release-20261107-trapdoor138';
const ug=await import('../underground-data.js'+V);
const ag=await import('../agility-data.js'+V);
const {ROSTER_KEYS,rosterBeasts}=await import('../monster-roster.js'+V);
const {createLandscape}=await import('../landscape.js'+V);
const {landscapeSettlements,worldRivers,landscapeLakes}=await import('../geography.js'+V);
const {installUndergroundTerrain,levelMeshData,undergroundAt,undergroundMusic}=await import('../underground.js'+V);
const {spotFormData,shortcutFormData,waterName}=await import('../admin-world.js'+V);
const {TILE}=ug;

const connected=g=>{const start=g.mask.indexOf(1),seen=new Uint8Array(g.mask.length),q=[start];seen[start]=1;let n=0;while(q.length){const k=q.pop();n++;const i=k%g.w,j=(k-i)/g.w;for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]]){const ni=i+di,nj=j+dj,m=nj*g.w+ni;if(ni<0||nj<0||ni>=g.w||nj>=g.h||seen[m]||!g.mask[m])continue;seen[m]=1;q.push(m)}}return n===g.walkable};

test('starter dungeons: valid, fully connected, passages and spawns on walkable tiles, far apart',()=>{
 assert.equal(ug.dungeons.length,3);const idx=ug.createUndergroundIndex();
 for(const a of ug.dungeons){assert.deepEqual(ug.validateDungeon(a,{others:ug.dungeons,roster:new Set(ROSTER_KEYS)}),[],a.id);
  for(const lv of a.levels){const g=ug.rasterize(a,lv.level);assert.ok(g.walkable>300,a.id+' '+lv.level);assert.ok(connected(g),a.id+' level '+lv.level+' is one connected cave');
   const e=ug.levelExtent(lv);assert.ok(e.z1-e.z0<ug.LEVEL_GAP-220&&e.x1-e.x0<ug.LEVEL_GAP-220,'levels further apart than the 220-unit sync radius')}
  for(const p of ug.passageObjects(a)){if(ug.isUndergroundPoint(p.x,p.z))assert.ok(idx.walkable(p.x,p.z),p.key);const [dx,dz]=p.passage.dest;if(ug.isUndergroundPoint(dx,dz))assert.ok(idx.walkable(dx,dz),p.key+' dest')}
  for(const s of ug.spawnPlan(a))assert.ok(idx.walkable(s.x,s.z),s.key);
  for(const o of ug.dungeons)if(o!==a)assert.ok(Math.hypot(o.origin.x-a.origin.x,o.origin.z-a.origin.z)>=600)}
 assert.equal(ug.isUndergroundPoint(0,0),false);assert.equal(ug.isUndergroundPoint(1200,1200),true);
});
test('spawn groups use roster monsters inside each band; the deep cavern keeps an empty boss chamber',()=>{
 const band={birchroot_hollow:[1,22],hollowmere_undercroft:[30,62],cindervault_depths:[55,100]};
 for(const a of ug.dungeons)for(const s of a.spawns){const b=rosterBeasts[s.roster];assert.ok(b,s.roster);const lvl=b.level??b.stats?.level;if(Number.isFinite(lvl))assert.ok(lvl>=band[a.id][0]&&lvl<=band[a.id][1],a.id+' '+s.roster+' '+lvl)}
 const fire=ug.dungeons.find(a=>a.id==='cindervault_depths');assert.ok(fire.reserved.some(r=>r.room==='crucible'));assert.ok(!fire.spawns.some(s=>s.room==='crucible'),'boss chamber stays empty for Round 3');
});
test('validation catches broken definitions',()=>{
 const bad=structuredClone(ug.dungeons[0]);bad.id='Bad Id';bad.origin={x:200,z:200};bad.entrances[0].to={level:0,x:500,z:500};bad.spawns.push({id:'x',roster:'nobody',count:40,level:0,room:'nowhere'});
 const errors=ug.validateDungeon(bad,{others:ug.dungeons,roster:new Set(ROSTER_KEYS)}).join('\n');
 for(const re of [/id:/,/origin/,/arrival point/,/1–12/,/unknown room/,/unknown roster/])assert.match(errors,re);
});
test('client terrain below ground: flat floor, walls exactly where the server raster has rock',()=>{
 const land=installUndergroundTerrain(createLandscape({segments:40}));const a=ug.dungeons[0],g=ug.rasterize(a,0);
 let walls=0;for(let k=0;k<g.mask.length;k+=7){const i=g.i0+k%g.w,j=g.j0+Math.floor(k/g.w);assert.equal(land.canWalk(i*TILE,j*TILE),g.mask[k]===1);if(!g.mask[k])walls++}
 assert.ok(walls>0);assert.equal(land.heightAt(1200,1200),0);assert.equal(land.walkHeight(1200,1200),0);assert.equal(land.waterAt(1200,1200),0);
 const near=land.nearestDryPoint(1200,1212);assert.ok(land.canWalk(near.x,near.z));
 assert.equal(undergroundAt(1200,1200).area.id,'birchroot_hollow');assert.equal(undergroundAt(0,0),null);assert.equal(undergroundAt(1201,1600).level,1);
 assert.equal(undergroundMusic({x:2800,z:1200}).id,'eastmarch');assert.ok(fs.existsSync(new URL('../assets/audio/'+undergroundMusic({x:1200,z:1200}).id+'.mp3',import.meta.url)));
});
test('cave meshes: one floor quad per walkable tile, rock ring around them, decor near walls',()=>{
 for(const a of ug.dungeons){const g=ug.rasterize(a,0),m=levelMeshData(g,a.theme);assert.equal(m.indices.length/6,g.walkable);assert.equal(m.positions.length/12,g.walkable);assert.ok(m.rocks.length>g.walkable/3&&m.rocks.length<g.w*g.h);assert.ok(m.decor.length>5)}
});
test('agility shortcuts: OSRS-style levels 5–70, ends on walkable ground, slips fade with level',()=>{
 const land=installUndergroundTerrain(createLandscape());const levels=ag.shortcuts.map(s=>s.level).sort((a,b)=>a-b);assert.ok(levels[0]<=10&&levels.at(-1)>=70);
 for(const s of ag.shortcuts){const ends=ag.shortcutEnds(s);for(const [x,z] of ends)assert.ok(land.canWalk(x,z),s.id+' end '+x+','+z);const e=ag.shortcutEntity(s);assert.ok(e.agility.ends.length===2&&e.length>1&&ag.AGILITY_TEMPLATES[e.template])}
 for(const t of Object.keys(ag.AGILITY_TEMPLATES))assert.ok(ag.shortcuts.some(s=>s.template===t),t);
 assert.equal(ag.failChance(10,15,.3),1,'below the level: never');assert.equal(ag.failChance(15,15,.3),.3);assert.equal(ag.failChance(25,15,.3,20),.15);assert.equal(ag.failChance(40,15,.3,20),0);
});
test('new water: a bay coastline, a river, a lake and a brook, clear of every town',()=>{
 assert.ok(worldRivers.some(r=>r.name==='Saltreed Run')&&worldRivers.some(r=>r.name==='Heron Brook'));assert.ok(landscapeLakes.some(l=>l.sea&&l.name==='Saltglass Bay')&&landscapeLakes.some(l=>l.name==='Heronmere'));
 const land=createLandscape();for(const [x,z] of landscapeSettlements)assert.equal(land.waterAt(x,z),0);
 assert.ok(land.waterAt(330,400)>.05,'the bay is water');assert.ok(land.waterAt(345,250)>0||land.waterAt(362,250)>0,'the river runs');
 // The seeded towns, roads and first rivers are untouched (water is appended after every random draw).
 assert.deepEqual(worldRivers.slice(0,2).map(r=>r.name),['Wildwater','The Wander']);assert.equal(landscapeLakes[0].name,'Willowmere');
});
test('console form helpers',()=>{
 assert.deepEqual(spotFormData({type:'cage',points:'1,2\n3.04, 4',minTicks:'300',maxTicks:'100',paused:false,name:' Bay '}),{spotType:'cage',moves:{points:[[1,2],[3,4]],minTicks:300,maxTicks:300,paused:false},name:'Bay'});
 assert.deepEqual(spotFormData({type:'',points:''}),{spotType:null,moves:null});
 const s=shortcutFormData({template:'log_balance',name:'Log',level:'12',xp:'9',fail:'2',failDamage:'30',ticks:'5',margin:'',ax:'1',az:'2',bx:'3',bz:'4'});assert.equal(s.fail,1);assert.deepEqual(s.ends,[[1,2],[3,4]]);assert.equal(s.margin,20);
 assert.equal(waterName(9001),'Saltglass Bay');assert.match(waterName(9011),/Saltreed Run · segment 2/);
});
test('underground and water SQL: repo rules, apply order, live hooks guarded and marker-checked',()=>{
 const files=fs.readdirSync(new URL('../db/',import.meta.url)).filter(f=>/^(underground|water)-\d.*\.sql$/.test(f)).sort();
 assert.deepEqual(files,['underground-1-engine.sql','underground-2-content.sql','underground-3-console.sql','water-1-fishing.sql','water-2-world.sql']);
 for(const f of files){const sql=fs.readFileSync(new URL('../db/'+f,import.meta.url),'utf8');
  for(const w of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+w+'\\b','i').test(sql),f+' avoids '+w);
  assert.match(sql,/^begin;\nset local lock_timeout='5s';/m,f);assert.match(sql,/commit;\s*$/,f);assert.ok(sql.length<=40000,f+' stays under 40 KB')}
 const engine=fs.readFileSync(new URL('../db/underground-1-engine.sql',import.meta.url),'utf8');
 for(const fn of ['can_step','tile_flags_at','tile_route','realm_request('])assert.ok(engine.includes("underground_patch('eldervale_private."+fn),fn);
 assert.match(engine,/if command in \(''travel'',''agility''\) then return eldervale_private\.underground_command/);
 assert.match(engine,/select \(gj-\$2\)\*\$3\+\(gi-\$1\)/,'window parameters by position (the levels table has its own w column)');
});
test('generated SQL is current (node scripts/build-water-seed.mjs)',async()=>{
 const {build}=await import('../scripts/build-water-seed.mjs');
 for(const [f,text] of Object.entries(build()))assert.equal(fs.readFileSync(new URL('../'+f,import.meta.url),'utf8'),text,f+' is stale: run node scripts/build-water-seed.mjs');
});

// Trapdoors and ladders (OSRS style), and click-to-walk below ground.
test('passages read OSRS style: dungeon ways down are trapdoors, ways up are ladders, natural ways keep theirs',()=>{
 for(const t of ['cave_mouth','crypt_door','mine_shaft','trapdoor','shrine_door','stairs_down','ladder_down'])assert.equal(ug.passageLook(t),'trapdoor',t);
 for(const t of ['cave_exit','stairs_up','ladder_up'])assert.equal(ug.passageLook(t),'ladder_up',t);
 for(const t of ['waterfall_curtain','thorn_thicket','sea_cave','ferry_boat','cliff_path','door','castle_gate','cottage'])assert.equal(ug.passageLook(t),null,t);
 assert.equal(ug.PASSAGE_LOOK_LABELS.trapdoor,'Climb-down Trapdoor');assert.equal(ug.PASSAGE_LOOK_LABELS.ladder_up,'Climb-up Ladder');
 // Every overworld entrance of the starter dungeons is a trapdoor, every way out a ladder; you land one tile away.
 for(const a of ug.dungeons){const all=ug.passageObjects(a);for(const p of all){
  if(p.key.startsWith('entrance:'))assert.equal(ug.passageLook(p.template),'trapdoor',p.key);
  if(p.key.startsWith('exit:')){assert.equal(ug.passageLook(p.template),'ladder_up',p.key);const e=a.entrances.find(x=>'exit:'+x.id===p.key),[ex,ez]=p.passage.dest;
   assert.ok(Math.hypot(ex-e.x,ez-e.z)<=ug.TILE+.05,p.key+' arrives beside the hatch');
   const inside=all.find(q=>q.key==='entrance:'+e.id).passage.dest;assert.ok(Math.hypot(inside[0]-p.x,inside[1]-p.z)<=ug.TILE+.05,p.key+' ladder beside the arrival')}}}
});
test('trapdoor and ladder models: flush hatch with iron bands (open or shut), ladder to a square of light',async()=>{
 const T=await import('three');const {undergroundObjectModel}=await import('../underground-models.js'+V);const {objectModel}=await import('../world-models.js'+V);
 const size=g=>{g.updateMatrixWorld(true);return new T.Box3().setFromObject(g).getSize(new T.Vector3())};
 for(const t of ['crypt_door','cave_mouth','shrine_door','mine_shaft']){const g=objectModel(T,new T.Group(),t,{x:0,z:0,passage:{area:'x',dest:[1200,1200],depth:0}});assert.equal(g.userData.passageLook,'trapdoor',t);
  const s=size(g);assert.ok(s.y<1.8&&s.x<3.4&&s.z<3.4,t+' is a low hatch, not a door frame: '+s.y.toFixed(2));let hatch=null,iron=0;
  g.traverse(o=>{if(o.name==='hatch')hatch=o;if(o.isMesh){assert.ok(o.geometry.userData.eldervaleShared&&o.material.userData.eldervaleShared,t+' pooled');if(o.material.metalness>.5)iron++}});
  assert.ok(hatch&&hatch.rotation.x<-1.5,t+' open hatch');assert.ok(iron>=4,t+' iron bands, studs and ring')}
 const shut=undergroundObjectModel(T,new T.Group(),'crypt_door',{passage:{requires:{unlock:'area.x'}}});let lid=null;shut.traverse(o=>{if(o.name==='hatch')lid=o});assert.equal(lid.rotation.x,0);assert.ok(size(shut).y<.35,'a locked hatch lies shut and flush');
 for(const [t,depth] of [['stairs_up',-1],['cave_exit',-1],['ladder_up',0]]){const g=undergroundObjectModel(T,new T.Group(),t,{passage:{depth}});assert.equal(g.userData.passageLook,'ladder_up');assert.ok(size(g).y>4.5,t+' tall ladder');
  let light=null;g.traverse(o=>{if(o.isMesh&&o.material.emissive?.getHex()>0&&o.position.y>4.5)light=o});assert.ok(light,t+' square of light above');assert.ok(light.material.emissiveIntensity>(depth<0?1:.5))}
});
test('click-to-walk below ground: the click ray finds the cave floor (the surface mesh stops at the overworld edge)',async()=>{
 const T=await import('three');const {createUnderground}=await import('../underground.js'+V);
 const land=installUndergroundTerrain(createLandscape({segments:40})),scene=new T.Scene();
 const api=createUnderground({T,scene,landscape:land,camera:new T.PerspectiveCamera(),command:async()=>{},yieldFrame:async()=>{}});
 const a=ug.dungeons[0],arrive=ug.toWorld(a,0,2,0),player={x:arrive.x,z:arrive.z};
 const ray=(x,z,h=12)=>{const r=new T.Raycaster(),o=new T.Vector3(x-4,h,z+6);r.set(o,new T.Vector3(x,0,z).sub(o).normalize());return r};
 // On the floor: the exact point. Tile mode and continuous mode both route from this point.
 const target=ug.toWorld(a,0,4.5,-2),hit=api.pickFloor(ray(target.x,target.z),player);assert.ok(hit,'floor hit');
 assert.ok(Math.hypot(hit.point.x-target.x,hit.point.z-target.z)<1e-6);assert.ok(land.canWalk(hit.point.x,hit.point.z));assert.ok(hit.distance>0);
 // On a rock wall: snapped to walkable floor beside it.
 const wall=ug.toWorld(a,0,0,9);assert.equal(land.canWalk(wall.x,wall.z),false);const snap=api.pickFloor(ray(wall.x,wall.z),player);
 assert.ok(snap&&land.canWalk(snap.point.x,snap.point.z)&&Math.hypot(snap.point.x-wall.x,snap.point.z-wall.z)<6,JSON.stringify(snap?.point));
 // On the surface, aiming at the sky, or at another level: no cave floor (the terrain mesh answers on the surface).
 assert.equal(api.pickFloor(ray(0,0),{x:0,z:0}),null);assert.equal(api.pickFloor(new T.Raycaster(new T.Vector3(arrive.x,5,arrive.z),new T.Vector3(0,1,0)),player),null);
 const lower=ug.toWorld(a,1,0,0);assert.equal(api.pickFloor(ray(lower.x,lower.z),player),null);
 // Passage menu text and hit boxes follow the look.
 const hitBox=new T.Mesh(new T.BoxGeometry(1.3,2,1.3));hitBox.position.y=1;api.tagHit(hitBox,{template:'crypt_door',name:'Hollowmere crypt door',passage:{area:'hollowmere_undercroft',dest:[2002,1200],depth:0}});
 assert.equal(api.label(hitBox.userData),'Climb-down Trapdoor');assert.ok(hitBox.position.y+hitBox.scale.y<=1.3,'low hit box over the hatch');
 const ladderBox=new T.Mesh(new T.BoxGeometry(1.3,2,1.3));api.tagHit(ladderBox,{template:'stairs_up',name:'Way out',passage:{area:'hollowmere_undercroft',dest:[-118,-373.6],depth:-1}});
 assert.equal(api.label(ladderBox.userData),'Climb-up Ladder');assert.equal(api.label({kind:'passage',template:'waterfall_curtain',name:'The Veilfall'}),'Step behind The Veilfall');
 const game=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');assert.match(game,/const groundHit=underground\.pickFloor\(ray,player\.position\)\|\|ray\.intersectObjects\(walkSurfaces/);
});
test('db/underground-click.sql: idempotent guarded patches, no destructive words',()=>{
 const sql=fs.readFileSync(new URL('../db/underground-click.sql',import.meta.url),'utf8');
 assert.doesNotMatch(sql,/delete|alter|drop/i);assert.match(sql,/eldervale_private\.patch_function\('eldervale_private\.underground_passages\(jsonb\)'::regprocedure/);assert.match(sql,/patch_function\('eldervale_private\.explore_sync\(\)'::regprocedure/);
 assert.equal((sql.match(/if position\(/g)||[]).length,2,'each patch skipped once present');
 // The anchors match the shipped function bodies exactly once.
 const engine=fs.readFileSync(new URL('../db/underground-1-engine.sql',import.meta.url),'utf8'),explore=fs.readFileSync(new URL('../db/explore-1-core.sql',import.meta.url),'utf8');
 const body=(src,name)=>{const at=src.indexOf('create or replace function eldervale_private.'+name);return src.slice(at,src.indexOf('end $fn$;',at))};
 for(const a of ['sin(a)*3.2','cos(a)*3.2',"'x',ix-3.5,'z',iz"])assert.equal(body(engine,'underground_passages').split(a).length,2,a);
 for(const a of ['sin(yaw)*3.2','cos(yaw)*3.2',"'x',ix-3.5,"])assert.equal(body(explore,'explore_sync').split(a).length,2,a);
});
