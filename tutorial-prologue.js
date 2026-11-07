// Arrival prologue for brand-new characters. auth.js starts it the moment the server confirms a
// trainee who has not seen the arrival cutscene, before game.js and the world begin to load, so
// the opening appears within a second of "Begin adventure" instead of after the world streams in.
// It is plain DOM (no Three.js, no world data): a dawn silhouette of the castle, the title card and
// a few narrated lines, then it holds on "The gates draw near…" until the in-engine arrival
// cutscene (tutorial.js) takes over from a black frame. It never blocks loading.
import {needsCutscene} from './tutorial-logic.js?v=release-20261107-combatsfx130';

export const PROLOGUE_LINES=[
 'A summons rode out from the capital, carried to every village and crossroads.',
 'The King seeks capable hands. You answered.',
 'Within the castle walls, every adventurer learns before the Great Gate opens.'];
export const PROLOGUE_TITLE={title:'Eldervale Castle',subtitle:'Seat of King Oswin the Steadfast'};
// A trainee whose save still waits for the arrival scene.
export const wantsPrologue=row=>needsCutscene(row?.game_flags?.tutorial);

const wait=ms=>new Promise(r=>setTimeout(r,ms));
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
const SKYLINE='<svg class="tutorial-prologue-skyline" viewBox="0 0 1200 300" preserveAspectRatio="xMidYMax slice" aria-hidden="true"><defs><linearGradient id="pro-sky" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#1a1f33"/><stop offset=".55" stop-color="#5b3b45"/><stop offset="1" stop-color="#c9875a"/></linearGradient></defs><rect width="1200" height="300" fill="url(#pro-sky)"/><circle cx="905" cy="236" r="38" fill="#f4c27a" opacity=".85"/><path d="M0 300V250l90-18 110 10 120-22 140 16 80-8V300z" fill="#2a2329"/><path d="M380 300V196h22v-16h14v16h20v-16h14v16h22V150h-6v-12h12v-12h10v12h12v12h-6v36h26v-34h-8v-14h10v-12h8v12h10v-12h8v12h10v14h-8v34h70v-34h-8v-14h10v-12h8v12h10v-12h8v12h10v14h-8v34h26V150h-6v-12h12v-12h10v12h12v12h-6v46h22v-16h14v16h20v-16h14v16h22V300z" fill="#120e14"/><path d="M590 300v-46a20 20 0 0 1 40 0v46z" fill="#0a080c"/><path d="M800 300V262l120-14 140 12 140-20V300z" fill="#1d181e"/></svg>';

export function startPrologue({lines=PROLOGUE_LINES,title=PROLOGUE_TITLE,linger=2600}={}){
 if(typeof document==='undefined')return null;
 if(!document.querySelector('link[href^="./tutorial.css"]'))document.head.append(Object.assign(document.createElement('link'),{rel:'stylesheet',href:'./tutorial.css?v=release-20261107-combatsfx130'}));
 const root=el('section','tutorial-prologue');root.setAttribute('role','dialog');root.setAttribute('aria-label','Arrival');
 const art=el('div','tutorial-prologue-art');art.innerHTML=SKYLINE;
 const caption=el('div','tutorial-caption'),narration=el('p','tutorial-prologue-line'),holdLine=el('p','tutorial-prologue-hold'),skip=el('button','tutorial-skip','Skip ▸▸');skip.type='button';
 narration.setAttribute('aria-live','polite');caption.append(el('strong',null,title.title),el('span',null,title.subtitle));
 root.append(art,el('i','bar top'),el('i','bar bottom'),caption,narration,holdLine,skip);document.body.append(root);
 globalThis.performance?.mark?.('eldervale-prologue-visible');
 requestAnimationFrame(()=>root.classList.add('show'));
 let skipped=false,hurry=false,finished=false,ready=null;const state={titleShown:false,narrating:true};
 skip.onclick=()=>{skipped=true;root.classList.add('skipped')};
 // Wall-clock waits: heavy loading (game.js, the first world build) can starve timers, so each beat
 // ends at its deadline however late the timer fires. Once the world is ready (hurry) the current
 // line still gets a short read, then the in-engine scene takes over.
 const hold=async(ms,min=0)=>{const start=performance.now();while(!skipped){const t=performance.now()-start;if(t>=ms||hurry&&t>=min)break;await wait(Math.min(120,ms-t))}};
 const narrate=(async()=>{
  await wait(250);caption.classList.add('show');state.titleShown=true;
  await hold(3200,1400);caption.classList.remove('show');
  for(const text of lines){if(skipped||hurry)break;narration.textContent=text;narration.classList.add('show');await hold(linger,1400);narration.classList.remove('show');if(!skipped)await wait(450)}
  if(!finished&&!hurry){holdLine.textContent='The castle gates draw near…';holdLine.classList.add('show')}
  state.narrating=false;
 })();
 function finish(){if(finished)return;finished=true;skipped=true;root.classList.add('leaving');setTimeout(()=>root.remove(),900)}
 const controller={root,state,
  get active(){return !finished},
  get narrated(){return narrate},
  // tutorial.js calls this when the in-engine scene is ready to run; resolves when the narration
  // has finished (or was skipped), so the two never talk over each other.
  async handoff(){hurry=true;await narrate;finish();return {titleShown:state.titleShown}},
  // The world loaded but no cutscene followed (e.g. the training was switched off): bow out.
  release(after=6000){clearTimeout(ready);ready=setTimeout(()=>{if(!finished)finish()},after)},
  finish};
 globalThis.eldervalePrologue=controller;
 return controller;
}
