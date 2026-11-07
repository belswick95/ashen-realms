// Drag-to-rearrange backpack smoke test (inventory-order.js), offline with stubs.
// Desktop 1280×800 mouse drag, and 844×390 touch (hold, then drag) via CDP touch events.
// ELDERVALE_CHROMIUM=/path/to/chrome node scripts/inventory-order-smoke.cjs
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright-core'),root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'db/generated-world.json')));
const server=http.createServer((req,res)=>{try{const name=new URL(req.url,'http://local').pathname,file=path.join(root,name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.svg')?'image/svg+xml':'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
const SAVE={x:-229,z:134,equippedWeapon:'longsword',weaponsOwned:['longsword','dagger'],wood:3,ore:1,bait:50,shrimp:2,'note:wood':5,appearance:{shirt:'#746951',skin:'#c9916b'}};
async function open(browser,options){
 const context=await browser.newContext(options),p=await context.newPage(),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('PAGE',e.message)});
 await p.route('**/*',r=>{const url=r.request().url();
  if(url.includes('three@0.160.1/examples/jsm/'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/three/examples/jsm',url.split('three@0.160.1/examples/jsm/')[1].split('?')[0]))});
  if(url.includes('three@0.160.1/build/three.module.js'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/three/build/three.module.js'))});
  if(!url.startsWith('http://127.0.0.1:'))return r.abort();const name=new URL(url).pathname;
  if(name==='/auth.js')return r.fulfill({contentType:'text/javascript',body:`globalThis.eldervaleWorldConfig=${JSON.stringify(manifest.config)};document.querySelector('#auth-screen').hidden=true;import('./geography.js?v=release-20261107-bank153').then(g=>g.initializeGeography(globalThis.eldervaleWorldConfig)).then(()=>import('./game.js?v=release-20261107-bank153')).then(()=>window.ready=true);`});
  if(name==='/game.js')return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game.js'),'utf8').replace('function frame(){requestAnimationFrame(frame);','function frame(){if(window.pauseFrames)return;requestAnimationFrame(frame);')+'\nwindow.invTest={state,draw,layout:()=>inventoryLayout};'});
  r.continue()});
 await p.addInitScript(save=>{window.pauseFrames=true;if(!sessionStorage.getItem('seeded')){sessionStorage.setItem('seeded','1');localStorage.setItem('eldervale-save',JSON.stringify(save))}},SAVE);
 await p.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded',timeout:180000});await p.waitForFunction(()=>window.ready,null,{timeout:180000});
 await p.evaluate(()=>{document.querySelector('[data-tab=inventory]')?.click();window.invTest.draw()});
 return {p,context,errors};
}
const ids=p=>p.$$eval('#inventory>.slot',s=>s.map(e=>e.dataset.itemId||null));
const center=async(p,i)=>{const b=await p.locator('#inventory>.slot').nth(i).boundingBox();return {x:b.x+b.width/2,y:b.y+b.height/2}};
const menuOpen=p=>p.evaluate(()=>!document.querySelector('#contextmenu')?.hidden);
const savedOrder=p=>p.evaluate(()=>JSON.parse(localStorage.getItem('eldervale-save')).inventoryOrder);
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.ELDERVALE_CHROMIUM||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const out=process.env.ELDERVALE_SHOTS||path.join(require('os').tmpdir(),'eldervale-inventory-order');fs.mkdirSync(out,{recursive:true});
 try{
  // ── Desktop: mouse drag ──
  {const {p,context,errors}=await open(browser,{viewport:{width:1280,height:800}});
   const start=await ids(p);console.log('desktop start',start.slice(0,10));
   const dagger=start.indexOf('weapon:dagger');assert.ok(dagger>=0);
   // Drag the dagger onto an empty slot far down: it moves and is NOT equipped.
   const a=await center(p,dagger),b=await center(p,20);
   await p.mouse.move(a.x,a.y);await p.mouse.down();await p.mouse.move(a.x+12,a.y+6,{steps:3});await p.mouse.move(b.x,b.y,{steps:8});
   assert.equal(await p.locator('.inventory-drag-ghost').count(),1,'ghost follows the pointer');
   assert.equal(await p.locator('#inventory>.slot.drag-over').count(),1);
   await p.screenshot({path:path.join(out,'inventory-order-desktop-drag.png')});
   await p.mouse.up();
   let now=await ids(p);assert.equal(now[20],'weapon:dagger');assert.equal(now[dagger],null,'old slot is empty');
   assert.equal(await p.evaluate(()=>window.invTest.state.equippedWeapon),'longsword','drag did not equip');
   assert.equal(await p.locator('.inventory-drag-ghost').count(),0);
   // Swap two filled slots (a log with the noted logs).
   const wood=now.indexOf('wood'),note=now.indexOf('note:wood');const c=await center(p,wood),d=await center(p,note);
   await p.mouse.move(c.x,c.y);await p.mouse.down();await p.mouse.move(d.x,d.y,{steps:8});await p.mouse.up();
   now=await ids(p);assert.equal(now[wood],'note:wood');assert.equal(now[note],'wood');
   // Right-click still opens the menu; a plain click still equips.
   await p.locator('#inventory>.slot').nth(20).click({button:'right'});assert.ok(await menuOpen(p),'context menu');await p.evaluate(()=>{document.querySelector('#contextmenu').hidden=true});
   await p.waitForTimeout(450);await p.locator('#inventory>.slot').nth(20).click();
   assert.equal(await p.evaluate(()=>window.invTest.state.equippedWeapon),'dagger','click equips');
   // The longsword that came off fills the first empty slot (where the dagger was).
   now=await ids(p);assert.equal(now[dagger],'weapon:longsword');assert.equal(now[20],null);
   // Eating/using up an item leaves a gap; a new item takes the first gap.
   const shrimpAt=now.flatMap((v,i)=>v==='shrimp'?[i]:[]),firstFree=now.indexOf(null);await p.evaluate(()=>{window.invTest.state.shrimp--;window.invTest.draw()});
   const after=await ids(p);assert.equal(after.filter(v=>v==='shrimp').length,1);
   const gap=shrimpAt.find(i=>after[i]===null);console.log('shrimp slots',shrimpAt,'gap at',gap,'first free before',firstFree);assert.ok(gap!==undefined&&gap<firstFree,'the eaten shrimp leaves a gap inside the pack');
   assert.deepEqual(after.map((v,i)=>i===gap?'shrimp':v),now,'nothing else moved');now=after;
   await p.evaluate(()=>{window.invTest.state.ore++;window.invTest.draw()});now=await ids(p);assert.equal(now[gap],'ore');
   await p.waitForTimeout(16000);const order=await savedOrder(p);assert.deepEqual(order,now,'order saved locally (offline)');
   // Reload: the order is restored from the save.
   await p.reload({waitUntil:'domcontentloaded'});await p.waitForFunction(()=>window.ready,null,{timeout:180000});await p.evaluate(()=>{document.querySelector('[data-tab=inventory]')?.click();window.invTest.draw()});
   assert.deepEqual(await ids(p),now,'order survives reload');
   // Online: a drag sends one inventory_order command soon after.
   await p.evaluate(()=>{window.calls=[];window.eldervaleAuthority=true;window.eldervaleRealm={quietCommand:(c,payload)=>{window.calls.push([c,payload]);return Promise.resolve(true)},command:()=>Promise.resolve(true),checkpoint:()=>Promise.resolve(true)}});
   const e1=await center(p,0),e2=await center(p,27);await p.mouse.move(e1.x,e1.y);await p.mouse.down();await p.mouse.move(e2.x,e2.y,{steps:6});await p.mouse.up();
   await p.waitForTimeout(1000);const calls=await p.evaluate(()=>window.calls);console.log('commands',JSON.stringify(calls).slice(0,200));
   assert.equal(calls.length,1);assert.equal(calls[0][0],'inventory_order');assert.equal(calls[0][1].order.length,28);assert.deepEqual(calls[0][1].order,await ids(p));
   await p.screenshot({path:path.join(out,'inventory-order-desktop.png')});
   assert.deepEqual(errors,[]);await context.close();console.log('desktop ok')}
  // ── Touch 844×390: hold then drag; long-press menu; swipe; tap ──
  {const {p,context,errors}=await open(browser,{viewport:{width:844,height:390},hasTouch:true,isMobile:true,deviceScaleFactor:2});
   const cdp=await context.newCDPSession(p);const touch=(type,pt)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:pt?[{x:pt.x,y:pt.y,id:1}]:[]});
   const drag=async(from,to,{hold=0,steps=10}={})=>{await touch('touchStart',from);if(hold)await p.waitForTimeout(hold);for(let k=1;k<=steps;k++){await touch('touchMove',{x:from.x+(to.x-from.x)*k/steps,y:from.y+(to.y-from.y)*k/steps});await p.waitForTimeout(16)}await touch('touchEnd')};
   let now=await ids(p);console.log('touch start',now.slice(0,10));const box=await p.locator('#inventory').boundingBox();console.log('inventory box',box);
   const dagger=now.indexOf('weapon:dagger'),a=await center(p,dagger),b=await center(p,10);
   // Hold ~250 ms then drag: moves the item, no menu, no equip.
   await touch('touchStart',a);await p.waitForTimeout(250);
   for(let k=1;k<=10;k++){await touch('touchMove',{x:a.x+(b.x-a.x)*k/10,y:a.y+(b.y-a.y)*k/10});await p.waitForTimeout(16)}
   await p.screenshot({path:path.join(out,'inventory-order-touch-drag.png')});await touch('touchEnd');await p.waitForTimeout(100);
   now=await ids(p);assert.equal(now[10],'weapon:dagger','touch drag moved the dagger');assert.equal(now[dagger],null);
   assert.equal(await menuOpen(p),false,'no menu after drag');assert.equal(await p.evaluate(()=>window.invTest.state.equippedWeapon),'longsword');
   // Long-press without moving: menu opens, nothing moves.
   const before=await ids(p),c=await center(p,10);await touch('touchStart',c);await p.waitForTimeout(650);await touch('touchEnd');await p.waitForTimeout(100);
   assert.ok(await menuOpen(p),'long-press opens the menu');assert.deepEqual(await ids(p),before);
   await p.screenshot({path:path.join(out,'inventory-order-touch-menu.png')});
   await p.evaluate(()=>{document.querySelector('#contextmenu').hidden=true});await p.waitForTimeout(500);
   // Long-press, menu opens, then keep moving: the menu closes and the item drags.
   const wood=before.indexOf('wood'),w=await center(p,wood),t=await center(p,27);
   await touch('touchStart',w);await p.waitForTimeout(600);assert.ok(await menuOpen(p));
   for(let k=1;k<=10;k++){await touch('touchMove',{x:w.x+(t.x-w.x)*k/10,y:w.y+(t.y-w.y)*k/10});await p.waitForTimeout(16)}
   await touch('touchEnd');await p.waitForTimeout(100);now=await ids(p);assert.equal(now[27],'wood');assert.equal(await menuOpen(p),false);
   await p.waitForTimeout(500);
   // A quick swipe (no hold) does not drag.
   await p.evaluate(()=>{window.pe=[];for(const t of ['pointerdown','pointermove','pointerup','pointercancel','touchstart','touchmove'])document.addEventListener(t,e=>window.pe.push(t+' '+Math.round(e.timeStamp)+' '+(e.clientX|0)),true)});
   const s0=await ids(p),f=await center(p,s0.indexOf('ore'));await drag(f,await center(p,26),{hold:0,steps:6});await p.waitForTimeout(100);if(JSON.stringify(await ids(p))!==JSON.stringify(s0))console.log((await p.evaluate(()=>window.pe)).join('\n'));assert.deepEqual(await ids(p),s0,'swipe without hold does nothing');
   await p.waitForTimeout(500);
   // A tap still equips.
   await touch('touchStart',await center(p,10));await p.waitForTimeout(60);await touch('touchEnd');await p.waitForTimeout(300);
   assert.equal(await p.evaluate(()=>window.invTest.state.equippedWeapon),'dagger','tap equips');
   await p.screenshot({path:path.join(out,'inventory-order-touch.png')});
   assert.deepEqual(errors,[]);await context.close();console.log('touch ok')}
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
