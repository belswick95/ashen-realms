import {seededRandom,biomeWeights} from './procedural-world.js?v=release-20261106-shieldorig122';
import {worldRivers,landscapeLakes,segmentDistance} from './geography.js?v=release-20261106-shieldorig122';
// Tree species share the same three instanced meshes per 64-unit chunk (trunks, branches, leaf
// cards): a species is only a different arrangement and an instance tint, so adding variety costs
// no extra draw calls. Everything is seeded by position, so every client grows the same forest.
export const TREE_SPECIES=['oak','birch','pine','spruce','snowpine','willow','dead'];
// Distance to the nearest river bank or lake shore (willows grow beside water).
export function shoreDistance(x,z){
 let d=Infinity;
 for(const river of worldRivers)for(let i=1;i<river.points.length;i++)d=Math.min(d,segmentDistance(x,z,river.points[i-1],river.points[i])-river.width/2);
 for(const lake of landscapeLakes)d=Math.min(d,(Math.hypot((x-lake.x)/lake.rx,(z-lake.z)/lake.rz)-1)*Math.min(lake.rx,lake.rz));
 return d;
}
// Biome-weighted species choice: snowy pines in the frozen north, dead and scrub trees in the dry
// expanse, willows at the water's edge and mixed oak, birch, pine and spruce elsewhere.
export function treeSpecies(x,z,seed=1,roll=Math.random()){
 const w=biomeWeights(x,z,seed);
 if(w.snow>.55)return roll<.78?'snowpine':roll<.9?'spruce':roll<.96?'birch':'dead';
 if(shoreDistance(x,z)<11&&roll<.65)return 'willow';
 if(w.dry>.55)return roll<.45?'dead':roll<.7?'pine':'oak';
 if(w.snow>.3)return roll<.45?'spruce':roll<.7?'pine':roll<.88?'birch':'oak';
 if(w.dry>.3)return roll<.15?'dead':roll<.55?'oak':roll<.8?'pine':'birch';
 return roll<.42?'oak':roll<.66?'birch':roll<.82?'pine':'spruce';
}
// Instance tints multiply the shared textures (bark: brown wood; leaves: the green card atlas).
const BARK={oak:0xffffff,birch:[5.2,7.6,11.5],pine:[.85,.8,.75],spruce:[.7,.68,.66],snowpine:[.75,.72,.7],willow:[1.05,1,.9],dead:[2.3,2.5,2.9]};
const LEAF={oak:[1,1,1],birch:[1.25,1.32,.78],pine:[.62,.78,.7],spruce:[.55,.72,.8],snowpine:[8,5.2,14],willow:[1.35,1.45,.85],dead:[1,1,1]};
const DRY_LEAF=[1.25,1.05,.6];
export function buildNaturalForest(T,scene,trees,{wood,heightAt,seed=1,species=null}){
 const atlas=document.createElement('canvas');atlas.width=atlas.height=256;const c=atlas.getContext('2d'),rand=seededRandom(seed);c.clearRect(0,0,256,256);for(let i=0;i<650;i++){const a=rand()*Math.PI*2,r=Math.sqrt(rand())*116,x=128+Math.cos(a)*r,y=128+Math.sin(a)*r;c.fillStyle=['#466138','#5a7441','#789253','#314d31'][i%4];c.beginPath();c.ellipse(x,y,3+rand()*8,1.5+rand()*4,a,0,Math.PI*2);c.fill()}const map=new T.CanvasTexture(atlas);map.colorSpace=T.SRGBColorSpace;const leaves=new T.MeshStandardMaterial({map,alphaTest:.4,side:T.DoubleSide,roughness:.95,color:0xd4dfc3});
 const leafGeometry=new T.PlaneGeometry(1,1),trunkGeometry=new T.CylinderGeometry(.15,.27,1,10),branchGeometry=new T.CylinderGeometry(.45,.8,1,6),chunks=new Map(),meshes=[],dummy=new T.Object3D(),tint=new T.Color();
 for(const tree of trees){const key=Math.floor(tree.x/64)+':'+Math.floor(tree.z/64);if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(tree)}
 for(const [key,records]of chunks){const trunks=[],branches=[],cards=[];for(const {x,z}of records){
  const starts=[trunks.length,branches.length,cards.length],treeKey='base:tree:'+x.toFixed(1)+':'+z.toFixed(1);
  const r=seededRandom((seed^Math.floor(x*127)^Math.floor(z*313))>>>0),y=heightAt(x,z);
  let height=5+r()*3;const w=species?null:biomeWeights(x,z,seed);
  const kind=species||treeSpecies(x,z,seed,r());
  const bark=BARK[kind]||BARK.oak,leaf=w&&kind==='oak'&&w.dry>.45?DRY_LEAF:LEAF[kind]||LEAF.oak;
  if(kind==='birch')height+=1.5;else if(kind==='spruce'||kind==='snowpine')height+=2+r()*2;else if(kind==='willow')height-=.8;else if(kind==='dead')height-=r()*1.5;
  const girth=kind==='birch'?.55:kind==='willow'?1.15:kind==='dead'?.8:1;
  trunks.push({x,y:y+height/2,z,sx:(.8+r()*.5)*girth,sy:height,sz:(.8+r()*.5)*girth,rx:0,ry:r()*6,rz:kind==='dead'?(r()-.5)*.12:0,color:bark});
  const card=(d)=>cards.push({...d,color:leaf});
  if(kind==='pine'){
   for(let i=0;i<6;i++){const a=i*2.4+r()*.4,level=.45+i*.09,reach=1.9-i*.2,bx=x+Math.sin(a)*reach,bz=z+Math.cos(a)*reach;branches.push({x:(x+bx)/2,y:y+height*level,z:(z+bz)/2,sx:.10,sy:reach*1.3,sz:.10,rx:Math.PI/2-.35,ry:a,rz:0,color:bark});for(let j=0;j<3;j++)card({x:bx+(r()-.5)*.9,y:y+height*level+.8,z:bz+(r()-.5)*.9,sx:2.4,sy:1.8,sz:1,rx:(r()-.5)*.65,ry:a+j*Math.PI/3,rz:(r()-.5)*.3});}
  }else if(kind==='spruce'||kind==='snowpine'){
   // A narrow cone: seven whorls whose reach shrinks toward the tip, cards drooping at the ends.
   for(let i=0;i<7;i++){const level=.22+i*.105,reach=Math.max(.45,2.3*(1-i/7.2)),a=i*2.1+r()*.5,bx=x+Math.sin(a)*reach,bz=z+Math.cos(a)*reach;if(i%2===0)branches.push({x:(x+bx)/2,y:y+height*level,z:(z+bz)/2,sx:.08,sy:reach*1.2,sz:.08,rx:Math.PI/2+.25,ry:a,rz:0,color:bark});for(let j=0;j<3;j++){const aj=a+j*Math.PI*2/3,s=.6+reach*.75;card({x:x+Math.sin(aj)*reach*.62,y:y+height*level+.15,z:z+Math.cos(aj)*reach*.62,sx:s*1.25,sy:s*.85,sz:1,rx:-.55,ry:aj,rz:(r()-.5)*.2})}}
   card({x,y:y+height*.97,z,sx:.9,sy:1.5,sz:1,rx:0,ry:r()*3,rz:0});
  }else if(kind==='willow'){
   // A low, wide crown with long curtains of foliage hanging toward the ground.
   for(let i=0;i<7;i++){const a=i*Math.PI*2/7+r()*.4,reach=2.2+r()*.7,bx=x+Math.sin(a)*reach,bz=z+Math.cos(a)*reach;branches.push({x:(x+bx)/2,y:y+height*.82,z:(z+bz)/2,sx:.09,sy:reach*1.25,sz:.09,rx:Math.PI/2-.55,ry:a,rz:0,color:bark});card({x:bx,y:y+height*.62,z:bz,sx:1.5,sy:height*.62,sz:1,rx:0,ry:a+Math.PI/2,rz:(r()-.5)*.12});card({x:x+Math.sin(a)*reach*.6,y:y+height*.95,z:z+Math.cos(a)*reach*.6,sx:2.8,sy:1.8,sz:1,rx:(r()-.5)*.5,ry:a,rz:0})}
  }else if(kind==='dead'){
   // Bare, crooked limbs only.
   for(let i=0;i<8;i++){const a=i*2.4+r()*.7,level=.45+r()*.45,reach=.8+r()*1.4,bx=x+Math.sin(a)*reach,bz=z+Math.cos(a)*reach;branches.push({x:(x+bx)/2,y:y+height*level+reach*.25,z:(z+bz)/2,sx:.06+r()*.03,sy:reach*1.3,sz:.06,rx:Math.PI/2-.7-r()*.4,ry:a,rz:0,color:bark})}
  }else{
   // Oak and birch: a broad (oak) or tall, airy (birch) crown of leaf cards around six limbs.
   const birch=kind==='birch',spread=birch?.72:1;
   for(let k=0;k<(birch?4:6);k++)card({x:x+(r()-.5)*.9,y:y+height*(.72+r()*.17),z:z+(r()-.5)*.9,sx:3.5*spread,sy:3.3,sz:1,rx:(r()-.5)*.7,ry:k*Math.PI/3,rz:(r()-.5)*.25});
   for(let i=0;i<6;i++){const a=i*2.4+r()*.4,level=(birch?.62:.57)+(i%3)*.12,reach=(1.7+r()*.6)*spread,bx=x+Math.sin(a)*reach,bz=z+Math.cos(a)*reach;branches.push({x:(x+bx)/2,y:y+height*level,z:(z+bz)/2,sx:birch?.07:.10,sy:reach*1.3,sz:birch?.07:.10,rx:Math.PI/2-.35,ry:a,rz:0,color:bark});for(let j=0;j<3;j++)card({x:bx+(r()-.5)*.9,y:y+height*level+r()*.8,z:bz+(r()-.5)*.9,sx:2.8*spread,sy:2.5*(birch?.9:1),sz:1,rx:(r()-.5)*.65,ry:a+j*Math.PI/3,rz:(r()-.5)*.3});}
  }
  [trunks,branches,cards].forEach((data,k)=>{for(let i=starts[k];i<data.length;i++)data[i].treeKey=treeKey});
 }
 const [kx,kz]=key.split(':').map(Number);for(const [geometry,material,data,range]of [[trunkGeometry,wood,trunks,190],[branchGeometry,wood,branches,150],[leafGeometry,leaves,cards,175]]){if(!data.length)continue;const m=new T.InstancedMesh(geometry,material,data.length);const tinted=data.some(d=>d.color!==0xffffff&&d.color!==LEAF.oak);data.forEach((d,i)=>{dummy.position.set(d.x,d.y,d.z);dummy.rotation.set(d.rx,d.ry,d.rz);dummy.scale.set(d.sx,d.sy,d.sz);dummy.updateMatrix();m.setMatrixAt(i,dummy.matrix);if(tinted){if(typeof d.color==='number')tint.setHex(d.color);else tint.setRGB(...d.color);m.setColorAt(i,tint)}});if(m.instanceColor)m.instanceColor.needsUpdate=true;m.userData.treeSlots=new Map();data.forEach((d,i)=>{if(!m.userData.treeSlots.has(d.treeKey))m.userData.treeSlots.set(d.treeKey,[]);m.userData.treeSlots.get(d.treeKey).push(i)});m.userData.treeOriginal=m.instanceMatrix.array.slice();m.castShadow=true;m.receiveShadow=true;m.userData.terrainFixed=true;m.userData.naturalChunk={x:kx*64+32,z:kz*64+32,range};m.computeBoundingSphere();scene.add(m);meshes.push(m)}
 }
 return meshes;
}
export function updateNaturalForest(batches,player){for(const b of batches){const c=b.userData.naturalChunk;if(c)b.visible=Math.hypot(c.x-player.x,c.z-player.z)<c.range+46;}}

export function setForestTreeVisible(T,batches,id,visible){for(const mesh of batches){const slots=mesh.userData.treeSlots?.get(id);if(!slots)continue;for(const i of slots){const offset=i*16;if(visible)mesh.instanceMatrix.array.set(mesh.userData.treeOriginal.subarray(offset,offset+16),offset);else {mesh.instanceMatrix.array.fill(0,offset,offset+16);mesh.instanceMatrix.array[offset+15]=1;}}mesh.instanceMatrix.needsUpdate=true;}}
