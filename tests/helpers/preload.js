// Loaded before every test file (see package.json "test"): character models
// must be in memory before any test builds a character.
import {loadCharacters} from './characters.js';
await loadCharacters();
