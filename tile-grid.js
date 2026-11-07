// Tick & tile engine, client half (mirrors db/tick-tile-engine-*.sql; the server is authoritative).
// Tiles are 1.58 world units (one character-width, click-walk.js TILE); tile (i,j) is centred on
// (i*TILE, j*TILE). One game tick is 600 ms: walkers step 1 tile per tick, runners 2.
import {TILE,GAME_TICK} from './click-walk.js?v=release-20261107-walls155';
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
// The path is traced back from the end along the shortest-path tiles that lie closest to the
// straight line from the start to the end (ties: the first-found parent). Following the first-found
// parent alone put every straight step first and every diagonal last, so a click 10 east and 3 north
// walked east (off to one side of the marker) and then swung over to the diagonal on the other side.
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
 const ex=found%w-radius,ez=Math.floor(found/w)-radius,path=[];
 for(let k=found,steps=0;k!==origin&&steps<n;steps++){
  const ci=k%w,cj=(k-ci)/w;path.push([tileCenter(ci+ox),tileCenter(cj+oz)]);
  // Off-line distance of each one-step-shorter parent that can step here (|cross| with the line).
  let next=prev[k],off=Math.abs((prev[k]%w-radius)*ez-(Math.floor(prev[k]/w)-radius)*ex);
  for(let q=0;q<8;q++){const pi=ci-DI[q],pj=cj-DJ[q];if(pi<0||pj<0||pi>=w||pj>=w)continue;const p=pj*w+pi;
   if(p===next||prev[p]<0||depth[p]!==depth[k]-1||!open(pi,pj,DI[q],DJ[q]))continue;
   const o=Math.abs((pi-radius)*ez-(pj-radius)*ex);if(o<off-1e-9){off=o;next=p}}
  k=next;
 }
 path.reverse();return {path,reached:reachedGoal,nodes:tail};
}

// Facing of a tile walker: along the stretch of its path just ahead, not just the next tile. A
// route crossing a slope mixes two neighbouring step directions (east, east, north-east, east, ...);
// facing each tile flicked the walker 45° at every diagonal. Instead it faces the point up to
// `look` tile steps ahead, as far as the path keeps to those two neighbouring directions, so it
// looks along the slope toward the marker, and still turns at a real corner (90° or more).
// `path` holds [x,z] pairs or {x,z}; `from` is the index of the next point.
export const LOOK_TILES=6;
const ptX=p=>Number(p?.[0]??p?.x),ptZ=p=>Number(p?.[1]??p?.z);
const stepDir=(dx,dz)=>{const m=Math.max(Math.abs(dx),Math.abs(dz));return m<1e-9?-1:(Math.round(dx/m)+1)*3+Math.round(dz/m)+1};
const DIR_ANGLE=[-3*Math.PI/4,-Math.PI/2,-Math.PI/4,Math.PI,NaN,0,3*Math.PI/4,Math.PI/2,Math.PI/4];// stepDir -> atan2(di,dj)
const adjacent=(a,b)=>{const d=Math.abs(DIR_ANGLE[a]-DIR_ANGLE[b]);return Math.min(d,2*Math.PI-d)<Math.PI/4+1e-6};
export function aheadYaw(x,z,path,from=0,fallback=0,look=LOOK_TILES,behind=null){
 let steps=0,lx=x,lz=z,tx=x,tz=z,first=-1,other=-1;
 const fits=dir=>{if(first<0){first=dir;return true}if(dir===first||dir===other)return true;if(other<0&&adjacent(dir,first)){other=dir;return true}return false};
 for(let k=from;k<path.length;k++){
  const gx=ptX(path[k]),gz=ptZ(path[k]);if(!Number.isFinite(gx)||!Number.isFinite(gz))break;
  const dir=stepDir(gx-lx,gz-lz);if(dir<0)continue;if(!fits(dir))break;
  const seg=Math.max(Math.abs(gx-lx),Math.abs(gz-lz))/TILE;
  if(steps+seg>look){const f=(look-steps)/seg;tx=lx+(gx-lx)*f;tz=lz+(gz-lz)*f;break}
  steps+=seg;lx=tx=gx;lz=tz=gz;
 }
 // Tiles already walked (oldest first) that keep to the same directions widen the stretch when
 // little of the path ahead is known (a remote walker's queue holds a tile or two).
 let sx=x,sz=z;
 if(behind&&first>=0)for(let k=behind.length-1,back=0,nx=x,nz=z;k>=0&&back<look-steps;k--){
  const bx=ptX(behind[k]),bz=ptZ(behind[k]);if(!Number.isFinite(bx)||!Number.isFinite(bz))break;
  const dir=stepDir(nx-bx,nz-bz);if(dir<0)continue;if(!fits(dir))break;
  back+=Math.max(Math.abs(nx-bx),Math.abs(nz-bz))/TILE;sx=nx=bx;sz=nz=bz;
 }
 return Math.hypot(tx-sx,tz-sz)>1e-6&&Math.hypot(tx-x,tz-z)>1e-6?Math.atan2(tx-sx,tz-sz):fallback;
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
  if(budget<1){out.x+=dx*budget;out.z+=dz*budget;out.yaw=aheadYaw(out.x,out.z,path,k,out.yaw);return out}
  out.x=gx;out.z=gz;budget-=1;
 }
 out.moving=false;return out;
}

// Where a click lands: the centre of the tile under it.
export function snapToTile(p){return {x:tileCenter(tileOf(p.x)),z:tileCenter(tileOf(p.z))}}
