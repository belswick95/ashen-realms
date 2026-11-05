// Builds web-ready character assets from the Quaternius CC0 packs:
//   Universal Base Characters (heads, hair), Modular Character Outfits - Fantasy
//   (outfit parts) and Universal Animation Library (clips).
//
// usage: node scripts/build-characters.mjs <base-dir> <outfits-dir> <animations.glb>
//   base-dir     ".../Universal Base Characters[Standard]"
//   outfits-dir  ".../Modular Character Outfits - Fantasy[Source]"
//
// Output: assets/characters/*.glb (geometry + skin only, no embedded images)
// and assets/characters/textures/*.webp. Materials keep their source names so
// character-assets.js can assign shared, tintable textures at runtime.
import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {prune,dedup,quantize,resample,compactPrimitive} from '@gltf-transform/functions';

const [baseDir,outfitDir,animFile]=process.argv.slice(2);
if(!baseDir||!outfitDir||!animFile){console.error('usage: node scripts/build-characters.mjs <base-dir> <outfits-dir> <animations.glb>');process.exit(1)}
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'),out=path.join(root,'assets/characters'),texOut=path.join(out,'textures');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(texOut,{recursive:true});
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);

// Geometry only: drop every image/texture, keep material names for runtime mapping.
async function strip(doc){for(const t of doc.getRoot().listTextures())t.dispose();await doc.transform(prune({keepAttributes:true}),dedup(),quantize({pattern:/^(POSITION|NORMAL)$/,quantizeNormal:10,quantizePosition:14}));return doc}
async function write(doc,name){await strip(doc);await io.write(path.join(out,name),doc);return fs.statSync(path.join(out,name)).size}

// Keep only triangles mostly weighted to the named bones (used to take the
// head from a full base body and wear it on an outfit body).
function keepTriangles(doc,meshFilter,bones){
 for(const node of doc.getRoot().listNodes()){const mesh=node.getMesh(),skin=node.getSkin();if(!mesh||!skin||!meshFilter(mesh))continue;const joints=skin.listJoints().map(j=>j.getName());
  for(const prim of mesh.listPrimitives()){const J=prim.getAttribute('JOINTS_0'),W=prim.getAttribute('WEIGHTS_0'),I=prim.getIndices();const keep=v=>{let w=0;const j=J.getElement(v,[]),ww=W.getElement(v,[]);for(let k=0;k<4;k++)if(bones.has(joints[j[k]]))w+=ww[k];return w>.5};const src=I.getArray(),kept=[];for(let t=0;t<src.length;t+=3)if(keep(src[t])&&keep(src[t+1])&&keep(src[t+2]))kept.push(src[t],src[t+1],src[t+2]);I.setArray(new (src.constructor)(kept));compactPrimitive(prim)}}
 return doc}

const manifest={license:'CC0 1.0 — Quaternius (quaternius.com). Universal Base Characters, Modular Character Outfits - Fantasy, Universal Animation Library.',bodies:{},hair:{},parts:{},textures:{},clips:[]};
const sizes=[];

// 1) Rigs: the outfit pack's regular-proportion armature per sex (Peasant outfit is complete).
for(const sex of ['Male','Female']){
 const doc=await io.read(path.join(outfitDir,`Exports/glTF (Godot-Unreal)/Outfits/${sex}_Peasant.gltf`));
 for(const node of doc.getRoot().listNodes())if(node.getMesh()){node.setMesh(null);node.setSkin(null)}
 sizes.push([`rig_${sex.toLowerCase()}.glb`,await write(doc,`rig_${sex.toLowerCase()}.glb`)]);
 // 2) Head, eyes and eyebrows cut from the base body.
 const head=await io.read(path.join(baseDir,`Base Characters/Godot - UE/Superhero_${sex}_FullBody.gltf`));
 keepTriangles(head,m=>m.listPrimitives().some(p=>/Superhero/.test(p.getMaterial()?.getName()||'')),new Set(['Head','neck_01']));
 sizes.push([`head_${sex.toLowerCase()}.glb`,await write(head,`head_${sex.toLowerCase()}.glb`)]);
 manifest.bodies[sex.toLowerCase()]={rig:`rig_${sex.toLowerCase()}.glb`,head:`head_${sex.toLowerCase()}.glb`};
}
// 3) Hairstyles and beard, already rigged to the head bone.
const hairDir=path.join(baseDir,'Hairstyles/Rigged to Head Bone/glTF (Godot -Unreal)');
for(const f of fs.readdirSync(hairDir).filter(f=>f.endsWith('.gltf'))){const id=f.replace('.gltf','');const doc=await io.read(path.join(hairDir,f));sizes.push([id+'.glb',await write(doc,id+'.glb')]);manifest.hair[id]=id+'.glb'}
// 4) Every modular outfit part.
const partDir=path.join(outfitDir,'Exports/glTF (Godot-Unreal)/Modular Parts');
for(const f of fs.readdirSync(partDir).filter(f=>f.endsWith('.gltf'))){const id=f.replace('.gltf','');const doc=await io.read(path.join(partDir,f));sizes.push([id+'.glb',await write(doc,id+'.glb')]);manifest.parts[id]=id+'.glb'}
// 5) Animation clips: rotations for every bone, translation only for the pelvis
//    (re-scaled per body at runtime), no scale tracks. The mannequin mesh is dropped.
const CLIPS=['Idle_Loop','Walk_Loop','Jog_Fwd_Loop','Sprint_Loop','Jump_Start','Jump_Loop','Jump_Land','Sword_Idle','Sword_Attack','Punch_Jab','Punch_Cross','Hit_Chest','Hit_Head','Death01','Interact','Fixing_Kneeling','PickUp_Table','Idle_Talking_Loop','Sitting_Idle_Loop','Spell_Simple_Shoot','Roll','Crouch_Idle_Loop','Swim_Idle_Loop','Swim_Fwd_Loop','Push_Loop','Idle_Torch_Loop','Driving_Loop'];
{const doc=await io.read(animFile),r=doc.getRoot();
 for(const a of r.listAnimations()){if(!CLIPS.includes(a.getName())){a.dispose();continue}for(const c of a.listChannels()){const p=c.getTargetPath(),n=c.getTargetNode()?.getName();if(p==='scale'||(p==='translation'&&n!=='pelvis')){c.getSampler()?.dispose();c.dispose()}}}
 for(const node of r.listNodes())if(node.getMesh()){node.setMesh(null);node.setSkin(null)}
 for(const m of r.listMeshes())m.dispose();
 await doc.transform(resample({tolerance:1e-3}),prune({keepLeaves:true}),dedup());await io.write(path.join(out,'animations.glb'),doc);sizes.push(['animations.glb',fs.statSync(path.join(out,'animations.glb')).size]);
 manifest.clips=r.listAnimations().map(a=>a.getName());}

// 6) Textures → WebP. Colour maps 1024px, normals 1024px, ORM/roughness 512px.
const jobs=[];const tex=(src,name,size,q=82)=>{jobs.push([src,path.join(texOut,name+'.webp'),size,q]);manifest.textures[name]='textures/'+name+'.webp'};
const bc=path.join(baseDir,'Base Characters/Textures');
for(const sex of ['Male','Female']){tex(path.join(bc,`T_Superhero_${sex}_Normal.png`),`head_${sex.toLowerCase()}_normal`,1024);tex(path.join(bc,`T_Superhero_${sex}_Roughness.png`),`head_${sex.toLowerCase()}_roughness`,512)}
tex(path.join(bc,'T_Superhero_Male_Dark.png'),'head_male_color',1024);tex(path.join(bc,'T_Superhero_Female_Dark_BaseColor.png'),'head_female_color',1024);
for(const i of [1,2]){tex(path.join(bc,`T_Hair_${i}_BaseColor.png`),`hair_${i}_color`,1024);tex(path.join(bc,`T_Hair_${i}_Normal.png`),`hair_${i}_normal`,512)}
tex(path.join(bc,'T_Eye_Brown.png'),'eye_color',256);
const ot=path.join(outfitDir,'Textures');
for(const sex of ['Male','Female']){tex(path.join(ot,`Base/T_Regular_${sex}_Dark_BaseColor.png`),`body_${sex.toLowerCase()}_color`,1024);tex(path.join(ot,`Base/T_Regular_${sex}_Normal.png`),`body_${sex.toLowerCase()}_normal`,1024);tex(path.join(ot,`Base/T_Regular_${sex}_Roughness.png`),`body_${sex.toLowerCase()}_roughness`,512)}
for(const o of ['Knight','Noble','Peasant','Ranger','Wizard']){for(const v of ['','_2','_3'])tex(path.join(ot,`${o}/T_${o}${v}_BaseColor.png`),`${o.toLowerCase()}${v||'_1'}_color`,1024);tex(path.join(ot,`${o}/T_${o}_Normal.png`),`${o.toLowerCase()}_normal`,1024);tex(path.join(ot,`${o}/T_${o}_ORM.png`),`${o.toLowerCase()}_orm`,512)}
// Skin colour maps become neutral grey shading so any skin tone can be applied as a tint.
const py=`import sys,json\nfrom PIL import Image,ImageStat\nfor src,dst,size,q in json.load(sys.stdin):\n im=Image.open(src);neutral=('head_' in dst or 'body_' in dst) and dst.endswith('_color.webp')\n if neutral:\n  g=im.convert('L');m=ImageStat.Stat(g).mean[0] or 1;g=g.point(lambda v:min(255,int(v*205/m)));im=Image.merge('RGB',(g,g,g))\n else:im=im.convert('RGBA' if im.mode in ('RGBA','LA','P') and 'normal' not in dst else 'RGB')\n im=im.resize((size,size),Image.LANCZOS);im.save(dst,'WEBP',quality=q,method=6)\n`;
execFileSync('python3',['-I','-c',py],{input:JSON.stringify(jobs),stdio:['pipe','inherit','inherit']});
for(const [,dst] of jobs)sizes.push([path.relative(out,dst),fs.statSync(dst).size]);

fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,1));
fs.writeFileSync(path.join(out,'LICENSE.md'),'# Character assets\n\nAll models, textures and animations in this folder are by Quaternius (https://quaternius.com), released under CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/).\n\n- Universal Base Characters (heads, hair)\n- Modular Character Outfits - Fantasy (outfits)\n- Universal Animation Library (animations)\n\nGenerated by scripts/build-characters.mjs.\n');
const total=sizes.reduce((s,[,b])=>s+b,0);console.log(sizes.length+' files, '+(total/1048576).toFixed(1)+' MB');for(const [n,b] of sizes.sort((a,b)=>b[1]-a[1]).slice(0,12))console.log(' ',n,(b/1024).toFixed(0)+' KB');
