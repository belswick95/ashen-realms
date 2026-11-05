// Renders a gallery of characters in key poses and outfits, plus the HUD
// portrait, to test-results/character-gallery.png for visual review.
// usage: ELDERVALE_CHROMIUM=/path/to/chrome node scripts/character-gallery.cjs
const fs=require('fs'),http=require('http'),path=require('path'),{chromium}=require('playwright-core');
const root=path.resolve(__dirname,'..');
const server=http.createServer((req,res)=>{try{const name=new URL(req.url,'http://local').pathname;res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.webp')?'image/webp':name.endsWith('.json')?'application/json':'application/octet-stream');res.end(fs.readFileSync(path.join(root,name)))}catch{res.writeHead(404).end()}});
const page=`<!doctype html><body style="margin:0;background:#223"><div id="health-hud"></div><canvas id="c" width="1600" height="900"></canvas>
<script type="importmap">{"imports":{"three":"/node_modules/three/build/three.module.js","three/addons/":"/node_modules/three/examples/jsm/"}}</script>
<script type="module">
import * as T from "three";const V="?v=release-20261104-lowpoly54";
const {preloadCharacters,ensurePart}=await import("/character-assets.js"+V);await preloadCharacters(T);
const {buildCharacterDisplay}=await import("/character-display.js"+V);const {outfitItems}=await import("/outfits.js"+V);const {createHorseMount}=await import("/horse-mount.js"+V);const {createPlayerHUD}=await import("/player-hud.js"+V);
const renderer=new T.WebGLRenderer({canvas:document.querySelector("#c"),antialias:true,preserveDrawingBuffer:true});renderer.outputColorSpace=T.SRGBColorSpace;
const scene=new T.Scene();scene.background=new T.Color(0x8fa6b8);scene.add(new T.HemisphereLight(0xffffff,0x556655,2.2));const sun=new T.DirectionalLight(0xffffff,2.4);sun.position.set(4,8,10);scene.add(sun);
const ground=new T.Mesh(new T.PlaneGeometry(60,30),new T.MeshStandardMaterial({color:0x5d7a4a}));ground.rotation.x=-Math.PI/2;scene.add(ground);
const set=(o,v,pieces)=>Object.fromEntries(Object.values(outfitItems).filter(i=>i.outfit===o&&i.variant===v&&pieces.includes(i.piece)).map(i=>[i.key,true]));
const knight=v=>set("knight",v,["Armet","Breastplate","Gauntlets","Greaves","Sabatons","RoundPauldrons"]);
const cases=[
 ["idle armed",{},{weapon:"longsword",shield:"kite"},{},30],
 ["walk",{},{weapon:"longsword",shield:"kite"},{distance:3.2/60,speed:3.2,locomotion:"walk"},40],
 ["sprint",{sex:"female",hair:"Buns"},{},{distance:12/60,speed:12,locomotion:"run"},40],
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
cases.forEach(([label,look,loadout,motion,frames],i)=>{const holder=new T.Group();const row=i<7?0:1,col=row?i-7:i,count=row?cases.length-7:7;holder.position.set((col-(count-1)/2)*3.2,0,row?4:-4);scene.add(holder);
 const parent=new T.Group();holder.add(parent);const d=buildCharacterDisplay(T,parent,look,loadout);
 const horse=label==="mounted"?createHorseMount(T,holder):null;
 for(let f=0;f<frames;f++){const m=typeof motion==="function"?motion(f):motion;d.update(1/60,m);d.visual.position.y=0;horse?.update({active:true,distance:.05,rig:d.rig,visual:d.visual})}
 if(i===0)hudModel=parent;labels.push(label)});
const camera=new T.PerspectiveCamera(30,16/9,.1,200);camera.position.set(0,9,34);camera.lookAt(0,1.2,0);renderer.setSize(1600,900,false);renderer.render(scene,camera);
// HUD portrait of the first character.
window.mainLoop=setInterval(()=>renderer.render(scene,camera),200);
const hud=createPlayerHUD(T,renderer,hudModel);hud.update({hp:100,maxHp:100,xp:0,kills:0,gold:0,helmet:null});
window.result={labels,portrait:document.querySelector("#player-portrait").toDataURL("image/png")};
</script>`;
(async()=>{await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({executablePath:process.env.ELDERVALE_CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox','--use-angle=swiftshader','--enable-unsafe-swiftshader']});
 try{const p=await browser.newPage({viewport:{width:1600,height:900}});p.on('pageerror',e=>console.error('PAGE',e.message));await p.route('**/gallery',r=>r.fulfill({contentType:'text/html',body:page}));
  await p.goto('http://127.0.0.1:'+server.address().port+'/gallery');await p.waitForFunction(()=>window.result,null,{timeout:120000});
  await p.waitForTimeout(4000);await p.evaluate(()=>window.result.portrait=document.querySelector('#player-portrait').toDataURL('image/png'));
  const out=path.join(root,'test-results');fs.mkdirSync(out,{recursive:true});
  const r=await p.evaluate(()=>window.result);fs.writeFileSync(path.join(out,'hud-portrait.png'),Buffer.from(r.portrait.split(',')[1],'base64'));
  await p.locator('#c').screenshot({path:path.join(out,'character-gallery.png')});console.log('PASS',r.labels.join(', '));
 }finally{await browser.close();server.close()}})().catch(e=>{console.error(e);process.exitCode=1});
