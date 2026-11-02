import test from 'node:test';import assert from 'node:assert/strict';import {startMusic} from '../music.js';
function node(){const param={value:0,cancelScheduledValues(){},setValueAtTime(v){this.value=v},setTargetAtTime(v){this.value=v}};return {gain:{...param},frequency:{...param},Q:{value:0},threshold:{value:0},ratio:{value:0},connect(){},disconnect(){},start(){},stop(){}}}
test('music mute keeps the environmental context running and initialization is idempotent',async()=>{
 const keys=['Audio','document','window','localStorage','setInterval','clearInterval','setTimeout','clearTimeout'],previous=Object.fromEntries(keys.map(k=>[k,globalThis[k]]));let contexts=0;
 class Context{constructor(){contexts++;this.sampleRate=4;this.currentTime=0;this.state='suspended';this.destination=node()}createGain(){return node()}createDynamicsCompressor(){return node()}createBiquadFilter(){return node()}createMediaElementSource(){return node()}createBufferSource(){return node()}createBuffer(){return {getChannelData:()=>new Float32Array(16)}}addEventListener(){}async resume(){this.state='running'}async suspend(){this.state='suspended'}async close(){this.state='closed'}}
 class Media{constructor(){this.paused=true}setAttribute(){}addEventListener(){}pause(){this.paused=true}load(){}removeAttribute(){}async play(){this.paused=false}}
 const events={addEventListener(){},removeEventListener(){}};
 globalThis.Audio=Media;globalThis.document={...events,querySelector:selector=>selector==='#auth-screen'?{hidden:false}:null};globalThis.window={...events,AudioContext:Context};globalThis.localStorage={getItem:()=>null,setItem(){}};globalThis.setInterval=()=>1;globalThis.clearInterval=()=>{};globalThis.setTimeout=()=>1;globalThis.clearTimeout=()=>{};
 let engine;try{
  engine=startMusic({scene:'login'});await engine.unlock();assert.equal(startMusic({scene:'login'}),engine);assert.equal(contexts,1);assert.equal(engine.getState().context,'running');assert.equal(engine.getState().environmentEnabled,true);
  engine.toggleMusic();assert.equal(engine.getState().musicEnabled,false);assert.equal(engine.getState().environmentEnabled,true);assert.equal(engine.getState().context,'running');
  engine.toggleMusic();await engine.unlock();assert.equal(engine.getState().musicEnabled,true);assert.equal(engine.getState().context,'running');
 }finally{engine?.dispose();for(const k of keys)if(previous[k]===undefined)delete globalThis[k];else globalThis[k]=previous[k]}
});
