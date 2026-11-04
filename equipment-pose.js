import {GRIP} from './humanoid.js?v=release-20261104-lowpoly54';
// Equipment uses +Y for the blade and +Z for the shield face; the rig faces +Z.
// Every held item is centred in the closed fist (humanoid GRIP), so local and
// remote characters share one wrist attachment contract.
export function attachWeapon(rig,model,key){
 // Two-handed IK supplies the wrist orientation; the long grip runs through both fists.
 model.position.set(GRIP[0],key==='twohand'?GRIP[1]-.22:GRIP[1],GRIP[2]);
 model.rotation.set(key==='twohand'?0:1.30,0,key==='twohand'?0:-.10);
 if(key==='scimitar')model.rotateY(Math.PI/2);
 rig.rightHand.add(model);return model;
}
export function attachShield(rig,model){
 // The handle sits in the fist; the board rests along the bent forearm.
 model.position.set(GRIP[0],GRIP[1]+.16,GRIP[2]+.10);
 model.rotation.set(.70,1.02,-.10);model.userData.shieldMount=true;
 rig.leftHand.add(model);return model;
}
