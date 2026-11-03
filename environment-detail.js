import {seededRandom,biomeWeights} from './procedural-world.js?v=release-20261103-scenery25';
import {creatureMaterial} from './creature-material.js?v=release-20261103-scenery25';
import {runFrameWork} from './frame-work.js?v=release-20261103-scenery25';
// Small underfoot dressing is non-solid and identically seeded on every client.
// Large, editable rocks and planted trees remain authoritative world entities.
export function dressingCandidates(seed){const r=seededRandom(seed^0x6d2b79f5),out=[];for(let x=-408;x<409;x+=9)for(let z=-408;z<409;z+=9){const px=x+(r()-.5)*7,pz=z+(r()-.5)*7,w=biomeWeights(px,pz,seed),v=r(),dry=w.dry>.6,snow=w.snow>.6;if(v<(dry?.28:snow?.20:.22))out.push({x:px,z:pz,kind:'stone',size:.10+r()*.15,yaw:r()*6.28});else if(v<(dry?.35:snow?.25:.43))out.push({x:px,z:pz,kind:'shrub',size:.32+r()*.35,yaw:r()*6.28});}return out;}
export function createGroundDressing(T,scene,land,{seed,canPlant}){
 const geometry={stone:new T.IcosahedronGeometry(1,1),shrub:new T.SphereGeometry(1,9,6)},materials={stone:creatureMaterial(T,0xd9d8c8,'stone'),shrub:creatureMaterial(T,0xb5ca91,'hide')},batches=[];let pending=false,version=0,centre={x:0,z:0};
 function* build(ticket){const chunks=new Map();let n=0;for(const d of dressingCandidates(seed)){if(ticket!==version)return;if(canPlant(d.x,d.z)){const key=Math.floor(d.x/64)+':'+Math.floor(d.z/64)+':'+d.kind;if(!chunks.has(key))chunks.set(key,[]);chunks.get(key).push(d)}if(++n%96===0)yield;}
 const next=[],dummy=new T.Object3D(),color=new T.Color();for(const [key,points]of chunks){if(ticket!==version){for(const m of next)m.removeFromParent();return}const [cx,cz,kind]=key.split(':'),copies=kind==='shrub'?3:2,mesh=new T.InstancedMesh(geometry[kind],materials[kind],points.length*copies);let i=0;for(const d of points){const r=seededRandom((Math.floor(d.x*101)^Math.floor(d.z*503)^seed)>>>0),w=biomeWeights(d.x,d.z,seed);for(let j=0;j<copies;j++){const x=d.x+(r()-.5)*.35,z=d.z+(r()-.5)*.35,s=d.size*(.7+r()*.5);dummy.position.set(x,land.heightAt(x,z)+(kind==='stone'?s*.22:s*.35),z);dummy.scale.set(s*(kind==='shrub'?1.15:1.4),s*(kind==='shrub'?.65:.42),s);dummy.rotation.set(0,d.yaw+j,kind==='shrub'?(r()-.5)*.25:0);dummy.updateMatrix();mesh.setMatrixAt(i,dummy.matrix);color.setHex(kind==='stone'?(w.snow>.6?0xadb7b5:w.dry>.6?0xb19b77:0x929b80):(w.snow>.6?0x6e8970:w.dry>.6?0x8e935b:0x557e3c));color.multiplyScalar(.8+r()*.35);mesh.setColorAt(i++,color);}}
 mesh.visible=false;mesh.receiveShadow=true;mesh.castShadow=true;mesh.userData.terrainFixed=true;mesh.userData.sceneryChunk={x:Number(cx)*64+32,z:Number(cz)*64+32};mesh.computeBoundingSphere();scene.add(mesh);next.push(mesh);yield;}
 if(ticket!==version){for(const m of next){m.removeFromParent();m.dispose()}return;}
 for(const m of batches){m.removeFromParent();m.dispose()}batches.splice(0,batches.length,...next);update(centre);
 }
 function update(player){centre={x:player.x,z:player.z};for(const m of batches){const c=m.userData.sceneryChunk;m.visible=Math.hypot(c.x-player.x,c.z-player.z)<125}}
 function invalidate(){version++;if(pending)return;pending=true;const ticket=version;void runFrameWork(build(ticket)).catch(error=>console.warn('Scenery loading:',error)).finally(()=>{pending=false;if(ticket!==version)invalidate()})}
 invalidate();return {batches,update,invalidate,get busy(){return pending}};
}
