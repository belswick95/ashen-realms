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
  if(new URL(url).pathname==='/game.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game.js'),'utf8')+'\nwindow.offlineWorld={services,playerHit,hitNumbers,getRunning:()=>running,stop:()=>{dest=null;walkQueue=[];mapDestination=null},equipJewelry,getMapDestination:()=>mapDestination,getMapExtent:()=>minimapExtent,landscape,player,camera,scene,renderer,getZoom:()=>zoom,walkAllowed,findWalkPath,state,combat,creatures,strike,draw,save,equipWeapon,equipShield,avatar,openArmoryChest,houseInteriors,housePoint,toggleHouseDoor,npcs,talkTo,closeDialog,dialoguePortrait,setWalkDestination,setCamera:(y,p,z)=>{yaw=y;pitch=p;zoom=z},interact:kind=>{const target=targets.find(o=>o.userData.kind===kind),a=target.userData;player.position.set(a.x+.4,landscape.walkHeight(a.x+.4,a.z),a.z);action=a;dest=new T.Vector3(a.x,0,a.z)}};'});
  if(new URL(url).pathname==='/auth.js')return route.fulfill({contentType:'text/javascript',body:"document.querySelector('#auth-screen').hidden=true;import('./game.js').then(()=>window.testGameReady=true);"});
  return route.continue();
 });
 await page.addInitScript(seed=>{if(!localStorage.getItem('eldervale-save'))localStorage.setItem('eldervale-save',JSON.stringify(seed))},fixture);
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>window.testGameReady,{},{timeout:120000});

 const run=page.locator('#run-toggle');assert.equal(await run.getAttribute('aria-pressed'),'false');assert.equal(await run.locator('svg').count(),1);assert.equal(await run.locator('span').innerText(),'100');
 const offColor=await run.evaluate(e=>getComputedStyle(e).color);await run.click();assert.equal(await run.getAttribute('aria-pressed'),'true');assert.notEqual(await run.evaluate(e=>getComputedStyle(e).color),offColor);
 await page.evaluate(()=>{const w=window.offlineWorld;w.state.runEnergy=.08;w.setWalkDestination(new w.player.position.constructor(12,0,8))});await page.waitForFunction(()=>!window.offlineWorld.getRunning());await page.evaluate(()=>window.offlineWorld.stop());assert.ok(await page.evaluate(()=>window.offlineWorld.state.runEnergy<10));assert.equal(await run.getAttribute('aria-pressed'),'false');
 assert.match(await page.locator('#inventory-gold').innerText(),/123/);
 await page.evaluate(()=>{const w=window.offlineWorld;w.talkTo(w.npcs.find(n=>n.profile.role==='banker').profile)});
 await page.locator('#service-panel').waitFor();await page.locator('#service-inventory .service-item').filter({hasText:'Logs'}).getByRole('button',{name:'Deposit all',exact:true}).click();assert.equal(await page.evaluate(()=>window.offlineWorld.state.bank.wood),8);
 await page.locator('#service-stock .service-item').filter({hasText:'Logs'}).getByRole('button',{name:'Withdraw',exact:true}).click();assert.equal(await page.evaluate(()=>window.offlineWorld.state.wood),1);
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});await page.screenshot({path:path.join(root,'test-results/services-bank.png')});await page.locator('#service-close').click();
 await page.evaluate(()=>{const w=window.offlineWorld;w.talkTo(w.npcs.find(n=>n.profile.role==='merchant').profile)});const logs=page.locator('#service-stock .service-item').filter({hasText:'Logs'});await logs.getByRole('button',{name:'Buy',exact:true}).click();assert.equal(await page.evaluate(()=>window.offlineWorld.state.gold),117);
 await page.locator('#service-inventory .service-item').filter({hasText:'Logs'}).getByRole('button',{name:'Sell',exact:true}).click();assert.equal(await page.evaluate(()=>window.offlineWorld.state.gold),120);
 await page.locator('#service-stock .service-item').filter({hasText:'Iron dagger'}).getByRole('button',{name:'Buy',exact:true}).click();assert.equal(await page.evaluate(()=>window.offlineWorld.state.gold),100);
 await page.screenshot({path:path.join(root,'test-results/services-market.png')});await page.locator('#service-close').click();assert.match(await page.locator('#inventory-gold').innerText(),/100/);
 await page.evaluate(()=>{const w=window.offlineWorld,m=w.creatures.find(m=>m.alive);m.hp=100;m.root.position.copy(w.player.position);m.root.position.x+=2;w.combat.hp=100;w.combat.attackTimer=0;w.strike(m,()=>.01);w.playerHit(m,()=>.01);w.combat.attackTimer=0;w.strike(m,()=>.99);w.playerHit(m,()=>.99)});
 assert.ok(await page.locator('.hit-block').count()>=2);assert.ok(await page.locator('.hit-damage').count()>=2);await page.waitForFunction(()=>document.querySelector('#hit-numbers').children.length===0,null,{timeout:30000});
 await page.evaluate(()=>{const w=window.offlineWorld;if(!w.state.weaponsOwned.includes('twohand'))w.state.weaponsOwned.push('twohand');w.equipWeapon('twohand');w.combat.attackAnim=0;w.combat.hitAnim=0;w.combat.blockAnim=0;w.setCamera(w.player.rotation.y+.5,.30,9)});assert.equal(await page.evaluate(()=>window.offlineWorld.state.equippedShield),null);await page.screenshot({path:path.join(root,'test-results/services-greatsword.png')});
 const saved=await page.evaluate(()=>window.eldervaleCaptureSave());assert.equal(saved.bank.wood,7);assert.equal(saved.gold,100);assert.deepEqual(errors,[]);
 console.log('PASS: foot-icon energy/depletion, bank deposits/withdrawals, merchant buy/sell, separate gold, dagger, both hit styles/fading and shield-free greatsword carry.');
 }finally{await browser.close();server.close()}
})().catch(error=>{console.error(error);server.close();process.exitCode=1});
