// Original Eldervale shoulder-to-ankle cloth cape with lightweight procedural sway.
export function createCape(T,body,{color=0x71364a,rig=null}={}){
 const width=1.10,rows=12,cols=12,height=1.96;
 const positions=[],uvs=[],indices=[];
 for(let row=0;row<=rows;row++){
  const t=row/rows,spread=.84+.33*Math.sin(t*Math.PI*.65);
  for(let col=0;col<=cols;col++){
   const u=col/cols,x=(u-.5)*width*spread;
   // Drape outside the torso and platebody; flare away from the back as it falls.
   positions.push(x,2.15-height*t,-.43-.20*t-.09*Math.sin(t*Math.PI));
   uvs.push(u,1-t);
  }
 }
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const i=r*(cols+1)+c;indices.push(i,i+cols+1,i+1,i+1,i+cols+1,i+cols+2);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const material=new T.MeshStandardMaterial({color,side:T.DoubleSide,roughness:.92,metalness:0});
 const cloth=new T.Mesh(geometry,material);cloth.castShadow=true;cloth.receiveShadow=true;cloth.frustumCulled=false;cloth.userData.attachedCape=true;body.add(cloth);
 const trim=new T.MeshStandardMaterial({color:0xd6b57c,metalness:.38,roughness:.52});
 const clasps=[];for(const side of [-1,1]){
  const clasp=new T.Mesh(new T.SphereGeometry(.07,12,8),trim);
  clasp.position.set(side*.35,2.15,-.43);cloth.add(clasp);clasps.push(clasp);
 }
 let time=0;const inverse=new T.Matrix4(),anchor=new T.Matrix4(),v=new T.Vector3(),point=new T.Vector3();
 const jointPosition=joint=>body.worldToLocal(joint.getWorldPosition(new T.Vector3()));
 function clearance(x,y,z,capsules){
  // Back surface of posed leg capsules, including plate greaves. Cloth may move
  // outward instantly, but cannot pass through a leg during recovery or turns.
  for(const [a,b,radius] of capsules){const dx=b.x-a.x,dy=b.y-a.y,d=dx*dx+dy*dy,t=d?Math.max(0,Math.min(1,((x-a.x)*dx+(y-a.y)*dy)/d)):0,cx=a.x+t*dx,cy=a.y+t*dy,r2=radius*radius-(x-cx)**2-(y-cy)**2;if(r2>0)z=Math.min(z,a.z+t*(b.z-a.z)-Math.sqrt(r2)-.045)}return z;
 }

 return {mesh:cloth,update(dt,speed=0,{mounted=false}={}){
  time+=Math.min(.05,dt);const movement=Math.min(1,Math.max(0,speed));
  body.updateWorldMatrix(true,true);inverse.copy(body.matrixWorld).invert();anchor.identity();
  if(rig?.base)anchor.multiplyMatrices(inverse,rig.base.matrixWorld);
  const capsules=[];if(rig)for(const side of ['left','right']){const hip=jointPosition(rig[side+'Leg']),knee=jointPosition(rig[side+'Knee']),ankle=jointPosition(rig[side+'Ankle']);capsules.push([hip,knee,.23],[knee,ankle,.20]);}
  const attr=geometry.attributes.position;
  for(let r=0;r<=rows;r++){
   const t=r/rows,weight=t*t;
   for(let c=0;c<=cols;c++){
    const u=c/cols,i=r*(cols+1)+c,base=i*3;
    const wave=Math.sin(time*(3.2+movement*4.8)-t*6.2+u*2.3);
    point.set(positions[base]+weight*Math.sin(time*2.4-t*3.5)*(.018+movement*.025),positions[base+1]+weight*.015*Math.sin(time*4-t*5+u),positions[base+2]-weight*(.045+movement*.13)+weight*wave*(.012+movement*.025)).applyMatrix4(anchor);
    point.z=clearance(point.x,point.y,point.z,capsules);
    if(mounted&&t>.45)point.z=Math.min(point.z,-.55-(t-.45)*1.7);
    attr.setXYZ(i,point.x,point.y,point.z);
   }
  }
  for(let i=0;i<clasps.length;i++){v.set((i?1:-1)*.35,2.15,-.43).applyMatrix4(anchor);clasps[i].position.copy(v)}
  attr.needsUpdate=true;geometry.computeVertexNormals();
 }};
}
