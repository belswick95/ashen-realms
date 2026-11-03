// Elliptical anatomical cross-sections: reusable low-poly meshes with clean UVs,
// outward normals and closed ends. Coordinates remain local to the existing rig.
export function loftGeometry(T,rings,sides=20){
 const positions=[],uv=[],indices=[],span=rings.at(-1)[0]-rings[0][0]||1;
 for(const [y,rx,rz,cx=0,cz=0] of rings)for(let j=0;j<=sides;j++){const angle=j/sides*Math.PI*2;positions.push(cx+Math.cos(angle)*rx,y,cz+Math.sin(angle)*rz);uv.push(j/sides,(y-rings[0][0])/span)}
 const stride=sides+1;
 for(let row=0;row<rings.length-1;row++)for(let j=0;j<sides;j++){const a=row*stride+j,b=a+1,c=a+stride,d=c+1;indices.push(a,c,b,b,c,d)}
 const bottom=positions.length/3;positions.push(rings[0][3]||0,rings[0][0],rings[0][4]||0);uv.push(.5,0);
 const top=positions.length/3,last=rings.at(-1);positions.push(last[3]||0,last[0],last[4]||0);uv.push(.5,1);
 for(let j=0;j<sides;j++){indices.push(j,j+1,bottom);const a=(rings.length-1)*stride+j;indices.push(a,top,a+1)}
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 const normals=geometry.attributes.normal;
 for(let row=0;row<rings.length;row++){const a=row*stride,b=a+sides,n=new T.Vector3().fromBufferAttribute(normals,a).add(new T.Vector3().fromBufferAttribute(normals,b)).normalize();normals.setXYZ(a,n.x,n.y,n.z);normals.setXYZ(b,n.x,n.y,n.z)}
 geometry.computeBoundingSphere();return geometry;
}
export function fabricMaterial(T,color,cache){
 const key='wovenFabric:'+color;if(cache.has(key))return cache.get(key);
 const material=new T.MeshStandardMaterial({color,roughness:.93,flatShading:false});
 // Node geometry checks have no DOM; browser builds add the shared woven texture.
 if(typeof document!=='undefined'){
  let texture=cache.get('wovenFabricTexture');
  if(!texture){const canvas=document.createElement('canvas');canvas.width=canvas.height=128;const ctx=canvas.getContext('2d');const pixels=ctx.createImageData(128,128);let seed=2419;
   for(let y=0;y<128;y++)for(let x=0;x<128;x++){seed=(Math.imul(seed,1664525)+1013904223)>>>0;const weave=((x%4<2)===(y%4<2)?4:-4),shade=226+weave+(seed/4294967296-.5)*12,i=(y*128+x)*4;pixels.data[i]=pixels.data[i+1]=pixels.data[i+2]=shade;pixels.data[i+3]=255}
   ctx.putImageData(pixels,0,0);texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.repeat.set(4,4);texture.colorSpace=T.SRGBColorSpace;cache.set('wovenFabricTexture',texture);
  }
  material.map=texture;material.bumpMap=texture;material.bumpScale=.004;
 }
 material.userData.eldervaleShared=true;cache.set(key,material);return material;
}
