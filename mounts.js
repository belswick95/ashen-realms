import {castle} from './castle-layout.js?v=release-20261104-professions29';
import {isBuilding,localPoint} from './world-surfaces.js?v=release-20261104-professions29';
export const mountIcon='<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M10 42V25L16 15L22 12L26 5L29 13L35 18L41 29L36 33L29 29L28 42Z" fill="#eeeae0" stroke="#bca673" stroke-width="2"/><path d="M15 25L21 17L28 16L33 25L28 29L28 42H15Z" fill="#8198a9" stroke="#d9c18b" stroke-width="2"/><path d="M20 24L27 20M17 31L25 28M17 37L25 34" stroke="#dce6eb" stroke-width="2"/><circle cx="32" cy="21" r="1.5" fill="#19242b"/></svg>';
export const mountCatalog={armoredWhiteHorse:{name:'Armored white horse',icon:mountIcon,multiplier:3,description:'Ride at 3× walking speed without using run energy. Automatically dismounts in buildings, castles, combat and while gathering.'}};
export const MOUNT_SPEED=9.6;
export function mountAllowed(x,z,rows=[]){
 if(Math.abs(x-castle.x)<=castle.half+2&&Math.abs(z-castle.z)<=castle.half+2)return false;
 for(const row of rows){if(row.deleted)continue;const d=row.data||row;if(!isBuilding(d))continue;const [u,v]=localPoint(d,x,z),s=1.3*(d.scale||1);if(Math.abs(u)<=2.3*s&&Math.abs(v)<=2.15*s)return false;}return true;
}
export function mountSpeed(mounted,running){return mounted?MOUNT_SPEED:running?6.4:3.2;}
