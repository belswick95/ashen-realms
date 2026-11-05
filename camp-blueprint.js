import {approachPoint} from './castle-approach.js?v=release-20261105-camera74';
import {entityDefaults} from './world-templates.js?v=release-20261105-camera74';
import {seededRandom} from './procedural-world.js?v=release-20261105-camera74';
export function trailCampBlueprint(seed=241916600){const r=seededRandom(seed^0x15ca7),distance=78+Math.floor(r()*15),rows=[];let serial=0;const add=(template,along,side,extra={})=>{const p=approachPoint(along,side);const d={...entityDefaults(template,p.x,p.z),yaw:p.yaw,...extra,blueprint:'castle-trail-camp-v1',blueprintKey:String(++serial)};rows.push(d);return d};
 add('campfire',distance,8,{name:'Wayfarer campfire'});add('cooking_tripod',distance,8,{name:'Travelers’ cooking pot'});
 for(const [a,side]of [[-5,13],[8,-12],[-10,-11]]){const p=approachPoint(distance+a,side);add('tent',distance+a,side,{yaw:p.yaw+(side>0?90:-90)});add('bedroll',distance+a+2,side>0?9:-8,{yaw:p.yaw+90});}
 add('log_seat',distance-3,6,{yaw:approachPoint(distance).yaw+90});add('log_seat',distance+4,9,{yaw:approachPoint(distance).yaw+70});
 add('supply_wagon',distance+18,-11,{yaw:approachPoint(distance).yaw});add('woodpile',distance-7,8);add('wooden_table',distance+11,11);add('camp_lantern',distance-10,5);add('camp_lantern',distance+15,-5);add('trail_sign',distance-17,-5);add('rope_coil',distance+17,-8);add('stool',distance+10,8);
 add('camp_outfitter',distance+11,-6,{name:'Garrick the Outfitter'});add('camp_cook',distance+1,5,{name:'Mara the Trail Cook'});add('wayfarer',distance-4,-5,{name:'Alden the Wayfarer'});add('trail_warden',distance-20,6,{name:'Warden Elin'});add('camp_storyteller',distance+4,6,{name:'Orrin the Storykeeper'});
 for(let i=0;i<24;i++){const along=25+r()*175,side=(i%2?1:-1)*(18+r()*20);if(Math.hypot(approachPoint(along,side).x-approachPoint(distance).x,approachPoint(along,side).z-approachPoint(distance).z)<23)continue;add(i%6===0?'pine':'tree',along,side,{scale:.85+r()*.35,name:i%6===0?'Trail pine':'Forest oak'});}
 for(let i=0;i<6;i++)add('rock',distance-25+r()*80,(i%2?1:-1)*(16+r()*17),{scale:.5+r()*.4,name:'Mossy forest outcrop'});
 return {distance,center:approachPoint(distance),entities:rows};}
let campCache;export function campClearing(x,z,seed=241916600){if(!campCache||campCache.seed!==seed)campCache={seed,...trailCampBlueprint(seed)};return Math.hypot(x-campCache.center.x,z-campCache.center.z)<22}
