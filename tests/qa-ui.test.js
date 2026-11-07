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
