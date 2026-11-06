import {animateWork,createWorkKit,workFacing} from './npc-activities.js?v=release-20261106-amb102';
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
