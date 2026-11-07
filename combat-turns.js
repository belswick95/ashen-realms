// Offline / prediction combat clock (docs/mechanics-spec.md 4.1 and 4.3): the player and the
// opponent each have their own attack timer in 600 ms ticks — combat is not turn-based, both can
// swing on the same tick. A swing (wind-up) lands after its hit delay: the player's hit shows one
// tick later on an NPC, an NPC's melee lands at once. The server (db/mechanics-ii-2-combat.sql)
// runs the same rules; this keeps the single-player fallback and its tests in step with it.
export const COMBAT_TICK=.6;
export const periodTicks=seconds=>Math.max(1,Math.round((Number(seconds)||1.8)/COMBAT_TICK));
export function createCombatTurns({interval,onWindup,onImpact,onEnd=()=>{},delay=side=>side==='player'?1:0}){
 let target=null,side='player',phase='ready',clock=0,stalled=0,timers={player:0,enemy:0},impacts=[];
 const cancel=()=>{if(target)onEnd(target);target=null;phase='ready';clock=0;stalled=0;impacts=[];timers={player:0,enemy:0}};
 function step(inRange){
  for(const s of ['enemy','player']){
   if(timers[s]>0)timers[s]--;
   if(!target?.alive||!inRange||timers[s]>0)continue;
   timers[s]=periodTicks(interval(s,target));side=s;phase='windup';onWindup(s,target);
   impacts.push({side:s,at:delay(s)});
  }
  const due=impacts.filter(i=>i.at<=0);impacts=impacts.filter(i=>i.at>0).map(i=>({...i,at:i.at-1}));
  for(const i of due){if(!target?.alive)break;onImpact(i.side,target)}
  if(!impacts.length)phase='ready';
 }
 return {get target(){return target},get side(){return side},get phase(){return phase},get timers(){return {...timers}},cancel,
  engage(next,enemyFirst=false){if(!next?.alive)return false;if(target===next)return false;if(target)cancel();target=next;side=enemyFirst?'enemy':'player';phase='ready';clock=0;stalled=0;impacts=[];
   // Attacked first while idle: the player flinches (waits half the weapon speed).
   timers={enemy:0,player:enemyFirst?Math.floor(periodTicks(interval('player',next))/2):0};return true},
  tick(dt,{inRange=true,playerAlive=true}={}){if(!target)return;if(!target.alive||!playerAlive){cancel();return}dt=Math.max(0,Math.min(.1,dt));
   if(!inRange){stalled+=dt;if(stalled>6){cancel();return}}else stalled=0;
   clock+=dt;while(clock>=COMBAT_TICK-1e-9&&target){clock-=COMBAT_TICK;step(inRange);if(!target?.alive||!playerAlive){cancel();return}}
  }};
}
export {WALK_SPEED} from './click-walk.js?v=release-20261107-quests162';
export {RUN_SPEED as SPRINT_SPEED} from './click-walk.js?v=release-20261107-quests162';
