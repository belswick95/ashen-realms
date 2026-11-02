import * as T from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import {buildHumanoid} from './humanoid.js';

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
 let model=null,frame=0,disposed=false,dragging=false,lastX=0,rotation=-.25;
 const resize=()=>{if(disposed)return;const w=Math.max(host.clientWidth,200),h=Math.max(host.clientHeight,200);renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()};
 const observer=new ResizeObserver(resize);observer.observe(host);
 function update(look){if(model){turntable.remove(model);model.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}})}model=new T.Group();buildHumanoid(T,model,look);turntable.add(model)}
 const down=e=>{dragging=true;lastX=e.clientX;renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.style.cursor='grabbing'};
 const move=e=>{if(!dragging)return;rotation+=(e.clientX-lastX)*.012;lastX=e.clientX};
 const up=()=>{dragging=false;renderer.domElement.style.cursor='grab'};
 renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);
 function tick(){if(disposed)return;turntable.rotation.y=rotation;renderer.render(scene,camera);frame=requestAnimationFrame(tick)}
 update(initial);resize();tick();
 return {update,dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();up();if(model)model.traverse(o=>{if(o.isMesh){o.geometry.dispose();o.material.dispose()}});renderer.dispose();renderer.domElement.remove()}};
}
