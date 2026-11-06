import test from 'node:test';import assert from 'node:assert/strict';import {createLevelTracker,levelSkills} from '../level-up.js';import fs from 'node:fs';
// QA (fix113): game.js called jingleFor() on every level-up without importing it, so each level-up threw
// "jingleFor is not defined" and the fireworks/celebrate step never ran. Any export of a module game.js
// imports from that game.js calls as a bare function must be imported (or declared locally).
test('game.js imports every sibling-module export it calls',()=>{
 const src=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');const imported=new Set(),mods=[];
 for(const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*'\.\/([\w-]+\.js)/g)){for(const n of m[1].split(','))imported.add(n.trim().split(/\s+as\s+/).pop());mods.push(m[2])}
 const local=new Set([...src.matchAll(/(?:function\s+|(?:const|let|var)\s+)([A-Za-z_$][\w$]*)/g)].map(m=>m[1]));
 for(const d of src.matchAll(/(?:const|let|var)\s+\{([^}]*)\}\s*=/g))for(const n of d[1].split(','))local.add(n.trim().split(':').pop().trim());
 const missing=[];for(const f of mods){const ms=fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');
  for(const m of ms.matchAll(/export\s+(?:async\s+)?(?:function\s*\*?|const|let)\s+([A-Za-z_$][\w$]*)/g)){const n=m[1];if(imported.has(n)||local.has(n))continue;if(new RegExp('(?<![.\\w$])'+n.replace(/\$/g,'\\$')+'\\(').test(src))missing.push(f+':'+n)}}
 assert.deepEqual(missing,[]);
});
test('existing characters establish a baseline without login congratulations',()=>{const t=createLevelTracker();assert.deepEqual(t.update({attackXP:90000,woodXP:20000}),[]);assert.deepEqual(t.update({attackXP:90000,woodXP:20000}),[])});
test('skill gains precede their combat gain and repeated snapshots do not repeat notices',()=>{const t=createLevelTracker();t.update({});const s={attackXP:450};assert.deepEqual(t.update(s).map(n=>[n.type,n.name,n.level]),[['skill','Attack',5],['combat','Combat',4]]);assert.deepEqual(t.update(s),[])});
test('every profession and combat skill has a notice and levels remain capped at 99',()=>{for(const s of levelSkills){const t=createLevelTracker();t.update({});const hp=s.key==='hitpointsXP';assert.ok(t.update({[s.key]:hp?1358:83}).some(n=>n.name===s.name&&n.level===(hp?11:2)),s.name)}const t=createLevelTracker();t.update({attackXP:1e8,strengthXP:1e8,defenceXP:1e8});assert.deepEqual(t.update({attackXP:1e9,strengthXP:1e9,defenceXP:1e9}),[])});
