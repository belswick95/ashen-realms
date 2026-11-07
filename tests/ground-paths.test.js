import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';import fs from 'node:fs';
import {initializeGeography,worldRoads,roadPoints,roadLines,distanceToRoad} from '../geography.js?v=release-20261107-animals159';
const world=JSON.parse(fs.readFileSync(new URL('../db/generated-world.json',import.meta.url)));initializeGeography(world.config);
const {meander,roadStroke,entityStroke,discStroke,surfaceStrokes,paintPathMask,sampleMask,pathCover,patchGroundShader,createGroundPaths,halfWidthAt,PATH_MASK}=await import('../ground-paths.js');
const {clutterBudget,clutterKind,createGroundClutter,CLUTTER_KINDS,CLUTTER_BUDGET}=await import('../ground-clutter.js');
const {createClassicLook}=await import('../classic-look.js');
const {castleBlueprint,inCastle,castle}=await import('../castle-layout.js?v=release-20261107-animals159');
const {capitalBlueprint,inCapital}=await import('../capital-layout.js?v=release-20261107-animals159');
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const size=PATH_MASK.size,extent=840,texel=extent/size;
const segDist=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],t=Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz)));return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)};
const lineDist=(x,z,pts)=>{let d=Infinity;for(let i=1;i<pts.length;i++)d=Math.min(d,segDist(x,z,pts[i-1],pts[i]));return d};

test('trails meander gently around the route but keep their ends (junctions and doors) in place',()=>{
 for(const [a,b] of worldRoads){const route=roadPoints(a,b),m=meander(route,{amplitude:1.4,wavelength:26,seed:7,taper:10});
  assert.deepEqual(m[0].slice(0,2),route[0]);assert.ok(Math.hypot(m.at(-1)[0]-b[0],m.at(-1)[1]-b[1])<1e-9,'the far end stays put');
  const off=m.map(([x,z])=>lineDist(x,z,route));const max=Math.max(...off);
  if(Math.hypot(b[0]-a[0],b[1]-a[1])>60){assert.ok(max>.6,'visibly winding: '+max);assert.ok(max<=1.45,'within the graded road bed: '+max)}
 }
 // A straight castle street becomes a curve, not a ruler line, with the same ends.
 const gate=castleBlueprint().find(d=>d.template==='road'&&d.length===50),st=entityStroke(gate,'cobble'),p=st.points;
 const a=[p[0][0],p[0][1]],b=[p.at(-1)[0],p.at(-1)[1]];assert.ok(Math.abs(Math.hypot(b[0]-a[0],b[1]-a[1])-50)<1e-6);
 const bend=Math.max(...p.map(([x,z])=>segDist(x,z,a,b)));assert.ok(bend>.4&&bend<1.2,'gentle curve: '+bend);
 // Widths swell and narrow.
 const w=Array.from({length:60},(_,i)=>halfWidthAt(3,i*2,11));assert.ok(Math.max(...w)-Math.min(...w)>.2);assert.ok(Math.min(...w)>1.1&&Math.max(...w)<1.9);
});

test('path masks are not straight-edged: the drawn edge wobbles along a straight street',()=>{
 const data=new Uint8Array(size*size*4),d={template:'road',x:0,z:0,yaw:0,length:60,width:4};
 paintPathMask(data,[entityStroke(d,'cobble')],{size,extent});
 // Walk across the street every metre and find where the shader draws its edge (cover 0.5).
 const edges=[];for(let z=-20;z<=20;z+=1){let edge=null;for(let x=0;x<6;x+=.05)if(pathCover(data,x,z)<.5){edge=x;break}assert.ok(edge!==null);edges.push(edge)}
 const mean=edges.reduce((s,v)=>s+v,0)/edges.length,sd=Math.sqrt(edges.reduce((s,v)=>s+(v-mean)**2,0)/edges.length);
 assert.ok(sd>.12,'irregular edge, sd '+sd.toFixed(3));assert.ok(Math.abs(mean-2)<1,'about the street width: '+mean.toFixed(2));
 // Soft blend: there is a band where the mask is partial, not a hard step.
 let partial=0;for(let x=0;x<5;x+=.1){const c=sampleMask(data,x,0).cobble;if(c>.1&&c<.9)partial++}assert.ok(partial>=8,'soft rim '+partial);
 // The middle of the street is fully paved; far off it nothing is drawn.
 assert.ok(sampleMask(data,0,0).cobble>.95);assert.equal(sampleMask(data,9,0).cover,0);
});

test('cobbles in the castle, capital and towns; dirt in the countryside',()=>{
 const paved=(x,z)=>inCastle(x,z,-12)||inCapital(x,z,-1);
 const rows=[...castleBlueprint(),...capitalBlueprint()].map(data=>({data}));const strokes=surfaceStrokes(rows,{paved});
 assert.ok(strokes.length>=25);const castleRoads=strokes.filter((s,i)=>i<3);assert.ok(castleRoads.every(s=>s.kind==='cobble'),'castle streets are cobbled');
 const farm=capitalBlueprint().find(d=>d.name==='Farm Lane');assert.equal(surfaceStrokes([{data:farm}],{paved:()=>false})[0].kind,'dirt','an unpaved track outside stays dirt');
 const data=new Uint8Array(size*size*4);paintPathMask(data,[...worldRoads.map(([a,b])=>roadStroke(roadPoints(a,b))),...strokes],{size,extent,paved});
 const court=sampleMask(data,castle.x,castle.z+23);assert.ok(court.cobble>.9&&court.dirt===0,'castle gate road');
 // Halfway along the Birchford-castle road: open country, a dirt trail.
 const line=roadLines[0],mid=line[16];const m=sampleMask(data,mid[0],mid[1]);assert.ok(m.dirt>.5&&m.cobble===0,'country trail is dirt');
 // A plaza is a soft, irregular disc.
 const disc=new Uint8Array(size*size*4);paintPathMask(disc,[discStroke(100,100,8)],{size,extent});const radii=[];for(let i=0;i<16;i++){const a=i*Math.PI/8;let r=0;while(sampleMask(disc,100+Math.cos(a)*r,100+Math.sin(a)*r).cobble>.5)r+=.1;radii.push(r)}assert.ok(Math.max(...radii)-Math.min(...radii)>.6,'irregular rim');
});

test('paths are visual only: route data, grading and footstep checks keep the original centrelines',()=>{
 for(const [i,[a,b]] of worldRoads.entries())assert.deepEqual(roadLines[i],roadPoints(a,b));
 assert.equal(distanceToRoad(...roadLines[0][10]),0);
 const game=read('game.js');assert.doesNotMatch(game,/pathMaterial/,'no ribbon meshes drawn over the terrain');
 assert.match(game,/groundPaths\.extend\(groundMaterial,'regular'\)/);assert.match(game,/terrainShader:m=>groundPaths\.extend\(m,'classic'\)/);
 assert.match(game,/if\(d\.template==='road'\)\{mesh\.visible=false;mesh\.userData\.pathSplat=true\}/,'road entities keep their (hidden) mesh for picking and editing');
 assert.doesNotMatch(read('landscape.js')+read('movement-collision.js')+read('tile-grid.js'),/ground-paths/,'collision, grading and tiles do not read the drawn paths');
});

test('one terrain program per mode: the splat patches Standard and Lambert at stable hooks',()=>{
 for(const [lib,variant] of [['standard','regular'],['lambert','classic']]){
  const shader={vertexShader:T.ShaderLib[lib].vertexShader,fragmentShader:T.ShaderLib[lib].fragmentShader,uniforms:{}},uniforms={groundPathMask:{value:null},groundPathFrame:{value:null}};
  patchGroundShader(shader,uniforms,variant);
  assert.equal(shader.vertexShader.match(/vGroundWorld=\(modelMatrix\*vec4\(transformed,1\.\)\)\.xz;/g).length,1);
  assert.equal(shader.fragmentShader.match(/texture2D\(groundPathMask/g).length,1,'the mask is sampled once per pixel');
  assert.ok(shader.fragmentShader.indexOf('gpAmount=max')>shader.fragmentShader.indexOf('#include <color_fragment>'),'paths replace the ground colour after vertex colours');
  assert.equal(shader.fragmentShader.startsWith('#define GROUND_CLASSIC'),variant==='classic');assert.equal(shader.uniforms.groundPathMask,uniforms.groundPathMask,'the mask is a shared uniform');
 }
 const paths=createGroundPaths(T,{extent:840,size:64}),a=new T.MeshStandardMaterial(),b=new T.MeshLambertMaterial();
 const before=a.onBeforeCompile;let inner=0;a.onBeforeCompile=()=>inner++;paths.extend(a,'regular');paths.extend(b,'classic');
 const key=a.customProgramCacheKey();assert.equal(a.customProgramCacheKey(),key,'stable program key');assert.notEqual(key,b.customProgramCacheKey());
 const s={vertexShader:T.ShaderLib.standard.vertexShader,fragmentShader:T.ShaderLib.standard.fragmentShader,uniforms:{}};a.onBeforeCompile(s);assert.equal(inner,1,'existing terrain hook (biome textures, weather) still runs');assert.ok(s.uniforms.groundPathMask);assert.notEqual(before,a.onBeforeCompile);
 // Repainting does not touch the program: it only re-uploads the mask.
 const rev=paths.revision;assert.equal(paths.setSurfaces([entityStroke({x:0,z:0,length:10,width:3},'dirt')]),true);assert.equal(paths.revision,rev+1);assert.equal(paths.setSurfaces([entityStroke({x:0,z:0,length:10,width:3},'dirt')]),false,'unchanged streets are not repainted');
 assert.equal(a.customProgramCacheKey(),key);assert.equal(paths.uniforms.groundPathMask.value,paths.texture);
});

test('ground clutter: preset budgets, phone cap, one shared program and repeatable scatter',()=>{
 assert.deepEqual(clutterBudget('high',{classic:true}),CLUTTER_BUDGET.high);assert.deepEqual(clutterBudget('ultra',{classic:true,phone:true}),CLUTTER_BUDGET.low,'phones get the low budget');
 const regular=clutterBudget('high');assert.equal(regular.flower,0,'regular mode keeps its meadow flowers');assert.ok(regular.tuft<CLUTTER_BUDGET.high.tuft&&regular.pebble===CLUTTER_BUDGET.high.pebble);
 for(const kind of CLUTTER_KINDS)assert.ok(CLUTTER_BUDGET.low[kind]<CLUTTER_BUDGET.high[kind]&&CLUTTER_BUDGET.high[kind]<=CLUTTER_BUDGET.ultra[kind]);
 const seq=s=>{let n=s;return ()=>{n=(n*16807)%2147483647;return n/2147483647}},lush={grass:1,castle:0,snow:0,dry:0};
 const count=(cover,edge)=>{const r=seq(9),out={};for(let i=0;i<4000;i++){const k=clutterKind(cover,edge,lush,r);out[k]=(out[k]||0)+1}return out};
 const onPath=count(.9,.9),verge=count(.2,.3),grass=count(0,0);assert.ok(!onPath.tuft&&!onPath.flower&&onPath.pebble>40,'stones, never grass, on the trail');assert.ok(verge.pebble>1000,'gravel along the edges');assert.ok(grass.tuft>900&&grass.flower>60&&grass.twig>10);
 const scene=new T.Scene(),land={heightAt:()=>0,waterAt:()=>0},clutter=createGroundClutter(T,scene,land,{seed:5});
 const meshes=Object.values(clutter.meshes);assert.equal(meshes.length,4);assert.ok(meshes.every(m=>m.material===clutter.material),'one material, one program for every kind');
 assert.equal(clutter.material.customProgramCacheKey(),'ground-clutter');assert.equal(clutter.material.userData.classicKeep,true,'Classic keeps the clutter material as is');
 assert.ok(meshes.every(m=>!m.castShadow&&m.count===0));clutter.configure({preset:'low',classic:true});assert.equal(clutter.uniforms.clutterRange.value,CLUTTER_BUDGET.low.radius);
});

test('classic look adopts the path splat on its terrain and keeps the canopy fade and texture hooks',()=>{
 const scene=new T.Scene(),ground=new T.Mesh(new T.PlaneGeometry(10,10,4,4).rotateX(-Math.PI/2),new T.MeshStandardMaterial({vertexColors:true}));ground.geometry.setAttribute('climate',new T.BufferAttribute(new Float32Array(25*4).fill(.25),4));
 const fadeHook=shader=>{shader.vertexShader+='\n//canopy';},leaves=new T.MeshStandardMaterial({color:0xd4dfc3,map:new T.Texture(),alphaTest:.4});leaves.userData.canopyFade=true;leaves.onBeforeCompile=fadeHook;leaves.customProgramCacheKey=()=>'canopy-fade';
 const tree=new T.Mesh(new T.PlaneGeometry(),leaves);scene.add(ground,tree);
 const paths=createGroundPaths(T,{extent:840,size:64}),look=createClassicLook(T,{scene,renderer:{domElement:{style:{}}},camera:new T.PerspectiveCamera(),hiddenLayer:31});
 look.configure({ground,terrainShader:m=>paths.extend(m,'classic')});look.set(true);
 assert.equal(ground.material.userData.groundPaths,'classic');assert.match(ground.material.customProgramCacheKey(),/ground-paths-classic/);
 const s={vertexShader:T.ShaderLib.lambert.vertexShader,fragmentShader:T.ShaderLib.lambert.fragmentShader,uniforms:{}};ground.material.onBeforeCompile(s);assert.ok(s.fragmentShader.startsWith('#define GROUND_CLASSIC'));
 assert.ok(tree.material.isMeshLambertMaterial&&tree.material.userData.canopyFade,'leaves keep their fade hook');assert.equal(tree.material.customProgramCacheKey(),'classic-canopy|cutout');
 const v={vertexShader:T.ShaderLib.lambert.vertexShader,fragmentShader:T.ShaderLib.lambert.fragmentShader,uniforms:{}};tree.material.onBeforeCompile(v,null);assert.match(v.vertexShader,/\/\/canopy$/);
 assert.ok(tree.material.color.g<=leaves.color.g&&tree.material.color.b<leaves.color.b*.8,'chunky, darker green canopies');
 look.set(false);assert.equal(ground.material.isMeshStandardMaterial,true);assert.equal(tree.material,leaves);
});
