// Quest tracker pinned under the minimap: the active quest's name and current step, collapsible,
// tap to open it in the journal. Round 2 hooks the ground breadcrumb trail onto onTarget().
import {trackedQuest,trackerStep} from './quest-guide.js?v=release-20261106-fix99';

const KEY='eldervale-quest-tracker';
const read=()=>{try{return JSON.parse(localStorage.getItem(KEY)||'{}')||{}}catch{return {}}};
const write=v=>{try{localStorage.setItem(KEY,JSON.stringify(v))}catch{}};
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};

export function createQuestTracker({openJournal=()=>{},anchor=()=>document.querySelector('#map-widget')}={}){
 if(!document.querySelector('link[href^="./quest-ui.css"]'))document.head.append(Object.assign(document.createElement('link'),{rel:'stylesheet',href:'./quest-ui.css?v=release-20261106-fix99'}));
 const saved=read();let collapsed=!!saved.collapsed,preferred=saved.quest||null,current=null,step=null,signature='',last=null;const listeners=new Set();
 const root=el('section','quest-tracker');root.id='quest-tracker';root.hidden=true;root.setAttribute('aria-label','Quest tracker');
 const head=el('button','quest-tracker-head');head.type='button';head.setAttribute('aria-expanded',String(!collapsed));
 const badge=el('span','quest-tracker-badge','Quest'),title=el('strong','quest-tracker-title'),chev=el('span','quest-tracker-chevron','▾');chev.setAttribute('aria-hidden','true');head.append(badge,title,chev);
 const body=el('button','quest-tracker-body');body.type='button';const goal=el('span','quest-tracker-step'),count=el('small','quest-tracker-count');body.append(goal,count);
 root.append(head,body);document.body.append(root);root.classList.toggle('collapsed',collapsed);
 head.onclick=()=>{collapsed=!collapsed;root.classList.toggle('collapsed',collapsed);head.setAttribute('aria-expanded',String(!collapsed));write({collapsed,quest:preferred});place()};
 body.onclick=()=>{if(current)openJournal(current.id)};
 // Sit just under the minimap whatever layout (desktop, iPad, phone) placed it.
 function place(){const a=anchor();if(!a||root.hidden)return;const r=a.getBoundingClientRect();if(!r.width)return;
  root.style.top=Math.round(r.bottom+6)+'px';root.style.right=Math.max(4,Math.round(innerWidth-r.right))+'px';root.style.width=Math.round(Math.max(150,Math.min(240,r.width+20)))+'px'}
 addEventListener('resize',place);
 return {root,
  get quest(){return current},get step(){return step},
  // Breadcrumb hook (Round 2): called with {quest,step} whenever the tracked step changes.
  onTarget(fn){listeners.add(fn);if(current)fn({quest:current,step});return ()=>listeners.delete(fn)},
  track(id){preferred=id;write({collapsed,quest:preferred});signature='';if(last)this.sync(...last)},
  sync(quests,ctx,{hidden=false}={}){
   last=[quests,ctx,{hidden}];
   const q=hidden?null:trackedQuest(quests,ctx,preferred),s=q?trackerStep(q,ctx.carried,ctx.npcName):null;
   const sig=q?q.id+'|'+s?.label+'|'+s?.count+'|'+s?.state:'';if(sig===signature)return;signature=sig;current=q;step=s;
   root.hidden=!q;if(!q){for(const fn of listeners)fn({quest:null,step:null});return}
   title.textContent=q.data.name;goal.textContent=s.state==='ready'?'✔ '+s.label:s.state==='report'?'➜ '+s.label:s.label;count.textContent=s.state==='active'&&s.amount>1?s.count+'/'+s.amount:s.stage?'Part '+s.stage+' of '+s.total:s.total>1?'Step '+Math.min(s.total,s.done+1)+' of '+s.total:'';
   root.dataset.state=s.state;body.setAttribute('aria-label',q.data.name+': '+goal.textContent+'. Open in quest journal');
   place();for(const fn of listeners)fn({quest:q,step:s});
  },
  place,
  destroy(){root.remove();removeEventListener('resize',place)}};
}
