// Birchford, the walled royal capital of Eldervale. One shared plan drives the
// server seed (scripts/build-capital-seed.mjs -> db/birchford-capital.sql), the
// client (flat ground, music/ambience radius, map walls and labels) and the
// layout tests. Birchford's original square, bank, lodge, workshop, chapel,
// house and general store stay where they are; the capital grows around them.
// Coordinates are world metres for the live seed (241916600): +x east, +z south.
import {entityDefaults} from './world-templates.js?v=release-20261106-clips125';
import {generatedWorld} from './procedural-world.js?v=release-20261106-clips125';

export const CAPITAL_BLUEPRINT='birchford-capital-v1';
export const capital={
 name:'Birchford',title:'Royal Capital of Eldervale',seed:241916600,
 // The original town square (fountain) and the centre of the walled city.
 square:{x:-234,z:126},centre:{x:-218,z:143},
 // Curtain wall, clockwise from the north-west corner.
 walls:[[-268,80],[-204,80],[-168,116],[-168,190],[-184,206],[-252,206],[-268,190]],
 // Gates sit where the seeded roads cross the wall (plus the farm gate west).
 gates:[
  {key:'north',name:'North Gate',x:-244.76,z:80,edge:0,road:'Castle Road'},
  {key:'frost',name:'Frost Gate',x:-193.68,z:90.32,edge:1,road:'Winterwatch Road',wardens:1},
  {key:'ember',name:'Ember Gate',x:-168,z:134.88,edge:2,road:'Emberspire Road'},
  {key:'west',name:'Farm Gate',x:-268,z:156,edge:6,road:'Farm Lane',wardens:1}
 ],
 // Mid-wall towers in addition to one at every corner.
 towers:[[-226,80],[-168,163],[-200,206],[-216,206],[-234,206],[-268,106]]
};
export const GATE_LENGTH=16,TOWER_RADIUS=5,WALL_HALF=1.6;

// ---- Geometry helpers (shared by client and tests) ----
const segDist=(x,z,a,b)=>{const dx=b[0]-a[0],dz=b[1]-a[1],l=dx*dx+dz*dz,t=l?Math.max(0,Math.min(1,((x-a[0])*dx+(z-a[1])*dz)/l)):0;return Math.hypot(x-a[0]-dx*t,z-a[1]-dz*t)};
export function insideWalls(x,z,poly=capital.walls){let inside=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const [xi,zi]=poly[i],[xj,zj]=poly[j];if((zi>z)!==(zj>z)&&x<(xj-xi)*(z-zi)/(zj-zi)+xi)inside=!inside}return inside}
// Signed distance to the wall line: negative inside the city.
export function wallDistance(x,z){let d=Infinity;const p=capital.walls;for(let i=0;i<p.length;i++)d=Math.min(d,segDist(x,z,p[i],p[(i+1)%p.length]));return insideWalls(x,z)?-d:d}
export function inCapital(x,z,pad=0){return wallDistance(x,z)<pad}
// The (convex) wall outline pushed out by d metres, mitred at the corners. The
// forest clearing uses it on both client (tree rendering) and server (trees disabled).
export function outsetWalls(d){const p=capital.walls,n=p.length,lines=p.map((a,i)=>{const b=p[(i+1)%n],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);let nx=dz/l,nz=-dx/l;const mx=(a[0]+b[0])/2,mz=(a[1]+b[1])/2;if(insideWalls(mx+nx,mz+nz)){nx=-nx;nz=-nz}return {ax:a[0]+nx*d,az:a[1]+nz*d,dx,dz}});
 return lines.map((l,i)=>{const m=lines[(i+n-1)%n],det=m.dx*l.dz-m.dz*l.dx,t=((l.ax-m.ax)*l.dz-(l.az-m.az)*l.dx)/det;return [Math.round((m.ax+m.dx*t)*100)/100,Math.round((m.az+m.dz*t)*100)/100]})}
export const CLEARING=6;
export const capitalClearing=outsetWalls(CLEARING);
export function inCapitalClearing(x,z){return insideWalls(x,z,capitalClearing)}
// Town music/ambience/sanctuary area that covers the whole walled city.
export const capitalZone={x:capital.centre.x,z:capital.centre.z,radius:80,half:66};
// The plan is laid out for the live seed: it applies when the seeded grass town sits on the old square.
export function capitalActive(world=generatedWorld){const t=world?.towns?.[0];return !!t&&Math.hypot(t.x-capital.square.x,t.z-capital.square.z)<1}
export function isCapitalTown(t){return capitalActive()&&!!t&&Math.hypot(t.x-capital.square.x,t.z-capital.square.z)<1}
// Music/ambience circle for a seeded town: the capital's covers the walled city.
export function townExtent(t,radius){return isCapitalTown(t)?{x:capitalZone.x,z:capitalZone.z,radius:Math.max(radius,72)}:{x:t.x,z:t.z,radius}}
// Map outline: wall polygon, gate gaps and towers.
export function capitalMapWalls(){return {points:capital.walls,gates:capital.gates,towers:[...capital.walls,...capital.towers]}}

// ---- Streets: centrelines of paved streets inside the walls ----
// King's Road, Frostgate Road and Market Street follow the seeded roads
// (nudged clear of the original buildings); the rest are new.
export const capitalStreets=[
 {key:'kings-road',name:'King’s Road',width:4,points:[[-244.76,80],[-243.2,91.6],[-241.9,103],[-239.4,113.5],[-236.2,118.6]]},
 {key:'frost-road',name:'Frostgate Road',width:4.4,points:[[-193.68,90.32],[-204.4,104.4],[-218,116.6],[-228.6,121.4]]},
 {key:'market-street',name:'Market Street',width:4.2,points:[[-226.1,127],[-218.5,126.9],[-203.1,126.8],[-187.6,130.8],[-172.2,134.2],[-168,134.88]]},
 {key:'west-way',name:'West Way',width:3.8,points:[[-268,156],[-251,156],[-242.6,138.6]]},
 {key:'crown-way',name:'Crown Way',width:3.8,points:[[-214.4,127.9],[-214.4,171],[-225.5,171]]},
 {key:'market-lane',name:'Market Lane',width:3.4,points:[[-198.4,128.6],[-196.4,155.8]]},
 {key:'chapel-lane',name:'Chapel Lane',width:2.6,points:[[-238.6,114.5],[-251,118.2]]},
 {key:'bell-lane',name:'Bell Lane',width:2.6,points:[[-228.8,121.4],[-226.6,92]]},
 {key:'south-row',name:'Southgate Row',width:2.6,points:[[-214.4,171],[-209,180],[-209,192]]}
];
export const marketSquare={x:-191,z:166,radius:10.5,name:'Grand Market'};
export const crownCourt={x:-232,z:171,radius:6.5,name:'Crown Court'};

// ---- Buildings ----
// A building faces (sin yaw, cos yaw): its door opens onto that side.
const ROOF={slate:0x485d68,red:0x8a4434,brown:0x6b4a33,green:0x4f6248,blue:0x3f526e,thatch:0x8a7348};
const WALL={stone:0xb0ada0,pale:0xc9bfa6,cream:0xd6c8a8,ochre:0xc9ad7f,grey:0x9d9b92,rose:0xc4a594};
export const capitalBuildings=[
 // Royal and civic
 {key:'keep',template:'cottage',room:'hall',name:'Birchford Keep',x:-232,z:188,yaw:180,scale:3,stories:2,stone:true,roof:ROOF.blue,wallColor:WALL.stone},
 {key:'temple',template:'cottage',room:'chapel',name:'Temple of the Morning Bell',x:-185,z:120.4,yaw:0,scale:2.2,stone:true,roof:ROOF.slate,wallColor:WALL.pale},
 {key:'bank-west',template:'bank',name:'Birchford West Bank',x:-257,z:169,yaw:180,scale:1.7,stone:true,roof:ROOF.slate,wallColor:WALL.stone},
 {key:'bank-east',template:'bank',name:'Birchford East Bank',x:-178,z:152,yaw:180,scale:1.7,stone:true,roof:ROOF.slate,wallColor:WALL.stone},
 {key:'warriors-guild',template:'cottage',room:'hall',name:'Warriors’ Guild',x:-202.4,z:118.4,yaw:0,scale:1.85,stone:true,roof:ROOF.red,wallColor:WALL.grey},
 {key:'crafting-guild',template:'forge',name:'Crafters’ Guild & Smithy',x:-256,z:184,yaw:90,scale:1.9,stone:true,roof:ROOF.brown,wallColor:WALL.grey},
 {key:'inn',template:'inn',name:'The Gilded Antler',x:-200,z:190,yaw:180,scale:2,stories:2,roof:ROOF.red,wallColor:WALL.cream},
 // Shops
 {key:'blades',template:'cottage',room:'shop',name:'Edgewright’s Blades',x:-208,z:150,yaw:270,scale:1.3,stone:true,roof:ROOF.brown,wallColor:WALL.grey},
 {key:'armour',template:'cottage',room:'shop',name:'Hollin’s Plate & Mail',x:-208,z:160.5,yaw:270,scale:1.3,stone:true,roof:ROOF.slate,wallColor:WALL.grey},
 {key:'archery',template:'cottage',room:'shop',name:'Fletch & Flight Archery',x:-255,z:145.5,yaw:0,scale:1.1,roof:ROOF.green,wallColor:WALL.ochre},
 {key:'magic',template:'cottage',room:'shop',name:'The Gilded Rune',x:-190,z:142.5,yaw:180,scale:1.25,stone:true,roof:ROOF.blue,wallColor:WALL.rose},
 {key:'bakery',template:'cottage',room:'shop',name:'Crumb & Crust Bakery',x:-218,z:90,yaw:270,scale:1.2,roof:ROOF.thatch,wallColor:WALL.cream},
 {key:'tailor',template:'cottage',room:'shop',name:'Threadneedle Tailors',x:-256,z:119,yaw:90,scale:1.2,roof:ROOF.red,wallColor:WALL.cream},
 {key:'tools',template:'cottage',room:'shop',name:'Deepvein Tools & Ores',x:-256,z:89.5,yaw:90,scale:1.25,stone:true,roof:ROOF.brown,wallColor:WALL.grey},
 {key:'apothecary',template:'cottage',room:'shop',name:'Mortar & Mint Apothecary',x:-221.5,z:144,yaw:90,scale:1.2,roof:ROOF.green,wallColor:WALL.pale},
 // Residences
 {key:'house-n1',template:'cottage',room:'home',name:'Bellringer’s House',x:-195,z:106,yaw:0,scale:1.2,roof:ROOF.brown,wallColor:WALL.cream},
 {key:'house-n2',template:'cottage',room:'home',name:'Northwall House',x:-207.5,z:91,yaw:0,scale:1.1,roof:ROOF.thatch,wallColor:WALL.ochre},
 {key:'house-c1',template:'cottage',room:'home',name:'Crown Way House',x:-222,z:162,yaw:90,scale:1.15,roof:ROOF.slate,wallColor:WALL.pale},
 {key:'house-s1',template:'cottage',room:'home',name:'Southgate House',x:-214,z:192,yaw:90,scale:1.15,roof:ROOF.thatch,wallColor:WALL.cream},
 {key:'house-s2',template:'cottage',room:'home',name:'Tanner’s Rest',x:-216.5,z:181,yaw:90,scale:1.1,roof:ROOF.brown,wallColor:WALL.ochre},
 {key:'house-e1',template:'cottage',room:'home',name:'Ember Row House',x:-177,z:171,yaw:270,scale:1.2,roof:ROOF.thatch,wallColor:WALL.cream},
 {key:'house-n3',template:'cottage',room:'home',name:'Wardens’ Lodging',x:-234.5,z:88,yaw:270,scale:1.1,roof:ROOF.slate,wallColor:WALL.grey},
 {key:'house-s3',template:'cottage',room:'home',name:'Chancellor’s House',x:-246.5,z:196,yaw:180,scale:1.05,roof:ROOF.blue,wallColor:WALL.pale},
 {key:'house-s4',template:'cottage',room:'home',name:'Ember Corner Cottage',x:-187,z:195,yaw:270,scale:1.05,roof:ROOF.green,wallColor:WALL.cream},
 {key:'house-e2',template:'cottage',room:'home',name:'Lamplighter’s House',x:-177,z:181,yaw:270,scale:1.15,roof:ROOF.red,wallColor:WALL.rose}
];

// ---- Shops: stock is catalog item keys; prices come from the server catalog ----
export const capitalShops={
 blades:{npc:'Edric Edgewright',dialogue:'Edgewright’s Blades, finest steel in the capital.\nSwords, axes and spears for every hand.',color:0x5d5f66,items:['weapon:dagger','weapon:bronzeSword','weapon:shortsword','weapon:longsword','weapon:scimitar','weapon:spear','weapon:axe','weapon:battleaxe','weapon:waraxe','weapon:hammer','weapon:warhammer','weapon:twohand']},
 armour:{npc:'Hollin the Armourer',dialogue:'Plate, mail and shields, fitted while you wait.\nA good shield has saved more lives than any sword.',color:0x55606b,items:['armor:helm','armor:chest','armor:legs','armor:boots','armor:knightGambeson1','armor:knightGauntlets1','armor:knightRoundPauldrons1','armor:knightHornedHelm1','armor:knightSpikedPauldrons1','armor:knightScarf1','shield:woodenShield','shield:roundShield','shield:square','shield:kite','shield:quarteredShield']},
 archery:{npc:'Wren Fletcher',dialogue:'Bows strung, arrows fletched, ranger kit for the road.\nFeathers and shafts too, if you fletch your own.',color:0x4f6a3f,items:['weapon:woodenBow','shortbow','weapon:longbow','arrows','arrowShafts','arrowTips','headlessArrows','feathers','bowString','unstrungBow','armor:rangerHood1','armor:rangerTunic1','armor:rangerTrousers1','armor:rangerBoots1','armor:rangerBracers1','armor:rangerPauldron1']},
 magic:{npc:'Magister Oriel',dialogue:'Runes, staves and robes for the arcane arts.\nMind the essence dust.',color:0x5a4c88,items:['airRune','fireRune','runeEssence','weapon:apprenticeStaff','weapon:sapphireStaff','weapon:amethystStaff','armor:wizardRobeTop1','armor:wizardRobeBottom1','armor:wizardBoots1','armor:wizardBracers1','candle']},
 bakery:{npc:'Bess the Baker',dialogue:'Fresh from the oven every morning!\nBread, pies, pizza and a sundae for the brave.',color:0xb08a62,items:['bread','berryPie','cheesePizza','cheese','sundae','flour','dough','egg','apple','pear','orange','vegetableSoup']},
 tailor:{npc:'Perrine Threadneedle',dialogue:'Fine coats and capes, made to measure.\nNeedle, thread and linen for those who sew their own.',color:0x8c4f6a,items:['armor:nobleCoat1','armor:nobleTrousers1','armor:nobleBoots1','armor:nobleSleeves1','armor:noblePauldron1','armor:cape','leatherGloves','woolBlanket','linen','thread','needle','leather']},
 tools:{npc:'Dagna Deepvein',dialogue:'Picks, hammers and chisels, plus coal and ore for the furnace.\nEverything a miner or smith needs.',color:0x6b5a45,items:['weapon:pickaxe','weapon:bronzeAxe','hammer','chisel','saw','spade','knife','tinderbox','coal','copperOre','tinOre','bronzeBar','ironBar','nails','steelNails']},
 apothecary:{npc:'Sorrel the Apothecary',dialogue:'Herbs, vials and remedies.\nA healing draught before the road never hurt anyone.',color:0x4f7255,items:['healingPotion','unfinishedPotion','vial','vialWater','pestle','grimyHerb','cleanHerb','herbSeeds','mushroom','berries','trailBerries']},
 inn:{npc:'Marta the Barkeep',dialogue:'Welcome to the Gilded Antler!\nHot food, soft beds and the best stew in Birchford.',color:0x8a5444,items:['cookedMeat','cookedFish','roastChicken','vegetableSoup','bread','cheese','trailRations','water']}
};
// Grand Market stalls around the well (bearing in degrees from the market centre).
export const marketStalls=[
 {key:'fish',bearing:0,npc:'Gilly the Fishmonger',color:0x4e6f7c,items:['rawShrimp','shrimp','rawFish','cookedFish','rawTrout','trout','rawSalmon','salmon','rawLobster','lobster']},
 {key:'greens',bearing:45,npc:'Tobin the Greengrocer',color:0x6f7f45,items:['apple','pear','orange','carrot','berries','mushroom','wheat','wheatSeeds']},
 {key:'butcher',bearing:90,npc:'Hrolf the Butcher',color:0x7c4a43,items:['rawMeat','cookedMeat','roastChicken','egg','cheese']},
 {key:'gems',bearing:135,npc:'Saffi the Gem Trader',color:0x6b4f86,items:['uncutGem','cutGem','silverRing','silverBar','goldBar','jewelry:prospectorsRing','jewelry:woodlandAmulet']},
 {key:'furs',bearing:180,npc:'Brannagh the Furrier',color:0x7a6247,items:['fur','furPelt','hide','leather','leatherGloves']},
 {key:'candles',bearing:225,npc:'Ottilie the Chandler',color:0xa58a52,items:['candle','campLantern','tinderbox','matches','rope','bedroll']},
 {key:'timber',bearing:270,npc:'Corwin the Timber Merchant',color:0x6a5236,items:['wood','oakLogs','willowLogs','mapleLogs','plank','oakPlank','nails']},
 {key:'bakestall',bearing:315,npc:'Lida the Pie Seller',color:0xb27b55,items:['berryPie','bread','trailRations','sundae']}
];
export const STALL_RING=7.5;

// ---- Placement helpers ----
const rad=d=>d*Math.PI/180;
export const local=(b,lx,lz)=>{const a=rad(b.yaw||0),s=1.3*(b.scale||1);return {x:b.x+(lx*Math.cos(a)+lz*Math.sin(a))*s,z:b.z+(-lx*Math.sin(a)+lz*Math.cos(a))*s}};
export const doorPoint=(b,out=2.7)=>local(b,0,out);
const r2=v=>Math.round(v*100)/100;
// Wall pieces between towers and gates along each edge.
export function wallPieces(){
 const p=capital.walls,rows=[];
 const towers=[...p.map(([x,z])=>({x,z,corner:true})),...capital.towers.map(([x,z])=>({x,z}))];
 for(let i=0;i<p.length;i++){
  const a=p[i],b=p[(i+1)%p.length],dx=b[0]-a[0],dz=b[1]-a[1],len=Math.hypot(dx,dz),ux=dx/len,uz=dz/len,along=(x,z)=>(x-a[0])*ux+(z-a[1])*uz;
  // Blocked intervals along this edge: towers (radius) and gates (half length).
  const cuts=[];for(const t of towers)if(segDist(t.x,t.z,a,b)<.01)cuts.push([along(t.x,t.z)-TOWER_RADIUS+1.2,along(t.x,t.z)+TOWER_RADIUS-1.2]);
  for(const g of capital.gates.filter(g=>g.edge===i))cuts.push([along(g.x,g.z)-GATE_LENGTH/2+.2,along(g.x,g.z)+GATE_LENGTH/2-.2]);
  cuts.sort((u,v)=>u[0]-v[0]);let s=0;const free=[];for(const [c0,c1]of cuts){if(c0>s)free.push([s,c0]);s=Math.max(s,c1)}if(s<len)free.push([s,len]);
  const yaw=Math.atan2(-uz,ux)*180/Math.PI;
  for(const [f0,f1]of free){const L=f1-f0;if(L<.5)continue;const n=Math.ceil(L/24);for(let k=0;k<n;k++){const s0=f0+L*k/n,s1=f0+L*(k+1)/n,m=(s0+s1)/2;rows.push({template:'castle_wall',x:r2(a[0]+ux*m),z:r2(a[1]+uz*m),yaw:r2(yaw),length:r2(s1-s0+.2),edge:i})}}
 }
 return {walls:rows,towers,edgeYaw:i=>{const a=p[i],b=p[(i+1)%p.length];return Math.atan2(-(b[1]-a[1]),b[0]-a[0])*180/Math.PI}};
}
// Paved street segments: one 'road' entity per centreline leg (length along local z).
export function streetSegments(){
 const out=[];for(const s of capitalStreets)for(let i=1;i<s.points.length;i++){const [ax,az]=s.points[i-1],[bx,bz]=s.points[i],len=Math.hypot(bx-ax,bz-az);out.push({street:s.key,name:s.name,x:r2((ax+bx)/2),z:r2((az+bz)/2),yaw:r2(Math.atan2(bx-ax,bz-az)*180/Math.PI),length:r2(len+s.width*.6),width:s.width})}
 return out;
}
// Lamp posts along streets, every ~16 m, alternating sides, beside the paving.
export function streetLamps(){
 const out=[];
 for(const s of capitalStreets){
  const legs=[];let total=0;for(let i=1;i<s.points.length;i++){const [ax,az]=s.points[i-1],[bx,bz]=s.points[i],len=Math.hypot(bx-ax,bz-az);legs.push({ax,az,ux:(bx-ax)/len,uz:(bz-az)/len,start:total,len});total+=len}
  const n=Math.max(1,Math.round(total/16));
  for(let k=0;k<n;k++){const d=(k+.5)*total/n,leg=legs.find(l=>d<=l.start+l.len)||legs.at(-1),t=d-leg.start,side=(out.length%2?1:-1),off=s.width/2+.6;
   out.push({x:r2(leg.ax+leg.ux*t-leg.uz*side*off),z:r2(leg.az+leg.uz*t+leg.ux*side*off),street:s.key})}
 }
 return out;
}

// Decorative and working props: [template,x,z,yaw,name]
export const capitalProps=[
 // Crown Court before the Keep
 ['stone_statue',-238.5,166,180,'Statue of Queen Aelith the First'],['stone_statue',-225.5,166,180,'Statue of King Oswin the Builder'],
 ['flower_bed',-243,175.4,0,'Royal flower bed'],['flower_bed',-221,175.4,0,'Royal flower bed'],
 ['banner',-235,178.4,0,'Royal standard'],['banner',-229.6,178.4,0,'Royal standard'],
 // Grand Market
 ['well',-191,166,0,'Market well'],
 // Banners at the gates (inside, beside the gate towers)
 ['banner',-252.5,84,0,'Birchford banner'],['banner',-237,84,0,'Birchford banner'],
 ['banner',-172,127,90,'Birchford banner'],['banner',-172,142.7,90,'Birchford banner'],
 ['banner',-264,148.2,270,'Birchford banner'],['banner',-264,163.8,270,'Birchford banner'],
 // Benches around the market and the court
 ['bench',-180,160,-90,'Market bench'],['bench',-202,174,126,'Market bench'],
 ['bench',-232,162.5,0,'Court bench'],
 // Workyards
 ['barrel',-211,144,0,'Oak barrel'],['crate',-210.5,166.2,0,'Supply crate'],
 ['barrel',-262.5,98.5,0,'Oak barrel'],['crate',-262.5,84.5,0,'Supply crate'],
 ['hay_bale',-262,145,0,'Hay bale'],['wheelbarrow',-204,181,90,'Wheelbarrow']
];

// ---- Server blueprint rows (entities.data) ----
const STATIONS_IN={'crafting-guild':[['furnace',-1,-1,0,'Guild furnace'],['anvil',1,-1,0,'Guild anvil'],['workbench',-1.15,.45,0,'Crafting bench'],['spinning_wheel',1.15,.45,0,'Spinning wheel']],
 'warriors-guild':[['weapon_rack',-1.15,-1.2,0,'Guild weapon rack'],['weapon_rack',1.15,-1.2,0,'Guild weapon rack']],inn:[['hearth',-1.05,-1.15,0,'Antler cooking range']],temple:[['altar',0,-1.05,0,'Altar of the Morning Bell']]};
const ROLE_NPC={
 'bank-west':{template:'banker',name:'Odell the West Banker',dialogue:'Welcome to the West Bank of Birchford.\nYour vault is the same in every branch of the realm.'},
 'bank-east':{template:'banker',name:'Rhosyn the East Banker',dialogue:'East Bank of Birchford, at your service.\nEvery branch opens the same vault.'},
 temple:{template:'healer',name:'High Priestess Elowen',dialogue:'The Morning Bell rings for every traveller.\nPray at the altar and be restored.',at:[0,.35]},
 'crafting-guild':{template:'smith',name:'Guildmaster Yselde',dialogue:'The Crafters’ Guild welcomes all hands.\nFurnace, anvil, bench and wheel are free to use.',at:[0,.45]},
 'warriors-guild':{template:'knight',name:'Guildmaster Brannoc',dialogue:'Steel sharpens steel. Train hard, fight fair.\nThe racks outside hold practice blades.',at:[0,-.3]},
 keep:{template:'villager',name:'Queen Aelith of Birchford',dialogue:'Welcome to Birchford, capital of Eldervale.\nMy city’s gates are open to all who keep the peace.',at:[0,-.6],extra:{activity:'read',color:0x6a3f7a,level:30,hp:200}},
 inn:{template:'innkeeper',name:'Hesper the Innkeeper',dialogue:'Rooms upstairs, stew on the range.\nUse the cooking range if you have raw food.',at:[.95,-.2]}
};
export function capitalBlueprint(){
 const rows=[];let n=0;
 const add=(template,x,z,extra={})=>{const row={...entityDefaults(template,r2(x),r2(z)),...extra,blueprint:CAPITAL_BLUEPRINT,blueprintKey:extra.key||template+'-'+(++n)};delete row.key;rows.push(row);return row};
 // Walls, towers, gates
 const {walls,towers,edgeYaw}=wallPieces();
 walls.forEach((w,i)=>add('castle_wall',w.x,w.z,{key:'wall-'+(i+1),name:'Birchford city wall',yaw:w.yaw,length:w.length}));
 towers.forEach((t,i)=>add('castle_tower',t.x,t.z,{key:'tower-'+(i+1),name:'Birchford wall tower'}));
 for(const g of capital.gates)add('castle_gate',g.x,g.z,{key:'gate-'+g.key,name:'Birchford '+g.name,yaw:r2(edgeYaw(g.edge)),length:GATE_LENGTH});
 // Streets, squares
 streetSegments().forEach((s,i)=>add('road',s.x,s.z,{key:'street-'+s.street+'-'+(i+1),name:s.name,yaw:s.yaw,length:s.length,width:s.width,paved:true}));
 // Farm Lane: a dirt track from the Farm Gate to the farm west of the walls.
 add('road',-275.5,152.6,{key:'farm-lane',name:'Farm Lane',yaw:r2(Math.atan2(-15,-7.4)*180/Math.PI),length:17,width:2.6});
 add('terrain_stone',marketSquare.x,marketSquare.z,{key:'market-square',name:'Birchford Grand Market',radius:marketSquare.radius,paved:true});
 add('terrain_stone',crownCourt.x,crownCourt.z,{key:'crown-court',name:'Crown Court',radius:crownCourt.radius,paved:true});
 streetLamps().forEach((l,i)=>add('lantern',l.x,l.z,{key:'lamp-'+(i+1),name:'Street lamp'}));
 // Buildings and their people
 for(const b of capitalBuildings){
  add(b.template,b.x,b.z,{key:b.key,name:b.name,yaw:b.yaw,scale:b.scale,room:b.room||b.template,stone:!!b.stone,roof:b.roof,wallColor:b.wallColor,biome:'grass',...(b.stories?{stories:b.stories}:{})});
  (STATIONS_IN[b.key]||[]).forEach(([t,lx,lz,yaw,name],i,list)=>{const p=local(b,lx,lz),dup=list.filter(s=>s[0]===t).length>1;add(t,p.x,p.z,{key:b.key+'-'+t+(dup?'-'+(i+1):''),name,yaw:r2((b.yaw||0)+yaw)})});
  const shop=capitalShops[b.key],role=ROLE_NPC[b.key];
  if(shop){const at=b.key==='inn'?[-.7,.35]:[0,.46],p=local(b,...at);add('merchant',p.x,p.z,{key:b.key+'-npc',name:shop.npc,dialogue:shop.dialogue,color:shop.color,yaw:b.yaw,shopItems:shop.items})}
  if(role){const at=role.at||[0,.46],p=local(b,...at);add(role.template,p.x,p.z,{key:b.key+'-'+role.template,name:role.name,dialogue:role.dialogue,yaw:b.yaw,roam:0,...(role.extra||{})})}
 }
 // Grand Market stalls: stall on the ring, trader behind it facing the well.
 for(const s of marketStalls){const a=rad(s.bearing),ox=Math.sin(a),oz=Math.cos(a),x=marketSquare.x+ox*STALL_RING,z=marketSquare.z+oz*STALL_RING,yaw=r2(s.bearing+180);
  add('market',x,z,{key:'stall-'+s.key,name:'Grand Market stall',yaw});
  add('merchant',x+ox*1.25,z+oz*1.25,{key:'stall-'+s.key+'-npc',name:s.npc,color:s.color,yaw,dialogue:'Fresh stock at the Grand Market!\nHave a look at my wares.',shopItems:s.items})}
 for(const [t,x,z,yaw,name]of capitalProps)add(t,x,z,{key:'prop-'+t+'-'+r2(x)+'-'+r2(z),name,yaw});
 // Guards: two wardens inside every gate, palace knights, wall patrols.
 for(const g of capital.gates){const yaw=rad(edgeYaw(g.edge)),ux=Math.cos(yaw),uz=-Math.sin(yaw),inward=inwardNormal(g);
  for(const side of g.wardens===1?[-1]:[-1,1])add('guard',g.x+ux*side*3.2+inward.x*4,g.z+uz*side*3.2+inward.z*4,{key:'gate-'+g.key+'-warden-'+(side<0?'a':'b'),name:'Birchford Gate Warden',level:40,hp:220,damage:16,roam:0,yaw:r2(Math.atan2(-inward.x,-inward.z)*180/Math.PI),dialogue:'Welcome to Birchford, capital of Eldervale.\nKeep the peace within these walls.'})}
 const keep=capitalBuildings.find(b=>b.key==='keep');
 // Corner turrets make the Keep read as the ruler's palace from anywhere in the city.
 [[-1,-1],[1,-1],[-1,1],[1,1]].forEach(([sx,sz],i)=>{const p=local(keep,sx*2.12,sz*1.98);add('castle_tower',p.x,p.z,{key:'keep-turret-'+(i+1),name:'Keep turret',scale:.8})});
for(const side of [-1,1]){const p=local(keep,side*1.05,2.75);add('white_knight',p.x,p.z,{key:'keep-knight-'+(side<0?'a':'b'),name:'Royal Guard',roam:0,yaw:keep.yaw})}
 capitalPatrols.forEach((route,i)=>add('guard',route[0].x,route[0].z,{key:'patrol-'+(i+1),name:'Birchford Wall Watch',level:40,hp:220,damage:16,roam:4,route}));
 capitalTownsfolk.forEach((p,i)=>add('villager',p.route[0].x,p.route[0].z,{key:'folk-'+(i+1),name:p.name,activity:p.activity,color:p.color,roam:3,route:p.route}));
 return rows;
}
export function inwardNormal(g){const a=capital.walls[g.edge],b=capital.walls[(g.edge+1)%capital.walls.length],dx=b[0]-a[0],dz=b[1]-a[1],l=Math.hypot(dx,dz);let nx=-dz/l,nz=dx/l;if(!insideWalls(g.x+nx*3,g.z+nz*3)){nx=-nx;nz=-nz}return {x:nx,z:nz}}

// ---- Routines (server data.route): {x,z,wait,act,face,hold} loops on open ground ----
const S=(x,z,wait=0,act,face,hold)=>({x,z,wait,...(act?{act}:{}),...(Number.isFinite(face)?{face}:{}),...(hold?{hold}:{})});
const PI=Math.PI;
// Wall Watch: four guards walk gate to gate along the streets and the wall walk,
// stopping to watch each gate. Loops return the way they came.
export const capitalPatrols=[
 // North Gate - King's Road - square - West Way - Farm Gate
 [S(-244.4,86.5,6,'watch',PI),S(-243,96),S(-241.4,106),S(-239.6,115.4),S(-241.2,121.5),S(-241.8,136.6),S(-250.4,154.2),S(-261.5,156,6,'watch',-PI/2),S(-250.4,154.2),S(-241.8,136.6),S(-241.2,121.5),S(-239.6,115.4),S(-241.4,106),S(-243,96)],
 // Ember Gate - Market Street - Crown Way - Crown Court
 [S(-174.5,134.6,6,'watch',PI/2),S(-187.6,130.8),S(-203.1,126.8),S(-214.4,129.5),S(-214.4,150),S(-214.4,168.5),S(-224,171,6,'watch',PI),S(-214.4,168.5),S(-214.4,150),S(-214.4,129.5),S(-203.1,126.8),S(-187.6,130.8)],
 // Frost Gate - Frostgate Road - Bell Lane - north wall walk
 [S(-198.6,96.4,6,'watch',2.4),S(-204.4,104.4),S(-218,116.6),S(-227.6,120.6),S(-227.6,110),S(-226.6,94.5),S(-226.6,86.6,5,'watch',PI),S(-226.6,94.5),S(-227.6,110),S(-227.6,120.6),S(-218,116.6),S(-204.4,104.4)],
 // South wall walk: Southgate Row - behind the Gilded Antler - Ember corner
 [S(-212.5,173.5),S(-209,180),S(-209,199.6,5,'watch',0),S(-196,199.8),S(-183.5,200.4,5,'watch',PI*.75),S(-196,199.8),S(-209,199.6),S(-209,180),S(-212.5,173.5),S(-214.4,160),S(-214.4,140),S(-214.4,160)]
];
// Townsfolk with daily rounds between the shops, the market and the square.
export const capitalTownsfolk=[
 {name:'Tilda the Shopper',activity:'carry',color:0x7a5f6b,route:[S(-225.5,121),S(-221,125.2),S(-205,125.4),S(-198.3,131),S(-197.2,150),S(-194.8,156.8),S(-192.8,161.8),S(-191,161.6,9,'trade',PI),S(-195.4,166,8,'trade',-PI/2),S(-192.8,161.8),S(-194.8,156.8),S(-197.2,150),S(-198.3,131),S(-205,125.4),S(-221,125.2)]},
 {name:'Pip the Porter',activity:'carry',color:0x6d6450,route:[S(-196.6,153.6,5,'fetch',PI,'crate'),S(-203,155.3),S(-212.6,155.3),S(-212.6,150.2,5,'fetch',-PI/2),S(-212.6,155.3),S(-203,155.3)]},
 {name:'Old Garrick',activity:'read',color:0x5e6b74,route:[S(-181.2,160,20,'sitread',-PI/2),S(-183.6,158.2),S(-184,148.5),S(-185,134,6,'watch',0),S(-184,148.5),S(-183.6,158.2)]},
 {name:'Sister Maud',activity:'read',color:0xc8c0a0,route:[S(-185,132.4),S(-185,128.4),S(-185,121.6,14,'pray',PI),S(-185,128.4),S(-185,132.4),S(-176,133.6),S(-176,138,8,'talk',PI),S(-176,133.6)]},
 {name:'Corin the Lamplighter',activity:'carry',color:0x6a5a3d,route:[S(-225.5,121),S(-231,117.8),S(-237.4,117.2),S(-241.2,121.5),S(-241.8,136.6),S(-250.4,154.2),S(-246.5,160,6,'fetch',PI/2),S(-250.4,154.2),S(-241.8,136.6),S(-241.2,121.5),S(-237.4,117.2),S(-231,117.8)]},
 {name:'Ada the Gardener',activity:'garden',color:0x667a4c,route:[S(-243,173.9,14,'garden',0),S(-232,174),S(-221,173.9,14,'garden',0),S(-232,173.6)]},
 {name:'Hob the Apprentice',activity:'carry',color:0x5a4f45,route:[S(-246,178.5),S(-247.6,184),S(-250.8,184),S(-253.5,183.6),S(-256.7,183.3),S(-256.7,181.6,12,'smith',-PI/2),S(-256.7,183.3),S(-253.5,183.6),S(-250.8,184),S(-247.6,184),S(-246,178.5),S(-245.5,170.5),S(-238,168.4,6,'talk',PI),S(-245.5,170.5)]},
 {name:'Wenna the Washerwoman',activity:'carry',color:0x7f7464,route:[S(-191,163.4,7,'fetch',0,'crate'),S(-186.75,164.2),S(-181.8,162.2),S(-181.4,170.6,6,'fetch',PI/2),S(-181.8,162.2),S(-186.75,164.2)]},
 {name:'Brother Anselm',activity:'read',color:0x5b4a3e,route:[S(-232,163.7,18,'sitread',0),S(-229.6,163.9),S(-227.6,157.6),S(-216.6,157.6),S(-216.6,131),S(-224.5,126),S(-228.8,126.6,8,'read',-PI/2),S(-224.5,126),S(-216.6,131),S(-216.6,157.6),S(-227.6,157.6),S(-229.6,163.9)]},
 {name:'Jory the Errand Boy',activity:'carry',color:0x6f7a55,route:[S(-222.6,90.2,5,'fetch',PI/2,'crate'),S(-226.6,94.5),S(-227.6,110),S(-228.4,120.6),S(-222,124.6,5,'fetch',PI),S(-228.4,120.6),S(-227.6,110),S(-226.6,94.5)]},
 {name:'Mirelle the Merchant',activity:'read',color:0x7b5e8a,route:[S(-198.4,132.4),S(-196.4,152),S(-185.7,157.8,8,'trade',2.4),S(-196.4,152),S(-198.4,132.4),S(-209,125.2),S(-212.4,125.2,6,'talk',0)]}
];
