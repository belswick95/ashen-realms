import {turnToward} from './motion-track.js?v=release-20261107-quests162';
// Mounted heading (OSRS rules, as on foot): the horse faces the tile step it is on and turns fast
// at the route's one bend (turnToward, ~70 ms). heading144 low-passed the horse's velocity (~80 ms)
// instead; on its line-hugging routes (E, NE, E, E, NE ...) the velocity swung at every diagonal
// tile, so the horse swung side to side. Diagonal-first routes and tile-by-tile playback (local
// projectTilePose, remote createTilePlayback) already give the step direction as the walker's yaw,
// so this only follows it: no velocity filter, no lag behind an already-turning yaw (the rate is the
// same), and a snap on the first frame or a teleport. The horse model adds no yaw of its own (its
// gallop moves the saddle up/down and fore/aft only: horse-mount.js seatRider).
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function createTravelHeading({teleport=6}={}){
 let yaw=null,lastX=null,lastZ=null;
 return {
  get yaw(){return yaw},
  reset(){yaw=null;lastX=lastZ=null},
  // x,z: this frame's position; dt: seconds; stepYaw: the walker's facing (its tile step's direction).
  update(x,z,dt,stepYaw=0){
   const jump=lastX===null||Math.hypot(x-lastX,z-lastZ)>teleport;lastX=x;lastZ=z;
   if(yaw===null||jump)return yaw=wrap(stepYaw);
   if(!(dt>0))return yaw;
   return yaw=turnToward(yaw,stepYaw,dt);
  }
 };
}
