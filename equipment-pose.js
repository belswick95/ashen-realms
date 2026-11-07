import {isBow,isMagic} from './weapons.js?v=release-20261107-demons132';
// Staffs stand upright like walking staffs: in the right-hand socket of the
// relaxed idle pose, world up is UP and the character's forward is FORWARD
// (measured from the rig; the same for both bodies).
const STAFF_UP=[-.851,.503,.151],STAFF_FORWARD=[.508,.861,-.011];
// Held items use +Y for the blade/handle and +Z for a shield face, with the
// grip at the model origin (scripts/build-weapons.mjs). The hand sockets
// (humanoid.js) sit in the closed fist in that frame, so items attach at the
// origin. Bows are held in the left hand, the bow arm; staffs in the right
// while the left hand casts.
export function attachWeapon(rig,model,key){
 model.position.set(0,0,0);model.rotation.set(0,0,0);model.userData.weaponMount=true;
 if(isMagic(key)){const V=model.position.constructor,y=new V(...STAFF_UP).normalize(),x=new V(...STAFF_FORWARD),z=new V();x.addScaledVector(y,-x.dot(y)).normalize();z.crossVectors(x,y);model.quaternion.setFromRotationMatrix(new model.matrix.constructor().makeBasis(x,y,z))}
 (isBow(key)?rig.leftHand:rig.rightHand).add(model);return model;
}
export function attachShield(rig,model){
 // The fist sits behind the board; the face points out from the back of the hand.
 model.position.set(0,0,.04);model.rotation.set(0,0,0);model.userData.shieldMount=true;
 rig.leftHand.add(model);return model;
}
