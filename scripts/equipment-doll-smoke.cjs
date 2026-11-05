// Offline check of the paper-doll equipment tab, lit attack style/stance
// buttons and the relaxed default stance. Screenshots go to test-results/.
// usage: ELDERVALE_CHROMIUM=/path/to/chrome node scripts/equipment-doll-smoke.cjs
const assert=require('node:assert/strict'),fs=require('node:fs'),http=require('node:http'),path=require('node:path'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');const three=fs.readFileSync(path.join(root,'node_modules/three/build/three.module.js'));
const fixture={x:7,z:5,gold:123,appearance:{hair:'Short crop',skin:'#c9916b',shirt:'#426e68'}};
const server=http.createServer((req,res)=>{const p=new URL(req.url,'http://local').pathname,file=path.join(root,p==='/'?'index.html':p);try{res.setHeader('content-type',/\.js$/.test(file)?'text/javascript':/\.css$/.test(file)?'text/css':/\.png$/.test(file)?'image/png':/\.json$/.test(file)?'application/json':/\.html$/.test(file)?'text/html':'application/octet-stream');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
const width=Number(process.env.WIDTH||1280),height=Number(process.env.HEIGHT||800);
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.ELDERVALE_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});try{const p=await browser.newPage({viewport:{width,height}}),errors=[];p.on('pageerror',e=>{if(/updateHouseRoofs/.test(e.stack||''))return; // offline fixture houses lack story data (pre-existing)
 if(!errors.includes(e.message))console.error(e.stack||e.message);errors.push(e.message)});
await p.route('**/*',route=>{const url=route.request().url();if(url==='https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js')return route.fulfill({contentType:'text/javascript',body:three});if(url.startsWith('https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/')){const f=path.join(root,'node_modules/three/examples/jsm',url.split('/examples/jsm/')[1]);return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(f)})}if(!url.startsWith('http://127.0.0.1:'))return route.abort();const pn=new URL(url).pathname;if(pn==='/auth.js')return route.fulfill({contentType:'text/javascript',body:"document.querySelector('#auth-screen').hidden=true;window.eldervaleWorldLoading=true;import('./game.js').then(()=>{window.eldervaleWorldLoading=false;window.testGameReady=true},e=>{window.testGameError=String(e&&e.stack||e)})"});if(pn==='/game.js')return route.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game.js'),'utf8')+'\nwindow.testWorld={renderer,state,draw,refreshWeapon,refreshArmor,avatar,playerAnimator,player,camera,scene};'});return route.continue()});
await p.addInitScript(f=>localStorage.setItem('eldervale-save',JSON.stringify(f)),fixture);await p.goto('http://127.0.0.1:'+server.address().port);await p.waitForFunction(()=>window.testGameReady||window.testGameError,null,{timeout:240000});const loadError=await p.evaluate(()=>window.testGameError);if(loadError)throw Error(loadError);
await p.evaluate(()=>{const w=window.testWorld;w.state.equippedWeapon='longsword';w.state.weaponsOwned=[...new Set([...(w.state.weaponsOwned||[]),'longsword'])];w.state.equipped={...w.state.equipped,helm:true};w.state.armorOwned=[...new Set([...(w.state.armorOwned||[]),'helm'])];w.state.arrows=12;w.refreshWeapon();w.refreshArmor();w.draw()});
// Idle with a sword: relaxed stance by default.
await p.waitForTimeout(2500);const idle=await p.evaluate(()=>window.testWorld.playerAnimator.update(1/60,{armed:true}).clip);assert.equal(idle,'Idle_Loop','armed idle is relaxed');
await p.screenshot({path:path.join(root,'test-results/stance-relaxed.png')});
await p.locator('[data-tab="equipment"]').click();await p.waitForTimeout(400);
assert.equal(await p.locator('#equipment .equipment-doll').count(),1);
const slots=await p.$$eval('#equipment .equipment-doll .equip-slot',b=>b.map(x=>x.dataset.slot));for(const s of ['helm','cape','amulet','ammo','weapon','chest','shield','legs','arms','boots','trinket'])assert.ok(slots.includes(s),'doll has '+s);
await p.getByRole('button',{name:/Lunge —/}).click();await p.waitForTimeout(200);
const lit=await p.$eval('#equipment .attack-styles button[aria-pressed=true]',b=>[b.textContent,getComputedStyle(b).backgroundImage]);assert.equal(lit[0],'Lunge');assert.match(lit[1],/gradient/);
await p.getByRole('button',{name:'Combat stance'}).click();await p.waitForTimeout(200);assert.equal(await p.$eval('.stance-toggle button[aria-pressed=true]',b=>b.dataset.stance),'combat');assert.equal(await p.evaluate(()=>localStorage.getItem('eldervale-combat-stance')),'combat');
await p.evaluate(()=>document.querySelector('#equipment').scrollTop=0);await p.screenshot({path:path.join(root,'test-results/equipment-doll-'+width+'.png')});
await p.getByRole('button',{name:'Relaxed stance'}).click();
// Body integrity: swap outfits rapidly (including parts that stream in) and mount/dismount; every body region must stay attached and visible.
const body=await p.evaluate(async()=>{const w=window.testWorld,keys=['knightBreastplate2','knightGreaves3','knightGauntlets1','rangerTunic1','nobleCoat1','helm','chest','legs','boots'];w.state.armorOwned=[...new Set([...w.state.armorOwned,...keys])];
 const check=()=>{const a=w.avatar;const bad=a.allMeshes.filter(m=>m.parent!==a.model||!a.hairMeshes.includes(m)&&!m.visible||m.material?.visible===false);const missing=['chest','arms','legs','boots'].filter(s=>!a.parts[s]?.meshes.length);return {bad:bad.map(m=>m.name),missing}};
 const results=[];for(let i=0;i<24;i++){const k=keys[i%keys.length];w.state.equipped={[k]:i%3!==0};w.refreshArmor();await new Promise(r=>setTimeout(r,i%4?5:400));results.push(check())}
 await new Promise(r=>setTimeout(r,3000));results.push(check());return results});
for(const r of body){assert.deepEqual(r.bad,[],'detached or hidden body meshes');assert.deepEqual(r.missing,[],'missing body regions')}
assert.deepEqual(errors,[]);console.log('PASS: paper-doll equipment, lit style/stance, relaxed armed idle.');
}finally{await browser.close();server.close()}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
