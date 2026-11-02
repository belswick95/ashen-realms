import {landscapeSettlements,landscapeLakes,worldRivers,roadLines,distanceToRoad} from './geography.js?v=release-20261102-oakcross2';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
export function noise(x,z){const hash=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n)};const ix=Math.floor(x),iz=Math.floor(z),u=smooth(0,1,x-ix),v=smooth(0,1,z-iz);return (hash(ix,iz)*(1-u)+hash(ix+1,iz)*u)*(1-v)+(hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u)*v}
function segmentIntersection(a,b,c,d){
 const rx=b[0]-a[0],rz=b[1]-a[1],sx=d[0]-c[0],sz=d[1]-c[1],det=rx*sz-rz*sx;if(Math.abs(det)<1e-8)return null;
 const qx=c[0]-a[0],qz=c[1]-a[1],t=(qx*sz-qz*sx)/det,u=(qx*rz-qz*rx)/det;
 return t>=0&&t<=1&&u>=0&&u<=1?{x:a[0]+t*rx,z:a[1]+t*rz,dx:rx,dz:rz,cross:Math.abs(det)/(Math.hypot(rx,rz)*Math.hypot(sx,sz))}:null;
}
export function waterAt(x,z){
 let amount=0;
 for(const lake of landscapeLakes){const dx=(x-lake.x)/lake.rx,dz=(z-lake.z)/lake.rz;if(Math.abs(dx)>1.2||Math.abs(dz)>1.2)continue;const a=Math.atan2(dz,dx),outline=1+.085*Math.sin(a*5+lake.x*.17)+.055*Math.sin(a*9+lake.z*.13)+.025*Math.sin(a*17);amount=Math.max(amount,1-Math.hypot(dx,dz)/outline)}
 for(const river of worldRivers)for(let i=1;i<river.points.length;i++){
  const a=river.points[i-1],b=river.points[i],pad=river.width/2+2;
  if(x<Math.min(a[0],b[0])-pad||x>Math.max(a[0],b[0])+pad||z<Math.min(a[1],b[1])-pad||z>Math.max(a[1],b[1])+pad)continue;
  const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));
  amount=Math.max(amount,1-Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)/(river.width/2));
 }
 return amount;
}
export function createLandscape({segments=280,extent=840}={}){
 const bridges=[];
 for(const line of roadLines)for(let i=1;i<line.length;i++)for(const river of worldRivers)for(let j=1;j<river.points.length;j++){
  const hit=segmentIntersection(line[i-1],line[i],river.points[j-1],river.points[j]);if(!hit||bridges.some(b=>Math.hypot(b.x-hit.x,b.z-hit.z)<8))continue;
  bridges.push({...hit,yaw:Math.atan2(hit.dx,hit.dz),width:4.2,length:river.width/Math.max(.2,hit.cross)+7});
 }
 function bridgeAt(x,z){return bridges.find(b=>{const dx=x-b.x,dz=z-b.z,s=Math.sin(b.yaw),c=Math.cos(b.yaw);return Math.abs(dx*c-dz*s)<b.width/2&&Math.abs(dx*s+dz*c)<b.length/2})}
 const count=segments+1,heights=new Float32Array(count*count),step=extent/segments,buildingPlots=[];
 function sculpt(x,z){
  // Broad ridges and mountain ranges instead of disconnected geometric cones.
  const peaks=[[-320,-300,54,110],[280,-330,65,120],[-350,290,39,100],[330,300,46,105]];
  let h=0;for(const [px,pz,height,r] of peaks)h+=height*Math.exp(-((x-px)**2+(z-pz)**2)/(r*r));
  h*=.65+.35*(1-Math.abs(noise(x/35,z/35)*2-1));
  h+=(noise(x/100,z/100)-.35)*12+(noise(x/28,z/28)-.5)*2;
  h=Math.max(0,h);
  let clearance=1;for(const [sx,sz] of landscapeSettlements)clearance=Math.min(clearance,smooth(31,56,Math.hypot(x-sx,z-sz)));
  clearance=Math.min(clearance,smooth(4,13,distanceToRoad(x,z)));h*=clearance;
  const wet=waterAt(x,z);if(wet>0)h=-.9*Math.min(1,wet*4);else{
   // Water valleys meet the shore at water level, even near highland terrain.
   for(const river of worldRivers)for(let i=1;i<river.points.length;i++){
    const a=river.points[i-1],b=river.points[i],dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));
    const d=Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);h*=smooth(river.width/2,river.width/2+12,d);
   }
   for(const lake of landscapeLakes){const d=Math.hypot((x-lake.x)/lake.rx,(z-lake.z)/lake.rz);h*=smooth(1,1.5,d)}
  }
  return h;
 }
 for(let iz=0;iz<count;iz++)for(let ix=0;ix<count;ix++)heights[iz*count+ix]=sculpt(ix*step-extent/2,iz*step-extent/2);
 function heightAt(x,z){const gx=clamp((x+extent/2)/step,0,segments),gz=clamp((z+extent/2)/step,0,segments),ix=Math.min(segments-1,Math.floor(gx)),iz=Math.min(segments-1,Math.floor(gz)),u=gx-ix,v=gz-iz;const a=heights[iz*count+ix],b=heights[iz*count+ix+1],c=heights[(iz+1)*count+ix],d=heights[(iz+1)*count+ix+1];return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v)}
 function levelBuildingPlot({x,z,scaleX,scaleZ,rotation=0,floorHeight=.2}){
  const level=heightAt(x,z),c=Math.cos(rotation),s=Math.sin(rotation);
  // Include a complete terrain cell beyond the walls: the rendered triangles
  // crossing a wall must also be flat, not just the point under its center.
  const halfX=2.12*scaleX,halfZ=1.98*scaleZ,pad=step*1.5,blend=step*2;
  const radius=Math.hypot(halfX,halfZ)+pad+blend;
  const minX=Math.max(0,Math.floor((x-radius+extent/2)/step)),maxX=Math.min(segments,Math.ceil((x+radius+extent/2)/step));
  const minZ=Math.max(0,Math.floor((z-radius+extent/2)/step)),maxZ=Math.min(segments,Math.ceil((z+radius+extent/2)/step));
  for(let iz=minZ;iz<=maxZ;iz++)for(let ix=minX;ix<=maxX;ix++){
   const dx=ix*step-extent/2-x,dz=iz*step-extent/2-z;
   const lx=dx*c-dz*s,lz=dx*s+dz*c,d=Math.hypot(Math.max(0,Math.abs(lx)-halfX),Math.max(0,Math.abs(lz)-halfZ));
   const weight=1-smooth(pad,pad+blend,d),index=iz*count+ix;
   heights[index]+=(level-heights[index])*weight;
  }
  buildingPlots.push({x,z,c,s,halfX:2*scaleX,halfZ:1.85*scaleZ,level,floorHeight});
  return level;
 }
 function walkHeight(x,z){
  for(const plot of buildingPlots){const dx=x-plot.x,dz=z-plot.z;if(Math.abs(dx*plot.c-dz*plot.s)<plot.halfX&&Math.abs(dx*plot.s+dz*plot.c)<plot.halfZ)return plot.level+plot.floorHeight}
  const bridge=bridgeAt(x,z);if(!bridge)return heightAt(x,z);const dx=x-bridge.x,dz=z-bridge.z,along=Math.abs(dx*Math.sin(bridge.yaw)+dz*Math.cos(bridge.yaw));return .24*(1-smooth(bridge.length/2-2,bridge.length/2,along))
 }
 function canWalk(x,z){if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>extent/2-1||Math.abs(z)>extent/2-1)return false;if(bridgeAt(x,z))return true;if(waterAt(x,z)>.015)return false;const slope=Math.hypot(heightAt(x+1,z)-heightAt(x-1,z),heightAt(x,z+1)-heightAt(x,z-1))/2;return slope<.85}
 function nearestDryPoint(x,z){if(canWalk(x,z))return {x,z};for(let r=1;r<32;r++)for(let i=0;i<24;i++){const a=i*Math.PI/12,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;if(canWalk(px,pz))return {x:px,z:pz}}return {x:0,z:5}}
 return {segments,extent,heights,heightAt,walkHeight,waterAt,canWalk,bridgeAt,bridges,nearestDryPoint,levelBuildingPlot};
}
export function landscapeGeometry(T,landscape){
 const {segments,extent,heightAt}=landscape,g=new T.PlaneGeometry(extent,extent,segments,segments);g.rotateX(-Math.PI/2);
 const positions=g.attributes.position,colors=new Float32Array(positions.count*3);
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i),h=heightAt(x,z);positions.setY(i,h);const stone=smooth(15,42,h),n=noise(x/43,z/43);colors[i*3]=.62+stone*.18+n*.12;colors[i*3+1]=.78-stone*.08+n*.08;colors[i*3+2]=.50+stone*.20+n*.10}
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
