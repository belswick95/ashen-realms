// The player faces +Z at heading zero; heading-up maps put that direction at the top.
// World axes on every map: +X is east (right on a north-up map), −Z is north (up).
export function mapPoint(x,z,player,heading,extent,w,h){return mapPointInto({x:0,y:0},x,z,player,heading,extent,w,h)}
// Allocation-free form of mapPoint for per-frame drawing.
export function mapPointInto(out,x,z,player,heading,extent,w,h){const a=heading-Math.PI,c=Math.cos(a),s=Math.sin(a),dx=(x-player.x)*w/extent,dz=(z-player.z)*w/extent;out.x=w/2+c*dx-s*dz;out.y=h/2+s*dx+c*dz;return out}
export function mapDestination(u,v,player,heading,extent,w,h){const a=heading-Math.PI,c=Math.cos(a),s=Math.sin(a),dx=(u-.5)*extent,dz=(v-.5)*extent*h/w;return {x:player.x+c*dx+s*dz,z:player.z-s*dx+c*dz}}

// Old School RuneScape minimap: "up" is wherever the camera looks.
// The game camera orbits at focus + (sin yaw, cos yaw)·distance, so it looks
// along (−sin yaw, −cos yaw): yaw 0 faces north, −π/2 east, π south, π/2 west.
// That view direction is the heading the minimap puts at the top.
export const LOOK_YAW={north:0,east:-Math.PI/2,south:Math.PI,west:Math.PI/2};
export function cameraHeading(yaw){return yaw+Math.PI}
// Canvas rotation (ctx.rotate, clockwise on screen) that turns a north-up
// drawing centred on the player into the camera-up minimap.
export function minimapRotation(yaw){return wrapAngle(yaw)}
// World point → camera-up minimap pixel, and minimap pixel → world point.
export function worldToMinimap(x,z,player,yaw,extent,w,h,out={x:0,y:0}){return mapPointInto(out,x,z,player,cameraHeading(yaw),extent,w,h)}
export function minimapToWorld(px,py,player,yaw,extent,w,h){return mapDestination(px/w,py/h,player,cameraHeading(yaw),extent,w,h)}
// The compass needle (CSS rotate, clockwise) that points at true north.
export function compassRotation(yaw){return wrapAngle(yaw)}
export function wrapAngle(a){a=(a+Math.PI)%(Math.PI*2);if(a<0)a+=Math.PI*2;return a-Math.PI}
// The yaw equivalent to `target` that is closest to `current` (turn the short way).
export function nearestYaw(current,target){return current+wrapAngle(target-current)}
// One frame of a smooth camera turn toward `target` (eased, with a minimum speed).
export function stepYaw(current,target,dt,{ease=9,min=1.2}={}){const d=target-current,step=Math.max(Math.abs(d)*Math.min(1,dt*ease),min*dt);return Math.abs(d)<=step?target:current+Math.sign(d)*step}
