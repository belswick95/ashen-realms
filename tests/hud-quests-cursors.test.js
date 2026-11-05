import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {isBusy} from '../cursors.js';
const read=f=>readFileSync(new URL('../'+f,import.meta.url),'utf8');
const html=read('index.html'),css=read('gameplay.css');

test('quests are a tab in the bottom-right panel with a hand-written compass icon',()=>{
 const tabs=html.slice(html.indexOf('<div class="tabs">'),html.indexOf('<div id="inventory">'));
 const quest=tabs.match(/<button[^>]*data-tab="quests"[^>]*>([\s\S]*?)<\/button>/);
 assert.ok(quest,'Quests tab button exists in #side .tabs');
 assert.match(quest[1],/^<svg viewBox="0 0 32 32"[^>]*class="fantasy-tab-icon"/,'inline SVG in the shared tab-icon style');
 assert.doesNotMatch(quest[1],/<image|<img|data:/,'no raster art');
 assert.ok(tabs.indexOf('data-tab="quests"')<tabs.indexOf('data-tab="settings"'),'Settings stays the last tab');
 assert.match(html,/<div id="quests-tab" hidden>/);
 assert.match(read('game.js'),/\['friends','blocked','quests','settings'\]/,'tab switching shows/hides the quests panel');
 const journal=read('quests.js');
 assert.match(journal,/#side \[data-tab=quests\]/);assert.match(journal,/#quests-tab/);
 assert.doesNotMatch(read('quests.css'),/#quest-journal-toggle\{[^}]*display:none/);
});

test('the world map has an on-screen button beside the minimap as well as the M key',()=>{
 assert.match(html,/<div id="map-widget"[\s\S]*?<button id="map-toggle"/);
 assert.match(read('game.js'),/#map-toggle'\)\.onclick=/);
 assert.match(read('game.js'),/e\.key\.toLowerCase\(\)==='m'/);
 assert.match(read('hud-redesign.js'),/class="map-toggle-icon" viewBox="0 0 32 32"/);
 assert.match(css,/#map-widget #map-toggle\{width:38px!important;height:38px!important/);
});

function png(file){const b=readFileSync(new URL('../assets/cursors/'+file,import.meta.url));assert.equal(b.toString('latin1',1,4),'PNG');return [b.readUInt32BE(16),b.readUInt32BE(20)]}
test('pixel-art cursors exist at 32px and 2x, and apply to mouse pointers only',()=>{
 for(const name of ['arrow','hand','wait']){assert.deepEqual(png(name+'.png'),[32,32]);assert.deepEqual(png(name+'@2x.png'),[64,64])}
 const block=css.slice(css.indexOf('@media (hover:hover) and (pointer:fine){'));
 assert.ok(block.length>0&&css.indexOf('--cursor-arrow')>css.indexOf('@media (hover:hover) and (pointer:fine){'),'cursor rules are scoped to fine pointers');
 assert.match(block,/arrow\.png\?v=release-20261105-camera75\) 1 1,auto/);
 assert.match(block,/hand\.png\?v=release-20261105-camera75\) 9 1,pointer/);
 assert.match(block,/wait\.png\?v=release-20261105-camera75\) 15 15,progress/);
 assert.match(block,/canvas\.cursor-interact\{cursor:var\(--cursor-hand\)\}/);
 assert.match(block,/textarea[^{]*\{cursor:text!important\}/);
});

test('hourglass shows while signing in, loading the world or loading an area',()=>{
 const doc=cls=>({body:{classList:{contains:c=>cls.includes(c)}}});
 assert.equal(isBusy(doc([]),{}),false);
 assert.equal(isBusy(doc(['cursor-busy']),{}),true);
 assert.equal(isBusy(doc(['area-loading']),{}),true);
 assert.equal(isBusy(doc([]),{eldervaleWorldLoading:true}),true);
});
