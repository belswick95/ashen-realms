import {batchStaticMeshes} from './static-batch.js?v=release-20261107-buildings149';
// Exterior dressing for every town building, in the house's own frame:
// walls are ±1.91 × ±1.83 (outer faces x=±2.00, z=±1.92), the floor top is
// .125, wall tops 3.0, eaves 3.12 and ridge 4.40, with the door on +Z.
//
// Each building gets ONE material style, picked deterministically from its
// role and a stable position seed (buildingStyle):
//  - stone:  masonry walls, dressed quoins, stone sills/lintels, slate or tile
//  - timber: plaster with dark timber framing, thatch or shingle roof
//  - plank:  board walls with corner boards, shingle roof
// Details are sparse and laid out so nothing overlaps: front windows sit
// between the door frame and the corners, shutters only on the wide side and
// back walls, one chimney, and a hanging sign only on inns and workshops.
// Wall and roof detail are merged per material and dropped with distance.
const signCache=new WeakMap(),glows=new WeakMap(),glasses=new WeakMap(),smokes=new WeakMap();
// Window glass reflects the sky by day and is lit from inside after dark.
function windowGlass(T){if(!glasses.has(T)){const m=new T.MeshStandardMaterial({color:0x5d7680,roughness:.2,metalness:.3,emissive:0xffb35c,emissiveIntensity:0});m.userData.eldervaleShared=true;glasses.set(T,m)}return glasses.get(T)}
function nightGlow(T,mesh){mesh.onBeforeRender=()=>{const m=windowGlass(T),want=globalThis.window?.eldervaleWorldNight?.95:0;m.emissiveIntensity+=(want-m.emissiveIntensity)*.05}}
// Chimney smoke: a few soft points rising and fading, animated on the GPU.
function chimneySmoke(T){if(smokes.has(T))return smokes.get(T);const n=10,pos=new Float32Array(n*3),phase=new Float32Array(n);for(let i=0;i<n;i++)phase[i]=i/n;
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.BufferAttribute(pos,3));geometry.setAttribute('phase',new T.BufferAttribute(phase,1));geometry.boundingSphere=new T.Sphere(new T.Vector3(0,1.5,0),3);geometry.userData.eldervaleShared=true;
 const material=new T.ShaderMaterial({transparent:true,depthWrite:false,uniforms:{time:{value:0}},
  vertexShader:'attribute float phase;uniform float time;varying float fade;void main(){float t=fract(time*.11+phase);vec3 p=position+vec3(sin(t*5.0+phase*20.0)*.18+t*.5,t*2.6,cos(t*4.0+phase*9.0)*.12);fade=smoothstep(0.0,.12,t)*(1.0-t);vec4 mv=modelViewMatrix*vec4(p,1.0);gl_PointSize=min(180.0,(520.0+t*1300.0)/-mv.z);gl_Position=projectionMatrix*mv;}',
  fragmentShader:'varying float fade;void main(){vec2 c=gl_PointCoord-.5;float d=length(c);if(d>.5)discard;gl_FragColor=vec4(vec3(.82,.8,.78),(1.0-d*2.0)*fade*.42);}'});
 material.userData.eldervaleShared=true;const entry={geometry,material};smokes.set(T,entry);return entry}

// Minimal colour maths without THREE, so the style is pure data.
class PaletteColor{constructor(hex){this.r=hex>>16&255;this.g=hex>>8&255;this.b=hex&255}lighter(k=.13){const f=v=>Math.round(v+(255-v)*k);return f(this.r)<<16|f(this.g)<<8|f(this.b)}}
const hash=(x,z)=>{const s=Math.sin(x*12.9898+z*78.233)*43758.5453;return s-Math.floor(s)};
const pick=(list,seed)=>list[Math.floor(seed*list.length)%list.length];
const STONE_TYPES=new Set(['bank','hall','chapel','forge','armory','castle','guild','guildhall','tower','keep','barracks','treasury','temple']);
const PLANK_TYPES=new Set(['barn','stable','shed','storehouse','mill','granary']);
const PALETTE={
 stone:{walls:[0xa9a497,0xb1a998,0x9fa09a,0xab9f8c],roof:{slate:[0x525d66,0x4a5459],tile:[0x8f4f3a,0x86503d]}},
 timber:{walls:[0xe0d6bf,0xdacdae,0xe0d9c8,0xd6c8a6],trim:[0x4a3526,0x4f3a2a],roof:{thatch:[0xa98c58,0x9e8453],shingle:[0x6a4b35,0x5f4733]}},
 plank:{walls:[0xa07c55,0x94714d],trim:[0x5a4130,0x523b2c],roof:{shingle:[0x5e4a3a,0x665041]}}
};
const SHUTTERS=[0x3f6a55,0x3e5a7a,0x7a3b32,0x5d6b3f];
// Deterministic material style for a building: role first, then a stable seed.
export function buildingStyle({type='cottage',x=0,z=0,stone,biome}={}){
 const seed=hash(x,z),material=STONE_TYPES.has(type)?'stone':PLANK_TYPES.has(type)?'plank':['cottage','home'].includes(type)?(stone===true||(stone===undefined&&seed<.25)?'stone':seed>.8?'plank':'timber'):'timber';
 const p=PALETTE[material],roofKind=material==='stone'?(seed*7%1<.6?'slate':'tile'):material==='timber'?(['inn','shop','tavern'].includes(type)||seed*7%1<.45?'shingle':'thatch'):'shingle';
 // Desert towns build in warm sandstone under clay tiles; snow settles on every roof.
 const dry=biome==='dry'||biome==='desert',wall=material==='stone'&&dry?pick([0xc2ab86,0xb8a07c,0xc9b291],seed*3%1):pick(p.walls,seed*3%1);
 let roof=pick(p.roof[dry&&material==='stone'?'tile':roofKind],seed*13%1);if(biome==='snow')roof=0xd6dcdf;
 // Dressed stone is the same stone, a little lighter, so quoins read without glare.
 const trim=material==='stone'?new PaletteColor(wall).lighter():pick(p.trim,seed*5%1);
 return {material,stone:material==='stone',seed,type,wallKind:material==='stone'?'masonry':material==='plank'?'wood':'plaster',wall,trim,timber:0x47352a,
  roofKind,roof,roofTexture:roofKind==='thatch'&&biome!=='snow'?'thatch':'roof',roofThick:roofKind==='thatch'?.34:.16,shutter:pick(SHUTTERS,seed*11%1),
  flowers:material!=='stone'&&['cottage','home','inn'].includes(type)};
}
// Roof slabs: run the texture's courses along the ridge instead of down the slope.
export function ridgeAlignedUV(geometry){const uv=geometry.attributes.uv;for(let i=0;i<uv.count;i++){const u=uv.getX(i);uv.setX(i,uv.getY(i));uv.setY(i,u)}uv.needsUpdate=true;return geometry}

// The four outer faces. pos(u,y,o): u runs along the face, o outward from it.
// Front and back own the corners; side members stop at the end walls.
const FACES={
 front:{half:2.0,pos:(u,y,o)=>[u,y,1.92+o],dims:(w,h,d)=>[w,h,d],rot:(m,a)=>{m.rotation.z=a}},
 back:{half:2.0,pos:(u,y,o)=>[-u,y,-1.92-o],dims:(w,h,d)=>[w,h,d],rot:(m,a)=>{m.rotation.z=-a}},
 right:{half:1.92,pos:(u,y,o)=>[2.0+o,y,-u],dims:(w,h,d)=>[d,h,w],rot:(m,a)=>{m.rotation.x=a}},
 left:{half:1.92,pos:(u,y,o)=>[-2.0-o,y,u],dims:(w,h,d)=>[d,h,w],rot:(m,a)=>{m.rotation.x=-a}}
};

// One storey of facade (y 0..3 in `parent`): framing or quoins and windows.
function dressStorey(T,parent,style,{box,ground,type}){
 const b=(face,w,h,d,c,u,y,o,kind)=>{const f=FACES[face],[x,yy,z]=f.pos(u,y,o),[bw,bh,bd]=f.dims(w,h,d);return box(bw,bh,bd,c,x,yy,z,parent,kind)};
 const beam=(face,u1,y1,u2,y2,t,c,o,depth)=>{const m=b(face,Math.hypot(u2-u1,y2-y1),t,depth,c,(u1+u2)/2,(y1+y2)/2,o,'wood');FACES[face].rot(m,Math.atan2(y2-y1,u2-u1));return m};
 const timber=style.material==='timber',stone=style.stone,frameColor=stone?0x3d2e22:style.timber,wood=style.material==='plank'?style.trim:style.timber;
 const glassMeshes=[];
 // Window: glass, a frame with one mullion and transom, a sill, and either a
 // stone lintel or (on wide walls) a pair of open shutters.
 const windowAt=(face,u,yc,w,h,{shutters=false,flowers=false}={})=>{
  const glass=b(face,w,h,.02,0x5d7680,u,yc,.015,'stone');glass.material=windowGlass(T);glass.castShadow=false;glassMeshes.push(glass);
  for(const s of [-1,1]){b(face,.06,h+.12,.07,frameColor,u+s*(w/2+.03),yc,.025,'wood');b(face,w,.06,.07,frameColor,u,yc+s*(h/2+.03),.025,'wood')}
  b(face,.04,h,.035,frameColor,u,yc,.0325,'wood');b(face,w,.04,.035,frameColor,u,yc+h*.12,.0325,'wood');
  const bottom=yc-h/2-.06;
  if(stone){b(face,w+.26,.08,.12,style.trim,u,bottom-.04,.05,'masonry');b(face,w+.24,.14,.07,style.trim,u,yc+h/2+.06+.07,.025,'masonry')}
  else b(face,w+.18,.05,.1,wood,u,bottom-.025,.04,'wood');
  if(shutters)for(const s of [-1,1])b(face,.27,h+.04,.04,style.shutter,u+s*(w/2+.06+.155),yc,.012,'wood');
  // Flower box hung under the sill: a low hedge of leaves dotted with two colours.
  if(flowers){const fb=bottom-.05-.1,blooms=[0xd95a6b,0xf0c84a,0xf3efe4,0x9a6ad4],c1=pick(blooms,style.seed*17%1),c2=pick(blooms,(style.seed*17+.5)%1);
   b(face,w+.1,.16,.17,0x5a4130,u,fb,.075,'wood');b(face,w,.07,.13,0x4f7d3c,u,fb+.105,.075,'cloth');
   for(let i=0;i<7;i++){const x=u-w/2+.06+i*(w-.12)/6,up=(i%2)*.025;b(face,.06,.06,.06,i%2?c1:c2,x,fb+.16+up,.06+((i*3)%3)*.025,'cloth')}}
 };
 const front=true,winW=stone?.62:.7,frontU=stone?1.2:1.25,winY=ground?1.8:1.62,winH=type==='chapel'&&ground?1.0:.8,frontY=type==='chapel'&&ground?1.75:winY;
 // Walls: framing, boards or quoins.
 if(timber){
  const post=(face,u,y1,y2,w=.14)=>b(face,w,y2-y1,.065,wood,u,(y1+y2)/2,.0225,'wood'),rail=(face,u1,u2,y,h=.09)=>b(face,Math.abs(u2-u1),h,.06,wood,(u1+u2)/2,y,.02,'wood');
  const top=2.98,sill=ground?1.24:1.06,head=ground?2.4:2.22;
  // Upper sole plates straddle the floor line and hide the storey seam.
  const soleY=ground?.07:0;
  for(const face of ['front','back']){post(face,-1.955,0,top,.19);post(face,1.955,0,top,.19);rail(face,-1.86,1.86,soleY,.14);rail(face,-1.86,1.86,head)}
  for(const face of ['right','left']){post(face,-1.8425,0,top,.125);post(face,1.8425,0,top,.125);rail(face,-1.78,1.78,soleY,.14);rail(face,-1.78,1.78,head)}
  if(ground){if(!style.flowers)for(const s of [-1,1])rail('front',s*.64,s*1.86,sill)}
  else{rail('front',-1.86,1.86,sill);for(const s of [-1,1])post('front',s*.6,.14,2.98)}
  // Side and back walls: a single centred window between two studs, a
  // brace in each lower panel tying the sole plate to the rail.
  for(const face of ['back','right','left']){const edge=face==='back'?1.86:1.78;rail(face,-edge,edge,sill);
   for(const s of [-1,1]){post(face,s*.85,.14,2.98);beam(face,s*(edge-.02),.15,s*.93,sill-.05,.11,wood,.0175,.055)}}
  // Gable: a king post and two struts in the plaster triangle (single storey
  // gables are part of the roof and are dressed there).
 }else if(stone){
  // Dressed quoins: alternating long and short blocks on each corner.
  for(let i=0;i<8;i++){const y=.18+i*.35,long=i%2===0;
   for(const face of ['front','back'])for(const s of [-1,1]){const L=long?.34:.2;b(face,L,.31,.045,style.trim,s*(2.045-L/2),y,.0125,'masonry')}
   for(const face of ['right','left'])for(const s of [-1,1]){const L=long?.2:.34;b(face,L,.31,.055,style.trim,s*(1.905-L/2),y,.0175,'masonry')}}
  if(!ground)for(const face of ['front','back'])b(face,4.0-.72,.12,.05,style.trim,0,.04,.015,'masonry');
  if(!ground)for(const face of ['right','left'])b(face,3.82-.72,.12,.05,style.trim,0,.04,.015,'masonry');
 }else{
  // Plank walls: corner boards and a skirting board.
  for(const face of ['front','back'])for(const s of [-1,1])b(face,.19,2.98,.05,style.trim,s*1.955,1.49,.015,'wood');
  for(const face of ['right','left'])for(const s of [-1,1])b(face,.125,2.98,.05,style.trim,s*1.8425,1.49,.015,'wood');
 }
 // Windows: two on the front, one centred on each other wall.
 if(front)for(const s of [-1,1])windowAt('front',s*frontU,frontY,winW,winH,{flowers:ground&&style.flowers});
 const sideShutters=style.material!=='stone'||['cottage','home'].includes(type);
 for(const face of ['back','right','left'])windowAt(face,0,winY,.7,.8,{shutters:sideShutters});
 return glassMeshes;
}

export function detailBuilding(T,record,{box,material,style,stone=false,type='cottage',roof=0x634332}){
 const g=record.group,walls=new T.Group(),top=new T.Group(),far=new T.Group();walls.name='building-detail';top.name='roof-detail';
 style??=buildingStyle({type,x:g.position.x,z:g.position.z,stone});
 record.style=style;
 const b=(w,h,d,c,x,y,z,kind='wood',parent=walls)=>box(w,h,d,c,x,y,z,parent,kind);
 const glass=dressStorey(T,walls,style,{box,ground:true,type});
 const stoneLook=style.stone,trimKind=stoneLook?'masonry':'wood',trim=stoneLook?style.trim:style.material==='plank'?style.trim:style.timber;
 // Door: frame around the leaf (opening is ±.52 wide and filled above 1.78)
 // and one low step in front of it.
 if(type==='bank'){for(const s of [-1,1]){b(.18,2.0,.12,style.trim,s*.64,1.1,1.96,'masonry');b(.26,.12,.18,style.trim,s*.64,.16,1.98,'masonry')}b(1.62,.2,.16,style.trim,0,2.2,1.98,'masonry');b(1.74,.06,.2,style.trim,0,2.33,1.99,'masonry')}
 else{for(const s of [-1,1])b(.12,1.86,.07,trim,s*.58,.99,1.95,trimKind);b(1.36,stoneLook?.16:.13,.08,trim,0,stoneLook?1.86:1.845,1.955,trimKind);if(stoneLook)b(.18,.2,.1,style.trim,0,1.9,1.97,'masonry')}
 b(1.3,.12,.3,0x8d887b,0,.06,2.13,'masonry');
 // Timber gables: king post and struts on the front and back triangles.
 if(style.material==='timber')for(const [face,zo] of [['front',1.945],['back',-1.945]]){const pz=zo;b(.14,1.08,.05,style.timber,0,3.68,pz,'wood',top);for(const s of [-1,1]){const x1=s*1.25,y1=3.2,x2=s*.07,y2=3.9,m=b(Math.hypot(x2-x1,y2-y1),.11,.045,style.timber,(x1+x2)/2,(y1+y2)/2,pz,'wood',top);m.rotation.z=Math.atan2(y2-y1,x2-x1)}void face}
 // Trade sign on an iron bracket at the front-left corner (inns and workshops).
 const sign=['inn','forge','shop','tavern'].includes(type)?signFor(T,type):null;
 if(sign){b(.05,.05,.78,0x2b2e30,-1.96,2.62,2.33,'stone');b(.04,.3,.04,0x2b2e30,-1.96,2.47,1.99,'stone');
  for(const z of [2.14,2.58])b(.015,.12,.015,0x2b2e30,-1.96,2.54,z,'stone');
  const board=new T.Mesh(new T.PlaneGeometry(.58,.47),sign);board.position.set(-1.96,2.24,2.36);board.rotation.y=Math.PI/2;board.castShadow=true;walls.add(board);}
 // Roof: ridge cap, barge boards along the gable verges, a capped chimney.
 const run=2.25,rise=1.28,len=Math.hypot(run,rise),angle=Math.atan2(rise,run),thick=style.roofThick||.16,lift=thick/2/Math.cos(angle)+(thick-.16)/2/Math.cos(angle);
 const ridgeColor=new T.Color(style.roof).offsetHSL(0,0,style.roofKind==='thatch'?-.08:-.06).getHex();
 const ridgeSize=style.roofKind==='thatch'?.4:.24,ridge=b(ridgeSize,ridgeSize,style.roofKind==='thatch'?4.5:4.38,ridgeColor,0,4.40+lift-ridgeSize*.42,0,style.roofTexture,top);ridge.rotation.z=Math.PI/4;
 if(style.roofKind!=='thatch')for(const s of [-1,1]){const slope=new T.Group();slope.position.set(s*run/2,3.12+rise/2,0);slope.rotation.z=-s*angle;top.add(slope);
  for(const z of [-2.205,2.205])b(len+.1,.15,.05,0x3f2e22,0,-.02,z,'wood',slope)}
 const chimney=type==='forge'?{x:-1.1,z:-1.05,top:5.3,w:.6}:['chapel','hall'].includes(type)?null:{x:1.1,z:-.7,top:5.05,w:.44};
 if(chimney){const h=chimney.top-3.5;b(chimney.w,h,chimney.w,stoneLook?style.wall:0x8a857a,chimney.x,3.5+h/2,chimney.z,'masonry',top);
  b(chimney.w+.12,.09,chimney.w+.12,0x6e6a62,chimney.x,chimney.top+.045,chimney.z,'masonry',top);
  for(const dx of [-.1,.1]){const pot=new T.Mesh(new T.CylinderGeometry(.06,.07,.2,8),material(0x9c5a3f,'masonry'));pot.position.set(chimney.x+dx,chimney.top+.19,chimney.z);pot.castShadow=true;top.add(pot)}
  if(['cottage','inn','forge','home'].includes(type)){const smoke=chimneySmoke(T),puff=new T.Points(smoke.geometry,smoke.material);puff.position.set(chimney.x,chimney.top+.25,chimney.z);puff.onBeforeRender=()=>{smoke.material.uniforms.time.value=performance.now()*.001};top.add(puff)}}
 // Far away only the window panes remain, so the shell still reads as a house.
 for(const m of glass){const copy=new T.Mesh(m.geometry.clone(),m.material);copy.position.copy(m.position);copy.rotation.copy(m.rotation);far.add(copy)}batchStaticMeshes(T,far);
 const live=top.children.filter(o=>o.isPoints);for(const o of live)o.removeFromParent();
 batchStaticMeshes(T,walls);batchStaticMeshes(T,top);for(const o of live)top.add(o);
 const lod=(object,levels)=>{const l=new T.LOD();l.name=object.name+'-lod';g.add(l);for(const [o,d] of levels)l.addLevel(o,d);return l};
 lod(walls,[[walls,0],[far,95],[new T.Group(),200]]);const roofLod=lod(top,[[top,0],[new T.Group(),130]]);record.roofParts.push(roofLod);
 const lit=walls.children.find(o=>o.material===windowGlass(T));if(lit)nightGlow(T,lit);
 // Upper storeys reuse the same facade rules inside their own shells.
 record.dressStorey=shell=>{const facade=new T.Group();facade.name='storey-detail';shell.add(facade);dressStorey(T,facade,style,{box,ground:false,type});batchStaticMeshes(T,facade);const m=facade.children.find(o=>o.material===windowGlass(T));if(m)nightGlow(T,m);return facade};
 return {walls,roof:top,style};
}

// Painted trade signs (canvas): anvil for workshops, tankard for inns.
function signFor(T,type){
 if(typeof document==='undefined')return null;let cache=signCache.get(T);if(!cache){cache=new Map();signCache.set(T,cache)}if(cache.has(type))return cache.get(type);
 const c=document.createElement('canvas');c.width=128;c.height=104;const x=c.getContext('2d');
 x.fillStyle='#5b3d26';x.fillRect(0,0,128,104);x.strokeStyle='#2f2015';x.lineWidth=6;x.strokeRect(3,3,122,98);for(let i=0;i<6;i++){x.fillStyle='rgba(0,0,0,.08)';x.fillRect(6,10+i*16,116,2)}
 x.fillStyle='#e8c46a';x.strokeStyle='#e8c46a';x.lineWidth=5;x.lineCap='round';
 if(type==='forge'){x.fillRect(34,40,62,14);x.beginPath();x.moveTo(96,40);x.lineTo(112,44);x.lineTo(96,50);x.fill();x.fillRect(52,54,26,14);x.fillRect(40,68,50,10);x.beginPath();x.moveTo(30,30);x.lineTo(58,18);x.stroke();x.fillRect(50,12,16,12)}
 else if(type==='inn'||type==='tavern'){x.fillRect(42,30,38,52);x.clearRect(48,36,26,40);x.fillStyle='#f3ead2';x.fillRect(48,36,26,40);x.fillStyle='#e8c46a';x.beginPath();x.arc(84,56,12,-Math.PI/2,Math.PI/2);x.stroke();x.fillStyle='#fffaf0';x.beginPath();x.ellipse(61,32,22,9,0,0,7);x.fill()}
 else{for(const [cx,cy] of [[44,62],[64,52],[84,62],[64,72]]){x.beginPath();x.ellipse(cx,cy,16,10,0,0,7);x.fill();x.strokeStyle='#9a7a2c';x.lineWidth=2;x.stroke()}}
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.userData.eldervaleShared=true;const m=new T.MeshStandardMaterial({map:t,roughness:.85,side:T.DoubleSide});m.userData.eldervaleShared=true;cache.set(type,m);return m;
}
