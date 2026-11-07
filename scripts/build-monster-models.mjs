// Compacts the rigged monster models (assets/monsters/CREDITS.md lists every source and licence).
//
// usage: node scripts/build-monster-models.mjs <raw-dir> [name ...]
//   raw-dir holds one GLB per species exported from the source .blend/.fbx with Blender
//   (one armature, the kept meshes, clips renamed to idle/walk/attack/hit/death, textures
//   already scaled down to 256 px). This step resamples the clips, drops unused data and
//   quantizes the geometry (KHR_mesh_quantization, read natively by three's GLTFLoader),
//   writing assets/monsters/<name>.glb.
import fs from 'node:fs';import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune,dedup,quantize,resample,weld} from '@gltf-transform/functions';

const [rawDir,...only]=process.argv.slice(2);
if(!rawDir){console.error('usage: node scripts/build-monster-models.mjs <raw-dir> [name ...]');process.exit(1)}
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'),out=path.join(root,'assets/monsters');
fs.mkdirSync(out,{recursive:true});
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
const CLIPS=new Set(['idle','walk','attack','hit','death']);
for(const file of fs.readdirSync(rawDir).filter(f=>f.endsWith('.glb')).sort()){
 const name=path.basename(file,'.glb');if(only.length&&!only.includes(name))continue;
 const doc=await io.read(path.join(rawDir,file));
 for(const a of doc.getRoot().listAnimations())if(!CLIPS.has(a.getName()))a.dispose();
 // Tangents are never used (no normal maps); morph targets are not exported.
 for(const mesh of doc.getRoot().listMeshes())for(const prim of mesh.listPrimitives())for(const s of ['TANGENT','COLOR_0','TEXCOORD_1'])if(prim.getAttribute(s)&&s!=='COLOR_0')prim.setAttribute(s,null);
 await doc.transform(resample({tolerance:2e-4}));
 // Blender bakes every bone's translation/rotation/scale into every clip; a channel that never
 // leaves the bone's rest value only costs JSON and bytes, so it goes.
 let dropped=0;
 for(const a of doc.getRoot().listAnimations())for(const ch of a.listChannels()){const node=ch.getTargetNode(),path=ch.getTargetPath(),values=ch.getSampler()?.getOutput()?.getArray();if(!node||!values)continue;
  const rest=path==='translation'?node.getTranslation():path==='rotation'?node.getRotation():path==='scale'?node.getScale():null;if(!rest)continue;
  const tol=path==='translation'?1e-4*Math.max(1,Math.hypot(...rest)):1e-4;let same=true;
  for(let i=0;i<values.length&&same;i+=rest.length){let d=0;if(path==='rotation'){const dot=Math.abs(values[i]*rest[0]+values[i+1]*rest[1]+values[i+2]*rest[2]+values[i+3]*rest[3]);d=1-dot}else for(let k=0;k<rest.length;k++)d=Math.max(d,Math.abs(values[i+k]-rest[k]));if(d>tol)same=false}
  if(same){const s=ch.getSampler();ch.dispose();if(s&&!s.listParents().some(p=>p.propertyType==='AnimationChannel'))s.dispose();dropped++}}
 // Meshes of one body share one skeleton: identical skins (same joints and bind matrices) merge.
 const skins=[];for(const node of doc.getRoot().listNodes()){const skin=node.getSkin();if(!skin)continue;
  const same=skins.find(s=>s!==skin&&s.listJoints().length===skin.listJoints().length&&s.listJoints().every((j,i)=>j===skin.listJoints()[i])&&String(s.getInverseBindMatrices()?.getArray())===String(skin.getInverseBindMatrices()?.getArray()));
  if(same)node.setSkin(same);else skins.push(skin)}
 await doc.transform(weld(),dedup(),prune({keepAttributes:true}),quantize({pattern:/^(POSITION|NORMAL|TEXCOORD_0)$/,quantizePosition:14,quantizeNormal:10,quantizeTexcoord:12}));
 const target=path.join(out,name+'.glb');await io.write(target,doc);
 const clips=doc.getRoot().listAnimations().map(a=>a.getName()).join(',');
 console.log(name.padEnd(8),String(fs.statSync(target).size).padStart(7),'bytes','clips',clips,'(dropped',dropped,'rest channels)');
}
