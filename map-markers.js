// The live list of map markers (map-icons.js) for the world map, the minimap and the owner
// console: world entity rows, town buildings, underground / lair / quest-arena areas (the server's
// list, falling back to the shipped dungeons and lairs), the roster spawn plan, agility
// shortcuts, the shipped fishing spots, the ferry boats and the quest givers who start a quest
// chain or a big quest (quests(): quest-markers.js chainGivers; a chain this player has already
// started stays in base() for the owner console but is left out of items()). Grouped into one marker per area
// (clusterMarkers), then the owner's overrides from gameConfig.mapMarkers (hide, rename, custom
// markers; db/map-icons.sql) are applied. Rebuilt only when the inputs change, at most once a
// second, so the minimap can ask every refresh.
import {collectMarkers,clusterMarkers,applyOverrides,markerId,MARKER_CATS} from './map-icons.js?v=release-20261107-quests162';
import {dungeons} from './underground-data.js?v=release-20261107-quests162';
import {undergroundAreas} from './underground.js?v=release-20261107-quests162';
import {BOSSES,LAIRS} from './bosses.js?v=release-20261107-quests162';
import {rosterBeasts} from './monster-roster.js?v=release-20261107-quests162';
import {monsterSpawns} from './monster-spawns.js?v=release-20261107-quests162';
import {shortcuts,shortcutEntity} from './agility-data.js?v=release-20261107-quests162';
import {extraFishingSpots} from './water-data.js?v=release-20261107-quests162';
import {PLACES} from './explore-data.js?v=release-20261107-quests162';

const LAIR_IDS=LAIRS.map(l=>l.id),SHORTCUTS=shortcuts.map(s=>shortcutEntity(s)).filter(Boolean);
export function createMapMarkers({rows=()=>[],buildings=()=>[],quests=()=>[],config=()=>null,now=()=>performance.now()}={}){
 let base=[],items=[],key='',cfgKey='',built=0,stamp=0,preview=null;
 const areas=()=>{const live=undergroundAreas()||[],ids=new Set(live.map(a=>a.id));return [...live,...[...dungeons,...LAIRS].filter(a=>!ids.has(a.id))]};
 function inputs(){const r=rows()||[],b=buildings()||[],a=areas();let q=[];try{q=quests()||[]}catch{/* quest UI not up yet */}let sum=0;for(const d of r)sum+=(+d.x||0)*1.7+(+d.z||0)*.3;for(const d of b)sum+=(+d.x||0)+(+d.z||0)*.5;
  return {r,b,a,q,key:r.length+':'+b.length+':'+a.length+':'+sum.toFixed(1)+':'+a.map(x=>x.id+(x.entrances||[]).length).join(',')+':'+q.map(g=>g.id+'@'+Math.round(g.x)+','+Math.round(g.z)+(g.started?'+':'-')+(g.quests||[]).join('/')).join('|')}}
 function rebuild(force=false){const t=now();if(!force&&built&&t-built<1000)return false;built=t;
  const cfg=preview||config()||null,ck=JSON.stringify(cfg||{}),inp=inputs();if(!force&&inp.key===key&&ck===cfgKey)return false;
  if(inp.key!==key||force){base=clusterMarkers(collectMarkers({rows:inp.r,buildings:inp.b,areas:inp.a,bosses:BOSSES,lairs:LAIR_IDS,roster:rosterBeasts,spawns:monsterSpawns,shortcuts:SHORTCUTS,fishing:extraFishingSpots,places:PLACES,quests:inp.q})).map(c=>({...c,id:markerId(c)}));key=inp.key}
  items=applyOverrides(base.filter(c=>!(c.cat==='quest'&&c.started)),cfg);cfgKey=ck;stamp++;return true}
 return {
  // Markers to draw (owner overrides applied).
  items(){rebuild();return items},
  // Every marker before overrides (the owner console lists these to hide or rename).
  base(){rebuild();return base},
  get stamp(){rebuild();return stamp},
  // Markers within `radius` world units of (x,z), skipping kinds in `hidden`.
  near(x,z,radius,hidden=null){rebuild();const out=[];for(const c of items){if(hidden?.has?.(c.cat))continue;if(Math.abs(c.x-x)<=radius&&Math.abs(c.z-z)<=radius)out.push(c)}return out},
  // The console previews unsaved overrides on this screen (null: back to the saved ones).
  preview(cfg){preview=cfg||null;rebuild(true)},
  refresh(){rebuild(true)},
  kinds:MARKER_CATS
 };
}
