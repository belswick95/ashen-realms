import {installLocalSkinning} from './local-skinning.js?v=release-20261107-move157';
import {characterStore as store,CHARACTER_SCALE,ensurePart,outfitMaterial,skinMaterial,hairMaterial,eyeMaterial} from './character-assets.js?v=release-20261107-move157';
import {outfitItems,wornOutfit,OUTFIT_SLOTS} from './outfits.js?v=release-20261107-move157';
import {BEARDS,SKINS,HAIRS} from './appearance.js?v=release-20261107-move157';
// Characters used to skip frustum culling (frustumCulled=false), so every
// NPC and monster in the region was drawn twice a frame (camera + shadow map)
// even behind the camera. Skinned vertices stay in the model's local frame
// (bind matrix is identity), so a padded sphere around the model origin bounds every
// animation pose; three.js reuses this sphere instead of re-skinning on CPU.
export function characterCullSphere(T,mesh){const g=mesh.geometry;if(!g.boundingSphere)g.computeBoundingSphere();const s=g.boundingSphere;
 // Centred on the model origin so the bound also holds if the source armature
 // was rotated (e.g. Z-up exports): any rotation of the bind sphere fits inside.
 mesh.boundingSphere=new T.Sphere(new T.Vector3(),s.center.length()+s.radius*1.5);mesh.frustumCulled=true;return mesh.boundingSphere}
// Skinned Quaternius characters (CC0) for the player, remote players and NPCs.
// Every body region is an artist-made outfit part on one shared skeleton;
// clips from the Universal Animation Library drive the bones (animation.js).
//
// Callers must `await preloadCharacters(T)` (character-assets.js) first.

// Hairstyle choices → hair meshes in the base pack (the beard is separate).
export const HAIR_MESHES={'Short parted':'Hair_SimpleParted','Buzz cut':'Hair_Buzzed','Cropped':'Hair_BuzzedFemale','Long':'Hair_Long','Buns':'Hair_Buns','Bald':null};
const HAIR_SET={Hair_SimpleParted:1,Hair_Buzzed:1,Hair_BuzzedFemale:1,Hair_Beard:1,Hair_Long:2,Hair_Buns:2};
const color=(v,f)=>typeof v==='number'?v:/^#[0-9a-f]{6}$/i.test(v||'')?parseInt(v.slice(1),16):f;

export function buildHumanoid(T,root,look={}){
 if(!store.ready)throw Error('Character assets are not loaded; await preloadCharacters(T) first');
 const sex=look.sex==='female'?'female':'male';
 const skinTint=color(look.skin,color(SKINS[2],0xb97f58)),hairTint=color(look.hairColor,color(HAIRS[1],0x5b3c28));
 // Bones: a fresh copy of the body's armature, scaled to world units.
 const model=store.rigs[sex].clone(true);model.name='character-model';model.scale.multiplyScalar(CHARACTER_SCALE);root.add(model);
 const bones={};model.traverse(o=>{if(o.name&&o!==model)bones[o.name]=o});
 model.updateMatrixWorld(true);
 const meshes=[],slotMeshes={},hairMeshes=[],beardMeshes=[],faceMeshes=[];
 // Wrap a source skinned mesh: shared geometry, this character's bones and
 // the source's own inverse bind matrices (heads and hair come from another
 // body). Bone palettes stay character-local (local-skinning.js) so skinning
 // is equally precise anywhere in the world, including on iPad GPUs.
 function wear(source,materialFor,list){const added=[];source.traverse(o=>{if(!o.isSkinnedMesh)return;
   const m=new T.SkinnedMesh(o.geometry,materialFor(o.material.name));m.name=o.name;m.castShadow=true;m.receiveShadow=false;characterCullSphere(T,m);
   const skeleton=new T.Skeleton(o.skeleton.bones.map(b=>bones[b.name]),o.skeleton.boneInverses);model.add(m);m.bind(skeleton,new T.Matrix4());
   m.bindMode=T.DetachedBindMode;m.bindMatrix.identity();m.bindMatrixInverse.identity();installLocalSkinning(T,model,skeleton,[m],{preserveInverses:true});
   added.push(m);meshes.push(m);list?.push(m)});return added}
 const forMaterial=name=>/Superhero/.test(name)?skinMaterial('head',sex,skinTint):/Regular/.test(name)?skinMaterial('body',sex,skinTint):/Eyes/.test(name)?eyeMaterial():hairMaterial(/Hair_2/.test(name)?2:1,hairTint);

 // Head, eyes and eyebrows.
 wear(store.heads[sex],forMaterial,faceMeshes);
 // Hair and beard.
 const hairId=Object.hasOwn(HAIR_MESHES,look.hair)?HAIR_MESHES[look.hair]:(sex==='female'?'Hair_Long':'Hair_SimpleParted');
 if(hairId&&store.hair[hairId])wear(store.hair[hairId],()=>hairMaterial(HAIR_SET[hairId]||1,hairTint),hairMeshes);
 if(sex==='male'&&BEARDS.includes(look.beard)&&look.beard!=='Clean shaven'&&store.hair.Hair_Beard)wear(store.hair.Hair_Beard,()=>hairMaterial(1,hairTint),beardMeshes);

 // Outfit: one part per slot. Parts stream in on first use; until a new part
 // arrives the slot keeps its previous mesh, so nobody appears half-dressed.
 let worn={};
 function remove(slot){const s=slotMeshes[slot];if(!s)return;for(const m of s.meshes){m.removeFromParent();m.skeleton.dispose();const i=meshes.indexOf(m);if(i>=0)meshes.splice(i,1)}delete slotMeshes[slot]}
 function apply(slot,key,src){const item=outfitItems[key];remove(slot);slotMeshes[slot]={key,meshes:wear(src,name=>/Regular/.test(name)?skinMaterial('body',sex,skinTint):outfitMaterial(item.outfit,item.variant,item.tint??null,item.look??null))};for(const m of slotMeshes[slot].meshes)m.userData.outfitSlot=slot;refreshHair()}
 function setSlot(slot,key){
  if(slotMeshes[slot]?.key===key)return;const part=outfitItems[key]?.[sex];if(!part){remove(slot);return}
  if(store.parts[part])apply(slot,key,store.parts[part]);else ensurePart(part).then(src=>{if(worn[slot]===key&&slotMeshes[slot]?.key!==key){apply(slot,key,src);
   // Late parts: let views that cloned this body (the HUD portrait) rebuild.
   if(typeof dispatchEvent==='function'&&typeof CustomEvent==='function')dispatchEvent(new CustomEvent('eldervale-outfit-part',{detail:{slot,mesh:slotMeshes[slot]?.meshes[0]}}))}}).catch(()=>{});
 }
 let hairHidden=false;
 function refreshHair(){const helm=outfitItems[worn.helm];for(const m of hairMeshes)m.visible=!hairHidden&&!helm?.hidesHair;for(const m of beardMeshes)m.visible=!hairHidden&&!helm?.hidesBeard}
 function setOutfit(equipped={}){worn=wornOutfit(equipped,look);for(const slot of OUTFIT_SLOTS)worn[slot]?setSlot(slot,worn[slot]):remove(slot);refreshHair();return {...worn}}
 setOutfit({});

 // Sockets for held items. Items keep their established convention: blade or
 // handle along +Y, shield face along +Z. In the hand bone, fingers run along
 // +Y and the knuckle line (the handle through a closed fist) along +Z, thumb
 // side forward; the palm faces -X on the right hand and +X on the left. The
 // socket sits in the fist, blade out of the thumb side, face toward the back
 // of the hand, and undoes the body scale so items keep their world size.
 const socket=(side,name)=>{const s=new T.Object3D();s.name=name;const back=side==='r'?1:-1;
  s.matrix.makeBasis(new T.Vector3(0,back,0),new T.Vector3(0,0,1),new T.Vector3(back,0,0));s.matrix.decompose(s.position,s.quaternion,s.scale);
  s.position.set(-back*.022,.082,0);s.scale.setScalar(1/CHARACTER_SCALE);bones['hand_'+side].add(s);return s};
 const rightHand=socket('r','right-hand-socket'),leftHand=socket('l','left-hand-socket');
 // Anchor riding the upper back at the body origin (capes pin to it).
 const base=new T.Object3D();base.name='upper-back-anchor';root.add(base);root.updateMatrixWorld(true);bones.spine_03.attach(base);
 root.updateMatrixWorld(true);const footHeight=bones.foot_l.getWorldPosition(new T.Vector3()).y-root.getWorldPosition(new T.Vector3()).y;
 const rig={T,root,body:root,model,bones,sex,footHeight,head:bones.Head,base,neck:bones.neck_01,chestBone:bones.spine_03,torso:bones.spine_02,
  leftArm:bones.upperarm_l,rightArm:bones.upperarm_r,leftElbow:bones.lowerarm_l,rightElbow:bones.lowerarm_r,leftHand,rightHand,
  leftLeg:bones.thigh_l,rightLeg:bones.thigh_r,leftKnee:bones.calf_l,rightKnee:bones.calf_r,leftAnkle:bones.foot_l,rightAnkle:bones.foot_r,
  skinned:true,clipDriven:true,meshes:{},parts:slotMeshes,allMeshes:meshes,face:faceMeshes.find(m=>/SuperHero/i.test(m.name))||faceMeshes[0],faceMeshes,hairMeshes:[...hairMeshes,...beardMeshes],clothingMeshes:[],
  get worn(){return {...worn}},setOutfit,
  // Equipment flags ({itemKey:true}) → one outfit part per slot.
  setCoverage(equipped={}){return setOutfit(equipped)},
  setHairHidden(on){hairHidden=!!on;refreshHair()},
  setHandGrip(){},activity:null,activityPhase:null,
  // Optional phase (0..1 through the clip) lets a job keep its clip in step
  // with its own beat, e.g. chopping sounds on each axe impact.
  setActivity(name,phase=null){rig.activity=name||null;rig.activityPhase=rig.activity&&Number.isFinite(phase)?((phase%1)+1)%1:null},
  // Two-handed IK is replaced by clips; kept so older callers stay harmless.
  solveArm(){},
  upperOffset:.295,legScale:1.38,
  dispose(){for(const m of meshes)m.skeleton.dispose();base.removeFromParent();model.removeFromParent()}
 };
 return rig;
}
