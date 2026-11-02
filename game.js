import * as T from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import {buildHumanoid} from './humanoid.js';
const appearance=(()=>{try{return JSON.parse(localStorage.getItem('eldervale-save')||'{}').appearance||{}}catch{return {}}})();
const tint=(hex,fallback)=>/^#[0-9a-f]{6}$/i.test(hex||'')?parseInt(hex.slice(1),16):fallback;
const skin=tint(appearance.skin,0xd9a783),shirt=tint(appearance.shirt,0x315b76),pants=tint(appearance.pants,0x424750),hairColor=tint(appearance.hairColor,0x3b2b22);
const scene=new T.Scene();scene.background=new T.Color(0x9dbbc2);scene.fog=new T.Fog(0x9dbbc2,105,255);
const camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.1,450),renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;document.body.prepend(renderer.domElement);
scene.add(new T.HemisphereLight(0xcfe4ff,0x5a4d33,2));const sun=new T.DirectionalLight(0xffe9b6,2.3);sun.position.set(12,25,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
// Seeded procedural canvas textures, cached and shared across meshes.
const textureCache=new Map();
function texture(kind,base){const key=kind+base;if(textureCache.has(key))return textureCache.get(key);const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;const ctx=canvas.getContext('2d');ctx.fillStyle='#'+base.toString(16).padStart(6,'0');ctx.fillRect(0,0,128,128);let seed=base>>>0;const rnd=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296};
for(let i=0;i<750;i++){const x=rnd()*128,y=rnd()*128,r=.4+rnd()*2.7;ctx.fillStyle=rnd()>.5?'rgba(255,248,208,.075)':'rgba(18,27,18,.09)';ctx.fillRect(x,y,r,r)}
if(kind==='wood'){for(let i=0;i<22;i++){ctx.strokeStyle=i%2?'#ffffff16':'#130d0b24';ctx.lineWidth=.5+rnd()*1.6;ctx.beginPath();const y=i*6+rnd()*3;ctx.moveTo(0,y);ctx.bezierCurveTo(36,y+3,78,y-3,128,y+2);ctx.stroke()}}
if(kind==='stone'){for(let i=0;i<20;i++){ctx.strokeStyle='#18201b23';ctx.beginPath();const x=rnd()*128,y=rnd()*128;ctx.moveTo(x,y);ctx.lineTo(x+5+rnd()*17,y+2+rnd()*9);ctx.stroke()}}
if(kind==='grass'){for(let i=0;i<135;i++){const x=rnd()*128,y=rnd()*128;ctx.strokeStyle=rnd()>.5?'#bed39736':'#254d2c35';ctx.lineWidth=.5+rnd();ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x+(rnd()-.5)*4,y-2-rnd()*7);ctx.stroke()}for(let i=0;i<18;i++){ctx.fillStyle='#d4bc8d44';ctx.fillRect(rnd()*128,rnd()*128,1+rnd()*2,1+rnd()*2)}}
if(kind==='dirt'){for(let i=0;i<210;i++){const x=rnd()*128,y=rnd()*128,r=1+rnd()*3;ctx.fillStyle=rnd()>.5?'#3c32212a':'#f3d6a72e';ctx.beginPath();ctx.ellipse(x,y,r,r*.65,rnd()*6,0,Math.PI*2);ctx.fill()}}
if(kind==='leaf'){for(let i=0;i<180;i++){const x=rnd()*128,y=rnd()*128;ctx.fillStyle=rnd()>.5?'#d6e5a124':'#122b1b30';ctx.beginPath();ctx.ellipse(x,y,1+rnd()*4,1+rnd()*2,rnd()*6,0,Math.PI*2);ctx.fill()}}
if(kind==='roof'){for(let y=0;y<128;y+=15){ctx.strokeStyle='#160f0c44';ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(128,y);ctx.stroke();for(let x=(y%30?8:0);x<128;x+=24){ctx.beginPath();ctx.moveTo(x,y);ctx.lineTo(x,y+15);ctx.stroke()}}}
const t=new T.CanvasTexture(canvas);t.colorSpace=T.SRGBColorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.anisotropy=4;textureCache.set(key,t);return t}
const materialCache=new Map();function material(c,kind='stone'){const key=c+kind;if(!materialCache.has(key))materialCache.set(key,new T.MeshLambertMaterial({map:texture(kind,c),color:0xffffff}));return materialCache.get(key)}const targets=[];
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
function box(w,h,d,c,x,y,z,p=scene,kind='stone'){const o=new T.Mesh(new T.BoxGeometry(w,h,d),material(c,kind));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o}
function sphere(r,c,x,y,z,p=scene){const o=new T.Mesh(new T.SphereGeometry(r,10,8),material(c));o.position.set(x,y,z);o.castShadow=true;p.add(o);return o}
function cone(r,h,c,x,y,z,p=scene,kind='leaf'){const o=new T.Mesh(new T.ConeGeometry(r,h,7),material(c,kind));o.position.set(x,y,z);o.castShadow=true;p.add(o);return o}
const groundTexture=texture('grass',0x69865b).clone();groundTexture.repeat.set(85,85);groundTexture.needsUpdate=true;const ground=new T.Mesh(new T.PlaneGeometry(840,840),new T.MeshLambertMaterial({map:groundTexture}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
function disk(r,c,x,z){const m=new T.Mesh(new T.CircleGeometry(r,28),material(c));m.rotation.x=-Math.PI/2;m.position.set(x,.018,z);scene.add(m)}
function trail(ax,az,bx,bz,width=2.7){const len=Math.hypot(bx-ax,bz-az);const m=new T.Mesh(new T.PlaneGeometry(width,len),material(0xa38b64,'dirt'));m.rotation.x=-Math.PI/2;m.rotation.z=Math.atan2(bx-ax,bz-az);m.position.set((ax+bx)/2,.025,(az+bz)/2);scene.add(m)}
trail(0,0,-60,45);trail(0,0,75,-55);trail(0,0,105,103);trail(-60,45,-105,-91);disk(13,0x81966a,0,0);
for(let i=0;i<480;i++){const a=i*2.399963,r=8+Math.sqrt(i)*9.1,x=Math.sin(a)*r,z=Math.cos(a)*r;if(Math.abs(x)<410&&Math.abs(z)<410){const g=box(.11,.14,.11,i%3?0x79955b:0x9baa70,x,.08,z);g.rotation.y=a}}
for(let i=0;i<38;i++){const a=i*2.4,r=17+i*3.8,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x)<405&&Math.abs(z)<405){const stone=sphere(.3+i%3*.12,0x8d8e7c,x,.16,z);stone.scale.y=.5}}
function tree(x,z){
 const seed=Math.abs(Math.sin(x*12.9898+z*78.233));
 const trunk=box(.53,3.7,.53,0x65472f,x,1.85,z,scene,'wood');trunk.rotation.y=seed*2;
 for(let i=0;i<3;i++){const branch=box(.12,1.1,.12,0x65472f,x+(i-1)*.42,3.25+i*.38,z+(i%2?.3:-.3),scene,'wood');branch.rotation.z=(i-1)*.65}
 const crownColors=[0x356f47,0x3f8051,0x4c8952,0x2e6846];
 const hit=cone(2.35,3.6,crownColors[Math.floor(seed*4)],x,4.0,z);hit.userData={kind:'tree',x,z};targets.push(hit);
 cone(1.9,2.9,crownColors[(Math.floor(seed*4)+1)%4],x,5.25,z);
 cone(1.25,2.4,crownColors[(Math.floor(seed*4)+2)%4],x,6.35,z);
 for(let i=0;i<4;i++){const a=i*2.4+seed*4;const leaf=cone(.65,1.2,crownColors[i],x+Math.cos(a)*1.15,4.2+i*.24,z+Math.sin(a)*1.15);leaf.rotation.z=Math.cos(a)*.28}
}
function rock(x,z){
 const root=new T.Group();root.position.set(x,0,z);scene.add(root);
 const color=[0x777b78,0x898b7d,0x676f6c][Math.floor(Math.abs(Math.sin(x+z))*3)];
 const m=new T.Mesh(new T.DodecahedronGeometry(.9,0),material(color,'stone'));m.position.y=.57;m.scale.set(1.15,.75,1);m.rotation.y=x*.1;m.castShadow=true;m.receiveShadow=true;root.add(m);
 const smaller=new T.Mesh(new T.DodecahedronGeometry(.36,0),material(0x6f7770,'stone'));smaller.position.set(.68,.24,.18);smaller.castShadow=true;root.add(smaller);
 m.userData={kind:'rock',x,z};targets.push(m)
}
function house(x,z,c){
 const group=new T.Group();group.position.set(x,0,z);scene.add(group);
 box(4,3,3.7,c,0,1.5,0,group,'stone');
 for(const side of [-1,1]){
  box(.18,3.15,.2,0x715139,side*1.94,1.55,1.83,group,'wood');
  box(.18,3.15,.2,0x715139,side*1.94,1.55,-1.83,group,'wood')
 }
 box(4.25,.18,3.9,0x74543c,0,3.07,0,group,'wood');
 // Two pitched roof slopes instead of an intersecting cone.
 for(const side of [-1,1]){
  const roof=box(2.95,.18,4.45,0x634332,side*1.14,3.95,0,group,'roof');roof.rotation.z=side*.58
 }
 box(.86,1.65,.12,0x493322,0,.84,1.92,group,'wood');
 box(.08,.08,.06,0xc7a65f,.29,.84,2.0,group);
 for(const side of [-1,1]){
  box(.79,.82,.12,0x89aeb8,side*1.25,1.92,1.92,group);
  box(.1,.91,.17,0x614832,side*1.25,1.92,2.02,group,'wood');
  box(.85,.10,.17,0x614832,side*1.25,1.92,2.02,group,'wood')
 }
 box(.4,1.2,.4,0x76665b,1.1,4.35,-.7,group,'stone');
 for(let i=0;i<4;i++)box(.36,.21,.29,0x858479,-1.55+i*.95,.12,1.96,group,'stone');
}
for(let i=0;i<520;i++){const a=i*2.399,r=14+Math.sqrt(i)*17,x=Math.sin(a)*r,z=Math.cos(a)*r;if(i%4===0)rock(x,z);else tree(x,z)}
house(-7,-5,0xb8a480);house(7,-6,0x9d967f);house(8,7,0xc1aa82);house(-60,42,0xb7a08c);house(-54,48,0xaaa38a);house(73,-58,0xc3b29b);house(78,-51,0x99866c);house(-105,-91,0x9a9b87);house(102,103,0xb8a48d);house(-210,145,0xbda78a);house(-205,151,0xa8a089);house(260,-185,0xbda78a);house(265,-180,0xaaa08a);house(225,215,0xbaa78e);house(-275,-215,0xbda88d);
// Forest glades and distant ruins make the expanded wilderness feel distinct.
for(let i=0;i<16;i++){const a=i*Math.PI*2/16;box(1.6,1.1+(i%4)*.4,1.5,0x6d716b,132+Math.cos(a)*9,.7,26+Math.sin(a)*9)}
// Additional regions: winding roads, villages, groves and landmarks.
trail(-60,45,-210,145,3.4);trail(75,-55,260,-185,3.4);trail(105,103,225,215,3.4);trail(-105,-91,-275,-215,3.4);
for(const [x,z,r,c] of [[-190,155,18,0x537d55],[245,-170,25,0x6b8052],[210,230,19,0x78926b],[-260,-220,22,0x708660]])disk(r,c,x,z);
for(let i=0;i<60;i++){const a=i*2.4,r=12+i*.8;const x=250+Math.sin(a)*r,z=-180+Math.cos(a)*r;const stone=sphere(.6+i%4*.16,0x797f76,x,.32,z);stone.scale.y=.55}
for(let i=0;i<16;i++){const a=i*Math.PI/8;box(1.8,1.2+i%3,1.8,0x74776e,-285+Math.cos(a)*13,.8,-220+Math.sin(a)*13)}
const merchant=new T.Group();merchant.position.set(-3,0,7);scene.add(merchant);
const trader=buildHumanoid(T,merchant,{skin:0xd8a57e,shirt:0x704c77,pants:0x514638,hairColor:0x30231f,hair:'Long'});
// The shopkeeper uses the same skeleton as other NPCs, with a distinct apron and belt.
box(.54,.69,.045,0x9a7953,0,1.44,.225,merchant,'wood');box(.78,.12,.47,0x4b3428,0,1.01,0,merchant,'wood');
const mh=new T.Mesh(new T.SphereGeometry(.43,8,6),new T.MeshBasicMaterial({visible:false}));mh.position.set(0,1.45,0);merchant.add(mh);mh.userData={kind:'merchant',x:-3,z:7};targets.push(mh);
box(2.5,.25,1,0x805832,-3,1,9,scene,'wood');
const player=new T.Group();scene.add(player);const body=new T.Group();player.add(body);
const avatar=buildHumanoid(T,body,{skin:appearance.skin,shirt:appearance.shirt,pants:appearance.pants,hairColor:appearance.hairColor,hair:appearance.hair});
const {leftArm:la,rightArm:ra,leftLeg:ll,rightLeg:rl}=avatar;
const saved=JSON.parse(localStorage.getItem('eldervale-save')||localStorage.getItem('ashen-realms-save')||'{}');
const combat={hp:typeof saved.hp==='number'?Math.max(1,Math.min(100,saved.hp)):100,maxHp:100,xp:saved.combatXP||0,kills:saved.kills||0,attackTimer:0,respawnTimer:0};
const armorCatalog={
  helm:{name:'Iron full helm',slot:'Head',desc:'A sturdy iron helmet.'},
  chest:{name:'Iron platebody',slot:'Body',desc:'A solid iron breastplate.'},
  legs:{name:'Iron platelegs',slot:'Legs',desc:'Heavy iron leg protection.'},
  boots:{name:'Iron boots',slot:'Feet',desc:'Iron-plated boots.'}
};
const armorKeys=Object.keys(armorCatalog);
const state={wood:saved.wood||0,ore:saved.ore||0,gold:saved.gold||0,woodXP:saved.woodXP||0,miningXP:saved.miningXP||0,
armorOwned:Array.isArray(saved.armorOwned)?saved.armorOwned.filter(k=>armorCatalog[k]):[...armorKeys],
equipped:(saved.equipped&&typeof saved.equipped==='object')?saved.equipped:{}};
for(const k of armorKeys)if(state.equipped[k]&&!state.armorOwned.includes(k))state.armorOwned.push(k);
const armorVisual=new T.Group();body.add(armorVisual);
const iron=0x8b969e,trim=0xb7c2c8;
const pieces={
 helm:[box(.78,.44,.68,iron,0,2.55,0,armorVisual),box(.82,.12,.77,trim,0,2.37,.03,armorVisual)],
 chest:[box(1.08,.95,.7,iron,0,1.55,0,armorVisual),box(.94,.14,.76,trim,0,1.15,0,armorVisual)],
 legs:[box(.34,.77,.38,iron,0,-.40,0,ll),box(.34,.77,.38,iron,0,-.40,0,rl)],
 boots:[box(.4,.31,.54,trim,0,-.84,.09,ll),box(.4,.31,.54,trim,0,-.84,.09,rl)]
};
function refreshArmor(){for(const k of armorKeys)for(const m of pieces[k])m.visible=!!state.equipped[k]}
refreshArmor();
if(saved.x!==undefined)player.position.set(saved.x,0,saved.z);
const stats=document.querySelector('#stats'),inventory=document.querySelector('#inventory'),log=document.querySelector('#log'),equipment=document.querySelector('#equipment'),menu=document.querySelector('#contextmenu');
let activeTab='inventory',mapOpen=false;const mapCanvas=document.querySelector('#minimap'),largeMap=document.querySelector('#worldmap'),mapPanel=document.querySelector('#map-panel');
const mapCtx=mapCanvas.getContext('2d'),largeCtx=largeMap.getContext('2d');
const places=[['Oakcross',0,0],['Northwatch',-60,45],['Eastmarch',75,-55],['Old Cairn',132,26],['Farwatch',105,103],['Westmere',-210,145],['Suncrest',260,-185],['Greenwatch',225,215],['Ashen Ruins',-275,-215]];
function drawMap(ctx,canvas,scale){const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#536d4c';ctx.fillRect(0,0,w,h);const toX=x=>w/2+(x-(scale?0:player.position.x))*w/(scale?840:90),toY=z=>h/2+(z-(scale?0:player.position.z))*h/(scale?840:90);
ctx.strokeStyle='#a9936c';ctx.lineWidth=scale?4:3;const roads=[[[0,0],[-60,45]],[[0,0],[75,-55]],[[0,0],[105,103]],[[-60,45],[-105,-91]],[[-60,45],[-210,145]],[[75,-55],[260,-185]],[[105,103],[225,215]],[[-105,-91],[-275,-215]]];for(const [a,b] of roads){ctx.beginPath();ctx.moveTo(toX(a[0]),toY(a[1]));ctx.lineTo(toX(b[0]),toY(b[1]));ctx.stroke()}
for(const [name,x,z] of places){const px=toX(x),py=toY(z);if(px<0||px>w||py<0||py>h)continue;ctx.fillStyle='#e6c988';ctx.beginPath();ctx.arc(px,py,scale?5:4,0,Math.PI*2);ctx.fill();if(scale){ctx.font='13px Georgia';ctx.fillText(name,px+8,py-5)}}
ctx.fillStyle='#f5f5e4';ctx.strokeStyle='#18281d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(toX(player.position.x),toY(player.position.z),5,0,Math.PI*2);ctx.fill();ctx.stroke()}
document.querySelector('#map-toggle').onclick=()=>{mapOpen=!mapOpen;mapPanel.hidden=!mapOpen;if(mapOpen)drawMap(largeCtx,largeMap,true)};
document.querySelector('#map-close').onclick=()=>{mapOpen=false;mapPanel.hidden=true};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();closeDialog();mapOpen=false;mapPanel.hidden=true}if(e.key.toLowerCase()==='m'&&!e.repeat){mapOpen=!mapOpen;mapPanel.hidden=!mapOpen;if(mapOpen)drawMap(largeCtx,largeMap,true)}});
document.addEventListener('contextmenu',e=>{if(e.target.closest('#game-ui')||e.target===renderer.domElement)e.preventDefault()});
// Animated ground-click markers: amber for walking and crimson for interactions.
const markers=[];function markClick(x,z,kind='walk'){const group=new T.Group();group.position.set(x,.11,z);const color=kind==='walk'?0xffd05b:0xe64c46;const ring=new T.Mesh(new T.RingGeometry(.45,.62,32),new T.MeshBasicMaterial({color,transparent:true,opacity:.95,side:T.DoubleSide,depthWrite:false}));ring.rotation.x=-Math.PI/2;group.add(ring);const dot=new T.Mesh(new T.CircleGeometry(.12,20),new T.MeshBasicMaterial({color,transparent:true,opacity:.85,side:T.DoubleSide,depthWrite:false}));dot.rotation.x=-Math.PI/2;dot.position.y=.005;group.add(dot);scene.add(group);markers.push({group,ring,dot,age:0});}
const npcProfiles=[
{name:'Edda the Guide',role:'guide',x:3,z:3,color:0x4b6d8d,lines:['Welcome to Eldervale, traveler. These roads lead to villages and forgotten ruins.','Gather wood and ore to earn gold. Explore beyond Oakcross to discover more of our world.']},
{name:'Sir Rowan',role:'guard',x:8,z:-1,color:0x9a9da6,lines:['Keep your blade ready beyond the village. The roads are safer than the wilderness.','Northwatch lies northwest. Its watchmen always need supplies.']},
{name:'Mira the Herbalist',role:'herbalist',x:-8,z:4,color:0x548c66,lines:['The forests are alive with useful plants. We will need herbs for potions one day.','Be mindful of the old ruins. Some things are better left undisturbed.']},
{name:'Bram the Woodsman',role:'woodsman',x:-56,z:43,color:0x855f3c,lines:['The tall pines near Northwatch make fine timber.','I have spent years learning these forests.']},
{name:'Lysa the Scout',role:'scout',x:74,z:-51,color:0x74628b,lines:['Eastmarch is growing quickly. More adventurers arrive every day.','The eastern roads wind toward Suncrest.']},
{name:'Torren the Smith',role:'smith',x:102,z:99,color:0x806e65,lines:['Iron makes dependable armor, but a good smith can do far more.','Come back when crafting is ready and I will put that ore to work.']},
{name:'Fen the Ranger',role:'ranger',x:-208,z:146,color:0x3d7155,lines:['Westmere has the quietest woods in the realm.','Keep your eyes open for landmarks on your map.']},
{name:'Nara the Wanderer',role:'wanderer',x:258,z:-181,color:0x916d6d,lines:['Suncrest is a long way from Oakcross. You made it!','I hear the western ruins are older than the kingdoms themselves.']}
];
const npcs=[];
function spawnNPC(profile,index){
 const root=new T.Group();root.position.set(profile.x,0,profile.z);scene.add(root);
 const palettes=[0xc9916b,0xe0b48e,0x966247,0x67402f,0xb98362];
 const hairs=[0x39271f,0x6d4831,0xa17a4b,0x241e1d];
 const model=buildHumanoid(T,root,{skin:palettes[index%palettes.length],shirt:profile.color,pants:0x474442,hairColor:hairs[index%hairs.length],hair:['Short crop','Side swept','Spiky','Buzz cut','Long'][index%5]});
 // Clothing accents give each NPC a recognizable silhouette without changing the animation rig.
 if(index%3===0){box(.62,.11,.44,0x5e422d,0,1.07,0,root,'wood');box(.24,.16,.07,0xc5a46b,0,1.07,.245,root)}
 if(index%3===1){box(.52,.62,.045,0xb3a17b,0,1.48,.223,root,'cloth');box(.54,.12,.45,0x6b4c33,0,1.09,0,root,'wood')}
 if(index%3===2){const cape=box(.64,.84,.07,0x514f67,0,1.50,-.26,root,'cloth');cape.rotation.x=-.12}
 const hit=new T.Mesh(new T.SphereGeometry(.48,8,6),new T.MeshBasicMaterial({visible:false}));
 hit.position.set(0,1.42,0);root.add(hit);hit.userData={kind:'npc',profile,root};targets.push(hit);
 const npc={profile,root,leftArm:model.leftArm,rightArm:model.rightArm,leftLeg:model.leftLeg,rightLeg:model.rightLeg,home:new T.Vector3(profile.x,0,profile.z),goal:new T.Vector3(profile.x,0,profile.z),wait:2+index,phase:index};npcs.push(npc)
}
npcProfiles.forEach(spawnNPC);
// Wildlife and enemies use lightweight low-poly models and simple local AI.
const creatures=[];function creature(name,x,z,hostile=false){const root=new T.Group();root.position.set(x,0,z);scene.add(root);const fur=name==='Wolf'?0x646762:name==='Boar'?0x76553f:0x9a8062;box(.8,.65,1.3,fur,0,.65,0,root);sphere(.37,fur,0,.92,.73,root);for(const sx of [-.27,.27])for(const sz of [-.42,.42])box(.19,.52,.2,0x4e473a,sx,.26,sz,root);if(name==='Wolf'){for(const sx of [-.2,.2])cone(.15,.38,fur,sx,1.28,.7,root)}if(name==='Deer')cone(.18,.5,0xc5b28a,0,1.38,.75,root);const hit=new T.Mesh(new T.SphereGeometry(.48,8,6),new T.MeshBasicMaterial({visible:false}));hit.position.set(0,.95,.75);root.add(hit);const mob={name,root,home:new T.Vector3(x,0,z),goal:new T.Vector3(x,0,z),hp:hostile?36:20,maxHp:hostile?36:20,hostile,alive:true,wait:2,attackCooldown:0,respawn:0};hit.userData={kind:'creature',mob};targets.push(hit);mob.hit=hit;creatures.push(mob)}
for(let i=0;i<24;i++){const a=i*2.399,r=22+i*11;creature(i%5===0?'Wolf':i%3===0?'Boar':'Deer',Math.sin(a)*r,Math.cos(a)*r,i%5===0)}
const healthBar=document.querySelector('#health-fill'),combatNotice=document.querySelector('#combat-notice');
function combatMessage(msg){combatNotice.textContent=msg;combatNotice.hidden=false;clearTimeout(combatMessage.timer);combatMessage.timer=setTimeout(()=>combatNotice.hidden=true,1800)}
function strike(mob){if(!mob.alive||combat.attackTimer>0)return;combat.attackTimer=.85;const damage=6+Math.floor(Math.random()*7);mob.hp-=damage;combatMessage('You hit '+mob.name+' for '+damage+' damage');if(mob.hp<=0){mob.alive=false;mob.root.visible=false;mob.respawn=22;combat.kills++;combat.xp+=30;state.gold+=mob.hostile?8:2;combatMessage('Defeated '+mob.name+'! +30 combat XP');action=null;dest=null;save();draw()}}
function playerHit(mob){const defense=Object.values(state.equipped).filter(Boolean).length;const damage=Math.max(1,6+Math.floor(Math.random()*5)-defense);combat.hp=Math.max(0,combat.hp-damage);combatMessage(mob.name+' hits you for '+damage);draw();if(combat.hp<=0){combat.hp=100;player.position.set(0,0,0);dest=null;action=null;state.gold=Math.max(0,state.gold-10);combatMessage('You fell in battle and returned to Oakcross.');save();draw()}}

const dialog=document.querySelector('#dialog'),dialogName=document.querySelector('#dialog-name'),dialogText=document.querySelector('#dialog-text'),dialogNext=document.querySelector('#dialog-next');let conversation=null;
function closeDialog(){conversation=null;dialog.hidden=true}
function talkTo(profile){conversation={profile,index:0};dialog.hidden=false;dialogName.textContent=profile.name;showDialogLine()}
function showDialogLine(){if(!conversation)return;dialogText.textContent=conversation.profile.lines[conversation.index];dialogNext.textContent=conversation.index===conversation.profile.lines.length-1?'Close':'Continue'}
dialogNext.onclick=()=>{if(!conversation)return;if(++conversation.index>=conversation.profile.lines.length)closeDialog();else showDialogLine()};
function closeMenu(){menu.hidden=true;menu.innerHTML=''}
function showMenu(x,y,items){menu.innerHTML='';for(const [label,fn] of items){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{closeMenu();fn()};menu.append(b)}menu.hidden=false;menu.style.left=Math.min(x,innerWidth-190)+'px';menu.style.top=Math.min(y,innerHeight-180)+'px'}
function toggleArmor(k){if(!state.armorOwned.includes(k))return;state.equipped[k]=!state.equipped[k];refreshArmor();say((state.equipped[k]?'Equipped ':'Removed ')+armorCatalog[k].name);save();draw()}
function examine(k){say(armorCatalog[k].name+': '+armorCatalog[k].desc)}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;draw();closeMenu()});
document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))closeMenu()});
const level=x=>1+Math.floor(Math.sqrt(x/50));function draw(){
 stats.innerHTML='<p><strong>Health: '+Math.ceil(combat.hp)+' / '+combat.maxHp+'</strong><br>Combat: '+level(combat.xp)+' ('+combat.xp+' XP)<br>Defeated: '+combat.kills+'<br>Gold: '+state.gold+'<br>Woodcutting: '+level(state.woodXP)+' ('+state.woodXP+' XP)<br>Mining: '+level(state.miningXP)+' ('+state.miningXP+' XP)</p>';
 inventory.innerHTML='';equipment.innerHTML='';
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.tab===activeTab));
 inventory.hidden=activeTab!=='inventory';equipment.hidden=activeTab!=='equipment';
 const slots=[];
 for(const k of armorKeys)if(state.armorOwned.includes(k)&&!state.equipped[k])slots.push({kind:'armor',key:k});
 for(let i=0;i<state.wood;i++)slots.push({kind:'log'});
 for(let i=0;i<state.ore;i++)slots.push({kind:'ore'});
 for(let i=0;i<16;i++){
  const item=slots[i],d=document.createElement('button');d.className='slot';
  if(item){const icon=document.createElement('span');icon.className='item-icon';icon.setAttribute('aria-hidden','true');icon.innerHTML=item.kind==='armor'?({helm:'<svg viewBox="0 0 48 48"><path d="M10 26V19Q10 5 24 5T38 19V26L33 37H28V25H20V37H15Z" fill="#a9b5bb" stroke="#e4d6a9" stroke-width="2"/><path d="M13 22H35" stroke="#5d6972" stroke-width="4"/></svg>',chest:'<svg viewBox="0 0 48 48"><path d="M14 5L6 14L11 26L16 23V42H32V23L37 26L42 14L34 5L28 10H20Z" fill="#9daeb8" stroke="#d8d5bd" stroke-width="2"/><path d="M16 16L24 22L32 16M24 22V39" stroke="#566a76" stroke-width="3"/></svg>',legs:'<svg viewBox="0 0 48 48"><path d="M12 5H36L33 42H25L24 22L23 42H15Z" fill="#a1adb4" stroke="#e4d6a9" stroke-width="2"/><path d="M13 14H35" stroke="#64717b" stroke-width="4"/></svg>',boots:'<svg viewBox="0 0 48 48"><path d="M9 7H20V29L25 34V41H5V34L9 27ZM28 7H39V29L44 34V41H24V34L28 27Z" fill="#7e8d96" stroke="#c3bfa7" stroke-width="2"/></svg>'})[item.key]:item.kind==='log'?'<svg viewBox="0 0 48 48"><path d="M9 12L33 6L42 14L18 22Z" fill="#ad8050"/><path d="M9 12V32L18 40V22ZM18 22L42 14V33L18 40Z" fill="#765033" stroke="#c59a62" stroke-width="2"/><ellipse cx="18" cy="22" rx="5" ry="7" fill="#e1b980"/><ellipse cx="18" cy="22" rx="2.5" ry="4" fill="none" stroke="#9e6e40"/></svg>':'<svg viewBox="0 0 48 48"><path d="M6 35L13 15L27 8L42 23L36 40H14Z" fill="#84949a" stroke="#c2c5b4" stroke-width="2"/><path d="M13 15L26 24L42 23M26 24L20 38" fill="none" stroke="#586a73" stroke-width="3"/></svg>';d.append(icon);d.setAttribute('aria-label',item.kind==='armor'?armorCatalog[item.key].name:item.kind==='log'?'Log':'Ore');
   d.title=item.kind==='armor'?'Click to equip • Right-click for options':'Right-click for options';
   d.onclick=()=>{if(item.kind==='armor')toggleArmor(item.key)};
   d.oncontextmenu=e=>{e.preventDefault();showMenu(e.clientX,e.clientY,item.kind==='armor'?
    [['Equip '+armorCatalog[item.key].name,()=>toggleArmor(item.key)],['Examine',()=>examine(item.key)]]:
    [['Examine',()=>say(item.kind==='log'?'Freshly cut logs.':'Unrefined ore.')]])};
  }else{d.disabled=true}inventory.append(d);
 }
 for(const k of armorKeys){const item=document.createElement('button');item.className='equip-slot';
  item.textContent=armorCatalog[k].slot+': '+(state.equipped[k]?armorCatalog[k].name:'Empty');
  item.disabled=!state.equipped[k];item.title=state.equipped[k]?'Click to unequip • Right-click for options':'No item equipped';
  item.onclick=()=>toggleArmor(k);
  item.oncontextmenu=e=>{e.preventDefault();if(state.equipped[k])showMenu(e.clientX,e.clientY,[['Remove '+armorCatalog[k].name,()=>toggleArmor(k)],['Examine',()=>examine(k)]])};
  equipment.append(item);
 }
}
function say(s){const d=document.createElement('div');d.textContent=s;log.prepend(d)}function save(){localStorage.setItem('eldervale-save',JSON.stringify({...state,appearance,hp:combat.hp,combatXP:combat.xp,kills:combat.kills,x:player.position.x,z:player.position.z}));window.eldervaleSave?.()}
document.querySelector('#reset').onclick=()=>window.eldervaleReset?.();
let dest=null,action=null,yaw=.75,pitch=.8,zoom=24,drag=false,down=null;const ray=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),0);
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;down=[e.clientX,e.clientY];drag=false;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-down[0],dy=e.clientY-down[1];if(Math.abs(dx)+Math.abs(dy)>4)drag=true;if(drag){yaw-=dx*.007;pitch=T.MathUtils.clamp(pitch+dy*.004,.25,1.3)}down=[e.clientX,e.clientY]});
renderer.domElement.addEventListener('pointerup',e=>{if(!down)return;down=null;if(drag)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(targets,false);const point=new T.Vector3();const hitGround=ray.ray.intersectPlane(plane,point);
if(e.button===2){
 const choices=[];
 if(hits.length){const a=hits[0].object.userData;choices.push([a.kind==='creature'?'Attack '+a.mob.name:a.kind==='npc'?'Talk to '+a.profile.name:a.kind==='merchant'?'Trade with merchant':'Gather '+a.kind,()=>{action=a;dest=a.kind==='creature'?a.mob.root.position.clone():a.kind==='npc'?a.root.position.clone():new T.Vector3(a.x,0,a.z);markClick(dest.x,dest.z,'interact')}]);choices.push(['Examine '+a.kind,()=>say(a.kind==='creature'?a.mob.name+' ('+Math.max(0,a.mob.hp)+' HP)':a.kind==='npc'?a.profile.name+' — '+a.profile.role:a.kind==='merchant'?'A traveling trader who buys logs and ore.':'A harvestable '+a.kind+'.')])}
 if(hitGround)choices.push(['Walk here',()=>{dest=point.clone();action=null;closeDialog();markClick(dest.x,dest.z,'walk')}]);
 choices.push(['Cancel',()=>{}]);showMenu(e.clientX,e.clientY,choices);return;
}
if(hits.length){action=hits[0].object.userData;dest=action.kind==='creature'?action.mob.root.position.clone():action.kind==='npc'?action.root.position.clone():new T.Vector3(action.x,0,action.z);markClick(dest.x,dest.z,'interact');if(action.kind!=='npc')say(action.kind==='merchant'?'Walking to merchant...':'Approaching '+action.kind+'...')}else if(hitGround){dest=point.clone();action=null;closeDialog();markClick(dest.x,dest.z,'walk')}});
renderer.domElement.addEventListener('wheel',e=>{zoom=T.MathUtils.clamp(zoom+e.deltaY*.015,9,42)},{passive:true});
const clock=new T.Clock();let phase=0,blend=0,saveTick=0;
function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.05);let moving=false;
if(dest){const delta=dest.clone().sub(player.position);delta.y=0;const distance=delta.length();if(distance>(action?.kind==='creature'?2.4:action?2.1:.2)){moving=true;delta.normalize();player.position.addScaledVector(delta,Math.min(5*dt,distance));player.rotation.y=Math.atan2(delta.x,delta.z)}else{dest=null;if(action){const a=action;action=null;if(a.kind==='creature'){if(a.mob.alive){strike(a.mob);if(a.mob.alive){action=a;dest=a.mob.root.position.clone()}}}else if(a.kind==='npc'){talkTo(a.profile)}else if(a.kind==='merchant'){const earned=state.wood*3+state.ore*5;state.gold+=earned;state.wood=0;state.ore=0;say(earned?'Sold resources for '+earned+' gold!':'Merchant: Bring me logs or ore.')}else if(state.wood+state.ore+state.armorOwned.filter(k=>!state.equipped[k]).length>=16)say('Inventory full! Visit the merchant.');else if(a.kind==='tree'){state.wood++;state.woodXP+=25;say('You chop logs. +25 XP')}else{state.ore++;state.miningXP+=25;say('You mine ore. +25 XP')}save();draw()}}}
combat.attackTimer=Math.max(0,combat.attackTimer-dt);healthBar.style.width=(combat.hp/combat.maxHp*100)+'%';
for(const mob of creatures){if(!mob.alive){mob.respawn-=dt;if(mob.respawn<=0){mob.alive=true;mob.hp=mob.maxHp;mob.root.position.copy(mob.home);mob.root.visible=true}continue}mob.attackCooldown=Math.max(0,mob.attackCooldown-dt);mob.wait-=dt;if(mob.wait<=0){const a=mob.root.position.x*.12+performance.now()*.0002;mob.goal.set(mob.home.x+Math.cos(a)*5,0,mob.home.z+Math.sin(a)*5);mob.wait=3+Math.random()*5}const distance=mob.root.position.distanceTo(player.position);if(mob.hostile&&distance<10){mob.goal.copy(player.position);if(distance<2.3&&mob.attackCooldown===0){playerHit(mob);mob.attackCooldown=2.4}}const delta=mob.goal.clone().sub(mob.root.position);delta.y=0;if(delta.length()>.4){delta.normalize();mob.root.position.addScaledVector(delta,dt*(mob.hostile&&distance<10?1.7:.8));mob.root.rotation.y=Math.atan2(delta.x,delta.z)}if(action?.kind==='creature'&&action.mob===mob&&dest)dest.copy(mob.root.position)}
for(const marker of markers.slice()){marker.age+=dt;const t=marker.age/1.05;marker.group.scale.setScalar(.75+t*.95);marker.ring.material.opacity=Math.max(0,1-t);marker.dot.material.opacity=Math.max(0,1-t);if(t>=1){scene.remove(marker.group);marker.ring.geometry.dispose();marker.ring.material.dispose();marker.dot.geometry.dispose();marker.dot.material.dispose();markers.splice(markers.indexOf(marker),1)}}
for(const npc of npcs){npc.wait-=dt;if(npc.wait<=0){const a=npc.phase*2.4+npc.wait;npc.goal.set(npc.home.x+Math.cos(a)*3.2,0,npc.home.z+Math.sin(a)*3.2);npc.wait=4+(npc.phase%4)*1.3;npc.phase++}const d=npc.goal.clone().sub(npc.root.position);const walking=d.length()>.3;if(walking){d.normalize();npc.root.position.addScaledVector(d,dt*.55);npc.root.rotation.y=Math.atan2(d.x,d.z)}const gait=walking?Math.sin(performance.now()*.005+npc.phase)*.45:0;npc.leftLeg.rotation.x=gait;npc.rightLeg.rotation.x=-gait;npc.leftArm.rotation.x=-gait*.65+Math.sin(performance.now()*.001+npc.phase)*.035;npc.rightArm.rotation.x=gait*.65;if(action?.kind==='npc'&&action.root===npc.root&&dest)dest.copy(npc.root.position)}
blend=T.MathUtils.lerp(blend,moving?1:0,1-Math.exp(-12*dt));if(moving)phase+=dt*10;const swing=Math.sin(phase)*.65*blend;ll.rotation.x=swing;rl.rotation.x=-swing;la.rotation.x=-swing*.7;ra.rotation.x=swing*.7;body.position.y=Math.abs(Math.sin(phase))*.06*blend;
const focus=player.position;camera.position.set(focus.x+Math.sin(yaw)*zoom*Math.cos(pitch),zoom*Math.sin(pitch),focus.z+Math.cos(yaw)*zoom*Math.cos(pitch));camera.lookAt(focus.x,1,focus.z);saveTick+=dt;if(saveTick>4){saveTick=0;save()}renderer.render(scene,camera);if(Math.floor(performance.now()/250)!==window._mapFrame){window._mapFrame=Math.floor(performance.now()/250);drawMap(mapCtx,mapCanvas,false);if(mapOpen)drawMap(largeCtx,largeMap,true)}}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});draw();say('Welcome to Eldervale!');frame();