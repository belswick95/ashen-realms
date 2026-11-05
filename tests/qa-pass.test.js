import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {buildHumanoid} from '../humanoid.js';import {createCape} from '../cape.js';
import {reconcileLocalPose} from '../motion-track.js';
import {dialogueLines} from '../npc-options.js';
import {searchRoute,octile} from '../route-search.js';

test('a leaning spine does not fling the cape hem out like a board',()=>{
 const body=new T.Group(),rig=buildHumanoid(T,body),cape=createCape(T,body,{rig});
 rig.base.parent.rotation.x+=.5;body.updateMatrixWorld(true);cape.update(1/60,0);
 const p=cape.mesh.geometry.attributes.position;let minY=Infinity,minZ=Infinity;
 for(let i=0;i<p.count;i++){minY=Math.min(minY,p.getY(i));minZ=Math.min(minZ,p.getZ(i))}
 assert.ok(minY<.75,'hem still hangs low: '+minY);assert.ok(minZ>-1.15,'hem stays near the legs: '+minZ);
});

test('a slow renderer keeps pace with the server walker instead of trailing further every frame',()=>{
 const p={x:0,z:0},speed=2.6;let server=0;
 for(let f=0;f<20;f++){server+=speed;reconcileLocalPose(p,{x:server,z:0,speed},1)}
 assert.ok(server-p.x<speed*1.5,'lag '+(server-p.x));
});

test('dialogue rows split on real and literal backslash-n',()=>{
 assert.deepEqual(dialogueLines('Welcome!\\nTools, gear.'),['Welcome!','Tools, gear.']);
 assert.deepEqual(dialogueLines('a\nb\r\n\nc'),['a','b','c']);assert.deepEqual(dialogueLines(null),[]);
});

test('route search tests each grid edge once and uses a tight octile heuristic',()=>{
 assert.equal(octile(3,4),4+(Math.SQRT2-1)*3);
 const seen=new Set();let dup=0;
 // A wall along x=0 with one gap near z=15.
 const canTravel=(a,b)=>{const k=[a.x,a.z,b.x,b.z].map(v=>v.toFixed(3));const key=[k.slice(0,2).join(),k.slice(2).join()].sort().join('|');if(seen.has(key))dup++;seen.add(key);
  if(Math.sign(a.x)!==Math.sign(b.x)||a.x===0||b.x===0){const z=(a.z+b.z)/2;return Math.abs(z-15)<1.5||Math.abs(z)>=20}return true};
 const run=g=>{let n;do{n=g.next()}while(!n.done);return n.value};
 const path=run(searchRoute({start:{x:-10.5,z:0},goal:{x:10.5,z:0},canTravel}));
 assert.ok(path.length>0);const end=path.at(-1);assert.ok(Math.hypot(end.x-10.5,end.z)<1e-9);
 assert.ok(path.some(p=>Math.abs(p.z-15)<3),'goes through the gap');
 const gridDup=dup;assert.ok(gridDup<seen.size*.2,'few repeated tests: '+gridDup+'/'+seen.size);
});

test('a goal across a river walks round by the distant bridge instead of giving up',()=>{
 // River along z=0 (|z|<3) except a bridge at x in [120,126]; the goal is just across.
 const walk=(x,z)=>Math.abs(z)>=3||(x>=120&&x<=126);
 const canTravel=(a,b)=>{const n=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)*5)||1;for(let i=0;i<=n;i++){const t=i/n;if(!walk(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false}return true};
 const run=g=>{let n;do{n=g.next()}while(!n.done);return n.value};
 const start={x:0,z:8},goal={x:2,z:-8};
 const near=run(searchRoute({start,goal,canTravel,maxNodes:4000}));
 assert.ok(near.length===0||Math.hypot(near.at(-1).x-goal.x,near.at(-1).z-goal.z)>5,'fine search alone cannot cross');
 const path=run(searchRoute({start,goal,canTravel,maxNodes:4000,coarseWalk:walk}));
 const end=path.at(-1);assert.ok(Math.hypot(end.x-goal.x,end.z-goal.z)<1e-6,'reaches the far bank');
 assert.ok(path.some(p=>p.x>=118&&p.x<=128&&Math.abs(p.z)<4),'crosses at the bridge');
});

test('a fishing spot in the river: route to the bank beside it, not a detour when the near bank is as close',()=>{
 const walk=(x,z)=>Math.abs(z)>=3||(x>=120&&x<=126);
 const canTravel=(a,b)=>{const n=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)*5)||1;for(let i=0;i<=n;i++){const t=i/n;if(!walk(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false}return true};
 const run=g=>{let n;do{n=g.next()}while(!n.done);return n.value};
 const far=run(searchRoute({start:{x:0,z:8},goal:{x:2,z:-2.4},canTravel,maxNodes:4000,coarseWalk:walk}));
 assert.ok(far.at(-1).z<=-3&&Math.hypot(far.at(-1).x-2,far.at(-1).z+2.4)<3,'south bank beside the spot: '+JSON.stringify(far.at(-1)));
 const mid=run(searchRoute({start:{x:0,z:8},goal:{x:2,z:0},canTravel,maxNodes:4000,coarseWalk:walk}));
 assert.ok(mid.at(-1).z>=3&&mid.length<6,'mid-river spot is fished from the near bank');
});

test('menus: actors beat scenery under the cursor, and Walk here sits before Examine',async()=>{
 const {actorsFirst,withWalkHere}=await import('../click-walk.js');
 const h=k=>({object:{userData:{kind:k}}});
 assert.deepEqual(actorsFirst([h('tree'),h('creature'),h('worldObject')]).map(x=>x.object.userData.kind),['creature','tree','worldObject']);
 assert.deepEqual(actorsFirst([h('npc'),h('tree')]).map(x=>x.object.userData.kind),['npc','tree']);
 const walk=['Walk here',()=>{}];
 assert.deepEqual(withWalkHere([['Chop down tree'],['Examine tree'],['Cancel']],walk).map(c=>c[0]),['Chop down tree','Walk here','Examine tree','Cancel']);
 assert.deepEqual(withWalkHere([['Walk here'],['Cancel']],walk).map(c=>c[0]),['Walk here','Cancel']);
 assert.deepEqual(withWalkHere([['Net'],['Cancel']],null).map(c=>c[0]),['Net','Cancel']);
});

test('a walker standing in a pen gateway (nearest grid point inside the fence) still finds the way in',()=>{
 // Pen fence along x=-277 except a gap for z in (126.45,128.05); the walker stands at the gap edge.
 const blocked=(x,z)=>Math.abs(x+277)<.32&&!(z>126.45&&z<128.05);
 const canTravel=(a,b)=>{const n=Math.ceil(Math.hypot(a.x-b.x,a.z-b.z)/.1)||1;for(let i=0;i<=n;i++){const t=i/n;if(blocked(a.x+(b.x-a.x)*t,a.z+(b.z-a.z)*t))return false}return true};
 const run=g=>{let n;do{n=g.next()}while(!n.done);return n.value};
 const start={x:-276.567,z:126.268},goal={x:-279.997,z:127.721};
 const path=run(searchRoute({start,goal,canTravel}));
 assert.ok(path.length>0,'found a route');assert.ok(Math.hypot(path.at(-1).x-goal.x,path.at(-1).z-goal.z)<1e-6);
 let prev=start;for(const p of path){assert.ok(canTravel(prev,p),'segment clear');prev=p}
});
