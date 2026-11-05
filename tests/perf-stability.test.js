import test from 'node:test';import assert from 'node:assert/strict';
import {morphChildren,setMarkup,setText,changeGate} from '../ui-stable.js';
import {isTablet,lowerTier,createFrameGovernor,cullDistance,createDistanceCuller,HIDDEN_LAYER} from '../graphics-quality.js';
import {deviceProfile,effectiveGraphics} from '../responsive.js';
import {footprintHeights,groundedBase,propBase,structurePlot,isFoundationStructure} from '../foundation.js';
import {createLandscape} from '../landscape.js';

// Minimal element: enough DOM for morphChildren (isEqualNode compares markup, not handlers).
class El{constructor(tag,text='',attrs={}){this.nodeType=1;this.tag=tag;this.text=text;this.attrs=attrs;this.childNodes=[];this.onclick=null}
 append(...c){for(const n of c){n.parent=this;this.childNodes.push(n)}return this}
 appendChild(n){return this.append(n),n}
 replaceChild(n,o){const i=this.childNodes.indexOf(o);this.childNodes[i]=n;n.parent=this;this.writes=(this.writes||0)+1;return o}
 removeChild(o){this.childNodes.splice(this.childNodes.indexOf(o),1);this.writes=(this.writes||0)+1;return o}
 isEqualNode(b){return b.tag===this.tag&&b.text===this.text&&JSON.stringify(b.attrs)===JSON.stringify(this.attrs)&&b.childNodes.length===this.childNodes.length&&this.childNodes.every((c,i)=>c.isEqualNode(b.childNodes[i]))}}
const slot=(id,n,handler)=>{const b=new El('button','',{id});b.append(new El('svg','icon-'+id),new El('span',String(n)));b.onclick=handler;return b};

test('bank-style refreshes keep unchanged slot nodes (no SVG re-parse) and adopt fresh handlers',()=>{
 const grid=new El('div');morphChildren(grid,[slot('logs',5),slot('ore',2),slot('fish',1)]);const [logs,ore,fish]=grid.childNodes;
 const h=()=>'new';assert.equal(morphChildren(grid,[slot('logs',5,h),slot('ore',2,h),slot('fish',1,h)]),0,'identical snapshot writes nothing');
 assert.equal(grid.childNodes[0],logs);assert.equal(grid.childNodes[0].onclick,h,'handlers follow the latest render');
 assert.equal(morphChildren(grid,[slot('logs',5),slot('ore',3),slot('fish',1)]),1,'only the changed stack is replaced');
 assert.equal(grid.childNodes[0],logs);assert.notEqual(grid.childNodes[1],ore);assert.equal(grid.childNodes[2],fish);
 assert.equal(morphChildren(grid,[slot('logs',5)]),2,'removed slots are dropped');assert.equal(grid.childNodes.length,1);
});
test('markup and text writes are skipped when nothing changed',()=>{
 const node={innerHTML:'',textContent:'a'};let writes=0;const proxy=new Proxy(node,{set(t,k,v){if(k==='innerHTML')writes++;t[k]=v;return true}});
 assert.equal(setMarkup(proxy,'<svg/>'),true);assert.equal(setMarkup(proxy,'<svg/>'),false);assert.equal(writes,1);
 assert.equal(setText(node,'a'),false);assert.equal(setText(node,'b'),true);
 const gate=changeGate();assert.equal(gate.changed('k'),true);assert.equal(gate.changed('k'),false);gate.reset();assert.equal(gate.changed('k'),true);
});

test('iPads (including desktop-mode Safari) are tablets and start on the medium tier with a 1.5 pixel cap',()=>{
 const ipad='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
 assert.equal(isTablet({ua:ipad,maxTouchPoints:5}),true);assert.equal(isTablet({ua:ipad,maxTouchPoints:0}),false,'a Mac is not a tablet');
 assert.equal(isTablet({ua:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',maxTouchPoints:10,touch:true,coarse:true}),false);
 const p=deviceProfile({width:1180,height:820,touch:true,coarse:true,tablet:true});assert.equal(p.compact,false);assert.equal(p.tablet,true);assert.equal(p.preset,'medium');
 const g=effectiveGraphics({preset:'auto'},p);assert.equal(g.pixelCap,1.5);assert.equal(g.distance,210);
 assert.equal(deviceProfile({width:1440,height:900}).preset,'high');assert.equal(effectiveGraphics({preset:'high'},p).pixelCap,2.5,'explicit presets are honoured');
 assert.equal(lowerTier('high'),'medium');assert.equal(lowerTier('low'),'low');
});
test('frame governor lowers resolution under sustained long frames, recovers slowly, then asks for a lower tier',()=>{
 const g=createFrameGovernor({min:.7,settle:1000,recover:3000,degrade:4000});let t=0,events=[];
 const run=(ms,dt)=>{for(const end=t+ms;t<end;t+=dt){const e=g.sample(dt,t);if(e)events.push([e,g.scale])}};
 run(3000,16.7);assert.equal(g.scale,1,'60 fps keeps full resolution');
 run(6000,28);assert.ok(g.scale<1&&g.scale>=.7,'30 fps drops resolution');const low=g.scale;
 run(1000,400);assert.equal(g.scale,low,'tab-switch gaps are ignored');
 run(12000,28);assert.ok(events.some(([e])=>e==='tier'),'still slow at the floor: fall back a tier');
 g.reset();t=0;events=[];run(3000,40);run(30000,16.7);assert.equal(g.scale,1,'recovers when frames are fast again');
});
test('distance culling hides small far objects on a spare layer without touching visible',()=>{
 const layers=()=>({mask:1,set(n){this.mask=1<<n}});const obj=(x,r,children=[])=>{const o={position:{x,y:0,z:0},visible:true,layers:layers(),r,children,traverse(f){f(o);for(const c of children)f(c)}};return o};
 const pebble=obj(150,1,[{layers:layers()}]),house=obj(250,9),tower=obj(200,40),near=obj(20,1);
 const culler=createDistanceCuller({radiusOf:o=>o.r});const cam={x:0,y:0,z:0},fog={fogNear:148,far:330};
 culler.update([pebble,house,tower,near],cam,fog,0,true);
 assert.equal(pebble.layers.mask,1<<HIDDEN_LAYER);assert.equal(pebble.children[0].layers.mask,1<<HIDDEN_LAYER);assert.equal(pebble.visible,true);
 assert.equal(house.layers.mask,1,'large buildings stay until the fog hides them');assert.equal(tower.layers.mask,1);assert.equal(near.layers.mask,1);
 pebble.position.x=30;culler.update([pebble],cam,fog,1000,true);assert.equal(pebble.layers.mask,1,'shown again when the camera comes close');
 assert.ok(cullDistance(1,fog)<cullDistance(8,fog));assert.ok(cullDistance(50,fog)<=330);
});

test('structures get a levelled pad and props sit on the low side of sloped ground',()=>{
 assert.equal(isFoundationStructure({template:'farm_hut'}),true);assert.equal(isFoundationStructure({template:'farm_hut',floor:1}),false);assert.equal(isFoundationStructure({template:'rock'}),false);
 const plot=structurePlot({template:'farm_hut',x:1,z:2,scale:1,yaw:90});assert.ok(plot.scaleX*2.12>=2.2&&plot.scaleZ*1.98>=1.8);assert.ok(Math.abs(plot.rotation-Math.PI/2)<1e-9);
 const slope=(x)=>x*.4,heights=footprintHeights((x,z)=>slope(x),{x:0,z:0,hx:2,hz:1});assert.ok(Math.abs(heights.min+.8)<1e-9&&Math.abs(heights.max-.8)<1e-9);
 const base=groundedBase(heights);assert.ok(base<=heights.min+.2&&base>=heights.min,'no edge floats more than a few centimetres');
 assert.equal(groundedBase({center:2,min:2,max:2.03}),2,'flat ground keeps the centre height');
 assert.equal(propBase((x)=>x,{template:'unknown',x:0,z:0}),null);
});
test('a structure plot really flattens the landscape under its whole footprint',()=>{
 const land=createLandscape({segments:60,extent:240,approach:false});let best=null;
 for(let x=-100;x<=100;x+=8)for(let z=-100;z<=100;z+=8){const f=footprintHeights(land.heightAt,{x,z,hx:2.6,hz:2.2});if(land.waterAt(x,z)<=0&&(!best||f.max-f.min>best.spread))best={x,z,spread:f.max-f.min}}
 assert.ok(best.spread>.2,'test needs a sloped site');const d={template:'farm_hut',x:best.x,z:best.z,scale:1,yaw:25};
 land.levelBuildingPlot({...structurePlot(d),levelHeight:land.heightAt(d.x,d.z),register:false});
 const after=footprintHeights(land.heightAt,{x:d.x,z:d.z,hx:2.2,hz:1.8,rotation:25*Math.PI/180});assert.ok(after.max-after.min<.02,'hut walls meet level ground: '+(after.max-after.min));
});
