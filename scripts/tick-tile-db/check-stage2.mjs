// Stage 2 (players on tiles) and later stages; loaded by check.mjs after stage 1.
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
export default async function({db,run,one,all,ms,repo,T}){
 const stage2=readFileSync(repo+'db/tick-tile-engine-2-players.sql','utf8');
 for(let pass=1;pass<=2;pass++)await run(stage2,'stage 2 pass '+pass);
 const def=async fn=>(await one(`select pg_get_functiondef($1::regprocedure) d`,[fn])).d;
 assert.equal((await def('eldervale_private.advance_player_motion(uuid,timestamptz)')).split('advance_player_tiles(player_id,at_time)').length-1,1,'patched once');
 assert.equal((await def('eldervale_private.world_tick()')).split('engine_tick_begin(t)').length-1,1);
 console.log('ok stage 2 applies twice; every patch lands once');

 const P='22222222-2222-4222-8222-222222222222',S='44444444-4444-4444-8444-444444444444',Q='33333333-3333-4333-8333-333333333333';
 // Open ground for the walking tests: a patch of world far from everything (x 600..700).
 const X0=Math.round(640/T),Z0=Math.round(640/T),cx=i=>+(i*T).toFixed(3);
 await run(`insert into public.player_saves(user_id) values('${P}'),('${Q}');
  insert into eldervale_private.realm_players(user_id,session_id,x,z,motion_at) values('${P}','${S}',${cx(X0)},${cx(Z0)},clock_timestamp()),('${Q}','${S}',${cx(X0+3)},${cx(Z0+3)},clock_timestamp());
  select set_config('test.uid','${P}',false)`,'players');
 const me=()=>one(`select x,z,yaw,path,intent,run,energy,motion_at from eldervale_private.realm_players where user_id='${P}'`);
 const tileOfMe=async()=>{const p=await me();return [Math.round(p.x/T)-X0,Math.round(p.z/T)-Z0]};
 const cmd=(command,payload={})=>one(`select eldervale_private.realm_request_base('${S}',$1,$2::jsonb,gen_random_uuid(),0) r`,[command,JSON.stringify(payload)]);
 // One game tick for this player: rewind motion_at by one tick and advance to now.
 const tick=async(n=1,uid=P)=>{for(let k=0;k<n;k++){await one(`update eldervale_private.realm_players set motion_at=eldervale_private.tick_time(eldervale_private.tick_no(clock_timestamp())-1) where user_id='${uid}'`);await one(`select eldervale_private.advance_player_motion('${uid}',clock_timestamp()) x`)}};
 const at=(i,j)=>[cx(X0+i),cx(Z0+j)];

 // Tile mode off: the old free walker still runs (no snapping to tiles).
 await run(`update eldervale_private.realm_players set path='[[${cx(X0)+3.3},${cx(Z0)}]]',motion_at=clock_timestamp()-interval '.5 seconds' where user_id='${P}';select eldervale_private.advance_player_motion('${P}',clock_timestamp())`,'free walk');
 let p=await me();assert.ok(Math.abs(p.x-cx(X0)-1.3)<.05,'free walker moved 2.6 u/s for 0.5 s: '+(p.x-cx(X0)));
 await run(`update eldervale_private.realm_players set x=${cx(X0)},z=${cx(Z0)},path='[]' where user_id='${P}'`,'reset');
 console.log('ok tile mode off: the old free movement is unchanged');

 await run(`select set_config('test.owner','1',false);select eldervale_private.engine_console('console_engine_set','{"config":{"tile_mode":true}}')`,'tile mode on');
 // Walk 1 tile per tick, run 2.
 let r=await cmd('move',{path:[at(5,0)]});
 assert.deepEqual(r.r.motion.path.map(([x,z])=>[Math.round(x/T)-X0,Math.round(z/T)-Z0]),[[1,0],[2,0],[3,0],[4,0],[5,0]],'server plans tile centres');
 assert.equal(r.r.motion.tile,true);assert.equal(r.r.motion.tileSize,1.58);
 for(let k=1;k<=5;k++){await tick();assert.deepEqual(await tileOfMe(),[k,0],'walk tick '+k)}
 p=await me();assert.equal(p.path.length,0);assert.ok(Math.abs(p.x-cx(X0+5))<1e-6,'stands on the tile centre');
 await run(`update eldervale_private.realm_players set run=true where user_id='${P}'`,'run');
 await cmd('move',{path:[at(0,0)]});const runs=[];for(let k=0;k<3;k++){await tick();runs.push((await tileOfMe())[0])}
 assert.deepEqual(runs,[3,1,0],'run: 2 tiles per tick, odd remainder single step');
 await run(`update eldervale_private.realm_players set run=false where user_id='${P}'`,'walk');
 r=await cmd('sync');assert.equal(r.r.motion.stepTiles,0,'idle walker');
 await cmd('move',{to:at(0,4),path:[at(0,4)]});r=await cmd('sync');assert.equal(r.r.motion.stepTiles,1,'walking 1 tile per tick');
 await cmd('stop');await tick();assert.deepEqual(await tileOfMe(),[0,0],'stop stops');
 console.log('ok players walk 1 tile per 600 ms tick, run 2, stop on tile centres; server plans the path');

 // Collision: a wall of trees between; the walker goes round and never enters a blocked tile.
 await run(`insert into eldervale_private.realm_objects(id,kind,x,z,data) select 'wall'||k,'tree',${cx(X0+3)},(${Z0}+k)*1.58,'{}' from generate_series(-4,4) k;select eldervale_private.tile_refresh()`,'tree wall');
 await cmd('move',{path:[at(6,0)]});const seen=[await tileOfMe()];for(let k=0;k<20;k++){await tick();seen.push(await tileOfMe())}
 assert.deepEqual(seen.at(-1),[6,0],'arrived round the trees');
 for(let k=1;k<seen.length;k++){const [a,b]=[seen[k-1],seen[k]];if(a[0]===b[0]&&a[1]===b[1])continue;
  assert.equal((await one(`select eldervale_private.tile_can_move($1,$2,$3,$4) ok`,[X0+a[0],Z0+a[1],b[0]-a[0],b[1]-a[1]])).ok,true,'legal step '+a+'->'+b)}
 // A blocked destination: the nearest reachable tile.
 await cmd('move',{path:[at(3,0)]});await tick(8);const near=await tileOfMe();
 assert.ok(Math.abs(near[0]-3)+Math.abs(near[1])===1||Math.abs(near[0]-3)===1&&Math.abs(near[1])<=1,'clicked a tree: stands next to it '+near);
 console.log('ok walkers route round obstacles, every step legal; a blocked click ends next to it');

 // Talking to an NPC: stop on an orthogonal tile, both face each other, the NPC turns back later.
 await run(`update eldervale_private.realm_players set x=${cx(X0)},z=${cx(Z0)},path='[]',motion_at=clock_timestamp() where user_id='${P}';
  insert into eldervale_private.realm_actors(id,data,x,z,yaw,hp) values('npc1','{"kind":"npc","name":"Mira","roam":3}',${cx(X0+8)},${cx(Z0+5)},2.5,10)`,'npc');
 await cmd('move',{path:[at(7,5)],target:'npc1',kind:'npc'});
 r=await cmd('sync');const last=r.r.motion.path.at(-1);const lt=[Math.round(last[0]/T)-X0,Math.round(last[1]/T)-Z0];
 assert.equal(Math.abs(lt[0]-8)+Math.abs(lt[1]-5),1,'talk tile is orthogonally adjacent: '+lt);
 await tick(12);assert.deepEqual(await tileOfMe(),lt);
 await run(`truncate eldervale_private.realm_events;update eldervale_private.realm_clock set tick_at=clock_timestamp()-interval '1 second';select eldervale_private.world_tick()`,'tick');
 const ev=await all(`select data from eldervale_private.realm_events`);assert.ok(ev.some(e=>e.data.type==='interaction'&&e.data.target==='npc1'),'talk interaction fired');
 p=await me();const npc=await one(`select x,z,yaw,roam_pause_until from eldervale_private.realm_actors where id='npc1'`);
 assert.ok(Math.abs(p.yaw-Math.atan2(npc.x-p.x,npc.z-p.z))<1e-9,'player faces the NPC');
 assert.ok(Math.abs(npc.yaw-Math.atan2(p.x-npc.x,p.z-npc.z))<1e-9,'NPC faces the player');
 assert.ok(new Date(npc.roam_pause_until)>new Date(Date.now()+5000),'NPC holds still while talking');
 await run(`update eldervale_private.actor_faces set until=clock_timestamp()-interval '1 second';select eldervale_private.engine_tick_begin(clock_timestamp())`,'talk over');
 assert.equal((await one(`select yaw from eldervale_private.realm_actors where id='npc1'`)).yaw,2.5,'NPC returns to its previous facing');
 console.log('ok talk: orthogonal tile, player and NPC face each other, NPC holds then turns back');

 // Objects: a fountain (large) and a tree: end on a tile that reaches it, never inside, face it.
 await run(`insert into eldervale_private.realm_objects(id,kind,x,z,data) values('fount','object',${cx(X0-6)},${cx(Z0-6)},'{"template":"fountain","scale":1.18}'),('oak','tree',${cx(X0+2)},${cx(Z0-8)},'{}');select eldervale_private.tile_refresh()`,'objects');
 for(const id of ['fount','oak']){
  await run(`update eldervale_private.realm_players set x=${cx(X0)},z=${cx(Z0)},path='[]',intent=null where user_id='${P}'`,'home');
  await cmd('move',{path:[at(0,0)],target:id,kind:'object'});await tick(14);
  p=await me();const o=await one(`select x,z,kind,data from eldervale_private.realm_objects where id=$1`,[id]);
  const f=await one(`select eldervale_private.tile_flags_at(eldervale_private.tile_of($1),eldervale_private.tile_of($2)) f`,[p.x,p.z]);assert.equal(f.f&1,0,id+': not inside it');
  const d=Math.hypot(p.x-o.x,p.z-o.z);assert.ok(d<(id==='oak'?3.5:4),id+' within the server reach: '+d.toFixed(2));
  await run(`truncate eldervale_private.realm_events;update eldervale_private.realm_clock set tick_at=clock_timestamp()-interval '1 second';select eldervale_private.world_tick()`,'tick');
  assert.ok((await all(`select data from eldervale_private.realm_events`)).some(e=>e.data.target===id),id+' interaction fired');
  p=await me();assert.ok(Math.abs(p.yaw-Math.atan2(o.x-p.x,o.z-p.z))<1e-9,'faces '+id)}
 // Gathering: an idle tile walker keeps facing the tree it chops.
 await run(`insert into eldervale_private.gathering_actions values('${P}','oak','woodcut',now(),now()+interval '1 hour');update eldervale_private.realm_players set yaw=0,intent=null where user_id='${P}'`,'chop');
 await tick();p=await me();const oak=await one(`select x,z from eldervale_private.realm_objects where id='oak'`);
 assert.ok(Math.abs(p.yaw-Math.atan2(oak.x-p.x,oak.z-p.z))<1e-9,'faces the tree while chopping');
 await run(`truncate eldervale_private.gathering_actions`,'stop chop');
 console.log('ok objects: stop on a tile that reaches it (never inside), interaction fires, player faces it (also while gathering)');

 // Attacking a moving monster: the player re-plans each tick to stay orthogonally adjacent.
 await run(`update eldervale_private.realm_players set x=${cx(X0)},z=${cx(Z0)},path='[]',intent=null where user_id='${P}';
  insert into eldervale_private.realm_actors(id,data,x,z,hp) values('rat','{"kind":"monster","name":"Rat","hp":5,"attackSpeed":2.4}',${cx(X0-5)},${cx(Z0+4)},5)`,'rat');
 await cmd('move',{path:[at(-5,4)],target:'rat',kind:'creature'});await tick(3);
 await run(`update eldervale_private.realm_actors set x=${cx(X0-9)},z=${cx(Z0+7)} where id='rat'`,'rat moves');await tick(9);
 const mt=await tileOfMe();assert.equal(Math.abs(mt[0]+9)+Math.abs(mt[1]-7),1,'followed the rat to an orthogonal tile: '+mt);
 console.log('ok following: attacking a moving monster re-plans every tick and ends orthogonally adjacent');

 // Steering (WASD): one tile per tick in the 8-way direction, sliding along walls.
 await run(`update eldervale_private.realm_players set x=${cx(X0)},z=${cx(Z0)},path='[]',intent=null,input_x=1,input_z=0,input_yaw=1.57,input_until=clock_timestamp()+interval '5 seconds' where user_id='${P}'`,'steer');
 await tick(2);assert.deepEqual(await tileOfMe(),[2,0],'steered 2 tiles east in 2 ticks');
 await run(`update eldervale_private.realm_players set input_x=.7,input_z=.7 where user_id='${P}'`,'steer NE into the tree wall');
 await tick(2);const sl=await tileOfMe();assert.equal(sl[0],2,'cannot enter the tree wall at x=3');assert.ok(sl[1]>0,'slides north along it: '+sl);
 await run(`update eldervale_private.realm_players set input_until=null,input_x=0,input_z=0 where user_id='${P}'`,'release');
 console.log('ok steering moves one tile per tick in 8 directions and slides along walls');

 // Long map click: walks in legs along the client waypoints, beyond the search window.
 await run(`update eldervale_private.realm_players set x=${cx(X0)},z=${cx(Z0+20)},path='[]',intent=null,run=true,energy=100 where user_id='${P}'`,'far');
 await cmd('move',{path:[at(30,20),at(60,20),at(80,25)]});await tick(60);
 assert.deepEqual(await tileOfMe(),[80,25],'arrived after several legs');
 console.log('ok long clicks walk in legs (search window ±32 tiles)');

 // Remote players carry their tick time and step size for smooth interpolation.
 await run(`update eldervale_private.realm_players set last_seen=clock_timestamp() where user_id='${Q}'`,'Q online');
 r=await cmd('sync');const q=r.r.players.find(x=>x.id===Q);assert.ok(q&&'at' in q&&'stepTiles' in q,'players carry at/stepTiles');
 console.log('ok replies: motion.tile/stepTiles/tileSize, players[].at/stepTiles');
 await run(`select eldervale_private.engine_console('console_engine_set','{"config":{"tile_mode":false}}')`,'tile mode off');
 if(existsSync(new URL('./check-stage3.mjs',import.meta.url)))await (await import('./check-stage3.mjs')).default({db,run,one,all,ms,repo,T,P,S,Q,X0,Z0,cx,cmd,tick,me,tileOfMe,at});
}
