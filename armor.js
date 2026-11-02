// Eldervale plate armor: fitted, beveled low-poly meshes, not oversized cubes.
// All coordinates are local to the shared 2.7-unit humanoid rig.
export function buildPlateArmor(T,body,rig){
 const steel=new T.MeshStandardMaterial({color:0xb8c3ca,metalness:.72,roughness:.32,flatShading:true});
 const shade=new T.MeshStandardMaterial({color:0x59646c,metalness:.66,roughness:.4,flatShading:true});
 const edge=new T.MeshStandardMaterial({color:0xe1e5df,metalness:.76,roughness:.28,flatShading:true});
 const leather=new T.MeshStandardMaterial({color:0x593b32,roughness:.87});
 const gold=new T.MeshStandardMaterial({color:0xbca06a,metalness:.68,roughness:.35});
 const plume=new T.MeshStandardMaterial({color:0x743d3b,roughness:.9,flatShading:true,side:T.DoubleSide});
 const slots={helm:[],chest:[],legs:[],boots:[]};
 function add(geo,mat,parent,pos,slot){const m=new T.Mesh(geo,mat);m.position.set(...pos);m.castShadow=true;m.receiveShadow=true;parent.add(m);slots[slot].push(m);return m}
 function plate(parent,slot,points,z,depth=.09,mat=steel,bevel=.025){
  const s=new T.Shape();points.forEach(([x,y],i)=>i?s.lineTo(x,y):s.moveTo(x,y));s.closePath();
  const geo=new T.ExtrudeGeometry(s,{depth,bevelEnabled:bevel>0,bevelThickness:bevel,bevelSize:bevel,bevelSegments:1,steps:1,curveSegments:1});
  geo.computeVertexNormals();return add(geo,mat,parent,[0,0,z],slot);
 }
 function cylinder(parent,slot,r1,r2,h,pos,mat=steel,segments=8){return add(new T.CylinderGeometry(r1,r2,h,segments,1),mat,parent,pos,slot)}
 function strip(parent,slot,w,h,d,pos,mat=edge){return add(new T.BoxGeometry(w,h,d),mat,parent,pos,slot)}
 // Helmet: shaped shell, dark recessed visor, cheek plates, brow and red horsehair crest.
 const helmet=add(new T.SphereGeometry(.347,10,7,0,Math.PI*2,0,Math.PI*.74),steel,body,[0,2.38,0],'helm');
 helmet.scale.set(1.07,1.1,1.06);
 plate(body,'helm',[[-.33,2.45],[.33,2.45],[.30,2.18],[.20,2.11],[.14,2.22],[-.14,2.22],[-.20,2.11],[-.30,2.18]],.24,.055,steel);
 plate(body,'helm',[[-.20,2.35],[.20,2.35],[.16,2.25],[-.16,2.25]],.322,.009,shade,.006);
 plate(body,'helm',[[-.055,2.37],[.055,2.37],[.095,2.14],[0,2.06],[-.095,2.14]],.349,.035,edge,.012);
 strip(body,'helm',.70,.075,.10,[0,2.47,.29],edge);
 for(const side of [-1,1]){
  plate(body,'helm',[[side*.23,2.38],[side*.34,2.34],[side*.31,2.11],[side*.23,2.07]],.18,.09,steel);
  cylinder(body,'helm',.04,.04,.04,[side*.31,2.32,.25],gold,8)
 }
 const crest=cylinder(body,'helm',.055,.055,.32,[0,2.73,-.035],shade);
 for(let i=0;i<7;i++){const a=i/6;const f=plate(body,'helm',[[-.07+a*.02,2.74-a*.13],[.075,2.78-a*.07],[.15+a*.16,2.69-a*.20],[.03,2.67-a*.10]],-.04-i*.018,.013,plume,.005);f.rotation.z=-a*.15}
 // Chest: tapered cuirass with layered breastplate, collar, waist faulds and gold accents.
 plate(body,'chest',[[-.41,1.91],[.41,1.91],[.43,1.66],[.30,1.17],[.20,1.10],[-.20,1.10],[-.30,1.17],[-.43,1.66]],.23,.10,steel);
 plate(body,'chest',[[-.38,1.87],[0,1.92],[.38,1.87],[.31,1.55],[0,1.39],[-.31,1.55]],.34,.055,edge);
 plate(body,'chest',[[-.29,1.50],[0,1.35],[.29,1.50],[.24,1.25],[0,1.15],[-.24,1.25]],.32,.055,steel);
 plate(body,'chest',[[-.13,1.99],[.13,1.99],[.20,1.86],[-.20,1.86]],.29,.08,shade);
 for(const side of [-1,1]){
  const arm=side<0?rig.leftArm:rig.rightArm;
  // Pauldrons attach to shoulders so they animate with the arms.
  const shoulder=cylinder(arm,'chest',.255,.19,.30,[0,-.15,0],steel,10);shoulder.rotation.z=side*.15;
  const rim=cylinder(arm,'chest',.255,.25,.065,[0,-.30,0],edge,10);
  cylinder(arm,'chest',.17,.135,.29,[0,-.51,0],shade,8);
  const vambrace=cylinder(arm,'chest',.18,.125,.34,[0,-.59,0],steel,8);
  cylinder(arm,'chest',.16,.13,.11,[0,-.79,0],steel,8);
  strip(body,'chest',.065,.48,.08,[side*.37,1.54,.28],shade)
 }
 for(let i=0;i<3;i++)plate(body,'chest',[[-.33+i*.03,1.17-i*.095],[.33-i*.03,1.17-i*.095],[.29-i*.03,1.08-i*.095],[-.29+i*.03,1.08-i*.095]],.29-i*.025,.035,i===1?edge:steel,.008);
 strip(body,'chest',.55,.09,.12,[0,1.10,.35],leather);
 cylinder(body,'chest',.075,.075,.045,[0,1.10,.42],gold);
 // Leg armor: fitted thigh plates and separate articulated knee / shin guards.
 for(const leg of [rig.leftLeg,rig.rightLeg]){
  cylinder(leg,'legs',.205,.175,.45,[0,-.25,0],steel,8);
  plate(leg,'legs',[[-.18,-.10],[.18,-.10],[.16,-.47],[0,-.53],[-.16,-.47]],.18,.05,edge);
  cylinder(leg,'legs',.22,.20,.18,[0,-.56,.03],steel,9);
  plate(leg,'legs',[[-.16,-.54],[.16,-.54],[.13,-.70],[0,-.77],[-.13,-.70]],.22,.055,steel);
  cylinder(leg,'legs',.165,.135,.29,[0,-.73,0],shade,8);
  // Sabatons follow the leg pivots; overlapping plates form a pointed toe.
  const shoe=add(new T.SphereGeometry(.20,8,6),steel,leg,[0,-.88,.14],'boots');shoe.scale.set(1.12,.65,1.65);
  plate(leg,'boots',[[-.19,-.80],[.19,-.80],[.15,-.95],[0,-1.00],[-.15,-.95]],.19,.12,steel);
  strip(leg,'boots',.34,.045,.32,[0,-.87,.29],edge)
 }
 // Default hidden until equipped.
 Object.values(slots).flat().forEach(m=>m.visible=false);
 return slots;
}
