// Offline browser regression only. Auth is replaced in this test context;
// no account, Supabase, deployment, or production data is accessed.
const assert=require('node:assert/strict');
const fs=require('node:fs');const http=require('node:http');const path=require('node:path');
const {chromium}=require(process.env.ELDERVALE_PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(__dirname,'..');
const three=fs.readFileSync(path.join(root,'node_modules/three/build/three.module.js'));
const fixture={x:7,z:5,gold:123,wood:8,ore:4,woodXP:456,miningXP:321,combatXP:90,kills:3,attackXP:22,appearance:{hair:'Long',skin:'#c9916b',shirt:'#426e68'},armorOwned:['helm','chest','legs','boots','cape'],equipped:{helm:true,chest:true,legs:true,boots:true,cape:true},weaponsOwned:['longsword'],equippedWeapon:'longsword',shieldsOwned:['kite'],equippedShield:'kite',starterShieldsGranted:true};
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(req.url==='/'?'/index.html':req.url));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
(async()=>{
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
 const browser=await chromium.launch({headless:true,...(process.env.ELDERVALE_CHROMIUM?{executablePath:process.env.ELDERVALE_CHROMIUM}:{}),args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
 const page=await browser.newPage({viewport:{width:1440,height:1000}}),errors=[];page.on('console',message=>{if(message.type()==='error'&&/WebGLProgram|shader error|VALIDATE_STATUS/i.test(message.text()))errors.push(message.text())});page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE:',e.message)});
 await page.route('**/*',route=>{
  const url=route.request().url();
  if(url==='https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js')return route.fulfill({contentType:'text/javascript',body:three});
  if(!url.startsWith('http://127.0.0.1:'))return route.abort();
  if(url.endsWith('/game.js'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game.js'),'utf8')+'\nwindow.offlineWorld={landscape,player,camera,scene,walkAllowed,findWalkPath,state,combat,creatures,strike,draw,save,equipWeapon,equipShield,avatar};'});
  if(url.endsWith('/auth.js'))return route.fulfill({contentType:'text/javascript',body:"document.querySelector('#auth-screen').hidden=true;import('./game.js').then(()=>window.testGameReady=true);"});
  return route.continue();
 });
 await page.addInitScript(seed=>{if(!localStorage.getItem('eldervale-save'))localStorage.setItem('eldervale-save',JSON.stringify(seed))},fixture);
 await page.goto(`http://127.0.0.1:${server.address().port}`);
 await page.waitForFunction(()=>window.testGameReady,{},{timeout:30000});
 await page.locator('[data-tab="equipment"]').click();
 assert.equal(await page.getByRole('button',{name:'Head: Iron full helm',exact:true}).isVisible(),true);
 await page.locator('#map-toggle').click();assert.equal(await page.locator('#map-panel').isVisible(),true);
 await page.locator('#map-close').click();
 const start=await page.evaluate(()=>window.eldervaleGetPlayerPosition());
 await page.locator('#minimap').click({position:{x:115,y:100}});
 await page.waitForFunction(before=>{const p=window.eldervaleGetPlayerPosition();return Math.hypot(p.x-before.x,p.z-before.z)>.25},start,{timeout:15000});
 await page.evaluate(()=>window.eldervaleUpdatePlayers([{id:'test-remote',username:'Offline fixture',x:9,z:6,yaw:1}]));
 await page.evaluate(()=>window.eldervaleUpdatePlayers([{id:'test-remote',username:'Offline fixture',x:12,z:8,yaw:2}]));
 await page.waitForTimeout(500);
 await page.evaluate(()=>window.eldervaleUpdatePlayers([]));
 await page.waitForFunction(()=>{const s=JSON.parse(localStorage.getItem('eldervale-save'));return s.x!==7},null,{timeout:20000});
 const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('eldervale-save')));
 for(const key of ['gold','wood','ore','woodXP','miningXP','combatXP','kills','attackXP','appearance','equippedWeapon','equippedShield','equipped'])assert.deepEqual(saved[key],fixture[key],key+' preserved');
 await page.reload();await page.waitForFunction(()=>window.testGameReady);
 assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('eldervale-save')).appearance),fixture.appearance);
 await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('#social-panel').classList.contains('collapsed'));
 const layout=await page.evaluate(()=>{const a=document.querySelector('#side').getBoundingClientRect(),b=document.querySelector('#social-panel').getBoundingClientRect();return {separate:a.bottom<=b.top,chat:document.querySelector('#social-panel').classList.contains('collapsed')}});assert.equal(layout.chat,true);assert.equal(layout.separate,true);
 const out=path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});await page.screenshot({path:path.join(out,'mobile-world.png')});
 await page.setViewportSize({width:1440,height:1000});await page.screenshot({path:path.join(out,'world.png')});
 await page.locator('#map-toggle').click();await page.screenshot({path:path.join(out,'atlas.png')});await page.locator('#map-close').click();
 const bridgeCheck=await page.evaluate(()=>{const w=window.offlineWorld,b=w.landscape.bridges[0],s=Math.sin(b.yaw),c=Math.cos(b.yaw),a={x:b.x-s*(b.length/2+3),z:b.z-c*(b.length/2+3)},d={x:b.x+s*(b.length/2+3),z:b.z+c*(b.length/2+3)};return {blocked:w.walkAllowed(new w.player.position.constructor(a.x,0,a.z),new w.player.position.constructor(d.x,0,d.z)).blocked,bridges:w.landscape.bridges.length}});assert.ok(bridgeCheck.bridges>=3);assert.equal(bridgeCheck.blocked,false);
 await page.evaluate(()=>{const w=window.offlineWorld,b=w.landscape.bridges[0];w.player.position.set(b.x,w.landscape.walkHeight(b.x,b.z),b.z)});await page.waitForFunction(()=>Math.abs(window.offlineWorld.camera.position.x-window.offlineWorld.player.position.x)<30);await page.waitForTimeout(500);await page.screenshot({path:path.join(out,'bridge.png')});
 await page.evaluate(()=>{const w=window.offlineWorld;w.player.position.set(-320,w.landscape.walkHeight(-320,-300),-300)});await page.waitForFunction(()=>window.offlineWorld.camera.position.y>55);await page.screenshot({path:path.join(out,'highlands.png')});
 const twoHand=await page.evaluate(()=>{const w=window.offlineWorld;w.state.weaponsOwned.push('twohand');w.equipWeapon('twohand');return {weapon:w.state.equippedWeapon,shield:w.state.equippedShield,owned:w.state.shieldsOwned.includes('kite')}});assert.deepEqual(twoHand,{weapon:'twohand',shield:null,owned:true});await page.waitForTimeout(300);await page.screenshot({path:path.join(out,'two-handed.png')});
 const combatCheck=await page.evaluate(()=>{const w=window.offlineWorld,m=w.creatures.find(m=>m.alive),xp=w.combat.xp,kills=w.combat.kills;m.hp=1;w.combat.attackTimer=0;w.strike(m);return {xp:w.combat.xp-xp,kills:w.combat.kills-kills,alive:m.alive}});assert.deepEqual(combatCheck,{xp:30,kills:1,alive:false});
 await page.evaluate(async()=>{document.querySelector('#game-ui').hidden=true;document.querySelector('#social-panel').hidden=true;document.querySelector('#social-panel').style.display='none';document.querySelector('#account-bar').style.display='none';const host=document.createElement('div');host.style='position:fixed;inset:0;background:#1b2527';document.body.append(host);const {createCharacterPreview}=await import('/character-preview.js');window.preview=createCharacterPreview(host,{hair:'Long'});});
 await page.waitForTimeout(300);await page.screenshot({path:path.join(out,'creator.png')});
 await page.getByRole('button',{name:'Walk',exact:true}).click();await page.getByRole('button',{name:'Run',exact:true}).click();await page.getByRole('button',{name:'Combat',exact:true}).click();await page.getByRole('button',{name:'Face',exact:true}).click();await page.screenshot({path:path.join(out,'face.png')});await page.getByRole('button',{name:'Body',exact:true}).click();
 await page.evaluate(()=>{for(const hair of ['Side swept','Short crop','Spiky','Buzz cut','Long'])window.preview.update({hair});window.preview.dispose()});
 assert.deepEqual(errors,[]);console.log('PASS: game boot, equipment/two-handed loadout, map movement, remote avatars, save/reload, mobile layout, bridges, terrain, combat rewards and creator animation/portrait controls.');
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
