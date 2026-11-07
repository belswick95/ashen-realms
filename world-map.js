// The full world map (M / the MAP button): a painted, top-down atlas of the
// real world data — terrain heights and biomes, water, forests, roads, the
// castle and every building footprint — rendered once into a cached canvas,
// with serif place labels, region names and point-of-interest icons drawn on
// top at a constant screen size. It opens fitted: the whole world inside the
// visible screen (safe areas respected, portrait or landscape). Drag to pan
// (with momentum), pinch / wheel / double-tap / + − to zoom between that fit
// and a close-up, "Fit" to go back. A click or tap only selects (names what is
// there). It never walks the player: only the minimap and the 3D world do.
// Redraws happen only when the view or something on the map changes, and each
// one is a single crop of the cached terrain painting plus the overlays.
//
// Map icons (map-icons.js): mines, tiered trees, fishing spots, skilling stations, banks and
// shops, caves and boss lairs, dragons, training areas, agility shortcuts and boats. They merge
// further as the map zooms out (one icon per area on screen), minor services appear once zoomed
// in a little, hover or tap names them with their level, and the legend toggles each kind.
//
// The pure helpers (view maths, colours, POI kinds) are exported for tests.
import {MARKER_CATS,MARKER_GROUPS,clusterMarkers,markerLabel,drawMarker,drawMarkerIcon,legendTint,loadFilters,saveFilters} from './map-icons.js?v=release-20261107-canopy152';

export const POI_KINDS={
 bank:{label:'Bank',color:'#d6a21e',ink:'#4a3006'},
 shop:{label:'Shop',color:'#3e8a4c',ink:'#f4ecd2'},
 smith:{label:'Smithy',color:'#6c7079',ink:'#f1f1f1'},
 inn:{label:'Inn',color:'#b8672e',ink:'#fbe9cf'},
 altar:{label:'Altar',color:'#6b58b8',ink:'#ffffff'},
 fishing:{label:'Fishing spot',color:'#2b7fbd',ink:'#ffffff'},
 quest:{label:'Quest',color:'#2457c4',ink:'#ffe27a'},
 // Exploration (explore.js): places the player has discovered, and hidden places / new regions found.
 discovered:{label:'Discovered place',color:'#8a6f2f',ink:'#ffe7a3'},
 hidden:{label:'Hidden place',color:'#3c2f57',ink:'#f2d36b'}
};
// Building types and world-entity templates → POI kind (null: no icon).
const KIND_OF={bank:'bank',banker:'bank',market:'shop',store:'shop',general_store:'shop',generalstore:'shop',shop:'shop',merchant:'shop',armory:'shop',forge:'smith',anvil:'smith',smith:'smith',inn:'inn',tavern:'inn',innkeeper:'inn',chapel:'altar',altar:'altar',shrine:'altar',fishing_spot:'fishing',fishing:'fishing',dock:'fishing',quest:'quest'};
export function poiKind(key){return KIND_OF[String(key||'').toLowerCase()]||null}
// One icon per kind within `radius` world units (a bank building and its
// banker stand together read as one bank).
export function mergePois(list,radius=10){const out=[];for(const p of list){if(!p||!POI_KINDS[p.kind]||!Number.isFinite(p.x)||!Number.isFinite(p.z))continue;const near=out.find(o=>o.kind===p.kind&&Math.hypot(o.x-p.x,o.z-p.z)<radius);if(near){if(!near.name&&p.name)near.name=p.name;continue}out.push({...p})}return out}

// View: centre (x,z) in world units and scale in screen pixels per world unit.
// Fit: the whole (square) world inside a w×h frame with a small margin. This
// is also the furthest the map zooms out.
export function fitScale(w,h,extent,margin=.96){return Math.max(1e-6,Math.min(w,h))/extent*margin}
export function fitView(w,h,extent){return {x:0,z:0,scale:fitScale(w,h,extent)}}
// Zoom limits: out to fit-whole-world, in to `maxScale` px per world unit (at
// least 4× the fit, so a large screen can still zoom in).
export function zoomRange(w,h,extent,maxScale=8){const min=fitScale(w,h,extent);return {min,max:Math.max(maxScale,min*4)}}
// True while the view is (within rounding) zoomed all the way out.
export function isFitView(view,w,h,extent){return view.scale<=fitScale(w,h,extent)*1.002}
export function clampView(view,w,h,extent,maxScale=8){
 const {min,max}=zoomRange(w,h,extent,maxScale),scale=Math.max(min,Math.min(max,Number.isFinite(view.scale)?view.scale:min)),half=extent/2;
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
// Pinch: the view that keeps the world point under the start midpoint under
// the current midpoint, scaled by the change in finger distance.
export function pinchView(start,startMid,startDist,mid,dist,w,h,extent,maxScale){
 const at=screenToWorld(start,startMid.x,startMid.y,w,h),scale=start.scale*(dist||1)/(startDist||1);
 return clampView({scale,x:at.x-(mid.x-w/2)/scale,z:at.z-(mid.y-h/2)/scale},w,h,extent,maxScale);
}
// Pan by a screen-pixel delta (drag moves the map with the finger).
export function panView(view,dx,dy,w,h,extent,maxScale){return clampView({...view,x:view.x-dx/view.scale,z:view.z-dy/view.scale},w,h,extent,maxScale)}
// Two taps close in time and place make a double tap.
export function isDoubleTap(prev,tap,{ms=320,slop=30}={}){return !!prev&&tap.t-prev.t<=ms&&tap.t>=prev.t&&Math.hypot(tap.x-prev.x,tap.y-prev.y)<=slop}
// Release velocity (px/ms) from recent pointer samples [{t,x,y}], newest last,
// over the last `window` ms; zero when the finger rested before lifting.
export function releaseVelocity(samples,window=90){
 if(!samples||samples.length<2)return {vx:0,vy:0};const last=samples[samples.length-1];let first=last;
 for(let i=samples.length-2;i>=0&&last.t-samples[i].t<=window;i--)first=samples[i];
 const dt=last.t-first.t;return dt>0?{vx:(last.x-first.x)/dt,vy:(last.y-first.y)/dt}:{vx:0,vy:0};
}
// Momentum: velocity decays exponentially (time constant `tau` ms); returns the
// step to move this frame and the remaining velocity, or null once it has stopped.
export function inertiaStep(v,dt,{tau=320,stop=.02}={}){
 const k=Math.exp(-dt/tau),vx=v.vx*k,vy=v.vy*k;if(Math.hypot(vx,vy)<stop)return null;
 // Distance travelled during dt under exponential decay.
 const d=tau*(1-k);return {dx:v.vx*d,dy:v.vy*d,vx,vy};
}
// Labels and icons shrink a little on small screens (never below 72%).
export function uiScale(w,h){return Math.max(.72,Math.min(1,Math.min(w,h)/560))}
// Label boxes {x,y,w,h} (centre, size): does `box` collide with any placed one?
export function boxHits(placed,box,pad=2){return placed.some(q=>Math.abs(q.x-box.x)*2<q.w+box.w+pad*2&&Math.abs(q.y-box.y)*2<q.h+box.h+pad*2)}
// Where an off-screen point meets the frame (inset by `m`), for an edge arrow.
export function edgePoint(x,y,w,h,m=18){
 if(x>=m&&y>=m&&x<=w-m&&y<=h-m)return null;const cx=w/2,cy=h/2,dx=x-cx,dy=y-cy;
 const t=Math.min(dx?((dx>0?w-m:m)-cx)/dx:Infinity,dy?((dy>0?h-m:m)-cy)/dy:Infinity);
 return {x:cx+dx*t,y:cy+dy*t,angle:Math.atan2(dy,dx)};
}
// Nearest feature to a world point within `radius` world units, or null.
export function pickFeature(list,x,z,radius){let best=null,bd=radius;for(const f of list){const d=Math.hypot(f.x-x,f.z-z);if(d<=bd){bd=d;best=f}}return best}
// Map markers merge further as the map zooms out: two of a kind closer on screen than about an
// icon and a bit join. The world distance is bucketed (half powers of two) so a slow zoom reuses
// the same grouping instead of re-clustering every frame.
export function zoomLink(scale,iconPx=18){const L=iconPx*1.15/Math.max(1e-6,scale);return Math.pow(2,Math.round(Math.log2(Math.max(1,L))*2)/2)}
export function markersForZoom(items,scale,iconPx=18,cache=null){const L=zoomLink(scale,iconPx);if(cache?.has(L))return cache.get(L);const out=clusterMarkers(items,L);cache?.set(L,out);return out}

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
 else if(kind==='discovered'||kind==='hidden'){ctx.beginPath();ctx.moveTo(0,-5.5);ctx.lineTo(1.6,-1.6);ctx.lineTo(5.5,0);ctx.lineTo(1.6,1.6);ctx.lineTo(0,5.5);ctx.lineTo(-1.6,1.6);ctx.lineTo(-5.5,0);ctx.lineTo(-1.6,-1.6);ctx.closePath();ctx.fill()}
 else if(kind==='quest'){ctx.font='bold 12px '+SERIF;ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText('!',0,.5)}
 ctx.restore();
}

// A small gold crown marks the realm's capital on the world map.
export function drawCrownIcon(ctx,x,y,size=16){
 const s=size/16;ctx.save();ctx.translate(x,y);ctx.scale(s,s);ctx.lineJoin='round';
 ctx.beginPath();ctx.moveTo(-8,5);ctx.lineTo(-9,-4);ctx.lineTo(-4,0);ctx.lineTo(0,-7);ctx.lineTo(4,0);ctx.lineTo(9,-4);ctx.lineTo(8,5);ctx.closePath();
 ctx.fillStyle='rgba(0,0,0,.5)';ctx.save();ctx.translate(1,1.5);ctx.fill();ctx.restore();
 ctx.fillStyle='#f2c64e';ctx.strokeStyle='#3a2508';ctx.lineWidth=1.6;ctx.fill();ctx.stroke();
 ctx.fillStyle='#b8862a';ctx.fillRect(-8,3,16,2.4);ctx.strokeRect(-8,3,16,2.4);
 for(const [cx,cy,c]of [[0,-7,'#d8344a'],[-9,-4,'#3b7bd4'],[9,-4,'#3b7bd4']]){ctx.fillStyle=c;ctx.beginPath();ctx.arc(cx,cy,1.6,0,Math.PI*2);ctx.fill();ctx.stroke()}
 ctx.restore();
}
// Quest giver: the yellow "!" (quest to start) or "?" (hand-in) the world shows over their heads.
export function drawQuestGlyph(ctx,kind,x,y,scale=1){
 ctx.save();ctx.translate(x,y);ctx.scale(scale,scale);ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 17px Georgia,serif';ctx.lineJoin='round';
 ctx.lineWidth=4.5;ctx.strokeStyle='#1d1404';ctx.strokeText(kind==='?'?'?':'!',0,0);ctx.fillStyle='#ffd23a';ctx.fillText(kind==='?'?'?':'!',0,0);ctx.restore();
}
// City walls: a thick stone band along each wall polygon, with gaps for the gates.
export function drawCityWalls(ctx,walls,project,{width=4,gates=[],gateWidth=8}={}){
 for(const wall of walls||[]){const pts=wall.points||wall;ctx.save();ctx.lineCap='square';ctx.lineJoin='miter';
  for(const [stroke,lw]of [['#2a2620',width+2],['#9c968a',width]]){ctx.strokeStyle=stroke;ctx.lineWidth=lw;
   for(let i=0;i<pts.length;i++){const a=pts[i],b=pts[(i+1)%pts.length],len=Math.hypot(b[0]-a[0],b[1]-a[1]);let cuts=[];
    for(const g of wall.gates||gates){const t=((g.x-a[0])*(b[0]-a[0])+(g.z-a[1])*(b[1]-a[1]))/(len*len),off=Math.abs((g.x-a[0])*(b[1]-a[1])-(g.z-a[1])*(b[0]-a[0]))/len;if(t>0&&t<1&&off<1)cuts.push([t-gateWidth/2/len,t+gateWidth/2/len])}
    cuts.sort((u,v)=>u[0]-v[0]);let t0=0;const runs=[];for(const [c0,c1]of cuts){runs.push([t0,c0]);t0=c1}runs.push([t0,1]);
    for(const [u,v]of runs){if(v<=u)continue;const p=project(a[0]+(b[0]-a[0])*u,a[1]+(b[1]-a[1])*u),q=project(a[0]+(b[0]-a[0])*v,a[1]+(b[1]-a[1])*v);ctx.beginPath();ctx.moveTo(p.x,p.y);ctx.lineTo(q.x,q.y);ctx.stroke()}}}
  ctx.fillStyle='#8d877b';ctx.strokeStyle='#2a2620';ctx.lineWidth=1;for(const t of wall.towers||[]){const p=project(t[0],t[1]);ctx.beginPath();ctx.arc(p.x,p.y,width*1.15,0,Math.PI*2);ctx.fill();ctx.stroke()}
  ctx.restore()}
}

function outlinedText(ctx,text,x,y,{font,fill,stroke='#140f08',width=4,shadow=true,spacing=0}){
 ctx.font=font;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
 if('letterSpacing' in ctx)ctx.letterSpacing=spacing+'px';
 if(shadow){ctx.fillStyle='rgba(0,0,0,.55)';ctx.fillText(text,x+1.5,y+2)}
 ctx.strokeStyle=stroke;ctx.lineWidth=width;ctx.strokeText(text,x,y);ctx.fillStyle=fill;ctx.fillText(text,x,y);
 if('letterSpacing' in ctx)ctx.letterSpacing='0px';
}

// The panel fills the visible screen inside the safe areas (notch, home bar,
// rounded corners) in portrait and landscape; the stage takes all the height
// the header leaves. --safe-* default to the env() insets (tests override them).
// Above every HUD layer, and above the rotate-your-phone gate when a phone is
// turned upright with the map open.
const STYLE=`#map-panel{--safe-top:env(safe-area-inset-top,0px);--safe-right:env(safe-area-inset-right,0px);--safe-bottom:env(safe-area-inset-bottom,0px);--safe-left:env(safe-area-inset-left,0px);--map-gap:8px;
position:fixed!important;inset:0!important;z-index:9500!important;display:flex!important;align-items:center;justify-content:center;box-sizing:border-box;margin:0;
height:var(--visible-height,100dvh);padding:calc(var(--map-gap) + var(--safe-top)) calc(var(--map-gap) + var(--safe-right)) calc(var(--map-gap) + var(--safe-bottom)) calc(var(--map-gap) + var(--safe-left))!important;overscroll-behavior:none;touch-action:none}
#map-panel[hidden]{display:none!important}
body.landscape-required #map-panel:not([hidden]){z-index:30001!important;visibility:visible!important}
#map-panel .map-card{width:100%!important;max-width:1180px;height:100%!important;max-height:880px;min-width:0;min-height:0;margin:0;display:flex;flex-direction:column;padding:10px 12px 8px;box-sizing:border-box;overflow:hidden}
#map-panel .map-head{flex:0 0 auto;display:flex;align-items:center;justify-content:space-between;gap:8px;min-width:0}
#map-panel .map-head h2{font-size:clamp(16px,2.4vw,24px);margin:0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
#map-panel #map-close{flex:0 0 auto;min-height:36px;min-width:64px}
.wm-stage{position:relative;flex:1 1 auto;min-height:0;min-width:0;margin:8px 0 6px;border:2px solid #8e7c53;border-radius:6px;overflow:hidden;background:#0c1820;touch-action:none;-webkit-user-select:none;user-select:none}
#map-panel #worldmap{position:absolute;inset:0;display:block;width:100%!important;height:100%!important;max-width:none!important;max-height:none!important;margin:0!important;border:0!important;cursor:grab;outline:none;touch-action:none;object-fit:fill!important}
#map-panel #worldmap.dragging{cursor:grabbing}
.wm-tools{position:absolute;right:8px;top:8px;display:flex;flex-direction:column;gap:6px;z-index:2}
.wm-tools button{margin:0;width:38px;height:38px;min-height:0;padding:0;font:bold 18px Georgia,serif;line-height:1;border-radius:6px;background:#1d2a22e8;border:1px solid #b99a5e;color:#f0dcae;touch-action:manipulation}
.wm-tools.wm-row{flex-direction:row}
.wm-tools button[data-act=fit]{font-size:12px;letter-spacing:.5px}
.wm-tools button[aria-pressed=true]{background:#7a6235}
.wm-tools button:disabled{opacity:.45}
.wm-legend{position:absolute;left:8px;bottom:8px;z-index:2;max-height:calc(100% - 16px);overflow:auto;background:#14100ae0;border:1px solid #9d8554;border-radius:6px;padding:7px 10px;color:#efdfb9;font:12px Georgia,serif;display:grid;grid-template-columns:auto auto;gap:4px 12px}
.wm-legend[hidden]{display:none}.wm-legend div{display:flex;align-items:center;gap:6px;white-space:nowrap}.wm-legend canvas{width:20px;height:20px;flex:0 0 auto}
.wm-legend strong{grid-column:1/-1;color:#e8c56f;letter-spacing:1px;font-size:11px;text-transform:uppercase;margin-top:2px}
.wm-legend{max-width:min(380px,calc(100% - 70px));grid-template-columns:repeat(auto-fill,minmax(150px,1fr));min-width:min(300px,calc(100% - 70px))}
.wm-legend button.wm-cat{display:flex;align-items:center;gap:6px;margin:0;padding:2px 6px 2px 2px;min-height:28px;width:100%;background:transparent;border:1px solid transparent;border-radius:5px;color:inherit;font:inherit;text-align:left;white-space:nowrap;cursor:pointer;touch-action:manipulation}
.wm-legend button.wm-cat:hover{border-color:#9d855488}
.wm-legend button.wm-cat[aria-pressed=false]{opacity:.42}.wm-legend button.wm-cat[aria-pressed=false] span{text-decoration:line-through}
.wm-legend button.wm-cat small{margin-left:auto;color:#bfa978;font-size:10px}
.wm-legend .wm-all{grid-column:1/-1;display:flex;gap:6px}.wm-legend .wm-all button{margin:0;padding:3px 9px;min-height:26px;font:11px Georgia,serif;background:#1d2a22;border:1px solid #9d8554;color:#f0dcae;border-radius:5px}
body.touch-controls .wm-legend button.wm-cat{min-height:34px}
.wm-info{position:absolute;left:50%;top:8px;transform:translateX(-50%);z-index:3;background:#14100ae6;border:1px solid #9d8554;border-radius:14px;padding:5px 14px;color:#f3e2b5;font:13px/1.35 Georgia,serif;pointer-events:none;white-space:normal;text-align:center;width:max-content;max-width:calc(100% - 120px);overflow:hidden}
.wm-info[hidden]{display:none}
.wm-busy{position:absolute;inset:0;display:grid;place-items:center;color:#e9d6a6;font:italic 16px Georgia,serif;pointer-events:none}
.wm-busy[hidden]{display:none}
#map-panel>.map-card>small{flex:0 0 auto;font-size:11px}
body.touch-controls #map-panel .wm-tools button{width:42px;height:42px}
@media (max-width:560px),(max-height:560px){#map-panel{--map-gap:4px}#map-panel .map-card{padding:6px 8px 6px;max-width:none;max-height:none}#map-panel .map-head h2{font-size:16px}#map-panel>.map-card>small{display:none}.wm-stage{margin:6px 0 0}.wm-legend{font-size:11px;padding:5px 7px;gap:2px 10px}}
@media (max-height:430px){#map-panel .map-card{padding:4px 6px}#map-panel .map-head h2{font-size:14px}#map-panel #map-close{min-height:32px}.wm-stage{margin:4px 0 0}.wm-tools{gap:4px;top:6px;right:6px}body.touch-controls #map-panel .wm-tools button,.wm-tools button{width:36px;height:36px;font-size:16px}}
@media (max-height:340px){.wm-tools button[data-act=me]{display:none}}`;

export function createWorldMap({canvas,source}){
 const doc=canvas.ownerDocument,win=doc.defaultView,extent=source.extent||840,half=extent/2;
 const phone=!!source.phone,BASE=phone?1280:2560,GRID=phone?320:640,MAX=phone?6:8;
 if(!doc.getElementById('world-map-style')){const st=doc.createElement('style');st.id='world-map-style';st.textContent=STYLE;doc.head.append(st)}
 // Stage: canvas plus zoom buttons, legend and the selection chip.
 const stage=doc.createElement('div');stage.className='wm-stage';canvas.replaceWith(stage);stage.append(canvas);
 canvas.removeAttribute('width');canvas.removeAttribute('height');canvas.tabIndex=0;canvas.title='World map · drag to pan, scroll, pinch or double-tap to zoom';canvas.style.cursor='';
 canvas.setAttribute('role','img');canvas.setAttribute('aria-label','World map of Eldervale');
 const tools=doc.createElement('div');tools.className='wm-tools';stage.append(tools);
 const tool=(text,label,act,fn)=>{const b=doc.createElement('button');b.type='button';b.textContent=text;b.title=label;b.dataset.act=act;b.setAttribute('aria-label',label);b.onclick=e=>{e.preventDefault();e.stopPropagation();fn()};tools.append(b);return b};
 const busy=doc.createElement('div');busy.className='wm-busy';busy.textContent='Drawing the map…';stage.append(busy);
 const info=doc.createElement('div');info.className='wm-info';info.hidden=true;info.setAttribute('aria-live','polite');stage.append(info);
 const legend=doc.createElement('div');legend.className='wm-legend';stage.append(legend);
 const caption=stage.parentElement?.querySelector('small');if(caption)caption.textContent='Drag to pan · scroll, pinch, double-tap or +/− to zoom · Fit shows the whole world · tap a place for its name';
 let base=null,regions=[],signature='',open=false,raf=0,dirty=true,w=1,h=1,dpr=1,selected=null,infoTimer=0,watch=0;
 let view={x:0,z:0,scale:1},target=null,inertia=null,lastTick=0;
 const stats={draws:0,lastDrawMs:0};
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

 // Canvas backing store at the device pixel ratio (capped at 2) so icons and
 // labels stay sharp; a resize keeps a fitted view fitted.
 function size(){const r=stage.getBoundingClientRect(),wasFit=isFitView(view,w,h,extent);dpr=Math.min(win.devicePixelRatio||1,2);
  const nw=Math.max(60,Math.round(r.width)),nh=Math.max(60,Math.round(r.height));if(nw===w&&nh===h&&canvas.width===Math.round(w*dpr))return;
  w=nw;h=nh;tools.classList.toggle('wm-row',h>w*1.25);canvas.width=Math.round(w*dpr);canvas.height=Math.round(h*dpr);view=wasFit?fitView(w,h,extent):clampView(view,w,h,extent,MAX);if(target)target=clampView(target,w,h,extent,MAX);invalidate()}
 const ro=win.ResizeObserver?new win.ResizeObserver(()=>{if(open)size()}):null;ro?.observe(stage);
 const onViewport=()=>{if(open)size()};win.visualViewport?.addEventListener('resize',onViewport);win.addEventListener('orientationchange',onViewport);

 // World features are read when the map opens and every two seconds while it
 // is open; a redraw happens only when something on the map actually changed.
 let lists={buildings:[],places:[],pois:[],quests:[],markers:[]},listKey='',dynKey='',lastLists=0;
 // Viewer's legend toggles (kinds hidden on this device) and the per-zoom marker groupings.
 const filters=loadFilters(win.localStorage);let markerCache=new Map(),drawn=[];
 function readLists(){lists={buildings:source.buildings?.()||[],places:source.places?.()||[],pois:mergePois(source.pois?.()||[]),quests:source.quests?.()||[],markers:source.markers?.()||[]};
  const sum=a=>a.reduce((s,p)=>s+(p.x||0)*1.3+(p.z||0)*.7,0).toFixed(1);const key=[lists.buildings.length,lists.places.length,lists.pois.length,lists.markers.length,lists.quests.map(q=>q.kind).join(''),sum(lists.buildings),sum(lists.pois),sum(lists.quests),sum(lists.markers),lists.markers.map(m=>m.name).join('')].join('|');
  lastLists=performance.now();if(key!==listKey){listKey=key;markerCache=new Map();return true}return false}
 // Moving things: player, destination flag, death pile and the quest objective.
 function dynamicKey(){const me=source.player?.(),f=source.flag?.(),pile=source.deathPile?.(),o=source.objective?.(),r=v=>Math.round(v*4)/4;
  return [me?r(me.x)+','+r(me.z)+','+Math.round(me.heading*20):'',f?r(f.x)+','+r(f.z):'',pile?r(pile.x)+','+r(pile.z)+pile.label:'',o?r(o.x)+','+r(o.z)+(o.label||''):''].join('|')}
 function poll(){if(!open)return;let changed=false;if(performance.now()-lastLists>2000&&readLists()){changed=true;refreshLegend()}const k=dynamicKey();if(k!==dynKey){dynKey=k;changed=true}if(changed)invalidate()}

 // Request one redraw on the next animation frame (coalesces pointer moves).
 function invalidate(){dirty=true;schedule()}
 function schedule(){if(open&&!raf)raf=win.requestAnimationFrame(tick)}
 function tick(now){raf=0;if(!open)return;const dt=Math.min(250,lastTick?now-lastTick:16);lastTick=now;let more=false;
  if(target){const t=1-Math.exp(-dt/90);view=clampView({x:view.x+(target.x-view.x)*t,z:view.z+(target.z-view.z)*t,scale:view.scale*Math.pow(target.scale/view.scale,t)},w,h,extent,MAX);dirty=true;
   if(Math.abs(target.scale/view.scale-1)<.002&&Math.hypot(target.x-view.x,target.z-view.z)*view.scale<.5){view=target;target=null}else more=true}
  else if(inertia){const s=inertiaStep(inertia,dt);if(!s)inertia=null;else{const next=panView(view,s.dx,s.dy,w,h,extent,MAX);
    // Stop along an axis that has hit the world edge.
    inertia={vx:Math.abs(next.x-(view.x-s.dx/view.scale))>1e-6?0:s.vx,vy:Math.abs(next.z-(view.z-s.dy/view.scale))>1e-6?0:s.vy};view=next;dirty=true;more=true}}
  if(dirty)draw();if(more)schedule();else lastTick=0}
 function animateTo(v){inertia=null;target=clampView(v,w,h,extent,MAX);schedule()}
 function setNow(v){target=null;inertia=null;view=clampView(v,w,h,extent,MAX);invalidate()}
 function syncButtons(){const v=target||view,{min,max}=zoomRange(w,h,extent,MAX);zoomIn.disabled=v.scale>=max*.999;zoomOut.disabled=fitButton.disabled=v.scale<=min*1.001}

 function draw(){
  dirty=false;const t0=performance.now();stats.draws++;ctx.setTransform(dpr,0,0,dpr,0,0);ctx.fillStyle='#0c1820';ctx.fillRect(0,0,w,h);
  syncButtons();if(!base)return;
  // Terrain: one crop of the cached painting (never re-rendered per frame).
  const s=BASE/extent,tl=screenToWorld(view,0,0,w,h);
  ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality=view.scale*dpr>s*1.5?'medium':'high';
  // Clip the source rectangle to the painting ourselves: Safari stretches an out-of-bounds source
  // crop over the whole destination, which shifted the terrain away from labels and markers.
  {let sx=(tl.x+half)*s,sy=(tl.z+half)*s,sw=w/view.scale*s,sh=h/view.scale*s;const fx=w/sw,fy=h/sh,BW=base.width,BH=base.height;
   let dx=0,dy=0,dw=w,dh=h;
   if(sx<0){dx-=sx*fx;dw+=sx*fx;sw+=sx;sx=0}if(sy<0){dy-=sy*fy;dh+=sy*fy;sh+=sy;sy=0}
   if(sx+sw>BW){const o=sx+sw-BW;sw-=o;dw-=o*fx}if(sy+sh>BH){const o=sy+sh-BH;sh-=o;dh-=o*fy}
   if(sw>0&&sh>0&&dw>0&&dh>0)ctx.drawImage(base,sx,sy,sw,sh,dx,dy,dw,dh);}
  const S=(x,z)=>worldToScreen(view,x,z,w,h),k=view.scale,ui=uiScale(w,h);
  // Buildings: top-down roofs on their real footprints, with a ridge and shadow.
  for(const bld of lists.buildings){const p=S(bld.x,bld.z),r=Math.hypot(bld.halfW,bld.halfD)*k;if(p.x<-r||p.y<-r||p.x>w+r||p.y>h+r)continue;
   const c=Math.cos(bld.rot),sn=Math.sin(bld.rot),corner=(lx,lz)=>S(bld.x+lx*c+lz*sn,bld.z-lx*sn+lz*c),poly=pts=>{ctx.beginPath();pts.forEach((q,i)=>i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y));ctx.closePath()};
   const pts=[corner(-bld.halfW,-bld.halfD),corner(bld.halfW,-bld.halfD),corner(bld.halfW,bld.halfD),corner(-bld.halfW,bld.halfD)],off=Math.max(1,k*.6);
   if(r<1.2){ctx.fillStyle=bld.roof||'#8a4b33';ctx.fillRect(p.x-1,p.y-1,2,2);continue}
   ctx.save();ctx.translate(off,off*1.2);poly(pts);ctx.fillStyle='rgba(15,12,8,.42)';ctx.fill();ctx.restore();
   poly(pts);ctx.fillStyle=bld.roof||'#8a4b33';ctx.fill();ctx.strokeStyle='#22180f';ctx.lineWidth=Math.max(.6,Math.min(1.6,k*.25));ctx.stroke();
   if(k>1.1){const along=bld.halfW>=bld.halfD,a=along?corner(-bld.halfW*.92,0):corner(0,-bld.halfD*.92),b2=along?corner(bld.halfW*.92,0):corner(0,bld.halfD*.92);
    // Two roof planes: the far one a shade darker.
    const half1=along?[corner(-bld.halfW,-bld.halfD),corner(bld.halfW,-bld.halfD),corner(bld.halfW,0),corner(-bld.halfW,0)]:[corner(-bld.halfW,-bld.halfD),corner(0,-bld.halfD),corner(0,bld.halfD),corner(-bld.halfW,bld.halfD)];
    poly(half1);ctx.fillStyle='rgba(0,0,0,.18)';ctx.fill();ctx.beginPath();ctx.moveTo(a.x,a.y);ctx.lineTo(b2.x,b2.y);ctx.strokeStyle='rgba(255,226,170,.55)';ctx.lineWidth=Math.max(.8,k*.3);ctx.stroke()}}
  // City walls around the capital.
  drawCityWalls(ctx,source.walls?.(),S,{width:Math.max(1.5,Math.min(9,k*2.6))});
  // Labels claim screen boxes so names and icons never pile on each other.
  const placed=[],claim=b=>{if(boxHits(placed,b))return false;placed.push(b);return true};
  const textBox=(text,x,y,font,px,spacing=0)=>{ctx.font=font;if('letterSpacing' in ctx)ctx.letterSpacing=spacing+'px';const tw=ctx.measureText(text).width;if('letterSpacing' in ctx)ctx.letterSpacing='0px';const bw=tw+6;return {x:bw<w-4?Math.max(bw/2+2,Math.min(w-bw/2-2,x)):x,y,w:bw,h:px+4}};
  // Settlement names first (the capital always), then regions, lakes and icons.
  const labels=[];for(const pl of lists.places){const q=S(pl.x,pl.z);if(q.x<-120||q.y<-60||q.x>w+120||q.y>h+60)continue;labels.push({pl,q,rank:pl.capital?0:pl.kind==='castle'?1:2})}labels.sort((a,b)=>a.rank-b.rank);
  const drawLater=[];
  for(const {pl,q} of labels){const lift=(k>2?22:14)*ui;
   if(pl.capital){const px=Math.round(22*ui),y=q.y-lift-(k>2?14:8)*ui,font='bold '+px+'px '+SERIF,box=textBox(pl.name.toUpperCase(),q.x,y,font,px,2),sub=Math.round(12*ui);
    box.y=y-6*ui;box.h+=Math.round(36*ui);placed.push(box);drawLater.push(()=>{drawCrownIcon(ctx,q.x,y-20*ui,18*ui);outlinedText(ctx,pl.name.toUpperCase(),box.x,y,{font,fill:'#ffd76a',stroke:'#2a1505',width:5*ui,spacing:2});outlinedText(ctx,pl.title||'Royal Capital',box.x,y+17*ui,{font:'italic '+sub+'px '+SERIF,fill:'#f3e2b5',width:3})});continue}
   const big=pl.kind==='castle',px=Math.round((big?17:15)*ui),font='bold '+px+'px '+SERIF,y=q.y-lift,box=textBox(pl.name,q.x,y,font,px);
   if(!claim(box))continue;drawLater.push(()=>{ctx.fillStyle='#1b1408';ctx.beginPath();ctx.arc(q.x,q.y,2.6,0,Math.PI*2);ctx.fill();ctx.fillStyle='#fff3d4';ctx.beginPath();ctx.arc(q.x,q.y,1.6,0,Math.PI*2);ctx.fill();outlinedText(ctx,pl.name,box.x,y,{font,fill:big?'#ffe7a8':'#fff3d4',width:4*ui})})}
  // Region names: large gold serif, faded out when zoomed in close.
  const regionAlpha=1-smooth(1.6,3,k);if(regionAlpha>.02){const px=Math.round(Math.max(13,Math.min(30,w/36))*ui),font='italic bold '+px+'px '+SERIF;
   for(const r of regions){const p=S(r.x,r.z);let box=textBox(r.name.toUpperCase(),p.x,p.y,font,px,3);
    for(let i=0;i<4&&boxHits(placed,box);i++)box={...box,y:box.y+px*1.6};if(boxHits(placed,box))continue;placed.push(box);
    ctx.globalAlpha=regionAlpha;outlinedText(ctx,r.name.toUpperCase(),box.x,box.y,{font,fill:'#f3a83a',stroke:'#2a1505',width:5*ui,spacing:3});ctx.globalAlpha=1}}
  // Lake names in pale blue italics.
  if(k>1.1){for(const lake of source.lakes||[])if(lake.name){const p=S(lake.x,lake.z),y=p.y+lake.rz*k+12,font='italic 13px '+SERIF,box=textBox(lake.name,p.x,y,font,13);if(claim(box))outlinedText(ctx,lake.name,p.x,y,{font,fill:'#d8ecff',stroke:'#123049',width:3,shadow:false})}}
  for(const fn of drawLater)fn();
  // Points of interest, skipping icons that would overlap a name or another icon.
  const icon=Math.round(Math.max(7,Math.min(11,6+k*2.2))*Math.max(.85,ui));
  // Map markers (map-icons.js): highest priority first, one icon per area at this zoom; minor
  // kinds only once zoomed in a little; kinds switched off in the legend are skipped.
  const markerPx=Math.round(Math.max(16,Math.min(22,icon*2))),fit=fitScale(w,h,extent);drawn=[];
  for(const c of markersForZoom(lists.markers,k,markerPx,markerCache)){const def=MARKER_CATS[c.cat];if(!def||filters.has(c.cat)||k<fit*(def.zoom||1)*.999)continue;
   const q=S(c.x,c.z);if(q.x<-12||q.y<-12||q.x>w+12||q.y>h+12||!claim({x:q.x,y:q.y,w:markerPx-2,h:markerPx-2}))continue;drawMarker(ctx,c,q.x,q.y,markerPx,dpr);drawn.push({c,x:q.x,y:q.y,r:markerPx/2})}
  if(!filters.has('exploration'))for(const p of lists.pois){if(p.kind==='quest'&&filters.has('quest'))continue;const q=S(p.x,p.z);if(q.x<-12||q.y<-12||q.x>w+12||q.y>h+12||!claim({x:q.x,y:q.y,w:icon*2,h:icon*2}))continue;drawPoiIcon(ctx,p.kind,q.x,q.y,icon)}
  // Quest givers: the same yellow ! and ? as over their heads in the world.
  if(!filters.has('quest'))for(const g of lists.quests){const q=S(g.x,g.z);if(q.x<-12||q.y<-12||q.x>w+12||q.y>h+12)continue;drawQuestGlyph(ctx,g.kind,q.x,q.y,Math.max(.85,ui))}
  // The player's death pile: skull with the time left beneath it.
  const pile=source.deathPile?.();if(pile){const q=S(pile.x,pile.z);
   ctx.save();ctx.strokeStyle='rgba(224,38,29,.6)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(q.x,q.y,15,0,Math.PI*2);ctx.stroke();ctx.restore();
   drawSkullIcon(ctx,q.x,q.y-1,22);outlinedText(ctx,pile.label,q.x,q.y+22,{font:'bold 13px '+SERIF,fill:'#ffe3d6',stroke:'#2a0b07',width:4})}
  // Destination flag.
  const flag=source.flag?.();if(flag){const q=S(flag.x,flag.z);ctx.save();ctx.translate(q.x,q.y);ctx.strokeStyle='#2b1a0e';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,2);ctx.lineTo(0,-16);ctx.stroke();ctx.fillStyle='#e0261d';ctx.strokeStyle='#4a0d09';ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(0,-16);ctx.lineTo(12,-12);ctx.lineTo(0,-8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}
  // Current quest objective: a gold diamond, or an arrow on the frame edge when it is off screen.
  const goal=source.objective?.();if(goal){const q=S(goal.x,goal.z),e=edgePoint(q.x,q.y,w,h,22);ctx.save();ctx.fillStyle='#ffd23a';ctx.strokeStyle='#2a1a04';ctx.lineWidth=2;
   if(!e){ctx.strokeStyle='rgba(255,210,58,.75)';ctx.beginPath();ctx.arc(q.x,q.y,12,0,Math.PI*2);ctx.stroke();ctx.strokeStyle='#2a1a04';ctx.translate(q.x,q.y);ctx.rotate(Math.PI/4);ctx.fillRect(-5.5,-5.5,11,11);ctx.strokeRect(-5.5,-5.5,11,11)}
   else{ctx.translate(e.x,e.y);ctx.rotate(e.angle);ctx.beginPath();ctx.moveTo(11,0);ctx.lineTo(-7,-9);ctx.lineTo(-3,0);ctx.lineTo(-7,9);ctx.closePath();ctx.fill();ctx.stroke()}ctx.restore()}
  // The player's arrow, last so nothing covers it.
  const me=source.player?.();if(me){const q=S(me.x,me.z);ctx.save();ctx.translate(q.x,q.y);
   ctx.fillStyle='rgba(255,255,255,.18)';ctx.strokeStyle='rgba(255,255,255,.7)';ctx.lineWidth=2;ctx.beginPath();ctx.arc(0,0,13,0,Math.PI*2);ctx.fill();ctx.stroke();
   ctx.rotate(Math.PI-me.heading);ctx.fillStyle='#ffffff';ctx.strokeStyle='#101a14';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(0,-10);ctx.lineTo(7,7);ctx.lineTo(0,3);ctx.lineTo(-7,7);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore();
   const e=edgePoint(q.x,q.y,w,h,16);if(e){ctx.save();ctx.translate(e.x,e.y);ctx.rotate(e.angle);ctx.fillStyle='#ffffff';ctx.strokeStyle='#101a14';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(10,0);ctx.lineTo(-6,-8);ctx.lineTo(-6,8);ctx.closePath();ctx.fill();ctx.stroke();ctx.restore()}}
  // Compass rose.
  ctx.save();ctx.translate(w-30,h-30);ctx.fillStyle='rgba(20,16,10,.7)';ctx.beginPath();ctx.arc(0,0,17,0,Math.PI*2);ctx.fill();ctx.fillStyle='#e8c56f';ctx.beginPath();ctx.moveTo(0,-14);ctx.lineTo(4,0);ctx.lineTo(-4,0);ctx.closePath();ctx.fill();ctx.fillStyle='#9c8a62';ctx.beginPath();ctx.moveTo(0,14);ctx.lineTo(4,0);ctx.lineTo(-4,0);ctx.closePath();ctx.fill();ctx.font='bold 10px '+SERIF;ctx.textAlign='center';ctx.fillStyle='#fff3d4';ctx.fillText('N',0,-17);ctx.restore();
  stats.lastDrawMs=performance.now()-t0;
 }

 // Legend: every kind on the map, grouped, each a toggle (tap or click) remembered on this device.
 function toggle(key,on){if(on)filters.delete(key);else filters.add(key);saveFilters(filters,win.localStorage);invalidate()}
 function refreshLegend(){legend.replaceChildren();const title=doc.createElement('strong');title.textContent='Legend · tap to show or hide';legend.append(title);const kinds=new Set(lists.pois.map(p=>p.kind));
  const icon=paint=>{const c=doc.createElement('canvas');c.width=c.height=40;const g=c.getContext('2d');g.scale(2,2);paint(g);return c};
  const row=(label,paint)=>{const r=doc.createElement('div');r.append(icon(paint),label);legend.append(r)};
  const toggleRow=(key,label,count,paint)=>{const b=doc.createElement('button');b.type='button';b.className='wm-cat';b.dataset.cat=key;b.setAttribute('aria-pressed',String(!filters.has(key)));b.title=(filters.has(key)?'Show ':'Hide ')+label.toLowerCase();
   const t=doc.createElement('span');t.textContent=label;b.append(icon(paint),t);if(count){const n=doc.createElement('small');n.textContent=String(count);b.append(n)}
   b.onclick=e=>{e.preventDefault();e.stopPropagation();const on=filters.has(key);toggle(key,on);b.setAttribute('aria-pressed',String(on));b.title=(on?'Hide ':'Show ')+label.toLowerCase()};legend.append(b)};
  const counts=new Map();for(const m of lists.markers)counts.set(m.cat,(counts.get(m.cat)||0)+1);
  const all=doc.createElement('div');all.className='wm-all';for(const [text,on] of [['Show all',true],['Hide all',false]]){const b=doc.createElement('button');b.type='button';b.textContent=text;b.onclick=e=>{e.preventDefault();e.stopPropagation();for(const k of [...counts.keys(),'quest','exploration'])if(on)filters.delete(k);else filters.add(k);saveFilters(filters,win.localStorage);refreshLegend();invalidate()};all.append(b)}legend.append(all);
  for(const [group,name] of MARKER_GROUPS){const cats=Object.entries(MARKER_CATS).filter(([c,d])=>d.group===group&&counts.has(c));const extra=group==='places'&&(lists.quests.length||kinds.size);if(!cats.length&&!extra)continue;
   const h=doc.createElement('strong');h.textContent=name;legend.append(h);
   for(const [cat,def] of cats){const tint=legendTint(cat,lists.markers);toggleRow(cat,def.label,counts.get(cat),g=>drawMarkerIcon(g,cat,10,10,18,{tint}))}
   if(group==='places'){if(lists.quests.length)toggleRow('quest','Quest giver',lists.quests.length,g=>drawQuestGlyph(g,'!',10,10,.8));if(kinds.has('discovered')||kinds.has('hidden'))toggleRow('exploration','Discovered place',lists.pois.length,g=>drawPoiIcon(g,'discovered',10,10,8))}}
  const h=doc.createElement('strong');h.textContent='You';legend.append(h);
  for(const [kind,def] of Object.entries(POI_KINDS))if(kinds.has(kind)&&!['discovered','hidden','quest'].includes(kind))row(def.label,g=>drawPoiIcon(g,kind,10,10,8));
  if(source.objective)row('Quest objective',g=>{g.translate(10,10);g.rotate(Math.PI/4);g.fillStyle='#ffd23a';g.strokeStyle='#2a1a04';g.lineWidth=1.5;g.fillRect(-4.5,-4.5,9,9);g.strokeRect(-4.5,-4.5,9,9)});
  row('You',g=>{g.translate(10,10);g.fillStyle='#fff';g.strokeStyle='#101a14';g.lineWidth=1.5;g.beginPath();g.moveTo(0,-7);g.lineTo(5,5);g.lineTo(0,2);g.lineTo(-5,5);g.closePath();g.fill();g.stroke()});
  row('Your death pile',g=>drawSkullIcon(g,10,10,17));
  row('Destination',g=>{g.strokeStyle='#2b1a0e';g.lineWidth=1.5;g.beginPath();g.moveTo(7,17);g.lineTo(7,3);g.stroke();g.fillStyle='#e0261d';g.beginPath();g.moveTo(7,3);g.lineTo(16,6);g.lineTo(7,9);g.closePath();g.fill()})}

 // Pointer input: drag to pan (with momentum), two fingers to pinch, tap to
 // select, double-tap to zoom in. Mouse, pen and touch share one path.
 const pointers=new Map();let drag=null,moved=0,samples=[],lastTap=null;
 const local=e=>{const r=canvas.getBoundingClientRect();return {x:e.clientX-r.left,y:e.clientY-r.top}};
 const pinchStart=()=>{const [a,b]=[...pointers.values()];return {d:Math.hypot(a.x-b.x,a.y-b.y)||1,mid:{x:(a.x+b.x)/2,y:(a.y+b.y)/2},view:{...view}}};
 canvas.addEventListener('pointerdown',e=>{if(e.button>0)return;e.preventDefault();canvas.focus({preventScroll:true});try{canvas.setPointerCapture(e.pointerId)}catch{}
  pointers.set(e.pointerId,local(e));target=null;inertia=null;
  if(pointers.size===1){moved=0;samples=[{t:e.timeStamp,...local(e)}];drag={view:{...view},start:local(e),pinch:null,pinched:false}}
  else if(drag){drag.pinch=pinchStart();drag.pinched=true;drag.start=null}
  canvas.classList.add('dragging')});
 canvas.addEventListener('pointermove',e=>{if(!pointers.has(e.pointerId)||!drag)return;const p=local(e),prev=pointers.get(e.pointerId);moved+=Math.hypot(p.x-prev.x,p.y-prev.y);pointers.set(e.pointerId,p);
  if(pointers.size>=2){if(!drag.pinch){drag.pinch=pinchStart();drag.pinched=true}const [a,b]=[...pointers.values()],P=drag.pinch;
   view=pinchView(P.view,P.mid,P.d,{x:(a.x+b.x)/2,y:(a.y+b.y)/2},Math.hypot(a.x-b.x,a.y-b.y)||1,w,h,extent,MAX)}
  else if(drag.start){view=panView(drag.view,p.x-drag.start.x,p.y-drag.start.y,w,h,extent,MAX);samples.push({t:e.timeStamp,...p});if(samples.length>12)samples.shift()}
  invalidate()});
 const end=e=>{if(!pointers.has(e.pointerId))return;const p=pointers.get(e.pointerId);pointers.delete(e.pointerId);
  if(pointers.size===0){canvas.classList.remove('dragging');
   if(drag&&!drag.pinched&&moved<8&&e.type==='pointerup'){const tap={t:e.timeStamp,x:p.x,y:p.y};if(isDoubleTap(lastTap,tap)){lastTap=null;animateTo(zoomAround(target||view,2,p.x,p.y,w,h,extent,MAX))}else{lastTap=tap;select(p.x,p.y)}}
   else if(drag&&!drag.pinched&&e.type==='pointerup'){samples.push({t:e.timeStamp,...p});const v=releaseVelocity(samples);if(Math.hypot(v.vx,v.vy)>.25){inertia={vx:Math.max(-4,Math.min(4,v.vx)),vy:Math.max(-4,Math.min(4,v.vy))};schedule()}}
   drag=null;invalidate()}
  // One finger left after a pinch: carry on panning from where it is.
  else if(drag){const [q]=[...pointers.values()];drag={view:{...view},start:q,pinch:null,pinched:true};samples=[]}};
 canvas.addEventListener('pointerup',end);canvas.addEventListener('pointercancel',end);
 canvas.addEventListener('wheel',e=>{e.preventDefault();const p=local(e),from=target||view;const dy=e.deltaY*(e.deltaMode===1?33:e.deltaMode===2?h:1)*(e.ctrlKey?2.5:1);const factor=Math.exp(-Math.max(-300,Math.min(300,dy))*.0022);animateTo(zoomAround(from,factor,p.x,p.y,w,h,extent,MAX))},{passive:false});
 canvas.addEventListener('keydown',e=>{const step=80/view.scale,from=target||view;const moves={ArrowLeft:[-step,0],ArrowRight:[step,0],ArrowUp:[0,-step],ArrowDown:[0,step]};
  if(moves[e.key]){e.preventDefault();animateTo({...from,x:from.x+moves[e.key][0],z:from.z+moves[e.key][1]})}else if(e.key==='+'||e.key==='='){e.preventDefault();zoomBy(1.6)}else if(e.key==='-'||e.key==='_'){e.preventDefault();zoomBy(1/1.6)}else if(e.key==='0'||e.key==='f'||e.key==='F'){e.preventDefault();fit()}});
 // Clicks never walk: they only name what is under the pointer.
 canvas.addEventListener('click',e=>{e.preventDefault();e.stopPropagation()});
 canvas.addEventListener('dblclick',e=>{e.preventDefault();e.stopPropagation()});
 canvas.addEventListener('contextmenu',e=>e.preventDefault());
 // The map marker drawn under a screen point (the icons on screen, nearest first).
 function markerAt(sx,sy,slop=4){let best=null,bd=Infinity;for(const d of drawn){const dist=Math.hypot(d.x-sx,d.y-sy);if(dist<=d.r+slop&&dist<bd){bd=dist;best=d}}return best}
 // Hover (mouse and pen): name the marker under the pointer while it rests there.
 let hovering=null;canvas.addEventListener('pointermove',e=>{if(e.pointerType==='touch'||pointers.size)return;const p=local(e),d=markerAt(p.x,p.y,2);
  if(d?.c===hovering)return;hovering=d?.c||null;canvas.style.cursor=d?'pointer':'';if(d){win.clearTimeout(infoTimer);info.textContent=markerLabel(d.c);info.hidden=false}else if(!selected)info.hidden=true});
 canvas.addEventListener('pointerleave',()=>{if(hovering){hovering=null;canvas.style.cursor='';if(!selected)info.hidden=true}});
 function select(sx,sy){const at=screenToWorld(view,sx,sy,w,h),r=16/view.scale;
  const mark=markerAt(sx,sy,6);
  const hit=mark?{label:markerLabel(mark.c)}:pickFeature(lists.pois.map(p=>({...p,label:(p.name?p.name+' · ':'')+POI_KINDS[p.kind].label})),at.x,at.z,r)||pickFeature(lists.quests.map(q=>({...q,label:(q.name?q.name+' · ':'')+(q.kind==='?'?'Quest to hand in':'Quest available')})),at.x,at.z,r)||pickFeature(lists.places.map(p=>({...p,label:p.name})),at.x,at.z,Math.max(r,28/view.scale))||pickFeature(lists.buildings.map(b=>({...b,label:b.name||'Building'})),at.x,at.z,Math.max(r,4));
  const me=source.player?.();const youAre=me&&Math.hypot(me.x-at.x,me.z-at.z)<r;
  const pile=source.deathPile?.(),onPile=pile&&Math.hypot(pile.x-at.x,pile.z-at.z)<r;
  const goal=source.objective?.(),onGoal=goal&&Math.hypot(goal.x-at.x,goal.z-at.z)<r;
  selected=onPile?{label:pile.label+' left · your death pile'}:youAre?{label:'You are here'}:onGoal?{label:goal.label?'Objective · '+goal.label:'Quest objective'}:hit;info.hidden=!selected;if(selected)info.textContent=selected.label;win.clearTimeout(infoTimer);if(selected)infoTimer=win.setTimeout(()=>{info.hidden=true},4000)}
 function zoomBy(f){animateTo(zoomAround(target||view,f,w/2,h/2,w,h,extent,MAX))}
 function fit(){animateTo(fitView(w,h,extent))}
 const zoomIn=tool('+','Zoom in','in',()=>zoomBy(1.6)),zoomOut=tool('−','Zoom out','out',()=>zoomBy(1/1.6)),fitButton=tool('Fit','Show the whole world','fit',fit);
 tool('◎','Centre on me','me',()=>{const me=source.player?.();if(me)animateTo({x:me.x,z:me.z,scale:Math.max((target||view).scale,zoomRange(w,h,extent,MAX).min*3)})});
 // The legend (kind toggles) starts closed so it never covers the map; ☰ opens it, remembered per device.
 const LEGEND_KEY='eldervale-map-legend',remember=v=>{try{win.localStorage?.setItem(LEGEND_KEY,v?'open':'closed')}catch{}};
 const legendButton=tool('☰','Map legend: show or hide kinds of icons','legend',()=>{legend.hidden=!legend.hidden;remember(!legend.hidden);legendButton.setAttribute('aria-pressed',String(!legend.hidden))});
 let legendOpen=false;try{legendOpen=win.localStorage?.getItem(LEGEND_KEY)==='open'}catch{}legend.hidden=!legendOpen||phone||(win.innerHeight||800)<380;legendButton.setAttribute('aria-pressed',String(!legend.hidden));

 function ensureBase(){const sig=source.signature?.()||'';if(base&&sig===signature)return;signature=sig;busy.hidden=false;paintBase();busy.hidden=true;refreshLegend()}
 function close(){if(!open)return;open=false;if(raf)win.cancelAnimationFrame(raf);raf=0;win.clearInterval(watch);watch=0;pointers.clear();drag=null;target=null;inertia=null;info.hidden=true;canvas.classList.remove('dragging')}
 return {
  get isOpen(){return open},
  // Every opening shows the whole world, fitted inside the visible screen.
  open(){if(open)return;open=true;w=h=1;readLists();dynKey=dynamicKey();size();view=fitView(w,h,extent);
   // Paint after the panel has laid out (the "Drawing the map…" note shows first).
   win.requestAnimationFrame(()=>{if(!open)return;ensureBase();size();view=fitView(w,h,extent);invalidate()});
   watch=win.setInterval(poll,250)},
  close,
  invalidate(){signature='';base=null},
  get view(){return {...view}},setView(v){setNow(v)},
  fit(){setNow(fitView(w,h,extent))},
  get limits(){return zoomRange(w,h,extent,MAX)},
  get size(){return {w,h,dpr}},
  stats,
  // Markers drawn by the last redraw ({label,cat,x,y} in CSS px) and the legend toggles.
  get drawnMarkers(){return drawn.map(d=>({label:markerLabel(d.c),cat:d.c.cat,x:d.x,y:d.y}))},
  get hiddenKinds(){return [...filters]},
  setKind(kind,on){toggle(kind,on);refreshLegend()},
  // New markers or owner overrides: read them now instead of at the next poll.
  refreshMarkers(){if(open&&readLists()){refreshLegend();invalidate()}},
  draw(){if(base)draw()}
 };
}
