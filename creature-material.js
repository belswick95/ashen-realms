// Shared original surface detail; no network textures or per-frame allocations.
const caches=new WeakMap();
export function creatureMaterial(T,color,kind='hide'){
 let cache=caches.get(T);if(!cache){cache=new Map();caches.set(T,cache)}const key=kind+color;if(cache.has(key))return cache.get(key);
 const m=new T.MeshStandardMaterial({color,roughness:kind==='stone'?.94:.78});
 if(typeof document!=='undefined'){let texture=cache.get(kind);if(!texture){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d');ctx.fillStyle='#d4d1c8';ctx.fillRect(0,0,128,128);let seed=173;const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};for(let i=0;i<2400;i++){const x=random()*128,y=random()*128;ctx.strokeStyle=random()>.5?'#ffffff35':'#22251b38';ctx.lineWidth=.5+random();ctx.beginPath();if(kind==='scales'){ctx.arc(x,y,2+random()*3,0,Math.PI)}else{ctx.moveTo(x,y);ctx.lineTo(x+(random()-.5)*3,y+2+random()*6)}ctx.stroke()}texture=new T.CanvasTexture(c);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;texture.userData.eldervaleShared=true;cache.set(kind,texture)}m.map=texture;m.bumpMap=texture;m.bumpScale=kind==='scales'?.025:.012;}
 m.userData.eldervaleShared=true;cache.set(key,m);return m;
}
