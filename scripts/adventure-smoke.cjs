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
  if(new URL(url).pathname==='/game.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game.js'),'utf8')+'\nwindow.offlineWorld={equipJewelry,getMapDestination:()=>mapDestination,getMapExtent:()=>minimapExtent,landscape,player,camera,scene,renderer,getZoom:()=>zoom,walkAllowed,findWalkPath,state,combat,creatures,strike,draw,save,equipWeapon,equipShield,avatar,openArmoryChest,houseInteriors,housePoint,toggleHouseDoor,npcs,talkTo,closeDialog,dialoguePortrait,setWalkDestination,setCamera:(y,p,z)=>{yaw=y;pitch=p;zoom=z},interact:kind=>{const target=targets.find(o=>o.userData.kind===kind),a=target.userData;player.position.set(a.x+.4,landscape.walkHeight(a.x+.4,a.z),a.z);action=a;dest=new T.Vector3(a.x,0,a.z)}};'});
  if(new URL(url).pathname==='/auth.js')return route.fulfill({contentType:'text/javascript',body:"document.querySelector('#auth-screen').hidden=true;import('./game.js').then(()=>window.testGameReady=true);"});
  return route.continue();
 });
 await page.addInitScript(seed=>{if(!localStorage.getItem('eldervale-save'))localStorage.setItem('eldervale-save',JSON.stringify(seed))},fixture);
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>window.testGameReady,{},{timeout:120000});
 await page.evaluate(()=>{window.offlineWorld.openArmoryChest();window.offlineWorld.draw()});
 await page.locator('.slot[aria-label="Woodland amulet"]').click();await page.locator('.slot[aria-label="Prospector’s ring"]').click();
 assert.equal(await page.evaluate(()=>window.offlineWorld.state.amulet),'woodlandAmulet');assert.equal(await page.evaluate(()=>window.offlineWorld.state.trinket),'prospectorsRing');
 await page.locator('[data-tab="equipment"]').click();await page.getByRole('button',{name:/^Amulet:/}).waitFor();await page.getByRole('button',{name:/^Trinket \(ring\):/}).waitFor();
 await page.getByRole('button',{name:'Zoom in',exact:true}).click();assert.ok(await page.evaluate(()=>window.offlineWorld.getMapExtent()<90));await page.getByRole('button',{name:'Zoom out',exact:true}).click();
 await page.getByRole('button',{name:'Toggle run',exact:true}).click();assert.equal(await page.getByRole('button',{name:'Toggle run',exact:true}).innerText(),'Run on');await page.getByRole('button',{name:'Toggle run',exact:true}).click();
 await page.evaluate(()=>window.offlineWorld.player.rotation.y=Math.PI/2);const bounds=await page.locator('#minimap').boundingBox();await page.mouse.click(bounds.x+bounds.width/2,bounds.y+bounds.height/2-15);assert.ok(await page.evaluate(()=>window.offlineWorld.getMapDestination()!==null));
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});await page.screenshot({path:path.join(root,'test-results/adventure-minimap-equipment.png')});
 await page.evaluate(()=>window.offlineWorld.equipWeapon('twohand'));await page.waitForFunction(()=>window.offlineWorld.state.equippedWeapon==='twohand');
 assert.deepEqual(errors,[]);console.log('PASS: jewelry equip, both slots, minimap zoom, run toggle, rotated click destination and greatsword equip.');
 }finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
