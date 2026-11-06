import test from 'node:test';
import assert from 'node:assert/strict';
import * as T from 'three';
import {buildHumanoid} from '../humanoid.js';
import {createHumanoidAnimator} from '../animation.js';
import {characterStore,CHARACTER_SCALE,clipsFor,ensurePart} from '../character-assets.js';
import {outfitItems,wornOutfit,defaultClothing,OUTFIT_SLOTS} from '../outfits.js';
import {makeWeapon} from '../weapons.js';
import {makeShield} from '../shields.js';
// Characters are Quaternius skinned models (assets/characters) driven by
// animation clips. tests/helpers/preload.js loads the assets before any test.
const world=o=>o.getWorldPosition(new T.Vector3());
const character=(look={})=>{const root=new T.Group();return buildHumanoid(T,root,look)};
const run=(rig,frames,opts)=>{const a=createHumanoidAnimator(rig);let pose;for(let i=0;i<frames;i++)pose=a.update(1/60,typeof opts==='function'?opts(i):opts);rig.root.updateMatrixWorld(true);return {a,pose}};

test('both bodies build skinned meshes on one skeleton with an adult head height',()=>{
 for(const sex of ['male','female']){
  const rig=character({sex});rig.root.updateMatrixWorld(true);
  assert.equal(rig.sex,sex);assert.ok(rig.allMeshes.length>=6);
  for(const m of rig.allMeshes){assert.ok(m.isSkinnedMesh,m.name);for(const b of m.skeleton.bones)assert.equal(rig.bones[b.name],b,'every mesh is bound to this character\'s own bones')}
  const head=world(rig.head).y;assert.ok(head>2.2&&head<2.8,sex+' head height '+head);
  assert.ok(rig.footHeight>0&&rig.footHeight<.3);
  rig.root.traverse(o=>assert.ok([...o.position,...o.scale].every(Number.isFinite)));
 }
 assert.equal(character().model.scale.x,CHARACTER_SCALE);
});

test('characters share geometry and materials but never bones',()=>{
 const a=character({skin:'#945d3f'}),b=character({skin:'#945d3f'});
 assert.equal(a.face.geometry,b.face.geometry);assert.equal(a.face.material,b.face.material);
 assert.notEqual(a.head,b.head);assert.notEqual(a.face.skeleton,b.face.skeleton);
});

test('appearance tints skin and hair, chooses the hairstyle and keeps beards male-only',()=>{
 const r=character({skin:'#402a24',hairColor:'#c0b5a3',hair:'Long',beard:'Beard'});
 assert.equal(r.face.material.color.getHexString(),'402a24');
 assert.equal(r.hairMeshes[0].material.color.getHexString(),'c0b5a3');
 assert.ok(r.hairMeshes.some(m=>/Hair_Long/.test(m.name)));assert.ok(r.hairMeshes.some(m=>/Beard/.test(m.name)));
 assert.equal(character({hair:'Bald'}).hairMeshes.length,0);
 assert.ok(!character({sex:'female',beard:'Beard'}).hairMeshes.some(m=>/Beard/.test(m.name)));
});

test('unarmoured regions wear the starter clothes in the chosen dyes',()=>{
 const r=character({shirtVariant:3,pantsVariant:2});
 assert.deepEqual(r.worn,defaultClothing({shirtVariant:3,pantsVariant:2}));
 assert.deepEqual(Object.keys(r.parts).sort(),['arms','boots','chest','legs']);
 for(const slot of ['helm','shoulders','neck'])assert.equal(r.parts[slot],undefined);
});

test('setCoverage dresses one part per slot, hides hair under closed helms and undresses cleanly',async()=>{
 await Promise.all(['helm','chest','legs','boots','knightRoundPauldrons1','knightHornedHelm2','rangerHood1'].flatMap(k=>[ensurePart(outfitItems[k].male)]));
 const r=character({hair:'Short parted',beard:'Beard'}),startMeshes=r.allMeshes.length;
 const worn=r.setCoverage({helm:true,chest:true,legs:true,boots:true,knightRoundPauldrons1:true});
 assert.equal(worn.helm,'helm');assert.equal(worn.chest,'chest');assert.equal(worn.shoulders,'knightRoundPauldrons1');
 for(const slot of ['helm','chest','legs','boots','shoulders'])assert.ok(r.parts[slot].meshes.length>0,slot);
 assert.ok(r.hairMeshes.length>=2&&r.hairMeshes.every(m=>!m.visible),'armet hides hair and beard');
 // Another item in the same slot replaces the first rather than stacking.
 r.setCoverage({knightHornedHelm2:true});assert.equal(r.parts.helm.key,'knightHornedHelm2');assert.equal(r.parts.chest.key,'peasantShirt1');
 // A hood hides hair but not the beard.
 r.setCoverage({rangerHood1:true});assert.ok(r.hairMeshes.some(m=>m.visible)&&r.hairMeshes.some(m=>!m.visible));
 r.setCoverage({});assert.equal(r.parts.helm,undefined);assert.ok(r.hairMeshes.every(m=>m.visible));assert.equal(r.allMeshes.length,startMeshes);
 for(const m of r.allMeshes)assert.ok(r.model.children.includes(m),'no orphaned outfit meshes');
});

test('outfit parts stream in on first use and the slot keeps its previous mesh until they arrive',async()=>{
 const key='wizardRobeTop3',part=outfitItems[key].male;delete characterStore.parts[part];characterStore.pending.delete(part);
 const r=character();r.setCoverage({[key]:true});
 assert.equal(r.parts.chest.key,'peasantShirt1','not half-dressed while loading');
 await characterStore.pending.get(part);await Promise.resolve();
 assert.equal(r.parts.chest.key,key);
 // A later change that wins the race is not overwritten by a slow load.
 const slow='nobleCoat2',slowPart=outfitItems[slow].male;delete characterStore.parts[slowPart];characterStore.pending.delete(slowPart);
 r.setCoverage({[slow]:true});r.setCoverage({});await characterStore.pending.get(slowPart);await Promise.resolve();
 assert.equal(r.parts.chest.key,'peasantShirt1');
});

test('every outfit item resolves to a real part for both bodies and one slot',()=>{
 // 96 outfit pieces plus 8 recoloured plate pieces for each of the 7 gear tiers without their own texture.
 assert.equal(Object.keys(outfitItems).length,96+8*7+12,'96 pieces + 8 plate pieces x 7 tiers + 12 unique armour pieces (unique-gear.js)');
 for(const item of Object.values(outfitItems)){assert.ok(OUTFIT_SLOTS.includes(item.slot),item.key);for(const sex of ['male','female'])assert.ok(characterStore.manifest.parts[item[sex]],item.key+' '+sex)}
 for(const legacy of ['helm','chest','legs','boots'])assert.equal(outfitItems[legacy].outfit,'knight');
 assert.equal(wornOutfit({helm:true,knightHornedHelm1:false}).helm,'helm');
});

test('held items ride the hand sockets at world size and follow the clip',()=>{
 const r=character(),weapon=makeWeapon(T,'longsword'),shield=makeShield(T,'kite');
 r.rightHand.add(weapon);r.leftHand.add(shield);r.root.updateMatrixWorld(true);
 assert.equal(r.rightHand.parent,r.bones.hand_r);assert.equal(r.leftHand.parent,r.bones.hand_l);
 assert.ok(Math.abs(r.rightHand.getWorldScale(new T.Vector3()).x-1)<1e-6,'socket undoes the body scale');
 const before=world(weapon);run(r,30,{attack:.5,armed:true});
 assert.ok(before.distanceTo(world(weapon))>.1);assert.equal(weapon.parent,r.rightHand);assert.equal(shield.parent,r.leftHand);
});

test('the animator picks gait clips from speed or requested locomotion and never moves the root',()=>{
 const cases=[[{},'Idle_Loop'],[{distance:1.5/60,speed:1.5},'Walk_Loop'],[{distance:5/60,speed:5},'Jog_Fwd_Loop'],[{distance:9/60,speed:9},'Sprint_Loop'],
  [{distance:3/60,speed:3,locomotion:'walk'},'Walk_Loop'],[{distance:3/60,speed:3,locomotion:'run'},'Sprint_Loop'],[{armed:true},'Idle_Loop'],[{armed:true,combat:true},'Sword_Idle'],[{combat:true},'Sword_Idle'],[{block:.5},'Sword_Idle'],[{mounted:true,distance:.1,speed:6},'Driving_Loop'],[{activity:'smith'},'Fixing_Kneeling'],[{dead:true},'Fixing_Kneeling']];
 for(const [opts,clip] of cases){const r=character(),{pose}=run(r,40,opts);assert.equal(pose.gait,clip,JSON.stringify(opts));assert.deepEqual(r.root.position.toArray(),[0,0,0]);assert.equal(r.root.rotation.x,0)}
 // Death: down on the knees first (head bowed), then the collapse; the root never moves.
 {const r=character();assert.equal(run(r,100,{dead:true}).pose.gait,'Death01');assert.deepEqual(r.root.position.toArray(),[0,0,0]);assert.equal(run(r,140,i=>i<100?{dead:true}:{}).pose.gait,'Idle_Loop')}
});

test('running leans the head ahead of the hips toward +Z',()=>{
 const r=character();run(r,90,{distance:9/60,speed:9,locomotion:'run'});
 assert.ok(world(r.head).z>world(r.bones.pelvis).z+.2);
});

test('step rate follows travel speed so feet do not slide, within sane limits',()=>{
 // The gait clips follow a distance-driven stride: steps per second = speed / step length.
 const rate=(speed,mode='walk')=>{const r=character(),{pose}=run(r,20,{distance:speed/60,speed,locomotion:mode});return speed/pose.step};
 assert.ok(rate(2)>rate(1.2));assert.ok(rate(20,'run')<=9);assert.ok(rate(.2)>=.2);
 assert.ok(rate(6.4,'jog')>3,'jog cadence '+rate(6.4,'jog'));
});

test('the planted foot moves backward at the travel speed: short quick strides, no sliding',()=>{
 for(const [mode,speed] of [['walk',1.5],['walk',3],['jog',5],['jog',6.4],['run',12.8]]){
  const r=character(),a=createHumanoidAnimator(r),dt=1/120,rows=[];for(let i=0;i<240;i++)a.update(dt,{distance:speed*dt,speed,locomotion:mode});
  for(let i=0;i<480;i++){a.update(dt,{distance:speed*dt,speed,locomotion:mode});r.root.updateMatrixWorld(true);rows.push(['l','r'].map(s=>world(r.bones['ball_'+s])))}
  const low=Math.min(...rows.flat().map(p=>p.y)),v=[];
  for(let i=1;i<rows.length;i++){const k=rows[i][0].y<rows[i][1].y?0:1;if(rows[i][k].y<low+.05&&rows[i-1][k].y<low+.05)v.push((rows[i-1][k].z-rows[i][k].z)/dt)}
  v.sort((x,y)=>x-y);const median=v[v.length>>1];assert.ok(Math.abs(median-speed)/speed<.15,mode+' '+speed+': planted foot '+median);
 }
});

test('frame rate does not change the pose after the same time',()=>{
 // Fades are exact exponentials; the stride integrates distance / step frame by frame
 // while the walk -> run blend changes the step, so allow a centimetre.
 const pose=hz=>{const r=character(),a=createHumanoidAnimator(r);for(let i=0;i<hz;i++)a.update(1/hz,{distance:5/hz,speed:5});r.root.updateMatrixWorld(true);return world(r.rightHand)};
 assert.ok(pose(30).distanceTo(pose(120))<.01);
});

test('attacks, hits and jumps play one-shots that hand back to the base loop',()=>{
 const r=character(),a=createHumanoidAnimator(r);
 assert.equal(a.update(1/60,{attack:.5,armed:true}).clip,'Sword_Attack');
 let pose;for(let i=0;i<90;i++)pose=a.update(1/60,{armed:true});assert.equal(pose.clip,'Sword_Idle','armed attacks hold the combat stance for a while');
 for(let i=0;i<420;i++)pose=a.update(1/60,{armed:true});assert.equal(pose.clip,'Idle_Loop','then ease back to the relaxed idle');
 assert.equal(a.update(1/60,{attack:.5,style:'magic'}).clip,'Spell_Simple_Shoot');for(let i=0;i<90;i++)a.update(1/60);
 assert.match(a.update(1/60,{attack:.4}).clip,/^Punch_/,'unarmed attacks punch');for(let i=0;i<90;i++)a.update(1/60);
 assert.match(a.update(1/60,{hit:1}).clip,/^Hit_/);for(let i=0;i<60;i++)pose=a.update(1/60,{hit:0});assert.equal(pose.clip,'Idle_Loop');
 assert.equal(a.update(1/60,{airborne:true}).clip,'Jump_Start');for(let i=0;i<30;i++)pose=a.update(1/60,{airborne:true});assert.equal(pose.clip,'Jump_Loop');assert.equal(pose.flight,true);
 assert.equal(a.update(1/60,{airborne:false}).clip,'Jump_Land');for(let i=0;i<40;i++)pose=a.update(1/60);assert.equal(pose.clip,'Idle_Loop');assert.equal(pose.flight,false);
});

test('bad frame input is ignored and the pose stays finite',()=>{
 const r=character(),a=createHumanoidAnimator(r);
 assert.equal(a.update(NaN,{distance:Infinity}),undefined);assert.equal(a.update(-1),undefined);
 a.update(1/60,{distance:Infinity,speed:NaN,hit:NaN});r.root.updateMatrixWorld(true);
 for(const b of Object.values(r.bones))assert.ok([...b.quaternion.toArray(),...b.position.toArray()].every(Number.isFinite),b.name);
});

test('activities are set on the rig and cleared while travelling',()=>{
 const r=character();r.setActivity('sweep');assert.equal(run(r,30,{}).pose.gait,'Push_Loop');
 r.setActivity(null);assert.equal(run(r,30,{}).pose.gait,'Idle_Loop');
});

test('dispose removes the model and the upper-back anchor but not shared geometry',()=>{
 const root=new T.Group(),r=buildHumanoid(T,root,{}),geometry=r.face.geometry;let disposed=false;geometry.addEventListener('dispose',()=>disposed=true);
 r.dispose();assert.equal(root.children.length,0);assert.equal(disposed,false);
 assert.ok(character().face.geometry===geometry);
});
