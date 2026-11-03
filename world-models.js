import {creatureMaterial} from './creature-material.js?v=release-20261103-gait18';
import {dragonModel} from './monster-dragon.js?v=release-20261103-gait18';
import {castleObject} from './castle-models.js?v=release-20261103-gait18';
import {buildCharacterDisplay} from './character-display.js?v=release-20261103-gait18';
// Small, articulated species models with their own attack silhouettes and effects.
export function actorModel(T,parent,d){
 if(d.species==='dragon')return dragonModel(T,parent,d);
 if(['human','goblin','skeleton'].includes(d.species)||d.kind==='npc'){
  const appearance={shirt:'#'+(d.color||0x714e49).toString(16).padStart(6,'0'),pants:'#4b4742',skin:d.species==='goblin'?'#74864b':d.species==='skeleton'?'#d7cfb9':'#c9916b',hair:d.species==='skeleton'?'Buzz cut':'Short crop'};
  const display=buildCharacterDisplay(T,parent,appearance,{weapon:d.weapon,armor:/guard/.test(d.role||'')?{chest:true,legs:true,boots:true}: {}});
  if(d.species==='skeleton'){
   const rig=display.rig,bone=new T.MeshStandardMaterial({color:0xd7cfb9,roughness:.9});rig.torso.visible=false;for(const m of rig.clothingMeshes)m.visible=false;for(const m of rig.hairMeshes)m.visible=false;
   const rib=(p,x,y,z,w,h,depth)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,depth),bone);m.position.set(x,y,z);p.add(m)};
   rib(display.visual,0,1.78,0,.10,.70,.10);for(let i=0;i<5;i++)rib(display.visual,0,1.57+i*.10,.03,.52-i*.025,.055,.25);
   for(const [limb,length]of [[rig.leftArm,.44],[rig.rightArm,.44],[rig.leftElbow,.30],[rig.rightElbow,.30],[rig.leftLeg,.63],[rig.rightLeg,.63],[rig.leftKnee,.54],[rig.rightKnee,.54]]){for(const c of limb.children)if(c.isMesh)c.visible=false;rib(limb,0,-length/2,0,.075,length,.075)}
  }
  const effect=serviceAttackEffect(T,display.rig,d.attackType);
  return {update(dt,m){display.update(dt,{...m,locomotion:m.attack>0?'combat':'walk'});effect.update(m.attack||0)},dispose:()=>display.dispose()};
 }
 const group=new T.Group();parent.add(group);const parts=[],legs=[],wings=[];let tick=0,travel=0;
 const color=({demon:0x8f3b3e,imp:0xa65a38,ogre:0x758654,revenant:0x71808f,wolf:0x727d80,deer:0xa57a50,boar:0x665142,bear:0x62432f,rat:0x786b67,spider:0x343840,bat:0x52445d,dragon:0x7e4937,troll:0x788263,golem:0x727b7d,wraith:0x4b5776})[d.species]||0x777777;
 const materials=new Map();function mat(c){if(!materials.has(c))materials.set(c,creatureMaterial(T,c,['golem'].includes(d.species)?'stone':['demon','imp','spider'].includes(d.species)?'scales':'hide'));return materials.get(c)}
 function ball(x,y,z,sx,sy,sz,c=color,p=group){const m=new T.Mesh(new T.SphereGeometry(1,20,14),mat(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);p.add(m);parts.push(m);return m}
 function rod(x,y,z,sx,sy,sz,c=color,p=group){const m=new T.Mesh(new T.BoxGeometry(sx,sy,sz),mat(c));m.position.set(x,y,z);p.add(m);parts.push(m);return m}
 const pivot=(x,y,z,p=group)=>{const q=new T.Group();q.position.set(x,y,z);p.add(q);return q};
 const flying=['bat','wraith','revenant'].includes(d.species),biped=['troll','golem','wraith','demon','imp','ogre','revenant'].includes(d.species),spider=d.species==='spider',dragon=d.species==='dragon';
 ball(0,biped?1.3:.82,0,biped?.55:.46,biped?.75:.4,biped?.32:.78);
 const head=pivot(0,biped?2.1:1.07,biped?.05:.69);ball(0,0,0,.30,.29,.34,color,head);
 ball(0,-.06,.24,.23,.15,.3,color,head);
 for(const x of [-.14,.14])ball(x,.09,.30,.035,.035,.035,dragon?0xffb457:0x171d1d,head);
 const jaw=pivot(0,-.16,.17,head);ball(0,0,.13,.20,.065,.25,color,jaw);
 const legCount=spider?8:biped?2:4;
 for(let i=0;i<legCount;i++){const side=i%2?-1:1,z=spider?-.55+Math.floor(i/2)*.35:biped?0:i<2?.45:-.48;const q=pivot(side*(spider?.34:biped?.28:.30),biped?.95:.7,z);rod(side*(spider?.26:0),-.25,0,spider?.65:.18,spider?.11:.55,.18,color,q);if(spider){const toe=rod(side*.57,-.42,0,.1,.40,.1,color,q);toe.rotation.z=-side*.35}ball(0,-.55,.10,.15,.09,.22,color,q);legs.push(q)}
 if(biped)for(const side of [-1,1]){const q=pivot(side*.55,1.8,0);rod(0,-.45,0,.27,.9,.29,color,q);legs.push(q)}
 if(['wolf','deer','rat'].includes(d.species))for(const side of [-1,1]){const ear=ball(side*.19,.32,-.04,.095,.24,.08,color,head);ear.rotation.z=side*.25}
 if(d.species==='deer')for(const side of [-1,1]){rod(side*.22,.51,-.02,.065,.65,.065,0xccb995,head);for(let k=0;k<2;k++){const antler=rod(side*(.3+k*.045),.48+k*.2,-.02,.30,.055,.055,0xccb995,head);antler.rotation.z=side*.7}}
 if(d.species==='boar')for(const side of [-1,1])ball(side*.21,-.03,.45,.055,.15,.055,0xe4d5b5,head);
 if(!biped&&!spider){const tail=rod(0,.92,-.97,.12,.12,.60,color);tail.rotation.x=-.35;}
 if(flying||dragon){for(const side of [-1,1]){const wing=pivot(side*.36,dragon?1.05:1,0);const shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(side*1.65,.45);shape.lineTo(side*1.25,-.5);shape.lineTo(side*.5,-.25);shape.lineTo(0,0);const membrane=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshStandardMaterial({color:dragon?0x5c3033:0x635373,side:T.DoubleSide,roughness:1}));wing.add(membrane);wings.push(wing)} }
 if(dragon){for(const side of [-1,1])rod(side*.21,.38,-.06,.09,.50,.09,0xc4b38b,head);for(let i=0;i<5;i++)rod(0,1.25,-.65+i*.30,.10,.22,.13,0xb59564)}

 if(['demon','imp'].includes(d.species)){for(const side of [-1,1]){const horn=new T.Mesh(new T.ConeGeometry(.10,.55,7),mat(0xe2c598));horn.position.set(side*.23,.43,-.06);horn.rotation.z=-side*.4;head.add(horn);ball(side*.14,.09,.32,.05,.04,.03,0xffb42f,head);for(let i=0;i<3;i++)rod(side*.56+(i-1)*.07,.84,.22,.045,.18,.07,0xe6c8a0);ball(side*.44,1.68,.13,.30,.30,.25,0x73313a)}const tail=rod(0,1,-.52,.10,.10,1,0x783b38);tail.rotation.x=-.4;}
 if(d.species==='ogre'){ball(0,1.05,.13,.63,.65,.43,0x7c885a);for(const side of [-1,1]){const tusk=rod(side*.18,-.02,.48,.075,.28,.09,0xe3d5b4,head);tusk.rotation.z=-side*.2;}rod(.65,.78,.15,.18,1.5,.18,0x5c4330);rod(.65,1.42,.15,.48,.55,.48,0x666a60);}
 if(d.species==='golem'){for(const side of [-1,1]){rod(side*.47,1.8,0,.48,.5,.55,0x626c68);rod(side*.28,.55,0,.38,.65,.4,0x84918b);}for(let i=0;i<4;i++)rod(0,1.2+i*.19,.34,.58,.025,.025,0x86bfbb);}
 if(d.species==='wolf'){ball(0,.90,.50,.46,.46,.4,0x5c686b);for(const side of [-1,1])ball(side*.23,.90,.3,.20,.25,.32,0x9ba59e);ball(0,-.03,.49,.12,.09,.07,0x242a2b,head);}
 if(d.species==='bear'){ball(0,1.12,-.38,.57,.58,.58,0x583b2c);for(const side of [-1,1])ball(side*.20,.23,-.04,.10,.10,.08,color,head);}
 if(d.species==='deer'){ball(0,1.04,.61,.21,.47,.24,0xb38a60);for(const q of legs)q.scale.set(.65,1.18,.65);}
 if(['wraith','revenant'].includes(d.species)){const robe=new T.Mesh(new T.ConeGeometry(.62,1.7,10,1,true),new T.MeshStandardMaterial({color:0x394557,side:T.DoubleSide,transparent:true,opacity:.84}));robe.position.y=1;group.add(robe);for(const side of [-1,1])ball(side*.13,.08,.31,.035,.035,.035,0xa4e6ff,head);}
 const effect=new T.Group();group.add(effect);effect.position.set(0,1.02,1.2);effect.visible=false;
 const magical=['fire','magic','venom','arrow'].includes(d.attackType);
 if(magical){if(d.attackType==='arrow'){rod(0,0,.65,.045,.045,1.3,0xc1ac72,effect)}else{for(let i=0;i<5;i++)ball(Math.sin(i*5)*.1,Math.cos(i*5)*.1,i*.36,.16+i*.08,.16+i*.08,.28,d.attackType==='fire'?(i%2?0xffb42e:0xff6533):d.attackType==='venom'?0x80bd55:0x8cb9ed,effect)}}
 return {update(dt,m){tick+=dt;const attack=Math.max(0,Math.min(1,m.attack/.55)),a=Math.sin((1-attack)*Math.PI)*(attack>0?1:0),moving=m.distance>0,walk=(travel+=(m.distance||0)*4);
  group.rotation.y=d.attackType==='kick'?Math.PI*a:0;group.position.y=flying?.35+Math.sin(tick*3)*.12:0;group.position.z=d.attackType==='charge'?a*.45:0;
  legs.forEach((q,i)=>{q.rotation.x=moving?Math.sin(walk+i%2*Math.PI)*.4:0;if(d.attackType==='kick'&&i>=2)q.rotation.x-=a*1.35;if(['claw','slam'].includes(d.attackType)&&(biped?i>=2:i<2))q.rotation.x-=a*1.4});
  jaw.rotation.x=d.attackType==='bite'?a*.8:0;head.rotation.x=d.attackType==='bite'?-a*.3:0;wings.forEach((q,i)=>q.rotation.z=(i?1:-1)*(.2+Math.sin(tick*5)*.35));effect.visible=magical&&a>.25;effect.scale.setScalar(.7+a*.6);
 },dispose(){group.traverse(o=>{o.geometry?.dispose();if(o.material&&!materials.has(o.material.color?.getHex()))o.material.dispose()});for(const m of materials.values())m.dispose();group.removeFromParent()}};
}
export function objectModel(T,parent,id,d={}){
 const g=new T.Group();parent.add(g);const wood=0x745335,stone=0x92998e,metal=0x444b49;
 if(id.startsWith('castle_')||['altar','hearth'].includes(id)){castleObject(T,g,id,d);Object.assign(parent.userData,g.userData);return g;}
 const box=(x,y,z,w,h,l,c)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,l),new T.MeshStandardMaterial({color:c,roughness:.9}));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;g.add(m);return m};
 const cyl=(x,y,z,r,h,c,r2=r)=>{const m=new T.Mesh(new T.CylinderGeometry(r2,r,h,12),new T.MeshStandardMaterial({color:c,roughness:.9}));m.position.set(x,y,z);g.add(m);return m};
 if(id==='fountain'){cyl(0,.35,0,1.9,.7,stone);cyl(0,.72,0,1.65,.04,0x659bb7);cyl(0,1.5,0,.24,1.8,stone);cyl(0,2.3,0,.65,.25,stone);const streams=[],water=new T.MeshStandardMaterial({color:0x6b9da9,roughness:.22,metalness:.08,transparent:true,opacity:.65});for(let i=0;i<8;i++){const a=i*Math.PI/4,curve=new T.QuadraticBezierCurve3(new T.Vector3(Math.cos(a)*.52,2.36,Math.sin(a)*.52),new T.Vector3(Math.cos(a)*1.3,2.6,Math.sin(a)*1.3),new T.Vector3(Math.cos(a)*1.45,.76,Math.sin(a)*1.45));const stream=new T.Mesh(new T.TubeGeometry(curve,16,.016,5,false),water);g.add(stream);const drop=new T.Mesh(new T.SphereGeometry(.026,6,5),water);drop.scale.set(.7,1.8,.7);g.add(drop);streams.push({curve,drop,phase:i/8})}parent.userData.animateWater=time=>{for(const s of streams)s.drop.position.copy(s.curve.getPoint((time*.65+s.phase)%1))};}else if(id==='fishing_spot'){cyl(0,.06,0,.7,.08,0x4b8ca3);box(0,.65,0,.06,1.3,.06,wood);box(.3,1.1,0,.6,.35,.05,0x4f8798)}else if(['tree','pine'].includes(id)){cyl(0,1.4,0,.22,2.8,wood);for(let i=0;i<3;i++)cyl(0,2.5+i*.6,0,1.5-i*.3,1.8,0x486641,id==='pine'?0:.8-i*.2)}
 else if(id==='rock'){const m=new T.Mesh(new T.DodecahedronGeometry(.9),new T.MeshStandardMaterial({color:stone,flatShading:true}));m.position.y=.65;g.add(m)}
 else if(id==='barrel'){cyl(0,.5,0,.4,1,wood);for(const y of [.16,.83])cyl(0,y,0,.41,.08,metal)}
 else if(id==='well'){cyl(0,.45,0,1,.9,stone);cyl(0,.91,0,.75,.025,0x436878);for(const x of [-1,1])box(x,1.4,0,.12,2.8,.12,wood);box(0,2.8,0,2.5,.2,1.8,wood)}
 else if(id==='bench'){box(0,.65,0,2,.16,.6,wood);box(0,1.05,-.25,2,.4,.1,wood);for(const x of [-.75,.75])box(x,.3,0,.15,.6,.4,wood)}
 else if(id==='fence'||id==='ruin'){for(const x of [-1,1])box(x,.8,0,.18,1.6,.18,id==='ruin'?stone:wood);for(const y of [.6,1.2])box(0,y,0,2.2,.16,.12,id==='ruin'?stone:wood)}
 else if(id==='lantern'||id==='banner'){cyl(0,1.7,0,.07,3.4,wood);box(.42,3.2,0,.9,.07,.07,metal);box(.65,2.65,0,id==='banner'?.8:.3,id==='banner'?1.1:.4,.10,id==='banner'?0x315b71:0xe7c678)}
 else if(id==='campfire'){for(let i=0;i<6;i++){const m=box(0,.15,0,.18,.18,1.1,wood);m.rotation.y=i*Math.PI/3}cyl(0,.55,0,.32,.8,0xff9a3c,0)}
 else if(id==='market'){for(const x of [-1,1])for(const z of [-.6,.6])box(x,1.2,z,.1,2.4,.1,wood);box(0,2.4,0,2.4,.12,1.6,0x487e71);box(0,.9,0,2,.15,1.2,wood)}
 else {box(0,.45,0,1,.9,.85,wood);for(const y of [.15,.75])box(0,y,.44,1.02,.08,.05,metal);if(id==='chest')box(0,.52,.47,.12,.17,.05,0xc9a45f)}
 return g;
}
// Service actors retain a visible defensive attack preview even when they cannot be targeted.
export function serviceAttackEffect(T,rig,style){
 const root=new T.Group();rig.root.add(root);root.position.set(0,1.75,.5);root.visible=false;
 if(['magic','arrow'].includes(style)){
  const projectile=new T.Mesh(style==='arrow'?new T.CylinderGeometry(.025,.025,1,6):new T.SphereGeometry(.16,8,6),new T.MeshStandardMaterial({color:style==='magic'?0x83c5ff:0xcdb877,emissive:style==='magic'?0x224b88:0x000000}));if(style==='arrow')projectile.rotation.x=Math.PI/2;root.add(projectile);
 }
 return {update(attack){const t=1-Math.min(1,attack/.55);root.visible=attack>0&&t>.15&&['magic','arrow'].includes(style);root.position.z=.5+t*2.5}};
}
