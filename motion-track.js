// Timestamped presentation buffer: no position authority or damage is decided here.
export function createMotionTrack({delay=350}={}){let frames=[],epoch=null,lastTime=-Infinity;return {push(time,pose,now=performance.now()){if(!Number.isFinite(time))return;if(epoch===null)epoch={server:time,local:now};const prev=frames.at(-1);if(prev&&Math.hypot(pose.x-prev.x,pose.z-prev.z)>12){frames=[];epoch={server:time,local:now};lastTime=-Infinity}if(prev&&time<=prev.time)return;frames.push({...pose,time});if(frames.length>32)frames.shift()},sample(now=performance.now()){if(!frames.length)return null;const t=Math.max(lastTime,epoch.server+now-epoch.local-delay);lastTime=t;while(frames.length>2&&frames[1].time<t)frames.shift();const a=frames[0],b=frames[1];if(!b||t<=a.time)return {...a};const f=Math.max(0,Math.min(1,(t-a.time)/(b.time-a.time)));const yaw=a.yaw+Math.atan2(Math.sin(b.yaw-a.yaw),Math.cos(b.yaw-a.yaw))*f;return {...b,x:a.x+(b.x-a.x)*f,z:a.z+(b.z-a.z)*f,yaw}},clear(){frames=[];epoch=null;lastTime=-Infinity}}}

// The owning client predicts input immediately. Only reconcile the latest final
// acknowledgement after its input queue drains; remote interpolation is delayed.
export function reconcileLocalPose(position,target,dt,{active=false,pending=false}={}){
 if(active||pending||!target)return false;
 const error=Math.hypot(position.x-target.x,position.z-target.z),weight=error>12?1:1-Math.exp(-18*Math.max(0,Math.min(.1,dt)));
 position.x+=(target.x-position.x)*weight;position.z+=(target.z-position.z)*weight;return true;
}
