import fs from 'node:fs';
import {fishingDock} from '../waterfront.js';
import * as T from 'three';
import {initializeGeography,worldRivers,landscapeLakes,roadLines,ribbonGeometry,distanceToRoad,landscapeSettlements} from '../geography.js?v=release-20261105-characters55';
import {generatedTreePoints} from '../procedural-world.js?v=release-20261105-characters55';
import {createLandscape,landscapeGeometry} from '../landscape.js';
import {isBuilding,buildingPlot,localPoint,coversSurface,pavedGeometry,drapedGeometry} from '../world-surfaces.js';
import {sculptPatches} from '../terrain-patches.js';
import {inCastle} from '../castle-layout.js';

const manifest=JSON.parse(fs.readFileSync(new URL('../db/generated-world.json',import.meta.url)));
const input=process.argv[2]?JSON.parse(fs.readFileSync(process.argv[2])):manifest.entities.map((data,i)=>({id:String(i),data}));
const rows=(Array.isArray(input)?input:input.entities).filter(r=>!r.deleted),config=input.config||manifest.config;
initializeGeography(config);
const land=createLandscape(),issues=[],warnings=[],counts={savedEntities:rows.length,buildings:0,terrainVertices:0,terrainTriangles:0,terrainCells:0,roads:roadLines.length,savedPaving:0,bridges:land.bridges.length,lakes:landscapeLakes.length,rivers:worldRivers.length,waterSamples:0,roadSamples:0,bridgeSamples:0,pavedTriangles:0,trees:0};
const fail=(type,detail)=>issues.push({type,...detail});
sculptPatches(land,land.heights.slice(),rows.filter(r=>r.data.template?.startsWith('terrain_')).sort((a,b)=>a.id.localeCompare(b.id)).map(r=>r.data));
const houses=rows.filter(r=>isBuilding(r.data)).sort((a,b)=>a.id.localeCompare(b.id));
const plots=houses.map(r=>({id:r.id,...buildingPlot(r.data),levelHeight:land.heightAt(r.data.x,r.data.z),register:false}));
for(const p of plots)land.levelBuildingPlot(p);
for(const p of plots)land.levelBuildingPlot({...p,coreOnly:true});
for(const p of plots)land.registerFloor(p.id,p);
counts.buildings=houses.length;
for(let k=0;k<plots.length;k++){
 const p=plots[k];let worst=-Infinity;
 for(let i=-8;i<=8;i++)for(let j=-8;j<=8;j++){const u=i/8*2*p.scaleX,v=j/8*1.85*p.scaleZ,c=Math.cos(p.rotation),s=Math.sin(p.rotation),x=p.x+u*c+v*s,z=p.z-u*s+v*c;worst=Math.max(worst,land.heightAt(x,z)-p.levelHeight-p.floorHeight);}
 if(worst>-.02)fail('floor-intersection',{name:houses[k].data.name,id:p.id,penetration:worst});
}
const corners=p=>[-1,1].flatMap(u=>[-1,1].map(v=>[p.x+u*2.12*p.scaleX*Math.cos(p.rotation)+v*1.98*p.scaleZ*Math.sin(p.rotation),p.z-u*2.12*p.scaleX*Math.sin(p.rotation)+v*1.98*p.scaleZ*Math.cos(p.rotation)]));
for(let i=0;i<houses.length;i++)for(let j=0;j<i;j++){
 const a=plots[i],b=plots[j],axes=[a.rotation,b.rotation].flatMap(r=>[[Math.cos(r),-Math.sin(r)],[Math.sin(r),Math.cos(r)]]);
 if(axes.every(([x,z])=>{const aa=corners(a).map(p=>p[0]*x+p[1]*z),bb=corners(b).map(p=>p[0]*x+p[1]*z);return Math.max(...aa)>Math.min(...bb)&&Math.max(...bb)>Math.min(...aa)}))fail('overlapping-buildings',{names:[houses[i].data.name,houses[j].data.name]});
}
// Every rendered heightfield vertex and triangle, including uninhabited regions.
const terrain=landscapeGeometry(T,land),pos=terrain.attributes.position,normals=terrain.attributes.normal,climate=terrain.attributes.climate,indices=terrain.index;
counts.terrainVertices=pos.count;counts.terrainTriangles=indices.count/3;counts.terrainCells=land.segments**2;
for(let i=0;i<pos.count;i++){const values=[pos.getX(i),pos.getY(i),pos.getZ(i),normals.getY(i),climate.getX(i),climate.getY(i),climate.getZ(i),climate.getW(i)];if(!values.every(Number.isFinite)||normals.getY(i)<=0||Math.abs(values.slice(4).reduce((a,b)=>a+b,0)-1)>1e-5)fail('invalid-terrain-vertex',{vertex:i});}
for(let i=0;i<indices.count;i+=3){const ids=[indices.getX(i),indices.getX(i+1),indices.getX(i+2)],x=ids.reduce((n,id)=>n+pos.getX(id)/3,0),z=ids.reduce((n,id)=>n+pos.getZ(id)/3,0),y=ids.reduce((n,id)=>n+pos.getY(id)/3,0);if(Math.abs(y-land.heightAt(x,z))>1e-4)fail('terrain-height-mismatch',{x,z});}
terrain.dispose();
function verifyPaving(g,origin,scale=1,yaw=0,offset=.047,name='road'){
 const p=g.attributes.position,c=Math.cos(yaw),s=Math.sin(yaw);let invalid=0;
 for(let i=0;i<p.count;i+=3){counts.pavedTriangles++;let u=0,v=0,y=0;for(let j=0;j<3;j++){u+=p.getX(i+j)*scale/3;v+=p.getZ(i+j)*scale/3;y+=p.getY(i+j)*scale/3;}const x=origin.x+u*c+v*s,z=origin.z-u*s+v*c;y+=origin.y;if(!Number.isFinite(y)||Math.abs(y-land.heightAt(x,z)-offset)>1e-4)invalid++;}
 if(invalid)fail('paving-cuts-terrain',{name,triangles:invalid});g.dispose();
}
for(let k=0;k<roadLines.length;k++){
 const line=roadLines[k];for(const width of [2.7,3.8]){const source=ribbonGeometry(T,line,width);verifyPaving(drapedGeometry(T,land,source,new T.Vector3(),.047),{x:0,y:0,z:0},1,0,.047,'main-road-'+k);source.dispose();}
 let blocked=0,example;for(let i=1;i<line.length;i++){const a=line[i-1],b=line[i],length=Math.hypot(b[0]-a[0],b[1]-a[1]);for(let d=0;d<length;d+=.5){const x=a[0]+(b[0]-a[0])*d/length,z=a[1]+(b[1]-a[1])*d/length;counts.roadSamples++;if(!land.canWalk(x,z)){blocked++;example={x,z};}}}
 if(blocked)fail('impassable-road',{road:k,samples:blocked,example});
}
for(const r of rows){const d=r.data;if(['road','plaza'].includes(d.template)||d.template?.startsWith('terrain_')){counts.savedPaving++;const base=land.walkHeight(d.x,d.z);verifyPaving(pavedGeometry(T,land,d,base),{x:d.x,y:base,z:d.z},d.scale||1,(d.yaw||0)*Math.PI/180,d.template==='road'?.065:d.template==='plaza'?.055:.045,d.name);}}
function waterSample(x,z,height,name){if(land.waterAt(x,z)<.05)return;counts.waterSamples++;if(land.heightAt(x,z)>height+.01)fail('buried-water',{name,x,z,terrain:land.heightAt(x,z),water:height});}
for(const r of worldRivers)for(let i=1;i<r.points.length;i++){const a=r.points[i-1],b=r.points[i],dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz);for(let d=0;d<length;d+=.75)for(const f of [-.85,-.5,0,.5,.85])waterSample(a[0]+dx*d/length-dz/length*r.width/2*f,a[1]+dz*d/length+dx/length*r.width/2*f,.035,r.name);}
for(const k of landscapeLakes)for(let i=0;i<360;i++)for(const f of [.1,.5,.8,.9]){const a=i*Math.PI/180;waterSample(k.x+Math.cos(a)*k.rx*f,k.z+Math.sin(a)*k.rz*f,.06,k.name);}
counts.docks=landscapeLakes.length;
for(const lake of landscapeLakes){const dock=fishingDock(lake,land.heightAt),water=.06;if(dock.deckY-dock.thickness/2<=water+.08)fail('submerged-dock',{name:lake.name});for(const p of dock.posts)if(p.bottom>land.heightAt(p.x,p.z)||p.top<dock.deckY-dock.thickness/2)fail('floating-dock-support',{name:lake.name,x:p.x,z:p.z});if(land.waterAt(dock.x+dock.length/2,dock.z)>.01)fail('disconnected-dock',{name:lake.name});}
for(const b of land.bridges){let bad=0;for(let d=-b.length/2+.01;d<=b.length/2;d+=.2)for(const side of [-.9,0,.9]){counts.bridgeSamples++;const x=b.x+Math.sin(b.yaw)*d+Math.cos(b.yaw)*side*b.width/2,z=b.z+Math.cos(b.yaw)*d-Math.sin(b.yaw)*side*b.width/2;if(!land.canWalk(x,z)||land.walkHeight(x,z)<land.heightAt(x,z)-.025)bad++;}if(bad)fail('bridge-intersection',{x:b.x,z:b.z,samples:bad});}
const trees=generatedTreePoints(config.seed,(x,z)=>!inCastle(x,z,9)&&land.waterAt(x,z)<=.01&&distanceToRoad(x,z)>=5&&!landscapeSettlements.some(([sx,sz])=>Math.hypot(x-sx,z-sz)<38));counts.trees=trees.length;
for(const t of trees)for(const h of houses)if(coversSurface(h.data,t.x,t.z,.35))fail('tree-in-building',{x:t.x,z:t.z,building:h.data.name});
for(const r of rows){const d=r.data;if(!Number.isFinite(d.x)||!Number.isFinite(d.z)||Math.abs(d.x)>land.extent/2||Math.abs(d.z)>land.extent/2)fail('entity-out-of-world',{id:r.id,name:d.name,x:d.x,z:d.z});if(['monster','npc'].includes(d.kind)&&land.waterAt(d.x,d.z)>.015&&!land.bridgeAt(d.x,d.z))fail('actor-spawn-in-water',{id:r.id,name:d.name,x:d.x,z:d.z});
 const supports=d.template==='market'?[[-1,-.6],[1,-.6],[-1,.6],[1,.6]]:d.template==='bench'?[[-.75,-.2],[.75,-.2],[-.75,.2],[.75,.2]]:d.template==='lantern'?[[0,0]]:null;
 if(supports){const a=(d.yaw||0)*Math.PI/180,s=d.scale||1,base=land.walkHeight(d.x,d.z);for(const [u,v]of supports){const x=d.x+s*(u*Math.cos(a)+v*Math.sin(a)),z=d.z+s*(-u*Math.sin(a)+v*Math.cos(a)),gap=base-land.walkHeight(x,z);if(Math.abs(gap)>.12)warnings.push({type:'uneven-prop-support',name:d.name,id:r.id,x,z,gap});}}
}
const report={config,bounds:[-land.extent/2,-land.extent/2,land.extent/2,land.extent/2],counts,issues,warnings};
const output=process.argv[3];if(output)fs.writeFileSync(output,JSON.stringify(report,null,2));console.log(JSON.stringify(report,null,2));if(issues.length)process.exitCode=1;
