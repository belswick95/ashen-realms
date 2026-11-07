// Offline smoke test for the bank's "Deposit inventory" button (bank-ui.js, db/bank-deposit-all.sql).
// No account and no network: the page is a stub that builds the real bank panel from economy.js.
//  1. Offline mode (no realm): one click empties the backpack into the bank; worn gear stays.
//  2. Online mode with a stub realm: the click sends ONE 'bank' command {direction:'deposit_all'}
//     and reports what a full bank stack could not hold.
//  3. Phone landscape 844x390 (with and without touch controls): the button is at least 40px,
//     inside the panel, and overlaps no other bank control.
// Run: ELDERVALE_CHROMIUM=/path/to/chrome node scripts/bank-deposit-all-smoke.cjs
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright-core'),root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{try{const name=new URL(req.url,'http://local').pathname;res.setHeader('content-type',name.endsWith('.css')?'text/css':name.endsWith('.webp')?'image/webp':name.endsWith('.png')?'image/png':'text/javascript');res.end(fs.readFileSync(path.join(root,name)))}catch{res.writeHead(404).end()}});
const chrome=process.env.ELDERVALE_CHROMIUM||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
const fixture=(online)=>`<html><head><meta name="viewport" content="width=device-width,initial-scale=1"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script><link rel="stylesheet" href="/medieval-theme.css"><link rel="stylesheet" href="/gameplay.css"><link rel="stylesheet" href="/bank.css"><link rel="stylesheet" href="/phone-fit.css"></head><body style="background:#12232d"><script type="module">
import {createServicePanel,depositInventory} from '/economy.js?v=release-20261107-canopy152';
window.testState={gold:5,bank:{wood:10,bait:999999990},wood:4,'note:wood':40,bait:50,bread:3,weaponsOwned:['longsword','longsword'],equippedWeapon:'longsword',armorOwned:['bronzeArmet'],shieldsOwned:[],jewelryOwned:[],mountsOwned:[],equipped:{}};
window.sent=[];
if(${online}){window.eldervaleAuthority=true;window.eldervaleRealm={lastError:'',command:async(c,p)=>{sent.push([c,p]);await new Promise(r=>setTimeout(r,50));const r=depositInventory(testState);if(r.error){eldervaleRealm.lastError=r.error;return false}return true}}}
window.services=createServicePanel(testState,{onChange(){},onOpen(){}});services.open('bank','Royal Bank');window.ready=true;
</script></body></html>`;
const overlap=(a,b)=>a.x<b.x+b.width-0.5&&b.x<a.x+a.width-0.5&&a.y<b.y+b.height-0.5&&b.y<a.y+a.height-0.5;
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch({executablePath:chrome,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 fs.mkdirSync(path.join(root,'test-results'),{recursive:true});
 try{
  for(const online of [false,true]){
   const p=await b.newPage({viewport:{width:1100,height:760}});const errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('pageerror:',e.message)});p.on('console',m=>{if(m.type()==='error')console.log('console:',m.text())});p.on('requestfailed',r=>console.log('failed:',r.url()));
   await p.route('**/bank-fixture',r=>r.fulfill({contentType:'text/html',body:fixture(online)}));
   await p.route(u=>!String(u).startsWith(base),r=>r.abort());
   await p.goto(base+'/bank-fixture');await p.waitForFunction(()=>window.ready,null,{timeout:15000});
   const button=p.getByRole('button',{name:'Deposit inventory'});
   assert.equal(await button.count(),1);assert.match(await button.getAttribute('title'),/every backpack item/);
   assert.equal(await button.locator('svg.bank-carved-icon').count(),1);
   assert.equal(await p.locator('.bank-inventory-grid .bank-slot:not(.bank-empty)').count(),11,'4 logs, notes, bait, 3 bread, spare sword, helm');
   await button.click();
   await p.waitForFunction(()=>!document.querySelector('[data-bank-deposit-all]').closest('.royal-bank').querySelector('.bank-status').textContent.includes('Depositing'));
   const st=await p.evaluate(()=>testState);
   assert.deepEqual({wood:st.wood,notes:st['note:wood'],trout:st.bread,bait:st.bait,swords:st.weaponsOwned,helm:st.armorOwned},{wood:0,notes:0,trout:0,bait:40,swords:['longsword'],helm:[]});
   assert.equal(st.bank.wood,54);assert.equal(st.bank.bait,1e9);assert.equal(st.bank.bread,3);assert.equal(st.bank['weapon:longsword'],1);
   const status=await p.locator('.bank-status').textContent();assert.match(status,/could not hold everything.*bait/i);
   assert.equal(await p.locator('.bank-inventory-grid .bank-slot:not(.bank-empty)').count(),1,'only the overflowing bait stack is left');
   if(online)assert.deepEqual(await p.evaluate(()=>sent),[['bank',{direction:'deposit_all'}]],'one server command');
   // Empty the rest: make room and deposit again; the button then disables.
   await p.evaluate(()=>{testState.bank.bait=0;services.refresh()});await button.click();
   await p.waitForFunction(()=>document.querySelector('.bank-status').textContent.includes('now in the vault'));assert.ok(await button.isDisabled(),'nothing left to deposit');
   assert.equal(await p.evaluate(()=>testState.bait),0);assert.match(await p.locator('.bank-status').textContent(),/backpack is now in the vault/);
   if(!online)await p.screenshot({path:path.join(root,'test-results/bank-deposit-all-desktop.png')});
   // Phone landscape: refill the backpack so every control is live, then measure.
   for(const touch of [false,true]){
    await p.evaluate(t=>{Object.assign(testState,{wood:6,bait:3,'note:wood':9});document.body.classList.toggle('touch-controls',t);services.refresh()},touch);
    await p.setViewportSize({width:844,height:390});await p.waitForTimeout(100);
    const panel=await p.locator('#service-panel').boundingBox(),box=await button.boundingBox();
    assert.ok(box.height>=40&&box.width>=40,'touch target '+JSON.stringify(box));
    assert.ok(box.x>=panel.x&&box.y>=panel.y&&box.x+box.width<=panel.x+panel.width+0.5&&box.y+box.height<=panel.y+panel.height+0.5,'inside the panel');
    assert.ok(panel.x>=0&&panel.y>=0&&panel.x+panel.width<=844&&panel.y+panel.height<=390,'panel fits the phone');
    const others=await p.locator('#service-panel button:visible, #service-panel select:visible, #service-panel input:visible, .bank-gold, .bank-status:visible').evaluateAll(n=>n.filter(e=>!e.matches('[data-bank-deposit-all]')&&!e.closest('.bank-storage-grid,.bank-inventory-grid,.bank-tabs')).map(e=>{const r=e.getBoundingClientRect();return {name:e.textContent.trim().slice(0,24)||e.className,x:r.x,y:r.y,width:r.width,height:r.height}}).filter(r=>r.width&&r.height));
    for(const o of others)assert.ok(!overlap(box,o),'overlaps '+o.name+' '+JSON.stringify(o)+' vs '+JSON.stringify(box));
    // The scrolling grids must not sit under the button either.
    for(const sel of ['.bank-storage-grid','.bank-inventory-grid']){const g=await p.locator(sel).boundingBox();assert.ok(!overlap(box,g),sel+' under the button')}
    if(!online)await p.screenshot({path:path.join(root,'test-results/bank-deposit-all-phone'+(touch?'-touch':'')+'.png')});
    await p.setViewportSize({width:1100,height:760});
   }
   assert.deepEqual(errors,[]);await p.close();
   console.log('PASS',online?'online (one deposit_all command, stub realm)':'offline','deposit inventory, full-stack report, phone 844x390 targets');
  }
 }finally{await b.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
