import fs from 'node:fs';import {goods} from '../economy.js';import {weaponCatalog} from '../weapons.js';import {armorCatalog} from '../melee-stats.js';import {shieldCatalog} from '../shields.js';import {jewelryCatalog} from '../jewelry.js';import {landscapeLakes,lakeOutline} from '../geography.js';
const base=JSON.parse(fs.readFileSync('db/base-world.json')), actors=[],objects=[],catalog=[];
for(const [id,g]of Object.entries(goods)){const {icon,...data}=g;catalog.push({id:'item:'+id,data:{...data,...(jewelryCatalog[g.key]||{})}})}
for(const [id,data]of Object.entries(weaponCatalog))catalog.push({id:'weapon:'+id,data});for(const [id,data]of Object.entries(armorCatalog))catalog.push({id:'armor:'+id,data});for(const [id,data]of Object.entries(shieldCatalog))catalog.push({id:'shield:'+id,data});
for(const d of base.npcs){const guard=/guard|warden|sentinel|soldier/i.test(d.role+' '+d.name);actors.push({id:'base:npc:'+d.name,data:{...d,kind:'npc',template:guard?'guard':'villager',hp:guard?110:45,level:guard?20:5,damage:guard?12:4,attackSpeed:2.4,roam:d.behavior==='patrol'?3:0,respawn:30,attackable:false,hostile:false,attackType:guard?'slash':'punch'}})}
base.creatures.forEach((d,i)=>actors.push({id:'base:creature:'+i,data:d}));base.houses.forEach((d,i)=>objects.push({id:'base:door:'+i,kind:'door',x:d.x,z:d.z,data:d,open:d.open}));
for(const d of base.resources)objects.push({id:'base:'+d.kind+':'+d.x.toFixed(1)+':'+d.z.toFixed(1),kind:d.kind,x:d.x,z:d.z,data:{},open:false});
const quote=d=>"'"+JSON.stringify(d).replaceAll("'","''")+"'::jsonb";
let sql=`insert into eldervale_private.realm_catalog(id,data) select x->>'id',x->'data' from jsonb_array_elements(${quote(catalog)})x;\n`;
sql+=`insert into eldervale_private.realm_actors(id,data,x,z,hp) select x->>'id',x->'data',(x->'data'->>'x')::float8,(x->'data'->>'z')::float8,(x->'data'->>'hp')::integer from jsonb_array_elements(${quote(actors)})x;\n`;
fs.writeFileSync('db/realm-seed-0.sql',sql);
for(let i=0;i<objects.length;i+=600)fs.writeFileSync('db/realm-seed-'+(1+i/600)+'.sql',`insert into eldervale_private.realm_objects(id,kind,x,z,data,open) select x->>'id',x->>'kind',(x->>'x')::float8,(x->>'z')::float8,x->'data',(x->>'open')::boolean from jsonb_array_elements(${quote(objects.slice(i,i+600))})x on conflict(id) do nothing;`);
// Lake polygons match the deterministic world. River crossing mesh collision remains client pathfinding,
// while server sweep enforces buildings and lakes independently of the requested route.
fs.writeFileSync('db/realm-water.sql',landscapeLakes.map(l=>`insert into eldervale_private.realm_water(outline) values ('(${lakeOutline(l,.96).map(([x,z])=>'('+x+','+z+')').join(',')})'::polygon);`).join('\n'));
console.log('Seed:',actors.length,'actors,',objects.length,'objects,',catalog.length,'catalog entries');
