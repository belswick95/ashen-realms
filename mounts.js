import {meshItemIcon} from './item-appearance.js?v=release-20261105-characters55';
import {castle} from './castle-layout.js?v=release-20261105-characters55';
import {isBuilding,localPoint} from './world-surfaces.js?v=release-20261105-characters55';
export const mountIcon=meshItemIcon('mount:armoredWhiteHorse');
export const mountCatalog={armoredWhiteHorse:{name:'Armored white horse',icon:mountIcon,multiplier:3,description:'Ride at 3× walking speed without using run energy. Automatically dismounts in buildings, castles, combat and while gathering.'}};
export const MOUNT_SPEED=19.2;
export function mountAllowed(x,z,rows=[]){
 if(Math.abs(x-castle.x)<=castle.half+2&&Math.abs(z-castle.z)<=castle.half+2)return false;
 for(const row of rows){if(row.deleted)continue;const d=row.data||row;if(!isBuilding(d))continue;const [u,v]=localPoint(d,x,z),s=1.3*(d.scale||1);if(Math.abs(u)<=2.3*s&&Math.abs(v)<=2.15*s)return false;}return true;
}
export function mountSpeed(mounted,running){return mounted?MOUNT_SPEED:running?12.8:6.4;}
