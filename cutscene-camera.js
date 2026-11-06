// Cutscene camera framing (pure maths, no Three.js): shots built from where the subjects really
// stand, for the viewport's real aspect ratio (portrait iPad included), kept inside the room the
// subjects are in and never behind a wall, a closed door or a bench. tutorial.js resolves a shot
// once when it starts (and again if the viewport changes); camera-obstruction.js then pulls the
// eye in every frame as a last guard.
//
// Points are {x,y,z}. `clear(from,to)` answers whether the straight line between two points is free
// of occluders (tutorial.js raycasts the game's camera occluders; tests use boxes).

const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z}),add=(a,b,s=1)=>({x:a.x+b.x*s,y:a.y+b.y*s,z:a.z+b.z*s});
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z,len=a=>Math.hypot(a.x,a.y,a.z),norm=a=>{const l=len(a)||1;return {x:a.x/l,y:a.y/l,z:a.z/l}};
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const flat=(a,b)=>{const dx=b.x-a.x,dz=b.z-a.z,l=Math.hypot(dx,dz)||1;return {x:dx/l,y:0,z:dz/l}};
const turn=(d,deg)=>{const r=deg*Math.PI/180,c=Math.cos(r),s=Math.sin(r);return {x:d.x*c+d.z*s,y:0,z:-d.x*s+d.z*c}};

// A subject's framing points: head and chest above where it stands.
export function subjectPoints(p,tall=1.75){return {feet:{x:p.x,y:p.y,z:p.z},head:{x:p.x,y:p.y+tall*.92,z:p.z},chest:{x:p.x,y:p.y+tall*.62,z:p.z}}}

// Where a point lands in a perspective camera at eye looking at look: x,y in -1..1 when on screen.
export function project(eye,look,p,fov,aspect){
 const f=norm(sub(look,eye)),r=norm(cross(f,{x:0,y:1,z:0})),u=cross(r,f),d=sub(p,eye),z=dot(d,f),t=Math.tan(fov*Math.PI/360);
 return {x:dot(d,r)/(Math.max(1e-6,z)*t*aspect),y:dot(d,u)/(Math.max(1e-6,z)*t),z};
}
// Shortest distance between segment p0→p1 and the vertical body axis of a subject (feet to head).
function bodyGap(p0,p1,s){
 let best=Infinity;for(let i=0;i<=24;i++){const t=i/24,x=p0.x+(p1.x-p0.x)*t,y=p0.y+(p1.y-p0.y)*t,z=p0.z+(p1.z-p0.z)*t;
  const dy=y<s.feet.y?s.feet.y-y:y>s.head.y+.15?y-s.head.y-.15:0;best=Math.min(best,Math.hypot(x-s.feet.x,z-s.feet.z,dy))}
 return best;
}
export const onScreen=(eye,look,p,fov,aspect,margin=.86)=>{const s=project(eye,look,p,fov,aspect);return s.z>.25&&Math.abs(s.x)<=margin&&Math.abs(s.y)<=margin};

// A building's interior from its scene group (game.js house(): walls at local ±1.91 x and ±1.83 z,
// .18 thick, 3 high, floor top at .125; the group carries position, yaw and scale).
export const ROOM_LOCAL={halfX:1.82,halfZ:1.74,floor:.125,top:3};
export function roomFromGroup(g){
 return {x:g.position.x,y:g.position.y,z:g.position.z,yaw:g.rotation.y,sx:g.scale.x,sy:g.scale.y,sz:g.scale.z};
}
const toLocal=(room,p)=>{const dx=p.x-room.x,dz=p.z-room.z,c=Math.cos(room.yaw),s=Math.sin(room.yaw);return {x:(dx*c-dz*s)/room.sx,y:(p.y-room.y)/room.sy,z:(dx*s+dz*c)/room.sz}};
const toWorld=(room,l)=>{const x=l.x*room.sx,z=l.z*room.sz,c=Math.cos(room.yaw),s=Math.sin(room.yaw);return {x:room.x+x*c+z*s,y:room.y+l.y*room.sy,z:room.z-x*s+z*c}};
export function insideRoom(room,p,pad=0){const l=toLocal(room,p);return Math.abs(l.x)*room.sx<=ROOM_LOCAL.halfX*room.sx-pad&&Math.abs(l.z)*room.sz<=ROOM_LOCAL.halfZ*room.sz-pad}
// Keeps an eye `margin` metres inside the walls, above the floor and under the wall tops.
export function clampToRoom(room,p,margin=.7){
 const l=toLocal(room,p),mx=ROOM_LOCAL.halfX-margin/room.sx,mz=ROOM_LOCAL.halfZ-margin/room.sz;
 l.x=Math.max(-mx,Math.min(mx,l.x));l.z=Math.max(-mz,Math.min(mz,l.z));
 l.y=Math.max(ROOM_LOCAL.floor+.5/room.sy,Math.min(ROOM_LOCAL.top-.6/room.sy,l.y));
 return toWorld(room,l);
}
export const roomAround=(rooms,points)=>rooms.find(r=>points.every(p=>insideRoom(r,p)))||null;

// Candidate cameras for a shot, best first. kind 'two': both subjects side by side from `angle`
// degrees off the line between them (side picks which side). kind 'over': over `a`'s shoulder
// looking at `b`.
function* candidates(kind,A,B,o){
 const mid={x:(A.head.x+B.head.x)/2,y:(A.head.y+B.head.y)/2,z:(A.head.z+B.head.z)/2};
 const sides=[o.side||1,-(o.side||1)],angles=[0,12,-12,25,-25,40,-40,55,-55];
 if(kind==='two'){
  const axis=flat(A.head,B.head);
  for(const side of sides)for(const da of angles)for(const lift of [0,.8,1.6]){
   const dir=turn({x:-axis.z*side,y:0,z:axis.x*side},(o.angle||0)+da);
   const look={x:mid.x,y:mid.y-.35,z:mid.z};
   for(let dist=2.5;dist<=16;dist+=.5)yield {eye:{x:mid.x+dir.x*dist,y:mid.y+(o.height??.6)+lift,z:mid.z+dir.z*dist},look,dist};
  }
 }else{
  const dir=flat(A.head,B.head);
  for(const side of sides)for(const spread of [.55,.9,1.3])for(const da of [0,10,-10,20,-20,32])for(const lift of [0,.6,1.2]){
   const right=turn({x:-dir.z,y:0,z:dir.x},da);
   const look={x:B.head.x+(A.head.x-B.head.x)*.18,y:B.head.y-.2+(A.head.y-B.head.y)*.18,z:B.head.z+(A.head.z-B.head.z)*.18};
   for(let back=1.6;back<=6.5;back+=.3)yield {eye:{x:A.head.x-dir.x*back+right.x*side*(spread+back*.1),y:A.head.y+(o.height??.35)+lift,z:A.head.z-dir.z*back+right.z*side*(spread+back*.1)},look,dist:back};
  }
 }
}

// Resolves {two:{a,b,angle,side,height}} or {over:{shoulder,at,side,height}} for subjects already
// located (a/b: {x,y,z,tall}). Returns {eye,look,ok}; ok is false when no candidate met every rule
// (the best clear one is used then).
export function frameShot(shot,{a,b,fov=55,aspect=16/9,rooms=[],clear=()=>true}){
 const kind=shot.two?'two':'over',o=shot.two||shot.over,A=subjectPoints(a,a.tall),B=subjectPoints(b,b.tall);
 const room=roomAround(rooms,[A.feet,B.feet]),margin=.86;
 // Two-shots keep both people whole across the shoulders, not just their faces.
 const across=flat(A.head,B.head),wide=(P,k)=>({x:P.chest.x+across.x*k,y:P.chest.y,z:P.chest.z+across.z*k});
 const visible=[A.head,A.chest,B.head,B.chest,wide(A,-.45),wide(B,.45)];
 let fallback=null,lastKey='';
 for(const c of candidates(kind,A,B,o)){
  let eye=c.eye;if(room)eye=clampToRoom(room,eye);
  const key=eye.x.toFixed(2)+eye.y.toFixed(2)+eye.z.toFixed(2)+c.look.x;if(key===lastKey)continue;lastKey=key;
  if(Math.hypot(eye.x-c.look.x,eye.z-c.look.z)<1)continue;
  const seen=kind==='two'?visible:[B.head,B.chest];
  if(!seen.every(p=>clear(eye,p)))continue;
  fallback??={eye,look:c.look,ok:false};
  let fits=seen.every(p=>onScreen(eye,c.look,p,fov,aspect,margin));
  if(fits&&kind==='two')fits=bodyGap(eye,A.head,B)>.4&&bodyGap(eye,B.head,A)>.4;
  if(fits&&kind==='over'){
   // The near shoulder sits at the frame's edge, never across the face being spoken to.
   // and its body never hides the other subject's face or chest.
   const s=project(eye,c.look,A.head,fov,aspect),t=project(eye,c.look,B.head,fov,aspect);
   fits=s.z>.25&&Math.abs(s.x)<1.02&&Math.abs(s.x)>.4&&Math.abs(s.x-t.x)>.55&&bodyGap(eye,B.head,A)>.65&&bodyGap(eye,B.chest,A)>.65&&clear(eye,A.chest);
  }
  if(fits)return {eye,look:c.look,ok:true,room:!!room};
 }
 if(fallback)return {...fallback,room:!!room};
 const eye=room?clampToRoom(room,{x:B.head.x,y:B.head.y+.4,z:B.head.z}):A.head;
 return {eye,look:B.head,ok:false,room:!!room};
}

// Straight glides only when nothing stands between the two cameras: otherwise the move would fly
// the lens through a wall, so the scene cuts instead.
export const glideClear=(from,to,clear)=>!from||clear(from,to);

export const vec=(a)=>Array.isArray(a)?{x:a[0],y:a[1],z:a[2]}:a;
export {sub,add,len,norm,bodyGap};
