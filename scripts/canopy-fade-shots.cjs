// See-through canopies (canopy-fade.js): offline renders at the Riverbank willows and in a dense
// stretch of natural forest, with draw calls and the fade state. Writes docs/qa/canopy/.
//   node scripts/canopy-fade-shots.cjs                 (this checkout: the "after" shots)
//   CANOPY_ROOT=/path/to/old/checkout CANOPY_TAG=before node scripts/canopy-fade-shots.cjs
// CANOPY_ROOT serves another checkout's code (e.g. the commit before the change); shots and
// metrics always go to this checkout's docs/qa/canopy/.
const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright-core');
const here=path.resolve(__dirname,'..'),root=path.resolve(process.env.CANOPY_ROOT||here),tag=process.env.CANOPY_TAG||'after',output=path.join(here,'docs/qa/canopy');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'db/generated-world.json')));
const types={'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json','.glb':'model/gltf-binary'};
const server=http.createServer((req,res)=>{try{const name=new URL(req.url,'http://local').pathname,file=path.join(root,name==='/'?'index.html':name);res.setHeader('content-type',types[path.extname(file)]||'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
const chrome=process.env.ELDERVALE_CHROMIUM||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:chrome,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const p=await browser.newPage({viewport:{width:1100,height:700}}),errors=[];
  p.on('pageerror',e=>{errors.push(e.message);console.log('PAGE',e.message)});p.on('console',m=>{if(m.type()==='error'&&/WebGLProgram|shader|VALIDATE_STATUS/i.test(m.text()))errors.push(m.text())});
  await p.route('**/*',r=>{const url=r.request().url();
   if(url.includes('three@0.160.1/examples/jsm/'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(here,'node_modules/three/examples/jsm',url.split('three@0.160.1/examples/jsm/')[1].split('?')[0]))});
   if(url.includes('three@0.160.1/build/three.module.js'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(here,'node_modules/three/build/three.module.js'))});
   if(!url.startsWith('http://127.0.0.1:'))return r.abort();const name=new URL(url).pathname;
   if(name==='/auth.js')return r.fulfill({contentType:'text/javascript',body:`globalThis.eldervaleWorldConfig=${JSON.stringify(manifest.config)};document.querySelector('#auth-screen').hidden=true;import('./geography.js?v=release-20261107-quests162').then(g=>g.initializeGeography(globalThis.eldervaleWorldConfig)).then(()=>import('./game.js?v=release-20261107-quests162')).then(()=>window.ready=true);`});
   if(name==='/game.js')return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game.js'),'utf8').replace('function frame(){requestAnimationFrame(frame);','function frame(){if(window.pauseFrames)return;requestAnimationFrame(frame);')+'\nwindow.visualTest={T,scene,camera,renderer,player,landscape,forestBatches,meadow,groundDressing,waterSystem,worldInstances,fader:typeof canopyFader==="undefined"?null:canopyFader,nearCanopies:typeof nearCanopies==="undefined"?null:nearCanopies,setCamera:(y,p,z)=>{yaw=y;pitch=p;zoom=z},step:()=>{window.pauseFrames=false;frame();window.pauseFrames=true},move:(x,z)=>{player.position.set(x,landscape.walkHeight(x,z),z);cameraFocus=null;window.pauseFrames=false;frame();window.pauseFrames=true}};'});
   r.continue()});
  await p.addInitScript(()=>{window.pauseFrames=true;localStorage.setItem('eldervale-save',JSON.stringify({x:-97,z:19,equippedWeapon:'longsword',weaponsOwned:['longsword'],appearance:{shirt:'#b5372c',skin:'#c9916b'}}))});
  await p.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded',timeout:180000});await p.waitForFunction(()=>window.ready,null,{timeout:180000});
  const {skillingNodes}=await import(require('url').pathToFileURL(path.join(root,'skilling-areas.js')).href);
  const rows=skillingNodes.filter(n=>n.site==='Riverbank willows').map(n=>({id:n.id,data:n,revision:1}));
  await p.evaluate(async rows=>{const w=window.visualTest;w.renderer.setPixelRatio(1);w.waterSystem.setQuality('low',true);await window.eldervaleWorldBridge.apply(rows);await window.eldervaleRegionStreamer?.idle?.()},rows);
  // A dense forest chunk: the leaf batch with the most cards; stand 4 m south of one crown.
  // A dense forest chunk (the leaf batch with the most cards); FOREST_AT=x,z overrides the spot.
  const forest=await p.evaluate(at=>{const w=window.visualTest;let best=null;for(const m of w.forestBatches)if(m.material.alphaTest>0&&m.userData.naturalChunk&&(!best||m.count>best.count))best=m;
   if(at)return {x:at[0],z:at[1],cards:best.count};const rec=best.userData.canopyTrees?.[Math.floor(best.userData.canopyTrees.length/2)];return {x:rec?rec.x:best.userData.naturalChunk.x,z:rec?rec.z-3:best.userData.naturalChunk.z,cards:best.count}},process.env.FOREST_AT?process.env.FOREST_AT.split(',').map(Number):null);
  const shots=[
   // Willow 2 (-95, 24.5) stands between the camera and a player south of it.
   {id:'willows',x:-97.6,z:19.8,yaw:Math.atan2(1.2,4.9),pitch:.36,zoom:11},
   {id:'forest',x:forest.x,z:forest.z,yaw:0,pitch:.75,zoom:13}];
  const metrics={tag,forestCards:forest.cards,shots:{}};fs.mkdirSync(output,{recursive:true});
  for(const s of shots){
   await p.evaluate(async s=>{const w=window.visualTest;w.player.rotation.y=s.yaw-Math.PI;w.setCamera(s.yaw,s.pitch,s.zoom);w.move(s.x,s.z);await window.eldervaleRegionStreamer?.scan?.();await window.eldervaleRegionStreamer?.idle?.();w.meadow.invalidate();w.move(s.x,s.z)},s);
   await p.waitForFunction(()=>!window.visualTest.meadow.busy&&!window.visualTest.groundDressing.busy,null,{timeout:120000}).catch(()=>{});
   // Run frames for ~0.6 s of real time so the 10 Hz test fires and the 0.2 s fade completes.
   const result=await p.evaluate(async s=>{const w=window.visualTest;const t0=performance.now();let frames=0;while(performance.now()-t0<600){w.step();frames++;await new Promise(r=>setTimeout(r,30))}
    w.setCamera(s.yaw,s.pitch,s.zoom);w.step();const info=w.renderer.info.render;
    const faded=w.fader?w.fader.active.map(r=>+r.fade.toFixed(2)):[];return {calls:info.calls,triangles:info.triangles,programs:w.renderer.info.programs.length,frames,faded,camera:w.camera.position.toArray().map(v=>+v.toFixed(2)),player:w.player.position.toArray().map(v=>+v.toFixed(2))}},s);
   await p.screenshot({path:path.join(output,`${s.id}-${tag}.png`),timeout:180000});
   // Hold the view and check that nothing compiles while trees fade in and out.
   // Same view, fade released and re-applied: nothing may compile.
   // Same view, no game frames: release the fade, render, fade again, render. Nothing may compile.
   if(tag==='after')result.recompiles=await p.evaluate(()=>{const w=window.visualTest,info=w.renderer.info,before=info.programs.length;w.fader.reset();w.renderer.render(w.scene,w.camera);const callsUnfaded=info.render.calls,mid=info.programs.length;
    w.fader.test(w.camera.position,w.player.position.clone().setY(w.player.position.y+1.1),w.nearCanopies);w.fader.update(1);w.renderer.render(w.scene,w.camera);return {programs:info.programs.length-before,programsAtUnfade:mid-before,callsUnfaded,callsFaded:info.render.calls,refaded:w.fader.active.length}});
   metrics.shots[s.id]=result;console.log(s.id,tag,JSON.stringify(result));
  }
  metrics.errors=errors;fs.writeFileSync(path.join(output,`metrics-${tag}.json`),JSON.stringify(metrics,null,1));
  if(errors.length){console.error(errors);process.exitCode=1}
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
