// Incremental A* with a binary heap; no scan of the whole open set per node.
class MinHeap{constructor(){this.items=[]}push(n){const a=this.items;let i=a.length;a.push(n);while(i){const p=(i-1)>>1;if(a[p].f<=n.f)break;a[i]=a[p];i=p}a[i]=n}pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[c].f>=last.f)break;a[i]=a[c];i=c}a[i]=last}return first}get length(){return this.items.length}}
const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
// Octile distance: the exact cost of an unobstructed 8-direction grid walk.
export const octile=(dx,dz)=>{dx=Math.abs(dx);dz=Math.abs(dz);return Math.max(dx,dz)+(Math.SQRT2-1)*Math.min(dx,dz)};
// `greed` > 1 weights the heuristic (bounded-suboptimal A*): far fewer nodes
// around town obstacles for routes at most that factor longer before smoothing.
// `coarseWalk(x,z)` (optional): cheap static terrain walkability. When the goal
// lies outside the fine search window's reach (a river between you and it, the
// bridge far away), a 2 m whole-map pass finds the way round instead of giving up.
export function* searchRoute({start,goal,canTravel,heightAt=()=>0,maxNodes=30000,extent=419,cell=1,greed=1.2,coarseWalk=null,coarseCell=2,coarseNodes=120000}){
 const point=(x,z)=>({x,y:heightAt(x,z),z});
 // A long straight-line test is split up so even a distant map click can yield.
 function* clear(a,b){const distance=Math.hypot(a.x-b.x,a.z-b.z),n=Math.max(1,Math.ceil(distance/12));let prev=a;for(let i=1;i<=n;i++){const t=i/n,q=point(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t);if(!canTravel(prev,q))return false;prev=q;yield {phase:'route'}}return true}
 if(yield* clear(start,goal))return [point(goal.x,goal.z)];
 const margin=32,originX=Math.max(-extent,Math.min(start.x,goal.x)-margin),originZ=Math.max(-extent,Math.min(start.z,goal.z)-margin),cols=Math.ceil((Math.min(extent,Math.max(start.x,goal.x)+margin)-originX)/cell)+1,rows=Math.ceil((Math.min(extent,Math.max(start.z,goal.z)+margin)-originZ)/cell)+1;
 const coord=p=>[Math.max(0,Math.min(cols-1,Math.round((p.x-originX)/cell))),Math.max(0,Math.min(rows-1,Math.round((p.z-originZ)/cell)))],key=(x,z)=>z*cols+x,world=(x,z)=>point(originX+x*cell,originZ+z*cell);
 const [sx,sz]=coord(start),[gx,gz]=coord(goal),startId=key(sx,sz),goalId=key(gx,gz),nodes=new Map(),open=new MinHeap(),closed=new Set(),edgeCache=new Map();let best=startId,bestH=Infinity,count=0;
 const add=(x,z,g,prev)=>{const id=key(x,z),n={id,x,z,g,prev,f:g+greed*octile(x-gx,z-gz)};nodes.set(id,n);open.push(n)};add(sx,sz,0,null);
 // Each grid edge is tested once whichever way it is crossed (numeric keys, no strings).
 const span=cols*rows,pass=(ax,az,bx,bz)=>{const a=key(ax,az),b=key(bx,bz),k=a<b?a*span+b:b*span+a;let v=edgeCache.get(k);if(v===undefined){v=a<b?canTravel(world(ax,az),world(bx,bz)):canTravel(world(bx,bz),world(ax,az));edgeCache.set(k,v)}return v};
 while(open.length&&count++<maxNodes){const n=open.pop();if(closed.has(n.id)||nodes.get(n.id)!==n)continue;closed.add(n.id);const h=Math.hypot(n.x-gx,n.z-gz);if(h<bestH){bestH=h;best=n.id}if(n.id===goalId)break;
  for(const [dx,dz]of directions){const x=n.x+dx,z=n.z+dz,id=key(x,z);if(x<0||z<0||x>=cols||z>=rows||closed.has(id))continue;if(!pass(n.x,n.z,x,z)||dx&&dz&&(!pass(n.x,n.z,n.x+dx,n.z)||!pass(n.x,n.z,n.x,n.z+dz)))continue;const g=n.g+Math.hypot(dx,dz),old=nodes.get(id);if(!old||g<old.g)add(x,z,g,n.id)}
  if(count%8===0)yield {phase:'route',visited:count};
 }
 if(best!==goalId&&coarseWalk&&Math.hypot(world(nodes.get(best).x,nodes.get(best).z).x-goal.x,world(nodes.get(best).x,nodes.get(best).z).z-goal.z)>2){
  const reached=world(nodes.get(best).x,nodes.get(best).z),coarse=yield* coarseRoute({start,goal,walk:coarseWalk,cell:coarseCell,extent,maxNodes:coarseNodes,greed,already:Math.hypot(reached.x-goal.x,reached.z-goal.z)});
  if(coarse){const smooth=[];let anchor=start;for(let i=0;i<coarse.length;){let far=i;for(let j=Math.min(coarse.length-1,i+24);j>i;j--){if(yield* clear(anchor,coarse[j])){far=j;break}}smooth.push(point(coarse[far].x,coarse[far].z));anchor=coarse[far];i=far+1;yield {phase:'route'}}return smooth}
 }
 // A blocked or unreachable goal walks to the closest reachable cell instead
 // (RuneScape behaviour); only a search that never left the start gives up.
 if(best===startId)return [];
 const path=[];let id=best;while(id!==startId&&path.length<maxNodes){const n=nodes.get(id);path.push(world(n.x,n.z));id=n.prev;if(id===null)break;if(path.length%128===0)yield {phase:'route'}}path.reverse();
 // Limit lookahead instead of checking every distant segment repeatedly.
 const smooth=[];let anchor=start;for(let i=0;i<path.length;){let far=i;for(let j=Math.min(path.length-1,i+32);j>i;j--){if(yield* clear(anchor,path[j])){far=j;break}}smooth.push(path[far]);anchor=path[far];i=far+1;yield {phase:'route'}}
 if(best===goalId&&(yield* clear(smooth.at(-1)||start,goal)))smooth.push(point(goal.x,goal.z));return smooth;
}
// Whole-map 8-direction A* over static terrain only (props and doors are left to
// the fine search near you and to the server's sliding walker). Returns the cell
// centres from start to goal, ending exactly on the goal, or null.
export function* coarseRoute({start,goal,walk,cell=2,extent=419,maxNodes=120000,greed=1.2,already=Infinity}){
 const n=Math.floor(2*extent/cell)+1,idx=v=>Math.max(0,Math.min(n-1,Math.round((v+extent)/cell))),pos=i=>-extent+i*cell;
 const cache=new Int8Array(n*n),ok=(x,z)=>{const k=z*n+x;let v=cache[k];if(!v){v=walk(pos(x),pos(z))?1:-1;cache[k]=v}return v>0};
 const half=(ax,az,bx,bz)=>walk((pos(ax)+pos(bx))/2,(pos(az)+pos(bz))/2);
 let sx=idx(start.x),sz=idx(start.z);const gx=idx(goal.x),gz=idx(goal.z);
 // Start from the nearest walkable cell (the walker may stand on a cell edge).
 if(!ok(sx,sz)){let found=false;for(let r=1;r<=3&&!found;r++)for(let dz=-r;dz<=r&&!found;dz++)for(let dx=-r;dx<=r;dx++)if(sx+dx>=0&&sz+dz>=0&&sx+dx<n&&sz+dz<n&&ok(sx+dx,sz+dz)){sx+=dx;sz+=dz;found=true;break}if(!found)return null}
 // A goal in water (a fishing spot) or on a rock: aim for the nearest walkable cell beside it.
 let tx=gx,tz=gz,exact=ok(gx,gz)&&walk(goal.x,goal.z),bestD=exact?0:Infinity;
 if(!exact){for(let dz=-4;dz<=4;dz++)for(let dx=-4;dx<=4;dx++){const X=gx+dx,Z=gz+dz;if(X<0||Z<0||X>=n||Z>=n||!ok(X,Z))continue;const d=Math.hypot(pos(X)-goal.x,pos(Z)-goal.z);if(d<bestD){bestD=d;tx=X;tz=Z}}if(bestD===Infinity)return null}
 // The fine search already got about as close as the terrain allows (e.g. the near bank).
 if(already<=bestD+1.5)return null;
 const g=new Float32Array(n*n).fill(Infinity),prev=new Int32Array(n*n).fill(-1),closed=new Uint8Array(n*n),open=new MinHeap(),s=sz*n+sx,t=tz*n+tx;g[s]=0;open.push({id:s,f:0});let count=0;
 while(open.length&&count++<maxNodes){const {id,f}=open.pop();if(closed[id])continue;closed[id]=1;if(id===t)break;const x=id%n,z=(id-x)/n;
  for(const [dx,dz] of directions){const X=x+dx,Z=z+dz;if(X<0||Z<0||X>=n||Z>=n)continue;const k=Z*n+X;if(closed[k]||!ok(X,Z)||!half(x,z,X,Z))continue;if(dx&&dz&&(!ok(x+dx,z)||!ok(x,z+dz)))continue;const ng=g[id]+(dx&&dz?Math.SQRT2:1);if(ng<g[k]){g[k]=ng;prev[k]=id;open.push({id:k,f:ng+greed*octile(X-tx,Z-tz)})}}
  if(count%256===0)yield {phase:'route',visited:count};
 }
 if(!closed[t])return null;
 const out=[exact?{x:goal.x,z:goal.z}:{x:pos(tx),z:pos(tz)}];for(let id=prev[t];id>=0&&id!==s;id=prev[id])out.push({x:pos(id%n),z:pos(Math.floor(id/n))});out.reverse();return out;
}
