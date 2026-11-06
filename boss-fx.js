// Boss fights on the client (server: db/bosses-*.sql). Everything here is a tell or a read-out:
//  * telegraphs: marked tiles (one pooled InstancedMesh, colour per attack) that brighten as the
//    impact tick approaches, then flash on impact; charge-ups glow on the boss;
//  * prayer tells: a projectile in the attack's colour (magic blue, ranged bone, venom violet…);
//  * flight: the boss lifts off and its landing tiles are marked; breath: a cone of embers/frost;
//  * arena ring, the boss bar (HP with phase pips, phase name, enrage, fight timer), kill results
//    (KC, time, personal best), a short defeat cutscene (light pillar, title) and a loot chest,
//    and the server-wide rare-drop banner.
// Cheap on phones: shared geometries/materials, fixed pools, no allocation per frame, DOM updated
// at 10 Hz. createBossFx() returns {event(e,selfId), frame(dt)}; game.js calls both.
import {TILE,formatTicks} from './bosses.js?v=release-20261106-pond116';
import {tickUniqueLook} from './unique-look.js?v=release-20261106-pond116';

const MAX_TILES=320,TICK=.6;
export const BOSS_EVENTS=new Set(['boss_start','boss_attack','boss_telegraph','boss_impact','boss_phase','boss_enrage','boss_summon','boss_flight','boss_breath','boss_reset','boss_defeated','boss_chest','boss_rare']);
// Telegraph brightness for a marker: ramps up to the impact, flashes, then fades (pure, tested).
export function markerLevel(now,start,impact){if(now<start)return 0;if(now<impact)return .35+.65*Math.min(1,(now-start)/Math.max(.05,impact-start));const k=(now-impact)/.35;return k>=1?0:1.6*(1-k)}
// Boss bar text for the HUD (pure, tested).
export function bossBarState({hp,maxHp,phases=[],phase=0,name='',startedAt=0,now=0,enraged=false}={}){
 const pct=maxHp>0?Math.max(0,Math.min(100,hp*100/maxHp)):0;
 return {pct,label:name,phase:phases[phase]?.name||'',pips:phases.slice(1).map(p=>p.at),enraged,time:formatTicks(Math.max(0,(now-startedAt)/1000/TICK))};
}
export function createBossFx({T,scene,getActor=()=>null,player=()=>null,say=()=>{},sound=()=>null,heightAt=()=>0,canWalk=()=>true,itemName=id=>id,doc=globalThis.document}={}){
 if(!T||!scene)return {event(){return false},frame(){},state:()=>({})};
 const group=new T.Group();group.name='boss-fx';scene.add(group);
 // ---- telegraph tiles: one instanced quad mesh.
 const quad=new T.PlaneGeometry(TILE*.92,TILE*.92);quad.rotateX(-Math.PI/2);
 const tileMat=new T.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.55,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false});
 const tiles=new T.InstancedMesh(quad,tileMat,MAX_TILES);tiles.count=0;tiles.frustumCulled=false;tiles.name='boss-telegraphs';tiles.renderOrder=2;
 tiles.instanceColor=new T.InstancedBufferAttribute(new Float32Array(MAX_TILES*3),3);group.add(tiles);
 const marks=[];const m4=new T.Matrix4(),col=new T.Color(),tmp=new T.Vector3();
 // ---- shared glow pieces.
 const sphere=new T.IcosahedronGeometry(1,1),glowMats=new Map();
 const glowMat=c=>{if(!glowMats.has(c))glowMats.set(c,new T.MeshBasicMaterial({color:c,transparent:true,opacity:.5,blending:T.AdditiveBlending,depthWrite:false,toneMapped:false}));return glowMats.get(c)};
 const charges=[];const projectiles=[];for(let k=0;k<8;k++){const m=new T.Mesh(sphere,glowMat(0xffffff));m.scale.setScalar(.22);m.visible=false;group.add(m);projectiles.push({mesh:m,t:0,dur:0,from:new T.Vector3(),to:null})}
 const ringGeo=new T.RingGeometry(.97,1,64);ringGeo.rotateX(-Math.PI/2);
 const ring=new T.Mesh(ringGeo,new T.MeshBasicMaterial({color:0xffb46a,transparent:true,opacity:.35,blending:T.AdditiveBlending,depthWrite:false,side:T.DoubleSide}));ring.visible=false;group.add(ring);
 const pillar=new T.Mesh(new T.CylinderGeometry(.9,1.6,26,16,1,true),glowMat(0xfff1c0));pillar.visible=false;group.add(pillar);
 // Breath: 24 points flowing from the mouth to the target.
 const breathGeo=new T.BufferGeometry(),breathPos=new Float32Array(72);breathGeo.setAttribute('position',new T.BufferAttribute(breathPos,3));
 const breathMat=new T.PointsMaterial({color:0xff6a1a,size:.55,transparent:true,opacity:.85,blending:T.AdditiveBlending,depthWrite:false});
 const breath=new T.Points(breathGeo,breathMat);breath.frustumCulled=false;breath.visible=false;group.add(breath);let breathFx=null;
 // Loot chest (built once, re-used).
 const chest=new T.Group();chest.visible=false;group.add(chest);
 {const wood=new T.MeshStandardMaterial({color:0x6b4426,roughness:.8}),gold=new T.MeshStandardMaterial({color:0xd8b25a,metalness:.8,roughness:.35,emissive:0x5a3a08,emissiveIntensity:.4});
  const base=new T.Mesh(new T.BoxGeometry(1.3,.7,.85),wood);base.position.y=.35;chest.add(base);
  const band=new T.Mesh(new T.BoxGeometry(1.34,.12,.89),gold);band.position.y=.62;chest.add(band);
  const lid=new T.Group();lid.position.set(0,.7,-.42);const top=new T.Mesh(new T.BoxGeometry(1.3,.3,.85),wood);top.position.set(0,.15,.42);lid.add(top);const trim=new T.Mesh(new T.BoxGeometry(1.34,.06,.89),gold);trim.position.set(0,.3,.42);lid.add(trim);chest.add(lid);chest.userData.lid=lid;
  const glow=new T.Mesh(sphere,glowMat(0xffd27a));glow.scale.set(.5,.25,.35);glow.position.y=.75;chest.add(glow)}
 let chestT=-1,pillarT=-1;
 // ---- DOM: boss bar, results, banners.
 let bar=null,ui=null;
 function dom(){if(ui||!doc?.createElement)return ui;const style=doc.createElement('style');style.textContent=`
#boss-bar{position:fixed;top:44px;left:50%;transform:translateX(-50%);z-index:180;width:min(440px,calc(100vw - 32px));font:600 13px/1.3 Georgia,serif;color:#f6e7c4;text-shadow:0 1px 2px #000;pointer-events:none}
#boss-bar .bb-head{display:flex;justify-content:space-between;gap:8px}#boss-bar .bb-track{position:relative;height:14px;margin-top:4px;background:#2a0f0c;border:1px solid #c5a366;border-radius:3px;overflow:hidden}
#boss-bar .bb-fill{position:absolute;inset:0;background:linear-gradient(#d6402c,#8f1f12);transform-origin:left;transition:transform .25s}#boss-bar .bb-pip{position:absolute;top:0;bottom:0;width:2px;background:#f6e7c4cc}
#boss-bar .bb-sub{display:flex;justify-content:space-between;font-size:12px;opacity:.9;margin-top:2px}#boss-bar.enraged .bb-fill{background:linear-gradient(#ff7a1a,#b02a00)}#boss-bar .bb-rage{color:#ff9a4a;display:none}#boss-bar.enraged .bb-rage{display:inline}
#boss-title{position:fixed;top:28%;left:50%;transform:translateX(-50%);z-index:185;text-align:center;font:700 clamp(18px,4.5vw,34px)/1.2 Georgia,serif;color:#f8e3a8;letter-spacing:.08em;text-shadow:0 2px 12px #000;pointer-events:none;opacity:0;transition:opacity .6s;max-width:calc(100vw - 32px)}
#boss-title small{display:block;font-size:.5em;letter-spacing:.02em;color:#f6e7c4;margin-top:6px}
#boss-rare{position:fixed;top:86px;left:50%;transform:translateX(-50%);z-index:186;max-width:min(560px,calc(100vw - 32px));padding:9px 16px;background:#2a1a06ee;border:1px solid #ffd27a;border-radius:8px;color:#ffe9b0;font:14px/1.4 Georgia,serif;text-align:center;pointer-events:none;display:none}`;
  doc.head?.append(style);
  bar=doc.createElement('div');bar.id='boss-bar';bar.hidden=true;bar.setAttribute('aria-live','polite');bar.innerHTML='<div class="bb-head"><span class="bb-name"></span><span class="bb-pct"></span></div><div class="bb-track"><div class="bb-fill"></div></div><div class="bb-sub"><span class="bb-phase"></span><span><span class="bb-rage">Enraged · </span><span class="bb-time"></span></span></div>';
  const title=doc.createElement('div');title.id='boss-title';const rare=doc.createElement('div');rare.id='boss-rare';rare.setAttribute('aria-live','polite');
  doc.body?.append(bar,title,rare);ui={bar,title,rare,fill:bar.querySelector('.bb-fill'),name:bar.querySelector('.bb-name'),pct:bar.querySelector('.bb-pct'),phase:bar.querySelector('.bb-phase'),time:bar.querySelector('.bb-time'),track:bar.querySelector('.bb-track')};return ui}
 // ---- fight state (the nearest boss the player is fighting).
 let fight=null,now=0,lastUi=0,titleT=-1,rareT=-1;const lifts=new Map();
 const near=(id,r=45)=>{const a=getActor(id),p=player();if(!a?.root||!p)return null;return a.root.position.distanceTo(p.position)<r?a:null};
 const sfx=(name,at,gain=.8)=>{const fx=sound();if(!fx)return;const where=at?{x:at.x,z:at.z}:null;if(['whoosh','hit','block'].includes(name))fx.proc?.(name,{at:where,gain});else fx.sample?.(name,{at:where,gain,far:60})};
 const SOUND={rumble:'thunderRoll',slam:'rockBreak',frost:'ripple',web:'ripple',swipe:'whoosh',charge:'thunderRoll',breath:'crackle'};
 function addMarks(list,color,ticks,source){const start=now,impact=now+Math.max(.3,ticks*TICK);for(const [i,j] of list||[])if(canWalk(i*TILE,j*TILE))marks.push({i,j,color,start,impact,source});if(marks.length>MAX_TILES)marks.splice(0,marks.length-MAX_TILES)}
 function showTitle(html,secs=3.5){const u=dom();if(!u)return;u.title.innerHTML=html;u.title.style.opacity='1';titleT=now+secs}
 function drawBar(){if(!fight)return;const u=dom();if(!u)return;const a=getActor(fight.id),hp=a?.serverPose?.hp??fight.hp,maxHp=a?.serverPose?.data?.hp||fight.maxHp;
  const s=bossBarState({hp,maxHp,phases:fight.phases,phase:fight.phase,name:fight.name,startedAt:fight.startedAt,now:performance.now(),enraged:fight.enraged});
  if(!u._pips||u._pips!==fight.id){u.track.querySelectorAll('.bb-pip').forEach(p=>p.remove());for(const at of s.pips){const p=doc.createElement('i');p.className='bb-pip';p.style.left=at+'%';u.track.append(p)}u._pips=fight.id}
  u.bar.hidden=false;u.name.textContent=s.label;u.pct.textContent=Math.ceil(s.pct)+'%';u.fill.style.transform=`scaleX(${s.pct/100})`;u.phase.textContent=s.phase;u.time.textContent=s.time;u.bar.classList.toggle('enraged',s.enraged)}
 function endFight(id){if(fight&&(!id||fight.id===id)){fight=null;ring.visible=false;if(ui)ui.bar.hidden=true}for(const c of charges)if(!id||c.id===id)c.t=-1}
 function charge(id,color,secs){const a=getActor(id);if(!a?.root)return;let c=charges.find(x=>x.t<0);if(!c){if(charges.length>=4)return;c={mesh:new T.Mesh(sphere,glowMat(color)),t:-1};group.add(c.mesh);charges.push(c)}
  c.mesh.material=glowMat(color);c.id=id;c.t=0;c.dur=Math.max(.3,secs);c.mesh.visible=true}
 function shoot(fromId,color,secs){const a=getActor(fromId),p=player();if(!a?.root||!p)return;const pr=projectiles.find(x=>!x.mesh.visible);if(!pr)return;
  pr.mesh.material=glowMat(color);pr.from.copy(a.root.position);pr.from.y+=2.2*(a.config?.scale||1);pr.to=p;pr.t=0;pr.dur=Math.max(.25,secs);pr.mesh.visible=true}
 const api={
  state:()=>({fight,marks:marks.length,lifts:[...lifts.keys()]}),
  event(e,selfId){
   if(!BOSS_EVENTS.has(e?.type))return false;
   const mine=e.player===selfId,a=e.target&&near(e.target);
   switch(e.type){
    case 'boss_start':if(!a)break;fight={id:e.target,name:e.name,hp:e.hp,maxHp:e.maxHp,phases:e.phases||[],phase:0,startedAt:performance.now(),enraged:false};
     if(e.arena){ring.position.set(Number(e.arena.x)||0,heightAt(e.arena.x,e.arena.z)+.05,Number(e.arena.z)||0);ring.scale.setScalar((e.arena.radius||10)*TILE);ring.visible=true}
     drawBar();sfx('thunderCrack',a.root.position,.5);break;
    case 'boss_attack':if(!a)break;if(mine&&e.style!=='melee')shoot(e.target,Number(e.color)||0xffffff,e.style==='magic'?1.2:.9);if(e.text&&mine)say(e.text);break;
    case 'boss_telegraph':if(!a)break;addMarks(e.tiles,Number(e.color)||0xff6a1a,e.ticks||2,e.target);if(e.charge||e.breath)charge(e.target,Number(e.color)||0xff6a1a,(e.ticks||1)*TICK);
     if(e.text)say(e.text);sfx(SOUND[e.sound]||'thunderRoll',a.root.position,.55);break;
    case 'boss_impact':if(!a)break;for(const m of marks)if(m.source===e.target&&m.impact>now)m.impact=now;sfx(e.breath?'crackle':'rockBreak',a.root.position,.8);break;
    case 'boss_breath':{if(!a)break;const p=e.player===selfId?player():null;breathFx={from:a,to:p||a.root,t:0,dur:.7};breathMat.color.setHex(Number(e.color)||0xff6a1a);breath.visible=true;sfx(e.element==='frost'?'ripple':'crackle',a.root.position,.8);break}
    case 'boss_phase':if(!a)break;if(fight?.id===e.target){fight.phase=e.phase;drawBar()}showTitle((e.name||'Phase '+(e.phase+1))+(e.text?'<small>'+e.text+'</small>':''),2.6);sfx('thunderCrack',a.root.position,.6);break;
    case 'boss_enrage':if(!a)break;if(fight?.id===e.target){fight.enraged=true;drawBar()}if(e.text)say(e.text);break;
    case 'boss_summon':if(a&&e.text)say(e.text);break;
    case 'boss_flight':if(!a)break;lifts.set(e.target,{target:e.up?5.5:0,y:lifts.get(e.target)?.y||0});if(e.text)say(e.text);sfx(e.up?'whoosh':'rockBreak',a.root.position,.9);break;
    case 'boss_reset':endFight(e.target);lifts.delete(e.target);break;
    case 'boss_defeated':if(mine){say(`${e.name} defeated. Kill count: ${e.kc}.`+(e.ticks?` Time ${formatTicks(e.ticks)}`+(e.newPb?' (new personal best!)':` · best ${formatTicks(e.pb)}`):''));}break;
    case 'boss_chest':{endFight(e.target);lifts.delete(e.target);const x=Number(e.x),z=Number(e.z);if(!Number.isFinite(x)||!near(e.target,60))break;
     pillar.position.set(x,heightAt(x,z)+13,z);pillar.visible=true;pillarT=now;showTitle(String(e.name||'').toUpperCase()+'<small>Defeated'+(e.ticks?' · '+formatTicks(e.ticks):'')+'</small>',4);
     chest.position.set(x+1.6,heightAt(x+1.6,z),z);chest.visible=true;chestT=now;chest.userData.lid.rotation.x=0;sfx('thunderCrack',{x,z},.7);
     if(e.player===selfId&&Array.isArray(e.loot)&&e.loot.length)say('Loot: '+e.loot.map(l=>(l.n>1?l.n+' × ':'')+itemName(l.item)).join(', ')+'.');break}
    case 'boss_rare':{const u=dom();const text=`${e.who} received ${e.itemName} from ${e.bossName}`+(e.kc?` (kill ${e.kc})`:'')+'!';say(text);if(u){u.rare.textContent=text;u.rare.style.display='block';rareT=now+7}break}
   }
   return true;
  },
  frame(dt){
   now+=dt;tickUniqueLook(now);
   // Telegraph tiles.
   let n=0;for(let k=marks.length-1;k>=0;k--){const m=marks[k],lv=markerLevel(now,m.start,m.impact);if(lv<=0&&now>m.impact){marks.splice(k,1);continue}
    if(n>=MAX_TILES)continue;const x=m.i*TILE,z=m.j*TILE;m4.makeTranslation(x,heightAt(x,z)+.06,z);tiles.setMatrixAt(n,m4);col.setHex(m.color).multiplyScalar(lv*(.85+.15*Math.sin(now*12)));tiles.setColorAt(n,col);n++}
   tiles.count=n;if(n){tiles.instanceMatrix.needsUpdate=true;tiles.instanceColor.needsUpdate=true}
   // Charge-ups follow their boss and swell.
   for(const c of charges){if(c.t<0){c.mesh.visible=false;continue}c.t+=dt;const a=getActor(c.id);if(!a?.root||c.t>c.dur+.2){c.t=-1;c.mesh.visible=false;continue}
    const s=(a.config?.scale||1.5),k=Math.min(1,c.t/c.dur);c.mesh.position.copy(a.root.position);c.mesh.position.y+=2.4*s;c.mesh.scale.setScalar(.3+k*.9*s*(1+.08*Math.sin(now*20)));c.mesh.material.opacity=.25+.45*k}
   // Prayer-tell projectiles.
   for(const p of projectiles){if(!p.mesh.visible)continue;p.t+=dt;const k=Math.min(1,p.t/p.dur);if(!p.to||k>=1){p.mesh.visible=false;continue}tmp.copy(p.to.position);tmp.y+=1.3;p.mesh.position.lerpVectors(p.from,tmp,k)}
   // Breath cone.
   if(breathFx){breathFx.t+=dt;const k=breathFx.t/breathFx.dur;if(k>=1||!breathFx.from.root){breath.visible=false;breathFx=null}else{const f=breathFx.from.root.position,to=breathFx.to.position||breathFx.to,s=breathFx.from.config?.scale||1.5;
    for(let i=0;i<24;i++){const u=((i/24)+breathFx.t*2.2)%1,spread=u*1.2;breathPos[i*3]=f.x+(to.x-f.x)*u+Math.sin(i*7.1+now*9)*spread;breathPos[i*3+1]=f.y+2*s+(to.y+1.2-f.y-2*s)*u+Math.cos(i*3.7+now*7)*spread*.5;breathPos[i*3+2]=f.z+(to.z-f.z)*u+Math.cos(i*5.3+now*8)*spread}
    breathGeo.attributes.position.needsUpdate=true;breathMat.opacity=.85*(1-k*.6)}}
   // Flight: lift the boss model (the server keeps it in place until it lands).
   for(const [id,l] of lifts){const a=getActor(id);l.y+=(l.target-l.y)*Math.min(1,dt*3);
    if(a?.root){const pos=a.root.position;pos.y+=l.set===pos.y?l.y-(l.applied||0):l.y;l.applied=l.y;l.set=pos.y}
    if(l.target===0&&l.y<.02){if(a?.root&&l.set===a.root.position.y)a.root.position.y-=l.applied||0;lifts.delete(id)}}
   // Defeat cutscene-lite and the chest.
   if(pillar.visible){const k=(now-pillarT)/2.6;pillar.material.opacity=.5*Math.max(0,1-k);pillar.scale.x=pillar.scale.z=1+k*.6;if(k>=1)pillar.visible=false}
   if(chest.visible){const k=now-chestT;chest.userData.lid.rotation.x=-Math.min(1.9,Math.max(0,(k-.8)*2.4));chest.scale.setScalar(Math.min(1,k*3));if(k>25)chest.visible=false}
   if(ui&&titleT>0&&now>titleT){ui.title.style.opacity='0';titleT=-1}
   if(ui&&rareT>0&&now>rareT){ui.rare.style.display='none';rareT=-1}
   if(fight&&now-lastUi>.1){lastUi=now;const a=getActor(fight.id),p=player();if(!a?.root||(p&&a.root.position.distanceTo(p.position)>60))endFight();else drawBar()}
  }
 };
 return api;
}
