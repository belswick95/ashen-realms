// Batch only siblings with identical material/shadow state. Moving gate hinges
// remain separate parents, so doors retain their authoritative animation.
// keep(mesh) leaves a mesh untouched (click targets, roofs, walk surfaces...);
// deep:false only merges the root's direct children.
export function batchStaticMeshes(T,root,{keep=()=>false,deep=true}={}){
 let before=0,after=0;
 function batch(parent){if(deep)for(const child of [...parent.children])if(child.isGroup)batch(child);
  const groups=new Map();for(const mesh of parent.children){if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.isInstancedMesh||Array.isArray(mesh.material)||!mesh.visible||!mesh.geometry.attributes.normal||!mesh.geometry.attributes.uv||keep(mesh))continue;before++;const key=mesh.material.uuid+':'+mesh.castShadow+':'+mesh.receiveShadow;let list=groups.get(key);if(!list)groups.set(key,list=[]);list.push(mesh)}
  for(const list of groups.values()){after++;if(list.length<2)continue;const positions=[],normals=[],uvs=[];for(const mesh of list){mesh.updateMatrix();const geometry=mesh.geometry.index?mesh.geometry.toNonIndexed():mesh.geometry.clone();geometry.applyMatrix4(mesh.matrix);positions.push(...geometry.attributes.position.array);normals.push(...geometry.attributes.normal.array);uvs.push(...geometry.attributes.uv.array);geometry.dispose();}
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('normal',new T.Float32BufferAttribute(normals,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));geometry.computeBoundingBox();geometry.computeBoundingSphere();const mesh=new T.Mesh(geometry,list[0].material);mesh.castShadow=list[0].castShadow;mesh.receiveShadow=list[0].receiveShadow;mesh.userData.staticBatch=true;parent.add(mesh);for(const old of list){old.removeFromParent();if(!old.geometry.userData.eldervaleShared)old.geometry.dispose();}
  }
 }
 batch(root);root.userData.staticBatchStats={before,after};return root;
}
