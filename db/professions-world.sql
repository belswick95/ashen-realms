-- A small persistent starter workshop and resource trail. Every node remains
-- editable/movable/deletable in World Studio; existing towns are untouched. The higher-tier
-- rocks carry the Eldervale metal names ("legacy": their first names, still matched on re-runs).
do $$declare row jsonb;d jsonb;rev bigint;dx float8;dz float8;ok boolean;i integer;begin
 perform pg_advisory_xact_lock(736211);update eldervale_private.settings set revision=revision+1 where id returning revision into rev;
 for row in select value from jsonb_array_elements('[
 {"template":"furnace","name":"Royal smelting furnace","x":-325,"z":-302},
 {"template":"anvil","name":"Royal smithing anvil","x":-325,"z":-298},
 {"template":"workbench","name":"Carpenter’s workbench","x":-325,"z":-294},
 {"template":"spinning_wheel","name":"Castle spinning wheel","x":-325,"z":-290},
 {"template":"tanning_rack","name":"Tanning rack","x":-355,"z":-290},
 {"template":"mill","name":"Hand grain mill","x":-355,"z":-286},
 {"template":"rune_altar","name":"Elemental runecrafting altar","x":-310,"z":-295},
 {"template":"farming_patch","name":"Royal allotment","x":-350,"z":-300},
 {"template":"construction_site","name":"Public bench building site","x":-350,"z":-296},
 {"template":"thieving_stall","name":"Training thieving stall","x":-350,"z":-292},
 {"template":"practice_chest","name":"Practice lock chest","x":-350,"z":-288},
 {"template":"herb_patch","name":"Wild herbs","x":-275,"z":-280},
 {"template":"flax_patch","name":"Wild flax","x":-270,"z":-280},
 {"template":"wheat_patch","name":"Wild wheat","x":-265,"z":-280},
 {"template":"berry_bush","name":"Wild berry bush","x":-260,"z":-280},
 {"template":"essence_rock","name":"Rune essence outcrop","x":-255,"z":-280},
 {"template":"hunting_ground","name":"Woodland trapping ground","x":-250,"z":-280},
 {"template":"agility_log","name":"Woodland balance log","x":-245,"z":-280},
 {"template":"rock","resource":"copperOre","name":"Copper rocks","x":-275,"z":-290},
 {"template":"rock","resource":"tinOre","name":"Tin rocks","x":-270,"z":-290},
 {"template":"rock","resource":"ore","name":"Iron rocks","x":-265,"z":-290},
 {"template":"rock","resource":"coal","name":"Coal rocks","x":-260,"z":-290},
 {"template":"rock","resource":"silverOre","name":"Silver rocks","x":-255,"z":-290},
 {"template":"rock","resource":"goldOre","name":"Gold rocks","x":-250,"z":-290},
 {"template":"rock","resource":"mithrilOre","name":"Moonsilver rocks","legacy":"Mithril rocks","x":-245,"z":-290},
 {"template":"rock","resource":"adamantOre","name":"Verdite rocks","legacy":"Adamantite rocks","x":-240,"z":-290},
 {"template":"rock","resource":"runiteOre","name":"Tidestone rocks","legacy":"Runite rocks","x":-235,"z":-290},
 {"template":"tree","logItem":"oakLogs","name":"Oak timber tree","x":-275,"z":-300},
 {"template":"tree","logItem":"willowLogs","name":"Willow timber tree","x":-270,"z":-300},
 {"template":"tree","logItem":"mapleLogs","name":"Maple timber tree","x":-265,"z":-300},
 {"template":"pine","logItem":"yewLogs","name":"Yew timber tree","x":-260,"z":-300}
 ]'::jsonb) loop
  if exists(select 1 from eldervale_private.entities where data->>'blueprint'='professions-v1' and data->>'name' in(row->>'name',coalesce(row->>'legacy',row->>'name'))) then continue;end if;
  dx:=(row->>'x')::float8;dz:=(row->>'z')::float8;ok:=false;
  -- Only place on dry, collision-free ground, clear of doors and other nodes.
  for i in 0..80 loop
   if i>0 then dx:=(row->>'x')::float8+((i%9)-4)*4;dz:=(row->>'z')::float8+floor(i/9.0)*4;end if;
   if exists(select 1 from eldervale_private.realm_objects where kind='door' and sqrt(power(x-dx,2)+power(z-dz,2))<9*coalesce((data->>'scale')::float8,1)) then continue;end if;
   if exists(select 1 from eldervale_private.entities where not deleted and data->>'kind'='object' and data->>'template' not like 'terrain_%' and data->>'template' not in('road','plaza') and sqrt(power((data->>'x')::float8-dx,2)+power((data->>'z')::float8-dz,2))<3.5) then continue;end if;
   if (select bool_and(eldervale_private.can_step(dx+v.x,dz+v.z,dx+v.x,dz+v.z)) from (values(0.,0.),(-1.6,-1.0),(-1.6,1.0),(1.6,-1.0),(1.6,1.0))v(x,z)) then ok:=true;exit;end if;
  end loop;
  if not ok then raise exception 'No clear position for %',row->>'name';end if;
  d:='{"kind":"object","yaw":0,"scale":1,"level":1,"hp":1,"damage":0,"attackSpeed":2.4,"roam":0,"respawn":0,"attackable":false,"hostile":false,"blueprint":"professions-v1"}'::jsonb||(row-'legacy')||jsonb_build_object('x',dx,'z',dz);
  insert into eldervale_private.entities(revision,data) values(rev,d);
 end loop;
end $$;
