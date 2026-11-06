// Underground areas as data (caves, crypts, mines). Server twin: db/underground-1-engine.sql.
//
// The underground is a far-away region of the same world plane: every area has an origin at
// x or z >= 1000 (the overworld ends near ±420) and each extra level sits LEVEL_GAP units further
// south. Players and actors are only ever sent within 220 units of each other, so an area's
// distance from the overworld and from other areas *is* its plane: you only see actors on your
// own layer, the tile grid and can_step get their walls from the rasterised rooms, and death
// respawns you at the normal overworld spot.
//
// A dungeon definition (stored per area in eldervale_private.underground_areas.data, editable in
// the Game console › World › Underground):
//  {id,name,theme:'earth'|'crypt'|'fire',band:[min,max],origin:{x,z},enabled,
//   levels:[{level,name,rooms:[{id,x,z,rx,rz}],tunnels:[{points:[[x,z],...],width}]}],
//   entrances:[{id,kind,x,z,yaw,name,to:{level,x,z},requires?:{combat?,agility?}}],   // overworld x/z
//   links:[{id,kind:'ladder'|'stairs',level,x,z,to:{level,x,z}}],                        // local x/z
//   spawns:[{id,roster,count,level,room,roam?,respawn?}],
//   lights:[{level,x,z,kind:'torch'|'fungus'|'lava'|'crystal'|'brazier',color?,intensity?,distance?}],
//   reserved?:[{level,room,note}]}
// Rooms are ellipses, tunnels are polylines of a given width; a tile is walkable when its centre
// is inside a room or within width/2 of a tunnel segment (same arithmetic as the SQL).
export const TILE=1.58,UNDERGROUND_MIN=1000,LEVEL_GAP=400,PAD_TILES=3;

export const THEMES={
 earth:{label:'Earth cave',floor:0x4b4034,floorAlt:0x5d5142,wall:0x5a4e43,wallAlt:0x463b31,fog:0x0b0907,fogNear:10,fogFar:58,ambient:0x9a8a74,ambientIntensity:.42,sun:.08,music:'cave',decor:'stalagmite'},
 crypt:{label:'Crypt',floor:0x474a4c,floorAlt:0x55585a,wall:0x5b5e60,wallAlt:0x3f4244,fog:0x08090c,fogNear:9,fogFar:52,ambient:0x8590a6,ambientIntensity:.38,sun:.06,music:'crypt',decor:'bones'},
 fire:{label:'Fire cavern',floor:0x3a2a24,floorAlt:0x4a3027,wall:0x3b2b26,wallAlt:0x2a1e1a,fog:0x1a0703,fogNear:11,fogFar:62,ambient:0xd08a5a,ambientIntensity:.4,sun:.1,music:'fire',decor:'basalt'}
};
export const LIGHT_KINDS={torch:{color:0xffa04a,intensity:5,distance:15},brazier:{color:0xff8a3a,intensity:7,distance:18},fungus:{color:0x6fe3c8,intensity:3,distance:11},crystal:{color:0x9ab8ff,intensity:3.5,distance:12},lava:{color:0xff5a1a,intensity:6.5,distance:17}};
// Overworld entrances and the matching way out, ladders and stairs between levels.
export const PASSAGE_TEMPLATES={cave_mouth:'Cave mouth',crypt_door:'Crypt door',mine_shaft:'Mine shaft',trapdoor:'Trapdoor',cave_exit:'Way out',ladder_down:'Ladder down',ladder_up:'Ladder up',stairs_down:'Stairs down',stairs_up:'Stairs up'};
export const PASSAGE_VERBS={cave_mouth:'Enter',crypt_door:'Enter',mine_shaft:'Climb down',trapdoor:'Climb down',cave_exit:'Leave',ladder_down:'Climb down',ladder_up:'Climb up',stairs_down:'Walk down',stairs_up:'Walk up'};

const room=(id,x,z,rx,rz)=>({id,x,z,rx,rz}),tunnel=(width,...points)=>({width,points});
export const dungeons=[
 {id:'birchroot_hollow',name:'Birchroot Hollow',theme:'earth',band:[3,20],origin:{x:1200,z:1200},enabled:true,
  blurb:'Roots of the old birch wood drink from an underground stream. Bats, spiders and goblin squatters; skeletons further down.',
  levels:[
   {level:0,name:'Rootway',rooms:[room('mouth',0,0,6,5),room('roots',22,-10,10,8),room('pool',18,18,9,7),room('warren',46,4,11,9),room('drop',63,-17,6,6)],
    tunnels:[tunnel(3,[0,0],[22,-10]),tunnel(3,[0,0],[10,10],[18,18]),tunnel(3.2,[22,-10],[34,-4],[46,4]),tunnel(2.6,[18,18],[34,16],[46,4]),tunnel(2.6,[46,4],[56,-8],[63,-17])]},
   {level:1,name:'Deep burrows',rooms:[room('landing',0,0,6,6),room('ossuary',24,10,11,9),room('den',6,32,12,10),room('grotto',34,40,10,9)],
    tunnels:[tunnel(3,[0,0],[24,10]),tunnel(3,[0,0],[4,16],[6,32]),tunnel(2.8,[24,10],[30,24],[34,40]),tunnel(2.6,[6,32],[20,38],[34,40])]}
  ],
  entrances:[{id:'mouth',kind:'cave_mouth',x:-317,z:130,yaw:90,name:'Birchroot cave mouth',to:{level:0,x:2,z:0}}],
  links:[{id:'drop',kind:'ladder',level:0,x:64,z:-18,to:{level:1,x:1.5,z:0}}],
  spawns:[{id:'bats',roster:'dusk_bat',count:4,level:0,room:'roots'},{id:'spiders',roster:'mossweb_spider',count:4,level:0,room:'pool'},{id:'goblins',roster:'bramble_goblin',count:5,level:0,room:'warren'},
   {id:'skeletons',roster:'cairn_skeleton',count:4,level:1,room:'ossuary'},{id:'brutes',roster:'tuskgob_brute',count:4,level:1,room:'den'},{id:'lurkers',roster:'fen_lurker',count:3,level:1,room:'grotto'}],
  lights:[{level:0,x:3,z:-3,kind:'torch'},{level:0,x:22,z:-17,kind:'fungus'},{level:0,x:18,z:24,kind:'fungus'},{level:0,x:12,z:15,kind:'crystal'},{level:0,x:46,z:12,kind:'torch'},{level:0,x:60,z:-14,kind:'torch'},
   {level:1,x:3,z:3,kind:'torch'},{level:1,x:24,z:3,kind:'fungus'},{level:1,x:6,z:25,kind:'brazier'},{level:1,x:38,z:46,kind:'fungus'},{level:1,x:30,z:36,kind:'crystal'}]},
 {id:'hollowmere_undercroft',name:'Hollowmere Undercroft',theme:'crypt',band:[30,60],origin:{x:2000,z:1200},enabled:true,
  blurb:'Beneath the cairns the Hollow King’s court keeps its vigil: knights, wardens, webs and the drowned dead.',
  levels:[
   {level:0,name:'Upper crypt',rooms:[room('hall',0,0,7,6),room('gallery',30,0,14,7),room('webs',10,-30,11,10),room('wardens',62,0,12,11)],
    tunnels:[tunnel(3,[0,0],[30,0]),tunnel(3,[0,0],[4,-14],[10,-30]),tunnel(3.2,[30,0],[62,0]),tunnel(2.4,[10,-30],[40,-28],[60,-10])]},
   {level:1,name:'Ossuary depths',rooms:[room('landing',0,0,6,6),room('nave',28,-6,14,9),room('pit',10,26,12,10),room('cistern',40,24,10,8)],
    tunnels:[tunnel(3,[0,0],[28,-6]),tunnel(3,[0,0],[10,26]),tunnel(2.8,[28,-6],[40,24]),tunnel(2.8,[10,26],[40,24])]}
  ],
  entrances:[{id:'door',kind:'crypt_door',x:-118,z:-372,yaw:180,name:'Hollowmere crypt door',to:{level:0,x:2,z:0}}],
  links:[{id:'stair',kind:'stairs',level:0,x:68,z:6,to:{level:1,x:1.5,z:0}}],
  spawns:[{id:'knights',roster:'cairnbound_knight',count:5,level:0,room:'gallery'},{id:'broodlings',roster:'gloomweb_broodling',count:4,level:0,room:'webs'},{id:'wardens',roster:'crypt_warden',count:4,level:0,room:'wardens'},
   {id:'phantoms',roster:'gloam_phantom',count:4,level:1,room:'nave'},{id:'ogres',roster:'cragmaw_ogre',count:3,level:1,room:'pit'},{id:'wraiths',roster:'hoarfrost_wraith',count:4,level:1,room:'cistern'}],
  lights:[{level:0,x:3,z:3,kind:'brazier'},{level:0,x:22,z:5,kind:'torch'},{level:0,x:40,z:-5,kind:'torch'},{level:0,x:10,z:-38,kind:'crystal'},{level:0,x:62,z:9,kind:'brazier'},
   {level:1,x:3,z:-3,kind:'torch'},{level:1,x:28,z:2,kind:'brazier'},{level:1,x:10,z:33,kind:'torch'},{level:1,x:40,z:30,kind:'crystal'}]},
 {id:'cindervault_depths',name:'Cindervault Depths',theme:'fire',band:[55,100],origin:{x:2800,z:1200},enabled:true,
  blurb:'The fire under Cindervault never went out. Golems, hounds, whelps and fiends — and a sealed crucible waiting for something worse.',
  levels:[
   {level:0,name:'Ash galleries',rooms:[room('entry',0,0,7,6),room('forge',26,8,13,10),room('run',52,-14,12,8),room('nest',36,-38,11,10),room('drop',68,-24,5,5)],
    tunnels:[tunnel(3.2,[0,0],[26,8]),tunnel(3,[26,8],[40,-2],[52,-14]),tunnel(2.8,[26,8],[30,-20],[36,-38]),tunnel(2.6,[52,-14],[68,-24])]},
   {level:1,name:'Molten heart',rooms:[room('landing',0,0,6,6),room('fiends',26,0,14,11),room('causeway',50,16,10,8),room('rift',28,32,12,10),room('crucible',66,42,16,14)],
    tunnels:[tunnel(3.2,[0,0],[26,0]),tunnel(3,[26,0],[28,32]),tunnel(3.4,[50,16],[60,30],[66,42]),tunnel(2.6,[28,32],[50,40],[66,42])]}
  ],
  entrances:[{id:'shaft',kind:'mine_shaft',x:395,z:72,yaw:270,name:'Cindervault shaft',to:{level:0,x:2,z:0}}],
  links:[{id:'descent',kind:'stairs',level:0,x:69,z:-25,to:{level:1,x:1.5,z:0}}],
  spawns:[{id:'golems',roster:'basalt_golem',count:4,level:0,room:'forge'},{id:'hounds',roster:'ashmaw_hound',count:5,level:0,room:'run'},{id:'whelps',roster:'ashscale_whelp',count:3,level:0,room:'nest'},
   {id:'fiends',roster:'cinder_fiend',count:4,level:1,room:'fiends'},{id:'sentinels',roster:'runebound_sentinel',count:3,level:1,room:'causeway'},{id:'demons',roster:'duskborn_demon',count:3,level:1,room:'rift'}],
  lights:[{level:0,x:3,z:-3,kind:'brazier'},{level:0,x:26,z:14,kind:'lava'},{level:0,x:50,z:-10,kind:'lava'},{level:0,x:36,z:-44,kind:'lava'},{level:0,x:64,z:-22,kind:'torch'},
   {level:1,x:3,z:3,kind:'brazier'},{level:1,x:26,z:7,kind:'lava'},{level:1,x:50,z:20,kind:'lava'},{level:1,x:28,z:38,kind:'lava'},{level:1,x:60,z:42,kind:'lava'},{level:1,x:72,z:42,kind:'lava'}],
  reserved:[{level:1,room:'crucible',note:'Boss chamber kept empty for the Round 3 Cindervault boss.'}]}
];

export const isUndergroundPoint=(x,z)=>x>UNDERGROUND_MIN||z>UNDERGROUND_MIN;
export function levelOrigin(area,level){return {x:area.origin.x,z:area.origin.z+level*LEVEL_GAP}}
export function toWorld(area,level,x,z){const o=levelOrigin(area,level);return {x:o.x+x,z:o.z+z}}
export function levelDef(area,level){return area.levels.find(l=>l.level===level)}
export function roomById(area,level,id){return levelDef(area,level)?.rooms.find(r=>r.id===id)}
export const tileOf=v=>Math.floor(v/TILE+.5);

// Same arithmetic as eldervale_private.underground_walkable (keep the operation order).
export function walkableLocal(lv,x,z){
 for(const r of lv.rooms){const dx=(x-r.x)/r.rx,dz=(z-r.z)/r.rz;if(dx*dx+dz*dz<=1)return true}
 for(const t of lv.tunnels||[]){const h=t.width/2;for(let k=1;k<t.points.length;k++){const a=t.points[k-1],b=t.points[k],dx=b[0]-a[0],dz=b[1]-a[1],len=dx*dx+dz*dz;let u=len>0?((x-a[0])*dx+(z-a[1])*dz)/len:0;u=u<0?0:u>1?1:u;const ex=x-a[0]-dx*u,ez=z-a[1]-dz*u;if(ex*ex+ez*ez<=h*h)return true}}
 return false;
}
export function levelExtent(lv){let x0=Infinity,z0=Infinity,x1=-Infinity,z1=-Infinity;
 for(const r of lv.rooms){x0=Math.min(x0,r.x-r.rx);x1=Math.max(x1,r.x+r.rx);z0=Math.min(z0,r.z-r.rz);z1=Math.max(z1,r.z+r.rz)}
 for(const t of lv.tunnels||[])for(const [x,z] of t.points){x0=Math.min(x0,x-t.width/2);x1=Math.max(x1,x+t.width/2);z0=Math.min(z0,z-t.width/2);z1=Math.max(z1,z+t.width/2)}
 return {x0,z0,x1,z1};
}
// Tile bitmap of one level in world tiles: bit (j-j0)*w+(i-i0) is 1 when walkable.
export function rasterize(area,level){
 const lv=levelDef(area,level),o=levelOrigin(area,level),e=levelExtent(lv);
 const i0=Math.floor((o.x+e.x0)/TILE)-PAD_TILES,j0=Math.floor((o.z+e.z0)/TILE)-PAD_TILES,i1=Math.ceil((o.x+e.x1)/TILE)+PAD_TILES,j1=Math.ceil((o.z+e.z1)/TILE)+PAD_TILES;
 const w=i1-i0+1,h=j1-j0+1,mask=new Uint8Array(w*h);let walkable=0;
 for(let j=j0;j<=j1;j++)for(let i=i0;i<=i1;i++)if(walkableLocal(lv,i*TILE-o.x,j*TILE-o.z)){mask[(j-j0)*w+(i-i0)]=1;walkable++}
 return {area:area.id,level,i0,j0,w,h,mask,walkable};
}
// The level (and area) under a world point, using the rasterised bounds.
export function createUndergroundIndex(areas=dungeons){
 const grids=[];for(const area of areas)for(const lv of area.levels)grids.push({area,level:lv.level,lv,...rasterize(area,lv.level)});
 const at=(x,z)=>{if(!isUndergroundPoint(x,z))return null;const i=tileOf(x),j=tileOf(z);for(const g of grids)if(i>=g.i0&&i<g.i0+g.w&&j>=g.j0&&j<g.j0+g.h)return g;return null};
 const walkable=(x,z)=>{const g=at(x,z);if(!g)return !isUndergroundPoint(x,z);const i=tileOf(x),j=tileOf(z);return g.mask[(j-g.j0)*g.w+(i-g.i0)]===1};
 return {grids,at,walkable,area:id=>areas.find(a=>a.id===id)};
}

// Deterministic spawn positions (also eldervale_private.underground_spawn_point).
export function spawnPoint(rm,k,count){const a=k*2*Math.PI/Math.max(1,count)+.7,r=count>1?.5:0;return {x:Math.round((rm.x+Math.cos(a)*rm.rx*r)*10)/10,z:Math.round((rm.z+Math.sin(a)*rm.rz*r)*10)/10}}
const EXIT_KIND={earth:'cave_exit',crypt:'stairs_up',fire:'ladder_up'};
// Every passage object of an area: overworld entrances, the way out, ladders/stairs both ways.
export function passageObjects(area){
 const out=[];
 for(const e of area.entrances||[]){const a=(e.yaw||0)*Math.PI/180,front={x:Math.round((e.x+Math.sin(a)*3.2)*10)/10,z:Math.round((e.z+Math.cos(a)*3.2)*10)/10},inside=toWorld(area,e.to.level,e.to.x,e.to.z),exit=toWorld(area,e.to.level,e.to.x-3.5,e.to.z);
  out.push({key:'entrance:'+e.id,template:e.kind,name:e.name,x:e.x,z:e.z,yaw:e.yaw||0,passage:{area:area.id,dest:[inside.x,inside.z],requires:e.requires||null,depth:e.to.level}});
  out.push({key:'exit:'+e.id,template:EXIT_KIND[area.theme]||'cave_exit',name:'Way out to '+(e.name||area.name),x:exit.x,z:exit.z,yaw:90,passage:{area:area.id,dest:[front.x,front.z],depth:-1}})}
 for(const l of area.links||[]){const down=l.to.level>l.level,top=toWorld(area,l.level,l.x,l.z),bottom=toWorld(area,l.to.level,l.to.x,l.to.z),k=l.kind==='stairs'?'stairs':'ladder';
  out.push({key:'link:'+l.id+':a',template:k+(down?'_down':'_up'),name:(l.name||levelDef(area,l.to.level)?.name||'Below'),x:top.x,z:top.z,yaw:0,passage:{area:area.id,dest:[bottom.x+1.6,bottom.z],depth:l.to.level}});
  out.push({key:'link:'+l.id+':b',template:k+(down?'_up':'_down'),name:(levelDef(area,l.level)?.name||'Above'),x:bottom.x-.6,z:bottom.z,yaw:0,passage:{area:area.id,dest:[top.x-1.6,top.z],depth:l.level}})}
 return out;
}
export function spawnPlan(area){
 const out=[];for(const s of area.spawns||[]){const rm=roomById(area,s.level,s.room);if(!rm)continue;for(let k=0;k<s.count;k++){const p=spawnPoint(rm,k,s.count),w=toWorld(area,s.level,p.x,p.z);out.push({key:s.id+':'+k,group:s.id,roster:s.roster,x:w.x,z:w.z,roam:s.roam??3,respawn:s.respawn})}}return out;
}

// Console/server-side validation mirrors eldervale_private.underground_check.
export function validateDungeon(d,{others=[],roster=null}={}){
 const errors=[],num=v=>typeof v==='number'&&Number.isFinite(v),idOk=v=>typeof v==='string'&&/^[a-z][a-z0-9_]{1,40}$/.test(v);
 if(!d||typeof d!=='object')return ['Not an object'];
 if(!idOk(d.id))errors.push('id: lower-case letters, digits and _');
 if(!d.name||String(d.name).length>60)errors.push('name: 1–60 characters');
 if(!THEMES[d.theme])errors.push('theme: one of '+Object.keys(THEMES).join(', '));
 if(!d.origin||!num(d.origin.x)||!num(d.origin.z)||d.origin.x<UNDERGROUND_MIN+100||d.origin.z<UNDERGROUND_MIN+100||d.origin.x>4200||d.origin.z>3200)errors.push('origin: x 1100–4200, z 1100–3200');
 for(const o of others)if(o.id!==d.id&&o.origin&&d.origin&&Math.abs(o.origin.x-d.origin.x)<600&&Math.abs(o.origin.z-d.origin.z)<600)errors.push('origin: closer than 600 to '+o.id);
 if(!Array.isArray(d.levels)||!d.levels.length||d.levels.length>4)errors.push('levels: 1–4');
 const levels=new Set();
 for(const lv of d.levels||[]){if(!Number.isInteger(lv.level)||lv.level<0||lv.level>3||levels.has(lv.level)){errors.push('level numbers 0–3, unique');continue}levels.add(lv.level);
  if(!Array.isArray(lv.rooms)||!lv.rooms.length||lv.rooms.length>24)errors.push('level '+lv.level+': 1–24 rooms');
  for(const r of lv.rooms||[])if(!idOk(r.id)||![r.x,r.z,r.rx,r.rz].every(num)||Math.abs(r.x)>150||Math.abs(r.z)>150||r.rx<2||r.rz<2||r.rx>30||r.rz>30)errors.push('level '+lv.level+' room '+(r.id||'?')+': id, |x|,|z| ≤ 150, radii 2–30');
  for(const t of lv.tunnels||[])if(!num(t.width)||t.width<1.6||t.width>8||!Array.isArray(t.points)||t.points.length<2||t.points.length>12||!t.points.every(p=>Array.isArray(p)&&num(p[0])&&num(p[1])&&Math.abs(p[0])<=150&&Math.abs(p[1])<=150))errors.push('level '+lv.level+': tunnel width 1.6–8, 2–12 points within ±150');
  if((lv.tunnels||[]).length>40)errors.push('level '+lv.level+': at most 40 tunnels')}
 const inside=(level,x,z)=>{const lv=d.levels?.find(l=>l.level===level);return !!lv&&walkableLocal(lv,x,z)};
 for(const e of d.entrances||[]){if(!idOk(e.id)||!PASSAGE_TEMPLATES[e.kind]||![e.x,e.z].every(num)||Math.abs(e.x)>420||Math.abs(e.z)>420)errors.push('entrance '+(e.id||'?')+': id, kind and overworld x/z within ±420');if(!e.to||!inside(e.to.level,e.to.x,e.to.z))errors.push('entrance '+(e.id||'?')+': arrival point must be inside a room or tunnel');}
 if(!(d.entrances||[]).length)errors.push('entrances: at least one');
 for(const l of d.links||[]){if(!idOk(l.id)||!['ladder','stairs'].includes(l.kind))errors.push('link '+(l.id||'?')+': id and kind ladder|stairs');if(!inside(l.level,l.x,l.z)||!l.to||!inside(l.to.level,l.to.x,l.to.z)||l.to.level===l.level)errors.push('link '+(l.id||'?')+': both ends inside, on different levels')}
 for(const s of d.spawns||[]){if(!idOk(s.id)||!Number.isInteger(s.count)||s.count<1||s.count>12)errors.push('spawn '+(s.id||'?')+': id and 1–12 monsters');if(!d.levels?.find(l=>l.level===s.level)?.rooms.find(r=>r.id===s.room))errors.push('spawn '+(s.id||'?')+': unknown room');if(roster&&!roster.has(s.roster))errors.push('spawn '+(s.id||'?')+': unknown roster monster '+s.roster)}
 for(const l of d.lights||[])if(!LIGHT_KINDS[l.kind]||!d.levels?.find(v=>v.level===l.level)||![l.x,l.z].every(num))errors.push('light: kind, level, x, z');
 if((d.lights||[]).length>64)errors.push('lights: at most 64');
 return errors;
}
