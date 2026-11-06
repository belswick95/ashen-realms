// Visual smoke of quest system v2 in Chromium (no server): breadcrumb trail + minimap guidance,
// the OSRS-style stage journal with lamps/teleports, the Game console v2 editor with the simulator,
// and the NPC conversation choice flow. Usage: node scripts/quest-v2-smoke.cjs [screenshot-dir]
// Needs playwright-core and a Chrome (CHROME=/path, default /usr/bin/google-chrome) and three
// (THREE=/path/to/three.module.js, default node_modules/three/build/three.module.js).
const fs=require('fs'),http=require('http'),path=require('path'),assert=require('assert/strict'),{chromium}=require('playwright-core'),root=path.resolve(__dirname,'..');
const out=process.argv[2]||null,three=process.env.THREE||[path.join(root,'node_modules/three/build/three.module.js'),path.join(root,'../../../node_modules/three/build/three.module.js')].find(f=>fs.existsSync(f));
const server=http.createServer((q,s)=>{try{const n=new URL(q.url,'http://local').pathname;s.setHeader('content-type',n.endsWith('.js')||n.endsWith('.mjs')?'text/javascript':n.endsWith('.css')?'text/css':n.endsWith('.json')?'application/json':'text/html');s.end(fs.readFileSync(path.join(root,n)))}catch{s.writeHead(404).end()}});
const V=(fs.readFileSync(path.join(root,'game.js'),'utf8').match(/\?v=([A-Za-z0-9._-]+)/)||[])[1];
const sampleSql=fs.readFileSync(path.join(root,'db/quests-v2-sample.sql'),'utf8');
const ids={maud:'96d6414a-90ce-4080-8515-adc6b4db298b',corin:'8e1013ae-c555-4aff-a4ba-8425fb7a290a',jory:'d1b26173-cd94-4a4f-be5f-7a4d4afa7ad8'};
const sample=JSON.parse(sampleSql.slice(sampleSql.indexOf('$quest$')+7,sampleSql.lastIndexOf('$quest$')).replaceAll('@maud',ids.maud).replaceAll('@corin',ids.corin).replaceAll('@jory',ids.jory));
const shot=async(p,name,opts={})=>{if(out){fs.mkdirSync(out,{recursive:true});await p.screenshot({path:path.join(out,name),...opts})}};
const IMPORTMAP='<script type="importmap">{"imports":{"three":"https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js","three/addons/":"https://cdn.jsdelivr.net/npm/three@0.160.1/examples/jsm/"}}</script>';
const page=(body)=>`<!doctype html><html><head><meta charset="utf-8">${IMPORTMAP}<link rel="stylesheet" href="/quests.css"><link rel="stylesheet" href="/admin.css"><style>body{margin:0;background:#0d1418;color:#eee;font:14px system-ui}</style></head><body>${body}</body></html>`;
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const b=await chromium.launch({executablePath:process.env.CHROME||'/usr/bin/google-chrome',args:['--no-sandbox','--use-gl=swiftshader','--enable-unsafe-swiftshader']});
 try{
  const p=await b.newPage({viewport:{width:1100,height:720}}),errors=[];p.on('pageerror',e=>{errors.push(e.message);console.error('pageerror',e.message)});p.on('console',m=>{if(m.type()==='error')console.error('console',m.text())});
  await p.route('https://cdn.jsdelivr.net/npm/three@0.160.1/**',r=>{const rel=new URL(r.request().url()).pathname.replace('/npm/three@0.160.1/','');r.fulfill({contentType:'text/javascript',body:fs.readFileSync(path.join(path.dirname(three),'..',rel),'utf8')})});
  await p.route('**/sample.json',r=>r.fulfill({contentType:'application/json',body:JSON.stringify({sample,ids})}));

  // 1. Breadcrumb trail around a wall to a door, minimap path + objective and edge arrow.
  await p.route('**/trail',r=>r.fulfill({contentType:'text/html',body:page(`<canvas id="c" width="1100" height="720"></canvas><canvas id="m" width="200" height="200" style="position:fixed;right:16px;top:16px;border-radius:50%;border:3px solid #5a4a2a"></canvas><canvas id="m2" width="200" height="200" style="position:fixed;right:16px;top:232px;border-radius:50%;border:3px solid #5a4a2a"></canvas>
<script type="module">import * as T from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';import {createQuestTrail,TRAIL} from '/quest-trail.js';import {TILE,FLAG,tileOf} from '/tile-grid.js';
const renderer=new T.WebGLRenderer({canvas:document.querySelector('#c'),antialias:true});renderer.setSize(1100,720,false);const scene=new T.Scene();scene.background=new T.Color(0x9cc3d6);
const cam=new T.PerspectiveCamera(50,1100/720,.1,500);cam.position.set(-7,13,15);cam.lookAt(5,0,-2);scene.add(new T.HemisphereLight(0xffffff,0x557744,1.6));const sun=new T.DirectionalLight(0xffffff,1.4);sun.position.set(5,10,4);scene.add(sun);
const ground=new T.Mesh(new T.PlaneGeometry(120,120),new T.MeshLambertMaterial({color:0x5f8f3e}));ground.rotation.x=-Math.PI/2;scene.add(ground);
const wallMat=new T.MeshLambertMaterial({color:0xb0a690}),blocked=new Set();
for(let j=-6;j<=4;j++){if(j===0)continue;const w=new T.Mesh(new T.BoxGeometry(TILE,2.4,TILE),wallMat);w.position.set(4*TILE,1.2,j*TILE);scene.add(w);blocked.add('4,'+j)}
const door=new T.Mesh(new T.BoxGeometry(.2,2.2,TILE*.9),new T.MeshLambertMaterial({color:0x6b4423}));door.position.set(4*TILE,1.1,-TILE*.45+.6);door.rotation.y=1.2;scene.add(door);
const npc=new T.Mesh(new T.CapsuleGeometry(.35,1.1,4,8),new T.MeshLambertMaterial({color:0x3b5fa8}));npc.position.set(10*TILE,.9,-3*TILE);scene.add(npc);
const me=new T.Mesh(new T.CapsuleGeometry(.35,1.1,4,8),new T.MeshLambertMaterial({color:0xc0563a}));me.position.set(-2*TILE,.9,2*TILE);scene.add(me);
const tiles=[...blocked].map(k=>{const [i,j]=k.split(',').map(Number);return [i,j,FLAG.BLOCK,0]});tiles.push([4,0,0,FLAG.E]);
const trail=createQuestTrail(T,scene,{player:()=>me.position,locate:id=>id==='npc'?npc.position:null,fetchTiles:async()=>({center:[0,0],radius:40,tiles})});
trail.setStep({step:{state:'active',label:'Talk to Sister Maud',target:'npc'}});
const now=performance.now();for(let k=0;k<5;k++)trail.frame(now+k*400);await new Promise(r=>setTimeout(r,50));for(let k=0;k<40;k++)trail.frame(now+2400+k*16);
renderer.render(scene,cam);
const mini=(id,extent)=>{const c=document.querySelector(id).getContext('2d'),S=200,cx=100;c.fillStyle='#415d39';c.fillRect(0,0,S,S);const project=(x,z)=>({x:cx+(x-me.position.x)*S/extent,y:cx+(z-me.position.z)*S/extent});
 c.fillStyle='#8f8a7a';for(const [i,j] of tiles.filter(t=>t[2]&FLAG.BLOCK)){const q=project(i*TILE,j*TILE);c.fillRect(q.x-2,q.y-2,4,4)}trail.drawMinimap(c,project,cx,cx);c.fillStyle='#fff';c.fillRect(cx-2,cx-2,4,4)};
mini('#m',60);mini('#m2',10);
window.trailInfo={path:trail.path.length,dots:trail.mesh.count,hint:trail.hint,through:trail.path.some(([x,z])=>blocked.has(tileOf(x)+','+tileOf(z)))};window.ready=true;</script>`)}));
  await p.goto(base+'/trail');await p.waitForFunction(()=>window.ready,null,{timeout:20000});
  const info=await p.evaluate(()=>window.trailInfo);assert.ok(info.path>8&&info.dots>8,'trail laid: '+JSON.stringify(info));assert.equal(info.through,false,'trail never crosses a wall');assert.equal(info.hint?.kind,'door','door hint on the way');
  await shot(p,'trail-and-minimap.png');

  // 2. Journal: stages struck through, requirement ticks, lamp + teleport claims; lamp chooser.
  await p.route('**/journal',r=>r.fulfill({contentType:'text/html',body:page(`<script type="module">import {registerCatalogOverrides} from '/economy.js?v=${V}';registerCatalogOverrides({'item:custom_morning_bell_charm':{name:'Morning Bell charm',icon:'gem',custom:true,ownerEdited:true}});import {createQuestJournal} from '/quests.js';const {sample,ids}=await (await fetch('/sample.json')).json();
window.eldervaleQuestState={qp:9,lamps:[{key:'q1:0',quest:'q1',questName:sample.name,perLevel:10,minLevel:5,label:"Bellwarden's lamp"}],unlocks:{'teleport.morning-bell':{type:'teleport',label:'Morning Bell teleport (temple steps, Birchford)',x:-185,z:129.5}}};
window.eldervaleQuestContext=()=>({skillLevel:s=>({crafting:14,cooking:9,attack:22})[s]||3,qp:9});
const j=createQuestJournal({leather:0});const tut={id:'t',data:{key:'tutorial-graduation',name:'Graduation',chain:'tutorial',order:8},accepted:true,completed:true,progress:{}};
j.sync([tut,{id:'q1',data:sample,accepted:true,completed:false,progress:{_stage:'new-strap',_done:['lamplighter','errand-boy'],_flags:{kept_secret:true}}}]);
document.querySelector('#quest-journal-toggle').click();window.ready=true;</script>`)}));
  await p.goto(base+'/journal');await p.waitForFunction(()=>window.ready);await p.setViewportSize({width:760,height:820});
  assert.match(await p.locator('#quest-journal').textContent(),/Rewards to claim.*Quest teleports/s);
  await p.getByRole('button',{name:'A Bell Out of Tune, In progress'}).click();
  const struck=await p.locator('.quest-stages s').count();assert.equal(struck,2,'two finished stages struck through');
  assert.match(await p.locator('.quest-stages .current').textContent(),/leather/);
  await shot(p,'journal-stages.png');
  await p.getByRole('button',{name:/Rub Bellwarden/}).click();await p.waitForSelector('.quest-lamp-dialog');
  assert.equal(await p.locator('.quest-lamp-skill:not([disabled])').count()>0,true);assert.match(await p.locator('.quest-lamp-dialog').textContent(),/Crafting.*\+140 XP/s);
  await shot(p,'journal-lamp-chooser.png');

  // 3. Game console: v2 editor on the sample quest + simulator run through a choice.
  await p.route('**/console',r=>r.fulfill({contentType:'text/html',body:page(`<dialog id="owner-studio" open style="position:static;width:100%;max-width:none;height:auto;max-height:none"><div class="studio-workspace"></div><footer></footer></dialog><script type="module">import {registerCatalogOverrides} from '/economy.js?v=${V}';registerCatalogOverrides({'item:custom_morning_bell_charm':{name:'Morning Bell charm',icon:'gem',custom:true,ownerEdited:true}});import {createFullControlTabs} from '/admin-full.js';const {sample,ids}=await (await fetch('/sample.json')).json();
const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!=null)n.textContent=text;for(const [k,v] of Object.entries(attrs))n.setAttribute(k,v);return n};const workspace=document.querySelector('.studio-workspace'),status=document.querySelector('footer');
const note=(t,e)=>{status.textContent=t;status.classList.toggle('error',!!e)};const run=fn=>void Promise.resolve().then(fn).catch(e=>note(e.message,true));
const btn=(label,fn,parent=workspace)=>{const b=el('button',label,{type:'button'});b.onclick=()=>run(fn);parent.append(b);return b};
const field=(parent,label,key,value,type='text',options=null)=>{const wrap=el('label',label);let input;if(options){input=el('select',null,{name:key});for(const [v,t] of options)input.append(el('option',t,{value:v}));input.value=value}else{input=el(type==='textarea'?'textarea':'input',null,{name:key});if(type!=='textarea')input.type=type;if(type==='checkbox')input.checked=!!value;else input.value=value??''}wrap.append(input);parent.append(wrap);return input};
window.saved=[];const actors=[[ids.maud,'Sister Maud'],[ids.corin,'Corin the Lamplighter'],[ids.jory,'Jory the Errand Boy']].map(([id,name])=>({id,data:{kind:'npc',name}}));
const rows=[{id:'q1',version:1,data:sample},{id:'t',version:1,data:{name:'Graduation',key:'tutorial-graduation',chain:'tutorial',giver:ids.maud,objectives:[{type:'talk',target:ids.maud,amount:1}]}}];
const ctx={el,btn,field,note,workspace,tab:()=>'Quests',bridge:{position:()=>({x:-185,z:124})},rpc:async(name,a)=>name==='world_admin'?rows:{actors},invoke:async(c,pl)=>{saved.push({c,pl});if(c==='qv2_player_search')return [{userId:'u1',name:'Tamsin'}];if(c==='qv2_player_state')return {state:{qp:9,unlocks:{},lamps:[]},quests:[{id:'q1',name:sample.name,staged:true,stages:sample.stages.map(s=>s.id),accepted:true,completed:false,progress:{_stage:'errand-boy',_flags:{}},missing:[]}]};return {id:pl.id||'q1',version:2,data:pl.data}}};
createFullControlTabs(ctx).Quests();setTimeout(()=>{workspace.querySelector('.console-row')?.click();window.ready=true},300);</script>`)}));
  await p.setViewportSize({width:1280,height:900});await p.goto(base+'/console');await p.waitForFunction(()=>window.ready);
  await p.waitForSelector('.console-stage');assert.equal(await p.locator('.console-stage').count(),3,'three stage cards');
  await p.getByRole('button',{name:'▶ Simulate'}).click();await p.waitForSelector('.console-simulator:not([hidden])');
  for(const name of ['Accept quest',/Finish: Ask Corin/,/Finish: Find Jory/,/Choose: Sister Maud deserves/])await p.locator('.console-simulator').getByRole('button',{name}).click();
  assert.match(await p.locator('.console-simulator').textContent(),/told_truth/);assert.match(await p.locator('.console-simulator').textContent(),/Cutscene: The worn strap/);
  await p.locator('.console-simulator').scrollIntoViewIfNeeded();await shot(p,'console-simulator.png');
  await p.locator('.console-stage').first().scrollIntoViewIfNeeded();await shot(p,'console-stage-editor.png');
  await p.getByRole('button',{name:'Save quest'}).click();await p.waitForFunction(()=>saved.some(s=>s.c==='fc_quest_save'));
  const savedQuest=await p.evaluate(()=>saved.find(s=>s.c==='fc_quest_save').pl.data);assert.equal(savedQuest.stages.length,3);assert.deepEqual(savedQuest.objectives,[]);assert.equal(savedQuest.lamps[0].perLevel,10);assert.equal(savedQuest.requirements.qp,5);
  await p.locator('summary',{hasText:'Player quest state'}).click();await p.getByRole('button',{name:'Search'}).click();await p.getByRole('button',{name:'Tamsin'}).click();await p.waitForSelector('text=stage errand-boy');
  await p.locator('summary',{hasText:'Player quest state'}).scrollIntoViewIfNeeded();await shot(p,'console-player-inspector.png');
  assert.deepEqual(errors,[]);
  console.log('PASS quest v2: trail ('+info.dots+' dots, door hint), minimap guidance, stage journal + lamp chooser, console editor/simulator/save/player inspector');
 }finally{await b.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
