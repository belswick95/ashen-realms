import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import fs from 'node:fs';
import {createCombatTimeline,MAX_HOLD} from '../combat-timeline.js';import {impactDelay,monsterStrike,ATTACK_DURATION} from '../attack-motion.js';
import {buildHumanoid} from '../humanoid.js';import {createHumanoidAnimator} from '../animation.js';import {attachWeapon} from '../equipment-pose.js';import {makeWeapon} from '../weapons.js';

// Replays one realm poll the way game.js handles it (snapshot first, then that poll's events) with a
// virtual clock and a real animator on the attacker, and logs what the player sees, in order.
function oneShotKill(weapon,{distance=2,sameBatch=true,windupMissing=false,pollGap=.7}={}){
 let t=10;const now=()=>t,tl=createCombatTimeline({now}),log=[],at=what=>log.push({what,t:+(t-10).toFixed(4)});
 const root=new T.Group(),rig=buildHumanoid(T,root),anim=createHumanoidAnimator(rig);attachWeapon(rig,makeWeapon(T,weapon),weapon);
 for(let i=0;i<30;i++)anim.update(1/60,{weapon,armed:true});
 const pair='player:me>actor:rat',target='actor:rat',view={hp:5,shownHp:undefined,alive:true,deathHeld:false};let attack=0;
 const swing=()=>{if(windupMissing&&!sameBatch)return;tl.swing(pair,target,impactDelay(weapon,{distance}));attack=ATTACK_DURATION};
 const snapshotKill=()=>{view.shownHp=view.hp;view.hp=0;tl.target(target,()=>{view.shownHp=undefined;at('hp bar drops')},'hp');view.deathHeld=true;tl.target(target,()=>{view.deathHeld=false;view.alive=false;at('death')},'death')};
 const hitEvent=()=>{if(!tl.swinging(pair,1.5)){tl.swing(pair,target,impactDelay(weapon,{distance}));attack=ATTACK_DURATION}tl.hit(pair,target,()=>at('hitsplat'))};
 const frames=n=>{for(let i=0;i<n;i++){t+=1/60;const pose=anim.update(1/60,{weapon,armed:true,attack});attack=Math.max(0,attack-1/60);if(pose.swing&&pose.swing.t<=1/60+1e-9)at('swing');if(pose.strike)at('strike');tl.update();
  // While the death is held the target is drawn alive and standing.
  if(view.deathHeld)assert.ok(view.alive,'held death keeps the target alive');}};
 if(sameBatch){snapshotKill();if(!windupMissing)swing();hitEvent();frames(120)}
 else{swing();frames(Math.round(pollGap*60));snapshotKill();hitEvent();frames(90)}
 anim.dispose();return {log,order:log.map(l=>l.what),time:w=>log.find(l=>l.what===w)?.t};
}

for(const [label,weapon,distance] of [['melee (red scimitar)','embersteelScimitar',2],['melee (warhammer)','warhammer',2.2],['ranged (longbow)','longbow',11],['magic (ember staff)','emberStaff',9]]){
 test(`one-shot kill, ${label}: swing, strike, hitsplat, death, in that order`,()=>{
  const r=oneShotKill(weapon,{distance});
  assert.deepEqual(r.order.filter(w=>w!=='hp bar drops'),['swing','strike','hitsplat','death'],JSON.stringify(r.log));
  assert.equal(r.time('swing'),+(1/60).toFixed(4),'the swing starts on the first frame');
  const impact=impactDelay(weapon,{distance});
  assert.ok(r.time('hitsplat')>=r.time('strike'),'no hitsplat before the strike');
  assert.ok(Math.abs(r.time('hitsplat')-impact)<=1/60+1e-6,'hitsplat when the blow lands ('+impact.toFixed(3)+' s)');
  assert.ok(r.time('hp bar drops')>=r.time('strike')&&r.time('hp bar drops')<=r.time('death'),'hp bar drops with the hitsplat');
  assert.ok(r.time('death')>=impact-1e-9,'the target dies only once the blow has landed');
  if(!/Bow|Staff/i.test(weapon))assert.ok(r.time('hitsplat')<=.3,'melee: the hit feels simultaneous with the swing');
 });
}

test('a death that arrives before the swing (no wind-up seen) still waits for a swing started at once',()=>{
 const r=oneShotKill('embersteelScimitar',{windupMissing:true});
 assert.deepEqual(r.order.filter(w=>w!=='hp bar drops'),['swing','strike','hitsplat','death']);
 assert.ok(r.time('death')>=impactDelay('embersteelScimitar',{distance:2})-1e-9);
});

test('a kill reported a poll after the swing (the blow already landed) shows at once, hit before death',()=>{
 const r=oneShotKill('embersteelScimitar',{sameBatch:false,pollGap:.7});
 assert.deepEqual(r.order.filter(w=>w!=='hp bar drops'),['swing','strike','hitsplat','death']);
 assert.ok(r.time('death')-r.time('hitsplat')<=2/60+1e-6,'no added delay once the blow has landed');
});

test('timeline: hits without a swing show now, held changes wait for every blow on the target, and nothing waits forever',()=>{
 let t=0;const tl=createCombatTimeline({now:()=>t}),log=[];
 tl.hit('a>x','x',()=>log.push('free hit'));assert.deepEqual(log,['free hit']);
 tl.swing('a>x','x',.3);tl.swing('b>x','x',.5);tl.target('x',()=>log.push('death'),'death');tl.hit('b>x','x',()=>log.push('b hit'));tl.hit('a>x','x',()=>log.push('a hit'));
 tl.update();assert.deepEqual(log,['free hit']);t=.31;tl.update();assert.deepEqual(log,['free hit','a hit']);t=.51;tl.update();assert.deepEqual(log,['free hit','a hit','b hit','death']);
 tl.target('y',()=>log.push('respawned?'),'death');tl.cancel('y');t=1;tl.update();assert.ok(!log.includes('respawned?'));
 tl.swing('c>z','z',99);tl.target('z',()=>log.push('late death'),'death');t=1+MAX_HOLD+.01;tl.update();assert.ok(log.includes('late death'),'a stuck blow never holds a death for ever');
 assert.ok(monsterStrike(.65)>.18&&monsterStrike(.65)<.45);assert.ok(monsterStrike(1.1,{ranged:true,distance:6})>monsterStrike(1.1));
});

test('game.js routes hitsplats, hp bars and deaths through the timeline (client presentation only)',()=>{
 const game=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');
 for(const s of ["combatTimeline.update();","combatTimeline.hit(e.poison?'poison>'+victim:pair","combatTimeline.target(actorKey(e.target),","combatTimeline.target(playerKey(e.player),","actor.deathHeld=true;combatTimeline.target(key,","holdHp(playerKey(selfId),combat,","hp:a.shownHp??a.serverPose?.hp??a.hp","playerSwing({...e,type:'windup'},selfId)"])assert.ok(game.includes(s),s);
});
