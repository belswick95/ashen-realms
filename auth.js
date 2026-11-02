import {createClient} from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm';
const db=createClient('https://aojccnhmvxurrnnzteej.supabase.co','sb_publishable_pfcppa_7V_9lvHsL1aAM8Q_px5bXnY8',{auth:{persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
const overlay=document.querySelector('#auth-screen'),form=document.querySelector('#auth-form'),status=document.querySelector('#auth-status'),title=document.querySelector('#auth-title'),modeBtn=document.querySelector('#auth-mode'),username=document.querySelector('#auth-username'),email=document.querySelector('#auth-email'),password=document.querySelector('#auth-password');
let signup=false,user=null,pending=null,loading=false,saveTimer=null,started=false;
function message(s){status.textContent=s||''}
function mode(v){signup=v;title.textContent=v?'Create your Eldervale account':'Welcome to Eldervale';username.hidden=!v;username.required=v;modeBtn.textContent=v?'Already have an account? Sign in':'New adventurer? Create an account';form.querySelector('button[type=submit]').textContent=v?'Create account':'Enter Eldervale';message('')}
modeBtn.onclick=()=>mode(!signup);
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
function toRow(s){return {user_id:user.id,character_name:user.user_metadata?.username||'Adventurer',level:Math.max(1,Math.floor(s.level||1)),xp:Math.max(0,Math.floor(s.combatXP||0)),gold:Math.max(0,Math.floor(s.gold||0)),health:Math.max(0,Math.floor(s.hp??100)),max_health:100,world_position:{x:Number(s.x)||0,y:Number(s.z)||0},stats:{wood:s.wood||0,ore:s.ore||0,woodXP:s.woodXP||0,miningXP:s.miningXP||0,kills:s.kills||0},inventory:{armorOwned:s.armorOwned||[]},equipment:s.equipped||{},skills:{},quests:{},game_flags:{appearance:s.appearance||null}}}
function fromRow(r){return {x:r.world_position?.x||0,z:r.world_position?.y||0,hp:r.health,combatXP:r.xp,kills:r.stats?.kills||0,gold:r.gold,wood:r.stats?.wood||0,ore:r.stats?.ore||0,woodXP:r.stats?.woodXP||0,miningXP:r.stats?.miningXP||0,armorOwned:r.inventory?.armorOwned||[],equipped:r.equipment||{},appearance:r.game_flags?.appearance||null}}
async function flush(){if(!user||!started)return;const raw=localStorage.getItem('eldervale-save');if(!raw)return;try{const {error}=await db.from('player_saves').upsert(toRow(JSON.parse(raw)),{onConflict:'user_id'});if(error)throw error;document.querySelector('#cloud-status').textContent='Saved to cloud';}catch(e){document.querySelector('#cloud-status').textContent='Save failed — retrying';console.error('Eldervale cloud save:',e);setTimeout(flush,12000)}}
window.eldervaleSave=()=>{clearTimeout(saveTimer);saveTimer=setTimeout(flush,1500);document.querySelector('#cloud-status').textContent='Saving…'};
window.eldervaleReset=async()=>{if(!confirm('Reset your character progress? This cannot be undone.'))return;clearTimeout(saveTimer);started=false;const {error}=await db.from('player_saves').delete().eq('user_id',user.id);if(error){alert('Could not reset cloud save: '+error.message);started=true;return}localStorage.removeItem('eldervale-save');location.reload()};

const SKINS=['#f2c9a4','#d9a67e','#b97f58','#945d3f','#6c412f','#402a24'];
const HAIRS=['#211b18','#5b3c28','#9b6337','#d3ae65','#c0b5a3','#763b32'];
const SHIRTS=['#297e52','#356b9b','#9c403c','#d6b46d','#564b84','#292d30'];
const PANTS=['#232327','#43516b','#6b513e','#78806c','#353c37','#8d8b84'];
const HAIRSTYLES=['Short crop','Side swept','Spiky','Buzz cut','Long'];
const appearanceDefaults={skin:SKINS[1],hairColor:HAIRS[1],shirt:SHIRTS[0],pants:PANTS[0],hair:'Side swept'};
function safeAppearance(a={}){const o={...appearanceDefaults};for(const [key,palette] of [['skin',SKINS],['hairColor',HAIRS],['shirt',SHIRTS],['pants',PANTS]])if(palette.includes(a[key]))o[key]=a[key];if(HAIRSTYLES.includes(a.hair))o.hair=a.hair;return o}
async function customize(initial){const {createCharacterPreview}=await import('./character-preview.js');return new Promise(resolve=>{
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

async function enter(u){if(loading||started)return;loading=true;user=u;message('Loading your saved character…');try{const playerName=u.user_metadata?.username;if(playerName&&/^[A-Za-z0-9_]{3,20}$/.test(playerName)){const profile=await db.from('player_profiles').upsert({user_id:u.id,username:playerName},{onConflict:'user_id'});if(profile.error)console.warn('Profile registration:',profile.error.message)}const {data,error}=await db.from('player_saves').select('*').eq('user_id',u.id).maybeSingle();if(error)throw error;localStorage.removeItem('eldervale-save');localStorage.removeItem('ashen-realms-save');let character=data?fromRow(data):{};if(!character.appearance){message('Choose your character appearance…');character.appearance=await customize();const {error:saveError}=await db.from('player_saves').upsert(toRow(character),{onConflict:'user_id'});if(saveError)throw saveError;}localStorage.setItem('eldervale-save',JSON.stringify(character));overlay.hidden=true;document.querySelector('#account-name').textContent=u.user_metadata?.username||u.email?.split('@')[0]||'Adventurer';started=true;await import('/game.js');const social=await import('/social.js');social.startSocial(db,u);const music=await import('/music.js');music.startMusic();}catch(e){message('Unable to load your character: '+e.message);console.error(e)}finally{loading=false}}
form.onsubmit=async e=>{e.preventDefault();if(loading)return;loading=true;message('Connecting…');const address=email.value.trim(),secret=password.value;try{if(signup){const name=username.value.trim();if(!/^[A-Za-z0-9_]{3,20}$/.test(name))throw Error('Username must be 3–20 letters, numbers, or underscores.');const {data,error}=await db.auth.signUp({email:address,password:secret,options:{data:{username:name},emailRedirectTo:'https://eldervale.vercel.app/'}});if(error)throw error;if(!data.session){mode(false);message('Account created. Check your email to confirm your address, then sign in.');return}const p=await db.from('player_profiles').upsert({user_id:data.user.id,username:name});if(p.error)console.warn('Profile creation:',p.error.message);loading=false;await enter(data.user);return}else{const {data,error}=await db.auth.signInWithPassword({email:address,password:secret});if(error)throw error;loading=false;await enter(data.user);return}}catch(err){message(err.message)}finally{loading=false}};
document.querySelector('#logout').onclick=async()=>{clearTimeout(saveTimer);await flush();started=false;await db.auth.signOut();localStorage.removeItem('eldervale-save');localStorage.removeItem('ashen-realms-save');location.reload()};
const {data:{session}}=await db.auth.getSession();if(session?.user)await enter(session.user);else message('Sign in to continue your adventure.');