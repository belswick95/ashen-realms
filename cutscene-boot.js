// Boot order for a brand-new character's arrival cutscene. While the 2D prologue
// (tutorial-prologue.js) is on screen the client loads only what the opening scene shows — the
// castle, its courtyard and the Keep, the King and nearby people — and starts the 3D scene from
// there. Everything else (far regions, distant monsters, the shader warm-up of every model, the
// minimap and water reflections) waits until the scene is running or over.

// Rows within this distance of the player (who starts in the castle courtyard) are built before
// the world counts as loaded: the whole castle (walls ±49 m around its centre, 15 m north of the
// start) and the approach the opening shot sees. The rest streams in nearest-first afterwards.
export const CUTSCENE_FOCUS_RADIUS=90;

const prologue=()=>globalThis.eldervalePrologue;
const scene=()=>globalThis.eldervaleCutscene;
// A trainee's first load, with the arrival scene still to play.
export const cutsceneBootFocus=()=>!!prologue()?.active;
// The arrival scene is pending or playing: skip work nobody can see.
export const cutsceneBusy=()=>!!prologue()?.active||!!scene()?.active;

// Resolves `delay` ms after load, and never while the arrival scene is pending or playing (then
// `settle` ms after it ends), so heavy background work never competes with the opening scene.
export function afterArrival(delay=0,{settle=4000,poll=500,busy=cutsceneBusy,timer=setTimeout}={}){
 return new Promise(resolve=>{
  let waited=false,quietSince=null;
  const check=()=>{
   if(busy()){waited=true;quietSince=null;timer(check,poll);return}
   if(!waited){resolve();return}
   quietSince??=Date.now();if(Date.now()-quietSince>=settle)resolve();else timer(check,poll);
  };
  timer(check,delay);
 });
}

// No 3D frame is drawn while the prologue still covers the screen and the arrival scene has not
// placed its first shot: the first frames then compile only what the scene's camera sees, not the
// gameplay view behind the black card.
export const holdRender=()=>{const c=scene();if(c?.active)return !c.to&&!c.follow;return cutsceneBootFocus()};
// Water reflections are a second render of the whole scene with its own shader variants: from a
// trainee's first load the water keeps moving but reflects nothing until the shader warm-up (which
// compiles those variants in the background after the scene, game.js) has finished.
let reflectionsDeferred=false;
export function deferReflections(){if(cutsceneBootFocus())reflectionsDeferred=true;return cutsceneBusy()||reflectionsDeferred&&!globalThis.eldervaleShaderWarmup}

// Draws the scene's first shot once, clipped to a single pixel, while the prologue's black card still
// covers the canvas: every shader the opening shot needs (shadow pass included) compiles during the
// prologue's last lines instead of stalling the first visible frames. Only that shot's view is drawn,
// so only its materials compile.
export function prewarmShot({T,renderer,scene,camera,sun=null,eye,look}){
 const cam=camera.clone();cam.position.set(eye[0],eye[1],eye[2]);cam.lookAt(look[0],look[1],look[2]);cam.updateMatrixWorld(true);
 const test=renderer.getScissorTest(),box=renderer.getScissor(new T.Vector4());if(sun?.shadow)sun.shadow.needsUpdate=true;
 try{renderer.setScissorTest(true);renderer.setScissor(0,0,1,1);renderer.render(scene,cam)}finally{renderer.setScissor(box);renderer.setScissorTest(test)}
}
