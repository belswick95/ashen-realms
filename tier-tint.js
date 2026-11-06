// Gear tier recolouring: equipment of a metal tier reuses the iron model and
// recolours only its metal; leather, wood and cloth keep their colours.
//  * Held items (weapons, shields) use flat glTF materials: metal materials
//    (metalness > .3) get a clone in the tier colour, keeping their relative shade.
//  * Outfit armour uses one texture atlas: a shader hook recolours texels whose
//    ORM metalness is high, preserving the texture's light and shade.
//  * Bows (wood tiers) recolour their wood materials instead.
const cache=new Map();
const lum=c=>.299*c.r+.587*c.g+.114*c.b;
function recoloured(T,material,tint,mode){
 const key=material.uuid+':'+tint+':'+mode;if(cache.has(key))return cache.get(key);
 const m=material.clone(),target=new T.Color(tint),shade=Math.max(.25,Math.min(1.6,lum(material.color)/Math.max(.05,lum(new T.Color(mode==='wood'?0x795239:0x959aa0)))));
 m.color.copy(target).multiplyScalar(shade);if(mode==='metal'&&lum(target)<.05)m.roughness=Math.max(.3,m.roughness);
 m.name=material.name+'-'+mode+'-'+tint.toString(16);m.userData={...material.userData,eldervaleShared:true,tierTint:tint};cache.set(key,m);return m;
}
// Recolour a held-item clone in place (materials are shared per base material and colour).
export function tintHeldItem(T,root,tint,mode='metal'){
 if(tint==null||!root)return root;
 root.traverse(o=>{if(!o.isMesh)return;const swap=m=>{const metal=(m.metalness||0)>.3||/steel|metal|iron|gold/i.test(m.name||''),wood=/wood/i.test(m.name||'');return (mode==='wood'?wood:metal)?recoloured(T,m,tint,mode):m};o.material=Array.isArray(o.material)?o.material.map(swap):swap(o.material)});
 root.userData.tierTint=tint;return root;
}
// Shader hook for textured outfit materials: recolour metal texels to the tier colour.
// Unique gear (unique-gear.js): mode 'all' recolours the whole texture (scale/leather), and an
// accent colour adds a pulsing emissive trim (unique-look.js accentOutfitShader).
export function tintOutfitMaterial(T,base,tint,{accent=null,mode='metal',accentShader=null}={}){
 const m=base.clone(),color=new T.Color(tint),glow=accent!=null&&accentShader?new T.Color(accent):null,suffix=(mode==='all'?'-all':'')+(glow?'-accent':'');
 m.userData={...base.userData,eldervaleShared:true,tierTint:tint,programKey:'|tier-metal'+suffix};
 m.onBeforeCompile=shader=>{shader.uniforms.tierTint={value:color};
  shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform vec3 tierTint;').replace('#include <metalnessmap_fragment>','#include <metalnessmap_fragment>\n{float tierLum=dot(diffuseColor.rgb,vec3(.299,.587,.114));float tierW='+(mode==='all'?'0.85':'smoothstep(.35,.75,metalnessFactor)')+';diffuseColor.rgb=mix(diffuseColor.rgb,tierTint*clamp(tierLum*2.4,.15,1.6),tierW);}');
  if(glow)accentShader(shader,glow,mode)};
 m.customProgramCacheKey=()=>'eldervale-tier-metal'+suffix;
 return m;
}
