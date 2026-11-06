import test from 'node:test';import {readFileSync} from 'node:fs';import assert from 'node:assert/strict';import * as T from 'three';
import {WALK_SPEED,RUN_SPEED,MOUNT_SPEED,TILE,GAME_TICK,travelSpeed,isTap,dragThreshold,mapClickToWorld,flagExpired,showClickCross,crossFrame,crossColor,CROSS_TIME,approachPoint,withinReach,arrivalStatus} from '../click-walk.js';
import {mapPoint} from '../minimap.js';import {searchRoute} from '../route-search.js';import {CHARACTER_SCALE} from '../character-assets.js';
import {createHumanoidAnimator} from '../animation.js';import {stepLength,cadence} from '../stride-cycle.js';import {buildHumanoid} from '../humanoid.js';import {mountSpeed} from '../mounts.js';

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

test('walk reports the walk gait and run the jog gait, with strides matched to the ground speed',()=>{
 const rig=buildHumanoid(T,new T.Group()),animator=createHumanoidAnimator(rig);
 let pose;for(let i=0;i<30;i++)pose=animator.update(1/60,{distance:WALK_SPEED/60,speed:WALK_SPEED,locomotion:'walk'});assert.equal(pose.gait,'Walk_Loop');
 for(let i=0;i<30;i++)pose=animator.update(1/60,{distance:RUN_SPEED/60,speed:RUN_SPEED,locomotion:'jog'});assert.equal(pose.gait,'Jog_Fwd_Loop');
 for(const [run,speed] of [[0,WALK_SPEED],[1,RUN_SPEED]]){assert.ok(Math.abs(stepLength(run,speed)*cadence(run,speed)-speed)<1e-9,'steps cover exactly the ground travelled');assert.ok(cadence(run,speed)<4,'no frantic stepping')}
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

test('clicks flash a brief on-screen cross at the pointer: yellow to walk, red to interact',()=>{
 let last=crossFrame(0);assert.equal(last.done,false);assert.equal(last.opacity,1);
 for(let age=.05;age<CROSS_TIME;age+=.05){const f=crossFrame(age);assert.ok(f.scale<last.scale,'shrinks');assert.ok(f.opacity<=last.opacity,'fades');last=f}
 assert.ok(CROSS_TIME>=.4&&CROSS_TIME<=.5);assert.equal(crossFrame(CROSS_TIME).done,true);
 const hex=c=>[1,3,5].map(i=>parseInt(c.slice(i,i+2),16));const [yr,yg,yb]=hex(crossColor('walk')),[rr,rg,rb]=hex(crossColor('interact'));
 assert.ok(yr>200&&yg>180&&yb<120,'yellow walk');assert.ok(rr>200&&rg<80&&rb<80,'red interact');
 // A tiny DOM stand-in: the cross is a fixed-position overlay at the click point and removes itself.
 const made=[];const doc={createElement(){const el={className:'',style:{},setAttribute(){},removed:false,remove(){this.removed=true},innerHTML:''};made.push(el);return el}};
 const parent={append(){}};let clock=0;const frames=[];
 const el=showClickCross(120,80,'interact',{doc,parent,now:()=>clock,frame:f=>frames.push(f)});
 assert.match(el.style.cssText,/position:fixed;left:120px;top:80px/);assert.match(el.style.cssText,/pointer-events:none/);assert.match(el.innerHTML,/#ff2a1f/);assert.match(el.className,/interact/);
 while(frames.length&&!el.removed){clock+=16;frames.shift()()}assert.ok(el.removed,'gone after the animation');assert.ok(clock>=400&&clock<=520);
 assert.equal(showClickCross(NaN,1,'walk',{doc,parent}),null);
});

test('click-to-interact walks into reach, acts only after stopping, and a newer click cancels it',()=>{
 const tree={x:10,z:0},from={x:0,z:0};const stand=approachPoint(from,tree,3);
 assert.ok(withinReach(stand,tree,3),'the approach spot is within reach');assert.ok(stand.x<tree.x,'on the walker side');
 assert.deepEqual(approachPoint({x:9,z:0},tree,3),{x:9,z:0},'already close: stay put');
 const pending={...tree,reach:3,generation:4,startedAt:0};
 assert.equal(arrivalStatus(pending,from,{routing:true,generation:4,now:100}),'walking');
 assert.equal(arrivalStatus(pending,from,{generation:4,now:500}),'waiting','the first reply may not show the walk yet');
 assert.equal(arrivalStatus(pending,{x:5,z:0},{moving:true,generation:4,now:3000}),'walking');
 assert.equal(arrivalStatus(pending,{x:8,z:0},{moving:false,generation:4,now:3100}),'arrived');
 assert.equal(arrivalStatus(pending,{x:2,z:0},{moving:false,generation:4,now:3500}),'waiting');
 assert.equal(arrivalStatus(pending,{x:2,z:0},{moving:false,generation:4,now:5000}),'failed','stopped out of reach');
 assert.equal(arrivalStatus(pending,{x:8,z:0},{generation:5,now:3100}),'cancelled');
 assert.equal(arrivalStatus(null,from),'none');
 // QA (hud115, tile mode): the tutorial pond's fishing spot is 2.8 units from the nearest free tile and
 // fishing reach is 2.6, so clicking the ripples stopped one tile short and said "You can't reach that".
 // With a tile of slack the action is sent and the server applies its own reach (3.6 for fishing).
 const pond={x:-373,z:-343.5,reach:2.6,generation:1,startedAt:0},parked={x:-371.3,z:-341.28};
 assert.equal(arrivalStatus(pond,parked,{generation:1,now:5000}),'failed');
 assert.equal(arrivalStatus(pond,parked,{generation:1,now:5000,slack:TILE}),'arrived');
 assert.equal(arrivalStatus(pond,{x:-366,z:-336},{generation:1,now:5000,slack:TILE}),'failed','slack is one tile, not unlimited');
 assert.equal(arrivalStatus(pond,parked,{moving:true,generation:1,now:5000,slack:TILE}),'walking');
 const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(game,/slack:window\.eldervaleTileMode&&!pendingArrival\.follow\?TILE:0/);
});

test('fences block routes (client and the server patch agree), so walks go round to the paddock gap',async()=>{
 const {createObstacleIndex,campObstacleSizes}=await import('../navigation-obstacles.js');const fs=await import('node:fs');
 const sql=fs.readFileSync(new URL('../db/fence-collision.sql',import.meta.url),'utf8');assert.match(sql,/"fence":\[0\.85,0\.12\]/);assert.deepEqual(campObstacleSizes.fence,[.85,.12]);
 // The Birchford cow pen: seeded fences (yaw in radians, scaleX 1.3) with one panel missing on the east side.
 const fences=[];const add=(x,z,yaw)=>fences.push({template:'fence',x,z,yaw,scale:1,scaleX:1.3,scaleZ:1.3});
 for(const x of [-284,-282,-280,-278]){add(x,131.5,0);add(x,139.5,-Math.PI)}
 for(const z of [132.5,134.5,136.5,138.5])add(-285,z,Math.PI/2);for(const z of [132.5,136.5,138.5])add(-277,z,-Math.PI/2);
 const index=createObstacleIndex(fences);const canTravel=segmentClear((x,z)=>index.blocked(x,z));
 assert.ok(index.blocked(-280,139.5)&&index.blocked(-277,133)&&!index.blocked(-277,134.5),'panels block, the gap does not');
 const start={x:-281,z:143},goal={x:-281,z:135};assert.ok(!canTravel(start,goal),'straight line crosses the fence');
 const path=run(searchRoute({start,goal,canTravel,maxNodes:20000}));const end=path.at(-1);assert.ok(Math.hypot(end.x-goal.x,end.z-goal.z)<.5,'reaches the inside');
 let prev=start;for(const p of path){assert.ok(canTravel(prev,p));prev=p}assert.ok(path.some(p=>p.x>-277.5),'goes round through the east gap');
});
