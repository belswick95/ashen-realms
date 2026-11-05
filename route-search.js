// Incremental A* with a binary heap; no scan of the whole open set per node.
class MinHeap{constructor(){this.items=[]}push(n){const a=this.items;let i=a.length;a.push(n);while(i){const p=(i-1)>>1;if(a[p].f<=n.f)break;a[i]=a[p];i=p}a[i]=n}pop(){const a=this.items,first=a[0],last=a.pop();if(a.length){let i=0;while(i*2+1<a.length){let c=i*2+1;if(c+1<a.length&&a[c+1].f<a[c].f)c++;if(a[c].f>=last.f)break;a[i]=a[c];i=c}a[i]=last}return first}get length(){return this.items.length}}
const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
export function* searchRoute({start,goal,canTravel,heightAt=()=>0,maxNodes=30000,extent=419,cell=1}){
 const point=(x,z)=>({x,y:heightAt(x,z),z});
 // A long straight-line test is split up so even a distant map click can yield.
 function* clear(a,b){const distance=Math.hypot(a.x-b.x,a.z-b.z),n=Math.max(1,Math.ceil(distance/12));let prev=a;for(let i=1;i<=n;i++){const t=i/n,q=point(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t);if(!canTravel(prev,q))return false;prev=q;yield {phase:'route'}}return true}
 if(yield* clear(start,goal))return [point(goal.x,goal.z)];
 const margin=32,originX=Math.max(-extent,Math.min(start.x,goal.x)-margin),originZ=Math.max(-extent,Math.min(start.z,goal.z)-margin),cols=Math.ceil((Math.min(extent,Math.max(start.x,goal.x)+margin)-originX)/cell)+1,rows=Math.ceil((Math.min(extent,Math.max(start.z,goal.z)+margin)-originZ)/cell)+1;
 const coord=p=>[Math.max(0,Math.min(cols-1,Math.round((p.x-originX)/cell))),Math.max(0,Math.min(rows-1,Math.round((p.z-originZ)/cell)))],key=(x,z)=>z*cols+x,world=(x,z)=>point(originX+x*cell,originZ+z*cell);
 const [sx,sz]=coord(start),[gx,gz]=coord(goal),startId=key(sx,sz),goalId=key(gx,gz),nodes=new Map(),open=new MinHeap(),closed=new Set(),edgeCache=new Map();let best=startId,bestH=Infinity,count=0;
 const add=(x,z,g,prev)=>{const id=key(x,z),n={id,x,z,g,prev,f:g+Math.hypot(x-gx,z-gz)};nodes.set(id,n);open.push(n)};add(sx,sz,0,null);
 const pass=(ax,az,bx,bz)=>{const a=key(ax,az),b=key(bx,bz),k=a+':'+b;if(!edgeCache.has(k))edgeCache.set(k,canTravel(world(ax,az),world(bx,bz)));return edgeCache.get(k)};
 while(open.length&&count++<maxNodes){const n=open.pop();if(closed.has(n.id)||nodes.get(n.id)!==n)continue;closed.add(n.id);const h=Math.hypot(n.x-gx,n.z-gz);if(h<bestH){bestH=h;best=n.id}if(n.id===goalId)break;
  for(const [dx,dz]of directions){const x=n.x+dx,z=n.z+dz,id=key(x,z);if(x<0||z<0||x>=cols||z>=rows||closed.has(id))continue;if(!pass(n.x,n.z,x,z)||dx&&dz&&(!pass(n.x,n.z,n.x+dx,n.z)||!pass(n.x,n.z,n.x,n.z+dz)))continue;const g=n.g+Math.hypot(dx,dz),old=nodes.get(id);if(!old||g<old.g)add(x,z,g,n.id)}
  if(count%8===0)yield {phase:'route',visited:count};
 }
 // A blocked or unreachable goal walks to the closest reachable cell instead
 // (RuneScape behaviour); only a search that never left the start gives up.
 if(best===startId)return [];
 const path=[];let id=best;while(id!==startId&&path.length<maxNodes){const n=nodes.get(id);path.push(world(n.x,n.z));id=n.prev;if(id===null)break;if(path.length%128===0)yield {phase:'route'}}path.reverse();
 // Limit lookahead instead of checking every distant segment repeatedly.
 const smooth=[];let anchor=start;for(let i=0;i<path.length;){let far=i;for(let j=Math.min(path.length-1,i+32);j>i;j--){if(yield* clear(anchor,path[j])){far=j;break}}smooth.push(path[far]);anchor=path[far];i=far+1;yield {phase:'route'}}
 if(best===goalId&&(yield* clear(smooth.at(-1)||start,goal)))smooth.push(point(goal.x,goal.z));return smooth;
}
