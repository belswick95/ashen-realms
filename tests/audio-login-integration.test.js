import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const music=readFileSync(new URL('../music.js',import.meta.url),'utf8');
const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
const game=readFileSync(new URL('../game.js',import.meta.url),'utf8');
const auth=readFileSync(new URL('../auth.js',import.meta.url),'utf8');

test('login audio initializes before entering game',()=>{
 assert.match(auth,/import \{startMusic\} from '\.\/music\.js\?v=login-audio-/);
 assert.match(auth,/startMusic\(\);/);
 assert.match(music,/The Gates of Eldervale/);
});
test('music and ambience controls exist in settings',()=>{
 for(const id of ['settings-music-toggle','settings-music-volume','ambient-volume'])assert.ok(html.includes('id="'+id+'"'),id);
 assert.match(html,/#game-ui #music-controls\{display:none!important\}/);
});
test('region detection is throttled and feeds audio',()=>{
 assert.match(game,/nextAudioRegionCheck=now\+1500/);
 assert.match(game,/window\.eldervaleSetAudioRegion\?\.\(nearest\)/);
});
test('wilderness suppresses score but retains ambience',()=>{
 assert.match(music,/region!=='Wilderness'\)brass/);
 assert.match(music,/region==='Wilderness'\?v\*\.15/);
});
test('castle art and login card are layered separately',()=>{
 assert.match(html,/class="auth-fortress"/);
 assert.match(html,/#auth-screen \.auth-card\{position:relative;z-index:1\}/);
});
