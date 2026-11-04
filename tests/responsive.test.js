import test from 'node:test';import assert from 'node:assert/strict';import {deviceProfile,effectiveGraphics} from '../responsive.js';
test('phones optimize automatically in portrait and touch landscape',()=>{for(const p of [{width:390,height:844},{width:844,height:390,coarse:true}]){const d=deviceProfile(p);assert.equal(d.compact,true);const g=effectiveGraphics({preset:'auto'},d);assert.equal(g.shadows,true);assert.equal(g.pixelCap,1.5)}});
test('automatic quality considers memory and explicit preferences remain intact',()=>{assert.equal(deviceProfile({width:390,height:844,memory:4}).preset,'low');const g=effectiveGraphics({preset:'high',shadows:true,scale:1,distance:330},deviceProfile({width:390,height:844}));assert.equal(g.shadows,true);assert.equal(g.pixelCap,2.5);assert.equal(deviceProfile({width:1440,height:900}).compact,false)});

test('phones require rotation in portrait and resume in landscape',()=>{assert.equal(deviceProfile({width:390,height:844,coarse:true}).rotateRequired,true);assert.equal(deviceProfile({width:844,height:390,coarse:true}).rotateRequired,false);assert.equal(deviceProfile({width:390,height:844,coarse:false}).rotateRequired,false)});

test('short touch screens use the compact HUD even when Safari reports a desktop pointer or wide viewport',()=>{
 for(const dimensions of [{width:1366,height:600},{width:1024,height:500},{width:932,height:430}])assert.equal(deviceProfile({...dimensions,touch:true,coarse:false}).compact,true);
 assert.equal(deviceProfile({width:1440,height:900,touch:true}).compact,false);
});
