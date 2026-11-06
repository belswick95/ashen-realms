import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import * as geo from '../geography.js?v=release-20261106-r3x109';
import {ROAD_GRADE,createLandscape} from '../landscape.js?v=release-20261106-r3x109';
import {castle} from '../castle-layout.js?v=release-20261106-r3x109';
// Roads follow the land: no trench through the hills, gentle grades, soft shoulders.
// Both worlds are measured: the live seeded world (db/generated-world.json) and the legacy layout.
const MAX_GRADE=.15,MAX_BANK_SLOPE=.75,MAX_TRENCH=6.5;
function survey(world){
 // The legacy layout is surveyed first: configuring the seeded world replaces the shared geography.
 if(world==='generated')geo.initializeGeography(JSON.parse(fs.readFileSync(new URL('../db/generated-world.json',import.meta.url))).config);
 const land=createLandscape();
 // Forced-level ground keeps its old behaviour: water valleys, towns and the capital, the castle plateau.
 const excluded=(x,z)=>land.waterAt(x,z)>0||geo.worldRivers.some(r=>r.points.some((p,i)=>i&&geo.segmentDistance(x,z,r.points[i-1],p)<r.width/2+22))||geo.landscapeLakes.some(l=>Math.hypot((x-l.x)/l.rx,(z-l.z)/l.rz)<1.8)||geo.landscapeSettlements.some(([sx,sz])=>Math.hypot(x-sx,z-sz)<72)||Math.max(Math.abs(x-castle.x),Math.abs(z-castle.z))<92;
 const out={grade:0,bank:0,trench:0,samples:0};
 for(const line of geo.roadLines)for(let i=1;i<line.length;i++){
  const a=line[i-1],b=line[i],L=Math.hypot(b[0]-a[0],b[1]-a[1]);if(L<1e-6)continue;const ux=(b[0]-a[0])/L,uz=(b[1]-a[1])/L;
  for(let s=0;s<L;s+=1.5){
   const x=a[0]+ux*s,z=a[1]+uz*s;if(land.bridges.some(br=>Math.hypot(x-br.x,z-br.z)<br.length/2+3)||land.waterAt(x,z)>0)continue;out.samples++;
   out.grade=Math.max(out.grade,Math.abs(land.heightAt(x+ux,z+uz)-land.heightAt(x-ux,z-uz))/2);
   if(excluded(x,z))continue;
   const y=land.heightAt(x,z);out.trench=Math.max(out.trench,Math.min(land.heightAt(x-uz*14,z+ux*14),land.heightAt(x+uz*14,z-ux*14))-y);
   for(const side of [-1,1])for(let d=3;d<=14;d++){const px=x-uz*d*side,pz=z+ux*d*side;if(excluded(px,pz))continue;out.bank=Math.max(out.bank,Math.hypot(land.heightAt(px+.5,pz)-land.heightAt(px-.5,pz),land.heightAt(px,pz+.5)-land.heightAt(px,pz-.5)))}
  }
 }
 return {land,out,settlements:geo.landscapeSettlements.map(p=>[...p])};
}
const surveys={legacy:survey('legacy')};surveys.generated=survey('generated');
for(const world of ['generated','legacy'])test(`${world} world: roads climb gently and sit on the land, not in trenches`,()=>{
 const {out}=surveys[world];
 assert.ok(out.samples>500,'surveyed the road network');
 assert.ok(out.grade<=MAX_GRADE,`steepest road grade ${out.grade.toFixed(3)} (limit ${MAX_GRADE}, design ${ROAD_GRADE})`);
 assert.ok(out.bank<=MAX_BANK_SLOPE,`steepest bank beside a road ${out.bank.toFixed(3)} (limit ${MAX_BANK_SLOPE})`);
 assert.ok(out.trench<=MAX_TRENCH,`road sits ${out.trench.toFixed(2)} below both sides (limit ${MAX_TRENCH})`);
});
test('generated world: roads still meet every bridge deck and settle into towns',()=>{
 const {land,settlements}=surveys.generated;
 for(const b of land.bridges)for(const end of [-1,1]){const x=b.x+Math.sin(b.yaw)*(b.length/2+.5)*end,z=b.z+Math.cos(b.yaw)*(b.length/2+.5)*end;assert.ok(Math.abs(land.heightAt(x,z)-land.walkHeight(b.x+Math.sin(b.yaw)*(b.length/2-.3)*end,b.z+Math.cos(b.yaw)*(b.length/2-.3)*end))<.45,`bridge end ${x.toFixed(0)},${z.toFixed(0)} meets its bank`)}
 for(const [x,z] of settlements)assert.ok(Math.abs(land.heightAt(x,z))<.01);
});
test('lowlands are gentler while the snowy north and corner ranges keep their relief',()=>{
 const {land}=surveys.generated;
 let lowland=0,n=0;for(let x=-380;x<=-60;x+=8)for(let z=60;z<=380;z+=8){lowland+=land.heightAt(x,z);n++}
 let north=-Infinity;for(let x=60;x<=400;x+=8)for(let z=-400;z<=-60;z+=8)north=Math.max(north,land.heightAt(x,z));
 assert.ok(lowland/n<6,'verdant lowlands average '+(lowland/n).toFixed(2));
 assert.ok(north>40,'snowy highlands still rise to '+north.toFixed(1));
});
