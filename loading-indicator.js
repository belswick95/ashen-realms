// One small "Loading…" chip for everything the player waits on (server requests
// the UI awaits, model/texture loads, reconnects), plus the full-screen boot
// progress shown while the world itself is not ready yet.
//
//  const job=loading.begin('Banking…');  …  job.end();      // ref-counted
//  await loading.track(promise,'Trading…');                  // ends in finally
//  loading.begin('Reconnecting…',{key:'reconnect'})          // keyed: re-begin refreshes, end by key
//
// The chip only appears after `delay` ms (default 300) so quick actions never
// flash it, hides the moment the last job ends, and every job has a safety
// timeout so a lost promise can never leave the chip on screen.
export const LOADING_DELAY_MS=300,LOADING_SAFETY_MS=20000;

export function createLoadingIndicator({doc=globalThis.document,delay=LOADING_DELAY_MS,safety=LOADING_SAFETY_MS,now=()=>Date.now(),setTimer=(fn,ms)=>setTimeout(fn,ms),clearTimer=id=>clearTimeout(id)}={}){
 const jobs=new Map();let seq=0,showTimer=null,visible=false,chip=null,labelNode=null,boot=null;
 const latest=()=>{let pick=null;for(const job of jobs.values())if(!pick||job.priority>pick.priority||job.priority===pick.priority&&job.order>pick.order)pick=job;return pick};
 function ensureChip(){
  if(chip||!doc?.body)return chip;
  chip=doc.createElement('div');chip.id='loading-chip';chip.setAttribute('role','status');chip.setAttribute('aria-live','polite');chip.hidden=true;
  chip.innerHTML='<span class="loading-chip-spinner" aria-hidden="true"></span><span class="loading-chip-label">Loading…</span>';
  labelNode=chip.querySelector('.loading-chip-label');doc.body.append(chip);return chip;
 }
 function render(){
  const job=latest();
  if(!job){if(showTimer!==null){clearTimer(showTimer);showTimer=null}visible=false;if(chip){chip.hidden=true;chip.removeAttribute('data-kind')}doc?.body?.classList?.remove('loading-chip-visible');return}
  if(ensureChip()){if(labelNode.textContent!==job.label)labelNode.textContent=job.label;chip.dataset.kind=job.kind||'work'}
  const due=Math.min(...[...jobs.values()].map(j=>j.showAt));
  if(due<=now()){if(showTimer!==null){clearTimer(showTimer);showTimer=null}visible=true;if(chip)chip.hidden=false;doc?.body?.classList?.add('loading-chip-visible')}
  else if(showTimer===null)showTimer=setTimer(()=>{showTimer=null;render()},Math.max(0,due-now()));
 }
 function finish(id){const job=jobs.get(id);if(!job)return;clearTimer(job.safetyTimer);jobs.delete(id);render()}
 function begin(label='Loading…',{key=null,delay:wait=delay,timeout=safety,priority=0,kind}={}){
  const id=key??Symbol(label);const old=jobs.get(id);if(old)clearTimer(old.safetyTimer);
  const job={label:String(label||'Loading…'),order:++seq,priority,kind,showAt:Math.min(old?old.showAt:Infinity,now()+Math.max(0,wait)),safetyTimer:null};
  if(timeout>0&&Number.isFinite(timeout))job.safetyTimer=setTimer(()=>{if(jobs.get(id)===job)finish(id)},timeout);
  jobs.set(id,job);render();
  let done=false;
  return {get active(){return !done&&jobs.get(id)===job},update(text){if(!done&&jobs.get(id)===job){job.label=String(text);render()}},end(){if(done)return;done=true;if(jobs.get(id)===job)finish(id)}};
 }
 function end(key){finish(key)}
 // Wraps a promise (or a function returning one); the job ends however it settles.
 function track(work,label,options){const job=begin(label,options);let result;try{result=typeof work==='function'?work():work}catch(error){job.end();throw error}return Promise.resolve(result).finally(()=>job.end())}
 // Full-screen boot progress: only while the world is not ready to play.
 function ensureBoot(){
  if(boot||!doc?.body)return boot;
  const root=doc.createElement('div');root.id='world-boot';root.setAttribute('role','status');root.setAttribute('aria-live','polite');root.hidden=true;
  root.innerHTML='<section><div class="world-boot-crest" aria-hidden="true">ELDERVALE</div><div class="loading-chip-spinner" aria-hidden="true"></div><strong class="world-boot-label">Entering Eldervale…</strong><div class="world-boot-track" aria-hidden="true"><div class="world-boot-fill"></div></div><small class="world-boot-detail"></small></section>';
  doc.body.append(root);boot={root,label:root.querySelector('.world-boot-label'),fill:root.querySelector('.world-boot-fill'),detail:root.querySelector('.world-boot-detail'),fraction:0};return boot;
 }
 // fraction never moves backwards, so the bar always reads as progress.
 // `until` lets a long single step (a big module download) creep slowly toward
 // the next milestone instead of sitting still.
 let creep=null;
 const paint=b=>{b.fill.style.width=(b.fraction*100).toFixed(1)+'%'};
 function bootProgress(label,fraction,detail='',until=null){
  const b=ensureBoot();if(!b)return;b.root.hidden=false;doc.body.classList.add('world-booting');
  if(label)b.label.textContent=label;b.detail.textContent=detail||'';
  if(Number.isFinite(fraction)){b.fraction=Math.max(b.fraction,Math.min(1,Math.max(0,fraction)));paint(b)}
  if(creep!==null){clearTimer(creep);creep=null}
  if(Number.isFinite(until)&&until>b.fraction){const step=()=>{creep=null;if(b.root.hidden)return;b.fraction+=(until-b.fraction)*.06;paint(b);creep=setTimer(step,400)};creep=setTimer(step,400)}
 }
 function bootDone(){if(creep!==null){clearTimer(creep);creep=null}if(!boot)return;boot.root.hidden=true;boot.fraction=0;paint(boot);doc.body.classList.remove('world-booting')}
 return {begin,end,track,bootProgress,bootDone,get count(){return jobs.size},get visible(){return visible},get label(){return latest()?.label||''},get booting(){return !!boot&&!boot.root.hidden}};
}

// The game's single shared indicator (also reachable as window.eldervaleLoading).
export const loading=globalThis.eldervaleLoading??=createLoadingIndicator();

// THREE.LoadingManager hook: textures/models fetched through three's loaders.
export function trackLoadingManager(manager,indicator=loading,label='Loading models…'){
 if(!manager||manager.eldervaleTracked)return;manager.eldervaleTracked=true;let job=null;
 const start=manager.onStart,done=manager.onLoad,error=manager.onError;
 manager.onStart=(...a)=>{job??=indicator.begin(label,{kind:'assets'});start?.(...a)};
 manager.onLoad=(...a)=>{job?.end();job=null;done?.(...a)};
 manager.onError=(...a)=>{error?.(...a);if(manager.itemsLoaded>=manager.itemsTotal){job?.end();job=null}};
}

// Server commands that the player is not visibly waiting on (movement, cosmetics).
const QUIET=new Set(['move','stop','jump','run','steer','sync','celebrate','preview','attack_style']);
const LABELS=[[/^bank/,'Banking…'],[/^trade/,'Trading…'],[/^(buy|sell|shop)/,'Trading…'],[/^equip|unequip/,'Equipping…'],[/^quest|tutorial/,'Updating quest…'],[/^(stairs|enter|exit|door|travel|cart|teleport|respawn)/,'Travelling…'],[/^(drop|pickup)/,'Updating inventory…']];
export function commandLabel(command){const c=String(command||'');if(QUIET.has(c))return null;for(const [re,label] of LABELS)if(re.test(c))return label;return 'Working…'}
