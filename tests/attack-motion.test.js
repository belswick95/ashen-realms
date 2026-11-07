import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import fs from 'node:fs';
import {weaponCatalog,makeWeapon} from '../weapons.js';import {UNIQUE_ITEMS} from '../unique-gear.js';
import {buildHumanoid} from '../humanoid.js';import {createHumanoidAnimator,STRIKE_KEYS,strikeKey} from '../animation.js';import {attachWeapon} from '../equipment-pose.js';
import {clipsFor} from '../character-assets.js';
import {attackKind,attackMotion,strikeTime,impactDelay,clipTime,MOTIONS,ATTACK_DURATION} from '../attack-motion.js';

// One attack with `key` in hand: the start pose, the farthest the weapon hand and the weapon's tip
// travel during the swing, the strike frame and the clip that played.
function swingOnce(key,{sex='male',options={}}={}){
 const root=new T.Group(),rig=buildHumanoid(T,root,{sex}),a=createHumanoidAnimator(rig),w=makeWeapon(T,key);attachWeapon(rig,w,key);
 for(let i=0;i<40;i++)a.update(1/60,{weapon:key,...options});root.updateMatrixWorld(true);
 const tipLocal=new T.Vector3(0,.5,0),hand0=rig.rightHand.getWorldPosition(new T.Vector3()),left0=rig.leftHand.getWorldPosition(new T.Vector3()),tip0=w.localToWorld(tipLocal.clone());
 let attack=ATTACK_DURATION,t=0,strikes=[],kind=null,clips=new Set(),hand=0,left=0,tip=0;
 for(let i=0;i<60;i++){const pose=a.update(1/60,{weapon:key,attack,...options});attack=Math.max(0,attack-1/60);t+=1/60;root.updateMatrixWorld(true);
  if(pose.swing){kind=kind||pose.swing.kind;if(pose.clip!=='Idle_Loop'&&pose.clip!=='Sword_Idle')clips.add(pose.clip)}if(pose.strike)strikes.push(t);
  hand=Math.max(hand,rig.rightHand.getWorldPosition(new T.Vector3()).distanceTo(hand0));left=Math.max(left,rig.leftHand.getWorldPosition(new T.Vector3()).distanceTo(left0));tip=Math.max(tip,w.localToWorld(tipLocal.clone()).distanceTo(tip0))}
 a.dispose();return {kind,strikes,clips:[...clips],hand,left,tip};
}
const ALL=Object.keys(weaponCatalog);

test('every weapon, uniques included, maps to a known attack motion whose clip exists',()=>{
 for(const u of UNIQUE_ITEMS.filter(u=>u.kind==='weapon'))assert.ok(weaponCatalog[u.id],u.id+' is in the weapon catalog');
 const clips=clipsFor('male'),female=clipsFor('female');
 for(const key of ALL){const m=attackMotion(key);assert.ok(MOTIONS[m.kind],key);if(m.clip){assert.ok(clips[m.clip]&&female[m.clip],key+' clip '+m.clip);assert.ok(clips[m.clip].duration>.3)}else assert.ok(m.layer||m.kind==='bow',key+' has a layer or the bow draw');if(m.layer&&m.layer!=='twoHand')assert.ok(STRIKE_KEYS[m.layer],key+' layer keys')}
});

test('weapon families attack the way they look: slash, stab, crush, chop, two-handed, bow, staff',()=>{
 const want={scimitar:'slash',embersteelScimitar:'slash',bronzeScimitar:'slash',longsword:'slash',shortsword:'slash',goldenSword:'slash',bronzeSword:'slash',
  dagger:'stab',steelDagger:'stab',broodfang:'stab',spear:'stab',rimeheartSpear:'stab',eldersteelSpear:'stab',
  hammer:'crush',warhammer:'crush',cindercoreMaul:'crush',verditeHammer:'crush',
  axe:'chop',battleaxe:'chop',waraxe:'chop',bronzeAxe:'chop',unbrokenCleaver:'chop',pickaxe:'chop',
  twohand:'heavy',claymore:'heavy',scythe:'heavy',twinflameGlaive:'heavy',tidesteelTwohand:'heavy',
  woodenBow:'bow',longbow:'bow',yewShortbow:'bow',bloodthornBow:'bow',
  apprenticeStaff:'cast',emberStaff:'cast',hollowScepter:'cast',tidecallerStaff:'cast'};
 for(const [key,kind] of Object.entries(want))assert.equal(attackKind(key),kind,key);
 assert.equal(attackKind(null),'punch');assert.equal(attackKind(null,{armed:true}),'slash');assert.equal(attackKind(null,{ranged:true}),'bow');assert.equal(attackKind(null,{magic:true}),'cast');
});

test('every weapon plays a real attack: one strike frame, early, with visible arm and weapon motion',()=>{
 for(const key of ALL){const r=swingOnce(key),m=attackMotion(key);
  assert.equal(r.kind,m.kind,key+' motion');assert.equal(r.strikes.length,1,key+' strikes once');
  if(m.clip)assert.ok(r.clips.includes(m.clip),key+' plays '+m.clip+' (got '+r.clips+')');
  // Melee blows land early in the swing (the owner wants swing and hit to feel simultaneous).
  if(!m.ranged)assert.ok(r.strikes[0]>.12&&r.strikes[0]<=.3,key+' strikes at '+r.strikes[0].toFixed(2)+' s');
  assert.ok(Math.abs(r.strikes[0]-strikeTime(key))<=1/60+1e-9,key+' strike frame matches strikeTime');
  // The weapon travels: hand and tip (bows: the draw hand and bow arm) move well clear of the guard pose.
  const moved=m.kind==='bow'?Math.max(r.hand,r.left):Math.max(r.hand,r.tip);
  assert.ok(moved>.45,key+' moves '+moved.toFixed(2));
  if(m.kind!=='bow'&&m.kind!=='cast')assert.ok(r.tip>.6,key+' weapon tip sweeps '+r.tip.toFixed(2));
  if(m.kind==='heavy'||m.twoHanded&&!m.ranged)assert.ok(r.left>.3,key+' off hand follows the grip');
 }
});

test('the female body attacks too, and an NPC holding a staff casts without the armed flag',()=>{
 for(const key of ['embersteelScimitar','dagger','warhammer','battleaxe']){const r=swingOnce(key,{sex:'female'});assert.equal(r.strikes.length,1,key);assert.ok(r.tip>.6,key)}
 const npc=swingOnce('sapphireStaff',{options:{armed:false}});assert.equal(npc.kind,'cast');assert.equal(npc.strikes.length,1);
});

test('clip motions are re-timed so the clip strike frame lands at the strike time',()=>{
 const m=MOTIONS.slash,D=1.53;assert.equal(clipTime(m,0,D),0);assert.ok(Math.abs(clipTime(m,m.strike,D)-m.clipStrike*D)<1e-9);assert.ok(clipTime(m,ATTACK_DURATION,D)<=D*m.clipEnd+1e-9);
 let last=-1;for(let t=0;t<=ATTACK_DURATION;t+=.01){const c=clipTime(m,t,D);assert.ok(c>=last);last=c}
 const k=strikeKey(STRIKE_KEYS.overhead,1);assert.ok(k.hand[0]>.7&&k.blade[1]<-.5,'crush lands forward and down');assert.ok(strikeKey(STRIKE_KEYS.overhead,.7).hand[1]>.6,'raised overhead first');
});

test('ranged blows land after the release plus the projectile flight',()=>{
 assert.ok(Math.abs(impactDelay('longbow',{distance:11})-(strikeTime('longbow')+11/55))<1e-9);
 assert.ok(impactDelay('sapphireStaff',{distance:8})>strikeTime('sapphireStaff'));
 assert.equal(impactDelay('embersteelScimitar',{distance:2}),strikeTime('embersteelScimitar'));
});

test('an enemy wind-up on the same tick never cancels the player swing (the missing scimitar attack)',()=>{
 const game=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.ok(!/combat\.attackAnim=0;combat\.blockAnim=1\.15/.test(game),'enemy wind-up must not zero the player attack');
 assert.ok(game.includes('if(isSelf){if(!(combat.attackAnim>0))combat.blockAnim=1.15}'));
 // Equal attack speeds put both wind-ups on one tick: the animator sees the swing as long as it is not zeroed.
 const root=new T.Group(),rig=buildHumanoid(T,root),a=createHumanoidAnimator(rig);attachWeapon(rig,makeWeapon(T,'embersteelScimitar'),'embersteelScimitar');
 let attack=ATTACK_DURATION,block=1.15,swung=false;for(let i=0;i<40;i++){const p=a.update(1/60,{weapon:'embersteelScimitar',armed:true,attack,block});attack=Math.max(0,attack-1/60);block=Math.max(0,block-1/60);if(p.clip==='Sword_Attack')swung=true}
 assert.ok(swung,'swing plays while guarding');
});
