import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const source=readFileSync(new URL('../music.js',import.meta.url),'utf8').replace('export function startMusic()','function startMusic()');

function fakeNode(){
 const param={value:0,setValueAtTime(){},linearRampToValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(value){this.value=value}};
 return {gain:{...param},frequency:{...param},Q:{value:0},threshold:{value:0},ratio:{value:0},connect(){},disconnect(){},start(){},stop(){},getChannelData(){return new Float32Array(8)}};
}
test('music settings mute preserves ambient audio context',async()=>{
 const audioContexts=[];
 class AudioContext{
  constructor(){this.sampleRate=4;this.currentTime=0;this.destination=fakeNode();this.suspended=false;audioContexts.push(this)}
  createGain(){return fakeNode()}createDynamicsCompressor(){return fakeNode()}
  createBuffer(){return fakeNode()}createBufferSource(){return fakeNode()}
  createBiquadFilter(){return fakeNode()}createOscillator(){return fakeNode()}
  async resume(){this.suspended=false}async suspend(){this.suspended=true}
  async close(){}
 }
 const elements={};
 for(const id of ['music-toggle','music-volume','music-track','settings-music-toggle','settings-music-volume','ambient-volume']){
  elements[id]={value:'45',textContent:'',handlers:{},addEventListener(type,fn){this.handlers[type]=fn},setAttribute(name,value){this[name]=value},dispatchEvent(event){this.handlers[event.type]?.(event)}};
 }
 const document={querySelector(selector){return elements[selector.slice(1)]},addEventListener(){}};
 const window={AudioContext,addEventListener(){}};
 const localStorage={getItem(){return null},setItem(){}};
 const timers=new Map();let nextTimer=0;
 const start=new Function('document','window','localStorage','setInterval','clearInterval',source+';return startMusic;')(document,window,localStorage,(fn)=>{timers.set(++nextTimer,fn);return nextTimer},id=>timers.delete(id));
 start();
 start(); // repeated game initialization must not attach duplicate listeners
 assert.equal(window.eldervaleMusicInitialized,true);
 await elements['settings-music-toggle'].handlers.click();
 assert.equal(audioContexts.length,1);
 assert.equal(elements['music-toggle'].textContent,'Music On');
 await elements['settings-music-toggle'].handlers.click();
 assert.equal(elements['music-toggle'].textContent,'Music Off');
 assert.equal(elements['settings-music-toggle'].textContent,'Unmute music');
 assert.equal(audioContexts[0].suspended,false,'muting music must not suspend ambient audio');
 window.eldervaleSetAudioRegion('Wilderness');
 audioContexts[0].currentTime=3; // advance the mocked clock beyond scheduled notes
 for(const tick of timers.values())tick();
 assert.equal(elements['music-track'].textContent,'Wilderness ambience');
 await elements['settings-music-toggle'].handlers.click();
 assert.equal(elements['music-toggle'].textContent,'Music On');
});
