import * as T from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import {buildHumanoid} from './humanoid.js';
import {buildPlateArmor} from './armor.js';
import {createCape} from './cape.js';
import {weaponCatalog,makeWeapon,iconForWeapon} from './weapons.js';
import {shieldCatalog,makeShield} from './shields.js';
const appearance=(()=>{try{return JSON.parse(localStorage.getItem('eldervale-save')||'{}').appearance||{}}catch{return {}}})();
const tint=(hex,fallback)=>/^#[0-9a-f]{6}$/i.test(hex||'')?parseInt(hex.slice(1),16):fallback;
const skin=tint(appearance.skin,0xd9a783),shirt=tint(appearance.shirt,0x315b76),pants=tint(appearance.pants,0x424750),hairColor=tint(appearance.hairColor,0x3b2b22);
const scene=new T.Scene();scene.background=new T.Color(0x9dbbc2);scene.fog=new T.Fog(0x9dbbc2,105,255);
const camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.1,450),renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;document.body.prepend(renderer.domElement);
scene.add(new T.HemisphereLight(0xcfe4ff,0x5a4d33,2));const sun=new T.DirectionalLight(0xffe9b6,2.3);sun.position.set(12,25,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
// Seeded procedural canvas textures, cached and shared across meshes.
const textureCache=new Map();
function texture(kind,base){const key=kind+base;if(textureCache.has(key))return textureCache.get(key);const canvas=document.createElement('canvas');const groundKind=kind==='grass'||kind==='dirt';const texSize=groundKind?256:128;canvas.width=texSize;canvas.height=texSize;const ctx=canvas.getContext('2d');ctx.fillStyle='#'+base.toString(16).padStart(6,'0');ctx.fillRect(0,0,texSize,texSize);let seed=base>>>0;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
for(let i=0;i<750;i++){const x=rnd()*128,y=rnd()*128,r=.4+rnd()*2.7;ctx.fillStyle=rnd()>.5?'rgba(255,248,208,.075)':'rgba(18,27,18,.09)';ctx.fillRect(x,y,r,r)}
if(kind==='wood'){for(let i=0;i<22;i++){ctx.strokeStyle=i%2?'#ffffff16':'#130d0b24';ctx.lineWidth=.5+rnd()*1.6;ctx.beginPath();const y=i*6+rnd()*3;ctx.moveTo(0,y);ctx.bezierCurveTo(36,y+3,78,y-3,128,y+2);ctx.stroke()}}
if(kind==='stone'){for(let i=0;i<20;i++){ctx.strokeStyle='#18201b23';ctx.beginPath();const x=rnd()*128,y=rnd()*128;ctx.moveTo(x,y);ctx.lineTo(x+5+rnd()*17,y+2+rnd()*9);ctx.stroke()}}
if(kind==='grass'){
 // Higher-frequency detail remains readable at gameplay camera distance.
 for(let i=0;i<7200;i++){
  const x=rnd()*texSize,y=rnd()*texSize,length=2+rnd()*8;
  ctx.strokeStyle=rnd()>.53?'rgba(198,221,147,.29)':'rgba(38,78,43,.27)';
  ctx.lineWidth=.55+rnd()*.9;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rnd()-.5)*3,y-length);ctx.stroke()
 }
 for(let i=0;i<460;i++){ctx.fillStyle=rnd()>.5?'#bdc89b66':'#395b3e77';ctx.fillRect(rnd()*texSize,rnd()*texSize,1+rnd()*2,1+rnd()*2)}
}
if(kind==='dirt'){
 for(let i=0;i<4200;i++){const x=rnd()*texSize,y=rnd()*texSize,r=.5+rnd()*2.5;ctx.fillStyle=rnd()>.5?'#3c322144':'#f3d6a742';ctx.beginPath();ctx.ellipse(x,y,r,r*.6,rnd()*6,0,Math.PI*2);ctx.fill()}
 for(let i=0;i<210;i++){ctx.strokeStyle='#52432a4a';ctx.lineWidth=.7+rnd();const x=rnd()*texSize,y=rnd()*texSize;ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+2+rnd()*8,y+1+rnd()*4);ctx.stroke()}
}
if(kind==='leaf'){for(let i=0;i<180;i++){const x=rnd()*128,y=rnd()*128;ctx.fillStyle=rnd()>.5?'#d6e5a124':'#122b1b30';ctx.beginPath();ctx.ellipse(x,y,1+rnd()*4,1+rnd()*2,rnd()*6,0,Math.PI*2);ctx.fill()}}
if(kind==='roof'){for(let y=0;y<128;y+=15){ctx.strokeStyle='#160f0c44';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();for(let x=(y%30?8:0);x<128;x+=24){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+15);ctx.stroke()}}}
const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=groundKind?Math.min(8,renderer.capabilities.getMaxAnisotropy()):4;textureCache.set(key,t);return t}
const materialCache=new Map();function material(c,kind='stone'){const key=c+kind;if(!materialCache.has(key))materialCache.set(key,new T.MeshLambertMaterial({map:texture(kind,c),color:0xffffff}));return materialCache.get(key)}const targets=[];
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
function box(w,h,d,c,x,y,z,p=scene,kind='stone'){const o=new T.Mesh(new T.BoxGeometry(w,h,d),material(c,kind));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o}
function sphere(r,c,x,y,z,p=scene){const o=new T.Mesh(new T.SphereGeometry(r,10,8),material(c));o.position.set(x,y,z);o.castShadow=true;p.add(o);return o}
function cone(r,h,c,x,y,z,p=scene,kind='leaf'){const o=new T.Mesh(new T.ConeGeometry(r,h,7),material(c,kind));o.position.set(x,y,z);o.castShadow=true;p.add(o);return o}
const groundTexture=texture('grass',0x69865b).clone();
groundTexture.repeat.set(210,210);groundTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());groundTexture.needsUpdate=true;
const ground=new T.Mesh(new T.PlaneGeometry(840,840),new T.MeshLambertMaterial({map:groundTexture}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const dirtTexture=texture('dirt',0xa38b64).clone();dirtTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());dirtTexture.needsUpdate=true;
const pathMaterial=new T.MeshLambertMaterial({map:dirtTexture,color:0xffffff,polygonOffset:true,polygonOffsetFactor:-1});
function texturedPatch(radius,x,z,tint=0x789362){
 const geom=new T.CircleGeometry(radius,24),mat=new T.MeshLambertMaterial({color:tint,transparent:true,opacity:.30,depthWrite:false});
 const patch=new T.Mesh(geom,mat);patch.rotation.x=-Math.PI/2;patch.position.set(x,.013,z);scene.add(patch)
}
function disk(r,c,x,z){const m=new T.Mesh(new T.CircleGeometry(r,28),material(c));m.rotation.x=-Math.PI/2;m.position.set(x,.018,z);scene.add(m)}
function trail(ax,az,bx,bz,width=2.7){const len=Math.hypot(bx-ax,bz-az);const pathMap=dirtTexture.clone();pathMap.repeat.set(Math.max(1,width/3),Math.max(1,len/3));pathMap.needsUpdate=true;const m=new T.Mesh(new T.PlaneGeometry(width,len),new T.MeshLambertMaterial({map:pathMap}));m.rotation.x=-Math.PI/2;m.rotation.z=-Math.atan2(bx-ax,bz-az);m.position.set((ax+bx)/2,.025,(az+bz)/2);scene.add(m)}
trail(0,0,-60,45);trail(0,0,75,-55);trail(0,0,105,103);trail(-60,45,-105,-91);texturedPatch(13,0,0,0x8a9870);
for(let i=0;i<480;i++){const a=i*2.399963,r=8+Math.sqrt(i)*9.1,x=Math.sin(a)*r,z=Math.cos(a)*r;if(Math.abs(x)<410&&Math.abs(z)<410){const g=box(.11,.14,.11,i%3?0x79955b:0x9baa70,x,.08,z);g.rotation.y=a}}
// Draw-call-efficient tufts add near-ground depth without thousands of meshes.
const tuftGeometry=new T.ConeGeometry(.095,.32,3);
const tuftMaterial=new T.MeshLambertMaterial({color:0x789b58,side:T.DoubleSide});
const tuftCount=1600,tufts=new T.InstancedMesh(tuftGeometry,tuftMaterial,tuftCount);
const tuftDummy=new T.Object3D();
for(let i=0;i<tuftCount;i++){
 const angle=i*2.3999632297,radius=10+Math.sqrt(i)*9.5;
 const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
 tuftDummy.position.set(x,.12,z);tuftDummy.rotation.set(0,i*2.17,0);
 const size=.7+(Math.sin(i*1.37)*.5+.5)*.9;tuftDummy.scale.set(size,size,size);tuftDummy.updateMatrix();tufts.setMatrixAt(i,tuftDummy.matrix)
}
tufts.instanceMatrix.needsUpdate=true;tufts.frustumCulled=false;scene.add(tufts);
for(let i=0;i<38;i++){const a=i*2.4,r=17+i*3.8,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x)<405&&Math.abs(z)<405){const stone=sphere(.3+i%3*.12,0x8d8e7c,x,.16,z);stone.scale.y=.5}}
function tree(x,z){
 const seed=Math.abs(Math.sin(x*12.9898+z*78.233));
 const trunk=box(.53,3.7,.53,0x65472f,x,1.85,z,scene,'wood');trunk.rotation.y=seed*2;
 for(let i=0;i<3;i++){const branch=box(.12,1.1,.12,0x65472f,x+(i-1)*.42,3.25+i*.38,z+(i%2?.3:-.3),scene,'wood');branch.rotation.z=(i-1)*.65}
 const crownColors=[0x356f47,0x3f8051,0x4c8952,0x2e6846];
 const hit=cone(2.35,3.6,crownColors[Math.floor(seed*4)],x,4.0,z);hit.userData={kind:'tree',x,z};targets.push(hit);
 cone(1.9,2.9,crownColors[(Math.floor(seed*4)+1)%4],x,5.25,z);
 cone(1.25,2.4,crownColors[(Math.floor(seed*4)+2)%4],x,6.35,z);
 for(let i=0;i<4;i++){const a=i*2.4+seed*4;const leaf=cone(.65,1.2,crownColors[i],x+Math.cos(a)*1.15,4.2+i*.24,z+Math.sin(a)*1.15);leaf.rotation.z=Math.cos(a)*.28}
}
function rock(x,z){
 const root=new T.Group();root.position.set(x,0,z);scene.add(root);
 const color=[0x777b78,0x898b7d,0x676f6c][Math.floor(Math.abs(Math.sin(x+z))*3)];
 const m=new T.Mesh(new T.DodecahedronGeometry(.9,0),material(color,'stone'));m.position.y=.57;m.scale.set(1.15,.75,1);m.rotation.y=x*.1;m.castShadow=true;m.receiveShadow=true;root.add(m);
 const smaller=new T.Mesh(new T.DodecahedronGeometry(.36,0),material(0x6f7770,'stone'));smaller.position.set(.68,.24,.18);smaller.castShadow=true;root.add(smaller);
 m.userData={kind:'rock',x,z};targets.push(m)
}
const houseInteriors=[];const mapProps=[];
function house(x,z,c,scale=1.65,rotation=0){
 const group=new T.Group();group.position.set(x,0,z);group.scale.setScalar(scale);group.rotation.y=rotation;scene.add(group);
 // Real walk-in room, with a front doorway instead of a solid wall block.
 box(4,.12,3.7,0x81684c,0,.065,0,group,'wood');
 box(4,3,.18,c,0,1.5,-1.83,group,'stone');
 for(const side of [-1,1])box(.18,3,3.7,c,side*1.91,1.5,0,group,'stone');
 for(const side of [-1,1])box(1.48,3,.18,c,side*1.26,1.5,1.83,group,'stone');
 box(1.04,.75,.18,c,0,2.625,1.83,group,'stone');
 const roofParts=[];
 for(const side of [-1,1]){
  box(.18,3.15,.2,0x715139,side*1.94,1.55,1.83,group,'wood');
  box(.18,3.15,.2,0x715139,side*1.94,1.55,-1.83,group,'wood')
 }
 roofParts.push(box(4.25,.18,3.9,0x74543c,0,3.07,0,group,'wood'));
 // Roof geometry: ridge x=0 at y=4.40; eaves x=±2.25 at y=3.12.
 // Slopes descend away from the ridge, meeting cleanly at the center.
 const roofRun=2.25,roofRise=1.28,roofLength=Math.hypot(roofRun,roofRise);
 const roofAngle=Math.atan2(roofRise,roofRun);
 for(const side of [-1,1]){
  const roof=box(roofLength+.04,.16,4.35,0x634332,side*roofRun/2,3.12+roofRise/2,0,group,'roof');
  roof.rotation.z=-side*roofAngle;roofParts.push(roof);
  // Thin wooden fascia follows the actual eave rather than floating above it.
  const fascia=box(.18,.23,4.45,0x644a32,side*roofRun,3.11,0,group,'wood');roofParts.push(fascia);
 }
 // Close the triangular gable walls under the roof at front and back.
 for(const z of [-1.87,1.87]){
  const shape=new T.Shape();shape.moveTo(-2,3.08);shape.lineTo(2,3.08);shape.lineTo(0,4.21);shape.closePath();
  const gable=new T.Mesh(new T.ShapeGeometry(shape),material(c,'stone'));gable.position.z=z;gable.material.side=T.DoubleSide;gable.castShadow=true;group.add(gable);roofParts.push(gable);
 }
 // Hinged, clickable door. A closed door blocks entry.
 box(1.1,.14,.22,0x67452f,0,1.8,1.92,group,'wood');
 const doorPivot=new T.Group();doorPivot.position.set(-.52,0,1.86);group.add(doorPivot);
 const doorMesh=box(1.04,1.75,.13,0x654026,.52,.9,0,doorPivot,'wood');
 box(.12,.12,.09,0xc4a15d,.88,.93,.1,doorPivot,'stone');
 const doorHit=new T.Mesh(new T.BoxGeometry(1.15,1.95,.5),new T.MeshBasicMaterial({visible:false}));
 doorHit.position.set(0,.95,1.86);group.add(doorHit);
 const houseRecord={group,roofParts,inside:false,open:false,doorPivot,doorHit};
 doorHit.userData={kind:'door',house:houseRecord};
 doorMesh.userData={kind:'door',house:houseRecord};targets.push(doorMesh);
 for(const side of [-1,1]){
  box(.79,.82,.12,0x89aeb8,side*1.25,1.92,1.92,group);
  box(.1,.91,.17,0x614832,side*1.25,1.92,2.02,group,'wood');
  box(.85,.10,.17,0x614832,side*1.25,1.92,2.02,group,'wood')
 }
 roofParts.push(box(.4,1.2,.4,0x76665b,1.1,4.35,-.7,group,'stone'));
 houseInteriors.push(houseRecord);
 for(let i=0;i<4;i++)box(.36,.21,.29,0x858479,-1.55+i*.95,.12,1.96,group,'stone');
}
for(let i=0;i<520;i++){const a=i*2.399,r=14+Math.sqrt(i)*17,x=Math.sin(a)*r,z=Math.cos(a)*r;if(i%4===0)rock(x,z);else tree(x,z)}
// Oakcross: a walkable settlement, with a clear central square and houses around its edges.
const villageBuildings=[
 [-16,-13,0xb8a480,1.65,.18],[-5,-18,0x9d967f,1.7,0],[9,-17,0xc1aa82,1.65,-.1],
 [20,-8,0xb4a48d,1.65,-.3],[21,9,0xa7a18c,1.75,-.2],
 [13,22,0xb8a78b,1.65,Math.PI],[-1,24,0xb9a58b,1.75,Math.PI],
 [-17,17,0xaaa38a,1.65,2.9],[-23,2,0xbca98d,1.7,Math.PI/2],
 [-30,-19,0xa6a18c,1.7,.35],[32,21,0xbca88a,1.65,-.35]
];
for(const [x,z,c,scale,rot] of villageBuildings)house(x,z,c,scale,rot);
house(-60,42,0xb7a08c);house(-54,48,0xaaa38a);house(73,-58,0xc3b29b);house(78,-51,0x99866c);house(-105,-91,0x9a9b87);house(102,103,0xb8a48d);house(-210,145,0xbda78a);house(-205,151,0xa8a089);house(260,-185,0xbda78a);house(265,-180,0xaaa08a);house(225,215,0xbaa78e);house(-275,-215,0xbda88d);

const places=[['Oakcross',0,0],['Northwatch',-60,45],['Eastmarch',75,-55],['Old Cairn',132,26],['Farwatch',105,103],['Westmere',-210,145],['Suncrest',260,-185],['Greenwatch',225,215],['Ashen Ruins',-275,-215]];
// Lakeside settlements and landmarks. Water is a visible, discoverable world feature.
const worldLakes=[{x:-91,z:80,rx:18,rz:12,name:'Moonmere Lake'},{x:157,z:77,rx:24,rz:16,name:'Silverfin Lake'},{x:244,z:175,rx:16,rz:12,name:'Greenwatch Pond'}];
for(const lake of worldLakes){
 const water=new T.Mesh(new T.CircleGeometry(1,64),new T.MeshStandardMaterial({color:0x397f91,metalness:.18,roughness:.27,transparent:true,opacity:.9,side:T.DoubleSide}));
 water.rotation.x=-Math.PI/2;water.scale.set(lake.rx,lake.rz,1);water.position.set(lake.x,.065,lake.z);scene.add(water);
 const shore=new T.Mesh(new T.RingGeometry(.98,1.09,64),new T.MeshStandardMaterial({color:0xb6a47a,roughness:1,side:T.DoubleSide}));
 shore.rotation.x=-Math.PI/2;shore.scale.set(lake.rx,lake.rz,1);shore.position.set(lake.x,.045,lake.z);scene.add(shore);
 for(let i=0;i<12;i++){const a=i*Math.PI/6;const x=lake.x+Math.cos(a)*lake.rx*1.13,z=lake.z+Math.sin(a)*lake.rz*1.13;if(i%3===0)rock(x,z);else if(i%3===1)tree(x,z)}
 // Wooden fishing dock reaches from the eastern bank toward the lake.
 const dx=lake.x+lake.rx*.88;
 box(5,.22,2.4,0x8b6542,dx,.32,lake.z,scene,'wood');
 for(const x of [dx-2,dx+2])for(const z of [lake.z-1,lake.z+1])box(.2,.75,.2,0x5a402d,x,.35,z,scene,'wood');
 mapProps.push({x:dx,z:lake.z,color:'#e5c37c'});
}
const extraSettlements=[
 {name:'Moonmere',x:-114,z:82,color:0xb4a18a},
 {name:'Silverfin',x:187,z:74,color:0xc3ae92},
 {name:'Pinehollow',x:-152,z:-133,color:0xa79e8a},
 {name:'Stonebridge',x:164,z:-116,color:0xb7a58b}
];
for(const town of extraSettlements){
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5+.3,r=9+(i%2)*5;house(town.x+Math.cos(a)*r,town.z+Math.sin(a)*r,town.color,1.4,a+Math.PI)}
 places.push([town.name,town.x,town.z]);
}
// Oakcross starter armory: a one-time supply chest in the northern house.
const armoryHouse=houseInteriors[1];
const chestRoot=new T.Group();armoryHouse.group.add(chestRoot);
chestRoot.position.set(0,0,-.65);
box(1.15,.66,.73,0x6e4325,0,.43,0,chestRoot,'wood');
box(1.24,.17,.81,0xa47a3f,0,.82,0,chestRoot,'wood');
for(const x of [-.48,.48]){box(.10,.79,.82,0xb6a069,x,.45,0,chestRoot,'stone')}
box(.22,.24,.09,0xe0b866,0,.63,.43,chestRoot,'stone');
const chestLid=new T.Group();chestLid.position.set(0,.85,-.36);chestRoot.add(chestLid);
box(1.2,.22,.75,0x85552c,0,.05,.36,chestLid,'wood');
const chestHit=new T.Mesh(new T.BoxGeometry(1.65,1.3,1.25),new T.MeshBasicMaterial({visible:false}));
chestHit.position.set(0,.7,0);chestRoot.add(chestHit);
const chestWorld=new T.Vector3();chestRoot.getWorldPosition(chestWorld);
chestHit.userData={kind:'chest',x:chestWorld.x,z:chestWorld.z};
targets.push(chestHit);
function openArmoryChest(){
 if(state.starterChestClaimed){say('The armory chest is empty. You have already collected its supplies.');return}
 state.starterChestClaimed=true;
 for(const key of armorKeys)if(!state.armorOwned.includes(key))state.armorOwned.push(key);
 for(const key of Object.keys(weaponCatalog))if(!state.weaponsOwned.includes(key))state.weaponsOwned.push(key);
 for(const key of Object.keys(shieldCatalog))if(!state.shieldsOwned.includes(key))state.shieldsOwned.push(key);
 state.starterShieldsGranted=true;
 chestLid.rotation.x=-1.1;
 say('Armory chest opened! Iron armor, a crimson cape, four swords, an axe and a pickaxe, an iron kiteshield and an iron square shield added to your inventory.');
 save();draw();
}
function toggleHouseDoor(house){
 house.open=!house.open;
 house.doorPivot.rotation.y=house.open?-Math.PI*.53:0;
 say(house.open?'You open the wooden door.':'You close the wooden door.');
}
function houseLocal(h,p){return h.group.worldToLocal(p.clone())}
function housePoint(h,x,z){return h.group.localToWorld(new T.Vector3(x,0,z))}
function insideHouse(h,p){const q=houseLocal(h,p);return Math.abs(q.x)<1.92&&Math.abs(q.z)<1.82}
function walkAllowed(from,to){
 // Swept movement sampled at sub-character intervals prevents tunneling through thin walls.
 const distance=from.distanceTo(to),samples=Math.max(1,Math.ceil(distance/.18));
 for(const h of houseInteriors){
  const a=houseLocal(h,from),b=houseLocal(h,to);
  const radius=.26,limitX=1.91+radius,limitZ=1.83+radius;
  let previous=a;
  for(let i=1;i<=samples;i++){
   const q=a.clone().lerp(b,i/samples);
   const inFootprint=Math.abs(q.x)<limitX&&Math.abs(q.z)<limitZ;
   if(!inFootprint){previous=q;continue}
   const interior=Math.abs(q.x)<1.91-radius&&Math.abs(q.z)<1.83-radius;
   const prevInterior=Math.abs(previous.x)<1.91-radius&&Math.abs(previous.z)<1.83-radius;
   if(interior&&prevInterior){previous=q;continue}
   // The front entrance is the only permitted crossing.
   const doorway=Math.abs(q.x)<.49&&Math.abs(previous.x)<.49;
   const nearFront=q.z>1.20&&previous.z>1.20;
   if(h.open&&doorway&&nearFront){previous=q;continue}
   return {blocked:true,house:h,doorway};
  }
 }
 return {blocked:false};
}
// Lightweight A* on a local 1.5m grid. Replans on goal changes, not every frame.
function findWalkPath(start,goal,maxCells=14000){
 if(walkAllowed(start,goal).blocked===false)return [goal.clone()];
 const cell=1.0,margin=30,originX=Math.min(start.x,goal.x)-margin,originZ=Math.min(start.z,goal.z)-margin;
 const cols=Math.min(480,Math.ceil((Math.abs(start.x-goal.x)+margin*2)/cell)+1);
 const rows=Math.min(480,Math.ceil((Math.abs(start.z-goal.z)+margin*2)/cell)+1);
 const coord=p=>[Math.max(0,Math.min(cols-1,Math.round((p.x-originX)/cell))),Math.max(0,Math.min(rows-1,Math.round((p.z-originZ)/cell)))];
 const point=(x,z)=>new T.Vector3(originX+x*cell,0,originZ+z*cell);
 const [sx,sz]=coord(start),[gx,gz]=coord(goal);
 const key=(x,z)=>z*cols+x;
 const startKey=key(sx,sz),goalKey=key(gx,gz);
 const nodes=new Map([[startKey,{x:sx,z:sz,g:0,f:0,prev:null}]]),open=[startKey],closed=new Set();
 const directions=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
 let best=startKey,bestH=Infinity,iterations=0;
 while(open.length&&iterations++<maxCells){
  let at=0;for(let j=1;j<open.length;j++)if(nodes.get(open[j]).f<nodes.get(open[at]).f)at=j;
  const id=open.splice(at,1)[0],n=nodes.get(id);if(closed.has(id))continue;closed.add(id);
  const h=Math.hypot(n.x-gx,n.z-gz);
  if(h<bestH){bestH=h;best=id}
  if(id===goalKey)break;
  for(const [dx,dz] of directions){
   const x=n.x+dx,z=n.z+dz;if(x<0||z<0||x>=cols||z>=rows)continue;
   const nid=key(x,z);if(closed.has(nid))continue;
   if(walkAllowed(point(n.x,n.z),point(x,z)).blocked)continue;if(dx&&dz&&(walkAllowed(point(n.x,n.z),point(n.x+dx,n.z)).blocked||walkAllowed(point(n.x,n.z),point(n.x,n.z+dz)).blocked))continue;
   const g=n.g+Math.hypot(dx,dz),existing=nodes.get(nid);
   if(!existing||g<existing.g){nodes.set(nid,{x,z,g,f:g+Math.hypot(x-gx,z-gz),prev:id});open.push(nid)}
  }
 }
 if(best!==goalKey)return [];if(best===startKey)return [];
 const result=[];let id=best;
 while(id!==startKey&&result.length<100){const n=nodes.get(id);result.push(point(n.x,n.z));id=n.prev;if(id==null)break}
 result.reverse();
 // Replace grid zigzags with long straight, collision-checked walking segments.
 const smooth=[];let anchor=start;for(let i=0;i<result.length;){let furthest=i;for(let j=result.length-1;j>i;j--){if(!walkAllowed(anchor,result[j]).blocked){furthest=j;break}}smooth.push(result[furthest]);anchor=result[furthest];i=furthest+1}result.splice(0,result.length,...smooth);
 if(best===goalKey&&!walkAllowed(result[result.length-1]||start,goal).blocked)result.push(goal.clone());
 return result;
}

function routeTo(target){
 const goal=target.clone();goal.y=0;
 const h=houseInteriors.find(h=>insideHouse(h,goal));
 if(h&&!insideHouse(h,player.position)){
  const door=housePoint(h,0,2.48),threshold=housePoint(h,0,1.08);
  if(!h.open){say('The door is closed. Click the door to open it.');return player.position.clone()}
  // Enter through the doorway, then continue to the clicked destination.
  walkQueue=[threshold,goal];return door;
 }
 const current=houseInteriors.find(h=>insideHouse(h,player.position));
 if(current&&!insideHouse(current,goal)){
  const threshold=housePoint(current,0,1.08),door=housePoint(current,0,2.48);
  if(!current.open){say('Open the door before leaving.');return player.position.clone()}
  walkQueue=[door,goal];return threshold;
 }
 return goal;
}
let walkQueue=[];
function setWalkDestination(point){
 const target=routeTo(point);
 const stops=[target,...walkQueue];
 walkQueue=[];
 const all=[];
 let current=player.position.clone();
 for(const stop of stops){
  const path=findWalkPath(current,stop);
  if(!path.length&&current.distanceTo(stop)>.4){say('That destination is currently unreachable.');break}
  all.push(...path);current=stop;
 }
 dest=all.shift()||null;walkQueue=all;
}

function updateHouseRoofs(){
 for(const house of houseInteriors){
  const local=house.group.worldToLocal(player.position.clone());
  const inside=Math.abs(local.x)<1.93&&Math.abs(local.z)<1.84;
  if(inside!==house.inside){house.inside=inside;for(const part of house.roofParts)part.visible=!inside}
 }
}
// Shared scenery primitives: low-poly timber, market awnings, wells and village clutter.
function villageCrate(x,z,rotation=0){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;scene.add(g);
 box(.9,.75,.85,0x8c653f,0,.39,0,g,'wood');
 for(const side of [-1,1]){box(.09,.8,.92,0x63452e,side*.42,.4,0,g,'wood');box(.95,.09,.91,0x64462d,0,side*.33+.4,0,g,'wood')}
}
function villageBarrel(x,z){const g=new T.Group();g.position.set(x,0,z);scene.add(g);
 const b=new T.Mesh(new T.CylinderGeometry(.38,.34,.9,9),material(0x765235,'wood'));b.position.y=.48;b.castShadow=true;g.add(b);
 for(const y of [.17,.75]){const band=new T.Mesh(new T.CylinderGeometry(.392,.392,.065,9),material(0x626361,'stone'));band.position.y=y;g.add(band)}
}
function marketStall(x,z,cloth=0x8e563f){const g=new T.Group();g.position.set(x,0,z);scene.add(g);
 for(const dx of [-1.45,1.45])for(const dz of [-.85,.85])box(.15,2.5,.15,0x62462c,dx,1.25,dz,g,'wood');
 box(3.25,.18,2.05,cloth,0,2.55,0,g,'wood');box(3,.13,1.25,0x805d3b,0,1.12,0,g,'wood');
 for(let i=0;i<5;i++){const basket=new T.Mesh(new T.DodecahedronGeometry(.2,0),material(i%2?0xb38b4b:0x72934e,'stone'));basket.position.set(-1.05+i*.51,1.37,0);g.add(basket)}
}
function villageWell(x,z){const g=new T.Group();g.position.set(x,0,z);scene.add(g);
 const rim=new T.Mesh(new T.CylinderGeometry(1.05,1.15,.95,10,1,true),material(0x8c8a78,'stone'));rim.position.y=.5;g.add(rim);
 const water=new T.Mesh(new T.CircleGeometry(.86,12),new T.MeshLambertMaterial({color:0x527b87}));water.rotation.x=-Math.PI/2;water.position.y=.67;g.add(water);
 for(const dx of [-.9,.9])box(.13,2.2,.13,0x705038,dx,1.55,0,g,'wood');
 box(2.3,.13,1.6,0x62452e,0,2.55,0,g,'roof');
}
function villageFence(x,z,length=5,rotation=0){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;scene.add(g);
 for(let i=0;i<=length;i++)box(.16,1.2,.18,0x735239,i-length/2,.6,0,g,'wood');
 for(const y of [.4,.92])box(length+.2,.13,.15,0x8b6746,0,y,0,g,'wood');
}
function signpost(x,z){const g=new T.Group();g.position.set(x,0,z);scene.add(g);
 box(.16,2.5,.17,0x64462d,0,1.25,0,g,'wood');box(2.1,.48,.15,0x9c7848,.35,2.05,0,g,'wood');
 box(.5,.12,.2,0xc3a469,1.55,2.05,0,g,'wood')
}
villageWell(2,-1);marketStall(-10,6,0x9e5b43);marketStall(10,5,0x4f7d64);
for(const [x,z] of [[-13,9],[-9,9],[8,9],[13,9],[-20,-5],[22,16],[-8,-11],[15,-12]])villageCrate(x,z,x*.2);
for(const [x,z] of [[-12,11],[-11,11],[12,10],[13,10],[-22,-8],[25,13]])villageBarrel(x,z);
villageFence(-25,-10,8,.05);villageFence(26,-12,7,-.25);villageFence(-23,24,8,.1);
signpost(4,-12);
// Oakcross town atmosphere: animated fountain, lanterns, flowerbeds, benches, banners, birds.
const townAnimations=[];
function fountain(x,z){
 const g=new T.Group();g.position.set(x,0,z);scene.add(g);
 const stone=material(0x8e9187,'stone'),water=new T.MeshStandardMaterial({color:0x5799ad,metalness:.15,roughness:.23,transparent:true,opacity:.86,side:T.DoubleSide});
 const basin=new T.Mesh(new T.CylinderGeometry(2.3,2.5,.72,16),stone);basin.position.y=.38;basin.castShadow=true;g.add(basin);
 const pool=new T.Mesh(new T.CylinderGeometry(2.06,2.06,.06,16),water);pool.position.y=.76;g.add(pool);
 const rim=new T.Mesh(new T.TorusGeometry(2.22,.17,6,20),stone);rim.rotation.x=Math.PI/2;rim.position.y=.77;g.add(rim);
 const column=new T.Mesh(new T.CylinderGeometry(.35,.51,2.2,10),stone);column.position.y=1.8;g.add(column);
 const top=new T.Mesh(new T.CylinderGeometry(.8,.6,.3,12),stone);top.position.y=2.92;g.add(top);
 const streams=[];const dropGeo=new T.SphereGeometry(.065,5,4);
 for(let i=0;i<10;i++){const a=i*Math.PI*2/10;for(let j=0;j<5;j++){const drop=new T.Mesh(dropGeo,water);g.add(drop);streams.push({drop,a,phase:j/5})}}
 townAnimations.push(t=>{pool.position.y=.76+Math.sin(t*2)*.018;for(const {drop,a,phase} of streams){const p=(t*.72+phase)%1,r=.35+p*1.35;drop.position.set(Math.cos(a)*r,2.87+Math.sin(p*Math.PI)*.45-p*1.85,Math.sin(a)*r);drop.scale.set(.7,1.5,.7)}});
}
function lantern(x,z){const g=new T.Group();g.position.set(x,0,z);scene.add(g);
 box(.15,3.4,.15,0x5d4732,0,1.7,0,g,'wood');box(.75,.13,.17,0x5d4732,.30,3.3,0,g,'wood');
 const glass=new T.Mesh(new T.BoxGeometry(.34,.43,.34),new T.MeshBasicMaterial({color:0xffca73}));glass.position.set(.6,2.98,0);g.add(glass);
 const cap=new T.Mesh(new T.ConeGeometry(.33,.28,4),material(0x554333,'wood'));cap.position.set(.6,3.34,0);cap.rotation.y=Math.PI/4;g.add(cap);
 const light=new T.PointLight(0xffb15e,.5,7,2);light.position.set(.6,3.0,0);g.add(light);
 townAnimations.push(t=>{light.intensity=.45+Math.sin(t*3+x)*.09})
}
function flowerbed(x,z,seed=0){const g=new T.Group();g.position.set(x,0,z);scene.add(g);
 box(3,.25,1.3,0x6b4c30,0,.12,0,g,'wood');box(2.8,.08,1.1,0x56442c,0,.27,0,g,'dirt');
 const stemGeo=new T.CylinderGeometry(.023,.03,.33,4),petalGeo=new T.IcosahedronGeometry(.12,0);
 const stemMat=material(0x40713c,'leaf'),colors=[0xe7b85b,0xc45c67,0xe5d9bb,0x9869b4];
 for(let i=0;i<18;i++){const x=-1.2+(i%9)*.3,z=i<9?-.26:.26;const stem=new T.Mesh(stemGeo,stemMat);stem.position.set(x,.45,z);g.add(stem);
 const bloom=new T.Mesh(petalGeo,material(colors[(i+seed)%colors.length],'leaf'));bloom.position.set(x,.64,z);g.add(bloom)}
}
function bench(x,z,rotation=0){const g=new T.Group();g.position.set(x,0,z);g.rotation.y=rotation;scene.add(g);
 box(2,.16,.55,0x8c6745,0,.72,0,g,'wood');box(2,.16,.16,0x8c6745,0,1.18,-.25,g,'wood');
 for(const side of [-.75,.75]){box(.13,.7,.13,0x544535,side,.35,0,g,'wood');box(.13,.55,.13,0x544535,side,.95,-.24,g,'wood')}
}
function banner(x,z,shade=0x8b4d46){const g=new T.Group();g.position.set(x,0,z);scene.add(g);
 box(.12,4,.12,0x715239,0,2,0,g,'wood');box(1.3,.10,.10,0x715239,.52,3.65,0,g,'wood');
 const flag=new T.Mesh(new T.PlaneGeometry(1.15,1.55),new T.MeshLambertMaterial({color:shade,side:T.DoubleSide}));flag.position.set(.55,2.85,0);g.add(flag);
 townAnimations.push(t=>{flag.rotation.y=Math.sin(t*1.2+x)*.12})
}
function birds(x,z){const g=new T.Group();g.position.set(x,0,z);scene.add(g);
 const birds=[];const feather=material(0x55544b,'stone');
 for(let i=0;i<6;i++){const b=new T.Group();g.add(b);const body=new T.Mesh(new T.ConeGeometry(.10,.3,5),feather);body.rotation.x=Math.PI/2;b.add(body);
 for(const side of [-1,1]){const wing=new T.Mesh(new T.BoxGeometry(.3,.035,.13),feather);wing.position.x=side*.17;b.add(wing)}birds.push(b)}
 townAnimations.push(t=>{birds.forEach((b,i)=>{const a=t*.35+i*1.04;b.position.set(Math.cos(a)* (4+i*.55),6+i*.7+Math.sin(t*2+i)*.3,Math.sin(a)*(4+i*.55));b.rotation.y=-a})})
}
fountain(1,-1); // Central gathering landmark.
for(const [x,z] of [[-10,-9],[11,-9],[-15,14],[16,15],[0,18]])lantern(x,z);
for(const [x,z,seed] of [[-6,-6,0],[7,-6,1],[-15,4,2],[15,1,3],[-7,15,0],[9,15,1]])flowerbed(x,z,seed);
bench(-5,2,.25);bench(7,2,-.2);bench(-2,8,Math.PI);bench(5,-8,0);
banner(-12,-3,0x9a4c43);banner(12,-3,0x476f85);banner(-2,15,0x9d8151);
birds(0,0);
// Forest glades and distant ruins make the expanded wilderness feel distinct.
for(let i=0;i<16;i++){const a=i*Math.PI*2/16;box(1.6,1.1+(i%4)*.4,1.5,0x6d716b,132+Math.cos(a)*9,.7,26+Math.sin(a)*9)}
// Additional regions: winding roads, villages, groves and landmarks.
trail(-60,45,-210,145,3.4);trail(75,-55,260,-185,3.4);trail(105,103,225,215,3.4);trail(-105,-91,-275,-215,3.4);
for(const [x,z,r,c] of [[-190,155,18,0x537d55],[245,-170,25,0x6b8052],[210,230,19,0x78926b],[-260,-220,22,0x708660]])disk(r,c,x,z);
for(let i=0;i<60;i++){const a=i*2.4,r=12+i*.8;const x=250+Math.sin(a)*r,z=-180+Math.cos(a)*r;const stone=sphere(.6+i%4*.16,0x797f76,x,.32,z);stone.scale.y=.55}
for(let i=0;i<16;i++){const a=i*Math.PI/8;box(1.8,1.2+i%3,1.8,0x74776e,-285+Math.cos(a)*13,.8,-220+Math.sin(a)*13)}
const merchant=new T.Group();merchant.position.set(-3,0,7);scene.add(merchant);
const trader=buildHumanoid(T,merchant,{skin:0xd8a57e,shirt:0x704c77,pants:0x514638,hairColor:0x30231f,hair:'Long'});
// The shopkeeper uses the same skeleton as other NPCs, with a distinct apron and belt.
box(.54,.69,.045,0x9a7953,0,1.44,.225,merchant,'wood');box(.78,.12,.47,0x4b3428,0,1.01,0,merchant,'wood');
const mh=new T.Mesh(new T.SphereGeometry(.43,8,6),new T.MeshBasicMaterial({visible:false}));mh.position.set(0,1.45,0);merchant.add(mh);mh.userData={kind:'merchant',x:-3,z:7};targets.push(mh);
box(2.5,.25,1,0x805832,-3,1,9,scene,'wood');
const player=new T.Group();scene.add(player);const body=new T.Group();player.add(body);
const avatar=buildHumanoid(T,body,{skin:appearance.skin,shirt:appearance.shirt,pants:appearance.pants,hairColor:appearance.hairColor,hair:appearance.hair});
const {leftArm:la,rightArm:ra,leftLeg:ll,rightLeg:rl,leftElbow:le,rightElbow:re,leftKnee:lk,rightKnee:rk}=avatar;
// Other online adventurers and short-lived overhead chat bubbles.
const remotePlayers=new Map(),chatBubbles=new Map();
const bubbleLayer=document.createElement('div');bubbleLayer.id='overhead-chat-layer';bubbleLayer.style.cssText='position:fixed;inset:0;z-index:45;pointer-events:none;overflow:hidden';document.body.append(bubbleLayer);
window.eldervaleGetPlayerPosition=()=>({x:Math.round(player.position.x*10)/10,z:Math.round(player.position.z*10)/10,yaw:player.rotation.y});
window.eldervaleUpdatePlayers=entries=>{
 const seen=new Set();
 for(const entry of entries){if(!entry.id||!Number.isFinite(entry.x)||!Number.isFinite(entry.z))continue;seen.add(entry.id);
 let other=remotePlayers.get(entry.id);
 if(!other){const root=new T.Group();scene.add(root);buildHumanoid(T,root,{});const tag=document.createElement('div');tag.style.cssText='position:fixed;padding:3px 7px;background:#14221cdd;color:#f4e2ba;border:1px solid #9b8659;border-radius:5px;font:12px Arial;white-space:nowrap;pointer-events:none';tag.textContent=String(entry.username||'Adventurer').slice(0,24);bubbleLayer.append(tag);other={root,tag};remotePlayers.set(entry.id,other)}
 other.root.position.set(entry.x,0,entry.z);other.root.rotation.y=entry.yaw||0;
 }
 for(const [id,other] of remotePlayers)if(!seen.has(id)){scene.remove(other.root);other.tag.remove();remotePlayers.delete(id);const bubble=chatBubbles.get(id);bubble?.node.remove();chatBubbles.delete(id)}
};
window.eldervaleShowChatBubble=(id,name,message)=>{
 if(!id||!message)return;const old=chatBubbles.get(id);old?.node.remove();
 const node=document.createElement('div');node.style.cssText='position:fixed;max-width:230px;padding:7px 10px;border:1px solid #d1b878;border-radius:12px;background:#f5e8c9;color:#29251d;box-shadow:0 3px 12px #0009;text-align:center;font:12px Arial;overflow-wrap:anywhere;pointer-events:none';
 const strong=document.createElement('strong');strong.textContent=String(name||'Adventurer').slice(0,24);const text=document.createElement('div');text.textContent=String(message).slice(0,240);node.append(strong,text);bubbleLayer.append(node);chatBubbles.set(id,{node,expires:performance.now()+6500});
};
function updateOverheadChat(){
 const selfId=window.eldervaleUserId;const projected=new T.Vector3();
 for(const [id,other] of remotePlayers){projected.set(other.root.position.x,3.05,other.root.position.z).project(camera);const visible=projected.z<1&&projected.z>-1&&other.root.position.distanceTo(player.position)<75;other.tag.style.display=visible?'block':'none';if(visible){other.tag.style.left=((projected.x+1)*innerWidth/2-other.tag.offsetWidth/2)+'px';other.tag.style.top=((1-projected.y)*innerHeight/2)+'px'}}
 for(const [id,bubble] of chatBubbles){if(performance.now()>bubble.expires){bubble.node.remove();chatBubbles.delete(id);continue}const other=id===selfId?player:remotePlayers.get(id)?.root;if(!other){bubble.node.style.display='none';continue}projected.set(other.position.x,3.65,other.position.z).project(camera);const visible=projected.z<1&&projected.z>-1&&other.position.distanceTo(player.position)<75;bubble.node.style.display=visible?'block':'none';if(visible){bubble.node.style.left=((projected.x+1)*innerWidth/2-bubble.node.offsetWidth/2)+'px';bubble.node.style.top=((1-projected.y)*innerHeight/2-bubble.node.offsetHeight)+'px'}}
}
const saved=JSON.parse(localStorage.getItem('eldervale-save')||localStorage.getItem('ashen-realms-save')||'{}');
const combat={hp:typeof saved.hp==='number'?Math.max(1,Math.min(100,saved.hp)):100,maxHp:100,xp:saved.combatXP||0,kills:saved.kills||0,attackTimer:0,respawnTimer:0,attackAnim:0,hitAnim:0};
const armorCatalog={
  helm:{name:'Iron full helm',slot:'Head',desc:'A sturdy iron helmet.'},
  chest:{name:'Iron platebody',slot:'Body',desc:'A solid iron breastplate.'},
  legs:{name:'Iron platelegs',slot:'Legs',desc:'Heavy iron leg protection.'},
  boots:{name:'Iron boots',slot:'Feet',desc:'Iron-plated boots.'},
  cape:{name:'Crimson Adventurer Cape',slot:'Back',desc:'A long crimson cape with gold clasps. It flows as you walk.'}
};
const armorKeys=Object.keys(armorCatalog);
const state={wood:saved.wood||0,ore:saved.ore||0,gold:saved.gold||0,woodXP:saved.woodXP||0,miningXP:saved.miningXP||0,
armorOwned:Array.isArray(saved.armorOwned)?saved.armorOwned.filter(k=>armorCatalog[k]):[],
equipped:(saved.equipped&&typeof saved.equipped==='object')?saved.equipped:{},weaponsOwned:Array.isArray(saved.weaponsOwned)?saved.weaponsOwned.filter(k=>weaponCatalog[k]):[],equippedWeapon:weaponCatalog[saved.equippedWeapon]?saved.equippedWeapon:null,starterChestClaimed:!!saved.starterChestClaimed,shieldsOwned:Array.isArray(saved.shieldsOwned)?saved.shieldsOwned.filter(k=>shieldCatalog[k]):[],equippedShield:shieldCatalog[saved.equippedShield]?saved.equippedShield:null};
for(const key of ['attackXP','strengthXP','defenceXP','hitpointsXP','rangedXP','magicXP','prayerXP','firemakingXP','fishingXP','cookingXP','smithingXP','craftingXP','herbloreXP','farmingXP','agilityXP','thievingXP'])state[key]=Number.isFinite(Number(saved[key]))?Math.max(0,Math.floor(Number(saved[key]))):0;
for(const k of armorKeys)if(state.equipped[k]&&!state.armorOwned.includes(k))state.armorOwned.push(k);
// Existing adventurers already claimed the starter chest before shields existed.
// Grant the new starter shields once without reopening or resetting their chest.
if(state.starterChestClaimed&&!saved.starterShieldsGranted){
 for(const key of Object.keys(shieldCatalog))if(!state.shieldsOwned.includes(key))state.shieldsOwned.push(key);
 state.starterShieldsGranted=true;
 localStorage.setItem('eldervale-save',JSON.stringify({...saved,shieldsOwned:state.shieldsOwned,starterShieldsGranted:true}));
}
const pieces=buildPlateArmor(T,body,avatar);
const cape=createCape(T,body,{color:0x81394b});
function refreshArmor(){avatar.torso.visible=!state.equipped.chest;for(const k of armorKeys){if(k==='cape'){cape.mesh.visible=!!state.equipped.cape;continue}for(const m of pieces[k])m.visible=!!state.equipped[k]}}
refreshArmor();
const weaponMeshes=new Map();
for(const key of Object.keys(weaponCatalog)){const model=makeWeapon(T,key);model.position.set(0,-.80,.04);ra.add(model);model.visible=false;weaponMeshes.set(key,model)}
const shieldMeshes=new Map();
for(const key of Object.keys(shieldCatalog)){const model=makeShield(T,key);avatar.leftArm.add(model);model.visible=false;shieldMeshes.set(key,model)}
function refreshShield(){for(const [key,model] of shieldMeshes)model.visible=state.equippedShield===key}
function equipShield(key){if(!state.shieldsOwned.includes(key))return;state.equippedShield=state.equippedShield===key?null:key;refreshShield();say(state.equippedShield?'Equipped '+shieldCatalog[key].name:'Unequipped shield');save();draw()}
refreshShield();
function refreshWeapon(){for(const [key,model] of weaponMeshes)model.visible=state.equippedWeapon===key}
function equipWeapon(key){if(!state.weaponsOwned.includes(key))return;state.equippedWeapon=state.equippedWeapon===key?null:key;refreshWeapon();say(state.equippedWeapon?'Equipped '+weaponCatalog[key].name:'Unequipped weapon');save();draw()}
refreshWeapon();
if(saved.x!==undefined)player.position.set(saved.x,0,saved.z);
const stats=document.querySelector('#stats'),inventory=document.querySelector('#inventory'),log=document.querySelector('#log'),equipment=document.querySelector('#equipment'),menu=document.querySelector('#contextmenu');
let activeTab='inventory',mapOpen=false;const mapCanvas=document.querySelector('#minimap'),largeMap=document.querySelector('#worldmap'),mapPanel=document.querySelector('#map-panel');
const mapCtx=mapCanvas.getContext('2d'),largeCtx=largeMap.getContext('2d');

function drawMap(ctx,canvas,scale){
 const w=canvas.width,h=canvas.height,extent=scale?840:90,pxPerUnit=w/extent,pzPerUnit=h/extent;
 const toX=x=>w/2+(x-(scale?0:player.position.x))*pxPerUnit,toY=z=>h/2+(z-(scale?0:player.position.z))*pzPerUnit;
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#536d4c';ctx.fillRect(0,0,w,h);for(const lake of worldLakes){ctx.beginPath();ctx.ellipse(toX(lake.x),toY(lake.z),lake.rx*pxPerUnit,lake.rz*pzPerUnit,0,0,Math.PI*2);ctx.fillStyle='#b4a478';ctx.fill();ctx.beginPath();ctx.ellipse(toX(lake.x),toY(lake.z),lake.rx*pxPerUnit*.95,lake.rz*pzPerUnit*.95,0,0,Math.PI*2);ctx.fillStyle='#3b8495';ctx.fill()}
 const roads=[[[0,0],[-60,45]],[[0,0],[75,-55]],[[0,0],[105,103]],[[-60,45],[-105,-91]],[[-60,45],[-210,145]],[[75,-55],[260,-185]],[[105,103],[225,215]],[[-105,-91],[-275,-215]]];
 ctx.strokeStyle='#a9936c';ctx.lineWidth=scale?4:3;
 for(const [a,b] of roads){ctx.beginPath();ctx.moveTo(toX(a[0]),toY(a[1]));ctx.lineTo(toX(b[0]),toY(b[1]));ctx.stroke()}
 // Draw buildings from their actual world transforms, including rotated footprints and doorway positions.
 for(const h of houseInteriors){
  const g=h.group,worldScale=g.scale.x,halfW=2*worldScale,halfD=1.85*worldScale;
  const cx=toX(g.position.x),cy=toY(g.position.z);
  if(cx+halfW*pxPerUnit<0||cx-halfW*pxPerUnit>w||cy+halfD*pzPerUnit<0||cy-halfD*pzPerUnit>h)continue;
  const corners=[[-halfW,-halfD],[halfW,-halfD],[halfW,halfD],[-halfW,halfD]];
  const c=Math.cos(g.rotation.y),sn=Math.sin(g.rotation.y);
  ctx.beginPath();corners.forEach(([x,z],i)=>{const wx=g.position.x+x*c+z*sn,wz=g.position.z-x*sn+z*c;i?ctx.lineTo(toX(wx),toY(wz)):ctx.moveTo(toX(wx),toY(wz))});ctx.closePath();
  ctx.fillStyle='#8b775b';ctx.strokeStyle='#332c25';ctx.lineWidth=scale?1.5:1;ctx.fill();ctx.stroke();
  const doorX=g.position.x+1.86*worldScale*sn,doorZ=g.position.z+1.86*worldScale*c;
  ctx.fillStyle='#e34b40';ctx.beginPath();ctx.arc(toX(doorX),toY(doorZ),scale?2.8:3.4,0,Math.PI*2);ctx.fill();
 }
 // World props are represented by small map symbols at their actual world coordinates.
 for(const prop of mapProps){const x=toX(prop.x),y=toY(prop.z);if(x<0||x>w||y<0||y>h)continue;ctx.fillStyle=prop.color;ctx.beginPath();ctx.arc(x,y,scale?1.7:2.2,0,Math.PI*2);ctx.fill()}
 for(const [name,x,z] of places){const px=toX(x),py=toY(z);if(px<0||px>w||py<0||py>h)continue;ctx.fillStyle='#e6c988';ctx.beginPath();ctx.arc(px,py,scale?4:3,0,Math.PI*2);ctx.fill();if(scale){ctx.font='13px Georgia';ctx.fillText(name,px+8,py-5)}}
 ctx.fillStyle='#f5f5e4';ctx.strokeStyle='#18281d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(toX(player.position.x),toY(player.position.z),5,0,Math.PI*2);ctx.fill();ctx.stroke();
}
// Click-to-walk on both map sizes. Coordinates use the exact transform used by drawMap.
function walkFromMap(e,canvas,worldView){
 const rect=canvas.getBoundingClientRect(),u=(e.clientX-rect.left)/rect.width,v=(e.clientY-rect.top)/rect.height;
 const extent=worldView?840:90;
 const x=(worldView?0:player.position.x)+(u-.5)*extent;
 const z=(worldView?0:player.position.z)+(v-.5)*extent*(canvas.height/canvas.width);
 action=null;closeDialog();setWalkDestination(new T.Vector3(x,0,z));if(dest)markClick(x,z,'walk');
}
mapCanvas.title='Click anywhere to walk · MAP button opens world map';mapCanvas.style.cursor='crosshair';
mapCanvas.addEventListener('click',e=>walkFromMap(e,mapCanvas,false));
largeMap.style.cursor='crosshair';largeMap.title='Click a destination to walk';
largeMap.addEventListener('click',e=>walkFromMap(e,largeMap,true));
document.querySelector('#map-toggle').onclick=()=>{mapOpen=!mapOpen;mapPanel.hidden=!mapOpen;if(mapOpen)drawMap(largeCtx,largeMap,true)};
document.querySelector('#map-close').onclick=()=>{mapOpen=false;mapPanel.hidden=true};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();closeDialog();mapOpen=false;mapPanel.hidden=true}if(!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&e.key.toLowerCase()==='m'&&!e.repeat){mapOpen=!mapOpen;mapPanel.hidden=!mapOpen;if(mapOpen)drawMap(largeCtx,largeMap,true)}});
document.addEventListener('contextmenu',e=>{if(e.target.closest('#game-ui')||e.target===renderer.domElement)e.preventDefault()});
// Animated ground-click markers: amber for walking and crimson for interactions.
const markers=[];function markClick(x,z,kind='walk'){const group=new T.Group();group.position.set(x,.11,z);const color=kind==='walk'?0xffd05b:0xe64c46;const ring=new T.Mesh(new T.RingGeometry(.45,.62,32),new T.MeshBasicMaterial({color,transparent:true,opacity:.95,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;group.add(ring);const dot=new T.Mesh(new T.CircleGeometry(.12,20),new T.MeshBasicMaterial({color,transparent:true,opacity:.85,side:T.DoubleSide,depthWrite:false}));dot.rotation.x=-Math.PI/2;dot.position.y=.005;group.add(dot);scene.add(group);markers.push({group,ring,dot,age:0});}
// Job stations make villagers inhabit believable places rather than random spawn circles.
function workCounter(x,z,kind){mapProps.push({x,z,color:'#d9b873'});
 const g=new T.Group();g.position.set(x,0,z);scene.add(g);
 box(3.1,.22,1.05,0x86613d,0,1.08,0,g,'wood');
 for(const dx of [-1.28,1.28])box(.16,1,.18,0x59422e,dx,.55,0,g,'wood');
 if(kind==='bank'){
  for(let i=0;i<4;i++){const coin=new T.Mesh(new T.CylinderGeometry(.21,.21,.09,10),material(0xd8ad4b,'stone'));coin.position.set(-.95+i*.55,1.25,0);g.add(coin)}
  box(.75,.55,.48,0x6e482b,1.02,1.45,-.2,g,'wood');
 }else if(kind==='forge'){
  for(let i=0;i<3;i++)box(.36,.12,.13,0x9fa5a2,-.7+i*.6,1.27,0,g,'stone');
  box(.8,.5,.8,0x565552,1.1,.5,-.9,g,'stone');
 }else if(kind==='herbs'){
  for(let i=0;i<5;i++){const pot=new T.Mesh(new T.CylinderGeometry(.16,.12,.24,7),material(0x977450,'stone'));pot.position.set(-1+i*.5,1.3,0);g.add(pot);cone(.18,.38,i%2?0x4d8051:0x7b9960,-1+i*.5,1.6,0,g)}
 }else{
  for(let i=0;i<5;i++)box(.32,.16,.28,i%2?0xb88d53:0x79935e,-1+i*.5,1.28,0,g,'wood');
 }
}
function workSign(x,z,caption){
 const g=new T.Group();g.position.set(x,0,z);scene.add(g);
 box(2.7,.6,.13,0x67472d,0,2.5,0,g,'wood');
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
 const ctx=canvas.getContext('2d');ctx.fillStyle='#e9d19b';ctx.font='bold 52px Georgia';ctx.textAlign='center';ctx.fillText(caption,256,83);
 const texture=new T.CanvasTexture(canvas),sign=new T.Mesh(new T.PlaneGeometry(2.5,.58),new T.MeshBasicMaterial({map:texture,transparent:true,side:T.DoubleSide}));
 sign.position.set(0,2.5,.08);g.add(sign);
}
workCounter(-12,5,'herbs');workCounter(12,4,'goods');
workCounter(-8,-10,'bank');workSign(-8,-10,'OAKCROSS BANK');
workCounter(18,-1,'forge');workSign(18,-1,'THE FORGE');
workSign(-12,5,'HERBALIST');workSign(12,4,'MARKET');
const npcProfiles=[
{name:'Edda the Guide',role:'guide',x:3,z:8,color:0x4b6d8d,station:'guide',behavior:'stationary',lines:['Welcome to Oakcross! The bank is northwest, the market is east, and the forge is near the eastern gate.','Open a house door before entering. The armory has equipment for new adventurers.']},
{name:'Sir Rowan',role:'guard',x:24,z:-3,color:0x9a9da6,station:'guard',behavior:'patrol',patrol:[[24,-3],[28,3],[24,8],[20,4]],lines:['I patrol the eastern gate and keep the roads safe.','Keep your blade ready beyond the village.']},
{name:'Mira the Herbalist',role:'herbalist',x:-12,z:7.5,color:0x548c66,station:'herbs',behavior:'stationary',lines:['Welcome to my herb stall. Fresh greens and remedies from the forest.','The forests are alive with useful plants.']},
{name:'Bram the Woodsman',role:'woodsman',x:-56,z:43,color:0x855f3c,station:'woodland',behavior:'patrol',patrol:[[-56,43],[-50,40],[-48,45],[-55,47]],lines:['I collect timber beside Northwatch, not in the middle of town.','The tall pines make fine beams.']},
{name:'Lysa the Scout',role:'scout',x:74,z:-51,color:0x74628b,station:'scout',behavior:'patrol',patrol:[[74,-51],[80,-48],[83,-54],[76,-55]],lines:['I keep watch over Eastmarch and its roads.','The eastern roads wind toward Suncrest.']},
{name:'Torren the Smith',role:'smith',x:18,z:1.5,color:0x806e65,station:'forge',behavior:'stationary',lines:['Welcome to my forge. I keep blades and tools ready for travelers.','Bring me ore when smithing is available.']},
{name:'Fen the Ranger',role:'ranger',x:-208,z:146,color:0x3d7155,station:'ranger',behavior:'patrol',patrol:[[-208,146],[-201,141],[-205,136],[-213,141]],lines:['I patrol Westmere and watch the forest trails.','Keep your eyes open for landmarks.']},
{name:'Nara the Wanderer',role:'wanderer',x:258,z:-181,color:0x916d6d,station:'traveler',behavior:'patrol',patrol:[[258,-181],[265,-178],[268,-183],[260,-188]],lines:['I am resting near Suncrest before my next journey.','The western ruins are older than the kingdoms themselves.']},
{name:'Garrick the Banker',role:'banker',x:-8,z:-8.1,color:0x5b6586,station:'bank',behavior:'stationary',lines:['Welcome to Oakcross Bank. Your valuables deserve a safe place.','Bank storage is coming soon; for now, keep your gold secure.']},
{name:'Pella the Merchant',role:'merchant',x:12,z:6.5,color:0xa7784b,station:'market',behavior:'stationary',lines:['Welcome to my market stall! Look at the goods on my table.','Travelers always need provisions for the road.']}
];
const npcs=[];
function spawnNPC(profile,index){
 const root=new T.Group();root.position.set(profile.x,0,profile.z);scene.add(root);
 const palettes=[0xc9916b,0xe0b48e,0x966247,0x67402f,0xb98362];
 const hairs=[0x39271f,0x6d4831,0xa17a4b,0x241e1d];
 const model=buildHumanoid(T,root,{skin:palettes[index%palettes.length],shirt:profile.color,pants:0x474442,hairColor:hairs[index%hairs.length],hair:['Short crop','Side swept','Spiky','Buzz cut','Long'][index%5]});
 // Clothing accents give each NPC a recognizable silhouette without changing the animation rig.
 if(index%3===0){box(.62,.11,.44,0x5e422d,0,1.07,0,root,'wood');box(.24,.16,.07,0xc5a46b,0,1.07,.245,root)}
 if(index%3===1){box(.52,.62,.045,0xb3a17b,0,1.48,.223,root,'cloth');box(.54,.12,.45,0x6b4c33,0,1.09,0,root,'wood')}
 if(index%3===2){const cape=box(.64,.84,.07,0x514f67,0,1.50,-.26,root,'cloth');cape.rotation.x=-.12}
 const hit=new T.Mesh(new T.CylinderGeometry(.68,.68,2.7,14),new T.MeshBasicMaterial({visible:false}));
 hit.position.set(0,1.38,0);root.add(hit);hit.userData={kind:'npc',profile,root};targets.push(hit);
 const npc={profile,root,leftArm:model.leftArm,rightArm:model.rightArm,leftLeg:model.leftLeg,rightLeg:model.rightLeg,leftElbow:model.leftElbow,rightElbow:model.rightElbow,leftKnee:model.leftKnee,rightKnee:model.rightKnee,home:new T.Vector3(profile.x,0,profile.z),goal:new T.Vector3(profile.x,0,profile.z),wait:2+index,phase:index,walkPhase:0,walkBlend:0,stuck:0,pace:.48+(index%4)*.075,path:[],pathGoal:null,patrolIndex:0};npcs.push(npc)
}
npcProfiles.forEach(spawnNPC);
// Wildlife and enemies use lightweight low-poly models and simple local AI.
const creatures=[];function creature(name,x,z,hostile=false){const root=new T.Group();root.position.set(x,0,z);scene.add(root);const fur=name==='Wolf'?0x646762:name==='Boar'?0x76553f:0x9a8062;box(.8,.65,1.3,fur,0,.65,0,root);sphere(.37,fur,0,.92,.73,root);for(const sx of [-.27,.27])for(const sz of [-.42,.42])box(.19,.52,.2,0x4e473a,sx,.26,sz,root);if(name==='Wolf'){for(const sx of [-.2,.2])cone(.15,.38,fur,sx,1.28,.7,root)}if(name==='Deer')cone(.18,.5,0xc5b28a,0,1.38,.75,root);const hit=new T.Mesh(new T.BoxGeometry(1.25,1.55,2.0),new T.MeshBasicMaterial({visible:false}));hit.position.set(0,.78,.20);root.add(hit);const mob={name,root,home:new T.Vector3(x,0,z),goal:new T.Vector3(x,0,z),hp:hostile?36:20,maxHp:hostile?36:20,hostile,alive:true,wait:2,attackCooldown:0,respawn:0};hit.userData={kind:'creature',mob};targets.push(hit);mob.hit=hit;creatures.push(mob)}
for(let i=0;i<24;i++){const a=i*2.399,r=22+i*11;creature(i%5===0?'Wolf':i%3===0?'Boar':'Deer',Math.sin(a)*r,Math.cos(a)*r,i%5===0)}
const healthBar=document.querySelector('#health-fill'),combatNotice=document.querySelector('#combat-notice');
function combatMessage(msg){combatNotice.textContent=msg;combatNotice.hidden=false;clearTimeout(combatMessage.timer);combatMessage.timer=setTimeout(()=>combatNotice.hidden=true,1800)}
// Procedural, non-looping combat effects; unlocked by player input on first combat.
let combatAudio=null;
function combatSound(kind){
 try{
  combatAudio??=new (window.AudioContext||window.webkitAudioContext)();
  if(combatAudio.state==='suspended')combatAudio.resume().catch(()=>{});
  const t=combatAudio.currentTime,noiseLength=kind==='metal'?.24:.19;
  const buffer=combatAudio.createBuffer(1,Math.ceil(combatAudio.sampleRate*noiseLength),combatAudio.sampleRate),data=buffer.getChannelData(0);
  for(let i=0;i<data.length;i++){const envelope=Math.exp(-i/data.length*(kind==='metal'?9:5));data[i]=(Math.random()*2-1)*envelope}
  const source=combatAudio.createBufferSource(),filter=combatAudio.createBiquadFilter(),gain=combatAudio.createGain();
  source.buffer=buffer;filter.type=kind==='metal'?'bandpass':'highpass';filter.frequency.value=kind==='metal'?1550:kind==='axe'?500:1150;filter.Q.value=kind==='metal'?2:.6;
  gain.gain.setValueAtTime(kind==='metal'?.13:.11,t);gain.gain.exponentialRampToValueAtTime(.0001,t+noiseLength);
  source.connect(filter);filter.connect(gain);gain.connect(combatAudio.destination);source.start(t);
  source.onended=()=>{source.disconnect();filter.disconnect();gain.disconnect()};
  if(kind==='metal'){
   const ring=combatAudio.createOscillator(),rg=combatAudio.createGain();ring.type='sine';ring.frequency.setValueAtTime(670,t);ring.frequency.exponentialRampToValueAtTime(490,t+.2);
   rg.gain.setValueAtTime(.075,t);rg.gain.exponentialRampToValueAtTime(.0001,t+.22);ring.connect(rg);rg.connect(combatAudio.destination);ring.start(t);ring.stop(t+.23);
   ring.onended=()=>{ring.disconnect();rg.disconnect()};
  }
 }catch{}
}
function faceTarget(object,target){const dx=target.x-object.position.x,dz=target.z-object.position.z;if(dx*dx+dz*dz>.0001)object.rotation.y=Math.atan2(dx,dz)}
function strike(mob){if(!mob.alive||combat.attackTimer>0)return;combat.attackTimer=state.equippedWeapon?weaponCatalog[state.equippedWeapon].speed:.85;combat.attackAnim=.55;faceTarget(player,mob.root.position);combatSound(/axe|hatchet/i.test(String(state.equippedWeapon||''))?'axe':'slash');const damage=6+(state.equippedWeapon?weaponCatalog[state.equippedWeapon].damage:0)+Math.floor(Math.random()*7);mob.hp-=damage;combatMessage('You hit '+mob.name+' for '+damage+' damage');if(mob.hp<=0){mob.alive=false;mob.root.visible=false;mob.respawn=22;combat.kills++;combat.xp+=30;state.attackXP=(state.attackXP||0)+10;state.strengthXP=(state.strengthXP||0)+10;state.defenceXP=(state.defenceXP||0)+5;state.hitpointsXP=(state.hitpointsXP||0)+5;state.gold+=mob.hostile?8:2;combatMessage('Defeated '+mob.name+'! +30 combat XP');action=null;dest=null;save();draw()}}
function playerHit(mob){const defense=Object.values(state.equipped).filter(Boolean).length;const damage=Math.max(1,6+Math.floor(Math.random()*5)-defense);combat.hp=Math.max(0,combat.hp-damage);combat.hitAnim=.35;faceTarget(mob.root,player.position);combatSound(Object.values(state.equipped).some(Boolean)?'metal':'axe');combatMessage(mob.name+' hits you for '+damage);draw();if(combat.hp<=0){combat.hp=100;player.position.set(0,0,0);dest=null;action=null;state.gold=Math.max(0,state.gold-10);combatMessage('You fell in battle and returned to Oakcross.');save();draw()}}

const dialog=document.querySelector('#dialog'),dialogName=document.querySelector('#dialog-name'),dialogText=document.querySelector('#dialog-text'),dialogNext=document.querySelector('#dialog-next');let conversation=null;
function closeDialog(){conversation=null;dialog.hidden=true;document.body.classList.remove('npc-conversation')}
function talkTo(profile){conversation={profile,index:0};dialog.hidden=false;document.body.classList.add('npc-conversation');dialogName.textContent=profile.name;showDialogLine()}
function showDialogLine(){if(!conversation)return;dialogText.textContent=conversation.profile.lines[conversation.index];dialogNext.textContent=conversation.index===conversation.profile.lines.length-1?'Close':'Continue'}
dialogNext.onclick=()=>{if(!conversation)return;if(++conversation.index>=conversation.profile.lines.length)closeDialog();else showDialogLine()};
function closeMenu(){menu.hidden=true;menu.innerHTML=''}
function showMenu(x,y,items){menu.innerHTML='';for(const [label,fn] of items){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{closeMenu();fn()};menu.append(b)}menu.hidden=false;menu.style.left=Math.min(x,innerWidth-190)+'px';menu.style.top=Math.min(y,innerHeight-180)+'px'}
function toggleArmor(k){if(!state.armorOwned.includes(k))return;state.equipped[k]=!state.equipped[k];refreshArmor();say((state.equipped[k]?'Equipped ':'Removed ')+armorCatalog[k].name);save();draw()}
function examine(k){say(armorCatalog[k].name+': '+armorCatalog[k].desc)}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;draw();closeMenu()});

// Player-local graphics and interface preferences (no changes to cloud saves).
const settingKey='eldervale-client-settings';
let clientSettings={preset:'high',scale:1,distance:330,shadows:true,fps:false,reducedMotion:false};
try{clientSettings={...clientSettings,...JSON.parse(localStorage.getItem(settingKey)||'{}')}}catch{}
function applyGraphics(){
 const presets={low:{scale:.65,distance:110,shadows:false},medium:{scale:.8,distance:210,shadows:false},high:{scale:1,distance:330,shadows:true},ultra:{scale:1.25,distance:440,shadows:true}};
 const preset=presets[clientSettings.preset]||presets.high;
 const scale=Number(clientSettings.scale)||preset.scale;
 renderer.setPixelRatio(Math.min(devicePixelRatio*scale,2.5));
 renderer.shadowMap.enabled=Boolean(clientSettings.shadows);
 sun.castShadow=Boolean(clientSettings.shadows);
 camera.far=Number(clientSettings.distance)||preset.distance;camera.updateProjectionMatrix();
 const ids={'graphics-preset':clientSettings.preset,'render-scale':String(scale),'view-distance':String(clientSettings.distance),'shadows-setting':clientSettings.shadows,'fps-setting':clientSettings.fps,'reduce-motion':clientSettings.reducedMotion};
 for(const [id,value] of Object.entries(ids)){const el=document.getElementById(id);if(el){if(el.type==='checkbox')el.checked=Boolean(value);else el.value=String(value)}}
 document.querySelector('#fps-counter').hidden=!clientSettings.fps;
 document.body.classList.toggle('reduce-motion',Boolean(clientSettings.reducedMotion));
}
function storeGraphics(){localStorage.setItem(settingKey,JSON.stringify(clientSettings));applyGraphics()}
document.querySelector('#graphics-preset').addEventListener('change',e=>{clientSettings.preset=e.target.value;const p={low:[.65,110,false],medium:[.8,210,false],high:[1,330,true],ultra:[1.25,440,true]}[e.target.value];[clientSettings.scale,clientSettings.distance,clientSettings.shadows]=p;storeGraphics()});
for(const [id,key,parse] of [['render-scale','scale',Number],['view-distance','distance',Number],['shadows-setting','shadows',Boolean],['fps-setting','fps',Boolean],['reduce-motion','reducedMotion',Boolean]])document.getElementById(id).addEventListener('change',e=>{clientSettings[key]=e.target.type==='checkbox'?e.target.checked:parse(e.target.value);storeGraphics()});
document.querySelectorAll('[data-settings-page]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-settings-page]').forEach(t=>t.classList.toggle('active',t===b));document.querySelectorAll('[data-settings-panel]').forEach(p=>p.hidden=p.dataset.settingsPanel!==b.dataset.settingsPage)}));
document.querySelector('#settings-music-volume').addEventListener('input',e=>{const slider=document.querySelector('#music-volume');if(slider){slider.value=e.target.value;slider.dispatchEvent(new Event('input',{bubbles:true}))}});
document.querySelector('#open-friends').addEventListener('click',()=>{const panel=document.querySelector('#social-panel');panel.hidden=false;panel.classList.remove('collapsed');document.querySelector('[data-social-tab="friends"]')?.click()});
applyGraphics();
let fpsSamples=0,fpsSeconds=0;

document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))closeMenu()});
const level=x=>1+Math.floor(Math.sqrt(x/50));
const skillDefinitions=[['⚔','Attack','attackXP'],['💪','Strength','strengthXP'],['🛡','Defence','defenceXP'],['❤️','Hitpoints','hitpointsXP'],['🏹','Ranged','rangedXP'],['✨','Magic','magicXP'],['🙏','Prayer','prayerXP'],['🌳','Woodcutting','woodXP'],['⛏','Mining','miningXP'],['🔥','Firemaking','firemakingXP'],['🎣','Fishing','fishingXP'],['🍳','Cooking','cookingXP'],['🔨','Smithing','smithingXP'],['🛠','Crafting','craftingXP'],['🌿','Herblore','herbloreXP'],['🌱','Farming','farmingXP'],['🏃','Agility','agilityXP'],['🗝','Thieving','thievingXP']];
const skillsPanel=document.querySelector('#skills');
function drawSkills(){
 skillsPanel.replaceChildren();
 const grid=document.createElement('div');grid.className='skills-grid';
 let total=0;
 for(const [icon,name,key] of skillDefinitions){
  const xp=Math.max(0,Number(state[key])||0),lv=level(xp),next=50*lv*lv;total+=lv;
  const tile=document.createElement('button');tile.type='button';tile.className='skill-tile';tile.setAttribute('aria-label',name+', level '+lv+', '+xp+' experience');
  const glyph=document.createElement('span');glyph.className='skill-tile-icon';glyph.textContent=icon;
  const rank=document.createElement('span');rank.className='skill-tile-level';rank.textContent=lv;
  const title=document.createElement('span');title.className='skill-tile-name';title.textContent=name;
  tile.append(glyph,rank,title);
  tile.title=name+' — Level '+lv+' · '+xp.toLocaleString()+' XP · Next: '+next.toLocaleString()+' XP';
  tile.onclick=()=>{const old=skillsPanel.querySelector('.skill-detail');old?.remove();const detail=document.createElement('div');detail.className='skill-detail';const h=document.createElement('strong');h.textContent=icon+' '+name+' — Level '+lv;const p=document.createElement('p');p.textContent=xp.toLocaleString()+' XP · '+Math.max(0,next-xp).toLocaleString()+' XP until level '+(lv+1);detail.append(h,p);skillsPanel.append(detail)};
  grid.append(tile)
 }
 skillsPanel.append(grid);
 const footer=document.createElement('div');footer.className='skills-footer';footer.textContent='✦ Total level '+total+'  ·  '+skillDefinitions.length+' skills';skillsPanel.append(footer);
}
function draw(){
 stats.innerHTML='<p><strong>Health: '+Math.ceil(combat.hp)+' / '+combat.maxHp+'</strong><br>Combat: '+level(combat.xp)+' ('+combat.xp+' XP)<br>Defeated: '+combat.kills+'<br>Gold: '+state.gold+'<br>Woodcutting: '+level(state.woodXP)+' ('+state.woodXP+' XP)<br>Mining: '+level(state.miningXP)+' ('+state.miningXP+' XP)</p>';
 inventory.innerHTML='';equipment.innerHTML='';
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.tab===activeTab));
 inventory.hidden=activeTab!=='inventory';equipment.hidden=activeTab!=='equipment';skillsPanel.hidden=activeTab!=='skills';for(const key of ['friends','blocked','settings'])document.querySelector('#'+key+'-tab').hidden=activeTab!==key;if(activeTab==='skills')drawSkills();
 const slots=[];
 for(const key of state.weaponsOwned)if(state.equippedWeapon!==key)slots.push({kind:'weapon',key});
 for(const k of armorKeys)if(state.armorOwned.includes(k)&&!state.equipped[k])slots.push({kind:'armor',key:k});
 for(const key of state.shieldsOwned)if(state.equippedShield!==key)slots.push({kind:'shield',key});
 for(let i=0;i<state.wood;i++)slots.push({kind:'log'});
 for(let i=0;i<state.ore;i++)slots.push({kind:'ore'});
 for(let i=0;i<16;i++){
  const item=slots[i],d=document.createElement('button');d.className='slot';
  if(item){const icon=document.createElement('span');icon.className='item-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML=item.kind==='weapon'?iconForWeapon(item.key):item.kind==='shield'?'<svg viewBox="0 0 48 48"><path d="M9 6H39V25L24 43L9 25Z" fill="#8499a5" stroke="#d7bc7a" stroke-width="3"/><circle cx="24" cy="21" r="5" fill="#d7bc7a"/></svg>':item.kind==='armor'?({cape:'<svg viewBox="0 0 48 48"><path d="M15 6L33 6L40 42Q24 35 8 42Z" fill="#873a4b" stroke="#d6b57c" stroke-width="2"/><circle cx="15" cy="7" r="3" fill="#d6b57c"/><circle cx="33" cy="7" r="3" fill="#d6b57c"/></svg>',helm:'<svg viewBox="0 0 48 48"><path d="M10 26V19Q10 5 24 5T38 19V26L33 37H28V25H20V37H15Z" fill="#a9b5bb" stroke="#e4d6a9" stroke-width="2"/><path d="M13 22H35" stroke="#5d6972" stroke-width="4"/></svg>',chest:'<svg viewBox="0 0 48 48"><path d="M14 5L6 14L11 26L16 23V42H32V23L37 26L42 14L34 5L28 10H20Z" fill="#9daeb8" stroke="#d8d5bd" stroke-width="2"/><path d="M16 16L24 22L32 16M24 22V39" stroke="#566a76" stroke-width="3"/></svg>',legs:'<svg viewBox="0 0 48 48"><path d="M12 5H36L33 42H25L24 22L23 42H15Z" fill="#a1adb4" stroke="#e4d6a9" stroke-width="2"/><path d="M13 14H35" stroke="#64717b" stroke-width="4"/></svg>',boots:'<svg viewBox="0 0 48 48"><path d="M9 7H20V29L25 34V41H5V34L9 27ZM28 7H39V29L44 34V41H24V34L28 27Z" fill="#7e8d96" stroke="#c3bfa7" stroke-width="2"/></svg>'})[item.key]:item.kind==='log'?'<svg viewBox="0 0 48 48"><path d="M9 12L33 6L42 14L18 22Z" fill="#ad8050"/><path d="M9 12V32L18 40V22ZM18 22L42 14V33L18 40Z" fill="#765033" stroke="#c59a62" stroke-width="2"/><ellipse cx="18" cy="22" rx="5" ry="7" fill="#e1b980"/><ellipse cx="18" cy="22" rx="2.5" ry="4" fill="none" stroke="#9e6e40"/></svg>':'<svg viewBox="0 0 48 48"><path d="M6 35L13 15L27 8L42 23L36 40H14Z" fill="#84949a" stroke="#c2c5b4" stroke-width="2"/><path d="M13 15L26 24L42 23M26 24L20 38" fill="none" stroke="#586a73" stroke-width="3"/></svg>';d.append(icon);d.setAttribute('aria-label',item.kind==='weapon'?weaponCatalog[item.key].name:item.kind==='shield'?shieldCatalog[item.key].name:item.kind==='armor'?armorCatalog[item.key].name:item.kind==='log'?'Log':'Ore');
   d.title=(item.kind==='armor'||item.kind==='weapon')?'Click to equip • Right-click for options':'Right-click for options';
   d.onclick=()=>{if(item.kind==='armor')toggleArmor(item.key);else if(item.kind==='weapon')equipWeapon(item.key);else if(item.kind==='shield')equipShield(item.key)};
   d.oncontextmenu=e=>{e.preventDefault();showMenu(e.clientX,e.clientY,item.kind==='weapon'? [['Equip '+weaponCatalog[item.key].name,()=>equipWeapon(item.key)],['Examine',()=>say(weaponCatalog[item.key].desc)]]:item.kind==='shield'?[['Equip '+shieldCatalog[item.key].name,()=>equipShield(item.key)],['Examine',()=>say(shieldCatalog[item.key].desc)]]:item.kind==='armor'?
    [['Equip '+armorCatalog[item.key].name,()=>toggleArmor(item.key)],['Examine',()=>examine(item.key)]]:
    [['Examine',()=>say(item.kind==='log'?'Freshly cut logs.':'Unrefined ore.')]])};
  }else{d.disabled=true}inventory.append(d);
 }
 const equipmentIcons={
 cape:'<svg viewBox="0 0 48 48"><path d="M15 6L33 6L40 42Q24 35 8 42Z" fill="#873a4b" stroke="#d6b57c" stroke-width="2"/><circle cx="15" cy="7" r="3" fill="#d6b57c"/><circle cx="33" cy="7" r="3" fill="#d6b57c"/></svg>',
 helm:'<svg viewBox="0 0 48 48"><path d="M10 26V19Q10 5 24 5T38 19V26L33 37H28V25H20V37H15Z" fill="#a9b5bb" stroke="#e4d6a9" stroke-width="2"/><path d="M13 22H35" stroke="#5d6972" stroke-width="4"/></svg>',
 chest:'<svg viewBox="0 0 48 48"><path d="M14 5L6 14L11 26L16 23V42H32V23L37 26L42 14L34 5L28 10H20Z" fill="#9daeb8" stroke="#d8d5bd" stroke-width="2"/><path d="M16 16L24 22L32 16M24 22V39" stroke="#566a76" stroke-width="3"/></svg>',
 legs:'<svg viewBox="0 0 48 48"><path d="M12 5H36L33 42H25L24 22L23 42H15Z" fill="#a1adb4" stroke="#e4d6a9" stroke-width="2"/><path d="M13 14H35" stroke="#64717b" stroke-width="4"/></svg>',
 boots:'<svg viewBox="0 0 48 48"><path d="M9 7H20V29L25 34V41H5V34L9 27ZM28 7H39V29L44 34V41H24V34L28 27Z" fill="#7e8d96" stroke="#c3bfa7" stroke-width="2"/></svg>'
 };
 const weaponSlot=document.createElement('button');weaponSlot.className='equip-slot';weaponSlot.setAttribute('aria-label','Weapon: '+(state.equippedWeapon?weaponCatalog[state.equippedWeapon].name:'Empty'));const weaponIcon=document.createElement('span');weaponIcon.className='item-icon';weaponIcon.innerHTML=state.equippedWeapon?iconForWeapon(state.equippedWeapon):'＋';const weaponLabel=document.createElement('span');weaponLabel.className='equip-caption';weaponLabel.textContent='Weapon';weaponSlot.append(weaponIcon,weaponLabel);weaponSlot.disabled=!state.equippedWeapon;weaponSlot.onclick=()=>state.equippedWeapon&&equipWeapon(state.equippedWeapon);equipment.append(weaponSlot);
 const shieldSlot=document.createElement('button');shieldSlot.className='equip-slot';shieldSlot.textContent=state.equippedShield?shieldCatalog[state.equippedShield].name:'Shield (empty)';shieldSlot.disabled=!state.equippedShield;shieldSlot.onclick=()=>state.equippedShield&&equipShield(state.equippedShield);equipment.append(shieldSlot);
 for(const k of armorKeys){const item=document.createElement('button');item.className='equip-slot';
  item.setAttribute('aria-label',armorCatalog[k].slot+': '+(state.equipped[k]?armorCatalog[k].name:'Empty'));
  const icon=document.createElement('span');icon.className='item-icon';icon.setAttribute('aria-hidden','true');
  if(state.equipped[k])icon.innerHTML=equipmentIcons[k];else icon.textContent='＋';
  const caption=document.createElement('span');caption.className='equip-caption';caption.textContent=armorCatalog[k].slot;
  item.append(icon,caption);
  item.disabled=!state.equipped[k];item.title=state.equipped[k]?'Click to unequip • Right-click for options':'No item equipped';
  item.onclick=()=>toggleArmor(k);
  item.oncontextmenu=e=>{e.preventDefault();if(state.equipped[k])showMenu(e.clientX,e.clientY,[['Remove '+armorCatalog[k].name,()=>toggleArmor(k)],['Examine',()=>examine(k)]])};
  equipment.append(item);
 }
}
function say(s){const d=document.createElement('div');d.textContent=s;log.prepend(d)}function save(){localStorage.setItem('eldervale-save',JSON.stringify({...state,appearance,hp:combat.hp,combatXP:combat.xp,kills:combat.kills,x:player.position.x,z:player.position.z}));window.eldervaleSave?.()}
document.querySelector('#reset').onclick=()=>window.eldervaleReset?.();
let dest=null,action=null,yaw=.75,pitch=.8,zoom=24,drag=false,down=null;const ray=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),0);
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;down=[e.clientX,e.clientY];drag=false;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-down[0],dy=e.clientY-down[1];if(Math.abs(dx)+Math.abs(dy)>4)drag=true;if(drag){yaw-=dx*.007;pitch=T.MathUtils.clamp(pitch+dy*.004,.25,1.3)}down=[e.clientX,e.clientY]});
renderer.domElement.addEventListener('pointerup',e=>{if(!down)return;down=null;if(drag)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(targets,false);const point=new T.Vector3();const hitGround=ray.ray.intersectPlane(plane,point);
if(e.button===2){
 const choices=[];
 if(hits.length){const a=hits[0].object.userData;choices.push([a.kind==='creature'?'Attack '+a.mob.name:a.kind==='npc'?'Talk to '+a.profile.name:a.kind==='merchant'?'Trade with merchant':a.kind==='chest'?'Open armory chest':a.kind==='door'?(a.house.open?'Close door':'Open door'):'Gather '+a.kind,()=>{action=a;const goal=a.kind==='creature'?a.mob.root.position.clone():a.kind==='npc'?a.root.position.clone():a.kind==='door'?housePoint(a.house,0,2.4):new T.Vector3(a.x,0,a.z);setWalkDestination(goal);if(dest)markClick(dest.x,dest.z,'interact')}]);choices.push(['Examine '+a.kind,()=>say(a.kind==='creature'?a.mob.name+' ('+Math.max(0,a.mob.hp)+' HP)':a.kind==='npc'?a.profile.name+' — '+a.profile.role:a.kind==='merchant'?'A traveling trader who buys logs and ore.':a.kind==='chest'?'A chest of iron adventuring supplies.':a.kind==='door'?'A wooden door. Click to open or close.':'A harvestable '+a.kind+'.')])}
 if(hitGround)choices.push(['Walk here',()=>{action=null;setWalkDestination(point);closeDialog();if(dest)markClick(dest.x,dest.z,'walk')}]);
 choices.push(['Cancel',()=>{}]);showMenu(e.clientX,e.clientY,choices);return;
}
if(hits.length){action=hits[0].object.userData;const goal=action.kind==='creature'?action.mob.root.position.clone():action.kind==='npc'?action.root.position.clone():action.kind==='door'?housePoint(action.house,0,2.4):new T.Vector3(action.x,0,action.z);setWalkDestination(goal);if(dest)markClick(dest.x,dest.z,'interact');if(action.kind!=='npc')say(action.kind==='merchant'?'Walking to merchant...':'Approaching '+action.kind+'...')}else if(hitGround){action=null;setWalkDestination(point);closeDialog();if(dest)markClick(dest.x,dest.z,'walk')}});
renderer.domElement.addEventListener('wheel',e=>{zoom=T.MathUtils.clamp(zoom+e.deltaY*.015,9,42)},{passive:true});
const clock=new T.Clock();let phase=0,blend=0,saveTick=0;
function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.05);fpsSamples++;fpsSeconds+=dt;if(fpsSeconds>=1){if(clientSettings.fps)document.querySelector('#fps-counter').textContent=Math.round(fpsSamples/fpsSeconds)+' FPS';fpsSamples=0;fpsSeconds=0}let moving=false;
if(action?.kind==='creature'&&action.mob?.alive&&player.position.distanceTo(action.mob.root.position)<2.6){dest=null;walkQueue=[];faceTarget(player,action.mob.root.position);strike(action.mob)}
if(dest){const delta=dest.clone().sub(player.position);delta.y=0;const distance=delta.length();if(distance>(action?.kind==='creature'?2.4:action?2.1:.2)){moving=true;delta.normalize();const proposed=player.position.clone().addScaledVector(delta,Math.min(5*dt,distance));
 const collision=walkAllowed(player.position,proposed);
 if(!collision.blocked)player.position.copy(proposed);
 else{moving=false;dest=null;walkQueue=[];action=null;if(collision.house&&!collision.house.open)say('Door closed — click the door to open it.');else say('A building blocks the way. Walk around it.')}
 player.rotation.y=Math.atan2(delta.x,delta.z)}else{dest=null;if(walkQueue.length){dest=walkQueue.shift();}else if(action){const a=action;action=null;if(a.kind==='door'){toggleHouseDoor(a.house)}else if(a.kind==='creature'){if(a.mob.alive){strike(a.mob);if(a.mob.alive){action=a;dest=a.mob.root.position.clone()}}}else if(a.kind==='npc'){talkTo(a.profile)}else if(a.kind==='chest'){openArmoryChest()}else if(a.kind==='merchant'){const earned=state.wood*3+state.ore*5;state.gold+=earned;state.wood=0;state.ore=0;say(earned?'Sold resources for '+earned+' gold!':'Merchant: Bring me logs or ore.')}else if(state.wood+state.ore+state.armorOwned.filter(k=>!state.equipped[k]).length>=16)say('Inventory full! Visit the merchant.');else if(a.kind==='tree'){state.wood++;state.woodXP+=25;say('You chop logs. +25 XP')}else{state.ore++;state.miningXP+=25;say('You mine ore. +25 XP')}save();draw()}}}
combat.attackTimer=Math.max(0,combat.attackTimer-dt);combat.attackAnim=Math.max(0,combat.attackAnim-dt);combat.hitAnim=Math.max(0,combat.hitAnim-dt);healthBar.style.width=(combat.hp/combat.maxHp*100)+'%';
for(const mob of creatures){if(!mob.alive){mob.respawn-=dt;if(mob.respawn<=0){mob.alive=true;mob.hp=mob.maxHp;mob.root.position.copy(mob.home);mob.root.visible=true}continue}mob.attackCooldown=Math.max(0,mob.attackCooldown-dt);mob.wait-=dt;if(mob.wait<=0){const a=mob.root.position.x*.12+performance.now()*.0002;mob.goal.set(mob.home.x+Math.cos(a)*5,0,mob.home.z+Math.sin(a)*5);mob.wait=3+Math.random()*5}const distance=mob.root.position.distanceTo(player.position);if(mob.hostile&&distance<10){mob.goal.copy(player.position);if(distance>=1.45&&distance<2.3&&mob.attackCooldown===0){playerHit(mob);mob.attackCooldown=2.4}}const delta=mob.goal.clone().sub(mob.root.position);delta.y=0;if(delta.length()>(mob.hostile&&distance<10?1.9:.4)){delta.normalize();const step=Math.min(dt*(mob.hostile&&distance<10?1.7:.8),Math.max(0,distance-1.85));const proposed=mob.root.position.clone().addScaledVector(delta,step);if(proposed.distanceToSquared(player.position)>=1.45*1.45&&!walkAllowed(mob.root.position,proposed).blocked)mob.root.position.copy(proposed);mob.root.rotation.y=Math.atan2(delta.x,delta.z)}if(mob.hostile&&distance<10)faceTarget(mob.root,player.position);if(action?.kind==='creature'&&action.mob===mob&&dest){const toward=player.position.clone().sub(mob.root.position);toward.y=0;toward.normalize();dest.copy(mob.root.position).addScaledVector(toward,1.95)}}
for(const marker of markers.slice()){marker.age+=dt;const t=marker.age/1.05;marker.group.scale.setScalar(.75+t*.95);marker.ring.material.opacity=Math.max(0,1-t);marker.dot.material.opacity=Math.max(0,1-t);if(t>=1){scene.remove(marker.group);marker.ring.geometry.dispose();marker.ring.material.dispose();marker.dot.geometry.dispose();marker.dot.material.dispose();markers.splice(markers.indexOf(marker),1)}}
for(const npc of npcs){
 npc.wait-=dt;
 if(npc.profile.behavior==='stationary'){
  npc.goal.copy(npc.home);npc.wait=4;
 }else if(npc.wait<=0){
  const points=npc.profile.patrol||[[npc.home.x,npc.home.z]];
  npc.patrolIndex=(npc.patrolIndex+1)%points.length;
  const [x,z]=points[npc.patrolIndex];
  npc.goal.set(x,0,z);npc.wait=7+(npc.phase%3)*2;npc.phase++;npc.path=[];npc.pathGoal=null;
 }
 const previous=npc.root.position.clone();
 if(!npc.pathGoal||npc.pathGoal.distanceToSquared(npc.goal)>.5){
  npc.path=findWalkPath(previous,npc.goal,1400);
  npc.pathGoal=npc.goal.clone();
 }
 if(npc.path.length&&npc.path[0].distanceToSquared(previous)<.20)npc.path.shift();
 const waypoint=npc.path[0]||npc.goal;
 const toward=waypoint.clone().sub(previous);toward.y=0;
 if(toward.length()>.22){
  toward.normalize();
  const stepSize=Math.min(npc.pace*dt,previous.distanceTo(waypoint));
  const proposed=previous.clone().addScaledVector(toward,stepSize);
  const crowded=npcs.some(other=>other!==npc&&other.root.position.distanceToSquared(proposed)<1.05*1.05)||player.position.distanceToSquared(proposed)<.85*.85;
  if(!walkAllowed(previous,proposed).blocked&&!crowded){
   npc.root.position.copy(proposed);
   npc.root.rotation.y=Math.atan2(toward.x,toward.z);
  }
 }
 const actualDistance=npc.root.position.distanceTo(previous);
 if(actualDistance<.0001&&toward.lengthSq()>.1){npc.stuck+=dt;if(npc.stuck>1.5){npc.goal.copy(npc.home);npc.path=[];npc.pathGoal=null;npc.wait=1;npc.stuck=0}}
 else npc.stuck=0;
 // Foot cadence follows actual distance traveled, not wall-clock time.
 const speed=actualDistance/Math.max(dt,.001);
 const intensity=T.MathUtils.clamp(speed/.65,0,1);
 npc.walkBlend=T.MathUtils.lerp(npc.walkBlend,intensity,1-Math.exp(-9*dt));
 npc.walkPhase+=actualDistance*8.5;
 const gait=Math.sin(npc.walkPhase)*.48*npc.walkBlend;
 npc.leftLeg.rotation.x=gait;npc.rightLeg.rotation.x=-gait;
 npc.leftArm.rotation.x=-gait*.65+Math.sin(performance.now()*.001+npc.phase)*.025;
 npc.rightArm.rotation.x=gait*.65;
 npc.leftKnee.rotation.x=Math.max(0,-gait)*.9;
 npc.rightKnee.rotation.x=Math.max(0,gait)*.9;
 npc.leftElbow.rotation.x=-.10-Math.max(0,gait)*.25;
 npc.rightElbow.rotation.x=-.10-Math.max(0,-gait)*.25;
 if(action?.kind==='npc'&&action.root===npc.root&&dest)dest.copy(npc.root.position);
}
blend=T.MathUtils.lerp(blend,moving?1:0,1-Math.exp(-12*dt));if(moving)phase+=dt*10;const swing=Math.sin(phase)*.65*blend;ll.rotation.x=swing;rl.rotation.x=-swing;la.rotation.x=-swing*.7;ra.rotation.x=swing*.7;if(combat.attackAnim>0){const t=1-combat.attackAnim/.55;ra.rotation.x=-1.6+Math.sin(t*Math.PI)*2.7;ra.rotation.z=-.32;body.rotation.y=Math.sin(t*Math.PI)*-.15}else{ra.rotation.z=T.MathUtils.lerp(ra.rotation.z,0,dt*12);body.rotation.y=T.MathUtils.lerp(body.rotation.y,0,dt*10)}if(combat.hitAnim>0){body.rotation.z=Math.sin((1-combat.hitAnim/.35)*Math.PI)*.12}else body.rotation.z=T.MathUtils.lerp(body.rotation.z,0,dt*12);body.position.y=Math.abs(Math.sin(phase))*.06*blend;lk.rotation.x=Math.max(0,-swing)*.9;rk.rotation.x=Math.max(0,swing)*.9;le.rotation.x=-.12-Math.max(0,swing)*.22;re.rotation.x=combat.attackAnim>0?-.55:-.12-Math.max(0,-swing)*.22;cape.update(dt,blend);
const focus=player.position;camera.position.set(focus.x+Math.sin(yaw)*zoom*Math.cos(pitch),zoom*Math.sin(pitch),focus.z+Math.cos(yaw)*zoom*Math.cos(pitch));camera.lookAt(focus.x,1,focus.z);saveTick+=dt;if(saveTick>4){saveTick=0;save()}for(const animateTown of townAnimations)animateTown(performance.now()*.001);updateHouseRoofs();renderer.render(scene,camera);updateOverheadChat();if(Math.floor(performance.now()/250)!==window._mapFrame){window._mapFrame=Math.floor(performance.now()/250);drawMap(mapCtx,mapCanvas,false);if(mapOpen)drawMap(largeCtx,largeMap,true)}}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});draw();say('Welcome to Eldervale!');frame();