// Quest guidance: a soft, slightly transparent breadcrumb trail on the ground along the real walkable
// path (the client mirror of the server's tile BFS, tile-grid.js) toward the tracked objective,
// only the next ~25 m, fading in and out and re-planned as the player moves; a ring marks doors,
// stairs and cave entrances on the way. The minimap gets the objective icon, a faint path line and
// an edge arrow when the objective is off the map. Fed by quest-tracker.js onTarget().
// Cheap: one InstancedMesh (one draw call) + one ring mesh, matrices only rewritten on a re-plan,
// per-frame work is a few uniforms (no allocations).
import {TILE,tileOf,bfsRoute,FLAG} from './tile-grid.js?v=release-20261107-attacks134';

export const TRAIL={tiles:16,spacing:.86,skip:1.1,radius:32,fetchRadius:40,maxDots:48,replanMs:300,arrive:2.4};
const KEY='eldervale-quest-guidance';
export function guidanceSettings(owner={}){let mine={};try{mine=JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{}
 return {trail:owner.trail!==false&&mine.trail!==false,minimap:owner.minimap!==false&&mine.minimap!==false,tiles:Math.max(6,Math.min(40,Number(owner.length)||TRAIL.tiles))}}
export function saveGuidanceSettings(v){try{localStorage.setItem(KEY,JSON.stringify(v))}catch{}}

// Tile flag cache filled from the server feed (public.quest_guide_tiles); unknown tiles read 0.
const tk=(i,j)=>(i+32768)*65536+(j+32768);
export function createTileCache(){
 const flags=new Map(),doors=new Map();let center=null,radius=0;
 return {
  set(view){if(!view||!Array.isArray(view.tiles))return;if(view.center){const [ci,cj]=view.center,r=view.radius|0;for(let i=ci-r;i<=ci+r;i++)for(let j=cj-r;j<=cj+r;j++){const k=tk(i,j);flags.delete(k);doors.delete(k)}center=view.center;radius=r}
   for(const [i,j,f,door] of view.tiles){const k=tk(i,j);if(f)flags.set(k,f|0);if(door)doors.set(k,door|0)}},
  flagsAt:(i,j)=>flags.get(tk(i,j))||0,
  doorAt:(i,j)=>doors.get(tk(i,j))||0,
  // A fresh window is needed once the walker nears the edge of the known one.
  needs(i,j,margin=18){return !center||Math.max(Math.abs(i-center[0]),Math.abs(j-center[1]))>radius-margin},
  get size(){return flags.size}};
}

// Plan: tile route from the walker toward a world point (closest reachable tile when the goal is
// outside the search window or blocked). Returns [[x,z],...] tile centres.
export function planRoute(from,to,flagsAt,{radius=TRAIL.radius}={}){
 const start=[tileOf(from.x),tileOf(from.z)],goal=[tileOf(to.x),tileOf(to.z)];
 if(start[0]===goal[0]&&start[1]===goal[1])return [];
 return bfsRoute({start,goal,mode:'near',point:[to.x,to.z],reach:TILE*1.2,radius,alt:-1,flagsAt}).path;
}
// Dots every `spacing` units along player → path, skipping the first `skip` units, up to `max`
// units. Writes x,z,along triples into out (Float32Array) and returns the dot count.
export function layDots(from,path,{spacing=TRAIL.spacing,skip=TRAIL.skip,max=TRAIL.tiles*TILE,maxDots=TRAIL.maxDots}={},out=new Float32Array(maxDots*3)){
 let px=from.x,pz=from.z,walked=0,next=skip,n=0;
 for(const [x,z] of path){
  const dx=x-px,dz=z-pz,len=Math.hypot(dx,dz);
  while(len>0&&next<=walked+len&&next<=max&&n<maxDots){const t=(next-walked)/len;out[n*3]=px+dx*t;out[n*3+1]=pz+dz*t;out[n*3+2]=next/max;n++;next+=spacing}
  walked+=len;px=x;pz=z;if(next>max||n>=maxDots)break;
 }
 return n;
}
// First door tile on the route (closed or open doorway), as a hint spot: {x,z,kind:'door'} or null.
export function doorOnRoute(path,doorAt,limit=TRAIL.tiles){
 for(let k=0;k<path.length&&k<=limit;k++){const [x,z]=path[k];if(doorAt(tileOf(x),tileOf(z)))return {x,z,kind:'door'}}
 return null;
}
// Minimap edge arrow: where a target outside the visible disc points from, and the arrow angle.
export function edgeArrow(px,py,c,r,out={x:0,y:0,angle:0,inside:true}){
 const dx=px-c,dy=py-c,d=Math.hypot(dx,dy);out.inside=d<=r;out.angle=Math.atan2(dy,dx);
 const k=out.inside?1:r/Math.max(d,1e-6);out.x=c+dx*k;out.y=c+dy*k;return out;
}

const VERT=`attribute float aAlong;uniform vec2 uPlayer;varying float vAlong;varying float vNear;varying vec2 vUv;
void main(){vec4 w=modelMatrix*instanceMatrix*vec4(position,1.);vAlong=aAlong;vNear=distance(w.xz,uPlayer);vUv=uv;gl_Position=projectionMatrix*viewMatrix*w;}`;
const FRAG=`uniform float uTime;uniform float uOpacity;uniform float uTail;uniform vec3 uColor;varying float vAlong;varying float vNear;varying vec2 vUv;
void main(){float d=length(vUv-.5)*2.;float core=smoothstep(.55,.15,d);float glow=smoothstep(1.,.3,d)*.45;
 float pulse=.72+.28*sin(uTime*3.2-vAlong*14.);float tail=mix(1.,smoothstep(1.,.62,vAlong),uTail);float near=smoothstep(.7,1.5,vNear);
 float a=(core+glow)*pulse*tail*near*uOpacity*.62;if(a<.01)discard;gl_FragColor=vec4(mix(uColor,vec3(1.),core*.35),a);}`;
const RING_FRAG=`uniform float uTime;uniform float uOpacity;uniform vec3 uColor;varying vec2 vUv;
void main(){float d=length(vUv-.5)*2.;float w=.12+.04*sin(uTime*2.6);float ring=smoothstep(w,0.,abs(d-.72));float a=ring*uOpacity*.85;if(a<.01)discard;gl_FragColor=vec4(uColor,a);}`;

// heightAt(x,z); player() -> {x,z}; locate(id) -> {x,z} | null; fetchTiles(x,z,r) -> Promise(view);
// floor() -> current floor (the trail follows the ground floor grid only).
export function createQuestTrail(T,scene,{heightAt=()=>0,player,locate=()=>null,fetchTiles=null,floor=()=>0,owner=()=>({})}={}){
 const cache=createTileCache(),max=TRAIL.maxDots,dots=new Float32Array(max*3);
 const uniforms={uTime:{value:0},uOpacity:{value:0},uTail:{value:1},uPlayer:{value:new T.Vector2()},uColor:{value:new T.Color(0xffe39a)}};
 const geometry=new T.PlaneGeometry(.66,.66);geometry.rotateX(-Math.PI/2);
 const along=new T.InstancedBufferAttribute(new Float32Array(max),1);geometry.setAttribute('aAlong',along);
 const material=new T.ShaderMaterial({uniforms,vertexShader:VERT,fragmentShader:FRAG,transparent:true,depthWrite:false,fog:false,polygonOffset:true,polygonOffsetFactor:-2});
 const mesh=new T.InstancedMesh(geometry,material,max);mesh.count=0;mesh.frustumCulled=false;mesh.renderOrder=12;mesh.userData.questTrail=true;scene.add(mesh);
 const ringUniforms={uTime:uniforms.uTime,uOpacity:{value:0},uColor:{value:new T.Color(0xfff0c0)}};
 const ringGeo=new T.PlaneGeometry(1.5,1.5);ringGeo.rotateX(-Math.PI/2);
 const ring=new T.Mesh(ringGeo,new T.ShaderMaterial({uniforms:ringUniforms,vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:RING_FRAG,transparent:true,depthWrite:false,fog:false}));
 ring.visible=false;ring.renderOrder=12;ring.frustumCulled=false;scene.add(ring);
 const m4=new T.Matrix4();
 let step=null,settings=guidanceSettings(),enabled=true,goal=null,via=null,lastPlan=0,lastTile=NaN,lastGoalKey=NaN,path=[],pathXZ=new Float32Array(128),pathN=0,fetching=false,feed=!!fetchTiles,hint=null,target={x:0,z:0,ok:false};
 const goalPoint=()=>{if(!step?.target)return null;const t=step.target;if(typeof t==='object'&&Number.isFinite(t.x))return t;const p=locate(t);return p&&Number.isFinite(p.x)?p:null};
 function maybeFetch(p){
  if(!feed||fetching)return;const i=tileOf(p.x),j=tileOf(p.z);if(!cache.needs(i,j))return;fetching=true;
  Promise.resolve(fetchTiles(p.x,p.z,TRAIL.fetchRadius)).then(v=>{cache.set(v);lastTile=NaN}).catch(()=>{feed=false}).finally(()=>{fetching=false});
 }
 function plan(p,now){
  lastPlan=now;goal=goalPoint();target.ok=!!goal;if(goal){target.x=goal.x;target.z=goal.z}
  via=step?.via&&Number.isFinite(step.via.x)&&Math.hypot(p.x-step.via.x,p.z-step.via.z)>TRAIL.arrive?step.via:null;
  const aim=via||goal;
  if(!aim||Math.hypot(p.x-aim.x,p.z-aim.z)<TRAIL.arrive){mesh.count=0;pathN=0;hint=null;return}
  path=planRoute(p,aim,cache.flagsAt);pathN=Math.min(64,path.length);for(let k=0;k<pathN;k++){pathXZ[k*2]=path[k][0];pathXZ[k*2+1]=path[k][1]}
  const maxLen=settings.tiles*TILE,n=layDots(p,path,{max:maxLen,maxDots:max},dots);
  for(let k=0;k<n;k++){const x=dots[k*3],z=dots[k*3+1];m4.makeTranslation(x,heightAt(x,z)+.07,z);mesh.setMatrixAt(k,m4);along.array[k]=dots[k*3+2]}
  mesh.count=n;mesh.instanceMatrix.needsUpdate=true;along.needsUpdate=true;
  let total=0,px=p.x,pz=p.z;for(const [x,z] of path){total+=Math.hypot(x-px,z-pz);px=x;pz=z}uniforms.uTail.value=total>maxLen?1:0;
  hint=via?{x:via.x,z:via.z,kind:via.kind||'way',label:via.label||''}:doorOnRoute(path,cache.doorAt,settings.tiles);
  if(hint&&Math.hypot(hint.x-p.x,hint.z-p.z)<=maxLen+TILE){ring.position.set(hint.x,heightAt(hint.x,hint.z)+.08,hint.z);ring.visible=true}else ring.visible=false;
 }
 return {mesh,ring,cache,
  get path(){return path},get hint(){return hint},get target(){return target.ok?target:null},get settings(){return settings},
  // tracker.onTarget payload: {quest, step}
  setStep({step:s}={}){step=s||null;lastTile=NaN;lastGoalKey=NaN;lastPlan=0},
  configure(v){settings={...guidanceSettings(owner()),...v};lastTile=NaN},
  setEnabled(on){enabled=!!on},
  frame(now=performance.now()){
   uniforms.uTime.value=now/1000;
   const p=player?.();const on=enabled&&settings.trail&&!!step&&!!p&&(floor()|0)===0;
   if(p){uniforms.uPlayer.value.set(p.x,p.z);if(on||settings.minimap)maybeFetch(p)}
   // At most every replanMs: look the goal up and re-plan only when the walker's tile or the goal's tile changed.
   if(p&&step&&now-lastPlan>=TRAIL.replanMs){const g=goalPoint(),key=g?Math.round(g.x/TILE)*100003+Math.round(g.z/TILE):NaN,t=tileOf(p.x)*100003+tileOf(p.z);
    if(t!==lastTile||key!==lastGoalKey){lastTile=t;lastGoalKey=key;plan(p,now)}else lastPlan=now}
   else if(!step){mesh.count=0;pathN=0;hint=null;target.ok=false}
   // Ease opacity in/out (about a third of a second), hide the meshes when invisible.
   const want=on&&mesh.count>0?1:0,o=uniforms.uOpacity.value+(want-uniforms.uOpacity.value)*.12;uniforms.uOpacity.value=Math.abs(o-want)<.01?want:o;
   mesh.visible=uniforms.uOpacity.value>0;ringUniforms.uOpacity.value=ring.visible?uniforms.uOpacity.value:0;
  },
  // project(x,z) -> {x,y} minimap pixels (unclipped); c: centre/radius of the round minimap.
  drawMinimap(ctx,project,c,r){
   if(!settings.minimap||!step||!target.ok)return;
   ctx.save();
   if(pathN>1){ctx.beginPath();ctx.moveTo(c,c);for(let k=0;k<pathN;k++){const q=project(pathXZ[k*2],pathXZ[k*2+1]);ctx.lineTo(q.x,q.y)}
    ctx.lineWidth=2;ctx.setLineDash?.([3,3]);ctx.strokeStyle='rgba(255,226,130,.5)';ctx.stroke();ctx.setLineDash?.([])}
   const q=project(target.x,target.z),e=edgeArrow(q.x,q.y,c,r-9);
   if(e.inside){ctx.translate(q.x,q.y);ctx.rotate(Math.PI/4);ctx.fillStyle='#ffd23a';ctx.strokeStyle='#2a1a04';ctx.lineWidth=2;ctx.fillRect(-4,-4,8,8);ctx.strokeRect(-4,-4,8,8)}
   else{ctx.translate(e.x,e.y);ctx.rotate(e.angle);ctx.beginPath();ctx.moveTo(7,0);ctx.lineTo(-5,-6);ctx.lineTo(-2,0);ctx.lineTo(-5,6);ctx.closePath();ctx.fillStyle='#ffd23a';ctx.strokeStyle='#2a1a04';ctx.lineWidth=1.5;ctx.fill();ctx.stroke()}
   ctx.restore();
  },
  dispose(){mesh.removeFromParent();ring.removeFromParent();geometry.dispose();material.dispose();ringGeo.dispose();ring.material.dispose()}};
}

// Settings › Gameplay switches for the trail and the minimap path (saved on this device).
export function mountGuidanceSettings(panel,onChange=()=>{}){
 if(!panel||panel.querySelector('#quest-trail-setting'))return;
 const cur=(()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}})();
 const make=(id,key,text,title)=>{const label=document.createElement('label');label.className='setting-toggle';label.title=title;const box=document.createElement('input');box.type='checkbox';box.id=id;box.checked=cur[key]!==false;
  box.onchange=()=>{cur[key]=box.checked;saveGuidanceSettings(cur);onChange({...cur})};label.append(box,' '+text);return label};
 const first=panel.querySelector('label');
 const a=make('quest-trail-setting','trail','Quest guidance trail','Glowing footpath on the ground toward your current quest step'),b=make('quest-minimap-setting','minimap','Quest path on the minimap','Objective icon, faint path line and edge arrow on the minimap');
 if(first)first.after(a,b);else panel.prepend(a,b);
}
void FLAG;
