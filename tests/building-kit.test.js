// Kit building art (building-kit.js) must not change what the game measures: the house shell's
// footprint, the door opening and pivot, the castle gate leaves and the castle masonry extents.
// The GLBs need a browser to decode, so these tests install stand-in pieces with the real
// pieces' bounds from assets/buildings/catalog.json (door walls with their real opening).
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';
const version=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8').match(/\?v=([\w.-]+)'/)[1];
// Same module instance as castle-models.js / game.js import.
const kitModule=await import('../building-kit.js?v='+version);
const {installKitPieces,resetKit,kitStorey,kitRoof,kitDoorLeaf,kitCastle,kitFarmHut,KIT_ROOF_LIFT}=kitModule;
const {castleObject}=await import('../castle-models.js?v='+version);
const catalog=JSON.parse(fs.readFileSync(new URL('../assets/buildings/catalog.json',import.meta.url)));
const material=name=>Object.assign(new T.MeshStandardMaterial(),{name});
const box=(min,max)=>{const g=new T.BoxGeometry(max[0]-min[0],max[1]-min[1],max[2]-min[2]).toNonIndexed();g.translate((min[0]+max[0])/2,(min[1]+max[1])/2,(min[2]+max[2])/2);return g};
// Kit door walls: jambs either side of a 1.28 × 2.16 m opening and the wall above it (measured from the GLB).
const DOOR_WALL=[[[-1,0,-.31],[-.64,3.12,.09]],[[.64,0,-.31],[1,3.12,.09]],[[-1,2.16,-.31],[1,3.12,.09]]];
function install(){
 const pieces={};
 for(const p of catalog.pieces){
  const parts=/_door_flat$/.test(p.id)&&p.id.startsWith('wall_')?DOOR_WALL.map(([a,b])=>({geometry:box(a,b),material:material('wall')})):[{geometry:box(p.bounds_m.min,p.bounds_m.max),material:material(p.category)}];
  pieces[p.id]=parts;
 }
 installKitPieces(T,pieces);
}
const worldBox=objects=>{const b=new T.Box3();for(const o of objects){o.updateWorldMatrix(true,false);b.expandByObject(o)}return b};
const meshes=root=>{const out=[];root.traverse(o=>{if(o.isMesh)out.push(o)});return out};
const styles={stone:{material:'stone',stone:true,wall:0xa9a497,roofKind:'slate'},timber:{material:'timber',stone:false,roofKind:'thatch'},plank:{material:'plank',stone:false,roofKind:'shingle'}};
// House scales seen in the world: hamlet cottages to the castle's Great Hall (1.3 × 4.4).
const scales=[1.3,1.885,2.34,3.9,5.72];

test('kit walls stay on the procedural shell footprint at every building scale',()=>{
 install();
 for(const [name,style] of Object.entries(styles))for(const s of scales){
  const g=new T.Group();g.scale.set(s,s,s);const walls=kitStorey(T,g,{style,scale:{x:s,y:s,z:s},door:true,list:[]});
  assert.ok(walls.length>=12,name+' '+s+' builds walls');
  const b=worldBox(walls),u=b.clone().applyMatrix4(new T.Matrix4().makeScale(1/s,1/s,1/s));
  // Old shell: outer faces x ±2.00, z ±1.92, wall tops at 3.0. Corner posts may stand proud by a hand.
  assert.ok(u.min.x>=-2.2&&u.max.x<=2.2,`${name} ${s}: x ${u.min.x.toFixed(2)}..${u.max.x.toFixed(2)}`);
  assert.ok(u.min.z>=-2.12&&u.max.z<=2.12,`${name} ${s}: z ${u.min.z.toFixed(2)}..${u.max.z.toFixed(2)}`);
  assert.ok(u.min.y>=-.01&&u.max.y<=3.05,`${name} ${s}: y ${u.min.y.toFixed(2)}..${u.max.y.toFixed(2)}`);
  // The walk-in room (interior batching box, ±1.83 × ±1.75 below 2.95) stays clear of wall pieces,
  // except window glass that sits in the wall thickness.
  for(const m of walls){if(/window_|corner/.test(m.name))continue;const mb=worldBox([m]).applyMatrix4(new T.Matrix4().makeScale(1/s,1/s,1/s));
   const inside=mb.min.x>-1.7&&mb.max.x<1.7&&mb.min.z>-1.62&&mb.max.z<1.62;assert.ok(!inside,`${name} ${s}: ${m.name} intrudes into the room`)}
 }
 resetKit();
});

test('the kit door opening matches the procedural door: ±.52 wide, clear to 1.78, leaf on the same pivot',()=>{
 install();
 for(const s of scales){
  const g=new T.Group();const walls=kitStorey(T,g,{style:styles.timber,scale:{x:s,y:s,z:s},door:true,list:[]});g.updateMatrixWorld(true);
  const ray=new T.Raycaster();
  // Walk straight through the doorway (local frame): nothing may be hit inside the old opening.
  for(const x of [-.5,-.25,0,.25,.5])for(const y of [.05,.6,1.2,1.75]){
   ray.set(new T.Vector3(x,y,3),new T.Vector3(0,0,-1));ray.far=1.6;
   const hits=ray.intersectObjects(walls,false);assert.equal(hits.length,0,`scale ${s}: door blocked at x=${x} y=${y} by ${hits[0]?.object.name}`);
  }
  // Just outside the opening the wall is solid.
  ray.set(new T.Vector3(.75,1,3),new T.Vector3(0,0,-1));ray.far=1.6;assert.ok(ray.intersectObjects(walls,false).length>0,'jamb beside the door');
 }
 const pivot=new T.Group();pivot.position.set(-.52,0,1.86);const leafMesh=new T.Mesh(new T.BoxGeometry(1.04,1.75,.13),new T.MeshStandardMaterial());leafMesh.position.set(.52,.9,0);pivot.add(leafMesh);
 const leaf=kitDoorLeaf(T,pivot,leafMesh);
 assert.equal(leafMesh.parent,pivot,'procedural leaf stays the click target');assert.equal(leafMesh.material.visible,false);
 const lb=worldBox(meshes(leaf));// Pivot at x=-.52: the leaf fills the ±.52 opening from its hinge.
 assert.ok(lb.min.x>=-.58&&lb.max.x<=.54&&lb.max.x>=.48,`kit leaf spans the opening from the hinge: ${lb.min.x.toFixed(2)}..${lb.max.x.toFixed(2)}`);
 resetKit();
});

test('kit roof and storey hooks keep roof parts liftable and the hall/chapel towers above the ridge',()=>{
 install();
 const g=new T.Group(),list=[];kitRoof(T,g,{style:styles.stone,type:'cottage',list});
 assert.ok(list.length>=3&&list.every(m=>m.parent===g&&!Object.keys(m.userData).length),'roof meshes are plain children (merged into house-roof)');
 const b=worldBox(list);assert.ok(b.max.y<=3+3.73*.6+.05+2.5,'roof height bounded');assert.ok(Math.abs(KIT_ROOF_LIFT-.838)<.01);
 resetKit();
});

test('castle masonry keeps the gate leaves, the opening and the procedural extents',()=>{
 install();
 for(const length of [28,16]){
  const g=new T.Group();castleObject(T,g,'castle_gate',{length});
  assert.ok(g.userData.leftGate&&g.userData.rightGate,'animated leaves kept');
  assert.equal(g.userData.leftGate.position.x,-4.5);assert.equal(g.userData.rightGate.position.x,4.5);
  const leaves=new Set([...meshes(g.userData.leftGate),...meshes(g.userData.rightGate)]);
  const masonry=meshes(g).filter(m=>!leaves.has(m));const b=worldBox(masonry);
  assert.ok(b.min.x>=-length/2-.05&&b.max.x<=length/2+.05,'gate stays within its length');
  // The 9 × 7.6 m opening between the leaves is clear.
  const ray=new T.Raycaster();for(const x of [-4,-2,0,2,4])for(const y of [.5,3.8,7.2]){ray.set(new T.Vector3(x,y,8),new T.Vector3(0,0,-1));ray.far=16;assert.equal(ray.intersectObjects(masonry,false).length,0,`gate ${length}: opening blocked at ${x},${y}`)}
 }
 const wall=new T.Group();castleObject(T,wall,'castle_wall',{length:24});const wb=worldBox(meshes(wall));
 assert.ok(Math.abs(wb.min.x+12)<.05&&Math.abs(wb.max.x-12)<.05,'wall spans its 24 m length');assert.ok(wb.max.z-wb.min.z<=3.2,'wall no thicker than the walkway (3.1 m)');assert.ok(wb.max.y<=9.5,'wall height ≈ procedural crenels');
 const tower=new T.Group();castleObject(T,tower,'castle_tower',{});const tb=worldBox(meshes(tower));
 assert.ok(tb.max.x-tb.min.x<=9.7&&tb.max.z-tb.min.z<=9.7,'tower within the 4.6 m radius drum (+crown)');assert.ok(tb.max.y<=13,'tower no taller than 13 m');
 const hut=new T.Group();assert.ok(kitFarmHut(T,hut));const hb=worldBox(meshes(hut));assert.ok(hb.max.x-hb.min.x<=4.45&&hb.max.z-hb.min.z<=3.65,'farm hut within 4.4 × 3.6');
 resetKit();
});

test('without the kit the castle and houses stay procedural (fallback)',()=>{
 resetKit();assert.equal(kitModule.buildingKitReady(),false);
 const g=new T.Group();castleObject(T,g,'castle_wall',{length:24});assert.ok(meshes(g).every(m=>!m.name.startsWith('kit:')));
 assert.equal(kitCastle(T,new T.Group(),'castle_wall',{}),false);
});

test('arrival cutscene camera rays do not cross kit castle masonry or the Great Hall shell',async()=>{
 install();
 const {castleBlueprint}=await import('../castle-layout.js?v='+version);const {cutscenes}=await import('../cutscenes.js?v='+version);
 const scene=new T.Scene();
 for(const d of castleBlueprint()){
  if(!/^castle_/.test(d.template))continue;const root=new T.Group();root.position.set(d.x,0,d.z);root.rotation.y=(d.yaw||0)*Math.PI/180;root.scale.setScalar(d.scale||1);scene.add(root);castleObject(T,root,d.template,d);
 }
 // Buildings: kit shells at the blueprint's scale, as house() lays them out (no terrain: y = 0).
 for(const d of castleBlueprint()){
  if(!['cottage','bank','inn','forge'].includes(d.template))continue;const s=1.3*(d.scale||1),g=new T.Group();g.position.set(d.x,0,d.z);g.rotation.y=(d.yaw||0)*Math.PI/180;g.scale.setScalar(s);scene.add(g);
  kitStorey(T,g,{style:styles.stone,scale:{x:s,y:s,z:s},door:true,list:[]});kitRoof(T,g,{style:styles.stone,type:'hall',list:[]});
 }
 scene.updateMatrixWorld(true);
 const fixed=cutscenes.arrival.steps.filter(s=>s.shot?.eye);assert.ok(fixed.length>=2);
 for(const {shot} of fixed){const eye=new T.Vector3(...shot.eye),look=new T.Vector3(...shot.look);const ray=new T.Raycaster(eye,look.clone().sub(eye).normalize(),0,eye.distanceTo(look)-1);
  const hit=ray.intersectObjects(scene.children,true)[0];assert.equal(hit,undefined,`shot ${shot.eye} blocked by ${hit?.object.name}`)}
 resetKit();
});
