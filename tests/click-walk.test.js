import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {WALK_SPEED,RUN_SPEED,MOUNT_SPEED,TILE,GAME_TICK,travelSpeed,isTap,dragThreshold,mapClickToWorld,flagExpired,createWalkFlag} from '../click-walk.js';
import {mapPoint} from '../minimap.js';import {searchRoute} from '../route-search.js';import {CHARACTER_SCALE} from '../character-assets.js';
import {STRIDE,createHumanoidAnimator} from '../animation.js';import {gaitPlayback} from '../gait-cadence.js';import {buildHumanoid} from '../humanoid.js';import {mountSpeed} from '../mounts.js';

test('travel pace matches RuneScape: walk 1 tile/tick, run 2, mount a modest gallop',()=>{
 assert.equal(TILE,CHARACTER_SCALE,'one tile is one metre in world units');
 const rsWalk=TILE/GAME_TICK,rsRun=2*TILE/GAME_TICK;
 assert.ok(Math.abs(WALK_SPEED-rsWalk)/rsWalk<.05,'walk '+WALK_SPEED+' vs '+rsWalk);
 assert.ok(Math.abs(RUN_SPEED-rsRun)/rsRun<.05,'run '+RUN_SPEED+' vs '+rsRun);
 assert.equal(RUN_SPEED,2*WALK_SPEED);assert.ok(MOUNT_SPEED>=1.5*RUN_SPEED&&MOUNT_SPEED<=2*RUN_SPEED);
 assert.deepEqual([travelSpeed(false,false),travelSpeed(false,true),travelSpeed(true,false),travelSpeed(true,true)],[WALK_SPEED,RUN_SPEED,MOUNT_SPEED,MOUNT_SPEED]);
 assert.equal(mountSpeed(false,true),RUN_SPEED);
 // The baked horse gallop covers 7.6 units per stride (horse-mount.js): ~1.3 strides/s.
 const strides=MOUNT_SPEED/7.6;assert.ok(strides>1&&strides<2);
});

test('walk plays the walk clip and run plays the jog clip with planted feet (no sliding)',()=>{
 const rig=buildHumanoid(T,new T.Group()),animator=createHumanoidAnimator(rig);
 let pose;for(let i=0;i<30;i++)pose=animator.update(1/60,{distance:WALK_SPEED/60,speed:WALK_SPEED,locomotion:'walk'});assert.equal(pose.gait,'Walk_Loop');
 for(let i=0;i<30;i++)pose=animator.update(1/60,{distance:RUN_SPEED/60,speed:RUN_SPEED,locomotion:'jog'});assert.equal(pose.gait,'Jog_Fwd_Loop');
 for(const [gait,speed,duration] of [['Walk_Loop',WALK_SPEED,1.333],['Jog_Fwd_Loop',RUN_SPEED,.933]]){const p=gaitPlayback(gait,speed,{stride:STRIDE[gait],duration,scale:CHARACTER_SCALE});assert.ok(Math.abs(STRIDE[gait]*p.timeScale*p.amplitude-speed)<1e-6,gait+' planted foot travels at ground speed');assert.ok(p.timeScale<=2.4)}
 animator.dispose();
});

test('a tap walks but a camera drag does not; touch gets more slack than a mouse',()=>{
 assert.ok(isTap(0,'mouse'));assert.ok(isTap(4,'mouse'));assert.ok(!isTap(6,'mouse'));
 assert.ok(isTap(9,'touch'));assert.ok(!isTap(14,'touch'));assert.ok(dragThreshold('touch')>dragThreshold('mouse'));
 assert.equal(dragThreshold(undefined),dragThreshold('mouse'));assert.ok(!isTap(NaN,'mouse'));
});

test('minimap and world-map clicks map back to the world point drawn there',()=>{
 const player={x:37,z:-12},rect={left:20,top:40,width:150,height:150};
 for(const extent of [35,90,180])for(const [x,z] of [[37,-12],[50,-20],[20,5]]){const p=mapPoint(x,z,player,Math.PI,extent,300,300);const w=mapClickToWorld(rect.left+p.x/2,rect.top+p.y/2,rect,{player,extent,width:300,height:300});assert.ok(Math.abs(w.x-x)<1e-8&&Math.abs(w.z-z)<1e-8,extent+':'+x+','+z)}
 // The world map is centred on the origin with an 840-unit extent.
 const world=mapClickToWorld(100+42,100,{left:0,top:0,width:200,height:200},{player,extent:840,width:200,height:200,world:true});assert.ok(Math.abs(world.x-176.4)<1e-8&&Math.abs(world.z)<1e-8);
 assert.equal(mapClickToWorld(5,5,rect,{player,extent:90}),null,'outside the canvas');
});

test('the red flag stays until arrival or a finished walk, not during route search',()=>{
 const flag={x:10,z:0,at:0};
 assert.equal(flagExpired(flag,{x:0,z:0},{moving:true,now:5000}),false);
 assert.equal(flagExpired(flag,{x:0,z:0},{pending:true,now:5000}),false);
 assert.equal(flagExpired(flag,{x:0,z:0},{now:500}),false,'grace before the first server reply');
 assert.equal(flagExpired(flag,{x:0,z:0},{now:5000}),true,'walk ended short of the flag');
 assert.equal(flagExpired(flag,{x:9.5,z:.2},{moving:true,now:100}),true,'arrived');
 const f=createWalkFlag(T);assert.equal(f.visible,false);f.place(1,2,3);assert.equal(f.visible,true);assert.deepEqual(f.group.position.toArray(),[1,2,3]);f.update(.1);f.hide();assert.equal(f.visible,false);f.dispose();
});

const run=gen=>{let n;do{n=gen.next()}while(!n.done);return n.value};
const segmentClear=blocked=>(a,b)=>{const n=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)*5)||1;for(let i=0;i<=n;i++){const t=i/n;if(blocked(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false}return true};

test('pathfinder routes around a wall with smoothed, collision-free waypoints',()=>{
 const canTravel=segmentClear((x,z)=>Math.abs(x)<1&&Math.abs(z)<10);const start={x:-6,z:0},goal={x:6,z:0};
 const path=run(searchRoute({start,goal,canTravel}));assert.ok(path.length>=2&&path.length<12,'smoothed: '+path.length);
 let prev=start;for(const p of path){assert.ok(canTravel(prev,p));prev=p}const end=path.at(-1);assert.ok(Math.hypot(end.x-goal.x,end.z-goal.z)<1e-9);
});

test('an unreachable or blocked target walks to the nearest reachable point',()=>{
 // Goal inside a closed 6×6 box: stop at the wall, on the near side.
 const box=(x,z)=>Math.max(Math.abs(x-10),Math.abs(z))<=3&&Math.max(Math.abs(x-10),Math.abs(z))>=2.6;const canTravel=segmentClear(box);
 const path=run(searchRoute({start:{x:-5,z:0},goal:{x:10,z:0},canTravel,maxNodes:6000}));assert.ok(path.length>0,'walks somewhere');
 const end=path.at(-1);assert.ok(Math.hypot(end.x-10,end.z)<5,'ends beside the box: '+end.x+','+end.z);
 let prev={x:-5,z:0};for(const p of path){assert.ok(canTravel(prev,p));prev=p}
});

test('pathfinding is bounded: a hopeless search ends within its node budget quickly',()=>{
 let checks=0;const canTravel=(a,b)=>{checks++;return segmentClear((x,z)=>Math.hypot(x-30,z)>2&&Math.hypot(x-30,z)<3)(a,b)};
 const started=performance.now();const path=run(searchRoute({start:{x:0,z:0},goal:{x:30,z:0},canTravel,maxNodes:3000}));
 assert.ok(performance.now()-started<3000,'took '+(performance.now()-started)+'ms');assert.ok(checks<3000*12,'edge checks '+checks);assert.ok(path.length>0);
});
