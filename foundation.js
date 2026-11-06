import {campObstacleSizes} from './navigation-obstacles.js?v=release-20261106-tile93';
// Ground contact for placed structures and props on sloped terrain.
// Walk-in buildings already get a levelled plot (landscape.levelBuildingPlot);
// these helpers cover everything else that used to sit at the height of its
// centre point only, so one side sank into a hillside while the other floated.

// Half-extents (metres, before the entity's scale) of structures that get a
// levelled terrain pad like a building, so walls and doors meet the ground.
export const structureSizes={farm_hut:campObstacleSizes.farm_hut,chicken_coop:campObstacleSizes.chicken_coop,tent:campObstacleSizes.tent,supply_wagon:campObstacleSizes.supply_wagon,market:[1.35,.95],well:[1.2,1.2],fountain:[1.9,1.9],thieving_stall:[1.2,.8],furnace:[1.2,.8],workbench:[1.2,.8]};
export const isFoundationStructure=d=>!!d&&!d.floor&&Object.hasOwn(structureSizes,d.template);
const PAD=.45;
// A plot in landscape.levelBuildingPlot's frame (it flattens ±2.12·scaleX by
// ±1.98·scaleZ plus a blend ring), sized to the structure plus a small apron.
export function structurePlot(d){const [hx,hz]=structureSizes[d.template],s=d.scale||1;return {x:d.x,z:d.z,scaleX:(hx*s+PAD)/2.12,scaleZ:(hz*s+PAD)/1.98,rotation:(d.yaw||0)*Math.PI/180,floorHeight:0}}
// Terrain heights over a rotated rectangle: centre, lowest and highest sample.
export function footprintHeights(heightAt,{x,z,hx,hz,rotation=0},samples=4){
 const c=Math.cos(rotation),s=Math.sin(rotation);let min=Infinity,max=-Infinity;
 for(let i=0;i<=samples;i++)for(let j=0;j<=samples;j++){const lx=(-1+2*i/samples)*hx,lz=(-1+2*j/samples)*hz,h=heightAt(x+lx*c+lz*s,z-lx*s+lz*c);if(h<min)min=h;if(h>max)max=h}
 return {center:heightAt(x,z),min,max};
}
// Props (rocks, hay bales, troughs, crates...) that are not levelled: sit them
// on the low side of their footprint so no edge hangs in the air; the uphill
// side tucks into the slope like a real boulder. Flat ground is unchanged.
export function groundedBase({center,min,max}){const spread=max-min;if(!(spread>.06))return center;return Math.min(center,min+spread*.12)}
export const groundedSizes={rock:[1.1,1.1],hay_bale:campObstacleSizes.hay_bale,water_trough:campObstacleSizes.water_trough,wheelbarrow:campObstacleSizes.wheelbarrow,flower_bed:campObstacleSizes.flower_bed,stone_statue:campObstacleSizes.stone_statue,woodpile:campObstacleSizes.woodpile,crate:[.7,.6],barrel:[.6,.6],bench:[1.15,.5],anvil:[.8,.8],spinning_wheel:[.8,.8],tanning_rack:[.8,.8],essence_rock:[.8,.8],practice_chest:[.8,.8],log_seat:campObstacleSizes.log_seat,wooden_table:campObstacleSizes.wooden_table,weapon_rack:campObstacleSizes.weapon_rack};
export function propBase(heightAt,d){const size=groundedSizes[d.template];if(!size||d.floor)return null;const s=d.scale||1;return groundedBase(footprintHeights(heightAt,{x:d.x,z:d.z,hx:size[0]*s,hz:size[1]*s,rotation:(d.yaw||0)*Math.PI/180}))}
