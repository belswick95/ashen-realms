// Floating quest markers: yellow "!" over NPCs with a quest you can start, yellow "?" over NPCs
// waiting for a hand-in. One InstancedMesh with a billboard shader (one draw call for every marker),
// gentle bob in the shader, no fog so they read at distance, and hidden whenever the NPC itself is
// culled by the character LOD. The same markers are drawn on the minimap.
import {giverMarkers} from './quest-guide.js?v=release-20261107-buildings149';

export const MARKER_GLYPHS=['!','?'];
export const MARKER_MAX_DISTANCE=160;
// Marker height over an NPC root (metres): above the head of a scaled character.
export const markerHeight=root=>(root?.position?.y||0)+2.9*Math.min(1.6,Math.max(.85,root?.scale?.y||1));
// Screen-stable size: grows with distance so it stays readable far away, never below 1 (0.8 m).
export const markerScale=distance=>Math.max(1,Math.min(4,distance/12));

function glyphTexture(T){
 const c=document.createElement('canvas');c.width=256;c.height=128;const ctx=c.getContext('2d');
 ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 112px Georgia, "Times New Roman", serif';ctx.lineJoin='round';
 MARKER_GLYPHS.forEach((g,i)=>{const x=64+i*128,y=68;ctx.lineWidth=20;ctx.strokeStyle='#2a1a04';ctx.strokeText(g,x,y);const grad=ctx.createLinearGradient(0,14,0,120);grad.addColorStop(0,'#fff6b0');grad.addColorStop(.45,'#ffd23a');grad.addColorStop(1,'#e09a12');ctx.fillStyle=grad;ctx.fillText(g,x,y);ctx.lineWidth=3;ctx.strokeStyle='#fff7cf';ctx.globalAlpha=.6;ctx.strokeText(g,x-2,y-2);ctx.globalAlpha=1});
 const t=new T.CanvasTexture(c);t.colorSpace=T.SRGBColorSpace;t.userData.entityOwned=true;return t;
}

export function createQuestMarkers(T,scene,{actorFor=()=>null,max=48}={}){
 const time={value:0},map=glyphTexture(T);
 const material=new T.ShaderMaterial({uniforms:{uTime:time,uMap:{value:map}},transparent:true,depthWrite:false,depthTest:true,fog:false,
  vertexShader:`attribute float aGlyph;attribute float aPhase;attribute float aScale;uniform float uTime;varying vec2 vUv;
   void main(){vec3 world=(modelMatrix*instanceMatrix*vec4(0.,0.,0.,1.)).xyz;world.y+=sin(uTime*2.3+aPhase)*.12*aScale;
    vec4 view=viewMatrix*vec4(world,1.);view.xy+=position.xy*aScale;gl_Position=projectionMatrix*view;vUv=vec2((uv.x+aGlyph)*.5,uv.y);}`,
  fragmentShader:`uniform sampler2D uMap;varying vec2 vUv;void main(){vec4 c=texture2D(uMap,vUv);if(c.a<.05)discard;gl_FragColor=vec4(c.rgb,c.a);
   #include <colorspace_fragment>
   }`});
 const geometry=new T.PlaneGeometry(.8,.8);
 const glyph=new T.InstancedBufferAttribute(new Float32Array(max),1),phase=new T.InstancedBufferAttribute(new Float32Array(max),1),scale=new T.InstancedBufferAttribute(new Float32Array(max),1);
 geometry.setAttribute('aGlyph',glyph);geometry.setAttribute('aPhase',phase);geometry.setAttribute('aScale',scale);
 const mesh=new T.InstancedMesh(geometry,material,max);mesh.count=0;mesh.frustumCulled=false;mesh.renderOrder=30;mesh.userData.questMarkers=true;scene.add(mesh);
 let markers=new Map(),signature='',stamp=0;const m4=new T.Matrix4(),shown=[];
 const visibleRoot=a=>{const root=a?.root;if(!root||!root.visible||a.deleted||a.lodHidden)return null;for(let o=root;o;o=o.parent)if(!o.visible)return null;return root};
 return {mesh,
  get markers(){return markers},
  get stamp(){return stamp},
  // quests: snapshot rows; ctx: {trainee,carried,skillLevel}
  sync(quests,ctx){const next=giverMarkers(quests,ctx),sig=[...next].map(([k,v])=>k+v).sort().join('|');if(sig!==signature){signature=sig;markers=next;stamp++}},
  frame(camera,now=performance.now()){
   time.value=now/1000;shown.length=0;let n=0;
   for(const [id,kind]of markers){if(n>=max)break;const a=actorFor(id),root=visibleRoot(a);if(!root)continue;
    const d=root.position.distanceTo(camera.position);if(d>MARKER_MAX_DISTANCE)continue;
    m4.makeTranslation(root.position.x,markerHeight(root),root.position.z);mesh.setMatrixAt(n,m4);
    glyph.array[n]=kind==='?'?1:0;phase.array[n]=(id.length*1.7+n)%6.28;scale.array[n]=markerScale(d);shown.push({id,kind,x:root.position.x,z:root.position.z});n++}
   mesh.count=n;mesh.instanceMatrix.needsUpdate=true;glyph.needsUpdate=phase.needsUpdate=scale.needsUpdate=true;
  },
  // World map: every marked giver with a body in the world, as {id,kind,x,z}.
  givers(){const out=[];for(const [id,kind]of markers){const a=actorFor(id),root=a?.root;if(!root||a.deleted)continue;out.push({id,kind,x:root.position.x,z:root.position.z,name:a.profile?.name||a.name})}return out},
  // Minimap: project(x,z) -> {x,y} canvas pixels or null when off the map.
  drawMinimap(ctx,project){
   ctx.save();ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='900 13px Georgia,serif';ctx.lineJoin='round';
   for(const [id,kind]of markers){const a=actorFor(id),root=a?.root;if(!root||a.deleted)continue;const p=project(root.position.x,root.position.z);if(!p)continue;
    ctx.lineWidth=3.5;ctx.strokeStyle='#1d1404';ctx.strokeText(kind,p.x,p.y);ctx.fillStyle='#ffd23a';ctx.fillText(kind,p.x,p.y)}
   ctx.restore();
  },
  dispose(){mesh.removeFromParent();geometry.dispose();material.dispose();map.dispose()}};
}
