create or replace function eldervale_private.admin_action(command text,payload jsonb default '{}') returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid;item text;n integer;c jsonb;r jsonb;k text;v jsonb;old jsonb;id text;station text;
begin
 if command='setskill' and coalesce(payload->>'skill','') not in('miningXP','woodXP','fletchingXP','runecraftingXP','constructionXP','hunterXP') then return eldervale_private.admin_before_professions(command,payload);end if;
 if command not in('give','catalog_recipe','reset_build','setskill','catalog_item') then return eldervale_private.admin_before_professions(command,payload);end if;
 if not eldervale_private.is_owner() then raise exception 'Owner access required' using errcode='42501';end if;
 if payload is null or jsonb_typeof(payload)<>'object' or pg_column_size(payload)>8192 then raise exception 'Invalid owner request';end if;
 perform pg_advisory_xact_lock(736211);
 if command='catalog_item' then
  k:=coalesce(payload->>'model','sack');if k not in('sack','ore','bar','logs','potion','vial','bread','fish','apple','herb','gem','ring','rune','plank','nails','arrows','hide','seeds','feather','bow','trap','mortar','leather','food','meat','berries') then raise exception 'Choose an available drop model';end if;
  r:=eldervale_private.admin_before_professions(command,payload);r:=r||jsonb_build_object('model',k);update eldervale_private.realm_catalog set data=data||jsonb_build_object('model',k) where realm_catalog.id='item:'||(payload->>'id');
 elsif command='setskill' then
  uid:=coalesce((payload->>'userId')::uuid,auth.uid());k:=payload->>'skill';n:=(payload->>'level')::integer;
  if k not in('attackXP','strengthXP','defenceXP','hitpointsXP','rangedXP','magicXP','prayerXP','miningXP','woodXP','firemakingXP','fishingXP','cookingXP','smithingXP','craftingXP','herbloreXP','farmingXP','agilityXP','thievingXP','fletchingXP','runecraftingXP','constructionXP','hunterXP') or n not between 1 and 100 then raise exception 'Choose a skill and a level from 1 to 100';end if;
  if not exists(select 1 from public.player_saves where user_id=uid) then raise exception 'Player has no character';end if;
  if k in('miningXP','woodXP') then update public.player_saves set stats=stats||jsonb_build_object(k,50*(n-1)*(n-1)) where user_id=uid;else update public.player_saves set skills=skills||jsonb_build_object(k,50*(n-1)*(n-1)) where user_id=uid;end if;r:=jsonb_build_object('skill',k,'level',n,'userId',uid);
 elsif command='give' then
  uid:=coalesce((payload->>'userId')::uuid,auth.uid());item:=payload->>'item';n:=coalesce((payload->>'amount')::integer,1);
  if n not between 1 and 1000000 then raise exception 'Quantity must be 1–1,000,000';end if;
  if not exists(select 1 from public.player_saves where user_id=uid) then raise exception 'Player has no character';end if;
  if item<>'gold' then
   select data into c from eldervale_private.realm_catalog where realm_catalog.id='item:'||item;if c is null then raise exception 'Unknown item';end if;
   if c?'field' and n<>1 then raise exception 'Grant equipment one at a time; bank storage can hold additional copies';end if;
   if coalesce((c->>'unique')::boolean,false) and (n<>1 or coalesce(eldervale_private.item_quantity(uid,item),0)>0) and coalesce(payload->>'destination','inventory')<>'bank' then raise exception 'You already carry this tool';end if;
  end if;
  if coalesce(payload->>'destination','inventory') not in('inventory','bank') then raise exception 'Choose inventory or bank';end if;
  perform eldervale_private.item_change(uid,item,n,coalesce(payload->>'destination','inventory')='bank');
  if coalesce(payload->>'destination','inventory')='inventory' and eldervale_private.inventory_used(uid)>16 then raise exception 'Inventory full. Free slots, reduce the quantity, or explicitly choose Send to bank.';end if;
  r:=jsonb_build_object('item',item,'amount',n,'destination',coalesce(payload->>'destination','inventory'),'userId',uid);
 elsif command='reset_build' then
  id:=payload->>'id';if not exists(select 1 from eldervale_private.entities where entities.id::text=id and data->>'template'='construction_site' and not deleted) then raise exception 'Choose a construction site';end if;
  update eldervale_private.settings set revision=revision+1 where settings.id;
  update eldervale_private.entities set data=data||'{"built":false}',revision=(select revision from eldervale_private.settings where settings.id) where entities.id::text=id returning data into r;
 else
  id:=payload->>'id';r:=payload->'recipe';
  if id is null or id!~'^[a-z][A-Za-z0-9_]{1,60}$' or r is null or jsonb_typeof(r)<>'object' then raise exception 'Choose a recipe ID and definition';end if;
  if coalesce(r->>'skill','') not in('mining','woodcutting','fishing','firemaking','smithing','cooking','crafting','fletching','herblore','farming','runecrafting','construction','hunter','agility','thieving') or length(coalesce(r->>'name','')) not between 2 and 80 or coalesce((r->>'level')::integer,0) not between 1 and 100 or coalesce((r->>'xp')::integer,-1) not between 0 and 10000 or coalesce((r->>'seconds')::numeric,0) not between .6 and 30 then raise exception 'Check skill, name, level (1–100), XP (0–10,000), time (0.6–30s)';end if;
  select data into old from eldervale_private.skill_recipes where skill_recipes.id=id;
  if old is null and (select count(*) from eldervale_private.skill_recipes)>=500 then raise exception 'Recipe catalog limit reached';end if;
  station:=r->>'station';if station is not null and station not in('mining_rock','furnace','anvil','cooking','mill','workbench','spinning_wheel','tanning_rack','rune_altar','farming_patch','hunting_ground','agility_log','thieving_stall','practice_chest','water','herb_patch','flax_patch','wheat_patch','berry_bush','essence_rock') then raise exception 'Unknown station';end if;
  if jsonb_typeof(r->'inputs') is distinct from 'object' or jsonb_typeof(r->'outputs') is distinct from 'object' or jsonb_typeof(r->'tools') is distinct from 'array' then raise exception 'Choose materials, products and tools';end if;
  if (select count(*) from jsonb_each(r->'inputs'))>8 or (select count(*) from jsonb_each(r->'outputs'))>8 or jsonb_array_length(r->'tools')>5 then raise exception 'Use up to 8 materials, 8 products and 5 tools';end if;
  for k,v in select key,value from jsonb_each((r->'inputs')||(r->'outputs')) loop
   if (k<>'gold' and not exists(select 1 from eldervale_private.realm_catalog where realm_catalog.id='item:'||k)) or jsonb_typeof(v)<>'number' or v::numeric not between 1 and 1000 or v::numeric<>trunc(v::numeric) then raise exception 'Invalid item or quantity: %',k;end if;
  end loop;
  for k in select jsonb_array_elements_text(r->'tools') loop if k<>'firelighter' and not exists(select 1 from eldervale_private.realm_catalog where realm_catalog.id='item:'||k) then raise exception 'Unknown tool: %',k;end if;end loop;
  -- Owners can tune built-in special actions; custom recipes use the safe item-processing engine.
  r:=coalesce(old,'{}')||jsonb_build_object('name',r->>'name','skill',r->>'skill','level',(r->>'level')::integer,'xp',(r->>'xp')::integer,'seconds',(r->>'seconds')::float8,'station',station,'inputs',r->'inputs','outputs',r->'outputs','tools',r->'tools','enabled',coalesce((r->>'enabled')::boolean,true),'kind',coalesce(old->>'kind','process'));
  insert into eldervale_private.skill_recipes(id,data) values(id,r) on conflict on constraint skill_recipes_pkey do update set data=excluded.data;
  update eldervale_private.settings set revision=revision+1 where settings.id;
 end if;
 insert into eldervale_private.audit(actor,action,target,before_data,after_data) values(auth.uid(),command,coalesce(uid::text,id),old,r);
 return r;
end $$;
