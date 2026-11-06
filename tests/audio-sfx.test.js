import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {spatialMix,onsetOffset,SAMPLE_SETS} from '../sfx.js';
import {ambienceMix,AMBIENCE_BEDS} from '../ambience.js';
import crypto from 'node:crypto';
import {composeJingle,skillFamily} from '../jingles.js';
import {createLevelTracker,levelUpText,jingleFor} from '../level-up.js';
import {DEFAULT_VOLUMES} from '../music.js';

test('positional sounds fade with distance, pan by camera bearing and go silent far away',()=>{
 const L={x:0,z:0,yaw:0};
 assert.equal(spatialMix({x:0,z:1},L).gain,1);
 const near=spatialMix({x:0,z:-10},L),far=spatialMix({x:0,z:-30},L);assert.ok(near.gain>far.gain&&far.gain>0);
 assert.equal(spatialMix({x:0,z:-60},L).gain,0);
 // yaw 0: the camera sits at +z looking toward −z, so +x is screen-right.
 assert.ok(spatialMix({x:10,z:0},L).pan>0);assert.ok(spatialMix({x:-10,z:0},L).pan<0);
 assert.ok(spatialMix({x:0,z:-30},L).cutoff<spatialMix({x:0,z:-5},L).cutoff,'distant sounds are darker');
});

test('sample onsets skip encoder padding so impacts land on the frame',()=>{
 const d=new Float32Array(1000);d[400]=.9;d[401]=-.5;assert.ok(Math.abs(onsetOffset(d,1000)-.398)<1e-9);assert.equal(onsetOffset(new Float32Array(10),1000),0);
});

test('every recorded effect ships as a small mono file',()=>{
 const files=new Set(Object.values(SAMPLE_SETS).flat());let total=0;
 for(const f of files){const url=new URL('../assets/audio/sfx/'+f+'.mp3',import.meta.url),size=fs.statSync(url).size;total+=size;assert.ok(size>500&&size<260000,f+' '+size)}
 // Weather beds and thunder (about 0.37 MB) load only once it rains or storms.
 assert.ok(total<1.45e6,'total '+total);
 const credits=fs.readFileSync(new URL('../credits.html',import.meta.url),'utf8');for(const who of ['thimras','kheetor','ezduzziteh','rubberduck','starninjas','Kresiek The Furry','WuxiaScrub'])assert.ok(credits.includes(who),who);
});

test('area sounds: day birds and night crickets crossfade, water by rivers, wind in the snow, quiet indoors',()=>{
 const day=ambienceMix({day:1,forest:.8}),night=ambienceMix({day:0,forest:.8}),dusk=ambienceMix({day:.5,forest:.8});
 assert.ok(day.birds>.3&&night.birds===0);assert.ok(night.crickets>.3&&day.crickets===0);assert.ok(day.wind>.05,'a light breeze under the birds');
 assert.ok(dusk.birds>.1&&dusk.crickets>.1,'dawn and dusk blend the two');
 assert.equal(ambienceMix({water:0}).water,0);assert.ok(ambienceMix({water:1}).water>ambienceMix({water:.4}).water);
 const snow=ambienceMix({snow:1,day:1});assert.ok(snow.wind>ambienceMix({day:1}).wind*2&&snow.birds<day.birds/3&&snow.wind>snow.birds);
 const inside=ambienceMix({indoors:1,day:1,water:1});assert.ok(inside.birds<day.birds/2&&inside.water<ambienceMix({day:1,water:1}).water/2);
 assert.deepEqual(Object.keys(ambienceMix()).sort(),['birds','crickets','water','wind']);
});

test('ambience plays only the new field-recording beds: no old files, no one-shots, no synthesis',()=>{
 assert.deepEqual(Object.keys(AMBIENCE_BEDS).sort(),['birds','crickets','water','wind']);assert.ok(AMBIENCE_BEDS.birds&&AMBIENCE_BEDS.crickets,'day and night beds');
 const dir=new URL('../assets/audio/ambience/',import.meta.url),credits=fs.readFileSync(new URL('CREDITS.md',dir),'utf8');
 const hash=u=>crypto.createHash('sha256').update(fs.readFileSync(u)).digest('hex');
 const old=new Set([...fs.readdirSync(new URL('../assets/audio/sfx/',import.meta.url)).map(f=>hash(new URL('../assets/audio/sfx/'+f,import.meta.url))),
  ...fs.readdirSync(new URL('../assets/audio/',import.meta.url)).filter(f=>f.endsWith('.mp3')).map(f=>hash(new URL('../assets/audio/'+f,import.meta.url)))]);
 for(const f of Object.values(AMBIENCE_BEDS)){const u=new URL(f+'.mp3',dir),size=fs.statSync(u).size;assert.ok(size>100000&&size<1.05e6,f+' '+size);assert.ok(!old.has(hash(u)),f+' reuses an old recording');assert.ok(credits.includes(f+'.mp3'),f+' credited')}
 const src=fs.readFileSync(new URL('../ambience.js',import.meta.url),'utf8');
 for(const name of ['amb-birds','amb-river','amb-wind','amb-fire','amb-crowd','amb-lap','amb-rain','cricket.mp3',"'cricket'",'nature-birds','nature-crickets','birdSong','dog','anvil','crackle','sheep','frog','/sfx/'])assert.ok(!src.includes(name),'old asset referenced: '+name);
 assert.ok(!/createOscillator|OscillatorNode|createPeriodicWave|createNoise|\.proc\(|\.bird\(|sfx\.sample\('(?!thunder)/.test(src),'no synthesized or one-shot calls');
});

test('default mix keeps music well under the area sounds (RuneScape style)',()=>{
 const music=DEFAULT_VOLUMES.music/100*.7,area=DEFAULT_VOLUMES.environment/100;assert.ok(music/area>.3&&music/area<.42,'ratio '+music/area);
});

test('jingles: original 4–5 s fanfares per skill family, a distinct combat-level one',()=>{
 for(const kind of ['combat','gathering','artisan','combatLevel']){const s=composeJingle(kind);assert.ok(s.duration>=4&&s.duration<=5.6,kind+' '+s.duration);assert.ok(s.notes.length>12);assert.ok(s.notes.some(n=>n.inst==='brass'))}
 assert.notDeepEqual(composeJingle('combat').notes.map(n=>n.m),composeJingle('combatLevel').notes.map(n=>n.m));
 assert.equal(skillFamily('attackXP'),'combat');assert.equal(skillFamily('fishingXP'),'gathering');assert.equal(skillFamily('cookingXP'),'artisan');
});

test('level-up flow: each skill message in order, then the combat level, each with its jingle',()=>{
 const t=createLevelTracker();t.update({});const notices=t.update({attackXP:450,fishingXP:83});
 assert.deepEqual(notices.map(n=>n.type+':'+n.name),['skill:Attack','skill:Fishing','combat:Combat']);
 assert.deepEqual(levelUpText(notices[0]),{title:'Congratulations, you just advanced an Attack level.',body:'Your Attack level is now 5.'});
 assert.equal(levelUpText(notices[1]).title,'Congratulations, you just advanced a Fishing level.');
 assert.deepEqual(levelUpText(notices[2]),{title:'Congratulations, you just advanced a combat level.',body:'Your combat level is now 4.'});
 assert.deepEqual(notices.map(jingleFor),['combat','gathering','combatLevel']);
});
