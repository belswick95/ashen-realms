// Before/after renders of the kit building art (building-kit.js), offline: the seeded world
// (db/generated-world.json), the Birchford capital blueprint, the castle blueprint and the castle
// tutorial cast, in headless Chromium. Two fresh pages (same clock and weather): one with the kit
// switched off (procedural buildings), one with the kit loaded before the world is applied.
// A third pass loads the kit after the world is up, to check the live rebuild path.
//   node scripts/building-kit-shots.cjs [outputDir]
// Writes <outputDir>/{before,after}-<shot>.png, cutscene-{before,after}-<shot>.png and metrics.json
// (draw calls, triangles, and what blocks each cutscene camera ray).
const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),version=fs.readFileSync(path.join(root,'game.js'),'utf8').match(/\?v=([\w.-]+)'/)[1],manifest=JSON.parse(fs.readFileSync(path.join(root,'db/generated-world.json')));
const output=path.resolve(process.argv[2]||path.join(root,'docs/buildings'));fs.mkdirSync(output,{recursive:true});
const types={'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
const server=http.createServer((req,res)=>{try{const p=new URL(req.url,'http://local').pathname,file=path.join(root,p==='/'?'index.html':decodeURIComponent(p));res.setHeader('content-type',types[path.extname(file)]||'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
// eye/look in world metres; y values are added to the ground height at `at` when `ground` is set.
const shots=[
 {id:'birchford',at:[-218,143],eye:[-150,62,215],look:[-220,0,145]},
 {id:'birchford-street',at:[-229,134],eye:[-221,5,143],look:[-229,2,134],measure:true},
 {id:'birchford-keep',at:[-232,175],eye:[-226,14,158],look:[-232,6,188]},
 {id:'grand-market',at:[-191,160],eye:[-170,22,138],look:[-191,2,166]},
 {id:'castle',at:[-340,-280],eye:[-255,62,-215],look:[-340,0,-305]},
 {id:'castle-gate',at:[-340,-250],eye:[-325,9,-241],look:[-342,2,-267]},
 {id:'winterwatch',at:[217,-243],eye:[262,34,-190],look:[217,0,-243]},
 {id:'emberspire',at:[257,212],eye:[305,34,262],look:[257,0,212]},
 // Arrival cutscene (cutscenes.js): the two fixed shots, the follow shot on the walk to the
 // Keep, and the framed audience shots with the King (approximated from cutscene-camera.js).
 {id:'arrival-1-gate',cutscene:true,at:[-340,-290],eye:[-340,24,-246],look:[-340,4,-318]},
 {id:'arrival-2-courtyard',cutscene:true,at:[-340,-290],eye:[-352,9,-280],look:[-340,2,-296]},
 {id:'arrival-3-walk',cutscene:true,at:[-340,-311],ground:true,eye:[-340,4.2,-303.5],look:[-340,1,-317]},
 {id:'arrival-4-two-shot',cutscene:true,at:[-340,-328.5],ground:true,eye:[-335.6,2.2,-327.4],look:[-340,1.3,-331]},
 {id:'arrival-5-king',cutscene:true,at:[-340,-328.5],ground:true,eye:[-339.2,1.9,-327.1],look:[-340,1.55,-333.2]},
].filter(s=>!process.env.KIT_SHOTS||process.env.KIT_SHOTS.split(',').includes(s.id));
(async()=>{
 const {capitalBlueprint}=await import(path.join(root,'capital-layout.js'));
 const {castleBlueprint}=await import(path.join(root,'castle-layout.js'));
 const {tutorialEntities,tutorialId}=await import(path.join(root,'tutorial-data.js'));
 const capitalRows=capitalBlueprint().map((d,i)=>{const data={...d};if(data.shopItems){data.shop=Object.fromEntries(data.shopItems.map(k=>[k,{buy:10,sell:4,stock:-1}]));delete data.shopItems}return {id:'capital:'+i,data,revision:1}});
 const castleRows=castleBlueprint().filter(d=>d.kind!=='npc').map((data,i)=>({id:'castle:'+i,data,revision:1}));
 const tutorialRows=Object.entries(tutorialEntities).map(([k,data])=>({id:tutorialId(k),data:{yaw:0,...data},revision:1}));
 const rows=[...manifest.entities.map((data,i)=>({id:'scenery:'+i,data,revision:1})),...capitalRows,...castleRows,...tutorialRows];
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.ELDERVALE_CHROMIUM||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const metrics={},errors=[];
 async function pass(phase){
  const p=await browser.newPage({viewport:{width:1280,height:800}});
  p.on('pageerror',e=>{errors.push(phase+': '+e.message);console.log('PAGE',e.message)});
  p.on('console',m=>{if(/Building kit/.test(m.text()))console.log('console:',m.text())});
  await p.route('**/*',r=>{const url=r.request().url();
   if(url.includes('three@0.160.1/examples/jsm/'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/three/examples/jsm',url.split('three@0.160.1/examples/jsm/')[1].split('?')[0]))});
   if(url.includes('three@0.160.1/build/three.module.js'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/three/build/three.module.js'))});
   if(!url.startsWith('http://127.0.0.1:'))return r.abort();const name=new URL(url).pathname;
   if(name==='/auth.js')return r.fulfill({contentType:'text/javascript',body:`globalThis.eldervaleWorldConfig=${JSON.stringify(manifest.config)};document.querySelector('#auth-screen').hidden=true;import('./geography.js?v=${version}').then(g=>g.initializeGeography(globalThis.eldervaleWorldConfig)).then(()=>import('./game.js?v=${version}')).then(()=>window.ready=true);`});
   if(name==='/game.js')return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game.js'),'utf8').replace('function frame(){requestAnimationFrame(frame);','function frame(){if(window.pauseFrames)return;requestAnimationFrame(frame);')+'\nwindow.visualTest={T,scene,camera,renderer,player,landscape,meadow,groundDressing,waterSystem,houseInteriors,worldInstances,frame,render:()=>{naturalSky.update(camera,performance.now(),12,1);skyLight.intensity=1.6;sun.intensity=2;renderer.render(scene,camera)},move:(x,z)=>{player.position.set(x,landscape.walkHeight(x,z),z);cameraFocus=null;window.pauseFrames=false;frame();window.pauseFrames=true}};'});
   r.continue()});
  // Procedural first: the kit stays off until the "after" pass loads it explicitly.
  await p.addInitScript(off=>{window.pauseFrames=true;window.eldervaleNoBuildingKit=off;localStorage.setItem('eldervale-save',JSON.stringify({x:-229,z:134,appearance:{shirt:'#746951',skin:'#c9916b'}}))},phase==='before'||phase==='reskin');
  await p.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded',timeout:180000});
  await p.waitForFunction(()=>window.ready,null,{timeout:180000});
  const kit=await p.evaluate(async ({rows,phase})=>{const w=window.visualTest;w.renderer.setPixelRatio(.8);w.renderer.shadowMap.enabled=false;w.waterSystem.setQuality('low',true);w.move(-218,143);
   let kit=null;if(phase==='after')kit=await window.eldervaleBuildingKit.load();
   await window.eldervaleWorldBridge.apply(rows);await window.eldervaleRegionStreamer.idle();
   if(phase==='reskin'){window.eldervaleNoBuildingKit=false;kit=await window.eldervaleBuildingKit.load()}
   return {status:window.eldervaleBuildingKit.status(),rebuilt:kit}},{rows,phase});console.log(phase,'kit',JSON.stringify(kit));
  const settle=()=>p.evaluate(async()=>{window.pauseFrames=false;window.visualTest.frame();await new Promise(r=>setTimeout(r,2500));window.pauseFrames=true});
  async function shoot(shot,phase){
   const info=await p.evaluate(async s=>{const w=window.visualTest,T=w.T;w.move(s.at[0],s.at[1]);await window.eldervaleRegionStreamer.scan();await window.eldervaleRegionStreamer.idle();
    for(const {root}of w.worldInstances.values())if(root?.userData.leftGate){root.userData.leftGate.rotation.y=-Math.PI*.48;root.userData.rightGate.rotation.y=Math.PI*.48}
    return true},shot);
   await settle();
   const result=await p.evaluate(s=>{const w=window.visualTest,T=w.T;const gy=s.ground?w.landscape.walkHeight(s.at[0],s.at[1]):0;
    const eye=new T.Vector3(s.eye[0],s.eye[1]+gy,s.eye[2]),look=new T.Vector3(s.look[0],s.look[1]+gy,s.look[2]);
    w.camera.position.copy(eye);w.camera.lookAt(look);w.camera.updateMatrixWorld();w.camera.updateProjectionMatrix();w.render();
    const calls=w.renderer.info.render.calls,triangles=w.renderer.info.render.triangles;
    // What stands between the camera and its subject (buildings and castle pieces only).
    const ray=new T.Raycaster(eye,look.clone().sub(eye).normalize(),0,eye.distanceTo(look)-.6);ray.layers.enableAll();
    const roots=[...w.worldInstances.entries()].filter(([,e])=>!e.actor&&e.root);
    const blockers=[];for(const [id,e] of roots){const hit=ray.intersectObject(e.root,true).find(h=>h.object.visible!==false&&h.object.material?.visible!==false);if(hit)blockers.push({id,name:e.house?.name||id,distance:+hit.distance.toFixed(2)})}
    let kitMeshes=0;const detail={};w.scene.traverse(o=>{if(o.isMesh&&o.name?.startsWith('kit:')){kitMeshes++;const k=o.name+'|'+(o.parent?.name||o.parent?.type)+'|'+o.layers.mask;detail[k]=(detail[k]||0)+1}});
    const out={calls,triangles,blockers,kitMeshes};if(s.debug)out.detail=detail;return out},{...shot,debug:!!process.env.KIT_DEBUG});
   const file=path.join(output,(shot.cutscene?'cutscene-':'')+phase+'-'+shot.id+'.png');
   if(phase!=='reskin')await p.screenshot({path:file,timeout:180000,animations:'disabled'});
   console.log(phase,shot.id,JSON.stringify(result));return result;
  }
  await p.addStyleTag({content:'body>:not(canvas){display:none!important}'});
  for(const shot of phase==='reskin'?shots.filter(s=>s.measure||s.id==='castle'):shots)(metrics[shot.id]??={})[phase]=await shoot(shot,phase);
  metrics['kit-'+phase]=kit;await p.close();if(phase!=='before'&&kit.status!=='ready')errors.push(phase+': kit '+kit.status);
 }
 try{
  for(const phase of (process.env.KIT_PHASES||'before,after,reskin').split(','))await pass(phase);
  fs.writeFileSync(path.join(output,'metrics.json'),JSON.stringify({shots:metrics,errors},null,1)+'\n');
  if(errors.length)process.exitCode=1;
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
