// Level-up fireworks around a character: a few rising sparks that burst into
// coloured stars and drift down, plus a short glittering ring at the feet.
// One shared Points mesh per burst; everything is disposed after ~2.6 s.
export function createLevelFireworks(T,scene){
 const bursts=new Set();
 const palette={combat:[0xffd36b,0xff6b4a,0xfff3c4],gathering:[0x9df27a,0xffe26b,0x7fd8ff],artisan:[0xffa04a,0xff6bd0,0xfff1a8],combatLevel:[0xffe28a,0xff4a3a,0x8ac8ff]};
 function burst(root,kind='gathering'){
  if(!root)return;const colors=palette[kind]||palette.gathering,count=150,pos=new Float32Array(count*3),col=new Float32Array(count*3),vel=new Float32Array(count*3),born=new Float32Array(count);
  const origin=new T.Vector3();root.getWorldPosition(origin);
  const shells=[0,1,2].map(i=>({x:Math.cos(i*2.1)*.7,z:Math.sin(i*2.1)*.7,h:3.1+i*.35,t:.28+i*.22,c:new T.Color(colors[i%colors.length])}));
  for(let i=0;i<count;i++){const s=shells[i%3],ring=i>=120,c=ring?new T.Color(0xfff3c4):s.c;col.set([c.r,c.g,c.b],i*3);
   if(ring){const a=(i-120)/30*Math.PI*2;pos.set([origin.x+Math.cos(a)*.5,origin.y+.15,origin.z+Math.sin(a)*.5],i*3);vel.set([Math.cos(a)*1.2,.9,Math.sin(a)*1.2],i*3);born[i]=0}
   else{const u=Math.random()*2-1,a=Math.random()*Math.PI*2,r=Math.sqrt(1-u*u),sp=2.2+Math.random()*1.1;pos.set([origin.x+s.x,origin.y+s.h,origin.z+s.z],i*3);vel.set([r*Math.cos(a)*sp,u*sp,r*Math.sin(a)*sp],i*3);born[i]=s.t}}
  const geo=new T.BufferGeometry();geo.setAttribute('position',new T.BufferAttribute(pos,3));geo.setAttribute('color',new T.BufferAttribute(col,3));
  const mat=new T.PointsMaterial({size:.17,vertexColors:true,transparent:true,opacity:1,depthWrite:false,blending:T.AdditiveBlending});
  const points=new T.Points(geo,mat);points.frustumCulled=false;points.renderOrder=5;scene.add(points);
  const start=[...pos];bursts.add({points,geo,mat,pos,vel,born,start,age:0});
 }
 function update(dt){
  for(const b of [...bursts]){b.age+=Math.min(.1,dt);const p=b.pos;
   for(let i=0;i<b.born.length;i++){const t=b.age-b.born[i];if(t<0){p[i*3+1]=-9999;continue}p[i*3]=b.start[i*3]+b.vel[i*3]*t;p[i*3+1]=b.start[i*3+1]+b.vel[i*3+1]*t-1.6*t*t;p[i*3+2]=b.start[i*3+2]+b.vel[i*3+2]*t}
   b.geo.attributes.position.needsUpdate=true;b.mat.opacity=Math.max(0,1-Math.max(0,b.age-1.3)/1.2);b.mat.size=.17*(1+.4*Math.sin(b.age*30));
   if(b.age>2.6){b.points.removeFromParent();b.geo.dispose();b.mat.dispose();bursts.delete(b)}}
 }
 return {burst,update,get active(){return bursts.size}};
}
