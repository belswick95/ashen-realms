import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';
import {TRADE_REQUEST_SECONDS,TRADE_REQUEST_RANGE,requestDeadline,secondsLeft,requestExpired,requestCancelReason,requestOutcomeMessage,neverOpened,tradeFinished} from '../trade-requests.js';

const A='aaaa',B='bbbb';
const trade=(over={})=>({id:'t1',a:A,b:B,name_a:'Alder',name_b:'Brin',self:A,stage:'invited',revision:1,...over});

test('a trade request lasts ten seconds and counts down to an expiry',()=>{
 assert.equal(TRADE_REQUEST_SECONDS,10);
 const d=requestDeadline(10,1000);assert.equal(d,11000);
 assert.equal(secondsLeft(d,1000),10);assert.equal(secondsLeft(d,1001),10);assert.equal(secondsLeft(d,10500),1);assert.equal(secondsLeft(d,11000),0);assert.equal(secondsLeft(d,99999),0);
 assert.equal(requestExpired(d,10999),false);assert.equal(requestExpired(d,11000),true);
 // The server's remaining time is trusted but never stretched past the window.
 assert.equal(requestDeadline(3.5,0),3500);assert.equal(requestDeadline(120,0),10000);assert.equal(requestDeadline(-4,0),0);assert.equal(requestDeadline(undefined,0),10000);assert.equal(requestDeadline('junk',50),10050);
});

test('requests cancel on combat, leaving the world or moving out of trade range',()=>{
 assert.equal(requestCancelReason({distance:2}),null);
 assert.equal(requestCancelReason({distance:TRADE_REQUEST_RANGE}),null);
 assert.equal(requestCancelReason({distance:TRADE_REQUEST_RANGE+.01}),'moved');
 assert.equal(requestCancelReason({distance:1,sameFloor:false}),'moved');
 assert.equal(requestCancelReason({distance:NaN}),'moved');
 assert.equal(requestCancelReason({distance:1,online:false}),'offline');
 assert.equal(requestCancelReason({distance:50,online:false,inCombat:true}),'combat');
});

test('both players are told how a request ended',()=>{
 const asA=o=>requestOutcomeMessage(trade(o)),asB=o=>requestOutcomeMessage(trade({...o,self:B}));
 assert.equal(asA({stage:'expired',reason:'timeout'}),'Brin did not respond to your trade request.');
 assert.equal(asB({stage:'expired',reason:'timeout'}),'Trade request expired.');
 assert.equal(asA({stage:'declined',reason:'declined'}),'Brin declined the trade.');
 assert.equal(asB({stage:'declined',reason:'declined'}),'You declined the trade request.');
 assert.equal(asA({stage:'cancelled',reason:'cancelled_by_a'}),'You cancelled the trade request.');
 assert.equal(asB({stage:'cancelled',reason:'cancelled_by_a'}),'Alder cancelled the trade request.');
 assert.match(asA({stage:'cancelled',reason:'moved'}),/too far from Brin/);
 assert.match(asB({stage:'cancelled',reason:'combat'}),/combat/);
 assert.match(asB({stage:'cancelled',reason:'offline'}),/left the world/);
 // Pending, open or completed trades are not request outcomes.
 assert.equal(asA({stage:'invited'}),null);
 assert.equal(asA({stage:'cancelled',revision:4,reason:'cancelled_by_b'}),null);
 assert.equal(asA({stage:'complete',revision:6}),null);
 assert.equal(neverOpened(trade({stage:'offer',revision:2})),false);
 assert.ok(['complete','cancelled','declined','expired'].every(tradeFinished));assert.equal(tradeFinished('invited'),false);assert.equal(tradeFinished('offer'),false);
});

test('the server enforces the request window, the target-only accept and the sweep',()=>{
 const sql=readFileSync(new URL('../db/trade-requests.sql',import.meta.url),'utf8');
 assert.match(sql,/clock_timestamp\(\)\+interval '10 seconds'/);
 assert.match(sql,/stage='expired'/);assert.match(sql,/'declined'/);
 assert.match(sql,/trade_request_sweep\(clock_timestamp\(\)\)/);assert.match(sql,/trade_request_sweep\(t\)/);
 assert.match(sql,/<=6/);
});
