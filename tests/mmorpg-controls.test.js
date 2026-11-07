import test from 'node:test';import assert from 'node:assert/strict';import * as controls from '../mmorpg-controls.js';const {hotkey}=controls;

test('jumping is gone: no jump arc exports; key names still survive Safari fallbacks',()=>{assert.equal(controls.jumpHeight,undefined);assert.equal(controls.isAirborne,undefined);assert.equal(hotkey({key:' ',code:''}),'Space');assert.equal(hotkey({key:' ',code:'Unidentified'}),'Space');assert.equal(hotkey({key:'w',code:''}),'')});

test('WASD and the arrow keys turn and tilt the camera; opposite keys cancel',async()=>{
 const {cameraKeyAxes,cameraKey}=await import('../mmorpg-controls.js');
 assert.deepEqual(cameraKeyAxes(['ArrowLeft']),{yaw:-1,pitch:0});assert.deepEqual(cameraKeyAxes(['KeyD']),{yaw:1,pitch:0});
 assert.deepEqual(cameraKeyAxes(['KeyW','ArrowUp']),{yaw:0,pitch:1},'clamped');assert.deepEqual(cameraKeyAxes(['KeyA','KeyD','KeyS']),{yaw:0,pitch:-1});
 assert.equal(cameraKey({code:'KeyW'}),'KeyW');assert.equal(cameraKey({code:'',key:'a'}),'KeyA');assert.equal(cameraKey({code:'KeyQ'}),null);
});
