// Offline QA shots for the quest markers and the gate guards (no server, no account): the seeded
// world (db/generated-world.json) with the Birchford capital, Eldervale Castle and the quest-arc
// NPCs (scripts/quest-arcs), a fake quest snapshot, in headless Chromium.
//   node scripts/quest-markers-shots.cjs [outputDir]     (default docs/qa/quests)
// Shots: the raised "!" / "?" over helmeted, tall, short, scaled and seated givers; the minimap
// quest badges; the world map's quest-chain markers (one chain already started, so hidden) with a
// tooltip; and the castle / Birchford gate guards before and after the facing fix (before = the
// live server's facing, yaw 0 for every posted NPC; after = postedYaw / the seeded facing).
// Uses ELDERVALE_CHROMIUM or /opt/pw-browsers/chromium-1243; playwright-core and three from
// node_modules (this checkout or the main checkout above a worktree).
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict');
const root=path.resolve(__dirname,'..'),mods=[path.join(root,'node_modules'),path.resolve(root,'../../../node_modules')].find(d=>fs.existsSync(path.join(d,'three')));
const {chromium}=require(path.join(mods,'playwright-core'));
const manifest=JSON.parse(fs.readFileSync(path.join(root,'db/generated-world.json')));
const output=path.resolve(process.argv[2]||path.join(root,'docs/qa/quests'));fs.mkdirSync(output,{recursive:true});
const V=(fs.readFileSync(path.join(root,'game.js'),'utf8').match(/\?v=([A-Za-z0-9._-]+)/)||[])[1];
const types={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.json':'application/json','.glb':'model/gltf-binary','.mp3':'audio/mpeg','.ogg':'audio/ogg'};
const server=http.createServer((req,res)=>{try{const p=new URL(req.url,'http://local').pathname,file=path.join(root,p==='/'?'index.html':decodeURIComponent(p));if(!file.startsWith(root))throw 0;res.setHeader('content-type',types[path.extname(file)]||'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
(async()=>{
 const {capitalBlueprint}=await import(path.join(root,'capital-layout.js'));
 const {castleBlueprint}=await import(path.join(root,'castle-layout.js'));
 const {ARCS,questRows,entitiesOf}=await import(path.join(root,'scripts/quest-arcs/build.mjs'));
 const capitalRows=capitalBlueprint().map((d,i)=>{const data={...d};if(data.shopItems){data.shop=Object.fromEntries(data.shopItems.map(k=>[k,{buy:10,sell:4,stock:-1}]));delete data.shopItems}return {id:'00000000-0000-4000-8001-'+String(i).padStart(12,'0'),data,revision:1}});
 const castleRows=castleBlueprint().map((d,i)=>({id:'00000000-0000-4000-8002-'+String(i).padStart(12,'0'),data:d,revision:1}));
 const arcRows=ARCS.flatMap(entitiesOf).filter(e=>e.data.kind==='npc'&&Math.abs(e.data.x)<430&&Math.abs(e.data.z)<430).map(e=>({id:e.id,data:e.data,revision:1}));
 const arcQuests=ARCS.flatMap(questRows).map(r=>({id:r.id,data:r.data,accepted:false,completed:false,progress:{}}));
 // This player has begun the Drowned Choir (tide) chain: its start marker must be hidden.
 arcQuests.find(q=>q.data.key==='arc-tide-1').accepted=true;
 const rows=[...manifest.entities.map((data,i)=>({id:'scenery:'+i,data,revision:1})),...capitalRows,...castleRows,...arcRows];
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const exe=process.env.ELDERVALE_CHROMIUM||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome';
 const browser=await chromium.launch({executablePath:exe,args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 const report={shots:[],errors:[]};
 try{
  const p=await browser.newPage({viewport:{width:1280,height:800}});
  p.on('pageerror',e=>{report.errors.push(e.message);console.log('PAGE',e.message)});
  await p.route('**/*',r=>{const url=r.request().url();
   if(url.includes('three@0.160.1/')){const rel=url.split('three@0.160.1/')[1].split('?')[0];return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(mods,'three',rel))})}
   if(!url.startsWith('http://127.0.0.1:'))return r.abort();const name=new URL(url).pathname;
   if(name==='/auth.js')return r.fulfill({contentType:'text/javascript',body:`globalThis.eldervaleWorldConfig=${JSON.stringify(manifest.config)};document.querySelector('#auth-screen').hidden=true;import('./geography.js?v=${V}').then(g=>g.initializeGeography(globalThis.eldervaleWorldConfig)).then(()=>import('./game.js?v=${V}')).then(()=>window.ready=true);`});
   if(name==='/game.js')return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game.js'),'utf8')+'\nwindow.qa={T,scene,camera,renderer,player,landscape,npcs,worldInstances,persistentRows,questUi,mapMarkers,worldMap,postedYaw,composeMinimap,setCamera:(y,p,z)=>{yaw=y;pitch=p;zoom=z},move:(x,z)=>{player.position.set(x,landscape.walkHeight(x,z),z);cameraFocus=null}};'});
   r.continue()});
  await p.addInitScript(()=>{localStorage.setItem('eldervale-save',JSON.stringify({x:-229,z:134,appearance:{shirt:'#746951',skin:'#c9916b'}}))});
  await p.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded',timeout:180000});
  await p.waitForFunction(()=>window.ready,null,{timeout:180000});
  await p.evaluate(async rows=>{const w=window.qa;w.renderer.setPixelRatio(1);w.move(-191,160);await window.eldervaleWorldBridge.apply(rows);await window.eldervaleRegionStreamer?.idle?.()},rows);
  const settle=async(ms=2500)=>{await p.waitForFunction(()=>window.eldervaleWorldLoading!==true,null,{timeout:180000}).catch(()=>{});await p.waitForTimeout(ms)};
  const view=async(s)=>{await p.evaluate(async s=>{const w=window.qa;w.player.rotation.y=s.face??s.yaw-Math.PI;w.setCamera(s.yaw,s.pitch,s.zoom);w.move(s.x,s.z);await window.eldervaleRegionStreamer?.scan?.();await window.eldervaleRegionStreamer?.idle?.();
   for(const {root}of w.worldInstances.values())if(root?.userData.leftGate){root.userData.gateOpen=true;root.userData.leftGate.rotation.y=-Math.PI*.48;root.userData.rightGate.rotation.y=Math.PI*.48}},s);await settle()};
  const shot=async(name,opts={})=>{await p.screenshot({path:path.join(output,name),animations:'disabled',timeout:120000,...opts});report.shots.push(name);console.log('captured',name)};

  // ---- 1. Overhead markers. Seven castle residents stand in a row in the Eldervale Castle
  // courtyard (open ground before the Crown Fountain) as quest givers: plain, tall (x1.35), short
  // (x0.8, a '?'), seated as on a horse (body raised 0.95), steel helm, horned knight helm, hood.
  await view({x:-340,z:-285,yaw:0,pitch:.06,zoom:9,face:Math.PI});
  const givers=await p.evaluate(async({arcQuests})=>{const w=window.qa,T=w.T;
   const folk=w.npcs.filter(n=>!n.deleted&&n.rig?.faceMeshes&&!n.root.userData.armed&&Math.hypot(n.root.position.x+340,n.root.position.z+305)<55).slice(0,7);
   if(folk.length<7)throw Error('townsfolk missing: '+folk.length);
   const looks=[{},{scale:1.35},{scale:.8,ready:true},{seated:true},{wear:'helm'},{wear:'knightHornedHelm2'},{wear:'rangerHood1'}];
   folk.forEach((n,i)=>{const o=looks[i],x=-347.5+i*2.5,z=-293;n.home.set(x,0,z);n.goal.set(x,0,z);n.profile.behavior='stationary';n.root.position.set(x,w.landscape.walkHeight(x,z),z);n.root.rotation.y=0;
    if(o.scale)n.root.scale.setScalar(o.scale);if(o.seated){n.rig.model.position.y+=.95;n.seated=true}if(o.wear)n.rig.setCoverage({[o.wear]:true});n.qaLook=o.wear||(o.scale?'scale '+o.scale:o.seated?'seated':'plain')});
   await new Promise(r=>setTimeout(r,2500));// helm parts stream in
   const quest=(n,i,ready)=>({id:'qa-'+i,data:{key:'qa-'+i,name:'QA errand '+(i+1),giver:n.realmId,objectives:[{type:'kill',target:'rat',amount:1}]},accepted:!!ready,completed:false,progress:ready?{0:1}:{}});
   const rows=[...folk.map((n,i)=>quest(n,i,looks[i].ready)),...arcQuests];
   w.questUi().sync(rows);window.qaQuestRows=rows;window.qaFolk=folk;
   return folk.map(n=>({id:n.realmId,name:n.profile.name,look:n.qaLook,worn:n.rig.parts?.helm?.key||null}))},{arcQuests});
  console.log('givers',JSON.stringify(givers));
  const lineup=async(name,s)=>{await view(s);await p.evaluate(()=>{window.qa.player.visible=false;for(const n of window.qaFolk){n.root.rotation.y=0}});await p.waitForTimeout(3500);await shot(name)};
  await lineup('overhead-markers-lineup.png',{x:-340,z:-285,yaw:0,pitch:.06,zoom:9,face:Math.PI});
  // Measured clearances: glyph foot above the measured head top for every shown marker.
  const heads=await p.evaluate(async()=>{const w=window.qa,{measureHeadTop}=await import('/quest-markers.js');
   return w.questUi().markers.shown.filter(s=>window.qaFolk.some(n=>n.realmId===s.id)).map(s=>{const a=window.qaFolk.find(n=>n.realmId===s.id);const top=measureHeadTop(w.T,a);return {name:a.profile.name,look:a.qaLook,kind:s.kind,headTop:+(top-a.root.position.y).toFixed(2),foot:+(s.y-a.root.position.y).toFixed(2),clearance:+(s.y-top).toFixed(2)}})});
  console.log('heads',JSON.stringify(heads));report.heads=heads;
  assert.equal(heads.length,7,'every giver in the row has its marker');for(const h of heads)assert.ok(h.clearance>=.2,'marker clears the head of '+h.name);
  await lineup('overhead-markers-close-left.png',{x:-344.5,z:-288,yaw:0,pitch:.03,zoom:5,face:Math.PI});
  await lineup('overhead-markers-close-right.png',{x:-335.5,z:-288,yaw:0,pitch:.03,zoom:5,face:Math.PI});

  // ---- 2. Minimap quest badges ('!' and '?') beside the row, plus a 3x enlargement of the canvas.
  await view({x:-340,z:-285,yaw:0,pitch:.3,zoom:14,face:Math.PI});await p.evaluate(()=>{window.qa.player.visible=true;window.qa.composeMinimap(true)});await p.waitForTimeout(800);
  const mm=await p.locator('#minimap').boundingBox();await shot('minimap-quest-icons.png',{clip:{x:Math.max(0,mm.x-30),y:Math.max(0,mm.y-30),width:mm.width+60,height:mm.height+60}});
  const data=await p.evaluate(()=>document.querySelector('#minimap').toDataURL('image/png'));
  {const z=await browser.newPage({viewport:{width:600,height:600}});await z.setContent(`<body style="margin:0;background:#1b2018;display:grid;place-items:center;height:100vh"><img src="${data}" style="width:540px;height:540px;border-radius:50%;image-rendering:auto"></body>`);await z.waitForTimeout(300);
   await z.screenshot({path:path.join(output,'minimap-quest-icons-zoomed.png')});report.shots.push('minimap-quest-icons-zoomed.png');console.log('captured minimap-quest-icons-zoomed.png');await z.close()}

  // ---- 3. World map: chain-start quest markers (tide chain started: hidden), tooltip.
  const chain=await p.evaluate(()=>{const w=window.qa;w.mapMarkers.refresh();return {givers:w.questUi().markers.chainGivers(),items:w.mapMarkers.items().filter(c=>c.cat==='quest').map(c=>({id:c.id,name:c.name,giver:c.giverName,x:Math.round(c.x),z:Math.round(c.z)})),base:w.mapMarkers.base().filter(c=>c.cat==='quest').length}});
  console.log('chain',JSON.stringify(chain));report.chain=chain;
  assert.equal(chain.items.length,3,'three chain starts shown (tide started)');assert.equal(chain.base,4,'four chain starts in the owner list');
  await p.evaluate(()=>document.querySelector('#map-toggle').click());await p.waitForTimeout(3500);
  await shot('world-map-quest-chains.png');
  const drawnQuest=await p.evaluate(()=>window.qa.worldMap.drawnMarkers.filter(d=>d.cat==='quest'));report.worldMapQuestMarkers=drawnQuest;console.log('drawn',JSON.stringify(drawnQuest));
  assert.equal(drawnQuest.length,3,'three quest markers drawn on the world map');
  // Zoom in on one marker and tap it for its tooltip.
  const t=chain.items[0];await p.evaluate(t=>{const m=window.qa.worldMap,v=m.view;m.setView({...v,x:t.x,z:t.z,scale:v.scale*3})},t);await p.waitForTimeout(1200);
  const d=await p.evaluate(()=>{const c=document.querySelector('#worldmap');const r=c.getBoundingClientRect();const q=window.qa.worldMap.drawnMarkers.find(d=>d.cat==='quest');return q?{x:r.x+q.x,y:r.y+q.y,label:q.label}:null});
  if(d){await p.mouse.move(d.x,d.y);await p.mouse.down();await p.waitForTimeout(80);await p.mouse.up();await p.waitForTimeout(700);report.tooltip=await p.evaluate(()=>{const i=document.querySelector('.wm-info');return i&&!i.hidden?i.textContent:null});report.tooltipLabel=d.label;console.log('tooltip',report.tooltip,'| label',d.label);assert.match(d.label,/^Quest: /,'the marker names the quest')}
  await shot('world-map-quest-tooltip.png');
  await p.evaluate(()=>document.querySelector('#map-close').click());

  // ---- 4. Gate guards: before (server yaw 0) and after (postedYaw = the data facing / seeded actor yaw).
  const setGuards=(mode)=>p.evaluate(mode=>{const w=window.qa;const out=[];w.player.visible=false;
   // Passers-by between the camera and the gate step out of the shot.
   for(const n of w.npcs)if(!/Gate Warden|gatekeeper/i.test(n.profile.name)&&Math.hypot(n.root.position.x-w.player.position.x,n.root.position.z-w.player.position.z)<9)n.deleted=true;for(const n of w.npcs)if(/Gate Warden|gatekeeper/i.test(n.profile.name)){n.root.rotation.y=mode==='before'?0:w.postedYaw(n.profile,0,false);out.push({name:n.profile.name,x:+n.root.position.x.toFixed(1),z:+n.root.position.z.toFixed(1),yawDeg:Math.round(n.root.rotation.y*180/Math.PI)})}return out},mode);
  // Clear the givers' quests so the gate shots show only the guards.
  await p.evaluate(()=>{window.qa.questUi().sync([]);for(const n of window.qaFolk)n.deleted=true});
  for(const mode of ['before','after']){
   report['guards_'+mode]=await setGuards(mode);
   await view({x:-340,z:-229,yaw:0,pitch:.12,zoom:9,face:Math.PI});await setGuards(mode);await p.waitForTimeout(1500);await shot('castle-gate-guards-'+mode+'.png');
   await view({x:-160,z:134.9,yaw:Math.PI/2,pitch:.12,zoom:8,face:-Math.PI/2});await setGuards(mode);await p.waitForTimeout(1500);await shot('birchford-ember-gate-'+mode+'.png');
   await view({x:-244.8,z:71,yaw:Math.PI,pitch:.12,zoom:8,face:0});await setGuards(mode);await p.waitForTimeout(1500);await shot('birchford-north-gate-'+mode+'.png');
  }
  fs.writeFileSync(path.join(output,'checks.json'),JSON.stringify(report,null,1));
  if(report.errors.length)process.exitCode=1;
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
