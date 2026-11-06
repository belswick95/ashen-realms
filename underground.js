// Underground runtime (client): cave meshes, dark lighting, minimap, travel and agility.
//
// * installUndergroundTerrain(landscape) — called right after the landscape is created: below
//   ground the floor is flat (y=0), walkable exactly where the rasterised rooms and tunnels are,
//   and never water, so local prediction, click routes and models agree with the server walls.
// * createUnderground({...}) — builds an area's levels incrementally (one level per frame
//   budget, shared materials, one InstancedMesh of rock per level), prebuilds when the player
//   nears an entrance, shows the loading chip while travelling, darkens sky/fog/ambient while
//   inside (prop lights go through the shared 4-light pool: every PointLight here becomes a
//   light-proxy anchor, the scene light count never changes), draws the underground minimap,
//   picks cave music and ambience, and plays agility crossings.
import {dungeons,THEMES,LIGHT_KINDS,PASSAGE_TEMPLATES,PASSAGE_VERBS,TILE,createUndergroundIndex,levelOrigin,isUndergroundPoint,passageObjects,tileOf} from './underground-data.js?v=release-20261106-cut106';
import {AGILITY_TEMPLATES,AGILITY_VERBS,failChance} from './agility-data.js?v=release-20261106-cut106';
import {sharedMaterial,sharedGeometry} from './shared-geometry.js?v=release-20261106-cut106';
import {lightMarker} from './underground-models.js?v=release-20261106-cut106';
import {loading} from './loading-indicator.js?v=release-20261106-cut106';
import {nextFrame} from './frame-work.js?v=release-20261106-cut106';

const state={areas:dungeons.slice(),index:createUndergroundIndex(dungeons),listeners:new Set()};
export function undergroundAreas(){return state.areas}
export function undergroundAt(x,z){const g=state.index.at(x,z);return g?{area:g.area,level:g.level,grid:g}:null}
export function setUndergroundAreas(list){
 const clean=(Array.isArray(list)?list:[]).filter(a=>a&&a.id&&Array.isArray(a.levels)&&a.levels.length&&a.origin);
 if(!clean.length)return false;state.areas=clean;state.index=createUndergroundIndex(clean);for(const fn of state.listeners)fn();return true;
}
// Flat, walled floor below ground; the overworld answers everything else.
export function installUndergroundTerrain(landscape){
 if(landscape.undergroundInstalled)return landscape;
 const base={heightAt:landscape.heightAt,walkHeight:landscape.walkHeight,canWalk:landscape.canWalk,waterAt:landscape.waterAt,nearestDryPoint:landscape.nearestDryPoint};
 landscape.heightAt=(x,z)=>isUndergroundPoint(x,z)?0:base.heightAt(x,z);
 landscape.walkHeight=(x,z)=>isUndergroundPoint(x,z)?0:base.walkHeight(x,z);
 landscape.waterAt=(x,z)=>isUndergroundPoint(x,z)?0:base.waterAt(x,z);
 landscape.canWalk=(x,z)=>isUndergroundPoint(x,z)?state.index.walkable(x,z):base.canWalk(x,z);
 landscape.nearestDryPoint=(x,z)=>{if(!isUndergroundPoint(x,z))return base.nearestDryPoint(x,z);if(state.index.walkable(x,z))return {x,z};for(let r=1;r<24;r++)for(let k=0;k<16;k++){const a=k*Math.PI/8,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;if(state.index.walkable(px,pz))return {x:px,z:pz}}return {x,z}};
 landscape.undergroundInstalled=true;return landscape;
}
// Cave music per theme (existing tracks) and a damped ambience.
const MUSIC={earth:{id:'ashen-ruins',title:'Rites'},crypt:{id:'northwatch',title:'Night Vigil'},fire:{id:'eastmarch',title:'Crusade'}};
export function undergroundMusic(position){const at=position&&undergroundAt(position.x,position.z);if(!at)return null;const m=MUSIC[at.area.theme]||MUSIC.earth;const o=levelOrigin(at.area,at.level);return {...m,name:at.area.name,x:o.x,z:o.z,radius:400,artist:'Kevin MacLeod'}}
globalThis.eldervaleUndergroundMusic=undergroundMusic;

// Deterministic per-tile noise for colours and rock sizes.
const hash=(i,j,s=0)=>{let n=(Math.imul(i,374761393)^Math.imul(j,668265263)^Math.imul(s,2147483647))>>>0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295};
// Geometry of one level: floor quads (vertex colours) and rock / decor instances.
export function levelMeshData(grid,theme){
 const th=THEMES[theme]||THEMES.earth,{i0,j0,w,h,mask}=grid,walk=(i,j)=>i>=i0&&j>=j0&&i<i0+w&&j<j0+h&&mask[(j-j0)*w+(i-i0)]===1;
 const pos=[],col=[],idx=[],rocks=[],decor=[];const c0=[(th.floor>>16&255)/255,(th.floor>>8&255)/255,(th.floor&255)/255],c1=[(th.floorAlt>>16&255)/255,(th.floorAlt>>8&255)/255,(th.floorAlt&255)/255];
 for(let j=j0;j<j0+h;j++)for(let i=i0;i<i0+w;i++){
  if(walk(i,j)){const x=i*TILE,z=j*TILE,t=hash(i,j),v=pos.length/3;
   for(const [dx,dz] of [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]){pos.push(x+dx*TILE,0,z+dz*TILE);const k=hash(i+(dx>0),j+(dz>0),3)*.6+t*.4;col.push(c0[0]+(c1[0]-c0[0])*k,c0[1]+(c1[1]-c0[1])*k,c0[2]+(c1[2]-c0[2])*k)}
   idx.push(v,v+2,v+1,v,v+3,v+2);
   let nearWall=0;for(const [di,dj] of [[1,0],[-1,0],[0,1],[0,-1]])if(!walk(i+di,j+dj))nearWall++;
   if(nearWall&&hash(i,j,7)<.16)decor.push({x:x+(hash(i,j,8)-.5)*.8,z:z+(hash(i,j,9)-.5)*.8,s:.5+hash(i,j,10)*.9,r:hash(i,j,11)*6.28});
   continue}
  let near=0;for(let dj=-1;dj<=1;dj++)for(let di=-1;di<=1;di++)if((di||dj)&&walk(i+di,j+dj))near=Math.max(near,di&&dj?1:2);
  let second=false;if(!near)for(let dj=-2;dj<=2&&!second;dj++)for(let di=-2;di<=2;di++)if(walk(i+di,j+dj)){second=true;break}
  if(near||second&&hash(i,j,4)<.55){const t=hash(i,j,5);rocks.push({x:i*TILE+(hash(i,j,1)-.5)*.5,z:j*TILE+(hash(i,j,2)-.5)*.5,w:(near?1:1.3)+t*.4,h:(near?1.5:2.4)+hash(i,j,6)*1.4,r:t*6.28,k:hash(i,j,12)})}
 }
 return {positions:pos,colors:col,indices:idx,rocks,decor};
}
// Lightweight 2D image of a level for the minimap (1 px per tile).
function levelCanvas(grid,theme){if(typeof document==='undefined')return null;const th=THEMES[theme]||THEMES.earth,c=document.createElement('canvas');c.width=grid.w;c.height=grid.h;const g=c.getContext('2d');if(!g)return null;const img=g.createImageData(grid.w,grid.h);
 const f=[th.floorAlt>>16&255,th.floorAlt>>8&255,th.floorAlt&255].map(v=>Math.min(255,v*1.7+30));
 for(let k=0;k<grid.w*grid.h;k++){const o=k*4;if(grid.mask[k]){img.data[o]=f[0];img.data[o+1]=f[1];img.data[o+2]=f[2];img.data[o+3]=255}else{img.data[o]=18;img.data[o+1]=15;img.data[o+2]=13;img.data[o+3]=255}}
 g.putImageData(img,0,0);return c}

export function createUnderground({T,scene,landscape,skyLight,sun,renderer,camera,lightProxies,say=()=>{},command=(c,p)=>globalThis.eldervaleRealm?.command(c,p),yieldFrame=nextFrame,now=()=>performance.now()}){
 if(landscape)installUndergroundTerrain(landscape);
 const built=new Map();let skyMesh=null,current=null,saved=null,lastScan=0,ambientWrapped=false,tween=null,remoteTweens=new Map();
 const floorMat=()=>sharedMaterial(T,'ug-floor',()=>new T.MeshStandardMaterial({vertexColors:true,roughness:1,metalness:0}));
 const rockMat=()=>sharedMaterial(T,'ug-rock',()=>new T.MeshStandardMaterial({roughness:.95,metalness:0,flatShading:true}));
 const rockGeo=()=>sharedGeometry(T,'dodecahedron',.5,0);
 const decorGeo=theme=>theme==='crypt'?sharedGeometry(T,'box',.35,.12,.12):theme==='fire'?sharedGeometry(T,'cylinder',.12,.35,1.1,5):sharedGeometry(T,'cone',.28,1.3,5);
 async function buildArea(area,{onProgress=()=>{}}={}){
  const group=new T.Group();group.name='underground:'+area.id;group.userData.underground=area.id;const th=THEMES[area.theme]||THEMES.earth,levels=[];let done=0;
  for(const lv of area.levels){const grid=state.index.grids.find(g=>g.area.id===area.id&&g.level===lv.level);if(!grid)continue;const data=levelMeshData(grid,area.theme);
   const geo=new T.BufferGeometry();geo.setAttribute('position',new T.Float32BufferAttribute(data.positions,3));geo.setAttribute('color',new T.Float32BufferAttribute(data.colors,3));geo.setIndex(data.indices);geo.computeVertexNormals();geo.computeBoundingSphere();
   const floor=new T.Mesh(geo,floorMat());floor.receiveShadow=true;floor.userData.terrainFixed=true;group.add(floor);
   const rocks=new T.InstancedMesh(rockGeo(),rockMat(),data.rocks.length),m=new T.Matrix4(),q=new T.Quaternion(),e=new T.Euler(),s=new T.Vector3(),p=new T.Vector3(),c=new T.Color(),wall=new T.Color(th.wall),alt=new T.Color(th.wallAlt);
   data.rocks.forEach((r,k)=>{q.setFromEuler(e.set(0,r.r,r.k*.3));m.compose(p.set(r.x,r.h*.38,r.z),q,s.set(r.w*1.6,r.h,r.w*1.6));rocks.setMatrixAt(k,m);rocks.setColorAt(k,c.copy(wall).lerp(alt,r.k))});
   rocks.castShadow=false;rocks.receiveShadow=true;rocks.computeBoundingSphere();group.add(rocks);
   if(data.decor.length){const d=new T.InstancedMesh(decorGeo(area.theme),sharedMaterial(T,'ug-decor-'+area.theme,()=>new T.MeshStandardMaterial({color:area.theme==='crypt'?0xd8d0bd:area.theme==='fire'?0x2b201c:0x6b5e50,roughness:.9,flatShading:true})),data.decor.length);
    data.decor.forEach((v,k)=>{q.setFromEuler(e.set(area.theme==='crypt'?Math.PI/2:0,v.r,0));m.compose(p.set(v.x,area.theme==='crypt'?.06:.55*v.s,v.z),q,s.set(v.s,v.s,v.s));d.setMatrixAt(k,m)});d.computeBoundingSphere();group.add(d)}
   for(const l of area.lights||[]){if(l.level!==lv.level)continue;const def=LIGHT_KINDS[l.kind]||LIGHT_KINDS.torch,o=levelOrigin(area,lv.level),marker=lightMarker(T,l.kind,l.color??def.color);marker.position.set(o.x+l.x,0,o.z+l.z);group.add(marker);
    const light=new T.PointLight(l.color??def.color,l.intensity??def.intensity,l.distance??def.distance,2);light.position.set(o.x+l.x,l.kind==='lava'?1.2:2.4,o.z+l.z);group.add(light)}
   levels.push({level:lv.level,grid,canvas:levelCanvas(grid,area.theme)});
   onProgress(++done,area.levels.length);await yieldFrame();
  }
  scene.add(group);lightProxies?.scan(now(),true);
  try{if(renderer?.compileAsync)await renderer.compileAsync(group,camera,scene)}catch{}
  return {area,group,levels,passages:passageObjects(area)};
 }
 function prepare(id,opts){const area=state.areas.find(a=>a.id===id);if(!area)return Promise.resolve(null);let entry=built.get(id);if(entry&&entry.version===state.index)return entry.ready;
  if(entry){entry.ready.then(b=>{if(b)b.group.removeFromParent()});built.delete(id)}
  entry={version:state.index,ready:buildArea(area,opts).catch(e=>{console.warn('underground build',e);built.delete(id);return null})};built.set(id,entry);return entry.ready}
 state.listeners.add(()=>{for(const id of [...built.keys()])prepare(id)});
 function applyLighting(area){const th=THEMES[area.theme]||THEMES.earth;
  if(!saved)saved={bg:scene.background?.clone?.(),fog:scene.fog?{color:scene.fog.color.clone(),near:scene.fog.near,far:scene.fog.far}:null,sky:skyLight?{i:skyLight.intensity,c:skyLight.color.clone(),g:skyLight.groundColor.clone()}:null,sun:sun?.intensity};
  scene.background?.setHex?.(th.fog);if(scene.fog){scene.fog.color.setHex(th.fog);scene.fog.near=th.fogNear;scene.fog.far=th.fogFar}
  if(skyLight){skyLight.intensity=th.ambientIntensity;skyLight.color.setHex(th.ambient);skyLight.groundColor.setHex(0x1a1410)}if(sun)sun.intensity=th.sun;
 }
 function restoreLighting(){if(!saved)return;if(saved.bg&&scene.background?.copy)scene.background.copy(saved.bg);if(saved.fog&&scene.fog){scene.fog.color.copy(saved.fog.color);scene.fog.near=saved.fog.near;scene.fog.far=saved.fog.far}if(saved.sky&&skyLight){skyLight.intensity=saved.sky.i;skyLight.color.copy(saved.sky.c);skyLight.groundColor.copy(saved.sky.g)}if(sun&&Number.isFinite(saved.sun))sun.intensity=saved.sun;saved=null}
 function wrapAmbience(){if(ambientWrapped||typeof window==='undefined'||!window.eldervaleAmbientState)return;ambientWrapped=true;const base=window.eldervaleAmbientState;
  window.eldervaleAmbientState=()=>{const s=base();if(!current)return s;return {...s,day:0,water:0,town:0,farm:0,forest:0,snow:0,chapel:0,smithy:0,indoors:1,ember:current.area.theme==='fire'?1:0,sources:[]}}}
 // Every passage near the player: prebuild its target area before the click.
 function prefetch(position){for(const area of state.areas){if(built.has(area.id))continue;for(const e of area.entrances||[])if(Math.hypot(e.x-position.x,e.z-position.z)<40){prepare(area.id);break}}}
 function setTween(target,ev){const [fx,fz]=ev.from,[tx,tz]=ev.to,dur=Math.max(.6,(ev.ticks||4)*.6);return {root:target,fx,fz,tx,tz,ok:ev.ok!==false,kind:ev.kind,start:now(),dur}}
 function stepTween(t,player){const k=Math.min(1,(now()-t.start)/1000/t.dur);let x,z,hop=0;
  if(t.ok){x=t.fx+(t.tx-t.fx)*k;z=t.fz+(t.tz-t.fz)*k}else{const out=k<.5?k*2*.45:(1-k)*2*.45;x=t.fx+(t.dirX||0)*out;z=t.fz+(t.dirZ||0)*out}
  if(t.kind==='rope_swing'||t.kind==='stepping_stones')hop=Math.abs(Math.sin(k*Math.PI*(t.kind==='stepping_stones'?4:1)))*(t.kind==='rope_swing'?1.6:.45);
  if(t.kind==='wall_climb')hop=Math.sin(k*Math.PI)*2.2;if(t.kind==='log_balance')hop=.35*Math.sin(k*Math.PI);
  player.position.x=x;player.position.z=z;player.position.y=(landscape?.walkHeight?.(x,z)??0)+hop;return k>=1}
 const api={
  get current(){return current},prepare,areas:()=>state.areas,
  setAreas(list){return setUndergroundAreas(list)},
  // The sky dome is hidden below ground (visibility only: no shader changes).
  setSky(sky){skyMesh=scene.children.find(o=>o.material?.uniforms&&o.material.uniforms===sky?.uniforms)||null},
  // The day/night sky update runs every 1.5 s; below ground the cave look wins straight after it.
  relight(){if(current)applyLighting(current.area)},
  // Called every frame before the camera follows the player.
  frame(dt,player){if(!player)return;const p=player.position,at=undergroundAt(p.x,p.z);wrapAmbience();
   if(at&&(!current||current.area.id!==at.area.id||current.level!==at.level)){const area=at.area;current={area,level:at.level};window.eldervaleUndergroundArea={id:area.id,name:area.name,level:at.level};
    if(!built.has(area.id)){const ticket=loading.begin('Lighting the way into '+area.name+'…',{key:'underground-build',delay:0});prepare(area.id).finally(()=>ticket.end())}}
   else if(!at&&current){current=null;window.eldervaleUndergroundArea=null;restoreLighting()}
   if(current)applyLighting(current.area);if(skyMesh)skyMesh.visible=!current;
   if(now()>lastScan){lastScan=now()+1000;prefetch(p);
    for(const [id,entry] of built)entry.ready.then(b=>{if(b)b.group.visible=Math.hypot(b.area.origin.x-p.x,b.area.origin.z-p.z)<1400})}
   if(tween){if(stepTween(tween,player))tween=null}
   for(const [id,t] of remoteTweens){if(!t.root?.parent){remoteTweens.delete(id);continue}if(stepTween(t,t.root))remoteTweens.delete(id)}
  },
  // Minimap: the underground level replaces the terrain atlas.
  drawMap(ctx,w,h,extent,position){const at=position&&undergroundAt(position.x,position.z);if(!at)return false;const entry=built.get(at.area.id);
   const ppu=w/extent,toX=x=>w/2+(x-position.x)*ppu,toY=z=>h/2+(z-position.z)*ppu,g=at.grid;
   ctx.clearRect(0,0,w,h);ctx.fillStyle='#120f0d';ctx.fillRect(0,0,w,h);
   const canvas=entry?._levels?.get(at.level)||levelCanvas(g,at.area.theme);if(entry){entry._levels??=new Map();entry._levels.set(at.level,canvas)}
   if(canvas){ctx.imageSmoothingEnabled=false;ctx.drawImage(canvas,toX((g.i0-.5)*TILE),toY((g.j0-.5)*TILE),g.w*TILE*ppu,g.h*TILE*ppu)}
   for(const l of at.area.lights||[]){if(l.level!==at.level)continue;const o=levelOrigin(at.area,at.level);ctx.fillStyle=l.kind==='lava'?'#ff6a2a':l.kind==='fungus'?'#6fe3c8':l.kind==='crystal'?'#9ab8ff':'#ffb35a';ctx.beginPath();ctx.arc(toX(o.x+l.x),toY(o.z+l.z),Math.max(1.5,ppu*.7),0,Math.PI*2);ctx.fill()}
   for(const p of passageObjects(at.area)){if(!undergroundAt(p.x,p.z)||undergroundAt(p.x,p.z).level!==at.level)continue;ctx.fillStyle='#f2d36b';ctx.fillRect(toX(p.x)-2.5,toY(p.z)-2.5,5,5)}
   ctx.fillStyle='rgba(242,211,107,.9)';ctx.font='bold 10px Georgia';ctx.textAlign='left';ctx.fillText(at.area.name+' · '+(at.area.levels.find(l=>l.level===at.level)?.name||''),6,h-8);
   return true},
  // Mark world-object hit boxes as passages / shortcuts / typed fishing spots.
  tagHit(hit,d){if(!hit||!d)return;const u=hit.userData;
   if(d.passage&&PASSAGE_TEMPLATES[d.template]){u.kind='passage';u.passage=d.passage;u.template=d.template;u.name=d.name||PASSAGE_TEMPLATES[d.template];hit.scale.set(2.4,1.6,2.4)}
   else if(d.agility&&AGILITY_TEMPLATES[d.template]){u.kind='shortcut';u.agility=d.agility;u.template=d.template;u.name=d.name||AGILITY_TEMPLATES[d.template];hit.scale.set(2,1,Math.max(1,(Number(d.length)||4)/1.3))}
   else if(d.template==='fishing_spot')u.spot=d},
  label(a){if(a.kind==='passage')return (PASSAGE_VERBS[a.template]||'Use')+' '+(a.name||'');if(a.kind==='shortcut')return (AGILITY_VERBS[a.template]||'Use')+' '+a.name+' (Agility '+(a.agility?.level||1)+')';return null},
  // Nearest end of a shortcut (players walk there, not into the river).
  approach(a,position){if(a.kind!=='shortcut')return {x:a.x,z:a.z};const ends=a.agility?.ends||[];let best=ends[0]||[a.x,a.z];for(const e of ends)if(Math.hypot(e[0]-position.x,e[1]-position.z)<Math.hypot(best[0]-position.x,best[1]-position.z))best=e;return {x:best[0],z:best[1]}},
  async travel(a,target){const dest=a.passage?.dest||[];const into=isUndergroundPoint(dest[0],dest[1]),area=state.areas.find(x=>x.id===a.passage?.area),name=area?.name||'the way';
   const job=loading.begin((into?(a.passage.depth>0||undergroundAt(dest[0],dest[1])?.level>0?'Descending into ':'Entering '):'Climbing out of ')+name+'…',{key:'underground-travel',delay:0,priority:2});
   try{if(into&&area)await prepare(area.id);await command('travel',{target})}finally{job.end()}},
  // Click handling for passages and shortcuts (game.js asks first). Returns true when handled.
  click(hit,e,{approachAndAct,menuAt,player,skillLevel=()=>1}){const a=hit?.object?.userData;if(!a||(a.kind!=='passage'&&a.kind!=='shortcut'))return false;const target=a.worldEntityId||a.realmId;
   const go=()=>{const at=api.approach(a,player.position);approachAndAct({x:at.x,z:at.z,reach:a.kind==='shortcut'?1.6:3,label:api.label(a),act:()=>a.kind==='passage'?api.travel(a,target):void command('agility',{target})})};
   const examine=()=>say(a.kind==='passage'?(a.name+'. '+(isUndergroundPoint(...(a.passage?.dest||[0,0]))?'It leads underground.':'It leads back up.')):a.name+' — needs Agility '+(a.agility?.level||1)+'. '+(a.agility?.fail?'Risky: '+Math.round(failChance(skillLevel('agility'),a.agility.level,a.agility.fail,a.agility.margin)*100)+'% chance to slip at your level.':'Safe once you have the level.'));
   if(e.button===2)menuAt(e.clientX,e.clientY,[[api.label(a),go],['Examine',examine],['Cancel',()=>{}]]);else go();return true},
  // Realm events: travel (loading chip ends, notice), agility (crossing animation), spots moving.
  event(e,selfId,{remoteRoot=()=>null,player}={}){
   if(e.type==='travel'){if(e.player===selfId){const at=e.to&&undergroundAt(e.to[0],e.to[1]);say(at?'You enter '+at.area.name+(at.level?' — '+(at.area.levels.find(l=>l.level===at.level)?.name||''):'')+'.':'You climb back into daylight.')}return true}
   if(e.type==='agility'){const root=e.player===selfId?player:remoteRoot(e.player);
    if(root&&Array.isArray(e.from)&&Array.isArray(e.to)){const t=setTween(root,e),far=Array.isArray(e.toward)?e.toward:e.to;if(!t.ok){t.dirX=far[0]-e.from[0];t.dirZ=far[1]-e.from[1]}
     if(e.player===selfId)tween=t;else remoteTweens.set(e.player,t);const yaw=Math.atan2(far[0]-e.from[0],far[1]-e.from[1]);if(Number.isFinite(yaw))root.rotation.y=yaw}
    if(e.player===selfId)say(e.ok===false?'You slip and fall'+(e.damage?' — '+e.damage+' damage':'')+'.':'You make it across. +'+(e.xp||0)+' Agility XP');return true}
   if(e.type==='fishing_spot_moved')return true;
   return false},
  dispose(){for(const entry of built.values())entry.ready.then(b=>{if(b){b.group.removeFromParent();b.group.traverse(o=>{if(o.isMesh&&!o.geometry.userData?.eldervaleShared)o.geometry.dispose()})}});built.clear();restoreLighting()}
 };
 return api;
}
