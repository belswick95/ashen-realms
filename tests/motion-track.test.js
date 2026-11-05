import test from 'node:test';import assert from 'node:assert/strict';import {createMotionTrack,projectMovement,reconcileActivePose,reconcileLocalPose,serverMotionJump} from '../motion-track.js';
test('irregular packets render a steady trajectory instead of easing after each packet',()=>{const track=createMotionTrack(),packets=Array.from({length:30},(_,i)=>({time:i*250,arrival:i*250+[70,140,40,110][i%4],x:i*.8}));let speeds=[],last=null;for(let now=0;now<6500;now+=1000/60){for(const p of packets)if(!p.done&&p.arrival<=now){track.push(p.time,{x:p.x,z:0,yaw:0},now);p.done=true}const sample=track.sample(now);if(now>1000&&sample&&last)speeds.push((sample.x-last.x)*60);last=sample}assert.ok(speeds.every(s=>Math.abs(s-3.2)<1e-6))});
test('teleports reset history and duplicate timestamps cannot rewind movement',()=>{const t=createMotionTrack();t.push(0,{x:0,z:0,yaw:0},0);t.push(250,{x:1,z:0,yaw:0},250);t.push(200,{x:-1,z:0,yaw:0},260);assert.ok(t.sample(600).x>=0);t.push(1000,{x:40,z:20,yaw:1},1000);assert.equal(t.sample(1000).x,40)});

test('delayed server poses are projected to presentation time without walking through walls or past their lease',()=>{const pose={x:0,z:0,at:0,until:1500,inputX:0,inputZ:1,speed:6.4};assert.ok(Math.abs(projectMovement(pose,500).z-3.2)<1e-9);assert.ok(Math.abs(projectMovement(pose,3000).z-9.6)<1e-9);assert.ok(projectMovement(pose,500,{canStep:(a,b)=>b.z<=1}).z<=1)});
test('steady prediction does not get dragged back to an old packet; direction changes wait for matching acknowledgements',()=>{const p={x:0,z:3.2},target={x:0,z:0,at:0,until:1500,inputX:0,inputZ:1,speed:6.4},input={x:0,z:1,moving:true};assert.equal(reconcileActivePose(p,target,input,1/60,500),false);assert.equal(p.z,3.2);assert.equal(reconcileActivePose(p,target,{x:0,z:-1,moving:true},1/60,500),false);const q={x:0,z:5};reconcileActivePose(q,target,input,1/60,500);assert.ok(q.z<5&&q.z>=5-6.4/60*.25)});
test('render-time correction performs one bounded collision sweep instead of replaying a mounted path',()=>{let sweeps=0;const p={x:0,z:10};reconcileActivePose(p,{x:0,z:0,at:0,until:1500,inputX:0,inputZ:1,speed:19.2},{x:0,z:1,moving:true},1/60,500,{canStep:()=>{sweeps++;return true}});assert.equal(sweeps,1);assert.ok(p.z<10&&p.z>9.9)});

test('late confirmations do not flash the avatar to a different position, while confirmed teleports remain explicit',()=>{const target={x:40,z:0,at:0,until:1500,inputX:1,inputZ:0,speed:19.2},input={x:1,z:0,moving:true},p={x:0,z:0};reconcileActivePose(p,target,input,1/60,500);assert.ok(p.x>0&&p.x<=19.2/60*.25);const stopped={x:0,z:0};reconcileLocalPose(stopped,target,1/60);assert.ok(stopped.x<=19.2/60*2);assert.equal(serverMotionJump({x:0,z:0,at:0,speed:19.2},{x:38,z:0,at:2000,speed:19.2}),false);assert.equal(serverMotionJump({x:0,z:0,at:0,speed:19.2},{x:100,z:0,at:100,speed:19.2}),true);reconcileLocalPose(stopped,target,1/60,{teleport:true});assert.equal(stopped.x,40)});

test('click-to-walk poses glide along the server path between snapshots and stop at its end',async()=>{
 const {projectPathPose}=await import('../motion-track.js');
 const pose={x:0,z:0,yaw:0,at:1000,speed:2.6,path:[[2,0],[2,4]]};
 const p=projectPathPose(pose,1500);assert.ok(Math.abs(p.x-1.3)<1e-9&&p.z===0&&p.moving);assert.ok(Math.abs(p.yaw-Math.PI/2)<1e-9);
 const q=projectPathPose(pose,2000);assert.ok(Math.abs(q.x-2)<1e-9&&Math.abs(q.z-.6)<1e-9&&q.yaw===0,'turns the corner');
 const end=projectPathPose(pose,4000,{maxSeconds:5});assert.deepEqual([end.x,end.z,end.moving],[2,4,false],'never overshoots');
 const stale=projectPathPose({...pose,path:[[100,0]]},99999);assert.ok(stale.x<=2.6*1.5+1e-9,'bounded extrapolation');
 assert.deepEqual(projectPathPose({...pose,path:[]},5000),{x:0,z:0,yaw:0,moving:false});
 let last=projectPathPose(pose,1000).x;for(let t=1016;t<1700;t+=16){const x=projectPathPose(pose,t).x;assert.ok(x-last>0&&x-last<2.6*.017+1e-9);last=x}
});
