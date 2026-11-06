import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {TILE,GAME_TICK,FLAG,tileOf,tileCenter,canMove,bfsRoute,projectTilePose,faceYaw,ticksFor,snapToTile} from '../tile-grid.js';
import {WALK_SPEED,RUN_SPEED} from '../click-walk.js';

// A grid from a list of [i,j,flags].
const grid=list=>{const m=new Map(list.map(([i,j,f])=>[i+','+j,f]));return (i,j)=>m.get(i+','+j)||0};
const tiles=r=>r.path.map(([x,z])=>[Math.round(x/TILE),Math.round(z/TILE)]);
const route=(flagsAt,start,goal,extra={})=>bfsRoute({start,goal,flagsAt,...extra});

test('tile size is one character-width and keeps the live walk/run pace',()=>{
 assert.equal(TILE,1.58);assert.equal(GAME_TICK,.6);
 assert.ok(Math.abs(TILE/GAME_TICK-WALK_SPEED)/WALK_SPEED<.02,'walk 1 tile per tick');
 assert.ok(Math.abs(2*TILE/GAME_TICK-RUN_SPEED)/RUN_SPEED<.02,'run 2 tiles per tick');
 assert.equal(tileOf(0),0);assert.equal(tileOf(.78),0);assert.equal(tileOf(.8),1);assert.equal(tileOf(-.8),-1);
 assert.equal(tileCenter(3),4.74);assert.deepEqual(snapToTile({x:5,z:-5}),{x:4.74,z:-4.74});
});

test('moves: blocked tiles, edge walls and no corner cutting (OSRS)',()=>{
 const open=grid([]);for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[1,-1],[-1,1]])assert.ok(canMove(open,0,0,di,dj));
 assert.equal(canMove(open,0,0,2,0),false,'one tile per step');
 assert.equal(canMove(grid([[1,0,FLAG.BLOCK]]),0,0,1,0),false,'blocked target');
 assert.equal(canMove(grid([[0,0,FLAG.E]]),0,0,1,0),false,'wall on the east edge');
 assert.equal(canMove(grid([[0,0,FLAG.E]]),1,0,-1,0),false,'same wall from the other side');
 assert.equal(canMove(grid([[0,0,FLAG.N]]),0,1,0,-1),false,'wall on the north edge, walking south');
 assert.equal(canMove(grid([[1,0,FLAG.BLOCK]]),0,0,1,1),false,'diagonal past a blocked neighbour');
 assert.equal(canMove(grid([[0,0,FLAG.E]]),0,0,1,1),false,'diagonal past a wall on the east edge');
 assert.equal(canMove(grid([[0,0,FLAG.NE]]),0,0,1,1),false,'diagonal edge');
 assert.equal(canMove(grid([[0,0,FLAG.NE]]),1,1,-1,-1),false,'diagonal edge both ways');
 assert.equal(canMove(grid([[1,-1,FLAG.NW]]),0,0,1,-1),false,'SE uses the NW edge of the target column');
 assert.equal(canMove(grid([[0,0,FLAG.NW]]),0,0,-1,1),false,'NW edge');
});

test('BFS: spec vectors (straight walk, corner rule, W-first ties, 21x21 fallback, reach)',()=>{
 assert.deepEqual(tiles(route(grid([]),[0,0],[5,0])),[[1,0],[2,0],[3,0],[4,0],[5,0]]);
 assert.deepEqual(tiles(route(grid([[1,0,FLAG.BLOCK]]),[0,0],[1,1])),[[0,1],[1,1]]);
 assert.deepEqual(tiles(route(grid([[0,0,FLAG.E]]),[0,0],[1,1])),[[0,1],[1,1]]);
 assert.deepEqual(tiles(route(grid([]),[5,5],[5,5],{mode:'card'})),[[4,5]],'W first');
 const pen=[];for(let k=8;k<=12;k++)pen.push([k,8,1],[k,12,1],[8,k,1],[12,k,1]);
 const r=route(grid(pen),[0,0],[10,10]);assert.equal(r.reached,false);assert.ok(['10,7','7,10'].includes(String(tiles(r).at(-1))));
 assert.deepEqual(route(grid(pen),[0,0],[10,10],{alt:1}).path,[],'nothing within the fallback square: stay');
 const melee=tiles(route(grid([]),[4,4],[5,5],{mode:'card'}));assert.equal(melee.length,1);assert.equal(Math.abs(melee[0][0]-5)+Math.abs(melee[0][1]-5),1,'melee/talk from an orthogonal tile');
 assert.deepEqual(tiles(route(grid([]),[0,0],[6,0],{mode:'near',reach:1.6,point:[6*TILE,0]})).at(-1),[5,0],'object reach stops beside it');
 assert.deepEqual(route(grid([]),[3,3],[3,3]).path,[],'already there');
});

test('tile walker interpolation is smooth and tick-paced, diagonals included',()=>{
 const pose={x:0,z:0,yaw:0,at:1000,stepTiles:1,path:[[TILE,0],[2*TILE,TILE],[2*TILE,2*TILE]]};
 let last=null;for(let t=1000;t<=1000+3*600;t+=50){const p=projectTilePose(pose,t);if(last)assert.ok(Math.hypot(p.x-last.x,p.z-last.z)<=TILE*Math.SQRT2*50/600+1e-9,'no jumps');last=p}
 assert.deepEqual([projectTilePose(pose,1300).x,projectTilePose(pose,1300).z],[TILE/2,0]);
 const diag=projectTilePose(pose,1900);assert.ok(Math.abs(diag.x-1.5*TILE)<1e-9&&Math.abs(diag.z-.5*TILE)<1e-9,'a diagonal tile also takes one tick');
 const end=projectTilePose(pose,1000+5*600);assert.deepEqual([end.x,end.z,end.moving],[2*TILE,2*TILE,false]);
 assert.ok(Math.abs(projectTilePose({...pose,stepTiles:2},1300).x-TILE)<1e-9,'running crosses two tiles per tick');
 assert.equal(projectTilePose(pose,1300).yaw,Math.atan2(1,0),'faces the direction of travel');
});

test('facing and tick helpers',()=>{
 assert.equal(faceYaw({x:0,z:0},{x:0,z:5}),0);assert.equal(faceYaw({x:0,z:0},{x:5,z:0}),Math.PI/2);assert.equal(faceYaw({x:1,z:1},{x:1,z:1},.7),.7);
 assert.deepEqual([ticksFor(1.8),ticksFor(2.25),ticksFor(2.7),ticksFor(.1)],[3,4,5,1]);
});

test('tick/tile SQL files: rules of the repo (no approval-prompt words, one transaction, lock timeout)',()=>{
 const files=fs.readdirSync(new URL('../db/',import.meta.url)).filter(f=>/^tick-tile-engine-\d.*\.sql$/.test(f));
 assert.ok(files.length>=1);
 for(const f of files){const sql=fs.readFileSync(new URL('../db/'+f,import.meta.url),'utf8');
  for(const word of ['delete','alter','drop'])assert.ok(!new RegExp('\\b'+word+'\\b','i').test(sql),f+' avoids '+word);
  assert.match(sql,/^begin;\nset local lock_timeout='5s';/m,f);assert.match(sql,/commit;\s*$/,f);}
 const grid=fs.readFileSync(new URL('../db/tick-tile-engine-1-grid.sql',import.meta.url),'utf8');
 assert.match(grid,/'tile_mode',false/,'tile mode starts off: applying changes no gameplay');
 assert.match(grid,/\(c\.src is null and s\.live\)/,'removed sources are rebuilt once');
});

test('remote tile walkers: tick-stamped samples glide, a repeated tick only turns the actor',async()=>{
 const {createMotionTrack,presentPose}=await import('../motion-track.js');
 const track=createMotionTrack({delay:600});const now0=10000;
 track.pushTile(4200,{x:0,z:0,yaw:0,moving:false},now0,4200);
 track.pushTile(4200,{x:0,z:0,yaw:1.2,moving:false},now0+100,4300);assert.equal(track.sample(now0+700).yaw,1.2,'facing updated without a new tick');
 track.pushTile(9000,{x:TILE,z:0,yaw:Math.PI/2,moving:true},now0+200,9100);
 // After a pause the walk starts from the old tile one tick earlier, not from 4.2 s ago.
 const mid=track.sample(now0+600+(9000-4200)-300);assert.ok(mid.x>0&&mid.x<TILE,'gliding into the first tile: '+mid.x);
 const tilePose={tile:true,x:0,z:0,yaw:0,at:0,stepTiles:1,path:[[TILE,0]]};assert.equal(presentPose(tilePose,300).x,TILE/2,'local tile walker presented per tick');
 assert.equal(presentPose({x:0,z:0,yaw:0,at:0,speed:2,path:[[10,0]]},500).x,1,'free walker unchanged');
});

test('console: engine settings form validation and overlay drawing',async()=>{
 const {engineSettings,engineSummary,ENGINE_TOGGLES,ENGINE_NUMBERS}=await import('../admin-engine.js');
 assert.deepEqual(engineSettings({tile_mode:true,path_radius:'24',tick_driver:'loop'}),{tile_mode:true,path_radius:24,tick_driver:'loop'});
 assert.throws(()=>engineSettings({path_radius:'500'}),/8 to 64/);assert.throws(()=>engineSettings({tick_driver:'warp'}),/tick driver/);
 assert.ok(ENGINE_TOGGLES.some(([k])=>k==='tile_mode')&&ENGINE_NUMBERS.length===5);
 assert.match(engineSummary({config:{tile_mode:true},tiles:{rows:10,blocked:4,doors:1},sources:3}),/ON.*10 grid tiles \(4 blocked, 1 at doors\) from 3/);
 const {overlaySegments,OVERLAY_COLORS}=await import('../tile-overlay.js');
 const segs=overlaySegments({center:[0,0],tiles:[[1,0,FLAG.BLOCK|FLAG.OBJECT,0],[2,0,FLAG.E,0],[3,0,0,FLAG.N]]},{radius:2});
 assert.equal(segs.filter(s=>s.color===OVERLAY_COLORS.grid).length,12,'grid lines');
 assert.equal(segs.filter(s=>s.color===OVERLAY_COLORS.block).length,2,'blocked tile cross');
 assert.equal(segs.filter(s=>s.color===OVERLAY_COLORS.edge).length,1,'wall edge');
 assert.equal(segs.filter(s=>s.color===OVERLAY_COLORS.door).length,1,'door edge, open or shut');
});
