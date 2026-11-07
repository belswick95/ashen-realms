// Cached world materials/maps outlive an entity; unique label textures do not.
// Skinned characters also own a GPU bone texture per Skeleton (three.js builds it on the first
// skinned draw). Removing the model from the scene does not free it, so every NPC, monster or
// player that streamed out used to leave one behind (~110 per lap of Birchford/castle/dungeon).
// Skeleton.dispose() only frees that texture; three.js rebuilds it if the skeleton is drawn again.
export function disposeSkeletons(root){const done=new Set();root.traverse(object=>{const s=object.isSkinnedMesh?object.skeleton:null;if(s&&!done.has(s)){done.add(s);s.dispose()}});}
export function disposeEntityResources(root){disposeSkeletons(root);const disposed=new Set();root.traverse(object=>{const resources=[object.geometry,...(Array.isArray(object.material)?object.material:[object.material])];for(const resource of resources){if(!resource||resource.userData?.eldervaleShared||disposed.has(resource))continue;if(resource.isMaterial)for(const value of Object.values(resource))if(value?.isTexture&&value.userData?.entityOwned&&!disposed.has(value)){value.dispose();disposed.add(value)}resource.dispose?.();disposed.add(resource)}});}
