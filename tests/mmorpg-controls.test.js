import test from 'node:test';import assert from 'node:assert/strict';import {jumpHeight,isAirborne,hotkey} from '../mmorpg-controls.js';
test('jump presentation uses a shared timestamp and lands after 800ms',()=>{const start='2026-11-03T12:00:00Z',t=Date.parse(start);assert.equal(jumpHeight(start,t),0);assert.ok(Math.abs(jumpHeight(start,t+400)-.7)<1e-9);assert.equal(jumpHeight(start,t+800),0);assert.equal(jumpHeight(start,t+900),0);assert.equal(jumpHeight(null,t),0)});



test('the jump clips run exactly while the jump arc is off the ground',()=>{const start='2026-11-03T12:00:00Z',t=Date.parse(start);assert.equal(isAirborne(start,t),false);for(const ms of [1,200,400,799])assert.equal(isAirborne(start,t+ms),jumpHeight(start,t+ms)>0,String(ms));assert.equal(isAirborne(start,t+800),false);assert.equal(isAirborne(null,t),false);assert.equal(isAirborne('garbage',t),false)});

test('Space is the only control hotkey and survives Safari key fallbacks',()=>{assert.equal(hotkey({key:' ',code:''}),'Space');assert.equal(hotkey({key:' ',code:'Unidentified'}),'Space');assert.equal(hotkey({key:'w',code:''}),'')});

test('WASD and the arrow keys turn and tilt the camera; opposite keys cancel',async()=>{
 const {cameraKeyAxes,cameraKey}=await import('../mmorpg-controls.js');
 assert.deepEqual(cameraKeyAxes(['ArrowLeft']),{yaw:1,pitch:0});assert.deepEqual(cameraKeyAxes(['KeyD']),{yaw:-1,pitch:0});
 assert.deepEqual(cameraKeyAxes(['KeyW','ArrowUp']),{yaw:0,pitch:1},'clamped');assert.deepEqual(cameraKeyAxes(['KeyA','KeyD','KeyS']),{yaw:0,pitch:-1});
 assert.equal(cameraKey({code:'KeyW'}),'KeyW');assert.equal(cameraKey({code:'',key:'a'}),'KeyA');assert.equal(cameraKey({code:'KeyQ'}),null);
});
