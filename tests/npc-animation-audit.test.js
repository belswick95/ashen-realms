import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('every clip the animator, town jobs and monsters name exists in the animation library',()=>{
 const b=fs.readFileSync(new URL('../assets/characters/animations.glb',import.meta.url)),len=b.readUInt32LE(12),names=new Set(JSON.parse(b.subarray(20,20+len)).animations.map(a=>a.name));
 const src=['animation.js','npc-activities.js','town-life.js','world-models.js','character-display.js'].map(read).join('\n');
 const used=new Set([...src.matchAll(/'([A-Z][A-Za-z0-9]*_[A-Za-z0-9_]+|Interact|Roll|Death01)(?:@loop)?'/g)].map(m=>m[1]));
 const missing=[...used].filter(n=>!names.has(n));assert.deepEqual(missing,[],'a missing clip fades the character into its bind (T) pose');
});
test('hits flinch: callers start hit timers at .3-.45 s, so the animator reacts to a fresh hit, not a .5 threshold',()=>{
 const anim=read('animation.js');assert.match(anim,/hitNow>lastHit\+\.05/);assert.doesNotMatch(anim,/hitNow>\.5&&lastHit<=\.5/);
});
test('server monsters play their death before disappearing',()=>{
 const game=read('game.js');assert.match(game,/DEATH_SHOW_MS=2800/);assert.match(game,/dead:dying/);assert.match(game,/actor\.dyingSince=performance\.now\(\)/);
 assert.match(read('world-models.js'),/return \{humanoid:true,update\(dt,m\)/,'humanoid monsters collapse through their animator; beasts topple');
});
