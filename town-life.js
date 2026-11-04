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
const activityStates=new WeakMap();
export function animateTownActivity(rig,kind,time,moving=false){
 if(!kind)return;
 let state=activityStates.get(rig);if(!state){state={time,weight:0,before:[]};activityStates.set(rig,state)}const dt=Math.max(0,Math.min(.1,time-state.time));state.time=time;state.weight+=((moving?0:1)-state.weight)*(1-Math.exp(-7*dt));
 const joints=[rig.leftArm,rig.rightArm,rig.leftElbow,rig.rightElbow,rig.leftHand,rig.rightHand,rig.head,rig.torso],before=joints.map((j,i)=>{state.before[i]??=j.quaternion.clone();return state.before[i].copy(j.quaternion)});
 const beat=Math.sin(time*(kind==='smith'?4.8:1.8));
 if(kind==='carry'||kind==='read'){
  rig.leftArm.rotation.x=rig.rightArm.rotation.x=-.28;
  rig.leftElbow.rotation.x=rig.rightElbow.rotation.x=-1.05;
  if(rig.solveArm){const V=rig.root.position.constructor;for(const [side,sign] of [['left',1],['right',-1]])rig.solveArm(side,new V(sign*(kind==='carry'?.275:.19),kind==='carry'?1.63:1.71,.40),new V(0,1,0),new V(0,0,1));}
  if(kind==='read'&&!moving)rig.head.rotation.x=.12;
 }else{
  if(kind==='smith'){rig.rightArm.rotation.x=-.7-beat*.4;rig.rightElbow.rotation.x=-.7;rig.leftArm.rotation.x=-.3;rig.leftElbow.rotation.x=-.8}
  else if(kind==='sweep'||kind==='garden'){rig.rightArm.rotation.x=-.35+beat*.19;rig.leftArm.rotation.x=-.28+beat*.13;rig.rightElbow.rotation.x=-.55;rig.leftElbow.rotation.x=-.8;rig.torso.rotation.x=.045+beat*.025}
  else if(kind==='read'){rig.leftArm.rotation.x=rig.rightArm.rotation.x=-.25;rig.leftElbow.rotation.x=rig.rightElbow.rotation.x=-1.1;rig.head.rotation.x=.12}
  else{rig.rightArm.rotation.x=-.3+beat*.08;rig.rightElbow.rotation.x=-.65-beat*.15;rig.head.rotation.y=beat*.10}
 }
 const weight=kind==='carry'||kind==='read'?1:state.weight;for(let i=0;i<joints.length;i++)joints[i].quaternion.copy(before[i].slerp(joints[i].quaternion,weight));
}
