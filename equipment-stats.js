// "Equipment stats" panel, like OSRS's equipment screen: the summed attack and
// defence bonuses of everything worn, the other bonuses, and what they mean in a
// fight (max hit, accuracy, attack speed, ammunition).
import {BONUS_LABELS,playerAttackProfile,playerDefenceRoll,styleLabels,tierById,ARROWS,attackPeriod,TICK_SECONDS} from './gear-tiers.js?v=release-20261107-invorder151';
import {equipmentBonuses,playerLevels,gearFor,equipRefusal} from './melee-stats.js?v=release-20261107-invorder151';
import {bonusSummary,requirementText,speedLabel} from './gear-tiers.js?v=release-20261107-invorder151';
import {weaponCatalog} from './weapons.js?v=release-20261107-invorder151';
const signed=v=>(v>=0?'+':'')+v;
// The numbers shown in the panel (also used by tests).
export function equipmentStats(state,style='slash'){
 const weapon=weaponCatalog[state.equippedWeapon]||null,b=equipmentBonuses(state),levels=playerLevels(state);
 const profile=playerAttackProfile({levels,bonuses:b,weapon,style});
 const period=attackPeriod(weapon||{speed:4*TICK_SECONDS},style);
 return {bonuses:b,levels,profile,weapon,arrow:b.arrow,arrowCount:b.arrow?Number(state[b.arrow])||0:0,
  speedTicks:Math.round(period/TICK_SECONDS),speedSeconds:+period.toFixed(2),
  defence:{stab:playerDefenceRoll({levels,bonuses:b,style,type:'stab'}),slash:playerDefenceRoll({levels,bonuses:b,style,type:'slash'}),crush:playerDefenceRoll({levels,bonuses:b,style,type:'crush'}),magic:playerDefenceRoll({levels,bonuses:b,style,type:'magic'}),ranged:playerDefenceRoll({levels,bonuses:b,style,type:'ranged'})}};
}
export function renderEquipmentStats(doc,state,{style='slash',goods={}}={}){
 const s=equipmentStats(state,style),root=doc.createElement('section');root.className='equipment-stats';root.setAttribute('aria-label','Equipment stats');
 const h=doc.createElement('h3');h.textContent='Equipment stats';root.append(h);
 for(const [title,rows] of BONUS_LABELS){const box=doc.createElement('div');box.className='equipment-stats-group';const t=doc.createElement('h4');t.textContent=title;box.append(t);const dl=doc.createElement('dl');
  for(const [key,label] of rows){const dt=doc.createElement('dt'),dd=doc.createElement('dd'),v=s.bonuses[key]||0;dt.textContent=label;dd.textContent=key==='mdmg'?signed(v)+'%':signed(v);dd.dataset.sign=v>0?'plus':v<0?'minus':'zero';dd.dataset.bonus=key;dl.append(dt,dd)}
  box.append(dl);root.append(box)}
 const fight=doc.createElement('div');fight.className='equipment-stats-group equipment-stats-combat';const ft=doc.createElement('h4');ft.textContent='In combat';fight.append(ft);const dl=doc.createElement('dl');
 const labels=styleLabels(s.weapon),row=(label,value,title)=>{const dt=doc.createElement('dt'),dd=doc.createElement('dd');dt.textContent=label;dd.textContent=value;if(title)dd.title=title;dl.append(dt,dd)};
 row('Style',labels[style]?.[0]||style,labels[style]?.[1]);
 row('Max hit',String(s.profile.maxHit),'OSRS max hit '+s.profile.osrsMaxHit+' × '+10+' (Eldervale health is ten times OSRS).');
 row('Accuracy roll',s.profile.attackRoll.toLocaleString(),'Effective level '+s.profile.effAccuracy+' × (bonus + 64), '+s.profile.type);
 row('Attack speed',s.speedTicks+' ticks · '+s.speedSeconds+'s');
 if(s.weapon?.ranged&&!s.weapon?.magic)row('Ammunition',s.arrow?(goods[s.arrow]?.name||s.arrow)+' ×'+s.arrowCount+' (+'+ARROWS[s.arrow].rstr+')':'None — up to '+tierById[s.weapon.arrowCap||'iron'].name.toLowerCase()+' arrows');
 fight.append(dl);root.append(fight);
 return root;
}

// Hover card for equipment (inventory and worn slots): name in the tier colour,
// the level requirement (red while unmet, like OSRS), bonuses and speed.
export function installGearTooltip(doc,getState){
 const tip=doc.createElement('div');tip.className='gear-tooltip';tip.hidden=true;tip.setAttribute('role','tooltip');doc.body.append(tip);
 const show=(el,x,y)=>{const id=el.dataset.gearTip,item=gearFor(id);if(!item){tip.hidden=true;return}const state=getState(),refusal=equipRefusal(state,id);tip.replaceChildren();
  const name=doc.createElement('strong');name.textContent=item.name;if(item.tier&&tierById[item.tier])name.style.color='#'+tierById[item.tier].color.toString(16).padStart(6,'0');
  const req=doc.createElement('div');req.className='gear-tooltip-req';req.dataset.met=String(!refusal);const text=requirementText(item.req);req.textContent=text?'Requires '+text:'No level requirement';
  const bon=doc.createElement('div');bon.className='gear-tooltip-bonuses';bon.textContent=bonusSummary(item.bonuses)||'No bonuses';tip.append(name,req,bon);
  if(item.ticks){const sp=doc.createElement('div');sp.textContent='Attack speed '+speedLabel(item);tip.append(sp)}
  tip.hidden=false;const r=tip.getBoundingClientRect(),vw=doc.documentElement.clientWidth,vh=doc.documentElement.clientHeight;tip.style.left=Math.max(4,Math.min(vw-r.width-4,x+14))+'px';tip.style.top=Math.max(4,Math.min(vh-r.height-4,y+14))+'px'};
 doc.addEventListener('pointerover',e=>{const el=e.target.closest?.('[data-gear-tip]');if(el&&e.pointerType!=='touch')show(el,e.clientX,e.clientY);else if(!el)tip.hidden=true});
 doc.addEventListener('pointermove',e=>{if(!tip.hidden){const el=e.target.closest?.('[data-gear-tip]');if(el)show(el,e.clientX,e.clientY);else tip.hidden=true}});
 doc.addEventListener('pointerdown',()=>{tip.hidden=true});
 return {show,element:tip};
}
