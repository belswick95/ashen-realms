// Keep the shadow projection fixed to its texel grid as the player moves.
// `ahead` (optional) shifts the shadow box toward what the camera looks at, so
// the texels are spent on the visible ground rather than behind the camera.
export function stabilizeSun(T,sun,focus,ahead=null){
 const direction=sun.userData.direction||new T.Vector3(40,65,30),right=new T.Vector3(direction.z,0,-direction.x);if(right.lengthSq()<.0001)right.set(1,0,0);right.normalize();const up=new T.Vector3().crossVectors(direction,right).normalize();
 const texel=(sun.shadow.camera.right-sun.shadow.camera.left)/sun.shadow.mapSize.x;
 const target=focus.clone();if(ahead)target.add(ahead);
 for(const axis of [right,up]){const value=target.dot(axis);target.addScaledVector(axis,Math.round(value/texel)*texel-value)}
 sun.target.position.copy(target);sun.position.copy(target).add(direction);
}

// normalBias tracks the texel size (~0.6 texel) so slopes stay acne-free on
// coarse maps without detaching shadows (peter-panning) on fine ones.
// lamps: how many pooled lantern point lights the tier can afford.
export function shadowQuality(preset='high',compact=false){
 if(preset==='low')return {size:512,radius:22,interval:150,normalBias:.05,lamps:2};
 if(compact||preset==='medium')return {size:1024,radius:24,interval:67,normalBias:.03,lamps:3};
 return preset==='ultra'?{size:2048,radius:38,interval:16,normalBias:.022,lamps:4}:{size:2048,radius:32,interval:33,normalBias:.02,lamps:4};
}

// Sun by day, moon by night. The light swaps body only while it sits at the
// horizon, where `fade` is ~0, so the shadow direction never visibly jumps.
// Noon is tilted (~70 degrees) so midday shadows still read beside objects.
// The direction is quantised to ~0.25 degrees: re-aiming the shadow camera
// every sky tick makes edges crawl, a step a minute does not.
export function celestialLight(T,hour){
 const angle=(hour-6)/24*Math.PI*2,elevation=Math.sin(angle),night=elevation<0;
 const a=Math.round((night?angle+Math.PI:angle)/.0044)*.0044,c=Math.cos(a);
 const direction=new T.Vector3(c*.6+.22,Math.max(.26,Math.sin(a)),c*.8+.3).normalize().multiplyScalar(85);
 const t=Math.min(1,Math.abs(elevation)/.12),fade=t*t*(3-2*t);
 return {direction,night,fade};
}

// Shadows fade out over the outer rim of the shadow box instead of ending on
// a hard line that slides with the player. Patched once into Three's shared
// shader chunk, before any material compiles; costs two ALU ops per light.
export function installShadowEdgeFade(T,rim=.14){
 const chunk=T.ShaderChunk.shadowmap_pars_fragment,mark='eldervaleShadowFade';
 if(!chunk||chunk.includes(mark))return false;
 const head='float getShadow( sampler2D shadowMap, vec2 shadowMapSize, float shadowBias, float shadowRadius, vec4 shadowCoord ) {',start=chunk.indexOf(head);if(start<0)return false;
 const end=chunk.indexOf('return shadow;',start);if(end<0)return false;
 const fade=`// ${mark}\n\t\tvec2 shadowEdge=min(shadowCoord.xy,1.0-shadowCoord.xy);\n\t\tshadow=mix(1.0,shadow,smoothstep(0.0,${rim.toFixed(3)},min(shadowEdge.x,shadowEdge.y)));\n\t\t`;
 T.ShaderChunk.shadowmap_pars_fragment=chunk.slice(0,end)+fade+chunk.slice(end);
 return true;
}
