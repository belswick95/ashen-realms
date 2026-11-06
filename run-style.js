// Grounded running. The Quaternius jog and sprint are athletic, cartoony
// cycles (deep knee bend, big hip bounce, fists pumped to the chest, strong
// lean). Played at Eldervale's running speed they read as bouncy, so after the
// mixer (and the stride warp in gait-cadence.js) this layer calms the cycle:
//  - each upper-body bone keeps only part of its swing around the clip's own
//    cycle-average pose (spine, neck and head steady; arms swing less),
//  - the hips keep only part of their vertical bounce around the clip's average
//    height, no higher than the legs can reach,
//  - both ankles return to where the stride warp put them (planted feet stay
//    planted and keep moving back at the travel speed), straightening the knees,
//  - the forward lean is eased toward a slight, natural lean.
// Gameplay roots are never moved; only bone poses change.

// How much of each bone group's swing survives (1 = as authored, 0 = frozen at
// the cycle average). Per-gait so a sprint can stay a little livelier.
export const RUN_STYLE={
 Jog_Fwd_Loop:{bob:.34,spine:.45,head:.35,arm:.6,forearm:.55,lean:-8,lift:.07,flight:.5},
 Sprint_Loop:{bob:.42,spine:.55,head:.4,arm:.7,forearm:.65,lean:-9,lift:.06,flight:.6}
};
const UPPER={spine:['spine_01','spine_02','spine_03'],head:['neck_01','Head'],arm:['clavicle_l','clavicle_r','upperarm_l','upperarm_r'],forearm:['lowerarm_l','lowerarm_r','hand_l','hand_r']};
const LEGS=[['thigh_l','calf_l','foot_l','ball_l'],['thigh_r','calf_r','foot_r','ball_r']];

// Keep `keep` of the deviation of `value` from `mean` (pure helper, unit tested).
export function damp(value,mean,keep){return mean+(value-mean)*keep}
// Blend amount of the layer: full on a running gait, faded with the gait's weight.
export function runStyleWeight(gait,weight){return RUN_STYLE[gait]?Math.max(0,Math.min(1,Number(weight)||0)):0}
// Average of unit quaternions given as [x,y,z,w] arrays (sign-aligned to the first).
export function averageQuaternion(list){
 if(!list.length)return [0,0,0,1];const s=[0,0,0,0],ref=list[0];
 for(const q of list){const sign=q[0]*ref[0]+q[1]*ref[1]+q[2]*ref[2]+q[3]*ref[3]<0?-1:1;for(let i=0;i<4;i++)s[i]+=q[i]*sign}
 const n=Math.hypot(...s)||1;return s.map(v=>v/n);
}

const meanCache=new WeakMap();
// Cycle-average local rotation of each upper-body bone in a clip, and the
// clip's average hip height, sampled once per clip on the caller's skeleton
// (its pose is restored afterwards). Fixed references keep the layer
// stateless, so the pose never depends on the frame rate.
function cycleMeans(rig,clip,names){
 if(meanCache.has(clip))return meanCache.get(clip);
 const T=rig.T,b=rig.bones,saved=Object.values(b).map(o=>[o,o.position.clone(),o.quaternion.clone(),o.scale.clone()]);
 const mixer=new T.AnimationMixer(rig.model),action=mixer.clipAction(clip);action.play();
 const samples=Object.fromEntries(names.map(n=>[n,[]])),N=32,p=new T.Vector3();let hips=0;
 for(let i=0;i<N;i++){mixer.setTime(clip.duration*i/N);for(const n of names)samples[n].push(b[n].quaternion.toArray());rig.model.updateMatrixWorld(true);b.pelvis.getWorldPosition(p);hips+=rig.root.worldToLocal(p).y/N}
 action.stop();mixer.uncacheRoot(rig.model);
 for(const [o,pos,q,sc] of saved){o.position.copy(pos);o.quaternion.copy(q);o.scale.copy(sc)}rig.model.updateMatrixWorld(true);
 const out={hips,bones:Object.fromEntries(names.map(n=>[n,new T.Quaternion().fromArray(averageQuaternion(samples[n]))]))};
 meanCache.set(clip,out);return out;
}

// Highest the hip can rise (dy) with the ankle still reaching `foot` on a leg of
// length `reach` from `hip` (all in the character's frame). Pure, unit tested.
// Interior knee angle for thigh l1, shin l2 and hip-to-ankle distance d.
export function kneeAngle(l1,l2,d){return Math.acos(Math.max(-1,Math.min(1,(l1*l1+l2*l2-d*d)/(2*l1*l2))))}
export function hipRiseLimit(hip,foot,reach){const flat=(hip.x-foot.x)**2+(hip.z-foot.z)**2;if(flat>=reach*reach)return foot.y-hip.y;return foot.y-hip.y+Math.sqrt(reach*reach-flat)}

export function createRunStyle(rig){
 const T=rig.T,b=rig.bones;
 const groups=Object.fromEntries(Object.entries(UPPER).map(([k,list])=>[k,list.filter(n=>b[n])]));
 const names=Object.values(groups).flat();
 const legs=LEGS.filter(l=>l.every(n=>b[n]));
 if(!b.pelvis||legs.length<2)return {update(){}};
 const q=new T.Quaternion(),wq=new T.Quaternion(),pq=new T.Quaternion(),rot=new T.Quaternion(),p=new T.Vector3(),a=new T.Vector3(),c=new T.Vector3(),to=new T.Vector3(),axis=new T.Vector3(),hip=new T.Vector3(),knee=new T.Vector3();
 const plant=legs.map(()=>({at:new T.Vector3(),foot:new T.Quaternion(),ball:new T.Quaternion()}));
 const local=(bone,out)=>{bone.getWorldPosition(out);return rig.root.worldToLocal(out)};
 function turn(bone,rotation){bone.getWorldQuaternion(wq);bone.parent.getWorldQuaternion(pq);bone.quaternion.copy(pq.invert().multiply(rotation).multiply(wq));bone.updateMatrixWorld(true)}
 // Analytic two-bone IK: bend the knee to the length the goal needs (law of
 // cosines, about the knee's own bend axis), then swing the thigh onto it.
 function reach([thigh,calf,foot],goal){rig.root.localToWorld(to.copy(goal));
  b[thigh].getWorldPosition(hip);b[calf].getWorldPosition(knee);b[foot].getWorldPosition(c);
  const l1=hip.distanceTo(knee),l2=knee.distanceTo(c),d=Math.max(Math.abs(l1-l2)+1e-4,Math.min(l1+l2-1e-4,hip.distanceTo(to)));
  a.copy(hip).sub(knee);p.copy(c).sub(knee);axis.crossVectors(a,p);
  if(axis.lengthSq()>1e-10){const now=a.angleTo(p),want=kneeAngle(l1,l2,d);turn(b[calf],rot.setFromAxisAngle(axis.normalize(),want-now))}
  b[foot].getWorldPosition(c);a.copy(c).sub(hip).normalize();p.copy(to).sub(hip).normalize();if(a.dot(p)<.9999999)turn(b[thigh],rot.setFromUnitVectors(a,p))}
 return {
  update(clip,gait,weight){
   const style=RUN_STYLE[gait];weight=runStyleWeight(gait,weight);if(!style||!clip||weight<=0)return;
   rig.model.updateMatrixWorld(true);
   // Where each foot is before the layer: the warp left the stance foot planted
   // and moving back at the travel speed, so every ankle returns here.
   legs.forEach(([, ,foot,ball],i)=>{local(b[foot],plant[i].at);b[foot].getWorldQuaternion(plant[i].foot);b[ball].getWorldQuaternion(plant[i].ball)});
   // Upper body: keep part of each bone's swing around the clip's average pose.
   const means=cycleMeans(rig,clip,names);
   for(const [group,list] of Object.entries(groups)){const keep=1-(1-style[group])*weight;for(const n of list)b[n].quaternion.copy(q.copy(means.bones[n]).slerp(b[n].quaternion,keep))}
   // Lean: pitch the lower spine back about the character's left axis.
   if(style.lean&&b.spine_01){rig.root.getWorldQuaternion(wq);axis.set(1,0,0).applyQuaternion(wq);turn(b.spine_01,rot.setFromAxisAngle(axis,style.lean*Math.PI/180*weight))}
   // Hips: keep part of the vertical bounce around the clip's average height,
   // never higher than both legs can still reach their feet.
   const pelvis=b.pelvis;rig.model.updateMatrixWorld(true);local(pelvis,p);
   let dy=damp(p.y,means.hips+(style.lift||0)*weight,1-(1-style.bob)*weight)-p.y;
   for(const [i,[thigh,calf,foot]] of legs.entries()){local(b[thigh],hip);local(b[calf],knee);local(b[foot],c);const length=(hip.distanceTo(knee)+knee.distanceTo(c))*.985;dy=Math.min(dy,hipRiseLimit(hip,plant[i].at,length))}
   p.y+=dy;rig.root.localToWorld(p);pelvis.parent.worldToLocal(p);pelvis.position.copy(p);rig.model.updateMatrixWorld(true);
   // Feet back where they were, at the same angle as before.
   legs.forEach((leg,i)=>{reach(leg,plant[i].at);
    rot.copy(plant[i].foot).multiply(b[leg[2]].getWorldQuaternion(pq).invert());turn(b[leg[2]],rot);
    rot.copy(plant[i].ball).multiply(b[leg[3]].getWorldQuaternion(pq).invert());turn(b[leg[3]],rot)});
   rig.model.updateMatrixWorld(true);
  }
 };
}
