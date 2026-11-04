import {generatedWorld,configureWorld} from './procedural-world.js?v=release-20261104-chat33';
// Shared world-space outlines. The 3D scene and both maps consume this data.
export let worldRoads=generatedWorld?.roads||[[[-275,-215],[-340,-235]],[[-340,-235],[-340,-240]],[[0,0],[-60,45]],[[0,0],[75,-55]],[[0,0],[105,103]],[[-60,45],[-105,-91]],[[-60,45],[-210,145]],[[75,-55],[260,-185]],[[105,103],[225,215]],[[-105,-91],[-275,-215]]];
export function roadPoints(a,b,segments=32){
 const dx=b[0]-a[0],dz=b[1]-a[1],length=Math.hypot(dx,dz)||1;
 const seed=Math.sin(a[0]*127.1+b[1]*311.7)*43758.5453;
 const side=seed-Math.floor(seed)>.5?1:-1,bend=Math.min(length*.12,12)*side;
 const mx=(a[0]+b[0])/2-dz/length*bend,mz=(a[1]+b[1])/2+dx/length*bend;
 return Array.from({length:segments+1},(_,i)=>{const t=i/segments,u=1-t;return [u*u*a[0]+2*u*t*mx+t*t*b[0],u*u*a[1]+2*u*t*mz+t*t*b[1]]});
}
export function lakeOutline(lake,factor=1){
 return Array.from({length:64},(_,i)=>{
  const a=i/64*Math.PI*2;
  const wobble=1+.085*Math.sin(a*5+lake.x*.17)+.055*Math.sin(a*9+lake.z*.13)+.025*Math.sin(a*17);
  return [lake.x+Math.cos(a)*lake.rx*wobble*factor,lake.z+Math.sin(a)*lake.rz*wobble*factor];
 });
}
export function ribbonGeometry(T,points,width){
 points=points.filter((p,i)=>!i||Math.hypot(p[0]-points[i-1][0],p[1]-points[i-1][1])>1e-5);
 const positions=[],uv=[],indices=[];
 let traveled=0;
 for(let i=0;i<points.length;i++){
  const p=points[i],before=points[Math.max(0,i-1)],after=points[Math.min(points.length-1,i+1)];
  const dx=after[0]-before[0],dz=after[1]-before[1],length=Math.hypot(dx,dz)||1;
  if(i)traveled+=Math.hypot(p[0]-before[0],p[1]-before[1]);
  for(const side of [-1,1]){positions.push(p[0]-dz/length*width/2*side,0,p[1]+dx/length*width/2*side);uv.push((side+1)/2,traveled/3)}
  if(i){const a=(i-1)*2;indices.push(a,a+2,a+1,a+1,a+2,a+3)}
 }
 const geometry=new T.BufferGeometry();geometry.setAttribute('position',new T.Float32BufferAttribute(positions,3));geometry.setAttribute('uv',new T.Float32BufferAttribute(uv,2));geometry.setIndex(indices);geometry.computeVertexNormals();
 // Width offsets above put the right edge first, so ensure upward-facing surfaces.
 if(geometry.attributes.normal.getY(0)<0){for(let i=0;i<indices.length;i+=3)[indices[i+1],indices[i+2]]=[indices[i+2],indices[i+1]];geometry.setIndex(indices);geometry.computeVertexNormals()}
 return geometry;
}

export let landscapeSettlements=generatedWorld?generatedWorld.towns.map(t=>[t.x,t.z]):[[0,0],[-60,45],[75,-55],[105,103],[-210,145],[260,-185],[225,215],[-275,-215],[-114,82],[187,74],[-152,-133],[164,-116]];
export let landscapeLakes=generatedWorld?.lakes||[{x:-91,z:80,rx:18,rz:12,name:'Moonmere Lake'},{x:157,z:77,rx:24,rz:16,name:'Silverfin Lake'},{x:244,z:175,rx:16,rz:12,name:'Greenwatch Pond'}];
export let worldRivers=generatedWorld?.rivers||[
 {name:'Silverwater',width:9,points:[[-420,110],[-325,90],[-230,105],[-140,100],[-91,80],[-20,65],[50,80],[115,65],[157,77],[180,110],[250,125],[330,115],[420,95]]},
 {name:'Westmere Run',width:6,points:[[-180,-420],[-160,-310],[-190,-230],[-195,-175],[-195,-115],[-135,-45],[-140,40],[-91,80]]},
 {name:'Eastwater',width:7,points:[[420,-220],[345,-185],[310,-100],[250,-25],[205,30],[157,77]]}
];
export function segmentDistance(x,z,a,b){
 const dx=b[0]-a[0],dz=b[1]-a[1],length=dx*dx+dz*dz;
 const t=length?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/length)):0;
 return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t);
}
export let roadLines=worldRoads.map(([a,b])=>roadPoints(a,b));
export function distanceToRoad(x,z){let d=Infinity;for(const line of roadLines)for(let i=1;i<line.length;i++)d=Math.min(d,segmentDistance(x,z,line[i-1],line[i]));return d}

// Login audio loads geography before authentication; reconfigure its live bindings before the game imports.
export function initializeGeography(config){const plan=configureWorld(config);if(!plan)return;worldRoads=plan.roads;landscapeSettlements=plan.towns.map(t=>[t.x,t.z]);landscapeLakes=plan.lakes;worldRivers=plan.rivers;roadLines=worldRoads.map(([a,b])=>roadPoints(a,b));}
