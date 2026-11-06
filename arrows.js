import {arrowModel} from './weapon-assets.js?v=release-20261106-fix98';
// Projectiles (cosmetic: the server resolves the hit).
//  arrow: leaves the bow on release, flies a shallow arc to the target's chest
//         and stays briefly where it lands.
//  bolt:  a spell, a glowing orb with a short trail in the staff's gem colour,
//         flies straight and vanishes on impact.
const ARROW_SPEED=55,BOLT_SPEED=30,STICK=.6,TRAIL=4;
export function createArrows(T,scene){
 const flying=[],from=new T.Vector3(),to=new T.Vector3(),dir=new T.Vector3(),up=new T.Vector3(0,1,0);
 const orb=new T.IcosahedronGeometry(.11,1);
 // Orb with a tapering trail behind it (along -Y, the projectile's tail).
 function makeBolt(color){
  const g=new T.Group();g.userData.spellBolt=true;
  const glowing=(c,opacity)=>new T.MeshBasicMaterial({color:c,transparent:true,opacity,blending:T.AdditiveBlending,depthWrite:false});
  g.add(new T.Mesh(orb,new T.MeshBasicMaterial({color:0xffffff})));
  const halo=new T.Mesh(orb,glowing(color,.55));halo.scale.setScalar(1.9);g.add(halo);
  for(let i=1;i<=TRAIL;i++){const t=new T.Mesh(orb,glowing(color,.45*(1-i/(TRAIL+1))));t.position.y=-.16*i;t.scale.setScalar(1.3*(1-i/(TRAIL+2)));g.add(t)}
  g.traverse(o=>{if(o.isMesh){o.castShadow=false;o.renderOrder=2}});return g;
 }
 function remove(s){s.object.removeFromParent();if(s.bolt)s.object.traverse(o=>{if(o.isMesh)o.material.dispose()})}
 const api={
  get count(){return flying.length},
  // source: Object3D (bow hand, casting hand) or Vector3; target: Object3D (aimed at chest height) or Vector3.
  fire(source,target,{height=1.5,kind='arrow',color=0x88aaff}={}){
   (source.isObject3D?source.getWorldPosition(from):from.copy(source));
   (target.isObject3D?target.getWorldPosition(to).add(dir.set(0,height,0)):to.copy(target));
   const distance=from.distanceTo(to);if(!Number.isFinite(distance)||distance<.2)return null;
   const bolt=kind==='bolt',object=bolt?makeBolt(color):arrowModel(T);object.position.copy(from);scene.add(object);
   flying.push({object,bolt,start:from.clone(),end:to.clone(),time:0,duration:Math.max(.08,distance/(bolt?BOLT_SPEED:ARROW_SPEED)),lift:bolt?0:Math.min(.6,distance*.03),stuck:0});
   api.update(0);return object;
  },
  update(dt){
   for(let i=flying.length-1;i>=0;i--){const s=flying[i];
    if(s.time>=s.duration){s.stuck+=dt;if(s.bolt||s.stuck>=STICK){remove(s);flying.splice(i,1)}continue}
    s.time=Math.min(s.duration,s.time+dt);const u=s.time/s.duration;
    // Position on a shallow parabola (straight for bolts); the head (+Y) follows the velocity.
    s.object.position.lerpVectors(s.start,s.end,u);s.object.position.y+=4*s.lift*u*(1-u);
    dir.subVectors(s.end,s.start);dir.y+=4*s.lift*(1-2*u);dir.normalize();
    s.object.quaternion.setFromUnitVectors(up,dir);
   }
  },
  dispose(){for(const s of flying)remove(s);flying.length=0;orb.dispose()}
 };
 return api;
}
