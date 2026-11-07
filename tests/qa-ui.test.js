// UI QA pass (portrait145): regressions found while driving every panel at phone, iPad and desktop sizes.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';
import {authErrorText} from '../auth-messages.js';
const read=f=>fs.readFileSync(new URL('../'+f,import.meta.url),'utf8');

test('sign-in and sign-up errors read as plain sentences, not raw API codes',()=>{
 assert.match(authErrorText({message:'email rate limit exceeded'}),/wait a few minutes/);
 assert.match(authErrorText({message:'Invalid login credentials'}),/do not match/);
 assert.match(authErrorText({message:'Email not confirmed'}),/confirm your email/);
 assert.match(authErrorText({message:'User already registered'}),/Sign in instead/);
 assert.match(authErrorText(new TypeError('Failed to fetch')),/connection/);
 assert.equal(authErrorText(Error('Username must be 3–20 letters, numbers, or underscores.')),'Username must be 3–20 letters, numbers, or underscores.');
 assert.equal(authErrorText({message:'something odd'}),'Something odd.');
 assert.equal(authErrorText(null),'Something went wrong. Please try again.');
 assert.match(read('auth.js'),/message\(authErrorText\(err\)\)/);
});

test('medieval theme restyles the generic-UI leftovers inside panels (Arial text, green boxes)',()=>{
 const css=read('medieval-theme.css'),tail=css.slice(css.lastIndexOf('QA pass (portrait145)'));
 assert.ok(tail.includes(':is(#side,#social-panel,#contextmenu,#dialog,dialog,.map-card) :not(svg,svg *){font-family:var(--mv-body)!important}'));
 for(const sel of ['.equipment-stats{','.equipment-stats-group{','.player-combat-level{','#settings-tab label{'])assert.ok(tail.includes(sel),sel+' restyled');
 // Display headings keep Cinzel after the blanket body-face rule.
 assert.ok(tail.indexOf('.settings-nav button')>tail.indexOf(':not(svg,svg *)'));
});

test('settings dropdown labels fit the phone panel',()=>{
 const html=read('index.html'),select=html.match(/<select id="graphics-preset"[\s\S]*?<\/select>/)[0];
 for(const [,label] of select.matchAll(/<option[^>]*>([^<]*)<\/option>/g))assert.ok(label.length<=18,label);
});
