import * as T from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import {actorModel,objectModel} from './world-models.js?v=release-20261106-mech96';
import {makeDroppedItemModel} from './item-models.js?v=release-20261106-mech96';
import {disposeEntityResources} from './entity-resources.js?v=release-20261106-mech96';
// A single small turntable renderer for the owner console's spawn previews.
let shared=null;
function stage(){
 if(shared)return shared;const canvas=document.createElement('canvas');canvas.className='console-preview-canvas';canvas.width=320;canvas.height=240;let renderer=null;
 try{renderer=new T.WebGLRenderer({canvas,antialias:true,alpha:true,preserveDrawingBuffer:true});renderer.setPixelRatio(Math.min(2,devicePixelRatio||1));renderer.setSize(320,240,false);renderer.outputColorSpace=T.SRGBColorSpace}catch{renderer=null}
 const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,320/240,.05,400),holder=new T.Group();scene.add(holder,new T.HemisphereLight(0xfff4dd,0x3a4a3c,1.6));const sun=new T.DirectionalLight(0xffffff,1.6);sun.position.set(4,8,6);scene.add(sun);
 const ground=new T.Mesh(new T.CircleGeometry(1,48),new T.MeshStandardMaterial({color:0x50633f,roughness:1}));ground.rotation.x=-Math.PI/2;scene.add(ground);
 shared={canvas,renderer,scene,camera,holder,ground,model:null,raf:0,clock:0};return shared;
}
function house(d){const g=new T.Group(),wall=new T.MeshStandardMaterial({color:d.stone?0x9c9a90:0xc7b48f}),roof=new T.MeshStandardMaterial({color:d.roof||0x70503c}),trim=new T.MeshStandardMaterial({color:0x5a4330});
 const body=new T.Mesh(new T.BoxGeometry(6,3.2*(d.stories||1),5),wall);body.position.y=1.6*(d.stories||1);g.add(body);const top=new T.Mesh(new T.ConeGeometry(4.6,2.6,4),roof);top.rotation.y=Math.PI/4;top.position.y=3.2*(d.stories||1)+1.3;top.scale.z=.85;g.add(top);
 const door=new T.Mesh(new T.BoxGeometry(1.1,2,.1),trim);door.position.set(0,1,2.53);g.add(door);for(const s of [-1,1]){const win=new T.Mesh(new T.BoxGeometry(.9,.8,.1),new T.MeshStandardMaterial({color:d.furnished===false?0x2b3236:0xf2d48a,emissive:d.furnished===false?0:0x3a2a08}));win.position.set(s*1.9,1.7,2.53);g.add(win)}g.scale.setScalar(d.scale||1);return g}
export function showPreview(entity){
 const s=stage();if(!s.renderer)return s.canvas;cancelAnimationFrame(s.raf);if(s.model){s.model.dispose?.();disposeEntityResources(s.holder);s.holder.clear();s.model=null}
 const list=Array.isArray(entity)?entity:[entity];let animate=null;
 try{
  if(list.length>1){const cx=list.reduce((a,e)=>a+e.x,0)/list.length,cz=list.reduce((a,e)=>a+e.z,0)/list.length;const parts=[];for(const d of list){const g=new T.Group();g.position.set(d.x-cx,0,d.z-cz);g.rotation.y=(d.yaw||0)*Math.PI/180;s.holder.add(g);if(['npc','monster'].includes(d.kind)){g.scale.setScalar(d.scale||1);parts.push(actorModel(T,g,d))}else if(['cottage','bank','inn','forge'].includes(d.template))g.add(house(d));else{objectModel(T,g,d.template,{...d,groundHeight:()=>0});g.scale.multiplyScalar(d.scale||1)}}animate=dt=>{for(const p of parts)p.update?.(dt,{distance:0,attack:0,hit:0,block:0})};s.model={dispose:()=>parts.forEach(p=>p.dispose?.())}}
  else{const d=list[0];if(!d)return s.canvas;if(d.kind==='item'){s.holder.add(makeDroppedItemModel(T,d.item));s.holder.scale.setScalar(1)}
   else if(['npc','monster'].includes(d.kind)){const g=new T.Group();g.scale.setScalar(d.scale||1);s.holder.add(g);const m=actorModel(T,g,d);let t=0;animate=dt=>{t+=dt;m.update?.(dt,{distance:Math.sin(t*.7)>.2?dt*1.2:0,attack:(t%5)<.55?.55-(t%5):0,hit:0,block:0})};s.model={dispose:()=>m.dispose?.()}}
   else if(['cottage','bank','inn','forge'].includes(d.template))s.holder.add(house(d));
   else{const g=new T.Group();s.holder.add(g);objectModel(T,g,d.template,{...d,groundHeight:()=>0});g.scale.setScalar(d.scale||1)}}
 }catch(e){console.warn('Preview unavailable:',e.message)}
 s.model??={};s.holder.rotation.y=0;s.holder.updateMatrixWorld(true);const box=new T.Box3().setFromObject(s.holder),size=box.getSize(new T.Vector3()),center=box.getCenter(new T.Vector3()),radius=Math.max(.6,size.length()/2);
 s.ground.scale.setScalar(radius*1.4);s.camera.position.set(center.x+radius*1.7,center.y+radius*1.1,center.z+radius*2.3);s.camera.lookAt(center);s.camera.near=radius/50;s.camera.far=radius*20;s.camera.updateProjectionMatrix();
 let last=performance.now();const loop=now=>{if(!s.canvas.isConnected){s.raf=0;return}const dt=Math.min(.05,(now-last)/1000);last=now;s.holder.rotation.y+=dt*.45;animate?.(dt);s.renderer.render(s.scene,s.camera);s.raf=requestAnimationFrame(loop)};s.raf=requestAnimationFrame(loop);
 return s.canvas;
}
