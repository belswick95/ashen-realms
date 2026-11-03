// Original Eldervale templates. All actors have a combat profile, including peaceful services.
const npc=(name,role,weapon,attackType,color,extra={})=>({kind:'npc',name,role,weapon,attackType,color,level:5,hp:45,damage:4,attackSpeed:2.4,roam:3,respawn:30,attackable:false,hostile:false,scale:1,dialogue:'Welcome, traveler. These roads connect us all.',...extra});
const monster=(name,species,attackType,level,hp,damage,extra={})=>({kind:'monster',name,species,attackType,level,hp,damage,attackSpeed:2.6,roam:5,respawn:30,attackable:true,hostile:false,scale:1,...extra});
export const worldTemplates={
 villager:npc('Town resident','resident',null,'punch',0x7f845b),
 guard:npc('Town guard','guard','longsword','slash',0x53677b,{level:20,hp:110,damage:12,hostile:false}),
 banker:npc('Royal banker','banker','longsword','stab',0x7a577c,{roam:0}),
 merchant:npc('Traveling merchant','merchant','dagger','stab',0x9c744d,{roam:0}),
 smith:npc('Ironworker','smith','battleaxe','hammer',0x585565,{roam:0}),
 ranger:npc('Woodland ranger','ranger','shortsword','arrow',0x546d42,{level:12,hp:70,damage:8}),
 mage:npc('Ember scholar','mage',null,'magic',0x60518b,{level:18,hp:65,damage:13}),
 healer:npc('Temple healer','healer',null,'magic',0xe0d6af,{damage:5,roam:0}),
 knight:npc('Royal knight','guard','twohand','slash',0x53687a,{level:35,hp:180,damage:19,attackSpeed:3.2}),
 farmer:npc('Field keeper','farmer','axe','slash',0x9b7c4d),
 innkeeper:npc('Innkeeper','innkeeper',null,'punch',0x88584b,{roam:0}),
 bandit:monster('Road bandit','human','stab',12,65,8,{weapon:'dagger',hostile:true}),
 goblin:monster('Goblin raider','goblin','slash',8,42,6,{weapon:'shortsword',hostile:true,scale:.8}),
 skeleton:monster('Restless skeleton','skeleton','slash',16,75,11,{weapon:'longsword',hostile:true}),
 wolf:monster('Grey wolf','wolf','bite',7,38,5,{hostile:true,attackSpeed:2}),
 deer:monster('Red deer','deer','kick',4,32,4,{attackSpeed:2.8}),
 boar:monster('Wild boar','boar','charge',9,55,7),
 bear:monster('Forest bear','bear','claw',22,140,15,{scale:1.3,attackSpeed:3}),
 rat:monster('Giant rat','rat','bite',2,18,2,{scale:.7,attackSpeed:1.7}),
 spider:monster('Marsh spider','spider','venom',11,48,8,{hostile:true}),
 bat:monster('Cave bat','bat','swoop',5,25,4,{attackSpeed:2}),
 troll:monster('Hill troll','troll','slam',32,240,21,{hostile:true,scale:1.6,attackSpeed:3.6}),
 golem:monster('Stone guardian','golem','slam',45,360,27,{hostile:true,scale:1.5,attackSpeed:4}),
 wraith:monster('Night wraith','wraith','magic',28,125,18,{hostile:true}),
 dragon:monster('Ember dragon','dragon','fire',75,850,38,{hostile:true,scale:1.8,attackSpeed:4.5,roam:8}),
};
for(const [id,name] of Object.entries({fishing_spot:'Fishing spot',fountain:'Town fountain',road:'Path segment',terrain_grass:'Grass terrain',terrain_sand:'Sandy terrain',terrain_stone:'Stone terrain',terrain_snow:'Snow terrain',crate:'Supply crate',barrel:'Oak barrel',chest:'Treasure chest',bench:'Town bench',fence:'Timber fence',lantern:'Street lantern',market:'Market stall',well:'Stone well',campfire:'Campfire',tree:'Oak tree',pine:'Pine tree',rock:'Boulder',banner:'Town banner',cottage:'Cottage',bank:'Bank',inn:'Inn',forge:'Forge',ruin:'Ruined wall'}))worldTemplates[id]={kind:'object',name,scale:1,level:1,hp:1,damage:0,attackSpeed:2.4,roam:0,respawn:0,attackable:false,hostile:false};
for(const id of ['terrain_grass','terrain_sand','terrain_stone','terrain_snow'])Object.assign(worldTemplates[id],{radius:10,elevation:0});worldTemplates.road.length=10;worldTemplates.road.width=2.5;
export const attackTypes=['slash','punch','stab','hammer','arrow','magic','bite','kick','charge','claw','venom','swoop','slam','fire'];
export function entityDefaults(template,x=0,z=0){const t=worldTemplates[template];if(!t)throw Error('Unknown template');return {...t,template,x,z,yaw:0};}
export function validateEntity(d){if(!d||!worldTemplates[d.template]&&d.kind!=='item')throw Error('Unknown template');for(const k of ['x','z','yaw','scale','level','hp','damage','attackSpeed','roam','respawn'])if(!Number.isFinite(Number(d[k])))throw Error('Invalid '+k);if(Math.abs(d.x)>4500||Math.abs(d.z)>4500||d.scale<.25||d.scale>5||d.hp<1||d.hp>100000||d.level<1||d.level>999||d.attackSpeed<1.3||d.attackSpeed>30)throw Error('Values outside world limits');return d;}
