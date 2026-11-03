const clamp=v=>Math.max(-1,Math.min(1,v));
export function movementInput(keys,yaw,cameraYaw,rightMouse,dt){
 const has=key=>keys.has(key),forward=Number(has('KeyW')||has('ArrowUp'))-Number(has('KeyS')||has('ArrowDown'));
 const side=Number(has('KeyD')||has('ArrowRight'))-Number(has('KeyA')||has('ArrowLeft'));
 if(!rightMouse)yaw-=side*2.25*dt;else yaw=cameraYaw+Math.PI;
 const strafe=clamp(Number(has('KeyE'))-Number(has('KeyQ'))+(rightMouse?side:0));
 yaw=Math.atan2(Math.sin(yaw),Math.cos(yaw));let x=Math.sin(yaw)*forward-Math.cos(yaw)*strafe,z=Math.cos(yaw)*forward+Math.sin(yaw)*strafe;const length=Math.hypot(x,z);if(length>1){x/=length;z/=length}return {x,z,yaw,moving:length>.001};
}
export function jumpHeight(timestamp,now){const t=(now-Date.parse(timestamp))/800;return t>=0&&t<=1?2.8*t*(1-t):0}
export function installMMOControls({element,getYaw,getCameraYaw,isRightMouse,isBlocked,onInput,onJump,onSprint}){
 const keys=new Set(),valid=new Set(['KeyW','KeyA','KeyS','KeyD','KeyQ','KeyE','ArrowUp','ArrowDown','ArrowLeft','ArrowRight']);let yaw=getYaw(),active=false,sprint=false,lastPacket=0,lastSignature='';
 const editing=event=>event.target?.closest?.('input,textarea,select,[contenteditable=true],[role=dialog]');
 function clear(){keys.clear();if(sprint)onSprint(false);sprint=false;if(active)onInput({x:0,z:0,yaw,moving:false});active=false;}
 const down=e=>{if(editing(e)||isBlocked())return;if(valid.has(e.code)){e.preventDefault();keys.add(e.code);if(!active){yaw=getYaw();active=true}onInput(movementInput(keys,yaw,getCameraYaw(),isRightMouse(),0));lastPacket=performance.now()}if(e.code==='Space'){e.preventDefault();if(!e.repeat)onJump()}if(e.code==='ShiftLeft'||e.code==='ShiftRight'){if(!sprint)onSprint(true);sprint=true}};
 const up=e=>{keys.delete(e.code);if(valid.has(e.code)&&active&&!keys.size)clear();if(e.code==='ShiftLeft'||e.code==='ShiftRight'){if(sprint)onSprint(false);sprint=false}};
 const heartbeat=setInterval(()=>{if(!active)return;if(isBlocked()){clear();return}if(keys.size)onInput(movementInput(keys,yaw,getCameraYaw(),isRightMouse(),0))},200);addEventListener('pagehide',()=>clearInterval(heartbeat),{once:true});
 addEventListener('keydown',down);addEventListener('keyup',up);addEventListener('blur',clear);document.addEventListener('visibilitychange',()=>{if(document.hidden)clear()});
 // A separate movement pad keeps drag-to-orbit available on touch screens.
 const pad=document.createElement('div');pad.id='movement-pad';pad.innerHTML='<button data-key="KeyW" aria-label="Walk forward">▲</button><button data-key="KeyA" aria-label="Turn left">◀</button><button data-key="KeyS" aria-label="Walk backward">▼</button><button data-key="KeyD" aria-label="Turn right">▶</button><button data-jump aria-label="Jump">Jump</button>';document.body.append(pad);
 for(const button of pad.querySelectorAll('button')){button.addEventListener('pointerdown',e=>{e.preventDefault();if(isBlocked())return;button.setPointerCapture(e.pointerId);if(button.dataset.key)keys.add(button.dataset.key);else onJump()});for(const name of ['pointerup','pointercancel','lostpointercapture'])button.addEventListener(name,()=>{keys.delete(button.dataset.key);if(active&&!keys.size)clear()})}
 return {update(dt,now){if(isBlocked()){clear();return null}if(!keys.size&&!active){yaw=getYaw();return null}if(!active)yaw=getYaw();const input=movementInput(keys,yaw,getCameraYaw(),isRightMouse(),dt);yaw=input.yaw;const engaged=keys.size>0;const signature=[input.x.toFixed(2),input.z.toFixed(2),input.yaw.toFixed(2)].join(':');if(now-lastPacket>200||!engaged&&active||signature!==lastSignature&&now-lastPacket>70){onInput(input);lastPacket=now;lastSignature=signature}active=engaged;return engaged?input:null},clear};
}
