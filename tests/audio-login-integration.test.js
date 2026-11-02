import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {townMusic,musicRegion} from '../audio-regions.js';
test('login artwork, fire, account flow and audio are separate local resources',()=>{
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 for(const id of ['login-art','login-fire','auth-form','auth-login-tab','auth-create-tab','login-sound-toggle'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.ok(html.includes('/login-screen.js?v='));assert.ok(html.includes('/assets/art/fortress.webp'));assert.ok(html.includes('/credits.html'));
});
test('every town selects its own score while world landmarks outside towns remain environmental',()=>{
 assert.equal(new Set(townMusic.map(t=>t.id)).size,townMusic.length);for(const town of townMusic)assert.equal(musicRegion({x:town.x,z:town.z}).id,town.id);
 assert.equal(musicRegion({x:132,z:26}),null);assert.equal(musicRegion({x:60,z:120}),null);
});
