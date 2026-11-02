// Procedural low-poly iron equipment. Meshes share materials and are attached to the right hand.
export const weaponCatalog={
 scimitar:{name:'Iron scimitar',kind:'weapon',damage:7,speed:.72,reach:2.4,desc:'A swift curved iron blade.'},
 longsword:{name:'Iron longsword',kind:'weapon',damage:10,speed:1.05,reach:2.5,desc:'A balanced straight iron sword.'},
 twohand:{name:'Iron 2h sword',kind:'weapon',damage:16,speed:1.55,reach:2.8,desc:'A heavy two-handed iron sword.'},
 shortsword:{name:'Iron shortsword',kind:'weapon',damage:6,speed:.63,reach:2.1,desc:'A fast close-range iron sword.'},
 pickaxe:{name:'Iron pickaxe',kind:'tool',damage:4,speed:1.05,reach:2.1,desc:'An iron pick for mining ore.'},
 axe:{name:'Iron axe',kind:'tool',damage:5,speed:.95,reach:2.1,desc:'An iron axe for cutting trees.'}
};
export function makeWeapon(T,key){
 const group=new T.Group();
 const steel=new T.MeshStandardMaterial({color:0xaebac0,metalness:.7,roughness:.34,flatShading:true});
 const highlight=new T.MeshStandardMaterial({color:0xdce3e2,metalness:.7,roughness:.25,flatShading:true});
 const grip=new T.MeshStandardMaterial({color:0x51392b,roughness:.85});
 const brass=new T.MeshStandardMaterial({color:0xbca16b,metalness:.5,roughness:.45});
 function mesh(g,m,x,y,z){const o=new T.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;group.add(o);return o}
 function box(w,h,d,m,x,y,z){return mesh(new T.BoxGeometry(w,h,d),m,x,y,z)}
 function blade(length,width,curved=false){
  const shape=new T.Shape();shape.moveTo(-width/2,0);shape.lineTo(width/2,0);
  shape.lineTo(width/2+(curved?.11:0),length*.68);shape.lineTo(curved?.06:0,length);shape.lineTo(-width*.35+(curved?.08:0),length*.77);shape.closePath();
  const g=new T.ExtrudeGeometry(shape,{depth:.065,bevelEnabled:true,bevelThickness:.012,bevelSize:.012,bevelSegments:1,steps:1});
  mesh(g,steel,0,.17,-.033);box(.018,length*.70,.077,highlight,curved?.025:0,length*.50+.17,.025)
 }
 const isTool=key==='pickaxe'||key==='axe';
 const handle=key==='twohand'? .8:isTool?.85:.39;
 box(.09,handle,.095,grip,0,handle/2-.18,0);
 box(.12,.09,.12,brass,0,-.19,0);
 if(isTool){
  box(.12,.12,.12,brass,0,handle-.23,0);
  if(key==='axe'){
   const shape=new T.Shape();shape.moveTo(-.04,0);shape.lineTo(.34,.13);shape.lineTo(.44,.30);shape.lineTo(.34,.48);shape.lineTo(-.04,.56);shape.closePath();
   mesh(new T.ExtrudeGeometry(shape,{depth:.075,bevelEnabled:true,bevelSize:.012,bevelThickness:.012,bevelSegments:1}),steel,0,handle-.51,-.04)
  }else{
   const shape=new T.Shape();shape.moveTo(-.52,.04);shape.lineTo(-.22,.20);shape.lineTo(.25,.20);shape.lineTo(.53,.04);shape.lineTo(.25,.10);shape.lineTo(-.22,.10);shape.closePath();
   mesh(new T.ExtrudeGeometry(shape,{depth:.075,bevelEnabled:true,bevelSize:.01,bevelThickness:.01,bevelSegments:1}),steel,0,handle-.24,-.04)
  }
 }else{
  box(key==='twohand'?.44:.34,.065,.13,brass,0,handle-.12,0);
  blade(key==='shortsword'?.56:key==='twohand'?1.22:key==='longsword'?1.0:.83,key==='twohand'?.21:.15,key==='scimitar');
  // blade geometry starts above the crossguard
  group.children.slice(-2).forEach(o=>o.position.y+=handle-.25)
 }
 group.rotation.z=Math.PI;group.scale.setScalar(.8);
 return group
}
export const weaponIcons={
 scimitar:'<path d="M11 39Q33 26 37 5Q44 27 15 43Z" fill="#bccbd0" stroke="#f4e8c8" stroke-width="2"/><path d="M12 35L5 42M7 34L17 43" stroke="#ac8952" stroke-width="4"/>',
 longsword:'<path d="M22 5L26 5L28 30L24 37L20 30Z" fill="#b9c8cf" stroke="#edf3e7" stroke-width="2"/><path d="M12 32H36M24 32V44" stroke="#b18d56" stroke-width="4"/>',
 twohand:'<path d="M22 3L26 3L30 29L24 36L18 29Z" fill="#b5c5cd" stroke="#f0f0e5" stroke-width="2"/><path d="M10 30H38M24 30V45" stroke="#a88450" stroke-width="4"/>',
 shortsword:'<path d="M22 11L26 11L28 28L24 34L20 28Z" fill="#b9c8cf" stroke="#eaf1e9" stroke-width="2"/><path d="M15 30H33M24 30V42" stroke="#b18d56" stroke-width="4"/>',
 pickaxe:'<path d="M23 12L28 12L27 43H22Z" fill="#815b37"/><path d="M5 15Q23 1 43 15L34 18L24 14L13 19Z" fill="#aab9c1" stroke="#e9e9df" stroke-width="2"/>',
 axe:'<path d="M24 8L29 8L27 44H23Z" fill="#79532f"/><path d="M25 9L10 5L4 14L10 28L25 23Z" fill="#aebec5" stroke="#e8e9dd" stroke-width="2"/>'
};
export function iconForWeapon(key){return '<svg viewBox="0 0 48 48" aria-hidden="true">'+(weaponIcons[key]||'')+'</svg>'}
