// Quest cutscene hooks (quest system v2): a stage's onEnter.cutscene plays once when the player
// reaches that stage, and data.onComplete.cutscene plays before the completion scroll. Scenes are
// stored in the quest (data.cutscenes) and run on the castle tutorial's cutscene engine
// (tutorial.js playCutscene); the server records them in progress._seen (quest_cutscene).
import {isStaged,currentStage} from './quest-v2.js?v=release-20261107-canopy152';

// The next stage cutscene this player has not seen yet: {quest, name, scene} or null.
export function pendingQuestCutscene(rows=[],played=new Set()){
 for(const q of rows){
  if(!q?.accepted||q.completed||!isStaged(q.data))continue;
  const name=currentStage(q)?.onEnter?.cutscene,scene=name&&q.data.cutscenes?.[name];
  if(!scene||(q.progress?._seen||[]).includes(name)||played.has(q.id+':'+name))continue;
  return {quest:q,name,scene};
 }
 return null;
}
export const completionCutscene=q=>{const name=q?.data?.onComplete?.cutscene,scene=name&&q.data.cutscenes?.[name];return scene?{quest:q,name,scene}:null};

// play(name,{scene,record}) -> Promise (tutorial.playCutscene); busy() true while a conversation,
// another cutscene or the world loader is on screen.
export function createQuestCutscenes({play,busy=()=>false}){
 const played=new Set();let running=null;
 const run=c=>{played.add(c.quest.id+':'+c.name);running=Promise.resolve(play(c.name,{scene:c.scene,record:{command:'quest_cutscene',payload:{id:c.quest.id,cutscene:c.name}}})).catch(e=>console.warn('Quest cutscene:',e?.message)).finally(()=>{running=null});return running};
 return {
  sync(rows){if(running||busy())return;const c=pendingQuestCutscene(rows,played);if(c)void run(c)},
  // Promise when the quest has a completion scene (the scroll waits for it), else null.
  completion(q){const c=completionCutscene(q);if(!c||played.has(q.id+':'+c.name))return null;return run(c)},
  get active(){return !!running}};
}
