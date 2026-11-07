import {buildingWorld} from './building-stories.js?v=release-20261107-attacks134';
// Daily routines for the townsfolk of a seeded settlement, derived only from
// the town's own layout so the server routes (db/town-life.sql), the props
// they use and the client stations always agree.
//
// A route is a loop of stops {x,z,wait,act,face,hold}. The server walks the
// actor stop to stop in straight lines and waits `wait` seconds; the client
// plays `act` (npc-activities.js) facing `face` (radians, Three.js yaw) and
// carries `hold` on the leg after that stop. Stops without `act` are corners.
const r2=v=>Math.round(v*100)/100,r3=v=>Math.round(v*1000)/1000;
const TAU=Math.PI*2,norm=a=>((a%TAU)+TAU)%TAU,gap=(a,b)=>{const d=Math.abs(norm(a)-norm(b));return Math.min(d,TAU-d)};
// Bearing as used by the seeded world: offset (sin a, cos a).
const at=(town,angle,r)=>({x:town.x+Math.sin(angle)*r,z:town.z+Math.cos(angle)*r});
const bearing=(town,p)=>Math.atan2(p.x-town.x,p.z-town.z);
const yawTo=(from,to)=>Math.atan2(to.x-from.x,to.z-from.z);
const stop=(p,extra={})=>({x:r2(p.x),z:r2(p.z),wait:0,...extra,...(Number.isFinite(extra.face)?{face:r3(extra.face)}:{})});
export const PLAZA_RING=4,BENCH_RADIUS=6.4,GUARD_RING=17;

export function townBuildings(town,entities){
 const near=entities.filter(e=>['bank','inn','forge','cottage'].includes(e.template)&&Math.hypot(e.x-town.x,e.z-town.z)<40);
 const pick=f=>near.find(f);
 return {bank:pick(e=>e.template==='bank'),inn:pick(e=>e.template==='inn'),forge:pick(e=>e.template==='forge'),chapel:pick(e=>e.template==='cottage'&&e.room==='chapel'),house:pick(e=>e.template==='cottage'&&e.room!=='chapel')};
}

export function planTownLife(town,entities){
 const b=townBuildings(town,entities),buildings=Object.values(b).filter(Boolean);
 const local=(d,x,z)=>buildingWorld(d,x,z),faceOf=d=>(d.yaw||0)*Math.PI/180;
 const lanes=buildings.map(d=>bearing(town,d)),markets=[1,-1].map(side=>Math.atan2(side*12,4));
 // Benches sit between the lanes and market stalls, facing the fountain.
 const benchAngles=[],candidates=[1,3,5,7,0,2,4,6,.5,1.5,2.5,3.5,4.5,5.5,6.5,7.5].map(k=>k*Math.PI/4);for(const a of candidates){if(benchAngles.length<4&&[...lanes,...markets].every(l=>gap(l,a)>.42)&&benchAngles.every(o=>gap(o,a)>.9))benchAngles.push(norm(a))}
 const props=[];
 const benches=benchAngles.map((a,i)=>{const p=at(town,a,BENCH_RADIUS),yaw=yawTo(p,town);props.push({template:'bench',x:r2(p.x),z:r2(p.z),yaw:r2(yaw*180/Math.PI),name:'Town bench'});const seat=at(town,a,BENCH_RADIUS-.8);return {angle:a,seat:stop(seat,{face:yaw})}});
 // Goods behind the market stalls and stores beside the lodge and workshop.
 for(const side of [1,-1]){props.push({template:'barrel',x:town.x+side*13.3,z:town.z+6.4,yaw:0,name:'Oak barrel'},{template:'crate',x:town.x+side*11.2,z:town.z+6.5,yaw:side*8,name:'Supply crate'})}
 const store=d=>{if(!d)return null;const p=local(d,2.8,1.1),q=local(d,2.8,-.3);props.push({template:'crate',x:r2(p.x),z:r2(p.z),yaw:r2(d.yaw||0),name:'Supply crate'},{template:'barrel',x:r2(q.x),z:r2(q.z),yaw:0,name:'Oak barrel'});return {corner:stop(local(d,2.8,2.65)),pick:stop(local(d,2.8,1.75),{face:faceOf(d)+Math.PI})}};
 const innStore=store(b.inn),forgeStore=store(b.forge);
 for(const p of props){p.x=r2(p.x);p.z=r2(p.z)}
 // Ways in and out: the plaza ring, then straight down a lane to a door.
 const ring=a=>stop(at(town,a,PLAZA_RING));
 const door=d=>stop(local(d,0,2.7));
 // Lanes that run through a market stall step around its front instead.
 const via=d=>{const a=bearing(town,d),side=Math.sign(Math.sin(a));for(const m of [1,-1]){if(m!==side)continue;const cx=m*12,cz=4;
   // Distance from the stall centre to the lane ray.
   const dx=Math.sin(a),dz=Math.cos(a),along=cx*dx+cz*dz,off=Math.abs(cx*dz-cz*dx);if(along>0&&off<2.6)return [stop({x:town.x+m*9,z:town.z+1.3}),stop({x:town.x+m*15.4,z:town.z+1.3}),stop(at(town,a,17))]}return []};
 const front=(d,side)=>({walk:stop(local(d,side*1.25,2.7)),work:stop(local(d,side*1.25,2.5),{face:faceOf(d)+Math.PI})});
 // Path between two plaza bearings around the fountain, never cutting it.
 const around=(from,to)=>{const out=[];let d=norm(to-from);if(d>Math.PI)d-=TAU;const n=Math.max(1,Math.ceil(Math.abs(d)/(Math.PI/2.2)));for(let i=1;i<=n;i++)out.push(ring(from+d*i/n));return out};
 const route=legs=>{const out=[];let bearingNow=null;for(const leg of legs){const a=leg.bearing;if(bearingNow!==null)out.push(...around(bearingNow,a));else out.push(ring(a));out.push(...leg.stops);bearingNow=a;
   // Return to the ring along the same lane.
   out.push(...leg.back||[],ring(a))}
  // Close the loop back to the first bearing.
  out.push(...around(bearingNow,legs[0].bearing).slice(0,-1));return dedupe(out)};
 const bench=i=>benches[i%benches.length];
 const sitAt=(i,act='sit',wait=14)=>({bearing:bench(i).angle,stops:[stop(at(town,bench(i).angle,BENCH_RADIUS-.8),{wait,act,face:bench(i).seat.face})]});
 const atDoor=(d,act,wait,side=0)=>{if(!d)return null;const f=side?front(d,side):null;return {bearing:bearing(town,d),stops:side?[...via(d),door(d),f.walk,{...f.work,wait,act}]:[...via(d),{...door(d),wait,act,face:faceOf(d)+Math.PI}],back:side?[f.walk,door(d),...via(d).reverse()]:via(d).reverse()}};
 const fountain=(a,wait=6)=>({bearing:a,stops:[stop(at(town,a,2.6),{wait,act:'fetch',face:a+Math.PI})]});
 const chat=(a,which)=>{const mid=at(town,a,5),t={x:Math.cos(a),z:-Math.sin(a)},p={x:mid.x+t.x*.8*which,z:mid.z+t.z*.8*which},q={x:mid.x-t.x*.8*which,z:mid.z-t.z*.8*which};return {bearing:a,stops:[stop(p,{wait:14,act:'talk',face:yawTo(p,q)})]}};
 const sweepLoop=(a0)=>[0,1,2,3].map(i=>{const a=a0+i*Math.PI/2;return {bearing:a,stops:[stop(at(town,a,5.2),{wait:9,act:'sweep',face:a+Math.PI/2})]}});
 const storeLeg=(d,s,act,hold)=>d&&s?{bearing:bearing(town,d),stops:[...via(d),door(d),s.corner,{...s.pick,wait:5,act,...(hold?{hold}:{})}],back:[s.corner,door(d),...via(d).reverse()]}:null;
 const stallLeg=(side,hold)=>{const a=Math.atan2(side*10,4);const p=stop({x:town.x+side*10,z:town.z+4},{wait:5,act:'fetch',face:side>0?Math.PI/2:-Math.PI/2,...(hold?{hold}:{})});return {bearing:a,stops:[p]}};
 const chatAngle=norm((benchAngles[0]??0)+Math.PI);
 const plans={
  sweep:i=>[...sweepLoop(benchAngles[i%benchAngles.length]+Math.PI/4),atDoor(b.bank,'sweep',8,i%2?1:-1)],
  carry:i=>[storeLeg(i%2?b.forge:b.inn,i%2?forgeStore:innStore,'fetch','crate'),stallLeg(i%2?-1:1),sitAt(i+1,'sit',10),fountain(chatAngle+Math.PI/3,5)],
  garden:i=>[atDoor(b.house,'garden',16,1),atDoor(b.house,'garden',12,-1),fountain(chatAngle-Math.PI/3,6),atDoor(b.chapel,'garden',14,i%2?1:-1),chat(chatAngle,i%2?1:-1)],
  read:i=>[sitAt(i,'sitread',18),atDoor(b.bank,'read',8),chat(chatAngle,i%2?-1:1),sitAt(i+2,'sitread',12)]
 };
 const routeFor=(activity,i)=>route((plans[activity]||plans.read)(i).filter(Boolean));
 // Guards walk the town ring and pause to watch the approaches.
 const guardRing=offset=>{const pts=[];for(let k=0;k<8;k++){const a=Math.PI/8+(k+offset)*Math.PI/4,p=at(town,a,GUARD_RING);pts.push(stop(p,k%2?{}:{wait:4,act:'watch',face:a}))}return pts};
 return {props,benches,routeFor,guardRoute:i=>guardRing(i*4),buildings:b};
}
// Consecutive duplicate points would make a zero-length leg.
function dedupe(list){const out=[];for(const s of list){const last=out[out.length-1];if(last&&Math.hypot(last.x-s.x,last.z-s.z)<.05){if(s.act&&!last.act)out[out.length-1]=s;continue}out.push(s)}if(out.length>1){const a=out[0],z=out[out.length-1];if(Math.hypot(a.x-z.x,a.z-z.z)<.05)out.pop()}return out}
