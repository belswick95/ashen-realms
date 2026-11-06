// Screenshots of the Round-2 world content in the real renderer (offline, like world-surface-sweep.cjs):
// a cave entrance, every underground area, the new water, the Saltglass Landing fishing hub and a shortcut.
// Usage: ELDERVALE_CHROMIUM=/usr/bin/google-chrome node scripts/underground-shots.cjs [outDir]
const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright-core'),root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'db/generated-world.json')));
const out=path.resolve(process.argv[2]||path.join(root,'test-results/underground-shots'));fs.mkdirSync(out,{recursive:true});
const V='?v=release-20261106-osrswalk124';
const server=http.createServer((req,res)=>{try{const name=new URL(req.url,'http://local').pathname,file=path.join(root,name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.webp')?'image/webp':file.endsWith('.json')?'application/json':'application/octet-stream');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});
(async()=>{
 globalThis.eldervaleWorldConfig=manifest.config;
 const ug=await import(path.join(root,'underground-data.js')+V),ag=await import(path.join(root,'agility-data.js')+V),best=await import(path.join(root,'bestiary.js')+V),seed=await import(path.join(root,'scripts/build-water-seed.mjs'));
 const {entityDefaults}=await import(path.join(root,'world-templates.js')+V);
 const rows=manifest.entities.map((data,i)=>({id:'base:'+i,data,revision:1}));let n=0;const push=data=>rows.push({id:'r2g:'+(n++),data,revision:1});
 for(const area of ug.dungeons){for(const p of ug.passageObjects(area))push({...entityDefaults(p.template,p.x,p.z),name:p.name,yaw:p.yaw,passage:p.passage});
  for(const s of ug.spawnPlan(area))try{push({...best.bestiaryEntity(s.roster,s.x,s.z),roam:s.roam})}catch{}}
 for(const s of ag.shortcuts){const e=ag.shortcutEntity(s);push({...entityDefaults(s.template,e.x,e.z),...e})}
 for(const h of seed.hubEntities())push(h.data);
 for(const s of seed.spotPlan())push({...entityDefaults('fishing_spot',s.x,s.z),name:s.name,spotType:s.type,waterHeight:s.waterHeight,moves:s.moves});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({...(process.env.ELDERVALE_CHROMIUM?{executablePath:process.env.ELDERVALE_CHROMIUM}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{const p=await browser.newPage({viewport:{width:1100,height:720}});p.on("pageerror",e=>console.log("PAGE",e.message,(e.stack||"").split("\n").slice(1,4).join(" | ")));p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,300))});
  await p.route('**/*',r=>{const url=r.request().url();if(url.includes('three@0.160.1/examples/jsm/'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/three/examples/jsm',url.split('three@0.160.1/examples/jsm/')[1].split('?')[0]))});if(url.includes('three@0.160.1/build/three.module.js'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/three/build/three.module.js'))});if(!url.startsWith('http://127.0.0.1:'))return r.abort();const name=new URL(url).pathname;
   if(name==='/auth.js')return r.fulfill({contentType:'text/javascript',body:`globalThis.eldervaleWorldConfig=${JSON.stringify(manifest.config)};document.querySelector('#auth-screen').hidden=true;import('./geography.js${V}').then(g=>g.initializeGeography(globalThis.eldervaleWorldConfig)).then(()=>import('./game.js${V}')).then(()=>window.ready=true);`});
   if(name==='/game.js')return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game.js'),'utf8').replace('function frame(){requestAnimationFrame(frame);','function frame(){if(window.pauseFrames)return;requestAnimationFrame(frame);')+'\nwindow.visualTest={scene,camera,renderer,player,landscape,frame,setCamera:(y,p,z)=>{yaw=y;pitch=p;zoom=z},move:(x,z,steps=1)=>{player.position.set(x,landscape.walkHeight(x,z),z);cameraFocus=null;for(let i=0;i<steps;i++){window.pauseFrames=false;frame();window.pauseFrames=true}}};'});r.continue()});
  await p.addInitScript(()=>{window.pauseFrames=true;localStorage.setItem('eldervale-save',JSON.stringify({x:-229,z:134,equippedWeapon:'longsword',weaponsOwned:['longsword'],appearance:{shirt:'#746951',skin:'#c9916b'}}))});
  await p.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded',timeout:180000});await p.waitForFunction(()=>window.ready,null,{timeout:180000});
  await p.evaluate(async rows=>{await window.eldervaleWorldBridge.apply(rows);await window.eldervaleRegionStreamer.idle()},rows);console.log('world ready,',rows.length,'rows');
  const shots=[
   {file:'01-cave-entrance-birchroot.png',x:-310,z:131,yaw:Math.PI*.5,pitch:.32,zoom:13},
   {file:'02-birchroot-hollow.png',x:1218,z:1205,yaw:2.2,pitch:.62,zoom:22,area:'birchroot_hollow'},
   {file:'03-hollowmere-undercroft.png',x:2028,z:1200,yaw:2.6,pitch:.62,zoom:22,area:'hollowmere_undercroft'},
   {file:'04-cindervault-depths.png',x:2826,z:1208,yaw:2.4,pitch:.62,zoom:22,area:'cindervault_depths'},
   {file:'05-cindervault-molten-heart.png',x:2826,z:1600,yaw:2.4,pitch:.62,zoom:24,area:'cindervault_depths'},
   {file:'06-saltglass-bay-coast.png',x:300,z:352,yaw:Math.PI,pitch:.38,zoom:30},
   {file:'07-saltglass-landing-hub.png',x:300,z:342,yaw:-2.4,pitch:.5,zoom:20},
   {file:'08-saltreed-run-river.png',x:345,z:190,yaw:.4,pitch:.45,zoom:22},
   {file:'09-shortcut-heron-log.png',x:150,z:341,yaw:Math.PI,pitch:.45,zoom:12},{file:'09b-shortcut-wildwater-stones.png',x:-35,z:62,yaw:Math.PI,pitch:.5,zoom:12},
   {file:'10-heronmere-lake.png',x:165,z:282,yaw:Math.PI,pitch:.42,zoom:28},
   {file:'11-hollowmere-crypt-door.png',x:-118,z:-366,yaw:0,pitch:.32,zoom:12}
  ];
  for(const s of shots){const err=await p.evaluate(async s=>{try{const w=window.visualTest;w.setCamera(s.yaw,s.pitch,s.zoom);w.move(s.x,s.z);await window.eldervaleRegionStreamer.scan();await window.eldervaleRegionStreamer.idle();if(s.area)await window.eldervaleUnderground.prepare(s.area);w.move(s.x,s.z,4);await new Promise(r=>setTimeout(r,300));w.move(s.x,s.z,3)}catch(e){return e.message+' '+e.stack}},s);if(err)console.log('ERROR',s.file,err.slice(0,900));
   await p.screenshot({path:path.join(out,s.file),timeout:180000});console.log('shot',s.file)}
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
