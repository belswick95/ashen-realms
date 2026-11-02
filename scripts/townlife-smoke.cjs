// Offline browser regression only. Auth is replaced in this test context;
// no account, Supabase, deployment, or production data is accessed.
const assert=require('node:assert/strict');
const fs=require('node:fs');const http=require('node:http');const path=require('node:path');
const {chromium}=require(process.env.ELDERVALE_PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(__dirname,'..');
const three=fs.readFileSync(path.join(root,'node_modules/three/build/three.module.js'));
const fixture={x:7,z:5,gold:123,wood:8,ore:4,woodXP:456,miningXP:321,combatXP:90,kills:3,attackXP:22,appearance:{hair:'Long',skin:'#c9916b',shirt:'#426e68'},armorOwned:['helm','chest','legs','boots','cape'],equipped:{helm:true,chest:true,legs:true,boots:true,cape:true},weaponsOwned:['longsword'],equippedWeapon:'longsword',shieldsOwned:['kite'],equippedShield:'kite',starterShieldsGranted:true};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(new URL(req.url,'http://local').pathname==='/'?'/index.html':new URL(req.url,'http://local').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.mp3')?'audio/mpeg':file.endsWith('.webp')?'image/webp':'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.ELDERVALE_CHROMIUM?{executablePath:process.env.ELDERVALE_CHROMIUM}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000},hasTouch:true}),errors=[];page.on('console',message=>{if(message.type()==='error'&&/WebGLProgram|shader error|VALIDATE_STATUS/i.test(message.text()))errors.push(message.text())});page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE:',e.message)});
 await page.route('**/*',route=>{
  const url=route.request().url();
  if(url==='https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js')return route.fulfill({contentType:'text/javascript',body:three});
  if(!url.startsWith('http://127.0.0.1:'))return route.abort();
  if(new URL(url).pathname==='/game.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game.js'),'utf8')+'\nwindow.offlineWorld={landscape,player,camera,scene,renderer,getZoom:()=>zoom,walkAllowed,findWalkPath,state,combat,creatures,strike,draw,save,equipWeapon,equipShield,avatar,openArmoryChest,houseInteriors,housePoint,toggleHouseDoor,npcs,talkTo,closeDialog,dialoguePortrait,setWalkDestination,setCamera:(y,p,z)=>{yaw=y;pitch=p;zoom=z},interact:kind=>{const target=targets.find(o=>o.userData.kind===kind),a=target.userData;player.position.set(a.x+.4,landscape.walkHeight(a.x+.4,a.z),a.z);action=a;dest=new T.Vector3(a.x,0,a.z)}};'});
  if(new URL(url).pathname==='/auth.js')return route.fulfill({contentType:'text/javascript',body:"document.querySelector('#auth-screen').hidden=true;import('./game.js').then(()=>window.testGameReady=true);"});
  return route.continue();
 });
 await page.addInitScript(seed=>{if(!localStorage.getItem('eldervale-save'))localStorage.setItem('eldervale-save',JSON.stringify(seed))},fixture);
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>window.testGameReady,{},{timeout:120000});
 const w=await page.evaluate(()=>({count:window.offlineWorld.npcs.length,workers:window.offlineWorld.npcs.filter(n=>n.profile.activity).length,faceted:window.offlineWorld.avatar.face.material.flatShading,buildings:window.offlineWorld.houseInteriors.length}));
 assert.ok(w.count>=21&&w.workers>=10&&w.faceted&&w.buildings>=50,'new workers and faceted character loaded');
 const first=await page.evaluate(()=>window.offlineWorld.npcs.find(n=>n.profile.activity==='sweep').rightArm.rotation.x);await page.waitForFunction(before=>window.offlineWorld.npcs.find(n=>n.profile.activity==='sweep').rightArm.rotation.x!==before,first,{timeout:30000});
 const courier=await page.evaluate(()=>{const n=window.offlineWorld.npcs.find(n=>n.profile.activity==='carry');n.wait=0;return {x:n.root.position.x,z:n.root.position.z,name:n.profile.name}});await page.waitForFunction(before=>{const n=window.offlineWorld.npcs.find(n=>n.profile.name===before.name);return Math.hypot(n.root.position.x-before.x,n.root.position.z-before.z)>.05},courier,{timeout:20000});
 await page.evaluate(()=>window.offlineWorld.setCamera(.65,.48,15));
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});await page.screenshot({path:path.join(root,'test-results/townlife-square.png')});
 await page.evaluate(()=>{const w=window.offlineWorld,h=w.houseInteriors.find(h=>h.type==='bank');w.player.position.copy(w.housePoint(h,0,.7));w.setCamera(.5,.9,10)});await page.waitForTimeout(200);await page.screenshot({path:path.join(root,'test-results/townlife-bank.png')});
 await page.evaluate(()=>{const w=window.offlineWorld;w.player.position.set(-60,w.landscape.walkHeight(-60,59),59);w.setCamera(.7,.6,24)});await page.waitForTimeout(200);await page.screenshot({path:path.join(root,'test-results/townlife-northwatch.png')});
 assert.deepEqual(errors,[]);console.log('PASS: actual game boot, faceted people, working residents, live sweeping animation, town and bank interior rendering.');
 }finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
