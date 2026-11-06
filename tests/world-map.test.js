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

test('world map fit: the whole world fits the visible stage in portrait, landscape and on desktop',async()=>{
 const {fitScale,fitView,zoomRange,isFitView,clampView}=await import('../world-map.js');
 // Stage sizes after header and safe areas: iPhone SE / 15 portrait and landscape, iPad, desktop.
 for(const [w,h] of [[347,597],[331,560],[631,300],[730,330],[792,1100],[1152,805]]){
  const v=fitView(w,h,840);assert.equal(v.x,0);assert.equal(v.z,0);
  assert.ok(840*v.scale<=w&&840*v.scale<=h,`world fits ${w}x${h}`);
  assert.ok(840*v.scale>=Math.min(w,h)*.95,'and fills the short side');
  assert.ok(isFitView(v,w,h,840));
  const {min,max}=zoomRange(w,h,840,6);assert.equal(min,fitScale(w,h,840));assert.ok(max>=6&&max>=min*4);
  // Cannot zoom out past the fit, nor drag the fitted world off centre.
  assert.deepEqual(clampView({x:200,z:-200,scale:min/3},w,h,840,6),{x:0,z:0,scale:min});
  assert.equal(clampView({x:0,z:0,scale:999},w,h,840,6).scale,max);
 }
 assert.ok(fitScale(0,0,840)>0,'a zero-size stage never yields a zero or negative scale');
 assert.equal(clampView({x:0,z:0,scale:NaN},400,300,840).scale,fitScale(400,300,840));
});

test('world map pinch, pan and double-tap maths',async()=>{
 const {pinchView,panView,isDoubleTap,screenToWorld,fitView,zoomAround,zoomRange}=await import('../world-map.js');
 const w=400,h=300,extent=840,start={x:-100,z:50,scale:2};
 // Spreading the fingers to twice the distance doubles the scale and keeps the world point under them.
 const mid={x:150,y:120},at=screenToWorld(start,mid.x,mid.y,w,h),v=pinchView(start,mid,100,mid,200,w,h,extent,8);
 assert.equal(v.scale,4);const back=screenToWorld(v,mid.x,mid.y,w,h);assert.ok(Math.hypot(back.x-at.x,back.z-at.z)<1e-9);
 // Pinching in stops at fit-whole-world.
 assert.equal(pinchView(start,mid,300,mid,10,w,h,extent,8).scale,fitView(w,h,extent).scale);
 // Moving both fingers together pans.
 const moved=pinchView(start,mid,100,{x:170,y:120},100,w,h,extent,8);assert.ok(Math.abs(moved.x-(start.x-20/2))<1e-9);
 // Dragging right moves the map right (centre moves left in world units).
 const p=panView(start,40,-20,w,h,extent,8);assert.equal(p.x,start.x-20);assert.equal(p.z,start.z+10);assert.equal(p.scale,2);
 // Double tap: close in time and place only.
 assert.ok(isDoubleTap({t:0,x:10,y:10},{t:250,x:20,y:15}));
 assert.ok(!isDoubleTap({t:0,x:10,y:10},{t:500,x:10,y:10}));assert.ok(!isDoubleTap({t:0,x:10,y:10},{t:100,x:90,y:10}));assert.ok(!isDoubleTap(null,{t:0,x:0,y:0}));
 // Double-tap zoom doubles until the maximum, then holds.
 let z=fitView(w,h,extent);const {max}=zoomRange(w,h,extent,8);for(let i=0;i<20;i++)z=zoomAround(z,2,100,100,w,h,extent,8);assert.equal(z.scale,max);
});

test('world map momentum decays to a stop and release velocity ignores a resting finger',async()=>{
 const {releaseVelocity,inertiaStep}=await import('../world-map.js');
 const v=releaseVelocity([{t:0,x:0,y:0},{t:50,x:20,y:0},{t:100,x:60,y:-10}],90);assert.ok(v.vx>.5&&v.vy<0);
 assert.deepEqual(releaseVelocity([{t:0,x:0,y:0}]),{vx:0,vy:0});
 // A finger that stopped moving before lifting gives no fling.
 const rest=releaseVelocity([{t:0,x:0,y:0},{t:30,x:40,y:0},{t:300,x:40,y:0}],90);assert.equal(rest.vx,0);
 let s={vx:1.5,vy:0},travel=0,frames=0;for(;frames<1000;frames++){const st=inertiaStep(s,16);if(!st)break;travel+=st.dx;s=st}
 assert.ok(frames<200,'stops within a few seconds');assert.ok(travel>300&&travel<1.5*320,'glides about v·tau');
 assert.equal(inertiaStep({vx:.001,vy:0},16),null);
});

test('world map labels and markers: small-screen scale, collision boxes and edge arrows',async()=>{
 const {uiScale,boxHits,edgePoint,worldToScreen,fitView}=await import('../world-map.js');
 assert.equal(uiScale(1440,900),1);assert.ok(uiScale(347,597)<1&&uiScale(347,597)>=.72);assert.equal(uiScale(100,100),.72);
 const placed=[{x:100,y:100,w:60,h:20}];
 assert.ok(boxHits(placed,{x:130,y:105,w:20,h:10}));assert.ok(!boxHits(placed,{x:200,y:100,w:20,h:10}));
 assert.equal(edgePoint(50,50,400,300),null);
 const e=edgePoint(800,150,400,300,18);assert.equal(e.x,382);assert.equal(e.y,150);assert.equal(e.angle,0);
 const top=edgePoint(200,-500,400,300,18);assert.equal(top.y,18);
 // Markers are placed through the same projection at every zoom: the world corners land on the fitted frame.
 for(const [w,h] of [[347,597],[730,330]]){const v=fitView(w,h,840),a=worldToScreen(v,-420,-420,w,h),b=worldToScreen(v,420,420,w,h);
  assert.ok(a.x>=0&&a.y>=0&&b.x<=w&&b.y<=h);assert.ok(Math.abs((a.x+b.x)/2-w/2)<1e-9&&Math.abs((a.y+b.y)/2-h/2)<1e-9)}
});
