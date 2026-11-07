import {animateWork,createWorkKit,workFacing} from './npc-activities.js?v=release-20261107-invorder151';
// Original townsfolk, small walking loops and visible work. Service NPCs keep their jobs.
export function townResidents(settlements){
 const resident=(name,role,x,z,color,activity,patrol)=>({name,role,x,z,color,activity,behavior:patrol?'patrol':'stationary',patrol,lines:[`A good day for ${role.toLowerCase()}. There is always work to do around here.`,`The roads bring new faces to our town every day.`]});
 const main=[
  resident('Hobb the Sweeper','Street sweeper',6,3,0x8a754f,'sweep',[[6,3],[7,7],[3,11]]),
  resident('Orla the Courier','Courier',-7,8,0x74784f,'carry',[[-7,8],[5,11],[12,8],[7,3]]),
  resident('Dain the Apprentice','Smith apprentice',29,-9,0x795c44,'smith'),
  resident('Tessa the Gardener','Gardener',-10,8,0x63805b,'garden'),
  resident('Owen the Scribe','Scribe',8,-9,0x4b667b,'read'),
  resident('Nell the Baker','Baker',-5,23,0xa17c56,'trade',[[-5,23],[-1,18],[4,14]]),
  resident('Jory the Porter','Porter',17,12,0x68594e,'carry',[[17,12],[13,15],[18,19]]),
  resident('Iona of Oakcross','Resident',-9,-6,0x8c5961,'talk',[[-9,-6],[-6,-9],[2,-8]])
 ];
 const names=['Northwatch','Eastmarch','Farwatch','Westmere','Suncrest','Greenwatch','Ashen Reach','Moonmere','Silverfin','Pinehollow','Stonebridge'];
 settlements.slice(1).forEach(([x,z],i)=>{
  const town=names[i]||'the town';
  main.push(resident(`${town} tradeswoman`,'Trader',x+7,z+6,0x917052,'trade',[[x+7,z+6],[x+11,z+6],[x+9,z+10]]));
  main.push(resident(`${town} groundskeeper`,'Groundskeeper',x-7,z+6,0x637957,'sweep'));
  main.push(resident(`${town} messenger`,'Messenger',x+4,z+9,0x61758b,'carry',[[x+4,z+9],[x-4,z+10],[x-7,z+7]]));
 });return main;
}
export function townPropLayout(kind){return kind==='carry'?{width:.52,height:.34,depth:.28,y:1.64,z:.50,handX:.275,handY:1.63}:kind==='read'?{width:.40,height:.055,depth:.28,y:1.70,z:.50,handX:.19,handY:1.71}:null;}
// Every character is clip-driven: standing workers loop their job clip
// (animation.js ACTIVITY) with a matching prop and hand layer
// (npc-activities.js); travelling hands back to locomotion. A person on a
// server route works only at the route's stations, never at a random pause.
export function animateTownActivity(rig,kind,time,moving=false){if(!kind&&!rig.townRoute&&!rig.work?.weight){rig.setActivity?.(null);return}return animateWork(rig,kind,time,moving)}
export {createWorkKit,workFacing};
// Civilians keep any defensive weapon out of sight; it would otherwise put
// them in a fighting stance and stop their work.
export function carriesWeapon(profile={}){return /guard|warden|knight|soldier|ranger|scout|hunter|bandit|sentinel/i.test(String(profile.role||''))||profile.attackable===true}
// Standing room. Server tiles do not keep townsfolk apart: around the capital fountain six routes
// share the plaza ring and two sweepers share stations, so people stood inside one another (and
// inside a parked horse). Each standing person is nudged (presentation only, at most SPREAD_MAX)
// out of anyone within SPREAD_RADIUS (or the other's own `radius`, e.g. a horse); walkers are not
// moved but still push. people = [{x,z,moving,key,radius?,spread:{x,z}|null}] with x,z the
// server-presented position; an entry with spread null is an obstacle only. Spread eases toward
// its target (tau ~0.4 s), so nobody slides sideways in a frame.
export const SPREAD_RADIUS=1.05,SPREAD_MAX=.6;
export function spreadStanding(people,dt){
 for(const p of people){p.tx=0;p.tz=0}
 for(let i=0;i<people.length;i++)for(let j=i+1;j<people.length;j++){const a=people[i],b=people[j];const fixedA=a.moving||!a.spread,fixedB=b.moving||!b.spread;if(fixedA&&fixedB)continue;
  let dx=b.x-a.x,dz=b.z-a.z,d=Math.hypot(dx,dz);const r=Math.max(SPREAD_RADIUS,a.radius||0,b.radius||0);if(d>=r)continue;
  // Same spot: separate along a direction fixed by the pair (stable from frame to frame).
  if(d<1e-3){const h=spreadHash(a.key+'|'+b.key);dx=Math.sin(h);dz=Math.cos(h);d=0}else{dx/=d;dz/=d}
  const push=r-d,sa=fixedA?0:fixedB?1:.5,sb=fixedB?0:fixedA?1:.5;a.tx-=dx*push*sa;a.tz-=dz*push*sa;b.tx+=dx*push*sb;b.tz+=dz*push*sb}
 const k=1-Math.exp(-Math.max(0,dt)/.4);
 for(const p of people){const s=p.spread;if(!s)continue;let tx=p.moving?0:p.tx,tz=p.moving?0:p.tz;const m=Math.hypot(tx,tz);if(m>SPREAD_MAX){tx*=SPREAD_MAX/m;tz*=SPREAD_MAX/m}
  s.x+=(tx-s.x)*k;s.z+=(tz-s.z)*k;if(Math.abs(s.x)<1e-4&&Math.abs(s.z)<1e-4){s.x=0;s.z=0}}
}
function spreadHash(text){let h=2166136261;for(let i=0;i<text.length;i++){h^=text.charCodeAt(i);h=Math.imul(h,16777619)}return (h>>>0)/4294967296*Math.PI*2}
