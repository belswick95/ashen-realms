// Behavioural check of db/tile-perf-1.sql on PGlite, on top of the tick & tile engine harness
// (scripts/tick-tile-db/check.mjs runs stages 1-5 first, then this file applies the perf patch).
// Usage: npm i --no-save @electric-sql/pglite@0.2.17 && node --import ./tests/helpers/preload.js scripts/tile-perf-db/check.mjs
// (or set PGLITE=/path/to/node_modules/@electric-sql/pglite/dist/index.js)
// Every patched result is compared with the unpatched function on the same data.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const {db}=await import('../tick-tile-db/check.mjs');
const repo=new URL('../..',import.meta.url).pathname;
const run=async(sql,label)=>{try{return await db.exec(sql)}catch(e){console.error('FAILED',label,e.message);throw e}};
const one=async(sql,p=[])=>(await db.query(sql,p)).rows[0];
const all=async(sql,p=[])=>(await db.query(sql,p)).rows;
const ms=async fn=>{const t=performance.now();const r=await fn();return [r,performance.now()-t]};
const perf=readFileSync(repo+'db/tile-perf-1.sql','utf8');
for(const w of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+w+'\\b','i').test(perf),'tile-perf-1.sql avoids '+w);

// Stand-ins for live functions the stage harness does not carry. The anchor statements are the live text verbatim.
await run(`do $r$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;end if;if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated;end if;end $r$;
create table if not exists eldervale_private.game_settings(key text primary key,value jsonb);
create table if not exists eldervale_private.shop_stock(merchant text,item text,buy integer,sell integer,stock integer,target_stock integer,primary key(merchant,item));
CREATE OR REPLACE FUNCTION eldervale_private.game_multiplier(name text) RETURNS numeric LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO ''
AS $function$
 select greatest(0,least(100,coalesce((select (g.value->>name)::numeric from eldervale_private.game_settings g where g.key='multipliers' and jsonb_typeof(g.value->name)='number'),1)))
$function$;
CREATE OR REPLACE FUNCTION eldervale_private.merchant_quote(base_buy integer, base_sell integer, available integer, target integer, purchase boolean, amount integer DEFAULT 1)
 RETURNS integer LANGUAGE plpgsql STABLE SET search_path TO ''
AS $function$
declare total bigint:=0;unit_buy integer;unit_sell integer;factor numeric;i integer;
begin
 if base_buy<1 or base_sell<0 or amount not between 1 and 10 then raise exception 'Invalid merchant quote';end if;
 base_buy:=greatest(1,round(base_buy*eldervale_private.game_multiplier('shopPrice')))::integer;base_sell:=least(base_buy,greatest(0,round(base_sell*eldervale_private.game_multiplier('shopPrice'))))::integer;
 for i in 0..amount-1 loop
  factor:=case when available<0 then 1 else greatest(.65,least(1.50,1+(greatest(10,coalesce(target,10))-(available-case when purchase then i else -1 end))::numeric/greatest(10,coalesce(target,10))*.35)) end;
  unit_buy:=greatest(1,ceil(base_buy*factor)::integer);
  unit_sell:=least(floor(base_sell*factor)::integer,greatest(0,floor(unit_buy*.75)::integer));
  total:=total+case when purchase then unit_buy else unit_sell end;
 end loop;
 return total::integer;
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.town_at(px double precision, pz double precision) RETURNS text LANGUAGE plpgsql STABLE SET search_path TO ''
AS $function$
begin
 return (select id from eldervale_private.town_zones where case when square then greatest(abs(px-x),abs(pz-z))<radius else power(px-x,2)+power(pz-z,2)<radius*radius end order by power(px-x,2)+power(pz-z,2) limit 1);
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.realm_request_before_castle(session_id uuid, command text DEFAULT 'sync'::text, payload jsonb DEFAULT '{}'::jsonb, request_id uuid DEFAULT NULL::uuid, event_cursor bigint DEFAULT 0)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO ''
AS $function$
declare result jsonb:='{}';shop_data jsonb;
begin
 select coalesce(jsonb_object_agg(merchant,items),'{}') into shop_data from (select ss.merchant,jsonb_object_agg(ss.item,jsonb_build_object('buy',eldervale_private.merchant_quote(ss.buy,ss.sell,ss.stock,ss.target_stock,true,1),'sell',eldervale_private.merchant_quote(ss.buy,ss.sell,ss.stock,ss.target_stock,false,1),'buy10',eldervale_private.merchant_quote(ss.buy,ss.sell,ss.stock,ss.target_stock,true,10),'stock',ss.stock,'pricing',case when ss.stock<0 then 'fixed' else 'supply' end))items from eldervale_private.shop_stock ss group by ss.merchant)q;
 return result||jsonb_build_object('stateTime',(select tick_at from eldervale_private.realm_clock where id=true),'shops',shop_data);
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.guard_tick(dt double precision)
 RETURNS void LANGUAGE plpgsql SET search_path TO ''
AS $function$
declare m eldervale_private.realm_actors;g eldervale_private.realm_actors;t timestamptz:=clock_timestamp();begin

 update eldervale_private.realm_actors guard_row set data=guard_row.data||jsonb_build_object('level',levels.n,'attackLevel',levels.n,'strengthLevel',levels.n,'defenceLevel',levels.n,'weapon','longsword','hp',greatest((guard_row.data->>'hp')::integer,levels.n*5)),hp=case when guard_row.hp>0 then guard_row.hp+greatest(0,levels.n*5-(guard_row.data->>'hp')::integer) else guard_row.hp end from (select a.id,greatest(60,(a.data->>'level')::integer,coalesce((select max((beast.data->>'level')::integer)+5 from eldervale_private.realm_actors beast where not beast.deleted and coalesce((beast.data->>'hostile')::boolean,false) and abs(beast.x-a.x)<100 and abs(beast.z-a.z)<100),0))n from eldervale_private.realm_actors a where not a.deleted and a.data->>'role'='guard') levels where guard_row.id=levels.id and ((guard_row.data->>'level')::integer<levels.n or (guard_row.data->>'hp')::integer<levels.n*5 or guard_row.data->>'weapon' is distinct from 'longsword');
for m in select * from eldervale_private.realm_actors a where not deleted and hp>0 and coalesce((data->>'hostile')::boolean,false) and eldervale_private.town_at(x,z) is not null and not exists(select 1 from eldervale_private.guard_duels where monster=a.id) and exists(select 1 from eldervale_private.realm_players near_player where near_player.last_seen>t-interval '15 seconds' and abs(near_player.x-a.x)<100 and abs(near_player.z-a.z)<100) loop
  select * into g from eldervale_private.realm_actors a where not deleted and hp>0 and data->>'role'='guard' and not exists(select 1 from eldervale_private.guard_duels where guard=a.id) and sqrt(power(x-m.x,2)+power(z-m.z,2))<90 order by power(x-m.x,2)+power(z-m.z,2),id limit 1;
  if found then insert into eldervale_private.guard_duels(guard,monster) values(g.id,m.id) on conflict do nothing;end if;
 end loop;
end $function$;`,'stand-ins');

// ------------------------------------------------------------------ data
let seed=7;const rnd=()=>(seed=(seed*16807)%2147483647)/2147483647;
await run(`truncate eldervale_private.guard_duels;
 insert into eldervale_private.town_zones(id,x,z,radius,square) values('t1',1000,1000,40,false),('t2',1200,1000,30,true) on conflict do nothing;
 insert into eldervale_private.realm_actors(id,data,x,z,hp) select 'pg'||k,jsonb_build_object('role','guard','kind','npc','level',40+k*3,'hp',150+k*7,'weapon',case when k%4=0 then 'longsword' else 'sword' end),1000+(k%6)*30-60,1000+(k/6)*25-50,case when k%5=0 then 0 else 100 end from generate_series(0,29) k;
 insert into eldervale_private.realm_actors(id,data,x,z,hp) select 'pb'||k,jsonb_build_object('kind','monster','hostile',k%4<>0,'level',(k*37)%90+1)||case when k%11=0 then '{}'::jsonb else jsonb_build_object('x',0) end,1000+((k*73)%400)-200,1000+((k*41)%300)-150,case when k%9=0 then 0 else 10 end from generate_series(0,299) k;
 update eldervale_private.realm_actors set data=data-'level' where id in ('pb5','pg7');
 update eldervale_private.realm_actors set deleted=true where id in ('pb6','pg8');
 insert into eldervale_private.realm_players(user_id,session_id,x,z,last_seen) values('77777777-7777-4777-8777-777777777777','77777777-7777-4777-8777-777777777777',1010,1005,clock_timestamp()) on conflict (user_id) do update set x=excluded.x,z=excluded.z,last_seen=excluded.last_seen;
 insert into eldervale_private.shop_stock select 'm'||(k%7),'item'||k,5+k%40,2+k%13,case when k%5=0 then -1 else k%30 end,case when k%3=0 then null else 10+k%25 end from generate_series(1,150) k;`,'data');
const guardState=()=>all(`select id,data,hp from eldervale_private.realm_actors where id like 'p%' order by id`);
const duels=()=>all(`select guard,monster from eldervale_private.guard_duels order by guard`);
const castle=async()=>(await one(`select eldervale_private.realm_request_before_castle(null,'sync','{}',null,0) r`)).r.shops;
const routeCases=[];for(let k=0;k<14;k++)routeCases.push([Math.round(-340/1.58)+Math.round((rnd()-.5)*50),Math.round(-305/1.58)+Math.round((rnd()-.5)*50),Math.round((rnd()-.5)*70),Math.round((rnd()-.5)*70),k%3]);
// Make the tutorial window interesting: some walls inside it.
await run(`insert into eldervale_private.tile_flags(floor,i,j,flags) select 0,i,-193,1 from generate_series(-230,-200) i where i%7<>0 on conflict do nothing;
 insert into eldervale_private.tile_flags(floor,i,j,flags) select 0,-212,j,2 from generate_series(-205,-180) j on conflict do nothing`,'tutorial walls');
const routes=()=>Promise.all(routeCases.map(([si,sj,di,dj,m])=>one(`select eldervale_private.tile_route($1,$2,$3,$4,$5,$6,$7,$8,32,10,true) r`,[si,sj,['tile','card','near'][m],si+di,sj+dj,(si+di)*1.58,(sj+dj)*1.58,m===2?3.5:0]).then(x=>x.r)));

// Unpatched results, inside a rolled-back transaction where they write.
await run('begin','b');await one(`select eldervale_private.guard_tick(.6) x`);const guardsBefore=await guardState(),duelsBefore=await duels();await run('rollback','r');
const shopsBefore=await castle();
const [routesBefore,routeOld]=await ms(routes);

// ------------------------------------------------------------------ apply twice
for(let pass=1;pass<=2;pass++)await run(perf,'tile-perf-1 pass '+pass);
const def=async fn=>(await one(`select pg_get_functiondef($1::regprocedure) d`,[fn])).d;
const edits=JSON.parse(perf.match(/\$edits\$([\s\S]*?)\$edits\$/)[1]);
for(const [fn,,nw] of edits)assert.equal((await def(fn)).split(nw).length-1,1,fn+' patched once');
console.log('ok tile-perf-1 applies twice; every patch lands once; no DELETE/ALTER/DROP');

// 1. guards: identical updates and duels.
await run('begin','b');await one(`select eldervale_private.guard_tick(.6) x`);const guardsAfter=await guardState(),duelsAfter=await duels();await run('rollback','r');
assert.deepEqual(guardsAfter,guardsBefore,'guard levels/hp updates identical');assert.deepEqual(duelsAfter,duelsBefore,'guard duels identical');
assert.ok(guardsBefore.some(g=>g.data.weapon==='longsword'&&g.id.startsWith('pg'))&&duelsBefore.length>0,'the fixture exercises updates and duels');
console.log(`ok guard_tick: guard_levels() and the reordered town loop give identical updates (${duelsBefore.length} duels)`);

// 3. bounded BFS: identical routes.
const [routesAfter,routeNew]=await ms(routes);
assert.deepEqual(routesAfter,routesBefore,'bounded routes identical');
assert.equal((await one(`select count(*)::int n from generate_series(-400,-280,3) x cross join generate_series(-360,-250,3) z where eldervale_private.tile_tutorial_inside(x,z) is distinct from eldervale_private.tutorial_inside(x,z)`)).n,0,'same tutorial bound');
console.log(`ok tile_route bounded: ${routeCases.length} routes identical (${routeOld.toFixed(0)} -> ${routeNew.toFixed(0)} ms, PGlite)`);

// 4. shops: identical, cached, and refreshed on any stock or multiplier change.
assert.deepEqual(await castle(),shopsBefore,'shop table identical');
const built=(await one(`select built_at from eldervale_private.shop_quote_cache`)).built_at;
assert.deepEqual(await castle(),shopsBefore);assert.equal(+(await one(`select built_at from eldervale_private.shop_quote_cache`)).built_at,+built,'second request served from the cache');
const fresh=async()=>(await one(`select coalesce(jsonb_object_agg(merchant,items),'{}') r from (select ss.merchant,jsonb_object_agg(ss.item,jsonb_build_object('buy',eldervale_private.merchant_quote(ss.buy,ss.sell,ss.stock,ss.target_stock,true,1),'sell',eldervale_private.merchant_quote(ss.buy,ss.sell,ss.stock,ss.target_stock,false,1),'buy10',eldervale_private.merchant_quote(ss.buy,ss.sell,ss.stock,ss.target_stock,true,10),'stock',ss.stock,'pricing',case when ss.stock<0 then 'fixed' else 'supply' end))items from eldervale_private.shop_stock ss group by ss.merchant)q`)).r;
await run(`update eldervale_private.shop_stock set stock=stock-1 where merchant='m1' and item='item8'`,'buy');
let s=await castle();assert.notDeepEqual(s,shopsBefore);assert.deepEqual(s,await fresh(),'a sale refreshes the prices');
await run(`insert into eldervale_private.game_settings values('multipliers','{"shopPrice":1.5}')`,'mult');
s=await castle();assert.deepEqual(s,await fresh(),'a price multiplier refreshes the prices');assert.notEqual(s.m1.item8.buy,shopsBefore.m1.item8.buy);
await run(`insert into eldervale_private.shop_stock values('m9','new',10,4,5,10)`,'new item');assert.deepEqual(await castle(),await fresh(),'a new item refreshes the prices');
console.log('ok shop prices: identical, cached between changes, rebuilt after a sale, a new item or a multiplier change');

// 2. grid refresh only when a source changed.
await one(`select eldervale_private.tile_rebuild_all() r`); // clears the hand-made tutorial walls above
const flags=()=>all(`select i,j,flags,door_bits,door from eldervale_private.tile_flags where floor=0 and (flags<>0 or door_bits<>0) order by i,j`);
assert.ok((await one(`select eldervale_private.tile_refresh_if_dirty() n`)).n>=0,'first check establishes the counts');
let [r,took]=await ms(()=>one(`select eldervale_private.tile_refresh_if_dirty() n`));assert.equal(r.n,0,'nothing changed: no scan');
const [,full]=await ms(()=>one(`select eldervale_private.tile_refresh() n`));
console.log(`   no-change grid check ${took.toFixed(1)} ms (signature scan it replaces: ${full.toFixed(1)} ms, PGlite)`);
await run(`update eldervale_private.realm_objects set open=not open where kind='door';update eldervale_private.realm_objects set available_at=now(),data=data||'{"logsRemaining":3}' where id='tree1'`,'non-geometry');
assert.equal((await one(`select eldervale_private.tile_refresh_if_dirty() n`)).n,0,'doors, respawns and logsRemaining do not dirty the grid');
await run(`insert into eldervale_private.realm_objects(id,kind,x,z,data) values('perf-fish','fishing',40,40,'{"type":"fishing_spot"}');update eldervale_private.realm_objects set x=x+3,data=data||'{"yaw":1}' where id='perf-fish';
 insert into eldervale_private.entities(id,data) values('22222222-1111-4111-8111-000000000009','{"template":"fishing_spot","x":40,"z":40}');update eldervale_private.entities set data=data||'{"x":44}' where id='22222222-1111-4111-8111-000000000009';
 insert into eldervale_private.realm_objects(id,kind,x,z,data) values('tree1','tree',0,0,'{}') on conflict do nothing`,'non-sources');
assert.equal((await one(`select count(*)::int n from eldervale_private.tile_dirty_log where not handled`)).n,0,'moving fishing spots, non-castle entities and zero-row upserts log nothing');
await run(`update eldervale_private.tick_engine set state=state||jsonb_build_object('grid_counts',(select count(*) from eldervale_private.realm_objects)||':'||(select count(*) from eldervale_private.entities)||':'||(select count(*) from eldervale_private.realm_water))`,'counts after the new non-sources');
assert.equal((await one(`select eldervale_private.tile_refresh_if_dirty() n`)).n,0,'no grid scan for non-sources');
const check=async(sql,label)=>{await run(sql,label);const n=(await one(`select eldervale_private.tile_refresh_if_dirty() n`)).n;assert.ok(n>0,label+': refreshed '+n);
 const inc=await flags();await one(`select eldervale_private.tile_rebuild_all() r`);assert.deepEqual(await flags(),inc,label+': equals a full rebuild');
 assert.equal((await one(`select eldervale_private.tile_refresh_if_dirty() n`)).n,0,label+': clean afterwards')};
await check(`update eldervale_private.realm_objects set x=x+4 where id='tree2'`,'moved tree');
await check(`update eldervale_private.realm_objects set data=data||'{"yaw":1.2}' where id='rock3'`,'turned rock');
await check(`insert into eldervale_private.realm_objects(id,kind,x,z,data) values('perf-rock','rock',30,30,'{"template":"rock"}')`,'new rock');
await check(`delete from eldervale_private.realm_objects where id='perf-rock'`,'removed rock');
await check(`update eldervale_private.entities set data=data||'{"x":205}' where data->>'template'='castle_tower'`,'moved tower');
await check(`update eldervale_private.entities set deleted=true where data->>'template'='castle_tower'`,'removed tower');
await check(`update eldervale_private.realm_water set passable=not passable where passable`,'bridge');
await run(`update eldervale_private.realm_water set passable=not passable where id=(select max(id) from eldervale_private.realm_water)`,'bridge back');
assert.ok((await one(`select eldervale_private.tile_refresh_if_dirty(true) n`)).n>=0,'forced check still runs');
console.log('ok grid: refresh only after geometry changes (moves, turns, inserts, removals, castle parts, water) and equals a full rebuild');

// world_tick still ticks in tile mode with the patched engine_tick_begin (grid check on tick n%10=0).
await run(`select eldervale_private.engine_console('console_engine_set','{"config":{"tile_mode":true}}')`,'tile mode on');
for(let k=0;k<3;k++){await run(`update eldervale_private.realm_clock set tick_at=clock_timestamp()-interval '700 milliseconds'`,'stale');await one(`select eldervale_private.engine_tick_begin(eldervale_private.tick_time((eldervale_private.tick_no(clock_timestamp())/10)*10)) x`);await one(`select eldervale_private.world_tick() x`)}
await run(`select eldervale_private.engine_console('console_engine_set','{"config":{"tile_mode":false}}')`,'tile mode off');
console.log('ok world_tick and the grid-check tick run with the patched engine_tick_begin');

// ======================================================================== part 2
const perf2=readFileSync(repo+'db/tile-perf-2.sql','utf8');
for(const w of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+w+'\\b','i').test(perf2),'tile-perf-2.sql avoids '+w);
// Live reply-diet functions, verbatim.
await run(`create table if not exists eldervale_private.sync_diet(user_id uuid primary key,states jsonb,updated_at timestamptz);
CREATE OR REPLACE FUNCTION eldervale_private.diet_actors(uid uuid, full_reply jsonb, have jsonb)
 RETURNS jsonb LANGUAGE plpgsql SET search_path TO ''
AS $function$
declare r jsonb:=full_reply;cur jsonb;base jsonb;known jsonb;changed jsonb;gone jsonb;token text;base_token text;
begin
 if uid is null or r is null or jsonb_typeof(r->'actors') is distinct from 'array' then return r;end if;
 select coalesce(jsonb_object_agg(e->>'id',left(md5(e::text),12)),'{}'::jsonb) into cur from jsonb_array_elements(r->'actors') e;
 select d.states into known from eldervale_private.sync_diet d where d.user_id=uid for update;
 known:=coalesce(known,'{}'::jsonb);
 base_token:=have->>'actorsToken';
 if base_token is not null and known ? base_token then base:=known->base_token;end if;
 token:=md5(random()::text||clock_timestamp()::text);token:=left(token,16);
 if base is not null then
  select coalesce(jsonb_agg(e),'[]'::jsonb) into changed from jsonb_array_elements(r->'actors') e where base->>(e->>'id') is distinct from left(md5(e::text),12);
  select coalesce(jsonb_agg(k),'[]'::jsonb) into gone from jsonb_object_keys(base) k where k<>'_at' and not cur ? k;
  r:=r||jsonb_build_object('actors',changed,'actorsGone',gone,'actorsBase',base_token);
 end if;
 known:=(select coalesce(jsonb_object_agg(s.key,s.value),'{}'::jsonb) from (select key,value from jsonb_each(known) order by (value->>'_at') desc nulls last limit 2) s)
  ||jsonb_build_object(token,cur||jsonb_build_object('_at',to_char(clock_timestamp(),'YYYYMMDDHH24MISSUS')));
 insert into eldervale_private.sync_diet(user_id,states,updated_at) values(uid,known,now())
  on conflict (user_id) do update set states=excluded.states,updated_at=excluded.updated_at;
 return r||jsonb_build_object('actorsToken',token);
end $function$;
CREATE OR REPLACE FUNCTION eldervale_private.diet_reply(full_reply jsonb, have jsonb, keys text[])
 RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SET search_path TO ''
AS $function$
declare r jsonb:=full_reply;digests jsonb:='{}'::jsonb;k text;digest text;
begin
 if r is null or jsonb_typeof(r)<>'object' then return r;end if;
 if have is null or jsonb_typeof(have)<>'object' then have:='{}'::jsonb;end if;
 foreach k in array keys loop
  if r ? k then
   digest:=md5((r->k)::text);digests:=digests||jsonb_build_object(k,digest);
   if have->>k=digest then r:=r-k;end if;
  end if;
 end loop;
 return r||jsonb_build_object('digests',digests);
end $function$;`,'diet stand-ins');

// Unpatched results first.
const U='55555555-5555-4555-8555-555555555555';
const actorsA=Array.from({length:40},(_,k)=>({id:'a'+k,x:k,z:k*2,hp:5}));
const actorsB=actorsA.filter((_,k)=>k%7).map((a,k)=>k%5?a:{...a,x:a.x+1}).concat([{id:'new1',x:1,z:1,hp:1}]);
const md5=async v=>(await one(`select md5($1::jsonb::text) d`,[JSON.stringify(v)])).d;
const replyKeys=['shops','quests','tutorial','objects','gates'];
const fullReply={time:1,shops:{m:{a:1}},quests:[{id:1,big:'x'.repeat(500)}],tutorial:{done:true},objects:[1,2],motion:{x:1}};
const dietCases=[{},{shops:await md5(fullReply.shops)},{shops:await md5(fullReply.shops),quests:await md5(fullReply.quests),objects:'nope'},{tutorial:await md5(fullReply.tutorial),gates:'x'}];
const diets=()=>Promise.all(dietCases.map(h=>one(`select eldervale_private.diet_reply($1::jsonb,$2::jsonb,$3::text[]) r`,[JSON.stringify(fullReply),JSON.stringify(h),replyKeys]).then(x=>x.r)));
const actorDiet=async()=>{await run('begin','b');
 const t=(await one(`select eldervale_private.diet_actors($1,$2::jsonb,'{}') r`,[U,JSON.stringify({actors:actorsA})])).r.actorsToken;
 const r=(await one(`select eldervale_private.diet_actors($1,$2::jsonb,$3::jsonb) r`,[U,JSON.stringify({actors:actorsB}),JSON.stringify({actorsToken:t})])).r;
 await run('rollback','r');return {actors:r.actors,actorsGone:r.actorsGone,base:r.actorsBase===t}};
const pairs2=[];for(let n=0;n<3000;n++){const i=Math.round((rnd()-.5)*190),j=Math.round((rnd()-.5)*190),d=[[1,1],[-1,1],[1,-1],[-1,-1],[1,0],[0,-1],[0,0],[2,0]][n%8];pairs2.push([i,j,d[0],d[1]])}
const moves=async()=>(await one(`select array_agg(eldervale_private.tile_can_move((v->>0)::integer,(v->>1)::integer,(v->>2)::integer,(v->>3)::integer) order by k) r from jsonb_array_elements($1::jsonb) with ordinality e(v,k)`,[JSON.stringify(pairs2)])).r;
const movesStrictBefore=await moves();
await run(`update eldervale_private.tick_engine set config=config||'{"corner_cutting":true}'`,'cc on');const movesCutBefore=await moves();await run(`update eldervale_private.tick_engine set config=config-'corner_cutting'`,'cc off');
const dietsBefore=await diets(),actorDietBefore=await actorDiet();

for(let pass=1;pass<=2;pass++)await run(perf2,'tile-perf-2 pass '+pass);
const edits2=JSON.parse(perf2.match(/\$edits\$([\s\S]*?)\$edits\$/)[1]);
for(const [fn,,nw] of edits2)assert.equal((await def(fn)).split(nw).length-1,1,fn+' patched once');
for(const fn of ['tile_mode()','engine_config()','tile_flags_at(integer,integer)','actor_tile_json(text)','tile_step_tiles(uuid)','tile_motion_json(uuid)'])
 assert.equal((await one(`select proconfig from pg_proc where oid=$1::regprocedure`,['eldervale_private.'+fn])).proconfig,null,fn+' inlinable');
console.log('ok tile-perf-2 applies twice; every patch lands once; helpers inlinable');

assert.deepEqual(await moves(),movesStrictBefore,'tile_can_move identical (no corner cutting)');
await run(`update eldervale_private.tick_engine set config=config||'{"corner_cutting":true}'`,'cc on');assert.deepEqual(await moves(),movesCutBefore,'tile_can_move identical (corner cutting)');await run(`update eldervale_private.tick_engine set config=config-'corner_cutting'`,'cc off');
assert.ok(movesStrictBefore.some(x=>!x)&&movesStrictBefore.some(x=>x),'the moves include blocked and open steps');
assert.deepEqual(await diets(),dietsBefore,'diet_reply identical');
assert.deepEqual(await actorDiet(),actorDietBefore,'diet_actors identical');
assert.ok(actorDietBefore.actors.length>0&&actorDietBefore.actorsGone.length>0&&actorDietBefore.base,'the actor diet case has changes and removals');
console.log(`ok tile_can_move (${pairs2.length} moves, both corner rules), diet_reply and diet_actors give identical results`);

// Stationary NPCs at home: no rewrite every tick; a routed NPC still moves every tick.
await run(`select eldervale_private.engine_console('console_engine_set','{"config":{"tile_mode":true}}')`,'tile mode on');
const S0=Math.round(640/1.58),cx=i=>+(i*1.58).toFixed(3);
await run(`update eldervale_private.realm_actors set deleted=true where not deleted;
 insert into eldervale_private.realm_actors(id,data,x,z,hp) values
 ('shopkeep','{"kind":"npc","name":"Shopkeep","hp":5,"x":${cx(S0+5)},"z":${cx(S0+5)}}',${cx(S0+5)},${cx(S0+5)},5),
 ('walker','{"kind":"npc","name":"Walker","hp":5,"x":${cx(S0+8)},"z":${cx(S0+8)},"route":[{"x":${cx(S0+8)},"z":${cx(S0+8)}},{"x":${cx(S0+20)},"z":${cx(S0+8)}}]}',${cx(S0+8)},${cx(S0+8)},5)
 on conflict (id) do update set data=excluded.data,x=excluded.x,z=excluded.z,hp=excluded.hp,deleted=false,roam_x=null,roam_z=null,roam_pause_until=null,route_step=null,target=null;
 update eldervale_private.realm_players set x=${cx(S0)},z=${cx(S0)},last_seen=clock_timestamp(),path='[]',intent=null where user_id='22222222-2222-4222-8222-222222222222'`,'npcs');
const tickOnce=async()=>{const into=(await one(`select (extract(epoch from clock_timestamp())*1000)::numeric%600 ms`)).ms;if(into>350)await new Promise(r=>setTimeout(r,640-into));
 await run(`update eldervale_private.realm_clock set tick_at=eldervale_private.tick_time(eldervale_private.tick_no(clock_timestamp())-1)+interval '1 millisecond';update eldervale_private.realm_players set last_seen=clock_timestamp()`,'stale');await one(`select eldervale_private.world_tick() x`)};
const row=async id=>(await one(`select xmin::text xm,roam_pause_until p,x ax from eldervale_private.realm_actors where id=$1`,[id]));
await tickOnce();const k1=await row('shopkeep');await tickOnce();const k2=await row('shopkeep');
assert.ok(k1.p,'the stationary NPC was reset once');assert.equal(k2.xm,k1.xm,'a stationary NPC at home is not rewritten while its pause runs');
await run(`update eldervale_private.realm_actors set roam_pause_until=null where id='walker'`,'go');
let moved=0;for(let k=0;k<6;k++){const b=await row('walker');await tickOnce();const a=await row('walker');if(a.ax!==b.ax)moved++}
assert.ok(moved>=4,'the routed NPC walks on every tick: '+moved);
await run(`select eldervale_private.engine_console('console_engine_set','{"config":{"tile_mode":false}}')`,'tile mode off');
console.log(`ok stationary NPCs are not rewritten every tick; a routed NPC still steps every tick (${moved}/6)`);
