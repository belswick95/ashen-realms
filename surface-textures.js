// Small, original, seamless material maps shared across the town. No remote assets.
const caches=new WeakMap();
export function surfaceTexture(T,kind,color){
 if(typeof document==='undefined')return null;
 let cache=caches.get(T);if(!cache){cache=new Map();caches.set(T,cache)}const key=kind+':'+color;if(cache.has(key))return cache.get(key);
 const canvas=document.createElement('canvas');canvas.width=canvas.height=256;const c=canvas.getContext('2d'),base=new T.Color(color);let seed=(color^0x98af731)>>>0;const rnd=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296};
 const paint=(delta=0)=>{const v=base.clone().offsetHSL(0,0,delta);return '#'+v.getHexString(T.SRGBColorSpace)};
 c.fillStyle=paint();c.fillRect(0,0,256,256);
 if(kind==='masonry'||kind==='roof'||kind==='floor'){
  const masonry=kind==='masonry',floor=kind==='floor',h=floor?32:masonry?43:32,w=floor?128:masonry?86:48;
  c.fillStyle=paint(-.17);c.fillRect(0,0,256,256);
  for(let row=-1;row<9;row++)for(let col=-1;col<7;col++){
   const x=col*w+(row%2)*w/2,y=row*h;c.fillStyle=paint((rnd()-.5)*(masonry||floor?.13:.07));c.fillRect(x+2,y+2,w-4,h-4);
   c.fillStyle=paint(.09);c.fillRect(x+3,y+2,w-6,2);c.fillStyle=paint(-.12);c.fillRect(x+3,y+h-4,w-6,2);
   if(masonry){c.strokeStyle=paint(-.07);c.lineWidth=1;c.beginPath();c.moveTo(x+w*.68,y+2);c.lineTo(x+w*.61,y+h*.35);c.lineTo(x+w*.65,y+h*.52);c.stroke()}
  }
 }else if(kind==='wood'){
  for(let x=0;x<256;x+=32){c.fillStyle=paint((rnd()-.5)*.10);c.fillRect(x,0,32,256);c.fillStyle=paint(-.20);c.fillRect(x,0,2,256);c.fillStyle=paint(.10);c.fillRect(x+2,0,1,256);
   for(let i=0;i<28;i++){const px=x+4+rnd()*25,y=rnd()*256;c.strokeStyle=paint((rnd()-.5)*.18);c.lineWidth=.4+rnd()*.9;c.beginPath();c.moveTo(px,y-70);c.bezierCurveTo(px-3,y-12,px+4,y+17,px,y+85);c.stroke()}
   // An occasional small, soft knot rather than a ring on every board.
   if(rnd()<.35){const y=rnd()*220+18;c.strokeStyle=paint(-.08);c.lineWidth=.8;c.beginPath();c.ellipse(x+16,y,2,5,0,0,Math.PI*2);c.stroke()}
  }
 }else if(kind==='cobble'){
  // Rounded setts in jittered rows over dark grout, wrapped at the edges.
  c.fillStyle=paint(-.16);c.fillRect(0,0,256,256);
  for(let row=0;row<10;row++)for(let col=0;col<10;col++){const x=col*25.6+(row%2)*12.8+(rnd()-.5)*5,y=row*25.6+(rnd()-.5)*5,rx=11.5+rnd()*2,ry=10.5+rnd()*2.5,a=(rnd()-.5)*.6,shade=(rnd()-.5)*.12-.02;
   for(const ox of [-256,0,256])for(const oy of [-256,0,256]){c.fillStyle=paint(shade-.06);c.beginPath();c.ellipse(x+ox+1,y+oy+1.5,rx,ry,a,0,7);c.fill();c.fillStyle=paint(shade);c.beginPath();c.ellipse(x+ox,y+oy,rx-1,ry-1.2,a,0,7);c.fill();c.fillStyle=paint(shade+.05);c.beginPath();c.ellipse(x+ox-2.5,y+oy-2.5,rx*.5,ry*.4,a,0,7);c.fill()}}
 }else if(kind==='plaster'){
  // Soft, even limewash: broad gentle mottling and faint trowel strokes only.
  for(let i=0;i<70;i++){c.fillStyle=paint((rnd()-.5)*.045);c.beginPath();c.ellipse(rnd()*256,rnd()*256,8+rnd()*30,6+rnd()*18,rnd()*6,0,7);c.fill()}
  for(let i=0;i<24;i++){c.strokeStyle=paint((rnd()-.5)*.03);c.lineWidth=2+rnd()*4;c.beginPath();const x=rnd()*256,y=rnd()*256;c.arc(x,y,10+rnd()*20,rnd()*6,rnd()*6+1);c.stroke()}
 }else if(kind==='thatch'){
  // Straw combed down the slope (u runs along the ridge after ridgeAlignedUV),
  // with a soft shadow line at each layer.
  c.fillStyle=paint(-.1);c.fillRect(0,0,256,256);for(let i=0;i<1400;i++){const x=rnd()*256,y=rnd()*256,l=12+rnd()*26;c.strokeStyle=paint((rnd()-.5)*.34);c.lineWidth=1+rnd()*1.6;c.beginPath();c.moveTo(x,y);c.lineTo(x+(rnd()-.5)*3,y+l);c.stroke();if(y+l>256){c.beginPath();c.moveTo(x,y-256);c.lineTo(x,y+l-256);c.stroke()}}
  for(let y=0;y<256;y+=64){const g=c.createLinearGradient(0,y+46,0,y+64);g.addColorStop(0,'rgba(0,0,0,0)');g.addColorStop(1,'rgba(30,20,5,.18)');c.fillStyle=g;c.fillRect(0,y+46,256,18)}
 }else if(kind==='cloth'){
  for(let i=0;i<256;i+=3){c.fillStyle=paint(i%2?.035:-.035);c.fillRect(i,0,1,256);c.fillRect(0,i,256,1)}
 }else if(kind==='metal'){
  for(let i=0;i<320;i++){c.strokeStyle='rgba(20,30,35,'+(.015+rnd()*.025)+')';c.beginPath();const x=rnd()*256,y=rnd()*256;c.moveTo(x,y);c.lineTo(x+2+rnd()*24,y+(rnd()-.5)*2);c.stroke()}
 }
 const pixels=c.getImageData(0,0,256,256);for(let i=0;i<pixels.data.length;i+=4){const noise=(rnd()-.5)*(kind==='metal'?4:kind==='plaster'?6:13);for(let j=0;j<3;j++)pixels.data[i+j]+=noise}c.putImageData(pixels,0,0);
 const texture=new T.CanvasTexture(canvas);texture.wrapS=texture.wrapT=T.RepeatWrapping;texture.colorSpace=T.SRGBColorSpace;texture.anisotropy=4;texture.userData.eldervaleShared=true;texture.userData.baseColor=base.getHex(T.SRGBColorSpace);cache.set(key,texture);return texture;
}
// Each box face uses world-sized repeats, so stone blocks and timber grain retain scale.
export function scaleSurfaceUV(geometry,w,h,d){const uv=geometry.attributes.uv;for(let face=0;face<6;face++){const a=face<2?d:w,b=face<2?h:face<4?d:h;for(let j=0;j<4;j++){const i=face*4+j;uv.setXY(i,uv.getX(i)*a/2,uv.getY(i)*b/2)}}return geometry}
