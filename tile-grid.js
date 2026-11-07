// Tick & tile engine, client half (mirrors db/tick-tile-engine-*.sql; the server is authoritative).
// Tiles are 1.58 world units (one character-width, click-walk.js TILE); tile (i,j) is centred on
// (i*TILE, j*TILE). One game tick is 600 ms: walkers step 1 tile per tick, runners 2.
import {TILE,GAME_TICK} from './click-walk.js?v=release-20261107-ground158';
export {TILE,GAME_TICK};
export const FLAG={BLOCK:1,E:2,N:4,NE:8,NW:16,WATER:32,OBJECT:64};
export const tileOf=v=>Math.floor(v/TILE+.5);
export const tileCenter=t=>Math.round(t*TILE*1000)/1000;
export const tileKey=(i,j)=>i+','+j;
// Facing toward a point (realm yaw convention: atan2(dx,dz)); keeps `fallback` when on top of it.
export function faceYaw(from,to,fallback=0){const dx=to.x-from.x,dz=to.z-from.z;return Math.abs(dx)+Math.abs(dz)<1e-4?fallback:Math.atan2(dx,dz)}
// Whole ticks for a duration in seconds (timers fire on tick boundaries; at least one tick).
export const ticksFor=seconds=>Math.max(1,Math.floor(seconds/GAME_TICK+.5));

// Can a walker on (i,j) step to (i+di,j+dj)? `flagsAt(i,j)` returns a tile's effective flags.
// No corner cutting: a diagonal needs both orthogonal neighbours and the edges to them free.
export function canMove(flagsAt,i,j,di,dj){
 if(!di&&!dj)return true;
 if(Math.abs(di)>1||Math.abs(dj)>1)return false;
 if(flagsAt(i+di,j+dj)&FLAG.BLOCK)return false;
 if(!dj)return !(flagsAt(Math.min(i,i+di),j)&FLAG.E);
 if(!di)return !(flagsAt(i,Math.min(j,j+dj))&FLAG.N);
 if(!canMove(flagsAt,i,j,di,0)||!canMove(flagsAt,i,j,0,dj))return false;
 if(di===dj)return !(flagsAt(Math.min(i,i+di),Math.min(j,j+dj))&FLAG.NE);
 return !(flagsAt(Math.max(i,i+di),Math.min(j,j+dj))&FLAG.NW);
}

// OSRS breadth-first search (neighbour order W E S N SW SE NW NE) in a (2r+1)^2 window.
// mode 'tile': end on goal; 'card': end orthogonally next to goal; 'near': end within `reach`
// units of `point`. Unreachable: the reached tile closest to `point`, if within `alt` tiles (alt<0: any).
// Returns {path:[[x,z],...], reached, nodes} exactly like eldervale_private.tile_route.
// OSRS route shape: DIAGONAL FIRST until the walker is level with the end on one axis, then
// STRAIGHT to it (a click 10 east, 3 north walks NE, NE, NE, then E x7: one clean bend). Traced back
// from the end, each tile takes the one-step-shorter parent whose step into it is that shape's step:
// straight along the longer axis of what is left from the start, diagonal once both are equal.
// Around walls (no such parent) it takes the parent whose step is closest in direction to it
// (ties: the first-found parent). Same length as before; only the choice between equally short
// routes. Mirrors db/tile-route-osrs.sql (heading144 hugged the start-end line instead, which
// interleaved straight and diagonal steps: a zig-zag, and a horse that swung side to side).
const DI=[-1,1,0,0,-1,1,-1,1],DJ=[0,0,-1,1,-1,-1,1,1];
export function bfsRoute({start,goal,mode='tile',point=null,reach=0,radius=32,alt=10,flagsAt}){
 radius=Math.max(2,Math.min(64,radius|0));const w=2*radius+1,n=w*w,ox=start[0]-radius,oz=start[1]-radius;
 const px=point?point[0]:goal[0]*TILE,pz=point?point[1]:goal[1]*TILE,tpx=Math.round(px/TILE*1e6)/1e6,tpz=Math.round(pz/TILE*1e6)/1e6;
 const fl=new Int32Array(n);for(let k=0;k<n;k++)fl[k]=flagsAt(ox+k%w,oz+Math.floor(k/w))|0;
 const prev=new Int32Array(n).fill(-1),depth=new Int32Array(n),queue=new Int32Array(n);let head=0,tail=0;
 // Can the walker step from window tile (ci,cj) by (di,dj)? (the target tile itself is checked by the caller)
 const open=(ci,cj,di,dj)=>{const ni=ci+di,nj=cj+dj;
  if(!dj)return !(fl[cj*w+Math.min(ci,ni)]&FLAG.E);
  if(!di)return !(fl[Math.min(cj,nj)*w+ci]&FLAG.N);
  if(fl[cj*w+ni]&FLAG.BLOCK||fl[nj*w+ci]&FLAG.BLOCK||fl[cj*w+Math.min(ci,ni)]&FLAG.E||fl[Math.min(cj,nj)*w+ci]&FLAG.N)return false;
  return di===dj?!(fl[Math.min(cj,nj)*w+Math.min(ci,ni)]&FLAG.NE):!(fl[Math.min(cj,nj)*w+Math.max(ci,ni)]&FLAG.NW)};
 const origin=radius*w+radius;prev[origin]=origin;queue[tail++]=origin;
 let found=-1,best=-1,bestD=Infinity;
 while(head<tail){
  const cur=queue[head++],ci=cur%w,cj=(cur-ci)/w,wi=ci+ox,wj=cj+oz;
  if(mode==='tile'&&wi===goal[0]&&wj===goal[1]||mode==='card'&&Math.abs(wi-goal[0])+Math.abs(wj-goal[1])===1||mode==='near'&&(wi*TILE-px)**2+(wj*TILE-pz)**2<=reach*reach){found=cur;break}
  const d=(wi-tpx)**2+(wj-tpz)**2;if(best<0||d<bestD){best=cur;bestD=d}
  for(let k=0;k<8;k++){
   const di=DI[k],dj=DJ[k],ni=ci+di,nj=cj+dj;if(ni<0||nj<0||ni>=w||nj>=w)continue;
   const idx=nj*w+ni;if(prev[idx]>=0||fl[idx]&FLAG.BLOCK||!open(ci,cj,di,dj))continue;
   prev[idx]=cur;depth[idx]=depth[cur]+1;queue[tail++]=idx;
  }
 }
 const reachedGoal=found>=0;
 if(!reachedGoal){if(best>=0&&(alt<0||bestD<=alt*alt))found=best;if(found<0||found===origin)return {path:[],reached:false,nodes:tail}}
 const path=[];
 for(let k=found,steps=0;k!==origin&&steps<n;steps++){
  const ci=k%w,cj=(k-ci)/w,rx=ci-radius,rz=cj-radius;path.push([tileCenter(ci+ox),tileCenter(cj+oz)]);
  // The diagonal-first step into this tile, from what is left of the route from the start.
  const ix=Math.abs(rx)>=Math.abs(rz)?Math.sign(rx):0,iz=Math.abs(rz)>=Math.abs(rx)?Math.sign(rz):0;
  const fit=(di,dj)=>-(di*ix+dj*iz)/Math.sqrt(Math.abs(di)+Math.abs(dj));
  let next=prev[k],off=fit(ci-next%w,cj-Math.floor(next/w));
  for(let q=0;q<8;q++){const pi=ci-DI[q],pj=cj-DJ[q];if(pi<0||pj<0||pi>=w||pj>=w)continue;const p=pj*w+pi;
   if(p===next||prev[p]<0||depth[p]!==depth[k]-1||!open(pi,pj,DI[q],DJ[q]))continue;
   const o=fit(DI[q],DJ[q]);if(o<off-1e-9){off=o;next=p}}
  k=next;
 }
 path.reverse();return {path,reached:reachedGoal,nodes:tail};
}

// Facing of a tile walker (OSRS): the direction of the tile step it is on, nothing else. A route
// has one bend (diagonal first, then straight), so this turns once, at the bend.
export const stepYaw=(dx,dz,fallback=0)=>Math.abs(dx)+Math.abs(dz)<1e-9?fallback:Math.atan2(dx,dz);

// The tile steps between two tile centres up to a few tiles apart (a remote walker's tick
// positions: a runner moves 2 tiles a tick, a rider 3), in the route's own shape: diagonal first,
// then straight. Any stretch of an OSRS route is itself diagonal-first, so a remote walker walks the
// same tiles as its owner sees instead of gliding on chords between tick positions.
export function tileSteps(from,to,max=4){
 const fi=Math.round(from.x/TILE),fj=Math.round(from.z/TILE),ti=Math.round(to.x/TILE),tj=Math.round(to.z/TILE);
 const onGrid=(p,i,j)=>Math.abs(p.x-i*TILE)<.02&&Math.abs(p.z-j*TILE)<.02;
 const n=Math.max(Math.abs(ti-fi),Math.abs(tj-fj));
 if(n<=1||n>max||!onGrid(from,fi,fj)||!onGrid(to,ti,tj))return [{x:to.x,z:to.z}];
 const out=[];let i=fi,j=fj;
 while(i!==ti||j!==tj){i+=Math.sign(ti-i);j+=Math.sign(tj-j);out.push({x:tileCenter(i),z:tileCenter(j)})}
 out[out.length-1]={x:to.x,z:to.z};return out;
}

// Smooth presentation of a tile walker: the server reports where it stood at the tick boundary
// `pose.at` and the tile centres still ahead; `stepTiles` tiles are crossed per 600 ms tick, so
// diagonal steps take one tick like straight ones (no surge or stall between ticks).
export function projectTilePose(pose,now,{maxTicks=3}={}){
 if(!pose)return null;
 const out={x:pose.x,z:pose.z,yaw:pose.yaw,moving:false},path=Array.isArray(pose.path)?pose.path:[],steps=pose.stepTiles>0?pose.stepTiles:1;
 if(!path.length||!Number.isFinite(pose.at)||!Number.isFinite(now))return out;
 let budget=Math.max(0,Math.min(maxTicks,(now-pose.at)/(GAME_TICK*1000)))*steps;
 for(let k=0;k<path.length;k++){
  const gx=Number(path[k]?.[0]),gz=Number(path[k]?.[1]);if(!Number.isFinite(gx)||!Number.isFinite(gz))break;
  const dx=gx-out.x,dz=gz-out.z;if(Math.abs(dx)+Math.abs(dz)<1e-6)continue;
  out.yaw=Math.atan2(dx,dz);out.moving=true;
  if(budget<1){out.x+=dx*budget;out.z+=dz*budget;return out}
  out.x=gx;out.z=gz;budget-=1;
 }
 out.moving=false;return out;
}

// Where a click lands: the centre of the tile under it.
export function snapToTile(p){return {x:tileCenter(tileOf(p.x)),z:tileCenter(tileOf(p.z))}}

// ---- Client route prediction (movement v3) -------------------------------------------------------
// The local walker starts a click-walk at once, on the route the server will walk: the same BFS
// (bfsRoute) and the same leg planning as eldervale_private.tile_plan_move / tile_plan_leg.
// SQL round(double precision) rounds a tie to even; so does this.
const rint=v=>{const f=Math.floor(v),d=v-f;return d>.5?f+1:d<.5?f:f%2===0?f:f+1};
// tile_plan_leg: route [[x,z],...] waypoints; the first is the leg's goal (beyond the search window:
// the closest tile toward it, and the waypoint stays). Returns {path,route} (route: waypoints left).
export function planTileLeg(ci,cj,route,flagsAt,{radius=32,alt=10}={}){
 if(!Array.isArray(route)||!route.length)return {path:[],route:[]};
 let gi=tileOf(route[0][0]),gj=tileOf(route[0][1]);const far=Math.max(Math.abs(gi-ci),Math.abs(gj-cj));
 if(far<=radius-1){const r=bfsRoute({start:[ci,cj],goal:[gi,gj],mode:'tile',point:[gi*TILE,gj*TILE],radius,alt:route.length>1?-1:alt,flagsAt});return {path:r.path,route:route.slice(1)}}
 const f=(radius-1)/far;gi=ci+rint((gi-ci)*f);gj=cj+rint((gj-cj)*f);
 return {path:bfsRoute({start:[ci,cj],goal:[gi,gj],mode:'tile',point:[gi*TILE,gj*TILE],radius,alt:-1,flagsAt}).path,route:route.slice()};
}
// tile_plan_move without a target: waypoints inside the first search window are skipped (the BFS
// finds its own way), then legs are planned one after another while `covered(i,j)` says the flags
// around a leg's start are known (the server plans the next leg when one ends; so does this).
// Returns {path,legs}: the whole predicted walk and the leg ends it holds.
export function planTileMove(start,waypoints,flagsAt,{radius=32,alt=10,covered=()=>true,maxLegs=6}={}){
 let route=(Array.isArray(waypoints)?waypoints:[]).slice(0,128).filter(w=>Array.isArray(w)&&Number.isFinite(+w[0])&&Number.isFinite(+w[1])).map(w=>[+w[0],+w[1]]);
 let [ci,cj]=start;const path=[],legs=[];
 while(route.length>1&&Math.max(Math.abs(tileOf(route[1][0])-ci),Math.abs(tileOf(route[1][1])-cj))<=radius-1)route.shift();
 for(let n=0;n<maxLegs&&route.length&&covered(ci,cj);n++){
  const leg=planTileLeg(ci,cj,route,flagsAt,{radius,alt});if(!leg.path.length)break;
  path.push(...leg.path);const end=leg.path.at(-1);ci=tileOf(end[0]);cj=tileOf(end[1]);legs.push(end);route=leg.route;
 }
 return {path,legs,complete:!route.length};
}
// Tile flags around the walker from the server feed (public.quest_guide_tiles: flags plus closed
// door bits, exactly what tile_route reads); unknown tiles read 0. `covers(i,j,r)`: the whole BFS
// window of radius r around (i,j) is inside the fetched window.
export function createTileFlagCache(){
 const k=(i,j)=>(i+32768)*65536+(j+32768);let flags=new Map(),center=null,radius=0,at=0;
 return {
  set(view,now=Date.now()){if(!view||!Array.isArray(view.tiles)||!Array.isArray(view.center))return false;const next=new Map();for(const t of view.tiles){if(Array.isArray(t)&&t[2])next.set(k(t[0]|0,t[1]|0),t[2]|0)}flags=next;center=[view.center[0]|0,view.center[1]|0];radius=view.radius|0;at=now;return true},
  flagsAt:(i,j)=>flags.get(k(i,j))||0,
  covers(i,j,r=32){return !!center&&Math.max(Math.abs(i-center[0]),Math.abs(j-center[1]))+r<=radius},
  get center(){return center},get radius(){return radius},get fetchedAt(){return at}};
}
