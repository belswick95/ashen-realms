// Prints the realm_catalog and skill_recipes rows for the food ladder, raw fish and
// fishing tools as SQL, from food.js / fishing.js (pasted into db/osrs-skills-and-food.sql).
import {foodItems,foodRecipes,fishTable} from '../food.js';
import {fishingItems} from '../fishing.js';
const q=s=>"'"+String(s).replaceAll("'","''")+"'";
const rows=[];
for(const [id,d]of Object.entries(foodItems)){const data={name:d.name,model:d.model,buy:d.buy,sell:d.sell,stackable:false,unique:false,category:d.category,icon:'supply',description:d.description,...(d.color?{color:d.color}:{}),...(d.healPct?{heal:d.heal,healPct:d.healPct}:{})};rows.push([id,data])}
for(const id of ['lobsterPot','harpoon']){const d=fishingItems[id];rows.push([id,{name:d.name,model:d.model,buy:d.buy,sell:d.sell,unique:true,stackable:false,category:'Tools',description:d.description}])}
console.log('insert into eldervale_private.realm_catalog(id,data) values');
console.log(rows.map(([id,data])=>' ('+q('item:'+id)+','+q(JSON.stringify(data))+'::jsonb)').join(',\n'));
console.log('on conflict(id) do update set data=eldervale_private.realm_catalog.data||excluded.data;');
console.log('insert into eldervale_private.skill_recipes(id,data) values');
console.log(Object.entries(foodRecipes).map(([id,r])=>' ('+q(id)+','+q(JSON.stringify(r))+'::jsonb)').join(',\n'));
console.log('on conflict(id) do update set data=excluded.data;');
console.log('-- fish_table: '+JSON.stringify(fishTable));
