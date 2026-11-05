import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {createLandscape,landscapeGeometry} from '../landscape.js';
import {oakcrossBuildings,decorateTownBuilding} from '../town.js';
import {stabilizeSun} from '../sun-shadow.js';
import {buildHumanoid} from '../humanoid.js';
import {createTalkingPose} from '../dialogue-portrait.js';

test('rotated building plots flatten rendered triangles across their full footprint and lift actor footing to the floor',()=>{
 const land=createLandscape(),rotation=.61,sx=2.8,sz=2.1,x=-297,z=-283;
 const level=land.levelBuildingPlot({x,z,scaleX:sx,scaleZ:sz,rotation,floorHeight:.23});
 const ground=new T.Mesh(landscapeGeometry(T,land),new T.MeshBasicMaterial({side:T.DoubleSide}));ground.updateMatrixWorld();
 for(let ix=-4;ix<=4;ix++)for(let iz=-4;iz<=4;iz++){
  const lx=ix/4*2*sx,lz=iz/4*1.85*sz,wx=x+lx*Math.cos(rotation)+lz*Math.sin(rotation),wz=z-lx*Math.sin(rotation)+lz*Math.cos(rotation);
  const hit=new T.Raycaster(new T.Vector3(wx,200,wz),new T.Vector3(0,-1,0)).intersectObject(ground)[0];
  assert.ok(Math.abs(hit.point.y-level)<1e-4,'grass must not cut through the wall at a corner');
  assert.ok(Math.abs(land.heightAt(wx,wz)-level)<1e-4);
 }
 assert.ok(Math.abs(land.walkHeight(x,z)-(level+.23))<1e-6);
 ground.geometry.dispose();ground.material.dispose();
});

test('town landmarks have different sizes and complete finite interior geometry',()=>{
 assert.ok(oakcrossBuildings.length>=13);
 for(const type of ['bank','hall','inn','chapel','forge','armory','home'])assert.ok(oakcrossBuildings.some(b=>b.type===type));
 const material=new T.MeshLambertMaterial();
 for(const b of oakcrossBuildings){
  const record={type:b.type,group:new T.Group(),roofParts:[]};
  decorateTownBuilding(T,record,{material:()=>material,box:(w,h,d,c,x,y,z,parent)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),material);m.position.set(x,y,z);parent.add(m);return m}});
  record.group.traverse(n=>assert.ok([...n.position,...n.scale].every(Number.isFinite)));
  assert.ok(new T.Box3().setFromObject(record.group).isEmpty()===false||b.type==='armory');
 }
});

test('portrait animates a separate copy of the real speaker without cloning circular hit metadata or moving the world head',()=>{
 const npc=new T.Group(),rig=buildHumanoid(T,npc,{skin:'#67402f',hair:'Long'});
 const hit=new T.Mesh();hit.userData={kind:'npc',root:npc};npc.add(hit);
 const sourceHead=rig.head,rest=sourceHead.quaternion.clone();
 const pose=createTalkingPose(T,npc),copyHead=pose.model.getObjectByName('Head');
 assert.ok(copyHead&&copyHead!==sourceHead);assert.equal(pose.model.children.length,npc.children.length-1,'hit proxy is not cloned');
 const copies=[];pose.model.traverse(o=>{if(o.isSkinnedMesh)copies.push(o)});assert.equal(copies.length,rig.allMeshes.length);
 for(const m of copies){assert.notEqual(m.skeleton,rig.face.skeleton);for(const b of m.skeleton.bones){let o=b;while(o.parent)o=o.parent;assert.equal(o,pose.model,'copy is bound to its own bones')}}
 assert.equal(copies.find(m=>m.name===rig.face.name).material,rig.face.material,'materials are shared');
 // The copy skins at the same size and place as the speaker (no double character scale).
 npc.updateMatrixWorld(true);pose.model.updateMatrixWorld(true);const box=(m,root)=>{m.computeBoundingBox();return m.boundingBox.clone().applyMatrix4(root.matrixWorld.clone().invert().multiply(m.matrixWorld))},a=box(rig.face,npc),b=box(copies.find(m=>m.name===rig.face.name),pose.model);assert.ok(a.min.distanceTo(b.min)<1e-4&&a.max.distanceTo(b.max)<1e-4,'portrait face matches the speaker');
 const angles=new Set();for(let i=0;i<30;i++){pose.update(i/12,true);angles.add(copyHead.quaternion.angleTo(rest).toFixed(4))}
 assert.ok(angles.size>8,'head nods while talking');assert.ok(sourceHead.quaternion.equals(rest),'world speaker untouched');
 pose.update(1,true,true);assert.ok(copyHead.quaternion.angleTo(rest)<1e-6,'reduced motion holds still');
 pose.dispose();
});
test('sun shadow projection stays on its texel grid during small movements',()=>{
 const sun=new T.DirectionalLight();Object.assign(sun.shadow.camera,{left:-32,right:32});sun.shadow.mapSize.set(1024,1024);
 const right=new T.Vector3(.6,0,-.8),up=new T.Vector3().crossVectors(new T.Vector3(40,65,30),right).normalize();
 for(let i=0;i<40;i++){
  const focus=new T.Vector3(5+i*.001,1,12);stabilizeSun(T,sun,focus);
  for(const axis of [right,up]){const grid=sun.target.position.dot(axis)/.0625;assert.ok(Math.abs(grid-Math.round(grid))<1e-8)}
  assert.ok(sun.position.clone().sub(sun.target.position).distanceTo(new T.Vector3(40,65,30))<1e-8);
 }
});
