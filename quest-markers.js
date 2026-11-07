// Floating quest markers: yellow "!" over NPCs with a quest you can start, yellow "?" over NPCs
// waiting for a hand-in. One InstancedMesh with a billboard shader (one draw call for every marker),
// gentle upward bob in the shader, no fog so they read at distance, and hidden whenever the NPC
// itself is culled by the character LOD. The glyph's foot sits a margin above the top of the NPC's
// head as the model is really built (face, hair and any hat, helmet or hood, measured from the
// skinned head meshes in their current pose, so tall, short, scaled and mounted NPCs all clear),
// and the billboard grows upward from there, so a far-away (larger) marker never sinks into the
// head either. The same markers are drawn on the minimap in the map-icons.js badge style, and
// the givers who start a quest chain are listed for the world map (chainGivers).
import {giverMarkers,chainStarts} from './quest-guide.js?v=release-20261107-qa2g163';
import {drawMarker} from './map-icons.js?v=release-20261107-qa2g163';

export const MARKER_GLYPHS=['!','?'];
export const MARKER_MAX_DISTANCE=160;
// Clearance between the head top (hat included) and the foot of the glyph, in metres at scale 1.
export const MARKER_MARGIN=.3;
// Head-top heights are re-measured this often (ms) per NPC (outfits stream in, NPCs mount up),
// and at most this many per frame.
export const HEAD_REMEASURE_MS=4000,HEAD_MEASURES_PER_FRAME=2;
// Fallback when nothing can be measured (no model yet): a scaled character's head top plus margin.
export const markerHeight=root=>(root?.position?.y||0)+3.25*Math.min(1.6,Math.max(.85,root?.scale?.y||1));
// Marker anchor (the glyph's foot) from a measured head top (world Y): head top + scaled margin.
export const markerAnchor=(root,headTop)=>Number.isFinite(headTop)?headTop+MARKER_MARGIN*Math.min(1.6,Math.max(.85,root?.scale?.y||1)):markerHeight(root);
// Screen-stable size: grows with distance so it stays readable far away, never below 1 (0.8 m).
export const markerScale=distance=>Math.max(1,Math.min(4,distance/12));

// ---- head-top measurement
// What counts as the head: for a skinned humanoid (humanoid.js) its face, visible hair / beard,
// the worn helm slot (hats, helmets, hoods) and anything attached under the Head bone; for any
// other model (creatures, props as NPCs) every visible mesh except invisible hit volumes and
// held items. Weapons and raised arms never lift the marker.
const isHitVolume=o=>o.material&&!Array.isArray(o.material)&&o.material.visible===false;
function visibleUpTo(o,stop){for(let n=o;n&&n!==stop;n=n.parent)if(!n.visible)return false;return true}
export function headMeshes(actor){
 const root=actor?.root,rig=actor?.rig;if(!root)return [];const out=[];
 if(rig&&Array.isArray(rig.faceMeshes)){
  for(const m of [...rig.faceMeshes,...(rig.hairMeshes||[]),...(rig.parts?.helm?.meshes||[])])if(m&&!out.includes(m))out.push(m);
  rig.head?.traverse?.(o=>{if(o.isMesh&&!out.includes(o))out.push(o)});
 }else root.traverse(o=>{if(o.isMesh&&!isHitVolume(o)&&!/hand-socket/.test(o.parent?.name||''))out.push(o)});
 return out.filter(m=>!isHitVolume(m)&&visibleUpTo(m,root.parent));
}
// Highest world Y of one mesh: skinned meshes vertex by vertex in their current pose (local
// skinning aware: getVertexPosition), others from their geometry box.
function meshTop(mesh,v,box){
 const g=mesh.geometry,pos=g?.getAttribute?.('position');if(!pos)return -Infinity;
 if(mesh.isSkinnedMesh&&mesh.getVertexPosition){let top=-Infinity;const step=pos.count>6000?2:1;for(let i=0;i<pos.count;i+=step){mesh.getVertexPosition(i,v);v.applyMatrix4(mesh.matrixWorld);if(v.y>top)top=v.y}return top}
 if(!g.boundingBox)g.computeBoundingBox();box.copy(g.boundingBox).applyMatrix4(mesh.matrixWorld);return box.max.y;
}
// The world Y of the top of an NPC's head (hat included), or null when it has no measurable model.
export function measureHeadTop(T,actor,scratch={v:new T.Vector3(),box:new T.Box3()}){
 const root=actor?.root;if(!root)return null;root.updateWorldMatrix(true,true);let top=-Infinity;
 for(const m of headMeshes(actor))top=Math.max(top,meshTop(m,scratch.v,scratch.box));
 return Number.isFinite(top)&&top>root.position.y?top:null;
}

function glyphTexture(T){
 const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d');
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 112px Georgia, "Times New Roman", serif';ctx.lineJoin='round';
 MARKER_GLYPHS.forEach((g,i)=>{const x=64+i*128,y=68;ctx.lineWidth=20;ctx.strokeStyle='#2a1a04';ctx.strokeText(g,x,y);const grad=ctx.createLinearGradient(0,14,0,120);grad.addColorStop(0,'#fff6b0');grad.addColorStop(.45,'#ffd23a');grad.addColorStop(1,'#e09a12');ctx.fillStyle=grad;ctx.fillText(g,x,y);ctx.lineWidth=3;ctx.strokeStyle='#fff7cf';ctx.globalAlpha=.6;ctx.strokeText(g,x-2,y-2);ctx.globalAlpha=1});
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.userData.entityOwned=true;return t;
}

// actorFor(id): the NPC actor ({root,rig,profile}); locate(id): {x,z,name} of a giver anywhere in
// the world (its home position, for the world map, even when its body is not streamed in).
export function createQuestMarkers(T,scene,{actorFor=()=>null,locate=null,max=48}={}){
 const time={value:0},map=glyphTexture(T);
 const material=new T.ShaderMaterial({uniforms:{uTime:time,uMap:{value:map}},transparent:true,depthWrite:false,depthTest:true,fog:false,
  vertexShader:`attribute float aGlyph;attribute float aPhase;attribute float aScale;uniform float uTime;varying vec2 vUv;
   void main(){vec3 world=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;world.y+=(sin(uTime*2.3+aPhase)+1.)*.07*aScale;
    vec4 view=viewMatrix*vec4(world,1.);view.xy+=(position.xy+vec2(0.,.44))*aScale;gl_Position=projectionMatrix*view;vUv=vec2((uv.x+aGlyph)*.5,uv.y);}`,
  fragmentShader:`uniform sampler2D uMap;varying vec2 vUv;void main(){vec4 c=texture2D(uMap,vUv);if(c.a<.05)discard;gl_FragColor=vec4(c.rgb,c.a);
   #include <colorspace_fragment>
   }`});
 const geometry=new T.PlaneGeometry(.8,.8);
 const glyph=new T.InstancedBufferAttribute(new Float32Array(max),1),phase=new T.InstancedBufferAttribute(new Float32Array(max),1),scale=new T.InstancedBufferAttribute(new Float32Array(max),1);
 geometry.setAttribute('aGlyph',glyph);geometry.setAttribute('aPhase',phase);geometry.setAttribute('aScale',scale);
 const mesh=new T.InstancedMesh(geometry,material,max);mesh.count=0;mesh.frustumCulled=false;mesh.renderOrder=30;mesh.userData.questMarkers=true;scene.add(mesh);
 let markers=new Map(),signature='',stamp=0,rows=[],measures=0;const m4=new T.Matrix4(),shown=[],heads=new WeakMap(),scratch={v:new T.Vector3(),box:new T.Box3()};
 // Head top (world Y) of a giver: measured when first seen, then re-measured every
 // HEAD_REMEASURE_MS within a per-frame budget. While the build is the same (scale, seat
 // height, helm) the highest measurement is kept, so a giver bending over its work does not
 // pull the marker down and back up; a new helm, scale or mount measures afresh.
 const build=(a,root)=>root.scale.y.toFixed(3)+'|'+(a.rig?.model?.position.y||0).toFixed(3)+'|'+(a.rig?.parts?.helm?.key||'')+'|'+(a.rig?.parts?.helm?.meshes?.length||0);
 function headTop(a,root,now){let h=heads.get(a);const first=!h,sig=build(a,root);
  if(first||h.sig!==sig||now-h.at>HEAD_REMEASURE_MS&&measures<HEAD_MEASURES_PER_FRAME){if(!first)measures++;const top=measureHeadTop(T,a,scratch),offset=top==null?null:top-root.position.y;
   h={offset:!first&&h.sig===sig&&h.offset!=null&&offset!=null?Math.max(h.offset,offset):offset,at:now,sig};heads.set(a,h)}
  return h.offset!=null?root.position.y+h.offset:null}
 const visibleRoot=a=>{const root=a?.root;if(!root||!root.visible||a.deleted||a.lodHidden)return null;for(let o=root;o;o=o.parent)if(!o.visible)return null;return root};
 return {mesh,
  get markers(){return markers},
  get stamp(){return stamp},
  // quests: snapshot rows; ctx: {trainee,carried,skillLevel}
  sync(quests,ctx){rows=Array.isArray(quests)?quests:[];const next=giverMarkers(quests,ctx),sig=[...next].map(([k,v])=>k+v).sort().join('|');if(sig!==signature){signature=sig;markers=next;stamp++}},
  frame(camera,now=performance.now()){
   time.value=now/1000;shown.length=0;measures=0;let n=0;
   for(const [id,kind]of markers){if(n>=max)break;const a=actorFor(id),root=visibleRoot(a);if(!root)continue;
    const d=root.position.distanceTo(camera.position);if(d>MARKER_MAX_DISTANCE)continue;
    const y=markerAnchor(root,headTop(a,root,now));m4.makeTranslation(root.position.x,y,root.position.z);mesh.setMatrixAt(n,m4);
    glyph.array[n]=kind==='?'?1:0;phase.array[n]=(id.length*1.7+n)%6.28;scale.array[n]=markerScale(d);shown.push({id,kind,x:root.position.x,y,z:root.position.z});n++}
   mesh.count=n;mesh.instanceMatrix.needsUpdate=true;glyph.needsUpdate=phase.needsUpdate=scale.needsUpdate=true;
  },
  // World map: every marked giver with a body in the world, as {id,kind,x,z}.
  givers(){const out=[];for(const [id,kind]of markers){const a=actorFor(id),root=a?.root;if(!root||a.deleted)continue;out.push({id,kind,x:root.position.x,z:root.position.z,name:a.profile?.name||a.name})}return out},
  // Markers placed by the last frame: {id,kind,x,y,z} (y: the glyph's foot).
  get shown(){return shown},
  // World map: givers who start a quest chain or a big quest (quest-guide.js chainStarts), one
  // per giver at its home position: {id,x,z,giverName,quests:[names],started} (started: every
  // chain this giver starts is already begun or finished by this player).
  chainGivers(){const by=new Map();for(const s of chainStarts(rows)){if(!s.giver)continue;let g=by.get(s.giver);if(!g)by.set(s.giver,g={id:s.giver,all:[],open:[]});g.all.push(s.name);if(!s.started)g.open.push(s.name)}
   const out=[];for(const g of by.values()){const a=actorFor(g.id),at=locate?.(g.id)||(a?.root&&!a.deleted?{x:a.root.position.x,z:a.root.position.z}:null);if(!at||!Number.isFinite(+at.x)||!Number.isFinite(+at.z))continue;
    out.push({id:g.id,x:+at.x,z:+at.z,giverName:a?.profile?.name||at.name||a?.name||null,quests:g.open.length?g.open:g.all,started:!g.open.length})}
   return out},
  // Minimap: project(x,z) -> {x,y} canvas pixels or null when off the map. The quest badge of
  // map-icons.js with a gold '!' (quest to start) or '?' (hand in); '?' drawn last, on top.
  // Returns how many badges were drawn.
  drawMinimap(ctx,project,{size=13,dpr=1}={}){
   const list=[];for(const [id,kind]of markers){const a=actorFor(id),root=a?.root;if(!root||a.deleted)continue;const p=project(root.position.x,root.position.z);if(p)list.push({x:p.x,y:p.y,kind})}
   // Hand-ins first; a badge that would cover one already placed is left out (no pile-ups).
   list.sort((a,b)=>(b.kind==='?')-(a.kind==='?'));const placed=[],gap=size*.8;
   for(const m of list){if(placed.some(q=>Math.abs(q.x-m.x)<gap&&Math.abs(q.y-m.y)<gap))continue;placed.push(m)}
   for(const m of placed.reverse())drawMarker(ctx,{cat:'quest',mark:m.kind},m.x,m.y,size,dpr);
   return placed.length;
  },
  dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();map.dispose()}};
}
