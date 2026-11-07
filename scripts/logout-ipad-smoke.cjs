// The logout X on an iPad (touch only): the real game HUD (game.js, hud-redesign, phone-fit.css)
// in Chromium with iPad Pro 11 landscape emulation, driven by touchscreen taps only (no mouse).
// No network and no account: three.js comes from node_modules, auth.js is replaced by a stub that
// boots the game, and the logout handler is a probe.
// Usage: ELDERVALE_CHROMIUM=/path/to/chrome node scripts/logout-ipad-smoke.cjs
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict'),{chromium,devices}=require('playwright-core'),root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'db/generated-world.json')));
const VERSION=(fs.readFileSync(path.join(root,'index.html'),'utf8').match(/release-[0-9a-z-]+/)||['release'])[0];
const server=http.createServer((req,res)=>{try{const file=path.join(root,new URL(req.url,'http://local').pathname==='/'?'index.html':new URL(req.url,'http://local').pathname);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.ELDERVALE_CHROMIUM||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const context=await browser.newContext({...devices['iPad Pro 11 landscape'],hasTouch:true}),p=await context.newPage(),errors=[];
  p.on('pageerror',e=>{errors.push(e.message);console.log('PAGE',e.message)});
  await p.route('**/*',r=>{const url=r.request().url();
   if(url.includes('three@0.160.1/examples/jsm/'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/three/examples/jsm',url.split('three@0.160.1/examples/jsm/')[1].split('?')[0]))});
   if(url.includes('three@0.160.1/build/three.module.js'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/three/build/three.module.js'))});
   if(!url.startsWith('http://127.0.0.1:'))return r.abort();const name=new URL(url).pathname;
   if(name==='/auth.js')return r.fulfill({contentType:'text/javascript',body:`globalThis.eldervaleWorldConfig=${JSON.stringify(manifest.config)};document.querySelector('#auth-screen').hidden=true;import('./geography.js?v=${VERSION}').then(g=>g.initializeGeography(globalThis.eldervaleWorldConfig)).then(()=>import('./game.js?v=${VERSION}')).then(()=>window.ready=true);`});
   if(name==='/game.js')return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game.js'),'utf8').replace('function frame(){requestAnimationFrame(frame);','function frame(){if(window.pauseFrames)return;requestAnimationFrame(frame);')});
   r.continue()});
  await p.addInitScript(()=>{window.pauseFrames=true;localStorage.setItem('eldervale-save',JSON.stringify({x:-229,z:134}))});
  await p.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded',timeout:120000});
  await p.waitForFunction(()=>window.ready,null,{timeout:120000});
  // The X as auth.js installs it once the world is up; the probe counts taps that reach the handler.
  await p.evaluate(async v=>{const g=await import('/logout-guard.js?v='+v);window.xTaps=0;window.logoutGuard=g;g.installLogoutButton(()=>{window.xTaps++})},VERSION);
  await p.waitForTimeout(400);
  const probe=()=>p.evaluate(()=>{const b=document.querySelector('#logout-x'),r=b.getBoundingClientRect(),cx=r.x+r.width/2,cy=r.y+r.height/2,top=document.elementFromPoint(cx,cy),css=getComputedStyle(b);
   return {box:{x:r.x,y:r.y,w:r.width,h:r.height},top:top&&(top.id||top.className?.baseVal||top.className||top.tagName),onX:!!top&&(top===b||b.contains(top)),pointerEvents:css.pointerEvents,visibility:css.visibility,display:css.display,host:b.parentElement?.id}});
  const before=await probe();console.log('X',JSON.stringify(before));
  console.log('around',JSON.stringify(await p.evaluate(()=>{const r=document.querySelector('#logout-x').getBoundingClientRect(),out={};for(const [k,dx,dy] of [['tl',3,3],['bl',4,r.height-4],['br',r.width-3,r.height-3],['below',r.width/2,r.height+3],['left',-4,r.height/2]]){const e=document.elementFromPoint(r.x+dx,r.y+dy);out[k]=e&&(e.id||String(e.className?.baseVal??e.className)||e.tagName)}out.body=document.body.className;const m=document.querySelector('#minimap').getBoundingClientRect();out.minimap=[m.x,m.y,m.width,m.height];return out})));
  assert.ok(before.box.w>=32&&before.box.h>=32,'X is a usable touch target');
  assert.equal(before.onX,true,'nothing covers the X: '+before.top);
  const tap=async()=>{const s=await probe();await p.touchscreen.tap(s.box.x+s.box.w/2,s.box.y+s.box.h/2);await p.waitForTimeout(250)};
  // 1. Out of combat: one tap reaches the logout flow.
  await tap();assert.equal(await p.evaluate(()=>window.xTaps),1,'a touch tap on the X starts the logout');
  // 2. A tap at the X's edge (finger slightly off the centre) still counts.
  {const s=await probe();await p.touchscreen.tap(s.box.x+4,s.box.y+s.box.h-4);await p.waitForTimeout(250);assert.equal(await p.evaluate(()=>window.xTaps),2,'edge tap reaches the X')}
  // 3. While a world panel is open on the touch layout the X still answers.
  await p.evaluate(()=>document.querySelector('#side [data-tab]')?.click());await p.waitForTimeout(200);
  const withPanel=await probe();console.log('X with panel',JSON.stringify(withPanel));
  if(withPanel.display!=='none'&&withPanel.visibility!=='hidden'&&withPanel.box.w>0){await tap();assert.equal(await p.evaluate(()=>window.xTaps),3,'tap with a panel open')}
  // 4. The real flow behind the X answers at once: busy server -> "retrying" notice, never silence.
  const flow=await p.evaluate(async()=>{const g=window.logoutGuard,notes=[];let calls=0;
   const f=g.createLogoutFlow({clock:g.createCombatClock(),notify:t=>notes.push(t),onBusy:b=>notes.push(b?'busy:on':'busy:off'),save:async()=>true,
    leave:async()=>{calls++;return calls<3?{error:'The realm is busy - please try that again.',busy:true}:{ok:true}},signOut:async()=>true,finish:()=>notes.push('finished'),retryDelays:[10,10,10]});
   const result=await f.request();return {result,notes,calls}});
  console.log('flow',JSON.stringify(flow));
  assert.equal(flow.result,'done');assert.ok(flow.notes.some(n=>/busy.*retrying/i.test(n)),'a busy realm shows "retrying"');
  assert.deepEqual(errors,[]);
  await p.screenshot({path:path.join(root,'test-results','logout-ipad.png')}).catch(()=>{});
  console.log('PASS: the logout X answers touch taps on an iPad (landscape), and a busy realm shows a retrying notice.');
 }finally{await browser.close();server.close()}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
