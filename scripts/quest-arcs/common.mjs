// Shared builders for the Round-3 quest arcs (scripts/quest-arcs/*.mjs -> db/quest-arc-*.sql).
// Authoring format: quests are written as quest v2 data (db/quests-v2.sql) with symbolic references
// '@arc.name' for the arc's own NPCs and monsters; resolve() swaps them for fixed entity ids.
import {entityDefaults} from '../../world-templates.js?v=release-20261107-attacks134';
import {bestiaryEntity} from '../../bestiary.js?v=release-20261107-attacks134';
import {statBlock} from '../../monster-roster.js?v=release-20261107-attacks134';
import {shortcutEntity} from '../../agility-data.js?v=release-20261107-attacks134';

export const BLUEPRINT='quest-arcs-v1';
export const ARC_CODES={crown:1,frontier:2,forge:3,tide:4};
const hex=(n,w)=>n.toString(16).padStart(w,'0');
// Fixed ids: NPCs a3c0a000-000<arc>-4000-8000-<n>, monsters ...-9000-..., objects ...-a000-..., quests a3c0b000-...
export const npcId=(arc,n)=>`a3c0a000-000${ARC_CODES[arc]}-4000-8000-${hex(n,12)}`;
export const monsterId=(arc,n)=>`a3c0a000-000${ARC_CODES[arc]}-4000-9000-${hex(n,12)}`;
export const objectId=(arc,n)=>`a3c0a000-000${ARC_CODES[arc]}-4000-a000-${hex(n,12)}`;
export const questId=(arc,n)=>`a3c0b000-000${ARC_CODES[arc]}-4000-8000-${hex(n,12)}`;

export const n=text=>({who:'npc',text});
export const p=text=>({who:'player',text});
// Dialogue shorthand: lines starting with '> ' are the player's.
export const talk=(...lines)=>lines.map(l=>l.startsWith('> ')?p(l.slice(2)):n(l));

// An arc NPC: a world template, standing still where quests send the player.
export function npc(arc,n,ref,template,name,x,z,o={}){
 const d={...entityDefaults(template,x,z),name,roam:0,yaw:o.yaw??0,dialogue:o.dialogue||'',questArc:arc,blueprint:BLUEPRINT,blueprintKey:arc+':'+ref,...o.extra};
 if(o.shop)d.shop=o.shop;
 return {ref:arc+'.'+ref,id:npcId(arc,n),data:d};
}
// An arc monster: a roster creature's body with its own name, level and stat block.
export function monster(arc,n,ref,base,name,x,z,o={}){
 const b=bestiaryEntity(base,x,z),level=o.level??b.level,stats=statBlock(level,o.rank||'Veteran',o.arch||'beast');
 const d={...b,...stats,name,level,x,z,yaw:o.yaw??0,roam:o.roam??2,respawn:o.respawn??60,hostile:o.hostile??true,examine:o.examine||b.examine,
  loot:[...(o.loot||[]),...(o.keepLoot===false?[]:(b.loot||[]).filter(l=>l.always))],questArc:arc,blueprint:BLUEPRINT,blueprintKey:arc+':'+ref};
 for(const k of ['scale','tint','eyes','accent','aura','crown','attackSpeed','attackType'])if(o[k]!==undefined)d[k]=o[k];
 delete d.roster;return {ref:arc+'.'+ref,id:monsterId(arc,n),data:d};
}
// A quest-gated agility shortcut (agility-data.js format + requires.unlock).
export function shortcut(arc,n,s){
 const e=shortcutEntity({margin:20,...s});e.agility.requires={unlock:s.unlock};
 return {ref:arc+'.'+s.id,id:objectId(arc,n),data:{...entityDefaults(s.template,e.x,e.z),...e,questArc:arc,blueprint:BLUEPRINT,blueprintKey:arc+':'+s.id}};
}
// A plain world object (profession station, prop) placed for an arc.
export function prop(arc,n,ref,template,name,x,z,o={}){
 return {ref:arc+'.'+ref,id:objectId(arc,n),data:{...entityDefaults(template,x,z),name,yaw:o.yaw??0,questArc:arc,blueprint:BLUEPRINT,blueprintKey:arc+':'+ref}};
}
// Quest keepsakes and story items: untradeable, kept on death, never sold.
export const item=(key,name,description,icon='scroll',extra={})=>['item:'+key,{name,description,icon,custom:true,category:'Quest items',buy:0,sell:0,unique:true,tradeable:false,untradeable:true,questItem:true,keepOnDeath:true,shopless:true,...extra}];
export const drop=(key)=>({item:key,min:1,max:1,chance:1,always:true});

// Underground arena: one or two levels in the underground engine's data format.
export const room=(id,x,z,rx,rz)=>({id,x,z,rx,rz}),tunnel=(width,...points)=>({width,points});
export const toWorld=(area,level,x,z)=>({x:area.origin.x+x,z:area.origin.z+level*400+z});

// Short camera-and-dialogue cutscene (design-patterns §1.6: under 30 s, no walking).
export function scene(name,title,subtitle,lines){
 const steps=[{fade:'in',ms:700,shot:{around:lines[0][0],distance:5,height:2.2,angle:30}},{title,subtitle,ms:2400}];
 for(const [who,text,speaker] of lines)steps.push({say:{who:who==='player'?'player':'npc',name:speaker,text},shot:{around:who==='player'?lines[0][0]:who,distance:3.4,height:1.8,angle:who==='player'?-35:35}});
 steps.push({fade:'out',ms:600});return {name,steps};
}

// Swap '@arc.ref' for entity ids everywhere in a quest (giver, stage npc, objective targets, cutscenes, unlocks).
export function resolver(entities){
 const ids=new Map(entities.map(e=>[e.ref,e.id]));
 return v=>JSON.parse(JSON.stringify(v).replace(/@([a-z]+\.[a-z0-9_]+)/g,(m,ref)=>{if(!ids.has(ref))throw Error('Unknown reference '+m);return ids.get(ref)}));
}
// The stored quest row: chain, order, published, empty classic objectives (stages carry them).
export function questRow(arc,q,resolve){
 const {n:num,...rest}=q;
 return {id:questId(arc,num),data:resolve({chain:'arc-'+arc,order:num,published:true,objectives:[],...rest})};
}
