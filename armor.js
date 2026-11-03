import {loftGeometry} from './anatomy.js?v=release-20261103-motion6';
import {surfaceTexture} from './surface-textures.js?v=release-20261103-motion6';
// Original, closed low-poly plate harness: angular steel, articulated lames and
// tapered limbs. Every piece follows the existing wrist/knee rig and loadout.
export function buildPlateArmor(T,body,rig){
 const caches=buildPlateArmor.caches||(buildPlateArmor.caches=new WeakMap());let cache=caches.get(T);if(!cache){cache=new Map();caches.set(T,cache)}
 const material=(name,color,metalness=.55,roughness=.64)=>{if(!cache.has(name)){const map=surfaceTexture(T,'metal',0xffffff);cache.set(name,new T.MeshStandardMaterial({color,metalness,roughness,flatShading:false,map,bumpMap:map,bumpScale:.002}))}cache.get(name).userData.eldervaleShared=true;return cache.get(name)};
 const steel=material('steel',0x607e87),edge=material('edges',0x91a7aa),dark=material('recesses',0x293b41),leather=material('leather',0x4b3529,0,.95),plume=material('crest',0x6d3450,0,.96);
 const slots={helm:[],chest:[],legs:[],boots:[]};
 function add(g,m,parent,slot,x=0,y=0,z=0){const key=g.type+':'+JSON.stringify(g.parameters||Array.from(g.attributes.position.array));if(cache.has(key)){g.dispose();g=cache.get(key)}else cache.set(key,g);g.userData.eldervaleShared=true;const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=o.receiveShadow=true;parent.add(o);slots[slot].push(o);return o}
 const shell=(parent,slot,rings,mat=steel,sides=8)=>add(loftGeometry(T,rings,sides),mat,parent,slot);
 const box=(parent,slot,w,h,d,x,y,z,mat=steel)=>add(new T.BoxGeometry(w,h,d),mat,parent,slot,x,y,z);
 // The helmet has a flat brow, a sloped crown and a closed jaw, with dark visor slots.
 shell(body,'helm',[[2.10,.20,.24],[2.18,.285,.29],[2.43,.325,.31],[2.60,.30,.285],[2.76,.21,.22],[2.82,.055,.09]],steel,8);
 box(body,'helm',.56,.11,.025,0,2.43,.298,dark);
 box(body,'helm',.59,.045,.035,0,2.505,.30,edge);
 for(const x of [-.22,-.11,0,.11,.22])box(body,'helm',.038,.145,.035,x,2.365,.327,steel);
 box(body,'helm',.07,.26,.045,0,2.31,.345,edge);
 const crest=shell(body,'helm',[[2.78,.04,.12],[2.97,.035,.16],[3.10,.025,.12]],plume,5);crest.position.z=-.055;
 // Closed breast/back shell, shaped over the ribs and narrowing at the waist.
 shell(body,'chest',[[1.10,.29,.235],[1.22,.33,.26],[1.52,.395,.31],[1.75,.435,.325],[1.91,.39,.27],[1.97,.22,.19]],steel,8);
 shell(body,'chest',[[1.91,.20,.18],[2.015,.19,.165]],dark,8);
 // Three overlapping fauld lames protect the hips without a giant rectangular skirt.
 for(let i=0;i<3;i++)shell(body,'chest',[[1.01-i*.07,.355+i*.016,.265+i*.007],[1.10-i*.07,.34+i*.016,.25+i*.007]],i===1?edge:steel,8);
 const belt=shell(body,'chest',[[1.10,.345,.265],[1.16,.345,.265]],leather,8);
 box(body,'chest',.10,.075,.04,0,1.13,.285,edge);
 for(const side of ['left','right']){
  const arm=rig[side+'Arm'],elbow=rig[side+'Elbow'];
  shell(arm,'chest',[[-.33,.19,.18],[-.20,.255,.23],[-.03,.25,.225],[.075,.15,.15]],steel,6);
  shell(arm,'chest',[[-.36,.18,.17],[-.28,.21,.195]],edge,6);
  shell(arm,'chest',[[-.44,.12,.115],[-.32,.16,.15]],steel,6);
  shell(elbow,'chest',[[-.065,.13,.13],[.025,.16,.15],[.10,.12,.115]],edge,6);
  shell(elbow,'chest',[[-.30,.09,.085],[-.22,.12,.11],[-.07,.13,.125]],steel,6);
  shell(elbow,'chest',[[-.34,.10,.09],[-.28,.11,.10]],edge,6);
  shell(elbow,'chest',[[-.41,.072,.06],[-.34,.083,.07]],steel,6);
 }
 for(const [leg,knee] of [[rig.leftLeg,rig.leftKnee],[rig.rightLeg,rig.rightKnee]]){
  shell(leg,'legs',[[-.45,.14,.145],[-.25,.18,.18],[-.055,.20,.19],[.025,.175,.17]],steel,8);
  shell(knee,'legs',[[-.10,.12,.13],[.005,.16,.18],[.08,.13,.145]],edge,6);
  shell(knee,'legs',[[-.35,.10,.115],[-.23,.135,.15],[-.10,.15,.16]],steel,8);
  // Pointed leather boots and overlapping metal sabatons, rather than round shoes.
  shell(knee,'boots',[[-.46,.125,.20,0,.09],[-.40,.13,.225,0,.09],[-.34,.105,.16,0,.05],[-.29,.09,.095]],leather,6);
  shell(knee,'boots',[[-.44,.12,.22,0,.115],[-.385,.12,.23,0,.10],[-.34,.10,.15,0,.055]],steel,6);
  box(knee,'boots',.23,.025,.035,0,-.38,.28,edge);
 }
 for(const slot of ['chest','legs','boots'])for(const p of slots[slot]){
  if(p.parent===body)p.position.y+=rig.upperOffset;
  else if([rig.leftLeg,rig.rightLeg,rig.leftKnee,rig.rightKnee].includes(p.parent)){p.position.y*=rig.legScale;p.scale.y*=rig.legScale}
 }
 for(const [knee,ankle] of [[rig.leftKnee,rig.leftAnkle],[rig.rightKnee,rig.rightAnkle]])if(ankle){body.updateMatrixWorld(true);for(const part of slots.boots)if(part.parent===knee)ankle.attach(part)}
 const helmetRoot=new T.Group();body.add(helmetRoot);for(const p of slots.helm){p.position.y-=2.10;helmetRoot.add(p)}helmetRoot.position.y=rig.head.position.y;helmetRoot.scale.copy(rig.head.scale);helmetRoot.scale.x*=1.0;
 Object.values(slots).flat().forEach(p=>p.visible=false);return slots;
}
