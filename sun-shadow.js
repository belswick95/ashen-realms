// Keep the shadow projection fixed to its texel grid as the player moves.
export function stabilizeSun(T,sun,focus){
 const direction=sun.userData.direction||new T.Vector3(40,65,30),right=new T.Vector3(direction.z,0,-direction.x);if(right.lengthSq()<.0001)right.set(1,0,0);right.normalize();const up=new T.Vector3().crossVectors(direction,right).normalize();
 const texel=(sun.shadow.camera.right-sun.shadow.camera.left)/sun.shadow.mapSize.x;
 const target=focus.clone();
 for(const axis of [right,up]){const value=target.dot(axis);target.addScaledVector(axis,Math.round(value/texel)*texel-value)}
 sun.target.position.copy(target);sun.position.copy(target).add(direction);
}
