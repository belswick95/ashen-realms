import fs from 'node:fs';
// Saved once in world settings; every browser and the server manifest use this exact seed.
const seed=Number(process.argv[2]||241916600)>>>0;globalThis.eldervaleWorldConfig={enabled:true,seed,version:2};
const {generatedWorld:plan,generatedTreePoints,seededRandom}=await import('../procedural-world.js?v=release-20261103-motion15');
const {createLandscape}=await import('../landscape.js?v=release-20261103-motion15');
const {distanceToRoad,landscapeSettlements,lakeOutline}=await import('../geography.js?v=release-20261103-motion15');
const {inCastle,castle}=await import('../castle-layout.js?v=release-20261103-motion15');
const {entityDefaults}=await import('../world-templates.js?v=release-20261103-motion15');
const landscape=createLandscape();
const dry=(x,z)=>!inCastle(x,z,9)&&landscape.waterAt(x,z)<=.01&&distanceToRoad(x,z)>=5&&!landscapeSettlements.some(([sx,sz])=>Math.hypot(x-sx,z-sz)<38);
const resources=generatedTreePoints(seed,dry).map(({x,z})=>({id:'base:tree:'+x.toFixed(1)+':'+z.toFixed(1),kind:'tree',x,z,data:{}}));
const random=seededRandom(seed+811),entities=plan.entities.slice();
const add=(template,x,z,extra={})=>entities.push({...entityDefaults(template,x,z),...extra,generation:'seeded-world-v2',seed,generatedKey:String(entities.length+1)});
for(const region of [{x:-210,z:220,types:['deer','wolf','bear','boar']},{x:230,z:-220,types:['wolf','golem','bear']},{x:220,z:210,types:['scorpion','demon','dragon','goblin']},{x:-250,z:-180,types:['deer','bandit','wolf']}] )for(let i=0;i<16;i++){const x=region.x+(random()-.5)*260,z=region.z+(random()-.5)*260,type=region.types[i%region.types.length]==='scorpion'?'spider':region.types[i%region.types.length];if(Math.abs(x)>395||Math.abs(z)>395||!dry(x,z)||!landscape.canWalk(x,z)||resources.some(r=>Math.hypot(r.x-x,r.z-z)<3)||plan.towns.some(t=>Math.hypot(t.x-x,t.z-z)<65))continue;add(type,x,z,{roam:3});}
for(const lake of plan.lakes){const x=lake.x+lake.rx*1.12,z=lake.z;const p=landscape.nearestDryPoint(x,z);add('fishing_spot',p.x,p.z,{name:lake.name+' fishing'});}
const waters=[];const poly=(points,passable=false)=>waters.push({outline:'('+points.map(([x,z])=>'('+x+','+z+')').join(',')+')',passable});
for(const l of plan.lakes)poly(lakeOutline(l));
for(const river of plan.rivers)for(let i=1;i<river.points.length;i++){const a=river.points[i-1],b=river.points[i],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),nx=-dz/len*river.width/2,nz=dx/len*river.width/2;poly([[a[0]+nx,a[1]+nz],[b[0]+nx,b[1]+nz],[b[0]-nx,b[1]-nz],[a[0]-nx,a[1]-nz]])}
poly([[-403,-368],[-277,-368],[-277,-359],[-403,-359]]);poly([[-403,-251],[-277,-251],[-277,-242],[-403,-242]]);poly([[-403,-359],[-394,-359],[-394,-251],[-403,-251]]);poly([[-286,-359],[-277,-359],[-277,-251],[-286,-251]]);
for(const b of landscape.bridges){const s=Math.sin(b.yaw),c=Math.cos(b.yaw);poly([[-1,-1],[1,-1],[1,1],[-1,1]].map(([a,d])=>[b.x+a*b.width/2*c+d*b.length/2*s,b.z-a*b.width/2*s+d*b.length/2*c]),true)}
const manifest={config:{enabled:true,seed,version:2},spawn:plan.spawn,towns:plan.towns,entities,resources,waters};fs.writeFileSync('db/generated-world.json',JSON.stringify(manifest));console.log(JSON.stringify({seed,towns:plan.towns.map(t=>t.name),entities:entities.length,resources:resources.length,bridges:landscape.bridges.length,spawn:plan.spawn}));
