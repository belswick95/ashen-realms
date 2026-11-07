// Debug overlay for the owner: the server's tile grid around the player (Game console → World →
// Tick & tile engine → Show tile grid). Grey lines: tile borders; red cross: blocked tile; blue
// cross: water; orange: a blocked edge between two tiles; yellow: blocked only while a door is shut.
import {TILE,FLAG} from './tile-grid.js?v=release-20261107-ground158';
export const OVERLAY_COLORS={grid:0x6f6a5c,block:0xe0432f,water:0x3f8fe0,edge:0xff9a1f,door:0xf3d43a};
// Line segments (pairs of [x,z]) with a colour for one tile-view reply.
export function overlaySegments(view,{radius=16}={}){
 const segs=[],h=TILE/2,[ci,cj]=view?.center||[0,0],add=(a,b,color)=>segs.push({a,b,color});
 for(let k=-radius;k<=radius+1;k++){const x=(ci+k)*TILE-h,z=(cj+k)*TILE-h;add([x,(cj-radius)*TILE-h],[x,(cj+radius+1)*TILE-h],OVERLAY_COLORS.grid);add([(ci-radius)*TILE-h,z],[(ci+radius+1)*TILE-h,z],OVERLAY_COLORS.grid)}
 for(const [i,j,flags,door=0] of view?.tiles||[]){
  // A door-dependent feature is drawn yellow whether the door is open or shut.
  const x=i*TILE,z=j*TILE,tint=(b,c)=>door&b?OVERLAY_COLORS.door:c,on=b=>!!((flags|door)&b);
  if(on(FLAG.BLOCK)){const c=tint(FLAG.BLOCK,flags&FLAG.WATER?OVERLAY_COLORS.water:OVERLAY_COLORS.block);add([x-h*.8,z-h*.8],[x+h*.8,z+h*.8],c);add([x-h*.8,z+h*.8],[x+h*.8,z-h*.8],c)}
  if(on(FLAG.E))add([x+h,z-h*.9],[x+h,z+h*.9],tint(FLAG.E,OVERLAY_COLORS.edge));
  if(on(FLAG.N))add([x-h*.9,z+h],[x+h*.9,z+h],tint(FLAG.N,OVERLAY_COLORS.edge));
  if(on(FLAG.NE))add([x+h*.6,z+h*.6],[x+h*1.4,z+h*1.4],tint(FLAG.NE,OVERLAY_COLORS.edge));
  if(on(FLAG.NW))add([x-h*.6,z+h*.6],[x-h*1.4,z+h*1.4],tint(FLAG.NW,OVERLAY_COLORS.edge));
 }
 return segs;
}
export function createTileOverlay(T,scene,heightAt=()=>0,{position=()=>window.eldervaleGetPlayerPosition?.(),radius=16,every=1500}={}){
 let mesh=null,timer=null,fetchView=null,busy=false;
 function draw(view){
  const segs=overlaySegments(view,{radius}),pos=new Float32Array(segs.length*6),col=new Float32Array(segs.length*6),c=new T.Color();
  segs.forEach((s,k)=>{c.setHex(s.color);for(const [n,p] of [[0,s.a],[1,s.b]]){const o=k*6+n*3;pos[o]=p[0];pos[o+1]=heightAt(p[0],p[1])+.06;pos[o+2]=p[1];col[o]=c.r;col[o+1]=c.g;col[o+2]=c.b}});
  if(!mesh){mesh=new T.LineSegments(new T.BufferGeometry(),new T.LineBasicMaterial({vertexColors:true,transparent:true,opacity:.85,depthTest:false}));mesh.renderOrder=999;mesh.frustumCulled=false;scene.add(mesh)}
  mesh.geometry.dispose();mesh.geometry=new T.BufferGeometry();mesh.geometry.setAttribute('position',new T.BufferAttribute(pos,3));mesh.geometry.setAttribute('color',new T.BufferAttribute(col,3));
 }
 async function refresh(){const p=position();if(!p||busy||!fetchView)return;busy=true;try{draw(await fetchView({x:p.x,z:p.z,radius}))}catch(e){console.warn('Tile overlay:',e.message)}finally{busy=false}}
 return {
  get enabled(){return !!timer},
  // `fetch(payload)` returns the console_tiles_view reply.
  enable(fetch){fetchView=fetch;if(timer)return;void refresh();timer=setInterval(()=>void refresh(),every)},
  disable(){clearInterval(timer);timer=null;if(mesh){scene.remove(mesh);mesh.geometry.dispose();mesh.material.dispose();mesh=null}},
  toggle(fetch){if(timer)this.disable();else this.enable(fetch);return !!timer},
 };
}
