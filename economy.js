import {adventureItems} from './adventure-catalog.js?v=release-20261106-boss108';
import {meshItemIcon} from './item-appearance.js?v=release-20261106-boss108';
import {createBankView} from './bank-ui.js?v=release-20261106-boss108';
import {morphChildren,setText} from './ui-stable.js?v=release-20261106-boss108';
import {noteId,bankNoteDescriptor} from './bank-notes.js?v=release-20261106-boss108';
import {professionItems} from './profession-data.js?v=release-20261106-boss108';
import {professionIcon} from './profession-icons.js?v=release-20261106-boss108';
import {mountCatalog} from './mounts.js?v=release-20261106-boss108';
import {itemIcons} from './item-icons.js?v=release-20261106-boss108';
import {fishingItems} from './fishing.js?v=release-20261106-boss108';
import {foodItems} from './food.js?v=release-20261106-boss108';import {extraFishItems} from './fish-tiers.js?v=release-20261106-boss108';
import {weaponCatalog,iconForWeapon} from './weapons.js?v=release-20261106-boss108';
import {shieldCatalog} from './shields.js?v=release-20261106-boss108';
import {jewelryCatalog} from './jewelry.js?v=release-20261106-boss108';
import {armorCatalog} from './melee-stats.js?v=release-20261106-boss108';
export const goods={...adventureItems,...foodItems,...extraFishItems,...fishingItems,wood:{name:'Logs',buy:6,sell:3,icon:'<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M6 34l-3-10q7-7 14-1l3 11" fill="#755034" stroke="#493322" stroke-width="1.5"/><ellipse cx="13" cy="34" rx="8" ry="7" fill="#c8a36e" stroke="#5d4028" stroke-width="1.5"/><ellipse cx="13" cy="34" rx="4.5" ry="3.8" fill="none" stroke="#937044"/><path d="m11 33 3 2" stroke="#937044"/><path d="M27 34l-3-10q7-7 14-1l3 11" fill="#755034" stroke="#493322" stroke-width="1.5"/><ellipse cx="34" cy="34" rx="8" ry="7" fill="#c8a36e" stroke="#5d4028" stroke-width="1.5"/><ellipse cx="34" cy="34" rx="4.5" ry="3.8" fill="none" stroke="#937044"/><path d="m32 33 3 2" stroke="#937044"/><path d="M17 19l-3-10q7-7 14-1l3 11" fill="#755034" stroke="#493322" stroke-width="1.5"/><ellipse cx="24" cy="19" rx="8" ry="7" fill="#c8a36e" stroke="#5d4028" stroke-width="1.5"/><ellipse cx="24" cy="19" rx="4.5" ry="3.8" fill="none" stroke="#937044"/><path d="m22 18 3 2" stroke="#937044"/></svg>'},ore:{name:'Iron ore',buy:10,sell:5,icon:'🪨'}};
for(const [id,d]of Object.entries(professionItems))goods[id]={...goods[id],...d,icon:professionIcon(d)};
for(const [key,item] of Object.entries(weaponCatalog))goods['weapon:'+key]={name:item.name,buy:item.buy,sell:item.sell,icon:iconForWeapon(key),field:'weaponsOwned',key,req:item.req,tier:item.tier};
for(const [key,item] of Object.entries(armorCatalog))goods['armor:'+key]={name:key==='cape'?'Crimson cape':item.name,buy:item.buy,sell:item.sell,icon:'🛡',field:'armorOwned',key,slot:item.equipSlot,category:'Armour',req:item.req,tier:item.tier};
for(const [key,item] of Object.entries(shieldCatalog))goods['shield:'+key]={name:item.name,buy:item.buy,sell:item.sell,icon:'🛡',field:'shieldsOwned',key,req:item.req,tier:item.tier};
for(const [key,item] of Object.entries(jewelryCatalog))goods['jewelry:'+key]={name:item.name,buy:75,sell:20,icon:item.icon,field:'jewelryOwned',key};
for(const [key,item] of Object.entries(mountCatalog))goods['mount:'+key]={name:item.name,buy:2500,sell:750,icon:item.icon,field:'mountsOwned',key};
for(const [id,g]of Object.entries(goods))g.icon=meshItemIcon(id,g);
export function registerBankNotes(){for(const [id,g]of Object.entries(goods))if(!g.noteOf&&!g.stackable&&g.notable!==false)goods[noteId(id)]=bankNoteDescriptor(id,g)}
registerBankNotes();
const count=v=>Number.isFinite(Number(v))?Math.max(0,Math.min(1e9,Math.floor(Number(v)))):0;
export function sanitizeBank(raw){return Object.fromEntries(Object.entries(raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}).filter(([id,n])=>goods[id]&&count(n)>0).map(([id,n])=>[id,count(n)]))}
export function isWorn(state,id){const item=goods[id];if(!item?.field)return false;return item.field==='armorOwned'?!!state.equipped?.[item.key]:item.field==='weaponsOwned'?state.equippedWeapon===item.key:item.field==='shieldsOwned'?state.equippedShield===item.key:item.field==='mountsOwned'?state.equippedMount===item.key:state[jewelryCatalog[item.key].slot]===item.key}
export function quantity(state,id){const item=goods[id];return !item?0:item.field?(state[item.field]||[]).filter(k=>k===item.key).length:count(state[id])}
export function inventoryEntries(state){return Object.keys(goods).filter(id=>quantity(state,id)-(isWorn(state,id)?1:0)>0)}
// RuneScape-sized backpack. The server mirrors this in eldervale_private.inventory_capacity().
export const INVENTORY_SLOTS=28;
export function inventoryUsed(state){return inventoryEntries(state).reduce((sum,id)=>sum+(goods[id].stackable?1:quantity(state,id)-(isWorn(state,id)?1:0)),0)}
function add(state,id,n){const item=goods[id];if(item.field){state[item.field]||=[];for(let i=0;i<n;i++)state[item.field].push(item.key)}else state[id]=count(state[id])+n}
function remove(state,id,n){const item=goods[id];if(item.field){let left=n;state[item.field]=state[item.field].filter(k=>k!==item.key||left--<=0);}else state[id]=count(state[id])-n}
export function bankTransfer(state,id,direction,all=false,noted=false,requested=1){
 const item=goods[id];if(!item)return 'Unknown item.';state.bank=sanitizeBank(state.bank);
 if(direction==='deposit'){
  const available=Math.max(0,quantity(state,id)-(isWorn(state,id)?1:0)),n=all?available:Math.min(requested,available);if(!n)return isWorn(state,id)?'Unequip this item before depositing it.':'No item available.';
  remove(state,id,n);const base=item.noteOf||id;state.bank[base]=(state.bank[base]||0)+n;
 }else{
  if(item.noteOf)return 'Withdraw the original item from your bank.';
  const destination=noted&&!item.stackable?noteId(id):id,target=goods[destination];if(!target)return 'This item cannot be noted.';
  const available=state.bank[id]||0,room=target.stackable?(quantity(state,destination)>0||inventoryUsed(state)<INVENTORY_SLOTS?1e9-quantity(state,destination):0):Math.max(0,INVENTORY_SLOTS-inventoryUsed(state)),n=Math.min(available,room,all?available:requested);
  if(!n)return available?'Your inventory is full.':'No item available.';
  add(state,destination,n);state.bank[id]-=n;if(!state.bank[id])delete state.bank[id];
 }return null;
}
export function shopTrade(state,id,buy){
 const item=goods[id];if(!item)return 'Unknown item.';
 if(buy){if(count(state.gold)<item.buy)return 'Not enough gold.';if(inventoryUsed(state)>=INVENTORY_SLOTS&&!(item.stackable&&quantity(state,id)>0))return 'Your inventory is full.';if(item.field&&quantity(state,id))return 'You already own that item.';state.gold=count(state.gold)-item.buy;add(state,id,1)}
 else{if(!quantity(state,id))return 'You do not have that item.';if(isWorn(state,id))return 'Unequip this item before selling it.';remove(state,id,1);state.gold=count(state.gold)+item.sell}return null;
}
// RuneScape closes the bank or shop as soon as you walk away from it.
export function serviceOutOfReach(anchor,position,reach=4){
 if(!anchor||!position)return false;const dx=position.x-anchor.x,dz=position.z-anchor.z;
 return Number.isFinite(dx)&&Number.isFinite(dz)&&dx*dx+dz*dz>reach*reach;
}
// Text for an empty column of the shop / bank panel. The merchant's stock column and the
// "what can I sell here" column are separate: a merchant that buys none of your items still sells.
export function serviceEmptyText(mode,side,carried=0){
 if(mode==='bank')return side==='inventory'?'Your inventory is empty.':'Your bank is empty.';
 if(side==='stock')return 'This merchant has nothing for sale right now.';
 return carried>0?'This merchant is not interested in anything you are carrying.':'You have nothing to sell.';
}
export function createServicePanel(state,{onChange,onOpen}){
 const panel=document.createElement('dialog');panel.id='service-panel';panel.innerHTML='<div class="service-head"><div><small>ELDERVALE · SERVICES</small><h2 id="service-title"></h2></div><button type="button" id="service-close" aria-label="Close services">×</button></div><div class="service-wallet"></div><div class="service-bank-settings"><span>Withdraw as:</span><button type="button" data-withdraw="item" aria-pressed="true">Items</button><button type="button" data-withdraw="note" aria-pressed="false">Notes</button></div><p class="service-help"></p><div class="service-columns"><section><h3>Your inventory</h3><div class="service-items" id="service-inventory"></div></section><section><h3 id="service-stock-title"></h3><div class="service-items" id="service-stock"></div></section></div><p id="service-status" role="status"></p>';document.body.append(panel);
 let withdrawNoted=false;let mode='bank',previousFocus=null,merchantId=null;const shop=()=>window.eldervaleShops?.[merchantId]||null;
 const bankView=createBankView(state,{onTransfer:p=>invoke(()=>bankTransfer(state,p.id,p.direction,p.all,p.noted),'bank',{item:p.id,direction:p.direction,all:p.all,noted:p.noted})});panel.append(bankView.root);
 const crest=document.createElement('span');crest.className='bank-crest';crest.setAttribute('aria-hidden','true');crest.innerHTML='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.8"><path d="m4 11 12-7 12 7ZM6 13v12m7-12v12m6-12v12m7-12v12M3 28h26M5 24h22"/></svg>';panel.querySelector('.service-head').prepend(crest);
 const invoke=(fn,command,payload)=>{if(window.eldervaleAuthority)return window.eldervaleRealm?.command(command,payload).then(ok=>{const text=ok?'Done.':window.eldervaleRealm?.lastError||'Unable to transfer. Check inventory space and distance to the bank.';render();panel.querySelector('#service-status').textContent=text;bankView.setStatus(text);return ok});const error=fn();if(!error)onChange();render();panel.querySelector('#service-status').textContent=error||'Done.';bankView.setStatus(error||'Done.');return Promise.resolve(!error)};
 function row(id,n,actions){const item={...goods[id],...(mode==='shop'?shop()?.[id]:{})},entry=document.createElement('article');entry.className='service-item';const icon=document.createElement('span');icon.className='service-icon';icon.innerHTML=item.icon;const text=document.createElement('div'),name=document.createElement('strong');name.textContent=item.name;const detail=document.createElement('small');detail.textContent='×'+n+(mode==='shop'?' · '+(actions==='buy'?item.buy:item.sell)+' gold':'');text.append(name,detail);const buttons=document.createElement('div');buttons.className='service-actions';for(const all of (mode==='bank'||mode==='shop'&&item.stackable&&actions==='buy')?[false,true]:[false]){const button=document.createElement('button');button.type='button';button.disabled=actions==='buy'&&item.stock>=0&&item.stock<(all?10:1);button.textContent=(actions==='buy'?'Buy':actions==='sell'?'Sell':actions==='deposit'?'Deposit':'Withdraw')+(all?(mode==='shop'?' 10':' all'):'');if(mode==='shop'){const quote=actions==='buy'?(all?(item.buy10??item.buy*10):item.buy):item.sell;button.title=quote+' gold total';button.textContent+=' · '+quote+'g'}button.onclick=()=>invoke(()=>mode==='bank'?bankTransfer(state,id,actions,all,withdrawNoted):shopTrade(state,id,actions==='buy'),mode==='bank'?'bank':'trade',mode==='bank'?{item:id,direction:actions,all,noted:withdrawNoted}:{item:id,buy:actions==='buy',merchant:merchantId,amount:all?10:1,quote:actions==='buy'?(all?(item.buy10??item.buy*10):item.buy):item.sell});buttons.append(button)}entry.append(icon,text,buttons);return entry}
 function render(soft=false){if(panel.classList.contains('bank-mode')!==(mode==='bank'))panel.classList.toggle('bank-mode',mode==='bank');if(bankView.root.hidden!==(mode!=='bank'))bankView.root.hidden=mode!=='bank';if(mode==='bank'){bankView.render(soft);return}panel.querySelector('.service-bank-settings').hidden=mode!=='bank';for(const b of panel.querySelectorAll('[data-withdraw]'))b.setAttribute('aria-pressed',String((b.dataset.withdraw==='note')===withdrawNoted));const scrollLeft=panel.querySelector('#service-inventory').scrollTop,scrollRight=panel.querySelector('#service-stock').scrollTop;setText(panel.querySelector('.service-wallet'),'🪙 Gold: '+state.gold.toLocaleString()+' · Inventory: '+inventoryUsed(state)+'/'+INVENTORY_SLOTS);setText(panel.querySelector('.service-help'),mode==='bank'?'Unlimited bank storage · Items use normal inventory slots. Notes stack, but must be deposited and withdrawn as items before use. Bait and ammo stay stackable.':'Buy or sell for gold. Limited-stock prices respond to shared supply; unlimited stock has fixed prices. Each button shows the total price.');setText(panel.querySelector('#service-stock-title'),mode==='bank'?'Your bank':'Merchant stock');const left=panel.querySelector('#service-inventory'),right=panel.querySelector('#service-stock');const leftNodes=[],rightNodes=[];for(const id of inventoryEntries(state))if(mode==='bank'||!shop()||shop()[id])leftNodes.push(row(id,quantity(state,id)-(isWorn(state,id)?1:0),mode==='bank'?'deposit':'sell'));for(const id of mode==='bank'?Object.keys(state.bank||{}):Object.keys(shop()||(merchantId?{}:goods)))if(mode!=='bank'||state.bank[id]>0)rightNodes.push(row(id,mode==='bank'?state.bank[id]:shop()?.[id]?.stock>=0?shop()[id].stock:'∞',mode==='bank'?'withdraw':'buy'));for(const [nodes,side] of [[leftNodes,'inventory'],[rightNodes,'stock']])if(!nodes.length){const empty=document.createElement('p');empty.className='service-empty';empty.textContent=serviceEmptyText(mode,side,inventoryEntries(state).length);nodes.push(empty)}if(morphChildren(left,leftNodes))left.scrollTop=scrollLeft;if(morphChildren(right,rightNodes))right.scrollTop=scrollRight;}
 for(const b of panel.querySelectorAll('[data-withdraw]'))b.onclick=()=>{withdrawNoted=b.dataset.withdraw==='note';render()};
 panel.querySelector('#service-close').onclick=()=>panel.close();panel.addEventListener('click',e=>{if(e.target===panel){const r=panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)panel.close()}});panel.addEventListener('close',()=>previousFocus?.focus?.({preventScroll:true}));
 return {refresh(){if(panel.open)render(true)},open(type,title,id=null){mode=type;merchantId=id;previousFocus=document.activeElement;onOpen();panel.querySelector('#service-title').textContent=title||(type==='bank'?'Oakcross Bank':'Market');panel.querySelector('#service-status').textContent='';if(mode==='bank')bankView.reset();render();if(!panel.open)panel.showModal()},close(){panel.close()},get isOpen(){return panel.open}};
}

const customIcons=Object.fromEntries(Object.entries(itemIcons).map(([key,d])=>[key,d.svg]));
// Owner catalog edits (db/admin-full-control.sql snapshot.catalogOverrides): display fields of item:* rows
// merge into the built-in goods; new item IDs appear once their icon key is known. Original values are
// kept so an override that disappears restores them.
const OVERRIDE_KEYS=['name','description','buy','sell','heal','healPct','stackable','tier','requirements','bonuses','attackSpeed','tradeable','disabled','category'];const overridden=new Map();
export function registerCatalogOverrides(rows={}){if(!rows||typeof rows!=='object')return;const seen=new Set();for(const [cid,d] of Object.entries(rows)){if(!cid.startsWith('item:')||cid.startsWith('item:note:')||!d||typeof d!=='object')continue;const id=cid.slice(5);seen.add(id);let g=goods[id];if(!g){if(!customIcons[d.icon])continue;g=goods[id]={name:String(d.name||id),icon:customIcons[d.icon],iconKey:d.icon,custom:!!d.custom,ownerCreated:true}}if(!overridden.has(id))overridden.set(id,Object.fromEntries(OVERRIDE_KEYS.map(k=>[k,g[k]])));for(const k of OVERRIDE_KEYS){const v=k==='description'?d.description??d.desc??d.examine:d[k];if(v!==undefined)g[k]=v}}for(const [id,orig] of overridden)if(!seen.has(id)&&goods[id]){Object.assign(goods[id],orig);overridden.delete(id)}}
export function registerWorldItems(catalog={}){for(const [id,d] of Object.entries(catalog))if(/^custom_[a-z0-9_]{2,35}$/.test(id)&&d.custom&&customIcons[d.icon])goods[id]={...d,icon:customIcons[d.icon],iconKey:d.icon};for(const [id,g]of Object.entries(goods))if(g.custom)g.icon=meshItemIcon(id,g);registerBankNotes();}
