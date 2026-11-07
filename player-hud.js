import {cloneSpeaker} from './dialogue-portrait.js?v=release-20261107-ground158';
import {texturesSettled} from './character-assets.js?v=release-20261107-ground158';
// The portrait renders the actual equipped player meshes, using the existing GPU
// context only when the look changes (worn gear, hair, skin). No second animated
// renderer is needed: one small offscreen render, copied into a 2D canvas.
// What the portrait shows: every worn armour piece (helm, hood, crown, chest,
// cape...) and the appearance. Held items are hidden in the portrait.
export function portraitLook(equipped={},appearance={}){
 const worn=Object.keys(equipped&&typeof equipped==='object'?equipped:{}).filter(k=>equipped[k]===true).sort();
 const look=appearance&&typeof appearance==='object'?Object.keys(appearance).sort().map(k=>k+'='+appearance[k]):[];
 return worn.join(',')+'|'+look.join(',');
}
export const PORTRAIT_SIZE=112;
// Snapshot refreshes write the same values again; skip equal writes so the
// HUD is not re-laid-out and repainted several times a second.
const put=(node,key,value)=>{if(node&&node[key]!==value)node[key]=value};
export function createPlayerHUD(T,renderer,model){
 const host=document.querySelector('#health-hud');host.innerHTML='<span class="portrait-frame"><canvas id="player-portrait" width="'+PORTRAIT_SIZE+'" height="'+PORTRAIT_SIZE+'" role="img" aria-label="Your equipped character portrait"></canvas></span><div class="player-vitals"><strong id="hud-name"></strong><div class="health-track" role="progressbar" aria-label="Health" aria-valuemin="0" aria-valuemax="100"><div id="health-fill"></div><span id="hud-health"></span></div><div class="xp-track" role="progressbar" aria-label="Combat level out of 126" aria-valuemin="0" aria-valuemax="100"><div id="hud-xp-fill"></div></div><small id="hud-info"></small></div><button id="special-attack" type="button" disabled aria-label="Special attack unavailable for this weapon" title="This weapon has no special attack">Spec</button>';
 const canvas=host.querySelector('canvas'),ctx=canvas.getContext('2d'),N=PORTRAIT_SIZE,target=new T.WebGLRenderTarget(N,N),scene=new T.Scene();target.texture.colorSpace=T.SRGBColorSpace;scene.background=new T.Color(0x2a2118);scene.add(new T.HemisphereLight(0xfff3d8,0x506761,2.4));const light=new T.DirectionalLight(0xffe4bc,3);light.position.set(2,4,5);scene.add(light);
 const camera=new T.OrthographicCamera(-.27,.27,.27,-.27,.1,10);camera.position.set(1.7,2.69,1.1);camera.lookAt(0,2.66,0);let portrait=null,lastLook=undefined,lastHP="",renders=0;
 function clearPortrait(){if(!portrait)return;scene.remove(portrait);const skeletons=new Set();portrait.traverse(o=>{if(o.skeleton)skeletons.add(o.skeleton)});for(const sk of skeletons)sk.dispose();portrait=null;}
 // Re-render when the look changes, and once more after skin and hair textures arrive.
 function head(look){if(lastLook===look)return;lastLook=look;clearPortrait();portrait=cloneSpeaker(model,T);portrait.position.set(0,0,0);portrait.rotation.set(0,0,0);scene.add(portrait);portrait.traverse(o=>{if(o.userData.outfitSlot==='arms'||/hand-socket$/.test(o.name))o.visible=false});frame();render();const shown=portrait;void texturesSettled().then(()=>{if(portrait===shown)render()})}
 // Frame the clone's own head bone: stances such as the armed idle crouch.
 function frame(){portrait.updateMatrixWorld(true);const bone=portrait.getObjectByName('Head'),focus=bone?bone.getWorldPosition(new T.Vector3()).add(new T.Vector3(0,.13,0)):new T.Vector3(0,2.66,0);camera.position.copy(focus).add(new T.Vector3(.75,.12,1.85));camera.lookAt(focus);camera.updateMatrixWorld()}
 const pixels=new Uint8Array(N*N*4),row=N*4;
 function render(){const previous=renderer.getRenderTarget();try{renderer.setRenderTarget(target);renderer.render(scene,camera);renderer.readRenderTargetPixels(target,0,0,N,N,pixels);const image=ctx.createImageData(N,N);for(let y=0;y<N;y++)image.data.set(pixels.subarray((N-1-y)*row,(N-y)*row),y*row);ctx.putImageData(image,0,0);renders++}finally{renderer.setRenderTarget(previous)}}
 function health(hp,max){const text=Math.ceil(hp)+' / '+max;if(text===lastHP)return;lastHP=text;host.querySelector('#hud-health').textContent=text;host.querySelector('.health-track').setAttribute('aria-valuenow',String(Math.round(hp/max*100)));host.querySelector('#health-fill').style.width=Math.max(0,Math.min(100,hp/max*100))+'%'}
 // Streamed outfit parts (e.g. a helm) can arrive after the portrait was cloned.
 let rebuildQueued=false;
 function partLoaded(e){let o=e.detail?.mesh;while(o&&o!==model)o=o.parent;if(!o||!portrait||rebuildQueued)return;rebuildQueued=true;requestAnimationFrame(()=>{rebuildQueued=false;const look=lastLook;lastLook=NaN;head(look)})}
 addEventListener('eldervale-outfit-part',partLoaded);
 return {health,get renders(){return renders},update({combatLevel:rank=1,hp,maxHp,xp,kills,gold,helmet,look=helmet??null,weapon}){health(hp,maxHp);head(look);const level=rank,percent=Math.max(0,Math.min(100,level/126*100));put(host.querySelector('#hud-name'),'textContent',document.querySelector('#account-name')?.textContent||'Adventurer');put(host.querySelector('#hud-info'),'textContent','Combat '+level+' · '+Math.floor(xp).toLocaleString()+' XP');put(host,'title','Combat level '+level+' / 126 · '+Math.floor(xp).toLocaleString()+' total XP · '+kills+' defeated · '+gold+' gold');put(host.querySelector('#hud-xp-fill').style,'width',percent+'%');host.querySelector('.xp-track').setAttribute('aria-valuenow',String(Math.round(percent)));host.querySelector('#special-attack').disabled=true;put(host.querySelector('#special-attack'),'title',(weapon?.name||'This weapon')+' has no special attack');},dispose(){removeEventListener('eldervale-outfit-part',partLoaded);clearPortrait();target.dispose();scene.clear()}};
}
