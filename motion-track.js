import {slideStep} from './movement-collision.js?v=release-20261104-anatomy52';
// Timestamped presentation buffer: no position authority or damage is decided here.
export function createMotionTrack({delay=350}={}){let frames=[],epoch=null,lastTime=-Infinity;return {push(time,pose,now=performance.now()){if(!Number.isFinite(time))return;if(epoch===null)epoch={server:time,local:now};const prev=frames.at(-1);if(prev&&Math.hypot(pose.x-prev.x,pose.z-prev.z)>12){frames=[];epoch={server:time,local:now};lastTime=-Infinity}if(prev&&time<=prev.time)return;frames.push({...pose,time});if(frames.length>32)frames.shift()},sample(now=performance.now()){if(!frames.length)return null;const t=Math.max(lastTime,epoch.server+now-epoch.local-delay);lastTime=t;while(frames.length>2&&frames[1].time<t)frames.shift();const a=frames[0],b=frames[1];if(!b||t<=a.time)return {...a};const f=Math.max(0,Math.min(1,(t-a.time)/(b.time-a.time)));const yaw=a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*f;return {...b,x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,yaw}},clear(){frames=[];epoch=null;lastTime=-Infinity}}}

// The owning client predicts input immediately. Only reconcile the latest final
// acknowledgement after its input queue drains; remote interpolation is delayed.
export function reconcileLocalPose(position,target,dt,{active=false,pending=false,teleport=false}={}){
 if(active||pending||!target)return false;
 if(teleport){position.x=target.x;position.z=target.z;return true;}
 const elapsed=Math.max(0,Math.min(.1,dt)),error=Math.hypot(position.x-target.x,position.z-target.z),weight=Math.min(1-Math.exp(-18*elapsed),(target.speed||6.4)*2*elapsed/Math.max(error,.000001));
 position.x+=(target.x-position.x)*weight;position.z+=(target.z-position.z)*weight;return true;
}

// A large render error can result from latency. Only a discontinuity between
// confirmed server samples is evidence of an actual teleport/respawn.
export function serverMotionJump(previous,next){
 if(!previous)return true;
 const seconds=Math.max(0,(next.at-previous.at)/1000),speed=Math.max(previous.speed||19.2,next.speed||19.2);
 return Math.hypot(next.x-previous.x,next.z-previous.z)>Math.max(8,speed*seconds+3);
}

// Compare prediction with a server pose advanced to presentation time, rather
// than pulling a moving player back to a position from an older packet.
export function projectMovement(target,now,{canStep}={}){
 const p={...target},seconds=Math.max(0,Math.min(1.5,(Math.min(now,target.until)-target.at)/1000));
 if(!Number.isFinite(seconds)||!Number.isFinite(target.speed)||!seconds)return p;
 const dx=(target.inputX||0)*target.speed*seconds,dz=(target.inputZ||0)*target.speed*seconds,n=Math.max(1,Math.ceil(Math.hypot(dx,dz)/.15));
 if(!canStep){p.x+=dx;p.z+=dz;return p;}
 for(let i=0;i<n;i++){const q=slideStep(p,{...p,x:p.x+dx/n,z:p.z+dz/n},canStep);p.x=q.x;p.z=q.z;}
 return p;
}
export function reconcileActivePose(position,target,input,dt,now,options){
 if(!target||!input?.moving||Math.hypot(input.x-(target.inputX||0),input.z-(target.inputZ||0))>.15||!(target.until>target.at))return false;
 // Sweep the small correction, rather than replaying the whole acknowledged
 // path through collision tests every render frame.
 const p=projectMovement(target,now),dx=p.x-position.x,dz=p.z-position.z,error=Math.hypot(dx,dz);
 if(error<.2)return false;
 const weight=Math.min(1-Math.exp(-4*dt),target.speed*Math.max(0,dt)*.25/error);
 const next={...position,x:position.x+dx*weight,z:position.z+dz*weight};
 if(options?.canStep&&!options.canStep(position,next))return false;
 position.x=next.x;position.z=next.z;return true;
}
