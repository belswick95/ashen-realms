// Offline renders of the Birchford capital: the seeded world (db/generated-world.json)
// plus the capital blueprint from capital-layout.js, in headless Chromium.
//   node scripts/capital-render.cjs [outputDir] [shotId,...]
// Uses ELDERVALE_CHROMIUM or the bundled playwright browser.
const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright');
const root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'db/generated-world.json')));
const output=path.resolve(process.argv[2]||path.join(root,'test-results/capital'));fs.mkdirSync(output,{recursive:true});
const only=(process.argv[3]||'').split(',').filter(Boolean);
const types={'.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
const server=http.createServer((req,res)=>{try{const p=new URL(req.url,'http://local').pathname,file=path.join(root,p==='/'?'index.html':decodeURIComponent(p));res.setHeader('content-type',types[path.extname(file)]||'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
const shots=[
 {id:'overview',x:-218,z:143,yaw:Math.PI,pitch:1.05,zoom:150},
 {id:'overview-south',x:-218,z:150,yaw:0,pitch:.62,zoom:120},
 {id:'north-gate',x:-246,z:62,yaw:Math.PI,pitch:.2,zoom:16},
 {id:'kings-road',x:-241.5,z:100,yaw:0,pitch:.2,zoom:13},
 {id:'fountain-square',x:-234,z:120,yaw:0,pitch:.28,zoom:16},
 {id:'market-street',x:-203,z:126.5,yaw:-Math.PI/2+.2,pitch:.22,zoom:14},
 {id:'grand-market',x:-191,z:150,yaw:0,pitch:.4,zoom:20},
 {id:'crown-court',x:-232,z:163,yaw:Math.PI,pitch:.3,zoom:22},
 {id:'ember-gate',x:-184,z:132,yaw:-Math.PI/2,pitch:.22,zoom:16},
 {id:'west-gate',x:-252,z:155,yaw:Math.PI/2,pitch:.22,zoom:16},
 {id:'world-map',map:true}
].filter(s=>!only.length||only.includes(s.id));
(async()=>{
 const {capitalBlueprint}=await import(path.join(root,'capital-layout.js'));
 const fixture=JSON.parse(fs.readFileSync(path.join(root,'tests/fixtures/birchford-existing.json')));
 const capitalRows=capitalBlueprint().map((d,i)=>{const data={...d};if(data.shopItems){data.shop=Object.fromEntries(data.shopItems.map(k=>[k,{buy:10,sell:4,stock:-1}]));delete data.shopItems}return {id:'capital:'+i,data,revision:1}});
 const store=fixture.objects.filter(o=>o.name==='Birchford General Store').map((o,i)=>({id:'store:'+i,data:{kind:'object',hp:1,level:1,damage:0,attackSpeed:2.4,roam:0,respawn:0,attackable:false,hostile:false,...o},revision:1}));
 const rows=[...manifest.entities.map((data,i)=>({id:'scenery:'+i,data,revision:1})),...store,...(process.env.CAPITAL_OFF?[]:capitalRows.filter(r=>!(process.env.CAPITAL_SKIP||'').split(',').includes(r.data.kind==='npc'?'npc':['cottage','bank','inn','forge'].includes(r.data.template)?'building':r.data.template.startsWith('castle_')?'castle':'prop')))];
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const exe=process.env.ELDERVALE_CHROMIUM||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
 const browser=await chromium.launch({executablePath:exe,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const p=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];
  p.on('pageerror',e=>{errors.push(e.message);console.log('PAGE',e.message)});
  await p.route('**/*',r=>{const url=r.request().url();
   if(url.includes('three@0.160.1/examples/jsm/'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/three/examples/jsm',url.split('three@0.160.1/examples/jsm/')[1].split('?')[0]))});
   if(url.includes('three@0.160.1/build/three.module.js'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/three/build/three.module.js'))});
   if(!url.startsWith('http://127.0.0.1:'))return r.abort();const name=new URL(url).pathname;
   if(name==='/auth.js')return r.fulfill({contentType:'text/javascript',body:`globalThis.eldervaleWorldConfig=${JSON.stringify(manifest.config)};document.querySelector('#auth-screen').hidden=true;import('./geography.js?v=release-20261106-polish110').then(g=>g.initializeGeography(globalThis.eldervaleWorldConfig)).then(()=>import('./game.js?v=release-20261106-polish110')).then(()=>window.ready=true);`});
   if(name==='/game.js')return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game.js'),'utf8').replace('function frame(){requestAnimationFrame(frame);','function frame(){if(window.pauseFrames)return;requestAnimationFrame(frame);')+'\nwindow.visualTest={T,scene,camera,renderer,player,landscape,meadow,groundDressing,waterSystem,houseInteriors,worldInstances,frame,render:()=>{naturalSky.update(camera,performance.now(),12,1);skyLight.intensity=1.6;sun.intensity=2;renderer.render(scene,camera)},setCamera:(y,p,z)=>{yaw=y;pitch=p;zoom=z},move:(x,z)=>{player.position.set(x,landscape.walkHeight(x,z),z);cameraFocus=null;window.pauseFrames=false;frame();window.pauseFrames=true}};'});
   r.continue()});
  await p.addInitScript(()=>{window.pauseFrames=true;localStorage.setItem('eldervale-save',JSON.stringify({x:-229,z:134,appearance:{shirt:'#746951',skin:'#c9916b'}}))});
  await p.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded',timeout:180000});
  await p.waitForFunction(()=>window.ready,null,{timeout:180000});
  await p.evaluate(async rows=>{const w=window.visualTest;w.renderer.setPixelRatio(.8);w.renderer.shadowMap.enabled=false;w.waterSystem.setQuality('low',true);w.move(-218,143);await window.eldervaleWorldBridge.apply(rows);await window.eldervaleRegionStreamer.idle();},rows);
  const results=[];
  for(const shot of shots){
   if(shot.map){
    // World map: the capital's crown label and walls.
    await p.evaluate(()=>{window.pauseFrames=false;window.visualTest.frame();document.querySelector('#map-toggle').click()});await p.waitForTimeout(3000);
    await p.screenshot({path:path.join(output,'world-map.png'),timeout:180000,animations:'disabled'});
    await p.evaluate(()=>{document.querySelector('#map-close').click();window.pauseFrames=true});console.log('captured world map');continue;
   }
   const info=await p.evaluate(async s=>{const w=window.visualTest;w.player.rotation.y=s.yaw-Math.PI;w.setCamera(s.yaw,s.pitch,s.zoom);w.move(s.x,s.z);await window.eldervaleRegionStreamer.scan();await window.eldervaleRegionStreamer.idle();
    // Gates and business doors stand open, as on the server.
    for(const {root}of w.worldInstances.values())if(root?.userData.leftGate){root.userData.gateOpen=true;root.userData.leftGate.rotation.y=-Math.PI*.48;root.userData.rightGate.rotation.y=Math.PI*.48}
    w.meadow.invalidate?.();w.move(s.x,s.z);w.render();return {calls:w.renderer.info.render.calls,triangles:w.renderer.info.render.triangles,houses:w.houseInteriors.length}},shot);
   await p.waitForFunction(()=>!window.visualTest.meadow.busy&&!window.visualTest.groundDressing.busy,null,{timeout:180000}).catch(()=>{});
   const final=await p.evaluate(()=>{const w=window.visualTest;w.render();return {calls:w.renderer.info.render.calls,triangles:w.renderer.info.render.triangles}});
   await p.screenshot({path:path.join(output,shot.id+'.png'),timeout:180000,animations:'disabled'});
   results.push({id:shot.id,...info,...final});console.log('captured',JSON.stringify(results.at(-1)));
  }
  fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify({results,errors},null,2));
  if(errors.length)process.exitCode=1;
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
