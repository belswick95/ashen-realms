import {horseAsset} from './horse-asset.js?v=release-20261106-tile93';
import {surfaceTexture} from './surface-textures.js?v=release-20261106-tile93';
const caches=new WeakMap();
// Authored anatomy, UV coat textures and baked skeletal gallop from Wildfire Games.
// Local additions are fitted saddle, reins, blue/gold cloth and steel breast armor.
export function buildWarhorse(T,parent){
 let cache=caches.get(T);if(!cache){const geometries=horseAsset.parts.map(data=>{const bytes=Uint8Array.from(atob(data.packed),c=>c.charCodeAt(0)),packed=new Int16Array(bytes.buffer),stride=data.vertexCount*3,frames=Array.from({length:data.frameCount},(_,i)=>Float32Array.from(packed.subarray(i*stride,(i+1)*stride),v=>v/10000));const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(frames[0],3));g.setAttribute('uv',new T.Float32BufferAttribute(data.uv,2));g.setIndex(data.indices);g.computeVertexNormals();g.morphAttributes.position=frames.slice(1).map(frame=>new T.BufferAttribute(frame,3));g.morphAttributes.normal=frames.slice(1).map(frame=>{const temp=new T.BufferGeometry();temp.setAttribute('position',new T.BufferAttribute(frame,3));temp.setIndex(data.indices);temp.computeVertexNormals();const normal=temp.attributes.normal;temp.dispose();return normal});g.computeBoundingSphere();g.userData.eldervaleShared=true;return g});
 const back={minZ:-1.65,step:.12,heights:new Float32Array(17)};for(const frame of [geometries[0].attributes.position,...geometries[0].morphAttributes.position])for(let i=0;i<frame.count;i++){const x=frame.getX(i),y=frame.getY(i),z=frame.getZ(i),cell=Math.floor((z-back.minZ)/back.step);if(Math.abs(x)<.7&&y>1.1&&cell>=0&&cell<back.heights.length)back.heights[cell]=Math.max(back.heights[cell],y);}
 const coat=new T.MeshStandardMaterial({color:0xffffff,roughness:.85}),hair=new T.MeshStandardMaterial({color:0xffffff,roughness:.95,alphaTest:.4,side:T.DoubleSide});if(typeof document!=='undefined'){const loader=new T.TextureLoader(),skin=loader.load('/assets/models/horse_white.png'),normal=loader.load('/assets/models/horse_norm.png'),hairMap=loader.load('/assets/models/hair_black.png');for(const map of [skin,hairMap]){map.colorSpace=T.SRGBColorSpace;map.anisotropy=4;}coat.map=skin;coat.normalMap=normal;coat.normalScale.set(.55,.55);hair.map=hairMap;}coat.userData.eldervaleShared=hair.userData.eldervaleShared=true;cache={geometries,coat,hair,back};caches.set(T,cache);}
 const root=new T.Group();root.scale.setScalar(1.20);parent.add(root);root.visible=false;root.userData.capeBackProfile=cache.back;const barrel=new T.Group(),tail=new T.Group();root.add(barrel,tail);const resources=[],skins=cache.geometries.map((g,i)=>{const m=new T.Mesh(g,i?cache.hair:cache.coat);m.castShadow=m.receiveShadow=true;root.add(m);return m});
 const mat=(color,metalness=0,roughness=.8)=>{const m=new T.MeshStandardMaterial({color,metalness,roughness});resources.push(m);return m},dark=mat(0x38291f),gold=mat(0xc3a35a,.55,.4),steel=mat(0x89969e,.65,.4),blue=mat(0x244b8d);blue.map=surfaceTexture(T,'cloth',0xffffff);
 function mesh(g,m,p=barrel){resources.push(g);const o=new T.Mesh(g,m);o.castShadow=o.receiveShadow=true;p.add(o);return o;}
 function line(points,r,m){return mesh(new T.TubeGeometry(new T.CatmullRomCurve3(points.map(p=>new T.Vector3(...p))),20,r,6,false),m);}
 function panel(points,m){const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(points.flat(),3));g.setIndex([0,1,2,0,2,3]);g.computeVertexNormals();m.side=T.DoubleSide;return mesh(g,m);}
 for(const side of [-1,1]){const p=[[side*.23,1.80,-.72],[side*.29,1.81,.28],[side*.405,1.18,.22],[side*.41,1.17,-.73]];panel(p,blue);line([...p,p[0]],.014,gold);line([[side*.23,1.78,-.24],[side*.40,1.49,-.24],[side*.34,1.08,-.24]],.018,dark);line([[side*.37,1.45,-.12],[side*.40,1.12,-.12],[side*.54,1.10,-.12],[side*.55,1.42,-.12]],.015,steel);}
 // Keep the fitted saddle cloth and stirrups; raised leather seat/rims pierced the cape.

 for(const side of [-1,1]){panel([[side*.08,1.87,.70],[side*.26,1.76,.76],[side*.29,1.25,.69],[side*.07,1.18,.77]],steel);line([[side*.08,1.87,.71],[side*.26,1.76,.77],[side*.29,1.25,.70],[side*.07,1.18,.78]],.012,gold);}
 let seatOffset=[0,0];
 function pose(phase,moving){const count=horseAsset.saddle.length,f=((phase%1)+1)%1*count,i=Math.floor(f)%count,j=(i+1)%count,t=f-i;for(const skin of skins){skin.morphTargetInfluences.fill(0);if(moving){skin.morphTargetInfluences[i]=1-t;skin.morphTargetInfluences[j]=t;}}seatOffset=moving?horseAsset.saddle[i].map((v,k)=>v*(1-t)+horseAsset.saddle[j][k]*t):[0,0];barrel.position.set(0,seatOffset[0],seatOffset[1]);return seatOffset;}
 // Reins: bit ring → over the neck → the rider's hand. Straight leather
 // segments are re-aimed every frame so the line ends in the rider's fist.
 const reinGeometry=new T.CylinderGeometry(.014,.014,1,6,1,true);reinGeometry.translate(0,.5,0);reinGeometry.rotateX(Math.PI/2);resources.push(reinGeometry);
 const reins=[-1,1].map(side=>({bit:new T.Vector3(side*.16,1.90,1.55),neck:new T.Vector3(side*.2,2.02,1.12),hand:new T.Vector3(side*.25,2.38,.21),segments:[0,1].map(()=>{const m=new T.Mesh(reinGeometry,dark);m.castShadow=true;barrel.add(m);return m})}));
 const inverse=new T.Matrix4(),look=new T.Vector3(),sag=new T.Vector3();
 function aim(m,from,to){m.position.copy(from);m.scale.set(1,1,Math.max(1e-4,from.distanceTo(to)));m.lookAt(look.copy(to).applyMatrix4(barrel.matrixWorld))}
 // Hands in world space (left, right); omitted hands keep the resting grip.
 function setReins(left,right){root.updateMatrixWorld(true);inverse.copy(barrel.matrixWorld).invert();
  reins.forEach((r,i)=>{const hand=i?right:left;if(hand)r.hand.copy(hand).applyMatrix4(inverse);
   // The rein drapes over the neck between the bit and the hand.
   sag.copy(r.bit).lerp(r.hand,.35);sag.y=Math.min(sag.y,r.neck.y);sag.x=r.neck.x+(r.hand.x-r.neck.x)*.3;aim(r.segments[0],r.bit,sag);aim(r.segments[1],sag,r.hand)})}
 setReins();
 return {root,barrel,tail,resources,skins,pose,setReins,reins,legs:horseAsset.hoofContacts.map((offset,i)=>({offset,front:i>1})),get seatOffset(){return seatOffset}};
}
