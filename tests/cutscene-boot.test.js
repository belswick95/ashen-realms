import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {createRegionStreamer} from '../region-streamer.js';
import {afterArrival,cutsceneBootFocus,cutsceneBusy,holdRender,deferReflections,prewarmShot} from '../cutscene-boot.js';
import * as T from 'three';

const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('region streaming builds the nearest rows first and near(radius) resolves before far regions finish',async()=>{
 const rows=new Map(),loaded=new Map(),p={x:0,z:0},order=[];let yields=0,time=0;
 const s=createRegionStreamer({rows,loaded,position:()=>p,now:()=>time,budget:5,yieldFrame:async()=>{yields++},apply:r=>{time+=3;order.push(r.id);loaded.set(r.id,r)},remove:id=>loaded.delete(id)});
 // Far rows arrive first in the snapshot; the castle-sized cluster near the player must still lead.
 const far=Array.from({length:40},(_,i)=>({id:'far'+i,revision:1,data:{x:120+i,z:0}})),near=Array.from({length:10},(_,i)=>({id:'near'+i,revision:1,data:{x:i*5,z:3}}));
 const all=s.upsert([...far,...near]);let nearDone=false,allDone=false;
 const ready=s.near(60).then(()=>{nearDone=true;assert.equal(allDone,false,'near() must not wait for far rows');assert.ok(near.every(r=>loaded.has(r.id)));assert.ok(loaded.size<50)});
 all.then(()=>{allDone=true});
 await ready;await all;assert.ok(nearDone&&allDone);
 assert.deepEqual(order.slice(0,10).sort(),near.map(r=>r.id).sort(),'nearest rows build first');
 assert.equal(loaded.size,50);
 assert.ok(await Promise.race([s.near(60).then(()=>true),new Promise(r=>setTimeout(()=>r(false),50))]),'already loaded → resolves at once');
});

test('the controls stop blocking once the critical radius is built, not when the whole region is',async()=>{
 const rows=new Map(),loaded=new Map(),p={x:0,z:0},progress=[];let time=0;
 const s=createRegionStreamer({rows,loaded,position:()=>p,now:()=>time,budget:5,yieldFrame:async()=>{},apply:r=>{time+=3;loaded.set(r.id,r)},remove:id=>loaded.delete(id),onProgress:e=>progress.push({...e,loaded:loaded.size})});
 await s.upsert([{id:'here',revision:1,data:{x:1,z:1}},...Array.from({length:30},(_,i)=>({id:'f'+i,revision:1,data:{x:100+i,z:0}}))]);
 const firstFree=progress.findIndex(e=>e.pending&&!e.blocking);assert.ok(firstFree>0,'blocking lifts mid-drain');assert.ok(progress[firstFree].loaded<31);
});

test('boot order: a new character’s world load waits only for the cutscene area; warm-up and far work wait for the arrival scene',()=>{
 const game=read('game.js'),boot=read('cutscene-boot.js');
 assert.match(game,/window\.eldervaleWorldBridge\.apply=rows=>\{const all=regionStreamer\.upsert\(rows\);return cutsceneBootFocus\(\)\?Promise\.race\(\[all,regionStreamer\.near\(CUTSCENE_FOCUS_RADIUS\)\]\):all\};/);
 assert.match(game,/const shaderWarmup=afterArrival\(2500\)\.then\(/);
 assert.match(boot,/export const CUTSCENE_FOCUS_RADIUS=/);
});

test('afterArrival: background work starts on time without a cutscene, and only after the arrival scene ends otherwise',async()=>{
 const t0=Date.now();await afterArrival(10,{busy:()=>false,poll:5});assert.ok(Date.now()-t0<200);
 let busy=true,done=false;const p=afterArrival(5,{busy:()=>busy,poll:5,settle:40}).then(()=>done=true);
 await new Promise(r=>setTimeout(r,60));assert.equal(done,false,'waits while the scene plays');
 busy=false;const off=Date.now();await p;assert.ok(Date.now()-off>=35,'settles after the scene');
 globalThis.eldervalePrologue={active:true};assert.equal(cutsceneBootFocus(),true);assert.equal(cutsceneBusy(),true);
 globalThis.eldervalePrologue={active:false};globalThis.eldervaleCutscene={active:true};assert.equal(cutsceneBootFocus(),false);assert.equal(cutsceneBusy(),true);
 delete globalThis.eldervalePrologue;delete globalThis.eldervaleCutscene;
});

test('first 3D frame is the cutscene shot: no gameplay frame behind the prologue, no reflection pass, no minimap atlas',()=>{
 globalThis.eldervaleCutscene={active:true};assert.equal(deferReflections(),true,'any cutscene: no reflection pass');globalThis.eldervaleCutscene={active:false};assert.equal(deferReflections(),false,'a returning player\'s quest scene leaves reflections alone afterwards');
 globalThis.eldervalePrologue={active:true};assert.equal(holdRender(),true,'prologue up, scene not started: nothing drawn');
 globalThis.eldervaleCutscene={active:true,to:null,follow:null};assert.equal(holdRender(),true,'scene started, first shot not placed yet');
 globalThis.eldervaleCutscene.to={eye:{}};assert.equal(holdRender(),false,'first shot placed: draw it');
 assert.equal(deferReflections(),true,'no water reflection render during the scene');
 globalThis.eldervalePrologue={active:false};globalThis.eldervaleCutscene={active:false};
 assert.equal(holdRender(),false);assert.equal(deferReflections(),true,'still off until the background warm-up compiled the reflection shaders');
 globalThis.eldervaleShaderWarmup={done:1};assert.equal(deferReflections(),false);
 delete globalThis.eldervalePrologue;delete globalThis.eldervaleCutscene;delete globalThis.eldervaleShaderWarmup;
 const game=read('game.js');
 assert.match(game,/\}if\(!holdRender\(\)\)renderer\.render\(scene,camera\);/);
 assert.match(game,/if\(deferReflections\(\)\)waterSystem\.uniforms\.waterTime\.value=[^;]+;else waterSystem\.update\(/);
 assert.match(game,/let terrainPainted=false;function paintTerrain\(\)\{if\(terrainPainted\|\|cutsceneBusy\(\)\)return;/);
 assert.match(game,/function drawMap\(ctx,canvas,scale,view\)\{paintTerrain\(\);/);
 assert.match(game,/if\(!cutsceneBusy\(\)\)\{if\(Math\.floor\(performance\.now\(\)\/250\)!==window\._mapFrame\)/);
 // Shader compiles during the scene's first frames must not read as a slow device (resolution/tier drops).
 assert.match(game,/function governFrame\(elapsed\)\{if\(clientSettings\.preset!=='auto'\|\|document\.hidden\|\|classicLook\.enabled\|\|cutsceneBusy\(\)\)return;/);
 // Shot timings start at the shot's first rendered frame, so slow first frames never skip a shot.
 const tut=read('tutorial.js');assert.match(tut,/if\(s\.shot\)\{setShot\(s\.shot,s\.fade\?0:s\.ms\|\|0\);await shotShown\(\)\}/);
});

test('prewarm draws only the opening shot, clipped to one pixel, and restores the renderer',()=>{
 const calls=[];let test=false,box=new T.Vector4(0,0,640,360);
 const renderer={getScissorTest:()=>test,setScissorTest:v=>{test=v;calls.push(['test',v])},getScissor:t=>t.copy(box),setScissor:(...a)=>{box=a[0]?.isVector4?a[0].clone():new T.Vector4(...a);calls.push(['scissor',box.toArray()])},render:(scene,cam)=>calls.push(['render',cam.position.toArray(),test,box.toArray()])};
 const sun={shadow:{needsUpdate:false}},camera=new T.PerspectiveCamera(55,1.6,.1,450);
 prewarmShot({T,renderer,scene:new T.Scene(),camera,sun,eye:[-340,24,-246],look:[-340,4,-318]});
 const r=calls.find(c=>c[0]==='render');assert.deepEqual(r[1],[-340,24,-246]);assert.equal(r[2],true);assert.deepEqual(r[3],[0,0,1,1]);
 assert.equal(test,false);assert.deepEqual(box.toArray(),[0,0,640,360]);assert.equal(sun.shadow.needsUpdate,true,'the shadow pass compiles too');
 assert.deepEqual(camera.position.toArray(),[0,0,0],'the game camera is untouched');
 assert.match(read('tutorial.js'),/if\(prologue\?\.state\?\.narrating&&prewarm\)\{const first=sceneData\.steps\.find\(s=>s\.shot\?\.eye\)/);
});
