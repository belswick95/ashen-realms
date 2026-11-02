import {startMusic} from './music.js?v=release-20261102-gripfix7';
import {installOrientationGate} from './responsive.js?v=release-20261102-gripfix7';
installOrientationGate();
import {SKINS,HAIRS,SHIRTS,PANTS,HAIRSTYLES,FACES,BEARDS,safeAppearance} from './appearance.js?v=release-20261102-gripfix7';
import {toPlayerRow,fromPlayerRow} from './player-save.js?v=release-20261102-gripfix7';
import {createSaveCoordinator} from './cloud-save.js?v=release-20261102-gripfix7';
import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0/+esm';
const db=createClient('https://aojccnhmvxurrnnzteej.supabase.co','sb_publishable_pfcppa_7V_9lvHsL1aAM8Q_px5bXnY8',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const overlay=document.querySelector('#auth-screen'),form=document.querySelector('#auth-form'),status=document.querySelector('#auth-status'),title=document.querySelector('#auth-title'),modeBtn=document.querySelector('#auth-mode'),username=document.querySelector('#auth-username'),email=document.querySelector('#auth-email'),password=document.querySelector('#auth-password');
let signup=false,user=null,pending=null,loading=false,saveTimer=null,started=false;
// Initialize audio while the login screen is visible so the first user gesture
// can unlock playback before authentication finishes.
startMusic();
function message(s){status.textContent=s||''}
function mode(v){signup=v;title.textContent=v?'Create your Eldervale account':'Welcome to Eldervale';username.hidden=!v;username.required=v;modeBtn.textContent=v?'Already have an account? Sign in':'New adventurer? Create an account';form.querySelector('button[type=submit]').textContent=v?'Create account':'Enter Eldervale';message('')}
modeBtn.onclick=()=>mode(!signup);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const toRow=s=>toPlayerRow(s,user);
const fromRow=fromPlayerRow;

function cloudStatus(text,error=false){const node=document.querySelector('#cloud-status');node.textContent=text;node.classList.toggle('save-error',error);node.classList.toggle('sr-only',!error);node.setAttribute('aria-live',error?'polite':'off')}
const saves=createSaveCoordinator({storage:localStorage,getUser:()=>user,readSave:()=>localStorage.getItem('eldervale-save'),onStatus:cloudStatus,writeRow:async row=>{const {error}=await db.from('player_saves').upsert(row,{onConflict:'user_id'});if(error)throw error}});
async function flush(){if(!user||!started)return false;const ok=await saves.flush();if(!ok&&started){clearTimeout(saveTimer);saveTimer=setTimeout(flush,12000)}return ok}
window.eldervaleSave=()=>{try{saves.stash()}catch{return}clearTimeout(saveTimer);saveTimer=setTimeout(flush,1500);cloudStatus('Saving…')};
addEventListener('pagehide',()=>{if(!started)return;window.eldervaleCaptureSave?.();try{saves.stash()}catch{}});
window.eldervaleReset=async()=>{if(!confirm('Reset your character progress? This cannot be undone.'))return;clearTimeout(saveTimer);started=false;const {error}=await db.from('player_saves').delete().eq('user_id',user.id);if(error){alert('Could not reset cloud save: '+error.message);started=true;return}localStorage.removeItem('eldervale-save');localStorage.removeItem('eldervale-pending-save:'+user.id);location.reload()};

async function customize(initial){const {createCharacterPreview}=await import('./character-preview.js?v=release-20261102-gripfix7');return new Promise(resolve=>{
 const a=safeAppearance(initial),screen=document.createElement('section');screen.id='character-creator';screen.innerHTML=`<div class="creator-card"><div class="creator-preview"><div class="creator-heading">ELDERVALE <span>CHARACTER CREATOR</span></div><div id="avatar-preview" aria-label="3D character preview"></div><p>Customize your adventurer before entering the world.</p></div><div class="creator-controls"><h2>Create your adventurer</h2><p>Choose the look you'll take into Eldervale.</p><div id="creator-options"></div><div id="creator-error" role="status"></div><button id="creator-finish">Begin Adventure</button></div></div>`;
 document.body.append(screen);
 const preview=createCharacterPreview(screen.querySelector('#avatar-preview'),a);
 const opts=screen.querySelector('#creator-options');
 for(const [key,label,colors] of [['skin','Skin tone',SKINS],['hairColor','Hair color',HAIRS],['shirt','Shirt color',SHIRTS],['pants','Pants color',PANTS]]){
  const row=document.createElement('div');row.className='creator-row';const heading=document.createElement('label');heading.textContent=label;row.append(heading);
  const swatches=document.createElement('div');swatches.className='creator-swatches';
  for(const color of colors){const btn=document.createElement('button');btn.type='button';btn.className='creator-swatch';btn.style.background=color;btn.setAttribute('aria-label',label+' '+color);btn.onclick=()=>{a[key]=color;refresh()};swatches.append(btn)}row.append(swatches);opts.append(row);
 }
 const hairRow=document.createElement('div');hairRow.className='creator-row';hairRow.innerHTML='<label for="creator-hair">Hairstyle</label>';const select=document.createElement('select');select.id='creator-hair';for(const h of HAIRSTYLES){const o=document.createElement('option');o.value=o.textContent=h;select.append(o)}select.value=a.hair;select.onchange=()=>{a.hair=select.value;refresh()};hairRow.append(select);opts.prepend(hairRow);
 for(const [key,label,values] of [['face','Face shape',FACES],['beard','Facial hair',BEARDS]]){
  const row=document.createElement('div');row.className='creator-row';const caption=document.createElement('label');caption.htmlFor='creator-'+key;caption.textContent=label;const input=document.createElement('select');input.id='creator-'+key;
  for(const value of values){const option=document.createElement('option');option.value=option.textContent=value;input.append(option)}input.value=a[key];input.onchange=()=>{a[key]=input.value;refresh()};row.append(caption,input);opts.append(row);
 }
 function refresh(){
  preview.update(a);
  screen.querySelectorAll('.creator-swatch').forEach(btn=>{
   const row=btn.closest('.creator-row'),label=row.querySelector('label')?.textContent;
   const key={'Skin tone':'skin','Hair color':'hairColor','Shirt color':'shirt','Pants color':'pants'}[label];
   const sample=document.createElement('span');sample.style.color=a[key];
   btn.classList.toggle('chosen',btn.style.backgroundColor===sample.style.color);
  });
 }
 refresh();
 screen.querySelector('#creator-finish').onclick=()=>{preview.dispose();screen.remove();resolve({...a})};
 })}

async function enter(u){if(loading||started)return;loading=true;user=u;message('Loading your saved character…');try{const playerName=u.user_metadata?.username;if(playerName&&/^[A-Za-z0-9_]{3,20}$/.test(playerName)){const profile=await db.from('player_profiles').upsert({user_id:u.id,username:playerName},{onConflict:'user_id'});if(profile.error)console.warn('Profile registration:',profile.error.message)}const {data,error}=await db.from('player_saves').select('*').eq('user_id',u.id).maybeSingle();if(error)throw error;localStorage.removeItem('eldervale-save');localStorage.removeItem('ashen-realms-save');let character=saves.pending(u.id)||(data?fromRow(data):{});if(!character.appearance){message('Choose your character appearance…');character.appearance=await customize();const {error:saveError}=await db.from('player_saves').upsert(toRow(character),{onConflict:'user_id'});if(saveError)throw saveError;}localStorage.setItem('eldervale-save',JSON.stringify(character));message('Preparing the Heartlands…');document.querySelector('#account-name').textContent=u.user_metadata?.username||u.email?.split('@')[0]||'Adventurer';started=true;await import('/game.js?v=release-20261102-gripfix7');try{const social=await import('/social.js?v=release-20261102-gripfix7');social.startSocial(db,u)}catch(e){console.warn('Social features unavailable:',e.message)}overlay.hidden=true;}catch(e){started=false;overlay.hidden=false;message('Unable to load your character: '+e.message);console.error(e)}finally{loading=false}}
form.onsubmit=async e=>{e.preventDefault();if(loading)return;loading=true;message('Connecting…');const address=email.value.trim(),secret=password.value;try{if(signup){const name=username.value.trim();if(!/^[A-Za-z0-9_]{3,20}$/.test(name))throw Error('Username must be 3–20 letters, numbers, or underscores.');const {data,error}=await db.auth.signUp({email:address,password:secret,options:{data:{username:name},emailRedirectTo:location.origin+'/'}});if(error)throw error;if(!data.session){mode(false);message('Account created. Check your email to confirm your address, then sign in.');return}const p=await db.from('player_profiles').upsert({user_id:data.user.id,username:name});if(p.error)console.warn('Profile creation:',p.error.message);loading=false;await enter(data.user);return}else{const {data,error}=await db.auth.signInWithPassword({email:address,password:secret});if(error)throw error;loading=false;await enter(data.user);return}}catch(err){message(err.message)}finally{loading=false}};
document.querySelector('#logout').onclick=async()=>{
 clearTimeout(saveTimer);window.eldervaleCaptureSave?.();
 if(!await flush()){document.querySelector('#logout').textContent='Retry logout';return}
 const {error}=await db.auth.signOut();if(error){cloudStatus('Could not sign out — please retry',true);return}
 started=false;localStorage.removeItem('eldervale-save');localStorage.removeItem('ashen-realms-save');location.reload();
};
const {data:{session}}=await db.auth.getSession();if(session?.user)await enter(session.user);else message('Sign in to continue your adventure.');