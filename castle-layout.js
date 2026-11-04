// Shared measurements for terrain, maps, server seed and the editable castle blueprint.
import {entityDefaults} from './world-templates.js?v=release-20261104-audit45';
export const castle={x:-340,z:-305,name:'Eldervale Castle',half:49,moatInner:54,moatOuter:63};
export function inCastle(x,z,pad=0){return Math.abs(x-castle.x)<castle.moatOuter+pad&&Math.abs(z-castle.z)<castle.moatOuter+pad}
export function inMoat(x,z){const d=Math.max(Math.abs(x-castle.x),Math.abs(z-castle.z));return d>castle.moatInner&&d<castle.moatOuter}
export function castleBlueprint(){
 const rows=[];let n=0;
 const add=(template,x,z,extra={})=>rows.push({...entityDefaults(template,castle.x+x,castle.z+z),blueprint:'eldervale-castle-v1',blueprintKey:String(++n),...extra});
 for(const x of [-36,-12,12,36])add('castle_wall',x,-49,{length:24});for(const x of [-31.5,31.5])add('castle_wall',x,49,{length:35});
 for(const x of [-49,49])for(const z of [-36,-12,12,36])add('castle_wall',x,z,{length:24,yaw:90});
 for(const x of [-49,49])for(const z of [-49,49])add('castle_tower',x,z);
 add('castle_gate',0,49,{name:'Eldervale Great Gate',length:28});
 add('bank',-26,-7,{name:'Royal Treasury & Bank',scale:2.3,stone:true});
 add('cottage',27,-10,{name:'Chapel of the Dawn',scale:2.5,stone:true,room:'chapel'});
 add('inn',-25,23,{name:'Castle Kitchen & Refectory',scale:2.3,room:'kitchen'});
 add('forge',28,24,{name:'Royal Smithy',scale:2,stone:true});
 add('cottage',0,-29,{name:'Eldervale Great Hall',scale:4.4,stone:true,room:'hall'});
 add('castle_tower',-19,-34,{scale:1.1});add('castle_tower',19,-34,{scale:1.1});
 add('altar',27,-12,{name:'Altar of the Dawn'});add('hearth',-25,21,{name:'Royal cooking hearth'});
 add('fountain',0,3,{name:'Crown Fountain',scale:1.7});
 add('road',0,23,{length:50,width:7});add('road',0,-15,{length:24,width:6});add('road',0,2,{length:78,width:5,yaw:90});
 for(const x of [-9,9])for(const z of [-18,16,35])add('lantern',x,z);
 for(const x of [-13,13])for(const z of [8,18])add('bench',x,z,{yaw:x<0?90:-90});
 for(const [x,z]of [[-14,41],[14,41],[-42,-37],[42,-37]])add('banner',x,z,{name:'Royal standard'});
 add('banker',-26,-6,{name:'Maelin the Royal Banker',activity:'read',dialogue:'The royal vault keeps your belongings safe. Your bank is shared with every branch.'});
 add('healer',27,-9,{name:'Sister Adeline',dialogue:'Pray at the altar behind me. The Dawn watches over all travelers.'});
 add('innkeeper',-25,24,{name:'Cook Rowan',activity:'trade',dialogue:'Fresh fish on the hearth! Bring raw fish and use the cooking hearth.'});
 add('smith',28,25,{name:'Master Smith Torren',activity:'smith'});
 for(const [template,x,z,name,shop]of [['merchant',-18,7,'Elsa the Quartermaster',{'weapon:longsword':{buy:70,sell:35,stock:-1},'weapon:scimitar':{buy:90,sell:45,stock:-1},'shield:kite':{buy:80,sell:40,stock:-1}}],['merchant',18,7,'Bren the Provisioner',{fishingPole:{buy:35,sell:12,stock:-1},bait:{buy:2,sell:1,stock:-1},rawFish:{buy:12,sell:6,stock:1000}}]]){add('market',x,z);add(template,x,z-1,{name,shop})}
 for(const [x,z,name,activity,roam]of [[-12,17,'Perrin the Porter','carry',5],[12,-6,'Lyra the Courier','carry',8],[-9,7,'Hale the Groundskeeper','sweep',4],[10,24,'Mira the Gardener','garden',3],[0,-27,'Royal Archivist Iven','read',0]])add('villager',x,z,{name,activity,roam});
 for(const [x,z,roam]of [[-5,65,0],[5,65,0],[-36,32,5],[36,32,5],[-32,-25,5],[32,-30,4]])add('white_knight',x,z,{roam,name:roam?'White Knight patrol':'White Knight gatekeeper'});
 return rows;
}
