// UI QA pass (portrait145): regressions found while driving every panel at phone, iPad and desktop sizes.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {authErrorText} from '../auth-messages.js';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('sign-in and sign-up errors read as plain sentences, not raw API codes',()=>{
 assert.match(authErrorText({message:'email rate limit exceeded'}),/wait a few minutes/);
 assert.match(authErrorText({message:'Invalid login credentials'}),/do not match/);
 assert.match(authErrorText({message:'Email not confirmed'}),/confirm your email/);
 assert.match(authErrorText({message:'User already registered'}),/Sign in instead/);
 assert.match(authErrorText(new TypeError('Failed to fetch')),/connection/);
 assert.equal(authErrorText(Error('Username must be 3–20 letters, numbers, or underscores.')),'Username must be 3–20 letters, numbers, or underscores.');
 assert.equal(authErrorText({message:'something odd'}),'Something odd.');
 assert.equal(authErrorText(null),'Something went wrong. Please try again.');
 assert.match(read('auth.js'),/message\(authErrorText\(err\)\)/);
});

test('medieval theme restyles the generic-UI leftovers inside panels (Arial text, green boxes)',()=>{
 const css=read('medieval-theme.css'),tail=css.slice(css.lastIndexOf('QA pass (portrait145)'));
 assert.ok(tail.includes(':is(#side,#social-panel,#contextmenu,#dialog,dialog,.map-card) :not(svg,svg *){font-family:var(--mv-body)!important}'));
 for(const sel of ['.equipment-stats{','.equipment-stats-group{','.player-combat-level{','#settings-tab label{'])assert.ok(tail.includes(sel),sel+' restyled');
 // Display headings keep Cinzel after the blanket body-face rule.
 assert.ok(tail.indexOf('.settings-nav button')>tail.indexOf(':not(svg,svg *)'));
});

test('Enter starts chat even after a HUD tab was clicked with the mouse (keyboard focus keeps Enter)',async()=>{
 const {installChatShortcut,pointerFocusedButton}=await import('../chat-shortcuts.js');
 const button=(inForm=false)=>{const b={matches:s=>/button/.test(s),closest:s=>inForm&&/form/.test(s)?{}:/button/.test(s)?b:null,blur(){b.blurred=true}};return b};
 const tab=button();
 assert.equal(pointerFocusedButton(tab,tab),true);
 assert.equal(pointerFocusedButton(tab,null),false,'reached with the keyboard');
 const formButton=button(true);assert.equal(pointerFocusedButton(formButton,formButton),false,'inside the chat form or a dialog');
 const field={matches:()=>false,closest:()=>({})};assert.equal(pointerFocusedButton(field,field),false,'inputs');
 const listeners={},focused=[],classes=new Set(['collapsed']);
 const panel={hidden:false,classList:{remove:c=>classes.delete(c)},setAttribute(){},querySelector:()=>null};
 const input={focus:()=>focused.push('input'),addEventListener(){},removeEventListener(){}};
 const prior={},globals={addEventListener:(n,f,capture)=>listeners[n+(capture?':capture':'')]=f,removeEventListener(){},document:{body:{classList:{contains:c=>c==='game-active'}},querySelector:()=>null,activeElement:tab}};
 for(const [k,v] of Object.entries(globals)){prior[k]=globalThis[k];globalThis[k]=v}
 try{let prevented=false;installChatShortcut({panel,input,onOpen(){}});
  listeners['pointerdown:capture']({target:tab});
  listeners.keydown({key:'Enter',code:'Enter',preventDefault(){prevented=true}});
  assert.equal(prevented,true,'the tab is not clicked again');assert.equal(tab.blurred,true);assert.deepEqual(focused,['input']);assert.equal(classes.has('collapsed'),false);
  focused.length=0;listeners['keydown:capture']({key:'Tab'});listeners.keydown({key:'Enter',code:'Enter',preventDefault(){}});assert.deepEqual(focused,[],'after Tab, Enter belongs to the focused button');
 }finally{for(const [k,v] of Object.entries(prior))globalThis[k]=v}
});

test('settings dropdown labels fit the phone panel',()=>{
 const html=read('index.html'),select=html.match(/<select id="graphics-preset"[\s\S]*?<\/select>/)[0];
 for(const [,label] of select.matchAll(/<option[^>]*>([^<]*)<\/option>/g))assert.ok(label.length<=18,label);
});
