// Prepares the Quaternius "Ultimate Animated Animals" glTF files for build-monster-models.mjs
// (assets/monsters/CREDITS.md lists sources and licences).
//
// usage: node scripts/prep-animal-models.mjs <pack-glTF-dir> <raw-dir>
//   Reads the pack's embedded .gltf files (data only, nothing is executed), keeps the clips the
//   game plays under Eldervale's names and writes <raw-dir>/<species>.glb, which
//   build-monster-models.mjs then compacts into assets/monsters/.
import fs from 'node:fs';import path from 'node:path';
import {NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';

// species file -> {source model, clip name in the game: clip name in the pack}
export const ANIMAL_SOURCES={
 deer:{src:'Stag.gltf',clips:{idle:'Idle',walk:'Walk',run:'Gallop',attack:'Attack_Kick',hit:'Idle_HitReact1',death:'Death'}},
 cow:{src:'Cow.gltf',clips:{idle:'Idle',walk:'Walk',run:'Gallop',attack:'Attack_Headbutt',hit:'Idle_HitReact1',death:'Death'}},
};
const [srcDir,rawDir]=process.argv.slice(2);
if(srcDir&&rawDir){
 fs.mkdirSync(rawDir,{recursive:true});const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);
 for(const [name,cfg] of Object.entries(ANIMAL_SOURCES)){
  const doc=await io.read(path.join(srcDir,cfg.src)),rename=Object.fromEntries(Object.entries(cfg.clips).map(([k,v])=>[v,k]));
  for(const a of doc.getRoot().listAnimations()){const to=rename[a.getName()];if(to)a.setName(to);else a.dispose()}
  const target=path.join(rawDir,name+'.glb');await io.write(target,doc);
  console.log(name,'<-',cfg.src,doc.getRoot().listAnimations().map(a=>a.getName()).join(','));
 }
}
