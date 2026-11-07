import {installOrientationGate} from './responsive.js?v=release-20261107-torch141';
import {loading as loadingUI} from './loading-indicator.js?v=release-20261107-torch141';
import {installCursorStates} from './cursors.js?v=release-20261107-torch141';installCursorStates();
installOrientationGate();
import {SEXES,SKINS,HAIRS,HAIRSTYLES,BEARDS,CLOTHING_VARIANTS,CLOTHING_LABELS,safeAppearance} from './appearance.js?v=release-20261107-torch141';
import {toPlayerRow,fromPlayerRow} from './player-save.js?v=release-20261107-torch141';
import {createSaveCoordinator} from './cloud-save.js?v=release-20261107-torch141';
import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
const db=createClient('https://aojccnhmvxurrnnzteej.supabase.co','sb_publishable_pfcppa_7V_9lvHsL1aAM8Q_px5bXnY8',{auth:{persistSession:true,storage:sessionStorage,autoRefreshToken:true,detectSessionInUrl:true}});
const overlay=document.querySelector('#auth-screen'),form=document.querySelector('#auth-form'),status=document.querySelector('#auth-status'),title=document.querySelector('#auth-title'),modeBtn=document.querySelector('#auth-mode'),username=document.querySelector('#auth-username'),email=document.querySelector('#auth-email'),password=document.querySelector('#auth-password');
let signup=false,user=null,pending=null,loading=false,saveTimer=null,started=false;
const setBusy=v=>{loading=v;document.body.classList.toggle('cursor-busy',v)};
function message(s){status.textContent=s||''}
function mode(v){signup=v;title.textContent=v?'Your legend starts here.':'Enter the Heartlands.';document.querySelector('#auth-username-field').hidden=!v;overlay.classList.toggle('login-username-visible',v);document.querySelector('#auth-login-tab').setAttribute('aria-pressed',String(!v));document.querySelector('#auth-create-tab').setAttribute('aria-pressed',String(v));password.autocomplete=v?'new-password':'current-password';username.hidden=!v;username.required=v;modeBtn.textContent=v?'Already have an account? Sign in':'New adventurer? Create an account';form.querySelector('button[type=submit]').textContent=v?'Create account':'Enter Eldervale';message('')}
modeBtn.onclick=()=>mode(!signup);document.querySelector('#auth-login-tab').onclick=()=>mode(false);document.querySelector('#auth-create-tab').onclick=()=>mode(true);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const toRow=s=>toPlayerRow(s,user);
const fromRow=fromPlayerRow;

function cloudStatus(text,error=false){const node=document.querySelector('#cloud-status');node.textContent=text;node.classList.toggle('save-error',error);node.classList.toggle('sr-only',!error);node.setAttribute('aria-live',error?'polite':'off')}
const saves=createSaveCoordinator({storage:localStorage,getUser:()=>user,readSave:()=>localStorage.getItem('eldervale-save'),onStatus:cloudStatus,writeRow:async row=>{if(window.eldervaleAuthority){if(!await window.eldervaleRealm?.checkpoint())throw Error('World checkpoint unavailable');return}const {error}=await db.from('player_saves').upsert(row,{onConflict:'user_id'});if(error)throw error}});
async function flush(){if(!user||!started)return false;const ok=await saves.flush();if(!ok&&started){clearTimeout(saveTimer);saveTimer=setTimeout(flush,12000)}return ok}
window.eldervaleSave=()=>{try{saves.stash()}catch{return}clearTimeout(saveTimer);saveTimer=setTimeout(flush,1500);cloudStatus('Saving…')};
addEventListener('pagehide',()=>{if(!started)return;window.eldervaleCaptureSave?.();try{saves.stash()}catch{}});
window.eldervaleReset=async()=>{if(!confirm('Reset your character progress? This cannot be undone.'))return;clearTimeout(saveTimer);started=false;const error=await window.eldervaleRealm?.command('reset')?null:Error('Reset failed');if(error){alert('Could not reset cloud save: '+error.message);started=true;return}localStorage.removeItem('eldervale-save');localStorage.removeItem('eldervale-pending-save:'+user.id);location.reload()};

async function customize(initial){const {createCharacterPreview}=await import('./character-preview.js?v=release-20261107-torch141');return new Promise(resolve=>{
 const a=safeAppearance(initial),screen=document.createElement('section');screen.id='character-creator';screen.innerHTML=`<div class="creator-card"><div class="creator-preview"><div class="creator-heading">ELDERVALE <span>CHARACTER CREATOR</span></div><div id="avatar-preview" aria-label="3D character preview"></div><p>Customize your adventurer before entering the world.</p></div><div class="creator-controls"><h2>Create your adventurer</h2><p>Choose the look you'll take into Eldervale.</p><div id="creator-options"></div><div id="creator-error" role="status"></div><button id="creator-finish">Begin Adventure</button></div></div>`;
 document.body.append(screen);
 const preview=createCharacterPreview(screen.querySelector('#avatar-preview'),a);
 const opts=screen.querySelector('#creator-options');
 // Small builders for the creator rows: swatch rows and labelled choices.
 const row=(label,id)=>{const r=document.createElement('div');r.className='creator-row';const l=document.createElement('label');l.textContent=label;if(id)l.htmlFor=id;r.append(l);opts.append(r);return r};
 const swatchRow=(key,label,values,colorOf=v=>v,name=v=>v)=>{const r=row(label),sw=document.createElement('div');sw.className='creator-swatches';for(const value of values){const b=document.createElement('button');b.type='button';b.className='creator-swatch';b.dataset.key=key;b.dataset.value=String(value);b.style.background=colorOf(value);b.setAttribute('aria-label',label+' '+name(value));b.title=name(value);b.onclick=()=>{a[key]=value;refresh()};sw.append(b)}r.append(sw);return r};
 const selectRow=(key,label,values,name=v=>v)=>{const r=row(label,'creator-'+key),input=document.createElement('select');input.id='creator-'+key;for(const v of values){const o=document.createElement('option');o.value=v;o.textContent=name(v);input.append(o)}input.value=a[key];input.onchange=()=>{a[key]=input.value;refresh()};r.append(input);return {row:r,input}};
 const body=selectRow('sex','Body',SEXES,v=>v==='female'?'Female':'Male');
 swatchRow('skin','Skin tone',SKINS);
 swatchRow('hairColor','Hair color',HAIRS);
 const hair=selectRow('hair','Hairstyle',HAIRSTYLES);
 const beard=selectRow('beard','Facial hair',BEARDS);
 const dye={1:'#7a5a3c',2:'#3b3b3e',3:'#40617f'};
 swatchRow('shirtVariant','Shirt color',CLOTHING_VARIANTS,v=>dye[v],v=>CLOTHING_LABELS[v]);
 swatchRow('pantsVariant','Pants color',CLOTHING_VARIANTS,v=>dye[v],v=>CLOTHING_LABELS[v]);
 function refresh(){
  Object.assign(a,safeAppearance(a));body.input.value=a.sex;hair.input.value=a.hair;beard.input.value=a.beard;
  beard.row.hidden=a.sex==='female';
  preview.update(a);
  screen.querySelectorAll('.creator-swatch').forEach(b=>b.classList.toggle('chosen',String(a[b.dataset.key])===b.dataset.value));
 }
 refresh();
 screen.querySelector('#creator-finish').onclick=()=>{preview.dispose();screen.remove();resolve({...a})};
 })}

async function enter(u){if(loading||started)return;setBusy(true);user=u;message('Loading your saved character…');const boot=(label,fraction,detail,until)=>loadingUI.bootProgress(label,fraction,detail,until);boot('Loading your saved character…',.05,'',.11);try{const worldAccess=await db.rpc('world_snapshot',{cursor_revision:9007199254740991});if(worldAccess.error)throw Error('World service unavailable: '+worldAccess.error.message);if(Date.parse(worldAccess.data.access?.banned_until)>Date.now())throw Error('Access suspended: '+worldAccess.data.access.reason);if(worldAccess.data.settings.maintenance&&!worldAccess.data.owner)throw Error('Eldervale is in maintenance mode. Please try again later.');window.eldervaleWorldConfig=worldAccess.data.settings.world_config||null;boot('Reading the map of Eldervale…',.12);const geography=await import('./geography.js?v=release-20261107-torch141');geography.initializeGeography(window.eldervaleWorldConfig);const playerName=u.user_metadata?.username;if(playerName&&/^[A-Za-z0-9_]{3,20}$/.test(playerName)){const profile=await db.from('player_profiles').upsert({user_id:u.id,username:playerName},{onConflict:'user_id'});if(profile.error)console.warn('Profile registration:',profile.error.message)}boot('Entering the realm…',.2,'',.29);const entered=await db.rpc('world_enter');const data=entered.data?.save,error=entered.error;window.eldervaleRealmSession=entered.data?.session;if(error)throw error;localStorage.removeItem('eldervale-save');localStorage.removeItem('ashen-realms-save');let character=data?fromRow(data):{},arrivalRow=data;const prologueModule=()=>import('./tutorial-prologue.js?v=release-20261107-torch141');if(!character.appearance){void prologueModule().catch(()=>{})/* fetch the arrival prologue while the player picks a look */;message('Choose your character appearance…');loadingUI.bootDone();character.appearance=await customize();boot('Creating your adventurer…',.25);const creation=await db.rpc('world_enter',{appearance:character.appearance});if(creation.error)throw creation.error;window.eldervaleRealmSession=creation.data.session;arrivalRow=creation.data.save;character=fromRow(creation.data.save);}localStorage.setItem('eldervale-save',JSON.stringify(character));
// New trainees see the arrival prologue now, while game.js and the world load behind it (tutorial-prologue.js).
if(arrivalRow)void prologueModule().then(m=>{if(m.wantsPrologue(arrivalRow)&&!window.eldervalePrologue)m.startPrologue()}).catch(e=>console.warn('Prologue:',e.message));message('Preparing the Heartlands…');boot('Preparing the Heartlands…',.3,'Loading the game world',.54);document.querySelector('#account-name').textContent=u.user_metadata?.username||u.email?.split('@')[0]||'Adventurer';started=true;window.eldervaleAuthority=true;await import('/game.js?v=release-20261107-torch141');boot('Connecting to the realm…',.55);const realm=await import('/realm-client.js?v=release-20261107-torch141');await realm.startRealm(db,u,window.eldervaleRealmSession);void import('/social.js?v=release-20261107-torch141').then(social=>social.startSocial(db,u)).catch(e=>console.warn('Social features unavailable:',e.message))/* chat loads alongside the world, not before it */;boot('Gathering nearby adventurers…',.62);const world=await import('/world-client.js?v=release-20261107-torch141');boot('Loading the nearby world…',.68,'',.9);window.eldervaleWorldLoading=true;overlay.hidden=true;await world.startWorld(db,u,{initial:worldAccess.data,flush,disconnect:async reason=>{sessionStorage.setItem('eldervale-world-disconnect',reason);await autoLogout('world')}});boot('Preparing nearby scenery…',.94);await window.eldervalePrepareScenery?.();window.eldervaleWorldLoading=false;window.eldervalePrologue?.release?.(10000);loadingUI.bootDone();overlay.hidden=true;document.activeElement?.blur?.();const canvas=document.querySelector('#world-canvas');if(canvas){canvas.tabIndex=0;canvas.focus({preventScroll:true})}}catch(e){loadingUI.bootDone();window.eldervaleWorldLoading=false;started=false;overlay.hidden=false;message('Unable to load your character: '+e.message);console.error(e)}finally{setBusy(false)}}
form.onsubmit=async e=>{e.preventDefault();if(loading)return;setBusy(true);message('Connecting…');const signInJob=loadingUI.begin('Signing in…');const address=email.value.trim(),secret=password.value;try{if(signup){const name=username.value.trim();if(!/^[A-Za-z0-9_]{3,20}$/.test(name))throw Error('Username must be 3–20 letters, numbers, or underscores.');const {data,error}=await db.auth.signUp({email:address,password:secret,options:{data:{username:name},emailRedirectTo:location.origin+'/'}});if(error)throw error;if(!data.session){mode(false);message('Account created. Check your email to confirm your address, then sign in.');return}const p=await db.from('player_profiles').upsert({user_id:data.user.id,username:name});if(p.error)console.warn('Profile creation:',p.error.message);signInJob.end();setBusy(false);await enter(data.user);return}else{const {data,error}=await db.auth.signInWithPassword({email:address,password:secret});if(error)throw error;signInJob.end();setBusy(false);await enter(data.user);return}}catch(err){message(err.message)}finally{signInJob.end();setBusy(false)}};
document.querySelector('#logout').onclick=async()=>{
 clearTimeout(saveTimer);window.eldervaleCaptureSave?.();
 if(!await flush()){document.querySelector('#logout').textContent='Retry logout';return}
 // Logging out cancels a pending trade request or open trade for both players.
 await Promise.race([window.eldervaleTradeCancel?.(),new Promise(r=>setTimeout(r,2000))]).catch(()=>{});
 const {error}=await db.auth.signOut();if(error){cloudStatus('Could not sign out — please retry',true);return}
 started=false;localStorage.removeItem('eldervale-save');localStorage.removeItem('ashen-realms-save');location.reload();
};
// Security: sessions survive refreshes in the same tab but not closing the tab.
// Supabase's default localStorage persists beyond browser closure, so use sessionStorage.
const IDLE_LIMIT_MS=5*60*1000;
let lastActivity=Date.now(),logoutInProgress=false,hiddenSince=document.hidden?Date.now():0;
function recordActivity(){if(!document.hidden)lastActivity=Date.now()}
for(const event of ['pointerdown','keydown','touchstart','wheel'])addEventListener(event,recordActivity,{passive:true});
// Player-issued world commands (walk, attack, trade, equip, steer) also count:
// a player can act through queued commands without fresh pointer/key events.
window.eldervaleRecordActivity=recordActivity;
async function autoLogout(reason){
 if(logoutInProgress||!user)return;
 logoutInProgress=true;clearTimeout(saveTimer);
 try{
  window.eldervaleCaptureSave?.();
  saves.stash();
  // Attempt cloud persistence before revoking the session; keep the local
  // snapshot if network access is unavailable.
  await Promise.race([flush(),new Promise(resolve=>setTimeout(resolve,2500))]);
 }catch(e){console.warn('Final save before auto logout:',e)}
 try{await db.auth.signOut({scope:'local'})}catch(e){console.warn('Auto logout:',e)}
 started=false;user=null;
 // Session tokens must not be available after inactivity even if signOut fails.
 for(const key of Object.keys(sessionStorage))if(/^sb-.*-auth-token$/.test(key))sessionStorage.removeItem(key);
 sessionStorage.setItem('eldervale-disconnect-reason',reason==='world'?'Disconnected — '+sessionStorage.getItem('eldervale-world-disconnect'):reason==='inactive'?'Disconnected — you were signed out after 5 minutes of inactivity. Please sign in again.':'Disconnected — please sign in again.');
 location.reload();
}
window.eldervaleSessionLost=reason=>{if(!user||logoutInProgress)return;sessionStorage.setItem('eldervale-world-disconnect',reason);void autoLogout('world')};
document.addEventListener('visibilitychange',()=>{
 if(document.hidden){hiddenSince=Date.now();try{window.eldervaleCaptureSave?.();saves.stash()}catch{}}
 else if(user){if(Date.now()-lastActivity>=IDLE_LIMIT_MS||hiddenSince&&Date.now()-hiddenSince>=IDLE_LIMIT_MS)void autoLogout('inactive');else recordActivity();hiddenSince=0}
});
setInterval(()=>{if(!user||logoutInProgress)return;const now=Date.now();if(now-lastActivity>=IDLE_LIMIT_MS||document.hidden&&hiddenSince&&now-hiddenSince>=IDLE_LIMIT_MS)void autoLogout('inactive')},10000);
addEventListener('pagehide',()=>{
 // A pagehide also fires during refresh: preserve same-tab reloads.
 // sessionStorage is discarded when the tab is closed, preventing auto-login.
 if(!user)return;
 try{window.eldervaleCaptureSave?.();saves.stash()}catch{}
});
const {data:{session}}=await db.auth.getSession();if(session?.user)await enter(session.user);else message('Sign in to continue your adventure.');
const disconnectReason=sessionStorage.getItem('eldervale-disconnect-reason');if(!session?.user&&disconnectReason){const notice=document.createElement('p');notice.id='disconnect-notice';notice.setAttribute('role','status');notice.textContent=disconnectReason;notice.style.cssText='max-width:420px;margin:0;color:#e3c38b;text-align:center;font:13px/1.5 Arial';document.querySelector('.login-footer').append(notice);sessionStorage.removeItem('eldervale-disconnect-reason')}
