import test from 'node:test';import assert from 'node:assert/strict';import * as T from 'three';
import {celestialLight,installShadowEdgeFade,stabilizeSun,shadowQuality} from '../sun-shadow.js';
import {lightingAt} from '../world-lighting.js';

test('day/night lighting changes smoothly with no colour steps',()=>{
 const channels=c=>[c>>16&255,c>>8&255,c&255];
 for(let d=0;d<1;d+=.01){const a=lightingAt(d),b=lightingAt(d+.01);
  assert.ok(Math.abs(a.directional-b.directional)<.05&&Math.abs(a.ambient-b.ambient)<.02&&Math.abs(a.exposure-b.exposure)<.01);
  for(const key of ['sunColor','skyColor','groundColor']){const x=channels(a[key]),y=channels(b[key]);for(let i=0;i<3;i++)assert.ok(Math.abs(x[i]-y[i])<=12,key+' jumps at '+d.toFixed(2))}}
 assert.ok(lightingAt(1).exposure<lightingAt(0).exposure,'bright noon is exposed down, not blown out');
});

test('sun hands over to the moon at the horizon without a visible jump',()=>{
 const noon=celestialLight(T,12),midnight=celestialLight(T,0),dusk=celestialLight(T,18);
 assert.ok(noon.fade>.99&&midnight.fade>.99&&dusk.fade<.01);assert.equal(midnight.night,true);
 // Noon is high but tilted so shadows read beside objects.
 const n=noon.direction.clone().normalize();assert.ok(n.y>.85&&n.y<.98);
 // The direction is quantised: two sky ticks a few seconds apart give the same vector.
 assert.ok(celestialLight(T,14).direction.equals(celestialLight(T,14+2/3600).direction));
 for(let h=0;h<24;h+=.25){const l=celestialLight(T,h);assert.ok(l.direction.y>0);assert.ok(Math.abs(l.direction.length()-85)<1e-6)}
});

test('shadow box can lead the camera while staying on the texel grid',()=>{
 const sun=new T.DirectionalLight();Object.assign(sun.shadow.camera,{left:-32,right:32});sun.shadow.mapSize.set(2048,2048);sun.userData.direction=new T.Vector3(40,65,30);
 const focus=new T.Vector3(10,2,-4),ahead=new T.Vector3(0,0,-11);stabilizeSun(T,sun,focus,ahead);
 assert.ok(sun.target.position.distanceTo(focus.clone().add(ahead))<.1);
 for(const preset of ['low','medium','high','ultra']){const q=shadowQuality(preset);assert.ok(q.normalBias>0&&q.lamps>=1&&q.lamps<=4)}
 assert.ok(shadowQuality('low').lamps<=shadowQuality('high').lamps);
});

test('shadow edge fade patches the shared chunk once',()=>{
 const before=T.ShaderChunk.shadowmap_pars_fragment;const patched=installShadowEdgeFade(T);
 assert.ok(T.ShaderChunk.shadowmap_pars_fragment.includes('eldervaleShadowFade'));assert.equal(installShadowEdgeFade(T),false);
 if(patched)assert.ok(T.ShaderChunk.shadowmap_pars_fragment.length>before.length);
});
