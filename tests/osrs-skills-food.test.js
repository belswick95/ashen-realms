import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {xpForLevel,skillLevel,combatLevel,hitpointsLevel,maxHpForXp,migrateLegacyXp,xpProgress,combatXp,skillingChance,burnChance,formatXp,XP_TABLE} from '../combat-level.js';
import {foodLadder,foodItems,foodRecipes,fishTable,fishCatch,healAmount,isFood,EAT_DELAY} from '../food.js';
import {goods} from '../economy.js?v=release-20261106-cut103';
import {professionRecipes} from '../profession-data.js?v=release-20261106-cut103';
import {buildHumanoid} from '../humanoid.js';import {createHumanoidAnimator,eatWeight} from '../animation.js';
import {makeWeapon} from '../weapons.js';import {makeShield} from '../shields.js';import {attachWeapon,attachShield} from '../equipment-pose.js';

test('OSRS experience table matches the real values',()=>{
 assert.equal(xpForLevel(1),0);assert.equal(xpForLevel(2),83);assert.equal(xpForLevel(10),1154);assert.equal(xpForLevel(50),101333);assert.equal(xpForLevel(92),6517253);assert.equal(xpForLevel(99),13034431);
 // Recompute independently from the published formula.
 let sum=0;for(let l=1;l<99;l++){sum+=Math.floor(l+300*2**(l/7));assert.equal(XP_TABLE[l+1],Math.floor(sum/4),'level '+(l+1))}
});
test('level from XP uses the table and caps at 99',()=>{
 assert.equal(skillLevel(0),1);assert.equal(skillLevel(82),1);assert.equal(skillLevel(83),2);assert.equal(skillLevel(1153),9);assert.equal(skillLevel(1154),10);assert.equal(skillLevel(13034430),98);assert.equal(skillLevel(13034431),99);assert.equal(skillLevel(2e8),99);assert.equal(skillLevel(-5),1);assert.equal(skillLevel('x'),1);
 for(let l=1;l<=99;l++){assert.equal(skillLevel(xpForLevel(l)),l);if(l>1)assert.equal(skillLevel(xpForLevel(l)-1),l-1)}
 const p=xpProgress(xpForLevel(40)+10);assert.equal(p.level,40);assert.equal(p.next,xpForLevel(41));assert.ok(p.fraction>0&&p.fraction<1);assert.equal(xpProgress(2e7).fraction,1);
});
test('hitpoints starts at 10 and max HP is ten times the hitpoints level',()=>{
 assert.equal(hitpointsLevel(0),10);assert.equal(maxHpForXp(0),100);assert.equal(maxHpForXp(xpForLevel(10)),100);assert.equal(maxHpForXp(xpForLevel(11)),110);assert.equal(maxHpForXp(xpForLevel(99)),990);
});
test('combat level is the plain, uncapped OSRS formula (3 to 126)',()=>{
 const at=l=>xpForLevel(l);
 assert.equal(combatLevel({}),3);
 assert.equal(combatLevel({hitpointsXP:at(10)}),3);
 // 40 attack/strength/defence, 40 hitpoints, 1 prayer: ¼(40+40+0)+0.325·80 = 46
 assert.equal(combatLevel({attackXP:at(40),strengthXP:at(40),defenceXP:at(40),hitpointsXP:at(40)}),46);
 // Pure ranger: 60 ranged, 30 defence, 35 hitpoints, 20 prayer: ¼(30+35+10)+0.325·90 = 48
 assert.equal(combatLevel({rangedXP:at(60),defenceXP:at(30),hitpointsXP:at(35),prayerXP:at(20)}),48);
 // Melee-only 99 Attack/Strength/Defence/Hitpoints, Prayer 1: ¼(99+99+0) + 0.325·198 = 113.85 → 113
 assert.equal(combatLevel({attackXP:at(99),strengthXP:at(99),defenceXP:at(99),hitpointsXP:at(99)}),113);
 // Everything 99 (Prayer 99 too) is the OSRS maximum, 126.
 assert.equal(combatLevel(Object.fromEntries(['attackXP','strengthXP','defenceXP','hitpointsXP','prayerXP','rangedXP','magicXP'].map(k=>[k,at(99)]))),126);
 assert.equal(combatLevel({attackXP:at(99),strengthXP:at(99),defenceXP:at(99),rangedXP:at(99),magicXP:at(99)}),91,'no special 100 rule');
});
test('combat XP follows OSRS rates: only damage dealt, 1.33 Hitpoints XP per damage',()=>{
 assert.deepEqual(combatXp({damage:10,style:'stab'}),{attackXP:40,hitpointsXP:13.3});
 assert.deepEqual(combatXp({damage:10,style:'slash'}),{strengthXP:40,hitpointsXP:13.3});
 assert.deepEqual(combatXp({damage:3,style:'lunge'}),{attackXP:3.99,strengthXP:3.99,defenceXP:3.99,hitpointsXP:3.99});
 assert.deepEqual(combatXp({damage:5,ranged:true}),{rangedXP:20,hitpointsXP:6.65});
 assert.deepEqual(combatXp({damage:5,magic:true}),{magicXP:15.5,hitpointsXP:6.65},'Wind Strike base 5.5');
 assert.deepEqual(combatXp({damage:0,magic:true}),{magicXP:5.5},'a splash still gives the spell base XP');
 assert.deepEqual(combatXp({damage:0,style:'slash'}),{});
 // Arms Drill: 2 damage meets the 8 Attack/Strength objectives; 3 lunge damage meets Defence 3.
 assert.ok(Math.floor(combatXp({damage:2,style:'stab'}).attackXP)>=8);assert.ok(Math.floor(combatXp({damage:3,style:'lunge'}).defenceXP)>=3);
});
test('OSRS skilling chance interpolates low/high out of 256 between levels 1 and 99',()=>{
 assert.equal(skillingChance(64,200,1),65/256);assert.equal(skillingChance(64,200,99),201/256);
 assert.equal(skillingChance(100,350,99),1,'capped at certainty');assert.equal(skillingChance(48,256,1),49/256);
 for(let l=2;l<=99;l++)assert.ok(skillingChance(16,100,l)>=skillingChance(16,100,l-1));
});
test('cooking burn chance falls to zero at the OSRS stop-burn level',()=>{
 const shrimp=professionRecipes.cook_shrimp;assert.equal(shrimp.stopBurn,34);
 assert.equal(burnChance(shrimp,1),.15);assert.equal(burnChance(shrimp,34),0);assert.equal(burnChance(shrimp,99),0);assert.ok(burnChance(shrimp,20)>0&&burnChance(shrimp,20)<.15);
 assert.equal(burnChance({burnChance:.2,level:10},45),0,'recipes without a stop level stop 35 levels above the requirement');
 const stops={cook_shrimp:34,cook_fish:38,cook_meat:31,bake_bread:38,cook_trout:50,cook_salmon:58,cook_lobster:74,cook_swordfish:86,cook_stormfin:99};
 for(const [id,stop]of Object.entries(stops))assert.equal(professionRecipes[id].stopBurn,stop,id);
 assert.equal(formatXp(6.25),'6.25');assert.equal(formatXp(17.5),'17.5');assert.equal(formatXp(202.5),'202.5');assert.equal(formatXp(40),'40');
});
test('migration keeps every current level and the progress within it',()=>{
 const oldLevel=xp=>Math.min(99,1+Math.floor(Math.sqrt(xp/50)));
 for(let xp=0;xp<=520000;xp+=137){const n=migrateLegacyXp(xp);assert.equal(skillLevel(n),oldLevel(xp),'xp '+xp)}
 for(let l=1;l<=99;l++){assert.equal(migrateLegacyXp(50*(l-1)**2),xpForLevel(l))}
 // Halfway through old level 20 lands halfway through OSRS level 20.
 const half=50*19**2+Math.floor((50*20**2-50*19**2)/2),n=migrateLegacyXp(half);assert.ok(Math.abs(xpProgress(n).fraction-.5)<.01);
 assert.equal(migrateLegacyXp(480200),13034431);assert.equal(migrateLegacyXp(500000),13034431+19800);
 assert.equal(migrateLegacyXp(188,{hitpoints:true}),1154);assert.equal(migrateLegacyXp(4050,{hitpoints:true}),1154);assert.equal(skillLevel(migrateLegacyXp(20000,{hitpoints:true})),21);
 // Idempotence is enforced by the per-player flag; the pure map itself is not a projection.
});
test('food ladder heals a rising share of max HP, starting with the Sundae at 25%',()=>{
 const pct=foodLadder.map(f=>f.healPct);assert.equal(foodLadder[0].id,'sundae');assert.equal(pct[0],25);assert.equal(Math.min(...pct),25);
 for(let i=1;i<pct.length;i++)assert.ok(pct[i]>pct[i-1]);assert.ok(pct.at(-1)>=70&&pct.at(-1)<=80);
 assert.deepEqual(foodLadder.map(f=>f.id),['sundae','shrimp','trout','salmon','lobster','swordfish','stormfin']);
 assert.equal(healAmount(goods.sundae,100,0),25);assert.equal(healAmount(goods.sundae,990,0),248);assert.equal(healAmount(goods.stormfin,990,0),773);
 assert.equal(healAmount(goods.lobster,500,480),20,'never past max HP');assert.equal(healAmount(goods.salmon,500,500),0);
 assert.equal(healAmount(goods.apple,100,0),4,'legacy flat foods keep their heal');
 assert.ok(EAT_DELAY>=1.8);
 for(const f of foodLadder){assert.ok(isFood(goods[f.id]),f.id);assert.equal(goods[f.id].category,'Food');if(f.raw){assert.ok(goods[f.raw.id],f.raw.id);assert.ok(!isFood(goods[f.raw.id]));const r=professionRecipes['cook_'+f.id];assert.equal(r.level,f.cookLevel);assert.deepEqual(r.inputs,{[f.raw.id]:1});assert.deepEqual(r.outputs,{[f.id]:1});assert.ok(fishTable.some(t=>t.item===f.raw.id&&t.level===f.raw.fishLevel))}}
 for(let i=2;i<foodLadder.length;i++)assert.ok(foodLadder[i].cookLevel>=foodLadder[i-1].cookLevel);
 assert.ok(goods.harpoon&&goods.lobsterPot);assert.equal(Object.keys(foodRecipes).length,6);
});
test('fishing rolls the best eligible fish first, each with its own OSRS chance',()=>{
 const seq=(...v)=>()=>v.length?v.shift():.999;
 assert.equal(fishCatch('harpoon',49,seq(0)),null,'level too low');
 assert.equal(fishCatch('harpoon',80,seq(0)).item,'rawStormfin');assert.equal(fishCatch('harpoon',80,seq(.99,0)).item,'rawSwordfish');assert.deepEqual(fishCatch('harpoon',80,seq(.99,.99)),{},'nothing bites: no fish, no XP');
 assert.equal(fishCatch('rod',35,seq(0)).item,'rawSalmon');assert.equal(fishCatch('rod',35,seq(.99,0)).item,'rawTrout');assert.equal(fishCatch('rod',35,seq(.99,.99,0)).item,'rawFish');
 assert.equal(fishCatch('net',1,seq(.18)).item,'rawShrimp');assert.deepEqual(fishCatch('net',1,seq(.2)),{},'shrimp at Fishing 1: 49/256');
 for(let level=1;level<=99;level+=7)for(const m of ['net','rod','cage','harpoon']){const c=fishCatch(m,level,()=>0);if(c?.item)assert.ok(c.level<=level)}
 assert.deepEqual(fishTable.map(f=>[f.item,f.level,f.xp]),[['rawShrimp',1,10],['rawFish',1,20],['rawTrout',20,50],['rawSalmon',30,70],['rawLobster',40,90],['rawSwordfish',50,100],['rawStormfin',76,110]]);
});
test('eating hides the weapon and shield, lifts the right hand to the mouth, then restores them',()=>{
 const root=new T.Group(),rig=buildHumanoid(T,root),a=createHumanoidAnimator(rig);const sword=attachWeapon(rig,makeWeapon(T,'longsword'),'longsword'),shield=attachShield(rig,makeShield(T,'kite'));
 a.update(1/60,{});root.updateMatrixWorld(true);const head=new T.Vector3(),hand=new T.Vector3();rig.bones.Head.getWorldPosition(head);rig.bones.hand_r.getWorldPosition(hand);const rest=hand.distanceTo(head);
 let pose;for(let t=1.1;t>.5;t-=1/60)pose=a.update(1/60,{eat:t,food:goods.trout});root.updateMatrixWorld(true);rig.bones.hand_r.getWorldPosition(hand);
 assert.equal(sword.visible,false);assert.equal(shield.visible,false);assert.ok(pose.bite>.9);assert.ok(hand.distanceTo(head)<rest*.6,'hand near the mouth: '+hand.distanceTo(head).toFixed(2)+' vs '+rest.toFixed(2));
 let morsel=null;rig.rightHand.traverse(o=>{if(o.userData.eatMorsel)morsel=o});assert.ok(morsel?.visible);
 a.update(1/60,{eat:0});assert.equal(sword.visible,true);assert.equal(shield.visible,true);assert.equal(morsel.visible,false);
 assert.equal(eatWeight(0),0);assert.equal(eatWeight(1.1),0);assert.equal(eatWeight(.55),1);
});
