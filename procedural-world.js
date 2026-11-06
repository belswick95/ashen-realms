// One server-saved seed produces the same terrain, roads and settlement blueprint on every client.
import {entityDefaults} from './world-templates.js?v=release-20261106-walk97';
export let worldConfig=globalThis.eldervaleWorldConfig||null;
export function seededRandom(seed){let n=seed>>>0;return ()=>{n=(Math.imul(n,1664525)+1013904223)>>>0;return n/4294967296}}
const clamp=x=>Math.max(0,Math.min(1,x)),smooth=(a,b,x)=>{const t=clamp((x-a)/(b-a));return t*t*(3-2*t)};
export function seedNoise(x,z,seed=1){const hash=(a,b)=>{let n=(Math.imul(a|0,374761393)^Math.imul(b|0,668265263)^seed)>>>0;n=Math.imul(n^(n>>>13),1274126177);return ((n^(n>>>16))>>>0)/4294967295};const ix=Math.floor(x),iz=Math.floor(z),u=smooth(0,1,x-ix),v=smooth(0,1,z-iz);return (hash(ix,iz)*(1-u)+hash(ix+1,iz)*u)*(1-v)+(hash(ix,iz+1)*(1-u)+hash(ix+1,iz+1)*u)*v}
export function biomeWeights(x,z,seed=1){const warp=(seedNoise(x/180,z/180,seed)-.5)*95,east=smooth(-100,100,x+warp),south=smooth(-100,100,z-warp*.6);return {castle:(1-east)*(1-south),snow:east*(1-south),grass:(1-east)*south,dry:east*south}}
export const regionDefinitions=[{id:'castle',name:'Royal Heartlands',color:[.36,.47,.29]},{id:'snow',name:'Frostbound Highlands',color:[.82,.86,.87]},{id:'grass',name:'Verdant Wilds',color:[.30,.44,.24]},{id:'dry',name:'Amber Expanse',color:[.65,.52,.34]}];
export function biomeColor(x,z,seed=1){const w=biomeWeights(x,z,seed),c=[0,0,0];for(const b of regionDefinitions)for(let i=0;i<3;i++)c[i]+=b.color[i]*w[b.id];return c}
export function makeWorldPlan(seed){
 const random=seededRandom(seed),between=(a,b)=>a+(b-a)*random(),pick=a=>a[Math.floor(random()*a.length)];
 const towns=[{id:'grass',name:pick(['Willow','Birch','Alder'])+pick(['reach','haven','ford']),x:between(-240,-130),z:between(120,235),roof:0x615344,stone:false},{id:'snow',name:pick(['Frost','Winter','Snow'])+pick(['hold','watch','haven']),x:between(140,255),z:between(-270,-160),roof:0xc4c8c8,stone:false},{id:'dry',name:pick(['Amber','Dune','Ember'])+pick(['well','rest','spire']),x:between(140,260),z:between(160,270),roof:0x73624d,stone:true}].map(t=>({...t,x:Math.round(t.x),z:Math.round(t.z)}));
 const g=towns[0],s=towns[1],d=towns[2],roads=[[[g.x,g.z],[-340,-235]],[[-340,-235],[-340,-240]],[[g.x,g.z],[s.x,s.z]],[[g.x,g.z],[d.x,d.z]],[[s.x,s.z],[d.x,d.z]]];
 const rivers=[{name:'Wildwater',width:7,points:Array.from({length:9},(_,i)=>[Math.round(between(-35,35)),-420+i*105])},{name:'The Wander',width:8,points:Array.from({length:9},(_,i)=>[-420+i*105,Math.round(between(-25,35))])}];
 const lakes=[{x:Math.round(between(-340,-285)),z:Math.round(between(270,330)),rx:between(15,24),rz:between(12,20),name:'Willowmere'},{x:Math.round(between(285,340)),z:Math.round(between(-105,-65)),rx:between(14,21),rz:between(12,18),name:'Mirror Tarn'},{x:Math.round(between(280,330)),z:Math.round(between(65,110)),rx:between(12,18),rz:between(9,14),name:'Amber Oasis'}];
 const entities=[];let serial=0;const add=(template,x,z,data={})=>{const e={...entityDefaults(template,x,z),...data,generation:'seeded-world-v2',seed,generatedKey:String(++serial)};entities.push(e);return e};
 for(const town of towns){
  const phase=between(-.14,.14),radius=between(24,29);add('plaza',town.x,town.z,{name:town.name+' square',scale:1});add('fountain',town.x,town.z,{name:town.name+' fountain'});
  const plans=[['bank','Treasury'],['inn','Lodge'],['forge','Workshop'],['cottage','Chapel'],['cottage','House']];
  plans.forEach(([type,title],i)=>{const angle=phase+i*Math.PI*2/plans.length,r=radius+(i%2)*4,x=town.x+Math.sin(angle)*r,z=town.z+Math.cos(angle)*r,scale=type==='bank'?1.8:1.45,yaw=Math.atan2(town.x-x,town.z-z)*180/Math.PI;
   add(type,x,z,{name:town.name+' '+title,scale,yaw,stone:town.stone||type==='bank'||type==='forge',roof:town.roof,wallColor:town.id==='snow'?0x918272:town.id==='dry'?0xc4ad83:0xb7b1a0,room:title==='Chapel'?'chapel':type,biome:town.id});
   const reach=r-2.5*1.3*scale,start=8;add('road',town.x+Math.sin(angle)*(start+reach)/2,town.z+Math.cos(angle)*(start+reach)/2,{name:town.name+' lane',yaw:angle*180/Math.PI,length:Math.max(2,reach-start),width:2.8});
   if(type==='bank')add('banker',x,z,{name:town.name+' Banker',activity:'read'});else if(type==='inn')add('innkeeper',x,z,{name:town.name+' Cook',activity:'trade'});else if(type==='forge')add('smith',x,z,{name:town.name+' Smith',activity:'smith'});else if(title==='Chapel'){add('healer',x,z,{name:town.name+' Chaplain'});add('altar',x,z-1,{name:'Altar of '+town.name})}
  });
  for(const side of [-1,1]){add('market',town.x+side*12,town.z+4,{name:town.name+' market'});add('merchant',town.x+side*12,town.z+3,{name:town.name+(side<0?' Outfitter':' Provisioner'),shop:side<0?{'weapon:longsword':{buy:70,sell:35,stock:-1},'weapon:scimitar':{buy:90,sell:45,stock:-1},'shield:kite':{buy:80,sell:35,stock:-1}}:{fishingPole:{buy:35,sell:12,stock:-1},bait:{buy:2,sell:1,stock:-1},rawFish:{buy:12,sell:6,stock:1000}}});add('guard',town.x+side*8,town.z+side*34,{name:town.name+' Warden',level:60,hp:360,roam:5,weapon:'longsword'});}
  for(let i=0;i<6;i++)add('villager',town.x+between(-16,16),town.z+between(-16,16),{name:pick(['Rowan','Alden','Mara','Elin','Tomas','Freya'])+' the '+pick(['Porter','Scribe','Gardener','Courier']),color:pick([0x646b55,0x737b83,0x826c57,0x74616b]),roam:3,activity:pick(['carry','sweep','read','garden'])});
  for(const angle of [0,Math.PI/2,Math.PI,Math.PI*1.5])add('lantern',town.x+Math.sin(angle)*10,town.z+Math.cos(angle)*10);
 }
 return {seed,version:2,towns,roads,rivers,lakes,entities,regions:regionDefinitions,spawn:{x:g.x+5,z:g.z+8}};
}
export let generatedWorld=worldConfig?.enabled?makeWorldPlan(Number(worldConfig.seed)>>>0):null;
export function generatedTreePoints(seed,canPlant){const points=[];for(let x=-400;x<=400;x+=10)for(let z=-400;z<=400;z+=10){const r=seededRandom((seed^Math.imul(x,73856093)^Math.imul(z,19349663))>>>0),px=x+(r()-.5)*7,pz=z+(r()-.5)*7,w=biomeWeights(px,pz,seed),density=.64*w.grass+.48*w.castle+.32*w.snow+.035*w.dry;if(r()<density&&canPlant(px,pz))points.push({x:px,z:pz});}return points;}

export function configureWorld(config){worldConfig=config;generatedWorld=config?.enabled?makeWorldPlan(Number(config.seed)>>>0):null;return generatedWorld}
