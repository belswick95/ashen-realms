import test from 'node:test';import assert from 'node:assert/strict';
import {worldToMinimap,minimapToWorld,cameraHeading,compassRotation,minimapRotation,LOOK_YAW,nearestYaw,stepYaw,mapPoint} from '../minimap.js';
import {mapClickToWorld} from '../click-walk.js';

const W=180,H=180,EXTENT=90,player={x:12,z:-8},near=(a,b,eps=1e-9)=>Math.abs(a-b)<eps;
// Camera forward for the game's orbit camera (camera at focus + (sin yaw, cos yaw)·d).
const forward=yaw=>({x:-Math.sin(yaw),z:-Math.cos(yaw)});
const deg=d=>d*Math.PI/180;

test('look directions match the orbit camera: yaw 0 north (−Z), −90° east (+X), 180° south, 90° west',()=>{
 const f=d=>forward(LOOK_YAW[d]);
 assert.ok(near(f('north').x,0)&&near(f('north').z,-1));assert.ok(near(f('east').x,1)&&near(f('east').z,0));
 assert.ok(near(f('south').x,0)&&near(f('south').z,1));assert.ok(near(f('west').x,-1)&&near(f('west').z,0));
});

test('whatever the camera faces is at the top of the minimap (yaw 0, 90, 180, 270°)',()=>{
 for(const d of [0,90,180,270]){const yaw=deg(d),f=forward(yaw);
  const ahead=worldToMinimap(player.x+f.x*20,player.z+f.z*20,player,yaw,EXTENT,W,H);
  assert.ok(near(ahead.x,W/2,1e-6)&&near(ahead.y,H/2-20*W/EXTENT,1e-6),'yaw '+d+': ahead is straight up');
  // Camera right = forward turned clockwise seen from above (north-up map: north → east): (−f.z, f.x).
  const right=worldToMinimap(player.x-f.z*20,player.z+f.x*20,player,yaw,EXTENT,W,H);
  assert.ok(near(right.x,W/2+20*W/EXTENT,1e-6)&&near(right.y,H/2,1e-6),'yaw '+d+': camera right is minimap right');
 }
});

test('facing east puts things east of the player at the top and north on the left',()=>{
 const east=worldToMinimap(player.x+10,player.z,player,LOOK_YAW.east,EXTENT,W,H),north=worldToMinimap(player.x,player.z-10,player,LOOK_YAW.east,EXTENT,W,H);
 assert.ok(near(east.x,W/2)&&east.y<H/2);assert.ok(north.x<W/2&&near(north.y,H/2));
 // Facing north is exactly the old north-up map.
 const p=worldToMinimap(30,-20,player,0,EXTENT,W,H),q=mapPoint(30,-20,player,Math.PI,EXTENT,W,H);assert.ok(near(p.x,q.x)&&near(p.y,q.y));
});

test('minimap clicks invert the rotation exactly at 0, 90, 180, 270° and in between',()=>{
 for(const d of [0,90,180,270,33,-145])for(const extent of [35,90,180])for(const [x,z] of [[25,-12],[12,-8],[20,0],[4,-15]]){const yaw=deg(d);
  const p=worldToMinimap(x,z,player,yaw,extent,W,H),w=minimapToWorld(p.x,p.y,player,yaw,extent,W,H);
  assert.ok(near(w.x,x,1e-8)&&near(w.z,z,1e-8),'helper round trip yaw '+d);
  const rect={left:300,top:40,width:W*.9,height:H*.9},c=mapClickToWorld(rect.left+p.x*.9,rect.top+p.y*.9,rect,{player,extent,width:W,height:H,heading:cameraHeading(yaw)});
  assert.ok(near(c.x,x,1e-8)&&near(c.z,z,1e-8),'click round trip yaw '+d);
 }
});

test('clicks outside the round minimap are ignored when circle is set',()=>{
 const rect={left:0,top:0,width:100,height:100};
 assert.equal(mapClickToWorld(3,3,rect,{player,extent:90,width:100,height:100,circle:true}),null);
 assert.ok(mapClickToWorld(50,10,rect,{player,extent:90,width:100,height:100,circle:true}));
});

test('canvas rotation agrees with the point transform and the compass needle points north',()=>{
 for(const d of [0,90,180,270]){const yaw=deg(d),a=minimapRotation(yaw),c=Math.cos(a),s=Math.sin(a),k=W/EXTENT;
  // ctx.rotate(a) maps a north-up offset (dx,dz) to (c·dx − s·dz, s·dx + c·dz).
  const p=worldToMinimap(player.x+7,player.z-3,player,yaw,EXTENT,W,H);
  assert.ok(near(p.x,W/2+(c*7+s*3)*k)&&near(p.y,H/2+(s*7-c*3)*k));
  // CSS rotate(θ) turns an up-pointing needle to (sin θ, −cos θ): the minimap direction of north.
  const t=compassRotation(yaw),n=worldToMinimap(player.x,player.z-10,player,yaw,EXTENT,W,H),len=Math.hypot(n.x-W/2,n.y-H/2);
  assert.ok(near(Math.sin(t),(n.x-W/2)/len)&&near(-Math.cos(t),(n.y-H/2)/len),'needle at yaw '+d);
 }
 assert.ok(near(compassRotation(LOOK_YAW.east),-Math.PI/2),'facing east the needle points left');
});

test('compass snaps turn the short way and settle exactly',()=>{
 assert.ok(near(nearestYaw(Math.PI*2+.3,0),Math.PI*2));assert.ok(near(nearestYaw(-.2,0),0));assert.ok(near(nearestYaw(3,LOOK_YAW.south),Math.PI));
 let yaw=2.5;const target=nearestYaw(yaw,0);for(let i=0;i<200&&yaw!==target;i++)yaw=stepYaw(yaw,target,1/60);assert.equal(yaw,target);
});
