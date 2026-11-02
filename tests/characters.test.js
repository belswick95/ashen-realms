import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildHumanoid} from '../humanoid.js';
import {createHumanoidAnimator} from '../animation.js';
import {buildPlateArmor} from '../armor.js';
import {makeWeapon} from '../weapons.js';
import {makeShield} from '../shields.js';
const character=()=>{const root=new T.Group();return buildHumanoid(T,root,{})};
test('head surface normals face outward and proportions stay below prototype size',()=>{
 const rig=character(),g=rig.face.geometry,p=g.attributes.position,n=g.attributes.normal;
 let outward=0;for(let i=0;i<p.count;i++)outward+=p.getX(i)*n.getX(i)+p.getZ(i)*n.getZ(i);
 assert.ok(outward>0,'head must render its outside surface, not its inside');
 const bounds=new T.Box3().setFromObject(rig.head),size=bounds.getSize(new T.Vector3());
 assert.ok(size.y<.6);assert.ok(size.x<.5);
});
test('all hairstyles produce finite transforms and share cached geometry',()=>{
 const rigs=['Side swept','Short crop','Spiky','Buzz cut','Long'].map(hair=>buildHumanoid(T,new T.Group(),{hair}));
 for(const rig of rigs)rig.root.traverse(o=>assert.ok([...o.position,...o.scale].every(Number.isFinite)));
 assert.equal(rigs[0].face.geometry,rigs[1].face.geometry);
 assert.notEqual(rigs[0].head,rigs[1].head);
});
test('equipment stays attached to wrists while arms and elbows articulate',()=>{
 const r=character(),weapon=makeWeapon(T,'longsword'),shield=makeShield(T,'kite');
 r.rightHand.add(weapon);r.leftHand.add(shield);
 const before=weapon.getWorldPosition(new T.Vector3());
 const a=createHumanoidAnimator(r);a.update(.05,{distance:.2,speed:4,attack:.3});r.root.updateMatrixWorld(true);
 assert.ok(before.distanceTo(weapon.getWorldPosition(new T.Vector3()))>.1);
 assert.equal(weapon.parent,r.rightHand);assert.equal(shield.parent,r.leftHand);
 const slots=buildPlateArmor(T,r.root,r);
 r.root.updateMatrixWorld(true);const headBounds=new T.Box3().setFromObject(r.head),helmetBounds=new T.Box3();for(const part of slots.helm)helmetBounds.union(new T.Box3().setFromObject(part));const headWidth=headBounds.getSize(new T.Vector3()).x,helmetWidth=helmetBounds.getSize(new T.Vector3()).x;assert.ok(helmetWidth>headWidth);assert.ok(helmetWidth<headWidth*1.4);assert.ok(helmetBounds.max.z>headBounds.max.z);
 for(const pieces of Object.values(slots))for(const m of pieces)assert.equal(m.visible,false);
});
test('distance drives cadence consistently across frame rates',()=>{
 const run=hz=>{const r=character(),a=createHumanoidAnimator(r);for(let i=0;i<hz;i++)a.update(1/hz,{distance:5/hz,speed:5});return r};
 const a=run(30),b=run(120);
 assert.ok(Math.abs(a.leftLeg.rotation.x-b.leftLeg.rotation.x)<1e-8);
 assert.equal(a.root.position.y,0);
});
test('stopping settles gait and ending combat resets attack channels',()=>{
 const r=character(),a=createHumanoidAnimator(r);a.update(.05,{distance:.25,speed:5,attack:.3});
 assert.notEqual(r.rightArm.rotation.z,0);
 for(let i=0;i<180;i++)a.update(1/60);
 assert.ok(Math.abs(r.leftLeg.rotation.x)<1e-10);assert.equal(r.rightArm.rotation.z,0);
 assert.equal(r.root.position.y,0);assert.ok(r.leftKnee.rotation.x>=0);
 a.update(NaN,{distance:Infinity});assert.ok(Number.isFinite(r.leftArm.rotation.x));
});
test('two-handed IK keeps both wrists on the grip through idle and attack',()=>{
 const r=character(),a=createHumanoidAnimator(r);
 for(const attack of [0,.5,.3,.1]){
  a.update(.016,{twoHanded:true,attack});r.root.updateMatrixWorld(true);
  const right=r.rightHand.getWorldPosition(new T.Vector3()),left=r.leftHand.getWorldPosition(new T.Vector3());
  assert.ok(Math.abs(right.distanceTo(left)-.10)<.025,'wrists remain one grip length apart');
  assert.ok(Number.isFinite(right.y));
 }
 a.update(.016);assert.equal(r.leftElbow.rotation.z,0);assert.equal(r.rightElbow.rotation.z,0);
});

test('hair styles use distinct low-poly silhouettes with reusable tapered geometry',()=>{
 const styles=['Side swept','Short crop','Spiky','Buzz cut','Long'];
 const rigs=styles.map(hair=>buildHumanoid(T,new T.Group(),{hair}));
 const strands=rig=>rig.hairMeshes.filter(mesh=>mesh.geometry.type==='ConeGeometry');
 assert.deepEqual(rigs.map(r=>strands(r).length),[7,7,7,0,17]);
 assert.equal(strands(rigs[0])[0].geometry,strands(rigs[4])[0].geometry);
 for(const rig of rigs){
  const headBounds=new T.Box3().setFromObject(rig.head);
  assert.ok(headBounds.min.y>1.9&&headBounds.max.y<3.0,'hair must stay attached to the head');
 }
});

test('garment details stay attached to the body without affecting rig pivots',()=>{
 const rig=character();
 const details=[];rig.root.traverse(o=>{if(o.isMesh&&o.geometry.type==='CylinderGeometry'&&o.geometry.parameters.height===.46)details.push(o)});
 assert.equal(details.length,2,'both tunic seams should exist');
 for(const seam of details)assert.ok(Number.isFinite(seam.position.y));
 const animator=createHumanoidAnimator(rig);animator.update(.016,{speed:5,distance:.08});
 assert.ok(rig.leftArm.parent===rig.root&&rig.rightArm.parent===rig.root);
});

test('damage reaction decays, idle breathing remains finite and the gameplay root stays grounded',()=>{
 const r=character(),a=createHumanoidAnimator(r);
 const pose=a.update(1/60,{hit:1});
 assert.equal(pose.hit,true);assert.ok(r.torso.rotation.x>0);assert.ok(r.head.rotation.x<0);
 for(let i=0;i<180;i++)a.update(1/60,{hit:0});
 assert.ok(Math.abs(r.torso.rotation.x)<1e-10);
 assert.ok(Math.abs(r.head.rotation.x)<1e-10);
 assert.ok(r.neck.scale.y>.99&&r.neck.scale.y<1.01);
 assert.equal(r.root.position.y,0);
 a.update(1/60,{hit:NaN});assert.ok(Number.isFinite(r.head.rotation.x));
});
