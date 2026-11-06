// Prop lights (camp lanterns, campfires, furnaces, lit fires) used to be real
// PointLights inside each streamed model. Every light added to or removed from
// the scene changes the light count baked into every lit shader, so walking
// into the castle (one furnace light) recompiled ~50 programs in one frame.
// Instead each prop light becomes a proxy anchor, and the nearest proxies borrow
// the fixed lantern pool in game.js, so the scene's light count never changes.
export function createLightProxies(T,{scene,pool=[]}){
 const scanned=new WeakSet(),proxies=new Set(),pooled=new Set(pool),scratch=new T.Vector3();let seenChildren=-1,nextFull=0;
 // Replace every unpooled point light under root with an anchor that remembers it.
 function adopt(root){const found=[];root.traverse(o=>{if(o.isPointLight&&!pooled.has(o))found.push(o)});
  for(const light of found){const parent=light.parent;if(!parent)continue;const anchor=new T.Object3D();anchor.name='light-proxy';anchor.position.copy(light.position);anchor.userData.lightProxy=light;parent.add(anchor);light.removeFromParent();proxies.add(anchor)}
  return found.length}
 // Adopt lights under new top-level scene children (cheap unless the scene changed).
 function scan(now=0,force=false){if(!force&&scene.children.length===seenChildren&&now<nextFull)return 0;seenChildren=scene.children.length;nextFull=now+1000;let n=0;for(const c of scene.children){if(scanned.has(c)||pooled.has(c))continue;scanned.add(c);n+=adopt(c)}return n}
 function attached(o){while(o){if(o===scene)return true;o=o.parent}return false}
 // Live proxies (in the scene and visible) ordered by distance, each with its world position.
 function nearest(position,limit=Infinity){const out=[];for(const a of proxies){if(!attached(a)){proxies.delete(a);continue}let visible=true;for(let o=a;o;o=o.parent)if(!o.visible){visible=false;break}const light=a.userData.lightProxy;if(!visible||!(light.intensity>0))continue;a.getWorldPosition(scratch);const d=scratch.distanceTo(position);if(d>(light.distance||20)*1.6)continue;out.push({anchor:a,light,position:scratch.clone(),distance:d})}
  return out.sort((x,y)=>x.distance-y.distance).slice(0,limit)}
 // Copy a proxy's look onto a pooled light.
 function apply(target,proxy){const l=proxy.light;target.color.copy(l.color);target.intensity=l.intensity;target.distance=l.distance;target.decay=l.decay;target.position.copy(proxy.position)}
 return {adopt,scan,nearest,apply,get size(){return proxies.size}};
}
