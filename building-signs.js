// In-world building signs: hanging wooden signboards on iron brackets (shops, inns, smithies),
// wall plaques on civic buildings (keep, guilds, temple, banks) and signposts at town entrances.
// Cheap by design: one shared board/bracket/post geometry per style drawn with InstancedMesh
// (six draw calls for every sign in the world), one canvas atlas (2048x1024) holding 16 icon-only
// boards plus a pool of 16 lettered boards for the signs nearest the camera. Far signs show the
// icon only; past the view range they are dropped from the instance list. Sway runs in the vertex
// shader. Owner overrides come from the server (db/building-signs.sql) and are keyed by entity id.

// Signs swing harder in the wind (weather.js shared uniform).
import {weatherUniforms} from './weather.js?v=release-20261106-osrswalk124';

// ---------------------------------------------------------------- pure rules (tests/building-signs.test.js)
export const SIGN_ICONS=['anvil','loaf','potion','sword','shield','bow','staff','coin','mug','bed','fish','needle','pickaxe','bell','crown','hammer'];
export const SIGN_STYLES=['hanging','plaque','post'];
export const SIGN_PAINTS={oak:['#6b4423','#f3dfa6'],green:['#24402f','#f0d99b'],red:['#6a1f1c','#f6e3b0'],blue:['#1f3352','#f1e2b8'],black:['#1e1c1a','#e9c46a']};
const KEYWORDS=[
 [/bak|crust|bread|loaf|pastr/,'loaf'],[/apothec|herb|potion|mortar|alchem/,'potion'],[/blade|weapon|sword|arms\b/,'sword'],
 [/plate|mail|armou?r|shield/,'shield'],[/archer|fletch|bow|arrow/,'bow'],[/rune|magic|mage|wizard|arcan/,'staff'],
 [/bank|treasur|vault|coin/,'coin'],[/fish|angler|net\b/,'fish'],[/tailor|thread|needle|cloth|weav/,'needle'],
 [/tool|ore|deepvein|mine|quarr/,'pickaxe'],[/temple|chapel|church|shrine|bell/,'bell'],[/kitchen|refectory|cook/,'loaf'],
 [/warrior/,'sword'],[/craft|guild/,'hammer'],[/smith|forge|anvil|workshop/,'anvil'],[/keep|castle|palace|great hall|royal|throne/,'crown'],
 [/inn\b|tavern|antler|lodge|alehouse/,'mug'],[/hostel|rest\b|lodging/,'bed']];
const TYPE_ICONS={forge:'anvil',bank:'coin',inn:'mug',chapel:'bell',hall:'crown',kitchen:'loaf',shop:'sack'};
const CIVIC=new Set(['bank','hall','chapel']);
export function signIconFor({type='',name=''}={}){
 const n=String(name).toLowerCase();for(const [re,icon]of KEYWORDS)if(re.test(n))return icon;
 const t=TYPE_ICONS[type];return SIGN_ICONS.includes(t)?t:'hammer';
}
// Default sign for a building, before owner overrides. Homes and plain cottages get none.
export function defaultBuildingSign({type='',name=''}={}){
 const civic=CIVIC.has(type)||/keep|guild|temple|bank|treasur|great hall/i.test(name);
 const enabled=!!name&&!['home','cottage','armory',''].includes(type);
 const icon=signIconFor({type,name});
 return {text:String(name||'').slice(0,40),icon,style:civic?'plaque':'hanging',paint:civic?(icon==='coin'?'blue':icon==='bell'?'oak':'red'):'green',enabled};
}
export function cleanSign(input={},base=defaultBuildingSign()){
 const out={...base};if(!input||typeof input!=='object')return out;
 if(typeof input.text==='string')out.text=input.text.replace(/\s+/g,' ').trim().slice(0,40);
 if(SIGN_ICONS.includes(input.icon)||input.icon==='none')out.icon=input.icon;
 if(SIGN_STYLES.includes(input.style))out.style=input.style;
 if(SIGN_PAINTS[input.paint])out.paint=input.paint;
 if(typeof input.enabled==='boolean')out.enabled=input.enabled;
 for(const k of ['x','z','yaw'])if(Number.isFinite(input[k]))out[k]=input[k];
 if(Array.isArray(input.arms))out.arms=input.arms.slice(0,3).map(a=>({text:String(a?.text||'').slice(0,28),icon:SIGN_ICONS.includes(a?.icon)?a.icon:'none',toX:Number(a?.toX)||0,toZ:Number(a?.toZ)||0}));
 return out;
}
// Owner overrides: only non-empty rows apply (an emptied row means "back to the default").
export function applySignOverride(base,override){return override&&typeof override==='object'&&Object.keys(override).length?cleanSign(override,base):base}
// Signposts at town entrances. Birchford's gates come from the capital layout; arms point at the
// town itself and the road's destination. Coordinates are world metres (-z is north).
const CASTLE_EXIT={x:-340,z:-235},BIRCHFORD={x:-218,z:140},WINTERWATCH={x:217,z:-244},EMBERSPIRE={x:257,z:213};
const DESTINATIONS={'Castle Road':['Eldervale Castle','crown',CASTLE_EXIT],'Winterwatch Road':['Winterwatch','bell',WINTERWATCH],'Emberspire Road':['Emberspire','anvil',EMBERSPIRE],'Farm Lane':['Farmlands','loaf',{x:-300,z:156}]};
export function defaultSignposts(gates=[],{inward=()=>({x:0,z:1})}={}){
 const posts=[];
 for(const g of gates){const n=inward(g),out={x:-n.x,z:-n.z},side={x:-n.z,z:n.x};const x=+(g.x+out.x*6+side.x*4.2).toFixed(2),z=+(g.z+out.z*6+side.z*4.2).toFixed(2);
  const dest=DESTINATIONS[g.road];
  posts.push({id:'post:birchford-'+g.key,name:'Birchford '+g.name+' signpost',style:'post',paint:'oak',enabled:true,x,z,text:'Birchford',icon:'crown',
   arms:[{text:'Birchford',icon:'crown',toX:BIRCHFORD.x,toZ:BIRCHFORD.z},...(dest?[{text:dest[0],icon:dest[1],toX:dest[2].x,toZ:dest[2].z}]:[])]});}
 const towards=(from,to,d)=>{const dx=to.x-from.x,dz=to.z-from.z,l=Math.hypot(dx,dz)||1;return {x:+(from.x+dx/l*d).toFixed(2),z:+(from.z+dz/l*d).toFixed(2)}};
 const ww=towards(WINTERWATCH,BIRCHFORD,30),es=towards(EMBERSPIRE,BIRCHFORD,30);
 posts.push({id:'post:winterwatch',name:'Winterwatch signpost',style:'post',paint:'oak',enabled:true,...ww,text:'Winterwatch',icon:'bell',arms:[{text:'Winterwatch',icon:'bell',toX:WINTERWATCH.x,toZ:WINTERWATCH.z},{text:'Birchford',icon:'crown',toX:BIRCHFORD.x,toZ:BIRCHFORD.z},{text:'Emberspire',icon:'anvil',toX:EMBERSPIRE.x,toZ:EMBERSPIRE.z}]});
 posts.push({id:'post:emberspire',name:'Emberspire signpost',style:'post',paint:'oak',enabled:true,...es,text:'Emberspire',icon:'anvil',arms:[{text:'Emberspire',icon:'anvil',toX:EMBERSPIRE.x,toZ:EMBERSPIRE.z},{text:'Birchford',icon:'crown',toX:BIRCHFORD.x,toZ:BIRCHFORD.z},{text:'Winterwatch',icon:'bell',toX:WINTERWATCH.x,toZ:WINTERWATCH.z}]});
 posts.push({id:'post:castle',name:'Eldervale Castle signpost',style:'post',paint:'oak',enabled:true,x:-333.5,z:-231,text:'Eldervale Castle',icon:'crown',arms:[{text:'Eldervale Castle',icon:'crown',toX:-340,toZ:-305},{text:'Birchford',icon:'crown',toX:BIRCHFORD.x,toZ:BIRCHFORD.z}]});
 return posts;
}
export function customPosts(defaults=[],overrides={}){
 const out=[...defaults],known=new Set(defaults.map(p=>p.id));
 for(const [id,o]of Object.entries(overrides||{}))if(id.startsWith('post:')&&!known.has(id)&&o&&Number.isFinite(o.x)&&Number.isFinite(o.z))
  out.push({id,name:o.name||o.text||'Signpost',style:'post',paint:'oak',enabled:true,x:o.x,z:o.z,text:o.text||'',icon:o.icon||'none',arms:Array.isArray(o.arms)&&o.arms.length?o.arms:[{text:o.text||'Signpost',icon:o.icon||'none',toX:o.x+10,toZ:o.z}]});
 return out;
}
// Draw tier for a sign at distance d (metres) with the graphics preset's LOD factor k.
export const SIGN_TEXT_DISTANCE=24,SIGN_ICON_DISTANCE=140;
export function signTier(d,k=1){return d<SIGN_TEXT_DISTANCE*Math.max(.5,k)?'text':d<SIGN_ICON_DISTANCE*k?'icon':'hidden'}
// Lettering layout: one or two lines, the largest font size that fits.
export function wrapSignText(text,maxChars=16){
 const words=String(text||'').split(' ').filter(Boolean);if(!words.length)return [];
 if(String(text).length<=maxChars)return [words.join(' ')];
 let best=null;for(let i=1;i<words.length;i++){const a=words.slice(0,i).join(' '),b=words.slice(i).join(' '),w=Math.max(a.length,b.length);if(!best||w<best.w)best={w,lines:[a,b]}}
 return best?best.lines:[words.join(' ')];
}

// ---------------------------------------------------------------- icon painting (original vector art)
function iconPath(ctx,icon,s){
 const P=(cmds,fill,stroke='#1b120a',lw=s*.045)=>{ctx.beginPath();cmds();if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.lineWidth=lw;ctx.strokeStyle=stroke;ctx.stroke()}};
 const R=(x,y,w,h,f)=>P(()=>ctx.rect(x*s,y*s,w*s,h*s),f);
 const E=(x,y,rx,ry,f)=>P(()=>ctx.ellipse(x*s,y*s,rx*s,ry*s,0,0,Math.PI*2),f);
 const L=(pts,f,close=true)=>P(()=>{ctx.moveTo(pts[0][0]*s,pts[0][1]*s);for(const p of pts.slice(1))ctx.lineTo(p[0]*s,p[1]*s);if(close)ctx.closePath()},f);
 const steel='#c9d3d8',iron='#6f7b84',gold='#e8bb4a',wood='#9a6534',bread='#d9a05a';
 switch(icon){
  case 'anvil':L([[.12,.3],[.78,.3],[.9,.38],[.66,.42],[.6,.56],[.7,.7],[.3,.7],[.4,.56],[.34,.42],[.12,.4]],iron);R(.24,.7,.52,.1,'#4c555c');break;
  case 'loaf':P(()=>{ctx.moveTo(.12*s,.68*s);ctx.bezierCurveTo(.1*s,.28*s,.9*s,.28*s,.88*s,.68*s);ctx.closePath()},bread);for(const x of [.32,.5,.68])L([[x-.05,.42],[x+.05,.56]],null,false);break;
  case 'potion':L([[.42,.14],[.58,.14],[.58,.34],[.8,.6],[.74,.84],[.26,.84],[.2,.6],[.42,.34]],'#58b46a');R(.4,.08,.2,.08,'#8a5a2b');L([[.24,.62],[.76,.62]],null,false);break;
  case 'sword':L([[.5,.06],[.57,.16],[.57,.62],[.43,.62],[.43,.16]],steel);R(.28,.62,.44,.07,gold);R(.45,.69,.1,.16,wood);E(.5,.89,.07,.05,gold);break;
  case 'shield':P(()=>{ctx.moveTo(.5*s,.1*s);ctx.lineTo(.84*s,.2*s);ctx.lineTo(.8*s,.55*s);ctx.quadraticCurveTo(.72*s,.8*s,.5*s,.92*s);ctx.quadraticCurveTo(.28*s,.8*s,.2*s,.55*s);ctx.lineTo(.16*s,.2*s);ctx.closePath()},'#3d6fa8');L([[.5,.14],[.5,.86]],null,false);L([[.2,.42],[.8,.42]],null,false);break;
  case 'bow':P(()=>{ctx.moveTo(.3*s,.08*s);ctx.quadraticCurveTo(.9*s,.5*s,.3*s,.92*s)},null,'#7a4a20',s*.07);L([[.3,.08],[.3,.92]],null,false);L([[.14,.5],[.84,.5]],null,false);L([[.84,.5],[.74,.44],[.74,.56]],steel);L([[.14,.5],[.08,.44]],null,false);L([[.14,.5],[.08,.56]],null,false);break;
  case 'staff':L([[.36,.92],[.6,.3]],null,false);P(()=>{ctx.moveTo(.36*s,.92*s);ctx.lineTo(.6*s,.3*s)},null,wood,s*.07);E(.64,.2,.12,.12,'#7fc7ff');E(.6,.16,.04,.04,'#e8f7ff');break;
  case 'coin':E(.42,.62,.28,.12,'#8a6414');E(.42,.56,.28,.12,gold);E(.58,.42,.28,.12,'#8a6414');E(.58,.36,.28,.12,'#f2c94c');break;
  case 'mug':R(.22,.26,.44,.58,'#b07a3e');P(()=>{ctx.arc(.68*s,.52*s,.14*s,-Math.PI/2,Math.PI/2)},null,'#1b120a',s*.07);P(()=>{ctx.moveTo(.2*s,.3*s);ctx.bezierCurveTo(.2*s,.12*s,.68*s,.12*s,.68*s,.3*s);ctx.closePath()},'#fff4dc');L([[.3,.4],[.3,.76]],null,false);L([[.44,.4],[.44,.76]],null,false);L([[.58,.4],[.58,.76]],null,false);break;
  case 'bed':R(.1,.5,.8,.2,'#c0392b');R(.1,.38,.18,.32,'#e8dcc4');R(.08,.3,.06,.5,wood);R(.86,.44,.06,.36,wood);break;
  case 'fish':P(()=>{ctx.moveTo(.12*s,.5*s);ctx.quadraticCurveTo(.42*s,.2*s,.72*s,.5*s);ctx.quadraticCurveTo(.42*s,.8*s,.12*s,.5*s)},'#7fb2c9');L([[.7,.5],[.9,.34],[.9,.66]],'#5d8fa6');E(.24,.46,.03,.03,'#1b120a');break;
  case 'needle':L([[.18,.86],[.82,.14]],null,false);P(()=>{ctx.moveTo(.18*s,.86*s);ctx.lineTo(.82*s,.14*s)},null,steel,s*.05);E(.76,.21,.04,.025,'#2a1d10');P(()=>{ctx.moveTo(.76*s,.2*s);ctx.bezierCurveTo(.4*s,.1*s,.9*s,.6*s,.3*s,.62*s)},null,'#c0392b',s*.035);break;
  case 'pickaxe':P(()=>{ctx.moveTo(.42*s,.3*s);ctx.lineTo(.8*s,.9*s)},null,wood,s*.08);P(()=>{ctx.moveTo(.1*s,.36*s);ctx.quadraticCurveTo(.46*s,.06*s,.84*s,.22*s);ctx.lineTo(.8*s,.3*s);ctx.quadraticCurveTo(.46*s,.18*s,.16*s,.42*s);ctx.closePath()},steel);break;
  case 'bell':P(()=>{ctx.moveTo(.5*s,.12*s);ctx.bezierCurveTo(.26*s,.12*s,.28*s,.5*s,.18*s,.72*s);ctx.lineTo(.82*s,.72*s);ctx.bezierCurveTo(.72*s,.5*s,.74*s,.12*s,.5*s,.12*s)},gold);E(.5,.8,.07,.07,'#a8781e');R(.46,.06,.08,.07,'#a8781e');break;
  case 'crown':L([[.14,.72],[.14,.32],[.32,.5],[.5,.22],[.68,.5],[.86,.32],[.86,.72]],gold);R(.14,.7,.72,.1,'#c9932a');E(.5,.6,.05,.05,'#c0392b');E(.3,.62,.04,.04,'#3d6fa8');E(.7,.62,.04,.04,'#3d6fa8');break;
  case 'hammer':P(()=>{ctx.moveTo(.4*s,.34*s);ctx.lineTo(.78*s,.88*s)},null,wood,s*.08);L([[.14,.32],[.42,.12],[.62,.4],[.34,.6]],iron);break;
 }
}
export function drawSignIcon(ctx,icon,x,y,size){if(!SIGN_ICONS.includes(icon))return;ctx.save();ctx.translate(x,y);ctx.lineJoin='round';ctx.lineCap='round';iconPath(ctx,icon,size);ctx.restore()}

// ---------------------------------------------------------------- atlas
const ATLAS_W=2048,ATLAS_H=1024,TEXT_W=512,TEXT_H=192,ICON_W=256,ICON_H=96,TEXT_CELLS=16;
function paintBoard(ctx,x,y,w,h,paint){
 const [panel,ink]=SIGN_PAINTS[paint]||SIGN_PAINTS.green;
 ctx.save();ctx.fillStyle='#7a5230';ctx.fillRect(x,y,w,h);
 ctx.globalAlpha=.18;for(let i=0;i<9;i++){ctx.fillStyle=i%2?'#3b2410':'#c8945a';ctx.fillRect(x,y+h*(i+.3)/9,w,Math.max(1,h*.025))}ctx.globalAlpha=1;
 const m=Math.round(h*.09);ctx.fillStyle=panel;ctx.beginPath();ctx.roundRect?.(x+m,y+m,w-2*m,h-2*m,m*.8);if(!ctx.roundRect)ctx.rect(x+m,y+m,w-2*m,h-2*m);ctx.fill();
 ctx.lineWidth=Math.max(2,h*.025);ctx.strokeStyle=ink;ctx.globalAlpha=.55;ctx.beginPath();ctx.roundRect?.(x+m*1.5,y+m*1.5,w-3*m,h-3*m,m*.6);if(!ctx.roundRect)ctx.rect(x+m*1.5,y+m*1.5,w-3*m,h-3*m);ctx.stroke();ctx.globalAlpha=1;
 ctx.restore();return ink;
}
export function createSignAtlas(T){
 const canvas=document.createElement('canvas');canvas.width=ATLAS_W;canvas.height=ATLAS_H;const ctx=canvas.getContext('2d');
 const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;texture.userData.entityOwned=true;
 const iconCell=new Map();
 SIGN_ICONS.forEach((icon,i)=>{const x=(i%8)*ICON_W,y=TEXT_CELLS/4*TEXT_H+Math.floor(i/8)*ICON_H;iconCell.set(icon,i);paintBoard(ctx,x,y,ICON_W,ICON_H,'oak');drawSignIcon(ctx,icon,x+ICON_W/2-ICON_H*.42,y+ICON_H*.08,ICON_H*.84)});
 const pool=Array.from({length:TEXT_CELLS},(_,i)=>({i,key:null,used:0}));
 const rect=(x,y,w,h)=>[x/ATLAS_W,1-(y+h)/ATLAS_H,w/ATLAS_W,h/ATLAS_H];
 function drawText(cell,sign){
  const x=(cell.i%4)*TEXT_W,y=Math.floor(cell.i/4)*TEXT_H;ctx.clearRect(x,y,TEXT_W,TEXT_H);
  const ink=paintBoard(ctx,x,y,TEXT_W,TEXT_H,sign.paint);const icon=SIGN_ICONS.includes(sign.icon)?sign.icon:null;
  const iconSize=TEXT_H*.62,left=x+(icon?TEXT_H*.2+iconSize:TEXT_H*.18),right=x+TEXT_W-TEXT_H*.18;
  if(icon)drawSignIcon(ctx,icon,x+TEXT_H*.16,y+(TEXT_H-iconSize)/2,iconSize);
  const lines=wrapSignText(sign.text,icon?15:19),width=right-left;let size=lines.length>1?52:68;
  ctx.textAlign='center';ctx.textBaseline='middle';
  const font=s=>'700 '+s+'px Georgia, "Times New Roman", serif';
  for(;size>22;size-=2){ctx.font=font(size);if(lines.every(l=>ctx.measureText(l).width<=width))break}
  ctx.font=font(size);ctx.lineJoin='round';ctx.lineWidth=Math.max(3,size*.12);ctx.strokeStyle='#120b05';ctx.fillStyle=ink;
  lines.forEach((l,k)=>{const ly=y+TEXT_H/2+(k-(lines.length-1)/2)*size*1.05;ctx.strokeText(l,left+width/2,ly,width);ctx.fillText(l,left+width/2,ly,width)});
  texture.needsUpdate=true;
 }
 let clock=0;
 return {texture,canvas,
  iconRect(icon){const i=iconCell.get(icon)??iconCell.get('hammer');return rect((i%8)*ICON_W,TEXT_CELLS/4*TEXT_H+Math.floor(i/8)*ICON_H,ICON_W,ICON_H)},
  // A lettered cell for this sign, reusing the least recently wanted one; null when all are in use this round.
  textRect(sign,round){const key=sign.paint+'|'+sign.icon+'|'+sign.text;let cell=pool.find(c=>c.key===key);
   if(!cell){cell=pool.filter(c=>c.used<round).sort((a,b)=>a.used-b.used)[0];if(!cell)return null;cell.key=key;drawText(cell,sign)}
   cell.used=round;return rect((cell.i%4)*TEXT_W,Math.floor(cell.i/4)*TEXT_H,TEXT_W,TEXT_H)},
  nextRound(){return ++clock},
  dispose(){texture.dispose()}};
}

// ---------------------------------------------------------------- geometry helpers
function merge(T,parts){
 const geos=parts.map(g=>g.index?g.toNonIndexed():g);let n=0;for(const g of geos)n+=g.attributes.position.count;
 const pos=new Float32Array(n*3),nor=new Float32Array(n*3),uv=new Float32Array(n*2);let o=0;
 for(const g of geos){pos.set(g.attributes.position.array,o*3);nor.set(g.attributes.normal.array,o*3);if(g.attributes.uv)uv.set(g.attributes.uv.array,o*2);o+=g.attributes.position.count;g.dispose()}
 const out=new T.BufferGeometry();out.setAttribute('position',new T.BufferAttribute(pos,3));out.setAttribute('normal',new T.BufferAttribute(nor,3));out.setAttribute('uv',new T.BufferAttribute(uv,2));out.computeBoundingSphere();return out;
}
const box=(T,w,h,d,x=0,y=0,z=0,rx=0,ry=0,rz=0)=>{const g=new T.BoxGeometry(w,h,d);if(rx)g.rotateX(rx);if(ry)g.rotateY(ry);if(rz)g.rotateZ(rz);g.translate(x,y,z);return g};
// Front and back painted faces of a board w x h, thickness t; origin at the board centre.
// eps lifts the paint off the wood; for the unit board (scaled by its thickness) it is in board units.
function faceGeometry(T,w,h,t,y=0,eps=.004){const f=new T.PlaneGeometry(w,h);f.translate(0,y,t/2+eps);const b=new T.PlaneGeometry(w,h);b.rotateY(Math.PI);b.translate(0,y,-t/2-eps);return merge(T,[f,b])}
export const HANG={w:1.25,h:.47,t:.06,drop:.16},PLAQUE={w:1.7,h:.64,t:.07},ARM={w:1.35,h:.42,t:.06};

// Shader patch: per-instance sway about the board's hinge (local x axis through the origin) and
// per-instance atlas rectangle for the painted face.
function patch(material,{sway=false,atlas=false,time}){
 material.onBeforeCompile=s=>{
  s.uniforms.uSignTime=time;s.uniforms.weatherWind=weatherUniforms.weatherWind;
  s.vertexShader=(sway?'attribute vec2 aSway;\nuniform float uSignTime,weatherWind;\nvec3 signSway(vec3 p){float a=aSway.x*(1.+weatherWind*2.2)*(sin(uSignTime*1.25+aSway.y)+.35*sin(uSignTime*2.7+aSway.y*1.7));float c=cos(a),s=sin(a);return vec3(p.x,c*p.y-s*p.z,s*p.y+c*p.z);}\n':'')+(atlas?'attribute vec4 aUvRect;\n':'')+s.vertexShader;
  if(sway){s.vertexShader=s.vertexShader.replace('#include <beginnormal_vertex>','#include <beginnormal_vertex>\nobjectNormal=signSway(objectNormal);').replace('#include <begin_vertex>','#include <begin_vertex>\ntransformed=signSway(transformed);')}
  if(atlas)s.vertexShader=s.vertexShader.replace('#include <uv_vertex>','#include <uv_vertex>\n#ifdef USE_MAP\nvMapUv=aUvRect.xy+vMapUv*aUvRect.zw;\n#endif');
 };
 material.customProgramCacheKey=()=>'eldervale-sign-'+(sway?1:0)+(atlas?1:0);
}

// ---------------------------------------------------------------- renderer
export function createBuildingSigns(T,scene,{heightAt=()=>0,lodScale=()=>1,maxSigns=160}={}){
 const time={value:0},atlas=createSignAtlas(T);
 const wood=new T.MeshStandardMaterial({color:0x8a5a33,roughness:.86,metalness:0});
 const woodSway=wood.clone();patch(woodSway,{sway:true,time});
 const iron=new T.MeshStandardMaterial({color:0x2c2f33,roughness:.55,metalness:.6});
 const face=new T.MeshStandardMaterial({map:atlas.texture,roughness:.8,metalness:0});patch(face,{atlas:true,time});
 const faceSway=new T.MeshStandardMaterial({map:atlas.texture,roughness:.8,metalness:0});patch(faceSway,{atlas:true,sway:true,time});
 // Hanging board: hinge at the origin, board hangs below the rings.
 const hangY=-HANG.drop-HANG.h/2;
 const hangBoard=merge(T,[box(T,HANG.w,HANG.h,HANG.t,0,hangY,0),box(T,.04,HANG.drop,.04,-HANG.w*.36,-HANG.drop/2,0),box(T,.04,HANG.drop,.04,HANG.w*.36,-HANG.drop/2,0)]);
 const hangFace=faceGeometry(T,HANG.w*.94,HANG.h*.9,HANG.t,hangY);
 // Iron bracket: wall plate, arm out along +x, diagonal brace and a scroll tip.
 const armLen=HANG.w+.32;
 const bracket=merge(T,[box(T,.05,.42,.18,.025,-.12,0),box(T,armLen,.05,.05,armLen/2,0,0),box(T,Math.hypot(.7,.36),.04,.04,.37,-.18,0,0,0,Math.atan2(.36,.7)),box(T,.12,.12,.03,armLen-.02,.05,0,0,0,Math.PI/4)]);
 const unitBoard=new T.BoxGeometry(1,1,1),unitFace=faceGeometry(T,.94,.88,1,0,.08);
 // Signpost: post with a cap; arms are pointed boards (the point is the +x end).
 const post=merge(T,[box(T,.16,2.9,.16,0,1.45,0),box(T,.26,.08,.26,0,2.94,0),box(T,.3,.12,.3,0,.06,0)]);
 const armShape=new T.Shape();armShape.moveTo(-ARM.w/2,-ARM.h/2);armShape.lineTo(ARM.w/2-.16,-ARM.h/2);armShape.lineTo(ARM.w/2,0);armShape.lineTo(ARM.w/2-.16,ARM.h/2);armShape.lineTo(-ARM.w/2,ARM.h/2);armShape.closePath();
 const armGeo=new T.ExtrudeGeometry(armShape,{depth:ARM.t,bevelEnabled:false});armGeo.translate(0,0,-ARM.t/2);
 const armFace=faceGeometry(T,ARM.w-.24,ARM.h*.86,ARM.t);armFace.translate(-.08,0,0);
 const mk=(geo,mat,count,{rect=false,sway=false}={})=>{const m=new T.InstancedMesh(geo,mat,count);m.count=0;m.frustumCulled=false;m.castShadow=false;m.receiveShadow=true;m.userData.signs=true;m.matrixAutoUpdate=false;
  if(rect)geo.setAttribute('aUvRect',new T.InstancedBufferAttribute(new Float32Array(count*4),4));if(sway)geo.setAttribute('aSway',new T.InstancedBufferAttribute(new Float32Array(count*2),2));scene.add(m);return m};
 const meshes={hangBoard:mk(hangBoard,woodSway,maxSigns,{sway:true}),hangFace:mk(hangFace,faceSway,maxSigns,{rect:true,sway:true}),bracket:mk(bracket,iron,maxSigns),
  board:mk(unitBoard,wood,maxSigns),face:mk(unitFace,face,maxSigns*2,{rect:true}),post:mk(post,wood,32),arm:mk(armGeo,wood,96),armFace:mk(armFace,face,96,{rect:true})};
 const pending=[],buildings=[],posts=new Map();let defaultPosts=[];let overrides={},round=0,dirty=true,nextUpdate=0;const lastCam={x:NaN,z:NaN};
 const m4=new T.Matrix4(),q=new T.Quaternion(),v=new T.Vector3(),s1=new T.Vector3(1,1,1),sv=new T.Vector3(),yAxis=new T.Vector3(0,1,0);
 // ---- placements
 function buildingId(h){return h.realmId||'local:'+(h.name||'')}
 function place(h){
  const g=h.group;if(!g.parent)return null;g.updateMatrixWorld(true);
  const id=buildingId(h),base=defaultBuildingSign({type:h.type,name:h.name}),sign=applySignOverride(base,overrides[id]);
  const r=g.rotation.y,n={x:Math.sin(r),z:Math.cos(r)},sx=g.scale.x,sy=g.scale.y,sz=g.scale.z,ground=g.position.y;
  // Front wall face sits at local z ~1.93; the door (hinged at local x -0.52) spans -0.52..0.52.
  const wall=(lx,lz)=>({x:g.position.x+Math.cos(r)*lx*sx+Math.sin(r)*lz*sz,z:g.position.z-Math.sin(r)*lx*sx+Math.cos(r)*lz*sz});
  const doorTop=1.75*sy;
  // Plaques sit centred over the door, clear of the windows either side of it.
  if(sign.style==='plaque'){const k=Math.min(1.8,Math.max(1,sy*.5)),p=wall(0,1.94);return {id,house:h,sign,style:'plaque',x:p.x+n.x*.2,z:p.z+n.z*.2,y:ground+doorTop+.3+PLAQUE.h*k/2,yaw:r,scale:k}}
  // Hanging boards grow a little with big buildings and hang from just above the door's top.
  const k=Math.min(1.8,Math.max(1,sy*.6)),p=wall(.8,1.94);return {id,house:h,sign,style:'hanging',x:p.x,z:p.z,y:ground+Math.max(2.45,doorTop+.3*k),yaw:r-Math.PI/2,scale:k,phase:(Math.abs(p.x*7.3+p.z*3.1))%6.28};
 }
 function postEntry(base){const sign=applySignOverride(base,overrides[base.id]);const x=sign.x??base.x,z=sign.z??base.z;return {id:base.id,base,sign,style:'post',x,z,y:heightAt(x,z),arms:(sign.arms||base.arms||[]).slice(0,3)}}
 // ---- instance writing
 // Default signposts plus any the owner placed (override rows "post:..." with a position).
 function refreshPosts(){posts.clear();for(const p of customPosts(defaultPosts,overrides))posts.set(p.id,postEntry(p));dirty=true}
 function setRect(mesh,i,r){const a=mesh.geometry.attributes.aUvRect;a.array.set(r,i*4)}
 function setSway(mesh,i,amp,phase){const a=mesh.geometry.attributes.aSway;a.array[i*2]=amp;a.array[i*2+1]=phase}
 function write(entries,camera){
  const k=lodScale(),cam=camera.position;round=atlas.nextRound();
  const counts={hangBoard:0,hangFace:0,bracket:0,board:0,face:0,post:0,arm:0,armFace:0};
  // Lettered cells go to the nearest signs first.
  const list=entries.map(e=>({e,d:Math.hypot(e.x-cam.x,e.z-cam.z)})).sort((a,b)=>a.d-b.d);
  for(const {e,d}of list){
   if(!e.sign.enabled)continue;const tier=signTier(d,k);if(tier==='hidden')continue;
   const rectFor=s=>(tier==='text'&&atlas.textRect(s,round))||atlas.iconRect(SIGN_ICONS.includes(s.icon)?s.icon:'hammer');
   if(e.style==='hanging'){
    if(counts.hangBoard>=maxSigns)continue;
    q.setFromAxisAngle(yAxis,e.yaw);const i=counts.hangBoard++;
    // Bracket at the wall; the board hinge sits under the arm, centred on the board.
    const k=e.scale||1;sv.setScalar(k);m4.compose(v.set(e.x,e.y,e.z),q,sv);meshes.bracket.setMatrixAt(counts.bracket++,m4);
    const ox=Math.cos(e.yaw)*(.2+HANG.w/2)*k,oz=-Math.sin(e.yaw)*(.2+HANG.w/2)*k;
    m4.compose(v.set(e.x+ox,e.y-.03*k,e.z+oz),q,sv);meshes.hangBoard.setMatrixAt(i,m4);setSway(meshes.hangBoard,i,.05,e.phase);
    meshes.hangFace.setMatrixAt(i,m4);setSway(meshes.hangFace,i,.05,e.phase);setRect(meshes.hangFace,i,rectFor(e.sign));counts.hangFace++;
   }else if(e.style==='plaque'){
    if(counts.board>=maxSigns)continue;q.setFromAxisAngle(yAxis,e.yaw);
    m4.compose(v.set(e.x,e.y,e.z),q,sv.set(PLAQUE.w*e.scale,PLAQUE.h*e.scale,PLAQUE.t));meshes.board.setMatrixAt(counts.board++,m4);
    const i=counts.face++;meshes.face.setMatrixAt(i,m4);setRect(meshes.face,i,rectFor(e.sign));
   }else if(e.style==='post'){
    if(counts.post>=32)continue;q.identity();m4.compose(v.set(e.x,e.y,e.z),q,s1);meshes.post.setMatrixAt(counts.post++,m4);
    e.arms.forEach((a,j)=>{if(counts.arm>=96)return;const dx=a.toX-e.x,dz=a.toZ-e.z,yaw=Math.atan2(-dz,dx)||0;q.setFromAxisAngle(yAxis,yaw);
     const h=2.55-j*.5,off=ARM.w/2+.06;m4.compose(v.set(e.x+Math.cos(yaw)*off,e.y+h,e.z-Math.sin(yaw)*off),q,s1);meshes.arm.setMatrixAt(counts.arm++,m4);
     const i=counts.armFace++;meshes.armFace.setMatrixAt(i,m4);setRect(meshes.armFace,i,rectFor({...e.sign,text:a.text||e.sign.text,icon:a.icon&&a.icon!=='none'?a.icon:null}))});
   }
  }
  for(const [name,mesh]of Object.entries(meshes)){mesh.count=counts[name];mesh.instanceMatrix.needsUpdate=true;if(mesh.geometry.attributes.aUvRect)mesh.geometry.attributes.aUvRect.needsUpdate=true;if(mesh.geometry.attributes.aSway)mesh.geometry.attributes.aSway.needsUpdate=true}
 }
 const entries=()=>[...buildings.filter(b=>b.house.group.parent),...posts.values()];
 function rebuild(){
  for(let i=buildings.length-1;i>=0;i--)if(!buildings[i].house.group.parent)buildings.splice(i,1);
  while(pending.length){const h=pending.shift();const e=place(h);if(e){const old=buildings.findIndex(b=>b.house===h);if(old>=0)buildings[old]=e;else buildings.push(e)}}
 }
 return {
  meshes,atlas,
  addBuilding(house){if(house?.group&&house.type!=='armory'){pending.push(house);dirty=true}},
  setSignposts(list=[]){defaultPosts=list;refreshPosts()},
  setOverrides(rows={}){overrides=rows&&typeof rows==='object'?rows:{};for(const b of buildings)pending.push(b.house);refreshPosts()},
  // Rows for the owner console: id, building name and the sign as it shows now.
  list(){rebuild();return [...buildings.map(b=>({id:b.id,name:b.house.name,kind:'building',type:b.house.type,sign:b.sign,default:defaultBuildingSign({type:b.house.type,name:b.house.name}),x:b.x,z:b.z})),...[...posts.values()].map(p=>({id:p.id,name:p.base?.name||p.sign.text,kind:'post',sign:p.sign,default:p.base,x:p.x,z:p.z}))]},
  frame(camera,now=performance.now()){
   time.value=now/1000;
   if(!dirty&&now<nextUpdate)return;
   const moved=Math.hypot(camera.position.x-lastCam.x,camera.position.z-lastCam.z);
   if(!dirty&&moved<1.5&&now<nextUpdate+2000)return;
   nextUpdate=now+300;lastCam.x=camera.position.x;lastCam.z=camera.position.z;
   if(dirty||pending.length)rebuild();dirty=false;write(entries(),camera);
  },
  dispose(){for(const m of Object.values(meshes)){m.removeFromParent();m.geometry.dispose()}atlas.dispose();for(const mat of [wood,woodSway,iron,face,faceSway])mat.dispose()}
 };
}
