// Client prediction mirrors the server's collision checks. Never changes speed.
export function slideStep(from,to,canStep){
 if(canStep(from,to))return {...to};
 const x={...from,x:to.x},z={...from,z:to.z};
 const dx=Math.abs(to.x-from.x),dz=Math.abs(to.z-from.z);
 const xFree=dx>1e-6&&canStep(from,x),zFree=dz>1e-6&&canStep(from,z);
 if(xFree&&(!zFree||dx>=dz))return x;
 if(zFree)return z;
 return {...from};
}
// Keep gait active against a wall without moving the gameplay root through it.
export function locomotionDistance(traveled,input,speed,dt){
 return input?.moving?Math.max(traveled,speed*Math.min(1,Math.hypot(input.x,input.z))*dt):traveled;
}
