// HUD for combat & mechanics II: the Prayer tab (toggles + quick-prayer setup), prayer and special
// attack orbs beside the run orb, the run orb's energy ring and carried weight, the poison/venom
// tint on the health bar, and drinking potions. State comes from the server's per-request
// `mechanics` block (db/mechanics-ii-3-hooks.sql mech_reply); commands are mech_*.
import {PRAYERS,formatWeight} from './mechanics.js?v=release-20261107-monsters135';

const h=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
export function prayerRows(list,{level=1,active=[],quick=[]}={}){
 return list.map(p=>({...p,locked:level<p.level,on:active.includes(p.id),quick:quick.includes(p.id)}));
}
export const specPercent=energy=>Math.floor((Number(energy)||0)/10);
export function createMechanicsHud({command=(n,p)=>window.eldervaleRealm?.command(n,p),lastError=()=>window.eldervaleRealm?.lastError||'',say=t=>console.info(t),doc=globalThis.document}={}){
 if(!doc)return {sync(){},drink(){return false},altar(){}};
 if(!doc.querySelector('link[data-mechanics-css]')){const css=doc.createElement('link');css.rel='stylesheet';css.href='./mechanics.css?v=release-20261107-monsters135';css.dataset.mechanicsCss='1';doc.head.append(css)}
 let mech=null,prayers=PRAYERS,catalogAsked=false,editingQuick=false,quickDraft=[],busy=false,lastSig='';
 const host=doc.querySelector('#prayer-tab');
 const controls=doc.querySelector('#map-controls');
 const prayerOrb=h('button','mech-orb mech-prayer-orb');prayerOrb.type='button';prayerOrb.id='prayer-orb';prayerOrb.innerHTML='<span class="mech-orb-icon" aria-hidden="true">✦</span><span class="mech-orb-value">–</span>';
 const specOrb=h('button','mech-orb mech-spec-orb');specOrb.type='button';specOrb.id='spec-orb';specOrb.innerHTML='<span class="mech-orb-icon" aria-hidden="true">⚡</span><span class="mech-orb-value">100</span>';
 prayerOrb.hidden=specOrb.hidden=true;
 // The orbs get their own row under the minimap buttons: inside #map-controls the fixed-width button
 // rules made the row wider than the widget, pushing the spec orb off-screen and, on phones, widening
 // the layout viewport so the whole HUD zoomed out and the tab bar was clipped.
 const orbRow=h('div','mech-orb-row');orbRow.id='mech-orbs';orbRow.append(prayerOrb,specOrb);
 if(controls)controls.after(orbRow);
 const weightLine=h('p','mech-weight');weightLine.hidden=true;doc.querySelector('#side')?.append(weightLine);
 async function send(name,payload={}){if(busy)return false;busy=true;try{const ok=await command(name,payload);if(ok===false&&lastError())say(lastError());return ok}catch(e){say(e?.message||String(e));return false}finally{busy=false}}
 prayerOrb.onclick=()=>{if(editingQuick)return;void send('mech_quick')};
 prayerOrb.oncontextmenu=e=>{e.preventDefault();doc.querySelector('#side [data-tab=prayer]')?.click()};
 specOrb.onclick=()=>{if(!mech?.spec?.name){say('This weapon has no special attack.');return}void send('mech_spec')};
 function drawTab(){
  if(!host||!mech?.enabled)return;
  const level=mech.prayer?.max||1,rows=prayerRows(prayers,{level,active:mech.prayer?.active||[],quick:editingQuick?quickDraft:(mech.prayer?.quick||[])});
  const sig=JSON.stringify([rows.map(r=>[r.id,r.locked,r.on,r.quick]),mech.prayer?.points,editingQuick]);if(sig===lastSig)return;lastSig=sig;
  const head=h('header','mech-prayer-head');head.append(h('h3',null,'Prayer'),h('strong','mech-prayer-points',(mech.prayer?.points??0)+' / '+level));
  const bar=h('div','mech-prayer-bar');const fill=h('span');fill.style.width=Math.max(0,Math.min(100,100*(mech.prayer?.points||0)/Math.max(1,level)))+'%';bar.append(fill);
  const grid=h('div','mech-prayer-grid');
  for(const p of rows){const b=h('button','mech-prayer'+(p.on?' on':'')+(p.locked?' locked':'')+(p.quick?' quick':''));b.type='button';b.title=p.name+' (level '+p.level+', drain '+p.drain+'): '+(p.text||'');b.setAttribute('aria-pressed',String(editingQuick?p.quick:p.on));b.setAttribute('aria-label',p.name+(p.locked?' — needs Prayer '+p.level:''));
   b.append(h('span','mech-prayer-icon',p.icon||'✦'),h('span','mech-prayer-name',p.name),h('small',null,p.locked?'Lv '+p.level:''));
   b.onclick=()=>{if(editingQuick){quickDraft=quickDraft.includes(p.id)?quickDraft.filter(x=>x!==p.id):[...quickDraft,p.id];drawTab();return}if(p.locked){say('You need Prayer level '+p.level+' for '+p.name+'.');return}void send('mech_prayer',{id:p.id})};
   grid.append(b)}
  const foot=h('div','mech-prayer-actions');
  const quick=h('button',null,editingQuick?'Save quick prayers':'Set quick prayers');quick.type='button';quick.onclick=async()=>{if(editingQuick){editingQuick=false;await send('mech_quick_set',{ids:quickDraft});lastSig='';drawTab()}else{editingQuick=true;quickDraft=[...(mech.prayer?.quick||[])];drawTab()}};
  const off=h('button',null,'All off');off.type='button';off.onclick=()=>void send('mech_prayers_off');
  foot.append(quick,off);
  host.replaceChildren(head,bar,h('p','mech-hint',editingQuick?'Choose the prayers the prayer orb switches on.':'Recharge at an altar. Ward prayers block creature attacks of their style.'),grid,foot);
 }
 function drawOrbs(data){
  const on=!!mech?.enabled;prayerOrb.hidden=specOrb.hidden=!on;doc.body?.classList.toggle('mech-on',on);
  if(!on)return;
  const pts=mech.prayer?.points??0,max=Math.max(1,mech.prayer?.max||1),active=(mech.prayer?.active||[]).length>0;
  prayerOrb.querySelector('.mech-orb-value').textContent=pts;prayerOrb.style.setProperty('--fill',(100*pts/max).toFixed(1)+'%');prayerOrb.classList.toggle('active',active);
  prayerOrb.title='Prayer '+pts+'/'+max+' · click: quick prayers'+(active?' (on)':'')+' · right-click: Prayer tab';prayerOrb.setAttribute('aria-label',prayerOrb.title);
  const sp=specPercent(mech.spec?.energy);specOrb.querySelector('.mech-orb-value').textContent=sp;specOrb.style.setProperty('--fill',sp+'%');specOrb.classList.toggle('active',!!mech.spec?.armed);specOrb.classList.toggle('none',!mech.spec?.name);
  specOrb.title=mech.spec?.name?'Special attack: '+mech.spec.name+' ('+mech.spec.cost+'%) · '+sp+'% energy'+(mech.spec.armed?' · ready':''):'Special energy '+sp+'% · this weapon has no special attack';specOrb.setAttribute('aria-label',specOrb.title);
  const run=doc.querySelector('#run-toggle'),energy=Number(data?.motion?.energy);
  if(run&&Number.isFinite(energy)){run.style.setProperty('--energy',energy.toFixed(1)+'%');run.classList.add('mech-energy');const w=formatWeight(mech.weight);if(!run.title.includes('Weight'))run.title=run.title+' · Weight '+w;else run.title=run.title.replace(/Weight [-\d.]+ kg/,'Weight '+w)}
  const hp=doc.querySelector('#health-hud');if(hp){hp.classList.toggle('poisoned',(mech.poison?.severity||0)>0);hp.classList.toggle('venomed',(mech.poison?.venom||0)>0)}
  const inv=doc.querySelector('#inventory'),eq=doc.querySelector('#equipment');weightLine.hidden=!((inv&&!inv.hidden)||(eq&&!eq.hidden));weightLine.textContent='Weight: '+formatWeight(mech.weight)+(mech.multi?' · Multi-combat area':'');
  doc.body?.classList.toggle('mech-multi',!!mech.multi);
 }
 return {
  get state(){return mech},
  sync(next,data){
   if(next)mech=next;else if(!mech)return;
   if(next?.catalog?.prayers?.length){prayers=next.catalog.prayers;lastSig=''}
   if(mech.enabled&&!catalogAsked){catalogAsked=true;void Promise.resolve(command('mech_catalog',{})).catch(()=>{})}
   drawOrbs(data);drawTab();
  },
  drink(item){if(!mech?.enabled)return false;void send('mech_drink',{item});return true},
  altar(target){if(mech?.enabled)void send('mech_altar',{target})}
 };
}
