// Server-parity walking model for the capital layout tests: mirrors
// eldervale_private.can_step (building shells with door gaps, castle walls,
// towers and open gates, props and profession stations) on a point basis.
import {createObstacleIndex} from '../../navigation-obstacles.js';

const BUILDINGS=['cottage','bank','inn','forge'];
export function buildingLocal(d,x,z){const a=(d.yaw||0)*Math.PI/180,s=1.3*(d.scale||1),dx=x-d.x,dz=z-d.z;return {tx:(dx*Math.cos(a)-dz*Math.sin(a))/s,tz:(dx*Math.sin(a)+dz*Math.cos(a))/s}}
// Shell: |tx|<2.17,|tz|<2.09 blocks except the room inside and the doorway (+z face).
export function buildingBlocks(d,x,z){const {tx,tz}=buildingLocal(d,x,z);if(Math.abs(tx)>=2.17||Math.abs(tz)>=2.09)return false;if(Math.abs(tx)<1.65&&Math.abs(tz)<1.57)return false;if(Math.abs(tx)<.49&&tz>1.2)return false;return true}
export function insideBuilding(d,x,z){const {tx,tz}=buildingLocal(d,x,z);return Math.abs(tx)<2.17&&Math.abs(tz)<2.09}
export function castleBlocks(d,x,z,gateOpen=true){const a=(d.yaw||0)*Math.PI/180,s=d.scale||1,dx=x-d.x,dz=z-d.z,tx=(dx*Math.cos(a)-dz*Math.sin(a))/s,tz=(dx*Math.sin(a)+dz*Math.cos(a))/s;
 if(d.template==='castle_tower')return tx*tx+tz*tz<25;
 if(Math.abs(tz)<(d.template==='castle_gate'?2.1:1.6)&&Math.abs(tx)<(d.length||24)/2+.3)return d.template!=='castle_gate'||Math.abs(tx)>4.1||!gateOpen;return false}
export function walkModel(rows,{gateOpen=true}={}){
 const buildings=rows.filter(d=>BUILDINGS.includes(d.template)),castle=rows.filter(d=>['castle_wall','castle_tower','castle_gate'].includes(d.template)),props=createObstacleIndex(rows.filter(d=>d.kind==='object'||!d.kind));
 return {buildings,blocked(x,z){if(props.blocked(x,z))return true;for(const d of castle)if(Math.abs(d.x-x)<30&&Math.abs(d.z-z)<30&&castleBlocks(d,x,z,gateOpen))return true;for(const d of buildings)if(Math.abs(d.x-x)<15&&Math.abs(d.z-z)<15&&buildingBlocks(d,x,z))return true;return false},
  inBuilding(x,z){return buildings.find(d=>insideBuilding(d,x,z))||null}};
}
// 4-connected grid search on a step-metre lattice inside a box.
export function gridReach(model,start,goals,{step=.5,box=[-300,60,-140,215]}={}){
 const [x0,z0,x1,z1]=box,W=Math.ceil((x1-x0)/step)+1,H=Math.ceil((z1-z0)/step)+1,key=(i,j)=>j*W+i,seen=new Uint8Array(W*H);
 const cell=p=>[Math.round((p.x-x0)/step),Math.round((p.z-z0)/step)];
 const ok=(i,j)=>i>=0&&j>=0&&i<W&&j<H&&!model.blocked(x0+i*step,z0+j*step);
 const [si,sj]=cell(start);if(!ok(si,sj))return {start:false,reached:goals.map(()=>false)};
 const queue=[[si,sj]];seen[key(si,sj)]=1;
 for(let q=0;q<queue.length;q++){const [i,j]=queue[q];for(const [di,dj]of [[1,0],[-1,0],[0,1],[0,-1]]){const a=i+di,b=j+dj;if(a<0||b<0||a>=W||b>=H||seen[key(a,b)])continue;if(!ok(a,b)){seen[key(a,b)]=2;continue}seen[key(a,b)]=1;queue.push([a,b])}}
 return {start:true,reached:goals.map(g=>{const [i,j]=cell(g);for(let r=0;r<=2;r++)for(let di=-r;di<=r;di++)for(let dj=-r;dj<=r;dj++)if(seen[key(i+di,j+dj)]===1)return true;return false})};
}
// A straight leg is walkable if every 0.25 m sample is free.
export function legClear(model,a,b,step=.25){const n=Math.max(1,Math.ceil(Math.hypot(b.x-a.x,b.z-a.z)/step));for(let i=0;i<=n;i++){const x=a.x+(b.x-a.x)*i/n,z=a.z+(b.z-a.z)*i/n;if(model.blocked(x,z))return {x,z}}return null}
