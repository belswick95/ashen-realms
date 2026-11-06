// Tick & tile engine, client half (mirrors db/tick-tile-engine-*.sql; the server is authoritative).
// Tiles are 1.58 world units (one character-width, click-walk.js TILE); tile (i,j) is centred on
// (i*TILE, j*TILE). One game tick is 600 ms: walkers step 1 tile per tick, runners 2.
import {TILE,GAME_TICK} from './click-walk.js?v=release-20261106-caves100';
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
const DI=[-1,1,0,0,-1,1,-1,1],DJ=[0,0,-1,1,-1,-1,1,1];
export function bfsRoute({start,goal,mode='tile',point=null,reach=0,radius=32,alt=10,flagsAt}){
 radius=Math.max(2,Math.min(64,radius|0));const w=2*radius+1,n=w*w,ox=start[0]-radius,oz=start[1]-radius;
 const px=point?point[0]:goal[0]*TILE,pz=point?point[1]:goal[1]*TILE,tpx=Math.round(px/TILE*1e6)/1e6,tpz=Math.round(pz/TILE*1e6)/1e6;
 const fl=new Int32Array(n);for(let k=0;k<n;k++)fl[k]=flagsAt(ox+k%w,oz+Math.floor(k/w))|0;
 const prev=new Int32Array(n).fill(-1),queue=new Int32Array(n);let head=0,tail=0;
 const origin=radius*w+radius;prev[origin]=origin;queue[tail++]=origin;
 let found=-1,best=-1,bestD=Infinity;
 while(head<tail){
  const cur=queue[head++],ci=cur%w,cj=(cur-ci)/w,wi=ci+ox,wj=cj+oz;
  if(mode==='tile'&&wi===goal[0]&&wj===goal[1]||mode==='card'&&Math.abs(wi-goal[0])+Math.abs(wj-goal[1])===1||mode==='near'&&(wi*TILE-px)**2+(wj*TILE-pz)**2<=reach*reach){found=cur;break}
  const d=(wi-tpx)**2+(wj-tpz)**2;if(best<0||d<bestD){best=cur;bestD=d}
  for(let k=0;k<8;k++){
   const di=DI[k],dj=DJ[k],ni=ci+di,nj=cj+dj;if(ni<0||nj<0||ni>=w||nj>=w)continue;
   const idx=nj*w+ni;if(prev[idx]>=0||fl[idx]&FLAG.BLOCK)continue;
   let f;
   if(!dj)f=fl[cj*w+Math.min(ci,ni)]&FLAG.E;
   else if(!di)f=fl[Math.min(cj,nj)*w+ci]&FLAG.N;
   else if(fl[cj*w+ni]&FLAG.BLOCK||fl[nj*w+ci]&FLAG.BLOCK||fl[cj*w+Math.min(ci,ni)]&FLAG.E||fl[Math.min(cj,nj)*w+ci]&FLAG.N)f=1;
   else if(di===dj)f=fl[Math.min(cj,nj)*w+Math.min(ci,ni)]&FLAG.NE;
   else f=fl[Math.min(cj,nj)*w+Math.max(ci,ni)]&FLAG.NW;
   if(f)continue;
   prev[idx]=cur;queue[tail++]=idx;
  }
 }
 const reachedGoal=found>=0;
 if(!reachedGoal){if(best>=0&&(alt<0||bestD<=alt*alt))found=best;if(found<0||found===origin)return {path:[],reached:false,nodes:tail}}
 const path=[];for(let k=found,steps=0;k!==origin&&steps<n;k=prev[k],steps++)path.push([tileCenter(k%w+ox),tileCenter(Math.floor(k/w)+oz)]);
 path.reverse();return {path,reached:reachedGoal,nodes:tail};
}

// Smooth presentation of a tile walker: the server reports where it stood at the tick boundary
// `pose.at` and the tile centres still ahead; `stepTiles` tiles are crossed per 600 ms tick, so
// diagonal steps take one tick like straight ones (no surge or stall between ticks).
export function projectTilePose(pose,now,{maxTicks=3}={}){
 if(!pose)return null;
 const out={x:pose.x,z:pose.z,yaw:pose.yaw,moving:false},path=Array.isArray(pose.path)?pose.path:[],steps=pose.stepTiles>0?pose.stepTiles:1;
 if(!path.length||!Number.isFinite(pose.at)||!Number.isFinite(now))return out;
 let budget=Math.max(0,Math.min(maxTicks,(now-pose.at)/(GAME_TICK*1000)))*steps;
 for(const point of path){
  const gx=Number(point?.[0]),gz=Number(point?.[1]);if(!Number.isFinite(gx)||!Number.isFinite(gz))break;
  const dx=gx-out.x,dz=gz-out.z;if(Math.abs(dx)+Math.abs(dz)<1e-6)continue;
  out.yaw=Math.atan2(dx,dz);out.moving=true;
  if(budget<1){out.x+=dx*budget;out.z+=dz*budget;return out}
  out.x=gx;out.z=gz;budget-=1;
 }
 out.moving=false;return out;
}

// Where a click lands: the centre of the tile under it.
export function snapToTile(p){return {x:tileCenter(tileOf(p.x)),z:tileCenter(tileOf(p.z))}}
