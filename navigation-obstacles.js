export const campObstacleSizes={fence:[.85,.12],tent:[2,1.95],bedroll:[.48,1.05],log_seat:[.35,1.1],cooking_tripod:[.55,.55],supply_wagon:[1.25,2.8],trail_sign:[.2,.2],woodpile:[.65,.65],rope_coil:[.48,.48],camp_lantern:[.18,.18],wooden_table:[1,.5],stool:[.3,.3],weapon_rack:[1.05,.25],campfire:[.65,.65],farm_hut:[2.2,1.8],chicken_coop:[.75,.55],hay_bale:[1.1,.45],water_trough:[.95,.4],stone_statue:[.55,.55],wheelbarrow:[.4,.7],scarecrow:[.15,.15],flower_bed:[1,.45]};
const obstacleSizes={...campObstacleSizes,furnace:[1.2,.8],anvil:[.8,.8],workbench:[1.2,.8],spinning_wheel:[.8,.8],tanning_rack:[.8,.8],mill:[.8,.8],rune_altar:[.8,.8],thieving_stall:[1.2,.8],practice_chest:[.8,.8],essence_rock:[.8,.8],construction_site:[.8,.8],tree:[.7,.7],pine:[.7,.7],rock:[1.1,1.1],crate:[.7,.6],barrel:[.6,.6],fountain:[1.9,1.9],well:[1.2,1.2],market:[1.35,.95],bench:[1.15,.5]};
export const fixedObstacles=[{template:'fountain',x:1,z:-1},{template:'market',x:-10,z:6},{template:'market',x:10,z:5},{template:'well',x:-68,z:37}];
// Same frame as the server's can_step: yaw is radians when the record carries
// scaleX (seeded world) and degrees otherwise; fences stretch by scaleX/scaleZ.
// An entity row without scaleX is synced to the server's realm_objects with
// scaleX = scaleZ = 1.3 × scale (the shared building factor), and the server's
// can_step stretches fences by it: mirror that, or client routes squeeze through
// pen gateways the server walker refuses (e.g. Birchford's hen pen).
export function obstacleFrame(d){const scale=d.scale||1,fence=d.template==='fence',synced=1.3*scale;return {angle:(d.yaw||0)*('scaleX' in d?1:Math.PI/180),sx:fence?d.scaleX||synced:scale,sz:fence?d.scaleZ||synced:scale}}
export function obstacleBlocks(d,x,z){const size=obstacleSizes[d.template];if(!size)return false;const {angle,sx,sz}=obstacleFrame(d),scale=d.scale||1,dx=x-d.x,dz=z-d.z,tx=(dx*Math.cos(angle)-dz*Math.sin(angle))/sx,tz=(dx*Math.sin(angle)+dz*Math.cos(angle))/sz;return ['fountain','well','tree','pine','rock'].includes(d.template)?Math.hypot(tx,tz)<size[0]+.2:Math.abs(tx)<size[0]+.2&&Math.abs(tz)<size[1]+.2;}
// Forests contain thousands of harvest targets. A point query only needs nearby buckets.
export function createObstacleIndex(records,cellSize=16){
 const buckets=new Map();
 for(const d of records){const size=obstacleSizes[d.template];if(!size||!Number.isFinite(d.x)||!Number.isFinite(d.z))continue;const {angle,sx,sz}=obstacleFrame(d),c=Math.cos(angle),s=Math.sin(angle),scale=d.scale||1,hx=size[0]+.2,hz=size[1]+.2,radiusX=Math.abs(c)*hx*sx+Math.abs(s)*hz*sz,radiusZ=Math.abs(s)*hx*sx+Math.abs(c)*hz*sz,entry={x:d.x,z:d.z,c,s,scale,sx,sz,hx,hz,circle:['fountain','well','tree','pine','rock'].includes(d.template)};for(let x=Math.floor((d.x-radiusX)/cellSize);x<=Math.floor((d.x+radiusX)/cellSize);x++)for(let z=Math.floor((d.z-radiusZ)/cellSize);z<=Math.floor((d.z+radiusZ)/cellSize);z++){const key=x+':'+z;if(!buckets.has(key))buckets.set(key,[]);buckets.get(key).push(entry)}}
 return {blocked(x,z){for(const d of buckets.get(Math.floor(x/cellSize)+':'+Math.floor(z/cellSize))||[]){const dx=x-d.x,dz=z-d.z;if(d.circle?Math.hypot(dx,dz)/d.scale<d.hx:Math.abs((dx*d.c-dz*d.s)/d.sx)<d.hx&&Math.abs((dx*d.s+dz*d.c)/d.sz)<d.hz)return true}return false}};
}
