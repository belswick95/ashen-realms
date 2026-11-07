import test from 'node:test';import assert from 'node:assert/strict';
import {portraitLook} from '../player-hud.js';
// The HUD portrait re-renders only when this signature changes (player-hud.js).
test('the portrait look changes with worn gear and appearance, and only then',()=>{
 const base=portraitLook({cape:true,knightArmet2:false},{hair:'short',skin:'#c9916b'});
 assert.equal(portraitLook({knightArmet2:false,cape:true},{skin:'#c9916b',hair:'short'}),base,'order and unworn items do not matter');
 for(const [what,look] of [['helmet',portraitLook({cape:true,knightArmet2:true},{hair:'short',skin:'#c9916b'})],['hood',portraitLook({cape:true,rangerHood1:true},{hair:'short',skin:'#c9916b'})],
  ['hair',portraitLook({cape:true},{hair:'long',skin:'#c9916b'})],['cape off',portraitLook({},{hair:'short',skin:'#c9916b'})]])assert.notEqual(look,base,what);
 assert.equal(portraitLook(null,null),'|');assert.equal(portraitLook(),'|');
});
