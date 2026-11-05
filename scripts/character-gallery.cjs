// Renders a gallery of characters in key poses and outfits, plus the HUD
// portrait, to test-results/character-gallery.png for visual review.
// usage: ELDERVALE_CHROMIUM=/path/to/chrome node scripts/character-gallery.cjs
const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{try{const name=new URL(req.url,'http://local').pathname;res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.webp')?'image/webp':name.endsWith('.json')?'application/json':'application/octet-stream');res.end(fs.readFileSync(path.join(root,name)))}catch{res.writeHead(404).end()}});
const page=`<!doctype html><body style="margin:0;background:#223"><div id="health-hud"></div><canvas id="c" width="1600" height="900"></canvas>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as T from "three";const V="?v=release-20261105-camera75";
const {preloadCharacters,ensurePart}=await import("/character-assets.js"+V);await preloadCharacters(T);
const {buildCharacterDisplay}=await import("/character-display.js"+V);const {outfitItems}=await import("/outfits.js"+V);const {createHorseMount}=await import("/horse-mount.js"+V);const {createPlayerHUD}=await import("/player-hud.js"+V);
const renderer=new T.WebGLRenderer({canvas:document.querySelector("#c"),antialias:true,preserveDrawingBuffer:true});renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene();scene.background=new T.Color(0x8fa6b8);scene.add(new T.HemisphereLight(0xffffff,0x556655,2.2));const sun=new T.DirectionalLight(0xffffff,2.4);sun.position.set(4,8,10);scene.add(sun);
const ground=new T.Mesh(new T.PlaneGeometry(60,30),new T.MeshStandardMaterial({color:0x5d7a4a}));ground.rotation.x=-Math.PI/2;scene.add(ground);
const set=(o,v,pieces)=>Object.fromEntries(Object.values(outfitItems).filter(i=>i.outfit===o&&i.variant===v&&pieces.includes(i.piece)).map(i=>[i.key,true]));
const knight=v=>set("knight",v,["Armet","Breastplate","Gauntlets","Greaves","Sabatons","RoundPauldrons"]);
const weaponMode=location.hash==="#weapons";const {weaponCatalog}=await import("/weapons.js"+V);const {shieldCatalog}=await import("/shields.js"+V);const {weaponStore}=await import("/weapon-assets.js"+V);
const cases=weaponMode?[
 ...["longsword","axe","battleaxe","pickaxe","spear","warhammer","scythe","claymore"].flatMap(w=>[[w,{},{weapon:w,shield:"kite"},{},30],[w+" swing",{},{weapon:w,shield:"kite"},i=>i<4?{attack:.6}:{attack:Math.max(0,.6-i/60)},20]]),
 ["bow",{},{weapon:"woodenBow"},{},30],["bow walk",{},{weapon:"longbow"},{distance:3.2/60,speed:3.2,locomotion:"walk"},40],["bow draw",{},{weapon:"goldenBow"},i=>i<2?{attack:1}:{attack:Math.max(0,1-i/60)},38],["bow aim start",{sex:"female"},{weapon:"bloodthornBow"},i=>i<2?{attack:1}:{attack:Math.max(0,1-i/60)},14],["block round",{},{weapon:"spear",shield:"celticShield"},{block:.5},25],["staff",{sex:"female",hairColor:"#c0b5a3"},{weapon:"amethystStaff",armor:set("wizard",2,["RobeTop","Bracers","RobeBottom","Boots"])},{},30],["staff cast",{},{weapon:"emberStaff",armor:set("wizard",3,["RobeTop","Bracers","RobeBottom","Boots"])},i=>i<2?{attack:.55}:{attack:Math.max(0,.55-i/60)},14],["staff walk",{},{weapon:"sapphireStaff",armor:set("wizard",1,["RobeTop","Bracers","RobeBottom","Boots"])},{distance:3.2/60,speed:3.2,locomotion:"walk"},40]]:[
 ["idle armed",{},{weapon:"longsword",shield:"kite"},{},30],
 ["walk",{},{weapon:"longsword",shield:"kite"},{distance:3.2/60,speed:3.2,locomotion:"walk"},40],
 ["sprint",{sex:"female",hair:"Buns"},{},{distance:12/60,speed:12,locomotion:"run"},40],
 ["jog",{},{weapon:"longsword"},{distance:6.4/60,speed:6.4,locomotion:"jog"},47],
 ["combat stance",{},{weapon:"longsword",shield:"kite"},{combat:true},30],
 ["attack",{},{weapon:"longsword",shield:"kite"},i=>i<4?{attack:.6}:{attack:Math.max(0,.6-i/60)},22],
 ["block",{},{weapon:"longsword",shield:"kite"},{block:.5},25],
 ["jump",{},{},i=>({airborne:i>2}),20],
 ["iron knight",{},{armor:knight(1),weapon:"longsword",shield:"kite"},{},30],
 ["gilded knight",{sex:"female"},{armor:knight(2)},{},30],
 ["blacksteel",{},{armor:knight(3),weapon:"twohand"},{},30],
 ["wizard",{sex:"female",hairColor:"#c0b5a3"},{armor:set("wizard",2,["RobeTop","Bracers","RobeBottom","Boots"]),weapon:"staff"},{},30],
 ["ranger",{},{armor:set("ranger",1,["Hood","Tunic","Bracers","Trousers","Boots","Pauldron"])},{},30],
 ["noble",{sex:"female"},{armor:{...set("noble",1,["Crown","Coat","Sleeves","Trousers","Boots","Gorget"]),cape:true}},{},30],
 ["mounted",{},{weapon:"longsword"},{mounted:true},30]];
await Promise.all(cases.flatMap(c=>Object.keys(c[2].armor||{}).filter(k=>outfitItems[k]).flatMap(k=>[ensurePart(outfitItems[k].male),ensurePart(outfitItems[k].female)])));
const labels=[];let hudModel=null;
cases.forEach(([label,look,loadout,motion,frames],i)=>{const holder=new T.Group();const per=weaponMode?9:7,row=Math.floor(i/per),col=i%per,count=Math.min(per,cases.length-row*per);holder.position.set((col-(count-1)/2)*3.2,0,(row-1)*4);scene.add(holder);
 const parent=new T.Group();holder.add(parent);const d=buildCharacterDisplay(T,parent,look,loadout);
 const horse=label==="mounted"?createHorseMount(T,holder):null;
 for(let f=0;f<frames;f++){const m=typeof motion==="function"?motion(f):motion;d.update(1/60,m);d.visual.position.y=0;horse?.update({active:true,distance:.05,rig:d.rig,visual:d.visual})}
 if(i===0)hudModel=parent;labels.push(label)});
if(weaponMode){const {createArrows}=await import('/arrows.js'+V);const bolts=createArrows(T,scene);for(const [i,c] of [[0,0xff6a3d],[1,0x5b7dff],[2,0xc45bff]].entries?[[0,0xff6a3d],[1,0x5b7dff],[2,0xc45bff]]:[]){bolts.fire(new T.Vector3(-6+i*.0,1.8,8-i*1.5),new T.Vector3(6,1.8,8-i*1.5),{kind:'bolt',color:c,height:0});}bolts.update(.2);
const keys=[...Object.keys(weaponStore.items)];keys.forEach((k,i)=>{const m=weaponStore.items[k].clone(true);const g=new T.Group();g.add(m);g.position.set((i-(keys.length-1)/2)*.95,1.0,9);g.rotation.y=0;scene.add(g);const ax=new T.AxesHelper(.25);g.add(ax)})}
const camera=new T.PerspectiveCamera(30,16/9,.1,200);if(weaponMode){camera.position.set(0,7,40);camera.lookAt(0,1.2,2)}else{camera.position.set(0,9,34);camera.lookAt(0,1.2,0)}renderer.setSize(1600,900,false);renderer.render(scene,camera);
// HUD portrait of the first character.
window.view=(px,py,pz,tx,ty,tz,fov=30)=>{camera.position.set(px,py,pz);camera.fov=fov;camera.updateProjectionMatrix();camera.lookAt(tx,ty,tz);renderer.render(scene,camera)};window.mainLoop=setInterval(()=>renderer.render(scene,camera),200);
const hud=createPlayerHUD(T,renderer,hudModel);hud.update({hp:100,maxHp:100,xp:0,kills:0,gold:0,helmet:null});
window.result={labels,portrait:document.querySelector("#player-portrait").toDataURL("image/png")};
</script>`;
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.ELDERVALE_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{const p=await browser.newPage({viewport:{width:1600,height:900}});p.on('pageerror',e=>console.error('PAGE',e.message));await p.route('**/gallery',r=>r.fulfill({contentType:'text/html',body:page}));
  await p.goto('http://127.0.0.1:'+server.address().port+'/gallery'+(process.env.GALLERY==='weapons'?'#weapons':''));await p.waitForFunction(()=>window.result,null,{timeout:120000});
  await p.waitForTimeout(4000);await p.evaluate(()=>window.result.portrait=document.querySelector('#player-portrait').toDataURL('image/png'));
  const out=path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});
  const r=await p.evaluate(()=>window.result);const tag=process.env.GALLERY==='weapons'?'weapon-gallery':'character-gallery';fs.writeFileSync(path.join(out,'hud-portrait.png'),Buffer.from(r.portrait.split(',')[1],'base64'));
  await p.locator('#c').screenshot({path:path.join(out,tag+'.png')});
  for(const [name,v] of Object.entries(JSON.parse(process.env.VIEWS||'{}'))){await p.evaluate(v=>{clearInterval(window.mainLoop);window.view(...v)},v);await p.waitForTimeout(300);await p.locator('#c').screenshot({path:path.join(out,tag+'-'+name+'.png')})}console.log('PASS',r.labels.join(', '));
 }finally{await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
