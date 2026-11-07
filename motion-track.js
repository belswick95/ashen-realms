import {slideStep} from './movement-collision.js?v=release-20261107-horse126';
import {projectTilePose,TILE,GAME_TICK} from './tile-grid.js?v=release-20261107-horse126';
// Timestamped presentation buffer: no position authority or damage is decided here.
// When snapshots arrive later than `delay` (a slow reply on a phone or tablet
// connection) the buffer runs dry and the actor would freeze, then jump. The
// delay then grows by itself (presentation slows to half speed rather than
// stopping) up to `maxExtra` ms, and shrinks back slowly once replies keep up.
export function createMotionTrack({delay=350,maxExtra=600}={}){let tile=false,playback=null,frames=[],epoch=null,lastTime=-Infinity,extra=0,lastNow=null;return {get extraDelay(){return extra},push(time,pose,now=performance.now()){if(!Number.isFinite(time))return;if(epoch===null)epoch={server:time,local:now};const prev=frames.at(-1);if(prev&&Math.hypot(pose.x-prev.x,pose.z-prev.z)>12){frames=[];epoch={server:time,local:now};lastTime=-Infinity}if(prev&&time<=prev.time)return;frames.push({...pose,time});if(frames.length>32)frames.shift()},sample(now=performance.now()){if(tile)return playback.sample(now);if(!frames.length)return null;const step=lastNow===null?0:Math.max(0,Math.min(250,now-lastNow));lastNow=now;const newest=frames.at(-1).time,raw=epoch.server+now-epoch.local-delay-extra;if(frames.length>1||raw>newest){if(raw>newest)extra=Math.min(maxExtra,extra+step*.5);else if(raw<newest-delay*.5)extra=Math.max(0,extra-step*.02)}const t=Math.max(lastTime,epoch.server+now-epoch.local-delay-extra);lastTime=t;while(frames.length>2&&frames[1].time<t)frames.shift();const a=frames[0],b=frames[1];if(!b||t<=a.time)return {...a};const f=Math.max(0,Math.min(1,(t-a.time)/(b.time-a.time)));const yaw=a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*f;return {...b,x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,yaw}},clear(){playback?.clear();frames=[];epoch=null;lastTime=-Infinity;extra=0;lastNow=null},
 // Tile walkers (tick & tile engine) are played back along their tiles by createTilePlayback,
 // not by the server tick stamps (`time`, `serverNow` and `tick` are kept for callers).
 get tile(){return tile},
 pushTile(time,pose,now=performance.now()){if(!pose)return;if(!tile){tile=true;playback=createTilePlayback()}playback.push(pose,now)}}}

// Tile-walker playback. The world tick moves a walker one tile per 600 ms tick (runners two), but the
// tiles do not reach the client evenly: the cron tick runs about once a second and catches up two
// ticks at once, polls add up to a tick, and a stalled tick delivers several tiles in one burst.
// Playing the tick stamps back as they came made walkers dash two tiles in one tick, stand for a
// tick, dash again (and run a jog cycle at the doubled speed), or freeze and then race to catch up.
// Instead the tiles received are queued as a path and walked at the walker's true pace:
//  - a buffer of about two tiles (just over a tick at the cron cadence) is kept behind the newest tile while more are due, so a late tile
//    slows the walker a little (never below SLOW x pace) instead of stopping it;
//  - a backlog is caught up at no more than CATCH_UP x pace;
//  - lag is counted in tile steps (a diagonal step is one tick, as on the server, so diagonals play at
//    their true 1.41x ground speed instead of falling behind);
//  - further behind than SNAP_TILES the walker is placed quietly at the buffer distance (sample().snapped,
//    so the caller animates no stride for that frame); a jump over 12 units is a teleport.
// sample(now) returns {x,z,yaw,moving,run,speed,snapped}; one object is reused (no allocation).
export const TILE_WALK_SPEED=TILE/GAME_TICK,CATCH_UP=1.3,SLOW=.6,SNAP_TILES=4,BUFFER_TILES=2,DUE_MS=1800,START_WAIT_MS=900,TELEPORT=12;
export function createTilePlayback({buffer=BUFFER_TILES,slow=SLOW,gain=.2,ease=.4}={}){
 const path=[],out={x:0,z:0,yaw:0,moving:false,run:false,speed:0,snapped:false};let ready=false,walking=false,startAt=0,stand=0,heading=0,steps=1,rate=1,lastNow=null,lastTile=-Infinity,snapNext=false;
 // Distances are in tile steps (a diagonal step is one step, as on the server: one tick), not units.
 const stepsOf=(dx,dz)=>Math.max(Math.abs(dx),Math.abs(dz))/TILE;
 const len=()=>{let d=0,px=out.x,pz=out.z;for(const p of path){d+=stepsOf(p.x-px,p.z-pz);px=p.x;pz=p.z}return d};
 // Walk `d` tile steps along the queued path from the presented point; returns the ground covered.
 function advance(d){let ground=0;while(path.length&&d>0){const p=path[0],dx=p.x-out.x,dz=p.z-out.z,seg=stepsOf(dx,dz);if(seg>1e-9)heading=Math.atan2(dx,dz);if(seg<=d){ground+=Math.hypot(dx,dz);out.x=p.x;out.z=p.z;d-=seg;path.shift()}else{const f=d/seg;ground+=Math.hypot(dx,dz)*f;out.x+=dx*f;out.z+=dz*f;d=0}}return ground}
 return {get backlog(){return len()},
  push(pose,now=performance.now()){if(!Number.isFinite(pose.x)||!Number.isFinite(pose.z))return;
   if(!ready){ready=true;out.x=pose.x;out.z=pose.z;out.yaw=heading=stand=Number.isFinite(pose.yaw)?pose.yaw:0;return}
   const last=path.at(-1)||out,d=Math.hypot(pose.x-last.x,pose.z-last.z);if(Number.isFinite(pose.yaw))stand=pose.yaw;
   if(d<1e-6)return;// same tile: only the facing (an NPC turning to talk)
   if(d>TELEPORT){path.length=0;out.x=pose.x;out.z=pose.z;out.yaw=heading=stand;snapNext=true;return}
   steps=pose.stepTiles>0?pose.stepTiles:pose.run?2:1;if(!path.length&&!walking)startAt=now;path.push({x:pose.x,z:pose.z});lastTile=now},
  sample(now=performance.now()){if(!ready)return null;const dt=lastNow===null?0:Math.max(0,Math.min(250,now-lastNow))/1000;lastNow=now;
   out.snapped=snapNext;snapNext=false;let lag=len();
   if(lag>SNAP_TILES){advance(lag-buffer);out.snapped=true;lag=len()}
   const due=now-lastTile<DUE_MS,over=lag-buffer;
   const want=due?Math.max(slow,Math.min(CATCH_UP,1+gain*over)):Math.max(1,Math.min(CATCH_UP,1+.15*over));
   rate+=(want-rate)*(1-Math.exp(-dt/ease));
   // A walk starts once the buffer has filled (or a short wait has passed: a single step aside).
   if(!walking&&path.length&&(lag>=buffer*.99||now-startAt>=START_WAIT_MS||!due))walking=true;
   out.moving=walking&&path.length>0;out.run=steps>1;
   out.speed=out.moving&&dt>0?advance(steps*rate*dt/GAME_TICK)/dt:0;if(!path.length){out.moving=false;walking=false;heading=stand}
   // Turn toward the heading (a corner, a diagonal tile step, the facing at rest) over ~0.1 s, not in one frame.
   const turn=Math.atan2(Math.sin(heading-out.yaw),Math.cos(heading-out.yaw));out.yaw=dt>0&&!out.snapped?out.yaw+turn*Math.min(1,1-Math.exp(-dt/.1)):heading;
   return out},
  clear(){path.length=0;ready=false;walking=false;lastNow=null;lastTile=-Infinity;rate=1}};
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
