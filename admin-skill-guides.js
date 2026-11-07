// Owner console › Game › Skill guides: the in-game skill guides (skill-guide.js) are built from the
// game data, so they need no editing: a new item, recipe, tier or recipe edit in the console shows up
// in the guide by itself. This tab lists every guide with its tabs, row counts and data sources, and
// opens any of them on this screen ("Preview") exactly as a player would see it.
import {guideSummary} from './skill-guide-data.js?v=release-20261107-polish150';

export function createSkillGuideTab(ctx){
 const {el,btn}=ctx;
 function Guides(){
  const W=ctx.workspace;
  W.append(el('p','Players open these by clicking a skill in the Skills tab. Each guide is generated from the game’s own items, gear tiers, recipes (including your recipe edits), food and fishing tables, prayers and agility shortcuts, so it updates automatically. Woodcutting numbers live only in the server SQL; after changing them run node scripts/build-skill-guide-data.mjs.',{class:'console-muted'}));
  const open=id=>{const g=window.eldervaleSkillGuide;if(!g)throw Error('Enter the world first: the guide opens over the game.');ctx.note?.('Previewing the '+id+' guide. Press Esc to close it.');g.open(id)};
  const list=el('div',null,{class:'studio-entity-list'});W.append(list);
  for(const s of guideSummary()){
   const row=el('div',null,{class:'studio-actions',title:s.sources.join(', ')});
   row.append(el('strong',s.icon+' '+s.name+' '),el('span',' '+s.rows+' rows · '+s.tabs.map(t=>t.label+' '+t.rows).join(' · ')+' '));
   btn('Preview',()=>open(s.id),row);list.append(row);
  }
 }
 return {'Skill guides':Guides};
}
