import test from 'node:test';import assert from 'node:assert/strict';
import {npcMenuLabels,npcMenuOptions,npcDialogueChoices,npcService,npcGreeting} from '../npc-options.js';

test('right-click menus list Talk-to first, then the service, then Examine',()=>{
 assert.deepEqual(npcMenuLabels({name:'Birchford Banker',role:'banker'}),['Talk-to Birchford Banker','Bank Birchford Banker','Examine Birchford Banker']);
 assert.deepEqual(npcMenuLabels({name:'Birchford Provisioner',role:'merchant'}),['Talk-to Birchford Provisioner','Trade Birchford Provisioner','Examine Birchford Provisioner']);
 assert.deepEqual(npcMenuLabels({role:'merchant'}),['Talk-to Merchant','Trade Merchant','Examine Merchant'],'unnamed merchants');
 assert.deepEqual(npcMenuOptions({name:'Mara',role:'resident'}).map(o=>o.action),['talk','examine']);
});

test('talking to a banker or merchant offers the service, more lines while there are any, and Goodbye',()=>{
 const banker={name:'B',role:'banker',lines:['Welcome.','Gold is safe here.']};
 assert.deepEqual(npcDialogueChoices(banker,0).map(c=>c.label),["I'd like to access my bank account.",'Tell me more.','Goodbye.']);
 assert.deepEqual(npcDialogueChoices(banker,1).map(c=>c.action),['bank','goodbye'],'last line: no more');
 assert.deepEqual(npcDialogueChoices({role:'merchant',lines:['Hi']},0).map(c=>c.label),["I'd like to see what you have for sale.",'Goodbye.']);
 assert.equal(npcService({role:'guard'}),null);assert.equal(npcGreeting({role:'banker'}),'Good day. How may I help you?');assert.equal(npcGreeting(banker),'Welcome.');
});
