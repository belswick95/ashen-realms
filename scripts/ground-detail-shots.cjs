// Ground detail renders (paths, terrain shading, ground clutter) in regular and Classic graphics,
// offline: the seeded world (db/generated-world.json), the Birchford capital and castle blueprints,
// in headless Chromium (SwiftShader). Every shot is rendered once per mode on a fresh page with the
// same clock, and reports draw calls, triangles and compiled shader programs.
//   node scripts/ground-detail-shots.cjs [label] [outputDir]
// GROUND_ROOT=<checkout> renders another checkout (e.g. the previous release, for "before" shots).
// Writes <outputDir>/<label>-<mode>-<shot>.png and <outputDir>/<label>-metrics.json.
const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright-core');
const here=path.resolve(__dirname,'..'),root=path.resolve(process.env.GROUND_ROOT||here),label=process.argv[2]||'after';
const version=fs.readFileSync(path.join(root,'game.js'),'utf8').match(/\?v=([\w.-]+)'/)[1],manifest=JSON.parse(fs.readFileSync(path.join(root,'db/generated-world.json')));
const output=path.resolve(process.argv[3]||path.join(here,'docs/graphics'));fs.mkdirSync(output,{recursive:true});
const modules=path.join(here,'node_modules');
const types={'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
const server=http.createServer((req,res)=>{try{const p=new URL(req.url,'http://local').pathname,file=path.join(root,p==='/'?'index.html':decodeURIComponent(p));res.setHeader('content-type',types[path.extname(file)]||'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
// eye/look in world metres, y added to the walk height at `at`.
const shots=[
 // The owner's photo: inside the castle gate, looking up the gate road to the Crown Fountain.
 {id:'castle-courtyard',at:[-340,-262],eye:[-340,4.2,-256],look:[-340,.4,-292]},
 {id:'birchford-street',at:[-216,127],eye:[-228,4.2,126.2],look:[-198,.4,129]},
 // The Birchford-castle road through open country (dirt).
 {id:'countryside-trail',at:[-266,-6],eye:[-264,4,0],look:[-279,0,-48]},
 // The owner's trail photo: a high camera looking down along the same dirt road, and a mid view.
 {id:'trail-high',at:[-266,-6],eye:[-261,15,6],look:[-276,0,-34]},
 {id:'trail-mid',at:[-266,-6],eye:[-263,7.5,2],look:[-277,0,-40]},
 // Woodland edge beside the Birchford-Winterwatch road.
 {id:'forest-edge',at:[-115,150],eye:[-118,4,141],look:[-112,1.2,168]},
].filter(s=>!process.env.GROUND_SHOTS||process.env.GROUND_SHOTS.split(',').includes(s.id));
const modes=(process.env.GROUND_MODES||'regular,classic').split(',');
(async()=>{
 const {capitalBlueprint}=await import(path.join(root,'capital-layout.js'));
 const {castleBlueprint}=await import(path.join(root,'castle-layout.js'));
 const capitalRows=capitalBlueprint().map((d,i)=>{const data={...d};if(data.shopItems){data.shop=Object.fromEntries(data.shopItems.map(k=>[k,{buy:10,sell:4,stock:-1}]));delete data.shopItems}return {id:'capital:'+i,data,revision:1}});
 const castleRows=castleBlueprint().filter(d=>d.kind!=='npc').map((data,i)=>({id:'castle:'+i,data,revision:1}));
 const rows=[...manifest.entities.map((data,i)=>({id:'scenery:'+i,data,revision:1})),...capitalRows,...castleRows];
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.ELDERVALE_CHROMIUM||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const metrics={},errors=[];
 async function pass(mode){
  const p=await browser.newPage({viewport:{width:1280,height:800}});
  p.on('pageerror',e=>{errors.push(mode+': '+e.message);console.log('PAGE',e.message)});
  p.on('console',m=>{if(m.type()==='error'||/Ground|shader|WebGL/i.test(m.text()))console.log('console:',m.text().slice(0,400))});
  await p.route('**/*',r=>{const url=r.request().url();
   if(url.includes('three@0.160.1/examples/jsm/'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(modules,'three/examples/jsm',url.split('three@0.160.1/examples/jsm/')[1].split('?')[0]))});
   if(url.includes('three@0.160.1/build/three.module.js'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(modules,'three/build/three.module.js'))});
   if(!url.startsWith('http://127.0.0.1:'))return r.abort();const name=new URL(url).pathname;
   if(name==='/auth.js')return r.fulfill({contentType:'text/javascript',body:`globalThis.eldervaleWorldConfig=${JSON.stringify(manifest.config)};document.querySelector('#auth-screen').hidden=true;import('./geography.js?v=${version}').then(g=>g.initializeGeography(globalThis.eldervaleWorldConfig)).then(()=>import('./game.js?v=${version}')).then(()=>window.ready=true);`});
   if(name==='/game.js')return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game.js'),'utf8').replace('function frame(){requestAnimationFrame(frame);','function frame(){if(window.pauseFrames)return;requestAnimationFrame(frame);')+'\nwindow.visualTest={T,scene,camera,renderer,player,landscape,meadow,worldInstances,classicLook,frame,render:()=>{naturalSky.update(camera,performance.now(),12,1);renderer.render(scene,camera)},move:(x,z)=>{player.position.set(x,landscape.walkHeight(x,z),z);cameraFocus=null;window.pauseFrames=false;frame();window.pauseFrames=true}};'});
   r.continue()});
  await p.addInitScript(({classic,list})=>{window.pauseFrames=true;window.groundShotPrograms=list;localStorage.setItem('eldervale-save',JSON.stringify({x:-229,z:134,appearance:{shirt:'#746951',skin:'#c9916b'}}));localStorage.setItem('eldervale-client-settings',JSON.stringify({preset:'high',scale:1,distance:330,shadows:true,classic}));
   // A fixed noon: the same light in every shot and both checkouts.
   const fixed=Date.UTC(2026,10,7,17,0,0);window.eldervaleServerTime=()=>fixed},{classic:mode==='classic',list:!!process.env.GROUND_PROGRAMS});
  await p.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded',timeout:240000});
  await p.waitForFunction(()=>window.ready,null,{timeout:240000});
  await p.evaluate(async rows=>{const w=window.visualTest;w.renderer.setPixelRatio(1);w.move(-218,143);await window.eldervaleWorldBridge.apply(rows);await window.eldervaleRegionStreamer.idle()},rows);
  await p.evaluate(()=>window.visualTest.renderer.domElement.classList.add('ground-shot-view'));await p.addStyleTag({content:'body *:not(.ground-shot-view):not(:has(.ground-shot-view)){opacity:0!important}'});
  for(const shot of shots){
   await p.evaluate(async s=>{const w=window.visualTest;w.move(s.at[0],s.at[1]);await window.eldervaleRegionStreamer.scan();await window.eldervaleRegionStreamer.idle();await window.eldervalePrepareScenery?.();
    for(const {root}of w.worldInstances.values())if(root?.userData.leftGate){root.userData.leftGate.rotation.y=-Math.PI*.48;root.userData.rightGate.rotation.y=Math.PI*.48}},shot);
   // Let streaming, classic conversion and time-sliced builders settle.
   await p.evaluate(async()=>{window.pauseFrames=false;window.visualTest.frame();await new Promise(r=>setTimeout(r,4000));window.pauseFrames=true;await window.eldervalePrepareScenery?.()});
   const result=await p.evaluate(s=>{const w=window.visualTest,T=w.T,gy=w.landscape.walkHeight(s.at[0],s.at[1]);
    const eye=new T.Vector3(s.eye[0],s.eye[1]+gy,s.eye[2]),look=new T.Vector3(s.look[0],s.look[1]+gy,s.look[2]);
    w.camera.position.copy(eye);w.camera.lookAt(look);w.camera.updateMatrixWorld();w.camera.updateProjectionMatrix();w.render();w.render();
    return {calls:w.renderer.info.render.calls,triangles:w.renderer.info.render.triangles,programs:w.renderer.info.programs.length,classic:w.classicLook.enabled,scenery:window.eldervaleSceneryStatus?.(),...(window.groundShotPrograms?{list:w.renderer.info.programs.map(p=>p.name+' '+p.cacheKey.slice(0,160))}:{})}},shot);
   await p.screenshot({path:path.join(output,label+'-'+mode+'-'+shot.id+'.png'),timeout:240000,animations:'disabled'});
   console.log(label,mode,shot.id,JSON.stringify(result));(metrics[shot.id]??={})[mode]=result;
  }
  // Programs after walking every shot: a stable count means nothing compiles per frame or per area.
  metrics['programs-'+mode]=await p.evaluate(async()=>{const w=window.visualTest;window.pauseFrames=false;w.frame();await new Promise(r=>setTimeout(r,1500));window.pauseFrames=true;const a=w.renderer.info.programs.length;w.render();w.render();return {settled:a,again:w.renderer.info.programs.length}});
  await p.close();
 }
 try{for(const mode of modes)await pass(mode);fs.writeFileSync(path.join(output,label+'-metrics.json'),JSON.stringify({shots:metrics,errors},null,1)+'\n');if(errors.length)process.exitCode=1}
 finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
