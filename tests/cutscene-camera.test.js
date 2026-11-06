import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import * as T from 'three';
import {frameShot,roomFromGroup,insideRoom,onScreen,subjectPoints,clampToRoom,glideClear,bodyGap} from '../cutscene-camera.js';
import {cutscenes,validCutscene,KING} from '../cutscenes.js';
import {collectCameraOccluders,obstructionDistance} from '../camera-obstruction.js';
import {decorateTownBuilding} from '../town.js';
import {castleBlueprint} from '../castle-layout.js';
import {tutorialEntities,AUDIENCE_SPOT} from '../tutorial-data.js';

// The Keep ("Eldervale Great Hall") as game.js house() + town.js build it: walls with the front
// doorway, the door leaf (open or shut), corner posts, the dais, high table and the giant benches.
function keep({doorOpen=false}={}){
 const row=castleBlueprint().find(r=>r.name==='Eldervale Great Hall'),scale=1.3*row.scale,g=new T.Group();
 g.scale.set(scale,scale,scale);g.position.set(row.x,0,row.z);g.rotation.y=(row.yaw||0)*Math.PI/180;
 const mat=new T.MeshBasicMaterial();
 const box=(w,h,d,c,x,y,z,p=g)=>{const m=new T.Mesh(new T.BoxGeometry(w,h,d),mat);m.position.set(x,y,z);p.add(m);return m};
 box(3.64,3,.18,0,0,1.5,-1.83);for(const s of [-1,1])box(.18,3,3.84,0,s*1.91,1.5,0);
 for(const s of [-1,1])box(1.30,3,.18,0,s*1.17,1.5,1.83);box(1.04,.75,.18,0,0,2.625,1.83);box(1.04,.47,.18,0,0,2.015,1.83);
 for(const s of [-1,1])box(.14,2.8,.16,0,s*1.77,1.5,-1.65);
 const pivot=new T.Group();pivot.position.set(-.52,0,1.86);g.add(pivot);box(1.04,1.75,.13,0,.52,.9,0,pivot);if(doorOpen)pivot.rotation.y=-Math.PI*.53;
 decorateTownBuilding(T,{group:g,type:'hall',roofParts:[]},{box:(w,h,d,c,x,y,z,p)=>box(w,h,d,c,x,y,z,p),material:()=>mat});
 g.updateMatrixWorld(true);return g;
}
function lineOfSight(group){
 const meshes=collectCameraOccluders([group]),ray=new T.Raycaster();
 return (a,b)=>{const from=new T.Vector3(a.x,a.y,a.z),dir=new T.Vector3(b.x-a.x,b.y-a.y,b.z-a.z),d=dir.length();ray.set(from,dir.normalize());ray.far=d-.05;return !ray.intersectObjects(meshes,false).length};
}
const VIEWS={desktop:[1280,800],ipadLandscape:[1180,820],ipadPortrait:[820,1180],phone:[844,390]};
const floor=.125*1.3*4.4;
const KING_AT={x:tutorialEntities[1].x,y:floor,z:tutorialEntities[1].z,tall:1.75*1.05},PLAYER={x:AUDIENCE_SPOT.x,y:floor,z:AUDIENCE_SPOT.z,tall:1.75};
const subjectOf=r=>r==='player'?PLAYER:KING_AT;
const framed=cutscenes.arrival.steps.filter(s=>s.shot?.two||s.shot?.over);

test('arrival scene: every King-conversation shot is framed on the subjects, not on fixed coordinates',()=>{
 assert.ok(validCutscene(cutscenes.arrival));
 assert.ok(framed.length>=6,'the hall shots are framed shots');
 const sayShots=cutscenes.arrival.steps.filter(s=>s.say);assert.ok(sayShots.every(s=>s.shot?.two||s.shot?.over),'every dialogue line has a framed shot');
 assert.equal(KING.id,'c7a5e000-0000-4000-8000-000000000001');assert.deepEqual(KING.at,[tutorialEntities[1].x,tutorialEntities[1].z]);
 assert.ok(!validCutscene({steps:[{shot:{two:{a:'player'}}}]}));
});

test('Keep shots stay inside the hall with no wall, door or bench between the camera and King or player (door open and shut, every screen shape)',()=>{
 for(const doorOpen of [false,true]){
  const g=keep({doorOpen}),room=roomFromGroup(g),clear=lineOfSight(g);
  assert.ok(insideRoom(room,KING_AT)&&insideRoom(room,PLAYER),'both subjects stand in the Keep');
  for(const [name,[w,h]] of Object.entries(VIEWS))for(const step of framed){
   const o=step.shot.two||step.shot.over,a=subjectOf(step.shot.two?o.a:o.shoulder),b=subjectOf(step.shot.two?o.b:o.at);
   const r=frameShot(step.shot,{a,b,fov:55,aspect:w/h,rooms:[room],clear}),label=name+' door '+(doorOpen?'open':'shut')+' '+JSON.stringify(step.shot);
   assert.ok(r.ok,'a clean framing exists: '+label);assert.ok(r.room,label);
   assert.ok(insideRoom(room,r.eye,.5),'camera inside the hall walls: '+label+' '+JSON.stringify(r.eye));
   assert.ok(r.eye.y>floor+.4&&r.eye.y<floor+12,label);
   const subjects=step.shot.two?[a,b]:[b];
   for(const s of subjects){const p=subjectPoints(s,s.tall);
    assert.ok(clear(r.eye,p.head)&&clear(r.eye,p.chest),'no wall between camera and subject: '+label);
    assert.ok(onScreen(r.eye,r.look,p.head,55,w/h,.9)&&onScreen(r.eye,r.look,p.chest,55,w/h,.9),'subject in frame: '+label);}
   if(step.shot.over){// the near shoulder never covers the face being spoken to
    const A=subjectPoints(a,a.tall),B=subjectPoints(b,b.tall);assert.ok(bodyGap(r.eye,B.head,A)>.6&&bodyGap(r.eye,B.chest,A)>.6,'shoulder clear of the face: '+label)}
   if(step.shot.two){// a two-shot really holds both, not one over the other
    const pa=subjectPoints(a,a.tall).head,pb=subjectPoints(b,b.tall).head;assert.ok(onScreen(r.eye,r.look,pa,55,w/h)&&onScreen(r.eye,r.look,pb,55,w/h),label)}
  }
 }
});

test('portrait iPad two-shot backs off further than desktop yet stays inside the room',()=>{
 const g=keep(),room=roomFromGroup(g),clear=lineOfSight(g),shot={two:{a:'player',b:KING,side:-1,angle:0}};
 const wide=frameShot(shot,{a:PLAYER,b:KING_AT,fov:55,aspect:1280/800,rooms:[room],clear}),tall=frameShot(shot,{a:PLAYER,b:KING_AT,fov:55,aspect:820/1180,rooms:[room],clear});
 const d=r=>Math.hypot(r.eye.x-r.look.x,r.eye.z-r.look.z);
 assert.ok(d(tall)>d(wide),[d(tall),d(wide)]);assert.ok(insideRoom(room,tall.eye,.5));
 // clamping never pushes a camera through the wall
 const c=clampToRoom(room,{x:-300,y:50,z:-334});assert.ok(insideRoom(room,c,.5));
});

test('walls between two cameras turn the glide into a cut; the obstruction guard pulls the lens in front of a wall',()=>{
 const g=keep(),clear=lineOfSight(g);
 const courtyard={x:-352,y:9,z:-280},hall={x:-344,y:3,z:-330};
 assert.equal(glideClear(courtyard,hall,clear),false,'courtyard → hall would fly through the Keep wall');
 assert.equal(glideClear({x:-344,y:3,z:-330},{x:-336,y:3,z:-330},clear),true);
 // old fixed shot from inside the dais would have been blocked; the guard keeps the eye short of a hit
 assert.equal(obstructionDistance(null,2.1-.3,6,1/60),1.8);
});

test('tutorial cutscene engine guards every shot with the obstruction logic and starts glides from the real camera',()=>{
 const src=fs.readFileSync(new URL('../tutorial.js',import.meta.url),'utf8');
 assert.match(src,/import \{obstructionDistance\} from '\.\/camera-obstruction\.js/);
 assert.match(src,/cutscene\.from=cutscene\.cam\?/);
 assert.match(src,/glideClear\(cutscene\.from\.eye,to\.eye,clear\)\)cutscene\.ms=1/);
 const game=fs.readFileSync(new URL('../game.js',import.meta.url),'utf8');
 assert.match(game,/createTutorial\(\{T,scene,.{0,200}?cameraOccluders:\(\)=>cameraWalls,rooms:/);
});

test('a walk stopped by a shut Keep door does not leave the player outside while the King talks',()=>{
 const walk=cutscenes.arrival.steps.find(s=>s.walk);assert.equal(walk.settle,true);
 const src=fs.readFileSync(new URL('../tutorial.js',import.meta.url),'utf8');
 assert.match(src,/else if\(performance\.now\(\)-moved>2200&&performance\.now\(\)-t0>3000\)break;/,'a stalled walk stops early');
 assert.match(src,/if\(settle&&!cutscene\.skip&&!near\(\)\)\{\s*await fade\(1,350\);await command\(settle\.command,settle\.payload\)/,'then the scene is recorded so the server sets the player down in front of the King');
});

