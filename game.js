import {capital,capitalActive,capitalMapWalls,inCapitalClearing,isCapitalTown,townExtent,inwardNormal} from './capital-layout.js?v=release-20261106-fix99';
import {campClearing} from './camp-blueprint.js?v=release-20261106-fix99';
import {createLevelUpPanel} from './level-up.js?v=release-20261106-fix99';
import {addBuildingStories,buildingLocal,stairPosition,storyOffset,validStoryPosition} from './building-stories.js?v=release-20261106-fix99';
import {createQuestJournal} from './quests.js?v=release-20261106-fix99';
import {createTutorial} from './tutorial.js?v=release-20261106-fix99';
import {createBuildingSigns,defaultSignposts} from './building-signs.js?v=release-20261106-fix99';
import {createQuestMarkers} from './quest-markers.js?v=release-20261106-fix99';
import {createQuestTracker} from './quest-tracker.js?v=release-20261106-fix99';
import {createQuestTrail,mountGuidanceSettings} from './quest-trail.js?v=release-20261106-fix99';
import {createQuestCutscenes} from './quest-cutscenes.js?v=release-20261106-fix99';
import {npcLinesFor} from './quest-v2.js?v=release-20261106-fix99';
import {createNpcDialogue,converse} from './npc-dialogue.js?v=release-20261106-fix99';
import {panelStateKey} from './panel-state.js?v=release-20261106-fix99';
import {obstructionDistance,collectCameraOccluders} from './camera-obstruction.js?v=release-20261106-fix99';
import {slideStep,locomotionDistance,movementTime} from './movement-collision.js?v=release-20261106-fix99';
import {createWildlife} from './wildlife.js?v=release-20261106-fix99';
import {createProfessionVisuals} from './profession-visuals.js?v=release-20261106-fix99';
import {makeDroppedItemModel} from './item-models.js?v=release-20261106-fix99';
import {createProfessionPanel} from './professions.js?v=release-20261106-fix99';
import {professionSkills,professionItems,professionStations} from './profession-data.js?v=release-20261106-fix99';
import {mountCatalog,mountAllowed,mountSpeed} from './mounts.js?v=release-20261106-fix99';
import {createHorseMount} from './horse-mount.js?v=release-20261106-fix99';
import {playHorseHoof,playLevelUpJingle,soundEffects,duckMusic} from './music.js?v=release-20261106-fix99';
import {createLevelFireworks} from './level-fireworks.js?v=release-20261106-fix99';
import {jingleFor} from './level-up.js?v=release-20261106-fix99';
import {townMusic,waterProximity} from './audio-regions.js?v=release-20261106-fix99';
import {createGatheringVisuals} from './gathering-visuals.js?v=release-20261106-fix99';
import {createGroundDressing} from './environment-detail.js?v=release-20261106-fix99';
import {createWaterSystem} from './water-rendering.js?v=release-20261106-fix99';
import {fishingDock} from './waterfront.js?v=release-20261106-fix99';
import {createSurfaceCoverIndex,isBuilding as isWalkInBuilding,buildingPlot as walkInPlot,coversSurface,onBridge,pavedGeometry,drapedGeometry} from './world-surfaces.js?v=release-20261106-fix99';
import {isFoundationStructure,structurePlot,propBase} from './foundation.js?v=release-20261106-fix99';
import {batchStaticMeshes,createCellBatcher,BATCHED_LAYER} from './static-batch.js?v=release-20261106-fix99';
// Walk-in buildings and freestanding structures (farm huts, stalls, wells...)
// both get a levelled terrain pad; only buildings register a walkable floor.
const isBuilding=d=>isWalkInBuilding(d)||isFoundationStructure(d),buildingPlot=d=>isWalkInBuilding(d)?walkInPlot(d):structurePlot(d);
import {installFantasyHUD} from './hud-redesign.js?v=release-20261106-fix99';
import {installWorldHoverCursor} from './cursors.js?v=release-20261106-fix99';
import {installMMOControls,jumpHeight,isAirborne,CAMERA_TURN_RATE,CAMERA_PITCH_RATE} from './mmorpg-controls.js?v=release-20261106-fix99';
import {configureBiomeTerrain,createNaturalSky,createMeadow} from './natural-environment.js?v=release-20261106-fix99';
import {buildNaturalForest,updateNaturalForest,setForestTreeVisible} from './natural-forest.js?v=release-20261106-fix99';
import {generatedWorld,generatedTreePoints,biomeColor} from './procedural-world.js?v=release-20261106-fix99';
import {runFrameWork,nextTask,createLoadingPanel} from './frame-work.js?v=release-20261106-fix99';import {trackLoadingManager} from './loading-indicator.js?v=release-20261106-fix99';import {installLongPressMenus,fitToViewport} from './touch-menus.js?v=release-20261106-fix99';installLongPressMenus();trackLoadingManager(T.DefaultLoadingManager);
import {createRegionStreamer} from './region-streamer.js?v=release-20261106-fix99';
import {searchRoute} from './route-search.js?v=release-20261106-fix99';
import {disposeEntityResources} from './entity-resources.js?v=release-20261106-fix99';
import {actorMenuLabel} from './context-label.js?v=release-20261106-fix99';
import {fixedObstacles,obstacleBlocks,createObstacleIndex} from './navigation-obstacles.js?v=release-20261106-fix99';
import {createTradePanel,requestDrop} from './player-trading.js?v=release-20261106-fix99';
import {createGroundDrops} from './ground-drops.js?v=release-20261106-fix99';
import {createCombatHealth} from './combat-health.js?v=release-20261106-fix99';
import {terrainCameraClearance} from './camera-clearance.js?v=release-20261106-fix99';
import {castle,inCastle} from './castle-layout.js?v=release-20261106-fix99';
import {createMotionTrack,reconcileLocalPose,reconcileActivePose,serverMotionJump,projectPathPose,presentPose} from './motion-track.js?v=release-20261106-fix99';
import {lightingAt} from './world-lighting.js?v=release-20261106-fix99';
import {sculptPatches} from './terrain-patches.js?v=release-20261106-fix99';
import {fromPlayerRow} from './player-save.js?v=release-20261106-fix99';
import {combatLevel,skillLevel,crossedSwords,xpProgress,hitpointsLevel,formatXp} from './combat-level.js?v=release-20261106-fix99';
import {EAT_DELAY,EAT_ANIMATION,isFood,fishingMethods} from './food.js?v=release-20261106-fix99';
import {createXpDrops} from './xp-drops.js?v=release-20261106-fix99';
import {worldTemplates} from './world-templates.js?v=release-20261106-fix99';
import {actorModel,objectModel,serviceAttackEffect} from './world-models.js?v=release-20261106-fix99';
import {createCombatTurns,WALK_SPEED,SPRINT_SPEED} from './combat-turns.js?v=release-20261106-fix99';
import {armorCatalog,weaponStats,meleeProtection,meleeRoll,equipRefusal,gearDetails,equipmentBonuses,playerLevels} from './melee-stats.js?v=release-20261106-fix99';
import {renderEquipmentStats,installGearTooltip} from './equipment-stats.js?v=release-20261106-fix99';
import {styleLabels,playerAttackProfile,rollPlayerHit,rollMonsterHit} from './gear-tiers.js?v=release-20261106-fix99';
import {OUTFIT_SLOTS,SLOT_LABELS} from './outfits.js?v=release-20261106-fix99';
import {regionDefinitions,biomeWeights} from './procedural-world.js?v=release-20261106-fix99';import {createWorldMap,poiKind,regionAnchors,drawSkullIcon,drawCityWalls} from './world-map.js?v=release-20261106-fix99';
const ARMOR_SLOTS=[...OUTFIT_SLOTS,'cape'];
import {stepEnergy,footIcon} from './run-energy.js?v=release-20261106-fix99';
import {createMechanicsHud} from './mechanics-hud.js?v=release-20261106-fix99';
import {resolveHit,createHitNumbers} from './combat-effects.js?v=release-20261106-fix99';
import {goods,sanitizeBank,inventoryUsed,createServicePanel,INVENTORY_SLOTS,quantity,serviceOutOfReach} from './economy.js?v=release-20261106-fix99';
import {jewelryCatalog,jewelryBonus,gatheringXP} from './jewelry.js?v=release-20261106-fix99';
import {mapPoint,worldToMinimap,minimapRotation,cameraHeading,compassRotation,nearestYaw,stepYaw,LOOK_YAW} from './minimap.js?v=release-20261106-fix99';
import {npcService,npcDisplayName,npcMenuOptions,npcDialogueChoices,npcGreeting,dialogueLines} from './npc-options.js?v=release-20261106-fix99';
import {heldOpen,heldOpenExamine} from './business-doors.js?v=release-20261106-fix99';
import {isTap,dragThreshold,mapClickToWorld,flagExpired,showClickCross,drawMapFlag,approachPoint,withinReach,arrivalStatus,actorsFirst,withWalkHere,followGoal,TILE,GAME_TICK,REDIRECT_PAUSE_MS,trimPassedWaypoints} from './click-walk.js?v=release-20261106-fix99';
import {townResidents,animateTownActivity,createWorkKit,carriesWeapon,workFacing} from './town-life.js?v=release-20261106-fix99';
import {surfaceTexture,scaleSurfaceUV} from './surface-textures.js?v=release-20261106-fix99';
import {attachWeapon,attachShield} from './equipment-pose.js?v=release-20261106-fix99';
import {createPlayerHUD} from './player-hud.js?v=release-20261106-fix99';
import {oakcrossBuildings,decorateTownBuilding} from './town.js?v=release-20261106-fix99';
import {detailBuilding,buildingStyle,ridgeAlignedUV} from './building-detail.js?v=release-20261106-fix99';
import {stabilizeSun,shadowQuality,celestialLight,installShadowEdgeFade} from './sun-shadow.js?v=release-20261106-fix99';
import {createDialoguePortrait} from './dialogue-portrait.js?v=release-20261106-fix99';
import {addSystemMessage,renderFeed} from './chat-feed.js?v=release-20261106-fix99';
import {deviceProfile,effectiveGraphics,installResponsiveLayout,installTouchGestures,bindGameViewport} from './responsive.js?v=release-20261106-fix99';
import {isTablet,isPhone,lowerTier,createFrameGovernor,createDistanceCuller,characterLod,lodStep,holdGait,HIDDEN_LAYER} from './graphics-quality.js?v=release-20261106-fix99';
import * as T from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import {preloadCharacters,setCharacterRim} from './character-assets.js?v=release-20261106-fix99';
import {buildHumanoid} from './humanoid.js?v=release-20261106-fix99';
import {arrangeEquipmentDoll,loadStance,saveStance,stanceToggle} from './equipment-doll.js?v=release-20261106-fix99';
import {createHumanoidAnimator} from './animation.js?v=release-20261106-fix99';
import {worldRoads,roadPoints,lakeOutline,ribbonGeometry,landscapeLakes,worldRivers,landscapeSettlements,distanceToRoad} from './geography.js?v=release-20261106-fix99';
import {buildForest} from './forest.js?v=release-20261106-fix99';
import {publicCharacter,buildCharacterDisplay} from './character-display.js?v=release-20261106-fix99';
import {createLandscape,landscapeGeometry,noise} from './landscape.js?v=release-20261106-fix99';
import {governorOptions,leanGraphics} from './graphics-quality.js?v=release-20261106-fix99';
import {warmupList,runShaderWarmup} from './shader-warmup.js?v=release-20261106-fix99';
import {createLightProxies} from './light-proxies.js?v=release-20261106-fix99';
import {createClassicLook,classicEnabled,classicPixelRatio,blobRadius} from './classic-look.js?v=release-20261106-fix99';
const landscape=createLandscape();
import {npcAppearance} from './npc-looks.js?v=release-20261106-fix99';
import {createCape} from './cape.js?v=release-20261106-fix99';
import {weaponCatalog,makeWeapon,iconForWeapon,isTwoHanded,isRanged,isMagic,usesArrows} from './weapons.js?v=release-20261106-fix99';
import {createArrows} from './arrows.js?v=release-20261106-fix99';
import {shieldCatalog,makeShield} from './shields.js?v=release-20261106-fix99';
import {createDeathFlow,renderKeptOnDeath} from './death.js?v=release-20261106-fix99';
import {createTileOverlay} from './tile-overlay.js?v=release-20261106-fix99';
const appearance=(()=>{try{return JSON.parse(localStorage.getItem('eldervale-save')||'{}').appearance||{}}catch{return {}}})();
// RuneScape-style death: input lock and death pose, jingle, kept-items note, death pile on the maps (death.js).
const deathFlow=createDeathFlow({say:text=>say(text),jingle:kind=>playLevelUpJingle(kind),now:()=>window.eldervaleServerTime?.()||Date.now(),goods});
// Character models, outfits and animations must be ready before anyone is built.
await preloadCharacters(T);
const scene=new T.Scene();window.eldervaleTileOverlay=createTileOverlay(T,scene,(x,z)=>landscape.walkHeight(x,z));scene.background=new T.Color(0x9dbbc2);scene.fog=new T.Fog(0x9dbbc2,105,255);
const camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.1,450),renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;document.body.prepend(renderer.domElement);bindGameViewport(renderer.domElement,(width,height)=>{camera.aspect=width/height;camera.updateProjectionMatrix();renderer.setSize(width,height,false)});
installShadowEdgeFade(T);const shadowAhead=new T.Vector3();
// Pooled lantern lights (a fixed count per tier, so shaders never recompile at dusk).
const lanternPool=Array.from({length:4},()=>{const light=new T.PointLight(0xffc27a,0,16,2);scene.add(light);return light});
// Prop lights (fires, furnaces, camp lanterns) borrow the pool too (light-proxies.js), so the light count never changes.
const lightProxies=createLightProxies(T,{scene,pool:lanternPool});
const skyLight=new T.HemisphereLight(0xcfe4ff,0x5a4d33,2);scene.add(skyLight);const sun=new T.DirectionalLight(0xffe9b6,2.3);sun.position.set(12,25,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);scene.add(sun.target);renderer.shadowMap.type=T.PCFSoftShadowMap;
Object.assign(sun.shadow.camera,{left:-32,right:32,top:32,bottom:-32,near:.5,far:140});sun.shadow.normalBias=.015;sun.shadow.autoUpdate=false;sun.shadow.bias=-.00008;sun.shadow.camera.updateProjectionMatrix();
const waterSystem=createWaterSystem(T,scene,renderer,landscape);
// Seeded procedural canvas textures, cached and shared across meshes.
const textureCache=new Map();
function texture(kind,base){if(['masonry','wood','roof','plaster','floor','cloth','cobble','thatch'].includes(kind))return surfaceTexture(T,kind,base);const key=kind+base;if(textureCache.has(key))return textureCache.get(key);const canvas=document.createElement('canvas');const groundKind=kind==='grass'||kind==='dirt';const texSize=groundKind?256:128;canvas.width=texSize;canvas.height=texSize;const ctx=canvas.getContext('2d');ctx.fillStyle='#'+base.toString(16).padStart(6,'0');ctx.fillRect(0,0,texSize,texSize);let seed=base>>>0;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
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
const t=new T.CanvasTexture(canvas);t.userData.baseColor=base;t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.anisotropy=groundKind?Math.min(8,renderer.capabilities.getMaxAnisotropy()):4;textureCache.set(key,t);return t}
const materialCache=new Map();function material(c,kind='stone'){const key=c+kind;if(!materialCache.has(key))materialCache.set(key,new T.MeshStandardMaterial({map:texture(kind,c),bumpMap:['masonry','roof','wood','plaster','floor','thatch'].includes(kind)?texture(kind,c):null,bumpScale:kind==='masonry'?.045:.018,roughness:kind==='wood'?.86:.95,color:0xffffff}));materialCache.get(key).userData.eldervaleShared=true;return materialCache.get(key)}const targets=[];
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
 if(inCastle(x,z,9)||capitalActive()&&inCapitalClearing(x,z)||landscape.waterAt(x,z)>.01||distanceToRoad(x,z)<4||landscapeSettlements.some(([sx,sz])=>Math.hypot(x-sx,z-sz)<(sx===0&&sz===0?54:32)))return;
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
let currentInterior={floor:0,building:null};const playerFloorMap={};function floorOffset(floor,x,z){if(!floor)return 0;for(const row of persistentRows.values())if(!row.deleted&&['cottage','bank','inn','forge'].includes(row.data.template)&&validStoryPosition(row.data,x,z,floor))return storyOffset(row.data,floor);return 0}const houseInteriors=[];const mapProps=[];
// A town building is ~25-40 separate boxes (walls, beams, floor, furniture),
// i.e. 25-40 draw calls in the camera pass and again in the shadow pass. Merge
// the plain static ones per material; anything gameplay holds a reference to
// (doors, click targets, roofs hidden indoors, bank stands, story floors) or
// that has its own state (userData, transparency, render hooks) stays separate.
function batchHouse(h){const keep=new Set();for(const v of Object.values(h)){if(v?.isMesh)keep.add(v);else if(Array.isArray(v))for(const m of v)if(m?.isMesh)keep.add(m)}const targetSet=new Set(targets),walkSet=new Set(walkSurfaces);
 const held=m=>keep.has(m)||targetSet.has(m)||walkSet.has(m)||Object.keys(m.userData).length>0||m.material.visible===false||m.material.transparent||m.onBeforeRender!==T.Mesh.prototype.onBeforeRender;
 // Plain furnishings wholly inside the ground-floor room move to their own
 // group: they never cast sun shadows (the walls and roof already shade the
 // room) and are only drawn near the building or from inside (updateHouseInteriors).
 const interior=new T.Group();interior.name='house-interior';const box3=new T.Box3();
 for(const m of [...h.group.children]){if(!m.isMesh||m.isSkinnedMesh||Array.isArray(m.material)||!m.visible||held(m))continue;const g=m.geometry;if(!g.boundingBox)g.computeBoundingBox();m.updateMatrix();box3.copy(g.boundingBox).applyMatrix4(m.matrix);
  if(box3.min.x>=-1.83&&box3.max.x<=1.83&&box3.min.z>=-1.75&&box3.max.z<=1.75&&box3.min.y>=.1&&box3.max.y<=2.95){interior.add(m);m.castShadow=false}}
 if(interior.children.length){h.group.add(interior);h.interior=interior;batchStaticMeshes(T,interior,{deep:false,keep:held})}
 // Roof slabs, fascia, plate and gables only ever toggle together (hidden
 // from inside): merge them per material into one roof group.
 const roof=new T.Group();roof.name='house-roof';const loose=[];for(const part of h.roofParts){if(part.isMesh&&part.parent===h.group&&!targetSet.has(part)&&!Object.keys(part.userData).length)roof.add(part);else loose.push(part)}
 if(roof.children.length){h.group.add(roof);batchStaticMeshes(T,roof,{deep:false});h.roofParts=[roof,...loose];roof.visible=!h.inside}
 batchStaticMeshes(T,h.group,{deep:false,keep:held})}
// Facade and roof detail (building-detail.js LODs) give way sooner on lower tiers.
const BUILDING_LOD_SCALE={low:.55,medium:.7,high:1,ultra:1.25},lodBaseDistances=new WeakMap();
function tuneBuildingLod(root){const k=BUILDING_LOD_SCALE[lodPreset]||1;root.traverse(o=>{if(!o.isLOD)return;let base=lodBaseDistances.get(o);if(!base)lodBaseDistances.set(o,base=o.levels.map(l=>l.distance));o.levels.forEach((l,i)=>l.distance=base[i]*k)})}
// The facade detail LOD (building-detail.js) only swapped a few boxes for a
// glass-only shell. In the town cell batches the full facade merges across
// houses into a handful of draws, cheaper than keeping a separately drawn
// LOD per house, so builder houses keep their near facade (the roof LOD,
// hidden from inside, stays).
function collapseFacadeLod(h){const lods=[];h.group.traverse(o=>{if(o.isLOD&&!h.roofParts.includes(o))lods.push(o)});for(const l of lods){const near=l.levels[0]?.object;if(!near||!l.parent)continue;l.parent.add(near);near.visible=true;l.removeFromParent();for(const level of l.levels.slice(1))level.object.traverse(o=>{if(o.isMesh)o.geometry.dispose()})}}
// Interiors are drawn only from inside or within a tier distance of the house.
const INTERIOR_DISTANCE={low:12,medium:18,high:26,ultra:34};let nextInteriorCheck=0;
function updateHouseInteriors(now){if(now<nextInteriorCheck)return;nextInteriorCheck=now+200;const limit=INTERIOR_DISTANCE[lodPreset]||26;
 for(const h of houseInteriors){if(!h.interior)continue;const show=h.inside||h.group.position.distanceToSquared(camera.position)<limit*limit;if(h.interior.visible!==show)h.interior.visible=show}}
function house(x,z,c,scale=1.65,rotation=0,options={}){
 const sx=scale*(options.width||1),sz=scale*(options.depth||1);
 // One coherent material style per building, from its role and a stable seed.
 const style=buildingStyle({type:options.type||'cottage',x,z,stone:options.stone,biome:options.biome}),wallKind=style.wallKind,roofColor=style.roof;c=style.wall;
 // Keep full building footprints ashore, including existing lakeside hamlets.
 const radius=2.4*Math.hypot(sx,sz);
 const dry=(px,pz)=>[-1,0,1].every(a=>[-1,0,1].every(b=>landscape.waterAt(px+a*radius,pz+b*radius)<=0));
 if(!options.builder&&!dry(x,z)){let found=false;for(let r=2;r<=40&&!found;r+=2)for(let i=0;i<24;i++){const angle=i*Math.PI/12,px=x+Math.cos(angle)*r,pz=z+Math.sin(angle)*r;if(dry(px,pz)){x=px;z=pz;found=true;break}}}
 const group=new T.Group();group.scale.set(sx,scale,sz);group.rotation.y=rotation;
 const plotHeight=options.builder?landscape.heightAt(x,z):landscape.levelBuildingPlot({x,z,scaleX:sx,scaleZ:sz,rotation,floorHeight:.125*scale});
 group.position.set(x,plotHeight,z);group.userData.terrainFixed=true;scene.add(group);
 // Real walk-in room, with a front doorway instead of a solid wall block.
 // Sink a stone plinth into the terrain and overlap the wall bottoms. The
 // exposed lip keeps grass and the nearly coplanar floor underside from
 // competing in the depth buffer as the camera moves. Keep the floor top
 // at .125 so doorway clearance and the existing walk-in room stay aligned.
 // The plinth runs well below grade (top stays at .1): on a plot that a later
 // terrain edit re-slopes, it reads as a stone foundation instead of a gap.
 box(4.18,2.6,3.94,0x777568,0,-1.2,0,group,'stone');
 // A gravel apron separates vegetation from the foundation, with no timber
 // end faces coplanar with the exterior walls.
 const apron=new T.Shape();apron.moveTo(-2.42,-2.22);apron.lineTo(2.42,-2.22);apron.lineTo(2.42,2.22);apron.lineTo(-2.42,2.22);apron.closePath();
 const inner=new T.Path();inner.moveTo(-2.02,-1.93);inner.lineTo(-2.02,1.93);inner.lineTo(2.02,1.93);inner.lineTo(2.02,-1.93);inner.closePath();apron.holes.push(inner);
 const apronGeometry=new T.ShapeGeometry(apron);apronGeometry.rotateX(-Math.PI/2);const apronMesh=new T.Mesh(apronGeometry,material(0xa39c83,'dirt'));apronMesh.position.y=.03;apronMesh.receiveShadow=true;group.add(apronMesh);

 box(3.76,.085,3.56,0x81684c,0,.0825,0,group,style.stone?'masonry':'floor');
 // Walls meet at edges. Overlapping box caps used to compete in the depth
 // buffer along the corners, independently of the grass/foundation seam.
 box(3.64,3,.18,c,0,1.5,-1.83,group,wallKind);
 for(const side of [-1,1])box(.18,3,3.84,c,side*1.91,1.5,0,group,wallKind);
 for(const side of [-1,1])box(1.30,3,.18,c,side*1.17,1.5,1.83,group,wallKind);
 box(1.04,.75,.18,c,0,2.625,1.83,group,wallKind);
 // Fill the opening above the door leaf so the frame fits the door itself.
 box(1.04,.47,.18,c,0,2.015,1.83,group,wallKind);
 for(const side of [-1,1]){
  box(.07,.38,3.42,0x69513b,side*1.79,.32,0,group,'wood');
  box(.14,2.8,.16,0x66503c,side*1.77,1.5,-1.65,group,'wood');
 }
 box(3.45,.38,.07,0x69513b,0,.32,-1.69,group,'wood');
 box(1.1,.025,1.8,style.stone?0x6b4d43:0x65715c,0,.14,.25,group,'cloth');
 box(1.0,.08,.38,0x75543a,-.75,1.28,-1.56,group,'wood');
 for(let i=0;i<4;i++)box(.12,.22+(i%2)*.10,.20,[0x80504a,0x697b66,0x9f875c][i%3],-1.08+i*.2,1.43,-1.55,group,'cloth');
 const roofParts=[];
 // Wall plate: a timber beam, or a stone cornice on masonry buildings.
 roofParts.push(box(4.25,.18,3.9,style.stone?style.trim:0x74543c,0,3.07,0,group,style.stone?'masonry':'wood'));
 // Roof geometry: ridge x=0 at y=4.40; eaves x=±2.25 at y=3.12.
 // Slopes descend away from the ridge, meeting cleanly at the center.
 const roofRun=2.25,roofRise=1.28,roofLength=Math.hypot(roofRun,roofRise);
 const roofAngle=Math.atan2(roofRise,roofRun);
 for(const side of [-1,1]){
  // Thick thatch grows outward from the same underside so the gables still meet it.
  const thick=style.roofThick,lift=(thick-.16)/2,thatch=style.roofKind==='thatch';
  const roof=box(roofLength+(thatch?.22:.04),thick,thatch?4.5:4.35,roofColor,side*roofRun/2+side*Math.sin(roofAngle)*lift,3.12+roofRise/2+Math.cos(roofAngle)*lift,0,group,style.roofTexture);
  ridgeAlignedUV(roof.geometry);roof.rotation.z=-side*roofAngle;roofParts.push(roof);
  // Thin wooden fascia follows the actual eave rather than floating above it.
  const fascia=box(.18,.23,4.45,0x644a32,side*roofRun,3.11,0,group,'wood');roofParts.push(fascia);
 }
 // Close the triangular gable walls under the roof at front and back.
 const gableMaterial=material(c,wallKind).clone();gableMaterial.side=T.DoubleSide;
 for(const z of [-1.915,1.915]){
  // The gable follows the roof underside and sits flush with the wall face.
  const shape=new T.Shape();shape.moveTo(-2,3.0);shape.lineTo(2,3.0);shape.lineTo(2,3.15);shape.lineTo(0,4.29);shape.lineTo(-2,3.15);shape.closePath();
  const gableGeometry=new T.ShapeGeometry(shape),guv=gableGeometry.attributes.uv;for(let i=0;i<guv.count;i++)guv.setXY(i,guv.getX(i)/2,guv.getY(i)/2);
  const gable=new T.Mesh(gableGeometry,gableMaterial);gable.position.z=z;gable.castShadow=true;group.add(gable);roofParts.push(gable);
 }
 // Hinged, clickable door. A closed door blocks entry.
 const doorPivot=new T.Group();doorPivot.position.set(-.52,0,1.86);group.add(doorPivot);
 const doorMesh=box(1.04,1.75,.13,0x654026,.52,.9,0,doorPivot,'wood');
 box(.12,.12,.09,0xc4a15d,.88,.93,.1,doorPivot,'stone');
 const doorHit=new T.Mesh(new T.BoxGeometry(1.15,1.95,.5),new T.MeshBasicMaterial({visible:false}));
 doorHit.position.set(0,.95,1.86);group.add(doorHit);
 const houseRecord={group,roofParts,inside:false,open:!!options.open,doorPivot,doorHit,type:options.type||'cottage',name:options.name||'Cottage',roofColor,stories:options.stories||1};
 if(houseRecord.open)doorPivot.rotation.y=-Math.PI*.53;
 doorHit.userData={kind:'door',house:houseRecord};
 doorMesh.userData={kind:'door',house:houseRecord};targets.push(doorMesh);
 houseInteriors.push(houseRecord);
 if(options.type){if(options.furnished!==false)decorateTownBuilding(T,houseRecord,{box,material});if(options.type!=='armory')signsSystem().addBuilding(houseRecord)}
 detailBuilding(T,houseRecord,{box,material,style,type:options.type||'cottage'});
 for(const stand of houseRecord.bankStands||[]){stand.userData={kind:'bankStand',house:houseRecord};targets.push(stand);}
 return houseRecord;
}
// Building names are real signs now (building-signs.js): hanging boards, wall plaques and town signposts.
let buildingSignsRef=null;
function signsSystem(){if(!buildingSignsRef){buildingSignsRef=createBuildingSigns(T,scene,{heightAt:(x,z)=>landscape.walkHeight(x,z),lodScale:()=>BUILDING_LOD_SCALE[lodPreset]||1});buildingSignsRef.setSignposts(defaultSignposts(capitalActive()?capital.gates:[],{inward:inwardNormal}));window.eldervaleBuildingSigns=buildingSignsRef}return buildingSignsRef}
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
  water.rotation.x=-Math.PI/2;water.position.y=y;water.userData.terrainFixed=true;scene.add(water);waterSystem.add(water);
 }
 for(let i=0;i<(generatedWorld?0:12);i++){const a=i*Math.PI/6;const x=lake.x+Math.cos(a)*lake.rx*1.13,z=lake.z+Math.sin(a)*lake.rz*1.13;if(i%3===0)rock(x,z);else if(i%3===1)tree(x,z)}
 // Fix the deck to water level. Terrain-adjusting a pier's centre sinks
 // the entire model into the lakebed; each support instead reaches the bed.
 const dock=fishingDock(lake,landscape.heightAt);
 const deck=box(dock.length,dock.thickness,dock.width,0x8b6542,dock.x,dock.deckY,dock.z,scene,'wood');deck.userData.terrainFixed=true;deck.userData.fishingDock=lake.name;
 for(const p of dock.posts){const post=box(.2,p.height,.2,0x5a402d,p.x,p.y,p.z,scene,'wood');post.userData.terrainFixed=true;}
 mapProps.push({x:dock.x,z:dock.z,color:'#e5c37c'});
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
if(generatedWorld)for(const {x,z}of generatedTreePoints(generatedWorld.seed,(x,z)=>!campClearing(x,z,generatedWorld.seed)&&!inCastle(x,z,9)&&landscape.waterAt(x,z)<=.01&&distanceToRoad(x,z)>=5&&!landscapeSettlements.some(([sx,sz])=>Math.hypot(x-sx,z-sz)<38)))tree(x,z);
const forestBatches=buildNaturalForest(T,scene,forestTrees,{seed:generatedWorld?.seed||2419,wood:material(0x665039,'wood'),leaf:material(0xffffff,'leaf'),heightAt:landscape.heightAt});
const depletedTrees=new Map(),stumpMesh=new T.InstancedMesh(new T.CylinderGeometry(.29,.37,.26,10),material(0x866444,'wood'),forestTrees.length);stumpMesh.count=0;stumpMesh.userData.terrainFixed=true;stumpMesh.castShadow=stumpMesh.receiveShadow=true;stumpMesh.frustumCulled=false;scene.add(stumpMesh);
function setTreeDepleted(id,depleted,until=null){const custom=worldInstances.get(id)?.root;if(custom?.userData.harvestCanopy){custom.userData.harvestCanopy.visible=!depleted;custom.userData.harvestStump.visible=depleted;}if(depletedTrees.has(id)===depleted)return;if(depleted)depletedTrees.set(id,until);else depletedTrees.delete(id);if(custom?.userData.harvestCanopy){custom.userData.harvestCanopy.visible=!depleted;custom.userData.harvestStump.visible=depleted;}else setForestTreeVisible(T,forestBatches,id,!depleted);let index=0;const dummy=new T.Object3D();for(const key of depletedTrees.keys()){if(!key.startsWith('base:tree:'))continue;const [, ,x,z]=key.split(':');dummy.position.set(Number(x),landscape.heightAt(Number(x),Number(z))+.13,Number(z));dummy.updateMatrix();stumpMesh.setMatrixAt(index++,dummy.matrix);}stumpMesh.count=index;stumpMesh.instanceMatrix.needsUpdate=true;propCollisionIndex=null;meadow?.invalidate();}

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
// Examine-only things (held-open business/castle doors, scenery): a left click
// walks there; Examine lives in the right-click / long-press menu.
function houseHeldOpen(h){
 const now=performance.now();if(h.heldOpenAt&&now-h.heldOpenAt<5000)return h.heldOpenValue;
 const roles=npcs.filter(n=>n.alive!==false&&!n.deleted&&insideHouse(h,n.root.position)).map(n=>n.profile?.role),stations=[],p=new T.Vector3();
 for(const t of targets){const a=t.userData;if(!['profession','altar','hearth'].includes(a.kind))continue;t.getWorldPosition(p);if(insideHouse(h,p))stations.push(a.station||a.template||a.kind)}
 h.heldOpenAt=now;h.heldOpenValue=heldOpen({template:h.type},{roles,stations});return h.heldOpenValue;
}
function examineOnly(a){return a?.kind==='castleGate'||(a?.kind==='door'&&!!a.house&&houseHeldOpen(a.house))}
function examineName(a){return a.kind==='castleGate'?'great gate':a.kind==='door'?'door':(a.name||a.template||'scenery').replace(/_/g,' ')}
function examineText(a){return a.kind==='castleGate'||a.kind==='door'?heldOpenExamine(a.kind):'Part of the scenery of Eldervale.'}
function interactDoor(a){
 const h=a.house,point=housePoint(h,0,1.9);
 if(Math.hypot(player.position.x-point.x,player.position.z-point.z)>7){say('Move closer to the door.');return;}
 if(window.eldervaleAuthority){void window.eldervaleRealm?.command('move',{path:[],target:a.realmId||h.realmId,kind:'door'});return;}
 toggleHouseDoor(h);
}
function houseLocal(h,p){return h.group.worldToLocal(p.clone())}
function housePoint(h,x,z){return h.group.localToWorld(new T.Vector3(x,0,z))}
function insideHouse(h,p){const q=houseLocal(h,p);return Math.abs(q.x)<1.92&&Math.abs(q.z)<1.82}
function useBankStand(h,stand){const point=stand.getWorldPosition(new T.Vector3());if(currentInterior.floor!==0||!insideHouse(h,player.position)||Math.hypot(point.x-player.position.x,point.z-player.position.z)>3){say('Enter the bank and move closer to the stand.');return}services.open('bank',h.name);}
function walkAllowed(from,to){
 // Swept movement sampled at sub-character intervals prevents tunneling through thin walls.
 if(currentInterior.floor>0&&(window.eldervaleAuthority||Math.hypot(from.x-player.position.x,from.z-player.position.z)<.1)){const d=persistentRows.get(currentInterior.building)?.data;if(!d||!validStoryPosition(d,to.x,to.z,currentInterior.floor))return {blocked:true};for(const row of persistentRows.values())if(!row.deleted&&(row.data.floor||0)===currentInterior.floor&&row.data.kind==='object'&&row.data.building===currentInterior.building&&Math.abs(row.data.x-to.x)<.8*(row.data.scale||1)&&Math.abs(row.data.z-to.z)<.8*(row.data.scale||1))return {blocked:true};return {blocked:false}}const distance=Math.hypot(to.x-from.x,to.z-from.z),samples=Math.max(1,Math.ceil(distance/.18));
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
// Player routes may fall back to a whole-map terrain pass (rivers, long detours to a bridge).
const coarseWalk=(x,z)=>landscape.canWalk(x,z)&&!window.eldervaleCastleCollision?.(x,z);
function routeSteps(start,goal,maxNodes=30000,{coarse=false}={}){return searchRoute({start,goal,maxNodes,heightAt:landscape.walkHeight,canTravel:(a,b)=>!walkAllowed(a,b).blocked,coarseWalk:coarse&&currentInterior.floor===0?coarseWalk:null})}
function findWalkPath(start,goal,maxCells=30000){const work=routeSteps(start,goal,maxCells);let next;do{next=work.next()}while(!next.done);return next.value.map(p=>new T.Vector3(p.x,p.y,p.z));}
const areaLoading=createLoadingPanel();var navigationGeneration=0,routeController=null,routePending=false;
renderer.domElement.addEventListener('webglcontextlost',event=>{event.preventDefault();window.eldervaleGraphicsRecovery?.end();const ticket=areaLoading.begin('Restoring the game view…');window.eldervaleGraphicsRecovery=ticket;setTimeout(()=>{if(window.eldervaleGraphicsRecovery===ticket)ticket.fail?.('The graphics connection was interrupted. Reload to reconnect.',()=>location.reload())},10000)});
renderer.domElement.addEventListener('webglcontextrestored',()=>{window.eldervaleGraphicsRecovery?.end();window.eldervaleGraphicsRecovery=null;});

function routeTo(target){
 const goal=target.clone();goal.y=landscape.walkHeight(goal.x,goal.z);
 const h=houseInteriors.find(h=>insideHouse(h,goal));
 if(h&&!insideHouse(h,player.position)){
  const door=housePoint(h,0,2.48),threshold=housePoint(h,0,1.08);
  // A closed door is not opened for you (RuneScape style): the route search
  // walks to the reachable point nearest the click, outside the building.
  if(!h.open)return goal;
  // Enter through the doorway, then continue to the clicked destination.
  walkQueue=[threshold,goal];return door;
 }
 const current=houseInteriors.find(h=>insideHouse(h,player.position));
 if(current&&!insideHouse(current,goal)){
  const threshold=housePoint(current,0,1.08),door=housePoint(current,0,2.48);
  if(!current.open)return goal;
  walkQueue=[door,goal];return threshold;
 }
 return goal;
}
var navigationAfterDoor=null,pendingPickup=null,walkCheck=null;let walkQueue=[],mapDestination=null;
// Routes start where the server has the walker (advanced along its path), not
// where a lagging or low-frame-rate render shows it; otherwise the server walks
// back to the drawn position first.
function routeOrigin(){
 if(!window.eldervaleAuthority||!realmPlayerPose)return player.position.clone();
 const p=presentPose(realmPlayerPose,window.eldervaleServerTime?.()||Date.now());
 return Math.hypot(p.x-player.position.x,p.z-player.position.z)>.35?new T.Vector3(p.x,player.position.y,p.z):player.position.clone();
}
let following=null;
async function setWalkDestination(point,{flag=true,retried=false,follow=false}={}){
 if(!follow&&!retried)following=null;
 if(window.eldervaleTutorial?.blockWalk(point))return;
 const generation=++navigationGeneration;routeController?.abort();const controller=new AbortController();routeController=controller;routePending=true;
 navigationAfterDoor=null;walkQueue=[];if(action?.kind!=='creature')combatTurns.cancel();
 const target=routeTo(point),stops=[target,...walkQueue],requestAction=action,showFlag=flag&&!requestAction;walkQueue=[];dest=null;mapDestination=point.clone();if(showFlag)plantWalkFlag(point);else hideWalkFlag();
 const ticket=areaLoading.begin('Finding a clear route…',{delay:900,cancel:()=>{controller.abort();navigationGeneration++;routePending=false;mapDestination=null;hideWalkFlag();void window.eldervaleRealm?.command('stop')}});
 let pausePromise=null;const pauseTimer=setTimeout(()=>{if(generation===navigationGeneration&&window.eldervaleAuthority&&!realmInCombat)pausePromise=window.eldervaleRealm?.command('stop')},REDIRECT_PAUSE_MS);
 try{
  await window.eldervaleRegionStreamer?.idle();
  if(controller.signal.aborted)return;
  const all=[];let current=routeOrigin();for(const stop of stops){if(window.eldervaleTileMode&&Math.hypot(current.x-stop.x,current.z-stop.z)<28*TILE){all.push(stop.clone());current=stop;continue}const path=await runFrameWork(routeSteps(current,stop,30000,{coarse:true}),{signal:controller.signal,budget:12,yieldFrame:nextTask,onProgress:p=>ticket.progress(0,0,p?.visited?'Checking paths around nearby obstacles…':null)});if(!path.length&&Math.hypot(current.x-stop.x,current.z-stop.z)>.4){say('That destination is currently unreachable.');if(showFlag)hideWalkFlag();break}all.push(...path.map(p=>new T.Vector3(p.x,p.y,p.z)));current=stop;}
  clearTimeout(pauseTimer);if(pausePromise)await pausePromise;if(generation!==navigationGeneration)return;ticket.end();
  dest=all.shift()||null;walkQueue=all;mapDestination=all.at(-1)?.clone()||dest?.clone()||null;if(showFlag&&mapDestination)plantWalkFlag(mapDestination);
  if(window.eldervaleAuthority){let route=[dest,...walkQueue].filter(Boolean).slice(0,128).map(p=>[p.x,p.z]);if(!window.eldervaleTileMode&&realmPlayerPose)route=trimPassedWaypoints(route,presentPose(realmPlayerPose,(window.eldervaleServerTime?.()||Date.now())+(window.eldervaleRealm?.predictionLead?.()||0)));const target=requestAction?.realmId||requestAction?.worldEntityId||requestAction?.mob?.realmId||requestAction?.profile?.realmId||requestAction?.house?.realmId;await window.eldervaleRealm?.command('move',{path:route,target:target||null,kind:requestAction?.kind||'walk'});const end=route.at(-1);walkCheck=!requestAction&&end&&generation===navigationGeneration?{x:end[0],z:end[1],reach:.9,clicked:point.clone(),flag,generation,retried:retried===true,from:{x:player.position.x,z:player.position.z},startedAt:performance.now()}:null;}
 }catch(error){if(error.name!=='AbortError'){say('The route could not be loaded. Please choose a destination again.');console.warn('Route loading:',error);}}finally{clearTimeout(pauseTimer);ticket.end();if(generation===navigationGeneration)routePending=false;}
}

// Click-to-interact for things the server does not walk to by itself (trees,
// fishing spots, rocks, stations, bank stands, distant doors): walk into reach,
// then act once the walker has stopped there. A newer click cancels it.
let pendingArrival=null;
function arrivalPosition(){return window.eldervaleAuthority&&realmPlayerPose?realmPlayerPose:player.position}
function approachAndAct({x,z,reach,act,label}){
 if(withinReach(arrivalPosition(),{x,z},reach)&&withinReach(player.position,{x,z},reach+.5)){pendingArrival=null;act();return}
 const goal=approachPoint(routeOrigin(),{x,z},reach);action=null;pendingPickup=null;
 void setWalkDestination(new T.Vector3(goal.x,0,goal.z),{flag:false});
 pendingArrival={x,z,reach,act,generation:navigationGeneration,startedAt:performance.now()};if(label)say(label);
}
// NPCs and creatures wander: the server only completes a talk/attack intent
// once the walker stands within reach, so a route to where the target *was*
// can end out of reach with nothing happening. Re-route to where it is now.
// Walk to an NPC, then talk (left click) or open their bank/shop directly
// (right-click Bank/Trade). The server confirms arrival with an 'interaction'.
let npcIntent=null;
function walkToNpc(a,mode='talk'){action=a;npcIntent={target:a.realmId||a.profile?.realmId||a.worldEntityId||a.profile?.worldEntityId,mode,actor:a};void setWalkDestination(npcStandPoint(a.root.position));followActionTarget(a)}
// Stop beside the NPC (RuneScape style) rather than walking into it; keep the NPC's own spot when
// the side we approach from is in a different room, so the route still goes through the door.
function npcStandPoint(at){const ap=approachPoint(player.position,at,2.4),stand=new T.Vector3(ap.x,at.y,ap.z),room=p=>houseInteriors.find(h=>insideHouse(h,p))||null;return room(stand)===room(at)?stand:at.clone()}
// Right-click → Follow on another player: re-route behind them about once a second.
function updateFollow(){
 if(!following)return;const now=performance.now();if(now-following.at<900)return;following.at=now;
 const other=remotePlayers.get(following.id),goal=followGoal(player.position,other?.root?.position);
 if(goal==='lost'){say('You can no longer see '+following.name+'.');following=null;return}
 if(goal&&!routePending)void setWalkDestination(new T.Vector3(goal.x,0,goal.z),{flag:false,follow:true});
}
// Market stalls are scenery with a shopkeeper behind them: clicking the stall trades with that
// merchant (as in RuneScape) instead of opening an empty shop for the stall itself.
function stallKeeperHit(stall){let best=null,bestD=8*8;const p=new T.Vector3();for(const t of targets){const a=t.userData;if(a?.kind!=='npc'||a.profile?.role!=='merchant')continue;let o=t,shown=true;while(o){if(!o.visible){shown=false;break}o=o.parent}if(!shown)continue;t.getWorldPosition(p);const d=(p.x-stall.x)**2+(p.z-stall.z)**2;if(d<bestD){bestD=d;best=t}}return best}
function followActionTarget(a){
 const at=a?.kind==='creature'?a.mob?.root?.position:a?.kind==='npc'?a.root?.position:null;if(!at)return;
 pendingArrival={x:at.x,z:at.z,reach:a.kind==='creature'?Math.max(1.6,weaponStats(state.equippedWeapon).reach):2.8,follow:a,where:()=>a.kind==='creature'?a.mob?.root?.position:a.root?.position,tries:0,generation:navigationGeneration,startedAt:performance.now()};
}
// The server walks the client's waypoints and stops at the first blocked step
// (its collision can differ slightly from ours, or it started from elsewhere).
// If a walk ends short of its route, search again once from where the server
// actually stopped.
function updateWalkCheck(){
 if(!walkCheck||!window.eldervaleAuthority)return;const status=arrivalStatus(walkCheck,realmPlayerPose,{moving:!!realmPlayerPose?.moving,routing:routePending,generation:navigationGeneration,now:performance.now()});
 if(status==='failed'&&!walkCheck.retried){const c=walkCheck;walkCheck=null;const keep=pendingArrival;void setWalkDestination(c.clicked,{flag:c.flag,retried:true});if(keep&&!keep.follow){keep.generation=navigationGeneration;keep.activeAt=performance.now();pendingArrival=keep}}
 else if(status!=='walking'&&status!=='waiting'){if(status==='failed'&&walkCheck.retried&&walkCheck.from&&Math.hypot(player.position.x-walkCheck.from.x,player.position.z-walkCheck.from.z)<.3)say("You can't reach that from here.");walkCheck=null}
}
function updatePendingArrival(){
 updateWalkCheck();if(!pendingArrival)return;
 if(pendingArrival.follow){const at=pendingArrival.where();if(!at||realmInCombat||(pendingArrival.follow.kind==='creature'&&pendingArrival.follow.mob?.alive===false)){pendingArrival=null;return}pendingArrival.x=at.x;pendingArrival.z=at.z}
 const status=arrivalStatus(pendingArrival,arrivalPosition(),{moving:window.eldervaleAuthority?!!realmPlayerPose?.moving:!!dest||walkQueue.length>0,routing:routePending,generation:navigationGeneration,now:performance.now()});
 if(status==='arrived'){const {act,x,z}=pendingArrival;pendingArrival=null;if(act){faceTarget(player,new T.Vector3(x,player.position.y,z));act()}}
 else if(status==='failed'&&pendingArrival.follow&&pendingArrival.tries<3){const p=pendingArrival,at=p.where();action=p.follow;void setWalkDestination(new T.Vector3(at.x,0,at.z));p.tries++;p.generation=navigationGeneration;p.activeAt=performance.now();pendingArrival=p}
 else if(status==='cancelled')pendingArrival=null;
 else if(status==='failed'){pendingArrival=null;say("You can't reach that from here.")}
}
const stairActions=document.createElement('div');stairActions.id='stair-actions';stairActions.style.cssText='position:fixed;bottom:96px;left:50%;transform:translateX(-50%);z-index:80;display:none;gap:6px;padding:8px;border:1px solid #aa9566;border-radius:9px;background:#182b36ed;color:#ead9b5';document.body.append(stairActions);let nearbyStairs=null,stairsBusy=false;
async function useStairs(direction){if(!nearbyStairs||stairsBusy)return;stairsBusy=true;try{await window.eldervaleRealm?.command('stop');await window.eldervaleRealm?.command('stairs',{building:nearbyStairs.id,floor:currentInterior.floor+direction})}finally{stairsBusy=false}}
for(const [label,direction]of [['↑ Upstairs',1],['↓ Downstairs',-1]]){const b=document.createElement('button');b.type='button';b.textContent=label;b.dataset.direction=direction;b.onclick=()=>void useStairs(direction);stairActions.append(b)}
addEventListener('keydown',e=>{if(e.code==='KeyE'&&nearbyStairs&&!e.repeat&&!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&!document.querySelector('dialog[open]')){e.preventDefault();void useStairs(e.shiftKey?-1:1)}});
const houseLocalScratch=new T.Vector3();
// Inside, the roof turns invisible to the camera but keeps casting its sun
// shadow, so rooms are lit by the hemisphere and lamps, not the midday sun.
const roofShadowOnly=new T.MeshBasicMaterial({colorWrite:false,depthWrite:false,transparent:true,opacity:0});
function updateHouseRoofs(){
 nearbyStairs=null;for(const row of persistentRows.values()){const d=row.data;if(row.deleted||!(d.stories>1)||!['cottage','bank','inn','forge'].includes(d.template))continue;const anchor=stairPosition(d);if(Math.hypot(player.position.x-anchor.x,player.position.z-anchor.z)<Math.max(1.3,.65*1.3*d.scale)&&(!currentInterior.floor||currentInterior.building===row.id)){nearbyStairs={id:row.id,data:d};break}}{const display=nearbyStairs?'flex':'none';if(stairActions.style.display!==display)stairActions.style.display=display}if(nearbyStairs)for(const b of stairActions.children)b.hidden=Number(b.dataset.direction)>0?currentInterior.floor>=nearbyStairs.data.stories-1:currentInterior.floor===0;
 for(const house of houseInteriors){
  // Far buildings: one pass settles them (nothing hidden), then they are skipped.
  const g=house.group,dx=player.position.x-g.position.x,dz=player.position.z-g.position.z,near=dx*dx+dz*dz<900;
  if(!near&&house.settledFar)continue;house.settledFar=!near;
  const local=near?g.worldToLocal(houseLocalScratch.copy(player.position)):null;
  const inside=!!local&&Math.abs(local.x)<1.93&&Math.abs(local.z)<1.84;
  if(house.stories?.floors)house.stories.floors.slice(1).forEach((room,i)=>room.visible=!inside||currentInterior.floor===i+1);if(house.stories?.furnishings)for(const item of house.stories.furnishings)if(item.userData.stairFloor!==undefined)item.visible=!inside||item.userData.stairFloor===currentInterior.floor;if(inside!==house.inside){house.inside=inside;for(const part of house.roofParts)part.traverse(o=>{if(!o.isMesh)return;o.userData.roofMaterial??=o.material;o.material=inside?roofShadowOnly:o.userData.roofMaterial})}
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
const trader=buildHumanoid(T,merchant,{sex:'male',skin:'#d9a67e',hairColor:'#211b18',hair:'Long',beard:'Short beard'});
// The shopkeeper dresses as a well-off trader.
trader.setCoverage(npcAppearance({role:'noble merchant'},1).equipped);
const mh=new T.Mesh(new T.SphereGeometry(.43,8,6),new T.MeshBasicMaterial({visible:false}));mh.position.set(0,1.45,0);merchant.add(mh);mh.userData={kind:'merchant',x:-3,z:7};targets.push(mh);
if(!generatedWorld)box(2.5,.25,1,0x805832,-3,1,9,scene,'wood');
const player=new T.Group();scene.add(player);const body=new T.Group();player.add(body);
const avatar=buildHumanoid(T,body,{adventurer:true,sex:appearance.sex,skin:appearance.skin,hairColor:appearance.hairColor,hair:appearance.hair,beard:appearance.beard,shirtVariant:appearance.shirtVariant,pantsVariant:appearance.pantsVariant});
const playerAnimator=createHumanoidAnimator(avatar);
const arrows=createArrows(T,scene);
// Ranged attack visuals: arrows leave the bow hand; spells leave the casting (left) hand.
function launch(rig,weapon,target){if(isMagic(weapon))arrows.fire(rig.leftHand,target,{kind:'bolt',color:weaponCatalog[weapon].color});else arrows.fire(rig.leftHand,target)}
let mounted=false;
function hoofSound({root,front,index}){const distance=root.position.distanceTo(player.position);if(distance>28)return;const dx=root.position.x-player.position.x,dz=root.position.z-player.position.z;playHorseHoof({front,volume:Math.max(0,1-distance/28)*.8,pan:(dx*Math.cos(yaw)-dz*Math.sin(yaw))/18,hard:onBridge(landscape.bridges,root.position.x,root.position.z)||distanceToRoad(root.position.x,root.position.z)<3||inCastle(root.position.x,root.position.z)});}
const playerHorse=createHorseMount(T,player,{onHoof:hoofSound});
const merchantAnimator=createHumanoidAnimator(trader);
// Other online adventurers and short-lived overhead chat bubbles.
const remotePlayers=new Map(),chatBubbles=new Map();
let gatheringSelfId=null;const gatheringVisuals=createGatheringVisuals(T,scene,{waterHeight:job=>{const root=worldInstances.get(job.target)?.root;return root?.userData.fishingRipple?root.position.y:null},getActor:id=>id===gatheringSelfId?{root:player,rig:avatar}:remotePlayers.has(id)?{root:remotePlayers.get(id).root,rig:remotePlayers.get(id).animator.rig}:null,makeAxe:()=>makeWeapon(T,'axe'),onChop:root=>{const fx=soundEffects();if(!fx)return;fx.sample('chop',{at:root.position,gain:.95,far:45});if(Math.random()<.22)fx.sample('creak',{at:root.position,gain:.35,delay:.25,far:30})},onCast:(root,job)=>{const fx=soundEffects();if(!fx)return;const spot={x:job.x,z:job.z};fx.sample('splashCast',{at:spot,gain:job.method==='rod'?.45:.7,far:35});if(Math.random()<.6)fx.sample('ripple',{at:spot,gain:.3,delay:1.2+Math.random()*1.6,far:25})}});
const professionVisuals=createProfessionVisuals(T,scene,landscape,targets,{getActor:id=>id===gatheringSelfId?{root:player,rig:avatar}:remotePlayers.has(id)?{root:remotePlayers.get(id).root,rig:remotePlayers.get(id).animator.rig}:null,getObject:id=>worldInstances.get(id)?.root,makePickaxe:()=>makeWeapon(T,'pickaxe'),onStrike:(root,kind)=>{const fx=soundEffects();if(!fx)return;if(kind==='mine')fx.proc('clink',{at:root.position,gain:.8});else fx.sample('anvil',{at:root.position,gain:.85})},onWork:(root,recipe)=>{if(recipe?.skill==='cooking')soundEffects()?.proc('sizzle',{at:root.position,gain:.55})},onFire:(id,at)=>{const old=fireLoops.get(id);if(old){old.stop();fireLoops.delete(id)}if(at){const loop=soundEffects()?.loop('crackle',{at,gain:.6});if(loop)fireLoops.set(id,loop)}}});
const fireLoops=new Map(),levelFireworks=createLevelFireworks(T,scene);let celebrateUnsupported=false;
// What the area-sound mixer hears (music.js polls this once a second): where you
// are and which way the camera faces, time of day, water, towns and farms,
// forest density, the Winterwatch snow and Emberspire's heat, plus nearby
// smithies, chapels and livestock to place their sounds.
const soundTowns=generatedWorld?generatedWorld.towns.map(t=>({...townExtent(t,46),name:t.name})):townMusic.map(t=>({x:t.x,z:t.z,name:t.name,radius:t.radius}));
let soundSourceCache={at:0,list:[],forest:.5};
function soundSources(){const now=performance.now();if(now-soundSourceCache.at<4000)return soundSourceCache;const list=[],p=player.position,v=new T.Vector3();let trees=0;
 for(const t of targets){const u=t.userData;if(u.kind==='tree'){const dx=(u.x??0)-p.x,dz=(u.z??0)-p.z;if(Number.isFinite(u.x)&&dx*dx+dz*dz<900)trees++;continue}
  if(u.kind==='creature'&&u.mob?.root){const n=String(u.mob.name||'');const kind=/hen|chicken/i.test(n)?'hen':/sheep/i.test(n)?'sheep':null;if(kind){const w=u.mob.root.position;if(Math.hypot(w.x-p.x,w.z-p.z)<70)list.push({kind,x:w.x,z:w.z})}continue}
  if(u.kind==='npc'&&u.profile){const n=String(u.profile.name||'')+' '+String(u.profile.role||'');const kind=/smith/i.test(n)?'smithy':/chaplain|priest/i.test(n)?'chapel':null;if(kind){t.getWorldPosition(v);if(Math.hypot(v.x-p.x,v.z-p.z)<120)list.push({kind,x:v.x,z:v.z})}continue}
  if(u.kind==='profession'&&/smith|anvil|furnace/i.test(String(u.station||''))){t.getWorldPosition(v);if(Math.hypot(v.x-p.x,v.z-p.z)<70)list.push({kind:'smithy',x:v.x,z:v.z})}}
 soundSourceCache={at:now,list,forest:Math.min(1,trees/26)};return soundSourceCache}
const nearFactor=(d,inner,outer)=>d<=inner?1:d>=outer?0:1-(d-inner)/(outer-inner);
window.eldervaleAudioListener=()=>({x:player.position.x,z:player.position.z,yaw});
window.eldervaleAmbientState=()=>{const p=player.position,sources=soundSources(),closest=k=>{let d=Infinity;for(const s of sources.list)if(s.kind===k)d=Math.min(d,Math.hypot(s.x-p.x,s.z-p.z));return d};
 let town=0,snow=0,ember=0;for(const t of soundTowns){const d=Math.hypot(t.x-p.x,t.z-p.z);town=Math.max(town,nearFactor(d,t.radius*.55,t.radius+22));if(/winter/i.test(t.name))snow=Math.max(snow,nearFactor(d,60,150));if(/ember/i.test(t.name))ember=Math.max(ember,nearFactor(d,45,120))}
 const farm=Math.max(nearFactor(closest('hen'),10,40),nearFactor(closest('sheep'),12,50)),water=Math.max(waterProximity(p),window.eldervaleGetWaterSoundProximity?.()||0);
 return {position:{x:p.x,z:p.z},listener:{x:p.x,z:p.z,yaw},day:window.eldervaleDaylight??(window.eldervaleWorldNight?0:1),water,town,farm,forest:sources.forest,snow,ember,smithy:nearFactor(closest('smithy'),15,55),chapel:town>.2&&closest('chapel')<110?1:0,indoors:currentInterior.floor>0||houseInteriors.some(h=>insideHouse(h,p))?1:0,sources:sources.list}};
// Compact chat on narrow screens leaves the playfield and inventory accessible.
const mobileLayout=matchMedia('(max-width:700px)');
function compactMobileChat(){if(!mobileLayout.matches||document.body.classList.contains('fantasy-hud'))return;document.querySelector('#social-panel')?.classList.add('collapsed');const toggle=document.querySelector('#social-toggle');if(toggle)toggle.textContent='Show Chat'}
mobileLayout.addEventListener('change',compactMobileChat);compactMobileChat();
const bubbleLayer=document.createElement('div');bubbleLayer.id='overhead-chat-layer';bubbleLayer.style.cssText='position:fixed;inset:0;z-index:11;pointer-events:none;overflow:hidden';document.body.append(bubbleLayer);
window.eldervaleGetPlayerPosition=()=>({x:Math.round(player.position.x*10)/10,z:Math.round(player.position.z*10)/10,yaw:player.rotation.y,mounted,combatLevel:combatLevel(state),...publicCharacter(appearance,{armor:state.equipped,weapon:state.equippedWeapon,shield:state.equippedShield,mount:state.equippedMount})});
window.eldervaleUpdatePlayers=entries=>{
 if(!Array.isArray(entries))return;
 const seen=new Set();
 for(const entry of entries){if(!entry||typeof entry!=='object'||!entry.id||entry.id===(window.eldervaleSelfId||window.eldervaleUserId)||!Number.isFinite(entry.x)||!Number.isFinite(entry.z))continue;seen.add(entry.id);
 let other=remotePlayers.get(entry.id);
 if(!other){const root=new T.Group();scene.add(root);const display=buildCharacterDisplay(T,root,entry.appearance,entry.loadout);const tag=document.createElement('div');tag.style.cssText='position:fixed;padding:3px 7px;background:#14221cdd;color:#f4e2ba;border:1px solid #9b8659;border-radius:5px;font:12px Arial;white-space:nowrap;pointer-events:none';tag.textContent=String(entry.username||'Adventurer').slice(0,24);bubbleLayer.append(tag);other={horse:createHorseMount(T,root,{onHoof:hoofSound}),root,tag,animator:display,signature:JSON.stringify(display.data),target:new T.Vector3(entry.x,0,entry.z),yaw:0};root.position.copy(other.target);const hit=new T.Mesh(new T.CylinderGeometry(.65,.65,2.8,10),new T.MeshBasicMaterial({visible:false}));hit.position.y=1.4;root.add(hit);hit.userData={kind:'player',playerId:entry.id};targets.push(hit);other.hit=hit;remotePlayers.set(entry.id,other)}
 const cosmetics=publicCharacter(entry.appearance,entry.loadout),signature=JSON.stringify(cosmetics);
 if(signature!==other.signature){other.animator.dispose();other.animator=buildCharacterDisplay(T,other.root,cosmetics.appearance,cosmetics.loadout);other.signature=signature}
 other.username=String(entry.username||'Adventurer').slice(0,24);other.combatLevel=Math.max(1,Math.min(100,Math.floor(entry.combatLevel||1)));other.tag.textContent='Lv '+other.combatLevel+' · '+other.username;
 other.motion||=createMotionTrack({delay:650});const tileAt=entry.stepTiles!=null?Date.parse(entry.at):NaN;if(Number.isFinite(tileAt))other.motion.pushTile(tileAt,{x:entry.x,z:entry.z,yaw:entry.yaw||0,moving:true},performance.now(),realmFrameTime);else other.motion.push(realmFrameTime||Date.now(),{x:entry.x,z:entry.z,yaw:entry.yaw||0,moving:true});other.moveIntent=entry.moving===true;other.mounted=entry.mounted===true;other.running=entry.run===true;other.target.set(entry.x,0,entry.z);other.yaw=Number.isFinite(entry.yaw)?entry.yaw:0;
 // Treat long jumps as teleports rather than animating across the whole map.
 if(other.root.position.distanceToSquared(other.target)>400)other.root.position.copy(other.target);
 }
 for(const [id,other] of remotePlayers)if(!seen.has(id)){other.horse.dispose();other.animator.dispose();const ti=targets.indexOf(other.hit);if(ti>=0)targets.splice(ti,1);scene.remove(other.root);other.tag.remove();remotePlayers.delete(id);const bubble=chatBubbles.get(id);bubble?.node.remove();chatBubbles.delete(id)}
};
window.eldervaleShowChatBubble=(id,name,message)=>{
 if(!id||!message)return;const old=chatBubbles.get(id);old?.node.remove();
 const node=document.createElement('div');node.style.cssText='position:fixed;max-width:230px;padding:7px 10px;border:1px solid #d1b878;border-radius:12px;background:#f5e8c9;color:#29251d;box-shadow:0 3px 12px #0009;text-align:center;font:12px Arial;overflow-wrap:anywhere;pointer-events:none';
 node.className='overhead-chat-bubble';node.textContent=String(message).slice(0,240);bubbleLayer.append(node);chatBubbles.set(id,{node,expires:performance.now()+6500});
};
// Name tags and chat bubbles follow players every frame. Writing left/top and
// then reading offsetWidth forced a synchronous layout per player per frame;
// sizes are now measured once per text and positions use a compositor-only
// transform, written only when the rounded pixel position changes.
const overlaySizes=new WeakMap(),overlayProjected=new T.Vector3();
function placeOverlay(node,world,lift,visible,above){
 const display=visible?'block':'none';if(node.style.display!==display)node.style.display=display;if(!visible)return;
 let size=overlaySizes.get(node);if(!size||size.text!==node.textContent){if(!node.dataset.overlay){node.dataset.overlay='1';if(!node.style.position)node.style.position='absolute';node.style.left='0px';node.style.top='0px';node.style.willChange='transform'}size={text:node.textContent,w:node.offsetWidth,h:node.offsetHeight};overlaySizes.set(node,size)}
 overlayProjected.set(world.x,world.y+lift,world.z).project(camera);
 const x=Math.round((overlayProjected.x+1)*innerWidth/2-size.w/2),y=Math.round((1-overlayProjected.y)*innerHeight/2-(above?size.h:0)),key=x+','+y;
 if(node.dataset.at!==key){node.dataset.at=key;node.style.transform='translate3d('+x+'px,'+y+'px,0)'}
}
function overlayVisible(world,lift){overlayProjected.set(world.x,world.y+lift,world.z).project(camera);return overlayProjected.z<1&&overlayProjected.z>-1&&world.distanceTo(player.position)<75}
function updateOverheadChat(){
 const selfId=window.eldervaleUserId;
 for(const [id,other] of remotePlayers)placeOverlay(other.tag,other.root.position,3.05,!other.lodHidden&&overlayVisible(other.root.position,3.05),false);
 for(const [id,bubble] of chatBubbles){if(performance.now()>bubble.expires){bubble.node.remove();chatBubbles.delete(id);continue}const other=id===selfId?player:remotePlayers.get(id)?.root;if(!other){if(bubble.node.style.display!=='none')bubble.node.style.display='none';continue}placeOverlay(bubble.node,other.position,3.65,overlayVisible(other.position,3.65),true)}
}
const saved=JSON.parse(localStorage.getItem('eldervale-save')||localStorage.getItem('ashen-realms-save')||'{}');
const combat={hp:typeof saved.hp==='number'?Math.max(1,Math.min(100,saved.hp)):100,maxHp:100,xp:saved.combatXP||0,kills:saved.kills||0,attackTimer:0,respawnTimer:0,attackAnim:0,hitAnim:0,blockAnim:0,stanceTimer:0};
const armorKeys=Object.keys(armorCatalog);
const state={fishingPole:saved.fishingPole||0,bait:saved.bait||0,rawFish:saved.rawFish||0,worldReceipts:Array.isArray(saved.worldReceipts)?saved.worldReceipts:[],wood:saved.wood||0,ore:saved.ore||0,gold:saved.gold||0,woodXP:saved.woodXP||0,miningXP:saved.miningXP||0,
armorOwned:Array.isArray(saved.armorOwned)?saved.armorOwned.filter(k=>armorCatalog[k]):[],
equipped:(saved.equipped&&typeof saved.equipped==='object')?saved.equipped:{},weaponsOwned:Array.isArray(saved.weaponsOwned)?saved.weaponsOwned.filter(k=>weaponCatalog[k]):[],equippedWeapon:weaponCatalog[saved.equippedWeapon]?saved.equippedWeapon:null,starterChestClaimed:!!saved.starterChestClaimed,shieldsOwned:Array.isArray(saved.shieldsOwned)?saved.shieldsOwned.filter(k=>shieldCatalog[k]):[],equippedShield:shieldCatalog[saved.equippedShield]?saved.equippedShield:null};
for(const [id,g]of Object.entries(goods))if(!g.field)state[id]=Number.isFinite(Number(saved[id]))?Math.max(0,Math.min(1e9,Math.floor(Number(saved[id])))):0;
for(const key of ['attackXP','strengthXP','defenceXP','hitpointsXP','rangedXP','magicXP','prayerXP','firemakingXP','fishingXP','cookingXP','smithingXP','craftingXP','herbloreXP','farmingXP','agilityXP','thievingXP','fletchingXP','runecraftingXP','constructionXP','hunterXP'])state[key]=Number.isFinite(Number(saved[key]))?Math.max(0,Math.floor(Number(saved[key]))):0;
state.jewelryOwned=Array.isArray(saved.jewelryOwned)?saved.jewelryOwned.filter(k=>jewelryCatalog[k]):[];for(const slot of ['amulet','trinket'])state[slot]=state.jewelryOwned.includes(saved[slot])&&jewelryCatalog[saved[slot]]?.slot===slot?saved[slot]:null;
state.mountsOwned=Array.isArray(saved.mountsOwned)?saved.mountsOwned.filter(k=>mountCatalog[k]):[];state.equippedMount=state.mountsOwned.includes(saved.equippedMount)?saved.equippedMount:null;
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
const cape=createCape(T,body,{color:0x81394b,rig:avatar});
function refreshArmor(){avatar.setCoverage(state.equipped);cape.mesh.visible=!!state.equipped.cape}
refreshArmor();
const weaponMeshes=new Map();
// Tier variants (gear-tiers.js) are built the first time they are equipped.
const heldWeapon=key=>{if(key&&weaponCatalog[key]&&!weaponMeshes.has(key)){const model=makeWeapon(T,key);attachWeapon(avatar,model,key);model.visible=false;weaponMeshes.set(key,model)}return weaponMeshes.get(key)};
for(const key of Object.keys(weaponCatalog))if(!weaponCatalog[key].tint)heldWeapon(key);
const shieldMeshes=new Map();
const heldShield=key=>{if(key&&shieldCatalog[key]&&!shieldMeshes.has(key)){const model=makeShield(T,key);attachShield(avatar,model);model.visible=false;shieldMeshes.set(key,model)}return shieldMeshes.get(key)};
for(const key of Object.keys(shieldCatalog))if(!shieldCatalog[key].tint)heldShield(key);
if(isTwoHanded(state.equippedWeapon))state.equippedShield=null;
function refreshShield(){heldShield(state.equippedShield);for(const [key,model] of shieldMeshes)model.visible=state.equippedShield===key}
function equipShield(key){if(state.equippedShield!==key&&refuseEquip('shield:'+key))return;if(window.eldervaleAuthority){void window.eldervaleRealm?.command('equip',{slot:'shield',key});return}if(!state.shieldsOwned.includes(key))return;state.equippedShield=state.equippedShield===key?null:key;if(state.equippedShield&&isTwoHanded(state.equippedWeapon)){state.equippedWeapon=null;refreshWeapon()}refreshShield();say(state.equippedShield?'Equipped '+shieldCatalog[key].name:'Unequipped shield');save();draw()}
refreshShield();
function refreshWeapon(){heldWeapon(state.equippedWeapon);for(const [key,model] of weaponMeshes)model.visible=state.equippedWeapon===key}
function equipMount(key){if(window.eldervaleAuthority){void window.eldervaleRealm?.command('equip',{slot:'mount',key});return}if(!state.mountsOwned.includes(key))return;if(state.equippedMount===key&&inventoryUsed(state)>=INVENTORY_SLOTS){say('Free an inventory slot before removing the mount.');return}state.equippedMount=state.equippedMount===key?null:key;save();draw()}
function equipWeapon(key){if(state.equippedWeapon!==key&&refuseEquip('weapon:'+key))return;if(window.eldervaleAuthority){void window.eldervaleRealm?.command('equip',{slot:'weapon',key});return}if(!state.weaponsOwned.includes(key))return;state.equippedWeapon=state.equippedWeapon===key?null:key;if(isTwoHanded(state.equippedWeapon)){state.equippedShield=null;refreshShield()}refreshWeapon();say(state.equippedWeapon?'Equipped '+weaponCatalog[key].name:'Unequipped weapon');save();draw()}
refreshWeapon();
if(Number.isFinite(saved.x)&&Number.isFinite(saved.z)){const p=landscape.nearestDryPoint(saved.x,saved.z);player.position.set(p.x,0,p.z);if(Math.hypot(p.x,p.z)<2.5)player.position.z=5}else player.position.set(0,0,5);
const stats=document.querySelector('#stats'),inventory=document.querySelector('#inventory'),log=document.querySelector('#log'),equipment=document.querySelector('#equipment'),menu=document.querySelector('#contextmenu');
const inventoryGold=document.createElement('div');inventoryGold.id='inventory-gold';inventory.before(inventoryGold);inventoryGold.oncontextmenu=e=>{e.preventDefault();showMenu(e.clientX,e.clientY,[['Drop gold',()=>requestDrop(state,'gold')]])};
const tradePanel=createTradePanel(state,{say:s=>say(s)}),groundDrops=createGroundDrops(T,scene,landscape,targets),combatHealth=createCombatHealth(T,camera);var npcDuelIds=new Set(),combatPlayerIds=new Set();
let serviceAnchor=null;
const services=createServicePanel(state,{onChange:()=>{save();draw()},onOpen:()=>{serviceAnchor={x:player.position.x,z:player.position.z};dest=null;walkQueue=[];mapDestination=null;action=null;combatTurns.cancel();closeDialog()}});

let activeTab='inventory',mapOpen=false;const mapCanvas=document.querySelector('#minimap'),largeMap=document.querySelector('#worldmap'),mapPanel=document.querySelector('#map-panel');
let minimapExtent=90,running=false;
const mapControls=document.createElement('div');mapControls.id='map-controls';mapControls.style.cssText='position:absolute;right:8px;bottom:26px;display:flex;gap:4px;z-index:3';
for(const [label,title,handler] of [['+','Zoom in',()=>{minimapExtent=Math.max(35,minimapExtent*.8)}],['−','Zoom out',()=>{minimapExtent=Math.min(180,minimapExtent*1.25)}]]){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',title);button.style.cssText='min-height:30px;min-width:30px;padding:4px 7px;margin:0;font-size:14px';button.onclick=()=>{handler();refreshMinimapCache();composeMinimap(true)};mapControls.append(button)}
const runButton=document.createElement('button');runButton.id='run-toggle';runButton.type='button';runButton.innerHTML=footIcon+'<span id="run-energy">100</span>';runButton.setAttribute('aria-label','Toggle run');runButton.setAttribute('aria-pressed','false');mapControls.append(runButton);document.querySelector('#map-widget').append(mapControls);window.eldervaleMechanics=createMechanicsHud({say:t=>say(t)});
function updateRunButton(){runButton.disabled=mounted;runButton.classList.toggle('mounted',mounted);const energy=Math.ceil(state.runEnergy);if(runButton.dataset.energy===String(energy)&&runButton.getAttribute('aria-pressed')===String(running)&&runButton.dataset.mounted===String(mounted))return;runButton.dataset.energy=energy;runButton.setAttribute('aria-pressed',String(running));runButton.querySelector('span').textContent=mounted?'Ride':energy;runButton.title=mounted?'Mounted · gallop · no energy drain':(running?'Running':'Walking')+' · Energy '+energy+'/100';}
let lastRunTouch=-Infinity,runPending=null;
// Shared world: flip the orb immediately and hold that choice until the server
// confirms it, so a snapshot already in flight cannot flip it back (which made
// the orb look stuck on). A rejected command (e.g. sent within the server's
// 60 ms command spacing) is retried once, then the orb reverts.
function toggleRealmRun(){const next=!running;if(next&&state.runEnergy<5){say('Recover a little energy before running again.');return}running=next;const pending={value:next,until:performance.now()+4000};runPending=pending;updateRunButton();
 const send=retry=>window.eldervaleRealm?.command('run',{enabled:next}).then(ok=>{if(runPending!==pending)return;if(ok===false&&retry){setTimeout(()=>void send(false),180);return}runPending=null;if(ok===false){running=!next;updateRunButton()}});void send(true)}
runButton.onclick=e=>{if(e?.detail&&performance.now()-lastRunTouch<700)return;if(mounted){say('Mounted travel uses a constant speed without sprint energy.');return}if(window.eldervaleAuthority){toggleRealmRun();return}if(!running&&state.runEnergy<5){say('Recover a little energy before running again.');return}running=!running;updateRunButton()};runButton.addEventListener('pointerdown',e=>{if(e.pointerType==='touch'&&!runButton.disabled){e.preventDefault();e.stopPropagation();lastRunTouch=performance.now();runButton.onclick();}});updateRunButton();
const mapCtx=mapCanvas.getContext('2d');

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
function drawMap(ctx,canvas,scale,view){
 const w=view?.w??canvas.width,h=view?.h??canvas.height,extent=scale?840:(view?.extent??minimapExtent),pxPerUnit=w/extent,pzPerUnit=w/extent;
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
 if(capitalActive())drawCityWalls(ctx,[capitalMapWalls()],(x,z)=>({x:toX(x),y:toY(z)}),{width:Math.max(2,3.2*pxPerUnit)});
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
  if(scale&&(h.type==='bank'||h.type==='hall')){ctx.fillStyle='#f7e5a9';ctx.font=(scale?'bold 9px':'bold 10px')+' Georgia';ctx.textAlign='center';ctx.fillText(h.type==='bank'?'BANK':'HALL',cx,cy+3);ctx.textAlign='left'}
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
 if(!scale)return; // the minimap's upright icons and player marker are drawn by composeMinimap
 {const pile=deathFlow.pile();if(pile){const p=scale?{x:toX(pile.x),y:toY(pile.z)}:mapPoint(pile.x,pile.z,player.position,Math.PI,extent,w,h);if(p.x>6&&p.x<w-6&&p.y>6&&p.y<h-6)drawSkullIcon(ctx,p.x,p.y,13)}}
 {const flagAt=walkFlagState||mapDestination;if(flagAt){const p=scale?{x:toX(flagAt.x),y:toY(flagAt.z)}:mapPoint(flagAt.x,flagAt.z,player.position,Math.PI,extent,w,h);if(p.x>3&&p.x<w-3&&p.y>3&&p.y<h-3)drawMapFlag(ctx,p.x,p.y)}}
 const px=scale?toX(player.position.x):w/2,py=scale?toY(player.position.z):h/2;ctx.save();ctx.translate(px,py);ctx.rotate(Math.PI-player.rotation.y);ctx.fillStyle='#ffffff';ctx.strokeStyle='#15251d';ctx.lineWidth=2;ctx.beginPath();if(!scale)ctx.arc(0,0,3.2,0,Math.PI*2);else{ctx.moveTo(0,-7);ctx.lineTo(5,5);ctx.lineTo(0,2);ctx.lineTo(-5,5);ctx.closePath();}ctx.fill();ctx.stroke();ctx.restore();
}
// RuneScape-style map travel: click or tap a point on the minimap to walk there.
// A minimap click only plants the red flag (no yellow cross at the pointer).
mapCanvas.title='Map · Click to walk there';mapCanvas.style.cursor='crosshair';
// Old School RuneScape minimap: it turns with the camera so "up" is the way the
// camera faces. The terrain is painted north-up into a larger cached canvas a few
// times a second (as before); every frame that canvas is drawn rotated by the
// camera yaw and shifted by the player's movement since it was painted. Labels,
// the skull pile, the flag and the player dot are drawn upright on top.
const MINIMAP_SIZE=180,MINIMAP_PAD=24,minimapCacheSpan=Math.ceil(MINIMAP_SIZE*Math.SQRT2)+MINIMAP_PAD*2;
const minimapCache=document.createElement('canvas'),minimapCacheCtx=minimapCache.getContext('2d');
const minimapCached={x:0,z:0,extent:0,ready:false},minimapDrawn={yaw:NaN,x:NaN,z:NaN,stamp:-1},minimapScratch={x:0,y:0};
let minimapRes=0,minimapStamp=0,compassAngle=NaN,compassTurn=null;
function sizeMinimap(){const res=Math.min(2,Math.max(1,Math.ceil((window.devicePixelRatio||1)*2)/2));if(res===minimapRes)return;minimapRes=res;mapCanvas.width=mapCanvas.height=MINIMAP_SIZE*res;minimapCache.width=minimapCache.height=minimapCacheSpan*res;minimapCached.ready=false;minimapDrawn.stamp=-1}
sizeMinimap();addEventListener('resize',sizeMinimap);
function refreshMinimapCache(){sizeMinimap();minimapCacheCtx.setTransform(minimapRes,0,0,minimapRes,0,0);drawMap(minimapCacheCtx,minimapCache,false,{w:minimapCacheSpan,h:minimapCacheSpan,extent:minimapExtent*minimapCacheSpan/MINIMAP_SIZE});minimapCached.x=player.position.x;minimapCached.z=player.position.z;minimapCached.extent=minimapExtent;minimapCached.ready=true;minimapStamp++}
function composeMinimap(force=false){
 const px=player.position.x,pz=player.position.z,ppu=MINIMAP_SIZE/minimapExtent;
 if(!minimapCached.ready||minimapCached.extent!==minimapExtent||Math.hypot(minimapCached.x-px,minimapCached.z-pz)*ppu>MINIMAP_PAD*.8)refreshMinimapCache();
 if(!force&&minimapDrawn.stamp===minimapStamp&&minimapDrawn.yaw===yaw&&minimapDrawn.x===px&&minimapDrawn.z===pz)return;
 minimapDrawn.stamp=minimapStamp;minimapDrawn.yaw=yaw;minimapDrawn.x=px;minimapDrawn.z=pz;
 const ctx=mapCtx,S=MINIMAP_SIZE,c=S/2;
 ctx.setTransform(minimapRes,0,0,minimapRes,0,0);ctx.clearRect(0,0,S,S);ctx.save();ctx.beginPath();ctx.arc(c,c,c,0,Math.PI*2);ctx.clip();
 ctx.fillStyle='#415d39';ctx.fillRect(0,0,S,S);
 ctx.save();ctx.translate(c,c);ctx.rotate(minimapRotation(yaw));ctx.translate((minimapCached.x-px)*ppu,(minimapCached.z-pz)*ppu);
 ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';ctx.drawImage(minimapCache,-minimapCacheSpan/2,-minimapCacheSpan/2,minimapCacheSpan,minimapCacheSpan);ctx.restore();
 ctx.font='bold 10px Georgia';ctx.textAlign='center';ctx.fillStyle='#f7e5a9';
 for(const h of houseInteriors){if(h.type!=='bank'&&h.type!=='hall')continue;const p=worldToMinimap(h.group.position.x,h.group.position.z,player.position,yaw,minimapExtent,S,S,minimapScratch);if(p.x>-20&&p.x<S+20&&p.y>-10&&p.y<S+10)ctx.fillText(h.type==='bank'?'BANK':'HALL',p.x,p.y+3)}
 ctx.textAlign='left';
 questUiRef?.trail.drawMinimap(ctx,(x,z)=>worldToMinimap(x,z,player.position,yaw,minimapExtent,S,S,minimapScratch),c,c);
 questUiRef?.markers.drawMinimap(ctx,(x,z)=>{const p=worldToMinimap(x,z,player.position,yaw,minimapExtent,S,S,minimapScratch);return p.x>5&&p.x<S-5&&p.y>5&&p.y<S-5&&Math.hypot(p.x-c,p.y-c)<c-5?p:null});
 const pile=deathFlow.pile();if(pile){const p=worldToMinimap(pile.x,pile.z,player.position,yaw,minimapExtent,S,S,minimapScratch);if(p.x>6&&p.x<S-6&&p.y>6&&p.y<S-6)drawSkullIcon(ctx,p.x,p.y,13)}
 const flagAt=walkFlagState||mapDestination;if(flagAt){const p=worldToMinimap(flagAt.x,flagAt.z,player.position,yaw,minimapExtent,S,S,minimapScratch);if(p.x>3&&p.x<S-3&&p.y>3&&p.y<S-3)drawMapFlag(ctx,p.x,p.y)}
 ctx.fillStyle='#ffffff';ctx.strokeStyle='#15251d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(c,c,3.2,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.restore();
 if(compassAngle!==yaw){compassAngle=yaw;compassRose.setAttribute('transform','rotate('+(compassRotation(yaw)*180/Math.PI).toFixed(2)+')')}
}
// Compass beside the minimap: the red needle points to true north. Click/tap to
// face north; right-click or long-press for Look North/East/South/West.
const compass=document.createElement('button');compass.id='minimap-compass';compass.type='button';compass.title='Face north (right-click for more)';compass.setAttribute('aria-label','Compass: face north');compass.dataset.longPress='';
compass.innerHTML='<svg viewBox="-20 -20 40 40" aria-hidden="true"><circle r="18.6" fill="#1d2622" stroke="#b29a65" stroke-width="1.8"/><circle r="15.2" fill="#d8ccab" stroke="#3b3a30" stroke-width=".8"/><g class="compass-rose"><path d="M0-14V14M-14 0H14" stroke="#7f775f" stroke-width=".7"/><path d="M0-12.6 3.6 0H-3.6Z" fill="#c62a1e" stroke="#4b120d" stroke-width=".6"/><path d="M0 12.6 3.6 0H-3.6Z" fill="#f6f1e2" stroke="#4d4a40" stroke-width=".6"/><text x="0" y="-15.6" text-anchor="middle" dominant-baseline="middle" font-family="Georgia,serif" font-weight="700" font-size="7.5" fill="#ffffff" stroke="#3a0d08" stroke-width="1.6" paint-order="stroke">N</text></g><circle r="1.7" fill="#2e2a22"/></svg>';
const compassRose=compass.querySelector('.compass-rose');document.querySelector('#map-widget').append(compass);
function faceYaw(target){compassTurn={target:nearestYaw(yaw,target),since:performance.now()}}
// One frame of the compass turn; any manual camera turn (drag or keys) cancels it.
function updateCompassTurn(dt){if(!compassTurn)return;if(lastCameraDrag>compassTurn.since){compassTurn=null;return}yaw=stepYaw(yaw,compassTurn.target,dt);if(yaw===compassTurn.target)compassTurn=null}
compass.addEventListener('click',e=>{e.preventDefault();e.stopPropagation();faceYaw(LOOK_YAW.north)});
compass.addEventListener('contextmenu',e=>{e.preventDefault();e.stopPropagation();showMenu(e.clientX,e.clientY,[['Look North',()=>faceYaw(LOOK_YAW.north)],['Look East',()=>faceYaw(LOOK_YAW.east)],['Look South',()=>faceYaw(LOOK_YAW.south)],['Look West',()=>faceYaw(LOOK_YAW.west)]])});
function walkFromMap(e,canvas){const r=canvas.getBoundingClientRect(),rect={left:r.left+canvas.clientLeft,top:r.top+canvas.clientTop,width:canvas.clientWidth||r.width,height:canvas.clientHeight||r.height};const target=mapClickToWorld(e.clientX,e.clientY,rect,{player:player.position,extent:minimapExtent,width:MINIMAP_SIZE,height:MINIMAP_SIZE,heading:cameraHeading(yaw),circle:true});if(!target||!Number.isFinite(target.x)||!Number.isFinite(target.z))return;e.preventDefault();closeDialog();closeMenu();action=null;pendingPickup=null;void setWalkDestination(new T.Vector3(target.x,0,target.z));}
mapCanvas.addEventListener('click',e=>walkFromMap(e,mapCanvas));
// The full world map (world-map.js) pans, zooms and names places; it never walks.
const worldMapRegions=()=>generatedWorld?regionAnchors(regionDefinitions,(x,z)=>biomeWeights(x,z,generatedWorld.seed),840,20,places.map(([,x,z])=>({x,z}))):[];
const worldMapRows=()=>{try{return [...persistentRows.values()].filter(r=>!r.deleted&&r.data)}catch{return []}};
const worldMap=createWorldMap({canvas:largeMap,source:{extent:840,phone:matchMedia('(pointer:coarse)').matches&&Math.min(screen.width,screen.height)<700,
 heightAt:(x,z)=>landscape.heightAt(x,z),waterAt:(x,z)=>landscape.waterAt(x,z),biome:generatedWorld?(x,z)=>biomeWeights(x,z,generatedWorld.seed):null,regions:worldMapRegions,
 rivers:worldRivers,lakes:worldLakes,lakeOutline,roads:worldRoads,roadPoints,streets:()=>townStreets,bridges:landscape.bridges,castle,trees:()=>forestTrees,
 plazas:()=>worldMapRows().filter(r=>r.data.template==='plaza').map(r=>({x:r.data.x,z:r.data.z,r:8})),
 buildings:()=>houseInteriors.map(h=>({x:h.group.position.x,z:h.group.position.z,halfW:2*h.group.scale.x,halfD:1.85*h.group.scale.z,rot:h.group.rotation.y,roof:'#'+Number(h.roofColor||0x8a4b33).toString(16).padStart(6,'0'),type:h.type,name:h.name})),
 places:()=>places.map(([name,x,z])=>({name,x,z,kind:name.includes('Castle')?'castle':'town',...(isCapitalTown({x,z})&&name===capital.name?{capital:true,title:capital.title}:{})})),walls:()=>capitalActive()?[capitalMapWalls()]:[],
 pois:()=>[...houseInteriors.map(h=>({kind:poiKind(h.type),x:h.group.position.x,z:h.group.position.z,name:h.name})),...worldMapRows().map(r=>({kind:r.data.kind==='npc'&&(r.data.quest||r.data.questId)?'quest':poiKind(r.data.template),x:r.data.x,z:r.data.z,name:r.data.name}))],
 player:()=>({x:player.position.x,z:player.position.z,heading:player.rotation.y}),flag:()=>walkFlagState||mapDestination,deathPile:()=>deathFlow.pile(),
 signature:()=>forestTrees.length+':'+townStreets.length+':'+worldMapRows().filter(r=>r.data.template==='plaza').length}});
function setMapOpen(next){mapOpen=next;mapPanel.hidden=!mapOpen;if(mapOpen)worldMap.open();else worldMap.close()}
document.querySelector('#map-toggle').onclick=()=>setMapOpen(!mapOpen);
document.querySelector('#map-close').onclick=()=>setMapOpen(false);
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();closeDialog();if(mapOpen)setMapOpen(false)}if(!['INPUT','TEXTAREA','SELECT'].includes(document.activeElement?.tagName)&&e.key.toLowerCase()==='m'&&!e.repeat)setMapOpen(!mapOpen)});
document.addEventListener('contextmenu',e=>{if(e.target.closest('#game-ui')||e.target===renderer.domElement)e.preventDefault()});
// Click feedback: a brief on-screen cross at the pointer (yellow walk, red interact).
function markClick(clientX,clientY,kind='walk'){showClickCross(clientX,clientY,kind)}
// The red destination flag is drawn on the minimap only (until arrival or a new destination).
let walkFlagState=null;
function plantWalkFlag(p){walkFlagState={x:p.x,z:p.z,at:performance.now()}}
function hideWalkFlag(){walkFlagState=null}
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
 const dress=npcAppearance(profile,index),model=buildHumanoid(T,root,dress.look);model.setCoverage(dress.equipped);
 if(dress.armed){
  const weapon=makeWeapon(T,'longsword');attachWeapon(model,weapon,'longsword');profile.weapon='longsword';root.userData.armed=true;
 }
 const activity=profile.activity||({smith:'smith',banker:'read',herbalist:'garden',merchant:'trade',innkeeper:'trade',steward:'read'}[profile.role]);
 profile.activity=activity;
 const workProp=createWorkKit(T,model,profile);
 // Wizards carry their staff unless their job already fills the right hand.
 if(dress.staff&&!dress.armed&&!model.rightHand.children.length)attachWeapon(model,makeWeapon(T,dress.staff),dress.staff);

 // Clothing accents give each NPC a recognizable silhouette without changing the animation rig.
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
// The music player below has its own on/off and volume: drop the older duplicate slider and its
// unwired "Mute music" button (a theme rule forces labels to flex, so hide them with `hidden` + important).
for(const old of [document.querySelector('#settings-music-volume')?.closest('label'),document.querySelector('#settings-music-toggle')])if(old){old.hidden=true;old.style.setProperty('display','none','important')}
audioSettings.querySelector('p')?.remove();audioSettings.append(document.querySelector('#music-controls'));
const environmentControls=document.createElement('div');environmentControls.id='environment-controls';environmentControls.innerHTML='<h4>Area sounds</h4><button id="environment-toggle" type="button" aria-pressed="true">Area sounds on</button><label for="environment-volume">Birds, wind, water & town life</label><input id="environment-volume" type="range" min="0" max="100" value="70" aria-label="Area sounds volume"><h4>Sound effects</h4><button id="sfx-toggle" type="button" aria-pressed="true">Sound effects on</button><label for="sfx-volume">Actions, combat, horses & level-ups</label><input id="sfx-volume" type="range" min="0" max="100" value="80" aria-label="Sound effects volume"><small>Music, sound effects and area sounds have separate volumes.</small><a href="/credits.html" target="_blank" rel="noopener">Music & sound credits</a>';audioSettings.append(environmentControls);
const gameplaySettings=document.querySelector('[data-settings-panel="gameplay"]');gameplaySettings.append(document.querySelector('#stats'),document.querySelector('#reset'));
document.querySelector('#character-panel').hidden=true;
const brand=document.createElement('strong');brand.className='minimap-brand';brand.textContent='ELDERVALE';document.querySelector('#map-widget').prepend(brand);
document.querySelector('.social-head strong').textContent='Chat & Game';
const coordinateHUD=document.createElement('output');coordinateHUD.id='coordinate-hud';coordinateHUD.setAttribute('aria-label','Player world coordinates');coordinateHUD.style.cssText='position:fixed;top:max(12px,env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:90;background:#111c19e8;color:#f4d79a;border:1px solid #b6985e;border-radius:6px;padding:8px 14px;font:600 13px Arial,sans-serif;pointer-events:none;white-space:nowrap;display:none';document.body.append(coordinateHUD);if(localStorage.getItem('eldervale-show-coordinates')==='true')document.body.classList.add('show-coordinates');let lastCoordinateUpdate=0;function updateCoordinateHUD(){const active=document.body.classList.contains('show-coordinates'),display=active?'block':'none';if(coordinateHUD.style.display!==display)coordinateHUD.style.display=display;if(!active)return;const now=performance.now();if(now-lastCoordinateUpdate<120)return;lastCoordinateUpdate=now;coordinateHUD.textContent='X: '+player.position.x.toFixed(1)+'  |  Y: '+player.position.z.toFixed(1)+'  |  Height: '+player.position.y.toFixed(1)}
renderFeed();const playerHUD=createPlayerHUD(T,renderer,body);addEventListener('pagehide',()=>playerHUD.dispose(),{once:true});
const healthBar=document.querySelector('#health-fill'),combatNotice=document.querySelector('#combat-notice');
function combatMessage(msg){combatNotice.textContent=msg;combatNotice.hidden=false;clearTimeout(combatMessage.timer);combatMessage.timer=setTimeout(()=>combatNotice.hidden=true,1800)}
// Combat and action effects play through the shared mixer (music.js → sfx.js):
// swings whoosh, landed blows thud, blocks clank; music ducks a little on hits.
function combatSound(kind,at=null){const fx=soundEffects();if(!fx)return;const where=at?{x:at.x,z:at.z}:null;
 if(kind==='woodcut'){fx.sample('chop',{at:where,gain:.9});return}
 if(['stab','lunge','slash'].includes(kind)){fx.proc('whoosh',{at:where,gain:.7});return}
 if(kind==='metal'){fx.proc('block',{at:where,gain:.85});duckMusic(-3,.35,.8);return}
 fx.proc('hit',{at:where,gain:kind==='axe'?.95:.85});duckMusic(-4,.35,.8);
}
function faceTarget(object,target){const dx=target.x-object.position.x,dz=target.z-object.position.z;if(dx*dx+dz*dz>.0001)object.rotation.y=Math.atan2(dx,dz)}
const hitNumbers=createHitNumbers(T,camera);
installGearTooltip(document,()=>state);
// Server tick notices (e.g. out of arrows) repeat every turn; show one per streak.
const noticeLastSeen=new Map();function repeatingNotice(text,now=performance.now()){const last=noticeLastSeen.get(text);noticeLastSeen.set(text,now);return last===undefined||now-last>15000}
function applyPlayerHit(mob,rng=Math.random,weaponKey=state.equippedWeapon){if(window.eldervaleAuthority)return;
 if(!mob.alive)return;
 combat.stanceTimer=2;faceTarget(player,mob.root.position);
 const dealt=rollPlayerHit(playerAttackProfile({levels:playerLevels(state),bonuses:equipmentBonuses(state),weapon:weaponCatalog[weaponKey]||null,style:attackStyle}),mob.config||{level:1},rng),hit={blocked:dealt<=0,damage:dealt};
 hitNumbers.show(mob.root,hit.damage,hit.blocked,1.7);
 if(hit.blocked){mob.blockAnim=.65;combatSound('metal');combatMessage(mob.name+' blocks your attack.');return}
 mob.hitAnim=.3;mob.hp=Math.max(0,mob.hp-hit.damage);combatSound(/axe|hatchet/i.test(String(state.equippedWeapon||''))?'axe':'slash');combatMessage('You hit '+mob.name+' for '+hit.damage+' damage');
 if(mob.hp<=0){mob.alive=false;mob.root.visible=false;mob.respawn=mob.config?.respawn===0?Infinity:mob.config?.respawn||22;combat.kills++;combat.xp+=30;state.attackXP+=10;state.strengthXP+=10;state.defenceXP+=5;state.hitpointsXP+=5;state.gold+=mob.hostile?8:2;combatMessage('Defeated '+mob.name+'! +30 combat XP');action=null;dest=null;save();draw()}
}
function playerHit(mob,rng=Math.random){if(window.eldervaleAuthority)return;
 combat.stanceTimer=2;combat.attackAnim=0;combat.blockAnim=.65;
 const defense=meleeProtection(state).defence,taken=rollMonsterHit({damage:mob.hostile?6:3,...mob.config},{levels:playerLevels(state),bonuses:equipmentBonuses(state),style:attackStyle},rng),hit={blocked:taken<=0,damage:taken};faceTarget(mob.root,player.position);
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
// One conversation box (npc-dialogue.js): greeting, Talk, quest topics, Trade/Bank and Bye, with
// quest offers, progress and hand-ins as pages of the same box (never a second panel on top).
const dialogChoices=document.createElement('div');dialogChoices.id='dialog-choices';dialogChoices.hidden=true;dialog.insertBefore(dialogChoices,dialogNext);
const npcDialogue=createNpcDialogue({dialog,nameEl:dialogName,textEl:dialogText,nextEl:dialogNext,choicesEl:dialogChoices,portrait:dialoguePortrait,selfName:()=>document.querySelector('#account-name')?.textContent||'You',onOpen:profile=>{conversation={profile}},onClose:()=>{conversation=null}});
function closeDialog(){npcDialogue.close();conversation=null}
const questContext=()=>({trainee:!!window.eldervaleTutorial?.active,carried:item=>quantity(state,item),skillLevel:skill=>skillLevel(state[skill==='woodcutting'?'woodXP':skill+'XP']),
 // Quest v2 (quest-v2.js): server quest points, NPC lines unlocked by quests, names for report steps.
 qp:window.eldervaleQuestState?.qp,npcLines:id=>npcLinesFor(id,window.eldervaleQuestState?.unlocks),npcName:id=>realmActor(id)?.profile?.name||null,combatLevel:()=>combatLevel(state),itemName:id=>goods[id]?.name||id});
window.eldervaleQuestContext=questContext;
function talkTo(profile){
 // The client arrival and the server's interaction event can both ask to talk: one box only.
 if(npcDialogue.isOpenFor(profile))return;
 const questNpc=profile.worldEntityId||profile.realmId;if(window.eldervaleTutorial?.talk(questNpc,profile))return;
 const npc=npcs.find(n=>n.profile===profile);
 void converse(npcDialogue,{profile,npcId:questNpc,root:npc?.root,quests:()=>window.eldervaleQuestRows||[],ctx:questContext,command:(name,payload)=>window.eldervaleRealm?.command(name,payload)??Promise.resolve(false),lastError:()=>window.eldervaleRealm?.lastError||'',services:mode=>openNpcService(profile,mode),say,onQuestAccepted:q=>window.eldervaleQuestTracker?.track(q.id)});
}
// Bankers and merchants talk first, then offer their service as a choice.
function openNpcService(profile,service){closeDialog();if(service==='bank')services.open('bank',npcDisplayName(profile));else if(service==='trade')services.open('shop',npcDisplayName(profile),profile.worldEntityId||profile.realmId)}
function closeMenu(){menu.hidden=true;menu.innerHTML=''}
function showMenu(x,y,items){menu.innerHTML='';for(const [label,fn] of items){const b=document.createElement('button');if(label instanceof Node)b.append(label);else b.textContent=label;b.onclick=()=>{closeMenu();fn()};menu.append(b)}menu.hidden=false;menu.style.left=Math.min(x,innerWidth-190)+'px';menu.style.top=Math.min(y,innerHeight-180)+'px';fitToViewport(menu)}
// Wearing an item takes off whatever else was in its slot (one item per slot).
function toggleArmor(k){const slot=armorCatalog[k].equipSlot;if(!state.equipped[k]&&refuseEquip('armor:'+k))return;if(window.eldervaleAuthority){void window.eldervaleRealm?.command('equip',{slot,key:k});return}if(!state.armorOwned.includes(k))return;const wearing=!state.equipped[k];if(wearing)for(const other of armorKeys)if(other!==k&&armorCatalog[other].equipSlot===slot)state.equipped[other]=false;state.equipped[k]=wearing;refreshArmor();say((state.equipped[k]?'Equipped ':'Removed ')+armorCatalog[k].name);save();draw()}
function examine(k){say(armorCatalog[k].name+': '+armorCatalog[k].desc+' '+gearDetails('armor:'+k))}
// OSRS: equipping above your level is refused (items already worn stay on).
function refuseEquip(id){const message=equipRefusal(state,id);if(message)say(message);return !!message}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;draw();closeMenu()});

// Player-local graphics and interface preferences (no changes to cloud saves).
const settingKey='eldervale-client-settings';
let shadowRefresh=67,nextShadowRefresh=0;
let clientSettings={preset:'auto',scale:1,distance:330,shadows:true,fps:false,reducedMotion:false};
try{clientSettings={...clientSettings,...JSON.parse(localStorage.getItem(settingKey)||'{}')}}catch{}
// Automatic quality: the device picks the starting tier (tablets such as the
// iPad start on medium), then measured frame time scales the render
// resolution and, if that is not enough, drops a tier for this session.
// Choosing any explicit preset in Settings turns the automatic steps off.
// Classic look (classic-look.js): Settings › Graphics switch, or the owner's default.
const classicLook=createClassicLook(T,{scene,renderer,camera,hiddenLayer:HIDDEN_LAYER});classicLook.configure({ground});let classicReady=false;
let autoTierDrop=0,leanMode=false,graphicsPixelBase=1,lodPreset='high';const frameGovernor=createFrameGovernor(governorOptions({phone:isPhone({ua:navigator.userAgent,maxTouchPoints:navigator.maxTouchPoints,coarse:matchMedia('(any-pointer:coarse)').matches,touch:navigator.maxTouchPoints>0,width:screen.width||innerWidth,height:screen.height||innerHeight}),tablet:isTablet({ua:navigator.userAgent,maxTouchPoints:navigator.maxTouchPoints,coarse:matchMedia('(any-pointer:coarse)').matches,touch:navigator.maxTouchPoints>0})}));
function currentDeviceProfile(){const coarse=matchMedia('(any-pointer:coarse)').matches,touch=navigator.maxTouchPoints>0,profile=deviceProfile({width:innerWidth,height:innerHeight,coarse,touch,memory:navigator.deviceMemory||8,tablet:isTablet({ua:navigator.userAgent,maxTouchPoints:navigator.maxTouchPoints,coarse,touch}),phone:isPhone({ua:navigator.userAgent,maxTouchPoints:navigator.maxTouchPoints,coarse,touch,width:screen.width||innerWidth,height:screen.height||innerHeight})});for(let i=0;i<autoTierDrop;i++)profile.preset=lowerTier(profile.preset);return profile}
function applyResolution(){const dynamic=clientSettings.preset==='auto'?frameGovernor.scale:1;const ratio=classicLook.enabled?classicPixelRatio({height:renderer.domElement.clientHeight||innerHeight,devicePixelRatio}):Math.max(.5,graphicsPixelBase*dynamic);if(Math.abs(renderer.getPixelRatio()-ratio)>.01)renderer.setPixelRatio(ratio)}
function governFrame(elapsed){if(clientSettings.preset!=='auto'||document.hidden||classicLook.enabled)return;const change=frameGovernor.sample(elapsed*1000,performance.now());if(change==='scale')applyResolution();else if(change==='tier'){if(currentDeviceProfile().preset!=='low'&&autoTierDrop<3){autoTierDrop++;applyGraphics()}else if(!leanMode){leanMode=true;applyGraphics()}}}
function applyGraphics(){
 const profile=currentDeviceProfile();
 const resolved=(clientSettings.preset==='auto'&&leanMode?leanGraphics:g=>g)(effectiveGraphics(clientSettings,profile)),scale=Number(resolved.scale)||1;
 if(classicReady&&classicLook.set(classicEnabled(clientSettings,window.eldervaleGameConfig))){const now=performance.now();cellBatcher.invalidateAll(now);cellBatcher.flush(now,true);if(classicLook.enabled)classicLook.convert(cellBatchRoot);nextSkyUpdate=0;void renderer.compileAsync?.(scene,camera).catch(()=>{})}
 if(classicLook.enabled)resolved.shadows=false;
 graphicsPixelBase=Math.min(devicePixelRatio*scale,resolved.pixelCap);applyResolution();
 renderer.shadowMap.enabled=Boolean(resolved.shadows);sun.castShadow=Boolean(resolved.shadows);
 const preset=clientSettings.preset==='auto'?profile.preset:clientSettings.preset;lodPreset=preset==='custom'?(scale<=.65?'low':scale<1?'medium':'high'):preset;for(const h of houseInteriors)tuneBuildingLod(h.group);waterSystem.setQuality(lodPreset,profile.compact);
 const shadow=shadowQuality(preset,profile.compact);shadowRefresh=shadow.interval;sun.shadow.normalBias=shadow.normalBias;lanternPool.forEach((light,i)=>light.visible=i<shadow.lamps);nextShadowRefresh=0;Object.assign(sun.shadow.camera,{left:-shadow.radius,right:shadow.radius,top:shadow.radius,bottom:-shadow.radius});sun.shadow.camera.updateProjectionMatrix();sun.shadow.needsUpdate=true;if(sun.shadow.mapSize.x!==shadow.size){sun.shadow.mapSize.set(shadow.size,shadow.size);sun.shadow.map?.dispose();sun.shadow.map=null;}

 camera.far=Number(resolved.distance)||330;scene.fog.far=camera.far;scene.fog.near=camera.far*(classicLook.enabled?.3:.45);camera.updateProjectionMatrix();
 const ids={'graphics-preset':clientSettings.preset,'render-scale':String(scale),'view-distance':String(resolved.distance),'shadows-setting':resolved.shadows,'fps-setting':clientSettings.fps,'reduce-motion':clientSettings.reducedMotion,'classic-setting':classicLook.enabled};
 for(const [id,value] of Object.entries(ids)){const el=document.getElementById(id);if(el){if(el.type==='checkbox')el.checked=Boolean(value);else el.value=String(value)}}
 document.querySelector('#fps-counter').hidden=!clientSettings.fps;
 document.body.classList.toggle('reduce-motion',Boolean(clientSettings.reducedMotion));
}
function storeGraphics(){if(clientSettings.preset==='auto')clientSettings.preset='custom';localStorage.setItem(settingKey,JSON.stringify(clientSettings));applyGraphics()}
document.querySelector('#graphics-preset').addEventListener('change',e=>{clientSettings.preset=e.target.value;autoTierDrop=0;leanMode=false;frameGovernor.reset();if(e.target.value==='auto'){localStorage.setItem(settingKey,JSON.stringify(clientSettings));applyGraphics();return}const p={low:[.65,110,false],medium:[.8,210,false],high:[1,330,true],ultra:[1.25,440,true]}[e.target.value];[clientSettings.scale,clientSettings.distance,clientSettings.shadows]=p;storeGraphics()});
for(const [id,key,parse] of [['render-scale','scale',Number],['view-distance','distance',Number],['shadows-setting','shadows',Boolean],['fps-setting','fps',Boolean],['reduce-motion','reducedMotion',Boolean]])document.getElementById(id).addEventListener('change',e=>{if(clientSettings.preset==='auto')clientSettings={...effectiveGraphics(clientSettings,currentDeviceProfile()),preset:'custom'};clientSettings[key]=e.target.type==='checkbox'?e.target.checked:parse(e.target.value);storeGraphics()});
document.getElementById('classic-setting')?.addEventListener('change',e=>{clientSettings.classic=e.target.checked;localStorage.setItem(settingKey,JSON.stringify(clientSettings));applyGraphics()});
document.querySelectorAll('[data-settings-page]').forEach(b=>b.addEventListener('click',()=>{document.querySelectorAll('[data-settings-page]').forEach(t=>t.classList.toggle('active',t===b));document.querySelectorAll('[data-settings-panel]').forEach(p=>p.hidden=p.dataset.settingsPanel!==b.dataset.settingsPage)}));
document.querySelector('#settings-music-volume').addEventListener('input',e=>{const slider=document.querySelector('#music-volume');if(slider){slider.value=e.target.value;slider.dispatchEvent(new Event('input',{bubbles:true}))}});
document.querySelector('#open-friends').addEventListener('click',()=>{responsiveLayout.collapse();const panel=document.querySelector('#social-panel');panel.hidden=false;panel.classList.remove('collapsed');document.querySelector('[data-social-tab="friends"]')?.click()});
const responsiveLayout=installResponsiveLayout({onChange:()=>applyGraphics()});
applyGraphics();
let fpsSamples=0,fpsSeconds=0;

document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))closeMenu()});
const level=skillLevel;
// RuneScape eating: one bite every 1.8 s; the server heals (capped at max HP) and delays your next attack.
let lastEatAt=-Infinity;
// Bones: bury for Prayer XP (doubled when offered beside an altar); the server checks and awards.
let lastBuryAt=-Infinity;function buryBones(id){const item=goods[id];if(!item?.prayerXP||!(state[id]>0))return;const now=performance.now();if(now-lastBuryAt<1150)return;if(!window.eldervaleAuthority){say('Burying bones requires a connection to the shared world.');return}lastBuryAt=now;void window.eldervaleRealm?.command('bury',{item:id}).then(ok=>{if(!ok){lastBuryAt=-Infinity;const why=window.eldervaleRealm?.lastError;if(why)say(why)}})}
function eatFood(id){const item=goods[id];if(!isFood(item)||!(state[id]>0))return;const now=performance.now();if(now-lastEatAt<EAT_DELAY*1000-50)return;if(!window.eldervaleAuthority){say('Eating requires a connection to the shared world.');return}lastEatAt=now;say('You eat the '+item.name.replace(/^Cooked /,'').toLowerCase()+'.');void window.eldervaleRealm?.command(item.profession&&item.category!=='Food'?'skill_consume':'consume',{item:id}).then(ok=>{if(!ok){lastEatAt=-Infinity;const why=window.eldervaleRealm?.lastError;if(why)say(why)}})}
const skillDefinitions=[['⚔','Attack','attackXP'],['💪','Strength','strengthXP'],['🛡','Defence','defenceXP'],['❤️','Hitpoints','hitpointsXP'],['🏹','Ranged','rangedXP'],['✨','Magic','magicXP'],['🙏','Prayer','prayerXP'],['🌳','Woodcutting','woodXP'],['⛏','Mining','miningXP'],['🔥','Firemaking','firemakingXP'],['🎣','Fishing','fishingXP'],['🍳','Cooking','cookingXP'],['🔨','Smithing','smithingXP'],['🛠','Crafting','craftingXP'],['🌿','Herblore','herbloreXP'],['🌱','Farming','farmingXP'],['🏃','Agility','agilityXP'],['🗝','Thieving','thievingXP'],['🏹','Fletching','fletchingXP'],['✧','Runecrafting','runecraftingXP'],['🏠','Construction','constructionXP'],['🪤','Hunter','hunterXP']];
const professions=createProfessionPanel(state,{notice:say});addEventListener('keydown',e=>{if(e.code==='Escape')professions.clear()});
const skillsPanel=document.querySelector('#skills');
function drawSkills(){
 skillsPanel.replaceChildren();const rank=document.createElement('div');rank.className='player-combat-level';rank.innerHTML=crossedSwords;const label=document.createElement('strong');label.textContent='Player Combat Level: '+combatLevel(state)+' / 126';rank.append(label);skillsPanel.append(rank);
 const grid=document.createElement('div');grid.className='skills-grid';
 let total=0;
 for(const [icon,name,key] of skillDefinitions){
  const xp=Math.max(0,Number(state[key])||0),baseLevel=key==='hitpointsXP'?hitpointsLevel(xp):level(xp),bonus=jewelryBonus(state,key),lv=baseLevel+bonus,progress=xpProgress(xp),next=progress.next;total+=baseLevel;
  const tile=document.createElement('button');tile.type='button';tile.className='skill-tile';tile.setAttribute('aria-label',name+', level '+lv+', '+Math.floor(xp)+' experience');
  const glyph=document.createElement('span');glyph.className='skill-tile-icon';glyph.textContent=icon;
  const rank=document.createElement('span');rank.className='skill-tile-level';rank.textContent=bonus?baseLevel+' +'+bonus:lv;
  const title=document.createElement('span');title.className='skill-tile-name';title.textContent=name;
  tile.append(glyph,rank,title);
  tile.style.setProperty('--skill-progress',Math.round(progress.fraction*100)+'%');tile.title=name+' — Level '+lv+' · '+Math.floor(xp).toLocaleString()+' XP'+(baseLevel>=99?' · Maximum level':' · Next: '+next.toLocaleString()+' XP · '+Math.ceil(Math.max(0,next-xp)).toLocaleString()+' to go');
  tile.onclick=()=>{const old=skillsPanel.querySelector('.skill-detail');old?.remove();const detail=document.createElement('div');detail.className='skill-detail';const h=document.createElement('strong');h.textContent=icon+' '+name+' — Level '+lv;const p=document.createElement('p');p.textContent=baseLevel>=99?Math.floor(xp).toLocaleString()+' XP · Level 99 reached':Math.floor(xp).toLocaleString()+' XP · '+Math.ceil(Math.max(0,next-xp)).toLocaleString()+' XP until level '+(baseLevel+1);detail.append(h,p);skillsPanel.append(detail)};
  const showSkillDetail=tile.onclick;tile.onclick=()=>{const skill=Object.keys(professionSkills).find(id=>professionSkills[id].key===key);if(skill)professions.open({skill});else showSkillDetail();};grid.append(tile)
 }
 skillsPanel.append(grid);
 const footer=document.createElement('div');footer.className='skills-footer';footer.textContent='✦ Total level '+total+'  ·  '+skillDefinitions.length+' skills';skillsPanel.append(footer);
}
let lastPanelKey=null,stylePending=null,stancePreference=loadStance();
function draw(){
 if(inventoryGold.hidden!==(activeTab!=='inventory'))inventoryGold.hidden=activeTab!=='inventory';{const gold='🪙 '+state.gold.toLocaleString()+' gold';if(inventoryGold.textContent!==gold)inventoryGold.textContent=gold}
 playerHUD.update({combatLevel:combatLevel(state),hp:combat.hp,maxHp:combat.maxHp,xp:Object.keys(state).filter(k=>/^[a-z]+XP$/.test(k)).reduce((t,k)=>t+(Number(state[k])||0),0),kills:combat.kills,gold:state.gold,helmet:armorKeys.find(k=>state.equipped[k]&&armorCatalog[k].equipSlot==='helm')||null,weapon:weaponCatalog[state.equippedWeapon]});
 {const html='<p><strong>Health: '+Math.ceil(combat.hp)+' / '+combat.maxHp+'</strong><br>Combat: '+level(combat.xp)+' ('+combat.xp+' XP)<br>Defeated: '+combat.kills+'<br>Gold: '+state.gold+'<br>Woodcutting: '+level(state.woodXP)+' ('+state.woodXP+' XP)<br>Mining: '+level(state.miningXP)+' ('+state.miningXP+' XP)</p>';if(stats.dataset.html!==html){stats.dataset.html=html;stats.innerHTML=html}};
 const panelKey=panelStateKey(state,activeTab,attackStyle,goods);if(panelKey===lastPanelKey)return;lastPanelKey=panelKey;
 inventory.innerHTML='';for(const child of [...equipment.children])if(!child.classList.contains('mount-slot'))child.remove();
 const mountSlot=equipment.querySelector('.mount-slot')||document.createElement('button');mountSlot.type='button';mountSlot.className='equip-slot mount-slot';mountSlot.setAttribute('aria-label',state.equippedMount?'Dismount '+mountCatalog[state.equippedMount].name:'Mount: Empty');const mountSignature=JSON.stringify([state.equippedMount,state.mountsOwned]);if(mountSlot.dataset.signature!==mountSignature){mountSlot.dataset.signature=mountSignature;mountSlot.innerHTML='<span class="item-icon">'+mountCatalog.armoredWhiteHorse.icon+'</span><span class="mount-slot-text"><strong>'+(state.equippedMount?'Dismount':'Mount')+'</strong><span>'+(mountCatalog[state.equippedMount]?.name||'Choose a mount')+'</span><small>'+(state.equippedMount?'Gallop · no energy drain':'Separate from your armor')+'</small></span>';mountSlot.title=state.equippedMount?'Tap to dismount. Mounts also dismount automatically inside buildings and castles.':'Tap to equip a mount.';mountSlot.onclick=e=>{if(state.equippedMount){equipMount(state.equippedMount);return}if(state.mountsOwned.length===1){equipMount(state.mountsOwned[0]);return}const choices=state.mountsOwned.map(k=>[(state.equippedMount===k?'Unequip ':'Equip ')+mountCatalog[k].name,()=>equipMount(k)]);if(choices.length)showMenu(e.clientX,e.clientY,choices);else say('Mounts can be granted or stocked by the owner in World Studio.')};}if(!mountSlot.isConnected)equipment.prepend(mountSlot);
 if(state.equippedWeapon){const styles=document.createElement('div');styles.className='attack-styles';const osrsStyle=styleLabels(weaponCatalog[state.equippedWeapon]);for(const [key,label,hint]of [['stab','Stab','Awards Attack XP. Higher Attack improves accuracy.'],['slash','Slash','Awards Strength XP. Higher Strength increases damage.'],['lunge','Lunge','Splits combat XP equally between Attack, Strength and Defence.'],['block','Block','Awards Defence XP. Higher Defence makes you harder to hit.']].map(([k,l,h])=>[k,l,osrsStyle[k][0]+' — '+osrsStyle[k][1]+' '+h])){const b=document.createElement('button');b.type='button';b.textContent=label;b.title=hint;b.setAttribute('aria-label',label+' — '+hint);b.setAttribute('aria-pressed',String(attackStyle===key));b.classList.toggle('active',attackStyle===key);b.onclick=()=>{attackStyle=key;if(window.eldervaleAuthority){stylePending={style:key,until:performance.now()+4000};Promise.resolve(window.eldervaleRealm.command('attack_style',{style:key})).then(ok=>{if(ok===false)stylePending=null}).catch(()=>{stylePending=null})}draw()};styles.append(b)}equipment.append(styles)}
 equipment.append(stanceToggle(document,stancePreference,v=>{stancePreference=saveStance(v);lastPanelKey=null;draw()}));equipment.append(renderKeptOnDeath(document,state,goods));
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.tab===activeTab));
 inventory.hidden=activeTab!=='inventory';equipment.hidden=activeTab!=='equipment';skillsPanel.hidden=activeTab!=='skills';for(const key of ['friends','blocked','quests','settings'])document.querySelector('#'+key+'-tab').hidden=activeTab!==key;const prayerTab=document.querySelector('#prayer-tab');if(prayerTab)prayerTab.hidden=activeTab!=='prayer';if(activeTab==='skills')drawSkills();
 const slots=[],wornCopies=new Set();
 const owned=(field,kind,worn)=>{for(const key of state[field]){const identity=field+':'+key;if(worn(key)&&!wornCopies.has(identity)){wornCopies.add(identity);continue}slots.push({kind,key})}};
 owned('mountsOwned','mount',key=>state.equippedMount===key);owned('weaponsOwned','weapon',key=>state.equippedWeapon===key);owned('armorOwned','armor',key=>!!state.equipped[key]);owned('shieldsOwned','shield',key=>state.equippedShield===key);owned('jewelryOwned','jewelry',key=>state[jewelryCatalog[key].slot]===key);
 for(let i=0;i<state.wood;i++)slots.push({kind:'log'});
 for(let i=0;i<state.ore;i++)slots.push({kind:'ore'});for(const id of Object.keys(goods).filter(k=>!goods[k].field&&!['wood','ore'].includes(k)))if(state[id]>0){for(let i=0;i<(goods[id].stackable?1:state[id]);i++)slots.push({kind:'supply',key:id,count:state[id]})}
 for(let i=0;i<INVENTORY_SLOTS;i++){
  const item=slots[i],d=document.createElement('button');d.className='slot';
  if(item){const itemId=item.kind==='mount'?'mount:'+item.key:item.kind==='weapon'?'weapon:'+item.key:item.kind==='armor'?'armor:'+item.key:item.kind==='shield'?'shield:'+item.key:item.kind==='jewelry'?'jewelry:'+item.key:item.kind==='supply'?item.key:item.kind==='log'?'wood':'ore';const icon=document.createElement('span');icon.className='item-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML=goods[itemId].icon+(goods[itemId].stackable?' <small>'+item.count+'</small>':'');d.append(icon);d.setAttribute('aria-label',item.kind==='mount'?mountCatalog[item.key].name:item.kind==='supply'?goods[item.key].name:item.kind==='jewelry'?jewelryCatalog[item.key].name:item.kind==='weapon'?weaponCatalog[item.key].name:item.kind==='shield'?shieldCatalog[item.key].name:item.kind==='armor'?armorCatalog[item.key].name:item.kind==='log'?'Log':'Ore');
   d.dataset.itemId=itemId;if(item.kind==='armor'||item.kind==='weapon'||item.kind==='shield')d.dataset.gearTip=itemId;d.setAttribute('aria-label',goods[itemId].name);d.title=goods[itemId].name+' — '+((item.kind==='armor'||item.kind==='weapon'||item.kind==='shield')?gearDetails(itemId)+'\nClick to equip • Right-click for options':item.kind==='supply'&&isFood(goods[itemId])?'Click to eat • Right-click for options':'Right-click for options');
   d.onclick=()=>{if(professions.selected&&professions.combine(itemId))return;if(item.kind==='mount'){equipMount(item.key);return}if(item.kind==='log'||item.kind==='ore'){professions.use(itemId);return}if(item.kind==='supply'){if(goods[item.key].noteOf){say('Exchange this note at a bank before using the item. Deposit it, select Items, then withdraw.');return}if(goods[item.key].category==='Tools'){professions.use(itemId);return}if(isFood(goods[item.key])){eatFood(item.key);return}if(goods[item.key].prayerXP){buryBones(item.key);return}if(goods[item.key].drink&&window.eldervaleMechanics?.drink(item.key))return;say(item.key==='fishingPole'?'Carry the pole and bait, then click a shoreline fishing spot.':goods[item.key].name+' ×'+state[item.key]);return}if(item.kind==='jewelry')equipJewelry(item.key);else if(item.kind==='armor')toggleArmor(item.key);else if(item.kind==='weapon')equipWeapon(item.key);else if(item.kind==='shield')equipShield(item.key)};
   d.oncontextmenu=e=>{e.preventDefault();const choices=item.kind==='mount'?[['Equip '+mountCatalog[item.key].name,()=>equipMount(item.key)],['Examine',()=>say(mountCatalog[item.key].description)]]:item.kind==='jewelry'?[['Equip '+jewelryCatalog[item.key].name,()=>equipJewelry(item.key)],['Examine',()=>say(jewelryCatalog[item.key].description)]]:item.kind==='weapon'? [['Equip '+weaponCatalog[item.key].name,()=>equipWeapon(item.key)],['Examine',()=>say(weaponCatalog[item.key].desc+' '+gearDetails('weapon:'+item.key))]]:item.kind==='shield'?[['Equip '+shieldCatalog[item.key].name,()=>equipShield(item.key)],['Examine',()=>say(shieldCatalog[item.key].desc+' '+gearDetails('shield:'+item.key))]]:item.kind==='armor'?
    [['Equip '+armorCatalog[item.key].name,()=>toggleArmor(item.key)],['Examine',()=>examine(item.key)]]:
    [['Examine',()=>say(item.kind==='supply'?goods[item.key].name+(item.key==='bait'?' — stackable bait consumed by fishing.':item.key==='fishingPole'?' — carry this pole and bait to fish.':' — sell your catch to a merchant.'):item.kind==='log'?'Freshly cut logs.':'Unrefined ore.')]];if(!goods[itemId].noteOf)choices.unshift(['Use '+goods[itemId].name,()=>professions.use(itemId)]);if(item.kind==='supply'&&isFood(goods[itemId]))choices.unshift(['Eat '+goods[itemId].name,()=>eatFood(itemId)]);else if(goods[itemId].prayerXP)choices.unshift(['Bury '+goods[itemId].name,()=>buryBones(itemId)]);else if(goods[itemId].noteOf)choices.unshift(['Bank note',()=>say(goods[itemId].description)]);choices.push(['Drop',()=>requestDrop(state,itemId)]);showMenu(e.clientX,e.clientY,choices)};
  }else{d.disabled=true}inventory.append(d);
 }
 for(const slot of ['amulet','trinket']){const current=jewelryCatalog[state[slot]],button=document.createElement('button');button.className='equip-slot';button.dataset.slot=slot;button.dataset.empty=String(!current);const name=slot==='amulet'?'Amulet':'Trinket (ring)';button.setAttribute('aria-label',name+': '+(current?.name||'Empty'));button.innerHTML='<span class="item-icon">'+(goods['jewelry:'+(state[slot]||(slot==='amulet'?'woodlandAmulet':'prospectorsRing'))].icon)+'</span><span class="equip-caption">'+name+'</span>';button.title=current?current.name+' — '+current.description:'Choose jewelry · starter pieces are in the armory chest';button.onclick=e=>{const choices=state.jewelryOwned.filter(k=>jewelryCatalog[k].slot===slot).map(k=>['Equip '+jewelryCatalog[k].name,()=>equipJewelry(k)]);if(current)choices.unshift(['Remove '+current.name,()=>equipJewelry(state[slot])]);if(choices.length)showMenu(e.clientX,e.clientY,choices);else say('Collect starter jewelry from the armory chest.')};equipment.append(button)}
 const weaponSlot=document.createElement('button');weaponSlot.className='equip-slot';weaponSlot.dataset.slot='weapon';weaponSlot.setAttribute('aria-label','Weapon: '+(state.equippedWeapon?weaponCatalog[state.equippedWeapon].name:'Empty'));const weaponIcon=document.createElement('span');weaponIcon.className='item-icon';weaponIcon.innerHTML=state.equippedWeapon?iconForWeapon(state.equippedWeapon):'＋';const weaponLabel=document.createElement('span');weaponLabel.className='equip-caption';weaponLabel.textContent='Weapon';weaponSlot.append(weaponIcon,weaponLabel);weaponSlot.title=state.equippedWeapon?weaponCatalog[state.equippedWeapon].name+' — '+gearDetails('weapon:'+state.equippedWeapon):'Unarmed — punches (crush), 4 ticks';weaponSlot.disabled=!state.equippedWeapon;if(state.equippedWeapon)weaponSlot.dataset.gearTip='weapon:'+state.equippedWeapon;weaponSlot.onclick=()=>state.equippedWeapon&&equipWeapon(state.equippedWeapon);equipment.append(weaponSlot);
 const shieldSlot=document.createElement('button');shieldSlot.className='equip-slot';shieldSlot.dataset.slot='shield';shieldSlot.setAttribute('aria-label',state.equippedShield?shieldCatalog[state.equippedShield].name:'Shield (empty)');shieldSlot.innerHTML='<span class="item-icon">'+(state.equippedShield?goods['shield:'+state.equippedShield].icon:'＋')+'</span><span class="equip-caption">Shield</span>';shieldSlot.disabled=!state.equippedShield;if(state.equippedShield)shieldSlot.title=shieldCatalog[state.equippedShield].name+' — '+gearDetails('shield:'+state.equippedShield);shieldSlot.onclick=()=>state.equippedShield&&equipShield(state.equippedShield);equipment.append(shieldSlot);
 // One slot per body region: the worn item (or ＋), tap to change or remove.
 for(const slot of ARMOR_SLOTS){const worn=armorKeys.find(k=>state.equipped[k]&&armorCatalog[k].equipSlot===slot),label=SLOT_LABELS[slot],spare=state.armorOwned.filter(k=>k!==worn&&armorCatalog[k]?.equipSlot===slot);
  const item=document.createElement('button');item.className='equip-slot';item.dataset.slot=slot;
  item.setAttribute('aria-label',label+': '+(worn?armorCatalog[worn].name:'Empty')+(spare.length?' · '+spare.length+' more owned':''));
  const icon=document.createElement('span');icon.className='item-icon';icon.setAttribute('aria-hidden','true');
  if(worn)icon.innerHTML=goods['armor:'+worn].icon;else icon.textContent='＋';
  const caption=document.createElement('span');caption.className='equip-caption';caption.textContent=label;
  item.append(icon,caption);
  item.disabled=!worn&&!spare.length;if(worn)item.dataset.gearTip='armor:'+worn;
  item.title=worn?armorCatalog[worn].name+' — '+gearDetails('armor:'+worn):spare.length?'Choose what to wear':'Nothing owned for this slot';
  const choices=()=>[...(worn?[['Remove '+armorCatalog[worn].name,()=>toggleArmor(worn)],['Examine',()=>examine(worn)]]:[]),...spare.map(k=>['Wear '+armorCatalog[k].name,()=>toggleArmor(k)])];
  item.onclick=e=>{const c=choices();if(c.length)showMenu(e.clientX,e.clientY,c)};
  item.oncontextmenu=e=>{e.preventDefault();item.onclick(e)};
  equipment.append(item);
 }
 const gearTotals=equipmentBonuses(state),ammoId=gearTotals.arrow||'arrows';equipment.append(renderEquipmentStats(document,state,{style:attackStyle,goods}));arrangeEquipmentDoll(equipment,{ammo:{icon:goods[ammoId]?.icon,count:state[ammoId]||0}});document.body.classList.toggle('equipment-tab-open',activeTab==='equipment');

}
function equipJewelry(key){if(window.eldervaleAuthority){void window.eldervaleRealm?.command('equip',{slot:jewelryCatalog[key]?.slot,key});return}const item=jewelryCatalog[key];if(!item||!state.jewelryOwned.includes(key))return;state[item.slot]=state[item.slot]===key?null:key;save();draw();say(state[item.slot]?item.name+' equipped. '+item.description:'Removed '+item.name)}
function say(s){addSystemMessage(s)}let lastSyncSave=-Infinity;
function captureSave(){const snapshot={...saved,...state,appearance,hp:combat.hp,combatXP:combat.xp,kills:combat.kills,x:player.position.x,z:player.position.z};localStorage.setItem('eldervale-save',JSON.stringify(snapshot));return snapshot}
window.eldervaleCaptureSave=captureSave;
function save(){captureSave();window.eldervaleSave?.()}
document.querySelector('#reset').onclick=()=>window.eldervaleReset?.();
let dest=null,action=null,yaw=Math.PI,pitch=.24,zoom=10,drag=false,down=null,lastCameraDrag=0,rightSteering=false,dragDistance=0,downPointerType='mouse';const cameraWallRay=new T.Raycaster(),ray=new T.Raycaster(),pointer=new T.Vector2();cameraWallRay.layers.enable(BATCHED_LAYER);
installTouchGestures(renderer.domElement,{onPinch:ratio=>{zoom=T.MathUtils.clamp(zoom*ratio,4,28);drag=true;down=null},onHold:p=>renderer.domElement.dispatchEvent(new PointerEvent('pointerup',{clientX:p.x,clientY:p.y,button:2,pointerType:'touch',bubbles:true}))});
const mmoControls=installMMOControls({element:renderer.domElement,isBlocked:()=>window.eldervaleWorldLoading===true||document.hidden||document.body.classList.contains('landscape-required')||document.body.classList.contains('area-loading')||!document.querySelector('#dialog').hidden||!!document.querySelector('dialog[open]')||!!document.activeElement?.closest('input,textarea,select,[contenteditable=true]'),onJump:()=>{if(window.eldervaleAuthority)void window.eldervaleRealm?.command('jump');else localJumpAt=new Date().toISOString()},isCameraBlocked:()=>window.eldervaleWorldLoading===true||document.hidden||document.body.classList.contains('landscape-required')});
let localJumpAt=null;
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
// Camera drags must not select the page: block selection that starts on the
// canvas or happens during a canvas press, but never inside text fields.
const editableTarget=t=>!!t?.closest?.('input,textarea,select,[contenteditable=true],[contenteditable=""]');
document.addEventListener('selectstart',e=>{if((down||e.target===renderer.domElement)&&!editableTarget(e.target))e.preventDefault()});
renderer.domElement.addEventListener('dragstart',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;if(!editableTarget(document.activeElement))getSelection?.()?.removeAllRanges?.();responsiveLayout.collapse();down=[e.clientX,e.clientY];downPointerType=e.pointerType||'mouse';rightSteering=e.button===2;drag=false;dragDistance=0;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('mousedown',e=>{rightSteering=!!(e.buttons&2);if((e.buttons&3)===3)drag=true});
document.addEventListener('mouseup',e=>{rightSteering=!!(e.buttons&2)});
renderer.domElement.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-down[0],dy=e.clientY-down[1];dragDistance+=Math.hypot(dx,dy);if(!isTap(dragDistance,downPointerType))drag=true;if(drag){yaw-=dx*.005;pitch=T.MathUtils.clamp(pitch+dy*.0035,-.10,1.15);lastCameraDrag=performance.now()}down=[e.clientX,e.clientY]});
renderer.domElement.addEventListener('pointercancel',()=>{down=null;rightSteering=false});
renderer.domElement.addEventListener('pointerup',e=>{if(!down)return;down=null;rightSteering=false;if(drag||!isTap(dragDistance,e.pointerType||downPointerType))return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const rayHits=actorsFirst(ray.intersectObjects(targets.filter(t=>{let o=t;while(o){if(!o.visible)return false;o=o.parent}return true}),false)),solidHits=rayHits.filter(h=>h.object.userData.kind!=='worldObject'),hits=solidHits.filter(h=>!examineOnly(h.object.userData)),examineHit=hits.length?null:solidHits[0]||null,decorationHit=solidHits.length?null:rayHits[0]||null;if(hits[0]?.object.userData.kind==='merchant'&&hits[0].object.userData.station==='market'){const keeper=stallKeeperHit(hits[0].object.userData);if(keeper)hits.unshift({object:keeper,distance:hits[0].distance})}const point=new T.Vector3();const groundHit=ray.intersectObjects(walkSurfaces.filter(o=>!o.userData.storyFloor||o.userData.storyFloor===currentInterior.floor),false)[0];const hitGround=groundHit?point.copy(groundHit.point):null;
if(window.eldervaleBuilderClick?.({point:hitGround?{x:point.x,z:point.z}:null,entityId:rayHits[0]?.object.userData.worldEntityId||rayHits[0]?.object.userData.mob?.realmId||rayHits[0]?.object.userData.profile?.realmId,button:e.button}))return;
// RuneScape: every right-click menu on the world offers Walk here (before Examine).
const walkHere=hitGround?['Walk here',()=>{closeDialog();action=null;pendingPickup=null;npcIntent=null;markClick(e.clientX,e.clientY,'walk');void setWalkDestination(point.clone())}]:null,menuAt=(x,y,choices)=>showMenu(x,y,withWalkHere(choices,walkHere));
const spotOf=hit=>{const a=hit.object.userData;if(Number.isFinite(a.x)&&Number.isFinite(a.z))return {x:a.x,z:a.z};const w=hit.object.getWorldPosition(new T.Vector3());return {x:w.x,z:w.z}};
if(e.button===0){const interactive=!!hits[0];if(interactive)markClick(e.clientX,e.clientY,'interact');else if(hitGround)markClick(e.clientX,e.clientY,'walk')}
if(hits[0]?.object.userData.kind==='door'){const a=hits[0].object.userData,doorAt=housePoint(a.house,0,1.9),use=()=>approachAndAct({x:doorAt.x,z:doorAt.z,reach:5,act:()=>interactDoor(a)});if(e.button===2)menuAt(e.clientX,e.clientY,[[a.house.open?'Close door':'Open door',use],['Cancel',()=>{}]]);else use();return;}
if(hits[0]?.object.userData.kind==='bankStand'){const stand=hits[0].object,a=stand.userData,standAt=stand.getWorldPosition(new T.Vector3()),use=()=>approachAndAct({x:standAt.x,z:standAt.z,reach:2.4,act:()=>useBankStand(a.house,stand)});if(e.button===2)menuAt(e.clientX,e.clientY,[['Use bank stand',use],['Examine bank stand',()=>say('A teller stand for depositing and withdrawing your belongings.')],['Cancel',()=>{}]]);else use();return;}
if(hits[0]?.object.userData.kind==='profession'){const a=hits[0].object.userData,at=spotOf(hits[0]),use=()=>approachAndAct({...at,reach:3.4,act:()=>professions.open({station:a.station,target:a.worldEntityId||a.realmId})}),station=a.station==='cooking'?'Fire':a.name||professionStations[a.station]||'station';if(e.button===2)menuAt(e.clientX,e.clientY,[[(a.station==='cooking'?'Cook on ':'Use ')+station,use],['Examine '+station,()=>say(a.station==='cooking'?'A cooking fire. Cook raw food on it.':station+'. Choose a recipe here; stay within reach while working.')],['Cancel',()=>{}]]);else use();return;}
if(hits[0]?.object.userData.kind==='rock'){const a=hits[0].object.userData,at=spotOf(hits[0]),mine=()=>approachAndAct({...at,reach:3.4,act:()=>void window.eldervaleRealm?.command('skill_start',{recipe:'mine_'+(a.resource||'ore'),target:a.worldEntityId||a.realmId,amount:1})});if(e.button===2)menuAt(e.clientX,e.clientY,[['Mine '+(goods[a.resource||'ore']?.name||'rock'),mine],['Examine',()=>say('Carry or equip a pickaxe. Higher ores require a higher Mining level.')],['Cancel',()=>{}]]);else mine();return;}
if(hits[0]?.object.userData.kind==='groundDrop'){const d=hits[0].object.userData;if(professions.selected&&professions.lightDrop(d))return;const take=()=>{pendingPickup={...d};action=null;setWalkDestination(new T.Vector3(d.x,0,d.z));};if(e.button===2)menuAt(e.clientX,e.clientY,[['Take '+d.name+' ×'+d.amount,take],...(['wood','oakLogs','willowLogs','mapleLogs','yewLogs'].includes(d.item)?[['Light logs',()=>professions.lightDrop(d)]]:[]),['Cancel',()=>{}]]);else take();return}
pendingPickup=null;
if(['tree','fishing'].includes(hits[0]?.object.userData.kind)){const a=hits[0].object.userData,target=a.worldEntityId||a.realmId;const start=method=>{if(!window.eldervaleAuthority){say('Gathering requires a connection to the shared world.');return}closeDialog();approachAndAct({...spotOf(hits[0]),reach:a.kind==='tree'?3:2.6,act:()=>void window.eldervaleRealm.command(method==='woodcut'?'woodcut':'fish',{target,method})});};if(a.kind==='tree'){if(e.button===2)menuAt(e.clientX,e.clientY,[['Chop down tree',()=>start('woodcut')],['Examine tree',()=>say(Date.parse(a.availableAt)>(window.eldervaleServerTime?.()||Date.now())?'A tree stump. It will regrow shortly.':'A tree. Carry or equip a woodcutting axe to collect logs.')],['Cancel',()=>{}]]);else start('woodcut');}else{const fishLv=skillLevel(state.fishingXP),usable=m=>state[fishingMethods[m].tool]>0&&fishLv>=fishingMethods[m].level&&(m!=='rod'||state.bait>0);if(e.button===2)menuAt(e.clientX,e.clientY,[['Net (shrimp)',()=>start('net')],['Bait (river fish, trout, salmon)',()=>start('rod')],['Cage (lobster · Fishing 40)',()=>start('cage')],['Harpoon (swordfish, stormfin · Fishing 50)',()=>start('harpoon')],['Cancel',()=>{}]]);else start(['harpoon','cage','rod','net'].find(usable)||(state.fishingNet>0?'net':'rod'));}return;}
if(hits[0]?.object.userData.kind==='worldItem'){window.eldervaleWorldPickup?.(hits[0].object.userData.worldEntityId);return}
if(hits[0]?.object.userData.kind==='player'){const other=remotePlayers.get(hits[0].object.userData.playerId);if(other&&e.button===2){const row=actorMenuLabel({name:other.username,level:other.combatLevel,playerLevel:combatLevel(state),accountId:hits[0].object.userData.playerId,player:true});const otherId=hits[0].object.userData.playerId;menuAt(e.clientX,e.clientY,[[row,()=>say(other.username+' · Combat level '+other.combatLevel)],['Trade with '+other.username,()=>tradePanel.request(otherId,other.username)],['Follow '+other.username,()=>{closeDialog();action=null;pendingArrival=null;npcIntent=null;following={id:otherId,name:other.username,at:0};say('You follow '+other.username+'.')}],['Report '+other.username,()=>window.eldervaleReportPlayer?.(otherId,other.username)],['Cancel',()=>{}]])}return}
if(e.button===2){
 if(!hits.length){const only=examineHit||decorationHit;if(!only){if(walkHere)menuAt(e.clientX,e.clientY,[['Cancel',()=>{}]]);else closeMenu();return}const a=only.object.userData,walkTo=hitGround?point.clone():null;menuAt(e.clientX,e.clientY,[...(walkTo?[['Walk here',()=>{closeDialog();action=null;pendingPickup=null;markClick(e.clientX,e.clientY,'walk');void setWalkDestination(walkTo)}]]:[]),['Examine '+examineName(a),()=>say(examineText(a))],['Cancel',()=>{}]]);return;}
 const choices=[];
 if(hits[0].object.userData.kind==='npc'){const a=hits[0].object.userData,p=a.profile,name=npcDisplayName(p);for(const o of npcMenuOptions(p))choices.push([o.action==='examine'?o.prefix+name:actorMenuLabel({prefix:o.prefix,name,level:null,playerLevel:combatLevel(state)}),o.action==='examine'?()=>say(name+' — '+p.role+' · Combat '+p.level+' · '+p.hp+' / '+(p.maxHp||p.hp)+' HP'):()=>{walkToNpc(a,o.action);markClick(e.clientX,e.clientY,'interact')}])}
 else if(hits.length){const a=hits[0].object.userData;choices.push([a.kind==='creature'?actorMenuLabel({prefix:'Attack ',name:a.mob.name,level:a.mob.config?.level||1,playerLevel:combatLevel(state)}):a.kind==='npc'?actorMenuLabel({prefix:'Talk to ',name:a.profile.name,level:a.profile.level||1,playerLevel:combatLevel(state)}):a.kind==='merchant'?(a.station==='market'?'Browse market stall':actorMenuLabel({prefix:'Trade with ',name:'Traveling merchant',level:5,playerLevel:combatLevel(state)})):a.kind==='altar'?'Pray at altar':a.kind==='hearth'?'Cook at '+(a.name||'the range'):a.kind==='castleGate'?'Open / close great gate':a.kind==='fishing'?'Fish here':a.kind==='chest'?'Open armory chest':a.kind==='door'?(a.house.open?'Close door':'Open door'):'Gather '+a.kind,()=>{action=a;const goal=a.kind==='creature'?a.mob.root.position.clone():a.kind==='npc'?a.root.position.clone():a.kind==='door'?housePoint(a.house,0,2.4):a.kind==='castleGate'?new T.Vector3(a.x,0,a.z+(player.position.z>a.z?4:-4)):new T.Vector3(a.x,0,a.z);setWalkDestination(goal);followActionTarget(a);markClick(e.clientX,e.clientY,'interact')}]);choices.push(['Examine '+(a.kind==='creature'?a.mob.name:a.kind==='npc'?a.profile.name:a.kind==='merchant'?'Traveling merchant':a.kind),()=>say(a.kind==='creature'?a.mob.name+' · Combat '+(a.mob.config?.level||1)+' · '+Math.max(0,a.mob.hp)+' / '+a.mob.maxHp+' HP':a.kind==='npc'?a.profile.name+' — '+a.profile.role+' · Combat '+a.profile.level+' · '+a.profile.hp+' / '+(a.profile.maxHp||a.profile.hp)+' HP':a.kind==='merchant'?'Traveling merchant · Combat 5 · 45 / 45 HP. Buys logs and ore.':a.kind==='chest'?'A chest of iron adventuring supplies.':a.kind==='door'?'A wooden door. Click to open or close.':(Date.parse(a.availableAt)>(window.eldervaleServerTime?.()||Date.now())?'This '+a.kind+' is recovering.':'A harvestable '+a.kind+'.'))])}
 choices.push(['Cancel',()=>{}]);menuAt(e.clientX,e.clientY,choices);return;
}
if(hits.length&&hits[0].object.userData.kind==='npc'){walkToNpc(hits[0].object.userData,'talk')}else if(hits.length){npcIntent=null;action=hits[0].object.userData;const goal=action.kind==='creature'?action.mob.root.position.clone():action.kind==='npc'?action.root.position.clone():action.kind==='door'?housePoint(action.house,0,2.4):action.kind==='castleGate'?new T.Vector3(action.x,0,action.z+(player.position.z>action.z?4:-4)):new T.Vector3(action.x,0,action.z);setWalkDestination(goal);followActionTarget(action);if(action.kind!=='npc')say(action.kind==='merchant'?'Walking to merchant...':'Approaching '+action.kind+'...')}else if(hitGround){closeDialog();closeMenu();action=null;pendingPickup=null;void setWalkDestination(point.clone())}});
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
 water.position.y=.035;water.userData.terrainFixed=true;scene.add(water);waterSystem.add(water,{flow:river.points});
}
for(const bridge of landscape.bridges){
 const group=new T.Group();group.position.set(bridge.x,0,bridge.z);group.rotation.y=bridge.yaw;group.userData.terrainFixed=true;scene.add(group);
 const rows=Math.ceil(bridge.length/.45),deck=new T.PlaneGeometry(bridge.width,bridge.length,1,rows);deck.rotateX(-Math.PI/2);const pos=deck.attributes.position;
 for(let i=0;i<pos.count;i++)pos.setY(i,.08+.16*(1-T.MathUtils.smoothstep(Math.abs(pos.getZ(i)),bridge.length/2-2,bridge.length/2))+.012);
 for(let i=0;i<pos.count;i++)deck.attributes.uv.setXY(i,pos.getZ(i)/3,pos.getX(i)/2);deck.computeVertexNormals();const deckMesh=new T.Mesh(deck,material(0x786044,'wood'));deckMesh.receiveShadow=true;group.add(deckMesh);walkSurfaces.push(deckMesh);
 for(const side of [-1,1]){
  for(let i=0;i<=4;i++)box(.16,1.3,.16,0x554533,side*(bridge.width/2-.12),.7,(i/4-.5)*(bridge.length-2),group,'wood');
  box(.14,.14,bridge.length-2,0x9b7b4d,side*(bridge.width/2-.12),1.25,0,group,'wood');
 }
}
// Shared world clock follows America/New_York civil time, including DST.
// All clients use the same named zone regardless of their device time zone.
const easternClock=new Intl.DateTimeFormat('en-US',{timeZone:'America/New_York',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'});
const worldClock=document.createElement('output');worldClock.id='world-clock';worldClock.style.cssText='position:fixed;top:8px;left:50%;transform:translateX(-50%);z-index:36;pointer-events:none;background:#12202bc9;color:#e7d1a5;border:1px solid #927b56;border-radius:5px;padding:5px 9px;font:11px Arial';document.body.append(worldClock);
let nextSkyUpdate=0,skyHour=12,skyDaylight=1;const cameraWorldOccluders=new Set(),waterAnimationRoots=new Set();
const naturalSky=createNaturalSky(T,scene);
const wildlife=createWildlife(T,scene,landscape,{seed:generatedWorld?.seed||2419,canPlace:(x,z)=>!window.eldervaleSurfaceCover?.(x,z)&&!window.eldervaleCastleCollision?.(x,z)});
const meadow=createMeadow(T,scene,landscape,{seed:generatedWorld?.seed||2419,count:navigator.maxTouchPoints?9000:18000,canPlant:(x,z)=>!onBridge(landscape.bridges,x,z)&&!window.eldervaleSurfaceCover?.(x,z)&&(generatedWorld||landscape.heightAt(x,z)<35)&&distanceToRoad(x,z)>3&&landscape.canWalk(x,z)&&!window.eldervalePropCollision?.(x,z)&&!window.eldervaleCastleCollision?.(x,z)&&!houseInteriors.some(h=>{const p=h.group.worldToLocal(new T.Vector3(x,h.group.position.y,z));return Math.abs(p.x)<2.3&&Math.abs(p.z)<2.15})});
const groundDressing=createGroundDressing(T,scene,landscape,{seed:generatedWorld?.seed||2419,canPlant:(x,z)=>!onBridge(landscape.bridges,x,z,1.2)&&!window.eldervaleSurfaceCover?.(x,z,1.2)&&distanceToRoad(x,z)>4.5&&landscape.canWalk(x,z)&&!window.eldervalePropCollision?.(x,z)&&!window.eldervaleCastleCollision?.(x,z)});
window.eldervaleSceneryStatus=()=>({grass:meadow.meshes.filter(m=>m.visible).reduce((n,m)=>n+m.count,0),grassBusy:meadow.busy,detailBusy:groundDressing.busy});
window.eldervalePrepareScenery=async()=>{const ticket=areaLoading.begin('Preparing nearby scenery…');try{meadow.invalidate();meadow.update(player.position,performance.now());wildlife.update(player.position,window.eldervaleServerTime?.()||Date.now(),skyDaylight);groundDressing.update(player.position);while(meadow.busy||groundDressing.busy)await new Promise(requestAnimationFrame);}finally{ticket.end()}};

function drapeRoads(){for(const object of scene.children){if(!object.userData.drape||!object.geometry)continue;const source=object.userData.drapeSource??=object.geometry.clone(),offset=object.userData.drapeOffset??=object.position.y+.02;object.geometry.dispose();object.geometry=drapedGeometry(T,landscape,source,object.position,offset);}}

function updateWorldSky(){
 const now=window.eldervaleServerTime?.()||Date.now();if(now<nextSkyUpdate)return;nextSkyUpdate=now+1500;
 const parts=Object.fromEntries(easternClock.formatToParts(new Date(now)).filter(p=>p.type!=='literal').map(p=>[p.type,Number(p.value)]));
 const lockedHour=Number(window.eldervaleGameConfig?.timeOverride);// owner console › Economy › World clock
 const hour=window.eldervaleGameConfig?.timeOverride!=null&&Number.isFinite(lockedHour)?lockedHour%24:parts.hour+parts.minute/60+parts.second/3600;
 const dayPhase=hour/24;
 const solar=Math.sin((dayPhase-.25)*Math.PI*2);
 const daylight=Math.max(0,Math.min(1,(solar+.16)/.65));
 skyHour=hour;skyDaylight=daylight;
 const twilight=Math.max(0,1-Math.abs(solar)*3);
 const sky=new T.Color(0x26394f).lerp(new T.Color(0x94b9c8),daylight).lerp(new T.Color(0xb36a48),twilight*.24);
 scene.background.copy(sky);scene.fog.color.copy(sky);
 const lighting=lightingAt(daylight),celestial=celestialLight(T,hour);skyLight.intensity=lighting.hemisphere;skyLight.color.set(lighting.skyColor);skyLight.groundColor.set(lighting.groundColor);
 sun.intensity=lighting.directional*celestial.fade;renderer.toneMappingExposure=lighting.exposure;sun.color.set(lighting.sunColor);setCharacterRim(daylight);
 if(!sun.userData.direction?.equals(celestial.direction))sun.userData.direction=celestial.direction;
 const hh=String(parts.hour).padStart(2,'0'),mm=String(parts.minute).padStart(2,'0');
 worldClock.textContent='World (Eastern) '+hh+':'+mm+(daylight<.2?' · Night':daylight<.65?' · Dawn / dusk':' · Day');
 window.eldervaleWorldNight=daylight<.2;window.eldervaleDaylight=daylight;
 // The owner's classic default can arrive with a later snapshot.
 if(classicReady&&classicLook.enabled!==classicEnabled(clientSettings,window.eldervaleGameConfig))applyGraphics();classicLook.applySky(daylight,twilight);
 window.eldervaleSetTimeOfDay?.(hour,daylight);
}
const clock=new T.Clock();let lastAutosave=performance.now();
// Distance the avatar really moved since the previous frame, including the server-pose
// reconciliation that click-to-walk relies on (it runs before frameStart is captured).
// Jumps over 3 units are teleports/corrections, not steps.
let lastGaitPosition=null;function gaitTravel(position){const last=lastGaitPosition;lastGaitPosition=position.clone();if(!last)return 0;const moved=Math.hypot(position.x-last.x,position.z-last.z);return moved>3?0:moved}
// Small scenery, props and characters past the fog start are skipped by the
// main and shadow passes (see graphics-quality.js); large terrain, water, sky
// and instanced forests are never touched.
const cullBox=new T.Box3(),cullSphere=new T.Sphere();
// Trims (sills, eyes, hinges, lantern caps...) under 30 cm cast shadows a few
// texels wide but each costs a shadow-map draw call; drop them from the pass.
const casterScale=new T.Vector3();function pruneTinyCasters(root){root.updateMatrixWorld(true);root.traverse(m=>{if(!m.isMesh||!m.castShadow||!m.geometry)return;const g=m.geometry;if(!g.boundingSphere)g.computeBoundingSphere();m.getWorldScale(casterScale);if(g.boundingSphere.radius*Math.max(casterScale.x,casterScale.y,casterScale.z)<.3)m.castShadow=false})}
// Static town pieces (walls, towers, gates, lamps, stalls, benches...)
// merge across entities per 40 m cell and material (static-batch.js). Gate
// leaves stay separate so they still swing; upper-storey props are excluded.
const CELL_BATCH_TEMPLATES=new Set(['castle_wall','castle_tower','castle_gate','lantern','banner','market','bench','barrel','crate','well','stone_statue','flower_bed','hay_bale','wheelbarrow','fence','ruin']);
const cellBatchRoot=new T.Group();cellBatchRoot.name='cell-batches';scene.add(cellBatchRoot);
// Buildings join too, minus everything that changes at run time: LOD levels,
// the roof (hidden from inside), furnishings, doors, upper storeys and any
// mesh gameplay tags (click targets, walk surfaces, bank stands...).
const ownState=o=>{for(const k in o.userData)if(k!=='staticBatch'&&k!=='cellBatched')return true;return false};
const cellBatcher=createCellBatcher(T,cellBatchRoot,{skip:(o,root)=>o===root.userData.leftGate||o===root.userData.rightGate||o.isLOD||o.isPoints||root.userData.batchSkip?.has(o)||o.isMesh&&ownState(o)});let nextCellFlush=0;
classicLook.configure({hide:()=>[...meadow.meshes,...meadow.flowers,...scene.children.filter(o=>o.userData.environmentSky)]});classicReady=true;if(classicEnabled(clientSettings,window.eldervaleGameConfig))applyGraphics();
// Blob shadows under every drawn character (classic look only); one scratch record, no per-frame allocation.
const blobActor={root:null,radius:.5,hidden:false};
function* classicBlobActors(){const a=blobActor;a.root=player;a.radius=.5;a.hidden=false;yield a;for(const m of creatures){a.root=m.root;a.radius=blobRadius(m.config?.species);a.hidden=!!m.lodHidden;yield a}for(const n of npcs){a.root=n.root;a.radius=.5;a.hidden=!!n.lodHidden;yield a}for(const o of remotePlayers.values()){a.root=o.root;a.radius=.5;a.hidden=!!o.lodHidden;yield a}}
const distanceCuller=createDistanceCuller({radiusOf:o=>{pruneTinyCasters(o);cullBox.setFromObject(o);if(cullBox.isEmpty())return Infinity;cullBox.getBoundingSphere(cullSphere);return {radius:cullSphere.radius,center:cullSphere.center}},exclude:o=>o===player||o===ground||o.userData.characterLod||o.isLight||o.isCamera||o.isInstancedMesh||!o.visible||o===cellBatchRoot||o.userData.environmentSky||o.userData.waterSurface});
// Character level of detail (graphics-quality.js characterLod): far NPCs,
// monsters and players animate at a reduced rate, and past the tier's draw
// distance they move to the hidden layer, so neither the camera nor the
// shadow pass draws or skins them and their name tags hide too.
let lodFrame=0;
const shadowCasters=new WeakMap();
// A hidden character also stops its world-matrix walk (about 70 bones and a
// dozen meshes per humanoid, every frame, even while it wanders far away).
function setCharacterLodLayer(actor,root,hidden){actor.lodHidden=hidden;root.traverse(o=>o.layers.set(hidden?HIDDEN_LAYER:0));if(root.matrixWorldAutoUpdate===hidden){root.matrixWorldAutoUpdate=!hidden;if(!hidden)root.updateMatrixWorld(true)}}
// Shadow casting follows the LOD; each mesh's own setting is remembered (tiny
// trims such as eyes never cast, see pruneTinyCasters).
const FACE_DETAIL=/^(Eyes|Eyebrows)$/;
function setCharacterShadows(actor,root,cast){actor.lodShadow=cast;root.traverse(o=>{if(!o.isMesh)return;if(!shadowCasters.has(o))shadowCasters.set(o,o.castShadow&&!FACE_DETAIL.test(o.name));o.castShadow=cast&&shadowCasters.get(o)})}
// Eyes and eyebrows are a few pixels past the full-detail range: two draw calls saved per character.
function setCharacterFace(actor,root,show){actor.lodFace=show;root.traverse(o=>{if(o.isSkinnedMesh&&FACE_DETAIL.test(o.name))o.layers.set(show?0:HIDDEN_LAYER)})}
function actorLod(actor,root,focus){if(!root.userData.characterLod){root.userData.characterLod=true;pruneTinyCasters(root)}
 const lod=characterLod(root.position.distanceTo(camera.position),lodPreset,{focus,hidden:actor.lodHidden===true});const hidden=!lod.draw,shadow=lod.shadow&&renderer.shadowMap.enabled;
 // Re-apply now and then: gear and outfit parts can be attached later.
 const refresh=lodFrame%30===0;
 if(actor.lodHidden!==hidden||hidden&&refresh){setCharacterLodLayer(actor,root,hidden);actor.lodFace=undefined}
 if(!hidden&&(actor.lodShadow!==shadow||!shadow&&refresh))setCharacterShadows(actor,root,shadow);
 const face=lod.level===0;if(!hidden&&(actor.lodFace!==face||!face&&refresh))setCharacterFace(actor,root,face);actor.lod=lod}
function updateCharacterLod(){lodFrame++;const target=combatTurns.target;
 for(const mob of creatures)actorLod(mob,mob.root,mob===target||action?.mob===mob);
 for(const npc of npcs)actorLod(npc,npc.root,conversation?.profile===npc.profile||target===npc||action?.root===npc.root);
 for(const other of remotePlayers.values())actorLod(other,other.root,false)}
// Advances an actor's animation at its LOD rate. Travel since its last update
// is carried over so walk cycles keep pace with the ground they cover.
// A server-driven walker can show a still frame between snapshots (a late
// reply, a tick that did not move it); holdGait keeps the walk cycle running
// through such short gaps instead of snapping walk -> idle -> walk.
function lodAnimate(actor,dt,distance,update){if(actor.lodHidden){actor.lodTravel=0;actor.gaitHold=0;return}actor.lodTravel=(actor.lodTravel||0)+distance;const step=lodStep(actor,dt,actor.lod?.interval||0,actor.lodPhase??=Math.random());if(!step)return;const travelled=actor.lodTravel;actor.lodTravel=0;const gait=holdGait(actor,step,travelled);update(step,gait.distance,gait.speed)}
// Death of a server-driven monster: true while its death plays, false when
// alive, null once it should be hidden. Humanoid models collapse through their
// animator (dead); other bodies (beasts, dragons) topple onto their side.
const DEATH_SHOW_MS=2800;
function deathPose(mob){if(mob.alive!==false||!mob.dyingSince){if(mob.toppled){mob.toppled=false;const body=mob.root.userData.deathBody;if(body){body.rotation.z=0;body.position.y=0}}return mob.alive===false&&!mob.root.visible?null:false}
 const t=(performance.now()-mob.dyingSince)/1000;if(t*1000>=DEATH_SHOW_MS){mob.root.visible=false;mob.dyingSince=0;return null}
 if(!mob.model?.humanoid){let body=mob.root.userData.deathBody;if(body===undefined){body=mob.root.children.find(c=>c.isGroup&&!c.userData.healthBar)||null;mob.root.userData.deathBody=body}if(body){const f=Math.min(1,t/.6);body.rotation.z=f*f*1.35;body.position.y=-.05*f;mob.toppled=true}}
 return true}
// Per-frame scratch values: the frame loop allocates no vectors for these.
const authScreen=document.querySelector('#auth-screen'),frameStartScratch=new T.Vector3(),actorBefore=new T.Vector3(),cameraEye=new T.Vector3(),cameraVector=new T.Vector3(),combatBars=[];let cameraWalls=[],nextCameraWalls=0;
function frame(){requestAnimationFrame(frame);if(!authScreen.hidden||window.eldervaleWorldLoading===true)return;updateWorldSky();updateCoordinateHUD();const elapsed=clock.getDelta();governFrame(elapsed);if(document.body.classList.contains('landscape-required'))return;const dt=Math.min(elapsed,.1),movementDt=movementTime(elapsed);fpsSamples++;fpsSeconds+=elapsed;if(fpsSeconds>=1){if(clientSettings.fps)document.querySelector('#fps-counter').textContent=Math.round(fpsSamples/fpsSeconds)+' FPS';fpsSamples=0;fpsSeconds=0}if(window.eldervaleAuthority&&realmPoseJump&&realmPlayerPose){reconcileLocalPose(player.position,realmPlayerPose,dt,{teleport:true});player.rotation.y=realmPlayerPose.yaw;cameraFocus=null;cameraObstructionDistance=null;realmPoseJump=false;}const manual=mmoControls.update(movementDt,performance.now());const cameraKeys=mmoControls.cameraAxes();if(cameraKeys.yaw||cameraKeys.pitch){yaw+=cameraKeys.yaw*CAMERA_TURN_RATE*dt;pitch=T.MathUtils.clamp(pitch+cameraKeys.pitch*CAMERA_PITCH_RATE*dt,-.10,1.15);lastCameraDrag=performance.now()}updateCompassTurn(dt);const presentedPose=window.eldervaleAuthority&&realmPlayerPose?{...realmPlayerPose,...presentPose(realmPlayerPose,window.eldervaleServerTime?.()||Date.now())}:null;if(window.eldervaleAuthority&&reconcileLocalPose(player.position,presentedPose,elapsed,{active:!!manual,pending:!!(window.eldervaleRealm?.steerPending?window.eldervaleRealm.steerPending():window.eldervaleRealm?.movementPending())})&&!realmInCombat)player.rotation.y=presentedPose.moving||!realmPlayerPose.moving?presentedPose.yaw:player.rotation.y;const frameStart=frameStartScratch.copy(player.position);
if(manual){player.rotation.y=manual.yaw;if(!window.eldervaleAuthority||performance.now()-lastMovementAck<1500){const step=new T.Vector3(player.position.x+manual.x*mountSpeed(mounted,running)*movementDt,player.position.y,player.position.z+manual.z*mountSpeed(mounted,running)*movementDt);const resolved=slideStep(player.position,step,(a,b)=>!walkAllowed(a,b).blocked);player.position.set(resolved.x,resolved.y,resolved.z);if(window.eldervaleAuthority)reconcileActivePose(player.position,realmPlayerPose,manual,movementDt,(window.eldervaleServerTime?.()||Date.now())+(window.eldervaleRealm?.predictionLead?.()||0),{canStep:(a,b)=>!walkAllowed(a,b).blocked});}}
if(!window.eldervaleAuthority&&action?.kind==='creature'&&action.mob?.alive&&player.position.distanceTo(action.mob.root.position)<weaponStats(state.equippedWeapon).reach){dest=null;walkQueue=[];faceTarget(player,action.mob.root.position);strike(action.mob)}
if(!window.eldervaleAuthority&&dest){const delta=dest.clone().sub(player.position);delta.y=0;const distance=delta.length();if(distance>(action?.kind==='creature'?weaponStats(state.equippedWeapon).reach*.88:action?2.1:.2)){delta.normalize();const proposed=player.position.clone().addScaledVector(delta,Math.min(mountSpeed(mounted,running)*dt,distance));
 const collision=walkAllowed(player.position,proposed);
 if(!collision.blocked)player.position.copy(proposed);
 else{dest=null;walkQueue=[];action=null;if(collision.house&&!collision.house.open)say('Door closed — click the door to open it.');else say('A building blocks the way. Walk around it.')}
 player.rotation.y=Math.atan2(delta.x,delta.z)}else{dest=null;if(walkQueue.length){dest=walkQueue.shift();}else if(action){const a=action;action=null;if(a.kind==='door'){toggleHouseDoor(a.house)}else if(a.kind==='creature'){if(a.mob.alive){strike(a.mob);if(a.mob.alive){action=a;dest=a.mob.root.position.clone()}}}else if(a.kind==='npc'){talkTo(a.profile)}else if(a.kind==='chest'){openArmoryChest()}else if(a.kind==='merchant'){services.open('shop','Traveling merchant');}else if(a.kind==='worldObject'){say('A world decoration.')}else if(state.wood+state.ore+state.armorOwned.filter(k=>!state.equipped[k]).length>=INVENTORY_SLOTS)say('Inventory full! Visit the merchant.');else if(a.kind==='tree'){state.wood++;const gained=gatheringXP(state,'woodXP');state.woodXP+=gained;say('You chop logs. +'+gained+' XP')}else{state.ore++;const gained=gatheringXP(state,'miningXP');state.miningXP+=gained;say('You mine ore. +'+gained+' XP')}save();draw()}}}
combat.attackTimer=Math.max(0,combat.attackTimer-dt);combat.attackAnim=Math.max(0,combat.attackAnim-dt);combat.eatAnim=Math.max(0,(combat.eatAnim||0)-dt);combat.hitAnim=Math.max(0,combat.hitAnim-dt);combat.blockAnim=Math.max(0,combat.blockAnim-dt);combat.stanceTimer=Math.max(0,combat.stanceTimer-dt);playerHUD.health(combat.hp,combat.maxHp);
updateCharacterLod();for(const mob of creatures){if(window.eldervaleAuthority){const dying=deathPose(mob);if(dying===null)continue;const before=actorBefore.copy(mob.root.position);if(!dying)interpolateRealm(mob,dt);mob.attackAnim=Math.max(0,(mob.attackAnim||0)-dt);mob.blockAnim=Math.max(0,(mob.blockAnim||0)-dt);mob.hitAnim=Math.max(0,(mob.hitAnim||0)-dt);lodAnimate(mob,dt,dying?0:mob.root.position.distanceTo(before),(step,distance,speed)=>mob.model?.update(step,{distance,speed,attack:dying?0:mob.attackAnim,block:dying?0:mob.blockAnim,hit:dying?0:mob.hitAnim,dead:dying}));continue}const mobBefore=actorBefore.copy(mob.root.position);mob.attackAnim=Math.max(0,(mob.attackAnim||0)-dt);mob.blockAnim=Math.max(0,(mob.blockAnim||0)-dt);mob.hitAnim=Math.max(0,(mob.hitAnim||0)-dt);mob.root.rotation.x=mob.attackAnim>0?-Math.sin((1-mob.attackAnim/.55)*Math.PI)*.15:0;mob.root.rotation.z=mob.blockAnim>0?.12:mob.hitAnim>0?-.10:0;if(!mob.alive){mob.respawn-=dt;if(mob.respawn<=0){mob.alive=true;mob.hp=mob.maxHp;mob.root.position.copy(mob.home);mob.root.visible=true}continue}mob.attackCooldown=Math.max(0,mob.attackCooldown-dt);mob.wait-=dt;if(mob.wait<=0){const a=mob.root.position.x*.12+performance.now()*.0002;mob.goal.set(mob.home.x+Math.cos(a)*(mob.config?.roam??5),0,mob.home.z+Math.sin(a)*(mob.config?.roam??5));mob.wait=3+Math.random()*5}const distance=mob.root.position.distanceTo(player.position);if((mob.hostile||combatTurns.target===mob)&&distance<10){mob.goal.copy(player.position);if(distance<2.5&&!combatTurns.target&&!services.isOpen){combatRng=Math.random;combatTurns.engage(mob,true)}}const meleeDistance=Math.min(1.85,weaponStats(state.equippedWeapon).reach*.9),delta=mob.goal.clone().sub(mob.root.position);delta.y=0;if(delta.length()>((mob.hostile||combatTurns.target===mob)&&distance<10?meleeDistance:.4)){delta.normalize();const step=Math.min(dt*((mob.hostile||combatTurns.target===mob)&&distance<10?1.7:.8),Math.max(0,distance-meleeDistance));const proposed=mob.root.position.clone().addScaledVector(delta,step);if(proposed.distanceToSquared(player.position)>=1.45*1.45&&!walkAllowed(mob.root.position,proposed).blocked)mob.root.position.copy(proposed);mob.root.rotation.y=Math.atan2(delta.x,delta.z)}if((mob.hostile||combatTurns.target===mob)&&distance<10)faceTarget(mob.root,player.position);if(action?.kind==='creature'&&action.mob===mob&&dest){const toward=player.position.clone().sub(mob.root.position);toward.y=0;toward.normalize();dest.copy(mob.root.position).addScaledVector(toward,weaponStats(state.equippedWeapon).reach*.85)}lodAnimate(mob,dt,mob.root.position.distanceTo(mobBefore),(step,distance,speed)=>mob.model?.update(step,{distance,speed,attack:mob.attackAnim,hit:mob.hitAnim,block:mob.blockAnim}))}
if(!window.eldervaleAuthority&&combatTurns.target){const target=combatTurns.target;combat.stanceTimer=3;const range=combatTurns.side==='player'?weaponStats(combatTurns.phase==='ready'?state.equippedWeapon:swingWeapon||state.equippedWeapon).reach:2.5;combatTurns.tick(dt,{inRange:player.position.distanceTo(target.root.position)<=range,playerAlive:combat.hp>0})}
ensureTownResidents();
for(const npc of npcs){
 npc.root.visible=npc.alive!==false&&!npc.deleted&&npc.root.position.distanceToSquared(player.position)<85*85;
 if(!npc.root.visible||npc.deleted)continue;if(window.eldervaleAuthority){const before=actorBefore.copy(npc.root.position);interpolateRealm(npc,dt);const distance=npc.root.position.distanceTo(before);npc.travelHold=distance>.001?.35:Math.max(0,(npc.travelHold||0)-dt);npc.previewAttack=Math.max(0,(npc.previewAttack||0)-dt);npc.blockAnim=Math.max(0,(npc.blockAnim||0)-dt);const working=!npc.root.userData.armed&&!npc.previewAttack&&!npc.blockAnim&&conversation?.profile!==npc.profile;if(npc.workProp)npc.workProp.visible=working;if(!working&&npc.rig.work)npc.rig.work.yaw=null;lodAnimate(npc,dt,distance,(step,travelled,speed)=>{npc.animator.update(step,{distance:travelled,speed,attack:npc.previewAttack,block:npc.blockAnim||0,locomotion:npc.previewAttack>0?'combat':'walk',weapon:npc.profile.weapon,armed:!!npc.root.userData.armed});npc.attackEffect?.update(npc.previewAttack);if(working)animateTownActivity(npc.rig,npc.profile.activity,performance.now()*.001+npc.phase,distance>.001||(npc.travelHold||0)>0)});continue}
 if(npc.workProp)npc.workProp.visible=!npc.root.userData.armed&&!npc.previewAttack&&!npc.blockAnim&&conversation?.profile!==npc.profile;
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
 npc.previewAttack=Math.max(0,(npc.previewAttack||0)-dt);lodAnimate(npc,dt,actualDistance,(step,travelled,speed)=>{npc.animator.update(step,{distance:travelled,speed,armed:!!npc.root.userData.armed,attack:npc.previewAttack,weapon:npc.profile.weapon});
 npc.attackEffect?.update(npc.previewAttack);if(!npc.root.userData.armed&&!npc.previewAttack&&!npc.blockAnim&&conversation?.profile!==npc.profile)animateTownActivity(npc.rig,npc.profile.activity,performance.now()*.001+npc.phase,actualDistance>.0001)});
 if(action?.kind==='npc'&&action.root===npc.root&&dest)dest.copy(npc.root.position);
}
player.position.y=landscape.walkHeight(player.position.x,player.position.z)+floorOffset(currentInterior.floor,player.position.x,player.position.z)+jumpHeight(localJumpAt,window.eldervaleServerTime?.()||Date.now());
for(const npc of npcs)if(npc.root.visible)npc.root.position.y=landscape.walkHeight(npc.root.position.x,npc.root.position.z)+floorOffset(npc.serverPose?.data?.floor||npc.profile?.floor||0,npc.root.position.x,npc.root.position.z);
for(const mob of creatures)mob.root.position.y=landscape.walkHeight(mob.root.position.x,mob.root.position.z)+floorOffset(mob.serverPose?.data?.floor||mob.config?.floor||0,mob.root.position.x,mob.root.position.z);
if(!dest&&!walkQueue.length&&!realmPlayerPose?.moving)mapDestination=null;
updatePendingArrival();updateFollow();if(services.isOpen&&serviceOutOfReach(serviceAnchor,player.position)){services.close();serviceAnchor=null}if(walkFlagState&&flagExpired(walkFlagState,player.position,{moving:window.eldervaleAuthority?!!realmPlayerPose?.moving:!!dest,pending:routePending,now:performance.now()}))hideWalkFlag();
const traveled=Math.hypot(player.position.x-frameStart.x,player.position.z-frameStart.z);
if(!window.eldervaleAuthority&&!mounted){const energyStep=stepEnergy(state.runEnergy,running,traveled>.001,dt);state.runEnergy=energyStep.energy;running=energyStep.running;if(energyStep.exhausted)say('You are out of energy and slow to a walk.')}updateRunButton();
if(!window.eldervaleAuthority)mounted=!!state.equippedMount&&mountAllowed(player.position.x,player.position.z,persistentRows.values());
const gaitDistance=window.eldervaleAuthority?(manual?.moving?mountSpeed(mounted,running)*Math.min(1,Math.hypot(manual.x,manual.z))*movementDt:gaitTravel(player.position)):locomotionDistance(traveled,manual,mountSpeed(mounted,running),dt);
const fighting=!!(window.eldervaleAuthority?realmInCombat:combatTurns.target||action?.kind==='creature');deathFlow.update();const pose=playerAnimator.update(dt,{dead:deathFlow.dying(),combat:fighting||stancePreference==='combat',locomotion:running?'jog':fighting?'combat':'walk',style:attackStyle,weapon:state.equippedWeapon,block:combat.blockAnim,distance:mounted?0:gaitDistance,speed:mounted?0:gaitDistance/Math.max(dt,.001),attack:combat.attackAnim,hit:combat.hitAnim,eat:combat.eatAnim||0,food:goods[combat.eatItem],twoHanded:isTwoHanded(state.equippedWeapon),shield:!!state.equippedShield,armed:!!state.equippedWeapon,ranged:isRanged(state.equippedWeapon),magic:isMagic(state.equippedWeapon),airborne:!mounted&&isAirborne(localJumpAt,window.eldervaleServerTime?.()||Date.now())});
if(pose?.released&&combat.arrowTarget){launch(avatar,state.equippedWeapon,combat.arrowTarget);combat.arrowTarget=null}arrows.update(dt);
body.rotation.y=combat.attackAnim>0?Math.sin((1-combat.attackAnim/.55)*Math.PI)*-.15:T.MathUtils.lerp(body.rotation.y,0,1-Math.exp(-10*dt));
body.rotation.z=combat.hitAnim>0?Math.sin((1-combat.hitAnim/.35)*Math.PI)*.12:T.MathUtils.lerp(body.rotation.z,0,1-Math.exp(-12*dt));
body.position.y=0;if(!mounted)groundFeet(avatar,body,pose?.contacts);playerHorse.update({active:mounted,distance:gaitDistance,rig:avatar,visual:body,groundHeight:landscape.walkHeight});merchantAnimator.update(dt);
for(const [id,other] of remotePlayers){
 const before=actorBefore.copy(other.root.position);
 if(window.eldervaleAuthority&&other.motion){const sample=other.motion.sample();if(sample){other.root.position.x=sample.x;other.root.position.z=sample.z;other.root.rotation.y=sample.yaw}}else other.root.position.lerp(other.target,1-Math.exp(-12*dt));other.root.position.y=landscape.walkHeight(other.root.position.x,other.root.position.z)+floorOffset(playerFloorMap[id]||0,other.root.position.x,other.root.position.z)+jumpHeight(other.jumpAt,window.eldervaleServerTime?.()||Date.now());
 const delta=Math.atan2(Math.sin(other.yaw-other.root.rotation.y),Math.cos(other.yaw-other.root.rotation.y));
 if(!window.eldervaleAuthority)other.root.rotation.y+=delta*(1-Math.exp(-12*dt));
 const distance=before.distanceTo(other.root.position);
 const gaitDistance=other.moveIntent?Math.max(distance,mountSpeed(other.mounted,other.running)*dt):distance;
 other.attackAnim=Math.max(0,(other.attackAnim||0)-dt);other.blockAnim=Math.max(0,(other.blockAnim||0)-dt);other.eatAnim=Math.max(0,(other.eatAnim||0)-dt);lodAnimate(other,dt,gaitDistance,(step,travelled,speed)=>{const otherPose=other.animator.update(step,{dead:other.hp===0||deathFlow.remoteDying(id),eat:other.eatAnim,food:goods[other.eatItem],mounted:other.mounted,locomotion:other.running?'jog':other.attackAnim>0||other.blockAnim>0?'combat':'walk',style:other.attackStyle,attack:other.attackAnim,block:other.blockAnim,distance:other.mounted?0:travelled,speed:other.mounted?0:speed,airborne:!other.mounted&&isAirborne(other.jumpAt,window.eldervaleServerTime?.()||Date.now())});if(otherPose?.released&&other.arrowTarget){launch(other.animator.rig,other.animator.data.loadout.weapon,other.arrowTarget);other.arrowTarget=null}other.animator.visual.position.y=0;if(!other.mounted)groundFeet(other.animator.rig,other.animator.visual)});other.horse.update({active:other.mounted,distance:gaitDistance,rig:other.animator.rig,visual:other.animator.visual,groundHeight:landscape.walkHeight});if(other.mounted)other.animator.updateCape?.(dt,distance>.001?1:0,{mounted:true,mountRoot:other.horse.root});
}
levelFireworks.update(dt);gatheringVisuals.update(window.eldervaleServerTime?.()||Date.now());professionVisuals.update(window.eldervaleServerTime?.()||Date.now());cape.update(dt,pose?.blend||0,{mounted,mountRoot:playerHorse.root});for(const [id,until]of depletedTrees)if(Date.parse(until)<=(window.eldervaleServerTime?.()||Date.now()))setTreeDepleted(id,false);
updateHouseRoofs();updateHouseInteriors(performance.now());if(!cameraFocus){cameraFocus=player.position.clone();yaw=player.rotation.y+Math.PI;}if(cameraFocus.distanceToSquared(player.position)>100)cameraFocus.copy(player.position);else cameraFocus.lerp(player.position,1-Math.exp(-10*elapsed));const focus=cameraFocus;stabilizeSun(T,sun,focus,shadowAhead.set(-Math.sin(yaw),0,-Math.cos(yaw)).multiplyScalar(sun.shadow.camera.right*.35));if(renderer.shadowMap.enabled&&performance.now()>=nextShadowRefresh){sun.shadow.needsUpdate=true;nextShadowRefresh=performance.now()+shadowRefresh;}camera.position.set(focus.x+Math.sin(yaw)*zoom*Math.cos(pitch),focus.y+(mounted?2.45:1.75)+zoom*Math.sin(pitch),focus.z+Math.cos(yaw)*zoom*Math.cos(pitch));const neededLift=terrainCameraClearance(landscape.heightAt,focus,camera.position,.35);terrainCameraLift=Math.max(neededLift,Math.max(0,terrainCameraLift||0)*Math.exp(-6*elapsed));camera.position.y+=terrainCameraLift;const eye=cameraEye.set(focus.x,focus.y+1.5,focus.z);cameraVector.copy(camera.position).sub(eye);const cameraDistance=cameraVector.length();cameraWallRay.set(eye,cameraVector.normalize());cameraWallRay.far=cameraDistance;if(performance.now()>=nextCameraWalls){nextCameraWalls=performance.now()+200;const wallRoots=[];for(const root of cameraWorldOccluders)if(Math.hypot(root.position.x-player.position.x,root.position.z-player.position.z)<45)wallRoots.push(root);for(const h of houseInteriors)if(h.group.position.distanceToSquared(player.position)<1600)wallRoots.push(h.group);cameraWalls=collectCameraOccluders(wallRoots)}const walls=cameraWalls;const obstruction=cameraWallRay.intersectObjects(walls,false)[0];cameraObstructionDistance=obstructionDistance(cameraObstructionDistance,obstruction?obstruction.distance-.3:cameraDistance,cameraDistance,dt);camera.position.copy(eye).addScaledVector(cameraVector,cameraObstructionDistance);camera.lookAt(focus.x,focus.y+(mounted?2.05:1.35),focus.z);window.eldervaleTutorial?.frame(camera);signsSystem().frame(camera);questUiRef?.markers.frame(camera);questUiRef?.trail.frame();if(performance.now()-lastAutosave>=4000){lastAutosave=performance.now();save()}for(const root of waterAnimationRoots)root.userData.animateWater(performance.now()*.001);for(const animateTown of townAnimations)animateTown(performance.now()*.001);for(const entry of worldInstances.values()){if(entry.house)continue;const d=entry.actor?.serverPose?.data||entry.actor?.profile||entry.actor?.config;const floor=d?.floor||entry.root.userData.storyFloor||0;entry.root.visible=floor===currentInterior.floor&&(!entry.actor||entry.root.position.distanceToSquared(player.position)<85*85)&&!entry.actor?.deleted&&entry.actor?.alive!==false&&!(entry.actor?.serverPose?.hp<=0);if(floor>0&&!entry.actor)entry.root.position.y=landscape.walkHeight(entry.root.position.x,entry.root.position.z)+floorOffset(floor,entry.root.position.x,entry.root.position.z);}for(const [id,other]of remotePlayers)other.root.visible=(playerFloorMap[id]||0)===currentInterior.floor;if(!classicLook.enabled)naturalSky.update(camera,performance.now(),skyHour,skyDaylight,sun.userData.direction);if(!classicLook.enabled||meadow.busy)meadow.update(player.position,performance.now());wildlife.update(player.position,window.eldervaleServerTime?.()||Date.now(),skyDaylight);if(Math.floor(performance.now()/500)!==window._forestFrame){window._forestFrame=Math.floor(performance.now()/500);updateNaturalForest(forestBatches,player.position);groundDressing.update(player.position);}waterSystem.update(camera,performance.now(),skyDaylight,clientSettings.reducedMotion);cellBatchRoot.visible=currentInterior.floor===0;if(performance.now()>=nextCellFlush){nextCellFlush=performance.now()+250;cellBatcher.flush(performance.now())}distanceCuller.update(scene.children,camera.position,{fogNear:scene.fog.near,far:camera.far},performance.now());lightProxies.scan(performance.now());if(classicLook.enabled){classicLook.update(1.5);classicLook.updateBlobs(classicBlobActors())}renderer.render(scene,camera);hitNumbers.update(elapsed);groundDrops.expire(window.eldervaleServerTime?.()||Date.now());const bars=combatBars;bars.length=0;if(realmInCombat)bars.push({id:'self',root:player,hp:combat.hp,maxHp:combat.maxHp});for(const list of [npcs,creatures])for(const a of list)if(a.serverPose?.target||npcDuelIds?.has(a.realmId)||npcDuelIds?.has(a.profile?.worldEntityId)){bars.push({id:a.realmId||a.profile?.worldEntityId,root:a.root,hp:a.serverPose?.hp??a.hp,maxHp:a.serverPose?.data?.hp||a.maxHp||45,height:a.config?.species==='dragon'?3.8*(a.config.scale||1):3});}for(const [id,a]of remotePlayers)if(combatPlayerIds?.has(id))bars.push({id,root:a.root,hp:a.hp,maxHp:a.maxHp});combatHealth.update(bars);if(pendingPickup&&Math.hypot(player.position.x-pendingPickup.x,player.position.z-pendingPickup.z)<2.6){const id=pendingPickup.id;pendingPickup=null;void window.eldervaleRealm?.command('pickup_drop',{id});}dialoguePortrait.update(dt,clientSettings.reducedMotion);updateOverheadChat();if(Math.floor(performance.now()/250)!==window._mapFrame){window._mapFrame=Math.floor(performance.now()/250);refreshMinimapCache()}composeMinimap();}
drapeRoads();draw();say('Welcome to Eldervale!');frame();

// World editor rendering bridge. Authority and durable writes live in Postgres RPCs.
const worldInstances=new Map();
function removeWorldEntity(id){const entry=worldInstances.get(id);if(!entry)return;const actor=entry.actor;if(combatTurns.target===actor)combatTurns.cancel();if(action&&(action.root===entry.root||actor&&action.mob===actor)){action=null;dest=null;walkQueue=[]}if(actor&&conversation?.profile===actor.profile)closeDialog();
 for(let i=targets.length-1;i>=0;i--)if(targets[i].userData.worldEntityId===id)targets.splice(i,1);
 for(const list of [npcs,creatures]){const i=list.indexOf(actor);if(i>=0)list.splice(i,1)}
 landscape.removeFloor(id);for(let i=walkSurfaces.length-1;i>=0;i--){let parent=walkSurfaces[i];while(parent&&parent!==entry.root)parent=parent.parent;if(parent===entry.root)walkSurfaces.splice(i,1)}
 if(entry.house){const i=houseInteriors.indexOf(entry.house);if(i>=0)houseInteriors.splice(i,1)}
 waterAnimationRoots.delete(entry.root);cameraWorldOccluders.delete(entry.root);cellBatcher.remove(entry.root,performance.now());entry.root.removeFromParent();disposeEntityResources(entry.root);realmObjectTargets.delete(id);worldInstances.delete(id);
}
window.eldervaleWorldBridge={
 apply(rows){for(const row of rows){removeWorldEntity(row.id);if(row.deleted)continue;const d=row.data,base=worldTemplates[d.template];if(!base&&d.kind!=='item'){console.warn('Unknown world template',d.template);continue}const config={...base,...d};let root,actor,h;
  if(d.kind==='monster'||d.kind==='npc'&&d.attackable){actor=creature(d.name||base.name,d.x,d.z,!!d.hostile,config);root=actor.root}
  else if(d.kind==='npc'){
   const radius=d.roam||0,profile={...config,worldEntityId:row.id,x:d.x,z:d.z,name:d.name||base.name,color:config.color||0x8d7259,lines:dialogueLines(d.dialogue||base.dialogue),behavior:radius||d.route?'patrol':'stationary',patrol:d.route?.length>1?d.route.map(s=>[s.x,s.z]):[[d.x-radius,d.z],[d.x,d.z+radius],[d.x+radius,d.z],[d.x,d.z-radius]]};actor=spawnNPC(profile,npcs.length);actor.attackEffect=serviceAttackEffect(T,actor.rig,config.attackType);root=actor.root;
   if(config.weapon&&!root.userData.armed&&carriesWeapon(config)){attachWeapon(actor.rig,makeWeapon(T,config.weapon),config.weapon);root.userData.armed=true}
  }else if(['cottage','bank','inn','forge'].includes(d.template)){
   h=house(d.x,d.z,d.wallColor||0xc7bfa7,1.3*d.scale,d.yaw*Math.PI/180,{type:d.template==='cottage'?(d.room||'cottage'):d.template,name:d.name||base.name,builder:true,stories:d.stories||1,furnished:d.furnished!==false,stone:!!d.stone,roof:d.roof,biome:d.biome});h.realmId=row.id;h.storyData=d;h.stories=addBuildingStories(T,h,d,{box,decorate:decorateTownBuilding,material});h.stories.floors.slice(1).forEach(room=>room.traverse(o=>{if(o.isMesh&&o.geometry.type==='BoxGeometry'&&o.geometry.parameters.height===.085){o.userData.storyFloor=room.position.y/3;walkSurfaces.push(o)}}));root=h.group;batchHouse(h);collapseFacadeLod(h);tuneBuildingLod(root);root.userData.batchSkip=new Set([h.interior,h.doorPivot,h.doorHit,...h.roofParts,...h.stories.floors.slice(1),...h.stories.furnishings,...(h.bankStands||[])].filter(Boolean));landscape.registerFloor(row.id,{x:root.position.x,z:root.position.z,scaleX:root.scale.x,scaleZ:root.scale.z,rotation:root.rotation.y,floorHeight:.125*root.scale.y});
  }else{root=new T.Group();scene.add(root);root.position.set(d.x,landscape.walkHeight(d.x,d.z)+floorOffset(d.floor,d.x,d.z),d.z);{const base=propBase(landscape.heightAt,d);if(base!==null&&Math.abs(landscape.walkHeight(d.x,d.z)-landscape.heightAt(d.x,d.z))<.01)root.position.y=base}
   if(d.kind==='item'){const item=goods[d.item];if(!item){root.removeFromParent();continue}root.add(makeDroppedItemModel(T,d.item));root.position.y+=.025}
   else if(d.template==='plaza'){const mesh=new T.Mesh(new T.CircleGeometry(8,48),material(0xa39d8b,'cobble'));mesh.rotation.x=-Math.PI/2;mesh.receiveShadow=true;root.add(mesh);root.userData.surface=true;}else if(d.template.startsWith('terrain_')||d.template==='road'){const color={terrain_grass:0x6b8557,terrain_sand:0xb6a270,terrain_stone:0x8b8b81,terrain_snow:0xd8e0db,road:0x9c8964}[d.template];const geometry=d.template==='road'?new T.PlaneGeometry(d.width||2.5,d.length||10,8,24):new T.RingGeometry(0,d.radius||10,40,10);geometry.rotateX(-Math.PI/2);for(let i=0;i<geometry.attributes.uv.count;i++)geometry.attributes.uv.setXY(i,geometry.attributes.position.getX(i)/3,geometry.attributes.position.getZ(i)/3);const mesh=new T.Mesh(geometry,d.paved?material(0xa29d90,'cobble'):material(color,d.template==='terrain_grass'?'grass':d.template==='terrain_stone'?'stone':'dirt'));mesh.receiveShadow=true;root.add(mesh);root.userData.surface=true;}else objectModel(T,root,d.template,{...d,groundHeight:landscape.heightAt});if(d.template==='fishing_spot')root.position.y=d.waterHeight??.06;
   const hit=new T.Mesh(new T.BoxGeometry(d.template==='castle_gate'?9:1.3,d.template==='castle_gate'?7:2,1.3),new T.MeshBasicMaterial({visible:false}));hit.position.y=d.template==='castle_gate'?3.5:1;root.add(hit);hit.userData={kind:professionStations[d.template]||['hearth','campfire','cooking_tripod','well','fountain'].includes(d.template)?'profession':d.kind==='item'?'worldItem':d.template==='fishing_spot'?'fishing':d.template==='castle_gate'?'castleGate':d.template==='altar'?'altar':d.template==='hearth'?'hearth':d.template==='market'?'merchant':d.template==='tree'||d.template==='pine'?'tree':d.template==='rock'?'rock':'worldObject',x:d.x,z:d.z,station:['hearth','campfire','cooking_tripod'].includes(d.template)?'cooking':['well','fountain'].includes(d.template)?'water':d.template,resource:d.resource};targets.push(hit);
  }
  if(root.userData.animateWater)waterAnimationRoots.add(root);if(['castle_wall','castle_tower','castle_gate'].includes(d.template))cameraWorldOccluders.add(root);if(actor)actor.realmId=row.id;if(!h)root.scale.multiplyScalar(d.scale||1);if(actor?.config)root.scale.setScalar(d.scale||1);root.rotation.y=d.yaw*Math.PI/180;root.traverse(o=>{if(targets.includes(o))o.userData.worldEntityId=row.id});root.userData.storyFloor=d.floor||0;root.userData.waterSource=d.template==='fountain';root.userData.lamp=d.template==='lantern';if(root.userData.surface){root.userData.surfaceData=d;root.userData.surfaceId=row.id;conformSurface(root)}worldInstances.set(row.id,{root,actor,house:h});if(classicLook.enabled)classicLook.convert(root);if(h||!actor&&CELL_BATCH_TEMPLATES.has(d.template)&&!(d.floor>0)&&!root.userData.animateWater)cellBatcher.add(root,performance.now());
 }},
 position:()=>({x:player.position.x,z:player.position.z,floor:currentInterior.floor,building:currentInterior.building,yaw:player.rotation.y*180/Math.PI}),
 teleport(x,z){if(window.eldervaleAuthority){say('Use the owner Teleport command.');return}combatTurns.cancel();dest=null;walkQueue=[];action=null;player.position.set(x,landscape.walkHeight(x,z),z);save()},
 preview(id){if(window.eldervaleAuthority){void window.eldervaleRealm?.command('preview',{target:id});return}const a=worldInstances.get(id)?.actor;if(a){a.previewAttack=.55;a.attackAnim=.55;say('Preview: '+(a.profile?.attackType||a.config?.attackType||'melee'))}},
 highlight(id){const e=worldInstances.get(id);if(e)markClick(e.root.position.x,e.root.position.z,'interact')},
 grant(delivery){if(window.eldervaleAuthority){void window.eldervaleRealm?.refresh();return}const receipts=state.worldReceipts;if(receipts.includes(delivery.id))return;
 const d=delivery.data;if(d.command==='teleport')this.teleport(Number(d.x),Number(d.z));else{const n=Math.max(1,Math.min(1000000,Math.floor(Number(d.amount)||1)));if(d.item==='gold')state.gold=Math.min(1e9,state.gold+n);else if(goods[d.item])state.bank[d.item]=goods[d.item].field?1:Math.min(1e9,(state.bank[d.item]||0)+n);else throw Error('Unknown delivered item');say('Owner delivery received'+(d.item==='gold'?'': ' in your bank')+'.')}
 receipts.push(delivery.id);state.worldReceipts=receipts;save();draw();
 },notice:text=>say(text),capture:()=>{captureSave();return JSON.parse(localStorage.getItem('eldervale-save'))}
};

// Stream persistent scenery/actors around the player rather than rendering the entire saved world.
// Programs differ when drawn into the water reflection target (linear output, no tone mapping): warm both variants.
let warmTarget=null;
function compileFor(root,reflection=false,target=scene){const prev=renderer.getRenderTarget(),tone=renderer.toneMapping;if(reflection){warmTarget??=new T.WebGLRenderTarget(4,4);renderer.setRenderTarget(warmTarget);renderer.toneMapping=T.NoToneMapping}
 try{return renderer.compileAsync?renderer.compileAsync(root,camera,target===root?null:target):renderer.compile(root,camera,target===root?null:target)}finally{if(reflection){renderer.setRenderTarget(prev);renderer.toneMapping=tone}}}
// Shader warm-up (shader-warmup.js): compile every prop and creature program off-scene, a model per slice, soon after load.
const shaderWarmup=new Promise(resolve=>setTimeout(resolve,2500)).then(()=>runShaderWarmup(warmupList(worldTemplates),{
 build:item=>{const root=new T.Group();root.position.set(0,-200,0);if(item.kind==='actor')root.userData.warmModel=actorModel(T,root,item.data);else objectModel(T,root,item.id,{...item.data,groundHeight:()=>0});const lights=[];root.traverse(o=>{if(o.isLight)lights.push(o)});for(const l of lights)l.removeFromParent();root.updateMatrixWorld(true);if(classicLook.enabled)classicLook.convert(root);return root},
 compile:root=>Promise.all([compileFor(root),waterSystem.reflects&&compileFor(root,true)]),
 dispose:root=>{root.userData.warmModel?.dispose?.();disposeEntityResources(root)},
 yieldTask:()=>new Promise(r=>setTimeout(r,40))})).then(async r=>{if(waterSystem.reflects)await compileFor(scene,true,scene);window.eldervaleShaderWarmup=r;return r},()=>null);
const persistentRows=new Map(),applyNearby=window.eldervaleWorldBridge.apply;let regionTicket=null,regionResume=null;
const regionStreamer=createRegionStreamer({rows:persistentRows,loaded:worldInstances,position:()=>player.position,
 apply:row=>{applyNearby([row]);const entry=worldInstances.get(row.id);if(entry?.house)entry.root.visible=entry.root.position.distanceToSquared(player.position)<155*155;const target=targets.find(t=>t.userData.worldEntityId===row.id);if(target)realmObjectTargets.set(row.id,target);const pose=realmActorCache.get(row.id);if(pose)applyRealmActor(pose);const object=realmObjectState.get(row.id);if(object)applyRealmObject(object);},
 remove:removeWorldEntity,canRemove:id=>{const e=worldInstances.get(id);return !e||!e.actor||combatTurns.target!==e.actor&&(!conversation||conversation.profile!==e.actor.profile)},
 onProgress:({pending,done,total,error,blocking})=>{if(!document.querySelector('#auth-screen').hidden)document.querySelector('#auth-status').textContent=pending?'Loading nearby world… '+done+' / '+total:'Preparing controls…';if(pending&&window.eldervaleWorldLoading===true)window.eldervaleLoading?.bootProgress('Loading the nearby world…',.68+.24*(total?done/total:0),done+' / '+total+' places ready');if(pending&&(blocking||regionTicket)){if(!regionTicket){regionTicket=areaLoading.begin('Loading nearby area…');regionResume=!realmInCombat&&!routePending&&mapDestination?{goal:mapDestination.clone(),generation:navigationGeneration}:null;if(regionResume)void window.eldervaleRealm?.command('stop');}regionTicket.progress(done,total,'Preparing buildings, scenery and residents…');}else if(regionTicket&&!error){regionTicket.end();regionTicket=null;const resume=regionResume;regionResume=null;if(resume&&resume.generation===navigationGeneration&&!routePending)void setWalkDestination(resume.goal);}},
 onError:error=>{console.warn('Area loading:',error);regionTicket?.fail('This area could not be loaded. Reload to reconnect.',()=>location.reload());}
});window.eldervaleRegionStreamer=regionStreamer;
window.eldervaleWorldBridge.apply=rows=>regionStreamer.upsert(rows);
setInterval(()=>void regionStreamer.scan().catch(()=>{}),1200);

var realmPlayerPose=null,realmPoseJump=false,realmInCombat=false,lastMovementAck=0;var playerMotion=createMotionTrack(),realmFrameTime=0;var cameraFocus=null;var terrainCameraLift=0;var cameraObstructionDistance=null;var attackStyle='slash';
function interpolateRealm(actor,dt){if(actor.motion){const sample=actor.motion.sample();if(sample){const moved=Math.abs(sample.x-actor.root.position.x)+Math.abs(sample.z-actor.root.position.z)>.001;actor.root.position.x=sample.x;actor.root.position.z=sample.z;actor.root.rotation.y=workFacing(actor.rig,sample.yaw,moved,dt);}return}if(!actor.serverPose)return;const target=new T.Vector3(actor.serverPose.x,actor.root.position.y,actor.serverPose.z);if(actor.root.position.distanceToSquared(target)>100)actor.root.position.copy(target);else actor.root.position.lerp(target,1-Math.exp(-14*dt));actor.root.rotation.y=actor.serverPose.yaw;}
const realmActorCache=new Map(),realmObjectState=new Map(),realmObjectTargets=new Map(),realmMerchant={root:merchant,profile:{level:5,hp:45,maxHp:45}};
const baseRealmId=(kind,x,z)=>'base:'+kind+':'+Number(x).toFixed(1)+':'+Number(z).toFixed(1);
creatures.forEach((m,i)=>m.realmId='base:creature:'+i);
houseInteriors.forEach((h,i)=>h.realmId='base:door:'+i);
for(const target of targets){const a=target.userData;if(['tree','rock','chest','merchant'].includes(a.kind)&&(!generatedWorld||!['chest','merchant'].includes(a.kind)))a.realmId=baseRealmId(a.kind,a.x,a.z);else if(a.kind==='door')a.realmId=a.house.realmId;else if(a.kind==='npc')a.realmId=a.profile.realmId;else if(a.kind==='creature')a.realmId=a.mob.realmId;if(a.realmId)realmObjectTargets.set(a.realmId,target);}
// Quest markers over givers and the tracker under the minimap (quest-markers.js, quest-tracker.js).
let questUiRef=null;const markerActors=new Map();
function markerActor(id){let a=markerActors.get(id);if(!a||a.deleted||!a.root?.parent){a=realmActor(id)||null;markerActors.set(id,a)}return a}
// Quest guidance (quest-trail.js): breadcrumb trail + minimap path toward the tracked step (or the
// castle training's current step), and quest cutscenes (quest-cutscenes.js) on the tutorial engine.
function questLocate(id){const a=realmActor(id),root=a?.root||worldInstances.get(id)?.root;if(root)return {x:root.position.x,y:root.position.y,z:root.position.z,name:a?.profile?.name||a?.name};const d=persistentRows.get(id)?.data;return d?{x:d.x,y:landscape.walkHeight(d.x,d.z),z:d.z,name:d.name}:null}
function questUi(){if(questUiRef)return questUiRef;const markers=createQuestMarkers(T,scene,{actorFor:markerActor}),tracker=createQuestTracker({openJournal:id=>window.eldervaleQuestJournal?.show?.(id)});
 const trail=createQuestTrail(T,scene,{heightAt:(x,z)=>landscape.walkHeight(x,z),player:()=>player.position,locate:questLocate,fetchTiles:(x,z,radius)=>window.eldervaleRealm?.guideTiles?.({x,z,radius}),floor:()=>currentInterior?.floor||0,owner:()=>window.eldervaleQuestState?.guidance||{}});
 tracker.onTarget(e=>{if(!questContext().trainee)trail.setStep(e)});mountGuidanceSettings(document.querySelector('[data-settings-panel="gameplay"]'),v=>trail.configure(v));
 const cutscenes=createQuestCutscenes({play:(name,options)=>window.eldervaleTutorial?.playCutscene(name,options),busy:()=>document.body.classList.contains('npc-conversation')||!!window.eldervaleCutscene?.active||window.eldervaleWorldLoading===true});
 window.eldervaleQuestMarkers=markers;window.eldervaleQuestTracker=tracker;window.eldervaleQuestTrail=trail;window.eldervaleQuestCutscenes=cutscenes;let guidance='',trainStep=null;
 return questUiRef={markers,tracker,trail,cutscenes,sync(rows){const ctx=questContext();markers.sync(rows,ctx);tracker.sync(rows,ctx,{hidden:ctx.trainee});cutscenes.sync(rows);
  const g=JSON.stringify(window.eldervaleQuestState?.guidance||{});if(g!==guidance){guidance=g;trail.configure()}
  if(ctx.trainee){const st=window.eldervaleTutorial?.currentStep?.(),k=st?st.quest?.id+'|'+st.state+'|'+st.label:'';if(k!==trainStep){trainStep=k;trail.setStep({step:st&&st.state!=='finished'?st:null})}}else if(trainStep){trainStep=null;trail.setStep({step:tracker.step})}}}}
function realmActor(id){if(id==='base:merchant:-3.0:7.0')return realmMerchant;const custom=worldInstances.get(id)?.actor;return custom||creatures.find(a=>a.realmId===id)||npcs.find(a=>a.realmId===id)}
function applyRealmActor(row){let actor=realmActor(row.id);if(!actor&&row.id.startsWith('base:npc:')){const p=extraResidents.find(p=>'base:npc:'+p.name===row.id);if(p){actor=spawnNPC({...p,realmId:row.id},npcs.length);spawnedResidents.add(extraResidents.indexOf(p))}}if(!actor)return;actor.serverPose=row;actor.motion||=createMotionTrack({delay:650});const stepAt=row.stepAt?Date.parse(row.stepAt):NaN;if(Number.isFinite(stepAt))actor.motion.pushTile(stepAt,{x:row.x,z:row.z,yaw:row.yaw,moving:!!row.target},performance.now(),realmFrameTime);else actor.motion.push(realmFrameTime,{x:row.x,z:row.z,yaw:row.yaw,moving:!!row.target});const living=row.hp>0;
 // A monster killed in view plays its death (humanoids: kneel and collapse; beasts topple) before it disappears.
 if(!living&&actor.alive===true&&actor.root.visible&&!actor.lodHidden&&actor.model)actor.dyingSince=performance.now();if(living)actor.dyingSince=0;
 actor.root.visible=living||performance.now()-(actor.dyingSince||-1e9)<DEATH_SHOW_MS;actor.alive=living;if(actor.config){actor.hp=row.hp;actor.maxHp=row.data.hp;actor.config={...actor.config,...row.data}}if(actor.profile){actor.profile.level=row.data.level;actor.profile.hp=row.hp;actor.profile.maxHp=row.data.hp;}return actor;}
function applyRealmObject(object){const gate=worldInstances.get(object.id)?.root;if(gate?.userData.leftGate){const open=!!object.open&&!window.eldervaleTutorial?.gateLocked();gate.userData.gateOpen=open;gate.userData.leftGate.rotation.y=open?-Math.PI*.48:0;gate.userData.rightGate.rotation.y=open?Math.PI*.48:0;}const custom=worldInstances.get(object.id),house=custom?.house||houseInteriors.find(h=>h.realmId===object.id);if(house){house.open=object.open;house.doorPivot.rotation.y=house.open?-Math.PI*.53:0;}for(const vein of custom?.root.userData.oreVeins||[])vein.visible=!(Date.parse(object.available_at)>(window.eldervaleServerTime?.()||Date.now()));const t=realmObjectTargets.get(object.id);if(t)t.userData.availableAt=object.available_at;if(t?.userData.kind==='tree'||custom?.root.userData.harvestCanopy)setTreeDepleted(object.id,Date.parse(object.available_at)>(window.eldervaleServerTime?.()||Date.now()),object.available_at);}
window.eldervaleRealmBridge={
 snapshot(data,selfId,meta={}){currentInterior=data.interior||{floor:0,building:null};window.eldervaleMechanics?.sync(data.mechanics,data);Object.assign(playerFloorMap,data.playerFloors||{});window.eldervaleInterior=currentInterior;window.eldervaleSelfId=selfId;window.eldervaleSkillCrops=data.skillCrops||[];professionVisuals.sync(data);lastMovementAck=performance.now();localJumpAt=data.motion.jump_at;groundDrops.sync((data.groundDrops||[]).filter(d=>(d.floor||0)===currentInterior.floor).map(d=>({...d,renderHeight:landscape.walkHeight(d.x,d.z)+floorOffset(d.floor,d.x,d.z)})));deathFlow.sync(data.self,data.groundDrops||[],{x:player.position.x,z:player.position.z});tradePanel.sync(data.trade);npcDuelIds=new Set((data.npcDuels||[]).flatMap(d=>[d.guard,d.monster]));combatPlayerIds=new Set((data.actors||[]).map(a=>a.target).filter(Boolean));realmFrameTime=Date.parse(data.stateTime||data.time);if(stylePending&&performance.now()<stylePending.until&&data.motion.attack_style!==stylePending.style)attackStyle=stylePending.style;else{stylePending=null;attackStyle=data.motion.attack_style==='lunge'&&data.mechanics?.style==='block'?'block':data.motion.attack_style||'slash'}
  for(const [id,g]of Object.entries(goods))if(!g.field)state[id]=Number(data.self.stats?.[id])||0;const savedRow=fromPlayerRow(data.self);for(const k of ['gold','wood','ore','fishingPole','fishingNet','bait','rawFish','woodXP','miningXP','armorOwned','weaponsOwned','shieldsOwned','jewelryOwned','mountsOwned','equippedMount','bank','attackXP','strengthXP','defenceXP','hitpointsXP','rangedXP','magicXP','prayerXP','firemakingXP','fishingXP','cookingXP','smithingXP','craftingXP','herbloreXP','farmingXP','agilityXP','thievingXP','fletchingXP','runecraftingXP','constructionXP','hunterXP','amulet','trinket','starterChestClaimed','starterShieldsGranted','starterBattleaxeGranted','starterDaggerGranted','starterJewelryGranted'])if(savedRow[k]!==undefined)state[k]=savedRow[k];
  const signature=JSON.stringify([state.equipped,state.equippedWeapon,state.equippedShield]),incoming=JSON.stringify([savedRow.equipped,savedRow.equippedWeapon,savedRow.equippedShield]);state.equipped=savedRow.equipped;state.equippedWeapon=savedRow.equippedWeapon;state.equippedShield=savedRow.equippedShield;combat.hp=data.self.health;combat.maxHp=data.self.max_health;combat.xp=data.self.xp;combat.kills=savedRow.kills;state.runEnergy=data.motion.energy;running=runPending&&performance.now()<runPending.until?runPending.value:data.motion.run===true;mounted=data.motion.mounted===true;
  if(signature!==incoming){gatheringVisuals.clear();refreshArmor();refreshWeapon();refreshShield()}playerMotion.push(realmFrameTime,{x:data.motion.x,z:data.motion.z,yaw:data.motion.yaw,moving:data.motion.path.length>0});const nextPose={x:data.motion.x,z:data.motion.z,yaw:data.motion.yaw,moving:data.motion.path.length>0||Date.parse(data.motion.input_until)>(window.eldervaleServerTime?.()||Date.now()),inputX:data.motion.input_x||0,inputZ:data.motion.input_z||0,at:Date.parse(data.motion.motion_at)||realmFrameTime,until:Date.parse(data.motion.input_until),path:Array.isArray(data.motion.path)?data.motion.path:[],speed:data.motion.tile?Math.max(1,data.motion.stepTiles||1)*TILE/GAME_TICK:mountSpeed(data.motion.mounted===true,data.motion.run&&Number(data.motion.energy)>0),tile:data.motion.tile===true,stepTiles:data.motion.stepTiles||0};window.eldervaleTileMode=data.motion.tile===true;realmPoseJump=realmPoseJump||serverMotionJump(realmPlayerPose,nextPose);realmPlayerPose=nextPose;if(!realmPlayerPose.moving&&!meta.motionStale){dest=null;walkQueue=[];mapDestination=null;}
  realmInCombat=false;for(const id of data.removedActors||[]){const a=realmActor(id);if(a){a.root.visible=false;a.deleted=true;}}for(const row of data.actors){const a=realmActor(row.id);if(a)a.deleted=false;realmActorCache.set(row.id,row);applyRealmActor(row);if(row.target===selfId)realmInCombat=true;}
  window.eldervaleUpdatePlayers(data.players);gatheringSelfId=selfId;gatheringVisuals.sync(data.gathering||[]);for(const entry of data.players){const other=remotePlayers.get(entry.id);if(other){other.hp=entry.hp;other.maxHp=entry.maxHp;other.jumpAt=entry.jumpAt}}
  for(const object of [...data.objects,...(data.gates||[])]){realmObjectState.set(object.id,object);applyRealmObject(object);}
  window.eldervaleLevelUps??=createLevelUpPanel({play:kind=>playLevelUpJingle(kind),onShow:notice=>{levelFireworks.burst(player,jingleFor(notice));if(!celebrateUnsupported)void window.eldervaleRealm?.quietCommand?.('celebrate',{skill:notice.key,level:notice.level}).then(ok=>{if(ok===false)celebrateUnsupported=true})},canShow:()=>document.querySelector('#auth-screen').hidden&&!document.querySelector('dialog[open]')});window.eldervaleLevelUps.sync(state,selfId);window.eldervaleXpDrops??=createXpDrops();window.eldervaleXpDrops.sync(state,selfId);window.eldervaleQuestState=data.questState||window.eldervaleQuestState||null;window.eldervaleQuestJournal??=createQuestJournal(state);window.eldervaleQuestJournal.sync(data.quests||[]);window.eldervaleTutorial??=createTutorial({T,scene,heightAt:(x,z)=>landscape.walkHeight(x,z),playerPosition:()=>player.position,say,command:(name,payload)=>window.eldervaleRealm?.command(name,payload)??Promise.resolve(false),lastError:()=>window.eldervaleRealm?.lastError||'',carried:item=>quantity(state,item),locate:id=>{const a=realmActor(id),root=a?.root||worldInstances.get(id)?.root;if(root)return {x:root.position.x,y:root.position.y,z:root.position.z,name:a?.profile?.name||a?.name};const d=persistentRows.get(id)?.data;return d?{x:d.x,y:landscape.walkHeight(d.x,d.z),z:d.z,name:d.name}:null},refreshGates:()=>{for(const o of realmObjectState.values())if(worldInstances.get(o.id)?.root.userData.leftGate)applyRealmObject(o)},actorRoot:id=>markerActor(id)?.root,npcDialogue:{start:profile=>npcDialogue.open(profile,npcs.find(n=>n.profile===profile)?.root,npcDisplayName(profile)),page:l=>npcDialogue.page(l),choose:(l,o)=>npcDialogue.choose(l,o),close:()=>npcDialogue.close(),owns:id=>npcDialogue.owns(id)}});window.eldervaleTutorial.sync(data);window.eldervaleQuestRows=data.quests||[];questUi().sync(window.eldervaleQuestRows);professions.sync(data.professionJobs||[]);window.eldervaleShops=data.shops||{};
  // The local save copy is a cache (the server owns the character): refresh it every few seconds, not on every 250 ms sync.
  if(performance.now()-lastSyncSave>3000){lastSyncSave=performance.now();captureSave()}draw();services.refresh?.();
 },
 event(e,selfId){if(e.type==='skill_notice'||e.type==='skill_complete'){if(e.player===selfId)say(e.text);return}if(e.type==='npc_windup'){const a=realmActor(e.attacker),b=realmActor(e.target);if(a&&b?.root.visible&&a.root.position.distanceTo(b.root.position)<4.5){a.attackAnim=.55;a.previewAttack=.55;}if(b)b.blockAnim=.75;return}if(e.type==='npc_hit'){const a=realmActor(e.target);if(a){hitNumbers.show(a.root,e.damage,e.blocked,3);if(a.root.position.distanceTo(player.position)<20)combatSound(e.blocked?'metal':'impact');}return}const actor=realmActor(e.target),root=actor?.root,isSelf=e.player===selfId,other=remotePlayers.get(e.player);if(e.type==='player_death'||e.type==='player_respawn'){deathFlow.event(e,isSelf);if(isSelf){following=null;action=null;dest=null;walkQueue=[];combatTurns.cancel?.()}return}if(e.type==='fishing'){const fisher=isSelf?player:other?.root;if(fisher)soundEffects()?.sample('splashCatch',{at:Number.isFinite(e.x)?{x:e.x,z:e.z}:fisher.position,gain:.8,far:35});if(isSelf)say('You catch a '+(goods[e.item]?.name||'fish').toLowerCase()+'. +'+formatXp(e.xp??20)+' Fishing XP');return}if(e.type==='eat'){if(isSelf){combat.eatAnim=EAT_ANIMATION;combat.eatItem=e.item}else if(other){other.eatAnim=EAT_ANIMATION;other.eatItem=e.item}const eater=isSelf?player:other?.root;if(eater){const fx=soundEffects();
 // The bite lands when the hand reaches the mouth (35% of the eat animation), a second chew follows.
 fx?.sample('crunch',{at:eater.position,gain:.75,delay:EAT_ANIMATION*.35});fx?.sample('crunch',{at:eater.position,gain:.45,delay:EAT_ANIMATION*.35+.32})}return}if(e.type==='level_up'){const who=e.player===selfId?null:remotePlayers.get(e.player);if(who&&who.root){levelFireworks.burst(who.root,e.skill==='combat'?'combatLevel':jingleFor({type:'skill',key:e.skill}))}return}if(e.type==='woodcut'){if(e.depleted){const tree=targets.find(t=>(t.userData.realmId||t.userData.worldEntityId)===e.target);const at=tree?.getWorldPosition(new T.Vector3())||(isSelf?player.position:other?.root.position);if(at){const fx=soundEffects();fx?.sample('creak',{at,gain:.6,far:50});fx?.sample('treeFall',{at,gain:.95,delay:.6,far:60})}}if(e.depleted)applyRealmObject({id:e.target,available_at:e.availableAt});if(isSelf)say('You receive '+e.amount+' log'+(e.amount===1?'':'s')+'. +'+formatXp(e.xp??25*e.amount)+' Woodcutting XP');return}if(e.type==='gather_end'){if(isSelf&&e.text)say(e.text);return}if(e.type==='preview'){if(actor){actor.attackAnim=.55;actor.previewAttack=.55;}return}if(e.type==='windup'){if(isSelf&&e.side==='player')combatSound(e.style||'slash');if(e.style&&isSelf)attackStyle=e.style;if(e.side==='player'){if(isSelf){combat.attackAnim=.55;combat.blockAnim=0;faceTarget(player,root?.position||player.position);combat.arrowTarget=e.ranged?root:null}else if(other){other.attackAnim=.55;other.attackStyle=e.style||'slash';other.arrowTarget=e.ranged?root:null;}if(actor)actor.blockAnim=1.1;}else{if(actor){actor.attackAnim=.55;actor.previewAttack=.55;}if(isSelf){combat.attackAnim=0;combat.blockAnim=1.15;}else if(other)other.blockAnim=1.15;}}
  else if(e.type==='hit'){const target=e.side==='player'?root:isSelf?player:other?.root;if(target)hitNumbers.show(target,e.damage,e.blocked,e.side==='player'?1.8:2.8);if(isSelf)combatSound(e.blocked?'metal':'impact');if(actor&&e.side==='player'){actor.hitAnim=e.blocked?0:.3;actor.blockAnim=e.blocked?.65:0;}}
  else if(e.type==='interaction'&&isSelf){pendingArrival=null;const a=targets.find(t=>(t.userData.realmId||t.userData.worldEntityId||t.userData.profile?.realmId)===e.target)?.userData;// Match the clicked NPC itself: its realm and world-entity ids can differ.
const mode=npcIntent&&(npcIntent.actor===a||npcIntent.target===e.target)?npcIntent.mode:'talk';npcIntent=null;if(a?.kind==='npc'){if(mode==='bank'||mode==='trade')openNpcService(a.profile,mode);else talkTo(a.profile)}else if(a?.kind==='merchant')services.open('shop','Market',e.target);else if(a?.kind==='altar')void Promise.resolve(window.eldervaleRealm.command('pray',{target:e.target})).then(()=>window.eldervaleMechanics?.altar(e.target));else if(a?.kind==='hearth')professions.open({station:'cooking',target:e.target});else if(a?.kind==='fishing')void window.eldervaleRealm.command('fish',{target:e.target});action=null;}
  else if(e.type==='door'){const h=worldInstances.get(e.target)?.house||houseInteriors.find(h=>h.realmId===e.target);if(h){h.open=e.open;h.doorPivot.rotation.y=e.open?-Math.PI*.53:0;}action=null;if(isSelf&&navigationAfterDoor){const goal=navigationAfterDoor;navigationAfterDoor=null;setWalkDestination(goal);}}
  else if(e.type==='notice'&&isSelf){if(repeatingNotice(e.text))say(e.text)}else if(e.type==='death'&&isSelf){say('Defeated '+(actor?.name||'opponent')+'.');action=null;}else if(e.type==='gather'&&isSelf){say('Resource gathered. +25 XP');action=null;}
 }
};

const terrainBaseline=landscape.heights.slice(),terrainRows=new Map(),anchorHeights=new WeakMap(),instanceBase=new WeakMap();
function conformSurface(root){const d=root.userData.surfaceData;if(!d)return;const mesh=root.children.find(m=>m.isMesh&&m.material?.visible!==false);if(!mesh)return;mesh.geometry.dispose();mesh.geometry=pavedGeometry(T,landscape,d,root.position.y);mesh.rotation.set(0,0,0);const ids=[...surfaceRows.keys()].sort(),order=ids.indexOf(root.userData.surfaceId)+1;mesh.renderOrder=order;if(!mesh.userData.surfaceMaterial){mesh.material=mesh.material.clone();mesh.userData.surfaceMaterial=true}mesh.material.polygonOffset=true;mesh.material.polygonOffsetFactor=-1;mesh.material.polygonOffsetUnits=-order;}
const foundationRows=new Map(),surfaceRows=new Map();
let surfaceCoverIndex=null;window.eldervaleSurfaceCover=(x,z,padding=.65)=>(surfaceCoverIndex??=createSurfaceCoverIndex([...foundationRows.values(),...surfaceRows.values()])).covers(x,z,padding);
function rebuildTerrain(){
 for(const o of scene.children)if(!o.isLight&&!o.isInstancedMesh&&!o.userData.terrainFixed&&o!==player&&!anchorHeights.has(o))anchorHeights.set(o,o.position.y-landscape.heightAt(o.position.x,o.position.z));
 for(const batch of [...forestBatches,tufts])if(!instanceBase.has(batch)){const values=[];for(let i=0;i<batch.count;i++){const m=new T.Matrix4();batch.getMatrixAt(i,m);values.push({matrix:m,ground:landscape.heightAt(m.elements[12],m.elements[14])})}instanceBase.set(batch,values)}
 sculptPatches(landscape,terrainBaseline,[...terrainRows.values()].filter(r=>!r.deleted).sort((a,b)=>a.id.localeCompare(b.id)).map(r=>r.data));const plots=[...foundationRows.values()].filter(r=>!r.deleted).sort((a,b)=>a.id.localeCompare(b.id)).map(r=>({id:r.id,...buildingPlot(r.data),levelHeight:landscape.heightAt(r.data.x,r.data.z),register:false}));
 for(const p of plots)landscape.levelBuildingPlot(p);
 // Preserve each flat foundation after neighbouring blend zones are graded.
 for(const p of plots)landscape.levelBuildingPlot({...p,coreOnly:true});
 ground.geometry.dispose();ground.geometry=landscapeGeometry(T,landscape);waterSystem.refreshTerrain();meadow.invalidate();drapeRoads();
 for(const o of scene.children)if(anchorHeights.has(o)&&!o.userData.surface)o.position.y=landscape.heightAt(o.position.x,o.position.z)+anchorHeights.get(o);
 for(const batch of [...forestBatches,tufts]){const values=instanceBase.get(batch);for(let i=0;i<batch.count;i++){const {matrix,ground:height}=values[i],m=matrix.clone();m.elements[13]+=landscape.heightAt(m.elements[12],m.elements[14])-height;batch.setMatrixAt(i,m)}batch.instanceMatrix.needsUpdate=true;if(batch.userData.treeOriginal)batch.userData.treeOriginal.set(batch.instanceMatrix.array);batch.computeBoundingSphere()}
 for(const id of depletedTrees.keys())if(id.startsWith('base:tree:'))setForestTreeVisible(T,forestBatches,id,false);
 for(const [id,entry] of worldInstances){if(entry.house&&foundationRows.has(id)){const p=walkInPlot(foundationRows.get(id).data);entry.root.position.y=landscape.heightAt(p.x,p.z);landscape.registerFloor(id,p);cellBatcher.touch(entry.root,performance.now())}if(entry.root.userData.surface)conformSurface(entry.root);}
}
const applyTerrainRender=window.eldervaleWorldBridge.apply;window.eldervaleWorldBridge.apply=async rows=>{let changed=false;for(const row of rows){if(row.data.template?.startsWith('terrain_')||terrainRows.has(row.id)){terrainRows.set(row.id,row);changed=true}if(isBuilding(row.data)||foundationRows.has(row.id)){if(isBuilding(row.data)&&!row.deleted)foundationRows.set(row.id,row);else foundationRows.delete(row.id);changed=true}if(['road','plaza'].includes(row.data.template)||row.data.template?.startsWith('terrain_')||surfaceRows.has(row.id)){if(!row.deleted&&(['road','plaza'].includes(row.data.template)||row.data.template?.startsWith('terrain_')))surfaceRows.set(row.id,row);else surfaceRows.delete(row.id);changed=true}}if(changed){surfaceCoverIndex=null;const ticket=areaLoading.begin('Updating the landscape…');try{await runFrameWork((function*(){yield;rebuildTerrain();})());}finally{ticket.end();}}await applyTerrainRender(rows);};
let nextLampUpdate=0;
townAnimations.push(()=>{if(performance.now()<nextLampUpdate)return;nextLampUpdate=performance.now()+400;const fixtures=scene.children.filter(o=>o.userData.lamp&&o.position.distanceToSquared(player.position)<55*55).sort((a,b)=>a.position.distanceToSquared(player.position)-b.position.distanceToSquared(player.position));const glow=14*Math.max(0,1-(window.eldervaleDaylight??1)*2.2),room=houseInteriors.find(h=>h.inside);if(room)fixtures.unshift(room.group);const props=lightProxies.nearest(player.position,lanternPool.length);let propIndex=0;lanternPool.forEach((light,i)=>{const fixture=fixtures[i],lit=fixture&&(fixture===room?.group||glow>0),prop=props[propIndex];if(prop&&(!lit||prop.distance<fixture.position.distanceTo(player.position))){propIndex++;lightProxies.apply(light,prop);return}light.color.setHex(0xffc27a);light.distance=16;light.decay=2;light.intensity=!fixture?0:fixture===room?5+glow*.4:glow;if(room&&fixture===room)light.position.set(0,2.4+currentInterior.floor*3,0).applyMatrix4(room.group.matrixWorld);else if(fixture)light.position.set(.62,2.6,0).applyMatrix4(fixture.matrixWorld)})});

if(!generatedWorld){const fishingMarker=new T.Group();fishingMarker.position.set(-70,landscape.walkHeight(-70,80),80);scene.add(fishingMarker);objectModel(T,fishingMarker,'fishing_spot');const fishingHit=new T.Mesh(new T.CylinderGeometry(.8,.8,1.6,10),new T.MeshBasicMaterial({visible:false}));fishingHit.position.y=.8;fishingMarker.add(fishingHit);fishingHit.userData={kind:'fishing',x:-70,z:80,realmId:'base:fishing:moonmere'};targets.push(fishingHit);realmObjectTargets.set('base:fishing:moonmere',fishingHit);}

function groundFeet(rig,visual,contacts=null){visual.updateWorldMatrix(true,true);let lift=0;
 if(rig.clipDriven){const p=new T.Vector3();for(const side of ['left','right']){if(contacts&&!contacts[side])continue;rig[side+'Ankle'].getWorldPosition(p);lift=Math.max(lift,landscape.walkHeight(p.x,p.z)+rig.footHeight-p.y)}visual.position.y+=Math.min(.3,Math.max(0,lift));return}
const ankles=contacts&&(contacts.left||contacts.right)?[contacts.left?rig.leftAnkle:null,contacts.right?rig.rightAnkle:null]:[rig.leftAnkle,rig.rightAnkle];const feet=[];for(const ankle of ankles)ankle?.traverse(m=>{if(m.isMesh)feet.push(m)});for(const side of ['left','right'])if((!contacts||contacts[side])&&rig.meshes?.[side+'Foot'])feet.push(rig.meshes[side+'Foot']);for(const m of feet){if(!m.visible||m.material?.visible===false)continue;if(m.isSkinnedMesh)m.computeBoundingBox();else if(!m.geometry.boundingBox)m.geometry.computeBoundingBox();const box=(m.isSkinnedMesh?m.boundingBox:m.geometry.boundingBox).clone().applyMatrix4(m.matrixWorld);const x=(box.min.x+box.max.x)/2,z=(box.min.z+box.max.z)/2;lift=Math.max(lift,landscape.walkHeight(x,z)+.012-box.min.y)}visual.position.y+=Math.min(.3,Math.max(0,lift));}

window.eldervaleGetWaterSoundProximity=()=>Math.max(0,...scene.children.filter(o=>o.userData.waterSource).map(o=>Math.max(0,1-Math.hypot(player.position.x-o.position.x,player.position.z-o.position.z)/9)));

// The moat surrounds the playable castle plateau. The shared bridge is the only crossing.
for(const [dx,dz,w,l] of [[0,-58.5,126,9],[0,58.5,126,9],[-58.5,0,9,108],[58.5,0,9,108]]){const m=new T.Mesh(new T.PlaneGeometry(w,l),new T.MeshStandardMaterial({map:texture('water',0x577f83),color:0x84a9aa,roughness:.32,metalness:.2}));m.rotation.x=-Math.PI/2;m.position.set(castle.x+dx,.035,castle.z+dz);m.userData.terrainFixed=true;scene.add(m);waterSystem.add(m)}

let castleCollisionRows=null;window.eldervaleCastleCollision=(x,z)=>{for(const row of castleCollisionRows??=Array.from(persistentRows.values()).filter(r=>!r.deleted&&['castle_wall','castle_tower','castle_gate'].includes(r.data.template)).map(r=>({...r,c:Math.cos(r.data.yaw*Math.PI/180),s:Math.sin(r.data.yaw*Math.PI/180)}))){const d=row.data,s=d.scale||1,dx=x-d.x,dz=z-d.z,tx=(dx*row.c-dz*row.s)/s,tz=(dx*row.s+dz*row.c)/s;if(d.template==='castle_tower'){if(tx*tx+tz*tz<25)return true;}else if(Math.abs(tz)<(d.template==='castle_gate'?2.1:1.6)&&Math.abs(tx)<(d.length||24)/2+.3){if(d.template!=='castle_gate'||Math.abs(tx)>4.1||!worldInstances.get(row.id)?.root.userData.gateOpen)return true;}}return false;};

window.eldervaleRemovedActors=ids=>{for(const id of ids){const a=realmActor(id);if(a){a.deleted=true;a.root.visible=false;}}};

let propCollisionIndex=null;
window.eldervalePropCollision=(x,z)=>{if(!propCollisionIndex){const data=generatedWorld?[]:[...fixedObstacles];for(const row of persistentRows.values())if(!row.deleted&&row.data.kind==='object'&&!(row.data.floor>0)&&!depletedTrees.has(row.id))data.push(row.data);for(const [id,t]of realmObjectTargets)if(id.startsWith('base:')&&['tree','rock'].includes(t.userData.kind)&&!depletedTrees.has(id))data.push({template:t.userData.kind,x:t.userData.x,z:t.userData.z});propCollisionIndex=createObstacleIndex(data);}return propCollisionIndex.blocked(x,z);};
const applyNavigationWorld=window.eldervaleWorldBridge.apply;window.eldervaleWorldBridge.apply=async rows=>{await applyNavigationWorld(rows);if(rows.length){castleCollisionRows=null;propCollisionIndex=null;meadow.invalidate();groundDressing.invalidate();waterSystem.setFishingSpots([...persistentRows.values()].filter(r=>!r.deleted&&r.data.template==='fishing_spot').map(r=>r.data));}};


window.eldervaleMapItems=()=>persistentRows.values();

installFantasyHUD();installWorldHoverCursor({element:renderer.domElement,camera,targets,raycaster:new T.Raycaster(),isBlocked:()=>window.eldervaleWorldLoading===true,passThrough:o=>o.userData.kind==='worldObject',actionable:o=>!examineOnly(o.userData)});
