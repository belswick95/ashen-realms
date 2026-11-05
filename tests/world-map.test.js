import test from 'node:test';import assert from 'node:assert/strict';
import {poiKind,mergePois,fitScale,clampView,worldToScreen,screenToWorld,zoomAround,pickFeature,terrainColor,regionAnchors,POI_KINDS} from '../world-map.js';

test('buildings and world entities map to point-of-interest icons',()=>{
 assert.equal(poiKind('bank'),'bank');assert.equal(poiKind('market'),'shop');assert.equal(poiKind('armory'),'shop');assert.equal(poiKind('chapel'),'altar');assert.equal(poiKind('altar'),'altar');
 assert.equal(poiKind('fishing_spot'),'fishing');assert.equal(poiKind('forge'),'smith');assert.equal(poiKind('inn'),'inn');assert.equal(poiKind('cottage'),null);assert.equal(poiKind(undefined),null);
 for(const k of ['bank','shop','smith','inn','altar','fishing','quest'])assert.ok(POI_KINDS[k].label);
 // A bank building and its banker stand merge into one icon; other kinds stay.
 const merged=mergePois([{kind:'bank',x:0,z:0},{kind:'bank',x:4,z:3,name:'Birchford Bank'},{kind:'shop',x:2,z:0},{kind:null,x:1,z:1},{kind:'bank',x:50,z:0},{kind:'inn',x:NaN,z:0}]);
 assert.equal(merged.length,3);assert.equal(merged[0].name,'Birchford Bank');
});

test('world map view: fit, clamp, round trip and zoom about the pointer',()=>{
 const w=1000,h=700,extent=840,fit=fitScale(w,h,extent);
 assert.ok(Math.abs(fit-700/840*.96)<1e-12);
 // Zoomed all the way out the world is centred and cannot be dragged away.
 assert.deepEqual(clampView({x:300,z:-300,scale:.1},w,h,extent),{x:0,z:0,scale:fit});
 // Zoomed in, the centre stops where the world edge meets the frame.
 const v=clampView({x:1000,z:0,scale:4},w,h,extent);assert.equal(v.x,420-500/4);assert.equal(clampView({x:0,z:0,scale:99},w,h,extent,8).scale,8);
 const view={x:-120,z:60,scale:3},p=worldToScreen(view,-100,75,w,h),back=screenToWorld(view,p.x,p.y,w,h);
 assert.ok(Math.abs(back.x+100)<1e-9&&Math.abs(back.z-75)<1e-9);
 const before=screenToWorld(view,640,200,w,h),z=zoomAround(view,2,640,200,w,h,extent),after=screenToWorld(z,640,200,w,h);
 assert.equal(z.scale,6);assert.ok(Math.hypot(before.x-after.x,before.z-after.z)<1e-9);
});

test('picking the nearest feature within reach',()=>{
 const list=[{x:0,z:0,id:'a'},{x:10,z:0,id:'b'}];
 assert.equal(pickFeature(list,8,1,5).id,'b');assert.equal(pickFeature(list,4,0,5).id,'a');assert.equal(pickFeature(list,40,40,5),null);
});

test('painted terrain colours: water, shore, forest, snow and sand read distinctly',()=>{
 const grass=terrainColor({}),water=terrainColor({water:.9}),shore=terrainColor({water:.1}),forest=terrainColor({forest:1}),snow=terrainColor({weights:{snow:1}}),sand=terrainColor({weights:{dry:1}});
 assert.ok(water[2]>water[0]&&water[2]>water[1],'water is blue');assert.ok(grass[1]>grass[0]&&grass[1]>grass[2],'grass is green');
 assert.ok(forest[1]<grass[1],'forest is darker');assert.ok(shore[0]>grass[0],'shore is sandy');assert.ok(snow.every(v=>v>200),'snow is pale');assert.ok(sand[0]>sand[2]+50,'sand is warm');
 for(const c of [grass,water,shore,forest,snow,sand,terrainColor({height:80,shade:1,grain:1})])assert.ok(c.every(v=>Number.isInteger(v)&&v>=0&&v<=255));
});

test('region names sit inside the region they name, clear of towns',()=>{
 const regions=[{id:'west',name:'West'},{id:'east',name:'East'}],weights=(x)=>x<0?{west:1,east:0}:{west:0,east:1};
 const anchors=regionAnchors(regions,weights,800,20);
 assert.equal(anchors.length,2);assert.ok(anchors[0].x<0&&anchors[1].x>0);
 // A town north of the west centre pushes its label south.
 const avoided=regionAnchors(regions,weights,800,20,[{x:-200,z:-150}],150);
 assert.ok(avoided[0].z>anchors[0].z+10);assert.ok(avoided[0].x<0);
});
