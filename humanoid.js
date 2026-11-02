// Shared, deliberately separated low-poly humanoid geometry for players and NPCs.
export function buildHumanoid(T,root,look={}){
 const color=(v,d)=>/^#[0-9a-f]{6}$/i.test(v||'')?parseInt(v.slice(1),16):typeof v==='number'?v:d;
 const skin=color(look.skin,0xc9916b),shirt=color(look.shirt,0x426e68),pants=color(look.pants,0x45494d),hair=color(look.hairColor,0x3a2920);
 const mat=c=>new T.MeshStandardMaterial({color:c,roughness:.9,metalness:0,flatShading:true});
 function mesh(geometry,c,parent,x,y,z){const m=new T.Mesh(geometry,mat(c));m.position.set(x,y,z);m.castShadow=true;m.receiveShadow=true;parent.add(m);return m}
 const cube=(w,h,d,c,p,x,y,z)=>mesh(new T.BoxGeometry(w,h,d),c,p,x,y,z);
 const round=(r,c,p,x,y,z)=>mesh(new T.IcosahedronGeometry(r,1),c,p,x,y,z);
 const torso=cube(.75,.87,.39,shirt,root,0,1.47,0);
 cube(.69,.14,.42,0x574333,root,0,.99,0);
 const neck=cube(.18,.17,.18,skin,root,0,2.00,0);
 const face=mesh(new T.IcosahedronGeometry(.31,1),skin,root,0,2.29,.025);face.scale.set(.91,1.12,.85);
 // Front is positive Z; face features sit beyond the head surface.
 for(const side of [-1,1]){round(.034,0x211e1c,root,side*.12,2.32,.286);cube(.08,.026,.025,0x493229,root,side*.12,2.41,.28)}
 cube(.085,.065,.09,skin,root,0,2.235,.303);
 cube(.14,.024,.015,0x754b40,root,0,2.145,.289);
 for(const side of [-1,1])round(.07,skin,root,side*.293,2.27,0);
 const hairstyle=look.hair||'Side swept';
 const cap=mesh(new T.IcosahedronGeometry(.319,1),hair,root,0,2.505,-.012);
 cap.scale.set(.98,hairstyle==='Buzz cut'?.24:.44,.9);
 if(hairstyle==='Side swept'){const f=cube(.36,.10,.18,hair,root,-.11,2.53,.22);f.rotation.z=-.18}
 if(hairstyle==='Short crop')cube(.46,.11,.21,hair,root,0,2.52,.16);
 if(hairstyle==='Spiky')for(let i=-2;i<=2;i++){const spike=mesh(new T.ConeGeometry(.10,.27,5),hair,root,i*.105,2.76,-.01);spike.rotation.z=i*.10}
 if(hairstyle==='Long')for(const side of [-1,1])cube(.13,.45,.24,hair,root,side*.27,2.30,-.07);
 const leftArm=new T.Group(),rightArm=new T.Group(),leftLeg=new T.Group(),rightLeg=new T.Group();
 leftArm.position.set(-.51,1.86,0);rightArm.position.set(.51,1.86,0);
 leftLeg.position.set(-.205,.99,0);rightLeg.position.set(.205,.99,0);
 root.add(leftArm,rightArm,leftLeg,rightLeg);
 for(const arm of [leftArm,rightArm]){
  cube(.26,.31,.33,shirt,arm,0,-.16,0);
  cube(.19,.42,.23,skin,arm,0,-.52,0);
  round(.13,skin,arm,0,-.77,.015);
 }
 for(const leg of [leftLeg,rightLeg]){
  cube(.30,.79,.32,pants,leg,0,-.40,0);
  cube(.33,.18,.48,0x302b28,leg,0,-.84,.085);
 }
 // Bounding spheres are separate, invisible interaction targets.
 return {root,body:root,leftArm,rightArm,leftLeg,rightLeg,torso,neck,face};
}
