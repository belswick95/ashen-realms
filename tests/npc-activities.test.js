import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {buildHumanoid} from '../humanoid.js';import {createHumanoidAnimator} from '../animation.js';
import {animateTownActivity,createWorkKit,carriesWeapon} from '../town-life.js';import {currentWork} from '../npc-activities.js';
const world=o=>o.getWorldPosition(new T.Vector3());
function person(profile={}){const root=new T.Group(),rig=buildHumanoid(T,root),animator=createHumanoidAnimator(rig),kit=createWorkKit(T,rig,profile);return {root,rig,animator,kit}}
function run(p,kind,seconds,{moving=false,start=0}={}){let pose;for(let i=0;i<seconds*60;i++){pose=p.animator.update(1/60,moving?{distance:1.4/60,speed:1.4,locomotion:'walk'}:{});animateTownActivity(p.rig,kind,start+i/60,moving);p.root.updateMatrixWorld(true)}return pose}

test('sweeping holds a broom in both hands instead of pushing an empty cart pose',()=>{const p=person({activity:'sweep'});const pose=run(p,'sweep',2);assert.notEqual(pose.gait,'Push_Loop');assert.equal(pose.gait,'Idle_Loop');
 const broom=p.kit.children.find(o=>o.visible);assert.ok(broom,'broom visible');const tip=world(broom),top=broom.localToWorld(new T.Vector3(0,1.7,0));
 const onHandle=hand=>{const h=world(p.rig.bones['hand_'+hand]),d=new T.Vector3().subVectors(top,tip),t=h.clone().sub(tip).dot(d)/d.lengthSq();return h.distanceTo(tip.clone().addScaledVector(d,t))};
 assert.ok(onHandle('l')<.2&&onHandle('r')<.2,'both hands close on the handle: '+onHandle('l').toFixed(2)+' '+onHandle('r').toFixed(2));assert.ok(tip.y<.2&&tip.z>.6,'bristles on the ground in front')});

test('the smith strikes a real anvil in front of them with the hammer in the right fist',()=>{const p=person({activity:'smith'});let closest=9;
 for(let i=0;i<160;i++){p.animator.update(1/60,{});animateTownActivity(p.rig,'smith',i/60,false);p.root.updateMatrixWorld(true);const hammer=p.rig.workKit.items.hammer;if(i>60){const head=hammer.localToWorld(new T.Vector3(0,.38,0)),face=p.rig.workKit.items.anvil.localToWorld(new T.Vector3(.02,1.25,0));closest=Math.min(closest,head.distanceTo(face));assert.ok(hammer.position.distanceTo(p.root.worldToLocal(world(p.rig.bones.hand_r)))<.05,'grip in the fist')}}
 const shown=p.kit.children.filter(o=>o.visible);assert.equal(shown.length,3,'anvil, hammer and tongs');assert.ok(world(p.rig.workKit.items.anvil).z>.4,'anvil in front');
 assert.ok(closest<.15,'hammer head lands on the anvil face: '+closest.toFixed(2))});

test('route workers only work at their stations, facing the work; a pause elsewhere is rest',()=>{const route=[{x:0,z:0,wait:8,act:'garden',face:Math.PI},{x:6,z:0,wait:0},{x:6,z:6,wait:6,act:'sit',face:1}];const p=person({activity:'garden',route});
 assert.equal(currentWork(p.rig,'garden',false).kind,'garden');let pose=run(p,'garden',2);assert.equal(pose.gait,'Fixing_Kneeling');assert.ok(Math.abs(Math.abs(p.root.rotation.y)-Math.PI)<.2,'turned to the flower bed');
 p.root.position.set(3,0,1.2);pose=run(p,'garden',2,{start:5});assert.notEqual(pose.gait,'Fixing_Kneeling','no kneeling at a random point');assert.notEqual(pose.gait,'Push_Loop');assert.ok(p.kit.children.every(o=>!o.visible),'tools put away');
 p.root.position.set(6,0,6);pose=run(p,'garden',2,{start:9});assert.equal(pose.gait,'Sitting_Idle_Loop')});

test('a porter carries the crate between the stations it was loaded and unloaded at',()=>{const route=[{x:0,z:0,wait:4,act:'fetch',hold:'crate'},{x:8,z:0,wait:4,act:'fetch'}];const p=person({activity:'carry',route});run(p,'carry',1);
 p.root.position.set(4,0,0);run(p,'carry',1,{moving:true,start:2});const crate=p.rig.workKit.items.crate;assert.ok(crate?.visible,'crate carried on the loaded leg');const l=world(p.rig.bones.hand_l),r=world(p.rig.bones.hand_r),c=world(crate);assert.ok(l.distanceTo(c)<.5&&r.distanceTo(c)<.5,'both hands on the crate');
 p.root.position.set(8,0,0);run(p,'carry',1,{start:4});p.root.position.set(4,0,0);run(p,'carry',1,{moving:true,start:6});assert.ok(!crate.visible,'returns empty-handed')});

test('a lone talker does not talk to the air',()=>{const p=person({activity:'talk'});p.root.position.set(40,0,40);const pose=run(p,'talk',2);assert.notEqual(pose.gait,'Idle_Talking_Loop');const q=person({activity:'talk'});q.root.position.set(41.5,0,40);for(let i=0;i<120;i++){for(const x of [p,q]){x.animator.update(1/60,{});animateTownActivity(x.rig,'talk',4+i/60,false);x.root.updateMatrixWorld(true)}}
 assert.equal(p.animator.update(1/60,{}).gait,'Idle_Talking_Loop');assert.ok(Math.abs(p.root.rotation.y-Math.PI/2)<.25,'faces the partner')});

test('civilians do not wield their defensive weapon; guards do',()=>{assert.equal(carriesWeapon({role:'merchant'}),false);assert.equal(carriesWeapon({role:'smith'}),false);assert.equal(carriesWeapon({role:'banker'}),false);assert.equal(carriesWeapon({role:'guard'}),true);assert.equal(carriesWeapon({role:'resident',attackable:true}),true)});
