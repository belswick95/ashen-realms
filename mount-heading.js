// Mounted heading: a horse faces where it is actually going.
// Tile walkers report the yaw of their last tile step, and a rider's presented
// position glides on a chord between tick positions (three tiles per tick when
// mounted), so the reported yaw and the real travel direction often differ by up
// to 45° on mixed diagonal/straight paths. Facing that yaw made the horse crab
// sideways. This follows the low-passed velocity instead (per-frame deltas are
// far too noisy), falls back to the given yaw only when the rider stands still,
// and turns at a capped, horse-like rate.
const wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
export function createTravelHeading({turnRate=10,ease=25,smoothing=.05,minSpeed=1.2,teleport=6}={}){
 let yaw=null,vx=0,vz=0,lastX=null,lastZ=null;
 return {
  get yaw(){return yaw},
  get speed(){return Math.hypot(vx,vz)},
  reset(){yaw=null;vx=vz=0;lastX=lastZ=null},
  // x,z: this frame's position; dt: seconds; fallback: yaw to hold while standing.
  update(x,z,dt,fallback=0){
   if(yaw===null||lastX===null||!(dt>0)||Math.hypot(x-lastX,z-lastZ)>teleport){yaw=wrap(fallback);vx=vz=0;lastX=x;lastZ=z;return yaw}
   const k=1-Math.exp(-dt/smoothing);vx+=((x-lastX)/dt-vx)*k;vz+=((z-lastZ)/dt-vz)*k;lastX=x;lastZ=z;
   const target=Math.hypot(vx,vz)>=minSpeed?Math.atan2(vx,vz):fallback;
   const delta=wrap(target-yaw),step=Math.min(Math.abs(delta)*(1-Math.exp(-ease*dt)),turnRate*dt);
   yaw=wrap(yaw+Math.sign(delta)*step);return yaw;
  }
 };
}
