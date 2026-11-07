import {batchStaticMeshes} from './static-batch.js?v=release-20261107-move3v161';
import {surfaceTexture,scaleSurfaceUV} from './surface-textures.js?v=release-20261107-move3v161';
import {kitCastle} from './building-kit.js?v=release-20261107-move3v161';
const castleMaterialCache=new WeakMap();
function castleMaterials(T){let m=castleMaterialCache.get(T);if(m)return m;
 m={stone:new T.MeshStandardMaterial({map:surfaceTexture(T,'masonry',0x92958b),roughness:.92}),trim:new T.MeshStandardMaterial({color:0xb6b5a5,roughness:.8}),wood:new T.MeshStandardMaterial({map:surfaceTexture(T,'wood',0x5e3c27),roughness:.85}),iron:new T.MeshStandardMaterial({color:0x323a3a,metalness:.65,roughness:.45}),
  banner:new T.MeshStandardMaterial({color:0x233e64}),cloth:new T.MeshStandardMaterial({color:0xe1d2a1}),flame:new T.MeshBasicMaterial({color:0xffd78c}),fire:[new T.MeshStandardMaterial({color:0xf6ce70,emissive:0x9b3a12}),new T.MeshStandardMaterial({color:0xff9c37,emissive:0x9b3a12})]};
 for(const material of Object.values(m).flat())material.userData.eldervaleShared=true;castleMaterialCache.set(T,m);return m}
export function castleObject(T,g,id,d={}){
 // Shared per renderer module: wall pieces, towers and gates then merge across
 // entities in the town cell batches (static-batch.js createCellBatcher).
 const {stone,trim,wood,iron,banner,cloth,flame,fire}=castleMaterials(T);
 const box=(x,y,z,w,h,l,mat=stone,parent=g)=>{const m=new T.Mesh(scaleSurfaceUV(new T.BoxGeometry(w,h,l),w,h,l),mat);m.position.set(x,y,z);m.castShadow=m.receiveShadow=true;parent.add(m);return m};
 const crenels=(parent,len,y,z=0)=>{for(let x=-len/2+.65;x<len/2;x+=2)box(x,y,z,1.1,1.1,1.2,trim,parent)};
 // The two swinging leaves (animated through userData.leftGate/rightGate) are the same with
 // the kit masonry (building-kit.js) and the procedural one.
 const gateLeaves=()=>{for(const side of [-1,1]){const pivot=new T.Group();pivot.position.set(side*4.5,0,1.9);g.add(pivot);box(-side*2.22,3.8,0,4.44,7.6,.32,wood,pivot);for(const y of [1,3.8,6.6])box(-side*2.22,y,.19,4.35,.18,.12,iron,pivot);for(let i=0;i<5;i++)box(-side*(.45+i*.86),3.8,.2,.035,7.2,.025,iron,pivot);g.userData[side<0?'leftGate':'rightGate']=pivot;}};
 if(id.startsWith('castle_')&&kitCastle(T,g,id,d,{gateLeaves})){batchStaticMeshes(T,g);return g}
 if(id==='castle_wall'){const len=d.length||24;box(0,3.8,0,len,7.6,2.6);box(0,7.5,0,len,.35,3.1,trim);crenels(g,len,8.2);for(let x=-len/2+2;x<len/2;x+=6)box(x,2.9,-1.45,1,5.8,.7)}
 if(id==='castle_tower'){const shaft=new T.Mesh(new T.CylinderGeometry(4,4.6,11,12),stone);for(let i=0;i<shaft.geometry.attributes.uv.count;i++){const uv=shaft.geometry.attributes.uv;uv.setXY(i,uv.getX(i)*12,uv.getY(i)*5)}shaft.position.y=5.5;shaft.castShadow=true;g.add(shaft);const crown=new T.Mesh(new T.CylinderGeometry(4.7,4.3,.8,12),trim);crown.position.y=11;g.add(crown);for(let i=0;i<12;i++){const a=i*Math.PI/6,m=box(Math.sin(a)*4.2,11.9,Math.cos(a)*4.2,1.2,1.2,1.2,trim);m.rotation.y=a}for(const y of [4.2,7.5])box(0,y,4.08,.35,1.25,.06,iron)}
 if(id==='castle_gate'){const len=d.length||28;for(const side of [-1,1])box(side*(len/4+2.25),4.7,0,(len-9)/2,9.4,3.6);gateLeaves();box(0,8.5,0,9,1.8,3.6);box(0,9.5,0,len,.4,4,trim);crenels(g,len,10.1);for(const side of [-1,1]){const flag=box(side*8,6,1.85,1.8,3.2,.06,banner);box(side*8,6,1.9,.20,1.7,.05,trim);box(side*8,6.3,1.91,.85,.18,.05,trim)}}
 if(id==='altar'){box(0,.22,0,2.8,.44,1.8);box(0,.88,0,2,1.1,1.1,trim);box(0,1.5,0,2.7,.2,1.6);box(0,1.64,0,2,.06,1.2,cloth);for(const side of [-1,1]){box(side*.85,1.8,0,.10,.4,.1,wood);const candle=new T.Mesh(new T.SphereGeometry(.08,6,5),flame);candle.position.set(side*.85,2.05,0);g.add(candle)}}
 if(id==='hearth'){box(0,.2,0,2,.4,1.5);box(0,1,-.6,2,1.6,.3);for(const side of [-1,1])box(side*.85,.75,0,.3,1.2,1.4);box(0,1.5,0,2,.25,1.5);for(let i=0;i<5;i++){const tongue=new T.Mesh(new T.ConeGeometry(.13,.65,6),fire[i%2]);tongue.position.set((i-2)*.22,.6,0);g.add(tongue)}}
 if(id.startsWith('castle_'))batchStaticMeshes(T,g);
 return g;
}
