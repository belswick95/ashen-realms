import {installLocalSkinning} from './local-skinning.js?v=release-20261107-horse126';
// A separate pose of the actual NPC, using the world's existing WebGL context.
// Never clone interaction userData: it points back to the live world root.
export function cloneSpeaker(source,T){
 const copies=new Map();function clone(node){const copy=node.clone(false);copies.set(node,copy);for(const child of node.children)if(!child.userData.kind)copy.add(clone(child));return copy;}
 const root=clone(source),skeletons=new Map();
 for(const [original,copy]of copies)if(original.isSkinnedMesh){let sk=skeletons.get(original.skeleton);if(!sk){sk=new original.skeleton.constructor(original.skeleton.bones.map(b=>copies.get(b)),original.skeleton.boneInverses.map(m=>m.clone()));sk.userData={...original.skeleton.userData};skeletons.set(original.skeleton,sk)}copy.skeleton=sk;if(original.morphTargetInfluences)copy.morphTargetInfluences=original.morphTargetInfluences.slice();}
 // Bone palettes are relative to the meshes' own parent (the scaled character model),
 // exactly as humanoid.js installs them, not to the cloned outer group.
 for(const sk of skeletons.values())if(sk.userData?.characterLocal){const meshes=[];root.traverse(o=>{if(o.isSkinnedMesh&&o.skeleton===sk)meshes.push(o)});if(meshes.length)installLocalSkinning(T,meshes[0].parent,sk,meshes,{preserveInverses:true});}
 return root;
}

export function createTalkingPose(T,source){
 const model=cloneSpeaker(source,T);model.position.set(0,0,0);model.rotation.set(0,-.12,0);
 model.traverse(node=>{if(node.isMesh){node.castShadow=false;node.receiveShadow=false}});
 const head=model.getObjectByName('Head')||model.getObjectByName('character-head'),lip=model.getObjectByName('lower-lip');
 const headRest=head?head.quaternion.clone():null,base=lip?.position.y||0,face=model.getObjectByName('character-face');
 let mouth=null;
 if(head&&lip){mouth=new T.Mesh(new T.SphereGeometry(1,10,6),new T.MeshBasicMaterial({color:0x492c27}));mouth.position.set(0,base+.009,lip.position.z+.004);mouth.scale.set(.047,.003,.007);head.add(mouth)}
 return {model,update(time,speaking,reducedMotion=false){
  const syllable=speaking&&!reducedMotion?Math.max(0,Math.sin(time*17)*.6+Math.sin(time*29)*.4):0;
  if(lip)lip.position.y=base-syllable*.035;if(face?.morphTargetInfluences?.length)face.morphTargetInfluences[0]=syllable;
  if(mouth){mouth.visible=syllable>.12;mouth.scale.y=.003+syllable*.018;mouth.position.y=base+.006-syllable*.012}
  // Gentle nod and sway, applied on top of the head bone's own rest pose.
  if(head){const e=new head.rotation.constructor(reducedMotion?0:Math.sin(time*2.4)*.018,reducedMotion?0:Math.sin(time*.9)*.045,reducedMotion?0:Math.sin(time*1.3)*.012);head.quaternion.copy(headRest).multiply(new head.quaternion.constructor().setFromEuler(e))}
 },dispose(){mouth?.geometry.dispose();mouth?.material.dispose();const seen=new Set();model.traverse(o=>{if(o.skeleton&&!seen.has(o.skeleton)){o.skeleton.dispose();seen.add(o.skeleton)}})}};
}

export function createDialoguePortrait(T,renderer,canvas){
 const size=160,target=new T.WebGLRenderTarget(size,size),pixels=new Uint8Array(size*size*4),ctx=canvas.getContext('2d');
 target.texture.colorSpace=T.SRGBColorSpace;canvas.width=canvas.height=size;
 const scene=new T.Scene();scene.background=new T.Color(0x263c32);
 scene.add(new T.HemisphereLight(0xfff1d2,0x3f615c,2.4));
 const key=new T.DirectionalLight(0xffe3b0,2.6);key.position.set(-2,4,4);scene.add(key);
 const camera=new T.OrthographicCamera(-.36,.36,.36,-.36,.1,10);camera.position.set(.12,2.66,3);camera.lookAt(0,2.66,0);
 const image=ctx.createImageData(size,size);let pose=null,time=0,until=0,lastFrame=-Infinity;
 function close(){if(pose){scene.remove(pose.model);pose.dispose();pose=null}ctx.clearRect(0,0,size,size);canvas.removeAttribute('data-speaker')}
 return {open(source,name){close();pose=createTalkingPose(T,source);scene.add(pose.model);pose.model.updateMatrixWorld(true);const head=pose.model.getObjectByName('Head'),focus=head?head.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.13,0)):new T.Vector3(0,2.66,0);camera.position.set(focus.x+.12,focus.y,focus.z+3);camera.lookAt(focus);canvas.setAttribute('aria-label',name+' talking');canvas.dataset.speaker=name;time=0;lastFrame=-Infinity},
  speak(text){until=time+Math.max(1.4,Math.min(12,text.length/21))},close,
  update(dt,reducedMotion=false){if(!pose)return;time+=dt;if(time-lastFrame<1/12)return;lastFrame=time;pose.update(time,time<until,reducedMotion);
   const previous=renderer.getRenderTarget(),xr=renderer.xr.enabled;renderer.xr.enabled=false;
   try{renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,size,size,pixels);for(let y=0;y<size;y++)image.data.set(pixels.subarray((size-1-y)*size*4,(size-y)*size*4),y*size*4);ctx.putImageData(image,0,0)}finally{renderer.setRenderTarget(previous);renderer.xr.enabled=xr}
  },dispose(){close();target.dispose();scene.clear()}};
}
