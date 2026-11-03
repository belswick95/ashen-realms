import {itemIcons} from './item-icons.js?v=release-20261103-chat14';
import {fishingItems} from './fishing.js?v=release-20261103-chat14';
import {weaponCatalog,iconForWeapon} from './weapons.js?v=release-20261103-chat14';
import {shieldCatalog} from './shields.js?v=release-20261103-chat14';
import {jewelryCatalog} from './jewelry.js?v=release-20261103-chat14';
const armor={helm:'Iron full helm',chest:'Iron platebody',legs:'Iron platelegs',boots:'Iron boots',cape:'Crimson cape'};
export const goods={...fishingItems,wood:{name:'Logs',buy:6,sell:3,icon:'🪵'},ore:{name:'Iron ore',buy:10,sell:5,icon:'🪨'}};
for(const [key,item] of Object.entries(weaponCatalog))goods['weapon:'+key]={name:item.name,buy:key==='twohand'?120:key==='battleaxe'?90:key==='dagger'?20:45,sell:key==='twohand'?40:key==='battleaxe'?30:12,icon:iconForWeapon(key),field:'weaponsOwned',key};
for(const [key,name] of Object.entries(armor))goods['armor:'+key]={name,buy:60,sell:18,icon:key==='helm'?'⛑':key==='boots'?'🥾':key==='cape'?'🧣':'🛡',field:'armorOwned',key};
for(const [key,item] of Object.entries(shieldCatalog))goods['shield:'+key]={name:item.name,buy:40,sell:12,icon:'🛡',field:'shieldsOwned',key};
for(const [key,item] of Object.entries(jewelryCatalog))goods['jewelry:'+key]={name:item.name,buy:75,sell:20,icon:item.icon,field:'jewelryOwned',key};
const count=v=>Number.isFinite(Number(v))?Math.max(0,Math.min(1e9,Math.floor(Number(v)))):0;
export function sanitizeBank(raw){return Object.fromEntries(Object.entries(raw&&typeof raw==='object'&&!Array.isArray(raw)?raw:{}).filter(([id,n])=>goods[id]&&count(n)>0).map(([id,n])=>[id,goods[id].field?1:count(n)]))}
export function isWorn(state,id){const item=goods[id];if(!item?.field)return false;return item.field==='armorOwned'?!!state.equipped?.[item.key]:item.field==='weaponsOwned'?state.equippedWeapon===item.key:item.field==='shieldsOwned'?state.equippedShield===item.key:state[jewelryCatalog[item.key].slot]===item.key}
export function quantity(state,id){const item=goods[id];return !item?0:item.field?(state[item.field]||[]).includes(item.key)?1:0:count(state[id])}
export function inventoryEntries(state){return Object.keys(goods).filter(id=>quantity(state,id)>0&&!isWorn(state,id))}
export function inventoryUsed(state){return inventoryEntries(state).reduce((sum,id)=>sum+(goods[id].stackable?1:quantity(state,id)),0)}
function add(state,id,n){const item=goods[id];if(item.field){state[item.field]||=[];state[item.field].push(item.key)}else state[id]=count(state[id])+n}
function remove(state,id,n){const item=goods[id];if(item.field)state[item.field]=state[item.field].filter(k=>k!==item.key);else state[id]=count(state[id])-n}
export function bankTransfer(state,id,direction,all=false){
 if(!goods[id])return 'Unknown item.';state.bank=sanitizeBank(state.bank);
 if(direction==='deposit'){
  if(isWorn(state,id))return 'Unequip this item before depositing it.';
  const n=all?quantity(state,id):Math.min(1,quantity(state,id));if(!n)return 'You do not have that item.';
  if(goods[id].field&&state.bank[id])return 'This item is already in your bank.';
  remove(state,id,n);state.bank[id]=(state.bank[id]||0)+n;
 }else{
  const available=state.bank[id]||0,room=goods[id].stackable?(quantity(state,id)>0?1e9:inventoryUsed(state)<16?1e9:0):Math.max(0,16-inventoryUsed(state)),n=Math.min(available,room,all?available:1);
  if(!n)return available?'Your inventory is full.':'No item available.';
  if(goods[id].field&&quantity(state,id))return 'You already carry that item.';
  add(state,id,n);state.bank[id]-=n;if(!state.bank[id])delete state.bank[id];
 }return null;
}
export function shopTrade(state,id,buy){
 const item=goods[id];if(!item)return 'Unknown item.';
 if(buy){if(count(state.gold)<item.buy)return 'Not enough gold.';if(inventoryUsed(state)>=16&&!(item.stackable&&quantity(state,id)>0))return 'Your inventory is full.';if(item.field&&quantity(state,id))return 'You already own that item.';state.gold=count(state.gold)-item.buy;add(state,id,1)}
 else{if(!quantity(state,id))return 'You do not have that item.';if(isWorn(state,id))return 'Unequip this item before selling it.';remove(state,id,1);state.gold=count(state.gold)+item.sell}return null;
}
export function createServicePanel(state,{onChange,onOpen}){
 const panel=document.createElement('dialog');panel.id='service-panel';panel.innerHTML='<div class="service-head"><div><small>ELDERVALE · SERVICES</small><h2 id="service-title"></h2></div><button type="button" id="service-close" aria-label="Close services">×</button></div><div class="service-wallet"></div><p class="service-help"></p><div class="service-columns"><section><h3>Your inventory</h3><div class="service-items" id="service-inventory"></div></section><section><h3 id="service-stock-title"></h3><div class="service-items" id="service-stock"></div></section></div><p id="service-status" role="status"></p>';document.body.append(panel);
 let mode='bank',previousFocus=null,merchantId=null;const shop=()=>window.eldervaleShops?.[merchantId]||null;
 const invoke=(fn,command,payload)=>{if(window.eldervaleAuthority){void window.eldervaleRealm?.command(command,payload).then(ok=>{render();panel.querySelector('#service-status').textContent=ok?'Done.':'Action unavailable. Check stock, gold and inventory space.'});return}const error=fn();if(!error)onChange();render();panel.querySelector('#service-status').textContent=error||'Done.'};
 function row(id,n,actions){const item={...goods[id],...(mode==='shop'?shop()?.[id]:{})},entry=document.createElement('article');entry.className='service-item';const icon=document.createElement('span');icon.className='service-icon';icon.innerHTML=item.icon;const text=document.createElement('div'),name=document.createElement('strong');name.textContent=item.name;const detail=document.createElement('small');detail.textContent='×'+n+(mode==='shop'?' · '+(actions==='buy'?item.buy:item.sell)+' gold':'');text.append(name,detail);const buttons=document.createElement('div');buttons.className='service-actions';for(const all of (mode==='bank'&&!item.field||mode==='shop'&&item.stackable&&actions==='buy')?[false,true]:[false]){const button=document.createElement('button');button.type='button';button.disabled=actions==='buy'&&item.stock>=0&&item.stock<(all?10:1);button.textContent=(actions==='buy'?'Buy':actions==='sell'?'Sell':actions==='deposit'?'Deposit':'Withdraw')+(all?(mode==='shop'?' 10':' all'):'');button.onclick=()=>invoke(()=>mode==='bank'?bankTransfer(state,id,actions,all):shopTrade(state,id,actions==='buy'),mode==='bank'?'bank':'trade',mode==='bank'?{item:id,direction:actions,all}:{item:id,buy:actions==='buy',merchant:merchantId,amount:all?10:1});buttons.append(button)}entry.append(icon,text,buttons);return entry}
 function render(){const scrollLeft=panel.querySelector('#service-inventory').scrollTop,scrollRight=panel.querySelector('#service-stock').scrollTop;panel.querySelector('.service-wallet').textContent='🪙 Gold: '+state.gold.toLocaleString()+' · Inventory: '+inventoryUsed(state)+'/16';panel.querySelector('.service-help').textContent=mode==='bank'?'Deposit or withdraw your items. Worn equipment must be removed first.':'Buy supplies or sell items from your inventory. Prices are shown in gold.';panel.querySelector('#service-stock-title').textContent=mode==='bank'?'Your bank':'Merchant stock';const left=panel.querySelector('#service-inventory'),right=panel.querySelector('#service-stock');left.replaceChildren();right.replaceChildren();for(const id of inventoryEntries(state))if(mode==='bank'||!shop()||shop()[id])left.append(row(id,quantity(state,id),mode==='bank'?'deposit':'sell'));for(const id of mode==='bank'?Object.keys(state.bank||{}):Object.keys(shop()||goods))if(mode!=='bank'||state.bank[id]>0)right.append(row(id,mode==='bank'?state.bank[id]:shop()?.[id]?.stock>=0?shop()[id].stock:'∞',mode==='bank'?'withdraw':'buy'));for(const node of [left,right])if(!node.children.length){const empty=document.createElement('p');empty.className='service-empty';empty.textContent='No items here yet.';node.append(empty)}left.scrollTop=scrollLeft;right.scrollTop=scrollRight;}
 panel.querySelector('#service-close').onclick=()=>panel.close();panel.addEventListener('click',e=>{if(e.target===panel){const r=panel.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)panel.close()}});panel.addEventListener('close',()=>previousFocus?.focus?.({preventScroll:true}));
 return {refresh(){if(panel.open)render()},open(type,title,id=null){mode=type;merchantId=id;previousFocus=document.activeElement;onOpen();panel.querySelector('#service-title').textContent=title||(type==='bank'?'Oakcross Bank':'Market');panel.querySelector('#service-status').textContent='';render();if(!panel.open)panel.showModal()},close(){panel.close()},get isOpen(){return panel.open}};
}

const customIcons=Object.fromEntries(Object.entries(itemIcons).map(([key,d])=>[key,d.svg]));
export function registerWorldItems(catalog={}){for(const [id,d] of Object.entries(catalog))if(/^custom_[a-z0-9_]{2,35}$/.test(id)&&d.custom&&customIcons[d.icon])goods[id]={...d,icon:customIcons[d.icon],iconKey:d.icon};}
