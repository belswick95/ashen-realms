import {creatureMaterial} from './creature-material.js?v=release-20261105-death72';
// Original articulated Eldervale dragon: four clawed feet, long neck, jaw, tail and ribbed wings.
export function dragonModel(T,parent,d){
 const g=new T.Group();parent.add(g);let phase=0,travel=0;const mats=new Map(),legs=[],tails=[],wings=[];
 const mat=c=>{if(!mats.has(c))mats.set(c,creatureMaterial(T,c,'scales'));return mats.get(c)};
 const mesh=(geo,c,x,y,z,p=g)=>{const m=new T.Mesh(geo,mat(c));m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;p.add(m);return m};
 const ell=(x,y,z,a,b,c,col=0x794d3f,p=g)=>{const m=mesh(new T.SphereGeometry(1,24,16),col,x,y,z,p);m.scale.set(a,b,c);return m};
 const joint=(x,y,z,p=g)=>{const q=new T.Group();q.position.set(x,y,z);p.add(q);return q};
 const cone=(x,y,z,r,h,col,p=g)=>mesh(new T.ConeGeometry(r,h,7),col,x,y,z,p);
 ell(0,1.15,-.12,.68,.73,1.16);ell(0,.95,.30,.48,.56,.85,0xba9469);ell(0,1.55,.67,.40,.64,.39);const neck=joint(0,1.9,.95);ell(0,.15,.06,.29,.65,.29,0x86523e,neck);ell(0,.46,.36,.35,.26,.55,0x80503e,neck);ell(0,.37,.72,.30,.16,.35,0x7a4738,neck);
 const jaw=joint(0,.24,.34,neck);ell(0,0,.30,.29,.10,.55,0xc19b71,jaw);
 for(const side of [-1,1]){ell(side*.27,.55,.62,.065,.065,.055,0xffcb3d,neck);ell(side*.29,.56,.66,.022,.04,.025,0x17120b,neck);const horn=cone(side*.27,.84,.17,.10,.58,0xe0c797,neck);horn.rotation.x=-.55;horn.rotation.z=-side*.3;for(let i=0;i<4;i++){const tooth=cone(side*.24,.25,.42+i*.14,.035,.12,0xf4e5c5,neck);tooth.rotation.z=Math.PI;}}
 for(let i=0;i<8;i++){const spike=cone(0,1.79,-1.03+i*.24,.10,.34,0xe0bd87);spike.rotation.x=-.32;}
 for(let i=0;i<5;i++){const q=joint(0,i?0:1.03,i?-.48:-1.06,i?tails[i-1]:g);ell(0,0,-.22,.30-i*.045,.25-i*.035,.40,0x794d3f,q);cone(0,.23,-.2,.06,.18,0xe0bd87,q);tails.push(q)}
 for(let i=0;i<4;i++){const side=i%2?-1:1,q=joint(side*.52,.98,i<2?.65:-.65);ell(side*.08,-.22,0,.23,.39,.23,0x724939,q);ell(side*.08,-.59,.12,.15,.30,.16,0x64483c,q);ell(side*.09,-.81,.25,.23,.12,.32,0x534438,q);for(let c=0;c<3;c++){const claw=cone(side*.09+(c-1)*.13,-.8,.53,.055,.22,0xe0c99e,q);claw.rotation.x=Math.PI/2;}legs.push(q)}
 for(const side of [-1,1]){const q=joint(side*.48,1.75,-.2),shape=new T.Shape();shape.moveTo(0,0);shape.lineTo(side*.65,.75);shape.lineTo(side*2.4,1.15);shape.lineTo(side*2.08,.05);shape.lineTo(side*1.55,.24);shape.lineTo(side*1.24,-.50);shape.lineTo(side*.72,-.28);shape.lineTo(0,-.5);shape.closePath();const membrane=new T.Mesh(new T.ShapeGeometry(shape),new T.MeshStandardMaterial({color:0x542e38,side:T.DoubleSide,roughness:.88}));q.add(membrane);for(const [x,y]of [[side*.65,.75],[side*2.4,1.15],[side*1.24,-.5]]){const a=new T.Vector3(0,0,0),b=new T.Vector3(x,y,0),rib=mesh(new T.CylinderGeometry(.045,.065,b.length(),6),0xc19b71,x/2,y/2,0,q);rib.quaternion.setFromUnitVectors(new T.Vector3(0,1,0),b.clone().normalize());}wings.push(q)}
 const fire=joint(0,2.35,1.9);for(let i=0;i<6;i++)ell(Math.sin(i*3)*.08,0,i*.40,.14+i*.055,.13+i*.055,.30,i%2?0xffc24a:0xff6933,fire);fire.visible=false;
 return {update(dt,m){phase+=dt;travel+=(m.distance||0)*3;const a=m.attack>0?Math.sin(Math.PI*Math.max(0,Math.min(1,1-m.attack/.55))):0;legs.forEach((q,i)=>q.rotation.x=m.distance>0?Math.sin(travel+(i===0||i===3?0:Math.PI))*.33:0);neck.rotation.x=-a*.20;jaw.rotation.x=a*.65;tails.forEach((q,i)=>q.rotation.y=Math.sin(phase*1.4-i*.4)*.08);wings.forEach((q,i)=>q.rotation.y=(i?1:-1)*(.15+Math.sin(phase*1.2)*.04+a*.16));fire.visible=a>.18;fire.scale.setScalar(.7+a*.8);},dispose(){g.traverse(o=>{o.geometry?.dispose();if(o.material&&!mats.has(o.material.color?.getHex()))o.material.dispose()});for(const m of mats.values())m.dispose();g.removeFromParent()}};
}
