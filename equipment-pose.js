// Equipment uses +Y for the blade and +Z for the shield face; the rig faces +Z.
// Keep local and remote characters on the same wrist attachment contract.
export function attachWeapon(rig,model,key){
 model.position.set(0,key==='twohand'?-.30:-.015,.025);
 // Two-handed IK supplies the wrist orientation itself.
 model.rotation.set(key==='twohand'?0:1.30,0,key==='twohand'?0:-.10);
 if(key==='scimitar')model.rotateY(Math.PI/2);
 rig.rightHand.add(model);return model;
}
export function attachShield(rig,model){
 // The handle meets the palm, the upper panel rests along the bent forearm.
 model.position.set(.065,.10,.025);
 model.rotation.set(.70,1.02,-.10);
 rig.leftHand.add(model);return model;
}
