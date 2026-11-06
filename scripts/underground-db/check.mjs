// Behavioural check of db/underground-*.sql and db/water-*.sql on PGlite (real Postgres in WASM).
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node scripts/underground-db/check.mjs
// (or set PGLITE=/path/to/node_modules/@electric-sql/pglite/dist/index.js)
// Live anchors: node scripts/underground-db/live-anchors.mjs prints a read-only query (every row matches=1).
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {PGlite}=await import(process.env.PGLITE||'@electric-sql/pglite');
const V='?v=release-20261106-classic95';
const {dungeons,rasterize,passageObjects,createUndergroundIndex,spawnPlan,TILE}=await import('../../underground-data.js'+V);
const {shortcuts,shortcutEnds}=await import('../../agility-data.js'+V);
const {fullFishTable}=await import('../../fish-tiers.js'+V);
const {bfsRoute,FLAG}=await import('../../tile-grid.js'+V);
const repo=new URL('../..',import.meta.url).pathname;
const db=new PGlite();
const run=async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message);throw e}};
const one=async(sql,params=[])=>(await db.query(sql,params)).rows[0];
const all=async(sql,params=[])=>(await db.query(sql,params)).rows;
const fails=async(sql,re,label)=>{try{await db.query(sql);assert.fail(label+': expected an error')}catch(e){if(e.code==='ERR_ASSERTION')throw e;assert.match(e.message,re,label)}};
let n=0;const ok=label=>{n++;console.log('ok',n,label)};

await run(readFileSync(new URL('./fixture.sql',import.meta.url),'utf8'),'fixture');
// Roster monsters the spawn groups copy (live data shape, trimmed).
const keys=[...new Set(dungeons.flatMap(a=>a.spawns.map(s=>s.roster)))];
await db.query(`insert into eldervale_private.entities(id,revision,data) select md5('roster:'||k)::uuid,1,jsonb_build_object('kind','monster','name',k,'rosterKey',k,'level',10,'hp',100,'respawn',35,'roam',5,'group','b0e5a000-0000-4000-9000-000000000001','blueprint','monster-roster-v1','x',0,'z',0) from unnest($1::text[]) k`,[keys]);
await run(`insert into eldervale_private.entities(id,revision,data) values ('b0e5a000-0000-4000-8000-000000000163',1,'{"kind":"monster","name":"Duskborn demon","x":287.1,"z":403.8,"rosterKey":"duskborn_demon"}'),('b0e5a000-0000-4000-8000-000000000164',1,'{"kind":"monster","name":"Duskborn demon","x":287,"z":388.6,"rosterKey":"duskborn_demon"}');
 insert into eldervale_private.realm_objects(id,kind,x,z,data) values ('tree-in-bay','tree',300,400,'{}'),('tree-dry','tree',300,300,'{}'),('spot-legacy','fishing',-334,307,'{"template":"fishing_spot"}');`,'world rows');
const files=['underground-1-engine','underground-2-content','underground-3-console','water-1-fishing','water-2-world'];
for(const pass of [1,2])for(const f of files)await run(readFileSync(repo+'db/'+f+'.sql','utf8'),f+' pass '+pass);
ok('all five files apply twice (idempotent)');

// Rasterisation: SQL bitmap == JS bitmap, bit for bit.
for(const area of dungeons)for(const lv of area.levels){const js=rasterize(area,lv.level),row=await one(`select i0,j0,w,h,walkable,mask::text m from eldervale_private.underground_levels where area=$1 and level=$2`,[area.id,lv.level]);
 assert.deepEqual([row.i0,row.j0,row.w,row.h,row.walkable],[js.i0,js.j0,js.w,js.h,js.walkable],area.id+' '+lv.level+' bounds');assert.equal(row.m,Array.from(js.mask).join(''),area.id+' '+lv.level+' mask')}
ok('SQL rasterisation matches underground-data.js for every level');
// Passages: SQL == JS.
for(const area of dungeons){const sql=(await one(`select eldervale_private.underground_passages(data) p from eldervale_private.underground_areas where id=$1`,[area.id])).p,js=passageObjects(area);
 assert.equal(sql.length,js.length);for(let i=0;i<js.length;i++){assert.equal(sql[i].key,js[i].key);assert.equal(sql[i].template,js[i].template);for(const k of ['x','z'])assert.ok(Math.abs(sql[i][k]-js[i][k])<1e-6,js[i].key+' '+k);assert.ok(Math.abs(sql[i].passage.dest[0]-js[i].passage.dest[0])<1e-6&&Math.abs(sql[i].passage.dest[1]-js[i].passage.dest[1])<1e-6,js[i].key+' dest')}}
ok('SQL passages match passageObjects()');
// Materialised entities and runtime rows.
const counts=await one(`select count(*) filter(where data ? 'passage') p,count(*) filter(where data->>'kind'='monster' and data->>'underground' is not null) m from eldervale_private.entities where not deleted`);
const expect={p:dungeons.reduce((t,a)=>t+passageObjects(a).length,0),m:dungeons.reduce((t,a)=>t+spawnPlan(a).length,0)};
assert.equal(Number(counts.p),expect.p);assert.equal(Number(counts.m),expect.m);
assert.equal(Number((await one(`select count(*) c from eldervale_private.realm_actors where data->>'underground' is not null and not deleted`)).c),expect.m);
for(const s of spawnPlan(dungeons[0])){const a=await one(`select x,z,data->>'rosterKey' k from eldervale_private.realm_actors where id=md5('underground:'||$1||':spawn:'||$2)::uuid::text`,[dungeons[0].id,s.key.replace(':',':')]);assert.ok(a&&Math.abs(a.x-s.x)<1e-6&&Math.abs(a.z-s.z)<1e-6&&a.k===s.roster,s.key)}
ok('passages and spawn groups materialise as entities, realm_objects and realm_actors at the JS positions');

// Collision: can_step, tile_flags_at and tile_route agree with the JS grid.
const idx=createUndergroundIndex();
for(const g of idx.grids)for(let k=0;k<200;k++){const i=g.i0+((k*37)%g.w),j=g.j0+((k*53)%g.h),x=i*TILE,z=j*TILE,walk=g.mask[(j-g.j0)*g.w+(i-g.i0)]===1;
 const r=await one(`select eldervale_private.can_step($1,$2,$1,$2) s,eldervale_private.tile_flags_at($3,$4) f`,[x,z,i,j]);assert.equal(r.s,walk,g.area.id+' can_step '+i+','+j);assert.equal(r.f,walk?0:65)}
assert.equal((await one(`select eldervale_private.can_step(0,0,1,1) s`)).s,true,'overworld untouched');
{const area=dungeons[0],lv=area.levels[0],o={x:area.origin.x,z:area.origin.z},a=lv.rooms[0],b=lv.rooms[3];const si=Math.round((o.x+a.x)/TILE),sj=Math.round((o.z+a.z)/TILE),gi=Math.round((o.x+b.x)/TILE),gj=Math.round((o.z+b.z)/TILE);
 const sql=(await one(`select eldervale_private.tile_route($1,$2,'tile',$3,$4,$5,$6,0,64,10) r`,[si,sj,gi,gj,gi*TILE,gj*TILE])).r;
 const js=bfsRoute({start:[si,sj],goal:[gi,gj],radius:64,flagsAt:(i,j)=>idx.walkable(i*TILE,j*TILE)?0:FLAG.BLOCK|FLAG.OBJECT});
 assert.equal(sql.reached,true);assert.deepEqual(sql.path,js.path);for(const [x,z] of sql.path)assert.ok(idx.walkable(x,z),'path stays inside the cave')}
ok('can_step, tile_flags_at and tile_route follow the cave walls (same path as tile-grid.js)');

// Travel.
const uid='11111111-1111-4111-8111-111111111111',sid='22222222-2222-4222-8222-222222222222';
await run(`insert into public.player_saves(user_id,character_name,health,max_health,skills,stats) values('${uid}','Tester',100,100,'{"agilityXP":0,"fishingXP":0}','{}');insert into eldervale_private.realm_players(user_id,session_id,x,z) values('${uid}','${sid}',-317,133);select set_config('test.uid','${uid}',false);`,'player');
const req=(cmd,p)=>one(`select eldervale_private.realm_request($1,$2,$3::jsonb,gen_random_uuid(),0) r`,[sid,cmd,JSON.stringify(p)]);
const pos=()=>one(`select x,z from eldervale_private.realm_players where user_id=$1`,[uid]);
const ent=key=>one(`select id::text id,data from eldervale_private.entities where id=md5($1)::uuid`,[key]);
const mouth=await ent('underground:birchroot_hollow:entrance:mouth');
let r=(await req('travel',{target:mouth.id})).r;let p=await pos();
assert.deepEqual([p.x,p.z],mouth.data.passage.dest);assert.equal(r.underground.area,'birchroot_hollow');assert.equal(r.underground.level,0);
const ev=await one(`select data from eldervale_private.realm_events where data->>'type'='travel' order by id desc limit 1`);assert.equal(ev.data.area,'birchroot_hollow');
await run(`update eldervale_private.realm_players set last_command=now()-interval '1 minute'`,'cool');
await fails(`select eldervale_private.realm_request('${sid}','travel','{"target":"${mouth.id}"}',gen_random_uuid(),0)`,/Move closer/,'far from the entrance');
const exit=await ent('underground:birchroot_hollow:exit:mouth');r=(await req('travel',{target:exit.id})).r;p=await pos();assert.deepEqual([p.x,p.z],exit.data.passage.dest);assert.equal(r.underground,null);
await run(`update eldervale_private.underground_areas set enabled=false where id='birchroot_hollow';update eldervale_private.realm_players set last_command=now()-interval '1 minute'`,'disable');
await fails(`select eldervale_private.realm_request('${sid}','travel','{"target":"${mouth.id}"}',gen_random_uuid(),0)`,/blocked/,'disabled area');
await run(`update eldervale_private.underground_areas set enabled=true where id='birchroot_hollow'`,'enable');
ok('travel: entrance -> inside, way out -> overworld front, distance and enabled checks, travel event');

// Agility: level gate, success XP, fail damage.
const log=await ent('agility-v1:wildwater_stones');const [e0,e1]=shortcutEnds(shortcuts.find(s=>s.id==='wildwater_stones'));
await run(`update eldervale_private.realm_players set x=${e0[0]},z=${e0[1]},last_command=now()-interval '1 minute'`,'to log');
await fails(`select eldervale_private.realm_request('${sid}','agility','{"target":"${log.id}"}',gen_random_uuid(),0)`,/Agility level 15/,'level gate');
await run(`update public.player_saves set skills=skills||'{"agilityXP":200000}'`,'agility 99');
await req('agility',{target:log.id});p=await pos();assert.deepEqual([p.x,p.z],e1,'crossed');
assert.equal(Number((await one(`select skills->>'agilityXP' x from public.player_saves`)).x),200000+log.data.agility.xp);
await run(`update public.player_saves set skills=skills||'{"agilityXP":2411}';update eldervale_private.entities set data=jsonb_set(data,'{agility,fail}','1') where id='${log.id}';update eldervale_private.realm_players set last_command=now()-interval '1 minute'`,'always fail');
await req('agility',{target:log.id});p=await pos();assert.deepEqual([p.x,p.z],e1,'a fall leaves you where you started');
const hp=(await one(`select health from public.player_saves`)).health;assert.ok(hp<100&&hp>=100-log.data.agility.failDamage,'fail damage '+hp);
const aev=await one(`select data from eldervale_private.realm_events where data->>'type'='agility' order by id desc limit 1`);assert.equal(aev.data.ok,false);
ok('agility: level requirement, crossing with XP, failure with damage and no XP');

// Fishing tiers and spot types.
const ft=(await one(`select eldervale_private.fish_table() t`)).t;assert.deepEqual(ft,fullFishTable);
const spots=await all(`select id::text id,data from eldervale_private.entities where data->>'blueprint'='water-v1' and data->>'template'='fishing_spot'`);assert.equal(spots.length,13);
const cage=spots.find(s=>s.data.spotType==='cage');
await run(`update eldervale_private.realm_players set x=${cage.data.x},z=${cage.data.z+1}`,'to spot');
assert.match((await one(`select eldervale_private.gathering_error($1,$2,'net') e`,[uid,cage.id])).e,/takes: cage \/ harpoon/);
assert.equal((await one(`select eldervale_private.gathering_error($1,'spot-legacy','fly') e`,[uid])).e,'Move closer to the resource.');
for(let k=0;k<30;k++){const c=(await one(`select eldervale_private.fish_attempt_at($1::jsonb,'harpoon',99) c`,[JSON.stringify(cage.data)])).c;if(c?.item)assert.ok(['rawBrightfin','rawSwordfish'].includes(c.item),c.item)}
const river=spots.find(s=>s.data.spotType==='river');
await run(`update eldervale_private.realm_players set x=${river.data.x},z=${river.data.z};update public.player_saves set skills=skills||'{"fishingXP":13034431}',stats='{"flyRod":1,"feathers":5}'`,'fly fisher');
await req('fish',{});// sync only
await one(`select eldervale_private.realm_request_before_professions($1,'fish',$2::jsonb,gen_random_uuid(),0)`,[sid,JSON.stringify({target:river.id,method:'fly'})]);
for(let k=0;k<20;k++)await run(`update eldervale_private.gathering_actions set due_at=now()-interval '1 second';select eldervale_private.gathering_tick(now());`,'tick');
const st=(await one(`select stats from public.player_saves`)).stats;const caught=['rawTrout','rawSalmon','rawRainbowfin'].reduce((t,k)=>t+(st[k]||0),0);
assert.ok(caught>0&&st.feathers===5-caught,'fly fishing uses one feather per catch: '+JSON.stringify(st));
assert.equal(st.rawFish,undefined,'lure never gives bait fish');
ok('fish table, spot methods/catches, fly fishing with feathers through the patched gathering tick');

// Moving spots.
const mover=(await all(`select id::text id,data from eldervale_private.entities where data->>'blueprint'='water-v1' and data->>'template'='fishing_spot'`)).find(s=>s.data.moves.points.length>=2);
await run(`select eldervale_private.fishing_spot_drift(now())`,'schedule');
await run(`update eldervale_private.entities set data=data||'{"moveAt":"2000-01-01T00:00:00Z"}' where id='${mover.id}';select eldervale_private.gathering_tick(now());`,'due');
const moved=await one(`select x,z from eldervale_private.realm_objects where id=$1`,[mover.id]);
assert.ok(mover.data.moves.points.some(([x,z])=>x===moved.x&&z===moved.z)&&(moved.x!==mover.data.x||moved.z!==mover.data.z),'moved to another of its points');
ok('fishing spots move between their points when due');

// Water: outlines, submerged trees, the rift moved out of the bay.
assert.ok(Number((await one(`select count(*) c from eldervale_private.realm_water where id>=9001`)).c)>=10);
assert.equal((await one(`select data->>'floor' f from eldervale_private.realm_objects where id='tree-in-bay'`)).f,'-1');
assert.equal((await one(`select data->>'floor' f from eldervale_private.realm_objects where id='tree-dry'`)).f,null);
assert.equal(Number((await one(`select data->>'z' z from eldervale_private.entities where id='b0e5a000-0000-4000-8000-000000000163'`)).z),290);
assert.ok((await one(`select count(*) c from eldervale_private.shop_stock where item='flyRod'`)).c>0,'the tackle shop sells fly rods');
ok('new water collision, submerged scenery, the moved rift and the tackle shop');

// Console.
await run(`select set_config('test.owner','1',false)`,'owner');
const list=(await one(`select eldervale_private.admin_action('ug_list','{}') r`)).r;assert.equal(list.areas.length,3);assert.ok(list.shortcuts.length>=8&&list.spots.length>=13&&list.waters.length>=10&&list.roster.length>0);
const def=structuredClone(dungeons[0]);def.levels[0].rooms.push({id:'annex',x:-20,z:0,rx:6,rz:5});def.levels[0].tunnels.push({width:3,points:[[0,0],[-20,0]]});def.spawns=def.spawns.filter(s=>s.id!=='bats');
const saved=(await one(`select eldervale_private.admin_action('ug_save',$1::jsonb) r`,[JSON.stringify({data:def})])).r;assert.equal(saved.missingSpawns.length,0);
assert.equal(Number((await one(`select count(*) c from eldervale_private.entities where data->>'spawnGroup'='bats' and not deleted`)).c),0,'removed spawn group retired');
assert.equal((await one(`select eldervale_private.underground_blocked(eldervale_private.tile_of(1180),eldervale_private.tile_of(1200)) b`)).b,false,'the new annex is walkable');
await fails(`select eldervale_private.admin_action('ug_save','{"data":{"id":"bad area"}}')`,/id uses/,'validation');
await one(`select eldervale_private.admin_action('ug_enable','{"id":"cindervault_depths","enabled":false}')`);
assert.equal(Number((await one(`select count(*) c from eldervale_private.realm_actors where data->>'underground'='cindervault_depths' and not deleted`)).c),0,'disabled area has no monsters');
assert.equal((await one(`select eldervale_private.underground_blocked(eldervale_private.tile_of(2800),eldervale_private.tile_of(1200)) b`)).b,false,'walls stay');
await one(`select eldervale_private.admin_action('ug_enable','{"id":"cindervault_depths","enabled":true}')`);
const sc=(await one(`select eldervale_private.admin_action('ug_shortcut_save',$1::jsonb) r`,[JSON.stringify({data:{template:'rope_swing',name:'Test swing',level:40,xp:30,fail:.2,failDamage:50,ticks:4,ends:[[10,10],[20,10]]}})])).r;
assert.equal(sc.data.agility.level,40);assert.equal((await one(`select kind from eldervale_private.realm_objects where id=$1`,[sc.id])).kind,'object');
await one(`select eldervale_private.admin_action('ug_shortcut_enable',$1::jsonb)`,[JSON.stringify({id:sc.id,enabled:false})]);
assert.equal((await one(`select count(*) c from eldervale_private.realm_objects where id=$1`,[sc.id])).c,0);
await one(`select eldervale_private.admin_action('ug_spot_save',$1::jsonb)`,[JSON.stringify({id:cage.id,data:{spotType:'deep',moves:{points:[[cage.data.x,cage.data.z]],minTicks:300,maxTicks:400}}})]);
const ed=await one(`select data from eldervale_private.entities where id=$1`,[cage.id]);assert.equal(ed.data.spotType,'deep');assert.equal(ed.data.ownerEdited,true);
await one(`select eldervale_private.admin_action('ug_water_set','{"id":9002,"passable":true}')`);assert.equal((await one(`select passable from eldervale_private.realm_water where id=9002`)).passable,true);
await run(`select set_config('test.owner','0',false)`,'not owner');await fails(`select eldervale_private.admin_action('ug_list','{}')`,/Owner access/,'owner only');
assert.equal((await one(`select eldervale_private.admin_action('sign_list','{}') r`)).r.signs,true,'sign handler still reached');
ok('console: list, save (validated, re-synced), enable/disable, shortcut editor, spot editor, water toggle, owner-only');
console.log('PASS',n,'checks');
