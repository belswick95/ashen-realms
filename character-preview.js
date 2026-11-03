import * as T from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import {buildHumanoid} from './humanoid.js?v=release-20261103-surfaces21';
import {createHumanoidAnimator} from './animation.js?v=release-20261103-surfaces21';

// Uses the same meshes as the player and NPCs, not a separate illustration.
export function createCharacterPreview(host,initial){
 const scene=new T.Scene();
 const camera=new T.PerspectiveCamera(35,1,.1,50);
 camera.position.set(0,1.52,6.8);camera.lookAt(0,1.35,0);
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
 renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.shadowMap.enabled=true;
 renderer.domElement.setAttribute('aria-label','Rotatable 3D preview of your character');
 renderer.domElement.style.cssText='width:100%;height:100%;display:block;touch-action:pan-y;cursor:grab';
 host.replaceChildren(renderer.domElement);
 scene.add(new T.HemisphereLight(0xfff5dd,0x536a68,2.1));
 const key=new T.DirectionalLight(0xffdfad,2.6);key.position.set(-3,6,5);scene.add(key);
 const rim=new T.DirectionalLight(0xb7d7ff,1.2);rim.position.set(3,3,-4);scene.add(rim);
 const turntable=new T.Group();scene.add(turntable);
 let mode='Idle',portrait=false,poseTime=0;
 let model=null,rig=null,animator=null,lastTime=performance.now(),frame=0,disposed=false,dragging=false,lastX=0,rotation=-.25;
 const resize=()=>{if(disposed)return;const w=Math.max(host.clientWidth,200),h=Math.max(host.clientHeight,200);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};
 const observer=new ResizeObserver(resize);observer.observe(host);
 function update(look){if(model){turntable.remove(model);}model=new T.Group();rig=buildHumanoid(T,model,look);animator=createHumanoidAnimator(rig);turntable.add(model)}
 const controls=document.createElement('div');controls.setAttribute('role','group');controls.setAttribute('aria-label','Character preview controls');controls.style.cssText='position:absolute;bottom:8px;left:6px;right:6px;display:flex;flex-wrap:wrap;justify-content:center;gap:4px;z-index:2';
 if(getComputedStyle(host).position==='static')host.style.position='relative';
 for(const label of ['Idle','Walk','Run','Combat','Face']){const button=document.createElement('button');button.type='button';button.textContent=label;button.style.cssText='margin:0;padding:5px 7px;font:11px Arial;border:1px solid #a48a60;border-radius:4px;background:#23362e;color:#efdfbf';button.setAttribute('aria-pressed',String(label==='Idle'));button.onclick=()=>{if(label==='Face'){portrait=!portrait;button.textContent=portrait?'Body':'Face';button.setAttribute('aria-pressed',String(portrait));camera.position.set(0,portrait?2.47:1.52,portrait?1.45:6.8);camera.lookAt(0,portrait?2.49:1.35,0)}else{mode=label;poseTime=0;for(const child of controls.children)if(child!==controls.lastChild)child.setAttribute('aria-pressed',String(child.textContent===mode))}};controls.append(button)}
 host.append(controls);
 renderer.domElement.tabIndex=0;
 const keyboard=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();rotation+=e.key==='ArrowLeft'?-.15:.15}};
 renderer.domElement.addEventListener('keydown',keyboard);
 const down=e=>{dragging=true;lastX=e.clientX;renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.style.cursor='grabbing'};
 const move=e=>{if(!dragging)return;rotation+=(e.clientX-lastX)*.012;lastX=e.clientX};
 const up=()=>{dragging=false;renderer.domElement.style.cursor='grab'};
 renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);
 function tick(){if(disposed)return;turntable.rotation.y=rotation;const now=performance.now();const dt=Math.min(.05,(now-lastTime)/1000);poseTime+=dt;const speed=mode==='Run'?5:mode==='Walk'?1.4:0;if(animator)animator.update(dt,{distance:speed*dt,speed,attack:mode==='Combat'?Math.max(0,.55-poseTime%1.3):0});lastTime=now;renderer.render(scene,camera);frame=requestAnimationFrame(tick)}
 update(initial);resize();tick();
 return {update,dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();up();renderer.domElement.removeEventListener('keydown',keyboard);controls.remove();renderer.dispose();renderer.domElement.remove()}};
}
