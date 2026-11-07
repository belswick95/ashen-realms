import * as T from 'https://cdn.jsdelivr.net/npm/three@0.160.1/build/three.module.js';
import {buildHumanoid} from './humanoid.js?v=release-20261107-ui139';
import {preloadCharacters} from './character-assets.js?v=release-20261107-ui139';
import {createHumanoidAnimator} from './animation.js?v=release-20261107-ui139';
import {previewFraming,previewFrame} from './preview-framing.js?v=release-20261107-ui139';

// Uses the same meshes as the player and NPCs, not a separate illustration.
export function createCharacterPreview(host,initial){
 const scene=new T.Scene();
 const FOV=30,camera=new T.PerspectiveCamera(FOV,1,.1,50);
 const renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'low-power'});
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
 renderer.outputColorSpace=T.SRGBColorSpace;
 renderer.domElement.setAttribute('aria-label','Rotatable 3D preview of your character');
 renderer.domElement.style.cssText='width:100%;flex:1;min-height:0;display:block;touch-action:pan-y;cursor:grab';
 host.replaceChildren(renderer.domElement);
 if(getComputedStyle(host).position==='static')host.style.position='relative';
 host.style.display='flex';host.style.flexDirection='column';
 // Soft three-point light: warm key from the upper left, a gentle front fill
 // so the face is never in shadow, and a cool rim to lift the silhouette.
 scene.add(new T.HemisphereLight(0xfff5dd,0x536a68,1.9));
 const key=new T.DirectionalLight(0xffdfad,2.3);key.position.set(-3,6,5);scene.add(key);
 const fill=new T.DirectionalLight(0xfff1e0,.9);fill.position.set(1.5,2.6,6);scene.add(fill);
 const rim=new T.DirectionalLight(0xb7d7ff,1.2);rim.position.set(3,3,-4);scene.add(rim);
 // A faint ground disc so the feet read as standing on something.
 const ground=new T.Mesh(new T.CircleGeometry(.75,40),new T.MeshBasicMaterial({color:0x000000,transparent:true,opacity:.22,depthWrite:false}));ground.rotation.x=-Math.PI/2;ground.position.y=.002;scene.add(ground);
 const turntable=new T.Group();scene.add(turntable);
 let mode='Idle',portrait=false,poseTime=0;
 let model=null,rig=null,animator=null,lastTime=performance.now(),frame=0,disposed=false,dragging=false,lastX=0,rotation=-.25,aspect=1;
 const head=new T.Vector3(),view={distance:7,aimY:1.35,ready:false};
 const resize=()=>{if(disposed)return;const c=renderer.domElement,w=Math.max(c.clientWidth,120),h=Math.max(c.clientHeight,120);renderer.setSize(w,h,false);aspect=w/h;camera.aspect=aspect;camera.updateProjectionMatrix()};
 const observer=new ResizeObserver(resize);observer.observe(host);
 // Characters load their models once; until then the latest look is queued.
 let ready=false,pending=initial;
 function update(look){pending=look;if(!ready)return;animator?.dispose();rig?.dispose();if(model)turntable.remove(model);model=new T.Group();rig=buildHumanoid(T,model,look);animator=createHumanoidAnimator(rig);turntable.add(model);view.ready=false}
 preloadCharacters(T).then(()=>{ready=true;if(!disposed)update(pending)}).catch(e=>console.error('Character preview unavailable',e));
 const controls=document.createElement('div');controls.setAttribute('role','group');controls.setAttribute('aria-label','Character preview controls');controls.style.cssText='flex:none;display:flex;flex-wrap:wrap;justify-content:center;gap:3px;padding:6px 2px 2px';
 const style='margin:0;padding:4px 6px;font:11px Arial;border:1px solid #a48a60;border-radius:4px;background:#23362e;color:#efdfbf;min-height:28px';
 const modeButtons=[];
 const turnButton=(label,title,delta)=>{const b=document.createElement('button');b.type='button';b.textContent=label;b.title=title;b.setAttribute('aria-label',title);b.style.cssText=style+';min-width:26px';b.onclick=()=>{rotation+=delta};controls.append(b)};
 turnButton('⟲','Turn left',-.45);
 for(const label of ['Idle','Walk','Run','Combat']){const button=document.createElement('button');button.type='button';button.textContent=label;button.style.cssText=style;button.setAttribute('aria-pressed',String(label===mode));button.onclick=()=>{mode=label;poseTime=0;for(const b of modeButtons)b.setAttribute('aria-pressed',String(b.textContent===mode))};modeButtons.push(button);controls.append(button)}
 const face=document.createElement('button');face.type='button';face.textContent='Face';face.style.cssText=style;face.setAttribute('aria-pressed','false');face.onclick=()=>{portrait=!portrait;face.textContent=portrait?'Body':'Face';face.setAttribute('aria-pressed',String(portrait))};controls.append(face);
 turnButton('⟳','Turn right',.45);
 host.append(controls);
 renderer.domElement.tabIndex=0;
 const keyboard=e=>{if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();rotation+=e.key==='ArrowLeft'?-.15:.15}};
 renderer.domElement.addEventListener('keydown',keyboard);
 const down=e=>{dragging=true;lastX=e.clientX;renderer.domElement.setPointerCapture(e.pointerId);renderer.domElement.style.cursor='grabbing'};
 const move=e=>{if(!dragging)return;rotation+=(e.clientX-lastX)*.012;lastX=e.clientX};
 const up=()=>{dragging=false;renderer.domElement.style.cursor='grab'};
 renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',up);
 // Frame from the character's own head bone, smoothed so idle sway and the
 // face/body switch glide instead of jumping.
 function aim(dt){
  if(!rig)return;const bone=rig.bones.Head||rig.bones.head;if(!bone)return;model.updateMatrixWorld(true);bone.getWorldPosition(head);
  // Frame the standing height, not the crouch of a combat stance or a run.
  rig.standHead=Math.max(rig.standHead||0,head.y);const headY=Math.max(head.y,rig.standHead*.97),crownY=headY+.26*(model.scale.y||1);
  const want=previewFraming({...previewFrame(portrait?'face':'body',{headY,crownY}),fov:FOV,aspect});
  const k=view.ready?1-Math.exp(-dt*6):1;view.distance+=(want.distance-view.distance)*k;view.aimY+=(want.aimY-view.aimY)*k;view.ready=true;
  // A slightly raised eye line looking a touch down reads as natural.
  camera.position.set(0,view.aimY+view.distance*.05,view.distance);camera.lookAt(0,view.aimY,0);
 }
 function tick(){if(disposed)return;turntable.rotation.y=rotation;const now=performance.now();const dt=Math.min(.05,(now-lastTime)/1000);poseTime+=dt;const speed=mode==='Run'?5.2:mode==='Walk'?2.6:0;if(animator)animator.update(dt,{distance:speed*dt,speed,locomotion:mode==='Run'?'jog':mode==='Walk'?'walk':null,combat:mode==='Combat',armed:mode==='Combat',attack:mode==='Combat'?Math.max(0,.55-poseTime%2.2):0});aim(dt);lastTime=now;renderer.render(scene,camera);frame=requestAnimationFrame(tick)}
 update(initial);resize();tick();
 return {update,dispose(){if(disposed)return;disposed=true;cancelAnimationFrame(frame);observer.disconnect();up();renderer.domElement.removeEventListener('keydown',keyboard);controls.remove();renderer.dispose();renderer.domElement.remove()}};
}
