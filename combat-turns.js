// One attack at a time: wind-up, impact/reaction, recovery, then the opponent.
export function createCombatTurns({interval,onWindup,onImpact,onEnd=()=>{}}){
 let target=null,side='player',phase='ready',remaining=0,turnLength=0,stalled=0;
 const cancel=()=>{if(target)onEnd(target);target=null;phase='ready';remaining=0;stalled=0};
 return {get target(){return target},get side(){return side},get phase(){return phase},cancel,
 engage(next,enemyFirst=false){if(!next?.alive)return false;if(target===next)return false;if(target)cancel();target=next;side=enemyFirst?'enemy':'player';phase='ready';remaining=0;stalled=0;return true},
 tick(dt,{inRange=true,playerAlive=true}={}){if(!target)return;if(!target.alive||!playerAlive){cancel();return}dt=Math.max(0,Math.min(.1,dt));if(!inRange){if(phase==='windup'){phase='ready';remaining=0}stalled+=dt;if(stalled>6)cancel();return}stalled=0;
  if(phase==='ready'){turnLength=Math.max(1.3,interval(side,target));phase='windup';remaining=side==='player'?.45:.50;onWindup(side,target)}
  remaining-=dt;if(remaining>0)return;
  if(phase==='windup'){onImpact(side,target);if(!target?.alive||!playerAlive){cancel();return}phase='reaction';remaining=.75}
  else if(phase==='reaction'){phase='recovery';remaining=Math.max(.25,turnLength-(side==='player'?.45:.50)-.75)}
  else{side=side==='player'?'enemy':'player';phase='ready';remaining=0}
 }};
}
export {WALK_SPEED} from './click-walk.js?v=release-20261105-camera74';
export {RUN_SPEED as SPRINT_SPEED} from './click-walk.js?v=release-20261105-camera74';
