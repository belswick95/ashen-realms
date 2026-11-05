import {batchStaticMeshes} from './static-batch.js?v=release-20261105-walkanim64';
// Architectural detail for every town building, in the house's own frame
// (walls ±1.91 × ±1.83, eaves 3.12, ridge 4.40, door on +Z): half-timber
// framing or stone quoins, framed windows with sills, shutters and flower
// boxes, a door surround and step, tiled roof courses with ridge and barge
// boards, a capped chimney, and a hanging trade sign. Wall and roof detail
// are merged per material; roof detail joins roofParts so it hides with the
// roof indoors and rises with extra stories.
const signCache=new WeakMap(),glows=new WeakMap(),glasses=new WeakMap(),smokes=new WeakMap();
// Window glass reflects the sky by day and is lit from inside after dark.
function windowGlass(T){if(!glasses.has(T)){const m=new T.MeshStandardMaterial({color:0x6f8f9c,roughness:.18,metalness:.35,emissive:0xffb35c,emissiveIntensity:0});m.userData.eldervaleShared=true;m.onBeforeCompile=()=>{};glasses.set(T,m)}return glasses.get(T)}
function nightGlow(T,mesh){mesh.onBeforeRender=()=>{const m=windowGlass(T),want=globalThis.window?.eldervaleWorldNight?.95:0;m.emissiveIntensity+=(want-m.emissiveIntensity)*.05}}
// Chimney smoke: a few soft points rising and fading, animated on the GPU.
function chimneySmoke(T){if(smokes.has(T))return smokes.get(T);const n=10,pos=new Float32Array(n*3),phase=new Float32Array(n);for(let i=0;i<n;i++)phase[i]=i/n;
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(pos,3));geometry.setAttribute('phase',new T.BufferAttribute(phase,1));geometry.boundingSphere=new T.Sphere(new T.Vector3(0,1.5,0),3);geometry.userData.eldervaleShared=true;
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0}},
  vertexShader:'attribute float phase;uniform float time;varying float fade;void main(){float t=fract(time*.11+phase);vec3 p=position+vec3(sin(t*5.0+phase*20.0)*.18+t*.5,t*2.6,cos(t*4.0+phase*9.0)*.12);fade=smoothstep(0.0,.12,t)*(1.0-t);vec4 mv=modelViewMatrix*vec4(p,1.0);gl_PointSize=min(180.0,(520.0+t*1300.0)/-mv.z);gl_Position=projectionMatrix*mv;}',
  fragmentShader:'varying float fade;void main(){vec2 c=gl_PointCoord-.5;float d=length(c);if(d>.5)discard;gl_FragColor=vec4(vec3(.82,.8,.78),(1.0-d*2.0)*fade*.42);}'});
 material.userData.eldervaleShared=true;const entry={geometry,material};smokes.set(T,entry);return entry}
function glow(T){if(!glows.has(T)){const m=new T.MeshStandardMaterial({color:0xffd08a,emissive:0xffb35c,emissiveIntensity:1.3,roughness:.4});m.userData.eldervaleShared=true;glows.set(T,m)}return glows.get(T)}
const SHUTTERS=[0x3f6a55,0x3e5a7a,0x7a3b32,0x5d4a33,0x6c7a3f];
const FLOWERS=[0xd95a6b,0xf0c84a,0xf3efe4,0x9a6ad4,0xe0823a];
const hash=(x,z)=>{const s=Math.sin(x*12.9898+z*78.233)*43758.5453;return s-Math.floor(s)};

export function detailBuilding(T,record,{box,material,stone=false,color=0xc7bfa7,type='cottage',roof=0x634332}){
 const g=record.group,walls=new T.Group(),top=new T.Group();walls.name='building-detail';top.name='roof-detail';g.add(walls,top);
 const seed=hash(g.position.x,g.position.z),timber=0x4a3526,trim=stone?0xc9c3b1:timber;
 // Few materials per house: timber doubles as trim, planters and slats; two flower colours.
 const blooms=[FLOWERS[Math.floor(seed*5)%5],FLOWERS[(Math.floor(seed*5)+2)%5]];
 const b=(w,h,d,c,x,y,z,kind='wood',parent=walls)=>box(w,h,d,c,x,y,z,parent,kind);
 const front=1.925,side=2.005;
 // Walls: timber framing on plaster, quoins and courses on stone.
 if(!stone){
  for(const z of [front,-front]){b(3.9,.12,.06,timber,0,2.5,z);if(z>0)for(const s of [-1,1])b(.5,.12,.06,timber,s*1.68,2.97,z);else b(3.9,.12,.06,timber,0,2.97,z);if(z>0)for(const s of [-1,1])b(1.35,.12,.06,timber,s*1.27,.42,z);else b(3.9,.12,.06,timber,0,.42,z);
   const posts=z>0?[-.68,.68]:[-1.45,-.95,.95,1.45];for(const x of posts)b(.12,2.55,.06,timber,x,1.7,z);
   if(z<0)for(const [x,s] of [[-1.2,1],[1.2,-1]]){const brace=b(.09,1.05,.05,timber,x,.95,z);brace.rotation.z=s*.45}}
  for(const x of [side,-side]){for(const y of [.42,2.5,2.97])b(.06,.12,3.8,timber,x,y,0);for(const z of [-1.2,1.2])b(.06,2.55,.12,timber,x,1.7,z);for(const [z,s] of [[-1.55,1],[1.55,-1]]){const brace=b(.05,1.0,.09,timber,x,.95,z);brace.rotation.x=s*.32}}
 }else{
  const quoin=0xb8b3a3;for(const sx of [-1,1])for(const sz of [-1,1])for(let i=0;i<9;i++){const y=.25+i*.32,long=i%2===0;b(long?.5:.26,.28,.06,quoin,sx*(1.98-(long?.25:.13)),y,sz*1.95,'masonry');b(.06,.28,long?.26:.5,quoin,sx*2.03,y,sz*(1.9-(long?.13:.25)),'masonry')}
  for(const z of [front+.01,-front-.01])b(3.95,.16,.08,trim,0,2.98,z,'masonry');for(const x of [side+.01,-side-.01])b(.08,.16,3.85,trim,x,2.98,0,'masonry');
  for(const z of [front+.02,-front-.02])b(4.05,.32,.1,0x7d796e,0,.26,z,'masonry');for(const x of [side+.02,-side-.02])b(.1,.32,3.95,0x7d796e,x,.26,0,'masonry');
 }
 // Windows: frames, sills, shutters and flower boxes (front pair, one per side, one at the back).
 const shutter=SHUTTERS[Math.floor(seed*SHUTTERS.length)],glass=0x6f8f9c;
 const windowAt=(x,y,z,face)=>{const o=(dx,dy,dz,w,h,d,c,kind='wood')=>{const along=face==='x'?{x:x+dz*Math.sign(x),z:z+dx}:{x:x+dx,z:z+dz*Math.sign(z)};return b(face==='x'?d:w,h,face==='x'?w:d,c,along.x,y+dy,along.z,kind)};
  const pane=o(0,0,face==='z'&&z>0?.045:0,.72,.78,.03,glass,'stone');pane.material=windowGlass(T);pane.castShadow=false;
  for(const s of [-1,1]){o(s*.43,0,.03,.08,.92,.08,trim);o(0,s*.45,.03,.94,.08,.08,trim)}o(0,0,.04,.05,.78,.05,trim);o(0,.05,.04,.72,.04,.05,trim);
  o(0,-.52,.08,1.05,.07,.2,stone?0xb9b3a2:0x6b5038,stone?'masonry':'wood');
  for(const s of [-1,1]){o(s*.68,0,.04,.36,.86,.04,shutter);for(const dy of [-.28,0,.28])o(s*.68,dy,.07,.36,.03,.02,timber)}
  // Flower box under the sill.
  o(0,-.7,.14,.9,.2,.2,timber);o(0,-.6,.14,.86,.03,.16,0x3f2d20,'cloth');
  for(let i=0;i<7;i++){const fx=-.36+i*.12,c=blooms[i%2];o(fx,-.5+(i%2)*.04,.14+(i%3-1)*.04,.07,.07,.07,c,'cloth');o(fx+.04,-.55,.14,.05,.1,.05,0x4e7a3a,'cloth')}};
 for(const x of [-1.25,1.25])windowAt(x,1.92,1.95,'z');
 for(const x of [side,-side])windowAt(x,1.85,0,'x');
 windowAt(0,1.85,-1.95,'z');
 // Door surround, step and a lamp beside the door.
 for(const s of [-1,1])b(.13,2.0,.1,trim,s*.6,1.0,front+.03,stone?'masonry':'wood');b(1.36,.16,.12,trim,0,2.03,front+.03,stone?'masonry':'wood');
 b(1.5,.12,.55,0x8d887b,0,.06,2.2,'masonry');b(1.3,.1,.3,0x8d887b,0,.17,2.08,'masonry');
 b(.06,.06,.22,0x2b2e30,.88,2.25,front+.12,'stone');const lamp=b(.14,.2,.14,0xffd08a,.88,2.12,front+.2,'stone');lamp.material=glow(T);b(.18,.04,.18,0x2b2e30,.88,2.24,front+.2,'stone');
 // Trade sign on an iron bracket at the front corner.
 const sign=signFor(T,type);if(sign){b(.05,.05,.8,0x2b2e30,-1.75,2.72,front+.38,'stone');for(const x of [-1.86,-1.64])b(.015,.12,.015,0x2b2e30,x,2.62,front+.62,'stone');
  const board=new T.Mesh(new T.PlaneGeometry(.62,.5),sign);board.position.set(-1.75,2.32,front+.62);board.rotation.y=Math.PI/2;board.castShadow=true;walls.add(board);b(.66,.06,.06,0x4a3526,-1.75,2.58,front+.62)}
 // Awnings over shop windows.
 if(type==='inn'||type==='forge'||type==='bank'){const cloth=[0x8e3b30,0x3f6a55,0x405a83][Math.floor(seed*3)];for(const x of [-1.25,1.25]){const a=b(1.0,.04,.62,cloth,x,2.55,front+.26,'cloth');a.rotation.x=.42;for(let i=0;i<5;i++)b(.18,.1,.02,cloth,x-.4+i*.2,2.38,front+.54,'cloth')}}
 // Roof: tile courses, ridge cap, barge boards, rafter tails, chimney cap.
 const run=2.25,rise=1.28,len=Math.hypot(run,rise),angle=Math.atan2(rise,run),tile=new T.Color(roof).offsetHSL(0,0,-.04).getHex();
 for(const s of [-1,1]){const slope=new T.Group();slope.position.set(s*run/2,3.12+rise/2,0);slope.rotation.z=-s*angle;top.add(slope);
  for(let i=0;i<7;i++){const u=-len/2+.16+i*(len-.2)/7;b(len/7+.06,.05,4.42,tile,u,.1+i*.004,0,'roof',slope).rotation.z=s*.05}
  for(const z of [-2.21,2.21])b(len+.12,.2,.06,0x4a3526,0,.02,z,'wood',slope);
  for(let i=0;i<6;i++)b(.12,.1,.12,0x4a3526,s*(len/2-.05),-.12,-1.9+i*.76,'wood',slope)}
 const ridge=b(.26,.26,4.5,new T.Color(roof).offsetHSL(0,0,-.1).getHex(),0,4.43,0,'roof',top);ridge.rotation.z=Math.PI/4;
 b(.52,.09,.52,0x6e6a62,1.1,4.98,-.7,'masonry',top);for(const dx of [-.1,.1]){const pot=new T.Mesh(new T.CylinderGeometry(.06,.07,.22,8),material(0x9c5a3f,'masonry'));pot.position.set(1.1+dx,5.12,-.7);pot.castShadow=true;top.add(pot)}
 if(['cottage','inn','forge','home'].includes(type)){const smoke=chimneySmoke(T),puff=new T.Points(smoke.geometry,smoke.material);puff.position.set(1.1,5.15,-.7);puff.frustumCulled=true;puff.onBeforeRender=()=>{smoke.material.uniforms.time.value=performance.now()*.001};top.add(puff);puff.userData.keepSeparate=true}
 const live=top.children.filter(o=>o.isPoints);for(const o of live)o.removeFromParent();
 batchStaticMeshes(T,walls);batchStaticMeshes(T,top);for(const o of live)top.add(o);
 // Distance detail: beyond the fog line the plain shell is enough.
 const near=(object,far)=>{const lod=new T.LOD();lod.name=object.name+'-lod';g.add(lod);lod.addLevel(object,0);lod.addLevel(new T.Group(),far);return lod};
 const wallLod=near(walls,95),roofLod=near(top,130);record.roofParts.push(roofLod);void wallLod;
 const lit=walls.children.find(o=>o.material===windowGlass(T));if(lit)nightGlow(T,lit);
 return {walls,roof:top};
}

// Painted trade signs (canvas): anvil for forges, tankard for inns, coins
// for banks, a sheaf for homes; chapels go without.
function signFor(T,type){
 if(typeof document==='undefined'||type==='chapel')return null;let cache=signCache.get(T);if(!cache){cache=new Map();signCache.set(T,cache)}if(cache.has(type))return cache.get(type);
 const c=document.createElement('canvas');c.width=128;c.height=104;const x=c.getContext('2d');
 x.fillStyle='#5b3d26';x.fillRect(0,0,128,104);x.strokeStyle='#2f2015';x.lineWidth=6;x.strokeRect(3,3,122,98);for(let i=0;i<6;i++){x.fillStyle='rgba(0,0,0,.08)';x.fillRect(6,10+i*16,116,2)}
 x.fillStyle='#e8c46a';x.strokeStyle='#e8c46a';x.lineWidth=5;x.lineCap='round';
 if(type==='forge'){x.fillRect(34,40,62,14);x.beginPath();x.moveTo(96,40);x.lineTo(112,44);x.lineTo(96,50);x.fill();x.fillRect(52,54,26,14);x.fillRect(40,68,50,10);x.beginPath();x.moveTo(30,30);x.lineTo(58,18);x.stroke();x.fillRect(50,12,16,12)}
 else if(type==='inn'){x.fillRect(42,30,38,52);x.clearRect(48,36,26,40);x.fillStyle='#f3ead2';x.fillRect(48,36,26,40);x.fillStyle='#e8c46a';x.beginPath();x.arc(84,56,12,-Math.PI/2,Math.PI/2);x.stroke();x.fillStyle='#fffaf0';x.beginPath();x.ellipse(61,32,22,9,0,0,7);x.fill()}
 else if(type==='bank'){for(const [cx,cy] of [[44,62],[64,52],[84,62],[64,72]]){x.beginPath();x.ellipse(cx,cy,16,10,0,0,7);x.fill();x.strokeStyle='#9a7a2c';x.lineWidth=2;x.stroke()}}
 else{x.fillRect(60,26,8,56);for(const s of [-1,1])for(let i=0;i<4;i++){x.beginPath();x.ellipse(64+s*10,32+i*11,7,4,s*.6,0,7);x.fill()}x.fillRect(48,68,32,6)}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.userData.eldervaleShared=true;const m=new T.MeshStandardMaterial({map:t,roughness:.85,side:T.DoubleSide});m.userData.eldervaleShared=true;cache.set(type,m);return m;
}
