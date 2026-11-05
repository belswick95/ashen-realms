// Builds assets/weapons/weapons.glb from two Quaternius CC0 packs:
//   Medieval Weapons Pack (Sept 2018) - OBJ/MTL, flat colours
//   Fantasy Props MegaKit (Standard)  - glTF with trim-sheet textures
//
// usage: node scripts/build-weapons.mjs <medieval-weapons-dir> <megakit-dir>
//   medieval-weapons-dir  ".../Medieval Weapons Pack - Sept 2018"
//   megakit-dir           ".../Fantasy Props MegaKit[Standard]" (has Exports/ and Textures/)
//
// Every item becomes one top-level node named after its item key, in the
// game's held-item frame: the fist/grip at the origin, blade or handle along
// +Y, single-headed weapons' heads and blade edges toward +X, shield faces
// toward +Z. Sizes are world units.
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {execFileSync} from 'node:child_process';
import * as T from 'three';import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {Document,NodeIO} from '@gltf-transform/core';import {ALL_EXTENSIONS} from '@gltf-transform/extensions';
import {dedup,prune,quantize} from '@gltf-transform/functions';

const [medievalDir,megakitDir]=process.argv.slice(2);
if(!medievalDir||!megakitDir){console.error('usage: node scripts/build-weapons.mjs <medieval-weapons-dir> <megakit-dir>');process.exit(1)}
const root=path.resolve(path.dirname(new URL(import.meta.url).pathname),'..'),out=path.join(root,'assets/weapons');
fs.rmSync(out,{recursive:true,force:true});fs.mkdirSync(path.join(out,'textures'),{recursive:true});

// key: [source model, kind, target length (Y extent) in world units, grip]
// grip: 'handle' = middle of the wooden handle; a number f = f of the way up
// the wooden shaft (one-handed tools hold low); 'center' = middle of the item.
const MEDIEVAL={
 dagger:['Dagger','blade',.72,'handle'],
 shortsword:['Dagger_2','blade',.92,'handle'],
 longsword:['Sword','blade',1.28,'handle'],
 scimitar:['Sword_2','blade',1.24,'handle'],
 twohand:['Sword_Big','blade',1.9,'handle'],
 claymore:['Claymore','blade',1.95,'handle'],
 goldenSword:['Sword_Golden','blade',1.55,'handle'],
 spear:['Spear','shaft',2.5,.36],
 axe:['Axe_Small','shaft',.92,.2],
 waraxe:['Axe','shaft',1.3,.2],
 battleaxe:['Axe_Double','shaft',1.45,.2],
 hammer:['Hammer_Small','shaft',1.05,.2],
 warhammer:['Hammer_Double','shaft',1.4,.24],
 scythe:['Scythe','shaft',1.75,.3],
 woodenBow:['Bow_Wooden','bow',1.55,'center'],
 longbow:['Bow_Wooden2','bow',1.6,'center'],
 goldenBow:['Bow_Golden','bow',1.6,'center'],
 bloodthornBow:['Bow_Evil','bow',1.65,'center'],
 arrow:['Arrow','arrow',.95,'center'],
 kite:['Shield_Heater','shield',1.3,'center'],
 square:['Shield_Heater_2','shield',1.15,'center'],
 roundShield:['Shield_Round','shield',1.0,'center'],
 quarteredShield:['Shield_Round_2','shield',1.0,'center'],
 celticShield:['Shield_Celtic_Golden','shield',1.45,'center']
};
// MegaKit: [file, kind, target length, grip as fraction of the Y extent from the bottom]
const MEGAKIT={
 bronzeSword:['Sword_Bronze','blade',1.15,.09],
 bronzeAxe:['Axe_Bronze','shaft',.95,.2],
 pickaxe:['Pickaxe_Bronze','shaft',.95,.2],
 woodenShield:['Shield_Wooden','shield',.95,'center']
};
const METAL=/Steel|Gold|Silver|Iron/i,WOOD=/Wood|Brown/i;

const doc=new Document();const buffer=doc.createBuffer();const scene=doc.createScene('weapons');
const materials=new Map();
function flatMaterial(name,[r,g,b]){if(materials.has(name))return materials.get(name);const metal=METAL.test(name);const m=doc.createMaterial(name).setBaseColorFactor([r,g,b,1]).setMetallicFactor(metal?.55:0).setRoughnessFactor(metal?.38:.85);materials.set(name,m);return m}
function accessor(type,array){return doc.createAccessor().setType(type).setArray(array).setBuffer(buffer)}

// Normalising matrix for a set of world-space vertices tagged as wood or not.
// Returns M so that the grip is at the origin, metal toward +Y, heads to +X.
function normalise(points,kind,length,grip){
 const box=new T.Box3();for(const p of points)box.expandByPoint(p.v);const size=box.getSize(new T.Vector3());
 const M=new T.Matrix4();
 const mean=(list,axis)=>list.reduce((s,p)=>s+p.v[axis],0)/Math.max(1,list.length);
 const wood=points.filter(p=>p.wood),metal=points.filter(p=>!p.wood);
 // Long axis to Y (the arrow is modelled along Z), then flip so metal is up.
 if(kind!=='shield'&&size.z>size.y&&size.z>size.x)M.makeRotationX(-Math.PI/2);
 else if(kind!=='shield'&&size.y<size.x)throw Error('long axis is X');
 const up=points.map(p=>({...p,v:p.v.clone().applyMatrix4(M)})),woodU=up.filter(p=>p.wood),metalU=up.filter(p=>!p.wood);
 if(kind!=='shield'&&kind!=='bow'&&woodU.length&&metalU.length&&mean(metalU,'y')<mean(woodU,'y'))M.premultiply(new T.Matrix4().makeRotationZ(Math.PI));
 // Single-headed weapons: head toward +X.
 const flipped=points.map(p=>p.v.clone().applyMatrix4(M)),metalF=flipped.filter((_,i)=>!points[i].wood);
 if(kind==='shaft'&&metalF.length&&metalF.reduce((s,v)=>s+v.x,0)/metalF.length< -1e-3)M.premultiply(new T.Matrix4().makeRotationY(Math.PI));
 const vs=points.map(p=>p.v.clone().applyMatrix4(M)),b=new T.Box3().setFromPoints(vs),s=length/(b.max.y-b.min.y);
 // Grip point.
 const woodV=vs.filter((_,i)=>points[i].wood),wb=woodV.length?new T.Box3().setFromPoints(woodV):b;
 let gy;if(grip==='center')gy=(b.min.y+b.max.y)/2;else if(grip==='handle')gy=(wb.min.y+wb.max.y)/2;else gy=wb.min.y+grip*(wb.max.y-wb.min.y);
 const band=woodV.filter(v=>Math.abs(v.y-gy)<.08*(b.max.y-b.min.y));const c=band.length?band.reduce((a,v)=>a.add(v),new T.Vector3()).divideScalar(band.length):b.getCenter(new T.Vector3());
 const origin=kind==='shield'?new T.Vector3((b.min.x+b.max.x)/2,(b.min.y+b.max.y)/2,b.min.z):new T.Vector3(c.x,gy,c.z);
 return new T.Matrix4().makeScale(s,s,s).multiply(new T.Matrix4().makeTranslation(-origin.x,-origin.y,-origin.z)).multiply(M);
}

// 1) Medieval Weapons Pack: OBJ + MTL (Kd colours, linear).
const objDir=path.join(medievalDir,'OBJ');
for(const [key,[file,kind,length,grip]] of Object.entries(MEDIEVAL)){
 const kd={};let current=null;for(const line of fs.readFileSync(path.join(objDir,file+'.mtl'),'utf8').split('\n')){const p=line.trim().split(/\s+/);if(p[0]==='newmtl')current=p[1];else if(p[0]==='Kd'&&current)kd[current]=p.slice(1,4).map(Number)}
 const group=new OBJLoader().parse(fs.readFileSync(path.join(objDir,file+'.obj'),'utf8'));group.updateMatrixWorld(true);
 const parts=[];group.traverse(o=>{if(!o.isMesh)return;const g=o.geometry.clone().applyMatrix4(o.matrixWorld),mats=[o.material].flat(),groups=g.groups.length?g.groups:[{start:0,count:g.attributes.position.count,materialIndex:0}];for(const gr of groups)parts.push({g,start:gr.start,count:gr.count,name:mats[gr.materialIndex||0].name})});
 const points=[];for(const p of parts)for(let i=p.start;i<p.start+p.count;i++)points.push({v:new T.Vector3().fromBufferAttribute(p.g.attributes.position,i),wood:WOOD.test(p.name)});
 const M=normalise(points,kind,length,grip),normalM=new T.Matrix3().getNormalMatrix(M);
 const node=doc.createNode(key);scene.addChild(node);const mesh=doc.createMesh(key);node.setMesh(mesh);
 for(const p of parts){const pos=new Float32Array(p.count*3),nor=new Float32Array(p.count*3),v=new T.Vector3();
  for(let i=0;i<p.count;i++){v.fromBufferAttribute(p.g.attributes.position,p.start+i).applyMatrix4(M).toArray(pos,i*3);v.fromBufferAttribute(p.g.attributes.normal,p.start+i).applyMatrix3(normalM).normalize().toArray(nor,i*3)}
  if(M.determinant()<0)for(let i=0;i<p.count;i+=3)for(let k=0;k<3;k++){const a=pos[(i+1)*3+k];pos[(i+1)*3+k]=pos[(i+2)*3+k];pos[(i+2)*3+k]=a;const n=nor[(i+1)*3+k];nor[(i+1)*3+k]=nor[(i+2)*3+k];nor[(i+2)*3+k]=n}
  mesh.addPrimitive(doc.createPrimitive().setAttribute('POSITION',accessor('VEC3',pos)).setAttribute('NORMAL',accessor('VEC3',nor)).setMaterial(flatMaterial(p.name,kd[p.name]||[.5,.5,.5])))}
 node.setExtras({kind,source:'Medieval Weapons Pack/'+file});
}

// 2) Fantasy Props MegaKit: glTF with trim-sheet textures and vertex colours.
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS);const gltfDir=path.join(megakitDir,'Exports/glTF');
const tmp=fs.mkdtempSync(path.join(os.tmpdir(),'megakit-'));for(const f of fs.readdirSync(gltfDir))fs.copyFileSync(path.join(gltfDir,f),path.join(tmp,f));for(const f of fs.readdirSync(path.join(megakitDir,'Textures')).filter(f=>f.endsWith('.png')))fs.copyFileSync(path.join(megakitDir,'Textures',f),path.join(tmp,f));
// Textures are written next to the GLB (not embedded) so Node can parse the
// geometry; weapon-assets.js applies them in the browser by material extras.
const written=new Set(),textureJobs=[];
function texture(src,{size}){const name=src.getName();if(!written.has(name)){written.add(name);const png=path.join(tmp,name+'.png');fs.writeFileSync(png,src.getImage());textureJobs.push([png,path.join(out,'textures',name+'.webp'),size])}return 'textures/'+name+'.webp'}
const megaMaterials=new Map();
function megaMaterial(src){const name=src.getName();if(megaMaterials.has(name))return megaMaterials.get(name);const m=doc.createMaterial(name).setBaseColorFactor(src.getBaseColorFactor()).setMetallicFactor(src.getMetallicFactor()).setRoughnessFactor(src.getRoughnessFactor());
 const maps={};if(src.getBaseColorTexture())maps.map=texture(src.getBaseColorTexture(),{size:512});if(src.getMetallicRoughnessTexture())maps.orm=texture(src.getMetallicRoughnessTexture(),{size:256});if(src.getNormalTexture())maps.normalMap=texture(src.getNormalTexture(),{size:512});m.setExtras({textures:maps});megaMaterials.set(name,m);return m}
for(const [key,[file,kind,length,grip]] of Object.entries(MEGAKIT)){
 const src=await io.read(path.join(tmp,file+'.gltf'));const srcNode=src.getRoot().listNodes().find(n=>n.getMesh());
 const world=new T.Matrix4().fromArray(srcNode.getWorldMatrix());const points=[];
 for(const prim of srcNode.getMesh().listPrimitives()){const a=prim.getAttribute('POSITION');for(let i=0;i<a.getCount();i++)points.push({v:new T.Vector3().fromArray(a.getElement(i,[])).applyMatrix4(world),wood:false})}
 // No wood materials to find the handle: grip is a fraction up the Y extent.
 const box=new T.Box3().setFromPoints(points.map(p=>p.v));
 let M;if(kind==='shield')M=normalise(points,kind,length,'center');else{const gy=box.min.y+grip*(box.max.y-box.min.y),s=length/(box.max.y-box.min.y);M=new T.Matrix4().makeScale(s,s,s).multiply(new T.Matrix4().makeTranslation(-(box.min.x+box.max.x)/2,-gy,-(box.min.z+box.max.z)/2))}
 // Head toward +X for single-headed tools.
 if(kind==='shaft'){const heads=points.map(p=>p.v.clone().applyMatrix4(M)).filter(v=>v.y>.25*length);if(heads.length&&heads.reduce((s,v)=>s+v.x,0)/heads.length<0)M.premultiply(new T.Matrix4().makeRotationY(Math.PI))}
 const full=M.clone().multiply(world),normalM=new T.Matrix3().getNormalMatrix(full);
 const node=doc.createNode(key);scene.addChild(node);const mesh=doc.createMesh(key);node.setMesh(mesh);
 for(const prim of srcNode.getMesh().listPrimitives()){const out=doc.createPrimitive().setMaterial(megaMaterial(prim.getMaterial()));
  for(const semantic of prim.listSemantics()){const a=prim.getAttribute(semantic),arr=new Float32Array(a.getCount()*a.getElementSize());for(let i=0;i<a.getCount();i++){const e=a.getElement(i,[]);if(semantic==='POSITION')new T.Vector3().fromArray(e).applyMatrix4(full).toArray(e);else if(semantic==='NORMAL')new T.Vector3().fromArray(e).applyMatrix3(normalM).normalize().toArray(e);else if(semantic==='TANGENT'){const t=new T.Vector3().fromArray(e).transformDirection(full);e[0]=t.x;e[1]=t.y;e[2]=t.z}arr.set(e,i*a.getElementSize())}
   out.setAttribute(semantic,accessor(a.getType(),arr))}
  if(prim.getIndices())out.setIndices(accessor('SCALAR',new Uint32Array(prim.getIndices().getArray())));mesh.addPrimitive(out)}
 node.setExtras({kind,source:'Fantasy Props MegaKit/'+file});
}
// Trim sheets → small WebP (they are shared by every MegaKit item).
const py="import sys,json\nfrom PIL import Image\nfor src,dst,size in json.load(sys.stdin):\n im=Image.open(src).convert('RGB');im=im.resize((size,size),Image.LANCZOS);im.save(dst,'WEBP',quality=84,method=6)\n";
execFileSync('python3',['-I','-c',py],{input:JSON.stringify(textureJobs),stdio:['pipe','inherit','inherit']});

await doc.transform(dedup(),prune(),quantize({pattern:/^(POSITION|NORMAL)$/,quantizePosition:14,quantizeNormal:10}));
const file=path.join(out,'weapons.glb');await io.write(file,doc);fs.rmSync(tmp,{recursive:true,force:true});
fs.writeFileSync(path.join(out,'LICENSE.md'),'# Weapon assets\n\nAll models and textures in this folder are by Quaternius (https://quaternius.com), released under CC0 1.0 Universal (https://creativecommons.org/publicdomain/zero/1.0/).\n\n- Medieval Weapons Pack (September 2018)\n- Fantasy Props MegaKit (Standard)\n\nGenerated by scripts/build-weapons.mjs.\n');
console.log('weapons.glb',(fs.statSync(file).size/1024).toFixed(0)+' KB; textures',fs.readdirSync(path.join(out,'textures')).map(f=>f+' '+(fs.statSync(path.join(out,'textures',f)).size/1024).toFixed(0)+'KB').join(', '));
