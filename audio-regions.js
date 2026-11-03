import {worldRivers,landscapeLakes,segmentDistance} from './geography.js?v=release-20261103-owner1';
export const townMusic=[
 {id:'oakcross',name:'Oakcross',x:0,z:0,radius:50,title:'Lord of the Land'},
 {id:'northwatch',name:'Northwatch',x:-60,z:45,radius:22,title:'Night Vigil'},
 {id:'eastmarch',name:'Eastmarch',x:75,z:-55,radius:23,title:'Crusade'},
 {id:'farwatch',name:'Farwatch',x:105,z:103,radius:21,title:'Five Armies'},
 {id:'westmere',name:'Westmere',x:-210,z:145,radius:23,title:'Virtutes Instrumenti'},
 {id:'suncrest',name:'Suncrest',x:260,z:-185,radius:24,title:'Angevin'},
 {id:'greenwatch',name:'Greenwatch',x:225,z:215,radius:22,title:'Celtic Impulse'},
 {id:'ashen-ruins',name:'Ashen Ruins',x:-275,z:-215,radius:24,title:'Rites'},
 {id:'moonmere',name:'Moonmere',x:-114,z:82,radius:24,title:'Evening Fall (Harp)'},
 {id:'silverfin',name:'Silverfin',x:187,z:74,radius:24,title:'Lost Frontier'},
 {id:'pinehollow',name:'Pinehollow',x:-152,z:-133,radius:24,title:'Willow and the Light'},
 {id:'stonebridge',name:'Stonebridge',x:164,z:-116,radius:24,title:'The Britons'}
];
export const loginMusic={id:'login',name:'The gates of Eldervale',title:'Stoneworld Battle'};
export function musicRegion(position,current=null){
 if(!position||!Number.isFinite(position.x)||!Number.isFinite(position.z))return null;
 const distance=town=>Math.hypot(position.x-town.x,position.z-town.z);
 if(current&&townMusic.includes(current)&&distance(current)<current.radius+6)return current;
 return townMusic.filter(t=>distance(t)<=t.radius).sort((a,b)=>distance(a)-distance(b))[0]||null;
}
export function wildernessSound(position){
 if(!position)return 'forest';const {x,z}=position;
 for(const lake of landscapeLakes)if(Math.hypot((x-lake.x)/lake.rx,(z-lake.z)/lake.rz)<1.45)return 'water';
 for(const river of worldRivers)for(let i=1;i<river.points.length;i++)if(segmentDistance(x,z,river.points[i-1],river.points[i])<river.width/2+9)return 'water';
 return Math.abs(x)>290||Math.abs(z)>290?'highlands':'forest';
}
export function audioPreference(storage,key,fallback){const raw=storage.getItem(key);if(raw===null)return fallback;const value=Number(raw);return Number.isFinite(value)&&value>=0&&value<=100?value:fallback}
