// Offline render of the castle training grounds: King's throne room, training yard, copse, pond,
// ore rocks, closed Great Gate for a trainee, objective HUD, tutor dialogue and the cutscene letterbox.
// Usage: node scripts/castle-tutorial-smoke.cjs [outputDir]   (ELDERVALE_CHROMIUM=/path/to/chrome)
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright-core'),root=path.resolve(__dirname,'..'),manifest=JSON.parse(fs.readFileSync(path.join(root,'db/generated-world.json')));
const output=path.resolve(process.argv[2]||path.join(root,'test-results/castle-tutorial'));fs.mkdirSync(output,{recursive:true});
const V='release-20261106-terrain111';
const server=http.createServer((req,res)=>{try{const file=path.join(root,new URL(req.url,'http://local').pathname==='/'?'index.html':new URL(req.url,'http://local').pathname);res.setHeader('content-type',file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':file.endsWith('.webp')?'image/webp':file.endsWith('.json')?'application/json':'text/html');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
const chrome=process.env.ELDERVALE_CHROMIUM||['/usr/bin/chromium','/usr/bin/google-chrome'].find(f=>fs.existsSync(f));
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({...(chrome?{executablePath:chrome}:{}),args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{const p=await browser.newPage({viewport:{width:1100,height:700}}),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.log('PAGE',e.message)});
  await p.route('**/*',r=>{const url=r.request().url();
   if(url.includes('three@0.160.1/examples/jsm/'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/three/examples/jsm',url.split('three@0.160.1/examples/jsm/')[1].split('?')[0]))});
   if(url.includes('three@0.160.1/build/three.module.js'))return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'node_modules/three/build/three.module.js'))});
   if(!url.startsWith('http://127.0.0.1:'))return r.abort();const name=new URL(url).pathname;
   if(name==='/auth.js')return r.fulfill({contentType:'text/javascript',body:`globalThis.eldervaleWorldConfig=${JSON.stringify(manifest.config)};document.querySelector('#auth-screen').hidden=true;import('./geography.js?v=${V}').then(g=>g.initializeGeography(globalThis.eldervaleWorldConfig)).then(()=>import('./game.js?v=${V}')).then(()=>window.ready=true);`});
   if(name==='/game.js')return r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(root,'game.js'),'utf8').replace('function frame(){requestAnimationFrame(frame);','function frame(){if(window.pauseFrames)return;requestAnimationFrame(frame);')+'\nwindow.visualTest={T,scene,camera,renderer,player,landscape,worldInstances,applyRealmObject,realmActor,persistentRows,say,state,quantity,updateNaturalForest,forestBatches,naturalSky,skyLight,sun,frame,render:()=>{naturalSky.update(camera,60000,12,1);skyLight.intensity=1.6;sun.intensity=2;renderer.render(scene,camera)}};'});
   r.continue()});
  await p.addInitScript(()=>{window.pauseFrames=true;localStorage.setItem('eldervale-save',JSON.stringify({x:-340,z:-290,equippedWeapon:'bronzeSword',weaponsOwned:['bronzeSword'],appearance:{shirt:'#746951',skin:'#c9916b'}}))});
  await p.goto('http://127.0.0.1:'+server.address().port,{waitUntil:'domcontentloaded',timeout:120000});await p.waitForFunction(()=>window.ready,null,{timeout:180000});console.log('renderer ready');
  const setup=await p.evaluate(async({entities,V})=>{
   const w=window.visualTest,{castleBlueprint}=await import('./castle-layout.js?v='+V),{tutorialEntities,tutorialId,tutorialQuestRows}=await import('./tutorial-data.js?v='+V),{createTutorial}=await import('./tutorial.js?v='+V);
   const castle=castleBlueprint().map(d=>({id:'castle:'+d.blueprintKey,data:d,revision:1}));
   const extra=[{id:'castle:furnace',data:{kind:'object',template:'furnace',name:'Royal smelting furnace',x:-314.6,z:-283.4,yaw:0,scale:1,level:1,hp:1,damage:0,attackSpeed:2.4,roam:0,respawn:0,attackable:false,hostile:false},revision:1},{id:'castle:anvil',data:{kind:'object',template:'anvil',name:'Royal smithing anvil',x:-310,z:-281,yaw:0,scale:1,level:1,hp:1,damage:0,attackSpeed:2.4,roam:0,respawn:0,attackable:false,hostile:false},revision:1}];
   const training=Object.entries(tutorialEntities).map(([k,d])=>({id:tutorialId(k),data:{...d,blueprint:'castle-tutorial-v1',blueprintKey:k},revision:1}));
   await window.eldervaleWorldBridge.apply([...entities.map((data,i)=>({id:'world:'+i,data,revision:1})),...castle,...extra,...training]);await window.eldervaleRegionStreamer.idle();
   w.renderer.setPixelRatio(1);
   const resolve=t=>JSON.parse(JSON.stringify(t).replace(/"@castle:(\d+)"/g,'"castle:$1"').replace(/"@tutorial:(\d+)"/g,(m,k)=>'"'+tutorialId(k)+'"'));
   const quests=tutorialQuestRows().map(q=>({id:q.id,data:resolve(q.data),accepted:false,completed:false,progress:{}}));
   const commands=[];window.commands=commands;
   const tutorial=createTutorial({T:w.T,scene:w.scene,heightAt:(x,z)=>w.landscape.walkHeight(x,z),playerPosition:()=>w.player.position,say:w.say,command:async(n,pl)=>{commands.push([n,pl]);return true},lastError:()=>'',carried:i=>w.quantity(w.state,i),
    locate:id=>{const a=w.realmActor(id),r=a?.root||w.worldInstances.get(id)?.root;if(r)return {x:r.position.x,y:r.position.y,z:r.position.z,name:a?.profile?.name||a?.name};const d=w.persistentRows.get(id)?.data;return d?{x:d.x,y:w.landscape.walkHeight(d.x,d.z),z:d.z,name:d.name}:null},
    refreshGates:()=>w.applyRealmObject({id:'castle:19',open:true})});
   window.eldervaleTutorial=tutorial;window.tutorialQuests=quests;
   tutorial.sync({tutorial:{active:true,cutscenes:['arrival']},quests,self:{character_name:'Ashwyn'}});
   w.applyRealmObject({id:'castle:19',open:true});
   const gate=w.worldInstances.get('castle:19')?.root.userData;
   return {gateOpen:gate?.gateOpen,loaded:w.worldInstances.size,dummies:[...w.worldInstances.keys()].filter(k=>k.startsWith('c7a5e000')).length};
  },{entities:manifest.entities,V});
  console.log(JSON.stringify(setup));assert.equal(setup.gateOpen,false,'Great Gate shows closed for a trainee');assert.ok(setup.dummies>=15,'tutorial rows loaded');
  const shots=[
   {file:'01-castle-overview.png',player:[-340,-290],eye:[-300,70,-215],look:[-345,0,-305]},
   {file:'02-throne-room-king.png',player:[-340,-328.5],eye:[-343.6,3.1,-324.6],look:[-340,1.8,-332.5],hideRoof:true,cut:2.9},
   {file:'03-training-yard.png',player:[-368,-270],eye:[-360,7,-258],look:[-377,1,-266]},
   {file:'04-copse-and-forester.png',player:[-380,-292],eye:[-370,8,-288],look:[-383,1.5,-298]},
   {file:'05-pond-and-nettie.png',player:[-366,-338],eye:[-360,7,-335],look:[-371,.5,-343]},
   {file:'06-ore-rocks-smithy.png',player:[-302,-298],eye:[-292.5,7,-290],look:[-303,1,-298]},
   {file:'07-great-gate-closed.png',player:[-340,-266],eye:[-340,6,-276],look:[-340,3,-256]},
  ];
  if(process.env.ELDERVALE_SHOTS){shots.splice(0,shots.length,...JSON.parse(process.env.ELDERVALE_SHOTS))}
  for(const s of shots){
   await p.evaluate(async s=>{const w=window.visualTest;w.player.position.set(s.player[0],w.landscape.walkHeight(s.player[0],s.player[1]),s.player[1]);await window.eldervaleRegionStreamer.scan();await window.eldervaleRegionStreamer.idle();w.updateNaturalForest(w.forestBatches,w.player.position);
    w.camera.position.fromArray(s.eye);w.camera.lookAt(...s.look);w.camera.updateMatrixWorld();
    const hidden=[];if(s.hideRoof){const cut=s.cut??4.2;const keep=w.worldInstances.get('castle:24');keep?.root.traverse(o=>{if(o.isMesh&&o.getWorldPosition(new w.T.Vector3()).y>w.player.position.y+cut&&o.visible){o.visible=false;hidden.push(o)}})}
    window.eldervaleTutorial.frame(w.camera);w.render();window.restore=()=>hidden.forEach(o=>o.visible=true);},s);
   await p.screenshot({path:path.join(output,s.file)});await p.evaluate(()=>window.restore?.());console.log('saved',s.file);
  }
  if(process.env.ELDERVALE_SHOTS)return;
  // HUD mid-quest, tutor dialogue, gate message, cutscene letterbox.
  await p.evaluate(()=>{const q=window.tutorialQuests;q[0].accepted=true;q[0].progress={0:1,1:1,2:8};window.eldervaleTutorial.sync({tutorial:{active:true,cutscenes:['arrival']},quests:q});const w=window.visualTest;w.player.position.set(-366,w.landscape.walkHeight(-366,-270),-270);w.camera.position.set(-358,6,-258);w.camera.lookAt(-376,1,-266);w.camera.updateMatrixWorld();window.eldervaleTutorial.frame(w.camera);w.render()});
  await p.screenshot({path:path.join(output,'08-hud-arrow-slash-objective.png')});
  const blocked=await p.evaluate(()=>{const w=window.visualTest;w.player.position.set(-340,0,-262);return window.eldervaleTutorial.blockWalk({x:-340,z:-240})});assert.equal(blocked,true,'walking out is refused client-side');
  await p.evaluate(()=>{const q=window.tutorialQuests;q[0].completed=true;window.eldervaleTutorial.sync({tutorial:{active:true,cutscenes:['arrival']},quests:q});window.eldervaleTutorial.talk(q[1].data.giver,{name:'Forester Wynn'});const w=window.visualTest;w.player.position.set(-380,w.landscape.walkHeight(-380,-293),-293);w.camera.position.set(-372,5,-286);w.camera.lookAt(-382,1.6,-297);w.camera.updateMatrixWorld();window.eldervaleTutorial.frame(w.camera);w.render()});
  await p.screenshot({path:path.join(output,'09-tutor-dialogue.png')});
  for(let i=0;i<3;i++)await p.click('.tutorial-continue');await p.waitForFunction(()=>window.commands.some(c=>c[0]==='quest_accept'),null,{timeout:5000});
  // Cutscene: start the real engine and capture the opening caption.
  await p.evaluate(()=>{window.eldervaleTutorial.sync({tutorial:{active:true,cutscenes:[]},quests:window.tutorialQuests});});
  await p.waitForFunction(()=>window.eldervaleCutscene.active,null,{timeout:5000});await p.waitForTimeout(2200);
  await p.evaluate(()=>{const w=window.visualTest;window.eldervaleTutorial.frame(w.camera);w.render()});await p.screenshot({path:path.join(output,'10-cutscene-arrival.png')});
  await p.click('.tutorial-skip');await p.waitForFunction(()=>window.commands.some(c=>c[0]==='tutorial_cutscene'),null,{timeout:8000});
  const finished=await p.evaluate(()=>{const q=window.tutorialQuests;q.forEach(x=>{x.accepted=x.completed=true});window.eldervaleTutorial.sync({tutorial:{active:false,done:true,cutscenes:['arrival']},quests:[]});return window.visualTest.worldInstances.get('castle:19').root.userData.gateOpen});
  assert.equal(finished,true,'gate opens once training is complete');
  assert.deepEqual(errors,[]);console.log('commands',JSON.stringify(await p.evaluate(()=>window.commands)));console.log('screenshots in',output);
 }finally{await browser.close();server.close()}})().catch(e=>{console.error(e);server.close();process.exitCode=1});
