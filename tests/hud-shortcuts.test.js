import test from 'node:test';import assert from 'node:assert/strict';
import {isBagShortcut,chatDeviceClass,chatStartsOpen} from '../hud-redesign.js';
import {installChatShortcut,releaseChatFocus} from '../chat-shortcuts.js';

const doc=({dialog=false,active=null,classes=[]}={})=>({querySelector:s=>s==='dialog[open]'&&dialog?{}:null,activeElement:active,body:{classList:{contains:c=>classes.includes(c)}}});
const typing={closest:()=>({})},game={closest:()=>null};

test('B toggles the bag only when the game has the keyboard',()=>{
 assert.equal(isBagShortcut({code:'KeyB',target:game},doc()),true);
 assert.equal(isBagShortcut({code:'',key:'B',target:game},doc()),true,'Safari key fallback');
 assert.equal(isBagShortcut({code:'KeyB',target:typing},doc()),false,'typing in chat or a form');
 assert.equal(isBagShortcut({code:'KeyB',target:game},doc({active:typing})),false,'focus still in a field');
 assert.equal(isBagShortcut({code:'KeyB',target:game},doc({dialog:true})),false,'owner console or another dialog open');
 for(const mod of ['ctrlKey','metaKey','altKey','repeat'])assert.equal(isBagShortcut({code:'KeyB',[mod]:true,target:game},doc()),false,mod);
 assert.equal(isBagShortcut({code:'KeyN',target:game},doc()),false);
});

test('chat starts minimised on phones and open on iPad and desktop, unless the player chose otherwise',()=>{
 assert.equal(chatDeviceClass({coarse:true,shortSide:390}),'phone');assert.equal(chatDeviceClass({touch:true,shortSide:820}),'wide');assert.equal(chatDeviceClass({shortSide:390}),'wide');
 assert.equal(chatStartsOpen('phone'),false);assert.equal(chatStartsOpen('wide'),true);
 assert.equal(chatStartsOpen('phone','open'),true);assert.equal(chatStartsOpen('wide','closed'),false);
});

test('Enter opens a minimised chat and focuses it; Escape in the box hands keys back to the game',()=>{
 const listeners={},inputListeners={},focused=[],classes=new Set(['collapsed']);
 const toggle={textContent:'Chat',title:'',setAttribute(){}};
 const panel={hidden:false,classList:{remove:c=>classes.delete(c)},setAttribute(){},querySelector:()=>toggle};
 const input={focus:()=>focused.push('input'),blur:()=>focused.push('blur'),addEventListener:(n,f)=>inputListeners[n]=f,removeEventListener(){}};
 const canvas={focus:()=>focused.push('canvas')};
 const prior={};const globals={addEventListener:(n,f)=>listeners[n]=f,removeEventListener(){},document:{body:{classList:{contains:c=>c==='game-active'}},querySelector:s=>s==='#world-canvas'?canvas:null,activeElement:null}};
 for(const [k,v] of Object.entries(globals)){prior[k]=globalThis[k];globalThis[k]=v}
 try{let opened=0;installChatShortcut({panel,input,onOpen:()=>opened++});
  listeners.keydown({key:'Enter',code:'Enter',preventDefault(){}});
  assert.equal(classes.has('collapsed'),false);assert.equal(opened,1);assert.deepEqual(focused,['input']);assert.equal(toggle.textContent,'−');
  inputListeners.keydown({key:'Escape',preventDefault(){}});assert.deepEqual(focused,['input','blur','canvas']);
  releaseChatFocus(input);assert.deepEqual(focused.slice(-2),['blur','canvas']);
 }finally{for(const [k,v] of Object.entries(prior))globalThis[k]=v}
});
