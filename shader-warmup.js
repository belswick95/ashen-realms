// Shader warm-up. The first time a material variant is drawn, WebGL compiles
// and links its program on the main thread: walking up to the castle used to
// compile ~50 programs in one frame (a multi-second freeze on SwiftShader,
// hundreds of milliseconds on an iPad). Shortly after the world loads, one
// throwaway copy of every prop and creature model is built off-scene and its
// programs compiled against the real scene lights and fog, one model per idle
// slice, so later streaming only reuses programs that already exist.

// Templates whose models are built elsewhere (houses, ground patches, roads)
// or are pure markers are skipped.
const SKIP=new Set(['cottage','bank','inn','forge','plaza','road','terrain_grass','terrain_sand','terrain_stone','terrain_snow','hunting_ground','construction_site']);
// One warm-up entry per model family: every object template, every monster
// species, a roster-style variant (tint, horns, glowing eyes, aura) and one
// humanoid NPC (they share the character materials).
export function warmupList(templates){
 const out=[],species=new Set();let npc=false;
 for(const [id,t] of Object.entries(templates)){
  if(t.kind==='object'&&!SKIP.has(id))out.push({kind:'object',id,data:{...t,template:id,x:0,z:0}});
  else if(t.kind==='monster'&&!species.has(t.species)){species.add(t.species);out.push({kind:'actor',id,data:{...t,template:id,kind:'monster',name:id}})}
  else if(t.kind==='npc'&&!npc){npc=true;out.push({kind:'actor',id,data:{...t,template:id,kind:'npc',name:id}})}
 }
 out.push({kind:'actor',id:'roster-variant',data:{species:'wolf',kind:'monster',tint:0x6a3d7a,accent:0xe0c060,horns:true,spikes:true,eyes:0xff4030,aura:0xff8040}});
 return out;
}
// Builds, compiles and disposes each entry in turn, yielding between them.
// `compile(root)` may return a promise (renderer.compileAsync).
export async function runShaderWarmup(list,{build,compile,dispose,yieldTask=()=>Promise.resolve(),signal}={}){
 let done=0,failed=0;
 for(const item of list){if(signal?.aborted)break;let root=null;
  try{root=build(item);if(root)await compile(root)}catch{failed++}
  finally{if(root)try{dispose(root)}catch{}}
  done++;await yieldTask()}
 return {done,failed};
}
