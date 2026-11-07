// Client-side combat presentation order (no server timing or results change here).
//
// The realm server resolves an attack on its 600 ms tick: a wind-up event, then (one tick later
// for a player's hit on an NPC, at once for an NPC's melee) the hit, the hp change in the snapshot
// and, on a kill, the death. A poll can deliver several ticks at once, and the client applies the
// snapshot before that poll's events, so a one-shot kill could topple the target before the
// attacker had even started to swing.
//
// The timeline keeps the presentation causal:
//  swing(pair, target, delay)  an attack started now; its blow lands `delay` seconds from now (the
//                              weapon's strike frame, plus the projectile's flight for bows and staffs)
//  hit(pair, target, fn)       show the hitsplat / impact / hp drop: at the pair's blow, or now if it
//                              has already landed (or no swing is known)
//  target(target, fn, kind)    a state change of the target that must not show before a blow lands:
//                              'hp' (the bar drops) or 'death'. It is held at least until the next
//                              update() (so a wind-up later in the same poll still counts), then until
//                              every blow on that target that was under way has landed, and a death
//                              always after that target's pending hitsplats.
// update() runs whatever is due, in order: earlier first; at the same moment hits, then hp, then deaths.
const ORDER={hit:0,hp:1,death:2};
export const SAME_POLL=.15,MAX_HOLD=2.5;
export function createCombatTimeline({now=()=>performance.now()/1000}={}){
 const blows=new Map(),queue=[];let seq=0;
 const latestBlow=(target,before=Infinity)=>{let at=-Infinity;for(const b of blows.values())if(b.target===target&&b.started<=before&&b.at>at)at=b.at;return at};
 function prune(t){for(const [k,b] of blows)if(b.at<t-5)blows.delete(k)}
 const api={
  swing(pair,target,delay=0){const t=now(),at=t+Math.max(0,Number(delay)||0);blows.set(pair,{target,at,started:t});if(blows.size>256)prune(t);return at},
  // The time the pair's blow lands (null if no swing is known).
  impactAt(pair){return blows.get(pair)?.at??null},
  // A swing for the pair started within `window` seconds (its blow may still be on the way).
  swinging(pair,window=1){const b=blows.get(pair);return !!b&&now()-b.started<=window},
  // The latest blow on a target that has not landed yet (null if none).
  pendingBlow(target){const at=latestBlow(target);return at>now()?at:null},
  hit(pair,target,fn){const at=blows.get(pair)?.at??-Infinity;if(at<=now()&&!queue.some(q=>q.target===target&&q.kind==='hit')){fn();return 0}
   queue.push({kind:'hit',target,fn,at,queued:now(),seq:seq++});return Math.max(0,at-now())},
  target(target,fn,kind='hp'){queue.push({kind,target,fn,at:null,queued:now(),seq:seq++})},
  // Drop held changes for a target (it respawned or left the view), optionally of one kind.
  cancel(target,kind=null){for(let i=queue.length-1;i>=0;i--)if(queue[i].target===target&&queue[i].kind!=='hit'&&(!kind||queue[i].kind===kind))queue.splice(i,1)},
  held(target,kind=null){return queue.some(q=>q.target===target&&(!kind||q.kind===kind))},
  get size(){return queue.length},
  update(){const t=now();if(!queue.length)return 0;
   // Resolve each held change: the latest blow on its target that started by the end of its poll.
   const due=t=>q=>{if(q.kind==='hit')return q.at<=t;if(t-q.queued>=MAX_HOLD)return true;if(t-q.queued<1e-9&&!q.seen){q.seen=true;return false}q.seen=true;
    const blow=latestBlow(q.target,q.queued+SAME_POLL);if(blow>t)return false;
    // A death (or hp drop) never shows before the hitsplats queued ahead of it on the same target.
    return !queue.some(o=>o!==q&&o.target===q.target&&o.seq<q.seq&&ORDER[o.kind]<ORDER[q.kind]&&!o.ready)};
   const ready=[];
   for(let pass=0;pass<3;pass++)for(const q of queue)if(!q.ready&&due(t)(q)){q.ready=true;ready.push(q)}
   ready.sort((a,b)=>(Math.min(a.at??t,t)-Math.min(b.at??t,t))||ORDER[a.kind]-ORDER[b.kind]||a.seq-b.seq);
   for(const q of ready){const i=queue.indexOf(q);if(i>=0)queue.splice(i,1)}
   for(const q of ready)q.fn();
   return ready.length}
 };
 return api;
}
