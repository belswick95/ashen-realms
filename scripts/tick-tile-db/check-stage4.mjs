// Stage 4 (timers in ticks) and later stages; loaded by check-stage3.mjs.
import {readFileSync,existsSync} from 'node:fs';
import assert from 'node:assert/strict';
import {gameTicks} from '../../gear-tiers.js';
export default async function(ctx){
 const {run,one,all,repo,P,X0,Z0,cx,worldTick}=ctx;
 const stage4=readFileSync(repo+'db/tick-tile-engine-4-timing.sql','utf8');
 for(let pass=1;pass<=2;pass++)await run(stage4,'stage 4 pass '+pass);
 console.log('ok stage 4 applies twice');
 const secs=async list=>(await one(`select array_agg(eldervale_private.engine_seconds(s) order by o) r from unnest($1::float8[]) with ordinality u(s,o)`,[list])).r;
 assert.deepEqual(await secs([1.8,2.7]),[1.8,2.7],'tile mode off: seconds unchanged');
 await run(`select eldervale_private.engine_console('console_engine_set','{"config":{"tile_mode":true}}')`,'tile mode on');
 const weapons=[[4,1.8],[5,2.25],[6,2.7],[7,3.15]];
 const got=await secs(weapons.map(w=>w[1]));
 weapons.forEach(([ticks,s],k)=>{assert.ok(Math.abs(got[k]-(gameTicks(ticks)*.6-.05))<1e-9,`weapon ${ticks} old ticks (${s} s) -> ${gameTicks(ticks)} game ticks`)});
 assert.deepEqual(weapons.map(([t])=>gameTicks(t)),[3,4,5,5],'dagger/scimitar 3, longsword 4, battleaxe 5, 2h 5 game ticks (keeps the 0.45 s feel)');
 assert.ok(Math.abs((await secs([1.35]))[0]-1.15)<1e-9,'Rapid bow: one game tick faster (2 ticks)');
 console.log('ok weapon speeds round to whole game ticks (server engine_seconds = client gameTicks)');

 // A swing: wind-up one tick, the next turn after the weapon's ticks.
 await run(`update eldervale_private.realm_players set x=${cx(X0)},z=${cx(Z0)},path='[]',intent=null where user_id='${P}';
  update eldervale_private.realm_actors set deleted=false,hp=50,respawn_at=null,target='${P}',turn='player',phase='ready',x=${cx(X0+1)},z=${cx(Z0)},data=data||'{"hostile":false,"attackSpeed":2.6}' where id='wolf';
  truncate eldervale_private.test_log`,'fight');
 await worldTick();
 const w=await one(`select extract(epoch from due_at-c.tick_at) wind,extract(epoch from turn_at-c.tick_at) turn from eldervale_private.realm_actors a,eldervale_private.realm_clock c where a.id='wolf'`);
 assert.ok(Math.abs(w.wind-.55)<.01,'wind-up one tick: '+w.wind);assert.ok(Math.abs(w.turn-(3*.6-.05))<.01,'unarmed (1.8 s) turn: 3 ticks: '+w.turn);
 // Gathering and recipes on whole ticks.
 await run(`insert into eldervale_private.gathering_actions values('${P}','oak','rod',now(),now()-interval '1 second');
  insert into eldervale_private.skill_jobs values('${P}','r1','fount',null,3,now(),now()-interval '1 second')`,'skilling');
 await worldTick();
 const g=await one(`select extract(epoch from g.due_at-c.tick_at) gather,extract(epoch from j.due_at-c.tick_at) skill from eldervale_private.gathering_actions g,eldervale_private.skill_jobs j,eldervale_private.realm_clock c`);
 assert.ok(Math.abs(g.gather-(7*.6-.05))<.01,'rod fishing 4 s -> 7 ticks: '+g.gather);assert.ok(Math.abs(g.skill-(4*.6-.05))<.01,'2.4 s recipe -> 4 ticks: '+g.skill);
 await run(`truncate eldervale_private.gathering_actions;truncate eldervale_private.skill_jobs;update eldervale_private.realm_actors set target=null where id='wolf'`,'cleanup');
 console.log('ok combat wind-up/turns, gathering and recipe timers fire on whole game ticks');
 await run(`select eldervale_private.engine_console('console_engine_set','{"config":{"tile_mode":false}}')`,'tile mode off');
 if(existsSync(new URL('./check-stage5.mjs',import.meta.url)))await (await import('./check-stage5.mjs')).default(ctx);
}
