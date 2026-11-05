import {isRanged} from './weapons.js?v=release-20261105-characters55';
// Held items use +Y for the blade/handle and +Z for a shield face, with the
// grip at the model origin (scripts/build-weapons.mjs). The hand sockets
// (humanoid.js) sit in the closed fist in that frame, so items attach at the
// origin. Bows are held in the left hand, the bow arm.
export function attachWeapon(rig,model,key){
 model.position.set(0,0,0);model.rotation.set(0,0,0);model.userData.weaponMount=true;
 (isRanged(key)?rig.leftHand:rig.rightHand).add(model);return model;
}
export function attachShield(rig,model){
 // The fist sits behind the board; the face points out from the back of the hand.
 model.position.set(0,0,.04);model.rotation.set(0,0,0);model.userData.shieldMount=true;
 rig.leftHand.add(model);return model;
}
