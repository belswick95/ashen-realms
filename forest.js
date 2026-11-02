// Spatially batched forest geometry. Chunk bounds preserve distance culling while
// instancing avoids a separate draw call for every branch and leaf cluster.
export function buildForest(T,scene,trees,{wood,leaf,heightAt=()=>0}){
 const chunks=new Map(),dummy=new T.Object3D();
 const trunkGeometry=new T.CylinderGeometry(.34,.52,1,7);
 const pineGeometry=new T.ConeGeometry(1,1,9);
 const crownGeometry=new T.IcosahedronGeometry(1,1);
 for(const tree of trees){const key=Math.floor(tree.x/64)+':'+Math.floor(tree.z/64);if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(tree)}
 const batches=[];
 function batch(geometry,material,items){
  const mesh=new T.InstancedMesh(geometry,material,items.length);
  items.forEach((v,i)=>{dummy.position.set(...v.position);dummy.rotation.set(0,v.yaw||0,v.tilt||0);dummy.scale.set(...v.scale);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);if(v.color)mesh.setColorAt(i,new T.Color(v.color))});
  mesh.instanceMatrix.needsUpdate=true;if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.userData.terrainFixed=true;mesh.castShadow=true;mesh.receiveShadow=true;mesh.computeBoundingSphere();scene.add(mesh);batches.push(mesh);
 }
 for(const records of chunks.values()){
  const trunks=[],pines=[],crowns=[];
  for(const {x,z} of records){
   const y=heightAt(x,z);
   const seed=Math.abs(Math.sin(x*12.9898+z*78.233)),size=.85+seed*.5,deciduous=seed>.48;
   trunks.push({position:[x,y+2.0*size,z],scale:[.65*size,4*size,.65*size],yaw:seed*6});
   const colors=[0x405d36,0x4e693c,0x596e3d,0x36563a];
   if(deciduous){
    for(let i=0;i<5;i++){const a=i*2.4+seed*5,r=i===0?0:1.2*size;
     crowns.push({position:[x+Math.cos(a)*r,y+(4.5+(i%3)*.6)*size,z+Math.sin(a)*r],scale:[1.65*size,1.5*size,1.5*size],yaw:a,color:colors[i%4]});
    }
   }else{
    for(let i=0;i<4;i++)pines.push({position:[x,y+(3.6+i*.85)*size,z],scale:[(2.1-i*.35)*size,(3.2-i*.28)*size,(2.1-i*.35)*size],yaw:seed*6+i*.8,color:colors[i%4]});
   }
  }
  batch(trunkGeometry,wood,trunks);if(pines.length)batch(pineGeometry,leaf,pines);if(crowns.length)batch(crownGeometry,leaf,crowns);
 }
 return batches;
}
