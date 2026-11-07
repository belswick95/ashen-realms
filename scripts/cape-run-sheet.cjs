// Cape QA contact sheets (docs/qa/movement): the Mixamo run cycle from the side and from behind,
// male and female, with the cape as it was before (git HEAD~ / a given revision, default HEAD) and as
// it is now; plus a mounted rider (cape over the horse). Usage:
//   node scripts/cape-run-sheet.cjs [before-revision]
const fs=require('fs'),http=require('http'),path=require('path'),{execFileSync}=require('child_process');
const {chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');let modules=root;while(!fs.existsSync(path.join(modules,'node_modules/three'))&&path.dirname(modules)!==modules)modules=path.dirname(modules);modules=path.join(modules,'node_modules');
const before=execFileSync('git',['show',(process.argv[2]||'HEAD')+':cape.js'],{cwd:root,encoding:'utf8'});
const out=path.join(root,'docs/qa/movement');fs.mkdirSync(out,{recursive:true});
const PHASES=8,CELL=[190,250];
const html=`<!doctype html><html><head><meta charset="utf-8"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<style>body{margin:0;background:#1b2420;color:#ead8ad;font:13px Georgia}#grid{position:relative}.lab{position:absolute;color:#ead8ad;font:12px Georgia;text-shadow:0 1px 2px #000}</style></head><body><div id="grid"></div><script type="module">
import * as T from 'three';import {preloadCharacters} from '/character-assets.js';import {buildHumanoid} from '/humanoid.js';import {createHumanoidAnimator} from '/animation.js';
import {createCape} from '/cape.js';import {createCape as createCapeBefore} from '/__before/cape.js';import {createHorseMount} from '/horse-mount.js';
await preloadCharacters(T);
const [CW,CH]=${JSON.stringify(CELL)},P=${PHASES};
window.sheet=async(kind)=>{
 const rows=kind==='mounted'?[['before','side'],['before','back'],['after','side'],['after','back']]:[['before','male','side'],['before','male','back'],['before','female','side'],['before','female','back'],['after','male','side'],['after','male','back'],['after','female','side'],['after','female','back']];
 const LW=130,W=LW+P*CW,H=46+rows.length*CH,grid=document.getElementById('grid');grid.innerHTML='';grid.style.width=W+'px';grid.style.height=H+'px';
 const renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setPixelRatio(1);renderer.setSize(W,H);renderer.autoClear=false;renderer.setClearColor(0x1b2420);renderer.clear();grid.append(renderer.domElement);renderer.domElement.style.position='absolute';
 const lab=(x,y,t)=>{const d=document.createElement('div');d.className='lab';d.style.left=x+'px';d.style.top=y+'px';d.innerHTML=t;grid.append(d)};
 lab(8,8,kind==='mounted'?'<b>Mounted rider</b>: cape over the horse (gallop)':'<b>Run cycle</b> (Mixamo_Run, 8 phases of one 0.7 s cycle): side and back');
 for(let p=0;p<P;p++)lab(LW+p*CW+6,26,(kind==='mounted'?'gallop ':'run ')+(p/P).toFixed(3).slice(1)+' cycle');
 const scene=new T.Scene();scene.add(new T.HemisphereLight(0xffffff,0x5a6b60,2.2));const sun=new T.DirectionalLight(0xffe7c0,2.6);sun.position.set(4,8,3);scene.add(sun);
 const floor=new T.Mesh(new T.PlaneGeometry(40,40),new T.MeshStandardMaterial({color:0x3a4a40,roughness:1}));floor.rotation.x=-Math.PI/2;scene.add(floor);
 const cams={side:new T.PerspectiveCamera(30,CW/CH,.1,80),back:new T.PerspectiveCamera(30,CW/CH,.1,80)};
 const dist=kind==='mounted'?11:7.4,lookY=kind==='mounted'?2.2:1.15;
 cams.side.position.set(dist,lookY+.25,kind==='mounted'?-.6:0);cams.side.lookAt(0,lookY,kind==='mounted'?-.6:0);cams.back.position.set(.0,lookY+.9,-dist);cams.back.lookAt(0,lookY,0);
 const actors=[];
 for(const [r,row] of rows.entries()){
  const [ver,a,b]=row,sex=kind==='mounted'?'male':a,view=kind==='mounted'?a:b;
  const parent=new T.Group(),body=new T.Group();parent.add(body);scene.add(parent);const rig=buildHumanoid(T,body,{sex});
  const cape=(ver==='before'?createCapeBefore:createCape)(T,body,{rig});
  const animator=createHumanoidAnimator(rig),horse=kind==='mounted'?createHorseMount(T,parent):null;
  actors.push({r,row,ver,sex,view,parent,body,rig,cape,animator,horse});lab(8,46+r*CH+CH/2-16,'<b>'+ver.toUpperCase()+'</b><br>'+(kind==='mounted'?'':sex+' · ')+view);
 }
 const dt=1/60,cycle=kind==='mounted'?7.6/7.9:.7,speed=kind==='mounted'?7.9:5.27;
 const step=a=>{const pose=a.animator.update(dt,{distance:a.horse?0:speed*dt,speed:a.horse?0:speed,locomotion:'jog',mounted:!!a.horse});
  if(a.horse){a.body.position.y=0;a.horse.update({active:true,distance:speed*dt,dt,rig:a.rig,visual:a.body})}
  a.body.updateMatrixWorld(true);a.cape.update(dt,a.horse?1:pose?.blend||0,a.horse?{mounted:true,mountRoot:a.horse.root,run:1}:{run:pose?.run})};
 for(let f=0;f<120;f++)for(const a of actors)step(a);
 const per=Math.round(cycle/dt/P);
 for(let p=0;p<P;p++){
  for(const a of actors){for(const o of actors)o.parent.visible=o===a;
   const x=LW+p*CW,y=46+a.r*CH;renderer.setViewport(x,H-y-CH,CW,CH);renderer.setScissor(x,H-y-CH,CW,CH);renderer.setScissorTest(true);renderer.clear();renderer.render(scene,cams[a.view])}
  for(let k=0;k<per;k++)for(const a of actors)step(a);
 }
 renderer.setScissorTest(false);return {W,H};
};
window.ready=true;
</script></body></html>`;
const types={'.js':'text/javascript','.json':'application/json','.glb':'model/gltf-binary','.png':'image/png','.jpg':'image/jpeg','.webp':'image/webp','.ktx2':'image/ktx2'};
const server=http.createServer((req,res)=>{const p=decodeURIComponent(new URL(req.url,'http://local').pathname);
 if(p==='/'){res.setHeader('content-type','text/html');return res.end(html)}
 if(p==='/__before/cape.js'){res.setHeader('content-type','text/javascript');return res.end(before)}
 const file=p.startsWith('/node_modules/')?path.join(modules,p.slice('/node_modules/'.length)):path.join(root,p);
 fs.readFile(file,(e,b)=>{if(e){res.writeHead(404);return res.end()}res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');res.end(b)})});
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:process.env.CHROME||'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{const page=await browser.newPage({viewport:{width:1700,height:2100}});page.on('pageerror',e=>console.error('pageerror',e));page.on('console',m=>{if(m.type()==='error')console.error(m.text())});
  await page.goto('http://127.0.0.1:'+server.address().port);await page.waitForFunction(()=>window.ready,null,{timeout:120000});
  for(const kind of ['run','mounted']){const {W,H}=await page.evaluate(k=>window.sheet(k),kind);const file=path.join(out,'cape-'+kind+'-sheet.png');
   await page.screenshot({path:file,clip:{x:0,y:0,width:W,height:H}});console.log('wrote',path.relative(root,file))}
 }finally{await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
