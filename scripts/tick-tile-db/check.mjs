// Behavioural check of db/tick-tile-engine-*.sql on PGlite (real Postgres in WASM).
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node scripts/tick-tile-db/check.mjs [stage]
// (or set PGLITE=/path/to/node_modules/@electric-sql/pglite/dist/index.js)
// The live-anchor check of every patch is separate: scripts/tick-tile-db/live-anchors.sql
// (read-only; run it against live before applying).
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {bfsRoute,canMove as jsCanMove,FLAG} from '../../tile-grid.js';
const {PGlite}=await import(process.env.PGLITE||'@electric-sql/pglite');
const repo=new URL('../..',import.meta.url).pathname;
const upto=Number(process.argv[2]||9);
export const db=new PGlite();
const run=async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message);throw e}};
const one=async(sql,params=[])=>(await db.query(sql,params)).rows[0];
const all=async(sql,params=[])=>(await db.query(sql,params)).rows;
const ms=async(fn)=>{const t=performance.now();const r=await fn();return [r,performance.now()-t]};

// Schema, then the live collision chain exactly as live got it: perf fixture chain + perf-tick-fix bounds.
await run(readFileSync(new URL('./fixture.sql',import.meta.url),'utf8'),'fixture');
const perf=readFileSync(repo+'scripts/perf-tick-db/fixture.sql','utf8');
await run(perf.slice(perf.indexOf('CREATE OR REPLACE FUNCTION eldervale_private.patch_function'),perf.indexOf('-- Stand-ins')),'live chain');
const fix=readFileSync(repo+'db/perf-tick-fix.sql','utf8');
await run(fix.slice(fix.indexOf('do $collision$'),fix.indexOf('end $collision$;')+16),'perf bounds');
await run(readFileSync(new URL('./fixture-stage2.sql',import.meta.url),'utf8'),'stage-2+ stand-ins');

// A small world in the live data shapes: trees (no template), rocks (scaleX, radians), camp props,
// fences, stations, buildings at many angles and sizes, castle walls/gate/towers, a river + bridge.
let seed=11;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
const objects=[];
for(let i=0;i<500;i++)objects.push({id:'tree'+i,kind:'tree',x:(rnd()-.5)*300,z:(rnd()-.5)*300,data:{}});
for(let i=0;i<60;i++)objects.push({id:'rock'+i,kind:'rock',x:(rnd()-.5)*300,z:(rnd()-.5)*300,data:{template:'rock',yaw:rnd()*6,scale:1+rnd()*.3,scaleX:1.4,scaleZ:1.4}});
const props=['tent','fence','hay_bale','barrel','crate','market','bench','fountain','well','furnace','anvil','workbench','supply_wagon','campfire','stool'];
for(let i=0;i<300;i++){const t=props[i%props.length];objects.push({id:'prop'+i,kind:t==='market'?'merchant':'object',x:(rnd()-.5)*300,z:(rnd()-.5)*300,data:{template:t,yaw:rnd()*360,scale:.8+rnd()*.5}})}
const doors=[];
for(let i=0;i<24;i++){const yaw=[0,Math.PI/2,Math.PI,4.712,-0.525,0.785,2.3][i%7],sc=[1.43,1.56,1.93,2.41,3.9,5.72][i%6];const d={id:'door'+i,kind:'door',x:-140+(i%6)*55,z:-140+Math.floor(i/6)*55,data:{template:'cottage',yaw,scale:sc/1.3,scaleX:sc,scaleZ:sc}};objects.push(d);doors.push(d)}
await db.query(`insert into eldervale_private.realm_objects(id,kind,x,z,data,open) select o->>'id',o->>'kind',(o->>'x')::float8,(o->>'z')::float8,o->'data',(o->>'id') like 'door%' from jsonb_array_elements($1::jsonb) o`,[JSON.stringify(objects)]);
// Clear a yard around every building so the doorway approach is testable.
await run(`update eldervale_private.realm_objects o set x=o.x+700 where kind<>'door' and exists(select 1 from eldervale_private.realm_objects d where d.kind='door' and abs(d.x-o.x)<18 and abs(d.z-o.z)<18)`,'yards');
await run(`insert into eldervale_private.entities(id,data) values
 ('11111111-1111-4111-8111-000000000001','{"template":"castle_wall","x":200,"z":-200,"yaw":0,"length":24}'),
 ('11111111-1111-4111-8111-000000000002','{"template":"castle_gate","x":200,"z":-176,"yaw":0,"length":24}'),
 ('11111111-1111-4111-8111-000000000003','{"template":"castle_tower","x":212,"z":-200,"scale":0.97}'),
 ('11111111-1111-4111-8111-000000000004','{"template":"castle_wall","x":230,"z":-200,"yaw":90,"length":24}'),
 ('11111111-1111-4111-8111-000000000005','{"template":"castle_wall","x":176,"z":-176,"yaw":0,"length":24}'),
 ('11111111-1111-4111-8111-000000000006','{"template":"castle_wall","x":224,"z":-176,"yaw":0,"length":24}');
 insert into eldervale_private.realm_objects(id,kind,x,z,data,open) values('11111111-1111-4111-8111-000000000002','castle_gate',200,-176,'{"template":"castle_gate"}',false);
 insert into eldervale_private.realm_water(passable,outline) values(false,'((160,40),(190,40),(190,140),(160,140))'),(true,'((158,80),(192,80),(192,86),(158,86))')`,'castle and river');

// ---------- Stage 1 ----------
const stage1=readFileSync(repo+'db/tick-tile-engine-1-grid.sql','utf8');
for(let pass=1;pass<=2;pass++)await run(stage1,'stage 1 pass '+pass);
console.log('ok stage 1 applies twice');
const [built,buildMs]=await ms(()=>one(`select eldervale_private.tile_rebuild_all() r`));
assert.ok(built.r.tiles>1000,'grid has tiles: '+built.r.tiles);
console.log(`ok full grid rebuild: ${built.r.tiles} non-empty tiles in ${buildMs.toFixed(0)} ms (${objects.length} objects, 4 castle parts, water)`);

// Parity with can_step: walk centre to centre in 0.15 steps exactly as advance_player_motion did.
const T=1.58;const pairs=[];
for(let n=0;n<5000;n++){const i=Math.round((rnd()-.5)*190),j=Math.round((rnd()-.5)*190),d=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]][n%8];pairs.push([i,j,d[0],d[1]])}
const parity=await all(`select p.n,eldervale_private.tile_can_move(p.i,p.j,p.di,p.dj) grid,
 (select bool_and(eldervale_private.can_step(ax,az,bx,bz)) from (select (p.i*1.58)+(p.di*1.58)*(s-1)/k ax,(p.j*1.58)+(p.dj*1.58)*(s-1)/k az,(p.i*1.58)+(p.di*1.58)*s/k bx,(p.j*1.58)+(p.dj*1.58)*s/k bz from (select ceil(sqrt(p.di*p.di+p.dj*p.dj)*1.58/.15)::int k) kk cross join generate_series(1,kk.k) s) st) old,
 eldervale_private.tile_flags_at(p.i,p.j)&1<>0 start_blocked
 from (select (e->>0)::int i,(e->>1)::int j,(e->>2)::int di,(e->>3)::int dj,n from jsonb_array_elements($1::jsonb) with ordinality x(e,n)) p`,[JSON.stringify(pairs)]);
const rows=parity.filter(r=>!r.start_blocked),card=rows.filter((r,k)=>pairs[r.n-1][2]===0||pairs[r.n-1][3]===0),diag=rows.filter(r=>!card.includes(r));
const agree=list=>list.filter(r=>r.grid===r.old).length/list.length;
const gridLoose=card.filter(r=>r.grid&&!r.old).length,gridTight=card.filter(r=>!r.grid&&r.old).length;
console.log(`   parity vs can_step: cardinal ${(100*agree(card)).toFixed(2)} % of ${card.length} (grid allows ${gridLoose} old refused, refuses ${gridTight} old allowed); diagonal ${(100*agree(diag)).toFixed(2)} % of ${diag.length} (stricter: no corner cutting); blocked/open moves: ${card.filter(r=>!r.old).length}/${card.length}`);
assert.ok(agree(card)>=.97,'cardinal moves match can_step');
assert.ok(diag.filter(r=>r.grid&&!r.old).length<=diag.length*.01,'diagonals almost never allow what can_step refused');
console.log('ok tile moves match the old can_step collision');

// Every building is enterable through its open doorway and sealed when the door closes.
const doorCheck=async(strict=true)=>{const out=[];for(const d of doors){const s=d.data.scaleX,q=d.data.yaw;
 // can_step frame: tz=((x-cx)sin q+(z-cz)cos q)/s, so local (0,tz) maps to world (cx+tz*s*sin q, cz+tz*s*cos q).
 const fx=d.x+4.5*s*Math.sin(q),fz=d.z+4.5*s*Math.cos(q);
 const r=await one(`select eldervale_private.tile_route(eldervale_private.tile_of($1),eldervale_private.tile_of($2),'tile',eldervale_private.tile_of($3),eldervale_private.tile_of($4),$3,$4,0,48,0,false,$5) r`,[fx,fz,d.x,d.z,strict]);out.push(r.r.reached)}return out};
let inside=await doorCheck();
console.log('   open doors reachable:',inside.filter(Boolean).length+'/'+doors.length,'(with corner cutting:',(await doorCheck(false)).filter(Boolean).length+')');
if(process.env.DEBUG_DOOR)for(const [k,ok] of inside.entries())if(!ok){const d=doors[k],ci=Math.round(d.x/T),cj=Math.round(d.z/T),r=Math.ceil(2.6*d.data.scaleX/T)+2;const f=new Map((await all(`select i,j,eldervale_private.tile_flags_at(i,j) f from generate_series(${ci-r},${ci+r}) i,generate_series(${cj-r},${cj+r}) j`)).map(x=>[x.i+','+x.j,x.f]));console.log(d.id,d.data.yaw,d.data.scaleX);for(let j=cj+r;j>=cj-r;j--){let line='';for(let i=ci-r;i<=ci+r;i++){const v=f.get(i+','+j);line+=(i===ci&&j===cj?'C':v&1?'#':v&4?'^':'.')+(v&2?'|':' ')}console.log(line)}const fx=d.x+4.5*d.data.scaleX*Math.sin(d.data.yaw),fz=d.z+4.5*d.data.scaleX*Math.cos(d.data.yaw);const back=await one(`select eldervale_private.tile_route(${ci},${cj},'tile',eldervale_private.tile_of(${fx}),eldervale_private.tile_of(${fz}),${fx},${fz},0,48,-1,false,false) r`);console.log('front tile',Math.round(fx/T)-ci,Math.round(fz/T)-cj,'from centre:',JSON.stringify(back.r.path.map(([x,z])=>[Math.round(x/T)-ci,Math.round(z/T)-cj])),back.r.reached,'doorbits near:',JSON.stringify(await all(`select i-${ci} di,j-${cj} dj,door_bits,flags from eldervale_private.tile_flags where door_bits<>0 and i between ${ci-r} and ${ci+r} and j between ${cj-r} and ${cj+r}`)))}
assert.ok(inside.every(Boolean),'every open building is enterable on tiles: '+inside.map((v,k)=>v?'':doors[k].id+'('+doors[k].data.yaw.toFixed(2)+','+doors[k].data.scaleX+')').filter(Boolean).join(' '));
await run(`update eldervale_private.realm_objects set open=false where kind='door'`,'close doors');
inside=await doorCheck();assert.ok(inside.every(v=>!v),'closed doors seal every building');
await run(`update eldervale_private.realm_objects set open=true where kind='door'`,'reopen');
console.log('ok every building is enterable through its open doorway (all angles/sizes) and sealed when closed');

// Castle gate: closed blocks, open lets through; tower and wall block.
const gate=async()=>(await one(`select (eldervale_private.tile_route(eldervale_private.tile_of(200),eldervale_private.tile_of(-170),'tile',eldervale_private.tile_of(200),eldervale_private.tile_of(-182),200,-182,0,8,0)->>'reached')::boolean r`)).r;
assert.equal(await gate(),false,'closed castle gate blocks');
await run(`update eldervale_private.realm_objects set open=true where id='11111111-1111-4111-8111-000000000002'`,'open gate');
if(process.env.DEBUG_GATE){const ci=Math.round(200/T),cj=Math.round(-176/T);const f=new Map((await all(`select i,j,flags,door_bits,door from eldervale_private.tile_flags where i between ${ci-6} and ${ci+6} and j between ${cj-6} and ${cj+6}`)).map(x=>[x.i+','+x.j,x]));for(let j=cj+6;j>=cj-6;j--){let l='';for(let i=ci-6;i<=ci+6;i++){const v=f.get(i+','+j);l+=(v?.flags&1?'#':v?.door_bits&1?'D':'.')+(v?.flags&4?'^':v?.door_bits&4?"'":' ')}console.log(l)}console.log(JSON.stringify([...f.values()].filter(v=>v.door).slice(0,2)),await all(`select id,open from eldervale_private.realm_objects where kind='castle_gate'`))}
assert.equal(await gate(),true,'open castle gate lets walkers through');
// River: blocked except over the bridge.
const ford=await one(`select eldervale_private.tile_route(eldervale_private.tile_of(150),eldervale_private.tile_of(72),'tile',eldervale_private.tile_of(200),eldervale_private.tile_of(72),200,72,0,40,-1) r`);
assert.ok(ford.r.reached,'the river is crossed via the bridge');
assert.ok(ford.r.path.some(([x,z])=>x>165&&x<185&&z>80&&z<86),'route uses the bridge corridor');
console.log('ok castle gate opens/closes on tiles; water blocks except over bridges');

// Incremental refresh equals a full rebuild after objects move, appear and vanish.
const snapshot=async()=>JSON.stringify(await all(`select i,j,flags,door_bits,door from eldervale_private.tile_flags where flags<>0 or door_bits<>0 order by i,j`));
await run(`update eldervale_private.realm_objects set x=x+7 where id in('tree3','prop5','door2');
 update eldervale_private.realm_objects set kind='gone',data=data||'{"template":"none"}' where id='rock4';
 insert into eldervale_private.realm_objects(id,kind,x,z,data) values('newfence','object',10,10,'{"template":"fence","yaw":45,"scale":1}');
 update eldervale_private.entities set data=data||'{"x":205}' where id='11111111-1111-4111-8111-000000000004';
 update eldervale_private.realm_water set outline='((162,40),(190,40),(190,150),(162,150))' where not passable`,'world edits');
const [dirty,refreshMs]=await ms(()=>one(`select eldervale_private.tile_refresh() n`));
const incremental=await snapshot();await one(`select eldervale_private.tile_rebuild_all()`);const full=await snapshot();
assert.equal(incremental,full,'incremental refresh matches a full rebuild');
const [idle,idleMs]=await ms(()=>one(`select eldervale_private.tile_refresh() n`));assert.equal(idle.n,0);
console.log(`ok tile_refresh rebuilds only dirty regions (${dirty.n} sources, ${refreshMs.toFixed(0)} ms) and equals a full rebuild; no-change check ${idleMs.toFixed(1)} ms`);

// BFS vectors on a synthetic patch far from the world (spec section 2, grid origin at (1000,1000)).
const O=1000;const setTiles=async list=>{await run(`update eldervale_private.tile_flags set flags=0,door_bits=0 where i>=${O-80}`,'clear patch');for(const [i,j,f] of list)await db.query(`insert into eldervale_private.tile_flags(floor,i,j,flags) values(0,$1,$2,$3) on conflict(floor,i,j) do update set flags=excluded.flags`,[O+i,O+j,f])};
const route=async(s,g,mode='tile',extra={})=>{const r=(await one(`select eldervale_private.tile_route($1,$2,$3,$4,$5,$6,$7,$8,$9,$10) r`,[O+s[0],O+s[1],mode,O+g[0],O+g[1],(O+g[0])*T,(O+g[1])*T,extra.reach??0,extra.radius??32,extra.alt??10])).r;return {...r,tiles:r.path.map(([x,z])=>[Math.round(x/T)-O,Math.round(z/T)-O])}};
await setTiles([]);
assert.deepEqual((await route([0,0],[5,0])).tiles,[[1,0],[2,0],[3,0],[4,0],[5,0]],'straight walk');
await setTiles([[1,0,FLAG.BLOCK]]);
assert.deepEqual((await route([0,0],[1,1])).tiles,[[0,1],[1,1]],'no corner cutting past a blocked tile');
await setTiles([[0,0,FLAG.E]]);
assert.deepEqual((await route([0,0],[1,1])).tiles,[[0,1],[1,1]],'no diagonal through a wall on the east edge');
await setTiles([]);
assert.deepEqual((await route([5,5],[5,9])).tiles[0],[5,6],'straight goal');
const tie=await route([5,5],[5,5],'card');assert.deepEqual(tie.tiles,[[4,5]],'tie broken W first');
// Pen: goal (10,10) enclosed; nearest reachable tile within 21x21 by Euclid.
const pen=[];for(let k=8;k<=12;k++){pen.push([k,8,FLAG.BLOCK],[k,12,FLAG.BLOCK],[8,k,FLAG.BLOCK],[12,k,FLAG.BLOCK])}await setTiles(pen);
const penRoute=await route([0,0],[10,10]);assert.equal(penRoute.reached,false);assert.ok(['10,7','7,10'].includes(String(penRoute.tiles.at(-1))),'closest reachable tile outside the pen: '+penRoute.tiles.at(-1));
const far=await route([0,0],[10,10],'tile',{alt:1});assert.deepEqual(far.tiles,[],'no tile within the alternative radius: no move');
await setTiles([]);
const melee=await route([4,4],[5,5],'card');assert.equal(melee.tiles.length,1);assert.equal(Math.abs(melee.tiles[0][0]-5)+Math.abs(melee.tiles[0][1]-5),1,'melee ends orthogonally adjacent');
const near=await route([0,0],[6,0],'near',{reach:1.6});assert.deepEqual(near.tiles.at(-1),[5,0],'object reach ends beside it');
console.log('ok BFS vectors: straight, no corner cutting, W-first ties, 21x21 fallback, melee/talk orthogonal, object reach');

// SQL BFS and the client tile-grid.js BFS agree on random mazes.
for(let m=0;m<12;m++){const list=[];const flags=new Map();for(let k=0;k<160;k++){const i=Math.floor(rnd()*21)-10,j=Math.floor(rnd()*21)-10;if(!i&&!j)continue;const f=[FLAG.BLOCK,FLAG.BLOCK,FLAG.E,FLAG.N,FLAG.NE,FLAG.NW][k%6];flags.set(i+','+j,(flags.get(i+','+j)||0)|f)}for(const [k,f] of flags){const [i,j]=k.split(',').map(Number);list.push([i,j,f])}await setTiles(list);
 const g=[Math.floor(rnd()*21)-10,Math.floor(rnd()*21)-10],mode=['tile','card','near'][m%3];
 const sql=await route([0,0],g,mode,{reach:2.5,radius:12});
 const js=bfsRoute({start:[O,O],goal:[O+g[0],O+g[1]],mode,point:[(O+g[0])*T,(O+g[1])*T],reach:2.5,radius:12,alt:10,flagsAt:(i,j)=>flags.get((i-O)+','+(j-O))||0});
 assert.deepEqual(js.path.map(([x,z])=>[Math.round(x/T)-O,Math.round(z/T)-O]),sql.tiles,'maze '+m+' '+mode);assert.equal(js.reached,sql.reached)}
console.log('ok client BFS (tile-grid.js) and server BFS agree on 12 random mazes');
// tile_can_move and the JS canMove agree everywhere on the last maze.
const lastFlags=new Map((await all(`select i,j,flags from eldervale_private.tile_flags where i>=${O-80}`)).map(r=>[r.i+','+r.j,r.flags]));
const cm=await all(`select i,j,di,dj,eldervale_private.tile_can_move(i,j,di,dj) ok from generate_series(${O-6},${O+6}) i,generate_series(${O-6},${O+6}) j,(values(1,0),(-1,0),(0,1),(0,-1),(1,1),(1,-1),(-1,1),(-1,-1)) d(di,dj)`);
for(const r of cm)assert.equal(jsCanMove((i,j)=>lastFlags.get(i+','+j)||0,r.i,r.j,r.di,r.dj),r.ok,`canMove ${r.i},${r.j} ${r.di},${r.dj}`);
console.log('ok tile_can_move and tile-grid.js canMove agree on',cm.length,'moves');

// Worst-case BFS cost: open field, unreachable goal, full 65x65 window.
await setTiles([]);const [, bfsMs]=await ms(()=>route([0,0],[40,40],'tile',{radius:32,alt:-1}));
console.log(`   BFS full 65x65 window: ${bfsMs.toFixed(1)} ms (PGlite/WASM; native Postgres is several times faster)`);

// Console commands.
await run(`select set_config('test.owner','1',false);select set_config('test.uid','99999999-9999-4999-8999-999999999999',false)`,'owner');
const cfg=await one(`select eldervale_private.admin_console('console_engine','{}') r`);assert.equal(cfg.r.config.tile_mode,false);assert.ok(cfg.r.tiles.rows>0);
const set=await one(`select eldervale_private.admin_console('console_engine_set','{"config":{"path_radius":24,"run_default":true}}') r`);assert.equal(set.r.config.path_radius,24);
await assert.rejects(db.query(`select eldervale_private.admin_console('console_engine_set','{"config":{"path_radius":500}}')`),/Invalid value/);
await assert.rejects(db.query(`select eldervale_private.admin_console('console_engine_set','{"config":{"bogus":1}}')`),/Unknown engine setting/);
const view=await one(`select eldervale_private.admin_console('console_tiles_view','{"x":0,"z":0,"radius":10}') r`);assert.ok(Array.isArray(view.r.tiles));
assert.equal((await one(`select eldervale_private.admin_console('console_give_xp','{}') r`)).r.gave,true,'other console commands still work');
await run(`select set_config('test.owner','',false)`,'not owner');await assert.rejects(db.query(`select eldervale_private.engine_console('console_engine','{}')`),/Owner access/);
await run(`select set_config('test.owner','1',false);update eldervale_private.tick_engine set config='{}'`,'reset');
console.log('ok console: engine settings (validated), grid stats, tile overlay data, owner-only');

if(upto>=2&&existsSync(new URL('./check-stage2.mjs',import.meta.url)))await (await import('./check-stage2.mjs')).default({db,run,one,all,ms,repo,T,rnd});
