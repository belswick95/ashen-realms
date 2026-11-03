import {registerWorldItems} from './economy.js?v=release-20261103-gait18';
export async function startWorld(db,user,{initial,flush,disconnect}){
 let snapshot=initial,cursor=-1,polling=false,offset=0,initialized=false,restarting=false,startedAt=Date.parse(initial?.serverTime)||Date.now(),restartSeen=null,lastAnnouncement='',panel=null,stopped=false;
 let lastSyncError=null;
 const banner=document.createElement('output');banner.id='world-announcement';banner.setAttribute('aria-live','polite');banner.style.cssText='position:fixed;top:54px;left:50%;transform:translateX(-50%);z-index:190;max-width:min(650px,85vw);padding:10px 18px;background:#162521f2;border:1px solid #c5a366;border-radius:8px;color:#f3dba1;text-align:center;font:14px/1.5 Georgia;pointer-events:none';banner.hidden=true;document.body.append(banner);
 const rpc=async(name,args={})=>{const r=await db.rpc(name,args);if(r.error)throw Error(r.error.message);return r.data};
 async function deliver(delivery){if(window.eldervaleAuthority){await window.eldervaleRealm.refresh();return}window.eldervaleWorldBridge.grant(delivery);if(!await flush())throw Error('Delivery kept locally until the character save succeeds');await rpc('world_ack',{delivery_id:delivery.id})}
 async function refresh(){if(polling||stopped)return;polling=true;try{
  snapshot=await rpc('world_snapshot',{cursor_revision:cursor});lastSyncError=null;offset=Date.parse(snapshot.serverTime)-Date.now();
  registerWorldItems(snapshot.catalog);const access=snapshot.access,now=Date.now()+offset;
  if(Date.parse(access?.banned_until)>now){stopped=true;await disconnect('Access suspended: '+access.reason);return}
  if(Date.parse(access?.kicked_at)>startedAt){stopped=true;await disconnect('Removed by the owner: '+access.reason);return}
  if(snapshot.settings.maintenance&&!snapshot.owner){stopped=true;await disconnect('Eldervale is in maintenance mode. Please try again later.');return}
  await window.eldervaleWorldBridge.apply(snapshot.entities||[]);cursor=snapshot.settings.revision;
  if(!initialized){initialized=true;if(snapshot.settings.welcome)window.eldervaleWorldBridge.notice(snapshot.settings.welcome)}
  const at=snapshot.settings.restart_at;if(at&&Date.parse(at)>now)restartSeen=at;if(!at)restartSeen=null;
  if(snapshot.settings.announcement!==lastAnnouncement&&Date.parse(snapshot.settings.announcement_until)>now){lastAnnouncement=snapshot.settings.announcement;window.eldervaleWorldBridge.notice(lastAnnouncement)}
  if(Date.parse(access?.muted_until)>now){window.eldervaleMutedUntil=access.muted_until}else window.eldervaleMutedUntil=null;
  for(const delivery of snapshot.deliveries||[])await deliver(delivery);
  panel?.sync(snapshot);if(snapshot.removedActors)window.eldervaleRemovedActors?.(snapshot.removedActors);document.querySelector('#world-connection-state')?.remove();
 }catch(e){lastSyncError=e;console.warn('World sync:',e.message);if(panel)panel.connection(e.message)}finally{polling=false}}
 async function action(command,payload={}){const result=await rpc('world_admin',{command,payload});await refresh();return result}
 window.eldervaleWorldPickup=async id=>{try{window.eldervaleWorldBridge.capture();if(!await flush())throw Error('Save your position before collecting this item');const delivery=await rpc('world_pickup',{entity_id:id});await deliver(delivery);await refresh()}catch(e){window.eldervaleWorldBridge.notice(e.message)}};
 function tick(){if(stopped)return;const now=Date.now()+offset,s=snapshot?.settings;if(!s)return;const remaining=restartSeen?Math.max(0,Math.ceil((Date.parse(restartSeen)-now)/1000)):null;
 const text=remaining!==null?'World restart in '+remaining+'s — progress will be saved.':s.maintenance?'MAINTENANCE · Owner building session':Date.parse(s.announcement_until)>now?s.announcement:'';banner.textContent=text;banner.hidden=!text;
 if(remaining===0&&!restarting){restarting=true;window.eldervaleWorldBridge.capture();void flush().then(ok=>{if(ok)location.reload();else{restarting=false;banner.textContent='Reconnecting paused — waiting for your character to save.'}})}
 }
 await refresh();if(!initialized)throw lastSyncError||Error('World access is unavailable');
 if(snapshot?.owner||snapshot?.staffRole==='moderator'){const {createAdminPanel}=await import('./admin-panel.js?v=release-20261103-gait18');panel=createAdminPanel({userId:user.id,rpc,action,refresh,snapshot,bridge:window.eldervaleWorldBridge})}
 const report=document.createElement('button');report.type='button';report.textContent='Report a player';report.id='world-report-button';report.style.cssText='position:fixed;bottom:4px;left:50%;transform:translateX(-50%);z-index:95;font:11px Arial;padding:4px 8px;background:#182620;color:#c8ba9a;border:1px solid #80704c;border-radius:4px';document.body.append(report);
 report.onclick=()=>{const form=document.createElement('dialog');form.innerHTML='<form method="dialog"><h2>Report a player</h2><label>Player ID (optional)<input name="target" maxlength="36"></label><label>What happened?<textarea name="body" required minlength="5" maxlength="1000"></textarea></label><p role="status"></p><button type="submit">Send report</button><button type="button" data-close>Cancel</button></form>';document.body.append(form);form.querySelector('[data-close]').onclick=()=>form.close();form.addEventListener('close',()=>form.remove());form.querySelector('form').onsubmit=async e=>{e.preventDefault();try{await rpc('world_report',{target_id:form.querySelector('[name=target]').value.trim()||null,report_text:form.querySelector('textarea').value});form.close();window.eldervaleWorldBridge.notice('Report sent to the owner.')}catch(err){form.querySelector('[role=status]').textContent=err.message}};form.showModal()};
 const timer=setInterval(()=>void refresh(),4000),clock=setInterval(tick,250);addEventListener('pagehide',()=>{stopped=true;clearInterval(timer);clearInterval(clock)},{once:true});return {refresh,action};
}
