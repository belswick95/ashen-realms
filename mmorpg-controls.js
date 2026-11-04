const clamp=v=>Math.max(-1,Math.min(1,v));
export function movementInput(keys,yaw,cameraYaw,rightMouse,dt){
 const has=key=>keys.has(key),forward=Number(has('KeyW')||has('ArrowUp'))-Number(has('KeyS')||has('ArrowDown'));
 const side=Number(has('KeyD')||has('ArrowRight'))-Number(has('KeyA')||has('ArrowLeft'));
 if(!rightMouse)yaw-=side*2.25*dt;else yaw=cameraYaw+Math.PI;
 const strafe=clamp(Number(has('KeyE'))-Number(has('KeyQ'))+(rightMouse?side:0));
 yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));let x=Math.sin(yaw)*forward-Math.cos(yaw)*strafe,z=Math.cos(yaw)*forward+Math.sin(yaw)*strafe;const length=Math.hypot(x,z);if(length>1){x/=length;z/=length}return {x,z,yaw,moving:length>.001};
}
export function touchMovement(x,y,cameraYaw){const length=Math.hypot(x,y);if(length<.16)return {x:0,z:0,yaw:cameraYaw+Math.PI,moving:false};const right=x/Math.max(1,length),forward=-y/Math.max(1,length),yaw=cameraYaw+Math.PI,dx=Math.sin(yaw)*forward-Math.cos(yaw)*right,dz=Math.cos(yaw)*forward+Math.sin(yaw)*right;return {x:dx,z:dz,yaw:Math.atan2(dx,dz),moving:true};}
export function jumpHeight(timestamp,now){const t=(now-Date.parse(timestamp))/800;return t>=0&&t<=1?2.8*t*(1-t):0}
export function installMMOControls({element,getYaw,getCameraYaw,isRightMouse,isBlocked,onInput,onJump,onSprint}){
 const keys=new Set(),valid=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);let yaw=getYaw(),active=false,sprint=false,lastPacket=0,lastSignature='',touchId=null,touchX=0,touchY=0;
 const emit=(input,now=performance.now())=>{onInput(input);lastPacket=now;lastSignature=[input.x.toFixed(2),input.z.toFixed(2),input.yaw.toFixed(2)].join(':')};
 const editing=event=>event.target?.closest?.('input,textarea,select,[contenteditable=true],[role=dialog]');
 function stop(){touchId=null;touchX=touchY=0;document.querySelector('#movement-stick')?.style.setProperty('transform','translate(-50%,-50%)');keys.clear();if(active)emit({x:0,z:0,yaw,moving:false});active=false;}
 function clear(){stop();if(sprint)onSprint(false);sprint=false;}
 const down=e=>{if(editing(e)||isBlocked())return;if(valid.has(e.code)){e.preventDefault();if(keys.has(e.code))return;keys.add(e.code);if(!active){yaw=getYaw();active=true}emit(movementInput(keys,yaw,getCameraYaw(),isRightMouse(),0))}if(e.code==='Space'){e.preventDefault();if(!e.repeat)onJump()}if(e.code==='ShiftLeft'||e.code==='ShiftRight'){if(!sprint)onSprint(true);sprint=true}};
 const up=e=>{keys.delete(e.code);if(valid.has(e.code)&&active&&!keys.size)stop();if(e.code==='ShiftLeft'||e.code==='ShiftRight'){if(sprint)onSprint(false);sprint=false}};
 const heartbeat=setInterval(()=>{if(!active)return;if(isBlocked()){clear();return}if(keys.size||touchId!==null)emit(touchId!==null?touchMovement(touchX,touchY,getCameraYaw()):movementInput(keys,yaw,getCameraYaw(),isRightMouse(),0))},200);addEventListener('pagehide',()=>clearInterval(heartbeat),{once:true});
 addEventListener('keydown',down);addEventListener('keyup',up);addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear()});
 // A camera-relative thumbstick permits simultaneous movement, camera drag and jump.
 const pad=document.createElement('div');pad.id='movement-pad';pad.setAttribute('role','group');pad.setAttribute('aria-label','Movement controls');pad.innerHTML='<div id="movement-base" role="button" tabindex="0" aria-label="Drag to move"><svg viewBox="0 0 120 120" aria-hidden="true"><path d="m60 13-7 9h14ZM107 60l-9-7v14ZM60 107l7-9H53ZM13 60l9 7V53Z" fill="currentColor"/></svg><span id="movement-stick"></span></div>';document.body.append(pad);
 const base=pad.querySelector('#movement-base'),stick=pad.querySelector('#movement-stick'),jump=document.createElement('button');jump.id='touch-jump';jump.type='button';jump.setAttribute('aria-label','Jump');jump.innerHTML='<svg viewBox="0 0 32 32" aria-hidden="true"><path d="m9 15 7-8 7 8M16 8v16M8 26h16"/></svg><span>Jump</span>';document.body.append(jump);
 const touchProfile=()=>document.body.classList.toggle('touch-controls',matchMedia('(pointer:coarse)').matches||(navigator.maxTouchPoints>0&&!matchMedia('(hover:hover)').matches));touchProfile();addEventListener('resize',()=>{clear();touchProfile()});
 function touchPosition(e){const r=base.getBoundingClientRect(),radius=r.width*.34,dx=(e.clientX-r.left-r.width/2)/radius,dy=(e.clientY-r.top-r.height/2)/radius,l=Math.max(1,Math.hypot(dx,dy));touchX=dx/l;touchY=dy/l;stick.style.transform='translate(calc(-50% + '+(touchX*radius)+'px),calc(-50% + '+(touchY*radius)+'px))';}
 base.addEventListener('pointerdown',e=>{if(touchId!==null||isBlocked())return;e.preventDefault();e.stopPropagation();touchId=e.pointerId;base.setPointerCapture(e.pointerId);touchPosition(e);active=true;emit(touchMovement(touchX,touchY,getCameraYaw()))});base.addEventListener('pointermove',e=>{if(e.pointerId===touchId){e.preventDefault();touchPosition(e)}});
 for(const name of ['pointerup','pointercancel','lostpointercapture'])base.addEventListener(name,e=>{if(e.pointerId===touchId){e.preventDefault();stop()}});
 jump.addEventListener('pointerdown',e=>{e.preventDefault();e.stopPropagation();if(!isBlocked())onJump()});
 return {update(dt,now){if(isBlocked()){clear();return null}if(!keys.size&&touchId===null&&!active){yaw=getYaw();return null}if(!active)yaw=getYaw();const input=touchId!==null?touchMovement(touchX,touchY,getCameraYaw()):movementInput(keys,yaw,getCameraYaw(),isRightMouse(),dt);yaw=input.yaw;const engaged=keys.size>0||touchId!==null;const signature=[input.x.toFixed(2),input.z.toFixed(2),input.yaw.toFixed(2)].join(':');if(now-lastPacket>200||!engaged&&active||signature!==lastSignature&&now-lastPacket>70){emit(input,now)}active=engaged;return engaged?(touchId!==null&&!input.moving?null:input):null},get touchActive(){return touchId!==null},clear};
}
