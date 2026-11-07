// Standout looks for unique gear (unique-gear.js), kept cheap for phones:
//  * glow trim: the item's metal materials (already tier-tinted) get an emissive accent colour —
//    a material swap, no extra draw call; materials are shared per base material + accent;
//  * motes: one small THREE.Points per held item (8 points) with a shared geometry and a shared
//    material per accent; they drift in the vertex shader from one shared time uniform, so
//    animating every unique item on screen costs one uniform write per frame (tickUniqueLook);
//  * armour: the outfit material gets the accent as a pulsing emissive on its metal texels.
import {sharedCustomGeometry,sharedMaterial} from './shared-geometry.js?v=release-20261107-canopy152';

export const lookTime={value:0};
export function tickUniqueLook(seconds){lookTime.value=seconds%1000}
const MOTES={embers:{rise:.35,size:.07},frost:{rise:.12,size:.06},venom:{rise:-.1,size:.06},twin:{rise:.25,size:.07}};
const glowCache=new Map();
function glowMaterial(T,m,accent){
 const key=m.uuid+':'+accent.color;if(glowCache.has(key))return glowCache.get(key);
 const g=m.clone();g.emissive=new T.Color(accent.color);g.emissiveIntensity=accent.intensity??.22;g.name=(m.name||'')+'-unique';g.userData={...m.userData,eldervaleShared:true,uniqueAccent:accent.color};
 glowCache.set(key,g);return g;
}
function moteGeometry(T,height){
 return sharedCustomGeometry(T,'unique-motes:'+height,()=>{const g=new T.BufferGeometry(),p=new Float32Array(24),s=new Float32Array(8);
  for(let k=0;k<8;k++){const a=k*2.399;p[k*3]=Math.cos(a)*.06;p[k*3+1]=.15+height*(k/8);p[k*3+2]=Math.sin(a)*.06;s[k]=k/8}
  g.setAttribute('position',new T.BufferAttribute(p,3));g.setAttribute('seed',new T.BufferAttribute(s,1));g.boundingSphere=new T.Sphere(new T.Vector3(0,height/2,0),height);return g});
}
function moteMaterial(T,kind,color){
 const cfg=MOTES[kind]||MOTES.embers;
 return sharedMaterial(T,'unique-motes:'+kind+':'+color,()=>{const m=new T.PointsMaterial({color,size:cfg.size,transparent:true,opacity:.85,blending:T.AdditiveBlending,depthWrite:false,sizeAttenuation:true});
  m.onBeforeCompile=sh=>{sh.uniforms.lookTime=lookTime;sh.vertexShader=sh.vertexShader.replace('#include <common>','#include <common>\nuniform float lookTime;attribute float seed;')
   .replace('#include <begin_vertex>',`#include <begin_vertex>\n{float ph=fract(lookTime*0.45+seed);transformed.y+=${cfg.rise.toFixed(3)}*ph;transformed.x+=sin(lookTime*2.0+seed*6.283)*0.03;transformed.z+=cos(lookTime*1.7+seed*6.283)*0.03;}`)};
  m.customProgramCacheKey=()=>'unique-motes-'+kind;return m});
}
// Held items (weapons, shields): glow trim on metal + motes along the blade.
export function accentHeldItem(T,root,accent,{height=.9}={}){
 if(!accent||!root)return root;
 root.traverse(o=>{if(!o.isMesh)return;const swap=m=>((m.metalness||0)>.3||/steel|metal|iron|gold/i.test(m.name||'')||m.userData?.tierTint!=null)?glowMaterial(T,m,accent):m;o.material=Array.isArray(o.material)?o.material.map(swap):swap(o.material)});
 if(accent.motes){const pts=new T.Points(moteGeometry(T,height),moteMaterial(T,accent.motes,accent.color));pts.name='unique-motes';pts.frustumCulled=true;pts.castShadow=false;root.add(pts);
  if(accent.color2){const b=new T.Points(moteGeometry(T,height),moteMaterial(T,'frost',accent.color2));b.rotation.y=Math.PI;b.name='unique-motes-2';root.add(b)}}
 root.userData.uniqueAccent=accent.color;return root;
}
// Outfit material patch (character-assets.js outfitMaterial): pulsing accent on metal texels;
// tintMode 'all' recolours the whole texture (scale/leather armour), not only the metal.
export function accentOutfitShader(shader,accentColor,mode='metal'){
 shader.uniforms.lookTime=lookTime;shader.uniforms.uniqueAccent={value:accentColor};
 shader.fragmentShader=shader.fragmentShader.replace('#include <common>','#include <common>\nuniform float lookTime;uniform vec3 uniqueAccent;')
  .replace('#include <emissivemap_fragment>',`#include <emissivemap_fragment>\n{float uw=${mode==='all'?'0.06':'0.16*smoothstep(.35,.75,metalnessFactor)'};totalEmissiveRadiance+=uniqueAccent*uw*(0.3+0.15*sin(lookTime*2.2));}`);
}
