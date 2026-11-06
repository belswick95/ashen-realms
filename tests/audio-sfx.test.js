import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {spatialMix,onsetOffset,SAMPLE_SETS,BED_FILES} from '../sfx.js';
import {ambienceMix,ambienceRates} from '../ambience.js';
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

test('every recorded effect and ambient bed ships as a small mono file',()=>{
 const files=new Set([...Object.values(SAMPLE_SETS).flat(),...Object.values(BED_FILES)]);let total=0;
 for(const f of files){const url=new URL('../assets/audio/sfx/'+f+'.mp3',import.meta.url),size=fs.statSync(url).size;total+=size;assert.ok(size>500&&size<260000,f+' '+size)}
 assert.ok(total<1.2e6,'total '+total);
 const credits=fs.readFileSync(new URL('../credits.html',import.meta.url),'utf8');for(const who of ['thimras','kheetor','ezduzziteh','rubberduck','starninjas'])assert.ok(credits.includes(who),who);
});

test('area sounds crossfade with the day, water, towns and the Winterwatch and Emberspire biomes',()=>{
 const day=ambienceMix({day:1,forest:.8}),night=ambienceMix({day:0,forest:.8});
 assert.ok(day.birds>.3&&night.birds===0);assert.ok(night.crickets>.3&&day.crickets===0);
 assert.equal(ambienceMix({water:0}).river,0);assert.ok(ambienceMix({water:1}).river>ambienceMix({water:.4}).river);
 assert.ok(ambienceMix({town:1}).crowd>.2&&ambienceMix({town:0}).crowd===0);
 const snow=ambienceMix({snow:1,day:1});assert.ok(snow.wind>ambienceMix({day:1}).wind*2&&snow.birds<day.birds/3);
 assert.ok(ambienceMix({ember:1}).fire>.4);assert.ok(ambienceMix({indoors:1,day:1}).birds<ambienceMix({day:1}).birds);
 const r=ambienceRates({day:0,forest:1,water:1});assert.ok(r.owl>0&&!r.frog&&r.bird===0);
 const t=ambienceRates({day:1,town:1,smithy:1,chapel:1});assert.ok(t.hammer>0&&t.bell>0&&t.cart>0&&t.dog>0);
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
