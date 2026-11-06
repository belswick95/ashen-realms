// Presentation follows the server's current jobs, including jobs already active
// when another player enters the area. It never grants catches, logs, or XP.
export function createGatheringVisuals(T,scene,{getActor,makeAxe,onChop=()=>{},onCast=()=>{},waterHeight=()=>null}){
 const active=new Map();let jobs=[];const scratch={hand:new T.Vector3(),dir:new T.Vector3(),y:new T.Vector3(0,1,0),local:new T.Vector3(),parent:new T.Quaternion(),want:new T.Quaternion()};
 const wood=new T.MeshStandardMaterial({color:0x8e653f,roughness:.9}),lineMat=new T.LineBasicMaterial({color:0xd6ddd2,transparent:true,opacity:.8});
 function tool(method){const g=new T.Group();g.userData.gatheringTool=true;if(method==='woodcut'){g.add(makeAxe());g.rotation.x=1.3;return g;}
 // The small net has a longer pole so it reaches the water from the bank.
 const handle=new T.Mesh(new T.CylinderGeometry(.025,.038,method==='rod'?2.25:method==='net'?1.75:1.15,8),wood);handle.position.y=method==='rod'?1.0:method==='net'?.76:.48;g.add(handle);
 if(method==='harpoon'){const metal=new T.MeshStandardMaterial({color:0xb7c2c7,metalness:.6,roughness:.4});const head=new T.Mesh(new T.ConeGeometry(.05,.24,4),metal);head.position.y=1.2;g.add(head);for(const s of [-1,1]){const barb=new T.Mesh(new T.BoxGeometry(.012,.12,.012),metal);barb.position.set(s*.045,1.06,0);barb.rotation.z=-s*.6;g.add(barb)}g.rotation.x=1.05;return g;}
 if(method==='cage'){handle.visible=false;const pot=new T.Mesh(new T.SphereGeometry(.26,10,6,0,Math.PI*2,0,Math.PI/2),new T.MeshStandardMaterial({color:0xa98457,wireframe:true}));pot.position.set(0,.05,.25);pot.rotation.x=Math.PI;g.add(pot);g.rotation.x=.4;return g;}
 if(method==='net'){const ring=new T.Mesh(new T.TorusGeometry(.32,.024,6,18),wood);ring.position.y=1.62;g.add(ring);g.userData.ringY=1.62;const bag=new T.Mesh(new T.ConeGeometry(.30,.55,12,5,true),new T.MeshStandardMaterial({color:0xc8d3bc,wireframe:true,transparent:true,opacity:.65}));bag.rotation.z=Math.PI;bag.position.set(0,1.38,.12);g.add(bag);}else{const tip=new T.Mesh(new T.SphereGeometry(.025,6,5),wood);tip.position.y=2.15;g.add(tip);g.userData.tip=tip;}g.rotation.x=1.05;return g;}
 function remove(id){const a=active.get(id);if(!a)return;a.actor?.rig?.setActivity?.(null);if(a.actor?.rig?.netDip?.tool===a.tool)a.actor.rig.netDip=null;a.splash?.removeFromParent();a.splash?.geometry.dispose();a.splash?.material.dispose();a.tool.removeFromParent();a.line?.removeFromParent();a.bob?.removeFromParent();for(const m of a.hidden)m.visible=true;a.tool.traverse(o=>{if(o.geometry&&!o.geometry.userData?.eldervaleShared)o.geometry.dispose();if(o.material&&o.material!==wood&&!o.material.userData?.eldervaleShared)o.material.dispose()});a.line?.geometry.dispose();a.bob?.geometry.dispose();a.bob?.material.dispose();active.delete(id);}
 function sync(rows){jobs=Array.isArray(rows)?rows:[];const ids=new Set(jobs.map(j=>j.player));for(const id of active.keys())if(!ids.has(id))remove(id);}
 function update(now){for(const job of jobs){const actor=getActor(job.player);if(!actor?.rig)continue;let a=active.get(job.player);if(a&&(a.method!==job.method||a.actor.rig!==actor.rig)){remove(job.player);a=null}if(!a){const hidden=[...actor.rig.rightHand.children,...actor.rig.leftHand.children].filter(o=>o.isGroup&&o.visible);for(const o of hidden)o.visible=false;const model=tool(job.method);actor.rig.rightHand.add(model);a={actor,tool:model,method:job.method,hidden};if(job.method==='rod'){const geo=new T.BufferGeometry().setFromPoints([new T.Vector3(),new T.Vector3()]);a.line=new T.Line(geo,lineMat);scene.add(a.line);a.bob=new T.Mesh(new T.SphereGeometry(.055,7,5),new T.MeshStandardMaterial({color:0xb34d3d}));scene.add(a.bob);}active.set(job.player,a);}
 const r=actor.rig,t=(now-Date.parse(job.startedAt))*.001,period=job.method==='woodcut'?3:job.method==='net'?4.5:job.method==='cage'?5:job.method==='harpoon'?5.4:4,u=((t%period)+period)%period/period,swing=Math.sin(u*Math.PI*2),cut=Math.pow(Math.max(0,Math.sin(u*Math.PI)),3);
 if(job.method==='woodcut'){const beat=Math.floor(t/period-.5);if(a.cutBeat!==undefined&&beat>a.cutBeat)onChop(actor.root);a.cutBeat=beat;}
 // Fishing: the net/pot/harpoon/line meets the water 35% into each cast cycle.
 else{const beat=Math.floor(t/period-.35);if(a.castBeat!==undefined&&beat>a.castBeat){onCast(actor.root,job);if(a.splash){a.splash.position.copy(a.dip?.ring||a.splash.position);a.splash.position.y=(a.dip?.water.y??a.splash.position.y)+.02;a.splashAge=0}}a.castBeat=beat;
  // Face the water while fishing (the server keeps the angler still).
  if(Number.isFinite(job.x)&&Number.isFinite(job.z)){const dx=job.x-actor.root.position.x,dz=job.z-actor.root.position.z;if(dx*dx+dz*dz>.01)actor.root.rotation.y=Math.atan2(dx,dz)}}
 // Woodcutting: the looping swing lands its impact (30% through the clip) on each chop beat.
 r.setActivity?.(job.method==='woodcut'?'woodcut':job.method==='net'?'net':'fish',job.method==='woodcut'?u-.5+.3:null);
 // Small net: the animator leans the angler over the bank and dips the net at
 // the spot's water line (animation.js netDipPhase); the ring of splash marks the dip.
 if(job.method==='net'){if(!a.dip){const raw=waterHeight(job),wy=raw==null?NaN:Number(raw);a.dip={u:0,water:new T.Vector3(job.x,Number.isFinite(wy)?wy:.06,job.z),tool:a.tool,ring:new T.Vector3(job.x,.06,job.z),pole:1.62};
   const ring=new T.Mesh(new T.RingGeometry(.12,.17,24),new T.MeshBasicMaterial({color:0xe6f2ec,transparent:true,opacity:0,depthWrite:false,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.renderOrder=2;scene.add(ring);a.splash=ring;a.splashAge=9}
  a.dip.u=u;r.netDip=a.dip;
  if(a.splash){a.splashAge+=Math.max(0,Math.min(.1,(now-(a.lastNow??now))*.001));const p=a.splashAge/.8;a.splash.visible=p<1;if(p<1){a.splash.scale.setScalar(1+p*4);a.splash.material.opacity=.55*(1-p)}}a.lastNow=now}
 // Rod and harpoon point out over the water from the hand (the hold clip alone
 // leaves them upright beside the body once the angler faces the spot): the rod
 // rises at about 30 degrees toward the bob, the harpoon aims down at the spot
 // and thrusts at the cast beat.
 if((job.method==='rod'||job.method==='harpoon')&&a.tool.parent&&Number.isFinite(job.x)){const hand=a.tool.parent.getWorldPosition(scratch.hand),dir=scratch.dir.set(job.x-hand.x,0,job.z-hand.z);const flat=dir.length()||1;dir.multiplyScalar(1/flat);
  if(job.method==='rod')dir.y=.58;else{const wy=Number(waterHeight(job));dir.multiplyScalar(Math.min(flat,1.6));dir.y=(Number.isFinite(wy)?wy:.06)+.1-hand.y}
  dir.normalize();a.tool.parent.getWorldQuaternion(scratch.parent);scratch.want.setFromUnitVectors(scratch.y,dir);a.tool.quaternion.copy(scratch.parent.invert().multiply(scratch.want));
  if(job.method==='harpoon'){const jab=Math.max(0,Math.sin((u-.25)/.2*Math.PI))*(u>.25&&u<.45?1:0);a.tool.position.set(0,0,0).addScaledVector(scratch.local.set(0,1,0).applyQuaternion(a.tool.quaternion),.35*jab)}}
 if(a.line){actor.root.updateMatrixWorld(true);const p=a.tool.userData.tip.getWorldPosition(new T.Vector3()),end=new T.Vector3(job.x,.10+Math.sin(t*2.5)*.015,job.z),v=a.line.geometry.attributes.position;v.setXYZ(0,p.x,p.y,p.z);v.setXYZ(1,end.x,end.y,end.z);v.needsUpdate=true;a.line.geometry.computeBoundingSphere();a.bob.position.copy(end);}
 }}
 return {sync,update,clear(){for(const id of active.keys())remove(id);jobs=[]},get size(){return active.size}};
}
export function fishingRipple(T,parent){const g=new T.Group();const rings=[];for(let i=0;i<3;i++){const mat=new T.MeshBasicMaterial({color:0xc5e0d5,transparent:true,opacity:.30,depthWrite:false,side:T.DoubleSide});const ring=new T.Mesh(new T.RingGeometry(.72,.75,40),mat);ring.rotation.x=-Math.PI/2;ring.position.y=.008+i*.001;g.add(ring);rings.push(ring);}parent.add(g);parent.userData.animateWater=time=>{rings.forEach((m,i)=>{const p=(time*.22+i/3)%1;m.scale.setScalar(.45+p*.9);m.material.opacity=.32*(1-p);m.rotation.z=Math.sin(time*.8+i)*.05})};parent.userData.fishingRipple=true;return g;}
