// Immediate numbered movement; queued actions and monotonic server snapshots.
import {loading,commandLabel} from './loading-indicator.js?v=release-20261106-anim92';
import {createSyncDiet,missingRpc} from './sync-diet.js?v=release-20261106-anim92';
const MOTION_COMMANDS=new Set(['move','stop']);
export async function startRealm(db,user,session){
 const diet=createSyncDiet();let lean=true;
 let cursor=0,first=true,queue=Promise.resolve(),disposed=false,failures=0,offset=0,pending=0,movesPending=0,roundtrip=0,clockReady=false,latestSnapshotTime=-Infinity;
 const badge=document.createElement('output');badge.id='realm-connection';badge.setAttribute('role','status');badge.style.cssText='position:fixed;top:42px;left:50%;transform:translateX(-50%);z-index:250;background:#25271d;color:#f4d899;padding:7px 12px;border-radius:5px';badge.hidden=true;document.body.append(badge);
 async function request(command='sync',payload={},id=null){
  if(disposed)throw Error('Disconnected from the world');
  // A request that hangs (dropped connection) or fails shows "Reconnecting…" until one succeeds.
  const started=Date.now(),slow=loading.begin('Reconnecting…',{key:'realm-slow',delay:4000,kind:'reconnect'});let data,error;
  // Lean replies (db/sync-diet.sql) skip what this client already holds; a server
  // without the lean RPC gets the original call.
  try{const args={session_id:session,command,payload,request_id:id,event_cursor:cursor};if(lean){({data,error}=await db.rpc('world_command_lean',{...args,have:diet.have()}));if(missingRpc(error)){lean=false;diet.reset();({data,error}=await db.rpc('world_command',args))}}else({data,error}=await db.rpc('world_command',args))}catch(e){error=e}finally{slow.end()}
  if(error){badge.hidden=false;badge.textContent='World connection: '+error.message;failures++;
   // Signing in elsewhere replaces this world session: stop polling a dead session (it would fail
   // four times a second forever) and hand over to the sign-in screen.
   if(/session expired/i.test(error.message)&&!disposed){disposed=true;window.eldervaleSessionLost?.('Your character was signed in from another window or device. Please sign in again.');throw Error(error.message)}
   loading.begin('Reconnecting…',{key:'realm-reconnect',kind:'reconnect',timeout:15000});throw Error(error.message)}
  loading.end('realm-reconnect');
  if(data.reset)return true;
  const serverTime=Date.parse(data.time);if(serverTime<latestSnapshotTime)return true;latestSnapshotTime=serverTime;data=diet.expand(data).data;
  const finished=Date.now(),sample=finished-started;roundtrip=clockReady?roundtrip*.8+sample*.2:sample;const clockOffset=Date.parse(data.time)-(started+finished)/2;offset=clockReady?offset*.9+clockOffset*.1:clockOffset;clockReady=true;window.eldervaleServerTime=()=>Date.now()+offset;badge.hidden=true;failures=0;
  // A snapshot taken before a queued click-walk/stop reached the server must not cancel the local walk.
  window.eldervaleRealmBridge.snapshot(data,user.id,{motionStale:movesPending-(MOTION_COMMANDS.has(command)?1:0)>0});if(!first)for(const event of data.events||[])if(Number(event.id)>cursor)window.eldervaleRealmBridge.event(event.data,user.id);first=false;cursor=Math.max(cursor,Number(data.eventCursor)||0);return true;
 }
 function enqueue(command='sync',payload={}){const id=command==='sync'?null:crypto.randomUUID(),motion=MOTION_COMMANDS.has(command);pending++;if(motion)movesPending++;const result=queue.then(()=>request(command,payload,id));queue=result.catch(()=>{}).finally(()=>{pending--;if(motion)movesPending--});return result;}
 let commandError='',latestSteer=null,steerInFlight=0,issued=0,acknowledged=0;
 async function sendSteer(){
  if(!latestSteer||disposed)return;
  if(steerInFlight>=2&&latestSteer.moving)return;
  const input=latestSteer;latestSteer=null;steerInFlight++;let succeeded=false;
  try{await request('steer',input,crypto.randomUUID());acknowledged=Math.max(acknowledged,input.sequence);succeeded=true}
  catch{if(input.sequence===issued)latestSteer??=input}
  finally{steerInFlight--;if(succeeded&&latestSteer)void sendSteer()}
 }
 const controller={predictionLead:()=>Math.min(500,roundtrip/2),movementPending:()=>acknowledged<issued||movesPending>0,steer:input=>{window.eldervaleRecordActivity?.();latestSteer={...input,sequence:++issued};void sendSteer()},get lastError(){return commandError},command:(c,p)=>{window.eldervaleRecordActivity?.();const label=commandLabel(c),run=enqueue(c,p);return (label?loading.track(run,label):run).then(result=>{commandError='';return result}).catch(e=>{commandError=e.message;window.eldervaleWorldBridge.notice(e.message);return false})},refresh:()=>enqueue(),checkpoint:()=>enqueue().catch(()=>false),
  // Cosmetic commands (level-up fireworks) fail silently: no chat notice.
  quietCommand:(c,p)=>enqueue(c,p).then(r=>r??true).catch(()=>false)};window.eldervaleRealm=controller;
 await enqueue();const timer=setInterval(()=>{if(disposed)return;if(latestSteer)void sendSteer();else if(!pending&&!steerInFlight)void enqueue().catch(()=>{})},250);
 addEventListener('pagehide',()=>{disposed=true;clearInterval(timer)},{once:true});
 return controller;
}
