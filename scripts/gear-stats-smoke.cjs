// Offline check of gear tiers in the real client: the Equipment stats panel, the
// hover card with the level requirement, the OSRS refusal and tier-tinted models.
// Screenshots go to $OUT (default test-results/).
// usage: ELDERVALE_CHROMIUM=/path/to/chrome node scripts/gear-stats-smoke.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');const three=fs.readFileSync(path.join(root,'node_modules/three/build/three.module.js'));
const fixture={x:7,z:5,gold:123,appearance:{hair:'Short crop',skin:'#c9916b',shirt:'#426e68'}};
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname,file=path.join(root,p==='/'?'index.html':p);try{res.setHeader('content-type',/\.js$/.test(file)?'text/javascript':/\.css$/.test(file)?'text/css':/\.png$/.test(file)?'image/png':/\.json$/.test(file)?'application/json':/\.html$/.test(file)?'text/html':'application/octet-stream');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
const width=Number(process.env.WIDTH||1280),height=Number(process.env.HEIGHT||800);
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.ELDERVALE_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{const p=await browser.newPage({viewport:{width,height}}),errors=[];p.on('pageerror',e=>{if(/updateHouseRoofs/.test(e.stack||''))return; // offline fixture houses lack story data (pre-existing)
 if(!errors.includes(e.message))console.error(e.stack||e.message);errors.push(e.message)});
await p.route('**/*',route=>{const url=route.request().url();if(url==='https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js')return route.fulfill({contentType:'text/javascript',body:three});if(url.startsWith('https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/')){const f=path.join(root,'node_modules/three/examples/jsm',url.split('/examples/jsm/')[1]);return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(f)})}if(!url.startsWith('http://127.0.0.1:'))return route.abort();const pn=new URL(url).pathname;if(pn==='/auth.js')return route.fulfill({contentType:'text/javascript',body:"document.querySelector('#auth-screen').hidden=true;window.eldervaleWorldLoading=true;import('./game.js').then(()=>{window.eldervaleWorldLoading=false;window.testGameReady=true},e=>{window.testGameError=String(e&&e.stack||e)})"});if(pn==='/game.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game.js'),'utf8')+'\nwindow.testWorld={renderer,state,draw,refreshWeapon,refreshArmor,avatar,playerAnimator,player,camera,scene};'});return route.continue()});
await p.addInitScript(f=>localStorage.setItem('eldervale-save',JSON.stringify(f)),fixture);await p.goto('http://127.0.0.1:'+server.address().port);await p.waitForFunction(()=>window.testGameReady||window.testGameError,null,{timeout:240000});const loadError=await p.evaluate(()=>window.testGameError);if(loadError)throw Error(loadError);
const out=process.env.OUT||path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});
await p.evaluate(()=>{const w=window.testWorld,s=w.state;s.attackXP=5400;s.strengthXP=5400;s.defenceXP=5400;s.rangedXP=0;
 s.weaponsOwned=[...new Set([...(s.weaponsOwned||[]),'moonsilverScimitar','verditeLongsword','oakShortbow','tidesteelBattleaxe'])];s.armorOwned=[...new Set([...(s.armorOwned||[]),'moonsilverBreastplate','moonsilverGreaves','moonsilverArmet','tidesteelBreastplate','steelSabatons'])];s.shieldsOwned=[...new Set([...(s.shieldsOwned||[]),'moonsilverKiteshield'])];
 s.equippedWeapon='moonsilverScimitar';s.equippedShield='moonsilverKiteshield';s.equipped={moonsilverBreastplate:true,moonsilverGreaves:true,moonsilverArmet:true,steelSabatons:true};w.refreshWeapon();w.refreshArmor();w.draw()});
await p.locator('[data-tab="equipment"]').click();await p.waitForTimeout(800);
const panel=p.locator('#equipment .equipment-stats');assert.equal(await panel.count(),1);
const text=await panel.innerText();for(const t of ['Attack bonus','Defence bonus','Melee strength','Max hit','Attack speed'])assert.ok(text.includes(t),t);
const slash=await panel.locator('dd[data-bonus=aslash]').innerText();assert.ok(Number(slash)>20,'moonsilver scimitar slash bonus '+slash);
await p.evaluate(()=>document.querySelector('#equipment .equipment-stats').scrollIntoView());await p.waitForTimeout(200);
await panel.screenshot({path:path.join(out,'equipment-stats-panel.png')});
await p.screenshot({path:path.join(out,'equipment-tab.png')});
// Hover card on an item above the player's level (Defence 20, needs 40).
await p.locator('[data-tab="inventory"]').click();await p.waitForTimeout(400);
const slot=p.locator('#inventory [data-gear-tip="armor:tidesteelBreastplate"]');await slot.hover();await p.waitForTimeout(300);
const tip=p.locator('.gear-tooltip');assert.equal(await tip.isVisible(),true);assert.match(await tip.innerText(),/Requires Defence 40/);assert.equal(await tip.locator('.gear-tooltip-req').getAttribute('data-met'),'false');
const box=await slot.boundingBox(),tb=await tip.boundingBox();await p.screenshot({path:path.join(out,'gear-tooltip.png'),clip:{x:Math.max(0,Math.min(box.x,tb.x)-20),y:Math.max(0,Math.min(box.y,tb.y)-20),width:Math.max(box.x+box.width,tb.x+tb.width)-Math.min(box.x,tb.x)+40,height:Math.max(box.y+box.height,tb.y+tb.height)-Math.min(box.y,tb.y)+40}});
// Equipping above level is refused with the OSRS message.
await slot.click();await p.waitForTimeout(300);assert.equal(await p.evaluate(()=>!!window.testWorld.state.equipped.tidesteelBreastplate),false);
const chat=await p.evaluate(()=>document.body.innerText);assert.ok(chat.includes('You need a Defence level of 40 to wear this.'),'refusal shown');
// The tinted weapon model is on the hand.
const tint=await p.evaluate(()=>{let c=null;window.testWorld.avatar.rightHand?.traverse?.(o=>{if(o.isMesh&&o.material?.userData?.tierTint)c=o.material.userData.tierTint});return c});
assert.equal(tint,0x9cc4ec,'moonsilver tint on the held scimitar');
await p.evaluate(()=>{const w=window.testWorld;w.camera.position.set(w.player.position.x+2.6,w.player.position.y+2.4,w.player.position.z+3.2);w.camera.lookAt(w.player.position.x,w.player.position.y+1.3,w.player.position.z)});await p.waitForTimeout(600);
await p.screenshot({path:path.join(out,'moonsilver-character.png')});
assert.deepEqual(errors,[]);console.log('PASS: equipment stats panel, gear hover card, OSRS refusal, tier tint. Screenshots in '+out);
}finally{await browser.close();server.close()}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
