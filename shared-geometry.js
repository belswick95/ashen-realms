// Shared, pooled geometry and materials for procedurally built models
// (monsters, NPC accessories, props). Every creature used to allocate a fresh
// 20x14 sphere for each body part and its own materials, so a pack of wolves
// streaming in meant dozens of GPU buffer uploads and a hitch. Pooled
// resources are flagged `userData.eldervaleShared`: disposeEntityResources,
// the static batchers and the model dispose() functions leave them alone.
// The pools are keyed per THREE namespace so Node tests and the browser never mix.
const pools=new WeakMap();
function pool(T){let p=pools.get(T);if(!p)pools.set(T,p={geometry:new Map(),material:new Map(),hits:0,misses:0});return p}
const round=v=>typeof v==='number'?Math.round(v*1e4)/1e4:v;
// Geometry constructors by short name; parameters are the THREE constructor's.
const MAKERS={sphere:'SphereGeometry',box:'BoxGeometry',cone:'ConeGeometry',cylinder:'CylinderGeometry',ring:'RingGeometry',icosahedron:'IcosahedronGeometry',dodecahedron:'DodecahedronGeometry',circle:'CircleGeometry',plane:'PlaneGeometry',torus:'TorusGeometry'};
export function geometryKey(kind,params){return kind+'('+params.map(round).join(',')+')'}
export function sharedGeometry(T,kind,...params){
 const p=pool(T),key=geometryKey(kind,params);let g=p.geometry.get(key);
 if(g){p.hits++;return g}
 const ctor=T[MAKERS[kind]];if(!ctor)throw Error('Unknown shared geometry '+kind);
 g=new ctor(...params);g.userData.eldervaleShared=true;g.userData.sharedKey=key;p.geometry.set(key,g);p.misses++;return g;
}
// Any geometry built by `make` once per key (shapes, lathes, sculpted rocks).
export function sharedCustomGeometry(T,key,make){
 const p=pool(T);let g=p.geometry.get('custom:'+key);if(g){p.hits++;return g}
 g=make();g.userData.eldervaleShared=true;g.userData.sharedKey='custom:'+key;p.geometry.set('custom:'+key,g);p.misses++;return g;
}
export function sharedMaterial(T,key,make){
 const p=pool(T);let m=p.material.get(key);if(m){p.hits++;return m}
 m=make();m.userData.eldervaleShared=true;p.material.set(key,m);p.misses++;return m;
}
export const isShared=resource=>!!resource?.userData?.eldervaleShared;
export function sharedStats(T){const p=pool(T);return {geometries:p.geometry.size,materials:p.material.size,hits:p.hits,misses:p.misses}}
// Dispose what a model owns; pooled geometry and materials stay alive.
export function disposeOwned(root){const done=new Set();root.traverse(o=>{for(const r of [o.geometry,...(Array.isArray(o.material)?o.material:[o.material])]){if(!r||isShared(r)||done.has(r))continue;done.add(r);r.dispose?.()}})}
// Every shared material and geometry, for shader warm-up (renderer.compile).
export function sharedMaterials(T){return [...pool(T).material.values()]}
