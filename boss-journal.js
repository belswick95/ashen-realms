// Boss log: the "Bosses" tab of the journal (explore.js panel). One row per enabled boss from
// public.boss_journal() — name, lair, kill count and personal best — with "Not yet slain" for bosses
// the player has never beaten. The server owns the numbers; this module only formats and draws them.
import {bossById,LAIRS,LAIR_EXTENSIONS,formatTicks} from './bosses.js?v=release-20261107-torch141';
import {dungeons} from './underground-data.js?v=release-20261107-torch141';

const AREA_NAMES=Object.fromEntries([...dungeons,...LAIRS].map(a=>[a.id,a.name]));
const LEVEL_NAMES={};
for(const a of LAIRS)for(const l of a.levels||[])LEVEL_NAMES[a.id+':'+l.level]=l.name;
for(const [id,x] of Object.entries(LAIR_EXTENSIONS))for(const l of x.levels||[])LEVEL_NAMES[id+':'+l.level]=l.name;
const titleCase=s=>String(s||'').replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase());

// "Hollowmere Undercroft · Hollow Throne": the lair area and the level the boss fights on.
export function lairLabel(bossId,area){
 const def=bossById[bossId]?.lair,id=area||def?.area;if(!id)return 'Unknown lair';
 const name=AREA_NAMES[id]||titleCase(id),level=def&&def.area===id?LEVEL_NAMES[id+':'+def.level]:null;
 return level&&level!==name?name+' · '+level:name;
}
// Personal best in m:ss.s (ticks × 0.6 s), or null when there is none.
export const bestTime=ticks=>Number(ticks)>0?formatTicks(Number(ticks)):null;

// Normalised rows from a boss_journal() reply ({bosses:[{id,name,level,lair,kills,best}]}).
export function bossJournalRows(reply){
 const list=Array.isArray(reply?.bosses)?reply.bosses:[];
 return list.filter(b=>b&&b.id).map(b=>{const kills=Math.max(0,Math.floor(Number(b.kills)||0));
  return {id:String(b.id),name:String(b.name||bossById[b.id]?.name||titleCase(b.id)),level:Number(b.level)||bossById[b.id]?.level||null,
   lair:lairLabel(b.id,b.lair),kills,best:kills?bestTime(b.best):null,slain:kills>0}});
}
export function bossJournalSummary(rows){
 const slain=rows.filter(r=>r.slain).length,kills=rows.reduce((n,r)=>n+r.kills,0);
 return slain+' of '+rows.length+' bosses slain · '+kills.toLocaleString('en-GB')+' kill'+(kills===1?'':'s');
}

// Draw the tab into `body` (the panel header shows bossJournalSummary) with `el(tag,text,attrs)` (the journal's element helper).
// `reply` is undefined while loading, null when the server could not be reached.
export function drawBossJournal(body,el,reply){
 if(reply===undefined){body.append(el('p','Loading your boss log…',{class:'explore-muted'}));return}
 const rows=bossJournalRows(reply);
 if(!rows.length){body.append(el('p',reply===null?'Your boss log could not be loaded. Close the journal and try again.':'No bosses are listed right now.',{class:'explore-muted'}));return}
 const list=el('ul',null,{class:'boss-log','aria-label':'Boss kill counts'});
 for(const r of rows){
  const li=el('li',null,{class:'boss-log-row '+(r.slain?'slain':'unslain')});
  const who=el('div',null,{class:'boss-log-who'});who.append(el('strong',r.name),el('span',(r.level?'Level '+r.level+' · ':'')+r.lair,{class:'boss-log-lair'}));
  const stats=el('dl',null,{class:'boss-log-stats'});
  if(r.slain){stats.append(el('dt','Kills'),el('dd',r.kills.toLocaleString('en-GB')),el('dt','Best'),el('dd',r.best||'—'))}
  else stats.append(el('dd','Not yet slain',{class:'boss-log-none'}));
  li.append(who,stats);list.append(li);
 }
 body.append(list,el('p','Kill count and best time update after each kill. A best time runs from the start of the fight to the kill.',{class:'explore-muted'}));
}
