// Castle training client: objective HUD, guide arrow, tutor dialogue, gate lock and the arrival cutscene.
// Server state (quests + game_flags.tutorial) arrives with every realm sync; nothing here is authoritative.
import {cutscenes,validCutscene} from './cutscenes.js?v=release-20261106-tile93';
import {currentStep,talkPlan,tutorialLocked,needsCutscene,exitBlocked,bearing,GATE_MESSAGE,tutorialQuestsOf} from './tutorial-logic.js?v=release-20261106-tile93';

const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;

// npcDialogue (optional, npc-dialogue.js adapter {start(profile)->id,page,choose,close,owns}): tutor
// conversations then use the game's one NPC conversation box instead of the cutscene chatbox.
export function createTutorial({T,scene,heightAt,locate,playerPosition,say,command,lastError,carried,refreshGates,npcDialogue=null}){
 document.head.append(Object.assign(document.createElement('link'),{rel:'stylesheet',href:'./tutorial.css?v=release-20261106-tile93'}));
 let quests=[],flags={},locked=false,step=null,talking=false,destroyed=false,selfName='';
 // ---- objective HUD
 const hud=el('section','tutorial-hud');hud.hidden=true;hud.setAttribute('aria-live','polite');
 const hudHead=el('div','tutorial-hud-head'),hudTitle=el('strong'),hudCount=el('small'),hudGoal=el('p','tutorial-hud-goal'),hudWay=el('p','tutorial-hud-way');
 hudHead.append(el('span','tutorial-hud-badge','Castle training'),hudCount);hud.append(hudHead,hudTitle,hudGoal,hudWay);document.body.append(hud);
 // ---- guide arrow floating over the next target
 const arrow=new T.Group();arrow.visible=false;arrow.renderOrder=20;
 const arrowMat=new T.MeshBasicMaterial({color:0xffd34d,depthTest:false,transparent:true,opacity:.95});
 const cone=new T.Mesh(new T.ConeGeometry(.42,.9,4),arrowMat);cone.rotation.x=Math.PI;cone.renderOrder=20;arrow.add(cone);
 const shaft=new T.Mesh(new T.BoxGeometry(.22,.6,.22),arrowMat);shaft.position.y=.7;shaft.renderOrder=20;arrow.add(shaft);
 scene.add(arrow);
 // ---- RuneScape-style chatbox dialogue
 const box=el('div','tutorial-dialogue');box.hidden=true;box.setAttribute('role','dialog');
 const who=el('h4'),line=el('p'),choices=el('div','tutorial-choices'),cont=el('button','tutorial-continue','Click here to continue');cont.type='button';
 box.append(who,line,choices,cont);document.body.append(box);
 function speak({who:speaker='npc',name,text},npcName){
  return new Promise(resolve=>{box.hidden=false;box.dataset.who=speaker;who.textContent=speaker==='player'?(selfName||'You'):(name||npcName||'');line.textContent=text;choices.replaceChildren();cont.hidden=false;
   const done=()=>{cont.onclick=null;window.removeEventListener('keydown',key,true);resolve()};
   const key=e=>{if(e.key===' '||e.key==='Enter'){e.preventDefault();e.stopPropagation();done()}};
   cont.onclick=done;window.addEventListener('keydown',key,true);cont.focus({preventScroll:true});});
 }
 function choose(options,npcName){
  return new Promise(resolve=>{box.hidden=false;box.dataset.who='choice';who.textContent='Select an option';line.textContent='';cont.hidden=true;choices.replaceChildren();
   options.forEach(([label,value],i)=>{const b=el('button',null,(i+1)+'. '+label);b.type='button';b.onclick=()=>resolve(value);choices.append(b)});choices.firstChild?.focus({preventScroll:true});});
 }
 const close=()=>{box.hidden=true;choices.replaceChildren()};
 async function conversation(lines,npcName){for(const l of lines)await speak(l,npcName)}

 function targetPoint(target){
  if(!target)return null;if(typeof target==='object'&&Number.isFinite(target.x))return {x:target.x,y:heightAt(target.x,target.z),z:target.z,tall:1.2};
  const p=locate(target);return p?{x:p.x,y:p.y,z:p.z,tall:2.4}:null;
 }
 function drawHud(){
  step=locked?currentStep(quests,carried):null;
  if(!step||cutscene.active){hud.hidden=true;arrow.visible=false;return}
  hud.hidden=false;const q=step.quest;hudTitle.textContent=q.data.name;hudCount.textContent='Step '+(step.index+1)+' of '+step.total;
  hudGoal.textContent=step.state==='finished'?'Training complete!':step.label+(step.state==='active'&&step.amount>1?' · '+step.count+'/'+step.amount:'');
 }
 function giverNames(){for(const q of quests){const p=locate(q.data.giver);if(p?.name)q.data.giverName=p.name}}

 // ---- cutscene engine (data driven, see cutscenes.js)
 const cutscene={active:false,shot:null,from:null,to:null,start:0,ms:1,follow:null,skip:false};
 const letterbox=el('div','tutorial-letterbox');letterbox.hidden=true;const caption=el('div','tutorial-caption'),skip=el('button','tutorial-skip','Skip ▸▸');skip.type='button';
 const fader=el('div','tutorial-fade');letterbox.append(el('i','bar top'),el('i','bar bottom'),caption,skip);document.body.append(letterbox,fader);
 // Escape skips the scene even while a line of dialogue (whose Continue button has focus) is showing.
 const blockKeys=e=>{if(!cutscene.active)return;if(e.key==='Escape'){e.stopPropagation();e.preventDefault();skip.onclick();return}if(box.contains(e.target))return;if(![' ','Enter'].includes(e.key)||!box.hidden){e.stopPropagation();e.preventDefault()}};
 skip.onclick=()=>{cutscene.skip=true;cont.click()};
 const fade=(to,ms)=>{fader.style.transition='opacity '+ms+'ms ease';fader.style.opacity=String(to);return wait(ms)};
 function setShot(shot,ms=0){
  if(shot.follow){cutscene.follow=shot.follow;return}
  cutscene.follow=null;cutscene.from=cutscene.to?{...cutscene.to}:null;cutscene.to={eye:new T.Vector3(...shot.eye),look:new T.Vector3(...shot.look)};cutscene.start=performance.now();cutscene.ms=Math.max(1,ms);
  if(!cutscene.from)cutscene.from=cutscene.to;
 }
 async function walkTo(path,timeout){
  await command('run',{enabled:true});await command('move',{path,target:null,kind:'walk'});
  const end=path.at(-1),t0=performance.now();
  while(!cutscene.skip&&performance.now()-t0<timeout){const p=playerPosition();if(Math.hypot(p.x-end[0],p.z-end[1])<1.4)break;await wait(150)}
  await command('run',{enabled:false});
 }
 async function playCutscene(id,{prologue=null}={}){
  const sceneData=cutscenes[id];if(!validCutscene(sceneData)||cutscene.active)return;
  cutscene.active=true;cutscene.skip=false;cutscene.to=null;document.body.classList.add('tutorial-cutscene');letterbox.hidden=false;hud.hidden=true;arrow.visible=false;
  window.addEventListener('keydown',blockKeys,true);fader.style.transition='none';fader.style.opacity='1';
  performance.mark?.('eldervale-cutscene-start');
  // The DOM prologue (tutorial-prologue.js) already showed the title card while the world loaded:
  // take over from it on a black frame and skip the repeated caption.
  let titled=false;if(prologue){try{titled=(await prologue.handoff()).titleShown}catch{}}
  try{
   for(const s of sceneData.steps){
    if(cutscene.skip)break;
    if(s.title&&titled){if(s.shot)setShot(s.shot,s.ms||0);continue}
    if(s.shot)setShot(s.shot,s.fade?0:s.ms||0);
    if(s.fade){await fade(s.fade==='in'?0:1,s.ms||800);continue}
    if(s.title){caption.replaceChildren(el('strong',null,s.title),el('span',null,s.subtitle||''));caption.classList.add('show');await wait(s.ms||2500);caption.classList.remove('show');continue}
    if(s.walk){await walkTo(s.walk,s.timeout||20000);continue}
    if(s.say){await speak(s.say);continue}
    if(s.wait||s.ms)await wait(s.wait||s.ms);
   }
  }finally{
   close();if(fader.style.opacity!=='1')await fade(1,500);
   const ok=await command('tutorial_cutscene',{id});if(!ok)console.warn('Cutscene record failed:',lastError());
   cutscene.active=false;cutscene.follow=null;cutscene.to=null;letterbox.hidden=true;caption.classList.remove('show');document.body.classList.remove('tutorial-cutscene');window.removeEventListener('keydown',blockKeys,true);
   await wait(350);await fade(0,900);drawHud();
   if(id==='arrival')say('Find Sergeant Brannoc in the training yard. Follow the golden arrow.');
  }
 }
 window.eldervaleCutscene=cutscene;

 return {
  get active(){return locked},
  gateLocked:()=>locked,
  blockWalk(point){if(cutscene.active)return true;const p=playerPosition();if(exitBlocked(locked,p,point)){say(GATE_MESSAGE);return true}return false},
  sync(data){
   if(destroyed)return;
   selfName=data?.self?.character_name||selfName;
   const next=data?.tutorial||data?.self?.game_flags?.tutorial||{};const was=locked;flags=next;locked=tutorialLocked(next);quests=tutorialQuestsOf(data?.quests||[]);giverNames();
   if(was!==locked)refreshGates?.();
   if(was&&!locked&&next.done)say('Training complete! The Great Gate now opens for you.');
   drawHud();
   // With the prologue already on screen there is nothing to wait for: start as soon as the world is in.
   const prologue=globalThis.eldervalePrologue?.active?globalThis.eldervalePrologue:null;
   if(needsCutscene(flags)&&!cutscene.active&&!cutscene.queued&&document.querySelector('#auth-screen')?.hidden!==false&&window.eldervaleWorldLoading!==true){cutscene.queued=true;setTimeout(()=>void playCutscene('arrival',{prologue}).finally(()=>{cutscene.queued=false}),prologue?0:900)}
   else if(prologue&&!needsCutscene(flags)&&window.eldervaleWorldLoading!==true)prologue.release(0);
  },
  // Returns true when the tutorial handled the conversation.
  talk(npcId,profile){
   // Busy with this tutor already: swallow the repeat (client arrival + server interaction event)
   // instead of letting the normal NPC conversation open on top.
   if(talking)return true;
   if(!locked||cutscene.active)return false;
   const plan=talkPlan(quests,npcId,carried);if(!plan)return false;
   talking=true;const name=profile?.name;
   const shared=npcDialogue?npcDialogue.start(profile):null,alive=()=>!shared||npcDialogue.owns(shared);
   const line=l=>shared?npcDialogue.page({name,...l}):speak(l,name);
   const pick=options=>shared?npcDialogue.choose({who:'choice',name,text:'Select an option'},options.map(([label,value])=>({label,value}))):choose(options,name);
   (async()=>{try{
    for(const l of plan.lines){await line(l);if(!alive())return}
    if(plan.command){
     const ok=await command(plan.command,{id:plan.quest.id});
     if(!ok){if(alive())await line({who:'npc',text:lastError()||'Come back when you are ready.'})}
     else if(plan.command==='quest_accept')say('New objective: '+(plan.quest.data.objectives[0]?.label||plan.quest.data.name));
     else{say('Quest complete: '+plan.quest.data.name+'!');if(plan.finishes==='tutorial'&&alive()){const go=await pick([['Take the Steward\'s cart to Birchford',true],['I\'ll walk out through the gate',false]]);if(go===true&&!await command('tutorial_depart',{}))say(lastError()||'The cart cannot leave right now.')}}
    }else if(plan.supplies){
     const need=await pick([['I\'ll get right to it.',false],['I\'ve lost my tools. Can I have some more?',true]]);
     if(need===true&&alive()){const ok=await command('tutorial_supplies',{});await line({who:'npc',text:ok?'Here you are. Try not to lose them this time!':lastError()||'You have everything you need.'})}
    }
   }finally{if(shared){if(npcDialogue.owns(shared))npcDialogue.close()}else close();talking=false;drawHud()}})();
   return true;
  },
  // Called each frame after the game camera is placed.
  frame(camera){
   if(cutscene.active){
    if(cutscene.follow){const p=playerPosition(),f=cutscene.follow,yaw=Math.PI;camera.position.set(p.x,p.y+f.up,p.z+f.back);camera.lookAt(p.x,p.y+1.2,p.z-f.ahead);void yaw}
    else if(cutscene.to){const t=ease(Math.min(1,(performance.now()-cutscene.start)/cutscene.ms));camera.position.lerpVectors(cutscene.from.eye,cutscene.to.eye,t);const look=new T.Vector3().lerpVectors(cutscene.from.look,cutscene.to.look,t);camera.lookAt(look)}
    return;
   }
   if(!step||step.state==='finished'){arrow.visible=false;return}
   const target=targetPoint(step.target);if(!target){arrow.visible=false;hudWay.textContent='';return}
   const t=performance.now()/1000;arrow.visible=true;arrow.position.set(target.x,target.y+target.tall+.8+Math.sin(t*3)*.18,target.z);arrow.rotation.y=t*1.6;
   const p=playerPosition(),b=bearing(p,target);hudWay.textContent=b.distance<2?'You are here.':'➜ '+b.text;
  },
  playCutscene,
  destroy(){destroyed=true;hud.remove();box.remove();letterbox.remove();fader.remove();arrow.removeFromParent()}
 };
}
