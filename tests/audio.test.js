import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {townMusic,musicRegion,wildernessSound,audioPreference} from '../audio-regions.js';
import {landscapeSettlements} from '../geography.js';import {coverPoint} from '../login-fire.js';
test('every actual town has a distinct licensed recording on disk',()=>{
 const credits=JSON.parse(fs.readFileSync(new URL('../assets/audio/credits.json',import.meta.url)));assert.equal(townMusic.length,landscapeSettlements.length);assert.equal(new Set(townMusic.map(t=>t.title)).size,townMusic.length);
 for(const [x,z] of landscapeSettlements){const region=musicRegion({x,z});assert.ok(region,`${x},${z} requires music`);const credit=credits.find(c=>c.id===region.id);assert.equal(credit.title,region.title);assert.equal(credit.license,'CC BY 4.0');assert.ok(fs.statSync(new URL('..'+credit.file,import.meta.url)).size>100000)}
 assert.ok(credits.some(c=>c.id==='login'&&c.title==='Stoneworld Battle'));
});
test('town boundaries have hysteresis and open wilderness has no music track',()=>{
 const town=townMusic[0];assert.equal(musicRegion({x:51,z:0}),null);assert.equal(musicRegion({x:51,z:0},town),town);assert.equal(musicRegion({x:57,z:0},town),null);
 assert.equal(musicRegion({x:50,z:110}),null);assert.equal(musicRegion({x:132,z:26}),null);assert.equal(wildernessSound({x:157,z:77}),'water');assert.equal(wildernessSound({x:-320,z:-300}),'highlands');
});
test('new visitors get audible default volume while explicit zero/mute is respected',()=>{
 const values=new Map(),storage={getItem:key=>values.has(key)?values.get(key):null};assert.equal(audioPreference(storage,'volume',45),45);values.set('volume','0');assert.equal(audioPreference(storage,'volume',45),0);values.set('volume','99');assert.equal(audioPreference(storage,'volume',45),99);values.set('volume','bad');assert.equal(audioPreference(storage,'volume',45),45);
});
test('fire overlays follow the same cover transform as their painted braziers',()=>{
 const p=coverPoint(1672,941,1672,941,.239,.382);assert.equal(p.x,1672*.239);assert.equal(p.y,941*.382);const q=coverPoint(1280,960,1672,941,.239,.382);assert.ok(q.x>0&&q.x<1280/2);assert.ok(q.y>0&&q.y<960);assert.ok(q.scale>1);
});
