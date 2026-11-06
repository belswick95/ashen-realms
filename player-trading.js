import {goods,inventoryEntries,quantity,isWorn} from './economy.js?v=release-20261106-anim92';
import {TRADE_REQUEST_SECONDS,tradeFinished,neverOpened,tradeRoles,requestDeadline,secondsLeft,requestExpired,requestOutcomeMessage} from './trade-requests.js?v=release-20261106-anim92';
const node=(tag,text)=>{const e=document.createElement(tag);if(text!==undefined)e.textContent=text;return e};
// The 10-second request popup: the target accepts or declines, the requester
// sees "Sending trade request…". Not modal, so the world stays playable.
function createRequestPopup({say}){
 const box=node('div');box.id='trade-request';box.setAttribute('role','alertdialog');box.setAttribute('aria-live','assertive');box.hidden=true;document.body.append(box);
 let shownId=null,suppressed=null,deadline=0,timer=0,count=null,bar=null,accept=null,requester=false,expiredText=null;
 function tick(){
  const now=performance.now(),left=secondsLeft(deadline,now);
  if(count)count.textContent=left+'s';
  if(bar)bar.style.transform='scaleX('+Math.max(0,Math.min(1,(deadline-now)/(TRADE_REQUEST_SECONDS*1000)))+')';
  if(requestExpired(deadline,now)){if(accept)accept.disabled=true;if(expiredText)expiredText.textContent=requester?'No answer yet…':'Request expired.'}
 }
 function hide(){if(box.hidden)return;box.hidden=true;shownId=null;clearInterval(timer);timer=0}
 function show(trade,send){
  if(trade.id===suppressed)return;deadline=requestDeadline(trade.expires_in,performance.now());
  if(shownId===trade.id){tick();return}
  shownId=trade.id;const roles=tradeRoles(trade);requester=roles.requester;box.replaceChildren();
  const text=node('p',requester?'Sending trade request to '+roles.partner+'…':roles.partner+' wants to trade with you.');text.className='trade-request-text';
  const meter=node('div');meter.className='trade-request-meter';bar=node('span');meter.append(bar);
  count=node('strong');count.className='trade-request-count';expiredText=node('small');
  const row=node('div');row.className='trade-request-buttons';
  const make=(label,cls,fn)=>{const b=node('button',label);b.type='button';b.className=cls;b.onclick=fn;row.append(b);return b};
  const id=trade.id;
  if(requester){accept=null;make('Cancel request','trade-decline',()=>{void send('trade_cancel',{},id);suppressed=id;hide()})}
  else{accept=make('Accept','trade-accept',()=>{accept.disabled=true;void send('trade_join',{},id)});make('Decline','trade-decline',()=>{void send('trade_cancel',{},id);suppressed=id;hide()})}
  box.append(text,meter,count,expiredText,row);box.hidden=false;clearInterval(timer);timer=setInterval(tick,200);tick();
  if(!requester)say?.(roles.partner+' wants to trade with you.');
 }
 return {show,hide};
}
export function createTradePanel(state,{say}={}){
 const panel=node('dialog');panel.id='player-trade';document.body.append(panel);let current=null,signature='',dismissed=null,announced=null;
 const popup=createRequestPopup({say});
 const command=async(c,p,id)=>{if(c==='trade_join')await window.eldervaleRealm?.command('stop');return window.eldervaleRealm?.command(c,{id,...p})};
 // Used by logout (auth.js): a pending request or open trade ends for both players.
 window.eldervaleTradeCancel=async()=>{if(current&&!tradeFinished(current.stage))await command('trade_cancel',{},current.id)};
 const send=(c,p={})=>command(c,p,current.id);
 function button(parent,label,fn){const b=node('button',label);b.type='button';b.onclick=fn;parent.append(b);return b}
 function close(){dismissed=current?.id;panel.close()}
 panel.addEventListener('cancel',e=>{e.preventDefault();if(current&&!['complete','cancelled'].includes(current.stage))void send('trade_cancel');close()});
 function render(){
  panel.replaceChildren();const mine=current.a===current.self,own=mine?current.offer_a:current.offer_b,theirs=mine?current.offer_b:current.offer_a,partner=mine?current.name_b:current.name_a;
  panel.append(node('h2','Trade with '+partner));
  if(['complete','cancelled'].includes(current.stage)){panel.append(node('p',current.stage==='complete'?'Trade complete. Your inventory and gold have been updated.':'Trade cancelled. No items or gold were transferred.'));button(panel,'Close',close);return}
  panel.append(node('p',current.stage==='review'?'Final review: offers are locked. Both players must confirm this exact exchange.':'Set item quantities and gold, then save your offer. Any change clears both players’ acceptance.'));
  const columns=node('div');columns.className='trade-columns';panel.append(columns);
  for(const [label,offer]of [['You give',own],[partner+' gives',theirs]]){const col=node('section');col.append(node('h3',label),node('strong',(offer.gold||0).toLocaleString()+' gold'));for(const [id,n]of Object.entries(offer.items||{}))col.append(node('p',(goods[id]?.name||id)+' ×'+n));if(!Object.keys(offer.items||{}).length)col.append(node('p','No items'));columns.append(col)}
  if(current.stage==='offer'){
   const f=node('form');f.onsubmit=e=>e.preventDefault();const add=(label,id,n,max)=>{const l=node('label',label),input=node('input');input.type='number';input.min=0;input.max=max;input.step=1;input.value=n||0;input.name=id;l.append(input);f.append(l);return input};
   add('Gold (you have '+state.gold.toLocaleString()+')','gold',own.gold,state.gold);
   for(const id of inventoryEntries(state))add(goods[id].name+' (available '+(quantity(state,id)-(isWorn(state,id)?1:0))+')',id,own.items?.[id],quantity(state,id)-(isWorn(state,id)?1:0));
   button(f,'Save offer',()=>{const items={};for(const e of f.elements)if(e.name&&e.name!=='gold'&&Number(e.value)>0)items[e.name]=Number(e.value);void send('trade_offer',{offer:{gold:Number(f.elements.gold.value),items}})});panel.append(f);
  }
  const accepted=mine?current.accept_a:current.accept_b,partnerAccepted=mine?current.accept_b:current.accept_a;panel.append(node('p',(accepted?'You accepted. ':'You have not accepted. ')+(partnerAccepted?partner+' accepted.':partner+' has not accepted.')));
  const accept=button(panel,current.stage==='review'?'Confirm trade':'Accept offer',()=>send('trade_accept',{revision:current.revision}));accept.disabled=accepted;button(panel,'Cancel trade',()=>{void send('trade_cancel');close()});
 }
 return {sync(trade){
  if(!trade){popup.hide();if(panel.open)panel.close();current=null;signature='';return}
  current=trade;
  // Request stage: only the small popup; the trade window opens once accepted.
  if(trade.stage==='invited'){if(panel.open)panel.close();signature='';popup.show(trade,command);return}
  popup.hide();
  if(tradeFinished(trade.stage)&&neverOpened(trade)){if(announced!==trade.id){announced=trade.id;const line=requestOutcomeMessage(trade);if(line)say?.(line)}if(panel.open)panel.close();return}
  const next=JSON.stringify([trade.id,trade.stage,trade.revision,trade.accept_a,trade.accept_b]);if(next!==signature){signature=next;render();if(dismissed!==trade.id&&!panel.open)panel.showModal()}
 },request:async(player,name)=>{await window.eldervaleRealm?.command('stop');if(name)say?.('Sending trade request to '+name+'…');return window.eldervaleRealm?.command('trade_request',{player})}};
}
export function requestDrop(state,id){
 const available=id==='gold'?state.gold:quantity(state,id)-(isWorn(state,id)?1:0);if(!available)return;const panel=node('dialog');panel.className='drop-quantity';const form=node('form'),label=node('label','Drop '+(id==='gold'?'gold':goods[id]?.name)+' · available '+available),input=node('input');input.type='number';input.min=1;input.max=available;input.step=1;input.value=1;label.append(input);form.append(label);const submit=node('button','Drop on ground');submit.type='submit';const all=node('button','All');all.type='button';all.onclick=()=>input.value=available;const cancel=node('button','Cancel');cancel.type='button';cancel.onclick=()=>panel.close();form.append(all,submit,cancel);panel.append(node('p','Everyone can pick this up immediately. Unclaimed drops disappear after five minutes.'),form);document.body.append(panel);panel.addEventListener('close',()=>panel.remove());form.onsubmit=async e=>{e.preventDefault();const amount=Number(input.value);if(!Number.isInteger(amount)||amount<1||amount>available)return;submit.disabled=true;const ok=await window.eldervaleRealm?.command('drop',{item:id,amount});submit.disabled=false;if(ok)panel.close()};panel.showModal();
}
