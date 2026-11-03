import {installFantasyHUD} from './hud-redesign.js?v=release-20261103-motion15';
import {installMMOControls,jumpHeight} from './mmorpg-controls.js?v=release-20261103-motion15';
import {configureBiomeTerrain,createNaturalSky,createMeadow} from './natural-environment.js?v=release-20261103-motion15';
import {buildNaturalForest,updateNaturalForest} from './natural-forest.js?v=release-20261103-motion15';
import {generatedWorld,generatedTreePoints,biomeColor} from './procedural-world.js?v=release-20261103-motion15';
import {runFrameWork,createLoadingPanel} from './frame-work.js?v=release-20261103-motion15';
import {createRegionStreamer} from './region-streamer.js?v=release-20261103-motion15';
import {searchRoute} from './route-search.js?v=release-20261103-motion15';
import {disposeEntityResources} from './entity-resources.js?v=release-20261103-motion15';
import {actorMenuLabel} from './context-label.js?v=release-20261103-motion15';
import {fixedObstacles,obstacleBlocks,createObstacleIndex} from './navigation-obstacles.js?v=release-20261103-motion15';
import {createTradePanel,requestDrop} from './player-trading.js?v=release-20261103-motion15';
import {createGroundDrops} from './ground-drops.js?v=release-20261103-motion15';
import {createCombatHealth} from './combat-health.js?v=release-20261103-motion15';
import {terrainCameraClearance} from './camera-clearance.js?v=release-20261103-motion15';
import {castle,inCastle} from './castle-layout.js?v=release-20261103-motion15';
import {createMotionTrack} from './motion-track.js?v=release-20261103-motion15';
import {lightingAt} from './world-lighting.js?v=release-20261103-motion15';
import {sculptPatches} from './terrain-patches.js?v=release-20261103-motion15';
import {fromPlayerRow} from './player-save.js?v=release-20261103-motion15';
import {combatLevel,skillLevel,crossedSwords} from './combat-level.js?v=release-20261103-motion15';
import {worldTemplates} from './world-templates.js?v=release-20261103-motion15';
import {actorModel,objectModel,serviceAttackEffect} from './world-models.js?v=release-20261103-motion15';
import {createCombatTurns,WALK_SPEED,SPRINT_SPEED} from './combat-turns.js?v=release-20261103-motion15';
import {armorCatalog,weaponStats,meleeProtection,meleeRoll} from './melee-stats.js?v=release-20261103-motion15';
import {stepEnergy,footIcon} from './run-energy.js?v=release-20261103-motion15';
import {resolveHit,createHitNumbers} from './combat-effects.js?v=release-20261103-motion15';
import {goods,sanitizeBank,createServicePanel} from './economy.js?v=release-20261103-motion15';
import {jewelryCatalog,jewelryBonus,gatheringXP} from './jewelry.js?v=release-20261103-motion15';
import {mapPoint,mapDestination as minimapDestination} from './minimap.js?v=release-20261103-motion15';
import {townResidents,animateTownActivity} from './town-life.js?v=release-20261103-motion15';
import {surfaceTexture,scaleSurfaceUV} from './surface-textures.js?v=release-20261103-motion15';
import {attachWeapon,attachShield} from './equipment-pose.js?v=release-20261103-motion15';
import {createPlayerHUD} from './player-hud.js?v=release-20261103-motion15';
import {oakcrossBuildings,decorateTownBuilding} from './town.js?v=release-20261103-motion15';
import {stabilizeSun} from './sun-shadow.js?v=release-20261103-motion15';
import {createDialoguePortrait} from './dialogue-portrait.js?v=release-20261103-motion15';
import {addSystemMessage,renderFeed} from './chat-feed.js?v=release-20261103-motion15';
import {deviceProfile,effectiveGraphics,installResponsiveLayout,installTouchGestures,bindGameViewport} from './responsive.js?v=release-20261103-motion15';
import * as T from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import {buildHumanoid} from './humanoid.js?v=release-20261103-motion15';
import {createHumanoidAnimator} from './animation.js?v=release-20261103-motion15';
import {worldRoads,roadPoints,lakeOutline,ribbonGeometry,landscapeLakes,worldRivers,landscapeSettlements,distanceToRoad} from './geography.js?v=release-20261103-motion15';
import {buildForest} from './forest.js?v=release-20261103-motion15';
import {publicCharacter,buildCharacterDisplay} from './character-display.js?v=release-20261103-motion15';
import {createLandscape,landscapeGeometry,noise} from './landscape.js?v=release-20261103-motion15';
const landscape=createLandscape();
import {buildPlateArmor} from './armor.js?v=release-20261103-motion15';
import {createCape} from './cape.js?v=release-20261103-motion15';
import {weaponCatalog,makeWeapon,iconForWeapon} from './weapons.js?v=release-20261103-motion15';
import {shieldCatalog,makeShield} from './shields.js?v=release-20261103-motion15';
const appearance=(()=>{try{return JSON.parse(localStorage.getItem('eldervale-save')||'{}').appearance||{}}catch{return {}}})();
const scene=new T.Scene();scene.background=new T.Color(0x9dbbc2);scene.fog=new T.Fog(0x9dbbc2,105,255);
const camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.1,450),renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;document.body.prepend(renderer.domElement);bindGameViewport(renderer.domElement,(width,height)=>{camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false)});
const skyLight=new T.HemisphereLight(0xcfe4ff,0x5a4d33,2);scene.add(skyLight);const sun=new T.DirectionalLight(0xffe9b6,2.3);sun.position.set(12,25,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);scene.add(sun.target);renderer.shadowMap.type=T.PCFSoftShadowMap;
Object.assign(sun.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:.5,far:140});sun.shadow.normalBias=.10;sun.shadow.bias=-.0003;sun.shadow.camera.updateProjectionMatrix();
// Seeded procedural canvas textures, cached and shared across meshes.
const textureCache=new Map();
function texture(kind,base){if(['masonry','wood','roof','plaster','floor','cloth'].includes(kind))return surfaceTexture(T,kind,base);const key=kind+base;if(textureCache.has(key))return textureCache.get(key);const canvas=document.createElement('canvas');const groundKind=kind==='grass'||kind==='dirt';const texSize=groundKind?256:128;canvas.width=texSize;canvas.height=texSize;const ctx=canvas.getContext('2d');ctx.fillStyle='#'+base.toString(16).padStart(6,'0');ctx.fillRect(0,0,texSize,texSize);let seed=base>>>0;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
for(let i=0;i<750;i++){const x=rnd()*128,y=rnd()*128,r=.4+rnd()*2.7;ctx.fillStyle=rnd()>.5?'rgba(255,248,208,.075)':'rgba(18,27,18,.09)';ctx.fillRect(x,y,r,r)}
if(kind==='water'){for(let i=0;i<180;i++){const x=rnd()*128,y=rnd()*128;ctx.strokeStyle=i%3?'#a9d1cb30':'#1f536333';ctx.lineWidth=.4+rnd()*.6;ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x+3,y-1,x+7,y+1,x+12,y);ctx.stroke()}}
if(kind==='wood'){for(let i=0;i<22;i++){ctx.strokeStyle=i%2?'#ffffff16':'#130d0b24';ctx.lineWidth=.5+rnd()*1.6;ctx.beginPath();const y=i*6+rnd()*3;ctx.moveTo(0,y);ctx.bezierCurveTo(36,y+3,78,y-3,128,y+2);ctx.stroke()}}
if(kind==='stone'){for(let i=0;i<20;i++){ctx.strokeStyle='#18201b23';ctx.beginPath();const x=rnd()*128,y=rnd()*128;ctx.moveTo(x,y);ctx.lineTo(x+5+rnd()*17,y+2+rnd()*9);ctx.stroke()}}
if(kind==='masonry'){
 ctx.lineWidth=2;ctx.strokeStyle='#363c345c';
 for(let row=0;row<8;row++){const y=row*16;ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();for(let x=(row%2?-16:0);x<128;x+=32){ctx.fillStyle=rnd()>.5?'#fff4d51a':'#17251b16';ctx.fillRect(x+2,y+2,28,12);ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+16);ctx.stroke()}}
}
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
const materialCache=new Map();function material(c,kind='stone'){const key=c+kind;if(!materialCache.has(key))materialCache.set(key,new T.MeshStandardMaterial({map:texture(kind,c),bumpMap:['masonry','roof','wood','plaster','floor'].includes(kind)?texture(kind,c):null,bumpScale:kind==='masonry'?.045:.018,roughness:kind==='wood'?.86:.95,color:0xffffff}));materialCache.get(key).userData.eldervaleShared=true;return materialCache.get(key)}const targets=[];
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
function box(w,h,d,c,x,y,z,p=scene,kind='stone'){const o=new T.Mesh(scaleSurfaceUV(new T.BoxGeometry(w,h,d),w,h,d),material(c,kind));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o}
function sphere(r,c,x,y,z,p=scene){const o=new T.Mesh(new T.SphereGeometry(r,10,8),material(c));o.position.set(x,y,z);o.castShadow=true;p.add(o);return o}
function cone(r,h,c,x,y,z,p=scene,kind='leaf'){const o=new T.Mesh(new T.ConeGeometry(r,h,7),material(c,kind));o.position.set(x,y,z);o.castShadow=true;p.add(o);return o}
const groundTexture=texture('grass',0x69865b).clone();
groundTexture.repeat.set(210,210);groundTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());groundTexture.needsUpdate=true;
const groundMaterial=new T.MeshStandardMaterial({map:groundTexture,vertexColors:true,roughness:.95});
groundMaterial.onBeforeCompile=shader=>{
 shader.uniforms.terrainRock={value:texture('stone',0x929087)};
 shader.vertexShader=shader.vertexShader.replace('#include <common>','#include <common>\nvarying float terrainHeight;varying float terrainSlope;').replace('#include <begin_vertex>','#include <begin_vertex>\nterrainHeight=position.y;terrainSlope=normal.y;');
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform sampler2D terrainRock;varying float terrainHeight;varying float terrainSlope;').replace('#include <map_fragment>','vec4 grass=texture2D(map,vMapUv);vec4 rock=texture2D(terrainRock,vMapUv*.55);float stone=clamp(smoothstep(18.0,42.0,terrainHeight)*.85+(1.0-smoothstep(.65,.88,terrainSlope))*.8,0.0,1.0);diffuseColor*=mix(grass,rock,stone);float snow=smoothstep(48.0,59.0,terrainHeight)*smoothstep(.55,.85,terrainSlope);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.86,.89,.86),snow*.85);');
};
if(generatedWorld)configureBiomeTerrain(T,groundMaterial,generatedWorld.seed);
const ground=new T.Mesh(landscapeGeometry(T,landscape),groundMaterial);ground.userData.terrainFixed=true;ground.receiveShadow=true;scene.add(ground);const walkSurfaces=[ground];
const dirtTexture=texture('dirt',0xa38b64).clone();dirtTexture.anisotropy=Math.min(8,renderer.capabilities.getMaxAnisotropy());dirtTexture.needsUpdate=true;
const pathMaterial=new T.MeshLambertMaterial({map:dirtTexture,color:0xffffff,polygonOffset:true,polygonOffsetFactor:-1});
function texturedPatch(radius,x,z,tint=0x789362){
 const geom=new T.CircleGeometry(radius,24),mat=new T.MeshLambertMaterial({color:tint,transparent:true,opacity:.30,depthWrite:false});
 const patch=new T.Mesh(geom,mat);patch.rotation.x=-Math.PI/2;patch.position.set(x,.013,z);scene.add(patch)
}
function disk(r,c,x,z){const m=new T.Mesh(new T.CircleGeometry(r,28),material(c));m.rotation.x=-Math.PI/2;m.position.set(x,.018,z);scene.add(m)}
let roadSurfaceIndex=0;
for(const [a,b] of worldRoads){
 const points=roadPoints(a,b);
 const verge=new T.Mesh(ribbonGeometry(T,points,3.8),material(0x79785a,'dirt'));verge.position.y=.020+roadSurfaceIndex*.001;verge.userData.terrainFixed=verge.userData.drape=true;verge.receiveShadow=true;scene.add(verge);
 const path=new T.Mesh(ribbonGeometry(T,points,2.7),pathMaterial);path.position.y=.027+roadSurfaceIndex++*.001;path.userData.terrainFixed=path.userData.drape=true;path.receiveShadow=true;scene.add(path);
}
if(!generatedWorld)texturedPatch(13,0,0,0x8a9870);
// A paved market square anchors the main town; streets meet its edges.
const plazaTexture=texture('masonry',0xa49d88).clone();plazaTexture.repeat.set(5,5);plazaTexture.needsUpdate=true;
const plaza=new T.Mesh(new T.CircleGeometry(10,8),new T.MeshLambertMaterial({map:plazaTexture}));
plaza.rotation.x=-Math.PI/2;plaza.rotation.z=Math.PI/8;plaza.position.y=.065;plaza.receiveShadow=true;plaza.userData.terrainFixed=true;if(!generatedWorld)scene.add(plaza);
for(let i=0;i<0;i++){const a=i*2.399963,r=8+Math.sqrt(i)*9.1,x=Math.sin(a)*r,z=Math.cos(a)*r;if(Math.abs(x)<410&&Math.abs(z)<410){const g=box(.11,.14,.11,i%3?0x79955b:0x9baa70,x,.08,z);g.rotation.y=a}}
// Draw-call-efficient tufts add near-ground depth without thousands of meshes.
const tuftGeometry=new T.ConeGeometry(.095,.32,3);
const tuftMaterial=new T.MeshLambertMaterial({color:0x789b58,side:T.DoubleSide});
const tuftCount=0,tufts=new T.InstancedMesh(tuftGeometry,tuftMaterial,tuftCount);
const tuftDummy=new T.Object3D();
for(let i=0;i<tuftCount;i++){
 const angle=i*2.3999632297,radius=10+Math.sqrt(i)*9.5;
 const x=Math.cos(angle)*radius,z=Math.sin(angle)*radius;
 tuftDummy.position.set(x,.12,z);tuftDummy.rotation.set(0,i*2.17,0);
 const size=.7+(Math.sin(i*1.37)*.5+.5)*.9;tuftDummy.scale.set(size,size,size);tuftDummy.updateMatrix();tufts.setMatrixAt(i,tuftDummy.matrix)
}
tufts.instanceMatrix.needsUpdate=true;tufts.frustumCulled=false;scene.add(tufts);
for(let i=0;i<(generatedWorld?0:38);i++){const a=i*2.4,r=17+i*3.8,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x)<405&&Math.abs(z)<405){const stone=sphere(.3+i%3*.12,0x8d8e7c,x,.16,z);stone.scale.y=.5}}
const forestTrees=[];
const treeHitGeometry=new T.ConeGeometry(2.35,6.5,8);
const treeHitMaterial=new T.MeshBasicMaterial({visible:false});
function tree(x,z){
 if(inCastle(x,z,9)||landscape.waterAt(x,z)>.01||distanceToRoad(x,z)<4||landscapeSettlements.some(([sx,sz])=>Math.hypot(x-sx,z-sz)<(sx===0&&sz===0?54:32)))return;
 forestTrees.push({x,z});
 // Retain individual harvest targets and world coordinates independently of rendering.
 const hit=new T.Mesh(treeHitGeometry,treeHitMaterial);hit.position.set(x,4,z);scene.add(hit);
 hit.userData={kind:'tree',x,z};targets.push(hit);
}
function rock(x,z){
 if(inCastle(x,z,9)||landscape.waterAt(x,z)>.01)return;
 const root=new T.Group();root.position.set(x,0,z);scene.add(root);
 const color=[0x777b78,0x898b7d,0x676f6c][Math.floor(Math.abs(Math.sin(x+z))*3)];
 const m=new T.Mesh(new T.DodecahedronGeometry(.9,0),material(color,'stone'));m.position.y=.57;m.scale.set(1.15,.75,1);m.rotation.y=x*.1;m.castShadow=true;m.receiveShadow=true;root.add(m);
 const smaller=new T.Mesh(new T.DodecahedronGeometry(.36,0),material(0x6f7770,'stone'));smaller.position.set(.68,.24,.18);smaller.castShadow=true;root.add(smaller);
 m.userData={kind:'rock',x,z};targets.push(m)
}
const houseInteriors=[];const mapProps=[];
function house(x,z,c,scale=1.65,rotation=0,options={}){
 const sx=scale*(options.width||1),sz=scale*(options.depth||1),wallKind=options.stone?'masonry':'plaster',roofColor=options.roof||0x634332;
 // Keep full building footprints ashore, including existing lakeside hamlets.
 const radius=2.4*Math.hypot(sx,sz);
 const dry=(px,pz)=>[-1,0,1].every(a=>[-1,0,1].every(b=>landscape.waterAt(px+a*radius,pz+b*radius)<=0));
 if(!dry(x,z)){let found=false;for(let r=2;r<=40&&!found;r+=2)for(let i=0;i<24;i++){const angle=i*Math.PI/12,px=x+Math.cos(angle)*r,pz=z+Math.sin(angle)*r;if(dry(px,pz)){x=px;z=pz;found=true;break}}}
 const group=new T.Group();group.scale.set(sx,scale,sz);group.rotation.y=rotation;
 const plotHeight=options.builder?landscape.walkHeight(x,z):landscape.levelBuildingPlot({x,z,scaleX:sx,scaleZ:sz,rotation,floorHeight:.125*scale});
 group.position.set(x,plotHeight,z);group.userData.terrainFixed=true;scene.add(group);
 // Real walk-in room, with a front doorway instead of a solid wall block.
 // Sink a stone plinth into the terrain and overlap the wall bottoms. The
 // exposed lip keeps grass and the nearly coplanar floor underside from
 // competing in the depth buffer as the camera moves. Keep the floor top
 // at .125 so doorway clearance and the existing walk-in room stay aligned.
 box(4.18,.7,3.94,0x777568,0,-.25,0,group,'stone');
 box(4,.085,3.7,0x81684c,0,.0825,0,group,options.stone?'masonry':'floor');
 // Walls meet at edges. Overlapping box caps used to compete in the depth
 // buffer along the corners, independently of the grass/foundation seam.
 box(3.64,3,.18,c,0,1.5,-1.83,group,wallKind);
 for(const side of [-1,1])box(.18,3,3.84,c,side*1.91,1.5,0,group,wallKind);
 for(const side of [-1,1])box(1.30,3,.18,c,side*1.17,1.5,1.83,group,wallKind);
 box(1.04,.75,.18,c,0,2.625,1.83,group,wallKind);
 for(const side of [-1,1]){
  box(.07,.38,3.42,0x69513b,side*1.79,.32,0,group,'wood');
  box(.14,2.8,.16,0x66503c,side*1.77,1.5,-1.65,group,'wood');
 }
 box(3.45,.38,.07,0x69513b,0,.32,-1.69,group,'wood');
 box(1.1,.025,1.8,options.stone?0x6b4d43:0x65715c,0,.14,.25,group,'cloth');
 box(1.0,.08,.38,0x75543a,-.75,1.28,-1.56,group,'wood');
 for(let i=0;i<4;i++)box(.12,.22+(i%2)*.10,.20,[0x80504a,0x697b66,0x9f875c][i%3],-1.08+i*.2,1.43,-1.55,group,'cloth');
 const roofParts=[];
 for(const side of [-1,1]){
  const trim=options.stone?0xc2bfae:0x715139;
  box(.20,3.15,.22,trim,side*1.94,1.55,1.83,group,options.stone?'masonry':'wood');
  box(.20,3.15,.22,trim,side*1.94,1.55,-1.83,group,options.stone?'masonry':'wood')
 }
 roofParts.push(box(4.25,.18,3.9,0x74543c,0,3.07,0,group,'wood'));
 // Roof geometry: ridge x=0 at y=4.40; eaves x=±2.25 at y=3.12.
 // Slopes descend away from the ridge, meeting cleanly at the center.
 const roofRun=2.25,roofRise=1.28,roofLength=Math.hypot(roofRun,roofRise);
 const roofAngle=Math.atan2(roofRise,roofRun);
 for(const side of [-1,1]){
  const roof=box(roofLength+.04,.16,4.35,roofColor,side*roofRun/2,3.12+roofRise/2,0,group,'roof');
  roof.rotation.z=-side*roofAngle;roofParts.push(roof);
  // Thin wooden fascia follows the actual eave rather than floating above it.
  const fascia=box(.18,.23,4.45,0x644a32,side*roofRun,3.11,0,group,'wood');roofParts.push(fascia);
 }
 // Close the triangular gable walls under the roof at front and back.
 for(const z of [-1.87,1.87]){
  const shape=new T.Shape();shape.moveTo(-2,3.08);shape.lineTo(2,3.08);shape.lineTo(0,4.21);shape.closePath();
  const gableMaterial=material(c,wallKind).clone();gableMaterial.side=T.DoubleSide;
  const gable=new T.Mesh(new T.ShapeGeometry(shape),gableMaterial);gable.position.z=z;gable.castShadow=true;group.add(gable);roofParts.push(gable);
 }
 // Hinged, clickable door. A closed door blocks entry.
 box(1.1,.14,.22,0x67452f,0,1.8,1.92,group,'wood');
 const doorPivot=new T.Group();doorPivot.position.set(-.52,0,1.86);group.add(doorPivot);
 const doorMesh=box(1.04,1.75,.13,0x654026,.52,.9,0,doorPivot,'wood');
 box(.12,.12,.09,0xc4a15d,.88,.93,.1,doorPivot,'stone');
 const doorHit=new T.Mesh(new T.BoxGeometry(1.15,1.95,.5),new T.MeshBasicMaterial({visible:false}));
 doorHit.position.set(0,.95,1.86);group.add(doorHit);
 const houseRecord={group,roofParts,inside:false,open:!!options.open,doorPivot,doorHit,type:options.type||'cottage',name:options.name||'Cottage',roofColor};
 if(houseRecord.open)doorPivot.rotation.y=-Math.PI*.53;
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
 if(options.type){decorateTownBuilding(T,houseRecord,{box,material});if(options.type!=='armory')buildingLabel(group,options.name)}
 return houseRecord;
}
function buildingLabel(group,caption){
 const canvas=document.createElement('canvas');canvas.width=512;canvas.height=96;const ctx=canvas.getContext('2d');ctx.fillStyle='#28372e';ctx.fillRect(0,0,512,96);ctx.strokeStyle='#cbb77d';ctx.lineWidth=5;ctx.strokeRect(3,3,506,90);ctx.font='bold 31px Georgia';ctx.textAlign='center';ctx.fillStyle='#f0d99b';ctx.fillText(caption.toUpperCase(),256,60,490);
 const labelTexture=new T.CanvasTexture(canvas);labelTexture.userData.entityOwned=true;const sign=new T.Mesh(new T.PlaneGeometry(2.8,.46),new T.MeshBasicMaterial({map:labelTexture}));sign.position.set(0,2.82,1.945);group.add(sign);
}
for(let i=0;i<(generatedWorld?0:520);i++){const a=i*2.399,r=14+Math.sqrt(i)*17,x=Math.sin(a)*r,z=Math.cos(a)*r;if(i%4===0)rock(x,z);else tree(x,z)}
// Oakcross: a walkable settlement, with a clear central square and houses around its edges.
for(const building of (generatedWorld?[]:oakcrossBuildings)){
 const rotation=building.z>15?Math.PI:building.x<-28?Math.PI/2:building.x>25?-Math.PI/2:0;
 house(building.x,building.z,building.color,building.scale,rotation,building);
}
const townStreets=[];
for(const h of houseInteriors){
 const door=new T.Vector3(0,0,2.4);h.group.localToWorld(door);
 const length=Math.hypot(door.x,door.z),start=[door.x*9/length,door.z*9/length];
 townStreets.push([start,[door.x,door.z]]);
 const corner=Math.abs(door.x)>Math.abs(door.z)?[start[0],door.z]:[door.x,start[1]];const points=[...Array.from({length:16},(_,i)=>[start[0]+(corner[0]-start[0])*i/15,start[1]+(corner[1]-start[1])*i/15]),...Array.from({length:16},(_,i)=>[corner[0]+(door.x-corner[0])*i/15,corner[1]+(door.z-corner[1])*i/15])];
 const geo=ribbonGeometry(T,points,h.type==='bank'||h.type==='hall'?3.2:2.3);
 const p=geo.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,landscape.heightAt(p.getX(i),p.getZ(i))+.045);geo.computeVertexNormals();
 const street=new T.Mesh(geo,pathMaterial);street.receiveShadow=true;street.userData.terrainFixed=street.userData.drape=true;scene.add(street);
}
if(!generatedWorld){house(-60,42,0xb7a08c);house(-54,48,0xaaa38a);house(73,-58,0xc3b29b);house(78,-51,0x99866c);house(-105,-91,0x9a9b87);house(102,103,0xb8a48d);house(-210,145,0xbda78a);house(-205,151,0xa8a089);house(260,-185,0xbda78a);house(265,-180,0xaaa08a);house(225,215,0xbaa78e);house(-275,-215,0xbda88d);}

// Outlying settlements now have a proper inn, workshop and communal building.
const settlementNames=['Northwatch','Eastmarch','Farwatch','Westmere','Suncrest','Greenwatch','Ashen Reach','Moonmere','Silverfin','Pinehollow','Stonebridge'];
(generatedWorld?[]:landscapeSettlements.slice(1)).forEach(([cx,cz],i)=>{
 if(i===6)return; // Preserve the ruined settlement's open silhouette.
 const name=settlementNames[i],slate=i%3===0;
 const plans=[[-13,-12,'inn','Wayfarer Inn',false],[15,-9,'forge','Workshop',true],[-14,14,i%2?'chapel':'hall',i%2?'Chapel':'Guildhall',true]];
 for(const [dx,dz,type,title,stone] of plans){
  const x=cx+dx,z=cz+dz,rotation=Math.atan2(cx-x,cz-z);
  const h=house(x,z,stone?0xa2a49b:0xbda98c,1.45,rotation,{type,name:name+' '+title,stone,open:true,roof:slate?0x536269:0x78543c});
  const door=new T.Vector3(0,0,2.5);h.group.localToWorld(door);
  const points=Array.from({length:17},(_,j)=>[cx+(door.x-cx)*j/16,cz+(door.z-cz)*j/16]);
  const geometry=ribbonGeometry(T,points,1.8),p=geometry.attributes.position;for(let j=0;j<p.count;j++)p.setY(j,landscape.heightAt(p.getX(j),p.getZ(j))+.05);geometry.computeVertexNormals();
  const lane=new T.Mesh(geometry,pathMaterial);lane.receiveShadow=true;lane.userData.terrainFixed=lane.userData.drape=true;scene.add(lane);
 }
});

const places=generatedWorld?[['Eldervale Castle',castle.x,castle.z],...generatedWorld.towns.map(t=>[t.name,t.x,t.z])]:[['Eldervale Castle',castle.x,castle.z],['Oakcross · Main Town',0,0],['Northwatch',-60,45],['Eastmarch',75,-55],['Old Cairn',132,26],['Farwatch',105,103],['Westmere',-210,145],['Suncrest',260,-185],['Greenwatch',225,215],['Ashen Ruins',-275,-215]];
// Lakeside settlements and landmarks. Water is a visible, discoverable world feature.
const worldLakes=landscapeLakes;
for(const lake of worldLakes){
 const outlineGeometry=factor=>{const shape=new T.Shape();lakeOutline(lake,factor).forEach(([x,z],i)=>i?shape.lineTo(x,-z):shape.moveTo(x,-z));shape.closePath();return new T.ShapeGeometry(shape)};
 const shore=new T.Mesh(outlineGeometry(1.08),new T.MeshStandardMaterial({color:0xb6a47a,roughness:1,side:T.DoubleSide}));
 shore.rotation.x=-Math.PI/2;shore.position.y=.045;shore.userData.terrainFixed=true;shore.receiveShadow=true;scene.add(shore);
 for(const [factor,color,y] of [[1,0x315d66,.06]]){
  const water=new T.Mesh(outlineGeometry(factor),new T.MeshStandardMaterial({color,metalness:.18,roughness:.27,side:T.DoubleSide}));
  water.rotation.x=-Math.PI/2;water.position.y=y;water.userData.terrainFixed=true;scene.add(water);
 }
 for(let i=0;i<(generatedWorld?0:12);i++){const a=i*Math.PI/6;const x=lake.x+Math.cos(a)*lake.rx*1.13,z=lake.z+Math.sin(a)*lake.rz*1.13;if(i%3===0)rock(x,z);else if(i%3===1)tree(x,z)}
 // Wooden fishing dock reaches from the eastern bank toward the lake.
 const dx=lake.x+lake.rx*.88;
 box(5,.22,2.4,0x8b6542,dx,.32,lake.z,scene,'wood');
 for(const x of [dx-2,dx+2])for(const z of [lake.z-1,lake.z+1])box(.2,.75,.2,0x5a402d,x,.35,z,scene,'wood');
 mapProps.push({x:dx,z:lake.z,color:'#e5c37c'});
}
// Dense forest biomes use the same noise field as the atlas; roads and hamlets stay clear.
for(let gx=-402;gx<=(generatedWorld?-403:402);gx+=7)for(let gz=-402;gz<=402;gz+=7){
 const seed=Math.sin(gx*12.9898+gz*78.233)*43758.5453,rnd=seed-Math.floor(seed);
 const x=gx+(rnd-.5)*5,z=gz+(Math.sin(seed)*.5)*5;
 if(noise(x/90+17,z/90-11)<.55||rnd<.18||landscape.heightAt(x,z)>35||distanceToRoad(x,z)<5)continue;
 if(landscapeSettlements.some(([sx,sz])=>Math.hypot(x-sx,z-sz)<38))continue;
 tree(x,z);
}
// Weathered outcrops break up the highlands and retain the existing mining interaction.
for(let i=0;i<(generatedWorld?0:240);i++){
 const x=Math.sin(i*127.1)*405,z=Math.cos(i*311.7)*405;
 if(!inCastle(x,z,5)&&landscape.heightAt(x,z)>15&&distanceToRoad(x,z)>6&&landscape.canWalk(x,z))rock(x,z);
}
if(generatedWorld)for(const {x,z}of generatedTreePoints(generatedWorld.seed,(x,z)=>!inCastle(x,z,9)&&landscape.waterAt(x,z)<=.01&&distanceToRoad(x,z)>=5&&!landscapeSettlements.some(([sx,sz])=>Math.hypot(x-sx,z-sz)<38)))tree(x,z);
const forestBatches=buildNaturalForest(T,scene,forestTrees,{seed:generatedWorld?.seed||2419,wood:material(0x665039,'wood'),leaf:material(0xffffff,'leaf'),heightAt:landscape.heightAt});
const extraSettlements=[
 {name:'Moonmere',x:-114,z:82,color:0xb4a18a},
 {name:'Silverfin',x:187,z:74,color:0xc3ae92},
 {name:'Pinehollow',x:-152,z:-133,color:0xa79e8a},
 {name:'Stonebridge',x:164,z:-116,color:0xb7a58b}
];
for(const town of (generatedWorld?[]:extraSettlements)){
 for(let i=0;i<5;i++){const a=i*Math.PI*2/5+.3,r=9+(i%2)*5;house(town.x+Math.cos(a)*r,town.z+Math.sin(a)*r,town.color,1.4,a+Math.PI)}
 places.push([town.name,town.x,town.z]);
}
// Oakcross starter armory: a one-time supply chest in the northern house.
const armoryHouse=houseInteriors.find(h=>h.type==='armory')||{group:new T.Group()};if(generatedWorld)armoryHouse.group.visible=false;
// Identify the starter armory from outside so players can find the chest.
const armorySignCanvas=document.createElement('canvas');armorySignCanvas.width=512;armorySignCanvas.height=128;
const armorySignCtx=armorySignCanvas.getContext('2d');armorySignCtx.fillStyle='#35281d';armorySignCtx.fillRect(0,0,512,128);
armorySignCtx.fillStyle='#f4d492';armorySignCtx.font='bold 48px Georgia';armorySignCtx.textAlign='center';armorySignCtx.fillText('STARTER ARMORY',256,79);
const armorySign=new T.Mesh(new T.PlaneGeometry(2.8,.7),new T.MeshBasicMaterial({map:new T.CanvasTexture(armorySignCanvas),side:T.DoubleSide}));
armorySign.position.set(0,2.78,1.99);armoryHouse.group.add(armorySign);
const chestRoot=new T.Group();armoryHouse.group.add(chestRoot);
chestRoot.position.set(0,0,.15);
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
// Visible golden glow highlights the interactable supply chest inside the armory.
const chestGlow=new T.PointLight(0xffc46b,2.0,6);chestGlow.position.set(0,1.25,.15);chestRoot.add(chestGlow);
function openArmoryChest(){if(window.eldervaleAuthority)return;
 if(!state.starterBattleaxeGranted){if(!state.weaponsOwned.includes('battleaxe'))state.weaponsOwned.push('battleaxe');state.starterBattleaxeGranted=true}
 if(!state.starterJewelryGranted){for(const key of Object.keys(jewelryCatalog))if(!state.jewelryOwned.includes(key))state.jewelryOwned.push(key);state.starterJewelryGranted=true}
 if(state.starterChestClaimed){if(!state.starterDaggerGranted){if(!state.weaponsOwned.includes('dagger'))state.weaponsOwned.push('dagger');state.starterDaggerGranted=true}save();draw();say('Starter supplies already claimed. Any new starter jewelry, dagger or battleaxe has been added once.');return}
 state.starterChestClaimed=true;state.starterDaggerGranted=true;state.starterShieldsGranted=true;
 for(const key of armorKeys)if(!state.armorOwned.includes(key))state.armorOwned.push(key);
 for(const key of Object.keys(weaponCatalog))if(!state.weaponsOwned.includes(key))state.weaponsOwned.push(key);
 for(const key of Object.keys(shieldCatalog))if(!state.shieldsOwned.includes(key))state.shieldsOwned.push(key);
 state.starterShieldsGranted=true;
 chestLid.rotation.x=-1.1;
 say('Armory chest opened! Iron armor, a crimson cape, four swords, an axe and a pickaxe, an iron kiteshield and an iron square shield, a Woodland amulet and a Prospector’s ring added to your inventory.');
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
 const distance=Math.hypot(to.x-from.x,to.z-from.z),samples=Math.max(1,Math.ceil(distance/.18));
 for(let i=1;i<=samples;i++){const t=i/samples,px=from.x+(to.x-from.x)*t,pz=from.z+(to.z-from.z)*t;if(window.eldervalePropCollision?.(px,pz)||window.eldervaleCastleCollision?.(px,pz))return {blocked:true,terrain:true};if(!landscape.canWalk(from.x+(to.x-from.x)*t,from.z+(to.z-from.z)*t))return {blocked:true,terrain:true}}
 const minX=Math.min(from.x,to.x),maxX=Math.max(from.x,to.x),minZ=Math.min(from.z,to.z),maxZ=Math.max(from.z,to.z);
 for(const h of houseInteriors){
  const g=h.group,radiusWorld=Math.hypot(2.17*g.scale.x,2.09*g.scale.z);if(g.position.x+radiusWorld<minX||g.position.x-radiusWorld>maxX||g.position.z+radiusWorld<minZ||g.position.z-radiusWorld>maxZ)continue;
  const c=Math.cos(g.rotation.y),s=Math.sin(g.rotation.y),ax=((from.x-g.position.x)*c-(from.z-g.position.z)*s)/g.scale.x,az=((from.x-g.position.x)*s+(from.z-g.position.z)*c)/g.scale.z,bx=((to.x-g.position.x)*c-(to.z-g.position.z)*s)/g.scale.x,bz=((to.x-g.position.x)*s+(to.z-g.position.z)*c)/g.scale.z;
  let previousX=ax,previousZ=az;
  for(let i=1;i<=samples;i++){const t=i/samples,x=ax+(bx-ax)*t,z=az+(bz-az)*t;if(Math.abs(x)>=2.17||Math.abs(z)>=2.09){previousX=x;previousZ=z;continue}const inside=Math.abs(x)<1.65&&Math.abs(z)<1.57,wasInside=Math.abs(previousX)<1.65&&Math.abs(previousZ)<1.57;if(inside&&wasInside){previousX=x;previousZ=z;continue}const doorway=Math.abs(x)<.49&&Math.abs(previousX)<.49;if(h.open&&doorway&&z>1.2&&previousZ>1.2){previousX=x;previousZ=z;continue}return {blocked:true,house:h,doorway};}
 }
 return {blocked:false};
}
// The same incremental search serves synchronous offline AI and cancellable player routes.
function routeSteps(start,goal,maxNodes=30000){return searchRoute({start,goal,maxNodes,heightAt:landscape.walkHeight,canTravel:(a,b)=>!walkAllowed(a,b).blocked})}
function findWalkPath(start,goal,maxCells=30000){const work=routeSteps(start,goal,maxCells);let next;do{next=work.next()}while(!next.done);return next.value.map(p=>new T.Vector3(p.x,p.y,p.z));}
const areaLoading=createLoadingPanel();var navigationGeneration=0,routeController=null,routePending=false;
renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();window.eldervaleGraphicsRecovery?.end();const ticket=areaLoading.begin('Restoring the game view…');window.eldervaleGraphicsRecovery=ticket;setTimeout(()=>{if(window.eldervaleGraphicsRecovery===ticket)ticket.fail?.('The graphics connection was interrupted. Reload to reconnect.',()=>location.reload())},10000)});
renderer.domElement.addEventListener('webglcontextrestored',()=>{window.eldervaleGraphicsRecovery?.end();window.eldervaleGraphicsRecovery=null;});

function routeTo(target){
 const goal=target.clone();goal.y=landscape.walkHeight(goal.x,goal.z);
 const h=houseInteriors.find(h=>insideHouse(h,goal));
 if(h&&!insideHouse(h,player.position)){
  const door=housePoint(h,0,2.48),threshold=housePoint(h,0,1.08);
  if(!h.open){navigationAfterDoor=target.clone();action={kind:'door',house:h};return housePoint(h,0,2.48)}
  // Enter through the doorway, then continue to the clicked destination.
  walkQueue=[threshold,goal];return door;
 }
 const current=houseInteriors.find(h=>insideHouse(h,player.position));
 if(current&&!insideHouse(current,goal)){
  const threshold=housePoint(current,0,1.08),door=housePoint(current,0,2.48);
  if(!current.open){navigationAfterDoor=target.clone();action={kind:'door',house:current};return housePoint(current,0,1.08)}
  walkQueue=[door,goal];return threshold;
 }
 return goal;
}
var navigationAfterDoor=null,pendingPickup=null;let walkQueue=[],mapDestination=null;
async function setWalkDestination(point){
 const generation=++navigationGeneration;routeController?.abort();const controller=new AbortController();routeController=controller;routePending=true;
 navigationAfterDoor=null;walkQueue=[];if(action?.kind!=='creature')combatTurns.cancel();
 const target=routeTo(point),stops=[target,...walkQueue],requestAction=action;walkQueue=[];dest=null;mapDestination=point.clone();markClick(point.x,point.z,requestAction?'interact':'walk');
 const ticket=areaLoading.begin('Finding a clear route…',{cancel:()=>{controller.abort();navigationGeneration++;routePending=false;mapDestination=null;void window.eldervaleRealm?.command('stop')}});
 let pausePromise=null;const pauseTimer=setTimeout(()=>{if(generation===navigationGeneration&&window.eldervaleAuthority&&!realmInCombat)pausePromise=window.eldervaleRealm?.command('stop')},120);
 try{
  await window.eldervaleRegionStreamer?.idle();
  if(controller.signal.aborted)return;
  const all=[];let current=player.position.clone();for(const stop of stops){const path=await runFrameWork(routeSteps(current,stop),{signal:controller.signal,onProgress:p=>ticket.progress(0,0,p?.visited?'Checking paths around nearby obstacles…':null)});if(!path.length&&Math.hypot(current.x-stop.x,current.z-stop.z)>.4){say('That destination is currently unreachable.');break}all.push(...path.map(p=>new T.Vector3(p.x,p.y,p.z)));current=stop;}
  clearTimeout(pauseTimer);if(pausePromise)await pausePromise;if(generation!==navigationGeneration)return;ticket.end();
  dest=all.shift()||null;walkQueue=all;mapDestination=all.at(-1)?.clone()||dest?.clone()||null;
  if(window.eldervaleAuthority){const route=[dest,...walkQueue].filter(Boolean).slice(0,128).map(p=>[p.x,p.z]);const target=requestAction?.realmId||requestAction?.worldEntityId||requestAction?.mob?.realmId||requestAction?.profile?.realmId||requestAction?.house?.realmId;await window.eldervaleRealm?.command('move',{path:route,target:target||null,kind:requestAction?.kind||'walk'});}
 }catch(error){if(error.name!=='AbortError'){say('The route could not be loaded. Please choose a destination again.');console.warn('Route loading:',error);}}finally{clearTimeout(pauseTimer);ticket.end();if(generation===navigationGeneration)routePending=false;}
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
// Keep the old well in the western village; the central plaza belongs to the fountain.
if(!generatedWorld){villageWell(-68,37);marketStall(-10,6,0x9e5b43);marketStall(10,5,0x4f7d64);
for(const [x,z] of [[-13,9],[-9,9],[8,9],[13,9],[-20,-5],[22,16],[-8,-11],[15,-12]])villageCrate(x,z,x*.2);
for(const [x,z] of [[-12,11],[-11,11],[12,10],[13,10],[-22,-8],[25,13]])villageBarrel(x,z);
villageFence(-25,-10,8,.05);villageFence(26,-12,7,-.25);villageFence(-23,24,8,.1);
signpost(4,-12);}
// Oakcross town atmosphere: animated fountain, lanterns, flowerbeds, benches, banners, birds.
const townAnimations=[];
function fountain(x,z){
 const g=new T.Group();g.userData.waterSource=true;g.position.set(x,0,z);scene.add(g);
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
 g.userData.lamp=true;
}
for(const [x,z]of landscapeSettlements)for(const [dx,dz]of [[-7,-7],[7,-7],[-7,7],[7,7]])lantern(x+dx,z+dz);
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
if(!generatedWorld){fountain(1,-1); // Central gathering landmark.
for(const [x,z] of [[-10,-9],[11,-9],[-15,14],[16,15],[0,18]])lantern(x,z);
for(const [x,z,seed] of [[-6,-6,0],[7,-6,1],[-15,4,2],[15,1,3],[-7,15,0],[9,15,1]])flowerbed(x,z,seed);
bench(-5,2,.25);bench(7,2,-.2);bench(-2,8,Math.PI);bench(5,-8,0);
banner(-12,-3,0x9a4c43);banner(12,-3,0x476f85);banner(-2,15,0x9d8151);
birds(0,0);
// Forest glades and distant ruins make the expanded wilderness feel distinct.
for(let i=0;i<16;i++){const a=i*Math.PI*2/16;box(1.6,1.1+(i%4)*.4,1.5,0x6d716b,132+Math.cos(a)*9,.7,26+Math.sin(a)*9)}
// Additional regions: winding roads, villages, groves and landmarks.

for(const [x,z,r,c] of [[-190,155,18,0x537d55],[245,-170,25,0x6b8052],[210,230,19,0x78926b],[-260,-220,22,0x708660]])disk(r,c,x,z);
for(let i=0;i<60;i++){const a=i*2.4,r=12+i*.8;const x=250+Math.sin(a)*r,z=-180+Math.cos(a)*r;const stone=sphere(.6+i%4*.16,0x797f76,x,.32,z);stone.scale.y=.55}
for(let i=0;i<16;i++){const a=i*Math.PI/8;box(1.8,1.2+i%3,1.8,0x74776e,-285+Math.cos(a)*13,.8,-220+Math.sin(a)*13)}
// Ancient stonework gives Old Cairn a discoverable silhouette and history.
const cairn=new T.Group();cairn.position.set(132,0,26);scene.add(cairn);
for(let i=0;i<9;i++){const a=i*Math.PI*2/9,h=1.8+(i%3)*.65;const standing=box(.8,h,.65,0x7e8277,Math.cos(a)*7,h/2,Math.sin(a)*7,cairn,'stone');standing.rotation.z=Math.sin(i*4)*.12;standing.rotation.y=a;if(i%3===0)box(3.1,.5,.85,0x828578,Math.cos(a)*7,h+.18,Math.sin(a)*7,cairn,'stone')}
box(2.4,.9,1.4,0x777e76,0,.45,0,cairn,'stone');box(2.7,.23,1.7,0x939788,0,1,0,cairn,'stone');
for(let i=0;i<15;i++){const a=i*2.4,r=2.5+i*.42;const rubble=sphere(.24+(i%3)*.10,0x777d72,Math.cos(a)*r,.12,Math.sin(a)*r,cairn);rubble.scale.set(1,.5,.7)}
mapProps.push({x:132,z:26,color:'#b6b49c'});
}
const merchant=new T.Group();merchant.position.set(-3,0,7);scene.add(merchant);if(generatedWorld)merchant.visible=false;
const trader=buildHumanoid(T,merchant,{skin:0xd8a57e,shirt:0x704c77,pants:0x514638,hairColor:0x30231f,hair:'Long'});
// The shopkeeper uses the same skeleton as other NPCs, with a distinct apron and belt.
box(.54,.69,.045,0x9a7953,0,1.735,.225,merchant,'wood');box(.78,.12,.47,0x4b3428,0,1.305,0,merchant,'wood');
const mh=new T.Mesh(new T.SphereGeometry(.43,8,6),new T.MeshBasicMaterial({visible:false}));mh.position.set(0,1.45,0);merchant.add(mh);mh.userData={kind:'merchant',x:-3,z:7};targets.push(mh);
if(!generatedWorld)box(2.5,.25,1,0x805832,-3,1,9,scene,'wood');
const player=new T.Group();scene.add(player);const body=new T.Group();player.add(body);
const avatar=buildHumanoid(T,body,{skin:appearance.skin,shirt:appearance.shirt,pants:appearance.pants,hairColor:appearance.hairColor,hair:appearance.hair,face:appearance.face,beard:appearance.beard});
const playerAnimator=createHumanoidAnimator(avatar);
const merchantAnimator=createHumanoidAnimator(trader);
// Other online adventurers and short-lived overhead chat bubbles.
const remotePlayers=new Map(),chatBubbles=new Map();
// Compact chat on narrow screens leaves the playfield and inventory accessible.
const mobileLayout=matchMedia('(max-width:700px)');
function compactMobileChat(){if(!mobileLayout.matches)return;document.querySelector('#social-panel')?.classList.add('collapsed');const toggle=document.querySelector('#social-toggle');if(toggle)toggle.textContent='Show Chat'}
mobileLayout.addEventListener('change',compactMobileChat);compactMobileChat();
const bubbleLayer=document.createElement('div');bubbleLayer.id='overhead-chat-layer';bubbleLayer.style.cssText='position:fixed;inset:0;z-index:45;pointer-events:none;overflow:hidden';document.body.append(bubbleLayer);
window.eldervaleGetPlayerPosition=()=>({x:Math.round(player.position.x*10)/10,z:Math.round(player.position.z*10)/10,yaw:player.rotation.y,combatLevel:combatLevel(state),...publicCharacter(appearance,{armor:state.equipped,weapon:state.equippedWeapon,shield:state.equippedShield})});
window.eldervaleUpdatePlayers=entries=>{
 if(!Array.isArray(entries))return;
 const seen=new Set();
 for(const entry of entries){if(!entry||typeof entry!=='object'||!entry.id||!Number.isFinite(entry.x)||!Number.isFinite(entry.z))continue;seen.add(entry.id);
 let other=remotePlayers.get(entry.id);
 if(!other){const root=new T.Group();scene.add(root);const display=buildCharacterDisplay(T,root,entry.appearance,entry.loadout);const tag=document.createElement('div');tag.style.cssText='position:fixed;padding:3px 7px;background:#14221cdd;color:#f4e2ba;border:1px solid #9b8659;border-radius:5px;font:12px Arial;white-space:nowrap;pointer-events:none';tag.textContent=String(entry.username||'Adventurer').slice(0,24);bubbleLayer.append(tag);other={root,tag,animator:display,signature:JSON.stringify(display.data),target:new T.Vector3(entry.x,0,entry.z),yaw:0};root.position.copy(other.target);const hit=new T.Mesh(new T.CylinderGeometry(.65,.65,2.8,10),new T.MeshBasicMaterial({visible:false}));hit.position.y=1.4;root.add(hit);hit.userData={kind:'player',playerId:entry.id};targets.push(hit);other.hit=hit;remotePlayers.set(entry.id,other)}
 const cosmetics=publicCharacter(entry.appearance,entry.loadout),signature=JSON.stringify(cosmetics);
 if(signature!==other.signature){other.animator.dispose();other.animator=buildCharacterDisplay(T,other.root,cosmetics.appearance,cosmetics.loadout);other.signature=signature}
 other.username=String(entry.username||'Adventurer').slice(0,24);other.combatLevel=Math.max(1,Math.min(100,Math.floor(entry.combatLevel||1)));other.tag.textContent='Lv '+other.combatLevel+' · '+other.username;
 other.motion||=createMotionTrack();other.motion.push(realmFrameTime||Date.now(),{x:entry.x,z:entry.z,yaw:entry.yaw||0,moving:true});other.running=entry.run===true;other.target.set(entry.x,0,entry.z);other.yaw=Number.isFinite(entry.yaw)?entry.yaw:0;
 // Treat long jumps as teleports rather than animating across the whole map.
 if(other.root.position.distanceToSquared(other.target)>400)other.root.position.copy(other.target);
 }
 for(const [id,other] of remotePlayers)if(!seen.has(id)){other.animator.dispose();const ti=targets.indexOf(other.hit);if(ti>=0)targets.splice(ti,1);scene.remove(other.root);other.tag.remove();remotePlayers.delete(id);const bubble=chatBubbles.get(id);bubble?.node.remove();chatBubbles.delete(id)}
};
window.eldervaleShowChatBubble=(id,name,message)=>{
 if(!id||!message)return;const old=chatBubbles.get(id);old?.node.remove();
 const node=document.createElement('div');node.style.cssText='position:fixed;max-width:230px;padding:7px 10px;border:1px solid #d1b878;border-radius:12px;background:#f5e8c9;color:#29251d;box-shadow:0 3px 12px #0009;text-align:center;font:12px Arial;overflow-wrap:anywhere;pointer-events:none';
 node.className='overhead-chat-bubble';node.textContent=String(message).slice(0,240);bubbleLayer.append(node);chatBubbles.set(id,{node,expires:performance.now()+6500});
};
function updateOverheadChat(){
 const selfId=window.eldervaleUserId;const projected=new T.Vector3();
 for(const [id,other] of remotePlayers){projected.set(other.root.position.x,other.root.position.y+3.05,other.root.position.z).project(camera);const visible=projected.z<1&&projected.z>-1&&other.root.position.distanceTo(player.position)<75;other.tag.style.display=visible?'block':'none';if(visible){other.tag.style.left=((projected.x+1)*innerWidth/2-other.tag.offsetWidth/2)+'px';other.tag.style.top=((1-projected.y)*innerHeight/2)+'px'}}
 for(const [id,bubble] of chatBubbles){if(performance.now()>bubble.expires){bubble.node.remove();chatBubbles.delete(id);continue}const other=id===selfId?player:remotePlayers.get(id)?.root;if(!other){bubble.node.style.display='none';continue}projected.set(other.position.x,other.position.y+3.65,other.position.z).project(camera);const visible=projected.z<1&&projected.z>-1&&other.position.distanceTo(player.position)<75;bubble.node.style.display=visible?'block':'none';if(visible){bubble.node.style.left=((projected.x+1)*innerWidth/2-bubble.node.offsetWidth/2)+'px';bubble.node.style.top=((1-projected.y)*innerHeight/2-bubble.node.offsetHeight)+'px'}}
}
const saved=JSON.parse(localStorage.getItem('eldervale-save')||localStorage.getItem('ashen-realms-save')||'{}');
const combat={hp:typeof saved.hp==='number'?Math.max(1,Math.min(100,saved.hp)):100,maxHp:100,xp:saved.combatXP||0,kills:saved.kills||0,attackTimer:0,respawnTimer:0,attackAnim:0,hitAnim:0,blockAnim:0,stanceTimer:0};
const armorKeys=Object.keys(armorCatalog);
const state={fishingPole:saved.fishingPole||0,bait:saved.bait||0,rawFish:saved.rawFish||0,worldReceipts:Array.isArray(saved.worldReceipts)?saved.worldReceipts:[],wood:saved.wood||0,ore:saved.ore||0,gold:saved.gold||0,woodXP:saved.woodXP||0,miningXP:saved.miningXP||0,
armorOwned:Array.isArray(saved.armorOwned)?saved.armorOwned.filter(k=>armorCatalog[k]):[],
equipped:(saved.equipped&&typeof saved.equipped==='object')?saved.equipped:{},weaponsOwned:Array.isArray(saved.weaponsOwned)?saved.weaponsOwned.filter(k=>weaponCatalog[k]):[],equippedWeapon:weaponCatalog[saved.equippedWeapon]?saved.equippedWeapon:null,starterChestClaimed:!!saved.starterChestClaimed,shieldsOwned:Array.isArray(saved.shieldsOwned)?saved.shieldsOwned.filter(k=>shieldCatalog[k]):[],equippedShield:shieldCatalog[saved.equippedShield]?saved.equippedShield:null};
for(const key of ['attackXP','strengthXP','defenceXP','hitpointsXP','rangedXP','magicXP','prayerXP','firemakingXP','fishingXP','cookingXP','smithingXP','craftingXP','herbloreXP','farmingXP','agilityXP','thievingXP'])state[key]=Number.isFinite(Number(saved[key]))?Math.max(0,Math.floor(Number(saved[key]))):0;
state.jewelryOwned=Array.isArray(saved.jewelryOwned)?saved.jewelryOwned.filter(k=>jewelryCatalog[k]):[];for(const slot of ['amulet','trinket'])state[slot]=state.jewelryOwned.includes(saved[slot])&&jewelryCatalog[saved[slot]]?.slot===slot?saved[slot]:null;
state.bank=sanitizeBank(saved.bank);state.runEnergy=Number.isFinite(saved.runEnergy)?Math.max(0,Math.min(100,saved.runEnergy)):100;
state.starterJewelryGranted=!!saved.starterJewelryGranted||state.jewelryOwned.length>0||Object.keys(state.bank).some(k=>k.startsWith('jewelry:'));state.starterBattleaxeGranted=!!saved.starterBattleaxeGranted||state.weaponsOwned.includes('battleaxe')||!!state.bank['weapon:battleaxe'];state.starterDaggerGranted=!!saved.starterDaggerGranted||state.weaponsOwned.includes('dagger')||!!state.bank['weapon:dagger'];
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
function refreshArmor(){for(const hair of avatar.hairMeshes)hair.visible=!state.equipped.helm;avatar.torso.visible=!state.equipped.chest;for(const part of avatar.clothingMeshes)part.visible=!state.equipped.chest;for(const k of armorKeys){if(k==='cape'){cape.mesh.visible=!!state.equipped.cape;continue}for(const m of pieces[k])m.visible=!!state.equipped[k]}}
refreshArmor();
const weaponMeshes=new Map();
for(const key of Object.keys(weaponCatalog)){const model=makeWeapon(T,key);attachWeapon(avatar,model,key);model.visible=false;weaponMeshes.set(key,model)}
const shieldMeshes=new Map();
for(const key of Object.keys(shieldCatalog)){const model=makeShield(T,key);attachShield(avatar,model);model.visible=false;shieldMeshes.set(key,model)}
if(state.equippedWeapon==='twohand')state.equippedShield=null;
function refreshShield(){for(const [key,model] of shieldMeshes)model.visible=state.equippedShield===key}
function equipShield(key){if(window.eldervaleAuthority){void window.eldervaleRealm?.command('equip',{slot:'shield',key});return}if(!state.shieldsOwned.includes(key))return;state.equippedShield=state.equippedShield===key?null:key;if(state.equippedShield&&state.equippedWeapon==='twohand'){state.equippedWeapon=null;refreshWeapon()}refreshShield();say(state.equippedShield?'Equipped '+shieldCatalog[key].name:'Unequipped shield');save();draw()}
refreshShield();
function refreshWeapon(){for(const [key,model] of weaponMeshes)model.visible=state.equippedWeapon===key}
function equipWeapon(key){if(window.eldervaleAuthority){void window.eldervaleRealm?.command('equip',{slot:'weapon',key});return}if(!state.weaponsOwned.includes(key))return;state.equippedWeapon=state.equippedWeapon===key?null:key;if(state.equippedWeapon==='twohand'){state.equippedShield=null;refreshShield()}refreshWeapon();say(state.equippedWeapon?'Equipped '+weaponCatalog[key].name:'Unequipped weapon');save();draw()}
refreshWeapon();
if(Number.isFinite(saved.x)&&Number.isFinite(saved.z)){const p=landscape.nearestDryPoint(saved.x,saved.z);player.position.set(p.x,0,p.z);if(Math.hypot(p.x,p.z)<2.5)player.position.z=5}else player.position.set(0,0,5);
const stats=document.querySelector('#stats'),inventory=document.querySelector('#inventory'),log=document.querySelector('#log'),equipment=document.querySelector('#equipment'),menu=document.querySelector('#contextmenu');
const inventoryGold=document.createElement('div');inventoryGold.id='inventory-gold';inventory.before(inventoryGold);inventoryGold.oncontextmenu=e=>{e.preventDefault();showMenu(e.clientX,e.clientY,[['Drop gold',()=>requestDrop(state,'gold')]])};
const tradePanel=createTradePanel(state),groundDrops=createGroundDrops(T,scene,landscape,targets),combatHealth=createCombatHealth(T,camera);var npcDuelIds=new Set(),combatPlayerIds=new Set();
const services=createServicePanel(state,{onChange:()=>{save();draw()},onOpen:()=>{dest=null;walkQueue=[];mapDestination=null;action=null;combatTurns.cancel();closeDialog()}});
let serviceBuilding=null;
let activeTab='inventory',mapOpen=false;const mapCanvas=document.querySelector('#minimap'),largeMap=document.querySelector('#worldmap'),mapPanel=document.querySelector('#map-panel');
let minimapExtent=90,running=false;
const mapControls=document.createElement('div');mapControls.id='map-controls';mapControls.style.cssText='position:absolute;right:8px;bottom:26px;display:flex;gap:4px;z-index:3';
for(const [label,title,handler] of [['+','Zoom in',()=>{minimapExtent=Math.max(35,minimapExtent*.8)}],['−','Zoom out',()=>{minimapExtent=Math.min(180,minimapExtent*1.25)}]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',title);button.style.cssText='min-height:30px;min-width:30px;padding:4px 7px;margin:0;font-size:14px';button.onclick=()=>{handler();drawMap(mapCtx,mapCanvas,false)};mapControls.append(button)}
const runButton=document.createElement('button');runButton.id='run-toggle';runButton.type='button';runButton.innerHTML=footIcon+'<span id="run-energy">100</span>';runButton.setAttribute('aria-label','Toggle run');runButton.setAttribute('aria-pressed','false');mapControls.append(runButton);document.querySelector('#map-widget').append(mapControls);
function updateRunButton(){const energy=Math.ceil(state.runEnergy);if(runButton.dataset.energy===String(energy)&&runButton.getAttribute('aria-pressed')===String(running))return;runButton.dataset.energy=energy;runButton.setAttribute('aria-pressed',String(running));runButton.querySelector('span').textContent=energy;runButton.title=(running?'Running':'Walking')+' · Energy '+energy+'/100';}
runButton.onclick=()=>{if(window.eldervaleAuthority){void window.eldervaleRealm?.command('run',{enabled:!running});return}if(!running&&state.runEnergy<5){say('Recover a little energy before running again.');return}running=!running;updateRunButton()};updateRunButton();
const mapCtx=mapCanvas.getContext('2d'),largeCtx=largeMap.getContext('2d');

// One deterministic terrain atlas is shared by the minimap and world map.
// It is generated once, rather than redrawing thousands of details each frame.
const terrainAtlas=document.createElement('canvas');terrainAtlas.width=1024;terrainAtlas.height=1024;
const terrainCtx=terrainAtlas.getContext('2d');
const terrainSeed=(x,z)=>{const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n)};
function terrainNoise(x,z){const xi=Math.floor(x),zi=Math.floor(z),u=x-xi,v=z-zi;const smooth=t=>t*t*(3-2*t);const a=terrainSeed(xi,zi),b=terrainSeed(xi+1,zi),d=terrainSeed(xi,zi+1),e=terrainSeed(xi+1,zi+1);return (a+(b-a)*smooth(u))*(1-smooth(v))+(d+(e-d)*smooth(u))*smooth(v)}
(function paintTerrain(){
 const size=1024,im=terrainCtx.createImageData(size,size),data=im.data;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  const wx=(x/size-.5)*840,wz=(y/size-.5)*840;
  const broad=terrainNoise(wx/130,wz/130),detail=terrainNoise(wx/34,wz/34),grain=terrainNoise(wx/5,wz/5);
  const woodland=terrainNoise(wx/90+17,wz/90-11);
  const hill=landscape.heightAt(wx,wz)/55;
  let rgb;
  if(hill>.40)rgb=[112,108,94]; // rocky highlands
  else if(woodland>.59)rgb=[62,98,52]; // dense forest
  else if(broad<.31)rgb=[112,105,64]; // dry heath and soil
  else if(detail>.67)rgb=[98,121,68]; // grassy clearings
  else rgb=[77,112,61];
  if(generatedWorld)rgb=biomeColor(wx,wz,generatedWorld.seed).map(v=>v*255);
  const shade=(detail-.5)*26+(grain-.5)*20+(hill-.5)*18;
  const i=(y*size+x)*4;for(let k=0;k<3;k++)data[i+k]=Math.max(0,Math.min(255,rgb[k]+shade));data[i+3]=255;
 }
 terrainCtx.putImageData(im,0,0);
 // Cartographic relief: contour lines, textured forest masses, river valleys.
 const coord=(v)=>((v+420)/840)*size;
 for(let y=4;y<size-4;y+=4)for(let x=4;x<size-4;x+=4){
  const wx=(x/size-.5)*840,wz=(y/size-.5)*840;
  const h=landscape.heightAt(wx,wz)/55;
  const east=landscape.heightAt(wx+4,wz)/55;
  const contour=Math.floor(h*14)!==Math.floor(east*14);
  if(contour&&h>.51){terrainCtx.fillStyle='rgba(36,42,28,.17)';terrainCtx.fillRect(x,y,3,1)}
 }
 // Rivers and forest symbols use actual world geometry, not imaginary atlas detail.
 for(const river of worldRivers){
  const trace=()=>{terrainCtx.beginPath();river.points.forEach(([x,z],i)=>i?terrainCtx.lineTo(coord(x),coord(z)):terrainCtx.moveTo(coord(x),coord(z)))};
  terrainCtx.lineCap='round';terrainCtx.lineJoin='round';
  trace();terrainCtx.strokeStyle='#8e946c';terrainCtx.lineWidth=(river.width+3)/840*size;terrainCtx.stroke();
  trace();terrainCtx.strokeStyle='#397d8c';terrainCtx.lineWidth=river.width/840*size;terrainCtx.stroke();
 }
 for(const tree of forestTrees){const x=coord(tree.x),y=coord(tree.z),r=2.3/840*size;terrainCtx.fillStyle='#203e2b88';terrainCtx.beginPath();terrainCtx.arc(x+1,y+1,r+1,0,Math.PI*2);terrainCtx.fill();terrainCtx.fillStyle='#42673d';terrainCtx.beginPath();terrainCtx.arc(x,y,r,0,Math.PI*2);terrainCtx.fill()}

})();
function drawMap(ctx,canvas,scale){
 const w=canvas.width,h=canvas.height,extent=scale?840:minimapExtent,pxPerUnit=w/extent,pzPerUnit=w/extent;
 const toX=x=>w/2+(x-(scale?0:player.position.x))*pxPerUnit,toY=z=>h/2+(z-(scale?0:player.position.z))*pzPerUnit;
 ctx.clearRect(0,0,w,h);ctx.fillStyle='#415d39';ctx.fillRect(0,0,w,h);ctx.save();ctx.beginPath();ctx.rect(0,0,w,h);ctx.clip();
 // Sample the identical 840-unit terrain atlas in both map views.
 const originX=scale?0:player.position.x,originZ=scale?0:player.position.z;
 const sourceX=(originX-extent/2+420)/840*terrainAtlas.width;
 const sourceY=(originZ-extent*h/w/2+420)/840*terrainAtlas.height;
 const sourceW=extent/840*terrainAtlas.width,sourceH=extent*h/w/840*terrainAtlas.height;
 ctx.fillStyle='#415d39';ctx.fillRect(0,0,w,h);
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
 ctx.drawImage(terrainAtlas,toX(-420),toY(-420),840*pxPerUnit,840*pzPerUnit);
for(const lake of worldLakes){
  // Irregular shorelines and depth shading, seeded by world coordinates.
  const cx=toX(lake.x),cy=toY(lake.z),rx=lake.rx*pxPerUnit,ry=lake.rz*pzPerUnit;
  if(scale&&(cx+rx<0||cy+ry<0||cx-rx>w||cy-ry>h))continue;
  function shore(factor){ctx.beginPath();lakeOutline(lake,factor).forEach(([x,z],i)=>i?ctx.lineTo(toX(x),toY(z)):ctx.moveTo(toX(x),toY(z)));ctx.closePath()}
  shore(1.08);ctx.fillStyle='#a5a278';ctx.fill();
  shore(1);ctx.fillStyle='#477b81';ctx.fill();
  shore(.84);ctx.fillStyle='#367184';ctx.fill();
  shore(.58);ctx.fillStyle='#2d6278';ctx.fill();
  ctx.strokeStyle='rgba(172,207,190,.5)';ctx.lineWidth=scale?1:1.5;shore(.96);ctx.stroke();
 }
 // The exact same road centerlines are used in the 3D world.
 for(const [a,b] of worldRoads){
  const points=roadPoints(a,b);
  const trace=()=>{ctx.beginPath();points.forEach(([x,z],i)=>i?ctx.lineTo(toX(x),toY(z)):ctx.moveTo(toX(x),toY(z)))};
  ctx.lineCap='round';ctx.lineJoin='round';
  trace();ctx.strokeStyle='#536044';ctx.lineWidth=scale?6:9;ctx.stroke();
  trace();ctx.strokeStyle='#8c7852';ctx.lineWidth=scale?4:6;ctx.stroke();
  trace();ctx.strokeStyle='#c3a878';ctx.lineWidth=scale?2.3:3.5;ctx.stroke();
 }
 for(const bridge of landscape.bridges){const x=toX(bridge.x),y=toY(bridge.z);ctx.save();ctx.translate(x,y);ctx.rotate(-bridge.yaw);ctx.fillStyle='#bba37c';ctx.strokeStyle='#45392b';ctx.lineWidth=1;ctx.fillRect(-bridge.width*pxPerUnit/2,-bridge.length*pzPerUnit/2,bridge.width*pxPerUnit,bridge.length*pzPerUnit);ctx.strokeRect(-bridge.width*pxPerUnit/2,-bridge.length*pzPerUnit/2,bridge.width*pxPerUnit,bridge.length*pzPerUnit);ctx.restore()}
 ctx.strokeStyle='#c6b08a';ctx.lineWidth=Math.max(1.1,2.3*pxPerUnit);
 for(const [a,b] of townStreets){ctx.beginPath();ctx.moveTo(toX(a[0]),toY(a[1]));ctx.lineTo(toX(b[0]),toY(b[1]));ctx.stroke()}
 // Draw buildings from their actual world transforms, including rotated footprints and doorway positions.
 for(const h of houseInteriors){
  const g=h.group,halfW=2*g.scale.x,halfD=1.85*g.scale.z;
  const cx=toX(g.position.x),cy=toY(g.position.z);
  if(scale&&(cx+halfW*pxPerUnit<0||cx-halfW*pxPerUnit>w||cy+halfD*pzPerUnit<0||cy-halfD*pzPerUnit>canvas.height))continue;
  const corners=[[-halfW,-halfD],[halfW,-halfD],[halfW,halfD],[-halfW,halfD]];
  const c=Math.cos(g.rotation.y),sn=Math.sin(g.rotation.y);
  ctx.beginPath();corners.forEach(([x,z],i)=>{const wx=g.position.x+x*c+z*sn,wz=g.position.z-x*sn+z*c;i?ctx.lineTo(toX(wx),toY(wz)):ctx.moveTo(toX(wx),toY(wz))});ctx.closePath();
  // Roof silhouette and shingles: distinguish actual houses from map markers.
  ctx.fillStyle='#483a29';ctx.strokeStyle='#d2b47e';ctx.lineWidth=scale?1.2:1.8;ctx.fill();ctx.stroke();
  ctx.save();ctx.clip();
  const roofTone=Math.abs(Math.floor(g.position.x*13+g.position.z*7))%3;
  ctx.fillStyle='#'+h.roofColor.toString(16).padStart(6,'0');ctx.fillRect(cx-halfW*pxPerUnit*2,cy-halfD*pzPerUnit*2,halfW*pxPerUnit*4,halfD*pzPerUnit*4);
  ctx.strokeStyle='#d39a59';ctx.lineWidth=scale?0.7:1;
  const step=Math.max(3,scale?3.2:6);
  for(let yy=cy-halfD*pzPerUnit*2;yy<cy+halfD*pzPerUnit*2;yy+=step){
   ctx.beginPath();ctx.moveTo(cx-halfW*pxPerUnit*2,yy);ctx.lineTo(cx+halfW*pxPerUnit*2,yy);ctx.stroke();
  }
  ctx.restore();
  // A ridge and two sloping roof planes follow each house's world rotation.
  const ridgeA=[-halfD*.88,0],ridgeB=[halfD*.88,0];
  const roofPoint=(lx,lz)=>[toX(g.position.x+lx*c+lz*sn),toY(g.position.z-lx*sn+lz*c)];
  const p1=roofPoint(0,ridgeA[0]),p2=roofPoint(0,ridgeB[0]);
  ctx.beginPath();ctx.moveTo(...p1);ctx.lineTo(...p2);
  ctx.strokeStyle='rgba(248,202,135,.75)';ctx.lineWidth=scale?1:1.7;ctx.stroke();
  ctx.strokeStyle='#392b20';ctx.lineWidth=scale?1:1.5;ctx.stroke();
  const doorX=g.position.x+1.86*g.scale.z*sn,doorZ=g.position.z+1.86*g.scale.z*c;
  if(!scale){ctx.fillStyle='#d8bc83';ctx.beginPath();ctx.arc(toX(doorX),toY(doorZ),2.2,0,Math.PI*2);ctx.fill();}
  if(h.type==='bank'||h.type==='hall'){ctx.fillStyle='#f7e5a9';ctx.font=(scale?'bold 9px':'bold 10px')+' Georgia';ctx.textAlign='center';ctx.fillText(h.type==='bank'?'BANK':'HALL',cx,cy+3);ctx.textAlign='left'}
 }
 // World props are represented by small map symbols at their actual world coordinates.
 for(const prop of mapProps){
  const x=toX(prop.x),y=toY(prop.z);if(scale&&(x<0||x>w||y<0||y>h))continue;
  // Natural canopy and shadow symbols instead of uniform colored dots.
  const color=String(prop.color||'').toLowerCase();
  const isTree=color.includes('green')||color.includes('forest')||['#2f6338','#3b703c','#315b34','#427a40'].includes(color);
  const radius=scale?2.3:Math.min(11,Math.max(3.5,pxPerUnit*.8));
  if(isTree){
   ctx.fillStyle='rgba(22,38,21,.38)';ctx.beginPath();ctx.ellipse(x+1.2,y+1.5,radius*1.2,radius*.9,-.2,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#244c2e';ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();
   ctx.fillStyle='#528044';ctx.beginPath();ctx.arc(x-radius*.25,y-radius*.28,radius*.65,0,Math.PI*2);ctx.fill();
  }else{
   ctx.fillStyle='rgba(31,33,23,.38)';ctx.beginPath();ctx.ellipse(x+1,y+1.5,radius*.9,radius*.65,0,0,Math.PI*2);ctx.fill();
   ctx.fillStyle=prop.color||'#8c8a72';ctx.beginPath();ctx.moveTo(x-radius,y+radius*.4);ctx.lineTo(x-radius*.5,y-radius*.7);ctx.lineTo(x+radius*.45,y-radius);ctx.lineTo(x+radius,y+radius*.4);ctx.closePath();ctx.fill();
   ctx.strokeStyle='rgba(235,220,170,.3)';ctx.lineWidth=.8;ctx.stroke();
  }
 }
 // Settlement cartography: town rings, converging footpaths and a readable central square.
 if(scale)for(const [name,x,z] of places){
  const cx=toX(x),cy=toY(z);if(cx<0||cx>w||cy<0||cy>h)continue;
  const radius=name.includes('Ruins')?7:12;
  ctx.save();ctx.setLineDash([3,2]);ctx.strokeStyle='rgba(214,191,139,.55)';ctx.lineWidth=1;
  ctx.beginPath();ctx.ellipse(cx,cy,radius,radius*.68,-.25,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
  ctx.fillStyle='rgba(201,171,111,.24)';ctx.beginPath();ctx.ellipse(cx,cy,5,3,0,0,Math.PI*2);ctx.fill();
  ctx.restore();
 }
 for(const [name,x,z] of places){const px=toX(x),py=toY(z);if(px<0||px>w||py<0||py>h)continue;ctx.fillStyle='#e6c988';ctx.beginPath();ctx.arc(px,py,scale?4:3,0,Math.PI*2);ctx.fill();if(scale){
  ctx.font='bold 13px Georgia';ctx.textAlign='center';ctx.lineJoin='round';
  ctx.strokeStyle='#263025';ctx.lineWidth=3;ctx.strokeText(name,px,py-11);
  ctx.fillStyle='#f0dbad';ctx.fillText(name,px,py-11);
  ctx.textAlign='start';
 }}
 if(!scale){const dot=(x,z,color,r=2.6)=>{const px=toX(x),py=toY(z);if(px<2||py<2||px>w-2||py>h-2)return;ctx.fillStyle=color;ctx.strokeStyle='#14221c';ctx.lineWidth=1;ctx.beginPath();ctx.arc(px,py,r,0,Math.PI*2);ctx.fill();ctx.stroke()};for(const a of [...npcs,...creatures])if(a.root.visible&&!a.deleted&&a.alive!==false)dot(a.root.position.x,a.root.position.z,'#f4db4f');for(const a of remotePlayers.values())dot(a.root.position.x,a.root.position.z,'#ffffff');for(const e of groundDrops.entries.values())dot(e.data.x,e.data.z,'#fa4b43',2.8);for(const row of window.eldervaleMapItems?.()||[])if(!row.deleted&&row.data.kind==='item')dot(row.data.x,row.data.z,'#fa4b43',2.8);}
 ctx.restore();
 if(mapDestination){const p=scale?{x:toX(mapDestination.x),y:toY(mapDestination.z)}:mapPoint(mapDestination.x,mapDestination.z,player.position,Math.PI,extent,w,h);if(p.x>3&&p.x<w-3&&p.y>3&&p.y<h-3){ctx.strokeStyle='#fff2bc';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(p.x,p.y+5);ctx.lineTo(p.x,p.y-12);ctx.stroke();ctx.fillStyle='#f2c653';ctx.beginPath();ctx.moveTo(p.x,p.y-12);ctx.lineTo(p.x+11,p.y-8);ctx.lineTo(p.x,p.y-4);ctx.fill()}}
 const px=scale?toX(player.position.x):w/2,py=scale?toY(player.position.z):h/2;ctx.save();ctx.translate(px,py);ctx.rotate(Math.PI-player.rotation.y);ctx.fillStyle='#ffffff';ctx.strokeStyle='#15251d';ctx.lineWidth=2;ctx.beginPath();if(!scale)ctx.arc(0,0,3.2,0,Math.PI*2);else{ctx.moveTo(0,-7);ctx.lineTo(5,5);ctx.lineTo(0,2);ctx.lineTo(-5,5);ctx.closePath();}ctx.fill();ctx.stroke();ctx.restore();
}
// Click-to-walk on both map sizes. Coordinates use the exact transform used by drawMap.
function walkFromMap(e,canvas,worldView){
 const rect=canvas.getBoundingClientRect();if(!rect.width||!rect.height)return;
 const u=Math.max(0,Math.min(1,(e.clientX-rect.left)/rect.width)),v=Math.max(0,Math.min(1,(e.clientY-rect.top)/rect.height));
 const extent=worldView?840:minimapExtent;
 const point=worldView?{x:(u-.5)*extent,z:(v-.5)*extent*canvas.height/canvas.width}:minimapDestination(u,v,player.position,Math.PI,extent,canvas.width,canvas.height);const {x,z}=point;
 pendingPickup=null;action=null;closeDialog();setWalkDestination(new T.Vector3(x,0,z));if(dest)markClick(x,z,'walk');
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
const markers=[];function markClick(x,z,kind='walk'){const group=new T.Group();group.position.set(x,landscape.walkHeight(x,z)+.11,z);const color=kind==='walk'?0xffd05b:0xe64c46;const ring=new T.Mesh(new T.RingGeometry(.45,.62,32),new T.MeshBasicMaterial({color,transparent:true,opacity:.95,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;group.add(ring);const dot=new T.Mesh(new T.CircleGeometry(.12,20),new T.MeshBasicMaterial({color,transparent:true,opacity:.85,side:T.DoubleSide,depthWrite:false}));dot.rotation.x=-Math.PI/2;dot.position.y=.005;group.add(dot);scene.add(group);markers.push({group,ring,dot,age:0});}
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
workSign(-17,-10,'OAKCROSS BANK');
workSign(0,-12,'OAKCROSS · MAIN TOWN');
workSign(-12,5,'HERBALIST');workSign(12,4,'MARKET');
const npcProfiles=[
{name:'Edda the Guide',role:'guide',x:3,z:8,color:0x4b6d8d,station:'guide',behavior:'stationary',lines:['Welcome to Oakcross, the main town of the Heartlands! The stone bank is northwest, the town hall is north, and the inn is southeast.','Visit the market in the square, the forge to the east, or the chapel in the southwest. The northern armory has equipment for new adventurers.']},
{name:'Sir Rowan',role:'guard',x:24,z:-3,color:0x9a9da6,station:'guard',behavior:'patrol',patrol:[[24,-3],[28,3],[24,8],[20,4]],lines:['I patrol the eastern gate and keep the roads safe.','Keep your blade ready beyond the village.']},
{name:'Mira the Herbalist',role:'herbalist',x:-12,z:7.5,color:0x548c66,station:'herbs',behavior:'stationary',lines:['Welcome to my herb stall. Fresh greens and remedies from the forest.','The forests are alive with useful plants.']},
{name:'Bram the Woodsman',role:'woodsman',x:-56,z:43,color:0x855f3c,station:'woodland',behavior:'patrol',patrol:[[-56,43],[-50,40],[-48,45],[-55,47]],lines:['I collect timber beside Northwatch, not in the middle of town.','The tall pines make fine beams.']},
{name:'Lysa the Scout',role:'scout',x:74,z:-51,color:0x74628b,station:'scout',behavior:'patrol',patrol:[[74,-51],[80,-48],[83,-54],[76,-55]],lines:['I keep watch over Eastmarch and its roads.','The eastern roads wind toward Suncrest.']},
{name:'Torren the Smith',role:'smith',x:28,z:-10.8,color:0x806e65,station:'forge',behavior:'stationary',lines:['Welcome to the Ember Forge. These stone walls keep the heat in while I work.','I keep blades and tools ready for travelers. Bring me ore when smithing is available.']},
{name:'Fen the Ranger',role:'ranger',x:-208,z:146,color:0x3d7155,station:'ranger',behavior:'patrol',patrol:[[-208,146],[-201,141],[-205,136],[-213,141]],lines:['I patrol Westmere and watch the forest trails.','Keep your eyes open for landmarks.']},
{name:'Nara the Wanderer',role:'wanderer',x:258,z:-181,color:0x916d6d,station:'traveler',behavior:'patrol',patrol:[[258,-181],[265,-178],[268,-183],[260,-188]],lines:['I am resting near Suncrest before my next journey.','The western ruins are older than the kingdoms themselves.']},
{name:'Garrick the Banker',role:'banker',x:-21.5,z:-21.7,color:0x5b6586,station:'bank',behavior:'stationary',lines:['Welcome to Oakcross Bank. Your valuables deserve a safe place.','You will find the tellers in this hall and the iron vault at the back. Personal storage is not available yet.']},
{name:'Pella the Merchant',role:'merchant',x:12,z:6.5,color:0xa7784b,station:'market',behavior:'stationary',lines:['Welcome to my market stall! Look at the goods on my table.','Travelers always need provisions for the road.']},
{name:'Alda the Innkeeper',role:'innkeeper',x:25,z:23.8,color:0x954d43,station:'inn',behavior:'stationary',lines:['Welcome to the Stag & Lantern! Take a seat by the tables and rest your feet.','Oakcross is the main town of the Heartlands. Everyone passes through our square sooner or later.']},
{name:'Steward Elian',role:'steward',x:10,z:-31.7,color:0x3f617a,station:'hall',behavior:'stationary',lines:['Welcome to Oakcross Town Hall. Our town links the roads of the Heartlands.','The bank, chapel, forge, market and inn all serve the folk who call this place home.']},
{name:'Sister Maeve',role:'cleric',x:-23,z:26.9,color:0xb5aa82,station:'chapel',behavior:'stationary',lines:['Peace to you, traveler. The Chapel of the Dawn is open to all.','You may rest among the pews before returning to the roads.']}
];
const npcs=[];
function spawnNPC(profile,index){profile.realmId||='base:npc:'+profile.name;
 profile.attackType||=/mage|healer/.test(profile.role)?'magic':/smith/.test(profile.role)?'hammer':/guard/.test(profile.role)?'slash':'punch';profile.level??=5;profile.hp??=45;profile.damage??=4;profile.attackSpeed??=2.4;
 const root=new T.Group();root.position.set(profile.x,0,profile.z);scene.add(root);
 const palettes=[0xc9916b,0xe0b48e,0x966247,0x67402f,0xb98362];
 const hairs=[0x39271f,0x6d4831,0xa17a4b,0x241e1d];
 const model=buildHumanoid(T,root,{skin:palettes[index%palettes.length],shirt:profile.color,pants:0x474442,hairColor:hairs[index%hairs.length],face:['Balanced','Angular','Broad'][index%3],beard:index%4===0?'Short beard':index%4===1?'Stubble':undefined,hair:['Short crop','Side swept','Buzz cut','Long'][index%4]});
 if(/guard|warden|sentinel|soldier/i.test(profile.role+' '+profile.name)){
  const plates=buildPlateArmor(T,root,model);for(const slot of ['chest','legs','boots'])for(const part of plates[slot])part.visible=true;model.torso.visible=false;for(const part of model.clothingMeshes)part.visible=false;
  if(profile.whiteArmor)for(const slot of ['chest','legs','boots'])for(const part of plates[slot]){part.material=part.material.clone();part.material.userData.eldervaleShared=false;part.material.color.setHex(0xdfe6e6);part.material.metalness=.55;part.material.roughness=.44;}
  const weapon=makeWeapon(T,'longsword');attachWeapon(model,weapon,'longsword');root.userData.armed=true;
 }
 const activity=profile.activity||({smith:'smith',banker:'read',herbalist:'garden',merchant:'trade',innkeeper:'trade',steward:'read'}[profile.role]);
 profile.activity=activity;
 let workProp=null;
 if(activity==='carry'||activity==='read'){
  workProp=new T.Group();root.add(workProp);workProp.position.set(0,1.48,.38);
  box(activity==='carry'?.52:.40,activity==='carry'?.34:.055,.28,activity==='carry'?0x795737:0xb7a781,0,0,0,workProp,activity==='carry'?'wood':'cloth');
  if(activity==='carry')for(const x of [-.20,.20])box(.035,.36,.30,0x4f3e2e,x,0,0,workProp,'wood');
 }else if(['smith','sweep','garden'].includes(activity)){
  workProp=new T.Group();model.rightHand.add(workProp);workProp.rotation.x=activity==='smith'?1.3:.18;
  box(.045,activity==='smith'?.40:1.15,.045,0x705537,0,activity==='smith'?.06:-.12,0,workProp,'wood');
  box(activity==='smith'?.27:.32,activity==='sweep'?.16:.10,.12,activity==='sweep'?0xa99a66:0x66777c,0,activity==='smith'?.23:-.67,0,workProp,activity==='sweep'?'cloth':'stone');
 }

 // Clothing accents give each NPC a recognizable silhouette without changing the animation rig.
 if(!root.userData.armed&&index%3===0){box(.62,.11,.44,0x5e422d,0,1.365,0,root,'wood');box(.24,.16,.07,0xc5a46b,0,1.365,.245,root)}
 if(!root.userData.armed&&index%3===1){box(.52,.62,.045,0xb3a17b,0,1.775,.223,root,'cloth');box(.54,.12,.45,0x6b4c33,0,1.385,0,root,'wood')}
 if(!root.userData.armed&&index%3===2){const cape=box(.64,.84,.07,0x514f67,0,1.795,-.26,root,'cloth');cape.rotation.x=-.12}
 const hit=new T.Mesh(new T.CylinderGeometry(.68,.68,2.7,14),new T.MeshBasicMaterial({visible:false}));
 hit.position.set(0,1.38,0);root.add(hit);hit.userData={kind:'npc',profile,root};targets.push(hit);
 const npc={realmId:profile.realmId,profile,root,rig:model,workProp,animator:createHumanoidAnimator(model),leftArm:model.leftArm,rightArm:model.rightArm,leftLeg:model.leftLeg,rightLeg:model.rightLeg,leftElbow:model.leftElbow,rightElbow:model.rightElbow,leftKnee:model.leftKnee,rightKnee:model.rightKnee,home:new T.Vector3(profile.x,0,profile.z),goal:new T.Vector3(profile.x,0,profile.z),wait:2+index,phase:index,walkPhase:0,walkBlend:0,stuck:0,pace:.48+(index%4)*.075,path:[],pathGoal:null,patrolIndex:0};npcs.push(npc);npc.hit=hit;return npc
}
if(!generatedWorld)npcProfiles.forEach(spawnNPC);
const extraResidents=generatedWorld?[]:townResidents(landscapeSettlements),spawnedResidents=new Set();let nextResidentCheck=0;
function ensureTownResidents(){
 if(performance.now()<nextResidentCheck)return;nextResidentCheck=performance.now()+2000;
 for(const h of houseInteriors)h.group.visible=Math.hypot(h.group.position.x-player.position.x,h.group.position.z-player.position.z)<155;
 extraResidents.forEach((profile,index)=>{if(!spawnedResidents.has(index)&&Math.hypot(profile.x-player.position.x,profile.z-player.position.z)<85){spawnNPC(profile,npcProfiles.length+index);spawnedResidents.add(index)}});
}
ensureTownResidents();
// Wildlife and enemies use lightweight low-poly models and simple local AI.
const creatures=[];
function creature(name,x,z,hostile=false,config={}){
 const d={...(worldTemplates[name.toLowerCase()]||worldTemplates.wolf),...config,name,hostile};
 const root=new T.Group();root.position.set(x,landscape.walkHeight(x,z),z);scene.add(root);
 root.scale.setScalar(d.scale||1);const model=actorModel(T,root,d);
 const hit=new T.Mesh(new T.BoxGeometry(d.species==='dragon'?3:1.35,d.kind==='npc'||['human','goblin','skeleton','troll','golem'].includes(d.species)?2.8:1.7,d.species==='dragon'?3:2),new T.MeshBasicMaterial({visible:false}));hit.position.set(0,1,.2);root.add(hit);
 const mob={name,root,model,config:d,home:new T.Vector3(x,0,z),goal:new T.Vector3(x,0,z),hp:d.hp,maxHp:d.hp,hostile,alive:true,wait:2,attackCooldown:0,respawn:0};hit.userData={kind:'creature',mob};targets.push(hit);mob.hit=hit;creatures.push(mob);return mob;
}

for(let i=0;i<(generatedWorld?0:24);i++){const a=i*2.399,r=22+i*11;creature(i%5===0?'Wolf':i%3===0?'Boar':'Deer',Math.sin(a)*r,Math.cos(a)*r,i%5===0)}
// Consolidate screen furniture before creating the shared portrait/status panel.
const audioSettings=document.querySelector('[data-settings-panel="audio"]');
const oldAudioVolume=document.querySelector('#settings-music-volume').closest('label');oldAudioVolume.style.display='none';
audioSettings.querySelector('p')?.remove();audioSettings.append(document.querySelector('#music-controls'));
const environmentControls=document.createElement('div');environmentControls.id='environment-controls';environmentControls.innerHTML='<h4>Environment</h4><button id="environment-toggle" type="button" aria-pressed="true">Environment on</button><label for="environment-volume">Wildlife & nearby water</label><input id="environment-volume" type="range" min="0" max="100" value="35" aria-label="Environment volume"><small>Natural sound is separate from the soundtrack.</small><a href="/credits.html" target="_blank" rel="noopener">Soundtrack credits</a>';audioSettings.append(environmentControls);
const gameplaySettings=document.querySelector('[data-settings-panel="gameplay"]');gameplaySettings.append(document.querySelector('#stats'),document.querySelector('#reset'));
document.querySelector('#character-panel').hidden=true;
const brand=document.createElement('strong');brand.className='minimap-brand';brand.textContent='ELDERVALE';document.querySelector('#map-widget').prepend(brand);
document.querySelector('.social-head strong').textContent='Chat & Game';
const coordinateHUD=document.createElement('output');coordinateHUD.id='coordinate-hud';coordinateHUD.setAttribute('aria-label','Player world coordinates');coordinateHUD.style.cssText='position:fixed;top:max(12px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:90;background:#111c19e8;color:#f4d79a;border:1px solid #b6985e;border-radius:6px;padding:8px 14px;font:600 13px Arial,sans-serif;pointer-events:none;white-space:nowrap;display:none';document.body.append(coordinateHUD);if(localStorage.getItem('eldervale-show-coordinates')==='true')document.body.classList.add('show-coordinates');let lastCoordinateUpdate=0;function updateCoordinateHUD(){const active=document.body.classList.contains('show-coordinates');coordinateHUD.style.display=active?'block':'none';if(!active)return;const now=performance.now();if(now-lastCoordinateUpdate<120)return;lastCoordinateUpdate=now;coordinateHUD.textContent='X: '+player.position.x.toFixed(1)+'  |  Y: '+player.position.z.toFixed(1)+'  |  Height: '+player.position.y.toFixed(1)}
renderFeed();const playerHUD=createPlayerHUD(T,renderer,body);addEventListener('pagehide',()=>playerHUD.dispose(),{once:true});
const healthBar=document.querySelector('#health-fill'),combatNotice=document.querySelector('#combat-notice');
function combatMessage(msg){combatNotice.textContent=msg;combatNotice.hidden=false;clearTimeout(combatMessage.timer);combatMessage.timer=setTimeout(()=>combatNotice.hidden=true,1800)}
// Procedural, non-looping combat effects; unlocked by player input on first combat.
let combatAudio=null;
function combatSound(kind){if(localStorage.getItem('eldervale-audio-enabled')==='false')return;
 try{
  combatAudio??=new (window.AudioContext||window.webkitAudioContext)();
  if(combatAudio.state==='suspended')combatAudio.resume().catch(()=>{});
  if(['stab','lunge','impact'].includes(kind)){const t=combatAudio.currentTime,o=combatAudio.createOscillator(),g=combatAudio.createGain();o.type=kind==='lunge'?'triangle':'sine';const f=kind==='lunge'?470:kind==='stab'?850:140;o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(kind==='lunge'?155:kind==='stab'?260:65,t+.16);g.gain.setValueAtTime(.10,t);g.gain.exponentialRampToValueAtTime(.0001,t+.22);o.connect(g);g.connect(combatAudio.destination);o.start(t);o.stop(t+.24);o.onended=()=>{o.disconnect();g.disconnect()};return}
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
const hitNumbers=createHitNumbers(T,camera);
function applyPlayerHit(mob,rng=Math.random,weaponKey=state.equippedWeapon){if(window.eldervaleAuthority)return;
 if(!mob.alive)return;
 combat.stanceTimer=2;faceTarget(player,mob.root.position);
 const hit=meleeRoll(weaponStats(weaponKey),{blockChance:Math.min(.45,.08+(mob.config?.level||1)*.002),reduction:Math.floor((mob.config?.level||1)/15)},rng);
 hitNumbers.show(mob.root,hit.damage,hit.blocked,1.7);
 if(hit.blocked){mob.blockAnim=.65;combatSound('metal');combatMessage(mob.name+' blocks your attack.');return}
 mob.hitAnim=.3;mob.hp=Math.max(0,mob.hp-hit.damage);combatSound(/axe|hatchet/i.test(String(state.equippedWeapon||''))?'axe':'slash');combatMessage('You hit '+mob.name+' for '+hit.damage+' damage');
 if(mob.hp<=0){mob.alive=false;mob.root.visible=false;mob.respawn=mob.config?.respawn===0?Infinity:mob.config?.respawn||22;combat.kills++;combat.xp+=30;state.attackXP+=10;state.strengthXP+=10;state.defenceXP+=5;state.hitpointsXP+=5;state.gold+=mob.hostile?8:2;combatMessage('Defeated '+mob.name+'! +30 combat XP');action=null;dest=null;save();draw()}
}
function playerHit(mob,rng=Math.random){if(window.eldervaleAuthority)return;
 combat.stanceTimer=2;combat.attackAnim=0;combat.blockAnim=.65;
 const protection=meleeProtection(state),defense=protection.defence,hit=meleeRoll({damage:mob.config?.damage??(mob.hostile?6:3),attack:Math.round((mob.config?.level||5)*.6)},['fire','magic','venom'].includes(mob.config?.attackType)?{...protection,reduction:0,blockChance:protection.blockChance*.35}:protection,rng);faceTarget(mob.root,player.position);
 hitNumbers.show(player,hit.damage,hit.blocked,2.8);
 if(hit.blocked){combat.blockAnim=.65;combatSound('metal');combatMessage('You block '+mob.name+'’s attack.');return}
 combat.hp=Math.max(0,combat.hp-hit.damage);combat.hitAnim=.45;combatSound(defense?'metal':'axe');combatMessage(mob.name+' hits you for '+hit.damage);draw();
 if(combat.hp<=0){combatTurns.cancel();combat.hp=100;player.position.set(0,0,5);dest=null;walkQueue=[];action=null;state.gold=Math.max(0,state.gold-10);combatMessage('You fell in battle and returned to Oakcross.');save();draw()}
}
let combatRng=Math.random,swingWeapon=null;
const combatTurns=createCombatTurns({
 interval:(side,mob)=>side==='player'?weaponStats(state.equippedWeapon).speed:mob.config?.attackSpeed||2.2,
 onWindup(side,mob){combat.stanceTimer=3;faceTarget(player,mob.root.position);faceTarget(mob.root,player.position);combatNotice.dataset.turn=side;if(side==='player'){swingWeapon=state.equippedWeapon;combat.attackAnim=.55;combat.blockAnim=0;combat.attackTimer=weaponStats(swingWeapon).speed;combatMessage('Your turn — '+weaponStats(swingWeapon).name)}else{mob.attackAnim=.55;combat.attackAnim=0;combat.blockAnim=1.15;combatMessage(mob.name+' attacks — prepare to defend')}},
 onImpact(side,mob){if(side==='player')applyPlayerHit(mob,combatRng,swingWeapon);else playerHit(mob,combatRng)},
 onEnd(mob){if(action?.kind==='creature'&&action.mob===mob){action=null;dest=null;walkQueue=[]}}
});
function strike(mob,rng=Math.random){if(combatTurns.target===mob)return;combatRng=rng;combatTurns.engage(mob)}
const dialoguePortrait=createDialoguePortrait(T,renderer,document.querySelector('#dialog-portrait'));
const dialog=document.querySelector('#dialog'),dialogName=document.querySelector('#dialog-name'),dialogText=document.querySelector('#dialog-text'),dialogNext=document.querySelector('#dialog-next');let conversation=null;
function closeDialog(){conversation=null;dialoguePortrait.close();dialog.hidden=true;document.body.classList.remove('npc-conversation')}
function talkTo(profile){if(profile.role==='banker'){services.open('bank',profile.name);return}if(profile.role==='merchant'){services.open('shop',profile.name,profile.worldEntityId||profile.realmId);return}const npc=npcs.find(n=>n.profile===profile);if(!npc)return;dialoguePortrait.open(npc.root,profile.name);conversation={profile,index:0};dialog.hidden=false;document.body.classList.add('npc-conversation');dialogName.textContent=profile.name;showDialogLine();dialogNext.focus({preventScroll:true})}
function showDialogLine(){if(!conversation)return;dialogText.textContent=conversation.profile.lines[conversation.index];dialoguePortrait.speak(dialogText.textContent);dialogNext.textContent=conversation.index===conversation.profile.lines.length-1?'Close':'Continue'}
dialogNext.onclick=()=>{if(!conversation)return;if(++conversation.index>=conversation.profile.lines.length)closeDialog();else showDialogLine()};
function closeMenu(){menu.hidden=true;menu.innerHTML=''}
function showMenu(x,y,items){menu.innerHTML='';for(const [label,fn] of items){const b=document.createElement('button');if(label instanceof Node)b.append(label);else b.textContent=label;b.onclick=()=>{closeMenu();fn()};menu.append(b)}menu.hidden=false;menu.style.left=Math.min(x,innerWidth-190)+'px';menu.style.top=Math.min(y,innerHeight-180)+'px'}
function toggleArmor(k){if(window.eldervaleAuthority){void window.eldervaleRealm?.command('equip',{slot:k,key:k});return}if(!state.armorOwned.includes(k))return;state.equipped[k]=!state.equipped[k];refreshArmor();say((state.equipped[k]?'Equipped ':'Removed ')+armorCatalog[k].name);save();draw()}
function examine(k){say(armorCatalog[k].name+': '+armorCatalog[k].desc+' Melee defence +'+armorCatalog[k].defence+' · Damage absorption '+armorCatalog[k].reduction)}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;draw();closeMenu()});

// Player-local graphics and interface preferences (no changes to cloud saves).
const settingKey='eldervale-client-settings';
let clientSettings={preset:'auto',scale:1,distance:330,shadows:true,fps:false,reducedMotion:false};
try{clientSettings={...clientSettings,...JSON.parse(localStorage.getItem(settingKey)||'{}')}}catch{}
function applyGraphics(){
 const profile=deviceProfile({width:innerWidth,height:innerHeight,coarse:matchMedia('(any-pointer:coarse)').matches,touch:navigator.maxTouchPoints>0,memory:navigator.deviceMemory||8});
 const resolved=effectiveGraphics(clientSettings,profile),scale=Number(resolved.scale)||1;
 renderer.setPixelRatio(Math.min(devicePixelRatio*scale,resolved.pixelCap));
 renderer.shadowMap.enabled=Boolean(resolved.shadows);sun.castShadow=Boolean(resolved.shadows);
 camera.far=Number(resolved.distance)||330;scene.fog.far=camera.far;scene.fog.near=camera.far*.45;camera.updateProjectionMatrix();
 const ids={'graphics-preset':clientSettings.preset,'render-scale':String(scale),'view-distance':String(resolved.distance),'shadows-setting':resolved.shadows,'fps-setting':clientSettings.fps,'reduce-motion':clientSettings.reducedMotion};
 for(const [id,value] of Object.entries(ids)){const el=document.getElementById(id);if(el){if(el.type==='checkbox')el.checked=Boolean(value);else el.value=String(value)}}
 document.querySelector('#fps-counter').hidden=!clientSettings.fps;
 document.body.classList.toggle('reduce-motion',Boolean(clientSettings.reducedMotion));
}
function storeGraphics(){if(clientSettings.preset==='auto')clientSettings.preset='custom';localStorage.setItem(settingKey,JSON.stringify(clientSettings));applyGraphics()}
document.querySelector('#graphics-preset').addEventListener('change',e=>{clientSettings.preset=e.target.value;if(e.target.value==='auto'){localStorage.setItem(settingKey,JSON.stringify(clientSettings));applyGraphics();return}const p={low:[.65,110,false],medium:[.8,210,false],high:[1,330,true],ultra:[1.25,440,true]}[e.target.value];[clientSettings.scale,clientSettings.distance,clientSettings.shadows]=p;storeGraphics()});
for(const [id,key,parse] of [['render-scale','scale',Number],['view-distance','distance',Number],['shadows-setting','shadows',Boolean],['fps-setting','fps',Boolean],['reduce-motion','reducedMotion',Boolean]])document.getElementById(id).addEventListener('change',e=>{if(clientSettings.preset==='auto')clientSettings={...effectiveGraphics(clientSettings,deviceProfile({width:innerWidth,height:innerHeight,coarse:matchMedia('(any-pointer:coarse)').matches,touch:navigator.maxTouchPoints>0,memory:navigator.deviceMemory||8})),preset:'custom'};clientSettings[key]=e.target.type==='checkbox'?e.target.checked:parse(e.target.value);storeGraphics()});
document.querySelectorAll('[data-settings-page]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-settings-page]').forEach(t=>t.classList.toggle('active',t===b));document.querySelectorAll('[data-settings-panel]').forEach(p=>p.hidden=p.dataset.settingsPanel!==b.dataset.settingsPage)}));
document.querySelector('#settings-music-volume').addEventListener('input',e=>{const slider=document.querySelector('#music-volume');if(slider){slider.value=e.target.value;slider.dispatchEvent(new Event('input',{bubbles:true}))}});
document.querySelector('#open-friends').addEventListener('click',()=>{responsiveLayout.collapse();const panel=document.querySelector('#social-panel');panel.hidden=false;panel.classList.remove('collapsed');document.querySelector('[data-social-tab="friends"]')?.click()});
const responsiveLayout=installResponsiveLayout({onChange:()=>applyGraphics()});
applyGraphics();
let fpsSamples=0,fpsSeconds=0;

document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))closeMenu()});
const level=skillLevel;
const skillDefinitions=[['⚔','Attack','attackXP'],['💪','Strength','strengthXP'],['🛡','Defence','defenceXP'],['❤️','Hitpoints','hitpointsXP'],['🏹','Ranged','rangedXP'],['✨','Magic','magicXP'],['🙏','Prayer','prayerXP'],['🌳','Woodcutting','woodXP'],['⛏','Mining','miningXP'],['🔥','Firemaking','firemakingXP'],['🎣','Fishing','fishingXP'],['🍳','Cooking','cookingXP'],['🔨','Smithing','smithingXP'],['🛠','Crafting','craftingXP'],['🌿','Herblore','herbloreXP'],['🌱','Farming','farmingXP'],['🏃','Agility','agilityXP'],['🗝','Thieving','thievingXP']];
const skillsPanel=document.querySelector('#skills');
function drawSkills(){
 skillsPanel.replaceChildren();const rank=document.createElement('div');rank.className='player-combat-level';rank.innerHTML=crossedSwords;const label=document.createElement('strong');label.textContent='Player Combat Level: '+combatLevel(state)+' / 100';rank.append(label);skillsPanel.append(rank);
 const grid=document.createElement('div');grid.className='skills-grid';
 let total=0;
 for(const [icon,name,key] of skillDefinitions){
  const xp=Math.max(0,Number(state[key])||0),baseLevel=level(xp),bonus=jewelryBonus(state,key),lv=baseLevel+bonus,next=50*baseLevel*baseLevel;total+=baseLevel;
  const tile=document.createElement('button');tile.type='button';tile.className='skill-tile';tile.setAttribute('aria-label',name+', level '+lv+', '+xp+' experience');
  const glyph=document.createElement('span');glyph.className='skill-tile-icon';glyph.textContent=icon;
  const rank=document.createElement('span');rank.className='skill-tile-level';rank.textContent=bonus?baseLevel+' +'+bonus:lv;
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
 inventoryGold.hidden=activeTab!=='inventory';inventoryGold.textContent='🪙 '+state.gold.toLocaleString()+' gold';
 playerHUD.update({combatLevel:combatLevel(state),hp:combat.hp,maxHp:combat.maxHp,xp:combat.xp,kills:combat.kills,gold:state.gold,helmet:!!state.equipped.helm,weapon:weaponCatalog[state.equippedWeapon]});
 stats.innerHTML='<p><strong>Health: '+Math.ceil(combat.hp)+' / '+combat.maxHp+'</strong><br>Combat: '+level(combat.xp)+' ('+combat.xp+' XP)<br>Defeated: '+combat.kills+'<br>Gold: '+state.gold+'<br>Woodcutting: '+level(state.woodXP)+' ('+state.woodXP+' XP)<br>Mining: '+level(state.miningXP)+' ('+state.miningXP+' XP)</p>';
 inventory.innerHTML='';equipment.innerHTML='';if(state.equippedWeapon){const styles=document.createElement('div');styles.className='attack-styles';for(const [key,label,hint]of [['stab','Stab','Awards Attack XP. Higher Attack improves accuracy.'],['slash','Slash','Awards Strength XP. Higher Strength increases damage.'],['lunge','Lunge','Splits combat XP equally between Attack and Strength.']]){const b=document.createElement('button');b.type='button';b.textContent=label;b.title=hint;b.setAttribute('aria-label',label+' — '+hint);b.setAttribute('aria-pressed',String(attackStyle===key));b.onclick=()=>{if(window.eldervaleAuthority)void window.eldervaleRealm.command('attack_style',{style:key});else{attackStyle=key;draw()}};styles.append(b)}equipment.append(styles)}
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.tab===activeTab));
 inventory.hidden=activeTab!=='inventory';equipment.hidden=activeTab!=='equipment';skillsPanel.hidden=activeTab!=='skills';for(const key of ['friends','blocked','settings'])document.querySelector('#'+key+'-tab').hidden=activeTab!==key;if(activeTab==='skills')drawSkills();
 const slots=[];
 for(const key of state.weaponsOwned)if(state.equippedWeapon!==key)slots.push({kind:'weapon',key});
 for(const k of armorKeys)if(state.armorOwned.includes(k)&&!state.equipped[k])slots.push({kind:'armor',key:k});
 for(const key of state.shieldsOwned)if(state.equippedShield!==key)slots.push({kind:'shield',key});
 for(const key of state.jewelryOwned)if(state[jewelryCatalog[key].slot]!==key)slots.push({kind:'jewelry',key});
 for(let i=0;i<state.wood;i++)slots.push({kind:'log'});
 for(let i=0;i<state.ore;i++)slots.push({kind:'ore'});for(const id of ['fishingPole','bait','rawFish',...Object.keys(goods).filter(k=>goods[k].custom)])if(state[id]>0){for(let i=0;i<(goods[id].stackable?1:state[id]);i++)slots.push({kind:'supply',key:id,count:state[id]})}
 for(let i=0;i<16;i++){
  const item=slots[i],d=document.createElement('button');d.className='slot';
  if(item){const icon=document.createElement('span');icon.className='item-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML=item.kind==='supply'?goods[item.key].icon+(goods[item.key].stackable?' <small>'+item.count+'</small>':''):item.kind==='jewelry'?jewelryCatalog[item.key].icon:item.kind==='weapon'?iconForWeapon(item.key):item.kind==='shield'?'<svg viewBox="0 0 48 48"><path d="M9 6H39V25L24 43L9 25Z" fill="#8499a5" stroke="#d7bc7a" stroke-width="3"/><circle cx="24" cy="21" r="5" fill="#d7bc7a"/></svg>':item.kind==='armor'?({cape:'<svg viewBox="0 0 48 48"><path d="M15 6L33 6L40 42Q24 35 8 42Z" fill="#873a4b" stroke="#d6b57c" stroke-width="2"/><circle cx="15" cy="7" r="3" fill="#d6b57c"/><circle cx="33" cy="7" r="3" fill="#d6b57c"/></svg>',helm:'<svg viewBox="0 0 48 48"><path d="M10 26V19Q10 5 24 5T38 19V26L33 37H28V25H20V37H15Z" fill="#a9b5bb" stroke="#e4d6a9" stroke-width="2"/><path d="M13 22H35" stroke="#5d6972" stroke-width="4"/></svg>',chest:'<svg viewBox="0 0 48 48"><path d="M14 5L6 14L11 26L16 23V42H32V23L37 26L42 14L34 5L28 10H20Z" fill="#9daeb8" stroke="#d8d5bd" stroke-width="2"/><path d="M16 16L24 22L32 16M24 22V39" stroke="#566a76" stroke-width="3"/></svg>',legs:'<svg viewBox="0 0 48 48"><path d="M12 5H36L33 42H25L24 22L23 42H15Z" fill="#a1adb4" stroke="#e4d6a9" stroke-width="2"/><path d="M13 14H35" stroke="#64717b" stroke-width="4"/></svg>',boots:'<svg viewBox="0 0 48 48"><path d="M9 7H20V29L25 34V41H5V34L9 27ZM28 7H39V29L44 34V41H24V34L28 27Z" fill="#7e8d96" stroke="#c3bfa7" stroke-width="2"/></svg>'})[item.key]:item.kind==='log'?'<svg viewBox="0 0 48 48"><path d="M9 12L33 6L42 14L18 22Z" fill="#ad8050"/><path d="M9 12V32L18 40V22ZM18 22L42 14V33L18 40Z" fill="#765033" stroke="#c59a62" stroke-width="2"/><ellipse cx="18" cy="22" rx="5" ry="7" fill="#e1b980"/><ellipse cx="18" cy="22" rx="2.5" ry="4" fill="none" stroke="#9e6e40"/></svg>':'<svg viewBox="0 0 48 48"><path d="M6 35L13 15L27 8L42 23L36 40H14Z" fill="#84949a" stroke="#c2c5b4" stroke-width="2"/><path d="M13 15L26 24L42 23M26 24L20 38" fill="none" stroke="#586a73" stroke-width="3"/></svg>';d.append(icon);d.setAttribute('aria-label',item.kind==='supply'?goods[item.key].name:item.kind==='jewelry'?jewelryCatalog[item.key].name:item.kind==='weapon'?weaponCatalog[item.key].name:item.kind==='shield'?shieldCatalog[item.key].name:item.kind==='armor'?armorCatalog[item.key].name:item.kind==='log'?'Log':'Ore');
   d.title=(item.kind==='armor'||item.kind==='weapon')?'Click to equip • Right-click for options':'Right-click for options';
   d.onclick=()=>{if(item.kind==='supply'){if(goods[item.key].heal>0){void window.eldervaleRealm?.command('consume',{item:item.key});return}say(item.key==='fishingPole'?'Carry the pole and bait, then click a shoreline fishing spot.':goods[item.key].name+' ×'+state[item.key]);return}if(item.kind==='jewelry')equipJewelry(item.key);else if(item.kind==='armor')toggleArmor(item.key);else if(item.kind==='weapon')equipWeapon(item.key);else if(item.kind==='shield')equipShield(item.key)};
   d.oncontextmenu=e=>{e.preventDefault();const itemId=item.kind==='weapon'?'weapon:'+item.key:item.kind==='armor'?'armor:'+item.key:item.kind==='shield'?'shield:'+item.key:item.kind==='jewelry'?'jewelry:'+item.key:item.kind==='supply'?item.key:item.kind==='log'?'wood':'ore';const choices=item.kind==='jewelry'?[['Equip '+jewelryCatalog[item.key].name,()=>equipJewelry(item.key)],['Examine',()=>say(jewelryCatalog[item.key].description)]]:item.kind==='weapon'? [['Equip '+weaponCatalog[item.key].name,()=>equipWeapon(item.key)],['Examine',()=>say(weaponCatalog[item.key].desc)]]:item.kind==='shield'?[['Equip '+shieldCatalog[item.key].name,()=>equipShield(item.key)],['Examine',()=>say(shieldCatalog[item.key].desc)]]:item.kind==='armor'?
    [['Equip '+armorCatalog[item.key].name,()=>toggleArmor(item.key)],['Examine',()=>examine(item.key)]]:
    [['Examine',()=>say(item.kind==='supply'?goods[item.key].name+(item.key==='bait'?' — stackable bait consumed by fishing.':item.key==='fishingPole'?' — carry this pole and bait to fish.':' — sell your catch to a merchant.'):item.kind==='log'?'Freshly cut logs.':'Unrefined ore.')]];choices.push(['Drop',()=>requestDrop(state,itemId)]);showMenu(e.clientX,e.clientY,choices)};
  }else{d.disabled=true}inventory.append(d);
 }
 for(const slot of ['amulet','trinket']){const current=jewelryCatalog[state[slot]],button=document.createElement('button');button.className='equip-slot';const name=slot==='amulet'?'Amulet':'Trinket (ring)';button.setAttribute('aria-label',name+': '+(current?.name||'Empty'));button.innerHTML='<span class="item-icon">'+(slot==='amulet'?'📿':'💍')+'</span><span class="equip-caption">'+name+'</span>';button.title=current?current.name+' — '+current.description:'Choose jewelry · starter pieces are in the armory chest';button.onclick=e=>{const choices=state.jewelryOwned.filter(k=>jewelryCatalog[k].slot===slot).map(k=>['Equip '+jewelryCatalog[k].name,()=>equipJewelry(k)]);if(current)choices.unshift(['Remove '+current.name,()=>equipJewelry(state[slot])]);if(choices.length)showMenu(e.clientX,e.clientY,choices);else say('Collect starter jewelry from the armory chest.')};equipment.append(button)}
 const equipmentIcons={
 cape:'<svg viewBox="0 0 48 48"><path d="M15 6L33 6L40 42Q24 35 8 42Z" fill="#873a4b" stroke="#d6b57c" stroke-width="2"/><circle cx="15" cy="7" r="3" fill="#d6b57c"/><circle cx="33" cy="7" r="3" fill="#d6b57c"/></svg>',
 helm:'<svg viewBox="0 0 48 48"><path d="M10 26V19Q10 5 24 5T38 19V26L33 37H28V25H20V37H15Z" fill="#a9b5bb" stroke="#e4d6a9" stroke-width="2"/><path d="M13 22H35" stroke="#5d6972" stroke-width="4"/></svg>',
 chest:'<svg viewBox="0 0 48 48"><path d="M14 5L6 14L11 26L16 23V42H32V23L37 26L42 14L34 5L28 10H20Z" fill="#9daeb8" stroke="#d8d5bd" stroke-width="2"/><path d="M16 16L24 22L32 16M24 22V39" stroke="#566a76" stroke-width="3"/></svg>',
 legs:'<svg viewBox="0 0 48 48"><path d="M12 5H36L33 42H25L24 22L23 42H15Z" fill="#a1adb4" stroke="#e4d6a9" stroke-width="2"/><path d="M13 14H35" stroke="#64717b" stroke-width="4"/></svg>',
 boots:'<svg viewBox="0 0 48 48"><path d="M9 7H20V29L25 34V41H5V34L9 27ZM28 7H39V29L44 34V41H24V34L28 27Z" fill="#7e8d96" stroke="#c3bfa7" stroke-width="2"/></svg>'
 };
 const weaponSlot=document.createElement('button');weaponSlot.className='equip-slot';weaponSlot.setAttribute('aria-label','Weapon: '+(state.equippedWeapon?weaponCatalog[state.equippedWeapon].name:'Empty'));const weaponIcon=document.createElement('span');weaponIcon.className='item-icon';weaponIcon.innerHTML=state.equippedWeapon?iconForWeapon(state.equippedWeapon):'＋';const weaponLabel=document.createElement('span');weaponLabel.className='equip-caption';weaponLabel.textContent='Weapon';weaponSlot.append(weaponIcon,weaponLabel);weaponSlot.title='Attack +'+weaponStats(state.equippedWeapon).attack+' · Damage +'+weaponStats(state.equippedWeapon).damage+' · Turn '+weaponStats(state.equippedWeapon).speed+'s';weaponSlot.disabled=!state.equippedWeapon;weaponSlot.onclick=()=>state.equippedWeapon&&equipWeapon(state.equippedWeapon);equipment.append(weaponSlot);
 const shieldSlot=document.createElement('button');shieldSlot.className='equip-slot';shieldSlot.textContent=state.equippedShield?shieldCatalog[state.equippedShield].name:'Shield (empty)';shieldSlot.disabled=!state.equippedShield;shieldSlot.onclick=()=>state.equippedShield&&equipShield(state.equippedShield);equipment.append(shieldSlot);
 for(const k of armorKeys){const item=document.createElement('button');item.className='equip-slot';
  item.setAttribute('aria-label',armorCatalog[k].slot+': '+(state.equipped[k]?armorCatalog[k].name:'Empty'));
  const icon=document.createElement('span');icon.className='item-icon';icon.setAttribute('aria-hidden','true');
  if(state.equipped[k])icon.innerHTML=equipmentIcons[k];else icon.textContent='＋';
  const caption=document.createElement('span');caption.className='equip-caption';caption.textContent=armorCatalog[k].slot;
  item.append(icon,caption);
  item.disabled=!state.equipped[k];item.title=armorCatalog[k].desc+' Melee defence +'+armorCatalog[k].defence+' · Damage absorption '+armorCatalog[k].reduction+(state.equipped[k]?' · Click to unequip':' · Not worn');
  item.onclick=()=>toggleArmor(k);
  item.oncontextmenu=e=>{e.preventDefault();if(state.equipped[k])showMenu(e.clientX,e.clientY,[['Remove '+armorCatalog[k].name,()=>toggleArmor(k)],['Examine',()=>examine(k)]])};
  equipment.append(item);
 }
 const protection=meleeProtection(state),attack=weaponStats(state.equippedWeapon),summary=document.createElement('p');summary.className='equipment-combat-stats';summary.textContent='Attack +'+attack.attack+' · Damage +'+attack.damage+' · '+attack.speed+'s turn · Melee defence '+protection.defence+' · Absorption '+protection.reduction;equipment.append(summary);

}
function equipJewelry(key){if(window.eldervaleAuthority){void window.eldervaleRealm?.command('equip',{slot:jewelryCatalog[key]?.slot,key});return}const item=jewelryCatalog[key];if(!item||!state.jewelryOwned.includes(key))return;state[item.slot]=state[item.slot]===key?null:key;save();draw();say(state[item.slot]?item.name+' equipped. '+item.description:'Removed '+item.name)}
function say(s){addSystemMessage(s)}function captureSave(){const snapshot={...saved,...state,appearance,hp:combat.hp,combatXP:combat.xp,kills:combat.kills,x:player.position.x,z:player.position.z};localStorage.setItem('eldervale-save',JSON.stringify(snapshot));return snapshot}
window.eldervaleCaptureSave=captureSave;
function save(){captureSave();window.eldervaleSave?.()}
document.querySelector('#reset').onclick=()=>window.eldervaleReset?.();
let dest=null,action=null,yaw=Math.PI,pitch=.24,zoom=10,drag=false,down=null,lastCameraDrag=0,rightSteering=false,dragDistance=0;const cameraWallRay=new T.Raycaster(),ray=new T.Raycaster(),pointer=new T.Vector2();
installTouchGestures(renderer.domElement,{onPinch:ratio=>{zoom=T.MathUtils.clamp(zoom*ratio,4,28);drag=true;down=null},onHold:p=>renderer.domElement.dispatchEvent(new PointerEvent('pointerup',{clientX:p.x,clientY:p.y,button:2,pointerType:'touch',bubbles:true}))});
const mmoControls=installMMOControls({element:renderer.domElement,getYaw:()=>player.rotation.y,getCameraYaw:()=>yaw,isRightMouse:()=>rightSteering,isBlocked:()=>document.hidden||document.body.classList.contains('landscape-required')||document.body.classList.contains('area-loading')||!document.querySelector('#dialog').hidden||!!document.querySelector('dialog[open]')||!!document.activeElement?.closest('input,textarea,select,[contenteditable=true]'),onInput:input=>{navigationGeneration++;routeController?.abort();routePending=false;dest=null;walkQueue=[];action=null;if(window.eldervaleAuthority)window.eldervaleRealm?.steer(input);},onJump:()=>{if(window.eldervaleAuthority)void window.eldervaleRealm?.command('jump');else localJumpAt=new Date().toISOString()},onSprint:enabled=>{if(window.eldervaleAuthority)void window.eldervaleRealm?.command('run',{enabled});else running=enabled}});
let localJumpAt=null;
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;responsiveLayout.collapse();down=[e.clientX,e.clientY];rightSteering=e.button===2;drag=false;dragDistance=0;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-down[0],dy=e.clientY-down[1];dragDistance+=Math.hypot(dx,dy);if(dragDistance>4)drag=true;if(drag){yaw-=dx*.005;pitch=T.MathUtils.clamp(pitch+dy*.0035,-.10,1.15);lastCameraDrag=performance.now()}down=[e.clientX,e.clientY]});
renderer.domElement.addEventListener('pointercancel',()=>{down=null;rightSteering=false});
renderer.domElement.addEventListener('pointerup',e=>{if(!down)return;down=null;rightSteering=false;if(drag)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(targets.filter(t=>{let o=t;while(o){if(!o.visible)return false;o=o.parent}return true}),false);const point=new T.Vector3();const groundHit=ray.intersectObjects(walkSurfaces,false)[0];const hitGround=groundHit?point.copy(groundHit.point):null;
if(window.eldervaleBuilderClick?.({point:hitGround?{x:point.x,z:point.z}:null,entityId:hits[0]?.object.userData.worldEntityId||hits[0]?.object.userData.mob?.realmId||hits[0]?.object.userData.profile?.realmId,button:e.button}))return;
if(hits[0]?.object.userData.kind==='worldObject'){say('World decoration');return}
if(hits[0]?.object.userData.kind==='groundDrop'){const d=hits[0].object.userData;const take=()=>{pendingPickup={...d};action=null;setWalkDestination(new T.Vector3(d.x,0,d.z));};if(e.button===2)showMenu(e.clientX,e.clientY,[['Take '+d.name+' ×'+d.amount,take],['Cancel',()=>{}]]);else take();return}
pendingPickup=null;
if(hits[0]?.object.userData.kind==='worldItem'){window.eldervaleWorldPickup?.(hits[0].object.userData.worldEntityId);return}
if(hits[0]?.object.userData.kind==='player'){const other=remotePlayers.get(hits[0].object.userData.playerId);if(other&&e.button===2){const row=actorMenuLabel({name:other.username,level:other.combatLevel,playerLevel:combatLevel(state),accountId:hits[0].object.userData.playerId,player:true});showMenu(e.clientX,e.clientY,[[row,()=>say(other.username+' · Combat level '+other.combatLevel)],['Trade with '+other.username,()=>tradePanel.request(hits[0].object.userData.playerId)],['Cancel',()=>{}]])}return}
if(e.button===2){
 const choices=[];
 if(hits.length){const a=hits[0].object.userData;choices.push([a.kind==='creature'?actorMenuLabel({prefix:'Attack ',name:a.mob.name,level:a.mob.config?.level||1,playerLevel:combatLevel(state)}):a.kind==='npc'?actorMenuLabel({prefix:'Talk to ',name:a.profile.name,level:a.profile.level||1,playerLevel:combatLevel(state)}):a.kind==='merchant'?actorMenuLabel({prefix:'Trade with ',name:'Traveling merchant',level:5,playerLevel:combatLevel(state)}):a.kind==='altar'?'Pray at altar':a.kind==='hearth'?'Cook and eat fish':a.kind==='castleGate'?'Open / close great gate':a.kind==='fishing'?'Fish here':a.kind==='chest'?'Open armory chest':a.kind==='door'?(a.house.type==='bank'?'Use bank':a.house.open?'Close door':'Open door'):'Gather '+a.kind,()=>{action=a;const goal=a.kind==='creature'?a.mob.root.position.clone():a.kind==='npc'?a.root.position.clone():a.kind==='door'?housePoint(a.house,0,2.4):a.kind==='castleGate'?new T.Vector3(a.x,0,a.z+(player.position.z>a.z?4:-4)):new T.Vector3(a.x,0,a.z);setWalkDestination(goal);if(dest)markClick(dest.x,dest.z,'interact')}]);choices.push(['Examine '+(a.kind==='creature'?a.mob.name:a.kind==='npc'?a.profile.name:a.kind==='merchant'?'Traveling merchant':a.kind),()=>say(a.kind==='creature'?a.mob.name+' · Combat '+(a.mob.config?.level||1)+' · '+Math.max(0,a.mob.hp)+' / '+a.mob.maxHp+' HP':a.kind==='npc'?a.profile.name+' — '+a.profile.role+' · Combat '+a.profile.level+' · '+a.profile.hp+' / '+(a.profile.maxHp||a.profile.hp)+' HP':a.kind==='merchant'?'Traveling merchant · Combat 5 · 45 / 45 HP. Buys logs and ore.':a.kind==='chest'?'A chest of iron adventuring supplies.':a.kind==='door'?'A wooden door. Click to open or close.':(Date.parse(a.availableAt)>(window.eldervaleServerTime?.()||Date.now())?'This '+a.kind+' is recovering.':'A harvestable '+a.kind+'.'))])}
 if(hitGround)choices.push(['Walk here',()=>{action=null;setWalkDestination(point);closeDialog();if(dest)markClick(dest.x,dest.z,'walk')}]);
 choices.push(['Cancel',()=>{}]);showMenu(e.clientX,e.clientY,choices);return;
}
if(hits.length){action=hits[0].object.userData;const goal=action.kind==='creature'?action.mob.root.position.clone():action.kind==='npc'?action.root.position.clone():action.kind==='door'?housePoint(action.house,0,2.4):action.kind==='castleGate'?new T.Vector3(action.x,0,action.z+(player.position.z>action.z?4:-4)):new T.Vector3(action.x,0,action.z);setWalkDestination(goal);if(dest)markClick(dest.x,dest.z,'interact');if(action.kind!=='npc')say(action.kind==='merchant'?'Walking to merchant...':'Approaching '+action.kind+'...')}else if(hitGround){action=null;setWalkDestination(point);closeDialog();if(dest)markClick(dest.x,dest.z,'walk')}});
renderer.domElement.addEventListener('wheel',e=>{zoom=T.MathUtils.clamp(zoom+e.deltaY*.015,4,28)},{passive:true});
// Rebuild once after every building plot has been graded. The same heightfield
// now supplies the grass mesh, building bases, streets and actor footing.
ground.geometry.dispose();ground.geometry=landscapeGeometry(T,landscape);
// Seat existing scenery on the heightfield. Articulated actors are updated each frame.
for(const object of scene.children){
 if(object===ground||object===player||object.isLight||object.isInstancedMesh||object===sun.target||object.userData.terrainFixed)continue;
 object.position.y+=landscape.heightAt(object.position.x,object.position.z);
}
for(let i=0;i<tufts.count;i++){const matrix=new T.Matrix4();tufts.getMatrixAt(i,matrix);const x=matrix.elements[12],z=matrix.elements[14];matrix.elements[13]+=landscape.heightAt(x,z);if(inCastle(x,z)||landscape.waterAt(x,z)>.01||Math.hypot(x,z)<52||houseInteriors.some(h=>{const p=h.group.worldToLocal(new T.Vector3(x,h.group.position.y,z));return Math.abs(p.x)<2.3&&Math.abs(p.z)<2.15}))matrix.scale(new T.Vector3(0,0,0));tufts.setMatrixAt(i,matrix)}
tufts.instanceMatrix.needsUpdate=true;tufts.computeBoundingSphere();
for(const river of worldRivers){
 const bank=new T.Mesh(ribbonGeometry(T,river.points,river.width+3),material(0x9a9271,'dirt'));bank.position.y=.018;bank.userData.terrainFixed=bank.userData.drape=true;scene.add(bank);
 const water=new T.Mesh(ribbonGeometry(T,river.points,river.width),new T.MeshStandardMaterial({color:0x315d66,metalness:.05,roughness:.38,side:T.DoubleSide}));
 water.position.y=.035;water.userData.terrainFixed=true;scene.add(water);
}
for(const bridge of landscape.bridges){
 const group=new T.Group();group.position.set(bridge.x,0,bridge.z);group.rotation.y=bridge.yaw;group.userData.terrainFixed=true;scene.add(group);
 const rows=Math.ceil(bridge.length/.45);
 for(let i=0;i<=rows;i++){const z=(i/rows-.5)*bridge.length;const y=.24*(1-T.MathUtils.smoothstep(Math.abs(z),bridge.length/2-2,bridge.length/2));walkSurfaces.push(box(bridge.width,.18,bridge.length/rows*.94,0x786044,0,y-.09,z,group,'wood'))}
 for(const side of [-1,1]){
  for(let i=0;i<=4;i++)box(.16,1.3,.16,0x554533,side*(bridge.width/2-.12),.7,(i/4-.5)*(bridge.length-2),group,'wood');
  box(.14,.14,bridge.length-2,0x9b7b4d,side*(bridge.width/2-.12),1.25,0,group,'wood');
 }
}
// Shared world clock follows America/New_York civil time, including DST.
// All clients use the same named zone regardless of their device time zone.
const easternClock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const worldClock=document.createElement('output');worldClock.id='world-clock';worldClock.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:36;pointer-events:none;background:#12202bc9;color:#e7d1a5;border:1px solid #927b56;border-radius:5px;padding:5px 9px;font:11px Arial';document.body.append(worldClock);
let nextSkyUpdate=0,skyHour=12,skyDaylight=1;const cameraWorldOccluders=new Set();
const naturalSky=createNaturalSky(T,scene);
const meadow=createMeadow(T,scene,landscape,{seed:generatedWorld?.seed||2419,count:navigator.maxTouchPoints?9000:18000,canPlant:(x,z)=>!inCastle(x,z)&&(generatedWorld||landscape.heightAt(x,z)<35)&&distanceToRoad(x,z)>3&&landscape.canWalk(x,z)&&!window.eldervalePropCollision?.(x,z)&&!houseInteriors.some(h=>{const p=h.group.worldToLocal(new T.Vector3(x,h.group.position.y,z));return Math.abs(p.x)<2.3&&Math.abs(p.z)<2.15})});
function drapeRoads(){for(const object of scene.children){if(!object.userData.drape||!object.geometry)continue;const p=object.geometry.attributes.position;for(let i=0;i<p.count;i++)p.setY(i,landscape.heightAt(p.getX(i)+object.position.x,p.getZ(i)+object.position.z)+(object.userData.drapeOffset??=object.position.y+.02)-object.position.y);p.needsUpdate=true;object.geometry.computeVertexNormals();object.geometry.computeBoundingSphere();}}
function updateWorldSky(){
 const now=window.eldervaleServerTime?.()||Date.now();if(now<nextSkyUpdate)return;nextSkyUpdate=now+1500;
 const parts=Object.fromEntries(easternClock.formatToParts(new Date(now)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
 const hour=parts.hour+parts.minute/60+parts.second/3600;
 const dayPhase=hour/24;
 const solar=Math.sin((dayPhase-.25)*Math.PI*2);
 const daylight=Math.max(0,Math.min(1,(solar+.16)/.65));
 skyHour=hour;skyDaylight=daylight;
 const twilight=Math.max(0,1-Math.abs(solar)*3);
 const sky=new T.Color(0x26394f).lerp(new T.Color(0x94b9c8),daylight).lerp(new T.Color(0xb36a48),twilight*.24);
 scene.background.copy(sky);scene.fog.color.copy(sky);
 const lighting=lightingAt(daylight);skyLight.intensity=lighting.ambient;
 sun.intensity=lighting.directional;sun.color.set(daylight<.3?0xb9cee8:0xffe9b6);
 sun.position.set(Math.cos(dayPhase*Math.PI*2)*40,Math.max(22,solar*45),Math.sin(dayPhase*Math.PI*2)*40);
 const hh=String(parts.hour).padStart(2,'0'),mm=String(parts.minute).padStart(2,'0');
 worldClock.textContent='World (Eastern) '+hh+':'+mm+(daylight<.2?' · Night':daylight<.65?' · Dawn / dusk':' · Day');
 window.eldervaleWorldNight=daylight<.2;
 window.eldervaleSetTimeOfDay?.(hour,daylight);
}
const clock=new T.Clock();let lastAutosave=performance.now();
function frame(){requestAnimationFrame(frame);updateWorldSky();updateCoordinateHUD();const elapsed=clock.getDelta();if(document.body.classList.contains('landscape-required'))return;const dt=Math.min(elapsed,.1);fpsSamples++;fpsSeconds+=elapsed;if(fpsSeconds>=1){if(clientSettings.fps)document.querySelector('#fps-counter').textContent=Math.round(fpsSamples/fpsSeconds)+' FPS';fpsSamples=0;fpsSeconds=0}const frameStart=player.position.clone();const manual=mmoControls.update(dt,performance.now());if(manual)manualPredictionUntil=performance.now()+350;if(window.eldervaleAuthority&&playerMotion&&!manual&&performance.now()>manualPredictionUntil){const sample=playerMotion.sample();if(sample){const blend=Math.hypot(player.position.x-sample.x,player.position.z-sample.z)>12?1:1-Math.exp(-18*dt);player.position.x+=(sample.x-player.position.x)*blend;player.position.z+=(sample.z-player.position.z)*blend;if(!realmInCombat)player.rotation.y=sample.yaw;}}
if(manual){player.rotation.y=manual.yaw;if(!window.eldervaleAuthority||performance.now()-lastMovementAck<700){const step=new T.Vector3(player.position.x+manual.x*(running?SPRINT_SPEED:WALK_SPEED)*dt,player.position.y,player.position.z+manual.z*(running?SPRINT_SPEED:WALK_SPEED)*dt);if(!walkAllowed(player.position,step).blocked)player.position.copy(step);if(window.eldervaleAuthority&&realmPlayerPose){const error=Math.hypot(player.position.x-realmPlayerPose.x,player.position.z-realmPlayerPose.z);if(error>2.2){const correction=Math.min(1,dt*8);player.position.x+=(realmPlayerPose.x-player.position.x)*correction;player.position.z+=(realmPlayerPose.z-player.position.z)*correction;}}}}
if(!window.eldervaleAuthority&&action?.kind==='creature'&&action.mob?.alive&&player.position.distanceTo(action.mob.root.position)<weaponStats(state.equippedWeapon).reach){dest=null;walkQueue=[];faceTarget(player,action.mob.root.position);strike(action.mob)}
if(!window.eldervaleAuthority&&dest){const delta=dest.clone().sub(player.position);delta.y=0;const distance=delta.length();if(distance>(action?.kind==='creature'?weaponStats(state.equippedWeapon).reach*.88:action?2.1:.2)){delta.normalize();const proposed=player.position.clone().addScaledVector(delta,Math.min((running?SPRINT_SPEED:WALK_SPEED)*dt,distance));
 const collision=walkAllowed(player.position,proposed);
 if(!collision.blocked)player.position.copy(proposed);
 else{dest=null;walkQueue=[];action=null;if(collision.house&&!collision.house.open)say('Door closed — click the door to open it.');else say('A building blocks the way. Walk around it.')}
 player.rotation.y=Math.atan2(delta.x,delta.z)}else{dest=null;if(walkQueue.length){dest=walkQueue.shift();}else if(action){const a=action;action=null;if(a.kind==='door'){if(a.house.type==='bank'){if(!a.house.open)toggleHouseDoor(a.house);services.open('bank',a.house.name)}else toggleHouseDoor(a.house)}else if(a.kind==='creature'){if(a.mob.alive){strike(a.mob);if(a.mob.alive){action=a;dest=a.mob.root.position.clone()}}}else if(a.kind==='npc'){talkTo(a.profile)}else if(a.kind==='chest'){openArmoryChest()}else if(a.kind==='merchant'){services.open('shop','Traveling merchant');}else if(a.kind==='worldObject'){say('A world decoration.')}else if(state.wood+state.ore+state.armorOwned.filter(k=>!state.equipped[k]).length>=16)say('Inventory full! Visit the merchant.');else if(a.kind==='tree'){state.wood++;const gained=gatheringXP(state,'woodXP');state.woodXP+=gained;say('You chop logs. +'+gained+' XP')}else{state.ore++;const gained=gatheringXP(state,'miningXP');state.miningXP+=gained;say('You mine ore. +'+gained+' XP')}save();draw()}}}
combat.attackTimer=Math.max(0,combat.attackTimer-dt);combat.attackAnim=Math.max(0,combat.attackAnim-dt);combat.hitAnim=Math.max(0,combat.hitAnim-dt);combat.blockAnim=Math.max(0,combat.blockAnim-dt);combat.stanceTimer=Math.max(0,combat.stanceTimer-dt);playerHUD.health(combat.hp,combat.maxHp);
for(const mob of creatures){if(window.eldervaleAuthority){const before=mob.root.position.clone();interpolateRealm(mob,dt);mob.attackAnim=Math.max(0,(mob.attackAnim||0)-dt);mob.blockAnim=Math.max(0,(mob.blockAnim||0)-dt);mob.hitAnim=Math.max(0,(mob.hitAnim||0)-dt);mob.model?.update(dt,{distance:mob.root.position.distanceTo(before),speed:mob.root.position.distanceTo(before)/dt,attack:mob.attackAnim,block:mob.blockAnim,hit:mob.hitAnim});continue}const mobBefore=mob.root.position.clone();mob.attackAnim=Math.max(0,(mob.attackAnim||0)-dt);mob.blockAnim=Math.max(0,(mob.blockAnim||0)-dt);mob.hitAnim=Math.max(0,(mob.hitAnim||0)-dt);mob.root.rotation.x=mob.attackAnim>0?-Math.sin((1-mob.attackAnim/.55)*Math.PI)*.15:0;mob.root.rotation.z=mob.blockAnim>0?.12:mob.hitAnim>0?-.10:0;if(!mob.alive){mob.respawn-=dt;if(mob.respawn<=0){mob.alive=true;mob.hp=mob.maxHp;mob.root.position.copy(mob.home);mob.root.visible=true}continue}mob.attackCooldown=Math.max(0,mob.attackCooldown-dt);mob.wait-=dt;if(mob.wait<=0){const a=mob.root.position.x*.12+performance.now()*.0002;mob.goal.set(mob.home.x+Math.cos(a)*(mob.config?.roam??5),0,mob.home.z+Math.sin(a)*(mob.config?.roam??5));mob.wait=3+Math.random()*5}const distance=mob.root.position.distanceTo(player.position);if((mob.hostile||combatTurns.target===mob)&&distance<10){mob.goal.copy(player.position);if(distance<2.5&&!combatTurns.target&&!services.isOpen){combatRng=Math.random;combatTurns.engage(mob,true)}}const meleeDistance=Math.min(1.85,weaponStats(state.equippedWeapon).reach*.9),delta=mob.goal.clone().sub(mob.root.position);delta.y=0;if(delta.length()>((mob.hostile||combatTurns.target===mob)&&distance<10?meleeDistance:.4)){delta.normalize();const step=Math.min(dt*((mob.hostile||combatTurns.target===mob)&&distance<10?1.7:.8),Math.max(0,distance-meleeDistance));const proposed=mob.root.position.clone().addScaledVector(delta,step);if(proposed.distanceToSquared(player.position)>=1.45*1.45&&!walkAllowed(mob.root.position,proposed).blocked)mob.root.position.copy(proposed);mob.root.rotation.y=Math.atan2(delta.x,delta.z)}if((mob.hostile||combatTurns.target===mob)&&distance<10)faceTarget(mob.root,player.position);if(action?.kind==='creature'&&action.mob===mob&&dest){const toward=player.position.clone().sub(mob.root.position);toward.y=0;toward.normalize();dest.copy(mob.root.position).addScaledVector(toward,weaponStats(state.equippedWeapon).reach*.85)}mob.model?.update(dt,{distance:mob.root.position.distanceTo(mobBefore),speed:mob.root.position.distanceTo(mobBefore)/dt,attack:mob.attackAnim,hit:mob.hitAnim,block:mob.blockAnim})}
if(!window.eldervaleAuthority&&combatTurns.target){const target=combatTurns.target;combat.stanceTimer=3;const range=combatTurns.side==='player'?weaponStats(combatTurns.phase==='ready'?state.equippedWeapon:swingWeapon||state.equippedWeapon).reach:2.5;combatTurns.tick(dt,{inRange:player.position.distanceTo(target.root.position)<=range,playerAlive:combat.hp>0})}
for(const marker of markers.slice()){marker.age+=dt;const t=marker.age/1.05;marker.group.scale.setScalar(.75+t*.95);marker.ring.material.opacity=Math.max(0,1-t);marker.dot.material.opacity=Math.max(0,1-t);if(t>=1){scene.remove(marker.group);marker.ring.geometry.dispose();marker.ring.material.dispose();marker.dot.geometry.dispose();marker.dot.material.dispose();markers.splice(markers.indexOf(marker),1)}}
ensureTownResidents();
for(const npc of npcs){
 npc.root.visible=npc.alive!==false&&!npc.deleted&&npc.root.position.distanceToSquared(player.position)<85*85;
 if(!npc.root.visible||npc.deleted)continue;if(window.eldervaleAuthority){const before=npc.root.position.clone();interpolateRealm(npc,dt);const distance=npc.root.position.distanceTo(before);npc.travelHold=distance>.001?.35:Math.max(0,(npc.travelHold||0)-dt);npc.previewAttack=Math.max(0,(npc.previewAttack||0)-dt);npc.blockAnim=Math.max(0,(npc.blockAnim||0)-dt);npc.animator.update(dt,{distance,speed:distance/dt,attack:npc.previewAttack,block:npc.blockAnim||0,locomotion:npc.previewAttack>0?'combat':'walk',weapon:npc.profile.weapon,armed:!!npc.root.userData.armed});npc.attackEffect?.update(npc.previewAttack);if(!npc.previewAttack)animateTownActivity(npc.rig,npc.profile.activity,performance.now()*.001+npc.phase,distance>.001||(npc.travelHold||0)>0);continue}
 if(npc.workProp)npc.workProp.visible=conversation?.profile!==npc.profile;
 if(conversation?.profile===npc.profile){faceTarget(npc.root,player.position);npc.animator.update(dt,{armed:!!npc.root.userData.armed});continue}
 if(Math.hypot(npc.root.position.x-npc.goal.x,npc.root.position.z-npc.goal.z)<.6)npc.wait-=dt;
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
 if(npc.path.length&&Math.hypot(npc.path[0].x-previous.x,npc.path[0].z-previous.z)<.44)npc.path.shift();
 const waypoint=npc.path[0]||npc.goal;
 const toward=waypoint.clone().sub(previous);toward.y=0;
 if(toward.length()>.22){
  toward.normalize();
  const stepSize=Math.min(npc.pace*dt,Math.hypot(previous.x-waypoint.x,previous.z-waypoint.z));
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
 npc.previewAttack=Math.max(0,(npc.previewAttack||0)-dt);npc.animator.update(dt,{distance:actualDistance,speed:actualDistance/Math.max(dt,.001),armed:!!npc.root.userData.armed,attack:npc.previewAttack,weapon:npc.profile.weapon});
 npc.attackEffect?.update(npc.previewAttack);if(!npc.previewAttack)animateTownActivity(npc.rig,npc.profile.activity,performance.now()*.001+npc.phase,actualDistance>.0001);
 if(action?.kind==='npc'&&action.root===npc.root&&dest)dest.copy(npc.root.position);
}
player.position.y=landscape.walkHeight(player.position.x,player.position.z)+jumpHeight(localJumpAt,window.eldervaleServerTime?.()||Date.now());
for(const npc of npcs)npc.root.position.y=landscape.walkHeight(npc.root.position.x,npc.root.position.z);
for(const mob of creatures)mob.root.position.y=landscape.walkHeight(mob.root.position.x,mob.root.position.z);
if(!dest&&!walkQueue.length&&!realmPlayerPose?.moving)mapDestination=null;
const traveled=Math.hypot(player.position.x-frameStart.x,player.position.z-frameStart.z);
if(!window.eldervaleAuthority){const energyStep=stepEnergy(state.runEnergy,running,traveled>.001,dt);state.runEnergy=energyStep.energy;running=energyStep.running;if(energyStep.exhausted)say('You are out of energy and slow to a walk.')}updateRunButton();
const pose=playerAnimator.update(dt,{locomotion:running?'run':(window.eldervaleAuthority?realmInCombat:combatTurns.target||action?.kind==='creature')?'combat':'walk',style:attackStyle,weapon:state.equippedWeapon,block:combat.blockAnim,distance:traveled,speed:traveled/Math.max(dt,.001),attack:combat.attackAnim,hit:combat.hitAnim,twoHanded:state.equippedWeapon==='twohand',shield:!!state.equippedShield,armed:!!state.equippedWeapon});
body.rotation.y=combat.attackAnim>0?Math.sin((1-combat.attackAnim/.55)*Math.PI)*-.15:T.MathUtils.lerp(body.rotation.y,0,1-Math.exp(-10*dt));
body.rotation.z=combat.hitAnim>0?Math.sin((1-combat.hitAnim/.35)*Math.PI)*.12:T.MathUtils.lerp(body.rotation.z,0,1-Math.exp(-12*dt));
body.position.y=0;groundFeet(avatar,body);cape.update(dt,pose?.blend||0);merchantAnimator.update(dt);
for(const other of remotePlayers.values()){
 const before=other.root.position.clone();
 if(window.eldervaleAuthority&&other.motion){const sample=other.motion.sample();if(sample){other.root.position.x=sample.x;other.root.position.z=sample.z;other.root.rotation.y=sample.yaw}}else other.root.position.lerp(other.target,1-Math.exp(-12*dt));other.root.position.y=landscape.walkHeight(other.root.position.x,other.root.position.z)+jumpHeight(other.jumpAt,window.eldervaleServerTime?.()||Date.now());
 const delta=Math.atan2(Math.sin(other.yaw-other.root.rotation.y),Math.cos(other.yaw-other.root.rotation.y));
 other.root.rotation.y+=delta*(1-Math.exp(-12*dt));
 const distance=before.distanceTo(other.root.position);
 other.attackAnim=Math.max(0,(other.attackAnim||0)-dt);other.blockAnim=Math.max(0,(other.blockAnim||0)-dt);other.animator.update(dt,{locomotion:other.running?'run':other.attackAnim>0||other.blockAnim>0?'combat':'walk',style:other.attackStyle,attack:other.attackAnim,block:other.blockAnim,distance,speed:distance/Math.max(dt,.001)});other.animator.visual.position.y=0;groundFeet(other.animator.rig,other.animator.visual);
}
cameraFocus||=player.position.clone();if(cameraFocus.distanceToSquared(player.position)>100)cameraFocus.copy(player.position);else cameraFocus.lerp(player.position,1-Math.exp(-10*elapsed));const focus=cameraFocus;if((traveled>.002||manual)&&!down&&performance.now()-lastCameraDrag>1800){const behind=player.rotation.y+Math.PI;yaw+=Math.atan2(Math.sin(behind-yaw),Math.cos(behind-yaw))*(1-Math.exp(-3*dt));}stabilizeSun(T,sun,focus);camera.position.set(focus.x+Math.sin(yaw)*zoom*Math.cos(pitch),focus.y+1.75+zoom*Math.sin(pitch),focus.z+Math.cos(yaw)*zoom*Math.cos(pitch));const neededLift=terrainCameraClearance(landscape.heightAt,focus,camera.position,.35);terrainCameraLift=Math.max(neededLift,Math.max(0,terrainCameraLift||0)*Math.exp(-6*elapsed));camera.position.y+=terrainCameraLift;const eye=new T.Vector3(focus.x,focus.y+1.5,focus.z),cameraVector=camera.position.clone().sub(eye),cameraDistance=cameraVector.length();cameraWallRay.set(eye,cameraVector.normalize());cameraWallRay.far=cameraDistance;const walls=[];for(const root of cameraWorldOccluders)if(root.visible&&Math.hypot(root.position.x-player.position.x,root.position.z-player.position.z)<45)root.traverse(o=>{if(o.isMesh&&o.visible&&o.material?.visible!==false&&!o.material?.transparent)walls.push(o)});for(const h of houseInteriors)if(h.group.position.distanceToSquared(player.position)<1600)h.group.traverse(o=>{if(o.isMesh&&o.visible&&o.material?.visible!==false&&!o.material?.transparent)walls.push(o)});const obstruction=cameraWallRay.intersectObjects(walls,false)[0];if(obstruction&&obstruction.distance<cameraDistance)camera.position.copy(eye).addScaledVector(cameraVector,Math.max(.8,obstruction.distance-.3));camera.lookAt(focus.x,focus.y+1.35,focus.z);if(performance.now()-lastAutosave>=4000){lastAutosave=performance.now();save()}for(const animateTown of townAnimations)animateTown(performance.now()*.001);updateHouseRoofs();naturalSky.update(camera,performance.now(),skyHour,skyDaylight);meadow.update(player.position,performance.now());if(Math.floor(performance.now()/500)!==window._forestFrame){window._forestFrame=Math.floor(performance.now()/500);updateNaturalForest(forestBatches,player.position);}renderer.render(scene,camera);hitNumbers.update(elapsed);groundDrops.expire(window.eldervaleServerTime?.()||Date.now());const bars=[];if(realmInCombat)bars.push({id:'self',root:player,hp:combat.hp,maxHp:combat.maxHp});for(const a of [...npcs,...creatures])if(a.serverPose?.target||npcDuelIds?.has(a.realmId)||npcDuelIds?.has(a.profile?.worldEntityId)){bars.push({id:a.realmId||a.profile?.worldEntityId,root:a.root,hp:a.serverPose?.hp??a.hp,maxHp:a.serverPose?.data?.hp||a.maxHp||45,height:a.config?.species==='dragon'?3.8*(a.config.scale||1):3});}for(const [id,a]of remotePlayers)if(combatPlayerIds?.has(id))bars.push({id,root:a.root,hp:a.hp,maxHp:a.maxHp});combatHealth.update(bars);if(pendingPickup&&Math.hypot(player.position.x-pendingPickup.x,player.position.z-pendingPickup.z)<2.6){const id=pendingPickup.id;pendingPickup=null;void window.eldervaleRealm?.command('pickup_drop',{id});}const bankHere=houseInteriors.find(h=>h.type==='bank'&&insideHouse(h,player.position));if(bankHere!==serviceBuilding){serviceBuilding=bankHere;if(bankHere)services.open('bank',bankHere.name)}dialoguePortrait.update(dt,clientSettings.reducedMotion);updateOverheadChat();if(Math.floor(performance.now()/250)!==window._mapFrame){window._mapFrame=Math.floor(performance.now()/250);drawMap(mapCtx,mapCanvas,false);if(mapOpen)drawMap(largeCtx,largeMap,true)}}
drapeRoads();draw();say('Welcome to Eldervale!');frame();

// World editor rendering bridge. Authority and durable writes live in Postgres RPCs.
const worldInstances=new Map();
function removeWorldEntity(id){const entry=worldInstances.get(id);if(!entry)return;const actor=entry.actor;if(combatTurns.target===actor)combatTurns.cancel();if(action&&(action.root===entry.root||actor&&action.mob===actor)){action=null;dest=null;walkQueue=[]}if(actor&&conversation?.profile===actor.profile)closeDialog();
 for(let i=targets.length-1;i>=0;i--)if(targets[i].userData.worldEntityId===id)targets.splice(i,1);
 for(const list of [npcs,creatures]){const i=list.indexOf(actor);if(i>=0)list.splice(i,1)}
 landscape.removeFloor(id);
 if(entry.house){const i=houseInteriors.indexOf(entry.house);if(i>=0)houseInteriors.splice(i,1)}
 cameraWorldOccluders.delete(entry.root);entry.root.removeFromParent();disposeEntityResources(entry.root);realmObjectTargets.delete(id);worldInstances.delete(id);
}
window.eldervaleWorldBridge={
 apply(rows){for(const row of rows){removeWorldEntity(row.id);if(row.deleted)continue;const d=row.data,base=worldTemplates[d.template];if(!base&&d.kind!=='item'){console.warn('Unknown world template',d.template);continue}const config={...base,...d};let root,actor,h;
  if(d.kind==='monster'||d.kind==='npc'&&d.attackable){actor=creature(d.name||base.name,d.x,d.z,!!d.hostile,config);root=actor.root}
  else if(d.kind==='npc'){
   const radius=d.roam||0,profile={...config,worldEntityId:row.id,x:d.x,z:d.z,name:d.name||base.name,color:config.color||0x8d7259,lines:(d.dialogue||base.dialogue).split('\n'),behavior:radius?'patrol':'stationary',patrol:[[d.x-radius,d.z],[d.x,d.z+radius],[d.x+radius,d.z],[d.x,d.z-radius]]};actor=spawnNPC(profile,npcs.length);actor.attackEffect=serviceAttackEffect(T,actor.rig,config.attackType);root=actor.root;
   if(config.weapon&&!root.userData.armed){attachWeapon(actor.rig,makeWeapon(T,config.weapon),config.weapon);root.userData.armed=true}
  }else if(['cottage','bank','inn','forge'].includes(d.template)){
   h=house(d.x,d.z,d.wallColor||0xc7bfa7,1.3*d.scale,d.yaw*Math.PI/180,{type:d.template==='cottage'?(d.room||'cottage'):d.template,name:d.name||base.name,builder:true,stone:!!d.stone,roof:d.roof});h.realmId=row.id;root=h.group;landscape.registerFloor(row.id,{x:root.position.x,z:root.position.z,scaleX:root.scale.x,scaleZ:root.scale.z,rotation:root.rotation.y,floorHeight:.125*root.scale.y});
  }else{root=new T.Group();scene.add(root);root.position.set(d.x,landscape.walkHeight(d.x,d.z),d.z);
   if(d.kind==='item'){const item=goods[d.item];if(!item){root.removeFromParent();continue}if(d.item.startsWith('weapon:'))root.add(makeWeapon(T,item.key));else objectModel(T,root,'chest');root.position.y+=.4}
   else if(d.template==='plaza'){const mesh=new T.Mesh(new T.CircleGeometry(8,48),material(0xa39d8b,'masonry'));mesh.rotation.x=-Math.PI/2;mesh.receiveShadow=true;root.add(mesh);root.userData.surface=true;}else if(d.template.startsWith('terrain_')||d.template==='road'){const color={terrain_grass:0x6b8557,terrain_sand:0xb6a270,terrain_stone:0x8b8b81,terrain_snow:0xd8e0db,road:0x9c8964}[d.template];const geometry=d.template==='road'?new T.PlaneGeometry(d.width||2.5,d.length||10,8,24):new T.RingGeometry(0,d.radius||10,40,10);geometry.rotateX(-Math.PI/2);for(let i=0;i<geometry.attributes.uv.count;i++)geometry.attributes.uv.setXY(i,geometry.attributes.position.getX(i)/3,geometry.attributes.position.getZ(i)/3);const mesh=new T.Mesh(geometry,material(color,d.template==='terrain_grass'?'grass':d.template==='terrain_stone'?'stone':'dirt'));mesh.receiveShadow=true;root.add(mesh);root.userData.surface=true;}else objectModel(T,root,d.template,d);
   const hit=new T.Mesh(new T.BoxGeometry(d.template==='castle_gate'?9:1.3,d.template==='castle_gate'?7:2,1.3),new T.MeshBasicMaterial({visible:false}));hit.position.y=d.template==='castle_gate'?3.5:1;root.add(hit);hit.userData={kind:d.kind==='item'?'worldItem':d.template==='fishing_spot'?'fishing':d.template==='castle_gate'?'castleGate':d.template==='altar'?'altar':d.template==='hearth'?'hearth':d.template==='market'?'merchant':d.template==='tree'||d.template==='pine'?'tree':d.template==='rock'?'rock':'worldObject',x:d.x,z:d.z};targets.push(hit);
  }
  if(['castle_wall','castle_tower','castle_gate'].includes(d.template))cameraWorldOccluders.add(root);if(actor)actor.realmId=row.id;if(!h)root.scale.multiplyScalar(d.scale||1);if(actor?.config)root.scale.setScalar(d.scale||1);root.rotation.y=d.yaw*Math.PI/180;root.traverse(o=>{if(targets.includes(o))o.userData.worldEntityId=row.id});root.userData.waterSource=d.template==='fountain';root.userData.lamp=d.template==='lantern';if(root.userData.surface)conformSurface(root);worldInstances.set(row.id,{root,actor,house:h});
 }},
 position:()=>({x:player.position.x,z:player.position.z,yaw:player.rotation.y*180/Math.PI}),
 teleport(x,z){if(window.eldervaleAuthority){say('Use the owner Teleport command.');return}combatTurns.cancel();dest=null;walkQueue=[];action=null;player.position.set(x,landscape.walkHeight(x,z),z);save()},
 preview(id){if(window.eldervaleAuthority){void window.eldervaleRealm?.command('preview',{target:id});return}const a=worldInstances.get(id)?.actor;if(a){a.previewAttack=.55;a.attackAnim=.55;say('Preview: '+(a.profile?.attackType||a.config?.attackType||'melee'))}},
 highlight(id){const e=worldInstances.get(id);if(e)markClick(e.root.position.x,e.root.position.z,'interact')},
 grant(delivery){if(window.eldervaleAuthority){void window.eldervaleRealm?.refresh();return}const receipts=state.worldReceipts;if(receipts.includes(delivery.id))return;
 const d=delivery.data;if(d.command==='teleport')this.teleport(Number(d.x),Number(d.z));else{const n=Math.max(1,Math.min(1000000,Math.floor(Number(d.amount)||1)));if(d.item==='gold')state.gold=Math.min(1e9,state.gold+n);else if(goods[d.item])state.bank[d.item]=goods[d.item].field?1:Math.min(1e9,(state.bank[d.item]||0)+n);else throw Error('Unknown delivered item');say('Owner delivery received'+(d.item==='gold'?'': ' in your bank')+'.')}
 receipts.push(delivery.id);state.worldReceipts=receipts;save();draw();
 },notice:text=>say(text),capture:()=>{captureSave();return JSON.parse(localStorage.getItem('eldervale-save'))}
};

// Stream persistent scenery/actors around the player rather than rendering the entire saved world.
const persistentRows=new Map(),applyNearby=window.eldervaleWorldBridge.apply;let regionTicket=null,regionResume=null;
const regionStreamer=createRegionStreamer({rows:persistentRows,loaded:worldInstances,position:()=>player.position,
 apply:row=>{applyNearby([row]);const entry=worldInstances.get(row.id);if(entry?.house)entry.root.visible=entry.root.position.distanceToSquared(player.position)<155*155;const target=targets.find(t=>t.userData.worldEntityId===row.id);if(target)realmObjectTargets.set(row.id,target);const pose=realmActorCache.get(row.id);if(pose)applyRealmActor(pose);const object=realmObjectState.get(row.id);if(object)applyRealmObject(object);},
 remove:removeWorldEntity,canRemove:id=>{const e=worldInstances.get(id);return !e||!e.actor||combatTurns.target!==e.actor&&(!conversation||conversation.profile!==e.actor.profile)},
 onProgress:({pending,done,total,error})=>{if(pending){if(!regionTicket){regionTicket=areaLoading.begin('Loading nearby area…');regionResume=!realmInCombat&&!routePending&&mapDestination?{goal:mapDestination.clone(),generation:navigationGeneration}:null;if(regionResume)void window.eldervaleRealm?.command('stop');}regionTicket.progress(done,total,'Preparing buildings, scenery and residents…');}else if(regionTicket&&!error){regionTicket.end();regionTicket=null;const resume=regionResume;regionResume=null;if(resume&&resume.generation===navigationGeneration&&!routePending)void setWalkDestination(resume.goal);}},
 onError:error=>{console.warn('Area loading:',error);regionTicket?.fail('This area could not be loaded. Reload to reconnect.',()=>location.reload());}
});window.eldervaleRegionStreamer=regionStreamer;
window.eldervaleWorldBridge.apply=rows=>regionStreamer.upsert(rows);
setInterval(()=>void regionStreamer.scan().catch(()=>{}),1200);

var realmPlayerPose=null,realmInCombat=false,lastMovementAck=0,manualPredictionUntil=0;var playerMotion=createMotionTrack(),realmFrameTime=0;var cameraFocus=null;var terrainCameraLift=0;var attackStyle='slash';
function interpolateRealm(actor,dt){if(actor.motion){const sample=actor.motion.sample();if(sample){actor.root.position.x=sample.x;actor.root.position.z=sample.z;actor.root.rotation.y=sample.yaw;}return}if(!actor.serverPose)return;const target=new T.Vector3(actor.serverPose.x,actor.root.position.y,actor.serverPose.z);if(actor.root.position.distanceToSquared(target)>100)actor.root.position.copy(target);else actor.root.position.lerp(target,1-Math.exp(-14*dt));actor.root.rotation.y=actor.serverPose.yaw;}
const realmActorCache=new Map(),realmObjectState=new Map(),realmObjectTargets=new Map(),realmMerchant={root:merchant,profile:{level:5,hp:45,maxHp:45}};
const baseRealmId=(kind,x,z)=>'base:'+kind+':'+Number(x).toFixed(1)+':'+Number(z).toFixed(1);
creatures.forEach((m,i)=>m.realmId='base:creature:'+i);
houseInteriors.forEach((h,i)=>h.realmId='base:door:'+i);
for(const target of targets){const a=target.userData;if(['tree','rock','chest','merchant'].includes(a.kind)&&(!generatedWorld||!['chest','merchant'].includes(a.kind)))a.realmId=baseRealmId(a.kind,a.x,a.z);else if(a.kind==='door')a.realmId=a.house.realmId;else if(a.kind==='npc')a.realmId=a.profile.realmId;else if(a.kind==='creature')a.realmId=a.mob.realmId;if(a.realmId)realmObjectTargets.set(a.realmId,target);}
function realmActor(id){if(id==='base:merchant:-3.0:7.0')return realmMerchant;const custom=worldInstances.get(id)?.actor;return custom||creatures.find(a=>a.realmId===id)||npcs.find(a=>a.realmId===id)}
function applyRealmActor(row){let actor=realmActor(row.id);if(!actor&&row.id.startsWith('base:npc:')){const p=extraResidents.find(p=>'base:npc:'+p.name===row.id);if(p){actor=spawnNPC({...p,realmId:row.id},npcs.length);spawnedResidents.add(extraResidents.indexOf(p))}}if(!actor)return;actor.serverPose=row;actor.motion||=createMotionTrack();actor.motion.push(realmFrameTime,{x:row.x,z:row.z,yaw:row.yaw,moving:!!row.target});actor.root.visible=row.hp>0;actor.alive=row.hp>0;if(actor.config){actor.hp=row.hp;actor.maxHp=row.data.hp;actor.config={...actor.config,...row.data}}if(actor.profile){actor.profile.level=row.data.level;actor.profile.hp=row.hp;actor.profile.maxHp=row.data.hp;}return actor;}
function applyRealmObject(object){const gate=worldInstances.get(object.id)?.root;if(gate?.userData.leftGate){gate.userData.gateOpen=object.open;gate.userData.leftGate.rotation.y=object.open?-Math.PI*.48:0;gate.userData.rightGate.rotation.y=object.open?Math.PI*.48:0;}const custom=worldInstances.get(object.id),house=custom?.house||houseInteriors.find(h=>h.realmId===object.id);if(house){house.open=object.open;house.doorPivot.rotation.y=house.open?-Math.PI*.53:0;}const t=realmObjectTargets.get(object.id);if(t)t.userData.availableAt=object.available_at;}
window.eldervaleRealmBridge={
 snapshot(data,selfId){lastMovementAck=performance.now();localJumpAt=data.motion.jump_at;groundDrops.sync(data.groundDrops||[]);tradePanel.sync(data.trade);npcDuelIds=new Set((data.npcDuels||[]).flatMap(d=>[d.guard,d.monster]));combatPlayerIds=new Set((data.actors||[]).map(a=>a.target).filter(Boolean));realmFrameTime=Date.parse(data.stateTime||data.time);attackStyle=data.motion.attack_style||'slash';
  for(const [id,g]of Object.entries(goods))if(g.custom)state[id]=Number(data.self.stats?.[id])||0;const savedRow=fromPlayerRow(data.self);for(const k of ['gold','wood','ore','fishingPole','bait','rawFish','woodXP','miningXP','armorOwned','weaponsOwned','shieldsOwned','jewelryOwned','bank','attackXP','strengthXP','defenceXP','hitpointsXP','rangedXP','magicXP','prayerXP','firemakingXP','fishingXP','cookingXP','smithingXP','craftingXP','herbloreXP','farmingXP','agilityXP','thievingXP','amulet','trinket','starterChestClaimed','starterShieldsGranted','starterBattleaxeGranted','starterDaggerGranted','starterJewelryGranted'])if(savedRow[k]!==undefined)state[k]=savedRow[k];
  const signature=JSON.stringify([state.equipped,state.equippedWeapon,state.equippedShield]),incoming=JSON.stringify([savedRow.equipped,savedRow.equippedWeapon,savedRow.equippedShield]);state.equipped=savedRow.equipped;state.equippedWeapon=savedRow.equippedWeapon;state.equippedShield=savedRow.equippedShield;combat.hp=data.self.health;combat.maxHp=data.self.max_health;combat.xp=data.self.xp;combat.kills=savedRow.kills;state.runEnergy=data.motion.energy;running=data.motion.run;
  if(signature!==incoming){refreshArmor();refreshWeapon();refreshShield()}playerMotion.push(realmFrameTime,{x:data.motion.x,z:data.motion.z,yaw:data.motion.yaw,moving:data.motion.path.length>0});realmPlayerPose={x:data.motion.x,z:data.motion.z,yaw:data.motion.yaw,moving:data.motion.path.length>0};if(!realmPlayerPose.moving){dest=null;walkQueue=[];mapDestination=null;}
  realmInCombat=false;for(const id of data.removedActors||[]){const a=realmActor(id);if(a){a.root.visible=false;a.deleted=true;}}for(const row of data.actors){const a=realmActor(row.id);if(a)a.deleted=false;realmActorCache.set(row.id,row);applyRealmActor(row);if(row.target===selfId)realmInCombat=true;}
  window.eldervaleUpdatePlayers(data.players);for(const entry of data.players){const other=remotePlayers.get(entry.id);if(other){other.hp=entry.hp;other.maxHp=entry.maxHp;other.jumpAt=entry.jumpAt}}
  for(const object of [...data.objects,...(data.gates||[])]){realmObjectState.set(object.id,object);applyRealmObject(object);}
  window.eldervaleShops=data.shops||{};captureSave();draw();services.refresh?.();
 },
 event(e,selfId){if(e.type==='npc_windup'){const a=realmActor(e.attacker),b=realmActor(e.target);if(a){a.attackAnim=.55;a.previewAttack=.55;}if(b)b.blockAnim=.75;return}if(e.type==='npc_hit'){const a=realmActor(e.target);if(a){hitNumbers.show(a.root,e.damage,e.blocked,3);if(a.root.position.distanceTo(player.position)<20)combatSound(e.blocked?'metal':'impact');}return}const actor=realmActor(e.target),root=actor?.root,isSelf=e.player===selfId,other=remotePlayers.get(e.player);if(e.type==='fishing'){const target=isSelf?player:other?.root;if(target){const rod=new T.Mesh(new T.CylinderGeometry(.018,.035,2.5,7),new T.MeshStandardMaterial({color:0x9a7950}));rod.position.set(-.5,1.8,.8);rod.rotation.x=.6;target.add(rod);setTimeout(()=>{target.remove(rod);rod.geometry.dispose();rod.material.dispose()},1500)}if(isSelf)say('You catch a fish. +25 Fishing XP');return}if(e.type==='preview'){if(actor){actor.attackAnim=.55;actor.previewAttack=.55;}return}if(e.type==='windup'){if(isSelf&&e.side==='player')combatSound(e.style||'slash');if(e.style&&isSelf)attackStyle=e.style;if(e.side==='player'){if(isSelf){combat.attackAnim=.55;combat.blockAnim=0;faceTarget(player,root?.position||player.position)}else if(other){other.attackAnim=.55;other.attackStyle=e.style||'slash';}if(actor)actor.blockAnim=1.1;}else{if(actor){actor.attackAnim=.55;actor.previewAttack=.55;}if(isSelf){combat.attackAnim=0;combat.blockAnim=1.15;}else if(other)other.blockAnim=1.15;}}
  else if(e.type==='hit'){const target=e.side==='player'?root:isSelf?player:other?.root;if(target)hitNumbers.show(target,e.damage,e.blocked,e.side==='player'?1.8:2.8);if(isSelf)combatSound(e.blocked?'metal':'impact');if(actor&&e.side==='player'){actor.hitAnim=e.blocked?0:.3;actor.blockAnim=e.blocked?.65:0;}}
  else if(e.type==='interaction'&&isSelf){const a=targets.find(t=>(t.userData.realmId||t.userData.worldEntityId||t.userData.profile?.realmId)===e.target)?.userData;if(a?.kind==='npc')talkTo(a.profile);else if(a?.kind==='merchant')services.open('shop','Market',e.target);else if(a?.kind==='altar'||a?.kind==='hearth')void window.eldervaleRealm.command(a.kind==='altar'?'pray':'cook',{target:e.target});else if(a?.kind==='fishing')void window.eldervaleRealm.command('fish',{target:e.target});action=null;}
  else if(e.type==='door'){const h=worldInstances.get(e.target)?.house||houseInteriors.find(h=>h.realmId===e.target);if(h){h.open=e.open;h.doorPivot.rotation.y=e.open?-Math.PI*.53:0;if(isSelf&&h.type==='bank'&&!navigationAfterDoor)services.open('bank',h.name)}action=null;if(isSelf&&navigationAfterDoor){const goal=navigationAfterDoor;navigationAfterDoor=null;setWalkDestination(goal);}}
  else if(e.type==='notice'&&isSelf)say(e.text);else if(e.type==='death'&&isSelf){say('Defeated '+(actor?.name||'opponent')+'.');action=null;}else if(e.type==='gather'&&isSelf){say('Resource gathered. +25 XP');action=null;}else if(e.type==='player_death'&&isSelf){say('You fell in battle and returned to Oakcross.');action=null;}
 }
};

const terrainBaseline=landscape.heights.slice(),terrainRows=new Map(),anchorHeights=new WeakMap(),instanceBase=new WeakMap();
function conformSurface(root){root.updateMatrixWorld(true);root.traverse(mesh=>{if(!mesh.isMesh||!mesh.visible||mesh.material?.visible===false||!mesh.geometry)return;const p=mesh.geometry.attributes.position;for(let i=0;i<p.count;i++){const point=mesh.localToWorld(new T.Vector3(p.getX(i),0,p.getZ(i)));point.y=landscape.heightAt(point.x,point.z)+.065;mesh.worldToLocal(point);p.setY(i,point.y)}p.needsUpdate=true;mesh.geometry.computeVertexNormals()});}
function rebuildTerrain(){
 for(const o of scene.children)if(!o.isLight&&!o.isInstancedMesh&&!o.userData.terrainFixed&&o!==player&&!anchorHeights.has(o))anchorHeights.set(o,o.position.y-landscape.heightAt(o.position.x,o.position.z));
 for(const batch of [...forestBatches,tufts])if(!instanceBase.has(batch)){const values=[];for(let i=0;i<batch.count;i++){const m=new T.Matrix4();batch.getMatrixAt(i,m);values.push({matrix:m,ground:landscape.heightAt(m.elements[12],m.elements[14])})}instanceBase.set(batch,values)}
 sculptPatches(landscape,terrainBaseline,[...terrainRows.values()].filter(r=>!r.deleted).sort((a,b)=>a.id.localeCompare(b.id)).map(r=>r.data));ground.geometry.dispose();ground.geometry=landscapeGeometry(T,landscape);meadow.invalidate();drapeRoads();
 for(const o of scene.children)if(anchorHeights.has(o)&&!o.userData.surface)o.position.y=landscape.heightAt(o.position.x,o.position.z)+anchorHeights.get(o);
 for(const batch of [...forestBatches,tufts]){const values=instanceBase.get(batch);for(let i=0;i<batch.count;i++){const {matrix,ground:height}=values[i],m=matrix.clone();m.elements[13]+=landscape.heightAt(m.elements[12],m.elements[14])-height;batch.setMatrixAt(i,m)}batch.instanceMatrix.needsUpdate=true;batch.computeBoundingSphere()}
 for(const entry of worldInstances.values())if(entry.root.userData.surface)conformSurface(entry.root);
}
const applyTerrainRender=window.eldervaleWorldBridge.apply;window.eldervaleWorldBridge.apply=async rows=>{let changed=false;for(const row of rows)if(row.data.template?.startsWith('terrain_')){terrainRows.set(row.id,row);changed=true}if(changed){const ticket=areaLoading.begin('Updating the landscape…');try{await runFrameWork((function*(){yield;rebuildTerrain();})());}finally{ticket.end();}}await applyTerrainRender(rows);};
const lanternPool=Array.from({length:4},()=>{const light=new T.PointLight(0xffce8a,0,24,1.5);scene.add(light);return light});let nextLampUpdate=0;
townAnimations.push(()=>{if(performance.now()<nextLampUpdate)return;nextLampUpdate=performance.now()+400;const fixtures=scene.children.filter(o=>o.userData.lamp&&o.position.distanceToSquared(player.position)<55*55).sort((a,b)=>a.position.distanceToSquared(player.position)-b.position.distanceToSquared(player.position));lanternPool.forEach((light,i)=>{const fixture=fixtures[i];light.intensity=fixture?(window.eldervaleWorldNight?6:1):0;if(fixture)light.position.copy(fixture.position).add(new T.Vector3(.4,3,0))})});

if(!generatedWorld){const fishingMarker=new T.Group();fishingMarker.position.set(-70,landscape.walkHeight(-70,80),80);scene.add(fishingMarker);objectModel(T,fishingMarker,'fishing_spot');const fishingHit=new T.Mesh(new T.CylinderGeometry(.8,.8,1.6,10),new T.MeshBasicMaterial({visible:false}));fishingHit.position.y=.8;fishingMarker.add(fishingHit);fishingHit.userData={kind:'fishing',x:-70,z:80,realmId:'base:fishing:moonmere'};targets.push(fishingHit);realmObjectTargets.set('base:fishing:moonmere',fishingHit);}

function groundFeet(rig,visual){visual.updateWorldMatrix(true,true);let lift=0;for(const ankle of [rig.leftAnkle,rig.rightAnkle])ankle?.traverse(m=>{if(!m.isMesh||!m.visible||m.material?.visible===false)return;if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();const box=m.geometry.boundingBox.clone().applyMatrix4(m.matrixWorld);const x=(box.min.x+box.max.x)/2,z=(box.min.z+box.max.z)/2;lift=Math.max(lift,landscape.walkHeight(x,z)+.012-box.min.y)});visual.position.y+=Math.min(.3,Math.max(0,lift));}

window.eldervaleGetWaterSoundProximity=()=>Math.max(0,...scene.children.filter(o=>o.userData.waterSource).map(o=>Math.max(0,1-Math.hypot(player.position.x-o.position.x,player.position.z-o.position.z)/9)));

// The moat surrounds the playable castle plateau. The shared bridge is the only crossing.
for(const [dx,dz,w,l] of [[0,-58.5,126,9],[0,58.5,126,9],[-58.5,0,9,108],[58.5,0,9,108]]){const m=new T.Mesh(new T.PlaneGeometry(w,l),new T.MeshStandardMaterial({map:texture('water',0x577f83),color:0x84a9aa,roughness:.32,metalness:.2}));m.rotation.x=-Math.PI/2;m.position.set(castle.x+dx,.035,castle.z+dz);m.userData.terrainFixed=true;scene.add(m)}

window.eldervaleCastleCollision=(x,z)=>{for(const row of persistentRows.values()){const d=row.data;if(row.deleted||!['castle_wall','castle_tower','castle_gate'].includes(d.template))continue;const a=d.yaw*Math.PI/180,s=d.scale||1,dx=x-d.x,dz=z-d.z,tx=(dx*Math.cos(a)-dz*Math.sin(a))/s,tz=(dx*Math.sin(a)+dz*Math.cos(a))/s;if(d.template==='castle_tower'){if(tx*tx+tz*tz<25)return true;}else if(Math.abs(tz)<(d.template==='castle_gate'?2.1:1.6)&&Math.abs(tx)<(d.length||24)/2+.3){if(d.template!=='castle_gate'||Math.abs(tx)>4.1||!worldInstances.get(row.id)?.root.userData.gateOpen)return true;}}return false;};

window.eldervaleRemovedActors=ids=>{for(const id of ids){const a=realmActor(id);if(a){a.deleted=true;a.root.visible=false;}}};

let propCollisionIndex=null;
window.eldervalePropCollision=(x,z)=>{if(!propCollisionIndex){const data=generatedWorld?[]:[...fixedObstacles];for(const row of persistentRows.values())if(!row.deleted&&row.data.kind==='object')data.push(row.data);for(const [id,t]of realmObjectTargets)if(id.startsWith('base:')&&['tree','rock'].includes(t.userData.kind))data.push({template:t.userData.kind,x:t.userData.x,z:t.userData.z});propCollisionIndex=createObstacleIndex(data);}return propCollisionIndex.blocked(x,z);};
const applyNavigationWorld=window.eldervaleWorldBridge.apply;window.eldervaleWorldBridge.apply=async rows=>{await applyNavigationWorld(rows);if(rows.length){propCollisionIndex=null;meadow.invalidate();}};


window.eldervaleMapItems=()=>persistentRows.values();

installFantasyHUD();
