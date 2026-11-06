import {isBow,isMagic,weaponCatalog} from './weapons.js?v=release-20261106-shieldorig122';
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
 model.position.set(0,0,0);model.rotation.set(0,0,0);model.userData.weaponMount=true;model.userData.weaponKey??=key;
 if(isMagic(key)){const V=model.position.constructor,y=new V(...STAFF_UP).normalize(),x=new V(...STAFF_FORWARD),z=new V();x.addScaledVector(y,-x.dot(y)).normalize();z.crossVectors(x,y);model.quaternion.setFromRotationMatrix(new model.matrix.constructor().makeBasis(x,y,z))}
 (isBow(key)?rig.leftHand:rig.rightHand).add(model);return model;
}
// Shields are strapped to the left forearm: the hand closes on the grip and
// the arm passes behind the middle of the board. In the left-hand socket +X
// runs back along the forearm toward the elbow, +Y is the knuckle line and +Z
// the back of the hand. The board keeps its top along the knuckle line (so it
// stands upright when the forearm is carried level, knuckles up) and its centre
// sits SHIELD_MOUNT.along up the forearm; the back of the board (the model's
// origin, its straps) rests SHIELD_MOUNT.out from the socket, on the outside
// of the forearm. The wrist is held straight while a shield is worn
// (animation.js), so the board follows the forearm in every pose.
export const SHIELD_MOUNT={along:.3,out:.115};
export function attachShield(rig,model){
 model.position.set(0,0,.04);model.rotation.set(0,0,0);model.userData.shieldMount=true;
 rig.leftHand.add(model);return model;
}
// How a held item is carried while moving (and, for shields, always):
//  blade:  one-handers (swords, scimitars, daggers, axes, maces, tools): usual
//          grip, the arm swings naturally and rises a little on the forward swing.
//  greatsword: two-handed swords: hilt in the right hand, blade resting on the
//          right shoulder; running takes both hands to the hilt, arms still.
//  battleaxe: as a one-hander: usual grip, natural swing, haft tilted up.
//  heavy:  war axes, spears, scythes, warhammers: low, trailing behind.
//  staff:  upright at the side like a walking staff.
//  bow:    low in the bow hand, limbs tilted forward.
//  shield: forearm level at the side, knuckles up, board upright and outward.
export function carryStyle(key){
 if(!key)return 'blade';if(isBow(key))return 'bow';if(isMagic(key))return 'staff';
 const item=weaponCatalog[key],model=String(item?.model||key);
 if(/twohand|claymore/i.test(model))return 'greatsword';if(/battleaxe/i.test(model))return 'battleaxe';
 return item?.twoHanded||/waraxe|spear|scythe|warhammer|halberd/i.test(model)?'heavy':'blade';
}
// Arm directions in the character's frame (x toward the arm's own side, y up,
// z forward): `fore` the forearm, `knuckle` the hand's knuckle line, which is the
// item's long axis for blades and bows (the forearm is made square to it; a
// staff sits turned in the socket, so its pair is chosen to stand the staff
// upright), `abd` the arm held out from the body, `raise` a forward lift of
// the whole arm, `swing` the share of the free arm's stride swing it keeps;
// `runRaise`/`runSwing` take over while running; `level` keeps the item's angle
// when the arm lifts (only the upper arm rises).
// Shoulder carry (greatsword): `rest` is where the blade lies on the shoulder
// (from the shoulder joint: inward, up, forward), `blade` its direction
// (outward, up, forward) and `grip` the hilt's distance below the rest point.
export const CARRY={
 // Natural carry (blade, battleaxe): `swing` share of the free arm's stride
 // swing, `raise` extra on the forward swing, elbow `flex` walking / `runFlex`
 // running; the item's tilt above level (swing + flex) stays within
 // `minTilt`..`maxTilt` radians.
 blade:{natural:true,abd:.15,swing:.9,raise:.35,flex:.25,runFlex:.7,minTilt:.2,maxTilt:.85},
 greatsword:{shoulder:true,rest:[-.1,.06,-.02],blade:[.3,.5,-.81],runBlade:[.3,.42,-.86],grip:.52},
 battleaxe:{natural:true,abd:.2,swing:.8,raise:.3,flex:.3,runFlex:.65,minTilt:.25,maxTilt:.8},
 heavy:{abd:.17,raise:0,swing:.3,fore:[.08,-.72,.7],knuckle:[.32,-.4,-.86]},
 staff:{abd:.26,raise:-.3,swing:.3,fore:[0,-.86,.5],knuckle:[0,.5,.86]},
 bow:{abd:.14,raise:0,swing:.35,fore:[.05,-.6,.8],knuckle:[0,.8,.6]},
 shield:{abd:.24,raise:.22,swing:.1,level:true,fore:[-.88,-.05,.47],knuckle:[0,1,0]},
 // Block (left arm, absolute): forearm across the chest, knuckles up.
 guard:{upper:[.35,-.5,.8],fore:[-1,.15,.3],knuckle:[0,1,0]}
};
