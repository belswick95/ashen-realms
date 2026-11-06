import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {isPhone,isTablet,characterLod,lodStep,CHARACTER_LOD,CHARACTER_LOD_HYSTERESIS,createDistanceCuller,HIDDEN_LAYER} from '../graphics-quality.js';
import {deviceProfile,effectiveGraphics} from '../responsive.js';
import {createCellBatcher,cellBatchable,cellKey,BATCHED_LAYER} from '../static-batch.js';
import {castleObject} from '../castle-models.js';

const IPHONE='Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1';
const IPAD='Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15';
const PIXEL='Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Mobile Safari/537.36';

test('phones are detected by user agent or a small touch screen; tablets and desktops are not',()=>{
 assert.equal(isPhone({ua:IPHONE,maxTouchPoints:5,touch:true,coarse:true,width:390,height:844}),true);
 assert.equal(isPhone({ua:PIXEL,maxTouchPoints:5,touch:true,width:412,height:915}),true);
 assert.equal(isPhone({ua:'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 Chrome/130.0 Safari/537.36',maxTouchPoints:5,touch:true,width:800,height:1280}),false,'Android tablet');
 assert.equal(isPhone({ua:IPAD,maxTouchPoints:5,touch:true,coarse:true,width:820,height:1180}),false,'iPad');
 assert.equal(isTablet({ua:IPAD,maxTouchPoints:5}),true);
 assert.equal(isPhone({ua:'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',maxTouchPoints:10,touch:true,width:400,height:300}),false,'small desktop window');
 assert.equal(isPhone({ua:'Mozilla/5.0 (X11; Linux x86_64)',width:390,height:844}),false,'no touch, not a phone');
 assert.equal(isPhone({ua:'SomeBrowser/1.0',maxTouchPoints:5,touch:true,width:360,height:780}),true,'unknown UA on a small touch screen');
});
test('phones start on low with a tight pixel cap; desktop high is unchanged',()=>{
 const phone=deviceProfile({width:844,height:390,touch:true,coarse:true,phone:true});
 assert.equal(phone.preset,'low');assert.equal(phone.phone,true);assert.equal(phone.rotateRequired,false);
 const g=effectiveGraphics({preset:'auto'},phone);assert.equal(g.pixelCap,1.25);assert.equal(g.shadows,false);assert.ok(g.distance<=110);
 assert.equal(deviceProfile({width:390,height:844,touch:true,phone:true}).rotateRequired,true,'portrait phone still asks to rotate');
 const desk=deviceProfile({width:1440,height:900});assert.equal(desk.preset,'high');assert.equal(effectiveGraphics({preset:'auto'},desk).pixelCap,2);
 assert.equal(effectiveGraphics({preset:'high'},phone).pixelCap,2.5,'an explicit preset is still honoured on a phone');
});

test('character LOD: full rate near, throttled further out, hidden past the tier draw distance',()=>{
 for(const [preset,t] of Object.entries(CHARACTER_LOD)){
  assert.deepEqual(characterLod(t.full*.5,preset),{draw:true,interval:0,level:0,shadow:t.shadow>=t.full*.5});
  const mid=characterLod((t.full+t.half)/2,preset);assert.equal(mid.level,1);assert.ok(mid.interval>0&&mid.interval<.1);
  const far=characterLod((t.half+t.draw)/2,preset);assert.equal(far.interval,1/t.farRate);assert.ok(far.interval<=1/20+1e-9,'far characters still animate at 20 Hz or more');
  assert.equal(characterLod(t.draw+1,preset).draw,false);assert.equal(characterLod(t.draw+1,preset).shadow,false);
 }
 assert.ok(CHARACTER_LOD.low.draw<CHARACTER_LOD.medium.draw&&CHARACTER_LOD.medium.draw<CHARACTER_LOD.high.draw);
 assert.equal(CHARACTER_LOD.low.shadow,0,'low has no sun shadows');
 assert.deepEqual(characterLod(500,'medium',{focus:true}),{draw:true,interval:0,level:0,shadow:true},'a combat target or conversation partner is always full detail');
 assert.equal(characterLod(Infinity,'high').draw,false);assert.equal(characterLod(NaN,'high').draw,false);
});
test('character LOD keeps a busy city drawn and does not flicker on the draw boundary',()=>{
 for(const [preset,t] of Object.entries(CHARACTER_LOD)){
  assert.ok(t.draw>=70,preset+' draws townsfolk to at least 70 m');assert.ok(t.halfRate>=30,preset+' mid range animates at 30 Hz');
  // Standing just inside the boundary: drawn when already drawn, still hidden when it was hidden.
  assert.equal(characterLod(t.draw-1,preset).draw,true);assert.equal(characterLod(t.draw-1,preset,{hidden:true}).draw,false);
  assert.equal(characterLod(t.draw-CHARACTER_LOD_HYSTERESIS-.5,preset,{hidden:true}).draw,true);
 }
});
test('throttled animation steps carry the skipped time and spread actors over frames',()=>{
 const a={},b={};let ta=0,na=0,first=[];
 for(let f=0;f<60;f++){const sa=lodStep(a,1/60,.1,0),sb=lodStep(b,1/60,.1,.5);if(sa){ta+=sa;na++}if(f<6)first.push([!!sa,!!sb])}
 assert.ok(na>=9&&na<=10,'about 10 updates a second: '+na);assert.ok(Math.abs(ta-(60-1)/60)<.12,'total time is preserved: '+ta);
 assert.ok(first.some(([x,y])=>x!==y),'different phases update on different frames');
 const c={};assert.equal(lodStep(c,1/60,.1,0),0);assert.equal(lodStep(c,1/60,.1,0),0);
 assert.ok(Math.abs(lodStep(c,1/60,0)-3/60)<1e-9,'back to full rate: the carried time is applied at once');
 assert.equal(lodStep(c,1/60,0),1/60);
});

const mat=new T.MeshStandardMaterial(),other=new T.MeshStandardMaterial();
function prop(x,z,{material=mat,extra=[]}={}){const root=new T.Group();root.position.set(x,0,z);
 for(const [y,m] of [[.5,material],[1.5,material],...extra]){const mesh=new T.Mesh(new T.BoxGeometry(1,1,1),m);mesh.position.y=y;mesh.castShadow=true;root.add(mesh)}
 const hit=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial({visible:false}));root.add(hit);return root}
test('cell batcher merges static meshes across entities per cell and material, and hides the originals on a spare layer',()=>{
 const scene=new T.Scene(),host=new T.Group();scene.add(host);const batcher=createCellBatcher(T,host,{size:40,settle:100});
 const a=prop(5,5),b=prop(10,8,{extra:[[2.5,other]]}),far=prop(100,5);for(const r of [a,b,far]){scene.add(r);batcher.add(r,0)}
 assert.equal(batcher.flush(50),0,'cells wait until streaming settles');
 assert.equal(batcher.flush(200),2);
 const cell=host.children.find(g=>g.name==='cell-batch:'+cellKey(5,5,40));assert.ok(cell);
 assert.equal(cell.children.length,1,'four boxes of one material in one draw; the lone other-material box stays');
 assert.equal(cell.children[0].geometry.attributes.position.count,4*36);assert.equal(cell.children[0].castShadow,true);
 const box=new T.Box3().setFromBufferAttribute(cell.children[0].geometry.attributes.position);assert.ok(Math.abs(box.min.x-4.5)<1e-6&&Math.abs(box.max.x-10.5)<1e-6,'merged in world space');
 const [m1,m2,m3]=b.children;assert.equal(m1.layers.mask,1<<BATCHED_LAYER);assert.equal(m3.layers.mask,1,'singleton material keeps drawing itself');
 assert.equal(b.children.at(-1).layers.mask,1,'invisible click target untouched');
 assert.equal(host.children.find(g=>g.name==='cell-batch:'+cellKey(100,5,40)).children.length,1,'a lone prop still merges its own same-material parts');
 // The culler leaves batched meshes alone when hiding/showing their root.
 const culler=createDistanceCuller({radiusOf:()=>1});culler.update([b],{x:500,y:0,z:0},{fogNear:50,far:100},0,true);
 assert.equal(m1.layers.mask,1<<BATCHED_LAYER);assert.equal(m3.layers.mask,(1<<HIDDEN_LAYER)>>>0);
 culler.update([b],{x:0,y:0,z:0},{fogNear:50,far:100},1000,true);assert.equal(m1.layers.mask,1<<BATCHED_LAYER);assert.equal(m3.layers.mask,1);
 // Removing an entity releases its meshes and rebuilds the cell without it.
 batcher.remove(b,300);assert.equal(m1.layers.mask,1);assert.equal(batcher.flush(301,true),1);
 assert.equal(host.children.find(g=>g.name==='cell-batch:'+cellKey(5,5,40)).children[0].geometry.attributes.position.count,72,'only the remaining entity');
 assert.equal(host.children.filter(g=>g.name==='cell-batch:'+cellKey(5,5,40)).length,1,'the old batch was replaced');
 batcher.add(b,400);batcher.flush(1000);assert.equal(host.children.find(g=>g.name==='cell-batch:'+cellKey(5,5,40)).children[0].geometry.attributes.position.count,144);
 assert.equal(batcher.stats.sources,6);
});
test('cell batcher leaves moving gate leaves, skinned, mirrored and vertex-coloured meshes alone',()=>{
 const gateRoot=x=>{const root=new T.Group();root.position.x=x;const gate=castleObject(T,new T.Group(),'castle_gate',{length:16});root.add(gate);Object.assign(root.userData,gate.userData);return root};
 const root=gateRoot(0),twin=gateRoot(8);
 const scene=new T.Scene(),host=new T.Group();scene.add(host,root,twin);const batcher=createCellBatcher(T,host,{skip:(o,r)=>o===r.userData.leftGate||o===r.userData.rightGate});
 batcher.add(root);batcher.add(twin);batcher.flush(Infinity,true);
 root.userData.leftGate.traverse(o=>{if(o.isMesh)assert.equal(o.layers.mask,1,'gate leaf still drawn by itself so it can swing')});
 let merged=0;root.traverse(o=>{if(o.userData.cellBatched)merged++});assert.ok(merged>=2,'gate towers and battlements merged: '+merged);
 const mirrored=new T.Mesh(new T.BoxGeometry(),mat);mirrored.scale.x=-1;mirrored.updateMatrixWorld();assert.equal(cellBatchable(mirrored),false);
 const coloured=new T.Mesh(new T.BoxGeometry(),new T.MeshStandardMaterial({vertexColors:true}));coloured.updateMatrixWorld();assert.equal(cellBatchable(coloured),false);
 const plain=new T.Mesh(new T.BoxGeometry(),mat);plain.updateMatrixWorld();assert.equal(cellBatchable(plain),true);
});
test('castle pieces share materials, so walls and towers can merge across entities',()=>{
 const a=castleObject(T,new T.Group(),'castle_wall',{length:20}),b=castleObject(T,new T.Group(),'castle_tower');
 const mats=g=>{const s=new Set();g.traverse(o=>{if(o.isMesh)s.add(o.material)});return s};
 const shared=[...mats(a)].filter(m=>mats(b).has(m));assert.ok(shared.length>=2,'stone and trim shared');
 for(const m of shared)assert.equal(m.userData.eldervaleShared,true,'never disposed with one entity');
});
