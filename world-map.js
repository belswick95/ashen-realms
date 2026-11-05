// The full world map (M / the MAP button): a painted, top-down atlas of the
// real world data — terrain heights and biomes, water, forests, roads, the
// castle and every building footprint — rendered once into a cached canvas,
// with serif place labels, region names and point-of-interest icons drawn on
// top at a constant screen size. Drag or pinch to pan, wheel / buttons to zoom;
// a click or tap only selects (names what is there). It never walks the
// player: only the minimap and the 3D world start walking.
//
// The pure helpers (view maths, colours, POI kinds) are exported for tests.

export const POI_KINDS={
 bank:{label:'Bank',color:'#d6a21e',ink:'#4a3006'},
 shop:{label:'Shop',color:'#3e8a4c',ink:'#f4ecd2'},
 smith:{label:'Smithy',color:'#6c7079',ink:'#f1f1f1'},
 inn:{label:'Inn',color:'#b8672e',ink:'#fbe9cf'},
 altar:{label:'Altar',color:'#6b58b8',ink:'#ffffff'},
 fishing:{label:'Fishing spot',color:'#2b7fbd',ink:'#ffffff'},
 quest:{label:'Quest',color:'#2457c4',ink:'#ffe27a'}
};
// Building types and world-entity templates → POI kind (null: no icon).
const KIND_OF={bank:'bank',banker:'bank',market:'shop',store:'shop',general_store:'shop',generalstore:'shop',shop:'shop',merchant:'shop',armory:'shop',forge:'smith',anvil:'smith',smith:'smith',inn:'inn',tavern:'inn',innkeeper:'inn',chapel:'altar',altar:'altar',shrine:'altar',fishing_spot:'fishing',fishing:'fishing',dock:'fishing',quest:'quest'};
export function poiKind(key){return KIND_OF[String(key||'').toLowerCase()]||null}
// One icon per kind within `radius` world units (a bank building and its
// banker stand together read as one bank).
export function mergePois(list,radius=10){const out=[];for(const p of list){if(!p||!POI_KINDS[p.kind]||!Number.isFinite(p.x)||!Number.isFinite(p.z))continue;const near=out.find(o=>o.kind===p.kind&&Math.hypot(o.x-p.x,o.z-p.z)<radius);if(near){if(!near.name&&p.name)near.name=p.name;continue}out.push({...p})}return out}

// View: centre (x,z) in world units and scale in screen pixels per world unit.
export function fitScale(w,h,extent){return Math.min(w,h)/extent*.96}
export function clampView(view,w,h,extent,maxScale=8){
 const min=fitScale(w,h,extent),scale=Math.max(min,Math.min(maxScale,view.scale)),half=extent/2;
 // Keep the world on screen: the centre may move until an edge reaches the frame.
 const sx=Math.max(0,half-w/2/scale),sz=Math.max(0,half-h/2/scale);
 return {x:Math.max(-sx,Math.min(sx,view.x))||0,z:Math.max(-sz,Math.min(sz,view.z))||0,scale};
}
export function worldToScreen(view,x,z,w,h){return {x:w/2+(x-view.x)*view.scale,y:h/2+(z-view.z)*view.scale}}
export function screenToWorld(view,sx,sy,w,h){return {x:view.x+(sx-w/2)/view.scale,z:view.z+(sy-h/2)/view.scale}}
// Zoom by `factor` keeping the world point under (sx,sy) fixed on screen.
export function zoomAround(view,factor,sx,sy,w,h,extent,maxScale){
 const at=screenToWorld(view,sx,sy,w,h),scale=view.scale*factor;
 return clampView({scale,x:at.x-(sx-w/2)/scale,z:at.z-(sy-h/2)/scale},w,h,extent,maxScale);
}
// Nearest feature to a world point within `radius` world units, or null.
export function pickFeature(list,x,z,radius){let best=null,bd=radius;for(const f of list){const d=Math.hypot(f.x-x,f.z-z);if(d<=bd){bd=d;best=f}}return best}

const mix=(a,b,t)=>a.map((v,i)=>v+(b[i]-v)*t),clamp01=t=>Math.max(0,Math.min(1,t)),smooth=(a,b,x)=>{const t=clamp01((x-a)/(b-a));return t*t*(3-2*t)};
const PAINT={meadow:[104,142,66],lush:[86,132,54],snow:[226,231,233],sand:[214,190,128],rock:[140,132,114],forest:[44,88,40],scrub:[128,124,70],shore:[219,203,152],shallow:[92,148,186],deep:[42,94,152]};
// Painted ground colour from height, water amount, forest density, biome
// weights, hill shading (-1..1) and a little noise (0..1). Pure.
export function terrainColor({height=0,water=0,forest=0,weights=null,shade=0,grain=.5}={}){
 const w=weights||{castle:1,snow:0,grass:0,dry:0};
 let c=[0,0,0];const add=(rgb,k)=>{for(let i=0;i<3;i++)c[i]+=rgb[i]*k};
 add(PAINT.meadow,w.castle||0);add(PAINT.lush,w.grass||0);add(PAINT.snow,w.snow||0);add(PAINT.sand,w.dry||0);
 const total=(w.castle||0)+(w.grass||0)+(w.snow||0)+(w.dry||0);if(total>0)c=c.map(v=>v/total);else c=PAINT.meadow.slice();
 c=mix(c,PAINT.rock,smooth(30,52,height)*(1-(w.snow||0)*.6));
 c=mix(c,(w.dry||0)>.5?PAINT.scrub:PAINT.forest,clamp01(forest)*.85);
 c=c.map(v=>v*(1+shade*.22+(grain-.5)*.12));
 if(water>.02)c=water<.16?mix(c,PAINT.shore,smooth(.02,.12,water)):mix(PAINT.shallow,PAINT.deep,smooth(.16,.75,water));
 return c.map(v=>Math.max(0,Math.min(255,Math.round(v))));
}
// Where to write each region's name: the centre of the cells it dominates.
export function regionAnchors(regions,weightsAt,extent,step=20,avoid=[],clear=70){
 const sums=Object.fromEntries(regions.map(r=>[r.id,{x:0,z:0,n:0}])),half=extent/2;
 for(let x=-half+step/2;x<half;x+=step)for(let z=-half+step/2;z<half;z+=step){if(avoid.some(p=>Math.hypot(p.x-x,p.z-z)<clear))continue;const w=weightsAt(x,z);let best=null,bw=.55;for(const r of regions)if((w[r.id]||0)>bw){bw=w[r.id];best=r.id}if(best){const s=sums[best];s.x+=x;s.z+=z;s.n++}}
 return regions.filter(r=>sums[r.id].n).map(r=>({name:r.name,x:sums[r.id].x/sums[r.id].n,z:sums[r.id].z/sums[r.id].n}));
}

// The player's death pile: a hand-drawn skull (24×24 inline SVG; the canvas draws the same paths).
export const SKULL_PATHS={head:'M12 2.2C7.1 2.2 3.6 5.6 3.6 10.1c0 2.6 1.1 4.5 2.9 5.7v2.9c0 .7.5 1.2 1.2 1.2h1.4v-2.1h1.6v2.1h2.6v-2.1h1.6v2.1h1.4c.7 0 1.2-.5 1.2-1.2v-2.9c1.8-1.2 2.9-3.1 2.9-5.7 0-4.5-3.5-7.9-8.4-7.9Z',
 eyes:'M8.6 8.6c1.3 0 2.3 1 2.3 2.2 0 1.1-.9 1.9-2.1 1.9-1.3 0-2.4-.8-2.4-2 0-1.2.9-2.1 2.2-2.1ZM15.4 8.6c1.3 0 2.2.9 2.2 2.1 0 1.2-1.1 2-2.4 2-1.2 0-2.1-.8-2.1-1.9 0-1.2 1-2.2 2.3-2.2Z',
 nose:'M12 13.1l1.15 2.2h-2.3Z'};
export const SKULL_SVG='<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true"><path d="'+SKULL_PATHS.head+'" fill="#efe6cf" stroke="#1b1408" stroke-width="1.3" stroke-linejoin="round"/><path d="'+SKULL_PATHS.eyes+SKULL_PATHS.nose+'" fill="#1b1408"/></svg>';
export function drawSkullIcon(ctx,x,y,size=20){
 const k=size/24,P=globalThis.Path2D;ctx.save();ctx.translate(x-12*k,y-12*k);ctx.scale(k,k);
 ctx.fillStyle='rgba(0,0,0,.42)';ctx.beginPath();ctx.ellipse(12.8,21.4,7.2,1.9,0,0,Math.PI*2);ctx.fill();
 if(P){const head=new P(SKULL_PATHS.head);ctx.fillStyle='#efe6cf';ctx.fill(head);ctx.strokeStyle='#1b1408';ctx.lineWidth=1.3;ctx.lineJoin='round';ctx.stroke(head);ctx.fillStyle='#1b1408';ctx.fill(new P(SKULL_PATHS.eyes));ctx.fill(new P(SKULL_PATHS.nose))}
 else{ctx.fillStyle='#efe6cf';ctx.strokeStyle='#1b1408';ctx.lineWidth=1.3;ctx.beginPath();ctx.arc(12,10.5,8,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle='#1b1408';for(const ex of [8.6,15.4]){ctx.beginPath();ctx.arc(ex,10.7,2,0,Math.PI*2);ctx.fill()}}
 ctx.restore();
}
const SERIF="Georgia,'Palatino Linotype','Book Antiqua',Palatino,'Times New Roman',serif";
function hash(x,z){const n=Math.sin(x*127.1+z*311.7)*43758.5453;return n-Math.floor(n)}
function valueNoise(x,z){const xi=Math.floor(x),zi=Math.floor(z),u=x-xi,v=z-zi,s=t=>t*t*(3-2*t);const a=hash(xi,zi),b=hash(xi+1,zi),c=hash(xi,zi+1),d=hash(xi+1,zi+1);return (a+(b-a)*s(u))*(1-s(v))+(c+(d-c)*s(u))*s(v)}

// Icon glyphs, drawn centred at (0,0) in a badge of radius r.
export function drawPoiIcon(ctx,kind,x,y,r=9){
 const k=POI_KINDS[kind];if(!k)return;ctx.save();ctx.translate(x,y);
 ctx.fillStyle='rgba(0,0,0,.45)';ctx.beginPath();ctx.arc(.8,1.4,r+1,0,Math.PI*2);ctx.fill();
 ctx.fillStyle=k.color;ctx.strokeStyle='#1b1408';ctx.lineWidth=1.4;ctx.beginPath();ctx.arc(0,0,r,0,Math.PI*2);ctx.fill();ctx.stroke();
 ctx.strokeStyle='rgba(255,255,255,.35)';ctx.lineWidth=1;ctx.beginPath();ctx.arc(0,0,r-1.6,Math.PI*1.1,Math.PI*1.9);ctx.stroke();
 const s=r/9;ctx.scale(s,s);ctx.fillStyle=k.ink;ctx.strokeStyle=k.ink;ctx.lineWidth=1.6;ctx.lineCap='round';ctx.lineJoin='round';
 if(kind==='bank'){for(const [dx,dy] of [[-2.5,2.5],[2.5,2.5],[0,-1.5]]){ctx.beginPath();ctx.ellipse(dx,dy,3.4,1.7,0,0,Math.PI*2);ctx.fill();ctx.fillRect(dx-3.4,dy,6.8,1.6)}}
 else if(kind==='shop'){ctx.beginPath();ctx.moveTo(-4.5,-1.5);ctx.lineTo(4.5,-1.5);ctx.lineTo(3.6,5);ctx.lineTo(-3.6,5);ctx.closePath();ctx.fill();ctx.beginPath();ctx.arc(0,-2,2.6,Math.PI,0);ctx.stroke()}
 else if(kind==='smith'){ctx.beginPath();ctx.moveTo(-5.5,-2.5);ctx.lineTo(5,-2.5);ctx.lineTo(3,0);ctx.lineTo(1.6,0);ctx.lineTo(2.6,4);ctx.lineTo(-2.6,4);ctx.lineTo(-1.6,0);ctx.lineTo(-3.5,0);ctx.closePath();ctx.fill()}
 else if(kind==='inn'){ctx.fillRect(-3.8,-3.5,6,8);ctx.beginPath();ctx.arc(2.4,.5,2.3,-Math.PI/2,Math.PI/2);ctx.stroke();ctx.fillStyle=k.color;ctx.fillRect(-2.6,-2.2,1.2,5.5)}
 else if(kind==='altar'){ctx.lineWidth=2.2;ctx.beginPath();ctx.moveTo(0,-5.5);ctx.lineTo(0,5.5);ctx.moveTo(-3.8,-2);ctx.lineTo(3.8,-2);ctx.stroke()}
 else if(kind==='fishing'){ctx.beginPath();ctx.ellipse(-.8,0,4.2,2.6,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.moveTo(2.6,0);ctx.lineTo(5.6,-3);ctx.lineTo(5.6,3);ctx.closePath();ctx.fill();ctx.fillStyle=k.color;ctx.beginPath();ctx.arc(-3,-.6,.8,0,Math.PI*2);ctx.fill()}
 else if(kind==='quest'){ctx.font='bold 12px '+SERIF;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('!',0,.5)}
 ctx.restore();
}

function outlinedText(ctx,text,x,y,{font,fill,stroke='#140f08',width=4,shadow=true,spacing=0}){
 ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 if('letterSpacing' in ctx)ctx.letterSpacing=spacing+'px';
 if(shadow){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillText(text,x+1.5,y+2)}
 ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.strokeText(text,x,y);ctx.fillStyle=fill;ctx.fillText(text,x,y);
 if('letterSpacing' in ctx)ctx.letterSpacing='0px';
}

const STYLE=`#map-panel{padding:8px;z-index:9000!important}#map-panel .map-card{width:min(1180px,calc(100vw - 16px));height:min(880px,calc(100dvh - 16px));display:flex;flex-direction:column;padding:10px 12px 8px;box-sizing:border-box}
#map-panel .map-head h2{font-size:clamp(16px,2.4vw,24px)}
.wm-stage{position:relative;flex:1;min-height:0;margin:8px 0 6px;border:2px solid #8e7c53;border-radius:6px;overflow:hidden;background:#0c1820;touch-action:none}
#map-panel #worldmap{display:block;width:100%!important;height:100%!important;max-height:none!important;margin:0!important;border:0!important;cursor:grab;outline:none}
#map-panel #worldmap.dragging{cursor:grabbing}
.wm-tools{position:absolute;right:8px;top:8px;display:flex;flex-direction:column;gap:5px;z-index:2}
.wm-tools button{margin:0;width:36px;height:36px;padding:0;font:bold 18px Georgia,serif;border-radius:6px;background:#1d2a22e8;border:1px solid #b99a5e;color:#f0dcae}
.wm-tools button[aria-pressed=true]{background:#7a6235}
.wm-legend{position:absolute;left:8px;bottom:8px;z-index:2;background:#14100ae0;border:1px solid #9d8554;border-radius:6px;padding:7px 10px;color:#efdfb9;font:12px Georgia,serif;display:grid;grid-template-columns:auto auto;gap:4px 12px}
.wm-legend[hidden]{display:none}.wm-legend div{display:flex;align-items:center;gap:6px;white-space:nowrap}.wm-legend canvas{width:20px;height:20px}
.wm-legend strong{grid-column:1/-1;color:#e8c56f;letter-spacing:1px;font-size:11px;text-transform:uppercase}
.wm-info{position:absolute;left:50%;top:8px;transform:translateX(-50%);z-index:2;background:#14100ae6;border:1px solid #9d8554;border-radius:16px;padding:5px 14px;color:#f3e2b5;font:13px Georgia,serif;pointer-events:none;white-space:nowrap;max-width:70%;overflow:hidden;text-overflow:ellipsis}
.wm-info[hidden]{display:none}
.wm-busy{position:absolute;inset:0;display:grid;place-items:center;color:#e9d6a6;font:italic 16px Georgia,serif;pointer-events:none}
.wm-busy[hidden]{display:none}
#map-panel>.map-card>small{font-size:11px}
@media (max-height:500px){#map-panel{padding:4px}#map-panel .map-card{height:calc(100dvh - 8px);width:calc(100vw - 8px);padding:5px 8px 4px}#map-panel .map-head h2{font-size:15px}#map-panel>.map-card>small{display:none}.wm-stage{margin:4px 0 0}.wm-tools button{width:32px;height:32px;font-size:16px}.wm-legend{font-size:11px;padding:5px 7px;gap:2px 10px}}`;

export function createWorldMap({canvas,source}){
 const doc=canvas.ownerDocument,win=doc.defaultView,extent=source.extent||840,half=extent/2;
 const phone=!!source.phone,BASE=phone?1280:2560,GRID=phone?320:640,MAX=phone?6:8;
 if(!doc.getElementById('world-map-style')){const st=doc.createElement('style');st.id='world-map-style';st.textContent=STYLE;doc.head.append(st)}
 // Stage: canvas plus zoom buttons, legend and the selection chip.
 const stage=doc.createElement('div');stage.className='wm-stage';canvas.replaceWith(stage);stage.append(canvas);
 canvas.removeAttribute('width');canvas.removeAttribute('height');canvas.tabIndex=0;canvas.title='World map · drag to pan, scroll or pinch to zoom';canvas.style.cursor='';
 canvas.setAttribute('role','img');canvas.setAttribute('aria-label','World map of Eldervale');
 const tools=doc.createElement('div');tools.className='wm-tools';stage.append(tools);
 const tool=(text,label,fn)=>{const b=doc.createElement('button');b.type='button';b.textContent=text;b.title=label;b.setAttribute('aria-label',label);b.onclick=fn;tools.append(b);return b};
 const busy=doc.createElement('div');busy.className='wm-busy';busy.textContent='Drawing the map…';stage.append(busy);
 const info=doc.createElement('div');info.className='wm-info';info.hidden=true;info.setAttribute('aria-live','polite');stage.append(info);
 const legend=doc.createElement('div');legend.className='wm-legend';stage.append(legend);
 const caption=stage.parentElement?.querySelector('small');if(caption)caption.textContent='Drag to pan · scroll, pinch or +/− to zoom · tap a place for its name · walk with the minimap or in the world';
 let base=null,regions=[],signature='',open=false,raf=0,dirty=true,lastDraw=0,w=1,h=1,dpr=1,selected=null,infoTimer=0;
 let view={x:0,z:0,scale:1},target=null;
 const ctx=canvas.getContext('2d');

 function paintBase(){
  const t0=performance.now();base=doc.createElement('canvas');base.width=base.height=BASE;const b=base.getContext('2d');
  const grid=doc.createElement('canvas');grid.width=grid.height=GRID;const g=grid.getContext('2d'),im=g.createImageData(GRID,GRID),data=im.data,cell=extent/GRID;
  // Forest density from the real tree positions, splatted and blurred.
  const density=new Float32Array(GRID*GRID),R=Math.max(2,Math.round(6/cell));
  for(const t of source.trees?.()||[]){const cx=Math.floor((t.x+half)/cell),cz=Math.floor((t.z+half)/cell);for(let dz=-R;dz<=R;dz++)for(let dx=-R;dx<=R;dx++){const x=cx+dx,z=cz+dz;if(x<0||z<0||x>=GRID||z>=GRID)continue;const f=1-Math.hypot(dx,dz)/(R+1);if(f>0)density[z*GRID+x]+=f*f}}
  const heights=new Float32Array((GRID+1)*(GRID+1));for(let z=0;z<=GRID;z++)for(let x=0;x<=GRID;x++)heights[z*(GRID+1)+x]=source.heightAt(-half+x*cell,-half+z*cell)||0;
  for(let z=0;z<GRID;z++)for(let x=0;x<GRID;x++){
   const wx=-half+(x+.5)*cell,wz=-half+(z+.5)*cell,H=heights,i0=z*(GRID+1)+x;
   const height=(H[i0]+H[i0+1]+H[i0+GRID+1]+H[i0+GRID+2])/4,dx=(H[i0+1]+H[i0+GRID+2]-H[i0]-H[i0+GRID+1])/(2*cell),dz=(H[i0+GRID+1]+H[i0+GRID+2]-H[i0]-H[i0+1])/(2*cell);
   // Light from the north-west, as on a painted relief map.
   const shade=Math.max(-1,Math.min(1,(-dx-dz)*.9));
   const water=Math.max(0,Math.min(1,source.waterAt?.(wx,wz)||0));
   const forest=Math.min(1,density[z*GRID+x]/1.8)*(water>.02?0:1);
   const grain=valueNoise(wx/9,wz/9)*.6+valueNoise(wx/2.5,wz/2.5)*.4;
   const rgb=terrainColor({height,water,forest,weights:source.biome?.(wx,wz)||null,shade,grain});
   const k=(z*GRID+x)*4;data[k]=rgb[0];data[k+1]=rgb[1];data[k+2]=rgb[2];data[k+3]=255;
  }
  g.putImageData(im,0,0);b.imageSmoothingEnabled=true;b.imageSmoothingQuality='high';b.drawImage(grid,0,0,BASE,BASE);
  const s=BASE/extent,P=v=>(v+half)*s;
  // Soft water edges and crisp river channels on top of the painted ground.
  b.lineCap='round';b.lineJoin='round';
  for(const river of source.rivers||[]){const trace=()=>{b.beginPath();river.points.forEach(([x,z],i)=>i?b.lineTo(P(x),P(z)):b.moveTo(P(x),P(z)))};
   for(const [extra,color] of [[7,'rgba(219,203,152,.35)'],[3,'rgba(122,166,190,.55)'],[0,'#3f7fb2'],[-river.width*.55,'rgba(120,178,214,.55)']]){trace();b.strokeStyle=color;b.lineWidth=Math.max(1,(river.width+extra)*s);b.stroke()}}
  for(const lake of source.lakes||[]){const shore=f=>{b.beginPath();source.lakeOutline(lake,f).forEach(([x,z],i)=>i?b.lineTo(P(x),P(z)):b.moveTo(P(x),P(z)));b.closePath()};
   shore(1.1);b.fillStyle='rgba(219,203,152,.45)';b.fill();shore(1.02);b.fillStyle='#5b97c0';b.fill();shore(.86);b.fillStyle='#4683b4';b.fill();shore(.6);b.fillStyle='#356fa3';b.fill();
   shore(.95);b.strokeStyle='rgba(205,230,240,.45)';b.lineWidth=Math.max(1,.6*s);b.stroke()}
  // Tree canopies: small painted crowns with a shadow and a sunlit side.
  const crown=2.3*s;for(const t of source.trees?.()||[]){const x=P(t.x),y=P(t.z),v=hash(t.x,t.z);
   b.fillStyle='rgba(18,34,16,.45)';b.beginPath();b.arc(x+crown*.35,y+crown*.45,crown*1.05,0,Math.PI*2);b.fill();
   b.fillStyle=v<.33?'#2c5a27':v<.66?'#33652b':'#3b6e2f';b.beginPath();b.arc(x,y,crown,0,Math.PI*2);b.fill();
   b.fillStyle='rgba(140,180,90,.45)';b.beginPath();b.arc(x-crown*.32,y-crown*.32,crown*.48,0,Math.PI*2);b.fill()}
  // Roads and town streets as grey stone paths.
  const path=(points,width)=>{const trace=()=>{b.beginPath();points.forEach(([x,z],i)=>i?b.lineTo(P(x),P(z)):b.moveTo(P(x),P(z)))};trace();b.strokeStyle='rgba(58,52,42,.55)';b.lineWidth=(width+1.4)*s;b.stroke();trace();b.strokeStyle='#a39d8e';b.lineWidth=width*s;b.stroke();trace();b.strokeStyle='rgba(205,198,178,.5)';b.lineWidth=width*.35*s;b.stroke()};
  for(const [a,c] of source.roads||[])path(source.roadPoints(a,c),3.4);
  for(const [a,c] of source.streets?.()||[])path([a,c],2.2);
  for(const p of source.plazas?.()||[]){b.fillStyle='rgba(58,52,42,.5)';b.beginPath();b.arc(P(p.x),P(p.z),(p.r+1)*s,0,Math.PI*2);b.fill();b.fillStyle='#b4ad9b';b.beginPath();b.arc(P(p.x),P(p.z),p.r*s,0,Math.PI*2);b.fill()}
  for(const br of source.bridges||[]){b.save();b.translate(P(br.x),P(br.z));b.rotate(-br.yaw);b.fillStyle='#9a7a4f';b.strokeStyle='#3e2f1d';b.lineWidth=Math.max(1,.4*s);b.fillRect(-br.width*s/2,-br.length*s/2,br.width*s,br.length*s);b.strokeRect(-br.width*s/2,-br.length*s/2,br.width*s,br.length*s);b.restore()}
  // The castle: courtyard, curtain wall, corner towers and the keep.
  const c=source.castle;if(c){const cx=P(c.x),cz=P(c.z),hw=c.half*s,wall=3.2*s;
   b.fillStyle='#a7a08c';b.fillRect(cx-hw,cz-hw,hw*2,hw*2);
   b.fillStyle='rgba(0,0,0,.35)';b.fillRect(cx-hw+wall*.6,cz-hw+wall*.6,hw*2,hw*2);
   b.strokeStyle='#5d574b';b.lineWidth=wall;b.strokeRect(cx-hw,cz-hw,hw*2,hw*2);b.strokeStyle='#8f8878';b.lineWidth=wall*.5;b.strokeRect(cx-hw,cz-hw,hw*2,hw*2);
   b.fillStyle='#4d5a68';b.fillRect(cx-12*s,cz-14*s,24*s,22*s);b.strokeStyle='#2b323a';b.lineWidth=Math.max(1,.8*s);b.strokeRect(cx-12*s,cz-14*s,24*s,22*s);b.beginPath();b.moveTo(cx-12*s,cz-3*s);b.lineTo(cx+12*s,cz-3*s);b.stroke();
   for(const [dx,dz] of [[-1,-1],[1,-1],[-1,1],[1,1]]){b.fillStyle='#6d6656';b.beginPath();b.arc(cx+dx*hw,cz+dz*hw,5.2*s,0,Math.PI*2);b.fill();b.strokeStyle='#3a352c';b.lineWidth=Math.max(1,.7*s);b.stroke();b.fillStyle='#4d5a68';b.beginPath();b.arc(cx+dx*hw,cz+dz*hw,3*s,0,Math.PI*2);b.fill()}
   b.fillStyle='#6d6656';b.fillRect(cx-6*s,cz+hw-4*s,12*s,8*s)}
  // Faint frame where the world ends.
  const edge=b.createRadialGradient(BASE/2,BASE/2,BASE*.42,BASE/2,BASE/2,BASE*.72);edge.addColorStop(0,'rgba(10,20,26,0)');edge.addColorStop(1,'rgba(10,20,26,.55)');b.fillStyle=edge;b.fillRect(0,0,BASE,BASE);
  regions=source.regions?.()||[];
  return performance.now()-t0;
 }

 function size(){const r=stage.getBoundingClientRect();dpr=Math.min(win.devicePixelRatio||1,phone?1.5:2);w=Math.max(100,Math.round(r.width));h=Math.max(100,Math.round(r.height));canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);view=clampView(view,w,h,extent,MAX);dirty=true}
 const ro=win.ResizeObserver?new win.ResizeObserver(()=>{if(open)size()}):null;ro?.observe(stage);

 function buildingsNow(){return source.buildings?.()||[]}
 function placesNow(){return source.places?.()||[]}
 function poisNow(){return mergePois(source.pois?.()||[])}

 function draw(){
  dirty=false;lastDraw=performance.now();ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0c1820';ctx.fillRect(0,0,w,h);
  if(!base)return;const s=BASE/extent,tl=screenToWorld(view,0,0,w,h);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
  ctx.drawImage(base,(tl.x+half)*s,(tl.z+half)*s,w/view.scale*s,h/view.scale*s,0,0,w,h);
  const S=(x,z)=>worldToScreen(view,x,z,w,h),k=view.scale;
  // Buildings: top-down roofs on their real footprints, with a ridge and shadow.
  for(const bld of buildingsNow()){const p=S(bld.x,bld.z),r=Math.hypot(bld.halfW,bld.halfD)*k;if(p.x<-r||p.y<-r||p.x>w+r||p.y>h+r)continue;
   const c=Math.cos(bld.rot),sn=Math.sin(bld.rot),corner=(lx,lz)=>S(bld.x+lx*c+lz*sn,bld.z-lx*sn+lz*c),poly=pts=>{ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath()};
   const pts=[corner(-bld.halfW,-bld.halfD),corner(bld.halfW,-bld.halfD),corner(bld.halfW,bld.halfD),corner(-bld.halfW,bld.halfD)],off=Math.max(1,k*.6);
   ctx.save();ctx.translate(off,off*1.2);poly(pts);ctx.fillStyle='rgba(15,12,8,.42)';ctx.fill();ctx.restore();
   poly(pts);ctx.fillStyle=bld.roof||'#8a4b33';ctx.fill();ctx.strokeStyle='#22180f';ctx.lineWidth=Math.max(.8,Math.min(1.6,k*.25));ctx.stroke();
   if(k>1.1){const along=bld.halfW>=bld.halfD,a=along?corner(-bld.halfW*.92,0):corner(0,-bld.halfD*.92),b2=along?corner(bld.halfW*.92,0):corner(0,bld.halfD*.92);
    // Two roof planes: the far one a shade darker.
    const half1=along?[corner(-bld.halfW,-bld.halfD),corner(bld.halfW,-bld.halfD),corner(bld.halfW,0),corner(-bld.halfW,0)]:[corner(-bld.halfW,-bld.halfD),corner(0,-bld.halfD),corner(0,bld.halfD),corner(-bld.halfW,bld.halfD)];
    poly(half1);ctx.fillStyle='rgba(0,0,0,.18)';ctx.fill();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b2.x,b2.y);ctx.strokeStyle='rgba(255,226,170,.55)';ctx.lineWidth=Math.max(.8,k*.3);ctx.stroke()}}
  // Region names: large gold serif, faded out when zoomed in close.
  const regionAlpha=1-smooth(1.6,3,k);if(regionAlpha>.02){ctx.globalAlpha=regionAlpha;const towns=placesNow().map(pl=>S(pl.x,pl.z));for(const r of regions){const p=S(r.x,r.z);for(let i=0;i<4&&towns.some(t=>Math.abs(t.x-p.x)<170&&Math.abs(t.y-p.y)<44);i++)p.y+=46;outlinedText(ctx,r.name.toUpperCase(),p.x,p.y,{font:'italic bold '+Math.round(Math.max(17,Math.min(30,w/36)))+'px '+SERIF,fill:'#f3a83a',stroke:'#2a1505',width:5,spacing:3})}ctx.globalAlpha=1}
  // Lake and river names in pale blue italics.
  if(k>1.1){for(const lake of source.lakes||[])if(lake.name){const p=S(lake.x,lake.z);outlinedText(ctx,lake.name,p.x,p.y+lake.rz*k+12,{font:'italic 13px '+SERIF,fill:'#d8ecff',stroke:'#123049',width:3,shadow:false})}}
  // Points of interest, then settlement names, skipping icons that would overlap.
  const placed=[];const free=(x,y,r)=>!placed.some(q=>Math.abs(q.x-x)<q.r+r&&Math.abs(q.y-y)<q.r+r);
  const icon=Math.round(Math.max(8,Math.min(11,6+k*2.2)));
  for(const p of poisNow()){const q=S(p.x,p.z);if(q.x<-10||q.y<-10||q.x>w+10||q.y>h+10||!free(q.x,q.y,icon))continue;placed.push({x:q.x,y:q.y,r:icon});drawPoiIcon(ctx,p.kind,q.x,q.y,icon)}
  for(const pl of placesNow()){const q=S(pl.x,pl.z);if(q.x<-80||q.y<-30||q.x>w+80||q.y>h+30)continue;const big=pl.kind==='castle'||pl.capital;
   const font=(big?'bold ':'bold ')+Math.round(big?17:15)+'px '+SERIF;outlinedText(ctx,pl.name,q.x,q.y-(k>2?24:16),{font,fill:big?'#ffe7a8':'#fff3d4',width:4})}
  // The player's death pile: skull with the time left beneath it.
  const pile=source.deathPile?.();if(pile){const q=S(pile.x,pile.z),pulse=(Math.sin(performance.now()/420)+1)/2;
   ctx.save();ctx.strokeStyle='rgba(224,38,29,'+(.35+.35*pulse)+')';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y,14+pulse*3,0,Math.PI*2);ctx.stroke();ctx.restore();
   drawSkullIcon(ctx,q.x,q.y-1,22);outlinedText(ctx,pile.label,q.x,q.y+22,{font:'bold 13px '+SERIF,fill:'#ffe3d6',stroke:'#2a0b07',width:4})}
  // Destination flag and the player's arrow.
  const flag=source.flag?.();if(flag){const q=S(flag.x,flag.z);ctx.save();ctx.translate(q.x,q.y);ctx.strokeStyle='#2b1a0e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,2);ctx.lineTo(0,-16);ctx.stroke();ctx.fillStyle='#e0261d';ctx.strokeStyle='#4a0d09';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(12,-12);ctx.lineTo(0,-8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
  const me=source.player?.();if(me){const q=S(me.x,me.z),pulse=(Math.sin(performance.now()/260)+1)/2;ctx.save();ctx.translate(q.x,q.y);
   ctx.strokeStyle='rgba(255,255,255,'+(.25+.35*pulse)+')';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,11+pulse*4,0,Math.PI*2);ctx.stroke();
   ctx.rotate(Math.PI-me.heading);ctx.fillStyle='#ffffff';ctx.strokeStyle='#101a14';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(7,7);ctx.lineTo(0,3);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
  // Compass rose.
  ctx.save();ctx.translate(w-30,h-30);ctx.fillStyle='rgba(20,16,10,.7)';ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e8c56f';ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(4,0);ctx.lineTo(-4,0);ctx.closePath();ctx.fill();ctx.fillStyle='#9c8a62';ctx.beginPath();ctx.moveTo(0,14);ctx.lineTo(4,0);ctx.lineTo(-4,0);ctx.closePath();ctx.fill();ctx.font='bold 10px '+SERIF;ctx.textAlign='center';ctx.fillStyle='#fff3d4';ctx.fillText('N',0,-17);ctx.restore();
 }

 function loop(now){if(!open)return;raf=win.requestAnimationFrame(loop);
  if(target){const t=1-Math.exp(-(now-(loop.last||now))/90);view=clampView({x:view.x+(target.x-view.x)*t,z:view.z+(target.z-view.z)*t,scale:view.scale*Math.pow(target.scale/view.scale,t)},w,h,extent,MAX);dirty=true;if(Math.abs(target.scale/view.scale-1)<.002&&Math.hypot(target.x-view.x,target.z-view.z)*view.scale<.5){view=target;target=null}}
  loop.last=now;if(dirty||now-lastDraw>120)draw()}
 function animateTo(v){target=clampView(v,w,h,extent,MAX);dirty=true}

 function refreshLegend(){legend.replaceChildren();const title=doc.createElement('strong');title.textContent='Legend';legend.append(title);const kinds=new Set(poisNow().map(p=>p.kind));
  for(const [kind,def] of Object.entries(POI_KINDS)){if(!kinds.has(kind))continue;const row=doc.createElement('div'),c=doc.createElement('canvas');c.width=c.height=40;const g=c.getContext('2d');g.scale(2,2);drawPoiIcon(g,kind,10,10,8);row.append(c,def.label);legend.append(row)}
  for(const [label,draw2] of [['You',g=>{g.translate(10,10);g.fillStyle='#fff';g.strokeStyle='#101a14';g.lineWidth=1.5;g.beginPath();g.moveTo(0,-7);g.lineTo(5,5);g.lineTo(0,2);g.lineTo(-5,5);g.closePath();g.fill();g.stroke()}],['Your death pile',g=>drawSkullIcon(g,10,10,17)],['Destination',g=>{g.strokeStyle='#2b1a0e';g.lineWidth=1.5;g.beginPath();g.moveTo(7,17);g.lineTo(7,3);g.stroke();g.fillStyle='#e0261d';g.beginPath();g.moveTo(7,3);g.lineTo(16,6);g.lineTo(7,9);g.closePath();g.fill()}]]){const row=doc.createElement('div'),c=doc.createElement('canvas');c.width=c.height=40;const g=c.getContext('2d');g.scale(2,2);draw2(g);row.append(c,label);legend.append(row)}}

 // Pointer input: drag to pan, two fingers to pinch, tap to select.
 const pointers=new Map();let drag=null,moved=0;
 const local=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}};
 canvas.addEventListener('pointerdown',e=>{e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,local(e));target=null;moved=0;drag={view:{...view},start:local(e),pinch:pointers.size===2?pinchState():null};if(drag.pinch)drag.start=null;canvas.classList.add('dragging')});
 function pinchState(){const [a,b]=[...pointers.values()];return {d:Math.hypot(a.x-b.x,a.y-b.y)||1,mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},view:{...view}}}
 canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)||!drag)return;const p=local(e),prev=pointers.get(e.pointerId);moved+=Math.hypot(p.x-prev.x,p.y-prev.y);pointers.set(e.pointerId,p);
  if(pointers.size>=2){if(!drag.pinch)drag.pinch=pinchState();const [a,b]=[...pointers.values()],d=Math.hypot(a.x-b.x,a.y-b.y)||1,mid={x:(a.x+b.x)/2,y:(a.y+b.y)/2},P=drag.pinch;
   const at=screenToWorld(P.view,P.mid.x,P.mid.y,w,h),scale=P.view.scale*d/P.d;view=clampView({scale,x:at.x-(mid.x-w/2)/scale,z:at.z-(mid.y-h/2)/scale},w,h,extent,MAX)}
  else if(drag.start){view=clampView({scale:drag.view.scale,x:drag.view.x-(p.x-drag.start.x)/drag.view.scale,z:drag.view.z-(p.y-drag.start.y)/drag.view.scale},w,h,extent,MAX)}
  dirty=true});
 const end=e=>{if(!pointers.has(e.pointerId))return;const p=pointers.get(e.pointerId);pointers.delete(e.pointerId);if(pointers.size===0){canvas.classList.remove('dragging');if(drag&&!drag.pinch&&moved<8)select(p.x,p.y);drag=null}else if(drag){const [q]=[...pointers.values()];drag={view:{...view},start:q,pinch:null}}};
 canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
 canvas.addEventListener('wheel',e=>{e.preventDefault();const p=local(e),from=target||view;const factor=Math.exp(-Math.max(-300,Math.min(300,e.deltaY*(e.deltaMode===1?33:1)))*.0022);animateTo(zoomAround(from,factor,p.x,p.y,w,h,extent,MAX))},{passive:false});
 canvas.addEventListener('dblclick',e=>{const p=local(e);animateTo(zoomAround(target||view,2,p.x,p.y,w,h,extent,MAX))});
 canvas.addEventListener('keydown',e=>{const step=80/view.scale,from=target||view;const moves={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
  if(moves[e.key]){e.preventDefault();animateTo({...from,x:from.x+moves[e.key][0],z:from.z+moves[e.key][1]})}else if(e.key==='+'||e.key==='='){e.preventDefault();zoomBy(1.5)}else if(e.key==='-'||e.key==='_'){e.preventDefault();zoomBy(1/1.5)}});
 // Clicks never walk: they only name what is under the pointer.
 canvas.addEventListener('click',e=>{e.preventDefault();e.stopPropagation()});
 function select(sx,sy){const at=screenToWorld(view,sx,sy,w,h),r=16/view.scale;
  const hit=pickFeature(poisNow().map(p=>({...p,label:(p.name?p.name+' · ':'')+POI_KINDS[p.kind].label})),at.x,at.z,r)||pickFeature(placesNow().map(p=>({...p,label:p.name})),at.x,at.z,Math.max(r,28/view.scale))||pickFeature(buildingsNow().map(b=>({...b,label:b.name||'Building'})),at.x,at.z,Math.max(r,4));
  const me=source.player?.();const youAre=me&&Math.hypot(me.x-at.x,me.z-at.z)<r;
  const pile=source.deathPile?.(),onPile=pile&&Math.hypot(pile.x-at.x,pile.z-at.z)<r;
  selected=onPile?{label:pile.label+' left · your death pile'}:youAre?{label:'You are here'}:hit;info.hidden=!selected;if(selected)info.textContent=selected.label;win.clearTimeout(infoTimer);if(selected)infoTimer=win.setTimeout(()=>{info.hidden=true},4000)}
 function zoomBy(f){const from=target||view;animateTo(zoomAround(from,f,w/2,h/2,w,h,extent,MAX))}
 tool('+','Zoom in',()=>zoomBy(1.6));tool('−','Zoom out',()=>zoomBy(1/1.6));
 tool('◎','Centre on me',()=>{const me=source.player?.();if(me)animateTo({x:me.x,z:me.z,scale:Math.max(view.scale,2.2)})});
 const legendButton=tool('☰','Show or hide the legend',()=>{legend.hidden=!legend.hidden;legendButton.setAttribute('aria-pressed',String(!legend.hidden))});
 if(phone||(win.innerHeight||800)<500){legend.hidden=true}legendButton.setAttribute('aria-pressed',String(!legend.hidden));

 function ensureBase(){const sig=source.signature?.()||'';if(base&&sig===signature)return;signature=sig;busy.hidden=false;paintBase();busy.hidden=true;refreshLegend()}
 return {
  get isOpen(){return open},
  open(){if(open)return;open=true;size();const first=!base;
   // Paint after the panel has laid out (the "Drawing the map…" note shows first).
   win.requestAnimationFrame(()=>{if(!open)return;ensureBase();if(first){const me=source.player?.();view=clampView({x:me?.x||0,z:me?.z||0,scale:Math.max(fitScale(w,h,extent)*1.8,Math.max(w,h)/extent)},w,h,extent,MAX)}dirty=true;draw();raf=win.requestAnimationFrame(loop)});
  },
  close(){open=false;win.cancelAnimationFrame(raf);pointers.clear();drag=null;info.hidden=true},
  invalidate(){signature='';base=null},
  get view(){return {...view}},setView(v){view=clampView(v,w,h,extent,MAX);target=null;dirty=true;if(open&&base)draw()},
  draw(){if(base)draw()}
 };
}
