import {mapDestination} from './minimap.js?v=release-20261105-houses65';
// RuneScape-style point-and-click travel: travel pace, tap-versus-drag on the
// world canvas, minimap clicks back to world points, and the red destination flag.

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

// A small red pennant on a pole, planted at the destination.
export function createWalkFlag(T){
 const group=new T.Group(),red=new T.MeshBasicMaterial({color:0xd8261e,side:T.DoubleSide}),pole=new T.MeshBasicMaterial({color:0x3b2a1a});
 const stick=new T.Mesh(new T.CylinderGeometry(.035,.035,1.1,6),pole);stick.position.y=.55;group.add(stick);
 const shape=new T.BufferGeometry();shape.setAttribute('position',new T.Float32BufferAttribute([0,1.08,0,0,.72,0,.55,.9,0],3));shape.computeVertexNormals();
 const cloth=new T.Mesh(shape,red);group.add(cloth);
 const base=new T.Mesh(new T.RingGeometry(.16,.26,20),new T.MeshBasicMaterial({color:0xd8261e,transparent:true,opacity:.8,side:T.DoubleSide,depthWrite:false}));base.rotation.x=-Math.PI/2;base.position.y=.02;group.add(base);
 group.visible=false;group.name='walk-flag';
 let time=0;
 return {group,cloth,
  place(x,y,z){group.position.set(x,y,z);group.visible=true;time=0},
  hide(){group.visible=false},
  get visible(){return group.visible},
  update(dt){if(!group.visible)return;time+=dt;cloth.rotation.y=Math.sin(time*3)*.25},
  dispose(){group.removeFromParent();for(const o of [stick,cloth,base]){o.geometry.dispose();o.material.dispose()}}};
}
// Draws the same red flag on a 2D map canvas at (x, y).
export function drawMapFlag(ctx,x,y){
 ctx.save();ctx.strokeStyle='#2b1a0e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(x,y+2);ctx.lineTo(x,y-12);ctx.stroke();
 ctx.fillStyle='#e0261d';ctx.strokeStyle='#4a0d09';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,y-12);ctx.lineTo(x+10,y-8.5);ctx.lineTo(x,y-5);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
}
