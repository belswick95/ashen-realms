// Stage 5 (600 ms cadence); loaded by check-stage4.mjs.
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
export default async function(ctx){
 const {run,one,all,ms,repo,P,X0,Z0,cx,cmd}=ctx;
 const stage5=readFileSync(repo+'db/tick-tile-engine-5-cadence.sql','utf8');
 for(let pass=1;pass<=2;pass++)await run(stage5,'stage 5 pass '+pass);
 assert.equal((await one(`select pg_get_functiondef('eldervale_private.realm_request_base(uuid,text,jsonb,uuid,bigint)'::regprocedure) d`)).d.split('request_tick()').length-1,1);
 console.log('ok stage 5 applies twice (pg_cron absent here: the schedule step is skipped)');
 const clock=async()=>+(await one(`select tick_at from eldervale_private.realm_clock`)).tick_at;
 // Inline driver: a command still runs the world tick (today's behaviour).
 await run(`update eldervale_private.realm_clock set tick_at=clock_timestamp()-interval '2 seconds'`,'stale clock');
 let before=await clock();await cmd('sync');assert.notEqual(await clock(),before,'inline: commands tick the world');
 // Loop driver with a fresh clock: commands only advance their own walker.
 await run(`select eldervale_private.engine_console('console_engine_set','{"config":{"tile_mode":true,"tick_driver":"loop"}}')`,'loop');
 await run(`update eldervale_private.realm_clock set tick_at=clock_timestamp()-interval '200 milliseconds';
  update eldervale_private.realm_players set x=${cx(X0)},z=${cx(Z0+40)},path='[]',intent=null,motion_at=clock_timestamp() where user_id='${P}'`,'fresh clock');
 before=await clock();const r=await cmd('move',{path:[[cx(X0+3),cx(Z0+40)]]});
 assert.equal(await clock(),before,'loop: a command does not run the world tick');
 assert.ok(r.r.motion.path.length>=2,'the move was planned and waits for the next ticks: '+r.r.motion.path.length);
 // A stopped loop (stale clock): commands fall back to ticking inline.
 await run(`update eldervale_private.realm_clock set tick_at=clock_timestamp()-interval '3 seconds'`,'loop stopped');
 before=await clock();await cmd('sync');assert.notEqual(await clock(),before,'fallback: commands tick when the loop is silent');
 // The loop itself: 600 ms ticks for ~2.5 s, one world tick per game tick.
 await run(`truncate eldervale_private.test_log`,'log');
 const ticks0=(await one(`select eldervale_private.tick_no(clock_timestamp()) n`)).n;
 const [,took]=await ms(()=>db_call(ctx,`call eldervale_private.tick_loop(3)`));
 const st=(await one(`select state from eldervale_private.tick_engine`)).state;
 const ticks1=(await one(`select eldervale_private.tick_no(clock_timestamp()) n`)).n;
 assert.ok(took>2500&&took<4500,'ran for its seconds: '+took.toFixed(0));
 assert.ok(st.loop_at&&st.tick_ms>=0,'loop recorded its timing');
 assert.ok(Math.abs(+new Date(await clock())-Math.floor(+new Date(await clock())/600)*600)<120,'ticks start on the 600 ms boundary');
 console.log(`ok tick_loop: ${ticks1-ticks0} game ticks in ${took.toFixed(0)} ms, tick ${st.tick_ms} ms; inline/loop/fallback request paths`);
 await run(`select eldervale_private.engine_console('console_engine_set','{"config":{"tile_mode":false,"tick_driver":"inline"}}')`,'back to inline');
 // A loop started while the driver is inline exits at once.
 const [,idle]=await ms(()=>db_call(ctx,`call eldervale_private.tick_loop(3)`));assert.ok(idle<300,'inline driver: the loop exits at once');
 console.log('ok the loop only runs while tick_driver = loop');

 // db/walk-redirect.sql: a new click while walking keeps the step in progress; no idle tick.
 const redirect=readFileSync(repo+'db/walk-redirect.sql','utf8');
 for(let pass=1;pass<=2;pass++)await run(redirect,'walk-redirect pass '+pass);
 await run(`select eldervale_private.engine_console('console_engine_set','{"config":{"tile_mode":true}}')`,'tile mode on');
 const {tick,tileOfMe,at}=ctx,T=1.58;
 await run(`update eldervale_private.realm_players set x=${cx(X0)},z=${cx(Z0+40)},path='[]',intent=null,run=false,input_until=null,motion_at=clock_timestamp() where user_id='${P}'`,'start');
 await cmd('move',{path:[at(8,40)]});await tick(2);
 const before2=await tileOfMe(),old=(await one(`select path from eldervale_private.realm_players where user_id='${P}'`)).path;
 const r2=await cmd('move',{path:[at(before2[0],48)]});
 const first=r2.r.motion.path[0],firstTile=[Math.round(first[0]/T)-X0,Math.round(first[1]/T)-Z0],here=[Math.round(r2.r.motion.x/T)-X0,Math.round(r2.r.motion.z/T)-Z0];
 const oldNext=[Math.round(old[0][0]/T)-X0,Math.round(old[0][1]/T)-Z0];
 assert.ok(String(firstTile)===String(oldNext)||String(here)===String(oldNext),'the step in progress is kept: '+firstTile+' vs '+oldNext);
 const trail=[await tileOfMe()];for(let k=0;k<12;k++){await tick();trail.push(await tileOfMe())}
 const end=trail.findIndex(t=>t[1]===48);assert.ok(end>0,'arrived: '+JSON.stringify(trail));
 for(let k=1;k<=end;k++)assert.notDeepEqual(trail[k],trail[k-1],'moved on every tick until arrival: '+JSON.stringify(trail));
 assert.equal(trail.at(-1)[1],48,'arrived at the new destination row');
 const r3=await cmd('move',{path:[at(trail.at(-1)[0],48)]});assert.equal(r3.r.motion.path.length,0,'a click on your own tile when idle: no step');
 console.log('ok redirect while walking (tile mode): the step in progress is kept and the walker moves every tick');
 await run(`select eldervale_private.engine_console('console_engine_set','{"config":{"tile_mode":false}}')`,'tile mode off');
}
const db_call=(ctx,sql)=>ctx.run(sql,'call');
