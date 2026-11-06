import {approachSample,approachPoint} from './castle-approach.js?v=release-20261106-boss107';
import {seededRandom,biomeWeights} from './procedural-world.js?v=release-20261106-boss107';
import {roadLines,segmentDistance} from './geography.js?v=release-20261106-boss107';
import {creatureMaterial} from './creature-material.js?v=release-20261106-boss107';
import {runFrameWork} from './frame-work.js?v=release-20261106-boss107';
// Small underfoot dressing is non-solid and identically seeded on every client.
// Large, editable rocks and planted trees remain authoritative world entities.
export const DRESSING_KINDS=['stone','shrub','fern','sapling','log'];
// Woodland edges along the roads: where the old cuttings had bare banks, young conifers, bushes,
// ferns and the odd fallen log now line the way (all non-solid, so no road is ever blocked).
export function roadsideCandidates(seed,lines=roadLines){
 const r=seededRandom(seed^0x2545f491),out=[];
 for(const line of lines)for(let i=1;i<line.length;i++){
  const a=line[i-1],b=line[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1e-6)continue;const ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L;
  for(let s=r()*3;s<L;s+=3.4)for(const side of [-1,1]){
   const v=r(),d=6.5+r()*11,along=(r()-.5)*2,x=a[0]+ux*(s+along)-uz*d*side,z=a[1]+uz*(s+along)+ux*d*side,w=biomeWeights(x,z,seed),dry=w.dry>.6,snow=w.snow>.6,yaw=r()*6.28;
   if(lines.some(l=>l.some((p,k)=>k&&segmentDistance(x,z,l[k-1],p)<6)))continue;
   if(v<.22)out.push({x,z,kind:'sapling',size:.85+r()*.65,yaw});
   else if(v<.5)out.push({x,z,kind:'shrub',size:.42+r()*.26,yaw});
   else if(v<.66&&!dry&&!snow)out.push({x,z,kind:'fern',size:.32+r()*.3,yaw});
   else if(v<.7)out.push({x,z,kind:'log',size:.8+r()*.5,yaw});
  }
 }
 return out;
}
export function dressingCandidates(seed){const r=seededRandom(seed^0x6d2b79f5),out=[];for(let x=-408;x<409;x+=9)for(let z=-408;z<409;z+=9){const px=x+(r()-.5)*7,pz=z+(r()-.5)*7,w=biomeWeights(px,pz,seed),v=r(),dry=w.dry>.6,snow=w.snow>.6;if(v<(dry?.28:snow?.20:.22))out.push({x:px,z:pz,kind:'stone',size:.10+r()*.15,yaw:r()*6.28});else if(v<(dry?.35:snow?.25:.43))out.push({x:px,z:pz,kind:'shrub',size:.32+r()*.35,yaw:r()*6.28});else if(v<(dry?.36:snow?.27:.52))out.push({x:px,z:pz,kind:dry||snow?'log':'fern',size:dry||snow?.7+r()*.4:.3+r()*.3,yaw:r()*6.28});else if(v<(dry?.37:snow?.28:.545))out.push({x:px,z:pz,kind:'log',size:.7+r()*.5,yaw:r()*6.28});}for(let along=22;along<220;along+=4)for(const side of [-24,-17,-10,10,17,24]){const p=approachPoint(along+(r()-.5)*3,side+(r()-.5)*3);if(approachSample(p.x,p.z).weight>.5)out.push({...p,kind:r()<.28?'stone':'fern',size:.24+r()*.25,yaw:r()*6.28});}return [...out,...roadsideCandidates(seed)];}
// Per-kind placement: [height offset, scale x, y, z, tilt] from the instance size s.
function placement(kind,s){
 if(kind==='stone')return [s*.22,s*1.4,s*.42,s,0];
 if(kind==='shrub')return [s*.35,s*1.15,s*.65,s,.25];
 if(kind==='fern')return [s*.35,s*1.4,s,s,0];
 if(kind==='sapling')return [s*1.55-.15,s*1.05,s*3.1,s*1.05,.1];
 return [s*.24,s*.26,s*.26,s*2.6,0];// log: lies along its yaw
}
export function createGroundDressing(T,scene,land,{seed,canPlant}){
 const fern=new T.BufferGeometry(),verts=[];for(let leaf=0;leaf<9;leaf++){const a=leaf*Math.PI*2/9;for(let i=0;i<5;i++){const t=i/5,u=(i+1)/5,width=.10*(1-t),v=(p,w)=>[Math.cos(a)*p+Math.sin(a)*w,Math.sin(p*Math.PI)*.62,Math.sin(a)*p-Math.cos(a)*w];verts.push(...v(t,-width),...v(u,0),...v(t,width));}}fern.setAttribute('position',new T.Float32BufferAttribute(verts,3));fern.computeVertexNormals();
 const log=new T.CylinderGeometry(1,1,1,7);log.rotateX(Math.PI/2);
 const geometry={fern,stone:new T.IcosahedronGeometry(1,1),shrub:new T.SphereGeometry(1,9,6),sapling:new T.ConeGeometry(.5,1,7),log},materials={fern:new T.MeshStandardMaterial({color:0x5b7f3b,side:T.DoubleSide,roughness:.95}),stone:creatureMaterial(T,0xd9d8c8,'stone'),shrub:creatureMaterial(T,0xb5ca91,'hide'),sapling:creatureMaterial(T,0xb5ca91,'hide'),log:creatureMaterial(T,0xd9d8c8,'stone')},batches=[];let pending=false,version=0,centre={x:0,z:0};
 function* build(ticket){const chunks=new Map();let n=0;for(const d of dressingCandidates(seed)){if(ticket!==version)return;if(canPlant(d.x,d.z)){const key=Math.floor(d.x/64)+':'+Math.floor(d.z/64)+':'+d.kind;if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(d)}if(++n%96===0)yield;}
 const next=[],dummy=new T.Object3D(),color=new T.Color();for(const [key,points]of chunks){if(ticket!==version){for(const m of next)m.removeFromParent();return}const [cx,cz,kind]=key.split(':'),copies=kind==='shrub'?3:kind==='stone'||kind==='fern'?2:1,mesh=new T.InstancedMesh(geometry[kind],materials[kind],points.length*copies);let i=0;for(const d of points){const r=seededRandom((Math.floor(d.x*101)^Math.floor(d.z*503)^seed)>>>0),w=biomeWeights(d.x,d.z,seed);for(let j=0;j<copies;j++){const x=d.x+(r()-.5)*.35,z=d.z+(r()-.5)*.35,s=d.size*(.7+r()*.5),[lift,sx,sy,sz,tilt]=placement(kind,s);dummy.position.set(x,land.heightAt(x,z)+lift,z);dummy.scale.set(sx,sy,sz);dummy.rotation.set(0,d.yaw+j,(r()-.5)*tilt);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);color.setHex(dressingColor(kind,w));color.multiplyScalar(.8+r()*.35);mesh.setColorAt(i++,color);}}
 mesh.visible=false;mesh.receiveShadow=true;mesh.castShadow=true;mesh.userData.terrainFixed=true;mesh.userData.sceneryChunk={x:Number(cx)*64+32,z:Number(cz)*64+32};mesh.computeBoundingSphere();scene.add(mesh);next.push(mesh);yield;}
 if(ticket!==version){for(const m of next){m.removeFromParent();m.dispose()}return;}
 for(const m of batches){m.removeFromParent();m.dispose()}batches.splice(0,batches.length,...next);update(centre);
 }
 function update(player){centre={x:player.x,z:player.z};for(const m of batches){const c=m.userData.sceneryChunk;m.visible=Math.hypot(c.x-player.x,c.z-player.z)<125}}
 function invalidate(){version++;if(pending)return;pending=true;const ticket=version;void runFrameWork(build(ticket)).catch(error=>console.warn('Scenery loading:',error)).finally(()=>{pending=false;if(ticket!==version)invalidate()})}
 invalidate();return {batches,update,invalidate,get busy(){return pending}};
}
// Biome tints: frosted conifers and grey stone in the north, bleached logs and olive scrub in the dry
// expanse, deep greens elsewhere.
export function dressingColor(kind,w){
 const snow=w.snow>.6,dry=w.dry>.6;
 if(kind==='stone')return snow?0xadb7b5:dry?0xb19b77:0x929b80;
 if(kind==='log')return snow?0x6f6152:dry?0xb7a78c:0x7d6448;
 if(kind==='sapling')return snow?0xb4c6c2:dry?0x7c7f45:0x3f6a36;
 return snow?0x6e8970:dry?0x8e935b:0x557e3c;
}
