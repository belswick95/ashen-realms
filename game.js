import * as T from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
const scene=new T.Scene();scene.background=new T.Color(0x9dbbc2);scene.fog=new T.Fog(0x9dbbc2,105,255);
const camera=new T.PerspectiveCamera(55,innerWidth/innerHeight,.1,450),renderer=new T.WebGLRenderer({antialias:true});renderer.setSize(innerWidth,innerHeight);renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.shadowMap.enabled=true;document.body.prepend(renderer.domElement);
scene.add(new T.HemisphereLight(0xcfe4ff,0x5a4d33,2));const sun=new T.DirectionalLight(0xffe9b6,2.3);sun.position.set(12,25,8);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);scene.add(sun);
const material=c=>new T.MeshLambertMaterial({color:c}),targets=[];
renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.25;
function box(w,h,d,c,x,y,z,p=scene){const o=new T.Mesh(new T.BoxGeometry(w,h,d),material(c));o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;p.add(o);return o}
function sphere(r,c,x,y,z,p=scene){const o=new T.Mesh(new T.SphereGeometry(r,10,8),material(c));o.position.set(x,y,z);o.castShadow=true;p.add(o);return o}
function cone(r,h,c,x,y,z,p=scene){const o=new T.Mesh(new T.ConeGeometry(r,h,7),material(c));o.position.set(x,y,z);o.castShadow=true;p.add(o);return o}
const ground=new T.Mesh(new T.PlaneGeometry(420,420),material(0x69865b));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
function disk(r,c,x,z){const m=new T.Mesh(new T.CircleGeometry(r,28),material(c));m.rotation.x=-Math.PI/2;m.position.set(x,.018,z);scene.add(m)}
function trail(ax,az,bx,bz,width=2.7){const len=Math.hypot(bx-ax,bz-az);const m=new T.Mesh(new T.PlaneGeometry(width,len),material(0xa38b64));m.rotation.x=-Math.PI/2;m.rotation.z=Math.atan2(bx-ax,bz-az);m.position.set((ax+bx)/2,.025,(az+bz)/2);scene.add(m)}
trail(0,0,-60,45);trail(0,0,75,-55);trail(0,0,105,103);trail(-60,45,-105,-91);disk(13,0x81966a,0,0);
for(let i=0;i<480;i++){const a=i*2.399963,r=8+Math.sqrt(i)*9.1,x=Math.sin(a)*r,z=Math.cos(a)*r;if(Math.abs(x)<210&&Math.abs(z)<210){const g=box(.11,.14,.11,i%3?0x79955b:0x9baa70,x,.08,z);g.rotation.y=a}}
for(let i=0;i<38;i++){const a=i*2.4,r=17+i*3.8,x=Math.cos(a)*r,z=Math.sin(a)*r;if(Math.abs(x)<205&&Math.abs(z)<205){const stone=sphere(.3+i%3*.12,0x8d8e7c,x,.16,z);stone.scale.y=.5}}
function tree(x,z){const trunk=box(.58,3.6,.58,0x614a33,x,1.8,z);trunk.rotation.y=x*.3;const hit=cone(2.5,3.8,0x2b6544,x,3.9,z);hit.userData={kind:'tree',x,z};targets.push(hit);cone(2.05,3.2,0x397b4f,x,5.2,z);cone(1.35,2.7,0x4b8a54,x,6.35,z)}
function rock(x,z){const m=sphere(.9,0x777b78,x,.6,z);m.scale.set(1.2,.7,1);m.userData={kind:'rock',x,z};targets.push(m)}
function house(x,z,c){box(4,3,3.7,c,x,1.5,z);box(4.5,.2,4.1,0x685340,x,3.08,z);const roof=cone(3.4,2.3,0x644333,x,4.1,z);roof.rotation.y=Math.PI/4;box(.8,1.6,.13,0x493322,x,.8,z+1.9);box(.7,.7,.12,0x98b5bd,x+1.3,1.9,z+1.89);box(.14,.75,.16,0x644b33,x+1.3,1.9,z+1.98);box(.75,.13,.16,0x644b33,x+1.3,1.9,z+1.98);box(.4,1.2,.4,0x76665b,x+1.1,4.4,z-.7)}
for(let i=0;i<220;i++){const a=i*2.399,r=14+Math.sqrt(i)*11,x=Math.sin(a)*r,z=Math.cos(a)*r;if(i%4===0)rock(x,z);else tree(x,z)}
house(-7,-5,0xb8a480);house(7,-6,0x9d967f);house(8,7,0xc1aa82);house(-60,42,0xb7a08c);house(-54,48,0xaaa38a);house(73,-58,0xc3b29b);house(78,-51,0x99866c);house(-105,-91,0x9a9b87);house(102,103,0xb8a48d);
// Forest glades and distant ruins make the expanded wilderness feel distinct.
for(let i=0;i<16;i++){const a=i*Math.PI*2/16;box(1.6,1.1+(i%4)*.4,1.5,0x6d716b,132+Math.cos(a)*9,.7,26+Math.sin(a)*9)}
const merchant=new T.Group();merchant.position.set(-3,0,7);scene.add(merchant);box(.7,1.2,.4,0x6b3b6c,0,1.3,0,merchant);sphere(.34,0xd8a57e,0,2.2,0,merchant);const mh=box(.95,.15,.75,0x7e4c2d,0,2.72,0,merchant);mh.userData={kind:'merchant',x:-3,z:7};targets.push(mh);box(2.5,.25,1,0x805832,-3,1,9);
const player=new T.Group();scene.add(player);const body=new T.Group();player.add(body);
box(.76,1.04,.4,0x315b76,0,1.5,0,body);box(.89,.15,.51,0x62452c,0,1.04,0,body);box(.15,.18,.06,0xd2b36d,0,1.04,.29,body);
sphere(.29,0xd9a783,0,2.38,0,body);const hair=sphere(.31,0x3b2b22,0,2.63,-.05,body);hair.scale.y=.45;
sphere(.055,0x222222,-.14,2.43,.315,body);sphere(.055,0x222222,.14,2.43,.315,body);
function joint(x,y,w,h,c){const g=new T.Group();g.position.set(x,y,0);body.add(g);box(w,h,.3,c,0,-h/2,0,g);return g}
const la=joint(-.48,1.95,.23,.91,0x49738a),ra=joint(.48,1.95,.23,.91,0x49738a),ll=joint(-.21,1,.27,.86,0x424750),rl=joint(.21,1,.27,.86,0x424750);
box(.33,.27,.48,0x382b25,0,-.84,.07,ll);box(.33,.27,.48,0x382b25,0,-.84,.07,rl);
const saved=JSON.parse(localStorage.getItem('eldervale-save')||localStorage.getItem('ashen-realms-save')||'{}');
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
 legs:[box(.39,.78,.45,iron,-.23,-.43,0,ll),box(.39,.78,.45,iron,.23,-.43,0,rl)],
 boots:[box(.4,.31,.54,trim,0,-.84,.09,ll),box(.4,.31,.54,trim,0,-.84,.09,rl)]
};
function refreshArmor(){for(const k of armorKeys)for(const m of pieces[k])m.visible=!!state.equipped[k]}
refreshArmor();
if(saved.x!==undefined)player.position.set(saved.x,0,saved.z);
const stats=document.querySelector('#stats'),inventory=document.querySelector('#inventory'),log=document.querySelector('#log'),equipment=document.querySelector('#equipment'),menu=document.querySelector('#contextmenu');
let activeTab='inventory',mapOpen=false;const mapCanvas=document.querySelector('#minimap'),largeMap=document.querySelector('#worldmap'),mapPanel=document.querySelector('#map-panel');
const mapCtx=mapCanvas.getContext('2d'),largeCtx=largeMap.getContext('2d');
const places=[['Oakcross',0,0],['Northwatch',-60,45],['Eastmarch',75,-55],['Old Cairn',132,26],['Farwatch',105,103]];
function drawMap(ctx,canvas,scale){const w=canvas.width,h=canvas.height;ctx.clearRect(0,0,w,h);ctx.fillStyle='#536d4c';ctx.fillRect(0,0,w,h);const toX=x=>w/2+(x-(scale?0:player.position.x))*w/(scale?420:90),toY=z=>h/2+(z-(scale?0:player.position.z))*h/(scale?420:90);
ctx.strokeStyle='#a9936c';ctx.lineWidth=scale?4:3;const roads=[[[0,0],[-60,45]],[[0,0],[75,-55]],[[0,0],[105,103]],[[-60,45],[-105,-91]]];for(const [a,b] of roads){ctx.beginPath();ctx.moveTo(toX(a[0]),toY(a[1]));ctx.lineTo(toX(b[0]),toY(b[1]));ctx.stroke()}
for(const [name,x,z] of places){const px=toX(x),py=toY(z);if(px<0||px>w||py<0||py>h)continue;ctx.fillStyle='#e6c988';ctx.beginPath();ctx.arc(px,py,scale?5:4,0,Math.PI*2);ctx.fill();if(scale){ctx.font='13px Georgia';ctx.fillText(name,px+8,py-5)}}
ctx.fillStyle='#f5f5e4';ctx.strokeStyle='#18281d';ctx.lineWidth=2;ctx.beginPath();ctx.arc(toX(player.position.x),toY(player.position.z),5,0,Math.PI*2);ctx.fill();ctx.stroke()}
document.querySelector('#map-toggle').onclick=()=>{mapOpen=!mapOpen;mapPanel.hidden=!mapOpen;if(mapOpen)drawMap(largeCtx,largeMap,true)};
document.querySelector('#map-close').onclick=()=>{mapOpen=false;mapPanel.hidden=true};
document.addEventListener('keydown',e=>{if(e.key==='Escape'){closeMenu();mapOpen=false;mapPanel.hidden=true}if(e.key.toLowerCase()==='m'&&!e.repeat){mapOpen=!mapOpen;mapPanel.hidden=!mapOpen;if(mapOpen)drawMap(largeCtx,largeMap,true)}});
document.addEventListener('contextmenu',e=>{if(e.target.closest('#game-ui')||e.target===renderer.domElement)e.preventDefault()});
function closeMenu(){menu.hidden=true;menu.innerHTML=''}
function showMenu(x,y,items){menu.innerHTML='';for(const [label,fn] of items){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{closeMenu();fn()};menu.append(b)}menu.hidden=false;menu.style.left=Math.min(x,innerWidth-190)+'px';menu.style.top=Math.min(y,innerHeight-180)+'px'}
function toggleArmor(k){if(!state.armorOwned.includes(k))return;state.equipped[k]=!state.equipped[k];refreshArmor();say((state.equipped[k]?'Equipped ':'Removed ')+armorCatalog[k].name);save();draw()}
function examine(k){say(armorCatalog[k].name+': '+armorCatalog[k].desc)}
document.querySelectorAll('[data-tab]').forEach(b=>b.onclick=()=>{activeTab=b.dataset.tab;draw();closeMenu()});
document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))closeMenu()});
const level=x=>1+Math.floor(Math.sqrt(x/50));function draw(){
 stats.innerHTML='<p>Gold: '+state.gold+'<br>Woodcutting: '+level(state.woodXP)+' ('+state.woodXP+' XP)<br>Mining: '+level(state.miningXP)+' ('+state.miningXP+' XP)</p>';
 inventory.innerHTML='';equipment.innerHTML='';
 document.querySelectorAll('[data-tab]').forEach(b=>b.classList.toggle('selected',b.dataset.tab===activeTab));
 inventory.hidden=activeTab!=='inventory';equipment.hidden=activeTab!=='equipment';
 const slots=[];
 for(const k of armorKeys)if(state.armorOwned.includes(k)&&!state.equipped[k])slots.push({kind:'armor',key:k});
 for(let i=0;i<state.wood;i++)slots.push({kind:'log'});
 for(let i=0;i<state.ore;i++)slots.push({kind:'ore'});
 for(let i=0;i<16;i++){
  const item=slots[i],d=document.createElement('button');d.className='slot';
  if(item){d.textContent=item.kind==='armor'?armorCatalog[item.key].name:item.kind==='log'?'🪵 Log':'⛏ Ore';
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
function say(s){const d=document.createElement('div');d.textContent=s;log.prepend(d)}function save(){localStorage.setItem('eldervale-save',JSON.stringify({...state,x:player.position.x,z:player.position.z}))}
document.querySelector('#reset').onclick=()=>{localStorage.removeItem('eldervale-save');location.reload()};
let dest=null,action=null,yaw=.75,pitch=.8,zoom=24,drag=false,down=null;const ray=new T.Raycaster(),pointer=new T.Vector2(),plane=new T.Plane(new T.Vector3(0,1,0),0);
renderer.domElement.addEventListener('contextmenu',e=>e.preventDefault());
renderer.domElement.addEventListener('pointerdown',e=>{if(e.button!==0&&e.button!==2)return;down=[e.clientX,e.clientY];drag=false;renderer.domElement.setPointerCapture(e.pointerId)});
renderer.domElement.addEventListener('pointermove',e=>{if(!down)return;const dx=e.clientX-down[0],dy=e.clientY-down[1];if(Math.abs(dx)+Math.abs(dy)>4)drag=true;if(drag){yaw-=dx*.007;pitch=T.MathUtils.clamp(pitch+dy*.004,.25,1.3)}down=[e.clientX,e.clientY]});
renderer.domElement.addEventListener('pointerup',e=>{if(!down)return;down=null;if(drag)return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);ray.setFromCamera(pointer,camera);const hits=ray.intersectObjects(targets,false);const point=new T.Vector3();const hitGround=ray.ray.intersectPlane(plane,point);
if(e.button===2){
 const choices=[];
 if(hits.length){const a=hits[0].object.userData;choices.push([a.kind==='merchant'?'Trade with merchant':'Gather '+a.kind,()=>{action=a;dest=new T.Vector3(a.x,0,a.z)}]);choices.push(['Examine '+a.kind,()=>say(a.kind==='merchant'?'A traveling trader who buys logs and ore.':'A harvestable '+a.kind+'.')])}
 if(hitGround)choices.push(['Walk here',()=>{dest=point.clone();action=null}]);
 choices.push(['Cancel',()=>{}]);showMenu(e.clientX,e.clientY,choices);return;
}
if(hits.length){action=hits[0].object.userData;dest=new T.Vector3(action.x,0,action.z);say(action.kind==='merchant'?'Walking to merchant...':'Approaching '+action.kind+'...')}else if(hitGround){dest=point;action=null}});
renderer.domElement.addEventListener('wheel',e=>{zoom=T.MathUtils.clamp(zoom+e.deltaY*.015,9,42)},{passive:true});
const clock=new T.Clock();let phase=0,blend=0,saveTick=0;
function frame(){requestAnimationFrame(frame);const dt=Math.min(clock.getDelta(),.05);let moving=false;
if(dest){const delta=dest.clone().sub(player.position);delta.y=0;const distance=delta.length();if(distance>(action?2.1:.2)){moving=true;delta.normalize();player.position.addScaledVector(delta,Math.min(5*dt,distance));player.rotation.y=Math.atan2(delta.x,delta.z)}else{dest=null;if(action){const a=action;action=null;if(a.kind==='merchant'){const earned=state.wood*3+state.ore*5;state.gold+=earned;state.wood=0;state.ore=0;say(earned?'Sold resources for '+earned+' gold!':'Merchant: Bring me logs or ore.')}else if(state.wood+state.ore+state.armorOwned.filter(k=>!state.equipped[k]).length>=16)say('Inventory full! Visit the merchant.');else if(a.kind==='tree'){state.wood++;state.woodXP+=25;say('You chop logs. +25 XP')}else{state.ore++;state.miningXP+=25;say('You mine ore. +25 XP')}save();draw()}}}
blend=T.MathUtils.lerp(blend,moving?1:0,1-Math.exp(-12*dt));if(moving)phase+=dt*10;const swing=Math.sin(phase)*.65*blend;ll.rotation.x=swing;rl.rotation.x=-swing;la.rotation.x=-swing*.7;ra.rotation.x=swing*.7;body.position.y=Math.abs(Math.sin(phase))*.06*blend;
const focus=player.position;camera.position.set(focus.x+Math.sin(yaw)*zoom*Math.cos(pitch),zoom*Math.sin(pitch),focus.z+Math.cos(yaw)*zoom*Math.cos(pitch));camera.lookAt(focus.x,1,focus.z);saveTick+=dt;if(saveTick>4){saveTick=0;save()}renderer.render(scene,camera);if(Math.floor(performance.now()/250)!==window._mapFrame){window._mapFrame=Math.floor(performance.now()/250);drawMap(mapCtx,mapCanvas,false);if(mapOpen)drawMap(largeCtx,largeMap,true)}}
addEventListener('resize',()=>{camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight)});draw();say('Welcome to Eldervale!');frame();