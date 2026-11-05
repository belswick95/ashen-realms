// Fantasy mouse cursors (pointer devices only; the art and rules live in gameplay.css).
// Toggles two body/canvas classes the stylesheet keys on:
//  - body.cursor-wait while the game is loading or waiting on the world (hourglass)
//  - canvas.cursor-interact while the mouse hovers something in the world you can act on (hand)
const finePointer=()=>typeof matchMedia==='function'&&matchMedia('(hover:hover) and (pointer:fine)').matches;

export function isBusy(doc=globalThis.document,win=globalThis){
 const body=doc?.body;return !!body&&(body.classList.contains('cursor-busy')||body.classList.contains('area-loading')||win.eldervaleWorldLoading===true);
}

export function installCursorStates(){
 if(globalThis.eldervaleCursorStates)return globalThis.eldervaleCursorStates;
 const sync=()=>document.body?.classList.toggle('cursor-wait',isBusy());
 const timer=setInterval(sync,150);sync();
 return globalThis.eldervaleCursorStates={sync,stop:()=>clearInterval(timer)};
}

// Interactable world objects are the meshes in `targets` (NPCs, monsters, trees, rocks, fishing spots, doors, banks…).
// The hand cursor marks things with a real left-click action; examine-only
// things show the normal arrow and scenery is looked through.
export function installWorldHoverCursor({element,camera,targets,raycaster,isBlocked=()=>false,passThrough=()=>false,actionable=()=>true}){
 const pointer={x:0,y:0};let queued=false,last=null;
 const visible=o=>{while(o){if(!o.visible)return false;o=o.parent}return true};
 function test(){queued=false;if(!last||isBlocked()||last.buttons){element.classList.remove('cursor-interact');return}
  const rect=element.getBoundingClientRect();pointer.x=(last.clientX-rect.left)/rect.width*2-1;pointer.y=-(last.clientY-rect.top)/rect.height*2+1;
  raycaster.setFromCamera(pointer,camera);const first=raycaster.intersectObjects(targets.filter(visible),false).find(h=>!passThrough(h.object)),hit=!!first&&actionable(first.object);element.classList.toggle('cursor-interact',hit)}
 element.addEventListener('pointermove',e=>{if(e.pointerType!=='mouse'||!finePointer())return;last={clientX:e.clientX,clientY:e.clientY,buttons:e.buttons};if(!queued){queued=true;requestAnimationFrame(test)}});
 element.addEventListener('pointerleave',()=>{last=null;element.classList.remove('cursor-interact')});
 return {test};
}
