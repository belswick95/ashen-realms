import {meshItemIcon} from './item-appearance.js?v=release-20261104-hands53';
// Procedural low-poly iron equipment. Meshes share materials and are attached to the right hand.
export const weaponCatalog={
 battleaxe:{name:'Iron battleaxe',kind:'weapon',damage:14,attack:16,speed:2.8,reach:2.2,desc:'A one-handed double-headed iron battleaxe.'},
 dagger:{name:'Iron dagger',kind:'weapon',damage:5,attack:8,speed:1.4,reach:1.7,desc:'A light blade for quick thrusts.'},
 scimitar:{name:'Iron scimitar',kind:'weapon',damage:7,attack:12,speed:1.7,reach:2.4,desc:'A swift curved iron blade.'},
 longsword:{name:'Iron longsword',kind:'weapon',damage:10,attack:14,speed:2.3,reach:2.5,desc:'A balanced straight iron sword.'},
 twohand:{name:'Iron 2h sword',kind:'weapon',damage:16,attack:20,speed:3.2,reach:2.8,desc:'A heavy two-handed iron sword.'},
 shortsword:{name:'Iron shortsword',kind:'weapon',damage:6,attack:10,speed:1.6,reach:2.1,desc:'A fast close-range iron sword.'},
 pickaxe:{name:'Iron pickaxe',kind:'tool',damage:4,attack:3,speed:2.5,reach:2.1,desc:'An iron pick for mining ore.'},
 axe:{name:'Iron axe',kind:'tool',damage:5,attack:4,speed:2.4,reach:2.1,desc:'An iron axe for cutting trees.'}
};
for(const item of Object.values(weaponCatalog))item.desc+=' Attack +'+item.attack+' · Damage +'+item.damage+' · Attack turn '+item.speed+'s.';
export function makeWeapon(T,key){
 const group=new T.Group();
 const steel=new T.MeshStandardMaterial({color:0xaebac0,metalness:.7,roughness:.34,flatShading:true});
 const highlight=new T.MeshStandardMaterial({color:0xdce3e2,metalness:.7,roughness:.25,flatShading:true});
 const grip=new T.MeshStandardMaterial({color:0x51392b,roughness:.85});
 const brass=new T.MeshStandardMaterial({color:0xbca16b,metalness:.5,roughness:.45});
 function mesh(g,m,x,y,z){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;group.add(o);return o}
 function box(w,h,d,m,x,y,z){return mesh(new T.BoxGeometry(w,h,d),m,x,y,z)}
 function blade(length,width,curved=false){
  // Low-poly sword blade: tapered silhouette, bevelled steel faces and a
  // narrow central fuller. The grip is at local Y=0; the tip points +Y.
  const shape=new T.Shape(),sweep=curved?.22:0;
  shape.moveTo(-width*.49,0);
  shape.lineTo(width*.49,0);
  shape.lineTo(width*(curved?.92:.43)+sweep*.45,length*.52);
  shape.lineTo(width*(curved?1.05:.23)+sweep*.78,length*.80);
  shape.lineTo(sweep*1.35,length);
  shape.lineTo(-width*.24+sweep*.65,length*.80);
  shape.lineTo(-width*.43+sweep*.12,length*.48);
  shape.closePath();
  const g=new T.ExtrudeGeometry(shape,{depth:.043,bevelEnabled:true,bevelThickness:.014,bevelSize:.011,bevelSegments:1,steps:1});
  mesh(g,steel,0,.17,-.022);
  // A slender raised ridge reads as forged steel without the thick rectangular
  // bar that previously obscured the sword's taper and point.
  const ridge=new T.Mesh(new T.CylinderGeometry(.008,.012,length*.72,4),highlight);
  ridge.position.set(sweep*.20,.17+length*.42,.038);
  ridge.rotation.z=curved?-.075:0;ridge.castShadow=true;group.add(ridge);
 }
 const isTool=key==='pickaxe'||key==='axe'||key==='battleaxe';
 const handle=key==='twohand'? .8:isTool?.85:key==='dagger'?.30:.39;
 box(.09,handle,.095,grip,0,handle/2-.18,0);
 box(.12,.09,.12,brass,0,-.19,0);
 if(isTool){
  box(.12,.12,.12,brass,0,handle-.23,0);
  if(key==='battleaxe'){
   for(const side of [-1,1]){const shape=new T.Shape();shape.moveTo(side*.04,0);shape.lineTo(side*.34,-.10);shape.lineTo(side*.46,.12);shape.lineTo(side*.36,.40);shape.lineTo(side*.04,.30);shape.closePath();const head=mesh(new T.ExtrudeGeometry(shape,{depth:.075,bevelEnabled:true,bevelSize:.014,bevelThickness:.014,bevelSegments:1}),steel,0,handle-.42,-.04);head.geometry.translate(0,-.15,0);head.position.y+=.15;head.name='axe-blade';head.rotation.y=Math.PI/2}
  }else if(key==='axe'){
   const shape=new T.Shape();shape.moveTo(-.04,0);shape.lineTo(.34,.13);shape.lineTo(.44,.30);shape.lineTo(.34,.48);shape.lineTo(-.04,.56);shape.closePath();
   const head=mesh(new T.ExtrudeGeometry(shape,{depth:.075,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:1}),steel,0,handle-.51,-.04);head.geometry.translate(0,-.28,0);head.position.y+=.28;head.name='axe-blade';head.rotation.y=-Math.PI/2
  }else{
   const shape=new T.Shape();shape.moveTo(-.52,.04);shape.lineTo(-.22,.20);shape.lineTo(.25,.20);shape.lineTo(.53,.04);shape.lineTo(.25,.10);shape.lineTo(-.22,.10);shape.closePath();
   const head=mesh(new T.ExtrudeGeometry(shape,{depth:.075,bevelEnabled:true,bevelSize:.01,bevelThickness:.01,bevelSegments:1}),steel,0,handle-.24,-.04);head.geometry.translate(0,-.12,0);head.position.y+=.12;head.name='pick-head';head.rotation.y=Math.PI/2
  }
 }else{
  box(key==='twohand'?.44:.34,.065,.13,brass,0,handle-.12,0);
  blade(key==='dagger'?.40:key==='shortsword'?.56:key==='twohand'?1.50:key==='longsword'?1.0:.95,key==='twohand'?.21:key==='scimitar'?.20:key==='dagger'?.10:.15,key==='scimitar');
  // blade geometry starts above the crossguard
  group.children.slice(-2).forEach(o=>o.position.y+=handle-.25)
 }
 // Mesh geometry is authored with blade tip along local +Y and hilt at the origin.
 // Rotating it 180 degrees inverted the blade and put the point behind the hand.
 group.rotation.z=key==='twohand'?-.12:0;group.scale.setScalar(.8);
 return group
}
export function iconForWeapon(key){return meshItemIcon('weapon:'+key)}
