// Lightweight faceted RPG adventurers: shared geometries and materials, tapered anatomy.
export function buildHumanoid(T,root,look={}){
 const color=(v,d)=>/^#[0-9a-f]{6}$/i.test(v||'')?parseInt(v.slice(1),16):typeof v==='number'?v:d;
 const palette={skin:color(look.skin,0xc9916b),shirt:color(look.shirt,0x426e68),pants:color(look.pants,0x45494d),hair:color(look.hairColor,0x3a2920)};
 const cache=buildHumanoid.cache||(buildHumanoid.cache=new Map());
 const material=(c)=>{if(!cache.has('m'+c))cache.set('m'+c,new T.MeshStandardMaterial({color:c,roughness:.83,flatShading:false}));return cache.get('m'+c)};
 const geometry=(key,fn)=>{if(!cache.has(key))cache.set(key,fn());return cache.get(key)};
 function mesh(geo,c,parent,x,y,z,sx=1,sy=1,sz=1){const m=new T.Mesh(geo,material(c));m.position.set(x,y,z);m.scale.set(sx,sy,sz);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 const sphere=geometry('sphere10',()=>new T.SphereGeometry(1,20,14));
 const torsoGeo=geometry('torso',()=>new T.CylinderGeometry(.40,.30,.9,20,1));
 const limbGeo=geometry('limb',()=>new T.CylinderGeometry(1,.78,1,16,1));
 const headGeo=geometry('head',()=>new T.SphereGeometry(1,24,16));
 const shoeGeo=geometry('shoe',()=>new T.SphereGeometry(1,20,12));
 const torso=mesh(torsoGeo,palette.shirt,root,0,1.49,0,1,1,.62);
 mesh(geometry('waist',()=>new T.CylinderGeometry(.31,.30,.15,18)),0x574333,root,0,1.01,0,1,1,.65);
 const neck=mesh(geometry('neck',()=>new T.CylinderGeometry(.11,.12,.17,16)),palette.skin,root,0,2.00,0);
 const face=mesh(headGeo,palette.skin,root,0,2.29,.025,.30,.36,.28);
 for(const side of [-1,1]){
  mesh(sphere,0x241e1c,root,side*.115,2.32,.286,.024,.018,.012);
  mesh(geometry('brow',()=>new T.BoxGeometry(.09,.025,.025)),0x493229,root,side*.115,2.415,.275);
  mesh(sphere,palette.skin,root,side*.287,2.265,0,.06,.08,.07)
 }
 mesh(geometry('nose',()=>new T.ConeGeometry(.065,.15,5)),palette.skin,root,0,2.225,.305,.65,.75,.65).rotation.x=Math.PI/2;
 mesh(geometry('mouth',()=>new T.BoxGeometry(.13,.017,.012)),0x754b40,root,0,2.13,.289);
 const hair=look.hair||'Side swept';
 mesh(sphere,palette.hair,root,0,2.52,-.012,.31,hair==='Buzz cut'?.075:.15,.28);
 if(hair==='Side swept'){const f=mesh(geometry('fringe',()=>new T.BoxGeometry(.34,.085,.15)),palette.hair,root,-.08,2.53,.205);f.rotation.z=-.22}
 if(hair==='Short crop')mesh(geometry('crop',()=>new T.BoxGeometry(.40,.085,.18)),palette.hair,root,0,2.53,.16);
 if(hair==='Spiky')for(let i=-2;i<=2;i++)mesh(geometry('spike',()=>new T.ConeGeometry(.09,.23,5)),palette.hair,root,i*.1,2.7,-.015).rotation.z=i*.13;
 if(hair==='Long')for(const side of [-1,1])mesh(limbGeo,palette.hair,root,side*.25,2.31,-.085,.095,.38,.13);
 const leftArm=new T.Group(),rightArm=new T.Group(),leftLeg=new T.Group(),rightLeg=new T.Group();
 leftArm.position.set(-.45,1.86,0);rightArm.position.set(.45,1.86,0);
 leftLeg.position.set(-.17,.99,0);rightLeg.position.set(.17,.99,0);root.add(leftArm,rightArm,leftLeg,rightLeg);
 for(const arm of [leftArm,rightArm]){
  mesh(limbGeo,palette.shirt,arm,0,-.19,0,.205,.37,.22);
  mesh(limbGeo,palette.skin,arm,0,-.50,0,.135,.40,.15);
  mesh(sphere,palette.skin,arm,0,-.75,.01,.12,.13,.12);
 }
 for(const leg of [leftLeg,rightLeg]){
  mesh(limbGeo,palette.pants,leg,0,-.38,0,.185,.78,.20);
  mesh(shoeGeo,0x302b28,leg,0,-.83,.10,.19,.13,.31);
 }
 return {root,body:root,leftArm,rightArm,leftLeg,rightLeg,torso,neck,face};
}
