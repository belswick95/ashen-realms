// Contact sheet for the rigged animal models: each species before (classic procedural body)
// and after (rigged GLB), idle and mid-walk, plus the rigged corpse after its death clip,
// standing on a ground plane. Every actor faces +Z, which points to the right of each cell.
//
// usage: node scripts/animal-sheet.cjs <out.png> [species,...]
// Renders offline in Chromium (SwiftShader); nothing outside 127.0.0.1 is fetched.
const fs=require('fs'),http=require('http'),path=require('path');
const {chromium}=require(path.join(__dirname,'..','node_modules','playwright-core'));
const root=path.resolve(__dirname,'..'),out=path.resolve(process.argv[2]||'docs/monsters/animals-sheet.png');
const list=(process.argv[3]||'deer,cow,pig,sheep,chicken').split(',');
const types={'.js':'text/javascript','.mjs':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.jpg':'image/jpeg','.json':'application/json','.glb':'model/gltf-binary','.bin':'application/octet-stream','.html':'text/html'};
const page=`<!doctype html><html><body style="margin:0;background:#222"><script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as T from 'three';
const {actorModel}=await import('/world-models.js');
const {worldTemplates}=await import('/world-templates.js');
const mm=await import('/monster-models.js');
const {preloadCharacters}=await import('/character-assets.js');
await preloadCharacters(T);await mm.preloadMonsterModels(T);
const W=260,H=200,renderer=new T.WebGLRenderer({antialias:true,preserveDrawingBuffer:true});renderer.setSize(W,H);renderer.outputColorSpace=T.SRGBColorSpace;renderer.shadowMap.enabled=true;
const scene=new T.Scene();scene.background=new T.Color(0xa9bdb0);
scene.add(new T.HemisphereLight(0xdfe9ff,0x5b4f3a,1.5));const sun=new T.DirectionalLight(0xfff1dc,2.3);sun.position.set(-3,8,5);sun.castShadow=true;Object.assign(sun.shadow.camera,{left:-5,right:5,top:5,bottom:-5});sun.shadow.mapSize.set(1024,1024);scene.add(sun);
const ground=new T.Mesh(new T.CircleGeometry(40,48),new T.MeshStandardMaterial({color:0x6f8a52,roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const grid=new T.GridHelper(20,20,0x4c6238,0x4c6238);grid.position.y=.003;scene.add(grid);
const camera=new T.PerspectiveCamera(28,W/H,.05,200);
const list=${JSON.stringify(list)},cols=['classic, idle','classic, walk','rigged, idle','rigged, walk','rigged, dead'];
const sheet=document.createElement('canvas');sheet.width=150+W*cols.length;sheet.height=34+H*list.length;const g=sheet.getContext('2d');
g.fillStyle='#1d2421';g.fillRect(0,0,sheet.width,sheet.height);g.font='15px sans-serif';g.fillStyle='#e8e2cf';
cols.forEach((c,i)=>g.fillText(c,150+i*W+10,22));
const stats=[];
const frame=(holder)=>{holder.updateMatrixWorld(true);const box=new T.Box3().setFromObject(holder,true);return box};
for(const [row,species] of list.entries()){
 const [id,t]=Object.entries(worldTemplates).find(([,t])=>t.species===species&&t.kind==='monster');
 const d={...t,template:id,kind:'monster'},s=d.scale||1;
 g.fillStyle='#e8e2cf';g.fillText(species,12,34+row*H+H/2);g.font='12px sans-serif';g.fillStyle='#a9b3a8';g.fillText(t.name+', scale '+s,12,34+row*H+H/2+18);g.font='15px sans-serif';
 let view=null;const st={species};
 for(const [col,mode] of [[0,'classic-idle'],[1,'classic-walk'],[2,'rigged-idle'],[3,'rigged-walk'],[4,'rigged-dead']]){
  const holder=new T.Group();holder.scale.setScalar(s);scene.add(holder);
  const model=actorModel(T,holder,mode.startsWith('classic')?{...d,classicBody:true}:d);
  const run=(n,m)=>{for(let k=0;k<n;k++)model.update?.(1/30,m)};
  run(15,{distance:0,attack:0,hit:0,block:0});
  if(mode.endsWith('walk'))run(13,{distance:2.63/30,speed:2.63,attack:0,hit:0,block:0});
  if(mode==='rigged-dead')run(60,{dead:true});
  const box=frame(holder);
  if(mode==='rigged-idle'){st.rigged=model.rigged;st.minY=+box.min.y.toFixed(3);st.height=+(box.max.y-box.min.y).toFixed(2);st.length=+(box.max.z-box.min.z).toFixed(2);st.width=+(box.max.x-box.min.x).toFixed(2);let head=null;holder.traverse(o=>{if(!head&&o.isBone&&/head/i.test(o.name))head=o});if(head){const p=head.getWorldPosition(new T.Vector3()),c=box.getCenter(new T.Vector3());st.headDir=[+(p.x-c.x).toFixed(2),+(p.z-c.z).toFixed(2)]}}
  if(mode==='rigged-walk')st.walkMinY=+box.min.y.toFixed(3);
  if(mode==='rigged-dead'){st.deadMinY=+box.min.y.toFixed(3);st.ownDeath=model.ownDeath}
  if(!view){const size=box.getSize(new T.Vector3()),c=box.getCenter(new T.Vector3()),r=Math.max(size.x,size.y,size.z,.6)*.62,dist=r/Math.tan(14*Math.PI/180);
   view={c:new T.Vector3(c.x,size.y*.45,c.z),pos:new T.Vector3(c.x-dist*.86,size.y*.45+dist*.22,c.z+dist*.46)}}
  camera.position.copy(view.pos);camera.lookAt(view.c);renderer.render(scene,camera);
  g.drawImage(renderer.domElement,150+col*W,34+row*H);
  model.dispose?.();holder.removeFromParent();
 }
 stats.push(st);
}
g.strokeStyle='#1d2421';g.lineWidth=2;for(let i=0;i<=cols.length;i++){g.beginPath();g.moveTo(150+i*W,34);g.lineTo(150+i*W,sheet.height);g.stroke()}
window.result={png:sheet.toDataURL('image/png'),stats};
</script></body></html>`;
const server=http.createServer((req,res)=>{try{const p=decodeURIComponent(new URL(req.url,'http://local').pathname);
 if(p==='/'||p==='/__sheet.html'){res.setHeader('content-type','text/html');return res.end(page)}
 const file=path.join(root,p);if(!file.startsWith(root))throw 0;
 res.setHeader('content-type',types[path.extname(file)]||'application/octet-stream');res.end(fs.readFileSync(file))}catch{res.writeHead(404).end()}});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));
 const browser=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1243/chrome-linux64/chrome',args:['--no-sandbox','--use-gl=angle','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{const p=await browser.newPage();
  p.on('pageerror',e=>console.log('PAGE',e.message));p.on('console',m=>{if(['error','warning'].includes(m.type()))console.log('CONSOLE',m.text().slice(0,300))});
  await p.route('**/*',r=>r.request().url().startsWith('http://127.0.0.1:')?r.continue():r.abort());
  await p.goto('http://127.0.0.1:'+server.address().port+'/__sheet.html');
  await p.waitForFunction(()=>window.result,null,{timeout:600000});
  const {png,stats}=await p.evaluate(()=>window.result);
  fs.mkdirSync(path.dirname(out),{recursive:true});fs.writeFileSync(out,Buffer.from(png.split(',')[1],'base64'));
  for(const s of stats)console.log(JSON.stringify(s));console.log('wrote',out);
 }finally{await browser.close();server.close()}
})().catch(e=>{console.error(e);server.close();process.exitCode=1});
