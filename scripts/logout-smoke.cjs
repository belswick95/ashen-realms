// Logout rule end to end in Chromium: the real auth.js, realm-client.js and logout-guard.js against an
// in-browser fake Supabase (no network, no real account). Checks the OSRS rule from both entry points
// (the X at the top-right and the Settings tab's Log out button): refused during and within 10 s of
// combat, server refusal honoured, immediate logout afterwards, and the failed-save "Retry logout" path.
// Usage: ELDERVALE_CHROMIUM=/path/to/chrome node scripts/logout-smoke.cjs
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('playwright-core');const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{const file=path.resolve(root,'.'+(new URL(req.url,'http://local').pathname==='/'?'/index.html':new URL(req.url,'http://local').pathname));if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}try{res.setHeader('Content-Type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.png')?'image/png':'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
const USER='11111111-1111-4111-8111-111111111111';
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:process.env.ELDERVALE_CHROMIUM||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{
 const page=await browser.newPage({viewport:{width:1280,height:800}}),errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error('PAGE:',e.message)});page.setDefaultTimeout(30000);
 await page.route('**/*',route=>{const u=route.request().url(),name=u.startsWith('http://127.0.0.1:')?new URL(u).pathname:'';
  if(u.includes('/@supabase/supabase-js@'))return route.fulfill({contentType:'text/javascript',body:'export const createClient=()=>window.mockSupabase;'});
  if(name==='/game.js')return route.fulfill({contentType:'text/javascript',body:`window.notices=[];window.eldervaleCaptureSave=()=>JSON.parse(localStorage.getItem('eldervale-save')||'{}');window.eldervaleRealmBridge={snapshot(){},event(){}};window.eldervaleWorldBridge={notice:t=>window.notices.push(t)};document.body.classList.add('game-active','fantasy-hud');`});
  for(const [file,body] of [['/world-client.js','export async function startWorld(){}'],['/social.js','export function startSocial(){}'],['/music.js','export function startMusic(){}'],['/tutorial-prologue.js','export const wantsPrologue=()=>false;export function startPrologue(){}']])if(name===file)return route.fulfill({contentType:'text/javascript',body});
  if(!name)return route.abort();return route.continue()});
 await page.addInitScript(user=>{
  const me={id:user,email:'tester@example.invalid',user_metadata:{username:'Tester'}};
  window.rpcLog=[];window.mockEvents=[];window.mockServerCombat=false;let cursor=0;
  const sync=()=>{const events=window.mockEvents.splice(0).map(data=>({id:++cursor,data}));return {data:{time:new Date().toISOString(),events,eventCursor:cursor}}};
  window.mockSupabase={rpc:async(fn,args={})=>{
   if(fn==='world_snapshot')return {data:{settings:{maintenance:false,revision:1,world_config:{enabled:true,seed:241916600,version:2}},access:{},owner:false,entities:[],deliveries:[]}};
   if(fn==='world_enter')return {data:{save:{user_id:user,gold:5,health:100,max_health:100,world_position:{x:-229,y:134},game_flags:{appearance:{hair:'Buzz cut'},tutorial:{done:true}}},session:'44444444-4444-4444-8444-444444444444'}};
   if(fn==='world_command_lean'||fn==='world_command'){if(args.command!=='sync')window.rpcLog.push(args.command);
    if(args.command==='logout'&&window.mockLogoutBusy>0){window.mockLogoutBusy--;return {error:{message:'canceling statement due to statement timeout'}}}
    if(args.command==='logout'){if(window.mockServerCombat)return {error:{message:"You can't log out until 10 seconds after the end of combat."}};window.serverLoggedOut=true;return {data:{reset:true,loggedOut:true}}}
    if(localStorage.getItem('mock-fail')==='1')return {error:{message:'Failed to fetch'}};
    return sync()}
   throw Error('Unexpected fixture RPC: '+fn)},
   auth:{getSession:async()=>({data:{session:localStorage.getItem('mock-signed-out')?null:{user:me}}}),signOut:async()=>{window.rpcLog.push('signOut');localStorage.setItem('mock-signed-out',window.serverLoggedOut?'after-server-logout':'without-server-logout');return {error:null}}},
   from:()=>({upsert:async()=>({error:null})})};
 },USER);
 const ready=()=>page.waitForFunction(()=>!!document.querySelector('#logout-x')&&!!window.eldervaleRealm);
 await page.goto(`http://127.0.0.1:${server.address().port}`);await ready();
 const x=page.locator('#logout-x');assert.equal(await x.getAttribute('aria-label'),'Log out');assert.equal(await x.getAttribute('title'),'Log out');
 const box=await x.boundingBox();assert.ok(box.width>=40&&box.height>=40,'X is at least 40px '+JSON.stringify(box));
 // 1. Hit on the player arrives in a sync: the X locks, both buttons refuse, no server call.
 await page.evaluate(user=>window.mockEvents.push({type:'hit',player:user,side:'enemy',damage:4}),USER);
 await page.waitForFunction(()=>document.querySelector('#logout-x').classList.contains('logout-locked'));
 assert.match(await x.getAttribute('title'),/in combat: wait \d+ s/);
 await x.click();await page.waitForFunction(()=>!document.querySelector('#logout-toast')?.hidden);
 assert.equal(await page.locator('#logout-toast').innerText(),"You can't log out until 10 seconds after the end of combat.");
 await page.evaluate(()=>document.querySelector('#settings-logout').click());await page.waitForTimeout(200);
 assert.equal(await page.evaluate(()=>window.notices.filter(t=>/can't log out/.test(t)).length),2,'both entry points refuse');
 assert.deepEqual(await page.evaluate(()=>window.rpcLog),[],'no logout reached the server');
 // 2. 10 s after the hit the lock clears; the server still says combat (stale client): refused, still signed in.
 await page.waitForFunction(()=>!document.querySelector('#logout-x').classList.contains('logout-locked'),null,{timeout:15000});
 await page.evaluate(()=>{window.mockServerCombat=true});await x.click();await page.waitForFunction(()=>window.notices.length>=3);
 assert.deepEqual(await page.evaluate(()=>window.rpcLog),['logout']);assert.equal(await page.locator('#auth-screen').isHidden(),true);
 assert.equal(await x.evaluate(el=>el.classList.contains('logout-locked')),true,'a server refusal restarts the client timer');
 // 3. A failed save keeps the player in: "Retry logout", no logout command sent.
 await page.waitForFunction(()=>!document.querySelector('#logout-x').classList.contains('logout-locked'),null,{timeout:15000});
 await page.evaluate(()=>{window.mockServerCombat=false;window.rpcLog.length=0;localStorage.setItem('mock-fail','1')});
 await page.evaluate(()=>document.querySelector('#settings-logout').click());await page.waitForFunction(()=>document.querySelector('#logout').textContent==='Retry logout');
 assert.deepEqual(await page.evaluate(()=>window.rpcLog),[]);
 // 4. Out of combat, save works, but the realm is busy (the server's logout times out twice): the X
 // answers at once ("Logging out…"), says it is retrying, a second tap repeats the status instead of
 // doing nothing, and the logout completes by itself (server logout, sign-out, sign-in screen).
 await page.evaluate(()=>{localStorage.removeItem('mock-fail');window.mockLogoutBusy=2});await x.click();
 await page.waitForFunction(()=>window.notices.some(t=>/Logging out/.test(t)),null,{timeout:3000});
 await page.waitForFunction(()=>/busy.*retrying/i.test(document.querySelector('#logout-toast')?.textContent||''),null,{timeout:12000});
 assert.equal(await x.evaluate(el=>el.classList.contains('logout-busy')),true,'the X shows a logout under way');
 await x.click();assert.match(await page.locator('#logout-toast').innerText(),/busy.*retrying/i,'a second tap answers with the status');
 await page.waitForFunction(()=>!!localStorage.getItem('mock-signed-out'));assert.equal(await page.evaluate(()=>localStorage.getItem('mock-signed-out')),'after-server-logout');await page.waitForFunction(()=>!document.querySelector('#auth-screen').hidden);
 assert.equal(await page.locator('#logout-x').count(),0,'no X on the sign-in screen');
 assert.deepEqual(errors,[]);console.log('PASS: logout X and Settings button share the OSRS 10 s combat rule (client lock, server refusal, retry after failed save, immediate logout) - fake transport only.');
 }finally{await browser.close();server.close()}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
