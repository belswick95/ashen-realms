import {capital,capitalActive,wallDistance} from './capital-layout.js?v=release-20261107-hud142';
import {approachSample} from './castle-approach.js?v=release-20261107-hud142';
import {generatedWorld,seedNoise,biomeWeights,biomeColor} from './procedural-world.js?v=release-20261107-hud142';
import {castle,inMoat,inCastle} from './castle-layout.js?v=release-20261107-hud142';
import {landscapeSettlements,landscapeLakes,worldRivers,roadLines,distanceToRoad} from './geography.js?v=release-20261107-hud142';
const clamp=(x,a=0,b=1)=>Math.max(a,Math.min(b,x));
const smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
export function noise(x,z){const hash=(a,b)=>{const n=Math.sin(a*127.1+b*311.7)*43758.5453;return n-Math.floor(n)};const ix=Math.floor(x),iz=Math.floor(z),u=smooth(0,1,x-ix),v=smooth(0,1,z-iz);return (hash(ix,iz)*(1-u)+hash(ix+1,iz)*u)*(1-v)+(hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u)*v}
function segmentIntersection(a,b,c,d){
 const rx=b[0]-a[0],rz=b[1]-a[1],sx=d[0]-c[0],sz=d[1]-c[1],det=rx*sz-rz*sx;if(Math.abs(det)<1e-8)return null;
 const qx=c[0]-a[0],qz=c[1]-a[1],t=(qx*sz-qz*sx)/det,u=(qx*rz-qz*rx)/det;
 return t>=0&&t<=1&&u>=0&&u<=1?{x:a[0]+t*rx,z:a[1]+t*rz,dx:rx,dz:rz,cross:Math.abs(det)/(Math.hypot(rx,rz)*Math.hypot(sx,sz))}:null;
}
export function waterAt(x,z){
 let amount=inMoat(x,z)?1:0;
 for(const lake of landscapeLakes){const dx=(x-lake.x)/lake.rx,dz=(z-lake.z)/lake.rz;if(Math.abs(dx)>1.2||Math.abs(dz)>1.2)continue;const a=Math.atan2(dz,dx),outline=1+.085*Math.sin(a*5+lake.x*.17)+.055*Math.sin(a*9+lake.z*.13)+.025*Math.sin(a*17);amount=Math.max(amount,1-Math.hypot(dx,dz)/outline)}
 for(const river of worldRivers)for(let i=1;i<river.points.length;i++){
  const a=river.points[i-1],b=river.points[i],pad=river.width/2+2;
  if(x<Math.min(a[0],b[0])-pad||x>Math.max(a[0],b[0])+pad||z<Math.min(a[1],b[1])-pad||z>Math.max(a[1],b[1])+pad)continue;
  const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));
  amount=Math.max(amount,1-Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)/(river.width/2));
 }
 return amount;
}
// Road grading: flat core half-width, shoulder width (min/max, widened ROAD_BANK units per unit of
// height difference), averaging window along the road, max grade, profile spacing, gentle-pass reach.
export const ROAD_CORE=3,ROAD_SHOULDER=6.5,ROAD_SHOULDER_MAX=28,ROAD_BANK=3.2,ROAD_WINDOW=24,ROAD_GRADE=.12,ROAD_SAMPLE=1.5,ROAD_PASS=90,ROAD_PASS_DEPTH=.65;
const PEAKS=[[-320,-300,54,110],[280,-330,65,120],[-350,290,39,100],[330,300,46,105]];
export function createLandscape({segments=280,extent=840,approach=true}={}){
 const bridges=[{x:castle.x,z:castle.z+59,yaw:0,width:9,length:20}];
 for(const line of roadLines)for(let i=1;i<line.length;i++)for(const river of worldRivers)for(let j=1;j<river.points.length;j++){
  const hit=segmentIntersection(line[i-1],line[i],river.points[j-1],river.points[j]);if(!hit||bridges.some(b=>Math.hypot(b.x-hit.x,b.z-hit.z)<8))continue;
  bridges.push({...hit,yaw:Math.atan2(hit.dx,hit.dz),width:4.2,length:river.width/Math.max(.2,hit.cross)+7});
 }
 function bridgeAt(x,z){return bridges.find(b=>{const dx=x-b.x,dz=z-b.z,s=Math.sin(b.yaw),c=Math.cos(b.yaw);return Math.abs(dx*c-dz*s)<b.width/2&&Math.abs(dx*s+dz*c)<b.length/2})}
 const capitalOn=capitalActive(),count=segments+1,heights=new Float32Array(count*count),step=extent/segments,buildingPlots=[];
 // Hills before any grading. Rolling lowland noise is half the height it used to be; the corner
 // ranges (legacy) and the snowy north / dry highlands (generated) keep their full relief.
 function hills(x,z){
  if(generatedWorld){const seed=generatedWorld.seed,w=biomeWeights(x,z,seed),lowland=.5+.5*w.snow+.25*w.dry;let h=(seedNoise(x/135,z/135,seed)*15+seedNoise(x/42,z/42,seed+17)*5)*(1+w.snow*1.8+w.dry*.7)*lowland;h+=Math.pow(seedNoise(x/180+11,z/180-7,seed+33),3)*(35*w.snow+12*w.dry+12*w.castle);return Math.max(0,h)}
  // Broad ridges and mountain ranges instead of disconnected geometric cones.
  let m=0;for(const [px,pz,height,r] of PEAKS)m+=height*Math.exp(-((x-px)**2+(z-pz)**2)/(r*r));
  let h=m*(.65+.35*(1-Math.abs(noise(x/35,z/35)*2-1)));
  h+=((noise(x/100,z/100)-.35)*12+(noise(x/28,z/28)-.5)*2)*(.5+.5*smooth(8,30,m));
  return Math.max(0,h);
 }
 // Level ground around settlements and the walled capital (0 = fully graded).
 function landClearance(x,z){
  let clearance=1;for(const [sx,sz] of landscapeSettlements)clearance=Math.min(clearance,smooth(generatedWorld?42:31,generatedWorld?66:56,Math.hypot(x-sx,z-sz)));
  // The walled capital stands on level ground out to just beyond its walls.
  if(capitalOn&&Math.abs(x-capital.centre.x)<110&&Math.abs(z-capital.centre.z)<110)clearance=Math.min(clearance,smooth(8,30,wallDistance(x,z)));
  return clearance;
 }
 // Water valleys meet the shore at water level, even near highland terrain; the castle keeps its plateau.
 function shoreFactor(x,z){
  let f=1;
  for(const river of worldRivers)for(let i=1;i<river.points.length;i++){
   const a=river.points[i-1],b=river.points[i],pad=river.width/2+18;
   if(x<Math.min(a[0],b[0])-pad||x>Math.max(a[0],b[0])+pad||z<Math.min(a[1],b[1])-pad||z>Math.max(a[1],b[1])+pad)continue;
   const dx=b[0]-a[0],dz=b[1]-a[1],t=clamp(((x-a[0])*dx+(z-a[1])*dz)/(dx*dx+dz*dz));
   f*=smooth(river.width/2,pad,Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t));
  }
  for(const lake of landscapeLakes)f*=smooth(1,1.5,Math.hypot((x-lake.x)/lake.rx,(z-lake.z)/lake.rz));
  return f*smooth(66,85,Math.max(Math.abs(x-castle.x),Math.abs(z-castle.z)));
 }
 // Roads run along broad, gentle passes: relief eases within ROAD_PASS units of a road, so high
 // ground opens into a valley the road can climb at an easy grade instead of a carved trench.
 function natural(x,z){const keep=landClearance(x,z)*shoreFactor(x,z);if(keep<=0)return 0;const h=hills(x,z);return h*keep*(1-ROAD_PASS_DEPTH*(1-smooth(ROAD_CORE,ROAD_PASS,distanceToRoad(x,z)))*smooth(4,30,h))}
 // Roads follow the land: each road's surface is a low-pass (≈24-unit) average of the natural ground
 // along it, grade-limited, and pinned where the ground is forced level (towns, the capital, the
 // castle, river banks) and to deck level at bridge ends, so every bridge still meets its banks.
 // Soft shoulders blend back into the natural slope.
 const roads=roadLines.map(line=>{
  const segs=[];let length=0;
  for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1e-6)continue;segs.push({ax:a[0],az:a[1],dx:b[0]-a[0],dz:b[1]-a[1],L,s:length});length+=L}
  if(!segs.length)return null;
  const n=Math.max(1,Math.ceil(length/ROAD_SAMPLE)),ds=length/n,pts=[];
  for(let k=0,j=0;k<=n;k++){const s=k*ds;while(j<segs.length-1&&s>segs[j].s+segs[j].L)j++;const g=segs[j],t=clamp((s-g.s)/g.L);pts.push([g.ax+g.dx*t,g.az+g.dz*t])}
  const raw=pts.map(([x,z])=>natural(x,z)),pinned=pts.map(([x,z],i)=>bridges.some(b=>Math.hypot(x-b.x,z-b.z)<b.length/2+2)||inMoat(x,z)||waterAt(x,z)>0?0:landClearance(x,z)*shoreFactor(x,z)<.02?raw[i]:null);
  const reach=Math.round(ROAD_WINDOW/2/ds),profile=raw.map((_,i)=>{let sum=0,weight=0;for(let j=Math.max(0,i-reach);j<=Math.min(n,i+reach);j++){const w=1-Math.abs(j-i)/(reach+1);sum+=raw[j]*w;weight+=w}return pinned[i]===null?sum/weight:Math.min(pinned[i],sum/weight)});
  // Never climb or fall faster than ROAD_GRADE: forced-level points pull the profile down smoothly.
  for(let i=1;i<=n;i++)profile[i]=Math.min(profile[i],profile[i-1]+ROAD_GRADE*ds);for(let i=n-1;i>=0;i--)profile[i]=Math.min(profile[i],profile[i+1]+ROAD_GRADE*ds);
  let minX=Infinity,maxX=-Infinity,minZ=Infinity,maxZ=-Infinity;for(const [x,z] of pts){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minZ=Math.min(minZ,z);maxZ=Math.max(maxZ,z)}
  const pad=ROAD_CORE+ROAD_SHOULDER_MAX;
  return {segs,profile,ds,minX:minX-pad,maxX:maxX+pad,minZ:minZ-pad,maxZ:maxZ+pad};
 }).filter(Boolean);
 function roadSurface(road,x,z){
  if(x<road.minX||x>road.maxX||z<road.minZ||z>road.maxZ)return null;
  let best=Infinity,along=0;
  for(const g of road.segs){const t=clamp(((x-g.ax)*g.dx+(z-g.az)*g.dz)/(g.L*g.L)),d=Math.hypot(x-g.ax-g.dx*t,z-g.az-g.dz*t);if(d<best){best=d;along=g.s+g.L*t}}
  if(best>=ROAD_CORE+ROAD_SHOULDER_MAX)return null;
  const f=along/road.ds,i=Math.min(road.profile.length-2,Math.floor(f)),u=f-i;
  return {distance:best,height:road.profile[i]+(road.profile[i+1]-road.profile[i])*u};
 }
 // Soft shoulders: at least ROAD_SHOULDER wide, wider where the road sits above or below the land so
 // the bank never steepens into an embankment or a cutting.
 function graded(x,z,h){
  const near=[];for(const road of roads){const r=roadSurface(road,x,z);if(r)near.push(r)}
  near.sort((a,b)=>b.distance-a.distance);
  for(const r of near){const width=Math.min(ROAD_SHOULDER_MAX,Math.max(ROAD_SHOULDER,Math.abs(h-r.height)*ROAD_BANK));h=r.height+(h-r.height)*smooth(ROAD_CORE,ROAD_CORE+width,r.distance)}
  return h;
 }
 function sculpt(x,z){
  let h=graded(x,z,natural(x,z));
  const wet=waterAt(x,z);if(wet>0)h=-.9*Math.min(1,wet*4);
  if(inMoat(x,z))h=-1.5;
  if(approach&&generatedWorld&&wet<=0){const a=approachSample(x,z);h+=(.25+a.along*.003+Math.sin(x*.11)*.12-h)*a.weight;}
  return h;
 }
 for(let iz=0;iz<count;iz++)for(let ix=0;ix<count;ix++)heights[iz*count+ix]=sculpt(ix*step-extent/2,iz*step-extent/2);
 function heightAt(x,z){const gx=clamp((x+extent/2)/step,0,segments),gz=clamp((z+extent/2)/step,0,segments),ix=Math.min(segments-1,Math.floor(gx)),iz=Math.min(segments-1,Math.floor(gz)),u=gx-ix,v=gz-iz;const a=heights[iz*count+ix],b=heights[iz*count+ix+1],c=heights[(iz+1)*count+ix],d=heights[(iz+1)*count+ix+1];return u+v<=1?a+(b-a)*u+(c-a)*v:d+(c-d)*(1-u)+(b-d)*(1-v)}
 function levelBuildingPlot({x,z,scaleX,scaleZ,rotation=0,floorHeight=.2,levelHeight=heightAt(x,z),register=true,coreOnly=false}){
  const level=levelHeight,c=Math.cos(rotation),s=Math.sin(rotation);
  // Include a complete terrain cell beyond the walls: the rendered triangles
  // crossing a wall must also be flat, not just the point under its center.
  const halfX=2.12*scaleX,halfZ=1.98*scaleZ,pad=step*1.5,blend=step*2;
  const radius=Math.hypot(halfX,halfZ)+pad+blend;
  const minX=Math.max(0,Math.floor((x-radius+extent/2)/step)),maxX=Math.min(segments,Math.ceil((x+radius+extent/2)/step));
  const minZ=Math.max(0,Math.floor((z-radius+extent/2)/step)),maxZ=Math.min(segments,Math.ceil((z+radius+extent/2)/step));
  for(let iz=minZ;iz<=maxZ;iz++)for(let ix=minX;ix<=maxX;ix++){
   const dx=ix*step-extent/2-x,dz=iz*step-extent/2-z;
   const lx=dx*c-dz*s,lz=dx*s+dz*c,d=Math.hypot(Math.max(0,Math.abs(lx)-halfX),Math.max(0,Math.abs(lz)-halfZ));
   const weight=coreOnly?(d<=pad?1:0):1-smooth(pad,pad+blend,d),index=iz*count+ix;
   heights[index]+=(level-heights[index])*weight;
  }
  if(register)buildingPlots.push({x,z,c,s,halfX:2*scaleX,halfZ:1.85*scaleZ,level,floorHeight});
  return level;
 }
 function registerFloor(id,{x,z,scaleX,scaleZ,rotation=0,floorHeight=.2}){removeFloor(id);buildingPlots.push({id,x,z,c:Math.cos(rotation),s:Math.sin(rotation),halfX:2*scaleX,halfZ:1.85*scaleZ,level:heightAt(x,z),floorHeight})}
 function removeFloor(id){for(let i=buildingPlots.length-1;i>=0;i--)if(buildingPlots[i].id===id)buildingPlots.splice(i,1)}
 function walkHeight(x,z){
  for(const plot of buildingPlots){const dx=x-plot.x,dz=z-plot.z;if(Math.abs(dx*plot.c-dz*plot.s)<plot.halfX&&Math.abs(dx*plot.s+dz*plot.c)<plot.halfZ)return plot.level+plot.floorHeight}
  const bridge=bridgeAt(x,z);if(!bridge)return heightAt(x,z);const dx=x-bridge.x,dz=z-bridge.z,along=Math.abs(dx*Math.sin(bridge.yaw)+dz*Math.cos(bridge.yaw));return .08+.16*(1-smooth(bridge.length/2-2,bridge.length/2,along))
 }
 function canWalk(x,z){if(!Number.isFinite(x)||!Number.isFinite(z)||Math.abs(x)>extent/2-1||Math.abs(z)>extent/2-1)return false;if(bridgeAt(x,z))return true;if(waterAt(x,z)>.015)return false;const slope=Math.hypot(heightAt(x+1,z)-heightAt(x-1,z),heightAt(x,z+1)-heightAt(x,z-1))/2;return slope<.85}
 function nearestDryPoint(x,z){if(canWalk(x,z))return {x,z};for(let r=1;r<32;r++)for(let i=0;i<24;i++){const a=i*Math.PI/12,px=x+Math.cos(a)*r,pz=z+Math.sin(a)*r;if(canWalk(px,pz))return {x:px,z:pz}}return {x:0,z:5}}
 return {segments,extent,heights,heightAt,walkHeight,waterAt,canWalk,bridgeAt,bridges,nearestDryPoint,levelBuildingPlot,registerFloor,removeFloor};
}
export function landscapeGeometry(T,landscape){
 const {segments,extent,heightAt}=landscape,g=new T.PlaneGeometry(extent,extent,segments,segments);g.rotateX(-Math.PI/2);
 const positions=g.attributes.position,colors=new Float32Array(positions.count*3),climate=new Float32Array(positions.count*4);
 for(let i=0;i<positions.count;i++){const x=positions.getX(i),z=positions.getZ(i),h=heightAt(x,z);positions.setY(i,h);const w=biomeWeights(x,z,generatedWorld?.seed||2419);climate.set([w.grass,w.snow,w.dry,w.castle],i*4);const stone=smooth(15,42,h),n=noise(x/43,z/43);if(generatedWorld){const c=biomeColor(x,z,generatedWorld.seed),variation=.88+seedNoise(x/35,z/35,generatedWorld.seed)*.22;for(let k=0;k<3;k++)colors[i*3+k]=Math.pow(c[k],2.2)*variation;continue;}colors[i*3]=.62+stone*.18+n*.12;colors[i*3+1]=.78-stone*.08+n*.08;colors[i*3+2]=.50+stone*.20+n*.10}
 g.setAttribute('color',new T.Float32BufferAttribute(colors,3));g.setAttribute('climate',new T.Float32BufferAttribute(climate,4));g.computeVertexNormals();g.computeBoundingSphere();return g;
}
