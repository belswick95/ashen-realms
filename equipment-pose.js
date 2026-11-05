// Held items use +Y for the blade/handle and +Z for a shield face. The hand
// sockets (humanoid.js) already sit in the closed fist in that frame, so most
// items attach at the origin; only long grips shift so the fist holds their middle.
export function attachWeapon(rig,model,key){
 model.position.set(0,key==='twohand'?-.18:key==='battleaxe'||key==='axe'||key==='pickaxe'?-.2:0,0);
 model.rotation.set(0,key==='scimitar'?Math.PI/2:0,0);
 rig.rightHand.add(model);return model;
}
export function attachShield(rig,model){
 // The handle sits in the fist; the board faces out from the back of the hand.
 model.position.set(0,0,.06);model.rotation.set(0,0,0);model.userData.shieldMount=true;
 rig.leftHand.add(model);return model;
}
