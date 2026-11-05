// Shared local dimensions for stairs, floors and owner placement. Heading follows Three.js.
export const STORY_HEIGHT=3;
export function buildingLocal(d,x,z){const a=(d.yaw||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),scale=1.3*(d.scale||1),dx=x-d.x,dz=z-d.z;return {x:(dx*c-dz*s)/scale,z:(dx*s+dz*c)/scale}}
export function buildingWorld(d,x,z){const a=(d.yaw||0)*Math.PI/180,c=Math.cos(a),s=Math.sin(a),scale=1.3*(d.scale||1);return {x:d.x+(x*c+z*s)*scale,z:d.z+(-x*s+z*c)*scale}}
export function stairPosition(d){return buildingWorld(d,1.12,-.65)}
export function storyScale(d){return Math.max(1.55,Math.min(1.8,1.3*(d?.scale||1)))}
export function storyOffset(d,floor=0){return Math.max(0,floor)*STORY_HEIGHT*storyScale(d)}
export function validStoryPosition(d,x,z,floor){const p=buildingLocal(d,x,z);return Number.isInteger(floor)&&floor>=0&&floor<(d.stories||1)&&Math.abs(p.x)<1.65&&Math.abs(p.z)<1.57}
export function addBuildingStories(T,h,d,{box,decorate,material}){
 const floors=[h.group],shells=[],furnishings=[],scale=1.3*d.scale,count=d.stories||1;if(count<2)return {floors,shells,furnishings};h.group.scale.y=storyScale(d);
 // Raise the original complete roof, then build matching walls and floors beneath it.
 for(const part of h.roofParts)part.position.y+=STORY_HEIGHT*(count-1);
 for(let floor=1;floor<count;floor++){
  const room=new T.Group();room.position.y=STORY_HEIGHT*floor;h.group.add(room);floors.push(room);
  const shell=new T.Group();room.add(shell);shells.push(shell);
  box(3.76,.085,3.56,0x81684c,0,.0825,0,shell,(h.style?.stone??d.stone)?'masonry':'floor');
  // Upper walls match the ground floor's material; its facade rules dress them.
  const wallColor=h.style?.wall??d.wallColor??0xc7bfa7,wallKind=h.style?.wallKind??(d.stone?'masonry':'plaster');
  for(const side of [-1,1]){box(.18,3,3.84,wallColor,side*1.91,1.5,0,shell,wallKind);box(3.64,3,.18,wallColor,0,1.5,side*1.83,shell,wallKind);box(3.7,.12,.13,0x6c5039,0,.3,side*1.71,shell,'wood');
   if(!h.dressStorey)for(const x of [-1.1,1.1]){box(.66,.85,.08,0x7c9ca5,x,1.8,side*1.94,shell);box(.75,.07,.12,0x574331,x,1.8,side*2,shell,'wood')}
  }
  h.dressStorey?.(shell);
  const furniture=new T.Group();room.add(furniture);furnishings.push(furniture);if(d.furnished!==false){const b=(w,h,depth,color,x,y,z,kind='wood')=>box(w,h,depth,color,x,y,z,furniture,kind);const roomType=(floor===2?d.topRoom:null)||d.upperRoom||'home';if(roomType==='workshop'){b(.3,1.4,2.2,0x62462f,-1.55,.85,-.25);b(.9,.12,.35,0x796044,-.5,1.7,-1.45)}else if(roomType==='home'){b(.85,.3,1.4,0x6b5038,-1,.3,-.6);b(.75,.14,1.2,0x7e8a76,-1,.52,-.6,'cloth');b(1.25,.1,.55,0x79583a,-.65,.85,1);for(const x of [-1.1,-.2])b(.12,.7,.45,0x573d2d,x,.44,1);b(1.1,1.6,.4,0x62462f,-.8,.93,-1.35)}else if(roomType==='chapel'){b(1.2,.8,.5,0xc7bfa5,-.5,.55,-1.1,'masonry');for(const z of [0,.8]){b(1.3,.35,.4,0x725639,-.5,.35,z);b(1.3,.55,.1,0x725639,-.5,.65,z-.18)}b(.09,.7,.09,0xd9bb70,-.5,1.6,-1.3,'stone');b(.45,.08,.09,0xd9bb70,-.5,1.75,-1.3,'stone')}else if(roomType==='armory'){b(1.4,1.6,.12,0x60492f,-.65,.9,-1.5);for(const x of [-1.1,-.65,-.2]){b(.06,1.1,.06,0x9ca7a5,x,1.2,-1.39,'stone');b(.25,.05,.08,0xa28c57,x,.78,-1.39,'stone')}b(1.5,.5,.7,0x65503a,-.5,.4,.7)}else{b(1.7,.12,.8,0x79583a,-.6,.85,0);for(const x of [-1.2,0])b(.12,.7,.6,0x573d2d,x,.44,0);for(const z of [-.7,.7])b(1.5,.35,.3,0x75583c,-.6,.3,z)}}
 }
 // A readable stair flight and landing at each level; server validates use at this anchor.
 for(let floor=0;floor<count;floor++){const flight=new T.Group();flight.position.set(1.12,STORY_HEIGHT*floor,-.65);h.group.add(flight);for(let step=0;step<16;step++){const angle=step*Math.PI/8,tread=box(.65,.09,.24,0x77583c,Math.cos(angle)*.32,.125+step*STORY_HEIGHT/16,Math.sin(angle)*.32,flight,'wood');tread.rotation.y=-angle}box(.09,3,.09,0x59442f,0,1.5,0,flight,'wood');flight.userData.stairFloor=floor;furnishings.push(flight)}
 return {floors,shells,furnishings,scale};
}
