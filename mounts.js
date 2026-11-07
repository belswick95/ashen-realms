import {meshItemIcon} from './item-appearance.js?v=release-20261107-quests162';
import {castle} from './castle-layout.js?v=release-20261107-quests162';
import {isBuilding,localPoint} from './world-surfaces.js?v=release-20261107-quests162';
import {MOUNT_SPEED,travelSpeed} from './click-walk.js?v=release-20261107-quests162';
export const mountIcon=meshItemIcon('mount:armoredWhiteHorse');
export const mountCatalog={armoredWhiteHorse:{name:'Armored white horse',icon:mountIcon,multiplier:1.85,description:'Gallop at nearly twice running speed without using run energy. Automatically dismounts in buildings, castles, combat and while gathering.'}};
export {MOUNT_SPEED};
export function mountAllowed(x,z,rows=[]){
 if(Math.abs(x-castle.x)<=castle.half+2&&Math.abs(z-castle.z)<=castle.half+2)return false;
 for(const row of rows){if(row.deleted)continue;const d=row.data||row;if(!isBuilding(d))continue;const [u,v]=localPoint(d,x,z),s=1.3*(d.scale||1);if(Math.abs(u)<=2.3*s&&Math.abs(v)<=2.15*s)return false;}return true;
}
export function mountSpeed(mounted,running){return travelSpeed(mounted,running);}
