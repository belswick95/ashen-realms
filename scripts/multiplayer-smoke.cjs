// Opt-in integration test: two real game contexts use an isolated, random
// Supabase Realtime topic. No accounts, chat messages or save rows are written.
if(!process.argv.includes('--live'))throw Error('Use --live to run the external Realtime integration check.');
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path');const {chromium}=require(process.env.ELDERVALE_PLAYWRIGHT_MODULE||'playwright-core');
const root=path.resolve(__dirname,'..'),manifest=process.env.ELDERVALE_SDK_MANIFEST?JSON.parse(fs.readFileSync(process.env.ELDERVALE_SDK_MANIFEST)):{},key=fs.readFileSync(root+'/auth.js','utf8').match(/createClient\('[^']+','([^']+)'/)[1],topic='eldervale-diagnostic-game-'+Date.now();
const server=http.createServer((req,res)=>{const pathname=new URL(req.url,'http://local').pathname,file=path.join(root,pathname==='/'?'index.html':pathname);try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({...(process.env.ELDERVALE_CHROMIUM?{executablePath:process.env.ELDERVALE_CHROMIUM}:{}),headless:true,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});const errors=[];try{
 const pages=[];
 for(let i=0;i<2;i++){
  const context=await browser.newContext({viewport:{width:900,height:650}}),page=await context.newPage();pages.push(page);page.setDefaultTimeout(90000);page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE:',e.message)});
  await page.addInitScript(({i,relay})=>{if(relay){const Native=WebSocket;window.WebSocket=class extends Native{constructor(url,protocols){super(relay+'?target='+encodeURIComponent(url),protocols)}}};localStorage.setItem('eldervale-save',JSON.stringify({x:i?7:3,z:5,appearance:{hair:i?'Long':'Short crop'},gold:100}));localStorage.setItem('eldervale-client-settings',JSON.stringify({preset:'low',scale:.65,distance:110,shadows:false}));},{i,relay:process.env.ELDERVALE_WS_RELAY||''});
  await page.route('**/*',route=>{const url=route.request().url(),pathname=new URL(url).pathname;
   if(url.includes('three@0.160.1/'))return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(root+'/node_modules/three/build/three.module.js')});
   if(manifest[url])return route.fulfill({contentType:'text/javascript',headers:{'access-control-allow-origin':'*'},body:fs.readFileSync(manifest[url])});
   if(pathname==='/game.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(root+'/game.js','utf8')+'\nwindow.mpWorld={player,remotePlayers,renderer,scene,camera};'});
   if(pathname==='/auth.js')return route.fulfill({contentType:'text/javascript',body:`document.querySelector('#auth-screen').hidden=true;await import('/game.js');const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm');const {startSocial}=await import('/social.js');const client=createClient('https://aojccnhmvxurrnnzteej.supabase.co',${JSON.stringify(key)},{auth:{persistSession:false,autoRefreshToken:false,detectSessionInUrl:false}});const noop=()=>{const c={on:()=>c,subscribe:()=>c};return c};const query=new Proxy({},{get:(_,name)=>name==='then'?resolve=>resolve({data:[],error:null}):()=>query});const db={channel:(name,opts)=>name==='eldervale-world-presence'?client.channel(${JSON.stringify(topic)},opts):noop(),removeChannel:c=>c.unsubscribe?client.removeChannel(c):Promise.resolve(),from:()=>query};window.mpSocial=startSocial(db,{id:'isolated-test-${i}',user_metadata:{username:'NetworkTester${i+1}'}});window.mpClient=client;window.mpReady=true;`});
   if(url.startsWith('https://cdn.jsdelivr.net/npm/'))return route.continue();if(!url.startsWith('http://127.0.0.1:'))return route.abort();return route.continue();
  });
  await page.goto('http://127.0.0.1:'+server.address().port);try{await page.waitForFunction(()=>window.mpReady)}catch(e){console.error('Boot diagnostics:',errors,await page.evaluate(()=>({world:!!window.mpWorld,social:!!window.mpSocial,status:document.querySelector('#auth-status')?.textContent})));throw e}console.log('Game client '+(i+1)+' booted');if(i===0)await page.evaluate(()=>{window.resumeRAF=window.requestAnimationFrame;window.requestAnimationFrame=fn=>{window.pausedFrame=fn;return 0}});
 }
 await pages[0].evaluate(()=>{window.requestAnimationFrame=window.resumeRAF;if(window.pausedFrame)requestAnimationFrame(window.pausedFrame)});
 for(const [i,page] of pages.entries())await page.waitForFunction(()=>window.mpWorld.remotePlayers.size===1&&document.querySelector('#multiplayer-status').textContent==='Online · 2');
 console.log('PASS: both real game clients discover each other over live Realtime');
 await pages[0].evaluate(()=>{window.mpWorld.player.position.x=5});
 await pages[1].waitForFunction(()=>window.mpWorld.remotePlayers.get('isolated-test-0')?.target.x===5);console.log('PASS: real movement packet updates the other game avatar');
 for(const [i,page] of pages.entries()){
  assert.equal(await page.locator('#overhead-chat-layer').getByText('NetworkTester'+(i?1:2),{exact:true}).isVisible(),true);
  await page.screenshot({path:root+'/test-results/multiplayer-'+(i+1)+'.png'});
 }
 await pages[1].evaluate(()=>{const event=new Event('pagehide');Object.defineProperty(event,'persisted',{value:true});window.dispatchEvent(event)});
 await pages[0].waitForFunction(()=>window.mpWorld.remotePlayers.size===0);console.log('PASS: departing player disappears');
 await pages[1].evaluate(()=>{const event=new Event('pageshow');Object.defineProperty(event,'persisted',{value:true});window.dispatchEvent(event)});
 await pages[0].waitForFunction(()=>window.mpWorld.remotePlayers.size===1);await pages[1].waitForFunction(()=>window.mpWorld.remotePlayers.size===1);console.log('PASS: page restoration rejoins and both avatars return');
 await pages[0].evaluate(()=>window.mpSocial.multiplayer.reconnect());await pages[0].waitForFunction(()=>document.querySelector('#multiplayer-status').textContent==='Online · 2');console.log('PASS: closed-channel reconnect recovers');
 assert.deepEqual(errors,[]);console.log('PASS: two live game contexts, bidirectional visibility, movement, departure, restored page and reconnect; random isolated topic, no accounts or saved data changed.');
 }finally{for(const c of browser.contexts())for(const page of c.pages())await page.evaluate(()=>window.mpClient?.removeAllChannels()).catch(()=>{});await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
