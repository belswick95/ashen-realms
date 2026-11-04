export function deviceProfile({width,height,coarse=false,touch=false,memory=8}){
 const compact=width<=700||((coarse||touch)&&height<=700&&width>height),constrained=memory>0&&memory<=4;
 return {compact,rotateRequired:(coarse||touch)&&height>width,preset:compact?(constrained?'low':'medium'):'high',pixelCap:compact?1.5:2.5};
}
export const graphicsPresets={low:{scale:.65,distance:110,shadows:false},medium:{scale:.8,distance:210,shadows:false},high:{scale:1,distance:330,shadows:true},ultra:{scale:1.25,distance:440,shadows:true}};
export function effectiveGraphics(settings,profile){const auto=settings.preset==='auto',preset=graphicsPresets[auto?profile.preset:settings.preset]||graphicsPresets.high;return {...settings,...(auto?preset:{}),pixelCap:auto?profile.pixelCap:2.5}}
export function installOrientationGate(){
 const existing=document.querySelector('#rotate-phone');if(existing)return existing;
 const rotate=document.createElement('div');rotate.id='rotate-phone';rotate.setAttribute('role','status');rotate.innerHTML='<div><strong>Rotate your phone</strong><p>Eldervale is played in landscape.</p><small>Turn your phone sideways to continue.</small></div>';document.body.append(rotate);
 const update=()=>{const p=deviceProfile({width:innerWidth,height:innerHeight,coarse:matchMedia('(any-pointer:coarse)').matches,touch:navigator.maxTouchPoints>0});document.body.classList.toggle('landscape-required',p.rotateRequired);rotate.hidden=!p.rotateRequired};addEventListener('resize',update);update();return rotate;
}
export function installResponsiveLayout({onChange=()=>{}}={}){
 const rotate=installOrientationGate();document.documentElement.classList.add('game-viewport');document.body.classList.add('game-active');
 const side=document.querySelector('#side'),close=document.createElement('button');close.type='button';close.className='compact-close';close.textContent='×';close.setAttribute('aria-label','Close game panel');side.prepend(close);const title=document.createElement('strong');title.className='compact-panel-title';title.textContent='Inventory';side.prepend(title);
 const collapse=()=>{document.body.classList.remove('compact-panel-open');for(const tab of side.querySelectorAll('[data-tab]'))tab.setAttribute('aria-expanded','false')};close.onclick=collapse;
 for(const tab of side.querySelectorAll('[data-tab]'))tab.addEventListener('click',()=>{if(document.body.classList.contains('fantasy-hud')||!document.body.classList.contains('compact-layout'))return;const was=tab.getAttribute('aria-expanded')==='true';collapse();if(!was){document.body.classList.add('compact-panel-open');title.textContent=({inventory:'Inventory',equipment:'Equipment',skills:'Skills',friends:'Friends',blocked:'Blocked',settings:'Settings'})[tab.dataset.tab]||tab.dataset.tab;tab.setAttribute('aria-expanded','true')}});
 let previous=null;
 function update(){const p=deviceProfile({width:innerWidth,height:innerHeight,coarse:matchMedia('(any-pointer:coarse)').matches,touch:navigator.maxTouchPoints>0,memory:navigator.deviceMemory||8});const phone=(navigator.maxTouchPoints>0||matchMedia('(any-pointer:coarse)').matches)&&innerWidth>(globalThis.visualViewport?.height||innerHeight)&&(globalThis.visualViewport?.height||innerHeight)<=600;document.body.classList.toggle('phone-layout',phone);const report=document.querySelector('#world-report-button'),settings=document.querySelector('#settings-tab');if(report&&settings){const parent=phone?settings:document.body;if(report.parentElement!==parent)parent.append(report);}document.body.classList.toggle('compact-layout',p.compact);document.body.classList.toggle('landscape-required',p.rotateRequired);rotate.hidden=!p.rotateRequired;if(previous!==p.compact){collapse();if(p.compact&&!document.body.classList.contains('fantasy-hud')){document.querySelector('#social-panel').classList.add('collapsed');document.querySelector('#social-toggle').textContent='Show Chat'}}previous=p.compact;onChange(p)}
 const viewport=globalThis.visualViewport;const updateViewport=()=>{document.documentElement.style.setProperty('--visible-height',(viewport?.height||innerHeight)+'px');update()};addEventListener('resize',updateViewport);viewport?.addEventListener('resize',updateViewport);updateViewport();return {collapse};
}
export function installTouchGestures(canvas,{onPinch,onHold}){
 const points=new Map();let distance=0,timer=null,origin=null,pinching=false;
 const cancel=()=>{clearTimeout(timer);timer=null};
 canvas.style.touchAction='none';
 // Safari's native gesture recognizer can zoom the page before pointer events.
 // Block native multi-touch zoom only while the actual game is active, including
 // gestures that start over a HUD panel. Forms keep normal browser accessibility.
 const playing=()=>document.querySelector('#auth-screen')?.hidden===true&&(!document.querySelector('#character-creator')||document.querySelector('#character-creator').hidden);
 const preventNative=e=>{if(playing()&&e.cancelable)e.preventDefault()};
 for(const type of ['gesturestart','gesturechange','gestureend'])document.addEventListener(type,preventNative,{capture:true,passive:false});
 document.addEventListener('touchmove',e=>{if(e.touches.length>1)preventNative(e)},{capture:true,passive:false});

 canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch')return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(points.size===2){cancel();pinching=true;onPinch(1);const [a,b]=[...points.values()];distance=Math.hypot(a.x-b.x,a.y-b.y);canvas.setPointerCapture(e.pointerId);e.stopImmediatePropagation()}else if(points.size===1){origin={x:e.clientX,y:e.clientY};timer=setTimeout(()=>{timer=null;if(!pinching)onHold(origin)},550)}},{capture:true});
 canvas.addEventListener('pointermove',e=>{if(!points.has(e.pointerId))return;points.set(e.pointerId,{x:e.clientX,y:e.clientY});if(origin&&Math.hypot(e.clientX-origin.x,e.clientY-origin.y)>6)cancel();if(pinching){e.stopImmediatePropagation();if(points.size===2){const [a,b]=[...points.values()],next=Math.hypot(a.x-b.x,a.y-b.y);if(distance>0&&next>0)onPinch(distance/next);distance=next}}},{capture:true});
 for(const type of ['pointerup','pointercancel','lostpointercapture'])canvas.addEventListener(type,e=>{if(e.pointerType!=='touch')return;cancel();points.delete(e.pointerId);if(pinching){e.stopImmediatePropagation();if(!points.size){pinching=false;distance=0}}},{capture:true});
}

// Safari can resize its visual viewport without a window resize (zoom/browser chrome).
export function bindGameViewport(canvas,onResize){
 canvas.id='world-canvas';let frame=0;
 const update=()=>{frame=0;const box=canvas.getBoundingClientRect();onResize(Math.max(1,Math.round(box.width)),Math.max(1,Math.round(box.height)))};
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update)};
 addEventListener('resize',schedule);globalThis.visualViewport?.addEventListener('resize',schedule);addEventListener('orientationchange',schedule);
 const observer=typeof ResizeObserver==='function'?new ResizeObserver(schedule):null;observer?.observe(canvas);update();
 return ()=>{removeEventListener('resize',schedule);globalThis.visualViewport?.removeEventListener('resize',schedule);removeEventListener('orientationchange',schedule);observer?.disconnect();if(frame)cancelAnimationFrame(frame)};
}
