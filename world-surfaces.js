import {storyScale} from './building-stories.js?v=release-20261104-skin51';
// Footprints are shared by grass exclusion, foundations, and the geometry audit.
export const isBuilding=d=>['cottage','bank','inn','forge'].includes(d?.template);
export function localPoint(d,x,z){const a=(d.yaw||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),dx=x-d.x,dz=z-d.z;return [dx*c-dz*s,dx*s+dz*c]}
export function coversSurface(d,x,z,pad=0){
 const [u,v]=localPoint(d,x,z),scale=d.scale||1;
 if(isBuilding(d))return Math.abs(u)<2.55*1.3*scale+pad&&Math.abs(v)<2.4*1.3*scale+pad;
 if(d.template==='road')return Math.abs(u)<(d.width||2.5)*scale/2+pad&&Math.abs(v)<(d.length||10)*scale/2+pad;
 if(d.template==='plaza'||d.template?.startsWith('terrain_'))return Math.hypot(u,v)<(d.template==='plaza'?8:d.radius||10)*scale+pad;
 return false;
}
export function onBridge(bridges,x,z,pad=.6){return bridges.some(b=>{const c=Math.cos(b.yaw),s=Math.sin(b.yaw),dx=x-b.x,dz=z-b.z;return Math.abs(dx*c-dz*s)<b.width/2+pad&&Math.abs(dx*s+dz*c)<b.length/2+pad})}
export function buildingPlot(d){const scale=1.3*(d.scale||1);return {x:d.x,z:d.z,scaleX:scale,scaleZ:scale,rotation:(d.yaw||0)*Math.PI/180,floorHeight:.125*(d.stories>1?storyScale(d):scale)}}
function clip(poly,a,b){const side=p=>(b[0]-a[0])*(p[1]-a[1])-(b[1]-a[1])*(p[0]-a[0]);const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],u=side(p),v=side(q);if(u>=-1e-8)out.push(p);if((u<0&&v>0)||(u>0&&v<0)){const t=u/(u-v);out.push([p[0]+t*(q[0]-p[0]),p[1]+t*(q[1]-p[1])])}}return out}
export function drapedGeometry(T,land,source,origin,offset){
 const pos=source.attributes.position,index=source.index,verts=[],uv=[],step=land.extent/land.segments,half=land.extent/2;
 for(let i=0;i<(index?index.count:pos.count);i+=3){const polygon=[0,1,2].map(j=>{const n=index?index.getX(i+j):i+j;return [pos.getX(n)+origin.x,pos.getZ(n)+origin.z]});
  const signed=(polygon[1][0]-polygon[0][0])*(polygon[2][1]-polygon[0][1])-(polygon[1][1]-polygon[0][1])*(polygon[2][0]-polygon[0][0]);if(signed<0)polygon.reverse();
  const lo=k=>Math.max(0,Math.floor((Math.min(...polygon.map(p=>p[k]))+half)/step)),hi=k=>Math.min(land.segments-1,Math.floor((Math.max(...polygon.map(p=>p[k]))+half)/step));
  for(let iz=lo(1);iz<=hi(1);iz++)for(let ix=lo(0);ix<=hi(0);ix++){const x=ix*step-half,z=iz*step-half;for(const triangle of [[[x,z],[x+step,z],[x,z+step]],[[x+step,z+step],[x,z+step],[x+step,z]]]){let p=polygon;for(let j=0;j<3&&p.length;j++)p=clip(p,triangle[j],triangle[(j+1)%3]);for(let j=1;j<p.length-1;j++)for(const q of [p[0],p[j+1],p[j]]){verts.push(q[0]-origin.x,land.heightAt(...q)+offset-origin.y,q[1]-origin.z);uv.push(q[0]/3,q[1]/3)}}}
 }
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
// Clip the entire paved footprint to the terrain's exact triangles. A coarse
// road draped at a few vertices otherwise cuts through hills between samples.
export function pavedGeometry(T,land,d,baseY=0){
 const scale=d.scale||1,a=(d.yaw||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),world=([x,z])=>[d.x+(x*c+z*s)*scale,d.z+(-x*s+z*c)*scale];
 let polygon;if(d.template==='road'){const w=(d.width||2.5)/2,l=(d.length||10)/2;polygon=[[-w,-l],[w,-l],[w,l],[-w,l]].map(world)}else{const r=d.template==='plaza'?8:d.radius||10;polygon=Array.from({length:48},(_,i)=>world([r*Math.cos(i*Math.PI/24),r*Math.sin(i*Math.PI/24)]))}
 const step=land.extent/land.segments,half=land.extent/2,verts=[],uv=[],offset=d.template==='road'?.065:d.template==='plaza'?.055:.045;
 const lo=k=>Math.max(0,Math.floor((Math.min(...polygon.map(p=>p[k]))+half)/step)),hi=k=>Math.min(land.segments-1,Math.floor((Math.max(...polygon.map(p=>p[k]))+half)/step));
 for(let iz=lo(1);iz<=hi(1);iz++)for(let ix=lo(0);ix<=hi(0);ix++){const x=ix*step-half,z=iz*step-half;for(const triangle of [[[x,z],[x+step,z],[x,z+step]],[[x+step,z+step],[x,z+step],[x+step,z]]]){let p=polygon;for(let j=0;j<3&&p.length;j++)p=clip(p,triangle[j],triangle[(j+1)%3]);for(let j=1;j<p.length-1;j++)for(const q of [p[0],p[j+1],p[j]]){const [u,v]=localPoint(d,...q);verts.push(u/scale,(land.heightAt(...q)+offset-baseY)/scale,v/scale);uv.push(u/3,v/3)}}}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(verts,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.computeVertexNormals();g.computeBoundingSphere();return g;
}

// The meadow tests thousands of candidate blades. Index footprint candidates
// once per edit instead of copying/scanning the entire world for every blade.
export function createSurfaceCoverIndex(rows,{cellSize=16,padding=2}={}){
 const cells=new Map(),all=rows.filter(r=>!r.deleted).map(r=>r.data||r);
 for(const d of all){const scale=d.scale||1,a=(d.yaw||0)*Math.PI/180,c=Math.abs(Math.cos(a)),s=Math.abs(Math.sin(a));let x,z;
  if(isBuilding(d)){x=2.55*1.3*scale;z=2.4*1.3*scale}else if(d.template==='road'){x=(d.width||2.5)*scale/2;z=(d.length||10)*scale/2}else if(d.template==='plaza'||d.template?.startsWith('terrain_')){x=z=(d.template==='plaza'?8:d.radius||10)*scale}else continue;
  const rx=x*c+z*s+padding,rz=x*s+z*c+padding;
  for(let ix=Math.floor((d.x-rx)/cellSize);ix<=Math.floor((d.x+rx)/cellSize);ix++)for(let iz=Math.floor((d.z-rz)/cellSize);iz<=Math.floor((d.z+rz)/cellSize);iz++){const key=ix+':'+iz;let list=cells.get(key);if(!list)cells.set(key,list=[]);list.push(d)}
 }
 return {covers(x,z,pad=.65){return (pad>padding?all:cells.get(Math.floor(x/cellSize)+':'+Math.floor(z/cellSize))||[]).some(d=>coversSurface(d,x,z,pad))}};
}
