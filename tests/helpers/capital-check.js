// Layout validation for the capital (used by tests/capital-city.test.js and the planning preview).
import {capital,capitalBlueprint,capitalStreets,wallDistance,TOWER_RADIUS,WALL_HALF,marketSquare} from '../../capital-layout.js';
import {walkModel,legClear} from './capital-walk.js';
export const BUILDINGS=['cottage','bank','inn','forge'];
const rad=d=>d*Math.PI/180;
// Visual footprint (foundation apron) corners in world space.
export function footprint(d,pad=0){const a=rad(d.yaw||0),s=1.3*(d.scale||1),hx=2.42*s+pad,hz=2.22*s+pad,c=Math.cos(a),n=Math.sin(a);return [[-hx,-hz],[hx,-hz],[hx,hz],[-hx,hz]].map(([u,v])=>[d.x+u*c+v*n,d.z-u*n+v*c])}
export function streetRect(seg,pad=0){const a=rad(seg.yaw),c=Math.cos(a),n=Math.sin(a),hw=seg.width/2+pad,hl=seg.length/2;return [[-hw,-hl],[hw,-hl],[hw,hl],[-hw,hl]].map(([u,v])=>[seg.x+u*c+v*n,seg.z-u*n+v*c])}
// Separating-axis overlap for convex polygons.
export function polysOverlap(A,B){for(const P of [A,B])for(let i=0;i<P.length;i++){const [x1,z1]=P[i],[x2,z2]=P[(i+1)%P.length],nx=z2-z1,nz=x1-x2;let a0=Infinity,a1=-Infinity,b0=Infinity,b1=-Infinity;for(const [x,z]of A){const p=x*nx+z*nz;a0=Math.min(a0,p);a1=Math.max(a1,p)}for(const [x,z]of B){const p=x*nx+z*nz;b0=Math.min(b0,p);b1=Math.max(b1,p)}if(a1<=b0||b1<=a0)return false}return true}
export function checkLayout(existing){
 const rows=capitalBlueprint(),problems=[];
 const newB=rows.filter(r=>BUILDINGS.includes(r.template)),oldB=existing.filter(r=>BUILDINGS.includes(r.template)),all=[...newB,...oldB];
 for(let i=0;i<newB.length;i++)for(let j=0;j<all.length;j++){if(all[j]===newB[i]||(j<newB.length&&j<=i))continue;if(polysOverlap(footprint(newB[i],.6),footprint(all[j],.6)))problems.push(`overlap ${newB[i].name} / ${all[j].name}`)}
 const streets=rows.filter(r=>r.template==='road');
 for(const b of all)for(const s of streets)if(polysOverlap(footprint(b,.3),streetRect(s)))problems.push(`street ${s.name} runs into ${b.name}`);
 for(const b of newB){for(const [x,z]of footprint(b))if(wallDistance(x,z)>-(WALL_HALF+2.2))problems.push(`${b.name} too close to the wall`);
  for(const t of rows.filter(r=>r.template==='castle_tower'&&!r.blueprintKey.startsWith('keep-turret')))if(footprint(b).some(([x,z])=>Math.hypot(x-t.x,z-t.z)<TOWER_RADIUS*(t.scale||1)+1.5))problems.push(`${b.name} hits tower ${t.blueprintKey}`)}
 // Props/stations must not sit on a street or inside another building's shell (stations belong inside their own).
 const model=walkModel([...existing,...rows]);
 for(const p of rows.filter(r=>r.kind==='object'&&!BUILDINGS.includes(r.template)&&!['road','terrain_stone','castle_wall','castle_tower','castle_gate','lantern','banner'].includes(r.template))){
  for(const s of streets)if(polysOverlap(streetRect(s),[[p.x-.6,p.z-.6],[p.x+.6,p.z-.6],[p.x+.6,p.z+.6],[p.x-.6,p.z+.6]]))problems.push(`${p.template} ${p.name} blocks ${s.name}`)}
 // Every actor with a route walks clear legs.
 for(const a of rows.filter(r=>Array.isArray(r.route)))for(let i=0;i<a.route.length;i++){const p=a.route[i],q=a.route[(i+1)%a.route.length],hit=legClear(model,p,q);if(hit)problems.push(`${a.name} (${a.blueprintKey}) leg ${i} blocked at ${hit.x.toFixed(1)},${hit.z.toFixed(1)}`)}
 // Stationary actors stand on free ground (inside a room counts as free).
 for(const a of rows.filter(r=>r.kind==='npc'&&!r.route))if(model.blocked(a.x,a.z))problems.push(`${a.name} stands inside an obstacle`);
 return {rows,problems,model};
}
