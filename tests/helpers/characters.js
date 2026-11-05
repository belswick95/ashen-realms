// Loads the real character assets from disk for Node tests.
import fs from 'node:fs';import {fileURLToPath} from 'node:url';
import * as T from 'three';import {preloadCharacters} from '../../character-assets.js';
export async function loadCharacters(){return preloadCharacters(T,{read:async url=>{const b=fs.readFileSync(fileURLToPath(url));return b.buffer.slice(b.byteOffset,b.byteOffset+b.byteLength)}})}
