// Original Eldervale shoulder-to-ankle cloth cape with lightweight procedural sway.
export function createCape(T,body,{color=0x71364a}={}){
 const width=1.10,rows=12,cols=12,height=2.25;
 const positions=[],uvs=[],indices=[];
 for(let row=0;row<=rows;row++){
  const t=row/rows,spread=.84+.33*Math.sin(t*Math.PI*.65);
  for(let col=0;col<=cols;col++){
   const u=col/cols,x=(u-.5)*width*spread;
   // Drape outside the torso and platebody; flare away from the back as it falls.
   positions.push(x,2.46-height*t,-.43-.20*t-.09*Math.sin(t*Math.PI));
   uvs.push(u,1-t);
  }
 }
 for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
  const i=r*(cols+1)+c;indices.push(i,i+cols+1,i+1,i+1,i+cols+1,i+cols+2);
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const material=new T.MeshStandardMaterial({color,side:T.DoubleSide,roughness:.92,metalness:0});
 const cloth=new T.Mesh(geometry,material);cloth.castShadow=true;cloth.receiveShadow=true;cloth.frustumCulled=false;body.add(cloth);
 const trim=new T.MeshStandardMaterial({color:0xd6b57c,metalness:.38,roughness:.52});
 for(const side of [-1,1]){
  const clasp=new T.Mesh(new T.SphereGeometry(.07,12,8),trim);
  clasp.position.set(side*.45,2.45,-.43);body.add(clasp);
 }
 let time=0;
 return {mesh:cloth,update(dt,speed=0){
  time+=Math.min(.05,dt);const movement=Math.min(1,Math.max(0,speed));
  const attr=geometry.attributes.position;
  for(let r=0;r<=rows;r++){
   const t=r/rows,weight=t*t;
   for(let c=0;c<=cols;c++){
    const u=c/cols,i=r*(cols+1)+c,base=i*3;
    const wave=Math.sin(time*(3.2+movement*4.8)-t*6.2+u*2.3);
    attr.array[base+1]=positions[base+1]+weight*(.025+.04*movement)*Math.sin(time*5.5-t*5+u);
    attr.array[base+2]=positions[base+2]-weight*(.045+movement*.13)+weight*wave*(.018+movement*.055);
    attr.array[base]=positions[base]+weight*Math.sin(time*2.4-t*3.5)*(.025+movement*.05);
   }
  }
  attr.needsUpdate=true;geometry.computeVertexNormals();
 }};
}
