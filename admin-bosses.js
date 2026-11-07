// Game console → World → Bosses & uniques (db/bosses-*.sql). Everything the owner tunes:
//  * boss editor: numbers (attack speed, arena, respawn, reset, enrage), phases and attacks
//    (validated with bosses.js validateBoss before the server's own check), uniques and rarity,
//    the loot table (mech_rules 'drops', with a 10 000-kill simulator), enable/disable, reset fight;
//  * kill counts: viewer per boss, reset one player or everyone;
//  * lairs: enable/disable, quest gates on/off, teleport to the boss;
//  * unique items: tradeable / shopless / disabled flags;
//  * breath and fight settings (anti-breath shield %, tonic %, prayer %, dragon breath chance and
//    max hit, reset ticks, rare announcements, loot chest) and the master switch.
// Writes go through console_boss_* (owner-checked and audited on the server).
import {BREATH_DEFAULTS,validateBoss,formatTicks,parseOneIn} from './bosses.js?v=release-20261107-portrait145';

export const BOSS_NUMBERS=[['attackTicks','Attack speed (ticks)'],['arena.radius','Arena radius (tiles)'],['respawnTicks','Respawn (ticks)'],['resetTicks','Idle reset (ticks)'],
 ['enrage.afterTicks','Enrage after (ticks)'],['enrage.attackTicksMinus','Enrage: faster by (ticks)'],['enrage.damagePct','Enrage damage %']];
const get=(o,path)=>path.split('.').reduce((v,k)=>v?.[k],o);
// Flat form values for a boss definition.
export function bossFormValues(def){const out={};for(const [k] of BOSS_NUMBERS)out[k]=get(def,k)??'';out.phases=JSON.stringify(def.phases||[],null,1);out.attacks=JSON.stringify(def.attacks||{},null,1);out.uniques=(def.uniques||[]).map(u=>u.item+' '+u.chance).join('\n');return out}
// Form values → a new definition (validated). Throws with the first problem.
export function applyBossForm(def,values){
 const d=structuredClone(def);
 for(const [k,label] of BOSS_NUMBERS){const raw=values[k];if(raw===''||raw==null)continue;const v=Number(raw);if(!Number.isFinite(v))throw Error(label+': a number');const parts=k.split('.');let o=d;for(const p of parts.slice(0,-1))o=o[p]??=({});o[parts.at(-1)]=v}
 for(const key of ['phases','attacks'])if(values[key]!=null){try{d[key]=JSON.parse(values[key])}catch{throw Error(key+': not valid JSON')}}
 if(values.uniques!=null)d.uniques=String(values.uniques).split('\n').map(l=>l.trim()).filter(Boolean).map(l=>{const [item,chance='1/256']=l.split(/\s+/);if(!(parseOneIn(chance)>0))throw Error('Unique '+item+': chance like 1/256');return {item,chance}});
 const errors=validateBoss(d);if(errors.length)throw Error(errors[0]);
 return d;
}
// Preroll rows of the loot table follow the uniques list (rarity edits apply to drops too).
export function lootWithUniques(drops={},uniques=[],previous=[]){const keep=(drops.preroll||[]).filter(r=>![...uniques,...previous].some(u=>u.item===r.item));return {...drops,preroll:[...keep,...uniques.map(u=>({item:u.item,min:1,max:1,chance:u.chance}))]}}
export const killRow=r=>`${r.name||r.userId} · ${r.boss} · ${r.kills} kills · best ${formatTicks(r.best)}`;
export function breathPatch(values){const out={};for(const [k,v] of Object.entries(values)){if(k==='enabled'){out.enabled=v===true;continue}if(!(k in BREATH_DEFAULTS)||typeof BREATH_DEFAULTS[k]!=='number')throw Error('Unknown breath setting '+k);const n=Number(v);if(!Number.isFinite(n)||n<0||n>10000)throw Error(k+': 0 to 10000');out[k]=n}return out}

export function bossesSection({section,el,btn,field,invoke,note,parent}){
 const s=section('Bosses & unique gear',parent),status=el('p','Loading bosses…',{class:'console-muted'});s.append(status);const body=el('div');s.append(body);let state=null;
 async function load(){
  try{state=await invoke('console_boss',{})}catch(e){status.textContent=/unknown (console )?command/i.test(e.message)?'Bosses are not installed on this server yet (db/bosses-*.sql).':e.message;body.replaceChildren();return}
  const fighting=state.actors.filter(a=>a.fight).length;status.textContent=(state.config.enabled?'ON: phased bosses, telegraphs, breath and kill counts are live.':'OFF: bosses fight as plain monsters.')+` · ${state.defs.length} bosses · ${fighting} fight${fighting===1?'':'s'} in progress`;draw();
 }
 const form=(parent,cls='console-form-grid')=>{const f=el('form',null,{class:cls});f.onsubmit=e=>e.preventDefault();parent.append(f);return f};
 function draw(){
  body.replaceChildren();const c=state.config;
  const sw=form(body,'console-inline');btn(c.enabled?'Switch bosses off':'Switch bosses on',async()=>{await invoke('console_boss_settings',{config:{enabled:!c.enabled}});note('Bosses '+(c.enabled?'off':'on')+'.');await load()},sw);
  // ---- boss editor
  for(const b of state.defs){const d=b.data,kills=state.kills[b.id],actor=state.actors.find(a=>a.boss===b.id);
   const det=el('details');det.append(el('summary',`${d.name} (level ${d.level})${b.enabled?'':' — off'}${kills?` · ${kills.kills} kills by ${kills.players} players · best ${formatTicks(kills.best)}`:''}`));body.append(det);
   det.append(el('p',`Lair ${d.lair?.area} · level ${d.lair?.level} · ${d.lair?.room}`+(actor?` · HP ${actor.hp}/${actor.maxHp}`+(actor.fight?` · fighting, phase ${actor.fight.phase+1}${actor.fight.enraged?' (enraged)':''}`:'')+(actor.respawnAt?' · respawning':''):' · not placed'),{class:'console-muted'}));
   const a=form(det,'console-inline');
   btn(b.enabled?'Disable (plain monster)':'Enable',async()=>{await invoke('console_boss_enable',{id:b.id,enabled:!b.enabled});await load()},a);
   btn('Reset fight / revive',async()=>{await invoke('console_boss_reset_fight',{id:b.id});note(d.name+' reset.');await load()},a);
   btn('Teleport to the arena',async()=>{await invoke('console_boss_teleport',{id:b.id});note('Teleported beside '+d.name+'.')},a);
   btn('Kill counts',async()=>{const r=await invoke('console_boss_kills',{id:b.id});out.textContent=r.rows.length?r.rows.map(killRow).join('\n'):'No kills yet.'},a);
   btn('Reset all kill counts',async()=>{if(!globalThis.confirm?.('Reset every player’s kill count and personal best for '+d.name+'?'))return;const r=await invoke('console_boss_kills_reset',{id:b.id,all:true});note(r.rows+' rows reset.')},a);
   const out=el('pre',null,{class:'console-muted'});det.append(out);
   const f=form(det),v=bossFormValues(d),inputs={};
   for(const [k,label] of BOSS_NUMBERS)inputs[k]=field(f,label,'boss_'+b.id+'_'+k.replace('.','_'),v[k],'number');
   const ph=field(f,'Phases (JSON: at, name, pattern, onEnter, attackTicks, immune, immuneWhileAdds, text)','boss_'+b.id+'_phases',v.phases,'textarea');ph.rows=8;
   const at=field(f,'Attacks (JSON: kind strike|telegraph|charge|breath|summon|flight; style, maxHit, tell, shape, radius, count, element, add, color, text)','boss_'+b.id+'_attacks',v.attacks,'textarea');at.rows=12;
   const un=field(f,'Uniques and rarity (one per line: item 1/256)','boss_'+b.id+'_uniques',v.uniques,'textarea');un.rows=3;
   btn('Save '+d.name,async()=>{const vals={phases:ph.value,attacks:at.value,uniques:un.value};for(const [k,i] of Object.entries(inputs))vals[k]=i.value;
    const next=applyBossForm(d,vals);await invoke('console_boss_set',{id:b.id,data:next});
    if(JSON.stringify(next.uniques)!==JSON.stringify(d.uniques)){const m=await invoke('console_mech',{});const rule=(m.rules||[]).find(r=>r.kind==='drops'&&r.id===(d.roster||b.id));if(rule)await invoke('console_mech_rule_set',{kind:'drops',id:rule.id,data:lootWithUniques(rule.data,next.uniques,d.uniques)})}
    note(d.name+' saved.');await load()},f);
   // Loot table (mech_rules 'drops' keyed by the roster key).
   const lf=form(det);const loot=field(lf,'Loot table v2 (always / preroll / main / tertiary)','boss_'+b.id+'_loot','','textarea');loot.rows=8;
   btn('Load loot table',async()=>{const m=await invoke('console_mech',{});const rule=(m.rules||[]).find(r=>r.kind==='drops'&&r.id===(d.roster||b.id));loot.value=JSON.stringify(rule?.data||{},null,1)},lf);
   btn('Save loot table',async()=>{let data;try{data=JSON.parse(loot.value)}catch{throw Error('Loot table: not valid JSON')}await invoke('console_mech_rule_set',{kind:'drops',id:d.roster||b.id,data});note('Loot saved.')},lf);
   if(actor)btn('Simulate 10 000 kills',async()=>{const r=await invoke('console_mech_drops_test',{actor:actor.id,kills:10000});out.textContent='Main table over '+r.kills+' kills: '+Object.entries(r.main).sort((x,y)=>y[1]-x[1]).map(([k,n])=>k+' '+n).join(', ')},lf);
  }
  // ---- lairs
  const ld=el('details');ld.append(el('summary','Lairs (enable, quest gates, travel)'));body.append(ld);
  for(const l of state.lairs){const gates=[...(l.entrances||[]),...(l.links||[])].filter(x=>x.requires?.unlock);const row=el('div',null,{class:'console-subcard'});ld.append(row);
   row.append(el('strong',l.name+(l.enabled?'':' (closed)')),el('p',gates.map(g=>`${g.name||g.id}: ${g.requires.unlock} ${g.requires.gate?'· gated':'· open'}`).join(' · ')||'No quest gate.',{class:'console-muted'}));
   const a=form(row,'console-inline');
   btn(l.enabled?'Close lair':'Open lair',async()=>{await invoke('console_boss_lair',{area:l.id,enabled:!l.enabled});await load()},a);
   if(gates.length){const on=gates.some(g=>g.requires.gate);btn(on?'Open quest gate':'Require quest unlock',async()=>{await invoke('console_boss_lair',{area:l.id,gate:!on});note(l.name+(on?': gate opened.':': quest unlock required.'));await load()},a)}
   if(l.lair)btn('Teleport to the boss',async()=>{await invoke('console_boss_teleport',{id:l.lair});note('Teleported.')},a);
  }
  // ---- unique items
  const id=el('details');id.append(el('summary','Unique items (tradeable, shopless, disabled)'));body.append(id);
  for(const it of state.items){const row=el('div',null,{class:'console-inline'});id.append(row);row.append(el('span',`${it.name} (${it.id})${it.boss?' · '+it.boss:''}${it.quest?' · quest':''}`));
   btn(it.tradeable?'Make untradeable':'Make tradeable',async()=>{await invoke('console_boss_item',{id:it.id,tradeable:!it.tradeable});await load()},row);
   btn(it.shopless?'Allow in shops':'Keep out of shops',async()=>{await invoke('console_boss_item',{id:it.id,shopless:!it.shopless});await load()},row);
   btn(it.disabled?'Enable':'Disable',async()=>{await invoke('console_boss_item',{id:it.id,disabled:!it.disabled});await load()},row)}
  // ---- breath + fight settings
  const bd=el('details');bd.append(el('summary','Dragon breath and fight settings'));body.append(bd);const bf=form(bd),bi={};
  for(const [k,def] of Object.entries(BREATH_DEFAULTS))if(typeof def==='number'||typeof def==='boolean')bi[k]=field(bf,k,'boss_breath_'+k,c.breath?.[k]??def,typeof def==='boolean'?'checkbox':'number');
  btn('Save breath settings',async()=>{const vals={};for(const [k,i] of Object.entries(bi))vals[k]=i.type==='checkbox'?i.checked:i.value;await invoke('console_boss_settings',{config:{breath:breathPatch(vals)}});note('Breath saved.');await load()},bf);
  const ff=form(bd),fi={};for(const [k,v] of Object.entries(c.fight||{}))fi[k]=field(ff,k.replace(/_/g,' '),'boss_fight_'+k,v,typeof v==='boolean'?'checkbox':'number');
  btn('Save fight settings',async()=>{const vals={};for(const [k,i] of Object.entries(fi))vals[k]=i.type==='checkbox'?i.checked:Number(i.value);await invoke('console_boss_settings',{config:{fight:vals}});note('Fight settings saved.');await load()},ff);
  // ---- log
  const lg=el('details');lg.append(el('summary','Recent kills and rare drops'));body.append(lg);
  lg.append(el('pre',state.log.map(r=>`${String(r.at).slice(0,16)} ${r.kind==='rare'?'RARE':'kill'} ${r.boss} ${r.who||''} ${r.kind==='rare'?r.data.item:formatTicks(r.data.ticks)}`).join('\n')||'Nothing yet.',{class:'console-muted'}));
 }
 void load();
 return {reload:load};
}
