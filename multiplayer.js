import {publicCharacter} from './character-display.js?v=release-20261107-emotes143';

const validId=value=>typeof value==='string'&&value.length>0&&value.length<160;
function playerState(value){
 if(!value||!validId(value.id)||!validId(value.session)||!Number.isFinite(value.x)||!Number.isFinite(value.z)||Math.abs(value.x)>4500||Math.abs(value.z)>4500)return null;
 return {id:value.id,session:value.session,username:String(value.username||'Adventurer').slice(0,24),x:value.x,z:value.z,yaw:Number.isFinite(value.yaw)?value.yaw:0,combatLevel:Math.max(1,Math.min(126,Math.floor(value.combatLevel||1))),sequence:Number.isSafeInteger(value.sequence)?value.sequence:0,...publicCharacter(value.appearance,value.loadout)};
}

// Presence establishes membership once. Broadcast updates only that member's
// position; an old presence snapshot must not rewind a moving avatar.
export function createPlayerRoster(selfId){
 let clock=0;const members=new Map(),states=new Map();
 function snapshot(){const players=new Map();for(const [session,state] of states){if(!members.has(session)||state.id===selfId)continue;const previous=players.get(state.id);if(!previous||state.received>previous.received)players.set(state.id,state)}return [...players.values()].map(({received,...state})=>state)}
 return {snapshot,clear(){members.clear();states.clear()},sync(presence){
  const seen=new Set();
  for(const [session,entries] of Object.entries(presence||{})){
   if(!validId(session)||!Array.isArray(entries))continue;
   const entry=entries.at(-1),state=playerState({...entry,id:entry?.id||session,session});if(!state)continue;
   seen.add(session);members.set(session,{id:state.id,username:state.username});
   if(!states.has(session))states.set(session,{...state,received:++clock});
  }
  for(const session of members.keys())if(!seen.has(session)){members.delete(session);states.delete(session)}
  return snapshot();
 },receive(payload){
  const state=playerState(payload),member=state&&members.get(state.session);if(!member||member.id!==state.id)return false;
  const previous=states.get(state.session);if(previous&&state.sequence<=previous.sequence)return false;
  states.set(state.session,{...state,username:member.username,received:++clock});return true;
 }};
}

export function startMultiplayer({db,user,getPosition,onPlayers,onStatus=()=>{},topic='eldervale-world-presence',events=globalThis,document=globalThis.document,now=()=>Date.now(),setInterval=globalThis.setInterval,clearInterval=globalThis.clearInterval,setTimeout=globalThis.setTimeout,clearTimeout=globalThis.clearTimeout,sessionId}={}){
 const session=sessionId||user.id+':'+(globalThis.crypto?.randomUUID?.()||Math.random().toString(36).slice(2));
 const username=user.user_metadata?.username||'Adventurer',roster=createPlayerRoster(user.id);
 let channel=null,generation=0,ready=false,disposed=false,suspended=false,retry=null,attempt=0,sequence=0,lastSent=0,lastSignature='',sending=false,failures=0;
 function status(state,detail=''){onStatus({state,players:roster.snapshot().length+1,detail})}
 function render(){onPlayers(roster.snapshot());if(ready)status('connected')}
 function packet(){const position=getPosition?.();return position?playerState({...position,id:user.id,session,username,sequence:++sequence}):null}
 async function publish(force=false){
  if(!ready||sending||disposed||suspended)return;
  const payload=packet();if(!payload)return;
  const signature=JSON.stringify({...payload,sequence:0});if(!force&&signature===lastSignature&&now()-lastSent<3000)return;
  const active=channel,epoch=generation;sending=true;lastSent=now();
  try{const result=await active.send({type:'broadcast',event:'player-state',payload});if(disposed||epoch!==generation)return;if(result!=='ok')throw Error('Position update not acknowledged');lastSignature=signature;failures=0}
  catch{if(epoch===generation&&++failures>=3)reconnect('Movement updates interrupted')}
  finally{if(epoch===generation)sending=false}
 }
 function reconnect(detail='',cooldown=0){
  if(disposed||suspended||retry)return;
  ready=false;roster.clear();onPlayers([]);status('reconnecting',detail);
  // Closed channels do not reliably rejoin themselves. Remove them, then make
  // one fresh subscription with backoff instead of repeatedly calling track().
  const old=channel;channel=null;generation++;sending=false;if(old)Promise.resolve(db.removeChannel(old)).catch(()=>{});
  const delay=Math.max(cooldown,Math.min(30000,1000*2**Math.min(attempt++,5)));
  retry=setTimeout(()=>{retry=null;connect()},delay);
 }
 function connect(){
  if(disposed||suspended)return;const epoch=++generation;
  status(attempt?'reconnecting':'connecting');
  const active=db.channel(topic,{config:{presence:{key:session},broadcast:{self:false,ack:true}}});channel=active;
  active.on('presence',{event:'sync'},()=>{if(epoch!==generation)return;roster.sync(active.presenceState());render()});
  active.on('broadcast',{event:'player-state'},({payload})=>{if(epoch===generation&&roster.receive(payload))render()});
  active.on('system',{},message=>{if(epoch!==generation||message.status!=='error')return;const detail=String(message.message||'World connection interrupted');reconnect(detail,/presence.*rate|rate.*presence/i.test(detail)?60000:0)});
  active.subscribe(async state=>{
   if(disposed||epoch!==generation)return;
   if(state==='SUBSCRIBED'){
    const initial=packet();if(!initial){reconnect('Player is still loading');return}
    try{const result=await active.track(initial);if(disposed||epoch!==generation)return;if(result!=='ok'){reconnect('Unable to announce player');return}ready=true;attempt=0;failures=0;render();publish(true)}catch{if(epoch===generation)reconnect('Unable to announce player')}
   }else if(['CHANNEL_ERROR','TIMED_OUT','CLOSED'].includes(state))reconnect('World connection interrupted');
  });
 }
 function suspend(){suspended=true;ready=false;generation++;sending=false;if(retry){clearTimeout(retry);retry=null}const old=channel;channel=null;if(old)Promise.resolve(db.removeChannel(old)).catch(()=>{});roster.clear();onPlayers([]);status('offline')}
 function resume(){if(disposed)return;if(suspended){suspended=false;connect()}else if(ready)publish(true);else if(!retry)reconnect('Rejoining the world')}
 const onPageHide=event=>{if(event.persisted)suspend();else dispose()};
 const onPageShow=event=>{if(event.persisted)resume()};
 const onVisible=()=>{if(document?.visibilityState==='visible')resume()};
 const onOffline=()=>{suspend()};
 function dispose(){if(disposed)return;suspend();disposed=true;clearInterval(timer);for(const [event,handler] of listeners)events.removeEventListener?.(event,handler);document?.removeEventListener?.('visibilitychange',onVisible)}
 const listeners=[['pagehide',onPageHide],['pageshow',onPageShow],['online',resume],['offline',onOffline]];
 for(const [event,handler] of listeners)events.addEventListener?.(event,handler);document?.addEventListener?.('visibilitychange',onVisible);
 const timer=setInterval(()=>publish(),250);connect();
 return {dispose,reconnect:()=>reconnect('Rejoining the world'),snapshot:roster.snapshot};
}
