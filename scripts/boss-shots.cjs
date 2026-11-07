// Screenshots of the Round-3 bosses in the real renderer (offline, like underground-shots.cjs): every lair,
// boss telegraphs, the boss bar, flight and breath, the defeat chest, and the unique gear on a character.
// Usage: ELDERVALE_CHROMIUM=/usr/bin/google-chrome node scripts/boss-shots.cjs [outDir]
const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright-core'),root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'db/generated-world.json')));
const out=path.resolve(process.argv[2]||path.join(root,'test-results/boss-shots'));fs.mkdirSync(out,{recursive:true});
const V='?v=release-20261107-canopy152';
const server=http.createServer((req,res)=>{try{const name=new URL(req.url,'http://local').pathname,file=path.join(root,name==='/'?'index.html':name);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':file.endsWith('.webp')?'image/webp':file.endsWith('.json')?'application/json':'application/octet-stream');res.end(fs.readFileSync(file))}catch{res.statusCode=404;res.end()}});
(async()=>{
 globalThis.eldervaleWorldConfig=manifest.config;
 const ug=await import(path.join(root,'underground-data.js')+V),ag=await import(path.join(root,'agility-data.js')+V),best=await import(path.join(root,'bestiary.js')+V),seed=await import(path.join(root,'scripts/build-water-seed.mjs'));
 const {entityDefaults}=await import(path.join(root,'world-templates.js')+V);
 const rows=manifest.entities.map((data,i)=>({id:'base:'+i,data,revision:1}));let n=0;const push=data=>rows.push({id:'r2g:'+(n++),data,revision:1});
 const bs=await import(path.join(root,'bosses.js')+V),areas=[...ug.dungeons.map(bs.withLair),...bs.LAIRS],bossIds={};
 const tpl=Object.fromEntries(bs.NEW_MONSTERS.map(m=>{const {base,key,rank,...look}=m;return [key,{...best.bestiaryEntity(base,0,0),...look,name:m.name,level:m.level}]}));
 const mon=(k,x,z)=>tpl[k]?{...tpl[k],x,z}:best.bestiaryEntity(k,x,z);
 for(const area of areas){for(const p of ug.passageObjects(area))push({...entityDefaults(p.template,p.x,p.z),name:p.name,yaw:p.yaw,passage:p.passage});
  for(const s of ug.spawnPlan(area))try{const b=bs.BOSSES.find(b=>b.roster===s.roster);if(b)bossIds[b.id]='r2g:'+n;push({...mon(s.roster,s.x,s.z),roam:0,...(b?{bossId:b.id,boss:true}:{})})}catch{}}
 for(const s of ag.shortcuts){const e=ag.shortcutEntity(s);push({...entityDefaults(s.template,e.x,e.z),...e})}
 for(const h of seed.hubEntities())push(h.data);
 for(const s of seed.spotPlan())push({...entityDefaults('fishing_spot',s.x,s.z),name:s.name,spotType:s.type,waterHeight:s.waterHeight,moves:s.moves});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({...(process.env.ELDERVALE_CHROMIUM?{executablePath:process.env.ELDERVALE_CHROMIUM}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{const p=await browser.newPage({viewport:{width:1100,height:720}});p.on("pageerror",e=>console.log("PAGE",e.message,(e.stack||"").split("\n").slice(1,4).join(" | ")));p.on('console',m=>{if(m.type()==='error')console.log('CONSOLE',m.text().slice(0,300))});
  await p.route('**/*',r=>{const url=r.request().url();if(url.includes('three@0.160.1/examples/jsm/'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/three/examples/jsm',url.split('three@0.160.1/examples/jsm/')[1].split('?')[0]))});if(url.includes('three@0.160.1/build/three.module.js'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/three/build/three.module.js'))});if(!url.startsWith('http://127.0.0.1:'))return r.abort();const name=new URL(url).pathname;
   if(name==='/auth.js')return r.fulfill({contentType:'text/javascript',body:`globalThis.eldervaleWorldConfig=${JSON.stringify(manifest.config)};document.querySelector('#auth-screen').hidden=true;import('./geography.js${V}').then(g=>g.initializeGeography(globalThis.eldervaleWorldConfig)).then(()=>import('./game.js${V}')).then(()=>window.ready=true);`});
   if(name==='/game.js')return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game.js'),'utf8').replace('function frame(){requestAnimationFrame(frame);','function frame(){if(window.pauseFrames)return;requestAnimationFrame(frame);')+'\nwindow.visualTest={scene,camera,renderer,player,landscape,frame,setCamera:(y,p,z)=>{yaw=y;pitch=p;zoom=z},move:(x,z,steps=1)=>{player.position.set(x,landscape.walkHeight(x,z),z);cameraFocus=null;for(let i=0;i<steps;i++){window.pauseFrames=false;frame();window.pauseFrames=true}}};'});r.continue()});
  await p.addInitScript(()=>{window.pauseFrames=true;localStorage.setItem('eldervale-save',JSON.stringify({x:-229,z:134,equippedWeapon:'rimeheartSpear',weaponsOwned:['rimeheartSpear'],equippedShield:'wardensAegis',shieldsOwned:['wardensAegis'],armorOwned:['heartforgePlate','warlordTuskhelm','glacierscaleGreaves','emberOathGauntlets'],equipped:{heartforgePlate:true,warlordTuskhelm:true,glacierscaleGreaves:true,emberOathGauntlets:true},appearance:{shirt:'#746951',skin:'#c9916b'}}))});
  await p.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded',timeout:180000});await p.waitForFunction(()=>window.ready,null,{timeout:180000});
  await p.evaluate(async rows=>{await window.eldervaleWorldBridge.apply(rows);await window.eldervaleRegionStreamer.idle()},rows);await p.evaluate(a=>window.eldervaleUnderground.setAreas(a),areas);console.log('world ready,',rows.length,'rows');
  const A=id=>bossIds[id],at=(b,dx=0,dz=0)=>{const d=bs.bossById[b],a=areas.find(a=>a.id===d.lair.area),r=a.levels.find(l=>l.level===d.lair.level).rooms.find(r=>r.id===d.lair.room);return {x:a.origin.x+r.x+dx,z:a.origin.z+d.lair.level*400+r.z+dz,area:a.id}};
  const ev=(b,list)=>list.map(e=>({target:A(b),player:'me',...e}));
  const T=(i,j)=>[i,j];const tiles=(p,shape,o)=>bs.telegraphTiles(shape,{c:[Math.floor((p.x-6)/1.58+.5),Math.floor(p.z/1.58+.5)],b:[Math.floor(p.x/1.58+.5),Math.floor(p.z/1.58+.5)],...o});
  const shots=[];
  for(const b of bs.BOSSES){const c=at(b.id);shots.push({file:'lair-'+b.id+'.png',x:c.x-7,z:c.z,yaw:-Math.PI/2+.5,pitch:.55,zoom:18,area:c.area,
   fx:ev(b.id,[{type:'boss_start',name:b.name,hp:1000,maxHp:1000,phases:b.phases.map(p=>({at:p.at,name:p.name})),arena:{x:c.x,z:c.z,radius:b.arena.radius}},
    {type:'boss_telegraph',tiles:tiles(c,b.id==='frostmaw'?'scatter':b.id==='ashen_colossus'?'cross':b.id==='gloom_matriarch'?'around':'line',{radius:b.id==='gloom_matriarch'?2:6,count:10}),ticks:40,color:Object.values(b.attacks).find(a=>a.kind==='telegraph'||a.shape)?.color||0xff6a1a}])})}
  {const c=at('twinflame_wyrm');shots.push({file:'vaelith-flight-breath.png',x:c.x-8,z:c.z,yaw:-Math.PI/2+.4,pitch:.45,zoom:20,area:c.area,
   fx:ev('twinflame_wyrm',[{type:'boss_start',name:'Vaelith, the Twinflame',hp:600,maxHp:1000,phases:bs.bossById.twinflame_wyrm.phases.map(p=>({at:p.at,name:p.name}))},{type:'boss_phase',phase:1,name:'Skyborne'},{type:'boss_flight',up:true},
    {type:'boss_telegraph',tiles:tiles(c,'line',{radius:10}),ticks:40,color:0xff6a1a,breath:'fire'},{type:'boss_breath',element:'fire',color:0xff6a1a}])});
   shots.push({file:'defeat-chest.png',x:c.x-9,z:c.z+5,yaw:-Math.PI/2-.6,pitch:.35,zoom:9,area:c.area,fx:ev('twinflame_wyrm',[{type:'boss_chest',name:'Vaelith, the Twinflame',x:c.x-4.5,z:c.z+1,loot:[{item:'weapon:twinflameGlaive',n:1}],ticks:412},{type:'boss_rare',who:'Tester',itemName:'Twinflame Glaive',bossName:'Vaelith, the Twinflame',kc:37}]),frames:40})}
  shots.push({file:'unique-gear-character.png',x:-229,z:134,yaw:Math.PI,pitch:.12,zoom:4.2,gear:true});
  for(const s of shots){const err=await p.evaluate(async s=>{try{const w=window.visualTest;w.setCamera(s.yaw,s.pitch,s.zoom);w.move(s.x,s.z);await window.eldervaleRegionStreamer.scan();await window.eldervaleRegionStreamer.idle();if(s.area)await window.eldervaleUnderground.prepare(s.area);w.move(s.x,s.z,4);await new Promise(r=>setTimeout(r,300));
   if(s.gear)await window.eldervaleShotGear?.();for(const e of s.fx||[])window.eldervaleBossFx.event(e,'me');w.move(s.x,s.z,s.frames||2)}catch(e){return e.message+' '+e.stack}},s);if(err)console.log('ERROR',s.file,err.slice(0,900));
   await p.screenshot({path:path.join(out,s.file),timeout:180000});console.log('shot',s.file)}
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
