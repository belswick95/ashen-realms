// Movement v3 (owner report on move157: "it surges and then walks", "it goes to the left before
// walking"; iPhone and PC, on foot and on a horse). The whole path is simulated end to end
// (tests/helpers/movement-sim.js): 600 ms server ticks run from a ~1 s pg_cron (up to two ticks
// per run) or inline from requests (the live tick_driver), polls every 250 ms with 50-400 ms round
// trips, random walled fields, starts on and off tile centres; the local walker
// (createLocalWalker), a remote player's and an NPC's playback (createTilePlayback).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {simulate,analyse,makeGrid,rng,wrap} from './helpers/movement-sim.js';
import {TILE,bfsRoute,planTileMove,planTileLeg,createTileFlagCache,tileOf} from '../tile-grid.js';
import {createLocalWalker,createTilePlayback,createTickLateness,stepsBetween,TICK_MS} from '../motion-track.js';

const deg=a=>a*180/Math.PI,PACES={walk:1,run:2,ride:3};
function pickGoal(rand,flagsAt,from=[0,0],span=20){for(let n=0;n<300;n++){const g=[from[0]+Math.floor(rand()*(2*span+1))-span,from[1]+Math.floor(rand()*(2*span+1))-span];
 if(Math.max(Math.abs(g[0]-from[0]),Math.abs(g[1]-from[1]))<4)continue;const r=bfsRoute({start:from,goal:g,flagsAt});if(r.reached&&r.path.length>=4)return g}return null}
// Frames inside one straight stretch (the travel direction the same before, during and after).
const straight=(moves,k)=>k>0&&k<moves.length-1&&Math.abs(wrap(moves[k].dir-moves[k-1].dir))<1e-3&&Math.abs(wrap(moves[k+1].dir-moves[k].dir))<1e-3;

// Checks one click-walk of the local player and returns its numbers.
function checkLocal(r,click,steps,tag){
 const moves=analyse(r.frames,{from:click.t}),pace=steps/(TICK_MS/1000);assert.ok(moves.length>2,tag+': walks');
 // Starts at once (the first frame after the click), at the walking pace, never a surge or a lag.
 assert.ok(moves[0].t-click.t<=1000/60+1e-6,tag+': starts on the next frame, '+(moves[0].t-click.t).toFixed(0)+' ms');
 let worst=0;for(let k=0;k<moves.length;k++)if(straight(moves,k))worst=Math.max(worst,Math.abs(moves[k].pace/pace-1));
 assert.ok(worst<=.03,tag+': constant pace, worst '+(worst*100).toFixed(2)+'% off');
 // The first move: toward the first route tile (within 45° of its step), never away from the target.
 const from={x:click.from[0]*TILE,z:click.from[1]*TILE},p0={x:click.plan[0][0],z:click.plan[0][1]};
 const ang=Math.abs(deg(wrap(moves[0].dir-Math.atan2(p0.x-from.x,p0.z-from.z))));assert.ok(ang<=45,tag+': first move '+ang.toFixed(1)+'° off the first step');
 const goal={x:click.plan.at(-1)[0],z:click.plan.at(-1)[1]};
 const stood=r.frames.find(f=>f.t>=click.t);
 if((p0.x-stood.x)*(goal.x-stood.x)+(p0.z-stood.z)*(goal.z-stood.z)>0){let last=Infinity;
  // Over the first step (from where the player stood to the first route tile).
  let prev=null,walked=0;const len=Math.max(Math.abs(p0.x-stood.x),Math.abs(p0.z-stood.z));
  for(const f of r.frames){if(f.t<click.t)continue;if(prev)walked+=Math.max(Math.abs(f.x-prev.x),Math.abs(f.z-prev.z));prev=f;if(walked>len+1e-9)break;
   const d=Math.hypot(goal.x-f.x,goal.z-f.z);assert.ok(d<=last+1e-9,tag+': moved away from the target at the start');last=d}}
 // Facing: the step direction, reached within ~0.1 s of every turn and held.
 let since=moves[0].t;for(let k=1;k<moves.length;k++){if(Math.abs(wrap(moves[k].dir-moves[k-1].dir))>1e-3)since=moves[k].t;
  if(moves[k].t-since>=110&&straight(moves,k))assert.ok(Math.abs(deg(wrap(moves[k].yaw-moves[k].dir)))<1,tag+': faces the step')}
 // Ends exactly on the server's final tile, on a tile centre.
 const end=r.frames.at(-1);assert.ok(Math.hypot(end.x-r.server.x,end.z-r.server.z)<1e-6,tag+': ends on the server tile');
 assert.equal(tileOf(end.x),tileOf(r.server.x));assert.equal(tileOf(end.z),tileOf(r.server.z));
 return {worst,ang};
}
// A remote player's (or an NPC's) playback: one even walk at the true pace, no hold, no surge.
function checkObserver(r,click,steps,tag){
 const moves=analyse(r.obs,{from:click.t}),pace=steps/(TICK_MS/1000);assert.ok(moves.length>2,tag+': observer walks');
 let worst=0;for(let k=0;k<moves.length;k++)if(straight(moves,k))worst=Math.max(worst,Math.abs(moves[k].pace/pace-1));
 assert.ok(worst<=.03,tag+': observer pace constant, worst '+(worst*100).toFixed(2)+'% off');
 const first=moves[0].t,last=moves.at(-1).t;let hold=0;const fr=r.obs.filter(o=>o.t>=first&&o.t<=last);for(let k=1;k<fr.length;k++)if(fr[k].x===fr[k-1].x&&fr[k].z===fr[k-1].z)hold+=fr[k].t-fr[k-1].t;
 assert.equal(hold,0,tag+': observer never stops mid-walk');
 assert.equal(r.obs.filter(o=>o.t>=click.t&&o.snapped).length,0,tag+': observer never snaps');
 const end=r.obs.at(-1);assert.ok(Math.hypot(end.x-r.server.x,end.z-r.server.z)<1e-6,tag+': observer ends on the server tile');
 return {worst,lag:first-click.t};
}

for(const driver of ['cron','inline'])for(const server of ['legacy','v3'])test(`click-walk (${driver} ticks, ${server} server): starts at once, constant pace, faces each step, ends on the server tile, no snaps`,()=>{
 let n=0,worst=0;
 for(let seed=1;seed<=10;seed++){const rand=rng(seed*7919),grid=makeGrid(rand);
  for(const [name,steps] of Object.entries(PACES)){
   const start=seed%2?{x:(rand()-.5)*.9*TILE,z:(rand()-.5)*.9*TILE}:{x:0,z:0},goal=pickGoal(rand,grid.flagsAt);if(!goal)continue;
   const click={t:20000+rand()*600,goal,steps},tag=`${driver}/${server} seed ${seed} ${name}${seed%2?' off-centre':''} to ${goal}`;
   const r=simulate({seed,flagsAt:grid.flagsAt,start,driver,server,cronJitter:100,clicks:[click]});
   worst=Math.max(worst,checkLocal(r,click,steps,tag).worst);
   assert.equal(r.stats.snaps,0,tag+': no snap');assert.equal(r.stats.reroutes,0,tag+': no re-route (the server walks the same route)');
   assert.ok(r.stats.verified>0,tag+': verified against the server');
   checkObserver(r,click,steps,tag+' (remote player)');n++;
  }}
 assert.ok(n>=25,'scenarios run: '+n);
});

test('NPC playback (tick time of the last step): even walk under the cron and inline ticks',()=>{
 for(const driver of ['cron','inline'])for(let seed=1;seed<=8;seed++){const rand=rng(seed*31337),grid=makeGrid(rand),goal=pickGoal(rand,grid.flagsAt);if(!goal)continue;
  const click={t:20000+rand()*600,goal,steps:1};
  const r=simulate({seed,flagsAt:grid.flagsAt,driver,cronJitter:100,observerAt:'step',clicks:[click]});
  checkObserver(r,click,1,`${driver} NPC seed ${seed}`)}
});

test('low frame rate (5 fps, SwiftShader-like): the same constant pace and the same final tile',()=>{
 for(let seed=1;seed<=6;seed++){const rand=rng(seed*7919),grid=makeGrid(rand),goal=pickGoal(rand,grid.flagsAt);if(!goal)continue;
  for(const steps of [1,3]){const click={t:20000+rand()*600,goal,steps};
   const r=simulate({seed,flagsAt:grid.flagsAt,driver:'inline',server:'v3',fps:5,clicks:[click],observer:false});
   const moves=analyse(r.frames,{from:click.t}),pace=steps/.6;
   for(let k=0;k<moves.length;k++)if(straight(moves,k))assert.ok(Math.abs(moves[k].pace/pace-1)<=.03,'5 fps pace');
   assert.ok(Math.hypot(r.frames.at(-1).x-r.server.x,r.frames.at(-1).z-r.server.z)<1e-6,'5 fps ends on the server tile');
   assert.equal(r.stats.snaps,0)}}
});

for(const server of ['v3','legacy'])test(`redirect mid-walk (${server} server): the new walk starts at once toward the new route, never away from the target`,()=>{
 let n=0,snaps=0,reroutes=0;
 for(const open of [true,false])for(let seed=1;seed<=12;seed++){const rand=rng(seed*104729),grid=makeGrid(rand,open?{density:0,walls:0}:{});
  for(const [name,steps] of Object.entries(PACES)){const g1=pickGoal(rand,grid.flagsAt,[0,0],15),g2=pickGoal(rand,grid.flagsAt,[0,0],15);if(!g1||!g2)continue;
   const t1=20000+rand()*600,c2={t:t1+700+rand()*1400,goal:g2,steps},tag=`${server} ${open?'open':'walled'} seed ${seed} ${name}`;
   const r=simulate({seed,flagsAt:grid.flagsAt,driver:'inline',server,clicks:[{t:t1,goal:g1,steps},c2],observer:false});
   if(!c2.plan.length)continue;checkLocal(r,c2,steps,tag);n++;snaps+=r.stats.snaps;reroutes+=r.stats.reroutes;
   // With db/movement-v3.sql the server walks from the tile the client shows: in the open no snap.
   if(server==='v3'&&open)assert.equal(r.stats.snaps,0,tag+': no snap');
  }}
 // Walls: the server may have stepped past the clicked-from tile and route the other way round an
 // obstacle; that is re-routed (rarely placed). The legacy server keeps the old step first.
 assert.ok(snaps<=n*(server==='v3'?.06:.15),`${server}: snaps ${snaps} of ${n} redirects (re-routes ${reroutes})`);
});

test('the local walker re-routes on a real divergence: blocked, stopped, teleported',()=>{
 const w=createLocalWalker(),pos={x:0,z:0};w.update(pos,0);
 const path=[1,2,3,4,5,6].map(i=>[i*TILE,0]);w.walk(path,{serverNow:0,steps:1});w.ack();
 for(let t=16;t<=1200;t+=16)w.update(pos,t);assert.ok(pos.x>1.9*TILE&&pos.x<2.1*TILE,'walked two tiles');
 // The server stopped on tile 1 (blocked): the walker walks back to it, not placed.
 assert.equal(w.verify({x:TILE,z:0,path:[],at:1200,stepTiles:0,yaw:Math.PI/2},1250),'adopt');
 let t=1200;for(;t<=2400;t+=16)w.update(pos,t);assert.ok(Math.abs(pos.x-TILE)<1e-9,'back on the server tile');assert.equal(w.stats.snaps,0);
 // A teleport far away: placed at once.
 assert.equal(w.verify({x:40*TILE,z:5*TILE,path:[],at:2400,stepTiles:0,yaw:0},2450),'adopt');const s=w.update(pos,t+16);
 assert.ok(s.snapped&&pos.x===40*TILE&&pos.z===5*TILE,'snapped to a teleport');
 // At rest on the server tile: nothing to do.
 assert.equal(w.verify({x:40*TILE,z:5*TILE,path:[],at:3000,stepTiles:0,yaw:0},3050),'rest');
 // A server walk the client did not start (combat chase, follow): taken over at the walking pace.
 assert.equal(w.verify({x:40*TILE,z:5*TILE,path:[[41*TILE,5*TILE],[42*TILE,5*TILE]],at:3600,stepTiles:1,yaw:Math.PI/2},3650),'adopt');
 let last=pos.x;for(t+=32;t<5600;t+=16){w.update(pos,t);assert.ok(pos.x-last<=TILE/GAME_TICK_S*.016+1e-9,'never faster than the pace');last=pos.x}
 assert.equal(pos.x,42*TILE);
});
const GAME_TICK_S=TICK_MS/1000;

test('the walker never chases tick jitter: a server one or two ticks ahead or behind is ignored',()=>{
 const w=createLocalWalker(),pos={x:0,z:0};w.update(pos,0);const path=[...Array(12)].map((_,i)=>[(i+1)*TILE,0]);
 w.walk(path,{serverNow:0,steps:1});w.ack();let t=0;
 for(const [at,tile] of [[600,2],[1200,1],[1800,4],[2400,3],[3000,6],[3600,5]]){for(;t<at+200;t+=16)w.update(pos,t);
  assert.equal(w.verify({x:tile*TILE,z:0,path:path.slice(tile),at,stepTiles:1},at+200),'ok','tick '+at+' tile '+tile)}
 assert.equal(w.stats.reroutes,0);
});

test('a click starts from the tile the player is visibly on; mid-step, from the end of the step that makes the walk shorter',()=>{
 const flagsAt=()=>0,w=createLocalWalker(),pos={x:.3*TILE,z:-.2*TILE};w.update(pos,0);
 assert.deepEqual(w.startTile(),[0,0]);
 const p=w.plan(t=>planTileMove(t,[[5*TILE,3*TILE]],flagsAt).path);assert.deepEqual(p.from,[0,0]);
 // Walking east, 0.4 of the way from tile 2 to tile 3, then a click back west: plan from tile 2.
 const v=createLocalWalker(),q={x:2*TILE,z:0};v.update(q,0);v.walk([[3*TILE,0],[4*TILE,0]],{serverNow:0});v.ack();v.update(q,240);
 assert.ok(Math.abs(q.x-2.4*TILE)<1e-9);const back=v.plan(t=>planTileMove(t,[[-3*TILE,0]],flagsAt).path);assert.deepEqual(back.from,[2,0]);
 // ... and a click on ahead (east) carries straight on: never back to tile 2 first.
 const on=v.plan(t=>planTileMove(t,[[8*TILE,0]],flagsAt).path);assert.ok(on.path[0][0]>q.x,'first route tile ahead');
 // Walking north past the middle of a step, a click to the west plans from the tile ahead (2,1):
 // planning from (2,0) would walk back down first.
 const u=createLocalWalker(),r={x:2*TILE,z:0};u.update(r,0);u.walk([[2*TILE,TILE],[2*TILE,2*TILE]],{serverNow:0});u.ack();u.update(r,420);
 const west=u.plan(t=>planTileMove(t,[[-4*TILE,2*TILE]],flagsAt).path);assert.deepEqual(west.from,[2,1]);
});

test('remote steps: a corner taken round a wall is walked in two steps (flags), not cut across',()=>{
 const wall=(i,j)=>i===1&&j===0?1:0;
 assert.deepEqual(stepsBetween({x:0,z:0},{x:TILE,z:TILE},2,wall).map(p=>[Math.round(p.x/TILE),Math.round(p.z/TILE)]),[[0,1],[1,1]]);
 assert.deepEqual(stepsBetween({x:0,z:0},{x:TILE,z:TILE},2,null).map(p=>[Math.round(p.x/TILE),Math.round(p.z/TILE)]),[[1,0],[1,1]],'without flags: split');
 assert.deepEqual(stepsBetween({x:0,z:0},{x:TILE,z:TILE},1,null).length,1,'one tick, one diagonal step');
});

test('tick lateness: the worst recent delivery delay, counting the first tick a snapshot is first to report',()=>{
 const m=createTickLateness();assert.equal(m.value,400,'a default before any data');
 m.observe(0,600,900);m.observe(600,1800,2500);assert.equal(m.value,1300,'a two-tick report: late from its first tick');
 m.observe(1800,1800,2600);m.observe(1800,9000,9100);assert.equal(m.value,1300,'no new tick, or an idle gap: not lateness');
});

test('client route mirror: planTileMove skips near waypoints and plans legs like tile_plan_move/tile_plan_leg',()=>{
 const open=()=>0;
 assert.equal(planTileMove([0,0],[[10*TILE,0],[50*TILE,0]],open,{maxLegs:1}).path.length,10,'a door beyond the window of the next waypoint: its own leg first');
 const all=planTileMove([0,0],[[10*TILE,0],[50*TILE,0]],open);assert.equal(all.path.length,50);assert.deepEqual(all.legs.map(p=>Math.round(p[0]/TILE)),[10,41,50],'legs: the door, 31 tiles on, the goal');
 assert.equal(planTileMove([0,0],[[3*TILE,0],[9*TILE,2*TILE]],open).path.length,9,'a near door waypoint is skipped: BFS straight to the goal');
 const leg=planTileLeg(0,0,[[100*TILE,40*TILE]],open);assert.equal(leg.path.length,31);assert.equal(leg.route.length,1,'the waypoint stays');
 const c=createTileFlagCache();c.set({center:[10,10],radius:40,tiles:[[11,10,1]]});assert.equal(c.flagsAt(11,10),1);assert.equal(c.flagsAt(12,10),0);
 assert.equal(c.covers(10,10,32),true);assert.equal(c.covers(20,10,32),false);
});

test('game.js wiring: a tile click is planned and walked at once, the move carries `from`, snapshots verify',()=>{
 const src=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(src,/const predicted=predictWalk\(route,requestAction,target\);if\(predicted\)localWalker\.walk\(predicted\.path,\{serverNow:[^}]*steps:walkSteps\(\)\}\);await window\.eldervaleRealm\?\.command\('move',\{path:route,target:target\|\|null,kind:requestAction\?\.kind\|\|'walk',\.\.\.\(predicted\?\{from:predicted\.from\}:\{\}\)\}\);if\(predicted\)localWalker\.ack\(\);/);
 assert.match(src,/const verdict=localWalker\.verify\(nextPose,serverNow,\{stale:!!meta\.motionStale\}\)/);
 assert.match(src,/localWalker\.face\(player\.rotation\.y\);const shown=localWalker\.update\(player\.position,performance\.now\(\),followHold\);if\(shown&&!realmInCombat\)player\.rotation\.y=shown\.yaw;/);
 assert.match(src,/createMotionTrack\(\{delay:650,tileOptions:\{flagsAt:walkTiles\.flagsAt\}\}\)/);
 assert.doesNotMatch(src,/createTileFollower|localTileFollower/,'the pace-chasing follower is gone');
 assert.match(src,/function walkSteps\(\)\{return mounted\?3:running&&Number\(state\.runEnergy\)>0\?2:1\}/,'riding: 3 tiles a tick, as advance_player_tiles');
});

test('db/movement-v3.sql: idempotent patch_function edits, no DELETE/ALTER/DROP, joined E literals, a rolled-back dry run',()=>{
 const sql=fs.readFileSync(new URL('../db/movement-v3.sql',import.meta.url),'utf8');
 assert.doesNotMatch(sql,/\b(delete|alter|drop)\b/i);
 assert.match(sql,/^begin;\nset local lock_timeout='5s';/m);assert.match(sql,/\ncommit;\n/);
 assert.ok(sql.includes("if position('-- Movement v3:' in pg_get_functiondef(fn))>0 then return;end if;"),'skipped once applied');
 assert.ok(sql.includes("eldervale_private.patch_function(fn,array["));
 assert.doesNotMatch(sql,/'\s*\n\s*E'/,'adjacent E literals are joined with ||');
 const dry=sql.slice(sql.indexOf('do $dry$'));assert.match(dry,/raise exception 'DRY RUN, rolled back\./);
 // The patch and the dry run carry the same edits.
 const edits=s=>s.slice(s.indexOf('patch_function(fn,array['),s.indexOf(']);',s.indexOf('patch_function(fn,array[')));
 assert.equal(edits(sql),edits(dry));
 assert.ok(sql.includes("keep:=keep||jsonb_build_array(payload->\\'walking\\'->k);")&&sql.includes("payload:=payload-\\'walking\\';"),'from: kept route, no step in progress');
 assert.ok(sql.includes('eldervale_private.tick_time(eldervale_private.tick_no(clock_timestamp()))'),'a walk from rest starts on the next tick');
});
