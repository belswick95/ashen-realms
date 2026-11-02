// Original Eldervale low-poly off-hand shields, inspired by traditional medieval silhouettes.
export const shieldCatalog={
 square:{name:'Iron square shield',kind:'shield',defence:5,desc:'A compact rectangular iron shield.'},
 kite:{name:'Iron kiteshield',kind:'shield',defence:9,desc:'A broad iron shield tapering to a pointed base.'}
};
export function makeShield(T,key){
 const g=new T.Group(),kite=key==='kite';
 const outline=kite?[[-.39,.55],[.39,.55],[.43,.18],[.29,-.36],[0,-.82],[-.29,-.36],[-.43,.18]]:[[-.38,.48],[.38,.48],[.38,-.48],[-.38,-.48]];
 const shape=new T.Shape();outline.forEach(([x,y],i)=>i?shape.lineTo(x,y):shape.moveTo(x,y));shape.closePath();
 const rim=new T.MeshStandardMaterial({color:0xb9a06a,metalness:.7,roughness:.35,side:T.DoubleSide});
 const iron=new T.MeshStandardMaterial({color:0x8599a5,metalness:.72,roughness:.37,side:T.DoubleSide});
 const face=new T.Mesh(new T.ExtrudeGeometry(shape,{depth:.07,bevelEnabled:true,bevelThickness:.035,bevelSize:.025,bevelSegments:1}),rim);g.add(face);
 const inset=new T.Mesh(new T.ShapeGeometry(shape),iron);inset.scale.set(.88,.88,1);inset.position.z=.113;g.add(inset);
 const boss=new T.Mesh(new T.SphereGeometry(.105,12,8),rim);boss.scale.z=.36;boss.position.z=.15;g.add(boss);
 const grip=new T.Mesh(new T.BoxGeometry(.12,.38,.1),new T.MeshStandardMaterial({color:0x493527,roughness:.9}));grip.position.z=-.11;g.add(grip);
 // Neutral grip-space mesh. Equipment attachment controls its final side-facing
 // orientation; pre-rotating here would compound and obscure that transform.
 g.position.set(0,0,0);g.rotation.set(0,0,0);g.scale.setScalar(.78);
 g.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true}});
 return g;
}
