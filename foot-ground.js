// Per-foot ground contact for clip-driven humanoids (humanoid.js rigs: leftLeg/leftKnee/leftAnkle =
// thigh/calf/foot bones, footHeight = ankle height above the soles in the bind pose).
// The body used to be lifted until the most-sunken foot cleared the ground, which on a slope left
// the uphill foot buried or the downhill foot floating. Now, each frame after the animation pose:
//  1. sample the ground under each planted ankle,
//  2. move the pelvis (the visual root) to the LOWER foot: down on slopes, up on a rise (capped),
//  3. lift any foot that would still sink with a two-bone leg IK (thigh + calf), keeping the foot's
//     world orientation so the sole stays level.
// Idempotent: the bones it bends are restored on the next call if the animator did not pose them
// again (LOD frames), so corrections never accumulate. No allocations per call.
export const FOOT_SHIFT_LIMIT=.3, FOOT_LIFT_LIMIT=.4, FOOT_EPSILON=.004;

const SIDES=['left','right'];
const scratchByThree=new WeakMap();
const scratchFor=T=>{let s=scratchByThree.get(T);if(s)return s;
 const v=()=>new T.Vector3(),q=()=>new T.Quaternion();
 s={H:v(),K:v(),A:v(),At:v(),u:v(),w:v(),n:v(),a:v(),b:v(),q1:q(),q2:q(),q3:q(),footWorld:q()};scratchByThree.set(T,s);return s;};

// The planted-foot errors (ground + footHeight - ankle y) and the pelvis shift they call for.
// `errors` is reused: {left,right} (NaN for a foot in the air). Exported for tests.
export function footShift(errors,contacts=null){
 let shift=Infinity;for(const side of SIDES){if(contacts&&!contacts[side])continue;const e=errors[side];if(Number.isFinite(e))shift=Math.min(shift,e)}
 if(!Number.isFinite(shift))return 0;return Math.max(-FOOT_SHIFT_LIMIT,Math.min(FOOT_SHIFT_LIMIT,shift));
}

// World-space rotation `R` applied to `bone` (premultiplied in world space), written as a local quaternion.
function rotateBoneWorld(bone,R,s){
 const parent=bone.parent;parent.getWorldQuaternion(s.q2);           // P
 s.q3.copy(s.q2).invert();                                             // P^-1
 bone.quaternion.premultiply(s.q2).premultiply(R).premultiply(s.q3);   // P^-1 * R * P * q
 bone.updateWorldMatrix(false,true);
}

function remember(rig,bone){const list=rig.__footIk||(rig.__footIk=[]);let e=list.find(x=>x.bone===bone);if(!e){e={bone,original:bone.quaternion.clone(),applied:bone.quaternion.clone(),active:false};list.push(e)}if(!e.active){e.original.copy(bone.quaternion);e.active=true}return e}

// Bend thigh+calf so the ankle rises by `dy` (world units), keep the foot's world rotation.
export function liftFoot(T,thigh,calf,foot,dy,s=scratchFor(T)){
 thigh.getWorldPosition(s.H);calf.getWorldPosition(s.K);foot.getWorldPosition(s.A);foot.getWorldQuaternion(s.footWorld);
 s.At.copy(s.A);s.At.y+=dy;
 const l1=s.H.distanceTo(s.K),l2=s.K.distanceTo(s.A);if(!(l1>1e-4&&l2>1e-4))return false;
 const d=Math.max(Math.abs(l1-l2)+1e-4,Math.min(l1+l2-1e-4,s.H.distanceTo(s.At)));
 s.u.subVectors(s.H,s.K).normalize();s.w.subVectors(s.A,s.K).normalize();
 const now=Math.acos(Math.max(-1,Math.min(1,s.u.dot(s.w)))),want=Math.acos(Math.max(-1,Math.min(1,(l1*l1+l2*l2-d*d)/(2*l1*l2))));
 s.n.crossVectors(s.u,s.w);
 if(s.n.lengthSq()<1e-10){s.n.set(1,0,0).applyQuaternion(thigh.getWorldQuaternion(s.q1))}// straight leg: bend about the thigh's side axis
 s.n.normalize();
 if(Math.abs(want-now)>1e-5){s.q1.setFromAxisAngle(s.n,want-now);rotateBoneWorld(calf,s.q1,s)}
 foot.getWorldPosition(s.A);s.a.subVectors(s.A,s.H).normalize();s.b.subVectors(s.At,s.H).normalize();
 s.q1.setFromUnitVectors(s.a,s.b);rotateBoneWorld(thigh,s.q1,s);
 // Keep the sole's world orientation: local = parentWorld^-1 * footWorld.
 foot.parent.getWorldQuaternion(s.q2);foot.quaternion.copy(s.q2.invert().multiply(s.footWorld));foot.updateWorldMatrix(false,true);
 return true;
}

// groundAt(x,z) -> ground height. Returns the pelvis shift applied (for tests / debugging).
export function plantFeet(T,rig,visual,groundAt,contacts=null){
 const s=scratchFor(T);
 // Undo last call's bends if the animator did not pose those bones again since.
 if(rig.__footIk)for(const e of rig.__footIk){if(e.active&&e.bone.quaternion.equals(e.applied))e.bone.quaternion.copy(e.original);e.active=false}
 visual.updateWorldMatrix(true,true);
 const errors=rig.__footErrors||(rig.__footErrors={left:NaN,right:NaN});
 for(const side of SIDES){const ankle=rig[side+'Ankle'];errors[side]=NaN;if(!ankle||contacts&&!contacts[side])continue;ankle.getWorldPosition(s.A);errors[side]=groundAt(s.A.x,s.A.z)+rig.footHeight+(rig.footLift?.[side]||0)-s.A.y}
 const shift=footShift(errors,contacts);
 if(shift){visual.position.y+=shift;visual.updateWorldMatrix(false,true)}
 for(const side of SIDES){const e=errors[side];if(!Number.isFinite(e))continue;const residual=Math.min(FOOT_LIFT_LIMIT,e-shift);if(residual<=FOOT_EPSILON)continue;
  const thigh=rig[side+'Leg'],calf=rig[side+'Knee'],foot=rig[side+'Ankle'];if(!thigh?.parent||!calf?.parent||!foot?.parent)continue;
  const mt=remember(rig,thigh),mc=remember(rig,calf),mf=remember(rig,foot);
  liftFoot(T,thigh,calf,foot,residual,s);mt.applied.copy(thigh.quaternion);mc.applied.copy(calf.quaternion);mf.applied.copy(foot.quaternion);
 }
 return shift;
}
