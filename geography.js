// Shared world-space outlines. The 3D scene and both maps consume this data.
export const worldRoads=[[[0,0],[-60,45]],[[0,0],[75,-55]],[[0,0],[105,103]],[[-60,45],[-105,-91]],[[-60,45],[-210,145]],[[75,-55],[260,-185]],[[105,103],[225,215]],[[-105,-91],[-275,-215]]];
export function roadPoints(a,b,segments=32){
 const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz)||1;
 const seed=Math.sin(a[0]*127.1+b[1]*311.7)*43758.5453;
 const side=seed-Math.floor(seed)>.5?1:-1,bend=Math.min(length*.12,12)*side;
 const mx=(a[0]+b[0])/2-dz/length*bend,mz=(a[1]+b[1])/2+dx/length*bend;
 return Array.from({length:segments+1},(_,i)=>{const t=i/segments,u=1-t;return [u*u*a[0]+2*u*t*mx+t*t*b[0],u*u*a[1]+2*u*t*mz+t*t*b[1]]});
}
export function lakeOutline(lake,factor=1){
 return Array.from({length:64},(_,i)=>{
  const a=i/64*Math.PI*2;
  const wobble=1+.085*Math.sin(a*5+lake.x*.17)+.055*Math.sin(a*9+lake.z*.13)+.025*Math.sin(a*17);
  return [lake.x+Math.cos(a)*lake.rx*wobble*factor,lake.z+Math.sin(a)*lake.rz*wobble*factor];
 });
}
export function ribbonGeometry(T,points,width){
 const positions=[],uv=[],indices=[];
 let traveled=0;
 for(let i=0;i<points.length;i++){
  const p=points[i],before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
  const dx=after[0]-before[0],dz=after[1]-before[1],length=Math.hypot(dx,dz)||1;
  if(i)traveled+=Math.hypot(p[0]-before[0],p[1]-before[1]);
  for(const side of [-1,1]){positions.push(p[0]-dz/length*width/2*side,0,p[1]+dx/length*width/2*side);uv.push((side+1)/2,traveled/3)}
  if(i){const a=(i-1)*2;indices.push(a,a+2,a+1,a+1,a+2,a+3)}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 // Width offsets above put the right edge first, so ensure upward-facing surfaces.
 if(geometry.attributes.normal.getY(0)<0){for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];geometry.setIndex(indices);geometry.computeVertexNormals()}
 return geometry;
}
