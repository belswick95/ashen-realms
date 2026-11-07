// Movement v3 harness: the live tick & tile engine and the browser client, simulated end to end.
//
// Server (mirrors eldervale_private.advance_player_tiles / tile_plan_move / engine_tick_due):
//  - 600 ms ticks numbered floor(t/600); a walker steps `steps` tiles per tick (walk 1, run 2,
//    ride 3) along its path, planning the next leg when one ends; motion_at = the tick time;
//  - world_tick runs from pg_cron about once a second (1000 ms +- jitter) and catches up at most
//    2 ticks per run (max_catchup_ticks=1); with driver 'inline' every request also runs it first
//    (request_tick: the live default, tick_driver='inline');
//  - a move is planned from the walker's tile; 'legacy' keeps the step in progress (the live
//    keep_step: path[0] of the old route first), 'v3' takes the client's `from` tile when it lies
//    on the route still ahead (db/movement-v3.sql).
// Client (mirrors realm-client.js and game.js):
//  - requests are serialized; a poll is sent every 250 ms when nothing is in flight; each request
//    has a 50-400 ms round trip; snapshots taken while a move is queued are marked stale;
//  - the local player: createLocalWalker, a click planned with planTileMove at once from the
//    walker's tile, verify() on every snapshot, update() every frame;
//  - observers (another player's client): createTilePlayback fed with {x,z,yaw,at,stepTiles}.
import {TILE,FLAG,tileOf,tileCenter,canMove,planTileMove} from '../../tile-grid.js';
import {createLocalWalker,createTilePlayback,createTickLateness,TICK_MS} from '../../motion-track.js';

export function rng(seed){let s=seed>>>0||1;return ()=>{s=(s*1664525+1013904223)>>>0;return s/4294967296}}
export const stepDist=(a,b)=>Math.max(Math.abs(b.x-a.x),Math.abs(b.z-a.z))/TILE;
const tick=t=>Math.floor(t/TICK_MS);

// A walled field: random blocked tiles and a few straight walls; the start (0,0) is kept open.
export function makeGrid(rand,{size=40,density=.08,walls=4}={}){
 const blocked=new Set();
 for(let i=-size;i<=size;i++)for(let j=-size;j<=size;j++)if(rand()<density)blocked.add(i+','+j);
 for(let w=0;w<walls;w++){const horiz=rand()<.5,c=Math.floor(rand()*24)-12,a=Math.floor(rand()*20)-16,len=6+Math.floor(rand()*12);
  for(let k=0;k<len;k++)blocked.add(horiz?(a+k)+','+c:c+','+(a+k))}
 for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++)blocked.delete(i+','+j);
 return {flagsAt:(i,j)=>blocked.has(i+','+j)?FLAG.BLOCK:0,blocked};
}

function createServer({flagsAt,mode='legacy',x=0,z=0,steps=1}){
 const w={x,z,yaw:0,path:[],route:[],steps,motionAt:0,lastTick:0,stepAt:0};
 const ci=()=>tileOf(w.x),cj=()=>tileOf(w.z);
 function plan(ti,tj,route){const r=planTileMove([ti,tj],route,flagsAt,{maxLegs:1});return r}
 return {w,
  advance(t){const now=tick(t),n=Math.min(now-w.lastTick,2);if(n<=0)return false;let i=ci(),j=cj(),moved=false;
   for(let k=0;k<n;k++)for(let s=0;s<w.steps;s++){
    if(!w.path.length&&w.route.length){const r=plan(i,j,w.route);w.path=r.path.map(p=>[...p]);w.route=w.route.slice(1);if(!w.path.length)w.route=[]}
    if(!w.path.length)break;const ni=tileOf(w.path[0][0]),nj=tileOf(w.path[0][1]);
    if(!canMove(flagsAt,i,j,ni-i,nj-j)){w.path=[];w.route=[];break}
    w.path.shift();w.yaw=Math.atan2(ni-i,nj-j);i=ni;j=nj;moved=true}
   if(moved){w.x=tileCenter(i);w.z=tileCenter(j);w.stepAt=now*TICK_MS}w.lastTick=now;w.motionAt=now*TICK_MS;return true},
  move(payload,t){let i=ci(),j=cj();const old=w.path,idle=!old.length;let prefix=[];
   if(mode==='v3'&&Array.isArray(payload.from)){const [fi,fj]=payload.from;
    if((fi!==i||fj!==j)&&!idle){const lim=Math.min(old.length,8);for(let k=0;k<lim;k++)if(tileOf(old[k][0])===fi&&tileOf(old[k][1])===fj){prefix=old.slice(0,k+1);i=fi;j=fj;break}}}
   else if(mode!=='v3'&&old.length){const ni=tileOf(old[0][0]),nj=tileOf(old[0][1]);if((ni!==i||nj!==j)&&Math.abs(ni-i)<=1&&Math.abs(nj-j)<=1&&canMove(flagsAt,i,j,ni-i,nj-j)){prefix=[old[0]];i=ni;j=nj}}
   let route=payload.path.map(p=>[...p]);while(route.length>1&&Math.max(Math.abs(tileOf(route[1][0])-i),Math.abs(tileOf(route[1][1])-j))<=31)route.shift();
   const r=planTileMove([i,j],route,flagsAt,{maxLegs:1});
   w.path=[...prefix,...r.path].map(p=>[...p]);w.route=route.slice(1).length&&r.path.length?route.slice(1):[];
   if(process.env.SIMDEBUG)console.log("move@",Math.round(t),"tile",ci(),cj(),"from",payload.from,"old",old.slice(0,3).map(p=>p.map(v=>Math.round(v/TILE))),"new",w.path.slice(0,4).map(p=>p.map(v=>Math.round(v/TILE))));
   if(payload.steps)w.steps=payload.steps;
   // db/movement-v3.sql: a walk from rest starts on the next tick.
   if(mode==='v3'&&idle&&w.path.length&&tick(t)>w.lastTick){w.lastTick=tick(t);w.motionAt=w.lastTick*TICK_MS}},
  snapshot(){return {x:w.x,z:w.z,yaw:w.yaw,path:w.path.map(p=>[...p]),at:w.motionAt,stepAt:w.stepAt,tile:true,stepTiles:w.path.length||w.route.length?w.steps:0,moving:w.path.length>0}}};
}

// One scenario. clicks: [{t, goal:[i,j], steps}] (steps: 1 walk, 2 run, 3 ride). Returns frames of
// the local walker and of an observer's playback, the server's track and the walker's counters.
export function simulate({seed=1,flagsAt=()=>0,clicks,start={x:0,z:0},driver='cron',server:serverMode='legacy',fps=60,until=null,rtt=[50,400],cronJitter=150,observer=true,observerFlags=true,observerAt='motion',playbackOptions={},localDriver=null}={}){
 const rand=rng(seed),srv=createServer({flagsAt,mode:serverMode,x:start.x,z:start.z}),events=[];
 const at=(t,f)=>events.push({t,f});
 // pg_cron: about once a second.
 const end=until??(Math.max(...clicks.map(c=>c.t))+30000);
 for(let t=200+rand()*1000;t<end;t+=1000+(rand()*2-1)*cronJitter)at(t,()=>srv.advance(t));
 const clientOffset=(rand()*2-1)*15;// the client's server-clock estimate is off by up to 15 ms
 const serverNow=t=>t+clientOffset;
 // A client: serialized requests, a poll every 250 ms when idle.
 function client(onSnapshot){let busy=false,moves=0;const q=[];
  function send(t){if(busy||!q.length)return;busy=true;const req=q.shift(),trip=rtt[0]+rand()*(rtt[1]-rtt[0]);
   at(t+trip/2,()=>{const ts=t+trip/2;if(driver==='inline')srv.advance(ts);if(req.move)srv.move(req.move,ts);const snap=srv.snapshot();
    at(t+trip,()=>{const tr=t+trip;onSnapshot(snap,tr,{stale:moves-(req.move?1:0)>0});if(req.move)moves--;busy=false;req.done?.(tr);send(tr)})})}
  for(let t=0;t<end;t+=250)at(t,()=>{if(!busy&&!q.length)q.push({});send(t)});
  return {move(t,payload,done){moves++;q.push({move:payload,done});send(t)}};
 }
 const local={x:start.x,z:start.z},walker=createLocalWalker(),frames=[],srvTrack=[],obs=[];
 const lateness=createTickLateness(),seen={at:NaN};
 // localDriver (optional, e.g. an older client to compare): {snapshot(snap,serverNow,meta), click(c,serverNow), frame(local,t,serverNow)}.
 const me=client((snap,t,meta)=>{if(localDriver)return localDriver.snapshot(snap,serverNow(t),meta);lateness.observe(seen.at,snap.at,serverNow(t));seen.at=snap.at;const v=walker.verify(snap,serverNow(t),meta);if(process.env.SIMDEBUG&&v!=="ok"&&v!=="rest")console.log("verify",v,Math.round(t),"S",Math.round(snap.x/TILE),Math.round(snap.z/TILE),"at",snap.at,"path",snap.path.slice(0,6).map(p=>p.map(q=>Math.round(q/TILE)).join(",")).join(" "),"me",(local.x/TILE).toFixed(2),(local.z/TILE).toFixed(2))});
 // The observer: another player's client polling the same world.
 // game.js feeds one shared lateness meter (realmLateness) from its own player's motion tick.
 const obsLateness=createTickLateness(),obsSeen={at:NaN};
 const playback=createTilePlayback({lateness:obsLateness,flagsAt:observerFlags?flagsAt:null,...playbackOptions});
 // An NPC row carries the time of its last step (stepAt), a player its motion tick (motion_at).
 if(observer)client((snap,t)=>(obsLateness.observe(obsSeen.at,snap.at,serverNow(t)),obsSeen.at=snap.at,playback.push({x:snap.x,z:snap.z,yaw:snap.yaw,stepTiles:observerAt==='step'?undefined:snap.stepTiles},t,observerAt==='step'?snap.stepAt:snap.at,serverNow(t))));
 for(const c of clicks)at(c.t,()=>{const gx=c.goal[0]*TILE,gz=c.goal[1]*TILE;
  if(localDriver){me.move(c.t,{path:[[gx,gz]],steps:c.steps||1});c.plan=planTileMove([tileOf(local.x),tileOf(local.z)],[[gx,gz]],flagsAt).path;c.from=[tileOf(local.x),tileOf(local.z)];return}
  const plan=walker.plan(t=>planTileMove(t,[[gx,gz]],flagsAt).path),from=plan.from;walker.walk(plan.path,{serverNow:serverNow(c.t),steps:c.steps||1});
  // game.js: the move is queued right after walk(), so every snapshot before its reply is stale.
  me.move(c.t,{path:[[gx,gz]],from,steps:c.steps||1});walker.ack();c.plan=plan.path;c.from=from});
 const frameMs=1000/fps;for(let t=0;t<end;t+=frameMs)at(t,()=>{const s=localDriver?localDriver.frame(local,t,serverNow(t)):walker.update(local,t);frames.push({t,x:local.x,z:local.z,yaw:s?.yaw??0,snapped:!!s?.snapped});
  const r=observer?playback.sample(t):null;if(r)obs.push({t,x:r.x,z:r.z,yaw:r.yaw,snapped:r.snapped,moving:r.moving});
  const last=srvTrack.at(-1);if(!last||last.x!==srv.w.x||last.z!==srv.w.z)srvTrack.push({t,x:srv.w.x,z:srv.w.z,at:srv.w.motionAt})});
 events.sort((a,b)=>a.t-b.t);
 // Events scheduled while running are inserted in time order.
 for(let k=0;k<events.length;k++){const e=events[k];const n=events.length;e.f();if(events.length>n){const added=events.splice(n);for(const a of added){let lo=k+1,hi=events.length;while(lo<hi){const mid=(lo+hi)>>1;if(events[mid].t<=a.t)lo=mid+1;else hi=mid}events.splice(lo,0,a)}}}
 return {frames,obs,srvTrack,server:srv.w,walker,stats:walker.stats,clicks};
}

// Per-frame motion analysis: pace in tile steps per second, the frames at a bend (the travel
// direction changing inside the frame) left out, as are the first and last moving frames.
export function analyse(frames,{from=-Infinity,to=Infinity}={}){
 const moves=[];for(let k=1;k<frames.length;k++){const a=frames[k-1],b=frames[k];if(b.t<from||b.t>to)continue;const dx=b.x-a.x,dz=b.z-a.z;
  if(Math.hypot(dx,dz)>1e-9)moves.push({k,t:b.t,dt:(b.t-a.t)/1000,dir:Math.atan2(dx,dz),pace:Math.max(Math.abs(dx),Math.abs(dz))/TILE/((b.t-a.t)/1000),snapped:b.snapped,yaw:b.yaw})}
 return moves;
}
export const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
