import {mapDestination} from './minimap.js?v=release-20261105-houses65';
// RuneScape-style point-and-click travel: travel pace, tap-versus-drag on the
// world canvas, minimap clicks back to world points, ground ripples and the
// red destination flag on the minimap.

// Pace. A RuneScape tile is about one character-width (~1 m); players walk one
// tile per 0.6 s game tick and run two. Eldervale characters are Quaternius
// metres × 1.58 (CHARACTER_SCALE), so one tile is 1.58 world units.
export const TILE=1.58,GAME_TICK=.6;
export const WALK_SPEED=2.6;   // 1.65 tiles/s ≈ RuneScape walk (1.67)
export const RUN_SPEED=5.2;    // 3.3 tiles/s ≈ RuneScape run (3.33)
export const MOUNT_SPEED=9.6;  // a modest gallop: 1.85× running
export function travelSpeed(mounted,running){return mounted?MOUNT_SPEED:running?RUN_SPEED:WALK_SPEED}

// A press is a tap (walk/interact) unless the pointer travelled far enough to
// be a camera drag. Fingers wobble more than mice, so touch gets more slack.
export const TAP_SLOP={mouse:5,pen:8,touch:10};
export function dragThreshold(pointerType){return TAP_SLOP[pointerType]??TAP_SLOP.mouse}
export function isTap(travelled,pointerType){return Number.isFinite(travelled)&&travelled<=dragThreshold(pointerType)}

// Client point on a map canvas → world point. The minimap is north-up and
// centred on the player; the world map is north-up and centred on the origin.
export function mapClickToWorld(clientX,clientY,rect,{player,extent,width,height,world=false}){
 if(!rect||!(rect.width>0)||!(rect.height>0))return null;
 const u=(clientX-rect.left)/rect.width,v=(clientY-rect.top)/rect.height;
 if(!(u>=0&&u<=1&&v>=0&&v<=1))return null;
 return mapDestination(u,v,world?{x:0,z:0}:player,Math.PI,extent,width||rect.width,height||rect.height);
}

// The flag stays until the walker arrives, a new destination replaces it, or
// the server reports the walk ended (after a grace period that covers route
// search and the first server reply).
export const FLAG_ARRIVAL=.9,FLAG_GRACE=1600;
export function flagExpired(flag,position,{moving=false,pending=false,now=0}={}){
 if(!flag)return true;
 if(Math.hypot(position.x-flag.x,position.z-flag.z)<=FLAG_ARRIVAL)return true;
 if(moving||pending)return false;
 return now-flag.at>FLAG_GRACE;
}

// RuneScape-style click feedback on the ground: a ring that grows and fades
// (yellow for a walk, red for an interaction). The destination flag is drawn
// on the minimap only.
export const RIPPLE_TIME=.55,RIPPLE_COLORS={walk:0xffd83a,interact:0xe0261d};
export function rippleFrame(age,duration=RIPPLE_TIME){
 const t=Math.max(0,age)/duration;if(!(t<1))return {scale:1.6,opacity:0,inner:0,done:true};
 const ease=1-(1-t)**2;return {scale:.35+1.25*ease,opacity:.95*(1-t)**1.2,inner:Math.max(0,.9*(1-t*1.8)),done:false};
}
export function createClickRipple(T,kind='walk'){
 const color=RIPPLE_COLORS[kind]??RIPPLE_COLORS.walk,group=new T.Group();group.name='click-ripple';
 const ringMaterial=new T.MeshBasicMaterial({color,transparent:true,opacity:.95,side:T.DoubleSide,depthWrite:false}),dotMaterial=ringMaterial.clone();
 const ring=new T.Mesh(new T.RingGeometry(.42,.52,40),ringMaterial),dot=new T.Mesh(new T.CircleGeometry(.12,20),dotMaterial);
 for(const m of [ring,dot]){m.rotation.x=-Math.PI/2;m.renderOrder=3;group.add(m)}
 let age=0;
 return {group,kind,
  update(dt){age+=dt;const f=rippleFrame(age);ring.scale.setScalar(f.scale);ringMaterial.opacity=f.opacity;dotMaterial.opacity=f.inner;return !f.done},
  dispose(){group.removeFromParent();for(const m of [ring,dot]){m.geometry.dispose();m.material.dispose()}}};
}
// Draws the same red flag on a 2D map canvas at (x, y).
export function drawMapFlag(ctx,x,y){
 ctx.save();ctx.strokeStyle='#2b1a0e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y+2);ctx.lineTo(x,y-12);ctx.stroke();
 ctx.fillStyle='#e0261d';ctx.strokeStyle='#4a0d09';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-12);ctx.lineTo(x+10,y-8.5);ctx.lineTo(x,y-5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}

// Click-to-interact: walk into reach of a target, then act on arrival.
// A spot short of the target on the walker's side, so the route ends beside a
// tree, rock or stand instead of trying to enter its collision.
export function approachPoint(from,target,reach){
 const dx=from.x-target.x,dz=from.z-target.z,d=Math.hypot(dx,dz),stand=Math.max(.8,Math.min(reach*.6,reach-.5));
 if(d<=stand||d<1e-6)return {x:from.x,z:from.z};
 return {x:target.x+dx/d*stand,z:target.z+dz/d*stand};
}
export function withinReach(position,target,reach){return !!position&&Math.hypot(position.x-target.x,position.z-target.z)<=reach}
// 'arrived' (act now), 'walking', 'waiting' (stopped, waiting for the server to
// settle), 'failed' (stopped out of reach) or 'cancelled' (a newer click).
export const ARRIVAL_SETTLE=1200;
export function arrivalStatus(pending,position,{moving=false,routing=false,generation,now=0,settle=ARRIVAL_SETTLE}={}){
 if(!pending)return 'none';
 if(generation!==undefined&&generation!==pending.generation)return 'cancelled';
 if(routing||moving){pending.activeAt=now;return 'walking'}
 if(withinReach(position,pending,pending.reach))return 'arrived';
 return now-(pending.activeAt??pending.startedAt??now)>settle?'failed':'waiting';
}
