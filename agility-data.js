// Agility shortcuts: log balances, rope swings, wall climbs, stepping stones and crevices.
// Each is a world object (entity) with data.agility = {level,xp,fail,failDamage,ticks,ends}; the
// server (eldervale_private.underground_command 'agility') checks the level, rolls success,
// moves the player to the far end and grants XP. Underground ends are written in the area's
// local coordinates ({area,level}) and resolved with underground-data.js.
import {dungeons,toWorld} from './underground-data.js?v=release-20261107-bank153';
export const AGILITY_TEMPLATES={log_balance:'Balancing log',rope_swing:'Rope swing',wall_climb:'Climbing wall',stepping_stones:'Stepping stones',squeeze:'Narrow crevice'};
export const AGILITY_VERBS={log_balance:'Walk across',rope_swing:'Swing on',wall_climb:'Climb',stepping_stones:'Jump across',squeeze:'Squeeze through'};
// OSRS-style: no failure on most shortcuts; risky ones fail less often as your level rises above the
// requirement and never once you are `margin` levels above it.
export function failChance(level,required,fail=0,margin=20){if(level<required)return 1;return Math.max(0,fail*(1-(level-required)/Math.max(1,margin)))}
export const shortcuts=[
 {id:'wander_log',template:'log_balance',name:'Wander log balance',level:5,xp:8,fail:.25,failDamage:20,ticks:5,ends:[[-112,3.6],[-112,14.8]]},
 {id:'birchford_scramble',template:'wall_climb',name:'Birchford wall scramble',level:11,xp:12,fail:.2,failDamage:25,ticks:4,ends:[[-272.5,120],[-263.5,120]]},
 {id:'wildwater_stones',template:'stepping_stones',name:'Wildwater stepping stones',level:15,xp:14,fail:.3,failDamage:30,ticks:5,ends:[[-39.5,70],[-30,70]]},
 {id:'saltreed_swing',template:'rope_swing',name:'Saltreed rope swing',level:30,xp:22,fail:.25,failDamage:40,ticks:4,ends:[[346.6,204],[356.6,204]]},
 {id:'heron_log',template:'log_balance',name:'Heron Brook log',level:20,xp:16,fail:.2,failDamage:30,ticks:4,ends:[[146.4,349],[154.2,349]]},
 {id:'birchroot_crawl',template:'squeeze',name:'Root crawl',level:8,xp:10,fail:0,failDamage:0,ticks:5,underground:{area:'birchroot_hollow',level:0},ends:[[20,-3],[19,12]]},
 {id:'undercroft_passage',template:'squeeze',name:'Collapsed passage',level:42,xp:35,fail:.15,failDamage:60,ticks:5,underground:{area:'hollowmere_undercroft',level:0},ends:[[22,-4],[14,-21]]},
 {id:'molten_stones',template:'stepping_stones',name:'Molten stepping stones',level:70,xp:60,fail:.2,failDamage:90,ticks:5,underground:{area:'cindervault_depths',level:1},ends:[[37,4],[42,14]]}
];
// World coordinates of both ends.
export function shortcutEnds(s,areas=dungeons){if(!s.underground)return s.ends.map(e=>[...e]);const area=areas.find(a=>a.id===s.underground.area);if(!area)return null;return s.ends.map(([x,z])=>{const w=toWorld(area,s.underground.level,x,z);return [w.x,w.z]})}
// The entity a shortcut becomes (the object stands halfway, turned along the crossing).
export function shortcutEntity(s,areas=dungeons){const ends=shortcutEnds(s,areas);if(!ends)return null;const [[ax,az],[bx,bz]]=ends,len=Math.hypot(bx-ax,bz-az);
 return {kind:'object',template:s.template,name:s.name,x:Math.round((ax+bx)/2*10)/10,z:Math.round((az+bz)/2*10)/10,yaw:Math.round(Math.atan2(bx-ax,bz-az)*180/Math.PI),length:Math.round(len*10)/10,
  agility:{id:s.id,level:s.level,xp:s.xp,fail:s.fail,failDamage:s.failDamage,ticks:s.ticks,margin:s.margin||20,ends}};}
