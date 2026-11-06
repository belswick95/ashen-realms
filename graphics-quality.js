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
 // Meshes merged into a cell batch (static-batch.js) keep their own layer.
 function setLayer(root,hide){root.traverse(o=>{if(o.userData?.cellBatched)return;if(hide)o.layers.set(HIDDEN_LAYER);else o.layers.set(0)})}
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

// Phones: a small touch screen (a landscape phone is at most ~500 CSS px tall)
// driving a 3x canvas on a phone-class GPU. They start on the low tier with a
// tighter pixel-ratio cap; the frame governor still adapts from there.
export function isPhone({ua='',maxTouchPoints=0,coarse=false,touch=false,width=0,height=0}={}){
 if(/iPhone|iPod/.test(ua)||/Android/.test(ua)&&/Mobile/.test(ua))return true;
 if(/iPad/.test(ua)||!(touch||coarse||maxTouchPoints>0)||/Windows|CrOS|Linux x86/.test(ua))return false;
 return Math.min(width||Infinity,height||Infinity)<=500;
}

// Character level of detail by camera distance (metres) and quality tier:
// animate every frame up close, `halfRate` updates a second further out,
// `farRate` beyond that, and past `draw` the character is neither drawn,
// shadowed nor animated. Characters cast shadows only within `shadow` metres:
// about the sun's shadow-map radius for the tier (sun-shadow.js), so the
// cut-off sits where shadows fade anyway.
// The ranges are generous on purpose: a busy city (Birchford) keeps dozens of
// townsfolk 20-60 m from the camera, and the earlier 40 m draw / 10 Hz limits
// made them pop in and out as the camera turned and step like stop-motion.
// Skinning is on the GPU, so a far character costs a mixer update, not a mesh.
export const CHARACTER_LOD={
 low:{full:14,half:30,draw:70,halfRate:30,farRate:20,shadow:0},
 medium:{full:20,half:40,draw:80,halfRate:30,farRate:20,shadow:22},
 high:{full:30,half:55,draw:95,halfRate:30,farRate:24,shadow:32},
 ultra:{full:40,half:70,draw:110,halfRate:30,farRate:30,shadow:38}
};
// A hidden character has to come this much nearer than `draw` to reappear, so
// one standing on the boundary (or a camera bobbing across it) does not flicker.
export const CHARACTER_LOD_HYSTERESIS=4;
export function characterLod(distance,preset='high',{focus=false,hidden=false}={}){
 const t=CHARACTER_LOD[preset]||CHARACTER_LOD.high,shadow=focus||distance<=t.shadow;
 if(focus||distance<=t.full)return {draw:true,interval:0,level:0,shadow};
 if(!(distance<=t.draw-(hidden?CHARACTER_LOD_HYSTERESIS:0)))return {draw:false,interval:Infinity,level:3,shadow:false};
 return distance<=t.half?{draw:true,interval:1/t.halfRate,level:1,shadow}:{draw:true,interval:1/t.farRate,level:2,shadow};
}
// Frame time to advance a throttled animation this frame (0 = skip it).
// `state.lodClock` carries the time since its last update; `phase` (0..1)
// staggers actors so their throttled updates land on different frames.
export function lodStep(state,dt,interval,phase=0){
 if(!(interval>0)){const step=dt+(state.lodClock||0);state.lodClock=0;return step}
 if(state.lodClock===undefined)state.lodClock=(((phase%1)+1)%1)*interval;
 state.lodClock+=dt;if(state.lodClock<interval*.999)return 0;
 const step=state.lodClock;state.lodClock=0;return step;
}

// Gait hold for server-driven walkers. Interpolated NPCs and monsters can stand
// still for a frame or two between snapshots; feeding that straight to the
// animator flips walk -> idle -> walk (restarting the walk clip, and snapping
// procedural legs straight). While the actor moved within the last `hold`
// seconds, keep reporting its last ground speed and a token distance so the
// gait carries on; a real stop shows after the hold.
export function holdGait(state,step,distance,hold=.3){
 const speed=distance/Math.max(step,.001);
 if(distance>1e-4){state.gaitHold=hold;state.gaitSpeed=speed;return {distance,speed}}
 state.gaitHold=Math.max(0,(state.gaitHold||0)-step);
 if(state.gaitHold>0&&state.gaitSpeed>.15)return {distance:Math.max(distance,2e-4),speed:state.gaitSpeed};
 return {distance,speed};
}
