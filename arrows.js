import {arrowModel} from './weapon-assets.js?v=release-20261105-characters55';
// Arrow projectiles (cosmetic: the server resolves the hit). An arrow leaves
// the bow when the archer releases the string, flies a shallow arc to the
// target's chest and stays briefly where it lands.
const SPEED=55,STICK=.6;
export function createArrows(T,scene){
 const flying=[],from=new T.Vector3(),to=new T.Vector3(),dir=new T.Vector3(),up=new T.Vector3(0,1,0);
 return {
  get count(){return flying.length},
  // from: Object3D (the bow hand) or Vector3; target: Object3D (aimed at chest height) or Vector3.
  fire(source,target,{height=1.5}={}){
   (source.isObject3D?source.getWorldPosition(from):from.copy(source));
   (target.isObject3D?target.getWorldPosition(to).add(dir.set(0,height,0)):to.copy(target));
   const distance=from.distanceTo(to);if(!Number.isFinite(distance)||distance<.2)return null;
   const arrow=arrowModel(T);arrow.position.copy(from);scene.add(arrow);
   const shot={arrow,start:from.clone(),end:to.clone(),time:0,duration:Math.max(.08,distance/SPEED),lift:Math.min(.6,distance*.03),stuck:0};
   flying.push(shot);this.update(0);return arrow;
  },
  update(dt){
   for(let i=flying.length-1;i>=0;i--){const s=flying[i];
    if(s.time>=s.duration){s.stuck+=dt;if(s.stuck>=STICK){s.arrow.removeFromParent();flying.splice(i,1)}continue}
    s.time=Math.min(s.duration,s.time+dt);const u=s.time/s.duration;
    // Position on a shallow parabola; the tip (+Y of the model) follows the velocity.
    s.arrow.position.lerpVectors(s.start,s.end,u);s.arrow.position.y+=4*s.lift*u*(1-u);
    dir.subVectors(s.end,s.start);dir.y+=4*s.lift*(1-2*u);dir.normalize();
    s.arrow.quaternion.setFromUnitVectors(up,dir);
   }
  },
  dispose(){for(const s of flying)s.arrow.removeFromParent();flying.length=0}
 };
}
