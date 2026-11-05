// Flicker-free panel updates. Panels such as the bank are refreshed on every
// server snapshot; rebuilding their DOM each time re-parses every SVG icon and
// makes WebKit (iPad Safari) repaint the whole dialog, which shows as flashing.
// morphChildren keeps every existing child whose markup is unchanged and only
// swaps the ones that really differ, so steady snapshots touch nothing.
const HANDLERS=['onclick','ondblclick','oncontextmenu','onpointerdown','onpointerup','onpointerenter','onpointerleave','onmouseenter','onmouseleave','oninput','onchange','onkeydown','onfocus','onblur','onsubmit'];
// Unchanged nodes stay in the page, but they take the freshly built node's
// handlers so closures never go stale.
function adoptHandlers(from,to){
 for(const k of HANDLERS)if(from[k]!==undefined&&to[k]!==from[k])to[k]=from[k];
 const a=from.childNodes,b=to.childNodes;if(!a||!b)return;
 for(let i=0;i<a.length&&i<b.length;i++)if(a[i].nodeType===1)adoptHandlers(a[i],b[i]);
}
export function sameNode(a,b){return !!a&&!!b&&(typeof a.isEqualNode==='function'?a.isEqualNode(b):a===b)}
// Returns how many children were replaced, added or removed (0 = no DOM write).
export function morphChildren(parent,next){
 const old=Array.from(parent.childNodes);let changed=0;
 for(let i=0;i<next.length;i++){
  const a=old[i],b=next[i];
  if(sameNode(a,b)){adoptHandlers(b,a);continue}
  changed++;if(a)parent.replaceChild(b,a);else parent.appendChild(b);
 }
 for(let i=next.length;i<old.length;i++){parent.removeChild(old[i]);changed++}
 return changed;
}
// Sets innerHTML only when the markup differs (avoids re-parsing SVG icons).
const markup=new WeakMap();
export function setMarkup(node,html){const value=String(html??'');if(markup.get(node)===value)return false;markup.set(node,value);node.innerHTML=value;return true}
export function setText(node,text){const value=String(text??'');if(node.textContent===value)return false;node.textContent=value;return true}
// Signature gate: run(key) is true only when key changed since the last call.
export function changeGate(){let last;return{changed(key){if(key===last)return false;last=key;return true},reset(){last=undefined}}}
