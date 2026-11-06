import {characterStore,CHARACTER_SCALE} from './character-assets.js?v=release-20261106-pond116';
// Procedural walk and run for every clip-driven human (player, remote players,
// NPCs). Inspired by the feel of the classic tick-based MMO walk: upright, a
// steady relaxed arm swing, a little bob, a calm head; the run leans in, pumps
// bent arms and lifts the knees. Original implementation on our own rig (see
// docs/locomotion-style.md); no animation data is copied from anywhere.
//
// The cycle is driven by distance, not time: the phase advances by the ground
// actually covered divided by the stride, and a planted foot moves backward in
// the body's frame at exactly that rate, so it stays put on the ground at any
// speed (tile walk, tile run, diagonal steps, legacy free movement, NPC strolls).
// Gameplay roots are never moved; only bone poses change.

// One tile is 1.58 units and one game tick 0.6 s (click-walk.js); walkers cross
// one tile per tick, runners two.
export const TILE=1.58,TICK=.6;
// Footfalls per tick at the tile speeds: a brisk walk lands 5 steps every 4
// ticks (step 0.8 tile), the run lands one foot on every tile (2 per tick).
export const STEPS_PER_TICK={walk:1.25,run:2};
export const WALK_REF=TILE/TICK,RUN_REF=2*TILE/TICK;
const clamp=(v,a,b)=>v<a?a:v>b?b:v,clamp01=v=>clamp(Number(v)||0,0,1),smooth=t=>{t=clamp(t,0,1);return t*t*(3-2*t)};
// Style of each gait (lengths in world units, angles in radians); runWeight
// mixes them, so walk -> run is one continuous cycle with no snap.
//  stance: share of the cycle a foot is planted; lift: swing foot height;
//  heel/toe: heel-strike and toe-off foot pitch; drop: hips below standing;
//  bob/sway: hip bounce and side shift; lean: forward body lean; yaw: pelvis
//  turn with the stride; arm: shoulder swing amplitude; flex: elbow bend;
//  abd: arms held away from the body; narrow: stance width; center: where the
//  ankle sits under the hip at mid-stance; kick: swing height shape (<1 lifts
//  the heel early, a running heel kick); tangent: how the swing foot speeds
//  into and out of the stance (ground-speed matching).
export const GAIT={
 walk:{stance:.56,lift:.11,heel:.22,toe:.75,drop:.05,bob:.012,sway:.018,lean:.04,yaw:.07,tangent:.45,lag:.04,arm:.36,flex:.2,flexSwing:.12,abd:.1,narrow:.8,center:-.12,kick:1,knee:.05},
 run:{stance:.36,lift:.42,heel:.06,toe:.62,drop:.15,bob:.022,sway:.008,lean:.24,yaw:.1,tangent:.6,lag:.06,arm:.58,flex:1.25,flexSwing:.15,abd:.17,narrow:.7,center:.1,kick:.7,knee:.12}
};
const KEYS=Object.keys(GAIT.walk);
export function mixGait(run,out={}){const r=clamp01(run);for(const k of KEYS)out[k]=GAIT.walk[k]+(GAIT.run[k]-GAIT.walk[k])*r;return out}
// Natural step rate (steps per second) at a ground speed: walking cadence grows
// with the square root of speed, running cadence slowly. Pinned so the tile
// speeds land STEPS_PER_TICK footfalls per tick.
export function cadence(run,speed){const v=Math.max(.05,Number(speed)||0),w=STEPS_PER_TICK.walk/TICK*Math.pow(v/WALK_REF,.6),r=STEPS_PER_TICK.run/TICK*Math.pow(v/RUN_REF,.35);return w+(r-w)*clamp01(run)}
// Ground covered by one step (half a cycle).
export const MIN_STEP=.3,MAX_STEP={walk:1.75,run:2.4};
export function stepLength(run,speed){const r=clamp01(run),v=Math.max(.05,Number(speed)||0);return clamp(v/cadence(r,v),MIN_STEP,MAX_STEP.walk+(MAX_STEP.run-MAX_STEP.walk)*r)}
// Cycle phase gained by covering `distance` (a cycle is two steps).
export function phaseAdvance(distance,step){return distance>0&&step>0?distance/(2*step):0}

// Blend state: move (idle 0 .. moving 1), run (walk 0 .. run 1), phase and the
// smoothed speed. Exponential fades: frame-rate independent and continuous.
export const FADE={move:.11,run:.16,speed:.15};
const fade=(dt,t)=>1-Math.exp(-dt/t);
export function createGaitState(){return {phase:0,move:0,moveMid:0,run:0,sprint:0,speed:0,step:1}}
// `soft` (seconds): townsfolk blend through two cascaded stages (as their clip
// fades do), so walking off from a kneel or a bench starts gently.
export function advanceGait(s,dt,{moving=false,running=false,sprinting=false,distance=0,speed=0,soft=0}={}){
 if(!(dt>0))return s;
 if(moving){if(s.move<.02)s.speed=speed;else s.speed+=(speed-s.speed)*fade(dt,FADE.speed)}
 const want=moving?1:0;if(soft>0){const k2=fade(dt,soft);s.moveMid+=(want-s.moveMid)*k2;s.move+=(s.moveMid-s.move)*k2}else{s.move+=(want-s.move)*fade(dt,FADE.move);s.moveMid=s.move}
 if(s.move<1e-3&&!moving&&s.moveMid<1e-3)s.move=s.moveMid=0;if(s.move>.999&&moving&&s.moveMid>.999)s.move=s.moveMid=1;
 // A walker that starts running blends its stride and style; the phase carries on.
 // Stopping keeps the style, so a run winds down as a run.
 if(moving)s.run+=((running?1:0)-s.run)*fade(dt,FADE.run);if(s.run<1e-3)s.run=0;if(s.run>.999)s.run=1;
 // Sprinting (the explicit "run" mode) leans in further and drives the arms harder.
 s.sprint+=((running&&sprinting?1:0)-s.sprint)*fade(dt,FADE.run);if(s.sprint<1e-3)s.sprint=0;
 s.step=stepLength(s.run,s.speed);
 if(moving)s.phase=(s.phase+phaseAdvance(distance,s.step))%1;
 return s;
}
// Weights of idle, walk and run (they sum to 1).
export function blendWeights(s,out={}){out.idle=1-s.move;out.walk=s.move*(1-s.run);out.run=s.move*s.run;return out}

// Ankle path of one leg at leg phase u (0 = heel strike, `stance` = toe-off),
// relative to the hip, in the body frame (z forward, y up from the ground).
// `foot` gives the ankle relative to the heel and ball contact points.
// Writes out.z, out.y (ankle), out.toe (foot pitch, + toes up), out.stance and
// out.toes (1 = toes flat on the ground).
// While planted, the heel (early), whole foot, then ball (late) slides back
// at exactly 2*step per unit of phase, i.e. stays still on the ground.
function stanceAnkle(t,step,g,foot,out){
 const b=g.stance,ball=foot.ballZ+g.center+b*step*(1-2*t);
 if(t<.18){const a=g.heel*(1-smooth(t/.18)),c=Math.cos(a),s=Math.sin(a),hz=ball-foot.length;out.z=hz+foot.heelZ*c-foot.heelY*s;out.y=foot.heelZ*s+foot.heelY*c;out.toe=a}
 else if(t>.55){const a=-g.toe*smooth((t-.55)/.45),c=Math.cos(a),s=Math.sin(a),vz=-foot.ballZ,vy=foot.ankleY-foot.ballY;out.z=ball+vz*c-vy*s;out.y=foot.ballY+vz*s+vy*c;out.toe=a}
 else{out.z=ball-foot.ballZ;out.y=foot.ankleY;out.toe=0}
}
const tmp0={z:0,y:0,toe:0},tmp1={z:0,y:0,toe:0};
export function legTrack(u,step,g,foot,out={}){
 u=((u%1)+1)%1;const b=g.stance;
 if(u<b){stanceAnkle(u/b,step,g,foot,out);out.stance=true;out.toes=1;return out}
 const s=(u-b)/(1-b);stanceAnkle(1,step,g,foot,tmp0);stanceAnkle(0,step,g,foot,tmp1);
 // Hermite in z: the foot leaves the ground still moving back at the planted
 // speed (no toe drag), and reaches forward easing into the next heel strike.
 const m0=-2*step*(1-b),m=g.tangent*m0,s2=s*s,s3=s2*s;
 out.z=(2*s3-3*s2+1)*tmp0.z+(s3-2*s2+s)*m0+(-2*s3+3*s2)*tmp1.z+(s3-s2)*m;
 out.y=tmp0.y+(tmp1.y-tmp0.y)*s+g.lift*Math.sin(Math.PI*Math.pow(s,g.kick));
 out.toe=tmp0.toe+(tmp1.toe-tmp0.toe)*smooth(s/.75);out.stance=false;out.toes=1-smooth(s/.2);return out;
}

// ---- Rig application -------------------------------------------------------
// Bind (T-pose) data per body, read once from the never-animated source rig:
// root-space rotation and position of every bone we drive.
const NAMES=['root','pelvis','spine_01','spine_02','spine_03','neck_01','Head','clavicle_l','clavicle_r','upperarm_l','upperarm_r','lowerarm_l','lowerarm_r','hand_l','hand_r','thigh_l','thigh_r','calf_l','calf_r','foot_l','foot_r','ball_l','ball_r'];
const bindCache=new Map(),SIDES=['l','r'];
function bindData(T,sex){
 if(bindCache.has(sex))return bindCache.get(sex);
 const src=characterStore.rigs[sex];if(!src)return null;src.updateMatrixWorld(true);
 const q={},p={};for(const n of NAMES){const o=src.getObjectByName(n);if(!o)return null;q[n]=o.getWorldQuaternion(new T.Quaternion());p[n]=o.getWorldPosition(new T.Vector3()).multiplyScalar(CHARACTER_SCALE)}
 const basis=(d,k)=>{d=d.clone().normalize();k=k.clone().addScaledVector(d,-k.dot(d)).normalize();return new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(d,k,new T.Vector3().crossVectors(d,k)))};
 // C = (bind basis)^-1 * bind rotation: a bone's root-space rotation is then
 // basis(direction, hinge) * C for any wanted direction and hinge.
 const C={},X=new T.Vector3(1,0,0),Z=new T.Vector3(0,0,1),dir=(a,b)=>p[b].clone().sub(p[a]);
 for(const s of ['l','r']){
  C['thigh_'+s]=basis(dir('thigh_'+s,'calf_'+s),X).invert().multiply(q['thigh_'+s]);
  C['calf_'+s]=basis(dir('calf_'+s,'foot_'+s),X).invert().multiply(q['calf_'+s]);
  const fore=basis(dir('lowerarm_'+s,'hand_'+s),Z).invert();
  C['upperarm_'+s]=basis(dir('upperarm_'+s,'lowerarm_'+s),Z).invert().multiply(q['upperarm_'+s]);
  C['lowerarm_'+s]=fore.clone().multiply(q['lowerarm_'+s]);C['hand_'+s]=fore.clone().multiply(q['hand_'+s]);
 }
 const ankleY=p.foot_l.y,ballY=p.ball_l.y,ballZ=p.ball_l.z-p.foot_l.z,heelBack=.06;
 const foot={ankleY,ballY,ballZ,heelZ:heelBack,heelY:ankleY,length:ballZ+heelBack};
 const data={q,p,C,foot,thigh:p.thigh_l.distanceTo(p.calf_l),shin:p.calf_l.distanceTo(p.foot_l),upper:p.upperarm_l.distanceTo(p.lowerarm_l),fore:p.lowerarm_l.distanceTo(p.hand_l)};
 bindCache.set(sex,data);return data;
}

export function createStrideRig(rig){
 const T=rig.T,b=rig.bones,bind=bindData(T,rig.sex);
 if(!bind||NAMES.some(n=>!b[n]))return null;
 const {q:BQ,p:BP,C,foot}=bind,reach=(bind.thigh+bind.shin)*.995;
 const armature=b.root.parent,model=rig.model;
 // Scratch (no per-frame allocation).
 const v1=new T.Vector3(),v2=new T.Vector3(),v3=new T.Vector3(),d=new T.Vector3(),k=new T.Vector3(),c=new T.Vector3(),m=new T.Matrix4(),pm=new T.Matrix4();
 const q1=new T.Quaternion(),q2=new T.Quaternion(),qa=new T.Quaternion(),qb=new T.Quaternion(),loc=new T.Quaternion(),inv=new T.Quaternion(),rootQ=new T.Quaternion();
 const RS={};for(const n of NAMES)RS[n]=new T.Quaternion();
 // Per-side bones, constants and scratch, looked up once (no string building per frame).
 const sideOf=x=>({thigh:b['thigh_'+x],calf:b['calf_'+x],foot:b['foot_'+x],ball:b['ball_'+x],clav:b['clavicle_'+x],upper:b['upperarm_'+x],fore:b['lowerarm_'+x],hand:b['hand_'+x],
  Cthigh:C['thigh_'+x],Ccalf:C['calf_'+x],Cupper:C['upperarm_'+x],Cfore:C['lowerarm_'+x],Chand:C['hand_'+x],
  RSthigh:RS['thigh_'+x],RScalf:RS['calf_'+x],RSfoot:RS['foot_'+x],RSclav:RS['clavicle_'+x],
  Bthigh:BP['thigh_'+x],Bfoot:BP['foot_'+x],BQfoot:BQ['foot_'+x],BQball:BQ['ball_'+x],sign:x==='l'?1:-1});
 const S={l:sideOf('l'),r:sideOf('r')};
 const hf=new T.Vector3(),invRoot=new T.Matrix4(),sh=new T.Vector3(),bk=new T.Vector3(),e1=new T.Vector3(),e2=new T.Vector3(),rf=new T.Vector3(),el=new T.Vector3(),qr=new T.Quaternion();
 // The grip (hand socket) sits this far past the wrist along the fingers.
 const GRIP=.082*CHARACTER_SCALE;
 // Elbow fit for reach(): forearm at angle a about the knuckle line.
 let reachGrip=null,reachSign=1;
 // The wrist is cocked by WRIST so the item leans back toward the elbow (a
 // sword on the shoulder cannot be square to the forearm).
 const WRIST=.7,cw=Math.cos(WRIST),sw=Math.sin(WRIST);
 function elbowScore(a){rf.copy(e1).multiplyScalar(Math.cos(a)).addScaledVector(e2,Math.sin(a));
  el.copy(reachGrip).addScaledVector(rf,-GRIP);const inward=Math.max(0,rf.x*-reachSign);rf.multiplyScalar(cw).addScaledVector(bk,-sw);el.addScaledVector(rf,-bind.fore);
  // Prefer fingers (and a crossguard) pointing forward, not in at the neck.
  return Math.abs(el.distanceTo(sh)-bind.upper)+.3*Math.max(0,el.y-(sh.y-.15))+.2*Math.max(0,(el.x-sh.x)*-reachSign)+.25*inward}
 const hip={l:new T.Vector3(),r:new T.Vector3()},ankle={l:new T.Vector3(),r:new T.Vector3()},knee=new T.Vector3(),pelvisP=new T.Vector3(),hipW=new T.Vector3();
 const track={l:{z:0,y:0,toe:0,stance:true,toes:1},r:{z:0,y:0,toe:0,stance:true,toes:1}},g=mixGait(0),X=new T.Vector3(1,0,0),Y=new T.Vector3(0,1,0);
 const contacts={left:true,right:true},wrist={l:BQ.lowerarm_l.clone().invert().multiply(BQ.hand_l),r:BQ.lowerarm_r.clone().invert().multiply(BQ.hand_r)};
 function basisQ(dv,kv,out){kv.addScaledVector(dv,-kv.dot(dv)).normalize();c.crossVectors(dv,kv);m.makeBasis(dv,kv,c);return out.setFromRotationMatrix(m)}
 // Write a bone's local rotation for a wanted root-space rotation under a
 // parent root-space rotation, blended in by w.
 function put(bone,parentRS,wantRS,w){loc.copy(inv.copy(parentRS).invert()).multiply(wantRS);if(w>=.999)bone.quaternion.copy(loc);else bone.quaternion.slerp(loc,w)}
 function rootRS(){return rootQ.copy(model.quaternion).multiply(armature.quaternion).multiply(b.root.quaternion)}
 // Two-bone leg: thigh and shin rotations putting the ankle at `goal`, knee
 // bending forward in the leg's own plane.
 function leg(o,hipP,goal,parentRS,w){
  d.copy(goal).sub(hipP);const dist=clamp(d.length(),Math.abs(bind.thigh-bind.shin)+1e-3,reach);d.normalize();
  // Knee pole: forward, square to the hip-ankle line.
  k.set(0,0,1).addScaledVector(d,-d.z).normalize();const a=(bind.thigh*bind.thigh-bind.shin*bind.shin+dist*dist)/(2*dist),h=Math.sqrt(Math.max(0,bind.thigh*bind.thigh-a*a));
  knee.copy(hipP).addScaledVector(d,a).addScaledVector(k,h);
  // Hinge (lateral) axis from the pole and the leg line.
  v3.crossVectors(k,d).normalize();
  v1.copy(knee).sub(hipP).normalize();basisQ(v1,v2.copy(v3),q1).multiply(o.Cthigh);o.RSthigh.copy(q1);
  v1.copy(goal).sub(knee).normalize();basisQ(v1,v2.copy(v3),q2).multiply(o.Ccalf);o.RScalf.copy(q2);
  put(o.thigh,parentRS,q1,w);put(o.calf,q1,q2,w);
 }
 // Arm from a shoulder direction, forearm direction and knuckle line (the
 // hand's thumb-side axis: blades and bow limbs run along it). The wrist stays
 // straight. parentRS: the clavicle's root-space rotation.
 const au=new T.Vector3(),af=new T.Vector3(),ak=new T.Vector3(),as=new T.Vector3();
 function arm(s,upper,fore,knuckle,parentRS,w){
  if(!(w>0))return;const o=S[s];
  au.copy(upper).normalize();af.copy(fore).normalize();ak.copy(knuckle);
  // Upper arm turned so the elbow bends toward the forearm (the knuckle line when straight).
  as.copy(af).addScaledVector(au,-af.dot(au)).multiplyScalar(3).add(ak);
  basisQ(au,as,qa).multiply(o.Cupper);
  basisQ(af,as.copy(ak),qb);q1.copy(qb).multiply(o.Cfore);
  // Hand: knuckle line exactly along `knuckle`; fingers follow the forearm
  // (a straight wrist, or a cocked one when the item is not square to it).
  hf.copy(af).addScaledVector(ak.normalize(),-af.dot(ak)).normalize();basisQ(hf,ak,q2).multiply(o.Chand);
  put(o.upper,parentRS,qa,w);put(o.fore,qa,q1,w);put(o.hand,q1,q2,w);
 }
 const rot=(axis,angle,out)=>out.setFromAxisAngle(axis,angle);
 return {
  bind,contacts,
  // Full-body cycle at gait state `st`: legs/hips at weight `lower`, spine,
  // head and arms at weight `upper`.
  apply(st,lower,upper){
   if(!(lower>0)&&!(upper>0))return contacts;
   mixGait(st.run,g);const step=st.step,ph=st.phase,TWO=2*Math.PI;
   // Faster (diagonal tile steps) spends less of the cycle planted, as people do.
   g.stance-=.08*clamp(st.speed/WALK_REF-1,0,1)*(1-st.run)+.07*clamp(st.speed/RUN_REF-1,0,1)*st.run;
   const sp=st.sprint||0;g.lean+=.18*sp;g.arm+=.08*sp;g.lift+=.06*sp;
   legTrack(ph,step,g,foot,track.l);legTrack(ph+.5,step,g,foot,track.r);
   contacts.left=track.l.stance;contacts.right=track.r.stance;
   rootRS();
   // Pelvis: turns with the stride, shifts over the planted foot, bobs.
   const yaw=-g.yaw*Math.cos(TWO*ph),sway=g.sway*Math.cos(TWO*(ph-g.stance/2)),bob=g.bob*(1-2*st.run)*Math.cos(2*TWO*(ph-g.stance/2));
   rot(Y,yaw,q1);rot(X,g.lean*.25,q2);qa.copy(q1).multiply(q2);RS.pelvis.copy(qa).multiply(BQ.pelvis);
   let py=BP.pelvis.y-g.drop+bob;
   for(let i=0;i<2;i++){const s=SIDES[i],o=S[s],t=track[s];v1.copy(o.Bthigh).sub(BP.pelvis).applyQuaternion(qa);hip[s].copy(v1);
    ankle[s].set(o.Bfoot.x*g.narrow,t.y,o.Bthigh.z+t.z);
    // Highest the hips may sit with this foot still in reach (smooth min).
    const dx=ankle[s].x-(BP.pelvis.x+sway+v1.x),dz=ankle[s].z-(BP.pelvis.z+v1.z),lim=ankle[s].y+Math.sqrt(Math.max(0,reach*reach-dx*dx-dz*dz))-v1.y-g.knee*.2;
    const kk=.025;py=-kk*Math.log(Math.exp(-py/kk)+Math.exp(-lim/kk))}
   pelvisP.set(BP.pelvis.x+sway,py,BP.pelvis.z);
   if(lower>0){
    // Pelvis position in its parent's (root bone) space.
    model.updateMatrix();armature.updateMatrix();b.root.updateMatrix();pm.multiplyMatrices(model.matrix,armature.matrix).multiply(b.root.matrix).invert();
    v2.copy(pelvisP).applyMatrix4(pm);if(lower>=.999)b.pelvis.position.copy(v2);else b.pelvis.position.lerp(v2,lower);
    put(b.pelvis,rootQ,RS.pelvis,lower);
    for(let i=0;i<2;i++){const s=SIDES[i],o=S[s],t=track[s];hipW.copy(hip[s]).add(pelvisP);leg(o,hipW,ankle[s],RS.pelvis,lower);
     rot(X,-t.toe,q1);o.RSfoot.copy(q1).multiply(o.BQfoot);put(o.foot,o.RScalf,o.RSfoot,lower);
     qb.copy(o.BQball);q2.copy(q1).multiply(o.BQball);qb.slerp(q2,1-t.toes);put(o.ball,o.RSfoot,qb,lower)}
   }
   if(upper>0){
    // Spine leans in and turns back against the hips; neck and head stay level.
    const lean=g.lean;
    rot(Y,yaw*.4,q1);rot(X,lean*.55,q2);RS.spine_01.copy(q1).multiply(q2).multiply(BQ.spine_01);
    rot(X,lean*.85,q2);RS.spine_02.copy(q2).multiply(BQ.spine_02);
    rot(Y,-yaw*.45,q1);rot(X,lean,q2);qa.copy(q1).multiply(q2);RS.spine_03.copy(qa).multiply(BQ.spine_03);
    RS.clavicle_l.copy(qa).multiply(BQ.clavicle_l);RS.clavicle_r.copy(qa).multiply(BQ.clavicle_r);
    rot(X,lean*.45,q2);RS.neck_01.copy(q2).multiply(BQ.neck_01);rot(X,lean*.1,q2);RS.Head.copy(q2).multiply(BQ.Head);
    put(b.spine_01,RS.pelvis,RS.spine_01,upper);put(b.spine_02,RS.spine_01,RS.spine_02,upper);put(b.spine_03,RS.spine_02,RS.spine_03,upper);
    put(b.clavicle_l,RS.spine_03,RS.clavicle_l,upper);put(b.clavicle_r,RS.spine_03,RS.clavicle_r,upper);
    put(b.neck_01,RS.spine_03,RS.neck_01,upper);put(b.Head,RS.neck_01,RS.Head,upper);
    // Arms swing with the opposite leg; the run bends the elbows and pumps.
    const cs=Math.cos(TWO*(ph-g.lag));
    for(let i=0;i<2;i++){const s=SIDES[i],swing=-S[s].sign*g.arm*cs+lean*.6,flex=g.flex+g.flexSwing*(swing/(g.arm||1));
     this.armSwingPose(s,swing,flex,g.abd,S[s].RSclav,upper)}
   }
   return contacts;
  },
  // Hanging arm swung forward by `swing`, elbow bent by `flex`, held out by `abd`.
  armSwingPose(s,swing,flex,abd,parentRS,w){const side=S[s].sign;
   v3.set(side*Math.sin(abd),-Math.cos(abd),0);rot(X,-swing,q1);d.copy(v3).applyQuaternion(q1);
   rot(X,-(swing+flex),q2);const f=k.copy(v3).applyQuaternion(q2);c.set(0,0,1).applyQuaternion(q2);
   arm(s,v1.copy(d),v2.copy(f),c,parentRS,w)},
  arm(s,upper,fore,knuckle,parentRS,w){arm(s,upper,fore,knuckle,parentRS,w)},
  // Root-space position of a shoulder joint in the live pose.
  shoulderRS(s,out){const o=S[s].upper;o.updateWorldMatrix(true,false);invRoot.copy(rig.root.matrixWorld).invert();return out.setFromMatrixPosition(o.matrixWorld).applyMatrix4(invRoot)},
  // Put the hand's grip (socket) at `grip` (root space) with the knuckle line
  // (the held item) along `knuckle`: the forearm is square to the knuckle line
  // and turned about it until the elbow sits at upper-arm length from the
  // shoulder, preferring an elbow that hangs down and out.
  reach(s,grip,knuckle,w){const o=S[s];this.shoulderRS(s,sh);bk.copy(knuckle).normalize();
   e1.set(0,1,0).addScaledVector(bk,-bk.y);if(e1.lengthSq()<1e-6)e1.set(1,0,0).addScaledVector(bk,-bk.x);e1.normalize();e2.crossVectors(bk,e1);
   reachGrip=grip;reachSign=o.sign;let best=Infinity,bestA=0;
   for(let i=0;i<24;i++){const a=i/24*2*Math.PI,v=elbowScore(a);if(v<best){best=v;bestA=a}}
   for(let i=-5;i<=5;i++){const a=bestA+i*Math.PI/120,v=elbowScore(a);if(v<best){best=v;bestA=a}}
   elbowScore(bestA);v1.copy(el).sub(sh);arm(s,v1,rf,bk,this.clavicleRS(s,qr),w)},
  // Wrist straight in line with the forearm (as in the bind pose).
  straightWrist(s){S[s].hand.quaternion.copy(wrist[s])},
  // Root-space rotation of a clavicle in the live pose.
  clavicleRS(s,out){return out.copy(rootRS()).multiply(b.pelvis.quaternion).multiply(b.spine_01.quaternion).multiply(b.spine_02.quaternion).multiply(b.spine_03.quaternion).multiply(S[s].clav.quaternion)}
 };
}
