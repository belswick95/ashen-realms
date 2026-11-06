// Offline renders of the monster roster: a montage of every new type (real world-models.js
// models, mid-animation) and a map of the spawn groups over the generated world.
// usage: ELDERVALE_CHROMIUM=/path/to/chrome OUT=dir node scripts/monster-roster-smoke.cjs
const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..'),out=path.resolve(process.env.OUT||path.join(root,'test-results/monsters'));fs.mkdirSync(out,{recursive:true});
const types={'.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.webp':'image/webp','.png':'image/png','.html':'text/html'};
const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://local').pathname;try{res.setHeader('Content-Type',types[path.extname(name)]||'application/octet-stream');res.end(fs.readFileSync(path.join(root,name)))}catch{res.writeHead(404).end()}});
const V='?v=release-20261106-carry118';
const page=`<!doctype html><meta charset="utf-8"><body style="margin:0;background:#1b2119"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as T from 'three';
import {actorModel} from '/world-models.js${V}';
import {bestiaryEntity} from '/bestiary.js${V}';
import {rosterBeasts,ROSTER_KEYS,SAFE_ZONES} from '/monster-roster.js${V}';
import {monsterSpawns} from '/monster-spawns.js';
import {preloadCharacters} from '/character-assets.js${V}';
import {initializeGeography} from '/geography.js${V}';
import {createLandscape} from '/landscape.js${V}';
import {biomeWeights} from '/procedural-world.js${V}';
await preloadCharacters(T);
window.montage=async()=>{
 const cell=230,cols=9,keys=[...ROSTER_KEYS].sort((a,b)=>rosterBeasts[a].level-rosterBeasts[b].level),rows=Math.ceil(keys.length/cols);
 const sheet=document.createElement('canvas');sheet.width=cols*cell;sheet.height=rows*cell+40;document.body.appendChild(sheet);const ctx=sheet.getContext('2d');
 ctx.fillStyle='#1b2119';ctx.fillRect(0,0,sheet.width,sheet.height);ctx.fillStyle='#e8d6a4';ctx.font='bold 22px Georgia';ctx.fillText('Eldervale monster roster: '+keys.length+' new types, levels 2 to 120',14,28);
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(cell,cell);renderer.setPixelRatio(1);
 let failures=[];
 for(const [i,key] of keys.entries()){
  const scene=new T.Scene();scene.background=new T.Color(0x2c3a2c);scene.add(new T.HemisphereLight(0xdfe8ff,0x3a3024,1.6));const sun=new T.DirectionalLight(0xffffff,2.2);sun.position.set(3,6,5);scene.add(sun);
  const ground=new T.Mesh(new T.CircleGeometry(6,32),new T.MeshStandardMaterial({color:0x4b5a3a}));ground.rotation.x=-Math.PI/2;scene.add(ground);
  const d=bestiaryEntity(key,0,0),holder=new T.Group();holder.scale.setScalar(d.scale||1);holder.rotation.y=.5;scene.add(holder);
  try{const m=actorModel(T,holder,d);for(let f=0;f<12;f++)m.update(1/30,{distance:.03,attack:f>8?.32:0,hit:0,block:0});await new Promise(r=>setTimeout(r,30));for(let f=0;f<3;f++)m.update(1/30,{distance:.02,attack:0,hit:0,block:0})}catch(e){failures.push(key+': '+e.message)}
  holder.updateMatrixWorld(true);const box=new T.Box3().setFromObject(holder),size=box.getSize(new T.Vector3()),c=box.getCenter(new T.Vector3()),span=Math.max(size.x,size.y,size.z,1);
  const cam=new T.PerspectiveCamera(32,1,.05,200);cam.position.set(c.x+span*.9,c.y+span*.55,c.z+span*1.9);cam.lookAt(c.x,c.y,c.z);
  renderer.render(scene,cam);const x=(i%cols)*cell,y=40+Math.floor(i/cols)*cell;ctx.drawImage(renderer.domElement,x,y);
  const b=rosterBeasts[key];ctx.fillStyle='#0009';ctx.fillRect(x,y+cell-36,cell,36);ctx.fillStyle=b.tier==='Boss'||b.tier==='Legendary'?'#ffb35a':b.tier==='Elite'?'#d6b2ff':'#f2e6c4';ctx.font='bold 13px Arial';ctx.fillText(b.name,x+6,y+cell-20);ctx.font='11px Arial';ctx.fillStyle='#cfd8c0';ctx.fillText('Level '+b.level+' · '+b.tier+' · '+b.region,x+6,y+cell-6);
  ctx.strokeStyle='#5a4a2e';ctx.strokeRect(x+.5,y+.5,cell-1,cell-1);
 }
 return {failures,width:sheet.width,height:sheet.height};
};
window.spawnMap=async()=>{
 const cfg=await (await fetch('/db/generated-world.json')).json();initializeGeography(cfg.config);const land=createLandscape();
 const px=1000,ext=840,s=px/ext,canvas=document.createElement('canvas');canvas.width=px+300;canvas.height=px;document.body.appendChild(canvas);const ctx=canvas.getContext('2d'),img=ctx.createImageData(px,px);
 const pal={castle:[104,142,66],grass:[86,132,54],snow:[226,231,233],dry:[214,190,128]};
 for(let j=0;j<px;j++)for(let i=0;i<px;i++){const x=-420+i/s,z=-420+j/s,w=biomeWeights(x,z,cfg.config.seed),h=land.heightAt(x,z);let c=[0,0,0];for(const k in pal)for(let q=0;q<3;q++)c[q]+=pal[k][q]*w[k];const shade=Math.max(.7,Math.min(1.15,1-(h>30?(h-30)*.006:0)));c=c.map(v=>v*shade);if(land.waterAt(x,z)>0)c=[60,112,160];const o=(j*px+i)*4;img.data[o]=c[0];img.data[o+1]=c[1];img.data[o+2]=c[2];img.data[o+3]=255}
 ctx.putImageData(img,0,0);const P=(x,z)=>[(x+420)*s,(z+420)*s];
 for(const zone of SAFE_ZONES){const [cx,cz]=P(zone.x,zone.z);ctx.strokeStyle='#fff';ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.beginPath();if(zone.square)ctx.rect(cx-zone.radius*s,cz-zone.radius*s,zone.radius*2*s,zone.radius*2*s);else ctx.arc(cx,cz,zone.radius*s,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);ctx.fillStyle='#fff';ctx.font='bold 14px Georgia';ctx.fillText(zone.id+' (safe)',cx-40,cz+4)}
 const colour=l=>l<=15?'#7dff6a':l<=50?'#ffe14d':l<=100?'#ff8a3a':'#ff3a6a';
 const groups={};for(const sp of monsterSpawns){const b=rosterBeasts[sp.key],[x,z]=P(sp.x,sp.z);ctx.fillStyle=colour(b.level);ctx.strokeStyle='#000';ctx.beginPath();ctx.arc(x,z,b.level>100?6:3.2,0,Math.PI*2);ctx.fill();ctx.stroke();(groups[sp.group]??=[]).push(sp)}
 ctx.font='bold 11px Arial';for(const [name,list] of Object.entries(groups)){const lv=list.map(sp=>rosterBeasts[sp.key].level),cx=list.reduce((a,sp)=>a+sp.x,0)/list.length,cz=list.reduce((a,sp)=>a+sp.z,0)/list.length,[x,z]=P(cx,cz),label=name+' ('+Math.min(...lv)+(Math.max(...lv)>Math.min(...lv)?'–'+Math.max(...lv):'')+')';ctx.fillStyle='#000a';const w=ctx.measureText(label).width;const lx=Math.min(px-w-6,Math.max(2,x+8));ctx.fillRect(lx-2,z-18,w+4,14);ctx.fillStyle='#fff';ctx.fillText(label,lx,z-7)}
 ctx.fillStyle='#1b2119';ctx.fillRect(px,0,300,px);ctx.fillStyle='#e8d6a4';ctx.font='bold 18px Georgia';ctx.fillText('Monster spawns',px+16,34);ctx.font='13px Arial';
 [['Levels 2–15','#7dff6a'],['Levels 16–50','#ffe14d'],['Levels 51–100','#ff8a3a'],['Bosses 101–120','#ff3a6a']].forEach(([t,c],i)=>{ctx.fillStyle=c;ctx.beginPath();ctx.arc(px+24,62+i*24,6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#eee';ctx.fillText(t,px+38,67+i*24)});
 ctx.fillStyle='#ccc';ctx.fillText(monsterSpawns.length+' roster spawns in '+Object.keys(groups).length+' groups',px+16,180);ctx.fillText('North is up (−z). Dashed: towns/castle',px+16,200);ctx.fillText('(no hostile spawns inside).',px+16,218);
 return {width:canvas.width,height:canvas.height};
};
window.ready=true;
</script>`;
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({executablePath:process.env.ELDERVALE_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{const p=await browser.newPage({viewport:{width:2100,height:1700}});const errors=[];p.on('pageerror',e=>errors.push(e.message));p.on('console',m=>{if(m.type()==='error')errors.push(m.text())});
  await p.route('**/roster-fixture',r=>r.fulfill({contentType:'text/html',body:page}));await p.goto(url+'/roster-fixture');await p.waitForFunction(()=>window.ready,null,{timeout:120000});
  const m=await p.evaluate(()=>montage());if(m.failures.length)throw Error('Models failed: '+m.failures.join('; '));
  await p.locator('canvas').nth(0).screenshot({path:path.join(out,'roster-montage.png')});
  const map=await p.evaluate(()=>spawnMap());await p.locator('canvas').nth(1).screenshot({path:path.join(out,'spawn-map.png')});
  const real=errors.filter(e=>!/favicon|404/.test(e));if(real.length)console.warn('page errors:',real.slice(0,5));
  console.log('PASS montage '+m.width+'x'+m.height+', map '+map.width+'x'+map.height+' → '+out);
 }finally{await browser.close();server.close()}})().catch(e=>{console.error(e);process.exit(1)});
