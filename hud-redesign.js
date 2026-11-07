export function installFantasyHUD(){
 let opened=null;const side=document.querySelector('#side');document.body.classList.add('fantasy-hud');const close=document.createElement('button');close.className='hud-panel-close';close.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';close.title='Collapse panel';close.setAttribute('aria-label','Collapse panel');side.append(close);const hide=()=>{opened=null;document.body.classList.remove('hud-panel-open','compact-panel-open');for(const b of side.querySelectorAll('[data-tab]'))b.setAttribute('aria-expanded','false')};close.onclick=hide;
 for(const b of side.querySelectorAll('[data-tab]')){const label=b.dataset.tab;b.title=label[0].toUpperCase()+label.slice(1);b.setAttribute('aria-label',b.title);b.setAttribute('aria-expanded','false');b.addEventListener('click',()=>{const was=opened===label;hide();if(!was){opened=label;document.body.classList.add('hud-panel-open');b.setAttribute('aria-expanded','true')}})}
 const map=document.querySelector('#map-widget'),north=document.createElement('span');north.className='map-north';north.textContent='N';north.setAttribute('aria-hidden','true');map.append(north);const mapButton=document.querySelector('#map-toggle');mapButton.setAttribute('aria-label','Open world map');mapButton.title='World map (M)';mapButton.type='button';mapButton.innerHTML='<svg class="map-toggle-icon" viewBox="0 0 32 32" aria-hidden="true"><path d="M3 8 11 5l10 3 8-3v19l-8 3-10-3-8 3z" fill="#e6d3a1" stroke="#2b2823" stroke-width="2" stroke-linejoin="round"/><path d="M11 5v19l10 3V8z" fill="#cbb37a"/><path d="M11 5v19M21 8v19" stroke="#6d5226" stroke-width="1.4"/><path d="M6 21q3-6 7-3t7-5" fill="none" stroke="#8a3a26" stroke-width="1.6" stroke-dasharray="2 1.6"/><path d="m22.5 10.5 3.5 3.5m0-3.5-3.5 3.5" stroke="#b8392b" stroke-width="2.2" stroke-linecap="round"/></svg>';
 addEventListener('keydown',e=>{if(e.key==='Escape')hide();if(isBagShortcut(e)){e.preventDefault();side.querySelector('[data-tab=inventory]')?.click()}});installChatDock();
}
// B (desktop, iPad keyboard) opens the bag, or collapses it when the bag is the open tab. Ignored while
// typing, with a modifier, or while the owner console or any other dialog is open.
export function isBagShortcut(event,doc=globalThis.document){
 if((event.code!=='KeyB'&&event.key?.toLowerCase?.()!=='b')||event.repeat||event.isComposing||event.ctrlKey||event.metaKey||event.altKey)return false;
 if(event.target?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),[role="textbox"],dialog')||doc?.activeElement?.closest?.('input,textarea,select,[contenteditable]:not([contenteditable="false"]),dialog'))return false;
 return !doc?.querySelector?.('dialog[open]')&&!doc?.body?.classList?.contains('landscape-required');
}
// Chat dock (bottom-left on every device). Phones (coarse pointer, short side under 600px) start with the
// chat minimised to its Chat button; tablets and desktops start with it open. The player's own choice is
// remembered per device class.
export function chatDeviceClass({coarse=false,touch=false,shortSide=1080}={}){return (coarse||touch)&&shortSide<600?'phone':'wide'}
export function chatStartsOpen(device,saved=null){return saved==='open'?true:saved==='closed'?false:device!=='phone'}
export function installChatDock({doc=globalThis.document,storage=null}={}){
 const panel=doc?.querySelector('#social-panel'),toggle=panel?.querySelector('#social-toggle');if(!panel||!toggle)return null;
 const device=chatDeviceClass({coarse:!!globalThis.matchMedia?.('(any-pointer:coarse)').matches,touch:(globalThis.navigator?.maxTouchPoints||0)>0,shortSide:Math.min(globalThis.screen?.width||1080,globalThis.screen?.height||1080)}),key='eldervale-chat-open-'+device;
 let store=storage,saved=null;try{store=store||globalThis.localStorage;saved=store?.getItem(key)??null}catch{store=null}
 const show=open=>{panel.classList.toggle('collapsed',!open);toggle.textContent=open?'−':'Chat';toggle.title=open?'Minimise chat':'Open chat';toggle.setAttribute('aria-label',toggle.title);toggle.setAttribute('aria-expanded',String(open))};
 show(chatStartsOpen(device,saved));
 toggle.onclick=null;toggle.addEventListener('click',()=>{const open=panel.classList.contains('collapsed');show(open);try{store?.setItem(key,open?'open':'closed')}catch{}});
 return {device,show};
}
