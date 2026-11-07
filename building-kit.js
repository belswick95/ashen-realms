// Kit building art (assets/buildings/, CC0: Quaternius Medieval Village MegaKit and KayKit
// Medieval Hexagon; see catalog.json and credits.html). The GLBs load once, lazily, after the
// world starts. Until they arrive, or if they fail, every building keeps its procedural look.
//
// Nothing here changes a footprint. Walk-in houses (game.js house()) keep their plinth, floor,
// interior, door pivot/hit box, collision and server boxes; only the exterior wall boxes, roof
// and facade dressing are swapped for kit pieces laid out in the house's own local frame:
// walls ±2.00 × ±1.92 outer faces, wall tops at 3.0, door opening ±.52 on +Z. Castle walls,
// towers and gates keep their procedural leaves, hit boxes and collision rows; only their
// masonry is swapped. Kit meshes are plain single-material meshes with Float32
// position/normal/uv, so the per-house and per-cell static batchers merge them per material.
const FILES=['village-modular.glb','town-buildings.glb'];
const BASE=new URL('./assets/buildings/',import.meta.url);
const kit={status:'idle',pieces:new Map(),promise:null,listeners:[],error:null};

export const buildingKitStatus=()=>kit.status;
export const buildingKitReady=()=>kit.status==='ready';
export function onBuildingKitReady(fn){if(kit.status==='ready')fn();else kit.listeners.push(fn)}
// Tests and measurements can switch the kit off (procedural only).
const disabled=()=>!!globalThis.eldervaleNoBuildingKit;

// glTF quantized/indexed attributes -> plain Float32 position/normal/uv, baked into piece space.
function plainGeometry(T,source,matrix){
 const g=new T.BufferGeometry(),count=source.attributes.position.count;
 for(const [name,size] of [['position',3],['normal',3],['uv',2]]){
  const a=source.attributes[name],out=new Float32Array(count*size);
  if(a)for(let i=0;i<count;i++){out[i*size]=a.getX(i);out[i*size+1]=a.getY(i);if(size===3)out[i*size+2]=a.getZ(i)}
  g.setAttribute(name,new T.BufferAttribute(out,size));
 }
 if(source.index)g.setIndex(Array.from(source.index.array));
 if(!source.attributes.normal)g.computeVertexNormals();
 g.applyMatrix4(matrix);g.computeBoundingBox();g.computeBoundingSphere();g.userData.eldervaleShared=true;return g;
}
// Window glass is drawn opaque (as the procedural panes) so it merges with the static batches.
function share(material){if(material.transparent){material.transparent=false;material.opacity=1;material.depthWrite=true}material.userData.eldervaleShared=true;for(const v of Object.values(material))if(v?.isTexture)v.userData.eldervaleShared=true;return material}
function extract(T,scene){
 scene.updateMatrixWorld(true);const inverse=new T.Matrix4(),rel=new T.Matrix4();
 for(const root of scene.children){
  inverse.copy(root.matrixWorld).invert();
  // Keep the piece root's own scale (the KayKit pieces carry their x8 bake there).
  const rootScale=new T.Matrix4().makeScale(root.scale.x,root.scale.y,root.scale.z);
  const parts=[];
  root.traverse(o=>{if(!o.isMesh)return;rel.multiplyMatrices(inverse,o.matrixWorld).premultiply(rootScale);
   const materials=Array.isArray(o.material)?o.material:[o.material];
   if(materials.length===1)parts.push({geometry:plainGeometry(T,o.geometry,rel),material:share(materials[0])});
   else for(const group of o.geometry.groups){const sub=o.geometry.clone();sub.clearGroups();const index=sub.index.array.slice(group.start,group.start+group.count);sub.setIndex(Array.from(index));parts.push({geometry:plainGeometry(T,sub,rel),material:share(materials[group.materialIndex])})}});
  const box=new T.Box3();for(const p of parts)box.union(p.geometry.boundingBox);
  kit.pieces.set(root.name,{parts,box});
 }
}
export function loadBuildingKit(T){
 if(kit.promise)return kit.promise;
 if(disabled()||typeof document==='undefined')return Promise.resolve(false);
 kit.status='loading';
 kit.promise=(async()=>{
  const {GLTFLoader}=await import('three/addons/loaders/GLTFLoader.js');const loader=new GLTFLoader();
  const scenes=await Promise.all(FILES.map(f=>loader.loadAsync(new URL(f,BASE).href)));
  for(const gltf of scenes)extract(T,gltf.scene);
  kit.status='ready';for(const fn of kit.listeners.splice(0))try{fn()}catch(e){console.warn('Building kit listener:',e)}
  return true;
 })().catch(error=>{kit.status='failed';kit.error=error;console.warn('Building kit unavailable, keeping procedural buildings:',error?.message||error);return false});
 return kit.promise;
}

// ---- Placement ----
const tints=new Map();
function tinted(material,hex){if(hex==null)return material;const key=material.uuid+':'+hex;let m=tints.get(key);if(!m){m=material.clone();m.color.multiply(new (material.color.constructor)(hex));m.userData.eldervaleShared=true;tints.set(key,m)}return m}
// Adds a piece's meshes straight to `parent` (so the house and cell batchers can merge them).
export function placePiece(T,parent,id,{x=0,y=0,z=0,rot=0,sx=1,sy=1,sz=1,tint=null,list=null}={}){
 const piece=kit.pieces.get(id);if(!piece)return [];const out=[];
 for(const part of piece.parts){const m=new T.Mesh(part.geometry,tint&&tint[part.material.name]!==undefined?tinted(part.material,tint[part.material.name]):part.material);
  m.position.set(x,y,z);m.rotation.y=rot;m.scale.set(sx,sy,sz);m.castShadow=m.receiveShadow=true;m.name='kit:'+id;parent.add(m);out.push(m);list?.push(m)}
 return out;
}
export const pieceBox=id=>kit.pieces.get(id)?.box||null;

// ---- Walk-in houses (Quaternius modular pieces) ----
// House-local frame faces: front +Z, back -Z, right +X, left -X; u runs along the face.
const FACES={
 front:{len:4.0,at:u=>[u,1.92],rot:0},
 back:{len:4.0,at:u=>[-u,-1.92],rot:Math.PI},
 right:{len:3.84,at:u=>[2.0,-u],rot:Math.PI/2},
 left:{len:3.84,at:u=>[-2.0,u],rot:-Math.PI/2},
};
const KIT_W=2,KIT_H=3.123,WALL_OUT=.092,WALL_DEPTH=.49; // kit wall module and its exterior face
// The kit door opening is 1.28 × 2.16 m; scaled to the house's .52 half-width door.
const DOOR_SX=1.04/1.28;
const SETS={
 // Stone walls close their own corners (the kit's carved stone quoin is 3k triangles).
 stone:{plain:['wall_stone'],door:'wall_stone_door_flat',window:['wall_stone_window_wide_round','window_wide_round'],upper:['wall_stone_window_thin_round','window_thin_round'],corner:null},
 timber:{plain:['wall_timber_grid','wall_plaster'],door:'wall_plaster_door_flat',window:['wall_plaster_window_wide_flat','window_wide_flat'],upper:['wall_plaster_window_thin_round','window_thin_round'],corner:'corner_wood'},
 plank:{plain:['wall_timber_grid'],door:'wall_plaster_door_flat',window:['wall_plaster_window_wide_flat','window_wide_flat'],upper:['wall_plaster_window_thin_round','window_thin_round'],corner:'corner_wood'},
};
const ROOF_TINT={slate:0x8fa2b4,shingle:0xb89478,thatch:0xe2cc8c,tile:null};
function setFor(style){return SETS[style?.material]||SETS.timber}
function wallTint(style){return style?.stone&&style.wall&&(style.wall>>16&255)>(style.wall&255)+20?{MI_UnevenBrick:0xf3dfbd}:null}
// World size of one local unit along each axis, from the house group's scale.
function columns(len,world,door){let n=Math.max(1,Math.round(len*world/2.4));if(door){n=Math.max(3,n);if(n%2===0)n++}return n}
// One storey of four walls in `parent` (house group or a building-stories shell).
export function kitStorey(T,parent,{style,scale,door=false,list=[]}){
 const set=setFor(style),tint=wallTint(style),rows=Math.max(1,Math.round(3*scale.y/3.3)),rowH=3/rows;
 for(const [name,face] of Object.entries(FACES)){
  const world=name==='front'||name==='back'?scale.x:scale.z,hasDoor=door&&name==='front',n=columns(face.len,world,hasDoor);
  const doorW=hasDoor?KIT_W*DOOR_SX:0,w=(face.len-doorW)/(hasDoor?n-1:n);
  let u=-face.len/2;
  for(let c=0;c<n;c++){
   const isDoor=hasDoor&&c===(n-1)/2,cw=isDoor?doorW:w,centre=u+cw/2;u+=cw;const [x,z]=face.at(centre);
   // Wall pieces: exterior face on the old wall's outer face, 0.2 thick.
   const off=face.rot===0?[0,1]:face.rot===Math.PI?[0,-1]:face.rot>0?[1,0]:[-1,0],shift=-WALL_OUT*WALL_DEPTH;
   const px=x+off[0]*shift,pz=z+off[1]*shift,common={x:px,z:pz,rot:face.rot,sz:WALL_DEPTH,tint,list};
   if(isDoor){placePiece(T,parent,set.door,{...common,sx:DOOR_SX,sy:3/KIT_H});continue}
   for(let r=0;r<rows;r++){
    // Windows: every other column (centre for narrow faces); upper rows use slim windows.
    // Upper rows: windows on every other row only, to keep tall halls light on triangles.
    const windowed=(r===0||r%2===1)&&(n<3?c===Math.floor(n/2):c%2===1),pick=r===0?set.window:set.upper;
    const [wall,glass]=windowed?pick:[set.plain[(c+r)%set.plain.length],null];
    const piece={...common,y:r*rowH,sx:cw/KIT_W,sy:rowH/KIT_H};
    placePiece(T,parent,wall,piece);if(glass)placePiece(T,parent,glass,{...piece,tint:null});
   }
  }
 }
 // Corner posts hide the mitre where faces meet.
 // Posts stay about a metre thick in the world, whatever the house scale.
 const post=Math.min(.6,1.6/Math.max(scale.x,scale.z));
 if(set.corner)for(const [sx,sz,rot] of [[1,1,0],[-1,1,-Math.PI/2],[-1,-1,Math.PI],[1,-1,Math.PI/2]])
  placePiece(T,parent,set.corner,{x:sx*2.0,z:sz*1.92,rot,sx:post,sz:post,sy:1,tint,list});
 return list;
}
// Kit roof pitch: ridge at 3 + 3.73 × ROOF_SY = 5.24 (procedural ridge 4.40); KIT_ROOF_LIFT
// raises the hall clock and chapel bell towers (town.js) by the difference.
const ROOF_SY=.6;export const KIT_ROOF_LIFT=3+3.73*ROOF_SY-4.40;
// Gable roof over the 4 × 3.84 shell: ridge along Z (as the procedural roof), gables front and back.
export function kitRoof(T,parent,{style,type,list=[]}){
 const roofTint=ROOF_TINT[style?.roofKind]??null,sy=ROOF_SY,tint=roofTint==null?null:{MI_RoundTiles:roofTint};
 placePiece(T,parent,'roof_tile_4x4',{y:3.0,sz:3.84/4,sy,tint,list});
 for(const [z,rot] of [[1.92,0],[-1.92,Math.PI]])placePiece(T,parent,'roof_gable_4',{y:3.0,z,rot,sy,sz:.6,list});
 const chimney=type==='forge'?['chimney_brick',-1.05,-1.0,.9]:['chapel','hall'].includes(type)?null:['chimney_stone',1.1,-.7,.65];
 if(chimney)placePiece(T,parent,chimney[0],{x:chimney[1],y:3.4,z:chimney[2],sx:.8,sz:.8,sy:chimney[3],list});
 return list;
}
// Replaces the procedural door look with a kit leaf on the same pivot; the procedural leaf
// stays as the invisible click/collision target.
export function kitDoorLeaf(T,pivot,doorMesh){
 const leaf=new T.Group();leaf.name='kit-door';pivot.add(leaf);
 placePiece(T,leaf,'door_plank_flat',{sx:1.04/1.07,sy:3/KIT_H,sz:.9});
 for(const child of [...pivot.children])if(child!==doorMesh&&child!==leaf&&child.isMesh)child.visible=false;
 doorMesh.material=hiddenMaterial(T);return leaf;
}
let hidden=null;function hiddenMaterial(T){if(!hidden){hidden=new T.MeshBasicMaterial({visible:false});hidden.userData.eldervaleShared=true}return hidden}

// ---- Castle (KayKit Hexagon wall and tower, sized to the procedural masonry) ----
// castle_wall: 2.6 m thick, 7.6 m + crenels (≈8.8 m); castle_tower: r 4.6 m, 12.6 m;
// castle_gate: 9 × 7.6 m opening between ±4.5 (procedural leaves stay), side blocks 3.6 m thick.
const WALL_PIECE=16,WALL_HIGH=8.8;
// Masonry is sunk SINK m into the ground (same top) so slopes never show a gap under it.
const SINK=.6;
function wallRun(T,g,x0,x1,{height=8.8,depth=3.1,y=-SINK}={}){
 const len=x1-x0;if(len<=.05)return;const n=Math.max(1,Math.round(len/WALL_PIECE)),w=len/n;
 for(let i=0;i<n;i++)placePiece(T,g,'hex_wall',{x:x0+w*(i+.5),y,sx:w/WALL_PIECE,sy:height/WALL_HIGH,sz:depth/6.4});
}
export function kitCastle(T,g,id,d={},{gateLeaves}={}){
 if(!buildingKitReady())return false;
 if(id==='castle_wall'){const len=d.length||24;wallRun(T,g,-len/2,len/2,{height:8.8+SINK,depth:3.1});return true}
 if(id==='castle_tower'){const b=pieceBox('hex_tower_base');if(!b)return false;const w=Math.max(b.max.x-b.min.x,b.max.z-b.min.z),k=9.6/w;
  placePiece(T,g,'hex_tower_base',{x:-(b.min.x+b.max.x)/2*k,y:-SINK,z:-(b.min.z+b.max.z)/2*k,sx:k,sz:k,sy:(12.8+SINK)/(b.max.y-b.min.y)});return true}
 if(id==='castle_gate'){const len=d.length||28;
  for(const side of [-1,1]){const a=side*4.5,b=side*len/2;wallRun(T,g,Math.min(a,b),Math.max(a,b),{height:10.4+SINK,depth:3.6})}
  // Lintel over the opening: a short wall course from the leaf tops to the walkway.
  wallRun(T,g,-4.5,4.5,{y:7.6,height:2.8,depth:3.6});
  gateLeaves?.();return true}
 return false;
}
// Farm hut: a KayKit cottage scaled to the procedural hut's 4.4 × 3.6 footprint.
export function kitFarmHut(T,g){
 if(!buildingKitReady())return false;const b=pieceBox('house_small');if(!b)return false;
 const k=Math.min(4.4/(b.max.x-b.min.x),3.6/(b.max.z-b.min.z));
 placePiece(T,g,'house_small',{x:-(b.min.x+b.max.x)/2*k,z:-(b.min.z+b.max.z)/2*k,sx:k,sy:k,sz:k});return true;
}
export const KIT_FILES=FILES;
// Tests: install pieces as {id:[{geometry,material}]} (Float32 position/normal/uv) and mark ready.
export function installKitPieces(T,pieces){kit.pieces.clear();for(const [id,parts] of Object.entries(pieces)){const box=new T.Box3();for(const p of parts){p.geometry.computeBoundingBox();box.union(p.geometry.boundingBox)}kit.pieces.set(id,{parts,box})}kit.status='ready';kit.promise=Promise.resolve(true)}
export function resetKit(){kit.pieces.clear();kit.status='idle';kit.promise=null;kit.listeners.length=0}
