import {slideStep} from './movement-collision.js?v=release-20261107-busy164';
import {projectTilePose,tileSteps,bfsRoute,TILE,GAME_TICK} from './tile-grid.js?v=release-20261107-busy164';
// Timestamped presentation buffer: no position authority or damage is decided here.
// When snapshots arrive later than `delay` (a slow reply on a phone or tablet
// connection) the buffer runs dry and the actor would freeze, then jump. The
// delay then grows by itself (presentation slows to half speed rather than
// stopping) up to `maxExtra` ms, and shrinks back slowly once replies keep up.
export function createMotionTrack({delay=350,maxExtra=600,tileOptions={}}={}){let tile=false,playback=null,frames=[],epoch=null,lastTime=-Infinity,extra=0,lastNow=null;return {get extraDelay(){return extra},push(time,pose,now=performance.now()){if(!Number.isFinite(time))return;if(epoch===null)epoch={server:time,local:now};const prev=frames.at(-1);if(prev&&Math.hypot(pose.x-prev.x,pose.z-prev.z)>12){frames=[];epoch={server:time,local:now};lastTime=-Infinity}if(prev&&time<=prev.time)return;frames.push({...pose,time});if(frames.length>32)frames.shift()},sample(now=performance.now()){if(tile)return playback.sample(now);if(!frames.length)return null;const step=lastNow===null?0:Math.max(0,Math.min(250,now-lastNow));lastNow=now;const newest=frames.at(-1).time,raw=epoch.server+now-epoch.local-delay-extra;if(frames.length>1||raw>newest){if(raw>newest)extra=Math.min(maxExtra,extra+step*.5);else if(raw<newest-delay*.5)extra=Math.max(0,extra-step*.02)}const t=Math.max(lastTime,epoch.server+now-epoch.local-delay-extra);lastTime=t;while(frames.length>2&&frames[1].time<t)frames.shift();const a=frames[0],b=frames[1];if(!b||t<=a.time)return {...a};const f=Math.max(0,Math.min(1,(t-a.time)/(b.time-a.time)));const yaw=a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*f;return {...b,x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,yaw}},clear(){playback?.clear();frames=[];epoch=null;lastTime=-Infinity;extra=0;lastNow=null},
 // Tile walkers (tick & tile engine) are played back by createTilePlayback: `time` is the tick
 // time of the pose (server ms), `serverNow` the server clock when it arrived.
 get tile(){return tile},
 pushTile(time,pose,now=performance.now(),serverNow){if(!pose)return;if(!tile){tile=true;playback=createTilePlayback(tileOptions)}playback.push(pose,now,time,serverNow)}}}

// ---- Movement v3: OSRS tile walking at an exactly constant pace ------------------------------------
// A tile walker crosses `steps` tiles per 600 ms tick (walk 1, run 2, ride 3). A diagonal tile is one
// step like a straight one (OSRS), so all pace here is counted in tile steps (Chebyshev distance /
// TILE), never in ground units. Nothing below speeds up or slows down to chase the server: the only
// corrections are a straight re-route onto the server's route (a real divergence) and, far off, a snap.
export const TILE_WALK_SPEED=TILE/GAME_TICK,TICK_MS=GAME_TICK*1000;
// Gait clamp for NPC strides (game.js); playback itself never runs faster than the true pace.
export const CATCH_UP=1.3;
// Verification tolerance and snap distance, in tile steps; remote buffer in ms (about one tick).
export const VERIFY_TILES=2,SNAP_TILES=4,BUFFER_MS=TICK_MS,JITTER_MS=300,TELEPORT=12;
const stepLen=(ax,az,bx,bz)=>Math.max(Math.abs(bx-ax),Math.abs(bz-az))/TILE;
const cheb=(a,b)=>stepLen(a.x,a.z,b.x,b.z);
const asPoint=p=>{const x=Number(p?.[0]??p?.x),z=Number(p?.[1]??p?.z);return Number.isFinite(x)&&Number.isFinite(z)?{x,z}:null};
const pointsOf=path=>{const out=[];for(const p of Array.isArray(path)?path:[]){const q=asPoint(p);if(!q)break;out.push(q)}return out};

// How late tick data reaches this client: for each snapshot whose tick moved on, the server time it
// arrived minus the time of the first tick it is the first to report. pg_cron bunching (two ticks in
// one run), poll spacing and latency all show up here. `value` is the worst over the last `span` ms.
export function createTickLateness({span=30000,initial=400,max=2400}={}){
 const seen=[];
 return {
  observe(prevAt,at,serverNow){if(!Number.isFinite(at)||!Number.isFinite(serverNow))return;
   if(Number.isFinite(prevAt)&&(!(at>prevAt)||at-prevAt>2*TICK_MS+1))return;// no new tick, or an idle gap (not lateness)
   const first=Number.isFinite(prevAt)?prevAt+TICK_MS:at,l=Math.max(0,Math.min(max,serverNow-first));seen.push({t:serverNow,l});
   while(seen.length&&seen[0].t<serverNow-span)seen.shift()},
  get value(){if(!seen.length)return initial;let m=0;for(const s of seen)m=Math.max(m,s.l);return m},
  get samples(){return seen.length}};
}
export const realmLateness=createTickLateness();

// The tile steps a walker took between two tick positions: tileSteps (the route's own shape, diagonal
// first). When the ticks between them held more steps than that (it went round a wall corner), the
// way round comes from the tile flags (a small BFS); without them a diagonal is split into its two
// straight steps, so each step still takes one step's time.
export function stepsBetween(from,to,expected=0,flagsAt=null){
 const legs=tileSteps(from,to,8);if(!(expected>legs.length)||expected>legs.length+4)return legs;
 const fi=Math.round(from.x/TILE),fj=Math.round(from.z/TILE),ti=Math.round(to.x/TILE),tj=Math.round(to.z/TILE);
 if(Math.abs(from.x-fi*TILE)>.02||Math.abs(from.z-fj*TILE)>.02||Math.abs(to.x-ti*TILE)>.02||Math.abs(to.z-tj*TILE)>.02)return legs;
 if(typeof flagsAt==='function'){const r=bfsRoute({start:[fi,fj],goal:[ti,tj],radius:Math.max(2,Math.min(8,expected+1)),alt:0,flagsAt});
  if(r.reached&&r.path.length>legs.length&&r.path.length<=expected){const out=r.path.map(([x,z])=>({x,z}));out[out.length-1]={x:to.x,z:to.z};return out}}
 const out=legs.slice();for(let k=out.length-1;k>=0&&out.length<expected;k--){const a=k?out[k-1]:from,b=out[k];if(Math.abs(b.x-a.x)>.01&&Math.abs(b.z-a.z)>.01)out.splice(k,0,{x:b.x,z:a.z})}
 return out;
}

// Remote players and NPCs (tile walkers seen from outside). Each server tick position becomes tile
// steps scheduled at their tick time (a step into a tile ends at the tick that reports it; a
// runner's 2 or a rider's 3 tiles split that tick evenly, diagonal first: tileSteps), played back a
// fixed delay later: BUFFER_MS (one tick: a step that ends at a tick must start a tick earlier)
// plus how late tick data is reaching this client (createTickLateness: poll spacing, latency and
// pg_cron's two-tick runs) plus JITTER_MS, so bunched or late snapshots are already here when their
// step starts. The delay is fixed for a whole walk (set when it starts from rest). The walker then
// moves at exactly its pace, one step after another. Data later than that holds the walker on its
// tile (it never runs to catch up); further than SNAP_TILES behind it is placed (sample().snapped,
// no stride that frame); more tiles than two ticks can cover is a teleport (placed at once). A tile
// step round a wall corner is resolved with `flagsAt` (stepsBetween).
// push(pose,now,at,serverNow): pose {x,z,yaw,stepTiles?,run?}, `at` its tick time (server ms).
// sample(now) returns {x,z,yaw,moving,run,speed,snapped}; one object is reused.
export function createTilePlayback({buffer=BUFFER_MS,margin=JITTER_MS,maxDelay=3000,lateness=realmLateness,snapTiles=SNAP_TILES,flagsAt=null}={}){
 const queue=[],out={x:0,z:0,yaw:0,moving:false,run:false,speed:0,snapped:false};
 let ready=false,moved=false,heading=0,stand=0,steps=1,lastAt=NaN,lastNow=null,snapNext=false,delay=buffer,inStep=false,lastServerDue=-Infinity,from={x:0,z:0};
 const tail=()=>queue.at(-1)||out;
 return {get backlog(){return queue.length},get delay(){return delay},
  push(pose,now=performance.now(),at=NaN,serverNow){if(!pose||!Number.isFinite(pose.x)||!Number.isFinite(pose.z))return;
   if(!Number.isFinite(serverNow))serverNow=globalThis.eldervaleServerTime?.()??Date.now();if(!Number.isFinite(at))at=serverNow;
   if(pose.stepTiles>0)steps=pose.stepTiles;else if(pose.run===true)steps=2;
   if(Number.isFinite(pose.yaw))stand=pose.yaw;
   if(!ready){ready=true;out.x=pose.x;out.z=pose.z;out.yaw=heading=stand;lastAt=at;from={x:pose.x,z:pose.z};return}
   if(Number.isFinite(lastAt)&&at<lastAt)return;// an older snapshot
   if(Number.isFinite(lastAt)&&at>lastAt)lateness?.observe(lastAt,at,serverNow);
   const prevAt=lastAt,walked=moved;lastAt=at;
   const last=tail(),d=Math.hypot(pose.x-last.x,pose.z-last.z);if(d<1e-6){if(at>prevAt)moved=false;return}// same tile: only the facing (an NPC turning to talk)
   moved=true;
   // More tiles than two ticks can cover (a catch-up run reports two at once) is a teleport.
   if(stepLen(last.x,last.z,pose.x,pose.z)>2*Math.max(1,steps)+1.01){queue.length=0;inStep=false;out.x=pose.x;out.z=pose.z;out.yaw=heading=stand;snapNext=true;lastServerDue=at;return}
   // A walk starting from rest takes the delay it keeps: the buffer plus the current lateness.
   if(!queue.length&&!inStep)delay=Math.min(maxDelay,buffer+margin+(lateness?lateness.value:0));
   const stepMs=TICK_MS/Math.max(1,steps),offset=now-serverNow,legs=stepsBetween(last,pose,walked&&Number.isFinite(prevAt)?Math.round((at-prevAt)/stepMs):0,flagsAt);let prev=last;
   // Each step takes its length at the walker's pace (an off-centre first step 1.2 steps, say).
   // A walk under way stepped on from its last tick (a route that ends inside a two-tick report ended
   // early in it); a walk from rest is anchored at the tick that reports it.
   const ahead=walked&&Number.isFinite(prevAt);
   legs.forEach((p,k)=>{const dur=stepMs*Math.max(.05,stepLen(prev.x,prev.z,p.x,p.z)),due=Math.max(ahead?prevAt+(k+1)*stepMs:at-(legs.length-1-k)*stepMs,lastServerDue+dur);lastServerDue=due;
    prev=p;queue.push({x:p.x,z:p.z,due:due+offset+delay,dur})})},
  sample(now=performance.now()){if(!ready)return null;const dtMs=lastNow===null?0:Math.max(0,Math.min(1500,now-lastNow));lastNow=now;
   out.snapped=snapNext;snapNext=false;
   // Far behind the schedule (a stalled tab, a long freeze): placed on the tile it should be on.
   let late=0;for(const q of queue)if(q.due<=now)late++;else break;
   if(late>snapTiles){const q=queue[late-1];out.x=q.x;out.z=q.z;queue.splice(0,late);inStep=false;out.snapped=true}
   let budget=dtMs,ground=0;
   while(budget>1e-9&&queue.length){const q=queue[0];
    if(!inStep){const start=q.due-q.dur;if(start>now)break;// not due yet: hold on this tile
     budget=Math.min(budget,now-start);inStep=true;from={x:out.x,z:out.z}}
    const dx=q.x-out.x,dz=q.z-out.z,left=stepLen(out.x,out.z,q.x,q.z),full=Math.max(1e-9,stepLen(from.x,from.z,q.x,q.z));
    if(left>1e-9)heading=Math.atan2(dx,dz);
    const can=budget/q.dur*full;// tile steps this frame at this step's pace
    if(can>=left-1e-12){ground+=Math.hypot(dx,dz);out.x=q.x;out.z=q.z;budget-=left/full*q.dur;queue.shift();inStep=false}
    else{const f=can/left;ground+=Math.hypot(dx,dz)*f;out.x+=dx*f;out.z+=dz*f;budget=0}
   }
   out.moving=inStep||queue.length>0&&queue[0].due-queue[0].dur<=now;out.run=steps>1;out.speed=dtMs>0?ground/(dtMs/1000):0;
   if(!queue.length&&!inStep)heading=stand;
   out.yaw=dtMs>0&&!out.snapped?turnToward(out.yaw,heading,dtMs/1000):heading;
   return out},
  clear(){queue.length=0;ready=false;inStep=false;lastNow=null;lastAt=NaN;lastServerDue=-Infinity}};
}

// The local tile walker (game.js), OSRS-style. A click is planned here at once with the server's own
// BFS (tile-grid.js planTileMove / bfsRoute) from the tile the player is visibly on, and walked at
// exactly the walk/run/ride pace: one tile step per 600 ms / steps, straight between tile centres,
// diagonals one step like straight tiles, facing the step (turnToward, ~70 ms). An off-centre player
// walks straight to the first route tile. Server snapshots only verify (verify()):
//  - while the server's tile is within VERIFY_TILES of where this walk says it should be at that
//    server tick, and the server's route ends on a tile of this walk, nothing changes (latency and
//    tick timing never touch the pace);
//  - otherwise (blocked, a door, a different route, a stop, combat, a teleport) the walker re-routes:
//    it takes the server's route, walks straight onto it at the same pace, or is placed on it when
//    more than SNAP_TILES off.
// update(position,now,hold) returns {x,z,yaw,moving,speed,snapped,steps} (one object, reused), or
// null while the player steers by keys.
export function createLocalWalker({tolerance=VERIFY_TILES,snapTiles=SNAP_TILES}={}){
 const out={x:0,z:0,yaw:0,moving:false,speed:0,snapped:false,steps:1},queue=[],stats={reroutes:0,snaps:0,verified:0};
 let ready=false,heading=0,steps=1,track=null,shownX=NaN,shownZ=NaN,awaiting=false,lastNow=null,snapNext=false,standYaw=null,passed=null,startAt=null;
 // track: the walk's schedule {pts:[{x,z}],cum:[steps along],at:server ms of pts[0],steps}.
 const makeTrack=(pts,at,s)=>{const cum=[0];for(let k=1;k<pts.length;k++)cum.push(cum[k-1]+cheb(pts[k-1],pts[k]));return {pts,cum,at,steps:s}};
 const pointAt=(tr,e)=>{const {pts,cum}=tr;if(e<=0)return pts[0];for(let k=1;k<pts.length;k++)if(cum[k]>=e){const a=pts[k-1],b=pts[k],f=(e-cum[k-1])/Math.max(1e-9,cum[k]-cum[k-1]);return {x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f}}return pts.at(-1)};
 const indexAt=(tr,t)=>Math.max(0,Math.min(tr.cum.at(-1),tr.steps*(t-tr.at)/TICK_MS));
 function setQueue(pts){queue.length=0;for(const p of pts)queue.push({x:p.x,z:p.z})}
 // Take the server's route [S,...path] (stood on S at server time `at`): walk straight onto it from
 // here, or be placed on it when far off.
 function adopt(pose,serverNow){const S={x:pose.x,z:pose.z},pts=[S,...pointsOf(pose.path)];if(pose.stepTiles>0)steps=pose.stepTiles;
  track=makeTrack(pts,Number.isFinite(pose.at)?pose.at:serverNow,steps);stats.reroutes++;
  const e=pts.length>1?indexAt(track,serverNow):0,X=pointAt(track,e);
  if(cheb(out,X)>snapTiles){out.x=X.x;out.z=X.z;snapNext=true;stats.snaps++;let k=1;while(k<pts.length&&track.cum[k]<=e+1e-9)k++;setQueue(pts.slice(k));return}
  // Join at the route tile nearest to here (from a little before the server's tile now on),
  // skipping one already reached: never walk back over the route.
  const lo=Math.max(0,Math.floor(e)-snapTiles);let m=lo,best=Infinity;for(let k=lo;k<pts.length;k++){const d=cheb(out,pts[k]);if(d<best-1e-9){best=d;m=k}}
  if(best<1e-6)m++;else if(m+1<pts.length&&cheb(out,pts[m+1])<=1+1e-6)m++;
  setQueue(pts.slice(m));
 }
 function advance(d){let ground=0;while(queue.length&&d>1e-12){const q=queue[0],dx=q.x-out.x,dz=q.z-out.z,seg=stepLen(out.x,out.z,q.x,q.z);if(seg>1e-9)heading=Math.atan2(dx,dz);
   if(seg<=d){ground+=Math.hypot(dx,dz);out.x=q.x;out.z=q.z;d-=seg;passed=queue.shift()}else{const f=d/seg;ground+=Math.hypot(dx,dz)*f;out.x+=dx*f;out.z+=dz*f;d=0}}return ground}
 return {get queue(){return queue},get track(){return track},get stats(){return stats},get steps(){return steps},get awaiting(){return awaiting},get ready(){return ready},
  // The tile the player is visibly on: where a click is planned from.
  startTile(){return [Math.floor(out.x/TILE+.5),Math.floor(out.z/TILE+.5)]},
  // Where a click is planned from: the tile the player is visibly on or, mid-step, the tile just
  // left or the one being stepped onto, whichever makes the walk from here shortest (so the first
  // move never goes on along the old step, or back over it, only to turn round). planFrom([i,j])
  // returns a path [[x,z],...] of tile centres (the start excluded) or null. Returns {from,path}.
  plan(planFrom){const tiles=[this.startTile()];
   const add=p=>{if(!p)return;const t=[Math.floor(p.x/TILE+.5),Math.floor(p.z/TILE+.5)];if(Math.abs(p.x-t[0]*TILE)>.02||Math.abs(p.z-t[1]*TILE)>.02||stepLen(out.x,out.z,p.x,p.z)>1+1e-6)return;if(!tiles.some(q=>q[0]===t[0]&&q[1]===t[1]))tiles.push(t)};
   if(queue.length){add(passed);add(queue[0])}
   let best=null;for(const t of tiles){const path=planFrom(t);if(!Array.isArray(path))continue;const pts=pointsOf(path);
    const cost=pts.length?stepLen(out.x,out.z,pts[0].x,pts[0].z)+pts.length-1:stepLen(out.x,out.z,t[0]*TILE,t[1]*TILE);
    if(!best||cost<best.cost-1e-6)best={from:t,path,cost}}
   return best},
  // A click-walk planned here: path [[x,z],...] tile centres (from startTile()), walked at once.
  // A new click while walking continues the same schedule: the server is still on the old walk
  // (it gets the click a little later), so the walk so far stays the head of the track.
  walk(path,{serverNow,steps:s,now:clickAt}={}){const pts=pointsOf(path),now=Number.isFinite(serverNow)?serverNow:Date.now();if(s>0)steps=s;awaiting=true;standYaw=null;
   // From rest, the walk starts at the click (clickAt, the update() clock): the frame before it was
   // idle time, which must not be walked (a 1/3-tile surge per click at 5 fps).
   if(!queue.length&&Number.isFinite(clickAt))startAt=clickAt;
   if(track&&queue.length&&track.steps===steps&&cheb(queue.at(-1),track.pts.at(-1))<1e-6){
    let left=0,px=out.x,pz=out.z;for(const q of queue){left+=stepLen(px,pz,q.x,q.z);px=q.x;pz=q.z}
    const e=track.cum.at(-1)-left,head=[];for(let k=0;k<track.pts.length&&track.cum[k]<e-1e-6;k++)head.push(track.pts[k]);
    track=makeTrack([...head,{x:out.x,z:out.z},...pts],track.at,steps)}
   else track=makeTrack([{x:out.x,z:out.z},...pts],now,steps);
   setQueue(pts);return pts.length>0},
  // The move command was answered (or failed): snapshots verify the walk again.
  ack(){awaiting=false},
  verify(pose,serverNow,{stale=false}={}){if(!pose||!ready||awaiting||stale)return 'skip';
   const S={x:pose.x,z:pose.z},path=pointsOf(pose.path),srvMoving=path.length>0,F=path.at(-1)||S;
   standYaw=!srvMoving&&Number.isFinite(pose.yaw)?pose.yaw:null;
   if(pose.stepTiles>0&&pose.stepTiles!==steps){if(track){const e=indexAt(track,serverNow);track.steps=pose.stepTiles;track.at=serverNow-e*TICK_MS/pose.stepTiles}steps=pose.stepTiles}
   if(!track){if(!srvMoving&&cheb(out,S)<1e-3)return 'rest';adopt(pose,serverNow);return 'adopt'}
   if(!queue.length&&!srvMoving&&cheb(out,S)<1e-3){track=null;return 'rest'}
   // Where this walk says the server should be at its tick (e), against where it is. Tick timing
   // alone moves the server against e by whole ticks: it starts on the first tick after the move
   // arrives (up to a tick behind), and a catch-up run credits up to two ticks at once (up to two
   // ahead). Beyond that, `tolerance` tiles are ignored.
   const e=indexAt(track,Number.isFinite(pose.at)?pose.at:serverNow),w=track.steps,lo=e-w,hi=e+2*w;let d=Infinity;
   for(let k=0;k<track.pts.length;k++){const c=track.cum[k];if(c<lo-1e-9||c>hi+1e-9)continue;d=Math.min(d,cheb(S,track.pts[k]))}
   d=Math.min(d,cheb(S,pointAt(track,Math.max(0,lo))),cheb(S,pointAt(track,e)),cheb(S,pointAt(track,hi)));
   // The server's route must end on this walk (the same goal, or one of its leg ends), at or after its tile.
   let endOk=false;for(let k=0;k<track.pts.length&&!endOk;k++)if(track.cum[k]>=lo-1-1e-9&&cheb(F,track.pts[k])<1e-3)endOk=true;
   // A server that has stopped short of this walk's end has stopped for good (blocked, stop, combat).
   if(!srvMoving&&cheb(S,track.pts.at(-1))>1e-3)endOk=false;
   if(d<=tolerance+1e-6&&endOk){stats.verified++;return 'ok'}
   adopt(pose,serverNow);return 'adopt'},
  update(position,now,{active=false,pending=false}={}){
   if(active||pending){ready=false;queue.length=0;track=null;lastNow=null;return null}
   if(!ready||!(Math.hypot(position.x-shownX,position.z-shownZ)<=.3)){ready=true;out.x=position.x;out.z=position.z;queue.length=0;track=null;lastNow=null}
   // Real elapsed time (a long frame on a slow GPU still moves the walker its true distance).
   if(startAt!==null){if(lastNow!==null&&startAt>lastNow&&startAt<=now)lastNow=startAt;startAt=null}
   const dt=lastNow===null?0:Math.max(0,Math.min(5000,now-lastNow))/1000;lastNow=now;
   out.snapped=snapNext;snapNext=false;
   out.speed=queue.length&&dt>0?advance(steps*dt/GAME_TICK)/dt:0;out.moving=queue.length>0||out.speed>0;out.steps=steps;
   if(!queue.length&&standYaw!==null)heading=standYaw;
   out.yaw=dt>0&&!out.snapped?turnToward(out.yaw,heading,dt):heading;
   position.x=shownX=out.x;position.z=shownZ=out.z;return out},
  // The body's current facing (game.js), so a walk turns from where the player looks.
  face(yaw){if(Number.isFinite(yaw)){out.yaw=yaw;if(!queue.length)heading=yaw}}};
}

// OSRS facing: a walker faces its tile step and turns essentially at once, with a short visual
// slerp: an ease-out (time constant TURN_TAU) that finishes at no less than TURN_MIN_RATE, the short
// way round (never across ±π the long way). A 45° bend takes ~65 ms, 90° ~85 ms, 180° ~100 ms;
// never a lazy drift. The result stays in -π..π.
export const TURN_TAU=.025,TURN_MIN_RATE=6;
export function turnToward(yaw,target,dt,tau=TURN_TAU){
 if(!Number.isFinite(yaw))return target;
 const turn=Math.atan2(Math.sin(target-yaw),Math.cos(target-yaw)),t=Math.max(0,dt),a=Math.abs(turn);
 const step=Math.min(a,Math.max(a*(1-Math.exp(-t/tau)),TURN_MIN_RATE*t)),next=yaw+Math.sign(turn)*step;
 return Math.atan2(Math.sin(next),Math.cos(next));
}

// The owning client predicts input immediately. Only reconcile the latest final
// acknowledgement after its input queue drains; remote interpolation is delayed.
export function reconcileLocalPose(position,target,dt,{active=false,pending=false,teleport=false}={}){
 if(active||pending||!target)return false;
 if(teleport){position.x=target.x;position.z=target.z;return true;}
 // Smoothing uses the frame time capped at 1 s: a slow or briefly stalled
 // renderer (a few frames per second) still keeps pace with the server walker
 // instead of trailing further behind every frame.
 const elapsed=Math.max(0,Math.min(1,dt)),error=Math.hypot(position.x-target.x,position.z-target.z),speed=target.speed||6.4;
 // Catch up at most 15% faster than the walker's real pace. The first server
 // snapshot of a new walk is already some latency ahead of the click; chasing
 // it at double speed made every click start with a one-second surge. Only a
 // gross error (over ~1.5 s of travel behind) may close at double speed.
 const rate=error>speed*1.5+1.5?speed*2:speed*1.15,weight=Math.min(1-Math.exp(-18*elapsed),rate*elapsed/Math.max(error,.000001));
 position.x+=(target.x-position.x)*weight;position.z+=(target.z-position.z)*weight;return true;
}

// A large render error can result from latency. Only a discontinuity between
// confirmed server samples is evidence of an actual teleport/respawn.
export function serverMotionJump(previous,next){
 if(!previous)return true;
 const seconds=Math.max(0,(next.at-previous.at)/1000),speed=Math.max(previous.speed||19.2,next.speed||19.2);
 return Math.hypot(next.x-previous.x,next.z-previous.z)>Math.max(8,speed*seconds+3);
}

// Compare prediction with a server pose advanced to presentation time, rather
// than pulling a moving player back to a position from an older packet.
export function projectMovement(target,now,{canStep}={}){
 const p={...target},seconds=Math.max(0,Math.min(1.5,(Math.min(now,target.until)-target.at)/1000));
 if(!Number.isFinite(seconds)||!Number.isFinite(target.speed)||!seconds)return p;
 const dx=(target.inputX||0)*target.speed*seconds,dz=(target.inputZ||0)*target.speed*seconds,n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));
 if(!canStep){p.x+=dx;p.z+=dz;return p;}
 for(let i=0;i<n;i++){const q=slideStep(p,{...p,x:p.x+dx/n,z:p.z+dz/n},canStep);p.x=q.x;p.z=q.z;}
 return p;
}
export function reconcileActivePose(position,target,input,dt,now,options){
 if(!target||!input?.moving||Math.hypot(input.x-(target.inputX||0),input.z-(target.inputZ||0))>.15||!(target.until>target.at))return false;
 // Sweep the small correction, rather than replaying the whole acknowledged
 // path through collision tests every render frame.
 const p=projectMovement(target,now),dx=p.x-position.x,dz=p.z-position.z,error=Math.hypot(dx,dz);
 if(error<.2)return false;
 const weight=Math.min(1-Math.exp(-4*dt),target.speed*Math.max(0,dt)*.25/error);
 const next={...position,x:position.x+dx*weight,z:position.z+dz*weight};
 if(options?.canStep&&!options.canStep(position,next))return false;
 position.x=next.x;position.z=next.z;return true;
}

// Click-to-walk: the server reports where the walker stood at `at` and the
// waypoints still ahead. Snapshots arrive every ~250 ms, so chasing the raw
// pose makes the avatar surge and stall (and the gait flicker between walk and
// idle). Advance the pose along its remaining path to the presentation time so
// the local walker glides at the real ground speed and stops where the server
// stops. Returns {x,z,yaw,moving}.
// The local walker's presented pose: tile walkers glide tick by tick, free walkers at their speed.
export function presentPose(pose,now){return pose?.tile?projectTilePose(pose,now):projectPathPose(pose,now)}
export function projectPathPose(pose,now,{maxSeconds=1.5}={}){
 if(!pose)return null;
 const path=Array.isArray(pose.path)?pose.path:[];
 const out={x:pose.x,z:pose.z,yaw:pose.yaw,moving:false};
 if(!path.length||!(pose.speed>0)||!Number.isFinite(pose.at)||!Number.isFinite(now))return out;
 let budget=pose.speed*Math.max(0,Math.min(maxSeconds,(now-pose.at)/1000));
 for(const point of path){
  const gx=Number(point?.[0]??point?.x),gz=Number(point?.[1]??point?.z);if(!Number.isFinite(gx)||!Number.isFinite(gz))break;
  const dx=gx-out.x,dz=gz-out.z,d=Math.hypot(dx,dz);if(d<1e-6)continue;
  out.yaw=Math.atan2(dx,dz);out.moving=true;
  if(budget<d){out.x+=dx/d*budget;out.z+=dz/d*budget;return out}
  out.x=gx;out.z=gz;budget-=d;
 }
 out.moving=false;return out;
}
