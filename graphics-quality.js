// Automatic quality: device tier detection, dynamic resolution driven by the
// measured frame time, and distance culling for small scenery and characters.
// Everything here is pure or works on plain objects so it can be unit-tested.

// iPadOS Safari reports a desktop "Macintosh" user agent; the touch points give
// it away. Tablets render a large retina canvas on a phone-class GPU, so they
// start on the medium tier with a lower pixel-ratio cap.
export function isTablet({ua='',maxTouchPoints=0,coarse=false,touch=false}={}){
 if(/iPad/.test(ua))return true;
 if(/Macintosh/.test(ua)&&maxTouchPoints>1)return true;
 if(/Android/.test(ua)&&!/Mobile/.test(ua))return true;
 return !!(touch&&coarse&&maxTouchPoints>1&&!/Windows|CrOS|Linux x86/.test(ua));
}
export const tierOrder=['low','medium','high','ultra'];
// One step down the tier list (never below low).
export function lowerTier(preset){const i=tierOrder.indexOf(preset);return i>0?tierOrder[i-1]:'low'}

// Dynamic resolution: an exponential average of frame time drives a render
// scale between min and 1. Drops quickly when frames run long, recovers slowly,
// and reports when even the minimum scale cannot hold the target so the caller
// can fall back a quality tier. Frames over 250 ms (tab switches, loading
// stalls) are ignored.
export function createFrameGovernor({target=1000/60,min=.6,max=1,step=.1,settle=1500,recover=5000,degrade=6000}={}){
 let scale=max,ema=target,lastChange=-Infinity,goodSince=null,badAtMinSince=null,started=null;
 return {
  get scale(){return scale},get average(){return ema},
  reset(){scale=max;ema=target;lastChange=-Infinity;goodSince=null;badAtMinSince=null;started=null},
  sample(dt,now){
   if(!(dt>0)||dt>250)return null;started??=now;
   ema+=(dt-ema)*.08;
   if(now-started<settle)return null;
   const slow=ema>target*1.22,fast=ema<target*1.06;
   if(slow&&scale>min&&now-lastChange>=settle){scale=Math.max(min,+(scale-step).toFixed(3));lastChange=now;goodSince=null;return 'scale'}
   if(slow&&scale<=min){badAtMinSince??=now;if(now-badAtMinSince>=degrade){badAtMinSince=null;scale=max;lastChange=now;ema=target;return 'tier'}}else badAtMinSince=null;
   if(fast){goodSince??=now;if(scale<max&&now-goodSince>=recover&&now-lastChange>=recover){scale=Math.min(max,+(scale+step/2).toFixed(3));lastChange=now;goodSince=now;return 'scale'}}else goodSince=null;
   return null;
  }
 };
}

// How far a small object stays drawn: past the fog start, further for bigger
// objects so houses and towers never pop while pebbles and props do early.
export function cullDistance(radius,{fogNear,far}){return Math.min(far,fogNear*.9+Math.max(.5,radius)*16)}
export const CULL_MAX_RADIUS=12;
// Objects that are hidden by distance move to a spare layer, so the main and
// shadow cameras skip them without touching `visible`, which gameplay owns
// (depleted rocks, removed actors, interiors...).
export const HIDDEN_LAYER=31;
export function createDistanceCuller({radiusOf,exclude=()=>false,interval=250,measureBudget=250}={}){
 const radii=new WeakMap(),hidden=new WeakSet();let next=0,stats={checked:0,hidden:0};
 function setLayer(root,hide){root.traverse(o=>{if(hide)o.layers.set(HIDDEN_LAYER);else o.layers.set(0)})}
 return {
  get stats(){return stats},
  isHidden:o=>hidden.has(o),
  update(objects,camera,{fogNear,far},now=0,force=false){
   if(!force&&now<next)return false;next=now+interval;let checked=0,count=0,measured=0;const cx=camera.x,cz=camera.z,cy=camera.y;
   for(const o of objects){
    if(exclude(o))continue;let r=radii.get(o);if(r===undefined){
     // Measuring is a full hierarchy walk: spread first sightings over passes.
     if(measured>=measureBudget)continue;measured++;const m=radiusOf(o),p=o.position;
     // Bounds are kept relative to the object's position: a group can sit at
     // the origin while its meshes are placed far away.
     r=typeof m==='number'?{radius:m,ox:0,oy:0,oz:0}:{radius:m.radius,ox:m.center.x-p.x,oy:m.center.y-p.y,oz:m.center.z-p.z};radii.set(o,r)}
    if(!(r.radius<=CULL_MAX_RADIUS)){if(hidden.has(o)){hidden.delete(o);setLayer(o,false)}continue}
    checked++;const p=o.position,dx=p.x+r.ox-cx,dy=p.y+r.oy-cy,dz=p.z+r.oz-cz,limit=cullDistance(r.radius,{fogNear,far}),hide=dx*dx+dy*dy+dz*dz>limit*limit;
    if(hide)count++;
    // Re-apply while hidden: actors gain meshes (equipment, effects) later.
    if(hide){if(!hidden.has(o))hidden.add(o);setLayer(o,true)}else if(hidden.has(o)){hidden.delete(o);setLayer(o,false)}
   }
   stats={checked,hidden:count};return true;
  }
 };
}
