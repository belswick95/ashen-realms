import test from 'node:test';import assert from 'node:assert/strict';import {installMMOControls} from '../mmorpg-controls.js';
test('RuneScape controls: movement keys and the thumbstick are gone, Space still jumps',()=>{
 const listeners={},made=[],element=()=>{const e={id:'',style:{setProperty(){}},setAttribute(){},append(){},addEventListener(){},querySelector(){return element()}};made.push(e);return e},document={body:{append(){},classList:{toggle(){}}},createElement:element,querySelector:()=>null,addEventListener(){}};
 const prior={};for(const [key,value] of Object.entries({document,addEventListener:(n,fn)=>listeners[n]=fn,matchMedia:()=>({matches:false})})){prior[key]=globalThis[key];globalThis[key]=value}
 let jumps=0;try{const controls=installMMOControls({isBlocked:()=>false,onJump(){jumps++}}),event=(code,extra={})=>({code,preventDefault(){},target:null,...extra});
  for(const code of ['KeyW','KeyA','KeyS','KeyD','ArrowUp','ArrowLeft','ShiftLeft'])listeners.keydown(event(code));
  assert.equal(controls.update(.016,0),null,'no keyboard movement input');assert.deepEqual(controls.cameraAxes(),{yaw:-1,pitch:1},'W/A and Up/Left turn the camera instead');
  for(const code of ['KeyW','ArrowUp','KeyA','ArrowLeft','KeyS','KeyD'])listeners.keyup(event(code));assert.deepEqual(controls.cameraAxes(),{yaw:0,pitch:0});
  listeners.keydown(event('KeyA',{target:{closest:()=>({})}}));assert.deepEqual(controls.cameraAxes(),{yaw:0,pitch:0},'typing in chat does not turn the camera');
  assert.equal(jumps,0);
  listeners.keydown(event('Space'));listeners.keydown(event('Space',{repeat:true}));assert.equal(jumps,1);
  assert.ok(!made.some(e=>e.id==='movement-pad'||e.id==='movement-base'),'no on-screen joystick');assert.ok(made.some(e=>e.id==='touch-jump'));
 }finally{for(const [key,value] of Object.entries(prior))globalThis[key]=value}
});
