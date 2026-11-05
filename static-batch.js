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

// Cross-entity batching. A town is hundreds of separate static entities (wall
// pieces, towers, lamps, stalls, benches, paving) that each cost a few draw
// calls, twice with shadows. Registered roots are grouped into square world
// cells; each cell merges every eligible mesh of its roots per material and
// shadow state into one mesh, and the originals move to BATCHED_LAYER, which
// neither the camera nor the shadow pass draws. The originals stay in place
// for raycasts (enable BATCHED_LAYER on the raycaster), collision and editing:
// adding, touching or removing a root marks its cell dirty, and dirty cells are
// rebuilt once they have been quiet for `settle` ms (region streaming adds
// entities in bursts).
export const BATCHED_LAYER=30;
export function cellKey(x,z,size){return Math.floor(x/size)+','+Math.floor(z/size)}
// A mesh can join a cell batch when it is a plain, opaque-or-transparent static
// mesh with one material and full position/normal/uv data. Invisible click
// targets, skinned/instanced meshes, vertex-coloured, morphing, mirrored and
// custom-rendered meshes stay as they are.
export function cellBatchable(mesh){
 if(!mesh.isMesh||mesh.isSkinnedMesh||mesh.isInstancedMesh||Array.isArray(mesh.material)||!mesh.material||mesh.material.visible===false||mesh.material.vertexColors)return false;
 const a=mesh.geometry?.attributes;if(!a?.position||!a.normal||!a.uv||a.position.itemSize!==3||a.normal.itemSize!==3||a.uv.itemSize!==2||a.position.isInterleavedBufferAttribute||mesh.geometry.morphAttributes?.position)return false;
 if(mesh.onBeforeRender!==mesh.constructor.prototype.onBeforeRender||mesh.userData.noCellBatch)return false;
 return mesh.matrixWorld.determinant()>0;
}
export function createCellBatcher(T,parent,{size=40,settle=400,maxPerFlush=2,skip=()=>false}={}){
 const cells=new Map(),cellOf=new Map();let stats={cells:0,sources:0,batches:0};
 function cell(key){let c=cells.get(key);if(!c)cells.set(key,c={key,roots:new Set(),group:null,dirty:false,touched:0});return c}
 function release(root){root.traverse(o=>{if(o.userData.cellBatched){delete o.userData.cellBatched;o.layers.set(0)}})}
 function add(root,now=0){const key=cellKey(root.position.x,root.position.z,size),old=cellOf.get(root);
  if(old&&old.key!==key){old.roots.delete(root);old.dirty=true;old.touched=now}
  const c=cell(key);c.roots.add(root);cellOf.set(root,c);c.dirty=true;c.touched=now;root.userData.cellBatchedRoot=true}
 function remove(root,now=0){const c=cellOf.get(root);if(!c)return;c.roots.delete(root);cellOf.delete(root);delete root.userData.cellBatchedRoot;release(root);c.dirty=true;c.touched=now}
 function clear(c){if(!c.group)return;c.group.removeFromParent();for(const m of c.group.children)m.geometry.dispose();c.group=null}
 function rebuild(c){
  clear(c);c.dirty=false;const groups=new Map();
  for(const root of c.roots){release(root);if(!root.parent)continue;root.updateMatrixWorld(true);
   (function walk(o){if(o!==root&&(!o.visible||skip(o,root)))return;if(cellBatchable(o)){const key=o.material.uuid+':'+o.castShadow+':'+o.receiveShadow;let list=groups.get(key);if(!list)groups.set(key,list=[]);list.push(o)}for(const child of o.children)walk(child)})(root)}
  const group=new T.Group();group.name='cell-batch:'+c.key;group.userData.cellBatch=true;
  for(const list of groups.values()){if(list.length<2)continue;
   const parts=list.map(m=>{const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrixWorld);return g});
   let count=0;for(const g of parts)count+=g.attributes.position.count;
   const position=new Float32Array(count*3),normal=new Float32Array(count*3),uv=new Float32Array(count*2);let at=0;
   for(const g of parts){position.set(g.attributes.position.array.subarray(0,g.attributes.position.count*3),at*3);normal.set(g.attributes.normal.array.subarray(0,g.attributes.normal.count*3),at*3);uv.set(g.attributes.uv.array.subarray(0,g.attributes.uv.count*2),at*2);at+=g.attributes.position.count;g.dispose()}
   const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(position,3));geometry.setAttribute('normal',new T.BufferAttribute(normal,3));geometry.setAttribute('uv',new T.BufferAttribute(uv,2));geometry.computeBoundingBox();geometry.computeBoundingSphere();
   const mesh=new T.Mesh(geometry,list[0].material);mesh.castShadow=list[0].castShadow;mesh.receiveShadow=list[0].receiveShadow;mesh.userData.staticBatch=true;mesh.matrixAutoUpdate=false;group.add(mesh);
   for(const m of list){m.userData.cellBatched=true;m.layers.set(BATCHED_LAYER)}}
  if(group.children.length){group.matrixAutoUpdate=false;parent.add(group);c.group=group}
 }
 function refresh(){let sources=0,batches=0,count=0;for(const c of cells.values()){if(!c.group)continue;count++;batches+=c.group.children.length;for(const root of c.roots)root.traverse(o=>{if(o.userData.cellBatched)sources++})}stats={cells:count,sources,batches}}
 return {
  get stats(){return stats},add,remove,
  touch(root,now=0){const c=cellOf.get(root);if(c){c.dirty=true;c.touched=now}},
  has:root=>cellOf.has(root),
  // Rebuild up to maxPerFlush quiet dirty cells; returns how many were rebuilt.
  flush(now=Infinity,force=false){let n=0;for(const c of cells.values()){if(!c.dirty||!force&&now-c.touched<settle)continue;if(!force&&n>=maxPerFlush)break;rebuild(c);n++;if(!c.roots.size){clear(c);cells.delete(c.key)}}if(n)refresh();return n}
 };
}
