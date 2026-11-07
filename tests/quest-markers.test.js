// Quest markers: the overhead "!" / "?" clears the real head top (hats, helmets, hoods; tall,
// short, scaled and seated NPCs), the minimap badge, the world map's quest-chain markers (which
// quests count, hidden once started, owner overrides), the 'quest' marker kind in SQL, and posted
// guards facing out through their gate.
import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';
import {buildHumanoid} from '../humanoid.js';
import {ensurePart} from '../character-assets.js';
import {outfitItems} from '../outfits.js';
import {measureHeadTop,headMeshes,markerAnchor,markerHeight,MARKER_MARGIN,createQuestMarkers} from '../quest-markers.js';
import {chainStarts,questPrereqs} from '../quest-guide.js';
import {MARKER_CATS,collectMarkers,clusterMarkers,applyOverrides,markerId,markerLabel,drawMarkerIcon,GLYPH_KINDS} from '../map-icons.js';
import {ARCS,questRows,entitiesOf} from '../scripts/quest-arcs/build.mjs';
import {tutorialQuestRows} from '../tutorial-data.js';
import {postedYaw} from '../town-life.js';
import {capitalBlueprint,capital} from '../capital-layout.js';
import {castleBlueprint,castle} from '../castle-layout.js';

const root=new URL('../',import.meta.url),read=f=>fs.readFileSync(new URL(f,root),'utf8');
const actor=(look={},scale=1)=>{const r=new T.Group();r.scale.setScalar(scale);const rig=buildHumanoid(T,r,look);r.updateMatrixWorld(true);return {root:r,rig,profile:{name:'Test'}}};
const snapshot=(rows,done={})=>rows.map(r=>({id:r.id,data:r.data,accepted:!!done[r.data.key]?.accepted,completed:!!done[r.data.key]?.completed,progress:{}}));

test('overhead marker sits above the measured head top: bare head, helmets and hoods, scaled and seated',async()=>{
 await Promise.all(['helm','knightHornedHelm2','rangerHood1'].map(k=>ensurePart(outfitItems[k].male)));
 const bare=actor(),top=measureHeadTop(T,bare);
 // CHARACTER_SCALE puts the Head bone near 2.53; the skull top sits above it, under 3.
 assert.ok(top>2.6&&top<3,'bare head top '+top.toFixed(2));
 const head=bare.rig.bones.Head.getWorldPosition(new T.Vector3()).y;assert.ok(top>head+.1,'top of the skull is above the Head bone');
 // Old fixed height (2.9) put the glyph's middle at the skull: the new foot clears it.
 assert.ok(markerAnchor(bare.root,top)>=top+MARKER_MARGIN-1e-9);
 for(const key of ['helm','knightHornedHelm2','rangerHood1']){const a=actor();a.rig.setCoverage({[key]:true});a.root.updateMatrixWorld(true);
  assert.ok(a.rig.parts.helm?.meshes.length,key+' worn');assert.ok(headMeshes(a).some(m=>a.rig.parts.helm.meshes.includes(m)),key+' counted as head');
  const t=measureHeadTop(T,a);assert.ok(t>=top-.02,key+' top '+t.toFixed(2)+' not below the bare head');assert.ok(markerAnchor(a.root,t)>t+.25,key+' cleared')}
 const horned=actor();horned.rig.setCoverage({knightHornedHelm2:true});assert.ok(measureHeadTop(T,horned)>top+.05,'a horned helm raises the marker');
 // Tall, short and scaled: the head top follows the scale; the margin scales within limits.
 const tall=actor({},1.4),short=actor({},.75);
 assert.ok(Math.abs(measureHeadTop(T,tall)-top*1.4)<.05);assert.ok(Math.abs(measureHeadTop(T,short)-top*.75)<.05);
 assert.ok(markerAnchor(tall.root,measureHeadTop(T,tall))-measureHeadTop(T,tall)>MARKER_MARGIN);
 // Seated (as on a horse): the body is raised, the marker follows the head, not the root.
 const seated=actor();seated.rig.model.position.y+=.95;seated.root.updateMatrixWorld(true);assert.ok(Math.abs(measureHeadTop(T,seated)-(top+.95))<.03);
 // Raised arms and held items never lift it: only head meshes count.
 const armed=actor();const staff=new T.Mesh(new T.BoxGeometry(.1,3,.1),new T.MeshBasicMaterial());staff.position.y=1.5;armed.rig.rightHand.add(staff);armed.root.updateMatrixWorld(true);
 assert.ok(Math.abs(measureHeadTop(T,armed)-top)<1e-6,'a staff in hand is ignored');
 // A non-humanoid model: every visible mesh except invisible hit volumes.
 const beast={root:new T.Group()};const body=new T.Mesh(new T.BoxGeometry(1,1.6,1),new T.MeshBasicMaterial());body.position.y=.8;const hit=new T.Mesh(new T.BoxGeometry(1,5,1),new T.MeshBasicMaterial({visible:false}));beast.root.add(body,hit);
 assert.ok(Math.abs(measureHeadTop(T,beast)-1.6)<1e-6);
 assert.equal(measureHeadTop(T,{root:new T.Group()}),null,'nothing to measure: fallback height');assert.equal(markerAnchor({position:{y:1},scale:{y:1}},null),markerHeight({position:{y:1},scale:{y:1}}));
});

test('marker mesh places the glyph foot above each giver; minimap draws the quest badge',()=>{
 const scene=new T.Scene(),a=actor(),b=actor({},1.3);a.root.position.set(0,0,0);b.root.position.set(4,.5,0);b.rig.setCoverage({knightHornedHelm2:true});scene.add(a.root,b.root);
 // A stand-in canvas for the glyph texture and the minimap sprite (no DOM in Node), only here.
 const had='document' in globalThis;if(!had)globalThis.document={createElement:()=>({width:0,height:0,getContext:()=>new Proxy({},{get:(o,k)=>k==='createLinearGradient'?()=>({addColorStop(){}}):k in o?o[k]:()=>{},set:(o,k,v)=>{o[k]=v;return true}})})};
 try{
 const ids={a,b},m=createQuestMarkers(T,scene,{actorFor:id=>ids[id]});
 m.sync([{id:'q1',data:{key:'q1',name:'One',giver:'a',published:true,objectives:[{type:'talk',target:'x',amount:1}]},accepted:false,completed:false,progress:{}},
  {id:'q2',data:{key:'q2',name:'Two',giver:'b',published:true,objectives:[{type:'kill',target:'x',amount:1}]},accepted:true,completed:false,progress:{0:1}}],{});
 const cam=new T.PerspectiveCamera();cam.position.set(0,3,12);scene.updateMatrixWorld(true);m.frame(cam,1000);
 assert.equal(m.mesh.count,2);
 for(const s of m.shown){const top=measureHeadTop(T,ids[s.id]);assert.ok(s.y-top>=MARKER_MARGIN*.85-1e-9,s.id+' clears its head by '+(s.y-top).toFixed(2))}
 assert.equal(m.shown.find(s=>s.id==='b').kind,'?');
 const src=read('quest-markers.js');assert.match(src,/vec2\(0\.,\.44\)/,'billboard grows upward from its foot');assert.match(src,/\(sin\(uTime\*2\.3\+aPhase\)\+1\.\)/,'bob only rises');
 // Minimap: drawMarker with the quest kind and the giver's mark.
 const calls=[];const ctx=new Proxy({},{get:(o,k)=>k in o?o[k]:(...args)=>{calls.push(k);return k==='createLinearGradient'?{addColorStop(){}}:undefined},set:(o,k,v)=>{o[k]=v;return true}});
 m.drawMinimap(ctx,(x,z)=>({x:x*10,y:z*10}),{size:13});assert.equal(calls.filter(c=>c==='drawImage').length,2,'one cached badge sprite per giver');
 calls.length=0;assert.equal(m.drawMinimap(ctx,()=>({x:50,y:50}),{size:13}),1,'badges on one spot do not pile up');assert.equal(calls.filter(c=>c==='drawImage').length,1);
 // A giver bending over its work keeps the standing height; a new helm measures afresh.
 const before=m.shown.find(s=>s.id==='a').y;a.rig.bones.spine_01.rotation.x+=.9;a.root.updateMatrixWorld(true);m.frame(cam,1000+5000);assert.ok(Math.abs(m.shown.find(s=>s.id==='a').y-before)<1e-6,'kept while bent over');
 a.rig.bones.spine_01.rotation.x-=.9;a.rig.setCoverage({knightHornedHelm2:true});a.root.updateMatrixWorld(true);m.frame(cam,1000+5100);assert.ok(m.shown.find(s=>s.id==='a').y>before+.02,'horned helm raises it at once');
 assert.ok(GLYPH_KINDS.includes('quest'));const marks=[];const g=new Proxy({},{get:(o,k)=>k==='fillText'?t=>marks.push(t):k==='createLinearGradient'?()=>({addColorStop(){}}):k in o?o[k]:()=>{},set:(o,k,v)=>{o[k]=v;return true}});
 drawMarkerIcon(g,'quest',0,0,14,{mark:'?'});drawMarkerIcon(g,'quest',0,0,14);assert.deepEqual(marks,['?','!']);
 }finally{if(!had)delete globalThis.document}
 const game=read('game.js');assert.match(game,/markers\.drawMinimap\(ctx,[^\n]*\{size:13,dpr:minimapRes\}\)/);assert.match(game,/new Set\(\[\.\.\.worldMap\.hiddenKinds,'quest'\]\)/,'chain markers are not drawn twice on the minimap');
});

test('chain starts come from the quest data: the four arc openers, not the tutorial or single quests',()=>{
 const arc=ARCS.flatMap(questRows),tut=tutorialQuestRows?tutorialQuestRows():[];
 const bell={id:'bell',data:{key:'birchford-flat-bell',name:'A Bell Out of Tune',chain:'birchford',order:1,published:true,requirements:{quests:['tutorial-graduation']},giver:'maud'}};
 const rows=snapshot([...arc,...(Array.isArray(tut)?tut:[]),bell]);
 const starts=chainStarts(rows);
 assert.deepEqual(starts.map(s=>s.key).sort(),['arc-crown-1','arc-forge-1','arc-frontier-1','arc-tide-1']);
 assert.deepEqual(starts.map(s=>s.name).sort(),['Ashes on the Wardfires','Bells Beneath the Tide','Sparks in the Ashpit','Wax and Whispers']);
 assert.ok(starts.every(s=>s.kind==='chain'&&s.members.length===5&&!s.started&&s.giver));
 assert.deepEqual(questPrereqs({requires:'a',requirements:{quests:['b','c']}}),['a','b','c']);
 // Started or finished (any quest of the chain): hidden.
 const begun=chainStarts(snapshot(arc,{'arc-tide-1':{accepted:true},'arc-crown-3':{completed:true}}));
 assert.deepEqual(begun.filter(s=>s.started).map(s=>s.key).sort(),['arc-crown-1','arc-tide-1']);
 // A big standalone quest counts; a small standalone one and an unpublished chain do not.
 const own=chainStarts(snapshot([{id:'x',data:{key:'epic',name:'Epic',length:'Very long',giver:'g'}},{id:'y',data:{key:'small',name:'Small',length:'Short',giver:'g'}},{id:'z',data:{key:'hid',name:'Hidden',chain:'h',published:false,giver:'g'}},{id:'w',data:{key:'hid2',name:'Hidden 2',chain:'h',published:false,giver:'g'}}]));
 assert.deepEqual(own.map(s=>[s.key,s.kind]),[['epic','big']]);
 // A quest that unlocks another (no chain field) starts a chain of everything it leads to.
 const linked=chainStarts(snapshot([{id:'a',data:{key:'a',name:'A',giver:'g'}},{id:'b',data:{key:'b',name:'B',giver:'g',requires:'a'}},{id:'c',data:{key:'c',name:'C',giver:'g',requirements:{quests:['b']}}}]));
 assert.deepEqual(linked.map(s=>[s.key,s.members.sort().join()]),[['a','a,b,c']]);
});

test('world map: gold quest markers for chain starts, hidden once started, owner overrides apply',()=>{
 assert.equal(MARKER_CATS.quest.group,'places');assert.equal(MARKER_CATS.quest.zoom,1);
 const givers=[{id:'odo',x:-240,z:150,giverName:'Odo',quests:['Wax and Whispers'],started:false},{id:'tide',x:300,z:330,giverName:'Corwen',quests:['Bells Beneath the Tide'],started:true},{id:'kade',x:-238,z:152,giverName:'Kade',quests:['Sparks in the Ashpit'],started:false}];
 const base=clusterMarkers(collectMarkers({quests:givers})).map(c=>({...c,id:markerId(c)}));
 assert.equal(base.length,3,'never merged with a neighbour at the base level');
 const odo=base.find(c=>c.giverName==='Odo');assert.equal(odo.id,'quest:-240:150');assert.match(markerLabel(odo),/^Quest: Wax and Whispers · ask Odo$/);
 const shown=applyOverrides(base.filter(c=>!(c.cat==='quest'&&c.started)),{hidden:['quest:-238:152'],names:{'quest:-240:150':'The Tallow Crown'}});
 assert.deepEqual(shown.map(c=>c.name),['The Tallow Crown']);
 const mm=read('map-markers.js');assert.match(mm,/base\.filter\(c=>!\(c\.cat==='quest'&&c\.started\)\)/);assert.match(mm,/quests:inp\.q/);
 const wm=read('world-map.js');assert.doesNotMatch(wm,/lists\.quests/,'every quest giver is no longer drawn on the world map');assert.match(wm,/if\(!room&&!quest\)continue;/,'chain starts are never crowded out');
 assert.match(read('game.js'),/createMapMarkers\(\{quests:\(\)=>questUiRef\?\.markers\.chainGivers\(\)/);
});

test('db/quest-map-markers.sql: idempotent, nothing destructive, kinds match MARKER_CATS, gate facing',()=>{
 const sql=read('db/quest-map-markers.sql');
 assert.doesNotMatch(sql,/\b(delete|alter|drop)\b/i);assert.doesNotMatch(sql,/drop|alter/i);
 assert.match(sql,/create or replace function eldervale_private\.map_marker_kinds\(\)/);
 const kinds=sql.match(/array\['boss'[^\]]*\]/)[0].match(/'([a-z]+)'/g).map(s=>s.slice(1,-1));assert.deepEqual(kinds.sort(),Object.keys(MARKER_CATS).sort());
 const icons=read('db/map-icons.sql').match(/array\['boss'[^\]]*\]/)[0].match(/'([a-z]+)'/g).map(s=>s.slice(1,-1));assert.deepEqual(icons.sort(),kinds,'re-applying map-icons.sql keeps the quest kind');
 assert.match(sql,/soft_patch\('eldervale_private\.entity_runtime\(\)','realm_actors\(id,data,x,z,yaw,hp,'/,'patched once (marker)');
 assert.match(sql,/create or replace function eldervale_private\.gate_guard_facing\(\)/);assert.match(sql,/a\.target is null/,'fighting guards are left alone');
 assert.match(sql,/^begin;/m);assert.match(sql,/^commit;/m);
});

test('posted guards face out through their gate (castle and every Birchford gate), patrols untouched',()=>{
 const deg=r=>Math.atan2(Math.sin(r*Math.PI/180),Math.cos(r*Math.PI/180));
 // The castle gatekeepers face away from the castle (+Z): the gate is on the south wall.
 const gk=castleBlueprint().filter(d=>d.name==='White Knight gatekeeper');assert.equal(gk.length,2);
 for(const d of gk){const yaw=(d.yaw||0)*Math.PI/180,away=[d.x-castle.x,d.z-castle.z];assert.ok(Math.sin(yaw)*away[0]+Math.cos(yaw)*away[1]>0,'gatekeeper faces out of the castle');assert.ok(Math.abs(Math.sin(yaw))<.2,'along the road')}
 // Birchford: two wardens per gate (one at the Frost and Farm gates) inside the walls, facing out along the road.
 const wardens=capitalBlueprint().filter(d=>d.name==='Birchford Gate Warden');assert.equal(wardens.length,6,'two at the North and Ember gates, one at the Frost and Farm gates');
 for(const w of wardens){const gate=capital.gates.reduce((a,g)=>Math.hypot(g.x-w.x,g.z-w.z)<Math.hypot(a.x-w.x,a.z-w.z)?g:a),yaw=deg(w.yaw);
  const out=[gate.x-w.x,gate.z-w.z],l=Math.hypot(...out);assert.ok((Math.sin(yaw)*out[0]+Math.cos(yaw)*out[1])/l>.6,'warden at '+w.x+','+w.z+' faces through '+gate.key)}
 // The client keeps that facing while the server still sends 0 for an idle posted NPC.
 const posted={behavior:'stationary',roam:0,yaw:90};
 assert.equal(postedYaw(posted,0),Math.PI/2);assert.equal(postedYaw(posted,1.2),1.2,'a talk-turn or fight shows as sent');assert.equal(postedYaw(posted,0,true),0,'moving');
 assert.equal(postedYaw({behavior:'patrol',roam:5,yaw:90},0),0,'patrols keep their server facing');assert.equal(postedYaw({behavior:'stationary',roam:0,yaw:0},0),0);assert.equal(postedYaw(undefined,.5),.5);
 const game=read('game.js');assert.match(game,/workFacing\(actor\.rig,postedYaw\(actor\.profile,sample\.yaw,moved\),moved,dt\)/);
});
