// Castle training client: objective HUD, guide arrow, tutor dialogue, gate lock and the arrival cutscene.
// Server state (quests + game_flags.tutorial) arrives with every realm sync; nothing here is authoritative.
import {cutscenes,validCutscene} from './cutscenes.js?v=release-20261107-bank153';
import {currentStep,talkPlan,tutorialLocked,needsCutscene,exitBlocked,bearing,GATE_MESSAGE,tutorialQuestsOf} from './tutorial-logic.js?v=release-20261107-bank153';
import {frameShot,roomFromGroup,glideClear} from './cutscene-camera.js?v=release-20261107-bank153';
import {obstructionDistance} from './camera-obstruction.js?v=release-20261107-bank153';

const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text!=null)n.textContent=text;return n};
const wait=ms=>new Promise(r=>setTimeout(r,ms));
const ease=t=>t<.5?2*t*t:1-Math.pow(-2*t+2,2)/2;

// npcDialogue (optional, npc-dialogue.js adapter {start(profile)->id,page,choose,close,owns}): tutor
// conversations then use the game's one NPC conversation box instead of the cutscene chatbox.
// actorRoot(id) (optional): an NPC's scene root, for quest cutscenes' NPC moves (quest-cutscenes.js).
// cameraOccluders() (optional): meshes a cutscene camera must not look through (camera-obstruction.js
// collectCameraOccluders: walls, doors, furniture); rooms() (optional): building groups, so shots of
// people indoors stay inside that room (cutscene-camera.js). prewarm(eye,look) (optional): draws a
// shot off-screen so its shaders compile while the prologue still covers the canvas (cutscene-boot.js).
export function createTutorial({T,scene,heightAt,locate,playerPosition,say,command,lastError,carried,refreshGates,npcDialogue=null,actorRoot=null,cameraOccluders=()=>[],rooms=()=>[],prewarm=null}){
 document.head.append(Object.assign(document.createElement('link'),{rel:'stylesheet',href:'./tutorial.css?v=release-20261107-bank153'}));
 let quests=[],flags={},locked=false,step=null,talking=false,destroyed=false,selfName='';
 // ---- objective HUD
 const hud=el('section','tutorial-hud');hud.hidden=true;hud.setAttribute('aria-live','polite');
 const hudHead=el('div','tutorial-hud-head'),hudTitle=el('strong'),hudCount=el('small'),hudGoal=el('p','tutorial-hud-goal'),hudWay=el('p','tutorial-hud-way');
 hudHead.append(el('span','tutorial-hud-badge','Castle training'),hudCount);hud.append(hudHead,hudTitle,hudGoal,hudWay);document.body.append(hud);
 // Phones: the card sits under the player frame and a tap folds it to its title line (kept for the session).
 installHudFold(hud);
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
 const cutscene={active:false,shot:null,from:null,to:null,start:0,ms:1,follow:null,skip:false,npcs:new Map()};
 const letterbox=el('div','tutorial-letterbox');letterbox.hidden=true;const caption=el('div','tutorial-caption'),skip=el('button','tutorial-skip','Skip ▸▸');skip.type='button';
 const fader=el('div','tutorial-fade');letterbox.append(el('i','bar top'),el('i','bar bottom'),caption,skip);document.body.append(letterbox,fader);
 // Escape skips the scene even while a line of dialogue (whose Continue button has focus) is showing.
 const blockKeys=e=>{if(!cutscene.active)return;if(e.key==='Escape'){e.stopPropagation();e.preventDefault();skip.onclick();return}if(box.contains(e.target))return;if(![' ','Enter'].includes(e.key)||!box.hidden){e.stopPropagation();e.preventDefault()}};
 skip.onclick=()=>{cutscene.skip=true;cont.click()};
 const fade=(to,ms)=>{fader.style.transition='opacity '+ms+'ms ease';fader.style.opacity=String(to);return wait(ms)};
 // {around:actorId,distance,height,angle(deg)}: a shot framed on an NPC wherever it stands now.
 function resolveShot(shot){
  if(!shot.around)return shot;const p=locate(shot.around);if(!p)return null;
  const a=(Number(shot.angle)||0)*Math.PI/180,dist=Number(shot.distance)||3.2,y=(p.y||heightAt(p.x,p.z))+1.5;
  return {eye:[p.x+Math.sin(a)*dist,y+(Number(shot.height)||1.6)-1.2,p.z+Math.cos(a)*dist],look:[p.x,y,p.z]};
 }
 // Line of sight against the game's camera occluders (walls, doors, furniture).
 const ray=new T.Raycaster(),rayDir=new T.Vector3(),rayFrom=new T.Vector3();
 function hitDistance(from,to){
  rayFrom.set(from.x,from.y,from.z);rayDir.set(to.x-from.x,to.y-from.y,to.z-from.z);const far=rayDir.length();if(far<1e-3)return Infinity;
  rayDir.multiplyScalar(1/far);ray.set(rayFrom,rayDir);ray.near=0;ray.far=far;let list=[];try{list=cameraOccluders()||[]}catch{}
  const hit=list.length?ray.intersectObjects(list,false)[0]:null;return hit?hit.distance:Infinity;
 }
 const clear=(a,b)=>{const d=Math.hypot(b.x-a.x,b.y-a.y,b.z-a.z);return hitDistance(b,a)>=d-.05};
 // Subjects of a framed shot: 'player', an actor id, or {id,at:[x,z]} (where to look if not loaded).
 function subject(ref){
  if(ref==='player'){const p=playerPosition();return {x:p.x,y:p.y,z:p.z,tall:1.75}}
  const id=typeof ref==='string'?ref:ref?.id,p=id?locate(id):null;
  if(p)return {x:p.x,y:Number.isFinite(p.y)?p.y:heightAt(p.x,p.z),z:p.z,tall:1.75*(Number(ref?.scale)||1)};
  if(Array.isArray(ref?.at))return {x:ref.at[0],y:heightAt(ref.at[0],ref.at[1]),z:ref.at[1],tall:1.75*(Number(ref?.scale)||1)};
  return null;
 }
 // {two:{a,b,...}} / {over:{shoulder,at,...}}: resolved against the live camera (fov, aspect).
 function frameDynamic(spec,camera){
  const o=spec.two||spec.over,a=subject(spec.two?o.a:o.shoulder),b=subject(spec.two?o.b:o.at);if(!a||!b)return null;
  let list=[];try{list=(rooms()||[]).map(roomFromGroup)}catch{}
  const r=frameShot(spec,{a,b,fov:camera.fov,aspect:camera.aspect,rooms:list,clear});
  return {eye:new T.Vector3(r.eye.x,r.eye.y,r.eye.z),look:new T.Vector3(r.look.x,r.look.y,r.look.z),aspect:camera.aspect,fov:camera.fov,ok:r.ok,subjects:[a,b]};
 }
 // Shots start from wherever the camera really is (a follow shot included).
 function setShot(shot,ms=0){
  if(shot.follow){cutscene.follow=shot.follow;cutscene.guard=null;return}
  cutscene.follow=null;cutscene.from=cutscene.cam?{eye:cutscene.cam.eye.clone(),look:cutscene.cam.look.clone()}:null;cutscene.start=performance.now();cutscene.ms=Math.max(1,ms);cutscene.checked=false;cutscene.guard=null;
  if(shot.two||shot.over){cutscene.to={spec:shot};return}
  shot=resolveShot(shot);if(!shot)return;
  cutscene.to={eye:new T.Vector3(...shot.eye),look:new T.Vector3(...shot.look)};
 }
 // Shot timings run in rendered time: a step waits for its shot's first frame (a slow device's first
 // frames compile shaders), so no shot is skipped unseen. Gives up after `limit` ms.
 async function shotShown(limit=20000){const mark=cutscene.placed||0,t0=performance.now();while(!cutscene.skip&&(cutscene.placed||0)<=mark&&performance.now()-t0<limit)await new Promise(r=>requestAnimationFrame(()=>r()))}
 // Places the cutscene camera: eased move between shots, cut when the glide would cross a wall,
 // then pulled in front of anything between the subject and the lens (camera-obstruction.js).
 function placeCamera(camera){
  const now=performance.now(),dt=Math.min(.1,Math.max(0,(now-(cutscene.lastFrame||now))/1000));cutscene.lastFrame=now;
  let eye,look,focus;
  if(cutscene.follow){const p=playerPosition(),f=cutscene.follow;eye=new T.Vector3(p.x,p.y+f.up,p.z+f.back);look=new T.Vector3(p.x,p.y+1.2,p.z-f.ahead);focus=new T.Vector3(p.x,p.y+1.5,p.z)}
  else if(cutscene.to){
   const to=cutscene.to;
   // Reframe when the screen changes shape or a subject is still settling (glide to the new framing).
   const moved=to.subjects&&now-(to.checkedAt||0)>250&&(to.checkedAt=now,[subject(to.spec.two?.a??to.spec.over.shoulder),subject(to.spec.two?.b??to.spec.over.at)].some((p,i)=>p&&Math.hypot(p.x-to.subjects[i].x,p.z-to.subjects[i].z)>.6));
   if(to.spec&&(!to.eye||to.aspect!==camera.aspect||to.fov!==camera.fov||moved)){const r=frameDynamic(to.spec,camera);if(!r)return false;
    if(to.eye&&moved&&cutscene.cam){cutscene.from={eye:cutscene.cam.eye.clone(),look:cutscene.cam.look.clone()};cutscene.start=now;cutscene.ms=700;cutscene.checked=false}Object.assign(to,r)}
   if(!to.eye)return false;
   if(!cutscene.checked){cutscene.checked=true;cutscene.start=now;if(!cutscene.from||!glideClear(cutscene.from.eye,to.eye,clear))cutscene.ms=1}
   const from=cutscene.from||to,t=ease(Math.min(1,(now-cutscene.start)/cutscene.ms));
   eye=new T.Vector3().lerpVectors(from.eye,to.eye,t);look=new T.Vector3().lerpVectors(from.look,to.look,t);focus=look;
  }else return false;
  const offset=eye.clone().sub(focus),want=offset.length();
  if(want>.01){const hit=hitDistance(focus,eye);cutscene.guard=obstructionDistance(cutscene.guard,hit<want?hit-.3:want,want,dt);eye.copy(focus).addScaledVector(offset,Math.min(1,cutscene.guard/want))}
  camera.position.copy(eye);camera.lookAt(look);cutscene.cam={eye,look};cutscene.placed=(cutscene.placed||0)+1;
  // First rendered frame of the scene (this frame renders right after): for load-time measurement.
  if(!cutscene.shown){cutscene.shown=true;queueMicrotask(()=>performance.mark?.('eldervale-cutscene-first-frame'))}
  return true;
 }
 // Walks the player with real move commands. A walk that stalls (a shut door, a crowd) stops early
 // instead of waiting out the timeout; with `settle` ({command,payload}: the scene's record command,
 // which for 'arrival' makes the server place the player in front of the King) the player is then
 // set down at the end behind a quick fade, so the scene never frames someone left outside a door.
 async function walkTo(path,timeout,settle=null){
  await command('run',{enabled:true});await command('move',{path,target:null,kind:'walk'});
  const end=path.at(-1),t0=performance.now(),near=()=>{const p=playerPosition();return Math.hypot(p.x-end[0],p.z-end[1])<1.4};
  let mark=playerPosition(),last={x:mark.x,z:mark.z},moved=t0;
  while(!cutscene.skip&&performance.now()-t0<timeout){if(near())break;const p=playerPosition();
   if(Math.hypot(p.x-last.x,p.z-last.z)>.3){last={x:p.x,z:p.z};moved=performance.now()}else if(performance.now()-moved>2200&&performance.now()-t0>3000)break;
   await wait(150)}
  await command('run',{enabled:false});
  if(settle&&!cutscene.skip&&!near()){
   await fade(1,350);await command(settle.command,settle.payload);
   const t1=performance.now();while(!near()&&performance.now()-t1<3500)await wait(120);
   cutscene.cam=null;await fade(0,450);
  }
 }
 // options.scene: a scene object (quest cutscenes); options.record: {command,payload} that records it.
 async function playCutscene(id,options={}){const prologue=options.prologue||null;
  const sceneData=options.scene||cutscenes[id];if(!validCutscene(sceneData)||cutscene.active)return;
  cutscene.active=true;cutscene.boot=!!prologue;cutscene.skip=false;cutscene.to=null;cutscene.from=null;cutscene.cam=null;cutscene.guard=null;cutscene.shown=false;document.body.classList.add('tutorial-cutscene');letterbox.hidden=false;hud.hidden=true;arrow.visible=false;
  window.addEventListener('keydown',blockKeys,true);fader.style.transition='none';fader.style.opacity='1';
  performance.mark?.('eldervale-cutscene-start');
  // The DOM prologue (tutorial-prologue.js) already showed the title card while the world loaded:
  // take over from it on a black frame and skip the repeated caption.
  // The prologue starts its last line now; meanwhile (only if it is still talking: otherwise the
  // scene simply starts) the opening shot's shaders compile behind it.
  const handoff=prologue?prologue.handoff().catch(()=>({titleShown:false})):null;
  if(prologue?.state?.narrating&&prewarm){const first=sceneData.steps.find(s=>s.shot?.eye);if(first){await new Promise(r=>requestAnimationFrame(()=>r()));try{prewarm(first.shot.eye,first.shot.look)}catch(e){console.warn('Cutscene prewarm:',e.message)}}}
  let titled=false;if(handoff)titled=!!(await handoff)?.titleShown;
  try{
   for(const s of sceneData.steps){
    if(cutscene.skip)break;
    if(s.title&&titled){if(s.shot)setShot(s.shot,s.ms||0);continue}
    if(s.shot){setShot(s.shot,s.fade?0:s.ms||0);await shotShown()}
    if(s.fade){await fade(s.fade==='in'?0:1,s.ms||800);continue}
    if(s.title){caption.replaceChildren(el('strong',null,s.title),el('span',null,s.subtitle||''));caption.classList.add('show');await wait(s.ms||2500);caption.classList.remove('show');continue}
    if(s.walk){await walkTo(s.walk,s.timeout||20000,s.settle?(options.record||{command:'tutorial_cutscene',payload:{id}}):null);continue}
    if(s.npc){npcStep(s.npc);if(s.npc.to)await wait(Math.max(1,s.npc.ms||900));continue}
    if(s.say){await speak(s.say);continue}
    if(s.wait||s.ms)await wait(s.wait||s.ms);
   }
  }finally{
   close();if(fader.style.opacity!=='1')await fade(1,500);
   const ok=await command(options.record?.command||'tutorial_cutscene',options.record?.payload||{id});if(!ok)console.warn('Cutscene record failed:',lastError());
   cutscene.active=false;cutscene.follow=null;cutscene.to=null;cutscene.npcs.clear();letterbox.hidden=true;caption.classList.remove('show');document.body.classList.remove('tutorial-cutscene');window.removeEventListener('keydown',blockKeys,true);
   await wait(350);await fade(0,900);drawHud();
   if(id==='arrival')say('Find Sergeant Brannoc in the training yard. Follow the golden arrow.');
  }
 }
 window.eldervaleCutscene=cutscene;

 return {
  get active(){return locked},
  // The castle training's current step (the quest guidance trail follows it while training).
  currentStep:()=>step,
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
    for(const m of cutscene.npcs.values()){const t=ease(Math.min(1,(performance.now()-m.start)/m.ms)),r=m.root;
     if(m.to){r.position.x=m.from.x+(m.to.x-m.from.x)*t;r.position.z=m.from.z+(m.to.z-m.from.z)*t;r.position.y=heightAt(r.position.x,r.position.z)}
     const aim=m.face||(m.to&&t<1?m.to:null);if(aim){const dx=aim.x-r.position.x,dz=aim.z-r.position.z;if(Math.abs(dx)+Math.abs(dz)>1e-3)r.rotation.y=Math.atan2(dx,dz)}}
    placeCamera(camera);
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

// Tap or click the objective card to fold it to the badge and title; the choice lasts for the session.
export function installHudFold(hud,storage=globalThis.sessionStorage){
 const key='eldervale-tutorial-hud-folded',set=folded=>{hud.classList.toggle('tutorial-hud-folded',folded);hud.setAttribute('aria-expanded',String(!folded));hud.title=folded?'Show the training objective':'Fold the training objective'};
 let folded=false;try{folded=storage?.getItem(key)==='1'}catch{}set(folded);
 hud.addEventListener('click',()=>{folded=!hud.classList.contains('tutorial-hud-folded');set(folded);try{storage?.setItem(key,folded?'1':'0')}catch{}});
 return set;
}
