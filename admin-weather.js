// Owner console › Game › Weather: current weather per region, force weather per region or
// everywhere for a while, schedule weights per region, turn weather off, change how often it
// changes, preview any weather on this screen only, and a forecast of the coming slots.
// Reads and writes go through world_admin -> admin_action (weather_* commands, owner-checked and
// audited on the server: db/weather.sql). The schedule itself is shared with weather.js.
import {WEATHER_KINDS,WEATHER_LABELS,WEATHER_REGIONS,DEFAULT_WEIGHTS,WEATHER_LIMITS,regionWeather,weatherLabel} from './weather.js?v=release-20261106-shield120';

// Percent share of each kind for one region's weights (rounded; all zero -> clear 100).
export function weightShares(weights={}){const total=WEATHER_KINDS.reduce((s,k)=>s+(Number(weights[k])||0),0);if(!total)return {clear:100};return Object.fromEntries(WEATHER_KINDS.filter(k=>weights[k]>0).map(k=>[k,Math.round(weights[k]/total*100)]))}
// Weights table read from the form: {region:{kind:int}}; throws with a readable message.
export function readWeights(values){const out={};for(const r of WEATHER_REGIONS){out[r.id]={};for(const k of WEATHER_KINDS){const raw=values?.[r.id]?.[k],n=raw===''||raw==null?0:Number(raw);if(!Number.isFinite(n)||n<0||n>100)throw Error(r.name+': '+WEATHER_LABELS[k]+' must be 0–100');out[r.id][k]=Math.round(n)}}return out}
export function scheduleForm({enabled,seed,slotMinutes,fadeSeconds}){const n=(v,[lo,hi],label,whole=false)=>{const x=Number(v);if(v===''||!Number.isFinite(x)||x<lo||x>hi||whole&&x!==Math.round(x))throw Error(label+' must be '+lo+'–'+hi);return x};
 return {enabled:!!enabled,seed:n(seed,WEATHER_LIMITS.seed,'Seed',true),slotMinutes:n(slotMinutes,WEATHER_LIMITS.slotMinutes,'Change every (minutes)'),fadeSeconds:n(fadeSeconds,WEATHER_LIMITS.fadeSeconds,'Fade (seconds)')}}
export function forceForm({region,kind,intensity,minutes}){if(!WEATHER_KINDS.includes(kind))throw Error('Choose a weather kind');if(region!=='all'&&!WEATHER_REGIONS.some(r=>r.id===region))throw Error('Choose a region');
 const i=Number(intensity)/100,m=Number(minutes);if(!(i>=.1&&i<=1))throw Error('Intensity must be 10–100%');if(!(m>=1&&m<=1440))throw Error('Duration must be 1–1440 minutes');return {region,kind,intensity:+i.toFixed(2),minutes:Math.round(m)}}
// One line per region for the "Weather now" table.
export function regionNow(pub,region,ms){const s=regionWeather(pub,region,ms),r=pub?.regions?.[region];if(!pub?.on)return {now:'Off (clear)',next:'—',forced:''};
 const label=k=>WEATHER_LABELS[k]||k;const fading=!s.forced&&s.mix<1?' (from '+label(s.from.kind).toLowerCase()+')':'';
 const changes=pub.start+pub.slot*1000;return {now:label(s.kind)+' · '+Math.round(s.intensity*100)+'%'+fading,next:r?label(r.nk)+' at '+clock(changes):'—',forced:s.forced?'Forced until '+clock(s.until):''}}
const clock=ms=>new Date(ms).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'});

export function createWeatherTab(ctx){
 const {el,btn,field,invoke,note}=ctx;const W=()=>ctx.workspace,read=(command,payload={})=>ctx.rpc('world_admin',{command,payload});
 const section=(title,parent)=>{const s=el('section',null,{class:'console-card'});s.append(el('h3',title));parent.append(s);return s};
 const actions=parent=>{const a=el('div',null,{class:'studio-actions'});parent.append(a);return a};
 const regionOptions=[['all','All regions'],...WEATHER_REGIONS.map(r=>[r.id,r.name])],kindOptions=WEATHER_KINDS.map(k=>[k,WEATHER_LABELS[k]]);
 let data=null,form={region:'all',kind:'rain',intensity:80,minutes:30},look={kind:'storm',intensity:85};
 // The owner's own client takes the server's answer at once; players follow on their next sync.
 const adopt=r=>{if(r?.now&&window.eldervaleGameConfig)window.eldervaleGameConfig={...window.eldervaleGameConfig,weather:r.now};if(r?.settings&&data)data={...data,...r,stored:r.stored}};
 async function load(){data=await read('weather_get',{slots:6});return data}
 function Weather(){
  const box=el('div',null,{class:'console-columns weather-console'});W().append(box);const wait=el('p','Loading weather…',{class:'console-muted'});box.append(wait);
  void load().then(()=>{if(ctx.tab()!=='Weather')return;wait.remove();draw(box)}).catch(e=>{wait.textContent='Weather unavailable: '+e.message+' (apply db/weather.sql)'});
 }
 function draw(box){
  box.replaceChildren();const cfg=data.settings,pub=data.now,ms=window.eldervaleServerTime?.()||Date.now(),me=window.eldervaleWeather?.state;
  // Now
  const now=section('Weather now',box);now.append(el('p',pub.on?'Changes every '+cfg.slotMinutes+' min with a '+cfg.fadeSeconds+' s fade. Everyone sees the same weather.':'Weather is turned off: every region stays clear.',{class:'console-muted'}));
  const table=el('table',null,{class:'weather-table'}),head=el('tr');for(const h of ['Region','Now','Next','Override'])head.append(el('th',h));table.append(head);
  for(const r of WEATHER_REGIONS){const row=el('tr'),info=regionNow(pub,r.id,ms);row.append(el('td',r.name),el('td',info.now),el('td',info.next),el('td',info.forced||'—'));const cell=row.lastChild;if(info.forced)btn('Clear',()=>clear(r.id),cell);table.append(row)}
  now.append(table);if(me)now.append(el('p','You are in '+(WEATHER_REGIONS.find(r=>r.id===me.region)?.name||me.region)+': '+(me.label||'clear')+(me.indoors?' (indoors)':'')+(me.underground?' (underground: no weather)':'')+(window.eldervaleWeather?.previewing?' · previewing '+WEATHER_LABELS[window.eldervaleWeather.previewing.kind]:''),{class:'console-muted'}));
  const na=actions(now);btn('Refresh',async()=>{await load();draw(box)},na);
  // Force
  const force=section('Force weather',box),ff=el('div',null,{class:'console-form-grid'});force.append(el('p','Overrides the schedule for every player in the region(s), then fades back.',{class:'console-muted'}),ff);
  const fr=field(ff,'Region','region',form.region,'text',regionOptions),fk=field(ff,'Weather','kind',form.kind,'text',kindOptions),fi=field(ff,'Intensity (10–100%)','intensity',form.intensity,'number'),fm=field(ff,'For (minutes)','minutes',form.minutes,'number');
  fi.min=10;fi.max=100;fi.step=5;fm.min=1;fm.max=1440;
  const fa=actions(force);for(const [label,m] of [['15 min',15],['1 hour',60],['6 hours',360]])btn(label,()=>{fm.value=m},fa);
  const fb=actions(force);fb.classList.add('console-primary-actions');
  btn('Force now',async()=>{form={region:fr.value,kind:fk.value,intensity:Number(fi.value),minutes:Number(fm.value)};const p=forceForm(form);const r=await invoke('weather_force',p);adopt(r);note(WEATHER_LABELS[p.kind]+' forced in '+(p.region==='all'?'every region':WEATHER_REGIONS.find(x=>x.id===p.region).name)+' for '+p.minutes+' min.');await load();draw(box)},fb);
  btn('Clear override',()=>clear(fr.value),fb);
  // Preview (this screen only)
  const prev=section('Preview on this screen',box),pf=el('div',null,{class:'console-form-grid'});prev.append(el('p','Shows a weather here only, without saving: check the look and sounds before forcing it.',{class:'console-muted'}),pf);
  const pk=field(pf,'Weather','preview-kind',look.kind,'text',kindOptions),pi=field(pf,'Intensity (10–100%)','preview-intensity',look.intensity,'number');pi.min=10;pi.max=100;pi.step=5;
  const pa=actions(prev);btn('Preview',()=>{look={kind:pk.value,intensity:Number(pi.value)};if(!window.eldervaleWeather)throw Error('Weather effects are not running in this window');window.eldervaleWeather.preview({kind:look.kind,intensity:look.intensity/100});note('Previewing '+WEATHER_LABELS[look.kind]+' on this screen only.')},pa);
  btn('Stop preview',()=>{window.eldervaleWeather?.preview(null);note('Back to the live weather.')},pa);
  btn('Lightning strike',()=>{window.eldervaleWeather?.flashTest();note('A strike nearby (this screen only).')},pa);
  // Schedule
  const sched=section('Schedule',box),sf=el('div',null,{class:'console-form-grid'});sched.append(sf);
  const on=field(sf,'Weather on','enabled',cfg.enabled,'checkbox'),seed=field(sf,'Seed (reshuffles every forecast)','seed',cfg.seed,'number'),slot=field(sf,'Change every (5–240 min)','slotMinutes',cfg.slotMinutes,'number'),fade=field(sf,'Fade (10–600 s)','fadeSeconds',cfg.fadeSeconds,'number');
  const sa=actions(sched);sa.classList.add('console-primary-actions');btn('Save schedule',async()=>{const p=scheduleForm({enabled:on.checked,seed:seed.value,slotMinutes:slot.value,fadeSeconds:fade.value});const r=await invoke('weather_save',p);adopt(r);note(p.enabled?'Weather schedule saved.':'Weather turned off for everyone.');await load();draw(box)},sa);
  btn('New seed',()=>{seed.value=String(Math.floor(Math.random()*2147483647))},sa);
  // Weights
  const wsec=section('Weights per region',box);wsec.append(el('p','How often each weather is picked in a region (relative, 0–100). 0 never happens there.',{class:'console-muted'}));
  const grid=el('table',null,{class:'weather-table weather-weights'}),wh=el('tr');wh.append(el('th','Region'));for(const k of WEATHER_KINDS)wh.append(el('th',WEATHER_LABELS[k]));grid.append(wh);const inputs={};
  for(const r of WEATHER_REGIONS){const row=el('tr');row.append(el('td',r.name));inputs[r.id]={};for(const k of WEATHER_KINDS){const td=el('td'),i=el('input',null,{type:'number',min:'0',max:'100',step:'1','aria-label':r.name+' '+WEATHER_LABELS[k]});i.value=cfg.weights[r.id]?.[k]??0;i.oninput=paint;inputs[r.id][k]=i;td.append(i);row.append(td)}const share=el('td',null,{class:'console-muted'});row.append(share);inputs[r.id]._share=share;grid.append(row)}
  const scroll=el('div',null,{class:'weather-scroll'});scroll.append(grid);wsec.append(scroll);
  function values(){return Object.fromEntries(WEATHER_REGIONS.map(r=>[r.id,Object.fromEntries(WEATHER_KINDS.map(k=>[k,inputs[r.id][k].value]))]))}
  function paint(){let w;try{w=readWeights(values())}catch{return}for(const r of WEATHER_REGIONS)inputs[r.id]._share.textContent=Object.entries(weightShares(w[r.id])).map(([k,p])=>WEATHER_LABELS[k]+' '+p+'%').join(' · ')}paint();
  const wa=actions(wsec);wa.classList.add('console-primary-actions');btn('Save weights',async()=>{const r=await invoke('weather_save',{weights:readWeights(values())});adopt(r);note('Weights saved: the forecast from the next change follows them.');await load();draw(box)},wa);
  btn('Reset to defaults',()=>{for(const r of WEATHER_REGIONS)for(const k of WEATHER_KINDS)inputs[r.id][k].value=DEFAULT_WEIGHTS[r.id][k];paint()},wa);
  // Forecast
  const fc=section('Forecast',box),ft=el('table',null,{class:'weather-table'}),fh=el('tr');fh.append(el('th','Region'));const first=Object.values(data.forecast||{})[0]||[];for(const s of first)fh.append(el('th',clock(s.start)));ft.append(fh);
  for(const r of WEATHER_REGIONS){const row=el('tr');row.append(el('td',r.name));for(const s of data.forecast?.[r.id]||[])row.append(el('td',s.k==='clear'?'Clear':weatherLabel(s.k,s.i)));ft.append(row)}
  const fs=el('div',null,{class:'weather-scroll'});fs.append(ft);fc.append(el('p','Scheduled weather (overrides not included).',{class:'console-muted'}),fs);
 }
 async function clear(region){const r=await invoke('weather_clear',{region});adopt(r);note(region==='all'?'All overrides cleared.':'Override cleared.');await load();if(ctx.tab()==='Weather')ctx.redraw()}
 return {Weather};
}
