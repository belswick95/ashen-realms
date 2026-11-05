// Scripted in-engine cutscenes. Each scene is a list of steps the player cannot interrupt
// (except with Skip). The server records the scene as seen with the 'tutorial_cutscene' command,
// and for 'arrival' moves the player to the audience spot, so skipping never desyncs position.
// Step kinds:
//   {fade:'in'|'out',ms}                       fade the screen from/to black
//   {title,subtitle,ms}                       caption card over the scene
//   {shot:{eye:[x,y,z],look:[x,y,z]}|{follow:{back,up,ahead}},ms} move the camera (eased) to a shot
//   {walk:[[x,z],...],timeout}                walk the player with real move commands; waits until arrival
//   {say:{who,name,text},shot}                RuneScape-style dialogue line; click or wait to continue
//   {wait:ms}
export const cutscenes={
 arrival:{
  name:'An audience with the King',
  steps:[
   {fade:'in',ms:1600,shot:{eye:[-340,24,-246],look:[-340,4,-318]}},
   {title:'Eldervale Castle',subtitle:'Seat of King Oswin the Steadfast',ms:3200},
   {shot:{eye:[-352,9,-280],look:[-340,2,-296]},ms:2600},
   {walk:[[-340,-294],[-346,-298],[-346,-306],[-340,-311],[-340,-321],[-340,-328.5]],timeout:30000,shot:{follow:{back:7.5,up:4.2,ahead:6}}},
   {shot:{eye:[-343.6,3.1,-324.6],look:[-340,1.8,-332.5]},ms:1800},
   {say:{who:'npc',name:'King Oswin the Steadfast',text:'Ah, so you are the adventurer the heralds spoke of. Welcome to Eldervale.'},shot:{eye:[-339.3,2.3,-330.4],look:[-340,2.05,-333.2]}},
   {say:{who:'player',text:'Your Majesty. I came as soon as I heard the call.'},shot:{eye:[-339.1,2.5,-332],look:[-340,1.6,-328.5]}},
   {say:{who:'npc',name:'King Oswin the Steadfast',text:'The roads grow dangerous and the realm has need of capable hands. Yours, perhaps.'},shot:{eye:[-339.3,2.3,-330.4],look:[-340,2.05,-333.2]}},
   {say:{who:'npc',name:'King Oswin the Steadfast',text:'But I send no one out unprepared. You will train here, within these walls, before the Great Gate opens for you.'},shot:{eye:[-336.8,2.9,-325.2],look:[-340,1.8,-332]}},
   {say:{who:'npc',name:'King Oswin the Steadfast',text:'Report to Sergeant Brannoc in the training yard, by the south-west wall. He will teach you to fight.'},shot:{eye:[-339.3,2.3,-330.4],look:[-340,2.05,-333.2]}},
   {say:{who:'player',text:'I won\'t let you down, Your Majesty.'},shot:{eye:[-339.1,2.5,-332],look:[-340,1.6,-328.5]}},
   {fade:'out',ms:900},
  ]},
};

// Basic shape check used by tests and before a scene runs.
export function validCutscene(scene){
 if(!scene||!Array.isArray(scene.steps)||!scene.steps.length)return false;
 const point=(p,n)=>Array.isArray(p)&&p.length===n&&p.every(Number.isFinite);
 return scene.steps.every(s=>{
  if(s.shot&&!(s.shot.follow||point(s.shot.eye,3)&&point(s.shot.look,3)))return false;
  if(s.walk&&!(Array.isArray(s.walk)&&s.walk.every(p=>point(p,2))))return false;
  if(s.say&&!(typeof s.say.text==='string'&&s.say.text.length))return false;
  return 'fade' in s||'title' in s||'shot' in s||'walk' in s||'say' in s||'wait' in s;
 });
}
