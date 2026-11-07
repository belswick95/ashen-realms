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
 assert.ok(tail.includes(':is(#side,#social-panel,#contextmenu,#dialog,dialog,.map-card,#trade-request) :not(svg,svg *){font-family:var(--mv-body)!important}'));
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

test('bank backpack rows are a full cell tall (slots no longer overlap)',()=>{
 assert.match(read('bank.css'),/#service-panel\.bank-mode \.bank-inventory-grid\{grid-auto-rows:var\(--bank-cell\)\}\s*$/);
});

test('shop wells, trade columns and the trade request popup use the medieval theme',()=>{
 const css=read('medieval-theme.css'),tail=css.slice(css.lastIndexOf('QA pass (portrait145)'));
 for(const sel of ['#service-panel .service-items','#player-trade .trade-columns section','#player-trade form{','#trade-request{','button.trade-accept:not(:disabled)','#trade-request .trade-request-buttons button:disabled'])assert.ok(tail.includes(sel),sel);
 assert.ok(tail.includes('.map-card,#trade-request) :not(svg,svg *)'),'popup text uses the book face');
});

test('phone Castle Training card sits under the player frame, compact and foldable',async()=>{
 const css=read('phone-fit.css'),rule=css.match(/body\.phone-layout \.tutorial-hud\{[^}]*\}/)[0];
 assert.match(rule,/left:var\(--phone-left,8px\)!important/);assert.match(rule,/width:222px!important/);assert.match(rule,/top:calc\(var\(--phone-top,8px\) \+ 70px\)!important/);assert.match(rule,/pointer-events:auto/);
 assert.ok(!/translateX|left:50%/.test(rule),'no longer centred over the view');
 assert.match(css,/\.tutorial-hud\.tutorial-hud-folded :is\(\.tutorial-hud-goal,\.tutorial-hud-way\)\{display:none\}/);
 const {installHudFold}=await import('../tutorial.js');
 const classes=new Set(),attrs={},handlers={},store=new Map();
 const hud={classList:{toggle:(c,on)=>on?classes.add(c):classes.delete(c),contains:c=>classes.has(c)},setAttribute:(k,v)=>attrs[k]=v,addEventListener:(n,f)=>handlers[n]=f,title:''};
 const storage={getItem:k=>store.get(k)??null,setItem:(k,v)=>store.set(k,v)};
 installHudFold(hud,storage);assert.equal(classes.has('tutorial-hud-folded'),false);assert.equal(attrs['aria-expanded'],'true');
 handlers.click();assert.equal(classes.has('tutorial-hud-folded'),true);assert.equal(attrs['aria-expanded'],'false');assert.equal(store.get('eldervale-tutorial-hud-folded'),'1');
 classes.clear();installHudFold(hud,storage);assert.equal(classes.has('tutorial-hud-folded'),true,'remembered for the session');
});

test('settings dropdown labels fit the phone panel',()=>{
 const html=read('index.html'),select=html.match(/<select id="graphics-preset"[\s\S]*?<\/select>/)[0];
 for(const [,label] of select.matchAll(/<option[^>]*>([^<]*)<\/option>/g))assert.ok(label.length<=18,label);
});
