// Scripted in-engine cutscenes. Each scene is a list of steps the player cannot interrupt
// (except with Skip). The server records the scene as seen with the 'tutorial_cutscene' command,
// and for 'arrival' moves the player to the audience spot, so skipping never desyncs position.
// Step kinds:
//   {fade:'in'|'out',ms}                       fade the screen from/to black
//   {title,subtitle,ms}                       caption card over the scene
//   {shot:{eye:[x,y,z],look:[x,y,z]}|{follow:{back,up,ahead}},ms} move the camera (eased) to a shot
//   {walk:[[x,z],...],timeout,settle}         walk the player with real move commands; waits until arrival
//                                             (settle: if a shut door stops the walk, record the scene
//                                             early so the server sets the player down at the end)
//   {say:{who,name,text},shot}                RuneScape-style dialogue line; click or wait to continue
//   {wait:ms}
//   {npc:{id,to:[x,z],face:[x,z],ms}}             move/turn an NPC for the scene (quest cutscenes)
//   shot:{around:actorId,distance,height,angle}   a camera shot framed on an NPC
//   shot:{two:{a,b,angle,side,height}}           two-shot of two subjects ('player', an actor id or
//                                                {id,at:[x,z],scale}), sized for the screen's aspect
//   shot:{over:{shoulder,at,side,height}}         over `shoulder`'s shoulder onto `at`
// Framed shots (cutscene-camera.js) follow the subjects, stay inside their room and never look
// through a wall, door or bench; fixed eye/look shots are only for open ground.
import {tutorialId} from './tutorial-data.js?v=release-20261107-heading144';
// King Oswin holds court in the Keep (tutorial-data.js entity 1).
export const KING={id:tutorialId(1),at:[-340,-333.2],scale:1.05};
export const cutscenes={
 arrival:{
  name:'An audience with the King',
  steps:[
   {fade:'in',ms:1600,shot:{eye:[-340,24,-246],look:[-340,4,-318]}},
   {title:'Eldervale Castle',subtitle:'Seat of King Oswin the Steadfast',ms:3200},
   {shot:{eye:[-352,9,-280],look:[-340,2,-296]},ms:2600},
   {walk:[[-340,-294],[-346,-298],[-346,-306],[-340,-311],[-340,-321],[-340,-328.5]],timeout:30000,settle:true,shot:{follow:{back:7.5,up:4.2,ahead:6}}},
   {shot:{two:{a:'player',b:KING,angle:50,side:-1,height:.9}},ms:1800},
   {say:{who:'npc',name:'King Oswin the Steadfast',text:'Ah, so you are the adventurer the heralds spoke of. Welcome to Eldervale.'},shot:{over:{shoulder:'player',at:KING,side:1}}},
   {say:{who:'player',text:'Your Majesty. I came as soon as I heard the call.'},shot:{over:{shoulder:KING,at:'player',side:-1}}},
   {say:{who:'npc',name:'King Oswin the Steadfast',text:'The roads grow dangerous and the realm has need of capable hands. Yours, perhaps.'},shot:{over:{shoulder:'player',at:KING,side:1}}},
   {say:{who:'npc',name:'King Oswin the Steadfast',text:'But I send no one out unprepared. You will train here, within these walls, before the Great Gate opens for you.'},shot:{two:{a:'player',b:KING,angle:-20,side:-1,height:.7}}},
   {say:{who:'npc',name:'King Oswin the Steadfast',text:'Report to Sergeant Brannoc in the training yard, by the south-west wall. He will teach you to fight.'},shot:{over:{shoulder:'player',at:KING,side:-1}}},
   {say:{who:'player',text:'I won\'t let you down, Your Majesty.'},shot:{over:{shoulder:KING,at:'player',side:1}}},
   {fade:'out',ms:900},
  ]},
};

// Basic shape check used by tests and before a scene runs.
export function validCutscene(scene){
 if(!scene||!Array.isArray(scene.steps)||!scene.steps.length)return false;
 const point=(p,n)=>Array.isArray(p)&&p.length===n&&p.every(Number.isFinite);
 return scene.steps.every(s=>{
  const who=r=>r==='player'||typeof r==='string'&&r.length>0||!!r&&typeof r.id==='string'&&(!r.at||point(r.at,2));
  if(s.shot&&!(s.shot.follow||typeof s.shot.around==='string'||point(s.shot.eye,3)&&point(s.shot.look,3)||s.shot.two&&who(s.shot.two.a)&&who(s.shot.two.b)||s.shot.over&&who(s.shot.over.shoulder)&&who(s.shot.over.at)))return false;
  if(s.npc&&!(typeof s.npc.id==='string'&&(!s.npc.to||point(s.npc.to,2))&&(!s.npc.face||point(s.npc.face,2))))return false;
  if(s.walk&&!(Array.isArray(s.walk)&&s.walk.every(p=>point(p,2))))return false;
  if(s.say&&!(typeof s.say.text==='string'&&s.say.text.length))return false;
  return 'fade' in s||'title' in s||'shot' in s||'walk' in s||'say' in s||'wait' in s||'npc' in s;
 });
}
