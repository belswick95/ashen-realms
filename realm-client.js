// One ordered stream of authenticated intents and server-confirmed snapshots.
export async function startRealm(db,user,session){
 let cursor=0,first=true,queue=Promise.resolve(),disposed=false,failures=0,offset=0,pending=0;
 const badge=document.createElement('output');badge.id='realm-connection';badge.setAttribute('role','status');badge.style.cssText='position:fixed;top:42px;left:50%;transform:translateX(-50%);z-index:250;background:#25271d;color:#f4d899;padding:7px 12px;border-radius:5px';badge.hidden=true;document.body.append(badge);
 async function request(command='sync',payload={},id=null){
  const {data,error}=await db.rpc('world_command',{session_id:session,command,payload,request_id:id,event_cursor:cursor});
  if(error){badge.hidden=false;badge.textContent='World connection: '+error.message;failures++;throw Error(error.message)}
  if(data.reset)return true;
  offset=Date.parse(data.time)-Date.now();window.eldervaleServerTime=()=>Date.now()+offset;badge.hidden=true;failures=0;
  window.eldervaleRealmBridge.snapshot(data,user.id);if(!first)for(const event of data.events||[])window.eldervaleRealmBridge.event(event.data,user.id);first=false;cursor=Math.max(cursor,Number(data.eventCursor)||0);return true;
 }
 function enqueue(command='sync',payload={}){const id=command==='sync'?null:crypto.randomUUID();pending++;const result=queue.then(()=>request(command,payload,id));queue=result.catch(()=>{}).finally(()=>pending--);return result;}
 let commandError='';let latestSteer=null,steerPending=false;async function sendSteer(){if(steerPending)return;steerPending=true;try{while(latestSteer){const input=latestSteer;latestSteer=null;await enqueue('steer',input)}}catch{}finally{steerPending=false}}
 const controller={movementPending:()=>steerPending||latestSteer!==null,steer:input=>{latestSteer=input;void sendSteer()},get lastError(){return commandError},command:(c,p)=>enqueue(c,p).then(result=>{commandError='';return result}).catch(e=>{commandError=e.message;window.eldervaleWorldBridge.notice(e.message);return false}),refresh:()=>enqueue(),checkpoint:()=>enqueue().catch(()=>false)};window.eldervaleRealm=controller;
 await enqueue();const timer=setInterval(()=>{if(!disposed&&!pending)void enqueue().catch(()=>{})},250);
 addEventListener('pagehide',()=>{disposed=true;clearInterval(timer)},{once:true});
 return controller;
}
