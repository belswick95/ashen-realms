// Keep GPU bone palettes in character space. World translation belongs to the
// model matrix, rather than being added/subtracted inside every skinning sum.
export function installLocalSkinning(T,root,skeleton,meshes,{preserveInverses=false}={}){
 T||={Matrix4:root.matrix.constructor,Vector3:root.position.constructor,DetachedBindMode:'detached'};
 root.updateWorldMatrix(true,true);
 const inverseRoot=new T.Matrix4().copy(root.matrixWorld).invert(),offset=new T.Matrix4();
 if(!preserveInverses){
  skeleton.boneInverses=skeleton.bones.map(b=>new T.Matrix4().multiplyMatrices(inverseRoot,b.matrixWorld).invert());
  for(const mesh of meshes){root.attach(mesh);mesh.bindMode=T.DetachedBindMode;mesh.bindMatrix.multiplyMatrices(inverseRoot,mesh.matrixWorld);mesh.bindMatrixInverse.copy(mesh.bindMatrix).invert();}
 }
 skeleton.update=function(){inverseRoot.copy(root.matrixWorld).invert();for(let i=0;i<this.bones.length;i++){offset.multiplyMatrices(inverseRoot,this.bones[i].matrixWorld).multiply(this.boneInverses[i]);offset.toArray(this.boneMatrices,i*16);}if(this.boneTexture)this.boneTexture.needsUpdate=true;};
 const base=new T.Vector3(),v=new T.Vector3(),cpuInverse=new T.Matrix4(),cpuOffset=new T.Matrix4();
 for(const mesh of meshes)mesh.applyBoneTransform=function(index,vector){
  const indices=this.geometry.attributes.skinIndex,weights=this.geometry.attributes.skinWeight;base.copy(vector).applyMatrix4(this.bindMatrix);vector.set(0,0,0);cpuInverse.copy(root.matrixWorld).invert();
  for(let j=0;j<4;j++){const w=j===0?weights.getX(index):j===1?weights.getY(index):j===2?weights.getZ(index):weights.getW(index);if(!w)continue;const k=j===0?indices.getX(index):j===1?indices.getY(index):j===2?indices.getZ(index):indices.getW(index);cpuOffset.multiplyMatrices(cpuInverse,skeleton.bones[k].matrixWorld).multiply(skeleton.boneInverses[k]);vector.addScaledVector(v.copy(base).applyMatrix4(cpuOffset),w);}return vector.applyMatrix4(this.bindMatrixInverse);
 };
 skeleton.userData={...(skeleton.userData||{}),characterLocal:true};
 return skeleton;
}
