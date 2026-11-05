// Writes db/weapons-and-archery.sql: server catalog rows for every weapon and
// shield (weapons.js, shields.js), starter-chest flags, and the server combat
// rules for two-handed and ranged weapons.
// usage: node scripts/build-weapon-catalog.mjs
import fs from 'node:fs';
import {weaponCatalog} from '../weapons.js';
import {shieldCatalog} from '../shields.js';
const q=s=>"'"+String(s).replace(/'/g,"''")+"'";
const rows=[];
for(const [key,w] of Object.entries(weaponCatalog)){
 rows.push(['item:weapon:'+key,{name:w.name,buy:w.buy,sell:w.sell,field:'weaponsOwned',key}]);
 rows.push(['weapon:'+key,{name:w.name,desc:w.desc,kind:w.kind,damage:w.damage,attack:w.attack,speed:w.speed,reach:w.reach,...(w.twoHanded?{twoHanded:true}:{}),...(w.ranged?{ranged:true}:{})}]);
}
for(const [key,s] of Object.entries(shieldCatalog)){
 rows.push(['item:shield:'+key,{name:s.name,buy:s.buy,sell:s.sell,field:'shieldsOwned',key}]);
 rows.push(['shield:'+key,{name:s.name,desc:s.desc,kind:'shield',defence:s.defence}]);
}
// The original starter armoury contents. The chest grants only these.
const STARTER=['item:weapon:axe','item:weapon:battleaxe','item:weapon:dagger','item:weapon:longsword','item:weapon:pickaxe','item:weapon:scimitar','item:weapon:shortsword','item:weapon:twohand','item:shield:kite','item:shield:square','item:jewelry:prospectorsRing','item:jewelry:woodlandAmulet','item:mount:armoredWhiteHorse','item:armor:helm','item:armor:chest','item:armor:legs','item:armor:boots','item:armor:cape'];
const twoHanded=w=>`coalesce((select (data->>'twoHanded')::boolean from eldervale_private.realm_catalog where id='weapon:'||coalesce(${w},'none')),false)`;
// [function, exact text in the live definition, replacement]
const EDITS=[
 // Starter chest: only the starter items, not every catalog item.
 ['world_tick',"for d in select data||jsonb_build_object('id',id) from eldervale_private.realm_catalog where id like 'item:%' and data?'field' loop",
  "for d in select data||jsonb_build_object('id',id) from eldervale_private.realm_catalog where id like 'item:%' and data?'field' and coalesce((data->>'starter')::boolean,false) loop"],
 // Attack intents engage at the equipped weapon's range (bows), otherwise 3.
 ['world_tick',"if found and coalesce((a.data->>'floor')::integer,0)=p.floor and a.data->>'kind' in ('npc','monster') and sqrt(power(p.x-a.x,2)+power(p.z-a.z,2))<3 then",
  "if found and coalesce((a.data->>'floor')::integer,0)=p.floor and a.data->>'kind' in ('npc','monster') and sqrt(power(p.x-a.x,2)+power(p.z-a.z,2))<(case when p.intent->>'kind'='attack' then eldervale_private.attack_range(s.equipment->>'weapon') else 3 end) then"],
 // Monsters close in; an archer in range keeps shooting while they approach.
 ['world_tick',"   if dist>2.4 then dx:=target_player.x-a.x;dz:=target_player.z-a.z;step:=least(dt*1.7,dist-2);lx:=a.x+dx/dist*step;lz:=a.z+dz/dist*step;if eldervale_private.can_step(a.x,a.z,lx,lz) then update eldervale_private.realm_actors set x=lx,z=lz,yaw=atan2(dx,dz),phase='ready' where id=a.id;end if;continue;end if;\n   select * into victim from public.player_saves where user_id=a.target;\n   select data into w from eldervale_private.realm_catalog where id='weapon:'||coalesce(victim.equipment->>'weapon','unarmed');w:=coalesce(w,'{\"damage\":1,\"attack\":0,\"speed\":1.8}');",
  "   select * into victim from public.player_saves where user_id=a.target;\n   select data into w from eldervale_private.realm_catalog where id='weapon:'||coalesce(victim.equipment->>'weapon','unarmed');w:=coalesce(w,'{\"damage\":1,\"attack\":0,\"speed\":1.8}');\n   if dist>2.4 then\n    shooting:=coalesce((w->>'ranged')::boolean,false) and dist<=coalesce((w->>'reach')::float8,0);\n    dx:=target_player.x-a.x;dz:=target_player.z-a.z;step:=least(dt*1.7,dist-2);lx:=a.x+dx/dist*step;lz:=a.z+dz/dist*step;if eldervale_private.can_step(a.x,a.z,lx,lz) then update eldervale_private.realm_actors set x=lx,z=lz,yaw=atan2(dx,dz),phase=case when shooting then phase else 'ready' end where id=a.id;end if;\n    if not shooting then continue;end if;\n    if a.turn='enemy' then if a.phase='ready' then update eldervale_private.realm_actors set turn='player' where id=a.id;end if;continue;end if;\n   end if;"],
 // Two-handed weapons (any, not only the iron 2h sword) leave no hand for a shield.
 ['world_tick',"if victim.equipment->>'weapon'<>'twohand' then defence:=",`if not ${twoHanded("victim.equipment->>'weapon'")} then defence:=`],
 // Events tell clients when the player's attack is an arrow.
 ['world_tick',"perform eldervale_private.emit(jsonb_build_object('type','windup','side',a.turn,'target',a.id,'player',a.target,'attackType',a.data->>'attackType','style',target_player.attack_style));",
  "perform eldervale_private.emit(jsonb_build_object('type','windup','side',a.turn,'target',a.id,'player',a.target,'attackType',a.data->>'attackType','style',target_player.attack_style,'ranged',a.turn='player' and coalesce((w->>'ranged')::boolean,false)));"],
 ['world_tick',"perform eldervale_private.emit(jsonb_build_object('type','hit','target',a.id,'player',a.target,'side','player','blocked',blocked,'damage',damage));",
  "perform eldervale_private.emit(jsonb_build_object('type','hit','target',a.id,'player',a.target,'side','player','blocked',blocked,'damage',damage,'ranged',coalesce((w->>'ranged')::boolean,false)));"],
 ['world_tick',"chance float8;riding boolean;","chance float8;riding boolean;shooting boolean;"],
 // Equip: two-handed by catalog flag.
 ['realm_request_base',"if slot='weapon' and key='twohand' then s.equipment:=s.equipment||'{\"shield\":null}';elsif slot='shield' and s.equipment->>'weapon'='twohand' then s.equipment:=s.equipment||'{\"weapon\":null}';end if;",
  `if slot='weapon' and ${twoHanded('key')} then s.equipment:=s.equipment||'{"shield":null}';elsif slot='shield' and ${twoHanded("s.equipment->>'weapon'")} then s.equipment:=s.equipment||'{"weapon":null}';end if;`]
];
const spec=JSON.stringify(rows);
const sql=`-- Weapons and shields (Quaternius CC0 models) and archery.
-- Generated by scripts/build-weapon-catalog.mjs from weapons.js and shields.js.
--
-- * Catalog rows for ${Object.keys(weaponCatalog).length} weapons and ${Object.keys(shieldCatalog).length} shields (weapon rows carry twoHanded/ranged).
-- * Starter armoury chest grants only items flagged "starter" (the original
--   armoury contents), not every catalog item.
-- * Combat: attack intents engage at the weapon's range; while a monster closes
--   on an archer in range, the archer keeps the turn and shots resolve.
--   Windup/hit events carry "ranged". Shields are excluded by twoHanded, not by
--   the iron 2h sword key (this also lets unarmed players use shield defence).
-- Each function edit must match its exact text once, or the whole migration aborts.
begin;

insert into eldervale_private.realm_catalog(id,data)
select r->>0,r->1 from jsonb_array_elements(${q(spec)}::jsonb) r
on conflict (id) do update set data=excluded.data;
update eldervale_private.realm_catalog set data=data||'{"starter":true}' where id in (${STARTER.map(q).join(',')});

create or replace function eldervale_private.attack_range(weapon text) returns float8 language sql stable set search_path to '' as $$
 select coalesce((select case when coalesce((data->>'ranged')::boolean,false) then (data->>'reach')::float8 else 3 end from eldervale_private.realm_catalog where id='weapon:'||coalesce(weapon,'none')),3)
$$;
revoke all on function eldervale_private.attack_range(text) from public;

do $migration$
declare
 edits jsonb := ${q(JSON.stringify(EDITS))};
 e jsonb; def text; fn text;
begin
 for fn in select distinct x->>0 from jsonb_array_elements(edits) x loop
  select pg_get_functiondef(p.oid) into def from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='eldervale_private' and p.proname=fn;
  for e in select x from jsonb_array_elements(edits) x where x->>0=fn loop
   if (length(def)-length(replace(def,e->>1,'')))/length(e->>1)<>1 then raise exception 'Edit for % does not match exactly once: %',fn,left(e->>1,80); end if;
   def:=replace(def,e->>1,e->>2);
  end loop;
  execute def;
 end loop;
end
$migration$;

commit;
`;
fs.writeFileSync(new URL('../db/weapons-and-archery.sql',import.meta.url),sql);
console.log('db/weapons-and-archery.sql: '+rows.length+' catalog rows, '+EDITS.length+' function edits');
