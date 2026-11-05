import test from 'node:test';import assert from 'node:assert/strict';
import {installLongPressMenus,clampStart,fitToViewport} from '../touch-menus.js';

function harness(){
 const listeners={};let timer=null;
 const target={dispatched:[],closest:sel=>sel.includes('#side')?target:null,dispatchEvent(e){target.dispatched.push(e.type);return true}};
 const doc={addEventListener:(type,fn)=>{(listeners[type]||=[]).push(fn)},defaultView:{MouseEvent:class{constructor(type,init){this.type=type;Object.assign(this,init)}},navigator:{}}};
 const fire=(type,e={})=>{const event={type,isTrusted:true,isPrimary:true,pointerType:'touch',target,clientX:10,clientY:10,defaultPrevented:false,stopped:false,preventDefault(){this.defaultPrevented=true},stopImmediatePropagation(){this.stopped=true},...e};for(const fn of listeners[type]||[])fn(event);return event};
 installLongPressMenus({doc,setTimer:fn=>{timer=fn;return 1},clearTimer:()=>{timer=null}});
 return {target,fire,elapse:()=>{const fn=timer;timer=null;fn?.()},get armed(){return !!timer}};
}

test('a touch long press on a HUD item opens its right-click menu and swallows the release click',()=>{
 const h=harness();h.fire('pointerdown');assert.ok(h.armed);h.elapse();
 assert.deepEqual(h.target.dispatched,['contextmenu']);
 const native=h.fire('contextmenu');assert.ok(native.defaultPrevented&&native.stopped,'Android native menu does not open a second time');
 h.fire('pointerup');const click=h.fire('click');assert.ok(click.stopped,'the click ending the press does not also activate the item');
 assert.equal(h.fire('click').stopped,false,'later taps work normally');
});

test('moving, lifting early, mouse input and text fields never open a menu',()=>{
 let h=harness();h.fire('pointerdown');h.fire('pointermove',{clientX:40,clientY:10});assert.equal(h.armed,false);
 h=harness();h.fire('pointerdown');h.fire('pointerup');assert.equal(h.armed,false);assert.equal(h.fire('click').stopped,false,'a normal tap still clicks');
 h=harness();h.fire('pointerdown',{pointerType:'mouse'});assert.equal(h.armed,false);
 h=harness();h.fire('pointerdown',{target:{closest:s=>s.startsWith('input')?{}:{} }});assert.equal(h.armed,false);
});

test('menus are clamped inside the visible viewport and scroll when taller than it',()=>{
 assert.equal(clampStart(800,190,0,844),646);assert.equal(clampStart(-20,190,0,844),8);assert.equal(clampStart(100,500,0,390),8,'taller than the screen pins to the top');
 assert.equal(clampStart(300,100,40,300),232,'visual viewport offset (pinch/keyboard) respected');
 const el={style:{left:'820px',top:'350px'},getBoundingClientRect:()=>({left:820,top:350,width:190,height:220})};
 fitToViewport(el,{view:{width:844,height:390,offsetLeft:0,offsetTop:0}});
 assert.equal(el.style.left,'646px');assert.equal(el.style.top,'162px');assert.equal(el.style.maxHeight,'374px');assert.equal(el.style.overflowY,'auto');
});
