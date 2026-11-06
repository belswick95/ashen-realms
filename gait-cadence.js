// Cadence and stride for clip-driven gaits. A locomotion clip has one native
// speed (STRIDE in animation.js) at one native cadence; slowing the clip down
// to a slower ground speed gives slow-motion giant strides. Instead the clip
// plays at a natural step rate for the speed and the leg swing is shortened
// (thighs and knees eased toward their mid-stance pose) so the planted foot
// travels backward at the real ground speed.
export const MIN_STRIDE=.3;
// Planted-foot travel shrinks a little faster than the swing it is eased by
// (measured on the Quaternius jog and sprint), so the swing is eased by
// amplitude^0.8 for the travel to match `amplitude`.
const SWING=1;
// Natural step rate (steps per second) for a ground speed in metres per second.
// Walking cadence grows with the square root of speed; running cadence grows
// slowly and almost linearly (≈160 steps/min at 3 m/s, ≈170 at 4 m/s).
export function stepRate(gait,metresPerSecond){const m=Math.max(.05,metresPerSecond);return gait==='Walk_Loop'?1.5*Math.sqrt(m/1.03):2.1+.16*m}
// Playback for a clip: timeScale (cadence) and amplitude (stride, 1 = as authored).
export function gaitPlayback(gait,speed,{stride,duration,scale=1}){
 if(!(stride>0)||!(duration>0)||!(speed>0))return {timeScale:1,amplitude:1};
 let timeScale=stepRate(gait,speed/scale)/(2/duration),amplitude=speed/(stride*timeScale);
 if(amplitude>1){amplitude=1;timeScale=speed/stride}else if(amplitude<MIN_STRIDE){amplitude=MIN_STRIDE;timeScale=speed/(stride*MIN_STRIDE)}
 timeScale=Math.max(.5,Math.min(2.4,timeScale));
 return {timeScale,amplitude};
}

const LEGS=[['l','thigh_l','calf_l','ball_l'],['r','thigh_r','calf_r','ball_r']];
const pivotCache=new WeakMap();
// Mid-stance thigh and calf rotations of each leg in a clip, sampled once per
// clip on the caller's own skeleton (its pose is restored afterwards).
function stancePivots(rig,clip){
 if(pivotCache.has(clip))return pivotCache.get(clip);
 const T=rig.T,b=rig.bones,saved=Object.values(b).map(o=>[o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]);
 const mixer=new T.AnimationMixer(rig.model),action=mixer.clipAction(clip);action.play();
 const N=48,p=new T.Vector3(),samples=[];
 for(let i=0;i<N;i++){mixer.setTime(clip.duration*i/N);rig.model.updateMatrixWorld(true);const s={low:Infinity};for(const n of ['foot_l','foot_r','ball_l','ball_r'])if(b[n]){b[n].getWorldPosition(p);rig.root.worldToLocal(p);s.low=Math.min(s.low,p.y)}for(const [side,thigh,calf,ball] of LEGS){b[ball].getWorldPosition(p);rig.root.worldToLocal(p);s[side]={y:p.y,z:p.z,thigh:b[thigh].quaternion.clone(),calf:b[calf].quaternion.clone()}}samples.push(s)}
 action.stop();mixer.uncacheRoot(rig.model);
 for(const [o,pos,q,sc] of saved){o.position.copy(pos);o.quaternion.copy(q);o.scale.copy(sc)}rig.model.updateMatrixWorld(true);
 const out={ground:Math.min(...samples.map(s=>s.low))};
 for(const [side] of LEGS){const low=Math.min(...samples.map(s=>s[side].y)),stance=samples.filter(s=>s[side].y<low+.06*(rig.model.scale.y||1));const zs=stance.map(s=>s[side].z),mid=(Math.max(...zs)+Math.min(...zs))/2;
  out[side]=stance.reduce((best,s)=>Math.abs(s[side].z-mid)<Math.abs(best[side].z-mid)?s:best)[side]}
 pivotCache.set(clip,out);return out;
}

// Shorten the stride of the pose the mixer just wrote. `amount` is the stride
// amplitude (1 leaves the clip untouched). The hips are re-seated so the
// lowest foot stays on the ground and the flight phase rises in proportion to
// the shorter stride (short strides bounce less).
export function createStrideWarp(rig){
 const T=rig.T,b=rig.bones,q=new T.Quaternion(),p=new T.Vector3(),feet=['foot_l','foot_r','ball_l','ball_r'].map(n=>b[n]).filter(Boolean);
 if(!b.pelvis||!LEGS.every(([,t,c,f])=>b[t]&&b[c]&&b[f]))return ()=>{};
 function lowest(){rig.model.updateMatrixWorld(true);let y=Infinity;for(const f of feet){f.getWorldPosition(p);rig.root.worldToLocal(p);if(p.y<y)y=p.y}return y}
 return function warp(clip,amount){
  if(!clip||!(amount<.995))return;const travel=Math.max(0,amount);amount=travel**SWING;
  const pivots=stancePivots(rig,clip),before=lowest(),target=pivots.ground+(before-pivots.ground)*travel*travel;
  for(const [side,thigh,calf] of LEGS){b[thigh].quaternion.copy(q.copy(pivots[side].thigh).slerp(b[thigh].quaternion,amount));b[calf].quaternion.copy(q.copy(pivots[side].calf).slerp(b[calf].quaternion,Math.sqrt(amount)))}
  const drop=target-lowest();
  if(Math.abs(drop)>1e-5){const pelvis=b.pelvis;pelvis.getWorldPosition(p);rig.root.worldToLocal(p);p.y+=drop;rig.root.localToWorld(p);pelvis.parent.worldToLocal(p);pelvis.position.copy(p)}
  rig.model.updateMatrixWorld(true);
 };
}
