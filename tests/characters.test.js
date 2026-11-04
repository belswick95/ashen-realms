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
 r.root.updateMatrixWorld(true);const headBounds=new T.Box3().setFromObject(r.face),helmetBounds=new T.Box3();for(const part of slots.helm)helmetBounds.union(new T.Box3().setFromObject(part));const headWidth=headBounds.getSize(new T.Vector3()).x,helmetWidth=helmetBounds.getSize(new T.Vector3()).x;assert.ok(helmetWidth>headWidth);assert.ok(helmetWidth<headWidth*1.4);assert.ok(helmetBounds.max.z>headBounds.max.z);
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
 assert.ok(Math.abs(r.leftLeg.rotation.x)<1e-10);assert.equal(r.rightArm.rotation.z,-r.armSplay,'arm returns to its relaxed rest angle');
 assert.equal(r.root.position.y,0);assert.ok(r.leftKnee.rotation.x>=0);
 a.update(NaN,{distance:Infinity});assert.ok(Number.isFinite(r.leftArm.rotation.x));
});
test('two-handed IK keeps both wrists on the grip during attacks',()=>{
 const r=character(),a=createHumanoidAnimator(r);
 for(const attack of [.5,.3,.1]){
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
 const strands=rig=>rig.hairMeshes.filter(mesh=>mesh.userData.hairStrand===true);
 assert.deepEqual(rigs.map(r=>strands(r).length),[0,0,7,0,0]);
 assert.equal(rigs[0].hairMeshes[0].geometry,rigs[1].hairMeshes[0].geometry,'same cap shape is cached');
 assert.notEqual(rigs[0].hairMeshes[0].geometry,rigs[3].hairMeshes[0].geometry,'buzz cut is thinner');
 for(const rig of rigs){
  const headBounds=new T.Box3().setFromObject(rig.head);
  assert.ok(headBounds.min.y>1.9&&headBounds.max.y<3.0,'hair must stay attached to the head');
 }
});

test('stylised body: rigid parts on bones, modest vertex budget and stable equipment anchors',()=>{
 const rig=character();let vertices=0,skinned=0;rig.root.traverse(o=>{if(o.isSkinnedMesh)skinned++;if(o.isMesh)vertices+=o.geometry.attributes.position.count});assert.equal(skinned,0);assert.ok(vertices<9000,'stays light enough for many NPCs: '+vertices);
 assert.equal(rig.meshes.head.parent,rig.head);assert.equal(rig.meshes.leftHand.parent,rig.leftHand);assert.equal(rig.meshes.rightHand.parent,rig.rightHand);
 for(const side of ['left','right'])for(const [part,bone] of [['UpperArm','Arm'],['Forearm','Elbow'],['Thigh','Leg'],['Shin','Knee'],['Foot','Ankle']])assert.equal(rig.parts[side+part].parent,rig[side+bone]);
 const animator=createHumanoidAnimator(rig);animator.update(.016,{speed:5,distance:.08});rig.root.updateMatrixWorld(true);assert.ok(rig.leftArm.parent===rig.root&&rig.rightArm.parent===rig.root);
});
test('every armor piece is parented to a bone and is larger than the body part it covers',()=>{
 const rig=character(),slots=buildPlateArmor(T,rig.root,rig);rig.root.updateMatrixWorld(true);
 for(const list of Object.values(slots))for(const m of list){let o=m;while(o&&!o.isBone&&o!==rig.torso)o=o.parent;assert.ok(o,'armor follows a bone')}
 const width=(o)=>new T.Box3().setFromObject(o).getSize(new T.Vector3());
 for(const [part,armor] of [['leftForearm','vambrace'],['leftUpperArm','rerebrace'],['leftThigh','cuisse'],['leftShin','greave'],['shirt','cuirass'],['leftFoot','sabaton'],['face','helm']]){const piece=Object.values(slots).flat().find(m=>m.geometry.userData.armorPiece===armor&&(rig.parts[part].parent===rig.head||m.parent===rig.parts[part].parent));assert.ok(piece,armor);piece.visible=true;const a=width(piece),b=width(rig.parts[part]);assert.ok(a.x>b.x&&a.z>b.z,part)}
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
test('eyes blink: lids close briefly and return to their relaxed rest angle',()=>{
 const r=character(),a=createHumanoidAnimator(r),rest=r.eyelids[0].rotation.x;let closed=false;
 for(let i=0;i<60*8;i++){a.update(1/60,{});if(r.eyelids[0].rotation.x>rest+.8)closed=true}
 assert.ok(closed,'blinked within eight seconds');assert.equal(r.eyelids[0].rotation.x,r.eyelids[1].rotation.x);
});
