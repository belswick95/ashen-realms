import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {COMBAT_FILES,COMBAT_EVENTS,COMBAT_SAMPLE_SETS,WEAPON_SOUNDS,weaponFamily,monsterFamily,monsterVoice,swingCue,impactCue,deathCue,createCombatAudio,STRIKE_AT} from '../combat-audio.js';
import {SAMPLE_SETS,VOICE_LIMITS,createSfx} from '../sfx.js';
import {weaponCatalog} from '../weapons.js';
import {rosterBeasts} from '../monster-roster.js';

const dir=new URL('../assets/audio/combat/',import.meta.url);
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
const fileOf=sampleName=>new URL('../assets/audio/sfx/'+sampleName+'.mp3',import.meta.url);

test('every combat event maps to recorded files that exist and are small',()=>{
 const sets=new Set(Object.values(COMBAT_EVENTS).flat());
 for(const fam of Object.values(WEAPON_SOUNDS))for(const k of ['swing','hit','stab'])if(fam[k])sets.add(fam[k]);
 for(const set of sets){
  assert.ok(COMBAT_FILES[set]?.length,set+' has files');assert.deepEqual(SAMPLE_SETS[set],COMBAT_SAMPLE_SETS[set],set+' is registered in sfx.js');
  for(const name of SAMPLE_SETS[set]){const u=fileOf(name);assert.ok(fs.existsSync(u),name+' exists');const size=fs.statSync(u).size;assert.ok(size>1000&&size<40000,name+' '+size)}
 }
 for(const ev of ['attack','hit','block','miss','special','magicCast','magicImpact','bowShot','arrowImpact','playerHurt','monsterAttack','monsterDeath','playerDeath'])assert.ok(COMBAT_EVENTS[ev]?.length,ev);
 // Variety where it matters: 2–3 sword swings, 3 blade hits, several parries.
 assert.ok(COMBAT_FILES.swingSword.length>=2&&COMBAT_FILES.hitBlade.length>=3&&COMBAT_FILES.block.length>=2);
 // Nothing on disk is orphaned.
 const used=new Set(Object.values(COMBAT_FILES).flat().map(f=>f+'.mp3'));
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.mp3')))assert.ok(used.has(f),f+' is unused');
 // Short one-shots: at 80 kbit/s a file this size is under ~0.8 s (roars use 96 kbit/s, up to ~1.5 s).
 for(const [set,files] of Object.entries(COMBAT_FILES))for(const f of files){const seconds=fs.statSync(new URL(f+'.mp3',dir)).size*8/(/growl|roar/.test(set)?96000:80000);assert.ok(seconds<(/growl|roar/.test(set)?1.6:.85),f+' '+seconds.toFixed(2)+' s')}
});

test('distinct sounds by weapon type and outcome',()=>{
 const fam=k=>weaponFamily(k,weaponCatalog[k]);
 assert.equal(fam('longsword'),'sword');assert.equal(fam('dagger'),'dagger');assert.equal(fam('battleaxe'),'axe');assert.equal(fam('warhammer'),'blunt');
 assert.equal(fam('spear'),'spear');assert.equal(fam('longbow'),'bow');assert.equal(fam('apprenticeStaff'),'staff');assert.equal(fam('claymore'),'twohand');assert.equal(weaponFamily(null),'unarmed');
 for(const k of Object.keys(weaponCatalog))assert.ok(WEAPON_SOUNDS[fam(k)],k);
 const hits=['sword','dagger','axe','blunt','bow','staff','unarmed'].map(f=>impactCue({family:f,outcome:'hit'})[0].set);assert.equal(new Set(hits).size,hits.length,'each family lands differently');
 assert.equal(swingCue({family:'bow'})[0].set,'bowRelease');assert.equal(swingCue({family:'staff'})[0].set,'magicCast');assert.equal(swingCue({family:'axe'})[0].set,'swingHeavy');
 assert.equal(swingCue({family:'sword',special:true})[0].set,'special');
 assert.equal(impactCue({family:'sword',outcome:'block'})[0].set,'block');assert.equal(impactCue({family:'sword',outcome:'block',armoured:false})[0].set,'miss');
 assert.equal(impactCue({family:'bow',outcome:'block'})[0].set,'miss');assert.equal(impactCue({family:'sword',outcome:'hit',damageType:'stab'})[0].set,'hitStab');
 for(const b of Object.values(rosterBeasts)){const f=monsterFamily(b.attackType,b.weapon,weaponCatalog);assert.ok(WEAPON_SOUNDS[f],b.name+' '+f)}
 assert.equal(monsterVoice('dragon'),'roarDragon');assert.equal(monsterVoice('skeleton'),'growlUndead');assert.equal(monsterVoice('wolf'),'growlBeast');assert.equal(monsterVoice('troll'),'growlBrute');assert.equal(monsterVoice('human'),null);
 assert.deepEqual(deathCue('wolf').map(c=>c.set),['growlBeast','deathThud']);
});

test('impacts wait for the strike frame and use ±5% variation, positional for others',()=>{
 let t=10;const calls=[];const fx={sample:(set,o)=>{calls.push({set,...o});return true}};
 const audio=createCombatAudio({sfx:()=>fx,now:()=>t,random:()=>0});
 audio.swing('npc>me',{family:'blunt'},{at:{x:3,z:0},mine:true});audio.impact('npc>me',{family:'blunt',outcome:'hit'},{at:{x:0,z:0},mine:true,hurt:true});
 const hit=calls.find(c=>c.set==='hitBlunt');assert.ok(Math.abs(hit.delay-STRIKE_AT)<1e-9,'same-tick NPC hit lands on the strike frame');assert.ok(calls.some(c=>c.set==='hurt'));
 t=20;calls.length=0;audio.swing('me>npc',{family:'sword'},{self:true});t=20.6;audio.impact('me>npc',{family:'sword',outcome:'hit'},{self:true});
 assert.equal(calls[1].delay,0,'a hit a tick later plays at once');assert.equal(calls[0].at,null,'own sounds are not positional');
 for(const c of calls){assert.equal(c.vary,.05);assert.equal(c.group,'combat');assert.equal(c.priority,2)}
 calls.length=0;audio.swing('other>npc',{family:'axe'},{at:{x:30,z:4}});assert.deepEqual(calls[0].at,{x:30,z:4});assert.equal(calls[0].priority,1);assert.ok(calls[0].far>=40);
});

// Minimal Web Audio stand-in, enough for sfx.js to schedule buffer voices.
function fakeContext(){
 const node=()=>({connect(){},disconnect(){},gain:{value:1,setTargetAtTime(){}},frequency:{value:0},Q:{value:0},pan:{value:0},type:''});
 const ctx={state:'running',currentTime:0,sampleRate:44100,started:0,stopped:0,
  createGain:node,createBiquadFilter:node,createStereoPanner:node,
  createBufferSource(){const s={...node(),playbackRate:{value:1},start(){ctx.started++},stop(){ctx.stopped++;s.onended?.()}};return s},
  decodeAudioData:async()=>({sampleRate:44100,duration:.3,getChannelData:()=>new Float32Array([0,0,.8,.2])})};
 return ctx;
}
test('a shared voice budget keeps big fights from clipping; own combat outranks others',async()=>{
 assert.ok(VOICE_LIMITS.combat>=6&&VOICE_LIMITS.combat<=16);
 const c=fakeContext(),bus={connect(){}},fx=createSfx({context:()=>c,sfxBus:()=>bus,ambientBus:()=>bus,fetcher:async()=>({ok:true,arrayBuffer:async()=>new ArrayBuffer(8)})});
 await Promise.all(COMBAT_SAMPLE_SETS.hitBlade.map(f=>fx.load(f)));
 let ok=0;for(let i=0;i<VOICE_LIMITS.combat+5;i++)if(fx.sample('hitBlade',{group:'combat',priority:2}))ok++;
 assert.equal(fx.voices('combat'),VOICE_LIMITS.combat);assert.equal(ok,VOICE_LIMITS.combat+5,'equal priority steals the oldest voice');assert.equal(c.stopped,5);
 assert.equal(fx.sample('hitBlade',{group:'combat',priority:1}),false,'a distant fight cannot steal from the player’s own');
 assert.equal(fx.voices('combat'),VOICE_LIMITS.combat);
});

test('combat makes no oscillator or synthesised calls',()=>{
 const combat=read('combat-audio.js');assert.ok(!/createOscillator|OscillatorNode|createPeriodicWave|noiseBuffer|\.proc\(/.test(combat));
 const sfx=read('sfx.js');assert.ok(!/\n\s*(block|hit|whoosh):\(c,o,at\)=>/.test(sfx),'procedural combat voices are gone');
 const game=read('game.js');assert.ok(!/combatSound\(|\.proc\('(whoosh|hit|block)'/.test(game));assert.ok(game.includes('combatAudio.swing(')&&game.includes('combatAudio.impact(')&&game.includes('combatAudio.death('));
 const boss=read('boss-fx.js');assert.ok(!/\.proc\?*\.?\(/.test(boss),'boss beats use recordings');
});

test('every combat file is credited with source, author and a free licence',()=>{
 const md=fs.readFileSync(new URL('CREDITS.md',dir),'utf8'),html=read('credits.html');
 for(const f of fs.readdirSync(dir).filter(f=>f.endsWith('.mp3')))assert.ok(md.includes('| '+f+' |'),f+' credited in CREDITS.md');
 const sources=[...md.matchAll(/\| (\S+) \| \[[^\]]+\]\((https:\/\/[^)]+)\) \| ([^|]+) \| ([^|]+) \|/g)];assert.ok(sources.length>=8);
 for(const [,key,url,author,licence] of sources){assert.match(licence,/CC0|public domain/i,key);assert.ok(author.trim().length>2,key);assert.ok(html.includes(url),url+' in credits.html');assert.ok(md.includes(key+': `'),key+' is used')}
 assert.ok(html.includes('/assets/audio/combat/CREDITS.md'));assert.ok(!/runescape|jagex/i.test(md.replace(/No RuneScape[^.]*\./,'')));
});
