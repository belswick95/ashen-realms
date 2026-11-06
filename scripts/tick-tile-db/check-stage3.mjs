// Stage 3 (NPCs on tiles) and later stages; loaded by check-stage2.mjs.
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
export default async function(ctx){
 const {run,one,all,ms,repo,T,P,X0,Z0,cx,cmd}=ctx;
 const stage3=readFileSync(repo+'db/tick-tile-engine-3-npcs.sql','utf8');
 for(let pass=1;pass<=2;pass++)await run(stage3,'stage 3 pass '+pass);
 console.log('ok stage 3 applies twice');
 await run(`select eldervale_private.engine_console('console_engine_set','{"config":{"tile_mode":true}}')`,'tile mode on');
 // One world tick: the clock last ticked one game tick ago.
 // Stay clear of a tick boundary so exactly one game tick passes inside world_tick.
 const worldTick=async()=>{const into=(await one(`select (extract(epoch from clock_timestamp())*1000)::numeric%600 ms`)).ms;if(into>350)await new Promise(r=>setTimeout(r,640-into));await one(`update eldervale_private.realm_clock set tick_at=eldervale_private.tick_time(eldervale_private.tick_no(clock_timestamp())-1)+interval '1 millisecond'`);await one(`update eldervale_private.realm_players set motion_at=eldervale_private.tick_time(eldervale_private.tick_no(clock_timestamp())-1),last_seen=clock_timestamp() where user_id='${P}'`);await one(`select eldervale_private.world_tick() x`)};
 const actor=id=>one(`select x,z,yaw,target,hp,respawn_at,phase from eldervale_private.realm_actors where id=$1`,[id]);
 const tileOf=v=>Math.round(v/T);
 // The gate: a second world_tick inside the same game tick does nothing.
 await worldTick();const c1=(await one(`select tick_at from eldervale_private.realm_clock`)).tick_at;await one(`select eldervale_private.world_tick() x`);
 assert.equal(+(await one(`select tick_at from eldervale_private.realm_clock`)).tick_at,+c1,'one world tick per game tick');
 console.log('ok world_tick runs at most once per 600 ms game tick in tile mode');

 // Roaming on tiles: tile centres, at most one tile per tick, every step legal, near home.
 await run(`update eldervale_private.realm_players set x=${cx(X0)},z=${cx(Z0)},path='[]',intent=null,last_seen=clock_timestamp() where user_id='${P}';update eldervale_private.realm_players set last_seen=clock_timestamp()-interval '1 hour' where user_id<>'${P}';
  insert into eldervale_private.realm_actors(id,data,x,z,hp) values('sheep','{"kind":"monster","name":"Sheep","roam":5,"hp":5,"x":${cx(X0+10)},"z":${cx(Z0+10)}}',${cx(X0+10)},${cx(Z0+10)},5)`,'sheep');
 let prev=await actor('sheep'),steps=0;
 for(let k=0;k<40;k++){await run(`update eldervale_private.realm_actors set roam_pause_until=null where id='sheep'`,'no pause');await worldTick();const a=await actor('sheep');
  const di=tileOf(a.x)-tileOf(prev.x),dj=tileOf(a.z)-tileOf(prev.z);
  assert.ok(Math.abs(di)<=1&&Math.abs(dj)<=1,'one tile per tick');
  if(di||dj){steps++;assert.ok(Math.abs(a.x-tileOf(a.x)*T)<1e-6&&Math.abs(a.z-tileOf(a.z)*T)<1e-6,'on a tile centre');
   assert.equal((await one(`select eldervale_private.tile_can_move($1,$2,$3,$4) ok`,[tileOf(prev.x),tileOf(prev.z),di,dj])).ok,true,'legal step')}
  assert.ok(Math.hypot(a.x-cx(X0+10),a.z-cx(Z0+10))<=5+2*T,'stays near home');prev=a}
 assert.ok(steps>=8,'the sheep wandered: '+steps+' steps');
 console.log(`ok roaming moves tile to tile, one tile per tick, legal steps (${steps} steps in 40 ticks)`);

 // Chasing: a hostile monster stops orthogonally next to the player, never on or diagonal to it.
 await run(`insert into eldervale_private.realm_actors(id,data,x,z,hp) values('wolf','{"kind":"monster","name":"Wolf","hostile":true,"hp":50,"attackSpeed":2.4,"x":${cx(X0-3)},"z":${cx(Z0+3)}}',${cx(X0-3)},${cx(Z0+3)},50)`,'wolf');
 for(let k=0;k<8;k++)await worldTick();
 let w=await actor('wolf');assert.equal(w.target,P,'the wolf aggroed');
 assert.equal(Math.abs(tileOf(w.x)-X0)+Math.abs(tileOf(w.z)-Z0),1,'orthogonally adjacent: '+[tileOf(w.x)-X0,tileOf(w.z)-Z0]);
 const log=await all(`select kind from eldervale_private.test_log where id='wolf'`);assert.ok(log.some(r=>r.kind.startsWith('windup')),'the fight started');
 // Safespot: a tree between the wolf and the player stops the dumb chase.
 await run(`update eldervale_private.realm_actors set target=null,phase='ready',x=${cx(X0-3)},z=${cx(Z0)},data=data||'{"hostile":false}' where id='wolf';
  insert into eldervale_private.realm_objects(id,kind,x,z,data) values('safe1','tree',${cx(X0-2)},${cx(Z0)},'{}'),('safe2','tree',${cx(X0-2)},${cx(Z0+1)},'{}'),('safe3','tree',${cx(X0-2)},${cx(Z0-1)},'{}');select eldervale_private.tile_refresh();
  update eldervale_private.realm_actors set target='${P}',turn='enemy',phase='ready' where id='wolf'`,'safespot');
 for(let k=0;k<4;k++)await worldTick();
 w=await actor('wolf');assert.equal(tileOf(w.x)-X0,-3,'stuck behind the trees (safespot)');
 console.log('ok chasing: orthogonal melee tile, dumb pathing (safespots work)');

 // A melee player diagonal to a monster does not start the fight; orthogonal does.
 await run(`update eldervale_private.realm_actors set target=null,hp=50,x=${cx(X0+1)},z=${cx(Z0+1)},data=data||'{"hostile":false}' where id='wolf';
  update eldervale_private.realm_players set intent='{"target":"wolf","kind":"attack"}',path='[]' where user_id='${P}'`,'diagonal');
 await one(`update eldervale_private.realm_clock set tick_at=eldervale_private.tick_time(eldervale_private.tick_no(clock_timestamp())-1)+interval '1 millisecond'`);
 await one(`update eldervale_private.tile_walkers set goal=null where user_id='${P}'`);
 await one(`select eldervale_private.world_tick() x`);
 assert.equal((await actor('wolf')).target,null,'no melee from a diagonal tile');
 await run(`update eldervale_private.realm_actors set x=${cx(X0+1)},z=${cx(Z0)} where id='wolf'`,'orthogonal');await worldTick();
 assert.equal((await actor('wolf')).target,P,'melee from an orthogonal tile');
 console.log('ok melee needs an orthogonal tile (diagonal does not start a fight)');

 // Respawn in whole ticks; replies carry stepAt.
 await run(`update eldervale_private.realm_actors set data=data||'{"respawn":10}',hp=1,phase='windup',turn='player',due_at=clock_timestamp()-interval '1 second',target='${P}' where id='wolf'`,'kill');
 await worldTick();w=await one(`select extract(epoch from respawn_at-(select tick_at from eldervale_private.realm_clock)) s from eldervale_private.realm_actors where id='wolf'`);
 assert.ok(Math.abs(w.s-(17*.6-.05))<.02,'respawn 10 s = 17 ticks: '+w.s);
 const r=await cmd('sync');const sheep=r.r.actors.find(a=>a.id==='sheep');assert.ok(sheep&&typeof sheep.stepAt==='string','actors carry stepAt');
 console.log('ok respawn timers in whole ticks; replies carry actor stepAt');

 // Tick cost with ~250 monsters near players (only actors near players are simulated).
 await run(`insert into eldervale_private.realm_actors(id,data,x,z,hp) select 'm'||k,jsonb_build_object('kind','monster','name','M','roam',4,'hp',5,'hostile',k%3=0,'x',${cx(X0)}+(k%20)*3-30,'z',${cx(Z0)}+(k/20)*3-20),${cx(X0)}+(k%20)*3-30,${cx(Z0)}+(k/20)*3-20,5 from generate_series(1,250) k;
  update eldervale_private.realm_players set x=${cx(X0-40)},z=${cx(Z0-40)},path='[]',intent=null where user_id='${P}'`,'crowd');
 const times=[];for(let k=0;k<10;k++){const [,t]=await ms(()=>worldTick());times.push(t)}
 times.sort((a,b)=>a-b);console.log(`   world_tick with 250 roaming monsters near a player: median ${times[5].toFixed(1)} ms, max ${times[9].toFixed(1)} ms (PGlite/WASM single process)`);
 await run(`update eldervale_private.realm_actors set deleted=true where id like 'm%'`,'crowd away');
 await run(`select eldervale_private.engine_console('console_engine_set','{"config":{"tile_mode":false}}')`,'tile mode off');
 if(existsSync(new URL('./check-stage4.mjs',import.meta.url)))await (await import('./check-stage4.mjs')).default({...ctx,worldTick,actor});
}
