// The flames are advected noise rendered above the photographed braziers, not
// a looping transform of a static picture. All positions follow object-fit:cover.
export function coverPoint(width,height,imageWidth,imageHeight,x,y){const scale=Math.max(width/imageWidth,height/imageHeight);return {x:(width-imageWidth*scale)/2+x*imageWidth*scale,y:(height-imageHeight*scale)/2+y*imageHeight*scale,scale}}
export function createFortressFire(canvas,image){
 const gl=canvas.getContext('webgl',{alpha:true,antialias:false,premultipliedAlpha:true,preserveDrawingBuffer:true,powerPreference:'low-power'});
 const embers=document.createElement('canvas');embers.className='login-embers';embers.style.cssText='position:absolute;inset:0;width:100%;height:100%;pointer-events:none;mix-blend-mode:screen';canvas.after(embers);const ctx=embers.getContext('2d');
 let disposed=false,active=true,frame=0,last=0,width=0,height=0,ratio=1,anchors=[],time=0;const reduced=matchMedia('(prefers-reduced-motion: reduce)');
 const vertex=`attribute vec2 a;uniform vec2 resolution;uniform vec2 origin;uniform vec2 size;varying vec2 uv;void main(){uv=a;vec2 p=origin+vec2((a.x-.5)*size.x,-a.y*size.y);gl_Position=vec4(p/resolution*vec2(2.,-2.)+vec2(-1.,1.),0.,1.);}`;
 const fragment=`precision highp float;varying vec2 uv;uniform float time;uniform float seed;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
 float fbm(vec2 p){float n=0.;float a=.5;for(int i=0;i<4;i++){n+=a*noise(p);p=p*2.07+vec2(5.2,1.3);a*=.5;}return n;}
 void main(){float y=uv.y;float x=(uv.x-.5)*2.;float t=time;float sway=.12*sin(y*5.-t*1.6+seed)+.08*sin(y*11.-t*2.2);x+=sway*y;
 vec2 flow=vec2(x*3.6+seed,y*4.8-t*2.7);float n=fbm(flow+vec2(fbm(flow*.53),0.));float tear=fbm(vec2(x*7.+seed,y*9.-t*4.5));
 float width=.64*pow(max(0.,1.-y),.75);float density=(width-abs(x))+(n-.46)*.65+(.5-tear)*.16;density-=y*y*.19;
 float alpha=smoothstep(-.05,.12,density)*smoothstep(0.,.045,y)*(1.-smoothstep(.83,1.,y));alpha*=clamp(density*5.5,0.,1.);
 float heat=clamp(density*2.7+(1.-y)*.25,0.,1.);vec3 red=vec3(1.,.12,.008);vec3 amber=vec3(1.,.48,.045);vec3 core=vec3(1.,.91,.52);vec3 color=mix(red,amber,smoothstep(.05,.65,heat));color=mix(color,core,smoothstep(.65,1.,heat));
 alpha*=.86+.10*sin(t*7.3+seed);gl_FragColor=vec4(color*alpha,alpha);}`;
 let program,buffer,locations;
 if(gl){
  function shader(type,source){const s=gl.createShader(type);gl.shaderSource(s,source);gl.compileShader(s);if(!gl.getShaderParameter(s,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(s));return s}
  const vs=shader(gl.VERTEX_SHADER,vertex),fs=shader(gl.FRAGMENT_SHADER,fragment);program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);gl.deleteShader(vs);gl.deleteShader(fs);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error(gl.getProgramInfoLog(program));gl.useProgram(program);buffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,new Float32Array([0,0,1,0,0,1,0,1,1,0,1,1]),gl.STATIC_DRAW);const attr=gl.getAttribLocation(program,'a');gl.enableVertexAttribArray(attr);gl.vertexAttribPointer(attr,2,gl.FLOAT,false,0,0);locations=Object.fromEntries(['resolution','origin','size','time','seed'].map(k=>[k,gl.getUniformLocation(program,k)]));gl.enable(gl.BLEND);gl.blendFunc(gl.ONE,gl.ONE_MINUS_SRC_ALPHA);gl.clearColor(0,0,0,0);
 }
 function resize(){width=innerWidth;height=innerHeight;ratio=Math.min(devicePixelRatio||1,1.35);canvas.width=Math.round(width*ratio);canvas.height=Math.round(height*ratio);embers.width=canvas.width;embers.height=canvas.height;const iw=image.naturalWidth||1672,ih=image.naturalHeight||941;anchors=[[.239,.382],[.758,.382]].map(([x,y])=>coverPoint(width,height,iw,ih,x,y));if(gl){gl.viewport(0,0,canvas.width,canvas.height);gl.uniform2f(locations.resolution,width,height)}if(reduced.matches&&active){last=0;cancelAnimationFrame(frame);frame=requestAnimationFrame(render)}}
 function render(now){if(disposed||!active)return;if(!reduced.matches)frame=requestAnimationFrame(render);if(document.hidden||document.querySelector('#auth-screen')?.hidden||(!reduced.matches&&now-last<1000/30))return;const dt=last?Math.min(.08,(now-last)/1000):.033;last=now;time+=dt;const t=reduced.matches?2.4:time;
  if(gl){gl.clear(gl.COLOR_BUFFER_BIT);gl.uniform1f(locations.time,t);anchors.forEach((p,i)=>{gl.uniform2f(locations.origin,p.x,p.y);gl.uniform2f(locations.size,155*p.scale,210*p.scale);gl.uniform1f(locations.seed,i*13.7+1.3);gl.drawArrays(gl.TRIANGLES,0,6)})}
  if(ctx){ctx.setTransform(ratio,0,0,ratio,0,0);ctx.clearRect(0,0,width,height);ctx.globalCompositeOperation='screen';anchors.forEach((p,i)=>{const pulse=.09+.035*Math.sin(t*6.1+i)+.015*Math.sin(t*13.7+i);const glow=ctx.createRadialGradient(p.x,p.y-45*p.scale,0,p.x,p.y-45*p.scale,230*p.scale);glow.addColorStop(0,`rgba(255,122,22,${pulse})`);glow.addColorStop(1,'rgba(240,85,10,0)');ctx.fillStyle=glow;ctx.fillRect(p.x-230*p.scale,p.y-275*p.scale,460*p.scale,460*p.scale);
   if(!reduced.matches)for(let j=0;j<15;j++){const speed=.10+(j%5)*.018,age=(t*speed+j*.137+i*.31)%1;const x=p.x+(Math.sin(j*41.7)*36+Math.sin(t*.8+j)*age*42)*p.scale,y=p.y-age*300*p.scale,r=(.7+(j%3)*.45)*p.scale;ctx.fillStyle=`rgba(255,${150+j%4*20},${45+j%3*18},${Math.sin(age*Math.PI)*.7})`;ctx.beginPath();ctx.ellipse(x,y,r,r*1.8,Math.sin(j)*.5,0,Math.PI*2);ctx.fill()}
   if(!gl){ctx.fillStyle='rgba(255,157,42,.7)';ctx.beginPath();ctx.ellipse(p.x,p.y-40*p.scale,25*p.scale,(48+Math.sin(t*5)*8)*p.scale,0,0,Math.PI*2);ctx.fill()}
  });ctx.globalCompositeOperation='source-over'}
  canvas.dataset.frame=String(Math.floor(time*30));canvas.dataset.motion=reduced.matches?'reduced':'animated';
 }
 const onMotion=()=>{cancelAnimationFrame(frame);last=0;if(active)frame=requestAnimationFrame(render)};reduced.addEventListener('change',onMotion);image.addEventListener('load',resize);addEventListener('resize',resize);resize();frame=requestAnimationFrame(render);
 return {setActive(value){if(disposed||active===value)return;active=value;if(active){last=0;frame=requestAnimationFrame(render)}else cancelAnimationFrame(frame)},dispose(){disposed=true;cancelAnimationFrame(frame);removeEventListener('resize',resize);reduced.removeEventListener('change',onMotion);image.removeEventListener('load',resize);embers.remove();if(gl){gl.deleteBuffer(buffer);gl.deleteProgram(program);gl.getExtension('WEBGL_lose_context')?.loseContext()}}};
}
