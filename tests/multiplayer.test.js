import test from 'node:test';import assert from 'node:assert/strict';
import {createPlayerRoster,startMultiplayer} from '../multiplayer.js';
const packet=(id,session,x=1,sequence=1)=>({id,session,username:id,x,z:2,yaw:0,sequence,appearance:{hair:'Long'},loadout:{weapon:'longsword'}});
test('movement broadcasts cannot be rewound by stale presence snapshots or out-of-order packets',()=>{
 const roster=createPlayerRoster('self'),seed=packet('friend','friend-tab');
 roster.sync({'friend-tab':[seed]});assert.equal(roster.snapshot()[0].x,1);
 assert.equal(roster.receive({...seed,x:8,sequence:3}),true);roster.sync({'friend-tab':[seed]});assert.equal(roster.snapshot()[0].x,8);
 assert.equal(roster.receive({...seed,x:4,sequence:2}),false);assert.equal(roster.snapshot()[0].x,8);
 assert.equal(roster.receive(packet('unknown','unknown-tab')),false);
 assert.equal(roster.receive({...seed,x:NaN,sequence:4}),false);
 assert.equal(roster.receive({...seed,id:'forged',sequence:4}),false);
});
test('online rosters exclude self, deduplicate account tabs and remove departed avatars',()=>{
 const roster=createPlayerRoster('self');roster.sync({a:[packet('self','a')],b:[packet('friend','b')],c:[packet('friend','c',4)]});
 assert.equal(roster.snapshot().length,1);assert.equal(roster.snapshot()[0].x,4);
 roster.sync({b:[packet('friend','b')]});assert.equal(roster.snapshot()[0].x,1);
 roster.sync({});assert.deepEqual(roster.snapshot(),[]);
});
function fixture(){
 let time=0,tick,position={x:0,z:0},removed=0;const channels=[],retries=[],states=[],events=new EventTarget();
 const db={channel(){const handlers=[],ch={handlers,tracked:[],sent:[],presenceState:()=>({}),on(type,filter,fn){handlers.push({type,fn});return ch},subscribe(fn){ch.subscription=fn;return ch},async track(p){ch.tracked.push(p);return 'ok'},async send(p){ch.sent.push(p);return 'ok'}};channels.push(ch);return ch},async removeChannel(){removed++}};
 const controller=startMultiplayer({db,user:{id:'self'},sessionId:'self-tab',getPosition:()=>position,onPlayers:()=>{},onStatus:s=>states.push(s),now:()=>time,events,document:null,setInterval:fn=>{tick=fn;return 1},clearInterval:()=>{},setTimeout:(fn,delay)=>{const timer={fn,delay};retries.push(timer);return timer},clearTimeout:()=>{}});
 return {controller,channels,retries,states,events,get removed(){return removed},async join(){await channels.at(-1).subscription('SUBSCRIBED');await Promise.resolve()},async step(moving=true){time+=250;if(moving)position={x:position.x+.1,z:0};await tick()}};
}
test('a moving player tracks presence once and sends bounded broadcast updates without presence flooding',async()=>{
 const f=fixture();await f.join();for(let i=0;i<160;i++)await f.step();
 assert.equal(f.channels[0].tracked.length,1);assert.equal(f.channels[0].sent.length,161);
 assert.equal(f.channels[0].sent[0].type,'broadcast');assert.equal(f.states.at(-1).state,'connected');f.controller.dispose();
});
test('idle players send sparse heartbeats and closed channels reconnect once with backoff',async()=>{
 const f=fixture();await f.join();for(let i=0;i<40;i++)await f.step(false);
 assert.ok(f.channels[0].sent.length<=5);assert.equal(f.channels[0].tracked.length,1);
 await f.channels[0].subscription('CLOSED');await f.channels[0].subscription('CHANNEL_ERROR');
 assert.equal(f.retries.length,1);assert.ok(f.retries[0].delay>=1000);f.retries[0].fn();await f.join();assert.equal(f.channels.length,2);assert.equal(f.states.at(-1).state,'connected');f.controller.dispose();
});
test('page cache restoration rejoins the world and rate limit errors use a long cooldown',async()=>{
 const f=fixture();await f.join();const hide=new Event('pagehide');Object.defineProperty(hide,'persisted',{value:true});f.events.dispatchEvent(hide);assert.equal(f.states.at(-1).state,'offline');
 const show=new Event('pageshow');Object.defineProperty(show,'persisted',{value:true});f.events.dispatchEvent(show);await f.join();assert.equal(f.channels.length,2);
 f.channels[1].handlers.find(h=>h.type==='system').fn({status:'error',message:'Client presence rate limit exceeded'});assert.ok(f.retries[0].delay>=60000);f.controller.dispose();
});
