import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {sharedGeometry,sharedCustomGeometry,sharedMaterial,disposeOwned,sharedStats,geometryKey} from '../shared-geometry.js';
import {actorModel,objectModel} from '../world-models.js';
import {warmupList,runShaderWarmup} from '../shader-warmup.js';
import {worldTemplates} from '../world-templates.js';
import {quantizeColor,quantizeHex,classicPixelRatio,simplifiedParameters,terrainColor,terrainJitter,classicEnabled,blobRadius,createClassicLook,rgbToHsl,PALETTE_STEPS,facetedGeometry,textureGrade,gradeTexel,CLASSIC_TEXTURE} from '../classic-look.js';
import {governorOptions,leanGraphics,LEAN} from '../graphics-quality.js';
import {createCellBatcher} from '../static-batch.js';

test('shared geometry and materials are pooled by parameters and survive owner disposal',()=>{
 const a=sharedGeometry(T,'sphere',1,20,14),b=sharedGeometry(T,'sphere',1,20,14),c=sharedGeometry(T,'sphere',1,12,8);
 assert.equal(a,b);assert.notEqual(a,c);assert.equal(a.userData.eldervaleShared,true);assert.equal(geometryKey('box',[1,2.000001,3]),'box(1,2,3)');
 assert.equal(sharedCustomGeometry(T,'k',()=>new T.BoxGeometry()),sharedCustomGeometry(T,'k',()=>assert.fail('built twice')));
 const m=sharedMaterial(T,'test-red',()=>new T.MeshStandardMaterial({color:0xff0000}));assert.equal(sharedMaterial(T,'test-red',()=>null),m);
 const root=new T.Group(),own=new T.BoxGeometry();root.add(new T.Mesh(a,m),new T.Mesh(own,m));
 let disposed=[];for(const r of [a,m,own])r.addEventListener('dispose',()=>disposed.push(r));
 disposeOwned(root);assert.deepEqual(disposed,[own],'only the unshared geometry is disposed');
 assert.ok(sharedStats(T).hits>=3);
});

test('two monsters of a species share every geometry; disposing one keeps the other intact',()=>{
 const build=d=>{const root=new T.Group();return {root,model:actorModel(T,root,d)}};
 const d={species:'wolf',kind:'monster',horns:true,spikes:true,aura:0xff8040,eyes:0xff3030,tint:0x6a3d7a,accent:0xe0c060};
 const one=build(d),two=build(d);const geo=r=>{const s=[];r.traverse(o=>{if(o.isMesh)s.push(o.geometry)});return s};
 const g1=geo(one.root),g2=geo(two.root);assert.equal(g1.length,g2.length);assert.ok(g1.length>20);
 assert.ok(g1.every((g,i)=>g===g2[i]),'same geometry objects');assert.ok(g1.every(g=>g.userData.eldervaleShared));
 const mats=r=>{const s=new Set();r.traverse(o=>{if(o.isMesh)s.add(o.material)});return s};
 assert.deepEqual([...mats(one.root)],[...mats(two.root)],'same materials');
 let disposed=0;for(const g of g1)g.addEventListener('dispose',()=>disposed++);
 one.model.dispose();assert.equal(disposed,0,'shared geometry is never disposed with a monster');
 const dragonA=new T.Group(),dragonB=new T.Group();actorModel(T,dragonA,{species:'dragon'});actorModel(T,dragonB,{species:'dragon'});
 assert.deepEqual(geo(dragonA),geo(dragonB));
 const rockA=new T.Group(),rockB=new T.Group();objectModel(T,rockA,'rock',{});objectModel(T,rockB,'rock',{});assert.deepEqual(geo(rockA).slice(-4),geo(rockB).slice(-4),'boulders share their sculpted geometry');
});

test('shader warm-up covers each prop template and creature family once, skipping buildings',async()=>{
 const list=warmupList(worldTemplates);const ids=list.map(i=>i.id);
 assert.ok(!ids.includes('cottage')&&!ids.includes('road'));assert.ok(ids.includes('castle_tower')&&ids.includes('lantern'));
 const species=list.filter(i=>i.kind==='actor'&&i.data.species).map(i=>i.data.species);assert.ok(species.includes('dragon')&&species.includes('wolf'));
 assert.equal(new Set(species.filter((s,i)=>list[i]?.id!=='roster-variant')).size>=10,true);
 const log=[];const r=await runShaderWarmup([{id:'a'},{id:'b'},{id:'c'}],{build:i=>{if(i.id==='b')throw Error('x');return {id:i.id}},compile:root=>{log.push('compile '+root.id)},dispose:root=>log.push('dispose '+root.id)});
 assert.deepEqual(r,{done:3,failed:1});assert.deepEqual(log,['compile a','dispose a','compile c','dispose c']);
 // Real models build and dispose cleanly in Node.
 for(const item of list.slice(0,12)){const root=new T.Group();if(item.kind==='actor')actorModel(T,root,item.data).dispose?.();else objectModel(T,root,item.id,{...item.data,groundHeight:()=>0})}
});

test('classic palette is limited and warm; resolution, low-poly and terrain helpers',()=>{
 const seen=new Set();let s=7;const rnd=()=>{s=(s*16807)%2147483647;return s/2147483647};
 for(let i=0;i<4000;i++)seen.add(quantizeColor(rnd(),rnd(),rnd()).map(v=>v.toFixed(3)).join());
 assert.ok(seen.size<=PALETTE_STEPS.hues*PALETTE_STEPS.saturation.length*PALETTE_STEPS.lightness,'palette size '+seen.size);assert.ok(seen.size>60);
 const [h]=rgbToHsl(...quantizeColor(.9,.75,.35));const [h0]=rgbToHsl(.9,.75,.35);assert.ok(Math.abs(h-30/360)<=Math.abs(h0-30/360)+1/24);
 assert.equal(quantizeHex(0x808080),quantizeHex(0x818181),'near colours collapse');
 // Full device resolution (within the device cap), never a low-res pixelated framebuffer.
 assert.equal(classicPixelRatio({devicePixelRatio:2,pixelCap:1.5}),1.5);assert.equal(classicPixelRatio({devicePixelRatio:1,pixelCap:2}),1);assert.equal(classicPixelRatio({devicePixelRatio:3,pixelCap:1.25}),1.25);
 assert.equal(classicPixelRatio({devicePixelRatio:2,pixelCap:2,governor:.5}),1.5,'the governor trims at most 25 %');assert.ok(classicPixelRatio({devicePixelRatio:1})>=1);
 const sphere=new T.SphereGeometry(1,20,14),q=simplifiedParameters('SphereGeometry',sphere.parameters);assert.deepEqual(q.slice(0,3),[1,8,6]);
 assert.equal(simplifiedParameters('SphereGeometry',new T.SphereGeometry(1,6,4).parameters),null,'already coarse');
 assert.equal(simplifiedParameters('BoxGeometry',new T.BoxGeometry().parameters),null);
 assert.deepEqual(simplifiedParameters('CylinderGeometry',new T.CylinderGeometry(1,1,2,12,3).parameters).slice(0,5),[1,1,2,6,1]);
 assert.deepEqual(simplifiedParameters('IcosahedronGeometry',new T.IcosahedronGeometry(1,2).parameters),[1,1]);
 const grass=terrainColor([1,0,0,0],1,5),snow=terrainColor([0,1,0,0],1,58),rock=terrainColor([1,0,0,0],.3,10);
 assert.ok(grass[1]>grass[0]&&grass[1]>grass[2],'grass is green');assert.ok(snow[0]>.75&&snow[2]>.7,'snow is pale');assert.ok(Math.abs(rock[0]-rock[1])<.12,'steep slopes are grey rock');
 // Terrain is smooth, blended colour: a small per-point variation, not palette steps.
 const j=[terrainJitter(0,0),terrainJitter(3,0),terrainJitter(0,3)];assert.ok(j.every(v=>v>=-1&&v<=1));assert.notEqual(j[0],j[1]);assert.equal(terrainJitter(3,0),j[1],'deterministic');
 const g1=terrainColor([1,0,0,0],1,5,null,-.2),g2=terrainColor([1,0,0,0],1,5,null,.2);assert.ok(Math.abs(g1[1]-g2[1])>.005&&Math.abs(g1[1]-g2[1])<.06,'subtle variation');
 const own=terrainColor([1,0,0,0],1,5,[.3,.5,.2]),steep=terrainColor([1,0,0,0],.4,5,[.3,.5,.2]);assert.ok(own[1]>own[0]&&own[1]>own[2],'follows the heightfield colour');assert.ok(steep[1]<own[1]&&steep[1]>steep[0],'steep ground is darker but keeps its hue');
 // Faceted only for hard, cut shapes.
 assert.equal(facetedGeometry(new T.IcosahedronGeometry(1,1)),true);assert.equal(facetedGeometry(new T.SphereGeometry(1,8,6)),false);assert.equal(facetedGeometry(new T.BoxGeometry()),false);
 // Low-detail textures: structure detection and softening toward a palette colour.
 const grade=textureGrade([.5,.4,.3]),dark=gradeTexel([.05,.05,.05],grade),light=gradeTexel([.6,.5,.4],grade),mid=gradeTexel(grade.avg,grade);
 assert.ok(light[0]-dark[0]<.55*.95,'contrast softened');assert.ok(light[0]>dark[0],'pattern kept');
 assert.ok(mid.every((v,k)=>Math.abs(v-(grade.avg[k]+grade.shift[k]))<1e-9),'the tile average lands on the palette colour');
 assert.deepEqual(grade.palette,quantizeColor(.5,.4,.3));assert.ok(CLASSIC_TEXTURE.bias>0&&CLASSIC_TEXTURE.contrast<1);
 assert.equal(classicEnabled({},{classicLook:true}),true);assert.equal(classicEnabled({classic:false},{classicLook:true}),false,'the player choice wins');assert.equal(classicEnabled({},null),false,'off by default');
 assert.equal(blobRadius('dragon')>blobRadius('wolf'),true);assert.equal(blobRadius('human'),.55);
});

test('classic look converts lit materials to pooled smooth Lambert, simplifies primitives and restores everything',()=>{
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(),renderer={domElement:{style:{}}};
 const red1=new T.MeshStandardMaterial({color:0xb03020}),red2=new T.MeshStandardMaterial({color:0xb13121,roughness:.2}),glow=new T.MeshBasicMaterial({color:0xffff00});
 const ballGeo=new T.SphereGeometry(1,20,14),a=new T.Mesh(ballGeo,red1),b=new T.Mesh(ballGeo,red2),c=new T.Mesh(new T.BoxGeometry(),glow),d=new T.Mesh(new T.SphereGeometry(1,20,14),glow);a.castShadow=true;
 const ground=new T.Mesh(new T.PlaneGeometry(10,10,4,4).rotateX(-Math.PI/2),new T.MeshStandardMaterial({vertexColors:true}));ground.geometry.setAttribute('climate',new T.BufferAttribute(new Float32Array(25*4).fill(.25),4));
 const hidden=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial());
 // A sculpted boulder (parametric geometry with edited vertices) and a rotated log keep their shape; a rock is faceted.
 const sculpt=new T.IcosahedronGeometry(1,2);sculpt.attributes.position.setX(0,1.7);const rock=new T.Mesh(sculpt,new T.MeshStandardMaterial({color:0x888070}));
 const log=new T.Mesh(new T.CylinderGeometry(.2,.2,3,12).rotateZ(Math.PI/2),new T.MeshStandardMaterial({color:0x6a4a2a}));
 const gem=new T.Mesh(new T.OctahedronGeometry(.3,0),new T.MeshStandardMaterial({color:0x888070}));
 const tex=new T.Texture();tex.wrapS=tex.wrapT=T.RepeatWrapping;tex.userData.baseColor=0x8a6a4a;const wall=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({map:tex}));
 scene.add(a,b,c,d,ground,hidden,rock,log,gem,wall);
 const look=createClassicLook(T,{scene,renderer,camera,hiddenLayer:31});look.configure({ground,hide:()=>[hidden]});
 assert.equal(look.set(true),true);assert.notEqual(renderer.domElement.style.imageRendering,'pixelated','never pixelated');
 assert.ok(a.material.isMeshLambertMaterial&&!a.material.flatShading,'smooth (Gouraud-style) shading');assert.ok(!ground.material.flatShading,'smooth terrain');
 assert.equal(rock.geometry,sculpt,'sculpted geometry is not rebuilt');assert.equal(log.geometry.type,'CylinderGeometry');assert.equal(log.geometry.parameters.radialSegments,12,'transformed geometry is not rebuilt upright');
 assert.ok(gem.material.flatShading&&rock.material.flatShading,'rocks and gems are faceted');
 assert.ok(wall.material.isMeshLambertMaterial&&wall.material.map===tex&&wall.material.customProgramCacheKey()==='classic-graded-texture','tiling textures stay, graded in the shader');assert.equal(a.material,b.material,'near-identical colours share one classic material');
 assert.equal(a.castShadow,false);assert.equal(c.material,glow,'unlit materials are kept');assert.equal(a.geometry,b.geometry);assert.equal(a.geometry.parameters.widthSegments,8,'low-poly sphere');
 assert.equal(d.material,glow);assert.equal(d.geometry.parameters.widthSegments,8,'unlit meshes are simplified too');
 assert.ok(ground.material.vertexColors&&ground.geometry.attributes.color.count===25);assert.equal(hidden.layers.mask>>>0,2**31,'grass hides while classic');
 look.updateBlobs([{root:a,radius:.5},{root:b,radius:.5,hidden:true}]);assert.equal(look.stats().blobs,1);
 assert.ok(scene.children.some(o=>o.name==='classic-blob-shadows'));assert.ok(!scene.children.some(o=>o.name==='classic-sky'),'the normal sky (and weather) stay');
 scene.background=new T.Color(0x123456);look.applySky(1,0);assert.equal(scene.background.getHex(),0x123456,'sky colours are left to the normal renderer');
 const amb=scene.children.find(o=>o.name==='classic-ambient');assert.ok(amb.intensity>.6);look.applySky(0,0);assert.ok(amb.intensity<.4,'dimmer fill at night');look.applySky(1,0);
 // A late mesh is picked up by the time-sliced sweep.
 const late=new T.Mesh(new T.ConeGeometry(1,2,12),new T.MeshStandardMaterial({color:0x335577}));scene.add(late);for(let i=0;i<50&&!late.material.isMeshLambertMaterial;i++)look.update(5);assert.ok(late.material.isMeshLambertMaterial);
 // Gameplay recolouring the source material is mirrored.
 red1.color.set(0x2040c0);for(let i=0;i<50;i++)look.update(5);assert.notEqual(a.material,b.material,'a recoloured source gets its own classic material');
 // The game rebuilds the heightfield after terrain edits; classic bakes the new one and restores it later.
 const rebuilt=new T.PlaneGeometry(10,10,4,4).rotateX(-Math.PI/2);rebuilt.setAttribute('climate',new T.BufferAttribute(new Float32Array(25*4).fill(.25),4));ground.geometry=rebuilt;look.update(5);
 assert.notEqual(ground.geometry,rebuilt);assert.ok(ground.geometry.userData.classicBaked&&ground.geometry.attributes.color);assert.ok(!rebuilt.userData.classicBaked,'the source geometry is not marked');
 look.set(false);assert.equal(a.material,red1);assert.equal(b.material,red2);assert.equal(a.geometry,ballGeo);assert.equal(a.castShadow,true);assert.equal(d.geometry.parameters.widthSegments,20);
 assert.ok(ground.material.isMeshStandardMaterial);assert.equal(ground.geometry,rebuilt,'the rebuilt heightfield comes back');assert.equal(hidden.layers.mask,1);assert.equal(rock.geometry,sculpt);assert.equal(amb.intensity,0);
 assert.equal(look.set(false),false,'no-op when unchanged');
});

test('adaptive quality: device governor floors, lean fallback and cell batch invalidation',()=>{
 assert.equal(governorOptions({phone:true}).min,.5);assert.equal(governorOptions({tablet:true}).min,.6);assert.equal(governorOptions({}).min,.65);
 const lean=leanGraphics({scale:.65,distance:110,shadows:true,fps:true});assert.deepEqual(lean,{scale:LEAN.scale,distance:110,shadows:false,fps:true});
 assert.equal(leanGraphics({scale:1,distance:330,shadows:true}).distance,LEAN.distance);
 const parent=new T.Group(),batcher=createCellBatcher(T,parent,{settle:0});const root=new T.Group();const mat=new T.MeshStandardMaterial();
 for(let i=0;i<3;i++){const m=new T.Mesh(new T.BoxGeometry(),mat);m.position.x=i;root.add(m)}parent.add(root);batcher.add(root,0);assert.equal(batcher.flush(1,true),1);
 assert.equal(batcher.flush(2,true),0,'clean cells are left alone');batcher.invalidateAll(3);assert.equal(batcher.flush(4,true),1,'invalidateAll rebuilds every cell');
});

test('prop lights become proxies served by the fixed pool, so the scene light count never changes',async()=>{
 const {createLightProxies}=await import('../light-proxies.js');
 const scene=new T.Scene(),pool=[new T.PointLight(0xffffff,0),new T.PointLight(0xffffff,0)];scene.add(...pool);
 const proxies=createLightProxies(T,{scene,pool});const count=()=>{let n=0;scene.traverse(o=>{if(o.isLight)n++});return n};
 const fire=new T.Group();fire.position.set(10,0,0);const glow=new T.PointLight(0xff8800,1.5,12,2);glow.position.y=1;fire.add(glow);
 const far=new T.Group();far.position.set(200,0,0);far.add(new T.PointLight(0xff0000,1,8,2));scene.add(fire,far);
 assert.equal(proxies.scan(0),2);assert.equal(count(),2,'only the pooled lights remain');assert.equal(proxies.scan(10),0,'already scanned');
 const near=proxies.nearest(new T.Vector3(),4);assert.equal(near.length,1,'out-of-range proxies are skipped');assert.ok(near[0].position.distanceTo(new T.Vector3(10,1,0))<1e-6);
 proxies.apply(pool[0],near[0]);assert.equal(pool[0].intensity,1.5);assert.equal(pool[0].color.getHex(),0xff8800);assert.equal(pool[0].distance,12);
 glow.intensity=.7;assert.equal(proxies.nearest(new T.Vector3())[0].light.intensity,.7,'flicker on the original light still drives the proxy');
 fire.visible=false;assert.equal(proxies.nearest(new T.Vector3()).length,0,'hidden props give no light');
 scene.remove(fire);assert.equal(proxies.nearest(new T.Vector3()).length,0);assert.equal(proxies.size,1,'removed props are pruned');
});
