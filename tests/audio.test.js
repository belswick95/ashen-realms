import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {townMusic,musicRegion,wildernessSound,audioPreference,loginMusic,wildernessMusic,capitalMusic} from '../audio-regions.js';
import {landscapeSettlements} from '../geography.js';import {coverPoint} from '../login-fire.js';
test('every actual town has a distinct licensed recording on disk',()=>{
 const credits=JSON.parse(fs.readFileSync(new URL('../assets/audio/credits.json',import.meta.url)));assert.equal(townMusic.length,landscapeSettlements.length+1);assert.equal(new Set(townMusic.map(t=>t.title)).size,townMusic.length);
 for(const [x,z] of landscapeSettlements){const region=musicRegion({x,z});assert.ok(region,`${x},${z} requires music`);const credit=credits.find(c=>c.id===region.id);assert.equal(credit.title,region.title);assert.equal(credit.license,'CC BY 4.0');assert.ok(fs.statSync(new URL('..'+credit.file,import.meta.url)).size>100000)}
 assert.equal(credits.find(c=>c.id==='login')?.title,loginMusic.title);assert.equal(credits.find(c=>c.id==='wilderness')?.title,wildernessMusic.title);assert.equal(credits.find(c=>c.id==='birchford')?.title,capitalMusic.title);
});
test('soundtrack revamp: login, castle, capital, wilderness and fanfares are licensed, credited, web-sized files',async()=>{
 const credits=JSON.parse(fs.readFileSync(new URL('../assets/audio/credits.json',import.meta.url))),page=fs.readFileSync(new URL('../credits.html',import.meta.url),'utf8'),main=page.slice(0,page.indexOf('</main>'));
 for(const id of ['login','castle','wilderness','birchford','level-up-skill','level-up-combat']){const c=credits.find(x=>x.id===id);assert.ok(c,id);assert.match(c.license,/^CC BY 4\.0$|^CC0/,id);assert.equal(c.file,'/assets/audio/'+id+'.mp3');const size=fs.statSync(new URL('..'+c.file,import.meta.url)).size;assert.ok(size>40000&&size<3000000,id+' '+size);assert.ok(main.includes(c.title),c.title+' credited in credits.html')}
 assert.ok(!credits.some(c=>c.title==='Clash Defiant'),'the old login theme is gone');assert.ok(!fs.existsSync(new URL('../assets/audio/level-up.mp3',import.meta.url)),'the old level-up file is gone');
 assert.equal(townMusic.find(t=>t.id==='castle').title,'Banners over Eldervale');assert.ok(wildernessMusic.gain>0&&wildernessMusic.gain<=.5,'wilderness music sits low under the nature beds');
 // The live seeded world: Birchford (generated town 0) plays the capital theme. Same module instances as audio-regions.js.
 const v=fs.readFileSync(new URL('../audio-regions.js',import.meta.url),'utf8').match(/procedural-world\.js(\?v=[^']*)'/)[1],{configureWorld}=await import('../procedural-world.js'+v),{townExtent}=await import('../capital-layout.js'+v);
 const world=configureWorld({enabled:true,seed:241916600});try{assert.equal(world.towns[0].name,'Birchford');const capital=townExtent(world.towns[0],48);assert.equal(musicRegion({x:capital.x,z:capital.z}).id,capitalMusic.id);assert.equal(musicRegion({x:capital.x+capital.radius+40,z:capital.z+capital.radius+40}),null)}finally{configureWorld(null)}
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
