import {nextFrame} from './frame-work.js?v=release-20261106-boss108';
// Upserts are keyed by entity ID, so repeated snapshots never rebuild unchanged scenery.
// The queue drains nearest-first (re-sorted when rows arrive or the player moves on), so what the
// player — or an opening cutscene — looks at is built before far regions. near(radius) resolves as
// soon as nothing within radius still waits, while the rest keeps streaming in the background.
export function createRegionStreamer({rows,loaded,position,apply,remove,onProgress=()=>{},onError=()=>{},yieldFrame=nextFrame,now=()=>performance.now(),loadRadius=180,unloadRadius=220,budget=5,criticalRadius=40,canRemove=()=>true}){
 const pending=new Map();let running=null,done=0,total=0,blocking=false,dirty=false;const versions=new Map(),waiters=[];const revision=row=>row.revision??JSON.stringify(row.data);
 const distance=(row,p)=>Math.hypot(row.data.x-p.x,row.data.z-p.z);
 const missingWithin=(radius,stale=false)=>{const p=position();for(const id of pending.keys()){const row=rows.get(id);if(row&&!row.deleted&&(!loaded.has(id)||stale&&versions.get(id)!==revision(row))&&distance(row,p)<radius)return true}return false};
 const needsBlockingLoad=()=>missingWithin(criticalRadius);
 function order(){if(!dirty)return;dirty=false;if(pending.size<2)return;const p=position(),sorted=[...pending.keys()].map(id=>{const row=rows.get(id);return [id,row?distance(row,p):-1]}).sort((a,b)=>a[1]-b[1]);pending.clear();for(const [id] of sorted)pending.set(id,true)}
 function settle(all=false){for(let i=waiters.length-1;i>=0;i--){const w=waiters[i];if(all||!pending.size||!missingWithin(w.radius,true)){waiters.splice(i,1);w.resolve()}}}
 // Between slices: nearest first again, wake near() waiters, and stop blocking controls once the
 // player's immediate surroundings are in.
 function checkpoint(){order();settle();if(blocking&&!needsBlockingLoad())blocking=false}
 async function drain(){await yieldFrame();checkpoint();let frameStart=now(),failed=false;try{while(pending.size){const [id]=pending.entries().next().value;pending.delete(id);const row=rows.get(id);if(!row)continue;const p=position(),d=distance(row,p);if(row.deleted||d>unloadRadius){if(row.deleted||canRemove(id)){remove(id);versions.delete(id)}}else if(d<loadRadius){if(!loaded.has(id)||versions.get(id)!==revision(row)){apply(row);versions.set(id,revision(row))}}done++;onProgress({pending:Math.max(1,pending.size),done,total,blocking});if(now()-frameStart>=budget||!pending.size){await yieldFrame();checkpoint();frameStart=now();}}}catch(error){failed=true;onError(error);throw error}finally{running=null;const wasBlocking=blocking;blocking=false;onProgress({pending:0,done,total,error:failed,blocking:wasBlocking});settle(!pending.size||failed)}}
 function kick(){blocking=blocking||needsBlockingLoad();if(!running&&pending.size){done=0;total=pending.size;onProgress({pending:pending.size,done,total,blocking});running=drain();}return running||Promise.resolve()}
 function scan(){const p=position();for(const [id,row]of rows){const d=distance(row,p);if(row.deleted){if(loaded.has(id))pending.set(id,true)}else if(d<loadRadius&&(!loaded.has(id)||versions.get(id)!==revision(row)))pending.set(id,true);else if(d>unloadRadius&&loaded.has(id)&&canRemove(id))pending.set(id,true)}dirty=true;total=Math.max(total,done+pending.size);return kick()}
 return {upsert(changes){for(const row of changes){const old=rows.get(row.id);if(old&&revision(old)===revision(row)&&old.deleted===row.deleted)continue;rows.set(row.id,row);pending.delete(row.id);const p=position();if(loaded.has(row.id)||distance(row,p)<loadRadius)pending.set(row.id,true)}dirty=true;total=Math.max(total,done+pending.size);return kick()},scan,idle:()=>running||Promise.resolve(),
  // Resolves once every wanted row within radius of the player is built (the rest may still stream).
  near(radius){if(!missingWithin(radius,true))return Promise.resolve();const ready=new Promise(resolve=>waiters.push({radius,resolve}));if(!running)kick();return ready},
  get pending(){return pending.size},get busy(){return !!running}};
}
